import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { setLanguage } from '../src/i18n/index.js';
import { readXflBytes } from '../src/import/xfl.js';
import { readXflr5Xml } from '../src/import/xflxml.js';
import {
  FRAME_TOLERANCE,
  FRAME_WARN,
  MIN_PANEL,
  NUDGE,
  buildNotes,
  checkSteps,
  defaultSurface,
  describeFile,
  mapSections,
  mapXflr5,
  planeSurfaces,
  readAirfoilUpload,
  refusedUpload,
} from '../src/import/xflr5.js';
import { bundledLibrary } from '../src/airfoil/bundled.js';
import { nacaEntry } from '../src/airfoil/library.js';
import { nacaAirfoil } from '../src/airfoil/naca.js';
import { toSeligDat } from '../src/airfoil/parse.js';
import { LIMITS, SOURCE_KEYS, validateProject } from '../src/model/project.js';
import { projectFromJsonText, projectToJsonText } from '../src/model/io.js';
import { buildWing, placeSection } from '../src/geom/wing.js';
import { fitProfile } from '../src/geom/profile.js';
import { checkAirfoil } from '../src/airfoil/sanity.js';
import { surfacePoint } from '../src/geom/nurbs.js';
import { defaultProject } from '../src/model/defaults.js';
import { sampleProject } from './helpers.js';

const DEG = Math.PI / 180;
const xfl = (name) => readXflBytes(readFileSync(new URL(`fixtures/xflr5/${name}`, import.meta.url)));
const xml = (name) => readXflr5Xml(readFileSync(new URL(`fixtures/xflr5/${name}`, import.meta.url), 'utf8'));
const FIXTURES = xfl('fixtures_v662.xfl');
const LIBRARY = bundledLibrary();

/** An XFLR5 wing section (file units). */
const sec = (y, chord, offset = 0, dihedral = 0, twist = 0, foil = 'NACA 0009', left = foil) => ({ rightFoil: foil, leftFoil: left, chord, y, offset, dihedral, twist });

/** An XFLR5 wing. */
const wingOf = (sections, { name = 'Wing', tilt = 0, position = { x: 0, y: 0, z: 0 } } = {}) => ({ name, description: '', symmetric: true, position, tilt, sections });

/** An XFLR5 airfoil of an .xfl project. */
const foilOf = (name, points, { te = {}, le = {} } = {}) => ({
  name,
  points,
  flaps: { le: { on: false, angle: 0, hingeX: 20, hingeY: 50, ...le }, te: { on: false, angle: 0, hingeX: 70, hingeY: 50, ...te } },
});

/** An XflrFile of an XML plane file in mm (or `lengthUnit`), wings in slots 0..3. */
function xmlFile(wings, { lengthUnit = 1, unitName = 'mm', wingOnly = false, planeName = 'Plane', warnings = [] } = {}) {
  return { kind: 'xml', format: null, version: '1.0', lengthUnit, unitName, wingOnly, planes: [{ name: wingOnly ? '' : planeName, description: '', wings }], foils: null, foilError: null, warnings };
}

/** An XflrFile of an .xfl project (metres) with the given airfoils. */
function xflFile(wings, foils = [], { planeName = 'Plane', format = 200002 } = {}) {
  return { kind: 'xfl', format, version: null, lengthUnit: 1000, unitName: 'm', wingOnly: false, planes: [{ name: planeName, description: '', wings }], foils: new Map(foils.map((f) => [f.name, f])), foilError: null, warnings: [] };
}

/** A two-section wing in mm with airfoil `foil`, as the main wing of an XML plane file. */
const simple = (foil = 'NACA 0009', opts = {}) => xmlFile([wingOf([sec(0, 200, 0, 0, 0, foil), sec(500, 120, 30, 0, 0, foil)], opts), null, null, null]);

const texts = (report, severity) => report.filter((r) => !severity || r.severity === severity).map((r) => r.text);
/** A text with the no-break spaces of its figures, as the report writes them: "x = 3 %" (U+00A0 around "=" and before "%"). */
const nb = (text) => text.replace(/\b([xy]) = (-?\d+(?:\.\d+)?)( %)?/g, (m, v, n, p) => `${v}\u00a0=\u00a0${n}${p ? '\u00a0%' : ''}`);
const values = (s) => [s.x, s.y, s.z, s.chord, s.twist];
/** A value as the project holds it: 4 decimals. */
const round4 = (v) => Number(v.toFixed(4)) + 0;

/** Expect sections to have [x, y, z, chord, twist] within 4 decimals. */
function expectSections(sections, rows, digits = 4) {
  expect(sections).toHaveLength(rows.length);
  sections.forEach((s, i) => values(s).forEach((v, k) => expect(v, `section ${i + 1} value ${k}`).toBeCloseTo(rows[i][k], digits)));
}

/** A wing without tilt and position. */
const unplaced = (wing) => ({ ...wing, tilt: 0, position: { x: 0, y: 0, z: 0 } });

afterEach(() => setLanguage('en'));

describe('XFLR5 mapping: geometry', () => {
  it('maps the main wing of fixture A: y along the panels, absolute dihedral, twist', () => {
    const w = FIXTURES.planes[0].wings[0];
    const { sections, report } = mapSections(unplaced(w), 1000);
    expectSections(sections, [
      [0, 0, 0, 240, 0],
      [10, 499.3148, 26.168, 220, -1],
      [45, 897.1235, 67.9794, 150, -2.5],
    ]);
    // Exact: y and z from the panel lengths 500 and 400 mm and the dihedrals 3 and 6 degrees.
    expect(sections[1].y).toBe(500 * Math.cos(3 * DEG));
    expect(sections[2].z).toBe(500 * Math.sin(3 * DEG) + 400 * Math.sin(6 * DEG));
    expect(sections.map((s) => s.foil)).toEqual(['Clark Y', 'Clark Y', 'NACA 0009']);
    expect(texts(report)).toEqual(['XFLR5 measures y_position along the panels; y and z were computed from it and the dihedral.']);
  });

  it('folds the tilt and the position into the sections', () => {
    const main = mapSections(FIXTURES.planes[0].wings[0], 1000);
    expectSections(main.sections, [
      [-0.0366, 0, -2.094, 240, 2],
      [10.8737, 499.3148, 23.8836, 220, 1],
      [47.3222, 897.1235, 65.0587, 150, -0.5],
    ]);
    expect(texts(main.report, 'info')).toContain('Tilt angle 2° applied as in the XFLR5 plane: the sections are rotated about the wing origin, and every twist includes it.');
    const stab = mapSections(FIXTURES.planes[0].wings[2], 1000);
    expectSections(stab.sections, [
      [649.9906, 0, 40.7199, 110, -1.5],
      [674.9854, 230, 41.1125, 70, -1.5],
    ]);
    expect(texts(stab.report, 'info')).toEqual([
      'Tilt angle -1.5° applied as in the XFLR5 plane: the sections are rotated about the wing origin, and every twist includes it.',
      'Position in the XFLR5 plane applied: the wing origin moved to x 650 mm, z 40 mm.',
    ]);
    expectSections(mapSections(unplaced(FIXTURES.planes[0].wings[2]), 1000).sections, [
      [0, 0, 0, 110, 0],
      [25, 230, 0, 70, 0],
    ]);
  });

  it('maps a three-section wing with 2° and 6° dihedral (y 599.6345 / 997.4433, z 20.9397 / 62.7511), and folds a 2.5° tilt at (150, 0, 20) mm into it', () => {
    const sections = [sec(0, 0.25, 0, 2, 0), sec(0.6, 0.22, 0.01, 6, -1), sec(1, 0.15, 0.04, 0, -3)];
    expectSections(mapSections(wingOf(sections), 1000).sections, [
      [0, 0, 0, 250, 0],
      [10, 599.6345, 20.9397, 220, -1],
      [40, 997.4433, 62.7511, 150, -3],
    ]);
    // Tilt 2.5 degrees, position (0.150, 0, 0.020) m.
    expectSections(mapSections(wingOf(sections, { tilt: 2.5, position: { x: 0.15, y: 0, z: 0.02 } }), 1000).sections, [
      [149.9405, 0, 17.2738, 250, 2.5],
      [160.8515, 599.6345, 38.0845, 220, 1.5],
      [192.6634, 997.4433, 79.3109, 150, -0.5],
    ]);
  });

  it('keeps the root gap of an elevator whose root lies at y = 20 mm, and reports it', () => {
    const w = wingOf([sec(20, 110), sec(300, 70, 25)], { tilt: -1.5, position: { x: 750, y: 0, z: 15 } });
    const { sections, report } = mapSections(w, 1);
    expectSections(sections, [
      [749.9906, 20, 15.7199, 110, -1.5],
      [774.9854, 300, 16.1125, 70, -1.5],
    ]);
    expect(texts(report, 'info')).toContain('The root lies at y = 20 mm: the two halves are built as separate bodies, as in XFLR5.');
  });

  it('ignores the dihedral of the last section', () => {
    const b = FIXTURES.planes[1].wings[0];
    expect(b.sections.at(-1).dihedral).toBe(30);
    const tip = mapSections(unplaced(b), 1000).sections.at(-1);
    expect(tip.y).toBeCloseTo(250 + 350 * Math.cos(2 * DEG) + 150 * Math.cos(2 * DEG), 9);
    const flat = { ...unplaced(b), sections: b.sections.map((s, i) => (i === 3 ? { ...s, dihedral: 0 } : s)) };
    expect(mapSections(flat, 1000).sections).toEqual(mapSections(unplaced(b), 1000).sections);
    // Rascal 110: its elevator's only dihedral (5 degrees) sits on the last section.
    const rascal = xfl('uaslab/Rascal110.xfl').planes[0].wings[2];
    expect(mapSections(unplaced(rascal), 1000).sections.every((s) => s.z === 0)).toBe(true);
  });

  it('warns about large dihedral and refuses panels that do not step outwards', () => {
    const vtail = mapSections(wingOf([sec(0, 120, 0, 35), sec(320, 70, 40)]), 1);
    expectSections(vtail.sections, [
      [0, 0, 0, 120, 0],
      [40, 262.1287, 183.5445, 70, 0],
    ]);
    expect(texts(vtail.report, 'warning')).toEqual(['The panel from section 1 to 2 has 35° dihedral: the vertical sections are 82 % as thick across the panel as in XFLR5.']);
    expect(texts(mapSections(wingOf([sec(0, 120, 0, 10), sec(320, 70)]), 1).report, 'warning')).toEqual([]);
    expect(texts(mapSections(wingOf([sec(0, 120, 0, -12), sec(320, 70)]), 1).report, 'warning')).toHaveLength(1);
    const up = mapSections(wingOf([sec(0, 120, 0, 90), sec(320, 70)]), 1);
    expect(up.sections).toEqual([]);
    expect(texts(up.report, 'error')).toEqual(['The panel from section 1 to 2 has 90° dihedral: its outer end must lie further out in y than its inner end.']);
    // Past 5 panels, one line counts the rest.
    const zigzag = (angle) => wingOf(Array.from({ length: 8 }, (_, i) => sec(i * 100, 100, 0, i < 7 ? angle : 0)));
    const steep = texts(mapSections(zigzag(20), 1).report, 'warning');
    expect(steep).toHaveLength(6);
    expect(steep[4]).toBe('The panel from section 5 to 6 has 20° dihedral: the vertical sections are 94 % as thick across the panel as in XFLR5.');
    expect(steep[5]).toBe('Further panels with more than 10° dihedral: 2.');
    const upright = texts(mapSections(zigzag(-90), 1).report, 'error');
    expect(upright).toHaveLength(6);
    expect(upright[5]).toBe('Further panels whose outer end does not lie further out in y: 2.');
  });

  it('refuses wings with fewer than 2 sections, non-finite values, a decreasing y or a chord <= 0', () => {
    const errors = (w, k = 1) => {
      const r = mapSections(w, k);
      expect(r.sections).toEqual([]);
      return texts(r.report, 'error');
    };
    expect(errors(wingOf([sec(0, 100)]))).toEqual(['The wing needs at least 2 sections (found 1).']);
    expect(errors(wingOf([sec(0, 100), sec(NaN, 80), sec(200, Infinity, 0, 0, NaN)]))).toEqual([
      'y_position is not a finite number in the file at section 2.',
      'Chord is not a finite number in the file at section 3.',
      'Twist is not a finite number in the file at section 3.',
    ]);
    expect(errors(wingOf([sec(0, 100, NaN, NaN), sec(100, 80)]))).toEqual(['xOffset is not a finite number in the file at section 1.', 'Dihedral is not a finite number in the file at section 1.']);
    // One line per value, whatever the number of sections.
    const many = wingOf(Array.from({ length: 30 }, (_, i) => sec(i * 10, i % 2 ? NaN : 100, 0, 0, i % 2 ? 0 : NaN)));
    expect(errors(many)).toEqual([
      'Chord is not a finite number in the file at sections 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, ….',
      'Twist is not a finite number in the file at sections 1, 3, 5, 7, 9, 11, 13, 15, 17, 19, ….',
    ]);
    expect(errors(wingOf([sec(0, 100), sec(100, 80)], { position: { x: NaN, y: 0, z: 0 }, tilt: NaN }))).toEqual([
      'The position of the wing in the plane is not a finite number in the file.',
      'The tilt angle of the wing is not a finite number in the file.',
    ]);
    expect(errors(wingOf([sec(0, 100), sec(200, 80), sec(150, 60)]))).toEqual(['y_position decreases at section 3; the sections must run from root to tip.']);
    expect(errors(wingOf([sec(-5, 100), sec(200, 80)]))).toEqual(['The root section lies at y_position -5 mm; the half wing must start at y >= 0.']);
    expect(errors(wingOf([sec(0, 0), sec(200, -3)]))).toEqual(['The chord must be greater than 0 at sections 1–2.']);
    expect(errors(wingOf([sec(0.1, 100), sec(0.1, 80, 5)]), 1000)).toEqual(['All sections of the wing lie at y = 100 mm: the wing has no span.']);
    expect(errors({ ...wingOf([sec(0, 100), sec(1, 80)]) }, 0)).toEqual(['The length unit of the file is not a positive number.']);
    // The dihedral of the last section belongs to no panel: NaN there is no error.
    expect(mapSections(wingOf([sec(0, 100), sec(100, 80, 0, NaN)]), 1).sections).toHaveLength(2);
  });

  it('sets a root within 0.1 mm of the centre to 0, as XFLR5 joins the halves there', () => {
    const near = mapSections(wingOf([sec(0.05, 100), sec(100, 80)]), 1);
    expect(near.sections.map((q) => q.y)).toEqual([0, 100]);
    expect(texts(near.report)).toEqual(['Root y_position 0.05 mm lies within 0.1 mm of the centre and is set to 0, as XFLR5 joins the halves there.']);
    // A root negative by rounding noise only: no error, and nothing to report.
    const noise = mapSections(wingOf([sec(-1e-12, 0.1), sec(0.1, 0.08)]), 1000);
    expect(noise.sections.map((q) => q.y)).toEqual([0, 100]);
    expect(texts(noise.report)).toEqual([]);
    expect(texts(mapSections(wingOf([sec(-0.1, 100), sec(100, 80)]), 1).report, 'error')).toEqual(['The root section lies at y_position -0.1 mm; the half wing must start at y >= 0.']);
    // XFLR5 separates the halves only beyond 0.1 mm (0.0001 m): at 0.1 mm they are joined.
    for (const [w, k] of [
      [wingOf([sec(0.1, 100), sec(100, 80)]), 1],
      [wingOf([sec(0.0001, 0.1), sec(0.1, 0.08)]), 1000],
    ]) {
      const edge = mapSections(w, k);
      expect(edge.sections.map((q) => q.y)).toEqual([0, 100]);
      expect(texts(edge.report)).toEqual(['Root y_position 0.1 mm lies within 0.1 mm of the centre and is set to 0, as XFLR5 joins the halves there.']);
    }
    expect(texts(mapSections(wingOf([sec(0.1001, 100), sec(100, 80)]), 1).report)).toEqual(['The root lies at y = 0.1001 mm: the two halves are built as separate bodies, as in XFLR5.']);
  });

  it('refuses positions, chords and twists beyond the limits of a project, in XFLR5 section numbers', () => {
    const errors = (w, k = 1) => {
      const r = mapSections(w, k);
      expect(r.sections).toEqual([]);
      return texts(r.report, 'error');
    };
    expect(errors(wingOf([sec(0, 100, 2e6), sec(100, 80)]))).toEqual(['Section 1: the position lies beyond ±1000000 mm, the limit of Wingdesigner.']);
    expect(errors(wingOf([sec(0, 100), sec(2000, 80)]), 1000)).toEqual(['Section 2: the position lies beyond ±1000000 mm, the limit of Wingdesigner.']);
    expect(errors(wingOf([sec(0, 2e5), sec(100, 80), sec(200, 1e300)]))).toEqual([
      'Section 1: chord 200000 mm is larger than 100000 mm, the limit of Wingdesigner.',
      'Section 3: chord 1e+300 mm is larger than 100000 mm, the limit of Wingdesigner.',
    ]);
    // Twists that differ by more than the limit, after the whole turns have gone.
    expect(errors(wingOf([sec(0, 100), sec(100, 80, 0, 0, 800)]))).toEqual(['Section 2: twist 440° (tilt included) lies beyond ±360°, the limit of Wingdesigner.']);
    // Past 5 sections, one line counts the rest.
    expect(errors(wingOf(Array.from({ length: 8 }, (_, i) => sec(i * 10, 2e5))))).toEqual([
      ...Array.from({ length: 5 }, (_, i) => `Section ${i + 1}: chord 200000 mm is larger than 100000 mm, the limit of Wingdesigner.`),
      'Further sections beyond the limits of Wingdesigner: 3.',
    ]);
    // The mapping reports them before the project check, which would name guide curves as well.
    const r = mapXflr5(xmlFile([wingOf([sec(0, 100, 2e6), sec(100, 80)]), null, null, null]));
    expect(texts(r.report, 'error')).toEqual(['Section 1: the position lies beyond ±1000000 mm, the limit of Wingdesigner.']);
    setLanguage('de');
    expect(errors(wingOf([sec(0, 2e5), sec(100, 80)]))).toEqual(['Schnitt 1: Die Profiltiefe 200.000 mm ist größer als 100.000 mm, die Grenze von Wingdesigner.']);
  });

  it('takes whole turns out of the twists, which give the same sections', () => {
    const turned = mapSections(wingOf([sec(0, 100), sec(100, 80, 0, 0, 359)], { tilt: 2 }), 1);
    expect(turned.sections.map((q) => q.twist)).toEqual([-358, 1]);
    expect(texts(turned.report, 'info')).toContain('All twists were changed by -360°, a whole number of turns; the sections stay the same.');
    // A tilt of 400 degrees (XFLR5 keeps tilts up to 1000) is one of 40 degrees.
    const tilt400 = mapSections(wingOf([sec(0, 100), sec(100, 80, 0, 0, -2)], { tilt: 400 }), 1);
    const tilt40 = mapSections(wingOf([sec(0, 100), sec(100, 80, 0, 0, -2)], { tilt: 40 }), 1);
    expect(tilt400.sections.map((q) => q.twist)).toEqual([40, 38]);
    tilt400.sections.forEach((q, i) => values(q).forEach((v, k) => expect(v).toBeCloseTo(values(tilt40.sections[i])[k], 9)));
    expect(texts(tilt400.report, 'error')).toEqual([]);
    expect(mapXflr5(xmlFile([wingOf([sec(0, 100), sec(100, 80)], { tilt: 400 }), null, null, null]), { choices: { 'NACA 0009': 'naca:0009' } }).project.sections.map((q) => q.twist)).toEqual([40, 40]);
  });

  it('raises chords below 1 mm and writes no -0', () => {
    const { sections, report } = mapSections(wingOf([sec(0, 20), sec(100, 0.5)]), 1);
    expect(sections[1].chord).toBe(LIMITS.minChord);
    expect(texts(report, 'warning')).toEqual(['Chords below 1 mm were raised to 1 mm, the smallest chord Wingdesigner builds, at section 2.']);
    const neg = mapSections(wingOf([sec(0, 20, -0), sec(100, 10, 0, 0, -0)], { position: { x: -0, y: 0, z: -0 } }), 1).sections;
    for (const s of neg) for (const v of values(s)) expect(Object.is(v, -0)).toBe(false);
  });

  it('moves a section that shares its y with the next one inwards along the inner panel', () => {
    const w = wingOf([sec(0, 200, 0, 10, 0, 'A'), sec(100, 180, 0, 0, 0, 'A'), sec(100, 180, 0, 0, 0, 'B'), sec(300, 120, 10, 0, 0, 'B')]);
    const { sections, report } = mapSections(w, 1);
    const Y = 100 * Math.cos(10 * DEG);
    const Z = 100 * Math.sin(10 * DEG);
    expect(sections.map((s) => s.index)).toEqual([0, 1, 2, 3]);
    expect(sections[1].y).toBeCloseTo(Y - NUDGE * Math.cos(10 * DEG), 12);
    expect(sections[1].z).toBeCloseTo(Z - NUDGE * Math.sin(10 * DEG), 12);
    expect([sections[2].y, sections[2].z]).toEqual([Y, Z]);
    expect(sections[3].y).toBeCloseTo(Y + 200, 12);
    expect(texts(report, 'warning')).toEqual(['Sections 2 and 3 share y = 98.4808 mm; section 2 was moved 0.5 mm inwards.']);
    // A short inner panel limits the move to a quarter of its length.
    const short = mapSections(wingOf([sec(0, 200, 0, 0, 0, 'A'), sec(1, 180, 0, 0, 0, 'A'), sec(1, 170, 0, 0, 0, 'B'), sec(300, 120)]), 1);
    expect(short.sections[1].y).toBe(0.75);
    expect(texts(short.report, 'warning')).toEqual(['Sections 2 and 3 share y = 1 mm; section 2 was moved 0.25 mm inwards.']);
  });

  it('spreads a run of sections at one y, moves the root run outwards and counts panels under 0.1 mm as none', () => {
    const run = mapSections(wingOf([sec(0, 200), sec(100, 180, 0, 0, 0, 'A'), sec(100, 180, 0, 0, 0, 'B'), sec(100, 180, 0, 0, 0, 'C'), sec(200, 100)]), 1);
    expect(run.sections.map((s) => s.y)).toEqual([0, 99.5, 99.75, 100, 200]);
    expect(texts(run.report, 'warning')).toEqual([
      'Sections 2 and 4 share y = 100 mm; section 2 was moved 0.5 mm inwards.',
      'Sections 3 and 4 share y = 100 mm; section 3 was moved 0.25 mm inwards.',
    ]);
    const root = mapSections(wingOf([sec(0, 200, 0, 0, 0, 'A'), sec(0, 200, 0, 0, 0, 'B'), sec(200, 100, 0, 0, 0, 'B')]), 1);
    expect(root.sections.map((s) => s.y)).toEqual([0, 0.5, 200]);
    expect(texts(root.report, 'warning')).toEqual(['Sections 1 and 2 share y = 0 mm; section 2 was moved 0.5 mm outwards.']);
    const tiny = mapSections(wingOf([sec(0, 200), sec(100, 180, 0, 0, 0, 'A'), sec(100 + MIN_PANEL / 2, 170, 0, 0, 0, 'B'), sec(200, 100)]), 1);
    expect(tiny.sections.map((s) => s.y)).toEqual([0, 99.5, 100, 199.95]);
    // Past 5 moved sections, one line counts the rest.
    const pairs = wingOf([sec(0, 200), ...Array.from({ length: 8 }, (_, i) => [sec(100 * (i + 1), 180, 0, 0, 0, 'A'), sec(100 * (i + 1), 170, 0, 0, 0, 'B')]).flat(), sec(1000, 100)]);
    const moved = texts(mapSections(pairs, 1).report, 'warning');
    expect(moved).toHaveLength(6);
    expect(moved[0]).toBe('Sections 2 and 3 share y = 100 mm; section 2 was moved 0.5 mm inwards.');
    expect(moved[5]).toBe('Further sections moved apart: 3.');
  });

  it('drops identical sections at one y silently', () => {
    const { sections, report } = mapSections(wingOf([sec(0, 200), sec(100, 180, 5, 3), sec(100, 180, 5, 0), sec(200, 100)]), 1);
    expect(sections.map((s) => s.index)).toEqual([0, 2, 3]);
    expect(texts(report, 'warning')).toEqual([]);
    // The outer section stays: it carries the dihedral of the next panel (0 here).
    expect(sections[2].z).toBe(0);
  });

  it('warns when left and right airfoils differ', () => {
    const w = wingOf([sec(0, 200, 0, 0, 0, 'A', 'B'), sec(100, 180, 0, 0, 0, 'A', 'B'), sec(200, 150), sec(300, 100, 0, 0, 0, 'C', 'D')]);
    expect(texts(mapSections(w, 1).report, 'warning')).toEqual(['Left and right airfoils differ at sections 1–2, 4; the right-side airfoils are used.']);
    expect(texts(mapSections(wingOf([sec(0, 200, 0, 0, 0, 'A', 'B'), sec(100, 100)]), 1).report, 'warning')).toEqual([
      'Left and right airfoils differ at section 1; the right-side airfoils are used.',
    ]);
    // Long lists end after 10 ranges.
    const many = wingOf(Array.from({ length: 30 }, (_, i) => (i % 2 ? sec(i * 10, 100) : sec(i * 10, 100, 0, 0, 0, 'A', 'B'))));
    expect(texts(mapSections(many, 1).report, 'warning')).toEqual([
      'Left and right airfoils differ at sections 1, 3, 5, 7, 9, 11, 13, 15, 17, 19, …; the right-side airfoils are used.',
    ]);
  });

  it('maps the XML file in inches and the .xfl project of the same plane alike', () => {
    const a = xml('uaslab/UltraStick25e.xml').planes[0];
    const b = xfl('uaslab/UltraStick25e_v662_stripped.xfl').planes[0];
    for (const slot of [0, 2]) {
      const sa = mapSections(a.wings[slot], 25.4).sections;
      const sb = mapSections(b.wings[slot], 1000).sections;
      expect(sa).toHaveLength(sb.length);
      sa.forEach((s, i) => values(s).forEach((v, k) => expect(Math.abs(v - values(sb[i])[k])).toBeLessThan(1e-6)));
    }
  });
});

describe('XFLR5 mapping: surfaces', () => {
  it('offers the main wing and the stabilizer of a plane and names the other wings', () => {
    const { surfaces, others } = planeSurfaces(FIXTURES, 0);
    expect(surfaces.map((s) => [s.key, s.slot, s.label, s.available, s.reason, s.name, s.sections])).toEqual([
      ['main', 0, 'Main wing', true, null, 'Main Wing', 3],
      ['stab', 2, 'Horizontal stabilizer (XFLR5: Elevator)', true, null, 'Elevator', 2],
    ]);
    expect(surfaces[1].span).toBe(460);
    expect(surfaces[1].rootChord).toBeCloseTo(110, 9);
    expect(surfaces[1].detail).toBe('"Elevator": 2 sections, span 460 mm, root chord 110 mm');
    expect(others).toEqual([{ slot: 3, name: 'Fin', label: 'Fin' }]);
    const b = planeSurfaces(FIXTURES, 1);
    expect(b.surfaces[1]).toMatchObject({ available: false, reason: 'This plane has no elevator.', wing: null });
    expect(b.others).toEqual([]);
    expect(defaultSurface(FIXTURES, 1)).toBe('main');
    expect(() => planeSurfaces(FIXTURES, 2)).toThrow(RangeError);
    const second = xmlFile([null, wingOf([sec(0, 100), sec(100, 80)], { name: 'Tandem' }), wingOf([sec(0, 100), sec(100, 80)]), null]);
    expect(planeSurfaces(second).surfaces[0].reason).toBe('This plane has no main wing.');
    expect(planeSurfaces(second).others).toEqual([{ slot: 1, name: 'Tandem', label: 'Second wing' }]);
    expect(defaultSurface(second)).toBe('stab');
    const bad = planeSurfaces(xmlFile([wingOf([sec(NaN, 100), sec(100, 80)]), null, null, null])).surfaces[0];
    expect(bad.detail).toBe('"Wing": 2 sections, span ? mm, root chord 100 mm');
    const empty = xmlFile([wingOf([], { name: '' }), null, null, wingOf([sec(0, 100), sec(100, 80)])]);
    expect(planeSurfaces(empty).surfaces[0]).toMatchObject({ available: true, sections: 0, detail: '"(no name)": no sections' });
    const one = xmlFile([wingOf([sec(0, 240)], { name: 'Main Wing' }), null, null, null]);
    expect(planeSurfaces(one).surfaces[0].detail).toBe('"Main Wing": 1 section, root chord 240 mm');
    expect(texts(mapXflr5(empty).report, 'error')).toEqual(['The wing needs at least 2 sections (found 0).']);
    expect(defaultSurface(xmlFile([null, null, null, wingOf([sec(0, 100), sec(100, 80)])]))).toBe('main');
    expect(texts(mapXflr5(second, { surface: 'stab' }).report, 'info')).toContain('Not imported: the second wing "Tandem". One surface per import; open the file again for another one.');
  });

  it('takes the role of a wing-only XML file from its type', () => {
    const f = xml('xml_mm/0.w2.wing.xml');
    const { surfaces } = planeSurfaces(f);
    expect(surfaces.map((s) => [s.available, s.reason])).toEqual([
      [false, 'The wing in this file is a horizontal stabilizer (type ELEVATOR).'],
      [true, null],
    ]);
    expect(defaultSurface(f)).toBe('stab');
    const main = xmlFile([wingOf([sec(0, 100), sec(100, 80)]), null, null, null], { wingOnly: true });
    expect(planeSurfaces(main).surfaces[1].reason).toBe('The wing in this file is not a horizontal stabilizer (type ELEVATOR).');
  });

  it('describes the file', () => {
    expect(describeFile(FIXTURES)).toBe('XFLR5 project, format 200002 (XFLR5 6.44 or later)');
    expect(describeFile(xfl('uaslab/Rascal110.xfl'))).toBe('XFLR5 project, format 200001 (XFLR5 6.10 to 6.43)');
    expect(describeFile(xml('xml_in/0.plane.xml'))).toBe('XFLR5 plane file (XML), lengths in inches');
    expect(describeFile(xml('xml_mm/0.w2.wing.xml'))).toBe('XFLR5 wing file (XML), lengths in millimetres');
    expect(describeFile(xmlFile([], { lengthUnit: 2, unitName: null }))).toBe('XFLR5 plane file (XML), lengths in units of 2 mm');
    expect(['cm', 'dm', 'm', 'ft'].map((unitName) => describeFile(xmlFile([], { unitName })))).toEqual(['centimetres', 'decimetres', 'metres', 'feet'].map((u) => `XFLR5 plane file (XML), lengths in ${u}`));
    expect(describeFile(xmlFile([], { lengthUnit: 2, unitName: null, wingOnly: true }))).toBe('XFLR5 wing file (XML), lengths in units of 2 mm');
  });
});

describe('XFLR5 mapping: airfoils', () => {
  const NACA12 = nacaAirfoil('0012').points;
  const NACA2412 = nacaAirfoil('2412').points;

  it('takes the airfoils of an .xfl project by exact name, cleaned up and checked, with their source', () => {
    const r = mapXflr5(FIXTURES, { fileName: 'fixtures_v662.xfl' });
    expect(r.rows.map((row) => [row.name, row.sections, row.found, row.key, row.ok, row.picked])).toEqual([
      ['Clark Y', [1, 2], 'file', 'file:Clark Y', true, false],
      ['NACA 0009', [3], 'file', 'file:NACA 0009', true, false],
    ]);
    const clark = r.project.airfoils.find((a) => a.name === 'Clark Y');
    expect(clark.source).toEqual({ kind: 'xflr5', file: 'fixtures_v662.xfl', note: 'Airfoil "Clark Y" from XFLR5 plane "Fixture A"; base shape without flap deflection.' });
    // Checked points: unit chord, leading edge at the origin.
    expect(Math.min(...clark.points.map((p) => p[0]))).toBe(0);
    expect(Math.max(...clark.points.map((p) => p[0]))).toBe(1);
    expect(r.rows[0].foundLabel).toBe('From the file');
    // The Clark Y's nose lies 3.5 % of the chord above its flat lower surface, which moves its sections
    // by more than FRAME_WARN. The check notes of an airfoil appear once, under the name of the airfoil
    // in use, with its sections; its inclined chord line is no difference from XFLR5, which measures
    // twist from the file's x axis as well.
    expect(texts(r.report, 'warning')).toEqual([
      nb('Airfoil "Clark Y" (sections 1–2) has its leading edge at x = 0 %, y = 3.55 % and its trailing edge at x = 100 % of chord in its own coordinates; these sections were moved so that the airfoil lies as in XFLR5.'),
    ]);
    expect(texts(r.report, 'info')).toContainEqual(expect.stringMatching(/^Airfoil "Clark Y" \(sections 1–2\): The line from the leading edge to the trailing edge is inclined by -1\.97 degrees/));
    expect(r.project.sections.map((s) => s.airfoil)).toEqual(['clark-y', 'clark-y', 'naca-0009']);
  });

  it('looks names up case-sensitively with their spaces, and suggests attributions', () => {
    const w = wingOf([sec(0, 0.2, 0, 0, 0, 'E205  (10.48%)'), sec(0.5, 0.15, 0, 0, 0, 'MH 45')]);
    const f = xflFile([w, null, null, null], [foilOf('E205 (10.48%)', NACA12), foilOf('E205  (10.48%)', NACA2412), foilOf('MH 45', NACA12), foilOf('mh 45', NACA2412)]);
    const r = mapXflr5(f, { fileName: 'p.xfl' });
    expect(r.rows.map((row) => row.key)).toEqual(['file:E205  (10.48%)', 'file:MH 45']);
    // The airfoil with two spaces is the cambered one; "mh 45" is not "MH 45".
    const camber = (row) => Math.max(...row.airfoil.points.map((p) => p[1])) + Math.min(...row.airfoil.points.map((p) => p[1]));
    expect(camber(r.rows[0])).toBeGreaterThan(0.01);
    expect(camber(r.rows[1])).toBeCloseTo(0, 9);
    expect(r.project.airfoils.map((a) => [a.name, a.source.attribution])).toEqual([
      ['E205  (10.48%)', undefined],
      ['MH 45', 'Martin Hepperle, www.mh-aerotools.de'],
    ]);
  });

  it('treats an empty name, a missing name and an airfoil that fails the check as missing', () => {
    const w = wingOf([sec(0, 0.2, 0, 0, 0, ''), sec(0.3, 0.18, 0, 0, 0, ''), sec(0.5, 0.15, 0, 0, 0, 'Broken'), sec(0.6, 0.1, 0, 0, 0, 'Absent')]);
    const broken = foilOf('Broken', [
      [1, 0],
      [0.5, 0.1],
      [0, 0],
      [0.5, -0.1],
      [1, 0.2],
      [0.2, 0.3],
    ]);
    const f = xflFile([w, null, null, null], [broken, foilOf('', NACA12)]);
    const r = mapXflr5(f);
    expect(r.rows.map((row) => [row.name, row.label, row.found, row.ok])).toEqual([
      ['', '(no name)', 'missing', false],
      ['Broken', 'Broken', 'missing', false],
      ['Absent', 'Absent', 'missing', false],
    ]);
    expect(r.missing).toBe(3);
    expect(r.project).toBeNull();
    const errors = texts(r.report, 'error');
    expect(errors[0]).toBe('XFLR5 names no airfoil at sections 1–2: upload a .dat file or pick an airfoil.');
    expect(errors[1]).toMatch(/^Airfoil "Broken" \(section 3\) from the file fails the check: .+ Upload a \.dat file or pick an airfoil\.$/);
    expect(errors[2]).toBe('Airfoil "Absent" (section 4) is missing: upload a .dat file or pick an airfoil.');
    expect(r.errors).toBe(3);
  });

  it('imports a file airfoil whose closed trailing edge crosses its own end (UIUC pattern, Gertie.xfl)', () => {
    // SD8000-089-88 of Gertie.xfl ends as the UIUC file sd8000.dat: first point x = 1.00000, last
    // point x = 1.00001, and the last segment crosses the first. NACA 6412 ends the same way.
    const points = nacaAirfoil('6412', { closedTE: true }).points.map((p) => p.slice());
    points[points.length - 1] = [1.00001, 0];
    const foil = foilOf('SD8000-089-88', points);
    const w = wingOf([sec(0, 0.16, 0, 0, 0, foil.name), sec(0.6, 0.12, 0, 0, 0, foil.name)]);
    const r = mapXflr5(xflFile([w, null, null, null], [foil]));
    expect(texts(r.report, 'error')).toEqual([]);
    expect(r.rows.map((row) => [row.name, row.found, row.ok])).toEqual([['SD8000-089-88', 'file', true]]);
    expect(buildWing(r.project).errors).toEqual([]);
  });

  it('refuses file airfoils that the clean-up rejects, and uploads that do not parse', () => {
    const w = wingOf([sec(0, 0.2, 0, 0, 0, 'NaN foil'), sec(0.5, 0.15, 0, 0, 0, 'NaN foil')]);
    const r = mapXflr5(xflFile([w, null, null, null], [foilOf('NaN foil', [...NACA12.slice(0, 5), [NaN, 0], ...NACA12.slice(5)])]));
    expect(texts(r.report, 'error')).toEqual(['Airfoil "NaN foil" (sections 1–2) from the file fails the check: Coordinates contain non-finite values. Upload a .dat file or pick an airfoil.']);
    const text = readAirfoilUpload('just words\nno numbers here\n', 'words.dat');
    expect(text).toMatchObject({ ok: false, problem: 'No coordinate lines found.', name: 'just words' });
  });

  it('names airfoils of the project and the library without a name or source, and airfoils of an unnamed plane', () => {
    const project = sampleProject();
    project.airfoils.push({ id: 'anon', points: NACA12 }, { id: 'blank', name: '  ', points: NACA2412 });
    const r = mapXflr5(simple('anon'), { project, choices: {} });
    expect(r.rows[0]).toMatchObject({ found: 'project', key: 'project:anon' });
    expect(r.project.airfoils[0].name).toBe('anon');
    expect(r.options.find((o) => o.key === 'project:anon')).toMatchObject({ name: 'anon', label: 'Current project: anon' });
    expect(mapXflr5(simple('X'), { project, choices: { X: 'project:blank' } }).project.airfoils[0].name).toBe('blank');
    expect(r.options.find((o) => o.key === 'project:blank')).toMatchObject({ name: 'blank', label: 'Current project: blank' });
    const entry = { ...LIBRARY[0], id: 'plain', name: 'Plain', source: undefined };
    const lib = mapXflr5(simple('Plain'), { library: [entry] });
    expect(lib.project.airfoils[0].source).toMatchObject({ kind: 'library', id: 'plain' });
    const f = xflFile([wingOf([sec(0, 0.2, 0, 0, 0, 'N'), sec(0.5, 0.15, 0, 0, 0, 'N')]), null, null, null], [foilOf('N', NACA12)], { planeName: '' });
    const unnamed = mapXflr5(f, { fileName: 'u.xfl' });
    expect(unnamed.project.airfoils[0].source.note).toBe('Airfoil "N" from an XFLR5 project; base shape without flap deflection.');
    expect(unnamed.summary).toBe('Imported the main wing "Wing" from u.xfl: 2 sections, 1 airfoil.');
  });

  it('uses another source for a file airfoil that fails the check, and for a project whose airfoils are unreadable', () => {
    const w = wingOf([sec(0, 0.2, 0, 0, 0, 'NACA 0012'), sec(0.5, 0.15, 0, 0, 0, 'NACA 0012')]);
    const f = xflFile([w, null, null, null], [foilOf('NACA 0012', [[1, 0], [0, 0], [1, 0.1], [0.5, 0], [1, -0.1]])]);
    const r = mapXflr5(f);
    expect(r.rows[0]).toMatchObject({ found: 'naca', key: 'naca:0012', ok: true });
    expect(texts(r.report, 'warning')).toEqual([expect.stringMatching(/^Airfoil "NACA 0012" from the file fails the check: .+ "NACA 0012" is used instead\.$/)]);
    const damaged = { ...f, foils: null, foilError: { offset: 900, what: 'airfoil' }, warnings: ['The airfoils could not be read. X Pick or upload them.'] };
    const d = mapXflr5(damaged);
    expect(d.rows[0]).toMatchObject({ found: 'naca', ok: true });
    expect(texts(d.report, 'warning')).toEqual(['The airfoils could not be read. X Pick or upload them.']);
    expect(d.options.some((o) => o.kind === 'file')).toBe(false);
  });

  it('reports flaps: the base shape is imported, with a notice at 0 degrees and a warning otherwise', () => {
    const w = wingOf([sec(0, 0.2, 0, 0, 0, 'Aileron'), sec(0.4, 0.18, 0, 0, 0, 'Camber'), sec(0.5, 0.15, 0, 0, 0, 'Slat')]);
    const f = xflFile(
      [w, null, null, null],
      [
        foilOf('Aileron', NACA12, { te: { on: true, angle: 0, hingeX: 82.26 } }),
        foilOf('Camber', NACA12, { te: { on: true, angle: 0.5, hingeX: 50 } }),
        foilOf('Slat', NACA12, { le: { on: true, angle: -5, hingeX: 15 }, te: { on: false, angle: 20 } }),
      ],
    );
    const r = mapXflr5(f);
    expect(texts(r.report, 'info')).toContain('Airfoil "Aileron" has a trailing-edge flap at 0° in XFLR5 (hinge at 82.26 % chord); control surfaces are not cut.');
    expect(texts(r.report, 'warning')).toEqual([
      'Airfoil "Camber" has a 0.5° trailing-edge flap in XFLR5 (hinge at 50 % chord); it is imported undeflected.',
      'Airfoil "Slat" has a -5° leading-edge flap in XFLR5 (hinge at 15 % chord); it is imported undeflected.',
    ]);
    const le0 = mapXflr5(xflFile([wingOf([sec(0, 0.2, 0, 0, 0, 'L'), sec(0.4, 0.18, 0, 0, 0, 'L')]), null, null, null], [foilOf('L', NACA12, { le: { on: true, hingeX: 20 } })]));
    expect(texts(le0.report, 'info')).toContain('Airfoil "L" has a leading-edge flap at 0° in XFLR5 (hinge at 20 % chord); control surfaces are not cut.');
    // A picked file airfoil reports its own flaps.
    const pick = mapXflr5(xflFile([wingOf([sec(0, 0.2, 0, 0, 0, 'Clark'), sec(0.4, 0.18, 0, 0, 0, 'Clark')]), null, null, null], [foilOf('Clark', NACA12), foilOf('Flap20', NACA12, { te: { on: true, angle: 20, hingeX: 70 } })]), {
      choices: { Clark: 'file:Flap20' },
    });
    expect(texts(pick.report, 'warning')).toEqual(['Airfoil "Flap20" has a 20° trailing-edge flap in XFLR5 (hinge at 70 % chord); it is imported undeflected.']);
    // Rascal 110: flap airfoils at 0 degrees.
    const rascal = mapXflr5(xfl('uaslab/Rascal110.xfl'), { surface: 'stab' });
    expect(texts(rascal.report, 'info')).toContain('Airfoil "Flat Plate NACA 0005 Elev" has a trailing-edge flap at 0° in XFLR5 (hinge at 82.7 % chord); control surfaces are not cut.');
    expect(rascal.project.sections).toHaveLength(9);
  });

  it('reports the flaps of a file airfoil once, however many names use it', () => {
    const f = xfl('uaslab/UltraStick25e_v662_stripped.xfl');
    const names = mapXflr5(f).rows.map((row) => row.name);
    expect(names.length).toBeGreaterThan(1);
    const r = mapXflr5(f, { choices: Object.fromEntries(names.map((n) => [n, 'file:Flat_Elev'])) });
    expect(texts(r.report).filter((t) => t.includes('flap'))).toEqual(['Airfoil "Flat_Elev" has a trailing-edge flap at 0° in XFLR5 (hinge at 68.97 % chord); control surfaces are not cut.']);
  });

  it('resolves names of XML files: uploads by name line, then trimmed, then by file name', () => {
    const f = simple('Eppler 423 ');
    const dat = (name) => toSeligDat(name, NACA2412);
    const byName = readAirfoilUpload(dat('Eppler 423 x'), 'e423.dat');
    const byTrim = readAirfoilUpload(dat('Eppler 423'), 'other.dat');
    const byFile = readAirfoilUpload(dat('Something'), 'Eppler 423 .dat');
    expect(byTrim).toMatchObject({ fileName: 'other.dat', name: 'Eppler 423', ok: true, problem: null, source: { kind: 'upload', file: 'other.dat', attribution: '' } });
    expect(mapXflr5(f, { uploads: [byName, byFile, byTrim] }).rows[0]).toMatchObject({ found: 'upload', key: 'upload:2', foundLabel: 'Uploaded file' });
    expect(mapXflr5(f, { uploads: [byName, byFile] }).rows[0]).toMatchObject({ found: 'upload', key: 'upload:1' });
    const exact = readAirfoilUpload(dat('Eppler 423 '), 'x.dat');
    // parseDat trims the name line, so a name with an outer space matches the trimmed name.
    expect(exact.name).toBe('Eppler 423');
    const r = mapXflr5(simple('E423'), { uploads: [readAirfoilUpload(dat('Eppler 423'), 'E423.dat')] });
    expect(r.rows[0]).toMatchObject({ found: 'upload', key: 'upload:0', ok: true });
    expect(r.project.airfoils[0]).toMatchObject({ name: 'Eppler 423', source: { kind: 'upload', file: 'E423.dat' } });
  });

  it('skips uploads that fail and reports them', () => {
    const bad = readAirfoilUpload('Eppler 423\n1 0\n0 0\n', 'E423.dat');
    expect(bad.ok).toBe(false);
    expect(bad.problem).toBeTruthy();
    const r = mapXflr5(simple('E423'), { uploads: [bad] });
    expect(r.rows[0].found).toBe('missing');
    // Unused, it is noted; it does not reach the warnings of the import.
    expect(texts(r.report, 'warning')).toEqual([]);
    expect(texts(r.report, 'info')).toContain(`The uploaded file E423.dat is not usable: ${bad.problem}`);
    expect(r.options.find((o) => o.key === 'upload:0')).toMatchObject({ kind: 'upload', ok: false });
    // A file refused before parsing (too large, unreadable, an XFLR5 file) names itself.
    const problem = 'x.xfl is an XFLR5 file, not an airfoil. Use Open to import a wing from it.';
    const refused = refusedUpload('x.xfl', problem);
    expect(refused).toMatchObject({ fileName: 'x.xfl', name: 'x.xfl', ok: false, points: [], problem, refused: true, source: { kind: 'upload', file: 'x.xfl' } });
    expect(texts(mapXflr5(simple('E423'), { uploads: [refused] }).report, 'info')).toContain(problem);
    // Picked for a row, it is that row's error only.
    const picked = mapXflr5(simple('E423'), { uploads: [bad], choices: { E423: 'upload:0' } });
    expect(texts(picked.report).filter((t) => t.includes('E423.dat'))).toEqual([]);
    expect(texts(picked.report, 'error')).toEqual([`Airfoil "E423" (sections 1–2): the chosen airfoil fails the check: ${bad.problem}`]);
  });

  it('resolves names from the current project, the library, NACA designations and similar names, in this order', () => {
    const project = sampleProject();
    project.airfoils.push({ id: 'my-clark', name: 'Clark Y', points: NACA2412, source: { kind: 'upload', file: 'mine.dat' } });
    const lib = mapXflr5(simple('Clark Y'), { library: LIBRARY });
    expect(lib.rows[0]).toMatchObject({ found: 'library', key: 'library:clark-y', foundLabel: 'Library' });
    expect(lib.project.airfoils[0].source).toMatchObject({ kind: 'library', id: 'clark-y', license: 'public-domain' });
    const own = mapXflr5(simple('Clark Y'), { library: LIBRARY, project });
    expect(own.rows[0]).toMatchObject({ found: 'project', key: 'project:my-clark', foundLabel: 'Current project' });
    expect(own.project.airfoils[0]).toMatchObject({ name: 'Clark Y', source: { kind: 'upload', file: 'mine.dat' } });
    // A project airfoil named after a NACA designation wins over the generator.
    project.airfoils.push({ id: 'n9', name: 'NACA 0009', points: NACA12 });
    expect(mapXflr5(simple('NACA 0009'), { project }).rows[0]).toMatchObject({ found: 'project', key: 'project:n9' });
    const naca = mapXflr5(simple('NACA 0009'));
    expect(naca.rows[0]).toMatchObject({ found: 'naca', key: 'naca:0009', foundLabel: 'NACA equations', naca: { key: 'naca:0009', name: 'NACA 0009' } });
    expect(naca.project.airfoils[0]).toMatchObject({ id: 'naca-0009', name: 'NACA 0009', source: { kind: 'naca', code: '0009', closedTE: false } });
    expect(mapXflr5(simple('naca2412')).rows[0]).toMatchObject({ found: 'naca', key: 'naca:2412' });
    // The trimmed name matches the project and the library too.
    expect(mapXflr5(simple(' Clark Y  '), { library: LIBRARY }).rows[0]).toMatchObject({ found: 'library' });
    const similar = mapXflr5(simple('CLARK_Y'), { library: LIBRARY });
    expect(similar.rows[0]).toMatchObject({ found: 'loose', key: 'library:clark-y', ok: true, foundLabel: 'Similar name' });
    expect(texts(similar.report, 'warning')).toContain('Airfoil "CLARK_Y" matched to "Clark Y" by a similar name.');
    // A candidate that fails the check is passed over.
    project.airfoils.push({ id: 'bad', name: 'Bad', points: [[1, 0], [0, 0], [1, 0.1], [0.5, 0], [1, -0.1]] });
    expect(mapXflr5(simple('Bad'), { project }).rows[0]).toMatchObject({ found: 'missing', key: null });
    project.airfoils.push({ id: 'good', name: 'b-a-d', points: NACA12 });
    expect(mapXflr5(simple('Bad'), { project }).rows[0]).toMatchObject({ found: 'loose', key: 'project:good' });
    // A name that is empty when compared loosely matches nothing, not every other such name.
    const blank = readAirfoilUpload(toSeligDat('_', NACA12), 'x.dat');
    expect(blank.ok).toBe(true);
    expect(mapXflr5(simple('-'), { uploads: [blank] }).rows[0]).toMatchObject({ found: 'missing', key: null });
    // Names that are no NACA designation, and no similar name: missing.
    for (const name of ['NACA0014_Flap', 'NACA 0010 Airfoil']) expect(mapXflr5(simple(name), { library: LIBRARY }).rows[0].found).toBe('missing');
    expect(mapXflr5(simple('Clark Y')).rows[0]).toMatchObject({ found: 'missing', foundLabel: 'Missing', key: null, airfoil: null });
  });

  it('lets the user pick any airfoil for a name, and keeps the automatic choice for unknown keys', () => {
    const f = simple('Mystery');
    const project = sampleProject();
    expect(mapXflr5(f, { choices: { Mystery: 'library:clark-y' }, library: LIBRARY }).rows[0]).toMatchObject({ found: 'missing', auto: null, key: 'library:clark-y', picked: true, ok: true });
    expect(mapXflr5(f, { choices: { Mystery: 'naca:4415' } }).project.airfoils[0].name).toBe('NACA 4415');
    expect(mapXflr5(f, { choices: { Mystery: 'project:tip' }, project }).project.airfoils[0].name).toBe('NACA 0010');
    for (const key of ['library:nothing', 'upload:3', 'upload:x', 'naca:0000', 'project:none', 'file:Clark Y', 'nonsense', '']) {
      expect(mapXflr5(f, { choices: { Mystery: key } }).rows[0]).toMatchObject({ picked: false, key: null, found: 'missing' });
    }
    // A picked airfoil of the file replaces the automatic one; the loose-match warning goes.
    const fx = mapXflr5(FIXTURES, { choices: { 'NACA 0009': 'file:Clark Y' } });
    expect(fx.rows[1]).toMatchObject({ auto: 'file:NACA 0009', key: 'file:Clark Y', picked: true });
    expect(fx.project.airfoils).toHaveLength(1);
    const similar = mapXflr5(simple('CLARK_Y'), { library: LIBRARY, choices: { CLARK_Y: 'naca:2412' } });
    expect(texts(similar.report, 'warning')).toEqual([]);
    // A picked airfoil that fails the check blocks the import.
    const bad = readAirfoilUpload('Bad\n1 0\n0.5 0.1\n0 0\n0.5 -0.1\n1 0.3\n0.2 0.4\n', 'bad.dat');
    const blocked = mapXflr5(simple('NACA 0009'), { uploads: [bad], choices: { 'NACA 0009': 'upload:0' } });
    expect(blocked.rows[0]).toMatchObject({ picked: true, ok: false });
    expect(texts(blocked.report, 'error')).toEqual([`Airfoil "NACA 0009" (sections 1–2): the chosen airfoil fails the check: ${bad.problem}`]);
    expect(blocked.project).toBeNull();
  });

  it('lists the options of every row', () => {
    const project = sampleProject();
    const upload = readAirfoilUpload(toSeligDat('Up', NACA12), 'up.dat');
    const r = mapXflr5(FIXTURES, { project, library: LIBRARY, uploads: [upload] });
    const keys = r.options.map((o) => o.key);
    expect(keys.slice(0, 5)).toEqual(['file:Clark Y', 'file:NACA 0009', 'upload:0', 'project:root', 'project:tip']);
    expect(keys).toContain('library:clark-y');
    expect(keys).toContain('naca:2412');
    expect(r.options[0].label).toBe('From the file: Clark Y');
    expect(r.options[2].label).toBe('Uploaded: up.dat');
    expect(r.options[3].label).toBe('Current project: NACA 2412');
    expect(r.options.find((o) => o.key === 'library:clark-y').label).toBe('Library: Clark Y');
    expect(r.options.find((o) => o.key === 'naca:0009').label).toBe('NACA generator: NACA 0009');
    expect(r.rows[1].naca).toEqual({ key: 'naca:0009', kind: 'naca', name: 'NACA 0009', label: 'NACA generator: NACA 0009' });
    expect(r.rows[0].naca).toBeNull();
  });

  it('places an airfoil whose own coordinates are offset where XFLR5 draws it', () => {
    // NACA 2412 raised by 3 % of the chord, as a Clark Y file with its flat lower surface at y = 0.
    const raised = NACA2412.map(([x, y]) => [x, y + 0.03]);
    const w = wingOf([sec(0, 0.2, 0, 0, 3, 'Raised'), sec(0.5, 0.15, 0.02, 0, -2, 'NACA 0012')], { tilt: 1.5, position: { x: 0.1, y: 0, z: 0.02 } });
    const f = xflFile([w, null, null, null], [foilOf('Raised', raised), foilOf('NACA 0012', NACA12)]);
    const r = mapXflr5(f);
    const frame = r.rows[0].frame;
    expect(frame.x).toBe(0);
    expect(frame.chord).toBe(1);
    // The leading edge of the fitted curve lies slightly above the lowest-x point of cambered airfoils.
    expect(frame.y).toBeCloseTo(0.03, 2);
    expect(r.rows[1].frame).toEqual({ x: 0, y: 0, chord: 1 });
    // One section, and a chord of 1: the section was moved, not scaled. Figures with 2 decimals.
    expect(texts(r.report, 'warning')).toContain(
      nb(`Airfoil "Raised" (section 1) has its leading edge at x = 0 %, y = ${Number((frame.y * 100).toFixed(2))} % and its trailing edge at x = 100 % of chord in its own coordinates; this section was moved so that the airfoil lies as in XFLR5.`),
    );
    const spec = mapSections(w, 1000).sections;
    const [root, tip] = r.project.sections;
    const t = spec[0].twist * DEG;
    // The project holds 4 decimals.
    expect(root.x).toBeCloseTo(spec[0].x + 200 * frame.y * Math.sin(t), 3);
    expect(root.z).toBeCloseTo(spec[0].z + 200 * frame.y * Math.cos(t), 3);
    expect(values(tip)).toEqual(values(spec[1]).map(round4));
    // The built wing puts the trailing edge of the raw airfoil where XFLR5's rigid twist puts it.
    const build = buildWing(r.project);
    expect(build.errors).toEqual([]);
    const v = build.stations.find((s) => s.y === 0).v;
    const u0 = surfacePoint(build.surface, 0, v);
    const u1 = surfacePoint(build.surface, 1, v);
    const [te] = placeSection([[(raised[0][0] + raised.at(-1)[0]) / 2, (raised[0][1] + raised.at(-1)[1]) / 2]], { xLE: spec[0].x, y: 0, z: spec[0].z, chord: 200, twist: spec[0].twist }, 0.25);
    for (let k = 0; k < 3; k++) expect(Math.abs((u0[k] + u1[k]) / 2 - te[k])).toBeLessThan(1e-3);
  });

  it('scales a section whose airfoil does not span the unit chord, and ignores offsets within the tolerance', () => {
    const short = NACA12.map(([x, y]) => [0.02 + 0.9 * x, 0.9 * y]);
    const w = wingOf([sec(0, 0.2, 0, 0, 0, 'Short'), sec(0.5, 0.15, 0, 0, 0, 'Almost')]);
    const almost = NACA12.map(([x, y]) => [x, y + FRAME_TOLERANCE / 2]);
    const r = mapXflr5(xflFile([w, null, null, null], [foilOf('Short', short), foilOf('Almost', almost)]));
    expect(r.rows[0].frame.chord).toBeCloseTo(0.9, 6);
    expect(r.rows[0].frame.x).toBeCloseTo(0.02, 6);
    // Untwisted: the airfoil starts 2 % of the chord behind the section and spans 90 % of it.
    expect(r.project.sections[0].x).toBeCloseTo(4, 6);
    expect(r.project.sections[0].chord).toBeCloseTo(180, 6);
    expect(r.rows[1].frame).toEqual({ x: 0, y: 0, chord: 1 });
    expect(values(r.project.sections[1])).toEqual([0, 500, 0, 150, 0]);
    // The sections are scaled, not the coordinates: the check's note on scaling is left out.
    expect(texts(r.report, 'warning')).toEqual([
      nb('Airfoil "Short" (section 1) has its leading edge at x = 2 %, y = 0 % and its trailing edge at x = 92 % of chord in its own coordinates; this section was moved and scaled so that the airfoil lies as in XFLR5.'),
    ]);
    // Within FRAME_WARN of the unit chord, the move is an info line.
    const near = NACA12.map(([x, y]) => [x, y + FRAME_WARN / 2]);
    const n = mapXflr5(xflFile([w, null, null, null], [foilOf('Short', near), foilOf('Almost', almost)]));
    expect(texts(n.report, 'warning')).toEqual([]);
    expect(texts(n.report, 'info')).toContain(
      nb('Airfoil "Short" (section 1) has its leading edge at x = 0 %, y = 1 % and its trailing edge at x = 100 % of chord in its own coordinates; this section was moved so that the airfoil lies as in XFLR5.'),
    );
  });
});

describe('XFLR5 mapping: airfoil frames and checks', () => {
  const NACA12 = nacaAirfoil('0012').points;
  const coarse = [[1, 0.002], [0.9422, 0.0062], [0.4103, 0.1048], [0.3764, 0.0957], [0, 0], [0.2163, -0.0488], [0.4749, -0.0296], [0.9349, -0.0728], [1, -0.002]];

  const NACA2412 = nacaAirfoil('2412').points;
  /** Report lines on sections moved by an airfoil's own coordinates. */
  const frameText = (r) => texts(r.report).filter((t) => t.startsWith('Airfoil "') && t.includes('in its own coordinates;'));
  /** Report lines on library airfoils whose own coordinates lie far off. */
  const libraryText = (r) => texts(r.report).filter((t) => t.startsWith('Library airfoil "') && t.includes('has its leading edge'));
  /** Warnings on library airfoils whose chord line is inclined. */
  const inclineText = (r) => texts(r.report, 'warning').filter((t) => t.startsWith('Library airfoil "') && t.includes('has its chord line inclined'));

  it("imports the Clark Y wing of fixture A where XFLR5 draws it: the folded rows moved by the Clark Y's own frame", () => {
    // The rows of XFLR5's wing table with the tilt folded in (spec section 6.7).
    const folded = mapSections(FIXTURES.planes[0].wings[0], 1000).sections;
    expectSections(folded, [
      [-0.0366, 0, -2.094, 240, 2],
      [10.8737, 499.3148, 23.8836, 220, 1],
      [47.3222, 897.1235, 65.0587, 150, -0.5],
    ]);
    const r = mapXflr5(FIXTURES);
    // The Clark Y's nose lies 3.5546 % of the chord above its flat lower surface, the file's x axis;
    // the NACA 0009 of the file sits at the origin with unit chord.
    const fr = r.rows[0].frame;
    expect([fr.x, round4(fr.y * 100), fr.chord]).toEqual([0, 3.5546, 1]);
    expect(r.rows[1].frame).toEqual({ x: 0, y: 0, chord: 1 });
    expect(r.project.sections.map(values)).toEqual([
      [0.2612, 0, 6.4318, 240, 2],
      [11.0101, 499.3148, 31.7024, 220, 1],
      [47.3222, 897.1235, 65.0587, 150, -0.5],
    ]);
    // Sections 1 and 2 move by chord · y_LE along the twisted section's normal (sin t, cos t).
    folded.slice(0, 2).forEach((q, i) => {
      const t = q.twist * DEG;
      expect(r.project.sections[i].x).toBeCloseTo(q.x + q.chord * fr.y * Math.sin(t), 3);
      expect(r.project.sections[i].z).toBeCloseTo(q.z + q.chord * fr.y * Math.cos(t), 3);
    });
    expect(frameText(r)).toEqual([
      nb('Airfoil "Clark Y" (sections 1–2) has its leading edge at x = 0 %, y = 3.55 % and its trailing edge at x = 100 % of chord in its own coordinates; these sections were moved so that the airfoil lies as in XFLR5.'),
    ]);
  });

  it('moves the sections of an uploaded .dat with its nose off (0, 0) exactly as the same airfoil inside an .xfl', () => {
    // Coordinates with 6 decimals, which a .dat file holds exactly: the nose 1 % aft and 3 % up, 95 % chord.
    const six = (v) => Number(v.toFixed(6));
    const shifted = NACA2412.map(([x, y]) => [six(0.01 + 0.95 * x), six(0.03 + 0.95 * y)]);
    const w = wingOf([sec(0, 0.2, 0, 2, 3, 'Shifted'), sec(0.5, 0.15, 0.02, 0, -2, 'NACA 0012')], { tilt: 1.5, position: { x: 0.1, y: 0, z: 0.02 } });
    const fromXfl = mapXflr5(xflFile([w, null, null, null], [foilOf('Shifted', shifted), foilOf('NACA 0012', NACA12)]));
    const fr = fromXfl.rows[0].frame;
    // The leading edge of the fitted curve lies slightly ahead of the foremost point, and above it.
    expect(fr.x).toBeCloseTo(0.01, 3);
    expect(fr.chord).toBeCloseTo(0.95, 3);
    expect(fr.y).toBeGreaterThan(0.03);
    const upload = readAirfoilUpload(toSeligDat('Shifted', shifted), 'shifted.dat');
    expect(upload).toMatchObject({ ok: true, frame: fr });
    // The sections are scaled, not the coordinates: the check's note on scaling is left out.
    expect(upload.issues.map((i) => i.code)).not.toContain('not-normalized');
    // The same wing in an XML plane file, which names its airfoils only: the upload moves section 1
    // as the airfoil of the .xfl does; the generated NACA 0012 moves nothing.
    const fromXml = mapXflr5(xmlFile([w, null, null, null], { lengthUnit: 1000, unitName: 'm' }), { uploads: [upload] });
    expect(fromXml.rows.map((row) => [row.key, row.frame])).toEqual([
      ['upload:0', fr],
      ['naca:0012', { x: 0, y: 0, chord: 1 }],
    ]);
    expect(fromXml.project.sections.map(values)).toEqual(fromXfl.project.sections.map(values));
    const mapped = mapSections(w, 1000).sections;
    expect(values(fromXml.project.sections[0])).not.toEqual(values(mapped[0]).map(round4));
    expect(values(fromXml.project.sections[1])).toEqual(values(mapped[1]).map(round4));
    expect(fromXml.project.sections[0].chord).toBeCloseTo(200 * fr.chord, 3);
    // The upload's lines name it with its file name, as the select does.
    expect(frameText(fromXml)).toEqual(frameText(fromXfl).map((t) => t.replace('"Shifted"', '"Shifted (shifted.dat)"')));
    expect(texts(fromXml.report, 'warning')).toEqual([
      expect.stringMatching(
        /^Airfoil "Shifted \(shifted\.dat\)" \(section 1\) has its leading edge at x\u00a0=\u00a00\.99\u00a0%, y\u00a0=\u00a03\.\d\d\u00a0% and its trailing edge at x\u00a0=\u00a096\u00a0% of chord in its own coordinates; this section was moved and scaled so that the airfoil lies as in XFLR5\.$/,
      ),
    ]);
    // A .dat in millimetres is not in chord units: XFLR5 would draw it 150 chords long, so it is not
    // the file XFLR5 used. It is the user's airfoil for the name all the same: used without a frame,
    // scaled to unit chord, with a warning; the section keeps the values of the file.
    const mm = readAirfoilUpload(toSeligDat('Shifted', shifted.map(([x, y]) => [150 * x, 150 * y])), 'mm.dat');
    expect(mm).toMatchObject({ ok: true, frame: { x: 0, y: 0, chord: 1 }, problem: null });
    expect(mm.issues.map((i) => i.code)).not.toContain('not-normalized');
    const unit = mm.issues.find((i) => i.code === 'frame');
    expect(unit).toMatchObject({
      severity: 'warning',
      message: expect.stringMatching(
        /^The coordinates are not in chord units \(leading edge at x\u00a0=\u00a01\.4\d*, y\u00a0=\u00a04\.\d+; trailing edge at x\u00a0=\u00a0144\): XFLR5 cannot have drawn them as they are, so the airfoil is scaled to unit chord and its sections keep the values of the file\.$/,
      ),
    });
    const unframed = mapXflr5(xmlFile([w, null, null, null], { lengthUnit: 1000, unitName: 'm' }), { uploads: [mm] });
    expect(unframed.rows[0]).toMatchObject({ found: 'upload', ok: true, frame: { x: 0, y: 0, chord: 1 } });
    expect(texts(unframed.report, 'warning')).toEqual([`Airfoil "Shifted (mm.dat)" (section 1): ${unit.message}`]);
    expect(frameText(unframed)).toEqual([]);
    expect(unframed.project.sections.map(values)).toEqual(mapped.map((q) => values(q).map(round4)));
  });

  it('takes the frame from the airfoil in use: current-project and library airfoils keep the mapped sections', () => {
    const plain = mapXflr5(FIXTURES);
    const fr = plain.rows[0].frame;
    const folded = mapSections(FIXTURES.planes[0].wings[0], 1000).sections;
    const rows = folded.map((q) => values(q).map(round4));
    // A current-project copy of the stored (normalized) Clark Y and the library Clark Y picked for
    // "Clark Y": their coordinates in XFLR5 are not known, so the sections stay as mapped. A symmetric
    // NACA section has its nose at (0, 0) and its leading edge there too.
    const clark = plain.project.airfoils.find((a) => a.name === 'Clark Y');
    const project = { airfoils: [{ id: 'copy', name: 'Clark Y copy', points: clark.points }] };
    for (const [key, options] of [
      ['project:copy', { project }],
      ['library:clark-y', { library: LIBRARY }],
      ['naca:0012', {}],
    ]) {
      const r = mapXflr5(FIXTURES, { ...options, choices: { 'Clark Y': key } });
      expect(r.rows[0], key).toMatchObject({ picked: true, key, ok: true, frame: { x: 0, y: 0, chord: 1 } });
      expect(r.project.sections.map(values), key).toEqual(rows);
      expect(frameText(r), key).toEqual([]);
    }
    // The library Clark Y has the frame of the file's Clark Y in its own coordinates: the report says
    // how far XFLR5 draws the sections from the table values if it used them.
    const lib = mapXflr5(FIXTURES, { library: LIBRARY, choices: { 'Clark Y': 'library:clark-y' } });
    expect(libraryText(lib)).toEqual([
      nb(
        'Library airfoil "Clark Y" (sections 1–2) has its leading edge at x = 0 %, y = 3.55 % of chord in its own coordinates. If XFLR5 used these coordinates, it draws these sections that far from the table values; upload the .dat file that XFLR5 used to place them as in XFLR5.',
      ),
    ]);
    // The library Clark Y has its chord line 2.00° nose up (from the leading edge of the fitted curve).
    // If XFLR5 used a level copy, as the UIUC "CLARK Y AIRFOIL", the built sections sit that much more
    // nose up: 240 mm · sin(2.00°) = 8.4 mm at the trailing edge of section 1. The check's note on
    // the inclined line is not repeated for it; the file's Clark Y, which XFLR5 drew, keeps it.
    expect(inclineText(lib)).toEqual([
      'Library airfoil "Clark Y" (sections 1–2) has its chord line inclined 2.00° nose up in its own coordinates, and the built sections keep this angle. If the airfoil that XFLR5 used has a level chord line, these sections sit 2.00° more nose up than in XFLR5, the trailing edge 8.4 mm lower at 240 mm chord; upload the .dat file that XFLR5 used to place them as in XFLR5.',
    ]);
    const rotatedNote = (r) => texts(r.report, 'info').filter((t) => t.includes('The line from the leading edge to the trailing edge is inclined'));
    expect(rotatedNote(lib)).toEqual([]);
    expect(rotatedNote(plain)).toEqual(['Airfoil "Clark Y" (sections 1–2): The line from the leading edge to the trailing edge is inclined by -1.97 degrees; the coordinates are kept, so twist refers to the file\'s x axis.']);
    expect(inclineText(plain)).toEqual([]);
    // A cambered NACA section of the generator adds its thickness across the mean line: its leading
    // edge lies 0.16 % of the chord above the nose (0, 0), which XFLR5 puts at the section point.
    const naca = mapXflr5(FIXTURES, { choices: { 'Clark Y': 'naca:2412' } });
    expect(naca.rows[0]).toMatchObject({ key: 'naca:2412', frame: { x: 0, chord: 1 } });
    expect(naca.rows[0].frame.y * 100).toBeCloseTo(0.1558, 3);
    folded.slice(0, 2).forEach((q, i) => {
      const t = q.twist * DEG;
      expect(naca.project.sections[i].x).toBeCloseTo(q.x + q.chord * naca.rows[0].frame.y * Math.sin(t), 3);
      expect(naca.project.sections[i].z).toBeCloseTo(q.z + q.chord * naca.rows[0].frame.y * Math.cos(t), 3);
    });
    expect(naca.project.sections[2]).toMatchObject({ x: rows[2][0], z: rows[2][2] });
    expect(texts(naca.report, 'info')).toContain(
      nb('Airfoil "NACA 2412" (sections 1–2) has its leading edge at x = 0 %, y = 0.16 % and its trailing edge at x = 100 % of chord in its own coordinates; these sections were moved so that the airfoil lies as in XFLR5.'),
    );
    // The generated section is stored as generated.
    expect(naca.project.airfoils.find((a) => a.name === 'NACA 2412').points).toEqual(nacaAirfoil('2412').points);
    // The file's Clark Y picked for "NACA 0009" moves section 3 as well: one line names it with all its sections.
    const both = mapXflr5(FIXTURES, { choices: { 'NACA 0009': 'file:Clark Y' } });
    expect(both.rows[1]).toMatchObject({ key: 'file:Clark Y', frame: fr });
    expect(frameText(both)).toEqual([expect.stringMatching(/^Airfoil "Clark Y" \(sections 1–3\) has its leading edge at x\u00a0=\u00a00\u00a0%, y\u00a0=\u00a03\.55\u00a0%.+; these sections were moved so/)]);
    const t = folded[2].twist * DEG;
    expect(both.project.sections[2].x).toBeCloseTo(folded[2].x + 150 * fr.y * Math.sin(t), 3);
    expect(both.project.sections[2].z).toBeCloseTo(folded[2].z + 150 * fr.y * Math.cos(t), 3);
    // The file's NACA 0009 picked for "Clark Y" sits at the origin: nothing moves, no line names the Clark Y.
    const none = mapXflr5(FIXTURES, { choices: { 'Clark Y': 'file:NACA 0009' } });
    expect(none.project.sections.map(values)).toEqual(rows);
    expect(frameText(none)).toEqual([]);
    // An upload of the same coordinates picked for "NACA 0009": the line names the uploaded airfoil.
    const upload = readAirfoilUpload(toSeligDat('My Clark', FIXTURES.foils.get('Clark Y').points), 'my-clark.dat');
    const up = mapXflr5(FIXTURES, { uploads: [upload], choices: { 'NACA 0009': 'upload:0' } });
    expect(up.rows[1]).toMatchObject({ key: 'upload:0', frame: fr });
    expect(up.project.sections.map(values)).toEqual(both.project.sections.map(values));
    expect(frameText(up)).toEqual([
      expect.stringMatching(/^Airfoil "Clark Y" \(sections 1–2\) has .+; these sections were moved so/),
      expect.stringMatching(/^Airfoil "My Clark \(my-clark\.dat\)" \(section 3\) has its leading edge at x\u00a0=\u00a00\u00a0%, y\u00a0=\u00a03\.55\u00a0%.+; this section was moved so that the airfoil lies as in XFLR5\.$/),
    ]);
    // XML files name their airfoils only: from the library, and on a second import from the project of
    // the first, the sections keep the mapped values.
    const f = xml('xml_mm/0.plane.xml');
    const geometry = mapSections(f.planes[0].wings[0], 1).sections.map((q) => values(q).map(round4));
    const first = mapXflr5(f, { library: LIBRARY });
    expect(first.rows[0]).toMatchObject({ found: 'library', frame: { x: 0, y: 0, chord: 1 } });
    expect(first.project.sections.map(values)).toEqual(geometry);
    const again = mapXflr5(f, { library: LIBRARY, project: first.project });
    expect(again.rows[0].found).toBe('project');
    expect(again.project.sections.map(values)).toEqual(geometry);
    expect(frameText(first)).toEqual([]);
    // The report says that the library Clark Y lies 3.55 % of the chord off in its own coordinates,
    // and that the .dat file XFLR5 used would place the sections as in XFLR5; so does the project
    // airfoil taken from it (source kind 'library', the same points).
    expect(libraryText(first)).toEqual([expect.stringMatching(/^Library airfoil "Clark Y" \(sections 1–2\) has its leading edge at x\u00a0=\u00a00\u00a0%, y\u00a0=\u00a03\.55\u00a0% of chord/)]);
    expect(first.project.airfoils[0].source).toMatchObject({ kind: 'library', id: 'clark-y' });
    expect(libraryText(again)).toEqual(libraryText(first));
    expect(inclineText(first)).toHaveLength(1);
    expect(inclineText(again)).toEqual(inclineText(first));
    // A chord that is no number has its own error; the warning takes the largest chord that is one.
    const garbled = mapXflr5(xmlFile([wingOf([sec(0, NaN, 0, 0, 0, 'Clark Y'), sec(500, 200, 0, 0, 0, 'Clark Y')]), null, null, null]), { library: LIBRARY });
    expect(inclineText(garbled)).toEqual([expect.stringContaining('the trailing edge 7.0 mm lower at 200 mm chord')]);
    expect(texts(garbled.report).filter((t) => t.includes('NaN'))).toEqual([]);
    expect(garbled.errors).toBeGreaterThan(0);
    // An upload of the file's Clark Y gives the wing of the .xfl project.
    const clarkDat = readAirfoilUpload(toSeligDat('Clark Y', FIXTURES.foils.get('Clark Y').points), 'clarky.dat');
    const fromDat = mapXflr5(f, { uploads: [clarkDat] });
    expect(fromDat.rows[0]).toMatchObject({ found: 'upload', frame: fr });
    expect(fromDat.project.sections.map(values)).toEqual(plain.project.sections.map(values));
  });

  it('refuses a file airfoil that is not in chord units, and runs the chain for its name', () => {
    const w = wingOf([sec(0, 0.2, 0, 0, 0, 'NACA 0012'), sec(0.5, 0.15, 0, 0, 0, 'NACA 0012')]);
    // Coordinates in millimetres of a 150 mm chord.
    const f = xflFile([w, null, null, null], [foilOf('NACA 0012', NACA12.map(([x, y]) => [150 * x, 150 * y]))]);
    const r = mapXflr5(f);
    expect(r.rows[0]).toMatchObject({ found: 'naca', ok: true, frame: { x: 0, y: 0, chord: 1 } });
    const problem = nb('The coordinates are not in chord units (leading edge at x = 0, y = 0; trailing edge at x = 150).');
    expect(texts(r.report, 'warning')).toEqual([`Airfoil "NACA 0012" from the file fails the check: ${problem} "NACA 0012" is used instead.`]);
    expect(values(r.project.sections[0])).toEqual([0, 0, 0, 200, 0]);
    const picked = mapXflr5(f, { choices: { 'NACA 0012': 'file:NACA 0012' } });
    expect(picked.project).toBeNull();
    expect(texts(picked.report, 'error')).toEqual([`Airfoil "NACA 0012" (sections 1–2): the chosen airfoil fails the check: ${problem}`]);
    // The error comes first in the airfoil's check list, without the note on scaling to unit chord.
    expect(picked.rows[0].issues[0]).toMatchObject({ severity: 'error', code: 'frame', message: problem });
    expect(picked.rows[0].issues.map((i) => i.code)).not.toContain('not-normalized');
    // A leading edge far off the chord line, and a chord of less than half.
    for (const pts of [NACA12.map(([x, y]) => [x, y + 0.2]), NACA12.map(([x, y]) => [0.4 * x, 0.4 * y])]) {
      const odd = mapXflr5(xflFile([wingOf([sec(0, 0.2, 0, 0, 0, 'Odd'), sec(0.5, 0.15, 0, 0, 0, 'Odd')]), null, null, null], [foilOf('Odd', pts)]));
      expect(odd.rows[0]).toMatchObject({ found: 'missing', ok: false });
      expect(texts(odd.report, 'error')).toEqual([expect.stringMatching(/^Airfoil "Odd" \(sections 1–2\) from the file fails the check: The coordinates are not in chord units/)]);
    }
  });

  it('gives a cambered NACA section of the generator the frame of its generated coordinates, as an .xfl holding them', () => {
    // XFLR5 draws the nose (0, 0) of a NACA section at the section point. The generator adds the
    // thickness across the mean line: its leading edge lies ahead of and above the nose.
    const NACA4415 = nacaAirfoil('4415').points;
    const w = wingOf([sec(0, 0.3, 0, 2, 3, 'NACA 4415'), sec(0.5, 0.2, 0.02, 0, -1, 'NACA 4415')], { tilt: 1, position: { x: 0.05, y: 0, z: 0.01 } });
    const fromXfl = mapXflr5(xflFile([w, null, null, null], [foilOf('NACA 4415', NACA4415)]));
    const fromXml = mapXflr5(xmlFile([w, null, null, null], { lengthUnit: 1000, unitName: 'm' }));
    expect(fromXml.rows[0]).toMatchObject({ found: 'naca', key: 'naca:4415' });
    const fr = fromXml.rows[0].frame;
    expect(fr).toEqual(fromXfl.rows[0].frame);
    expect(fr.y * 100).toBeCloseTo(0.47, 2);
    expect(fromXml.project.sections.map(values)).toEqual(fromXfl.project.sections.map(values));
    // The nose (0, 0) of the generated points, which the build puts at (-lx, -ly) / cT of its unit
    // chord, lies where XFLR5 puts the nose of the mapped section, twisted about the quarter chord.
    const mapped = mapSections(w, 1000).sections;
    mapped.forEach((q, i) => {
      const s = fromXml.project.sections[i];
      const [nose] = placeSection([[-fr.x / fr.chord, -fr.y / fr.chord]], { xLE: s.x, y: s.y, z: s.z, chord: s.chord, twist: s.twist }, 0.25);
      const [xflr5] = placeSection([[0, 0]], { xLE: q.x, y: q.y, z: q.z, chord: q.chord, twist: q.twist }, 0.25);
      for (let k = 0; k < 3; k++) expect(nose[k]).toBeCloseTo(xflr5[k], 3);
    });
    expect(frameText(fromXml)).toEqual([
      nb(`Airfoil "NACA 4415" (sections 1–2) has its leading edge at x = ${Number((fr.x * 100).toFixed(2)) + 0} %, y = 0.47 % and its trailing edge at x = 100 % of chord in its own coordinates; these sections were moved so that the airfoil lies as in XFLR5.`),
    ]);
    // Symmetric sections sit at the origin: no move, no line.
    const sym = mapXflr5(simple('NACA 0015'));
    expect(sym.rows[0].frame).toEqual({ x: 0, y: 0, chord: 1 });
    expect(frameText(sym)).toEqual([]);
  });

  it('gives a current-project section generated from the NACA equations the frame of the generated section of its code, as with no project open', () => {
    // The sample wing (and the wizard) store NACA 2412 as generated: the same file gives the same wing
    // with it open as with no project.
    const f = readXflr5Xml(readFileSync(new URL('fixtures/xflr5/xml_mm/0.plane.xml', import.meta.url), 'utf8').replaceAll('NACA 0009', 'NACA 2412'));
    const choices = { 'Clark Y': 'naca:0012' };
    const alone = mapXflr5(f, { choices });
    const sample = defaultProject();
    const withSample = mapXflr5(f, { choices, project: sample });
    expect(alone.rows[1]).toMatchObject({ found: 'naca', key: 'naca:2412' });
    expect(withSample.rows[1]).toMatchObject({ found: 'project', key: `project:${sample.airfoils[0].id}` });
    expect(withSample.rows[1].frame).toEqual(alone.rows[1].frame);
    expect(alone.rows[1].frame.y * 100).toBeCloseTo(0.1558, 3);
    expect(withSample.project.sections.map(values)).toEqual(alone.project.sections.map(values));
    const line = /^Airfoil "NACA 2412" \(section 3\) has its leading edge at x\u00a0=\u00a00\u00a0%, y\u00a0=\u00a00\.16\u00a0% and its trailing edge/;
    expect(frameText(alone)).toEqual([expect.stringMatching(line)]);
    expect(frameText(withSample)).toEqual([expect.stringMatching(line)]);
    // A current-project airfoil of another source keeps the mapped sections, with the same points.
    const copy = { airfoils: [{ ...sample.airfoils[0], id: 'copy', source: { kind: 'upload', file: 'naca2412.dat' } }] };
    const other = mapXflr5(f, { choices, project: copy });
    expect(other.rows[1]).toMatchObject({ found: 'project', key: 'project:copy', frame: { x: 0, y: 0, chord: 1 } });
    expect(frameText(other)).toEqual([]);
    // NACA metadata with other points (a hand-edited project file) is not trusted: no frame.
    const edited = { airfoils: [{ id: 'edited', name: 'NACA 2412', points: nacaAirfoil('4412').points, source: nacaEntry('2412').source }] };
    expect(mapXflr5(f, { choices, project: edited }).rows[1]).toMatchObject({ found: 'project', key: 'project:edited', frame: { x: 0, y: 0, chord: 1 } });
    // The Airfoils tab (NACA generator, Library presets) stores the checked points, which no longer
    // show the frame: the section gets the frame of the generated section of its code all the same.
    const f4412 = readXflr5Xml(readFileSync(new URL('fixtures/xflr5/xml_mm/0.plane.xml', import.meta.url), 'utf8').replaceAll('NACA 0009', 'NACA 4412'));
    const generated = nacaEntry('4412');
    const tab = { airfoils: [{ id: 'tab', name: 'NACA 4412', points: checkAirfoil(generated.points).points, source: generated.source }] };
    const none4412 = mapXflr5(f4412, { choices });
    const tab4412 = mapXflr5(f4412, { choices, project: tab });
    expect(tab4412.rows[1]).toMatchObject({ found: 'project', key: 'project:tab', frame: none4412.rows[1].frame });
    expect(none4412.rows[1].frame.y * 100).toBeCloseTo(0.304, 3);
    expect(tab4412.project.sections.map(values)).toEqual(none4412.project.sections.map(values));
    const line4412 = /^Airfoil "NACA 4412" \(section 3\) has its leading edge at x\u00a0=\u00a00\u00a0%, y\u00a0=\u00a00\.3\u00a0% and its trailing edge/;
    expect(frameText(none4412)).toEqual([expect.stringMatching(line4412)]);
    expect(frameText(tab4412)).toEqual([expect.stringMatching(line4412)]);
  });

  it('says so when a current-project airfoil of an XFLR5 import or an upload keeps the table values', () => {
    // The project of an .xfl import stores its airfoils at unit chord, and their own coordinates are
    // lost: the XML of the same plane, opened with that project, keeps the table values, as with the
    // library Clark Y, and the report says so for each such airfoil.
    const f = xml('xml_mm/0.plane.xml');
    const imported = mapXflr5(FIXTURES, { fileName: 'fixtures_v662.xfl' }).project;
    expect(imported.airfoils.map((a) => a.source.kind)).toEqual(['xflr5', 'xflr5']);
    const alone = mapXflr5(f, { library: LIBRARY });
    const withImport = mapXflr5(f, { library: LIBRARY, project: imported });
    expect(withImport.rows.map((r) => r.found)).toEqual(['project', 'project']);
    expect(withImport.project.sections.map(values)).toEqual(alone.project.sections.map(values));
    const stored = (r) => texts(r.report, 'info').filter((t) => t.includes('of the current project is stored'));
    const line = (name, sections) =>
      `Airfoil "${name}" (${sections}) of the current project is stored scaled to unit chord, with its leading edge at (0, 0), so these sections keep the table values. If the coordinates that XFLR5 used put the leading edge elsewhere, XFLR5 draws these sections that far from the table values; upload the .dat file that XFLR5 used to place them as in XFLR5.`;
    expect(stored(withImport)).toEqual([line('Clark Y', 'sections 1–2'), line('NACA 0009', 'section 3')]);
    expect(stored(alone)).toEqual([]);
    // An airfoil uploaded in the Airfoils tab (source kind 'upload'), picked, too.
    const tabUpload = { airfoils: [{ id: 'up', name: 'My Clark', points: imported.airfoils[0].points, source: { kind: 'upload', file: 'my-clark.dat' } }] };
    const picked = mapXflr5(f, { project: tabUpload, choices: { 'Clark Y': 'project:up' } });
    expect(stored(picked)).toEqual([line('My Clark', 'sections 1–2')]);
    // The .xfl project itself uses its own airfoils first: no such line.
    expect(stored(mapXflr5(FIXTURES, { project: imported }))).toEqual([]);
    // A current-project airfoil taken from the Library gets the line of the library entry, also when
    // the library entries have not been checked before.
    const fromLibrary = alone.project;
    expect(fromLibrary.airfoils[0].source).toMatchObject({ kind: 'library', id: 'clark-y' });
    const withLibrary = mapXflr5(f, { library: LIBRARY.map((e) => ({ ...e })), project: fromLibrary });
    expect(withLibrary.rows[0]).toMatchObject({ found: 'project', frame: { x: 0, y: 0, chord: 1 } });
    expect(texts(withLibrary.report, 'info').filter((t) => t.startsWith('Library airfoil "Clark Y" (sections 1–2)'))).toHaveLength(1);
    expect(stored(withLibrary)).toEqual([]);
    // A NACA airfoil of the project whose name holds no designation and whose source no code (a
    // renamed sample-wing airfoil): no frame, no line.
    const renamed = { airfoils: [{ id: 'renamed', name: 'Clark Y', points: nacaAirfoil('2412').points, source: { kind: 'naca', note: 'Generated.' } }] };
    const r = mapXflr5(f, { project: renamed });
    expect(r.rows[0]).toMatchObject({ found: 'project', key: 'project:renamed', frame: { x: 0, y: 0, chord: 1 } });
    expect(stored(r)).toEqual([]);
  });

  it('ignores the offset of a fitted leading edge from a nose point at (0, 0)', () => {
    // RAF 34 has its nose point at (0, 0); the leading edge of the fitted curve lies about 5e-4 of the
    // chord from it, within FRAME_TOLERANCE.
    const raf = readFileSync(new URL('../public/airfoils/raf-34.dat', import.meta.url), 'utf8');
    const u = readAirfoilUpload(raf, 'raf-34.dat');
    expect(u).toMatchObject({ ok: true, frame: { x: 0, y: 0, chord: 1 } });
    const r = mapXflr5(simple('NACA 0009'), { uploads: [u], choices: { 'NACA 0009': 'upload:0' } });
    expect(frameText(r)).toEqual([]);
    expect(values(r.project.sections[0])).toEqual([0, 0, 0, 200, 0]);
    expect(FRAME_TOLERANCE).toBe(1e-3);
  });

  it('quotes the numbers of the file when the parser took them for percent of chord', () => {
    const NACA9 = nacaAirfoil('0009').points;
    // Millimetres of an 80 mm chord: the parser divides by 100 and gets a chord of 0.8.
    const mm80 = NACA9.map(([x, y]) => [80 * x, 80 * y]);
    const u = readAirfoilUpload(toSeligDat('MM80', mm80), 'mm80.dat');
    expect(u).toMatchObject({ ok: true, frame: { x: 0, y: 0, chord: 1 } });
    const unit = nb('The coordinates are not in chord units (leading edge at x = 0, y = 0; trailing edge at x = 80): XFLR5 cannot have drawn them as they are, so the airfoil is scaled to unit chord and its sections keep the values of the file.');
    expect(u.issues.filter((i) => i.severity !== 'info')).toEqual([{ severity: 'warning', code: 'frame', message: unit }]);
    const r = mapXflr5(xml('xml_mm/0.plane.xml'), { uploads: [u], choices: { 'Clark Y': 'upload:0' } });
    expect(r.project.sections.map((q) => q.chord)).toEqual([240, 220, 150]);
    expect(texts(r.report, 'warning')).toContain(`Airfoil "MM80 (mm80.dat)" (sections 1–2): ${unit}`);
    // In an .xfl project, XFLR5 draws it 80 chords long: not usable. A 40 mm file quotes 40.
    for (const k of [80, 40]) {
      const f = xflFile([wingOf([sec(0, 0.2, 0, 0, 0, 'MM'), sec(0.5, 0.15, 0, 0, 0, 'MM')]), null, null, null], [foilOf('MM', NACA9.map(([x, y]) => [k * x, k * y]))]);
      const m = mapXflr5(f);
      expect(m.rows[0]).toMatchObject({ found: 'missing', ok: false });
      expect(texts(m.report, 'error')).toEqual([
        nb(`Airfoil "MM" (sections 1–2) from the file fails the check: The coordinates are not in chord units (leading edge at x = 0, y = 0; trailing edge at x = ${k}). Upload a .dat file or pick an airfoil.`),
      ]);
    }
    // A true percent file ends at x = 100, chord 1 after the division: it keeps its frame.
    const clark = FIXTURES.foils.get('Clark Y').points;
    const unitDat = readAirfoilUpload(toSeligDat('Clark Y', clark), 'clarky.dat');
    const percentDat = readAirfoilUpload(toSeligDat('Clark Y', clark.map(([x, y]) => [100 * x, 100 * y])), 'clarky-pct.dat');
    expect(percentDat.issues.map((i) => i.code)).toContain('percent');
    expect(percentDat.frame.x).toBe(0);
    expect(percentDat.frame.chord).toBe(1);
    expect(percentDat.frame.y).toBeCloseTo(unitDat.frame.y, 6);
  });

  it('quotes absurd coordinates and chords in a bounded form', () => {
    const w = wingOf([sec(0, 0.2, 0, 0, 0, 'Odd'), sec(0.5, 0.15, 0, 0, 0, 'Odd')]);
    const problem = (pts) => mapXflr5(xflFile([w, null, null, null], [foilOf('Odd', pts)])).rows[0];
    const huge = mapXflr5(xflFile([w, null, null, null], [foilOf('Odd', NACA12.map(([x, y]) => [1e300 * x, 1e300 * y]))]));
    // The leading edge of the fitted curve lies about 1e-4 chords off the nose point: 1e296 here.
    expect(texts(huge.report, 'error')).toEqual([
      'Airfoil "Odd" (sections 1–2) from the file fails the check: The coordinates are not in chord units (leading edge at x\u00a0=\u00a0beyond ±1000000, y\u00a0=\u00a0beyond ±1000000; trailing edge at x\u00a0=\u00a0beyond ±1000000). Upload a .dat file or pick an airfoil.',
    ]);
    expect(problem(NACA12.map(([x, y]) => [1e-6 * x, 1e-6 * y]))).toMatchObject({ ok: false });
    expect(texts(mapXflr5(xflFile([w, null, null, null], [foilOf('Odd', NACA12.map(([x, y]) => [1e-6 * x, 1e-6 * y]))])).report, 'error')[0]).toContain('trailing edge at x\u00a0=\u00a00.000001)');
    // A chord of 1e308 m, a valid number in the file, overflows in mm.
    const long = mapSections(wingOf([sec(0, 1e308), sec(0.5, 0.15)]), 1000);
    expect(texts(long.report, 'error')).toEqual(['Section 1: the chord lies beyond 100000 mm, the limit of Wingdesigner.']);
    setLanguage('de');
    expect(texts(mapSections(wingOf([sec(0, 1e308), sec(0.5, 0.15)]), 1000).report, 'error')).toEqual(['Schnitt 1: Die Profiltiefe liegt über 100.000 mm, der Grenze von Wingdesigner.']);
    expect(texts(mapXflr5(xflFile([w, null, null, null], [foilOf('Odd', NACA12.map(([x, y]) => [1e300 * x, 1e300 * y]))])).report, 'error')[0]).toContain('Endleiste bei x\u00a0=\u00a0jenseits von ±1.000.000)');
  });

  it('names an upload in its report lines as the select does, once per airfoil in use', () => {
    // The file's Clark Y as a .dat, picked for "NACA 0009" of the XML plane: every line on it names
    // the upload and all its sections; none says that NACA 0009 is inclined.
    const clark = readAirfoilUpload(toSeligDat('Clark Y', FIXTURES.foils.get('Clark Y').points), 'clarky.dat');
    const r = mapXflr5(xml('xml_mm/0.plane.xml'), { uploads: [clark], choices: { 'NACA 0009': 'upload:0' } });
    const lines = texts(r.report).filter((t) => t.includes('Clark Y') || t.includes('NACA 0009'));
    expect(lines).toEqual([
      nb('Airfoil "Clark Y (clarky.dat)" (sections 1–3) has its leading edge at x = 0 %, y = 3.55 % and its trailing edge at x = 100 % of chord in its own coordinates; these sections were moved so that the airfoil lies as in XFLR5.'),
      expect.stringMatching(/^Airfoil "Clark Y \(clarky\.dat\)" \(sections 1–3\): The line from the leading edge to the trailing edge is inclined by -1\.97 degrees/),
    ]);
    // NACA 0009 raised by 2 % of the chord, for the tip only: one section moved, not scaled.
    const raised = readAirfoilUpload(toSeligDat('NACA 0009 raised', nacaAirfoil('0009').points.map(([x, y]) => [x, y + 0.02])), 'naca0009-up2.dat');
    const tip = mapXflr5(FIXTURES, { uploads: [raised], choices: { 'NACA 0009': 'upload:0' } });
    expect(frameText(tip)[1]).toBe(
      nb('Airfoil "NACA 0009 raised (naca0009-up2.dat)" (section 3) has its leading edge at x = 0 %, y = 2 % and its trailing edge at x = 100 % of chord in its own coordinates; this section was moved so that the airfoil lies as in XFLR5.'),
    );
    setLanguage('de');
    expect(frameText(mapXflr5(FIXTURES, { uploads: [raised], choices: { 'NACA 0009': 'upload:0' } }))).toEqual([]);
    expect(texts(mapXflr5(FIXTURES, { uploads: [raised], choices: { 'NACA 0009': 'upload:0' } }).report)).toContain(
      nb('Profil „NACA 0009 raised (naca0009-up2.dat)“ (Schnitt 3) hat in seinen eigenen Koordinaten die Profilnase bei x = 0 %, y = 2 % und die Endleiste bei x = 100 % der Profiltiefe; dieser Schnitt wurde so verschoben, dass das Profil wie in XFLR5 liegt.'),
    );
  });

  it('refuses a chord that the frame scales beyond the limit', () => {
    const w = wingOf([sec(0, 60, 0, 0, 0, 'Long'), sec(0.5, 0.15, 0, 0, 0, 'NACA 0012')]);
    const r = mapXflr5(xflFile([w, null, null, null], [foilOf('Long', NACA12.map(([x, y]) => [1.8 * x, 1.8 * y])), foilOf('NACA 0012', NACA12)]));
    expect(r.project).toBeNull();
    expect(texts(r.report, 'error')).toEqual(['Section 1: chord 108000 mm is larger than 100000 mm, the limit of Wingdesigner.']);
  });

  it('checks the fitted curve of every airfoil, as the Airfoils tab does', () => {
    const w = wingOf([sec(0, 0.2, 0, 0, 0, 'Coarse'), sec(0.5, 0.15, 0, 0, 0, 'Coarse')]);
    const r = mapXflr5(xflFile([w, null, null, null], [foilOf('Coarse', coarse)]));
    expect(r.rows[0]).toMatchObject({ found: 'missing', ok: false, frame: { x: 0, y: 0, chord: 1 } });
    expect(r.project).toBeNull();
    expect(texts(r.report, 'error')).toEqual([expect.stringMatching(/^Airfoil "Coarse" \(sections 1–2\) from the file fails the check: The NURBS curve through the points crosses itself near x = 10\d\.\d % chord/)]);
    const upload = readAirfoilUpload(toSeligDat('Coarse', coarse), 'coarse.dat');
    expect(upload).toMatchObject({ ok: false, problem: expect.stringMatching(/^The NURBS curve through the points crosses itself/) });
    expect(upload.issues.at(-1)).toMatchObject({ severity: 'error', code: 'curve-shape' });
    const u = mapXflr5(simple('Coarse'), { uploads: [upload] });
    expect(u.rows[0].found).toBe('missing');
    // The shared fit: a curve with a shape error is kept for drawing; a failed fit has none.
    expect(fitProfile(checkAirfoil(coarse).points, 'centripetal')).toMatchObject({ prof: { curve: expect.any(Object) }, issue: { severity: 'error', code: 'curve-shape' } });
    expect(fitProfile([[1, 0]], 'centripetal')).toEqual({
      prof: null,
      issue: { severity: 'error', code: 'curve-shape', message: expect.stringMatching(/^The NURBS interpolation through the points failed \(.+\)\.$/) },
    });
    expect(fitProfile(NACA12, 'centripetal')).toMatchObject({ prof: { tLE: expect.any(Number) }, issue: null });
  });

  it('stops before resolving airfoils beyond the limits of a project', () => {
    const n = LIMITS.maxAirfoils + 1;
    const w = wingOf(Array.from({ length: n }, (_, i) => sec(i, 100, 0, 0, 0, `NACA 00${10 + (i % 10)} ${i}`)));
    const t0 = performance.now();
    const r = mapXflr5(xmlFile([w, null, null, null]), { library: LIBRARY });
    expect(performance.now() - t0).toBeLessThan(3000);
    expect(r.rows).toHaveLength(n);
    expect(r.rows.every((row) => row.found === 'missing' && !row.ok && row.naca === null && row.airfoil === null)).toBe(true);
    const limit = 'The airfoils of this wing exceed the limits of a project (10,000 airfoils, 1,000,000 points together).';
    expect(texts(r.report, 'error')).toEqual([limit]);
    expect(r.missing).toBe(n);
    // Points of the file airfoils together.
    const big = Array.from({ length: 100_000 }, (_, i) => [Math.abs(1 - i / 5e4), 0]);
    const k = LIMITS.maxAirfoilPoints / big.length + 1;
    const many = xflFile([wingOf(Array.from({ length: k }, (_, i) => sec(i * 0.01, 0.1, 0, 0, 0, `F${i}`))), null, null, null], Array.from({ length: k }, (_, i) => foilOf(`F${i}`, big)));
    expect(texts(mapXflr5(many).report, 'error')).toEqual([limit]);
    // Names the user gave another airfoil do not count with the file's own: a NACA section for every
    // name makes a project of one airfoil.
    const choices = Object.fromEntries(Array.from({ length: k }, (_, i) => [`F${i}`, 'naca:0012']));
    const chosen = mapXflr5(many, { choices });
    expect(texts(chosen.report, 'error')).toEqual([]);
    expect(chosen.project.airfoils.map((a) => a.name)).toEqual(['NACA 0012']);
    // The project itself stays within the limits: the file's airfoils picked back are refused.
    const back = mapXflr5(many, { choices: { ...choices, F0: 'file:F0' } });
    expect(back.project).toBeNull();
  });

  it('builds the airfoils of 10,000 names in linear time, and shares equal airfoils', () => {
    const u = readAirfoilUpload(toSeligDat('U', nacaAirfoil('0012', { pointsPerSide: 12 }).points), 'u.dat');
    const n = LIMITS.maxAirfoils;
    const uploads = Array.from({ length: n }, (_, i) => ({ ...u, name: `U${i}`, fileName: `U${i}.dat` }));
    const f = xmlFile([wingOf(Array.from({ length: n }, (_, i) => sec(10 * i, 100, 0, 0, 0, `U${i}`))), null, null, null]);
    const t0 = performance.now();
    const r = mapXflr5(f, { uploads });
    expect(performance.now() - t0).toBeLessThan(2000);
    expect(r.project.airfoils).toHaveLength(n);
    expect(new Set(r.project.airfoils.map((a) => a.id)).size).toBe(n);
    // Different sources with the same name and points give one airfoil, as addAirfoil does.
    const clark = mapXflr5(FIXTURES).project.airfoils.find((a) => a.name === 'Clark Y');
    const same = mapXflr5(FIXTURES, { project: { airfoils: [{ id: 'c', name: 'Clark Y', points: clark.points }] }, choices: { 'NACA 0009': 'project:c' } });
    expect(same.rows.map((row) => row.key)).toEqual(['file:Clark Y', 'project:c']);
    expect(same.project.airfoils.map((a) => a.id)).toEqual(['clark-y']);
    expect(same.project.sections.map((s) => s.airfoil)).toEqual(['clark-y', 'clark-y', 'clark-y']);
    // Equal names with other points get their own ids.
    const other = mapXflr5(FIXTURES, { project: { airfoils: [{ id: 'c', name: 'Clark Y', points: NACA12 }] }, choices: { 'NACA 0009': 'project:c' } });
    expect(other.project.airfoils.map((a) => a.id)).toEqual(['clark-y', 'clark-y-2']);
  });

  it('runs the airfoil checks of the first mapping step by step', () => {
    expect([...checkSteps(FIXTURES)]).toEqual([
      { done: 1, total: 2 },
      { done: 2, total: 2 },
    ]);
    expect([...checkSteps(FIXTURES, { surface: 'stab' })]).toEqual([{ done: 1, total: 1 }]);
    // Plane "Fixture B" has no stabilizer; a wing beyond the limits of a project is not checked.
    expect([...checkSteps(FIXTURES, { plane: 1, surface: 'stab' })]).toEqual([]);
    const n = LIMITS.maxAirfoils + 1;
    expect([...checkSteps(xmlFile([wingOf(Array.from({ length: n }, (_, i) => sec(i, 100, 0, 0, 0, `A${i}`))), null, null, null]))]).toEqual([]);
    // The steps resolve the names as the mapping does (an XML name to its NACA section).
    const f = simple('NACA 4415');
    expect([...checkSteps(f)]).toEqual([{ done: 1, total: 1 }]);
    expect(mapXflr5(f).rows[0]).toMatchObject({ found: 'naca', ok: true });
  });

  it('names the automatic candidate that fails the check', () => {
    // The generated NACA 5128 runs back in x near 12 % of the chord.
    const r = mapXflr5(simple('NACA 5128'));
    expect(r.rows[0]).toMatchObject({ found: 'missing', ok: false });
    expect(texts(r.report, 'error')).toEqual([
      expect.stringMatching(/^Airfoil "NACA 5128" \(sections 1–2\): the matching airfoil \(NACA generator: NACA 5128\) fails the check: The surface runs back in x by .+ Upload a \.dat file or pick an airfoil\.$/),
    ]);
    // An upload matched by name that fails, then a library entry that passes: the library entry is used.
    const bad = { ...readAirfoilUpload(toSeligDat('Clark Y', NACA12), 'clark.dat'), ok: false, problem: 'Broken.' };
    expect(mapXflr5(simple('Clark Y'), { uploads: [bad], library: LIBRARY }).rows[0]).toMatchObject({ found: 'library', ok: true });
    const project = { airfoils: [{ id: 'bad', name: 'Mine', points: [[1, 0], [0, 0], [1, 0.1], [0.5, 0], [1, -0.1]] }] };
    const mine = mapXflr5(simple('Mine'), { project });
    expect(texts(mine.report, 'error')).toEqual([expect.stringMatching(/^Airfoil "Mine" \(sections 1–2\): the matching airfoil \(Current project: Mine\) fails the check: /)]);
    setLanguage('de');
    expect(texts(mapXflr5(simple('NACA 5128')).report, 'error')).toEqual([
      expect.stringMatching(/^Profil „NACA 5128“ \(Schnitte 1–2\): Das passende Profil \(NACA-Generator: NACA 5128\) besteht die Prüfung nicht: .+ Eine \.dat-Datei hochladen oder ein Profil wählen\.$/),
    ]);
  });

  it('offers the NACA section that starts a name, and reads long names in linear time', () => {
    expect(mapXflr5(simple('NACA0014_Flap')).rows[0]).toMatchObject({ found: 'missing', naca: { key: 'naca:0014', label: 'NACA generator: NACA 0014' } });
    expect(mapXflr5(simple('naca 2412 (flap)')).rows[0].naca.key).toBe('naca:2412');
    for (const name of ['Clark Y', 'NACA 00123', 'NACA001234']) expect(mapXflr5(simple(name)).rows[0].naca).toBeNull();
    const t0 = performance.now();
    const r = mapXflr5(simple(`naca${' '.repeat(200_000)}x`));
    expect(r.rows[0]).toMatchObject({ found: 'missing', naca: null });
    expect(performance.now() - t0).toBeLessThan(2000);
  });
});

describe('XFLR5 mapping: project and report', () => {
  it('creates a valid project with the settings of an XFLR5 wing', () => {
    const r = mapXflr5(FIXTURES, { fileName: 'fixtures_v662.xfl' });
    expect(r.errors).toBe(0);
    expect(r.name).toBe('Fixture A Main Wing');
    const p = r.project;
    expect(p.name).toBe('Fixture A Main Wing');
    expect(validateProject(p)).toEqual({ ok: true, errors: [] });
    expect(p.settings).toMatchObject({ twistPivot: 0.25, spanwise: 'straight', mirror: true, tip: { mode: 'flat' }, trailingEdge: { mode: 'asis' } });
    expect(p.guides.nose.enabled).toBe(false);
    expect(p.guides.end.enabled).toBe(false);
    expect(p.guides.nose.points).toEqual(p.sections.map((s) => [s.x, s.y]));
    expect(p.sections.map((s) => s.id)).toEqual(['s1', 's2', 's3']);
    expect(r.summary).toBe('Imported the main wing "Main Wing" of "Fixture A" from fixtures_v662.xfl: 3 sections, 2 airfoils.');
    expect(texts(r.report, 'info')).toEqual([
      'XFLR5 measures y_position along the panels; y and z were computed from it and the dihedral.',
      'Tilt angle 2° applied as in the XFLR5 plane: the sections are rotated about the wing origin, and every twist includes it.',
      expect.stringMatching(/^Airfoil "Clark Y" \(sections 1–2\): The line from the leading edge to the trailing edge is inclined by -1\.97 degrees/),
      'Not imported: the horizontal stabilizer "Elevator", the fin "Fin". One surface per import; open the file again for another one.',
      'Not used: VLM panel counts and distributions, colours, masses, the body and the analyses.',
      'The trailing edge is built as in the airfoils; Settings > Trailing edge can close it or give it a thickness.',
    ]);
    const stab = mapXflr5(FIXTURES, { surface: 'stab', fileName: 'fixtures_v662.xfl' });
    expect(stab.summary).toBe('Imported the horizontal stabilizer "Elevator" of "Fixture A" from fixtures_v662.xfl: 2 sections, 1 airfoil.');
    expectSections(stab.project.sections, [
      [649.9906, 0, 40.7199, 110, -1.5],
      [674.9854, 230, 41.1125, 70, -1.5],
    ]);
    expect(texts(stab.report, 'info')).toContain('Not imported: the main wing "Main Wing", the fin "Fin". One surface per import; open the file again for another one.');
  });

  it('survives a JSON round trip', () => {
    for (const surface of ['main', 'stab']) {
      const p = mapXflr5(FIXTURES, { surface, fileName: 'fixtures_v662.xfl' }).project;
      const back = projectFromJsonText(projectToJsonText(p, null));
      expect(back.ok).toBe(true);
      // Open marks guides without the flag as not edited.
      const expected = structuredClone(p);
      for (const g of Object.values(expected.guides)) g.edited = false;
      expect(back.project).toEqual(expected);
    }
    const lib = mapXflr5(simple('Clark Y'), { library: LIBRARY }).project;
    expect(projectFromJsonText(projectToJsonText(lib, null)).project.airfoils).toEqual(JSON.parse(JSON.stringify(lib.airfoils)));
  });

  it('keeps names and source texts within the limits', () => {
    const long = 'P'.repeat(20_000);
    const f = { ...FIXTURES, planes: [{ ...FIXTURES.planes[0], name: long }] };
    const r = mapXflr5(f, { fileName: `${'f'.repeat(3000)}.xfl` });
    expect(r.project.name).toHaveLength(LIMITS.maxName);
    expect(validateProject(r.project).ok).toBe(true);
    for (const a of r.project.airfoils) {
      expect(Object.keys(a.source).every((k) => SOURCE_KEYS.includes(k))).toBe(true);
      for (const v of Object.values(a.source)) expect(v.length).toBeLessThanOrEqual(LIMITS.maxText);
    }
    expect(mapXflr5(FIXTURES, { name: '  ' }).project.name).toBe('Fixture A Main Wing');
    expect(mapXflr5(FIXTURES, { name: 'My wing' }).project.name).toBe('My wing');
    expect(mapXflr5(FIXTURES, { name: 'n'.repeat(20_000) }).project.name).toHaveLength(LIMITS.maxName);
    const unnamed = xmlFile([wingOf([sec(0, 100), sec(100, 80)], { name: '' }), null, null, null], { planeName: '' });
    expect(mapXflr5(unnamed).project.name).toBe('Imported wing');
    // Names as the file writes them, padded: the default name is trimmed.
    const main = FIXTURES.planes[0].wings[0];
    const padded = { ...FIXTURES, planes: [{ ...FIXTURES.planes[0], name: ' Rascal ', wings: [{ ...main, name: 'Main Wing ' }, ...FIXTURES.planes[0].wings.slice(1)] }] };
    expect(mapXflr5(padded).name).toBe('Rascal Main Wing');
    // A blank plane name counts as none.
    const blank = mapXflr5({ ...FIXTURES, planes: [{ ...FIXTURES.planes[0], name: '   ' }] }, { fileName: 'b.xfl' });
    expect(blank.name).toBe('Main Wing');
    expect(blank.summary).toBe('Imported the main wing "Main Wing" from b.xfl: 3 sections, 2 airfoils.');
    expect(blank.project.airfoils[0].source.note).toBe('Airfoil "Clark Y" from an XFLR5 project; base shape without flap deflection.');
  });

  it('imports a wing-only XML file under the wing name', () => {
    const r = mapXflr5(xml('xml_mm/0.w2.wing.xml'), { fileName: '0.w2.wing.xml' });
    expect(r.surface).toBe('stab');
    expect(r.project.name).toBe('Elevator');
    expectSections(r.project.sections, [
      [0, 0, 0, 110, 0],
      [25, 230, 0, 70, 0],
    ]);
    expect(r.summary).toBe('Imported the horizontal stabilizer "Elevator" from 0.w2.wing.xml: 2 sections, 1 airfoil.');
    expect(texts(r.report, 'info')).toContain('A wing file holds no position or tilt angle: the part is built in its own frame.');
    const main = mapXflr5(xmlFile([wingOf([sec(0, 100), sec(100, 80)], { name: 'Solo' }), null, null, null], { wingOnly: true }), { fileName: 's.xml' });
    expect(main.summary).toBe('Imported the main wing "Solo" from s.xml: 2 sections, 1 airfoil.');
    const refused = mapXflr5(xml('xml_mm/0.w2.wing.xml'), { surface: 'main' });
    expect(refused.project).toBeNull();
    expect(texts(refused.report, 'error')).toEqual(['The wing in this file is a horizontal stabilizer (type ELEVATOR).']);
    expect(refused.rows).toEqual([]);
    expect(() => mapXflr5(FIXTURES, { surface: 'fin' })).toThrow(RangeError);
  });

  it('reports units, metre rounding, the reader warnings and the position y', () => {
    const inch = mapXflr5(xml('xml_in/0.plane.xml'), { library: LIBRARY });
    expect(texts(inch.report, 'info')).toContain('Lengths converted from inches to mm.');
    const metre = mapXflr5(xml('xml_m/1.plane.xml'), { library: LIBRARY });
    expect(texts(metre.report, 'info')).toEqual(expect.arrayContaining(['Lengths converted from metres to mm.', 'XFLR5 rounds lengths in metre XML files to 1 mm; the .xfl project file keeps full precision.']));
    const mm = mapXflr5(xml('xml_mm/0.plane.xml'), { library: LIBRARY });
    expect(texts(mm.report).some((t) => t.startsWith('Lengths converted'))).toBe(false);
    const odd = mapXflr5(xmlFile([wingOf([sec(0, 100), sec(50, 80)], { position: { x: 0, y: 12, z: 0 } }), null, null, null], { lengthUnit: 2, unitName: null, warnings: ['Reader warning.'] }));
    expect(texts(odd.report, 'info')).toEqual(expect.arrayContaining(['Lengths converted to mm from a file unit of 2 mm.', 'Position y 24 mm is not used, as in XFLR5.']));
    expect(texts(odd.report, 'warning')).toEqual(['Reader warning.']);
    // XML reader warnings concern the whole file: marked, so that the import toast can leave them out.
    expect(odd.report.filter((x) => x.reader)).toEqual([{ severity: 'warning', text: 'Reader warning.', reader: true }]);
    // The .xfl reader's warnings concern the airfoils of this wing too: not marked.
    const bytes = readFileSync(new URL('fixtures/xflr5/fixtures_v662.xfl', import.meta.url));
    const cut = mapXflr5(readXflBytes(bytes.subarray(0, 10179)), { library: LIBRARY });
    const lost = cut.report.filter((x) => x.text.startsWith('The airfoils could not be read.'));
    expect(lost).toEqual([{ severity: 'warning', text: expect.stringMatching(/^The airfoils could not be read\. The file is damaged or cut off at byte \d+ \(in .+\)\. Pick or upload them\.$/) }]);
    // The .xfl file unit (metres) is no conversion the report mentions.
    expect(texts(mapXflr5(FIXTURES).report).some((t) => t.startsWith('Lengths converted'))).toBe(false);
  });

  it('sorts the report by severity, and validation errors block the import', () => {
    const f = xmlFile([wingOf([sec(0, 100, 0, 0, 0, 'Long'), sec(100, 80, 0, 0, 0, 'Absent')]), null, wingOf([sec(0, 100), sec(10, 80)]), null], { lengthUnit: 1 });
    // A current-project airfoil whose name exceeds the limit: only validateProject finds it.
    const project = { airfoils: [{ id: 'long', name: 'L'.repeat(LIMITS.maxName + 1), points: nacaAirfoil('0012').points }] };
    const r = mapXflr5(f, { project, choices: { Absent: 'naca:0012', Long: 'project:long' } });
    expect(r.project).toBeNull();
    expect(texts(r.report, 'error')).toEqual(['Airfoil 1: name has 10,001 characters; the limit is 10,000.']);
    const order = r.report.map((x) => x.severity);
    expect(order).toEqual([...order].sort((a, b) => ['error', 'warning', 'info'].indexOf(a) - ['error', 'warning', 'info'].indexOf(b)));
    expect(r.errors).toBe(texts(r.report, 'error').length);
    expect(r.summary).toBe('');
    const noStab = mapXflr5(FIXTURES, { plane: 1, surface: 'stab' });
    expect(noStab).toMatchObject({ project: null, name: '', errors: 1, rows: [] });
  });

  it('turns build results into non-blocking report lines', () => {
    expect(buildNotes({ errors: ['Sections 1 and 2 cross.'], warnings: ['Large project.'] })).toEqual([
      { severity: 'warning', text: 'The wing does not build yet: Sections 1 and 2 cross.' },
      { severity: 'warning', text: 'Large project.' },
    ]);
    expect(buildNotes(buildWing(mapXflr5(FIXTURES).project))).toEqual([]);
  });

  it('imports both surfaces of Rascal 110 with its position and tilt', () => {
    const f = xfl('uaslab/Rascal110.xfl');
    const main = mapXflr5(f, { fileName: 'Rascal110.xfl' });
    expect(main.project.sections).toHaveLength(13);
    expect(validateProject(main.project).ok).toBe(true);
    expect(texts(main.report, 'info')).toContain('Position in the XFLR5 plane applied: the wing origin moved to x 234.95 mm, z 260.35 mm.');
    const stab = mapXflr5(f, { surface: 'stab' });
    expect(stab.project.sections.map((s) => s.twist)).toEqual(Array(9).fill(0.1));
    const x0 = 1428.75 + 0.25 * 174.625 * (Math.cos(0.1 * DEG) - 1);
    expect(mapSections(f.planes[0].wings[2], 1000).sections[0].x).toBeCloseTo(x0, 9);
    // The project holds 4 decimals, without the noise of the unit conversion (0.40005 m x 1000).
    expect(stab.project.sections[0].x).toBe(round4(x0));
    expect(f.planes[0].wings[0].sections[2].chord * 1000).not.toBe(400.05);
    expect(main.project.sections[2].chord).toBe(400.05);
  });
});

describe('XFLR5 mapping: German', () => {
  it('translates the report, the labels and the summary, also after an English mapping', () => {
    mapXflr5(FIXTURES);
    setLanguage('de');
    const r = mapXflr5(FIXTURES, { fileName: 'fixtures_v662.xfl' });
    expect(texts(r.report, 'info')).toEqual(
      expect.arrayContaining([
        'Einstellwinkel 2° wie im XFLR5-Flugzeug angewendet: Die Schnitte sind um den Ursprung des Flügels gedreht, und jede Schränkung enthält ihn.',
        'Nicht importiert: das Höhenleitwerk „Elevator“, das Seitenleitwerk „Fin“. Eine Fläche je Import; für eine weitere die Datei erneut öffnen.',
      ]),
    );
    // The cached airfoil check speaks the new language.
    expect(texts(r.report, 'info')).toContainEqual(expect.stringMatching(/^Profil „Clark Y“ \(Schnitte 1–2\): .*-1,97/));
    expect(r.summary).toBe('Tragfläche „Main Wing“ von „Fixture A“ aus fixtures_v662.xfl importiert: 3 Schnitte, 2 Profile.');
    expect(mapXflr5(FIXTURES, { surface: 'stab', fileName: 'f.xfl' }).summary).toBe('Höhenleitwerk „Elevator“ von „Fixture A“ aus f.xfl importiert: 2 Schnitte, 1 Profil.');
    expect(planeSurfaces(FIXTURES, 1).surfaces.map((s) => [s.label, s.reason])).toEqual([
      ['Tragfläche', null],
      ['Höhenleitwerk (XFLR5: Elevator)', 'Dieses Flugzeug hat kein Höhenleitwerk.'],
    ]);
    expect(describeFile(xml('xml_in/0.plane.xml'))).toBe('XFLR5-Flugzeugdatei (XML), Längeneinheit: Zoll');
    const w = wingOf([sec(0, 200, 0, 10, 0, 'A'), sec(100, 180, 0, 0, 0, 'A'), sec(100, 180, 0, 0, 0, 'B'), sec(300, 120)]);
    expect(texts(mapSections(w, 1).report, 'warning')).toEqual(['Die Schnitte 2 und 3 liegen beide bei y = 98,4808 mm; Schnitt 2 wurde um 0,5 mm nach innen verschoben.']);
    const missing = mapXflr5(simple('Absent'));
    expect(texts(missing.report, 'error')).toEqual(['Profil „Absent“ (Schnitte 1–2) fehlt: eine .dat-Datei hochladen oder ein Profil wählen.']);
    expect(missing.rows[0].foundLabel).toBe('Fehlt');
    // Section lists after "für", and unit words without a case ending.
    const sides = wingOf([sec(0, 200, 0, 0, 0, 'A', 'B'), sec(100, 100, 0, 0, 0, '')]);
    const both = mapXflr5(xmlFile([sides, null, null, null]));
    expect(texts(both.report, 'warning')).toContain('Für Schnitt 1 unterscheiden sich linkes und rechtes Profil; die Profile der rechten Seite werden verwendet.');
    expect(texts(both.report, 'error')).toContain('XFLR5 nennt für Schnitt 2 kein Profil: eine .dat-Datei hochladen oder ein Profil wählen.');
    expect(texts(mapXflr5(xml('xml_m/1.plane.xml')).report, 'info')).toContain('Längen in mm umgerechnet (Längeneinheit der Datei: Meter).');
    expect(planeSurfaces(xmlFile([wingOf([sec(0, 240)], { name: 'W' }), null, null, null])).surfaces[0].detail).toBe('„W“: 1 Schnitt, Wurzeltiefe 240 mm');
    // The inclined chord line of a library airfoil, with decimal commas.
    const lib = mapXflr5(FIXTURES, { library: LIBRARY, choices: { 'Clark Y': 'library:clark-y' } });
    expect(texts(lib.report, 'warning')).toContain(
      'Das Bibliotheksprofil „Clark Y“ (Schnitte 1–2) hat in seinen eigenen Koordinaten eine Profilsehne, die 2,00° mit der Nase nach oben geneigt ist, und die gebauten Schnitte behalten diesen Winkel. Ist die Profilsehne des Profils, das XFLR5 verwendet hat, waagrecht, stehen diese Schnitte 2,00° weiter mit der Nase nach oben als in XFLR5, die Endleiste 8,4 mm tiefer bei 240 mm Profiltiefe; die .dat-Datei hochladen, die XFLR5 verwendet hat, um sie wie in XFLR5 zu setzen.',
    );
  });
});
