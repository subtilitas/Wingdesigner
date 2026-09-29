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
      let j = 0;
      while (j < n - 2 && yy > ys[j + 1]) j++;
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
    let i = 0;
    while (y > ys[i + 1]) i++;
    const t = (y - ys[i]) / (ys[i + 1] - ys[i]);
    w[i] = 1 - t;
    w[i + 1] = t;
    return w;
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
