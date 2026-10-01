// flow5 project reader (src/import/fl5.js): projects written by flow5 7.57 and 7.56 from Wingdesigner's
// own inputs (test/fixtures/flow5/SOURCE.md), and the layouts of other record formats from the test
// writer (test/fl5-writer.js).
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { setLanguage } from '../src/i18n/index.js';
import { XflrError } from '../src/import/errors.js';
import { FL5_FORMATS, readFl5, readFl5Bytes, readProjectFile } from '../src/import/fl5.js';
import { sniffXflr5 } from '../src/import/xfl.js';
import { FOIL_POINTS, LATEST, V753, writeFl5 } from './fl5-writer.js';

const fixture = (name) => new Uint8Array(readFileSync(new URL(`fixtures/flow5/${name}`, import.meta.url)));

/** The XflrError that readFl5Bytes() throws for `bytes` (other errors fail the test), or null. */
function failure(bytes) {
  try {
    readFl5Bytes(bytes);
  } catch (err) {
    if (err instanceof XflrError) return err;
    throw err;
  }
  return null;
}

/** Wing values as [y, chord, offset, dihedral, twist, right foil] per section. */
const sectionRows = (w) => w.sections.map((s) => [s.y, s.chord, s.offset, s.dihedral, s.twist, s.rightFoil]);

const WINGS = [
  { name: 'Main', type: 0, sections: [{ right: 'NACA 0009', chord: 0.2, y: 0 }, { right: 'NACA 0009', chord: 0.1, y: 0.5, offset: 0.05, dihedral: 3, twist: -2 }] },
  { name: 'Tail', type: 2, position: [0.7, 0.01, 0.05], rx: 4, ry: -1.5, sections: [{ right: 'NACA 0009', chord: 0.1, y: 0 }, { right: 'NACA 0009', chord: 0.05, y: 0.2 }] },
  { name: 'Fin', type: 3, twoSided: false, rx: -90, sections: [{ right: 'NACA 0009', chord: 0.1, y: 0 }, { right: 'NACA 0009', chord: 0.05, y: 0.15 }] },
  { name: 'Old second', type: 1, sections: [{ right: 'NACA 0009', chord: 0.1, y: 0 }, { right: 'NACA 0009', chord: 0.05, y: 0.1 }] },
  { name: 'Other', type: 4, sections: [{ right: 'NACA 0009', chord: 0.1, y: 0 }, { right: 'NACA 0009', chord: 0.05, y: 0.1 }] },
];
const SPEC = {
  foils: [{ name: 'NACA 0009', points: FOIL_POINTS, te: [true, 4, 0.72, 0.5] }],
  polars: 2,
  results: 2,
  planes: [
    { name: 'Wings', wings: WINGS, bodies: [100001, 100002, 100003, 100004, 100005, 100006] },
    { name: 'Mesh', mesh: true },
  ],
};

afterEach(() => setLanguage('en'));

describe('flow5 projects written by flow5', () => {
  it('reads the airfoils and the wings of a flow5 7.57 project', () => {
    const f = readFl5Bytes(fixture('basic.fl5'));
    expect([f.kind, f.program, f.format, f.lengthUnit, f.unitName, f.wingOnly, f.warnings]).toEqual(['fl5', 'flow5', 500754, 1000, 'm', false, []]);
    expect([...f.foils.keys()]).toEqual(['NACA 0009', 'NACA 2412']);
    const naca = f.foils.get('NACA 2412');
    // 99 points from the trailing edge over the upper side to the nose at (0, 0) and back.
    expect(naca.points).toHaveLength(99);
    expect(naca.points[49]).toEqual([0, 0]);
    expect(naca.points[0][0]).toBe(1);
    expect(naca.flaps.te).toEqual({ on: false, angle: 0, hingeX: 70, hingeY: 50 });
    const [plane] = f.planes;
    expect([plane.name, plane.kind, plane.bodies]).toEqual(['Test plane', 'wings', 0]);
    expect(plane.wings.map((w) => [w.name, w.type, w.twoSided, w.position, w.tilt, w.roll])).toEqual([
      ['Main', 'main', true, { x: 0, y: 0, z: 0 }, 0, 0],
      ['Stab', 'elevator', true, { x: 0.8, y: 0, z: 0.05 }, -1.5, 0],
      ['Fin', 'fin', false, { x: 0.8, y: 0, z: 0.05 }, 0, -90],
    ]);
    expect(sectionRows(plane.wings[0])).toEqual([
      [0, 0.24, 0, 3, 0, 'NACA 2412'],
      [0.4, 0.2, 0.01, 6, -1, 'NACA 2412'],
      [0.7, 0.12, 0.05, 0, -2, 'NACA 0009'],
    ]);
  });

  it('walks the bodies, foil analyses, saved foil results and a mesh plane to the planes behind them', () => {
    const f = readFl5Bytes(fixture('full.fl5'));
    // flow5 keeps its planes sorted by name.
    expect(f.planes.map((p) => [p.name, p.kind, p.bodies, p.wings.length])).toEqual([
      ['Mesh plane', 'mesh', 0, 0],
      ['Second', 'wings', 0, 1],
      ['Tandem', 'wings', 3, 6],
    ]);
    const tandem = f.planes[2];
    expect(tandem.wings.map((w) => [w.name, w.type, w.twoSided, w.tilt, w.roll])).toEqual([
      ['Front', 'main', true, 1, 0],
      ['Rear', 'main', true, 0, 0],
      ['Vee', 'elevator', true, -2, 10],
      ['Canard', 'other', true, 2, 0],
      ['Tilted other', 'other', true, 0, 30],
      ['Fin', 'fin', false, 0, -90],
    ]);
    expect(f.foils.get('Flapped 2410').flaps.te).toEqual({ on: true, angle: 5, hingeX: 75, hingeY: 50 });
  });

  it('reads a flow5 7.56 project with a sections body, which holds its section points after the frames', () => {
    const f = readFl5Bytes(fixture('v756.fl5'));
    const [plane] = f.planes;
    expect([plane.name, plane.bodies, plane.wings.map((w) => w.name)]).toEqual(['Sections body', 2, ['Main', 'Tail']]);
    expect(sectionRows(plane.wings[0])).toEqual([
      [0, 0.22, 0, 4, 0, 'NACA 2412'],
      [0.6, 0.14, 0.04, 0, -2, 'NACA 2412'],
    ]);
  });

  it('reads through windows of any size, and Open dispatches by the first number', async () => {
    const bytes = fixture('full.fl5');
    const whole = readFl5Bytes(bytes);
    expect(await readFl5(new Blob([bytes]), { windowSize: 1000 })).toEqual(whole);
    expect(await readProjectFile(new Blob([bytes]), { windowSize: 4096 })).toEqual(whole);
    expect(sniffXflr5(bytes)).toBe(true);
    const xfl = new Uint8Array(readFileSync(new URL('fixtures/xflr5/fixtures_v662.xfl', import.meta.url)));
    expect((await readProjectFile(new Blob([xfl]))).kind).toBe('xfl');
  });
});

describe('flow5 record layouts', () => {
  it('reads every body kind, foil analyses and results, and a mesh plane in the formats of flow5 7.57', () => {
    const f = readFl5Bytes(writeFl5(SPEC));
    expect(f.format).toBe(500754);
    expect(f.planes.map((p) => [p.name, p.kind, p.bodies])).toEqual([
      ['Wings', 'wings', 6],
      ['Mesh', 'mesh', 0],
    ]);
    expect(f.planes[0].wings.map((w) => [w.name, w.type, w.twoSided, w.position, w.tilt, w.roll])).toEqual([
      ['Main', 'main', true, { x: 0, y: 0, z: 0 }, 0, 0],
      ['Tail', 'elevator', true, { x: 0.7, y: 0.01, z: 0.05 }, -1.5, 4],
      ['Fin', 'fin', false, { x: 0, y: 0, z: 0 }, 0, -90],
      ['Old second', 'other', true, { x: 0, y: 0, z: 0 }, 0, 0],
      ['Other', 'other', true, { x: 0, y: 0, z: 0 }, 0, 0],
    ]);
    expect(sectionRows(f.planes[0].wings[0])).toEqual([
      [0, 0.2, 0, 0, 0, 'NACA 0009'],
      [0.5, 0.1, 0.05, 3, -2, 'NACA 0009'],
    ]);
    expect(f.foils.get('NACA 0009')).toEqual({ name: 'NACA 0009', points: FOIL_POINTS, flaps: { le: { on: false, angle: 0, hingeX: 20, hingeY: 50 }, te: { on: true, angle: 4, hingeX: 72, hingeY: 50 } } });
  });

  it('reads the formats of flow5 7.53 (project 500750) and the older record layouts', () => {
    expect(readFl5Bytes(writeFl5({ ...SPEC, formats: V753 })).planes[0].wings).toEqual(readFl5Bytes(writeFl5(SPEC)).planes[0].wings);
    const old = { ...V753, lineStyle: 0, foil: 500750, foilPolar: 500001, part: 500001, plane: 500001, fuse: 500001, meshPlane: 500003, mesh: 500001 };
    expect(readFl5Bytes(writeFl5({ ...SPEC, formats: old })).planes.map((p) => p.name)).toEqual(['Wings', 'Mesh']);
    expect(readFl5Bytes(writeFl5({ ...SPEC, formats: { meshPlane: 500001 } })).planes[1].kind).toBe('mesh');
    // A sections body of a part format below 500757 (flow5 7.56 and older) holds its section points;
    // from 500757 on it does not. Read the other way, either file loses its place.
    expect(readFl5Bytes(writeFl5({ ...SPEC, formats: { part: 500755 } })).planes).toHaveLength(2);
    const sections = { ...SPEC, planes: [{ name: 'S', wings: WINGS.slice(0, 1), bodies: [100006] }] };
    const latest = writeFl5(sections);
    const older = writeFl5({ ...sections, formats: { part: 500755 } });
    // Section points: format, count, points per section, 2 × 3 points, fit precision, spares (172 bytes);
    // the part formats from 500757 on hold one double more (the wing's and the body's part: 16 bytes).
    expect(older.length - latest.length).toBe(172 - 16);
    expect(readFl5Bytes(latest).planes[0].bodies).toBe(1);
    expect(readFl5Bytes(older).planes[0].bodies).toBe(1);
  });

  it('refuses other project formats, unknown plane and body kinds, and names the damage', () => {
    setLanguage('en');
    expect(FL5_FORMATS).toEqual([500750, 500754]);
    const plain = writeFl5({ planes: [{ name: 'P', wings: WINGS.slice(0, 1) }] });
    const at = (format) => {
      const copy = plain.slice();
      new DataView(copy.buffer).setInt32(0, format);
      return copy;
    };
    expect(failure(at(500006))).toMatchObject({ code: 'flow5-old', message: 'The file is a flow5 project of format 500006, written by flow5 7.26 or older: open it in a current flow5 and save it, or export the plane as XML.' });
    expect(failure(at(500755))).toMatchObject({ code: 'flow5-new', message: 'The file is a flow5 project of format 500755, newer than this import reads (up to 500754, flow5 7.54 to 7.57): export the plane as XML in flow5.' });
    expect(failure(writeFl5({ planes: [] }))).toMatchObject({ code: 'no-plane', message: 'The project holds no plane.' });
    // A plane kind that flow5 writes as −1 without a plane after it.
    const unknown = plain.slice();
    new DataView(unknown.buffer).setInt32(kindStart(plain), -1);
    expect(failure(unknown)).toMatchObject({ code: 'damaged', message: 'Plane 1 of the file is of a kind this import does not read (kind -1).' });
    expect(failure(writeFl5({ planes: [{ name: 'P', wings: [], bodies: [100007] }] }))).toMatchObject({ code: 'damaged', message: expect.stringMatching(/^The file is damaged or cut off at byte \d+ \(in the body of a plane\)\.$/) });
    // Cut anywhere before the end of the planes: damaged, with the part being read.
    const cut = failure(plain.slice(0, plain.length - 60));
    expect(cut.code).toBe('damaged');
    expect(cut.message).toMatch(/^The file is damaged or cut off at byte [\d,]+ \(in (a wing|the list of planes|a plane)\)\.$/);
    setLanguage('de');
    expect(failure(at(500755)).message).toBe('Die Datei ist ein flow5-Projekt im Format 500755, neuer als dieser Import liest (bis 500754, flow5 7.54 bis 7.57): das Flugzeug in flow5 als XML exportieren.');
  });

  it('keeps the latest of two airfoils of one name and leaves out airfoils without a name', () => {
    const second = FOIL_POINTS.map(([x, y]) => [x, 2 * y]);
    const f = readFl5Bytes(writeFl5({ foils: [{ name: 'A', points: FOIL_POINTS }, { name: '', points: FOIL_POINTS }, { name: 'A', points: second }], planes: [{ name: 'P', wings: WINGS.slice(0, 1) }] }));
    expect([...f.foils.keys()]).toEqual(['A']);
    expect(f.foils.get('A').points).toEqual(second);
  });

  it('writes what follows the planes as flow5 does: the reading stops after the last plane', () => {
    const f = readFl5Bytes(writeFl5({ planes: [{ name: 'P', wings: WINGS.slice(0, 1) }], tail: [7, 7, 7] }));
    expect(f.planes).toHaveLength(1);
    expect(LATEST.project).toBe(500754);
  });
});

/** Offset of the plane kind of the only plane of a writeFl5() file of one plane of one wing. */
function kindStart(bytes) {
  // The plane list: i32 count 1, then i32 kind 0, i32 plane format 500003: the first such run.
  const dv = new DataView(bytes.buffer, bytes.byteOffset);
  for (let o = 0; o + 12 <= bytes.length; o++) {
    if (dv.getInt32(o) === 1 && dv.getInt32(o + 4) === 0 && dv.getInt32(o + 8) === LATEST.plane) return o + 4;
  }
  return -1;
}
