// Spanwise interpolation of section parameters.
// Every interpolated quantity f(y) is a weighted sum of the section values: f(y) = sum_i w_i(y) f_i.
// 'linear' uses hat functions; 'smooth' uses the cardinal functions of a natural cubic spline.

import { solve } from './linalg.js';

/** Natural cubic spline second derivatives for knots xs and values ys. */
function naturalSecondDerivatives(xs, ys) {
  const n = xs.length;
  if (n < 3) return new Array(n).fill(0);
  const m = n - 2;
  const A = Array.from({ length: m }, () => new Array(m).fill(0));
  const b = new Array(m).fill(0);
  for (let i = 1; i <= m; i++) {
    const h0 = xs[i] - xs[i - 1];
    const h1 = xs[i + 1] - xs[i];
    A[i - 1][i - 1] = (h0 + h1) / 3;
    if (i > 1) A[i - 1][i - 2] = h0 / 6;
    if (i < m) A[i - 1][i] = h1 / 6;
    b[i - 1] = (ys[i + 1] - ys[i]) / h1 - (ys[i] - ys[i - 1]) / h0;
  }
  const M = solve(A, b);
  return [0, ...M, 0];
}

function splineEval(xs, ys, M, x) {
  const n = xs.length;
  let i = 0;
  while (i < n - 2 && x > xs[i + 1]) i++;
  const h = xs[i + 1] - xs[i];
  const a = (xs[i + 1] - x) / h;
  const b = (x - xs[i]) / h;
  return a * ys[i] + b * ys[i + 1] + (((a ** 3 - a) * M[i] + (b ** 3 - b) * M[i + 1]) * h * h) / 6;
}

/**
 * Build a weight function for section positions ys (strictly increasing).
 * @returns {(y: number) => number[]} weights per section, summing to 1
 */
export function spanwiseWeights(ys, mode = 'linear') {
  const n = ys.length;
  if (n === 1) return () => [1];
  if (mode === 'smooth' && n >= 3) {
    const cards = ys.map((_, i) => {
      const e = ys.map((__, k) => (k === i ? 1 : 0));
      return { e, M: naturalSecondDerivatives(ys, e) };
    });
    return (y) => {
      const yy = Math.min(Math.max(y, ys[0]), ys[n - 1]);
      return cards.map(({ e, M }) => splineEval(ys, e, M, yy));
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
