// Airfoil profile as a NURBS curve and its resampling onto a common chordwise station set.
//
// All sections of a wing are resampled at the same chord fractions so that point j of every
// section corresponds (same side, same relative chord position). Point N is the leading edge.

import { basisFuns, curveDerivatives, curvePoint, interpolateCurve, solveMonotonic } from './nurbs.js';
import { selfIntersections } from '../airfoil/geometry.js';
import { fixed, tr } from '../i18n/index.js';

/** Chord fractions 0..1 with cosine clustering at LE and TE (N+1 values). */
export function cosineStations(N) {
  return Array.from({ length: N + 1 }, (_, k) => (1 - Math.cos((Math.PI * k) / N)) / 2);
}

/**
 * Interpolate a normalized airfoil (Selig order) with a cubic B-spline through every point.
 * Returns the curve and the parameter of the true leading edge (minimum x on the curve).
 */
export function profileCurve(points, { degree = 3, parametrization = 'centripetal' } = {}) {
  const curve = interpolateCurve(points, degree, { parametrization });
  // Start from the data point with minimum x and refine x'(t) = 0 by Newton iterations.
  let k0 = 0;
  for (let k = 1; k < points.length; k++) if (points[k][0] < points[k0][0]) k0 = k;
  const params = curve.params;
  let lo = params[Math.max(0, k0 - 1)];
  let hi = params[Math.min(params.length - 1, k0 + 1)];
  let t = params[k0];
  for (let it = 0; it < 50; it++) {
    const [, d1, d2] = curveDerivatives(curve, t, 2);
    if (Math.abs(d1[0]) < 1e-14) break;
    let next = d2[0] !== 0 ? t - d1[0] / d2[0] : NaN;
    if (!(next > lo && next < hi)) {
      // Bisection on the sign of x'(t) keeps the step inside the bracket.
      const dlo = curveDerivatives(curve, lo, 1)[1][0];
      next = 0.5 * (lo + hi);
      const dm = curveDerivatives(curve, next, 1)[1][0];
      if (Math.sign(dm) === Math.sign(dlo)) lo = next;
      else hi = next;
    }
    if (Math.abs(next - t) < 1e-14) {
      t = next;
      break;
    }
    t = next;
  }
  if (curvePoint(curve, t)[0] > points[k0][0]) t = params[k0];
  return { curve, tLE: t };
}

/**
 * Resample a profile curve at chord fractions `stations` (0 = LE, 1 = TE) on both surfaces.
 * Returns 2N+1 points: upper TE -> LE (stations reversed), then lower LE -> TE.
 * Station 1 maps exactly to the curve ends and station 0 to the leading edge.
 */
export function resampleProfile({ curve, tLE }, stations) {
  const N = stations.length - 1;
  const le = curvePoint(curve, tLE);
  const teU = curvePoint(curve, 0);
  const teL = curvePoint(curve, 1);
  const xOf = (t) => curvePoint(curve, t)[0];
  const upper = new Array(N + 1);
  const lower = new Array(N + 1);
  upper[0] = le;
  lower[0] = le;
  upper[N] = teU;
  lower[N] = teL;
  for (let k = 1; k < N; k++) {
    const s = stations[k];
    const xu = le[0] + s * (teU[0] - le[0]);
    const xl = le[0] + s * (teL[0] - le[0]);
    upper[k] = curvePoint(curve, solveMonotonic(xOf, xu, 0, tLE, 1e-13));
    lower[k] = curvePoint(curve, solveMonotonic(xOf, xl, tLE, 1, 1e-13));
  }
  return upper.reverse().concat(lower.slice(1));
}

/** Maximum distance between the resampled polyline and dense samples of the curve (quality measure). */
export function resampleDeviation(profile, resampled, samples = 400) {
  let worst = 0;
  for (let i = 0; i <= samples; i++) {
    const P = curvePoint(profile.curve, i / samples);
    let best = Infinity;
    for (let k = 0; k < resampled.length - 1; k++) {
      best = Math.min(best, pointSegmentDistance(P, resampled[k], resampled[k + 1]));
    }
    worst = Math.max(worst, best);
  }
  return worst;
}

function pointSegmentDistance(P, A, B) {
  const vx = B[0] - A[0];
  const vy = B[1] - A[1];
  const l2 = vx * vx + vy * vy;
  let t = l2 > 0 ? ((P[0] - A[0]) * vx + (P[1] - A[1]) * vy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(P[0] - A[0] - t * vx, P[1] - A[1] - t * vy);
}

// Crossing loops thinner than this fraction of the chord on average (loop area over loop extent)
// are not reported: interpolation leaves long, thin slivers at cusped closed trailing edges (at
// most 1.6e-5 chord in 246 real files) and between coarse chord samples, far below the 1 mm
// resolution; the loop of a coarse 9-point file measures 2.5e-3 chord.
export const CROSSING_TOLERANCE = 5e-4;

// The wing build ignores crossings up to CROSSING_TOLERANCE of the chord and at most this size in
// mm, so the fraction applies up to 200 mm chord. The real-file slivers of 1.6e-5 chord reach it
// at 6250 mm chord; a fixed fraction would accept a 50 mm loop at the 100,000 mm chord limit.
export const CROSSING_LIMIT = 0.1;

/**
 * Crossing size for the polyline pts: size(i, j) splits the outline at the crossing of segments i
 * and j into the inner part pts[i+1..j] and the outer part (the rest), both closed polygons, and
 * returns the mean width (area over extent, the diagonal of the bounding box) of the part with the
 * smaller extent. Each query costs O(1): prefix sums of the shoelace terms give the areas, sparse
 * tables of the coordinates the bounding boxes. The tables are built on the first query.
 */
function crossingSizer(pts) {
  const n = pts.length;
  // Coordinates relative to the first point keep the shoelace sums small.
  const ox = pts[0][0];
  const oy = pts[0][1];
  const cross = (a, b) => (pts[a][0] - ox) * (pts[b][1] - oy) - (pts[b][0] - ox) * (pts[a][1] - oy);
  let C = null;
  let tables = null;
  const init = () => {
    // C[k]: shoelace sum of the segments 0..k-1.
    C = new Float64Array(n);
    for (let k = 1; k < n; k++) C[k] = C[k - 1] + cross(k - 1, k);
    // tables[l][q][k]: min x, max x, min y, max y (q = 0..3) of pts[k .. k + 2^l - 1].
    const xs = Float64Array.from(pts, (p) => p[0]);
    const ys = Float64Array.from(pts, (p) => p[1]);
    tables = [[xs, xs, ys, ys]];
    for (let w = 1; 2 * w <= n; w *= 2) {
      const prev = tables[tables.length - 1];
      tables.push(
        prev.map((t, q) => {
          const out = new Float64Array(n - 2 * w + 1);
          for (let k = 0; k < out.length; k++) out[k] = q % 2 === 0 ? Math.min(t[k], t[k + w]) : Math.max(t[k], t[k + w]);
          return out;
        }),
      );
    }
  };
  // Bounding box of pts[a..b] (inclusive) merged into box [x0, x1, y0, y1].
  const grow = (a, b, box) => {
    const l = 31 - Math.clz32(b - a + 1);
    const t = tables[l];
    const c = b - (1 << l) + 1;
    box[0] = Math.min(box[0], t[0][a], t[0][c]);
    box[1] = Math.max(box[1], t[1][a], t[1][c]);
    box[2] = Math.min(box[2], t[2][a], t[2][c]);
    box[3] = Math.max(box[3], t[3][a], t[3][c]);
    return box;
  };
  const diagonal = (box) => Math.hypot(box[1] - box[0], box[3] - box[2]);
  // Twice the area of the closed polygon pts[a0..a1] + pts[b0..b1], summed directly: parts of a
  // few points (the usual small loop) keep their exact area instead of a difference of prefix sums.
  const direct = (a0, a1, b0, b1) => {
    const idx = [];
    for (let k = a0; k <= a1; k++) idx.push(k);
    for (let k = b0; k <= b1; k++) idx.push(k);
    let a = 0;
    for (let k = 0; k < idx.length; k++) a += cross(idx[k], idx[(k + 1) % idx.length]);
    return a;
  };
  const SHORT = 64;
  return (i, j) => {
    if (!C) init();
    const inner = diagonal(grow(i + 1, j, [Infinity, -Infinity, Infinity, -Infinity]));
    const outerBox = grow(0, i, [Infinity, -Infinity, Infinity, -Infinity]);
    const outer = diagonal(grow(j + 1, n - 1, outerBox));
    if (inner <= outer) {
      const a = j - i <= SHORT ? direct(i + 1, j, 1, 0) : C[j] - C[i + 1] + cross(j, i + 1);
      return Math.abs(a) / 2 / (inner || 1);
    }
    const a = i + n - j <= SHORT ? direct(0, i, j + 1, n - 1) : C[i] + cross(i, j + 1) + C[n - 1] - C[j + 1] + cross(n - 1, 0);
    return Math.abs(a) / 2 / (outer || 1);
  };
}

/**
 * Sample a curve on every knot span. With `samplesPerSpan` every span gets that many points;
 * otherwise a budget of about `budget` points is shared among the spans in proportion to the length
 * of their control polygon (which bounds the curve length in the span), at least 1 and at most 256
 * per span: coarse spans, where interpolation overshoots or loops, get many samples even when most
 * spans of a dense file are short.
 * @returns {{pts: number[][], ts: number[]}}
 */
export function sampleCurve(curve, { samplesPerSpan, budget = 4000 } = {}) {
  const U = curve.knots;
  const p = curve.degree;
  const P = curve.points;
  const spans = [];
  for (let k = p; k < U.length - p - 1; k++) {
    if (!(U[k + 1] > U[k])) continue;
    let len = 0;
    for (let j = k - p; j < k; j++) len += Math.hypot(P[j + 1][0] - P[j][0], P[j + 1][1] - P[j][1]);
    spans.push({ k, a: U[k], b: U[k + 1], len });
  }
  const total = spans.reduce((sum, sp) => sum + sp.len, 0) || 1;
  const pts = [];
  const ts = [];
  for (const { k, a, b, len } of spans) {
    const per = samplesPerSpan ?? Math.max(1, Math.min(256, Math.round((budget * len) / total)));
    for (let s = 0; s < per; s++) {
      const t = a + ((b - a) * s) / per;
      ts.push(t);
      if (curve.weights) {
        pts.push(curvePoint(curve, t));
        continue;
      }
      // Non-rational curve with known knot span k: sum the p + 1 basis functions directly.
      const Nb = basisFuns(k, t, p, U);
      let x = 0;
      let y = 0;
      for (let j = 0; j <= p; j++) {
        x += Nb[j] * P[k - p + j][0];
        y += Nb[j] * P[k - p + j][1];
      }
      pts.push([x, y]);
    }
  }
  ts.push(U[U.length - 1]);
  pts.push(curvePoint(curve, U[U.length - 1]));
  return { pts, ts };
}

/**
 * Self-crossing of a fitted 2D curve between its data points (cubic interpolation can overshoot
 * where coarse data changes quickly, e.g. near a trailing edge), on the samples of sampleCurve. The
 * crossing splits the outline into two parts; the size of the crossing is the mean width (area over
 * extent) of the part with the smaller extent. Crossings up to `tolerance` are ignored.
 * @returns {{x: number, size: number}|null} position and size of the largest crossing, or null
 */
export function curveCrossing(curve, { tolerance = 0, samplesPerSpan, samples } = {}) {
  const { pts } = samples ?? sampleCurve(curve, { samplesPerSpan });
  const size = crossingSizer(pts);
  let worst = null;
  // Crossings up to the tolerance do not count towards the search limit, so any number of small
  // slivers cannot hide a larger loop.
  selfIntersections(pts, 20, (i, j) => {
    const s = size(i, j);
    if (!(s > tolerance)) return false;
    if (!(worst && worst.size >= s)) worst = { x: pts[i][0], size: s };
    return true;
  });
  return worst;
}

// x reversals of a fitted surface above this fraction of the chord are errors: the loft resamples
// both surfaces by chord position and would drop the part that runs back. None of 246 real files
// has any reversal.
export const REVERSAL_TOLERANCE = 1e-4;

/**
 * Largest x reversal of a fitted airfoil curve: the upper surface (u from 0 to tLE) must run towards
 * the leading edge, the lower surface (tLE to 1) away from it.
 * @returns {{x: number, size: number}|null} position and amplitude of the largest reversal, or null
 */
export function curveReversal(curve, tLE, { tolerance = 0, samples } = {}) {
  const { pts, ts } = samples ?? sampleCurve(curve);
  let worst = null;
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < pts.length; i++) {
    const x = pts[i][0];
    if (ts[i] <= tLE) {
      lo = Math.min(lo, x);
      const d = x - lo;
      if (d > tolerance && !(worst && worst.size >= d)) worst = { x, size: d };
    } else {
      hi = Math.max(hi, x);
      const d = hi - x;
      if (d > tolerance && !(worst && worst.size >= d)) worst = { x, size: d };
    }
  }
  return worst;
}

/**
 * Error message for a fitted airfoil curve that crosses itself or runs back in x, or null.
 * `samples` (sampleCurve of the curve) can be shared with a later crossing test.
 */
export function profileProblem({ curve, tLE }, samples = sampleCurve(curve)) {
  const cross = curveCrossing(curve, { tolerance: CROSSING_TOLERANCE, samples });
  if (cross) {
    return tr('the NURBS curve through the points crosses itself near x = {x} % chord; the file has too few points there. Use a file with more points or finer spacing near that position.', {
      x: fixed(cross.x * 100, 1),
    });
  }
  const back = curveReversal(curve, tLE, { tolerance: REVERSAL_TOLERANCE, samples });
  if (back) {
    return tr('the surface runs back in x by {size} % chord near x = {x} % chord; every surface point needs its own chord position, since the loft resamples by chord position.', {
      size: fixed(back.size * 100, 3),
      x: fixed(back.x * 100, 1),
    });
  }
  return null;
}

/**
 * Fit the profile curve through checked airfoil points and check its shape, as every airfoil must pass
 * before use (the Airfoils tab, the XFLR5 import). `issue` is the error when the fit fails or the curve
 * crosses itself or runs back; `prof` is the fitted curve (also one with a shape error, for drawing).
 * @returns {{prof: object|null, issue: {severity: string, code: string, message: string}|null}}
 */
export function fitProfile(points, parametrization) {
  let prof;
  try {
    prof = profileCurve(points, { parametrization });
  } catch (e) {
    return { prof: null, issue: { severity: 'error', code: 'curve-shape', message: tr('The NURBS interpolation through the points failed ({message}).', { message: e.message }) } };
  }
  const problem = profileProblem(prof);
  if (problem) return { prof, issue: { severity: 'error', code: 'curve-shape', message: problem.charAt(0).toUpperCase() + problem.slice(1) } };
  return { prof, issue: null };
}
