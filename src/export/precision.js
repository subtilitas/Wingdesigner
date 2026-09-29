// Coordinate precision of mesh exports: STL stores 32-bit floats, and 3MF readers such as lib3mf
// keep 32-bit floats as well. Rounding may merge distinct corners of a triangle, which then
// collapses; such an export is refused. Slivers thinner than the coordinate spacing may turn over
// without merging corners; they stay below the resolution of the file.

/** Thrown when rounding to the stored precision merges two distinct corners of a triangle. */
export class MeshPrecisionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'MeshPrecisionError';
  }
}

/**
 * Triangles of which two distinct corners round to the same stored point.
 * @param {ArrayLike<number>} P vertex coordinates (x, y, z per vertex)
 * @param {ArrayLike<number>} I triangle vertex indices
 * @param {(x: number) => number} round a coordinate as the reader stores it
 */
export function collapsedTriangles(P, I, round) {
  const R = Float64Array.from(P, round);
  const distinct = (a, b) => P[a] !== P[b] || P[a + 1] !== P[b + 1] || P[a + 2] !== P[b + 2];
  const same = (a, b) => R[a] === R[b] && R[a + 1] === R[b + 1] && R[a + 2] === R[b + 2];
  let bad = 0;
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3;
    const b = I[t + 1] * 3;
    const c = I[t + 2] * 3;
    if ((distinct(a, b) && same(a, b)) || (distinct(b, c) && same(b, c)) || (distinct(a, c) && same(a, c))) bad++;
  }
  return bad;
}

/**
 * Throw MeshPrecisionError when rounding collapses a triangle. `stores` names the format in the
 * message ("STL stores", "3MF readers store").
 */
export function checkPrecision(P, I, round, stores) {
  const bad = collapsedTriangles(P, I, round);
  if (!bad) return;
  let far = 0;
  for (let k = 0; k < P.length; k++) far = Math.max(far, Math.abs(P[k]));
  // Spacing of 32-bit floats at the largest coordinate: 2^(exponent - 23).
  const spacing = 2 ** (Math.floor(Math.log2(far)) - 23);
  throw new MeshPrecisionError(
    `${stores} 32-bit coordinates: at ${Math.round(far)} mm their spacing is ${spacing.toPrecision(2)} mm, and ${bad} of ${I.length / 3} triangles collapse (two corners fall together). Move the wing towards the origin, or export STEP.`,
  );
}
