// Big-endian writer of XFLR5 project files (.xfl) for the tests, written from the format description in
// src/import/xfl.js, not from XFLR5 code. Every record takes plain options
// with defaults, so a test states only what it is about. Numbers the reader skips are written as
// recognizable non-zero values: a reader that skips too few or too many bytes misreads what follows.
// The spare blocks of wings and planes hold the fixed values XFLR5 writes, which the reader checks.
//
// writeProject(options) returns { bytes, marks }: marks lists the offset of every record (and of
// every count before a list) with a label, for truncation tests.

/** Growable big-endian byte buffer with QDataStream primitives. */
export class XflWriter {
  constructor() {
    this.buf = new Uint8Array(4096);
    this.dv = new DataView(this.buf.buffer);
    this.length = 0;
    this.marks = [];
  }

  room(k) {
    if (this.length + k <= this.buf.length) return;
    const next = new Uint8Array(Math.max(2 * this.buf.length, this.length + k));
    next.set(this.buf.subarray(0, this.length));
    this.buf = next;
    this.dv = new DataView(next.buffer);
  }

  /** Record the current offset under `label`. */
  mark(label) {
    this.marks.push({ at: this.length, label });
    return this;
  }

  i32(v) {
    this.room(4);
    this.dv.setInt32(this.length, v);
    this.length += 4;
    return this;
  }

  u32(v) {
    this.room(4);
    this.dv.setUint32(this.length, v);
    this.length += 4;
    return this;
  }

  f64(v) {
    this.room(8);
    this.dv.setFloat64(this.length, v);
    this.length += 8;
    return this;
  }

  bool(v) {
    return this.u8(v ? 1 : 0);
  }

  u8(v) {
    this.room(1);
    this.buf[this.length++] = v;
    return this;
  }

  /** k bytes of the value `fill` (default 0x5a). */
  fill(k, fill = 0x5a) {
    this.room(k);
    this.buf.fill(fill, this.length, this.length + k);
    this.length += k;
    return this;
  }

  /** QString: null writes the null string (0xFFFFFFFF); { raw: n } writes the byte count n and n bytes. */
  str(s) {
    if (s === null) return this.u32(0xffffffff);
    if (typeof s === 'object') return this.u32(s.raw).fill(s.raw, 0x41);
    this.u32(2 * s.length);
    for (let i = 0; i < s.length; i++) {
      this.room(2);
      this.dv.setUint16(this.length, s.charCodeAt(i));
      this.length += 2;
    }
    return this;
  }

  /** QColor: 11 bytes. */
  color() {
    return this.u8(1).fill(10, 0x7f);
  }

  /** The written bytes. */
  bytes() {
    return this.buf.slice(0, this.length);
  }
}

/** Line style of the old layout (21 bytes). */
export function styleOld(w) {
  return w.i32(1).i32(2).color().bool(true).u8(3);
}

/** Line style of XFLR5 6.49 on (24 bytes). */
export function styleXfl(w) {
  return w.i32(1).i32(2).i32(3).color().bool(true);
}

/** Line style of a plane (StyleFl5): k >= 500001 adds one i32 before the width. */
export function styleFl5(w, { k = 500001, tag = 'style' } = {}) {
  w.i32(k);
  if (k >= 500001) w.i32(1);
  return w.i32(2).i32(3).color().bool(true).str(tag);
}

function pointMasses(w, masses = []) {
  w.i32(masses.length);
  for (const m of masses) w.f64(m.mass ?? 0.1).f64(m.x ?? 1).f64(m.y ?? 2).f64(m.z ?? 3).str(m.tag ?? 'mass');
  return w;
}

/** Two sections of a plain wing, in metres. */
export const SECTIONS = [
  { rightFoil: 'Foil A', leftFoil: 'Foil A', chord: 0.2, y: 0, offset: 0, dihedral: 2, twist: 0 },
  { rightFoil: 'Foil B', leftFoil: 'Foil B', chord: 0.1, y: 0.5, offset: 0.05, dihedral: 0, twist: -2 },
];

/** Wing (format 100001). `count` overrides the section count. */
export function wing(w, { format = 100001, name = 'Wing', description = '', symmetric = true, sections = SECTIONS, count, masses = [], type = 0 } = {}) {
  w.mark('wing').i32(format).str(name).str(description).color().bool(symmetric);
  w.mark('sections').i32(count ?? sections.length);
  for (const s of sections) {
    const right = s.rightFoil === undefined ? 'Foil A' : s.rightFoil;
    w.mark('section').str(right).str(s.leftFoil === undefined ? right : s.leftFoil);
    w.f64(s.chord).f64(s.y).f64(s.offset ?? 0).f64(s.dihedral ?? 0).f64(s.twist ?? 0);
    w.i32(13).i32(8).i32(1).i32(-2); // panel counts and distributions
  }
  w.f64(0.25); // volume mass
  pointMasses(w.mark('wing masses'), masses);
  // Spare block: 1 (formerly a texture flag), 18 zeros, the type, 50 zeros.
  w.mark('wing spare').i32(1);
  for (let i = 0; i < 18; i++) w.i32(0);
  w.i32(type);
  for (let i = 0; i < 50; i++) w.f64(0);
  return w;
}

/** Body with hoop panels and frames of the given point counts. */
export function body(w, { format = 100001, name = 'Body', hoops = [3, 4], frames = [5, 5, 3], masses = [] } = {}) {
  w.mark('body').i32(format).str(name).str('body description').color();
  w.i32(1).i32(2).i32(5).i32(6).f64(0.5); // line type, resolution, panel counts, bunch factor
  w.i32(hoops.length);
  for (const h of hoops) w.i32(h);
  w.i32(frames.length);
  for (const n of frames) {
    w.mark('frame').i32(4).f64(0.1); // x panels, position
    w.i32(1000).i32(n);
    for (let i = 0; i < n; i++) w.f64(0.1 * i).f64(0.2).f64(0.3);
  }
  w.f64(0.5); // volume mass
  pointMasses(w, masses);
  for (let i = 0; i < 20; i++) w.i32(3);
  for (let i = 0; i < 50; i++) w.f64(2.5);
  return w;
}

/**
 * Plane: format 100002 has a StyleFl5 (`style` its options), 100001 none. `wings` are the options of
 * the 4 slots, `positions` the leading edge x, y, z and tilt of each slot.
 */
export function plane(
  w,
  {
    format = 100002,
    name = 'Plane',
    description = '',
    style = {},
    wings = [{ name: 'Main Wing' }, { name: 'Second Wing' }, { name: 'Elevator' }, { name: 'Fin' }],
    biplane = false,
    stab = true,
    fin = true,
    positions = [
      [0, 0, 0, 0],
      [0, 0, 0.1, 0],
      [0.6, 0, 0.02, -1],
      [0.62, 0, 0, 0],
    ],
    body: bodyOptions = null,
    masses = [],
  } = {},
) {
  w.mark('plane').i32(format).str(name).str(description);
  if (format >= 100002) styleFl5(w, style);
  for (const o of wings) wing(w, o);
  w.mark('flags').bool(biplane).bool(stab).bool(fin).bool(false).bool(true).bool(false);
  w.mark('positions');
  for (const p of positions) for (const v of p) w.f64(v);
  w.mark('body flag').bool(!!bodyOptions).f64(0.01).f64(0.02);
  if (bodyOptions) body(w.str(bodyOptions.name ?? 'Body'), bodyOptions);
  pointMasses(w.mark('plane masses'), masses);
  w.mark('plane spare');
  for (let i = 0; i < 20; i++) w.i32(0);
  for (let i = 0; i < 50; i++) w.f64(0);
  return w;
}

/** WPolar (analysis): format 200012, 200013 (old style) or 200014; `points` result rows of 36 f64. */
export function wpolar(w, { format = 200014, gains = [], points = 0 } = {}) {
  w.mark('analysis').i32(format).str('Plane').str('T1-10 m/s');
  w.f64(0.3).f64(0.2).f64(1.5); // reference area, chord, span
  if (format < 200014) styleOld(w);
  else styleXfl(w);
  w.i32(2).i32(1); // method, type
  for (let i = 0; i < 7; i++) w.bool(i % 2 === 0);
  w.f64(0.1).f64(1.225).f64(1.5e-5).i32(1).bool(true); // height, density, viscosity, reference dimension, auto inertia
  for (let i = 0; i < 8; i++) w.f64(0.5 + i); // mass, centre of gravity, inertia
  w.i32(gains.length);
  for (const g of gains) w.f64(g);
  w.i32(1).f64(1).f64(1.1).f64(10).f64(2).f64(0); // wake panels, length, factor, speed, alpha, beta
  w.i32(points);
  for (let i = 0; i < Math.max(0, points) * 36; i++) w.f64(i * 0.25);
  for (let i = 0; i < 20; i++) w.i32(4);
  for (let i = 0; i < 50; i++) w.f64(4.5);
  return w;
}

/** WingOpp (result of one wing): `stations` rows of 22 f64, `flaps` flap moments. */
export function wingOpp(w, { stations = 3, flaps = 2 } = {}) {
  w.mark('wing result').i32(200004).str('Main Wing').str('T1').i32(2).bool(true);
  w.i32(stations);
  w.i32(1).i32(2).i32(3); // i32 ×3
  for (let i = 0; i < 21; i++) w.f64(0.1 * i);
  for (let i = 0; i < 22 * stations; i++) w.f64(i);
  w.i32(flaps);
  for (let i = 0; i < flaps; i++) w.f64(-i);
  for (let i = 0; i < 20; i++) w.i32(5);
  for (let i = 0; i < 50; i++) w.f64(5.5);
  return w;
}

/**
 * PlaneOpp (plane result): method 1 (LLT) stores no panel arrays; `wingOpps` the options of the 4
 * slots, null where the slot has no result.
 */
export function planeOpp(w, { format = 200002, method = 2, panels = 4, wingOpps = [{}, null, {}, null] } = {}) {
  w.mark('result').i32(format).str('Plane').str('T1-10 m/s');
  if (format < 200002) styleOld(w);
  else styleXfl(w);
  w.bool(true).bool(false).bool(true).bool(false).i32(1); // 4 bools, analysis type
  w.i32(method).i32(panels);
  w.i32(6); // stations
  for (let i = 0; i < 5; i++) w.f64(i + 0.5);
  if (method !== 1) for (let i = 0; i < 3 * panels; i++) w.f64(i * 0.125);
  for (const o of wingOpps) {
    w.i32(o ? 1 : 0);
    if (o) wingOpp(w, o);
  }
  for (let i = 0; i < 32; i++) w.f64(i);
  w.i32(7);
  for (let i = 0; i < 127; i++) w.f64(i);
  for (let i = 0; i < 20; i++) w.i32(6);
  for (let i = 0; i < 50; i++) w.f64(6.5);
  return w;
}

/** A small closed airfoil (5 points, Selig order). */
export const POINTS = [
  [1, 0],
  [0.5, 0.06],
  [0, 0],
  [0.5, -0.04],
  [1, 0],
];

/** Foil (airfoil): format 100006 (old style) or 100007; `count` overrides the point count. */
export function foil(w, { format = 100007, name = 'Foil A', description = 'airfoil', le = {}, te = {}, points = POINTS, count } = {}) {
  w.mark('airfoil').i32(format).str(name).str(description);
  if (format < 100007) styleOld(w);
  else styleXfl(w);
  w.bool(true).bool(le.on ?? false).bool(te.on ?? false);
  w.f64(le.angle ?? 0).f64(le.hingeX ?? 20).f64(le.hingeY ?? 50);
  w.f64(te.angle ?? 0).f64(te.hingeX ?? 70).f64(te.hingeY ?? 50);
  w.i32(count ?? points.length);
  for (const [x, y] of points) w.f64(x).f64(y);
  return w;
}

/**
 * Whole project: format 200001 (82-byte default analysis) or 200002 (a WPolar, `defaultAnalysis` its
 * options), then planes, analyses, results and airfoils, each list after its count (`planeCount`
 * overrides the plane count), and a short tail (polars, operating points, trailer) that the reader
 * does not need.
 */
export function writeProject({
  format = 200002,
  units = [0, 4, 1, 0, 1, 0],
  defaultAnalysis = {},
  planes = [{}],
  planeCount,
  analyses = [],
  results = [],
  foils = [{ name: 'Foil A' }, { name: 'Foil B' }],
} = {}) {
  const w = new XflWriter();
  w.mark('format').i32(format);
  w.mark('units');
  for (const u of units) w.i32(u);
  w.mark('default analysis');
  if (format === 200001) w.i32(1).i32(2).fill(5 * 8 + 2 * 8 + 2 * 8, 0x3f).bool(true).bool(false);
  else wpolar(w, defaultAnalysis);
  w.mark('planes').i32(planeCount ?? planes.length);
  for (const p of planes) plane(w, p);
  w.mark('analyses').i32(analyses.length);
  for (const a of analyses) wpolar(w, a);
  w.mark('results').i32(results.length);
  for (const r of results) planeOpp(w, r);
  w.mark('airfoils').i32(foils.length);
  for (const f of foils) foil(w, f);
  w.mark('end of airfoils');
  w.i32(0).i32(0).fill(480, 0); // no polars, no operating points, trailer
  return { bytes: w.bytes(), marks: w.marks };
}
