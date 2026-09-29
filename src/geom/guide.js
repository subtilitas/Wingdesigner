// Planform guide curves: the "nose line" (leading edge) and the "end line" (trailing edge).
// A guide is a 2D NURBS curve in planform coordinates [x, y] (x chordwise, y spanwise) that
// runs from the root to the tip with strictly increasing y.
//
// mode 'fit':     the curve interpolates the points (global cubic interpolation).
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
      break;
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
  const c = interpolateCurve(pts, degree, { parametrization: 'centripetal' });
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
  const t = solveMonotonic((s) => curvePoint(curve, s)[1], yg, 0, 1, 1e-12);
  return curvePoint(curve, t)[0];
}

/** Default guides through the section leading and trailing edges. */
export function defaultGuides(sections) {
  const sorted = sections.slice().sort((a, b) => a.y - b.y);
  return {
    nose: { enabled: false, mode: 'fit', degree: 3, points: sorted.map((s) => [s.x, s.y]) },
    end: { enabled: false, mode: 'fit', degree: 3, points: sorted.map((s) => [s.x + s.chord, s.y]) },
  };
}
