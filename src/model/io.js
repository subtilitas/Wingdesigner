// Project JSON export and import. The export holds the full project (airfoil coordinates,
// sections, guide definitions, settings) plus the derived NURBS data: every profile curve,
// both guide curves, the spanwise stations and the wing surface. Import reads the project part
// and recomputes everything derived.

import { defaultGuides } from '../geom/guide.js';
import { FORMAT, SOURCE_KEYS, VERSION, resolveSettings, validateProject } from './project.js';

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

/**
 * JSON with one-space indentation, and every array of numbers (a point, a knot vector) on one line:
 * one number per line tripled the size of airfoil and surface data.
 */
export function formatJson(value, indent = '') {
  if (Array.isArray(value)) {
    if (value.every((x) => x === null || typeof x !== 'object')) return `[${value.map((x) => JSON.stringify(x) ?? 'null').join(', ')}]`;
    if (!value.length) return '[]';
    const inner = `${indent} `;
    return `[\n${value.map((x) => inner + formatJson(x, inner)).join(',\n')}\n${indent}]`;
  }
  if (value !== null && typeof value === 'object') {
    const keys = Object.keys(value).filter((k) => value[k] !== undefined && typeof value[k] !== 'function');
    if (!keys.length) return '{}';
    const inner = `${indent} `;
    return `{\n${keys.map((k) => `${inner}${JSON.stringify(k)}: ${formatJson(value[k], inner)}`).join(',\n')}\n${indent}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

export function projectToJsonText(project, build, meta) {
  return formatJson(projectToJson(project, build, meta));
}

/**
 * Parse and validate project JSON text. Derived data is ignored.
 * @returns {{ok: boolean, project?: object, errors: string[]}}
 */
/** Largest project file read (bytes): 50 MB holds hundreds of 5000-point airfoils. */
export const MAX_PROJECT_BYTES = 50_000_000;

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

const samePoints = (a, b) => a.length === b.length && a.every((p, i) => Math.abs(p[0] - b[i][0]) <= 1e-9 && Math.abs(p[1] - b[i][1]) <= 1e-9);

export function projectFromJsonText(text) {
  if (String(text).length > MAX_PROJECT_BYTES) return { ok: false, errors: [`The file is larger than ${MAX_PROJECT_BYTES / 1e6} MB.`] };
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
    // Known keys only: unknown keys (and their contents) are dropped.
    airfoils: data.airfoils.map((a) => ({
      id: a.id,
      // Lists, previews and downloads show the name; an airfoil without one shows its id.
      name: typeof a.name === 'string' && a.name.trim() ? a.name : a.id,
      points: a.points.map((p) => [p[0], p[1]]),
      ...(isObject(a.source) ? { source: Object.fromEntries(SOURCE_KEYS.filter((k) => a.source[k] !== undefined).map((k) => [k, a.source[k]])) } : {}),
    })),
    sections: data.sections.map((s, i) => ({ id: s.id ?? `s${i + 1}`, airfoil: s.airfoil, x: s.x, y: s.y, z: s.z, chord: s.chord, twist: s.twist })),
    settings: resolveSettings(data.settings),
  };
  // Fill each missing guide from the section edges.
  const defaults = defaultGuides(project.sections);
  const guides = data.guides ?? {};
  project.guides = {};
  for (const key of ['nose', 'end']) {
    const g = guides[key];
    if (!g) {
      project.guides[key] = defaults[key];
      continue;
    }
    // Files written before guides carried `edited`: points that differ from the section edges were
    // edited, and switching the guide on keeps them.
    const edited = typeof g.edited === 'boolean' ? g.edited : !samePoints(g.points, defaults[key].points);
    project.guides[key] = { mode: g.mode ?? 'fit', degree: g.degree ?? 3, points: g.points.map((q) => [q[0], q[1]]), enabled: g.enabled === true, edited };
  }
  return { ok: true, project, errors: [] };
}
