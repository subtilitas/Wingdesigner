// Mold halves (src/geom/mold.js, src/export/moldstep.js): the checks of the parameters, the offset of
// the outline, the half-round groove, the geometry of the halves (frame, block, parting, ramp, resin
// channel, holes), the under-cambered airfoil whose lower surface lies above the parting plane, and
// the STEP solids.
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { buildWing } from '../src/geom/wing.js';
import { curvePoint, surfacePoint } from '../src/geom/nurbs.js';
import { HOLE_PATTERNS, MOLD_CLEARANCE, MOLD_OVERHANG, MOLD_DEFAULTS, MOLD_HALVES, MOLD_RANGES, grooveSurface, moldGeometry, moldProblems, offsetOutline, resolveMold } from '../src/geom/mold.js';
import { Brep, moldToStep } from '../src/export/moldstep.js';
import { StepWriter } from '../src/export/step.js';
import { addRoundTip, defaultRoundTip } from '../src/model/roundtip.js';
import { PRESETS, wizardProject } from '../src/model/wizard.js';
import { setLanguage } from '../src/i18n/index.js';
import { createProject } from '../src/model/project.js';
import { flatWing, moldCases, undercamberedWing } from './mold-cases.js';
import { naca } from './helpers.js';

const DEG = Math.PI / 180;

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

/** Coordinates of every CARTESIAN_POINT of a STEP text. */
const stepPoints = (text) => [...text.matchAll(/CARTESIAN_POINT\('',\(([^)]*)\)\)/g)].map((m) => m[1].split(',').map(Number));
const countOf = (text, entity) => text.split(`=${entity}(`).length - 1;

describe('mold parameters', () => {
  it('fill every missing key with its default, also inside the channel, pin and screw groups', () => {
    expect(resolveMold()).toEqual({ ...MOLD_DEFAULTS, channel: { ...MOLD_DEFAULTS.channel }, pins: { ...MOLD_DEFAULTS.pins }, screws: { ...MOLD_DEFAULTS.screws } });
    const p = resolveMold({ margin: 60, pins: { diameter: 5 }, channel: true });
    expect(p.margin).toBe(60);
    expect(p.pins).toEqual({ ...MOLD_DEFAULTS.pins, diameter: 5 });
    // A group that is no object falls back to its defaults.
    expect(p.channel).toEqual(MOLD_DEFAULTS.channel);
    expect([HOLE_PATTERNS, MOLD_HALVES, MOLD_CLEARANCE]).toEqual([['corners', 'frame', 'outline'], ['both', 'lower', 'upper'], 1]);
    expect(moldProblems({})).toEqual([]);
  });

  it('refuse every value below or above its range, and a value that is no number, and skip a group that is off', () => {
    const names = {
      margin: 'block margin',
      floor: 'floor thickness',
      ramp: 'ramp width',
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
    const quiet = { ramp: 0.5, channel: { distance: 500 }, pins: { pattern: 'frame' }, screws: { pattern: 'frame' } };
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
    expect(moldProblems({ halves: 'left', ramp: 10 })).toEqual(['Mold: halves must be "both", "lower" or "upper".']);
  });

  it('keep the resin channel at least the ramp width plus 0.5 mm from the wing', () => {
    // Ramp 10 mm: the channel distance must be at least 10.5 mm.
    expect(moldProblems({ ramp: 10 })).toEqual(['Mold: the distance of the resin channel must be at least 10.5 mm, the ramp width plus 0.5 mm.']);
    expect(moldProblems({ ramp: 10, channel: { distance: 10.5 } })).toEqual([]);
    expect(moldProblems({ ramp: 10, channel: { on: false } })).toEqual([]);
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
    expect(moldProblems({ ramp: 0.4 })).toEqual(['Form: Breite der Rampe muss zwischen 0,5 und 100 mm liegen.']);
    expect(moldProblems({ screws: { diameter: 51 } })).toEqual(['Form: Durchmesser der Schraubenbohrungen muss zwischen 1 und 50 mm liegen.']);
    expect(moldProblems({ pins: { pattern: 'ring' } })).toEqual(['Form: Das Bohrmuster muss "corners", "frame" oder "outline" sein.']);
    expect(moldProblems({ halves: 'left' })).toEqual(['Form: halves muss "both", "lower" oder "upper" sein.']);
    expect(moldProblems({ ramp: 10 })).toEqual(['Form: Der Abstand der Blutrinne muss mindestens 10,5 mm betragen, die Breite der Rampe plus 0,5 mm.']);
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

  it('keeps both rims in the parting plane and both ends in the root plane, also when the root plane leans', () => {
    for (const slope of [0, 0.1, -0.1]) {
      const g = grooveSurface(path, r, zp, 0, slope);
      // 100 mm up and down, 40 mm across, two quarter circles of 60 chords each (31.4150 mm); the
      // groove follows the path resampled every 0.5 mm, which cuts the chords by 0.0042 mm in all.
      expect(Math.abs(g.length - (140 + 240 * 10 * Math.sin(Math.PI / 240)))).toBeLessThan(0.01);
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
      // The bottom of each end lies r below the plane, moved along y by the lean.
      expect(surfacePoint(g.surface, 0.5, 0)[1]).toBeCloseTo(-slope * r, 3);
      expect([g.rimInner.points[0][0], g.rimOuter.points[0][0], g.endStart.points.at(-1)[0]]).toEqual([2, -2, -2]);
    }
  });

  it('has a half-round cross-section of the radius along the whole path within 0.005 mm', () => {
    const g = grooveSurface(path, r, zp, 0);
    // Distance of each surface point from the centre line in the parting plane. The stations close
    // up before the bends; with stations every 8 mm up to a bend the spline overshot by 0.15 mm.
    // Measured on 2026-11-11: 0.0038 mm at most, at the outer rim where an arc meets a straight piece,
    // with 71 stations.
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
  let outline;
  beforeAll(() => {
    build = built(flatWing());
    g = geometry(build);
    outline = outlineOf(g);
  });

  it('has no roll, the parting plane at z = 0, and the block from the outline and the margin', () => {
    expect(g.warnings).toEqual([]);
    expect(g.common.roll).toBe(0);
    expect(Math.abs(g.common.zp)).toBeLessThan(1e-12);
    expect(g.summary.rampHeight).toBeLessThan(1e-9);
    // x from the leading edge at the root (0) to its trailing edge (200 mm), 40 mm margin; y from the
    // root to the tip (500 mm) plus the margin.
    expect(g.common.block).toEqual({ x0: -40, x1: 240, y0: 0, y1: 540 });
    expect([g.summary.length, g.summary.width]).toEqual([280, 540]);
    expect(g.halves.lower.slope).toBe(0);
  });

  it('makes each half as thick as its cavity is deep plus the floor', () => {
    // NACA 0010: 10 mm half thickness at the 200 mm root. The block holds the control points of the
    // cavity, 0.0098 mm beyond the surface.
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
    expect(g.halves.upper.channel).toBe(g.halves.lower.channel);
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
    // In the rolled frame leading edge and trailing edge lie within 0.004 mm of the parting plane.
    expect(g.summary.rampHeight).toBeLessThan(0.004);
    // The block volume counts the lean of the root face: a prism of the lean, (y1 − yR) · t +
    // slope · (tL² − tU²) / 2 per unit of x.
    const s = g.summary;
    const holes = g.common.holes.reduce((v, h) => v + Math.PI * h.radius ** 2 * (h.depth === null ? s.lower + s.upper : 2 * h.depth), 0);
    expect(s.blockVolume).toBeCloseTo(s.length * (s.width * (s.lower + s.upper) + (slope * (s.lower ** 2 - s.upper ** 2)) / 2) - Math.PI * 4 * s.channelLength - holes, 3);
  });
});

describe('mold of a twisted wing', () => {
  // The flat wing with −6° twist at the tip: leading edge and trailing edge leave the plane z = 0.
  const twisted = () => {
    const p = flatWing();
    p.sections[1].twist = -6;
    return built(p);
  };
  let build;
  beforeAll(() => {
    build = twisted();
  });

  it('measures the ramp height from the parting plane and warns when the ramp rises more than 45°', () => {
    const g = geometry(build, { ramp: 0.5, channel: { distance: 1 } });
    const s = g.summary;
    // Tip chord 120 mm turned by 6°: leading edge and trailing edge 120 · sin 6° = 12.54 mm apart in z.
    expect(s.edgeRange[1] - s.edgeRange[0]).toBeCloseTo(120 * Math.sin(6 * DEG), 1);
    expect(s.rampHeight).toBe(Math.max(-s.edgeRange[0], s.edgeRange[1]));
    expect(s.rampHeight).toBeCloseTo(7.58, 2);
    // The rulings run along x; the edges run at dx/dy = ±0.08 (40 mm over 500 mm), so the ramp is
    // 0.5 · cos(atan 0.08) wide square to the outline at the tip: 86.24°.
    expect(s.rampSlope).toBeCloseTo(Math.atan(s.rampHeight / (0.5 * Math.cos(Math.atan(0.08)))) / DEG, 2);
    expect(g.warnings).toEqual([
      'Mold: leading edge and trailing edge lie up to 7.58 mm off the parting plane (twist, a change of dihedral or the airfoil), so the ramp rises up to 86°. A wider ramp, or a wing with less twist and one dihedral angle, keeps the parting surface flatter.',
    ]);
    // A 20 mm ramp rises 20.8°: no warning.
    const wide = geometry(build, { ramp: 20, channel: { distance: 20.5 }, margin: 60 });
    expect(wide.summary.rampSlope).toBeCloseTo(Math.atan(7.58 / (20 * Math.cos(Math.atan(0.08)))) / DEG, 1);
    expect(wide.warnings.filter((w) => /ramp rises/.test(w))).toEqual([]);
  });

  it('runs the ramp from each edge to the parting plane, the ramp width along x', () => {
    const g = geometry(build, { ramp: 4, channel: { distance: 5 } });
    const { aLE, aTE } = g.common.ramp;
    const { le, mid } = g.halves.lower;
    for (let k = 0; k <= 50; k++) {
      const v = k / 50;
      expect(curvePoint(aLE, v)[2]).toBeCloseTo(g.common.zp, 12);
      // The curve in the plane interpolates the ends of the rulings at its Greville points: within
      // 0.01 mm between them.
      expect(curvePoint(aLE, v)[0] - curvePoint(le, v)[0]).toBeCloseTo(-4, 2);
      expect(curvePoint(aTE, v)[0] - curvePoint(mid, v)[0]).toBeCloseTo(4, 2);
    }
  });
});

describe('mold of a tip that closes in a point', () => {
  it('ends both ramp curves in one point beyond the tip, the rulings turned to y', () => {
    const g = geometry(built(rounded(flatWing())));
    expect(g.common.pole).toBe(true);
    const { aLE, aTE } = g.common.ramp;
    expect(aLE.points.at(-1)).toEqual(aTE.points.at(-1));
    expect(curvePoint(aLE, 1)).toEqual(curvePoint(aTE, 1));
    // The point lies the ramp width (3 mm) beyond the tip point along y, in the parting plane.
    const tip = curvePoint(g.halves.lower.le, 1);
    const end = curvePoint(aLE, 1);
    expect(end[0]).toBeCloseTo(tip[0], 9);
    expect(end[1]).toBeCloseTo(tip[1] + 3, 9);
    expect(end[2]).toBe(g.common.zp);
    expect(g.halves.lower.meanLine).toBeNull();
    // Block to the tip point plus the 40 mm margin.
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

  it('keep every hole clear of the cavity keep-out, the resin channel, the block edges and each other by 1 mm', () => {
    for (const input of configs) {
      const g = mold(input);
      expect(g.errors).toEqual([]);
      const p = g.params;
      const { block, holes } = g.common;
      expect(holes.length, JSON.stringify(input)).toBeGreaterThan(3);
      const channel = g.preview.channel;
      // The cavity keep-out: the outer rim of the resin channel, else the outer edge of the ramp.
      const keepOut = p.channel.on ? p.channel.distance + p.channel.diameter : p.ramp;
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

  it('refuse pin holes deeper than the thinner half less 1 mm, and a margin too small for the resin channel or the ramp', () => {
    // Both halves 22.01 mm thick: 21 mm deep pin holes fit, 21.5 mm do not.
    expect(moldGeometry(build, { pins: { depth: 21 } }).errors).toEqual([]);
    expect(moldGeometry(build, { pins: { depth: 21.5 } }).errors).toEqual(['Mold: the pin holes are 21.5 mm deep, but the thinner half is 22.0 mm thick; reduce the depth or increase the floor thickness.']);
    expect(moldGeometry(build, { pins: { depth: 21.5, on: false } }).errors).toEqual([]);
    // Channel at 6 mm, 4 mm wide, 1 mm to the block edge: at least 11 mm.
    expect(moldGeometry(build, { margin: 10.9 }).errors).toEqual(['Mold: the block margin must be at least 11 mm for the resin channel (distance, diameter and 1 mm to the block edge).']);
    expect(moldGeometry(build, { margin: 5, ramp: 4.5, channel: { on: false }, pins: { on: false }, screws: { on: false } }).errors).toEqual(['Mold: the block margin must be at least 5.5 mm, the ramp width plus 1 mm.']);
    expect(moldGeometry(build, { margin: 11, pins: { on: false }, screws: { on: false } }).errors).toEqual([]);
    expect(moldGeometry(build, { margin: 3 }).errors).toEqual(['Mold: block margin must be between 5 and 1000 mm.']);
    expect(moldGeometry({ errors: ['x'] }, {}).errors).toEqual(['The wing has no surface; fix the reported errors first.']);
    setLanguage('de');
    expect(moldGeometry(build, { pins: { depth: 21.5 } }).errors).toEqual(['Form: Die Zentrierbohrungen sind 21,5 mm tief, die dünnere Hälfte ist aber nur 22,0 mm dick; die Tiefe verringern oder die Bodendicke vergrößern.']);
    expect(moldGeometry(build, { margin: 10.9 }).errors).toEqual(['Form: Der Rand des Formblocks muss für die Blutrinne mindestens 11 mm betragen (Abstand, Durchmesser und 1 mm bis zur Blockkante).']);
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

  it('raises the lower cavity up to 13.2 mm above the parting plane at the root and in proportion to the chord along the span', () => {
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
    // The upper cavity is stored mirrored at the parting plane.
    const U = g.halves.upper.cavity;
    const half = (t) => 5 * 0.05 * (0.2969 * Math.sqrt(t) - 0.126 * t - 0.3516 * t ** 2 + 0.2843 * t ** 3 - 0.1036 * t ** 4);
    let worst = 0;
    for (const v of [0, 0.25, 0.5, 0.75, 1]) {
      const y = surfacePoint(L, 0.5, v)[1];
      const c = chordAt(y);
      for (let k = 1; k < 100; k++) {
        const t = k / 100;
        const x = xLE(y) + t * c;
        const gap = 2 * zp - zAt(U, x, v) - zAt(L, x, v);
        expect(gap, `v ${v} x/c ${t}`).toBeGreaterThan(0);
        // The build closes the 0.1 mm trailing-edge gap of the airfoil over the aft part.
        if (t <= 0.9) worst = Math.max(worst, Math.abs(gap - 2 * half(t) * c));
      }
    }
    // Measured on 2026-11-11: 0.0001 mm at most up to 90 % chord.
    expect(worst).toBeLessThan(0.001);
  });

  it('keeps leading edge and trailing edge within 0.01 mm of the parting plane: a flat ramp', () => {
    for (const g of [flat, round]) {
      const { zp } = g.common;
      for (let k = 0; k <= 200; k++) {
        for (const c of [g.halves.lower.le, g.halves.lower.mid, g.common.ramp.aLE, g.common.ramp.aTE]) expect(Math.abs(curvePoint(c, k / 200)[2] - zp)).toBeLessThan(0.01);
      }
      expect(g.summary.rampHeight).toBeLessThan(0.01);
      expect(g.summary.rampSlope).toBeLessThan(1);
    }
  });

  it('makes the lower half floor + deepest point below the plane thick: the hump adds no thickness', () => {
    for (const g of [flat, round]) {
      const { zp } = g.common;
      const S = g.halves.lower.cavity;
      let deepest = 0;
      for (let i = 0; i <= 800; i++) for (let j = 0; j <= 20; j++) deepest = Math.max(deepest, zp - surfacePoint(S, i / 800, j / 20)[2]);
      // The lower surface dips 0.6 mm below the chord line behind the nose, less than the 2 mm groove of
      // the resin channel: the groove is the deepest point, and the half is 2 + 12 mm thick.
      expect(deepest).toBeCloseTo(0.6, 1);
      expect(g.summary.lower).toBeCloseTo(14, 9);
      // The upper half: 22.8 mm from the plane to the top of the upper surface, plus the floor.
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
  });

  it('writes closed STEP solids with a flat tip and with a rounded tip', () => {
    for (const g of [flat, round]) {
      const text = moldToStep(g, { name: 'Under-cambered mold', timestamp: '2026-01-01T00:00:00' });
      expect(countOf(text, 'MANIFOLD_SOLID_BREP')).toBe(2);
      // In the file the lower half reaches 13.2 mm above the parting plane z = 0: the highest control
      // point of the cavity lies at 13.23 mm, 0.01 mm above the surface.
      const lowerOnly = moldToStep({ ...g, params: { ...g.params, halves: 'lower' } });
      const top = Math.max(...stepPoints(lowerOnly).map((P) => P[2]));
      expect(top).toBeGreaterThan(13.22);
      expect(top).toBeLessThan(13.25);
    }
    expect(round.common.pole).toBe(true);
    expect(round.halves.lower.meanLine).toBeNull();
  });
});

describe('mold STEP file', () => {
  it('writes every mold case with closed shells, the solids of the chosen halves and 2 cylinders per hole and half', { timeout: 60000 }, () => {
    for (const c of moldCases()) {
      const g = geometry(built(c.project), c.mold);
      const text = moldToStep(g, { name: c.name, timestamp: '2026-01-01T00:00:00', up: c.up });
      const solids = c.solids ?? 2;
      expect(countOf(text, 'MANIFOLD_SOLID_BREP'), c.name).toBe(solids);
      expect(countOf(text, 'CLOSED_SHELL'), c.name).toBe(solids);
      expect(countOf(text, 'CYLINDRICAL_SURFACE'), c.name).toBe(2 * g.common.holes.length * solids);
    }
  });

  let g;
  let both;
  beforeAll(() => {
    g = geometry(built(flatWing()));
    both = moldToStep(g, { name: 'Flat wing mold', timestamp: '2026-01-01T00:00:00' });
  });
  const variant = (params, options = {}) => moldToStep({ ...g, params: { ...g.params, ...params } }, { name: 'Flat wing mold', timestamp: '2026-01-01T00:00:00', ...options });

  it('names the solids after the mold and the half, the lower half first', () => {
    const names = [...both.matchAll(/MANIFOLD_SOLID_BREP\('([^']*)'/g)].map((m) => m[1]);
    expect(names).toEqual(['Flat wing mold lower', 'Flat wing mold upper']);
    expect([...variant({ halves: 'lower' }).matchAll(/MANIFOLD_SOLID_BREP\('([^']*)'/g)].map((m) => m[1])).toEqual(['Flat wing mold lower']);
    expect([...variant({ halves: 'upper' }).matchAll(/MANIFOLD_SOLID_BREP\('([^']*)'/g)].map((m) => m[1])).toEqual(['Flat wing mold upper']);
    expect(both).toContain("FILE_DESCRIPTION(('Wingdesigner mold'),'2;1');");
  });

  it('puts the parting plane at z = 0: the lower half below it, the upper half above', () => {
    // Leading edge and trailing edge of the flat wing lie in the plane: every point of the lower-only
    // file between the block bottom and z = 0, every point of the upper-only file between z = 0 and
    // the block top (control points of the cavity included, which lie within the block).
    const s = g.summary;
    const lower = stepPoints(variant({ halves: 'lower' })).map((P) => P[2]);
    const upper = stepPoints(variant({ halves: 'upper' })).map((P) => P[2]);
    expect(Math.max(...lower)).toBeLessThan(1e-9);
    expect(Math.min(...lower)).toBeCloseTo(-s.lower, 9);
    expect(Math.min(...upper)).toBeGreaterThan(-1e-9);
    expect(Math.max(...upper)).toBeCloseTo(s.upper, 9);
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
    // parting plane, so each half is 10 + 1 mm thick, not 5 + 1 mm.
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
});
