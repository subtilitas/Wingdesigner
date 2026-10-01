// Rigid placement of the whole part (settings.partTilt, settings.partRoll, settings.partPivot): the
// half wing is built in its own frame (sections, section planes, loft) and then turned as a rigid
// body. Order: the roll about the x axis, then the tilt about the y axis, both through the pivot.
// Signs: a positive tilt raises the leading edge (x' = x cos t + z sin t, z' = −x sin t + z cos t,
// relative to the pivot), a positive roll raises the right tip (y' = y cos r − z sin r,
// z' = y sin r + z cos r). The left half is the mirror image of the turned right half at y = 0.
// Pivot: settings.partPivot { x, y, z } when stored (an import stores the wing origin of its plane),
// else the leading edge of the root section.

const DEG = Math.PI / 180;

/** The pivot of the part: the stored one, else the leading edge (x, y, z) of the root section. */
export function partPivot(settings, sections) {
  const p = settings?.partPivot;
  if (p && [p.x, p.y, p.z].every(Number.isFinite)) return [p.x, p.y, p.z];
  let root = null;
  for (const s of sections ?? []) if (!root || s.y < root.y) root = s;
  return root ? [root.x, root.y, root.z] : [0, 0, 0];
}

/**
 * The rigid transform of the part: { tilt, roll (degrees), pivot: [x, y, z], identity, point(p),
 * vector(v), matrix (3 x 3 rows) }. point() maps a point of the part frame into the plane frame,
 * vector() a direction.
 */
export function partTransform(settings, sections) {
  const tilt = Number.isFinite(settings?.partTilt) ? settings.partTilt : 0;
  const roll = Number.isFinite(settings?.partRoll) ? settings.partRoll : 0;
  const pivot = partPivot(settings, sections);
  const ct = Math.cos(tilt * DEG);
  const st = Math.sin(tilt * DEG);
  const cr = Math.cos(roll * DEG);
  const sr = Math.sin(roll * DEG);
  // M = Ry(tilt) · Rx(roll): the roll first, then the tilt.
  const M = [
    [ct, st * sr, st * cr],
    [0, cr, -sr],
    [-st, ct * sr, ct * cr],
  ];
  const vector = (v) => [M[0][0] * v[0] + M[0][1] * v[1] + M[0][2] * v[2], M[1][0] * v[0] + M[1][1] * v[1] + M[1][2] * v[2], M[2][0] * v[0] + M[2][1] * v[1] + M[2][2] * v[2]];
  const identity = tilt === 0 && roll === 0;
  const point = identity
    ? (p) => [p[0], p[1], p[2]]
    : (p) => {
        const q = vector([p[0] - pivot[0], p[1] - pivot[1], p[2] - pivot[2]]);
        return [q[0] + pivot[0], q[1] + pivot[1], q[2] + pivot[2]];
      };
  return { tilt, roll, pivot, identity, point, vector, matrix: M };
}

/** Flat positions [x0, y0, z0, x1, …] of a mesh mapped by the transform (a new Float64Array). */
export function transformPositions(positions, t) {
  const out = new Float64Array(positions.length);
  for (let i = 0; i < positions.length; i += 3) {
    const q = t.point([positions[i], positions[i + 1], positions[i + 2]]);
    out[i] = q[0];
    out[i + 1] = q[1];
    out[i + 2] = q[2];
  }
  return out;
}
