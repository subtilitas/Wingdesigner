import { describe, expect, it } from 'vitest';
import {
  averagingKnots,
  basisFuns,
  collocationFactor,
  collocationMatrix,
  collocationSolve,
  curveDerivatives,
  curvePoint,
  dersBasisFuns,
  dist,
  findSpan,
  insertKnotCurve,
  interpolateCurve,
  interpolateSurface,
  knotMultiplicities,
  normalizeKnots,
  parametrize,
  solveMonotonic,
  splitCurve,
  splitSurfaceU,
  surfaceBoundaryU,
  surfaceBoundaryV,
  surfaceDerivatives1,
  surfacePoint,
} from '../src/geom/nurbs.js';
import { bandFactor, luFactor, luSolve, solve } from '../src/geom/linalg.js';

const U = [0, 0, 0, 0, 0.2, 0.45, 0.7, 1, 1, 1, 1];
const n = U.length - 3 - 2; // 6 control points -> n = 5

function lcg(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

describe('basis functions', () => {
  it('finds spans including the end parameter', () => {
    expect(findSpan(n, 3, 0, U)).toBe(3);
    expect(findSpan(n, 3, 0.3, U)).toBe(4);
    expect(findSpan(n, 3, 0.45, U)).toBe(5);
    expect(findSpan(n, 3, 1, U)).toBe(n);
  });

  it('form a partition of unity', () => {
    const rnd = lcg(1);
    for (let k = 0; k < 50; k++) {
      const u = rnd();
      const N = basisFuns(findSpan(n, 3, u, U), u, 3, U);
      expect(N.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
      for (const v of N) expect(v).toBeGreaterThanOrEqual(-1e-15);
    }
  });

  it('derivatives match finite differences', () => {
    const h = 1e-6;
    for (const u of [0.1, 0.33, 0.5, 0.9]) {
      const span = findSpan(n, 3, u, U);
      const d = dersBasisFuns(span, u, 3, 2, U);
      const Np = basisFuns(span, u + h, 3, U);
      const Nm = basisFuns(span, u - h, 3, U);
      for (let j = 0; j <= 3; j++) {
        expect(d[0][j]).toBeCloseTo(basisFuns(span, u, 3, U)[j], 12);
        expect(d[1][j]).toBeCloseTo((Np[j] - Nm[j]) / (2 * h), 5);
      }
      // Derivatives of a partition of unity sum to zero.
      expect(d[1].reduce((a, b) => a + b, 0)).toBeCloseTo(0, 10);
      expect(d[2].reduce((a, b) => a + b, 0)).toBeCloseTo(0, 8);
    }
  });
});

describe('curves', () => {
  it('evaluates a rational quarter circle exactly', () => {
    const c = {
      degree: 2,
      knots: [0, 0, 0, 1, 1, 1],
      points: [
        [1, 0],
        [1, 1],
        [0, 1],
      ],
      weights: [1, Math.SQRT1_2, 1],
    };
    for (let k = 0; k <= 20; k++) {
      const P = curvePoint(c, k / 20);
      expect(Math.hypot(P[0], P[1])).toBeCloseTo(1, 12);
    }
    // Rational derivative is tangent to the circle and matches finite differences.
    const u = 0.37;
    const [P, D1] = curveDerivatives(c, u, 1);
    expect(P[0] * D1[0] + P[1] * D1[1]).toBeCloseTo(0, 10);
    const h = 1e-6;
    const a = curvePoint(c, u + h);
    const b = curvePoint(c, u - h);
    expect(D1[0]).toBeCloseTo((a[0] - b[0]) / (2 * h), 5);
    expect(D1[1]).toBeCloseTo((a[1] - b[1]) / (2 * h), 5);
  });

  it('interpolates through the data points for every parametrization and degree', () => {
    const pts = [
      [0, 0, 0],
      [1, 2, 0.5],
      [2.5, 2.2, 1],
      [4, 0.5, 0],
      [5, -1, -1],
      [7, 0, 0],
    ];
    for (const method of ['uniform', 'chord', 'centripetal']) {
      for (const p of [1, 2, 3, 5, 9]) {
        const c = interpolateCurve(pts, p, { parametrization: method });
        expect(c.degree).toBe(Math.min(p, pts.length - 1));
        c.params.forEach((t, k) => {
          const P = curvePoint(c, t);
          expect(dist(P, pts[k])).toBeLessThan(1e-10);
        });
      }
    }
  });

  it('computes averaging knots with the expected structure', () => {
    const params = parametrize(
      [
        [0, 0],
        [1, 0],
        [3, 0],
        [4, 0],
        [8, 0],
      ],
      'chord',
    );
    expect(params).toEqual([0, 0.125, 0.375, 0.5, 1]);
    const K = averagingKnots(params, 3);
    expect(K.length).toBe(5 + 3 + 1);
    expect(K.slice(0, 4)).toEqual([0, 0, 0, 0]);
    expect(K[4]).toBeCloseTo((0.125 + 0.375 + 0.5) / 3, 14);
    expect(K.slice(5)).toEqual([1, 1, 1, 1]);
  });

  it('handles degenerate parametrizations', () => {
    expect(parametrize([[1, 1]])).toEqual([0]);
    expect(parametrize([[0, 0], [0, 0], [0, 0]])).toEqual([0, 0.5, 1]);
    expect(() => interpolateCurve([[0, 0]])).toThrow();
  });

  it('computes derivatives of non-rational curves', () => {
    const c = interpolateCurve(
      [
        [0, 0],
        [1, 1],
        [2, 0],
        [3, 1],
      ],
      3,
    );
    const u = 0.42;
    const [P, D1, D2, D3, D4] = curveDerivatives(c, u, 4);
    const h = 1e-5;
    const a = curvePoint(c, u + h);
    const b = curvePoint(c, u - h);
    expect(dist(P, curvePoint(c, u))).toBeLessThan(1e-14);
    expect(D1[0]).toBeCloseTo((a[0] - b[0]) / (2 * h), 5);
    expect(D2[1]).toBeCloseTo((a[1] - 2 * P[1] + b[1]) / (h * h), 2);
    expect(D3.length).toBe(2);
    expect(D4).toEqual([0, 0]);
  });

  it('keeps geometry under knot insertion and splits curves exactly', () => {
    const c = interpolateCurve(
      [
        [0, 0],
        [1, 2],
        [3, 3],
        [4, 1],
        [6, 0],
        [7, 2],
      ],
      3,
    );
    const ins = insertKnotCurve(c, 0.31, 2);
    expect(ins.points.length).toBe(c.points.length + 2);
    for (let k = 0; k <= 30; k++) {
      expect(dist(curvePoint(ins, k / 30), curvePoint(c, k / 30))).toBeLessThan(1e-12);
    }
    // Inserting beyond the degree is clamped.
    const full = insertKnotCurve(ins, 0.31, 5);
    expect(full.points.length).toBe(c.points.length + 3);
    expect(insertKnotCurve(full, 0.31, 1).points.length).toBe(full.points.length);

    const u = 0.43;
    const [l, r] = splitCurve(c, u);
    const Pu = curvePoint(c, u);
    expect(dist(curvePoint(l, 1), Pu)).toBeLessThan(1e-12);
    expect(dist(curvePoint(r, 0), Pu)).toBeLessThan(1e-12);
    for (let k = 0; k <= 10; k++) {
      const t = k / 10;
      expect(dist(curvePoint(l, t), curvePoint(c, t * u))).toBeLessThan(1e-9);
      expect(dist(curvePoint(r, t), curvePoint(c, u + t * (1 - u)))).toBeLessThan(1e-9);
    }
    expect(() => splitCurve(c, 0)).toThrow();
  });

  it('splits at an existing knot', () => {
    const c = interpolateCurve(
      [
        [0, 0],
        [1, 2],
        [3, 3],
        [4, 1],
        [6, 0],
      ],
      2,
    );
    const u = c.knots[3];
    const [l, r] = splitCurve(c, u);
    expect(dist(curvePoint(l, 1), curvePoint(r, 0))).toBeLessThan(1e-12);
  });
});

describe('surfaces', () => {
  const grid = [];
  const pu = [0, 0.15, 0.4, 0.5, 0.6, 0.85, 1];
  const pv = [0, 0.3, 0.7, 1];
  for (let i = 0; i < pu.length; i++) {
    const row = [];
    for (let j = 0; j < pv.length; j++) {
      const u = pu[i];
      const v = pv[j];
      row.push([Math.cos(Math.PI * 2 * u) * (1 - 0.3 * v), 2 * v, Math.sin(Math.PI * 2 * u) * 0.2 * (1 + v)]);
    }
    grid.push(row);
  }

  it('interpolates a grid exactly', () => {
    const s = interpolateSurface(grid, 3, 3, pu, pv);
    for (let i = 0; i < pu.length; i++) {
      for (let j = 0; j < pv.length; j++) {
        expect(dist(surfacePoint(s, pu[i], pv[j]), grid[i][j])).toBeLessThan(1e-10);
      }
    }
  });

  it('evaluates rational surfaces and first derivatives', () => {
    const s = interpolateSurface(grid, 3, 2, pu, pv);
    const w = s.points.map((row) => row.map(() => 1));
    const r = { ...s, weights: w };
    expect(dist(surfacePoint(r, 0.3, 0.6), surfacePoint(s, 0.3, 0.6))).toBeLessThan(1e-12);
    expect(() => surfaceDerivatives1(r, 0.1, 0.1)).toThrow();
    const { point, du, dv } = surfaceDerivatives1(s, 0.33, 0.61);
    const h = 1e-6;
    const a = surfacePoint(s, 0.33 + h, 0.61);
    const b = surfacePoint(s, 0.33 - h, 0.61);
    const c = surfacePoint(s, 0.33, 0.61 + h);
    const d = surfacePoint(s, 0.33, 0.61 - h);
    expect(dist(point, surfacePoint(s, 0.33, 0.61))).toBeLessThan(1e-14);
    for (let k = 0; k < 3; k++) {
      expect(du[k]).toBeCloseTo((a[k] - b[k]) / (2 * h), 5);
      expect(dv[k]).toBeCloseTo((c[k] - d[k]) / (2 * h), 5);
    }
  });

  it('splits along u and exposes exact boundary curves', () => {
    const s = interpolateSurface(grid, 3, 3, pu, pv);
    const [a, b] = splitSurfaceU(s, 0.5);
    for (const v of [0, 0.25, 0.8, 1]) {
      expect(dist(surfacePoint(a, 1, v), surfacePoint(s, 0.5, v))).toBeLessThan(1e-12);
      expect(dist(surfacePoint(b, 0, v), surfacePoint(s, 0.5, v))).toBeLessThan(1e-12);
      expect(dist(surfacePoint(a, 0.5, v), surfacePoint(s, 0.25, v))).toBeLessThan(1e-9);
      // Boundary iso-curves equal the surface boundary.
      expect(dist(curvePoint(surfaceBoundaryU(a, true), v), surfacePoint(a, 1, v))).toBeLessThan(1e-12);
      expect(dist(curvePoint(surfaceBoundaryU(b, false), v), surfacePoint(b, 0, v))).toBeLessThan(1e-12);
    }
    for (const u of [0, 0.3, 1]) {
      expect(dist(curvePoint(surfaceBoundaryV(s, false), u), surfacePoint(s, u, 0))).toBeLessThan(1e-12);
      expect(dist(curvePoint(surfaceBoundaryV(s, true), u), surfacePoint(s, u, 1))).toBeLessThan(1e-12);
    }
  });
});

describe('utilities', () => {
  it('compresses knot vectors', () => {
    expect(knotMultiplicities([0, 0, 0, 0.5, 0.5, 1, 1, 1])).toEqual({ knots: [0, 0.5, 1], mults: [3, 2, 3] });
    expect(normalizeKnots([2, 2, 3, 4, 4])).toEqual([0, 0, 0.5, 1, 1]);
  });

  it('solves linear systems and rejects singular ones', () => {
    const x = solve(
      [
        [0, 2, 1],
        [1, 1, 0],
        [3, 0, 1],
      ],
      [5, 3, 6],
    );
    expect(x[0]).toBeCloseTo(1.4, 12);
    expect(x[1]).toBeCloseTo(1.6, 12);
    expect(x[2]).toBeCloseTo(1.8, 12);
    expect(() =>
      solve(
        [
          [1, 2],
          [2, 4],
        ],
        [1, 2],
      ),
    ).toThrow();
  });

  it('inverts monotonic functions', () => {
    expect(solveMonotonic((t) => t * t * t, 0.125)).toBeCloseTo(0.5, 10);
    expect(solveMonotonic((t) => -t, -0.25)).toBeCloseTo(0.25, 10);
    expect(solveMonotonic((t) => t, 0)).toBe(0);
    expect(solveMonotonic((t) => t, 1)).toBe(1);
    expect(solveMonotonic((t) => t, 2)).toBe(1);
  });
});

describe('split at a knot within round-off', () => {
  it('snaps to the existing knot so the end multiplicity stays p + 1', () => {
    const c = interpolateCurve(
      [
        [0, 0],
        [1, 2],
        [3, 3],
        [4, 1],
        [6, 0],
        [7, 2],
      ],
      3,
    );
    const k = c.knots[4];
    const [l, r] = splitCurve(c, k - 2e-16);
    const lm = knotMultiplicities(l.knots, 1e-12);
    const rm = knotMultiplicities(r.knots, 1e-12);
    expect(lm.mults[lm.mults.length - 1]).toBe(4);
    expect(rm.mults[0]).toBe(4);
    expect(dist(curvePoint(l, 1), curvePoint(r, 0))).toBeLessThan(1e-12);
  });
});

describe('band collocation solver', () => {
  it('matches the dense LU solution for degrees 1 to 5', () => {
    let seed = 11;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let p = 1; p <= 5; p++) {
      const n = 40;
      const pts = Array.from({ length: n }, (_, i) => [i + rnd(), Math.sin(i / 3) + rnd() * 0.1]);
      const t = parametrize(pts, 'centripetal');
      const U = averagingKnots(t, p);
      const b = pts.map((q) => q[1]);
      const dense = luSolve(luFactor(collocationMatrix(t, p, U)), b);
      const band = collocationSolve(collocationFactor(t, p, U), b);
      for (let i = 0; i < n; i++) expect(band[i]).toBeCloseTo(dense[i], 10);
    }
  });

  it('solves a 5000-point interpolation in linear time', () => {
    const pts = Array.from({ length: 5000 }, (_, i) => [Math.cos((2 * Math.PI * i) / 5000), Math.sin((2 * Math.PI * i) / 5000)]);
    const t0 = performance.now();
    const c = interpolateCurve(pts, 3, { parametrization: 'centripetal' });
    expect(performance.now() - t0).toBeLessThan(2000);
    expect(dist(curvePoint(c, c.params[1234]), pts[1234])).toBeLessThan(1e-9);
  });

  it('reports a zero pivot', () => {
    expect(() => bandFactor([{ start: 0, values: [0] }])).toThrow(/zero pivot/);
  });
});
