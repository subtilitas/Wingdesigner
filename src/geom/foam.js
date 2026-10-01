// Foam cores for hot-wire cutting. The half wing is split at span positions (cuts) into segments;
// each segment is one core that a hot wire cuts as a ruled surface between two end profiles.
//
// Frame of a segment: the axis runs from the reference point (y, z) of its inboard cut to that of
// its outboard cut (z of the stations, linear between them), at the angle `axis` (degrees, the
// dihedral of the segment) in the y-z plane. A core has parallel end faces square to the axis: the
// faces a hot-wire cutter makes. Each end face lies where the core just covers the joint plane: the
// section plane of the wing at a section (vertical or rolled, as built), else the bisector of the
// two segment axes (square to both when they are parallel). Between end face and joint plane lies a
// wedge, sanded off before the cores are joined: `wedge` gives its angle, its depth (mm, along the
// axis) and the surface where it is deepest.
//
// End profiles: the surface of the segment, continued straight past its ends, cut by the end faces,
// at the surface parameters u of the build (build.paramsU): point i of the inboard profile and point
// i of the outboard profile lie on one straight line of the core surface, so cutting programs can
// synchronise the two wire ends point by point. Profile coordinates (mm) in the plane of the end
// face: x chordwise towards the trailing edge, h up (square to the axis); the origin is the front
// lower corner of the block that holds both profiles of the segment.
//
// Deviation: the straight lines between the two end profiles against the wing surface, in
// DEVIATION_PLANES planes parallel to the end faces: largest distance (mm) of a point of the ruled
// core from the cut of the wing surface in that plane. A loft with stations at the sections only
// (Straight panels, or Linear without rolled planes and guide curves) is ruled between them and cuts
// exactly (0 up to round-off); guide curves, Smooth blending and Linear panels with stations between
// the sections (rolled Mitred planes) give a deviation that shorter segments reduce.

import { basisFuns, findSpan, solveMonotonic } from './nurbs.js';

/** Limits of the foam-cutting wizard (lengths in mm). */
export const FOAM_LIMITS = Object.freeze({
  /** Shortest segment along y: cuts closer together are merged. */
  minSegment: 5,
  /** Most segments per half wing. */
  maxSegments: 200,
  /** Range of the longest core (the cutter width or block length). */
  coreLength: Object.freeze([20, 5000]),
  /** Range of the deviation limit. */
  tolerance: Object.freeze([0.01, 10]),
  /** Range of the kerf (width of the cut that the wire melts), for templates. */
  kerf: Object.freeze([0, 5]),
});

/** Planes between the end faces in which the deviation is measured. */
export const DEVIATION_PLANES = 7;

/** A wedge below this angle (degrees) counts as none. */
const NO_WEDGE = 1e-3;

const DEG = Math.PI / 180;
const dot = (p, n) => p[1] * n[1] + p[2] * n[2];

/** Spanwise curve C(v) of the surface at fixed u (non-rational surface: a B-spline curve in v). */
function columnCurve(surface, u) {
  const p = surface.degreeU;
  const P = surface.points;
  const span = findSpan(P.length - 1, p, u, surface.knotsU);
  const N = basisFuns(span, u, p, surface.knotsU);
  const m = P[0].length;
  const points = [];
  for (let j = 0; j < m; j++) {
    const q = [0, 0, 0];
    for (let k = 0; k <= p; k++) {
      const c = P[span - p + k][j];
      q[0] += N[k] * c[0];
      q[1] += N[k] * c[1];
      q[2] += N[k] * c[2];
    }
    points.push(q);
  }
  return { degree: surface.degreeV, knots: surface.knotsV, points };
}

function evalColumn(curve, v) {
  const { degree: q, knots: V, points: P } = curve;
  const span = findSpan(P.length - 1, q, v, V);
  const N = basisFuns(span, v, q, V);
  const out = [0, 0, 0];
  for (let l = 0; l <= q; l++) {
    const c = P[span - q + l];
    out[0] += N[l] * c[0];
    out[1] += N[l] * c[1];
    out[2] += N[l] * c[2];
  }
  return out;
}

const columnCache = new WeakMap();

/** Column curves at the surface parameters u of the build, cached per build. */
function columns(build) {
  let c = columnCache.get(build);
  if (!c) {
    c = build.paramsU.map((u) => columnCurve(build.surface, u));
    columnCache.set(build, c);
  }
  return c;
}

/**
 * Point of the column curve in the plane {p : p·n = d} (n in the y-z plane), searched in [va, vb];
 * past the ends of [va, vb] the curve continues straight along its end tangent (one-sided, inside
 * the interval), so a plane beyond the segment cuts the continued segment, not its neighbour.
 */
function planePoint(curve, n, d, va, vb) {
  const f = (v) => dot(evalColumn(curve, v), n);
  const fa = f(va);
  const fb = f(vb);
  if ((fa - d) * (fb - d) <= 0) return evalColumn(curve, solveMonotonic(f, d, va, vb, 1e-10, 200, 1e-15));
  // Beyond the nearer end: straight continuation.
  const atEnd = Math.abs(fa - d) < Math.abs(fb - d) ? va : vb;
  const step = (vb - va) * 1e-6;
  const inner = atEnd === va ? va + step : vb - step;
  const P = evalColumn(curve, atEnd);
  const Q = evalColumn(curve, inner);
  const T = [(P[0] - Q[0]) / (atEnd - inner), (P[1] - Q[1]) / (atEnd - inner), (P[2] - Q[2]) / (atEnd - inner)];
  const slope = dot(T, n);
  if (!(Math.abs(slope) > 1e-12)) return P;
  const t = (d - dot(P, n)) / slope;
  return [P[0] + t * T[0], P[1] + t * T[1], P[2] + t * T[2]];
}

/** Station values (z, roll) interpolated linearly in y. */
function stationValue(stations, y, key) {
  if (y <= stations[0].y) return stations[0][key];
  const last = stations[stations.length - 1];
  if (y >= last.y) return last[key];
  let i = 1;
  while (stations[i].y < y) i++;
  const a = stations[i - 1];
  const b = stations[i];
  const t = (y - a.y) / (b.y - a.y);
  return a[key] + t * (b[key] - a[key]);
}

const vAt = (build, y) => (build.tipY > build.rootY ? Math.min(1, Math.max(0, (y - build.rootY) / (build.tipY - build.rootY))) : 0);

/** Length (mm) of the reference line (y, z of the stations) from ya to yb. */
function lineLength(stations, ya, yb) {
  const ys = [ya, ...stations.map((s) => s.y).filter((y) => y > ya && y < yb), yb];
  let L = 0;
  for (let i = 1; i < ys.length; i++) L += Math.hypot(ys[i] - ys[i - 1], stationValue(stations, ys[i], 'z') - stationValue(stations, ys[i - 1], 'z'));
  return L;
}

/** Span positions of the sections strictly between root and tip, closer ones merged (minSegment). */
function sectionCuts(build) {
  const out = [];
  for (const s of build.sections) {
    if (s.y < build.rootY + FOAM_LIMITS.minSegment || s.y > build.tipY - FOAM_LIMITS.minSegment) continue;
    if (out.length && s.y - out[out.length - 1] < FOAM_LIMITS.minSegment) continue;
    out.push(s.y);
  }
  return out;
}

/**
 * Cuts proposed for cores of at most `maxLength` mm along the reference line: at every section
 * between root and tip (sections closer than FOAM_LIMITS.minSegment merged), and each piece between
 * them split into equal parts in y. Sorted span positions (mm), root and tip excluded. A piece gets at
 * most as many parts as keep them FOAM_LIMITS.minSegment long in y, and generation stops at
 * FOAM_LIMITS.maxSegments cuts: a steep wing with a short longest core would otherwise build millions
 * of cuts that normalizeCuts drops.
 */
export function proposeCuts(build, maxLength) {
  const ends = [build.rootY, ...sectionCuts(build), build.tipY];
  const cuts = [];
  const cap = FOAM_LIMITS.maxSegments;
  for (let i = 1; i < ends.length && cuts.length < cap; i++) {
    const a = ends[i - 1];
    const b = ends[i];
    const n = Math.min(cap, Math.max(1, Math.floor((b - a) / FOAM_LIMITS.minSegment)), Math.max(1, Math.ceil(lineLength(build.stations, a, b) / maxLength - 1e-9)));
    for (let k = 1; k < n && cuts.length < cap; k++) cuts.push(a + ((b - a) * k) / n);
    if (i < ends.length - 1) cuts.push(b);
  }
  return normalizeCuts(build, cuts).cuts;
}

/**
 * Sorted cuts inside the half wing: cuts that are no number, lie within FOAM_LIMITS.minSegment of
 * root or tip, or of the cut before, and cuts beyond FOAM_LIMITS.maxSegments segments are dropped.
 * Returns { cuts, dropped, capped } (dropped: removed cuts, capped: those of them removed by the
 * segment limit).
 */
export function normalizeCuts(build, cuts) {
  const min = FOAM_LIMITS.minSegment;
  const sorted = cuts.filter(Number.isFinite).sort((a, b) => a - b);
  const out = [];
  let capped = 0;
  for (const y of sorted) {
    if (y < build.rootY + min || y > build.tipY - min) continue;
    if (out.length && y - out[out.length - 1] < min) continue;
    if (out.length >= FOAM_LIMITS.maxSegments - 1) {
      capped++;
      continue;
    }
    out.push(y);
  }
  return { cuts: out, dropped: cuts.length - out.length, capped };
}

/** Unit vectors of a segment frame from its axis angle (radians): along the axis and up. */
const frame = (angle) => ({ a: [0, Math.cos(angle), Math.sin(angle)], up: [0, -Math.sin(angle), Math.cos(angle)] });

/**
 * Joint plane at span position y: the section plane where a section lies (its station roll), else
 * the bisector of the axes before and after (angles in radians; one of them null at root or tip).
 */
function jointPlane(build, y, before, after) {
  const st = build.stations.find((s) => Math.abs(s.y - y) < 1e-9);
  const atSection = build.sections.some((s) => Math.abs(s.y - y) < 1e-9);
  if (st && (atSection || before === null || after === null)) return [0, Math.cos(st.roll * DEG), Math.sin(st.roll * DEG)];
  const A = frame(before ?? after).a;
  const B = frame(after ?? before).a;
  const s = Math.hypot(A[1] + B[1], A[2] + B[2]);
  return [0, (A[1] + B[1]) / s, (A[2] + B[2]) / s];
}

/**
 * The cores of the half wing for sorted cuts (see normalizeCuts). Returns an array of segments:
 * { index, ya, yb, axis (deg), length (core length along the axis, mm), nominal (length of the
 * reference line, mm), width, height (block, mm), origin: [x, h] (block frame origin in wing
 * coordinates: x, and h along the up direction of the segment), faces: [dIn, dOut] (positions of the
 * end faces along the axis, mm), ends: [inboard, outboard], deviation: { max, y } }
 * with ends { y, points: [[x, h], ...], chord, incidence (deg, nose up positive), le: [x, h],
 * te: [x, h], wedge: { angle (deg), depth (mm), side: 'upper' | 'lower' } | null }.
 */
export function foamSegments(build, cuts, { deviation = true } = {}) {
  const ys = [build.rootY, ...cuts, build.tipY];
  const zs = ys.map((y) => stationValue(build.stations, y, 'z'));
  const angles = [];
  for (let i = 1; i < ys.length; i++) angles.push(Math.atan2(zs[i] - zs[i - 1], ys[i] - ys[i - 1]));
  const cols = columns(build);
  const vs = ys.map((y) => vAt(build, y));
  // Joint profiles: the wing surface cut by the joint plane at each cut (searched in the two
  // segments next to it).
  const joints = ys.map((y, i) => {
    const n = jointPlane(build, y, i > 0 ? angles[i - 1] : null, i < angles.length ? angles[i] : null);
    const d = dot([0, y, zs[i]], n);
    const va = vs[Math.max(0, i - 1)];
    const vb = vs[Math.min(vs.length - 1, i + 1)];
    return { n, points: cols.map((c) => planePoint(c, n, d, va, vb)) };
  });
  return angles.map((angle, k) => segment(build, cols, k, ys, vs, angle, joints[k], joints[k + 1], deviation));
}

function segment(build, cols, k, ys, vs, angle, jointIn, jointOut, withDeviation) {
  const { a, up } = frame(angle);
  const va = vs[k];
  const vb = vs[k + 1];
  // End faces: square to the axis, covering the joint profiles.
  const dIn = Math.min(...jointIn.points.map((p) => dot(p, a)));
  const dOut = Math.max(...jointOut.points.map((p) => dot(p, a)));
  const cut = (d) => cols.map((c) => planePoint(c, a, d, va, vb));
  const P = [cut(dIn), cut(dOut)];
  let xRef = Infinity;
  let hRef = Infinity;
  let xMax = -Infinity;
  let hMax = -Infinity;
  for (const row of P) {
    for (const p of row) {
      const h = dot(p, up);
      xRef = Math.min(xRef, p[0]);
      hRef = Math.min(hRef, h);
      xMax = Math.max(xMax, p[0]);
      hMax = Math.max(hMax, h);
    }
  }
  const flat = (row) => row.map((p) => [p[0] - xRef, dot(p, up) - hRef]);
  const ends = P.map((row, e) => {
    const points = flat(row);
    const le = points[build.leIndex];
    const n = points.length - 1;
    const te = [(points[0][0] + points[n][0]) / 2, (points[0][1] + points[n][1]) / 2];
    return {
      y: ys[k + e],
      points,
      le,
      te,
      chord: Math.hypot(te[0] - le[0], te[1] - le[1]),
      incidence: Math.atan2(le[1] - te[1], te[0] - le[0]) / DEG,
      wedge: wedge(e === 0 ? jointIn : jointOut, a, up, e === 0),
    };
  });
  const out = {
    index: k,
    ya: ys[k],
    yb: ys[k + 1],
    axis: angle / DEG,
    length: dOut - dIn,
    nominal: lineLength(build.stations, ys[k], ys[k + 1]),
    width: xMax - xRef,
    height: hMax - hRef,
    origin: [xRef, hRef],
    faces: [dIn, dOut],
    ends,
    deviation: null,
  };
  if (withDeviation) out.deviation = deviationOf(cols, a, up, dIn, dOut, va, vb, P, xRef, hRef, build);
  return out;
}

/** Wedge between the end face (square to a) and the joint plane; inboard: the face at the minimum. */
function wedge(joint, a, up, inboard) {
  const angle = Math.acos(Math.min(1, Math.abs(dot(joint.n, a)))) / DEG;
  if (angle < NO_WEDGE) return null;
  const s = joint.points.map((p) => dot(p, a));
  const lo = Math.min(...s);
  const hi = Math.max(...s);
  // Deepest where the joint profile lies farthest from the end face.
  const deep = s.indexOf(inboard ? hi : lo);
  const hs = joint.points.map((p) => dot(p, up));
  const mid = (Math.min(...hs) + Math.max(...hs)) / 2;
  return { angle, depth: hi - lo, side: hs[deep] >= mid ? 'upper' : 'lower' };
}

/** Distance from point p to the closed polygon `poly` (2D). */
function polygonDistance(p, poly) {
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const A = poly[i];
    const B = poly[(i + 1) % poly.length];
    const ex = B[0] - A[0];
    const ey = B[1] - A[1];
    const L = ex * ex + ey * ey;
    let t = L > 0 ? ((p[0] - A[0]) * ex + (p[1] - A[1]) * ey) / L : 0;
    t = Math.min(1, Math.max(0, t));
    const dx = A[0] + t * ex - p[0];
    const dy = A[1] + t * ey - p[1];
    const d = dx * dx + dy * dy;
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}

function deviationOf(cols, a, up, dIn, dOut, va, vb, P, xRef, hRef, build) {
  const toFlat = (p) => [p[0] - xRef, dot(p, up) - hRef];
  const A = P[0].map(toFlat);
  const B = P[1].map(toFlat);
  let max = 0;
  let at = dIn;
  for (let j = 1; j <= DEVIATION_PLANES; j++) {
    const s = j / (DEVIATION_PLANES + 1);
    const d = dIn + s * (dOut - dIn);
    const wing = cols.map((c) => toFlat(planePoint(c, a, d, va, vb)));
    for (let i = 0; i < A.length; i++) {
      const r = [A[i][0] + s * (B[i][0] - A[i][0]), A[i][1] + s * (B[i][1] - A[i][1])];
      const dist = polygonDistance(r, wing);
      if (dist > max) {
        max = dist;
        at = d;
      }
    }
  }
  // Span position of the plane of the largest deviation, on the reference line.
  const ya = build.rootY + va * (build.tipY - build.rootY);
  const yb = build.rootY + vb * (build.tipY - build.rootY);
  const y = ya + ((at - dIn) / (dOut - dIn || 1)) * (yb - ya);
  return { max, y };
}

/**
 * Splits segments whose deviation exceeds `tolerance` (mm) in the middle (in y), the largest
 * deviation first, until every segment is within it or FOAM_LIMITS.maxSegments is reached, or a
 * segment would be shorter than twice FOAM_LIMITS.minSegment. Returns { cuts, segments, within }.
 */
export function splitOverTolerance(build, cuts, tolerance) {
  let current = normalizeCuts(build, cuts).cuts;
  let segments = foamSegments(build, current);
  for (;;) {
    const over = segments.filter((s) => s.deviation.max > tolerance && s.yb - s.ya >= 2 * FOAM_LIMITS.minSegment).sort((p, q) => q.deviation.max - p.deviation.max);
    if (!over.length || segments.length >= FOAM_LIMITS.maxSegments) break;
    // Every segment over the limit is halved in one round (up to the segment limit).
    const room = FOAM_LIMITS.maxSegments - segments.length;
    const added = over.slice(0, room).map((s) => (s.ya + s.yb) / 2);
    current = normalizeCuts(build, [...current, ...added]).cuts;
    segments = foamSegments(build, current);
  }
  return { cuts: current, segments, within: segments.every((s) => s.deviation.max <= tolerance) };
}
