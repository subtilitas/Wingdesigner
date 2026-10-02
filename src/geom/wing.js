// Half-wing construction: NURBS profiles -> compatible sections -> spanwise stations
// (sections, spanwise interpolation, optional guide curves) -> tensor-product NURBS surface.
// Straight panels (spanwise 'straight') have stations at the sections only: the degree-1 loft joins
// the points of equal chord fraction of two sections with straight lines, as XFLR5 does.
// Section planes (src/geom/planes.js): vertical (y = const), or mitred, rolled about x with the
// airfoil thickness stretched; stations between two mitred sections blend the roll linearly.
//
// Surface parametrization: u runs around the profile from the upper trailing edge (u = 0) over the
// leading edge (u = uLE) to the lower trailing edge (u = 1); v is the span fraction (0 root, 1 tip).

import { LIMITS as AIRFOIL_LIMITS, checkAirfoil } from '../airfoil/sanity.js';
import { setTrailingEdgeGap } from '../airfoil/geometry.js';
import { averagingKnots, basisFuns, collocationFactor, collocationSolve, curvePoint, findSpan, interpolateCurve, parametrize, paramsApart, secantEndInterpolation, surfacePoint } from './nurbs.js';
import { CROSSING_LIMIT, CROSSING_TOLERANCE, cosineStations, curveCrossing, profileCurve, profileProblem, resampleProfile, sampleCurve } from './profile.js';
import { spanwiseBlender } from './spanwise.js';
import { guideCurve, guideProblems, guideXAt, isMonotonicInY } from './guide.js';
import { MAX_STRETCH, firstFold, mitredPlanes, overStretched, sectionPlanes, stretchOf, upExtent } from './planes.js';
import { LIMITS, limitErrors, resolveSettings } from '../model/project.js';
import { partTransform } from './part.js';
import { WARN, displayName, loftGrid, sizeWarning } from '../model/budget.js';
import { count, fixed, language, plain, tr, whole } from '../i18n/index.js';

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
// Chord minimum with the relative round-off of the blends: equal 1 mm sections blend to
// 0.9999999999999999 mm, and guide curves through them to 1 mm less a few units in the last place.
const MIN_CHORD = LIMITS.minChord * (1 - 1e-9);

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

/**
 * Place normalized profile points into 3D. The section plane is rolled by `roll` degrees about the x
 * axis through (y, z) (in-plane up direction (0, −sin roll, cos roll)); `stretch` scales the airfoil
 * thickness before the twist, which turns the airfoil within its plane.
 */
export function placeSection(shape, { xLE, y, z, chord, twist, roll = 0, stretch = 1 }, pivot) {
  const a = (twist * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const sr = Math.sin((roll * Math.PI) / 180);
  const cr = Math.cos((roll * Math.PI) / 180);
  return shape.map(([px, pz0]) => {
    const pz = pz0 * stretch;
    const dx = px - pivot;
    const rx = dx * c + pz * s;
    const rz = -dx * s + pz * c;
    return [xLE + chord * (pivot + rx), y - chord * rz * sr, z + chord * rz * cr];
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
 * Interpolate columns of control points along v, panel by panel: every panel (stations a to b) gets
 * its own interpolating curve, and the curves join with C0 continuity at the sections.
 * scheme: { kind: 'panels', params, panels: [[a, b], ...], degree }
 * values: array over stations of equally sized point arrays.
 * Returns { degree, knots, points: [station-independent index][i] }.
 */
export function interpolateAlongV(values, scheme) {
  const nCols = values[0].length;
  const cols = [];
  // One degree for every panel (joinCurves needs it): the fewest stations of a panel with more
  // than two bound it. A panel of two stations is a straight segment at any degree.
  const q = scheme.panels.reduce((m, [a, b]) => (b - a > 1 ? Math.min(m, b - a) : m), scheme.degree);
  const d = scheme.panels.some(([a, b]) => b - a > 1) ? q : 1;
  for (let i = 0; i < nCols; i++) {
    const series = values.map((row) => row[i]);
    const parts = scheme.panels.map(([a, b]) => {
      const f0 = scheme.params[a];
      const f1 = scheme.params[b];
      // Two stations: the interpolating curve is the straight segment through them (degree 1,
      // knots 0, 0, 1, 1), as interpolateCurve returns it, without the solve; raised to degree d
      // with its control points evenly along the segment.
      if (b - a === 1) {
        if (d === 1) return { degree: 1, knots: [0, 0, 1, 1].map((t) => f0 + t * (f1 - f0)), points: [series[a].slice(), series[b].slice()] };
        const P = Array.from({ length: d + 1 }, (_, k) => series[a].map((c, m) => c + (k / d) * (series[b][m] - c)));
        P[d] = series[b].slice();
        return { degree: d, knots: [...Array(d + 1).fill(f0), ...Array(d + 1).fill(f1)], points: P };
      }
      const local = scheme.params.slice(a, b + 1).map((f) => (f - f0) / (f1 - f0));
      const c = interpolateCurve(series.slice(a, b + 1), d, { params: local });
      return { degree: c.degree, knots: c.knots.map((t) => f0 + t * (f1 - f0)), points: c.points };
    });
    cols.push(joinCurves(parts));
  }
  return { degree: cols[0].degree, knots: cols[0].knots, columns: cols.map((c) => c.points) };
}

/**
 * Spanwise blend of resampled profiles (point lists of 2L + 1 points, leading edge at L; point L - k
 * of the upper surface and point L + k of the lower surface share a chord station). 'smooth' blends
 * the mean (P_(L-k) + P_(L+k)) / 2 and the difference P_(L-k) - P_(L+k) of every chord station: the
 * shape-preserving blend keeps both, and with them the thickness, between the values of the two
 * sections of the panel. 'linear' blends the points (the same result in both forms).
 */
function profileBlender(ys, mode, lists) {
  if (mode !== 'smooth') return spanwiseBlender(ys, mode, lists);
  const L = (lists[0].length - 1) / 2;
  const split = (P) =>
    P.map((p, i) => {
      if (i === L) return p.slice();
      const o = P[2 * L - i];
      return i < L ? [(p[0] + o[0]) / 2, (p[1] + o[1]) / 2] : [o[0] - p[0], o[1] - p[1]];
    });
  const blend = spanwiseBlender(ys, mode, lists.map(split));
  return (y) => {
    const B = blend(y);
    return B.map((p, i) => {
      if (i === L) return p;
      const [mean, diff] = i < L ? [p, B[2 * L - i]] : [B[2 * L - i], p];
      const sign = i < L ? 0.5 : -0.5;
      return [mean[0] + sign * diff[0], mean[1] + sign * diff[1]];
    });
  };
}

// Profile stage per airfoil (checks, NURBS curve, crossing test), keyed by the parametrization and a
// hash of the points; resampled shapes are kept per chord-sample count N. Airfoils rarely change
// between edits. A hit is confirmed by comparing the points, so a hash collision only costs a miss.
// Only an entry with an error holds text; it records its language (lang) and is made again after a
// language change, while the entries of good airfoils stay valid and a switch does not refit them.
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
  PROFILE_CACHE.delete(key);
  if (!(entry && samePoints(entry.source, a.points) && !(entry.error && entry.lang !== language()))) {
    entry = { source: a.points.map((p) => [p[0], p[1]]), compat: new Map(), lang: language() };
    const check = checkAirfoil(a.points);
    if (!check.ok) {
      entry.error = check.issues.filter((i) => i.severity === 'error').map((i) => i.message).join(' ');
    } else {
      try {
        const prof = profileCurve(check.points, { parametrization });
        // The samples serve the crossing test at the chord of the build too (stageCrossing), then
        // go: kept for every airfoil they would take 64 KB each.
        const samples = sampleCurve(prof.curve);
        const problem = profileProblem(prof, samples);
        if (problem) entry.error = problem;
        else Object.assign(entry, { prof, points: check.points, samples });
      } catch (e) {
        entry.error = tr('the NURBS interpolation failed ({message}).', { message: e.message });
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
 * Drop the oldest profile stages: every entry a build used is at the recent end, and entries go
 * beyond the larger of PROFILE_CACHE_SIZE and the number of airfoils in use.
 */
function trimProfileCache(inUse) {
  const keep = Math.max(PROFILE_CACHE_SIZE, inUse);
  while (PROFILE_CACHE.size > keep) PROFILE_CACHE.delete(PROFILE_CACHE.keys().next().value);
}

/**
 * Crossing of a profile stage's fitted curve at a tolerance below CROSSING_TOLERANCE (a fraction of
 * the chord), cached on the stage per tolerance.
 */
function stageCrossing(stage, tolerance) {
  stage.crossings ??= new Map();
  if (!stage.crossings.has(tolerance)) stage.crossings.set(tolerance, curveCrossing(stage.prof.curve, { tolerance, samples: stage.samples }));
  return stage.crossings.get(tolerance);
}

/**
 * Crossing of the surface row at parameter v. Rows lie in the planes of their stations, rolled by
 * `roll` degrees about x (0: planes y = const), so the row is tested in the plane of x and the
 * in-plane up direction. Returns { x, size } in mm or null.
 */
export function surfaceRowCrossing(surface, v, tolerance, roll = 0) {
  const sr = Math.sin((roll * Math.PI) / 180);
  const cr = Math.cos((roll * Math.PI) / 180);
  // Non-rational surface: the v basis at this row is the same for every control column.
  const p = surface.degreeV;
  const span = findSpan(surface.points[0].length - 1, p, v, surface.knotsV);
  const Nb = basisFuns(span, v, p, surface.knotsV);
  const ctrl = surface.points.map((col) => {
    let x = 0;
    let z = 0;
    for (let j = 0; j <= p; j++) {
      x += Nb[j] * col[span - p + j][0];
      z += Nb[j] * (roll ? cr * col[span - p + j][2] - sr * col[span - p + j][1] : col[span - p + j][2]);
    }
    return [x, z];
  });
  return curveCrossing({ degree: surface.degreeU, knots: surface.knotsU, points: ctrl }, { tolerance, samplesPerSpan: 4 });
}

/**
 * Why mitred section planes do not build for a project with a flat tip and no guide curves, from its
 * section values and airfoils alone, without a loft (the checks of buildWing): { kind: 'stretch', i,
 * angle } for a section whose plane lies beyond MAX_STRETCH from its panel, { kind: 'fold', i, distance }
 * for neighbours i and i + 1 whose planes fold the surface between them; indices in the order of y.
 * null when the planes build, and when an airfoil fails its check (the build reports that). The XFLR5
 * import chooses its section planes by it, also where the dialog does not build. The fold inside a
 * Linear panel, where the planes turn between the sections, is left to the build: the import sets
 * Straight panels.
 */
export function mitredPlaneProblem(project) {
  const settings = resolveSettings(project.settings);
  const sections = project.sections.slice().sort((a, b) => a.y - b.y);
  const planes = sectionPlanes(sections, 'mitred');
  const over = overStretched(planes.stretches);
  if (over >= 0) return { kind: 'stretch', i: over, angle: planes.angles[over] };
  const N = Math.round(Math.min(Math.max(settings.chordSamples, LIMITS.chordSamples[0]), LIMITS.chordSamples[1]));
  const chordStations = cosineStations(N);
  const airfoils = new Map(project.airfoils.map((a) => [a.id, a]));
  const shapes = new Map();
  for (const s of sections) {
    if (shapes.has(s.airfoil)) continue;
    const a = airfoils.get(s.airfoil);
    const stage = a ? profileStage(a, settings.parametrization, chordStations, N) : null;
    if (!stage || stage.error) return null;
    // The crossing test of the build samples the curve again where it needs to.
    delete stage.samples;
    shapes.set(s.airfoil, stage.compat.get(N));
  }
  trimProfileCache(shapes.size);
  const fold = firstFold(planes.rolls, (i) => {
    const s = sections[i];
    const [low, high] = upExtent(shapes.get(s.airfoil), { chord: s.chord, twist: s.twist, stretch: planes.stretches[i] }, settings.twistPivot);
    return { y: s.y, z: s.z, roll: planes.rolls[i], low, high };
  });
  return fold && { kind: 'fold', ...fold };
}

/**
 * Build the half wing.
 * @param {object} project see src/model/project.js
 * @returns {object} build result with surface, stations, profiles, guides, errors and warnings
 */
export function buildWing(project) {
  const errors = [];
  const warnings = [];
  // Facts about the build that need no action (Checks tab).
  const infos = [];
  const settings = resolveSettings(project.settings);
  const sections = project.sections.slice().sort((a, b) => a.y - b.y);
  // sizeWarning: the size warning among the warnings (null without one), for a refresh without a build.
  const result = { settings, sections, errors, warnings, infos, sizeWarning: null, surface: null, stations: [], profiles: new Map(), guides: {} };
  if (sections.length < 2) {
    errors.push(tr('At least 2 sections are required.'));
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
  result.sizeWarning = large;
  if (!(sections[0].y >= 0)) {
    errors.push(tr('Section at y = {y} mm lies on the mirrored side; the half wing spans y >= 0.', { y: plain(sections[0].y) }));
    return result;
  }
  for (let i = 1; i < sections.length; i++) {
    if (!(sections[i].y > sections[i - 1].y)) {
      errors.push(tr('Sections {a} and {b} share span position y = {y} mm.', { a: plain(i), b: plain(i + 1), y: plain(sections[i].y) }));
      return result;
    }
  }
  // The surface parameter of a section is its span fraction v; two sections whose v values lie within
  // 4 units in the last place or within MIN_PARAM_GAP would share one knot (and STEP merges such
  // knots), so one of them is lost (paramsApart).
  const y0s = sections[0].y;
  const spanS = sections[sections.length - 1].y - y0s;
  for (let i = 1; i < sections.length; i++) {
    const a = (sections[i - 1].y - y0s) / spanS;
    const b = (sections[i].y - y0s) / spanS;
    if (!paramsApart(a, b)) {
      errors.push(
        tr('Sections {a} and {b} at y = {y1} mm and y = {y2} mm lie too close together for the surface parameters (span fractions {f1} and {f2}); move them apart.', {
          a: plain(i),
          b: plain(i + 1),
          y1: plain(sections[i - 1].y),
          y2: plain(sections[i].y),
          f1: plain(a),
          f2: plain(b),
        }),
      );
      return result;
    }
  }

  const N = Math.round(Math.min(Math.max(settings.chordSamples, LIMITS.chordSamples[0]), LIMITS.chordSamples[1]));
  const chordStations = cosineStations(N);
  const airfoils = new Map(project.airfoils.map((a) => [a.id, a]));
  const checkedAirfoils = new Set();
  // Largest chord per airfoil in one pass (a scan of all sections per airfoil took sections x airfoils).
  const chordMaxOf = new Map();
  for (const s of sections) chordMaxOf.set(s.airfoil, Math.max(chordMaxOf.get(s.airfoil) ?? 0, s.chord));
  for (const s of sections) {
    // Each airfoil is checked once, also when it fails: one message per airfoil, not per section.
    if (checkedAirfoils.has(s.airfoil)) continue;
    checkedAirfoils.add(s.airfoil);
    const a = airfoils.get(s.airfoil);
    if (!a) {
      errors.push(tr('Section at y = {y} mm uses unknown airfoil "{id}".', { y: plain(s.y), id: s.airfoil }));
      continue;
    }
    const stage = profileStage(a, settings.parametrization, chordStations, N);
    // Uniform and chord-length parametrization follow unevenly spaced points less closely.
    const hint = settings.parametrization === 'centripetal' ? '' : ` ${tr('Settings > Profile parametrization "centripetal" follows the points more closely.')}`;
    if (stage.error) {
      errors.push(tr('Airfoil "{name}": {problem}', { name: displayName(a.name ?? a.id), problem: stage.error + hint }));
      continue;
    }
    // The crossing tolerance of the profile stage is a fraction of the chord; above 200 mm chord
    // the loop is measured against CROSSING_LIMIT mm at the largest chord using this airfoil.
    const chordMax = chordMaxOf.get(s.airfoil);
    const cross = CROSSING_TOLERANCE * chordMax > CROSSING_LIMIT ? stageCrossing(stage, CROSSING_LIMIT / chordMax) : null;
    delete stage.samples;
    if (cross) {
      const problem = tr(
        'the NURBS curve through the points crosses itself near x = {x} % chord; the loop is {size} mm wide at {chord} mm chord, above {limit} mm. Use a file with more points or finer spacing near that position.',
        { x: fixed(cross.x * 100, 1), size: fixed(cross.size * chordMax, 2), chord: plain(chordMax), limit: plain(CROSSING_LIMIT) },
      );
      errors.push(tr('Airfoil "{name}": {problem}', { name: displayName(a.name ?? a.id), problem: problem + hint }));
      continue;
    }
    result.profiles.set(s.airfoil, { ...stage.prof, id: a.id, name: a.name, points: stage.points, compat: stage.compat.get(N) });
  }
  trimProfileCache(new Set(sections.map((s) => s.airfoil)).size);
  if (errors.length) return result;

  // Guides.
  const guideOn = {};
  const guideError = (key, problem) => (key === 'nose' ? tr('Nose line: {problem}', { problem }) : tr('End line: {problem}', { problem }));
  for (const key of ['nose', 'end']) {
    const g = project.guides?.[key];
    if (!g || !g.enabled) continue;
    const problems = guideProblems(g);
    if (problems.length) {
      errors.push(guideError(key, problems.join(' ')));
      continue;
    }
    let curve;
    try {
      curve = guideCurve(g);
    } catch (e) {
      // Points closer than the solver resolves (normalized y gaps near 1e-300) make the
      // interpolation singular.
      if (!/zero pivot/.test(e.message)) throw e;
      errors.push(guideError(key, tr('the curve fit is singular; move the points further apart in y or use control-point mode.')));
      continue;
    }
    if (!isMonotonicInY(curve)) {
      errors.push(guideError(key, tr('the curve doubles back in span direction; move the points apart or use control-point mode.')));
      continue;
    }
    // A B-spline lies within the hull of its control points: control points within the geometry
    // extent bound the whole curve. Through-point guides over unevenly spaced points overshoot.
    const far = Math.max(...curve.points.map((q) => Math.abs(q[0])));
    if (!(far <= LIMITS.maxExtent)) {
      errors.push(
        guideError(
          key,
          tr('the curve through the points reaches x = {x} mm, beyond ±{limit} mm; space the points more evenly in y or use control-point mode.', {
            x: plain(far.toExponential(2)),
            limit: whole(LIMITS.maxExtent),
          }),
        ),
      );
      continue;
    }
    result.guides[key] = curve;
    guideOn[key] = true;
  }
  if (errors.length) return result;
  // Straight panels join the sections with straight lines; a guide curve would bend them.
  const straight = settings.spanwise === 'straight';
  if (straight && (guideOn.nose || guideOn.end)) {
    errors.push(tr('Straight panels do not follow guide curves: switch the guide curves off in the Planform tab, or set Settings > Spanwise interpolation to Linear or Smooth.'));
    return result;
  }

  const ys = sections.map((s) => s.y);
  const y0 = ys[0];
  const y1 = ys[ys.length - 1];
  const dense = guideOn.nose || guideOn.end || settings.spanwise === 'smooth';
  // Section planes. Smooth builds vertical planes: the mitred construction for a spline along the
  // span is not built (owner decision of 2026-09-30, docs/Flow5upgrade.md).
  const planesOn = mitredPlanes(settings);
  const planes = sectionPlanes(sections, planesOn ? 'mitred' : 'vertical');
  const R = planes.rolls;
  result.sectionPlanes = planesOn ? 'mitred' : 'vertical';
  result.rolls = R.slice();
  result.stretches = planes.stretches.slice();
  if (settings.sectionPlanes === 'mitred' && !planesOn && sectionPlanes(sections, 'mitred').rolls.some((r) => r !== 0)) {
    infos.push(tr('Smooth spanwise interpolation builds vertical section planes; mitred section planes need Linear or Straight panels.'));
  }
  // The stretch 1/cos(angle between a section plane and its panel) grows without bound; the build
  // stops at MAX_STRETCH instead of clamping it.
  const stretched = overStretched(planes.stretches);
  if (stretched >= 0) {
    errors.push(
      tr('Section {n}: its mitred plane lies {angle}° from the panel next to it, which stretches the airfoil {stretch} times (limit {limit}, 60°). Reduce the dihedral change there or set Settings > Section planes to Vertical.', {
        n: plain(stretched + 1),
        angle: fixed(planes.angles[stretched], 1),
        stretch: fixed(planes.stretches[stretched], 3),
        limit: plain(MAX_STRETCH),
      }),
    );
    return result;
  }
  // Linear panels between two section planes that differ get stations as with a guide curve (R4 of
  // docs/Flow5upgrade.md): the airfoil in every plane between. Straight panels stay ruled.
  const rolledPanel = (i) => planesOn && settings.spanwise === 'linear' && R[i] !== R[i + 1];
  let rolledPanels = 0;
  for (let i = 0; i + 1 < sections.length; i++) if (rolledPanel(i)) rolledPanels++;
  // Grid: stations times profile points (2N + 1). Above LIMITS.maxGridPoints, where a desktop
  // browser tab runs out of memory, fewer stations per panel; one station per panel at least.
  const grid = loftGrid(sections.length, settings, guideOn.nose || guideOn.end, rolledPanels);
  const K = grid.K;
  if (grid.points > LIMITS.maxGridPoints) {
    errors.push(
      tr(
        'The loft grid needs {points} points with one station per panel ({sections} sections, {samples} chord samples); the limit is {limit}. Reduce the chord samples or the sections.',
        { points: count(grid.points), sections: count(sections.length), samples: plain(N), limit: count(LIMITS.maxGridPoints) },
      ),
    );
    return result;
  }
  if (K < grid.Kset) {
    warnings.push(
      tr('Spanwise stations per panel reduced from {from} to {to}: {sections} sections with {samples} chord samples keep the loft within {limit} grid points.', {
        from: plain(grid.Kset),
        to: plain(K),
        sections: count(sections.length),
        samples: plain(N),
        limit: count(LIMITS.maxGridPoints),
      }),
    );
  }

  // Intermediate stations cluster towards the panel ends (cosine spacing), where guide curves
  // and pointed tips change fastest.
  // An intermediate station stays only when its span fraction v lies more than 4 units in the last
  // place from its neighbours and from the next section (the tolerance knotMultiplicities merges):
  // in a panel only a few doubles wide the stations round together, and repeated parameters make
  // the interpolation singular. Every section stays (the span-fraction check above keeps them apart).
  const vOf = (y) => (y - y0) / (y1 - y0);
  const stationYs = [];
  for (let i = 0; i < sections.length - 1; i++) {
    stationYs.push(ys[i]);
    let last = vOf(ys[i]);
    const vEnd = vOf(ys[i + 1]);
    const Kp = dense || rolledPanel(i) ? K : 1;
    for (let k = 1; k < Kp; k++) {
      const y = ys[i] + (ys[i + 1] - ys[i]) * (1 - Math.cos((Math.PI * k) / Kp)) / 2;
      const v = vOf(y);
      if (paramsApart(last, v) && paramsApart(v, vEnd)) {
        stationYs.push(y);
        last = v;
      }
    }
  }
  stationYs.push(y1);

  const compat = sections.map((s) => result.profiles.get(s.airfoil).compat);
  const blendCompat = profileBlender(ys, settings.spanwise, compat);
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
  const scalarBlender = () => spanwiseBlender(ys, settings.spanwise, sections.map((_, i) => [[X[i], C[i], Z[i], T[i], R[i]]]));
  // Panel of a span position (binary search): the stretch follows from the blended roll and the angle
  // the planes of that panel are square to, so every station keeps the airfoil thickness across it.
  const panelOf = (y) => {
    let lo = 0;
    let hi = ys.length - 2;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (ys[mid] <= y) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  };
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
    const roll = raw[4];
    const stretch = planesOn ? stretchOf(roll, planes.panels[panelOf(y)]) : 1;
    return { xLE, chord, z: raw[2], twist: raw[3], roll, stretch };
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
      tr('Pointed tip: nose line and end line end {gap} mm apart, so the tip chord is {chord} mm instead of {scaled} mm; move their last points together to close the tip.', {
        gap: fixed(result.tipChord, 1),
        chord: fixed(result.tipChord, 1),
        scaled: fixed(tipChord, 2),
      }),
    );
    result.tipChordLimited = false;
  }

  // Mitred planes of neighbouring sections meet in a line parallel to x; within the airfoils the ruled
  // surface of Straight panels between them folds in span (a short panel at a large dihedral change).
  // A Linear panel turns its planes between the sections, and where the end planes meet says nothing
  // about a fold there: the turning test at the check positions decides for it.
  if (planesOn && straight) {
    const fold = firstFold(R, (i) => {
      const pl = placement(ys[i]);
      const [low, high] = upExtent(compat[i], pl, pivot);
      return { y: ys[i], z: pl.z, roll: pl.roll, low, high };
    });
    if (fold) {
      errors.push(
        tr('Sections {a} and {b}: their mitred planes meet {distance} mm from the position (y, z) of section {a}, within the airfoils, so the surface between them folds. Lengthen the panel, reduce the dihedral change or set Settings > Section planes to Vertical.', {
          a: plain(fold.i + 1),
          b: plain(fold.i + 2),
          distance: fixed(Math.abs(fold.distance), 1),
        }),
      );
      return result;
    }
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
  let nonFiniteY = null;
  let farPlacement = null;
  // Planes that turn along a Linear panel (roll blended linearly in y, dφ/dy per panel in rad/mm): a
  // point at height t in the plane of its station moves across that plane at the rate
  // cos φ + tan δ · sin φ − t · dφ/dy per mm of span. At 0 or below the surface folds, also where the
  // planes of the stations around it do not cross. Straight panels are ruled between the sections,
  // whose planes the section check above covers.
  const rollRate = planesOn && !straight ? ys.slice(0, -1).map((y, i) => ((R[i + 1] - R[i]) * Math.PI) / 180 / (ys[i + 1] - y)) : null;
  let turnFold = null;
  for (const y of [...checkYs].sort((a, b) => a - b)) {
    if (!(y >= y0 && y <= y1)) continue;
    const { chord, xLE, z, twist, roll, stretch } = placement(y);
    // Placement values whose coordinates overflow (e.g. a twist of 1e308 degrees) stop the build.
    if (![xLE, chord, z, Math.cos((twist * Math.PI) / 180)].every(Number.isFinite)) {
      nonFiniteY = y;
      break;
    }
    // Interpolated values stay within the geometry extent and the chord limit: the blends stay within
    // the section values, guide curves within the extent of their control points, but the distance
    // of nose line and end line can exceed the chord limit.
    // Relative round-off of the blend (1e-9) does not count: sections at the limits blend to them.
    const ext = LIMITS.maxExtent * (1 + 1e-9);
    if (!farPlacement && (Math.abs(xLE) > ext || Math.abs(xLE + chord) > ext || Math.abs(z) > ext || chord > LIMITS.maxChord * (1 + 1e-9))) {
      farPlacement = { y, xLE, z, chord };
    }
    if (chord < minChord) {
      minChord = chord;
      minChordY = y;
    }
    // Blended profile thickness at every chord station, then
    // again after the trailing-edge setting, whose linear taper can pull the surfaces through each
    // other where an airfoil is thinner than its trailing-edge gap.
    const shape = blendCompat(y);
    if (rollRate && !turnFold) {
      // At a section both panels next to it count: it ends the inner one and starts the outer one. At a
      // bisector the stretch is the same for both.
      const outer = panelOf(y);
      for (const i of ys[outer] === y && outer > 0 ? [outer - 1, outer] : [outer]) {
        const rate = rollRate[i];
        if (rate === 0) continue;
        const [low, high] = upExtent(shape, { chord, twist, stretch }, pivot);
        const phi = (roll * Math.PI) / 180;
        const dihedral = (planes.dihedrals[i] * Math.PI) / 180;
        if (!(Math.cos(phi) + Math.tan(dihedral) * Math.sin(phi) - (rate > 0 ? high : low) * rate > 0)) {
          turnFold = { y, i };
          break;
        }
      }
    }
    // Round-off level differences do not move the reported position.
    const { t, tX } = thinnest(shape, teSliver(chord));
    if (t < minThick - 1e-12) {
      minThick = t;
      minThickY = y;
      minThickX = tX;
    }
    if (chord >= MIN_CHORD) {
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
    errors.push(tr('Section values give non-finite coordinates at y = {y} mm; check the positions, chords and twists of the sections.', { y: fixed(nonFiniteY, 1) }));
    return result;
  }
  if (farPlacement) {
    const { y, xLE, z, chord } = farPlacement;
    errors.push(
      `${tr('At y = {y} mm the wing leaves the project limits (leading-edge x {x} mm, z {z} mm, chord {chord} mm; limits ±{extent} mm and {maxChord} mm chord).', {
        y: fixed(y, 1),
        x: fixed(xLE, 0),
        z: fixed(z, 0),
        chord: fixed(chord, 0),
        extent: whole(LIMITS.maxExtent),
        maxChord: whole(LIMITS.maxChord),
      })} ${tr('Check the guide curves.')}`,
    );
    return result;
  }
  if (turnFold) {
    errors.push(
      tr('Sections {a} and {b}: at y = {y} mm the mitred section planes between them turn faster than the airfoils allow, so the surface folds. Lengthen the panel, reduce the dihedral change or set Settings > Section planes to Vertical.', {
        a: plain(turnFold.i + 1),
        b: plain(turnFold.i + 2),
        y: fixed(turnFold.y, 1),
      }),
    );
    return result;
  }
  if (minThick < -1e-9) {
    const where = { y: fixed(minThickY, 1), x: fixed(minThickX * 100, 1), thickness: fixed(minThick * 100, 3) };
    // Both blends keep the thickness between the thicknesses of the two sections of the panel: a
    // negative one comes from a section airfoil.
    errors.push(`${tr('The resampled profile has negative thickness at y = {y} mm, x = {x} % chord ({thickness} % chord): upper and lower surface of a section airfoil cross there.', where)} ${tr('Check the airfoils near that position or raise Settings > Chord samples.')}`);
    return result;
  }
  if (minTeThick < -1e-9) {
    errors.push(
      `${tr('The trailing-edge setting pulls the upper surface below the lower surface at y = {y} mm ({thickness} % chord); the airfoil is thinner inside than its trailing-edge gap.', {
        y: fixed(minTeThickY, 1),
        thickness: fixed(minTeThick * 100, 2),
      })} ${tr('Use "as in file" or a larger trailing-edge thickness.')}`,
    );
    return result;
  }
  if (minTeCore <= AIRFOIL_LIMITS.touchThickness) {
    const where = { y: fixed(minTeCoreY, 1), x: fixed(minTeCoreX * 100, 1), thickness: fixed(minTeCore * 100, 4) };
    errors.push(
      te.mode === 'asis'
        ? `${tr('Upper and lower surface of the blended profile touch at y = {y} mm, x = {x} % chord (thickness {thickness} % chord); the wing would have zero thickness there.', where)} ${tr('Use linear interpolation or add sections.')}`
        : `${tr('The trailing-edge setting makes upper and lower surface touch at y = {y} mm, x = {x} % chord (thickness {thickness} % chord); the wing would have zero thickness there.', where)} ${tr('Use "as in file" or a larger trailing-edge thickness.')}`,
    );
    return result;
  }
  if (minChord < MIN_CHORD) {
    const hint = !pointed && minChordY === y1 && minChord > -CROSS_TOLERANCE ? ` ${tr('For a tip that ends in a point, set Settings > Wing tip to Pointed.')}` : '';
    // The blends keep the chord between the chords of the two sections of the panel, at least
    // LIMITS.minChord: only the distance of nose line and end line falls below it.
    errors.push(tr('Chord drops to {chord} mm at y = {y} mm; nose line and end line must not touch or cross.', { chord: fixed(minChord, 2), y: fixed(minChordY, 1) }) + hint);
    return result;
  }

  const degreeV = dense || rolledPanels ? 3 : 1;
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
  const blendSub = profileBlender(ys, settings.spanwise, subCompat);
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
      // Straight panels are the intended surface: no deviation, no added stations.
      if (!straight) {
        let d = 0;
        for (let q = 0; q < idx.length; q++) d = Math.max(d, d3(fitted[q], intended[q]));
        devs.push([y, d, deviationTolerance(pl.chord)]);
      }
      const le = intended[0];
      const dir = [axis[0] - le[0], axis[1] - le[1], axis[2] - le[2]];
      const len = Math.hypot(dir[0], dir[1], dir[2]) || 1;
      const sTEl = surfacePoint(surface, 1, v);
      let fitChord = 0;
      for (let k = 0; k < 3; k++) fitChord += ((fitted[1][k] + sTEl[k]) / 2 - fitted[0][k]) * dir[k];
      fitChord /= len;
      if (fitChord < minFit) {
        minFit = fitChord;
        minFitY = y;
      }
      // Local frame: undo translation, roll, chord scale, twist and stretch (inverse of placeSection).
      const a = (pl.twist * Math.PI) / 180;
      const c = Math.cos(a);
      const sn = Math.sin(a);
      const sr = Math.sin((pl.roll * Math.PI) / 180);
      const cr = Math.cos((pl.roll * Math.PI) / 180);
      const localZ = (P) => {
        const rx = (P[0] - pl.xLE) / pl.chord - pivot;
        const rz = (pl.roll ? cr * (P[2] - pl.z) - sr * (P[1] - y) : P[2] - pl.z) / pl.chord;
        return (sn * rx + c * rz) / pl.stretch;
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
      const { xLE, chord, z, twist, roll, stretch } = placement(y);
      if (te.mode === 'thickness' && te.thickness / chord > MAX_GAP_FRACTION && !(pointed && y > yPrev)) limited++;
      const shape = applyTrailingEdge(blendCompat(y), te.mode, teGap(chord), N);
      stations.push({ xLE, y, z, chord, twist, roll, stretch, v: y1 > y0 ? (y - y0) / (y1 - y0) : 0, shape });
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
    // At a closed trailing edge both ends leave in the direction of the first chord station (secant
    // end tangents). Free ends take their tangents from the curvature further in; at a cusp (9e-6 to
    // 5e-5 chord thick at the first station, 7e-4 chord from the trailing edge) the upper tangent can
    // then lie below the lower one, the surfaces cross next to the trailing edge, and the end caps of
    // the STEP solid have self-intersecting outlines.
    const ends = closedTE ? secantEndInterpolation(paramsU, degU) : null;
    const knotsU = ends ? ends.knots : averagingKnots(paramsU, degU);
    const luU = ends ? null : collocationFactor(paramsU, degU, knotsU);
    const rowCtrl = rows.map((row) => {
      const out = [];
      for (let c = 0; c < 3; c++) {
        const values = row.map((q) => q[c]);
        const x = ends ? ends.solve(values) : collocationSolve(luU, values);
        for (let j = 0; j < x.length; j++) (out[j] ??= [0, 0, 0])[c] = x[j];
      }
      return out;
    });

    const paramsV = stations.map((st) => st.v);
    const panelIdx = [];
    // Station index of each section y (a map: indexOf per section took time quadratic in the sections).
    const stationOf = new Map();
    yList.forEach((y, i) => {
      if (!stationOf.has(y)) stationOf.set(y, i);
    });
    for (let i = 0; i < ys.length - 1; i++) panelIdx.push([stationOf.get(ys[i]), stationOf.get(ys[i + 1])]);
    // Every panel on its own: the smooth blend is C1 at the sections, a cubic through all stations
    // swings beside a short panel with a fast change (a 0.5 mm airfoil switch next to a 300 mm panel).
    const along = interpolateAlongV(rowCtrl, { kind: 'panels', params: paramsV, panels: panelIdx, degree: degreeV });
    // Root and tip boundaries lie exactly in their planes (removes solver round-off): y = const for a
    // vertical plane, the projection onto the rolled plane otherwise. The root is always vertical.
    const ctrl = along.columns;
    const last = ctrl[0].length - 1;
    const tipRoll = stations[stations.length - 1].roll;
    const tipZ = stations[stations.length - 1].z;
    const tn = [Math.cos((tipRoll * Math.PI) / 180), Math.sin((tipRoll * Math.PI) / 180)];
    for (const col of ctrl) {
      col[0][1] = y0;
      if (tipRoll === 0) col[last][1] = y1;
      else {
        const P = col[last];
        const d = (P[1] - y1) * tn[0] + (P[2] - tipZ) * tn[1];
        P[1] -= d * tn[0];
        P[2] -= d * tn[1];
      }
    }
    const surface = { degreeU: degU, degreeV: along.degree, knotsU, knotsV: along.knots, points: ctrl };

    return { stations, surface, paramsU, paramsV, closedTE, limited, widened, ...probe(checkYs, surface, paramsU, closedTE) };
  };

  // Adaptive stations: insert stations where the loft deviates more than PLANFORM_TOLERANCE from
  // the intended surface (fast planform changes such as pointed elliptic tips), up to
  // MAX_EXTRA_STATIONS in at most 6 rounds. Each round fits the whole loft again, so above the
  // loft grid warning threshold one round adds every peak at once (a 4 mm guide bump at 2,000
  // sections took 3 fits and 22.8 s instead of 9.2 s).
  const rounds = grid.points > WARN.gridPoints ? 1 : 6;
  // Stations closer than the solver resolves (span fractions near 1e-300, and their powers in the
  // cubic basis) make the surface fit singular: reported with the closest pair of sections.
  const singular = () => {
    let k = 1;
    for (let i = 2; i < ys.length; i++) if (ys[i] - ys[i - 1] < ys[k] - ys[k - 1]) k = i;
    errors.push(
      tr('The surface fit is singular: sections {a} and {b} at y = {y1} mm and y = {y2} mm lie too close together; move them apart.', {
        a: plain(k),
        b: plain(k + 1),
        y1: plain(ys[k - 1]),
        y2: plain(ys[k]),
      }),
    );
    return result;
  };
  let fits = 0;
  const tryFit = (list) => {
    fits++;
    try {
      return fit(list);
    } catch (e) {
      if (!/zero pivot/.test(e.message)) throw e;
      return null;
    }
  };
  let yList = stationYs.slice();
  let fitted = tryFit(yList);
  if (!fitted) return singular();
  let extra = 0;
  // Largest deviation relative to its tolerance. The rounds keep the fit where it is smallest, the
  // first one on a tie: stations added very close together can make the cubic fit swing (a 0.06 mm
  // wide guide bump on a 2-section wing went from 4 mm to 18,797 mm deviation after 32 stations),
  // while a round that raises it can still lead to a better one.
  const worst = (f) => f.devs.reduce((m, [, d, tol]) => Math.max(m, d / tol), 0);
  let best = { fitted, yList, extra, worst: worst(fitted) };
  for (let round = 0; round < rounds && extra < MAX_EXTRA_STATIONS; round++) {
    // Peaks of the deviation relative to its tolerance: the tolerance shrinks with the chord, so the
    // largest deviation can lie below it while smaller ones further out exceed theirs.
    const ratio = (q) => (q ? q[1] / q[2] : 0);
    const peaks = fitted.devs.filter((q, i, arr) => q[1] > q[2] && ratio(q) >= ratio(arr[i - 1]) && ratio(q) >= ratio(arr[i + 1]));
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
    fitted = tryFit(yList);
    if (!fitted) return singular();
    const w = worst(fitted);
    if (w < best.worst) best = { fitted, yList, extra, worst: w };
  }
  ({ fitted, yList, extra } = best);
  const { stations, surface, paramsU, paramsV, closedTE, limited, widened, devs } = fitted;
  result.stations = stations;
  // Every point must lie outboard of the plane of the station before it and inboard of the plane of
  // the station after it: rolled station planes that cross within the airfoils fold the loft.
  if (planesOn && R.some((r) => r !== 0)) {
    for (let k = 0; k + 1 < stations.length; k++) {
      const A = stations[k];
      const B = stations[k + 1];
      if (A.roll === B.roll) continue;
      const na = [Math.cos((A.roll * Math.PI) / 180), Math.sin((A.roll * Math.PI) / 180)];
      const nb = [Math.cos((B.roll * Math.PI) / 180), Math.sin((B.roll * Math.PI) / 180)];
      const folds = A.points.some((P, j) => {
        const dy = B.points[j][1] - P[1];
        const dz = B.points[j][2] - P[2];
        return !(dy * na[0] + dz * na[1] > 0 && dy * nb[0] + dz * nb[1] > 0);
      });
      if (folds) {
        const i = panelOf(A.y);
        errors.push(
          tr('The surface folds between the stations at y = {y1} mm and y = {y2} mm (panel from section {a} to {b}): their section planes cross within the airfoils. Lengthen the panel, reduce the dihedral change or set Settings > Section planes to Vertical.', {
            y1: fixed(A.y, 1),
            y2: fixed(B.y, 1),
            a: plain(i + 1),
            b: plain(i + 2),
          }),
        );
        return result;
      }
    }
  }
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
    errors.push(tr('The fitted surface has non-finite coordinates; check the positions, chords and twists of the sections.'));
    return result;
  }
  if (fitThick < -1e-9 || fitCore <= AIRFOIL_LIMITS.touchThickness) {
    const neg = fitThick < -1e-9;
    const at = { y: fixed(neg ? fitThickY : fitCoreY, 1), thickness: fixed((neg ? fitThick : fitCore) * 100, 3) };
    const problem = neg
      ? tr('The fitted surface turns inside out between stations at y = {y} mm (local thickness {thickness} % chord): the surface through the stations swings between them (guide curves that change fast).', at)
      : tr('The fitted surface has zero thickness between stations at y = {y} mm (local thickness {thickness} % chord): the surface through the stations swings between them (guide curves that change fast).', at);
    errors.push(`${problem} ${tr('Smooth the guide curves or add sections.')}`);
    return result;
  }
  if (minFit < FOLD_LIMIT) {
    errors.push(
      `${tr('The fitted surface folds or narrows between stations at y = {y} mm (chord {chord} mm along the intended chord direction, minimum {min} mm): twist or guide curves change faster than {stations} added stations resolve.', {
        y: fixed(minFitY, 1),
        chord: fixed(minFit, 2),
        min: plain(LIMITS.minChord),
        stations: plain(MAX_EXTRA_STATIONS),
      })} ${tr('Add sections, reduce the twist difference or smooth the guide curves.')}`,
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
    const cross = surfaceRowCrossing(surface, v, Math.min(CROSSING_TOLERANCE * chordAtV(v), CROSSING_LIMIT), placement(y0 + v * (y1 - y0)).roll);
    if (cross) {
      errors.push(
        `${tr('The loft surface crosses itself at y = {y} mm near x = {x} mm: the surface rows overshoot between the resampled points.', {
          y: fixed(y0 + v * (y1 - y0), 1),
          x: fixed(cross.x, 1),
        })} ${tr('Increase Settings > Chord samples.')}`,
      );
      return result;
    }
  }
  // The rigid placement of the part (src/geom/part.js) turns the surface after the build; the turned
  // control points bound the turned surface and must stay within the extent limit; a left half turned
  // with the wing (part.turnedLeft) lies elsewhere than the mirror image and is checked as well.
  const part = partTransform(settings, sections);
  result.part = part;
  if (!part.identity) {
    let far = 0;
    let at = null;
    for (const col of surface.points) {
      for (const P of col) {
        for (const q of part.turnedLeft ? [part.point(P), part.leftPoint(P)] : [part.point(P)]) {
          const m = Math.max(Math.abs(q[0]), Math.abs(q[1]), Math.abs(q[2]));
          if (m > far) {
            far = m;
            at = q;
          }
        }
      }
    }
    if (!(far <= LIMITS.maxExtent)) {
      errors.push(
        tr('The tilted or rolled part reaches x = {x} mm, y = {y} mm, z = {z} mm, beyond ±{limit} mm; reduce the part tilt or roll, or move the part towards its pivot.', {
          x: fixed(at[0], 0),
          y: fixed(at[1], 0),
          z: fixed(at[2], 0),
          limit: whole(LIMITS.maxExtent),
        }),
      );
      return result;
    }
  }
  result.surface = surface;
  result.extraStations = extra;
  result.fits = fits;
  if (limited) {
    warnings.push(
      tr('Trailing-edge thickness {thickness} mm exceeds {percent} % of the chord at {stations} station(s); it is limited to {percent} % there.', {
        thickness: plain(te.thickness),
        percent: plain(MAX_GAP_FRACTION * 100),
        stations: plain(limited),
      }),
    );
  }
  if (widened) {
    warnings.push(tr('The trailing edge is closed on some stations and open on others; {stations} station(s) were opened to {gap} mm.', { stations: plain(widened), gap: plain(MIN_OPEN_GAP) }));
  }
  // An XFLR5 import that folded a tilt angle into the sections (twist and quarter-chord points turned
  // about y) is exact for vertical planes only; rolled planes would need the tilt as a rigid rotation.
  const tilt = project.foldedTilt;
  if (planesOn && tilt && R.some((r) => r !== 0)) {
    let off = 0;
    sections.forEach((q, i) => (off = Math.max(off, 0.75 * C[i] * Math.abs(Math.sin((tilt.angle * Math.PI) / 180) * Math.sin((R[i] * Math.PI) / 180)))));
    warnings.push(
      tr("The tilt angle of {angle}° of the XFLR5 import is folded into the section values, which is exact for vertical section planes only: with mitred planes the part lies up to about {distance} mm off XFLR5's (0.75 · chord · sin(tilt angle) · sin(roll)). Settings > Section planes Vertical keeps the import exact.", {
        angle: fixed(tilt.angle, 2),
        distance: fixed(off, 2),
      }),
    );
  }
  // The XFLR5 import of format version 1 folded a tilt angle without storing it (project.foldedTiltUnknown).
  if (planesOn && !tilt && project.foldedTiltUnknown && R.some((r) => r !== 0)) {
    warnings.push(
      tr("A tilt angle of the XFLR5 import of format version 1 may be folded into the section values; the angle is not stored. The fold is exact for vertical section planes only: with mitred planes the part lies up to 0.75 · chord · sin(tilt angle) · sin(roll) off XFLR5's. Settings > Section planes Vertical keeps the import exact; importing the XFLR5 file again gives the rigid tilt."),
    );
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
      tr('The loft deviates up to {dev} mm from the intended surface at y = {y} mm after {stations} added station(s); raise the spanwise stations per panel.', {
        dev: fixed(dev, 2),
        y: fixed(devY, 1),
        stations: plain(extra),
      }),
    );
  }
  result.paramsU = paramsU;
  result.paramsV = paramsV;
  result.uLE = paramsU[N];
  result.leIndex = N;
  result.closedTE = closedTE;
  result.rootY = y0;
  result.tipY = y1;
  // Rolls of the end planes (degrees), for the caps of meshes and STEP.
  result.rootRoll = stations[0].roll;
  result.tipRoll = stations[stations.length - 1].roll;
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
