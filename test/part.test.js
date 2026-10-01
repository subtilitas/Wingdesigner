// Rigid placement of the whole part (settings.partTilt, partRoll, partPivot; src/geom/part.js): the
// transform, its use in the build, the meshes, STEP and the statistics, and the upgrade of a tilt
// that an XFLR5 import folded into the sections of a project file of format version 2.
import { describe, expect, it } from 'vitest';
import { partPivot, partTransform } from '../src/geom/part.js';
import { buildWing } from '../src/geom/wing.js';
import { dist, surfacePoint } from '../src/geom/nurbs.js';
import { edgeCheck, exportMeshes, meshVolume } from '../src/geom/mesh.js';
import { wingStats } from '../src/geom/stats.js';
import { wingToStep } from '../src/export/step.js';
import { projectFromJsonText, projectToJson, upgradeFoldedTilt } from '../src/model/io.js';
import { LIMITS, validateProject } from '../src/model/project.js';
import { sampleProject } from './helpers.js';
import { defaultGuides } from '../src/geom/guide.js';

const DEG = Math.PI / 180;

/** The sample wing with a rigid placement. */
const placed = (settings) => sampleProject({ settings });

/** Surface points of a build in the plane frame at a few (u, v). */
const UV = [
  [0, 0],
  [0.3, 0.2],
  [0.5, 0.5],
  [0.8, 0.9],
  [1, 1],
];
const planePoints = (b) => UV.map(([u, v]) => b.part.point(surfacePoint(b.surface, u, v)));

/**
 * The project of a version 2 file with the tilt folded in as the XFLR5 import folded it: each twist
 * pivot point (x + p · c, z) turned about (px, pz) by `angle`, the angle added to every twist.
 */
function foldedProject(project, angle, px, pz) {
  const p = structuredClone(project);
  const piv = p.settings.twistPivot;
  const c = Math.cos(angle * DEG);
  const s = Math.sin(angle * DEG);
  for (const q of p.sections) {
    const x = q.x + piv * q.chord - px;
    const z = q.z - pz;
    q.x = x * c + z * s + px - piv * q.chord;
    q.z = -x * s + z * c + pz;
    q.twist += angle;
  }
  p.foldedTilt = { angle, x: px, z: pz };
  // The import sets the guides from its (folded) sections.
  p.guides = defaultGuides(p.sections);
  return p;
}

describe('part transform', () => {
  it('raises the leading edge with a positive tilt and the right tip with a positive roll, roll first', () => {
    const tilt = partTransform({ partTilt: 10, partPivot: { x: 0, y: 0, z: 0 } }, []);
    // A point ahead of the pivot (x < 0) goes up, one behind it goes down.
    expect(tilt.point([-100, 0, 0])[2]).toBeCloseTo(100 * Math.sin(10 * DEG), 12);
    expect(tilt.point([100, 0, 0])[2]).toBeCloseTo(-100 * Math.sin(10 * DEG), 12);
    const roll = partTransform({ partRoll: 10, partPivot: { x: 0, y: 0, z: 0 } }, []);
    expect(roll.point([0, 500, 0])[2]).toBeCloseTo(500 * Math.sin(10 * DEG), 12);
    // Roll about x first, then tilt about y: the tip (0, 500, 0) rolls up and then keeps its height
    // under the tilt about y only where x stays 0.
    const both = partTransform({ partTilt: 30, partRoll: 90, partPivot: { x: 0, y: 0, z: 0 } }, []);
    const p = both.point([0, 500, 0]);
    expect(p.map((v) => +v.toFixed(9))).toEqual([+(500 * Math.sin(30 * DEG)).toFixed(9), 0, +(500 * Math.cos(30 * DEG)).toFixed(9)]);
    // A rotation: lengths and the determinant stay.
    const M = both.matrix;
    const det = M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) - M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) + M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);
    expect(det).toBeCloseTo(1, 12);
    expect(Math.hypot(...both.vector([3, 4, 12]))).toBeCloseTo(13, 12);
  });

  it('turns about the stored pivot, else about the leading edge of the root section', () => {
    const p = sampleProject();
    expect(partPivot(p.settings, p.sections)).toEqual([0, 0, 0]);
    p.sections.forEach((q) => (q.y += 35));
    p.sections[0].x = 12;
    p.sections[0].z = -4;
    expect(partPivot(p.settings, p.sections)).toEqual([12, 35, -4]);
    expect(partPivot({ partPivot: { x: 1, y: 2, z: 3 } }, p.sections)).toEqual([1, 2, 3]);
    const t = partTransform({ partTilt: 20 }, p.sections);
    expect(t.point([12, 35, -4])).toEqual([12, 35, -4]);
    expect(partTransform({}, p.sections).identity).toBe(true);
  });

  it('validates the angles and the pivot', () => {
    const p = sampleProject();
    for (const [settings, ok] of [
      [{ partTilt: 180, partRoll: -180 }, true],
      [{ partTilt: 180.5 }, false],
      [{ partRoll: Number.NaN }, false],
      [{ partPivot: { x: 1, y: 2, z: 3 } }, true],
      [{ partPivot: { x: 1, y: 2 } }, false],
      [{ partPivot: { x: 2e6, y: 0, z: 0 } }, false],
    ]) {
      p.settings = { ...sampleProject().settings, ...settings };
      expect(validateProject(p).ok, JSON.stringify(settings)).toBe(ok);
    }
    expect(LIMITS.maxPartAngle).toBe(180);
  });
});

describe('build and exports of a placed part', () => {
  it('turns the surface rigidly: every exported point is the turned point of the untilted build', () => {
    const flat = buildWing(sampleProject());
    const b = buildWing(placed({ partTilt: 4, partRoll: 7 }));
    expect(b.errors).toEqual([]);
    // The build itself stays in the part frame.
    expect(b.surface).toEqual(flat.surface);
    const t = partTransform({ partTilt: 4, partRoll: 7 }, sampleProject().sections);
    planePoints(b).forEach((p, i) => expect(dist(p, t.point(surfacePoint(flat.surface, ...UV[i])))).toBeLessThan(1e-12));
    // Meshes: the right half turned, the left half its mirror image at y = 0; volume and closure kept.
    const [right, left] = exportMeshes(b, 'halves');
    const [r0, l0] = exportMeshes(flat, 'halves');
    expect(meshVolume(right.mesh)).toBeCloseTo(meshVolume(r0.mesh), 6);
    expect(meshVolume(left.mesh)).toBeCloseTo(meshVolume(l0.mesh), 6);
    expect(edgeCheck(right.mesh).closed).toBe(true);
    for (let i = 0; i < right.mesh.positions.length; i += 3) {
      const q = t.point([r0.mesh.positions[i], r0.mesh.positions[i + 1], r0.mesh.positions[i + 2]]);
      for (let k = 0; k < 3; k++) expect(right.mesh.positions[i + k]).toBeCloseTo(q[k], 9);
      expect(left.mesh.positions[i + 1]).toBeCloseTo(-right.mesh.positions[i + 1], 9);
    }
  });

  it('merges the halves of a tilted part, not of a rolled one', () => {
    expect(exportMeshes(buildWing(placed({ partTilt: 5 })), 'merged')).toHaveLength(1);
    expect(exportMeshes(buildWing(placed({ partRoll: 5 })), 'merged')).toHaveLength(2);
  });

  it('writes the turned surfaces and caps into STEP', () => {
    const b = buildWing(placed({ partTilt: 30, partPivot: { x: 100, y: 0, z: 0 } }));
    const step = wingToStep(b, { mirror: false, timestamp: '2026-01-01T00:00:00' });
    // The leading edge of the root (0, 0, 0) turns 30° about (100, 0, 0): (100 − 100 cos 30°, 0, 100 sin 30°).
    const le = [100 - 100 * Math.cos(30 * DEG), 0, 100 * Math.sin(30 * DEG)];
    const points = [...step.matchAll(/CARTESIAN_POINT\('',\(([^)]*)\)\)/g)].map((m) => m[1].split(',').map(Number));
    expect(points.some((p) => dist(p, le) < 1e-9)).toBe(true);
    // The root cap normal −y stays −y under a tilt about y; its reference direction x turns.
    const dirs = [...step.matchAll(/DIRECTION\('',\(([^)]*)\)\)/g)].map((m) => m[1].split(',').map(Number));
    expect(dirs.some((d) => dist(d, [Math.cos(30 * DEG), 0, -Math.sin(30 * DEG)]) < 1e-12)).toBe(true);
    expect(dirs.some((d) => dist(d, [0, -1, 0]) < 1e-12)).toBe(true);
  });

  it('refuses a part that the turn takes beyond the extent limit', () => {
    const p = sampleProject();
    // At x = z = 999,000 mm the part lies within the limit; turned 45° about the origin it reaches
    // x = 999,000 · (cos 45° + sin 45°) = 1,412,800 mm.
    p.sections.forEach((q) => {
      q.x += 999_000;
      q.z += 999_000;
    });
    expect(buildWing(p).errors).toEqual([]);
    p.settings.partTilt = 45;
    p.settings.partPivot = { x: 0, y: 0, z: 0 };
    const b = buildWing(p);
    expect(b.surface).toBeNull();
    expect(b.errors).toEqual([expect.stringMatching(/^The tilted or rolled part reaches x = .* mm, beyond ±1200000 mm; reduce the part tilt or roll, or move the part towards its pivot\.$/)]);
  });

  it('gives the statistics in the plane axes: the MAC leading edge and 25 % MAC turned with the part', () => {
    const flat = wingStats(buildWing(sampleProject()));
    const b = buildWing(placed({ partTilt: 10, partPivot: { x: 0, y: 0, z: 0 } }));
    const s = wingStats(b);
    expect([s.area, s.mac, s.span]).toEqual([flat.area, flat.mac, flat.span]);
    const z = (flat.macY / 300) * 10;
    const le = b.part.point([flat.macXLE, flat.macY, z]);
    expect(s.macXLE).toBeCloseTo(le[0], 9);
    expect(s.x25).toBeCloseTo(b.part.point([flat.macXLE + 0.25 * flat.mac, flat.macY, z])[0], 9);
    expect(flat.x25).toBeCloseTo(flat.macXLE + 0.25 * flat.mac, 12);
    // A roll lifts the tip: the span in the plane axes is shorter.
    expect(wingStats(buildWing(placed({ partRoll: 30 }))).span).toBeLessThan(flat.span);
    // A roll of 180° turns the right tip to y < 0; the tips stay as far apart.
    expect(wingStats(buildWing(placed({ partRoll: 180 }))).span).toBeCloseTo(flat.span, 9);
  });
});

describe('upgrade of a folded tilt (project format version 2)', () => {
  /** A version 2 file of `project`. */
  const v2 = (project) => JSON.stringify({ ...projectToJson(project, null), version: 2 });

  for (const [label, settings] of [
    ['twist pivot 0.25, flat tip', {}],
    ['twist pivot 0.5', { twistPivot: 0.5 }],
    ['pointed tip', { tip: { mode: 'pointed', ratio: 0.005 } }],
    ['straight panels', { spanwise: 'straight' }],
  ]) {
    it(`builds the same part with vertical planes: ${label}`, () => {
      const base = sampleProject({ settings });
      const folded = foldedProject(base, 3, 40, 10);
      const before = buildWing(folded);
      expect(before.errors).toEqual([]);
      const r = projectFromJsonText(v2(folded));
      expect(r.ok).toBe(true);
      expect(r.project.foldedTilt).toBeUndefined();
      expect(r.project.settings).toMatchObject({ partTilt: 3, partRoll: 0, partPivot: { x: 40, y: 0, z: 10 } });
      expect(r.notes).toEqual(['The tilt angle of 3° that the XFLR5 import folded into the sections is a rigid tilt of the whole part (Settings > Part tilt); the sections hold the values of the untilted part.']);
      const after = buildWing(r.project);
      expect(after.errors).toEqual([]);
      // The sections are the untilted ones (pointed tip: the scaled tip chord turns the last one back).
      if (!settings.tip) r.project.sections.forEach((q, i) => ['x', 'z', 'twist'].forEach((k) => expect(q[k]).toBeCloseTo(base.sections[i][k], 9)));
      const want = UV.map(([u, v]) => surfacePoint(before.surface, u, v));
      planePoints(after).forEach((p, i) => expect(dist(p, want[i]), `point ${i}`).toBeLessThan(1e-6));
      // The MAC position moves less than 0.15 mm at 3° (0.105 mm measured): the folded sections give
      // each leading edge as the turned twist pivot less p · c, the plane axes turn the leading edge itself.
      const s0 = wingStats(before);
      const s1 = wingStats(after);
      expect(Math.abs(s1.macXLE - s0.macXLE)).toBeLessThan(0.15);
      expect(Math.abs(s1.x25 - s0.x25)).toBeLessThan(0.15);
    });
  }

  it('changes the shape of a mitred project towards the rigid tilt, and says so', () => {
    const r = projectFromJsonText(v2(foldedProject(sampleProject({ settings: { sectionPlanes: 'mitred' } }), 3, 0, 0)));
    expect(r.notes).toHaveLength(2);
    expect(r.notes[1]).toBe('With mitred section planes the shape changes: the folded tilt was exact for vertical planes only, the rigid tilt places the part as XFLR5 does.');
  });

  it('keeps the fold where guide curves or the twist limit stand in the way', () => {
    const cases = [
      ['enabled guide', (p) => (p.guides.nose.enabled = true)],
      ['disabled edited guide', (p) => (p.guides.end.edited = true)],
    ];
    for (const [label, change] of cases) {
      const p = foldedProject(sampleProject(), 3, 0, 0);
      change(p);
      const copy = structuredClone(p);
      const notes = upgradeFoldedTilt(p);
      expect(notes, label).toEqual(['The tilt angle of 3° of the XFLR5 import stays folded into the sections: a guide curve is on or edited, and guide curves hold x only.']);
      expect(p, label).toEqual(copy);
    }
    // A twist of 358° folded with −3°: without the fold it would be 361°.
    const p = sampleProject();
    p.sections[2].twist = 358;
    p.foldedTilt = { angle: -3, x: 0, z: 0 };
    expect(upgradeFoldedTilt(p)).toEqual(['The tilt angle of -3° of the XFLR5 import stays folded into the sections: without it a twist would lie beyond ±360°.']);
    expect(p.foldedTilt).toEqual({ angle: -3, x: 0, z: 0 });
    // Folded sections near the coordinate limit: x = z = 999,000 mm turned back by 45° give
    // z = 1,412,800 mm, beyond ±1,000,000 mm. The file opens with its fold, as before.
    const far = sampleProject();
    far.sections.forEach((q) => Object.assign(q, { x: 999000, z: 999000 }));
    far.guides = defaultGuides(far.sections);
    far.foldedTilt = { angle: 45, x: 0, z: 0 };
    const text = JSON.stringify({ ...projectToJson(far, null), version: 2 });
    const r = projectFromJsonText(text);
    expect(r.ok).toBe(true);
    expect(r.notes).toEqual(['The tilt angle of 45° of the XFLR5 import stays folded into the sections: without it a section would lie beyond ±1000000 mm.']);
    expect([r.project.foldedTilt, r.project.settings.partTilt]).toEqual([{ angle: 45, x: 0, z: 0 }, 0]);
    // A version 3 file is not upgraded, and a project without a folded tilt has nothing to do.
    expect(upgradeFoldedTilt(sampleProject())).toEqual([]);
  });

  it('drops part placement keys of version 1 and 2 files, as the apps of those versions do', () => {
    for (const version of [1, 2]) {
      const text = JSON.stringify({ ...projectToJson(sampleProject(), null), version, settings: { ...sampleProject().settings, partTilt: 5, partRoll: 'abc', partPivot: 7 } });
      const r = projectFromJsonText(text);
      expect(r.ok, `version ${version}`).toBe(true);
      expect(r.project.settings).toMatchObject({ partTilt: 0, partRoll: 0, partPivot: null });
      expect(r.notes).toEqual([]);
    }
    // foldedTilt belongs to version 2: a version 1 file keeps its sections.
    const base = sampleProject();
    const r1 = projectFromJsonText(JSON.stringify({ ...projectToJson(base, null), version: 1, foldedTilt: { angle: 3, x: 0, z: 0 } }));
    expect(r1.ok).toBe(true);
    expect([r1.project.foldedTilt, r1.project.settings.partTilt, r1.notes]).toEqual([undefined, 0, []]);
    r1.project.sections.forEach((q, i) => expect([q.x, q.z, q.twist]).toEqual([base.sections[i].x, base.sections[i].z, base.sections[i].twist]));
  });
});
