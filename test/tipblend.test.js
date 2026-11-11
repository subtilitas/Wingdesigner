// Rounded-tip blend (src/geom/tipblend.js): when it applies, the span parameter along the tip ellipse,
// the blend through the sections, the inboard blend and the slope at the tip section, the project
// format of the marker, and the fairness of the built tip on the presets.
import { describe, expect, it } from 'vitest';
import { ROUND_TIP_START_SECTIONS, guideEndIndex, roundTipBlender, roundTipStart, spanParameter } from '../src/geom/tipblend.js';
import { spanwiseBlender } from '../src/geom/spanwise.js';
import { addRoundTip, defaultRoundTip } from '../src/model/roundtip.js';
import { PRESETS, wizardProject } from '../src/model/wizard.js';
import { GAP_BLEND, MAX_GAP_FRACTION, buildWing, trailingEdgeGap } from '../src/geom/wing.js';
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
  it('applies to an outer run of 2 or more marked sections after a section with a panel inboard, without Straight panels, with every Wing tip setting; guide curves end before it', () => {
    const p = roundedSport();
    const s = sortedSections(p);
    expect(ROUND_TIP_START_SECTIONS).toBe(2);
    expect(roundTipStart(s, p.settings)).toBe(1);
    // Every Wing tip setting keeps the blend: guide curves end at T whatever the tip.
    expect(roundTipStart(s, { ...p.settings, tip: { mode: 'flat', ratio: 0.005 } })).toBe(1);
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

describe('end of the rounded-tip blend at the point', () => {
  // Sport with the default rounded tip and the straight line at 50 %, Linear: T at y = 600 mm, point
  // at y = 743.95 mm, L = 143.95 mm. The build blends leading-edge x and chord with chord 0 at the
  // point (Wing tip Round).
  const p = roundedSport('linear', { line: 50 });
  const s = sortedSections(p);
  const ys = s.map((q) => q.y);
  const lists = s.map((q, i) => [[q.x, i === s.length - 1 ? 0 : q.chord]]);
  const make = (closed) => roundTipBlender(ys, 'linear', lists, 1, s.map((q) => q.roundTip), [0, 1], null, { closed });
  const yT = ys[1];
  const L = ys.at(-1) - yT;
  /** Leading edge and trailing edge (mm) at the tip angle θ (y = y_T + L sin θ). */
  const edges = (blend, th) => {
    const [[x, c]] = blend(yT + L * Math.sin(th));
    return [x, x + c];
  };
  /**
   * Second derivative in θ of both edges at the point: one-sided differences D(h) at θ = π/2 − h,
   * extrapolated to h = 0 as 2 D(h) − D(2 h) (h = 1e-3 rad).
   */
  const curvature = (blend) => {
    const D = (h) => {
      const [a, b, c] = [Math.PI / 2, Math.PI / 2 - h, Math.PI / 2 - 2 * h].map((th) => edges(blend, th));
      return [0, 1].map((k) => (a[k] - 2 * b[k] + c[k]) / (h * h));
    };
    const [d1, d2] = [D(1e-3), D(2e-3)];
    return [0, 1].map((k) => 2 * d1[k] - d2[k]);
  };
  // Slopes of the last panel (Linear: its secant): leading edge and trailing edge.
  const sLE = (s[1].x - s[0].x) / (s[1].y - s[0].y);
  const sTE = (s[1].x + s[1].chord - s[0].x - s[0].chord) / (s[1].y - s[0].y);

  it('gives both edges the second derivative −σ L in θ at the point when the tip closes, σ the slope of the straight line at 50 %', () => {
    const closed = make(true);
    const [le, te] = curvature(closed);
    // Leading edge 0.04, trailing edge −0.12: σ = 0.04 + 0.5 · (−0.16) = −0.04, −σ L = 5.758 mm.
    expect([sLE, sTE].map((v) => Math.round(v * 1e6) / 1e6)).toEqual([0.04, -0.12]);
    const sigma = sLE + 0.5 * (sTE - sLE);
    expect(-sigma * L).toBeCloseTo(5.758, 6);
    expect(Math.abs(le - te)).toBeLessThan(0.05);
    expect(Math.abs(le + sigma * L)).toBeLessThan(0.05);
    // Both edges end at the point, on the straight line.
    const [x, xt] = edges(closed, Math.PI / 2);
    expect(Math.abs(xt - x)).toBeLessThan(1e-9);
  });

  it('keeps each edge at its own slope with the natural end (Wing tip Pointed), which leaves the closing chord thinner before the point', () => {
    const natural = make(false);
    const [le, te] = curvature(natural);
    // r″ = 0: the second derivative of f_T + s L sin θ, −s L, for each edge: −5.758 and 17.274 mm.
    // The closing chord is 0.08, 0.06 and 0.04 mm thinner 0.8, 1.8 and 2.8 mm before the point.
    expect(Math.abs(le + sLE * L)).toBeLessThan(0.05);
    expect(Math.abs(te + sTE * L)).toBeLessThan(0.05);
    const chord = (blend, y) => blend(y)[0][1];
    for (const d of [0.8, 1.8, 2.8]) expect(chord(natural, ys.at(-1) - d), `${d} mm`).toBeLessThan(chord(make(true), ys.at(-1) - d));
  });
});

describe('rounded-tip marker in the project', () => {
  it('is set by the dialog, saved as project format version 5 (version 6 with Wing tip Round), kept on Open, validated, and taken by a section inserted in the tip', () => {
    const p = roundedSport('linear');
    expect(sortedSections(p).map((q) => q.roundTip ?? null)).toEqual([null, null, 'tangent', 'tangent', 'tangent', 'tangent', 'tangent', 'tangent']);
    expect(sortedSections(roundedSport('linear', { tangent: false })).at(-1).roundTip).toBe('corner');
    // The dialog sets Wing tip Round, which is version 6; the marker alone is version 5.
    expect(fileVersion(p.settings, p.sections)).toBe(6);
    expect(fileVersion({ ...p.settings, tip: { ...p.settings.tip, mode: 'pointed' } }, p.sections)).toBe(5);
    expect(fileVersion({ ...p.settings, tip: { ...p.settings.tip, mode: 'flat' } }, [])).toBe(3);
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
    // Without the marker the tip is an ordinary pointed tip (Wing tip Round needs the marker).
    const plain = structuredClone(p);
    for (const q of plain.sections) delete q.roundTip;
    plain.settings.tip.mode = 'pointed';
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

describe('smooth trailing-edge gap limit', () => {
  it('keeps the fixed thickness down to 1.5 c*, joins the 5 % limit by 0.5 c* with equal value and slope, and stays below both', () => {
    // t = 0.4 mm: c* = t / 0.05 = 8 mm; fixed above 12 mm, 5 % below 4 mm.
    const t = 0.4;
    const cs = t / MAX_GAP_FRACTION;
    expect(GAP_BLEND).toBe(0.5);
    expect(trailingEdgeGap(12, t, true)).toBe(t);
    expect(trailingEdgeGap(30, t, true)).toBe(t);
    expect(trailingEdgeGap(4, t, true)).toBeCloseTo(0.2, 12);
    expect(trailingEdgeGap(2, t, true)).toBeCloseTo(0.1, 12);
    // Hard: the corner at c* = 8 mm.
    expect([trailingEdgeGap(8, t, false), trailingEdgeGap(6, t, false), trailingEdgeGap(10, t, false)]).toEqual([0.4, 0.30000000000000004, 0.4]);
    const h = 1e-6;
    const slope = (c) => (trailingEdgeGap(c + h, t, true) - trailingEdgeGap(c - h, t, true)) / (2 * h);
    for (const c of [0.5 * cs, 1.5 * cs]) {
      expect(Math.abs(trailingEdgeGap(c + 1e-9, t, true) - trailingEdgeGap(c - 1e-9, t, true))).toBeLessThan(1e-9);
      expect(slope(c + 1e-4)).toBeCloseTo(slope(c - 1e-4), 3);
    }
    for (let c = 0.5; c <= 20; c += 0.25) {
      const g = trailingEdgeGap(c, t, true);
      expect(g).toBeLessThanOrEqual(Math.min(t, MAX_GAP_FRACTION * c) + 1e-12);
      expect(g).toBeGreaterThan(0);
    }
    expect(trailingEdgeGap(10, 0, true)).toBe(0);
  });

  // Every preset with the default rounded tip and the Fixed thickness in mm the wizard sets, Linear and
  // Smooth, with the smooth gap limit (the default). The wider sweep is measured once (Geometry,
  // section 10.3).
  it('leaves no wave on the presets with the default rounded tip and a fixed trailing-edge thickness', { timeout: 120000 }, () => {
    const waves = [];
    for (const [key, preset] of Object.entries(PRESETS)) {
      if (key === 'batwing') continue;
      for (const spanwise of ['linear', 'smooth']) {
        const p = wizardProject({ ...preset.params, tip: 'flat' });
        p.guides.nose.enabled = false;
        p.guides.end.enabled = false;
        p.settings.spanwise = spanwise;
        expect(p.settings.trailingEdge.mode, key).toBe('thickness');
        const yT = sortedSections(p).at(-1).y;
        addRoundTip(p, defaultRoundTip(p));
        const b = buildWing(p);
        expect(b.errors, key).toEqual([]);
        const f = edgeInflections(b, yT + 0.5, b.tipY - 0.3);
        if (f.le.count || f.te.count) waves.push(`${key} ${spanwise}: ${f.le.at} | ${f.te.at}`);
      }
    }
    expect(waves).toEqual([]);
  });
});

describe('rounded tip switched to a flat tip', () => {
  it('keeps the outline continuous at the end of the guide curves', () => {
    // Glider with the default rounded tip, last nose-line point moved 20 mm aft, then Wing tip Flat.
    const p = wizardProject(PRESETS.glider.params);
    addRoundTip(p, defaultRoundTip(p));
    p.guides.nose.points.at(-1)[0] += 20;
    p.settings.tip = { ...p.settings.tip, mode: 'flat' };
    const b = buildWing(p);
    expect(b.errors).toEqual([]);
    const [a, c] = [b.planformAt(1000), b.planformAt(1000 + 1e-6)];
    expect(Math.abs(c.xLE - a.xLE)).toBeLessThan(1e-3);
    expect(Math.abs(c.chord - a.chord)).toBeLessThan(1e-3);
  });
});

