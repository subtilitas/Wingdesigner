// Project data model, defaults and validation.
//
// Coordinates: x chordwise (positive towards the trailing edge), y spanwise (positive towards the
// right tip), z up. Units: millimetres. A section places a normalized airfoil with its leading edge
// at (x, y, z), scaled by `chord`, rotated by `twist` degrees (positive = leading edge up) about the
// chord point at `settings.twistPivot`. The half wing spans y >= 0 and is mirrored at the plane y = 0.

import { defaultGuides } from '../geom/guide.js';
import { SECTION_PLANES } from '../geom/planes.js';
import { MAX_NAME, MAX_POINTS } from '../airfoil/parse.js';
import { count, plain, tr, whole } from '../i18n/index.js';

export const FORMAT = 'wingdesigner-project';
// Version 2: settings.sectionPlanes and the stored folded tilt of an XFLR5 import (foldedTilt).
export const VERSION = 2;

/**
 * Spanwise interpolation: 'linear' blends every section value (leading edge, chord, z, twist, airfoil
 * shape) linearly and fits the loft to it; 'straight' joins the points of equal chord fraction of two
 * neighbouring sections with straight lines (a ruled surface, as XFLR5 builds its panels); 'smooth'
 * blends with a natural cubic spline through all sections.
 */
export const SPANWISE = Object.freeze(['linear', 'straight', 'smooth']);

export const DEFAULT_SETTINGS = Object.freeze({
  spanwise: 'linear',
  // Owner decision R2 (docs/Flow5upgrade.md): mitred for new projects; version 1 files open vertical.
  sectionPlanes: 'mitred',
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
  // Bounds that keep every computed coordinate finite.
  maxChord: 100_000,
  maxCoordinate: 1_000_000,
  maxTwist: 360,
  // A stored panel angle (section.panelAngle, degrees): a panel stays below 90°, as y is the span.
  maxPanelAngle: 89.9999,
  // Hard size limits: beyond them a desktop browser tab runs out of memory or a change takes about
  // a minute (measurements in RECORD.md). Sizes above the warning thresholds in budget.js work, with
  // a warning that names the expected time and memory.
  maxSections: 20_000,
  maxAirfoils: 10_000,
  // Points of all project airfoils together, and of one airfoil (the parser stops above it).
  maxAirfoilPoints: 1_000_000,
  maxPointsPerAirfoil: MAX_POINTS,
  // Disabled guide curves carry one point per section.
  maxGuidePoints: 20_000,
  // Loft grid: spanwise stations times profile points; above it the stations per panel go down.
  maxGridPoints: 5_000_000,
  // Mesh export triangles, both halves counted: 8.5 million wrote a 423 MB STL at 2.7 GB browser
  // memory; 20 million failed.
  maxExportTriangles: 10_000_000,
  // STEP control points in the file (both halves counted): 3.3 million wrote a 330 MB file in 8.4 s;
  // about 5.4 million exceed the 512 MB string limit of the browser; in between not measured.
  maxStepPoints: 3_000_000,
  // Guide x reaches the trailing edge of any valid section (x + chord), where disabled end lines lie.
  maxGuideCoordinate: 1_100_000,
  // Extent of the built geometry: every leading edge, trailing edge and z within this bound covers
  // an end line at its limit less the largest chord. Only interpolation overshoot goes beyond it.
  maxExtent: 1_200_000,
  tipRatio: [0.001, 0.01],
  chordSamples: [16, 200],
  panelStations: [3, 40],
  // Characters of the project name and airfoil names; lists and messages show the first 200.
  maxName: MAX_NAME,
  // Characters of airfoil and section ids (references inside the project file).
  maxId: 200,
  // Characters of each airfoil source text (attribution, license, URL, terms, note).
  maxText: 2000,
});

/** Airfoil source fields kept on import; other keys are dropped. */
export const SOURCE_KEYS = Object.freeze(['kind', 'id', 'file', 'attribution', 'license', 'url', 'terms', 'note', 'code', 'closedTE']);

let counter = 0;
export function newId(prefix) {
  counter += 1;
  return `${prefix}${Date.now().toString(36)}${counter.toString(36)}`;
}

export function cloneProject(p) {
  return structuredClone(p);
}

/** Merge settings with defaults (deep for trailingEdge and tip); keys without a default are dropped. */
export function resolveSettings(settings) {
  const s = isObject(settings) ? settings : {};
  const pick = (defaults, v) => Object.fromEntries(Object.keys(defaults).map((k) => [k, isObject(v) && k in v ? v[k] : defaults[k]]));
  return {
    ...pick(DEFAULT_SETTINGS, s),
    trailingEdge: pick(DEFAULT_SETTINGS.trailingEdge, s.trailingEdge),
    tip: pick(DEFAULT_SETTINGS.tip, s.tip),
  };
}

/** A text value for messages: at most 40 characters. */
const shown = (v) => {
  const t = String(v);
  return t.length > 40 ? `${t.slice(0, 40)}…` : t;
};

function isObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * Create a project from airfoils and sections; guides default to the section edges (disabled).
 */
export function createProject({ name = tr('Untitled wing'), airfoils, sections, guides, settings, foldedTilt } = {}) {
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
    ...(foldedTilt ? { foldedTilt: { angle: foldedTilt.angle, x: foldedTilt.x, z: foldedTilt.z } } : {}),
  };
}

/** Points of all project airfoils together (array lengths only). */
export function airfoilPoints(p) {
  let n = 0;
  for (const a of p.airfoils) if (Array.isArray(a?.points)) n += a.points.length;
  return n;
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
  if (sections.length > LIMITS.maxSections) return [tr('At most {max} sections are supported (found {found}).', { max: count(LIMITS.maxSections), found: count(sections.length) })];
  sections.forEach((s, i) => {
    if (!isObject(s)) return;
    if (isNum(s.chord) && s.chord > LIMITS.maxChord) errors.push(tr('Section {n}: chord must be at most {max} mm.', { n: plain(i + 1), max: whole(LIMITS.maxChord) }));
    for (const k of ['x', 'y', 'z']) {
      if (isNum(s[k]) && Math.abs(s[k]) > LIMITS.maxCoordinate) errors.push(tr('Section {n}: {axis} must be within ±{max} mm.', { n: plain(i + 1), axis: k, max: whole(LIMITS.maxCoordinate) }));
    }
    if (isNum(s.twist) && Math.abs(s.twist) > LIMITS.maxTwist) errors.push(tr('Section {n}: twist must be within ±{max} degrees.', { n: plain(i + 1), max: plain(LIMITS.maxTwist) }));
    if (isNum(s.panelAngle) && Math.abs(s.panelAngle) > LIMITS.maxPanelAngle) errors.push(tr('Section {n}: panelAngle must be within ±{max} degrees.', { n: plain(i + 1), max: plain(LIMITS.maxPanelAngle) }));
  });
  // The tilt angle an XFLR5 import folded into the sections, reduced by whole turns, and its pivot.
  const tilt = p?.foldedTilt;
  if (isObject(tilt)) {
    if (isNum(tilt.angle) && Math.abs(tilt.angle) > 180) errors.push(tr('foldedTilt.angle must be within ±180 degrees.'));
    for (const k of ['x', 'z']) {
      if (isNum(tilt[k]) && Math.abs(tilt[k]) > LIMITS.maxCoordinate) errors.push(tr('foldedTilt.{axis} must be within ±{max} mm.', { axis: k, max: whole(LIMITS.maxCoordinate) }));
    }
  }
  for (const key of ['nose', 'end']) {
    const g = isObject(p?.guides) ? p.guides[key] : null;
    if (!isObject(g) || !Array.isArray(g.points)) continue;
    if (g.points.length > LIMITS.maxGuidePoints) errors.push(tr('guides.{key}.points: at most {max} points (found {found}).', { key, max: count(LIMITS.maxGuidePoints), found: count(g.points.length) }));
    else if (g.points.some((q) => Array.isArray(q) && (Math.abs(q[0]) > LIMITS.maxGuideCoordinate || Math.abs(q[1]) > LIMITS.maxCoordinate))) {
      errors.push(tr('guides.{key}.points: x must be within ±{maxX} mm and y within ±{maxY} mm.', { key, maxX: whole(LIMITS.maxGuideCoordinate), maxY: whole(LIMITS.maxCoordinate) }));
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
  if (!p || typeof p !== 'object') return { ok: false, errors: [tr('Project is not an object.')] };
  if (p.format !== FORMAT) errors.push(tr('format must be "{format}".', { format: FORMAT }));
  if (p.units !== undefined && p.units !== 'mm') errors.push(tr('units must be "mm" (found "{found}").', { found: p.units }));
  if (p.settings !== undefined && !isObject(p.settings)) errors.push(tr('settings must be an object.'));
  if (p.guides !== undefined && p.guides !== null && !isObject(p.guides)) errors.push(tr('guides must be an object.'));
  if (!Number.isInteger(p.version) || p.version < 1 || p.version > VERSION) errors.push(tr('Unsupported project version {version}.', { version: p.version }));
  if (!Array.isArray(p.airfoils) || p.airfoils.length === 0) errors.push(tr('airfoils must be a non-empty array.'));
  else if (p.airfoils.length > LIMITS.maxAirfoils) errors.push(tr('At most {max} airfoils are supported (found {found}).', { max: count(LIMITS.maxAirfoils), found: count(p.airfoils.length) }));
  if (!Array.isArray(p.sections) || p.sections.length < 2) errors.push(tr('At least 2 sections are required.'));
  else if (p.sections.length > LIMITS.maxSections) errors.push(tr('At most {max} sections are supported (found {found}).', { max: count(LIMITS.maxSections), found: count(p.sections.length) }));
  if (!errors.length && !p.airfoils.every(isObject)) errors.push(tr('Every airfoil must be an object.'));
  if (!errors.length && airfoilPoints(p) > LIMITS.maxAirfoilPoints) {
    errors.push(tr('The airfoils hold {n} points together; the limit is {max}.', { n: count(airfoilPoints(p)), max: count(LIMITS.maxAirfoilPoints) }));
  }
  if (!errors.length && !p.sections.every(isObject)) errors.push(tr('Every section must be an object.'));
  if (errors.length) return { ok: false, errors };
  if (typeof p.name === 'string' && p.name.length > LIMITS.maxName) errors.push(tr('name has {n} characters; the limit is {max}.', { n: count(p.name.length), max: count(LIMITS.maxName) }));
  const ids = new Set();
  p.airfoils.forEach((a, i) => {
    // Ids and names are checked for length first: messages quote them.
    const n = plain(i + 1);
    if (typeof a.id !== 'string' || !a.id) errors.push(tr('Airfoil {n}: id must be a non-empty string.', { n }));
    else if (a.id.length > LIMITS.maxId) errors.push(tr('Airfoil {n}: id has {length} characters; the limit is {max}.', { n, length: whole(a.id.length), max: whole(LIMITS.maxId) }));
    else if (ids.has(a.id)) errors.push(tr('Duplicate airfoil id "{id}".', { id: a.id }));
    else ids.add(a.id);
    if (a.name !== undefined && typeof a.name !== 'string') errors.push(tr('Airfoil {n}: name must be a string.', { n }));
    else if (a.name?.length > LIMITS.maxName) errors.push(tr('Airfoil {n}: name has {length} characters; the limit is {max}.', { n, length: count(a.name.length), max: count(LIMITS.maxName) }));
    if (a.source !== undefined && a.source !== null) {
      if (!isObject(a.source)) errors.push(tr('Airfoil {n}: source must be an object.', { n }));
      else {
        for (const k of SOURCE_KEYS) {
          const v = a.source[k];
          if (v === undefined || v === null || typeof v === 'boolean') continue;
          if (typeof v !== 'string') errors.push(tr('Airfoil {n}: source.{key} must be a string.', { n, key: k }));
          else if (v.length > LIMITS.maxText) errors.push(tr('Airfoil {n}: source.{key} has {length} characters; the limit is {max}.', { n, key: k, length: whole(v.length), max: whole(LIMITS.maxText) }));
        }
      }
    }
    if (!Array.isArray(a.points) || a.points.length < 5) errors.push(tr('Airfoil {n} needs at least 5 numeric [x, y] points.', { n }));
    // The airfoil file limit applies to project files too.
    else if (a.points.length > LIMITS.maxPointsPerAirfoil) errors.push(tr('Airfoil {n} has {length} points; the limit is {max}.', { n, length: count(a.points.length), max: count(LIMITS.maxPointsPerAirfoil) }));
    else if (!a.points.every((q) => Array.isArray(q) && isNum(q[0]) && isNum(q[1]))) errors.push(tr('Airfoil {n} needs at least 5 numeric [x, y] points.', { n }));
  });
  const secIds = new Set();
  p.sections.forEach((s, i) => {
    const n = plain(i + 1);
    for (const k of ['x', 'y', 'z', 'chord', 'twist']) {
      // The message names x, y and z as they are, chord and twist as words.
      if (!isNum(s[k])) errors.push(tr('Section {n}: {field} must be a finite number.', { n, field: k === 'chord' ? tr('chord') : k === 'twist' ? tr('twist') : k }));
    }
    if (isNum(s.chord) && s.chord < LIMITS.minChord) errors.push(tr('Section {n}: chord must be at least {min} mm.', { n, min: plain(LIMITS.minChord) }));
    // The angle of the panel to the next section that the mitred planes use; absent or null: from y and z.
    if (s.panelAngle !== undefined && s.panelAngle !== null && !isNum(s.panelAngle)) errors.push(tr('Section {n}: panelAngle must be a finite number or null.', { n }));
    if (isNum(s.y) && s.y < 0) errors.push(tr('Section {n}: y must be >= 0 (the half wing lies on the +y side).', { n }));
    if (!ids.has(s.airfoil)) errors.push(tr('Section {n}: unknown airfoil "{id}".', { n, id: shown(s.airfoil) }));
    // Sections without an id get "s<n>" on import; check the effective id.
    const id = s.id ?? `s${i + 1}`;
    if (typeof id !== 'string' || !id) errors.push(tr('Section {n}: id must be a non-empty string.', { n }));
    else if (id.length > LIMITS.maxId) errors.push(tr('Section {n}: id has {length} characters; the limit is {max}.', { n, length: whole(id.length), max: whole(LIMITS.maxId) }));
    else if (secIds.has(id)) errors.push(tr('Duplicate section id "{id}".', { id }));
    secIds.add(id);
  });
  errors.push(...limitErrors(p));
  const ys = p.sections.map((s) => s.y).sort((a, b) => a - b);
  for (let i = 1; i < ys.length; i++) {
    if (!(ys[i] > ys[i - 1])) {
      errors.push(tr('Section span positions y must be distinct.'));
      break;
    }
  }
  // Nested settings must be objects when present (null means "use the default"); resolveSettings
  // would silently replace a string or number with the defaults.
  if (isObject(p.settings)) {
    for (const k of ['trailingEdge', 'tip']) {
      const v = p.settings[k];
      if (v !== undefined && v !== null && !isObject(v)) errors.push(tr('settings.{key} must be an object.', { key: k }));
    }
  }
  const st = resolveSettings(p.settings);
  if (!SPANWISE.includes(st.spanwise)) errors.push(tr('settings.spanwise must be "linear", "straight" or "smooth".'));
  if (!SECTION_PLANES.includes(st.sectionPlanes)) errors.push(tr('settings.sectionPlanes must be "vertical" or "mitred".'));
  if (p.foldedTilt !== undefined && p.foldedTilt !== null && !(isObject(p.foldedTilt) && isNum(p.foldedTilt.angle) && isNum(p.foldedTilt.x) && isNum(p.foldedTilt.z))) {
    errors.push(tr('foldedTilt must be an object with the numbers angle, x and z.'));
  }
  if (!['asis', 'closed', 'thickness'].includes(st.trailingEdge.mode)) errors.push(tr('settings.trailingEdge.mode must be "asis", "closed" or "thickness".'));
  if (!isNum(st.trailingEdge.thickness) || st.trailingEdge.thickness < 0) errors.push(tr('settings.trailingEdge.thickness must be >= 0.'));
  if (!['flat', 'pointed'].includes(st.tip.mode)) errors.push(tr('settings.tip.mode must be "flat" or "pointed".'));
  if (!isNum(st.tip.ratio) || st.tip.ratio < LIMITS.tipRatio[0] || st.tip.ratio > LIMITS.tipRatio[1]) {
    errors.push(tr('settings.tip.ratio must be within {range} (1/1000 to 1/100).', { range: LIMITS.tipRatio.map(plain).join('..') }));
  }
  if (!isNum(st.twistPivot) || st.twistPivot < 0 || st.twistPivot > 1) errors.push(tr('settings.twistPivot must be within 0..1.'));
  if (!Number.isInteger(st.chordSamples) || st.chordSamples < LIMITS.chordSamples[0] || st.chordSamples > LIMITS.chordSamples[1]) {
    errors.push(tr('settings.chordSamples must be an integer within {range}.', { range: LIMITS.chordSamples.map(plain).join('..') }));
  }
  if (!Number.isInteger(st.panelStations) || st.panelStations < LIMITS.panelStations[0] || st.panelStations > LIMITS.panelStations[1]) {
    errors.push(tr('settings.panelStations must be an integer within {range}.', { range: LIMITS.panelStations.map(plain).join('..') }));
  }
  if (!['uniform', 'chord', 'centripetal'].includes(st.parametrization)) errors.push(tr('settings.parametrization must be uniform, chord or centripetal.'));
  if (typeof st.mirror !== 'boolean') errors.push(tr('settings.mirror must be true or false.'));
  if (p.guides) {
    for (const key of ['nose', 'end']) {
      const g = p.guides[key];
      if (g === undefined || g === null) continue;
      if (!isObject(g)) {
        errors.push(tr('guides.{key} must be an object.', { key }));
        continue;
      }
      if (g.enabled !== undefined && typeof g.enabled !== 'boolean') errors.push(tr('guides.{key}.enabled must be true or false.', { key }));
      if (g.edited !== undefined && typeof g.edited !== 'boolean') errors.push(tr('guides.{key}.edited must be true or false.', { key }));
      if (!['fit', 'control'].includes(g.mode)) errors.push(tr('guides.{key}.mode must be "fit" or "control".', { key }));
      if (!Array.isArray(g.points) || g.points.length < 2) errors.push(tr('guides.{key}.points needs at least 2 points.', { key }));
      else if (g.points.length > LIMITS.maxGuidePoints) continue; // reported by limitErrors without visiting the points
      else if (!g.points.every((q) => Array.isArray(q) && isNum(q[0]) && isNum(q[1]))) errors.push(tr('guides.{key}.points must be numeric [x, y] pairs.', { key }));
      if (g.degree !== undefined && (!Number.isInteger(g.degree) || g.degree < 1 || g.degree > 5)) errors.push(tr('guides.{key}.degree must be 1..5.', { key }));
    }
  }
  return { ok: errors.length === 0, errors };
}
