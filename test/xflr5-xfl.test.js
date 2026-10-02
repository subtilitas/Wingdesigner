import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { setLanguage } from '../src/i18n/index.js';
import { XflrError } from '../src/import/errors.js';
import {
  MAX_FOILS,
  MAX_FOIL_POINTS,
  MAX_PLANES,
  MAX_TOTAL_SECTIONS,
  MAX_XFL_BYTES,
  MAX_XFLR5_FOIL_POINTS,
  readXfl,
  readXflBytes,
  sniffXflr5,
  startsLikeXfl,
} from '../src/import/xfl.js';
import { LIMITS } from '../src/model/project.js';
import { POINTS, SECTIONS, writeProject } from './xflr5-writer.js';

const fixture = (name) => new Uint8Array(readFileSync(new URL(`fixtures/xflr5/${name}`, import.meta.url)));
const FIXTURES = ['fixtures_v662.xfl', 'uaslab/Rascal110.xfl', 'uaslab/UltraStick25e_v662_stripped.xfl'];
const hex = (bytes) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join(' ');

/** The XflrError that readXflBytes() throws for `bytes` (other errors fail the test), or null. */
function failure(bytes) {
  try {
    readXflBytes(bytes);
  } catch (err) {
    if (err instanceof XflrError) return err;
    throw err;
  }
  return null;
}

/** Offset of the first mark with `label` (the n-th with `nth`). */
const markAt = (marks, label, nth = 0) => marks.filter((m) => m.label === label)[nth].at;

/** Copy of `bytes` with the i32 at `at` replaced. */
function patchI32(bytes, at, value) {
  const copy = bytes.slice();
  new DataView(copy.buffer).setInt32(at, value);
  return copy;
}

/** A Blob look-alike that records the byte ranges it hands out. */
function countingBlob(bytes) {
  const blob = new Blob([bytes]);
  const loads = [];
  return {
    size: blob.size,
    loads,
    slice(a, b) {
      loads.push([a, b]);
      return blob.slice(a, b);
    },
  };
}

afterEach(() => setLanguage('en'));

describe('XFLR5 .xfl reader: fixture files', () => {
  it('follows the byte layout of fixtures_v662.xfl', () => {
    const b = fixture('fixtures_v662.xfl');
    expect(b.length).toBe(11092);
    expect(hex(b.subarray(0, 32))).toBe('00 03 0d 42 00 00 00 00 00 00 00 04 00 00 00 01 00 00 00 00 00 00 00 01 00 00 00 00 00 03 0d 4e');
    const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
    expect([728, 732, 860, 902].map((o) => dv.getInt32(o))).toEqual([2, 100002, 100001, 3]);
    expect(b[901]).toBe(1);
    expect([942, 950, 958, 966, 974].map((o) => dv.getFloat64(o))).toEqual([0.24, 0, 0, 3, 0]);
    expect([982, 986, 990, 994].map((o) => dv.getInt32(o))).toEqual([13, 8, 1, 0]);
    // Cut off at the start of an item, the error names the offset of that item.
    const cuts = [
      [4, 'header'],
      [28, 'header'],
      [728, 'planes'],
      [732, 'plane'],
      [736, 'plane'],
      [758, 'plane'],
      [828, 'plane'],
      [860, 'wing'],
      [864, 'wing'],
      [886, 'wing'],
      [890, 'wing'],
      [901, 'wing'],
      [902, 'wing'],
    ];
    for (const [at, what] of cuts) expect(failure(b.subarray(0, at)), `cut at ${at}`).toMatchObject({ code: 'damaged', offset: at, what });
    // 3 sections of at least 64 bytes each must fit behind their count.
    for (const at of [906, 924, 942, 982, 998]) expect(failure(b.subarray(0, at))).toMatchObject({ code: 'damaged', offset: 902, what: 'wing' });
    // Cut in the middle of a string: the offset of the string.
    expect(failure(b.subarray(0, 740))).toMatchObject({ code: 'damaged', offset: 736, what: 'plane' });
  });

  it('reads the planes, wings and airfoils of fixtures_v662.xfl', async () => {
    const r = await readXfl(new Blob([fixture('fixtures_v662.xfl')]));
    expect(r).toMatchObject({ kind: 'xfl', format: 200002, version: null, lengthUnit: 1000, unitName: 'm', wingOnly: false, foilError: null, warnings: [] });
    expect(r.planes.map((p) => p.name)).toEqual(['Fixture A', 'Fixture B']);
    const [a, b] = r.planes;
    expect(a.description).toBe('Synthetic Wingdesigner test plane');
    // Fixture A: main wing, elevator and fin; Fixture B: the main wing only (stab and fin false).
    expect(a.wings.map((w) => w?.name ?? null)).toEqual(['Main Wing', null, 'Elevator', 'Fin']);
    expect(b.wings.map((w) => w?.name ?? null)).toEqual(['Flying Wing', null, null, null]);
    expect(a.wings[0]).toEqual({
      name: 'Main Wing',
      description: '',
      symmetric: true,
      position: { x: 0, y: 0, z: 0 },
      tilt: 2,
      sections: [
        { rightFoil: 'Clark Y', leftFoil: 'Clark Y', chord: 0.24, y: 0, offset: 0, dihedral: 3, twist: 0 },
        { rightFoil: 'Clark Y', leftFoil: 'Clark Y', chord: 0.22, y: 0.5, offset: 0.01, dihedral: 6, twist: -1 },
        { rightFoil: 'NACA 0009', leftFoil: 'NACA 0009', chord: 0.15, y: 0.9, offset: 0.045, dihedral: 0, twist: -2.5 },
      ],
    });
    expect(a.wings[2]).toMatchObject({ name: 'Elevator', position: { x: 0.65, y: 0, z: 0.04 }, tilt: -1.5 });
    expect(a.wings[2].sections).toEqual([
      { rightFoil: 'NACA 0009', leftFoil: 'NACA 0009', chord: 0.11, y: 0, offset: 0, dihedral: 0, twist: 0 },
      { rightFoil: 'NACA 0009', leftFoil: 'NACA 0009', chord: 0.07, y: 0.23, offset: 0.025, dihedral: 0, twist: 0 },
    ]);
    expect(a.wings[3]).toMatchObject({ name: 'Fin', position: { x: 0.68, y: 0, z: 0 }, tilt: 0 });
    // Fixture B: the 30° sits on the last section (unused by XFLR5); the outer panel has 2°.
    expect(b.wings[0]).toMatchObject({ position: { x: 0.05, y: 0, z: 0.01 }, tilt: 1 });
    expect(b.wings[0].sections.map((s) => [s.y, s.chord, s.offset, s.dihedral, s.twist])).toEqual([
      [0, 0.3, 0, 0, 2],
      [0.25, 0.26, 0.06, 2, 1],
      [0.6, 0.2, 0.16, 2, -1],
      [0.75, 0.12, 0.24, 30, -3],
    ]);
    expect([...r.foils.keys()]).toEqual(['Clark Y', 'NACA 0009']);
    expect(r.foils.get('Clark Y').points).toHaveLength(33);
    expect(r.foils.get('NACA 0009').points).toHaveLength(81);
    expect(r.foils.get('NACA 0009')).toMatchObject({ name: 'NACA 0009', flaps: { le: { on: false, angle: 0, hingeX: 20, hingeY: 50 }, te: { on: false, angle: 0, hingeX: 70, hingeY: 50 } } });
    const [x0, y0] = r.foils.get('NACA 0009').points[0];
    expect(x0).toBeCloseTo(1, 6);
    expect(Math.abs(y0)).toBeLessThan(0.01);
  });

  it('reads the old formats of Rascal110.xfl (200001, plane 100001, WPolar 200013, foil 100006, body, flaps at 0°)', () => {
    const r = readXflBytes(fixture('uaslab/Rascal110.xfl'));
    expect(r.format).toBe(200001);
    expect(r.planes.map((p) => p.name)).toEqual(['Rascal 110']);
    const [main, second, elevator, fin] = r.planes[0].wings;
    expect(second).toBeNull();
    expect(main.sections).toHaveLength(13);
    expect(main.position.x).toBeCloseTo(0.23495, 12);
    expect(main.position.z).toBeCloseTo(0.26035, 12);
    expect(main.position.y).toBe(0);
    expect(main.tilt).toBe(0);
    expect([...new Set(main.sections.map((s) => s.rightFoil))]).toEqual(['Rascal Foil', 'Rascal Foil Flap']);
    expect(elevator.sections).toHaveLength(9);
    expect(elevator).toMatchObject({ name: 'Elevator', position: { x: 1.42875, y: 0, z: 0.08255 }, tilt: 0.1 });
    // The last section's dihedral is unused; all others are 0.
    expect(elevator.sections.map((s) => s.dihedral)).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 5]);
    expect(fin.sections).toHaveLength(5);
    expect([...r.foils.keys()]).toEqual(['Flat Plate NACA 0005', 'Flat Plate NACA 0005 Elev', 'Flat Plate NACA 0005 Rudder', 'NACA 0005', 'Rascal Foil', 'Rascal Foil Flap']);
    expect(r.foils.get('Rascal Foil').points).toHaveLength(61);
    expect(r.foils.get('Flat Plate NACA 0005 Elev').flaps.te).toEqual({ on: true, angle: 0, hingeX: 82.7, hingeY: 50 });
    expect(r.foils.get('Rascal Foil Flap').flaps.te).toEqual({ on: true, angle: 0, hingeX: 82.26, hingeY: 50 });
    expect(r.foils.get('Rascal Foil').flaps.te.on).toBe(false);
  });

  it('reads the same plane from UltraStick25e_v662_stripped.xfl as UltraStick25e.xml states in inches', () => {
    const r = readXflBytes(fixture('uaslab/UltraStick25e_v662_stripped.xfl'));
    expect(r.format).toBe(200002);
    expect(r.planes[0].name).toBe('UltraStick25e');
    expect(r.foils.size).toBe(8);
    const xml = new TextDecoder().decode(fixture('uaslab/UltraStick25e.xml'));
    const value = (block, tag) => block.match(new RegExp(`<${tag}>([^<]*)</${tag}>`, 'i'))[1];
    const blocks = xml.split('<wing>').slice(1);
    for (const [slot, type] of [
      [0, 'MAINWING'],
      [2, 'ELEVATOR'],
      [3, 'FIN'],
    ]) {
      const block = blocks.find((b) => value(b, 'Type') === type);
      const w = r.planes[0].wings[slot];
      expect(w.name).toBe(value(block, 'Name'));
      const pos = value(block, 'Position').split(',').map(Number);
      expect(Math.abs(w.position.x * 1000 - pos[0] * 25.4)).toBeLessThan(1e-9);
      expect(Math.abs(w.position.z * 1000 - pos[2] * 25.4)).toBeLessThan(1e-9);
      expect(w.tilt).toBe(Number(value(block, 'Tilt_angle')));
      const sections = block.split('<Section>').slice(1);
      expect(w.sections).toHaveLength(sections.length);
      sections.forEach((s, i) => {
        const q = w.sections[i];
        for (const [key, tag] of [
          ['y', 'y_position'],
          ['chord', 'Chord'],
          ['offset', 'xOffset'],
        ]) {
          expect(Math.abs(q[key] * 1000 - Number(value(s, tag)) * 25.4), `${type} section ${i} ${tag}`).toBeLessThan(1e-9);
        }
        expect(q.dihedral).toBe(Number(value(s, 'Dihedral')));
        expect(q.twist).toBe(Number(value(s, 'Twist')));
        expect(q.rightFoil).toBe(value(s, 'Right_Side_FoilName'));
        expect(q.leftFoil).toBe(value(s, 'Left_Side_FoilName'));
      });
    }
  });

  it('stops at the end of the airfoils (byte 10180 of fixtures_v662.xfl, 91794 of Rascal110.xfl)', () => {
    for (const [name, end] of [
      ['fixtures_v662.xfl', 10180],
      ['uaslab/Rascal110.xfl', 91794],
    ]) {
      const b = fixture(name);
      const full = readXflBytes(b);
      expect(readXflBytes(b.subarray(0, end))).toEqual(full);
      const cut = readXflBytes(b.subarray(0, end - 1));
      expect(cut.planes).toEqual(full.planes);
      expect(cut.foils).toBeNull();
      expect(cut.foilError).toMatchObject({ what: 'airfoil' });
      expect(cut.foilError.offset).toBeLessThan(end);
      expect(cut.warnings).toHaveLength(1);
      expect(cut.warnings[0]).toMatch(/^The airfoils could not be read\. The file is damaged or cut off at byte \d+ \(in an airfoil\)\. Pick or upload them\.$/);
    }
  });

  it('gives the same result through a 1 KB window as from a whole buffer', async () => {
    for (const name of FIXTURES) {
      const b = fixture(name);
      const whole = readXflBytes(b);
      expect(await readXfl(new Blob([b]), { windowSize: 1024 }), name).toEqual(whole);
      expect(await readXfl(new Blob([b])), name).toEqual(whole);
    }
  });

  it('loads only windows up to the end of the airfoils, not the results behind them', async () => {
    const blob = countingBlob(fixture('uaslab/Rascal110.xfl'));
    await readXfl(blob, { windowSize: 1024 });
    expect(blob.loads.length).toBeGreaterThan(10);
    expect(Math.max(...blob.loads.map(([, b]) => b))).toBeLessThanOrEqual(91794 + 1024);
  });
});

describe('XFLR5 .xfl reader: written test files', () => {
  it('returns what the writer stored', () => {
    const planes = [
      {
        name: 'Test plane',
        description: 'two\nlines',
        biplane: true,
        wings: [
          { name: 'Main', description: 'main wing', sections: SECTIONS },
          { name: 'Upper', symmetric: false },
          { name: 'Stab', sections: [{ ...SECTIONS[0], rightFoil: 'Foil B', leftFoil: 'Foil C' }, SECTIONS[1]] },
          { name: 'Fin' },
        ],
        positions: [
          [0.1, 0, 0.02, 1.5],
          [0.05, 0, 0.2, 0],
          [0.7, 0.01, 0.05, -2],
          [0.72, 0, 0, 0],
        ],
      },
    ];
    const r = readXflBytes(writeProject({ planes }).bytes);
    expect(r).toMatchObject({ kind: 'xfl', format: 200002, foilError: null, warnings: [] });
    const [p] = r.planes;
    expect(p).toMatchObject({ name: 'Test plane', description: 'two\nlines' });
    expect(p.wings[0]).toEqual({ name: 'Main', description: 'main wing', symmetric: true, position: { x: 0.1, y: 0, z: 0.02 }, tilt: 1.5, sections: SECTIONS });
    expect(p.wings[1]).toMatchObject({ name: 'Upper', symmetric: false, position: { x: 0.05, y: 0, z: 0.2 } });
    expect(p.wings[2]).toMatchObject({ name: 'Stab', position: { x: 0.7, y: 0.01, z: 0.05 }, tilt: -2 });
    expect(p.wings[2].sections[0]).toMatchObject({ rightFoil: 'Foil B', leftFoil: 'Foil C' });
    expect(p.wings[3].name).toBe('Fin');
    expect([...r.foils.keys()]).toEqual(['Foil A', 'Foil B']);
    expect(r.foils.get('Foil A')).toEqual({
      name: 'Foil A',
      points: POINTS,
      flaps: { le: { on: false, angle: 0, hingeX: 20, hingeY: 50 }, te: { on: false, angle: 0, hingeX: 70, hingeY: 50 } },
    });
  });

  it('reads the double-fin and symmetric-fin flags of a plane into its fin', () => {
    const flags = [
      [false, false],
      [true, false],
      [false, true],
      [true, true],
    ];
    const r = readXflBytes(writeProject({ planes: flags.map(([doubleFin, symFin]) => ({ doubleFin, symFin })) }).bytes);
    expect(r.planes.map((p) => p.wings[3].fin)).toEqual(flags.map(([double, symmetric]) => ({ isFin: true, double, symmetric })));
  });

  it('sets absent wing slots to null by the plane flags, whatever the slots hold', () => {
    const r = readXflBytes(writeProject({ planes: [{ biplane: false, stab: false, fin: false }, { biplane: true, stab: true, fin: false }] }).bytes);
    expect(r.planes[0].wings.map((w) => w?.name ?? null)).toEqual(['Main Wing', null, null, null]);
    expect(r.planes[1].wings.map((w) => w?.name ?? null)).toEqual(['Main Wing', 'Second Wing', 'Elevator', null]);
  });

  it('skips analyses of format 200012 and 200013 with control gains and result points (project 200001)', () => {
    const analyses = [
      { format: 200012, gains: [0.5, -1, 2], points: 3 },
      { format: 200013, gains: [], points: 2 },
      { format: 200013, gains: [1], points: 0 },
    ];
    const r = readXflBytes(writeProject({ format: 200001, analyses, results: [{ format: 200001 }] }).bytes);
    expect(r.format).toBe(200001);
    expect(r.foilError).toBeNull();
    expect([...r.foils.keys()]).toEqual(['Foil A', 'Foil B']);
  });

  it('skips a default analysis of format 200014 with gains and points (project 200002)', () => {
    const r = readXflBytes(writeProject({ defaultAnalysis: { gains: [1, 2, 3, 4], points: 5 }, analyses: [{ gains: [7], points: 4 }] }).bytes);
    expect(r.planes).toHaveLength(1);
    expect(r.foils.size).toBe(2);
  });

  it('reads a negative number of analysis points as none and refuses more than 10,000', () => {
    expect(readXflBytes(writeProject({ analyses: [{ points: -5 }] }).bytes).foils.size).toBe(2);
    const { bytes, marks } = writeProject({ analyses: [{ points: 10_001 }] });
    const r = readXflBytes(bytes);
    expect(r.planes).toHaveLength(1);
    expect(r.foils).toBeNull();
    expect(r.foilError.what).toBe('analysis');
    expect(r.foilError.offset).toBeGreaterThan(markAt(marks, 'analysis', 1));
    expect(failure(writeProject({ defaultAnalysis: { points: 10_001 } }).bytes)).toMatchObject({ code: 'damaged', what: 'header' });
  });

  it('skips plane results: method 1 without panel values, other methods with them, and wing results', () => {
    const results = [
      { method: 1, panels: 1000, wingOpps: [null, null, null, null] },
      { method: 2, panels: 5, wingOpps: [{ stations: 4, flaps: 3 }, null, { stations: 2, flaps: 0 }, { stations: 0, flaps: 1 }] },
      { format: 200001, method: 3, panels: 2, wingOpps: [{}, {}, {}, {}] },
    ];
    const r = readXflBytes(writeProject({ results }).bytes);
    expect(r.foilError).toBeNull();
    expect([...r.foils.keys()]).toEqual(['Foil A', 'Foil B']);
  });

  it('reads null strings as empty text', () => {
    const planes = [{ name: null, description: null, wings: [{ name: null, description: null, sections: [{ ...SECTIONS[0], rightFoil: null, leftFoil: null }, SECTIONS[1]] }, {}, {}, {}] }];
    const r = readXflBytes(writeProject({ planes, foils: [{ name: 'Foil A', description: null }] }).bytes);
    expect(r.planes[0]).toMatchObject({ name: '', description: '' });
    expect(r.planes[0].wings[0]).toMatchObject({ name: '', description: '' });
    expect(r.planes[0].wings[0].sections[0]).toMatchObject({ rightFoil: '', leftFoil: '' });
    expect([...r.foils.keys()]).toEqual(['Foil A']);
  });

  it('reads plane format 100001 without a line style and StyleFl5 with a first number below 500001', () => {
    const planes = [
      { format: 100001, name: 'Old' },
      { format: 100002, name: 'Old style', style: { k: 3 } },
      { format: 100002, name: 'New style', style: { k: 500001, tag: 'a longer tag' } },
    ];
    const r = readXflBytes(writeProject({ planes }).bytes);
    expect(r.planes.map((p) => p.name)).toEqual(['Old', 'Old style', 'New style']);
    for (const p of r.planes) expect(p.wings[0].sections).toEqual(SECTIONS);
    expect(r.foils.size).toBe(2);
  });

  it('skips a body with hoop panels, frames and point masses, and the point masses of wings and planes', () => {
    const masses = [{ tag: 'Battery' }, { tag: null }];
    const planes = [{ body: { frames: [5, 0, 7], hoops: [1, 2, 3], masses }, masses, wings: [{ masses }, {}, {}, {}] }, { name: 'No body' }];
    const r = readXflBytes(writeProject({ planes }).bytes);
    expect(r.planes.map((p) => p.name)).toEqual(['Plane', 'No body']);
    expect(r.planes[0].wings[0].sections).toEqual(SECTIONS);
    expect(r.foils.size).toBe(2);
  });

  it('keeps the last airfoil of a name, leaves out empty names and reads flap settings and old formats', () => {
    const other = [
      [1, 0],
      [0, 0.01],
      [1, 0],
    ];
    const foils = [
      { name: 'Foil A' },
      { name: 'Flap', format: 100006, te: { on: true, angle: 20, hingeX: 75, hingeY: 40 }, le: { on: true, angle: -5, hingeX: 15, hingeY: 45 } },
      { name: '' },
      { name: null },
      { name: 'Foil A', points: other },
      { name: 'Empty', points: [] },
    ];
    const r = readXflBytes(writeProject({ foils }).bytes);
    expect([...r.foils.keys()]).toEqual(['Flap', 'Foil A', 'Empty']);
    expect(r.foils.get('Foil A').points).toEqual(other);
    expect(r.foils.get('Flap').flaps).toEqual({ le: { on: true, angle: -5, hingeX: 15, hingeY: 45 }, te: { on: true, angle: 20, hingeX: 75, hingeY: 40 } });
    expect(r.foils.get('Empty').points).toEqual([]);
    expect(r.foils.has('')).toBe(false);
  });

  it('keeps empty airfoil names of sections, which find no airfoil', () => {
    const planes = [{ wings: [{ sections: [{ ...SECTIONS[0], rightFoil: '', leftFoil: '' }, SECTIONS[1]] }, {}, {}, {}] }];
    const r = readXflBytes(writeProject({ planes, foils: [{ name: '' }, { name: 'Foil B' }] }).bytes);
    expect(r.planes[0].wings[0].sections[0].rightFoil).toBe('');
    expect(r.foils.get(r.planes[0].wings[0].sections[0].rightFoil)).toBeUndefined();
  });

  it('sanitizes positions and tilts as XFLR5 does, and passes section values on as stored', () => {
    const planes = [
      {
        biplane: true,
        positions: [
          [NaN, 5e-7, 1001, -1.5],
          [Infinity, -2e3, -0.3, 1e-7],
          [0.5, 0, 0.01, NaN],
          [0, 0, 0, -1000.5],
        ],
        wings: [{ sections: [{ ...SECTIONS[0], chord: NaN }, { ...SECTIONS[1], y: Infinity, twist: -1e9 }] }, {}, {}, {}],
      },
    ];
    const [p] = readXflBytes(writeProject({ planes }).bytes).planes;
    expect(p.wings.map((w) => [w.position, w.tilt])).toEqual([
      [{ x: 0, y: 0, z: 0 }, -1.5],
      [{ x: 0, y: 0, z: -0.3 }, 0],
      [{ x: 0.5, y: 0, z: 0.01 }, 0],
      [{ x: 0, y: 0, z: 0 }, 0],
    ]);
    const [s0, s1] = p.wings[0].sections;
    expect(Number.isNaN(s0.chord)).toBe(true);
    expect(s1.y).toBe(Infinity);
    expect(s1.twist).toBe(-1e9);
  });

  it('leaves the clean-up of sections to the mapping: equal and decreasing y, tiny chords, different sides', () => {
    const sections = [
      { rightFoil: 'Foil A', leftFoil: 'Foil B', chord: 0.2, y: 0, offset: 0, dihedral: 0, twist: 0 },
      { rightFoil: 'Foil B', leftFoil: 'Foil B', chord: 0.0005, y: 0.3, offset: 0, dihedral: 0, twist: 0 },
      { rightFoil: 'Foil A', leftFoil: 'Foil A', chord: 0.1, y: 0.3, offset: 0.01, dihedral: 0, twist: 0 },
      { rightFoil: 'Foil A', leftFoil: 'Foil A', chord: 0.1, y: 0.2, offset: 0.01, dihedral: 0, twist: 0 },
    ];
    const r = readXflBytes(writeProject({ planes: [{ wings: [{ sections }, {}, {}, {}] }] }).bytes);
    expect(r.planes[0].wings[0].sections).toEqual(sections);
  });

  it('refuses a project without planes', () => {
    const e = failure(writeProject({ planes: [] }).bytes);
    expect(e).toBeInstanceOf(XflrError);
    expect(e).toMatchObject({ name: 'XflrError', code: 'no-plane', offset: null });
    expect(e.message).toBe('The project holds no plane (airfoil-only projects and .xfl files saved by flow5 have none).');
  });

  it('refuses odd string lengths, over-long names, and negative or huge counts before the airfoils', () => {
    const plain = writeProject();
    const at = markAt(plain.marks, 'plane') + 4;
    expect(failure(writeProject({ planes: [{ name: { raw: 3 } }] }).bytes)).toMatchObject({ code: 'damaged', offset: at, what: 'plane' });
    expect(failure(writeProject({ planes: [{ description: { raw: (1 << 20) + 2 } }] }).bytes)).toMatchObject({ code: 'damaged', what: 'plane' });
    const planesAt = markAt(plain.marks, 'planes');
    for (const n of [-1, MAX_PLANES + 1, 0x7fffffff]) {
      expect(failure(patchI32(plain.bytes, planesAt, n)), `${n} planes`).toMatchObject({ code: 'damaged', offset: planesAt, what: 'planes' });
    }
    const sectionsAt = markAt(plain.marks, 'sections');
    for (const n of [-1, 20_001, 0x7fffffff, 1_000]) {
      expect(failure(patchI32(plain.bytes, sectionsAt, n)), `${n} sections`).toMatchObject({ code: 'damaged', offset: sectionsAt, what: 'wing' });
    }
    expect(failure(writeProject({ planes: [{ wings: [{ count: -3 }, {}, {}, {}] }] }).bytes)).toMatchObject({ code: 'damaged', what: 'wing' });
    const massesAt = markAt(plain.marks, 'plane masses');
    for (const n of [-1, 0x7fffffff]) expect(failure(patchI32(plain.bytes, massesAt, n))).toMatchObject({ code: 'damaged', what: 'plane' });
    const body = writeProject({ planes: [{ body: {} }] });
    const frameAt = markAt(body.marks, 'frame');
    expect(failure(patchI32(body.bytes, frameAt + 12, 999))).toMatchObject({ code: 'damaged', offset: frameAt + 12, what: 'body' });
    expect(failure(patchI32(body.bytes, frameAt + 16, -1))).toMatchObject({ code: 'damaged', offset: frameAt + 16, what: 'body' });
    const wingAt = markAt(plain.marks, 'wing');
    expect(failure(patchI32(plain.bytes, wingAt, 100002))).toMatchObject({ code: 'damaged', offset: wingAt, what: 'wing' });
    expect(failure(patchI32(plain.bytes, markAt(plain.marks, 'plane'), 100000))).toMatchObject({ code: 'damaged', what: 'plane' });
  });

  it('refuses a wing with more sections than a project holds, and too many sections in all', () => {
    const at = (i) => ({ rightFoil: 'Foil A', leftFoil: 'Foil A', chord: 0.2, y: i * 0.001 });
    const many = Array.from({ length: LIMITS.maxSections + 1 }, (_, i) => at(i));
    // The fin slot is not used, but the file cannot be read past it.
    const fin = failure(writeProject({ planes: [{ fin: false, wings: [{}, {}, {}, { sections: many }] }] }).bytes);
    expect(fin).toMatchObject({ code: 'too-large', offset: null, message: 'A wing of the file has 20,001 sections; at most 20,000 can be read.' });
    const full = { sections: many.slice(0, LIMITS.maxSections) };
    const planes = Array.from({ length: Math.ceil(MAX_TOTAL_SECTIONS / (4 * LIMITS.maxSections)) + 1 }, () => ({ wings: [full, full, full, full] }));
    expect(failure(writeProject({ planes }).bytes)).toMatchObject({
      code: 'too-large',
      message: 'The planes of the file hold more than 1,000,000 wing sections together; the file is not read.',
    });
    setLanguage('de');
    expect(failure(writeProject({ planes: [{ wings: [{ sections: many }, {}, {}, {}] }] }).bytes).message).toBe('Ein Flügel der Datei hat 20.001 Schnitte; höchstens 20.000 können gelesen werden.');
  }, 30_000);

  it('skips the airfoils beyond the point limit', () => {
    const big = Array.from({ length: MAX_XFLR5_FOIL_POINTS }, (_, i) => [1 - i / MAX_XFLR5_FOIL_POINTS, 0.01 * Math.sin(i)]);
    const n = MAX_FOIL_POINTS / big.length;
    const foils = Array.from({ length: n }, (_, i) => ({ name: `F${i}`, points: big }));
    const one = readXflBytes(writeProject({ foils: [...foils, { name: 'Over', points: POINTS }] }).bytes);
    expect(one.foilError).toBeNull();
    expect([...one.foils.keys()]).toEqual(foils.map((f) => f.name));
    expect(one.foils.get('F1').points).toHaveLength(big.length);
    expect(one.warnings).toEqual(['1 airfoil was not read: the airfoils of the file hold more than 2,000,000 points together.']);
    // Up to the limit exactly, the airfoils are read. A skipped airfoil of a name read before removes
    // it: XFLR5 would use the later one. An airfoil without points still fits.
    const two = readXflBytes(
      writeProject({ foils: [...foils.slice(1), { name: 'Last', points: big }, { name: 'F1', points: POINTS }, { name: 'Late', points: POINTS }, { name: 'F2', points: [] }] }).bytes,
    );
    expect([...two.foils.keys()]).toEqual([...foils.slice(3).map((f) => f.name), 'Last', 'F2']);
    expect(two.foils.get('F2').points).toEqual([]);
    expect(two.warnings).toEqual(['2 airfoils were not read: the airfoils of the file hold more than 2,000,000 points together.']);
  }, 30_000);

  it('takes more points in one airfoil than XFLR5 holds (604) for damage of the airfoil part', () => {
    const points = (n) => Array.from({ length: n }, (_, i) => [Math.abs(1 - (2 * i) / (n - 1)), 0]);
    const fits = readXflBytes(writeProject({ foils: [{ name: 'Big', points: points(MAX_XFLR5_FOIL_POINTS) }] }).bytes);
    expect(fits.foils.get('Big').points).toHaveLength(MAX_XFLR5_FOIL_POINTS);
    const over = writeProject({ foils: [{ name: 'Foil A' }, { name: 'Big', points: points(MAX_XFLR5_FOIL_POINTS + 1) }] });
    const r = readXflBytes(over.bytes);
    expect(r.planes).toHaveLength(1);
    expect(r.foils).toBeNull();
    expect(r.foilError).toEqual({ offset: markAt(over.marks, 'airfoil', 1) + 4 + 4 + 2 * 'Big'.length + 4 + 2 * 'airfoil'.length + 24 + 3 + 48, what: 'airfoil' });
    expect(r.warnings).toEqual([expect.stringMatching(/^The airfoils could not be read\. The file is damaged or cut off at byte [\d,]+ \(in an airfoil\)\. Pick or upload them\.$/)]);
  });

  it('reads as many airfoils as a project holds, and names up to 64 MB together', () => {
    const foils = Array.from({ length: MAX_FOILS + 2 }, (_, i) => ({ name: `F${i}`, points: [] }));
    const r = readXflBytes(writeProject({ foils }).bytes);
    expect(r.foils.size).toBe(MAX_FOILS);
    expect(r.foils.has(`F${MAX_FOILS - 1}`)).toBe(true);
    expect(r.foils.has(`F${MAX_FOILS}`)).toBe(false);
    expect(r.warnings).toEqual(['Only the first 10,000 of the 10,002 airfoils of the file were read.']);
    // 62 names of 1 MiB each: the airfoils are not read, the planes are.
    const long = Array.from({ length: 62 }, () => ({ name: { raw: 1 << 20 }, points: [] }));
    const big = readXflBytes(writeProject({ foils: long }).bytes);
    expect(big.planes).toHaveLength(1);
    expect(big.foils).toBeNull();
    expect(big.foilError).toMatchObject({ what: 'airfoil' });
    expect(big.warnings).toEqual(['The airfoils could not be read. The names in the file hold more than 64 MB together. Pick or upload them.']);
    // In the planes, it is an error of the file.
    const planes = Array.from({ length: 31 }, () => ({ name: { raw: 1 << 20 }, description: { raw: 1 << 20 } }));
    expect(failure(writeProject({ planes }).bytes)).toMatchObject({ code: 'too-large', what: 'plane', message: 'The names in the file hold more than 64 MB together.' });
  }, 30_000);

  it('checks the fixed values of the spare blocks, which show a read that has lost its place', () => {
    const plain = writeProject();
    const wingSpare = markAt(plain.marks, 'wing spare');
    const planeSpare = markAt(plain.marks, 'plane spare');
    // Values XFLR5 6.11 and later write: 0 or 1 first, a wing type of 0 to 4 last.
    for (const [at, v] of [
      [wingSpare, 0],
      [wingSpare + 76, 4],
    ]) {
      expect(readXflBytes(patchI32(plain.bytes, at, v)).planes).toHaveLength(1);
    }
    for (const [at, v] of [
      [wingSpare, 2],
      [wingSpare + 4, 1],
      [wingSpare + 76, 5],
      [wingSpare + 76, -1],
      [wingSpare + 80, 1],
    ]) {
      expect(failure(patchI32(plain.bytes, at, v)), `wing spare +${at - wingSpare} = ${v}`).toMatchObject({ code: 'damaged', offset: wingSpare, what: 'wing' });
    }
    for (const [at, v] of [
      [planeSpare, 1],
      [planeSpare + 76, 4],
      [planeSpare + 80 + 8 * 49, 1],
    ]) {
      expect(failure(patchI32(plain.bytes, at, v)), `plane spare +${at - planeSpare} = ${v}`).toMatchObject({ code: 'damaged', offset: planeSpare, what: 'plane' });
    }
    // A section count of the unused fin slot of the last plane raised by one: the read loses its place
    // inside the planes, which is damage, not a file whose airfoils alone are unreadable.
    const bytes = fixture('fixtures_v662.xfl');
    const view = new DataView(bytes.buffer, bytes.byteOffset);
    expect(view.getInt32(6871)).toBe(2);
    for (const [at, v] of [
      [6871, 3],
      [7011, 1],
      [6878, 1],
      [6942, 1],
    ]) {
      expect(failure(patchI32(bytes, at, v)), `byte ${at} = ${v}`).toMatchObject({ code: 'damaged', what: 'wing' });
    }
  });

  it('reads the spare blocks of XFLR5 6.10.01 to 6.10.04, which hold their own indices', () => {
    // These versions write i to the i-th i32 and f64 of every wing and plane spare block; XFLR5 6.11 and
    // later write zeros. The planes read the same either way.
    const planes = [{ format: 100001 }, { format: 100001, biplane: true }];
    const fixed = writeProject({ format: 200001, planes, analyses: [{ format: 200012 }] });
    const index = writeProject({ format: 200001, planes: planes.map((p) => ({ ...p, spare: 'index' })), analyses: [{ format: 200012 }] });
    const wingSpare = markAt(index.marks, 'wing spare');
    const planeSpare = markAt(index.marks, 'plane spare');
    const view = new DataView(index.bytes.buffer, index.bytes.byteOffset);
    expect([view.getInt32(wingSpare + 76), view.getFloat64(planeSpare + 80 + 8 * 49)]).toEqual([19, 49]);
    const read = readXflBytes(index.bytes);
    expect(read.planes).toEqual(readXflBytes(fixed.bytes).planes);
    expect(read.planes).toHaveLength(2);
    expect(read.warnings).toEqual([]);
    // One value off the pattern is damage, in a wing and in a plane.
    for (const [at, v, what] of [
      [wingSpare + 4 * 7, 8, 'wing'],
      [wingSpare + 76, 0, 'wing'],
      [planeSpare + 4 * 3, 0, 'plane'],
    ]) {
      expect(failure(patchI32(index.bytes, at, v)), `${what} spare +${at - (what === 'wing' ? wingSpare : planeSpare)} = ${v}`).toMatchObject({ code: 'damaged', what });
    }
  });

  it('keeps the planes when the part after them is damaged', () => {
    const plain = writeProject({ analyses: [{}], results: [{}] });
    const full = readXflBytes(plain.bytes);
    const cases = [
      ['analyses', 0, -1, 'analyses'],
      ['analyses', 0, 0x7fffffff, 'analysis'],
      ['analysis', 1, 199_999, 'analysis'],
      ['results', 0, -2, 'results'],
      ['result', 0, 200_101, 'result'],
      ['airfoils', 0, -1, 'airfoils'],
      ['airfoils', 0, 1000, 'airfoil'],
      ['airfoil', 0, 99_999, 'airfoil'],
    ];
    for (const [label, nth, value, what] of cases) {
      const r = readXflBytes(patchI32(plain.bytes, markAt(plain.marks, label, nth), value));
      expect(r.planes, `${label} = ${value}`).toEqual(full.planes);
      expect(r.foils).toBeNull();
      expect(r.foilError.what).toBe(what);
      expect(r.warnings).toEqual([expect.stringMatching(/^The airfoils could not be read\. The file is damaged or cut off at byte \d+ \(in /)]);
    }
    // Airfoil point counts: negative, above the limit, and more than the file holds.
    for (const count of [-1, 100_001, 50]) {
      const r = readXflBytes(writeProject({ foils: [{ name: 'Foil A', count }] }).bytes);
      expect(r.foils, `${count} points`).toBeNull();
      expect(r.foilError.what).toBe('airfoil');
    }
    const odd = readXflBytes(writeProject({ foils: [{ name: { raw: 5 } }] }).bytes);
    expect(odd.foilError).toMatchObject({ what: 'airfoil' });
    expect(odd.planes).toHaveLength(1);
  });

  it('handles a cut at every record boundary', () => {
    const { bytes, marks } = writeProject({
      planes: [{ body: {}, masses: [{}] }, { format: 100001, stab: false }],
      analyses: [{ gains: [1, 2], points: 2 }],
      results: [{}],
      foils: [{ name: 'Foil A' }, { name: 'Foil B', format: 100006 }],
    });
    const full = readXflBytes(bytes);
    const planesEnd = markAt(marks, 'analyses');
    const foilsEnd = markAt(marks, 'end of airfoils');
    let sectionsAt = 0;
    for (const { at, label } of marks) {
      if (label === 'sections') sectionsAt = at;
      const cut = bytes.subarray(0, at);
      if (at === 0) expect(failure(cut)).toMatchObject({ code: 'not-xflr5' });
      else if (at < planesEnd) {
        // A cut before the first section fails at the section count: the sections cannot fit.
        expect(failure(cut), `${label} at ${at}`).toMatchObject({ code: 'damaged', offset: label === 'section' ? sectionsAt : at });
      } else if (at < foilsEnd) {
        const r = readXflBytes(cut);
        expect(r.planes, `${label} at ${at}`).toEqual(full.planes);
        expect(r.foils).toBeNull();
        expect(r.foilError.offset, `${label} at ${at}`).toBe(at);
      } else expect(readXflBytes(cut)).toEqual(full);
    }
  });

  it('never fails with anything but XflrError when cut at any byte', () => {
    const { bytes, marks } = writeProject({ planes: [{ body: { frames: [2] } }], analyses: [{ points: 1 }], results: [{ wingOpps: [{ stations: 1 }, null, null, null] }] });
    const planesEnd = markAt(marks, 'analyses');
    const foilsEnd = markAt(marks, 'end of airfoils');
    const full = readXflBytes(bytes);
    for (let at = 0; at < bytes.length; at++) {
      const cut = bytes.subarray(0, at);
      if (at < planesEnd) {
        const e = failure(cut);
        expect(e?.code, `cut at ${at}`).toBe(at < 4 ? 'not-xflr5' : 'damaged');
        if (at >= 4) expect(e.offset).toBeLessThanOrEqual(at);
      } else {
        const r = readXflBytes(cut);
        expect(r.planes.length).toBe(1);
        expect(r.foils === null).toBe(at < foilsEnd);
        if (at < foilsEnd) expect(r.foilError.offset).toBeLessThanOrEqual(at);
        else expect(r).toEqual(full);
      }
    }
  });

  it('gives the same result through any window size, and skips without loading the skipped bytes', async () => {
    const { bytes } = writeProject({ planes: [{ body: {} }, { name: 'Second' }], analyses: [{ points: 3 }], results: [{}], foils: [{ name: 'A' }, { name: 'B' }] });
    const whole = readXflBytes(bytes);
    for (const windowSize of [1, 7, 1024, 1 << 20]) expect(await readXfl(new Blob([bytes]), { windowSize })).toEqual(whole);
    // Four analyses with 10,000 result points each: 11.5 MB, of which a 64 KB window loads little.
    const big = writeProject({ analyses: [{ points: 10_000 }, { points: 10_000 }, { points: 10_000 }, { points: 10_000 }] }).bytes;
    const blob = countingBlob(big);
    const r = await readXfl(blob, { windowSize: 65536 });
    expect(r).toEqual(readXflBytes(big));
    const loaded = blob.loads.reduce((sum, [a, b]) => sum + b - a, 0);
    expect(big.length).toBeGreaterThan(11e6);
    expect(loaded).toBeLessThan(1e6);
  });

  it('reads an ArrayBuffer as well as a Uint8Array', () => {
    const { bytes } = writeProject();
    expect(readXflBytes(bytes.buffer)).toEqual(readXflBytes(bytes));
  });
});

describe('XFLR5 .xfl reader: other files', () => {
  it('refuses flow5 projects, .wpa projects, JSON text and unknown files with their own messages', () => {
    const flow5 = patchI32(new Uint8Array(64), 0, 500754);
    expect(failure(flow5)).toMatchObject({ code: 'flow5', message: 'The file is a flow5 project (.fl5); only XFLR5 files can be imported.' });
    const wpa = new Uint8Array(64);
    new DataView(wpa.buffer).setInt32(0, 100013, true);
    expect(failure(wpa)).toMatchObject({ code: 'wpa', message: 'The file is a .wpa project of XFLR5 6.09 or older: open it in XFLR5 6.62 and save it as .xfl.' });
    const json = new TextEncoder().encode('{"format":"wingdesigner-project","version":1}');
    expect(failure(json)).toMatchObject({ code: 'not-xflr5', message: 'The file is not an XFLR5 project (it starts with 7b 22 66 6f).' });
    expect(failure(new TextEncoder().encode('<?xml version="1.0"?><explane version="1.0"/>'))).toMatchObject({ code: 'not-xflr5' });
    expect(failure(patchI32(new Uint8Array(64), 0, 200003))).toMatchObject({ code: 'not-xflr5', message: 'The file is not an XFLR5 project (it starts with 00 03 0d 43).' });
    expect(failure(new Uint8Array(0))).toMatchObject({ code: 'not-xflr5', message: 'The file is empty, not an XFLR5 project.' });
    expect(failure(new Uint8Array([0, 3, 13]))).toMatchObject({ code: 'not-xflr5', message: 'The file is not an XFLR5 project (it starts with 00 03 0d).' });
    // An XFLR5 project format followed by nothing.
    expect(failure(patchI32(new Uint8Array(4), 0, 200002))).toMatchObject({ code: 'damaged', offset: 4, what: 'header' });
  });

  it('refuses files above the size cap without reading them', async () => {
    const huge = {
      size: MAX_XFL_BYTES + 1,
      slice() {
        throw new Error('not read');
      },
    };
    await expect(readXfl(huge)).rejects.toMatchObject({ code: 'too-large', message: 'The file is 2000.0 MB; XFLR5 projects above 2000 MB are not read.' });
  });

  it('reports damage when the file shrinks while it is read', async () => {
    const { bytes } = writeProject();
    const blob = new Blob([bytes.subarray(0, 2000)]);
    const shrunk = { size: bytes.length, slice: (a, b) => blob.slice(a, b) };
    await expect(readXfl(shrunk, { windowSize: 512 })).rejects.toMatchObject({ code: 'damaged' });
  });

  it('passes on errors of the browser while reading', async () => {
    const broken = {
      size: 100,
      slice: () => ({ arrayBuffer: () => Promise.reject(new DOMException('gone', 'NotReadableError')) }),
    };
    await expect(readXfl(broken)).rejects.toMatchObject({ name: 'NotReadableError' });
  });

  it('writes the messages in German', () => {
    setLanguage('de');
    const b = fixture('fixtures_v662.xfl');
    expect(failure(b.subarray(0, 740)).message).toBe('Die Datei ist bei Byte 736 beschädigt oder abgeschnitten (in einem Flugzeug).');
    const r = readXflBytes(b.subarray(0, 10179));
    expect(r.warnings[0]).toMatch(/^Die Profile konnten nicht gelesen werden\. Die Datei ist bei Byte 8\.880 beschädigt oder abgeschnitten \(in einem Profil\)\. Profile auswählen oder hochladen\.$/);
    expect(failure(new Uint8Array(0)).message).toBe('Die Datei ist leer und kein XFLR5-Projekt.');
  });

  it('recognizes the start of an XFLR5 project', () => {
    const i32 = (v, little = false) => {
      const b = new Uint8Array(4);
      new DataView(b.buffer).setInt32(0, v, little);
      return b;
    };
    // The projects readXfl() reads or names: .xfl, flow5 (.fl5) and .wpa.
    for (const bytes of [fixture('fixtures_v662.xfl'), i32(200001), i32(500754), i32(100013, true)]) expect(sniffXflr5(bytes)).toBe(true);
    for (const bytes of [i32(200003), i32(100013), new TextEncoder().encode('{"format"'), new Uint8Array([0, 3, 13])]) expect(sniffXflr5(bytes)).toBe(false);
    expect(sniffXflr5(i32(200002).buffer)).toBe(true);
    expect(startsLikeXfl(i32(500754))).toBe(false);
    expect(startsLikeXfl(fixture('fixtures_v662.xfl'))).toBe(true);
    expect(startsLikeXfl(fixture('uaslab/Rascal110.xfl').buffer)).toBe(true);
    expect(startsLikeXfl(new TextEncoder().encode('1.0 0.0\n0.5 0.1\n'))).toBe(false);
    expect(startsLikeXfl(new Uint8Array([0, 3, 13]))).toBe(false);
  });
});
