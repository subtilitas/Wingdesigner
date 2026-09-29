// Half-wing construction: NURBS profiles -> compatible sections -> spanwise stations
// (sections, spanwise interpolation, optional guide curves) -> tensor-product NURBS surface.
//
// Surface parametrization: u runs around the profile from the upper trailing edge (u = 0) over the
// leading edge (u = uLE) to the lower trailing edge (u = 1); v is the span fraction (0 root, 1 tip).

import { LIMITS as AIRFOIL_LIMITS, checkAirfoil } from '../airfoil/sanity.js';
import { setTrailingEdgeGap } from '../airfoil/geometry.js';
import { averagingKnots, basisFuns, collocationFactor, collocationSolve, curvePoint, findSpan, interpolateCurve, parametrize, surfacePoint } from './nurbs.js';
import { CROSSING_LIMIT, CROSSING_TOLERANCE, cosineStations, curveCrossing, profileCurve, profileProblem, resampleProfile } from './profile.js';
import { spanwiseBlender } from './spanwise.js';
import { guideCurve, guideProblems, guideXAt, isMonotonicInY } from './guide.js';
import { LIMITS, limitErrors, resolveSettings } from '../model/project.js';
import { displayName, loftGrid, sizeWarning } from '../model/budget.js';

/**
 * Deviation (mm) between loft and intended surface above which stations are added and, if it remains,
 * a warning is issued; small chords use 10 % of the local chord instead.
 */
export const PLANFORM_TOLERANCE = 0.5;
const deviationTolerance = (chord) => Math.min(PLANFORM_TOLERANCE, 0.1 * chord);

/** Span samples for the chord check (in addition to stations and guide breakpoints). */
const CHORD_CHECK_SAMPLES = 256;

/**
 * Fitted chord (mm, along the intended chord direction) below which the build stops: the 1 mm
 * minimum chord less the 10 % deviation that small chords may keep.
 */
export const FOLD_LIMIT = 0.9 * LIMITS.minChord;

/**
 * Smooth spanwise interpolation: largest distance, as a multiple of the section value range, by
 * which an interpolated value (leading-edge x, chord, z, twist, profile coordinate) may leave that
 * range. Natural cubic splines through closely spaced sections overshoot by thousands of times it.
 */
export const OVERSHOOT_LIMIT = 2;

/** Surface rows tested halfway between fitted stations (the widest intervals), besides the sections. */
const MAX_STATION_ROWS = 64;

/** Stations the builder may add where the loft deviates from the intended planform. */
const MAX_EXTRA_STATIONS = 32;

/** Largest trailing-edge gap as a fraction of the local chord. */
export const MAX_GAP_FRACTION = 0.05;

/**
 * Crossed surfaces past 99 % chord up to this fraction of the chord, and at most CROSSING_LIMIT mm,
 * count as zero thickness: the resampled trailing edge of a cusped airfoil can lie in a sliver that
 * the curve crossing check accepts. Equals the crossed trailing-edge limit of the airfoil checks.
 */
const TE_SLIVER = 1e-4;

/** TE_SLIVER as a fraction of the given chord (mm). */
const teSliver = (chord) => Math.min(TE_SLIVER, CROSSING_LIMIT / chord);

/** Negative chord (mm) below which nose line and end line count as crossed. */
const CROSS_TOLERANCE = 0.01;

/** Smallest trailing-edge gap in mm for an open trailing edge (at most MAX_GAP_FRACTION of the chord). */
export const MIN_OPEN_GAP = 0.01;

/** Place normalized profile points into 3D. */
export function placeSection(shape, { xLE, y, z, chord, twist }, pivot) {
  const a = (twist * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return shape.map(([px, pz]) => {
    const dx = px - pivot;
    const rx = dx * c + pz * s;
    const rz = -dx * s + pz * c;
    return [xLE + chord * (pivot + rx), y, z + chord * rz];
  });
}

function applyTrailingEdge(shape, mode, gapFraction, leIndex) {
  if (mode === 'asis') return shape;
  const gap = mode === 'closed' ? 0 : Math.max(0, gapFraction);
  const out = setTrailingEdgeGap(shape, gap, { leIndex });
  if (gap === 0) {
    const n = out.length - 1;
    const mid = [(out[0][0] + out[n][0]) / 2, (out[0][1] + out[n][1]) / 2];
    out[0] = mid.slice();
    out[n] = mid.slice();
  }
  return out;
}

/**
 * Move the curve's leading edge (point N) to the origin and scale so the trailing-edge midpoint
 * lies at x = 1: section placement then refers to the exact NURBS leading edge and chord.
 */
function unitChord(points, N) {
  const le = points[N];
  const teX = (points[0][0] + points[points.length - 1][0]) / 2;
  const c = teX - le[0];
  return points.map(([x, y]) => [(x - le[0]) / c, (y - le[1]) / c]);
}

/** Concatenate clamped curves that share end points into one curve with C0 joins. */
export function joinCurves(curves) {
  const p = curves[0].degree;
  const knots = curves[0].knots.slice();
  const points = curves[0].points.slice();
  // Appended in place: copying the joined arrays per curve took time quadratic in the curve count.
  for (let i = 1; i < curves.length; i++) {
    knots.pop();
    const K = curves[i].knots;
    for (let j = p + 1; j < K.length; j++) knots.push(K[j]);
    const P = curves[i].points;
    for (let j = 1; j < P.length; j++) points.push(P[j]);
  }
  return { degree: p, knots, points };
}

/**
 * Interpolate columns of control points along v.
 * scheme: { kind: 'global', params, degree } | { kind: 'panels', params, panels: [[a, b], ...], degree }
 * values: array over stations of equally sized point arrays.
 * Returns { degree, knots, points: [station-independent index][i] }.
 */
function interpolateAlongV(values, scheme) {
  const nCols = values[0].length;
  const cols = [];
  for (let i = 0; i < nCols; i++) {
    const series = values.map((row) => row[i]);
    if (scheme.kind === 'global') {
      cols.push(interpolateCurve(series, scheme.degree, { params: scheme.params }));
    } else {
      const parts = scheme.panels.map(([a, b]) => {
        const f0 = scheme.params[a];
        const f1 = scheme.params[b];
        // Two stations: the interpolating curve is the straight segment through them (degree 1,
        // knots 0, 0, 1, 1), as interpolateCurve returns it, without the solve.
        if (b - a === 1) return { degree: 1, knots: [0, 0, 1, 1].map((t) => f0 + t * (f1 - f0)), points: [series[a].slice(), series[b].slice()] };
        const local = scheme.params.slice(a, b + 1).map((f) => (f - f0) / (f1 - f0));
        const c = interpolateCurve(series.slice(a, b + 1), scheme.degree, { params: local });
        return { degree: c.degree, knots: c.knots.map((t) => f0 + t * (f1 - f0)), points: c.points };
      });
      cols.push(joinCurves(parts));
    }
  }
  return { degree: cols[0].degree, knots: cols[0].knots, columns: cols.map((c) => c.points) };
}

// Profile stage per airfoil (checks, NURBS curve, crossing test), keyed by the parametrization and
// a hash of the points; resampled shapes are kept per chord-sample count N. Airfoils rarely change
// between edits. A hit is confirmed by comparing the points, so a hash collision only costs a miss.
const PROFILE_CACHE = new Map();
const PROFILE_CACHE_SIZE = 32;

const F64 = new Float64Array(1);
const U32 = new Uint32Array(F64.buffer);

/** Two 32-bit hashes (FNV-1a and a multiplicative mix) over the bits of every coordinate. */
function pointsHash(points) {
  let h1 = 0x811c9dc5;
  let h2 = points.length;
  for (const p of points) {
    for (let c = 0; c < 2; c++) {
      F64[0] = p[c];
      h1 = Math.imul(h1 ^ U32[0], 0x01000193);
      h1 = Math.imul(h1 ^ U32[1], 0x01000193);
      h2 = Math.imul(h2 ^ U32[1], 0x5bd1e995);
      h2 = Math.imul(h2 ^ U32[0], 0x5bd1e995);
      h2 ^= h2 >>> 15;
    }
  }
  return `${points.length}:${(h1 >>> 0).toString(36)}:${(h2 >>> 0).toString(36)}`;
}

const samePoints = (a, b) => a.length === b.length && a.every((p, i) => p[0] === b[i][0] && p[1] === b[i][1]);

function profileStage(a, parametrization, chordStations, N) {
  const key = `${parametrization}|${pointsHash(a.points)}`;
  let entry = PROFILE_CACHE.get(key);
  if (entry && samePoints(entry.source, a.points)) {
    // Most recently used entries sit at the end of the map (insertion order).
    PROFILE_CACHE.delete(key);
  } else {
    entry = { source: a.points.map((p) => [p[0], p[1]]), compat: new Map() };
    const check = checkAirfoil(a.points);
    if (!check.ok) {
      entry.error = check.issues.filter((i) => i.severity === 'error').map((i) => i.message).join(' ');
    } else {
      try {
        const prof = profileCurve(check.points, { parametrization });
        const problem = profileProblem(prof);
        if (problem) entry.error = problem;
        else Object.assign(entry, { prof, points: check.points });
      } catch (e) {
        entry.error = `the NURBS interpolation failed (${e.message}).`;
      }
    }
  }
  PROFILE_CACHE.set(key, entry);
  if (!entry.error && !entry.compat.has(N)) {
    entry.compat.set(N, unitChord(resampleProfile(entry.prof, chordStations), N));
    // The current and the previous chord-sample count.
    if (entry.compat.size > 2) entry.compat.delete(entry.compat.keys().next().value);
  }
  return entry;
}

/**
 * Crossing of a profile stage's fitted curve at a tolerance below CROSSING_TOLERANCE (a fraction of
 * the chord), cached on the stage per tolerance.
 */
function stageCrossing(stage, tolerance) {
  stage.crossings ??= new Map();
  if (!stage.crossings.has(tolerance)) stage.crossings.set(tolerance, curveCrossing(stage.prof.curve, { tolerance }));
  return stage.crossings.get(tolerance);
}

/**
 * Crossing of the surface row at parameter v. Rows lie in planes y = const (every station lies in
 * one), so the row is tested in the x-z plane. Returns { x, size } in mm or null.
 */
export function surfaceRowCrossing(surface, v, tolerance) {
  // Non-rational surface: the v basis at this row is the same for every control column.
  const p = surface.degreeV;
  const span = findSpan(surface.points[0].length - 1, p, v, surface.knotsV);
  const Nb = basisFuns(span, v, p, surface.knotsV);
  const ctrl = surface.points.map((col) => {
    let x = 0;
    let z = 0;
    for (let j = 0; j <= p; j++) {
      x += Nb[j] * col[span - p + j][0];
      z += Nb[j] * col[span - p + j][2];
    }
    return [x, z];
  });
  return curveCrossing({ degree: surface.degreeU, knots: surface.knotsU, points: ctrl }, { tolerance, samplesPerSpan: 4 });
}

/**
 * Build the half wing.
 * @param {object} project see src/model/project.js
 * @returns {object} build result with surface, stations, profiles, guides, errors and warnings
 */
export function buildWing(project) {
  const errors = [];
  const warnings = [];
  const settings = resolveSettings(project.settings);
  const sections = project.sections.slice().sort((a, b) => a.y - b.y);
  const result = { settings, sections, errors, warnings, surface: null, stations: [], profiles: new Map(), guides: {} };
  if (sections.length < 2) {
    errors.push('At least 2 sections are required.');
    return result;
  }
  // The limits of project validation: a project that cannot be saved is not exported either.
  const limits = limitErrors(project);
  if (limits.length) {
    errors.push(...limits);
    return result;
  }
  // Sizes above their warning thresholds: expected time and memory of each change.
  const large = sizeWarning(project);
  if (large) warnings.push(large);
  if (!(sections[0].y >= 0)) {
    errors.push(`Section at y = ${sections[0].y} mm lies on the mirrored side; the half wing spans y >= 0.`);
    return result;
  }
  for (let i = 1; i < sections.length; i++) {
    if (!(sections[i].y > sections[i - 1].y)) {
      errors.push(`Sections ${i} and ${i + 1} share span position y = ${sections[i].y} mm.`);
      return result;
    }
  }

  const N = Math.round(Math.min(Math.max(settings.chordSamples, LIMITS.chordSamples[0]), LIMITS.chordSamples[1]));
  const chordStations = cosineStations(N);
  const airfoils = new Map(project.airfoils.map((a) => [a.id, a]));
  for (const s of sections) {
    if (result.profiles.has(s.airfoil)) continue;
    const a = airfoils.get(s.airfoil);
    if (!a) {
      errors.push(`Section at y = ${s.y} mm uses unknown airfoil "${s.airfoil}".`);
      continue;
    }
    const stage = profileStage(a, settings.parametrization, chordStations, N);
    // Uniform and chord-length parametrization follow unevenly spaced points less closely.
    const hint = settings.parametrization === 'centripetal' ? '' : ' Settings > Profile parametrization "centripetal" follows the points more closely.';
    if (stage.error) {
      errors.push(`Airfoil "${displayName(a.name ?? a.id)}": ${stage.error}${hint}`);
      continue;
    }
    // The crossing tolerance of the profile stage is a fraction of the chord; above 200 mm chord
    // the loop is measured against CROSSING_LIMIT mm at the largest chord using this airfoil.
    const chordMax = Math.max(...sections.filter((q) => q.airfoil === s.airfoil).map((q) => q.chord));
    const cross = CROSSING_TOLERANCE * chordMax > CROSSING_LIMIT ? stageCrossing(stage, CROSSING_LIMIT / chordMax) : null;
    if (cross) {
      errors.push(
        `Airfoil "${displayName(a.name ?? a.id)}": the NURBS curve through the points crosses itself near x = ${(cross.x * 100).toFixed(1)} % chord; ` +
          `the loop is ${(cross.size * chordMax).toFixed(2)} mm wide at ${chordMax} mm chord, above ${CROSSING_LIMIT} mm. ` +
          `Use a file with more points or finer spacing near that position.${hint}`,
      );
      continue;
    }
    result.profiles.set(s.airfoil, { ...stage.prof, id: a.id, name: a.name, points: stage.points, compat: stage.compat.get(N) });
  }
  // Every entry this build used is at the recent end; older ones go beyond the larger of
  // PROFILE_CACHE_SIZE and the number of airfoils the sections use.
  const keep = Math.max(PROFILE_CACHE_SIZE, new Set(sections.map((s) => s.airfoil)).size);
  while (PROFILE_CACHE.size > keep) PROFILE_CACHE.delete(PROFILE_CACHE.keys().next().value);
  if (errors.length) return result;

  // Guides.
  const guideOn = {};
  for (const key of ['nose', 'end']) {
    const g = project.guides?.[key];
    if (!g || !g.enabled) continue;
    const problems = guideProblems(g);
    if (problems.length) {
      errors.push(`${key === 'nose' ? 'Nose line' : 'End line'}: ${problems.join(' ')}`);
      continue;
    }
    const curve = guideCurve(g);
    if (!isMonotonicInY(curve)) {
      errors.push(`${key === 'nose' ? 'Nose line' : 'End line'}: the curve doubles back in span direction; move the points apart or use control-point mode.`);
      continue;
    }
    // A B-spline lies within the hull of its control points: control points within the geometry
    // extent bound the whole curve. Through-point guides over unevenly spaced points overshoot.
    const far = Math.max(...curve.points.map((q) => Math.abs(q[0])));
    if (!(far <= LIMITS.maxExtent)) {
      errors.push(
        `${key === 'nose' ? 'Nose line' : 'End line'}: the curve through the points reaches x = ${far.toExponential(2)} mm, beyond ±${LIMITS.maxExtent} mm; ` +
          'space the points more evenly in y or use control-point mode.',
      );
      continue;
    }
    result.guides[key] = curve;
    guideOn[key] = true;
  }
  if (errors.length) return result;

  const ys = sections.map((s) => s.y);
  const y0 = ys[0];
  const y1 = ys[ys.length - 1];
  const dense = guideOn.nose || guideOn.end || settings.spanwise === 'smooth';
  // Grid: stations times profile points (2N + 1). Above LIMITS.maxGridPoints, where a desktop
  // browser tab runs out of memory, fewer stations per panel; one station per panel at least.
  const grid = loftGrid(sections.length, settings, guideOn.nose || guideOn.end);
  const K = grid.K;
  const maxGrid = LIMITS.maxGridPoints.toLocaleString('en');
  if (grid.points > LIMITS.maxGridPoints) {
    errors.push(
      `The loft grid needs ${grid.points.toLocaleString('en')} points with one station per panel (${sections.length.toLocaleString('en')} sections, ${N} chord samples); the limit is ${maxGrid}. Reduce the chord samples or the sections.`,
    );
    return result;
  }
  if (K < grid.Kset) {
    warnings.push(`Spanwise stations per panel reduced from ${grid.Kset} to ${K}: ${sections.length.toLocaleString('en')} sections with ${N} chord samples keep the loft within ${maxGrid} grid points.`);
  }

  // Intermediate stations cluster towards the panel ends (cosine spacing), where guide curves
  // and pointed tips change fastest.
  const stationYs = [];
  for (let i = 0; i < sections.length - 1; i++) {
    for (let k = 0; k < K; k++) stationYs.push(ys[i] + (ys[i + 1] - ys[i]) * (dense ? (1 - Math.cos((Math.PI * k) / K)) / 2 : k / K));
  }
  stationYs.push(y1);

  const compat = sections.map((s) => result.profiles.get(s.airfoil).compat);
  const blendCompat = spanwiseBlender(ys, settings.spanwise, compat);
  const vals = (k) => sections.map((s) => s[k]);
  const X = vals('x');
  const Z = vals('z');
  const C = vals('chord');
  const T = vals('twist');
  const pivot = settings.twistPivot;
  const te = settings.trailingEdge;
  const pointed = settings.tip.mode === 'pointed';
  // Trailing-edge gap as a fraction of the local chord: the thickness in mm, limited to
  // MAX_GAP_FRACTION of the chord (used by the 'thickness' mode only).
  const teGap = (chord) => Math.min(te.thickness / chord, MAX_GAP_FRACTION);
  const yPrev = ys[ys.length - 2];
  let tipChord = 0;
  // Leading-edge x, chord, z and twist of every section, blended from the two neighbouring sections
  // (O(1) per span position; a full weight vector per position made time and memory grow with the
  // square of the section count).
  const scalarBlender = () => spanwiseBlender(ys, settings.spanwise, sections.map((_, i) => [[X[i], C[i], Z[i], T[i]]]));
  let blendScalars = scalarBlender();
  const placed = new Map();
  const place = (y) => {
    const raw = blendScalars(y)[0];
    let xLE = raw[0];
    let chord = raw[1];
    const xTE = guideOn.end ? guideXAt(result.guides.end, y, y0, y1) : null;
    if (guideOn.nose) xLE = guideXAt(result.guides.nose, y, y0, y1);
    if (guideOn.nose && guideOn.end) chord = xTE - xLE;
    // Pointed tip: in the last panel the chord does not fall below the tip chord, so guide
    // curves that meet at the tip end in a scaled-down profile instead of a zero chord.
    if (pointed && y > yPrev && chord < tipChord && chord > -CROSS_TOLERANCE) chord = tipChord;
    if (guideOn.end && !guideOn.nose) xLE = xTE - chord;
    return { raw, xLE, chord, z: raw[2], twist: raw[3] };
  };
  const placement = (y) => {
    let out = placed.get(y);
    if (!out) placed.set(y, (out = place(y)));
    return out;
  };
  if (pointed) {
    // The tip profile is scaled to tip.ratio of the chord at the previous section, at least minChord.
    const scaled = settings.tip.ratio * placement(yPrev).chord;
    tipChord = Math.max(scaled, LIMITS.minChord);
    result.tipChordLimited = scaled < LIMITS.minChord;
    C[C.length - 1] = tipChord;
    blendScalars = scalarBlender();
    placed.clear();
  }
  // Actual tip chord: with both guides on, the guides set it, and a gap wider than the scaled tip
  // chord leaves a blunt tip.
  result.tipChord = pointed ? placement(y1).chord : null;
  if (pointed && result.tipChord > tipChord + PLANFORM_TOLERANCE) {
    warnings.push(
      `Pointed tip: nose line and end line end ${result.tipChord.toFixed(1)} mm apart, so the tip chord is ${result.tipChord.toFixed(1)} mm ` +
        `instead of ${tipChord.toFixed(2)} mm; move their last points together to close the tip.`,
    );
    result.tipChordLimited = false;
  }

  // Chord check on a dense span sampling plus every guide breakpoint (control points and knots),
  // so a crossing between two loft stations is reported too.
  const guideBreaks = new Set();
  for (const key of ['nose', 'end']) {
    const c = result.guides[key];
    if (!c) continue;
    const gy0 = c.points[0][1];
    const gy1 = c.points[c.points.length - 1][1];
    const toWing = (gy) => y0 + ((gy - gy0) / (gy1 - gy0)) * (y1 - y0);
    for (const P of c.points) guideBreaks.add(toWing(P[1]));
    for (const u of c.knots) guideBreaks.add(toWing(curvePoint(c, u)[1]));
  }
  const checkYs = new Set([...stationYs, ...guideBreaks]);
  for (let k = 0; k <= CHORD_CHECK_SAMPLES; k++) checkYs.add(y0 + ((y1 - y0) * k) / CHORD_CHECK_SAMPLES);
  let minChord = Infinity;
  let minChordY = y0;
  let minThick = Infinity;
  let minThickY = y0;
  let minThickX = 0;
  let minTeThick = Infinity;
  let minTeThickY = y0;
  let minTeCore = Infinity;
  let minTeCoreY = y0;
  let minTeCoreX = 0;
  // Thinnest point of a resampled shape; `core` covers chord stations from 1 % to 99 %, where
  // thickness at or below the airfoil contact tolerance means the surfaces touch. Past 99 % chord a
  // station can lie in a trailing-edge sliver that the curve crossing check tolerates: crossings
  // there up to `sliver` (teSliver of the chord) count as zero thickness.
  const thinnest = (shape, sliver) => {
    let t = Infinity;
    let tX = 0;
    let core = Infinity;
    let coreX = 0;
    for (let k = 1; k < N; k++) {
      const d = shape[N - k][1] - shape[N + k][1];
      const x = chordStations[k];
      const dt = x > 0.99 && d < 0 ? Math.min(0, d + sliver) : d;
      if (dt < t) {
        t = dt;
        tX = x;
      }
      if (x >= 0.01 && x <= 0.99 && d < core) {
        core = d;
        coreX = x;
      }
    }
    return { t, tX, core, coreX };
  };
  // Smooth mode: interpolated section values must stay within OVERSHOOT_LIMIT ranges of the section
  // values (only the values the build uses: guide curves replace leading-edge x and chord).
  const smooth = settings.spanwise === 'smooth';
  const range = (values) => [Math.min(...values), Math.max(...values)];
  const overshootChecks = [];
  // k: index of the value in the blended placement scalars [leading-edge x, chord, z, twist].
  if (!guideOn.nose && !guideOn.end) overshootChecks.push({ name: 'leading-edge x', unit: 'mm', k: 0, range: range(X) });
  if (!(guideOn.nose && guideOn.end)) overshootChecks.push({ name: 'chord', unit: 'mm', k: 1, range: range(C) });
  overshootChecks.push({ name: 'z', unit: 'mm', k: 2, range: range(Z) }, { name: 'twist', unit: '°', k: 3, range: range(T) });
  const profileRanges = smooth ? compat[0].map((_, k) => range(compat.map((c) => c[k][1]))) : [];
  const profileNames = compat[0].map((_, k) => `${k < N ? 'upper' : 'lower'} surface height at x = ${(chordStations[Math.abs(k - N)] * 100).toFixed(1)} % chord`);
  let overshoot = null;
  const record = (name, unit, value, [lo, hi], y) => {
    const out = Math.max(lo - value, value - hi);
    const ratio = out / Math.max(hi - lo, 1e-9 * Math.max(1, Math.abs(lo), Math.abs(hi)));
    if (ratio > OVERSHOOT_LIMIT && !(overshoot && overshoot.ratio >= ratio)) overshoot = { name, unit, value, lo, hi, y, ratio };
  };
  let nonFiniteY = null;
  let farPlacement = null;
  for (const y of [...checkYs].sort((a, b) => a - b)) {
    if (!(y >= y0 && y <= y1)) continue;
    const { chord, raw, xLE, z, twist } = placement(y);
    // Placement values whose coordinates overflow (e.g. a twist of 1e308 degrees) stop the build.
    if (![xLE, chord, z, Math.cos((twist * Math.PI) / 180)].every(Number.isFinite)) {
      nonFiniteY = y;
      break;
    }
    // Interpolated values (smooth overshoot, guide curves) stay within the geometry extent and the
    // chord limit; every combination of valid sections and guides does.
    // Relative round-off of the blend (1e-9) does not count: sections at the limits blend to them.
    const ext = LIMITS.maxExtent * (1 + 1e-9);
    if (!farPlacement && (Math.abs(xLE) > ext || Math.abs(xLE + chord) > ext || Math.abs(z) > ext || chord > LIMITS.maxChord * (1 + 1e-9))) {
      farPlacement = { y, xLE, z, chord };
    }
    if (chord < minChord) {
      minChord = chord;
      minChordY = y;
    }
    // Blended profile thickness at every chord station (smooth mode can overshoot below zero), then
    // again after the trailing-edge setting, whose linear taper can pull the surfaces through each
    // other where an airfoil is thinner than its trailing-edge gap.
    const shape = blendCompat(y);
    if (smooth) {
      for (const q of overshootChecks) record(q.name, q.unit, raw[q.k], q.range, y);
      for (let k = 1; k < 2 * N; k++) record(profileNames[k], '% chord', shape[k][1], profileRanges[k], y);
    }
    // Round-off level differences do not move the reported position.
    const { t, tX } = thinnest(shape, teSliver(chord));
    if (t < minThick - 1e-12) {
      minThick = t;
      minThickY = y;
      minThickX = tX;
    }
    if (chord >= LIMITS.minChord) {
      const { t: tTe, core, coreX } = thinnest(applyTrailingEdge(shape, te.mode, teGap(chord), N), teSliver(chord));
      if (tTe < minTeThick - 1e-12) {
        minTeThick = tTe;
        minTeThickY = y;
      }
      if (core < minTeCore - 1e-12) {
        minTeCore = core;
        minTeCoreY = y;
        minTeCoreX = coreX;
      }
    }
  }
  if (nonFiniteY !== null) {
    errors.push(`Section values give non-finite coordinates at y = ${nonFiniteY.toFixed(1)} mm; check the positions, chords and twists of the sections.`);
    return result;
  }
  if (farPlacement) {
    const { y, xLE, z, chord } = farPlacement;
    errors.push(
      `At y = ${y.toFixed(1)} mm the wing leaves the project limits (leading-edge x ${xLE.toFixed(0)} mm, z ${z.toFixed(0)} mm, chord ${chord.toFixed(0)} mm; ` +
        `limits ±${LIMITS.maxExtent} mm and ${LIMITS.maxChord} mm chord). Check the guide curves, or use linear interpolation.`,
    );
    return result;
  }
  if (overshoot) {
    const f = (v) => (overshoot.unit === '% chord' ? (v * 100).toFixed(2) : v.toFixed(2));
    let gap = Infinity;
    for (let i = 0; i + 1 < ys.length; i++) gap = Math.min(gap, ys[i + 1] - ys[i]);
    errors.push(
      `Smooth spanwise interpolation overshoots at y = ${overshoot.y.toFixed(1)} mm: ${overshoot.name} is ${f(overshoot.value)} ${overshoot.unit}, ` +
        `while the sections range from ${f(overshoot.lo)} to ${f(overshoot.hi)} ${overshoot.unit}. The sections are unevenly spaced (smallest gap ${gap.toFixed(2)} mm). ` +
        'Use linear interpolation, space the sections more evenly or remove sections that lie close together.',
    );
    return result;
  }
  if (minThick < -1e-9) {
    const where = `at y = ${minThickY.toFixed(1)} mm, x = ${(minThickX * 100).toFixed(1)} % chord (${(minThick * 100).toFixed(3)} % chord)`;
    errors.push(
      smooth
        ? `The blended profile has negative thickness ${where}; smooth spanwise interpolation overshoots between unevenly spaced sections. Use linear interpolation or add sections.`
        : `The resampled profile has negative thickness ${where}: upper and lower surface of a section airfoil cross there. Check the airfoils near that position or raise Settings > Chord samples.`,
    );
    return result;
  }
  if (minTeThick < -1e-9) {
    errors.push(
      `The trailing-edge setting pulls the upper surface below the lower surface at y = ${minTeThickY.toFixed(1)} mm ` +
        `(${(minTeThick * 100).toFixed(2)} % chord); the airfoil is thinner inside than its trailing-edge gap. ` +
        'Use "as in file" or a larger trailing-edge thickness.',
    );
    return result;
  }
  if (minTeCore <= AIRFOIL_LIMITS.touchThickness) {
    const where = `at y = ${minTeCoreY.toFixed(1)} mm, x = ${(minTeCoreX * 100).toFixed(1)} % chord (thickness ${(minTeCore * 100).toFixed(4)} % chord)`;
    errors.push(
      te.mode === 'asis'
        ? `Upper and lower surface of the blended profile touch ${where}; the wing would have zero thickness there. Use linear interpolation or add sections.`
        : `The trailing-edge setting makes upper and lower surface touch ${where}; the wing would have zero thickness there. Use "as in file" or a larger trailing-edge thickness.`,
    );
    return result;
  }
  if (minChord < LIMITS.minChord) {
    const hint = !pointed && minChordY === y1 && minChord > -CROSS_TOLERANCE ? ' For a tip that ends in a point, set Settings > Wing tip to Pointed.' : '';
    errors.push(`Chord drops to ${minChord.toFixed(2)} mm at y = ${minChordY.toFixed(1)} mm; nose line and end line must not touch or cross.${hint}`);
    return result;
  }

  const degreeV = dense ? 3 : 1;
  const gapMm = (shape, chord) => (shape[0][1] - shape[shape.length - 1][1]) * chord;
  // Final station shape: blended profile with the trailing-edge setting, closed when every station
  // is closed, otherwise opened to at least MIN_OPEN_GAP. Both steps move each point on its own, so
  // they apply to a subset of the points as well (le: index of the leading edge in `shape`).
  const finalShape = (shape, chord, closedTE, le = N) => {
    if (closedTE) return applyTrailingEdge(shape, 'closed', 0, le);
    if (gapMm(shape, chord) < Math.min(MIN_OPEN_GAP, MAX_GAP_FRACTION * chord)) return setTrailingEdgeGap(shape, Math.min(MIN_OPEN_GAP / chord, MAX_GAP_FRACTION), { leIndex: le });
    return shape;
  };

  // Deviation: the loft passes through the stations only. Compare the fitted surface at span
  // positions yList with the intended placed profile (leading edge, trailing edge and every
  // floor(N / 6)-th chord station per surface: 5 at N = 60), in 3D: twist moves points in z and a global cubic fit over unevenly
  // spaced stations can swing far from the data. fitChord: chord of the fitted surface along the
  // intended chord direction (linear rows between strongly twisted stations shrink it, fast guide
  // changes fold it). fitThick: local thickness of the fitted surface at the probed chord stations.
  const stepK = Math.max(1, Math.floor(N / 6));
  const probeK = [];
  for (let k = stepK; k < N; k += stepK) probeK.push(k);
  // Probed points only, in profile order (upper trailing edge, upper surface, leading edge, lower
  // surface, lower trailing edge); pos: [leading edge, upper trailing edge, (upper, lower) per
  // probed chord station] in that subset, idx: the same points in the full profile.
  const sub = [0, ...probeK.slice().reverse().map((k) => N - k), N, ...probeK.map((k) => N + k), 2 * N];
  const leSub = probeK.length + 1;
  const subCompat = compat.map((c) => sub.map((i) => c[i]));
  const blendSub = spanwiseBlender(ys, settings.spanwise, subCompat);
  const pos = [leSub, 0, ...probeK.flatMap((_, q) => [leSub - 1 - q, leSub + 1 + q])];
  const idx = pos.map((j) => sub[j]);
  const probe = (yList, surface, paramsU, closedTE) => {
    const devs = [];
    let minFit = Infinity;
    let minFitY = y0;
    let fitThick = Infinity;
    let fitThickY = y0;
    let fitCore = Infinity;
    let fitCoreY = y0;
    const d3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    for (const y of yList) {
      if (!(y >= y0 && y <= y1) || !(y1 > y0)) continue;
      const pl = placement(y);
      const v = (y - y0) / (y1 - y0);
      const shape = finalShape(applyTrailingEdge(blendSub(y), te.mode, teGap(pl.chord), leSub), pl.chord, closedTE, leSub);
      const intended = placeSection([...pos.map((j) => shape[j]), [1, 0]], { ...pl, y }, pivot);
      const axis = intended[idx.length];
      const fitted = idx.map((i) => surfacePoint(surface, paramsU[i], v));
      let d = 0;
      for (let q = 0; q < idx.length; q++) d = Math.max(d, d3(fitted[q], intended[q]));
      devs.push([y, d, deviationTolerance(pl.chord)]);
      const le = intended[0];
      const dir = [axis[0] - le[0], axis[2] - le[2]];
      const len = Math.hypot(dir[0], dir[1]) || 1;
      const sTEl = surfacePoint(surface, 1, v);
      const fitChord = (((fitted[1][0] + sTEl[0]) / 2 - fitted[0][0]) * dir[0] + ((fitted[1][2] + sTEl[2]) / 2 - fitted[0][2]) * dir[1]) / len;
      if (fitChord < minFit) {
        minFit = fitChord;
        minFitY = y;
      }
      // Local frame: undo translation, chord scale and twist (inverse of placeSection).
      const a = (pl.twist * Math.PI) / 180;
      const c = Math.cos(a);
      const sn = Math.sin(a);
      const localZ = (P) => {
        const rx = (P[0] - pl.xLE) / pl.chord - pivot;
        const rz = (P[2] - pl.z) / pl.chord;
        return sn * rx + c * rz;
      };
      const sliver = teSliver(pl.chord);
      for (let q = 0; q < probeK.length; q++) {
        const x = chordStations[probeK[q]];
        const d = localZ(fitted[2 + 2 * q]) - localZ(fitted[3 + 2 * q]);
        const t = x > 0.99 && d < 0 ? Math.min(0, d + sliver) : d;
        if (t < fitThick) {
          fitThick = t;
          fitThickY = y;
        }
        if (x >= 0.01 && x <= 0.99 && t < fitCore) {
          fitCore = t;
          fitCoreY = y;
        }
      }
    }
    devs.sort((a, b) => a[0] - b[0]);
    return { devs, minFit, minFitY, fitThick, fitThickY, fitCore, fitCoreY };
  };

  /** Stations, surface and the probes at the check positions for a sorted list of station span positions. */
  const fit = (yList) => {
    const stations = [];
    // Trailing-edge thickness in mm, limited to MAX_GAP_FRACTION of the local chord.
    let limited = 0;
    for (const y of yList) {
      const { xLE, chord, z, twist } = placement(y);
      if (te.mode === 'thickness' && te.thickness / chord > MAX_GAP_FRACTION && !(pointed && y > yPrev)) limited++;
      const shape = applyTrailingEdge(blendCompat(y), te.mode, teGap(chord), N);
      stations.push({ xLE, y, z, chord, twist, v: y1 > y0 ? (y - y0) / (y1 - y0) : 0, shape });
    }
    // Trailing-edge topology: closed when every station is closed, otherwise open with a minimum gap.
    const closedTE = stations.every((st) => Math.abs(gapMm(st.shape, st.chord)) < 1e-6);
    let widened = 0;
    for (const st of stations) {
      const shape = finalShape(st.shape, st.chord, closedTE);
      if (!closedTE && shape !== st.shape) widened++;
      st.shape = shape;
      st.points = placeSection(st.shape, st, pivot);
    }

    // u parameters: average of per-station parametrizations (A9.4, eq. 9.10).
    const rows = stations.map((st) => st.points);
    const M = rows[0].length;
    const paramsU = new Array(M).fill(0);
    for (const row of rows) {
      const t = parametrize(row, settings.parametrization);
      for (let j = 0; j < M; j++) paramsU[j] += t[j] / rows.length;
    }
    paramsU[0] = 0;
    paramsU[M - 1] = 1;
    const degU = 3;
    const knotsU = averagingKnots(paramsU, degU);
    const luU = collocationFactor(paramsU, degU, knotsU);
    const rowCtrl = rows.map((row) => {
      const out = row.map(() => [0, 0, 0]);
      for (let c = 0; c < 3; c++) {
        const x = collocationSolve(
          luU,
          row.map((q) => q[c]),
        );
        for (let j = 0; j < M; j++) out[j][c] = x[j];
      }
      return out;
    });

    const paramsV = stations.map((st) => st.v);
    const panelIdx = [];
    for (let i = 0; i < ys.length - 1; i++) panelIdx.push([yList.indexOf(ys[i]), yList.indexOf(ys[i + 1])]);
    const scheme =
      settings.spanwise === 'smooth'
        ? { kind: 'global', params: paramsV, degree: degreeV }
        : { kind: 'panels', params: paramsV, panels: panelIdx, degree: degreeV };
    const along = interpolateAlongV(rowCtrl, scheme);
    // Root and tip boundaries lie exactly in their planes y = const (removes solver round-off).
    const ctrl = along.columns;
    const last = ctrl[0].length - 1;
    for (const col of ctrl) {
      col[0][1] = y0;
      col[last][1] = y1;
    }
    const surface = { degreeU: degU, degreeV: along.degree, knotsU, knotsV: along.knots, points: ctrl };

    return { stations, surface, paramsU, paramsV, closedTE, limited, widened, ...probe(checkYs, surface, paramsU, closedTE) };
  };

  // Adaptive stations: insert stations where the loft deviates more than PLANFORM_TOLERANCE from
  // the intended surface (fast planform changes such as pointed elliptic tips), up to
  // MAX_EXTRA_STATIONS in at most 6 rounds.
  let yList = stationYs.slice();
  let fitted = fit(yList);
  let extra = 0;
  for (let round = 0; round < 6 && extra < MAX_EXTRA_STATIONS; round++) {
    const peaks = fitted.devs.filter(([, d, tol], i, arr) => d > tol && d >= (arr[i - 1]?.[1] ?? 0) && d >= (arr[i + 1]?.[1] ?? 0));
    // New stations keep 1e-6 of the span from every other station: equal or nearly equal
    // positions make the interpolation singular.
    const minGap = 1e-6 * (y1 - y0);
    const fresh = [];
    for (const [y] of peaks) {
      if (fresh.length >= MAX_EXTRA_STATIONS - extra) break;
      if (![...yList, ...fresh].some((q) => Math.abs(q - y) < minGap)) fresh.push(y);
    }
    if (!fresh.length) break;
    yList = [...yList, ...fresh].sort((a, b) => a - b);
    extra += fresh.length;
    fitted = fit(yList);
  }
  const { stations, surface, paramsU, paramsV, closedTE, limited, widened, devs } = fitted;
  result.stations = stations;
  // Quarter points of every fitted station interval: between closely spaced stations the global
  // cubic interpolation can swing far away while every check position lies close to a station.
  // They enter the chord, thickness and contact errors; the deviation warning and the added
  // stations stay on the check positions (near a pointed elliptic tip the loft deviates 0.3 to
  // 0.8 mm between stations, more than 10 % of the 1 to 3 mm chord there).
  const inner = [];
  for (let i = 0; i + 1 < yList.length; i++) for (const f of [0.25, 0.5, 0.75]) inner.push(yList[i] + f * (yList[i + 1] - yList[i]));
  const between = probe(inner, surface, paramsU, closedTE);
  const lower = (key) => (between[key] < fitted[key] ? between : fitted);
  const { minFit, minFitY } = lower('minFit');
  const { fitThick, fitThickY } = lower('fitThick');
  const { fitCore, fitCoreY } = lower('fitCore');
  if (!surface.points.every((col) => col.every((P) => P.every(Number.isFinite)))) {
    errors.push('The fitted surface has non-finite coordinates; check the positions, chords and twists of the sections.');
    return result;
  }
  if (fitThick < -1e-9 || fitCore <= AIRFOIL_LIMITS.touchThickness) {
    const neg = fitThick < -1e-9;
    errors.push(
      `The fitted surface ${neg ? 'turns inside out' : 'has zero thickness'} between stations at y = ${(neg ? fitThickY : fitCoreY).toFixed(1)} mm ` +
        `(local thickness ${((neg ? fitThick : fitCore) * 100).toFixed(3)} % chord): the surface through the stations swings between them ` +
        '(guide curves that change fast, or unevenly spaced sections in smooth mode). Smooth the guide curves, space the sections more evenly or add sections.',
    );
    return result;
  }
  if (minFit < FOLD_LIMIT) {
    errors.push(
      `The fitted surface folds or narrows between stations at y = ${minFitY.toFixed(1)} mm (chord ${minFit.toFixed(2)} mm along the intended chord direction, ` +
        `minimum ${LIMITS.minChord} mm): twist or guide curves change faster than ${MAX_EXTRA_STATIONS} added stations resolve. Add sections, reduce the twist difference or smooth the guide curves.`,
    );
    return result;
  }
  // Surface rows (planes y = const) at the sections, halfway between them and halfway between the
  // fitted stations: a cubic row can overshoot between the resampled points and cross, which the
  // point checks above do not see.
  const rowSet = new Set();
  for (let i = 0; i < ys.length; i++) {
    rowSet.add(ys[i]);
    if (i + 1 < ys.length) rowSet.add((ys[i] + ys[i + 1]) / 2);
  }
  // Station intervals: the widest MAX_STATION_ROWS, where a row has the most room to swing.
  const gaps = [];
  for (let i = 0; i + 1 < yList.length; i++) gaps.push([yList[i + 1] - yList[i], (yList[i] + yList[i + 1]) / 2]);
  gaps.sort((a, b) => b[0] - a[0]);
  for (const [, y] of gaps.slice(0, MAX_STATION_ROWS)) rowSet.add(y);
  const rowY = [...rowSet].sort((a, b) => a - b);
  const rowV = rowY.map((y) => (y1 > y0 ? (y - y0) / (y1 - y0) : 0));
  const chordAtV = (v) => placement(y0 + v * (y1 - y0)).chord;
  for (const v of rowV) {
    const cross = surfaceRowCrossing(surface, v, Math.min(CROSSING_TOLERANCE * chordAtV(v), CROSSING_LIMIT));
    if (cross) {
      errors.push(
        `The loft surface crosses itself at y = ${(y0 + v * (y1 - y0)).toFixed(1)} mm near x = ${cross.x.toFixed(1)} mm: ` +
          'the surface rows overshoot between the resampled points. Increase Settings > Chord samples.',
      );
      return result;
    }
  }
  result.surface = surface;
  result.extraStations = extra;
  if (limited) {
    warnings.push(`Trailing-edge thickness ${te.thickness} mm exceeds ${MAX_GAP_FRACTION * 100} % of the chord at ${limited} station(s); it is limited to ${MAX_GAP_FRACTION * 100} % there.`);
  }
  if (widened) {
    warnings.push(`The trailing edge is closed on some stations and open on others; ${widened} station(s) were opened to ${MIN_OPEN_GAP} mm.`);
  }
  let dev = 0;
  let devY = y0;
  let over = false;
  for (const [y, d, tol] of devs) {
    if (d > dev) {
      dev = d;
      devY = y;
    }
    if (d > tol) over = true;
  }
  result.planformDeviation = dev;
  if (over) {
    warnings.push(
      `The loft deviates up to ${dev.toFixed(2)} mm from the intended surface at y = ${devY.toFixed(1)} mm ` +
        `after ${extra} added station(s); raise the spanwise stations per panel.`,
    );
  }
  result.paramsU = paramsU;
  result.paramsV = paramsV;
  result.uLE = paramsU[N];
  result.leIndex = N;
  result.closedTE = closedTE;
  result.rootY = y0;
  result.tipY = y1;
  // Intended planform (leading edge and chord) at any span position, for the statistics, and the
  // span positions where it can bend: sections and guide breakpoints. The placement cache is
  // released; the planform is evaluated without it.
  placed.clear();
  result.planformAt = (y) => {
    const q = place(Math.min(Math.max(y, y0), y1));
    return { xLE: q.xLE, chord: q.chord };
  };
  result.planformBreaks = [...new Set([...ys, ...guideBreaks])].filter((y) => y > y0 && y < y1).sort((a, b) => a - b);
  return result;
}
