// STEP (ISO 10303-21) export of the wing as exact NURBS solids, schema AP214 (AUTOMOTIVE_DESIGN).
//
// Each half wing is one MANIFOLD_SOLID_BREP whose CLOSED_SHELL holds:
//   upper face  - B-spline surface, trailing edge -> leading edge (u), root -> tip (v)
//   lower face  - B-spline surface, leading edge -> trailing edge (u), root -> tip (v)
//   TE face     - ruled B-spline surface between the trailing-edge curves (open trailing edge only)
//   root, tip   - planar caps (sections lie in planes y = const)
// Every edge is the exact boundary iso-curve of the adjacent B-spline surface.

import { knotMultiplicities, splitSurfaceU, surfaceBoundaryU, surfaceBoundaryV, surfacePoint } from '../geom/nurbs.js';
import { plain, tr } from '../i18n/index.js';

/** STEP real: always with a decimal point, upper-case exponent. */
export function stepReal(x) {
  if (!Number.isFinite(x)) throw new Error(tr('Non-finite value in STEP export: {value}', { value: plain(x) }));
  if (Object.is(x, -0) || x === 0) return '0.';
  let s = String(x);
  const e = s.indexOf('e');
  let mant = e >= 0 ? s.slice(0, e) : s;
  const exp = e >= 0 ? s.slice(e + 1) : '';
  if (!mant.includes('.')) mant += '.';
  s = exp ? `${mant}E${exp.startsWith('+') ? exp.slice(1) : exp}` : mant;
  return s;
}

/** STEP string literal with ISO 10303-21 escapes. */
export function stepString(text) {
  // One replace over the characters that need escaping: linear in the length of the text.
  const out = String(text ?? '').replace(/'|\\|[^\x20-\x7e]/gu, (ch) => {
    if (ch === "'") return "''";
    if (ch === '\\') return '\\\\';
    let code = ch.codePointAt(0);
    // A lone surrogate is no Unicode character: written as U+FFFD (replacement character).
    if (code >= 0xd800 && code <= 0xdfff) code = 0xfffd;
    if (code <= 0xffff) return `\\X2\\${code.toString(16).toUpperCase().padStart(4, '0')}\\X0\\`;
    return `\\X4\\${code.toString(16).toUpperCase().padStart(8, '0')}\\X0\\`;
  });
  return `'${out}'`;
}

class StepWriter {
  constructor() {
    this.lines = [];
  }

  add(body) {
    this.lines.push(body);
    return `#${this.lines.length}`;
  }

  point(P) {
    return this.add(`CARTESIAN_POINT('',(${stepReal(P[0])},${stepReal(P[1])},${stepReal(P[2])}))`);
  }

  direction(D) {
    return this.add(`DIRECTION('',(${stepReal(D[0])},${stepReal(D[1])},${stepReal(D[2])}))`);
  }

  vertex(P) {
    return this.add(`VERTEX_POINT('',${this.point(P)})`);
  }

  curve(c) {
    const { knots, mults } = knotMultiplicities(c.knots);
    const pts = c.points.map((P) => this.point(P)).join(',');
    return this.add(
      `B_SPLINE_CURVE_WITH_KNOTS('',${c.degree},(${pts}),.UNSPECIFIED.,.F.,.F.,(${mults.join(',')}),(${knots.map(stepReal).join(',')}),.UNSPECIFIED.)`,
    );
  }

  surface(s) {
    const u = knotMultiplicities(s.knotsU);
    const v = knotMultiplicities(s.knotsV);
    // control_points_list: outer list along u, inner lists along v (ISO 10303-42).
    const rows = s.points.map((row) => `(${row.map((P) => this.point(P)).join(',')})`).join(',');
    return this.add(
      `B_SPLINE_SURFACE_WITH_KNOTS('',${s.degreeU},${s.degreeV},(${rows}),.UNSPECIFIED.,.F.,.F.,.F.,` +
        `(${u.mults.join(',')}),(${v.mults.join(',')}),(${u.knots.map(stepReal).join(',')}),(${v.knots.map(stepReal).join(',')}),.UNSPECIFIED.)`,
    );
  }

  plane(origin, normal, ref) {
    const ax = this.add(`AXIS2_PLACEMENT_3D('',${this.point(origin)},${this.direction(normal)},${this.direction(ref)})`);
    return this.add(`PLANE('',${ax})`);
  }

  edge(v1, v2, curve) {
    return this.add(`EDGE_CURVE('',${v1},${v2},${curve},.T.)`);
  }

  face(loop, surface, sameSense, boundSense) {
    const oes = loop.map(([e, o]) => this.add(`ORIENTED_EDGE('',*,*,${e},${o ? '.T.' : '.F.'})`)).join(',');
    const el = this.add(`EDGE_LOOP('',(${oes}))`);
    const fb = this.add(`FACE_OUTER_BOUND('',${el},${boundSense ? '.T.' : '.F.'})`);
    return this.add(`ADVANCED_FACE('',(${fb}),${surface},${sameSense ? '.T.' : '.F.'})`);
  }

  toString(header) {
    const data = this.lines.map((l, i) => `#${i + 1}=${l};`).join('\n');
    return `ISO-10303-21;\nHEADER;\n${header}\nENDSEC;\nDATA;\n${data}\nENDSEC;\nEND-ISO-10303-21;\n`;
  }
}

const mirrorPoint = (P) => [P[0], -P[1], P[2]];

function mapCurve(c, f) {
  return { ...c, points: c.points.map(f) };
}

function mapSurface(s, f) {
  return { ...s, points: s.points.map((row) => row.map(f)) };
}

/**
 * Topology of one half wing (right side, y >= root). Geometry is transformed by `xf`; `mirrored`
 * flips orientation flags so that faces stay outward after a reflection.
 */
function writeHalfWing(w, build, name, mirrored) {
  const xf = mirrored ? mirrorPoint : (P) => P;
  const [SU, SL] = splitSurfaceU(build.surface, build.uLE);
  const closed = build.closedTE;

  const P = {
    teU0: surfacePoint(SU, 0, 0),
    teU1: surfacePoint(SU, 0, 1),
    le0: surfacePoint(SU, 1, 0),
    le1: surfacePoint(SU, 1, 1),
    teL0: surfacePoint(SL, 1, 0),
    teL1: surfacePoint(SL, 1, 1),
  };
  const V = {};
  V.teU0 = w.vertex(xf(P.teU0));
  V.teU1 = w.vertex(xf(P.teU1));
  V.le0 = w.vertex(xf(P.le0));
  V.le1 = w.vertex(xf(P.le1));
  V.teL0 = closed ? V.teU0 : w.vertex(xf(P.teL0));
  V.teL1 = closed ? V.teU1 : w.vertex(xf(P.teL1));

  const C = (c) => w.curve(mapCurve(c, xf));
  const E = {};
  E.teU = w.edge(V.teU0, V.teU1, C(surfaceBoundaryU(SU, false)));
  E.le = w.edge(V.le0, V.le1, C(surfaceBoundaryU(SU, true)));
  E.teL = closed ? E.teU : w.edge(V.teL0, V.teL1, C(surfaceBoundaryU(SL, true)));
  E.rootU = w.edge(V.teU0, V.le0, C(surfaceBoundaryV(SU, false)));
  E.tipU = w.edge(V.teU1, V.le1, C(surfaceBoundaryV(SU, true)));
  E.rootL = w.edge(V.le0, V.teL0, C(surfaceBoundaryV(SL, false)));
  E.tipL = w.edge(V.le1, V.teL1, C(surfaceBoundaryV(SL, true)));

  // Loop direction flag: mirrored halves use every loop reversed.
  const bound = !mirrored;
  // Surface normals (S_u x S_v) of the wing faces point inward; mirroring flips them outward.
  const wingSense = mirrored;
  const faces = [];
  faces.push(
    w.face(
      [
        [E.teU, true],
        [E.tipU, true],
        [E.le, false],
        [E.rootU, false],
      ],
      w.surface(mapSurface(SU, xf)),
      wingSense,
      bound,
    ),
  );
  faces.push(
    w.face(
      [
        [E.le, true],
        [E.tipL, true],
        [E.teL, false],
        [E.rootL, false],
      ],
      w.surface(mapSurface(SL, xf)),
      wingSense,
      bound,
    ),
  );
  const rootLoop = [
    [E.rootU, true],
    [E.rootL, true],
  ];
  const tipLoop = [
    [E.tipL, false],
    [E.tipU, false],
  ];
  if (!closed) {
    const line = (a, b) => ({ degree: 1, knots: [0, 0, 1, 1], points: [a, b] });
    E.rootTE = w.edge(V.teL0, V.teU0, C(line(P.teL0, P.teU0)));
    E.tipTE = w.edge(V.teL1, V.teU1, C(line(P.teL1, P.teU1)));
    const lowerTE = SL.points[SL.points.length - 1];
    const upperTE = SU.points[0];
    const ruled = { degreeU: 1, degreeV: SU.degreeV, knotsU: [0, 0, 1, 1], knotsV: SU.knotsV.slice(), points: [lowerTE, upperTE] };
    faces.push(
      w.face(
        [
          [E.teL, true],
          [E.tipTE, true],
          [E.teU, false],
          [E.rootTE, false],
        ],
        w.surface(mapSurface(ruled, xf)),
        wingSense,
        bound,
      ),
    );
    rootLoop.push([E.rootTE, true]);
    tipLoop.push([E.tipTE, false]);
  }
  // Caps: plane normals are geometric vectors, so mirroring the axis keeps them outward.
  faces.push(w.face(rootLoop, w.plane(xf(P.le0), xf([0, -1, 0]), [1, 0, 0]), true, bound));
  faces.push(w.face(tipLoop, w.plane(xf(P.le1), xf([0, 1, 0]), [1, 0, 0]), true, bound));
  const shell = w.add(`CLOSED_SHELL('',(${faces.join(',')}))`);
  return w.add(`MANIFOLD_SOLID_BREP(${stepString(name)},${shell})`);
}

/**
 * Serialize a wing build to STEP text.
 * @param {object} build result of buildWing()
 * @param {{mirror?: boolean, name?: string, timestamp?: string, author?: string}} [options]
 */
export function wingToStep(build, { mirror = true, name = 'Wing', timestamp, author = '' } = {}) {
  if (!build.surface) throw new Error(tr('The wing has no surface; fix the reported errors first.'));
  const w = new StepWriter();
  const appCtx = w.add(`APPLICATION_CONTEXT('core data for automotive mechanical design processes')`);
  w.add(`APPLICATION_PROTOCOL_DEFINITION('international standard','automotive_design',2000,${appCtx})`);
  const prodCtx = w.add(`PRODUCT_CONTEXT('',${appCtx},'mechanical')`);
  const product = w.add(`PRODUCT(${stepString(name)},${stepString(name)},'',(${prodCtx}))`);
  w.add(`PRODUCT_RELATED_PRODUCT_CATEGORY('part',$,(${product}))`);
  const pdf = w.add(`PRODUCT_DEFINITION_FORMATION('','',${product})`);
  const pdCtx = w.add(`PRODUCT_DEFINITION_CONTEXT('part definition',${appCtx},'design')`);
  const pd = w.add(`PRODUCT_DEFINITION('design','',${pdf},${pdCtx})`);
  const pds = w.add(`PRODUCT_DEFINITION_SHAPE('','',${pd})`);
  const mm = w.add(`(LENGTH_UNIT()NAMED_UNIT(*)SI_UNIT(.MILLI.,.METRE.))`);
  const rad = w.add(`(NAMED_UNIT(*)PLANE_ANGLE_UNIT()SI_UNIT($,.RADIAN.))`);
  const sr = w.add(`(NAMED_UNIT(*)SI_UNIT($,.STERADIAN.)SOLID_ANGLE_UNIT())`);
  const unc = w.add(`UNCERTAINTY_MEASURE_WITH_UNIT(LENGTH_MEASURE(1.E-07),${mm},'distance_accuracy_value','confusion accuracy')`);
  const ctx = w.add(
    `(GEOMETRIC_REPRESENTATION_CONTEXT(3)GLOBAL_UNCERTAINTY_ASSIGNED_CONTEXT((${unc}))GLOBAL_UNIT_ASSIGNED_CONTEXT((${mm},${rad},${sr}))REPRESENTATION_CONTEXT('Context #1','3D Context with UNIT and UNCERTAINTY'))`,
  );
  const origin = w.add(`AXIS2_PLACEMENT_3D('',${w.point([0, 0, 0])},${w.direction([0, 0, 1])},${w.direction([1, 0, 0])})`);
  const solids = [writeHalfWing(w, build, `${name} right`, false)];
  if (mirror) solids.push(writeHalfWing(w, build, `${name} left`, true));
  const rep = w.add(`ADVANCED_BREP_SHAPE_REPRESENTATION(${stepString(name)},(${[origin, ...solids].join(',')}),${ctx})`);
  w.add(`SHAPE_DEFINITION_REPRESENTATION(${pds},${rep})`);

  const ts = timestamp ?? new Date().toISOString().slice(0, 19);
  const header = [
    `FILE_DESCRIPTION(('Wingdesigner wing'),'2;1');`,
    `FILE_NAME(${stepString(name)},${stepString(ts)},(${stepString(author)}),(''),'Wingdesigner','Wingdesigner','');`,
    `FILE_SCHEMA(('AUTOMOTIVE_DESIGN { 1 0 10303 214 1 1 1 1 }'));`,
  ].join('\n');
  return w.toString(header);
}
