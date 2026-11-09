// Rounded wing tip (src/model/roundtip.js): the quarter ellipse of chords, the straight line, the
// reference points along the last panel, the checks, and the built wing with the rounded tip.
import { afterEach, describe, expect, it } from 'vitest';
import { addRoundTip, defaultRoundTip, roundTipKappa, roundTipLength, roundTipProblems, roundTipSections, wingEllipse } from '../src/model/roundtip.js';
import { edgeInflections } from './fairness.js';
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
    const params = { length: 150, line: 25, sections: 6, tangent: false, fullness: 2 };
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
    for (const q of roundTipSections(p, { length: 144, line: 0, sections: 4, tangent: true, fullness: 2.5 })) expect(q.x).toBeCloseTo(tip.x + (q.y - tip.y) * le, 1);
    const te = (tip.x + tip.chord - prev.x - prev.chord) / (tip.y - prev.y);
    for (const q of roundTipSections(p, { length: 144, line: 100, sections: 4, tangent: true, fullness: 2.5 })) expect(q.x + q.chord).toBeCloseTo(tip.x + tip.chord + (q.y - tip.y) * te, 1);
  });
});

describe('fullness', () => {
  it('puts the chord on the superellipse (1 − t^n)^(1/n), fuller than the ellipse for n above 2, and refuses n outside 2 to 3', () => {
    const p = sport();
    const tip = sortedSections(p).at(-1);
    const base = { length: 144, line: 25, sections: 6, tangent: false };
    const ellipse = roundTipSections(p, { ...base, fullness: 2 });
    const full = roundTipSections(p, { ...base, fullness: 2.5 });
    full.slice(0, -1).forEach((q, i) => {
      const t = Math.sin((Math.PI * (i + 1)) / 12);
      expect(q.chord).toBeCloseTo(tip.chord * Math.pow(1 - Math.pow(t, 2.5), 1 / 2.5), 1);
      expect(q.chord).toBeGreaterThan(ellipse[i].chord);
      expect(q.y).toBe(ellipse[i].y);
    });
    // At t = sin 75° = 0.966 the chord is 37.27 mm on the ellipse and 53.22 mm at n = 2.5.
    expect([ellipse[4].chord, full[4].chord]).toEqual([37.27, 53.22]);
    expect(roundTipProblems(p, { ...base, fullness: 3.5 })).toEqual(['Rounded tip: fullness must be between 2 and 3.']);
    expect(roundTipProblems(p, { ...base, fullness: 3 })).toEqual([]);
  });
});

describe('continue the ellipse', () => {
  it('finds the ellipse of the Glider from chord and taper at the tip section and carries it on to its end, without waves from root to point', () => {
    // Glider: half span 1000 mm, root chord 200 mm, elliptic planform with taper 0.45 by guide curves:
    // c = 200 · sqrt(1 − (1 − 0.45²) η²), which closes at η = 1 / sqrt(1 − 0.45²), y = 1119.8 mm.
    const glider = () => wizardProject(PRESETS.glider.params);
    const p = glider();
    expect([p.guides.nose.enabled, p.guides.end.enabled]).toEqual([true, true]);
    const e = wingEllipse(p);
    expect(e.y0 + 1 / Math.sqrt(e.m)).toBeCloseTo(1000 / Math.sqrt(1 - 0.45 ** 2), -0.5);
    expect(e.chordAt(1000)).toBeCloseTo(90, 0);
    const r = defaultRoundTip(p);
    expect(r.ellipse).toBe(true);
    expect(roundTipLength(p, r)).toBe(Math.round(e.length * 100) / 100);
    for (const spanwise of ['linear', 'smooth']) {
      const q = glider();
      q.settings.spanwise = spanwise;
      q.settings.trailingEdge = { mode: 'closed', thickness: 0 };
      const added = addRoundTip(q, defaultRoundTip(q));
      // The guide curves keep ending at the tip section; the sections follow the ellipse.
      expect(q.guides.end.points.at(-1)[1]).toBe(1000);
      added.slice(0, -1).forEach((s) => expect(s.chord).toBeCloseTo(e.chordAt(s.y), 1));
      const b = buildWing(q);
      expect(b.errors, spanwise).toEqual([]);
      expect(b.tipY).toBeCloseTo(e.y0 + 1 / Math.sqrt(e.m), 1);
      const f = edgeInflections(b, b.rootY + 1, b.tipY - 0.3);
      expect([f.le.count, f.te.count], spanwise).toEqual([0, 0]);
    }
  });
});

describe('rounded tip after one guide curve', () => {
  it('starts from the guided edge and the blended chord when only one guide curve is on', () => {
    // Glider with the end line off and the last nose-line point moved 20 mm aft: the leading edge
    // follows the nose line, the chord the sections (90 mm at the tip section).
    for (const key of ['nose', 'end']) {
      const p = wizardProject(PRESETS.glider.params);
      p.guides[key === 'nose' ? 'end' : 'nose'].enabled = false;
      p.guides[key].points.at(-1)[0] += 20;
      addRoundTip(p, { ...defaultRoundTip(p), ellipse: false });
      const b = buildWing(p);
      expect(b.errors, key).toEqual([]);
      const [a, c] = [b.planformAt(1000), b.planformAt(1000 + 1e-6)];
      expect(Math.abs(c.chord - a.chord), key).toBeLessThan(1e-3);
      expect(Math.abs(c.xLE - a.xLE), key).toBeLessThan(1e-3);
    }
  });
});

describe('tangent rounded tip', () => {
  it('starts the chord with the taper of the last panel; without tangent with slope 0', () => {
    const p = sport();
    const [prev, tip] = sortedSections(p).slice(-2);
    const taper = (tip.chord - prev.chord) / (tip.y - prev.y);
    expect(taper).toBeCloseTo(-0.16, 9);
    const params = { length: 144, line: 25, sections: 6, tangent: true, fullness: 2 };
    const kappa = roundTipKappa(p, params);
    expect(kappa).toBeCloseTo((-0.16 * 144 * Math.cos(1.5 * DEG)) / 144, 6);
    expect(roundTipKappa(p, { ...params, tangent: false })).toBe(0);
    roundTipSections(p, params)
      .slice(0, -1)
      .forEach((q, i) => {
        const t = Math.sin((Math.PI * (i + 1)) / 12);
        expect(q.chord).toBeCloseTo(144 * Math.sqrt(1 - t * t) * (1 + kappa * t), 1);
      });
    // The slope of the first rounded-tip panel approaches the taper of the last panel as the first
    // section moves towards the tip: c(s) = c_T (1 + κ s − s²/2 + …), off by c_T s / (2 D).
    const dense = { ...params, sections: 24 };
    const [first] = roundTipSections(p, dense);
    const s1 = (first.y - tip.y) / (144 * Math.cos(1.5 * DEG));
    expect(Math.abs((first.chord - tip.chord) / (first.y - tip.y) - taper)).toBeLessThan(s1 / 2 + 0.002);
    const [flat] = roundTipSections(p, { ...dense, tangent: false });
    // Without tangent the slope is −c_T s / (2 D) = −0.033: 0.127 off the taper.
    expect(Math.abs((flat.chord - tip.chord) / (flat.y - tip.y) - taper)).toBeGreaterThan(0.12);
    // Leading and trailing edge run on along the edges of the last panel at the same rate.
    const le = (tip.x - prev.x) / (tip.y - prev.y);
    expect(Math.abs((first.x - tip.x) / (first.y - tip.y) - le)).toBeLessThan(0.25 * (s1 / 2 + 0.002));
  });

  it('refuses a tangent tip longer than the last panel allows before it tapers to zero chord', () => {
    const p = sport();
    const r = defaultRoundTip(p);
    // dc/dy = −0.16: zero chord 144 / (0.16 · cos 1.5°) = 900.31 mm beyond the tip; κ ≤ −0.95 at 855.29 mm.
    expect(roundTipProblems(p, { ...r, length: 856 })).toEqual(['Rounded tip: the last panel tapers to zero chord within 900.31 mm, so a tangent tip can be at most 855.29 mm long; reduce the length or switch off Tangent to the last panel.']);
    expect(roundTipProblems(p, { ...r, length: 855 })).toEqual([]);
    expect(roundTipProblems(p, { ...r, length: 856, tangent: false })).toEqual([]);
    expect(roundTipProblems(p, { ...r, tangent: 'yes' })).toEqual(['Rounded tip: tangent must be on or off.']);
  });
});

describe('rounded tip on the presets', () => {
  // 9 presets × 2 interpolations × 2 plane modes × tangent on and off: 72 builds and 144 meshes, 16 s
  // under coverage in a cloud container, more than 20 s on CI.
  it('builds a closed wing on every preset with a flat tip and no guide curves, Linear and Smooth, mitred and vertical planes, tangent or not', { timeout: 90000 }, () => {
    const limited = new Set();
    for (const [key, preset] of Object.entries(PRESETS)) {
      if (key === 'batwing') continue;
      for (const spanwise of ['linear', 'smooth']) {
        for (const [planes, tangent] of ['mitred', 'vertical'].flatMap((q) => [[q, true], [q, false]])) {
          const p = wizardProject({ ...preset.params, tip: 'flat' });
          p.guides.nose.enabled = false;
          p.guides.end.enabled = false;
          p.settings.spanwise = spanwise;
          p.settings.sectionPlanes = planes;
          const before = p.sections.length;
          const r = { ...defaultRoundTip(p), tangent };
          expect(roundTipProblems(p, r), key).toEqual([]);
          const added = addRoundTip(p, r);
          expect(p.sections).toHaveLength(before + added.length);
          expect(p.settings.tip.mode).toBe('pointed');
          const b = buildWing(p);
          const label = `${key} ${spanwise} ${planes} tangent ${r.tangent}`;
          expect(b.errors, label).toEqual([]);
          // A tangent tip falls faster in chord than the superellipse before the last panel: a fixed
          // trailing-edge thickness (Delta jet 1.6 mm) can exceed 5 % of the chord at a station
          // there, which the build limits and reports.
          const rest = tangent ? b.warnings.filter((w) => !/^Trailing-edge thickness [\d.]+ mm exceeds 5 % of the chord at \d+ station/.test(w)) : b.warnings;
          if (rest.length < b.warnings.length) limited.add(key);
          expect(rest, label).toEqual([]);
          for (const m of exportMeshes(b, 'halves')) expect(edgeCheck(m.mesh).closed, label).toBe(true);
        }
      }
    }
    expect([...limited]).toEqual(['deltaJet']);
  });

  it('builds straight lines from 0 % to 100 % with 2 to 8 sections on the Sport wing', () => {
    for (const line of [0, 25, 50, 75, 100]) {
      for (const sections of [2, 4, 8]) {
        const p = sport();
        addRoundTip(p, { ...defaultRoundTip(p), line, sections, tangent: sections !== 4 });
        const b = buildWing(p);
        expect(b.errors, `${line} % ${sections}`).toEqual([]);
        // A straight edge is blended without its 0.01 mm rounding (src/geom/tipblend.js): within 0.01 mm.
        expect(Math.abs(b.tipChord - 1), `${line} % ${sections}`).toBeLessThanOrEqual(0.01);
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
    expect(r).toEqual({ length: 144, line: 25, sections: 6, tangent: true, fullness: 2.5, ellipse: false });
    expect(roundTipProblems(p, { ...r, line: 101, sections: 2.5 })).toEqual(['Rounded tip: straight line must be between 0 and 100.', 'Rounded tip: the number of sections must be a whole number.']);
    const guided = sport();
    guided.guides.end.enabled = true;
    expect(roundTipProblems(guided, r)).toEqual([]);
    // A wing that widens at the tip section has no ellipse to continue.
    const widening = sport();
    sortedSections(widening).at(-1).chord = 260;
    expect(roundTipProblems(widening, { ...r, ellipse: true })).toEqual(['Continue the ellipse: the wing does not narrow towards the tip section, so it has no ellipse to continue.']);
    const pointed = sport();
    pointed.settings.tip.mode = 'pointed';
    expect(roundTipProblems(pointed, r)).toEqual(['The wing already ends in a point (Settings > Wing tip = Pointed): a rounded tip needs a flat tip.']);
    // 24 sections keep cos(23π/48) = 0.0654 of the tip chord at the last section before the point.
    const small = sport();
    sortedSections(small).at(-1).chord = 10;
    expect(roundTipProblems(small, { ...r, sections: 24, tangent: false, fullness: 2 })).toEqual(['Rounded tip: with 24 sections the tip chord must be at least 15.29 mm; use fewer sections.']);
    // The last of 12 panels spans 0.86 % of the length: 0.42 mm of 50 mm after rounding to 0.01 mm.
    expect(roundTipProblems(p, { ...r, length: 50, sections: 12 })).toEqual(['Rounded-tip panel 12 spans 0.42 mm in y, less than 1 mm; increase the length or use fewer sections.']);
    expect(addRoundTip(p, { ...r, length: 1 })).toBeNull();
    expect(p.settings.tip.mode).toBe('flat');
    setLanguage('de');
    expect(roundTipProblems(p, { ...r, length: 1 })).toEqual(['Randbogen: Länge muss zwischen 5 und 100000 liegen.']);
  });
});
