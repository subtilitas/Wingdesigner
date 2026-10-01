// flow5 project reader (.fl5, project formats 500750 written by flow5 7.50 to 7.53, and 500754 written
// by 7.54 to 7.57; the two are the same up to the end of the planes).
//
// Written from a description of the format, not from flow5's code (flow5 is GPL-3.0). The file is a Qt
// QDataStream with default settings, as an XFLR5 project is (src/import/xfl.js): big-endian, a C++
// float stored as an 8-byte double, a string as a u32 byte count (0xFFFFFFFF = null string) and
// UTF-16BE. There are no length prefixes, and the header holds whole default objects (an airfoil
// analysis, a plane analysis, splines), so the reader walks every record before the planes field by
// field; every variable part follows a count. Lengths are in metres, angles in degrees, airfoil
// coordinates in chords.
//
//   i32 project format        500750 or 500754
//   header                    default airfoil analysis and plane analysis, a string, 5 splines, spares
//   i32 2D format, i32 n, Foil ×n          read: name, flaps, coordinates
//   i32 n, foil analysis ×n                skipped
//   i32 n, (i32, foil result) ×n           skipped
//   i32 n, (i32 kind, plane) ×n            read: kind 0 (wings and bodies) or 1 (a triangle mesh, no wings)
//   plane analyses, results, boats         not read: reading stops after the last plane
//
// Every record carries a format number; a record of a newer layout than these readers know stops the
// reading with a message rather than a wrong value. The one layout change that no number shows itself:
// the "sections" body of flow5 7.56 and older is followed by a block of its section points, which 7.57
// no longer writes; the format of the body's part record (500757 from 7.57 on) tells them apart.

import { count, fixed, plain, tr, whole } from '../i18n/index.js';
import { LIMITS } from '../model/project.js';
import { displayName } from '../model/budget.js';
import { XflrError } from './errors.js';
import { MAX_FLOW5_WINGS } from './fl5xml.js';
import { COLOR, MAX_FOILS, MAX_FOIL_POINTS, MAX_PLANES, MAX_TOTAL_SECTIONS, MAX_XFL_BYTES, Reader, WINDOW_SIZE, damaged, isFlow5, readXfl } from './xfl.js';

/** The project formats this reader reads. */
export const FL5_FORMATS = Object.freeze([500750, 500754]);

/** Most points of one flow5 airfoil; flow5 writes 100 to 300, a fine spline 1000. */
export const MAX_FLOW5_FOIL_POINTS = 10_000;

// Wing type codes: 0 main wing, 1 (an old "second wing") other, 2 elevator, 3 fin, 4 other.
const WING_TYPES = ['main', 'other', 'elevator', 'fin', 'other'];

/** Skip the spare block of a record: i32 count, i32 ×count, i32 count, f64 ×count. */
function* skipSpares(r, what) {
  const ints = yield* r.count(what, Infinity, 4);
  r.skip(4 * ints, what);
  const doubles = yield* r.count(what, Infinity, 8);
  r.skip(8 * doubles, what);
}

/** Skip a line style: a first number of 500001 or more is a format, below it the stipple itself. */
function* skipLineStyle(r, what) {
  const k = yield* r.i32(what);
  r.skip(k >= 500001 ? 12 : 8, what); // (stipple), width, point symbol
  r.skip(COLOR + 1, what); // colour, visible
  yield* r.skipStr(what); // tag
}

/** Skip a foil analysis (polar) with its points. */
function* skipFoilPolar(r, what) {
  const format = yield* r.format(what, 500000, 501000);
  yield* r.skipStr(what); // airfoil name
  yield* r.skipStr(what); // analysis name
  yield* skipLineStyle(r, what);
  r.skip(16, what); // type, boundary-layer method, Mach and Reynolds types
  r.skip(format < 500750 ? 32 : 8, what); // flow values (older) or the Reynolds number
  r.skip(40, what); // Mach, angle, transition top and bottom, NCrit
  const controls = yield* r.count(what, Infinity, 16);
  r.skip(16 * controls, what);
  r.skip(4, what); // variable count
  const points = yield* r.count(what, Infinity, 128);
  r.skip(128 * points, what); // 16 values per point
  const ints = yield* r.count(what, Infinity, 4);
  r.skip(4 * ints, what);
  // flow5 reads one double (the flap angle) when the count is above 0, whatever the count.
  const doubles = yield* r.count(what);
  if (doubles > 0) r.skip(8, what);
}

/** Skip the boundary-layer block of a foil result. */
function* skipBoundaryLayer(r, what) {
  r.skip(12, what); // format, side counts
  const a = yield* r.count(what);
  const b = yield* r.count(what);
  const c = yield* r.count(what);
  r.skip(16 * (a + 1) + 16 * b + 16 * c, what);
  yield* skipSpares(r, what);
}

/** Skip a foil result (operating point). */
function* skipFoilResult(r, what) {
  const format = yield* r.format(what, 500000, 550000);
  // Results of formats below 500004 hold another boundary-layer layout; flow5 7.50 and later write 500750.
  if (format < 500004) throw damaged(what, r.o - 4);
  yield* r.skipStr(what);
  yield* r.skipStr(what);
  yield* skipLineStyle(r, what);
  r.skip(4 + 24, what); // method, Reynolds, Mach, angle
  if (format >= 500750) r.skip(8, what); // flap angle
  r.skip(2 + 80, what); // 2 flags, 10 coefficients
  const nodes = yield* r.count(what, Infinity, 37);
  r.skip(37 * nodes, what);
  const n = yield* r.count(what, Infinity, 32);
  r.skip(32 * n, what); // pressure and speed, viscous and inviscid
  yield* skipBoundaryLayer(r, what);
  yield* skipSpares(r, what);
}

/** Skip a spline: the common part, then `tail` (a B-spline's degree, a cubic spline's spares). */
function* skipSpline(r, what, bspline) {
  yield* r.format(what, 500001, 500001);
  yield* skipLineStyle(r, what);
  r.skip(5, what); // normals shown, output size
  const ctrl = yield* r.count(what, Infinity, 16);
  r.skip(16 * ctrl, what);
  const weights = yield* r.count(what, Infinity, 8);
  r.skip(8 * weights, what);
  r.skip(18, what); // closed, symmetric, bunch amplitude and type, unused
  yield* skipSpares(r, what);
  if (bspline) r.skip(12, what);
  else yield* skipSpares(r, what);
}

/** Skip the spline foil of the header: two B-splines and their settings. */
function* skipSplineFoil(r, what) {
  yield* r.format(what, 500000, 510000);
  yield* skipLineStyle(r, what);
  yield* skipSpline(r, what, true);
  yield* skipSpline(r, what, true);
  r.skip(5, what);
  yield* skipSpares(r, what);
}

/** Skip a control of a plane analysis: format, name and its values. */
function* skipAngleControl(r, what) {
  r.skip(4, what);
  yield* r.skipStr(what);
  const n = yield* r.count(what, Infinity, 8);
  r.skip(8 * n, what);
}

/** Skip a list of (name, value, value) entries of a plane analysis. */
function* skipRanges(r, what) {
  const n = yield* r.count(what, Infinity, 20);
  for (let i = 0; i < n; i++) {
    yield* r.skipStr(what);
    r.skip(16, what);
  }
}

/** Skip a plane analysis (with its data points). */
function* skipPlanePolar(r, what) {
  yield* r.format(what, 500750, 501000);
  yield* r.skipStr(what); // name
  yield* skipLineStyle(r, what);
  r.skip(4 + 3 + 4, what); // method, 3 flags, type
  const drags = yield* r.count(what, Infinity, 20);
  for (let i = 0; i < drags; i++) {
    yield* r.skipStr(what);
    r.skip(16, what);
  }
  r.skip(2 + 16 + 16 + 16 + 1 + 32 + 48 + 2 + 24 + 1 + 4 + 16 + 1 + 32 + 4 + 1, what);
  r.skip(249, what); // spares: 9 bools, 20 i32, 20 f64
  yield* r.skipStr(what); // plane name
  r.skip(16 + 2 + 4 + 24, what); // speed, angle, 2 flags, reference kind, area, chord, span
  for (let k = 0; k < 2; k++) {
    const n = yield* r.count(what, Infinity, 12);
    for (let i = 0; i < n; i++) yield* skipAngleControl(r, what);
  }
  r.skip(1, what);
  const groups = yield* r.count(what, Infinity, 4);
  for (let i = 0; i < groups; i++) yield* skipRanges(r, what);
  yield* skipRanges(r, what);
  yield* skipRanges(r, what);
  r.skip(2 + 4, what); // 2 flags, body drag method
  const spare = yield* r.count(what);
  const at = r.o;
  const points = yield* r.i32(what);
  if (Math.abs(points) > 10_000) throw damaged(what, at);
  for (let i = 0; i < points; i++) {
    const format = yield* r.format(what, 500000, 510000);
    r.skip(8 * (format >= 500750 ? 27 : 24) + 56 + 128 + 8 * spare, what);
  }
  r.skip(1, what);
  yield* skipSpline(r, what, true);
  r.skip(2 + 8 + 250, what); // 2 flags, body friction, spares
}

/** The header up to the airfoil count. */
function* skipHeader(r) {
  yield* skipFoilPolar(r, 'header');
  yield* skipPlanePolar(r, 'header');
  yield* r.skipStr('header');
  yield* skipSplineFoil(r, 'header');
  for (let i = 0; i < 3; i++) yield* skipSpline(r, 'header', true);
  yield* skipSpline(r, 'header', false);
  yield* skipSpares(r, 'header');
  r.skip(4, 'header'); // format of the 2D part
}

/**
 * One airfoil: name, flap settings (angles in degrees; hinges in % of chord and thickness, as the
 * .xfl reader gives them), coordinates. Beyond MAX_FOIL_POINTS in all, the points are skipped (null).
 */
function* readFoil(r) {
  const format = yield* r.format('airfoil', 500000, 550000);
  const name = yield* r.str('airfoil');
  yield* r.skipStr('airfoil'); // description
  r.skip(12 + COLOR + 2, 'airfoil'); // stipple, width, symbol, colour, visible, camber line shown
  const leOn = yield* r.bool('airfoil');
  const teOn = yield* r.bool('airfoil');
  yield* r.need(48, 'airfoil');
  const le = { on: leOn, angle: r.f64Now(), hingeX: 100 * r.f64Now(), hingeY: 100 * r.f64Now() };
  const te = { on: teOn, angle: r.f64Now(), hingeX: 100 * r.f64Now(), hingeY: 100 * r.f64Now() };
  if (format >= 500753) r.skip(12, 'airfoil'); // bunch amplitude and type
  const n = yield* r.count('airfoil', MAX_FLOW5_FOIL_POINTS, 16);
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

/** Skip an inertia record: mass, centre of gravity, tensor, point masses, spares. */
function* skipInertia(r, what) {
  yield* r.format(what, 500001, 500001);
  r.skip(80, what);
  const masses = yield* r.count(what, Infinity, 36);
  for (let i = 0; i < masses; i++) {
    r.skip(32, what);
    yield* r.skipStr(what);
  }
  yield* skipSpares(r, what);
}

/** A part record (the common start of wings and bodies): name, description and its format. */
function* readPart(r, what) {
  const format = yield* r.format(what, 500000, 501000);
  const name = yield* r.str(what);
  const description = yield* r.str(what);
  yield* skipLineStyle(r, what);
  yield* skipInertia(r, what);
  r.skip(1, what); // automatic inertia
  if (format >= 500002) r.skip(1, what);
  if (format >= 500754) r.skip(40, what); // mesh sizes
  const ints = yield* r.count(what, 100);
  r.skip(4 * ints, what);
  const doubles = yield* r.count(what, 100);
  r.skip(8 * doubles, what);
  return { format, name, description };
}

/** One wing: names, type, sides, position, angles and sections (metres and degrees). */
function* readWing(r) {
  const part = yield* readPart(r, 'wing');
  yield* r.format('wing', 500001, 500002);
  const symmetric = yield* r.bool('wing');
  const n = yield* r.count('wing', Infinity, 4 + 8 + 40 + 16 + 4);
  // Sections that fit in the file but beyond what Wingdesigner holds: too large, not damaged.
  if (n > LIMITS.maxSections) throw new XflrError('too-large', tr('A wing of the file has {n} sections; at most {max} can be read.', { n: count(n), max: count(LIMITS.maxSections) }));
  r.sections += n;
  if (r.sections > MAX_TOTAL_SECTIONS) {
    throw new XflrError('too-large', tr('The planes of the file hold more than {max} wing sections together; the file is not read.', { max: count(MAX_TOTAL_SECTIONS) }));
  }
  const sections = [];
  for (let i = 0; i < n; i++) {
    yield* r.format('section', 500001, 500001);
    const rightFoil = yield* r.str('section');
    const leftFoil = yield* r.str('section');
    yield* r.need(40, 'section');
    // Chord comes before the span position.
    const chord = r.f64Now();
    const y = r.f64Now();
    const offset = r.f64Now();
    const dihedral = r.f64Now();
    const twist = r.f64Now();
    r.skip(16, 'section'); // panel counts and distributions
    // One count for the spare i32 and the spare f64.
    const spare = yield* r.count('section', Infinity, 12);
    r.skip(12 * spare, 'section');
    sections.push({ rightFoil, leftFoil, rightFile: null, leftFile: null, chord, y, offset, dihedral, twist });
  }
  const twoSided = yield* r.bool('wing');
  const closedInner = yield* r.bool('wing');
  r.skip(1, 'wing');
  const type = yield* r.i32('wing');
  yield* r.need(48, 'wing');
  const position = { x: r.f64Now(), y: r.f64Now(), z: r.f64Now() };
  const roll = r.f64Now();
  const tilt = r.f64Now();
  r.f64Now(); // rotation about z: not used by flow5's geometry
  yield* skipSpares(r, 'wing');
  return {
    name: part.name.trim(),
    description: part.description,
    type: WING_TYPES[type] ?? 'other',
    twoSided,
    symmetric,
    closedInner,
    position,
    tilt,
    roll,
    sections,
  };
}

/** Skip the common part of a body: part, format, position, angles, mesh settings; returns the part's format. */
function* skipFuseBase(r) {
  const part = yield* readPart(r, 'body');
  const format = yield* r.format('body', 500001, 500003);
  r.skip(48, 'body'); // position, angles
  if (format >= 500002) r.skip(69, 'body');
  if (format >= 500003) r.skip(8, 'body');
  r.skip(8, 'body');
  return part.format;
}

/** Skip a NURBS surface of a body; returns the point count of its first frame and the frame count. */
function* skipNurbs(r) {
  yield* r.format('body', 500001, 500001);
  r.skip(COLOR + 8 + 32 + 12, 'body');
  const frames = yield* r.count('body', Infinity, 40);
  let first = 0;
  for (let i = 0; i < frames; i++) {
    yield* r.format('body', 500001, 500001);
    r.skip(32, 'body'); // position, angle
    const points = yield* r.count('body', Infinity, 24);
    if (i === 0) first = points;
    r.skip(24 * points, 'body');
    yield* skipSpares(r, 'body');
  }
  yield* skipSpares(r, 'body');
  return { first, frames };
}

/** Skip a body of frames (flat faces, NURBS or sections); `sectionsTail` for a sections body of flow5 7.56 and older. */
function* skipFuseXfl(r, sectionsBody) {
  const partFormat = yield* skipFuseBase(r);
  yield* r.format('body', 500001, 500001);
  r.skip(4, 'body'); // body type
  const { first, frames } = yield* skipNurbs(r);
  r.skip(8 + 4 * first + 4 * frames, 'body');
  yield* skipSpares(r, 'body');
  if (sectionsBody && partFormat < 500757) {
    const format = yield* r.format('body', 500001, 500002);
    const n = yield* r.count('body');
    if (n > 0) {
      const k = yield* r.count('body');
      if (n * k * 24 > r.size - r.o) throw damaged('body', r.o);
      r.skip(24 * n * k, 'body');
    }
    if (format >= 500002) r.skip(8, 'body');
    yield* skipSpares(r, 'body');
  }
}

/** Skip one body of a plane, by its kind, with the panels that follow it. */
function* skipBody(r) {
  const at = r.o;
  const kind = yield* r.i32('body');
  if (kind === 100001 || kind === 100004 || kind === 100005 || kind === 100006) yield* skipFuseXfl(r, kind === 100006);
  else if (kind === 100002) {
    yield* skipFuseBase(r);
    yield* r.format('body', 500001, 500100);
    const shapes = yield* r.count('body', Infinity, 4);
    for (let i = 0; i < shapes; i++) yield* r.skipStr('body');
    yield* skipSpares(r, 'body');
  } else if (kind === 100003) {
    yield* skipFuseBase(r);
    yield* r.format('body', 500001, 500010);
    const triangles = yield* r.count('body', Infinity, 72);
    r.skip(72 * triangles, 'body');
    yield* skipSpares(r, 'body');
  } else throw damaged('body', at);
  r.skip(4, 'body'); // panel block format
  const panels = yield* r.count('body', Infinity, 73);
  r.skip(73 * panels, 'body');
  yield* skipSpares(r, 'body');
}

/**
 * One plane of wings and bodies: name, description, the number of bodies and the wings in file order;
 * wings beyond MAX_FLOW5_WINGS are read past and dropped with a warning, as in the XML reader.
 */
function* readXflPlane(r, warnings) {
  const format = yield* r.format('plane', 500000, 500010);
  const nWings = yield* r.count('plane', Infinity, 4);
  const name = (yield* r.str('plane')).trim();
  const description = yield* r.str('plane');
  r.skip(12 + COLOR, 'plane'); // stipple, width, symbol, colour
  const wings = [];
  for (let i = 0; i < nWings; i++) {
    const wing = yield* readWing(r);
    if (i < MAX_FLOW5_WINGS) wings.push(wing);
  }
  if (nWings > MAX_FLOW5_WINGS) warnings.push(tr('Plane "{plane}" has more than {max} wings; the first {max} are read.', { plane: displayName(name), max: count(MAX_FLOW5_WINGS) }));
  const bodies = yield* r.count('plane', 10_000);
  for (let i = 0; i < bodies; i++) yield* skipBody(r);
  if (format >= 500002) {
    r.skip(1, 'plane');
    yield* skipInertia(r, 'plane');
  } else {
    const masses = yield* r.count('plane', Infinity, 36);
    for (let i = 0; i < masses; i++) {
      r.skip(32, 'plane');
      yield* r.skipStr('plane');
    }
  }
  yield* skipSpares(r, 'plane');
  return { name, description, kind: 'wings', bodies, wings };
}

/** Skip a triangle mesh of a mesh plane; returns its name and description. */
function* readMeshPlane(r) {
  const format = yield* r.format('plane', 500000, 500100);
  const name = (yield* r.str('plane')).trim();
  const description = yield* r.str('plane');
  if (format >= 500004) r.skip(COLOR, 'plane');
  if (format < 500002) r.skip(12 + COLOR, 'plane');
  else {
    yield* skipLineStyle(r, 'plane');
    r.skip(1 + 24 + 8 + 24, 'plane');
    yield* skipInertia(r, 'plane');
  }
  if (format <= 500002) {
    const triangles = yield* r.count('plane', Infinity, 72);
    r.skip(72 * triangles, 'plane');
    yield* skipSpares(r, 'plane');
  } else {
    const mesh = yield* r.i32('plane');
    const nodes = yield* r.count('plane', Infinity, 61);
    for (let i = 0; i < nodes; i++) {
      r.skip(53, 'plane'); // index, position, normal, trailing flag
      const a = yield* r.count('plane', Infinity, 4);
      r.skip(4 * a, 'plane');
      const b = yield* r.count('plane', Infinity, 4);
      r.skip(4 * b, 'plane');
    }
    const per = 4 + 12 + 12 + 2 + (mesh >= 500002 ? 4 : 0) + 4;
    const panels = yield* r.count('plane', Infinity, per);
    r.skip(per * panels, 'plane');
    if (format >= 500005) {
      yield* r.format('plane', 500001, 500010);
      const triangles = yield* r.count('plane', Infinity, 72);
      r.skip(72 * triangles, 'plane');
    }
    r.skip(8, 'plane');
  }
  return { name, description, kind: 'mesh', bodies: 0, wings: [] };
}

/** Check the project format. */
function* readFl5Format(r) {
  yield* r.need(4, 'header');
  const format = r.dv.getInt32(0);
  if (format < FL5_FORMATS[0]) {
    throw new XflrError('flow5-old', tr('The file is a flow5 project of format {format}, written by flow5 7.26 or older: open it in a current flow5 and save it, or export the plane as XML.', { format: plain(format) }));
  }
  if (format > FL5_FORMATS.at(-1)) {
    throw new XflrError('flow5-new', tr('The file is a flow5 project of format {format}, newer than this import reads (up to {max}, flow5 7.54 to 7.57): export the plane as XML in flow5.', { format: plain(format), max: plain(FL5_FORMATS.at(-1)) }));
  }
  // Formats between the read ones have no known layout.
  if (!FL5_FORMATS.includes(format)) {
    throw new XflrError('flow5-unknown', tr('The file is a flow5 project of format {format}, which this import does not read (formats {formats}): export the plane as XML in flow5.', { format: plain(format), formats: FL5_FORMATS.map(plain).join(', ') }));
  }
  r.o = 4;
  return format;
}

/** The whole reading: the airfoils, then the planes; reading stops after the last plane. */
function* readProject(r) {
  if (r.size > MAX_XFL_BYTES) {
    throw new XflrError('too-large', tr('The file is {size} MB; flow5 projects above {limit} MB are not read.', { size: fixed(r.size / 1e6, 1), limit: whole(MAX_XFL_BYTES / 1e6) }));
  }
  const format = yield* readFl5Format(r);
  yield* skipHeader(r);
  const warnings = [];
  const foils = new Map();
  const n = yield* r.count('airfoils');
  let skipped = 0;
  let ignored = 0;
  for (let i = 0; i < n; i++) {
    const foil = yield* readFoil(r);
    // Past MAX_FOILS the airfoils are read only to reach the planes.
    if (i >= MAX_FOILS) {
      ignored++;
      continue;
    }
    if (!foil.points) skipped++;
    // A later airfoil of the same name replaces the earlier one; an empty name finds none.
    if (!foil.name) continue;
    foils.delete(foil.name);
    if (foil.points) foils.set(foil.name, foil);
  }
  if (ignored) warnings.push(tr('Only the first {max} of the {n} airfoils of the file were read.', { max: count(MAX_FOILS), n: count(n) }));
  if (skipped === 1) warnings.push(tr('1 airfoil was not read: the airfoils of the file hold more than {max} points together.', { max: count(MAX_FOIL_POINTS) }));
  else if (skipped) warnings.push(tr('{n} airfoils were not read: the airfoils of the file hold more than {max} points together.', { n: count(skipped), max: count(MAX_FOIL_POINTS) }));
  const polars = yield* r.count('analyses');
  for (let i = 0; i < polars; i++) yield* skipFoilPolar(r, 'analysis');
  const results = yield* r.count('results');
  for (let i = 0; i < results; i++) {
    r.skip(4, 'result');
    yield* skipFoilResult(r, 'result');
  }
  const nPlanes = yield* r.count('planes', MAX_PLANES);
  if (nPlanes === 0) throw new XflrError('no-plane', tr('The project holds no plane.'));
  const planes = [];
  for (let i = 0; i < nPlanes; i++) {
    const at = r.o;
    const kind = yield* r.i32('planes');
    if (kind === 0) planes.push(yield* readXflPlane(r, warnings));
    else if (kind === 1) planes.push(yield* readMeshPlane(r));
    else throw new XflrError('damaged', tr('Plane {n} of the file is of a kind this import does not read (kind {kind}).', { n: plain(i + 1), kind: plain(kind) }), at);
  }
  return { kind: 'fl5', program: 'flow5', format, version: null, lengthUnit: 1000, unitName: 'm', wingOnly: false, planes, foils, foilError: null, warnings };
}

/**
 * Read a flow5 project from a Blob (or File) through a window of `windowSize` bytes.
 * Throws XflrError for files that cannot be imported; a failed blob read rejects with the browser's error.
 * @param {Blob} blob
 * @param {{ windowSize?: number }} [options]
 */
export async function readFl5(blob, { windowSize = WINDOW_SIZE } = {}) {
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
 * Read a flow5 project held in memory; the same result as readFl5().
 * @param {Uint8Array|ArrayBuffer} bytes
 */
export function readFl5Bytes(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const r = new Reader(u8.length);
  r.window(0, u8);
  return readProject(r).next().value;
}

/**
 * Read an XFLR5 (.xfl) or flow5 (.fl5) project from a Blob, by its first number.
 * @param {Blob} blob
 * @param {{ windowSize?: number }} [options]
 */
export async function readProjectFile(blob, options) {
  const head = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
  if (head.length === 4 && isFlow5(new DataView(head.buffer).getInt32(0))) return readFl5(blob, options);
  return readXfl(blob, options);
}
