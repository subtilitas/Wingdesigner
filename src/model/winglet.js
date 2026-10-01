// Integral winglet: sections appended beyond the wing tip that turn the reference line (the leading
// edges in y and z) up or down along a circular blend arc and run on straight to the winglet tip. The
// winglet is ordinary sections afterwards: the loft, the mitred section planes and the exports treat
// it as any other panel.
//
// Parameters (lengths in mm, angles in degrees):
//   height    length of the winglet along its reference line, from the wing tip to the winglet tip
//             (blend arc plus straight part)
//   cant      angle of the straight part from the y axis: 0 = in the wing plane, positive = up,
//             negative = down; at most ±89°, because y stays the span parameter of the loft
//   radius    radius of the blend arc in the y-z plane; 0 gives a kink at the wing tip
//   sweep     leading-edge sweep along the winglet: x grows by tan(sweep) per mm of reference line
//   tipChord  chord of the winglet tip in % of the wing tip chord; the chord changes linearly along
//             the reference line
//   toe       twist added at the winglet tip, linear along the reference line (positive = leading
//             edge up in the section plane)
//   airfoil   airfoil id of the winglet tip section; the arc sections keep the wing tip airfoil
//
// The arc starts tangent to the last panel (its stored panel angle, else the dihedral of the two
// outermost sections) and turns to the cant angle in steps of at most WINGLET_STEP; every step ends in
// a section, and one more section ends the straight part. An arc section less than SHORT_PANEL in y
// from its neighbours is left out.

import { plain, tr, whole } from '../i18n/index.js';
import { LIMITS, newId } from './project.js';
import { resetDisabledGuides, sortedSections, syncGuidesToSpan } from './edit.js';
import { SHORT_PANEL, storesPanelAngle } from '../geom/planes.js';

const DEG = Math.PI / 180;

/** Largest turn of the reference line between two sections of the blend arc (degrees). */
export const WINGLET_STEP = 15;

/** Ranges of the winglet parameters. */
export const WINGLET_RANGES = Object.freeze({
  height: Object.freeze([5, 100000]),
  cant: Object.freeze([-89, 89]),
  radius: Object.freeze([0, 100000]),
  sweep: Object.freeze([-60, 80]),
  tipChord: Object.freeze([5, 200]),
  toe: Object.freeze([-15, 15]),
});

const r2 = (v) => Math.round(v * 100) / 100;

/** The two outermost sections and the angle (degrees) of the last panel. */
function wingTip(project) {
  const sorted = sortedSections(project);
  const tip = sorted[sorted.length - 1];
  const prev = sorted[sorted.length - 2];
  const angle = storesPanelAngle(prev) ? prev.panelAngle : Math.atan2(tip.z - prev.z, tip.y - prev.y) / DEG;
  return { tip, prev, angle };
}

/**
 * Starting values for a project: 75° up, a height of a tenth of the half span and at least the wing
 * tip chord, a blend radius of 0.3 tip chords (an airfoil up to about 25 % thick on the inner side of
 * the arc would fold the surface on a tighter radius), 30° sweep, 60 % tip chord, no toe, the wing
 * tip airfoil.
 */
export function defaultWinglet(project) {
  const { tip } = wingTip(project);
  const root = sortedSections(project)[0];
  const height = Math.max(WINGLET_RANGES.height[0], Math.round((tip.y - root.y) / 10), Math.round(tip.chord));
  return { height, cant: 75, radius: Math.max(1, Math.round(0.3 * tip.chord)), sweep: 30, tipChord: 60, toe: 0, airfoil: tip.airfoil };
}

/** Sections of the winglet (without ids), from the wing tip outward. Assumes valid parameters. */
export function wingletSections(project, params) {
  const { tip, angle } = wingTip(project);
  const { height, cant, radius, sweep, toe } = params;
  const turn = cant - angle;
  const steps = radius > 0 ? Math.ceil(Math.abs(turn) / WINGLET_STEP - 1e-9) : 0;
  const arc = radius > 0 ? radius * Math.abs(turn) * DEG : 0;
  const sign = Math.sign(turn);
  const cw = (params.tipChord / 100) * tip.chord;
  // A point at length s along the reference line: chord, twist and leading-edge x follow s.
  const at = (s, y, z, airfoil) => ({
    airfoil,
    x: r2(tip.x + s * Math.tan(sweep * DEG)),
    y: r2(y),
    z: r2(z),
    chord: r2(tip.chord + ((cw - tip.chord) * s) / height),
    twist: r2(tip.twist + (toe * s) / height),
  });
  const out = [];
  let [y, z] = [tip.y, tip.z];
  for (let k = 1; k <= steps; k++) {
    const b = (angle + (turn * k) / steps) * DEG;
    y = tip.y + sign * radius * (Math.sin(b) - Math.sin(angle * DEG));
    z = tip.z + sign * radius * (Math.cos(angle * DEG) - Math.cos(b));
    out.push(at((arc * k) / steps, y, z, tip.airfoil));
  }
  const rest = height - arc;
  const end = at(height, y + rest * Math.cos(cant * DEG), z + rest * Math.sin(cant * DEG), params.airfoil);
  // An arc section less than SHORT_PANEL beyond the one before in y (near ±90°, or a small turn) is
  // left out: the planes would merge it with its neighbour anyway.
  const kept = [];
  let last = tip.y;
  for (const q of out) {
    if (q.y - last >= SHORT_PANEL && end.y - q.y >= SHORT_PANEL) {
      kept.push(q);
      last = q.y;
    }
  }
  kept.push(end);
  return kept;
}

/** Why the winglet cannot be added to the project; empty when it can. */
export function wingletProblems(project, params) {
  const out = [];
  const names = {
    height: () => tr('height'),
    cant: () => tr('cant angle'),
    radius: () => tr('blend radius'),
    sweep: () => tr('leading-edge sweep'),
    tipChord: () => tr('tip chord'),
    toe: () => tr('toe'),
  };
  for (const [k, [lo, hi]] of Object.entries(WINGLET_RANGES)) {
    const v = params[k];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < lo || v > hi) out.push(tr('Winglet: {param} must be between {min} and {max}.', { param: names[k](), min: plain(lo), max: plain(hi) }));
  }
  if (!project.airfoils.some((a) => a.id === params.airfoil)) out.push(tr('Winglet: choose an airfoil of the project.'));
  if (project.guides?.nose?.enabled || project.guides?.end?.enabled) out.push(tr('Switch the guide curves off first: they hold x as a function of y and would stretch over the winglet.'));
  if (project.settings.tip?.mode === 'pointed') out.push(tr('The wing ends in a point (Settings > Wing tip = Pointed): a winglet needs a flat tip.'));
  if (project.settings.sectionPlanes !== 'mitred' || project.settings.spanwise === 'smooth') {
    out.push(tr('A winglet needs Settings > Section planes = Mitred and a spanwise interpolation other than Smooth: vertical section planes make it cos(cant) as thick, 0.26 times at 75°.'));
  }
  if (out.length) return out;
  const { angle } = wingTip(project);
  const arc = params.radius * Math.abs(params.cant - angle) * DEG;
  if (arc >= params.height) {
    out.push(tr('Winglet: the blend arc is {arc} mm long, not shorter than the height; reduce the blend radius or increase the height.', { arc: plain(r2(arc)) }));
    return out;
  }
  const added = wingletSections(project, params);
  if (project.sections.length + added.length > LIMITS.maxSections) out.push(tr('At most {max} sections.', { max: whole(LIMITS.maxSections) }));
  const { tip } = wingTip(project);
  let y = tip.y;
  added.forEach((q, i) => {
    if (q.y - y < SHORT_PANEL) {
      out.push(tr('Winglet panel {n} spans {dy} mm in y, less than {min} mm; reduce the cant angle or increase the blend radius or the height.', { n: i + 1, dy: plain(r2(q.y - y)), min: plain(SHORT_PANEL) }));
    }
    y = q.y;
    if ([q.x, q.y, q.z].some((v) => Math.abs(v) > LIMITS.maxCoordinate)) out.push(tr('Winglet section {n} lies beyond ±{max} mm.', { n: i + 1, max: whole(LIMITS.maxCoordinate) }));
    if (q.chord < LIMITS.minChord) out.push(tr('Winglet section {n}: the chord is below {min} mm.', { n: i + 1, min: plain(LIMITS.minChord) }));
  });
  return out;
}

/**
 * Append the winglet sections to the project (in place). Returns the new sections, or null when
 * wingletProblems reports a reason.
 */
export function addWinglet(project, params) {
  if (wingletProblems(project, params).length) return null;
  const added = wingletSections(project, params).map((q) => ({ id: newId('s'), ...q }));
  project.sections.push(...added);
  project.sections.sort((a, b) => a.y - b.y);
  resetDisabledGuides(project);
  syncGuidesToSpan(project);
  return added;
}
