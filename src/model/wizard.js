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
//   planform   'straight' (linear taper), 'elliptic' (nose and end guide curves) or 'panels'
//   panels     with planform 'panels': the half span from root to tip as panels { span (share of the
//              half span, the shares are normalized), sweep (leading-edge sweep, positive = swept
//              back), chord (chord at the outer end / root chord), dihedral }; taper, sweep and
//              sections are then not used, and every panel end is a section
//   tip        'flat' (cut at the tip section), 'pointed' (tip profile scaled to 1/200 of the
//              previous section, at least 1 mm; an elliptic planform then converges to the 25 % line
//              at the tip) or, with panels, 'elliptic' (the last panel ends in a quarter ellipse:
//              ELLIPTIC_TIP_SECTIONS sections, its quarter-chord line straight at the panel's
//              leading-edge sweep, the last one pointed)
//   rootAirfoil, tipAirfoil  NACA designations

import { parseNacaCode } from '../airfoil/naca.js';
import { nacaEntry } from '../airfoil/library.js';
import { plain, tr, whole } from '../i18n/index.js';
import { LIMITS, createProject } from './project.js';

/** Sections of an elliptic tip (the last one pointed). */
export const ELLIPTIC_TIP_SECTIONS = 6;

/** Most panels per half. */
export const MAX_PANELS = 24;

/**
 * Panels of an outline given at span fractions `etas` (0 … 1) by leading-edge and trailing-edge x
 * (any length unit, x aft): each panel a straight segment between two of the points. Returns
 * { rootChord (in the unit of the outline, times `scale`), panels }.
 */
function panelsFromOutline(etas, le, te, halfSpan, scale) {
  const c0 = te[0] - le[0];
  const panels = [];
  for (let i = 1; i < etas.length; i++) {
    const dy = (etas[i] - etas[i - 1]) * halfSpan;
    const dx = (le[i] - le[i - 1]) * scale;
    panels.push({
      span: Math.round((etas[i] - etas[i - 1]) * 1000) / 1000,
      sweep: Math.round((Math.atan2(dx, dy) * 1800) / Math.PI) / 10,
      chord: Math.round(((te[i] - le[i]) / c0) * 1000) / 1000,
      dihedral: 0,
    });
  }
  return { rootChord: Math.round(c0 * scale), panels };
}

// Batwing outline (planform of the Batwing of the 1989 film, right half, read from a top view with
// the half span as 400 units, x aft): the leading edge runs into a notch beside the fuselage and on
// to the forward point of the ear at 66 % of the half span; the trailing edge runs from a concave
// scallop to the rear spike at 51 %; both meet in the round tip.
const BAT_ETA = [0, 0.15, 0.25, 0.33, 0.4, 0.47, 0.51, 0.58, 0.66, 0.75, 0.85, 0.93, 1];
const BAT_LE = [470, 490, 515, 545, 560, 535, 505, 455, 400, 450, 515, 585, 660];
const BAT_TE = [760, 765, 770, 790, 820, 890, 970, 940, 905, 865, 810, 745, 660];
const BAT = panelsFromOutline(BAT_ETA, BAT_LE, BAT_TE, 500, 500 / 400);

/** Leading-edge sweep (degrees) of a straight-trailing-edge delta: x_TE(tip) = root chord. */
const deltaSweep = (rootChord, tipChord, halfSpan) => Math.round((Math.atan((rootChord - tipChord) / halfSpan) * 1800) / Math.PI) / 10;

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
  sailplane: {
    get label() {
      return tr('Sailplane');
    },
    get description() {
      return tr('Aspect ratio 16.8 with polyhedral (2°, 6°, 10°) and an elliptic or flat tip.');
    },
    params: {
      span: 3000,
      rootChord: 210,
      taper: 0.5,
      sweep: 0,
      dihedral: 2,
      washout: -2,
      sections: 4,
      tip: 'elliptic',
      planform: 'panels',
      panels: [
        { span: 0.45, sweep: 0, chord: 0.95, dihedral: 2 },
        { span: 0.35, sweep: 1.5, chord: 0.75, dihedral: 6 },
        { span: 0.2, sweep: 4, chord: 0.5, dihedral: 10 },
      ],
      rootAirfoil: '2410',
      tipAirfoil: '2408',
    },
  },
  deltaJet: {
    get label() {
      return tr('Delta jet');
    },
    get description() {
      return tr('Delta wing, leading edge swept 54.9°, straight trailing edge.');
    },
    params: {
      span: 900,
      rootChord: 800,
      taper: 0.2,
      sweep: 45,
      dihedral: 0,
      washout: 0,
      sections: 2,
      tip: 'flat',
      planform: 'panels',
      panels: [{ span: 1, sweep: deltaSweep(800, 160, 450), chord: 0.2, dihedral: 0 }],
      rootAirfoil: '0008',
      tipAirfoil: '0006',
    },
  },
  doubleDelta: {
    get label() {
      return tr('Double delta');
    },
    get description() {
      return tr('Strake swept 70°, outer delta swept 45°, straight trailing edge.');
    },
    params: {
      span: 1000,
      rootChord: 1000,
      taper: 0.24,
      sweep: 45,
      dihedral: 0,
      washout: 0,
      sections: 3,
      tip: 'flat',
      planform: 'panels',
      // Strake: 150 mm at 70° moves the leading edge 412.1 mm aft; the outer delta: 350 mm at 45°.
      panels: [
        { span: 0.3, sweep: 70, chord: 0.588, dihedral: 0 },
        { span: 0.7, sweep: 45, chord: 0.238, dihedral: 0 },
      ],
      rootAirfoil: '0008',
      tipAirfoil: '0006',
    },
  },
  batwing: {
    get label() {
      return tr('Batwing');
    },
    get description() {
      return tr('Bat-shaped flying wing: ears ahead, scalloped trailing edge, rear spikes, round tips.');
    },
    params: {
      span: 1000,
      rootChord: BAT.rootChord,
      taper: 0.5,
      sweep: 0,
      dihedral: 0,
      washout: 0,
      sections: 2,
      tip: 'pointed',
      planform: 'panels',
      panels: BAT.panels,
      rootAirfoil: '0010',
      tipAirfoil: '0008',
    },
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
  // V-tails and inverted V-tails: 60° is the steepest first panel that mitred section planes build,
  // where the vertical root plane stretches the airfoil twice (MAX_STRETCH in src/geom/planes.js).
  dihedral: [-60, 60],
  washout: [-15, 15],
  sections: [2, 8],
};

/** Ranges of the panel values (span: share before normalization; chord: ratio to the root chord). */
export const PANEL_RANGES = {
  span: [0.001, 100],
  // A valid straight planform converts to sweeps up to about ±89.4° (100 mm span, 3000 mm root chord,
  // taper 0.1 or 1.5, 8 sections); tan 89.9° = 573.
  sweep: [-89.9, 89.9],
  chord: [0, 3],
  dihedral: [-60, 60],
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
  const panels = params.planform === 'panels';
  for (const [k, [lo, hi]] of Object.entries(RANGES)) {
    // With panels, taper, sweep, dihedral and sections come from the panel list.
    if (panels && ['taper', 'sweep', 'dihedral', 'sections'].includes(k)) continue;
    const v = params[k];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < lo || v > hi) out.push(tr('{param} must be between {min} and {max}.', { param: PARAM_NAMES[k](), min: bound(lo), max: bound(hi) }));
  }
  if (!panels && !Number.isInteger(params.sections)) out.push(tr('sections must be an integer.'));
  if (!['straight', 'elliptic', 'panels'].includes(params.planform)) out.push(tr('planform must be "straight", "elliptic" or "panels".'));
  if (!['flat', 'pointed', 'elliptic', undefined].includes(params.tip)) out.push(tr('tip must be "flat", "pointed" or "elliptic".'));
  if (params.tip === 'elliptic' && !panels) out.push(tr('An elliptic tip needs the planform Panels.'));
  if (panels) out.push(...panelProblems(params));
  if (params.planform === 'elliptic' && params.tip !== 'pointed' && params.taper >= 1) out.push(tr('An elliptic planform needs taper < 1.'));
  for (const k of ['rootAirfoil', 'tipAirfoil']) if (!parseNacaCode(params[k] ?? '')) out.push(tr('{param} must be a NACA 4- or 5-digit designation.', { param: PARAM_NAMES[k]() }));
  return out;
}

/**
 * The straight or elliptic planform of `params` as panels: one per interval between its evenly spaced
 * sections, ending at the section's leading edge with its chord, at the dihedral of `params`. A
 * straight planform keeps its sections and a pointed tip its chord (1/200 of the section before);
 * an elliptic planform becomes the polygon through its sections. Sweep and chord ratio stay unrounded:
 * on a 10,000 mm half span, a sweep rounded to 0.001° would move a section 0.36 mm at 60°.
 */
export function panelsFromParams(params) {
  const n = Math.min(Math.max(Number.isInteger(params.sections) ? params.sections : 2, 2), MAX_PANELS + 1);
  const b = params.span / 2;
  const c0 = params.rootChord;
  const at = (i) => {
    const eta = i / (n - 1);
    const chord = chordAt(params, eta);
    return { y: eta * b, x: leadingEdgeX(params, eta * b, chord), chord };
  };
  const out = [];
  for (let i = 1; i < n; i++) {
    const [a, q] = [at(i - 1), at(i)];
    out.push({
      span: 1 / (n - 1),
      sweep: (Math.atan2(q.x - a.x, q.y - a.y) * 180) / Math.PI,
      chord: q.chord / c0,
      dihedral: params.dihedral,
    });
  }
  return out;
}

/** Problems of the panel list of a 'panels' planform. */
function panelProblems(params) {
  const list = params.panels;
  if (!Array.isArray(list) || list.length < 1 || list.length > MAX_PANELS) return [tr('The planform Panels needs 1 to {max} panels.', { max: MAX_PANELS })];
  const out = [];
  const names = { span: () => tr('span share'), sweep: () => tr('leading-edge sweep'), chord: () => tr('outer chord'), dihedral: () => tr('dihedral') };
  list.forEach((q, i) => {
    for (const [k, [lo, hi]] of Object.entries(PANEL_RANGES)) {
      const v = q?.[k];
      if (typeof v !== 'number' || !Number.isFinite(v) || v < lo || v > hi) out.push(tr('Panel {n}: {param} must be between {min} and {max}.', { n: i + 1, param: names[k](), min: bound(lo), max: bound(hi) }));
    }
  });
  if (out.length) return out;
  // Every panel spans at least 1 mm of the half span: the sections are rounded to 0.01 mm, and a
  // narrower panel counts as no panel for the section planes.
  const total = list.reduce((sum, q) => sum + q.span, 0);
  if (Number.isFinite(params.span)) {
    list.forEach((q, i) => {
      const w = (q.span / total) * (params.span / 2);
      if (w < 1) out.push(tr('Panel {n} spans {w} mm of the half span; a panel needs at least 1 mm.', { n: i + 1, w: plain(Number(w.toPrecision(3))) }));
    });
  }
  // An elliptic tip keeps cos(π (m − 1) / (2 m)) of its entry chord at its last inner section
  // (m = ELLIPTIC_TIP_SECTIONS: cos 75° = 0.259), which must reach the smallest chord: 3.86 mm.
  if (params.tip === 'elliptic' && Number.isFinite(params.rootChord)) {
    const entry = list.length > 1 ? list[list.length - 2].chord * params.rootChord : params.rootChord;
    const need = LIMITS.minChord / Math.cos((Math.PI * (ELLIPTIC_TIP_SECTIONS - 1)) / (2 * ELLIPTIC_TIP_SECTIONS));
    // The limit as shown is rounded up (3.87 mm), so that a chord of the shown value passes.
    if (entry < need) out.push(tr('Panel {n}: the elliptic tip needs at least {min} mm of chord where it begins.', { n: list.length, min: plain(Math.ceil(need * 100) / 100) }));
  }
  // Every section but a pointed or elliptic tip keeps at least the smallest chord.
  const last = list.length - 1;
  const endsInPoint = params.tip === 'pointed' || params.tip === 'elliptic';
  list.forEach((q, i) => {
    if (i === last && endsInPoint) return;
    if (Number.isFinite(params.rootChord) && q.chord * params.rootChord < LIMITS.minChord) out.push(tr('Panel {n}: the outer chord is below {min} mm.', { n: i + 1, min: plain(LIMITS.minChord) }));
  });
  // Every station stays within the coordinate limit, the tip after its move to the quarter-chord point:
  // a long span at a steep sweep or dihedral (20,000 mm at 89.9°) puts the tip millions of mm away.
  if (!out.length && Number.isFinite(params.span) && Number.isFinite(params.rootChord)) {
    const reported = new Set();
    panelStations(params).forEach((q, i) => {
      // The sections of an elliptic tip belong to the last panel.
      const n = Math.min(i, list.length);
      if (reported.has(n) || (Math.abs(q.x) <= LIMITS.maxCoordinate && Math.abs(q.z) <= LIMITS.maxCoordinate)) return;
      reported.add(n);
      out.push(tr('Panel {n} ends at x = {x} mm, z = {z} mm, beyond ±{max} mm.', { n, x: whole(Math.round(q.x)), z: whole(Math.round(q.z)), max: whole(LIMITS.maxCoordinate) }));
    });
  }
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
  if (params.planform === 'panels') return panelProject(params, name);
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

/**
 * Stations of a 'panels' planform along the half span, { y, x (leading edge), z, chord } in mm: the
 * root, every panel end, the sections of an elliptic tip, and a pointed or elliptic tip with its
 * scaled chord at its quarter-chord point.
 */
function panelStations(params) {
  const b = params.span / 2;
  const c0 = params.rootChord;
  const total = params.panels.reduce((sum, q) => sum + q.span, 0);
  const tan = (deg) => Math.tan((deg * Math.PI) / 180);
  const pts = [{ y: 0, x: 0, z: 0, chord: c0 }];
  params.panels.forEach((q, i) => {
    const prev = pts[pts.length - 1];
    const dy = (q.span / total) * b;
    const tipPanel = i === params.panels.length - 1;
    if (tipPanel && params.tip === 'elliptic') {
      // Quarter ellipse: chord c(t) = c_in · sqrt(1 − t²), the quarter-chord line straight at the
      // panel's sweep, t = sin(π k / (2 m)) for k = 1 … m (closer together towards the tip).
      const m = ELLIPTIC_TIP_SECTIONS;
      const xq = prev.x + 0.25 * prev.chord;
      for (let k = 1; k <= m; k++) {
        const t = k === m ? 1 : Math.sin((Math.PI * k) / (2 * m));
        const chord = prev.chord * Math.sqrt(Math.max(0, 1 - t * t));
        const y = prev.y + t * dy;
        pts.push({ y, x: xq + t * dy * tan(q.sweep) - 0.25 * chord, z: prev.z + t * dy * tan(q.dihedral), chord });
      }
      return;
    }
    pts.push({ y: prev.y + dy, x: prev.x + dy * tan(q.sweep), z: prev.z + dy * tan(q.dihedral), chord: q.chord * c0 });
  });
  // A pointed or elliptic tip ends in the scaled chord (1/200 of the section before, at least 1 mm).
  const n = pts.length;
  if (params.tip === 'pointed' || params.tip === 'elliptic') {
    const tipChord = Math.max(pts[n - 2].chord * 0.005, LIMITS.minChord);
    const tip = pts[n - 1];
    // The tip point keeps its quarter-chord position.
    tip.x += 0.25 * (tip.chord - tipChord);
    tip.chord = tipChord;
  }
  return pts;
}

/** Sections of a 'panels' planform: one at the root and one at the outer end of every panel. */
function panelProject(params, name) {
  const b = params.span / 2;
  const c0 = params.rootChord;
  const airfoils = [];
  const idOf = (code) => {
    const id = `naca${parseNacaCode(code).code}`;
    if (!airfoils.some((a) => a.id === id)) airfoils.push({ id, ...nacaEntry(code) });
    return id;
  };
  const rootId = idOf(params.rootAirfoil);
  const tipId = idOf(params.tipAirfoil);
  const r = (v) => Math.round(v * 100) / 100;
  const pts = panelStations(params);
  const n = pts.length;
  const sections = pts.map((q, i) => ({
    id: `s${i + 1}`,
    airfoil: i === n - 1 ? tipId : rootId,
    x: r(q.x),
    y: r(q.y),
    z: r(q.z),
    chord: r(q.chord),
    twist: r((params.washout * q.y) / b),
  }));
  const project = createProject({ name: name || tr('{span} mm wing', { span: plain(params.span) }), airfoils, sections });
  project.settings.trailingEdge = { mode: 'thickness', thickness: Math.max(0.3, r(c0 * 0.002)) };
  project.settings.tip = { mode: params.tip === 'pointed' || params.tip === 'elliptic' ? 'pointed' : 'flat', ratio: 0.005 };
  return project;
}
