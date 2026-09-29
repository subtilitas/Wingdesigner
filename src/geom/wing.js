// Half-wing construction: NURBS profiles -> compatible sections -> spanwise stations
// (sections, spanwise interpolation, optional guide curves) -> tensor-product NURBS surface.
//
// Surface parametrization: u runs around the profile from the upper trailing edge (u = 0) over the
// leading edge (u = uLE) to the lower trailing edge (u = 1); v is the span fraction (0 root, 1 tip).

import { LIMITS as AIRFOIL_LIMITS, checkAirfoil } from '../airfoil/sanity.js';
import { setTrailingEdgeGap } from '../airfoil/geometry.js';
import { averagingKnots, collocationFactor, collocationSolve, curvePoint, interpolateCurve, parametrize, surfacePoint } from './nurbs.js';
import { CROSSING_TOLERANCE, cosineStations, curveCrossing, profileCurve, profileProblem, resampleProfile } from './profile.js';
import { blendPoints, blendScalar, spanwiseWeights } from './spanwise.js';
import { guideCurve, guideProblems, guideXAt, isMonotonicInY } from './guide.js';
import { LIMITS, resolveSettings } from '../model/project.js';

/**
 * Deviation (mm) between loft and intended edges above which stations are added and, if it remains,
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

/** Stations the builder may add where the loft deviates from the intended planform. */
const MAX_EXTRA_STATIONS = 32;

/** Largest trailing-edge gap as a fraction of the local chord. */
export const MAX_GAP_FRACTION = 0.05;

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
  let knots = curves[0].knots.slice();
  let points = curves[0].points.slice();
  for (let i = 1; i < curves.length; i++) {
    knots = knots.slice(0, -1).concat(curves[i].knots.slice(p + 1));
    points = points.concat(curves[i].points.slice(1));
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
        const local = scheme.params.slice(a, b + 1).map((f) => (f - f0) / (f1 - f0));
        const c = interpolateCurve(series.slice(a, b + 1), scheme.degree, { params: local });
        return { degree: c.degree, knots: c.knots.map((t) => f0 + t * (f1 - f0)), points: c.points };
      });
      cols.push(joinCurves(parts));
    }
  }
  return { degree: cols[0].degree, knots: cols[0].knots, columns: cols.map((c) => c.points) };
}

// Profile stage per airfoil (checks, NURBS curve, crossing test, resampling), keyed by the point
// list and the settings it depends on. Airfoils rarely change between edits.
const PROFILE_CACHE = new Map();
const PROFILE_CACHE_SIZE = 32;

function profileStage(a, parametrization, chordStations, N) {
  const key = `${parametrization}|${N}|${JSON.stringify(a.points)}`;
  const hit = PROFILE_CACHE.get(key);
  if (hit) return hit;
  let out;
  const check = checkAirfoil(a.points);
  if (!check.ok) {
    out = { error: check.issues.filter((i) => i.severity === 'error').map((i) => i.message).join(' ') };
  } else {
    try {
      const prof = profileCurve(check.points, { parametrization });
      const problem = profileProblem(prof);
      out = problem ? { error: problem } : { prof, points: check.points, compat: unitChord(resampleProfile(prof, chordStations), N) };
    } catch (e) {
      out = { error: `the NURBS interpolation failed (${e.message}).` };
    }
  }
  PROFILE_CACHE.set(key, out);
  if (PROFILE_CACHE.size > PROFILE_CACHE_SIZE) PROFILE_CACHE.delete(PROFILE_CACHE.keys().next().value);
  return out;
}

/**
 * Crossing of the surface row at parameter v. Rows lie in planes y = const (every station lies in
 * one), so the row is tested in the x-z plane. Returns { x, size } in mm or null.
 */
export function surfaceRowCrossing(surface, v, tolerance) {
  const ctrl = surface.points.map((col) => {
    const q = curvePoint({ degree: surface.degreeV, knots: surface.knotsV, points: col }, v);
    return [q[0], q[2]];
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
    if (stage.error) {
      errors.push(`Airfoil "${a.name ?? a.id}": ${stage.error}`);
      continue;
    }
    result.profiles.set(s.airfoil, { ...stage.prof, id: a.id, name: a.name, points: stage.points, compat: stage.compat });
  }
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
    result.guides[key] = curve;
    guideOn[key] = true;
  }
  if (errors.length) return result;

  const ys = sections.map((s) => s.y);
  const y0 = ys[0];
  const y1 = ys[ys.length - 1];
  const weights = spanwiseWeights(ys, settings.spanwise);
  const dense = guideOn.nose || guideOn.end || settings.spanwise === 'smooth';
  const K = dense ? Math.max(LIMITS.panelStations[0], Math.min(settings.panelStations, LIMITS.panelStations[1])) : 1;

  // Intermediate stations cluster towards the panel ends (cosine spacing), where guide curves
  // and pointed tips change fastest.
  const stationYs = [];
  for (let i = 0; i < sections.length - 1; i++) {
    for (let k = 0; k < K; k++) stationYs.push(ys[i] + (ys[i + 1] - ys[i]) * (dense ? (1 - Math.cos((Math.PI * k) / K)) / 2 : k / K));
  }
  stationYs.push(y1);

  const compat = sections.map((s) => result.profiles.get(s.airfoil).compat);
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
  const placed = new Map();
  const placement = (y) => {
    const hit = placed.get(y);
    if (hit) return hit;
    const w = weights(y);
    let xLE = blendScalar(w, X);
    let chord = blendScalar(w, C);
    const xTE = guideOn.end ? guideXAt(result.guides.end, y, y0, y1) : null;
    if (guideOn.nose) xLE = guideXAt(result.guides.nose, y, y0, y1);
    if (guideOn.nose && guideOn.end) chord = xTE - xLE;
    // Pointed tip: in the last panel the chord does not fall below the tip chord, so guide
    // curves that meet at the tip end in a scaled-down profile instead of a zero chord.
    if (pointed && y > yPrev && chord < tipChord && chord > -CROSS_TOLERANCE) chord = tipChord;
    if (guideOn.end && !guideOn.nose) xLE = xTE - chord;
    const out = { w, xLE, chord, z: blendScalar(w, Z), twist: blendScalar(w, T) };
    placed.set(y, out);
    return out;
  };
  if (pointed) {
    // The tip profile is scaled to tip.ratio of the chord at the previous section, at least minChord.
    const scaled = settings.tip.ratio * placement(yPrev).chord;
    tipChord = Math.max(scaled, LIMITS.minChord);
    result.tipChordLimited = scaled < LIMITS.minChord;
    C[C.length - 1] = tipChord;
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
  const checkYs = new Set(stationYs);
  for (let k = 0; k <= CHORD_CHECK_SAMPLES; k++) checkYs.add(y0 + ((y1 - y0) * k) / CHORD_CHECK_SAMPLES);
  for (const key of ['nose', 'end']) {
    const c = result.guides[key];
    if (!c) continue;
    const gy0 = c.points[0][1];
    const gy1 = c.points[c.points.length - 1][1];
    const toWing = (gy) => y0 + ((gy - gy0) / (gy1 - gy0)) * (y1 - y0);
    for (const P of c.points) checkYs.add(toWing(P[1]));
    for (const u of c.knots) checkYs.add(toWing(curvePoint(c, u)[1]));
  }
  let minChord = Infinity;
  let minChordY = y0;
  let minThick = Infinity;
  let minThickY = y0;
  let minTeThick = Infinity;
  let minTeThickY = y0;
  let minTeCore = Infinity;
  let minTeCoreY = y0;
  let minTeCoreX = 0;
  // Thinnest point of a resampled shape; `core` covers chord stations from 1 % to 99 %, where
  // thickness at or below the airfoil contact tolerance means the surfaces touch.
  const thinnest = (shape) => {
    let t = Infinity;
    let core = Infinity;
    let coreX = 0;
    for (let k = 1; k < N; k++) {
      const d = shape[N - k][1] - shape[N + k][1];
      t = Math.min(t, d);
      const x = chordStations[k];
      if (x >= 0.01 && x <= 0.99 && d < core) {
        core = d;
        coreX = x;
      }
    }
    return { t, core, coreX };
  };
  for (const y of [...checkYs].sort((a, b) => a - b)) {
    if (!(y >= y0 && y <= y1)) continue;
    const { chord, w } = placement(y);
    if (chord < minChord) {
      minChord = chord;
      minChordY = y;
    }
    // Blended profile thickness at every chord station (smooth mode can overshoot below zero), then
    // again after the trailing-edge setting, whose linear taper can pull the surfaces through each
    // other where an airfoil is thinner than its trailing-edge gap.
    const shape = blendPoints(w, compat);
    // Round-off level differences do not move the reported position.
    const { t } = thinnest(shape);
    if (t < minThick - 1e-12) {
      minThick = t;
      minThickY = y;
    }
    if (chord >= LIMITS.minChord) {
      const { t: tTe, core, coreX } = thinnest(applyTrailingEdge(shape, te.mode, teGap(chord), N));
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
  if (minThick < -1e-9) {
    errors.push(
      `The blended profile at y = ${minThickY.toFixed(1)} mm has negative thickness (${(minThick * 100).toFixed(2)} % chord); ` +
        'smooth spanwise interpolation overshoots between unevenly spaced sections. Use linear interpolation or add sections.',
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

  const teShapes = compat.map((c) => [c[0]]);
  const degreeV = dense ? 3 : 1;

  /** Stations, surface and planform deviation for a sorted list of station span positions. */
  const fit = (yList) => {
    const stations = [];
    // Trailing-edge thickness in mm, limited to MAX_GAP_FRACTION of the local chord.
    let limited = 0;
    for (const y of yList) {
      const { w, xLE, chord, z, twist } = placement(y);
      let gap = te.thickness / chord;
      if (te.mode === 'thickness' && gap > MAX_GAP_FRACTION) {
        gap = MAX_GAP_FRACTION;
        if (!(pointed && y > yPrev)) limited++;
      }
      const shape = applyTrailingEdge(blendPoints(w, compat), te.mode, gap, N);
      stations.push({ xLE, y, z, chord, twist, v: y1 > y0 ? (y - y0) / (y1 - y0) : 0, shape });
    }
    // Trailing-edge topology: closed when every station is closed, otherwise open with a minimum gap.
    const gapMm = (st) => (st.shape[0][1] - st.shape[st.shape.length - 1][1]) * st.chord;
    const closedTE = stations.every((st) => Math.abs(gapMm(st)) < 1e-6);
    let widened = 0;
    for (const st of stations) {
      if (closedTE) st.shape = applyTrailingEdge(st.shape, 'closed', 0, N);
      else if (gapMm(st) < Math.min(MIN_OPEN_GAP, MAX_GAP_FRACTION * st.chord)) {
        st.shape = setTrailingEdgeGap(st.shape, Math.min(MIN_OPEN_GAP / st.chord, MAX_GAP_FRACTION), { leIndex: N });
        widened++;
      }
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

    // Deviation: the loft passes through the stations only. Compare its leading and trailing edge
    // with the intended placement between stations, in 3D (twist moves the edges in z as well).
    // fitChord: chord of the fitted surface along the intended chord direction; linear rows between
    // strongly twisted stations shrink it and fast guide changes can fold it below zero.
    const devs = [];
    let minFit = Infinity;
    let minFitY = y0;
    const d3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    for (const y of checkYs) {
      if (!(y >= y0 && y <= y1) || !(y1 > y0)) continue;
      const pl = placement(y);
      const [le, teU, axis] = placeSection([[0, 0], blendPoints(pl.w, teShapes)[0], [1, 0]], { ...pl, y }, pivot);
      const v = (y - y0) / (y1 - y0);
      const sLE = surfacePoint(surface, paramsU[N], v);
      const sTE = surfacePoint(surface, 0, v);
      const sTEl = surfacePoint(surface, 1, v);
      devs.push([y, Math.max(d3(sLE, le), d3(sTE, teU)), deviationTolerance(pl.chord)]);
      const dir = [axis[0] - le[0], axis[2] - le[2]];
      const len = Math.hypot(dir[0], dir[1]) || 1;
      const fitChord = (((sTE[0] + sTEl[0]) / 2 - sLE[0]) * dir[0] + ((sTE[2] + sTEl[2]) / 2 - sLE[2]) * dir[1]) / len;
      if (fitChord < minFit) {
        minFit = fitChord;
        minFitY = y;
      }
    }
    devs.sort((a, b) => a[0] - b[0]);
    return { stations, surface, paramsU, paramsV, closedTE, limited, widened, devs, minFit, minFitY };
  };

  // Adaptive stations: insert stations where the loft deviates more than PLANFORM_TOLERANCE from
  // the intended edges (fast planform changes such as pointed elliptic tips), up to MAX_EXTRA_STATIONS.
  let yList = stationYs.slice();
  let fitted = fit(yList);
  let extra = 0;
  for (let round = 0; round < 6 && extra < MAX_EXTRA_STATIONS; round++) {
    const peaks = fitted.devs.filter(([, d, tol], i, arr) => d > tol && d >= (arr[i - 1]?.[1] ?? 0) && d >= (arr[i + 1]?.[1] ?? 0));
    const fresh = peaks.map(([y]) => y).filter((y) => !yList.includes(y)).slice(0, MAX_EXTRA_STATIONS - extra);
    if (!fresh.length) break;
    yList = [...yList, ...fresh].sort((a, b) => a - b);
    extra += fresh.length;
    fitted = fit(yList);
  }
  const { stations, surface, paramsU, paramsV, closedTE, limited, widened, devs, minFit, minFitY } = fitted;
  result.stations = stations;
  if (minFit < FOLD_LIMIT) {
    errors.push(
      `The fitted surface folds or narrows between stations at y = ${minFitY.toFixed(1)} mm (chord ${minFit.toFixed(2)} mm along the intended chord direction, ` +
        `minimum ${LIMITS.minChord} mm): twist or guide curves change faster than ${MAX_EXTRA_STATIONS} added stations resolve. Add sections, reduce the twist difference or smooth the guide curves.`,
    );
    return result;
  }
  // Surface rows (planes y = const) at the sections and halfway between them: a cubic row can
  // overshoot between the resampled points and cross, which the point checks above do not see.
  const rowY = [];
  for (let i = 0; i < ys.length; i++) {
    rowY.push(ys[i]);
    if (i + 1 < ys.length) rowY.push((ys[i] + ys[i + 1]) / 2);
  }
  const rowV = rowY.map((y) => (y1 > y0 ? (y - y0) / (y1 - y0) : 0));
  const chordAtV = (v) => placement(y0 + v * (y1 - y0)).chord;
  for (const v of rowV) {
    const cross = surfaceRowCrossing(surface, v, CROSSING_TOLERANCE * chordAtV(v));
    if (cross) {
      errors.push(
        `The loft surface crosses itself at y = ${(y0 + v * (y1 - y0)).toFixed(1)} mm near x = ${cross.x.toFixed(1)} mm: ` +
          'the surface rows overshoot between the resampled points. Increase Settings > Chord samples or use airfoil files with more points.',
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
      `The loft deviates up to ${dev.toFixed(2)} mm from the intended leading or trailing edge at y = ${devY.toFixed(1)} mm ` +
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
  // Intended planform (leading edge and chord) at any span position, for exact statistics.
  result.planformAt = (y) => {
    const q = placement(Math.min(Math.max(y, y0), y1));
    return { xLE: q.xLE, chord: q.chord };
  };
  return result;
}
