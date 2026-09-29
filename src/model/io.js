// Project JSON export and import. The export holds the full project (airfoil coordinates,
// sections, guide definitions, settings) plus the derived NURBS data: every profile curve,
// both guide curves, the spanwise stations and the wing surface. Import reads the project part
// and recomputes everything derived.

import { defaultGuides } from '../geom/guide.js';
import { fixed, plain, tr } from '../i18n/index.js';
import { syncGuidesToSpan } from './edit.js';
import { FORMAT, SOURCE_KEYS, VERSION, resolveSettings, validateProject } from './project.js';

// Derived numbers keep full double precision (JSON writes the shortest string that reads back to
// the same double): rounding merged distinct span parameters and knots of close sections.
const copyPts = (pts) => pts.map((p) => p.slice());

function curveJson(c) {
  return c ? { degree: c.degree, knots: c.knots.slice(), controlPoints: copyPts(c.points), ...(c.weights ? { weights: c.weights } : {}) } : null;
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
        leadingEdgeParameter: p.tLE,
      })),
      guides: { nose: curveJson(build.guides.nose), end: curveJson(build.guides.end) },
      stations: build.stations.map((s) => ({ y: s.y, v: s.v, xLE: s.xLE, z: s.z, chord: s.chord, twist: s.twist })),
      surface: {
        degreeU: build.surface.degreeU,
        degreeV: build.surface.degreeV,
        knotsU: build.surface.knotsU.slice(),
        knotsV: build.surface.knotsV.slice(),
        controlPoints: build.surface.points.map(copyPts),
        leadingEdgeU: build.uLE,
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
 * Largest project file read (bytes). 1,000,000 airfoil points take about 40 MB; names and source
 * texts near their limits can exceed it (10,000 airfoils with 10,000-character names take 102 MB,
 * and Save then fails with its size); the derived NURBS data of large wings may not fit either.
 */
export const MAX_PROJECT_BYTES = 100_000_000;


/** Bytes of a string in UTF-8, the encoding of the downloaded file (Open limits File.size). */
export function utf8Length(s) {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) n += 1;
    else if (c < 0x800) n += 2;
    else if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length && (s.charCodeAt(i + 1) & 0xfc00) === 0xdc00) {
      n += 4;
      i++;
    } else n += 3;
  }
  return n;
}

/** Numbers in the derived data of a build. */
function derivedNumbers(build) {
  const curve = (c) => (c ? 2 * c.points.length + c.knots.length + (c.weights?.length ?? 0) : 0);
  let n = 6 * build.stations.length + curve(build.guides.nose) + curve(build.guides.end);
  for (const p of build.profiles.values()) n += curve(p.curve) + 1;
  const S = build.surface;
  return n + 3 * S.points.length * S.points[0].length + S.knotsU.length + S.knotsV.length;
}

/**
 * Expected characters of the derived data: its number count times the mean length, with separator,
 * of the coordinates of at most 1,000 surface control points spread over the surface. The largest
 * possible length per number (26 characters) left the derived data out of files of 70 MB.
 */
function derivedChars(build) {
  const P = build.surface.points;
  const nJ = P[0].length;
  const total = P.length * nJ;
  const step = Math.max(1, Math.ceil(total / 1000));
  let chars = 0;
  let count = 0;
  for (let k = 0; k < total; k += step) {
    for (const v of P[Math.floor(k / nJ)][k % nJ]) {
      chars += String(v).length + 2;
      count++;
    }
  }
  return (chars / count) * derivedNumbers(build);
}

/**
 * Text of a project file (Save, JSON export). The derived NURBS data is left out when the file would
 * exceed MAX_PROJECT_BYTES, so that Open reads every file the app writes; Open recomputes it. Above
 * the limit without indentation it throws.
 * @returns {{text: string, derived: boolean, omitted: boolean}} omitted: derived data left out for size
 */
export function projectFileText(project, build, meta) {
  // Within 10 % of the limit by the estimate, the written text decides.
  if (build?.surface && derivedChars(build) <= 1.1 * MAX_PROJECT_BYTES) {
    const full = formatJson(projectToJson(project, build, meta));
    if (utf8Length(full) <= MAX_PROJECT_BYTES) return { text: full, derived: true, omitted: false };
  }
  const json = projectToJson(project, null, meta);
  // Indentation can push a project near the limit over it; compact JSON is about the size read.
  let text = formatJson(json);
  if (utf8Length(text) > MAX_PROJECT_BYTES) text = JSON.stringify(json);
  const bytes = utf8Length(text);
  if (bytes > MAX_PROJECT_BYTES) throw new Error(tr('the project takes {size} MB as a file, above the {max} MB that Open reads', { size: fixed(bytes / 1e6, 1), max: plain(MAX_PROJECT_BYTES / 1e6) }));
  return { text, derived: false, omitted: !!build?.surface };
}

/** The message after writing a file without its derived data, in the current language. */
export function omittedNote() {
  return tr('The file leaves out the derived NURBS data: with it, the file would exceed {max} MB, the largest project file Open reads. Open recomputes it; STEP export writes the exact surfaces.', {
    max: plain(MAX_PROJECT_BYTES / 1e6),
  });
}

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

const samePoints = (a, b) => a.length === b.length && a.every((p, i) => Math.abs(p[0] - b[i][0]) <= 1e-9 && Math.abs(p[1] - b[i][1]) <= 1e-9);

/**
 * Parse and validate project JSON text. Derived data is ignored.
 * @returns {{ok: boolean, project?: object, errors: string[]}}
 */
export function projectFromJsonText(text) {
  if (String(text).length > MAX_PROJECT_BYTES) return { ok: false, errors: [tr('The file is larger than {max} MB.', { max: plain(MAX_PROJECT_BYTES / 1e6) })] };
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return { ok: false, errors: [tr('Invalid JSON: {message}', { message: e.message })] };
  }
  const v = validateProject(data);
  if (!v.ok) return { ok: false, errors: v.errors };
  const project = {
    format: FORMAT,
    version: VERSION,
    name: typeof data.name === 'string' ? data.name : tr('Imported wing'),
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
  // The build stretches a guide onto the root-to-tip span; the stored points take that span too, so
  // the planform draws and edits them where the wing uses them.
  syncGuidesToSpan(project);
  return { ok: true, project, errors: [] };
}
