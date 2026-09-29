// Binary STL writer (little endian): 80-byte header, uint32 triangle count, then per triangle
// normal (3 x float32), three vertices (9 x float32) and a uint16 attribute byte count.

/** Thrown when float32 coordinates cannot hold the mesh: triangles collapse or turn over. */
export class StlPrecisionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'StlPrecisionError';
  }
}

/**
 * Triangles that float32 rounding collapses to zero area or turns over (the rounded normal points
 * against the exact one). Float32 keeps 24 significant bits: at 16,384 mm the coordinate spacing
 * is 0.002 mm, at 1,000,000 mm 0.0625 mm.
 */
function float32Defects(P, I) {
  let bad = 0;
  let far = 0;
  const f = Math.fround;
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3;
    const b = I[t + 1] * 3;
    const c = I[t + 2] * 3;
    const exact = normal(P[a], P[a + 1], P[a + 2], P[b], P[b + 1], P[b + 2], P[c], P[c + 1], P[c + 2]);
    if (exact[0] === 0 && exact[1] === 0 && exact[2] === 0) continue;
    const r = normal(f(P[a]), f(P[a + 1]), f(P[a + 2]), f(P[b]), f(P[b + 1]), f(P[b + 2]), f(P[c]), f(P[c + 1]), f(P[c + 2]));
    if (r[0] * exact[0] + r[1] * exact[1] + r[2] * exact[2] <= 0) bad++;
  }
  for (let k = 0; k < P.length; k++) far = Math.max(far, Math.abs(P[k]));
  return { bad, far };
}

function normal(ax, ay, az, bx, by, bz, cx, cy, cz) {
  const ux = bx - ax;
  const uy = by - ay;
  const uz = bz - az;
  const vx = cx - ax;
  const vy = cy - ay;
  const vz = cz - az;
  return [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
}

/**
 * @throws {StlPrecisionError} when float32 rounding collapses or turns over any triangle
 */
export function meshToStl({ positions: P, indices: I }, header = 'Wingdesigner') {
  const { bad, far } = float32Defects(P, I);
  if (bad) {
    // Spacing of float32 values at the largest coordinate: 2^(exponent - 23).
    const spacing = 2 ** (Math.floor(Math.log2(far)) - 23);
    throw new StlPrecisionError(
      `STL stores 32-bit coordinates: at ${Math.round(far)} mm their spacing is ${spacing.toPrecision(2)} mm, and ${bad} of ${I.length / 3} triangles collapse or turn over. Move the wing towards the origin, or export STEP.`,
    );
  }
  const n = I.length / 3;
  const buf = new ArrayBuffer(84 + n * 50);
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);
  const h = new TextEncoder().encode(String(header).slice(0, 80));
  bytes.set(h.subarray(0, 80), 0);
  view.setUint32(80, n, true);
  let o = 84;
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3;
    const b = I[t + 1] * 3;
    const c = I[t + 2] * 3;
    const ux = P[b] - P[a];
    const uy = P[b + 1] - P[a + 1];
    const uz = P[b + 2] - P[a + 2];
    const vx = P[c] - P[a];
    const vy = P[c + 1] - P[a + 1];
    const vz = P[c + 2] - P[a + 2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l;
    ny /= l;
    nz /= l;
    for (const v of [nx, ny, nz]) {
      view.setFloat32(o, v, true);
      o += 4;
    }
    for (const idx of [a, b, c]) {
      view.setFloat32(o, P[idx], true);
      view.setFloat32(o + 4, P[idx + 1], true);
      view.setFloat32(o + 8, P[idx + 2], true);
      o += 12;
    }
    view.setUint16(o, 0, true);
    o += 2;
  }
  return bytes;
}

/** Parse binary STL (for tests and round trips). */
export function parseStl(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const n = view.getUint32(80, true);
  const triangles = [];
  let o = 84;
  for (let t = 0; t < n; t++) {
    const normal = [view.getFloat32(o, true), view.getFloat32(o + 4, true), view.getFloat32(o + 8, true)];
    const v = [];
    for (let k = 0; k < 3; k++) {
      const q = o + 12 + k * 12;
      v.push([view.getFloat32(q, true), view.getFloat32(q + 4, true), view.getFloat32(q + 8, true)]);
    }
    triangles.push({ normal, vertices: v });
    o += 50;
  }
  return triangles;
}
