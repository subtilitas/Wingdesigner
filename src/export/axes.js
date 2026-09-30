// Up axis of the exported files. The build works in x chordwise towards the trailing edge, y spanwise
// towards the right tip, z up, and writes these axes with 'z'. CAD programs with Y as the up axis
// (Fusion 360 set to Y up, SolidWorks) show such a file on its side: its y (the span) points up and its
// z (the upper surface) points to their front. 'y' writes the part turned by −90° about x:
// (x, y, z) becomes (x, z, −y). The upper surface then faces +Y, the chord stays along X and the right
// half lies at Z ≤ 0. A rotation keeps handedness, so face orientations and volumes stay as they are.

export const UP_AXES = Object.freeze(['z', 'y']);

/** The point map of an up axis: identity for 'z', the −90° turn about x for 'y'. */
export const upAxisMap = (up) => (up === 'y' ? (P) => [P[0], P[2], -P[1]] : (P) => P);

/** A mesh in the axes of `up`: positions turned, triangles unchanged (a rotation keeps their orientation). */
export function meshToUpAxis(mesh, up) {
  if (up !== 'y') return mesh;
  const P = mesh.positions;
  const out = new Float64Array(P.length);
  for (let i = 0; i < P.length; i += 3) {
    out[i] = P[i];
    out[i + 1] = P[i + 2];
    out[i + 2] = -P[i + 1];
  }
  return { ...mesh, positions: out };
}
