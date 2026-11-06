// Rounded wing tip: sections appended beyond a flat wing tip whose chord follows a quarter ellipse and
// ends in a point (Settings > Wing tip = Pointed). The sections are ordinary sections afterwards: the
// loft, the section planes and the exports treat them as any other panel.
//
// Parameters (lengths in mm):
//   length    length of the rounded tip along the last panel, from the tip section to the point
//   line      chord position of the straight line in % of the chord from the leading edge: the
//             points at this chord position of every rounded-tip section lie on the line of the
//             last panel through that chord position; the leading edge and the trailing edge
//             curve towards it and meet on it. 0 = straight leading edge, 100 = straight trailing edge.
//   sections  number of added sections, the point included
//
// Section k = 1 … m (m = sections) lies at t = sin(π k / (2 m)) of the length, closer together
// towards the point, with the chord c_T · cos(π k / (2 m)) = c_T · sqrt(1 − t²) (c_T: chord of the
// tip section). The point (k = m) takes the chord of a pointed tip: tip.ratio of the chord before, at
// least LIMITS.minChord. Airfoil and twist stay those of the tip section; the reference points run
// on along the last panel in y and z.

import { plain, tr, whole } from '../i18n/index.js';
import { LIMITS, newId } from './project.js';
import { resetDisabledGuides, sortedSections, syncGuidesToSpan } from './edit.js';
import { SHORT_PANEL, storesPanelAngle } from '../geom/planes.js';

const DEG = Math.PI / 180;

/** Ranges of the rounded-tip parameters. */
export const ROUND_TIP_RANGES = Object.freeze({
  length: Object.freeze([5, 100000]),
  line: Object.freeze([0, 100]),
  sections: Object.freeze([2, 24]),
});

const r2 = (v) => Math.round(v * 100) / 100;

/** The two outermost sections and the angle (degrees) and chord-line slope dx/dy of the last panel. */
function lastPanel(project, line) {
  const sorted = sortedSections(project);
  const tip = sorted[sorted.length - 1];
  const prev = sorted[sorted.length - 2];
  const angle = storesPanelAngle(prev) ? prev.panelAngle : Math.atan2(tip.z - prev.z, tip.y - prev.y) / DEG;
  const f = line / 100;
  const dy = tip.y - prev.y;
  const slope = dy > 0 ? (tip.x + f * tip.chord - (prev.x + f * prev.chord)) / dy : 0;
  return { tip, prev, angle, slope };
}

/** Starting values: one tip chord long, straight line at 25 % of the chord, 6 sections. */
export function defaultRoundTip(project) {
  const tip = sortedSections(project).at(-1);
  return { length: Math.max(ROUND_TIP_RANGES.length[0], Math.round(tip.chord)), line: 25, sections: 6 };
}

/** Sections of the rounded tip (without ids), from the tip section outward. Assumes valid parameters. */
export function roundTipSections(project, params) {
  const { tip, angle, slope } = lastPanel(project, params.line);
  const m = params.sections;
  const f = params.line / 100;
  const ratio = project.settings.tip?.ratio ?? 0.005;
  const dy = params.length * Math.cos(angle * DEG);
  const dz = params.length * Math.sin(angle * DEG);
  const xLine = tip.x + f * tip.chord;
  const out = [];
  for (let k = 1; k <= m; k++) {
    const t = k === m ? 1 : Math.sin((Math.PI * k) / (2 * m));
    const chord = k === m ? Math.max(ratio * out.at(-1).chord, LIMITS.minChord) : tip.chord * Math.cos((Math.PI * k) / (2 * m));
    const q = { airfoil: tip.airfoil, x: r2(xLine + t * dy * slope - f * chord), y: r2(tip.y + t * dy), z: r2(tip.z + t * dz), chord: r2(chord), twist: tip.twist };
    out.push(q);
  }
  return out;
}

/** Why the rounded tip cannot be added to the project; empty when it can. */
export function roundTipProblems(project, params) {
  const out = [];
  const names = { length: () => tr('length'), line: () => tr('straight line'), sections: () => tr('number of sections') };
  for (const [k, [lo, hi]] of Object.entries(ROUND_TIP_RANGES)) {
    const v = params[k];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < lo || v > hi) out.push(tr('Rounded tip: {param} must be between {min} and {max}.', { param: names[k](), min: plain(lo), max: plain(hi) }));
  }
  if (Number.isFinite(params.sections) && !Number.isInteger(params.sections)) out.push(tr('Rounded tip: the number of sections must be a whole number.'));
  if (project.guides?.nose?.enabled || project.guides?.end?.enabled) out.push(tr('Switch the guide curves off first: they hold x as a function of y and would stretch over the rounded tip.'));
  if (project.settings.tip?.mode === 'pointed') out.push(tr('The wing already ends in a point (Settings > Wing tip = Pointed): a rounded tip needs a flat tip.'));
  if (out.length) return out;
  const { tip } = lastPanel(project, params.line);
  // The last section before the point keeps cos(π (m − 1) / (2 m)) of the tip chord.
  const need = LIMITS.minChord / Math.cos((Math.PI * (params.sections - 1)) / (2 * params.sections));
  if (tip.chord < need) {
    out.push(tr('Rounded tip: with {n} sections the tip chord must be at least {min} mm; use fewer sections.', { n: params.sections, min: plain(Math.ceil(need * 100) / 100) }));
    return out;
  }
  const added = roundTipSections(project, params);
  if (project.sections.length + added.length > LIMITS.maxSections) out.push(tr('At most {max} sections.', { max: whole(LIMITS.maxSections) }));
  let y = tip.y;
  added.forEach((q, i) => {
    if (q.y - y < SHORT_PANEL) {
      out.push(tr('Rounded-tip panel {n} spans {dy} mm in y, less than {min} mm; increase the length or use fewer sections.', { n: i + 1, dy: plain(r2(q.y - y)), min: plain(SHORT_PANEL) }));
    }
    y = q.y;
    if ([q.x, q.y, q.z].some((v) => Math.abs(v) > LIMITS.maxCoordinate)) out.push(tr('Rounded-tip section {n} lies beyond ±{max} mm.', { n: i + 1, max: whole(LIMITS.maxCoordinate) }));
  });
  return out;
}

/**
 * Append the rounded-tip sections to the project (in place) and set the wing tip to Pointed. Returns
 * the new sections, or null when roundTipProblems reports a reason.
 */
export function addRoundTip(project, params) {
  if (roundTipProblems(project, params).length) return null;
  const { tip, prev } = lastPanel(project, params.line);
  const added = roundTipSections(project, params).map((q) => ({ id: newId('s'), ...q }));
  // The added panels run on along the last panel: a stored angle of the last panel holds for them
  // too, so that the rounding of y and z to 0.01 mm does not tilt their section planes.
  if (storesPanelAngle(prev)) {
    tip.panelAngle = prev.panelAngle;
    for (const q of added.slice(0, -1)) q.panelAngle = prev.panelAngle;
  } else {
    delete tip.panelAngle;
  }
  project.sections.push(...added);
  project.sections.sort((a, b) => a.y - b.y);
  project.settings.tip = { ...project.settings.tip, mode: 'pointed' };
  resetDisabledGuides(project);
  syncGuidesToSpan(project);
  return added;
}
