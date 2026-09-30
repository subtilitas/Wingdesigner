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
//   tip        'flat' (cut at the tip section) or 'pointed' (tip profile scaled to 1/200 of the
//              previous section, at least 1 mm; an elliptic planform then converges to the 25 % line
//              at the tip)
//   rootAirfoil, tipAirfoil  NACA designations

import { parseNacaCode } from '../airfoil/naca.js';
import { nacaEntry } from '../airfoil/library.js';
import { plain, tr, whole } from '../i18n/index.js';
import { LIMITS, createProject } from './project.js';

// label and description are getters: they follow the language at the time they are read.
export const PRESETS = {
  trainer: {
    get label() {
      return tr('Trainer');
    },
    get description() {
      return tr('Rectangular high-lift wing with dihedral for stable, slow flight.');
    },
    params: { span: 1400, rootChord: 250, taper: 1, sweep: 0, dihedral: 3, washout: 0, sections: 2, tip: 'flat', planform: 'straight', rootAirfoil: '2412', tipAirfoil: '2412' },
  },
  sport: {
    get label() {
      return tr('Sport');
    },
    get description() {
      return tr('Tapered wing with little dihedral and slight washout.');
    },
    params: { span: 1200, rootChord: 240, taper: 0.6, sweep: 0, dihedral: 1.5, washout: -1, sections: 2, tip: 'flat', planform: 'straight', rootAirfoil: '2412', tipAirfoil: '2410' },
  },
  glider: {
    get label() {
      return tr('Glider');
    },
    get description() {
      return tr('High aspect ratio with elliptic planform, dihedral and washout.');
    },
    params: { span: 2000, rootChord: 200, taper: 0.45, sweep: 0, dihedral: 4, washout: -1.5, sections: 3, tip: 'flat', planform: 'elliptic', rootAirfoil: '2410', tipAirfoil: '2408' },
  },
  flyingWing: {
    get label() {
      return tr('Swept flying wing');
    },
    get description() {
      return tr('Swept tailless wing with reflexed root section and washout for pitch stability.');
    },
    params: { span: 1200, rootChord: 280, taper: 0.45, sweep: 25, dihedral: 0, washout: -4, sections: 3, tip: 'flat', planform: 'straight', rootAirfoil: '23112', tipAirfoil: '0010' },
  },
  plank: {
    get label() {
      return tr('Plank');
    },
    get description() {
      return tr('Unswept tailless wing with reflexed sections.');
    },
    params: { span: 1000, rootChord: 220, taper: 0.8, sweep: 0, dihedral: 1, washout: 0, sections: 2, tip: 'flat', planform: 'straight', rootAirfoil: '23112', tipAirfoil: '23112' },
  },
  tail: {
    get label() {
      return tr('Tail surface');
    },
    get description() {
      return tr('Symmetric horizontal stabilizer.');
    },
    params: { span: 500, rootChord: 130, taper: 0.7, sweep: 5, dihedral: 0, washout: 0, sections: 2, tip: 'flat', planform: 'straight', rootAirfoil: '0009', tipAirfoil: '0009' },
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

// The parameter as a message names it: the identifier in English, the term of the wizard in German.
const PARAM_NAMES = {
  span: () => tr('span'),
  rootChord: () => tr('rootChord'),
  taper: () => tr('taper'),
  sweep: () => tr('sweep'),
  dihedral: () => tr('dihedral'),
  washout: () => tr('washout'),
  sections: () => tr('sections'),
  rootAirfoil: () => tr('rootAirfoil'),
  tipAirfoil: () => tr('tipAirfoil'),
};

/** A limit as text: whole numbers with dot groups in German (20.000), decimals (0.1) as they are. */
const bound = (v) => (Number.isInteger(v) ? whole(v) : plain(v));

/** Problems with the parameters; empty when valid. */
export function wizardProblems(params) {
  const out = [];
  for (const [k, [lo, hi]] of Object.entries(RANGES)) {
    const v = params[k];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < lo || v > hi) out.push(tr('{param} must be between {min} and {max}.', { param: PARAM_NAMES[k](), min: bound(lo), max: bound(hi) }));
  }
  if (!Number.isInteger(params.sections)) out.push(tr('sections must be an integer.'));
  if (!['straight', 'elliptic'].includes(params.planform)) out.push(tr('planform must be "straight" or "elliptic".'));
  if (!['flat', 'pointed', undefined].includes(params.tip)) out.push(tr('tip must be "flat" or "pointed".'));
  if (params.planform === 'elliptic' && params.tip !== 'pointed' && params.taper >= 1) out.push(tr('An elliptic planform needs taper < 1.'));
  for (const k of ['rootAirfoil', 'tipAirfoil']) if (!parseNacaCode(params[k] ?? '')) out.push(tr('{param} must be a NACA 4- or 5-digit designation.', { param: PARAM_NAMES[k]() }));
  return out;
}

/** Chord at span fraction eta (0 root, 1 tip). */
export function chordAt(params, eta) {
  const { rootChord: c0 } = params;
  const taper = params.planform === 'elliptic' && params.tip === 'pointed' ? 0 : params.taper;
  if (params.planform === 'elliptic') return c0 * Math.sqrt(Math.max(0, 1 - (1 - taper * taper) * eta * eta));
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
  // A pointed tip section carries the scaled chord (1/200 of the previous section, at least 1 mm).
  const pointedChord = params.tip === 'pointed' ? Math.max(chordAt(params, (n - 2) / (n - 1)) * 0.005, LIMITS.minChord) : null;
  for (let i = 0; i < n; i++) {
    const eta = i / (n - 1);
    const y = eta * b;
    const chord = i === n - 1 && pointedChord !== null ? pointedChord : chordAt(params, eta);
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
  const project = createProject({ name: name || tr('{span} mm wing', { span: plain(params.span) }), airfoils, sections });
  if (params.planform === 'elliptic') {
    // Points closer together towards the tip, where the elliptic chord falls fastest:
    // eta_i = sin(pi i / 20), i = 0 ... 10. With 6 points at eta = 0, 0.3, 0.55, 0.75, 0.9, 1 the chord
    // fell 3.4 % of the root chord below the law at taper 0.1; with these 11 points 0.55 %.
    const etas = Array.from({ length: 11 }, (_, i) => (i === 10 ? 1 : Math.sin((Math.PI * i) / 20)));
    const pts = (edge) =>
      etas.map((eta) => {
        const y = eta * b;
        // The pointed tip ends in the tip section, a quarter of its chord ahead of the sweep line.
        const c = eta === 1 && pointedChord !== null ? pointedChord : chordAt(params, eta);
        const xle = leadingEdgeX(params, y, c);
        // The end line x is the rounded nose x plus the rounded chord: rounded separately, the
        // difference of the two could fall below the chord (a 1 mm tip gave 0.9999999999999982 mm).
        return [edge === 'nose' ? r(xle) : r(xle) + r(c), r(y)];
      });
    project.guides = {
      nose: { enabled: true, mode: 'fit', degree: 3, points: pts('nose') },
      end: { enabled: true, mode: 'fit', degree: 3, points: pts('end') },
    };
  }
  project.settings.trailingEdge = { mode: 'thickness', thickness: Math.max(0.3, r(params.rootChord * 0.002)) };
  project.settings.tip = { mode: params.tip === 'pointed' ? 'pointed' : 'flat', ratio: 0.005 };
  return project;
}
