// Project JSON export and import. The export holds the full project (airfoil coordinates,
// sections, guide definitions, settings) plus the derived NURBS data: every profile curve,
// both guide curves, the spanwise stations and the wing surface. Import reads the project part
// and recomputes everything derived.

import { defaultGuides } from '../geom/guide.js';
import { FORMAT, VERSION, resolveSettings, validateProject } from './project.js';

const round = (x) => (Number.isFinite(x) ? Number(x.toPrecision(12)) : x);
const roundPts = (pts) => pts.map((p) => p.map(round));

function curveJson(c) {
  return c ? { degree: c.degree, knots: c.knots.map(round), controlPoints: roundPts(c.points), ...(c.weights ? { weights: c.weights } : {}) } : null;
}

/**
 * @param {object} project
 * @param {object|null} build buildWing() result (derived data omitted when null or failed)
 * @param {{generatorVersion?: string, exportedAt?: string}} [meta]
 */
export function projectToJson(project, build, meta = {}) {
  const out = {
    format: FORMAT,
    version: VERSION,
    generator: { name: 'Wingdesigner', version: meta.generatorVersion ?? '0.0.0' },
    exportedAt: meta.exportedAt ?? new Date().toISOString(),
    name: project.name,
    units: 'mm',
    coordinateSystem: 'x chordwise towards the trailing edge, y spanwise towards the right tip, z up; mirror plane y = 0',
    airfoils: structuredClone(project.airfoils),
    sections: structuredClone(project.sections),
    guides: structuredClone(project.guides),
    settings: resolveSettings(structuredClone(project.settings)),
  };
  if (build && build.surface) {
    out.derived = {
      profiles: [...build.profiles.values()].map((p) => ({
        airfoil: p.id,
        name: p.name,
        curve: curveJson(p.curve),
        leadingEdgeParameter: round(p.tLE),
      })),
      guides: { nose: curveJson(build.guides.nose), end: curveJson(build.guides.end) },
      stations: build.stations.map((s) => ({ y: round(s.y), v: round(s.v), xLE: round(s.xLE), z: round(s.z), chord: round(s.chord), twist: round(s.twist) })),
      surface: {
        degreeU: build.surface.degreeU,
        degreeV: build.surface.degreeV,
        knotsU: build.surface.knotsU.map(round),
        knotsV: build.surface.knotsV.map(round),
        controlPoints: build.surface.points.map(roundPts),
        leadingEdgeU: round(build.uLE),
        closedTrailingEdge: build.closedTE,
      },
    };
  }
  return out;
}

export function projectToJsonText(project, build, meta) {
  return JSON.stringify(projectToJson(project, build, meta), null, 1);
}

/**
 * Parse and validate project JSON text. Derived data is ignored.
 * @returns {{ok: boolean, project?: object, errors: string[]}}
 */
export function projectFromJsonText(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return { ok: false, errors: [`Invalid JSON: ${e.message}`] };
  }
  const v = validateProject(data);
  if (!v.ok) return { ok: false, errors: v.errors };
  const project = {
    format: FORMAT,
    version: VERSION,
    name: typeof data.name === 'string' ? data.name : 'Imported wing',
    units: 'mm',
    airfoils: data.airfoils.map((a) => ({ ...a, points: a.points.map((p) => [p[0], p[1]]) })),
    sections: data.sections.map((s, i) => ({ ...s, id: s.id ?? `s${i + 1}` })),
    settings: resolveSettings(data.settings),
  };
  // Fill each missing guide from the section edges.
  const defaults = defaultGuides(project.sections);
  const guides = data.guides ?? {};
  project.guides = {};
  for (const key of ['nose', 'end']) {
    const g = guides[key];
    project.guides[key] = g ? { mode: 'fit', degree: 3, ...g, enabled: g.enabled === true } : defaults[key];
  }
  return { ok: true, project, errors: [] };
}
