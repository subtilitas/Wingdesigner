// flow5 import mapping (src/import/xflr5.js with flow5 files): the wing list of a flow5 plane, the
// roll and tilt as rigid part placement, flow5 airfoils, and the built wings against the analysis mesh
// that flow5 builds from the same files (test/fixtures/flow5/mesh-nodes.json, flow5 7.57).
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { setLanguage } from '../src/i18n/index.js';
import { readFl5Bytes } from '../src/import/fl5.js';
import { readFlow5Xml } from '../src/import/fl5xml.js';
import { describeFile, mapXflr5, planeSurfaces, readAirfoilUpload } from '../src/import/xflr5.js';
import { buildWing } from '../src/geom/wing.js';
import { exportMeshes } from '../src/geom/mesh.js';

const bytes = (name) => new Uint8Array(readFileSync(new URL(`fixtures/flow5/${name}`, import.meta.url)));
const text = (name) => readFileSync(new URL(`fixtures/flow5/${name}`, import.meta.url), 'utf8');
const NODES = JSON.parse(text('mesh-nodes.json'));
const BASIC = readFl5Bytes(bytes('basic.fl5'));
const FULL = readFl5Bytes(bytes('full.fl5'));
const planeOf = (file, name) => file.planes.findIndex((p) => p.name === name);

afterEach(() => setLanguage('en'));

const sub = (u, v) => [u[0] - v[0], u[1] - v[1], u[2] - v[2]];
const dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
const len = (u) => Math.sqrt(dot(u, u));
const lerp = (a, u, t) => [a[0] + t * u[0], a[1] + t * u[1], a[2] + t * u[2]];

/** Distance from p to triangle abc (closest point by the regions of the triangle). */
function toTriangle(p, a, b, c) {
  const ab = sub(b, a);
  const ac = sub(c, a);
  const ap = sub(p, a);
  const d1 = dot(ab, ap);
  const d2 = dot(ac, ap);
  if (d1 <= 0 && d2 <= 0) return len(ap);
  const bp = sub(p, b);
  const d3 = dot(ab, bp);
  const d4 = dot(ac, bp);
  if (d3 >= 0 && d4 <= d3) return len(bp);
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) return len(sub(p, lerp(a, ab, d1 / (d1 - d3))));
  const cp = sub(p, c);
  const d5 = dot(ab, cp);
  const d6 = dot(ac, cp);
  if (d6 >= 0 && d5 <= d6) return len(cp);
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) return len(sub(p, lerp(a, ac, d2 / (d2 - d6))));
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) return len(sub(p, lerp(b, sub(c, b), (d4 - d3) / (d4 - d3 + (d5 - d6)))));
  const denom = 1 / (va + vb + vc);
  return len(sub(p, lerp(lerp(a, ab, vb * denom), ac, vc * denom)));
}

/**
 * Largest distance (mm) of flow5's mesh nodes of one half (`side`) from that half as the import
 * builds it. The right half: y >= 0 in flow5's wing frame (before Ry, Rx and the position); the position y,
 * which the import does not use, is taken off.
 */
function rightHalfDistance(project, wing, side = 'right') {
  const [right, left] = exportMeshes(buildWing(project), 'halves').map((m) => m.mesh);
  const half = side === 'right' ? right : left;
  const P = half.positions;
  const I = half.indices;
  const D = Math.PI / 180;
  const [px, py, pz] = wing.pos.map((v) => v * 1000);
  const [rx, ry] = [wing.rx * D, wing.ry * D];
  let max = 0;
  for (const q of wing.nodes) {
    // y in the wing frame: Ry undone (z only), then Rx undone.
    const [x, y, z] = [q[0] - px, q[1] - py, q[2] - pz];
    const zr = x * Math.sin(ry) + z * Math.cos(ry);
    const yLocal = y * Math.cos(rx) + zr * Math.sin(rx);
    if (side === 'right' ? yLocal < -1e-6 : yLocal > 1e-6) continue;
    const p = [q[0], q[1] - py, q[2]];
    let best = Infinity;
    for (let t = 0; t < I.length; t += 3) {
      const v = (k) => [P[3 * I[t + k]], P[3 * I[t + k] + 1], P[3 * I[t + k] + 2]];
      best = Math.min(best, toTriangle(p, v(0), v(1), v(2)));
    }
    max = Math.max(max, best);
  }
  return max;
}

describe('flow5 planes: the wing list', () => {
  it('lists every wing in file order; a one-sided wing turned about z is not available', () => {
    const { surfaces } = planeSurfaces(FULL, planeOf(FULL, 'Tandem'));
    expect(surfaces.map((s) => [s.key, s.label, s.available, s.reason, s.detail])).toEqual([
      ['main', 'Main wing 1', true, null, '"Front": 2 sections, span 999 mm, root chord 200 mm'],
      ['wing:1', 'Main wing 2', true, null, '"Rear": 2 sections, span 900 mm, root chord 180 mm'],
      ['stab', 'Horizontal stabilizer (flow5: Elevator)', true, null, '"Vee": 2 sections, span 326 mm, root chord 100 mm'],
      ['wing:3', 'Other wing 1', true, null, '"Canard": 2 sections, span 300 mm, root chord 80 mm'],
      ['wing:4', 'Other wing 2', true, null, '"Tilted other": 2 sections, span 200 mm, root chord 80 mm'],
      ['wing:5', 'Fin', true, null, '"Fin": 2 sections, span 240 mm, root chord 100 mm'],
    ]);
    const yawed = structuredClone(BASIC);
    yawed.planes[0].wings[2].tilt = 3;
    expect(planeSurfaces(yawed).surfaces[2]).toMatchObject({ available: false, reason: 'A one-sided wing turned 3° about z (Ry_angle): a part turns about x and y only.' });
    const r = mapXflr5(yawed, { surface: 'wing:2', fileName: 'basic.fl5' });
    expect([r.project, r.report.filter((l) => l.severity === 'error').map((l) => l.text)]).toEqual([null, ['A one-sided wing turned 3° about z (Ry_angle): a part turns about x and y only.']]);
    expect(describeFile(FULL)).toBe('flow5 project, format 500754 (flow5 7.54 or later)');
    expect(describeFile(readFlow5Xml(text('full-plane.xml')))).toBe('flow5 plane file (XML), lengths in millimetres');
  });

  it('imports a further wing and names it in the summary; the other wings are listed as not imported', () => {
    const r = mapXflr5(FULL, { plane: planeOf(FULL, 'Tandem'), surface: 'wing:3', fileName: 'full.fl5' });
    expect(r.summary).toBe('Imported the wing "Canard" of "Tandem" from full.fl5: 2 sections, 1 airfoil.');
    expect(r.report.map((l) => l.text)).toContain('Not imported: Main wing 1 "Front", Main wing 2 "Rear", Horizontal stabilizer (flow5: Elevator) "Vee", Other wing 2 "Tilted other", Fin "Fin". One surface per import; open the file again for another one.');
    expect(r.project.settings).toMatchObject({ partTilt: 2, partRoll: 0, partPivot: { x: -300, y: 0, z: 20 } });
  });

  it('imports a fin as the half flow5 builds: the left half of the part, with the opposite roll', () => {
    for (const [file, planeName, key, nodes] of [
      [BASIC, 'Test plane', 'wing:2', 'basic/Test plane/Fin'],
      [FULL, 'Tandem', 'wing:5', 'full/Tandem/Fin'],
    ]) {
      const r = mapXflr5(file, { plane: planeOf(file, planeName), surface: key, fileName: 'f.fl5' });
      expect(r.project.settings, nodes).toMatchObject({ partRoll: 90, partTilt: 0 });
      expect(r.report.map((l) => l.text).some((t) => t.startsWith('A one-sided wing: flow5 builds its left half only'))).toBe(true);
      expect([r.project.settings.leftHalf, r.report.some((l) => l.text.startsWith('flow5 rolls the whole wing'))]).toEqual(['mirror', false]);
      expect(rightHalfDistance(r.project, NODES[nodes], 'left'), nodes).toBeLessThan(0.01);
    }
  });
});

describe('flow5 planes: geometry', () => {
  it('builds the right half of every imported wing within 0.15 mm of the analysis mesh of flow5', () => {
    const cases = [
      [BASIC, 'Test plane', 'main', 'basic/Test plane/Main', 0.08],
      [BASIC, 'Test plane', 'stab', 'basic/Test plane/Stab', 0.005],
      // Two airfoils blended along the panel: NACA 2412 to the flapped NACA 2410.
      [FULL, 'Tandem', 'main', 'full/Tandem/Front', 0.15],
      [FULL, 'Tandem', 'wing:1', 'full/Tandem/Rear', 0.011],
      [FULL, 'Tandem', 'stab', 'full/Tandem/Vee', 0.006],
      [FULL, 'Tandem', 'wing:3', 'full/Tandem/Canard', 0.004],
      [FULL, 'Second', 'main', 'full/Second/Wing2', 0.08],
      [FULL, 'Tandem', 'wing:4', 'full/Tandem/Tilted other', 0.01],
    ];
    for (const [file, planeName, surface, key, tolerance] of cases) {
      const r = mapXflr5(file, { plane: planeOf(file, planeName), surface, fileName: 'f.fl5' });
      expect(r.errors, key).toBe(0);
      expect(rightHalfDistance(r.project, NODES[key]), key).toBeLessThan(tolerance);
    }
  });

  it('turns a rolled wing as one body, as flow5 does: both halves within 0.01 mm of flow5', () => {
    const r = mapXflr5(FULL, { plane: planeOf(FULL, 'Tandem'), surface: 'stab', fileName: 'full.fl5' });
    expect(r.project.settings).toMatchObject({ partTilt: -2, partRoll: 10, partPivot: { x: 1000, y: 0, z: 80 }, leftHalf: 'turned', sectionPlanes: 'mitred' });
    expect(r.report.filter((l) => l.severity !== 'info')).toEqual([]);
    expect(r.report.map((l) => l.text)).toContain('Roll angle 10° (Rx_angle) applied as in the flow5 plane: the part turns as a rigid body about the wing origin, before the tilt (Settings > Part roll).');
    expect(r.report.map((l) => l.text)).toContain('flow5 rolls the whole wing as one body, so its left half rolls the other way: Settings > Left half is set to Turned with the right half.');
    for (const side of ['right', 'left']) expect(rightHalfDistance(r.project, NODES['full/Tandem/Vee'], side), side).toBeLessThan(0.01);
    const other = mapXflr5(FULL, { plane: planeOf(FULL, 'Tandem'), surface: 'wing:4', fileName: 'full.fl5' });
    for (const side of ['right', 'left']) expect(rightHalfDistance(other.project, NODES['full/Tandem/Tilted other'], side), side).toBeLessThan(0.01);
    // Without a roll the two kinds of left half are the same; the import keeps the default.
    expect(mapXflr5(FULL, { plane: planeOf(FULL, 'Tandem'), surface: 'wing:3', fileName: 'full.fl5' }).project.settings.leftHalf).toBe('mirror');
    setLanguage('de');
    expect(mapXflr5(FULL, { plane: planeOf(FULL, 'Tandem'), surface: 'stab', fileName: 'full.fl5' }).report.map((l) => l.text)).toContain(
      'flow5 rollt den ganzen Flügel als einen Körper, seine linke Hälfte rollt also in die andere Richtung: Einstellungen > Linke Hälfte ist auf Mit der rechten Hälfte gedreht gestellt.',
    );
  });

  it('does not use the position y, as for XFLR5', () => {
    const r = mapXflr5(FULL, { plane: planeOf(FULL, 'Second'), surface: 'main', fileName: 'full.fl5' });
    expect(r.report.map((l) => l.text)).toContain('Position y 20 mm is not used, as in flow5.');
    // The root at the position x and z; the airfoil frame of flow5's NACA 2412 moves it by 0.002 mm.
    const root = r.project.sections[0];
    expect([root.x, root.y, root.z].map((v) => Number(v.toFixed(2)))).toEqual([10, 0, 30]);
  });
});

describe('flow5 planes: airfoils', () => {
  it('takes the airfoils of a .fl5 project with the source kind flow5 and notes their flaps', () => {
    const r = mapXflr5(FULL, { plane: planeOf(FULL, 'Tandem'), surface: 'main', fileName: 'full.fl5' });
    expect(r.rows.map((row) => [row.name, row.found])).toEqual([
      ['NACA 2412', 'file'],
      ['Flapped 2410', 'file'],
    ]);
    expect(r.project.airfoils.map((a) => a.source)).toEqual([
      { kind: 'flow5', file: 'full.fl5', note: 'Airfoil "NACA 2412" from flow5 plane "Tandem"; the stored shape.' },
      { kind: 'flow5', file: 'full.fl5', note: 'Airfoil "Flapped 2410" from flow5 plane "Tandem"; the stored shape.' },
    ]);
    expect(r.report).toContainEqual({ severity: 'info', text: 'Airfoil "Flapped 2410" has a trailing-edge flap in flow5 (hinge at 75 % chord); flow5 deflects it in its analyses only, and the stored shape is imported.' });
    // A current-project airfoil of a flow5 import keeps no frame of its own.
    const again = mapXflr5(readFlow5Xml(text('full-plane.xml')), { surface: 'wing:1', fileName: 'full-plane.xml', project: r.project, choices: { 'NACA 2412': `project:${r.project.airfoils[0].id}` } });
    expect(again.report.map((l) => l.text).some((t) => t.startsWith('Airfoil "NACA 2412" (sections 1–2) of the current project is stored scaled to unit chord'))).toBe(true);
  });

  it('matches the .dat files that flow5 writes next to an XML file by name, and builds the wing as from the .fl5 project', () => {
    const file = readFlow5Xml(text('full-plane-files.xml'));
    const without = mapXflr5(file, { surface: 'main', fileName: 'full-plane-files.xml' });
    expect(without.rows.map((row) => [row.name, row.found])).toEqual([
      ['NACA 2412', 'naca'],
      ['Flapped 2410', 'missing'],
    ]);
    const uploads = ['NACA 2412.dat', 'Flapped 2410.dat'].map((name) => readAirfoilUpload(text(name), name));
    const r = mapXflr5(file, { surface: 'main', fileName: 'full-plane-files.xml', uploads });
    expect(r.rows.map((row) => [row.name, row.found, row.key])).toEqual([
      ['NACA 2412', 'upload', 'upload:0'],
      ['Flapped 2410', 'upload', 'upload:1'],
    ]);
    expect(rightHalfDistance(r.project, NODES['full/Tandem/Front'])).toBeLessThan(0.15);
  });
});
