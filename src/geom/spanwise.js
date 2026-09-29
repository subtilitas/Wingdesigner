// Spanwise interpolation of section parameters.
// Every interpolated quantity f(y) is a weighted sum of the section values: f(y) = sum_i w_i(y) f_i.
// 'linear' uses hat functions; 'smooth' uses the cardinal functions of a natural cubic spline.

/**
 * Second derivatives of the natural cubic spline cardinal functions: column i of the result holds
 * the second derivatives at all knots of the spline that is 1 at knot i and 0 at the others. The
 * tridiagonal system is factored once (Thomas algorithm, no pivoting: it is diagonally dominant),
 * so n sections cost O(n^2) instead of n dense solves.
 * @returns {number[][]} M[j][i] = second derivative at knot j of cardinal function i
 */
function cardinalSecondDerivatives(xs) {
  const n = xs.length;
  const M = Array.from({ length: n }, () => new Array(n).fill(0));
  const m = n - 2;
  if (m < 1) return M;
  const h = [];
  for (let i = 0; i < n - 1; i++) h.push(xs[i + 1] - xs[i]);
  // Row r (knot r + 1): (h[r] / 6) M[r] + ((h[r] + h[r+1]) / 3) M[r+1] + (h[r+1] / 6) M[r+2] = rhs.
  const diag = new Array(m);
  const upper = new Array(m);
  const lower = new Array(m);
  for (let r = 0; r < m; r++) {
    diag[r] = (h[r] + h[r + 1]) / 3;
    upper[r] = h[r + 1] / 6;
    lower[r] = h[r] / 6;
  }
  const cp = new Array(m);
  const dp = new Array(m);
  cp[0] = upper[0] / diag[0];
  dp[0] = diag[0];
  for (let r = 1; r < m; r++) {
    dp[r] = diag[r] - lower[r] * cp[r - 1];
    cp[r] = upper[r] / dp[r];
  }
  const rhs = new Array(m);
  const sol = new Array(m);
  for (let i = 0; i < n; i++) {
    // Right-hand side for values e_i: (e[r+2] - e[r+1]) / h[r+1] - (e[r+1] - e[r]) / h[r].
    for (let r = 0; r < m; r++) {
      const e0 = r === i ? 1 : 0;
      const e1 = r + 1 === i ? 1 : 0;
      const e2 = r + 2 === i ? 1 : 0;
      rhs[r] = (e2 - e1) / h[r + 1] - (e1 - e0) / h[r];
    }
    sol[0] = rhs[0] / dp[0];
    for (let r = 1; r < m; r++) sol[r] = (rhs[r] - lower[r] * sol[r - 1]) / dp[r];
    for (let r = m - 2; r >= 0; r--) sol[r] -= cp[r] * sol[r + 1];
    for (let r = 0; r < m; r++) M[r + 1][i] = sol[r];
  }
  return M;
}

/** Index j of the span interval [ys[j], ys[j + 1]] that holds y (clamped to 0 .. n - 2): binary search. */
function intervalOf(ys, y) {
  let lo = 0;
  let hi = ys.length - 2;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (y > ys[mid]) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/**
 * Build a weight function for section positions ys (strictly increasing).
 * @returns {(y: number) => number[]} weights per section, summing to 1
 */
export function spanwiseWeights(ys, mode = 'linear') {
  const n = ys.length;
  if (n === 1) return () => [1];
  if (mode === 'smooth' && n >= 3) {
    const M = cardinalSecondDerivatives(ys);
    return (y) => {
      const yy = Math.min(Math.max(y, ys[0]), ys[n - 1]);
      const j = intervalOf(ys, yy);
      const h = ys[j + 1] - ys[j];
      const a = (ys[j + 1] - yy) / h;
      const b = (yy - ys[j]) / h;
      const ca = ((a ** 3 - a) * h * h) / 6;
      const cb = ((b ** 3 - b) * h * h) / 6;
      const w = new Array(n);
      for (let i = 0; i < n; i++) w[i] = (i === j ? a : 0) + (i === j + 1 ? b : 0) + ca * M[j][i] + cb * M[j + 1][i];
      return w;
    };
  }
  return (y) => {
    const w = new Array(n).fill(0);
    if (y <= ys[0]) {
      w[0] = 1;
      return w;
    }
    if (y >= ys[n - 1]) {
      w[n - 1] = 1;
      return w;
    }
    const i = intervalOf(ys, y);
    const t = (y - ys[i]) / (ys[i + 1] - ys[i]);
    w[i] = 1 - t;
    w[i + 1] = t;
    return w;
  };
}

/**
 * Blend of equally sized point lists (one per section) at span position y, with the weights of
 * spanwiseWeights. 'smooth' evaluates the natural cubic spline of every coordinate from its two
 * neighbouring sections and their second derivatives, computed once here (tridiagonal system per
 * coordinate): O(points) per position instead of O(sections x points).
 * @returns {(y: number) => number[][]}
 */
export function spanwiseBlender(ys, mode, lists) {
  const n = ys.length;
  if (!(mode === 'smooth' && n >= 3)) {
    // Linear (hat functions): the two neighbouring sections, with the sums of blendPoints.
    const copy = (L) => L.map((p) => p.slice());
    if (n === 1) return () => copy(lists[0]);
    return (y) => {
      if (y <= ys[0]) return copy(lists[0]);
      if (y >= ys[n - 1]) return copy(lists[n - 1]);
      const i = intervalOf(ys, y);
      const t = (y - ys[i]) / (ys[i + 1] - ys[i]);
      const w0 = 1 - t;
      const [A, B] = [lists[i], lists[i + 1]];
      return A.map((p, k) => p.map((v, c) => (t === 0 ? w0 * v : w0 * v + t * B[k][c])));
    };
  }
  const count = lists[0].length;
  const dim = lists[0][0].length;
  const size = count * dim;
  const F = lists.map((L) => {
    const f = new Float64Array(size);
    for (let k = 0; k < count; k++) for (let c = 0; c < dim; c++) f[k * dim + c] = L[k][c];
    return f;
  });
  // Natural spline: D[0] = D[n - 1] = 0; rows r = 0..n-3 solve for D[r + 1] (Thomas algorithm, as in
  // cardinalSecondDerivatives, with vector right-hand sides).
  const h = [];
  for (let i = 0; i < n - 1; i++) h.push(ys[i + 1] - ys[i]);
  const m = n - 2;
  const D = Array.from({ length: n }, () => new Float64Array(size));
  const cp = new Array(m);
  const dp = new Array(m);
  for (let r = 0; r < m; r++) {
    const diag = (h[r] + h[r + 1]) / 3;
    const lower = h[r] / 6;
    dp[r] = r === 0 ? diag : diag - lower * cp[r - 1];
    cp[r] = h[r + 1] / 6 / dp[r];
    const rhs = D[r + 1];
    const [f0, f1, f2] = [F[r], F[r + 1], F[r + 2]];
    const prev = r === 0 ? null : D[r];
    for (let q = 0; q < size; q++) {
      const v = (f2[q] - f1[q]) / h[r + 1] - (f1[q] - f0[q]) / h[r];
      rhs[q] = (prev ? v - lower * prev[q] : v) / dp[r];
    }
  }
  for (let r = m - 2; r >= 0; r--) {
    const cur = D[r + 1];
    const next = D[r + 2];
    for (let q = 0; q < size; q++) cur[q] -= cp[r] * next[q];
  }
  return (y) => {
    const yy = Math.min(Math.max(y, ys[0]), ys[n - 1]);
    const j = intervalOf(ys, yy);
    const hj = ys[j + 1] - ys[j];
    const a = (ys[j + 1] - yy) / hj;
    const b = (yy - ys[j]) / hj;
    const ca = ((a ** 3 - a) * hj * hj) / 6;
    const cb = ((b ** 3 - b) * hj * hj) / 6;
    const [f0, f1, d0, d1] = [F[j], F[j + 1], D[j], D[j + 1]];
    const out = new Array(count);
    for (let k = 0; k < count; k++) {
      const p = new Array(dim);
      for (let c = 0; c < dim; c++) {
        const q = k * dim + c;
        p[c] = a * f0[q] + b * f1[q] + ca * d0[q] + cb * d1[q];
      }
      out[k] = p;
    }
    return out;
  };
}

/** Weighted sum of scalars. */
export function blendScalar(weights, values) {
  let s = 0;
  for (let i = 0; i < weights.length; i++) s += weights[i] * values[i];
  return s;
}

/** Weighted sum of equally sized point lists. */
export function blendPoints(weights, lists) {
  const n = lists[0].length;
  const dim = lists[0][0].length;
  const out = Array.from({ length: n }, () => new Array(dim).fill(0));
  for (let i = 0; i < weights.length; i++) {
    const w = weights[i];
    if (w === 0) continue;
    const L = lists[i];
    for (let k = 0; k < n; k++) for (let c = 0; c < dim; c++) out[k][c] += w * L[k][c];
  }
  return out;
}
