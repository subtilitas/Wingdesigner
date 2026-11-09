// Cuts the loft surface of the Glider preset with a rounded tip ("Continue the ellipse") at
// y = const every 1 mm over the outer 5 % of the half span and writes the cuts as JSON.
// Usage: node docs/analysis/rounded-tip-cuts/extract-cuts.mjs <out.json>
import { writeFileSync } from 'node:fs';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

// The source imports the airfoil library from a Vite virtual module: load it through Vite.
const root = fileURLToPath(new URL('../../..', import.meta.url));
const vite = await createServer({ root, configFile: `${root}vite.config.js`, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' });
const load = (path) => vite.ssrLoadModule(path);
const { addRoundTip, defaultRoundTip, wingEllipse } = await load('/src/model/roundtip.js');
const { PRESETS, wizardProject } = await load('/src/model/wizard.js');
const { buildWing } = await load('/src/geom/wing.js');
const { surfacePoint } = await load('/src/geom/nurbs.js');
const { sortedSections } = await load('/src/model/edit.js');

const p = wizardProject(PRESETS.glider.params);
const e = wingEllipse(p);
addRoundTip(p, defaultRoundTip(p));
const b = buildWing(p);
if (b.errors.length) throw new Error(b.errors[0]);
const NU = 600;
const us = Array.from({ length: NU + 1 }, (_, i) => i / NU);
// y of the surface grows with v for every u: bisection for v at a given y.
const cutAt = (y) =>
  us.map((u) => {
    if (surfacePoint(b.surface, u, 1)[1] < y) return null;
    let lo = 0;
    let hi = 1;
    for (let k = 0; k < 60; k++) {
      const m = (lo + hi) / 2;
      if (surfacePoint(b.surface, u, m)[1] < y) lo = m;
      else hi = m;
    }
    const P = surfacePoint(b.surface, u, (lo + hi) / 2);
    return [P[0], P[2]];
  });
const tipY = b.tipY;
const y0 = tipY - 0.05 * (tipY - b.rootY);
const cuts = [];
for (let y = Math.ceil(y0); y < tipY; y += 1) {
  const pts = cutAt(y).filter(Boolean);
  if (pts.length < 10) continue;
  const xs = pts.map((q) => q[0]);
  const zs = pts.map((q) => q[1]);
  cuts.push({ y, pts, le: Math.min(...xs), te: Math.max(...xs), zmin: Math.min(...zs), zmax: Math.max(...zs), n: pts.length });
}
// Leading edge (u = uLE) and trailing edge (u = 0) of the surface, 4000 steps in v.
const v0 = b.vAt(y0 - 5);
const edge = (u) =>
  Array.from({ length: 4001 }, (_, i) => {
    const P = surfacePoint(b.surface, u, v0 + ((1 - v0) * i) / 4000);
    return [P[1], P[0], P[2]];
  });
const out = {
  tipY, rootY: b.rootY, y0,
  ellipse: { k: e.k, m: e.m, y0: e.y0, end: e.y0 + 1 / Math.sqrt(e.m) },
  sections: sortedSections(p).filter((s) => s.y > y0 - 60).map((s) => ({ y: s.y, x: s.x, chord: s.chord, z: s.z, roundTip: s.roundTip ?? null })),
  te: p.settings.trailingEdge, tip: p.settings.tip, spanwise: p.settings.spanwise,
  cuts, le: edge(b.uLE), teU: edge(0),
};
writeFileSync(process.argv[2] ?? 'cuts.json', JSON.stringify(out));
console.log(`${cuts.length} cuts, point at y = ${tipY.toFixed(3)} mm, ellipse end ${out.ellipse.end.toFixed(3)} mm`);
await vite.close();
