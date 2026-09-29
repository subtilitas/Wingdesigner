import { describe, expect, it } from 'vitest';
import { PRESETS, chordAt, wizardProblems, wizardProject } from '../src/model/wizard.js';
import { buildWing } from '../src/geom/wing.js';
import { wingStats } from '../src/geom/stats.js';
import { LIMITS, airfoilPoints, validateProject } from '../src/model/project.js';
import { nacaAirfoil } from '../src/airfoil/naca.js';
import { edgeCheck, exportMeshes } from '../src/geom/mesh.js';
import {
  addAirfoil,
  addGuidePoint,
  chordFromTrailingEdge,
  clampSectionY,
  dragLeadingEdge,
  insertProblem,
  insertSection,
  moveGuidePoint,
  pruneAirfoils,
  removeGuidePoint,
  removeSection,
  resetDisabledGuides,
  sortedSections,
  resetGuide,
  setGuideEnabled,
  slug,
  syncGuidesToSpan,
} from '../src/model/edit.js';
import { defaultProject } from '../src/model/defaults.js';
import { sampleProject } from './helpers.js';
import { checkAirfoil } from '../src/airfoil/sanity.js';
import { guideProblems } from '../src/geom/guide.js';
import { formatMegabytes, sizeWarning } from '../src/model/budget.js';

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

  it('integrates guide curves that vary between the loft stations', () => {
    const p = wizardProject({ ...PRESETS.sport.params, span: 1000, rootChord: 200, taper: 1, sweep: 0 });
    // 100 control points, degree 5: 49 chord waves of +-15 mm over 500 mm span.
    p.guides.end.enabled = true;
    p.guides.end.mode = 'control';
    p.guides.end.degree = 5;
    p.guides.end.points = Array.from({ length: 100 }, (_, i) => [200 + (i > 0 && i < 99 ? (i % 2 ? 15 : -15) : 0), (500 * i) / 99]);
    p.guides.nose.enabled = true;
    const b = buildWing(p);
    expect(b.errors).toEqual([]);
    // Reference: midpoint rule with 200,000 samples over one half.
    const n = 200000;
    let A = 0;
    let C2 = 0;
    let CX = 0;
    for (let i = 0; i < n; i++) {
      const { xLE, chord } = b.planformAt(((i + 0.5) / n) * 500);
      A += (chord * 500) / n;
      C2 += (chord * chord * 500) / n;
      CX += (chord * xLE * 500) / n;
    }
    const s = wingStats(b);
    expect(Math.abs(s.area / (2 * A) - 1)).toBeLessThan(1e-7);
    expect(Math.abs(s.mac / (C2 / A) - 1)).toBeLessThan(1e-7);
    expect(Math.abs(s.macXLE - CX / A)).toBeLessThan(1e-4);
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
    // Small airfoils (5 points) keep the total within LIMITS.maxAirfoilPoints.
    const small = (i) => [[1, 0], [0.5, 0.05 + i * 1e-7], [0, 0], [0.5, -0.04], [1, 0]];
    for (let i = p.airfoils.length; i < LIMITS.maxAirfoils - 1; i++) p.airfoils.push({ id: `f${i}`, name: `Foil ${i}`, points: small(i) });
    expect(addAirfoil(p, { name: 'Last', points: small(-1) })).not.toBeNull();
    expect(p.airfoils.length).toBe(LIMITS.maxAirfoils);
    expect(addAirfoil(p, { name: 'One more', points: base.map(([x, y]) => [x, y * 0.5]) })).toBeNull();
    // An airfoil the project already holds is still found.
    expect(addAirfoil(p, { name: p.airfoils[0].name, points: base })).toBe(p.airfoils[0].id);
    expect(validateProject(p).ok).toBe(true);
    p.airfoils.push({ ...p.airfoils[0], id: 'extra' });
    const count = (v) => v.toLocaleString('en');
    expect(validateProject(p).errors).toContain(`At most ${count(LIMITS.maxAirfoils)} airfoils are supported (found ${count(LIMITS.maxAirfoils + 1)}).`);
  });

  it('stops adding airfoils at LIMITS.maxAirfoilPoints points together', () => {
    const p = sampleProject();
    const dense = nacaAirfoil('4412', { pointsPerSide: 25000 }).points;
    const start = airfoilPoints(p);
    let i = 0;
    while (airfoilPoints(p) + dense.length <= LIMITS.maxAirfoilPoints) {
      i += 1;
      expect(addAirfoil(p, { name: `Dense ${i}`, points: dense.map(([x, y]) => [x, y * (1 + i / 1000)]) })).not.toBeNull();
    }
    expect(i).toBe(Math.floor((LIMITS.maxAirfoilPoints - start) / dense.length));
    expect(addAirfoil(p, { name: 'One more', points: dense.map(([x, y]) => [x, y * 0.5]) })).toBeNull();
    expect(validateProject(p).ok).toBe(true);
    p.airfoils.push({ id: 'extra', name: 'Extra', points: dense });
    expect(validateProject(p).errors).toEqual([`The airfoils hold ${airfoilPoints(p).toLocaleString('en')} points together; the limit is ${LIMITS.maxAirfoilPoints.toLocaleString('en')}.`]);
  });

  it('refuses moves and inserts that leave no number strictly between two span positions', () => {
    const [a, b, c] = [1, 1.0000000000000002, 1.0000000000000004];
    const p = sampleProject();
    p.sections[0].y = a;
    p.sections[1].y = b;
    p.sections[2].y = c;
    expect(clampSectionY(sortedSections(p), 1, 0)).toBe(b);
    expect(clampSectionY(sortedSections(p), 1, 5)).toBe(b);
    p.guides.nose.points = [[0, a], [0, b], [0, c]];
    moveGuidePoint(p, 'nose', 1, 5, 0);
    expect(p.guides.nose.points[1]).toEqual([5, b]);
    expect(addGuidePoint(p, 'nose')).toBe(-1);
    expect(p.guides.nose.points).toHaveLength(3);
    expect(validateProject(p).errors).toEqual([]);
  });

  it('adds a NACA airfoil when a stored airfoil carries its code but other points', () => {
    const p = sampleProject();
    const n0012 = nacaAirfoil('0012').points;
    p.airfoils.push({ id: 'fake', name: 'Labelled 2412', points: n0012, source: { kind: 'naca', code: '2412' } });
    const real = { name: 'Generated 2412', points: nacaAirfoil('2412').points, source: { kind: 'naca', code: '2412' } };
    const id = addAirfoil(p, real);
    expect(id).not.toBe('fake');
    expect(p.airfoils.find((q) => q.id === id).points).toEqual(real.points);
    // The same generated airfoil again is found.
    expect(addAirfoil(p, { ...real, name: 'Generated 2412 again' })).toBe(id);
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
    // With the end line at its limit the chord keeps its minimum; the leading edge derived from the
    // end line (end line x minus chord) stays within the geometry extent, so the wing still builds.
    expect(LIMITS.maxGuideCoordinate).toBe(LIMITS.maxCoordinate + LIMITS.maxChord);
    expect(LIMITS.maxExtent).toBe(LIMITS.maxGuideCoordinate + LIMITS.maxChord);
    const q = sampleProject();
    const xg = -LIMITS.maxGuideCoordinate;
    q.guides.end = { enabled: true, mode: 'fit', degree: 3, points: [[xg, 0], [xg, 300], [xg, 600]] };
    dragLeadingEdge(q, q.sections[1].id, 50, 300, buildWing(q).guides.end);
    expect(q.sections[1]).toMatchObject({ x: -LIMITS.maxCoordinate, chord: LIMITS.minChord });
    expect(validateProject(q).ok).toBe(true);
    expect(buildWing(q).errors).toEqual([]);
    for (const s of q.sections) s.chord = LIMITS.maxChord;
    expect(buildWing(q).errors).toEqual([]);
    // Sections at the coordinate limit with the largest chord: disabled guides follow their edges.
    const r = sampleProject();
    r.sections[2].x = LIMITS.maxCoordinate;
    r.sections[2].chord = LIMITS.maxChord;
    resetDisabledGuides(r);
    expect(r.guides.end.points[2][0]).toBe(LIMITS.maxGuideCoordinate);
    expect(validateProject(r).ok).toBe(true);
    moveGuidePoint(p, 'nose', 1, 9e9, 300);
    expect(p.guides.nose.points[1][0]).toBe(LIMITS.maxGuideCoordinate);
    moveGuidePoint(p, 'nose', 0, -9e9, 0);
    expect(p.guides.nose.points[0][0]).toBe(-LIMITS.maxGuideCoordinate);
    expect(validateProject(p).ok).toBe(true);
  });

  it('stops adding guide points at LIMITS.maxGuidePoints and sections at LIMITS.maxSections', () => {
    const p = sampleProject();
    const m = LIMITS.maxGuidePoints;
    p.guides.nose.points = Array.from({ length: m - 1 }, (_, i) => [0, (600 * i) / (m - 2)]);
    expect(addGuidePoint(p, 'nose')).toBeGreaterThan(0);
    expect(addGuidePoint(p, 'nose')).toBe(-1);
    expect(p.guides.nose.points.length).toBe(m);
    const q = sampleProject();
    const s0 = q.sections[0];
    q.sections = Array.from({ length: LIMITS.maxSections - 1 }, (_, i) => ({ ...s0, id: `s${i}`, y: 10 * i }));
    expect(insertSection(q, q.sections.length - 1)).not.toBeNull();
    expect(insertProblem(q, 0)).toBe(`At most ${LIMITS.maxSections.toLocaleString('en')} sections.`);
    expect(insertSection(q, 0)).toBeNull();
    expect(q.sections.length).toBe(LIMITS.maxSections);
    const far = sampleProject();
    far.sections[2].y = LIMITS.maxCoordinate - 5;
    expect(insertProblem(far, 2)).toMatch(/beyond y = 1000000 mm/);
    expect(insertSection(far, 2)).toBeNull();
    // Adjacent doubles: the midpoint rounds to one of them, so no section fits between.
    const tight = sampleProject();
    tight.sections[0].y = 1;
    tight.sections[1].y = 1.0000000000000002;
    expect(validateProject(tight).errors).toEqual([]);
    expect(insertProblem(tight, 0)).toMatch(/No span position lies between y = 1 mm and y = 1.0000000000000002 mm/);
    expect(insertSection(tight, 0)).toBeNull();
    expect(tight.sections.length).toBe(3);
    expect(insertProblem(tight, 1)).toBeNull();
  });

  it('refuses a section beyond the tip that makes the span too long for a close pair', () => {
    // The copy of the tip at 11 mm: the first gap becomes 3.6e-308 of the span, below 2^-1021.
    const p = sampleProject();
    [0, 4e-307, 1].forEach((y, i) => (p.sections[i].y = y));
    expect(validateProject(p).errors).toEqual([]);
    expect(insertProblem(p, 2)).toBe('A section at y = 11 mm beyond the tip makes the span too long for the sections at y = 0 mm and y = 4e-307 mm. Move the two sections apart first.');
    expect(insertSection(p, 2)).toBeNull();
    // A wider close pair keeps its fractions apart over 11 mm.
    p.sections[1].y = 1e-300;
    expect(insertProblem(p, 2)).toBeNull();
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

  it('puts the quarter chord of a pointed elliptic tip on the sweep line', () => {
    for (const sections of [2, 3]) {
      const params = { ...PRESETS.glider.params, tip: 'pointed', rootChord: 3000, sections };
      const b = buildWing(wizardProject(params));
      expect(b.errors).toEqual([]);
      const tip = b.stations[b.stations.length - 1];
      const target = 0.25 * params.rootChord + (params.span / 2) * Math.tan((params.sweep * Math.PI) / 180);
      expect(Math.abs(tip.xLE + 0.25 * tip.chord - target)).toBeLessThan(0.01);
    }
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

  it('keeps the tip when the longer span would merge the span fractions of a close pair', () => {
    // Span 2 mm: fractions 0 and 2e-302 are apart; span 1e6 mm: 4e-308, below the 2^-1021 floor.
    expect(clampSectionY(sorted(0, 4e-302, 1, 2), 3, 1e6)).toBe(2);
    expect(clampSectionY(sorted(0, 4e-302, 1, 2), 3, 5)).toBe(5);
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

describe('statistics and edits at large sizes', () => {
  it('integrates between the planform breakpoints only, with the result of the station split', () => {
    const p = wizardProject({ ...PRESETS.glider.params, sections: 8 });
    p.settings.panelStations = 40;
    const b = buildWing(p);
    expect(b.errors).toEqual([]);
    let calls = 0;
    const counted = { ...b, planformAt: (y) => (calls++, b.planformAt(y)) };
    const s = wingStats(counted);
    // The station split evaluates at least 15 times per station interval.
    expect(calls).toBeLessThan(15 * (b.stations.length - 1));
    const withStations = wingStats({ ...b, planformBreaks: [...b.planformBreaks, ...b.stations.map((q) => q.y).slice(1, -1)] });
    for (const k of ['area', 'mac', 'macY', 'macXLE']) expect(s[k] / withStations[k]).toBeCloseTo(1, 9);
  });

  it('finds a free airfoil id in linear time', () => {
    // 9,000 airfoils named "Wing root" with the ids addAirfoil gives them: wing-root, wing-root-2, ...
    const p = wizardProject(PRESETS.sport.params);
    const pts = nacaAirfoil('2412', { pointsPerSide: 5 }).points;
    for (let k = 1; k <= 9000; k++) p.airfoils.push({ id: k === 1 ? 'wing-root' : `wing-root-${k}`, name: 'Wing root', points: pts });
    const t0 = performance.now();
    const id = addAirfoil(p, { name: 'Wing root', points: pts.map(([x, y]) => [x, 3 * y]) });
    expect(performance.now() - t0).toBeLessThan(100);
    expect(id).toBe('wing-root-9001');
  });
});

describe('wizard planform, edits and estimates at the edges', () => {
  it('keeps an elliptic planform within 0.6 % of the root chord of its chord law', () => {
    for (const taper of [0.1, 0.2, 0.45]) {
      const params = { ...PRESETS.glider.params, taper };
      const b = buildWing(wizardProject(params));
      expect(b.errors).toEqual([]);
      let worst = 0;
      for (let k = 0; k < 1000; k++) worst = Math.max(worst, Math.abs(b.planformAt((k / 1000) * (params.span / 2)).chord - chordAt(params, k / 1000)));
      expect(worst / params.rootChord, String(taper)).toBeLessThan(0.006);
    }
  });

  it('builds a 1 mm elliptic tip from 10 mm root chord and taper 0.1', () => {
    const p = wizardProject({ span: 150, rootChord: 10, taper: 0.1, sweep: 10, dihedral: 0, washout: 0, sections: 2, planform: 'elliptic', tip: 'flat', rootAirfoil: '2412', tipAirfoil: '2412' });
    expect(buildWing(p).errors).toEqual([]);
  });

  it('adds stations where the deviation exceeds its shrinking tolerance', () => {
    const b = buildWing(wizardProject({ span: 1000, rootChord: 10, taper: 0.99, sweep: -45, dihedral: 5, washout: 15, sections: 2, planform: 'straight', tip: 'pointed', rootAirfoil: '6409', tipAirfoil: '2410' }));
    expect(b.errors).toEqual([]);
    expect(b.extraStations).toBeGreaterThan(0);
    expect(b.warnings.filter((w) => w.startsWith('The loft deviates'))).toEqual([]);
  });

  it('keeps one entry for a cambered NACA section added twice through the preview', () => {
    const p = wizardProject(PRESETS.trainer.params);
    // The preview stores the checked points, which differ from the generator's for cambered sections.
    const entry = (name) => ({ name, points: checkAirfoil(nacaAirfoil('4412').points).points, source: { kind: 'naca', code: '4412', closedTE: false } });
    const first = addAirfoil(p, entry('Main wing section'));
    const second = addAirfoil(p, entry('NACA 4412'));
    expect(second).toBe(first);
  });

  it('refuses inserts, drags and guide moves that the build could not keep apart', () => {
    const at = (ys) => ({ ...sampleProject(), sections: ys.map((y, i) => ({ id: `s${i}`, airfoil: 'root', x: 0, y, z: 0, chord: 200, twist: 0 })) });
    // u: one unit in the last place at y = 500,000 mm. Sections 16 u apart build; their midpoint lies
    // 8 u from each, and the build keeps span fractions apart only above 4 units of the fraction.
    const u = 2 ** -34;
    const close = at([0, 500000, 500000 + 16 * u, 1000000]);
    expect(buildWing(close).errors).toEqual([]);
    expect(insertProblem(close, 1)).toMatch(/^No span position lies between y = 500000 mm and y = 500000\.00000000093 mm/);
    // Sections 12 u apart build; a drag of the middle one to y = 0 clamps to 3 u from its neighbour,
    // which the build refuses, so the section keeps its y.
    const three = at([0, 500000, 500000 + 12 * u, 500000 + 24 * u, 1000000]);
    expect(buildWing(three).errors).toEqual([]);
    const sorted = sortedSections(three);
    expect(clampSectionY(sorted, 2, 0)).toBe(sorted[2].y);
    // Guide points 6 units in the last place apart at y = 300 mm (w) pass the guide check; a move of
    // the middle one to y = 0 clamps to 3 w from its neighbour, which the check refuses, so the point
    // keeps its y.
    const w = 2 ** -44;
    const g = sampleProject();
    g.guides.nose = { enabled: true, mode: 'fit', degree: 3, points: [[0, 0], [10, 300], [20, 300 + 6 * w], [30, 300 + 12 * w], [60, 600]] };
    expect(guideProblems(g.guides.nose)).toEqual([]);
    moveGuidePoint(g, 'nose', 2, 25, 0);
    expect(g.guides.nose.points[2]).toEqual([25, 300 + 6 * w]);
  });

  it('estimates projects without settings and rounds megabytes before the unit', () => {
    const p = defaultProject();
    delete p.settings;
    expect(buildWing(p).errors).toEqual([]);
    const q = defaultProject();
    q.settings = { spanwise: 'smooth' };
    q.sections = Array.from({ length: 300 }, (_, i) => ({ ...q.sections[0], id: `s${i}`, y: 2 * i }));
    expect(sizeWarning(q)).not.toMatch(/NaN/);
    expect(sizeWarning(q)).toMatch(/loft grid points/);
    expect(formatMegabytes(996)).toBe('about 1 GB');
    expect(formatMegabytes(994)).toBe('about 990 MB');
  });
});
