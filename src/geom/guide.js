// Planform guide curves: the "nose line" (leading edge) and the "end line" (trailing edge).
// A guide is a 2D NURBS curve in planform coordinates [x, y] (x chordwise, y spanwise) that
// runs from the root to the tip with strictly increasing y.
//
// mode 'fit':     the curve interpolates the points (global interpolation, parameters proportional to y).
// mode 'control': the points are the control polygon of a clamped uniform B-spline.

import { curvePoint, interpolateCurve, solveMonotonic } from './nurbs.js';

export function clampedUniformKnots(nPoints, degree) {
  const n = nPoints - 1;
  const p = Math.min(degree, n);
  const U = [];
  for (let i = 0; i <= p; i++) U.push(0);
  for (let j = 1; j <= n - p; j++) U.push(j / (n - p + 1));
  for (let i = 0; i <= p; i++) U.push(1);
  return { knots: U, degree: p };
}

/** Validate a guide definition; returns a list of problems (empty when valid). */
export function guideProblems(guide) {
  const out = [];
  if (!guide || !Array.isArray(guide.points) || guide.points.length < 2) {
    out.push('A guide curve needs at least 2 points.');
    return out;
  }
  for (const p of guide.points) {
    if (!Array.isArray(p) || p.length < 2 || !p.every(Number.isFinite)) {
      out.push('Guide points must be finite [x, y] pairs.');
      return out;
    }
  }
  for (let i = 1; i < guide.points.length; i++) {
    if (!(guide.points[i][1] > guide.points[i - 1][1])) {
      out.push('Guide points must have strictly increasing span position y.');
      return out;
    }
  }
  // Through-points mode: the curve parameters are the normalized y values. Two of them within 4
  // units in the last place make the interpolation singular.
  if (guide.mode !== 'control') {
    const P = guide.points;
    const ya = P[0][1];
    const yb = P[P.length - 1][1];
    for (let i = 1; i < P.length; i++) {
      const a = (P[i - 1][1] - ya) / (yb - ya);
      const b = (P[i][1] - ya) / (yb - ya);
      if (!(b - a > 4 * Number.EPSILON * Math.max(Math.abs(a), Math.abs(b)))) {
        out.push(`Points ${i} and ${i + 1} at y = ${P[i - 1][1]} mm and y = ${P[i][1]} mm lie too close together for the curve parameters; move them apart.`);
        break;
      }
    }
  }
  return out;
}

/** Build the NURBS curve of a guide. */
export function guideCurve(guide) {
  const pts = guide.points.map((p) => [p[0], p[1]]);
  const degree = guide.degree ?? 3;
  if (guide.mode === 'control') {
    const { knots, degree: p } = clampedUniformKnots(pts.length, degree);
    return { degree: p, knots, points: pts };
  }
  // Parameters proportional to span position: y(t) is then exactly linear (splines reproduce
  // linear functions), so the curve never doubles back in y; x(y) is a cubic spline function.
  const ya = pts[0][1];
  const yb = pts[pts.length - 1][1];
  const params = pts.map((p) => (yb > ya ? (p[1] - ya) / (yb - ya) : 0));
  const c = interpolateCurve(pts, degree, { params });
  return { degree: c.degree, knots: c.knots, points: c.points };
}

/** True when y(t) of the curve increases monotonically (checked on `samples` points). */
export function isMonotonicInY(curve, samples = 400) {
  let prev = -Infinity;
  for (let i = 0; i <= samples; i++) {
    const y = curvePoint(curve, i / samples)[1];
    if (y < prev - 1e-9) return false;
    prev = y;
  }
  return true;
}

/**
 * Chordwise position x of the guide at span position y. The guide's own y range is stretched
 * linearly onto [yRoot, yTip] so the guide always spans the wing.
 */
export function guideXAt(curve, y, yRoot, yTip) {
  const P = curve.points;
  const y0 = P[0][1];
  const y1 = P[P.length - 1][1];
  const f = yTip > yRoot ? (y - yRoot) / (yTip - yRoot) : 0;
  const yg = y0 + Math.min(Math.max(f, 0), 1) * (y1 - y0);
  // Tolerance relative to the guide's y extent: an absolute 1e-12 accepted the first estimate on
  // guides spanning less than 1e-12 mm.
  const t = solveMonotonic((s) => curvePoint(curve, s)[1], yg, 0, 1, 1e-12 * Math.abs(y1 - y0));
  return curvePoint(curve, t)[0];
}

/** Largest samples of one drawn guide curve. */
export const MAX_GUIDE_SAMPLES = 40_000;

/**
 * Points [x, y] of a guide curve for drawing and view bounds: 2 to 16 samples in every nonzero knot
 * span (a uniform sample aliased guides with many points), at most maxSamples in all, and the end.
 */
export function sampleGuide(curve, maxSamples = MAX_GUIDE_SAMPLES) {
  const U = curve.knots;
  const spans = [];
  for (let j = curve.degree; j < U.length - curve.degree - 1; j++) if (U[j + 1] > U[j]) spans.push([U[j], U[j + 1]]);
  const per = Math.max(2, Math.min(16, Math.floor(maxSamples / Math.max(1, spans.length))));
  const out = [];
  for (const [a, b] of spans) for (let k = 0; k < per; k++) out.push(curvePoint(curve, a + ((b - a) * k) / per));
  out.push(curvePoint(curve, U[U.length - 1]));
  return out;
}

/** Default guides through the section leading and trailing edges. */
export function defaultGuides(sections) {
  const sorted = sections.slice().sort((a, b) => a.y - b.y);
  return {
    nose: { enabled: false, mode: 'fit', degree: 3, points: sorted.map((s) => [s.x, s.y]) },
    end: { enabled: false, mode: 'fit', degree: 3, points: sorted.map((s) => [s.x + s.chord, s.y]) },
  };
}
