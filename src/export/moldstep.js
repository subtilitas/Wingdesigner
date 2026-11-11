// STEP export of the mold halves (src/geom/mold.js) as exact solids, schema AP214.
//
// Each half is one MANIFOLD_SOLID_BREP, built in the frame of the lower half (material below the
// parting plane); the upper half is the mirror image at the parting plane, the molds of the left wing
// the mirror image at y = 0. Faces of one half:
//   block      bottom, front (leading-edge side), back, tip side: planes; the root face: a plane with
//              the root section and the ends of the resin channel in its outline
//   parting    the plane z = zp outside the ramp, split by the resin channel into two faces
//   ramp       two ruled B-spline surfaces from leading edge and trailing edge to the plane; at a flat
//              tip a ruled surface from the mean line of the tip section and a planar triangle at each
//              corner
//   cavity     the wing surface of the side (the B-spline surface of the wing export), the half of a
//              blunt trailing edge, at a flat tip the half of the tip face up to its mean line
//   channel    one B-spline surface of half-round cross-section
//   holes      two half cylinders each; a pin hole ends in a planar bottom, a screw hole in the
//              bottom face of the block
// A loop is listed counter-clockwise seen from outside the solid; a reflection keeps the lists and
// flips the bound flag and the sense of the B-spline faces, as the left half of the wing export does.

import { stepFile, stepString } from './step.js';
import { upAxisMap } from './axes.js';
import { surfaceBoundaryV } from '../geom/nurbs.js';
import { tr } from '../i18n/index.js';

const line = (a, b) => ({ degree: 1, knots: [0, 0, 1, 1], points: [a, b] });
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const minus = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const norm = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/**
 * Boundary representation of one solid: vertices, edges and faces written through a StepWriter, with
 * the points mapped by `map` (directions by `mapVec`). `reflect`: the map is a reflection.
 */
export class Brep {
  constructor(writer, map, mapVec, reflect) {
    this.w = writer;
    this.map = map;
    this.mapVec = mapVec;
    this.reflect = reflect;
    this.faces = [];
    this.edges = [];
  }

  vertex(P) {
    return { ref: this.w.vertex(this.map(P)), P };
  }

  #edge(a, b, curve) {
    const e = { ref: this.w.edge(a.ref, b.ref, curve), a, b, forward: 0, reversed: 0 };
    this.edges.push(e);
    return e;
  }

  /** Edge along a B-spline curve from vertex a to vertex b. */
  curve(a, b, c) {
    return this.#edge(a, b, this.w.curve({ ...c, points: c.points.map(this.map) }));
  }

  line(a, b) {
    return this.curve(a, b, line(a.P, b.P));
  }

  /** Edge along a circle about `axis` through `centre`, counter-clockwise about the axis from a to b. */
  arc(a, b, centre, axis, ref, radius) {
    // A reflection turns the sense of rotation: the axis of the written circle is the reversed image.
    const ax = this.mapVec(axis).map((v) => (this.reflect ? -v : v));
    return this.#edge(a, b, this.w.circle(this.map(centre), ax, this.mapVec(ref), radius));
  }

  #loops(loops) {
    return loops.map((loop) => {
      loop.forEach(([e, fwd], i) => {
        const [, nextFwd] = loop[(i + 1) % loop.length];
        const next = loop[(i + 1) % loop.length][0];
        const end = fwd ? e.b : e.a;
        const start = nextFwd ? next.a : next.b;
        if (end !== start) throw new Error('mold: open loop');
        if (fwd) e.forward++;
        else e.reversed++;
      });
      return loop.map(([e, fwd]) => [e.ref, fwd]);
    });
  }

  /** Face on a B-spline surface; `sense`: the surface normal S_u × S_v points out of the solid. */
  surfaceFace(s, sense, loops) {
    const surface = this.w.surface({ ...s, points: s.points.map((row) => row.map(this.map)) });
    this.faces.push(this.w.faceLoops(this.#loops(loops), surface, sense !== this.reflect, !this.reflect));
  }

  /** Planar face with the outward normal `normal`. */
  planeFace(origin, normal, ref, loops) {
    const surface = this.w.plane(this.map(origin), this.mapVec(normal), this.mapVec(ref));
    this.faces.push(this.w.faceLoops(this.#loops(loops), surface, true, !this.reflect));
  }

  /** Planar face through three points, listed counter-clockwise seen from outside. */
  triangleFace(a, b, c, loops) {
    const n = norm(cross(minus(b.P, a.P), minus(c.P, a.P)));
    this.planeFace(a.P, n, norm(minus(b.P, a.P)), loops);
  }

  /** Face on a cylinder about `axis`; its solid lies outside the cylinder (a hole). */
  holeFace(origin, axis, ref, radius, loops) {
    const ax = this.mapVec(axis).map((v) => (this.reflect ? -v : v));
    const surface = this.w.cylinder(this.map(origin), ax, this.mapVec(ref), radius);
    this.faces.push(this.w.faceLoops(this.#loops(loops), surface, false, !this.reflect));
  }

  /** The solid; throws when an edge is not used once in each direction (an open or twisted shell). */
  solid(name) {
    for (const e of this.edges) if (e.forward !== 1 || e.reversed !== 1) throw new Error('mold: shell not closed');
    const shell = this.w.add(`CLOSED_SHELL('',(${this.faces.join(',')}))`);
    return this.w.add(`MANIFOLD_SOLID_BREP(${stepString(name)},${shell})`);
  }
}

/** The mean line of a flat tip section moved out by the ramp width, in the parting plane. */
const meanOuter = (c, w, zp) => ({ ...c, points: c.points.map((P) => [P[0], P[1] + w, zp]) });

/** One mold half (geometry.halves.lower or .upper with geometry.common) into `b`. */
function writeHalf(b, common, half) {
  const { zp, block, pole, closed, ramp, holes } = common;
  const { channel, slope } = half;
  const { x0, x1, y0, y1 } = block;
  const zb = zp - half.thickness;
  // The root face leans by the roll of the mold frame: y = y0 + slope · (z − zp).
  const yb = y0 + slope * (zb - zp);
  const S = half.cavity;
  const X = [1, 0, 0];
  const Z = [0, 0, 1];
  const last = (c) => c.points[c.points.length - 1];

  // Block.
  const T = { fr: b.vertex([x0, y0, zp]), ft: b.vertex([x0, y1, zp]), bt: b.vertex([x1, y1, zp]), br: b.vertex([x1, y0, zp]) };
  const B = { fr: b.vertex([x0, yb, zb]), ft: b.vertex([x0, y1, zb]), bt: b.vertex([x1, y1, zb]), br: b.vertex([x1, yb, zb]) };
  const E = {
    frontTop: b.line(T.fr, T.ft),
    tipTop: b.line(T.ft, T.bt),
    backTop: b.line(T.bt, T.br),
    frontBot: b.line(B.fr, B.ft),
    tipBot: b.line(B.ft, B.bt),
    backBot: b.line(B.bt, B.br),
    rootBot: b.line(B.fr, B.br),
    vFr: b.line(B.fr, T.fr),
    vFt: b.line(B.ft, T.ft),
    vBt: b.line(B.bt, T.bt),
    vBr: b.line(B.br, T.br),
  };

  // Wing edges.
  const V = { le0: b.vertex(half.le.points[0]), teL0: b.vertex(half.te.points[0]), le1: b.vertex(last(half.le)) };
  V.tm0 = closed ? V.teL0 : b.vertex(half.mid.points[0]);
  V.teL1 = pole ? V.le1 : b.vertex(last(half.te));
  V.tm1 = pole ? V.le1 : closed ? V.teL1 : b.vertex(last(half.mid));
  E.le = b.curve(V.le0, V.le1, half.le);
  E.teL = b.curve(V.teL0, V.teL1, half.te);
  E.mid = closed ? E.teL : b.curve(V.tm0, V.tm1, half.mid);
  E.rootL = b.curve(V.le0, V.teL0, surfaceBoundaryV(S, false));
  if (!closed) E.rootTE = b.line(V.teL0, V.tm0);
  if (!pole) {
    E.tipL = b.curve(V.le1, V.teL1, surfaceBoundaryV(S, true));
    if (!closed) E.tipTE = b.line(V.teL1, V.tm1);
    E.mean = b.curve(V.le1, V.tm1, half.meanLine);
  }

  // Ramp.
  V.aL0 = b.vertex(ramp.aLE.points[0]);
  V.aT0 = b.vertex(ramp.aTE.points[0]);
  V.aL1 = b.vertex(last(ramp.aLE));
  V.aT1 = pole ? V.aL1 : b.vertex(last(ramp.aTE));
  E.aLE = b.curve(V.aL0, V.aL1, ramp.aLE);
  E.aTE = b.curve(V.aT0, V.aT1, ramp.aTE);
  E.rL0 = b.line(V.le0, V.aL0);
  E.rT0 = b.line(V.tm0, V.aT0);
  E.rL1 = b.line(V.le1, V.aL1);
  E.rT1 = pole ? E.rL1 : b.line(V.tm1, V.aT1);
  // Outer edge of the ramp in the parting plane, from the leading-edge side to the trailing-edge side.
  let rampLoop = [
    [E.aLE, true],
    [E.aTE, false],
  ];
  if (!pole) {
    const w = ramp.width;
    V.bL = b.vertex([V.le1.P[0], V.le1.P[1] + w, zp]);
    V.bT = b.vertex([V.tm1.P[0], V.tm1.P[1] + w, zp]);
    E.eLb = b.line(V.le1, V.bL);
    E.eTb = b.line(V.tm1, V.bT);
    E.cL = b.line(V.bL, V.aL1);
    E.cT = b.line(V.aT1, V.bT);
    // The mean line moved out by the ramp width, in the parting plane.
    E.oT = b.curve(V.bL, V.bT, meanOuter(half.meanLine, w, zp));
    rampLoop = [
      [E.aLE, true],
      [E.cL, false],
      [E.oT, true],
      [E.cT, false],
      [E.aTE, false],
    ];
  }

  // Resin channel and the root line of the parting plane.
  if (channel) {
    V.c1i = b.vertex(channel.rimInner.points[0]);
    V.c1o = b.vertex(channel.rimOuter.points[0]);
    V.c2i = b.vertex(last(channel.rimInner));
    V.c2o = b.vertex(last(channel.rimOuter));
    E.rimI = b.curve(V.c1i, V.c2i, channel.rimInner);
    E.rimO = b.curve(V.c1o, V.c2o, channel.rimOuter);
    E.end1 = b.curve(V.c1i, V.c1o, channel.endStart);
    E.end2 = b.curve(V.c2i, V.c2o, channel.endEnd);
    E.s1 = b.line(T.fr, V.c1o);
    E.s2 = b.line(V.c1i, V.aL0);
    E.s3 = b.line(V.aT0, V.c2i);
    E.s4 = b.line(V.c2o, T.br);
  } else {
    E.s1 = b.line(T.fr, V.aL0);
    E.s4 = b.line(V.aT0, T.br);
  }

  // Holes: loops in the parting face and in the bottom face.
  const topHoles = [];
  const bottomHoles = [];
  for (const h of holes) {
    const [hx, hy] = h.centre;
    const rh = h.radius;
    const zh = h.depth === null ? zb : zp - h.depth;
    const tA = b.vertex([hx + rh, hy, zp]);
    const tB = b.vertex([hx - rh, hy, zp]);
    const bA = b.vertex([hx + rh, hy, zh]);
    const bB = b.vertex([hx - rh, hy, zh]);
    const top = [hx, hy, zp];
    const bot = [hx, hy, zh];
    const tArc1 = b.arc(tA, tB, top, Z, X, rh);
    const tArc2 = b.arc(tB, tA, top, Z, X, rh);
    const bArc1 = b.arc(bA, bB, bot, Z, X, rh);
    const bArc2 = b.arc(bB, bA, bot, Z, X, rh);
    const lA = b.line(bA, tA);
    const lB = b.line(bB, tB);
    topHoles.push([
      [tArc2, false],
      [tArc1, false],
    ]);
    b.holeFace(bot, Z, X, rh, [
      [
        [lA, true],
        [tArc1, true],
        [lB, false],
        [bArc1, false],
      ],
    ]);
    b.holeFace(bot, Z, X, rh, [
      [
        [lB, true],
        [tArc2, true],
        [lA, false],
        [bArc2, false],
      ],
    ]);
    const ring = [
      [bArc1, true],
      [bArc2, true],
    ];
    if (h.depth === null) bottomHoles.push(ring);
    else b.planeFace(bot, Z, X, [ring]);
  }

  // Block faces.
  b.planeFace([x0, yb, zb], [0, 0, -1], X, [
    [
      [E.frontBot, true],
      [E.tipBot, true],
      [E.backBot, true],
      [E.rootBot, false],
    ],
    ...bottomHoles,
  ]);
  b.planeFace([x0, yb, zb], [-1, 0, 0], [0, 1, 0], [
    [
      [E.vFr, true],
      [E.frontTop, true],
      [E.vFt, false],
      [E.frontBot, false],
    ],
  ]);
  b.planeFace([x0, y1, zb], [0, 1, 0], X, [
    [
      [E.vFt, true],
      [E.tipTop, true],
      [E.vBt, false],
      [E.tipBot, false],
    ],
  ]);
  b.planeFace([x1, yb, zb], X, [0, 1, 0], [
    [
      [E.backBot, false],
      [E.vBt, true],
      [E.backTop, true],
      [E.vBr, false],
    ],
  ]);
  // Root face: the bottom edge, up the back, then along the parting line to the front.
  const rootLoop = [
    [E.rootBot, true],
    [E.vBr, true],
    [E.s4, false],
  ];
  if (channel) rootLoop.push([E.end2, false], [E.s3, false]);
  rootLoop.push([E.rT0, false]);
  if (!closed) rootLoop.push([E.rootTE, false]);
  rootLoop.push([E.rootL, false], [E.rL0, true]);
  if (channel) rootLoop.push([E.s2, false], [E.end1, true]);
  rootLoop.push([E.s1, false], [E.vFr, false]);
  b.planeFace([x0, yb, zb], norm([0, -1, slope]), X, [rootLoop]);

  // Parting plane.
  const frame = [
    [E.backTop, false],
    [E.tipTop, false],
    [E.frontTop, false],
  ];
  if (channel) {
    b.planeFace([x0, y0, zp], Z, X, [[[E.s1, true], [E.rimO, true], [E.s4, true], ...frame], ...topHoles]);
    b.planeFace([x0, y0, zp], Z, X, [[[E.s2, true], ...rampLoop, [E.s3, true], [E.rimI, false]]]);
    b.surfaceFace(channel.surface, false, [
      [
        [E.rimI, true],
        [E.end2, true],
        [E.rimO, false],
        [E.end1, false],
      ],
    ]);
  } else {
    b.planeFace([x0, y0, zp], Z, X, [[[E.s1, true], ...rampLoop, [E.s4, true], ...frame], ...topHoles]);
  }

  // Ramp: ruled from the wing edge (u = 0) to the curve in the plane (u = 1).
  const ruled = (inner, outer) => ({ degreeU: 1, degreeV: inner.degree, knotsU: [0, 0, 1, 1], knotsV: inner.knots.slice(), points: [inner.points, outer.points] });
  b.surfaceFace(ruled(half.le, ramp.aLE), false, [
    [
      [E.le, true],
      [E.rL1, true],
      [E.aLE, false],
      [E.rL0, false],
    ],
  ]);
  b.surfaceFace(ruled(half.mid, ramp.aTE), true, [
    [
      [E.rT0, true],
      [E.aTE, true],
      [E.rT1, false],
      [E.mid, false],
    ],
  ]);
  if (!pole) {
    b.triangleFace(V.aL1, V.le1, V.bL, [
      [
        [E.rL1, false],
        [E.eLb, true],
        [E.cL, true],
      ],
    ]);
    b.surfaceFace(ruled(half.meanLine, meanOuter(half.meanLine, ramp.width, zp)), false, [
      [
        [E.mean, true],
        [E.eTb, true],
        [E.oT, false],
        [E.eLb, false],
      ],
    ]);
    b.triangleFace(V.tm1, V.aT1, V.bT, [
      [
        [E.rT1, true],
        [E.cT, true],
        [E.eTb, false],
      ],
    ]);
    // The half of the flat tip face below the mean line.
    const cap = [[E.tipL, true]];
    if (!closed) cap.push([E.tipTE, true]);
    cap.push([E.mean, false]);
    b.planeFace(V.le1.P, [0, -1, 0], X, [cap]);
  }

  // Cavity: u from the leading edge to the trailing edge, v from root to tip.
  const cavity = [
    [E.rootL, true],
    [E.teL, true],
  ];
  if (!pole) cavity.push([E.tipL, false]);
  cavity.push([E.le, false]);
  b.surfaceFace(S, true, [cavity]);
  if (!closed) {
    const teFace = [
      [E.rootTE, true],
      [E.mid, true],
    ];
    if (!pole) teFace.push([E.tipTE, false]);
    teFace.push([E.teL, false]);
    b.surfaceFace(ruled(half.te, half.mid), true, [teFace]);
  }
}

/**
 * STEP text of the mold halves.
 * @param {object} geometry result of moldGeometry() without errors
 * @param {{name?: string, timestamp?: string, author?: string, up?: 'z'|'y'}} [options]
 *   The halves (both, lower, upper) and the side (right or left wing) follow geometry.params.
 */
export function moldToStep(geometry, { name = 'Mold', timestamp, author = '', up = 'z' } = {}) {
  if (!geometry?.halves) throw new Error(tr('The mold has no geometry; fix the reported errors first.'));
  const { common, halves, params } = geometry;
  const turn = upAxisMap(up);
  return stepFile(name, { timestamp, author, description: 'Wingdesigner mold' }, (w) => {
    const solids = [];
    for (const key of ['lower', 'upper']) {
      if (params.halves !== 'both' && params.halves !== key) continue;
      const upper = key === 'upper';
      // The parting plane at z = 0: the lower half below it, the upper half above.
      const sz = upper ? -1 : 1;
      const sy = params.left ? -1 : 1;
      const map = (P) => turn([P[0], sy * P[1], sz * (P[2] - common.zp)]);
      const mapVec = (v) => turn([v[0], sy * v[1], sz * v[2]]);
      const b = new Brep(w, map, mapVec, upper !== Boolean(params.left));
      writeHalf(b, common, halves[key]);
      solids.push(b.solid(`${name} ${key}`));
    }
    return solids;
  });
}
