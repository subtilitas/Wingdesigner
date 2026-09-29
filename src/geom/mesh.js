// Tessellation of the wing surface into a closed, outward-oriented triangle mesh, mirroring,
// and mesh measures (volume, area, edge manifold check).

import { surfacePointGrid } from './nurbs.js';
import { stripTriangulate } from './triangulate.js';

function refine(params, r) {
  if (r <= 1) return params.slice();
  const out = [];
  for (let i = 0; i < params.length - 1; i++) {
    for (let k = 0; k < r; k++) out.push(params[i] + ((params[i + 1] - params[i]) * k) / r);
  }
  out.push(params[params.length - 1]);
  return out;
}

/**
 * Tessellate the half wing of a build result.
 * @returns {{positions: Float64Array, surface: number[], trailingEdge: number[], rootCap: number[], tipCap: number[], rows: number, cols: number, rootLoop: number[], tipLoop: number[]}}
 */
export function tessellateHalf(build, { uRefine = 1, vRefine } = {}) {
  const S = build.surface;
  const us = refine(build.paramsU, uRefine);
  const vs = refine(build.paramsV, vRefine ?? (S.degreeV === 1 ? 1 : 3));
  const closed = build.closedTE;
  const M = us.length;
  const cols = closed ? M - 1 : M; // distinct vertices per row
  const V = vs.length;
  const positions = new Float64Array(cols * V * 3);
  surfacePointGrid(S, us.slice(0, cols), vs, (k, j, P) => {
    const o = (k * cols + j) * 3;
    positions[o] = P[0];
    positions[o + 1] = P[1];
    positions[o + 2] = P[2];
  });
  const id = (j, k) => k * cols + (j % cols);
  const surface = [];
  for (let k = 0; k < V - 1; k++) {
    for (let j = 0; j < M - 1; j++) {
      const a = id(j, k);
      const b = id(j + 1, k);
      const c = id(j + 1, k + 1);
      const d = id(j, k + 1);
      surface.push(a, c, b, a, d, c);
    }
  }
  const trailingEdge = [];
  if (!closed) {
    for (let k = 0; k < V - 1; k++) {
      const a = id(M - 1, k);
      const b = id(0, k);
      const c = id(0, k + 1);
      const d = id(M - 1, k + 1);
      trailingEdge.push(a, c, b, a, d, c);
    }
  }
  const loop = (k) => Array.from({ length: cols }, (_, j) => id(j, k));
  const leIndex = build.leIndex * uRefine;
  const rootLoop = loop(0);
  const tipLoop = loop(V - 1);
  const cap = (ring, flip) => {
    const poly = ring.map((i) => [positions[i * 3], positions[i * 3 + 2]]);
    const out = [];
    for (const [a, b, c] of stripTriangulate(poly, leIndex)) {
      if (flip) out.push(ring[a], ring[c], ring[b]);
      else out.push(ring[a], ring[b], ring[c]);
    }
    return out;
  };
  // Selig order is counterclockwise in (x, z); a CCW triangle in (x, z) has normal -y.
  const rootCap = cap(rootLoop, false);
  const tipCap = cap(tipLoop, true);
  return { positions, surface, trailingEdge, rootCap, tipCap, rows: V, cols, rootLoop, tipLoop };
}

/** Closed mesh of the half wing (right side). */
export function halfWingMesh(half) {
  return {
    positions: half.positions,
    indices: Uint32Array.from([...half.surface, ...half.trailingEdge, ...half.rootCap, ...half.tipCap]),
  };
}

/**
 * Full wing: the half wing plus its mirror image at y = 0. When the root lies on y = 0 the halves
 * share the root vertices and form one closed shell without root caps; otherwise two closed shells.
 */
export function fullWingMesh(half, rootY) {
  const n = half.positions.length / 3;
  const merge = Math.abs(rootY) < 1e-9;
  const rootSet = new Set(merge ? half.rootLoop : []);
  const map = new Int32Array(n);
  let next = n;
  for (let i = 0; i < n; i++) map[i] = rootSet.has(i) ? i : next++;
  const positions = new Float64Array(next * 3);
  positions.set(half.positions);
  for (let i = 0; i < n; i++) {
    if (rootSet.has(i)) continue;
    const o = map[i] * 3;
    positions[o] = half.positions[i * 3];
    positions[o + 1] = -half.positions[i * 3 + 1];
    positions[o + 2] = half.positions[i * 3 + 2];
  }
  const rightTris = merge ? [...half.surface, ...half.trailingEdge, ...half.tipCap] : [...half.surface, ...half.trailingEdge, ...half.rootCap, ...half.tipCap];
  const leftTris = [];
  for (let t = 0; t < rightTris.length; t += 3) {
    leftTris.push(map[rightTris[t]], map[rightTris[t + 2]], map[rightTris[t + 1]]);
  }
  return { positions, indices: Uint32Array.from([...rightTris, ...leftTris]), shells: merge ? 1 : 2 };
}

/** Signed volume (positive for outward-oriented closed meshes). */
export function meshVolume({ positions: P, indices: I }) {
  let v = 0;
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3;
    const b = I[t + 1] * 3;
    const c = I[t + 2] * 3;
    v +=
      P[a] * (P[b + 1] * P[c + 2] - P[b + 2] * P[c + 1]) -
      P[a + 1] * (P[b] * P[c + 2] - P[b + 2] * P[c]) +
      P[a + 2] * (P[b] * P[c + 1] - P[b + 1] * P[c]);
  }
  return v / 6;
}

export function meshArea({ positions: P, indices: I }) {
  let s = 0;
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
    s += Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
  }
  return s;
}

/**
 * Edge check: a closed, consistently oriented 2-manifold uses every directed edge exactly once
 * and its reverse exactly once.
 */
export function edgeCheck({ indices: I }) {
  const directed = new Map();
  const key = (a, b) => `${a},${b}`;
  for (let t = 0; t < I.length; t += 3) {
    for (let e = 0; e < 3; e++) {
      const a = I[t + e];
      const b = I[t + ((e + 1) % 3)];
      const k = key(a, b);
      directed.set(k, (directed.get(k) ?? 0) + 1);
    }
  }
  let boundary = 0;
  let duplicated = 0;
  for (const [k, count] of directed) {
    if (count > 1) duplicated++;
    const [a, b] = k.split(',');
    if (!directed.has(key(b, a))) boundary++;
  }
  let degenerate = 0;
  for (let t = 0; t < I.length; t += 3) {
    if (I[t] === I[t + 1] || I[t + 1] === I[t + 2] || I[t] === I[t + 2]) degenerate++;
  }
  return { boundary, duplicated, degenerate, closed: boundary === 0 && duplicated === 0 && degenerate === 0 };
}

export function meshBounds({ positions: P }) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < P.length; i += 3) {
    for (let c = 0; c < 3; c++) {
      if (P[i + c] < min[c]) min[c] = P[i + c];
      if (P[i + c] > max[c]) max[c] = P[i + c];
    }
  }
  return { min, max };
}

/** Mirror image of a closed mesh at the plane y = 0 (winding reversed so normals stay outward). */
export function mirrorMesh({ positions, indices }) {
  const P = Float64Array.from(positions);
  for (let i = 1; i < P.length; i += 3) P[i] = -P[i];
  const I = new Uint32Array(indices.length);
  for (let t = 0; t < indices.length; t += 3) {
    I[t] = indices[t];
    I[t + 1] = indices[t + 2];
    I[t + 2] = indices[t + 1];
  }
  return { positions: P, indices: I };
}

/** Largest mesh export in triangles: about 100 MB of binary STL. */
export const MAX_EXPORT_TRIANGLES = 2_000_000;

/**
 * Triangles of an export: surface quads, trailing-edge strip and caps per half, times the shells.
 * The count is exact for the surface and trailing edge and bounds the caps by the ring size.
 */
export function exportTriangles(build, mode = 'halves', { uRefine = 1, vRefine } = {}) {
  const M = (build.paramsU.length - 1) * uRefine + 1;
  const V = (build.paramsV.length - 1) * (vRefine ?? (build.surface.degreeV === 1 ? 1 : 3)) + 1;
  const half = 2 * (M - 1) * (V - 1) + (build.closedTE ? 0 : 2 * (V - 1)) + 2 * M;
  return mode === 'right' ? half : 2 * half;
}

/**
 * Meshes for export.
 * mode 'right': the right half as one closed shell.
 * mode 'halves': right and left halves as two closed shells (root caps included).
 * mode 'merged': one closed shell for the full wing when the root lies on y = 0, otherwise like 'halves'.
 * @returns {{name: string, mesh: {positions: Float64Array, indices: Uint32Array}}[]}
 */
export function exportMeshes(build, mode = 'halves', { uRefine = 1, vRefine } = {}) {
  const half = tessellateHalf(build, { uRefine, vRefine });
  const right = halfWingMesh(half);
  if (mode === 'right') return [{ name: 'Wing right', mesh: right }];
  if (mode === 'merged' && Math.abs(build.rootY) < 1e-9) {
    const full = fullWingMesh(half, build.rootY);
    return [{ name: 'Wing', mesh: { positions: full.positions, indices: full.indices } }];
  }
  return [
    { name: 'Wing right', mesh: right },
    { name: 'Wing left', mesh: mirrorMesh(right) },
  ];
}

/** Concatenate meshes into one vertex/index buffer (shells stay separate). */
export function concatMeshes(meshes) {
  const nv = meshes.reduce((s, m) => s + m.positions.length, 0);
  const ni = meshes.reduce((s, m) => s + m.indices.length, 0);
  const positions = new Float64Array(nv);
  const indices = new Uint32Array(ni);
  let pv = 0;
  let pi = 0;
  for (const m of meshes) {
    positions.set(m.positions, pv);
    const off = pv / 3;
    for (let k = 0; k < m.indices.length; k++) indices[pi + k] = m.indices[k] + off;
    pv += m.positions.length;
    pi += m.indices.length;
  }
  return { positions, indices };
}
