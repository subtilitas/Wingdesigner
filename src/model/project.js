// Project data model, defaults and validation.
//
// Coordinates: x chordwise (positive towards the trailing edge), y spanwise (positive towards the
// right tip), z up. Units: millimetres. A section places a normalized airfoil with its leading edge
// at (x, y, z), scaled by `chord`, rotated by `twist` degrees (positive = leading edge up) about the
// chord point at `settings.twistPivot`. The half wing spans y >= 0 and is mirrored at the plane y = 0.

import { defaultGuides } from '../geom/guide.js';
import { MAX_POINTS } from '../airfoil/parse.js';

export const FORMAT = 'wingdesigner-project';
export const VERSION = 1;

export const DEFAULT_SETTINGS = Object.freeze({
  spanwise: 'linear',
  twistPivot: 0.25,
  trailingEdge: Object.freeze({ mode: 'asis', thickness: 0.4 }),
  tip: Object.freeze({ mode: 'flat', ratio: 0.005 }),
  chordSamples: 60,
  panelStations: 8,
  parametrization: 'centripetal',
  mirror: true,
});

// minChord: smallest chord (profile depth) in mm, also the floor of a pointed tip. Below 1 mm the
// profile shape falls under the resolution of meshes, STEP modelling tolerances and manufacturing.
export const LIMITS = Object.freeze({
  minChord: 1,
  // Bounds that keep every computed coordinate finite and every rebuild interactive.
  maxChord: 100_000,
  maxCoordinate: 1_000_000,
  maxTwist: 360,
  maxSections: 200,
  // Every section can use its own airfoil; each project airfoil is a list entry with a thumbnail.
  maxAirfoils: 200,
  maxGuidePoints: 500,
  // Guide x reaches the trailing edge of any valid section (x + chord), where disabled end lines lie.
  maxGuideCoordinate: 1_100_000,
  // Extent of the built geometry: every leading edge, trailing edge and z within this bound covers
  // an end line at its limit less the largest chord. Only interpolation overshoot goes beyond it.
  maxExtent: 1_200_000,
  tipRatio: [0.001, 0.01],
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

/** Merge settings with defaults (deep for trailingEdge and tip). */
export function resolveSettings(settings) {
  const s = isObject(settings) ? settings : {};
  return {
    ...DEFAULT_SETTINGS,
    ...s,
    trailingEdge: { ...DEFAULT_SETTINGS.trailingEdge, ...(isObject(s.trailingEdge) ? s.trailingEdge : {}) },
    tip: { ...DEFAULT_SETTINGS.tip, ...(isObject(s.tip) ? s.tip : {}) },
  };
}

function isObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
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
 * Section and guide values beyond LIMITS (upper bounds that keep coordinates finite and rebuilds
 * interactive). validateProject reports them on import and buildWing again, so a project that
 * cannot be saved cannot be exported either.
 * @returns {string[]} error messages
 */
export function limitErrors(p) {
  const errors = [];
  const sections = Array.isArray(p?.sections) ? p.sections : [];
  // Counts first: an oversized array is rejected without visiting every entry.
  if (sections.length > LIMITS.maxSections) return [`At most ${LIMITS.maxSections} sections are supported (found ${sections.length}).`];
  sections.forEach((s, i) => {
    if (!isObject(s)) return;
    if (isNum(s.chord) && s.chord > LIMITS.maxChord) errors.push(`Section ${i + 1}: chord must be at most ${LIMITS.maxChord} mm.`);
    for (const k of ['x', 'y', 'z']) {
      if (isNum(s[k]) && Math.abs(s[k]) > LIMITS.maxCoordinate) errors.push(`Section ${i + 1}: ${k} must be within ±${LIMITS.maxCoordinate} mm.`);
    }
    if (isNum(s.twist) && Math.abs(s.twist) > LIMITS.maxTwist) errors.push(`Section ${i + 1}: twist must be within ±${LIMITS.maxTwist} degrees.`);
  });
  for (const key of ['nose', 'end']) {
    const g = isObject(p?.guides) ? p.guides[key] : null;
    if (!isObject(g) || !Array.isArray(g.points)) continue;
    if (g.points.length > LIMITS.maxGuidePoints) errors.push(`guides.${key}.points: at most ${LIMITS.maxGuidePoints} points.`);
    else if (g.points.some((q) => Array.isArray(q) && (Math.abs(q[0]) > LIMITS.maxGuideCoordinate || Math.abs(q[1]) > LIMITS.maxCoordinate))) {
      errors.push(`guides.${key}.points: x must be within ±${LIMITS.maxGuideCoordinate} mm and y within ±${LIMITS.maxCoordinate} mm.`);
    }
  }
  return errors;
}

/**
 * Structural validation of a project object (for imports).
 * Returns { ok, errors: string[] }.
 */
export function validateProject(p) {
  const errors = [];
  if (!p || typeof p !== 'object') return { ok: false, errors: ['Project is not an object.'] };
  if (p.format !== FORMAT) errors.push(`format must be "${FORMAT}".`);
  if (p.units !== undefined && p.units !== 'mm') errors.push(`units must be "mm" (found "${p.units}").`);
  if (p.settings !== undefined && !isObject(p.settings)) errors.push('settings must be an object.');
  if (p.guides !== undefined && p.guides !== null && !isObject(p.guides)) errors.push('guides must be an object.');
  if (!Number.isInteger(p.version) || p.version < 1 || p.version > VERSION) errors.push(`Unsupported project version ${p.version}.`);
  if (!Array.isArray(p.airfoils) || p.airfoils.length === 0) errors.push('airfoils must be a non-empty array.');
  else if (p.airfoils.length > LIMITS.maxAirfoils) errors.push(`At most ${LIMITS.maxAirfoils} airfoils are supported (found ${p.airfoils.length}).`);
  if (!Array.isArray(p.sections) || p.sections.length < 2) errors.push('At least 2 sections are required.');
  else if (p.sections.length > LIMITS.maxSections) errors.push(`At most ${LIMITS.maxSections} sections are supported (found ${p.sections.length}).`);
  if (!errors.length && !p.airfoils.every(isObject)) errors.push('Every airfoil must be an object.');
  if (!errors.length && !p.sections.every(isObject)) errors.push('Every section must be an object.');
  if (errors.length) return { ok: false, errors };
  const ids = new Set();
  for (const a of p.airfoils) {
    if (typeof a.id !== 'string' || !a.id) errors.push('Every airfoil needs a string id.');
    else if (ids.has(a.id)) errors.push(`Duplicate airfoil id "${a.id}".`);
    else ids.add(a.id);
    if (!Array.isArray(a.points) || a.points.length < 5) errors.push(`Airfoil "${a.id}" needs at least 5 numeric [x, y] points.`);
    // The airfoil file limit applies to project files too; the thumbnail draws every point.
    else if (a.points.length > MAX_POINTS) errors.push(`Airfoil "${a.id}" has ${a.points.length} points; the limit is ${MAX_POINTS}.`);
    else if (!a.points.every((q) => Array.isArray(q) && isNum(q[0]) && isNum(q[1]))) errors.push(`Airfoil "${a.id}" needs at least 5 numeric [x, y] points.`);
  }
  const secIds = new Set();
  p.sections.forEach((s, i) => {
    for (const k of ['x', 'y', 'z', 'chord', 'twist']) {
      if (!isNum(s[k])) errors.push(`Section ${i + 1}: ${k} must be a finite number.`);
    }
    if (isNum(s.chord) && s.chord < LIMITS.minChord) errors.push(`Section ${i + 1}: chord must be at least ${LIMITS.minChord} mm.`);
    if (isNum(s.y) && s.y < 0) errors.push(`Section ${i + 1}: y must be >= 0 (the half wing lies on the +y side).`);
    if (!ids.has(s.airfoil)) errors.push(`Section ${i + 1}: unknown airfoil "${s.airfoil}".`);
    // Sections without an id get "s<n>" on import; check the effective id.
    const id = s.id ?? `s${i + 1}`;
    if (typeof id !== 'string' || !id) errors.push(`Section ${i + 1}: id must be a non-empty string.`);
    else if (secIds.has(id)) errors.push(`Duplicate section id "${id}".`);
    secIds.add(id);
  });
  errors.push(...limitErrors(p));
  const ys = p.sections.map((s) => s.y).sort((a, b) => a - b);
  for (let i = 1; i < ys.length; i++) {
    if (!(ys[i] > ys[i - 1])) {
      errors.push('Section span positions y must be distinct.');
      break;
    }
  }
  // Nested settings must be objects when present (null means "use the default"); resolveSettings
  // would silently replace a string or number with the defaults.
  if (isObject(p.settings)) {
    for (const k of ['trailingEdge', 'tip']) {
      const v = p.settings[k];
      if (v !== undefined && v !== null && !isObject(v)) errors.push(`settings.${k} must be an object.`);
    }
  }
  const st = resolveSettings(p.settings);
  if (!['linear', 'smooth'].includes(st.spanwise)) errors.push('settings.spanwise must be "linear" or "smooth".');
  if (!['asis', 'closed', 'thickness'].includes(st.trailingEdge.mode)) errors.push('settings.trailingEdge.mode must be "asis", "closed" or "thickness".');
  if (!isNum(st.trailingEdge.thickness) || st.trailingEdge.thickness < 0) errors.push('settings.trailingEdge.thickness must be >= 0.');
  if (!['flat', 'pointed'].includes(st.tip.mode)) errors.push('settings.tip.mode must be "flat" or "pointed".');
  if (!isNum(st.tip.ratio) || st.tip.ratio < LIMITS.tipRatio[0] || st.tip.ratio > LIMITS.tipRatio[1]) {
    errors.push(`settings.tip.ratio must be within ${LIMITS.tipRatio.join('..')} (1/1000 to 1/100).`);
  }
  if (!isNum(st.twistPivot) || st.twistPivot < 0 || st.twistPivot > 1) errors.push('settings.twistPivot must be within 0..1.');
  if (!Number.isInteger(st.chordSamples) || st.chordSamples < LIMITS.chordSamples[0] || st.chordSamples > LIMITS.chordSamples[1]) {
    errors.push(`settings.chordSamples must be an integer within ${LIMITS.chordSamples.join('..')}.`);
  }
  if (!Number.isInteger(st.panelStations) || st.panelStations < LIMITS.panelStations[0] || st.panelStations > LIMITS.panelStations[1]) {
    errors.push(`settings.panelStations must be an integer within ${LIMITS.panelStations.join('..')}.`);
  }
  if (!['uniform', 'chord', 'centripetal'].includes(st.parametrization)) errors.push('settings.parametrization must be uniform, chord or centripetal.');
  if (typeof st.mirror !== 'boolean') errors.push('settings.mirror must be true or false.');
  if (p.guides) {
    for (const key of ['nose', 'end']) {
      const g = p.guides[key];
      if (g === undefined || g === null) continue;
      if (!isObject(g)) {
        errors.push(`guides.${key} must be an object.`);
        continue;
      }
      if (g.enabled !== undefined && typeof g.enabled !== 'boolean') errors.push(`guides.${key}.enabled must be true or false.`);
      if (g.edited !== undefined && typeof g.edited !== 'boolean') errors.push(`guides.${key}.edited must be true or false.`);
      if (!['fit', 'control'].includes(g.mode)) errors.push(`guides.${key}.mode must be "fit" or "control".`);
      if (!Array.isArray(g.points) || g.points.length < 2) errors.push(`guides.${key}.points needs at least 2 points.`);
      else if (g.points.length > LIMITS.maxGuidePoints) continue; // reported by limitErrors without visiting the points
      else if (!g.points.every((q) => Array.isArray(q) && isNum(q[0]) && isNum(q[1]))) errors.push(`guides.${key}.points must be numeric [x, y] pairs.`);
      if (g.degree !== undefined && (!Number.isInteger(g.degree) || g.degree < 1 || g.degree > 5)) errors.push(`guides.${key}.degree must be 1..5.`);
    }
  }
  return { ok: errors.length === 0, errors };
}
