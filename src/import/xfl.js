// XFLR5 project reader (.xfl, written by XFLR5 6.10.01 to 6.62; flow5 writes the same format without planes).
//
// The file is a Qt QDataStream with default settings: big-endian, and every C++ float is stored as an
// 8-byte double. A string is a u32 byte count (0xFFFFFFFF = null string, read as "") followed by UTF-16BE.
// Records have no length prefix, but every variable part follows a count, so the analyses and their
// results are skipped without decoding them. Lengths are in metres, angles in degrees.
//
//   i32 project format        200001 (XFLR5 6.10.01 to 6.43) or 200002 (6.44 to 6.62)
//   i32 ×6 display units      not needed: the lengths in the file are metres whatever the user chose
//   default analysis          82 bytes (200001) or a WPolar (200002)
//   i32 n, Plane ×n           read: names, 4 wing slots, which slots exist, positions and tilts
//   i32 n, WPolar ×n          analyses, skipped
//   i32 n, PlaneOpp ×n        analysis results, skipped
//   i32 n, Foil ×n            read: name, flap settings, base coordinates; reading stops here
//
// A file damaged after the planes still gives its planes, without airfoils (XFLR5 keeps "the valid
// part" as well). Real projects with results reach 100 MB: readXfl() loads the file through a window
// (blob.slice) and a skip only moves the offset. The record readers are generators that yield when
// the next read lies outside the window; readXfl() then loads the window and resumes them, while
// readXflBytes() holds the whole file in memory and never needs to.

import { LIMITS } from '../model/project.js';
import { count, fixed, tr, whole } from '../i18n/index.js';
import { XflrError } from './errors.js';

/** Default size in bytes of the window through which readXfl() loads the file. */
export const WINDOW_SIZE = 4 * 1024 * 1024;
/** Largest accepted file in bytes: a sanity cap, real projects with results stay near 100 MB. */
export const MAX_XFL_BYTES = 2_000_000_000;
/** Most planes in one project (also the limit of the XML reader). */
export const MAX_PLANES = 10_000;
/** Most wing sections of all planes together: each takes about twice its 64 file bytes in memory. */
export const MAX_TOTAL_SECTIONS = 1_000_000;
/**
 * Most airfoil points read in all, twice what a project holds (LIMITS.maxAirfoilPoints): each takes
 * about 70 bytes of memory. Airfoils beyond it are skipped and reported.
 */
export const MAX_FOIL_POINTS = 2_000_000;
/** Most airfoils read, as many as a project holds; the rest of the list is not read. */
export const MAX_FOILS = LIMITS.maxAirfoils;
/**
 * Most points of one airfoil: XFLR5 holds at most 604 (IBX of its XFoil code, the size of the base
 * coordinate arrays), so a larger count means damage.
 */
export const MAX_XFLR5_FOIL_POINTS = 1000;
// Longest decoded name or description in bytes (UTF-16: half as many characters). XFLR5 writes short
// texts; a longer count means damage. Strings of skipped records are not decoded and have no cap.
const MAX_TEXT_BYTES = 1 << 20;
// Decoded names and descriptions of the whole file together, in bytes.
const MAX_TEXT_TOTAL = 64_000_000;

const COLOR = 11; // QColor: i8 spec, u16 ×5
const STYLE_OLD = 21; // i32 stipple, i32 width, color, bool visible, i8 point style
const STYLE_XFL = 24; // i32 stipple, i32 width, i32 point style, color, bool visible
const SPARE = 20 * 4 + 50 * 8; // i32 ×20, f64 ×50 reserved at the end of most records
const SECTION_BYTES = 4 + 4 + 5 * 8 + 4 * 4; // the smallest wing section: two null strings
const UTF16 = new TextDecoder('utf-16be');

/** XflrError 'damaged' at byte `offset`; `what` names the part being read (see the cases below). */
function damaged(what, offset) {
  const n = whole(offset);
  let message;
  switch (what) {
    case 'planes':
      message = tr('The file is damaged or cut off at byte {n} (in the list of planes).', { n });
      break;
    case 'plane':
      message = tr('The file is damaged or cut off at byte {n} (in a plane).', { n });
      break;
    case 'wing':
      message = tr('The file is damaged or cut off at byte {n} (in a wing).', { n });
      break;
    case 'section':
      message = tr('The file is damaged or cut off at byte {n} (in a wing section).', { n });
      break;
    case 'body':
      message = tr('The file is damaged or cut off at byte {n} (in the body of a plane).', { n });
      break;
    case 'analyses':
      message = tr('The file is damaged or cut off at byte {n} (in the list of analyses).', { n });
      break;
    case 'analysis':
      message = tr('The file is damaged or cut off at byte {n} (in an analysis).', { n });
      break;
    case 'results':
      message = tr('The file is damaged or cut off at byte {n} (in the list of analysis results).', { n });
      break;
    case 'result':
      message = tr('The file is damaged or cut off at byte {n} (in an analysis result).', { n });
      break;
    case 'airfoils':
      message = tr('The file is damaged or cut off at byte {n} (in the list of airfoils).', { n });
      break;
    case 'airfoil':
      message = tr('The file is damaged or cut off at byte {n} (in an airfoil).', { n });
      break;
    default:
      message = tr('The file is damaged or cut off at byte {n} (in the project header).', { n });
  }
  return Object.assign(new XflrError('damaged', message, offset), { what });
}

/** Big-endian reader over a window of the file; the generator methods yield when the window must move. */
class Reader {
  constructor(size) {
    this.size = size;
    this.o = 0;
    // Wing sections, airfoil points and decoded text bytes read so far (MAX_TOTAL_SECTIONS,
    // MAX_FOIL_POINTS, MAX_TEXT_TOTAL).
    this.sections = 0;
    this.foilPoints = 0;
    this.text = 0;
    this.window(0, new Uint8Array(0));
  }

  /** Make `bytes`, the file from byte `base` on, the window. */
  window(base, bytes) {
    this.base = base;
    this.buf = bytes;
    this.dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  /** Throws when fewer than k bytes remain in the file; yields k when they lie outside the window. */
  *need(k, what) {
    if (!(k <= this.size - this.o)) throw damaged(what, this.o);
    if (this.o + k <= this.base + this.buf.length) return;
    yield k;
    // A file that shrank while it was read gives a short window.
    if (this.o + k > this.base + this.buf.length) throw damaged(what, this.o);
  }

  /** Move on k bytes without reading them. */
  skip(k, what) {
    if (!(k >= 0 && k <= this.size - this.o)) throw damaged(what, this.o);
    this.o += k;
  }

  *i32(what) {
    yield* this.need(4, what);
    const v = this.dv.getInt32(this.o - this.base);
    this.o += 4;
    return v;
  }

  *f64(what) {
    yield* this.need(8, what);
    return this.f64Now();
  }

  /** The next f64, already inside the window. */
  f64Now() {
    const v = this.dv.getFloat64(this.o - this.base);
    this.o += 8;
    return v;
  }

  *bool(what) {
    yield* this.need(1, what);
    return this.buf[this.o++ - this.base] !== 0;
  }

  /** Byte count of the string at the offset (null string: 0); odd counts are damage. */
  *strLength(what) {
    const at = this.o;
    yield* this.need(4, what);
    const len = this.dv.getUint32(this.o - this.base);
    this.o += 4;
    if (len === 0xffffffff) return 0;
    if (len % 2) throw damaged(what, at);
    return len;
  }

  *str(what) {
    const at = this.o;
    const len = yield* this.strLength(what);
    if (len > MAX_TEXT_BYTES || len > this.size - this.o) throw damaged(what, at);
    this.text += len;
    if (this.text > MAX_TEXT_TOTAL) {
      const err = new XflrError('too-large', tr('The names in the file hold more than {max} MB together.', { max: whole(MAX_TEXT_TOTAL / 1e6) }), at);
      throw Object.assign(err, { what });
    }
    yield* this.need(len, what);
    const s = UTF16.decode(this.buf.subarray(this.o - this.base, this.o - this.base + len));
    this.o += len;
    return s;
  }

  *skipStr(what) {
    const at = this.o;
    const len = yield* this.strLength(what);
    if (len > this.size - this.o) throw damaged(what, at);
    this.o += len;
  }

  /** A count: 0 to `max`, and `itemBytes` per item must fit in the rest of the file. */
  *count(what, max = Infinity, itemBytes = 0) {
    const at = this.o;
    const n = yield* this.i32(what);
    if (n < 0 || n > max || n * itemBytes > this.size - this.o) throw damaged(what, at);
    return n;
  }

  /** A record format number, lo to hi. */
  *format(what, lo, hi) {
    const at = this.o;
    const f = yield* this.i32(what);
    if (f < lo || f > hi) throw damaged(what, at);
    return f;
  }
}

/**
 * Check a spare block (SPARE bytes, already in the window) and move past it. XFLR5 writes fixed values
 * there: 20 i32 and 50 f64 zeros, except that a wing writes 0 or 1 first (formerly a texture flag) and
 * its type (0 to 4) last. Records have no end mark: other values show a read that has lost its place,
 * after a damaged count, say.
 */
function checkSpare(r, what, wing) {
  const at = r.o;
  const o = at - r.base;
  for (let i = 0; i < 20; i++) {
    const v = r.dv.getInt32(o + 4 * i);
    const ok = wing && i === 0 ? v === 0 || v === 1 : wing && i === 19 ? v >= 0 && v <= 4 : v === 0;
    if (!ok) throw damaged(what, at);
  }
  for (let i = 0; i < 50; i++) if (r.dv.getFloat64(o + 80 + 8 * i) !== 0) throw damaged(what, at);
  r.o += SPARE;
}

/** Position component or tilt as XFLR5 loads it: NaN, below 1e-6 and above 1000 in magnitude become 0. */
function sanitize(v) {
  return Number.isNaN(v) || Math.abs(v) < 1e-6 || Math.abs(v) > 1000 ? 0 : v;
}

/** Skip a line style of a plane (StyleFl5): a first number of 500001 or more marks the layout with one more i32. */
function* skipStyleFl5(r, what) {
  const k = yield* r.i32(what);
  if (k >= 500001) r.skip(4, what);
  r.skip(4 + 4 + COLOR + 1, what); // width, point style, color, visible
  yield* r.skipStr(what); // tag
}

/** Skip a list of point masses: f64 mass, x, y, z and a tag each. */
function* skipPointMasses(r, what) {
  const n = yield* r.count(what);
  for (let i = 0; i < n; i++) {
    r.skip(32, what);
    yield* r.skipStr(what);
  }
}

/** One wing slot: names, symmetry and the sections (file units: metres and degrees). */
function* readWing(r) {
  yield* r.format('wing', 100000, 100001);
  const name = yield* r.str('wing');
  const description = yield* r.str('wing');
  r.skip(COLOR, 'wing');
  const symmetric = yield* r.bool('wing');
  const n = yield* r.count('wing', Infinity, SECTION_BYTES);
  // Sections that fit in the file but beyond what Wingdesigner holds: too large, not damaged.
  if (n > LIMITS.maxSections) throw new XflrError('too-large', tr('A wing of the file has {n} sections; at most {max} can be read.', { n: count(n), max: count(LIMITS.maxSections) }));
  r.sections += n;
  if (r.sections > MAX_TOTAL_SECTIONS) {
    throw new XflrError('too-large', tr('The planes of the file hold more than {max} wing sections together; the file is not read.', { max: count(MAX_TOTAL_SECTIONS) }));
  }
  const sections = [];
  for (let i = 0; i < n; i++) {
    const rightFoil = yield* r.str('section');
    const leftFoil = yield* r.str('section');
    // Chord comes before the span position.
    const chord = yield* r.f64('section');
    const y = yield* r.f64('section');
    const offset = yield* r.f64('section');
    const dihedral = yield* r.f64('section');
    const twist = yield* r.f64('section');
    r.skip(16, 'section'); // VLM panel counts and distributions
    sections.push({ rightFoil, leftFoil, chord, y, offset, dihedral, twist });
  }
  r.skip(8, 'wing'); // volume mass
  yield* skipPointMasses(r, 'wing');
  // The last spare i32 is a type code; the plane slot decides the role.
  yield* r.need(SPARE, 'wing');
  checkSpare(r, 'wing', true);
  return { name, description, symmetric, sections };
}

/** Skip a body (fuselage) with its frames. */
function* skipBody(r) {
  yield* r.format('body', 100000, 200000);
  yield* r.skipStr('body'); // name
  yield* r.skipStr('body'); // description
  r.skip(COLOR + 16 + 8, 'body'); // color, line type, resolution, panel counts, bunch factor
  const hoops = yield* r.count('body');
  r.skip(4 * hoops, 'body');
  const frames = yield* r.count('body');
  for (let i = 0; i < frames; i++) {
    r.skip(12, 'body'); // x panels, position
    yield* r.format('body', 1000, 1100);
    const points = yield* r.count('body');
    r.skip(24 * points, 'body');
  }
  r.skip(8, 'body'); // volume mass
  yield* skipPointMasses(r, 'body');
  r.skip(SPARE, 'body');
}

/** One plane: 4 wing slots (main wing, second wing, elevator, fin), null where the plane has none. */
function* readPlane(r) {
  const format = yield* r.format('plane', 100001, 110000);
  const name = yield* r.str('plane');
  const description = yield* r.str('plane');
  if (format >= 100002) yield* skipStyleFl5(r, 'plane');
  const slots = [];
  for (let i = 0; i < 4; i++) slots.push(yield* readWing(r));
  const biplane = yield* r.bool('plane');
  const stab = yield* r.bool('plane');
  const fin = yield* r.bool('plane');
  r.skip(3, 'plane'); // double fin, symmetric fin, spare
  // Leading edge x, y, z and tilt of each slot.
  const wings = [];
  for (const w of slots) {
    yield* r.need(32, 'plane');
    const x = sanitize(r.f64Now());
    const y = sanitize(r.f64Now());
    const z = sanitize(r.f64Now());
    const tilt = sanitize(r.f64Now());
    wings.push({ name: w.name, description: w.description, symmetric: w.symmetric, position: { x, y, z }, tilt, sections: w.sections });
  }
  const hasBody = yield* r.bool('plane');
  r.skip(16, 'plane'); // body x, z
  if (hasBody) {
    yield* r.skipStr('body'); // body name
    yield* skipBody(r);
  }
  yield* skipPointMasses(r, 'plane');
  yield* r.need(SPARE, 'plane');
  checkSpare(r, 'plane', false);
  // Unused slots still hold default wings: the flags say which exist. The main wing always does.
  return { name, description, wings: [wings[0], biplane ? wings[1] : null, stab ? wings[2] : null, fin ? wings[3] : null] };
}

/** Skip a WPolar (analysis): format 200012 (XFLR5 6.10 to 6.12), 200013 (to 6.48), 200014 (6.49 on). */
function* skipWPolar(r, what) {
  const format = yield* r.format(what, 200000, 205000);
  yield* r.skipStr(what); // plane name
  yield* r.skipStr(what); // analysis name
  r.skip(24, what); // reference area, chord, span
  r.skip(format < 200014 ? STYLE_OLD : STYLE_XFL, what);
  // Method and type, 7 bools, ground height, density and viscosity, reference dimension, automatic
  // inertia, mass, centre of gravity and inertia.
  r.skip(8 + 7 + 8 + 16 + 4 + 1 + 64, what);
  const gains = yield* r.count(what);
  r.skip(8 * gains, what); // control gains
  r.skip(44, what); // wake panels, wake length and factor, speed, alpha, beta
  // Results: 20 values and 8 complex eigenvalues per point. XFLR5 refuses more than 10,000 and
  // reads a negative count as none.
  const at = r.o;
  const points = yield* r.i32(what);
  if (Math.abs(points) > 10_000) throw damaged(what, at);
  r.skip(288 * Math.max(0, points), what);
  r.skip(SPARE, what);
}

/** Skip a WingOpp (the result of one wing inside a plane result). */
function* skipWingOpp(r) {
  r.skip(4, 'result'); // format
  yield* r.skipStr('result');
  yield* r.skipStr('result');
  r.skip(5, 'result'); // method, bool
  const stations = yield* r.count('result');
  r.skip(180 + 176 * stations, 'result'); // i32 ×3, f64 ×21, then 22 f64 per station
  const flaps = yield* r.count('result');
  r.skip(8 * flaps, 'result'); // flap moments
  r.skip(SPARE, 'result');
}

/** Skip a PlaneOpp (plane result): format 200001 (to XFLR5 6.48) or 200002 (6.49 on). */
function* skipPlaneOpp(r) {
  const format = yield* r.format('result', 200000, 200100);
  yield* r.skipStr('result'); // plane name
  yield* r.skipStr('result'); // analysis name
  r.skip(format < 200002 ? STYLE_OLD : STYLE_XFL, 'result');
  r.skip(8, 'result'); // 4 bools, analysis type
  const method = yield* r.i32('result');
  const panels = yield* r.count('result');
  r.skip(44, 'result'); // station count, 5 f64
  if (method !== 1) r.skip(24 * panels, 'result'); // 3 values per panel, except for method 1 (LLT)
  for (let i = 0; i < 4; i++) if ((yield* r.i32('result')) !== 0) yield* skipWingOpp(r);
  r.skip(32 * 8 + 4 + 127 * 8 + SPARE, 'result');
}

/**
 * One airfoil: name, flap settings (angles in degrees, hinges in % of chord and thickness), base
 * coordinates. Beyond MAX_FOIL_POINTS in all, the points are skipped (`points` null).
 */
function* readFoil(r) {
  // XFLR5 writes 100006 (to 6.48) and 100007 (6.49 on) without checking it; far off means damage.
  const format = yield* r.format('airfoil', 100000, 110000);
  const name = yield* r.str('airfoil');
  yield* r.skipStr('airfoil'); // description
  r.skip(format < 100007 ? STYLE_OLD : STYLE_XFL, 'airfoil');
  r.skip(1, 'airfoil'); // centre line shown
  const leOn = yield* r.bool('airfoil');
  const teOn = yield* r.bool('airfoil');
  yield* r.need(48, 'airfoil');
  const le = { on: leOn, angle: r.f64Now(), hingeX: r.f64Now(), hingeY: r.f64Now() };
  const te = { on: teOn, angle: r.f64Now(), hingeX: r.f64Now(), hingeY: r.f64Now() };
  // The base (undeflected) shape; XFLR5 applies the flaps after loading.
  const n = yield* r.count('airfoil', MAX_XFLR5_FOIL_POINTS, 16);
  if (r.foilPoints + n > MAX_FOIL_POINTS) {
    r.skip(16 * n, 'airfoil');
    return { name, points: null, flaps: { le, te } };
  }
  r.foilPoints += n;
  yield* r.need(16 * n, 'airfoil');
  const points = [];
  for (let i = 0; i < n; i++) points.push([r.f64Now(), r.f64Now()]);
  return { name, points, flaps: { le, te } };
}

const hex = (bytes) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join(' ');

/** First big-endian i32 of a flow5 7.x project (.fl5): 500001 to 500754 so far. */
const isFlow5 = (first) => first >= 500_000 && first < 510_000;

/** First little-endian i32 of a .wpa project of XFLR5 6.09 and older: its format, 100000 to 100013. */
const isWpa = (little) => little >= 100_000 && little <= 100_100;

/** Check the first number: the project format, or the start of another known file. */
function* readProjectFormat(r) {
  yield* r.need(Math.min(4, r.size), 'header');
  if (r.size === 0) throw new XflrError('not-xflr5', tr('The file is empty, not an XFLR5 project.'));
  const value = hex(r.buf.subarray(0, Math.min(4, r.size)));
  if (r.size < 4) throw new XflrError('not-xflr5', tr('The file is not an XFLR5 project (it starts with {value}).', { value }));
  const first = r.dv.getInt32(0);
  if (isFlow5(first)) throw new XflrError('flow5', tr('The file is a flow5 project (.fl5); only XFLR5 files can be imported.'));
  if (isWpa(r.dv.getInt32(0, true))) throw new XflrError('wpa', tr('The file is a .wpa project of XFLR5 6.09 or older: open it in XFLR5 6.62 and save it as .xfl.'));
  if (first !== 200001 && first !== 200002) throw new XflrError('not-xflr5', tr('The file is not an XFLR5 project (it starts with {value}).', { value }));
  r.o = 4;
  return first;
}

/** The whole reading: the planes, then the airfoils when the part after the planes is intact. */
function* readProject(r) {
  if (r.size > MAX_XFL_BYTES) {
    throw new XflrError('too-large', tr('The file is {size} MB; XFLR5 projects above {limit} MB are not read.', { size: fixed(r.size / 1e6, 1), limit: whole(MAX_XFL_BYTES / 1e6) }));
  }
  const format = yield* readProjectFormat(r);
  r.skip(24, 'header'); // display units
  if (format === 200001) r.skip(82, 'header'); // default analysis settings of the old layout
  else yield* skipWPolar(r, 'header');
  const n = yield* r.count('planes', MAX_PLANES);
  if (n === 0) throw new XflrError('no-plane', tr('The project holds no plane (airfoil-only projects and .xfl files saved by flow5 have none).'));
  const planes = [];
  for (let i = 0; i < n; i++) planes.push(yield* readPlane(r));

  let foils = new Map();
  let foilError = null;
  const warnings = [];
  try {
    const analyses = yield* r.count('analyses');
    for (let i = 0; i < analyses; i++) yield* skipWPolar(r, 'analysis');
    const results = yield* r.count('results');
    for (let i = 0; i < results; i++) yield* skipPlaneOpp(r);
    const n = yield* r.count('airfoils');
    let skipped = 0;
    for (let i = 0; i < n; i++) {
      // Nothing after the airfoils is needed: the list ends here.
      if (i === MAX_FOILS) {
        warnings.push(tr('Only the first {max} of the {n} airfoils of the file were read.', { max: count(MAX_FOILS), n: count(n) }));
        break;
      }
      const foil = yield* readFoil(r);
      // A later airfoil of the same name replaces the earlier one (a skipped one too: the name then
      // finds none). An empty name finds no airfoil in XFLR5, so such airfoils are left out.
      if (!foil.points) skipped++;
      if (!foil.name) continue;
      foils.delete(foil.name);
      if (foil.points) foils.set(foil.name, foil);
    }
    if (skipped === 1) warnings.push(tr('1 airfoil was not read: the airfoils of the file hold more than {max} points together.', { max: count(MAX_FOIL_POINTS) }));
    else if (skipped) warnings.push(tr('{n} airfoils were not read: the airfoils of the file hold more than {max} points together.', { n: count(skipped), max: count(MAX_FOIL_POINTS) }));
  } catch (err) {
    // Damage, or names beyond MAX_TEXT_TOTAL, in the part after the planes: the planes stay.
    if (!(err instanceof XflrError)) throw err;
    foils = null;
    foilError = { offset: err.offset, what: err.what };
    warnings.push(tr('The airfoils could not be read. {problem} Pick or upload them.', { problem: err.message }));
  }
  return { kind: 'xfl', format, version: null, lengthUnit: 1000, unitName: 'm', wingOnly: false, planes, foils, foilError, warnings };
}

/**
 * Read an XFLR5 project from a Blob (or File) through a window of `windowSize` bytes.
 * Throws XflrError for files that cannot be imported; a failed blob read rejects with the browser's error.
 * @param {Blob} blob
 * @param {{ windowSize?: number }} [options]
 */
export async function readXfl(blob, { windowSize = WINDOW_SIZE } = {}) {
  const r = new Reader(blob.size);
  const run = readProject(r);
  for (let step = run.next(); ; step = run.next()) {
    if (step.done) return step.value;
    const from = r.o;
    const to = Math.min(r.size, from + Math.max(windowSize, step.value));
    r.window(from, new Uint8Array(await blob.slice(from, to).arrayBuffer()));
  }
}

/**
 * Read an XFLR5 project held in memory; the same result as readXfl().
 * @param {Uint8Array|ArrayBuffer} bytes
 */
export function readXflBytes(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const r = new Reader(u8.length);
  r.window(0, u8);
  // The whole file is in the window, so the reader never asks for another one.
  return readProject(r).next().value;
}

/** True when `bytes` start like an XFLR5 project (.xfl): project format 200001 or 200002, big-endian. */
export function startsLikeXfl(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (u8.length < 4) return false;
  const first = new DataView(u8.buffer, u8.byteOffset, 4).getInt32(0);
  return first === 200001 || first === 200002;
}

/**
 * True when `bytes` (the first 4 of a file at least) start like a project that readXfl() reads or names:
 * an XFLR5 project (.xfl), a flow5 project (.fl5) or an old XFLR5 project (.wpa). For files whose name
 * has lost its extension.
 */
export function sniffXflr5(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (u8.length < 4) return false;
  const dv = new DataView(u8.buffer, u8.byteOffset, 4);
  return startsLikeXfl(u8) || isFlow5(dv.getInt32(0)) || isWpa(dv.getInt32(0, true));
}
