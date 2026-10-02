// Project JSON export and import. The export holds the full project (airfoil coordinates,
// sections, guide definitions, settings) plus the derived NURBS data: every profile curve,
// both guide curves, the spanwise stations and the wing surface. Import reads the project part
// and recomputes everything derived.

import { defaultGuides } from '../geom/guide.js';
import { fixed, plain, tr, whole } from '../i18n/index.js';
import { syncGuidesToSpan } from './edit.js';
import { FORMAT, LIMITS, SOURCE_KEYS, VERSION, fileVersion, resolveSettings, validateProject } from './project.js';

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
    version: fileVersion(project.settings),
    generator: { name: 'Wingdesigner', version: meta.generatorVersion ?? '0.0.0' },
    exportedAt: meta.exportedAt ?? new Date().toISOString(),
    name: project.name,
    units: 'mm',
    coordinateSystem: 'x chordwise towards the trailing edge, y spanwise towards the right tip, z up; mirror plane y = 0',
    airfoils: structuredClone(project.airfoils),
    sections: structuredClone(project.sections),
    guides: structuredClone(project.guides),
    settings: resolveSettings(structuredClone(project.settings)),
    ...(project.foldedTilt ? { foldedTilt: structuredClone(project.foldedTilt) } : {}),
    ...(project.foldedTiltUnknown ? { foldedTiltUnknown: true } : {}),
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
      stations: build.stations.map((s) => ({ y: s.y, v: s.v, xLE: s.xLE, z: s.z, chord: s.chord, twist: s.twist, roll: s.roll, stretch: s.stretch })),
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
  let n = 8 * build.stations.length + curve(build.guides.nose) + curve(build.guides.end);
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
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

const samePoints = (a, b) => a.length === b.length && a.every((p, i) => Math.abs(p[0] - b[i][0]) <= 1e-9 && Math.abs(p[1] - b[i][1]) <= 1e-9);

const DEG = Math.PI / 180;

/**
 * Upgrade of a folded tilt (version 2 files of the XFLR5 import): the tilt angle that the import
 * folded into the sections becomes the rigid tilt of the part (settings.partTilt about the stored
 * pivot). Each section's twist pivot point (x + p · c, z; p: Settings > Twist pivot, c: the chord the
 * build uses, the scaled tip chord of a pointed tip) turns back about the pivot by the angle, and
 * the angle leaves every twist. A project with an enabled guide curve, or a disabled one with edited
 * points, keeps its folded sections (the guides hold x only, as a function of y), and so does one
 * whose twist would leave ±LIMITS.maxTwist. Changes `project` in place; returns the notes for the
 * user (empty without a folded tilt).
 */
export function upgradeFoldedTilt(project) {
  const tilt = project.foldedTilt;
  if (!isObject(tilt) || !isNum(tilt.angle) || tilt.angle === 0) return [];
  const angle = plain(Number(tilt.angle.toFixed(4)) + 0);
  const guides = ['nose', 'end'].some((k) => project.guides?.[k]?.enabled || project.guides?.[k]?.edited);
  if (guides) return [tr('The tilt angle of {angle}° of the XFLR5 import stays folded into the sections: a guide curve is on or edited, and guide curves hold x only.', { angle })];
  if (project.sections.some((s) => Math.abs(s.twist - tilt.angle) > LIMITS.maxTwist)) {
    return [tr('The tilt angle of {angle}° of the XFLR5 import stays folded into the sections: without it a twist would lie beyond ±{max}°.', { angle, max: plain(LIMITS.maxTwist) })];
  }
  const st = project.settings;
  const p = st.twistPivot;
  const c = Math.cos(tilt.angle * DEG);
  const s = Math.sin(tilt.angle * DEG);
  const sorted = project.sections.slice().sort((a, b) => a.y - b.y);
  const tip = sorted[sorted.length - 1];
  // The chord the build uses at the tip of a pointed wing: tip.ratio of the previous section, at least minChord.
  const tipChord = st.tip.mode === 'pointed' && sorted.length > 1 ? Math.max(st.tip.ratio * sorted[sorted.length - 2].chord, LIMITS.minChord) : null;
  const unfolded = project.sections.map((q) => {
    const chord = q === tip && tipChord !== null ? tipChord : q.chord;
    const px = q.x + p * chord - tilt.x;
    const pz = q.z - tilt.z;
    // Inverse of the fold x' = x cos t + z sin t, z' = −x sin t + z cos t.
    return { x: px * c - pz * s + tilt.x - p * chord, z: px * s + pz * c + tilt.z };
  });
  // Folded sections near the coordinate limit can lie beyond it unfolded (x = z = 999,000 mm and 45°
  // give z = 1,412,800 mm); the project then keeps its fold and opens as before.
  if (unfolded.some((u) => Math.abs(u.x) > LIMITS.maxCoordinate || Math.abs(u.z) > LIMITS.maxCoordinate)) {
    return [tr('The tilt angle of {angle}° of the XFLR5 import stays folded into the sections: without it a section would lie beyond ±{max} mm.', { angle, max: whole(LIMITS.maxCoordinate) })];
  }
  project.sections.forEach((q, i) => {
    q.x = unfolded[i].x;
    q.z = unfolded[i].z;
    q.twist -= tilt.angle;
  });
  project.settings = { ...st, partTilt: tilt.angle, partRoll: 0, partPivot: { x: tilt.x, y: 0, z: tilt.z } };
  delete project.foldedTilt;
  const notes = [tr('The tilt angle of {angle}° that the XFLR5 import folded into the sections is a rigid tilt of the whole part (Settings > Part tilt); the sections hold the values of the untilted part.', { angle })];
  if (st.sectionPlanes === 'mitred') notes.push(tr('With mitred section planes the shape changes: the folded tilt was exact for vertical planes only, the rigid tilt places the part as XFLR5 does.'));
  return notes;
}

/**
 * Parse and validate project JSON text. Derived data is ignored. A version 2 file with a folded
 * tilt is upgraded (upgradeFoldedTilt); `notes` names what the upgrade did.
 * @returns {{ok: boolean, project?: object, errors: string[], notes?: string[]}}
 */
export function projectFromJsonText(text) {
  if (String(text).length > MAX_PROJECT_BYTES) return { ok: false, errors: [tr('The file is larger than {max} MB.', { max: plain(MAX_PROJECT_BYTES / 1e6) })] };
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return { ok: false, errors: [tr('Invalid JSON: {message}', { message: e.message })] };
  }
  // The part placement belongs to version 3 and foldedTilt to version 2: in an older file these keys
  // are unknown and dropped, as an app of that version drops them; only the upgrade of the folded tilt
  // of a version 2 file sets a tilt there.
  if (isObject(data) && typeof data.version === 'number' && data.version < 3) {
    data = { ...data };
    if (isObject(data.settings)) {
      data.settings = { ...data.settings };
      for (const k of ['partTilt', 'partRoll', 'partPivot']) delete data.settings[k];
    }
    if (data.version < 2) delete data.foldedTilt;
  }
  // settings.leftHalf came with version 4: an older file's key is unknown and dropped.
  if (isObject(data) && typeof data.version === 'number' && data.version < 4 && isObject(data.settings) && 'leftHalf' in data.settings) {
    data = { ...data, settings: { ...data.settings } };
    delete data.settings.leftHalf;
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
    sections: data.sections.map((s, i) => ({ id: s.id ?? `s${i + 1}`, airfoil: s.airfoil, x: s.x, y: s.y, z: s.z, chord: s.chord, twist: s.twist, ...(isNum(s.panelAngle) ? { panelAngle: s.panelAngle } : {}) })),
    // Version 1 files predate section planes: they open with vertical planes (owner decision R2,
    // docs/Flow5upgrade.md), set before the defaults fill the missing settings.
    settings: resolveSettings(data.version < 2 ? { ...(isObject(data.settings) ? data.settings : {}), sectionPlanes: 'vertical' } : data.settings),
    ...(isObject(data.foldedTilt) ? { foldedTilt: { angle: data.foldedTilt.angle, x: data.foldedTilt.x, z: data.foldedTilt.z } } : {}),
    // The XFLR5 import of format version 1 folded a tilt angle into the sections without storing it, and
    // a version 1 file holds no mark of that import (an XML import has no airfoil of the file, and its
    // settings can be edited): every version 1 file is marked, so that Checks warns with mitred planes,
    // also after the project is saved again.
    ...(data.foldedTiltUnknown === true || data.version === 1 ? { foldedTiltUnknown: true } : {}),
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
  const notes = data.version < 3 ? upgradeFoldedTilt(project) : [];
  // The XFLR5 import of format version 1 folded a tilt angle into the sections without storing it:
  // exact with the vertical planes the file opens with, not with mitred planes.
  if (data.version === 1 && project.foldedTiltUnknown) {
    notes.push(tr('This project of format version 1 may come from the XFLR5 import: a tilt angle of the wing may be folded into the section values, which is exact for vertical section planes only. With Settings > Section planes Mitred the part can lie up to 0.75 · chord · sin(tilt angle) · sin(roll) off XFLR5\'s. Importing the XFLR5 file again gives the rigid tilt (Settings > Part tilt).'));
  }
  // An upgraded project must still pass the limits (the turned sections stay within ±LIMITS.maxCoordinate).
  if (notes.length && !validateProject(project).ok) return { ok: false, errors: validateProject(project).errors };
  return { ok: true, project, errors: [], notes };
}
