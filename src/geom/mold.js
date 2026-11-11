// Mold halves of the half wing: a lower and an upper block that part along the leading edge and the
// trailing edge, each with the wing surface of its side as cavity.
//
// Frame: the frame the half wing is built in (x aft, y span, z up), before the rigid placement of the
// part, rolled about x by the dihedral of the wing (`roll`: the roll of a flat tip section, else the
// slope of the line fitted to leading edge and trailing edge), so that the wing lies flat. The root
// section stays in its plane, which leans by the roll: y = yR + tan(roll) · (z − zp), zp the mean
// height of leading edge and trailing edge.
//
// Parting surface: one surface over the whole block that holds the real parting lines, the leading
// edge and the middle of the trailing edge, and is level along x, the flight direction: ahead of the
// wing it lies at the height of the leading edge of that span station, behind the wing at the height
// of the trailing edge; beyond the tip it keeps the heights of the tip. It follows twist and dihedral
// along the span and never tilts along x outside the wing. A flat tip face is parted along the mean
// line of the tip section; a strip of TIP_STRIP mm joins the mean line to the parting surface beyond
// the tip. The cavity is open at the root: the root section lies in the root face of the block.
//
// On the parting surface, laid out as seen from above:
//   channel    the resin channel (German: Blutrinne): a groove of half-round cross-section in each
//              half, so that the closed mold has a round channel. Its centre line is the wing outline,
//              mirrored at the root, offset by distance + radius, with every inward corner rounded
//              (offset outward by more, then back), so that it crosses the root face square to it.
//   pins       blind holes in both halves for alignment pins
//   screws     through holes in both halves for clamping screws
// Hole patterns: the four corners of the block, a frame along the block edges, or along the wing
// outline, at a largest spacing.
//
// moldGeometry returns the geometry of both halves in the frame of the lower half: the upper half is
// described as its mirror image at the plane z = zp, so that one construction writes both
// (src/export/moldstep.js). The file has the plane z = zp at z = 0.

import { averagingKnots, curvePoint, insertKnotCurve, interpolateCurve, interpolateSurface, splitSurfaceU, surfaceBoundaryU, surfaceBoundaryV, surfacePoint } from './nurbs.js';
import { roundTipStart } from './tipblend.js';
import { joinCurves } from './wing.js';
import { fixed, plain, tr } from '../i18n/index.js';

const DEG = Math.PI / 180;

export const HOLE_PATTERNS = Object.freeze(['corners', 'frame', 'outline']);
export const MOLD_HALVES = Object.freeze(['both', 'lower', 'upper']);

/** Starting values (lengths in mm). */
export const MOLD_DEFAULTS = Object.freeze({
  margin: 40,
  floor: 12,
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
/** Spacing of the outline samples (mm) and the tolerance of the offset test. */
const SAMPLE = 0.25;
const OFFSET_EPS = 0.02;
/** Points across the half-round groove, and the largest step along it (mm). */
const GROOVE_POINTS = 9;
const GROOVE_STEP = 8;
/** Largest height (mm) by which the rims of the groove may miss the parting surface before the stations close up. */
const GROOVE_FIT = 1e-6;
/** Largest miss (mm) of the rims of the resin channel from the parting surface that a mold is built with. */
export const GROOVE_FIT_LIMIT = 0.01;
/** Span distance (mm) from the root over which the path of the resin channel moves onto the root line of the parting surface. */
const ROOT_BLEND = 20;
/** Distance (mm) a skewed groove station may leave the tube where the path curves. */
const GROOVE_SKEW_ERROR = 0.01;
/** Largest skew of a groove station onto a crease: the tangent of the crossing angle (71.6°). */
const CREASE_SKEW = 3;
/** Points per half turn of the mouth of a hole. */
const HOLE_POINTS = 64;
/** Width (mm) of the strip beyond a flat tip face, at most half the distance of the resin channel. */
const TIP_STRIP = 3;
/** Grid (along x, along the span) of the fold test of a parting surface. */
const FOLD_GRID = Object.freeze([40, 400]);
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
// The wing: edges, outline, parting surface.

const mirrorZ = (zp) => (P) => [P[0], P[1], 2 * zp - P[2]];
const mapCurve = (c, f) => ({ ...c, points: c.points.map(f) });
const mapSurface = (s, f) => ({ ...s, points: s.points.map((row) => row.map(f)) });

/** The surface with u reversed (u' = 1 − u). */
function reverseU(s) {
  const a = s.knotsU[0];
  const b = s.knotsU[s.knotsU.length - 1];
  return { ...s, knotsU: s.knotsU.map((k) => a + b - k).reverse(), points: s.points.slice().reverse() };
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
  // rulings of the parting surface; else the slope of the line fitted to leading edge and trailing edge.
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

  // Reference height zp (z = 0 in the file): the mean height of leading edge and trailing edge.
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
  // The root line at the height zp.
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

  // Outline in the top view, clockwise seen from above, mirrored at the root.
  const dense = (c, from, to, count) => Array.from({ length: count + 1 }, (_, k) => curvePoint(c, from + ((to - from) * k) / count)).map((P) => [P[0], P[1]]);
  const leHalf = resample(dense(le, 0, 1, 4000), SAMPLE);
  const teHalf = resample(dense(mid, 1, 0, 4000), SAMPLE);
  // A flat tip adds the edge of the tip face, sampled like the rest.
  const half = [...leHalf, ...(pole ? teHalf.slice(1) : [...resample([leHalf[leHalf.length - 1], teHalf[0]], SAMPLE).slice(1, -1), ...teHalf])];
  // The root points on the root line, where the outline is mirrored.
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

  // Parting surface: level along x at the height of the leading edge ahead of the wing and of the
  // trailing edge behind it; beyond a flat tip it keeps the heights of the tip.
  // Around a tip that closes in a point the level lines turn with the tip: from x at the start of the
  // rounded tip to y at the point, with the angle of the tip ellipse, which the span parameter follows.
  const ys = build.sections.map((q) => q.y);
  const tipStart = pole ? roundTipStart(build.sections, build.settings) : -1;
  const vF = pole ? build.vAt(tipStart >= 0 ? ys[tipStart] : ys[ys.length - 2]) : 1;
  const psi = (v) => {
    if (v <= vF) return 0;
    const th = (Math.min(1, (v - vF) / (1 - vF)) * Math.PI) / 2;
    return th - Math.sin(2 * th) / 2;
  };
  const parting = pole ? fanParting(le, mid, block, psi) : partingSurface(le, mid, block, true);
  if (parting.surfaces.some(foldsInTopView)) {
    return fail(tr('Mold: seen from above, the parting surface folds over itself beside the wing (a strongly swept tip that closes in a point); reduce the sweep of the tip or use a flat tip.'));
  }
  const height = (x, y) => parting.at(x, y)[2];
  const mz = mirrorZ(zp);
  // The same surface in the frame of the upper half, mirrored at z = zp.
  const upperSide = { surfaces: parting.surfaces.map((q) => mapSurface(q, mz)), height: (x, y) => 2 * zp - height(x, y), root: (x) => mz(parting.root(x)), creases: parting.creases };
  const lowerSide = { surfaces: parting.surfaces, height, root: parting.root, creases: parting.creases };

  // Resin channel.
  const r = p.channel.diameter / 2;
  const reach = p.channel.on ? p.channel.distance + 2 * r : 0;
  if (p.channel.on && p.margin < reach + MOLD_CLEARANCE) {
    return fail(tr('Mold: the block margin must be at least {min} mm for the resin channel (distance, diameter and {gap} mm to the block edge).', { min: plain(Math.ceil((reach + MOLD_CLEARANCE) * 100) / 100), gap: plain(MOLD_CLEARANCE) }));
  }
  let channel = null;
  if (p.channel.on) {
    const dc = p.channel.distance + r;
    const rho = 2 * r + 2;
    const flat = upperHalf(offsetOutline(poly, dc, rho, grid), yR);
    if (!flat || flat.length < 4) return fail(tr('Mold: the path of the resin channel around the wing could not be built; change its distance.'));
    // The offset ends on the line y = yR; the root ruling of the parting surface lies up to
    // tan(roll) · its height off that line. Within ROOT_BLEND of the root the path moves over to it.
    const path = flat.map((P) => {
      const d = (P[1] - yR) / ROOT_BLEND;
      if (d >= 1) return P;
      const t = Math.max(0, d);
      return [P[0], P[1] + (parting.root(P[0])[1] - yR) * (1 - t * t * (3 - 2 * t))];
    });
    for (const P of path) {
      if (P[0] - r < block.x0 + MOLD_CLEARANCE || P[0] + r > block.x1 - MOLD_CLEARANCE || P[1] + r > block.y1 - MOLD_CLEARANCE) {
        return fail(tr('Mold: the resin channel leaves the block; increase the block margin or reduce the distance of the resin channel.'));
      }
    }
    // The rims are fitted through the stations of the groove and lie on the parting surface within
    // GROOVE_FIT; closer stations where a first fit leaves more.
    // Halving the step stops at GROOVE_FIT, or where it no longer halves the miss.
    const fitted = (side) => {
      let best = null;
      for (let step = GROOVE_STEP; step >= 1; step /= 2) {
        const g = grooveSurface(path, r, { ...side, zp, yR, slope: side === lowerSide ? slope : -slope }, step);
        let dev = 0;
        for (const rim of [g.rimInner, g.rimOuter]) {
          for (let k = 1; k < 4 * g.stations; k++) {
            const P = curvePoint(rim, k / (4 * g.stations));
            dev = Math.max(dev, Math.abs(P[2] - side.height(P[0], P[1])));
          }
        }
        g.fit = dev;
        const gain = best ? best.fit / dev : Infinity;
        if (!best || dev < best.fit) best = g;
        if (best.fit <= GROOVE_FIT || gain < 2) break;
      }
      return best;
    };
    const lower = fitted(lowerSide);
    channel = { lower, upper: fitted(upperSide), path, radius: r, length: lower.length, stations: lower.stations };
    const miss = Math.max(channel.lower.fit, channel.upper.fit);
    if (miss > GROOVE_FIT_LIMIT) {
      return fail(
        tr('Mold: the rims of the resin channel miss the parting surface by {miss} mm, more than {limit} mm; reduce the diameter of the resin channel or change its distance.', {
          miss: fixed(miss, 3),
          limit: plain(GROOVE_FIT_LIMIT),
        }),
      );
    }
  }

  // Block heights: the floor below the deepest point of each half: its cavity, the parting surface at
  // the block faces, or the groove of the resin channel in it. Over the control points, which bound
  // the surfaces; loops, as a fine loft has several 100,000 of them.
  let zMinL = zp;
  let zMaxU = zp;
  for (const row of SL.points) for (const P of row) zMinL = Math.min(zMinL, P[2]);
  for (const row of SU.points) for (const P of row) zMaxU = Math.max(zMaxU, P[2]);
  const groove = p.channel.on ? r : 0;
  let sLo = Infinity;
  let sHi = -Infinity;
  for (const surface of parting.surfaces) {
    for (const row of surface.points) {
      for (const P of row) {
        sLo = Math.min(sLo, P[2]);
        sHi = Math.max(sHi, P[2]);
      }
    }
  }
  const thickness = { lower: Math.max(zp - zMinL, zp - sLo + groove) + p.floor, upper: Math.max(zMaxU - zp, sHi - zp + groove) + p.floor };
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
  const keepOut = (p.channel.on ? p.channel.distance + 2 * r : 0) + MOLD_CLEARANCE;
  const stripWidth = pole ? 0 : Math.min(TIP_STRIP, (p.channel.on ? p.channel.distance : p.margin) / 2);
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
      // Beyond a flat tip the strip to the mean line of the tip face takes no hole either.
      const need = Math.max(keepOut, stripWidth + MOLD_CLEARANCE) + rh;
      // Outside the wing outline, and far enough from it: the distance alone also holds deep inside the cavity.
      const clear = !insidePolygon(poly, c) && grid.distance(c, need) >= need - 1e-9;
      const apart = holes.every((o) => len(sub(o.centre, c)) >= o.radius + rh + MOLD_CLEARANCE);
      // A position that already holds a hole (pins and screws with the same pattern) is no loss.
      const taken = holes.some((o) => len(sub(o.centre, c)) < 1e-6);
      // A hole lies on one of the two surfaces around a tip that closes in a point, not across their seam.
      const onSeam = parting.seam && c[1] + edge > parting.seam.y && Math.abs(c[0] - parting.seam.x) < edge;
      if (inside && clear && apart && !onSeam) holes.push({ kind, centre: c, radius: rh, depth: kind === 'pins' ? h.depth : null, patch: pole ? parting.at(c[0], c[1])[3] : 0 });
      else if (!taken) dropped[kind]++;
    }
  }
  if (dropped.pins) warnings.push(tr('Mold: {n} pin hole(s) left out: too close to the cavity, the resin channel, a block edge or another hole.', { n: plain(dropped.pins) }));
  if (dropped.screws) warnings.push(tr('Mold: {n} screw hole(s) left out: too close to the cavity, the resin channel, a block edge or another hole.', { n: plain(dropped.screws) }));
  // The mouth of a hole on the parting surface: two half turns about the axis, fitted through points
  // on the cylinder at the height of the surface; the bottom of a pin hole lies `depth` below the
  // lowest point of its mouth, a screw hole runs through.
  const holeOn = (h, side) => {
    const arc = (from) => {
      const at = (th) => {
        const x = h.centre[0] + h.radius * Math.cos(th);
        const y = h.centre[1] + h.radius * Math.sin(th);
        return [x, y, side.height(x, y)];
      };
      // The mouth breaks where it crosses a crease of the parting surface.
      const cuts = creaseCrossings(side.creases, at, from, from + Math.PI, HOLE_POINTS);
      const curve = fitInPieces(at, from, from + Math.PI, cuts, HOLE_POINTS);
      let low = Infinity;
      for (let k = 0; k <= HOLE_POINTS; k++) low = Math.min(low, at(from + (Math.PI * k) / HOLE_POINTS)[2]);
      // The largest miss of the fitted mouth from the surface, measured between the fitted points.
      let miss = 0;
      for (let k = 0; k <= 8 * HOLE_POINTS; k++) {
        const q = curvePoint(curve, k / (8 * HOLE_POINTS));
        miss = Math.max(miss, Math.abs(q[2] - side.height(q[0], q[1])));
      }
      return { curve, low, miss };
    };
    const a1 = arc(0);
    const a2 = arc(Math.PI);
    const low = Math.min(a1.low, a2.low);
    return { kind: h.kind, patch: h.patch, centre: h.centre, radius: h.radius, arcs: [a1.curve, a2.curve], fit: Math.max(a1.miss, a2.miss), bottom: h.depth === null ? null : low - h.depth, centreZ: side.height(h.centre[0], h.centre[1]) };
  };
  const lowerHoles = holes.map((h) => holeOn(h, lowerSide));
  const upperHoles = holes.map((h) => holeOn(h, upperSide));
  for (const [list, t] of [[lowerHoles, thickness.lower], [upperHoles, thickness.upper]]) {
    const deepest = Math.min(Infinity, ...list.filter((h) => h.bottom !== null).map((h) => h.bottom));
    if (deepest < zp - t + MOLD_CLEARANCE) {
      return fail(
        tr('Mold: the pin holes are {depth} mm deep and reach within {gap} mm of the outer face of a half; reduce the depth or increase the floor thickness.', {
          depth: plain(p.pins.depth),
          gap: plain(MOLD_CLEARANCE),
        }),
      );
    }
  }

  // The halves in the frame of the lower half: the upper one mirrored at the plane z = zp.
  // A flat tip face is parted along its mean line; a strip joins the mean line to the parting surface
  // beyond the tip.
  const strip = pole ? null : tipStrip(meanLine, stripWidth);
  const half3 = (cavity, edgeTE, upper) => ({
    upper,
    cavity,
    le: upper ? mapCurve(le, mz) : le,
    mid: upper ? mapCurve(mid, mz) : mid,
    meanLine: meanLine && upper ? mapCurve(meanLine, mz) : meanLine,
    strip: strip && upper ? mapCurve(strip, mz) : strip,
    te: edgeTE,
    thickness: upper ? thickness.upper : thickness.lower,
    // The root plane of the half: y = yR + slope · (z − zp).
    slope: upper ? -slope : slope,
    // The parting surface: one surface with a flat tip; with a tip that closes in a point the surface
    // ahead of the leading edge and the one behind the trailing edge, with the parameters where their
    // outer edges turn the corners of the block.
    parting: pole
      ? { kind: 'pole', front: (upper ? upperSide : lowerSide).surfaces[0], back: (upper ? upperSide : lowerSide).surfaces[1], frontCorner: parting.front.corner, backCorner: parting.back.corner }
      : { kind: 'flat', surface: (upper ? upperSide : lowerSide).surfaces[0] },
    channel: channel ? (upper ? channel.upper : channel.lower) : null,
    holes: upper ? upperHoles : lowerHoles,
  });
  const upperCavity = mapSurface(reverseU(SU), mz);
  const halves = {
    lower: half3(SL, teL, false),
    upper: half3(upperCavity, surfaceBoundaryU(upperCavity, true), true),
  };
  const common = { zp, block, pole, closed, holes, roll };

  // Extent of each half along z about the plane z = zp: from its block face to the highest (lower
  // half) or lowest (upper half) point of the parting surface and of its cavity.
  let top = sHi;
  let bottom = sLo;
  for (let i = 0; i <= 200; i++) {
    for (let j = 0; j <= 60; j++) {
      top = Math.max(top, surfacePoint(SL, i / 200, j / 60)[2]);
      bottom = Math.min(bottom, surfacePoint(SU, i / 200, j / 60)[2]);
    }
  }
  const preview = {
    block,
    outline: half,
    holeY0,
    channel: channel ? { path: channel.path, radius: r } : null,
    holes: holes.map((h) => ({ kind: h.kind, x: h.centre[0], y: h.centre[1], radius: h.radius })),
  };
  const through = thickness.lower + thickness.upper;
  const summary = {
    length: block.x1 - block.x0,
    width: block.y1 - block.y0,
    lower: thickness.lower,
    upper: thickness.upper,
    roll,
    // Height of the parting surface at the block faces, and of leading edge and trailing edge, about z = zp.
    partingRange: [sLo - zp, sHi - zp],
    edgeRange: [zLo - zp, zHi - zp],
    extent: { lower: [-thickness.lower, top - zp], upper: [bottom - zp, thickness.upper] },
    // Largest height (mm) by which the rims of the groove miss the parting surface (leading edge and
    // trailing edge are lines of the surface).
    fit: Math.max(0, ...(channel ? [channel.lower.fit, channel.upper.fit] : []), ...lowerHoles.map((h) => h.fit), ...upperHoles.map((h) => h.fit)),
    pins: holes.filter((h) => h.kind === 'pins').length,
    screws: holes.filter((h) => h.kind === 'screws').length,
    channelLength: channel ? channel.length : 0,
    // Volume of both halves without the cavity: the slab between the two block faces (the root face
    // leans by the roll), less the resin channel and the holes. A pin hole runs from its bottom in the
    // lower half to its bottom in the upper half.
    blockVolume:
      (block.x1 - block.x0) * ((block.y1 - yR) * through + (slope * (thickness.lower ** 2 - thickness.upper ** 2)) / 2) -
      (channel ? Math.PI * r * r * channel.length : 0) -
      holes.reduce((sum, h, i) => sum + Math.PI * h.radius ** 2 * (h.depth === null ? through : 2 * zp - upperHoles[i].bottom - lowerHoles[i].bottom), 0),
  };
  return { errors: [], warnings, params: p, common, halves, preview, summary };
}

/**
 * The parting surface over the block. It holds the leading edge and the middle of the trailing edge
 * and is level along x, the flight direction: ahead of the wing it lies at the height of the leading
 * edge of that span station, behind the wing at the height of the trailing edge. Its 4 rows along x
 * are the leading edge moved into the front face (x = x0), the leading edge, the trailing edge, and
 * the trailing edge moved into the back face (x = x1), joined by straight lines (degree 1); along the
 * span it has the knots of the wing. Beyond the tip every row runs straight along y to the tip-side
 * face, at the height it has at the tip. The part between leading edge and trailing edge spans the
 * chord lines and lies in the opening of the cavity.
 * Returns the surface (u along x: 0, 1/3, 2/3, 1 at the 4 rows; v along the span, the tip at tipV),
 * `at(x, y)` (the point of the surface above (x, y)), `root(x)` (the point of the root line at x) and
 * the creases: the lines where the surface may bend.
 */
export function partingSurface(le, mid, block, flatTip = false) {
  const { x0, x1, y1 } = block;
  const p = le.degree;
  const last = le.points.length - 1;
  // A row beyond the tip: from its tip point straight along y, as a piece of the degree of the wing.
  const extended = (c, shift) => {
    const tip = shift(c.points[last]);
    const piece = { degree: p, knots: [...Array(p + 1).fill(1), ...Array(p + 1).fill(2)], points: Array.from({ length: p + 1 }, (_, j) => [tip[0], tip[1] + ((y1 - tip[1]) * j) / p, tip[2]]) };
    const joined = joinCurves([{ degree: p, knots: c.knots.slice(), points: c.points.map(shift) }, piece]);
    return { degree: p, knots: joined.knots.map((t) => t / 2), points: joined.points };
  };
  const same = (P) => P.slice();
  const rows = [extended(le, (P) => [x0, P[1], P[2]]), extended(le, same), extended(mid, same), extended(mid, (P) => [x1, P[1], P[2]])];
  const surface = { degreeU: 1, degreeV: p, knotsU: [0, 0, 1 / 3, 2 / 3, 1, 1], knotsV: rows[0].knots, points: rows.map((c) => c.points) };
  const [front, back] = [rows[1], rows[2]];
  // The point above x on the line of the station v: level ahead of the leading edge L and behind the
  // trailing edge T, on the chord line between them.
  const onStation = (L, T, x) => {
    if (x <= L[0]) return [x, L[1], L[2], (x - x0) / (3 * (L[0] - x0) || 1)];
    if (x >= T[0]) return [x, T[1], T[2], 2 / 3 + (x - T[0]) / (3 * (x1 - T[0]) || 1)];
    const t = (x - L[0]) / (T[0] - L[0]);
    return [x, L[1] + t * (T[1] - L[1]), L[2] + t * (T[2] - L[2]), (1 + t) / 3];
  };
  // v from a table of the two edges, then secant steps inside the bracket (y grows with v along every
  // line x = const).
  const N = 1024;
  const table = Array.from({ length: N + 1 }, (_, k) => [curvePoint(front, k / N), curvePoint(back, k / N)]);
  const at = (x, y) => {
    const point = (v) => [...onStation(curvePoint(front, v), curvePoint(back, v), x), v];
    const yAt = (k) => onStation(table[k][0], table[k][1], x)[1];
    if (y <= yAt(0)) return point(0);
    if (y >= yAt(N)) return point(1);
    let i = 0;
    let j = N;
    while (j - i > 1) {
      const m = (i + j) >> 1;
      if (yAt(m) < y) i = m;
      else j = m;
    }
    let lo = i / N;
    let hi = j / N;
    let ylo = yAt(i);
    let yhi = yAt(j);
    let P = null;
    for (let it = 0; it < 40; it++) {
      // Secant inside the bracket, a bisection every third step.
      const v = it % 3 === 2 || !(yhi > ylo) ? (lo + hi) / 2 : lo + ((hi - lo) * (y - ylo)) / (yhi - ylo);
      P = point(v);
      if (Math.abs(P[1] - y) < 1e-11 || hi - lo < 1e-15) break;
      if (P[1] < y) {
        lo = v;
        ylo = P[1];
      } else {
        hi = v;
        yhi = P[1];
      }
    }
    return P;
  };
  const root = (x) => onStation(front.points[0], back.points[0], x).slice(0, 3);
  // Creases across the span: the stations where the wing may bend (sections: knots of the multiplicity
  // of the degree) and the tip. Seen from above each is the line of its station.
  const creases = [];
  const K = le.knots;
  for (let i = p + 1; i < K.length; i++) {
    if (K[i] === K[i - 1]) continue;
    let mult = 1;
    while (i + mult < K.length && K[i + mult] === K[i]) mult++;
    if (mult < p && K[i] !== K[K.length - 1]) continue;
    const L = curvePoint(le, K[i]);
    const T = curvePoint(mid, K[i]);
    creases.push({ side: (P) => P[1] - onStation(L, T, P[0])[1], along: [1, 0] });
  }
  // Creases along the span beyond a flat tip: the lines through its leading edge and its trailing edge,
  // between which the surface runs from the height of the one to the height of the other.
  if (flatTip) {
    for (const E of [le.points[last], mid.points[last]]) creases.push({ side: (P) => (P[1] > E[1] ? P[0] - E[0] : null), along: [0, 1] });
  }
  return { kind: 'flat', surface, surfaces: [surface], at, root, creases, seam: null };
}

/** Greville abscissae of a knot vector: one per control point. */
function greville(knots, p, count) {
  const out = [];
  for (let i = 0; i < count; i++) {
    let sum = 0;
    for (let k = 1; k <= p; k++) sum += knots[i + k];
    out.push(sum / p);
  }
  return out;
}

/**
 * The parting surface around a tip that closes in a point: two surfaces, one ahead of the leading edge
 * and one behind the trailing edge, each ruled from its edge to the block faces along level lines (z of
 * the edge point). Inboard of the tip the lines run along x, the flight direction; around the tip they
 * turn with it (`psi(v)`: 0 inboard, π/2 at the point), so that both surfaces meet in the line from the
 * point straight along y to the tip-side face (the seam). Level lines along x up to the point would
 * drop with an unbounded slope ahead of a twisted tip, where the edge runs square to them.
 * Each surface has the knots of the wing along the span, with a knot of full multiplicity where its
 * outer edge turns the corner of the block (`corner`).
 */
function fanParting(le, mid, block, psi) {
  const { x0, x1, y1 } = block;
  const p = le.degree;
  const patch = (edge, sign) => {
    const xf = sign < 0 ? x0 : x1;
    // End of the level line of the station v on the block: in the front or back face, or the tip-side face.
    const end = (v) => {
      const O = curvePoint(edge, v);
      const a = psi(v);
      const d = [sign * Math.cos(a), Math.sin(a)];
      const lx = Math.abs(d[0]) > 1e-12 ? (xf - O[0]) / d[0] : Infinity;
      const ly = d[1] > 1e-12 ? (y1 - O[1]) / d[1] : Infinity;
      return lx <= ly ? { P: [xf, O[1] + lx * d[1], O[2]], tipSide: false } : { P: [O[0] + ly * d[0], y1, O[2]], tipSide: true };
    };
    let lo = 0;
    let hi = 1;
    for (let it = 0; it < 60; it++) {
      const m = (lo + hi) / 2;
      if (end(m).tipSide) hi = m;
      else lo = m;
    }
    const corner = hi;
    const inner = insertKnotCurve(edge, corner, p);
    const sites = greville(inner.knots, p, inner.points.length);
    const k = sites.findIndex((v) => Math.abs(v - corner) < 1e-12);
    const fitted = interpolateCurve(sites.map((v, i) => (i === k ? [xf, y1, 0] : end(v).P)), p, { params: sites, knots: inner.knots });
    // The outer edge lies in the block faces and has the heights of the edge: every ruling is level.
    const outer = {
      degree: p,
      knots: inner.knots,
      points: fitted.points.map((P, i) => [i <= k ? xf : P[0], i >= k ? y1 : P[1], inner.points[i][2]]),
    };
    // Inboard of the tip (psi = 0 over the whole support of a control point) the rulings run along x.
    for (let i = 0; i < k; i++) if (psi(inner.knots[i + p + 1]) === 0) outer.points[i][1] = inner.points[i][1];
    // u along x: from the front face to the leading edge, and from the trailing edge to the back face.
    const rows = sign < 0 ? [outer.points, inner.points] : [inner.points, outer.points];
    const N = 512;
    const table = Array.from({ length: N + 1 }, (_, i) => [curvePoint(inner, i / N), curvePoint(outer, i / N)]);
    const cross = (O, R, x, y) => (R[0] - O[0]) * (y - O[1]) - (R[1] - O[1]) * (x - O[0]);
    const ahead = (O, R, x, y) => (R[0] - O[0]) * (x - O[0]) + (R[1] - O[1]) * (y - O[1]);
    // The station whose level line passes through (x, y), or null when the point lies on the other surface.
    const locate = (x, y) => {
      let prev = cross(table[0][0], table[0][1], x, y);
      for (let i = 1; i <= N; i++) {
        const cur = cross(table[i][0], table[i][1], x, y);
        if (prev * cur <= 0 && ahead(table[i][0], table[i][1], x, y) >= -1e-9) {
          let a = (i - 1) / N;
          let b = i / N;
          let fa = prev;
          let fb = cur;
          let v = fb === fa ? a : a + ((b - a) * fa) / (fa - fb);
          for (let it = 0; it < 40 && fb !== fa; it++) {
            v = it % 3 === 2 ? (a + b) / 2 : a + ((b - a) * fa) / (fa - fb);
            const f = cross(curvePoint(inner, v), curvePoint(outer, v), x, y);
            if (Math.abs(f) < 1e-11 || b - a < 1e-15) break;
            if (f < 0 === fa < 0) {
              a = v;
              fa = f;
            } else {
              b = v;
              fb = f;
            }
          }
          return v;
        }
        prev = cur;
      }
      return null;
    };
    return { surface: { degreeU: 1, degreeV: p, knotsU: [0, 0, 1, 1], knotsV: inner.knots, points: rows }, inner, outer, corner, locate, dir: (v) => [sign * Math.cos(psi(v)), Math.sin(psi(v))] };
  };
  const front = patch(le, -1);
  const back = patch(mid, 1);
  const L0 = le.points[0];
  const T0 = mid.points[0];
  const tip = le.points[le.points.length - 1];
  const at = (x, y) => {
    let v = front.locate(x, y);
    if (v !== null) return [x, y, curvePoint(front.inner, v)[2], 0, v];
    v = back.locate(x, y);
    if (v !== null) return [x, y, curvePoint(back.inner, v)[2], 1, v];
    // Outside both (round-off at the root line or the seam): the nearer end station.
    return y <= tip[1] ? [x, y, (x <= L0[0] ? L0 : T0)[2], x <= L0[0] ? 0 : 1, 0] : [x, y, tip[2], x <= tip[0] ? 0 : 1, 1];
  };
  const root = (x) => {
    if (x <= L0[0]) return [x, L0[1], L0[2]];
    if (x >= T0[0]) return [x, T0[1], T0[2]];
    const t = (x - L0[0]) / (T0[0] - L0[0]);
    return [x, L0[1] + t * (T0[1] - L0[1]), L0[2] + t * (T0[2] - L0[2])];
  };
  // Creases: the level lines of the sections on both surfaces, and the seam.
  const creases = [];
  const K = le.knots;
  for (let i = p + 1; i < K.length; i++) {
    if (K[i] === K[i - 1] || K[i] === K[K.length - 1]) continue;
    let mult = 1;
    while (i + mult < K.length && K[i + mult] === K[i]) mult++;
    if (mult < p) continue;
    for (const [side, edge] of [[front, le], [back, mid]]) {
      const O = curvePoint(edge, K[i]);
      const d = side.dir(K[i]);
      creases.push({ side: (P) => (d[0] * (P[0] - O[0]) + d[1] * (P[1] - O[1]) > 0 ? d[0] * (P[1] - O[1]) - d[1] * (P[0] - O[0]) : null), along: d });
    }
  }
  creases.push({ side: (P) => (P[1] > tip[1] ? tip[0] - P[0] : null), along: [0, 1], seam: true });
  return { kind: 'pole', front, back, surfaces: [front.surface, back.surface], at, root, creases, seam: { x: tip[0], y: tip[1] } };
}

/** Parameters in (t0, t1) where the top-view point q(t) crosses a crease, from `samples` steps, in order. */
function creaseCrossings(creases, q, t0, t1, samples) {
  const out = [];
  for (const crease of creases) {
    const side = (t) => crease.side(q(t));
    let prev = side(t0);
    for (let k = 1; k <= samples; k++) {
      const t = t0 + ((t1 - t0) * k) / samples;
      const cur = side(t);
      if (prev !== null && cur !== null && prev < 0 !== cur < 0 && prev !== 0) {
        let lo = t - (t1 - t0) / samples;
        let hi = t;
        const up = cur > 0;
        for (let it = 0; it < 50; it++) {
          const m = (lo + hi) / 2;
          if (side(m) > 0 === up) hi = m;
          else lo = m;
        }
        const tc = (lo + hi) / 2;
        if (tc - t0 > 1e-9 * (t1 - t0) && t1 - tc > 1e-9 * (t1 - t0)) out.push(tc);
      }
      prev = cur;
    }
  }
  return out.sort((a, b) => a - b).filter((t, i, list) => i === 0 || t - list[i - 1] > 1e-9 * (t1 - t0));
}

/**
 * Whether a surface folds over itself seen from above: the cells of a grid of FOLD_GRID points turn
 * both ways in the xy plane. Cells smaller than 1e-9 of the largest one (at a pole) do not count.
 */
function foldsInTopView(surface) {
  const [nu, nv] = FOLD_GRID;
  const P = [];
  for (let i = 0; i <= nu; i++) {
    const row = [];
    for (let j = 0; j <= nv; j++) row.push(surfacePoint(surface, i / nu, j / nv));
    P.push(row);
  }
  let lo = 0;
  let hi = 0;
  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < nv; j++) {
      const [a, b, c, d] = [P[i][j], P[i + 1][j], P[i + 1][j + 1], P[i][j + 1]];
      const area = ((c[0] - a[0]) * (d[1] - b[1]) - (c[1] - a[1]) * (d[0] - b[0])) / 2;
      lo = Math.min(lo, area);
      hi = Math.max(hi, area);
    }
  }
  return Math.min(-lo, hi) > 1e-9 * Math.max(-lo, hi);
}

/**
 * Cubic B-spline curve over [0, 1] through the points p(t), t from t0 to t1, in pieces that join with
 * C0 continuity at the parameters `cuts`: at least 4 points per piece, `count` over the whole range.
 */
function fitInPieces(p, t0, t1, cuts, count) {
  const ends = [t0, ...cuts, t1];
  const parts = [];
  for (let i = 0; i + 1 < ends.length; i++) {
    const [a, b] = [ends[i], ends[i + 1]];
    const n = Math.max(3, Math.ceil((count * (b - a)) / (t1 - t0)));
    const params = Array.from({ length: n + 1 }, (_, k) => k / n);
    const pts = params.map((u) => p(a + (b - a) * u));
    const c = interpolateCurve(pts, 3, { params });
    c.points[0] = pts[0].slice();
    c.points[c.points.length - 1] = pts[n].slice();
    const f = (t) => (t - t0) / (t1 - t0);
    parts.push({ degree: 3, knots: c.knots.map((u) => f(a) + (f(b) - f(a)) * u), points: c.points });
  }
  const c = joinCurves(parts);
  return { degree: 3, knots: c.knots, points: c.points };
}

/**
 * The outer edge of the strip beyond a flat tip face: the points of the parting surface `width` beyond
 * the tip at the x of the control points of the mean line. Beyond the tip the surface runs straight
 * from the height of the leading edge to the height of the trailing edge between their lines, so the
 * strip is ruled between the mean line and a straight line of the parting surface.
 */
function tipStrip(meanLine, width) {
  const L = meanLine.points[0];
  const T = meanLine.points[meanLine.points.length - 1];
  return { ...meanLine, points: meanLine.points.map((P) => [P[0], L[1] + width, L[2] + ((P[0] - L[0]) / (T[0] - L[0])) * (T[2] - L[2])]) };
}

/**
 * The half-round groove along `path` (points seen from above, from the root on the leading-edge side
 * to the root on the trailing-edge side) as a B-spline surface below the parting surface: u across
 * the groove from the rim next to the wing (0) over the bottom to the outer rim (1), v along the path.
 * `side`: { height(x, y), root(x), zp, yR, slope }: the parting surface, its root ruling and the root
 * plane y = yR + slope · (z − zp). Each station is a half circle of the radius in the vertical plane
 * square to the path, lowered from the height of the parting surface; both rims are fitted through
 * points of the parting surface, both ends lie in the root plane. `maxStep`: largest step along the path.
 */
export function grooveSurface(path, r, side, maxStep = GROOVE_STEP) {
  const { zp, yR, slope } = side;
  // The path in pieces between the creases of the parting surface it crosses: the groove bends with
  // the surface there. Each piece is sampled every 0.5 mm, with at least 6 steps.
  const cuts = [];
  for (const crease of side.creases ?? []) {
    for (let i = 0; i + 1 < path.length; i++) {
      const f0 = crease.side(path[i]);
      const f1 = crease.side(path[i + 1]);
      if (f0 === null || f1 === null || f0 < 0 === f1 < 0 || f0 === 0) continue;
      const t = f0 / (f0 - f1);
      if (i + t > 1e-6 && i + t < path.length - 1 - 1e-6) cuts.push({ q: i + t, along: crease.along, seam: Boolean(crease.seam) });
    }
  }
  cuts.sort((a, b) => a.q - b.q);
  const at = (q) => {
    const i = Math.min(path.length - 2, Math.floor(q));
    const t = q - i;
    return [path[i][0] + t * (path[i + 1][0] - path[i][0]), path[i][1] + t * (path[i + 1][1] - path[i][1])];
  };
  const fine = [];
  const marks = [0];
  const kept = cuts.filter((c, i) => i === 0 || c.q - cuts[i - 1].q > 1e-6);
  const ends = [0, ...kept.map((c) => c.q), path.length - 1];
  for (let k = 0; k + 1 < ends.length; k++) {
    const piece = [at(ends[k])];
    for (let i = Math.floor(ends[k]) + 1; i < ends[k + 1]; i++) piece.push(path[i]);
    piece.push(at(ends[k + 1]));
    let length = 0;
    for (let i = 1; i < piece.length; i++) length += len(sub(piece[i], piece[i - 1]));
    const pts = resample(piece, Math.min(0.5, length / 6 || 0.5));
    for (let i = fine.length ? 1 : 0; i < pts.length; i++) fine.push(pts[i]);
    marks.push(fine.length - 1);
  }
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
  const H = fine.map((_, i) => Math.min(maxStep, Math.max(0.5, Math.sqrt(8 * GROOVE_TOLERANCE * radiusAt(i)))));
  for (let i = 1; i < H.length; i++) H[i] = Math.min(H[i], H[i - 1] + GROOVE_GRADING * (s[i] - s[i - 1]));
  for (let i = H.length - 2; i >= 0; i--) H[i] = Math.min(H[i], H[i + 1] + GROOVE_GRADING * (s[i + 1] - s[i]));
  // Stations per piece: both ends, steps of H between them, at least 4 stations (a cubic).
  const idx = [];
  const joints = [0];
  for (let k = 0; k + 1 < marks.length; k++) {
    const [first, end] = [marks[k], marks[k + 1]];
    const own = [first];
    let at2 = first;
    while (at2 < end) {
      let next = at2 + 1;
      while (next < end && s[next] - s[at2] < H[at2]) next++;
      // No short last step.
      if (end - next < 2) next = end;
      own.push(next);
      at2 = next;
    }
    if (own.length < 4) {
      own.length = 0;
      for (let j = 0; j <= 3; j++) own.push(first + Math.round(((end - first) * j) / 3));
    }
    for (let j = idx.length ? 1 : 0; j < own.length; j++) idx.push(own[j]);
    joints.push(idx.length - 1);
  }
  const centres = idx.map((i) => fine[i]);
  const params = idx.map((i) => s[i] / total);
  // Normal to the outside (to the left of the path direction: the path runs clockwise around the wing).
  // Each station is a half circle square to the path. At a crease the station is skewed along the path
  // onto the crease, so that both rims break on it: its points keep their distance from the centre
  // line and move along the path by that distance times the tangent of the crossing angle (at most
  // CREASE_SKEW). Within 6 radii of the crossing, or up to the next crease if that is closer, the skew fades out, so that no rim point of a station
  // next to the crease lies beyond it (a path that crosses at an angle, as along a swept leading edge).
  const normals = idx.map((i, k) => {
    if (k === 0) return [-1, 0];
    if (k === idx.length - 1) return [1, 0];
    const t = unit(sub(fine[Math.min(fine.length - 1, i + stride)], fine[Math.max(0, i - stride)]));
    return [-t[1], t[0]];
  });
  // Where two creases lie within reach of a station, their skews are averaged by their weights.
  // The station on a crease takes the skew of that crease alone, without the limit below: its rim points
  // are where both rims break, and they must lie on the crease.
  const weight = new Float64Array(idx.length);
  const skewed = new Float64Array(idx.length);
  const pinned = new Map();
  for (let j = 1; j + 1 < joints.length; j++) {
    const k0 = joints[j];
    const { along } = kept[j - 1];
    // The skew of a crease ends at the next crease on either side: beyond it that crease sets the skew.
    const before = Math.min(6 * r, s[idx[k0]] - s[idx[joints[j - 1]]]);
    const after = Math.min(6 * r, s[idx[joints[j + 1]]] - s[idx[k0]]);
    for (let k = 1; k + 1 < idx.length; k++) {
      const ds = s[idx[k]] - s[idx[k0]];
      const d = Math.abs(ds) / (ds < 0 ? before : after);
      if (d >= 1) continue;
      const w = 1 - d * d * (3 - 2 * d);
      const n = normals[k];
      const across = along[0] * n[0] + along[1] * n[1];
      const skew = Math.max(-CREASE_SKEW, Math.min(CREASE_SKEW, (along[0] * n[1] - along[1] * n[0]) / (across || 1e-12)));
      if (k === k0) pinned.set(k, skew);
      weight[k] += w;
      skewed[k] += w * skew;
    }
  }
  // A skewed station leaves the tube where the path curves, by (r · skew)² / (2 R) at the radius R:
  // the skew stays below the value that costs GROOVE_SKEW_ERROR there.
  const skews = normals.map((n, k) => {
    if (pinned.has(k)) return pinned.get(k);
    const limit = Math.sqrt(2 * GROOVE_SKEW_ERROR * radiusAt(idx[k])) / r;
    return Math.max(-limit, Math.min(limit, skewed[k] / Math.max(1, weight[k])));
  });
  // Both rim points of a station stay on the side of a nearby crease that its centre lies on (two
  // creases close together, as at the corner of a flat tip, pull a station between them both ways):
  // else the skew moves towards the one that sets the station parallel to that crease, in 8 steps.
  const direction = (k, skew) => [normals[k][0] + skew * normals[k][1], normals[k][1] - skew * normals[k][0]];
  for (let j = 1; j + 1 < joints.length; j++) {
    const k0 = joints[j];
    const { along } = kept[j - 1];
    const C0 = centres[k0];
    const sideOf = (P) => along[0] * (P[1] - C0[1]) - along[1] * (P[0] - C0[0]);
    for (let k = 1; k + 1 < idx.length; k++) {
      if (k === k0 || pinned.has(k) || Math.abs(s[idx[k]] - s[idx[k0]]) >= 6 * r) continue;
      const C = centres[k];
      const own = sideOf(C);
      if (Math.abs(own) < 1e-9) continue;
      const n = normals[k];
      const across = along[0] * n[0] + along[1] * n[1];
      const parallel = Math.max(-CREASE_SKEW, Math.min(CREASE_SKEW, (along[0] * n[1] - along[1] * n[0]) / (across || 1e-12)));
      const crosses = (skew) => {
        const t = direction(k, skew);
        return [-1, 1].some((sg) => sideOf([C[0] + sg * r * t[0], C[1] + sg * r * t[1]]) * own < 0);
      };
      const from = skews[k];
      for (let step = 1; step <= 8 && crosses(skews[k]); step++) skews[k] = from + ((parallel - from) * step) / 8;
    }
  }
  const turned = normals.map((_, k) => direction(k, skews[k]));
  const Q = [];
  const paramsU = [];
  for (let a = 0; a < GROOVE_POINTS; a++) {
    const phi = (Math.PI * a) / (GROOVE_POINTS - 1);
    paramsU.push(a / (GROOVE_POINTS - 1));
    const last = centres.length - 1;
    Q.push(
      centres.map((C, k) => {
        const x = C[0] - r * Math.cos(phi) * turned[k][0];
        // The end stations lie in the root plane, below the root ruling of the parting surface.
        if (k === 0 || k === last) {
          const z = side.root(x)[2] - r * Math.sin(phi);
          return [x, yR + slope * (z - zp), z];
        }
        const y = C[1] - r * Math.cos(phi) * turned[k][1];
        return [x, y, side.height(x, y) - r * Math.sin(phi)];
      }),
    );
  }
  // One fit per piece, joined with C0 continuity at the creases.
  const knotsU = averagingKnots(paramsU, 3);
  const fits = [];
  for (let k = 0; k + 1 < joints.length; k++) {
    const [a, b] = [joints[k], joints[k + 1]];
    const local = params.slice(a, b + 1).map((t) => (t - params[a]) / (params[b] - params[a]));
    const S = interpolateSurface(Q.map((row) => row.slice(a, b + 1)), 3, 3, paramsU, local, { knotsU, knotsV: averagingKnots(local, 3) });
    fits.push({ ...S, knotsV: S.knotsV.map((t) => params[a] + (params[b] - params[a]) * t) });
  }
  const rows = fits[0].points.map((_, i) => joinCurves(fits.map((S) => ({ degree: 3, knots: S.knotsV, points: S.points[i] }))));
  const surface = { degreeU: 3, degreeV: 3, knotsU, knotsV: rows[0].knots, points: rows.map((c) => c.points) };
  const nu = surface.points.length - 1;
  const nv = surface.points[0].length - 1;
  for (let i = 0; i <= nu; i++) {
    for (const P of [surface.points[i][0], surface.points[i][nv]]) P[1] = yR + slope * (P[2] - zp);
  }
  // Parameter along the groove where it crosses the seam of the parting surface (null without one).
  const seamAt = kept.findIndex((c) => c.seam);
  return {
    surface,
    seam: seamAt < 0 ? null : params[joints[seamAt + 1]],
    length: total,
    stations: centres.length,
    rimInner: surfaceBoundaryU(surface, false),
    rimOuter: surfaceBoundaryU(surface, true),
    endStart: surfaceBoundaryV(surface, false),
    endEnd: surfaceBoundaryV(surface, true),
  };
}
