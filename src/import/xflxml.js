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
// The tokenizer needs no DOM (the tests run in Node) and is linear in the input: it keeps the names of
// the open elements and the values read, never a tree.

import { count, plain, tr } from '../i18n/index.js';
import { MAX_PROJECT_BYTES } from '../model/io.js';
import { LIMITS } from '../model/project.js';
import { displayName } from '../model/budget.js';
import { XflrError } from './errors.js';
import { MAX_PLANES } from './xfl.js';

/** Most elements in one file; XFLR5 writes about 500 for a plane. */
export const MAX_ELEMENTS = 1_000_000;
/** Deepest nesting of elements; XFLR5 writes 6 levels. */
export const MAX_DEPTH = 100;
/** Most attributes of one element; XFLR5 writes one at most (the version of the root). */
export const MAX_ATTRIBUTES = 100;
// Planes per file: MAX_PLANES of the .xfl reader (XFLR5 writes one). Wings read per plane (XFLR5:
// MAXWINGS); value problems listed per wing, and warnings per file, before a count of the rest.
const MAX_WINGS = 4;
const MAX_PROBLEMS = 5;
const MAX_WARNINGS = 50;

/** Wing slot of each <Type>: 0 main wing, 1 second wing, 2 elevator (horizontal stabilizer), 3 fin. */
const SLOT = { MAINWING: 0, SECONDWING: 1, ELEVATOR: 2, FIN: 3 };

// Display units as XFLR5 writes length_unit_to_meter (6 significant digits), with mm per unit.
const UNITS = [
  ['mm', 0.001, 1],
  ['cm', 0.01, 10],
  ['dm', 0.1, 100],
  ['m', 1, 1000],
  ['in', 0.0254, 25.4],
  ['ft', 0.3048, 304.8],
];

// Root elements of the XML files of flow5, XFLR5's successor.
const FLOW5_ROOTS = new Set(['xflplane', 'xflwing', 'xflfuse', 'xflboat', 'xflsail']);

// A number as Qt's toDouble() reads it (point, optional exponent), after trimming. The point is required
// before fraction digits: an optional one lets \d+ and \d* split a long digit run in quadratic ways.
const NUMBER = /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?$/;

// Tokens: an XML name, an attribute with its quoted value, the end of a start tag and of an end tag.
// Sticky, so each match starts where the scanner stands; no pattern can backtrack over the input.
const NAME = /[\p{L}_:][\p{L}\p{N}\p{M}_.:-]*/uy;
const ATTR = /\s+([^\s=/>"'<]+)\s*=\s*(?:"([^"<]*)"|'([^'<]*)')/y;
const TAG_END = /\s*(\/?)>/y;
const END_TAG_END = /\s*>/y;

const START = 1;
const END = 2;
const TEXT = 3;
const EOF = 4;

const ENTITIES = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };

// The five XML entities and decimal or hexadecimal character references; a reference to no Unicode
// scalar value, or an unknown entity, stays as written.
function decodeEntities(s) {
  if (!s.includes('&')) return s;
  return s.replace(/&(lt|gt|amp|quot|apos|#\d+|#x[0-9a-fA-F]+);/g, (m, e) => {
    if (e[0] !== '#') return ENTITIES[e];
    const cp = e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    return cp > 0 && cp <= 0x10ffff && !(cp >= 0xd800 && cp <= 0xdfff) ? String.fromCodePoint(cp) : m;
  });
}

/** Line number (from 1) of character `at`. */
function lineAt(s, at) {
  let line = 1;
  for (let i = s.indexOf('\n'); i >= 0 && i < at; i = s.indexOf('\n', i + 1)) line++;
  return line;
}

/** At most `max` characters of `s`, with an ellipsis when cut (names and values in messages). */
function clip(s, max = 40) {
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

/**
 * Pull tokenizer. next() returns START, END, TEXT or EOF and sets `name` (START, END), `attrs`
 * (START of the root element: [name, value] pairs; empty for other elements, whose attributes are not
 * read), `text` and `cdata` (TEXT). A self-closing element gives START and
 * END. It skips the XML declaration, processing instructions, the DOCTYPE and comments, and throws
 * an XflrError at a malformed tag, a wrong end tag or an element left open at the end.
 */
class Scanner {
  constructor(s, from) {
    this.s = s;
    this.i = from;
    this.open = [];
    this.elements = 0;
    this.selfClosed = false;
    this.name = '';
    this.attrs = [];
    this.text = '';
    this.cdata = false;
  }

  damaged(at, message) {
    return new XflrError('damaged', message(plain(lineAt(this.s, at))));
  }

  malformed(at) {
    return this.damaged(at, (line) => tr('The XML file is damaged at line {line}: a tag is malformed.', { line }));
  }

  unclosed(at) {
    return this.damaged(at, (line) => tr('The XML file is damaged at line {line}: a comment, CDATA section or declaration is not closed.', { line }));
  }

  /** Index just past the next `token` from `from`, for comments, CDATA and declarations starting at `at`. */
  past(token, from, at) {
    const j = this.s.indexOf(token, from);
    if (j < 0) throw this.unclosed(at);
    return j + token.length;
  }

  /** Index just past a DOCTYPE from `from` (after "<!DOCTYPE"): its internal subset [...] and quoted strings may hold ">". */
  pastDoctype(from, at) {
    const s = this.s;
    let quote = 0;
    let subset = false;
    for (let j = from; j < s.length; j++) {
      const c = s.charCodeAt(j);
      if (quote) {
        if (c === quote) quote = 0;
      } else if (c === 0x22 || c === 0x27) quote = c;
      else if (c === 0x5b) subset = true;
      else if (c === 0x5d) subset = false;
      else if (c === 0x3e && !subset) return j + 1;
    }
    throw this.unclosed(at);
  }

  next() {
    if (this.selfClosed) {
      this.selfClosed = false;
      this.name = this.open.pop();
      return END;
    }
    const s = this.s;
    for (;;) {
      const i = this.i;
      if (i >= s.length) {
        if (this.open.length) throw new XflrError('damaged', tr('The XML file is cut off: the element <{name}> is not closed.', { name: clip(this.open.at(-1)) }));
        return EOF;
      }
      if (s.charCodeAt(i) !== 0x3c) {
        const j = s.indexOf('<', i);
        this.i = j < 0 ? s.length : j;
        this.text = s.slice(i, this.i);
        this.cdata = false;
        return TEXT;
      }
      const c = s.charCodeAt(i + 1);
      if (c === 0x21) {
        // <!-- comment -->, <![CDATA[ text ]]>, <!DOCTYPE …>
        if (s.startsWith('<!--', i)) this.i = this.past('-->', i + 4, i);
        else if (s.startsWith('<![CDATA[', i)) {
          this.i = this.past(']]>', i + 9, i);
          this.text = s.slice(i + 9, this.i - 3);
          this.cdata = true;
          return TEXT;
        } else if (s.slice(i + 2, i + 9).toUpperCase() === 'DOCTYPE') this.i = this.pastDoctype(i + 9, i);
        else throw this.malformed(i);
        continue;
      }
      if (c === 0x3f) {
        // <?xml …?> and other processing instructions
        this.i = this.past('?>', i + 2, i);
        continue;
      }
      if (c === 0x2f) {
        NAME.lastIndex = i + 2;
        const m = NAME.exec(s);
        if (!m) throw this.malformed(i);
        END_TAG_END.lastIndex = NAME.lastIndex;
        if (!END_TAG_END.exec(s)) throw this.malformed(i);
        const open = this.open.at(-1);
        if (open === undefined) throw this.damaged(i, (line) => tr('The XML file is damaged at line {line}: </{name}> closes no open element.', { line, name: clip(m[0]) }));
        if (open !== m[0]) {
          throw this.damaged(i, (line) => tr('The XML file is damaged at line {line}: </{name}> does not close <{open}>.', { line, name: clip(m[0]), open: clip(open) }));
        }
        this.i = END_TAG_END.lastIndex;
        this.name = this.open.pop();
        return END;
      }
      NAME.lastIndex = i + 1;
      const m = NAME.exec(s);
      if (!m) throw this.malformed(i);
      const attrs = [];
      let j = NAME.lastIndex;
      for (let n = 1; ; n++) {
        ATTR.lastIndex = j;
        const a = ATTR.exec(s);
        if (!a) break;
        if (n > MAX_ATTRIBUTES) throw this.malformed(i);
        if (this.open.length === 0) attrs.push([a[1], decodeEntities(a[2] ?? a[3])]);
        j = ATTR.lastIndex;
      }
      TAG_END.lastIndex = j;
      const e = TAG_END.exec(s);
      if (!e) throw this.malformed(i);
      if (++this.elements > MAX_ELEMENTS) throw new XflrError('too-large', tr('The XML file holds more than {max} elements.', { max: count(MAX_ELEMENTS) }));
      if (this.open.length >= MAX_DEPTH) throw new XflrError('too-large', tr('The XML file nests elements deeper than {max} levels.', { max: plain(MAX_DEPTH) }));
      this.i = TAG_END.lastIndex;
      this.open.push(m[0]);
      this.name = m[0];
      this.attrs = attrs;
      this.selfClosed = e[1] === '/';
      return START;
    }
  }
}

/**
 * Read the children of the element just opened, up to and including its end tag: visit(name) is
 * called with the lowercase name of each child element (XFLR5 compares names without case) and may
 * read it; what it leaves unread is skipped.
 */
function children(sc, visit) {
  const depth = sc.open.length;
  for (;;) {
    const kind = sc.next();
    if (kind === END) return;
    if (kind === START) {
      visit(sc.name.toLowerCase());
      while (sc.open.length > depth) sc.next();
    }
  }
}

/** Text of the element just opened, entities decoded, up to and including its end tag; child elements are skipped. */
function readText(sc) {
  const depth = sc.open.length;
  const parts = [];
  for (;;) {
    const kind = sc.next();
    if (kind === END && sc.open.length < depth) return parts.join('');
    if (kind === TEXT && sc.open.length === depth) parts.push(sc.cdata ? sc.text : decodeEntities(sc.text));
  }
}

/** Number of an element text, or NaN when it is empty, not a number or not finite (XFLR5 reads 0 then). */
function toNumber(text) {
  const t = text.trim();
  if (!NUMBER.test(t)) return NaN;
  const v = Number(t);
  // + 0 turns -0 ("-0.000" in the file) into 0.
  return Number.isFinite(v) ? v + 0 : NaN;
}

const isTrue = (text) => text.trim().toLowerCase() === 'true';

/** Reader warnings: add(...texts) keeps the first MAX_WARNINGS, done() lists them and counts the rest. */
function warningList() {
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
function problemList() {
  return { list: [], more: 0 };
}

function note(problems, p) {
  if (problems.list.length < MAX_PROBLEMS) problems.list.push(p);
  else problems.more++;
}

/** Number of element `element` (section n, or null for a wing value); NaN and a problem when it is not a number. */
function value(text, element, n, problems) {
  const v = toNumber(text);
  if (Number.isNaN(v)) note(problems, { element, n, text });
  return v;
}

/** Position "x, y, z": the first three parts; with fewer, 0, 0, 0 as in XFLR5. */
function readPosition(text, scale, problems) {
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
 * whose Position and Tilt_angle XFLR5 ignores (it writes 0 there).
 * @returns {{wing: object, type: string, isFin: boolean, problems: {list: object[], more: number}}}
 */
function readWing(sc, scale, top) {
  const wing = { name: '', description: '', symmetric: true, position: { x: 0, y: 0, z: 0 }, tilt: 0, sections: [] };
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
  return { wing, type, isFin, problems };
}

/** Slot of a plane's wing by XFLR5's rule: <Type>, else isFin, else the 1st wing read (fins counted) main, the 2nd elevator, later ones main. */
function planeSlot(type, isFin, index) {
  if (type !== 'OTHERWING') return SLOT[type];
  if (isFin) return 3;
  return index === 1 ? 2 : 0;
}

/** The warning texts of a wing's problems; `plane` is null for a wing outside a plane. */
function problemTexts(plane, wingName, problems) {
  const wing = displayName(wingName);
  const out = problems.list.map((p) => {
    const at = { plane: plane === null ? '' : displayName(plane), wing, element: p.element, n: p.n === null ? '' : plain(p.n), text: clip((p.text ?? '').trim()) };
    if (p.text === null) {
      return plane === null
        ? tr('Wing "{wing}", section {n}: {element} is missing.', at)
        : tr('Plane "{plane}", wing "{wing}", section {n}: {element} is missing.', at);
    }
    if (p.few) return tr('Plane "{plane}", wing "{wing}": Position "{text}" holds fewer than 3 values; the wing is placed at 0, 0, 0 as in XFLR5.', at);
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

  let wingOnly = false;
  if (planes.length) {
    if (topCount === 1) warnings.add(tr('The file holds a wing outside its planes; it is not imported.'));
    else if (topCount) warnings.add(tr('The file holds {count} wings outside its planes; they are not imported.', { count: count(topCount) }));
  } else if (top) {
    wingOnly = true;
    const name = displayName(top.wing.name);
    if (topCount > 1) warnings.add(tr('The file holds {count} wings outside a plane; XFLR5 reads only the last one, "{name}", and so does this import.', { count: count(topCount), name }));
    // XFLR5 would take any wing as the main wing; the role here comes from its Type.
    if (top.type === 'FIN' || top.isFin) throw new XflrError('fin', tr('The XML wing "{name}" is a fin; only a main wing or a horizontal stabilizer can be imported.', { name }));
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
