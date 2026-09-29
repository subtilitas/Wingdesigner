// Dense LU factorization with partial pivoting. Interpolation systems here stay below
// about 300 unknowns, so O(n^3) factorization is cheap and one factorization serves many right-hand sides.

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
