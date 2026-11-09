// Fairness of a planform edge of a built wing: the leading edge (u = uLE) or trailing edge (u = 0) of
// the fitted surface, seen from above (y, x), sampled in the surface parameter v. A curve is fair
// where its curvature keeps one sign. An inflection, a change of sign between points whose curvature
// exceeds `kmin` (1/mm, radius 1 m by default) on both sides, counts as a wave when the curve between
// it and its neighbouring inflections (or the ends) rises more than `rise` (mm) above the straight line
// through their end points: below the 0.01 mm resolution of the section values a ripple is not shape.
import { surfacePoint } from '../src/geom/nurbs.js';

/** Points (y, x) of an edge of the built wing `b` at u, for v from v0 to v1 in `n` steps. */
export function edgePoints(b, u, v0, v1, n = 4000) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const p = surfacePoint(b.surface, u, v0 + ((v1 - v0) * i) / n);
    out.push([p[1], p[0]]);
  }
  return out;
}

/** Largest distance of points[i0 … i1] from the straight line through points[i0] and points[i1]. */
function rise(points, i0, i1) {
  const [a, b] = [points[i0], points[i1]];
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  let max = 0;
  for (let i = i0 + 1; i < i1; i++) {
    const p = points[i];
    const d = len > 0 ? Math.abs((b[0] - a[0]) * (a[1] - p[1]) - (a[0] - p[0]) * (b[1] - a[1])) / len : Math.hypot(p[0] - a[0], p[1] - a[1]);
    if (d > max) max = d;
  }
  return max;
}

/** Waves of a curve of points (y, x) between y0 and y1: { count, at: y of each inflection }. */
export function inflections(points, y0, y1, { kmin = 1e-3, minRise = 0.01 } = {}) {
  let sign = 0;
  const idx = [];
  let first = -1;
  let last = -1;
  for (let i = 1; i < points.length - 1; i++) {
    const [a, p, c] = [points[i - 1], points[i], points[i + 1]];
    if (!(p[0] > y0 && p[0] < y1)) continue;
    if (first < 0) first = i;
    last = i;
    const d1 = [(c[0] - a[0]) / 2, (c[1] - a[1]) / 2];
    const d2 = [c[0] - 2 * p[0] + a[0], c[1] - 2 * p[1] + a[1]];
    const speed = Math.hypot(d1[0], d1[1]);
    if (speed === 0) continue;
    const k = (d1[0] * d2[1] - d1[1] * d2[0]) / speed ** 3;
    const s = Math.abs(k) < kmin ? 0 : Math.sign(k);
    if (s && sign && s !== sign) idx.push(i);
    if (s) sign = s;
  }
  // An inflection is a wave when either arc next to it rises more than minRise.
  const bounds = [first, ...idx, last];
  const at = [];
  for (let j = 1; j < bounds.length - 1; j++) {
    if (rise(points, bounds[j - 1], bounds[j]) > minRise || rise(points, bounds[j], bounds[j + 1]) > minRise) at.push(points[bounds[j]][0]);
  }
  return { count: at.length, at };
}

/** Waves of the leading and trailing edge of `b` between span positions y0 and y1. */
export function edgeInflections(b, y0, y1, options) {
  const v0 = Math.max(0, b.vAt(y0) - 0.01);
  return {
    le: inflections(edgePoints(b, b.uLE, v0, 1), y0, y1, options),
    te: inflections(edgePoints(b, 0, v0, 1), y0, y1, options),
  };
}
