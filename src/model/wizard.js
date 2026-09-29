// New-design wizard: turns a few planform parameters into a complete project.
//
// Parameters (lengths in mm, angles in degrees):
//   span       full span (both halves)
//   rootChord  chord at y = 0
//   taper      tip chord / root chord (0.1 .. 1.5)
//   sweep      sweep of the quarter-chord line (positive = swept back)
//   dihedral   dihedral angle of each half
//   washout    twist at the tip (negative = leading edge down)
//   sections   number of sections (2 .. 8), evenly spaced along the half span
//   planform   'straight' (linear taper) or 'elliptic' (nose and end guide curves)
//   rootAirfoil, tipAirfoil  NACA designations

import { parseNacaCode } from '../airfoil/naca.js';
import { nacaEntry } from '../airfoil/library.js';
import { createProject } from './project.js';

export const PRESETS = {
  trainer: {
    label: 'Trainer',
    description: 'Rectangular high-lift wing with dihedral for stable, slow flight.',
    params: { span: 1400, rootChord: 250, taper: 1, sweep: 0, dihedral: 3, washout: 0, sections: 2, planform: 'straight', rootAirfoil: '2412', tipAirfoil: '2412' },
  },
  sport: {
    label: 'Sport',
    description: 'Tapered wing with little dihedral and slight washout.',
    params: { span: 1200, rootChord: 240, taper: 0.6, sweep: 0, dihedral: 1.5, washout: -1, sections: 2, planform: 'straight', rootAirfoil: '2412', tipAirfoil: '2410' },
  },
  glider: {
    label: 'Glider',
    description: 'High aspect ratio with elliptic planform, dihedral and washout.',
    params: { span: 2000, rootChord: 200, taper: 0.45, sweep: 0, dihedral: 4, washout: -1.5, sections: 3, planform: 'elliptic', rootAirfoil: '2410', tipAirfoil: '2408' },
  },
  flyingWing: {
    label: 'Swept flying wing',
    description: 'Swept tailless wing with reflexed root section and washout for pitch stability.',
    params: { span: 1200, rootChord: 280, taper: 0.45, sweep: 25, dihedral: 0, washout: -4, sections: 3, planform: 'straight', rootAirfoil: '23112', tipAirfoil: '0010' },
  },
  plank: {
    label: 'Plank',
    description: 'Unswept tailless wing with reflexed sections.',
    params: { span: 1000, rootChord: 220, taper: 0.8, sweep: 0, dihedral: 1, washout: 0, sections: 2, planform: 'straight', rootAirfoil: '23112', tipAirfoil: '23112' },
  },
  tail: {
    label: 'Tail surface',
    description: 'Symmetric horizontal stabilizer.',
    params: { span: 500, rootChord: 130, taper: 0.7, sweep: 5, dihedral: 0, washout: 0, sections: 2, planform: 'straight', rootAirfoil: '0009', tipAirfoil: '0009' },
  },
};

export const RANGES = {
  span: [100, 20000],
  rootChord: [10, 3000],
  taper: [0.1, 1.5],
  sweep: [-45, 60],
  dihedral: [-15, 30],
  washout: [-15, 15],
  sections: [2, 8],
};

/** Problems with the parameters; empty when valid. */
export function wizardProblems(params) {
  const out = [];
  for (const [k, [lo, hi]] of Object.entries(RANGES)) {
    const v = params[k];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < lo || v > hi) out.push(`${k} must be between ${lo} and ${hi}.`);
  }
  if (!Number.isInteger(params.sections)) out.push('sections must be an integer.');
  if (!['straight', 'elliptic'].includes(params.planform)) out.push('planform must be "straight" or "elliptic".');
  if (params.planform === 'elliptic' && params.taper >= 1) out.push('An elliptic planform needs taper < 1.');
  for (const k of ['rootAirfoil', 'tipAirfoil']) if (!parseNacaCode(params[k] ?? '')) out.push(`${k} must be a NACA 4- or 5-digit designation.`);
  return out;
}

/** Chord at span fraction eta (0 root, 1 tip). */
export function chordAt(params, eta) {
  const { rootChord: c0, taper } = params;
  if (params.planform === 'elliptic') return c0 * Math.sqrt(1 - (1 - taper * taper) * eta * eta);
  return c0 * (1 + (taper - 1) * eta);
}

/** Leading-edge x at span position y, for a quarter-chord line swept by params.sweep. */
function leadingEdgeX(params, y, chord) {
  const xq = 0.25 * params.rootChord + y * Math.tan((params.sweep * Math.PI) / 180);
  return xq - 0.25 * chord;
}

/** Build a project from wizard parameters. Throws when the parameters are invalid. */
export function wizardProject(params, name) {
  const problems = wizardProblems(params);
  if (problems.length) throw new Error(problems.join(' '));
  const b = params.span / 2;
  const n = params.sections;
  const airfoils = [];
  const idOf = (code) => {
    const id = `naca${parseNacaCode(code).code}`;
    if (!airfoils.some((a) => a.id === id)) airfoils.push({ id, ...nacaEntry(code) });
    return id;
  };
  const rootId = idOf(params.rootAirfoil);
  const tipId = idOf(params.tipAirfoil);
  const tanD = Math.tan((params.dihedral * Math.PI) / 180);
  const r = (v) => Math.round(v * 100) / 100;
  const sections = [];
  for (let i = 0; i < n; i++) {
    const eta = i / (n - 1);
    const y = eta * b;
    const chord = chordAt(params, eta);
    sections.push({
      id: `s${i + 1}`,
      airfoil: i === n - 1 ? tipId : rootId,
      x: r(leadingEdgeX(params, y, chord)),
      y: r(y),
      z: r(y * tanD),
      chord: r(chord),
      twist: r(params.washout * eta),
    });
  }
  const project = createProject({ name: name || `${params.span} mm wing`, airfoils, sections });
  if (params.planform === 'elliptic') {
    const etas = [0, 0.3, 0.55, 0.75, 0.9, 1];
    const pts = (edge) =>
      etas.map((eta) => {
        const y = eta * b;
        const c = chordAt(params, eta);
        const xle = leadingEdgeX(params, y, c);
        return [r(edge === 'nose' ? xle : xle + c), r(y)];
      });
    project.guides = {
      nose: { enabled: true, mode: 'fit', degree: 3, points: pts('nose') },
      end: { enabled: true, mode: 'fit', degree: 3, points: pts('end') },
    };
  }
  project.settings.trailingEdge = { mode: 'thickness', thickness: Math.max(0.3, r(params.rootChord * 0.002)) };
  return project;
}
