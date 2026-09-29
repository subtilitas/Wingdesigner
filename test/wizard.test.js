import { describe, expect, it } from 'vitest';
import { PRESETS, chordAt, wizardProblems, wizardProject } from '../src/model/wizard.js';
import { buildWing } from '../src/geom/wing.js';
import { wingStats } from '../src/geom/stats.js';
import { validateProject } from '../src/model/project.js';
import { edgeCheck, exportMeshes } from '../src/geom/mesh.js';
import {
  addAirfoil,
  addGuidePoint,
  insertSection,
  moveGuidePoint,
  pruneAirfoils,
  removeGuidePoint,
  removeSection,
  resetGuide,
  slug,
  syncGuidesToSpan,
} from '../src/model/edit.js';
import { defaultProject } from '../src/model/defaults.js';
import { sampleProject } from './helpers.js';

describe('wizard', () => {
  for (const [key, preset] of Object.entries(PRESETS)) {
    it(`builds a valid closed wing for the ${key} preset`, () => {
      const p = wizardProject(preset.params, preset.label);
      expect(validateProject(p).ok).toBe(true);
      const b = buildWing(p);
      expect(b.errors).toEqual([]);
      for (const { mesh } of exportMeshes(b, 'merged')) expect(edgeCheck(mesh).closed).toBe(true);
      const s = wingStats(b);
      expect(s.span).toBeCloseTo(preset.params.span, 6);
      expect(s.rootChord).toBeCloseTo(preset.params.rootChord, 1);
    });
  }

  it('produces the requested taper, dihedral, washout and sweep', () => {
    const params = { ...PRESETS.flyingWing.params, sections: 4 };
    const p = wizardProject(params);
    const tip = p.sections[3];
    expect(tip.y).toBe(600);
    expect(tip.chord).toBeCloseTo(280 * 0.45, 2);
    expect(tip.twist).toBe(-4);
    // Quarter-chord line swept by 25 degrees.
    const xq = (s) => s.x + 0.25 * s.chord;
    expect((xq(tip) - xq(p.sections[0])) / tip.y).toBeCloseTo(Math.tan((25 * Math.PI) / 180), 3);
    expect(p.airfoils.map((a) => a.id)).toEqual(['naca23112', 'naca0010']);
  });

  it('creates elliptic guides that end at the requested tip chord', () => {
    const p = wizardProject(PRESETS.glider.params);
    expect(p.guides.nose.enabled && p.guides.end.enabled).toBe(true);
    const b = buildWing(p);
    const tip = b.stations[b.stations.length - 1];
    expect(tip.chord).toBeCloseTo(200 * 0.45, 1);
    expect(chordAt(PRESETS.glider.params, 0)).toBe(200);
    // Elliptic chord is larger than linear taper in mid span.
    expect(chordAt(PRESETS.glider.params, 0.5)).toBeGreaterThan(200 * (1 + (0.45 - 1) * 0.5));
  });

  it('validates parameters', () => {
    expect(wizardProblems(PRESETS.sport.params)).toEqual([]);
    const bad = { ...PRESETS.sport.params, span: 10, sections: 2.5, planform: 'round', rootAirfoil: 'MH45' };
    expect(wizardProblems(bad).length).toBe(4);
    expect(wizardProblems({ ...PRESETS.glider.params, taper: 1 })).toContain('An elliptic planform needs taper < 1.');
    expect(() => wizardProject(bad)).toThrow();
  });
});

describe('wing statistics', () => {
  it('computes area, aspect ratio and MAC of a trapezoidal wing', () => {
    const p = wizardProject({ ...PRESETS.sport.params, span: 1000, rootChord: 200, taper: 0.5, sweep: 0 });
    const s = wingStats(buildWing(p));
    expect(s.area).toBeCloseTo(1000 * 150, 3);
    expect(s.aspectRatio).toBeCloseTo((1000 * 1000) / 150000, 9);
    // Trapezoid: MAC = 2/3 c_r (1 + l + l^2) / (1 + l), y = b/6 (1 + 2l) / (1 + l).
    expect(s.mac).toBeCloseTo((2 / 3) * 200 * (1.75 / 1.5), 6);
    expect(s.macY).toBeCloseTo((1000 / 6) * (2 / 1.5), 6);
    const half = buildWing({ ...p, settings: { ...p.settings, mirror: false } });
    expect(wingStats(half).span).toBeCloseTo(500, 9);
  });
});

describe('edit operations', () => {
  it('inserts and removes sections', () => {
    const p = sampleProject();
    const s = insertSection(p, 0);
    expect(s.y).toBe(150);
    expect(p.sections.length).toBe(4);
    const t = insertSection(p, 3);
    expect(t.y).toBe(900);
    expect(p.guides.nose.points.length).toBe(5);
    expect(p.guides.nose.points[4][1]).toBe(900);
    expect(removeSection(p, s.id)).toBe(true);
    expect(p.sections.length).toBe(4);
    const two = sampleProject();
    two.sections = two.sections.slice(0, 2);
    expect(removeSection(two, two.sections[0].id)).toBe(false);
    const lone = sampleProject();
    lone.sections = [lone.sections[0]];
    expect(insertSection(lone, 0).y).toBe(100);
  });

  it('keeps enabled guides spanning root to tip', () => {
    const p = sampleProject();
    p.guides.end.enabled = true;
    p.sections[2].y = 900;
    syncGuidesToSpan(p);
    expect(p.guides.end.points.map((q) => q[1])).toEqual([0, 450, 900]);
    resetGuide(p, 'end');
    expect(p.guides.end.points[2]).toEqual([170, 900]);
  });

  it('adds, moves and removes guide points', () => {
    const p = sampleProject();
    const i = addGuidePoint(p, 'nose');
    expect(i).toBe(1);
    expect(p.guides.nose.points[1]).toEqual([10, 150]);
    moveGuidePoint(p, 'nose', 1, 5, 400);
    expect(p.guides.nose.points[1]).toEqual([5, 299.5]);
    moveGuidePoint(p, 'nose', 0, 7, 50);
    expect(p.guides.nose.points[0]).toEqual([7, 0]);
    expect(removeGuidePoint(p, 'nose', 0)).toBe(false);
    expect(removeGuidePoint(p, 'nose', 1)).toBe(true);
  });

  it('manages airfoils', () => {
    const p = sampleProject();
    const a = { name: 'My Foil', points: p.airfoils[0].points };
    const id = addAirfoil(p, a);
    expect(id).toBe('my-foil');
    expect(addAirfoil(p, a)).toBe('my-foil');
    expect(addAirfoil(p, { name: 'My Foil', points: p.airfoils[1].points })).toBe('my-foil-2');
    expect(pruneAirfoils(p)).toBe(2);
    expect(slug('Flügel 3,4/12!')).toBe('flugel-3-4-12');
    expect(addAirfoil(p, { name: '***', points: p.airfoils[0].points })).toBe('airfoil');
  });

  it('provides a valid default project', () => {
    const p = defaultProject();
    expect(validateProject(p).ok).toBe(true);
    expect(buildWing(p).errors).toEqual([]);
  });
});

describe('wizard tips', () => {
  it('builds an elliptic wing that ends in a point', () => {
    const params = { ...PRESETS.glider.params, tip: 'pointed' };
    expect(wizardProblems(params)).toEqual([]);
    const p = wizardProject(params);
    expect(p.settings.tip).toEqual({ mode: 'pointed', ratio: 0.005 });
    expect(validateProject(p).ok).toBe(true);
    const b = buildWing(p);
    expect(b.errors).toEqual([]);
    expect(b.stations[b.stations.length - 1].chord).toBeLessThan(1);
    for (const { mesh } of exportMeshes(b, 'merged')) expect(edgeCheck(mesh).closed).toBe(true);
    // Elliptic chord with a pointed tip reaches zero at the tip before scaling.
    expect(chordAt(params, 1)).toBe(0);
    expect(wizardProblems({ ...params, taper: 1 })).toEqual([]);
    expect(wizardProblems({ ...params, tip: 'round' })).toContain('tip must be "flat" or "pointed".');
  });

  it('builds a straight wing with a pointed last panel', () => {
    const p = wizardProject({ ...PRESETS.sport.params, sections: 3, tip: 'pointed' });
    const b = buildWing(p);
    expect(b.errors).toEqual([]);
    expect(b.tipChord).toBeCloseTo(0.005 * p.sections[1].chord, 9);
  });
});
