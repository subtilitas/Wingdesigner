// Project data model, defaults and validation.
//
// Coordinates: x chordwise (positive towards the trailing edge), y spanwise (positive towards the
// right tip), z up. Units: millimetres. A section places a normalized airfoil with its leading edge
// at (x, y, z), scaled by `chord`, rotated by `twist` degrees (positive = leading edge up) about the
// chord point at `settings.twistPivot`. The half wing spans y >= 0 and is mirrored at the plane y = 0.

import { defaultGuides } from '../geom/guide.js';

export const FORMAT = 'wingdesigner-project';
export const VERSION = 1;

export const DEFAULT_SETTINGS = Object.freeze({
  spanwise: 'linear',
  twistPivot: 0.25,
  trailingEdge: Object.freeze({ mode: 'asis', thickness: 0.4 }),
  chordSamples: 60,
  panelStations: 8,
  parametrization: 'centripetal',
  mirror: true,
});

export const LIMITS = Object.freeze({
  minChord: 0.1,
  chordSamples: [16, 200],
  panelStations: [3, 40],
});

let counter = 0;
export function newId(prefix) {
  counter += 1;
  return `${prefix}${Date.now().toString(36)}${counter.toString(36)}`;
}

export function cloneProject(p) {
  return structuredClone(p);
}

/** Merge settings with defaults (deep for trailingEdge). */
export function resolveSettings(settings = {}) {
  return {
    ...DEFAULT_SETTINGS,
    ...settings,
    trailingEdge: { ...DEFAULT_SETTINGS.trailingEdge, ...(settings.trailingEdge ?? {}) },
  };
}

/**
 * Create a project from airfoils and sections; guides default to the section edges (disabled).
 */
export function createProject({ name = 'Untitled wing', airfoils, sections, guides, settings } = {}) {
  const secs = sections.map((s, i) => ({ id: s.id ?? `s${i + 1}`, twist: 0, z: 0, ...s }));
  return {
    format: FORMAT,
    version: VERSION,
    name,
    units: 'mm',
    airfoils: airfoils.map((a) => ({ ...a, points: a.points.map((p) => [p[0], p[1]]) })),
    sections: secs,
    guides: guides ?? defaultGuides(secs),
    settings: resolveSettings(settings),
  };
}

function isNum(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

/**
 * Structural validation of a project object (for imports).
 * Returns { ok, errors: string[] }.
 */
export function validateProject(p) {
  const errors = [];
  if (!p || typeof p !== 'object') return { ok: false, errors: ['Project is not an object.'] };
  if (p.format !== FORMAT) errors.push(`format must be "${FORMAT}".`);
  if (!Number.isInteger(p.version) || p.version > VERSION) errors.push(`Unsupported project version ${p.version}.`);
  if (!Array.isArray(p.airfoils) || p.airfoils.length === 0) errors.push('airfoils must be a non-empty array.');
  if (!Array.isArray(p.sections) || p.sections.length < 2) errors.push('At least 2 sections are required.');
  if (errors.length) return { ok: false, errors };
  const ids = new Set();
  for (const a of p.airfoils) {
    if (typeof a.id !== 'string' || !a.id) errors.push('Every airfoil needs a string id.');
    else if (ids.has(a.id)) errors.push(`Duplicate airfoil id "${a.id}".`);
    else ids.add(a.id);
    if (!Array.isArray(a.points) || a.points.length < 5 || !a.points.every((q) => Array.isArray(q) && isNum(q[0]) && isNum(q[1]))) {
      errors.push(`Airfoil "${a.id}" needs at least 5 numeric [x, y] points.`);
    }
  }
  const secIds = new Set();
  p.sections.forEach((s, i) => {
    for (const k of ['x', 'y', 'z', 'chord', 'twist']) {
      if (!isNum(s[k])) errors.push(`Section ${i + 1}: ${k} must be a finite number.`);
    }
    if (isNum(s.chord) && s.chord < LIMITS.minChord) errors.push(`Section ${i + 1}: chord must be at least ${LIMITS.minChord} mm.`);
    if (isNum(s.y) && s.y < 0) errors.push(`Section ${i + 1}: y must be >= 0 (the half wing lies on the +y side).`);
    if (!ids.has(s.airfoil)) errors.push(`Section ${i + 1}: unknown airfoil "${s.airfoil}".`);
    if (s.id !== undefined) {
      if (secIds.has(s.id)) errors.push(`Duplicate section id "${s.id}".`);
      secIds.add(s.id);
    }
  });
  const ys = p.sections.map((s) => s.y).sort((a, b) => a - b);
  for (let i = 1; i < ys.length; i++) {
    if (!(ys[i] > ys[i - 1])) {
      errors.push('Section span positions y must be distinct.');
      break;
    }
  }
  const st = resolveSettings(p.settings);
  if (!['linear', 'smooth'].includes(st.spanwise)) errors.push('settings.spanwise must be "linear" or "smooth".');
  if (!['asis', 'closed', 'thickness'].includes(st.trailingEdge.mode)) errors.push('settings.trailingEdge.mode must be "asis", "closed" or "thickness".');
  if (!isNum(st.trailingEdge.thickness) || st.trailingEdge.thickness < 0) errors.push('settings.trailingEdge.thickness must be >= 0.');
  if (!isNum(st.twistPivot) || st.twistPivot < 0 || st.twistPivot > 1) errors.push('settings.twistPivot must be within 0..1.');
  if (!Number.isInteger(st.chordSamples) || st.chordSamples < LIMITS.chordSamples[0] || st.chordSamples > LIMITS.chordSamples[1]) {
    errors.push(`settings.chordSamples must be an integer within ${LIMITS.chordSamples.join('..')}.`);
  }
  if (!Number.isInteger(st.panelStations) || st.panelStations < LIMITS.panelStations[0] || st.panelStations > LIMITS.panelStations[1]) {
    errors.push(`settings.panelStations must be an integer within ${LIMITS.panelStations.join('..')}.`);
  }
  if (!['uniform', 'chord', 'centripetal'].includes(st.parametrization)) errors.push('settings.parametrization must be uniform, chord or centripetal.');
  if (p.guides) {
    for (const key of ['nose', 'end']) {
      const g = p.guides[key];
      if (!g) continue;
      if (!['fit', 'control'].includes(g.mode)) errors.push(`guides.${key}.mode must be "fit" or "control".`);
      if (!Array.isArray(g.points) || g.points.length < 2) errors.push(`guides.${key}.points needs at least 2 points.`);
      else if (!g.points.every((q) => Array.isArray(q) && isNum(q[0]) && isNum(q[1]))) errors.push(`guides.${key}.points must be numeric [x, y] pairs.`);
      if (g.degree !== undefined && (!Number.isInteger(g.degree) || g.degree < 1 || g.degree > 5)) errors.push(`guides.${key}.degree must be 1..5.`);
    }
  }
  return { ok: errors.length === 0, errors };
}
