// Rounded wing tip (src/model/roundtip.js): the quarter ellipse of chords, the straight line, the
// reference points along the last panel, the checks, and the built wing with the rounded tip.
import { afterEach, describe, expect, it } from 'vitest';
import { addRoundTip, defaultRoundTip, roundTipKappa, roundTipLength, roundTipProblems, roundTipSections, wingEllipse } from '../src/model/roundtip.js';
import { edgeInflections } from './fairness.js';
import { addWinglet, defaultWinglet } from '../src/model/winglet.js';
import { PRESETS, wizardProject } from '../src/model/wizard.js';
import { buildWing } from '../src/geom/wing.js';
import { edgeCheck, exportMeshes } from '../src/geom/mesh.js';
import { surfacePoint } from '../src/geom/nurbs.js';
import { wingStats } from '../src/geom/stats.js';
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
      // The quarter-chord point stays on the line of the last panel; the point itself lies on it.
      expect(q.x + (k < 6 ? 0.25 * q.chord : 0)).toBeCloseTo(tip.x + 0.25 * tip.chord + (q.y - tip.y) * slope, 1);
      if (k < 6) expect(q.chord).toBeCloseTo(tip.chord * Math.sqrt(1 - t * t), 1);
      expect([q.airfoil, q.twist]).toEqual([tip.airfoil, tip.twist]);
    });
    // The point stores the smallest chord of a section; the build closes it with chord 0 (Wing tip Round).
    expect(out[5].chord).toBe(1);
  });

  it('keep the leading edge straight with the line at 0 % and the trailing edge straight at 100 %', () => {
    const p = sport();
    const [prev, tip] = sortedSections(p).slice(-2);
    const le = (tip.x - prev.x) / (tip.y - prev.y);
    for (const q of roundTipSections(p, { length: 144, line: 0, sections: 4, tangent: true, fullness: 2.5 })) expect(q.x).toBeCloseTo(tip.x + (q.y - tip.y) * le, 1);
    const te = (tip.x + tip.chord - prev.x - prev.chord) / (tip.y - prev.y);
    // The point lies on the line: its x is the trailing edge.
    roundTipSections(p, { length: 144, line: 100, sections: 4, tangent: true, fullness: 2.5 }).forEach((q, i) => expect(q.x + (i < 3 ? q.chord : 0)).toBeCloseTo(tip.x + tip.chord + (q.y - tip.y) * te, 1));
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
          expect(p.settings.tip.mode).toBe('round');
          const b = buildWing(p);
          const label = `${key} ${spanwise} ${planes} tangent ${r.tangent}`;
          expect(b.errors, label).toEqual([]);
          expect([b.tipPole, b.stations.at(-1).chord], label).toEqual([true, 0]);
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
        // The tip closes in a point: leading edge, trailing edge and every point between coincide.
        expect(b.tipPole, `${line} % ${sections}`).toBe(true);
        const P = surfacePoint(b.surface, b.uLE, 1);
        for (const u of [0, 0.3, 1]) expect(Math.hypot(...surfacePoint(b.surface, u, 1).map((v, k) => v - P[k])), `${line} % ${sections}`).toBeLessThan(1e-9);
        expect(b.stations.at(-1).chord).toBe(0);
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
    expect(roundTipProblems(pointed, r)).toEqual(['The wing already ends in a point (Settings > Wing tip = Pointed or Round): a rounded tip needs a flat tip.']);
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

describe('Wing tip Round', () => {
  /** Largest distance (mm) of the surface points at v = 1 from the point at the leading edge, at 101 u. */
  const poleSpread = (b) => {
    const P = surfacePoint(b.surface, b.uLE, 1);
    let max = 0;
    for (let i = 0; i <= 100; i++) max = Math.max(max, Math.hypot(...surfacePoint(b.surface, i / 100, 1).map((v, k) => v - P[k])));
    return max;
  };

  it('closes the Sport wing in one point: tipPole, chord 0 at the last station, and no trailing-edge warning from the closing chord', () => {
    const p = sport();
    // The wizard sets a fixed trailing-edge thickness (0.48 mm at 240 mm root chord): every station
    // of the closing panel is narrower than 0.48 / 0.05 = 9.6 mm near the point.
    expect(p.settings.trailingEdge.mode).toBe('thickness');
    addRoundTip(p, defaultRoundTip(p));
    expect(p.settings.tip.mode).toBe('round');
    const b = buildWing(p);
    expect(b.errors).toEqual([]);
    expect(b.warnings).toEqual([]);
    expect(b.tipPole).toBe(true);
    expect(b.tipChord).toBeNull();
    expect(b.stations.at(-1).chord).toBe(0);
    expect(b.stations.slice(0, -1).every((st) => st.chord > 0)).toBe(true);
    expect(b.stations.filter((st) => st.chord > 0 && st.chord < 9.6).length).toBeGreaterThan(0);
    expect(poleSpread(b)).toBeLessThan(1e-9);
    // The point lies at the y of the last section, on the straight line of the dialog.
    expect(b.tipY).toBe(sortedSections(p).at(-1).y);
  });

  it('is a build error on a wing whose last section carries no rounded-tip marker, in English and German', () => {
    const p = sport();
    p.settings.tip.mode = 'round';
    const en = 'Settings > Wing tip Round closes the tip in a point and needs a rounded tip: add one with Sections > Rounded tip…, or set the wing tip to Flat or Pointed.';
    const b = buildWing(p);
    expect(b.errors).toEqual([en]);
    expect(b.surface).toBeFalsy();
    // A marker on an inner section only does not count: the last section has to carry it.
    const inner = sport();
    addRoundTip(inner, defaultRoundTip(inner));
    delete sortedSections(inner).at(-1).roundTip;
    expect(buildWing(inner).errors).toEqual([en]);
    setLanguage('de');
    expect(buildWing(p).errors).toEqual([
      'Einstellungen > Flügelende Rund schließt das Flügelende in einem Punkt und braucht einen Randbogen: mit Schnitte > Randbogen … einen anfügen oder das Flügelende auf Flach oder Spitz setzen.',
    ]);
  });

  it('builds a polygon outline to the point with Straight panels', () => {
    const p = sport();
    addRoundTip(p, defaultRoundTip(p));
    p.settings.spanwise = 'straight';
    const b = buildWing(p);
    expect(b.errors).toEqual([]);
    expect(b.tipPole).toBe(true);
    expect(b.stations.at(-1).chord).toBe(0);
    expect(poleSpread(b)).toBeLessThan(1e-9);
    // Straight panels: the chord runs linearly between the sections (the stored 1 mm at the point
    // counts as 0), so the outline is a polygon. Middle of the last panel: half the chord before it.
    const s = sortedSections(p);
    const [a, c] = s.slice(-2);
    for (const [q, r] of s.slice(1, -1).map((q, i) => [q, s[i + 2]])) {
      const chordR = r === c ? 0 : r.chord;
      expect(b.planformAt((q.y + r.y) / 2).chord).toBeCloseTo((q.chord + chordR) / 2, 6);
    }
    expect(b.planformAt((a.y + c.y) / 2).chord).toBeCloseTo(a.chord / 2, 6);
  });

  it('closes in a point with every trailing-edge setting and with mitred and vertical planes', () => {
    for (const te of ['asis', 'closed', 'thickness']) {
      for (const planes of ['mitred', 'vertical']) {
        const p = sport();
        p.settings.trailingEdge = { mode: te, thickness: 0.5 };
        p.settings.sectionPlanes = planes;
        addRoundTip(p, defaultRoundTip(p));
        const b = buildWing(p);
        const label = `${te} ${planes}`;
        expect(b.errors, label).toEqual([]);
        expect(b.warnings, label).toEqual([]);
        expect([b.tipPole, b.stations.at(-1).chord], label).toEqual([true, 0]);
        // As in the file: the MH 32 of the Sport preset ends closed.
        expect(b.closedTE, label).toBe(te !== 'thickness');
        expect(poleSpread(b), label).toBeLessThan(1e-9);
        for (const m of exportMeshes(b, 'halves')) expect(edgeCheck(m.mesh).closed, label).toBe(true);
      }
    }
  });
});

describe('outline of the closed tip against the wing ellipse', () => {
  /**
   * Chord (mm) of the cut y = const of the built surface: largest minus smallest x over `nu` + 1
   * surface parameters u, each point found by bisection on v (y grows with v for every u), as in
   * docs/analysis/rounded-tip-cuts/extract-cuts.mjs.
   */
  const cutChord = (b, y, nu = 600) => {
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i <= nu; i++) {
      const u = i / nu;
      if (surfacePoint(b.surface, u, 1)[1] < y) continue;
      let a = b.vAt(y - 10);
      let c = 1;
      for (let k = 0; k < 50; k++) {
        const m = (a + c) / 2;
        if (surfacePoint(b.surface, u, m)[1] < y) a = m;
        else c = m;
      }
      const x = surfacePoint(b.surface, u, (a + c) / 2)[0];
      lo = Math.min(lo, x);
      hi = Math.max(hi, x);
    }
    return hi - lo;
  };
  const glider = (spanwise, params = {}) => {
    const p = wizardProject(PRESETS.glider.params);
    p.settings.spanwise = spanwise;
    const e = wingEllipse(p);
    addRoundTip(p, { ...defaultRoundTip(p), ...params });
    return { p, e, b: buildWing(p) };
  };

  it('follows the ellipse of the Glider within 0.03 mm at 2.8, 1.8 and 0.8 mm before the point (Continue the ellipse, defaults)', () => {
    const { b, e } = glider('linear');
    expect(b.errors).toEqual([]);
    // Point at y = 1119.83 mm; the ellipse closes at 1119.825 mm. Cuts at y = 1117, 1118 and 1119 mm:
    // −0.01, 0.00 and +0.02 mm. With the 1 mm chord of Wing tip Pointed at the point: +0.04, +0.14
    // and +0.34 mm.
    expect(b.tipY).toBe(1119.83);
    expect(e.y0 + 1 / Math.sqrt(e.m)).toBeCloseTo(1119.825, 3);
    const d = [1117, 1118, 1119].map((y) => cutChord(b, y) - e.chordAt(y));
    d.forEach((v) => expect(Math.abs(v)).toBeLessThan(0.03));
    expect(d.map((v) => Math.round(v * 100) / 100)).toEqual([-0.01, 0, 0.02]);
  });

  it('stays within 0.03 mm of the ellipse 0.8 mm before the point with the straight line at 25 % and 50 %, Linear and Smooth', () => {
    for (const spanwise of ['linear', 'smooth']) {
      for (const line of [25, 50]) {
        const { b, e } = glider(spanwise, { line });
        expect(b.errors, `${spanwise} ${line}`).toEqual([]);
        // 25 %: +0.023 mm, 50 %: +0.025 mm (the guide curves set the outline inboard, the same for Linear and Smooth).
        expect(Math.abs(cutChord(b, 1119, 300) - e.chordAt(1119)), `${spanwise} ${line}`).toBeLessThan(0.03);
      }
    }
  });

  it('keeps a version 5 project (Wing tip Pointed with marked sections) at the 1 mm chord of the point, with the outline of the natural end and no new waves', () => {
    const { p, e } = glider('linear');
    p.settings.tip.mode = 'pointed';
    expect(sortedSections(p).at(-1).chord).toBe(1);
    const b = buildWing(p);
    expect(b.errors).toEqual([]);
    expect(b.warnings).toEqual([]);
    expect(b.tipPole).toBe(false);
    // tip.ratio 1/200 of 17.06 mm is 0.09 mm: the tip chord stays at the smallest chord, 1 mm.
    expect(b.tipChord).toBeCloseTo(1, 2);
    expect(b.stations.at(-1).chord).toBeCloseTo(1, 2);
    // The natural end of the tip blend (src/geom/tipblend.js): +0.045, +0.14 and +0.34 mm against the
    // ellipse at the three cuts, as the build before Wing tip Round.
    const d = [1117, 1118, 1119].map((y) => cutChord(b, y) - e.chordAt(y));
    [0.045, 0.14, 0.337].forEach((v, k) => expect(Math.abs(d[k] - v), `cut ${k}`).toBeLessThan(0.005));
    const f = edgeInflections(b, 1000.5, b.tipY - 0.3);
    expect([f.le.count, f.te.count]).toEqual([0, 0]);
  });
});

describe('statistics of a tip closed in a point', () => {
  it('gives finite span, area and mean aerodynamic chord, tip chord 0, and the area of Wing tip Pointed within 0.1 %', () => {
    for (const key of ['sport', 'glider']) {
      const p = wizardProject(PRESETS[key].params);
      addRoundTip(p, defaultRoundTip(p));
      const round = wingStats(buildWing(p));
      for (const k of ['span', 'area', 'aspectRatio', 'mac', 'macY', 'macXLE', 'x25']) expect(Number.isFinite(round[k]), `${key} ${k}`).toBe(true);
      expect(round.tipChord, key).toBe(0);
      // Span: twice the y of the point (Sport 743.95 mm, Glider 1119.83 mm).
      expect(round.span, key).toBeCloseTo(2 * sortedSections(p).at(-1).y, 9);
      // The 1 mm chord of Wing tip Pointed at the point adds area: 1.4 mm² of 351,797 mm² on the Glider.
      p.settings.tip.mode = 'pointed';
      const pointed = wingStats(buildWing(p));
      expect(pointed.tipChord, key).toBeCloseTo(1, 2);
      expect(Math.abs(round.area / pointed.area - 1), key).toBeLessThan(1e-3);
      expect(round.area, key).toBeLessThan(pointed.area);
    }
  });
});
