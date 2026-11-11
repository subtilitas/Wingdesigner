// Mold halves (src/geom/mold.js, src/export/moldstep.js): the checks of the parameters, the offset of
// the outline, the half-round groove, the geometry of the halves (frame, block, the parting surface that
// is level in flight direction, resin channel, holes), the under-cambered airfoil whose lower surface
// lies above the parting surface, and the STEP solids.
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildWing } from '../src/geom/wing.js';
import { curvePoint, surfacePoint } from '../src/geom/nurbs.js';
import { roundTipStart } from '../src/geom/tipblend.js';
import { HOLE_PATTERNS, MOLD_CLEARANCE, MOLD_OVERHANG, MOLD_DEFAULTS, MOLD_HALVES, MOLD_RANGES, grooveSurface, moldGeometry, moldProblems, offsetOutline, partingSurface, resolveMold } from '../src/geom/mold.js';
import { Brep, moldToStep } from '../src/export/moldstep.js';
import { StepWriter } from '../src/export/step.js';
import { addRoundTip, defaultRoundTip } from '../src/model/roundtip.js';
import { PRESETS, wizardProject } from '../src/model/wizard.js';
import { setLanguage } from '../src/i18n/index.js';
import { createProject } from '../src/model/project.js';
import { flatWing, moldCases, sweptTwistedWing, undercamberedWing } from './mold-cases.js';
import { naca, sampleProject } from './helpers.js';

const DEG = Math.PI / 180;
const STAMP = { timestamp: '2026-01-01T00:00:00' };

afterEach(() => setLanguage('en'));

const built = (project) => {
  const b = buildWing(project);
  expect(b.errors).toEqual([]);
  return b;
};
const geometry = (build, mold = {}) => {
  const g = moldGeometry(build, mold);
  expect(g.errors).toEqual([]);
  return g;
};
const rounded = (p) => {
  addRoundTip(p, defaultRoundTip(p));
  return p;
};
const preset = (key) => wizardProject(PRESETS[key].params);

/** Distance of q from a polyline (closed: the last point joins the first). */
function polylineDistance(q, poly, closed = false) {
  let best = Infinity;
  const n = poly.length;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const a = poly[i];
    const b = poly[(i + 1) % n];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l2 = dx * dx + dy * dy;
    const t = l2 > 0 ? Math.min(1, Math.max(0, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / l2)) : 0;
    best = Math.min(best, Math.hypot(q[0] - a[0] - t * dx, q[1] - a[1] - t * dy));
  }
  return best;
}

/** Radius of the circle through three plane points (Infinity on a straight line). */
function circumradius(a, b, c) {
  const area = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
  return area > 1e-12 ? (Math.hypot(b[0] - a[0], b[1] - a[1]) * Math.hypot(c[0] - b[0], c[1] - b[1]) * Math.hypot(c[0] - a[0], c[1] - a[1])) / (2 * area) : Infinity;
}

/** Points of a closed polygon every `step` mm along its edges. */
function densify(poly, step) {
  const out = [];
  poly.forEach((a, i) => {
    const b = poly[(i + 1) % poly.length];
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let k = 0; k < n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  });
  return out;
}

/**
 * The wing outline in the top view of the mold frame, from dense samples of leading edge and trailing
 * edge (4,000 per edge), mirrored at the root line y = yR: a closed polygon, clockwise seen from above.
 */
function outlineOf(g) {
  const { le, mid } = g.halves.lower;
  const half = [];
  for (let k = 0; k <= 4000; k++) half.push(curvePoint(le, k / 4000).slice(0, 2));
  for (let k = 4000; k >= 0; k--) half.push(curvePoint(mid, k / 4000).slice(0, 2));
  const yR = g.common.block.y0;
  return [...half, ...half.slice(1, -1).reverse().map((P) => [P[0], 2 * yR - P[1]])];
}

/** z of a cavity surface at x along its row v, by bisection on u (x grows with u from the leading edge). */
function zAt(S, x, v) {
  let lo = 0;
  let hi = 1;
  for (let it = 0; it < 60; it++) {
    const m = (lo + hi) / 2;
    if (surfacePoint(S, m, v)[0] < x) lo = m;
    else hi = m;
  }
  return surfacePoint(S, (lo + hi) / 2, v)[2];
}

/** The largest distance of two points. */
const gap = (P, Q) => Math.max(...P.slice(0, 3).map((c, i) => Math.abs(c - Q[i])));

/** The surfaces of the parting surface of a half: one with a flat tip, front and back with a pole tip. */
const partingSurfaces = (half) => (half.parting.kind === 'flat' ? [half.parting.surface] : [half.parting.front, half.parting.back]);

/**
 * Height of a parting surface above (x, y), found on the surfaces themselves and not with the code of
 * src/geom/mold.js: each surface is of degree 1 along u, so between two neighbouring rows A(v) and B(v)
 * every line v = const is the straight segment from A(v) to B(v). The station v whose segment passes
 * through (x, y) is bracketed on a table of 500 steps and refined by 50 bisections; z follows along
 * the segment. Returns null where (x, y) lies on no segment.
 */
function heightOn(surfaces) {
  const N = 500;
  const pairs = [];
  for (const S of surfaces) {
    for (let i = 0; i + 1 < S.points.length; i++) {
      const A = { degree: S.degreeV, knots: S.knotsV, points: S.points[i] };
      const B = { degree: S.degreeV, knots: S.knotsV, points: S.points[i + 1] };
      pairs.push({ A, B, table: Array.from({ length: N + 1 }, (_, k) => [curvePoint(A, k / N), curvePoint(B, k / N)]) });
    }
  }
  const cross = (a, b, x, y) => (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]);
  const along = (a, b, x, y) => {
    const l2 = (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2;
    return l2 > 0 ? ((x - a[0]) * (b[0] - a[0]) + (y - a[1]) * (b[1] - a[1])) / l2 : 0;
  };
  return (x, y) => {
    for (const { A, B, table } of pairs) {
      let prev = cross(table[0][0], table[0][1], x, y);
      for (let k = 1; k <= N; k++) {
        const cur = cross(table[k][0], table[k][1], x, y);
        if (prev === 0 || prev < 0 !== cur < 0 || cur === 0) {
          let lo = (k - 1) / N;
          let hi = k / N;
          const sLo = prev < 0;
          for (let it = 0; it < 50; it++) {
            const m = (lo + hi) / 2;
            if (cross(curvePoint(A, m), curvePoint(B, m), x, y) < 0 === sLo) lo = m;
            else hi = m;
          }
          const v = (lo + hi) / 2;
          const a = curvePoint(A, v);
          const b = curvePoint(B, v);
          const t = along(a, b, x, y);
          if (t >= -1e-9 && t <= 1 + 1e-9 && Math.hypot(a[0] + t * (b[0] - a[0]) - x, a[1] + t * (b[1] - a[1]) - y) < 1e-7) return a[2] + t * (b[2] - a[2]);
        }
        prev = cur;
      }
    }
    return null;
  };
}

/** Coordinates of every CARTESIAN_POINT of a STEP text. */
const stepPoints = (text) => [...text.matchAll(/CARTESIAN_POINT\('',\(([^)]*)\)\)/g)].map((m) => m[1].split(',').map(Number));
const countOf = (text, entity) => text.split(`=${entity}(`).length - 1;

/** STEP text of a mold and the number of faces written on its parting surfaces. */
function stepWithFaces(g, options = {}) {
  const spy = vi.spyOn(Brep.prototype, 'surfaceFace');
  try {
    const text = moldToStep(g, { ...STAMP, ...options });
    const surfaces = new Set(['lower', 'upper'].flatMap((key) => partingSurfaces(g.halves[key])));
    return { text, partingFaces: spy.mock.calls.filter(([S]) => surfaces.has(S)).length };
  } finally {
    spy.mockRestore();
  }
}

describe('mold parameters', () => {
  it('fill every missing key with its default, also inside the channel, pin and screw groups', () => {
    expect(resolveMold()).toEqual({ ...MOLD_DEFAULTS, channel: { ...MOLD_DEFAULTS.channel }, pins: { ...MOLD_DEFAULTS.pins }, screws: { ...MOLD_DEFAULTS.screws } });
    const p = resolveMold({ margin: 60, pins: { diameter: 5 }, channel: true });
    expect(p.margin).toBe(60);
    expect(p.pins).toEqual({ ...MOLD_DEFAULTS.pins, diameter: 5 });
    // A group that is no object falls back to its defaults.
    expect(p.channel).toEqual(MOLD_DEFAULTS.channel);
    expect([HOLE_PATTERNS, MOLD_HALVES, MOLD_CLEARANCE]).toEqual([['corners', 'frame', 'outline'], ['both', 'lower', 'upper'], 1]);
    expect(Object.keys(MOLD_DEFAULTS)).toEqual(['margin', 'floor', 'channel', 'pins', 'screws', 'halves', 'left']);
    expect(moldProblems({})).toEqual([]);
  });

  it('refuse every value below or above its range, and a value that is no number, and skip a group that is off', () => {
    const names = {
      margin: 'block margin',
      floor: 'floor thickness',
      'channel.diameter': 'resin channel diameter',
      'channel.distance': 'resin channel distance',
      'pins.diameter': 'pin diameter',
      'pins.depth': 'pin hole depth',
      'pins.spacing': 'pin spacing',
      'pins.edge': 'pin edge distance',
      'pins.offset': 'pin distance',
      'screws.diameter': 'screw hole diameter',
      'screws.spacing': 'screw spacing',
      'screws.edge': 'screw edge distance',
      'screws.offset': 'screw distance',
    };
    expect(Object.keys(MOLD_RANGES)).toEqual(Object.keys(names));
    const set = (key, value) => {
      const [a, b] = key.split('.');
      return b ? { [a]: { [b]: value } } : { [a]: value };
    };
    // The values at the ends of each range pass when no other check takes them up.
    const quiet = { channel: { distance: 500 }, pins: { pattern: 'frame' }, screws: { pattern: 'frame' } };
    for (const [key, [lo, hi]] of Object.entries(MOLD_RANGES)) {
      const message = [`Mold: ${names[key]} must be between ${lo} and ${hi} mm.`];
      for (const bad of [lo - 0.01, hi + 0.01, Number.NaN, String(lo)]) expect(moldProblems(set(key, bad)), `${key} ${bad}`).toEqual(message);
      for (const good of [lo, hi]) {
        const [a, b] = key.split('.');
        const input = b ? { ...quiet, [a]: { ...quiet[a], [b]: good } } : { ...quiet, [a]: good };
        expect(moldProblems(input).filter((m) => !/edge distance/.test(m)), `${key} ${good}`).toEqual([]);
      }
      const [group, sub] = key.split('.');
      if (sub) expect(moldProblems({ [group]: { on: false, [sub]: -1 } }), key).toEqual([]);
    }
  });

  it('refuse an unknown hole pattern and unknown halves, and stop there before the combined checks', () => {
    expect(moldProblems({ pins: { pattern: 'ring' } })).toEqual(['Mold: the hole pattern must be "corners", "frame" or "outline".']);
    expect(moldProblems({ pins: { on: false, pattern: 'ring' } })).toEqual([]);
    expect(moldProblems({ halves: 'left' })).toEqual(['Mold: halves must be "both", "lower" or "upper".']);
    expect(moldProblems({ halves: 'left', pins: { pattern: 'outline', offset: 1 } })).toEqual(['Mold: halves must be "both", "lower" or "upper".']);
  });

  it('accept a stored ramp width of any value without a problem', () => {
    for (const ramp of [10, 0, -1, 1e6, 'wide', null]) expect(moldProblems({ ramp }), String(ramp)).toEqual([]);
    expect(moldProblems({ ramp: 10, channel: { distance: 1 } })).toEqual([]);
  });

  it('keep the holes of the outline pattern and the edge distance at least the hole radius plus 1 mm', () => {
    // Pins 6 mm: radius 3 mm plus 1 mm; screws 6.5 mm: 3.25 mm plus 1 mm.
    expect(moldProblems({ pins: { pattern: 'outline', offset: 3.9 }, screws: { pattern: 'outline', offset: 4.2 } })).toEqual([
      'Mold: the pin distance must be at least 4 mm, the hole radius plus 1 mm.',
      'Mold: the screw distance must be at least 4.25 mm, the hole radius plus 1 mm.',
    ]);
    expect(moldProblems({ pins: { pattern: 'outline', offset: 4, edge: 2 }, screws: { pattern: 'outline', offset: 4.25, edge: 2 } })).toEqual([]);
    expect(moldProblems({ pins: { edge: 3.9 }, screws: { edge: 4.2 } })).toEqual([
      'Mold: the pin edge distance must be at least 4 mm, the hole radius plus 1 mm.',
      'Mold: the screw edge distance must be at least 4.25 mm, the hole radius plus 1 mm.',
    ]);
    expect(moldProblems({ pins: { edge: 4 }, screws: { edge: 4.25 } })).toEqual([]);
  });

  it('report the same problems in German', () => {
    setLanguage('de');
    expect(moldProblems({ margin: 4 })).toEqual(['Form: Rand des Formblocks muss zwischen 5 und 1000 mm liegen.']);
    expect(moldProblems({ screws: { diameter: 51 } })).toEqual(['Form: Durchmesser der Schraubenbohrungen muss zwischen 1 und 50 mm liegen.']);
    expect(moldProblems({ pins: { pattern: 'ring' } })).toEqual(['Form: Das Bohrmuster muss "corners", "frame" oder "outline" sein.']);
    expect(moldProblems({ halves: 'left' })).toEqual(['Form: halves muss "both", "lower" oder "upper" sein.']);
    expect(moldProblems({ pins: { pattern: 'outline', offset: 3.9 }, screws: { edge: 4.2 } })).toEqual([
      'Form: Der Abstand der Zentrierbohrungen von der Blutrinne muss mindestens 4 mm betragen, der Bohrungsradius plus 1 mm.',
      'Form: Der Abstand der Schraubenbohrungen von der Blockkante muss mindestens 4,25 mm betragen, der Bohrungsradius plus 1 mm.',
    ]);
  });
});

describe('offset of the outline', () => {
  it('keeps every point of a square at the distance and rounds its outward corners with that radius', () => {
    // A 10 mm square, clockwise seen from above (the outside to the left of its direction), offset by 2 mm.
    const square = [
      [0, 0],
      [0, 10],
      [10, 10],
      [10, 0],
    ];
    const path = offsetOutline(square, 2, 1);
    expect(path.length).toBeGreaterThan(4 * 39);
    for (const P of path) expect(Math.abs(polylineDistance(P, square, true) - 2)).toBeLessThan(1e-9);
    // Around each corner a quarter circle of radius 2 mm in steps of at most 0.04 rad: no point near
    // the sharp corner of the offset square, 2·√2 − 2 = 0.83 mm beyond the arc.
    for (const [cx, cy, sx, sy] of [
      [0, 0, -1, -1],
      [0, 10, -1, 1],
      [10, 10, 1, 1],
      [10, 0, 1, -1],
    ]) {
      const sharp = [cx + 2 * sx, cy + 2 * sy];
      expect(Math.min(...path.map((P) => Math.hypot(P[0] - sharp[0], P[1] - sharp[1])))).toBeGreaterThan(2 * Math.SQRT2 - 2 - 1e-3);
      const onArc = path.filter((P) => (P[0] - cx) * sx > 0 && (P[1] - cy) * sy > 0);
      expect(onArc.length).toBeGreaterThanOrEqual(Math.ceil(Math.PI / 2 / 0.04) - 1);
    }
  });

  it('rounds the inward corner of an L-shape with an arc of radius rho, sparse or sampled every 0.25 mm', () => {
    // L of 20 × 20 mm with the inward corner at (10, 10); offset 3 mm, rounding 1.5 mm: the corner of
    // the 4.5 mm offset at X = (14.5, 14.5) is the centre of the arc.
    const L = [
      [0, 0],
      [0, 20],
      [10, 20],
      [10, 10],
      [20, 10],
      [20, 0],
    ];
    for (const poly of [L, densify(L, 0.25)]) {
      const label = `${poly.length} points`;
      const path = offsetOutline(poly, 3, 1.5);
      // Every point at least the distance from the polygon; the fans around the outward corners lie
      // on chords of 0.04 rad, 3 · (1 − cos 0.02) = 0.0006 mm inside their arcs, the cut-off of the
      // dropped offset is 0.02 mm: 0.03 mm in all.
      for (const P of path) expect(polylineDistance(P, L, true), label).toBeGreaterThan(3 - 0.03);
      const arc = path.filter((P) => P[0] > 12.9 && P[1] > 12.9 && P[0] < 14.5 && P[1] < 14.5);
      expect(arc.length, label).toBeGreaterThan(30);
      for (const P of arc) expect(Math.abs(Math.hypot(P[0] - 14.5, P[1] - 14.5) - 1.5), label).toBeLessThan(1e-9);
      // The smallest radius of curvature, from the circle through each point and its two neighbours:
      // 1.5 mm on the arc, 3 mm on the fans, more at the joints of arc and straight pieces. Points
      // on one circle give its radius to rounding error; 1e-6 mm covers it.
      let smallest = Infinity;
      for (let i = 0; i < path.length; i++) smallest = Math.min(smallest, circumradius(path[(i - 1 + path.length) % path.length], path[i], path[(i + 1) % path.length]));
      expect(smallest, label).toBeGreaterThan(1.5 - 1e-6);
      expect(smallest, label).toBeLessThan(1.5 + 1e-6);
    }
  });
});

describe('groove of the resin channel', () => {
  // A U-shaped path, clockwise seen from above: up x = 0 from the root (y = 0) to y = 50, a quarter
  // circle of radius 10 mm, along y = 60, a quarter circle and down x = 60 to the root.
  const path = [];
  for (let k = 0; k <= 100; k++) path.push([0, k / 2]);
  for (let k = 1; k <= 60; k++) path.push([10 - 10 * Math.cos((Math.PI / 2) * (k / 60)), 50 + 10 * Math.sin((Math.PI / 2) * (k / 60))]);
  for (let k = 1; k <= 80; k++) path.push([10 + k / 2, 60]);
  for (let k = 1; k <= 60; k++) path.push([50 + 10 * Math.sin((Math.PI / 2) * (k / 60)), 50 + 10 * Math.cos((Math.PI / 2) * (k / 60))]);
  for (let k = 1; k <= 100; k++) path.push([60, 50 - k / 2]);
  const zp = 5;
  const r = 2;
  /** A plane parting surface z = zp + a · x + b · y with its root line at y = 0, the root plane leaning by `slope`. */
  const plane = (slope = 0, a = 0, b = 0) => ({ height: (x, y) => zp + a * x + b * y, root: (x) => [x, 0, zp + a * x], creases: [], zp, yR: 0, slope });

  it('keeps both rims on a level parting surface and both ends in the root plane, also when the root plane leans', () => {
    for (const slope of [0, 0.1, -0.1]) {
      const g = grooveSurface(path, r, plane(slope));
      // 100 mm up and down, 40 mm across, two quarter circles of 60 chords each (31.4150 mm); the
      // groove follows the path resampled every 0.5 mm, which cuts the chords by 0.0042 mm in all.
      expect(Math.abs(g.length - (140 + 240 * 10 * Math.sin(Math.PI / 240)))).toBeLessThan(0.01);
      expect(g.seam).toBeNull();
      for (let j = 0; j <= 200; j++) {
        for (const u of [0, 1]) expect(surfacePoint(g.surface, u, j / 200)[2], `slope ${slope}`).toBeCloseTo(zp, 12);
      }
      for (let i = 0; i <= 40; i++) {
        for (const v of [0, 1]) {
          const P = surfacePoint(g.surface, i / 40, v);
          expect(P[1] - slope * (P[2] - zp), `slope ${slope}`).toBeCloseTo(0, 12);
          expect(P[2]).toBeLessThanOrEqual(zp + 1e-12);
        }
      }
      // The bottom of each end lies r below the surface, moved along y by the lean.
      expect(surfacePoint(g.surface, 0.5, 0)[1]).toBeCloseTo(-slope * r, 3);
      expect([g.rimInner.points[0][0], g.rimOuter.points[0][0], g.endStart.points.at(-1)[0]]).toEqual([2, -2, -2]);
    }
  });

  it('keeps both rims on a parting surface that rises along x and y within 1e-9 mm', () => {
    // The plane z = 5 + 0.05 x − 0.08 y: the rims are fitted through points of it, and a spline through
    // points of a plane stays in the plane.
    const side = plane(0, 0.05, -0.08);
    const g = grooveSurface(path, r, side);
    let worst = 0;
    for (const rim of [g.rimInner, g.rimOuter]) {
      for (let k = 0; k <= 2000; k++) {
        const P = curvePoint(rim, k / 2000);
        worst = Math.max(worst, Math.abs(P[2] - side.height(P[0], P[1])));
      }
    }
    expect(worst).toBeLessThan(1e-9);
    // Each station hangs below the surface: the bottom of the groove lies r below it.
    for (let j = 1; j < 100; j++) {
      const P = surfacePoint(g.surface, 0.5, j / 100);
      expect(side.height(P[0], P[1]) - P[2]).toBeGreaterThan(r - 0.01);
      expect(side.height(P[0], P[1]) - P[2]).toBeLessThan(r + 0.01);
    }
  });

  it('has a half-round cross-section of the radius along the whole path within 0.005 mm', () => {
    const g = grooveSurface(path, r, plane());
    // Distance of each surface point from the centre line in the parting plane. The stations close
    // up before the bends; with stations every 8 mm up to a bend the spline overshot by 0.15 mm.
    let worst = 0;
    for (let j = 0; j <= 600; j++) {
      for (let i = 0; i <= 16; i++) {
        const P = surfacePoint(g.surface, i / 16, j / 600);
        const d = Math.hypot(polylineDistance(P, path), P[2] - zp);
        worst = Math.max(worst, Math.abs(d - r));
      }
    }
    expect(worst).toBeLessThan(0.005);
    expect(g.stations).toBeLessThan(100);
  });
});

describe('mold of a flat wing', () => {
  // NACA 0010, root chord 200 mm at x = 0, tip chord 120 mm at x = 40 mm, y = 500 mm: leading edge and
  // trailing edge in the plane z = 0.
  let build;
  let g;
  let round;
  let outline;
  beforeAll(() => {
    build = built(flatWing());
    g = geometry(build);
    round = geometry(built(rounded(flatWing())));
    outline = outlineOf(g);
  });

  it('has no roll, and the block from the outline and the margin', () => {
    expect(g.warnings).toEqual([]);
    expect(g.common.roll).toBe(0);
    expect(Math.abs(g.common.zp)).toBeLessThan(1e-12);
    // x from the leading edge at the root (0) to its trailing edge (200 mm), 40 mm margin; y from the
    // root to the tip (500 mm) plus the margin.
    expect(g.common.block).toEqual({ x0: -40, x1: 240, y0: 0, y1: 540 });
    expect([g.summary.length, g.summary.width]).toEqual([280, 540]);
    expect(g.halves.lower.slope).toBe(0);
  });

  it('parts on the plane z = 0 with a flat tip and with a tip that closes in a point', () => {
    for (const [m, kind] of [
      [g, 'flat'],
      [round, 'pole'],
    ]) {
      expect(m.halves.lower.parting.kind).toBe(kind);
      for (const v of m.summary.partingRange) expect(Math.abs(v), kind).toBeLessThan(1e-9);
      for (const S of partingSurfaces(m.halves.lower)) for (const row of S.points) for (const P of row) expect(Math.abs(P[2] - m.common.zp), kind).toBeLessThan(1e-9);
    }
  });

  it('makes each half as thick as its cavity is deep plus the floor', () => {
    // NACA 0010: 10 mm half thickness at the 200 mm root. The block holds the control points of the
    // cavity, 0.0098 mm beyond the surface; the 2 mm groove is less deep.
    for (const key of ['lower', 'upper']) {
      const S = g.halves[key].cavity;
      let deepest = 0;
      for (let i = 0; i <= 400; i++) for (let j = 0; j <= 20; j++) deepest = Math.max(deepest, g.common.zp - surfacePoint(S, i / 400, j / 20)[2]);
      expect(deepest, key).toBeCloseTo(10, 1);
      const t = g.summary[key];
      expect(g.halves[key].thickness).toBe(t);
      expect(t - 12 - deepest, key).toBeGreaterThanOrEqual(0);
      expect(t - 12 - deepest, key).toBeLessThan(0.05);
      expect(t, key).toBe(12 + g.common.zp - Math.min(...S.points.flat().map((P) => P[2])));
    }
  });

  it('puts the centre line of the resin channel at distance + radius from the outline, square to the root face', () => {
    const { path, radius } = g.preview.channel;
    expect(radius).toBe(2);
    // 6 mm from the outline to the near rim plus 2 mm radius: 8 mm. The offset keeps candidates up to
    // 0.02 mm inside the level; measured within 1e-13 mm of 8 mm against 8,000 outline samples (the
    // edges of the flat wing are straight, the fans around their corners circular).
    for (const P of path) expect(Math.abs(polylineDistance(P, outline, true) - 8)).toBeLessThan(0.02);
    expect(path[0]).toEqual([-8, 0]);
    expect(path.at(-1)).toEqual([208, 0]);
    // Both ends cross the root line square to it: the first and last pieces are chords of fans in
    // steps of 0.04 rad, at most 0.02 rad off the y direction.
    const n = path.length;
    for (const [a, b] of [
      [path[0], path[1]],
      [path[n - 1], path[n - 2]],
    ]) {
      expect(Math.abs(Math.atan2(b[0] - a[0], b[1] - a[1]))).toBeLessThanOrEqual(0.02 + 1e-9);
    }
    // Both ends of the groove lie in the root plane y = 0.
    for (const end of [g.halves.lower.channel.endStart, g.halves.lower.channel.endEnd]) for (const P of end.points) expect(Math.abs(P[1])).toBeLessThan(1e-12);
    expect(g.summary.channelLength).toBeCloseTo(g.halves.lower.channel.length, 9);
    expect(g.halves.upper.channel.length).toBeCloseTo(g.halves.lower.channel.length, 9);
  });

  it('holds the default holes: pins at the 4 block corners, screws along the edges between them', () => {
    // Corners 12 mm in from the block edges: x = −28 and 228 mm, y = 12 and 528 mm. Front and back
    // edges 516 mm long: 5 parts of 103.2 mm for a 120 mm spacing; tip side 256 mm: 3 parts of
    // 85.33 mm. 14 positions, 4 of them taken by the pins without a warning.
    const pins = g.common.holes.filter((h) => h.kind === 'pins');
    const screws = g.common.holes.filter((h) => h.kind === 'screws');
    expect(pins.map((h) => h.centre)).toEqual([
      [-28, 12],
      [-28, 528],
      [228, 528],
      [228, 12],
    ]);
    expect(pins.every((h) => h.radius === 3 && h.depth === 10)).toBe(true);
    expect(screws).toHaveLength(10);
    expect(screws.every((h) => h.radius === 3.25 && h.depth === null)).toBe(true);
    const front = screws.filter((h) => h.centre[0] === -28).map((h) => h.centre[1]);
    front.forEach((y, k) => expect(y).toBeCloseTo(12 + 103.2 * (k + 1), 9));
    expect(front).toHaveLength(4);
    const tip = screws.filter((h) => h.centre[1] === 528).map((h) => h.centre[0]);
    tip.forEach((x, k) => expect(x).toBeCloseTo(-28 + (256 / 3) * (k + 1), 9));
    expect([g.summary.pins, g.summary.screws, g.warnings.length]).toEqual([4, 10, 0]);
  });

  it('adds up the volume of both blocks less the resin channel and the holes', () => {
    const t = g.summary.lower + g.summary.upper;
    const holes = 4 * Math.PI * 9 * 2 * 10 + 10 * Math.PI * 3.25 ** 2 * t;
    expect(g.summary.blockVolume).toBeCloseTo(280 * 540 * t - Math.PI * 4 * g.summary.channelLength - holes, 6);
  });
});

describe('mold of a wing with dihedral', () => {
  it('rolls the frame by the dihedral of the flat tip and leans the root plane the opposite way in the upper half', () => {
    // Trainer: one panel of 3° dihedral, flat tip.
    const g = geometry(built(preset('trainer')));
    expect(g.common.roll).toBeCloseTo(3, 2);
    const slope = Math.tan(g.common.roll * DEG);
    expect(g.halves.lower.slope).toBeCloseTo(slope, 15);
    expect(g.halves.upper.slope).toBe(-g.halves.lower.slope);
    // The root section lies in the root plane y = yR + slope · (z − zp) of each half.
    const { zp, block } = g.common;
    for (const key of ['lower', 'upper']) {
      const half = g.halves[key];
      let off = 0;
      for (let i = 0; i <= 100; i++) {
        const P = surfacePoint(half.cavity, i / 100, 0);
        off = Math.max(off, Math.abs(P[1] - (block.y0 + half.slope * (P[2] - zp))));
      }
      expect(off, key).toBeLessThan(1e-9);
    }
    // In the rolled frame leading edge and trailing edge lie within 0.004 mm of z = zp.
    for (const v of g.summary.edgeRange) expect(Math.abs(v)).toBeLessThan(0.004);
    // The block volume counts the lean of the root face: a prism of the lean, (y1 − yR) · t +
    // slope · (tL² − tU²) / 2 per unit of x. A pin hole runs from its bottom in the lower half to its
    // bottom in the upper half, which is stored mirrored at z = zp.
    const s = g.summary;
    const holes = g.common.holes.reduce((v, h, i) => v + Math.PI * h.radius ** 2 * (h.depth === null ? s.lower + s.upper : 2 * zp - g.halves.lower.holes[i].bottom - g.halves.upper.holes[i].bottom), 0);
    expect(s.blockVolume).toBeCloseTo(s.length * (s.width * (s.lower + s.upper) + (slope * (s.lower ** 2 - s.upper ** 2)) / 2) - Math.PI * 4 * s.channelLength - holes, 3);
  });
});

describe('parting surface level in flight direction', () => {
  // The swept wing with 8° washout (flat tip and round tip), and the sample wing of three sections with
  // twist and dihedral (a crease at the middle section).
  let flat;
  let round;
  let sample;
  let roundBuild;
  beforeAll(() => {
    flat = geometry(built(sweptTwistedWing()));
    roundBuild = built(rounded(sweptTwistedWing()));
    round = geometry(roundBuild);
    sample = geometry(built(sampleProject()), { channel: { distance: 8 } });
  });
  const flatCases = () => [
    ['swept twisted', flat],
    ['sample', sample],
  ];

  it('stores one surface for a flat tip, the surface of partingSurface over the block, mirrored at z = zp for the upper half', () => {
    for (const [name, g] of flatCases()) {
      const { le, mid, parting } = g.halves.lower;
      expect(parting.kind, name).toBe('flat');
      const ps = partingSurface(le, mid, g.common.block, true);
      expect(parting.surface, name).toEqual(ps.surface);
      // Degree 1 along x with the 4 rows front face, leading edge, trailing edge, back face.
      expect([parting.surface.degreeU, parting.surface.knotsU, parting.surface.points.length], name).toEqual([1, [0, 0, 1 / 3, 2 / 3, 1, 1], 4]);
      const up = g.halves.upper.parting.surface;
      up.points.forEach((row, i) => row.forEach((P, j) => expect(P, name).toEqual([parting.surface.points[i][j][0], parting.surface.points[i][j][1], 2 * g.common.zp - parting.surface.points[i][j][2]])));
    }
  });

  it('holds the leading edge and the middle of the trailing edge of a flat tip within 1e-9 mm', () => {
    for (const [name, g] of flatCases()) {
      const { le, mid, parting } = g.halves.lower;
      const S = parting.surface;
      const { at } = partingSurface(le, mid, g.common.block, true);
      for (let k = 0; k <= 400; k++) {
        const v = k / 400;
        const L = curvePoint(le, v);
        const T = curvePoint(mid, v);
        // The edges are the rows u = 1/3 and u = 2/3 of the surface. Along the span the surface runs
        // over [0, 1/2] with the knots of the wing halved, the part beyond the tip over [1/2, 1].
        expect(gap(surfacePoint(S, 1 / 3, v / 2), L), `${name} v ${v}`).toBeLessThan(1e-9);
        expect(gap(surfacePoint(S, 2 / 3, v / 2), T), `${name} v ${v}`).toBeLessThan(1e-9);
        expect(Math.abs(at(L[0], L[1])[2] - L[2]), `${name} v ${v}`).toBeLessThan(1e-9);
        expect(Math.abs(at(T[0], T[1])[2] - T[2]), `${name} v ${v}`).toBeLessThan(1e-9);
      }
    }
  });

  it('lies at the height of the leading edge ahead of a flat-tip wing and of the trailing edge behind it, and keeps the tip heights beyond the tip', () => {
    for (const [name, g] of flatCases()) {
      const { le, mid, parting } = g.halves.lower;
      const { block } = g.common;
      const S = parting.surface;
      const { at } = partingSurface(le, mid, block, true);
      // The rows in the front and the back face have the y and z of the edge rows: every line v = const
      // runs along x at one height.
      for (const [a, b] of [
        [0, 1],
        [3, 2],
      ]) {
        S.points[a].forEach((P, j) => {
          expect(P[1]).toBe(S.points[b][j][1]);
          expect(P[2]).toBe(S.points[b][j][2]);
        });
      }
      expect(S.points[0].every((P) => P[0] === block.x0)).toBe(true);
      expect(S.points[3].every((P) => P[0] === block.x1)).toBe(true);
      // Span stations inboard of the tip: z at every x ahead of the leading edge and behind the
      // trailing edge, on the line of the station.
      for (let k = 0; k < 100; k++) {
        const v = k / 100;
        const L = curvePoint(le, v);
        const T = curvePoint(mid, v);
        for (let j = 0; j <= 20; j++) {
          const xa = block.x0 + ((L[0] - block.x0) * j) / 20;
          const xb = T[0] + ((block.x1 - T[0]) * j) / 20;
          expect(Math.abs(at(xa, L[1])[2] - L[2]), `${name} v ${v} x ${xa}`).toBeLessThan(1e-9);
          expect(Math.abs(at(xb, T[1])[2] - T[2]), `${name} v ${v} x ${xb}`).toBeLessThan(1e-9);
        }
      }
      // Beyond the tip: at every x the height at the tip.
      const yTip = curvePoint(le, 1)[1];
      expect(curvePoint(mid, 1)[1]).toBe(yTip);
      for (let i = 0; i <= 40; i++) {
        const x = block.x0 + ((block.x1 - block.x0) * i) / 40;
        const z = at(x, yTip)[2];
        for (let j = 1; j <= 10; j++) {
          const y = yTip + ((block.y1 - yTip) * j) / 10;
          expect(Math.abs(at(x, y)[2] - z), `${name} x ${x} y ${y}`).toBeLessThan(1e-9);
        }
      }
    }
  });

  it('turns the level lines of a pole tip from x inboard of the rounded tip to y at the point, each at the height of its edge point', () => {
    const g = round;
    const { le, mid, parting } = g.halves.lower;
    const { block } = g.common;
    expect(parting.kind).toBe('pole');
    const { front, back } = parting;
    const tipStart = roundTipStart(roundBuild.sections, roundBuild.settings);
    expect(tipStart).toBeGreaterThan(0);
    const vF = roundBuild.vAt(roundBuild.sections[tipStart].y);
    // The rounded tip starts at 72.6 % of the span parameter of the swept wing.
    expect(vF).toBeGreaterThan(0.7);
    expect(vF).toBeLessThan(0.75);
    // Leading edge and middle of the trailing edge are the rows of the two surfaces next to the wing:
    // the knot inserted at the corner of the block moves them by round-off. Measured on 2026-11-11:
    // 2.3e-13 mm at most; the level lines keep the height within 4e-15 mm and, inboard of the rounded
    // tip, the y of the edge point within 1.7e-13 mm.
    let edgeMiss = 0;
    let inboardMiss = 0;
    let levelMiss = 0;
    for (let k = 0; k <= 600; k++) {
      const v = k / 600;
      const L = curvePoint(le, v);
      const T = curvePoint(mid, v);
      edgeMiss = Math.max(edgeMiss, gap(surfacePoint(front, 1, v), L), gap(surfacePoint(back, 0, v), T));
      for (let j = 0; j <= 10; j++) {
        const F = surfacePoint(front, j / 10, v);
        const B = surfacePoint(back, j / 10, v);
        // Each level line keeps the height of its edge point.
        levelMiss = Math.max(levelMiss, Math.abs(F[2] - L[2]), Math.abs(B[2] - T[2]));
        // Inboard of the rounded tip the level lines run along x: the y of the edge point.
        if (v <= vF) inboardMiss = Math.max(inboardMiss, Math.abs(F[1] - L[1]), Math.abs(B[1] - T[1]));
      }
      if (v <= vF) {
        expect(surfacePoint(front, 0, v)[0], `v ${v}`).toBeCloseTo(block.x0, 9);
        expect(surfacePoint(back, 1, v)[0], `v ${v}`).toBeCloseTo(block.x1, 9);
      }
    }
    expect(edgeMiss).toBeLessThan(1e-9);
    expect(levelMiss).toBeLessThan(1e-9);
    expect(inboardMiss).toBeLessThan(1e-9);
    // Around the rounded tip the lines turn: past the start, the line of the front surface leaves the
    // direction of x; at the point both run along y to the tip-side face.
    const tip = curvePoint(le, 1);
    expect(gap(surfacePoint(front, 0, 1), [tip[0], block.y1, tip[2]])).toBeLessThan(1e-9);
    expect(gap(surfacePoint(back, 1, 1), [tip[0], block.y1, tip[2]])).toBeLessThan(1e-9);
    const v = (vF + 1) / 2;
    const d = [0, 1].map((i) => surfacePoint(front, 0, v)[i] - surfacePoint(front, 1, v)[i]);
    expect(Math.abs(Math.atan2(d[1], -d[0]))).toBeGreaterThan(10 * DEG);
  });

  it('joins the two surfaces of a pole tip along the seam from the point to the tip-side face', () => {
    const { front, back } = round.halves.lower.parting;
    // Along v = 1 the front surface runs from the tip-side face (u = 0) to the point, the back surface
    // from the point (u = 0) to the face.
    for (let j = 0; j <= 50; j++) expect(gap(surfacePoint(front, j / 50, 1), surfacePoint(back, 1 - j / 50, 1)), `u ${j / 50}`).toBeLessThan(1e-9);
    // The outer edges lie in the block faces: the front face x = x0, then the tip-side face y = y1 from
    // the corner on.
    const { block } = round.common;
    const { frontCorner, backCorner } = round.halves.lower.parting;
    for (let k = 0; k <= 200; k++) {
      const t = k / 200;
      const F = surfacePoint(front, 0, t);
      const B = surfacePoint(back, 1, t);
      if (t <= frontCorner) expect(F[0]).toBeCloseTo(block.x0, 9);
      else expect(F[1]).toBeCloseTo(block.y1, 9);
      if (t <= backCorner) expect(B[0]).toBeCloseTo(block.x1, 9);
      else expect(B[1]).toBeCloseTo(block.y1, 9);
    }
  });

  it('reports a summary without ramp keys, with the parting range and the half thicknesses from the surface', () => {
    for (const [name, g] of [...flatCases(), ['swept round tip', round]]) {
      const s = g.summary;
      expect(Object.keys(s).sort(), name).toEqual(['blockVolume', 'channelLength', 'edgeRange', 'extent', 'fit', 'length', 'lower', 'partingRange', 'pins', 'roll', 'screws', 'upper', 'width']);
      // Lowest and highest control point of the parting surfaces about z = zp.
      const zs = partingSurfaces(g.halves.lower).flatMap((S) => S.points.flat().map((P) => P[2] - g.common.zp));
      expect(s.partingRange[0], name).toBeCloseTo(Math.min(...zs), 12);
      expect(s.partingRange[1], name).toBeCloseTo(Math.max(...zs), 12);
      // Floor + the deepest of the cavity and the parting surface with the 2 mm groove.
      const { zp } = g.common;
      const cavityL = zp - Math.min(...g.halves.lower.cavity.points.flat().map((P) => P[2]));
      const cavityU = zp - Math.min(...g.halves.upper.cavity.points.flat().map((P) => P[2]));
      expect(s.lower, name).toBeCloseTo(12 + Math.max(cavityL, -s.partingRange[0] + 2), 9);
      expect(s.upper, name).toBeCloseTo(12 + Math.max(cavityU, s.partingRange[1] + 2), 9);
    }
    // A flat tip: the parting range is the range of the heights of leading edge and trailing edge (the
    // edge range samples each edge at 401 points; both wings have their extremes at the root or the tip).
    expect(flat.summary.partingRange).toEqual(flat.summary.edgeRange);
    expect(sample.summary.partingRange).toEqual(sample.summary.edgeRange);
    // Tip chord 120 mm turned by 8°: leading edge and trailing edge 16.7 mm apart in height.
    expect(flat.summary.edgeRange[1] - flat.summary.edgeRange[0]).toBeCloseTo(120 * Math.sin(8 * DEG), 1);
  });

  it('fits the rims of the resin channel and the hole mouths to the parting surface within summary.fit, at most 1e-4 mm', () => {
    // Measured on 2026-11-11: fit 1.4e-14 mm for the swept wing with a flat tip, 2.3e-14 mm for the
    // sample wing, 3.0e-5 mm for the swept wing with the round tip, whose hole mouths miss by up to
    // 1.7e-6 mm.
    expect(flat.summary.fit).toBeLessThan(1e-9);
    for (const [name, g] of [...flatCases(), ['swept round tip', round]]) {
      const { fit } = g.summary;
      expect(fit, name).toBeLessThan(1e-4);
      expect(g.common.holes.length, name).toBeGreaterThan(10);
      for (const key of ['lower', 'upper']) {
        const half = g.halves[key];
        const height = heightOn(partingSurfaces(half));
        let rims = 0;
        for (const rim of [half.channel.rimInner, half.channel.rimOuter]) {
          const n = 4 * half.channel.stations;
          for (let k = 1; k < n; k++) {
            const P = curvePoint(rim, k / n);
            const z = height(P[0], P[1]);
            expect(z, `${name} ${key} rim ${k}`).not.toBeNull();
            rims = Math.max(rims, Math.abs(P[2] - z));
          }
        }
        let mouths = 0;
        for (const h of half.holes) {
          for (const arc of h.arcs) {
            for (let k = 0; k <= 128; k++) {
              const P = curvePoint(arc, k / 128);
              expect(Math.hypot(P[0] - h.centre[0], P[1] - h.centre[1]) - h.radius, `${name} ${key} mouth`).toBeCloseTo(0, 6);
              const z = height(P[0], P[1]);
              expect(z, `${name} ${key} mouth ${h.centre}`).not.toBeNull();
              mouths = Math.max(mouths, Math.abs(P[2] - z));
            }
          }
        }
        // The height of the test bisects to 1e-9 mm and less.
        expect(rims, `${name} ${key} rims`).toBeLessThanOrEqual(fit + 1e-9);
        expect(mouths, `${name} ${key} mouths`).toBeLessThanOrEqual(fit + 1e-9);
      }
    }
  });

  it('counts the hole mouths in summary.fit without the resin channel', () => {
    // The swept wing with the round tip: the hole mouths miss the parting surface by up to 1.7e-6 mm
    // (measured on 2026-11-11), with or without the channel.
    const g = geometry(roundBuild, { channel: { on: false } });
    expect(g.halves.lower.channel).toBeNull();
    let mouths = 0;
    for (const key of ['lower', 'upper']) {
      const half = g.halves[key];
      const height = heightOn(partingSurfaces(half));
      for (const h of half.holes) {
        for (const arc of h.arcs) {
          for (let k = 0; k <= 128; k++) {
            const P = curvePoint(arc, k / 128);
            mouths = Math.max(mouths, Math.abs(P[2] - height(P[0], P[1])));
          }
        }
      }
    }
    expect(mouths).toBeGreaterThan(1e-7);
    expect(mouths).toBeLessThanOrEqual(g.summary.fit + 1e-9);
  });

  it('puts the bottom of each pin hole the depth below the lowest point of its mouth', () => {
    for (const [name, g] of [...flatCases(), ['swept round tip', round]]) {
      for (const key of ['lower', 'upper']) {
        for (const h of g.halves[key].holes) {
          if (h.kind !== 'pins') {
            expect(h.bottom).toBeNull();
            continue;
          }
          let low = Infinity;
          for (const arc of h.arcs) for (let k = 0; k <= 256; k++) low = Math.min(low, curvePoint(arc, k / 256)[2]);
          // The code takes the lowest of 65 points per half turn; 256 samples of the fitted mouth find
          // a point up to 2.2e-5 mm lower around the round tip (measured on 2026-11-11).
          expect(h.bottom + 10 - low, `${name} ${key}`).toBeGreaterThanOrEqual(-1e-9);
          expect(h.bottom + 10 - low, `${name} ${key}`).toBeLessThan(1e-4);
        }
      }
    }
  });

  it('ignores a stored ramp width', () => {
    const build = built(sweptTwistedWing());
    const plain = geometry(build);
    for (const ramp of [4, 'wide']) {
      const g = geometry(build, { ramp });
      expect(g.warnings).toEqual(plain.warnings);
      expect(g.summary).toEqual(plain.summary);
      expect(g.halves).toEqual(plain.halves);
      expect(moldToStep(g, { name: 'Swept', ...STAMP })).toBe(moldToStep(plain, { name: 'Swept', ...STAMP }));
    }
    expect(resolveMold({ ramp: 4 }).channel).toEqual(MOLD_DEFAULTS.channel);
  });
});

describe('mold of a tip that closes in a point', () => {
  it('has no mean line, and the block to the tip point plus the margin', () => {
    const g = geometry(built(rounded(flatWing())));
    expect(g.common.pole).toBe(true);
    expect(g.halves.lower.meanLine).toBeNull();
    expect(g.halves.lower.strip).toBeNull();
    const tip = curvePoint(g.halves.lower.le, 1);
    expect(g.common.block.y1).toBeCloseTo(tip[1] + 40, 6);
  });
});

describe('resin channel at the root', () => {
  it('keeps the radius of curvature of the centre line at least the rounding radius, and rounds the inward corner of a trailing edge that runs back with it', () => {
    // Delta jet with a rounded tip, channel 6 mm wide at 8 mm: centre line 11 mm out, rounding radius
    // 6 + 2 = 8 mm. Its trailing edge runs square to the root: no inward corner there.
    const delta = geometry(built(rounded(preset('deltaJet'))), { channel: { diameter: 6, distance: 8 } });
    // Flying wing: the trailing edge runs back outboard at dx/dy = 0.27 at the root; mirrored at the
    // root it makes an inward corner, which the centre line rounds with 2 · 2 + 2 = 6 mm.
    const flying = geometry(built(preset('flyingWing')));
    for (const [g, rho, end] of [
      [delta, 8, Infinity],
      [flying, 6, 6],
    ]) {
      const { path } = g.preview.channel;
      const s = [0];
      for (let i = 1; i < path.length; i++) s.push(s[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
      let smallest = Infinity;
      let nearRoot = Infinity;
      for (let i = 1; i < path.length - 1; i++) {
        const R = circumradius(path[i - 1], path[i], path[i + 1]);
        smallest = Math.min(smallest, R);
        // Within 60 mm of the root end on the trailing-edge side, short of the crossing piece.
        if (s.at(-1) - s[i] < 60 && s.at(-1) - s[i] > 1) nearRoot = Math.min(nearRoot, R);
      }
      // The circle through three points of an arc of radius R has the radius R: 0.001 mm covers rounding.
      expect(smallest).toBeGreaterThan(rho - 0.001);
      if (end === Infinity) expect(nearRoot).toBe(Infinity);
      else expect(nearRoot).toBeCloseTo(end, 3);
    }
  });
});

describe('holes', () => {
  let build;
  let outline;
  const cache = new Map();
  const mold = (input) => {
    const key = JSON.stringify(input);
    if (!cache.has(key)) cache.set(key, moldGeometry(build, input));
    return cache.get(key);
  };
  beforeAll(() => {
    build = built(flatWing());
    outline = outlineOf(geometry(build));
  });
  const configs = [
    {},
    { pins: { pattern: 'frame', spacing: 100 }, screws: { pattern: 'corners', edge: 25 } },
    { pins: { pattern: 'outline', spacing: 150 }, screws: { pattern: 'outline', spacing: 60, offset: 25 } },
    { channel: { on: false }, pins: { pattern: 'outline', spacing: 80, offset: 4 }, screws: { pattern: 'frame', spacing: 5 } },
  ];

  it('keep every hole clear of the cavity, the resin channel, the block edges and each other by 1 mm', () => {
    for (const input of configs) {
      const g = mold(input);
      expect(g.errors).toEqual([]);
      const p = g.params;
      const { block, holes } = g.common;
      expect(holes.length, JSON.stringify(input)).toBeGreaterThan(3);
      const channel = g.preview.channel;
      // The cavity keep-out: the outer rim of the resin channel, else the outline itself.
      const keepOut = p.channel.on ? p.channel.distance + p.channel.diameter : 0;
      // The root face leans by the roll; the flat wing has none.
      const rootY = block.y0 + Math.abs(g.halves.lower.slope) * Math.max(g.summary.lower, g.summary.upper);
      holes.forEach((h, i) => {
        const [x, y] = h.centre;
        const label = `${JSON.stringify(input)} ${h.kind} ${x.toFixed(2)},${y.toFixed(2)}`;
        // Outline samples every 0.15 mm or less: 0.01 mm covers the distance to the 0.25 mm polygon of the code.
        expect(polylineDistance(h.centre, outline, true), label).toBeGreaterThanOrEqual(keepOut + MOLD_CLEARANCE + h.radius - 0.01);
        if (channel) expect(polylineDistance(h.centre, channel.path), label).toBeGreaterThanOrEqual(channel.radius + MOLD_CLEARANCE + h.radius - 0.01);
        expect(x - h.radius - MOLD_CLEARANCE, label).toBeGreaterThanOrEqual(block.x0 - 1e-9);
        expect(x + h.radius + MOLD_CLEARANCE, label).toBeLessThanOrEqual(block.x1 + 1e-9);
        expect(y - h.radius - MOLD_CLEARANCE, label).toBeGreaterThanOrEqual(rootY - 1e-9);
        expect(y + h.radius + MOLD_CLEARANCE, label).toBeLessThanOrEqual(block.y1 + 1e-9);
        for (const o of holes.slice(i + 1)) expect(Math.hypot(o.centre[0] - x, o.centre[1] - y), label).toBeGreaterThanOrEqual(o.radius + h.radius + MOLD_CLEARANCE - 1e-9);
      });
    }
  });

  it('place the frame pattern at equal spacing along the three edges, at most the largest spacing apart', () => {
    // Pins every 100 mm or less: front and back 516 mm in 6 parts of 86 mm, tip side 256 mm in 3
    // parts of 85.33 mm, 1 + 6 + 3 + 6 = 16 positions. Screws at the corners 25 mm in.
    const g = mold(configs[1]);
    const pins = g.common.holes.filter((h) => h.kind === 'pins').map((h) => h.centre);
    expect(pins).toHaveLength(16);
    for (let i = 1; i < pins.length; i++) {
      const d = Math.hypot(pins[i][0] - pins[i - 1][0], pins[i][1] - pins[i - 1][1]);
      expect(d).toBeLessThanOrEqual(100);
      expect([86, 256 / 3].some((s) => Math.abs(d - s) < 1e-9)).toBe(true);
    }
    expect(g.common.holes.filter((h) => h.kind === 'screws').map((h) => h.centre)).toEqual([
      [-15, 25],
      [-15, 515],
      [215, 515],
      [215, 25],
    ]);
    expect(g.warnings).toEqual([]);
  });

  it('place the outline pattern along an offset of the outline beyond the resin channel at equal spacing', () => {
    // Pins: 10 mm beyond the channel (6 + 4 mm): 20 mm from the outline; screws 25 mm beyond: 35 mm.
    const g = mold(configs[2]);
    for (const [kind, dist, spacing] of [
      ['pins', 20, 150],
      ['screws', 35, 60],
    ]) {
      const centres = g.common.holes.filter((h) => h.kind === kind).map((h) => h.centre);
      // Length of the offset path beyond the root line, rounded with radius diameter + 2 mm.
      const loop = offsetOutline(outline, dist, kind === 'pins' ? 8 : 8.5);
      let total = 0;
      for (let i = 0; i < loop.length; i++) {
        const a = loop[i];
        const b = loop[(i + 1) % loop.length];
        if (a[1] >= 0 && b[1] >= 0) total += Math.hypot(b[0] - a[0], b[1] - a[1]);
      }
      const count = Math.round(total / spacing);
      const dropped = Number(g.warnings.find((w) => w.includes(kind === 'pins' ? 'pin' : 'screw'))?.match(/(\d+)/)[1] ?? 0);
      expect(centres.length + dropped, kind).toBe(count);
      for (const c of centres) expect(polylineDistance(c, outline, true), kind).toBeGreaterThan(dist - 0.03);
      // Neighbours along the path: total / count apart along it, a little less straight across bends.
      const step = total / count;
      for (let i = 1; i < centres.length; i++) {
        const d = Math.hypot(centres[i][0] - centres[i - 1][0], centres[i][1] - centres[i - 1][1]);
        expect(d, kind).toBeLessThan(step + 0.5);
      }
    }
  });

  it('count the holes left out in a warning, and leave out a position taken by the other set without one', () => {
    // Screws every 5 mm along the edges: 104 + 52 + 104 parts, 261 positions 4.96 or 4.92 mm apart,
    // less than 6.5 + 1 mm; the 4 corners hold pins.
    const g = mold({ screws: { spacing: 5 } });
    const screws = g.summary.screws;
    const positions = 1 + 2 * Math.ceil(516 / 5) + Math.ceil(256 / 5);
    expect(positions).toBe(261);
    expect(g.warnings).toEqual([`Mold: ${positions - 4 - screws} screw hole(s) left out: too close to the cavity, the resin channel, a block edge or another hole.`]);
    // Pins along the wing every 5 mm: 6 mm holes collide with their neighbours.
    const close = mold({ pins: { pattern: 'outline', spacing: 5 } });
    expect(close.warnings[0]).toMatch(/^Mold: \d+ pin hole\(s\) left out: too close to the cavity, the resin channel, a block edge or another hole\.$/);
    // Both sets at the corners: the screws find every corner taken by a pin, without a warning.
    const corners = mold({ screws: { pattern: 'corners' } });
    expect([corners.summary.pins, corners.summary.screws, corners.warnings]).toEqual([4, 0, []]);
    setLanguage('de');
    expect(moldGeometry(build, { screws: { spacing: 5 } }).warnings).toEqual([
      `Form: ${positions - 4 - screws} Schraubenbohrung(en) weggelassen: zu nah am Formnest, an der Blutrinne, an einer Blockkante oder an einer anderen Bohrung.`,
    ]);
  });

  it('refuse pin holes that reach within 1 mm of the outer face, and a margin too small for the resin channel', () => {
    // Both halves 22.01 mm thick, the mouths at z = 0: 21 mm deep pin holes fit, 21.5 mm do not.
    expect(moldGeometry(build, { pins: { depth: 21 } }).errors).toEqual([]);
    expect(moldGeometry(build, { pins: { depth: 21.5 } }).errors).toEqual(['Mold: the pin holes are 21.5 mm deep and reach within 1 mm of the outer face of a half; reduce the depth or increase the floor thickness.']);
    expect(moldGeometry(build, { pins: { depth: 21.5, on: false } }).errors).toEqual([]);
    // Channel at 6 mm, 4 mm wide, 1 mm to the block edge: at least 11 mm.
    expect(moldGeometry(build, { margin: 10.9 }).errors).toEqual(['Mold: the block margin must be at least 11 mm for the resin channel (distance, diameter and 1 mm to the block edge).']);
    expect(moldGeometry(build, { margin: 11, pins: { on: false }, screws: { on: false } }).errors).toEqual([]);
    // Without the channel the smallest margin builds.
    expect(moldGeometry(build, { margin: 5, channel: { on: false }, pins: { on: false }, screws: { on: false } }).errors).toEqual([]);
    expect(moldGeometry(build, { margin: 3 }).errors).toEqual(['Mold: block margin must be between 5 and 1000 mm.']);
    expect(moldGeometry({ errors: ['x'] }, {}).errors).toEqual(['The wing has no surface; fix the reported errors first.']);
    setLanguage('de');
    expect(moldGeometry(build, { pins: { depth: 21.5 } }).errors).toEqual(['Form: Die Zentrierbohrungen sind 21,5 mm tief und reichen bis auf 1 mm an die Außenfläche einer Hälfte; die Tiefe verringern oder die Bodendicke vergrößern.']);
    expect(moldGeometry(build, { margin: 10.9 }).errors).toEqual(['Form: Der Rand des Formblocks muss für die Blutrinne mindestens 11 mm betragen (Abstand, Durchmesser und 1 mm bis zur Blockkante).']);
  });

  it('refuse pin holes on a twisted wing by the lowest point of their mouth', () => {
    // Swept wing with 8° washout: the parting surface reaches 6.70 mm below z = zp at the front face,
    // the lower half is 24.54 mm thick. The pin at the front corner near the tip has its mouth lower than
    // the others; its bottom sets the limit.
    const twisted = built(sweptTwistedWing());
    const g = geometry(twisted);
    // The largest depth that keeps 1 mm to the outer face of both halves (the upper half is stored
    // mirrored at z = zp).
    const limit = Math.min(
      ...['lower', 'upper'].flatMap((key) => g.halves[key].holes.filter((h) => h.kind === 'pins').map((h) => h.bottom + 10 - (g.common.zp - g.summary[key] + 1))),
    );
    expect(moldGeometry(twisted, { pins: { depth: Math.floor(limit * 10) / 10 } }).errors).toEqual([]);
    const deep = Math.ceil(limit * 10 + 1e-9) / 10;
    expect(moldGeometry(twisted, { pins: { depth: deep } }).errors).toEqual([`Mold: the pin holes are ${deep} mm deep and reach within 1 mm of the outer face of a half; reduce the depth or increase the floor thickness.`]);
  });
});

describe('mold of an under-cambered wing', () => {
  // 9 % camber, 5 % thick: the lower surface lies up to 6.6 % of the chord above the chord line, at
  // 42 % chord. Root chord 200 mm, tip chord 140 mm.
  let flat;
  let round;
  beforeAll(() => {
    flat = geometry(built(undercamberedWing()));
    round = geometry(built(rounded(undercamberedWing())));
  });
  const chordAt = (y) => 200 - (60 * y) / 500;
  const xLE = (y) => (30 * y) / 500;

  it('raises the lower cavity up to 13.2 mm above z = zp at the root and in proportion to the chord along the span', () => {
    const g = flat;
    expect(g.warnings).toEqual([]);
    const { zp } = g.common;
    const S = g.halves.lower.cavity;
    for (const v of [0, 0.25, 0.5, 0.75, 1]) {
      let top = -Infinity;
      let y = 0;
      for (let i = 0; i <= 800; i++) {
        const P = surfacePoint(S, i / 800, v);
        if (P[2] > top) [top, y] = [P[2], P[1]];
      }
      // 6.61 % of the chord: 13.22 mm at the root, 9.26 mm at the tip.
      expect((top - zp) / chordAt(y), `v ${v}`).toBeCloseTo(0.0661, 3);
    }
    expect(surfacePoint(S, 0.5, 0)[1]).toBe(0);
    let rootTop = -Infinity;
    for (let i = 0; i <= 800; i++) rootTop = Math.max(rootTop, surfacePoint(S, i / 800, 0)[2] - zp);
    expect(rootTop).toBeCloseTo(13.2, 1);
  });

  it('keeps the upper cavity above the lower one by the airfoil thickness, with no contact', () => {
    const g = flat;
    const { zp } = g.common;
    const L = g.halves.lower.cavity;
    // The upper cavity is stored mirrored at z = zp.
    const U = g.halves.upper.cavity;
    const half = (t) => 5 * 0.05 * (0.2969 * Math.sqrt(t) - 0.126 * t - 0.3516 * t ** 2 + 0.2843 * t ** 3 - 0.1036 * t ** 4);
    let worst = 0;
    for (const v of [0, 0.25, 0.5, 0.75, 1]) {
      const y = surfacePoint(L, 0.5, v)[1];
      const c = chordAt(y);
      for (let k = 1; k < 100; k++) {
        const t = k / 100;
        const x = xLE(y) + t * c;
        const gapZ = 2 * zp - zAt(U, x, v) - zAt(L, x, v);
        expect(gapZ, `v ${v} x/c ${t}`).toBeGreaterThan(0);
        // The build closes the 0.1 mm trailing-edge gap of the airfoil over the aft part.
        if (t <= 0.9) worst = Math.max(worst, Math.abs(gapZ - 2 * half(t) * c));
      }
    }
    // Measured on 2026-11-11: 0.0001 mm at most up to 90 % chord.
    expect(worst).toBeLessThan(0.001);
  });

  it('holds leading edge and trailing edge on the parting surface, which stays within 0.01 mm of z = zp', () => {
    for (const g of [flat, round]) {
      const { le, mid } = g.halves.lower;
      const height = heightOn(partingSurfaces(g.halves.lower));
      for (let k = 0; k <= 200; k++) {
        for (const c of [le, mid]) {
          const P = curvePoint(c, k / 200);
          expect(Math.abs(P[2] - g.common.zp)).toBeLessThan(0.01);
          expect(Math.abs(height(P[0], P[1]) - P[2])).toBeLessThan(1e-9);
        }
      }
      for (const v of g.summary.partingRange) expect(Math.abs(v)).toBeLessThan(0.01);
    }
  });

  it('makes the lower half floor + groove + the lowest point of the parting surface thick: the hump adds no thickness', () => {
    for (const g of [flat, round]) {
      const { zp } = g.common;
      const S = g.halves.lower.cavity;
      let deepest = 0;
      for (let i = 0; i <= 800; i++) for (let j = 0; j <= 20; j++) deepest = Math.max(deepest, zp - surfacePoint(S, i / 800, j / 20)[2]);
      // The lower surface dips 0.6 mm below the chord line behind the nose, less than the 2 mm groove of
      // the resin channel below the parting surface, whose lowest point lies 0.008 mm below z = zp.
      expect(deepest).toBeCloseTo(0.6, 1);
      expect(g.summary.lower).toBeCloseTo(14 - g.summary.partingRange[0], 9);
      expect(g.summary.lower).toBeLessThan(14.01);
      // The upper half: 22.8 mm from z = zp to the top of the upper surface, plus the floor.
      expect(g.summary.upper).toBeCloseTo(34.86, 1);
    }
  });

  it('parts a flat tip face along the mean line between the lower and the upper tip curve', () => {
    const g = flat;
    const { zp } = g.common;
    const mean = g.halves.lower.meanLine;
    expect(mean.points.every((P) => P[1] === g.halves.lower.le.points.at(-1)[1])).toBe(true);
    for (let k = 1; k < 100; k++) {
      const P = curvePoint(mean, k / 100);
      const lower = zAt(g.halves.lower.cavity, P[0], 1);
      const upper = 2 * zp - zAt(g.halves.upper.cavity, P[0], 1);
      expect(P[2], `${k} %`).toBeGreaterThan(lower);
      expect(P[2], `${k} %`).toBeLessThan(upper);
      // The mean line rises with the camber: 9 % of 140 mm = 12.6 mm at 40 % chord (12.597 mm).
      if (k === 40) expect(P[2] - zp).toBeCloseTo(12.6, 1);
    }
    // The strip beyond the tip: 3 mm wide, its outer edge on the straight line of the parting surface
    // from the height of the leading edge to the height of the trailing edge.
    const strip = g.halves.lower.strip;
    const L = mean.points[0];
    const T = mean.points.at(-1);
    strip.points.forEach((P, i) => {
      expect(P[0]).toBe(mean.points[i][0]);
      expect(P[1]).toBe(L[1] + 3);
      expect(P[2]).toBeCloseTo(L[2] + ((P[0] - L[0]) / (T[0] - L[0])) * (T[2] - L[2]), 12);
    });
  });

  it('writes closed STEP solids with a flat tip and with a rounded tip', () => {
    for (const g of [flat, round]) {
      const text = moldToStep(g, { name: 'Under-cambered mold', ...STAMP });
      expect(countOf(text, 'MANIFOLD_SOLID_BREP')).toBe(2);
      // In the file the lower half reaches 13.2 mm above z = 0: the highest control point of the
      // cavity lies at 13.23 mm, 0.01 mm above the surface.
      const lowerOnly = moldToStep({ ...g, params: { ...g.params, halves: 'lower' } });
      const top = Math.max(...stepPoints(lowerOnly).map((P) => P[2]));
      expect(top).toBeGreaterThan(13.22);
      expect(top).toBeLessThan(13.25);
    }
    expect(round.common.pole).toBe(true);
    expect(round.halves.lower.meanLine).toBeNull();
  });
});

describe('mold checks of the parting surface', () => {
  const wing = (x, chord) =>
    createProject({
      name: 'Test wing',
      airfoils: [naca('0010')],
      sections: [
        { airfoil: '0010', x: 0, y: 0, z: 0, chord: 200, twist: 0 },
        { airfoil: '0010', x, y: 500, z: 0, chord, twist: 0 },
      ],
    });

  it('refuses a rounded tip swept 800 mm forward over 500 mm span: the parting surface folds seen from above', () => {
    const g = moldGeometry(built(rounded(wing(-800, 120))), { channel: { on: false }, pins: { on: false }, screws: { on: false } });
    expect(g.errors).toEqual(['Mold: seen from above, the parting surface folds over itself beside the wing (a strongly swept tip that closes in a point); reduce the sweep of the tip or use a flat tip.']);
    expect(g.halves).toBeUndefined();
    setLanguage('de');
    expect(moldGeometry(built(rounded(wing(-800, 120))), {}).errors[0]).toMatch(/^Form: Von oben gesehen faltet sich die Trennfläche/);
  });

  it('leaves out a hole on the 3 mm strip beyond a flat tip when the resin channel is off', () => {
    // Pins around the wing 4 mm from the outline, 6 mm in diameter: the one hole lies at y = 504 mm
    // and reaches to 501 mm, onto the strip from 500 to 503 mm.
    const build = built(wing(0, 200));
    const g = geometry(build, { channel: { on: false }, screws: { on: false }, pins: { pattern: 'outline', spacing: 1000, offset: 4 } });
    expect(g.common.holes).toEqual([]);
    expect(g.warnings).toEqual(['Mold: 1 pin hole(s) left out: too close to the cavity, the resin channel, a block edge or another hole.']);
    // 7 mm from the outline (strip 3 mm, 1 mm material, radius 3 mm) the hole stays.
    const far = geometry(build, { channel: { on: false }, screws: { on: false }, pins: { pattern: 'outline', spacing: 1000, offset: 7 } });
    expect(far.common.holes).toHaveLength(1);
    expect(() => moldToStep(far, STAMP)).not.toThrow();
  });
});

describe('resin channel at the corners of a twisted flat tip', () => {
  // Three sections with a dihedral break and 8° washout: at each corner of the flat tip two creases of
  // the parting surface lie one quarter turn of the channel apart.
  const twisted = () =>
    createProject({
      name: 'Twisted wing',
      airfoils: [naca('0010')],
      sections: [
        { airfoil: '0010', x: 0, y: 0, z: 0, chord: 200, twist: 0 },
        { airfoil: '0010', x: 0, y: 250, z: 10, chord: 160, twist: -4 },
        { airfoil: '0010', x: 40, y: 500, z: 0, chord: 120, twist: -8 },
      ],
    });

  it('keeps the rims of a 4, 8 and 20 mm channel within 1e-5 mm of the parting surface', () => {
    const build = built(twisted());
    for (const diameter of [4, 8, 20]) {
      const g = geometry(build, { channel: { diameter }, pins: { on: false }, screws: { on: false } });
      expect(g.summary.fit, `diameter ${diameter}`).toBeLessThan(1e-5);
      expect(() => moldToStep(g, STAMP)).not.toThrow();
    }
  });

  it('refuses a channel whose rims miss the parting surface by more than 0.01 mm (Sailplane, 20 mm channel)', { timeout: 60000 }, () => {
    const g = moldGeometry(built(preset('sailplane')), { channel: { diameter: 20, distance: 10 }, margin: 80, pins: { on: false }, screws: { on: false } });
    expect(g.errors).toHaveLength(1);
    expect(g.errors[0]).toMatch(/^Mold: the rims of the resin channel miss the parting surface by 0\.\d{3} mm, more than 0\.01 mm; reduce the diameter of the resin channel or change its distance\.$/);
    setLanguage('de');
    expect(moldGeometry(built(preset('sailplane')), { channel: { diameter: 20, distance: 10 }, margin: 80, pins: { on: false }, screws: { on: false } }).errors[0]).toMatch(/^Form: Die Ränder der Blutrinne verfehlen die Trennfläche um 0,\d{3} mm, mehr als 0,01 mm/);
  });
});

describe('mold STEP file', () => {
  it('writes every mold case with closed shells, the solids of the chosen halves, the faces of the parting surface and 2 cylinders per hole and half', { timeout: 240000 }, () => {
    const names = [];
    for (const c of moldCases()) {
      names.push(c.name);
      const g = geometry(built(c.project), c.mold);
      // Brep.solid throws unless every edge is used once in each direction.
      const { text, partingFaces } = stepWithFaces(g, { name: c.name, up: c.up });
      const solids = c.solids ?? 2;
      expect(countOf(text, 'MANIFOLD_SOLID_BREP'), c.name).toBe(solids);
      expect(countOf(text, 'CLOSED_SHELL'), c.name).toBe(solids);
      expect(countOf(text, 'CYLINDRICAL_SURFACE'), c.name).toBe(2 * g.common.holes.length * solids);
      // Per half: with a flat tip 1 face, split by the resin channel into 2; with a pole tip 2, and 4
      // with the channel.
      expect(partingFaces, c.name).toBe(solids * (g.common.pole ? 2 : 1) * (g.params.channel.on ? 2 : 1));
      expect(text, c.name).not.toMatch(/ramp/i);
    }
    expect(names).toContain('swept-twist-flat-tip');
    expect(names).toContain('swept-twist-round-tip');
    expect(names).toHaveLength(18);
  });

  it('writes 2, 4, 1 and 2 faces of the parting surface per half for flat and pole tips with and without the channel', () => {
    for (const [project, pole] of [
      [sweptTwistedWing(), false],
      [rounded(sweptTwistedWing()), true],
    ]) {
      const b = built(project);
      for (const on of [true, false]) {
        const g = geometry(b, { channel: { on } });
        expect(g.common.pole).toBe(pole);
        const { text, partingFaces } = stepWithFaces(g, { name: 'Swept' });
        expect(partingFaces, `pole ${pole} channel ${on}`).toBe(2 * (pole ? (on ? 4 : 2) : on ? 2 : 1));
        expect(countOf(text, 'CYLINDRICAL_SURFACE')).toBe(4 * g.common.holes.length);
        expect(text).toContain('B_SPLINE_SURFACE_WITH_KNOTS');
      }
    }
  });

  let g;
  let both;
  beforeAll(() => {
    g = geometry(built(flatWing()));
    both = moldToStep(g, { name: 'Flat wing mold', ...STAMP });
  });
  const variant = (params, options = {}) => moldToStep({ ...g, params: { ...g.params, ...params } }, { name: 'Flat wing mold', ...STAMP, ...options });

  it('names the solids after the mold and the half, the lower half first', () => {
    const names = [...both.matchAll(/MANIFOLD_SOLID_BREP\('([^']*)'/g)].map((m) => m[1]);
    expect(names).toEqual(['Flat wing mold lower', 'Flat wing mold upper']);
    expect([...variant({ halves: 'lower' }).matchAll(/MANIFOLD_SOLID_BREP\('([^']*)'/g)].map((m) => m[1])).toEqual(['Flat wing mold lower']);
    expect([...variant({ halves: 'upper' }).matchAll(/MANIFOLD_SOLID_BREP\('([^']*)'/g)].map((m) => m[1])).toEqual(['Flat wing mold upper']);
    expect(both).toContain("FILE_DESCRIPTION(('Wingdesigner mold'),'2;1');");
  });

  it('puts z = zp at z = 0: the lower half below the parting surface of the flat wing, the upper half above', () => {
    // Leading edge and trailing edge of the flat wing lie in the plane z = 0: every point of the
    // lower-only file between the block bottom and z = 0, every point of the upper-only file between
    // z = 0 and the block top (control points of the cavity included, which lie within the block).
    const s = g.summary;
    const lower = stepPoints(variant({ halves: 'lower' })).map((P) => P[2]);
    const upper = stepPoints(variant({ halves: 'upper' })).map((P) => P[2]);
    expect(Math.max(...lower)).toBeLessThan(1e-9);
    expect(Math.min(...lower)).toBeCloseTo(-s.lower, 9);
    expect(Math.min(...upper)).toBeGreaterThan(-1e-9);
    expect(Math.max(...upper)).toBeCloseTo(s.upper, 9);
  });

  it('puts the extent of each half of a twisted wing in the file', () => {
    // Swept wing with 8° washout: the lower half reaches up to the highest point of the parting surface,
    // the upper half down to its lowest point.
    const t = geometry(built(sweptTwistedWing()));
    const file = (halves) => stepPoints(moldToStep({ ...t, params: { ...t.params, halves } })).map((P) => P[2]);
    const lower = file('lower');
    const upper = file('upper');
    expect(Math.min(...lower)).toBeCloseTo(t.summary.extent.lower[0], 9);
    expect(Math.max(...lower)).toBeCloseTo(t.summary.extent.lower[1], 6);
    expect(Math.min(...upper)).toBeCloseTo(t.summary.extent.upper[0], 6);
    expect(Math.max(...upper)).toBeCloseTo(t.summary.extent.upper[1], 9);
    expect(t.summary.extent.lower[1]).toBeCloseTo(t.summary.partingRange[1], 12);
  });

  it('turns the file to Y up and mirrors the molds of the left wing in y', () => {
    const z = stepPoints(variant({ halves: 'lower' }));
    const yUp = stepPoints(variant({ halves: 'lower' }, { up: 'y' }));
    expect(yUp).toHaveLength(z.length);
    // (x, y, z) becomes (x, z, −y).
    yUp.forEach((P, i) => expect([P[0], P[1], P[2]]).toEqual([z[i][0], z[i][2], z[i][1] === 0 ? 0 : -z[i][1]]));
    const left = stepPoints(variant({ halves: 'lower', left: true }));
    left.forEach((P, i) => expect(P).toEqual([z[i][0], z[i][1] === 0 ? 0 : -z[i][1], z[i][2]]));
    // The right molds lie at y ≥ 0, the left ones at y ≤ 0; the block spans 540 mm.
    expect(Math.min(...z.map((P) => P[1]))).toBe(0);
    expect(Math.max(...left.map((P) => P[1]))).toBe(0);
    expect(Math.min(...left.map((P) => P[1]))).toBe(-540);
  });

  it('refuses a geometry with errors', () => {
    const bad = moldGeometry(built(flatWing()), { margin: 1 });
    expect(() => moldToStep(bad)).toThrow('The mold has no geometry; fix the reported errors first.');
    setLanguage('de');
    expect(() => moldToStep(bad)).toThrow('Die Form hat keine Geometrie; zuerst die gemeldeten Fehler beheben.');
  });
});

describe('B-rep of a mold solid', () => {
  const brep = () => new Brep(new StepWriter(), (P) => P, (v) => v, false);

  it('throws on a loop whose edges do not join and on a shell with an edge used once', () => {
    const b = brep();
    const [p, q, r, s] = [
      [0, 0, 0],
      [1, 0, 0],
      [0, 1, 0],
      [5, 5, 0],
    ].map((P) => b.vertex(P));
    const pq = b.line(p, q);
    const qr = b.line(q, r);
    const rp = b.line(r, p);
    const qs = b.line(q, s);
    expect(() => b.triangleFace(p, q, r, [[[pq, true], [qs, true], [rp, true]]])).toThrow('mold: open loop');
    b.triangleFace(p, q, r, [
      [
        [pq, true],
        [qr, true],
        [rp, true],
      ],
    ]);
    expect(() => b.solid('open')).toThrow('mold: shell not closed');
  });

  it('closes a tetrahedron with every edge used once in each direction', () => {
    const b = brep();
    const [o, x, y, z] = [
      [0, 0, 0],
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ].map((P) => b.vertex(P));
    const [ox, oy, oz, xy, yz, zx] = [b.line(o, x), b.line(o, y), b.line(o, z), b.line(x, y), b.line(y, z), b.line(z, x)];
    // Counter-clockwise seen from outside.
    b.triangleFace(o, y, x, [[[oy, true], [xy, false], [ox, false]]]);
    b.triangleFace(o, x, z, [[[ox, true], [zx, false], [oz, false]]]);
    b.triangleFace(o, z, y, [[[oz, true], [yz, false], [oy, false]]]);
    b.triangleFace(x, y, z, [[[xy, true], [yz, true], [zx, true]]]);
    expect(b.solid('tetrahedron')).toMatch(/^#\d+$/);
  });
});

describe('mold checks against crossing faces', () => {
  const wing = (rootChord, tipChord, twist = 0, airfoil = '0010') =>
    createProject({
      name: 'Check wing',
      airfoils: [naca(airfoil)],
      sections: [
        { airfoil, x: 0, y: 0, z: 0, chord: rootChord, twist },
        { airfoil, x: 0, y: 500, z: 0, chord: tipChord, twist },
      ],
    });

  it('keeps the floor below the groove where the resin channel is deeper than the cavity', () => {
    // NACA 0010 at 100 mm chord: the cavity is 5.0 mm deep. A 20 mm channel reaches 10 mm below the
    // parting surface, so each half is 10 + 1 mm thick, not 5 + 1 mm.
    const off = { pins: { on: false }, screws: { on: false } };
    const g = moldGeometry(built(wing(100, 60)), { floor: 1, channel: { diameter: 20, distance: 6 }, ...off });
    expect(g.errors).toEqual([]);
    expect(g.summary.lower).toBeCloseTo(11, 9);
    expect(g.summary.upper).toBeCloseTo(11, 9);
    // Without the channel, and with a channel shallower than the cavity, the cavity sets the thickness.
    const none = moldGeometry(built(wing(100, 60)), { floor: 1, channel: { on: false }, ...off });
    expect(none.summary.lower).toBeGreaterThan(5.9);
    expect(none.summary.lower).toBeLessThan(6.1);
    expect(moldGeometry(built(wing(100, 60)), { floor: 1, ...off }).summary.lower).toBeCloseTo(none.summary.lower, 9);
    expect(() => moldToStep(g)).not.toThrow();
  });

  it('leaves out holes whose centres lie inside the wing outline, however far from its edge', () => {
    // Block corners 100 mm in from the edges of a 280 mm × 540 mm block: all 4 centres lie in the cavity.
    const g = moldGeometry(built(flatWing()), { pins: { pattern: 'corners', edge: 100 }, screws: { on: false } });
    expect(g.errors).toEqual([]);
    expect(g.summary.pins).toBe(0);
    expect(g.warnings).toEqual(['Mold: 4 pin hole(s) left out: too close to the cavity, the resin channel, a block edge or another hole.']);
  });

  it('refuses a wing whose twisted airfoil reaches more than 0.1 mm beyond the leading-edge line seen from above', () => {
    // NACA 0030 at 200 mm chord twisted 45°: the nose turns ahead of the leading-edge point.
    const g = moldGeometry(built(wing(200, 200, 45, '0030')), { margin: 5, channel: { on: false }, pins: { on: false }, screws: { on: false } });
    expect(g.errors).toHaveLength(1);
    expect(g.errors[0]).toMatch(/^Mold: seen from above, the airfoil reaches \d+\.\d\d mm beyond the leading-edge or trailing-edge line \(twisted sections\), more than 0\.1 mm: one mold half would be undercut\. Reduce the twist\.$/);
    expect(MOLD_OVERHANG).toBe(0.1);
    setLanguage('de');
    expect(moldGeometry(built(wing(200, 200, 45, '0030')), { margin: 5 }).errors[0]).toMatch(/^Form: Von oben gesehen reicht das Profil \d+,\d\d mm über die Linie der Nasenleiste oder der Endleiste hinaus/);
    setLanguage('en');
    // 3° of twist on a NACA 2412 stays far below the limit and builds.
    expect(moldGeometry(built(wing(200, 150, -3, '2412')), {}).errors).toEqual([]);
  });

  it('refuses a block whose leaning root face reaches the wing tip within the thickness of a half', () => {
    // 45° dihedral: the root face leans 45°. With a 1000 mm floor it runs 1000 mm along the span
    // within the thicker half, beyond the tip 849 mm out.
    const steep = createProject({
      name: 'Steep',
      airfoils: [naca('0010')],
      sections: [
        { airfoil: '0010', x: 0, y: 0, z: 0, chord: 200, twist: 0 },
        { airfoil: '0010', x: 0, y: 600, z: 600, chord: 110, twist: 0 },
      ],
    });
    const off = { channel: { on: false }, pins: { on: false }, screws: { on: false } };
    const g = moldGeometry(built(steep), { floor: 1000, ...off });
    expect(g.errors).toHaveLength(1);
    expect(g.errors[0]).toMatch(/^Mold: the root face leans 45\.0° with the dihedral and reaches the wing tip within the \d+\.\d mm of the thicker half; reduce the floor thickness\.$/);
    // The default floor leaves the root face 21 mm along the span: the mold builds.
    const ok = moldGeometry(built(steep), off);
    expect(ok.errors).toEqual([]);
    expect(() => moldToStep(ok)).not.toThrow();
  });

  it('builds the mold of a loft with 385,000 control points', { timeout: 60000 }, () => {
    // 25 sections, 200 chord samples and 40 stations per panel: a 401 × 961 surface, more control
    // points than a function call takes arguments.
    const sections = Array.from({ length: 25 }, (_, k) => ({ airfoil: '0010', x: 0, y: k * 40, z: 0, chord: 200 - k * 3, twist: 0 }));
    const fine = createProject({ name: 'Fine', airfoils: [naca('0010')], sections, settings: { chordSamples: 200, panelStations: 40, spanwise: 'smooth' } });
    const b = built(fine);
    expect([b.surface.points.length, b.surface.points[0].length]).toEqual([401, 961]);
    const g = moldGeometry(b, { channel: { on: false }, pins: { on: false }, screws: { on: false } });
    expect(g.errors).toEqual([]);
    // NACA 0010 at 200 mm chord: 10 mm above and below the chord line, plus the 12 mm floor.
    expect(g.summary.lower).toBeCloseTo(22, 1);
    expect(g.summary.upper).toBeCloseTo(22, 1);
  });
});
