// XFLR5 plane and wing XML reader: <explane version="1.0">, written by XFLR5 6.11 to 6.62.
//
// A plane file (XFLR5 "Export to xml file") holds
//   <explane version="1.0"> <Units><length_unit_to_meter/>…</Units>
//     <Plane> <Name/> <Description/> … <wing>… </Plane> </explane>
// and a wing file of the wing editor (XFLR5 6.41 and later) one <wing> in place of <Plane>. A <wing>
// has Name, Type (MAINWING, SECONDWING, ELEVATOR, FIN; missing in 6.11), Position "x, y, z",
// Tilt_angle, Symetric, isFin and <Sections><Section>… with y_position, Chord, xOffset (lengths in
// the unit of <Units>), Dihedral, Twist (degrees) and the left and right foil names. The file names
// the airfoils but holds no coordinates.
//
// The rules follow XFLR5's own reader: element names compared without case, unknown elements skipped,
// <Units> applied only to what follows it (XFLR5 reads the file as a stream), the wing slot from
// <Type> or, without one, from the order of the wings. Where XFLR5 reads a missing or garbled number
// as 0, this reader keeps NaN and warns, so that such a wing cannot be imported unnoticed. Values stay
// in the file's unit (lengthUnit = mm per unit) and as stored: the mapping to sections comes later.
//
// The tokenizer (src/import/xmlscan.js) is shared with the flow5 XML reader.

import { count, plain, tr } from '../i18n/index.js';
import { MAX_PROJECT_BYTES } from '../model/io.js';
import { LIMITS } from '../model/project.js';
import { displayName } from '../model/budget.js';
import { XflrError } from './errors.js';
import { MAX_PLANES } from './xfl.js';
import { EOF, START, Scanner, TEXT, children, clip, isTrue, readText, toNumber } from './xmlscan.js';

// Planes per file: MAX_PLANES of the .xfl reader (XFLR5 writes one). Wings read per plane (XFLR5:
// MAXWINGS); value problems listed per wing, and warnings per file, before a count of the rest.
const MAX_WINGS = 4;
export const MAX_PROBLEMS = 5;
export const MAX_WARNINGS = 50;

/** Wing slot of each <Type>: 0 main wing, 1 second wing, 2 elevator (horizontal stabilizer), 3 fin. */
const SLOT = { MAINWING: 0, SECONDWING: 1, ELEVATOR: 2, FIN: 3 };

// Display units as XFLR5 and flow5 write length_unit_to_meter (6 significant digits), with mm per unit.
export const UNITS = [
  ['mm', 0.001, 1],
  ['cm', 0.01, 10],
  ['dm', 0.1, 100],
  ['m', 1, 1000],
  ['in', 0.0254, 25.4],
  ['ft', 0.3048, 304.8],
];

// Root elements of the XML files of flow5, XFLR5's successor.
const FLOW5_ROOTS = new Set(['xflplane', 'xflwing', 'xflfuse', 'xflboat', 'xflsail']);


/** Reader warnings: add(...texts) keeps the first MAX_WARNINGS, done() lists them and counts the rest. */
export function warningList() {
  const list = [];
  let more = 0;
  return {
    add(...texts) {
      for (const t of texts) {
        if (list.length < MAX_WARNINGS) list.push(t);
        else more++;
      }
    },
    done: () => (more ? [...list, tr('Further warnings not listed: {count}.', { count: count(more) })] : list),
  };
}

/** Problems of the values of one wing: the first MAX_PROBLEMS, and how many more. */
export function problemList() {
  return { list: [], more: 0 };
}

export function note(problems, p) {
  if (problems.list.length < MAX_PROBLEMS) problems.list.push(p);
  else problems.more++;
}

/** Number of element `element` (section n, or null for a wing value); NaN and a problem when it is not a number. */
export function value(text, element, n, problems) {
  const v = toNumber(text);
  if (Number.isNaN(v)) note(problems, { element, n, text });
  return v;
}

/** Position "x, y, z": the first three parts; with fewer, 0, 0, 0 as in XFLR5. */
export function readPosition(text, scale, problems) {
  const parts = text.split(',', 4);
  if (parts.length < 3) {
    note(problems, { element: 'Position', n: null, text, few: true });
    return { x: 0, y: 0, z: 0 };
  }
  const [x, y, z] = parts.slice(0, 3).map((p) => toNumber(p) * scale);
  if (Number.isNaN(x) || Number.isNaN(y) || Number.isNaN(z)) note(problems, { element: 'Position', n: null, text });
  return { x, y, z };
}

/** One <Section>; a missing y_position or Chord stays NaN, a missing xOffset, Dihedral or Twist is 0. */
function readSection(sc, n, scale, problems) {
  const s = { rightFoil: '', leftFoil: '', chord: NaN, y: NaN, offset: 0, dihedral: 0, twist: 0 };
  let hasY = false;
  let hasChord = false;
  const num = (element) => value(readText(sc), element, n, problems);
  children(sc, (name) => {
    if (name === 'y_position') {
      s.y = num('y_position') * scale;
      hasY = true;
    } else if (name === 'chord') {
      s.chord = num('Chord') * scale;
      hasChord = true;
    } else if (name === 'xoffset') s.offset = num('xOffset') * scale;
    else if (name === 'dihedral') s.dihedral = num('Dihedral');
    else if (name === 'twist') s.twist = num('Twist');
    else if (name === 'left_side_foilname') s.leftFoil = readText(sc);
    else if (name === 'right_side_foilname') s.rightFoil = readText(sc);
  });
  if (!hasY) note(problems, { element: 'y_position', n, text: null });
  if (!hasChord) note(problems, { element: 'Chord', n, text: null });
  return s;
}

/**
 * One <wing>. `scale` converts its lengths to the file's unit; `top` marks a wing outside a plane,
 * whose Position and Tilt_angle XFLR5 ignores (it writes 0 there). `wing.fin` holds the flags that
 * set how XFLR5 builds a fin (isFin, isDoubleFin, isSymFin; false when missing, as in XFLR5).
 * @returns {{wing: object, type: string, isFin: boolean, problems: {list: object[], more: number}}}
 */
function readWing(sc, scale, top) {
  const wing = { name: '', description: '', symmetric: true, position: { x: 0, y: 0, z: 0 }, tilt: 0, sections: [], fin: { isFin: false, double: false, symmetric: false } };
  const problems = problemList();
  let type = 'OTHERWING';
  let isFin = false;
  children(sc, (name) => {
    if (name === 'name') wing.name = readText(sc);
    else if (name === 'type') {
      const t = readText(sc).trim().toUpperCase();
      type = Object.hasOwn(SLOT, t) ? t : 'OTHERWING';
    } else if (name === 'description') wing.description = readText(sc);
    else if (name === 'symetric') wing.symmetric = isTrue(readText(sc));
    else if (name === 'isfin') isFin = isTrue(readText(sc));
    else if (name === 'isdoublefin') wing.fin.double = isTrue(readText(sc));
    else if (name === 'issymfin') wing.fin.symmetric = isTrue(readText(sc));
    else if (name === 'position' && !top) wing.position = readPosition(readText(sc), scale, problems);
    else if (name === 'tilt_angle' && !top) wing.tilt = value(readText(sc), 'Tilt_angle', null, problems);
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
  wing.fin.isFin = isFin;
  return { wing, type, isFin, problems };
}

/** Slot of a plane's wing by XFLR5's rule: <Type>, else isFin, else the 1st wing read (fins counted) main, the 2nd elevator, later ones main. */
function planeSlot(type, isFin, index) {
  if (type !== 'OTHERWING') return SLOT[type];
  if (isFin) return 3;
  return index === 1 ? 2 : 0;
}

/** The warning texts of a wing's problems; `plane` is null for a wing outside a plane. `program`: XFLR5 or flow5. */
export function problemTexts(plane, wingName, problems, program = 'XFLR5') {
  const wing = displayName(wingName);
  const out = problems.list.map((p) => {
    const at = { plane: plane === null ? '' : displayName(plane), wing, element: p.element, n: p.n === null ? '' : plain(p.n), text: clip((p.text ?? '').trim()) };
    if (p.text === null) {
      return plane === null
        ? tr('Wing "{wing}", section {n}: {element} is missing.', at)
        : tr('Plane "{plane}", wing "{wing}", section {n}: {element} is missing.', at);
    }
    if (p.few) return tr('Plane "{plane}", wing "{wing}": Position "{text}" holds fewer than 3 values; the wing is placed at 0, 0, 0 as in {program}.', { ...at, program });
    if (p.n === null) return tr('Plane "{plane}", wing "{wing}": {element} "{text}" is not a number.', at);
    return plane === null
      ? tr('Wing "{wing}", section {n}: {element} "{text}" is not a number.', at)
      : tr('Plane "{plane}", wing "{wing}", section {n}: {element} "{text}" is not a number.', at);
  });
  if (problems.more) {
    const at = { plane: plane === null ? '' : displayName(plane), wing, count: count(problems.more) };
    out.push(
      plane === null
        ? tr('Wing "{wing}": further values missing or not numbers: {count}.', at)
        : tr('Plane "{plane}", wing "{wing}": further values missing or not numbers: {count}.', at),
    );
  }
  return out;
}

/** Warning for a later wing that takes the slot of an earlier one, as XFLR5 does. */
function replaced(slot, plane, name, previous) {
  const at = { plane: displayName(plane), name: displayName(name), previous: displayName(previous) };
  if (slot === 0) return tr('Plane "{plane}" has more than one main wing: "{name}" replaces "{previous}", as in XFLR5.', at);
  if (slot === 1) return tr('Plane "{plane}" has more than one second wing: "{name}" replaces "{previous}", as in XFLR5.', at);
  if (slot === 2) return tr('Plane "{plane}" has more than one horizontal stabilizer: "{name}" replaces "{previous}", as in XFLR5.', at);
  return tr('Plane "{plane}" has more than one fin: "{name}" replaces "{previous}", as in XFLR5.', at);
}

/** One <Plane>: its name, description and wings by slot (null where no wing landed). */
function readPlane(sc, scale, warnings) {
  const plane = { name: '', description: '', wings: [null, null, null, null] };
  const read = [];
  let extra = 0;
  children(sc, (name) => {
    if (name === 'name') plane.name = readText(sc);
    else if (name === 'description') plane.description = readText(sc);
    else if (name === 'wing') {
      // XFLR5 stops after MAXWINGS wings.
      if (read.length >= MAX_WINGS) extra++;
      else {
        const w = readWing(sc, scale, false);
        read.push({ ...w, slot: planeSlot(w.type, w.isFin, read.length) });
      }
    }
  });
  for (const r of read) {
    const previous = plane.wings[r.slot];
    if (previous) warnings.add(replaced(r.slot, plane.name, r.wing.name, previous.name));
    plane.wings[r.slot] = r.wing;
  }
  if (extra) warnings.add(tr('Plane "{plane}" has more than 4 wings; XFLR5 reads the first 4, and so does this import.', { plane: displayName(plane.name) }));
  for (const r of read) if (plane.wings[r.slot] === r.wing) warnings.add(...problemTexts(plane.name, r.wing.name, r.problems));
  return plane;
}

/** Contents of <Units>: length_unit_to_meter, or undefined without one. */
function readUnits(sc) {
  let unit;
  children(sc, (name) => {
    if (name !== 'length_unit_to_meter') return;
    const text = readText(sc);
    const v = toNumber(text);
    // XFLR5 writes 0.001 to 1 m (mm to m) or the inch and foot; far outside, the lengths make no sense.
    if (!(v >= 1e-6 && v <= 1000)) throw new XflrError('damaged', tr('The length unit of the XML file is not valid: length_unit_to_meter is "{value}".', { value: clip(text.trim()) }));
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
      throw new XflrError('not-plane-xml', tr('The file is not an XFLR5 plane or wing file: it does not start with an XML element.'));
    }
  }
}

/**
 * Read an XFLR5 plane or wing XML file (text already decoded, see decodeText in airfoil/parse.js).
 * @param {string} text
 * @returns {object} XflrFile: { kind: 'xml', format: null, version, lengthUnit (mm per file unit),
 *   unitName, wingOnly, planes: [{ name, description, wings: [main, second, elevator, fin] }],
 *   foils: null, foilError: null, warnings }; wing lengths in the file unit, angles in degrees
 * @throws {XflrError} when the file cannot be imported at all
 */
export function readXflr5Xml(text) {
  const s = String(text);
  if (s.length > MAX_PROJECT_BYTES) throw new XflrError('too-large', tr('The file is larger than {max} MB.', { max: plain(MAX_PROJECT_BYTES / 1e6) }));
  const sc = new Scanner(s, s.charCodeAt(0) === 0xfeff ? 1 : 0);
  openRoot(sc);
  const root = sc.name;
  const version = sc.attrs.filter(([name]) => name === 'version').at(-1)?.[1] ?? '';
  if (FLOW5_ROOTS.has(root.toLowerCase())) {
    throw new XflrError('flow5', tr('The file is a flow5 XML file (root element "{root}"); only XFLR5 files can be imported.', { root: clip(root) }));
  }
  if (root !== 'explane' || version !== '1.0') {
    throw new XflrError('not-plane-xml', tr('The file is not an XFLR5 plane or wing file (root element "{root}", version "{version}").', { root: clip(root), version: clip(version) }));
  }

  const warnings = warningList();
  const planes = [];
  // length_unit_to_meter in effect (XFLR5's default is the metre), and that of the first plane or
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
        warnings.add(tr('The length unit (<Units>) comes after a plane or wing; as in XFLR5, it applies only to the planes and wings that follow it.'));
      }
      unit = u;
    } else if (name === 'plane') {
      fileUnit ??= unit;
      if (planes.length >= MAX_PLANES) throw new XflrError('too-large', tr('The XML file holds more than {max} planes.', { max: count(MAX_PLANES) }));
      planes.push(readPlane(sc, unit / fileUnit, warnings));
    } else if (name === 'wing') {
      // XFLR5 reads each wing outside a plane into the main wing: the last one stays.
      fileUnit ??= unit;
      top = readWing(sc, unit / fileUnit, true);
      topCount++;
    }
  });
  // After the root element only white space, comments and declarations may follow.
  for (let kind = sc.next(); kind !== EOF; kind = sc.next()) {
    if (kind === START || (kind === TEXT && (sc.cdata || /\S/.test(sc.text)))) {
      throw sc.damaged(sc.i, (line) => tr('The XML file is damaged at line {line}: content follows the end of the root element.', { line }));
    }
  }

  let wingOnly = false;
  if (planes.length) {
    if (topCount === 1) warnings.add(tr('The file holds a wing outside its planes; it is not imported.'));
    else if (topCount) warnings.add(tr('The file holds {count} wings outside its planes; they are not imported.', { count: count(topCount) }));
  } else if (top) {
    wingOnly = true;
    const name = displayName(top.wing.name);
    if (topCount > 1) warnings.add(tr('The file holds {count} wings outside a plane; XFLR5 reads only the last one, "{name}", and so does this import.', { count: count(topCount), name }));
    // XFLR5 would take any wing as the main wing; the role here comes from its Type.
    if (top.type === 'FIN' || top.isFin) throw new XflrError('fin', tr('The XML wing "{name}" is a fin; a fin imports only from a plane file, where its kind and position are known.', { name }));
    const wings = [null, null, null, null];
    wings[top.type === 'ELEVATOR' ? 2 : 0] = top.wing;
    planes.push({ name: '', description: '', wings });
    warnings.add(...problemTexts(null, top.wing.name, top.problems));
  } else throw new XflrError('no-plane', tr('The XML file holds no plane and no wing.'));

  const known = UNITS.find(([, u]) => Math.abs(fileUnit - u) <= 1e-9 * u);
  return {
    kind: 'xml',
    format: null,
    version,
    lengthUnit: known ? known[2] : fileUnit * 1000,
    unitName: known ? known[0] : null,
    wingOnly,
    planes,
    foils: null,
    foilError: null,
    warnings: warnings.done(),
  };
}
