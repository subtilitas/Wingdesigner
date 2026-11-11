// Mold halves of the half wing: a lower and an upper block that part along the leading edge and the
// trailing edge, each with the wing surface of its side as cavity.
//
// Frame: the frame the half wing is built in (x aft, y span, z up), before the rigid placement of the
// part, rolled about x by the dihedral of the wing (`roll`: the roll of a flat tip section, else the
// slope of the line fitted to leading edge and trailing edge), so that the wing lies flat. The parting
// plane is z = zp in that frame, the mean height of leading edge and trailing edge. The root section
// stays in its plane, which leans by the roll: y = yR + tan(roll) · (z − zp). Leading edge and
// trailing edge rarely lie in one plane (twist, a change of dihedral, an airfoil whose leading edge
// lies off its chord line), so a ramp joins them to the plane: a ruled surface from the edge of the
// wing to a curve in the plane, `ramp` mm away. Inboard of the tip the rulings run along x, in planes
// parallel to the root plane; around a tip that closes in a point they turn with the tip, from x at
// the start of the tip to y at the point; a flat tip face is parted along the mean line of the tip
// section, with a ruled strip beyond it and a planar triangle at each corner. The cavity is open at
// the root: the root section lies in the root face of the block.
//
// In the parting plane, outside the ramp:
//   channel    the resin channel (German: Blutrinne): a groove of half-round cross-section in each
//              half, so that the closed mold has a round channel. Its centre line is the wing outline, mirrored at the root, offset by distance
//              + radius, with every inward corner rounded (offset outward by more, then back), so that
//              it crosses the root face square to it.
//   pins       blind holes in both halves for alignment pins
//   screws     through holes in both halves for clamping screws
// Hole patterns: the four corners of the block, a frame along the block edges, or along the wing
// outline, at a largest spacing.
//
// moldGeometry returns the geometry of both halves in the frame of the lower half: the upper half is
// described as its mirror image at the parting plane, so that one construction writes both
// (src/export/moldstep.js). The file has the parting plane at z = 0.

import { averagingKnots, curvePoint, interpolateCurve, interpolateSurface, splitSurfaceU, surfaceBoundaryU, surfaceBoundaryV, surfacePoint } from './nurbs.js';
import { roundTipStart } from './tipblend.js';
import { fixed, plain, tr } from '../i18n/index.js';

const DEG = Math.PI / 180;

export const HOLE_PATTERNS = Object.freeze(['corners', 'frame', 'outline']);
export const MOLD_HALVES = Object.freeze(['both', 'lower', 'upper']);

/** Starting values (lengths in mm). */
export const MOLD_DEFAULTS = Object.freeze({
  margin: 40,
  floor: 12,
  ramp: 3,
  channel: Object.freeze({ on: true, diameter: 4, distance: 6 }),
  pins: Object.freeze({ on: true, diameter: 6, depth: 10, pattern: 'corners', spacing: 150, edge: 12, offset: 10 }),
  screws: Object.freeze({ on: true, diameter: 6.5, pattern: 'frame', spacing: 120, edge: 12, offset: 10 }),
  halves: 'both',
  left: false,
});

/** Ranges of the mold parameters (mm). */
export const MOLD_RANGES = Object.freeze({
  margin: Object.freeze([5, 1000]),
  floor: Object.freeze([1, 1000]),
  ramp: Object.freeze([0.5, 100]),
  'channel.diameter': Object.freeze([1, 20]),
  'channel.distance': Object.freeze([1, 500]),
  'pins.diameter': Object.freeze([1, 50]),
  'pins.depth': Object.freeze([1, 500]),
  'pins.spacing': Object.freeze([5, 10000]),
  'pins.edge': Object.freeze([2, 500]),
  'pins.offset': Object.freeze([1, 500]),
  'screws.diameter': Object.freeze([1, 50]),
  'screws.spacing': Object.freeze([5, 10000]),
  'screws.edge': Object.freeze([2, 500]),
  'screws.offset': Object.freeze([1, 500]),
});

/** Material kept between two features, and between a feature and a block edge (mm). */
export const MOLD_CLEARANCE = 1;
/**
 * Largest reach (mm) of a cavity beyond the leading-edge or trailing-edge line seen from above: a
 * twisted section turns its nose ahead of the leading-edge point, which undercuts one half.
 */
export const MOLD_OVERHANG = 0.1;
/** Smallest distance of the resin channel from the outer edge of the ramp (mm). */
const RAMP_CLEARANCE = 0.5;
/** Spacing of the outline samples (mm) and the tolerance of the offset test. */
const SAMPLE = 0.25;
const OFFSET_EPS = 0.02;
/** Points across the half-round groove, and the largest step along it (mm). */
const GROOVE_POINTS = 9;
const GROOVE_STEP = 8;
/** Chord error (mm) the stations along the groove keep on its centre line. */
const GROOVE_TOLERANCE = 0.002;
/** Largest growth of the station step per mm along the groove. */
const GROOVE_GRADING = 0.25;

/** Parameters with the defaults for every missing key. */
export function resolveMold(params = {}) {
  const group = (k) => ({ ...MOLD_DEFAULTS[k], ...(params[k] && typeof params[k] === 'object' ? params[k] : {}) });
  return { ...MOLD_DEFAULTS, ...params, channel: group('channel'), pins: group('pins'), screws: group('screws') };
}

const get = (obj, path) => path.split('.').reduce((o, k) => o?.[k], obj);

const rangeNames = () => ({
  margin: tr('block margin'),
  floor: tr('floor thickness'),
  ramp: tr('ramp width'),
  'channel.diameter': tr('resin channel diameter'),
  'channel.distance': tr('resin channel distance'),
  'pins.diameter': tr('pin diameter'),
  'pins.depth': tr('pin hole depth'),
  'pins.spacing': tr('pin spacing'),
  'pins.edge': tr('pin edge distance'),
  'pins.offset': tr('pin distance'),
  'screws.diameter': tr('screw hole diameter'),
  'screws.spacing': tr('screw spacing'),
  'screws.edge': tr('screw edge distance'),
  'screws.offset': tr('screw distance'),
});

/** Why the parameters are no mold: values out of range and combinations that cannot be cut. */
export function moldProblems(input) {
  const p = resolveMold(input);
  const out = [];
  const names = rangeNames();
  for (const [key, [lo, hi]] of Object.entries(MOLD_RANGES)) {
    const group = key.includes('.') ? key.split('.')[0] : null;
    if (group && !p[group].on) continue;
    const v = get(p, key);
    if (typeof v !== 'number' || !Number.isFinite(v) || v < lo || v > hi) out.push(tr('Mold: {param} must be between {min} and {max} mm.', { param: names[key], min: plain(lo), max: plain(hi) }));
  }
  for (const k of ['pins', 'screws']) if (p[k].on && !HOLE_PATTERNS.includes(p[k].pattern)) out.push(tr('Mold: the hole pattern must be "corners", "frame" or "outline".'));
  if (!MOLD_HALVES.includes(p.halves)) out.push(tr('Mold: halves must be "both", "lower" or "upper".'));
  if (out.length) return out;
  if (p.channel.on && p.channel.distance < p.ramp + RAMP_CLEARANCE) {
    out.push(tr('Mold: the distance of the resin channel must be at least {min} mm, the ramp width plus {gap} mm.', { min: plain(p.ramp + RAMP_CLEARANCE), gap: plain(RAMP_CLEARANCE) }));
  }
  for (const k of ['pins', 'screws']) {
    if (p[k].on && p[k].pattern === 'outline' && p[k].offset < p[k].diameter / 2 + MOLD_CLEARANCE) {
      out.push(
        k === 'pins'
          ? tr('Mold: the pin distance must be at least {min} mm, the hole radius plus {gap} mm.', { min: plain(p[k].diameter / 2 + MOLD_CLEARANCE), gap: plain(MOLD_CLEARANCE) })
          : tr('Mold: the screw distance must be at least {min} mm, the hole radius plus {gap} mm.', { min: plain(p[k].diameter / 2 + MOLD_CLEARANCE), gap: plain(MOLD_CLEARANCE) }),
      );
    }
    if (p[k].on && p[k].pattern !== 'outline' && p[k].edge < p[k].diameter / 2 + MOLD_CLEARANCE) {
      out.push(
        k === 'pins'
          ? tr('Mold: the pin edge distance must be at least {min} mm, the hole radius plus {gap} mm.', { min: plain(p[k].diameter / 2 + MOLD_CLEARANCE), gap: plain(MOLD_CLEARANCE) })
          : tr('Mold: the screw edge distance must be at least {min} mm, the hole radius plus {gap} mm.', { min: plain(p[k].diameter / 2 + MOLD_CLEARANCE), gap: plain(MOLD_CLEARANCE) }),
      );
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Plane geometry: polygons, distances, offsets.

/** Segments of a closed polygon in a uniform grid, for distance tests. */
class SegmentGrid {
  constructor(poly, cell) {
    this.poly = poly;
    this.cell = cell;
    this.map = new Map();
    const n = poly.length;
    for (let i = 0; i < n; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % n];
      const x0 = Math.floor(Math.min(a[0], b[0]) / cell);
      const x1 = Math.floor(Math.max(a[0], b[0]) / cell);
      const y0 = Math.floor(Math.min(a[1], b[1]) / cell);
      const y1 = Math.floor(Math.max(a[1], b[1]) / cell);
      for (let gx = x0; gx <= x1; gx++) {
        for (let gy = y0; gy <= y1; gy++) {
          const key = `${gx},${gy}`;
          let list = this.map.get(key);
          if (!list) this.map.set(key, (list = []));
          list.push(i);
        }
      }
    }
  }

  /** Distance of q from the polygon when it is below `limit`, else `limit`. */
  distance(q, limit) {
    const { cell, poly } = this;
    const n = poly.length;
    let best = limit * limit;
    const x0 = Math.floor((q[0] - limit) / cell);
    const x1 = Math.floor((q[0] + limit) / cell);
    const y0 = Math.floor((q[1] - limit) / cell);
    const y1 = Math.floor((q[1] + limit) / cell);
    for (let gx = x0; gx <= x1; gx++) {
      for (let gy = y0; gy <= y1; gy++) {
        const list = this.map.get(`${gx},${gy}`);
        if (!list) continue;
        for (const i of list) {
          const a = poly[i];
          const b = poly[(i + 1) % n];
          const dx = b[0] - a[0];
          const dy = b[1] - a[1];
          const len2 = dx * dx + dy * dy;
          let t = len2 > 0 ? ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / len2 : 0;
          t = Math.min(1, Math.max(0, t));
          const ex = q[0] - a[0] - t * dx;
          const ey = q[1] - a[1] - t * dy;
          const d2 = ex * ex + ey * ey;
          if (d2 < best) best = d2;
        }
      }
    }
    return Math.sqrt(best);
  }
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const len = (a) => Math.hypot(a[0], a[1]);
const unit = (a) => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l];
};

/** Whether the point lies inside the closed polygon (even-odd rule). */
function insidePolygon(poly, q) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a[1] > q[1] !== b[1] > q[1] && q[0] < a[0] + ((q[1] - a[1]) * (b[0] - a[0])) / (b[1] - a[1])) inside = !inside;
  }
  return inside;
}

/** Points of a polyline at equal arc steps of at most `step`, ends kept. */
function resample(points, step) {
  const s = [0];
  for (let i = 1; i < points.length; i++) s.push(s[i - 1] + len(sub(points[i], points[i - 1])));
  const total = s[s.length - 1];
  const n = Math.max(1, Math.ceil(total / step));
  const out = [points[0]];
  let j = 0;
  for (let k = 1; k < n; k++) {
    const target = (total * k) / n;
    while (s[j + 1] < target) j++;
    const f = (target - s[j]) / (s[j + 1] - s[j] || 1);
    out.push([points[j][0] + f * (points[j + 1][0] - points[j][0]), points[j][1] + f * (points[j + 1][1] - points[j][1])]);
  }
  out.push(points[points.length - 1]);
  return out;
}

/**
 * Offset of a closed polygon to the outside by `dist`, with every inward corner of the offset rounded
 * to the radius `rho`: the polygon is offset by dist + rho, the parts of that offset that lie closer
 * to another part of the polygon are dropped, and the rest is moved back by rho, with an arc of
 * radius rho around every corner the drop leaves. The polygon runs clockwise seen from +z (x to the
 * right, y up), so that the outside lies to the left of its direction. Returns a closed polyline.
 */
export function offsetOutline(poly, dist, rho, grid = null) {
  const n = poly.length;
  const level = dist + rho;
  const g = grid ?? new SegmentGrid(poly, Math.max(1, level / 4));
  // Candidates: one outward normal per point, a fan of them at an outward corner.
  const cands = [];
  for (let i = 0; i < n; i++) {
    const e0 = unit(sub(poly[i], poly[(i - 1 + n) % n]));
    const e1 = unit(sub(poly[(i + 1) % n], poly[i]));
    // Left normals of the two edges, and the turn from one to the other (clockwise: an outward corner).
    const a0 = Math.atan2(e0[0], -e0[1]);
    let turn = Math.atan2(e1[0], -e1[1]) - a0;
    while (turn > Math.PI) turn -= 2 * Math.PI;
    while (turn < -Math.PI) turn += 2 * Math.PI;
    if (turn < -0.02) {
      const steps = Math.max(1, Math.ceil(-turn / 0.04));
      for (let k = 0; k <= steps; k++) cands.push({ i, a: a0 + (turn * k) / steps });
    } else {
      cands.push({ i, a: a0 + turn / 2 });
    }
  }
  for (const c of cands) {
    c.n = [Math.cos(c.a), Math.sin(c.a)];
    const P = poly[c.i];
    c.q = [P[0] + level * c.n[0], P[1] + level * c.n[1]];
    c.keep = g.distance(c.q, level) >= level - OFFSET_EPS;
    c.c = [P[0] + dist * c.n[0], P[1] + dist * c.n[1]];
  }
  const m = cands.length;
  const first = cands.findIndex((c) => c.keep);
  if (first < 0) return [];
  const out = [];
  let prev = null;
  for (let k = 0; k <= m; k++) {
    const c = cands[(first + k) % m];
    if (!c.keep) continue;
    if (prev && first + k - prev.k > 1) {
      // A dropped run: the corner X of the outer offset, where the lines through the two kept ends
      // meet; the centre line turns around it with radius rho.
      const A = prev.c;
      const ta = [-A.n[1], A.n[0]];
      const tb = [-c.n[1], c.n[0]];
      const det = ta[0] * tb[1] - ta[1] * tb[0];
      let X = [(A.q[0] + c.q[0]) / 2, (A.q[1] + c.q[1]) / 2];
      let corner = false;
      if (Math.abs(det) > 1e-6) {
        const d = sub(c.q, A.q);
        const s = (d[0] * tb[1] - d[1] * tb[0]) / det;
        const cand = [A.q[0] + s * ta[0], A.q[1] + s * ta[1]];
        if (len(sub(cand, X)) < 2 * len(sub(c.q, A.q)) + 1) {
          X = cand;
          corner = true;
        }
      }
      // With the corner found, the arc has the radius rho and starts and ends on the two lines (the
      // path runs along −ta and −tb): a sparse polygon, whose kept ends lie far from X, gets straight
      // pieces up to the arc; a kept end past the start or the end of the arc ends it there.
      const dot = (u, v) => u[0] * v[0] + u[1] * v[1];
      const At = [X[0] - rho * A.n[0], X[1] - rho * A.n[1]];
      const Bt = [X[0] - rho * c.n[0], X[1] - rho * c.n[1]];
      const A0 = corner && dot(sub(At, A.c), ta) < 0 ? At : A.c;
      const B0 = corner && dot(sub(c.c, Bt), tb) < 0 ? Bt : c.c;
      const ra = sub(A0, X);
      const rb = sub(B0, X);
      const aa = Math.atan2(ra[1], ra[0]);
      let sweep = Math.atan2(rb[1], rb[0]) - aa;
      while (sweep > Math.PI) sweep -= 2 * Math.PI;
      while (sweep < -Math.PI) sweep += 2 * Math.PI;
      const steps = Math.max(1, Math.ceil(Math.abs(sweep) / 0.04));
      const far = (P, Q) => len(sub(P, Q)) > 1e-6;
      if (far(A0, A.c)) out.push(A0);
      for (let j = 1; j < steps; j++) {
        const f = j / steps;
        const r = len(ra) + f * (len(rb) - len(ra));
        out.push([X[0] + r * Math.cos(aa + f * sweep), X[1] + r * Math.sin(aa + f * sweep)]);
      }
      if (far(B0, c.c) && far(B0, A0)) out.push(B0);
    }
    if (k < m) out.push(c.c);
    prev = { k: first + k, c };
  }
  return out;
}

/** The part of a closed polyline, symmetric to y = y0, on the side y >= y0, from small x to large x. */
function upperHalf(loop, y0) {
  const n = loop.length;
  const cross = [];
  for (let i = 0; i < n; i++) {
    const a = loop[i];
    const b = loop[(i + 1) % n];
    if (a[1] < y0 === b[1] < y0) continue;
    const f = (y0 - a[1]) / (b[1] - a[1]);
    cross.push({ i, x: a[0] + f * (b[0] - a[0]), up: b[1] >= y0 });
  }
  if (cross.length !== 2) return null;
  const start = cross.find((c) => c.up);
  const end = cross.find((c) => !c.up);
  if (!start || !end) return null;
  const out = [[start.x, y0]];
  for (let i = (start.i + 1) % n; ; i = (i + 1) % n) {
    out.push(loop[i]);
    if (i === end.i) break;
  }
  out.push([end.x, y0]);
  if (out[0][0] > out[out.length - 1][0]) out.reverse();
  return out;
}

// ---------------------------------------------------------------------------------------------
// The wing: edges, outline, ramps.

const mirrorZ = (zp) => (P) => [P[0], P[1], 2 * zp - P[2]];
const mapCurve = (c, f) => ({ ...c, points: c.points.map(f) });
const mapSurface = (s, f) => ({ ...s, points: s.points.map((row) => row.map(f)) });

/** The surface with u reversed (u' = 1 − u). */
function reverseU(s) {
  const a = s.knotsU[0];
  const b = s.knotsU[s.knotsU.length - 1];
  return { ...s, knotsU: s.knotsU.map((k) => a + b - k).reverse(), points: s.points.slice().reverse() };
}

/** Greville abscissae of a knot vector: one per control point. */
function greville(knots, p, count) {
  const out = [];
  for (let i = 0; i < count; i++) {
    let s = 0;
    for (let k = 1; k <= p; k++) s += knots[i + k];
    out.push(s / p);
  }
  return out;
}

/**
 * Geometry of the mold halves of a built wing.
 * @param {object} build result of buildWing() without errors
 * @param {object} input mold parameters (MOLD_DEFAULTS)
 * @returns {{errors: string[], warnings: string[], halves?: object, preview?: object, summary?: object}}
 */
export function moldGeometry(build, input) {
  const p = resolveMold(input);
  const errors = moldProblems(p);
  const warnings = [];
  const fail = (message) => ({ errors: [message], warnings });
  if (errors.length) return { errors, warnings };
  if (!build?.surface) return fail(tr('The wing has no surface; fix the reported errors first.'));
  const pole = Boolean(build.tipPole);
  const y0 = build.rootY;
  const closed = build.closedTE;
  const [SUw, SLw] = splitSurfaceU(build.surface, build.uLE);
  // Roll of the mold frame: the roll of a flat tip section, so that the tip face stands square to the
  // parting plane; else the slope of the line fitted to leading edge and trailing edge.
  let roll = build.tipRoll ?? 0;
  if (pole) {
    const edges = [SLw.points[0], SLw.points[SLw.points.length - 1], SUw.points[0]];
    let n = 0;
    let sy = 0;
    let sz = 0;
    let syy = 0;
    let syz = 0;
    for (const row of edges) {
      const c = { degree: SLw.degreeV, knots: SLw.knotsV, points: row };
      for (let k = 0; k <= 200; k++) {
        const P = curvePoint(c, k / 200);
        n++;
        sy += P[1];
        sz += P[2];
        syy += P[1] * P[1];
        syz += P[1] * P[2];
      }
    }
    const den = n * syy - sy * sy;
    roll = den > 0 ? Math.atan((n * syz - sy * sz) / den) / DEG : 0;
  }
  const cr = Math.cos(roll * DEG);
  const sr = Math.sin(roll * DEG);
  const slope = sr / cr;
  const toMold = (P) => [P[0], y0 + (P[1] - y0) * cr + P[2] * sr, -(P[1] - y0) * sr + P[2] * cr];
  const SU0 = mapSurface(SUw, toMold);
  const SL0 = mapSurface(SLw, toMold);
  const y1 = SL0.points[0][SL0.points[0].length - 1][1];
  // Copies with the root exactly in its plane (y = y0 + slope · z), the tip in its plane or in one point.
  const snap = (S) => {
    const pts = S.points.map((row) => row.map((P) => P.slice()));
    const last = pts[0].length - 1;
    const P1 = SL0.points[0][last];
    for (const row of pts) {
      row[0][1] = y0 + slope * row[0][2];
      if (pole) row[last] = P1.slice();
      else row[last][1] = y1;
    }
    return { ...S, points: pts };
  };
  const SU = snap(SU0);
  const SL = snap(SL0);
  const le = surfaceBoundaryU(SL, false);
  const teL = surfaceBoundaryU(SL, true);
  const teU = surfaceBoundaryU(SU, false);
  const mid = closed ? teL : { ...teL, points: teL.points.map((P, i) => P.map((v, c) => (v + teU.points[i][c]) / 2)) };
  const degV = le.degree;
  const knotsV = le.knots;

  // Parting plane: the mean height of leading edge and trailing edge.
  const NV = 400;
  let zSum = 0;
  let zLo = Infinity;
  let zHi = -Infinity;
  for (let k = 0; k <= NV; k++) {
    for (const c of [le, mid]) {
      const z = curvePoint(c, k / NV)[2];
      zSum += z;
      zLo = Math.min(zLo, z);
      zHi = Math.max(zHi, z);
    }
  }
  const zp = zSum / (2 * NV + 2);
  // The root line of the parting plane.
  const yR = y0 + slope * zp;

  // Flat tip: the mean line of the tip section parts the tip face, from the leading edge to the
  // trailing edge between the upper and the lower surface.
  let meanLine = null;
  if (!pole) {
    const a = curvePoint(le, 1);
    const b = curvePoint(mid, 1);
    // The surface point of the tip row at x: bisection on u (x falls with u on the upper surface).
    const at = (S, x, rev) => {
      let lo = 0;
      let hi = 1;
      for (let it = 0; it < 60; it++) {
        const m = (lo + hi) / 2;
        if (surfacePoint(S, m, 1)[0] < x !== rev) lo = m;
        else hi = m;
      }
      return surfacePoint(S, (lo + hi) / 2, 1)[2];
    };
    const count = 48;
    const pts = [];
    for (let k = 0; k <= count; k++) {
      const f = (1 - Math.cos((Math.PI * k) / count)) / 2;
      const x = a[0] + f * (b[0] - a[0]);
      pts.push(k === 0 ? a.slice() : k === count ? b.slice() : [x, y1, (at(SL, x, false) + at(SU, x, true)) / 2]);
    }
    const params = pts.map((_, k) => (1 - Math.cos((Math.PI * k) / count)) / 2);
    const c = interpolateCurve(pts, 3, { params });
    meanLine = { degree: c.degree, knots: c.knots, points: c.points.map((P) => [P[0], y1, P[2]]) };
    meanLine.points[0] = a.slice();
    meanLine.points[meanLine.points.length - 1] = b.slice();
  }

  // Direction of the ramp rulings in the plane: along x, turning to y around a tip that closes in a
  // point, with the angle of the tip ellipse, which the span parameter follows there.
  const ys = build.sections.map((s) => s.y);
  const tipStart = pole ? roundTipStart(build.sections, build.settings) : -1;
  const vF = pole ? build.vAt(tipStart >= 0 ? ys[tipStart] : ys[ys.length - 2]) : 1;
  const psi = (v) => {
    if (!pole || v <= vF) return 0;
    const th = (Math.min(1, (v - vF) / (1 - vF)) * Math.PI) / 2;
    return th - Math.sin(2 * th) / 2;
  };
  const w = p.ramp;
  const nCtrl = le.points.length;
  const sites = greville(knotsV, degV, nCtrl);
  const outer = (edge, side) => {
    const pts = sites.map((v) => {
      const O = curvePoint(edge, v);
      const a = psi(v);
      // Along x the ruling stays in a plane parallel to the root plane.
      return [O[0] + side * w * Math.cos(a), O[1] + w * Math.sin(a) + Math.cos(a) * slope * (zp - O[2]), zp];
    });
    const c = interpolateCurve(pts, degV, { params: sites, knots: knotsV });
    const out = { degree: degV, knots: knotsV.slice(), points: c.points.map((P) => [P[0], P[1], zp]) };
    out.points[0] = pts[0].slice();
    out.points[0][1] = yR;
    out.points[nCtrl - 1] = pts[nCtrl - 1].slice();
    return out;
  };
  let aLE;
  let aTE;
  try {
    aLE = outer(le, -1);
    aTE = outer(mid, 1);
  } catch (e) {
    if (!/zero pivot/.test(e.message)) throw e;
    return fail(tr('Mold: the ramp along the wing outline could not be fitted; move sections that lie very close together apart.'));
  }
  if (pole) aTE.points[nCtrl - 1] = aLE.points[nCtrl - 1].slice();

  // The ramp must not fold in the top view, and its height sets its slope.
  let rampHeight = 0;
  let rampSlope = 0;
  let fold = false;
  for (const [edge, A, side] of [[le, aLE, -1], [mid, aTE, 1]]) {
    let prevO = null;
    let prevA = null;
    for (let k = 0; k <= NV; k++) {
      const v = k / NV;
      const O = curvePoint(edge, v);
      const Q = curvePoint(A, v);
      const h = Math.abs(O[2] - zp);
      rampHeight = Math.max(rampHeight, h);
      if (prevO) {
        const r0 = sub(prevA, prevO);
        const r1 = sub(Q, O);
        const dO = sub(O, prevO);
        const dA = sub(Q, prevA);
        // Both ends of neighbouring rulings advance on the same side of the ruling.
        const s0 = (r0[0] * dO[1] - r0[1] * dO[0]) * side;
        const s1 = (r1[0] * dA[1] - r1[1] * dA[0]) * side;
        if (len(dO) > 1e-9 && len(dA) > 1e-9 && (s0 < -1e-9 || s1 < -1e-9)) fold = true;
        // Width of the ramp square to the outline.
        const t = unit(dO);
        const wPerp = Math.abs(r1[0] * t[1] - r1[1] * t[0]);
        if (h > 1e-6 && wPerp > 1e-6) rampSlope = Math.max(rampSlope, Math.atan2(h, wPerp));
      }
      prevO = O;
      prevA = Q;
    }
  }
  if (fold) return fail(tr('Mold: the ramp folds over itself at the wing outline; reduce the ramp width.'));
  const slopeDeg = (rampSlope * 180) / Math.PI;
  if (slopeDeg > 45) {
    warnings.push(
      tr('Mold: leading edge and trailing edge lie up to {height} mm off the parting plane (twist, a change of dihedral or the airfoil), so the ramp rises up to {slope}°. A wider ramp, or a wing with less twist and one dihedral angle, keeps the parting surface flatter.', {
        height: fixed(rampHeight, 2),
        slope: fixed(slopeDeg, 0),
      }),
    );
  }

  // Outline in the top view, clockwise seen from above, mirrored at the root.
  const dense = (c, from, to, count) => Array.from({ length: count + 1 }, (_, k) => curvePoint(c, from + ((to - from) * k) / count)).map((P) => [P[0], P[1]]);
  const leHalf = resample(dense(le, 0, 1, 4000), SAMPLE);
  const teHalf = resample(dense(mid, 1, 0, 4000), SAMPLE);
  // A flat tip adds the edge of the tip face, sampled like the rest.
  const half = [...leHalf, ...(pole ? teHalf.slice(1) : [...resample([leHalf[leHalf.length - 1], teHalf[0]], SAMPLE).slice(1, -1), ...teHalf])];
  // The root points on the root line of the parting plane, where the outline is mirrored.
  half[0] = [half[0][0], yR];
  half[half.length - 1] = [half[half.length - 1][0], yR];
  const mirrored = half
    .slice(1, -1)
    .reverse()
    .map((P) => [P[0], 2 * yR - P[1]]);
  // A root with zero chord would repeat a point; a wing has a root chord.
  const poly = [...half, ...mirrored];
  // Seen from above, each cavity lies between the leading-edge and the trailing-edge line. A twisted
  // section reaches beyond them (its nose turns ahead of the leading-edge point): up to MOLD_OVERHANG
  // that is a current limitation, beyond it one half would be undercut and the faces would cross.
  let overhang = 0;
  for (let k = 0; k <= 60; k++) {
    const v = k / 60;
    const xL = curvePoint(le, v)[0];
    const xT = Math.max(curvePoint(teL, v)[0], curvePoint(teU, v)[0]);
    for (const S of [SL, SU]) {
      for (let j = 0; j <= 120; j++) {
        const x = surfacePoint(S, j / 120, v)[0];
        overhang = Math.max(overhang, xL - x, x - xT);
      }
    }
  }
  if (overhang > MOLD_OVERHANG) {
    return fail(
      tr('Mold: seen from above, the airfoil reaches {reach} mm beyond the leading-edge or trailing-edge line (twisted sections), more than {limit} mm: one mold half would be undercut. Reduce the twist.', {
        reach: fixed(overhang, 2),
        limit: plain(MOLD_OVERHANG),
      }),
    );
  }
  // The margin (at least 5 mm) holds the reach of at most MOLD_OVERHANG.
  // Loops, not Math.min(...list): a long outline has more points than a call takes arguments.
  let xMin = Infinity;
  let xMax = -Infinity;
  let yMax = -Infinity;
  for (const P of half) {
    xMin = Math.min(xMin, P[0]);
    xMax = Math.max(xMax, P[0]);
    yMax = Math.max(yMax, P[1]);
  }
  const block = { x0: xMin - p.margin, x1: xMax + p.margin, y0: yR, y1: yMax + p.margin };
  const grid = new SegmentGrid(poly, 2);

  // Resin channel.
  const r = p.channel.diameter / 2;
  const reach = p.channel.on ? p.channel.distance + 2 * r : w;
  if (p.margin < reach + MOLD_CLEARANCE) {
    return fail(
      p.channel.on
        ? tr('Mold: the block margin must be at least {min} mm for the resin channel (distance, diameter and {gap} mm to the block edge).', { min: plain(Math.ceil((reach + MOLD_CLEARANCE) * 100) / 100), gap: plain(MOLD_CLEARANCE) })
        : tr('Mold: the block margin must be at least {min} mm, the ramp width plus {gap} mm.', { min: plain(Math.ceil((reach + MOLD_CLEARANCE) * 100) / 100), gap: plain(MOLD_CLEARANCE) }),
    );
  }
  let channel = null;
  if (p.channel.on) {
    const dc = p.channel.distance + r;
    const rho = 2 * r + 2;
    const path = upperHalf(offsetOutline(poly, dc, rho, grid), yR);
    if (!path || path.length < 4) return fail(tr('Mold: the path of the resin channel around the wing could not be built; change its distance.'));
    for (const P of path) {
      if (P[0] - r < block.x0 + MOLD_CLEARANCE || P[0] + r > block.x1 - MOLD_CLEARANCE || P[1] + r > block.y1 - MOLD_CLEARANCE) {
        return fail(tr('Mold: the resin channel leaves the block; increase the block margin or reduce the distance of the resin channel.'));
      }
    }
    // The ends of the groove lie in the root plane, which leans one way in the lower half and the
    // other way in the mirrored upper half.
    const lower = grooveSurface(path, r, zp, yR, slope);
    channel = { lower, upper: slope === 0 ? lower : grooveSurface(path, r, zp, yR, -slope), path, radius: r, length: lower.length, stations: lower.stations };
  }

  // Block heights: the floor below the deepest point of each cavity.
  // Over the control points, which bound the surface; a loop, as a fine loft has several 100,000 of them.
  let zMinL = zp;
  let zMaxU = zp;
  for (const row of SL.points) for (const P of row) zMinL = Math.min(zMinL, P[2]);
  for (const row of SU.points) for (const P of row) zMaxU = Math.max(zMaxU, P[2]);
  // The floor lies below the deepest point of the half: its cavity or, where that is shallower, the groove.
  const groove = p.channel.on ? r : 0;
  const thickness = { lower: Math.max(zp - zMinL, groove) + p.floor, upper: Math.max(zMaxU - zp, groove) + p.floor };
  // The root face leans by the roll: holes keep clear of it over the whole height of both halves.
  const holeY0 = yR + Math.abs(slope) * Math.max(thickness.lower, thickness.upper);
  // The leaning root face must stay inboard of the tip-side face over the whole height of both halves.
  if (holeY0 > block.y1 - p.margin) {
    return fail(
      tr('Mold: the root face leans {roll}° with the dihedral and reaches the wing tip within the {thickness} mm of the thicker half; reduce the floor thickness.', {
        roll: fixed(Math.abs(roll), 1),
        thickness: fixed(Math.max(thickness.lower, thickness.upper), 1),
      }),
    );
  }

  // Holes.
  const keepOut = (p.channel.on ? p.channel.distance + 2 * r : w) + MOLD_CLEARANCE;
  const holes = [];
  const dropped = { pins: 0, screws: 0 };
  for (const kind of ['pins', 'screws']) {
    const h = p[kind];
    if (!h.on) continue;
    const rh = h.diameter / 2;
    let centres = [];
    if (h.pattern === 'corners' || h.pattern === 'frame') {
      const e = h.edge;
      const c = [
        [block.x0 + e, holeY0 + e],
        [block.x0 + e, block.y1 - e],
        [block.x1 - e, block.y1 - e],
        [block.x1 - e, holeY0 + e],
      ];
      if (h.pattern === 'corners') centres = c;
      else {
        for (let s = 0; s < 3; s++) {
          const a = c[s];
          const b = c[s + 1];
          const parts = Math.max(1, Math.ceil(len(sub(b, a)) / h.spacing));
          for (let k = s === 0 ? 0 : 1; k <= parts; k++) centres.push([a[0] + ((b[0] - a[0]) * k) / parts, a[1] + ((b[1] - a[1]) * k) / parts]);
        }
      }
    } else {
      const dist = keepOut - MOLD_CLEARANCE + h.offset;
      const path = upperHalf(offsetOutline(poly, dist, 2 * rh + 2, grid), yR);
      if (path && path.length > 1) {
        const s = [0];
        for (let i = 1; i < path.length; i++) s.push(s[i - 1] + len(sub(path[i], path[i - 1])));
        const total = s[s.length - 1];
        const count = Math.max(1, Math.round(total / h.spacing));
        let j = 0;
        for (let k = 0; k < count; k++) {
          const target = ((k + 0.5) * total) / count;
          while (s[j + 1] < target) j++;
          const f = (target - s[j]) / (s[j + 1] - s[j] || 1);
          centres.push([path[j][0] + f * (path[j + 1][0] - path[j][0]), path[j][1] + f * (path[j + 1][1] - path[j][1])]);
        }
      }
    }
    for (const c of centres) {
      const edge = rh + MOLD_CLEARANCE;
      const inside = c[0] - edge >= block.x0 && c[0] + edge <= block.x1 && c[1] - edge >= holeY0 && c[1] + edge <= block.y1;
      const need = keepOut + rh;
      // Outside the wing outline, and far enough from it: the distance alone also holds deep inside the cavity.
      const clear = !insidePolygon(poly, c) && grid.distance(c, need) >= need - 1e-9;
      const apart = holes.every((o) => len(sub(o.centre, c)) >= o.radius + rh + MOLD_CLEARANCE);
      // A position that already holds a hole (pins and screws with the same pattern) is no loss.
      const taken = holes.some((o) => len(sub(o.centre, c)) < 1e-6);
      if (inside && clear && apart) holes.push({ kind, centre: c, radius: rh, depth: kind === 'pins' ? h.depth : null });
      else if (!taken) dropped[kind]++;
    }
  }
  if (dropped.pins) warnings.push(tr('Mold: {n} pin hole(s) left out: too close to the cavity, the resin channel, a block edge or another hole.', { n: plain(dropped.pins) }));
  if (dropped.screws) warnings.push(tr('Mold: {n} screw hole(s) left out: too close to the cavity, the resin channel, a block edge or another hole.', { n: plain(dropped.screws) }));
  if (p.pins.on && holes.some((h) => h.kind === 'pins') && p.pins.depth > Math.min(thickness.lower, thickness.upper) - MOLD_CLEARANCE) {
    return fail(
      tr('Mold: the pin holes are {depth} mm deep, but the thinner half is {thickness} mm thick; reduce the depth or increase the floor thickness.', {
        depth: plain(p.pins.depth),
        thickness: fixed(Math.min(thickness.lower, thickness.upper), 1),
      }),
    );
  }

  // The halves in the frame of the lower half: the upper one mirrored at the parting plane.
  const mz = mirrorZ(zp);
  const half3 = (cavity, edgeTE, upper) => ({
    upper,
    cavity,
    le: upper ? mapCurve(le, mz) : le,
    mid: upper ? mapCurve(mid, mz) : mid,
    meanLine: meanLine && upper ? mapCurve(meanLine, mz) : meanLine,
    te: edgeTE,
    thickness: upper ? thickness.upper : thickness.lower,
    // The root plane of the half: y = yR + slope · (z − zp).
    slope: upper ? -slope : slope,
    channel: channel ? (upper ? channel.upper : channel.lower) : null,
  });
  const upperCavity = mapSurface(reverseU(SU), mz);
  const halves = {
    lower: half3(SL, teL, false),
    upper: half3(upperCavity, surfaceBoundaryU(upperCavity, true), true),
  };
  const common = { zp, block, pole, closed, ramp: { width: w, aLE, aTE }, holes, roll };

  const sampleCurve3 = (c, count = 200) => Array.from({ length: count + 1 }, (_, k) => curvePoint(c, k / count)).map((P) => [P[0], P[1]]);
  const preview = {
    block,
    outline: half,
    ramp: pole ? [...sampleCurve3(aLE), ...sampleCurve3(aTE).reverse()] : [...sampleCurve3(aLE), [curvePoint(le, 1)[0], y1 + w], [curvePoint(mid, 1)[0], y1 + w], ...sampleCurve3(aTE).reverse()],
    holeY0,
    channel: channel ? { path: channel.path, radius: r } : null,
    holes: holes.map((h) => ({ kind: h.kind, x: h.centre[0], y: h.centre[1], radius: h.radius })),
  };
  const summary = {
    length: block.x1 - block.x0,
    width: block.y1 - block.y0,
    lower: thickness.lower,
    upper: thickness.upper,
    roll,
    rampHeight,
    rampSlope: slopeDeg,
    pins: holes.filter((h) => h.kind === 'pins').length,
    screws: holes.filter((h) => h.kind === 'screws').length,
    channelLength: channel ? channel.length : 0,
    edgeRange: [zLo - zp, zHi - zp],
    // Volume of both halves without the cavity: blocks (the root face leans by the roll), less the
    // resin channel and the holes.
    blockVolume:
      (block.x1 - block.x0) * ((block.y1 - yR) * (thickness.lower + thickness.upper) + (slope * (thickness.lower ** 2 - thickness.upper ** 2)) / 2) -
      (channel ? Math.PI * r * r * channel.length : 0) -
      holes.reduce((s, h) => s + Math.PI * h.radius ** 2 * (h.depth === null ? thickness.lower + thickness.upper : 2 * h.depth), 0),
  };
  return { errors: [], warnings, params: p, common, halves, preview, summary };
}

/**
 * The half-round groove along `path` (plane points, from the root on the leading-edge side to the root
 * on the trailing-edge side) as a B-spline surface below the plane z = zp: u across the groove from
 * the rim next to the wing (0) over the bottom to the outer rim (1), v along the path. Both rims lie
 * in the plane, both ends in the root plane y = y0 + slope · (z − zp).
 */
export function grooveSurface(path, r, zp, y0, slope = 0) {
  // Stations: closer together where the path curves.
  const fine = resample(path, 0.5);
  const s = [0];
  for (let i = 1; i < fine.length; i++) s.push(s[i - 1] + len(sub(fine[i], fine[i - 1])));
  const total = s[s.length - 1];
  const stride = 2;
  const radiusAt = (i) => {
    const a = fine[Math.max(0, i - stride)];
    const b = fine[i];
    const c = fine[Math.min(fine.length - 1, i + stride)];
    const ab = len(sub(b, a));
    const bc = len(sub(c, b));
    const ac = len(sub(c, a));
    const area = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
    return area > 1e-12 ? (ab * bc * ac) / (2 * area) : Infinity;
  };
  // Step at each point: the chord error on the centre line sets it where the path curves; it grows by
  // at most GROOVE_GRADING of the distance from a curved part, so that the stations close up before
  // a bend (long steps next to a bend let the interpolating spline overshoot the tube).
  const H = fine.map((_, i) => Math.min(GROOVE_STEP, Math.max(0.5, Math.sqrt(8 * GROOVE_TOLERANCE * radiusAt(i)))));
  for (let i = 1; i < H.length; i++) H[i] = Math.min(H[i], H[i - 1] + GROOVE_GRADING * (s[i] - s[i - 1]));
  for (let i = H.length - 2; i >= 0; i--) H[i] = Math.min(H[i], H[i + 1] + GROOVE_GRADING * (s[i + 1] - s[i]));
  const idx = [0];
  let at = 0;
  while (at < fine.length - 1) {
    const step = H[at];
    let next = at + 1;
    while (next < fine.length - 1 && s[next] - s[at] < step) next++;
    // The last station is the end of the path: no short last step.
    if (fine.length - 1 - next < 2) next = fine.length - 1;
    idx.push(next);
    at = next;
  }
  const centres = idx.map((i) => fine[i]);
  const params = idx.map((i) => s[i] / total);
  // Normal to the outside (to the left of the path direction: the path runs clockwise around the wing).
  const normals = idx.map((i, k) => {
    if (k === 0) return [-1, 0];
    if (k === idx.length - 1) return [1, 0];
    const t = unit(sub(fine[Math.min(fine.length - 1, i + stride)], fine[Math.max(0, i - stride)]));
    return [-t[1], t[0]];
  });
  const Q = [];
  const paramsU = [];
  for (let a = 0; a < GROOVE_POINTS; a++) {
    const phi = (Math.PI * a) / (GROOVE_POINTS - 1);
    paramsU.push(a / (GROOVE_POINTS - 1));
    const last = centres.length - 1;
    // The end stations lie in the root plane y = y0 + slope · (z − zp).
    Q.push(centres.map((C, k) => [C[0] - r * Math.cos(phi) * normals[k][0], k === 0 || k === last ? y0 - slope * r * Math.sin(phi) : C[1] - r * Math.cos(phi) * normals[k][1], zp - r * Math.sin(phi)]));
  }
  const surface = interpolateSurface(Q, 3, 3, paramsU, params, { knotsU: averagingKnots(paramsU, 3), knotsV: averagingKnots(params, Math.min(3, params.length - 1)) });
  const nu = surface.points.length - 1;
  const nv = surface.points[0].length - 1;
  for (let j = 0; j <= nv; j++) {
    surface.points[0][j][2] = zp;
    surface.points[nu][j][2] = zp;
  }
  for (let i = 0; i <= nu; i++) {
    for (const P of [surface.points[i][0], surface.points[i][nv]]) P[1] = y0 + slope * (P[2] - zp);
  }
  return {
    surface,
    length: total,
    stations: centres.length,
    rimInner: surfaceBoundaryU(surface, false),
    rimOuter: surfaceBoundaryU(surface, true),
    endStart: surfaceBoundaryV(surface, false),
    endEnd: surfaceBoundaryV(surface, true),
  };
}
