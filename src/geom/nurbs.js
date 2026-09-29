// NURBS primitives after Piegl & Tiller, "The NURBS Book", 2nd ed. (algorithm numbers in comments).
//
// Curve:   { degree, knots: number[], points: number[][], weights?: number[] }
// Surface: { degreeU, degreeV, knotsU, knotsV, points: number[][][] (points[i][j], i along u, j along v), weights?: number[][] }
// Points are arrays of any dimension (2D or 3D). Missing weights mean a non-rational B-spline.

import { bandFactor, bandSolve } from './linalg.js';

/** A2.1: knot span index for parameter u. n = number of control points - 1. */
export function findSpan(n, p, u, U) {
  if (u >= U[n + 1]) return n;
  if (u <= U[p]) return p;
  let low = p;
  let high = n + 1;
  let mid = (low + high) >> 1;
  while (u < U[mid] || u >= U[mid + 1]) {
    if (u < U[mid]) high = mid;
    else low = mid;
    mid = (low + high) >> 1;
  }
  return mid;
}

/** A2.2: non-vanishing basis functions N[span-p..span] at u. */
export function basisFuns(span, u, p, U) {
  const N = new Array(p + 1).fill(0);
  const left = new Array(p + 1).fill(0);
  const right = new Array(p + 1).fill(0);
  N[0] = 1;
  for (let j = 1; j <= p; j++) {
    left[j] = u - U[span + 1 - j];
    right[j] = U[span + j] - u;
    let saved = 0;
    for (let r = 0; r < j; r++) {
      const temp = N[r] / (right[r + 1] + left[j - r]);
      N[r] = saved + right[r + 1] * temp;
      saved = left[j - r] * temp;
    }
    N[j] = saved;
  }
  return N;
}

/** A2.3: basis functions and derivatives up to order nd. Returns ders[k][j]. */
export function dersBasisFuns(span, u, p, nd, U) {
  const ndu = Array.from({ length: p + 1 }, () => new Array(p + 1).fill(0));
  const left = new Array(p + 1).fill(0);
  const right = new Array(p + 1).fill(0);
  ndu[0][0] = 1;
  for (let j = 1; j <= p; j++) {
    left[j] = u - U[span + 1 - j];
    right[j] = U[span + j] - u;
    let saved = 0;
    for (let r = 0; r < j; r++) {
      ndu[j][r] = right[r + 1] + left[j - r];
      const temp = ndu[r][j - 1] / ndu[j][r];
      ndu[r][j] = saved + right[r + 1] * temp;
      saved = left[j - r] * temp;
    }
    ndu[j][j] = saved;
  }
  const ders = Array.from({ length: nd + 1 }, () => new Array(p + 1).fill(0));
  for (let j = 0; j <= p; j++) ders[0][j] = ndu[j][p];
  const a = [new Array(p + 1).fill(0), new Array(p + 1).fill(0)];
  for (let r = 0; r <= p; r++) {
    let s1 = 0;
    let s2 = 1;
    a[0][0] = 1;
    for (let k = 1; k <= nd; k++) {
      let d = 0;
      const rk = r - k;
      const pk = p - k;
      if (r >= k) {
        a[s2][0] = a[s1][0] / ndu[pk + 1][rk];
        d = a[s2][0] * ndu[rk][pk];
      }
      const j1 = rk >= -1 ? 1 : -rk;
      const j2 = r - 1 <= pk ? k - 1 : p - r;
      for (let j = j1; j <= j2; j++) {
        a[s2][j] = (a[s1][j] - a[s1][j - 1]) / ndu[pk + 1][rk + j];
        d += a[s2][j] * ndu[rk + j][pk];
      }
      if (r <= pk) {
        a[s2][k] = -a[s1][k - 1] / ndu[pk + 1][r];
        d += a[s2][k] * ndu[r][pk];
      }
      ders[k][r] = d;
      const t = s1;
      s1 = s2;
      s2 = t;
    }
  }
  let r = p;
  for (let k = 1; k <= nd; k++) {
    for (let j = 0; j <= p; j++) ders[k][j] *= r;
    r *= p - k;
  }
  return ders;
}

function homogeneous(points, weights) {
  return points.map((P, i) => {
    const w = weights ? weights[i] : 1;
    return [...P.map((c) => c * w), w];
  });
}

/** A3.1 / A4.1: point on a (rational) curve. */
export function curvePoint(curve, u) {
  const { degree: p, knots: U, points: P, weights: W } = curve;
  const n = P.length - 1;
  const span = findSpan(n, p, u, U);
  const N = basisFuns(span, u, p, U);
  const dim = P[0].length;
  const out = new Array(dim).fill(0);
  let w = 0;
  for (let j = 0; j <= p; j++) {
    const idx = span - p + j;
    const wj = W ? W[idx] * N[j] : N[j];
    w += wj;
    for (let c = 0; c < dim; c++) out[c] += wj * P[idx][c];
  }
  if (W) for (let c = 0; c < dim; c++) out[c] /= w;
  return out;
}

/** A3.2 / A4.2: derivatives CK[0..d] of a (rational) curve at u. */
export function curveDerivatives(curve, u, d) {
  const { degree: p, knots: U, points: P, weights: W } = curve;
  const n = P.length - 1;
  const dim = P[0].length;
  const du = Math.min(d, p);
  const span = findSpan(n, p, u, U);
  const nders = dersBasisFuns(span, u, p, du, U);
  const Pw = homogeneous(P, W);
  const Aders = [];
  for (let k = 0; k <= d; k++) {
    const v = new Array(dim + 1).fill(0);
    if (k <= du) {
      for (let j = 0; j <= p; j++) {
        const Q = Pw[span - p + j];
        for (let c = 0; c <= dim; c++) v[c] += nders[k][j] * Q[c];
      }
    }
    Aders.push(v);
  }
  if (!W) return Aders.map((v) => v.slice(0, dim));
  // A4.2: rational derivatives from homogeneous ones.
  const CK = [];
  for (let k = 0; k <= d; k++) {
    const v = Aders[k].slice(0, dim);
    for (let i = 1; i <= k; i++) {
      const b = binomial(k, i) * Aders[i][dim];
      for (let c = 0; c < dim; c++) v[c] -= b * CK[k - i][c];
    }
    const w0 = Aders[0][dim];
    CK.push(v.map((c) => c / w0));
  }
  return CK;
}

function binomial(n, k) {
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return r;
}

/** A3.5 (rational form via homogeneous coordinates): point on a surface. */
export function surfacePoint(surf, u, v) {
  const { degreeU: p, degreeV: q, knotsU: U, knotsV: V, points: P, weights: W } = surf;
  const n = P.length - 1;
  const m = P[0].length - 1;
  const su = findSpan(n, p, u, U);
  const sv = findSpan(m, q, v, V);
  const Nu = basisFuns(su, u, p, U);
  const Nv = basisFuns(sv, v, q, V);
  const dim = P[0][0].length;
  const out = new Array(dim).fill(0);
  let w = 0;
  for (let k = 0; k <= p; k++) {
    const i = su - p + k;
    for (let l = 0; l <= q; l++) {
      const j = sv - q + l;
      const b = Nu[k] * Nv[l] * (W ? W[i][j] : 1);
      w += b;
      for (let c = 0; c < dim; c++) out[c] += b * P[i][j][c];
    }
  }
  if (W) for (let c = 0; c < dim; c++) out[c] /= w;
  return out;
}

/**
 * A3.6: first-order partial derivatives of a non-rational surface.
 * Returns { point, du, dv }.
 */
export function surfaceDerivatives1(surf, u, v) {
  if (surf.weights) throw new Error('surfaceDerivatives1 supports non-rational surfaces only');
  const { degreeU: p, degreeV: q, knotsU: U, knotsV: V, points: P } = surf;
  const n = P.length - 1;
  const m = P[0].length - 1;
  const su = findSpan(n, p, u, U);
  const sv = findSpan(m, q, v, V);
  const Nu = dersBasisFuns(su, u, p, Math.min(1, p), U);
  const Nv = dersBasisFuns(sv, v, q, Math.min(1, q), V);
  const dim = P[0][0].length;
  const S = new Array(dim).fill(0);
  const Su = new Array(dim).fill(0);
  const Sv = new Array(dim).fill(0);
  for (let k = 0; k <= p; k++) {
    const i = su - p + k;
    for (let l = 0; l <= q; l++) {
      const j = sv - q + l;
      const Pij = P[i][j];
      const b0 = Nu[0][k] * Nv[0][l];
      const bu = p >= 1 ? Nu[1][k] * Nv[0][l] : 0;
      const bv = q >= 1 ? Nu[0][k] * Nv[1][l] : 0;
      for (let c = 0; c < dim; c++) {
        S[c] += b0 * Pij[c];
        Su[c] += bu * Pij[c];
        Sv[c] += bv * Pij[c];
      }
    }
  }
  return { point: S, du: Su, dv: Sv };
}

/** Parameter values for interpolation (eq. 9.4-9.6). method: 'uniform' | 'chord' | 'centripetal'. */
export function parametrize(points, method = 'chord') {
  const n = points.length - 1;
  if (n < 1) return [0];
  if (method === 'uniform') return points.map((_, k) => k / n);
  const e = method === 'centripetal' ? 0.5 : 1;
  const d = [];
  let total = 0;
  for (let k = 1; k <= n; k++) {
    const dk = Math.pow(dist(points[k], points[k - 1]), e);
    d.push(dk);
    total += dk;
  }
  if (total === 0) return points.map((_, k) => k / n);
  const t = [0];
  let acc = 0;
  for (let k = 1; k < n; k++) {
    acc += d[k - 1];
    t.push(acc / total);
  }
  t.push(1);
  return t;
}

/** Clamped knot vector by averaging (eq. 9.8). */
export function averagingKnots(params, p) {
  const n = params.length - 1;
  const U = new Array(n + p + 2).fill(0);
  for (let i = n + 1; i <= n + p + 1; i++) U[i] = 1;
  for (let j = 1; j <= n - p; j++) {
    let s = 0;
    for (let i = j; i <= j + p - 1; i++) s += params[i];
    U[j + p] = s / p;
  }
  return U;
}

/** Collocation matrix N_j(t_k) (square, size params.length). */
/** Band rows of the collocation matrix: row k has basis values in columns span - p .. span. */
export function collocationRows(params, p, U) {
  const n = params.length - 1;
  return params.map((t) => {
    const span = findSpan(n, p, t, U);
    return { start: span - p, values: basisFuns(span, t, p, U) };
  });
}

/** Band LU factorization of the collocation matrix (one factorization, many right-hand sides). */
export function collocationFactor(params, p, U) {
  return bandFactor(collocationRows(params, p, U));
}

export { bandSolve as collocationSolve };

export function collocationMatrix(params, p, U) {
  const n = params.length - 1;
  const A = Array.from({ length: n + 1 }, () => new Float64Array(n + 1));
  for (let k = 0; k <= n; k++) {
    const span = findSpan(n, p, params[k], U);
    const N = basisFuns(span, params[k], p, U);
    for (let j = 0; j <= p; j++) A[k][span - p + j] = N[j];
  }
  return A;
}

/**
 * A9.1: global interpolation through points with a clamped B-spline of degree p
 * (degree drops to points.length-1 when there are too few points).
 * options: { parametrization, params, knots }
 */
export function interpolateCurve(points, p = 3, options = {}) {
  const n = points.length - 1;
  if (n < 1) throw new Error('interpolateCurve needs at least 2 points');
  const deg = Math.min(p, n);
  const params = options.params ?? parametrize(points, options.parametrization ?? 'chord');
  const U = options.knots ?? averagingKnots(params, deg);
  const lu = collocationFactor(params, deg, U);
  const dim = points[0].length;
  const P = points.map(() => new Array(dim).fill(0));
  for (let c = 0; c < dim; c++) {
    const x = bandSolve(lu, points.map((pt) => pt[c]));
    for (let i = 0; i <= n; i++) P[i][c] = x[i];
  }
  return { degree: deg, knots: U, points: P, params };
}

/**
 * A9.4: global surface interpolation through a grid Q[k][l] (k along u, l along v)
 * at parameters paramsU[k], paramsV[l]. Knot vectors default to averaging.
 * Additional options.knotsU / options.knotsV override the knot vectors.
 */
export function interpolateSurface(Q, p, q, paramsU, paramsV, options = {}) {
  const n = Q.length - 1;
  const m = Q[0].length - 1;
  const degU = Math.min(p, n);
  const degV = Math.min(q, m);
  const U = options.knotsU ?? averagingKnots(paramsU, degU);
  const V = options.knotsV ?? averagingKnots(paramsV, degV);
  const dim = Q[0][0].length;
  const luU = collocationFactor(paramsU, degU, U);
  const luV = collocationFactor(paramsV, degV, V);
  // R[k][j]: interpolate along v for each u-row first.
  const R = Q.map((row) => {
    const out = row.map(() => new Array(dim).fill(0));
    for (let c = 0; c < dim; c++) {
      const x = bandSolve(luV, row.map((pt) => pt[c]));
      for (let j = 0; j <= m; j++) out[j][c] = x[j];
    }
    return out;
  });
  const P = Array.from({ length: n + 1 }, () => Array.from({ length: m + 1 }, () => new Array(dim).fill(0)));
  for (let j = 0; j <= m; j++) {
    for (let c = 0; c < dim; c++) {
      const x = bandSolve(luU, R.map((row) => row[j][c]));
      for (let i = 0; i <= n; i++) P[i][j][c] = x[i];
    }
  }
  return { degreeU: degU, degreeV: degV, knotsU: U, knotsV: V, points: P };
}

/** A5.1: insert knot u r times into a non-rational curve. */
export function insertKnotCurve(curve, u, r = 1) {
  const { degree: p, knots: UP, points: Pw } = curve;
  const np = Pw.length - 1;
  const k = findSpan(np, p, u, UP);
  let s = 0;
  for (const t of UP) if (t === u) s++;
  if (r + s > p) r = p - s;
  if (r <= 0) return { degree: p, knots: UP.slice(), points: Pw.map((P) => P.slice()) };
  const mp = np + p + 1;
  const nq = np + r;
  const UQ = new Array(mp + r + 1);
  for (let i = 0; i <= k; i++) UQ[i] = UP[i];
  for (let i = 1; i <= r; i++) UQ[k + i] = u;
  for (let i = k + 1; i <= mp; i++) UQ[i + r] = UP[i];
  const Qw = new Array(nq + 1);
  for (let i = 0; i <= k - p; i++) Qw[i] = Pw[i].slice();
  for (let i = k - s; i <= np; i++) Qw[i + r] = Pw[i].slice();
  const Rw = [];
  for (let i = 0; i <= p - s; i++) Rw[i] = Pw[k - p + i].slice();
  let L = 0;
  for (let j = 1; j <= r; j++) {
    L = k - p + j;
    for (let i = 0; i <= p - j - s; i++) {
      const alpha = (u - UP[L + i]) / (UP[i + k + 1] - UP[L + i]);
      Rw[i] = Rw[i].map((c, d) => alpha * Rw[i + 1][d] + (1 - alpha) * c);
    }
    Qw[L] = Rw[0].slice();
    Qw[k + r - j - s] = Rw[p - j - s].slice();
  }
  for (let i = L + 1; i < k - s; i++) Qw[i] = Rw[i - L].slice();
  return { degree: p, knots: UQ, points: Qw };
}

/** Distance below which a split parameter is treated as an existing knot. */
export const KNOT_SNAP = 1e-10;

/** Knot multiplicity of u in U. */
export function knotMultiplicity(U, u, tol = 0) {
  let s = 0;
  for (const t of U) if (Math.abs(t - u) <= tol) s++;
  return s;
}

/**
 * Split a non-rational curve at u into two clamped curves (knots re-normalized to [0,1]).
 */
export function splitCurve(curve, uIn) {
  const p = curve.degree;
  // Snap to an existing knot within round-off, otherwise the split adds p copies next to it and
  // the two merge into multiplicity p + 1 (or more) in exporters that compare knots with a tolerance.
  const near = curve.knots.find((t) => Math.abs(t - uIn) <= KNOT_SNAP);
  const u = near ?? uIn;
  const s = knotMultiplicity(curve.knots, u);
  const c = insertKnotCurve(curve, u, p - s);
  const U = c.knots;
  // The control point preceding the first copy of u lies on the curve at u.
  const idx = U.indexOf(u) - 1;
  if (idx < 0) throw new Error(`splitCurve: parameter ${u} is not interior`);
  const left = {
    degree: p,
    knots: [...U.slice(0, idx + p + 1), u],
    points: c.points.slice(0, idx + 1),
  };
  const right = {
    degree: p,
    knots: [u, ...U.slice(idx + 1)],
    points: c.points.slice(idx),
  };
  return [normalizeCurveKnots(left), normalizeCurveKnots(right)];
}

export function normalizeKnots(U) {
  const a = U[0];
  const b = U[U.length - 1];
  return U.map((t) => (t - a) / (b - a));
}

function normalizeCurveKnots(c) {
  return { ...c, knots: normalizeKnots(c.knots) };
}

/** Split a non-rational surface along u at parameter u (knot insertion on every v column). */
export function splitSurfaceU(surf, u) {
  const m = surf.points[0].length;
  const lefts = [];
  const rights = [];
  for (let j = 0; j < m; j++) {
    const col = { degree: surf.degreeU, knots: surf.knotsU, points: surf.points.map((row) => row[j]) };
    const [l, r] = splitCurve(col, u);
    lefts.push(l);
    rights.push(r);
  }
  const build = (curves) => ({
    degreeU: surf.degreeU,
    degreeV: surf.degreeV,
    knotsU: curves[0].knots,
    knotsV: surf.knotsV.slice(),
    points: curves[0].points.map((_, i) => curves.map((c) => c.points[i])),
  });
  return [build(lefts), build(rights)];
}

/** Iso-curve of a non-rational surface along v at the u-boundary (first or last control row). */
export function surfaceBoundaryU(surf, atEnd) {
  const row = atEnd ? surf.points[surf.points.length - 1] : surf.points[0];
  return { degree: surf.degreeV, knots: surf.knotsV.slice(), points: row.map((P) => P.slice()) };
}

/** Iso-curve of a non-rational surface along u at the v-boundary (first or last control column). */
export function surfaceBoundaryV(surf, atEnd) {
  const j = atEnd ? surf.points[0].length - 1 : 0;
  return { degree: surf.degreeU, knots: surf.knotsU.slice(), points: surf.points.map((row) => row[j].slice()) };
}

/** Compress a knot vector into distinct values and multiplicities (STEP form). */
export function knotMultiplicities(U, tol = 1e-12) {
  const knots = [];
  const mults = [];
  for (const t of U) {
    if (knots.length && Math.abs(t - knots[knots.length - 1]) <= tol) mults[mults.length - 1]++;
    else {
      knots.push(t);
      mults.push(1);
    }
  }
  return { knots, mults };
}

export function dist(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2;
  return Math.sqrt(s);
}

/**
 * Solve f(t) = target for t in [t0, t1] where f is monotonic (bisection + secant polish).
 */
export function solveMonotonic(f, target, t0 = 0, t1 = 1, tol = 1e-12, maxIter = 200) {
  let a = t0;
  let b = t1;
  let fa = f(a) - target;
  let fb = f(b) - target;
  if (fa === 0) return a;
  if (fb === 0) return b;
  if (fa * fb > 0) return Math.abs(fa) < Math.abs(fb) ? a : b;
  for (let i = 0; i < maxIter; i++) {
    // Illinois-style regula falsi with bisection fallback.
    let t = b - (fb * (b - a)) / (fb - fa);
    if (!(t > Math.min(a, b) && t < Math.max(a, b)) || i % 3 === 2) t = 0.5 * (a + b);
    const ft = f(t) - target;
    if (Math.abs(ft) <= tol || Math.abs(b - a) <= tol) return t;
    if (ft * fa < 0) {
      b = t;
      fb = ft;
    } else {
      a = t;
      fa = ft;
    }
  }
  return 0.5 * (a + b);
}
