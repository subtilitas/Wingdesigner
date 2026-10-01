// Test writer of flow5 projects (.fl5) for the reader tests (src/import/fl5.js): the same record layout,
// written from the same format description, with the format numbers of each record selectable, so that
// the layouts of older flow5 versions are covered where no file of that version is at hand. Big-endian,
// every value a C++ float or double as an 8-byte double, strings as u32 byte count and UTF-16BE.

class Out {
  constructor() {
    this.parts = [];
  }
  bytes(n, fill = 0) {
    this.parts.push(new Uint8Array(n).fill(fill));
    return this;
  }
  i32(v) {
    const b = new Uint8Array(4);
    new DataView(b.buffer).setInt32(0, v);
    this.parts.push(b);
    return this;
  }
  f64(v) {
    const b = new Uint8Array(8);
    new DataView(b.buffer).setFloat64(0, v);
    this.parts.push(b);
    return this;
  }
  bool(v) {
    this.parts.push(Uint8Array.of(v ? 1 : 0));
    return this;
  }
  /** A string; null writes the null string (0xFFFFFFFF). */
  str(s) {
    if (s === null) return this.i32(-1);
    const b = new Uint8Array(4 + 2 * s.length);
    const dv = new DataView(b.buffer);
    dv.setUint32(0, 2 * s.length);
    for (let i = 0; i < s.length; i++) dv.setUint16(4 + 2 * i, s.charCodeAt(i));
    this.parts.push(b);
    return this;
  }
  colour() {
    return this.bytes(1).bytes(10, 0x7f);
  }
  /** Spares: i32 count, i32 ×count, i32 count, f64 ×count. */
  spares(ints = 0, doubles = 0) {
    this.i32(ints);
    for (let i = 0; i < ints; i++) this.i32(0);
    this.i32(doubles);
    for (let i = 0; i < doubles; i++) this.f64(0);
    return this;
  }
  done() {
    const n = this.parts.reduce((s, p) => s + p.length, 0);
    const u8 = new Uint8Array(n);
    let o = 0;
    for (const p of this.parts) {
      u8.set(p, o);
      o += p.length;
    }
    return u8;
  }
}

/** Format numbers of the records; the defaults are those flow5 7.57 writes. */
export const LATEST = Object.freeze({
  project: 500754,
  lineStyle: 500756,
  foil: 500753,
  foilPolar: 500750,
  result: 500750,
  part: 500757,
  plane: 500003,
  wing: 500001,
  fuse: 500003,
  stl: 500002,
  meshPlane: 500005,
  mesh: 500002,
});

/** The record formats of flow5 7.53: project 500750, line style 500001, part 500754, no bunch fields in airfoils. */
export const V753 = Object.freeze({ ...LATEST, project: 500750, lineStyle: 500001, foil: 500750, part: 500754 });

function lineStyle(o, f) {
  // Below 500001 the first number is the stipple itself (the layout of flow5 7.12).
  if (f.lineStyle >= 500001) o.i32(f.lineStyle).i32(0);
  else o.i32(0);
  return o.i32(1).i32(0).colour().bool(true).str('');
}

function foilPolar(o, f, { points = 0 } = {}) {
  o.i32(f.foilPolar).str('NACA 0009').str('T1');
  lineStyle(o, f);
  o.i32(1).i32(0).i32(0).i32(0);
  if (f.foilPolar < 500750) o.f64(1).f64(1).f64(1).f64(1);
  else o.f64(100000);
  for (let i = 0; i < 5; i++) o.f64(0);
  o.i32(1).f64(0).f64(0); // one legacy control
  o.i32(12).i32(points);
  for (let i = 0; i < 16 * points; i++) o.f64(i);
  // flow5 reads one double when the count is above 0.
  return o.i32(0).i32(3).f64(0);
}

function spline(o, f, bspline) {
  o.i32(500001);
  lineStyle(o, f);
  o.bool(false).i32(50).i32(2).f64(0).f64(0).f64(1).f64(1).i32(2).f64(1).f64(1);
  o.bool(false).bool(false).f64(0).i32(0).i32(0).spares(1, 1);
  if (bspline) o.i32(3).i32(0).i32(0);
  else o.spares();
  return o;
}

function angleControl(o) {
  return o.i32(500001).str('ctrl').i32(2).f64(1).f64(2);
}

function planePolar(o, f, { points = 1 } = {}) {
  o.i32(500750).str('T1');
  lineStyle(o, f);
  o.i32(0).bool(true).bool(false).bool(false).i32(1);
  o.i32(1).str('drag').f64(0).f64(0);
  o.bytes(2 + 16 + 16 + 16 + 1 + 32 + 48 + 2 + 24 + 1).i32(0).bytes(16 + 1 + 32).i32(0).bytes(1 + 249);
  o.str('Plane').bytes(16 + 2).i32(1).bytes(24);
  o.i32(1);
  angleControl(o);
  o.i32(0).bool(false);
  o.i32(1).i32(1).str('range').f64(0).f64(1); // one group of one range
  o.i32(0).i32(0).bool(false).bool(false).i32(0);
  o.i32(2).i32(points); // two spare values per point
  for (let i = 0; i < points; i++) {
    o.i32(500750);
    o.bytes(27 * 8 + 56 + 128 + 16);
  }
  o.bool(false);
  spline(o, f, true);
  return o.bytes(2 + 8 + 250);
}

function foil(o, f, { name, points, te = [false, 0, 0.7, 0.5] }) {
  o.i32(f.foil).str(name).str('').i32(0).i32(1).i32(0).colour().bool(true).bool(false);
  o.bool(false).bool(te[0]).f64(0).f64(0.2).f64(0.5).f64(te[1]).f64(te[2]).f64(te[3]);
  if (f.foil >= 500753) o.f64(0.7).i32(1);
  o.i32(points.length);
  for (const [x, y] of points) o.f64(x).f64(y);
  return o;
}

function foilResult(o, f) {
  o.i32(0); // kind tag
  o.i32(f.result).str('NACA 0009').str('T1');
  lineStyle(o, f);
  o.i32(0).f64(1e5).f64(0).f64(2);
  if (f.result >= 500750) o.f64(0);
  o.bool(true).bool(true);
  for (let i = 0; i < 10; i++) o.f64(0);
  o.i32(1).i32(0).bool(false).f64(0).f64(0).f64(0).f64(0); // one node
  o.i32(3);
  for (let i = 0; i < 12; i++) o.f64(0); // 3 × (Cpv, Cpi) and 3 × (Qv, Qi)
  // Boundary layer: format, sides, 3 counts, (n1 + 1) + n2 + n3 pairs.
  o.i32(500001).i32(1).i32(1).i32(1).i32(0).i32(2);
  for (let i = 0; i < 2 * (2 + 0 + 2); i++) o.f64(0);
  o.spares();
  return o.spares();
}

function inertia(o, masses = 0) {
  o.i32(500001);
  for (let i = 0; i < 10; i++) o.f64(0);
  o.i32(masses);
  for (let i = 0; i < masses; i++) o.f64(0.1).f64(0).f64(0).f64(0).str('mass');
  return o.spares(5, 5);
}

function part(o, f, name) {
  o.i32(f.part).str(name).str('');
  lineStyle(o, f);
  inertia(o, 1);
  o.bool(true);
  if (f.part >= 500002) o.bool(false);
  if (f.part >= 500754) o.f64(0).f64(0).i32(0).f64(0).f64(0).i32(0);
  return o.spares(0, f.part >= 500757 ? 1 : 0);
}

/** A wing: { name, type (0 main, 1, 2 elevator, 3 fin, 4 other), twoSided, position [x, y, z], rx, ry, sections [{ right, left, chord, y, offset, dihedral, twist }] }. */
function wing(o, f, w) {
  part(o, f, w.name);
  o.i32(f.wing).bool(true).i32(w.sections.length);
  for (const s of w.sections) {
    o.i32(500001).str(s.right).str(s.left ?? s.right);
    o.f64(s.chord).f64(s.y).f64(s.offset ?? 0).f64(s.dihedral ?? 0).f64(s.twist ?? 0);
    o.i32(13).i32(7).i32(1).i32(1);
    o.i32(2).i32(0).i32(0).f64(0).f64(0); // one count for both spare arrays
  }
  o.bool(w.twoSided ?? true).bool(false).bool(false).i32(w.type ?? 0);
  const [x, y, z] = w.position ?? [0, 0, 0];
  o.f64(x).f64(y).f64(z).f64(w.rx ?? 0).f64(w.ry ?? 0).f64(0);
  return o.spares(2, 0);
}

function fuseBase(o, f) {
  part(o, f, 'Body');
  o.i32(f.fuse);
  for (let i = 0; i < 6; i++) o.f64(0);
  if (f.fuse >= 500002) o.bytes(69);
  if (f.fuse >= 500003) o.f64(0);
  return o.i32(0).i32(0);
}

/** A body of `kind` with its panel block; `sectionsTail` writes the section points of flow5 7.56 and older. */
function body(o, f, kind) {
  o.i32(kind);
  if (kind === 100002) {
    fuseBase(o, f);
    o.i32(500001).i32(1).str('DBRep_DrawableShape').spares();
  } else if (kind === 100003) {
    fuseBase(o, f);
    o.i32(f.stl).i32(2);
    for (let i = 0; i < 18; i++) o.f64(i);
    o.spares();
  } else {
    fuseBase(o, f);
    o.i32(500001).i32(kind === 100006 ? 3 : 2);
    // NURBS surface of 2 frames of 3 points each.
    o.i32(500001).colour().i32(3).i32(3).f64(0).f64(0).f64(1).f64(1).i32(0).i32(1).i32(0).i32(2);
    for (let k = 0; k < 2; k++) {
      o.i32(500001).f64(k).f64(0).f64(0).f64(0).i32(3);
      for (let i = 0; i < 9; i++) o.f64(i);
      o.spares();
    }
    o.spares();
    o.i32(10).i32(5).i32(1).i32(1).i32(1).i32(1).i32(1).spares();
    if (kind === 100006 && f.part < 500757) {
      o.i32(500002).i32(2).i32(3);
      for (let i = 0; i < 18; i++) o.f64(i);
      o.f64(0).spares();
    }
  }
  o.i32(500001).i32(1);
  for (let i = 0; i < 9; i++) o.f64(0);
  o.bool(false);
  return o.spares();
}

function xflPlane(o, f, p) {
  o.i32(0).i32(f.plane).i32(p.wings.length).str(p.name).str(p.description ?? '').i32(0).i32(1).i32(0).colour();
  for (const w of p.wings) wing(o, f, w);
  o.i32((p.bodies ?? []).length);
  for (const k of p.bodies ?? []) body(o, f, k);
  if (f.plane >= 500002) {
    o.bool(true);
    inertia(o, 1);
  } else o.i32(1).f64(0.1).f64(0).f64(0).f64(0).str('mass');
  return o.spares(1, 0);
}

function meshPlane(o, f, p) {
  o.i32(1).i32(f.meshPlane).str(p.name).str('');
  if (f.meshPlane >= 500004) o.colour();
  if (f.meshPlane < 500002) o.i32(0).i32(1).i32(0).colour();
  else {
    lineStyle(o, f);
    o.bool(false);
    for (let i = 0; i < 7; i++) o.f64(0);
    inertia(o);
  }
  if (f.meshPlane <= 500002) {
    o.i32(1);
    for (let i = 0; i < 9; i++) o.f64(i);
    return o.spares();
  }
  // Mesh of 2 nodes and 1 panel, then 1 triangle.
  o.i32(f.mesh).i32(2);
  for (let n = 0; n < 2; n++) {
    o.i32(n);
    for (let i = 0; i < 6; i++) o.f64(0);
    o.bool(false).i32(1).i32(1 - n).i32(1).i32(0);
  }
  o.i32(1).i32(0).i32(0).i32(1).i32(0).i32(-1).i32(-1).i32(-1).bool(true).bool(false);
  if (f.mesh >= 500002) o.i32(-1);
  o.i32(0);
  if (f.meshPlane >= 500005) {
    o.i32(500002).i32(1);
    for (let i = 0; i < 9; i++) o.f64(i);
  }
  return o.i32(0).i32(0);
}

/**
 * A .fl5 project.
 * @param {object} spec { formats (default LATEST), foils: [{ name, points, te }], polars (count),
 *   results (count), planes: [{ name, mesh?: true, wings, bodies: [kind…] }], tail (bytes after the planes) }
 * @returns {Uint8Array}
 */
export function writeFl5(spec) {
  const f = { ...LATEST, ...(spec.formats ?? {}) };
  const o = new Out();
  o.i32(f.project);
  foilPolar(o, f);
  planePolar(o, f);
  o.str(null);
  // Spline foil: format, style, 2 B-splines, 5 flags, spares.
  o.i32(500001);
  lineStyle(o, f);
  spline(o, f, true);
  spline(o, f, true);
  o.bytes(5).spares();
  for (let i = 0; i < 3; i++) spline(o, f, true);
  spline(o, f, false);
  o.spares(1, 1);
  o.i32(500750);
  o.i32((spec.foils ?? []).length);
  for (const fo of spec.foils ?? []) foil(o, f, fo);
  o.i32(spec.polars ?? 0);
  for (let i = 0; i < (spec.polars ?? 0); i++) foilPolar(o, f, { points: 2 });
  o.i32(spec.results ?? 0);
  for (let i = 0; i < (spec.results ?? 0); i++) foilResult(o, f);
  o.i32(spec.planes.length);
  for (const p of spec.planes) {
    if (p.mesh) meshPlane(o, f, p);
    else xflPlane(o, f, p);
  }
  // What follows the planes: no analyses, results or boats.
  for (const v of spec.tail ?? [0, 0, 0, 500750, 0, 0, 0, 0, 0]) o.i32(v);
  return o.done();
}

/** A NACA 0009-like airfoil of 7 points (trailing edge, upper side, nose, lower side). */
export const FOIL_POINTS = [
  [1, 0.001],
  [0.5, 0.03],
  [0.1, 0.03],
  [0, 0],
  [0.1, -0.03],
  [0.5, -0.03],
  [1, -0.001],
];
