import { describe, expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import { buildWing } from '../src/geom/wing.js';
import { concatMeshes, edgeCheck, exportMeshes, meshVolume, mirrorMesh } from '../src/geom/mesh.js';
import { meshToStl, parseStl } from '../src/export/stl.js';
import { meshesTo3mf, modelXml, xmlEscape } from '../src/export/threemf.js';
import { stepReal, stepString, wingToStep } from '../src/export/step.js';
import { projectFromJsonText, projectToJson, projectToJsonText } from '../src/model/io.js';
import { createProject, validateProject } from '../src/model/project.js';
import { sampleProject } from './helpers.js';
import { stepCases } from './step-cases.js';

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

  it('formats numbers compactly', () => {
    const xml = modelXml([{ name: 'a', mesh: { positions: [0.1234567, -0.000001, 12], indices: [0, 0, 0] } }]);
    expect(xml).toContain('x="0.12346" y="0" z="12"');
    expect(xmlEscape(`"'`)).toBe('&quot;&apos;');
  });

  it('removes characters that XML 1.0 does not allow', () => {
    expect(xmlEscape('Wing\u0008v2\u0000\uFFFE\uD800 \u00e9\u{1F600}\t')).toBe('Wingv2 \u00e9\u{1F600}\t');
    const model = strFromU8(unzipSync(meshesTo3mf([], { title: 'A\u0008B' }))['3D/3dmodel.model']);
    expect(model).toContain('<metadata name="Title">AB</metadata>');
  });

  it('writes a model larger than one 1 MB chunk identically to the single-string XML', () => {
    // 40,000 vertices produce about 2.4 MB of XML, i.e. several chunks.
    const n = 40000;
    const positions = Float64Array.from({ length: 3 * n }, (_, i) => (i % 997) * 0.123);
    const indices = Uint32Array.from({ length: 3 * (n - 2) }, (_, i) => Math.floor(i / 3) + (i % 3));
    const objs = [{ name: 'big', mesh: { positions, indices } }];
    const xml = modelXml(objs, { title: 'big' });
    expect(xml.length).toBeGreaterThan(2 * (1 << 20));
    const model = strFromU8(unzipSync(meshesTo3mf(objs, { title: 'big' }))['3D/3dmodel.model']);
    expect(model).toBe(xml);
  });
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
    expect(r.project.guides).toEqual(p.guides);
    expect(r.project.airfoils[0].points).toEqual(p.airfoils[0].points);
    const b2 = buildWing(r.project);
    expect(b2.errors).toEqual([]);
    expect(b2.surface.points).toEqual(buildWing(p).surface.points);
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
    ];
    for (const mutate of cases) {
      const p = base();
      mutate(p);
      expect(validateProject(p).ok).toBe(false);
    }
    const p = base();
    delete p.guides.end;
    expect(validateProject(p).ok).toBe(true);
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
