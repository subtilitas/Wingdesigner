// Integral winglet (src/model/winglet.js): the blend arc and the straight part of the reference line,
// chord, sweep and toe along it, the checks, and the built wing with the winglet.
import { afterEach, describe, expect, it } from 'vitest';
import { WINGLET_STEP, addWinglet, defaultWinglet, wingletProblems, wingletSections } from '../src/model/winglet.js';
import { PRESETS, wizardProject } from '../src/model/wizard.js';
import { buildWing } from '../src/geom/wing.js';
import { edgeCheck, exportMeshes } from '../src/geom/mesh.js';
import { sortedSections } from '../src/model/edit.js';
import { setLanguage } from '../src/i18n/index.js';

const DEG = Math.PI / 180;

afterEach(() => setLanguage('en'));

/** The Sport preset (tip at y = 600 mm, z = 15.71 mm, chord 144 mm, dihedral 1.5°). */
const sport = () => wizardProject(PRESETS.sport.params);

describe('winglet sections', () => {
  it('turn the reference line along the blend arc to the cant angle and run on straight to the height', () => {
    const p = sport();
    const tip = sortedSections(p).at(-1);
    const params = { height: 150, cant: 75, radius: 40, sweep: 30, tipChord: 50, toe: -2, airfoil: tip.airfoil };
    const out = wingletSections(p, params);
    // 1.5° to 75°: 73.5° in steps of at most 15°: 5 arc sections and the tip.
    expect(out).toHaveLength(Math.ceil(73.5 / WINGLET_STEP) + 1);
    // Every arc section lies on the circle of radius 40 mm tangent to the last panel at the tip.
    const n = [-Math.sin(1.5 * DEG), Math.cos(1.5 * DEG)];
    const c = [tip.y + 40 * n[0], tip.z + 40 * n[1]];
    for (const q of out.slice(0, -1)) expect(Math.hypot(q.y - c[0], q.z - c[1])).toBeCloseTo(40, 1);
    // The straight part leaves the arc at 75°.
    const [a, b] = out.slice(-2);
    expect((Math.atan2(b.z - a.z, b.y - a.y) / DEG)).toBeCloseTo(75, 0);
    // Along the 150 mm reference line: chord 144 → 72 mm, twist −1° → −3°, leading edge 150 · tan 30° aft.
    const end = out.at(-1);
    expect([end.chord, end.twist]).toEqual([72, -3]);
    expect(end.x).toBeCloseTo(tip.x + 150 * Math.tan(30 * DEG), 1);
    // The arc is 40 mm · 73.5° = 51.3 mm long: the arc sections lie at chord 144 − 72 · s / 150.
    expect(out[0].chord).toBeCloseTo(144 - (72 * 51.31) / 5 / 150, 1);
    expect(out.every((q) => q.airfoil === tip.airfoil)).toBe(true);
  });

  it('bend down with a negative cant angle, and kink at the tip with radius 0', () => {
    const p = sport();
    const tip = sortedSections(p).at(-1);
    const down = wingletSections(p, { ...defaultWinglet(p), cant: -60 });
    expect(down.at(-1).z).toBeLessThan(tip.z - 50);
    expect(down.every((q, i) => q.y > (i ? down[i - 1].y : tip.y))).toBe(true);
    const kink = wingletSections(p, { ...defaultWinglet(p), radius: 0, height: 100 });
    expect(kink).toHaveLength(1);
    expect(kink[0].y).toBeCloseTo(tip.y + 100 * Math.cos(75 * DEG), 1);
    expect(kink[0].z).toBeCloseTo(tip.z + 100 * Math.sin(75 * DEG), 1);
  });

  it('leave out an arc section less than 1 mm from its neighbour in y', () => {
    const p = sport();
    const out = wingletSections(p, { ...defaultWinglet(p), cant: 89, radius: 40 });
    const ys = [sortedSections(p).at(-1).y, ...out.map((q) => q.y)];
    for (let i = 1; i < ys.length; i++) expect(ys[i] - ys[i - 1]).toBeGreaterThanOrEqual(1);
  });
});

describe('winglet on the presets', () => {
  it('builds a closed wing on every preset with a flat tip and no guide curves', () => {
    for (const [key, preset] of Object.entries(PRESETS)) {
      if (key === 'batwing') continue;
      const p = wizardProject({ ...preset.params, tip: 'flat' });
      p.guides.nose.enabled = false;
      p.guides.end.enabled = false;
      const before = p.sections.length;
      const w = defaultWinglet(p);
      expect(wingletProblems(p, w), key).toEqual([]);
      const added = addWinglet(p, w);
      expect(p.sections).toHaveLength(before + added.length);
      const b = buildWing(p);
      expect(b.errors, key).toEqual([]);
      for (const m of exportMeshes(b, 'halves')) expect(edgeCheck(m.mesh).closed, key).toBe(true);
    }
  });

  it('builds cant angles from −89° to 89° with blend radii from 0 to 0.6 tip chords on the Sport wing', () => {
    for (const cant of [-89, -45, 0, 45, 75, 89]) {
      for (const rf of [0, 0.3, 0.6]) {
        const p = sport();
        const w = { ...defaultWinglet(p), cant, radius: Math.round(rf * 144) };
        expect(wingletProblems(p, w), `${cant}° ${rf}`).toEqual([]);
        addWinglet(p, w);
        expect(buildWing(p).errors, `${cant}° ${rf}`).toEqual([]);
      }
    }
  });
});

describe('winglet checks', () => {
  it('refuse values out of range, guide curves, a pointed tip, vertical planes and an arc longer than the height', () => {
    const p = sport();
    const w = defaultWinglet(p);
    expect(wingletProblems(p, { ...w, cant: 90, airfoil: 'none' })).toEqual(['Winglet: cant angle must be between -89 and 89.', 'Winglet: choose an airfoil of the project.']);
    const guided = sport();
    guided.guides.nose.enabled = true;
    expect(wingletProblems(guided, w)).toEqual(['Switch the guide curves off first: they hold x as a function of y and would stretch over the winglet.']);
    const pointed = sport();
    pointed.settings.tip.mode = 'pointed';
    expect(wingletProblems(pointed, w)).toEqual(['The wing ends in a point (Settings > Wing tip = Pointed): a winglet needs a flat tip.']);
    const vertical = sport();
    vertical.settings.sectionPlanes = 'vertical';
    expect(wingletProblems(vertical, w)[0]).toMatch(/^A winglet needs Settings > Section planes = Mitred/);
    // 100 mm radius over 73.5°: 128.3 mm of arc, longer than 100 mm.
    expect(wingletProblems(p, { ...w, radius: 100, height: 100 })).toEqual(['Winglet: the blend arc is 128.28 mm long, not shorter than the height; reduce the blend radius or increase the height.']);
    // A straight part of 1 mm at 89° spans 0.02 mm in y.
    expect(wingletProblems(p, { ...w, cant: 89, radius: 0, height: 20 })).toEqual(['Winglet panel 1 spans 0.35 mm in y, less than 1 mm; reduce the cant angle or increase the blend radius or the height.']);
    expect(addWinglet(p, { ...w, cant: 90 })).toBeNull();
    // A panel angle left on the tip from a removed outer section does not reach the first winglet panel.
    const stale = sport();
    sortedSections(stale).at(-1).panelAngle = -80;
    expect(wingletProblems(stale, w)).toEqual([]);
    addWinglet(stale, w);
    expect(stale.sections.filter((s) => 'panelAngle' in s)).toEqual([]);
    expect(buildWing(stale).errors).toEqual([]);
    // Chord and twist of the winglet stay within the project limits (100,000 mm, ±360°).
    const big = sport();
    const bt = sortedSections(big).at(-1);
    Object.assign(bt, { chord: 90000, twist: 355 });
    const over = wingletProblems(big, { ...w, height: 100000, radius: 0, tipChord: 200, toe: 10 });
    expect(over).toEqual(['Winglet section 1: the chord is above 100000 mm.', 'Winglet section 1: the twist lies beyond ±360°.']);
    setLanguage('de');
    expect(wingletProblems(p, { ...w, cant: 90 })).toEqual(['Winglet: Neigung muss zwischen -89 und 89 liegen.']);
  });
});
