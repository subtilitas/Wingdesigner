// Write the STEP files of the mold cases (test/mold-cases.js) plus the expected volumes to a
// directory, for validation with scripts/validate_mold.py (OpenCascade).
// Usage: node scripts/export-mold-cases.mjs <outDir>
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

// The wizard presets import the airfoil library from a Vite virtual module: load through Vite.
const root = fileURLToPath(new URL('..', import.meta.url));
const vite = await createServer({ root, configFile: `${root}vite.config.js`, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' });
const load = (path) => vite.ssrLoadModule(path);
const { buildWing } = await load('/src/geom/wing.js');
const { halfWingMesh, meshVolume, tessellateHalf } = await load('/src/geom/mesh.js');
const { moldGeometry } = await load('/src/geom/mold.js');
const { moldToStep } = await load('/src/export/moldstep.js');
const { surfacePoint } = await load('/src/geom/nurbs.js');
const { moldCases } = await load('/test/mold-cases.js');

/** Highest point of a cavity surface above the parting plane zp (the upper half is stored mirrored at it). */
function cavityTop(surface, zp, nu = 400, nv = 200) {
  const [u0, u1] = [surface.knotsU[0], surface.knotsU.at(-1)];
  const [v0, v1] = [surface.knotsV[0], surface.knotsV.at(-1)];
  let top = -Infinity;
  for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) top = Math.max(top, surfacePoint(surface, u0 + ((u1 - u0) * i) / nu, v0 + ((v1 - v0) * j) / nv)[2] - zp);
  return top;
}

const out = process.argv[2] ?? 'mold-check';
mkdirSync(out, { recursive: true });
const cases = [];
for (const c of moldCases()) {
  const build = buildWing(c.project);
  if (build.errors.length) throw new Error(`${c.name}: ${build.errors.join(' ')}`);
  const g = moldGeometry(build, c.mold);
  if (g.errors.length) throw new Error(`${c.name}: ${g.errors.join(' ')}`);
  const file = join(out, `${c.name}.step`);
  writeFileSync(file, moldToStep(g, { name: c.name, timestamp: '2026-01-01T00:00:00', up: c.up }));
  // Both halves together: the blocks less the half wing, the resin channel and the holes. One half
  // alone has no closed-form volume (the ramp parts the wing): it is checked for validity only.
  const wing = meshVolume(halfWingMesh(tessellateHalf(build, { uRefine: 4, vRefine: 8 })));
  const solids = c.solids ?? 2;
  // Extent along the up axis, the parting plane at 0: each half from its block face to the highest
  // point (lower half) or the lowest point (upper half) of the parting plane, of leading edge and
  // trailing edge (the middle of a blunt one), which the ramp meets, and of its cavity surface,
  // sampled 400 × 200. An under-cambered airfoil puts the lower surface above the plane: the lower
  // half reaches up there.
  const s = g.summary;
  const { zp } = g.common;
  const range = {
    lower: [-s.lower, Math.max(0, s.edgeRange[1], cavityTop(g.halves.lower.cavity, zp))],
    upper: [Math.min(0, s.edgeRange[0], -cavityTop(g.halves.upper.cavity, zp)), s.upper],
  };
  cases.push({ file, solids, total: solids === 2 ? s.blockVolume - wing : null, tolerance: 2e-4, up: c.up ?? 'z', lower: g.params.halves !== 'upper', upper: g.params.halves !== 'lower', holes: g.common.holes.length, range });
}
writeFileSync(join(out, 'cases.json'), JSON.stringify(cases, null, 2));
console.log(`${cases.length} mold STEP files written to ${out}`);
await vite.close();
