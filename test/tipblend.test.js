// Rounded-tip blend (src/geom/tipblend.js): when it applies, the span parameter along the tip ellipse,
// the blend through the sections, the inboard blend and the slope at the tip section, the project
// format of the marker, and the fairness of the built tip on the presets.
import { describe, expect, it } from 'vitest';
import { ROUND_TIP_START_SECTIONS, guideEndIndex, roundTipBlender, roundTipStart, spanParameter } from '../src/geom/tipblend.js';
import { spanwiseBlender } from '../src/geom/spanwise.js';
import { addRoundTip, defaultRoundTip } from '../src/model/roundtip.js';
import { PRESETS, wizardProject } from '../src/model/wizard.js';
import { buildWing } from '../src/geom/wing.js';
import { insertSection, sortedSections } from '../src/model/edit.js';
import { fileVersion, validateProject } from '../src/model/project.js';
import { projectFromJsonText, projectToJsonText } from '../src/model/io.js';
import { edgeInflections } from './fairness.js';

/** The Sport preset with the default rounded tip (tip section at y = 600 mm). */
const roundedSport = (spanwise = 'linear', params = {}) => {
  const p = wizardProject(PRESETS.sport.params);
  p.settings.spanwise = spanwise;
  addRoundTip(p, { ...defaultRoundTip(p), ...params });
  return p;
};

describe('rounded-tip run', () => {
  it('applies to an outer run of 2 or more marked sections after a section with a panel inboard, on a pointed tip, without Straight panels; guide curves end before it', () => {
    const p = roundedSport();
    const s = sortedSections(p);
    expect(ROUND_TIP_START_SECTIONS).toBe(2);
    expect(roundTipStart(s, p.settings)).toBe(1);
    expect(roundTipStart(s, { ...p.settings, tip: { mode: 'flat', ratio: 0.005 } })).toBe(-1);
    expect(roundTipStart(s, { ...p.settings, spanwise: 'straight' })).toBe(-1);
    // Guide curves end at the last unmarked section, T; at least at section 1.
    expect(guideEndIndex(s)).toBe(1);
    expect(guideEndIndex(s.slice(0, 2))).toBe(1);
    expect(guideEndIndex([s[0], { ...s[1], roundTip: 'tangent' }, s.at(-1)])).toBe(1);
    // The run has to reach the tip, and a single marked section is no run.
    expect(roundTipStart([...s.slice(0, -1), { ...s.at(-1), roundTip: undefined }], p.settings)).toBe(-1);
    expect(roundTipStart([...s.slice(0, 2), s.at(-1)], p.settings)).toBe(-1);
    expect(roundTipStart([{ ...s[1], roundTip: 'tangent' }, ...s.slice(2)], p.settings)).toBe(-1);
  });
});

describe('span parameter', () => {
  it('follows y inboard, the arc of the tip ellipse in the tip, and joins with equal first and second derivative', () => {
    const { vOf, yOf } = spanParameter(0, 744, 600);
    const s1 = 600 + (144 * Math.PI) / 2;
    expect(vOf(300)).toBeCloseTo(300 / s1, 12);
    expect([vOf(0), vOf(744)]).toEqual([0, 1]);
    // Inverse at 0 to 744 mm, and monotone.
    let prev = -1;
    for (let y = 0; y <= 744; y += 0.5) {
      expect(yOf(vOf(y))).toBeCloseTo(y, 9);
      expect(vOf(y)).toBeGreaterThan(prev);
      prev = vOf(y);
    }
    // dv/dy and d²v/dy² from both sides of y = 600 mm.
    const h = 1e-3;
    const d1 = (y) => (vOf(y + h) - vOf(y - h)) / (2 * h);
    expect(d1(600 + 2 * h)).toBeCloseTo(d1(600 - 2 * h), 7);
    const d2 = (y) => (vOf(y + h) - 2 * vOf(y) + vOf(y - h)) / (h * h);
    expect(Math.abs(d2(600 + 0.01) - d2(600 - 0.01))).toBeLessThan(1e-6);
    // Without a rounded tip v is y-proportional.
    expect(spanParameter(0, 744, null).vOf(372)).toBe(0.5);
  });
});

describe('rounded-tip blend', () => {
  const p = roundedSport('smooth');
  const s = sortedSections(p);
  const ys = s.map((q) => q.y);
  const lists = s.map((q) => [[q.x, q.chord, q.z]]);
  const blend = roundTipBlender(ys, 'smooth', lists, 1, s.map((q) => q.roundTip), [0, 1]);

  it('passes through the sections and equals the inboard blend of sections 0 … T inboard of T', () => {
    s.forEach((q) => {
      const [[x, c, z]] = blend(q.y);
      expect(x).toBeCloseTo(q.x, 9);
      expect(c).toBeCloseTo(q.chord, 9);
      expect(z).toBeCloseTo(q.z, 9);
    });
    const inner = spanwiseBlender(ys.slice(0, 2), 'smooth', lists.slice(0, 2));
    for (const y of [0, 150, 451.3, 600]) expect(blend(y)[0].slice(0, 2)).toEqual(inner(y)[0].slice(0, 2));
  });

  it('leaves the tip section with the slope of the inboard blend (tangent), and keeps z straight along the tip', () => {
    const h = 1e-4;
    const left = (k) => (blend(600)[0][k] - blend(600 - h)[0][k]) / h;
    const right = (k) => (blend(600 + h)[0][k] - blend(600)[0][k]) / h;
    for (const k of [0, 1]) expect(right(k)).toBeCloseTo(left(k), 3);
    expect(blend.derivative(650)[0][2]).toBeCloseTo(Math.tan(1.5 * (Math.PI / 180)), 3);
  });
});

describe('rounded-tip marker in the project', () => {
  it('is set by the dialog, saved as project format version 5, kept on Open, validated, and taken by a section inserted in the tip', () => {
    const p = roundedSport('linear');
    expect(sortedSections(p).map((q) => q.roundTip ?? null)).toEqual([null, null, 'tangent', 'tangent', 'tangent', 'tangent', 'tangent', 'tangent']);
    expect(sortedSections(roundedSport('linear', { tangent: false })).at(-1).roundTip).toBe('corner');
    expect(fileVersion(p.settings, p.sections)).toBe(5);
    expect(fileVersion(p.settings, [])).toBe(3);
    const back = projectFromJsonText(projectToJsonText(p, null));
    expect(back.ok).toBe(true);
    expect(sortedSections(back.project).map((q) => q.roundTip ?? null)).toEqual(sortedSections(p).map((q) => q.roundTip ?? null));
    const bad = structuredClone(p);
    bad.sections[2].roundTip = 'round';
    expect(validateProject(bad).errors).toEqual(['Section 3: roundTip must be "tangent" or "corner".']);
    // Between the tip section and the first rounded-tip section, and between two rounded-tip sections.
    insertSection(p, 1);
    insertSection(p, 4);
    expect(sortedSections(p).map((q) => q.roundTip ?? null)).toEqual([null, null, 'tangent', 'tangent', 'tangent', 'tangent', 'tangent', 'tangent', 'tangent', 'tangent']);
    expect(roundTipStart(sortedSections(p), p.settings)).toBe(1);
    expect(buildWing(p).errors).toEqual([]);
  });
});

describe('fairness of the built rounded tip', () => {
  // A wave: a change of the curvature sign between points curved by more than 1/m, rising more than
  // 0.01 mm (test/fairness.js), on the leading or trailing edge from the tip section to 0.3 mm before
  // the point. Closed trailing edge: the gap limit of a fixed trailing-edge thickness (5 % of the
  // chord) has a corner of its own where it sets in.
  it('shows the bulge of the blend in y, which the blend along the tip ellipse removes', () => {
    const p = roundedSport('smooth');
    p.settings.trailingEdge = { mode: 'closed', thickness: 0 };
    const plain = structuredClone(p);
    for (const q of plain.sections) delete q.roundTip;
    const before = buildWing(plain);
    const after = buildWing(p);
    const bump = edgeInflections(before, 600.5, before.tipY - 0.3);
    expect(bump.te.count).toBeGreaterThan(0);
    const fair = edgeInflections(after, 600.5, after.tipY - 0.3);
    expect([fair.le.count, fair.te.count]).toEqual([0, 0]);
  });

  // 9 presets × 2 interpolations × tangent on and off × 3 straight lines: 108 builds, 7 s without and
  // 15 s with coverage in a cloud container; CI runs slower (the 20 s default timed out a 16 s test).
  it('has no wave on any preset with a flat tip, Linear and Smooth, tangent or not, straight line at 0, 25 and 100 %', { timeout: 120000 }, () => {
    const waves = [];
    for (const [key, preset] of Object.entries(PRESETS)) {
      if (key === 'batwing') continue;
      for (const spanwise of ['linear', 'smooth']) {
        for (const tangent of [true, false]) {
          for (const line of [0, 25, 100]) {
            const p = wizardProject({ ...preset.params, tip: 'flat' });
            p.guides.nose.enabled = false;
            p.guides.end.enabled = false;
            p.settings.spanwise = spanwise;
            p.settings.trailingEdge = { mode: 'closed', thickness: 0 };
            const yT = sortedSections(p).at(-1).y;
            addRoundTip(p, { ...defaultRoundTip(p), tangent, line });
            const b = buildWing(p);
            expect(b.errors, key).toEqual([]);
            const f = edgeInflections(b, yT + 0.5, b.tipY - 0.3);
            if (f.le.count || f.te.count) waves.push(`${key} ${spanwise} ${tangent} ${line}: ${f.le.at} | ${f.te.at}`);
          }
        }
      }
    }
    expect(waves).toEqual([]);
  });
});
