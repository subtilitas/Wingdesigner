// Write STEP and 3MF files for a set of wing configurations plus the expected volumes (from the
// mesh) and triangle counts to a directory, for validation with scripts/validate_step.py
// (OpenCascade) and scripts/validate_3mf.py (lib3mf).
// Usage: node scripts/export-step-cases.mjs <outDir>
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildWing } from '../src/geom/wing.js';
import { exportMeshes, halfWingMesh, meshVolume, tessellateHalf } from '../src/geom/mesh.js';
import { wingToStep } from '../src/export/step.js';
import { meshesTo3mf } from '../src/export/threemf.js';
import { stepCases } from '../test/step-cases.js';

const out = process.argv[2] ?? 'step-check';
mkdirSync(out, { recursive: true });
const cases = [];
for (const c of stepCases()) {
  const build = buildWing(c.project);
  if (build.errors.length) throw new Error(`${c.name}: ${build.errors.join(' ')}`);
  const vol = meshVolume(halfWingMesh(tessellateHalf(build, { uRefine: 4, vRefine: 8 })));
  const file = join(out, `${c.name}.step`);
  writeFileSync(file, wingToStep(build, { mirror: c.mirror, name: c.name, timestamp: '2026-01-01T00:00:00', up: c.up }));
  const meshes = exportMeshes(build, c.mirror ? 'halves' : 'right', { up: c.up });
  const threemf = join(out, `${c.name}.3mf`);
  writeFileSync(threemf, meshesTo3mf(meshes, { title: c.name }));
  cases.push({ file, volumes: c.mirror ? [vol, vol] : [vol], tolerance: 5e-4, threemf, triangles: meshes.map((m) => m.mesh.indices.length / 3) });
}
writeFileSync(join(out, 'cases.json'), JSON.stringify(cases, null, 2));
console.log(`${cases.length} STEP and 3MF files written to ${out}`);
