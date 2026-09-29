// Coordinate precision of mesh exports: STL stores 32-bit floats, and 3MF readers such as lib3mf
// keep 32-bit floats as well. Rounding moves every corner by up to half the coordinate spacing per
// axis, so a triangle thinner than that can collapse or turn over. Such a triangle is damage when it
// is visible at the stored resolution (longest edge at least 4 spacings); smaller triangles stay
// below the resolution of the file.

/** Thrown when rounding to the stored precision collapses or turns over a visible triangle. */
export class MeshPrecisionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'MeshPrecisionError';
  }
}

/** Spacing of 32-bit floats at magnitude m: 2^(exponent - 23). */
export const float32Spacing = (m) => (m > 0 ? 2 ** (Math.floor(Math.log2(m)) - 23) : 2 ** -149);

const normal = (V, i, j, k) => {
  const ux = V[j] - V[i];
  const uy = V[j + 1] - V[i + 1];
  const uz = V[j + 2] - V[i + 2];
  const vx = V[k] - V[i];
  const vy = V[k + 1] - V[i + 1];
  const vz = V[k + 2] - V[i + 2];
  return [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
};

/** True when the triangle a, b, c (offsets into Q) has an area and its rounded copy in R has none or faces the other way. */
function flips(Q, R, a, b, c) {
  const e = normal(Q, a, b, c);
  if (e[0] === 0 && e[1] === 0 && e[2] === 0) return false;
  const r = normal(R, a, b, c);
  return r[0] * e[0] + r[1] * e[1] + r[2] * e[2] <= 0;
}

/**
 * Triangles that rounding collapses (zero area) or turns over (normal against the exact one), whose
 * longest edge is at least 4 coordinate spacings at their largest coordinate: their count, their
 * largest coordinate and the first of them (vertex offsets into P).
 * @param {ArrayLike<number>} P vertex coordinates (x, y, z per vertex)
 * @param {ArrayLike<number>} I triangle vertex indices
 * @param {(x: number) => number} round a coordinate as the reader stores it
 */
export function damagedTriangles(P, I, round) {
  const R = Float64Array.from(P, round);
  const edge = (a, b) => Math.hypot(P[a] - P[b], P[a + 1] - P[b + 1], P[a + 2] - P[b + 2]);
  let bad = 0;
  let far = 0;
  let first = null;
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3;
    const b = I[t + 1] * 3;
    const c = I[t + 2] * 3;
    if (!flips(P, R, a, b, c)) continue;
    let m = 0;
    for (const k of [a, b, c]) m = Math.max(m, Math.abs(P[k]), Math.abs(P[k + 1]), Math.abs(P[k + 2]));
    if (Math.max(edge(a, b), edge(b, c), edge(a, c)) < 4 * float32Spacing(m)) continue;
    bad++;
    far = Math.max(far, m);
    first ??= [a, b, c];
  }
  return { bad, far, first };
}

/**
 * Throw MeshPrecisionError when rounding damages a triangle. `stores` names the format in the
 * message ("STL stores", "3MF readers store"). The remedy depends on the cause: when the damaged
 * triangle still flips with its x and z moved next to 0 and the root moved to y = 0, its distance
 * from the root alone is too coarse, so sections or stations lie closer together than the spacing
 * and moving the wing does not help.
 */
export function checkPrecision(P, I, round, stores) {
  const { bad, far, first } = damagedTriangles(P, I, round);
  if (!bad) return;
  // The root can move to y = 0 (on a mirrored wing both halves move): the smallest |y| of the mesh.
  let root = Infinity;
  for (let k = 1; k < P.length; k += 3) root = Math.min(root, Math.abs(P[k]));
  const [a, b, c] = first;
  const x0 = P[a];
  const z0 = P[a + 2];
  const moved = [a, b, c].flatMap((k) => [P[k] - x0, Math.sign(P[k + 1]) * (Math.abs(P[k + 1]) - root), P[k + 2] - z0]);
  const ys = [a, b, c].map((k) => P[k + 1]);
  const remedy = flips(moved, moved.map(round), 0, 3, 6)
    ? `Sections or stations near y = ${Number(Math.abs(ys[0]).toPrecision(10))} mm lie closer together than the spacing there (${float32Spacing(Math.max(...ys.map(Math.abs))).toPrecision(2)} mm); move them apart, or export STEP.`
    : 'Move the wing towards the origin, or export STEP.';
  throw new MeshPrecisionError(
    `${stores} 32-bit coordinates: at ${Math.round(far)} mm their spacing is ${float32Spacing(far).toPrecision(2)} mm, and ${bad} of ${I.length / 3} triangles collapse or turn over. ${remedy}`,
  );
}
