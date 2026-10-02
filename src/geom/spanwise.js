// Spanwise interpolation of section parameters.
// 'linear' blends the two neighbouring sections with hat functions: f(y) = sum_i w_i(y) f_i.
// 'smooth' is a shape-preserving cubic: per panel the cubic Hermite polynomial through the two
// section values, with the slopes of the natural cubic spline through all sections, limited as by
// Fritsch and Carlson (1980) so that no value leaves the range of the two sections of its panel.

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
 * Hat-function weights (linear interpolation) for section positions ys (strictly increasing).
 * @returns {(y: number) => number[]} weights per section, summing to 1
 */
export function spanwiseWeights(ys) {
  const n = ys.length;
  if (n === 1) return () => [1];
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
 * Slopes at the sections for the smooth blend of the values F[i] (one Float64Array per section, all
 * of length size) at positions ys, n >= 3 sections:
 * 1. Natural cubic spline (second derivative 0 at root and tip): one tridiagonal system of size n - 2
 *    (Thomas algorithm, no pivoting: it is diagonally dominant), one right-hand side per value, gives
 *    the second derivatives D; the slope at section j follows from D and the panel next to it.
 * 2. Limiter (Fritsch and Carlson 1980): a slope becomes 0 where the secants of the two panels next
 *    to its section differ in sign or one of them is 0 (the section is a local extremum or starts a
 *    constant panel), and is cut to 3 times the smaller secant otherwise. The cubic Hermite polynomial
 *    of a panel with both slopes in [0, 3] times its secant is monotone: it stays within the values of
 *    its two sections.
 * Where the spline already meets the limits, the slopes are the spline's and the blend equals it.
 * @returns {{ T: Float64Array[], S: Float64Array[] }} slopes per section and secants per panel
 */
function smoothSlopes(ys, F, size) {
  const n = ys.length;
  const h = [];
  for (let i = 0; i < n - 1; i++) h.push(ys[i + 1] - ys[i]);
  const S = h.map((hj, j) => {
    const s = new Float64Array(size);
    for (let q = 0; q < size; q++) s[q] = (F[j + 1][q] - F[j][q]) / hj;
    return s;
  });
  // Rows r = 0..n-3: (h[r] / 6) D[r] + ((h[r] + h[r+1]) / 3) D[r+1] + (h[r+1] / 6) D[r+2] = S[r+1] - S[r].
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
    const prev = r === 0 ? null : D[r];
    const [s0, s1] = [S[r], S[r + 1]];
    for (let q = 0; q < size; q++) {
      const v = s1[q] - s0[q];
      rhs[q] = (prev ? v - lower * prev[q] : v) / dp[r];
    }
  }
  for (let r = m - 2; r >= 0; r--) {
    const cur = D[r + 1];
    const next = D[r + 2];
    for (let q = 0; q < size; q++) cur[q] -= cp[r] * next[q];
  }
  const T = Array.from({ length: n }, () => new Float64Array(size));
  for (let j = 0; j < n; j++) {
    const t = T[j];
    const left = j > 0 ? S[j - 1] : null;
    const right = j < n - 1 ? S[j] : null;
    for (let q = 0; q < size; q++) {
      // Spline slope at section j: from the panel to its right, the last section from its left panel.
      let v = right ? right[q] - (h[j] * (2 * D[j][q] + D[j + 1][q])) / 6 : left[q] + (h[j - 1] * (D[j - 1][q] + 2 * D[j][q])) / 6;
      for (const sec of [left, right]) {
        if (!sec) continue;
        const s = sec[q];
        // Also a slope that overflowed (NaN) becomes 0.
        if (!(v * s > 0)) v = 0;
        else if (Math.abs(v) > 3 * Math.abs(s)) v = 3 * s;
      }
      t[q] = v;
    }
  }
  return { T, S };
}

/**
 * Blend of equally sized point lists (one per section) at span position y. 'linear' blends the two
 * neighbouring sections with the hat functions of spanwiseWeights; 'smooth' (3 or more sections)
 * evaluates the cubic Hermite polynomial of every coordinate from its two neighbouring sections and
 * the slopes of smoothSlopes, computed once here: O(points) per position instead of
 * O(sections x points). y outside the sections is clamped to them.
 * The returned function has a method `derivative(y)`: the derivative of the blend in y (per mm), the
 * same shape as the blend. Linear: the secant of the panel of y (at a section the panel inboard of
 * it, at the root the first panel); smooth: the derivative of the cubic Hermite polynomial, continuous
 * at the sections. Outside the sections it is that of the end panel.
 * @returns {((y: number) => number[][]) & { derivative: (y: number) => number[][] }}
 */
export function spanwiseBlender(ys, mode, lists) {
  const n = ys.length;
  if (!(mode === 'smooth' && n >= 3)) {
    // Linear (hat functions): the two neighbouring sections, with the sums of blendPoints.
    const copy = (L) => L.map((p) => p.slice());
    if (n === 1) return Object.assign(() => copy(lists[0]), { derivative: () => lists[0].map((p) => p.map(() => 0)) });
    const blend = (y) => {
      if (y <= ys[0]) return copy(lists[0]);
      if (y >= ys[n - 1]) return copy(lists[n - 1]);
      const i = intervalOf(ys, y);
      const t = (y - ys[i]) / (ys[i + 1] - ys[i]);
      const w0 = 1 - t;
      const [A, B] = [lists[i], lists[i + 1]];
      return A.map((p, k) => p.map((v, c) => (t === 0 ? w0 * v : w0 * v + t * B[k][c])));
    };
    blend.derivative = (y) => {
      const i = intervalOf(ys, Math.min(Math.max(y, ys[0]), ys[n - 1]));
      const h = ys[i + 1] - ys[i];
      const [A, B] = [lists[i], lists[i + 1]];
      return A.map((p, k) => p.map((v, c) => (B[k][c] - v) / h));
    };
    return blend;
  }
  const count = lists[0].length;
  const dim = lists[0][0].length;
  const size = count * dim;
  const F = lists.map((L) => {
    const f = new Float64Array(size);
    for (let k = 0; k < count; k++) for (let c = 0; c < dim; c++) f[k * dim + c] = L[k][c];
    return f;
  });
  const { T } = smoothSlopes(ys, F, size);
  const blend = (y) => {
    const yy = Math.min(Math.max(y, ys[0]), ys[n - 1]);
    const j = intervalOf(ys, yy);
    const hj = ys[j + 1] - ys[j];
    const b = (yy - ys[j]) / hj;
    const a = 1 - b;
    // Cubic Hermite basis on the panel, h00 + h01 = 1. Written from the nearer section, the blend is
    // exactly the section value at either end and exactly the value of a constant panel.
    const near = b < 0.5;
    const wFar = near ? b * b * (1 + 2 * a) : a * a * (1 + 2 * b);
    const h10 = a * a * b * hj;
    const h11 = -b * b * a * hj;
    const [f0, f1, t0, t1] = [F[j], F[j + 1], T[j], T[j + 1]];
    const [from, to] = near ? [f0, f1] : [f1, f0];
    const out = new Array(count);
    for (let k = 0; k < count; k++) {
      const p = new Array(dim);
      for (let c = 0; c < dim; c++) {
        const q = k * dim + c;
        p[c] = from[q] + wFar * (to[q] - from[q]) + h10 * t0[q] + h11 * t1[q];
      }
      out[k] = p;
    }
    return out;
  };
  blend.derivative = (y) => {
    const yy = Math.min(Math.max(y, ys[0]), ys[n - 1]);
    const j = intervalOf(ys, yy);
    const hj = ys[j + 1] - ys[j];
    const b = (yy - ys[j]) / hj;
    // Derivatives in y of h01 (h00 = 1 - h01), h10 and h11.
    const d01 = (6 * b * (1 - b)) / hj;
    const d10 = 3 * b * b - 4 * b + 1;
    const d11 = 3 * b * b - 2 * b;
    const [f0, f1, t0, t1] = [F[j], F[j + 1], T[j], T[j + 1]];
    const out = new Array(count);
    for (let k = 0; k < count; k++) {
      const p = new Array(dim);
      for (let c = 0; c < dim; c++) {
        const q = k * dim + c;
        p[c] = d01 * (f1[q] - f0[q]) + d10 * t0[q] + d11 * t1[q];
      }
      out[k] = p;
    }
    return out;
  };
  return blend;
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
