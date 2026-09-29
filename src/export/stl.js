// Binary STL writer (little endian): 80-byte header, uint32 triangle count, then per triangle
// normal (3 x float32), three vertices (9 x float32) and a uint16 attribute byte count.

import { checkPrecision } from './precision.js';

/**
 * @throws {MeshPrecisionError} when float32 rounding merges two distinct corners of a triangle
 */
export function meshToStl({ positions: P, indices: I }, header = 'Wingdesigner') {
  checkPrecision(P, I, Math.fround, 'STL stores');
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
