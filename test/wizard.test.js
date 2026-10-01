import { afterEach, describe, expect, it } from 'vitest';
import { setLanguage } from '../src/i18n/index.js';
import { ELLIPTIC_TIP_SECTIONS, MAX_PANELS, PRESETS, chordAt, panelsFromParams, wizardProblems, wizardProject } from '../src/model/wizard.js';
import { buildWing } from '../src/geom/wing.js';
import { wingStats } from '../src/geom/stats.js';
import { LIMITS, airfoilPoints, createProject, limitErrors, validateProject } from '../src/model/project.js';
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
import { MAX_PROJECT_BYTES, omittedNote, projectFileText, projectFromJsonText, projectToJson } from '../src/model/io.js';
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

  it('builds V-tails and inverted V-tails up to 60 degrees per half', () => {
    // Tail surface preset (500 mm span, 130 mm root chord, NACA 0009) as a 55 degree V-tail: the tip
    // lies 250 * tan 55 = 357.04 mm up; the vertical root plane stretches the airfoil 1/cos 55 times.
    const p = wizardProject({ ...PRESETS.tail.params, dihedral: 55 });
    expect(p.sections[1]).toMatchObject({ y: 250, z: 357.04 });
    const b = buildWing(p);
    expect([b.errors, b.sectionPlanes]).toEqual([[], 'mitred']);
    expect(b.stretches[0]).toBeCloseTo(1 / Math.cos((55 * Math.PI) / 180), 3);
    expect(b.tipRoll).toBeCloseTo(55, 3);
    // 60 degrees builds at the stretch limit of 2, in both directions; beyond it the wizard refuses.
    for (const dihedral of [60, -60]) expect(buildWing(wizardProject({ ...PRESETS.tail.params, dihedral })).errors).toEqual([]);
    expect(wizardProblems({ ...PRESETS.tail.params, dihedral: 60.5 })).toEqual(['dihedral must be between -60 and 60.']);
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
    // Halfway along a panel that stores its angle, the new section keeps it; beyond the tip it has none.
    const stored = sampleProject();
    stored.sections[0].panelAngle = 3;
    stored.sections[2].panelAngle = 7;
    expect(insertSection(stored, 0).panelAngle).toBe(3);
    expect(insertSection(stored, 3)).not.toHaveProperty('panelAngle');
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
    expect(wizardProblems({ ...params, tip: 'round' })).toContain('tip must be "flat", "pointed" or "elliptic".');
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
    // Vertical section planes: mitred planes place stations in every rolled panel from the start.
    const p = wizardProject({ span: 1000, rootChord: 10, taper: 0.99, sweep: -45, dihedral: 5, washout: 15, sections: 2, planform: 'straight', tip: 'pointed', rootAirfoil: '6409', tipAirfoil: '2410' });
    p.settings.sectionPlanes = 'vertical';
    const b = buildWing(p);
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

describe('wizard in German', () => {
  afterEach(() => setLanguage('en'));

  it('names the design types and their descriptions in the language read', () => {
    expect([PRESETS.sport.label, PRESETS.flyingWing.label, PRESETS.tail.label]).toEqual(['Sport', 'Swept flying wing', 'Tail surface']);
    setLanguage('de');
    expect([PRESETS.trainer.label, PRESETS.sport.label, PRESETS.glider.label]).toEqual(['Trainer', 'Sportmodell', 'Segelflugmodell']);
    expect([PRESETS.flyingWing.label, PRESETS.plank.label, PRESETS.tail.label]).toEqual(['Pfeilnurflügel', 'Brettnurflügel', 'Leitwerk']);
    expect(PRESETS.tail.description).toBe('Symmetrisches Höhenleitwerk.');
    // Every type has a German label and description.
    for (const preset of Object.values(PRESETS)) {
      expect(preset.label).toMatch(/[A-Za-zÄÖÜäöüß]/);
      expect(preset.description).toMatch(/[.]$/);
    }
    setLanguage('en');
    expect(PRESETS.tail.description).toBe('Symmetric horizontal stabilizer.');
  });

  it('words the problems with the parameters, with decimal commas', () => {
    const bad = { ...PRESETS.sport.params, span: 10, taper: 3, sections: 2.5, planform: 'round', tip: 'round', rootAirfoil: 'MH45' };
    expect(wizardProblems(bad)).toEqual([
      'span must be between 100 and 20000.',
      'taper must be between 0.1 and 1.5.',
      'sections must be an integer.',
      'planform must be "straight", "elliptic" or "panels".',
      'tip must be "flat", "pointed" or "elliptic".',
      'rootAirfoil must be a NACA 4- or 5-digit designation.',
    ]);
    setLanguage('de');
    expect(wizardProblems(bad)).toEqual([
      'Spannweite muss zwischen 100 und 20.000 liegen.',
      'Zuspitzung muss zwischen 0,1 und 1,5 liegen.',
      'Anzahl der Schnitte muss eine ganze Zahl sein.',
      'Grundriss muss "straight", "elliptic" oder "panels" sein.',
      'Flügelende muss "flat", "pointed" oder "elliptic" sein.',
      'Wurzelprofil muss eine NACA-Bezeichnung mit 4 oder 5 Ziffern sein.',
    ]);
    expect(wizardProblems({ ...PRESETS.glider.params, taper: 1, washout: -20, tipAirfoil: '' })).toEqual([
      'Schränkung am Rand muss zwischen -15 und 15 liegen.',
      'Ein elliptischer Grundriss braucht eine Zuspitzung < 1.',
      'Randprofil muss eine NACA-Bezeichnung mit 4 oder 5 Ziffern sein.',
    ]);
    // The error of wizardProject carries the same sentences.
    expect(() => wizardProject(bad)).toThrow(/^Spannweite muss zwischen 100 und 20\.000 liegen\. Zuspitzung muss /);
  });

  it('gives a project the default name of the language', () => {
    expect(wizardProject(PRESETS.sport.params).name).toBe('1200 mm wing');
    expect(defaultProject().name).toBe('Sport wing 1500');
    expect(createProject({ airfoils: sampleProject().airfoils, sections: sampleProject().sections }).name).toBe('Untitled wing');
    setLanguage('de');
    expect(wizardProject({ ...PRESETS.sport.params, span: 1500.5 }).name).toBe('Flügel 1500,5 mm');
    expect(wizardProject(PRESETS.sport.params, 'Mein Flügel').name).toBe('Mein Flügel');
    expect(defaultProject().name).toBe('Sportflügel 1500');
    expect(createProject({ airfoils: sampleProject().airfoils, sections: sampleProject().sections }).name).toBe('Unbenannter Flügel');
  });
});

describe('project validation in German', () => {
  afterEach(() => setLanguage('en'));

  it('words the limits with the digit groups of the language', () => {
    const p = sampleProject();
    p.sections[0].x = 2e6;
    p.sections[1].chord = 100_001;
    p.sections[2].twist = 400;
    p.guides.nose.points[1] = [1_200_000, 100];
    const en = limitErrors(p);
    expect(en).toEqual([
      'Section 1: x must be within ±1000000 mm.',
      'Section 2: chord must be at most 100000 mm.',
      'Section 3: twist must be within ±360 degrees.',
      'guides.nose.points: x must be within ±1100000 mm and y within ±1000000 mm.',
    ]);
    setLanguage('de');
    expect(limitErrors(p)).toEqual([
      'Schnitt 1: x muss innerhalb von ±1.000.000 mm liegen.',
      'Schnitt 2: Profiltiefe darf höchstens 100.000 mm betragen.',
      'Schnitt 3: Schränkung muss innerhalb von ±360 Grad liegen.',
      'guides.nose.points: x muss innerhalb von ±1.100.000 mm und y innerhalb von ±1.000.000 mm liegen.',
    ]);
    expect(limitErrors({ sections: new Array(LIMITS.maxSections + 1) })).toEqual(['Höchstens 20.000 Schnitte werden unterstützt (20.001 gefunden).']);
    const manyPoints = { sections: [], guides: { end: { points: new Array(LIMITS.maxGuidePoints + 5).fill([0, 0]) } } };
    expect(limitErrors(manyPoints)).toEqual(['guides.end.points: höchstens 20.000 Punkte (20.005 gefunden).']);
  });

  it('words the structural errors of a project', () => {
    const p = sampleProject();
    p.airfoils.push({ ...p.airfoils[0] });
    p.sections[1].airfoil = 'nope';
    p.sections[2].twist = 'x';
    p.settings = { tip: { mode: 'flat', ratio: 0.5 }, chordSamples: 5, spanwise: 'cubic' };
    const en = validateProject(p).errors;
    expect(en).toEqual([
      'Duplicate airfoil id "root".',
      'Section 2: unknown airfoil "nope".',
      'Section 3: twist must be a finite number.',
      'settings.spanwise must be "linear", "straight" or "smooth".',
      'settings.tip.ratio must be within 0.001..0.01 (1/1000 to 1/100).',
      'settings.chordSamples must be an integer within 16..200.',
    ]);
    setLanguage('de');
    expect(validateProject(p).errors).toEqual([
      'Doppelte Profil-ID „root“.',
      'Schnitt 2: unbekanntes Profil „nope“.',
      'Schnitt 3: Schränkung muss eine endliche Zahl sein.',
      'settings.spanwise muss "linear", "straight" oder "smooth" sein.',
      'settings.tip.ratio muss innerhalb von 0,001..0,01 liegen (1/1000 bis 1/100).',
      'settings.chordSamples muss eine ganze Zahl innerhalb von 16..200 sein.',
    ]);
    expect(validateProject(null).errors).toEqual(['Das Projekt ist kein Objekt.']);
    const inches = sampleProject();
    inches.units = 'in';
    inches.version = 4;
    expect(validateProject(inches).errors).toEqual(['units muss "mm" sein (gefunden: "in").', 'Nicht unterstützte Projektversion 4.']);
    const few = sampleProject();
    few.sections.pop();
    few.sections.pop();
    few.airfoils = [];
    expect(validateProject(few).errors).toEqual(['airfoils muss eine nichtleere Liste sein.', 'Mindestens 2 Schnitte sind erforderlich.']);
    const q = sampleProject();
    q.name = 'x'.repeat(10_001);
    q.airfoils[0].points = [[0, 0]];
    q.sections[0].y = -5;
    q.sections[1].chord = 0.5;
    expect(validateProject(q).errors).toEqual([
      'name hat 10.001 Zeichen; die Grenze liegt bei 10.000.',
      'Profil 1 braucht mindestens 5 numerische [x, y]-Punkte.',
      'Schnitt 1: y muss >= 0 sein (der Halbflügel liegt auf der +y-Seite).',
      'Schnitt 2: Profiltiefe muss mindestens 1 mm betragen.',
    ]);
  });

  it('words the errors of reading a project file', () => {
    const text = JSON.stringify(projectToJson(sampleProject(), null));
    const bad = JSON.stringify({ ...JSON.parse(text), format: 'other' });
    expect(projectFromJsonText(bad).errors).toEqual(['format must be "wingdesigner-project".']);
    const unnamed = JSON.parse(text);
    delete unnamed.name;
    expect(projectFromJsonText(JSON.stringify(unnamed)).project.name).toBe('Imported wing');
    setLanguage('de');
    expect(projectFromJsonText(bad).errors).toEqual(['format muss "wingdesigner-project" sein.']);
    expect(projectFromJsonText(JSON.stringify(unnamed)).project.name).toBe('Importierter Flügel');
    const broken = projectFromJsonText('{"format":');
    expect(broken.ok).toBe(false);
    expect(broken.errors[0]).toBe('Ungültiges JSON.');
    // Only the position of the engine's English message is kept.
    expect(projectFromJsonText('{"a" 1}').errors[0]).toMatch(/^Ungültiges JSON in Zeile 1, Spalte \d+\.$/);
    expect(projectFromJsonText(' '.repeat(MAX_PROJECT_BYTES + 1)).errors).toEqual(['Die Datei ist größer als 100 MB.']);
  });

  it('words the notice for a file without derived data and the failure of a file that is too large', () => {
    expect(omittedNote()).toBe(
      'The file leaves out the derived NURBS data: with it, the file would exceed 100 MB, the largest project file Open reads. Open recomputes it; STEP export writes the exact surfaces.',
    );
    setLanguage('de');
    expect(omittedNote()).toBe(
      'Die Datei lässt die abgeleiteten NURBS-Daten weg: Mit ihnen wäre sie größer als die 100 MB, die „Öffnen“ höchstens liest. „Öffnen“ berechnet sie neu; der STEP-Export schreibt die exakten Flächen.',
    );
    // Names near their limits make the file itself larger than Open reads: 100.1 MB.
    const p = sampleProject();
    p.name = 'x'.repeat(MAX_PROJECT_BYTES + 100_000);
    expect(() => projectFileText(p, null)).toThrow('Das Projekt belegt als Datei 100,1 MB, mehr als die 100 MB, die „Öffnen“ liest');
    setLanguage('en');
    expect(() => projectFileText(p, null)).toThrow('the project takes 100.1 MB as a file, above the 100 MB that Open reads');
  });
});

describe('edit messages in German', () => {
  afterEach(() => setLanguage('en'));

  it('words why no section can be inserted, with decimal commas', () => {
    const at = (ys) => sampleProject({ sections: ys.map((y) => ({ airfoil: 'root', x: 0, y, z: 0, chord: 200, twist: 0 })) });
    // Two span positions with no number between them.
    const tight = at([0, 100, 100 + 2 ** -44, 200]);
    expect(insertProblem(tight, 1)).toBe('No span position lies between y = 100 mm and y = 100.00000000000006 mm. Move the two sections apart first.');
    setLanguage('de');
    expect(insertProblem(tight, 1)).toBe('Zwischen y = 100 mm und y = 100,00000000000006 mm liegt keine Spannweitenposition. Zuerst die beiden Schnitte auseinanderschieben.');
    const full = sampleProject();
    full.sections = Array.from({ length: LIMITS.maxSections }, (_, i) => ({ ...full.sections[0], id: `s${i}`, y: i }));
    expect(insertProblem(full, 0)).toBe('Höchstens 20.000 Schnitte.');
    setLanguage('en');
    expect(insertProblem(full, 0)).toBe('At most 20,000 sections.');
    const beyond = at([0, 100, LIMITS.maxCoordinate]);
    expect(insertProblem(beyond, 2)).toBe('A section beyond the tip would lie beyond y = 1000000 mm.');
    setLanguage('de');
    expect(insertProblem(beyond, 2)).toBe('Ein Schnitt weiter außen als der Randschnitt läge jenseits von y = 1.000.000 mm.');
  });
});

describe('wizard panels', () => {
  const at = (p, y) => p.sections.find((q) => Math.abs(q.y - y) < 1e-6);

  it('places a section at the outer end of every panel, with the leading-edge sweep, chord and dihedral of the panel', () => {
    const params = {
      ...PRESETS.sport.params,
      span: 1000,
      rootChord: 200,
      washout: -2,
      planform: 'panels',
      // Shares 2 : 3 of the 500 mm half span: 200 mm and 300 mm.
      panels: [
        { span: 2, sweep: 10, chord: 0.8, dihedral: 0 },
        { span: 3, sweep: 30, chord: 0.5, dihedral: 5 },
      ],
    };
    expect(wizardProblems(params)).toEqual([]);
    const p = wizardProject(params);
    expect(p.sections.map((q) => q.y)).toEqual([0, 200, 500]);
    const tan = (d) => Math.tan((d * Math.PI) / 180);
    expect(at(p, 200)).toMatchObject({ chord: 160, z: 0, twist: -0.8 });
    expect(at(p, 200).x).toBeCloseTo(200 * tan(10), 2);
    expect(at(p, 500).x).toBeCloseTo(200 * tan(10) + 300 * tan(30), 2);
    expect(at(p, 500).z).toBeCloseTo(300 * tan(5), 2);
    expect(at(p, 500)).toMatchObject({ chord: 100, twist: -2 });
    expect(buildWing(p).errors).toEqual([]);
  });

  it('turns a straight planform into one panel with the same tip', () => {
    const straight = { ...PRESETS.sport.params, sweep: 12 };
    const panel = { ...straight, planform: 'panels', panels: panelsFromParams(straight) };
    const a = wizardProject(straight).sections.at(-1);
    const b = wizardProject(panel).sections.at(-1);
    // The leading-edge sweep is rounded to 0.1°: 600 mm · tan 0.05° = 0.52 mm at most.
    expect(Math.abs(a.x - b.x)).toBeLessThan(0.53);
    expect([b.y, b.chord, b.z]).toEqual([a.y, a.chord, a.z]);
  });

  it('ends an elliptic tip in a quarter ellipse about the straight 25 % line, pointed at the tip', () => {
    const p = wizardProject(PRESETS.sailplane.params);
    // 3 panels, the last replaced by the elliptic tip: root, 2 panel ends, ELLIPTIC_TIP_SECTIONS.
    expect(p.sections).toHaveLength(3 + ELLIPTIC_TIP_SECTIONS);
    expect(p.settings.tip.mode).toBe('pointed');
    const inner = p.sections[2];
    const tipSpan = 1500 - inner.y;
    const xq = inner.x + 0.25 * inner.chord;
    for (const q of p.sections.slice(3, -1)) {
      const t = (q.y - inner.y) / tipSpan;
      expect(q.chord).toBeCloseTo(inner.chord * Math.sqrt(1 - t * t), 1);
      expect(q.x + 0.25 * q.chord).toBeCloseTo(xq + (q.y - inner.y) * Math.tan((4 * Math.PI) / 180), 1);
    }
    expect(p.sections.at(-1)).toMatchObject({ y: 1500, chord: 1 });
    const b = buildWing(p);
    expect(b.errors).toEqual([]);
    expect(wingStats(b).aspectRatio).toBeCloseTo(16.75, 2);
    // The flat tip ends at the outer chord of the last panel.
    const flat = wizardProject({ ...PRESETS.sailplane.params, tip: 'flat' });
    expect(flat.sections.at(-1)).toMatchObject({ y: 1500, chord: 105 });
  });

  it('builds the delta presets with a straight trailing edge', () => {
    for (const key of ['deltaJet', 'doubleDelta']) {
      const p = wizardProject(PRESETS[key].params);
      const te = p.sections.map((q) => q.x + q.chord);
      for (const x of te) expect(Math.abs(x - p.sections[0].chord), key).toBeLessThan(0.5);
    }
    const dd = wizardProject(PRESETS.doubleDelta.params).sections;
    const angle = (a, b) => (Math.atan2(b.x - a.x, b.y - a.y) * 180) / Math.PI;
    expect(angle(dd[0], dd[1])).toBeCloseTo(70, 1);
    expect(angle(dd[1], dd[2])).toBeCloseTo(45, 1);
  });

  it('builds the batwing with its ears ahead and its spikes behind', () => {
    const p = wizardProject(PRESETS.batwing.params);
    const b = buildWing(p);
    expect(b.errors).toEqual([]);
    // Ear: the leading edge farthest forward, at 66 % of the 500 mm half span; spike: the trailing edge
    // farthest aft, at 51 %.
    const ear = p.sections.reduce((m, q) => (q.x < m.x ? q : m));
    const spike = p.sections.reduce((m, q) => (q.x + q.chord > m.x + m.chord ? q : m));
    expect(ear.y).toBeCloseTo(330, 6);
    expect(ear.x).toBeLessThan(-80);
    expect(spike.y).toBeCloseTo(255, 6);
    expect(spike.x + spike.chord).toBeGreaterThan(600);
    expect(p.settings.tip.mode).toBe('pointed');
  });

  it('checks the panel list', () => {
    const base = { ...PRESETS.deltaJet.params };
    expect(wizardProblems({ ...base, panels: [] })).toEqual([`The planform Panels needs 1 to ${MAX_PANELS} panels.`]);
    expect(wizardProblems({ ...base, panels: [{ span: 1, sweep: 85, chord: NaN, dihedral: 0 }] })).toEqual([
      'Panel 1: leading-edge sweep must be between -80 and 80.',
      'Panel 1: outer chord must be between 0 and 3.',
    ]);
    // A chord below 1 mm is allowed only at a pointed or elliptic tip.
    expect(wizardProblems({ ...base, panels: [{ span: 1, sweep: 50, chord: 0, dihedral: 0 }] })).toEqual(['Panel 1: the outer chord is below 1 mm.']);
    expect(wizardProblems({ ...base, tip: 'pointed', panels: [{ span: 1, sweep: 50, chord: 0, dihedral: 0 }] })).toEqual([]);
    expect(wizardProblems({ ...PRESETS.sport.params, tip: 'elliptic' })).toEqual(['An elliptic tip needs the planform Panels.']);
    // Taper, sweep, dihedral and sections are not used with panels.
    expect(wizardProblems({ ...base, taper: 9, sweep: 99, dihedral: 99, sections: 0.5 })).toEqual([]);
    setLanguage('de');
    expect(wizardProblems({ ...base, panels: [{ span: 1, sweep: 85, chord: 0.2, dihedral: 0 }] })).toEqual(['Feld 1: Pfeilung der Nasenleiste muss zwischen -80 und 80 liegen.']);
    setLanguage('en');
  });
});
