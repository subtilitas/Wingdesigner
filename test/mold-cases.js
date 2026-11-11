// Wing and mold configurations covering the STEP topology variants of the mold halves: a tip that
// closes in a point and a flat tip, an open and a closed trailing edge, dihedral (a leaning root
// face), twist (ramps), a reflexed airfoil at a flat tip, each hole pattern, no resin channel, no
// holes, one half only, the molds of the left wing, and Y as the up axis.
import { createProject } from '../src/model/project.js';
import { addRoundTip, defaultRoundTip } from '../src/model/roundtip.js';
import { PRESETS, wizardProject } from '../src/model/wizard.js';
import { naca, sampleProject } from './helpers.js';

/** A flat, untwisted wing of one airfoil: leading edge and trailing edge lie in one plane. */
export function flatWing(settings = {}) {
  return createProject({
    name: 'Flat wing',
    airfoils: [naca('0010')],
    sections: [
      { airfoil: '0010', x: 0, y: 0, z: 0, chord: 200, twist: 0 },
      { airfoil: '0010', x: 40, y: 500, z: 0, chord: 120, twist: 0 },
    ],
    settings,
  });
}

const preset = (key, edit = () => {}) => {
  const p = wizardProject(PRESETS[key].params);
  edit(p);
  return p;
};
const rounded = (p) => {
  addRoundTip(p, defaultRoundTip(p));
  return p;
};
const closed = (p) => {
  p.settings.trailingEdge = { ...p.settings.trailingEdge, mode: 'closed' };
  return p;
};

export function moldCases() {
  const cases = [];
  cases.push({ name: 'flat-wing', project: flatWing(), mold: {} });
  cases.push({ name: 'flat-wing-closed-te', project: closed(flatWing()), mold: {} });
  cases.push({ name: 'flat-wing-round-tip', project: rounded(flatWing()), mold: {} });
  // Twist and dihedral in three sections: a rolled frame and ramps of a few mm.
  cases.push({ name: 'sample-twist-dihedral', project: sampleProject(), mold: { ramp: 6, channel: { distance: 8 } } });
  cases.push({ name: 'sport-round-tip', project: rounded(preset('sport')), mold: {} });
  cases.push({ name: 'glider-ellipse-round-tip', project: rounded(preset('glider')), mold: { pins: { pattern: 'outline', spacing: 300 }, screws: { pattern: 'outline', spacing: 100, offset: 25 } } });
  // A reflexed airfoil with a closed trailing edge at a flat tip: the mean line parts the tip face.
  cases.push({ name: 'flying-wing-flat-tip', project: closed(preset('flyingWing')), mold: { ramp: 8, channel: { distance: 10 } } });
  // A trailing edge that runs back to the root: the resin channel rounds the inward corner there.
  cases.push({ name: 'delta-jet-round-tip', project: rounded(preset('deltaJet')), mold: { channel: { diameter: 6, distance: 8 } } });
  cases.push({ name: 'batwing', project: preset('batwing'), mold: {} });
  cases.push({ name: 'tail-no-channel', project: preset('tail'), mold: { channel: { on: false }, screws: { pattern: 'corners', edge: 25 } } });
  cases.push({ name: 'tail-no-holes', project: preset('tail'), mold: { pins: { on: false }, screws: { on: false } } });
  cases.push({ name: 'sport-lower-only', project: rounded(preset('sport')), mold: { halves: 'lower' }, solids: 1 });
  cases.push({ name: 'sport-upper-only', project: rounded(preset('sport')), mold: { halves: 'upper' }, solids: 1 });
  cases.push({ name: 'sport-left-y-up', project: rounded(preset('sport')), mold: { left: true }, up: 'y' });
  return cases;
}
