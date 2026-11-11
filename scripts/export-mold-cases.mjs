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
const { moldCases } = await load('/test/mold-cases.js');

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
  // (lower half) or lowest (upper half) point of leading edge and trailing edge, which the ramp meets.
  const s = g.summary;
  const range = { lower: [-s.lower, Math.max(0, s.edgeRange[1])], upper: [Math.min(0, s.edgeRange[0]), s.upper] };
  cases.push({ file, solids, total: solids === 2 ? s.blockVolume - wing : null, tolerance: 2e-4, up: c.up ?? 'z', lower: g.params.halves !== 'upper', upper: g.params.halves !== 'lower', holes: g.common.holes.length, range });
}
writeFileSync(join(out, 'cases.json'), JSON.stringify(cases, null, 2));
console.log(`${cases.length} mold STEP files written to ${out}`);
await vite.close();
