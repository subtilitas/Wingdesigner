import { afterEach, describe, expect, it } from 'vitest';
import { buildWing, interpolateAlongV, joinCurves, mitredPlaneProblem, placeSection, surfaceRowCrossing } from '../src/geom/wing.js';
import { MAX_STRETCH, firstFold, overStretched, planeFold, rolledPanelCount, sectionPlanes, stretchOf, upExtent } from '../src/geom/planes.js';
import { syncGuidesToSpan } from '../src/model/edit.js';
import { curvePoint, dist, interpolateCurve, knotMultiplicities, solveMonotonic, surfacePoint } from '../src/geom/nurbs.js';
import { solve } from '../src/geom/linalg.js';
import { CROSSING_TOLERANCE, cosineStations, curveCrossing, profileCurve, profileProblem, resampleDeviation, resampleProfile } from '../src/geom/profile.js';
import { blendPoints, blendScalar, spanwiseBlender, spanwiseWeights } from '../src/geom/spanwise.js';
import { clampedUniformKnots, defaultGuides, guideCurve, guideProblems, guideXAt, isMonotonicInY, sampleGuide } from '../src/geom/guide.js';
import { edgeCheck, exportMeshes, fullWingMesh, halfWingMesh, meshArea, meshBounds, meshVolume, tessellateHalf } from '../src/geom/mesh.js';
import { earClip, polygonArea } from '../src/geom/triangulate.js';
import { nacaAirfoil } from '../src/airfoil/naca.js';
import { defaultProject } from '../src/model/defaults.js';
import { checkAirfoil } from '../src/airfoil/sanity.js';
import { LIMITS, createProject, resolveSettings, validateProject } from '../src/model/project.js';
import { loftGrid } from '../src/model/budget.js';
import { projectFromJsonText, projectToJsonText } from '../src/model/io.js';
import { cuspedAirfoil, naca, sampleProject } from './helpers.js';
import { setLanguage, tr } from '../src/i18n/index.js';

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
    const w = spanwiseWeights([0, 100, 300]);
    expect(w(-5)).toEqual([1, 0, 0]);
    expect(w(50)).toEqual([0.5, 0.5, 0]);
    expect(w(200)).toEqual([0, 0.5, 0.5]);
    expect(w(400)).toEqual([0, 0, 1]);
    expect(spanwiseWeights([5])(3)).toEqual([1]);
  });

  it('blends point lists from the neighbouring sections as the weighted sum does (linear)', () => {
    // Uneven spacing (0.1 mm next to 100 mm gaps).
    const ys = [0, 0.1, 100, 101, 250, 400, 400.5, 800];
    const lists = ys.map((y, i) => [[Math.sin(i), Math.cos(3 * i)], [i * i, -i], [0.01 * y, 1]]);
    const w = spanwiseWeights(ys);
    const blend = spanwiseBlender(ys, 'linear', lists);
    for (const y of [-20, 0, 0.05, 50, 100.5, 333, 400.2, 799, 900]) {
      const a = blendPoints(w(y), lists);
      const b2 = blend(y);
      for (let k = 0; k < a.length; k++) for (let c = 0; c < 2; c++) expect(b2[k][c]).toBeCloseTo(a[k][c], 9);
    }
  });

  // Smooth blend of one scalar per section.
  const smooth = (ys, values) => {
    const blend = spanwiseBlender(ys, 'smooth', values.map((v) => [[v]]));
    return (y) => blend(y)[0][0];
  };

  it('reproduces section values and linear data in smooth mode', () => {
    const ys = [0, 100, 250, 400];
    const f = smooth(ys, [3, -1, 7, 2]);
    ys.forEach((y, i) => expect(f(y)).toBe([3, -1, 7, 2][i]));
    expect(f(-10)).toBe(3);
    expect(f(500)).toBe(2);
    // Linear data: the natural spline is the line, within the limits.
    const line = smooth(ys, ys.map((y) => 3 * y + 1));
    for (const y of [10, 177, 399]) expect(line(y)).toBeCloseTo(3 * y + 1, 9);
  });

  it('equals the natural cubic spline where that spline stays within the limits, and handles 400 sections interactively', () => {
    // Reference: natural cubic spline through the values, second derivatives from a dense solve.
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
    // Chords of a wing with a quadratic taper from 200 mm, evenly and unevenly spaced: monotone, and
    // the spline slopes lie within 3 times the secants.
    for (const xs of [
      [0, 150, 300, 450, 600],
      [0, 100, 250, 450, 600, 700],
    ]) {
      const vals = xs.map((y) => 200 - 0.1 * y - 1e-4 * y * y);
      const f = smooth(xs, vals);
      for (let y = 0; y <= xs[xs.length - 1]; y += 7) expect(f(y)).toBeCloseTo(dense(xs, vals, y), 9);
    }
    const ys = Array.from({ length: 400 }, (_, i) => i * 5 + (i % 3));
    const t0 = performance.now();
    const f = smooth(ys, ys.map((y) => Math.sin(y / 100)));
    for (let k = 0; k < 500; k++) f(k * 3.9);
    expect(performance.now() - t0).toBeLessThan(2000);
  });

  it('stays within the two section values of every panel and is monotone there, also between unevenly spaced sections', () => {
    let seed = 3;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let t = 0; t < 40; t++) {
      // Panels of 0.5 mm (an XFLR5 airfoil switch) next to panels up to 300 mm; repeated values (a
      // constant panel) and steps.
      const ys = [0];
      for (let i = 1; i < 3 + Math.floor(rnd() * 10); i++) ys.push(ys[i - 1] + (rnd() < 0.3 ? 0.5 : 1 + rnd() * 300));
      const vals = [];
      for (let i = 0; i < ys.length; i++) vals.push(i > 0 && rnd() < 0.3 ? vals[i - 1] : Math.round(rnd() * 100));
      const f = smooth(ys, vals);
      for (let j = 0; j + 1 < ys.length; j++) {
        const lo = Math.min(vals[j], vals[j + 1]);
        const hi = Math.max(vals[j], vals[j + 1]);
        const sign = Math.sign(vals[j + 1] - vals[j]);
        const tol = 1e-9 * (1 + hi);
        let prev = vals[j];
        for (let k = 1; k <= 64; k++) {
          const v = f(ys[j] + ((ys[j + 1] - ys[j]) * k) / 64);
          expect(v).toBeGreaterThanOrEqual(lo - tol);
          expect(v).toBeLessThanOrEqual(hi + tol);
          expect(sign * (v - prev)).toBeGreaterThanOrEqual(-tol);
          prev = v;
        }
      }
    }
  });

  it('has a continuous slope at the sections in smooth mode', () => {
    const ys = [0, 300, 300.5, 600, 900];
    const f = smooth(ys, [250, 250, 200, 150, 120]);
    const e = 1e-6;
    for (const y of ys.slice(1, -1)) {
      const left = (f(y) - f(y - e)) / e;
      const right = (f(y + e) - f(y)) / e;
      expect(Math.abs(right - left)).toBeLessThan(1e-3 * Math.max(1, Math.abs(left)));
    }
    // The constant root panel stays constant.
    for (let y = 0; y <= 300; y += 10) expect(f(y)).toBe(250);
  });

  it('gives the derivative of the blend in y: the panel secant when linear, the cubic slope when smooth', () => {
    const ys = [0, 300, 300.5, 600, 900];
    const vals = [250, 250, 200, 150, 120];
    const linear = spanwiseBlender(ys, 'linear', vals.map((v) => [[v]]));
    // At a section the panel inboard of it (the root: the first panel); outside the sections that of the end panel.
    expect([150, 300, 300.25, 450, 0, -5, 950].map((y) => linear.derivative(y)[0][0])).toEqual([0, 0, -100, -50 / 299.5, 0, 0, -30 / 300]);
    expect(spanwiseBlender([10], 'linear', [[[3, 4]]]).derivative(10)).toEqual([[0, 0]]);
    const blend = spanwiseBlender(ys, 'smooth', vals.map((v) => [[v]]));
    const e = 1e-4;
    for (const y of [17, 299.9, 300.25, 450, 777, 899.99]) {
      const fd = (blend(y + e)[0][0] - blend(y - e)[0][0]) / (2 * e);
      expect(blend.derivative(y)[0][0]).toBeCloseTo(fd, 4);
    }
    // Continuous at the sections: both panels give the slope of the section.
    for (const y of ys.slice(1, -1)) expect(blend.derivative(y - 1e-9)[0][0]).toBeCloseTo(blend.derivative(y)[0][0], 4);
  });

  it('blends point lists', () => {
    expect(blendPoints([0.25, 0.75], [[[0, 0]], [[4, 8]]])).toEqual([[3, 6]]);
    expect(blendScalar([0.25, 0.75], [4, 8])).toBe(7);
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

  it('keeps the upper surface above the lower one at a closed cusped trailing edge', () => {
    // Root and tip of a wing with a cusped airfoil (zero thickness and wedge angle at the trailing
    // edge). Free end tangents of the chordwise fit cross the surfaces up to 0.046 mm from the
    // trailing edge of the 240 mm root, 1.2e-4 mm deep; secant end tangents keep them apart.
    const b = buildWing(
      createProject({
        name: 'Cusped',
        airfoils: [cuspedAirfoil()],
        sections: [
          { airfoil: 'cusp', x: 0, y: 0, z: 0, chord: 240, twist: 0 },
          { airfoil: 'cusp', x: 48, y: 600, z: 24, chord: 168, twist: -2 },
          { airfoil: 'cusp', x: 120, y: 960, z: 48, chord: 96, twist: -3 },
        ],
        settings: { spanwise: 'straight', sectionPlanes: 'vertical' },
      }),
    );
    expect(b.errors).toEqual([]);
    expect(b.closedTE).toBe(true);
    for (const v of [0, 1]) {
      const T = surfacePoint(b.surface, 0, v);
      const L = surfacePoint(b.surface, b.uLE, v);
      const len = dist(L, T);
      // Chord direction (trailing edge to leading edge) and the up direction in the vertical plane.
      const c = [(L[0] - T[0]) / len, 0, (L[2] - T[2]) / len];
      const n = [c[2], 0, -c[0]];
      const along = (P) => (P[0] - T[0]) * c[0] + (P[2] - T[2]) * c[2];
      const up = (P) => (P[0] - T[0]) * n[0] + (P[2] - T[2]) * n[2];
      const at = (u0, u1, d) => surfacePoint(b.surface, solveMonotonic((u) => along(surfacePoint(b.surface, u, v)), d, u0, u1, 1e-12), v);
      for (let d = 0.002; d <= 0.3; d += 0.002) {
        const thickness = up(at(0, 0.05 * b.uLE, d)) - up(at(1 - 0.05 * (1 - b.uLE), 1, d));
        expect(thickness).toBeGreaterThan(0);
      }
    }
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
    // 40 trials from one seeded sequence; trial 26 folds (trials 2, 18 and 23 turn inside out).
    let seed = 9;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    let guides = null;
    for (let t = 0; t <= 26; t++) {
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

/** Smooth wing with sections at y = 0, 1e-304 and 600 mm, leading-edge x 0, 1,000,000 and 0 mm. */
function overflow() {
  const p = sampleProject({ settings: { spanwise: 'smooth' } });
  p.sections = [0, 1e-304, 600].map((y, i) => ({ id: `s${i}`, airfoil: 'root', x: i === 1 ? 1_000_000 : 0, y, z: 0, chord: 200, twist: 0 }));
  return p;
}

/** Sample wing with a nose line at x = 0 mm and an end line at x = 300,000 mm. */
function farGuides() {
  const p = sampleProject();
  p.guides.nose = { enabled: true, mode: 'fit', degree: 3, points: [[0, 0], [0, 600]] };
  p.guides.end = { enabled: true, mode: 'fit', degree: 3, points: [[300_000, 0], [300_000, 600]] };
  return p;
}

describe('smooth spanwise interpolation between unevenly spaced sections', () => {
  const symmetric = (codes, ys, chord = () => 100) =>
    createProject({
      airfoils: codes.map((c, i) => naca(c, `a${i}`, { closedTE: true })),
      sections: ys.map((y, i) => ({ airfoil: `a${i}`, x: 0, y, z: 0, chord: chord(i), twist: 0 })),
      settings: { spanwise: 'smooth' },
    });

  /**
   * Largest distance (mm; twist in degrees) by which a station of the build leaves the values of the
   * two sections of its panel: leading-edge x, chord, z, twist and the thickness at every chord station.
   */
  const beyondSections = (b) => {
    const { sections, stations, profiles } = b;
    const out = (v, a, c) => Math.max(0, Math.min(a, c) - v, v - Math.max(a, c));
    let worst = 0;
    for (const st of stations) {
      let j = 0;
      while (j < sections.length - 2 && st.y > sections[j + 1].y) j++;
      const [A, B] = [sections[j], sections[j + 1]];
      worst = Math.max(worst, out(st.xLE, A.x, B.x), out(st.chord, A.chord, B.chord), out(st.z, A.z, B.z), out(st.twist, A.twist, B.twist));
      const [pa, pb] = [profiles.get(A.airfoil).compat, profiles.get(B.airfoil).compat];
      const N = (st.shape.length - 1) / 2;
      const t = (P, k) => P[N - k][1] - P[N + k][1];
      for (let k = 1; k < N; k++) worst = Math.max(worst, out(t(st.shape, k), t(pa, k), t(pb, k)) * st.chord);
    }
    return worst;
  };

  it('keeps the profiles between closely spaced sections within the section values', () => {
    // The natural cubic spline through these sections had weights of ±1475 between y = 0.11 and 100 mm.
    const p = symmetric(['0007', '0004', '0005', '0002', '0002', '0016'], [0, 0.1, 0.11, 100, 100.1, 101]);
    const b = buildWing(p);
    expect(b.errors).toEqual([]);
    expect(beyondSections(b)).toBeLessThan(1e-9);
  });

  it('keeps the chord of a cluster of sections at the tip within the section chords', () => {
    // The natural cubic spline reached a chord of 1388 mm at y = 286 mm from sections of 20 to 200 mm.
    const chords = [200, 150, 20];
    const b = buildWing(symmetric(['0012', '0012', '0012'], [0, 500, 510], (i) => chords[i]));
    expect(b.errors).toEqual([]);
    expect(Math.max(...b.stations.map((s) => s.chord))).toBe(200);
    expect(beyondSections(b)).toBeLessThan(1e-9);
  });

  it('ends a curved planform at its largest section chord', () => {
    // Chord 100/500/100 mm at y = 0/100/1000 mm: the natural cubic spline reached 1036 mm, the blend
    // peaks at the middle section with a horizontal slope.
    const chords = [100, 500, 100];
    const b = buildWing(symmetric(['0012', '0012', '0012'], [0, 100, 1000], (i) => chords[i]));
    expect(b.errors).toEqual([]);
    expect(Math.max(...b.stations.map((s) => s.chord))).toBe(500);
    expect(beyondSections(b)).toBeLessThan(1e-9);
  });

  it('keeps the blended thickness between the section thicknesses (NACA 0024, 0006, 0024 at 0, 60, 600 mm)', () => {
    // The natural cubic spline took the thickness below 0 between y = 60 and 600 mm.
    const p = sampleProject({ settings: { spanwise: 'smooth' } });
    p.airfoils = [naca('0024', 'thick'), naca('0006', 'thin')];
    p.sections = [
      { id: 'a', airfoil: 'thick', x: 0, y: 0, z: 0, chord: 200, twist: 0 },
      { id: 'b', airfoil: 'thin', x: 0, y: 60, z: 0, chord: 200, twist: 0 },
      { id: 'c', airfoil: 'thick', x: 0, y: 600, z: 0, chord: 200, twist: 0 },
    ];
    const b = buildWing(p);
    expect(b.errors).toEqual([]);
    expect(beyondSections(b)).toBeLessThan(1e-9);
  });

  // Section layouts of XFLR5 wings, in mm: [y, chord, airfoil, x, z, twist]. An airfoil switch or a
  // chord step is two sections at one y, which the XFLR5 import moves 0.5 mm apart. Before the
  // shape-preserving blend, Smooth stopped on each with an overshoot, e.g. a chord of 6018.68 mm at
  // y = 173.4 mm from sections of 150 to 250 mm (chord step), a twist of 230.75° from sections of
  // −3° to 0° (twist step), and profile heights of up to 506.67 % chord (switch near the tip).
  const xflr5Like = {
    'airfoil switch': [[0, 250, '2412'], [300, 250, '2412'], [300.5, 250, '0009'], [600, 250, '0009']],
    'airfoil switch with taper': [[0, 300, '2412'], [300, 250, '2412'], [300.5, 250, '0009'], [600, 150, '0009', 40]],
    'chord step': [[0, 250, '2412'], [300, 250, '2412'], [300.5, 200, '2412'], [600, 150, '2412']],
    'thickness step': [[0, 260, '2415'], [300, 240, '2415'], [300.5, 240, '2408'], [700, 160, '2408', 30]],
    'twist step': [[0, 250, '2412'], [300, 250, '2412'], [300.5, 250, '2412', 0, 0, -2], [600, 200, '2412', 10, 0, -3]],
    'switch near the tip': [[0, 250, '2412'], [400, 240, '2412'], [400.5, 240, '0009'], [450, 150, '0009', 30]],
    'aileron cut-out': [[0, 250, '2412'], [200, 250, '2412'], [200.5, 220, '2412'], [500, 220, '2412'], [500.5, 250, '2412'], [700, 200, '2412']],
    'two switches and a short root panel': [
      [0, 300, '2415'],
      [12.7, 300, '2415'],
      [300, 280, '2415'],
      [300.5, 280, '2412'],
      [700, 220, '2412', 20, 15],
      [700.5, 220, '0009', 20, 15],
      [900, 150, '0009', 50, 25, -2],
    ],
  };
  for (const [name, rows] of Object.entries(xflr5Like)) {
    it(`builds an XFLR5 section layout in smooth mode within the section values: ${name}`, () => {
      const p = createProject({
        airfoils: [...new Set(rows.map((r) => r[2]))].map((c) => naca(c, c)),
        sections: rows.map(([y, chord, airfoil, x = 0, z = 0, twist = 0], i) => ({ id: `s${i}`, airfoil, x, y, z, chord, twist })),
        settings: { spanwise: 'smooth', sectionPlanes: 'vertical' },
      });
      const b = buildWing(p);
      expect(b.errors).toEqual([]);
      expect(b.warnings).toEqual([]);
      expect(b.extraStations).toBe(0);
      expect(beyondSections(b)).toBeLessThan(1e-9);
    });
  }

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

  it('stops when the guide curves leave the project limits', () => {
    // Nose line at x = 0 mm and end line at x = 300,000 mm: a chord of 300,000 mm, above 100,000 mm.
    const p = farGuides();
    expect(validateProject(p).ok).toBe(true);
    expect(buildWing(p).errors[0]).toMatch(/^At y = 0\.0 mm the wing leaves the project limits \(leading-edge x 0 mm, z 0 mm, chord 300000 mm; limits ±1200000 mm and 100000 mm chord\)\. Check the guide curves\.$/);
    // The smooth blend stays within the section values: x through 0 / 1,000,000 / 0 mm at
    // y = 0 / 100 / 1000 mm stays within the 1,200,000 mm extent.
    const smooth = sampleProject({ settings: { spanwise: 'smooth' } });
    smooth.sections = [
      { id: 'a', airfoil: 'root', x: 0, y: 0, z: 0, chord: 100, twist: 0 },
      { id: 'b', airfoil: 'root', x: 1_000_000, y: 100, z: 0, chord: 100, twist: 0 },
      { id: 'c', airfoil: 'root', x: 0, y: 1000, z: 0, chord: 100, twist: 0 },
    ];
    const built = buildWing(smooth);
    expect(built.errors.filter((e) => /project limits/.test(e))).toEqual([]);
    expect(Math.max(...built.stations.map((st) => st.xLE))).toBe(1_000_000);
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
    // Panels of 1, 3 and 2 intervals: the fewest intervals of a panel with more than two stations (2)
    // set the degree; the two-station panel is the straight segment raised to it.
    const values = [0, 1, 2, 3, 4, 5, 6].map((y) => [[0, y, y * y]]);
    const params = values.map((_, k) => k / 6);
    const r = interpolateAlongV(values, { kind: 'panels', params, panels: [[0, 1], [1, 4], [4, 6]], degree: 3 });
    expect(r.degree).toBe(2);
    expect(r.knots.length).toBe(r.columns[0].length + r.degree + 1);
    const curve = { degree: r.degree, knots: r.knots, points: r.columns[0] };
    for (const [k, t] of params.entries()) expect(dist(curvePoint(curve, t), values[k][0])).toBeLessThan(1e-12);
    for (const f of [0.25, 0.5, 0.75]) expect(dist(curvePoint(curve, f / 6), [0, f, f])).toBeLessThan(1e-12);
    // Two-station panels only: straight segments at degree 1.
    const flat = interpolateAlongV(values.slice(0, 3), { kind: 'panels', params: [0, 0.5, 1], panels: [[0, 1], [1, 2]], degree: 3 });
    expect([flat.degree, flat.knots]).toEqual([1, [0, 0, 0.5, 1, 1]]);
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

  it('stops on non-finite placement values (User Guide example: sections 1e-304 mm apart)', () => {
    // Leading-edge x rises 1,000,000 mm over 1e-304 mm: the secant overflows to infinity, and the
    // smooth blend gives non-finite values. Linear builds.
    const p = overflow();
    expect(validateProject(p).ok).toBe(true);
    const b = buildWing(p);
    expect(b.errors).toEqual(['Section values give non-finite coordinates at y = 0.0 mm; check the positions, chords and twists of the sections.']);
    expect(b.surface).toBeNull();
    p.settings.spanwise = 'linear';
    expect(buildWing(p).errors).toEqual([]);
  });

  it('keeps the smooth blend of 1 mm and 5 mm chords at 1 mm or more', () => {
    // The natural cubic spline took the chord to -2.56 mm at y = 289.1 mm.
    const p = project([{ y: 0, chord: 1 }, { y: 500, chord: 1 }, { y: 600, chord: 5 }, { y: 1000, chord: 5 }], { spanwise: 'smooth' });
    const b = buildWing(p);
    expect(b.errors).toEqual([]);
    expect(Math.min(...b.stations.map((s) => s.chord))).toBeGreaterThanOrEqual(1 - 1e-12);
  });

  it('reports a singular fit of sections or guide points 1e-300 of the span apart as an error', () => {
    const near = [{ y: 0 }, { y: 1e-300 }, { y: 600, chord: 150 }];
    const withNose = project(near);
    withNose.guides = defaultGuides(withNose.sections);
    withNose.guides.nose.enabled = true;
    expect(() => buildWing(withNose)).not.toThrow();
    expect(buildWing(withNose).errors[0]).toMatch(/^(Nose line: the curve fit is singular|The surface fit is singular)/);
    // Smooth fits every panel on its own: a panel 1e-200 mm wide builds.
    expect(buildWing(project([{ y: 0 }, { y: 1e-200 }, { y: 600, chord: 150 }], { spanwise: 'smooth' })).errors).toEqual([]);
    const fitGuide = project([{ y: 0 }, { y: 600, chord: 150 }]);
    fitGuide.guides = defaultGuides(fitGuide.sections);
    fitGuide.guides.nose = { ...fitGuide.guides.nose, enabled: true, mode: 'fit', points: [[0, 0], [1, 1e-300], [0, 600]] };
    expect(() => buildWing(fitGuide)).not.toThrow();
    expect(buildWing(fitGuide).errors[0]).toMatch(/^Nose line: /);
  });

  it('triangulates Fine caps of a closed trailing edge by strips', () => {
    const p = createProject({
      airfoils: [{ id: 'a', name: 'NACA 4415', points: nacaAirfoil('4415').points }],
      sections: [
        { airfoil: 'a', x: 0, y: 0, z: 0, chord: 200, twist: 0 },
        { airfoil: 'a', x: 0, y: 600, z: 0, chord: 120, twist: 0 },
      ],
      settings: { chordSamples: 200, trailingEdge: { mode: 'closed', thickness: 0 } },
    });
    const b = buildWing(p);
    expect(b.errors).toEqual([]);
    const t0 = performance.now();
    const meshes = exportMeshes(b, 'halves', { uRefine: 2, vRefine: 2 });
    expect(performance.now() - t0).toBeLessThan(500);
    for (const { mesh } of meshes) expect(edgeCheck(mesh).closed).toBe(true);
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

describe('added stations', () => {
  // A nose line with a bump 4 mm high and 0.06 mm wide at y = 713 mm (control points).
  const bumped = (n) => {
    const ys = Array.from({ length: n }, (_, i) => (1000 * i) / (n - 1));
    const p = createProject({ airfoils: [{ id: 'a', name: 'NACA 2412', points: nacaAirfoil('2412').points }], sections: ys.map((y) => ({ airfoil: 'a', x: 0, y, z: 0, chord: 200, twist: 0 })) });
    p.guides = defaultGuides(p.sections);
    const line = [];
    for (let y = 0; y <= 1000; y += 50) if (y < 712 || y > 714) line.push([0, y]);
    const bump = [[0, 712.97], [1, 712.98], [3, 712.99], [4, 713], [3, 713.01], [1, 713.02], [0, 713.03]];
    p.guides.nose = { enabled: true, mode: 'control', degree: 3, points: [...line, ...bump].sort((a, b) => a[1] - b[1]) };
    return p;
  };

  it('undoes a round of added stations that makes the deviation larger', () => {
    const b = buildWing(bumped(2));
    expect(b.errors).toEqual([]);
    // Without the check, 32 stations clustered at the bump made the loft deviate 18,797 mm.
    expect(b.planformDeviation).toBeLessThan(5);
    expect(b.warnings.find((w) => w.startsWith('The loft deviates'))).toMatch(/^The loft deviates up to 3\.\d\d mm from the intended surface at y = 713\.0 mm/);
  });

  it('fits the loft at most twice above the loft grid warning threshold', () => {
    const b = buildWing(bumped(200));
    expect(b.errors).toEqual([]);
    expect(b.fits).toBe(2);
    expect(b.extraStations).toBeGreaterThan(0);
  });
});

describe('straight panels', () => {
  // A tapered panel whose airfoil changes too: NACA 0014 at 400 mm to NACA 0008 at 100 mm chord.
  const airfoil = (code) => ({ id: code, name: `NACA ${code}`, points: nacaAirfoil(code, { closedTE: true }).points });
  const panel = (spanwise, tipTwist = 0) =>
    createProject({
      airfoils: [airfoil('0014'), airfoil('0008')],
      sections: [
        { airfoil: '0014', x: 0, y: 0, z: 0, chord: 400, twist: 0 },
        { airfoil: '0008', x: 150, y: 100, z: 20, chord: 100, twist: tipTwist },
      ],
      settings: { spanwise, sectionPlanes: 'vertical' },
    });
  /** Largest distance at v of the surface from the straight lines between the section points, and the largest thickness there. */
  const atV = (b, v) => {
    const { surface, paramsU, leIndex: N } = b;
    const A = b.stations[0].points;
    const B = b.stations.at(-1).points;
    let fromLines = 0;
    let thickness = 0;
    for (let j = 0; j <= 2 * N; j++) {
      const P = surfacePoint(surface, paramsU[j], v);
      fromLines = Math.max(fromLines, Math.hypot(...[0, 1, 2].map((c) => P[c] - ((1 - v) * A[j][c] + v * B[j][c]))));
      if (j > 0 && j < N) thickness = Math.max(thickness, P[2] - surfacePoint(surface, paramsU[2 * N - j], v)[2]);
    }
    return { fromLines, thickness };
  };

  it('joins the points of equal chord fraction with straight lines, with no added stations', () => {
    for (const twist of [0, -3]) {
      const b = buildWing(panel('straight', twist));
      expect(b.errors).toEqual([]);
      expect(b.warnings).toEqual([]);
      expect([b.stations.length, b.extraStations, b.planformDeviation, b.surface.degreeV]).toEqual([2, 0, 0, 1]);
      for (const v of [0.25, 0.5, 0.75]) expect(atV(b, v).fromLines).toBeLessThan(1e-9);
    }
    // The thickness halfway is the mean of 56 mm (14 % of 400 mm) and 8 mm (8 % of 100 mm).
    expect(atV(buildWing(panel('straight')), 0.5).thickness).toBeCloseTo(32, 2);
  });

  it('differs from linear panels where chord and airfoil or twist change together', () => {
    for (const twist of [0, -3]) {
      const b = buildWing(panel('linear', twist));
      expect(b.errors).toEqual([]);
      // Linear blends the normalized airfoil and the chord apart: 11 % of 250 mm halfway, 2.3 mm (3.1 mm
      // with 3° twist) off the straight lines; added stations make the loft follow that.
      expect(b.extraStations).toBeGreaterThan(0);
      const mid = atV(b, 0.5);
      expect(mid.thickness).toBeCloseTo(27.5, 1);
      expect(mid.fromLines).toBeGreaterThan(twist ? 3 : 2.2);
    }
  });

  it('stops the build when a guide curve is on', () => {
    for (const key of ['nose', 'end']) {
      const p = panel('straight');
      p.guides[key].enabled = true;
      expect(buildWing(p).errors).toEqual([
        'Straight panels do not follow guide curves: switch the guide curves off in the Planform tab, or set Settings > Spanwise interpolation to Linear or Smooth.',
      ]);
    }
    expect(validateProject(panel('straight')).ok).toBe(true);
    expect(validateProject(panel('ruled')).errors).toEqual(['settings.spanwise must be "linear", "straight" or "smooth".']);
    expect(loftGrid(2, panel('straight').settings)).toMatchObject({ Kset: 1, K: 1 });
  });
});

describe('mitred section planes', () => {
  const DEG = Math.PI / 180;
  const tan = (d) => Math.tan(d * DEG);
  /** A 15°/−5° gull of NACA 0012 without twist; `middle` is the length in y of the second panel. */
  const gull = (settings = {}, { twist = 0, middle = 300 } = {}) =>
    createProject({
      airfoils: [naca('0012', 'a')],
      sections: [
        { airfoil: 'a', x: 0, y: 0, z: 0, chord: 200, twist: 0 },
        { airfoil: 'a', x: 20, y: 300, z: 300 * tan(15), chord: 170, twist },
        { airfoil: 'a', x: 60, y: 300 + middle, z: 300 * tan(15) - middle * tan(5), chord: 110, twist },
      ],
      settings: { sectionPlanes: 'mitred', ...settings },
    });
  const range = (values) => Math.max(...values) - Math.min(...values);

  it('rolls the root 0°, a break to the bisector and the tip square to the last panel, each with its stretch', () => {
    const sections = gull().sections;
    const pl = sectionPlanes(sections, 'mitred');
    [[pl.dihedrals, [15, -5]], [pl.rolls, [0, 5, -5]], [pl.angles, [15, 10, 0]], [pl.stretches, [1 / Math.cos(15 * DEG), 1 / Math.cos(10 * DEG), 1]]].forEach(([got, want]) =>
      got.forEach((v, i) => expect(v).toBeCloseTo(want[i], 12)),
    );
    expect(sectionPlanes(sections, 'vertical')).toEqual({ rolls: [0, 0, 0], stretches: [1, 1, 1], dihedrals: pl.dihedrals, panels: pl.dihedrals, angles: [0, 0, 0] });
    expect(sectionPlanes(sections.slice(0, 1), 'mitred').rolls).toEqual([0]);
    // 60° between plane and panel stretches the airfoil twice; the build stops beyond MAX_STRETCH.
    expect(stretchOf(60, 0)).toBeCloseTo(MAX_STRETCH, 12);
    // A plane that rounds to 60.0° builds: section positions hold 4 decimals.
    expect([overStretched([1, 2, 2.0031]), overStretched([1, NaN]), overStretched([1, 2.0000002])]).toEqual([2, 1, -1]);
    // Linear panels between planes that differ get the stations per panel; straight and smooth
    // panels, vertical planes and a flat wing get none. The sections may come in any order.
    const panels = (settings, secs = sections) => rolledPanelCount(secs, resolveSettings({ sectionPlanes: 'mitred', ...settings }));
    expect([panels({}), panels({}, sections.slice().reverse()), panels({ spanwise: 'straight' }), panels({ spanwise: 'smooth' }), panels({ sectionPlanes: 'vertical' })]).toEqual([2, 2, 0, 0, 0]);
    expect(panels({}, sampleProject().sections.map((q) => ({ ...q, z: 0 })))).toBe(0);
    expect(panels({}, sections.slice(0, 1))).toBe(0);
  });

  it('takes a stored panel angle in place of the dihedral from y and z, for the rolls and the stretches', () => {
    const sections = gull().sections;
    // Section 1 stores 17° for its panel (15° from y and z): the break rolls to (17 − 5) / 2 = 6°.
    const stored = sections.map((q, i) => (i === 0 ? { ...q, panelAngle: 17 } : q));
    const pl = sectionPlanes(stored, 'mitred');
    [[pl.dihedrals, [15, -5]], [pl.panels, [17, -5]], [pl.rolls, [0, 6, -5]], [pl.angles, [17, 11, 0]], [pl.stretches, [1 / Math.cos(17 * DEG), 1 / Math.cos(11 * DEG), 1]]].forEach(([got, want]) =>
      got.forEach((v, i) => expect(v).toBeCloseTo(want[i], 12)),
    );
    // The tip has no panel: a stored angle there changes nothing. null means from y and z.
    expect(sectionPlanes(sections.map((q, i) => (i === 2 ? { ...q, panelAngle: 40 } : i === 1 ? { ...q, panelAngle: null } : q)), 'mitred').rolls).toEqual(sectionPlanes(sections, 'mitred').rolls);
    // The build places the rows in the stored planes; each Linear station keeps the stretch of its panel.
    const p = gull();
    p.sections[0].panelAngle = 17;
    const b = buildWing(p);
    expect(b.errors).toEqual([]);
    expect(b.rolls.map((r) => Number(r.toFixed(9)))).toEqual([0, 6, -5]);
    const mid = b.stations.find((st) => st.y > 100 && st.y < 200);
    expect(mid.stretch).toBeCloseTo(1 / Math.cos((mid.roll - 17) * DEG), 12);
    // Validation: a number within ±89.9999° or null; the JSON file keeps it.
    const bad = (v) => validateProject({ ...p, sections: p.sections.map((q, i) => (i === 0 ? { ...q, panelAngle: v } : q)) }).errors;
    expect([bad(null), bad(89.9999), bad(-90), bad('5')]).toEqual([[], [], ['Section 1: panelAngle must be within ±89.9999 degrees.'], ['Section 1: panelAngle must be a finite number or null.']]);
    expect(projectFromJsonText(projectToJsonText(p)).project.sections.map((q) => q.panelAngle)).toEqual([17, undefined, undefined]);
  });

  it('puts the two sections of a panel narrower than 1 mm in y in one plane, the bisector of the panels around it', () => {
    const at = (y, z) => ({ airfoil: 'a', x: 0, y, z, chord: 150, twist: 0 });
    const planesOf = (secs) => sectionPlanes(secs, 'mitred');
    const roundAll = (v) => v.map((r) => Number(r.toFixed(9)));
    // A 0° panel, a 0.5 mm airfoil switch at y = 300 mm, a 10° panel: both switch sections roll 5°,
    // with the stretch of the panels around them.
    const sw = [at(0, 0), at(299.5, 0), at(300, 0), at(600, 300 * tan(10))];
    const pl = planesOf(sw);
    expect(roundAll(pl.rolls)).toEqual([0, 5, 5, 10]);
    expect(roundAll(pl.stretches)).toEqual(roundAll([1, 1 / Math.cos(5 * DEG), 1 / Math.cos(5 * DEG), 1]));
    expect(roundAll(pl.panels)).toEqual(roundAll([0, 10, 10]));
    // The width in y counts: 0.9 mm in y and 5 mm in z is no panel; 1 mm in y is one.
    expect(roundAll(planesOf([at(0, 0), at(299.1, 0), at(300, 5), at(600, 5 + 300 * tan(10))]).rolls)).toEqual([0, 5, 5, 10]);
    expect(planesOf([at(0, 0), at(299, 0), at(300, 0), at(600, 300 * tan(10))]).rolls[1]).toBe(0);
    // At the root the sections before the first panel stay vertical, at the tip those after the last
    // panel lie square to it. Without any panel every plane is vertical.
    expect(roundAll(planesOf([at(0, 0), at(0.5, 0), at(300.5, 300 * tan(10)), at(300.9, 300 * tan(10))]).rolls)).toEqual([0, 0, 10, 10]);
    expect(planesOf([at(0, 0), at(0.5, 3)]).rolls).toEqual([0, 0]);
    // The build: Linear and Straight panels between the two switch sections do not fold.
    for (const spanwise of ['linear', 'straight']) {
      const b = buildWing(createProject({ airfoils: [naca('0012', 'a')], sections: sw, settings: { sectionPlanes: 'mitred', spanwise } }));
      expect([spanwise, b.errors]).toEqual([spanwise, []]);
      expect(roundAll(b.rolls)).toEqual([0, 5, 5, 10]);
    }
  });

  it('keeps the airfoil thickness across every panel and puts each end row in its plane', () => {
    const b = buildWing(gull());
    expect([b.errors, b.warnings, b.infos, b.sectionPlanes, b.surface.degreeV]).toEqual([[], [], [], 'mitred', 3]);
    // Stations per panel of Settings (8) in both rolled panels.
    expect(b.stations).toHaveLength(17);
    const vertical = buildWing(gull({ sectionPlanes: 'vertical' }));
    for (const [build, factor] of [[b, 1], [vertical, null]]) {
      for (const st of build.stations) {
        const d = (st.y < 300 ? 15 : -5) * DEG;
        const across = range(st.points.map((p) => -Math.sin(d) * p[1] + Math.cos(d) * p[2]));
        const airfoil = st.chord * range(st.shape.map((q) => q[1]));
        // Vertical planes lose cos δ across the panel: 96.6 % at 15°.
        if (factor) expect(across / airfoil).toBeCloseTo(1, 9);
        else if (st.y > 0 && st.y < 300) expect(across / airfoil).toBeCloseTo(Math.cos(15 * DEG), 9);
      }
    }
    // The root row stays at y = 0, so the halves meet there; the tip row lies in its plane rolled −5°.
    for (const u of b.paramsU) expect(surfacePoint(b.surface, u, 0)[1]).toBe(0);
    const tip = b.sections[2];
    for (const u of b.paramsU) {
      const P = surfacePoint(b.surface, u, 1);
      expect(Math.abs((P[1] - tip.y) * Math.cos(-5 * DEG) + (P[2] - tip.z) * Math.sin(-5 * DEG))).toBeLessThan(1e-9);
    }
    const half = tessellateHalf(b);
    expect(edgeCheck(halfWingMesh(half)).closed).toBe(true);
    const full = fullWingMesh(half, b.rootY);
    expect([full.shells, edgeCheck(full).closed]).toEqual([1, true]);
    expect(meshVolume(full)).toBeCloseTo(2 * meshVolume(halfWingMesh(half)), 3);
    // The station data of a project file carries roll and stretch.
    expect(b.stations.map((st) => [st.roll, st.stretch]).at(0)).toEqual([0, 1 / Math.cos(15 * DEG)]);
  });

  it('joins mitred sections of straight panels with straight lines', () => {
    const b = buildWing(gull({ spanwise: 'straight' }));
    expect([b.errors, b.stations.length, b.extraStations, b.surface.degreeV]).toEqual([[], 3, 0, 1]);
    const [A, B] = [b.stations[0].points, b.stations[1].points];
    const v = b.stations[1].v / 2;
    for (let j = 0; j < A.length; j += 7) {
      const P = surfacePoint(b.surface, b.paramsU[j], v);
      expect(dist(P, A[j].map((c, k) => (c + B[j][k]) / 2))).toBeLessThan(1e-9);
    }
  });

  it('stops at a stretch above 2 and at planes that fold within the airfoils, as mitredPlaneProblem predicts', () => {
    const steep = createProject({
      airfoils: [naca('0012', 'a')],
      sections: [
        { airfoil: 'a', x: 0, y: 0, z: 0, chord: 100 },
        { airfoil: 'a', x: 0, y: 100, z: 100 * tan(65), chord: 80 },
      ],
      settings: { sectionPlanes: 'mitred' },
    });
    expect(buildWing(steep).errors).toEqual([
      'Section 1: its mitred plane lies 65.0° from the panel next to it, which stretches the airfoil 2.366 times (limit 2, 60°). Reduce the dihedral change there or set Settings > Section planes to Vertical.',
    ]);
    expect(mitredPlaneProblem(steep)).toMatchObject({ kind: 'stretch', i: 0 });
    expect(mitredPlaneProblem(steep).angle).toBeCloseTo(65, 9);
    // Panels of 0°, 40° (10 mm long) and 80°: the planes rolled 20° and 60° meet 14.6 mm from the
    // position of section 2, inside its NACA 0012 of 300 mm chord (±19.2 mm with the stretch); at 150 mm
    // chord (±9.6 mm) the line passes above both sections.
    const turns = (middle, chord = 300) =>
      createProject({
        airfoils: [naca('0012', 'a')],
        sections: [
          { airfoil: 'a', x: 0, y: 0, z: 0, chord },
          { airfoil: 'a', x: 0, y: 200, z: 0, chord },
          { airfoil: 'a', x: 0, y: 200 + middle * Math.cos(40 * DEG), z: middle * Math.sin(40 * DEG), chord },
          { airfoil: 'a', x: 0, y: 200 + middle * Math.cos(40 * DEG) + 200 * Math.cos(80 * DEG), z: middle * Math.sin(40 * DEG) + 200 * Math.sin(80 * DEG), chord },
        ],
        settings: { sectionPlanes: 'mitred', spanwise: 'straight' },
      });
    expect(buildWing(turns(10)).errors).toEqual([
      'Sections 2 and 3: their mitred planes meet 14.6 mm from the position (y, z) of section 2, within the airfoils, so the surface between them folds. Lengthen the panel, reduce the dihedral change or set Settings > Section planes to Vertical.',
    ]);
    const problem = mitredPlaneProblem(turns(10));
    expect(problem).toMatchObject({ kind: 'fold', i: 1 });
    expect(problem.distance).toBeCloseTo(14.6, 1);
    for (const clear of [turns(200), turns(10, 150)]) expect([buildWing(clear).errors, mitredPlaneProblem(clear)]).toEqual([[], null]);
    const upright = turns(10);
    upright.settings.sectionPlanes = 'vertical';
    expect(buildWing(upright).errors).toEqual([]);
    // An airfoil that fails its check leaves the report to the build.
    const broken = gull();
    broken.airfoils[0].points = [[1, 0], [0.5, 0], [0, 0], [0.5, 0], [1, 0]];
    expect(mitredPlaneProblem(broken)).toBeNull();
  });

  it('stops where the planes of a Linear panel turn faster than its airfoils allow, whatever the stations per panel', () => {
    // NACA 0018 at 217 mm chord, rolls 0° and 46.9° over a 21.7 mm panel: at the root a point 30.4 mm
    // up its plane moves across it at cos φ + tan δ · sin φ − t · dφ/dy = 1 − 30.4 · 0.0377 < 0. The end
    // planes meet 46 mm up the root plane, beyond the airfoil, and neighbouring stations need not cross.
    const turning = (K, scale = 1) =>
      createProject({
        airfoils: [naca('0018', 'c')],
        sections: [[0, 0, 217], [21.7, 25.8, 237], [125, 124.6, 417]].map(([y, z, chord]) => ({ airfoil: 'c', x: 0, y: y * scale, z: z * scale, chord: chord * scale, twist: 0 })),
        settings: { sectionPlanes: 'mitred', panelStations: K },
      });
    const message = 'Sections 1 and 2: at y = 0.0 mm the mitred section planes between them turn faster than the airfoils allow, so the surface folds. Lengthen the panel, reduce the dihedral change or set Settings > Section planes to Vertical.';
    for (const K of [3, 4, 8]) for (const scale of [1, 7]) expect(buildWing(turning(K, scale)).errors, `K ${K}, scale ${scale}`).toEqual([message]);
    // Smooth turns the planes along the cubic blend of the rolls and checks every check position.
    for (const K of [3, 8]) {
      const smooth = turning(K);
      smooth.settings.spanwise = 'smooth';
      expect(buildWing(smooth).errors, `smooth, K ${K}`).toEqual([message]);
    }
    // End planes that meet within the airfoils: the ruled Straight panel folds; the Linear panel turns
    // its planes in between and does not (NACA 0021, chords 400 and 100 mm, a 33 mm flat panel, then 80°).
    const turnOut = (spanwise) =>
      createProject({
        airfoils: [naca('0021', 'a')],
        sections: [
          { airfoil: 'a', x: 0, y: 0, z: 0, chord: 400 },
          { airfoil: 'a', x: 0, y: 33, z: 0, chord: 100 },
          { airfoil: 'a', x: 0, y: 33 + 200 * Math.cos(80 * DEG), z: 200 * Math.sin(80 * DEG), chord: 100 },
        ],
        settings: { sectionPlanes: 'mitred', spanwise, panelStations: 12 },
      });
    expect([buildWing(turnOut('linear')).errors, buildWing(turnOut('smooth')).errors]).toEqual([[], []]);
    expect(buildWing(turnOut('straight')).errors[0]).toMatch(/^Sections 1 and 2: their mitred planes meet 39\.3 mm from the position \(y, z\) of section 1/);
    // Straight panels are ruled between the sections: the check of the two end planes decides.
    const straight = turning(3);
    straight.settings.spanwise = 'straight';
    expect(buildWing(straight).errors).toEqual([]);
    // A panel twice as long turns half as fast and builds.
    const longer = turning(3);
    longer.sections[1].y = 43.4;
    longer.sections[1].z = 51.6;
    expect(buildWing(longer).errors).toEqual([]);
    longer.settings.spanwise = 'smooth';
    expect(buildWing(longer).errors).toEqual([]);
  });

  it('builds Smooth with the rolls of the sections blended by the cubic and the stretch from the slope of the reference line', () => {
    const b = buildWing(gull({ spanwise: 'smooth' }));
    expect([b.errors, b.infos, b.sectionPlanes, b.surface.degreeV]).toEqual([[], [], 'mitred', 3]);
    // The section planes are those of Linear: root 0°, the bisector of the break, the tip square to the last panel.
    const pl = sectionPlanes(gull().sections, 'mitred');
    b.rolls.forEach((r, i) => expect(r).toBeCloseTo(pl.rolls[i], 12));
    // Between the sections the roll follows the cubic blend of the section rolls, and the stretch
    // 1/cos(roll − δ) keeps the airfoil thickness across the blended reference line of dihedral δ.
    const secs = gull().sections;
    const ys = secs.map((q) => q.y);
    const zBlend = spanwiseBlender(ys, 'smooth', secs.map((q) => [[q.z]]));
    const rollBlend = spanwiseBlender(ys, 'smooth', pl.rolls.map((r) => [[r]]));
    const inner = b.stations.filter((st) => !ys.includes(st.y));
    expect(inner.length).toBeGreaterThan(4);
    for (const st of b.stations) {
      const dihedral = Math.atan(zBlend.derivative(st.y)[0][0]) / DEG;
      expect(st.roll).toBeCloseTo(rollBlend(st.y)[0][0], 9);
      expect(st.stretch).toBeCloseTo(1 / Math.cos((st.roll - dihedral) * DEG), 9);
    }
    // At the root the plane stays vertical; the smooth reference line leaves it at the slope of the
    // cubic, not of the first panel.
    expect(b.stretches[0]).toBeCloseTo(1 / Math.cos(Math.atan(zBlend.derivative(0)[0][0])), 9);
    // A flat wing builds as before, with vertical planes and no stretch.
    const flat = gull({ spanwise: 'smooth' });
    flat.sections.forEach((q) => (q.z = 0));
    expect(buildWing(flat).stations.every((st) => st.roll === 0 && st.stretch === 1)).toBe(true);
  });

  it('stretches Smooth against the angle of a short panel, as Linear, and against stored panel angles blended along the span', () => {
    // An airfoil switch 0.5 mm wide that the airfoil frames lift 2 mm: its two sections share one plane,
    // and the cubic, 76° steep across the switch, does not set their stretch.
    const sw = (spanwise) =>
      createProject({
        airfoils: [naca('0012', 'a')],
        sections: [[0, 0], [300, 26], [300.5, 28], [600, 52]].map(([y, z]) => ({ airfoil: 'a', x: 0, y, z, chord: 200, twist: 0 })),
        settings: { sectionPlanes: 'mitred', spanwise },
      });
    const [linear, smooth] = ['linear', 'smooth'].map((s) => buildWing(sw(s)));
    expect([linear.errors, smooth.errors]).toEqual([[], []]);
    expect(smooth.stretches[1]).toBeCloseTo(linear.stretches[1], 12);
    // A stored panel angle of 20° on the outer panel of a flat wing: the planes roll 0°, 10° and 20°.
    // Smooth blends what the stored angle adds (0°, 10°, 20° at the sections, the mean of the panels
    // next to a section) like the rolls, so every station plane is square to the blended angle: the
    // stretch is 1 and continuous. Ignoring the stored angle would stretch the tip 1/cos 20° = 1.064 times.
    const stored = (spanwise) =>
      createProject({
        airfoils: [naca('0012', 'a')],
        sections: [0, 300, 600].map((y, i) => ({ airfoil: 'a', x: 0, y, z: 0, chord: 200, twist: 0, ...(i === 1 ? { panelAngle: 20 } : {}) })),
        settings: { sectionPlanes: 'mitred', spanwise },
      });
    const [l2, s2] = ['linear', 'smooth'].map((s) => buildWing(stored(s)));
    expect([l2.rolls, s2.rolls]).toEqual([[0, 10, 20], [0, 10, 20]]);
    expect(l2.stretches[1]).toBeCloseTo(1 / Math.cos(10 * DEG), 12);
    for (const st of s2.stations) expect(st.stretch, `y ${st.y}`).toBeCloseTo(1, 12);
    // The limit of 60° holds within the rounding of Linear: a straight wing at 60.01° builds both ways
    // (the vertical root plane stretched 2.0006 times).
    const steep = (spanwise) =>
      createProject({
        airfoils: [naca('0012', 'a')],
        sections: [0, 1, 2].map((k) => ({ airfoil: 'a', x: 0, y: 300 * k * Math.cos(60.01 * DEG), z: 300 * k * Math.sin(60.01 * DEG), chord: 200, twist: 0 })),
        settings: { sectionPlanes: 'mitred', spanwise },
      });
    for (const spanwise of ['linear', 'smooth']) expect(buildWing(steep(spanwise)).errors, spanwise).toEqual([]);
  });

  it('stops Smooth where the reference line bends beyond 60° from the plane between the sections', () => {
    // NACA 0012, panels of −34.4° and 74.0°: every section plane lies within 60° of its panels, and
    // Linear builds. The smooth reference line leaves the vertical root plane at 63.7°.
    const bent = (spanwise) =>
      createProject({
        airfoils: [naca('0012', 'a')],
        sections: [[0, 0, 200], [54, -37, 136], [84, 67, 161]].map(([y, z, chord]) => ({ airfoil: 'a', x: 0, y, z, chord, twist: 0 })),
        settings: { sectionPlanes: 'mitred', spanwise },
      });
    expect([buildWing(bent('linear')).errors, buildWing(bent('straight')).errors]).toEqual([[], []]);
    expect(buildWing(bent('smooth')).errors).toEqual([
      'Sections 1 and 2: at y = 0.0 mm the mitred section plane lies 63.7° from the smooth reference line, which stretches the airfoil 2.254 times (limit 2, 60°). Reduce the dihedral change there, add sections or set Settings > Section planes to Vertical.',
    ]);
    const vertical = bent('smooth');
    vertical.settings.sectionPlanes = 'vertical';
    expect(buildWing(vertical).errors).toEqual([]);
  });

  it('finds where two rolled planes meet and whether the loft between them folds', () => {
    // A symmetric airfoil 10 % thick at 100 mm chord, stretched twice: ±10 mm; turned 90°: the chord upright.
    const shape = [[1, 0], [0.5, 0.05], [0, 0], [0.5, -0.05], [1, 0]];
    expect(upExtent(shape, { chord: 100, twist: 0, stretch: 2 }, 0.25)).toEqual([-10, 10]);
    const [low, high] = upExtent(shape, { chord: 100, twist: 90 }, 0.25);
    expect([low, high].map((v) => Math.round(v * 1e9) / 1e9)).toEqual([-75, 25]);
    // A vertical plane at y = 0 and one rolled 45° through y = 10 mm meet 10 mm up the first.
    const a = { y: 0, z: 0, roll: 0, low: -10, high: 12 };
    const b = { y: 10, z: 0, roll: 45, low: -10, high: 10 };
    expect(planeFold(a, b).distance).toBeCloseTo(10, 12);
    // Below the line on both sides, and the first section inboard of the second plane: no fold.
    expect(planeFold({ ...a, high: 9.9 }, { ...b, high: 9.9 })).toBeNull();
    // On opposite sides of the line: a fold.
    expect(planeFold({ ...a, low: 10.5, high: 12 }, { ...b, high: 9.9 })).not.toBeNull();
    // Parallel planes never meet.
    expect(planeFold(a, { ...b, roll: 0 })).toBeNull();
    expect(firstFold([0, 0, 0], () => a)).toBeNull();
    expect(firstFold([0, 45], (i) => [a, b][i])).toMatchObject({ i: 0 });
  });
});

describe('German build messages', () => {
  afterEach(() => setLanguage('en'));
  const german = (project) => {
    setLanguage('de');
    return buildWing(project);
  };
  const coarse = [[1, 0.002], [0.9422, 0.0062], [0.4103, 0.1048], [0.3764, 0.0957], [0, 0], [0.2163, -0.0488], [0.4749, -0.0296], [0.9349, -0.0728], [1, -0.002]];

  it('names section and guide errors in German with decimal commas', () => {
    const one = sampleProject();
    one.sections = one.sections.slice(0, 1);
    expect(german(one).errors).toEqual(['Mindestens 2 Schnitte sind erforderlich.']);
    const dup = sampleProject();
    dup.sections[1].y = 0;
    expect(german(dup).errors).toEqual(['Die Schnitte 1 und 2 haben dieselbe Spannweitenposition y = 0 mm.']);
    const unknown = sampleProject();
    unknown.sections[0].airfoil = 'nope';
    expect(german(unknown).errors).toEqual(['Der Schnitt bei y = 0 mm verwendet das unbekannte Profil „nope“.']);
    const mirrored = sampleProject();
    mirrored.sections[0].y = -5.5;
    expect(german(mirrored).errors).toEqual(['Der Schnitt bei y = -5,5 mm liegt auf der gespiegelten Seite; der Halbflügel erstreckt sich über y >= 0.']);
    const back = sampleProject();
    back.guides.nose.enabled = true;
    back.guides.nose.points = [[0, 0], [0, 300], [0, 200]];
    expect(german(back).errors).toEqual(['Nasenlinie: Leitkurvenpunkte müssen eine streng aufsteigende Spannweitenposition y haben.']);
    back.guides.nose.enabled = false;
    back.guides.end.enabled = true;
    back.guides.end.points = [[200, 0]];
    expect(german(back).errors).toEqual(['Endlinie: Eine Leitkurve braucht mindestens 2 Punkte.']);
    const straight = sampleProject({ settings: { spanwise: 'straight' } });
    straight.guides.nose.enabled = true;
    expect(german(straight).errors).toEqual([
      'Gerade Felder folgen keinen Leitkurven: die Leitkurven in der Registerkarte Grundriss ausschalten oder Einstellungen > Interpolation in Spannweitenrichtung auf „Linear“ oder „Glatt“ setzen.',
    ]);
    setLanguage('en');
    expect(guideProblems({ points: [[0, 0], [1, 1], [2, Infinity]] })).toEqual(['Guide points must be finite [x, y] pairs.']);
    setLanguage('de');
    expect(guideProblems({ points: [[0, 0], [1, 1], [2, Infinity]] })).toEqual(['Leitkurvenpunkte müssen endliche [x, y]-Paare sein.']);
  });

  it('names close sections and guide points with their span positions', () => {
    const ys = [169026.8951015743, 714063.9936875999, 714063.9936876, 816583.3893996814];
    const b = german(createProject({ airfoils: [{ id: 'a', name: 'NACA 2412', points: nacaAirfoil('2412').points }], sections: ys.map((y, i) => ({ airfoil: 'a', x: 10 * i, y, z: 0, chord: 200, twist: 0 })) }));
    expect(b.errors[0]).toMatch(/^Die Schnitte 2 und 3 bei y = 714063,9936875999 mm und y = 714063,9936876 mm liegen für die Flächenparameter zu dicht beieinander \(Spannweitenanteile 0,\d+ und 0,\d+\); die Schnitte auseinanderschieben\.$/);
    const guide = { enabled: true, mode: 'fit', degree: 3, points: ys.map((y, i) => [10 * i, y]) };
    expect(guideProblems(guide)).toEqual([
      'Die Punkte 2 und 3 bei y = 714063,9936875999 mm und y = 714063,9936876 mm liegen für die Kurvenparameter zu dicht beieinander; die Punkte auseinanderschieben.',
    ]);
  });

  it('translates the singular surface fit', () => {
    setLanguage('de');
    expect(tr('The surface fit is singular: sections {a} and {b} at y = {y1} mm and y = {y2} mm lie too close together; move them apart.', { a: '1', b: '2', y1: '0', y2: '1e-200' })).toBe(
      'Die Flächenanpassung ist singulär: Die Schnitte 1 und 2 bei y = 0 mm und y = 1e-200 mm liegen zu dicht beieinander; die Schnitte auseinanderschieben.',
    );
  });

  it('translates the chord error with its hint and the pointed-tip warnings', () => {
    const p = sampleProject();
    p.guides.nose.enabled = true;
    p.guides.end.enabled = true;
    p.guides.end.points = [[200, 0], [100, 300], [60, 600]];
    expect(german(p).errors).toEqual([
      'Die Profiltiefe sinkt bei y = 600,0 mm auf 0,00 mm; Nasenlinie und Endlinie dürfen sich nicht berühren oder kreuzen. Für ein Flügelende, das in einer Spitze endet, Einstellungen > Flügelende auf „Spitz“ setzen.',
    ]);
    const tip = sampleProject({ settings: { tip: { mode: 'pointed', ratio: 0.01 } } });
    tip.guides.nose.enabled = true;
    tip.guides.end.enabled = true;
    expect(german(tip).warnings.find((w) => w.startsWith('Spitzes Flügelende'))).toMatch(
      /^Spitzes Flügelende: Nasenlinie und Endlinie enden \d+,\d mm voneinander entfernt, daher beträgt die Randtiefe \d+,\d mm statt 1,70 mm; ihre letzten Punkte zusammenschieben, um das Flügelende zu schließen\.$/,
    );
  });

  it('translates thickness errors of the trailing-edge setting', () => {
    const xs = Array.from({ length: 61 }, (_, i) => (1 - Math.cos((Math.PI * i) / 60)) / 2);
    const outline = (t) => [...xs.slice().reverse().map((x) => [x, t(x) / 2]), ...xs.slice(1).map((x) => [x, -t(x) / 2])];
    const project = (mode, t) => {
      const q = sampleProject({ settings: { trailingEdge: { mode, thickness: 0.3 } } });
      q.airfoils = [{ id: 'w', name: 'waisted', points: outline(t) }];
      for (const s of q.sections) s.airfoil = 'w';
      return q;
    };
    const waisted = (x) => 0.1 * Math.sqrt(x) * (1 - x) ** 3 + 0.03 * x ** 4;
    expect(german(project('closed', waisted)).errors[0]).toMatch(
      /^Die Endleisteneinstellung zieht die Oberseite bei y = 0,0 mm unter die Unterseite \(-\d+,\d\d % der Profiltiefe\); das Profil ist innen dünner als seine Endleistendicke\. Die Einstellung „Wie in den Profildateien“ oder eine größere Endleistendicke verwenden\.$/,
    );
    const touching = (x) => 0.03 * x + 0.1 * Math.sqrt(x) * (1 - x) * (x - 0.5) ** 2;
    expect(german(project('closed', touching)).errors[0]).toMatch(
      /^Die Endleisteneinstellung lässt Ober- und Unterseite sich bei y = 0,0 mm, x = 50,0 % der Profiltiefe berühren \(Dicke \d,\d+ % der Profiltiefe\); der Flügel hätte dort die Dicke null\. Die Einstellung „Wie in den Profildateien“/,
    );
  });

  it('translates airfoil errors, and a cached airfoil error follows the language', () => {
    const p = sampleProject();
    p.airfoils = [{ id: 'c', name: 'coarse', points: coarse }];
    for (const s of p.sections) s.airfoil = 'c';
    const en = buildWing(p).errors[0];
    expect(en).toMatch(/^Airfoil "coarse": the NURBS curve through the points crosses itself near x = 10\d\.\d % chord/);
    // The same points hit the profile cache: the message is made again in the current language.
    expect(german(p).errors[0]).toMatch(/^Profil „coarse“: Die NURBS-Kurve durch die Punkte überschneidet sich selbst nahe x = 10\d,\d % der Profiltiefe; die Datei hat dort zu wenige Punkte\. Eine Datei mit mehr Punkten/);
    setLanguage('en');
    expect(buildWing(p).errors[0]).toBe(en);
    // A centripetal-less parametrization adds the hint.
    p.settings.parametrization = 'uniform';
    expect(german(p).errors[0]).toMatch(/ Die Einstellung „Zentripetal“ unter Einstellungen > Parametrisierung der Profile folgt den Punkten genauer\.$/);
    // profileProblem serves the airfoil preview, which capitalizes the first letter.
    setLanguage('de');
    const hook = [[1, 0.003], [0.8, 0.04], [0.66, 0.06], [0.58, 0.075], [0.62, 0.085], [0.4, 0.09], [0.2, 0.07], [0.05, 0.035], [0, 0], [0.05, -0.02], [0.2, -0.03], [0.5, -0.03], [0.8, -0.015], [1, -0.003]];
    expect(profileProblem(profileCurve(checkAirfoil(hook).points))).toMatch(/^Die Profilseite läuft in x um \d+,\d\d\d % der Profiltiefe zurück, nahe x = \d+,\d % der Profiltiefe; /);
  });

  it('keeps the profile stage of a good airfoil across a language switch', () => {
    const p = sampleProject();
    const first = buildWing(p);
    expect(first.errors).toEqual([]);
    const id = p.sections[0].airfoil;
    // Only entries with an error hold text; the fitted curve and the resampled shape are not made again.
    const fromGerman = german(p);
    expect(fromGerman.errors).toEqual([]);
    expect(fromGerman.profiles.get(id).compat).toBe(first.profiles.get(id).compat);
    setLanguage('en');
    expect(buildWing(p).profiles.get(id).compat).toBe(first.profiles.get(id).compat);
  });

  it('formats the loft grid limit with German digit grouping', () => {
    const p = sampleProject({ settings: { chordSamples: 200 } });
    const base = p.sections[0];
    const n = Math.ceil(LIMITS.maxGridPoints / 401) + 1;
    p.sections = Array.from({ length: n }, (_, i) => ({ ...base, id: `s${i}`, y: i }));
    const de = (v) => v.toLocaleString('de-DE');
    expect(de(1234)).toBe('1.234');
    expect(german(p).errors[0]).toBe(
      `Das Flächengitter braucht ${de(n * 401)} Punkte bei einer Station je Feld (${de(n)} Schnitte, 200 Stationen je Profilseite); die Grenze liegt bei ${de(LIMITS.maxGridPoints)}. Die Stationen je Profilseite verringern oder Schnitte entfernen.`,
    );
  });

  it('translates limit and non-finite errors', () => {
    expect(german(farGuides()).errors[0]).toBe(
      'Bei y = 0,0 mm verlässt der Flügel die Projektgrenzen (x der Profilnase 0 mm, z 0 mm, Profiltiefe 300.000 mm; Grenzen ±1.200.000 mm und 100.000 mm Profiltiefe). Die Leitkurven prüfen.',
    );
    const guide = sampleProject();
    guide.guides.end = { enabled: true, mode: 'fit', degree: 3, points: [[0, 0], [1_000_000, 0.1], [-1_000_000, 0.11], [1_000_000, 599.9], [0, 600]] };
    expect(german(guide).errors[0]).toMatch(/^Endlinie: Die Kurve durch die Punkte erreicht x = 7,\d\de\+13 mm, jenseits von ±1.200.000 mm; die Punkte in y gleichmäßiger verteilen oder den Modus „Kontrollpunkte“ verwenden\.$/);
    expect(german(overflow()).errors[0]).toMatch(/^Die Schnittwerte ergeben bei y = 0,0 mm nicht endliche Koordinaten; Positionen, Profiltiefen und Schränkungen der Schnitte prüfen\.$/);
  });

  it('translates the trailing-edge warnings', () => {
    const thick = german(sampleProject({ settings: { trailingEdge: { mode: 'thickness', thickness: 8.5 } } }));
    expect(thick.warnings).toEqual(['Die Endleistendicke 8,5 mm übersteigt 5 % der Profiltiefe an 1 Station; dort wird sie auf 5 % begrenzt.']);
    const mixed = sampleProject();
    mixed.airfoils[1] = naca('0010', 'tip', { closedTE: true });
    expect(german(mixed).warnings).toEqual(['Die Endleiste ist an manchen Stationen geschlossen und an anderen offen; 1 Station wurde auf 0,01 mm geöffnet.']);
  });

  it('puts the station warnings in the singular and the plural', () => {
    setLanguage('de');
    const thick = (stations) =>
      tr('Trailing-edge thickness {thickness} mm exceeds {percent} % of the chord at {stations} station(s); it is limited to {percent} % there.', { thickness: '8,5', percent: '5', stations });
    expect([thick('1'), thick('4')]).toEqual([
      'Die Endleistendicke 8,5 mm übersteigt 5 % der Profiltiefe an 1 Station; dort wird sie auf 5 % begrenzt.',
      'Die Endleistendicke 8,5 mm übersteigt 5 % der Profiltiefe an 4 Stationen; dort wird sie auf 5 % begrenzt.',
    ]);
    const opened = (stations) => tr('The trailing edge is closed on some stations and open on others; {stations} station(s) were opened to {gap} mm.', { stations, gap: '0,01' });
    expect([opened('1'), opened('3')]).toEqual([
      'Die Endleiste ist an manchen Stationen geschlossen und an anderen offen; 1 Station wurde auf 0,01 mm geöffnet.',
      'Die Endleiste ist an manchen Stationen geschlossen und an anderen offen; 3 Stationen wurden auf 0,01 mm geöffnet.',
    ]);
    const added = (stations) => tr('The loft deviates up to {dev} mm from the intended surface at y = {y} mm after {stations} added station(s); raise the spanwise stations per panel.', { dev: '3,1', y: '713,0', stations });
    expect([added('1'), added('32')]).toEqual([
      'Die Fläche weicht nach 1 hinzugefügten Station bei y = 713,0 mm um bis zu 3,1 mm von der vorgesehenen Fläche ab; die Stationen je Feld erhöhen.',
      'Die Fläche weicht nach 32 hinzugefügten Stationen bei y = 713,0 mm um bis zu 3,1 mm von der vorgesehenen Fläche ab; die Stationen je Feld erhöhen.',
    ]);
  });

  it('translates the fitted-surface errors and the deviation warning', () => {
    // Zigzag degree-5 control guides that 32 added stations cannot follow: trial 26 folds, trial 2 turns inside out.
    const zigzag = (trial) => {
      let seed = 9;
      const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      let guides = null;
      for (let t = 0; t <= trial; t++) {
        const n = 20 + Math.floor(rnd() * 70);
        const ys = Array.from({ length: n }, (_, i) => (600 * i) / (n - 1));
        const nose = ys.map((y, i) => [(i % 2 ? 60 : 0) * rnd() + 20 * rnd(), y]);
        const end = ys.map((y, i) => [nose[i][0] + 1 + 100 * rnd() * rnd(), y]);
        guides = { nose: { enabled: true, mode: 'control', degree: 5, points: nose }, end: { enabled: true, mode: 'control', degree: 5, points: end } };
      }
      const p = sampleProject();
      p.guides = guides;
      return p;
    };
    expect(german(zigzag(26)).errors[0]).toMatch(
      /^Die angepasste Fläche faltet sich oder schnürt sich zwischen den Stationen bei y = \d+,\d mm ein \(Profiltiefe -?\d+,\d\d mm in der vorgesehenen Profiltiefenrichtung, Minimum 1 mm\): Schränkung oder Leitkurven ändern sich schneller, als 32 hinzugefügte Stationen auflösen\. Schnitte hinzufügen, den Schränkungsunterschied verringern oder die Leitkurven glätten\.$/,
    );
    expect(german(zigzag(2)).errors[0]).toMatch(
      /^Die angepasste Fläche stülpt sich zwischen den Stationen bei y = \d+,\d mm um \(örtliche Dicke -\d+,\d\d\d % der Profiltiefe\): Die Fläche durch die Stationen schwingt zwischen ihnen aus \(schnell veränderliche Leitkurven\)\. Die Leitkurven glätten oder Schnitte hinzufügen\.$/,
    );
    // A nose line with a bump 4 mm high and 0.06 mm wide at y = 713 mm.
    const p = createProject({ airfoils: [{ id: 'a', name: 'NACA 2412', points: nacaAirfoil('2412').points }], sections: [0, 1000].map((y) => ({ airfoil: 'a', x: 0, y, z: 0, chord: 200, twist: 0 })) });
    p.guides = defaultGuides(p.sections);
    const line = [];
    for (let y = 0; y <= 1000; y += 50) if (y < 712 || y > 714) line.push([0, y]);
    const bump = [[0, 712.97], [1, 712.98], [3, 712.99], [4, 713], [3, 713.01], [1, 713.02], [0, 713.03]];
    p.guides.nose = { enabled: true, mode: 'control', degree: 3, points: [...line, ...bump].sort((a, b) => a[1] - b[1]) };
    const b = german(p);
    expect(b.errors).toEqual([]);
    expect(b.warnings.find((w) => w.startsWith('Die Fläche weicht'))).toMatch(/^Die Fläche weicht (ohne hinzugefügte Stationen|nach \d+ hinzugefügten Stationen) bei y = 713,0 mm um bis zu 3,\d\d mm von der vorgesehenen Fläche ab; die Stationen je Feld erhöhen\.$/);
  });

  it('gives the same English messages after a round trip through German', () => {
    const p = sampleProject();
    p.sections[0].y = -5.5;
    const en = buildWing(p).errors;
    setLanguage('de');
    buildWing(p);
    setLanguage('en');
    expect(buildWing(p).errors).toEqual(en);
    expect(en).toEqual(['Section at y = -5.5 mm lies on the mirrored side; the half wing spans y >= 0.']);
  });
});
