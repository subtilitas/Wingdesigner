// Rounded wing tip: sections appended beyond a flat wing tip whose chord follows a superellipse and
// ends in a point (Settings > Wing tip = Pointed). The sections carry the marker roundTip ('tangent'
// or 'corner'), with which the loft blends them in the angle of the tip ellipse instead of in y
// (src/geom/tipblend.js), so that the outline stays smooth with Linear and with Smooth. Otherwise they
// are ordinary sections: editable, and written to every export like any other.
//
// Parameters (lengths in mm):
//   length    length of the rounded tip along the last panel, from the tip section to the point
//   line      chord position of the straight line in % of the chord from the leading edge: the
//             points at this chord position of every rounded-tip section lie on the line of the
//             last panel through that chord position; the leading edge and the trailing edge
//             curve towards it and meet on it. 0 = straight leading edge, 100 = straight trailing edge.
//   sections  number of added sections, the point included
//   tangent   true: the chord starts with the taper of the last panel, so that leading and trailing
//             edge run on tangent to the last panel at the tip section; false: the chord starts with
//             slope 0, which leaves a corner in the planform where the last panel tapers
//   fullness  exponent n of the superellipse, 2 to 3: 2 is the quarter ellipse, a larger n keeps the
//             chord fuller towards the point and closes it in a shorter, blunter turn
//
// Section k = 1 … m (m = sections) lies at t = sin(π k / (2 m)) of the length, closer together
// towards the point, with the chord c_T · (1 − t^n)^(1/n) · (1 + κ t) (c_T: chord of the tip section).
// κ = 0 without tangent; with tangent κ = (dc/dy of the wing at the tip section) · (length in y) / c_T,
// which gives the chord that slope at the tip section (lastPanel: the secant of the last panel with
// Linear, the shape-preserving cubic with Smooth). The factor stays positive up to the point only for
// κ > −1: a wing that would taper to zero chord within the length is refused. The point (k = m)
// takes the chord of a pointed tip: tip.ratio of the chord before, at least LIMITS.minChord. Airfoil
// and twist stay those of the tip section; the reference points run on along the last panel in y and z.

import { plain, tr, whole } from '../i18n/index.js';
import { LIMITS, newId } from './project.js';
import { resetDisabledGuides, sortedSections, syncGuidesToSpan } from './edit.js';
import { SHORT_PANEL, storesPanelAngle } from '../geom/planes.js';
import { spanwiseBlender } from '../geom/spanwise.js';

const DEG = Math.PI / 180;

/** Ranges of the rounded-tip parameters. */
export const ROUND_TIP_RANGES = Object.freeze({
  length: Object.freeze([5, 100000]),
  line: Object.freeze([0, 100]),
  sections: Object.freeze([2, 24]),
  fullness: Object.freeze([2, 3]),
});

/**
 * Share of the tip chord at t (0 … 1) of the length for fullness n: the superellipse
 * (1 − t^n)^(1/n); n = 2 is the quarter ellipse, a larger n keeps the chord fuller towards the point.
 */
export const fullnessShape = (t, n) => Math.pow(Math.max(0, 1 - Math.pow(t, n)), 1 / n);

/** κ ≤ −1 + KAPPA_MARGIN is refused: the chord would fall to zero before the point. */
const KAPPA_MARGIN = 0.05;

const r2 = (v) => Math.round(v * 100) / 100;

/**
 * The two outermost sections, the angle (degrees) of the last panel, and the slopes dx/dy of the
 * chord-line point and dc/dy of the chord at the tip section: those of the blend the loft uses inboard
 * of a rounded tip (src/geom/tipblend.js), the secant of the last panel with Linear, the slope of the
 * shape-preserving cubic with Smooth, so that the rounded tip leaves the tip section along the wing.
 */
function lastPanel(project, line) {
  const sorted = sortedSections(project);
  const tip = sorted[sorted.length - 1];
  const prev = sorted[sorted.length - 2];
  const angle = storesPanelAngle(prev) ? prev.panelAngle : Math.atan2(tip.z - prev.z, tip.y - prev.y) / DEG;
  const f = line / 100;
  const dy = tip.y - prev.y;
  let slope = dy > 0 ? (tip.x + f * tip.chord - (prev.x + f * prev.chord)) / dy : 0;
  let taper = dy > 0 ? (tip.chord - prev.chord) / dy : 0;
  if (project.settings.spanwise === 'smooth' && sorted.length >= 3 && dy > 0) {
    const [[dx, dc]] = spanwiseBlender(
      sorted.map((s) => s.y),
      'smooth',
      sorted.map((s) => [[s.x, s.chord]]),
    ).derivative(tip.y);
    slope = dx + f * dc;
    taper = dc;
  }
  return { tip, prev, angle, slope, taper };
}

/** κ of the chord factor 1 + κ t (see the header); 0 without tangent. */
export function roundTipKappa(project, params) {
  if (!params.tangent) return 0;
  const { tip, angle, taper } = lastPanel(project, params.line);
  return (taper * params.length * Math.cos(angle * DEG)) / tip.chord;
}

/**
 * Starting values: one tip chord long, straight line at 25 % of the chord, 6 sections, tangent. A last
 * panel that tapers to zero chord within two tip chords shortens the length to half that distance
 * (κ = −0.5), so that the tangent tip keeps a rounded outline.
 */
export function defaultRoundTip(project) {
  const { tip, taper, angle } = lastPanel(project, 25);
  let length = tip.chord;
  if (taper < 0) length = Math.min(length, tip.chord / (-2 * taper * Math.cos(angle * DEG)));
  return { length: Math.max(ROUND_TIP_RANGES.length[0], Math.round(length)), line: 25, sections: 6, tangent: true, fullness: 2.5 };
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
  const kappa = roundTipKappa(project, params);
  const out = [];
  for (let k = 1; k <= m; k++) {
    const t = k === m ? 1 : Math.sin((Math.PI * k) / (2 * m));
    const chord = k === m ? Math.max(ratio * out.at(-1).chord, LIMITS.minChord) : tip.chord * fullnessShape(t, params.fullness) * (1 + kappa * t);
    const q = { airfoil: tip.airfoil, x: r2(xLine + t * dy * slope - f * chord), y: r2(tip.y + t * dy), z: r2(tip.z + t * dz), chord: r2(chord), twist: tip.twist };
    out.push(q);
  }
  return out;
}

/** Why the rounded tip cannot be added to the project; empty when it can. */
export function roundTipProblems(project, params) {
  const out = [];
  const names = { length: () => tr('length'), line: () => tr('straight line'), sections: () => tr('number of sections'), fullness: () => tr('fullness') };
  for (const [k, [lo, hi]] of Object.entries(ROUND_TIP_RANGES)) {
    const v = params[k];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < lo || v > hi) out.push(tr('Rounded tip: {param} must be between {min} and {max}.', { param: names[k](), min: plain(lo), max: plain(hi) }));
  }
  if (Number.isFinite(params.sections) && !Number.isInteger(params.sections)) out.push(tr('Rounded tip: the number of sections must be a whole number.'));
  if (typeof params.tangent !== 'boolean') out.push(tr('Rounded tip: tangent must be on or off.'));
  if (project.guides?.nose?.enabled || project.guides?.end?.enabled) out.push(tr('Switch the guide curves off first: they hold x as a function of y and would stretch over the rounded tip.'));
  if (project.settings.tip?.mode === 'pointed') out.push(tr('The wing already ends in a point (Settings > Wing tip = Pointed): a rounded tip needs a flat tip.'));
  if (out.length) return out;
  const { tip, taper, angle } = lastPanel(project, params.line);
  const kappa = roundTipKappa(project, params);
  if (kappa <= -1 + KAPPA_MARGIN) {
    // κ = −1 + margin at the length L_max = (1 − margin) · c_T / (−dc/dy · cos a0).
    const max = ((1 - KAPPA_MARGIN) * tip.chord) / (-taper * Math.cos(angle * DEG));
    out.push(tr('Rounded tip: the last panel tapers to zero chord within {at} mm, so a tangent tip can be at most {max} mm long; reduce the length or switch off Tangent to the last panel.', { at: plain(r2(tip.chord / (-taper * Math.cos(angle * DEG)))), max: plain(Math.floor(max * 100) / 100) }));
    return out;
  }
  // The last section before the point keeps cos(π (m − 1) / (2 m)) · (1 + κ sin(π (m − 1) / (2 m)))
  // of the tip chord.
  const th = (Math.PI * (params.sections - 1)) / (2 * params.sections);
  const need = LIMITS.minChord / (fullnessShape(Math.sin(th), params.fullness) * (1 + kappa * Math.sin(th)));
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
    if (q.chord > LIMITS.maxChord) out.push(tr('Rounded-tip section {n}: the chord is above {max} mm.', { n: i + 1, max: whole(LIMITS.maxChord) }));
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
  // The marker selects the blend in the angle of the tip ellipse (src/geom/tipblend.js).
  const marker = params.tangent ? 'tangent' : 'corner';
  const added = roundTipSections(project, params).map((q) => ({ id: newId('s'), ...q, roundTip: marker }));
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
