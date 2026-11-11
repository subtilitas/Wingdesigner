// STEP export of the mold halves (src/geom/mold.js) as exact solids, schema AP214.
//
// Each half is one MANIFOLD_SOLID_BREP, built in the frame of the lower half (material below the
// parting surface); the upper half is the mirror image at the plane z = zp, the molds of the left wing
// the mirror image at y = 0. Faces of one half:
//   block      bottom: a plane; front (leading-edge side), back and tip side: planes whose top edge
//              is the edge of the parting surface; the root face: a plane with the root section and
//              the ends of the resin channel in its outline
//   parting    the parting surface over the whole block, level along x at the height of the leading
//              edge ahead of the wing and of the trailing edge behind it, split by the resin channel
//              into two faces; at a flat tip a ruled strip from the mean line of the tip section to it
//   cavity     the wing surface of the side (the B-spline surface of the wing export), the half of a
//              blunt trailing edge, at a flat tip the half of the tip face up to its mean line
//   channel    one B-spline surface of half-round cross-section
//   holes      two half cylinders each; a pin hole ends in a planar bottom, a screw hole in the
//              bottom face of the block
// Leading edge and trailing edge are lines of the parting surface. The rims of the channel and the
// mouths of the holes are fitted through points of it and lie on it within summary.fit.
// A loop is listed counter-clockwise seen from outside the solid; a reflection keeps the lists and
// flips the bound flag and the sense of the B-spline faces, as the left half of the wing export does.

import { stepFile, stepString } from './step.js';
import { upAxisMap } from './axes.js';
import { splitCurve, surfaceBoundaryV } from '../geom/nurbs.js';
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

/** One mold half (geometry.halves.lower or .upper with geometry.common) into `b`. */
function writeHalf(b, common, half) {
  const { zp, block, pole, closed } = common;
  const { channel, slope, parting, holes } = half;
  const { x0, x1, y1 } = block;
  const zb = zp - half.thickness;
  const C = half.cavity;
  const X = [1, 0, 0];
  const Z = [0, 0, 1];
  const last = (c) => c.points[c.points.length - 1];
  // Edges of the parting surface in the block faces. With a flat tip it is one surface: its first and
  // last row lie in the front face (x = x0) and the back face (x = x1), its end in the tip-side face.
  // Around a tip that closes in a point it is two surfaces, whose outer edges run along the front or
  // back face and, from the corner of the block on, along the tip-side face to the seam.
  const flat = parting.kind === 'flat';
  const along = (S, row) => ({ degree: S.degreeV, knots: S.knotsV, points: S.points[row] });
  let frontEdge;
  let backEdge;
  let tipEdges;
  if (flat) {
    const S = parting.surface;
    frontEdge = along(S, 0);
    backEdge = along(S, S.points.length - 1);
    tipEdges = [{ degree: S.degreeU, knots: S.knotsU, points: S.points.map((row) => row[row.length - 1]) }];
  } else {
    const [f1, f2] = splitCurve(along(parting.front, 0), parting.frontCorner);
    const [b1, b2] = splitCurve(along(parting.back, 1), parting.backCorner);
    frontEdge = f1;
    backEdge = b1;
    tipEdges = [f2, b2];
  }
  // The root face leans by the roll of the mold frame: y = yR + slope · (z − zp), through the root
  // line of the parting surface.
  const yb = frontEdge.points[0][1] + slope * (zb - frontEdge.points[0][2]);

  // Block: the top corners are the corners of the parting surface.
  const T = { fr: b.vertex(frontEdge.points[0]), ft: b.vertex(last(frontEdge)), bt: b.vertex(last(backEdge)), br: b.vertex(backEdge.points[0]) };
  const B = { fr: b.vertex([x0, yb, zb]), ft: b.vertex([x0, y1, zb]), bt: b.vertex([x1, y1, zb]), br: b.vertex([x1, yb, zb]) };
  const E = {
    frontTop: b.curve(T.fr, T.ft, frontEdge),
    backTop: b.curve(T.br, T.bt, backEdge),
    frontBot: b.line(B.fr, B.ft),
    tipBot: b.line(B.ft, B.bt),
    backBot: b.line(B.bt, B.br),
    rootBot: b.line(B.fr, B.br),
    vFr: b.line(B.fr, T.fr),
    vFt: b.line(B.ft, T.ft),
    vBt: b.line(B.bt, T.bt),
    vBr: b.line(B.br, T.br),
  };
  // Top edge of the tip-side face, from the front corner to the back corner: one edge, or two that
  // meet in the end of the seam.
  const V = {};
  let tipTop;
  if (flat) {
    E.tipTop = b.curve(T.ft, T.bt, tipEdges[0]);
    tipTop = [[E.tipTop, true]];
  } else {
    V.seamEnd = b.vertex(last(tipEdges[0]));
    E.tipTopF = b.curve(T.ft, V.seamEnd, tipEdges[0]);
    E.tipTopB = b.curve(T.bt, V.seamEnd, tipEdges[1]);
    tipTop = [
      [E.tipTopF, true],
      [E.tipTopB, false],
    ];
  }
  const tipTopBack = tipTop.map(([e, f]) => [e, !f]).reverse();

  // Wing edges.
  Object.assign(V, { le0: b.vertex(half.le.points[0]), teL0: b.vertex(half.te.points[0]), le1: b.vertex(last(half.le)) });
  V.tm0 = closed ? V.teL0 : b.vertex(half.mid.points[0]);
  V.teL1 = pole ? V.le1 : b.vertex(last(half.te));
  V.tm1 = pole ? V.le1 : closed ? V.teL1 : b.vertex(last(half.mid));
  E.le = b.curve(V.le0, V.le1, half.le);
  E.teL = b.curve(V.teL0, V.teL1, half.te);
  E.mid = closed ? E.teL : b.curve(V.tm0, V.tm1, half.mid);
  E.rootL = b.curve(V.le0, V.teL0, surfaceBoundaryV(C, false));
  if (!closed) E.rootTE = b.line(V.teL0, V.tm0);
  // Edge of the cavity opening on the parting surface, from the leading edge at the root around the
  // tip to the trailing edge at the root.
  let opening = [
    [E.le, true],
    [E.mid, false],
  ];
  if (!pole) {
    E.tipL = b.curve(V.le1, V.teL1, surfaceBoundaryV(C, true));
    if (!closed) E.tipTE = b.line(V.teL1, V.tm1);
    E.mean = b.curve(V.le1, V.tm1, half.meanLine);
    // The strip beyond the flat tip face: from the mean line to a straight line of the parting surface.
    V.bL = b.vertex(half.strip.points[0]);
    V.bT = b.vertex(last(half.strip));
    E.eLb = b.line(V.le1, V.bL);
    E.eTb = b.line(V.tm1, V.bT);
    E.oT = b.curve(V.bL, V.bT, half.strip);
    opening = [
      [E.le, true],
      [E.eLb, true],
      [E.oT, true],
      [E.eTb, false],
      [E.mid, false],
    ];
  }

  // Resin channel and the root line of the parting surface. Around a tip that closes in a point the
  // rims are split where the channel crosses the seam.
  let rimI = null;
  let rimO = null;
  if (channel) {
    V.c1i = b.vertex(channel.rimInner.points[0]);
    V.c1o = b.vertex(channel.rimOuter.points[0]);
    V.c2i = b.vertex(last(channel.rimInner));
    V.c2o = b.vertex(last(channel.rimOuter));
    if (flat) {
      E.rimI = b.curve(V.c1i, V.c2i, channel.rimInner);
      E.rimO = b.curve(V.c1o, V.c2o, channel.rimOuter);
      rimI = [[E.rimI, true]];
      rimO = [[E.rimO, true]];
    } else {
      const [i1, i2] = splitCurve(channel.rimInner, channel.seam);
      const [o1, o2] = splitCurve(channel.rimOuter, channel.seam);
      V.si = b.vertex(last(i1));
      V.so = b.vertex(last(o1));
      E.rimIf = b.curve(V.c1i, V.si, i1);
      E.rimIb = b.curve(V.si, V.c2i, i2);
      E.rimOf = b.curve(V.c1o, V.so, o1);
      E.rimOb = b.curve(V.so, V.c2o, o2);
      rimI = [
        [E.rimIf, true],
        [E.rimIb, true],
      ];
      rimO = [
        [E.rimOf, true],
        [E.rimOb, true],
      ];
      // The seam: from the point of the tip to the channel, and from the channel to the tip-side face.
      E.seamIn = b.line(V.le1, V.si);
      E.seamOut = b.line(V.so, V.seamEnd);
    }
    E.end1 = b.curve(V.c1i, V.c1o, channel.endStart);
    E.end2 = b.curve(V.c2i, V.c2o, channel.endEnd);
    E.s1 = b.line(T.fr, V.c1o);
    E.s2 = b.line(V.c1i, V.le0);
    E.s3 = b.line(V.tm0, V.c2i);
    E.s4 = b.line(V.c2o, T.br);
  } else {
    E.s1 = b.line(T.fr, V.le0);
    E.s4 = b.line(V.tm0, T.br);
    if (!flat) E.seam = b.line(V.le1, V.seamEnd);
  }
  const reversed = (loop) => loop.map(([e, f]) => [e, !f]).reverse();

  // Holes: the mouth on the parting surface, the wall, and the bottom or the loop in the block face.
  // Mouth loops per surface of the parting surface (0: the only one, or the one ahead of the leading edge).
  const topHoles = [[], []];
  const bottomHoles = [];
  for (const h of holes) {
    const [hx, hy] = h.centre;
    const rh = h.radius;
    const zh = h.bottom === null ? zb : h.bottom;
    const tA = b.vertex(h.arcs[0].points[0]);
    const tB = b.vertex(h.arcs[1].points[0]);
    const bA = b.vertex([hx + rh, hy, zh]);
    const bB = b.vertex([hx - rh, hy, zh]);
    const bot = [hx, hy, zh];
    const tArc1 = b.curve(tA, tB, h.arcs[0]);
    const tArc2 = b.curve(tB, tA, h.arcs[1]);
    const bArc1 = b.arc(bA, bB, bot, Z, X, rh);
    const bArc2 = b.arc(bB, bA, bot, Z, X, rh);
    const lA = b.line(bA, tA);
    const lB = b.line(bB, tB);
    topHoles[h.patch].push([
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
    if (h.bottom === null) bottomHoles.push(ring);
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
  b.planeFace([x0, y1, zb], [0, 1, 0], X, [[[E.vFt, true], ...tipTop, [E.vBt, false], [E.tipBot, false]]]);
  b.planeFace([x1, yb, zb], X, [0, 1, 0], [
    [
      [E.backBot, false],
      [E.vBt, true],
      [E.backTop, false],
      [E.vBr, false],
    ],
  ]);
  // Root face: the bottom edge, up the back, then along the root ruling of the parting surface, around
  // the ends of the groove and the root section, to the front.
  const rootLoop = [
    [E.rootBot, true],
    [E.vBr, true],
    [E.s4, false],
  ];
  if (channel) rootLoop.push([E.end2, false], [E.s3, false]);
  if (!closed) rootLoop.push([E.rootTE, false]);
  rootLoop.push([E.rootL, false]);
  if (channel) rootLoop.push([E.s2, false], [E.end1, true]);
  rootLoop.push([E.s1, false], [E.vFr, false]);
  b.planeFace([x0, yb, zb], norm([0, -1, slope]), X, [rootLoop]);

  // Parting surface: u along x, v along the span, the normal up.
  if (flat) {
    const S = parting.surface;
    const frame = [[E.backTop, true], ...tipTopBack, [E.frontTop, false]];
    if (channel) {
      b.surfaceFace(S, true, [[[E.s1, true], ...rimO, [E.s4, true], ...frame], ...topHoles[0]]);
      b.surfaceFace(S, true, [[[E.s2, true], ...opening, [E.s3, true], ...reversed(rimI)]]);
    } else {
      b.surfaceFace(S, true, [[[E.s1, true], ...opening, [E.s4, true], ...frame], ...topHoles[0]]);
    }
  } else if (channel) {
    // Ahead of the leading edge: outside and inside the channel; then behind the trailing edge.
    b.surfaceFace(parting.front, true, [[[E.s1, true], [E.rimOf, true], [E.seamOut, true], [E.tipTopF, false], [E.frontTop, false]], ...topHoles[0]]);
    b.surfaceFace(parting.front, true, [[[E.s2, true], [E.le, true], [E.seamIn, true], [E.rimIf, false]]]);
    b.surfaceFace(parting.back, true, [[[E.s4, true], [E.backTop, true], [E.tipTopB, true], [E.seamOut, false], [E.rimOb, true]], ...topHoles[1]]);
    b.surfaceFace(parting.back, true, [[[E.s3, true], [E.rimIb, false], [E.seamIn, false], [E.mid, false]]]);
  } else {
    b.surfaceFace(parting.front, true, [[[E.s1, true], [E.le, true], [E.seam, true], [E.tipTopF, false], [E.frontTop, false]], ...topHoles[0]]);
    b.surfaceFace(parting.back, true, [[[E.s4, true], [E.backTop, true], [E.tipTopB, true], [E.seam, false], [E.mid, false]], ...topHoles[1]]);
  }
  if (channel) b.surfaceFace(channel.surface, false, [[...rimI, [E.end2, true], ...reversed(rimO), [E.end1, false]]]);

  const ruled = (inner, outer) => ({ degreeU: 1, degreeV: inner.degree, knotsU: [0, 0, 1, 1], knotsV: inner.knots.slice(), points: [inner.points, outer.points] });
  if (!pole) {
    b.surfaceFace(ruled(half.meanLine, half.strip), false, [
      [
        [E.mean, true],
        [E.eTb, true],
        [E.oT, false],
        [E.eLb, false],
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
  b.surfaceFace(C, true, [cavity]);
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
      // The reference height zp at z = 0: the lower half below the parting surface, the upper half above.
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
