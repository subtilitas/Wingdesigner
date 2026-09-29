// Airfoil profile as a NURBS curve and its resampling onto a common chordwise station set.
//
// All sections of a wing are resampled at the same chord fractions so that point j of every
// section corresponds (same side, same relative chord position). Point N is the leading edge.

import { curveDerivatives, curvePoint, interpolateCurve, solveMonotonic } from './nurbs.js';
import { selfIntersections } from '../airfoil/geometry.js';

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

// Crossing loops smaller than this fraction of the chord are not reported: interpolation leaves
// slivers of about 1.4e-4 chord at cusped closed trailing edges (e.g. MH 83), far below the 1 mm
// resolution; crossings from coarse files measure about 9e-3 chord.
export const CROSSING_TOLERANCE = 5e-4;

function extent(pts) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of pts) {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  return Math.hypot(x1 - x0, y1 - y0);
}

/**
 * Self-crossing of a fitted 2D curve between its data points (cubic interpolation can overshoot
 * where coarse data changes quickly, e.g. near a trailing edge). Samples every knot span
 * (`samplesPerSpan`, by default 8 to 256 with about 4000 points in total) and tests the
 * polyline for crossings. The size of a crossing is the extent of the smaller of the two parts the
 * crossing splits the outline into; crossings up to `tolerance` are ignored.
 * @returns {{x: number, size: number}|null} position and size of the largest crossing, or null
 */
export function curveCrossing(curve, { tolerance = 0, samplesPerSpan } = {}) {
  const U = curve.knots;
  const p = curve.degree;
  const spans = [];
  for (let i = p; i < U.length - p - 1; i++) if (U[i + 1] > U[i]) spans.push([U[i], U[i + 1]]);
  const per = samplesPerSpan ?? Math.max(8, Math.min(256, Math.floor(4000 / Math.max(spans.length, 1))));
  const pts = [];
  for (const [a, b] of spans) for (let s = 0; s < per; s++) pts.push(curvePoint(curve, a + ((b - a) * s) / per));
  pts.push(curvePoint(curve, U[U.length - 1]));
  let worst = null;
  for (const [i, j] of selfIntersections(pts, 20)) {
    const size = Math.min(extent(pts.slice(i + 1, j + 1)), extent([...pts.slice(0, i + 1), ...pts.slice(j + 1)]));
    if (size > tolerance && !(worst && worst.size >= size)) worst = { x: pts[i][0], size };
  }
  return worst;
}
