// XFLR5 import, second step: from a read XFLR5 file (src/import/xfl.js for .xfl projects,
// src/import/xflxml.js for XML plane and wing files) to a Wingdesigner project. One surface per
// import: the main wing (XFLR5 wing slot 0) or the horizontal stabilizer (slot 2, the "elevator").
//
// Geometry: XFLR5 measures y_position along the panels, and the dihedral of a section is the
// absolute angle of the panel outboard of it (the last section's value is unused). XFLR5 twists a
// section about its quarter-chord point, as Wingdesigner does with twistPivot 0.25. XFLR5 places its
// sections in mitred planes (src/geom/planes.js), and so does the import: Straight panels with mitred
// section planes are XFLR5's surface. The position of the wing in the plane moves the sections; its
// tilt angle turns the built part as a rigid body about the wing origin (settings.partTilt and
// partPivot, src/geom/part.js), as XFLR5 does. A part whose mitred planes would fold the surface or
// stretch an airfoil beyond the limit (mitredPlaneProblem in src/geom/wing.js) imports with vertical
// section planes.
//
// Airfoils: an .xfl project holds its airfoils; a name is looked up exactly, as XFLR5 does. XML files
// name them only. A name without an airfoil from the file goes through a chain of sources: uploaded
// .dat files, the current project, the bundled library, a NACA designation, and a similar name (a
// warning). The user can pick another airfoil for every name. XFLR5 draws an airfoil's own
// coordinates as they are. Where the coordinates of the airfoil in use are known (an airfoil of the
// .xfl project, an uploaded .dat, which XFLR5 reads as it is, or a NACA section of the generator,
// whose nose lies at (0, 0) as in XFLR5's own NACA foils) and its leading edge is off the origin or
// its chord is not 1, the sections that use it are moved and scaled to match (the airfoil frame).
// Library airfoils and current-project airfoils have no frame (the report warns when the chord line
// of a library airfoil is inclined: a level copy in XFLR5 turns its sections), except a
// current-project airfoil generated from the NACA equations (source kind 'naca': the NACA generator and Library presets of
// the Airfoils tab, the wizard, the sample wing): it gets the frame of the generated section of its
// NACA code. A cambered NACA section has one: its thickness is added across the mean line, so the
// point of least x lies ahead of and above the nose. A current-project airfoil of an XFLR5 import or
// an upload is stored at unit chord; its own coordinates are not known, and the report says so.
//
// Everything here is pure: the dialog (src/ui/xflr5.js) calls mapXflr5 again after every choice
// and shows its report.

import { cleanPoints, parseDat } from '../airfoil/parse.js';
import { LIMITS as CHECK_LIMITS, checkAirfoil } from '../airfoil/sanity.js';
import { bounds } from '../airfoil/geometry.js';
import { NACA_PRESETS, librarySource, nacaEntry, suggestAttribution } from '../airfoil/library.js';
import { leadingNacaCode, parseNacaCode } from '../airfoil/naca.js';
import { slug } from '../model/edit.js';
import { DEFAULT_SETTINGS, LIMITS, createProject, validateProject } from '../model/project.js';
import { fitProfile } from '../geom/profile.js';
import { SHORT_PANEL, panelDihedrals, sectionPlanes } from '../geom/planes.js';
import { mitredPlaneProblem } from '../geom/wing.js';
import { curvePoint } from '../geom/nurbs.js';
import { displayName } from '../model/budget.js';
import { count, fixed, language, plain, tr, whole } from '../i18n/index.js';

/** The surfaces an import offers, with their XFLR5 wing slot. */
export const SURFACES = Object.freeze({ main: 0, stab: 2 });

/**
 * Panels shorter than this along the span (mm) count as a shared y: XFLR5 skips panels below its
 * minimum panel size of 0.1 mm (Wing::s_MinPanelSize).
 */
export const MIN_PANEL = 0.1;

/** Largest move (mm) of a section that shares its y with the next one. */
export const NUDGE = 0.5;

/** Dihedral (degrees) above which the thinner sections of an import with vertical section planes are reported. */
export const DIHEDRAL_WARN = 10;

/**
 * Offset of an airfoil's leading edge from the origin, or of its chord from 1 (fraction of chord), in
 * its own coordinates (an .xfl airfoil, an uploaded .dat, a generated NACA section), above which the
 * report names the move of its sections. Every frame applies exactly: in real files the leading edge
 * of the fitted curve lies up to 7.6e-4 of the chord off the origin (a NACA 4415 with its nose point at
 * (0, 0.00075)), and dropping such an offset would put sections 0.30 mm off the coordinates XFLR5 draws.
 */
export const FRAME_TOLERANCE = 1e-3;

/** Frame offsets (fraction of chord) up to this are round-off of the curve fit and count as none. */
const FRAME_ROUND_OFF = 1e-9;

/** Frame offsets (fraction of chord) above which the move is a warning rather than an info line. */
export const FRAME_WARN = 0.02;

/**
 * Frames beyond these are not in chord units (a file in millimetres, say): XFLR5 would draw such an
 * airfoil many chords long. An .xfl airfoil beyond them fails the check; an upload is used without a
 * frame, with a warning. Leading-edge offset, and chord range.
 */
export const FRAME_LIMIT = Object.freeze({ offset: 0.1, chord: [0.5, 2] });

/**
 * The frame of an airfoil at the origin with chord 1, and of an airfoil whose own coordinates are not
 * known (library, current project except its NACA sections): the sections stay as mapped.
 */
const NO_FRAME = Object.freeze({ x: 0, y: 0, chord: 1 });

// Smallest width in y (mm) of a panel: a panel at 90° dihedral or more does not step outwards.
const MIN_WIDTH = 1e-3;

/**
 * Difference (degrees) between XFLR5's dihedral of a panel and the dihedral of its moved sections
 * above which the section stores XFLR5's (panelAngle). 0.001° changes a stretch at 60° by 3e-5.
 */
export const PANEL_ANGLE_TOLERANCE = 1e-3;

// Report lines of one kind that name one section or panel each (a moved section, say): the first
// ones, then a count of the rest. A damaged file can hold 20,000 sections.
const MAX_LINES = 5;

const DEG = Math.PI / 180;

// Section values checked for finite numbers, with the XML element names that messages use.
const FIELDS = [
  ['y', 'y_position'],
  ['chord', 'Chord'],
  ['offset', 'xOffset'],
  ['dihedral', 'Dihedral'],
  ['twist', 'Twist'],
];

const SEVERITY = { error: 0, warning: 1, info: 2 };

/** The program that wrote a read file, for messages: XFLR5 or flow5. */
export const programOf = (file) => (file.program === 'flow5' ? 'flow5' : 'XFLR5');

/** Order of report lines: errors, then warnings, then info. */
export const bySeverity = (a, b) => SEVERITY[a.severity] - SEVERITY[b.severity];

/** A number for messages: at most 4 decimals, -0 as 0. */
const num = (v) => plain(Number(v.toFixed(4)) + 0);

/**
 * A coordinate of an airfoil file for messages, bounded: beyond ±1,000,000 in words, small values
 * with 3 significant digits (a tiny chord is not "0"), others as num().
 */
const quoted = (v) => (Math.abs(v) >= 1e6 ? tr('beyond ±{max}', { max: whole(1e6) }) : Math.abs(v) < 1e-3 && v !== 0 ? plain(Number(v.toPrecision(3))) : num(v));

/** A frame value (fraction of chord) in % of chord for messages: 2 decimals (0.01 % is far below FRAME_TOLERANCE). */
const pct = (v) => plain(Number((v * 100).toFixed(2)) + 0);

/** -0 as 0 (the fold and the scaling can produce it). */
const zero = (v) => (v === 0 ? 0 : v);

/** Section numbers (ascending) as ranges, "1–3, 5"; after 10 ranges the list ends with "…". */
function ranges(ns) {
  const out = [];
  for (let i = 0; i < ns.length; ) {
    let j = i;
    while (j + 1 < ns.length && ns[j + 1] === ns[j] + 1) j++;
    out.push(j > i ? `${plain(ns[i])}–${plain(ns[j])}` : plain(ns[i]));
    i = j + 1;
  }
  return out.length > 10 ? `${out.slice(0, 10).join(', ')}, …` : out.join(', ');
}

/** "section 3" or "sections 1–3, 5" (1-based numbers, ascending; after 10 ranges "…"). */
export function sectionsText(ns) {
  return ns.length === 1 ? tr('section {n}', { n: plain(ns[0]) }) : tr('sections {list}', { list: ranges(ns) });
}

/** A name for messages: at most 200 characters, and a word for the empty name. */
function shownName(name) {
  return name === '' ? tr('(no name)') : displayName(name);
}

/**
 * Developed positions to y and z (mm): `D` holds each section's y_position in mm, measured along the
 * panels; each panel lies at the dihedral of its inner section. A panel shorter than MIN_PANEL has no
 * length, as in XFLR5 (NaN values stay NaN).
 */
function develop(D, sections) {
  const out = [];
  let Y = D[0];
  let Z = 0;
  for (let i = 0; i < D.length; i++) {
    const L = i > 0 ? D[i] - D[i - 1] : 0;
    if (i > 0 && !(Math.abs(L) < MIN_PANEL)) {
      const d = sections[i - 1].dihedral * DEG;
      Y += L * Math.cos(d);
      Z += L * Math.sin(d);
    }
    out.push([Y, Z]);
  }
  return out;
}

/** Name, section count, span of both halves and root chord (mm) of a wing, for the surface choice. */
function outline(wing, k) {
  const n = wing.sections.length;
  const pos = n ? develop(wing.sections.map((s) => k * s.y), wing.sections) : [];
  const span = n ? 2 * pos[n - 1][0] : NaN;
  const rootChord = n ? k * wing.sections[0].chord : NaN;
  const params = { name: shownName(wing.name), n: count(n), span: Number.isFinite(span) ? fixed(span, 0) : '?', chord: Number.isFinite(rootChord) ? fixed(rootChord, 0) : '?' };
  const detail =
    n === 0
      ? tr('"{name}": no sections', params)
      : n === 1
        ? tr('"{name}": 1 section, root chord {chord} mm', params)
        : tr('"{name}": {n} sections, span {span} mm, root chord {chord} mm', params);
  return { name: wing.name, sections: n, span, rootChord, detail };
}

/**
 * The surfaces of one plane: the main wing and the horizontal stabilizer with their availability,
 * and the wings that are not offered (the second wing and the fin).
 * @param {object} file XflrFile of a reader
 * @param {number} [planeIndex]
 * @returns {{surfaces: object[], others: {slot: number, name: string, label: string}[]}}
 *   surfaces: [{ key: 'main'|'stab', slot, label, available, reason, wing, name, sections, span, rootChord, detail }]
 */
export function planeSurfaces(file, planeIndex = 0) {
  const plane = file.planes[planeIndex];
  if (!plane) throw new RangeError(`no plane ${planeIndex}`);
  if (file.program === 'flow5') return flow5Surfaces(file, plane);
  const k = file.lengthUnit;
  const reasons = file.wingOnly
    ? { main: tr('The wing in this file is a horizontal stabilizer (type ELEVATOR).'), stab: tr('The wing in this file is not a horizontal stabilizer (type ELEVATOR).') }
    : { main: tr('This plane has no main wing.'), stab: tr('This plane has no elevator.') };
  const labels = { main: tr('Main wing'), stab: tr('Horizontal stabilizer (XFLR5: Elevator)') };
  const surfaces = Object.entries(SURFACES).map(([key, slot]) => {
    const wing = plane.wings[slot] ?? null;
    return { key, slot, label: labels[key], available: wing !== null, reason: wing ? null : reasons[key], wing, ...(wing ? outline(wing, k) : {}) };
  });
  const others = [];
  if (plane.wings[1]) others.push({ slot: 1, name: plane.wings[1].name, label: tr('Second wing') });
  if (plane.wings[3]) others.push({ slot: 3, name: plane.wings[3].name, label: tr('Fin') });
  return { surfaces, others };
}

/** A wing's angle (degrees) reduced by whole turns to −180..180; 0 for whole turns. */
const reduced = (a) => zero(a - 360 * Math.round(a / 360));

/**
 * The surfaces of a flow5 plane: one per wing, in file order: the first main wing ('main'), the first
 * elevator ('stab'), every other wing ('wing:<index>': a second main wing, a canard, a fin, another
 * wing), each with its roll (Rx_angle) and tilt (Ry_angle) as the part placement. A one-sided wing (a
 * fin) is the left half only and imports as that half; turned about z (its Ry_angle) it is not available.
 */
function flow5Surfaces(file, plane) {
  const k = file.lengthUnit;
  const firstMain = plane.wings.findIndex((w) => w.type === 'main');
  const firstStab = plane.wings.findIndex((w) => w.type === 'elevator');
  const seen = { main: 0, elevator: 0, fin: 0, other: 0 };
  const totals = { main: 0, elevator: 0, fin: 0, other: 0 };
  for (const w of plane.wings) totals[w.type]++;
  const label = (type) => {
    const n = ++seen[type];
    const many = totals[type] > 1;
    switch (type) {
      case 'main':
        return many ? tr('Main wing {n}', { n: plain(n) }) : tr('Main wing');
      case 'elevator':
        return many ? tr('Horizontal stabilizer {n} (flow5: Elevator)', { n: plain(n) }) : tr('Horizontal stabilizer (flow5: Elevator)');
      case 'fin':
        return many ? tr('Fin {n}', { n: plain(n) }) : tr('Fin');
      default:
        return many ? tr('Other wing {n}', { n: plain(n) }) : tr('Other wing');
    }
  };
  const surfaces = plane.wings.map((wing, i) => {
    const key = i === firstMain ? 'main' : i === firstStab ? 'stab' : `wing:${i}`;
    // flow5 turns a one-sided wing by Ry_angle about z, which a part placement (tilt and roll) cannot.
    const yawed = !wing.twoSided && Number.isFinite(wing.tilt) && reduced(wing.tilt) !== 0;
    const reason = yawed ? tr('A one-sided wing turned {angle}° about z (Ry_angle): a part turns about x and y only.', { angle: num(wing.tilt) }) : null;
    return { key, slot: i, label: label(wing.type), available: reason === null, reason, wing, ...outline(wing, k) };
  });
  return { surfaces, others: [] };
}

/**
 * A flow5 wing as the half wing of a part. A one-sided wing is flow5's left half: with its left-side
 * airfoils and the opposite roll, the part's right half is its mirror image and the part's left half
 * is flow5's half itself (mirroring turns a roll about x into the opposite roll). Its Ry_angle turns
 * about z and is 0 here (flow5Surfaces).
 */
function oneSidedAsHalf(wing) {
  if (!wing || wing.twoSided !== false) return wing;
  // A tilt that is no number stays, so that the mapping reports it.
  return { ...wing, oneSided: true, roll: -wing.roll, tilt: Number.isFinite(wing.tilt) ? 0 : wing.tilt, sections: wing.sections.map((s) => ({ ...s, rightFoil: s.leftFoil })) };
}

/** The surface a dialog selects first: the main wing, or the stabilizer when it is the only one. */
export function defaultSurface(file, planeIndex = 0) {
  return planeSurfaces(file, planeIndex).surfaces.find((s) => s.available)?.key ?? 'main';
}

/** The length unit of an XML file in words. */
function unitWord(unitName) {
  switch (unitName) {
    case 'mm':
      return tr('millimetres');
    case 'cm':
      return tr('centimetres');
    case 'dm':
      return tr('decimetres');
    case 'm':
      return tr('metres');
    case 'in':
      return tr('inches');
    default:
      return tr('feet');
  }
}

/** One line on the kind of file, for the dialog. */
export function describeFile(file) {
  if (file.program === 'flow5') return describeFlow5(file);
  if (file.kind === 'xfl') {
    const format = plain(file.format);
    return file.format === 200001 ? tr('XFLR5 project, format {format} (XFLR5 6.10 to 6.43)', { format }) : tr('XFLR5 project, format {format} (XFLR5 6.44 or later)', { format });
  }
  if (file.unitName) {
    const unit = unitWord(file.unitName);
    return file.wingOnly ? tr('XFLR5 wing file (XML), lengths in {unit}', { unit }) : tr('XFLR5 plane file (XML), lengths in {unit}', { unit });
  }
  const factor = num(file.lengthUnit);
  return file.wingOnly ? tr('XFLR5 wing file (XML), lengths in units of {factor} mm', { factor }) : tr('XFLR5 plane file (XML), lengths in units of {factor} mm', { factor });
}

/** One line on a flow5 file, for the dialog. */
function describeFlow5(file) {
  if (file.kind === 'fl5') {
    const format = plain(file.format);
    return file.format === 500750 ? tr('flow5 project, format {format} (flow5 7.50 to 7.53)', { format }) : tr('flow5 project, format {format} (flow5 7.54 or later)', { format });
  }
  if (file.unitName) {
    const unit = unitWord(file.unitName);
    return file.wingOnly ? tr('flow5 wing file (XML), lengths in {unit}', { unit }) : tr('flow5 plane file (XML), lengths in {unit}', { unit });
  }
  const factor = num(file.lengthUnit);
  return file.wingOnly ? tr('flow5 wing file (XML), lengths in units of {factor} mm', { factor }) : tr('flow5 plane file (XML), lengths in units of {factor} mm', { factor });
}

/** True when two sections at one y describe the same section (a duplicate XFLR5 draws as nothing). */
function identical(a, b) {
  return a.chord === b.chord && a.offset === b.offset && a.twist === b.twist && a.rightFoil === b.rightFoil && a.leftFoil === b.leftFoil;
}

/**
 * Wingdesigner sections of an XFLR5 wing: y and z from the developed y_position and the dihedral,
 * the clean-up of sections that share y or have tiny chords, then the position of the wing in the
 * plane (translation by the position x and z; the position y is not used, as in XFLR5). The tilt
 * angle is returned, not applied: the project turns the built part about the wing origin.
 * @param {object} wing Wing of an XflrFile (lengths in file units)
 * @param {number} lengthUnit millimetres per file length unit
 * @returns {{sections: {index: number, x: number, y: number, z: number, chord: number, twist: number, foil: string}[], report: {severity: string, text: string}[], steep: {severity: string, text: string}[], tilt: {angle: number, x: number, z: number}|null, rolls: number[]}}
 *   `index` is the 0-based XFLR5 section number; `sections` is empty when the report has an error.
 *   `steep`: the warnings on panels above DIHEDRAL_WARN, for an import with vertical section planes.
 *   `tilt`: the tilt angle and, for a flow5 wing, the roll angle (degrees, each reduced by whole turns
 *   to −180..180) about the wing origin x, z (mm): { angle, roll, x, z }, or null for a part without
 *   either. `rolls`: XFLR5's roll of each section's mitred plane
 *   (degrees), from the panels in the frame of the part.
 */
export function mapSections(wing, lengthUnit, program = 'XFLR5') {
  const report = [];
  const add = (severity, text) => report.push({ severity, text });
  const failed = () => report.some((r) => r.severity === 'error');
  const steepLines = [];
  let folded = null;
  let rolls = [];
  const out = (sections) => ({ sections, report, steep: sections.length ? steepLines : [], tilt: sections.length ? folded : null, rolls: sections.length ? rolls : [] });
  const src = wing.sections;
  const n = src.length;
  const k = lengthUnit;
  if (!(k > 0 && k < Infinity)) add('error', tr('The length unit of the file is not a positive number.'));
  if (n < 2) add('error', tr('The wing needs at least 2 sections (found {n}).', { n: count(n) }));
  // One line per value that is not a number, listing the sections; the last section's dihedral
  // belongs to no panel.
  for (const [key, field] of FIELDS) {
    const bad = [];
    src.forEach((s, i) => {
      if (!(key === 'dihedral' && i === n - 1) && !Number.isFinite(s[key])) bad.push(i + 1);
    });
    if (bad.length) add('error', tr('{field} is not a finite number in the file at {sections}.', { field, sections: sectionsText(bad) }));
  }
  const { position, tilt } = wing;
  // A flow5 wing turns by Rx_angle about x before the tilt (Ry_angle) about y; XFLR5 has no roll.
  const roll = wing.roll ?? 0;
  if (!Number.isFinite(roll)) add('error', tr('The roll angle (Rx_angle) of the wing is not a finite number in the file.'));
  if (!Number.isFinite(position.x) || !Number.isFinite(position.z)) add('error', tr('The position of the wing in the plane is not a finite number in the file.'));
  if (!Number.isFinite(tilt)) add('error', tr('The tilt angle of the wing is not a finite number in the file.'));
  if (failed()) return out([]);

  // Developed span positions (mm) and the panels between them. A root within MIN_PANEL of the centre
  // is the centre: XFLR5 separates the two halves only beyond it, and Wingdesigner joins them at y = 0.
  const D = src.map((s) => k * s.y);
  if (D[0] <= -MIN_PANEL) add('error', tr('The root section lies at y_position {y} mm; the half wing must start at y >= 0.', { y: num(D[0]) }));
  else if (D[0] <= MIN_PANEL && D[0] !== 0) {
    if (num(D[0]) !== num(0)) add('info', tr('Root y_position {y} mm lies within 0.1 mm of the centre and is set to 0, as {program} joins the halves there.', { program, y: num(D[0]) }));
    D[0] = 0;
  }
  const equal = [false];
  const back = [];
  for (let i = 1; i < n; i++) {
    const L = D[i] - D[i - 1];
    equal.push(Math.abs(L) < MIN_PANEL);
    if (L <= -MIN_PANEL) back.push(i + 1);
  }
  if (back.length) add('error', tr('y_position decreases at {sections}; the sections must run from root to tip.', { sections: sectionsText(back) }));
  const flat = src.flatMap((s, i) => (s.chord > 0 ? [] : [i + 1]));
  if (flat.length) add('error', tr('The chord must be greater than 0 at {sections}.', { sections: sectionsText(flat) }));
  if (equal.slice(1).every(Boolean)) add('error', tr('All sections of the wing lie at y = {y} mm: the wing has no span.', { y: num(D[0]) }));
  let bent = false;
  const upright = lineCap(add, 'error', (more) => tr('Further panels whose outer end does not lie further out in y: {count}.', { count: more }));
  const steep = lineCap((severity, text) => steepLines.push({ severity, text }), 'warning', (more) => tr('Further panels with more than {angle}° dihedral: {count}.', { angle: plain(DIHEDRAL_WARN), count: more }));
  for (let i = 0; i < n - 1; i++) {
    // Panels of no length, and panels that run back (reported above), have no width to check.
    if (equal[i + 1] || D[i + 1] < D[i]) continue;
    const delta = src[i].dihedral;
    const at = { a: plain(i + 1), b: plain(i + 2), angle: num(delta) };
    if ((D[i + 1] - D[i]) * Math.cos(delta * DEG) < MIN_WIDTH) {
      upright.add(() => tr('The panel from section {a} to {b} has {angle}° dihedral: its outer end must lie further out in y than its inner end.', at));
    } else if (Math.abs(delta) > DIHEDRAL_WARN) {
      steep.add(() => tr('The panel from section {a} to {b} has {angle}° dihedral: the vertical sections are {pct} % as thick across the panel as in {program}.', { program, ...at, pct: fixed(Math.cos(delta * DEG) * 100, 0) }));
    }
    if (delta !== 0) bent = true;
  }
  upright.done();
  steep.done();
  if (failed()) return out([]);
  if (bent) add('info', tr('{program} measures y_position along the panels; y and z were computed from it and the dihedral.', { program }));

  // Wing frame: y and z of each section; a panel shorter than MIN_PANEL has no length, as in XFLR5.
  const items = develop(D, src).map(([y, z], i) => {
    const s = src[i];
    return { index: i, x: k * s.offset, y, z, chord: k * s.chord, twist: s.twist, dihedral: s.dihedral, s };
  });

  // Runs of sections at one y: identical members go silently (the outer one stays, it carries the
  // dihedral of the next panel). The others move apart by up to NUDGE along the panel next to the
  // run: inwards along the inner panel, or outwards along the outer panel for a run at the root.
  const kept = [];
  const moved = lineCap(add, 'warning', (more) => tr('Further sections moved apart: {count}.', { count: more }));
  for (let a = 0; a < n; ) {
    let b = a;
    while (b + 1 < n && equal[b + 1]) b++;
    const run = [];
    for (let j = a; j <= b; j++) if (j === b || !identical(items[j].s, items[j + 1].s)) run.push(items[j]);
    const m = run.length - 1;
    if (m > 0 && a > 0) {
      const d = Math.min(NUDGE, (D[a] - D[a - 1]) / 4);
      const delta = items[a - 1].dihedral * DEG;
      run.slice(0, m).forEach((q, j) => {
        const dj = (d * (m - j)) / m;
        q.y -= dj * Math.cos(delta);
        q.z -= dj * Math.sin(delta);
        moved.add(() => tr('Sections {a} and {b} share y = {y} mm; section {a} was moved {d} mm inwards.', { a: plain(q.index + 1), b: plain(run[m].index + 1), y: num(run[m].y), d: num(dj) }));
      });
    } else if (m > 0) {
      const d = Math.min(NUDGE, (D[b + 1] - D[b]) / 4);
      const delta = items[b].dihedral * DEG;
      run.slice(1).forEach((q, j) => {
        const dj = (d * (j + 1)) / m;
        q.y += dj * Math.cos(delta);
        q.z += dj * Math.sin(delta);
        moved.add(() => tr('Sections {a} and {b} share y = {y} mm; section {b} was moved {d} mm outwards.', { a: plain(run[0].index + 1), b: plain(q.index + 1), y: num(run[0].y), d: num(dj) }));
      });
    }
    kept.push(...run);
    a = b + 1;
  }
  moved.done();

  const thin = [];
  for (const q of kept) {
    if (q.chord < LIMITS.minChord) {
      thin.push(q.index + 1);
      q.chord = LIMITS.minChord;
    }
  }
  if (thin.length) add('warning', tr('Chords below {min} mm were raised to {min} mm, the smallest chord Wingdesigner builds, at {sections}.', { min: plain(LIMITS.minChord), sections: sectionsText(thin) }));
  if (D[0] > 0) add('info', tr('The root lies at y = {y} mm: the two halves are built as separate bodies, as in {program}.', { program, y: num(kept[0].y) }));

  rolls = sectionPlanes(kept, 'mitred').rolls;
  // Tilt about the wing origin (positive = nose up): stored for the rigid placement of the part.
  const X = k * position.x;
  const ZL = k * position.z;
  // Stored within ±180°: an angle of whole turns turns nothing.
  const angle = reduced(tilt);
  const rollAngle = reduced(roll);
  if (angle !== 0 || rollAngle !== 0) folded = { angle, roll: rollAngle, x: X, z: ZL, turnedLeft: rollAngle !== 0 && !wing.oneSided };
  if (rollAngle !== 0) {
    add('info', tr('Roll angle {angle}° (Rx_angle) applied as in the flow5 plane: the part turns as a rigid body about the wing origin, before the tilt (Settings > Part roll).', { angle: num(rollAngle) }));
    // flow5 turns both halves as one body: the left half of the part turns with it. A one-sided wing
    // has one half only, which the left half of the part is exactly (oneSidedAsHalf).
    if (!wing.oneSided) add('info', tr('flow5 rolls the whole wing as one body, so its left half rolls the other way: Settings > Left half is set to Turned with the right half.'));
  }
  if (angle !== 0) {
    add('info', tr('Tilt angle {angle}° applied as in the {program} plane: the part turns as a rigid body about the wing origin (Settings > Part tilt).', { program, angle: num(angle) }));
  }
  // Whole turns of twist (a tilt of 400°, say) give the same sections: one turn common to all keeps
  // the differences between the sections, which the spanwise interpolation uses.
  const turn = 360 * Math.round(kept.reduce((sum, q) => sum + q.twist, 0) / kept.length / 360);
  if (turn !== 0 && Number.isFinite(turn)) {
    for (const q of kept) q.twist -= turn;
    add('info', tr('All twists were changed by {angle}°, a whole number of turns; the sections stay the same.', { angle: num(-turn) }));
  }
  if (X !== 0 || ZL !== 0) {
    for (const q of kept) {
      q.x += X;
      q.z += ZL;
    }
    add('info', tr('Position in the {program} plane applied: the wing origin moved to x {x} mm, z {z} mm.', { program, x: num(X), z: num(ZL) }));
  }
  if (Number.isFinite(position.y) && position.y !== 0) add('info', tr('Position y {y} mm is not used, as in {program}.', { program, y: num(k * position.y) }));

  const sides = src.flatMap((s, i) => (s.leftFoil !== s.rightFoil ? [i + 1] : []));
  if (sides.length) add('warning', tr('Left and right airfoils differ at {sections}; the right-side airfoils are used.', { sections: sectionsText(sides) }));

  const sections = kept.map((q) => ({ index: q.index, x: zero(q.x), y: zero(q.y), z: zero(q.z), chord: q.chord, twist: zero(q.twist), foil: q.s.rightFoil }));
  // Values a project cannot hold are reported here, in XFLR5's section numbers.
  if (!withinLimits(sections, add)) return out([]);
  return out(sections);
}

/**
 * Report the sections (1-based XFLR5 numbers from `index`) whose position, chord or twist lies beyond
 * what a Wingdesigner project holds (LIMITS); false when there is one.
 */
function withinLimits(sections, add) {
  const beyond = lineCap(add, 'error', (more) => tr('Further sections beyond the limits of Wingdesigner: {count}.', { count: more }));
  for (const q of sections) {
    const n = plain(q.index + 1);
    const at = (v) => Math.abs(v) <= LIMITS.maxCoordinate;
    if (!(at(q.x) && at(q.y) && at(q.z))) beyond.add(() => tr('Section {n}: the position lies beyond ±{max} mm, the limit of Wingdesigner.', { n, max: whole(LIMITS.maxCoordinate) }));
    // A chord of 1e308 m, a valid number in the file, overflows in mm.
    else if (!Number.isFinite(q.chord)) beyond.add(() => tr('Section {n}: the chord lies beyond {max} mm, the limit of Wingdesigner.', { n, max: whole(LIMITS.maxChord) }));
    else if (!(q.chord <= LIMITS.maxChord)) {
      beyond.add(() => tr('Section {n}: chord {chord} mm is larger than {max} mm, the limit of Wingdesigner.', { n, chord: whole(Number(q.chord.toFixed(4)) + 0), max: whole(LIMITS.maxChord) }));
    } else if (!(Math.abs(q.twist) <= LIMITS.maxTwist)) {
      beyond.add(() => tr('Section {n}: twist {angle}° lies beyond ±{max}°, the limit of Wingdesigner.', { n, angle: num(q.twist), max: plain(LIMITS.maxTwist) }));
    }
  }
  beyond.done();
  return beyond.count === 0;
}

/**
 * Report lines of one kind, each about a section or a panel: the first MAX_LINES (texts made only for
 * those), then one line from `rest` with the count of the others. `count` is the number of lines asked for.
 */
function lineCap(add, severity, rest) {
  const cap = {
    count: 0,
    add(text) {
      if (cap.count++ < MAX_LINES) add(severity, text());
    },
    done() {
      if (cap.count > MAX_LINES) add(severity, rest(count(cap.count - MAX_LINES)));
    },
  };
  return cap;
}

// Check results, cached per object and language (messages are translated): the dialog maps again
// after every choice. The generated NACA sections are cached per XFLR5 file, and go with it.
const checkCache = new WeakMap();
const nacaCaches = new WeakMap();

/** The cache of generated NACA sections of one XFLR5 file. */
function nacaCacheOf(file) {
  let cache = nacaCaches.get(file);
  if (!cache) nacaCaches.set(file, (cache = new Map()));
  return cache;
}

function cached(map, key, compute) {
  const hit = map.get(key);
  if (hit && hit.lang === language()) return hit.value;
  const value = compute();
  map.set(key, { lang: language(), value });
  return value;
}

/** First error message of an issue list, or null. */
const firstError = (issues) => issues.find((i) => i.severity === 'error')?.message ?? null;

/**
 * Where an airfoil's own coordinates put it, in chords, relative to the unit chord Wingdesigner
 * builds: its leading edge (the point of least x on the fitted profile curve `prof`, which the build
 * moves to the origin) and its chord up to the trailing-edge midpoint (which the build scales to 1).
 * XFLR5 draws the coordinates as they are. `raw` are the points of the .xfl airfoil or the uploaded
 * file after the clean-up of the parser (cleanPoints, parseDat), before the check normalizes them;
 * `checkedPoints` are the checked points of `raw`: raw points moved by the least x and the
 * leading-edge y and scaled by the x range. The frame is exact; FRAME_TOLERANCE only decides whether the
 * report names it.
 */
function airfoilFrame(raw, checkedPoints, prof) {
  const b = bounds(raw);
  const scale = b.xmax - b.xmin;
  const origin = [b.xmin, raw[0][1] - checkedPoints[0][1] * scale];
  const le = curvePoint(prof.curve, prof.tLE);
  const teX = (checkedPoints[0][0] + checkedPoints[checkedPoints.length - 1][0]) / 2;
  // Round-off of the fit (1e-20 for a symmetric NACA section) is no offset: 1e-9 of the chord is
  // 0.4 nm at 400 mm.
  const exact = (v, to) => (Math.abs(v - to) > FRAME_ROUND_OFF ? v : to);
  return { x: exact(origin[0] + le[0] * scale, 0), y: exact(origin[1] + le[1] * scale, 0), chord: exact((teX - le[0]) * scale, 1) };
}

/**
 * Check cleaned-up points as the Airfoils tab does: checkAirfoil, then the fitted profile curve, which
 * must not cross itself or run back in x (the build would fail). `prof` is the curve when it passes.
 */
function inspect(raw, extra = []) {
  const c = checkAirfoil(raw);
  const issues = [...extra, ...c.issues];
  let prof = null;
  if (firstError(issues) === null) {
    const fit = fitProfile(c.points, DEFAULT_SETTINGS.parametrization);
    if (fit.issue) issues.push(fit.issue);
    else prof = fit.prof;
  }
  const problem = firstError(issues);
  return { ok: problem === null, points: c.points, issues, problem, prof: problem === null ? prof : null };
}

/** A check as the rows use it: checked points, issues and the first error. */
function checked(raw, extra = []) {
  const c = inspect(raw, extra);
  return { ok: c.ok, points: c.points, issues: c.issues, problem: c.problem };
}

/**
 * Angle (degrees) of the chord line against the x axis of checked points, from the leading edge of the
 * fitted profile curve `prof` to the trailing-edge midpoint; positive when the trailing edge lies
 * higher (nose down). The build keeps this angle: twist refers to the x axis.
 */
function chordIncline(checkedPoints, prof) {
  const le = curvePoint(prof.curve, prof.tLE);
  const a = checkedPoints[0];
  const b = checkedPoints[checkedPoints.length - 1];
  return (Math.atan2((a[1] + b[1]) / 2 - le[1], (a[0] + b[0]) / 2 - le[0]) * 180) / Math.PI;
}

/**
 * Parse and check the text of a library entry. Its coordinates in XFLR5 are not known: it gets no
 * frame. `ownFrame` is where its own coordinates put it (the frame an upload of the same file would
 * have, without FRAME_LIMIT; null when it fails the check), with the `incline` of its chord line, for
 * the report.
 */
function checkText(text, fileName) {
  const parsed = parseDat(text, { fileName });
  if (firstError(parsed.issues)) return { ok: false, name: parsed.name, points: parsed.points, issues: parsed.issues, problem: firstError(parsed.issues), ownFrame: null };
  const c = inspect(parsed.points, parsed.issues);
  const ownFrame = c.ok ? { ...airfoilFrame(parsed.points, c.points, c.prof), incline: chordIncline(c.points, c.prof) } : null;
  return { ok: c.ok, name: parsed.name, points: c.points, issues: c.issues, problem: c.problem, ownFrame };
}

/** True when a frame moves or scales the sections. */
const moves = (frame) => frame.x !== 0 || frame.y !== 0 || frame.chord !== 1;

/** True when the report names a frame: an offset above FRAME_TOLERANCE of the chord. */
const noted = (frame) => Math.abs(frame.x) > FRAME_TOLERANCE || Math.abs(frame.y) > FRAME_TOLERANCE || Math.abs(frame.chord - 1) > FRAME_TOLERANCE;

/**
 * An airfoil whose own coordinates XFLR5 draws (an .xfl airfoil, an uploaded .dat, a generated NACA
 * section): the result of the parser's clean-up (`parsed`: cleanPoints or parseDat, points not yet
 * normalized), checked, with its frame. A frame far from chord units (FRAME_LIMIT, or a file the
 * parser read as percent of chord that does not end at 100) cannot be what XFLR5 drew: with
 * `refuseOutside` (an .xfl airfoil) it fails the check; otherwise (an upload, the user's airfoil for a
 * name) it is used without a frame, scaled to unit chord, with a warning.
 * @returns {{ok: boolean, name: string, points: number[][], issues: object[], problem: string|null, frame: object|null}}
 */
function checkFramed(parsed, { refuseOutside = true } = {}) {
  const failed = (issues, problem) => ({ ok: false, name: parsed.name, points: parsed.points, issues, problem, frame: null });
  if (firstError(parsed.issues)) return failed(parsed.issues, firstError(parsed.issues));
  const c = inspect(parsed.points, parsed.issues);
  if (!c.ok) return failed(c.issues, c.problem);
  const frame = airfoilFrame(parsed.points, c.points, c.prof);
  // The parser divides the coordinates by 100 when x ends between 5 and 110: a file in millimetres
  // or inches with a chord of 50 to 110 gets there too. Only a percent file ending at x = 100 is in
  // chord units. Messages quote the numbers of the file.
  const percent = parsed.issues.some((i) => i.code === 'percent');
  const k = percent ? 100 : 1;
  const { offset, chord } = FRAME_LIMIT;
  const outside = Math.abs(frame.x) > offset || Math.abs(frame.y) > offset || !(frame.chord >= chord[0] && frame.chord <= chord[1]) || (percent && Math.abs(frame.chord - 1) > FRAME_WARN);
  // Where the frame applies, the sections are scaled, not the coordinates, and where it cannot, the
  // frame's message says so: the check's note on scaling to unit chord goes.
  const kept = c.issues.filter((i) => i.code !== 'not-normalized' && !(outside && i.code === 'percent'));
  if (outside) {
    const at = { x: quoted(k * frame.x), y: quoted(k * frame.y), te: quoted(k * (frame.x + frame.chord)) };
    if (refuseOutside) {
      const problem = tr('The coordinates are not in chord units (leading edge at x\u00a0=\u00a0{x}, y\u00a0=\u00a0{y}; trailing edge at x\u00a0=\u00a0{te}).', at);
      return failed([{ severity: 'error', code: 'frame', message: problem }, ...kept], problem);
    }
    const message = tr(
      'The coordinates are not in chord units (leading edge at x\u00a0=\u00a0{x}, y\u00a0=\u00a0{y}; trailing edge at x\u00a0=\u00a0{te}): XFLR5 and flow5 cannot have drawn them as they are, so the airfoil is scaled to unit chord and its sections keep the values of the file.',
      at,
    );
    return { ok: true, name: parsed.name, points: c.points, issues: [{ severity: 'warning', code: 'frame', message }, ...kept], problem: null, frame: NO_FRAME };
  }
  return { ok: true, name: parsed.name, points: c.points, issues: moves(frame) ? kept : c.issues, problem: null, frame: moves(frame) ? frame : NO_FRAME };
}

/** An airfoil of an .xfl project: its base points cleaned up like an uploaded file, then checked, with its frame. */
function checkFileFoil(foil) {
  return cached(checkCache, foil, () => checkFramed(cleanPoints(foil.name, foil.points)));
}

/**
 * A generated NACA section, checked, with the frame of its generated coordinates (nose at (0, 0), as
 * XFLR5's NACA foils): cached per XFLR5 file.
 */
function checkNaca(file, code) {
  return cached(nacaCacheOf(file), code, () => {
    const entry = nacaEntry(code);
    return { ...checkFramed(cleanPoints(entry.name, entry.points)), entry };
  });
}

/** True when two point lists agree within 1e-9, as addAirfoil compares NACA metadata with stored points. */
const samePoints = (p, q) => p.length === q.length && p.every((pt, i) => Math.abs(pt[0] - q[i][0]) <= 1e-9 && Math.abs(pt[1] - q[i][1]) <= 1e-9);

/**
 * A current-project airfoil, checked. Its coordinates in XFLR5 are not known: it has no frame, except
 * a section generated from the NACA equations (source kind 'naca') whose points are the generated
 * section of its code (source.code, or the designation that is its name, as the sample wing stores
 * it), as generated (the wizard, the sample wing) or checked (the Airfoils tab stores the checked
 * points, which no longer show the generator's frame). It gets the check and the frame of the
 * generated section of its code, so that the file gives the same wing as with no project open; where
 * that frame is not in chord units, it is used without a frame, with the warning of an upload. NACA
 * metadata with other points (a hand-edited project file) is not trusted, as addAirfoil does not.
 */
function checkProjectAirfoil(a) {
  const c = checked(a.points);
  if (!c.ok || a.source?.kind !== 'naca') return c;
  const code = parseNacaCode(a.source.code ?? airfoilLabel(a))?.code;
  if (!code) return c;
  const entry = nacaEntry(code, { closedTE: a.source.closedTE === true });
  const g = checkFramed(cleanPoints(entry.name, entry.points), { refuseOutside: false });
  return g.ok && samePoints(g.points, c.points) ? { ok: true, points: c.points, issues: g.issues, problem: null, frame: g.frame } : c;
}

/**
 * Read an airfoil file uploaded in the import dialog. The result goes into the `uploads` option of
 * mapXflr5, which matches it to the XFLR5 names by its name line and by its file name. XFLR5 reads a
 * .dat file as it is: the upload has a frame, as an airfoil of an .xfl project. A file that is not in
 * chord units (in millimetres, say) cannot be the one XFLR5 drew: it is used without a frame, with a warning.
 * @returns {{fileName: string, name: string, ok: boolean, points: number[][], issues: object[], problem: string|null, frame: object|null, source: object}}
 *   points: checked (unit chord); frame: where the file's own coordinates put the airfoil (null when it fails the check)
 */
export function readAirfoilUpload(text, fileName = '') {
  const r = checkFramed(parseDat(text, { fileName }), { refuseOutside: false });
  return { fileName, ...r, source: { kind: 'upload', file: String(fileName).slice(0, LIMITS.maxText), attribution: suggestAttribution(r.name) } };
}

/**
 * An upload refused before parsing (too large, unreadable, an XFLR5 file), in the shape of
 * readAirfoilUpload(): `problem` is a sentence that names the file.
 */
export function refusedUpload(fileName, problem) {
  return {
    fileName,
    name: fileName,
    ok: false,
    points: [],
    issues: [{ severity: 'error', message: problem }],
    problem,
    frame: null,
    refused: true,
    source: { kind: 'upload', file: String(fileName).slice(0, LIMITS.maxText) },
  };
}

/** Names compared loosely: case-insensitive, without spaces, "-" and "_". */
const loose = (s) => s.toLowerCase().replace(/[\s_-]+/g, '');

/** File name without its extension. */
const baseName = (s) => String(s).replace(/\.[^./\\]*$/, '');

/** The name of a current-project airfoil: its name, or its id when the name is blank. */
const airfoilLabel = (a) => (typeof a.name === 'string' && a.name.trim() ? a.name : a.id);

/**
 * The airfoil sources of one mapping: the options of the dialog's select, and the loader of an
 * option key ('file:<name>', 'upload:<i>', 'project:<id>', 'library:<id>', 'naca:<code>').
 */
function airfoilSources(file, plane, fileName, { project, library, uploads }) {
  const foils = (file.kind === 'xfl' || file.kind === 'fl5') && file.foils ? file.foils : null;
  const flow5 = file.program === 'flow5';
  const projectAirfoils = new Map((project?.airfoils ?? []).filter((a) => a && typeof a.id === 'string' && Array.isArray(a.points)).map((a) => [a.id, a]));
  const libraryEntries = new Map(library.map((e) => [e.id, e]));
  const options = [];
  if (foils) for (const name of foils.keys()) options.push({ key: `file:${name}`, kind: 'file', name, label: tr('From the file: {name}', { name: shownName(name) }) });
  uploads.forEach((u, i) => options.push({ key: `upload:${i}`, kind: 'upload', name: u.name, label: tr('Uploaded: {file}', { file: displayName(u.fileName) }), ok: u.ok }));
  for (const a of projectAirfoils.values()) options.push({ key: `project:${a.id}`, kind: 'project', name: airfoilLabel(a), label: tr('Current project: {name}', { name: displayName(airfoilLabel(a)) }) });
  for (const e of libraryEntries.values()) options.push({ key: `library:${e.id}`, kind: 'library', name: e.name, label: tr('Library: {name}', { name: displayName(e.name) }) });
  for (const p of NACA_PRESETS) options.push(nacaOption(p.code));

  const note = (name) => {
    const params = { name: displayName(name), plane: displayName(plane.name) };
    if (flow5) return plane.name.trim() === '' ? tr('Airfoil "{name}" from a flow5 project; the stored shape.', params) : tr('Airfoil "{name}" from flow5 plane "{plane}"; the stored shape.', params);
    return plane.name.trim() === '' ? tr('Airfoil "{name}" from an XFLR5 project; base shape without flap deflection.', params) : tr('Airfoil "{name}" from XFLR5 plane "{plane}"; base shape without flap deflection.', params);
  };

  /**
   * The airfoil of an option key, or null for an unknown key: { ok, airfoil, shown, issues, problem, frame?, ownFrame?, unknownFrame?, foil? };
   * `frame` for the airfoils whose own coordinates XFLR5 draws (file, upload, NACA, and a current-project
   * section generated from the NACA equations, with the frame of the generated section of its code);
   * `ownFrame` for a library entry and a current-project airfoil taken from it (report only);
   * `unknownFrame` for a current-project airfoil of an XFLR5 import or an upload, stored at unit chord
   * (report only); `shown`: the name of the airfoil in report lines (an upload with its file name, as
   * the select shows it).
   */
  const load = (key) => {
    const at = key.indexOf(':');
    const kind = key.slice(0, at);
    const id = key.slice(at + 1);
    if (kind === 'file') {
      const foil = foils?.get(id);
      if (!foil) return null;
      const c = checkFileFoil(foil);
      const attribution = suggestAttribution(c.name);
      const source = { kind: flow5 ? 'flow5' : 'xflr5', file: String(fileName).slice(0, LIMITS.maxText), note: note(c.name), ...(attribution ? { attribution } : {}) };
      return { ...c, shown: shownName(c.name), airfoil: { name: c.name, points: c.points, source }, foil };
    }
    if (kind === 'upload') {
      const u = /^\d+$/.test(id) ? uploads[Number(id)] : undefined;
      if (!u) return null;
      const shown = `${shownName(u.name)} (${displayName(u.fileName)})`;
      return { ok: u.ok, points: u.points, issues: u.issues, problem: u.problem, frame: u.frame, shown, airfoil: { name: u.name, points: u.points, source: u.source } };
    }
    if (kind === 'project') {
      const a = projectAirfoils.get(id);
      if (!a) return null;
      // A section generated from the NACA equations gets the frame of the generated section of its code.
      const c = cached(checkCache, a, () => checkProjectAirfoil(a));
      // Taken from the Library (the same points): the report notes its own coordinates as for the
      // library entry. Of an XFLR5 import or an upload: stored at unit chord, its own coordinates are lost.
      const e = c.ok && a.source?.kind === 'library' ? libraryEntries.get(a.source.id) : undefined;
      const lib = e ? cached(checkCache, e, () => checkText(e.text, e.file)) : null;
      const ownFrame = lib?.ok && samePoints(lib.points, c.points) ? lib.ownFrame : null;
      const unknownFrame = c.ok && (a.source?.kind === 'xflr5' || a.source?.kind === 'flow5' || a.source?.kind === 'upload');
      return {
        ...c,
        ...(ownFrame ? { ownFrame } : {}),
        ...(unknownFrame ? { unknownFrame } : {}),
        shown: shownName(airfoilLabel(a)),
        airfoil: { name: airfoilLabel(a), points: a.points, ...(a.source ? { source: structuredClone(a.source) } : {}) },
      };
    }
    if (kind === 'library') {
      const e = libraryEntries.get(id);
      if (!e) return null;
      const c = cached(checkCache, e, () => checkText(e.text, e.file));
      return { ...c, shown: shownName(e.name), airfoil: { name: e.name, points: c.points, source: librarySource(e) } };
    }
    if (kind === 'naca') {
      const code = parseNacaCode(id)?.code;
      if (!code) return null;
      const { entry, ...c } = checkNaca(file, code);
      // Stored as generated (as the wizard does), so that addAirfoil recognizes the section; the frame
      // puts its nose (0, 0) at the section point, as XFLR5 draws its NACA foils.
      return { ...c, shown: shownName(entry.name), airfoil: { name: entry.name, points: entry.points, source: entry.source } };
    }
    return null;
  };

  /** The label of an option key, as the select shows it. */
  const labelOf = (key) => {
    if (key.startsWith('naca:')) return nacaOption(key.slice(5)).label;
    return options.find((o) => o.key === key)?.label ?? key;
  };

  // Name lookups of the chain, built once: the candidates of each name, in order.
  const index = (pairs) => {
    const m = new Map();
    for (const [name, key] of pairs) {
      // An empty name (a loose "_" too) names nothing: it must not match every other empty name.
      if (name === '') continue;
      const list = m.get(name);
      if (list) list.push(key);
      else m.set(name, [key]);
    }
    return m;
  };
  const usable = uploads.flatMap((u, i) => (u.ok ? [[u, `upload:${i}`]] : []));
  const projectPairs = [...projectAirfoils.values()].map((a) => [airfoilLabel(a), `project:${a.id}`]);
  const libraryPairs = [...libraryEntries.values()].map((e) => [e.name, `library:${e.id}`]);
  const stages = [
    ['upload', index(usable.map(([u, key]) => [u.name, key])), (s) => s],
    ['upload', index(usable.map(([u, key]) => [u.name.trim(), key])), (s) => s.trim()],
    ['upload', index(usable.map(([u, key]) => [baseName(u.fileName), key])), (s) => s],
    ['upload', index(usable.map(([u, key]) => [baseName(u.fileName).trim(), key])), (s) => s.trim()],
    ['project', index(projectPairs), (s) => s],
    ['project', index(projectPairs.map(([name, key]) => [name.trim(), key])), (s) => s.trim()],
    ['library', index(libraryPairs), (s) => s],
    ['library', index(libraryPairs.map(([name, key]) => [name.trim(), key])), (s) => s.trim()],
  ];
  const similar = index([
    ...usable.flatMap(([u, key]) => [
      [loose(u.name), key],
      [loose(baseName(u.fileName)), key],
    ]),
    ...projectPairs.map(([name, key]) => [loose(name), key]),
    ...libraryPairs.map(([name, key]) => [loose(name), key]),
  ]);

  /**
   * The automatic source of a name: { found, key, result } or { found: 'missing' }, with the problem of
   * the file's own airfoil (`fileProblem`) and the first other candidate that failed the check
   * (`candidate`: { key, problem }), for the report.
   */
  const resolve = (name) => {
    if (name === '') return { found: 'missing', fileProblem: null, candidate: null };
    let fileProblem = null;
    if (foils?.has(name)) {
      const r = load(`file:${name}`);
      if (r.ok) return { found: 'file', key: `file:${name}`, result: r, fileProblem, candidate: null };
      fileProblem = r.problem;
    }
    // The first candidate that passes the check wins.
    const code = parseNacaCode(name)?.code;
    const candidates = [...stages.map(([found, map, norm]) => [found, map.get(norm(name))]), ['naca', code ? [`naca:${code}`] : []], ['loose', similar.get(loose(name))]];
    let candidate = null;
    for (const [found, keys] of candidates) {
      for (const key of keys ?? []) {
        const r = load(key);
        if (r.ok) return { found, key, result: r, fileProblem, candidate: null };
        candidate ??= { key, problem: r.problem };
      }
    }
    return { found: 'missing', fileProblem, candidate };
  };

  return { options, load, resolve, labelOf };
}

/**
 * The airfoil checks of the first mapping (and of a plane or surface chosen later), one step per
 * distinct airfoil name of the surface: a step resolves one name as mapXflr5 does, which checks its
 * candidates (the file's airfoil, the uploads, current-project and library airfoils, a NACA section)
 * and keeps the results in the caches. The
 * dialog runs the steps in slices, so that the page answers meanwhile; mapXflr5 then finds every
 * check in the caches. Nothing is checked for a wing beyond the limits of a project, as in mapXflr5.
 * Yields { done, total }: names checked, and names of the surface.
 */
export function* checkSteps(file, { plane: planeIndex = 0, surface, fileName = '', project = null, library = [], uploads = [] } = {}) {
  const plane = file.planes[planeIndex];
  if (!plane) return;
  const key = surface ?? defaultSurface(file, planeIndex);
  const wing = oneSidedAsHalf(planeSurfaces(file, planeIndex).surfaces.find((s) => s.key === key && s.available)?.wing);
  if (!wing) return;
  const names = [...new Set(wing.sections.map((s) => s.rightFoil))];
  if (names.length > LIMITS.maxAirfoils || fileAirfoilPoints(file, names, {}) > LIMITS.maxAirfoilPoints) return;
  const sources = airfoilSources(file, plane, fileName, { project, library, uploads });
  for (let i = 0; i < names.length; i++) {
    sources.resolve(names[i]);
    yield { done: i + 1, total: names.length };
  }
}

/** The option of a NACA designation. */
function nacaOption(code) {
  return { key: `naca:${code}`, kind: 'naca', name: `NACA ${code}`, label: tr('NACA generator: {name}', { name: `NACA ${code}` }) };
}

/**
 * The NACA option offered first for an airfoil name: its NACA designation, or one that starts the
 * name ("NACA0014_Flap", XFLR5's flapped copy of NACA 0014). Only the first is found automatically.
 */
function nacaChoice(name) {
  const code = parseNacaCode(name)?.code ?? leadingNacaCode(name);
  return code ? nacaOption(code) : null;
}

/** Labels of the automatic sources, for the dialog's airfoil table. */
function foundLabel(found) {
  switch (found) {
    case 'file':
      return tr('From the file');
    case 'upload':
      return tr('Uploaded file');
    case 'project':
      return tr('Current project');
    case 'library':
      return tr('Library');
    case 'naca':
      return tr('NACA equations');
    case 'loose':
      return tr('Similar name');
    default:
      return tr('Missing');
  }
}

/** Report lines on the flaps of an airfoil from an .xfl project: it is imported undeflected. */
function flapNotes(name, foil, add, program) {
  const { te, le } = foil.flaps;
  const params = (f) => ({ name: shownName(name), angle: num(f.angle), hinge: num(f.hingeX) });
  // flow5 7.50 and later store the shape itself and deflect flaps in the analyses only.
  if (program === 'flow5') {
    if (te.on) add('info', tr('Airfoil "{name}" has a trailing-edge flap in flow5 (hinge at {hinge} % chord); flow5 deflects it in its analyses only, and the stored shape is imported.', params(te)));
    if (le.on) add('info', tr('Airfoil "{name}" has a leading-edge flap in flow5 (hinge at {hinge} % chord); flow5 deflects it in its analyses only, and the stored shape is imported.', params(le)));
    return;
  }
  if (te.on) {
    if (te.angle === 0) add('info', tr('Airfoil "{name}" has a trailing-edge flap at 0° in {program} (hinge at {hinge} % chord); control surfaces are not cut.', { program, ...params(te) }));
    else add('warning', tr('Airfoil "{name}" has a {angle}° trailing-edge flap in {program} (hinge at {hinge} % chord); it is imported undeflected.', { program, ...params(te) }));
  }
  if (le.on) {
    if (le.angle === 0) add('info', tr('Airfoil "{name}" has a leading-edge flap at 0° in {program} (hinge at {hinge} % chord); control surfaces are not cut.', { program, ...params(le) }));
    else add('warning', tr('Airfoil "{name}" has a {angle}° leading-edge flap in {program} (hinge at {hinge} % chord); it is imported undeflected.', { program, ...params(le) }));
  }
}

/** Default project name: plane and wing name, or the wing name of a wing file. */
function projectName(plane, wing) {
  const parts = [plane.name, wing.name].map((s) => s.trim()).filter((s) => s !== '');
  const name = parts.length ? parts.join(' ') : tr('Imported wing');
  return name.slice(0, LIMITS.maxName);
}

/**
 * Map one surface of one plane of an XFLR5 file to a Wingdesigner project, with the airfoil table
 * and the report of the import dialog.
 * @param {object} file XflrFile of readXfl / readXflr5Xml
 * @param {object} [options]
 * @param {number} [options.plane] plane index
 * @param {'main'|'stab'} [options.surface] default: defaultSurface()
 * @param {string} [options.fileName] name of the XFLR5 file (airfoil sources, summary)
 * @param {string} [options.name] project name; empty or missing: the default name
 * @param {object|null} [options.project] the current project, whose airfoils are offered
 * @param {object[]} [options.library] bundled library entries ({ id, name, file, source, text })
 * @param {object[]} [options.uploads] readAirfoilUpload() results, in upload order; one with `refused` (a
 *   file refused before parsing) has a `problem` that names the file
 * @param {Object<string, string>} [options.choices] option key picked per XFLR5 airfoil name
 * @returns {object} { plane, surface, wing, surfaces, others, rows, options, missing, report, errors, name, project, summary }:
 *   rows: one per airfoil name of the surface, in section order: { name, label, sections (1-based), found, foundLabel,
 *   auto, key, picked, ok, airfoil, issues, problem, frame, naca }; frame: where the own coordinates of the airfoil in
 *   use put its sections (an .xfl airfoil, an upload, a generated NACA section or a current-project section
 *   generated from the NACA equations; NO_FRAME for other current-project airfoils, library airfoils and while the row
 *   has no usable airfoil); naca: the NACA option of the name, which the dialog offers first;
 *   options: the shared select list of every row (file airfoils, uploads, current-project airfoils, library entries,
 *   NACA presets); report: [{ severity: 'error'|'warning'|'info', text, reader? }], errors first, including the
 *   reader's warnings (reader: true for those of the XML reader, which may concern another plane); project: null
 *   while the report has an error; summary: the line for the toast.
 */
export function mapXflr5(file, { plane: planeIndex = 0, surface, fileName = '', name, project = null, library = [], uploads = [], choices = {} } = {}) {
  const plane = file.planes[planeIndex];
  const program = programOf(file);
  const { surfaces, others } = planeSurfaces(file, planeIndex);
  const key = surface ?? defaultSurface(file, planeIndex);
  const chosen = surfaces.find((s) => s.key === key);
  // A plane without wings (a flow5 plane built from a triangle mesh) has no surface to choose.
  if (!chosen && surfaces.length) throw new RangeError(`unknown surface ${key}`);
  const wing = chosen?.available ? oneSidedAsHalf(chosen.wing) : null;
  // The XML reader's warnings concern the whole file (another plane, too): marked for the caller. The
  // .xfl reader's warnings concern the airfoils, which this wing uses as well.
  const report = file.warnings.map((text) => (file.kind === 'xml' ? { severity: 'warning', text, reader: true } : { severity: 'warning', text }));
  const add = (severity, text) => report.push({ severity, text });
  const sources = airfoilSources(file, plane, fileName, { project, library, uploads });
  const result = { plane: planeIndex, surface: key, wing, surfaces, others, rows: [], options: sources.options, missing: 0, report, errors: 0, name: '', project: null, summary: '' };

  if (!wing) add('error', chosen ? chosen.reason : tr('Plane "{plane}" has no wing to import.', { plane: plane.name }));
  const geometry = wing ? mapSections(wing, file.lengthUnit, program) : { sections: [], report: [] };
  report.push(...geometry.report);

  // One row per right-side airfoil name, in the order of the sections.
  const byName = new Map();
  (wing?.sections ?? []).forEach((s, i) => {
    if (!byName.has(s.rightFoil)) byName.set(s.rightFoil, []);
    byName.get(s.rightFoil).push(i + 1);
  });
  // The airfoils in use, by option key, for the report: one line per flap of a file airfoil, per
  // airfoil and check warning, per airfoil that moves its sections (see placeAirfoil), per library
  // airfoil whose own coordinates lie far off, and per current-project airfoil of an XFLR5 import or an
  // upload; each names the airfoil in use (and every section that uses it).
  const inUse = new Map();
  // Beyond the limits of a project, no row is resolved or checked: the import cannot go ahead. A name
  // the user gave another airfoil does not count with the file's own.
  const tooMany = byName.size > LIMITS.maxAirfoils || fileAirfoilPoints(file, byName.keys(), choices) > LIMITS.maxAirfoilPoints;
  if (tooMany) add('error', limitsText());
  for (const [foilName, numbers] of byName) {
    if (tooMany) {
      const found = 'missing';
      result.rows.push({ name: foilName, label: shownName(foilName), sections: numbers, found, foundLabel: foundLabel(found), auto: null, key: null, picked: false, ok: false, airfoil: null, issues: [], problem: null, frame: NO_FRAME, naca: null });
      continue;
    }
    const auto = sources.resolve(foilName);
    const picked = Object.hasOwn(choices, foilName) ? choices[foilName] : undefined;
    const pickedResult = typeof picked === 'string' ? sources.load(picked) : null;
    const use = pickedResult ? { key: picked, result: pickedResult } : auto;
    const r = use.result ?? null;
    const row = {
      name: foilName,
      label: shownName(foilName),
      sections: numbers,
      found: auto.found,
      foundLabel: foundLabel(auto.found),
      auto: auto.key ?? null,
      key: use.key ?? null,
      picked: pickedResult !== null,
      ok: r?.ok === true,
      airfoil: r?.airfoil ?? null,
      issues: r?.issues ?? [],
      problem: r?.problem ?? null,
      // The frame of the airfoil in use: the sections are where XFLR5 draws its own coordinates.
      frame: r?.ok && r.frame ? r.frame : NO_FRAME,
      naca: nacaChoice(foilName),
    };
    result.rows.push(row);
    const params = { name: shownName(foilName), sections: sectionsText(numbers) };
    if (!r) {
      if (foilName === '') add('error', tr('{program} names no airfoil at {sections}: upload a .dat file or pick an airfoil.', { program, ...params }));
      else if (auto.fileProblem) add('error', tr('Airfoil "{name}" ({sections}) from the file fails the check: {problem} Upload a .dat file or pick an airfoil.', { ...params, problem: auto.fileProblem }));
      else if (auto.candidate) {
        const { key: candidateKey, problem } = auto.candidate;
        add('error', tr('Airfoil "{name}" ({sections}): the matching airfoil ({source}) fails the check: {problem} Upload a .dat file or pick an airfoil.', { ...params, source: sources.labelOf(candidateKey), problem }));
      } else add('error', tr('Airfoil "{name}" ({sections}) is missing: upload a .dat file or pick an airfoil.', params));
      continue;
    }
    if (!r.ok) {
      add('error', tr('Airfoil "{name}" ({sections}): the chosen airfoil fails the check: {problem}', { ...params, problem: r.problem }));
      continue;
    }
    if (!row.picked && auto.fileProblem) add('warning', tr('Airfoil "{name}" from the file fails the check: {problem} "{match}" is used instead.', { ...params, problem: auto.fileProblem, match: displayName(r.airfoil.name) }));
    if (!row.picked && auto.found === 'loose') add('warning', tr('Airfoil "{name}" matched to "{match}" by a similar name.', { ...params, match: displayName(r.airfoil.name) }));
    const entry = inUse.get(row.key);
    if (entry) entry.sections.push(...numbers);
    else inUse.set(row.key, { shown: r.shown, issues: r.issues, frame: row.frame, ownFrame: r.ownFrame ?? null, unknownFrame: r.unknownFrame === true, foil: r.foil ?? null, sections: [...numbers] });
  }
  // The flaps of each file airfoil in use, once: a picked file airfoil speaks for itself.
  for (const { foil } of inUse.values()) if (foil) flapNotes(foil.name, foil, add, program);
  for (const { shown, issues, frame: fr, ownFrame, unknownFrame, sections } of inUse.values()) {
    sections.sort((a, b) => a - b);
    const at = { name: shown, sections: sectionsText(sections) };
    // The check's warnings, once per airfoil. XFLR5 measures twist from the airfoil's own x axis as
    // well: an inclined chord line is no difference from XFLR5 where XFLR5 drew the same coordinates.
    // A library airfoil has a line of its own below.
    for (const issue of issues) {
      if (issue.severity !== 'warning' || (ownFrame && issue.code === 'rotated')) continue;
      add(issue.code === 'rotated' ? 'info' : 'warning', tr('Airfoil "{name}" ({sections}): {problem}', { ...at, problem: issue.message }));
    }
    // An airfoil that moves its sections, named as the airfoil in use (an airfoil picked for another
    // name, too). A move of more than FRAME_WARN of the chord changes the wing noticeably from the
    // file's numbers.
    if (noted(fr)) add(far(fr) ? 'warning' : 'info', frameText(fr, sections.length === 1, at, program));
    // A library airfoil keeps XFLR5's table values; if XFLR5 used its coordinates, it drew these
    // sections elsewhere. The same holds for a current-project airfoil taken from the Library.
    if (ownFrame && far(ownFrame)) {
      add(
        'info',
        tr(
          'Library airfoil "{name}" ({sections}) has its leading edge at x\u00a0=\u00a0{x}\u00a0%, y\u00a0=\u00a0{y}\u00a0% of chord in its own coordinates. If {program} used these coordinates, it draws these sections that far from the table values; upload the .dat file that {program} used to place them as in {program}.',
          { program, ...at, x: pct(ownFrame.x), y: pct(ownFrame.y) },
        ),
      );
    }
    // A library airfoil with an inclined chord line (Clark Y: 2.00° nose up) keeps that angle, as
    // twist refers to its x axis. XFLR5 files often hold a level copy (the UIUC "CLARK Y AIRFOIL"):
    // XFLR5 then draws these sections turned against the built ones, by the angle about the leading
    // edge, the trailing edge chord · sin(angle) away. A chord that is no positive number has its own
    // error.
    const chords = sections.map((i) => wing.sections[i - 1].chord * file.lengthUnit).filter((c) => c > 0 && c < Infinity);
    if (ownFrame && Math.abs(ownFrame.incline) > CHECK_LIMITS.rotationDeg && chords.length) {
      const chord = Math.max(...chords);
      const angle = Math.abs(ownFrame.incline);
      const params = { ...at, angle: fixed(angle, 2), distance: fixed(chord * Math.sin((angle * Math.PI) / 180), 1), chord: num(chord) };
      add(
        'warning',
        ownFrame.incline < 0
          ? tr('Library airfoil "{name}" ({sections}) has its chord line inclined {angle}° nose up in its own coordinates, and the built sections keep this angle. If the airfoil that {program} used has a level chord line, these sections sit {angle}° more nose up than in {program}, the trailing edge {distance} mm lower at {chord} mm chord; upload the .dat file that {program} used to place them as in {program}.', { program, ...params })
          : tr('Library airfoil "{name}" ({sections}) has its chord line inclined {angle}° nose down in its own coordinates, and the built sections keep this angle. If the airfoil that {program} used has a level chord line, these sections sit {angle}° more nose down than in {program}, the trailing edge {distance} mm higher at {chord} mm chord; upload the .dat file that {program} used to place them as in {program}.', { program, ...params }),
      );
    }
    // A current-project airfoil of an XFLR5 import or an upload keeps the table values as well: its
    // own coordinates, which XFLR5 drew, were not stored.
    if (unknownFrame) {
      add(
        'info',
        tr(
          'Airfoil "{name}" ({sections}) of the current project is stored scaled to unit chord, with its leading edge at (0, 0), so these sections keep the table values. If the coordinates that {program} used put the leading edge elsewhere, {program} draws these sections that far from the table values; upload the .dat file that {program} used to place them as in {program}.',
          { program, ...at },
        ),
      );
    }
  }
  result.missing = result.rows.filter((row) => !row.ok).length;
  // An unusable upload that a row uses has that row's error; any other is only noted. A file refused
  // before parsing (`refused`: too large, unreadable, an XFLR5 file) has a problem that names it.
  const pickedKeys = new Set(result.rows.filter((row) => row.picked).map((row) => row.key));
  uploads.forEach((u, i) => {
    if (u.ok || pickedKeys.has(`upload:${i}`)) return;
    add('info', u.refused ? u.problem : tr('The uploaded file {file} is not usable: {problem}', { file: displayName(u.fileName), problem: u.problem }));
  });

  if (wing && program === 'flow5') {
    const items = surfaces.filter((s) => s.key !== key).map((s) => tr('{label} "{name}"', { label: s.label, name: shownName(s.name) }));
    if (items.length) add('info', tr('Not imported: {list}. One surface per import; open the file again for another one.', { list: items.join(', ') }));
  } else if (wing) {
    const items = [];
    if (key === 'main' && surfaces[1].available) items.push(tr('the horizontal stabilizer "{name}"', { name: shownName(surfaces[1].name) }));
    if (key === 'stab' && surfaces[0].available) items.push(tr('the main wing "{name}"', { name: shownName(surfaces[0].name) }));
    for (const o of others) items.push(o.slot === 1 ? tr('the second wing "{name}"', { name: shownName(o.name) }) : tr('the fin "{name}"', { name: shownName(o.name) }));
    if (items.length) add('info', tr('Not imported: {list}. One surface per import; open the file again for another one.', { list: items.join(', ') }));
  }
  if (file.kind === 'xml') {
    if (file.unitName === null) add('info', tr('Lengths converted to mm from a file unit of {factor} mm.', { factor: num(file.lengthUnit) }));
    else if (file.unitName !== 'mm') add('info', tr('Lengths converted from {unit} to mm.', { unit: unitWord(file.unitName) }));
    if (file.unitName === 'm') {
      add('info', program === 'flow5' ? tr('flow5 rounds lengths in metre XML files to 1 mm; the .fl5 project file keeps full precision.') : tr('XFLR5 rounds lengths in metre XML files to 1 mm; the .xfl project file keeps full precision.'));
    }
    if (file.wingOnly) {
      add('info', program === 'flow5' ? tr('A wing file holds no position or angles: the part is built in its own frame.') : tr('A wing file holds no position or tilt angle: the part is built in its own frame.'));
    }
  }
  if (wing?.oneSided) {
    add('info', tr('A one-sided wing: flow5 builds its left half only, with the left-side airfoils. The part\'s left half is that half, its right half the mirror image (on top of it for a fin at y = 0); Settings > Show mirrored half and Export > Wing halves > Right half only give one half.'));
  }
  add('info', tr('Not used: VLM panel counts and distributions, colours, masses, the body and the analyses.'));
  add('info', tr('The trailing edge is built as in the airfoils; Settings > Trailing edge can close it or give it a thickness.'));

  if (wing) {
    result.name = typeof name === 'string' && name.trim() !== '' ? name.slice(0, LIMITS.maxName) : projectName(plane, wing);
    if (!report.some((r) => r.severity === 'error')) {
      const candidate = withPlanes(result.name, geometry, result.rows, add, program);
      if (candidate) {
        const v = validateProject(candidate);
        for (const e of v.errors) add('error', e);
        if (v.ok) result.project = candidate;
      }
    }
  }
  report.sort(bySeverity);
  result.errors = report.filter((r) => r.severity === 'error').length;
  if (result.project) result.summary = summary(result, plane, fileName);
  return result;
}

/** Points of the file's own airfoils for the names of a wing that the user has not given another airfoil. */
function fileAirfoilPoints(file, names, choices) {
  let points = 0;
  if ((file.kind !== 'xfl' && file.kind !== 'fl5') || !file.foils) return points;
  for (const foilName of names) if (!Object.hasOwn(choices, foilName)) points += file.foils.get(foilName)?.points.length ?? 0;
  return points;
}

/** True when a frame lies more than FRAME_WARN of the chord from the origin and the unit chord. */
const far = (fr) => Math.abs(fr.chord - 1) > FRAME_WARN || Math.abs(fr.x) > FRAME_WARN || Math.abs(fr.y) > FRAME_WARN;

/**
 * The report line of an airfoil that moves its sections (`at`: name and sections), for one section or
 * several, and with or without a change of chord that its figures show.
 */
function frameText(fr, one, at, program) {
  const params = { ...at, x: pct(fr.x), y: pct(fr.y), te: pct(fr.x + fr.chord) };
  // The line says "scaled" when its figures show a chord other than 100 %: a scale that rounds away
  // (the 0.0016 % of the Clark Y, 0.004 mm at 240 mm chord) applies without a word.
  const shown = (v) => Number((v * 100).toFixed(2));
  if (Math.abs(shown(fr.x + fr.chord) - shown(fr.x) - 100) < 0.005) {
    return one
      ? tr('Airfoil "{name}" ({sections}) has its leading edge at x\u00a0=\u00a0{x}\u00a0%, y\u00a0=\u00a0{y}\u00a0% and its trailing edge at x\u00a0=\u00a0{te}\u00a0% of chord in its own coordinates; this section was moved so that the airfoil lies as in {program}.', { program, ...params })
      : tr('Airfoil "{name}" ({sections}) has its leading edge at x\u00a0=\u00a0{x}\u00a0%, y\u00a0=\u00a0{y}\u00a0% and its trailing edge at x\u00a0=\u00a0{te}\u00a0% of chord in its own coordinates; these sections were moved so that the airfoil lies as in {program}.', { program, ...params });
  }
  return one
    ? tr('Airfoil "{name}" ({sections}) has its leading edge at x\u00a0=\u00a0{x}\u00a0%, y\u00a0=\u00a0{y}\u00a0% and its trailing edge at x\u00a0=\u00a0{te}\u00a0% of chord in its own coordinates; this section was moved and scaled so that the airfoil lies as in {program}.', { program, ...params })
    : tr('Airfoil "{name}" ({sections}) has its leading edge at x\u00a0=\u00a0{x}\u00a0%, y\u00a0=\u00a0{y}\u00a0% and its trailing edge at x\u00a0=\u00a0{te}\u00a0% of chord in its own coordinates; these sections were moved and scaled so that the airfoil lies as in {program}.', { program, ...params });
}

/**
 * A mapped section moved and scaled so that its airfoil sits where XFLR5 draws the airfoil's own
 * coordinates. XFLR5 takes the coordinates as they are, in chords from the section's leading edge;
 * Wingdesigner puts the airfoil's leading edge at the section point and its trailing edge at one
 * chord. With the airfoil's leading edge at (lx, ly) and a chord cT up to its trailing edge, a twist
 * t about the quarter chord and a thickness stretch m gives, for every airfoil point, exactly XFLR5's
 * placement (in the plane of the section: x, and the up direction (0, −sin φ, cos φ) of its roll φ):
 *   chord' = cT·chord,  (x, up)' = (x, 0) + chord·[(0.25·(1 − cT), 0) + R(t)·(lx − 0.25·(1 − cT), m·ly)]
 * with R(t)·(u, w) = (u cos t + w sin t, −u sin t + w cos t), the rotation of placeSection.
 */
function placeAirfoil(s, frame, roll = 0, stretch = 1) {
  const { x, y, z, chord, twist } = s;
  if (!moves(frame)) return { x, y, z, chord, twist };
  const a = twist * DEG;
  const shift = 0.25 * (1 - frame.chord);
  const u = frame.x - shift;
  const w = stretch * frame.y;
  const up = chord * (-u * Math.sin(a) + w * Math.cos(a));
  return {
    x: zero(x + chord * (shift + u * Math.cos(a) + w * Math.sin(a))),
    y: roll ? zero(y - up * Math.sin(roll * DEG)) : y,
    z: zero(z + up * Math.cos(roll * DEG)),
    chord: Math.max(chord * frame.chord, LIMITS.minChord),
    twist,
  };
}

/** The error of airfoils beyond the limits of a project. */
function limitsText() {
  return tr('The airfoils of this wing exceed the limits of a project ({airfoils} airfoils, {points} points together).', { airfoils: count(LIMITS.maxAirfoils), points: count(LIMITS.maxAirfoilPoints) });
}

/**
 * The project of mapped sections and resolved rows, or null (reported) when the airfoils or the moved
 * sections exceed the limits. `planes`: the section-plane setting, and for mitred planes the roll
 * and stretch of every mapped section (sectionPlanes); `tilt`: the tilt angle of mapSections, the
 * rigid placement of the part.
 */
function assemble(name, mapped, rows, add, planes, tilt) {
  const airfoils = [];
  const ids = new Map();
  // Rows that use the same source share its airfoil; sources with the same name and points share one
  // too, as addAirfoil merges them. Built here in linear time: addAirfoil scans the whole list for
  // every airfoil, and a wing can name 10,000 of them.
  const byKey = new Map();
  const byShape = new Map();
  const taken = new Set();
  let points = 0;
  for (const row of rows) {
    let id = byKey.get(row.key);
    if (id === undefined) {
      const a = row.airfoil;
      const shape = `${a.name}\n${a.points.join(';')}`;
      id = byShape.get(shape);
      if (id === undefined) {
        if (airfoils.length >= LIMITS.maxAirfoils || points + a.points.length > LIMITS.maxAirfoilPoints) {
          add('error', limitsText());
          return null;
        }
        const base = slug(a.name) || 'airfoil';
        id = base;
        for (let k = 2; taken.has(id); k++) id = `${base}-${k}`;
        taken.add(id);
        points += a.points.length;
        airfoils.push({ ...a, id });
        byShape.set(shape, id);
      }
      byKey.set(row.key, id);
    }
    ids.set(row.name, id);
  }
  const frames = new Map(rows.map((row) => [row.name, row.frame]));
  // An airfoil frame moves a section in its own plane: in a mitred plane along the rolled up
  // direction, with the thickness stretch. The rolls are XFLR5's (from the file's dihedrals).
  const mitred = planes.mode === 'mitred';
  const placed = mapped.map((s, i) => ({ index: s.index, foil: s.foil, ...placeAirfoil(s, frames.get(s.foil), mitred ? planes.rolls[i] : 0, mitred ? planes.stretches[i] : 1) }));
  if (!withinLimits(placed, add)) return null;
  // The project holds 4 decimals (1e-4 mm and degrees, far below the differences from XFLR5's
  // construction): the unit conversion leaves noise such as a chord of 400.04999999999995 mm.
  const r4 = (v) => zero(Number(v.toFixed(4)));
  const sections = placed.map((s, i) => ({ id: `s${i + 1}`, airfoil: ids.get(s.foil), x: r4(s.x), y: r4(s.y), z: r4(s.z), chord: Math.max(r4(s.chord), LIMITS.minChord), twist: r4(s.twist) }));
  // Frames that move the two sections of a panel differently turn it: the build would take other
  // planes and stretches from the moved sections. Such a panel stores XFLR5's dihedral (panelAngle).
  if (mitred) {
    panelDihedrals(sections).forEach((d, i) => {
      const xflr5 = planes.dihedrals[i];
      if (sections[i + 1].y - sections[i].y >= SHORT_PANEL && Math.abs(xflr5 - d) > PANEL_ANGLE_TOLERANCE) {
        sections[i].panelAngle = Math.min(Math.max(r4(xflr5), -LIMITS.maxPanelAngle), LIMITS.maxPanelAngle);
      }
    });
  }
  return createProject({
    name,
    airfoils,
    sections,
    settings: {
      twistPivot: 0.25,
      spanwise: 'straight',
      sectionPlanes: planes.mode,
      mirror: true,
      tip: { mode: 'flat' },
      trailingEdge: { mode: 'asis' },
      ...(tilt ? { partTilt: r4(tilt.angle), partRoll: r4(tilt.roll), partPivot: { x: r4(tilt.x), y: 0, z: r4(tilt.z) }, leftHalf: tilt.turnedLeft ? 'turned' : 'mirror' } : {}),
    },
  });
}

/**
 * The project of an import and the report lines on its section planes (see the header): mitred
 * unless the part is tilted or its mitred planes do not build. Null when assemble reports an error.
 */
function withPlanes(name, geometry, rows, add, program) {
  const mapped = geometry.sections;
  const rolled = geometry.rolls.some((r) => r !== 0);
  const vertical = (why) => {
    if (why) add('info', why);
    for (const line of geometry.steep) add(line.severity, line.text);
    return assemble(name, mapped, rows, add, { mode: 'vertical' }, geometry.tilt);
  };
  // The mapped sections lie in the frame of the part (the position only moves them); the tilt turns
  // the built part.
  const candidate = assemble(name, mapped, rows, add, { mode: 'mitred', ...sectionPlanes(mapped, 'mitred') }, geometry.tilt);
  if (!candidate) return candidate;
  // Sections that the airfoil frames move past each other in y cross, as a fold does. The build takes
  // the rolls from the moved sections, so a flat part can roll a little and is checked as well.
  const ys = candidate.sections.map((q) => q.y);
  const swapped = ys.findIndex((y, i) => i > 0 && !(y > ys[i - 1]));
  const problem = swapped > 0 ? { kind: 'fold', i: swapped - 1 } : mitredPlaneProblem(candidate);
  if (!problem) {
    if (rolled) add('info', tr('Section planes: mitred, as in {program}. The root section is vertical, a section between two panels lies in the bisector plane of the panels, and the tip section is square to the last panel; the airfoils keep their thickness across the panels.', { program }));
    return candidate;
  }
  const at = (i) => plain(mapped[i].index + 1);
  return vertical(
    problem.kind === 'fold'
      ? tr('Section planes: vertical. Mitred planes, as in {program}, would fold the surface between sections {a} and {b}.', { program, a: at(problem.i), b: at(problem.i + 1) })
      : tr('Section planes: vertical. The mitred plane of section {n}, as in {program}, would lie {angle}° from its panel, beyond the limit of 60°.', { program, n: at(problem.i), angle: fixed(problem.angle, 1) }),
  );
}

/** The toast line after the import. */
function summary(result, plane, fileName) {
  const n = result.project.airfoils.length;
  const params = {
    wing: shownName(result.wing.name),
    plane: displayName(plane.name),
    file: displayName(fileName),
    sections: count(result.project.sections.length),
    airfoils: n === 1 ? tr('1 airfoil') : tr('{n} airfoils', { n: count(n) }),
  };
  if (result.surface !== 'main' && result.surface !== 'stab') {
    return plane.name.trim() === '' ? tr('Imported the wing "{wing}" from {file}: {sections} sections, {airfoils}.', params) : tr('Imported the wing "{wing}" of "{plane}" from {file}: {sections} sections, {airfoils}.', params);
  }
  if (plane.name.trim() === '') {
    return result.surface === 'main'
      ? tr('Imported the main wing "{wing}" from {file}: {sections} sections, {airfoils}.', params)
      : tr('Imported the horizontal stabilizer "{wing}" from {file}: {sections} sections, {airfoils}.', params);
  }
  return result.surface === 'main'
    ? tr('Imported the main wing "{wing}" of "{plane}" from {file}: {sections} sections, {airfoils}.', params)
    : tr('Imported the horizontal stabilizer "{wing}" of "{plane}" from {file}: {sections} sections, {airfoils}.', params);
}

/**
 * Report lines of a buildWing() result of the candidate project: they do not block the import
 * (a project that opens with build errors shows them in Checks as well).
 */
export function buildNotes(build) {
  return [...build.errors.map((error) => ({ severity: 'warning', text: tr('The wing does not build yet: {error}', { error }) })), ...build.warnings.map((text) => ({ severity: 'warning', text }))];
}
