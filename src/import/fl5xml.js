// flow5 plane and wing XML reader: <xflplane version="1.0"> and <xflwing version="1.0">, written by
// flow5 7.50 and later (the element layout is the same from 7.53 to 7.57).
//
// A plane file holds
//   <xflplane version="1.0"> <Units><meter_to_length_unit/>…</Units>
//     <Plane> <Name/> <Description/> <body/>… <wing/>… </Plane> </xflplane>
// and a wing file one <wing> in place of <Plane>. A <wing> has Name, Type (MAINWING, ELEVATOR, FIN,
// OTHERWING; anything else is OTHERWING), Position "x, y, z", Rx_angle, Ry_angle (degrees), symmetric,
// Two_Sided, Closed_Inner_Side and <Sections><Section>… with y_position, Chord, xOffset (lengths in the
// unit of <Units>), Dihedral, Twist (degrees) and the left and right airfoils, by name
// (Left_Side_FoilName) or by a .dat file next to the XML file (Left_Side_Foil_File). The section values
// mean what they mean in XFLR5. Despite its name, meter_to_length_unit holds metres per file unit
// (0.001 for millimetres), as XFLR5's length_unit_to_meter does, and so does that legacy name here.
//
// flow5 turns a wing first by Rx_angle about x, then by Ry_angle about y (about z for a one-sided
// wing), both about the wing's own origin, and then moves it by Position. A one-sided wing (a fin) is
// the left half only.
//
// The rules follow flow5's reader: element names compared without case, unknown elements skipped,
// <Units> applied only to what follows it, wings kept in file order. Where flow5 reads a missing value
// as its default, so does this reader; a value that is no number stays NaN with a warning, where flow5
// reads 0, so that such a wing cannot be imported unnoticed. Unlike flow5, which keeps the last
// <Plane> of a file, this reader lists every plane; and an unknown element before a plane, at which
// flow5 stops reading, is skipped.

import { count, plain, tr } from '../i18n/index.js';
import { MAX_PROJECT_BYTES } from '../model/io.js';
import { LIMITS } from '../model/project.js';
import { displayName } from '../model/budget.js';
import { XflrError } from './errors.js';
import { MAX_PLANES } from './xfl.js';
import { UNITS, problemList, problemTexts, readPosition, readXflr5Xml, value, warningList } from './xflxml.js';
import { EOF, START, Scanner, TEXT, children, clip, readText, toNumber } from './xmlscan.js';

/** Most wings read per plane; flow5 sets no limit, real planes have up to 6. */
export const MAX_FLOW5_WINGS = 100;

/** Wing type of each <Type> keyword (compared without case, not trimmed, as flow5 does). */
const TYPES = { MAINWING: 'main', ELEVATOR: 'elevator', FIN: 'fin' };

// Root elements of flow5 XML files that hold no plane or wing.
const OTHER_ROOTS = new Set(['xflfuse', 'xflboat', 'xflsail', 'xflpolar', 'xflplanepolar', 'xflboatpolar']);

/** A flow5 boolean: "true" (any case) is true, any other text false; an empty element keeps the default. */
function flag(text, fallback) {
  const t = text.trim();
  return t === '' ? fallback : t.toLowerCase() === 'true';
}

/** The airfoil name of a .dat file reference: the file name without its folder and its .dat extension. */
export function foilFileName(file) {
  const base = file.trim().split(/[\\/]/).pop();
  return base.replace(/\.dat$/i, '');
}

/** One <Section>; missing values are 0 and missing airfoil names empty, as in flow5. */
function readSection(sc, n, scale, problems) {
  const s = { rightFoil: '', leftFoil: '', rightFile: null, leftFile: null, chord: 0, y: 0, offset: 0, dihedral: 0, twist: 0 };
  const num = (element) => value(readText(sc), element, n, problems);
  children(sc, (name) => {
    if (name === 'y_position') s.y = num('y_position') * scale;
    else if (name === 'chord') s.chord = num('Chord') * scale;
    else if (name === 'xoffset') s.offset = num('xOffset') * scale;
    else if (name === 'dihedral') s.dihedral = num('Dihedral');
    else if (name === 'twist') s.twist = num('Twist');
    else if (name === 'left_side_foilname') s.leftFoil = readText(sc).trim();
    else if (name === 'right_side_foilname') s.rightFoil = readText(sc).trim();
    else if (name === 'left_side_foil_file') {
      s.leftFile = readText(sc).trim();
      s.leftFoil = foilFileName(s.leftFile);
    } else if (name === 'right_side_foil_file') {
      s.rightFile = readText(sc).trim();
      s.rightFoil = foilFileName(s.rightFile);
    }
  });
  return s;
}

/**
 * One <wing>. `scale` converts its lengths to the file's unit; `top` marks the wing of a wing file,
 * whose Position and angles flow5 drops (it writes 0 there).
 * @returns {{wing: object, problems: {list: object[], more: number}}}
 */
function readWing(sc, scale, top) {
  const wing = {
    name: '',
    description: '',
    type: 'other',
    twoSided: true,
    symmetric: true,
    closedInner: false,
    position: { x: 0, y: 0, z: 0 },
    tilt: 0,
    roll: 0,
    sections: [],
  };
  const problems = problemList();
  children(sc, (name) => {
    if (name === 'name') wing.name = readText(sc).trim();
    else if (name === 'type') wing.type = TYPES[readText(sc).toUpperCase()] ?? 'other';
    else if (name === 'description') wing.description = readText(sc).trim();
    else if (name === 'position' && !top) {
      // flow5 collapses white space; a value of fewer than 3 parts leaves the wing at 0, 0, 0.
      wing.position = readPosition(readText(sc).replace(/\s+/g, ' '), scale, problems);
    } else if (name === 'rx_angle' && !top) wing.roll = value(readText(sc), 'Rx_angle', null, problems);
    else if (name === 'ry_angle' && !top) wing.tilt = value(readText(sc), 'Ry_angle', null, problems);
    else if (name === 'symmetric') wing.symmetric = flag(readText(sc), true);
    else if (name === 'two_sided') wing.twoSided = flag(readText(sc), true);
    else if (name === 'closed_inner_side') wing.closedInner = flag(readText(sc), false);
    else if (name === 'sections') {
      children(sc, (child) => {
        if (child !== 'section') return;
        if (wing.sections.length >= LIMITS.maxSections) {
          throw new XflrError('too-large', tr('A wing of the XML file has more than {max} sections.', { max: count(LIMITS.maxSections) }));
        }
        wing.sections.push(readSection(sc, wing.sections.length + 1, scale, problems));
      });
    }
  });
  return { wing, problems };
}

/** One <Plane>: its name, description, the number of bodies and the wings in file order. */
function readPlane(sc, scale, warnings) {
  const plane = { name: '', description: '', bodies: 0, wings: [] };
  const read = [];
  let extra = 0;
  children(sc, (name) => {
    if (name === 'name') plane.name = readText(sc).trim();
    else if (name === 'description') plane.description = readText(sc);
    else if (name === 'body') plane.bodies++;
    else if (name === 'wing') {
      if (read.length >= MAX_FLOW5_WINGS) extra++;
      else read.push(readWing(sc, scale, false));
    }
  });
  plane.wings = read.map((r) => r.wing);
  for (const r of read) warnings.add(...problemTexts(plane.name, r.wing.name, r.problems, 'flow5'));
  if (extra) warnings.add(tr('Plane "{plane}" has more than {max} wings; the first {max} are read.', { plane: displayName(plane.name), max: count(MAX_FLOW5_WINGS) }));
  return plane;
}

/** Contents of <Units>: metres per file length unit, or undefined without one. */
function readUnits(sc) {
  let unit;
  children(sc, (name) => {
    if (name !== 'meter_to_length_unit' && name !== 'length_unit_to_meter') return;
    const text = readText(sc);
    const v = toNumber(text);
    // flow5 writes 0.001 to 1 m (mm to m) or the inch and foot; far outside, the lengths make no sense.
    if (!(v >= 1e-6 && v <= 1000)) throw new XflrError('damaged', tr('The length unit of the XML file is not valid: {element} is "{value}".', { element: name === 'length_unit_to_meter' ? 'length_unit_to_meter' : 'meter_to_length_unit', value: clip(text.trim()) }));
    unit = v;
  });
  return unit;
}

/** Read up to the root element; anything but white space, comments and declarations before it means another file type. */
function openRoot(sc) {
  for (;;) {
    const kind = sc.next();
    if (kind === START) return;
    if (kind === EOF || (kind === TEXT && /\S/.test(sc.text))) {
      throw new XflrError('not-plane-xml', tr('The file is not a flow5 plane or wing file: it does not start with an XML element.'));
    }
  }
}

/**
 * Read a flow5 plane or wing XML file (text already decoded, see decodeText in airfoil/parse.js).
 * @param {string} text
 * @returns {object} file: { kind: 'xml', program: 'flow5', format: null, version, lengthUnit (mm per
 *   file unit), unitName, wingOnly, planes: [{ name, description, bodies, wings: [{ name, description,
 *   type: 'main'|'elevator'|'fin'|'other', twoSided, symmetric, closedInner, position, tilt (Ry_angle),
 *   roll (Rx_angle), sections: [{ y, chord, offset, dihedral, twist, leftFoil, rightFoil, leftFile,
 *   rightFile }] }] }], foils: null, foilError: null, warnings }; lengths in the file unit, angles in degrees
 * @throws {XflrError} when the file cannot be imported at all
 */
export function readFlow5Xml(text) {
  const s = String(text);
  if (s.length > MAX_PROJECT_BYTES) throw new XflrError('too-large', tr('The file is larger than {max} MB.', { max: plain(MAX_PROJECT_BYTES / 1e6) }));
  const sc = new Scanner(s, s.charCodeAt(0) === 0xfeff ? 1 : 0);
  openRoot(sc);
  const root = sc.name;
  const version = sc.attrs.filter(([name]) => name === 'version').at(-1)?.[1] ?? '';
  const lower = root.toLowerCase();
  if (OTHER_ROOTS.has(lower)) {
    throw new XflrError('not-plane-xml', tr('The file is a flow5 XML file without a plane or wing (root element "{root}").', { root: clip(root) }));
  }
  // flow5 compares the plane root with case, the wing root without.
  const wingFile = lower === 'xflwing';
  if (!(root === 'xflplane' || wingFile) || version !== '1.0') {
    throw new XflrError('not-plane-xml', tr('The file is not a flow5 plane or wing file (root element "{root}", version "{version}").', { root: clip(root), version: clip(version) }));
  }

  const warnings = warningList();
  const planes = [];
  // Metres per file unit in effect (flow5's default is the metre), and that of the first plane or
  // wing, the unit of every returned length: a later <Units> scales what follows it to that unit.
  let unit = 1;
  let fileUnit = null;
  let unitLate = false;
  let top = null;
  let topCount = 0;
  children(sc, (name) => {
    if (name === 'units') {
      const u = readUnits(sc);
      if (u === undefined || u === unit) return;
      if (fileUnit !== null && !unitLate) {
        unitLate = true;
        warnings.add(tr('The length unit (<Units>) comes after a plane or wing; as in flow5, it applies only to the planes and wings that follow it.'));
      }
      unit = u;
    } else if (name === 'plane' && !wingFile) {
      fileUnit ??= unit;
      if (planes.length >= MAX_PLANES) throw new XflrError('too-large', tr('The XML file holds more than {max} planes.', { max: count(MAX_PLANES) }));
      planes.push(readPlane(sc, unit / fileUnit, warnings));
    } else if (name === 'wing' && wingFile) {
      // flow5 keeps the last wing of a wing file.
      fileUnit ??= unit;
      top = readWing(sc, unit / fileUnit, true);
      topCount++;
    }
  });
  for (let kind = sc.next(); kind !== EOF; kind = sc.next()) {
    if (kind === START || (kind === TEXT && (sc.cdata || /\S/.test(sc.text)))) {
      throw sc.damaged(sc.i, (line) => tr('The XML file is damaged at line {line}: content follows the end of the root element.', { line }));
    }
  }

  if (wingFile) {
    if (!top) throw new XflrError('no-plane', tr('The XML file holds no plane and no wing.'));
    if (topCount > 1) warnings.add(tr('The file holds {count} wings outside a plane; flow5 reads only the last one, "{name}", and so does this import.', { count: count(topCount), name: displayName(top.wing.name) }));
    planes.push({ name: '', description: '', bodies: 0, wings: [top.wing] });
    warnings.add(...problemTexts(null, top.wing.name, top.problems, 'flow5'));
  } else if (!planes.length) throw new XflrError('no-plane', tr('The XML file holds no plane and no wing.'));

  const known = UNITS.find(([, u]) => Math.abs(fileUnit - u) <= 1e-9 * u);
  return {
    kind: 'xml',
    program: 'flow5',
    format: null,
    version,
    lengthUnit: known ? known[2] : fileUnit * 1000,
    unitName: known ? known[0] : null,
    wingOnly: wingFile,
    planes,
    foils: null,
    foilError: null,
    warnings: warnings.done(),
  };
}

/**
 * Read an XFLR5 or flow5 plane or wing XML file, by its root element.
 * @param {string} text
 * @returns {object} the file of readXflr5Xml or readFlow5Xml
 */
export function readPlaneXml(text) {
  try {
    return readXflr5Xml(text);
  } catch (err) {
    if (err instanceof XflrError && err.code === 'flow5') return readFlow5Xml(text);
    throw err;
  }
}
