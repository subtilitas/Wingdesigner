import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { XflrError } from '../src/import/errors.js';
import { MAX_ATTRIBUTES, MAX_DEPTH, MAX_ELEMENTS, readXflr5Xml } from '../src/import/xflxml.js';
import { decodeText } from '../src/airfoil/parse.js';
import { MAX_PLANES } from '../src/import/xfl.js';
import { setLanguage } from '../src/i18n/index.js';
import { MAX_PROJECT_BYTES } from '../src/model/io.js';
import { LIMITS } from '../src/model/project.js';

const fixture = (name) => readFileSync(new URL(`./fixtures/xflr5/${name}`, import.meta.url), 'utf8');

/** The XflrError thrown by readXflr5Xml(text). */
function failure(text) {
  try {
    readXflr5Xml(text);
  } catch (e) {
    expect(e).toBeInstanceOf(XflrError);
    return e;
  }
  throw new Error('readXflr5Xml did not throw');
}

// Test files in XFLR5's layout (lengths in mm unless a unit is given).
const section = ({ y = 0, chord = 100, offset = 0, dihedral = 0, twist = 0, foil = 'NACA 0009', left = foil } = {}) =>
  `<Section><y_position>${y}</y_position><Chord>${chord}</Chord><xOffset>${offset}</xOffset><Dihedral>${dihedral}</Dihedral><Twist>${twist}</Twist>` +
  `<x_number_of_panels>13</x_number_of_panels><Left_Side_FoilName>${left}</Left_Side_FoilName><Right_Side_FoilName>${foil}</Right_Side_FoilName></Section>`;
const twoSections = section() + section({ y: 200, chord: 80, offset: 10 });
const wing = (name, { type, isFin, position = '0, 0, 0', tilt = '0.000', sections = twoSections } = {}) =>
  `<wing><Name>${name}</Name>${type === undefined ? '' : `<Type>${type}</Type>`}<Color><red>1</red></Color><Description></Description>` +
  `<Position>${position}</Position><Tilt_angle>${tilt}</Tilt_angle><Symetric>true</Symetric>` +
  `${isFin === undefined ? '' : `<isFin>${isFin}</isFin>`}<Inertia/><Sections>${sections}</Sections></wing>`;
const plane = (name, wings) => `<Plane><Name>${name}</Name><Description>test</Description><Inertia/><has_body>false</has_body>${wings}</Plane>`;
const units = (unit = '0.001') => `<Units><length_unit_to_meter>${unit}</length_unit_to_meter><mass_unit_to_kg>1</mass_unit_to_kg></Units>`;
const file = (body) => `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE explane>\n<explane version="1.0">\n${body}\n</explane>\n`;
const names = (p) => p.wings.map((w) => w?.name ?? null);

afterEach(() => setLanguage('en'));

describe('XFLR5 XML fixtures', () => {
  it('reads the plane file in millimetres (Fixture A)', () => {
    const r = readXflr5Xml(fixture('xml_mm/0.plane.xml'));
    expect(r).toMatchObject({ kind: 'xml', format: null, version: '1.0', lengthUnit: 1, unitName: 'mm', wingOnly: false, foils: null, foilError: null, warnings: [] });
    expect(r.planes).toHaveLength(1);
    const [p] = r.planes;
    expect(p).toMatchObject({ name: 'Fixture A', description: 'Synthetic Wingdesigner test plane' });
    expect(names(p)).toEqual(['Main Wing', null, 'Elevator', 'Fin']);
    const [main, , elevator] = p.wings;
    expect(main).toMatchObject({ description: '', symmetric: true, position: { x: 0, y: 0, z: 0 }, tilt: 2 });
    expect(main.sections).toEqual([
      { rightFoil: 'Clark Y', leftFoil: 'Clark Y', chord: 240, y: 0, offset: 0, dihedral: 3, twist: 0 },
      { rightFoil: 'Clark Y', leftFoil: 'Clark Y', chord: 220, y: 500, offset: 10, dihedral: 6, twist: -1 },
      { rightFoil: 'NACA 0009', leftFoil: 'NACA 0009', chord: 150, y: 900, offset: 45, dihedral: 0, twist: -2.5 },
    ]);
    expect(elevator).toMatchObject({ position: { x: 650, y: 0, z: 40 }, tilt: -1.5 });
    expect(elevator.sections).toEqual([
      { rightFoil: 'NACA 0009', leftFoil: 'NACA 0009', chord: 110, y: 0, offset: 0, dihedral: 0, twist: 0 },
      { rightFoil: 'NACA 0009', leftFoil: 'NACA 0009', chord: 70, y: 230, offset: 25, dihedral: 0, twist: 0 },
    ]);
  });

  it('reads the same plane in inches, equal within the rounding of the file', () => {
    const mm = readXflr5Xml(fixture('xml_mm/0.plane.xml')).planes[0];
    const r = readXflr5Xml(fixture('xml_in/0.plane.xml'));
    expect(r).toMatchObject({ lengthUnit: 25.4, unitName: 'in', warnings: [] });
    const p = r.planes[0];
    expect(names(p)).toEqual(names(mm));
    // 3 decimals of an inch in the sections, 5 significant digits in Position.
    for (const slot of [0, 2, 3]) {
      const a = mm.wings[slot];
      const b = p.wings[slot];
      expect(b.tilt).toBe(a.tilt);
      for (const k of ['x', 'y', 'z']) expect(Math.abs(b.position[k] * 25.4 - a.position[k])).toBeLessThan(0.013);
      b.sections.forEach((s, i) => {
        for (const k of ['y', 'chord', 'offset']) expect(Math.abs(s[k] * 25.4 - a.sections[i][k])).toBeLessThan(0.013);
        expect(s).toMatchObject({ dihedral: a.sections[i].dihedral, twist: a.sections[i].twist, rightFoil: a.sections[i].rightFoil });
      });
    }
    expect(p.wings[2].position).toEqual({ x: 25.591, y: 0, z: 1.5748 });
  });

  it('reads a plane file in metres without an elevator (Fixture B)', () => {
    const r = readXflr5Xml(fixture('xml_m/1.plane.xml'));
    expect(r).toMatchObject({ lengthUnit: 1000, unitName: 'm', wingOnly: false, warnings: [] });
    const p = r.planes[0];
    expect(p.name).toBe('Fixture B');
    expect(names(p)).toEqual(['Flying Wing', null, null, null]);
    const w = p.wings[0];
    expect(w).toMatchObject({ position: { x: 0.05, y: 0, z: 0.01 }, tilt: 1 });
    expect(w.sections.map((s) => [s.y, s.chord, s.offset, s.dihedral, s.twist, s.rightFoil])).toEqual([
      [0, 0.3, 0, 0, 2, 'Clark Y'],
      [0.25, 0.26, 0.06, 2, 1, 'Clark Y'],
      [0.6, 0.2, 0.16, 2, -1, 'NACA 0009'],
      [0.75, 0.12, 0.24, 30, -3, 'NACA 0009'],
    ]);
  });

  it('reads a wing-only elevator as the horizontal stabilizer, at the origin', () => {
    const r = readXflr5Xml(fixture('xml_mm/0.w2.wing.xml'));
    expect(r).toMatchObject({ wingOnly: true, lengthUnit: 1, unitName: 'mm', warnings: [] });
    expect(r.planes).toHaveLength(1);
    expect(r.planes[0]).toMatchObject({ name: '', description: '' });
    expect(names(r.planes[0])).toEqual([null, null, 'Elevator', null]);
    const w = r.planes[0].wings[2];
    expect(w).toMatchObject({ position: { x: 0, y: 0, z: 0 }, tilt: 0 });
    expect(w.sections.map((s) => [s.y, s.chord, s.offset])).toEqual([
      [0, 110, 0],
      [230, 70, 25],
    ]);
  });

  it('reads the plane file saved as UTF-16 with a byte order mark (Windows "Unicode" text)', () => {
    const text = fixture('xml_mm/0.plane.xml');
    const utf8 = readXflr5Xml(text);
    const le = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, 'utf16le')]);
    const be = Buffer.concat([Buffer.from([0xfe, 0xff]), Buffer.from(text, 'utf16le').swap16()]);
    for (const bytes of [le, be]) expect(readXflr5Xml(decodeText(new Uint8Array(bytes)))).toEqual(utf8);
  });

  it('refuses a wing-only fin', () => {
    const e = failure(fixture('xml_mm/0.w3.wing.xml'));
    expect(e.code).toBe('fin');
    expect(e.message).toBe('The XML wing "Fin" is a fin; only a main wing or a horizontal stabilizer can be imported.');
  });

  it('reads UltraStick25e.xml (genuine XFLR5 output in inches with a body)', () => {
    const r = readXflr5Xml(fixture('uaslab/UltraStick25e.xml'));
    expect(r).toMatchObject({ lengthUnit: 25.4, unitName: 'in', wingOnly: false, warnings: [] });
    const p = r.planes[0];
    expect(p.name).toBe('UltraStick25e');
    expect(p.description).toContain('flat 0.25" thick');
    expect(names(p)).toEqual(['Main Wing', null, 'Elevator', 'Fin']);
    const [main, , elevator, fin] = p.wings;
    expect(main.position).toEqual({ x: 6.25, y: 0, z: 3 });
    expect(main.sections.map((s) => [s.y, s.chord, s.offset, s.rightFoil])).toEqual([
      [0, 10.25, 0, 'NACA0014'],
      [3.125, 10.25, 0, 'NACA0014_Flap'],
      [12, 10.25, 0, 'NACA0014_AilIn'],
      [22.25, 9.875, 0, 'NACA0014_AilOut'],
      [24.875, 0.5, 9.25, 'Flat'],
    ]);
    expect(elevator.position).toEqual({ x: 30.25, y: 0, z: 0 });
    expect(elevator.sections.map((s) => s.y)).toEqual([0, 1, 8.125, 9.438]);
    expect(fin.sections).toHaveLength(2);
  });
});

describe('XFLR5 XML units', () => {
  it('reads lengths as metres without <Units>', () => {
    const r = readXflr5Xml(file(plane('P', wing('W', { type: 'MAINWING', sections: section({ y: 0, chord: 0.2 }) + section({ y: 0.5, chord: 0.1 }) }))));
    expect(r).toMatchObject({ lengthUnit: 1000, unitName: 'm', warnings: [] });
    expect(r.planes[0].wings[0].sections[1]).toMatchObject({ y: 0.5, chord: 0.1 });
  });

  it('names the XFLR5 display units and keeps others as a factor', () => {
    const read = (unit) => readXflr5Xml(file(units(unit) + plane('P', wing('W'))));
    expect(read('0.01')).toMatchObject({ lengthUnit: 10, unitName: 'cm' });
    expect(read('0.1')).toMatchObject({ lengthUnit: 100, unitName: 'dm' });
    expect(read('1')).toMatchObject({ lengthUnit: 1000, unitName: 'm' });
    expect(read(' 0.0254 ')).toMatchObject({ lengthUnit: 25.4, unitName: 'in' });
    expect(read('0.3048')).toMatchObject({ lengthUnit: 304.8, unitName: 'ft' });
    expect(read('1e-3')).toMatchObject({ lengthUnit: 1, unitName: 'mm' });
    expect(read('0.5')).toMatchObject({ lengthUnit: 500, unitName: null });
  });

  it('ignores <Units> after the plane, as XFLR5 does', () => {
    const r = readXflr5Xml(file(plane('P', wing('W')) + units('0.001')));
    expect(r).toMatchObject({ lengthUnit: 1000, unitName: 'm' });
    expect(r.planes[0].wings[0].sections[1]).toMatchObject({ y: 200, chord: 80 });
    expect(r.warnings).toEqual(['The length unit (<Units>) comes after a plane or wing; as in XFLR5, it applies only to the planes and wings that follow it.']);
  });

  it('applies a <Units> between planes to the later planes only, in the unit of the first', () => {
    const r = readXflr5Xml(file(units('0.001') + plane('A', wing('W', { position: '100, 0, 50' })) + units('0.01') + plane('B', wing('W', { position: '10, 0, 5' }))));
    expect(r).toMatchObject({ lengthUnit: 1, unitName: 'mm' });
    expect(r.warnings).toHaveLength(1);
    const [a, b] = r.planes.map((p) => p.wings[0]);
    expect(a.sections[1]).toMatchObject({ y: 200, chord: 80, offset: 10 });
    expect(b.sections[1]).toMatchObject({ y: 2000, chord: 800, offset: 100 });
    expect(b.position).toEqual({ x: 100, y: 0, z: 50 });
  });

  it('refuses a length unit that is not a positive number', () => {
    // Far outside the units XFLR5 writes (mm to m, inch, foot), the lengths make no sense.
    for (const unit of ['0', '-1', 'abc', '', '1,5', '1e999', '1e308', '1e-12', '5e-324', '1001']) {
      const e = failure(file(units(unit) + plane('P', wing('W'))));
      expect(e.code).toBe('damaged');
      expect(e.message).toBe(`The length unit of the XML file is not valid: length_unit_to_meter is "${unit}".`);
    }
  });
});

describe('XFLR5 XML syntax', () => {
  it('accepts a BOM, comments, processing instructions, CDATA and a DOCTYPE with an internal subset', () => {
    const text =
      '\uFEFF<?xml version="1.0"?>\n<!-- written by <hand> -->\n<!DOCTYPE explane [ <!ENTITY x "a>b"> ]>\n' +
      `<explane version='1.0'><!-- a comment --><?pi data?>${units()}` +
      plane('P<!-- inside -->', wing('<![CDATA[W<1> & more]]>', { type: 'ELEVATOR' })) +
      '</explane>';
    const r = readXflr5Xml(text);
    expect(r.planes[0].name).toBe('P');
    expect(r.planes[0].wings[2].name).toBe('W<1> & more');
  });

  it('decodes the five entities and character references', () => {
    const name = 'A &amp; B &lt;1&gt; &quot;x&quot; &apos;y&apos; &#65;&#x42;&#x1F6E9; &unknown; &#xD800;';
    const r = readXflr5Xml(file(plane(name, wing('W'))));
    expect(r.planes[0].name).toBe('A & B <1> "x" \'y\' AB\u{1F6E9} &unknown; &#xD800;');
    // In attribute values too: the version is compared after decoding.
    expect(readXflr5Xml(file(plane('P', wing('W'))).replace('version="1.0">', 'version="1&#46;0">')).version).toBe('1.0');
  });

  it('compares element names without case and skips unknown elements', () => {
    const text = file(
      '<UNITS><Length_Unit_To_Meter>0.001</Length_Unit_To_Meter></UNITS><plane><NAME>P</NAME><Unknown><wing><Name>hidden</Name></wing></Unknown>' +
        '<WING><name>W</name><TYPE>elevator</TYPE><POSITION>1, 2, 3</POSITION><TILT_ANGLE>-2</TILT_ANGLE><SYMETRIC>FALSE</SYMETRIC><SECTIONS>' +
        '<section><Y_POSITION>0</Y_POSITION><CHORD>100</CHORD><extra>9</extra><RIGHT_SIDE_FOILNAME>F</RIGHT_SIDE_FOILNAME></section>' +
        '<SECTION><y_position>50</y_position><chord>90</chord><XOFFSET>5</XOFFSET><DIHEDRAL>4</DIHEDRAL><TWIST>1</TWIST></SECTION>' +
        '</SECTIONS></WING></plane>',
    );
    const r = readXflr5Xml(text);
    expect(r.lengthUnit).toBe(1);
    const w = r.planes[0].wings[2];
    expect(names(r.planes[0])).toEqual([null, null, 'W', null]);
    expect(w).toMatchObject({ symmetric: false, position: { x: 1, y: 2, z: 3 }, tilt: -2 });
    expect(w.sections).toEqual([
      { rightFoil: 'F', leftFoil: '', chord: 100, y: 0, offset: 0, dihedral: 0, twist: 0 },
      { rightFoil: '', leftFoil: '', chord: 90, y: 50, offset: 5, dihedral: 4, twist: 1 },
    ]);
  });

  it('skips child elements inside a text and other elements inside <Sections>', () => {
    const r = readXflr5Xml(file(plane('P', wing('W<b>x</b>Y', { sections: section() + '<Note>n</Note>' + section({ y: 200 }) }))));
    const w = r.planes[0].wings[0];
    expect(w.name).toBe('WY');
    expect(w.sections.map((q) => q.y)).toEqual([0, 200]);
    expect(r.warnings).toEqual([]);
  });

  it('reads padded numbers and %g exponents, and keeps foil names as written', () => {
    const sections =
      section({ y: '  0.000', chord: ' 1.2346e+02', offset: '\t-0.000 ', dihedral: '+5', twist: '.5', foil: 'E205  (10.48%) ', left: 'other' }) +
      section({ y: '1.5E3', chord: '80.', offset: '1e-05' });
    const r = readXflr5Xml(file(units() + plane('P', wing('W', { position: '  1.2346e+05,     0,  -3.5', tilt: ' -1.500', sections }))));
    const w = r.planes[0].wings[0];
    expect(w.position).toEqual({ x: 123460, y: 0, z: -3.5 });
    expect(w.tilt).toBe(-1.5);
    expect(w.sections[0]).toEqual({ rightFoil: 'E205  (10.48%) ', leftFoil: 'other', chord: 123.46, y: 0, offset: 0, dihedral: 5, twist: 0.5 });
    expect(Object.is(w.sections[0].offset, 0)).toBe(true);
    expect(w.sections[1]).toMatchObject({ y: 1500, chord: 80, offset: 1e-5 });
    expect(r.warnings).toEqual([]);
  });

  it('defaults Symetric to true, isFin to false, and a missing xOffset, Dihedral and Twist to 0', () => {
    const sections = '<Section><y_position>0</y_position><Chord>100</Chord></Section><Section><y_position>100</y_position><Chord>50</Chord></Section>';
    const r = readXflr5Xml(file(plane('P', `<wing><Name>W</Name><Sections>${sections}</Sections></wing>`)));
    const w = r.planes[0].wings[0];
    expect(w).toMatchObject({ symmetric: true, position: { x: 0, y: 0, z: 0 }, tilt: 0, description: '' });
    expect(w.sections[1]).toEqual({ rightFoil: '', leftFoil: '', chord: 50, y: 100, offset: 0, dihedral: 0, twist: 0 });
    expect(r.warnings).toEqual([]);
  });

  it('keeps a missing y_position or Chord and a garbled number as NaN, with a warning', () => {
    const sections =
      '<Section><Chord>100</Chord><Twist>abc</Twist></Section>' +
      '<Section><y_position></y_position><xOffset>1,5</xOffset><Dihedral>Infinity</Dihedral></Section>' +
      section({ y: 300, chord: '0x10' });
    const r = readXflr5Xml(file(plane('P', wing('W', { sections, position: '1, x, 3', tilt: 'nan' }))));
    const w = r.planes[0].wings[0];
    expect(w.position.x).toBe(1);
    expect(w.position.y).toBeNaN();
    expect(w.tilt).toBeNaN();
    expect(w.sections[0].y).toBeNaN();
    expect(w.sections[0].twist).toBeNaN();
    expect(w.sections[1].chord).toBeNaN();
    expect(w.sections[1].y).toBeNaN();
    expect(w.sections[1].offset).toBeNaN();
    expect(w.sections[2].chord).toBeNaN();
    // In file order, the first 5 and a count of the rest (xOffset, Dihedral, the missing Chord of section 2, 0x10).
    expect(r.warnings).toEqual([
      'Plane "P", wing "W": Position "1, x, 3" is not a number.',
      'Plane "P", wing "W": Tilt_angle "nan" is not a number.',
      'Plane "P", wing "W", section 1: Twist "abc" is not a number.',
      'Plane "P", wing "W", section 1: y_position is missing.',
      'Plane "P", wing "W", section 2: y_position "" is not a number.',
      'Plane "P", wing "W": further values missing or not numbers: 4.',
    ]);
    const good = readXflr5Xml(file(plane('P', wing('W', { sections: section({ dihedral: '1,5' }) + section({ y: 5, twist: 'Infinity' }) }))));
    expect(good.warnings).toEqual(['Plane "P", wing "W", section 1: Dihedral "1,5" is not a number.', 'Plane "P", wing "W", section 2: Twist "Infinity" is not a number.']);
  });

  it('warns about a Position with fewer than 3 values and keeps 0, 0, 0 as XFLR5 does', () => {
    const r = readXflr5Xml(file(plane('P', wing('W', { position: '650, 40' }))));
    expect(r.planes[0].wings[0].position).toEqual({ x: 0, y: 0, z: 0 });
    expect(r.warnings).toEqual(['Plane "P", wing "W": Position "650, 40" holds fewer than 3 values; the wing is placed at 0, 0, 0 as in XFLR5.']);
    const four = readXflr5Xml(file(plane('P', wing('W', { position: '1, 2, 3, 4' }))));
    expect(four.planes[0].wings[0].position).toEqual({ x: 1, y: 2, z: 3 });
  });
});

describe('XFLR5 XML wing roles', () => {
  it('places wings by Type, whatever their order', () => {
    const p = readXflr5Xml(file(plane('P', wing('F', { type: 'FIN', isFin: true }) + wing('E', { type: 'ELEVATOR' }) + wing('S', { type: 'SECONDWING' }) + wing('M', { type: 'MAINWING' })))).planes[0];
    expect(names(p)).toEqual(['M', 'S', 'E', 'F']);
  });

  it('places Type-less wings by their order: 1st main wing, 2nd elevator, isFin fin', () => {
    expect(names(readXflr5Xml(file(plane('P', wing('A') + wing('B') + wing('C', { isFin: true })))).planes[0])).toEqual(['A', null, 'B', 'C']);
    // OTHERWING is XFLR5's own name for a wing without a role.
    expect(names(readXflr5Xml(file(plane('P', wing('A', { type: 'OTHERWING' }) + wing('B', { type: 'Canard' })))).planes[0])).toEqual(['A', null, 'B', null]);
  });

  it('counts a fin first, so the next Type-less wing becomes the elevator', () => {
    const r = readXflr5Xml(file(plane('P', wing('F', { isFin: true }) + wing('A') + wing('B'))));
    expect(names(r.planes[0])).toEqual(['B', null, 'A', 'F']);
    expect(r.warnings).toEqual([]);
  });

  it('lets a third Type-less wing replace the main wing, with a warning', () => {
    const r = readXflr5Xml(file(plane('P', wing('A') + wing('B') + wing('C'))));
    expect(names(r.planes[0])).toEqual(['C', null, 'B', null]);
    expect(r.warnings).toEqual(['Plane "P" has more than one main wing: "C" replaces "A", as in XFLR5.']);
  });

  it('keeps the last of two wings of one Type, with a warning', () => {
    const r = readXflr5Xml(
      file(plane('P', wing('M', { type: 'MAINWING' }) + wing('E1', { type: 'ELEVATOR' }) + wing('E2', { type: 'ELEVATOR', sections: section() + section({ y: 150 }) }))),
    );
    expect(names(r.planes[0])).toEqual(['M', null, 'E2', null]);
    expect(r.planes[0].wings[2].sections[1].y).toBe(150);
    expect(r.warnings).toEqual(['Plane "P" has more than one horizontal stabilizer: "E2" replaces "E1", as in XFLR5.']);
    const fins = readXflr5Xml(file(plane('P', wing('M') + wing('F1', { type: 'FIN' }) + wing('F2', { type: 'FIN' }))));
    expect(fins.warnings).toEqual(['Plane "P" has more than one fin: "F2" replaces "F1", as in XFLR5.']);
  });

  it('keeps the last of two second wings, with a warning', () => {
    const r = readXflr5Xml(file(plane('P', wing('M') + wing('S1', { type: 'SECONDWING' }) + wing('S2', { type: 'SECONDWING' }))));
    expect(names(r.planes[0])).toEqual(['M', 'S2', null, null]);
    expect(r.warnings).toEqual(['Plane "P" has more than one second wing: "S2" replaces "S1", as in XFLR5.']);
  });

  it('reads at most 4 wings per plane', () => {
    const r = readXflr5Xml(file(plane('P', wing('M', { type: 'MAINWING' }) + wing('S', { type: 'SECONDWING' }) + wing('E', { type: 'ELEVATOR' }) + wing('F', { type: 'FIN' }) + wing('X', { type: 'MAINWING' }))));
    expect(names(r.planes[0])).toEqual(['M', 'S', 'E', 'F']);
    expect(r.warnings).toEqual(['Plane "P" has more than 4 wings; XFLR5 reads the first 4, and so does this import.']);
  });

  it('lists several <Plane> elements as planes', () => {
    const r = readXflr5Xml(file(units() + plane('A', wing('A main')) + plane('B', wing('B main', { type: 'MAINWING' }) + wing('B stab', { type: 'ELEVATOR' }))));
    expect(r.planes.map((p) => p.name)).toEqual(['A', 'B']);
    expect(names(r.planes[1])).toEqual(['B main', null, 'B stab', null]);
    expect(r.wingOnly).toBe(false);
  });

  it('lists at most 50 warnings and counts the rest', () => {
    const r = readXflr5Xml(file(Array.from({ length: 60 }, (_, i) => plane(`P${i}`, wing('A') + wing('B') + wing('C'))).join('')));
    expect(r.planes).toHaveLength(60);
    expect(r.warnings).toHaveLength(51);
    expect(r.warnings[49]).toBe('Plane "P49" has more than one main wing: "C" replaces "A", as in XFLR5.');
    expect(r.warnings[50]).toBe('Further warnings not listed: 10.');
  });

  it('reads a plane without wings as a plane with empty slots', () => {
    const r = readXflr5Xml(file(plane('Empty', '')));
    expect(names(r.planes[0])).toEqual([null, null, null, null]);
  });
});

describe('XFLR5 XML wing-only files', () => {
  const only = (w) => readXflr5Xml(file(units() + w));

  it('takes the role from Type: ELEVATOR the stabilizer, anything else the main wing', () => {
    expect(names(only(wing('E', { type: 'elevator' })).planes[0])).toEqual([null, null, 'E', null]);
    for (const type of ['MAINWING', 'SECONDWING', 'OTHERWING', undefined]) expect(names(only(wing('W', { type })).planes[0])).toEqual(['W', null, null, null]);
  });

  it('ignores Position and Tilt_angle, as XFLR5 does', () => {
    const r = only(wing('W', { type: 'MAINWING', position: '100, 0, 50', tilt: 'garbage' }));
    expect(r.planes[0].wings[0]).toMatchObject({ position: { x: 0, y: 0, z: 0 }, tilt: 0 });
    expect(r.warnings).toEqual([]);
  });

  it('refuses a fin by Type or by isFin', () => {
    expect(failure(file(wing('V', { type: 'FIN' }))).code).toBe('fin');
    expect(failure(file(wing('V', { isFin: 'true' }))).code).toBe('fin');
    expect(failure(file(wing('V', { type: 'MAINWING', isFin: ' TRUE ' }))).code).toBe('fin');
  });

  it('keeps the last of several wings, as XFLR5 does', () => {
    const r = readXflr5Xml(file(wing('A', { type: 'MAINWING' }) + wing('B', { type: 'ELEVATOR' })));
    expect(names(r.planes[0])).toEqual([null, null, 'B', null]);
    expect(r.warnings).toEqual(['The file holds 2 wings outside a plane; XFLR5 reads only the last one, "B", and so does this import.']);
  });

  it('names sections without a plane in warnings', () => {
    const r = only(wing('W', { sections: '<Section><Chord>1</Chord></Section>' + section({ y: 5 }) }));
    expect(r.warnings).toEqual(['Wing "W", section 1: y_position is missing.']);
    expect(only(wing('W', { sections: section({ chord: 'x' }) + section({ y: 5 }) })).warnings).toEqual(['Wing "W", section 1: Chord "x" is not a number.']);
    // Five problems are listed per wing, then a count of the rest.
    const bad = only(wing('W', { sections: section({ y: 'a', chord: 'b', offset: 'c' }) + section({ y: 'd', chord: 'e', offset: 'f' }) }));
    expect(bad.warnings).toHaveLength(6);
    expect(bad.warnings[4]).toBe('Wing "W", section 2: Chord "e" is not a number.');
    expect(bad.warnings[5]).toBe('Wing "W": further values missing or not numbers: 1.');
  });

  it('does not import wings outside the planes of a plane file', () => {
    const r = readXflr5Xml(file(wing('Loose') + plane('P', wing('M'))));
    expect(r.wingOnly).toBe(false);
    expect(names(r.planes[0])).toEqual(['M', null, null, null]);
    expect(r.warnings).toEqual(['The file holds a wing outside its planes; it is not imported.']);
    expect(readXflr5Xml(file(wing('A') + plane('P', wing('M')) + wing('B'))).warnings).toEqual(['The file holds 2 wings outside its planes; they are not imported.']);
  });
});

describe('XFLR5 XML refusals', () => {
  it('refuses another root element or version', () => {
    const cases = [
      ['<plane version="1.0"><Plane/></plane>', 'plane', '1.0'],
      ['<Explane version="1.0"><Plane/></Explane>', 'Explane', '1.0'],
      ['<explane version="2.0"><Plane/></explane>', 'explane', '2.0'],
      ['<explane><Plane/></explane>', 'explane', ''],
      ['<?xml version="1.0"?><airfoil><name>x</name></airfoil>', 'airfoil', ''],
    ];
    for (const [text, root, version] of cases) {
      const e = failure(text);
      expect(e.code).toBe('not-plane-xml');
      expect(e.message).toBe(`The file is not an XFLR5 plane or wing file (root element "${root}", version "${version}").`);
    }
  });

  it('refuses files that are no XML', () => {
    for (const text of ['', '   ', '{"format": "wingdesigner"}', 'NACA 0012\n1 0\n0 0\n1 0', '<!-- only a comment -->']) {
      const e = failure(text);
      expect(e.code).toBe('not-plane-xml');
      expect(e.message).toBe('The file is not an XFLR5 plane or wing file: it does not start with an XML element.');
    }
  });

  it('refuses content after the root element; white space, comments and declarations may follow it', () => {
    const good = file(units() + plane('P', wing('Main Wing', { type: 'MAINWING' })));
    expect(readXflr5Xml(`${good}<!-- saved by XFLR5 -->\n<?pi x?>\n  `).planes).toHaveLength(1);
    for (const tail of ['garbage', '<another/>', '<unclosed>', '<![CDATA[x]]>']) {
      const e = failure(good + tail);
      expect(e.code).toBe('damaged');
      expect(e.message).toBe('The XML file is damaged at line 6: content follows the end of the root element.');
    }
    setLanguage('de');
    expect(failure(`${good}garbage`).message).toBe('Die XML-Datei ist in Zeile 6 beschädigt: Nach dem Ende des Wurzelelements folgt weiterer Inhalt.');
  });

  it('names flow5 XML files', () => {
    const e = failure('<?xml version="1.0"?><!DOCTYPE flow5><xflplane version="1.0"><Plane/></xflplane>');
    expect(e.code).toBe('flow5');
    expect(e.message).toBe('The file is a flow5 XML file (root element "xflplane"); only XFLR5 files can be imported.');
  });

  it('refuses a file without a plane or wing', () => {
    for (const body of [units(), '', '<body><Name>B</Name></body>']) expect(failure(file(body)).code).toBe('no-plane');
    expect(failure('<explane version="1.0"/>').code).toBe('no-plane');
  });

  it('refuses unclosed and mismatched tags with the line', () => {
    const cut = failure(file(plane('P', wing('W'))).replace('</explane>\n', ''));
    expect(cut).toMatchObject({ code: 'damaged', message: 'The XML file is cut off: the element <explane> is not closed.' });
    expect(failure('<explane version="1.0">\n<Plane><Name>P</Name>\n</plane></explane>')).toMatchObject({
      code: 'damaged',
      message: 'The XML file is damaged at line 3: </plane> does not close <Plane>.',
    });
    expect(failure('</explane>').message).toBe('The XML file is damaged at line 1: </explane> closes no open element.');
    for (const text of ['<explane version="1.0">\n\n< Plane/></explane>', '<explane version="1.0">\n\n<Plane a></Plane></explane>', '<explane version="1.0" a="<">\n\n\n', '<explane version="1.0">\n\n</Plane x></explane>']) {
      expect(failure(text).message).toMatch(/^The XML file is damaged at line \d: a tag is malformed\.$/);
    }
    expect(failure('<explane version="1.0">\n\n<Plane/><!-- open').message).toBe('The XML file is damaged at line 3: a comment, CDATA section or declaration is not closed.');
    expect(failure('<!DOCTYPE explane [ <!ENTITY a "b"> ').code).toBe('damaged');
    expect(failure('<explane version="1.0"><![CDATA[ x').code).toBe('damaged');
    // '<!' that starts no comment, CDATA section or DOCTYPE, and an end tag without a name.
    for (const text of ['<explane version="1.0">\n<!ENTITY x>', '<explane version="1.0">\n</ >']) {
      expect(failure(text)).toMatchObject({ code: 'damaged', message: 'The XML file is damaged at line 2: a tag is malformed.' });
    }
  });

  it('refuses elements with more attributes than XFLR5 could write, with the line', () => {
    const attrs = (n) => Array.from({ length: n }, (_, i) => ` a${i}="b"`).join('');
    expect(readXflr5Xml(file(`<Plane${attrs(MAX_ATTRIBUTES)}><Name>P</Name>${wing('W')}</Plane>`)).planes[0].name).toBe('P');
    expect(failure(file(`<Plane${attrs(MAX_ATTRIBUTES + 1)}><Name>P</Name>${wing('W')}</Plane>`))).toMatchObject({
      code: 'damaged',
      message: 'The XML file is damaged at line 4: a tag is malformed.',
    });
    expect(failure(`<explane version="1.0"${attrs(MAX_ATTRIBUTES + 1)}>${plane('P', wing('W'))}</explane>`)).toMatchObject({
      code: 'damaged',
      message: 'The XML file is damaged at line 1: a tag is malformed.',
    });
    // The root keeps its attributes: the last version counts.
    expect(readXflr5Xml(`<explane version="2.0"${attrs(MAX_ATTRIBUTES - 2)} version="1.0">${plane('P', wing('W'))}</explane>`).version).toBe('1.0');
  });

  it('refuses sizes beyond the limits', () => {
    expect(failure(' '.repeat(MAX_PROJECT_BYTES + 1))).toMatchObject({ code: 'too-large', message: 'The file is larger than 100 MB.' });
    expect(failure(file('<a>'.repeat(MAX_DEPTH) + '</a>'.repeat(MAX_DEPTH))).code).toBe('too-large');
    expect(failure(file('<a/>'.repeat(MAX_ELEMENTS)))).toMatchObject({ code: 'too-large', message: 'The XML file holds more than 1,000,000 elements.' });
    const many = section().repeat(LIMITS.maxSections + 1);
    expect(failure(file(plane('P', wing('W', { sections: many })))).message).toBe('A wing of the XML file has more than 20,000 sections.');
    expect(failure(file(plane('P', wing('W')).repeat(MAX_PLANES + 1)))).toMatchObject({ code: 'too-large', message: 'The XML file holds more than 10,000 planes.' });
  });

  it('reads long and hostile inputs in linear time', () => {
    const t0 = performance.now();
    // 20,000 sections read (the most a wing may have).
    const big = file(units() + plane('P', wing('W', { sections: Array.from({ length: LIMITS.maxSections }, (_, i) => section({ y: i })).join('') })));
    expect(readXflr5Xml(big).planes[0].wings[0].sections).toHaveLength(LIMITS.maxSections);
    // Long runs where a backtracking pattern would be quadratic.
    const hostile = [
      file(`<Plane${' '.repeat(2_000_000)}x>`),
      file(`<Plane a="${'x'.repeat(2_000_000)}`),
      file(plane('P', wing('W', { sections: section({ chord: '1'.repeat(2_000_000) + 'x' }) }))),
      file(plane(`&#${'1'.repeat(2_000_000)}`, wing('W'))),
      file(plane('P', wing('W', { position: ','.repeat(2_000_000) }))),
      `<!DOCTYPE x [${'['.repeat(2_000_000)}`,
    ];
    for (const text of hostile) {
      try {
        readXflr5Xml(text);
      } catch (e) {
        expect(e).toBeInstanceOf(XflrError);
      }
    }
    expect(performance.now() - t0).toBeLessThan(5000);
  });

  it('speaks German after setLanguage', () => {
    setLanguage('de');
    expect(failure(fixture('xml_mm/0.w3.wing.xml')).message).toBe('Der XML-Flügel „Fin“ ist ein Seitenleitwerk; importiert werden können nur eine Tragfläche oder ein Höhenleitwerk.');
    expect(failure('<explane version="1.0">\n<Plane>\n</explane>').message).toBe('Die XML-Datei ist in Zeile 3 beschädigt: </explane> schließt nicht <Plane>.');
    const r = readXflr5Xml(file(plane('P', wing('A') + wing('B') + wing('C'))));
    expect(r.warnings).toEqual(['Das Flugzeug „P“ hat mehr als eine Tragfläche: „C“ ersetzt wie in XFLR5 „A“.']);
  });
});
