// flow5 plane and wing XML reader (src/import/fl5xml.js): files written by flow5 7.57 from
// Wingdesigner's own inputs (test/fixtures/flow5/SOURCE.md) and hand-written files for the rules.
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { setLanguage } from '../src/i18n/index.js';
import { XflrError } from '../src/import/errors.js';
import { foilFileName, readFlow5Xml, readPlaneXml } from '../src/import/fl5xml.js';

const fixture = (name) => readFileSync(new URL(`fixtures/flow5/${name}`, import.meta.url), 'utf8');

/** The XflrError that readFlow5Xml() throws for `text` (other errors fail the test), or null. */
function failure(text) {
  try {
    readFlow5Xml(text);
  } catch (err) {
    if (err instanceof XflrError) return err;
    throw err;
  }
  return null;
}

const section = (y, chord, extra = '') => `<Section><y_position>${y}</y_position><Chord>${chord}</Chord>${extra}<Right_Side_FoilName>F</Right_Side_FoilName></Section>`;
const wing = (name, body = '') => `<wing><Name>${name}</Name>${body}<Sections>${section(0, 200)}${section(500, 100)}</Sections></wing>`;
const plane = (name, wings) => `<Plane><Name>${name}</Name>${wings}</Plane>`;
const file = (body, units = '<Units><meter_to_length_unit>0.001</meter_to_length_unit></Units>') => `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE flow5>\n<xflplane version="1.0">${units}${body}</xflplane>`;

afterEach(() => setLanguage('en'));

describe('flow5 XML files written by flow5', () => {
  it('reads a plane file in millimetres: wings in file order with type, sides, position and angles', () => {
    const f = readFlow5Xml(fixture('full-plane.xml'));
    expect([f.kind, f.program, f.version, f.lengthUnit, f.unitName, f.wingOnly, f.warnings]).toEqual(['xml', 'flow5', '1.0', 1, 'mm', false, []]);
    const [p] = f.planes;
    expect([p.name, p.bodies]).toEqual(['Tandem', 3]);
    expect(p.wings.map((w) => [w.name, w.type, w.twoSided, w.position, w.tilt, w.roll])).toEqual([
      ['Front', 'main', true, { x: 0, y: 0, z: 0 }, 1, 0],
      ['Rear', 'main', true, { x: 600, y: 0, z: 50 }, 0, 0],
      ['Vee', 'elevator', true, { x: 1000, y: 0, z: 80 }, -2, 10],
      ['Canard', 'other', true, { x: -300, y: 0, z: 20 }, 2, 0],
      ['Tilted other', 'other', true, { x: 200, y: 0, z: 100 }, 0, 30],
      ['Fin', 'fin', false, { x: 1000, y: 0, z: 80 }, 0, -90],
    ]);
    expect(p.wings[0].sections.map((s) => [s.y, s.chord, s.offset, s.dihedral, s.twist, s.rightFoil, s.leftFoil, s.rightFile])).toEqual([
      [0, 200, 0, 2, 0, 'NACA 2412', 'NACA 2412', null],
      [500, 150, 30, 0, -1, 'Flapped 2410', 'Flapped 2410', null],
    ]);
  });

  it('takes the airfoil names of .dat file references from the file names', () => {
    const f = readFlow5Xml(fixture('full-plane-files.xml'));
    expect(f.planes[0].wings[0].sections.map((s) => [s.rightFoil, s.rightFile, s.leftFile])).toEqual([
      ['NACA 2412', 'NACA 2412.dat', 'NACA 2412.dat'],
      ['Flapped 2410', 'Flapped 2410.dat', 'Flapped 2410.dat'],
    ]);
    expect(foilFileName(' foils/Clark Y.DAT ')).toBe('Clark Y');
    expect(foilFileName('C:\\foils\\e387.dat')).toBe('e387');
  });

  it('reads a wing file in metres without position or angles', () => {
    const f = readFlow5Xml(fixture('basic-wing.xml'));
    expect([f.lengthUnit, f.unitName, f.wingOnly, f.planes.length]).toEqual([1000, 'm', true, 1]);
    const [w] = f.planes[0].wings;
    expect([w.name, w.type, w.position, w.tilt, w.roll]).toEqual(['Stab', 'elevator', { x: 0, y: 0, z: 0 }, 0, 0]);
    expect(w.sections.map((s) => [s.y, s.chord, s.offset])).toEqual([
      [0, 0.12, 0],
      [0.2, 0.08, 0.02],
    ]);
  });

  it('routes XFLR5 and flow5 XML files to their readers', () => {
    expect(readPlaneXml(fixture('basic-plane.xml')).program).toBe('flow5');
    const xflr5 = readPlaneXml(readFileSync(new URL('fixtures/xflr5/xml_mm/0.plane.xml', import.meta.url), 'utf8'));
    expect([xflr5.kind, xflr5.program]).toEqual(['xml', undefined]);
  });
});

describe('flow5 XML rules', () => {
  it('reads Type without case but not trimmed, as flow5 does, and booleans with empty elements kept at their default', () => {
    const types = ['MAINWING', 'elevator', 'Fin', 'OTHERWING', 'SECONDWING', ' FIN'].map((t, i) => wing(`W${i}`, `<Type>${t}</Type>`)).join('');
    expect(readFlow5Xml(file(plane('P', types))).planes[0].wings.map((w) => w.type)).toEqual(['main', 'elevator', 'fin', 'other', 'other', 'other']);
    const flags = wing('A', '<Two_Sided/><symmetric>TRUE</symmetric><Closed_Inner_Side> true </Closed_Inner_Side>') + wing('B', '<Two_Sided>no</Two_Sided>');
    expect(readFlow5Xml(file(plane('P', flags))).planes[0].wings.map((w) => [w.twoSided, w.symmetric, w.closedInner])).toEqual([
      [true, true, true],
      [false, true, false],
    ]);
  });

  it('applies <Units> to what follows, accepts the legacy name, and keeps missing values at 0', () => {
    const f = readFlow5Xml(file(`${plane('A', wing('W'))}<Units><length_unit_to_meter>0.01</length_unit_to_meter></Units>${plane('B', wing('W'))}`));
    expect(f.planes.map((p) => p.wings[0].sections[1].y)).toEqual([500, 5000]);
    expect(f.warnings).toEqual(['The length unit (<Units>) comes after a plane or wing; as in flow5, it applies only to the planes and wings that follow it.']);
    const bare = readFlow5Xml(file(plane('P', '<wing><Sections><Section/></Sections></wing>'), ''));
    expect([bare.lengthUnit, bare.unitName]).toEqual([1000, 'm']);
    expect(bare.planes[0].wings[0]).toMatchObject({ name: '', type: 'other', twoSided: true, sections: [{ y: 0, chord: 0, offset: 0, dihedral: 0, twist: 0, rightFoil: '' }] });
  });

  it('warns of values that are no numbers and of a position of fewer than 3 values', () => {
    const f = readFlow5Xml(file(plane('P', wing('W', '<Position>1, 2</Position><Rx_angle>ten</Rx_angle>'))));
    expect(f.planes[0].wings[0].roll).toBeNaN();
    expect(f.warnings).toEqual([
      'Plane "P", wing "W": Position "1, 2" holds fewer than 3 values; the wing is placed at 0, 0, 0 as in flow5.',
      'Plane "P", wing "W": Rx_angle "ten" is not a number.',
    ]);
  });

  it('lists several planes, skips unknown elements and reads the last wing of a wing file', () => {
    const f = readFlow5Xml(file(`<Extra><Plane/></Extra>${plane('A', wing('W'))}${plane('B', wing('V'))}`));
    expect(f.planes.map((p) => p.name)).toEqual(['A', 'B']);
    const w = readFlow5Xml(`<xflwing version="1.0">${wing('One', '<Position>5, 5, 5</Position>')}${wing('Two', '<Type>ELEVATOR</Type><Ry_angle>3</Ry_angle>')}</xflwing>`);
    expect(w.planes[0].wings.map((x) => [x.name, x.type, x.position, x.tilt])).toEqual([['Two', 'elevator', { x: 0, y: 0, z: 0 }, 0]]);
    expect(w.warnings).toEqual(['The file holds 2 wings outside a plane; flow5 reads only the last one, "Two", and so does this import.']);
  });

  it('refuses other files with a reason', () => {
    expect(failure('<xflfuse version="1.0"/>')).toMatchObject({ code: 'not-plane-xml', message: 'The file is a flow5 XML file without a plane or wing (root element "xflfuse").' });
    expect(failure('<xflplane version="2.0"/>').message).toBe('The file is not a flow5 plane or wing file (root element "xflplane", version "2.0").');
    // flow5 compares the plane root with case.
    expect(failure('<XFLPLANE version="1.0"/>').message).toBe('The file is not a flow5 plane or wing file (root element "XFLPLANE", version "1.0").');
    expect(failure('text')).toMatchObject({ code: 'not-plane-xml', message: 'The file is not a flow5 plane or wing file: it does not start with an XML element.' });
    expect(failure(file(''))).toMatchObject({ code: 'no-plane', message: 'The XML file holds no plane and no wing.' });
    expect(failure(file(plane('P', wing('W')), '<Units><meter_to_length_unit>0</meter_to_length_unit></Units>')).message).toBe('The length unit of the XML file is not valid: meter_to_length_unit is "0".');
    setLanguage('de');
    expect(failure('<xflfuse version="1.0"/>').message).toBe('Die Datei ist eine flow5-XML-Datei ohne Flugzeug oder Flügel (Wurzelelement „xflfuse“).');
  });
});
