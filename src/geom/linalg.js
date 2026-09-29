// Dense LU factorization with partial pivoting for small systems (spanwise spline weights), and a
// band LU factorization without pivoting for B-spline collocation matrices.

export function luFactor(Ain) {
  const n = Ain.length;
  const A = Ain.map((row) => Float64Array.from(row));
  const piv = new Int32Array(n);
  for (let i = 0; i < n; i++) piv[i] = i;
  for (let k = 0; k < n; k++) {
    let maxRow = k;
    let maxVal = Math.abs(A[k][k]);
    for (let i = k + 1; i < n; i++) {
      const v = Math.abs(A[i][k]);
      if (v > maxVal) {
        maxVal = v;
        maxRow = i;
      }
    }
    if (maxVal < 1e-300) throw new Error('luFactor: singular matrix');
    if (maxRow !== k) {
      [A[k], A[maxRow]] = [A[maxRow], A[k]];
      [piv[k], piv[maxRow]] = [piv[maxRow], piv[k]];
    }
    const akk = A[k][k];
    for (let i = k + 1; i < n; i++) {
      const f = A[i][k] / akk;
      if (f === 0) continue;
      A[i][k] = f;
      const Ai = A[i];
      const Ak = A[k];
      for (let j = k + 1; j < n; j++) Ai[j] -= f * Ak[j];
    }
  }
  return { A, piv, n };
}

export function luSolve({ A, piv, n }, b) {
  const x = new Float64Array(n);
  for (let i = 0; i < n; i++) x[i] = b[piv[i]];
  for (let i = 0; i < n; i++) {
    let s = x[i];
    const Ai = A[i];
    for (let j = 0; j < i; j++) s -= Ai[j] * x[j];
    x[i] = s;
  }
  for (let i = n - 1; i >= 0; i--) {
    let s = x[i];
    const Ai = A[i];
    for (let j = i + 1; j < n; j++) s -= Ai[j] * x[j];
    x[i] = s / Ai[i];
  }
  return Array.from(x);
}

export function solve(A, b) {
  return luSolve(luFactor(A), b);
}

/**
 * Band LU factorization without pivoting. `rows[i]` holds row i as { start, values } with the
 * nonzero entries in columns start .. start + values.length - 1; lower and upper bandwidths are
 * derived from them. B-spline collocation matrices are totally positive, so Gaussian elimination
 * without pivoting is stable for them (de Boor and Pinkus, 1977); without row exchanges the factors
 * keep the band. Work O(n kl ku), storage O(n (kl + ku + 1)).
 */
export function bandFactor(rows) {
  const n = rows.length;
  let kl = 0;
  let ku = 0;
  for (let i = 0; i < n; i++) {
    const { start, values } = rows[i];
    kl = Math.max(kl, i - start);
    ku = Math.max(ku, start + values.length - 1 - i);
  }
  const w = kl + ku + 1;
  const B = new Float64Array(n * w);
  // Entry (i, j) is stored at B[i * w + (j - i + kl)], for i - kl <= j <= i + ku.
  for (let i = 0; i < n; i++) {
    const { start, values } = rows[i];
    for (let k = 0; k < values.length; k++) {
      const j = start + k;
      if (j < 0 || j >= n) continue;
      B[i * w + (j - i + kl)] = values[k];
    }
  }
  const uw = ku;
  for (let k = 0; k < n; k++) {
    const akk = B[k * w + kl];
    if (Math.abs(akk) < 1e-300) throw new Error('bandFactor: zero pivot');
    const iEnd = Math.min(n - 1, k + kl);
    const jEnd = Math.min(n - 1, k + uw);
    for (let i = k + 1; i <= iEnd; i++) {
      const ik = i * w + (k - i + kl);
      const f = B[ik] / akk;
      if (f === 0) continue;
      B[ik] = f;
      for (let j = k + 1; j <= jEnd; j++) B[i * w + (j - i + kl)] -= f * B[k * w + (j - k + kl)];
    }
  }
  return { B, n, kl, uw, w };
}

export function bandSolve({ B, n, kl, uw, w }, b) {
  const x = Float64Array.from(b);
  for (let i = 0; i < n; i++) {
    let s = x[i];
    for (let j = Math.max(0, i - kl); j < i; j++) s -= B[i * w + (j - i + kl)] * x[j];
    x[i] = s;
  }
  for (let i = n - 1; i >= 0; i--) {
    let s = x[i];
    const jEnd = Math.min(n - 1, i + uw);
    for (let j = i + 1; j <= jEnd; j++) s -= B[i * w + (j - i + kl)] * x[j];
    x[i] = s / B[i * w + kl];
  }
  return Array.from(x);
}
