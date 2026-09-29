import { describe, expect, it } from 'vitest';
import { OVERSHOOT_LIMIT, buildWing, interpolateAlongV, joinCurves, placeSection, surfaceRowCrossing } from '../src/geom/wing.js';
import { syncGuidesToSpan } from '../src/model/edit.js';
import { curvePoint, dist, interpolateCurve, knotMultiplicities, surfacePoint } from '../src/geom/nurbs.js';
import { solve } from '../src/geom/linalg.js';
import { CROSSING_TOLERANCE, cosineStations, curveCrossing, profileCurve, profileProblem, resampleDeviation, resampleProfile } from '../src/geom/profile.js';
import { blendPoints, blendScalar, spanwiseBlender, spanwiseWeights } from '../src/geom/spanwise.js';
import { clampedUniformKnots, defaultGuides, guideCurve, guideProblems, guideXAt, isMonotonicInY, sampleGuide } from '../src/geom/guide.js';
import { edgeCheck, exportMeshes, fullWingMesh, halfWingMesh, meshArea, meshBounds, meshVolume, tessellateHalf } from '../src/geom/mesh.js';
import { earClip, polygonArea } from '../src/geom/triangulate.js';
import { nacaAirfoil } from '../src/airfoil/naca.js';
import { defaultProject } from '../src/model/defaults.js';
import { checkAirfoil } from '../src/airfoil/sanity.js';
import { LIMITS, createProject, validateProject } from '../src/model/project.js';
import { loftGrid } from '../src/model/budget.js';
import { naca, sampleProject } from './helpers.js';

describe('profile curves', () => {
  const pts = nacaAirfoil('2412', { pointsPerSide: 61 }).points;
  const prof = profileCurve(pts);

  it('interpolates every data point', () => {
    prof.curve.params.forEach((t, k) => expect(dist(curvePoint(prof.curve, t), pts[k])).toBeLessThan(1e-10));
  });

  it('finds the leading edge as the minimum-x point of the curve', () => {
    const le = curvePoint(prof.curve, prof.tLE);
    for (let i = 0; i <= 2000; i++) expect(curvePoint(prof.curve, i / 2000)[0]).toBeGreaterThanOrEqual(le[0] - 1e-12);
  });

  it('resamples at common chord stations', () => {
    const st = cosineStations(40);
    const r = resampleProfile(prof, st);
    expect(r.length).toBe(81);
    expect(r[40]).toEqual(curvePoint(prof.curve, prof.tLE));
    expect(r[0]).toEqual(curvePoint(prof.curve, 0));
    expect(r[80]).toEqual(curvePoint(prof.curve, 1));
    for (let k = 1; k < 40; k++) {
      expect(r[40 - k][0]).toBeCloseTo(r[40][0] + st[k] * (r[0][0] - r[40][0]), 10);
      expect(r[40 + k][0]).toBeCloseTo(r[40][0] + st[k] * (r[80][0] - r[40][0]), 10);
      expect(r[40 - k][1]).toBeGreaterThan(r[40 + k][1]);
    }
    expect(resampleDeviation(prof, r)).toBeLessThan(5e-4);
  });
});

describe('spanwise interpolation', () => {
  it('uses hat functions in linear mode', () => {
    const w = spanwiseWeights([0, 100, 300], 'linear');
    expect(w(-5)).toEqual([1, 0, 0]);
    expect(w(50)).toEqual([0.5, 0.5, 0]);
    expect(w(200)).toEqual([0, 0.5, 0.5]);
    expect(w(400)).toEqual([0, 0, 1]);
    expect(spanwiseWeights([5])(3)).toEqual([1]);
  });

  it('blends point lists from the neighbouring sections as the weighted sum does', () => {
    // Uneven spacing (0.1 mm next to 100 mm gaps) and values outside the section range.
    const ys = [0, 0.1, 100, 101, 250, 400, 400.5, 800];
    const lists = ys.map((y, i) => [[Math.sin(i), Math.cos(3 * i)], [i * i, -i], [0.01 * y, 1]]);
    for (const mode of ['smooth', 'linear']) {
      const w = spanwiseWeights(ys, mode);
      const blend = spanwiseBlender(ys, mode, lists);
      for (const y of [-20, 0, 0.05, 50, 100.5, 333, 400.2, 799, 900]) {
        const a = blendPoints(w(y), lists);
        const b2 = blend(y);
        for (let k = 0; k < a.length; k++) for (let c = 0; c < 2; c++) expect(b2[k][c]).toBeCloseTo(a[k][c], 9);
      }
    }
  });

  it('reproduces section values and sums to one in smooth mode', () => {
    const ys = [0, 100, 250, 400];
    const w = spanwiseWeights(ys, 'smooth');
    ys.forEach((y, i) => w(y).forEach((v, k) => expect(v).toBeCloseTo(i === k ? 1 : 0, 12)));
    for (const y of [10, 120, 399]) expect(w(y).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
    // Natural cubic spline reproduces linear data exactly.
    expect(blendScalar(w(177), ys.map((y) => 3 * y + 1))).toBeCloseTo(3 * 177 + 1, 9);
    expect(w(-10)).toEqual(w(0));
  });

  it('matches a dense natural-spline solve and handles 400 sections interactively', () => {
    // Reference: natural cubic spline through the values e_i, second derivatives from a dense solve.
    const dense = (xs, vals, y) => {
      const n = xs.length;
      const h = xs.slice(1).map((x, i) => x - xs[i]);
      const A = Array.from({ length: n - 2 }, () => new Array(n - 2).fill(0));
      const b = [];
      for (let r = 0; r < n - 2; r++) {
        A[r][r] = (h[r] + h[r + 1]) / 3;
        if (r > 0) A[r][r - 1] = h[r] / 6;
        if (r < n - 3) A[r][r + 1] = h[r + 1] / 6;
        b.push((vals[r + 2] - vals[r + 1]) / h[r + 1] - (vals[r + 1] - vals[r]) / h[r]);
      }
      const M = [0, ...solve(A, b), 0];
      let j = 0;
      while (j < n - 2 && y > xs[j + 1]) j++;
      const a = (xs[j + 1] - y) / h[j];
      const c = (y - xs[j]) / h[j];
      return a * vals[j] + c * vals[j + 1] + (((a ** 3 - a) * M[j] + (c ** 3 - c) * M[j + 1]) * h[j] * h[j]) / 6;
    };
    let seed = 3;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let t = 0; t < 20; t++) {
      const xs = [0];
      for (let i = 1; i < 3 + Math.floor(rnd() * 12); i++) xs.push(xs[i - 1] + 0.5 + rnd() * 200);
      const vals = xs.map(() => rnd() * 100);
      const w = spanwiseWeights(xs, 'smooth');
      for (let k = 0; k < 10; k++) {
        const y = rnd() * xs[xs.length - 1];
        expect(blendScalar(w(y), vals)).toBeCloseTo(dense(xs, vals, y), 8);
      }
    }
    const ys = Array.from({ length: 400 }, (_, i) => i * 5 + (i % 3));
    const t0 = performance.now();
    const w = spanwiseWeights(ys, 'smooth');
    for (let k = 0; k < 500; k++) w(k * 3.9);
    expect(performance.now() - t0).toBeLessThan(2000);
  });

  it('blends point lists', () => {
    expect(blendPoints([0.25, 0.75], [[[0, 0]], [[4, 8]]])).toEqual([[3, 6]]);
  });
});

describe('guide curves', () => {
  it('validates definitions', () => {
    expect(guideProblems(null).length).toBe(1);
    expect(guideProblems({ points: [[0, 0]] }).length).toBe(1);
    expect(guideProblems({ points: [[0, 0], [NaN, 1]] }).length).toBe(1);
    expect(guideProblems({ points: [[0, 0], [1, 0]] }).length).toBe(1);
    expect(guideProblems({ points: [[0, 0], [1, 5]] })).toEqual([]);
  });

  it('evaluates x at span positions for fit and control modes', () => {
    const fit = guideCurve({ mode: 'fit', points: [[0, 0], [10, 100], [40, 200], [90, 300]] });
    expect(guideXAt(fit, 100, 0, 300)).toBeCloseTo(10, 8);
    expect(guideXAt(fit, 300, 0, 300)).toBeCloseTo(90, 8);
    // Stretched onto a wider span.
    expect(guideXAt(fit, 200, 0, 600)).toBeCloseTo(10, 8);
    const ctrl = guideCurve({ mode: 'control', degree: 2, points: [[0, 0], [0, 100], [50, 200]] });
    expect(ctrl.knots).toEqual([0, 0, 0, 1, 1, 1]);
    expect(guideXAt(ctrl, 0, 0, 200)).toBeCloseTo(0, 10);
    expect(guideXAt(ctrl, 200, 0, 200)).toBeCloseTo(50, 8);
    expect(isMonotonicInY(ctrl)).toBe(true);
    expect(clampedUniformKnots(5, 3)).toEqual({ knots: [0, 0, 0, 0, 0.5, 1, 1, 1, 1], degree: 3 });
    expect(guideXAt(ctrl, 50, 0, 0)).toBeCloseTo(0, 10);
  });

  it('detects curves that double back', () => {
    const c = { degree: 2, knots: [0, 0, 0, 1, 1, 1], points: [[0, 0], [10, 300], [20, 100]] };
    expect(isMonotonicInY(c)).toBe(false);
  });

  it('defaults to section edges', () => {
    const g = defaultGuides([
      { x: 5, y: 100, chord: 50 },
      { x: 0, y: 0, chord: 80 },
    ]);
    expect(g.nose.points).toEqual([[0, 0], [5, 100]]);
    expect(g.end.points).toEqual([[80, 0], [55, 100]]);
    expect(g.nose.enabled).toBe(false);
  });
});

describe('wing surface', () => {
  it('passes through every section profile exactly (linear, degree 1 in v)', () => {
    const p = sampleProject();
    const b = buildWing(p);
    expect(b.errors).toEqual([]);
    expect(b.surface.degreeV).toBe(1);
    expect(b.stations.length).toBe(3);
    b.stations.forEach((st) => {
      st.points.forEach((P, j) => expect(dist(surfacePoint(b.surface, b.paramsU[j], st.v), P)).toBeLessThan(1e-9));
    });
    // Leading edge of the root section sits at the section origin.
    const le = surfacePoint(b.surface, b.uLE, 0);
    expect(le[0]).toBeCloseTo(0, 6);
    expect(le[1]).toBeCloseTo(0, 9);
    expect(le[2]).toBeCloseTo(0, 6);
    // Tip twist of -3 degrees (nose down) about the quarter chord raises the trailing edge.
    const teTip = surfacePoint(b.surface, 0, 1);
    expect(teTip[0]).toBeCloseTo(60 + 0.25 * 110 + 0.75 * 110 * Math.cos((3 * Math.PI) / 180), 1);
    expect(teTip[2]).toBeGreaterThan(30);
  });

  it('places sections with twist about the pivot', () => {
    const [p] = placeSection([[0.25, 0]], { xLE: 10, y: 5, z: 2, chord: 100, twist: 30 }, 0.25);
    expect(p).toEqual([35, 5, 2]);
    const [le] = placeSection([[0, 0]], { xLE: 0, y: 0, z: 0, chord: 100, twist: 10 }, 0.25);
    expect(le[2]).toBeGreaterThan(0);
  });

  it('builds smooth and guided variants with cubic spanwise degree', () => {
    const smooth = buildWing(sampleProject({ settings: { spanwise: 'smooth', panelStations: 4 } }));
    expect(smooth.errors).toEqual([]);
    expect(smooth.surface.degreeV).toBe(3);
    expect(smooth.stations.length).toBe(9);

    const p = sampleProject();
    p.guides.nose.enabled = true;
    p.guides.end.enabled = true;
    p.guides.end.points = [[200, 0], [195, 300], [150, 550], [140, 600]];
    const g = buildWing(p);
    expect(g.errors).toEqual([]);
    expect(g.surface.degreeV).toBe(3);
    // C0 joins at the sections: interior knots at the section span fractions have multiplicity 3.
    expect(g.surface.knotsV.filter((t) => Math.abs(t - 0.5) < 1e-12).length).toBe(3);
    const tipTE = g.stations[g.stations.length - 1];
    expect(tipTE.xLE + tipTE.chord).toBeCloseTo(140, 6);
    // Sections on guides: surface passes through all stations.
    g.stations.forEach((st) => {
      st.points.forEach((P, j) => expect(dist(surfacePoint(g.surface, g.paramsU[j], st.v), P)).toBeLessThan(1e-8));
    });
  });

  it('supports a single guide', () => {
    const p = sampleProject();
    p.guides.nose.enabled = true;
    p.guides.nose.points = [[0, 0], [0, 300], [80, 600]];
    const b = buildWing(p);
    expect(b.errors).toEqual([]);
    const tip = b.stations[b.stations.length - 1];
    expect(tip.xLE).toBeCloseTo(80, 6);
    expect(tip.chord).toBeCloseTo(110, 9);
    const q = sampleProject();
    q.guides.end.enabled = true;
    const c = buildWing(q);
    const tip2 = c.stations[c.stations.length - 1];
    expect(tip2.xLE + tip2.chord).toBeCloseTo(170, 6);
  });

  it('reports invalid input', () => {
    const one = sampleProject();
    one.sections = one.sections.slice(0, 1);
    expect(buildWing(one).errors.length).toBe(1);
    const dup = sampleProject();
    dup.sections[1].y = 0;
    expect(buildWing(dup).errors[0]).toMatch(/share span position/);
    const unknown = sampleProject();
    unknown.sections[0].airfoil = 'nope';
    expect(buildWing(unknown).errors[0]).toMatch(/unknown airfoil/);
    const bad = sampleProject();
    bad.airfoils[0].points = bad.airfoils[0].points.slice(0, 3);
    expect(buildWing(bad).errors[0]).toMatch(/At least 5 points/);
    const crossing = sampleProject();
    crossing.guides.nose.enabled = true;
    crossing.guides.end.enabled = true;
    crossing.guides.end.points = [[200, 0], [100, 300], [60, 600]];
    expect(buildWing(crossing).errors[0]).toMatch(/Chord drops/);
    const back = sampleProject();
    back.guides.nose.enabled = true;
    back.guides.nose.points = [[0, 0], [0, 300], [0, 200]];
    expect(buildWing(back).errors[0]).toMatch(/Nose line/);
    // Through-point guides are parametrized by span, so a zig-zag in x cannot double back in y.
    const wiggle = sampleProject();
    wiggle.guides.end.enabled = true;
    wiggle.guides.end.points = [[200, 0], [500, 1], [200, 2], [170, 600]];
    const w = buildWing(wiggle);
    expect(w.errors.some((e) => /doubles back/.test(e))).toBe(false);
  });

  it('handles trailing-edge modes', () => {
    const closed = buildWing(sampleProject({ settings: { trailingEdge: { mode: 'closed' } } }));
    expect(closed.closedTE).toBe(true);
    expect(dist(surfacePoint(closed.surface, 0, 0.3), surfacePoint(closed.surface, 1, 0.3))).toBeLessThan(1e-9);
    const thick = buildWing(sampleProject({ settings: { trailingEdge: { mode: 'thickness', thickness: 0.8 } } }));
    expect(thick.closedTE).toBe(false);
    thick.stations.forEach((st) => expect((st.shape[0][1] - st.shape[st.shape.length - 1][1]) * st.chord).toBeCloseTo(0.8, 9));
    const huge = buildWing(sampleProject({ settings: { trailingEdge: { mode: 'thickness', thickness: 8 } } }));
    expect(huge.warnings[0]).toMatch(/exceeds 5 %/);
    // Mixed closed/open airfoils in "asis" mode open the closed ones to the minimum gap.
    const mixed = sampleProject();
    mixed.airfoils[1] = naca('0010', 'tip', { closedTE: true });
    const m = buildWing(mixed);
    expect(m.closedTE).toBe(false);
    expect(m.warnings[0]).toMatch(/opened/);
  });

  it('joins clamped curves with C0 knots', () => {
    const a = interpolateCurve([[0, 0], [1, 1], [2, 0], [3, 1]], 3);
    const b = interpolateCurve([[3, 1], [4, 0], [5, 2], [6, 0]], 3);
    const j = joinCurves([
      { ...a, knots: a.knots.map((t) => t * 0.5) },
      { ...b, knots: b.knots.map((t) => 0.5 + 0.5 * t) },
    ]);
    expect(j.points.length).toBe(7);
    expect(j.knots.length).toBe(11);
    expect(dist(curvePoint(j, 0.5), [3, 1])).toBeLessThan(1e-12);
    expect(dist(curvePoint(j, 0.25), curvePoint(a, 0.5))).toBeLessThan(1e-12);
  });
});

describe('mesh', () => {
  it('triangulates polygons with consistent orientation', () => {
    const sq = [[0, 0], [1, 0], [1, 1], [0, 1]];
    const t = earClip(sq);
    expect(t.length).toBe(2);
    const area = t.reduce((s, [a, b, c]) => s + polygonArea([sq[a], sq[b], sq[c]]), 0);
    expect(area).toBeCloseTo(1, 12);
    const cw = sq.slice().reverse();
    for (const [a, b, c] of earClip(cw)) expect(polygonArea([cw[a], cw[b], cw[c]])).toBeLessThan(0);
    expect(earClip([[0, 0], [1, 1]])).toEqual([]);
    const withCollinear = [[0, 0], [0.5, 0], [1, 0], [1, 1], [0, 1]];
    const tc = earClip(withCollinear);
    expect(tc.length).toBe(3);
    const airfoil = nacaAirfoil('2412').points;
    const ta = earClip(airfoil);
    expect(ta.length).toBe(airfoil.length - 2);
    const sum = ta.reduce((s, [a, b, c]) => s + polygonArea([airfoil[a], airfoil[b], airfoil[c]]), 0);
    expect(sum).toBeCloseTo(polygonArea(airfoil), 10);
  });

  for (const te of ['asis', 'closed', 'thickness']) {
    it(`produces closed outward meshes (${te} trailing edge)`, () => {
      const b = buildWing(sampleProject({ settings: { trailingEdge: { mode: te, thickness: 0.5 }, spanwise: 'smooth' } }));
      const half = tessellateHalf(b);
      const hm = halfWingMesh(half);
      expect(edgeCheck(hm)).toMatchObject({ closed: true });
      const vHalf = meshVolume(hm);
      expect(vHalf).toBeGreaterThan(0);
      const full = fullWingMesh(half, b.rootY);
      expect(full.shells).toBe(1);
      expect(edgeCheck(full)).toMatchObject({ closed: true });
      expect(meshVolume(full)).toBeCloseTo(2 * vHalf, 3);
      const bb = meshBounds(full);
      expect(bb.min[1]).toBeCloseTo(-600, 6);
      expect(bb.max[1]).toBeCloseTo(600, 6);
      expect(meshArea(full)).toBeGreaterThan(2 * 2 * 600 * 110);
    });
  }

  it('approximates the analytic volume of a rectangular wing', () => {
    const p = sampleProject();
    p.sections = [
      { id: 'a', airfoil: 'tip', x: 0, y: 0, z: 0, chord: 100, twist: 0 },
      { id: 'b', airfoil: 'tip', x: 0, y: 500, z: 0, chord: 100, twist: 0 },
    ];
    const b = buildWing(p);
    const hm = halfWingMesh(tessellateHalf(b, { uRefine: 2 }));
    // Reference: polygon area of a finely sampled NACA 0010 times the span.
    const area = Math.abs(polygonArea(nacaAirfoil('0010', { pointsPerSide: 401 }).points)) * 100 * 100;
    expect(Math.abs(meshVolume(hm) / (area * 500) - 1)).toBeLessThan(2e-4);
  });

  it('keeps separate shells when the root is off the symmetry plane', () => {
    const p = sampleProject();
    p.sections.forEach((s) => (s.y += 40));
    const b = buildWing(p);
    const half = tessellateHalf(b);
    const full = fullWingMesh(half, b.rootY);
    expect(full.shells).toBe(2);
    expect(edgeCheck(full).closed).toBe(true);
    expect(meshVolume(full)).toBeCloseTo(2 * meshVolume(halfWingMesh(half)), 3);
  });
});

describe('strip triangulation', () => {
  it('matches the polygon area for open and closed outlines and falls back when invalid', async () => {
    const { stripTriangulate } = await import('../src/geom/triangulate.js');
    const open = nacaAirfoil('2412', { pointsPerSide: 41 }).points; // LE at index 40
    const t = stripTriangulate(open, 40);
    expect(t.length).toBe(open.length - 2);
    const sum = t.reduce((s, [a, b, c]) => s + polygonArea([open[a], open[b], open[c]]), 0);
    expect(sum).toBeCloseTo(polygonArea(open), 12);
    const closed = nacaAirfoil('0012', { pointsPerSide: 41, closedTE: true }).points.slice(0, -1);
    const tc = stripTriangulate(closed, 40);
    expect(tc.length).toBe(closed.length - 2);
    for (const [a, b, c] of tc) expect(polygonArea([closed[a], closed[b], closed[c]])).toBeGreaterThan(0);
    // A leading-edge index that does not match the point count falls back to ear clipping.
    const fb = stripTriangulate(open, 10);
    expect(fb.reduce((s, [a, b, c]) => s + polygonArea([open[a], open[b], open[c]]), 0)).toBeCloseTo(polygonArea(open), 10);
    expect(stripTriangulate([[0, 0], [1, 0], [1, 1], [0, 1]], 0).length).toBe(2);
  });

  it('keeps meshes closed with refined sampling', () => {
    const b = buildWing(sampleProject({ settings: { trailingEdge: { mode: 'closed' } } }));
    const hm = halfWingMesh(tessellateHalf(b, { uRefine: 2, vRefine: 2 }));
    expect(edgeCheck(hm).closed).toBe(true);
    expect(meshVolume(hm)).toBeGreaterThan(0);
  });
});

describe('guide crossing between stations', () => {
  it('reports a crossing narrower than the station spacing', () => {
    const p = sampleProject();
    p.guides.end.enabled = true;
    p.guides.end.mode = 'control';
    p.guides.end.degree = 1;
    p.guides.end.points = [[200, 0], [195, 300], [200, 329], [-10, 330], [200, 331], [170, 600]];
    p.guides.nose.enabled = true;
    const b = buildWing(p);
    expect(b.errors[0]).toMatch(/Chord drops to -\d+\.\d+ mm at y = 330\.0 mm/);
  });

  it('warns when guide detail is finer than the station spacing', () => {
    const p = sampleProject();
    p.guides.end.enabled = true;
    p.guides.end.mode = 'control';
    p.guides.end.degree = 1;
    p.guides.end.points = [[200, 0], [195, 300], [200, 329], [-10, 330], [200, 331], [170, 600]];
    const b = buildWing(p);
    expect(b.errors).toEqual([]);
    expect(b.warnings.some((w) => /deviates up to \d+\.\d+ mm/.test(w))).toBe(true);
  });

  it('accepts guides that stay apart', () => {
    const p = sampleProject();
    p.guides.end.enabled = true;
    p.guides.end.mode = 'control';
    p.guides.end.degree = 1;
    p.guides.end.points = [[200, 0], [195, 300], [180, 330], [170, 600]];
    expect(buildWing(p).errors).toEqual([]);
  });
});

describe('pointed wing tip', () => {
  const pointedProject = (settings = {}) => {
    const p = sampleProject({ settings: { tip: { mode: 'pointed', ratio: 0.01 }, ...settings } });
    return p;
  };

  it('scales the tip profile to the ratio of the previous section chord', () => {
    const b = buildWing(pointedProject());
    expect(b.errors).toEqual([]);
    const tip = b.stations[b.stations.length - 1];
    expect(tip.chord).toBeCloseTo(0.01 * 170, 12);
    expect(b.tipChord).toBeCloseTo(1.7, 12);
    expect(b.tipChordLimited).toBe(false);
    // Leading edge stays at the tip section position; the tip is a scaled copy of the profile.
    expect(tip.xLE).toBeCloseTo(60, 9);
    const half = halfWingMesh(tessellateHalf(b));
    expect(edgeCheck(half).closed).toBe(true);
    expect(meshVolume(half)).toBeGreaterThan(0);
    // The trailing-edge gap scales with the chord near the tip (at most 5 % of the chord).
    for (const st of b.stations) expect(st.shape[0][1] - st.shape[st.shape.length - 1][1]).toBeLessThanOrEqual(0.05 + 1e-12);
  });

  it('keeps the tip chord at the 1 mm minimum', () => {
    const b = buildWing(pointedProject({ tip: { mode: 'pointed', ratio: 0.002 } }));
    expect(b.errors).toEqual([]);
    expect(0.002 * 170).toBeLessThan(1);
    expect(b.tipChord).toBe(1);
    expect(b.tipChordLimited).toBe(true);
    expect(b.stations[b.stations.length - 1].chord).toBeCloseTo(1, 12);
  });

  it('accepts guide curves that meet at the tip', () => {
    const p = pointedProject();
    p.guides.nose.enabled = true;
    p.guides.end.enabled = true;
    p.guides.nose.points = [[0, 0], [20, 300], [120, 600]];
    p.guides.end.points = [[200, 0], [190, 300], [120, 600]];
    const b = buildWing(p);
    expect(b.errors).toEqual([]);
    const tip = b.stations[b.stations.length - 1];
    expect(tip.chord).toBeCloseTo(b.tipChord, 12);
    expect(tip.xLE).toBeCloseTo(120, 6);
    expect(edgeCheck(halfWingMesh(tessellateHalf(b))).closed).toBe(true);
    // The same guides without pointed mode are rejected with a hint.
    p.settings.tip.mode = 'flat';
    expect(buildWing(p).errors[0]).toMatch(/Pointed/);
  });

  it('warns when guides do not meet at a pointed tip and reports the actual tip chord', () => {
    const p = pointedProject();
    p.guides.nose.enabled = true;
    p.guides.end.enabled = true;
    expect(buildWing(p).warnings.some((w) => /end [\d.]+ mm apart/.test(w))).toBe(true);
    // Guide ends 5 mm apart against a scaled tip chord of 1.7 mm.
    p.guides.nose.points = [[0, 0], [20, 300], [118, 600]];
    p.guides.end.points = [[200, 0], [190, 300], [123, 600]];
    const b = buildWing(p);
    expect(b.errors).toEqual([]);
    expect(b.tipChord).toBeCloseTo(5, 9);
    expect(b.stations[b.stations.length - 1].chord).toBeCloseTo(5, 9);
    expect(b.warnings.some((w) => /tip chord is 5\.0 mm instead of 1\.70 mm/.test(w))).toBe(true);
    // Ends within 0.5 mm of the scaled tip chord: no warning.
    p.guides.end.points = [[200, 0], [190, 300], [119.9, 600]];
    expect(buildWing(p).warnings.some((w) => /Pointed tip/.test(w))).toBe(false);
  });

  it('keeps crossings an error in pointed mode', () => {
    const p = pointedProject();
    p.guides.nose.enabled = true;
    p.guides.end.enabled = true;
    p.guides.nose.points = [[0, 0], [20, 300], [130, 600]];
    p.guides.end.points = [[200, 0], [190, 300], [120, 600]];
    expect(buildWing(p).errors[0]).toMatch(/Chord drops/);
  });

  it('works with only the end line and in smooth mode', () => {
    const p = pointedProject({ spanwise: 'smooth' });
    p.guides.end.enabled = true;
    const b = buildWing(p);
    expect(b.errors).toEqual([]);
    const tip = b.stations[b.stations.length - 1];
    expect(tip.xLE + tip.chord).toBeCloseTo(170, 6);
  });
});

describe('builder robustness', () => {
  it('builds with an airfoil that repeats a point (project JSON source)', () => {
    const p = sampleProject();
    p.airfoils[0].points.splice(30, 0, p.airfoils[0].points[30].slice());
    const b = buildWing(p);
    expect(b.errors).toEqual([]);
    expect(b.surface).not.toBeNull();
  });

  it('reports negative thickness from smooth overshoot', () => {
    const p = sampleProject({ settings: { spanwise: 'smooth' } });
    p.airfoils = [naca('0024', 'thick'), naca('0006', 'thin')];
    p.sections = [
      { id: 'a', airfoil: 'thick', x: 0, y: 0, z: 0, chord: 200, twist: 0 },
      { id: 'b', airfoil: 'thin', x: 0, y: 60, z: 0, chord: 200, twist: 0 },
      { id: 'c', airfoil: 'thick', x: 0, y: 600, z: 0, chord: 200, twist: 0 },
    ];
    expect(buildWing(p).errors[0]).toMatch(/negative thickness/);
    p.settings.spanwise = 'linear';
    expect(buildWing(p).errors).toEqual([]);
  });
});

describe('trailing-edge setting and span range', () => {
  // Symmetric blunt airfoil, 3 % chord trailing-edge gap, thinner inside than the gap would allow
  // for a linear taper: t(x) = 0.1 sqrt(x) (1 - x)^3 + 0.03 x^4.
  const xs = Array.from({ length: 61 }, (_, i) => (1 - Math.cos((Math.PI * i) / 60)) / 2);
  const t = (x) => 0.1 * Math.sqrt(x) * (1 - x) ** 3 + 0.03 * x ** 4;
  const waisted = [...xs.slice().reverse().map((x) => [x, t(x) / 2]), ...xs.slice(1).map((x) => [x, -t(x) / 2])];
  const project = (mode) => {
    const p = sampleProject({ settings: { trailingEdge: { mode, thickness: 0.3 } } });
    p.airfoils = [{ id: 'w', name: 'waisted', points: waisted }];
    for (const s of p.sections) s.airfoil = 'w';
    return p;
  };

  it('reports surfaces pulled through each other by the closed or thickness mode', () => {
    expect(buildWing(project('asis')).errors).toEqual([]);
    for (const mode of ['closed', 'thickness']) {
      const b = buildWing(project(mode));
      expect(b.errors[0]).toMatch(/trailing-edge setting pulls the upper surface below the lower surface at y = 0\.0 mm/);
      expect(b.surface).toBeNull();
    }
  });

  it('reports surfaces made to touch by the closed mode', () => {
    // Thickness 0.03 x + 0.1 sqrt(x) (1 - x) (x - 0.5)^2: closing the 3 % gap leaves zero at 50 %.
    const t2 = (x) => 0.03 * x + 0.1 * Math.sqrt(x) * (1 - x) * (x - 0.5) ** 2;
    const pts = [...xs.slice().reverse().map((x) => [x, t2(x) / 2]), ...xs.slice(1).map((x) => [x, -t2(x) / 2])];
    const p = project('closed');
    p.airfoils = [{ id: 'w', name: 'touch', points: pts }];
    expect(buildWing(p).errors[0]).toMatch(/trailing-edge setting makes upper and lower surface touch at y = 0\.0 mm, x = 50\.0 % chord/);
    p.settings.trailingEdge = { mode: 'asis', thickness: 0.3 };
    expect(buildWing(p).errors).toEqual([]);
  });

  it('rejects a section on the mirrored side of y = 0', () => {
    const p = sampleProject();
    p.sections[0].y = -5;
    expect(buildWing(p).errors[0]).toMatch(/y = -5 mm lies on the mirrored side/);
  });
});

describe('fitted surface between stations', () => {
  it('adds stations where strong twist would shrink linear rows', () => {
    // 180 degrees of twist about mid-chord: averaging the end rows would collapse midspan to the pivot.
    const p = sampleProject({ settings: { twistPivot: 0.5 } });
    p.airfoils = [naca('2412', 'a')];
    p.sections = [
      { id: 'a', airfoil: 'a', x: 0, y: 0, z: 0, chord: 2, twist: 0 },
      { id: 'b', airfoil: 'a', x: 0, y: 2, z: 0, chord: 2, twist: 180 },
    ];
    const b = buildWing(p);
    expect(b.errors).toEqual([]);
    expect(b.extraStations).toBeGreaterThan(0);
    const mid = surfacePoint(b.surface, b.uLE, 0.5);
    const te = surfacePoint(b.surface, 0, 0.5);
    expect(Math.hypot(te[0] - mid[0], te[2] - mid[2])).toBeGreaterThan(1.9);
  });

  it('keeps the fitted chord of 1 mm sections with 100 degrees of twist', () => {
    const p = sampleProject();
    p.airfoils = [naca('2412', 'a')];
    p.sections = [
      { id: 'a', airfoil: 'a', x: 0, y: 0, z: 0, chord: 1, twist: 0 },
      { id: 'b', airfoil: 'a', x: 0, y: 10, z: 0, chord: 1, twist: 100 },
    ];
    const b = buildWing(p);
    expect(b.errors).toEqual([]);
    const le = surfacePoint(b.surface, b.uLE, 0.5);
    const te = surfacePoint(b.surface, 0, 0.5);
    expect(Math.hypot(te[0] - le[0], te[2] - le[2])).toBeGreaterThan(0.95);
  });

  it('reports a surface that folds between stations', () => {
    // Zigzag degree-5 control guides that 32 added stations cannot follow. The guides are drawn for
    // 40 trials from one seeded sequence; trial 37 folds (trials 2, 7, 14, ... turn inside out).
    let seed = 9;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    let guides = null;
    for (let t = 0; t <= 37; t++) {
      const n = 20 + Math.floor(rnd() * 70);
      const ys = Array.from({ length: n }, (_, i) => (600 * i) / (n - 1));
      const nose = ys.map((y, i) => [(i % 2 ? 60 : 0) * rnd() + 20 * rnd(), y]);
      const end = ys.map((y, i) => [nose[i][0] + 1 + 100 * rnd() * rnd(), y]);
      guides = { nose: { enabled: true, mode: 'control', degree: 5, points: nose }, end: { enabled: true, mode: 'control', degree: 5, points: end } };
    }
    const p = sampleProject();
    p.guides = guides;
    const fold = buildWing(p);
    expect(fold.errors[0]).toMatch(/folds or narrows between stations at y = [\d.]+ mm \(chord -?\d+\.\d\d mm along the intended chord direction, minimum 1 mm/);
    expect(fold.surface).toBeNull();
  });
});

describe('fitted curve and surface row crossings', () => {
  // Nine points that pass the point checks; the cubic curve through them loops past the trailing edge.
  const coarse = [[1, 0.002], [0.9422, 0.0062], [0.4103, 0.1048], [0.3764, 0.0957], [0, 0], [0.2163, -0.0488], [0.4749, -0.0296], [0.9349, -0.0728], [1, -0.002]];

  it('rejects an airfoil whose NURBS curve crosses itself', () => {
    expect(checkAirfoil(coarse).ok).toBe(true);
    const { curve } = profileCurve(checkAirfoil(coarse).points);
    const cross = curveCrossing(curve, { tolerance: CROSSING_TOLERANCE });
    expect(cross.size).toBeGreaterThan(4 * CROSSING_TOLERANCE);
    expect(curveCrossing(curve, { tolerance: 1 })).toBeNull();
    const p = sampleProject();
    p.airfoils = [{ id: 'c', name: 'coarse', points: coarse }];
    for (const s of p.sections) s.airfoil = 'c';
    const b = buildWing(p);
    expect(b.errors[0]).toMatch(/NURBS curve through the points crosses itself near x = 10\d\.\d % chord/);
    expect(b.surface).toBeNull();
  });

  it('samples the coarse spans of a dense file', () => {
    // The looping coarse outline with one straight segment split into 4500 more points.
    const [a, b] = [coarse[2], coarse[3]];
    const extra = Array.from({ length: 4500 }, (_, i) => [a[0] + ((i + 1) / 4501) * (b[0] - a[0]), a[1] + ((i + 1) / 4501) * (b[1] - a[1])]);
    const dense = [...coarse.slice(0, 3), ...extra, ...coarse.slice(3)];
    const prof = profileCurve(checkAirfoil(dense).points);
    expect(curveCrossing(prof.curve, { samplesPerSpan: 1, tolerance: CROSSING_TOLERANCE })).toBeNull();
    expect(profileProblem(prof)).toMatch(/crosses itself/);
  });

  it('rejects a fitted surface that runs back in x', () => {
    // Upper surface with a hook: x goes 0.62 -> 0.58 -> 0.66 around its middle.
    const pts = [[1, 0.003], [0.8, 0.04], [0.66, 0.06], [0.58, 0.075], [0.62, 0.085], [0.4, 0.09], [0.2, 0.07], [0.05, 0.035], [0, 0], [0.05, -0.02], [0.2, -0.03], [0.5, -0.03], [0.8, -0.015], [1, -0.003]];
    const c = checkAirfoil(pts);
    expect(c.ok).toBe(true);
    expect(profileProblem(profileCurve(c.points))).toMatch(/runs back in x/);
    expect(profileProblem(profileCurve(nacaAirfoil('2412').points))).toBeNull();
  });

  it('samples a 5000-point curve in bounded time', () => {
    const { curve } = profileCurve(nacaAirfoil('2412', { pointsPerSide: 2500 }).points);
    const t0 = performance.now();
    expect(curveCrossing(curve, { tolerance: CROSSING_TOLERANCE })).toBeNull();
    expect(performance.now() - t0).toBeLessThan(1000);
  });

  it('accepts fine airfoils and finds a crossing surface row', () => {
    const b = buildWing(sampleProject());
    expect(b.errors).toEqual([]);
    expect(surfaceRowCrossing(b.surface, 0, CROSSING_TOLERANCE * 200)).toBeNull();
    // Swap the z of two opposite control columns in the middle: the row folds over itself.
    const s = structuredClone(b.surface);
    const M = s.points.length - 1;
    const i = Math.round(M * 0.3);
    const j = M - i;
    for (let k = 0; k < s.points[i].length; k++) [s.points[i][k][2], s.points[j][k][2]] = [s.points[j][k][2], s.points[i][k][2]];
    expect(surfaceRowCrossing(s, 0, CROSSING_TOLERANCE * 200)).not.toBeNull();
  });
});

describe('smooth spanwise overshoot', () => {
  const symmetric = (codes, ys, chord = () => 100) =>
    createProject({
      airfoils: codes.map((c, i) => naca(c, `a${i}`, { closedTE: true })),
      sections: ys.map((y, i) => ({ airfoil: `a${i}`, x: 0, y, z: 0, chord: chord(i), twist: 0 })),
      settings: { spanwise: 'smooth' },
    });

  it('rejects profiles that overshoot between closely spaced sections', () => {
    // Weights of the natural cubic spline reach +-1475 between y = 0.11 and 100 mm.
    const p = symmetric(['0007', '0004', '0005', '0002', '0002', '0016'], [0, 0.1, 0.11, 100, 100.1, 101]);
    const b = buildWing(p);
    expect(b.errors[0]).toMatch(/^Smooth spanwise interpolation overshoots at y = [\d.]+ mm: (upper|lower) surface height at x = [\d.]+ % chord is /);
    expect(b.errors[0]).toMatch(/smallest gap 0\.01 mm/);
    expect(b.surface).toBeNull();
    p.settings.spanwise = 'linear';
    expect(buildWing(p).errors).toEqual([]);
  });

  it('rejects a chord overshoot from a cluster of sections at the tip', () => {
    const chords = [200, 150, 20];
    const b = buildWing(symmetric(['0012', '0012', '0012'], [0, 500, 510], (i) => chords[i]));
    // The chord reaches 1388 mm at y = 286 mm from sections of 20 to 200 mm.
    expect(b.errors[0]).toMatch(/overshoots at y = [\d.]+ mm: chord is 1[34]\d\d\.\d\d mm, while the sections range from 20\.00 to 200\.00 mm/);
  });

  it('keeps curved smooth planforms within OVERSHOOT_LIMIT section ranges', () => {
    // Chord 100/500/100 mm at y = 0/100/1000 mm reaches 1036 mm: 1.34 ranges beyond the sections.
    const chords = [100, 500, 100];
    expect(OVERSHOOT_LIMIT).toBe(2);
    expect(buildWing(symmetric(['0012', '0012', '0012'], [0, 100, 1000], (i) => chords[i])).errors).toEqual([]);
  });

  it('reports a fitted surface that turns inside out between stations', () => {
    // Zigzag guides: the fitted surface inverts between the stations, where no check position lies.
    let seed = 9;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    let hit = null;
    for (let t = 0; t < 40 && !hit; t++) {
      const n = 20 + Math.floor(rnd() * 70);
      const ys = Array.from({ length: n }, (_, i) => (600 * i) / (n - 1));
      const nose = ys.map((y, i) => [(i % 2 ? 60 : 0) * rnd() + 20 * rnd(), y]);
      const end = ys.map((y, i) => [nose[i][0] + 1 + 100 * rnd() * rnd(), y]);
      const p = sampleProject();
      p.guides = { nose: { enabled: true, mode: 'control', degree: 5, points: nose }, end: { enabled: true, mode: 'control', degree: 5, points: end } };
      const b = buildWing(p);
      if (/turns inside out between stations/.test(b.errors[0] ?? '')) hit = b;
    }
    expect(hit).not.toBeNull();
    expect(hit.surface).toBeNull();
  });

  it('stops when interpolated placement or a guide curve leaves the project limits', () => {
    // Smooth x through 0 / 1,000,000 / 0 mm at y = 0 / 100 / 1000 mm overshoots to about 2.3e6 mm,
    // 1.34 section ranges: within the overshoot limit, beyond the geometry extent of 1,200,000 mm.
    const p = sampleProject({ settings: { spanwise: 'smooth' } });
    p.sections = [
      { id: 'a', airfoil: 'root', x: 0, y: 0, z: 0, chord: 100, twist: 0 },
      { id: 'b', airfoil: 'root', x: 1_000_000, y: 100, z: 0, chord: 100, twist: 0 },
      { id: 'c', airfoil: 'root', x: 0, y: 1000, z: 0, chord: 100, twist: 0 },
    ];
    expect(validateProject(p).ok).toBe(true);
    expect(buildWing(p).errors[0]).toMatch(/^At y = [\d.]+ mm the wing leaves the project limits \(leading-edge x \d{7} mm.*limits ±1200000 mm/);
    // Through-point end line over unevenly spaced points: its control points reach 7.6e13 mm.
    const q = sampleProject();
    q.guides.end = { enabled: true, mode: 'fit', degree: 3, points: [[0, 0], [1_000_000, 0.1], [-1_000_000, 0.11], [1_000_000, 599.9], [0, 600]] };
    expect(validateProject(q).ok).toBe(true);
    const b = buildWing(q);
    expect(b.errors[0]).toMatch(/^End line: the curve through the points reaches x = 7\.\d\de\+13 mm, beyond ±1200000 mm/);
    expect(b.surface).toBeNull();
  });

  it('uses the stations as set above the grid warning and names the expected time and memory', { timeout: 30000 }, () => {
    const p = sampleProject({ settings: { spanwise: 'smooth', panelStations: 40, chordSamples: 200 } });
    const base = p.sections[0];
    p.sections = Array.from({ length: 5 }, (_, i) => ({ ...base, id: `s${i}`, y: 100 * i, chord: 200 - 10 * i, x: 5 * i }));
    const b = buildWing(p);
    expect(b.errors).toEqual([]);
    // (4 panels x 40 stations + 1) x 401 profile points = 64,561 grid points.
    expect(b.stations.length - b.extraStations).toBe(4 * 40 + 1);
    expect(b.warnings[0]).toMatch(/^Large project: 64,561 loft grid points \(warning above 60,000\)\. Each change takes (under 1 s|about [\d.]+ s) and about \d+ MB of browser memory\.$/);
  });

  it('reduces the stations per panel above LIMITS.maxGridPoints and stops when one station per panel exceeds it', () => {
    const smooth = { spanwise: 'smooth', panelStations: 8, chordSamples: 200 };
    // Largest K with (2999 panels x K + 1) x 401 points <= LIMITS.maxGridPoints.
    const K = Math.floor((LIMITS.maxGridPoints / 401 - 1) / 2999);
    // The tip station counts: N = 16, 3,886 sections, 40 stations per panel stays within the limit.
    const g = loftGrid(3886, { spanwise: 'smooth', panelStations: 40, chordSamples: 16 });
    expect(g.points).toBeLessThanOrEqual(LIMITS.maxGridPoints);
    expect(g.K).toBe(38);
    expect(K).toBeLessThan(8);
    expect(loftGrid(3000, smooth)).toEqual({ N: 200, Kset: 8, K, points: (2999 * K + 1) * 401 });
    expect(loftGrid(3, { ...smooth, spanwise: 'linear' })).toMatchObject({ Kset: 1, K: 1 });
    expect(loftGrid(3, { ...smooth, spanwise: 'linear' }, true)).toMatchObject({ Kset: 8, K: 8 });
    const p = sampleProject({ settings: { chordSamples: 200 } });
    const base = p.sections[0];
    const n = Math.ceil(LIMITS.maxGridPoints / 401) + 1;
    p.sections = Array.from({ length: n }, (_, i) => ({ ...base, id: `s${i}`, y: i }));
    const b = buildWing(p);
    expect(b.errors[0]).toBe(
      `The loft grid needs ${(n * 401).toLocaleString('en')} points with one station per panel (${n.toLocaleString('en')} sections, 200 chord samples); the limit is ${LIMITS.maxGridPoints.toLocaleString('en')}. Reduce the chord samples or the sections.`,
    );
    expect(b.surface).toBeNull();
  });

  it('reports an unusable airfoil once, however many sections use it', () => {
    const p = sampleProject();
    p.airfoils.push({ id: 'flat', name: 'Flat', points: [[1, 0], [0.5, 0], [0, 0], [0.5, 0], [1, 0]] });
    for (const s of p.sections) s.airfoil = 'flat';
    const b = buildWing(p);
    expect(b.errors.filter((e) => e.startsWith('Airfoil "Flat"'))).toHaveLength(1);
  });

  it('joins panel curves of one degree when panels hold different station counts', () => {
    // Panels of 1 and 3 intervals: degree 3 is not possible in the first, so both use degree 1.
    const values = [0, 1, 2, 3, 4].map((y) => [[0, y, y * y]]);
    const r = interpolateAlongV(values, { kind: 'panels', params: [0, 0.25, 0.5, 0.75, 1], panels: [[0, 1], [1, 4]], degree: 3 });
    expect(r.degree).toBe(1);
    expect(r.knots.length).toBe(r.columns[0].length + r.degree + 1);
    expect(r.columns[0].map((p) => p[1])).toEqual([0, 1, 2, 3, 4]);
  });

  it('keeps guide y values when the span leaves no room for distinct numbers', () => {
    const p = sampleProject();
    p.sections = p.sections.slice(0, 2);
    [1, 1.0000000000000002].forEach((y, i) => (p.sections[i].y = y));
    p.guides.end.points = [[200, 0], [190, 0.5], [150, 1]];
    syncGuidesToSpan(p);
    expect(p.guides.end.points.map((q) => q[1])).toEqual([0, 0.5, 1]);
    // A span with room keeps the stretch.
    p.sections[1].y = 600;
    syncGuidesToSpan(p);
    expect(p.guides.end.points.map((q) => q[1])).toEqual([1, 300.5, 600]);
  });

  it('builds sections at adjacent doubles in smooth mode without repeated stations', () => {
    const p = sampleProject({ settings: { spanwise: 'smooth' } });
    [1, 1.0000000000000002, 1.0000000000000004].forEach((y, i) => Object.assign(p.sections[i], { y, x: 0, z: 0, chord: 200, twist: 0 }));
    const b = buildWing(p);
    expect(b.errors).toEqual([]);
    expect(b.stations.map((s) => s.y)).toEqual([1, 1.0000000000000002, 1.0000000000000004]);
  });

  it('builds sections at the chord limit in linear and smooth mode (blend round-off)', () => {
    for (const spanwise of ['linear', 'smooth']) {
      const p = sampleProject({ settings: { spanwise } });
      for (const s of p.sections) s.chord = LIMITS.maxChord;
      expect(buildWing(p).errors).toEqual([]);
    }
  });

  it('stops at values beyond the project limits, which would also block saving', () => {
    // A twist of 1e308 degrees overflows the angle conversion to NaN coordinates.
    const cases = [
      [(p) => (p.sections[1].twist = 1e308), /Section 2: twist must be within ±360 degrees/],
      [(p) => (p.sections[1].chord = 100_001), /Section 2: chord must be at most 100000 mm/],
      [(p) => (p.sections[2].x = -1_000_001), /Section 3: x must be within ±1000000 mm/],
      [(p) => (p.guides.end.points = Array.from({ length: LIMITS.maxGuidePoints + 1 }, (_, i) => [200, (600 * i) / LIMITS.maxGuidePoints])), new RegExp(`guides.end.points: at most ${LIMITS.maxGuidePoints.toLocaleString('en')} points`)],
    ];
    for (const [mutate, message] of cases) {
      const p = sampleProject();
      mutate(p);
      const b = buildWing(p);
      expect(b.errors[0]).toMatch(message);
      expect(b.surface).toBeNull();
      expect(validateProject(p).errors).toContain(b.errors[0]);
    }
  });
});

describe('trailing-edge slivers and crossing size', () => {
  it('accepts resampled cusped trailing edges that cross by less than 1e-4 chord', () => {
    // Cusped trailing edge, thickness 0.24 sqrt(x) (1 - x)^1.5: at 200 chord samples the last
    // stations lie in a sliver of the fitted curve where the surfaces cross by about 1e-9 chord.
    const xs = Array.from({ length: 31 }, (_, i) => (1 - Math.cos((Math.PI * i) / 30)) / 2);
    const t = (x) => 0.24 * Math.sqrt(x) * (1 - x) ** 1.5;
    const c = (x) => 0.02 * Math.sin(Math.PI * x);
    const pts = [...xs.slice().reverse().map((x) => [x, c(x) + t(x) / 2]), ...xs.slice(1).map((x) => [x, c(x) - t(x) / 2])];
    expect(checkAirfoil(pts).ok).toBe(true);
    for (const parametrization of ['uniform', 'centripetal']) {
      const p = createProject({
        airfoils: [{ id: 'c', name: 'cusped', points: pts }],
        sections: [0, 300].map((y) => ({ airfoil: 'c', x: 0, y, z: 0, chord: 200, twist: 0 })),
        settings: { parametrization, chordSamples: 200 },
      });
      expect(buildWing(p).errors).toEqual([]);
    }
  });

  it('measures a crossing loop by its mean width, not its length', () => {
    const line = (pts) => {
      const n = pts.length;
      return { degree: 1, knots: [0, ...Array.from({ length: n }, (_, i) => i / (n - 1)), 1], points: pts };
    };
    // Loop 0.2 long and 1e-5 wide: a sliver below the tolerance.
    const sliver = line([[1, 0.05], [0.4, 0], [0.6, -1e-5], [0.8, 1e-5], [0.2, 0], [0, 0.05]]);
    expect(curveCrossing(sliver, { tolerance: 0 })).not.toBeNull();
    expect(curveCrossing(sliver, { tolerance: CROSSING_TOLERANCE })).toBeNull();
    // Same length, 0.02 wide: reported.
    const loop = line([[1, 0.05], [0.4, 0], [0.6, -0.02], [0.8, 0.02], [0.2, 0], [0, 0.05]]);
    expect(curveCrossing(loop, { tolerance: CROSSING_TOLERANCE }).size).toBeGreaterThan(10 * CROSSING_TOLERANCE);
  });

  it('limits an ignored crossing loop to 0.1 mm at large chords', () => {
    // 10 cusped points with uniform parametrization: a trailing-edge loop 6.19e-5 chord wide.
    const xs = Array.from({ length: 10 }, (_, i) => (1 - Math.cos((Math.PI * i) / 9)) / 2);
    const t = (x) => 0.16 * Math.sqrt(x) * (1 - x) ** 1.25;
    const pts = [...xs.slice().reverse().map((x) => [x, t(x) / 2]), ...xs.slice(1).map((x) => [x, -t(x) / 2])];
    const build = (chord) =>
      buildWing(
        createProject({
          airfoils: [{ id: 'c', name: 'cusped 10', points: pts }],
          sections: [0, 3 * chord].map((y) => ({ airfoil: 'c', x: 0, y, z: 0, chord, twist: 0 })),
          settings: { parametrization: 'uniform' },
        }),
      );
    // 0.06 mm at 1000 mm chord: below both limits.
    expect(build(1000).errors).toEqual([]);
    // 6.19 mm at 100,000 mm chord: below 5e-4 chord, above 0.1 mm.
    expect(build(100000).errors[0]).toMatch(/crosses itself near x = 99\.6 % chord; the loop is 6\.19 mm wide at 100000 mm chord, above 0\.1 mm/);
  });

  it('finds a large crossing behind more small crossings than the search limit', () => {
    // 30 curls 1e-4 wide (below the tolerance) along y = 0, then a loop 0.05 wide at x = 0.8.
    const pts = [];
    const d = 1e-4;
    for (let k = 0; k < 30; k++) {
      const x = k * 5 * d;
      pts.push([x, 0], [x + 2 * d, 0], [x + 2 * d, d], [x + d, d], [x + d, -d], [x + 3 * d, -d]);
    }
    pts.push([0.75, 0], [0.9, 0], [0.9, 0.05], [0.8, 0.05], [0.8, -0.05], [1, -0.05]);
    const small = curveCrossing(null, { samples: { pts: pts.slice(0, 180) } });
    expect(small.size).toBeLessThan(CROSSING_TOLERANCE);
    const cross = curveCrossing(null, { samples: { pts }, tolerance: CROSSING_TOLERANCE });
    expect(cross.x).toBeCloseTo(0.75, 9);
    expect(cross.size).toBeGreaterThan(10 * CROSSING_TOLERANCE);
  });
});

describe('span stations', () => {
  it('rejects distinct sections whose span fractions round together', () => {
    const ys = [169026.8951015743, 714063.9936875999, 714063.9936876, 816583.3893996814];
    const b = buildWing(
      createProject({
        airfoils: [{ id: 'a', name: 'NACA 2412', points: nacaAirfoil('2412').points }],
        sections: ys.map((y, i) => ({ airfoil: 'a', x: 10 * i, y, z: 0, chord: 200, twist: 0 })),
      }),
    );
    expect(b.errors).toHaveLength(1);
    expect(b.errors[0]).toMatch(/^Sections 2 and 3 at y = 714063\.9936875999 mm and y = 714063\.9936876 mm lie too close together for the surface parameters/);
  });
});

describe('guide inversion', () => {
  it('solves y on a guide spanning less than 1e-12 mm to parameter precision', () => {
    const curve = { degree: 2, knots: [0, 0, 0, 1, 1, 1], points: [[0, 0], [100, 9e-14], [0, 1e-13]] };
    // Reference: bisection on y(t) = 5e-14, the span midpoint.
    let a = 0;
    let b = 1;
    for (let i = 0; i < 200; i++) {
      const m = 0.5 * (a + b);
      if (curvePoint(curve, m)[1] < 5e-14) a = m;
      else b = m;
    }
    const x = curvePoint(curve, 0.5 * (a + b))[0];
    expect(x).toBeCloseTo(43.85, 1);
    expect(guideXAt(curve, 300, 0, 600)).toBeCloseTo(x, 6);
  });
});

describe('stations and guides near the resolution of doubles', () => {
  it('builds a smooth wing with a section cloned 5e-13 mm away', () => {
    const p = defaultProject();
    p.settings.spanwise = 'smooth';
    const s = p.sections.find((q) => q.y === 450);
    p.sections.push({ ...s, id: 'clone', y: 450 + 5e-13 });
    p.sections.sort((a, b) => a.y - b.y);
    const b = buildWing(p);
    expect(b.errors).toEqual([]);
    // Span fractions of the stations strictly increase.
    for (let i = 1; i < b.paramsV.length; i++) expect(b.paramsV[i]).toBeGreaterThan(b.paramsV[i - 1]);
  });

  it('reports guide points whose curve parameters round together', () => {
    const ys = [169026.8951015743, 714063.9936875999, 714063.9936876, 816583.3893996814];
    const guide = { enabled: true, mode: 'fit', degree: 3, points: ys.map((y, i) => [10 * i, y]) };
    expect(guideProblems(guide)).toEqual([
      'Points 2 and 3 at y = 714063.9936875999 mm and y = 714063.9936876 mm lie too close together for the curve parameters; move them apart.',
    ]);
    expect(guideProblems({ ...guide, mode: 'control' })).toEqual([]);
    const p = defaultProject();
    p.guides.nose = guide;
    const b = buildWing(p);
    expect(b.errors.some((e) => e.startsWith('Nose line: Points 2 and 3 at y = 714063.9936875999 mm'))).toBe(true);
  });

  it('samples every knot span of a guide with many points', () => {
    const pts = Array.from({ length: 401 }, (_, i) => [i % 2 ? 100 : 0, i]);
    const samples = sampleGuide(guideCurve({ enabled: true, mode: 'fit', degree: 3, points: pts }));
    expect(Math.max(...samples.map((q) => q[0]))).toBeGreaterThan(123);
    expect(samples.length).toBeLessThanOrEqual(40_001);
  });
});

describe('guide inversion on a nearly flat y(t)', () => {
  it('finds x within 1 mm of a bisection on a 1,000,000 mm control-point guide', () => {
    const pts = [[0, 0], [0, 499999.9999], [0, 499999.99995], [425702, 500000.00005], [425702, 500000.0001], [425702, 1e6]];
    const curve = { ...clampedUniformKnots(pts.length, 3), points: pts };
    for (const y of [500000, 499999.99999, 500000.00002, 250000]) {
      let a = 0;
      let b = 1;
      for (let i = 0; i < 300; i++) {
        const m = 0.5 * (a + b);
        if (curvePoint(curve, m)[1] < y) a = m;
        else b = m;
      }
      // The reference itself is uncertain by about 0.1 mm: y resolves 6e-11 mm at 500,000 mm.
      expect(Math.abs(guideXAt(curve, y, 0, 1e6) - curvePoint(curve, 0.5 * (a + b))[0])).toBeLessThan(1);
    }
  });
});

describe('span fractions near zero', () => {
  const at = (ys) =>
    buildWing(
      createProject({
        airfoils: [{ id: 'a', name: 'NACA 2412', points: nacaAirfoil('2412').points }],
        sections: ys.map((y, i) => ({ airfoil: 'a', x: i === 1 ? 50 : 0, y, z: 0, chord: 200, twist: 0 })),
      }),
    );
  it('rejects a section a subnormal distance from the root and keeps a normal one', () => {
    for (const d of [Number.MIN_VALUE, 1e-310]) expect(at([0, d, 1]).errors[0]).toMatch(/^Sections 1 and 2 at y = 0 mm and y = [\d.e-]+ mm lie too close together for the surface parameters/);
    const b = at([0, 1e-300, 1]);
    expect(b.errors).toEqual([]);
    for (const v of [0, 1e-300, 0.5, 1]) expect(surfacePoint(b.surface, 0.3, v).every(Number.isFinite)).toBe(true);
  });
  it('merges knots closer than MIN_PARAM_GAP', () => {
    expect(knotMultiplicities([0, 0, Number.MIN_VALUE, 1, 1])).toEqual({ knots: [0, 1], mults: [3, 2] });
    expect(knotMultiplicities([0, 0, 1e-300, 1, 1])).toEqual({ knots: [0, 1e-300, 1], mults: [2, 1, 2] });
  });
});

describe('builds at the edges of double precision', () => {
  const foil = [{ id: 'a', name: 'NACA 2412', points: nacaAirfoil('2412').points }];
  const project = (sections, settings = {}, guides) =>
    createProject({ airfoils: foil, sections: sections.map((s) => ({ airfoil: 'a', x: 0, z: 0, chord: 200, twist: 0, ...s })), settings, ...(guides ? { guides } : {}) });

  it('builds sections of exactly the minimum chord, smooth or between two guide curves', () => {
    const smooth = project([{ y: 0 }, { y: 169.7 }, { y: 436.6 }, { y: 881.4 }].map((s) => ({ ...s, chord: 1 })), { spanwise: 'smooth' });
    expect(buildWing(smooth).errors).toEqual([]);
    for (const x of [20, 123.4, 5e5]) {
      const p = project([{ y: 0, chord: 1 }, { y: 600, x, chord: 1 }]);
      p.guides = defaultGuides(p.sections);
      p.guides.nose.enabled = true;
      p.guides.end.enabled = true;
      expect(buildWing(p).errors, String(x)).toEqual([]);
    }
  });

  it('names the smooth blend, not the guide curves, when the blended chord drops below 1 mm', () => {
    const p = project([{ y: 0, chord: 1 }, { y: 500, chord: 1 }, { y: 600, chord: 5 }, { y: 1000, chord: 5 }], { spanwise: 'smooth' });
    expect(buildWing(p).errors).toEqual(['Chord drops to -2.56 mm at y = 289.1 mm; the smooth blend of the section chords falls below the minimum of 1 mm; use linear interpolation or add sections.']);
  });

  it('reports a singular fit of sections or guide points 1e-300 of the span apart as an error', () => {
    const near = [{ y: 0 }, { y: 1e-300 }, { y: 600, chord: 150 }];
    const withNose = project(near);
    withNose.guides = defaultGuides(withNose.sections);
    withNose.guides.nose.enabled = true;
    expect(() => buildWing(withNose)).not.toThrow();
    expect(buildWing(withNose).errors[0]).toMatch(/^(Nose line: the curve fit is singular|The surface fit is singular)/);
    const smooth = buildWing(project([{ y: 0 }, { y: 1e-200 }, { y: 600, chord: 150 }], { spanwise: 'smooth' }));
    expect(smooth.errors[0]).toMatch(/^The surface fit is singular: sections 1 and 2 at y = 0 mm and y = 1e-200 mm lie too close together; move them apart\.$/);
    const fitGuide = project([{ y: 0 }, { y: 600, chord: 150 }]);
    fitGuide.guides = defaultGuides(fitGuide.sections);
    fitGuide.guides.nose = { ...fitGuide.guides.nose, enabled: true, mode: 'fit', points: [[0, 0], [1, 1e-300], [0, 600]] };
    expect(() => buildWing(fitGuide)).not.toThrow();
    expect(buildWing(fitGuide).errors[0]).toMatch(/^Nose line: /);
  });

  it('triangulates the caps of a wing far from the origin by strips', () => {
    const square = [[1e5, 1e3], [1e5 + 20, 1e3], [1e5 + 20, 1e3 + 1], [1e5, 1e3 + 1]];
    expect(polygonArea(square)).toBe(20);
    const p = project([{ y: 0, x: 1e5, z: 1e3, chord: 20 }, { y: 600, x: 1e5, z: 1e3, chord: 20 }], { chordSamples: 200 });
    const b = buildWing(p);
    expect(b.errors).toEqual([]);
    const t0 = performance.now();
    const [{ mesh }] = exportMeshes(b, 'right', { uRefine: 2, vRefine: 2 });
    expect(performance.now() - t0).toBeLessThan(500);
    expect(edgeCheck(mesh).closed).toBe(true);
  });
});
