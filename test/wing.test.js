import { describe, expect, it } from 'vitest';
import { buildWing, joinCurves, placeSection } from '../src/geom/wing.js';
import { curvePoint, dist, interpolateCurve, surfacePoint } from '../src/geom/nurbs.js';
import { cosineStations, profileCurve, resampleDeviation, resampleProfile } from '../src/geom/profile.js';
import { blendPoints, blendScalar, spanwiseWeights } from '../src/geom/spanwise.js';
import { clampedUniformKnots, defaultGuides, guideCurve, guideProblems, guideXAt, isMonotonicInY } from '../src/geom/guide.js';
import { edgeCheck, fullWingMesh, halfWingMesh, meshArea, meshBounds, meshVolume, tessellateHalf } from '../src/geom/mesh.js';
import { earClip, polygonArea } from '../src/geom/triangulate.js';
import { nacaAirfoil } from '../src/airfoil/naca.js';
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

  it('reproduces section values and sums to one in smooth mode', () => {
    const ys = [0, 100, 250, 400];
    const w = spanwiseWeights(ys, 'smooth');
    ys.forEach((y, i) => w(y).forEach((v, k) => expect(v).toBeCloseTo(i === k ? 1 : 0, 12)));
    for (const y of [10, 120, 399]) expect(w(y).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
    // Natural cubic spline reproduces linear data exactly.
    expect(blendScalar(w(177), ys.map((y) => 3 * y + 1))).toBeCloseTo(3 * 177 + 1, 9);
    expect(w(-10)).toEqual(w(0));
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
    const p = sampleProject({ settings: { tip: { mode: 'pointed', ratio: 0.002 }, ...settings } });
    return p;
  };

  it('scales the tip profile to the ratio of the previous section chord', () => {
    const b = buildWing(pointedProject());
    expect(b.errors).toEqual([]);
    const tip = b.stations[b.stations.length - 1];
    expect(tip.chord).toBeCloseTo(0.002 * 170, 12);
    expect(b.tipChord).toBeCloseTo(0.34, 12);
    // Leading edge stays at the tip section position; the tip is a scaled copy of the profile.
    expect(tip.xLE).toBeCloseTo(60, 9);
    const half = halfWingMesh(tessellateHalf(b));
    expect(edgeCheck(half).closed).toBe(true);
    expect(meshVolume(half)).toBeGreaterThan(0);
    // The trailing-edge gap scales with the chord near the tip (at most 5 % of the chord).
    for (const st of b.stations) expect(st.shape[0][1] - st.shape[st.shape.length - 1][1]).toBeLessThanOrEqual(0.05 + 1e-12);
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

  it('warns when guides do not meet at a pointed tip', () => {
    const p = pointedProject();
    p.guides.nose.enabled = true;
    p.guides.end.enabled = true;
    expect(buildWing(p).warnings.some((w) => /end [\d.]+ mm apart/.test(w))).toBe(true);
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
