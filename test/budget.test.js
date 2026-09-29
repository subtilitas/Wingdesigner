import { describe, expect, it } from 'vitest';
import {
  LAZY_OPTIONS,
  WARN,
  changeCost,
  costSentence,
  displayName,
  exportCost,
  firstBuildSeconds,
  formatMegabytes,
  formatSeconds,
  largeSizes,
  loftGrid,
  projectSize,
  sizeWarning,
} from '../src/model/budget.js';
import { buildWing } from '../src/geom/wing.js';
import { LIMITS } from '../src/model/project.js';
import { PRESETS, wizardProject } from '../src/model/wizard.js';
import { sampleProject } from './helpers.js';

/** The sample wing with n evenly spaced sections. */
function withSections(n) {
  const p = sampleProject();
  const s0 = p.sections[0];
  p.sections = Array.from({ length: n }, (_, i) => ({ ...s0, id: `s${i}`, y: 3 * i }));
  return p;
}

describe('project size warnings', () => {
  it('stays silent below every threshold, also for all wizard presets', () => {
    expect(sizeWarning(sampleProject())).toBeNull();
    for (const pr of Object.values(PRESETS)) {
      const p = wizardProject(pr.params);
      expect(sizeWarning(p)).toBeNull();
      expect(buildWing(p).warnings.filter((w) => w.startsWith('Large project'))).toEqual([]);
    }
    expect(largeSizes(projectSize(withSections(WARN.sections)))).toEqual([]);
  });

  it('names the sizes above their thresholds and the time and memory of a change', () => {
    const p = withSections(1000);
    p.name = 'x'.repeat(WARN.name + 1);
    const size = projectSize(p);
    expect(size).toMatchObject({ sections: 1000, airfoils: 2, gridPoints: 1000 * 121, longestName: WARN.name + 1 });
    expect(largeSizes(size).map((q) => q.key)).toEqual(['sections', 'gridPoints', 'longestName']);
    const w = sizeWarning(p);
    expect(w).toBe(
      `Large project: 1,000 sections (warning above 200), 121,000 loft grid points (warning above 60,000) and a name of 201 characters (warning above 200). ${costSentence(size)}`,
    );
    expect(w).toMatch(/Each change takes about [\d.]+ s and about \d+ MB of browser memory\.$/);
    // The build carries the warning.
    expect(buildWing(p).warnings[0]).toBe(w);
  });

  it('names the time of the first build when many airfoils make it at least 1 s longer than a change', () => {
    // 10,000 airfoils of 99 points used by 20,000 sections: 74 s for the first build in Node.js 24.
    const size = { sections: 20_000, airfoils: 10_000, airfoilPoints: 990_000, usedAirfoils: 10_000, usedAirfoilPoints: 990_000, largestAirfoil: 99, guidePoints: 0, gridPoints: 20_000 * 33, longestName: 10 };
    expect(firstBuildSeconds(size) - changeCost(size).seconds).toBeCloseTo(10_000 * 4.4e-3 + 990_000 * 30e-6, 6);
    const p = withSections(1000);
    const w = sizeWarning(p, size);
    expect(w).toMatch(/Each change takes about 9\.5 s and about 650 MB of browser memory\. Opening it or changing the profile parametrization takes about 83 s\.$/);
    // Few airfoils: no sentence on the first build.
    expect(sizeWarning(p)).not.toMatch(/Opening it/);
  });

  it('adds first-build time only for the airfoils that sections use', () => {
    // 2 sections, 1 used airfoil of 99 points, 3,000 unused ones: the build fits 1 airfoil.
    const p = sampleProject();
    const used = new Set(p.sections.map((s) => s.airfoil));
    const unused = Array.from({ length: 3000 }, (_, i) => ({ ...p.airfoils[0], id: `unused-${i}`, name: `Unused ${i}` }));
    p.airfoils.push(...unused);
    const size = projectSize(p);
    const usedPoints = p.airfoils.filter((a) => used.has(a.id)).reduce((n, a) => n + a.points.length, 0);
    expect(size).toMatchObject({ airfoils: 3000 + used.size, usedAirfoils: used.size, usedAirfoilPoints: usedPoints });
    expect(firstBuildSeconds(size) - changeCost(size).seconds).toBeCloseTo(used.size * 4.4e-3 + usedPoints * 30e-6, 9);
    expect(sizeWarning(p)).toMatch(/^Large project: 3,00\d airfoils \(warning above 200\)/);
    expect(sizeWarning(p)).not.toMatch(/Opening it/);
  });

  it('counts enabled guide curves only, and airfoil points of the largest airfoil and of all', () => {
    const p = sampleProject();
    const pts = Array.from({ length: WARN.guidePoints + 1 }, (_, i) => [200, (600 * i) / WARN.guidePoints]);
    p.guides.end.points = pts;
    expect(projectSize(p).guidePoints).toBe(0);
    p.guides.end.enabled = true;
    expect(projectSize(p).guidePoints).toBe(WARN.guidePoints + 1);
    expect(largeSizes(projectSize(p))[0].text).toBe('a guide curve of 501 points (warning above 500)');
    const size = { ...projectSize(sampleProject()), largestAirfoil: 6000, airfoilPoints: 120_000 };
    expect(largeSizes(size).map((q) => q.text)).toEqual([
      'an airfoil of 6,000 points (warning above 5,000)',
      '120,000 airfoil points in all (warning above 100,000)',
    ]);
  });

  it('estimates grow with every size and stop counting airfoil lists above LAZY_OPTIONS', () => {
    const base = projectSize(sampleProject());
    const c0 = changeCost(base);
    for (const key of ['gridPoints', 'airfoilPoints', 'guidePoints', 'sections']) {
      const c = changeCost({ ...base, [key]: base[key] * 10 + 1000 });
      expect(c.seconds).toBeGreaterThan(c0.seconds);
      expect(c.megabytes).toBeGreaterThan(c0.megabytes);
    }
    // Above LAZY_OPTIONS the lists hold one entry per section.
    const lazy = { ...base, sections: 1000, airfoils: LAZY_OPTIONS };
    expect(changeCost(lazy).seconds).toBeLessThan(changeCost({ ...lazy, airfoils: 20 }).seconds);
    // At the hard section limit with default settings a change takes about half a minute.
    const most = projectSize(withSections(LIMITS.maxSections));
    expect(changeCost(most).seconds).toBeGreaterThan(20);
    expect(changeCost(most).seconds).toBeLessThan(60);
  });

  it('formats seconds and megabytes', () => {
    expect(formatSeconds(0.4)).toBe('under 1 s');
    expect(formatSeconds(3.26)).toBe('about 3.5 s');
    expect(formatSeconds(42.4)).toBe('about 42 s');
    expect(formatMegabytes(0.2)).toBe('about 1 MB');
    expect(formatMegabytes(247)).toBe('about 250 MB');
    expect(formatMegabytes(1240)).toBe('about 1.2 GB');
  });

  it('shortens long names for lists and messages', () => {
    expect(displayName('NACA 2412')).toBe('NACA 2412');
    expect(displayName('x'.repeat(WARN.name))).toBe('x'.repeat(WARN.name));
    expect(displayName('x'.repeat(WARN.name + 5))).toBe(`${'x'.repeat(WARN.name)}…`);
    expect(displayName(undefined)).toBe('');
  });

  it('estimates mesh exports per triangle', () => {
    const stl = exportCost(2_000_000, 'stl');
    expect(stl.fileMB).toBeCloseTo(100, 0);
    expect(exportCost(4_000_000, 'stl').seconds).toBeCloseTo(2 * stl.seconds, 9);
    expect(exportCost(2_000_000, '3mf').seconds).toBeGreaterThan(stl.seconds);
  });

  it('computes the loft grid of a project as the build does', () => {
    for (const settings of [{ spanwise: 'linear' }, { spanwise: 'smooth', panelStations: 12, chordSamples: 40 }]) {
      const p = sampleProject({ settings });
      const b = buildWing(p);
      const g = loftGrid(p.sections.length, b.settings);
      expect((b.stations.length - b.extraStations) * (2 * g.N + 1)).toBe(g.points);
    }
  });
});

describe('STEP export size', () => {
  it('counts the surface control points of the written halves and estimates time, memory and file', async () => {
    const { stepPoints, WARN: W, exportCost: cost } = await import('../src/model/budget.js');
    const { LIMITS: L } = await import('../src/model/project.js');
    const build = { surface: { points: Array.from({ length: 401 }, () => new Array(121)) } };
    expect(stepPoints(build, 'right')).toBe(48_521);
    expect(stepPoints(build, 'halves')).toBe(97_042);
    expect(stepPoints(build, 'merged')).toBe(97_042);
    expect(stepPoints({ surface: null }, 'halves')).toBe(0);
    // 3.3 million points wrote a 330 MB file in 8.4 s in Chromium 141.
    const c = cost(3_300_000, 'step');
    expect(c.fileMB).toBeCloseTo(323, 0);
    expect(c.seconds).toBeCloseTo(8.25, 1);
    expect(W.stepPoints).toBeLessThan(L.maxStepPoints);
  });
});
