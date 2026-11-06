// Rounded wing tip (src/model/roundtip.js): the quarter ellipse of chords, the straight line, the
// reference points along the last panel, the checks, and the built wing with the rounded tip.
import { afterEach, describe, expect, it } from 'vitest';
import { addRoundTip, defaultRoundTip, roundTipProblems, roundTipSections } from '../src/model/roundtip.js';
import { addWinglet, defaultWinglet } from '../src/model/winglet.js';
import { PRESETS, wizardProject } from '../src/model/wizard.js';
import { buildWing } from '../src/geom/wing.js';
import { edgeCheck, exportMeshes } from '../src/geom/mesh.js';
import { sortedSections } from '../src/model/edit.js';
import { setLanguage } from '../src/i18n/index.js';

const DEG = Math.PI / 180;

afterEach(() => setLanguage('en'));

/** The Sport preset (tip at y = 600 mm, z = 15.71 mm, chord 144 mm, dihedral 1.5°, taper 0.6). */
const sport = () => wizardProject(PRESETS.sport.params);

describe('rounded-tip sections', () => {
  it('follow a quarter ellipse of chords with the straight line on the line of the last panel', () => {
    const p = sport();
    const [prev, tip] = sortedSections(p).slice(-2);
    const params = { length: 150, line: 25, sections: 6 };
    const out = roundTipSections(p, params);
    expect(out).toHaveLength(6);
    const slope = (tip.x + 0.25 * tip.chord - (prev.x + 0.25 * prev.chord)) / (tip.y - prev.y);
    const dy = 150 * Math.cos(1.5 * DEG);
    out.forEach((q, i) => {
      const k = i + 1;
      const t = k === 6 ? 1 : Math.sin((Math.PI * k) / 12);
      expect(q.y).toBeCloseTo(tip.y + t * dy, 1);
      expect(q.z).toBeCloseTo(tip.z + t * 150 * Math.sin(1.5 * DEG), 1);
      // The quarter-chord point stays on the line of the last panel.
      expect(q.x + 0.25 * q.chord).toBeCloseTo(tip.x + 0.25 * tip.chord + (q.y - tip.y) * slope, 1);
      if (k < 6) expect(q.chord).toBeCloseTo(tip.chord * Math.sqrt(1 - t * t), 1);
      expect([q.airfoil, q.twist]).toEqual([tip.airfoil, tip.twist]);
    });
    // The point takes the chord of a pointed tip: 1/200 of the section before, at least 1 mm.
    expect(out[5].chord).toBe(Math.max(1, Math.round(out[4].chord * 0.5) / 100));
    expect(out[5].chord).toBe(1);
  });

  it('keep the leading edge straight with the line at 0 % and the trailing edge straight at 100 %', () => {
    const p = sport();
    const [prev, tip] = sortedSections(p).slice(-2);
    const le = (tip.x - prev.x) / (tip.y - prev.y);
    for (const q of roundTipSections(p, { length: 144, line: 0, sections: 4 })) expect(q.x).toBeCloseTo(tip.x + (q.y - tip.y) * le, 1);
    const te = (tip.x + tip.chord - prev.x - prev.chord) / (tip.y - prev.y);
    for (const q of roundTipSections(p, { length: 144, line: 100, sections: 4 })) expect(q.x + q.chord).toBeCloseTo(tip.x + tip.chord + (q.y - tip.y) * te, 1);
  });
});

describe('rounded tip on the presets', () => {
  it('builds a closed wing on every preset with a flat tip and no guide curves, Linear and Smooth, mitred and vertical planes', () => {
    for (const [key, preset] of Object.entries(PRESETS)) {
      if (key === 'batwing') continue;
      for (const spanwise of ['linear', 'smooth']) {
        for (const planes of ['mitred', 'vertical']) {
          const p = wizardProject({ ...preset.params, tip: 'flat' });
          p.guides.nose.enabled = false;
          p.guides.end.enabled = false;
          p.settings.spanwise = spanwise;
          p.settings.sectionPlanes = planes;
          const before = p.sections.length;
          const r = defaultRoundTip(p);
          expect(roundTipProblems(p, r), key).toEqual([]);
          const added = addRoundTip(p, r);
          expect(p.sections).toHaveLength(before + added.length);
          expect(p.settings.tip.mode).toBe('pointed');
          const b = buildWing(p);
          const label = `${key} ${spanwise} ${planes}`;
          expect(b.errors, label).toEqual([]);
          expect(b.warnings, label).toEqual([]);
          for (const m of exportMeshes(b, 'halves')) expect(edgeCheck(m.mesh).closed, label).toBe(true);
        }
      }
    }
  });

  it('builds straight lines from 0 % to 100 % with 2 to 8 sections on the Sport wing', () => {
    for (const line of [0, 25, 50, 75, 100]) {
      for (const sections of [2, 4, 8]) {
        const p = sport();
        addRoundTip(p, { ...defaultRoundTip(p), line, sections });
        const b = buildWing(p);
        expect(b.errors, `${line} % ${sections}`).toEqual([]);
        expect(b.tipChord, `${line} % ${sections}`).toBe(1);
      }
    }
  });

  it('runs on along a winglet and keeps a stored panel angle on the added panels', () => {
    const p = sport();
    addWinglet(p, defaultWinglet(p));
    const tip = sortedSections(p).at(-1);
    const added = addRoundTip(p, { ...defaultRoundTip(p), length: 144 });
    const [a, b] = added.slice(-2);
    expect(Math.atan2(b.z - a.z, b.y - a.y) / DEG).toBeCloseTo(75, 0);
    expect(added[0].y).toBeGreaterThan(tip.y);
    expect(buildWing(p).errors).toEqual([]);
    const stored = sport();
    const s = sortedSections(stored);
    s[0].panelAngle = 1.5;
    const more = addRoundTip(stored, defaultRoundTip(stored));
    expect(s[1].panelAngle).toBe(1.5);
    expect(more.map((q) => q.panelAngle ?? null)).toEqual([1.5, 1.5, 1.5, 1.5, 1.5, null]);
    expect(buildWing(stored).errors).toEqual([]);
  });
});

describe('rounded-tip checks', () => {
  it('refuse values out of range, guide curves, a pointed tip, a small tip chord and short panels', () => {
    const p = sport();
    const r = defaultRoundTip(p);
    expect(r).toEqual({ length: 144, line: 25, sections: 6 });
    expect(roundTipProblems(p, { ...r, line: 101, sections: 2.5 })).toEqual(['Rounded tip: straight line must be between 0 and 100.', 'Rounded tip: the number of sections must be a whole number.']);
    const guided = sport();
    guided.guides.end.enabled = true;
    expect(roundTipProblems(guided, r)).toEqual(['Switch the guide curves off first: they hold x as a function of y and would stretch over the rounded tip.']);
    const pointed = sport();
    pointed.settings.tip.mode = 'pointed';
    expect(roundTipProblems(pointed, r)).toEqual(['The wing already ends in a point (Settings > Wing tip = Pointed): a rounded tip needs a flat tip.']);
    // 24 sections keep cos(23π/48) = 0.0654 of the tip chord at the last section before the point.
    const small = sport();
    sortedSections(small).at(-1).chord = 10;
    expect(roundTipProblems(small, { ...r, sections: 24 })).toEqual(['Rounded tip: with 24 sections the tip chord must be at least 15.29 mm; use fewer sections.']);
    // The last of 12 panels spans 0.86 % of the length: 0.42 mm of 50 mm after rounding to 0.01 mm.
    expect(roundTipProblems(p, { ...r, length: 50, sections: 12 })).toEqual(['Rounded-tip panel 12 spans 0.42 mm in y, less than 1 mm; increase the length or use fewer sections.']);
    expect(addRoundTip(p, { ...r, length: 1 })).toBeNull();
    expect(p.settings.tip.mode).toBe('flat');
    setLanguage('de');
    expect(roundTipProblems(p, { ...r, length: 1 })).toEqual(['Randbogen: Länge muss zwischen 5 und 100000 liegen.']);
  });
});
