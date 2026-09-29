import { describe, expect, it } from 'vitest';
import { PRESETS, chordAt, wizardProblems, wizardProject } from '../src/model/wizard.js';
import { buildWing } from '../src/geom/wing.js';
import { wingStats } from '../src/geom/stats.js';
import { LIMITS, validateProject } from '../src/model/project.js';
import { edgeCheck, exportMeshes } from '../src/geom/mesh.js';
import {
  addAirfoil,
  addGuidePoint,
  chordFromTrailingEdge,
  clampSectionY,
  dragLeadingEdge,
  insertSection,
  moveGuidePoint,
  pruneAirfoils,
  removeGuidePoint,
  removeSection,
  resetDisabledGuides,
  resetGuide,
  setGuideEnabled,
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

describe('wing statistics with curved planforms', () => {
  it('does not depend on the station count in smooth mode', () => {
    const areas = [3, 8, 40].map((K) => {
      const p = sampleProject({ settings: { spanwise: 'smooth', panelStations: K } });
      p.sections = [
        { id: 'a', airfoil: 'root', x: 0, y: 0, z: 0, chord: 100, twist: 0 },
        { id: 'b', airfoil: 'root', x: 0, y: 100, z: 0, chord: 500, twist: 0 },
        { id: 'c', airfoil: 'root', x: 0, y: 1000, z: 0, chord: 100, twist: 0 },
      ];
      const b = buildWing(p);
      // Reference: fine midpoint rule over the planform.
      let ref = 0;
      for (let i = 0; i < 20000; i++) ref += (2 * 1000 * b.planformAt(((i + 0.5) / 20000) * 1000).chord) / 20000;
      const s = wingStats(b);
      expect(s.area / ref).toBeCloseTo(1, 7);
      return s.area;
    });
    expect(areas[0] / areas[2]).toBeCloseTo(1, 9);
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
    // The display setting "Show mirrored half" does not change the statistics.
    const hidden = buildWing({ ...p, settings: { ...p.settings, mirror: false } });
    expect(wingStats(hidden).span).toBeCloseTo(1000, 9);
    expect(wingStats(hidden).area).toBeCloseTo(1000 * 150, 3);
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

  it('keeps edited guide points when a guide is switched off and on again', () => {
    const p = sampleProject();
    setGuideEnabled(p, 'nose', true);
    expect(p.guides.nose.points).toEqual([[0, 0], [20, 300], [60, 600]]);
    moveGuidePoint(p, 'nose', 1, 35, 300);
    expect(p.guides.nose.edited).toBe(true);
    setGuideEnabled(p, 'nose', false);
    // Section edits do not replace the edited points of a disabled guide.
    p.sections[1].x = 25;
    resetDisabledGuides(p);
    setGuideEnabled(p, 'nose', true);
    expect(p.guides.nose.points[1]).toEqual([35, 300]);
    // Reset to sections clears the flag; a disabled unedited guide follows the sections again.
    resetGuide(p, 'nose');
    expect(p.guides.nose.edited).toBe(false);
    expect(p.guides.nose.points[1]).toEqual([25, 300]);
    setGuideEnabled(p, 'nose', false);
    p.sections[1].x = 30;
    resetDisabledGuides(p);
    expect(p.guides.nose.points[1]).toEqual([30, 300]);
    // Adding and removing points marks the guide as edited.
    for (const edit of [(q) => addGuidePoint(q, 'end'), (q) => removeGuidePoint(q, 'end', 1)]) {
      const q = sampleProject();
      edit(q);
      expect(q.guides.end.edited).toBe(true);
    }
  });

  it('stops adding airfoils at LIMITS.maxAirfoils', () => {
    const p = sampleProject();
    const base = p.airfoils[0].points;
    for (let i = p.airfoils.length; i < LIMITS.maxAirfoils; i++) {
      expect(addAirfoil(p, { name: `Foil ${i}`, points: base.map(([x, y]) => [x, y * (1 + i / 1000)]) })).not.toBeNull();
    }
    expect(p.airfoils.length).toBe(200);
    expect(addAirfoil(p, { name: 'One more', points: base.map(([x, y]) => [x, y * 0.5]) })).toBeNull();
    // An airfoil the project already holds is still found.
    expect(addAirfoil(p, { name: p.airfoils[0].name, points: base })).toBe(p.airfoils[0].id);
    expect(validateProject(p).ok).toBe(true);
    p.airfoils.push({ ...p.airfoils[0], id: 'extra' });
    expect(validateProject(p).errors).toContain('At most 200 airfoils are supported (found 201).');
  });

  it('keeps drags within the project limits', () => {
    expect(chordFromTrailingEdge(250, 50)).toBe(200);
    expect(chordFromTrailingEdge(50.5, 50)).toBe(LIMITS.minChord);
    expect(chordFromTrailingEdge(5e6, 0)).toBe(LIMITS.maxChord);
    const p = sampleProject();
    const tip = p.sections[2];
    dragLeadingEdge(p, tip.id, -5e6, 5e6);
    expect(tip.y).toBe(LIMITS.maxCoordinate);
    expect(tip.chord).toBe(LIMITS.maxChord);
    expect(tip.x + tip.chord).toBe(170);
    // With the end line at the coordinate limit the chord keeps its minimum.
    const q = sampleProject();
    q.guides.end = { enabled: true, mode: 'fit', degree: 3, points: [[-LIMITS.maxCoordinate, 0], [-LIMITS.maxCoordinate, 300], [-LIMITS.maxCoordinate, 600]] };
    dragLeadingEdge(q, q.sections[1].id, 50, 300, buildWing(q).guides.end);
    expect(q.sections[1]).toMatchObject({ x: -LIMITS.maxCoordinate, chord: LIMITS.minChord });
    expect(validateProject(q).ok).toBe(true);
    moveGuidePoint(p, 'nose', 1, 9e9, 300);
    expect(p.guides.nose.points[1][0]).toBe(LIMITS.maxCoordinate);
    moveGuidePoint(p, 'nose', 0, -9e9, 0);
    expect(p.guides.nose.points[0][0]).toBe(-LIMITS.maxCoordinate);
    expect(validateProject(p).ok).toBe(true);
  });

  it('stops adding guide points at LIMITS.maxGuidePoints and sections at LIMITS.maxSections', () => {
    const p = sampleProject();
    while (p.guides.nose.points.length < LIMITS.maxGuidePoints) expect(addGuidePoint(p, 'nose')).toBeGreaterThan(0);
    expect(addGuidePoint(p, 'nose')).toBe(-1);
    expect(p.guides.nose.points.length).toBe(500);
    const q = sampleProject();
    while (q.sections.length < LIMITS.maxSections) expect(insertSection(q, q.sections.length - 1)).not.toBeNull();
    expect(insertSection(q, 0)).toBeNull();
    expect(q.sections.length).toBe(200);
    const far = sampleProject();
    far.sections[2].y = LIMITS.maxCoordinate - 5;
    expect(insertSection(far, 2)).toBeNull();
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
    // 1/200 of the previous chord (173 mm) is 0.87 mm; the tip keeps the 1 mm minimum.
    expect(b.stations[b.stations.length - 1].chord).toBeCloseTo(1, 9);
    expect(b.tipChordLimited).toBe(true);
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
    expect(b.tipChord).toBeCloseTo(Math.max(0.005 * p.sections[1].chord, 1), 9);
    expect(p.sections[2].chord).toBeGreaterThanOrEqual(1);
  });
});

describe('leading-edge drag with an end line', () => {
  it('puts the rebuilt leading edge under the pointer after a diagonal drag', () => {
    const p = sampleProject();
    p.guides.end.enabled = true;
    p.guides.end.points = [[200, 0], [260, 300], [360, 600]];
    const before = buildWing(p);
    dragLeadingEdge(p, p.sections[1].id, 80, 420, before.guides.end);
    const after = buildWing(p);
    expect(after.errors).toEqual([]);
    const st = after.stations.find((q) => Math.abs(q.y - 420) < 1e-9);
    expect(st.xLE).toBeCloseTo(80, 6);
    // Without the end line the trailing edge stays where it was.
    const q = sampleProject();
    const te = q.sections[1].x + q.sections[1].chord;
    dragLeadingEdge(q, q.sections[1].id, 5, 250, null);
    expect(q.sections[1]).toMatchObject({ x: 5, y: 250 });
    expect(q.sections[1].x + q.sections[1].chord).toBeCloseTo(te, 12);
  });
});

describe('section drag clamp', () => {
  const sorted = (...ys) => ys.map((y) => ({ y }));

  it('keeps 1 mm from wide-apart neighbours', () => {
    expect(clampSectionY(sorted(0, 300, 600), 1, -50)).toBe(1);
    expect(clampSectionY(sorted(0, 300, 600), 1, 900)).toBe(599);
    expect(clampSectionY(sorted(0, 300, 600), 1, 250)).toBe(250);
    expect(clampSectionY(sorted(0, 300, 600), 2, 5000)).toBe(5000);
  });

  it('stays strictly between neighbours closer than 2 mm', () => {
    for (const y of [-10, 0.1, 0.5, 5]) {
      const v = clampSectionY(sorted(0, 0.4, 0.8), 1, y);
      expect(v).toBeGreaterThan(0);
      expect(v).toBeLessThan(0.8);
    }
  });

  it('keeps the root section in place', () => {
    expect(clampSectionY(sorted(0, 300), 0, 120)).toBe(0);
  });

  it('keeps a guide point between neighbours closer than 1 mm', () => {
    const p = sampleProject();
    p.guides.nose.points = [[0, 0], [5, 0.4]];
    const i = addGuidePoint(p, 'nose');
    expect(p.guides.nose.points[i][1]).toBeCloseTo(0.2, 12);
    moveGuidePoint(p, 'nose', i, 7, p.guides.nose.points[i][1]);
    expect(p.guides.nose.points[i]).toEqual([7, 0.2]);
    for (const y of [-5, 0, 0.4, 3]) {
      moveGuidePoint(p, 'nose', i, 7, y);
      expect(p.guides.nose.points[i][1]).toBeGreaterThan(0);
      expect(p.guides.nose.points[i][1]).toBeLessThan(0.4);
    }
  });
});
