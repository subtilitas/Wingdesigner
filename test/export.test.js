import { afterEach, describe, expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import { buildWing } from '../src/geom/wing.js';
import { concatMeshes, edgeCheck, exportMeshes, exportTriangles, meshVolume, mirrorMesh } from '../src/geom/mesh.js';
import { meshToStl, parseStl } from '../src/export/stl.js';
import { MeshPrecisionError, checkPrecision } from '../src/export/precision.js';
import { meshesTo3mf, modelXml, xmlEscape } from '../src/export/threemf.js';
import { stepReal, stepString, wingToStep } from '../src/export/step.js';
import { MAX_PROJECT_BYTES, formatJson, projectFileText, projectFromJsonText, projectToJson, projectToJsonText, utf8Length } from '../src/model/io.js';
import { LIMITS, createProject, validateProject } from '../src/model/project.js';
import { setGuideEnabled } from '../src/model/edit.js';
import { sampleProject } from './helpers.js';
import { nacaAirfoil } from '../src/airfoil/naca.js';
import { defaultProject } from '../src/model/defaults.js';
import { stepCases } from './step-cases.js';
import { setLanguage } from '../src/i18n/index.js';

describe('export meshes', () => {
  const build = buildWing(sampleProject());

  it('produces closed shells in every mode', () => {
    const right = exportMeshes(build, 'right');
    expect(right.length).toBe(1);
    const halves = exportMeshes(build, 'halves');
    expect(halves.length).toBe(2);
    const merged = exportMeshes(build, 'merged');
    expect(merged.length).toBe(1);
    for (const { mesh } of [...right, ...halves, ...merged]) expect(edgeCheck(mesh).closed).toBe(true);
    expect(meshVolume(halves[1].mesh)).toBeCloseTo(meshVolume(halves[0].mesh), 6);
    expect(meshVolume(merged[0].mesh)).toBeCloseTo(2 * meshVolume(right[0].mesh), 3);
    const combined = concatMeshes(halves.map((h) => h.mesh));
    expect(edgeCheck(combined).closed).toBe(true);
    expect(meshVolume(mirrorMesh(right[0].mesh))).toBeCloseTo(meshVolume(right[0].mesh), 6);
  });

  it('falls back to halves when the root is off the symmetry plane', () => {
    const p = sampleProject();
    p.sections.forEach((s) => (s.y += 10));
    expect(exportMeshes(buildWing(p), 'merged').length).toBe(2);
    // A root 1e-10 mm off the plane is off the plane: two shells, each closed.
    const q = sampleProject();
    q.sections[0].y = 1e-10;
    const near = exportMeshes(buildWing(q), 'merged');
    expect(near.length).toBe(2);
    for (const { mesh } of near) expect(edgeCheck(mesh).closed).toBe(true);
  });
});

describe('STL', () => {
  it('writes binary STL with outward normals', () => {
    const [{ mesh }] = exportMeshes(buildWing(sampleProject()), 'right');
    const bytes = meshToStl(mesh, 'test');
    const n = mesh.indices.length / 3;
    expect(bytes.length).toBe(84 + 50 * n);
    expect(new TextDecoder().decode(bytes.subarray(0, 4))).toBe('test');
    const tris = parseStl(bytes);
    expect(tris.length).toBe(n);
    // Divergence theorem from the parsed float32 data reproduces the volume.
    let v = 0;
    for (const { vertices: [a, b, c] } of tris) {
      v += (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
    }
    expect(v / meshVolume(mesh)).toBeCloseTo(1, 5);
    for (const t of tris.slice(0, 50)) expect(Math.hypot(...t.normal)).toBeCloseTo(1, 5);
  });

  it('refuses visible triangles that turn over at 32-bit precision; ignores sub-resolution slivers', () => {
    const wing = (x, z, chord, settings) =>
      buildWing(
        createProject({
          airfoils: [{ id: 'a', name: 'NACA 2412', points: nacaAirfoil('2412').points }],
          sections: [0, 10].map((y) => ({ airfoil: 'a', x, y, z, chord, twist: 0 })),
          settings,
        }),
      );
    // 7.41 mm chord near the coordinate limit, 16 chord samples: 4 triangles 10 mm long and 0.02 mm
    // high, below the 0.0625 mm spacing, turn over without merging corners (flipped triangles with
    // 0.08 mm edges stay under 4 spacings).
    const far = concatMeshes(exportMeshes(wing(801579, 955903, 7.41, { chordSamples: 16 }), 'halves', { uRefine: 1, vRefine: 1 }).map((m) => m.mesh));
    expect(() => meshToStl(far)).toThrow('STL stores 32-bit coordinates: at 955903 mm their spacing is 0.063 mm, and 4 of 256 triangles collapse or turn over. Move the wing towards the origin, or export STEP.');
    expect(() => meshesTo3mf([{ name: 'w', mesh: far }])).toThrow(MeshPrecisionError);
    // 1 mm chord of the default design with a closed trailing edge and 200 chord samples: at Fine
    // density 2 triangles of 1.4e-4 mm turn over; they are under 4 spacings and stay below the resolution.
    const p = defaultProject();
    for (const s of p.sections) s.chord = 1;
    Object.assign(p.settings, { chordSamples: 200, trailingEdge: { mode: 'closed', thickness: 0.4 } });
    const small = concatMeshes(exportMeshes(buildWing(p), 'halves', { uRefine: 2, vRefine: 6 }).map((m) => m.mesh));
    expect(() => meshToStl(small)).not.toThrow();
    expect(() => meshesTo3mf([{ name: 'w', mesh: small }])).not.toThrow();
  });

  it('counts export triangles before meshing, for the Fine density limit', () => {
    const build = buildWing(sampleProject());
    for (const mode of ['right', 'halves']) {
      for (const [uRefine, vRefine] of [[1, 3], [2, 6]]) {
        const actual = exportMeshes(build, mode, { uRefine, vRefine }).reduce((n, m) => n + m.mesh.indices.length / 3, 0);
        const estimate = exportTriangles(build, mode, { uRefine, vRefine });
        // Exact for the surface and trailing edge; the caps are bounded by their ring size.
        expect(estimate).toBeGreaterThanOrEqual(actual);
        expect(estimate).toBeLessThan(1.02 * actual);
      }
    }
  });

  it('refuses a mesh that 32-bit coordinates collapse', () => {
    const at = (x, z) => {
      const p = sampleProject();
      for (const s of p.sections) Object.assign(s, { x, z, chord: 1 });
      const build = buildWing(p);
      expect(build.errors).toEqual([]);
      return concatMeshes(exportMeshes(build, 'halves', { uRefine: 1, vRefine: 1 }).map((m) => m.mesh));
    };
    // 1 mm chord at 1,000,000 mm: coordinate spacing 0.0625 mm.
    expect(() => meshToStl(at(1e6, 1e6))).toThrow(MeshPrecisionError);
    expect(() => meshToStl(at(1e6, 1e6))).toThrow(/^STL stores 32-bit coordinates: at 1000001 mm their spacing is 0\.063 mm, and \d+ of \d+ triangles collapse or turn over/);
    expect(() => meshesTo3mf([{ name: 'w', mesh: at(1e6, 1e6) }])).toThrow(/^3MF readers store 32-bit coordinates: at 1000001 mm/);
    expect(() => meshToStl(at(1e6, 1e6))).toThrow(/\. Move the wing towards the origin, or export STEP\.$/);
    // Two sections 1e-5 mm apart at y = 300 mm, below the 3.1e-5 mm spacing there: moving the wing
    // does not help, and the message names the span position.
    const close = sampleProject();
    close.sections.push({ id: 'd', airfoil: 'root', x: 20, y: 300.00001, z: 10, chord: 170, twist: -1 });
    const build = buildWing(close);
    expect(build.errors).toEqual([]);
    const mesh = concatMeshes(exportMeshes(build, 'halves').map((m) => m.mesh));
    for (const write of [() => meshToStl(mesh), () => meshesTo3mf([{ name: 'w', mesh }])]) {
      expect(write).toThrow(/^(STL stores|3MF readers store) 32-bit coordinates: at 300 mm their spacing is 0\.000031 mm, and \d+ of \d+ triangles collapse or turn over\. Sections or stations near y = 300(\.00001)? mm lie closer together than the spacing there \(0\.000031 mm\); move them apart, or export STEP\.$/);
    }
    // A half-wing with its root at y = 1,000,000 mm: moving the root to y = 0 separates the corners,
    // so the notice points to moving the wing.
    const offset = [0, 1e6, 0, 1, 1e6, 0, 0, 1e6 + 0.01, 0];
    expect(() => checkPrecision(offset, [0, 1, 2], Math.fround, 'STL stores')).toThrow(/\. Move the wing towards the origin, or export STEP\.$/);
    // At 1000 mm the spacing is 6.1e-5 mm; no corners merge.
    const near = at(1000, 0);
    const tris = parseStl(meshToStl(near));
    expect(tris.length).toBe(near.indices.length / 3);
  });
});

describe('3MF', () => {
  it('packages a valid OPC zip with one object per shell', () => {
    const objs = exportMeshes(buildWing(sampleProject()), 'halves');
    const zip = meshesTo3mf(objs, { title: 'Test & <wing>' });
    const files = unzipSync(zip);
    expect(Object.keys(files).sort()).toEqual(['3D/3dmodel.model', '[Content_Types].xml', '_rels/.rels']);
    const model = strFromU8(files['3D/3dmodel.model']);
    expect(model).toContain('unit="millimeter"');
    expect(model).toContain('Test &amp; &lt;wing&gt;');
    expect(model.match(/<object /g).length).toBe(2);
    expect(model.match(/<item /g).length).toBe(2);
    const nv = objs[0].mesh.positions.length / 3;
    expect(model.split('<vertex ').length - 1).toBe(2 * nv);
    expect(strFromU8(files['_rels/.rels'])).toContain('/3D/3dmodel.model');
    expect(strFromU8(files['[Content_Types].xml'])).toContain('3dmanufacturing-3dmodel+xml');
  });

  it('formats numbers with 9 significant digits in the 3MF number syntax', () => {
    const xml = modelXml([{ name: 'a', mesh: { positions: [0.1234567891, -1e-7, 12, 1000000.123456, -0, 5e-324], indices: [0, 1, 1] } }]);
    expect(xml).toContain('<vertex x="0.123456789" y="-1e-7" z="12"/>');
    expect(xml).toContain('<vertex x="1000000.12" y="0" z="5e-324"/>');
    // ST_Number of the 3MF core specification.
    const number = /^[-+]?(\d+(\.\d+)?|\.\d+)([eE][-+]?\d+)?$/;
    for (const [, v] of xml.matchAll(/ [xyz]="([^"]+)"/g)) expect(v).toMatch(number);
    // Each written value reads back as the 32-bit float of the coordinate.
    for (const v of [0.1234567891, 1000000.123456, 123.456789012]) {
      const w = Number(modelXml([{ name: 'a', mesh: { positions: [v, 0, 0], indices: [] } }]).match(/x="([^"]+)"/)[1]);
      expect(Math.fround(w)).toBe(Math.fround(v));
    }
    expect(xmlEscape(`"'`)).toBe('&quot;&apos;');
  });

  it('keeps the triangles of a 1 mm chord at Fine density in the written coordinates', () => {
    // 1 mm chord, closed trailing edge, 200 chord samples: 5 fixed decimals merged corners of 8 triangles.
    const p = sampleProject({ settings: { chordSamples: 200, trailingEdge: { mode: 'closed', thickness: 0.4 } } });
    for (const s of p.sections) s.chord = 1;
    const build = buildWing(p);
    expect(build.errors).toEqual([]);
    const objects = exportMeshes(build, 'halves', { uRefine: 2, vRefine: 6 });
    const xml = modelXml(objects);
    const written = [...xml.matchAll(/<vertex x="([^"]+)" y="([^"]+)" z="([^"]+)"\/>/g)].map((m) => [1, 2, 3].map((k) => Math.fround(Number(m[k]))));
    let offset = 0;
    let merged = 0;
    for (const { mesh } of objects) {
      const P = mesh.positions;
      const I = mesh.indices;
      const key = (i) => written[offset + i].join(',');
      const distinct = (i, j) => P[3 * i] !== P[3 * j] || P[3 * i + 1] !== P[3 * j + 1] || P[3 * i + 2] !== P[3 * j + 2];
      for (let t = 0; t < I.length; t += 3) {
        const [a, b2, c] = [I[t], I[t + 1], I[t + 2]];
        if ([[a, b2], [b2, c], [a, c]].some(([i, j]) => distinct(i, j) && key(i) === key(j))) merged++;
      }
      offset += P.length / 3;
    }
    expect(written.length).toBe(offset);
    expect(merged).toBe(0);
  });

  it('removes characters that XML 1.0 does not allow', () => {
    expect(xmlEscape('Wing\u0008v2\u0000\uFFFE\uD800 \u00e9\u{1F600}\t')).toBe('Wingv2 \u00e9\u{1F600}\t');
    const model = strFromU8(unzipSync(meshesTo3mf([], { title: 'A\u0008B' }))['3D/3dmodel.model']);
    expect(model).toContain('<metadata name="Title">AB</metadata>');
  });

  it('writes a model larger than one 1 MB chunk identically to the single-string XML', () => {
    // 25,000 vertices produce about 1.6 MB of XML, i.e. more than one chunk.
    const n = 25000;
    // A helix of radius 100 mm: consecutive corners form well-shaped triangles.
    const positions = Float64Array.from({ length: 3 * n }, (_, i) => {
      const t = 0.5 * Math.floor(i / 3);
      return [100 * Math.cos(t), 100 * Math.sin(t), 0.1 * t][i % 3];
    });
    const indices = Uint32Array.from({ length: 3 * (n - 2) }, (_, i) => Math.floor(i / 3) + (i % 3));
    const objs = [{ name: 'big', mesh: { positions, indices } }];
    const xml = modelXml(objs, { title: 'big' });
    expect(xml.length).toBeGreaterThan(1 << 20);
    const model = strFromU8(unzipSync(meshesTo3mf(objs, { title: 'big' }))['3D/3dmodel.model']);
    expect(model).toBe(xml);
  }, 20000);
});

describe('STEP', () => {
  it('formats reals and strings per ISO 10303-21', () => {
    expect(stepReal(1)).toBe('1.');
    expect(stepReal(-0)).toBe('0.');
    expect(stepReal(0.25)).toBe('0.25');
    expect(stepReal(1e-7)).toBe('1.E-7');
    expect(stepReal(-2.5e21)).toBe('-2.5E21');
    expect(() => stepReal(NaN)).toThrow();
    expect(stepString("it's")).toBe("'it''s'");
    expect(stepString('a\\b')).toBe("'a\\\\b'");
    expect(stepString('Flügel')).toBe("'Fl\\X2\\00FC\\X0\\gel'");
    expect(stepString('\u{1F600}')).toBe("'\\X4\\0001F600\\X0\\'");
    // A lone surrogate is written as U+FFFD.
    expect(stepString('a\ud800b\udc00')).toBe("'a\\X2\\FFFD\\X0\\b\\X2\\FFFD\\X0\\'");
  });

  it('keeps a knot 1e-10 mm from the root distinct: no end knot above multiplicity degree + 1', () => {
    const build = buildWing(
      createProject({
        airfoils: [{ id: 'a', name: 'NACA 2412', points: nacaAirfoil('2412').points }],
        sections: [0, 1e-10, 600].map((y) => ({ airfoil: 'a', x: 0, y, z: 0, chord: 200, twist: 0 })),
      }),
    );
    expect(build.errors).toEqual([]);
    const txt = wingToStep(build, { name: 'Test', timestamp: '2026-01-01T00:00:00' });
    const surfaces = [...txt.matchAll(/B_SPLINE_SURFACE_WITH_KNOTS\('',(\d+),(\d+),.*\.F\.,\.F\.,\.F\.,\(([^)]*)\),\(([^)]*)\),\(([^)]*)\),\(([^)]*)\)/g)];
    expect(surfaces.length).toBe(6);
    for (const [, du, dv, mu, mv, ku, kv] of surfaces) {
      for (const [degree, mults, knots] of [
        [Number(du), mu.split(',').map(Number), ku.split(',').map(Number)],
        [Number(dv), mv.split(',').map(Number), kv.split(',').map(Number)],
      ]) {
        expect(Math.max(...mults)).toBeLessThanOrEqual(degree + 1);
        expect(mults.length).toBe(knots.length);
        for (let i = 1; i < knots.length; i++) expect(knots[i]).toBeGreaterThan(knots[i - 1]);
      }
    }
  });

  it('writes a structurally complete AP214 file', () => {
    const build = buildWing(sampleProject());
    const txt = wingToStep(build, { name: 'Test', timestamp: '2026-01-01T00:00:00' });
    expect(txt.startsWith('ISO-10303-21;\nHEADER;')).toBe(true);
    expect(txt).toContain("FILE_SCHEMA(('AUTOMOTIVE_DESIGN { 1 0 10303 214 1 1 1 1 }'));");
    expect(txt.trimEnd().endsWith('END-ISO-10303-21;')).toBe(true);
    expect(txt.match(/MANIFOLD_SOLID_BREP/g).length).toBe(2);
    // Open trailing edge: upper, lower, TE, root and tip faces per half.
    expect(txt.match(/ADVANCED_FACE/g).length).toBe(10);
    expect(txt.match(/B_SPLINE_SURFACE_WITH_KNOTS/g).length).toBe(6);
    expect(txt.match(/PLANE\(/g).length).toBe(4);
    // Every #n reference points to an existing entity.
    const ids = new Set([...txt.matchAll(/^#(\d+)=/gm)].map((m) => Number(m[1])));
    for (const m of txt.matchAll(/#(\d+)/g)) expect(ids.has(Number(m[1]))).toBe(true);
    // Each edge is used exactly twice with opposite orientation inside each solid.
    const uses = new Map();
    for (const m of txt.matchAll(/ORIENTED_EDGE\('',\*,\*,(#\d+),\.(T|F)\.\)/g)) {
      const u = uses.get(m[1]) ?? [];
      u.push(m[2]);
      uses.set(m[1], u);
    }
    for (const [, u] of uses) expect(u.sort()).toEqual(['F', 'T']);
    const half = wingToStep(build, { mirror: false });
    expect(half.match(/MANIFOLD_SOLID_BREP/g).length).toBe(1);
  });

  it('writes a copy with Y as the up axis: (x, y, z) becomes (x, z, −y), orientation and volume kept', () => {
    const b = buildWing(stepCases().find((c) => c.name === 'mitred-vtail-35').project);
    const turn = ([x, y, z]) => [x, z, -y];
    const numbers = (txt, entity) => [...txt.matchAll(new RegExp(`${entity}\\('',\\(([^)]*)\\)\\)`, 'g'))].map((m) => m[1].split(',').map(Number));
    const zUp = wingToStep(b, { mirror: true, timestamp: 'T' });
    const yUp = wingToStep(b, { mirror: true, timestamp: 'T', up: 'y' });
    // The same entities in the same order; every point and direction turned.
    expect(yUp.replace(/\(([-\d.E+]+,){2}[-\d.E+]+\)/g, '()')).toBe(zUp.replace(/\(([-\d.E+]+,){2}[-\d.E+]+\)/g, '()'));
    // The world placement of the representation (origin, z and x directions) stays; the part turns.
    for (const entity of ['CARTESIAN_POINT', 'DIRECTION']) {
      const [a, c] = [numbers(zUp, entity), numbers(yUp, entity)];
      expect(c).toHaveLength(a.length);
      const world = entity === 'DIRECTION' ? 2 : 1;
      expect(c.slice(0, world)).toEqual(a.slice(0, world));
      for (let i = world; i < a.length; i++) expect(dist3(turn(a[i]), c[i]), `${entity} ${i}`).toBeLessThan(1e-12);
    }
    // Meshes: turned positions, the same triangles, closed and of the same volume.
    for (const mode of ['right', 'halves', 'merged']) {
      const [plain, turned] = [exportMeshes(b, mode), exportMeshes(b, mode, { up: 'y' })];
      turned.forEach(({ mesh }, k) => {
        const m = plain[k].mesh;
        expect(mesh.indices).toEqual(m.indices);
        for (let i = 0; i < m.positions.length; i += 3) expect(dist3(turn([m.positions[i], m.positions[i + 1], m.positions[i + 2]]), [mesh.positions[i], mesh.positions[i + 1], mesh.positions[i + 2]])).toBe(0);
        expect(edgeCheck(mesh).closed).toBe(true);
        expect(meshVolume(mesh)).toBeCloseTo(meshVolume(m), 6);
      });
    }
    // The upper surface faces +Y: the tip of the 35° V-tail is the highest point.
    const ys = exportMeshes(b, 'right', { up: 'y' })[0].mesh.positions.filter((_, i) => i % 3 === 1);
    expect(Math.max(...ys)).toBeCloseTo(Math.max(...b.stations.at(-1).points.map((P) => P[2])), 6);
  });

  it('writes the end caps in the planes of the end sections', () => {
    const b = buildWing(stepCases().find((c) => c.name === 'mitred-vtail-35').project);
    const directions = (txt) => [...txt.matchAll(/DIRECTION\('',\(([^)]*)\)\)/g)].map((m) => m[1].split(',').map(Number));
    const near = (list, d) => list.some((q) => q.every((c, k) => Math.abs(c - d[k]) < 1e-12));
    const [c, s] = [Math.cos((b.tipRoll * Math.PI) / 180), Math.sin((b.tipRoll * Math.PI) / 180)];
    expect(b.tipRoll).toBeCloseTo(35, 9);
    // The vertical root faces −y; the tip faces along the normal of its plane rolled 35°; the
    // mirrored half mirrors both.
    const half = directions(wingToStep(b, { mirror: false }));
    expect([near(half, [0, -1, 0]), near(half, [0, c, s]), near(half, [0, -c, s])]).toEqual([true, true, false]);
    const both = directions(wingToStep(b, { mirror: true }));
    expect([near(both, [0, 1, 0]), near(both, [0, -c, s])]).toEqual([true, true]);
  });

  it('handles every validation case and closed trailing edges', () => {
    for (const c of stepCases()) {
      const b = buildWing(c.project);
      expect(b.errors).toEqual([]);
      const txt = wingToStep(b, { mirror: c.mirror, name: c.name });
      const faces = txt.match(/ADVANCED_FACE/g).length;
      expect(faces).toBe((b.closedTE ? 4 : 5) * (c.mirror ? 2 : 1));
    }
    expect(() => wingToStep({ surface: null })).toThrow();
  });
});

/** Distance of two 3D points. */
const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

describe('project JSON', () => {
  const project = sampleProject();
  const build = buildWing(project);

  it('exports project, profiles, curves and surface', () => {
    const j = projectToJson(project, build, { generatorVersion: '1.2.3', exportedAt: '2026-01-01T00:00:00Z' });
    expect(j.format).toBe('wingdesigner-project');
    expect(j.generator.version).toBe('1.2.3');
    expect(j.airfoils.length).toBe(2);
    expect(j.derived.profiles.length).toBe(2);
    expect(j.derived.profiles[0].curve.knots.length).toBe(j.derived.profiles[0].curve.controlPoints.length + 4);
    expect(j.derived.surface.controlPoints.length).toBe(build.surface.points.length);
    expect(j.derived.guides).toEqual({ nose: null, end: null });
    expect(j.derived.stations.length).toBe(3);
    const noDerived = projectToJson(project, null);
    expect(noDerived.derived).toBeUndefined();
  });

  it('round-trips through text', () => {
    const p = sampleProject();
    p.guides.nose.enabled = true;
    const txt = projectToJsonText(p, buildWing(p));
    const r = projectFromJsonText(txt);
    expect(r.ok).toBe(true);
    expect(r.project.sections).toEqual(p.sections);
    // Guides read without an `edited` flag get it from their points (section edges: not edited).
    expect(r.project.guides).toEqual({ nose: { ...p.guides.nose, edited: false }, end: { ...p.guides.end, edited: false } });
    expect(r.project.airfoils[0].points).toEqual(p.airfoils[0].points);
    const b2 = buildWing(r.project);
    expect(b2.errors).toEqual([]);
    expect(b2.surface.points).toEqual(buildWing(p).surface.points);
  });

  it('marks guides of files without the edited flag as edited when their points differ from the section edges', () => {
    const p = sampleProject();
    p.guides.nose.points[1] = [35, 300];
    const json = projectToJson(p, null);
    for (const key of ['nose', 'end']) delete json.guides[key].edited;
    const r = projectFromJsonText(JSON.stringify(json));
    expect(r.ok).toBe(true);
    expect(r.project.guides.nose.edited).toBe(true);
    expect(r.project.guides.end.edited).toBe(false);
    // Switching the custom guide on keeps its points; the unedited one starts at the section edges.
    setGuideEnabled(r.project, 'nose', true);
    expect(r.project.guides.nose.points[1]).toEqual([35, 300]);
    // An explicit flag is kept as written.
    json.guides.nose.edited = false;
    expect(projectFromJsonText(JSON.stringify(json)).project.guides.nose.edited).toBe(false);
  });

  it('rejects oversized section and guide arrays without visiting every entry', () => {
    const json = projectToJson(sampleProject(), null);
    json.sections = Array.from({ length: 300_000 }, () => ({}));
    const t0 = performance.now();
    expect(validateProject(json).errors).toEqual([`At most ${LIMITS.maxSections.toLocaleString('en')} sections are supported (found 300,000).`]);
    const g = projectToJson(sampleProject(), null);
    g.guides.end.points = Array.from({ length: 300_000 }, () => ['x', null]);
    expect(validateProject(g).errors).toEqual([`guides.end.points: at most ${LIMITS.maxGuidePoints.toLocaleString('en')} points (found 300,000).`]);
    expect(performance.now() - t0).toBeLessThan(500);
  });

  it('rejects airfoils above the airfoil file point limit in project files', () => {
    const json = projectToJson(sampleProject(), null);
    const n = LIMITS.maxPointsPerAirfoil + 1;
    json.airfoils[0].points = Array.from({ length: n }, (_, i) => [Math.abs(Math.cos((2 * Math.PI * i) / (n - 1))), 0.05 * Math.sin((2 * Math.PI * i) / (n - 1))]);
    const r = projectFromJsonText(JSON.stringify(json));
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toBe(`Airfoil 1 has ${n.toLocaleString('en')} points; the limit is ${LIMITS.maxPointsPerAirfoil.toLocaleString('en')}.`);
  });

  it('writes numbers of a point or knot vector on one line and parses to the same data', () => {
    const project = sampleProject();
    const json = projectToJson(project, buildWing(project));
    const text = projectToJsonText(project, buildWing(project), { exportedAt: json.exportedAt });
    expect(JSON.parse(text)).toEqual(JSON.parse(JSON.stringify(json)));
    const [x, y] = json.airfoils[0].points[1];
    expect(text).toContain(`[${x}, ${y}]`);
    expect(text.length).toBeLessThan(0.75 * JSON.stringify(json, null, 1).length);
    const odd = { a: [1, null, undefined, Number.NaN, 'x'], b: {}, c: [], d: [[]], e: { f: undefined, g: [1.5e-7, -0] } };
    expect(JSON.parse(formatJson(odd))).toEqual(JSON.parse(JSON.stringify(odd)));
  });

  it('names airfoils without a name after their id on import', () => {
    const j = projectToJson(sampleProject(), null);
    const extra = { ...j.airfoils[0], id: 'second', points: j.airfoils[0].points.map(([x, y]) => [x, 0.9 * y]) };
    delete j.airfoils[0].name;
    j.airfoils.push({ ...extra, name: '  ' });
    const r = projectFromJsonText(JSON.stringify(j));
    expect(r.ok).toBe(true);
    expect(r.project.airfoils.map((a) => a.name)).toEqual([j.airfoils[0].id, j.airfoils[1].name, 'second']);
  });

  it('limits names, ids and source texts, and drops unknown keys on import', () => {
    const base = () => projectToJson(sampleProject(), null);
    const long = (n) => 'x'.repeat(n);
    const errorsOf = (edit) => {
      const j = base();
      edit(j);
      return projectFromJsonText(JSON.stringify(j)).errors;
    };
    const max = LIMITS.maxName;
    const count = (v) => v.toLocaleString('en');
    // At the limits the project loads.
    const ok = base();
    ok.name = long(max);
    ok.airfoils[0].name = long(max);
    ok.airfoils[0].source = { kind: 'upload', attribution: long(2000) };
    expect(projectFromJsonText(JSON.stringify(ok)).ok).toBe(true);
    expect(errorsOf((j) => (j.name = long(max + 1)))).toEqual([`name has ${count(max + 1)} characters; the limit is ${count(max)}.`]);
    expect(errorsOf((j) => (j.airfoils[0].name = long(2_000_000)))).toEqual([`Airfoil 1: name has 2,000,000 characters; the limit is ${count(max)}.`]);
    expect(errorsOf((j) => (j.airfoils[0].name = 7))).toEqual(['Airfoil 1: name must be a string.']);
    expect(errorsOf((j) => (j.airfoils[0].source = { url: long(2001) }))).toEqual(['Airfoil 1: source.url has 2001 characters; the limit is 2000.']);
    expect(errorsOf((j) => (j.sections[0].id = long(201)))).toEqual(['Section 1: id has 201 characters; the limit is 200.']);
    // A long id is not quoted in the messages.
    const idErrors = errorsOf((j) => (j.airfoils[0].id = long(100_000)));
    expect(idErrors[0]).toBe('Airfoil 1: id has 100000 characters; the limit is 200.');
    expect(Math.max(...idErrors.map((e) => e.length))).toBeLessThan(200);
    // Unknown keys and their contents are not kept.
    const extra = base();
    extra.junk = long(1000);
    extra.airfoils[0].junk = [long(1000)];
    extra.airfoils[0].source = { kind: 'upload', junk: long(1000) };
    extra.sections[0].junk = long(1000);
    extra.settings.junk = long(1000);
    extra.settings.tip.junk = long(1000);
    extra.guides.nose.junk = long(1000);
    const r = projectFromJsonText(JSON.stringify(extra));
    expect(r.ok).toBe(true);
    expect(JSON.stringify(r.project)).not.toContain('junk');
    expect(r.project.airfoils[0].source).toEqual({ kind: 'upload' });
  });

  it('rejects malformed input with messages', () => {
    expect(projectFromJsonText('{').errors[0]).toMatch(/Invalid JSON/);
    expect(projectFromJsonText('{}').ok).toBe(false);
    const bad = projectToJson(project, null);
    bad.sections[0].chord = -1;
    bad.sections[1].airfoil = 'x';
    bad.settings.spanwise = 'cubic';
    const r = projectFromJsonText(JSON.stringify(bad));
    expect(r.ok).toBe(false);
    expect(r.errors.length).toBeGreaterThanOrEqual(3);
    const noGuides = projectToJson(project, null);
    delete noGuides.guides;
    const ng = projectFromJsonText(JSON.stringify(noGuides));
    expect(ng.ok).toBe(true);
    expect(ng.project.guides.nose.points.length).toBe(3);
  });

  it('validates every field', () => {
    expect(validateProject(null).ok).toBe(false);
    const base = () => projectToJson(project, null);
    const cases = [
      (p) => (p.format = 'x'),
      (p) => (p.version = 99),
      (p) => (p.airfoils = []),
      (p) => (p.sections = [p.sections[0]]),
      (p) => (p.airfoils[1].id = p.airfoils[0].id),
      (p) => (p.airfoils[0].id = ''),
      (p) => (p.airfoils[0].points = [[0, 0]]),
      (p) => (p.sections[0].x = 'a'),
      (p) => (p.sections[0].y = -5),
      (p) => (p.sections[1].y = p.sections[0].y),
      (p) => (p.sections[1].id = p.sections[0].id),
      (p) => (p.settings.trailingEdge.mode = 'x'),
      (p) => (p.settings.trailingEdge.thickness = -1),
      (p) => (p.settings.twistPivot = 2),
      (p) => (p.settings.chordSamples = 5),
      (p) => (p.settings.panelStations = 100),
      (p) => (p.settings.parametrization = 'x'),
      (p) => (p.guides.nose.mode = 'x'),
      (p) => (p.guides.nose.points = [[0, 0]]),
      (p) => (p.guides.end.points = [['a', 0], [1, 1]]),
      (p) => (p.guides.end.degree = 9),
      (p) => (p.settings.tip = { mode: 'round', ratio: 0.005 }),
      (p) => (p.settings.tip = { mode: 'pointed', ratio: 0.5 }),
      (p) => (p.settings.mirror = 'false'),
      (p) => (p.version = 0),
      (p) => (p.sections[2].chord = 0.99),
      (p) => (p.guides.nose.enabled = 'true'),
      (p) => (p.settings.trailingEdge = 'closed'),
      (p) => (p.settings.tip = 'pointed'),
      (p) => (p.guides.end.enabled = 1),
      (p) => (p.guides.end.edited = 'yes'),
      (p) => (p.sections[1].twist = 361),
      (p) => (p.sections[1].twist = -1e308),
      (p) => (p.sections[1].chord = 100_001),
      (p) => (p.sections[1].x = 1_000_001),
      (p) => (p.sections[1].z = -1_000_001),
      (p) => (p.sections[2].y = 1_000_001),
      (p) => (p.guides.nose.points = Array.from({ length: LIMITS.maxGuidePoints + 1 }, (_, i) => [0, (600 * i) / LIMITS.maxGuidePoints])),
      (p) => (p.guides.nose.points[1] = [2e6, 300]),
      (p) => (p.guides.end.points[1] = [-1_100_001, 300]),
      (p) => {
        const s = p.sections[0];
        p.sections = Array.from({ length: LIMITS.maxSections + 1 }, (_, i) => ({ ...s, id: `s${i}`, y: i * 3 }));
      },
      (p) => (p.settings.sectionPlanes = 'tilted'),
      (p) => (p.foldedTilt = 5),
      (p) => (p.foldedTilt = { angle: '2', x: 0, z: 0 }),
      (p) => (p.foldedTilt = { angle: 2, x: 0 }),
      (p) => (p.foldedTilt = { angle: 180.5, x: 0, z: 0 }),
      (p) => (p.foldedTilt = { angle: 2, x: 1_000_001, z: 0 }),
      (p) => (p.foldedTilt = { angle: 2, x: 0, z: -1_000_001 }),
    ];
    for (const mutate of cases) {
      const p = base();
      mutate(p);
      expect(validateProject(p).ok).toBe(false);
    }
    const p = base();
    delete p.guides.end;
    expect(validateProject(p).ok).toBe(true);
    p.sections[2].chord = 1;
    p.sections[1].twist = -360;
    p.sections[1].chord = 100_000;
    p.guides.nose.edited = true;
    p.guides.nose.points = Array.from({ length: LIMITS.maxGuidePoints }, (_, i) => [0, (600 * i) / (LIMITS.maxGuidePoints - 1)]);
    p.foldedTilt = { angle: -180, x: -1_000_000, z: 1_000_000 };
    expect(validateProject(p).ok).toBe(true);
    p.foldedTilt = null;
    expect(validateProject(p).ok).toBe(true);
  });

  it('opens version 1 files with vertical section planes, and version 2 and 3 files as saved', () => {
    const mitred = sampleProject({ settings: { sectionPlanes: 'mitred' } });
    const v3 = projectToJson(mitred, null);
    expect([v3.version, v3.settings.sectionPlanes, v3.settings.partTilt]).toEqual([3, 'mitred', 0]);
    const v2 = { ...structuredClone(v3), version: 2 };
    // A version 1 file holds no section-plane setting; its wing keeps the vertical sections it was
    // designed with, not the default of new projects.
    const v1 = structuredClone(v2);
    v1.version = 1;
    delete v1.settings.sectionPlanes;
    const old = projectFromJsonText(JSON.stringify(v1));
    expect([old.ok, old.project.version, old.project.settings.sectionPlanes]).toEqual([true, 4, 'vertical']);
    expect(buildWing(old.project).surface).toEqual(buildWing(sampleProject()).surface);
    // A version 2 file without the setting takes the default, and one with it keeps it.
    const bare = structuredClone(v2);
    delete bare.settings.sectionPlanes;
    expect(projectFromJsonText(JSON.stringify(bare)).project.settings.sectionPlanes).toBe('mitred');
    expect(projectFromJsonText(JSON.stringify({ ...v2, settings: { ...v2.settings, sectionPlanes: 'vertical' } })).project.settings.sectionPlanes).toBe('vertical');
    // A later format is refused rather than opened without its values.
    expect(projectFromJsonText(JSON.stringify({ ...v3, version: 5 })).errors).toEqual(['Unsupported project version 5.']);
    // A version 3 file keeps a folded tilt with its three numbers only (an upgrade that kept the fold).
    const tilted = projectFromJsonText(JSON.stringify({ ...v3, foldedTilt: { angle: 2, x: 10, z: -5, note: 'x' } }));
    expect([tilted.project.foldedTilt, tilted.notes]).toEqual([{ angle: 2, x: 10, z: -5 }, []]);
    expect(projectFromJsonText(JSON.stringify(v3)).project.foldedTilt).toBeUndefined();
    // A version 2 file with a folded tilt opens with the tilt as a rigid placement of the part.
    const upgraded = projectFromJsonText(JSON.stringify({ ...v2, foldedTilt: { angle: 2, x: 10, z: -5 } }));
    expect(upgraded.project.foldedTilt).toBeUndefined();
    expect(upgraded.project.settings).toMatchObject({ partTilt: 2, partRoll: 0, partPivot: { x: 10, y: 0, z: -5 } });
    expect(upgraded.notes).toHaveLength(2);
  });

  it('creates projects with defaults', () => {
    const p = createProject({ airfoils: project.airfoils, sections: [{ airfoil: 'root', x: 0, y: 0, chord: 100 }, { airfoil: 'tip', x: 0, y: 100, chord: 80 }] });
    expect(p.sections[0]).toMatchObject({ id: 's1', z: 0, twist: 0 });
    expect(p.settings.trailingEdge.mode).toBe('asis');
    expect(validateProject(p).ok).toBe(true);
  });
});

describe('import hardening', () => {
  const base = () => projectToJson(sampleProject(), null);

  it('fills each missing guide independently', () => {
    const p = base();
    delete p.guides.end;
    p.guides.nose.enabled = true;
    const r = projectFromJsonText(JSON.stringify(p));
    expect(r.ok).toBe(true);
    expect(r.project.guides.nose.enabled).toBe(true);
    expect(r.project.guides.end).toMatchObject({ enabled: false, mode: 'fit', degree: 3 });
    expect(r.project.guides.end.points).toEqual([[200, 0], [190, 300], [170, 600]]);
    const q = base();
    q.guides = null;
    expect(projectFromJsonText(JSON.stringify(q)).project.guides.nose.points.length).toBe(3);
  });

  it('rejects units other than mm', () => {
    const p = base();
    p.units = 'in';
    const r = projectFromJsonText(JSON.stringify(p));
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toMatch(/units must be "mm"/);
  });

  it('checks effective section ids', () => {
    const p = base();
    delete p.sections[0].id;
    p.sections[1].id = 's1';
    expect(projectFromJsonText(JSON.stringify(p)).errors).toContain('Duplicate section id "s1".');
    const q = base();
    q.sections[0].id = 7;
    expect(validateProject(q).ok).toBe(false);
    const n = base();
    n.sections[0].id = null;
    const r = projectFromJsonText(JSON.stringify(n));
    expect(r.ok).toBe(true);
    expect(r.project.sections[0].id).toBe('s1');
  });

  it('rejects project text above the size limit', () => {
    expect(projectFromJsonText(' '.repeat(MAX_PROJECT_BYTES + 1)).errors[0]).toBe('The file is larger than 100 MB.');
  });

  it('fits imported guide curves to the root-to-tip span', () => {
    const j = projectToJson(sampleProject(), null);
    const ys = j.sections.map((s) => s.y).sort((a, b) => a - b);
    j.guides.end = { enabled: true, mode: 'fit', degree: 3, points: [[200, 100], [190, 150], [150, 200]] };
    const r = projectFromJsonText(JSON.stringify(j));
    expect(r.ok).toBe(true);
    const pts = r.project.guides.end.points;
    expect(pts[0][1]).toBe(ys[0]);
    expect(pts[2][1]).toBeCloseTo(ys[ys.length - 1], 9);
    expect(pts[1][1]).toBeCloseTo((ys[0] + ys[ys.length - 1]) / 2, 9);
    expect(pts.map((p) => p[0])).toEqual([200, 190, 150]);
  });

  it('counts file size in UTF-8 bytes', () => {
    expect(utf8Length('abc')).toBe(3);
    expect(utf8Length('é')).toBe(2);
    expect(utf8Length('€')).toBe(3);
    expect(utf8Length('😀')).toBe(4);
    expect(utf8Length('\ud800x')).toBe(4);
    const s = 'aé€😀';
    expect(utf8Length(s)).toBe(new TextEncoder().encode(s).length);
  });

  it('leaves out the derived data when the file would exceed the Open limit', () => {
    const p = sampleProject();
    const b = buildWing(p);
    const small = projectFileText(p, b);
    expect(small).toMatchObject({ derived: true, omitted: false });
    expect(JSON.parse(small.text).derived.surface.degreeU).toBe(3);
    // A surface whose control points alone take more than MAX_PROJECT_BYTES: 2.2 million points of
    // 3 numbers with 16 characters and a separator each.
    const long = [123.456789012345, 1.23456789012345, 0.123456789012345];
    const huge = { ...b, surface: { ...b.surface, points: [new Array(Math.ceil((1.1 * MAX_PROJECT_BYTES) / 54) + 1).fill(long)] } };
    const big = projectFileText(p, huge);
    expect(big).toMatchObject({ derived: false, omitted: true });
    expect(JSON.parse(big.text).derived).toBeUndefined();
    expect(projectFromJsonText(big.text).ok).toBe(true);
    expect(projectFileText(p, null)).toMatchObject({ derived: false, omitted: false });
    // 5.1 million short numbers (27 MB of text) are written, although 26 characters a number would
    // exceed the limit.
    const zeros = { ...b, surface: { ...b.surface, points: [new Array(1_700_000).fill([0, 0, 0])] } };
    const kept = projectFileText(p, zeros);
    expect(kept).toMatchObject({ derived: true, omitted: false });
    expect(utf8Length(kept.text)).toBeLessThan(MAX_PROJECT_BYTES / 3);
  });

  it('returns errors instead of throwing on malformed containers', () => {
    const cases = [
      (p) => (p.settings = null),
      (p) => (p.settings = 5),
      (p) => (p.guides = 'x'),
      (p) => (p.guides.nose = 3),
      (p) => (p.sections[0] = null),
      (p) => (p.airfoils[0] = null),
    ];
    for (const mutate of cases) {
      const p = base();
      mutate(p);
      const r = projectFromJsonText(JSON.stringify(p));
      expect(r.ok).toBe(false);
      expect(r.errors.length).toBeGreaterThan(0);
    }
    const t = base();
    t.settings.trailingEdge = null;
    expect(projectFromJsonText(JSON.stringify(t)).project.settings.trailingEdge).toEqual({ mode: 'asis', thickness: 0.4 });
  });
});

describe('project file precision', () => {
  it('keeps derived span parameters of close sections distinct', () => {
    const project = createProject({
      airfoils: [{ id: 'a', name: 'NACA 2412', points: nacaAirfoil('2412').points }],
      sections: [0, 500000, 500000.000000001, 1000000].map((y, i) => ({ airfoil: 'a', x: i === 2 ? 50 : 0, y, z: 0, chord: 200, twist: 0 })),
    });
    const build = buildWing(project);
    expect(build.errors).toEqual([]);
    const j = JSON.parse(JSON.stringify(projectToJson(project, build)));
    const vs = j.derived.stations.map((s) => s.v);
    for (let i = 1; i < vs.length; i++) expect(vs[i]).toBeGreaterThan(vs[i - 1]);
    expect(j.derived.surface.knotsV).toEqual(build.surface.knotsV);
    expect(j.derived.surface.controlPoints).toEqual(build.surface.points);
  });
});

describe('German export messages', () => {
  afterEach(() => setLanguage('en'));

  const wing = (x, z, chord, settings) =>
    buildWing(
      createProject({
        airfoils: [{ id: 'a', name: 'NACA 2412', points: nacaAirfoil('2412').points }],
        sections: [0, 10].map((y) => ({ airfoil: 'a', x, y, z, chord, twist: 0 })),
        settings,
      }),
    );

  it('names the coordinate precision of STL and 3MF in German, with decimal commas', () => {
    // 7.41 mm chord near the coordinate limit: 4 triangles turn over at 32-bit precision.
    const far = concatMeshes(exportMeshes(wing(801579, 955903, 7.41, { chordSamples: 16 }), 'halves', { uRefine: 1, vRefine: 1 }).map((m) => m.mesh));
    setLanguage('de');
    expect(() => meshToStl(far)).toThrow('STL speichert 32-Bit-Koordinaten: Bei 955.903 mm beträgt ihr Rasterabstand 0,063 mm, und 4 von 256 Dreiecken fallen zusammen oder kehren sich um. Den Flügel zum Ursprung hin verschieben oder als STEP exportieren.');
    expect(() => meshesTo3mf([{ name: 'w', mesh: far }])).toThrow(
      '3MF-Leseprogramme speichern 32-Bit-Koordinaten: Bei 955.903 mm beträgt ihr Rasterabstand 0,063 mm, und 4 von 256 Dreiecken fallen zusammen oder kehren sich um. Den Flügel zum Ursprung hin verschieben oder als STEP exportieren.',
    );
    expect(() => meshToStl(far)).toThrow(MeshPrecisionError);
    setLanguage('en');
    expect(() => meshToStl(far)).toThrow(/^STL stores 32-bit coordinates: at 955903 mm their spacing is 0\.063 mm/);
  });

  it('names sections that lie closer together than the coordinate spacing', () => {
    const close = sampleProject();
    close.sections.push({ id: 'd', airfoil: 'root', x: 20, y: 300.00001, z: 10, chord: 170, twist: -1 });
    const build = buildWing(close);
    expect(build.errors).toEqual([]);
    const mesh = concatMeshes(exportMeshes(build, 'halves').map((m) => m.mesh));
    setLanguage('de');
    for (const write of [() => meshToStl(mesh), () => meshesTo3mf([{ name: 'w', mesh }])]) {
      expect(write).toThrow(
        /^(STL speichert|3MF-Leseprogramme speichern) 32-Bit-Koordinaten: Bei 300 mm beträgt ihr Rasterabstand 0,000031 mm, und [\d.]+ von [\d.]+ Dreiecken fallen zusammen oder kehren sich um\. Schnitte oder Stationen nahe y = 300(,00001)? mm liegen dichter beieinander als der Rasterabstand dort \(0,000031 mm\); sie auseinanderschieben oder als STEP exportieren\.$/,
      );
    }
    const offset = [0, 1e6, 0, 1, 1e6, 0, 0, 1e6 + 0.01, 0];
    expect(() => checkPrecision(offset, [0, 1, 2], Math.fround, 'STL')).toThrow(/\. Den Flügel zum Ursprung hin verschieben oder als STEP exportieren\.$/);
    // One damaged triangle takes the singular verb.
    expect(() => checkPrecision(offset, [0, 1, 2], Math.fround, 'STL')).toThrow(/, und 1 von 1 Dreiecken fällt zusammen oder kehrt sich um\. /);
    expect(() => checkPrecision(offset, [0, 1, 2], Math.fround, '3MF')).toThrow(/^3MF-Leseprogramme speichern 32-Bit-Koordinaten: Bei 1\.000\.000 mm .*, und 1 von 1 Dreiecken fällt zusammen oder kehrt sich um\. /);
  });

  it('names STEP export errors in German', () => {
    setLanguage('de');
    expect(() => wingToStep({ surface: null })).toThrow('Der Flügel hat keine Fläche; zuerst die gemeldeten Fehler beheben.');
    expect(() => stepReal(NaN)).toThrow('Nicht endlicher Wert im STEP-Export: NaN');
    expect(() => stepReal(-Infinity)).toThrow('Nicht endlicher Wert im STEP-Export: -Infinity');
    setLanguage('en');
    expect(() => wingToStep({ surface: null })).toThrow('The wing has no surface; fix the reported errors first.');
    expect(() => stepReal(NaN)).toThrow('Non-finite value in STEP export: NaN');
  });

  it('keeps STEP, STL and 3MF file content English', () => {
    const build = buildWing(sampleProject());
    const mesh = concatMeshes(exportMeshes(build, 'halves').map((m) => m.mesh));
    const files = () => ({
      step: wingToStep(build, { timestamp: '2026-01-01T00:00:00', name: 'Flügel' }),
      stl: Array.from(meshToStl(mesh)).join(','),
      threemf: modelXml(exportMeshes(build, 'halves'), { title: 'Flügel' }),
    });
    const english = files();
    setLanguage('de');
    expect(files()).toEqual(english);
    expect(english.step).toContain("FILE_DESCRIPTION(('Wingdesigner wing')");
    expect(english.threemf).toContain('name="Wing right"');
  });
});
