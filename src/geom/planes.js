// Section planes. 'vertical': every section lies in its plane y = const. 'mitred': the planes of
// XFLR5 and flow5 (XFLR5 6.62 wing.cpp, VNSide): the root stays vertical, a section between two panels
// lies in the bisector plane of the two panels, and the tip is square to the last panel. The airfoil
// thickness is stretched by 1/cos of the angle between the section plane and its panel, so that the
// thickness across every panel equals the airfoil's.
//
// A roll φ (degrees) turns a section plane about the x axis: its in-plane up direction is
// (0, −sin φ, cos φ) and its normal (0, cos φ, sin φ). The dihedral of a panel follows from the
// reference points (y, z) of its two sections. y stays the span parameter, so a panel stays below 90°.
// A section can store the angle of the panel to the next section (panelAngle, degrees): the planes
// then use it in place of the dihedral from the reference points. The XFLR5 import stores XFLR5's
// dihedral where an airfoil's own coordinates move the sections (src/import/xflr5.js).
//
// A panel less than SHORT_PANEL wide in y counts as no panel, as XFLR5 skips panels shorter than
// 0.1 mm: the sections at its ends share one plane, the bisector plane of the panels around it
// (vertical before the first panel, square to the last panel after it). The width in y, not the
// length: an airfoil's own coordinates move the sections of an XFLR5 airfoil switch (two sections
// 0.5 mm apart) by up to a few mm in their shared plane, mostly in z.

export const SECTION_PLANES = Object.freeze(['vertical', 'mitred']);

/** Largest thickness stretch: 60° between a section plane and its panel (R6 of docs/Flow5upgrade.md). */
export const MAX_STRETCH = 2;

/** Width in y (mm) below which a panel counts as no panel for the section planes. */
export const SHORT_PANEL = 1;

const DEG = Math.PI / 180;

/** Stretch of a section in a plane rolled by `roll` on a panel of `dihedral` (degrees). */
export const stretchOf = (roll, dihedral) => 1 / Math.cos((roll - dihedral) * DEG);

/** Whether a build uses mitred planes, with every spanwise interpolation (see buildWing). */
export const mitredPlanes = (settings) => settings.sectionPlanes === 'mitred';

/**
 * Linear panels whose two section planes differ (they get the stations per panel of a guide curve),
 * for sections in any order and settings with their defaults.
 */
export function rolledPanelCount(sections, settings) {
  if (!(mitredPlanes(settings) && settings.spanwise === 'linear') || sections.length < 2) return 0;
  const { rolls } = sectionPlanes(sections.slice().sort((a, b) => a.y - b.y), 'mitred');
  let n = 0;
  for (let i = 0; i + 1 < rolls.length; i++) if (rolls[i] !== rolls[i + 1]) n++;
  return n;
}

/** Dihedral (degrees) of each panel between neighbouring sections sorted by y, from their reference points. */
export function panelDihedrals(sections) {
  const out = [];
  for (let i = 0; i + 1 < sections.length; i++) out.push(Math.atan2(sections[i + 1].z - sections[i].z, sections[i + 1].y - sections[i].y) / DEG);
  return out;
}

/** Whether a section stores the angle of its panel (a number; null or absent: from the reference points). */
export const storesPanelAngle = (s) => typeof s.panelAngle === 'number' && Number.isFinite(s.panelAngle);

/**
 * Roll and stretch of each section (sorted by y) for the plane mode. `dihedrals`: the dihedral of
 * each panel from the reference points (the direction the sections move along); `panels`: the angle
 * the planes are square to, per panel (a stored panelAngle, else the dihedral; a short panel takes the
 * angle its sections are stretched against); `angles`: per section, the angle between its plane and
 * the panels next to it (at a bisector the same for both).
 * @returns {{rolls: number[], stretches: number[], dihedrals: number[], panels: number[], angles: number[]}}
 */
export function sectionPlanes(sections, mode) {
  const n = sections.length;
  const dihedrals = panelDihedrals(sections);
  if (mode !== 'mitred' || n < 2) return { rolls: sections.map(() => 0), stretches: sections.map(() => 1), dihedrals, panels: dihedrals.slice(), angles: sections.map(() => 0) };
  const own = dihedrals.map((d, i) => (storesPanelAngle(sections[i]) ? sections[i].panelAngle : d));
  const real = dihedrals.map((_, i) => sections[i + 1].y - sections[i].y >= SHORT_PANEL);
  // The nearest real panel inboard of each section (ending at it or before) and outboard (starting at
  // it or after), as panel indices, or −1.
  const before = [];
  const after = new Array(n).fill(-1);
  for (let i = 0, last = -1; i < n; i++) {
    before.push(last);
    if (i < n - 1 && real[i]) last = i;
  }
  for (let i = n - 2, next = -1; i >= 0; i--) {
    if (real[i]) next = i;
    after[i] = next;
  }
  const rolls = [];
  const refs = [];
  for (let i = 0; i < n; i++) {
    const a = before[i];
    const b = after[i];
    // Before the first real panel the planes stay vertical, after the last one square to it. Without
    // any real panel (every section within SHORT_PANEL) all stay vertical.
    rolls.push(a < 0 ? 0 : b < 0 ? own[a] : (own[a] + own[b]) / 2);
    refs.push(b >= 0 ? own[b] : a >= 0 ? own[a] : 0);
  }
  // A short panel carries the stretch of its sections: both lie in one plane against the same panel.
  const panels = own.map((d, i) => (real[i] ? d : refs[i]));
  const angles = rolls.map((r, i) => Math.abs(r - refs[i]));
  return { rolls, stretches: rolls.map((r, i) => stretchOf(r, refs[i])), dihedrals, panels, angles };
}

/**
 * Extent of a placed section along the up direction of its plane (mm, from its reference point):
 * `shape` is the airfoil at unit chord with its leading edge at the origin, as placeSection takes it.
 */
export function upExtent(shape, { chord, twist, stretch = 1 }, pivot) {
  const s = Math.sin(twist * DEG);
  const c = Math.cos(twist * DEG);
  let low = Infinity;
  let high = -Infinity;
  for (const [px, pz] of shape) {
    const t = chord * (-(px - pivot) * s + pz * stretch * c);
    low = Math.min(low, t);
    high = Math.max(high, t);
  }
  return [low, high];
}

/**
 * Whether the loft between two neighbouring sections folds in span: a = { y, z, roll, low, high } and b
 * likewise (low and high from upExtent). Two rolled planes meet in a line parallel to x; the loft folds
 * when that line passes through either section, or when the two sections lie on its opposite sides.
 * @returns {{distance: number}|null} where the planes meet, along the up direction of a (mm)
 */
export function planeFold(a, b) {
  const sa = Math.sin(a.roll * DEG);
  const ca = Math.cos(a.roll * DEG);
  const sb = Math.sin(b.roll * DEG);
  const cb = Math.cos(b.roll * DEG);
  // a: (y_a − t·sa, z_a + t·ca); b: (y_b − u·sb, z_b + u·cb). Parallel planes never meet.
  const det = sa * cb - ca * sb;
  if (Math.abs(det) < 1e-12) return null;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  const t = (-dy * cb - sb * dz) / det;
  const u = (-sa * dz - ca * dy) / det;
  const inside = (q, low, high) => q >= low && q <= high;
  // Signs of the sections relative to the line: both above or both below it keeps them apart.
  const sideA = Math.sign(a.low - t) === Math.sign(a.high - t) ? Math.sign(a.low - t) : 0;
  const sideB = Math.sign(b.low - u) === Math.sign(b.high - u) ? Math.sign(b.low - u) : 0;
  if (inside(t, a.low, a.high) || inside(u, b.low, b.high) || sideA !== sideB) return { distance: t };
  // On one side of the line b lies outboard of a, on the other inboard: the middle of a must lie
  // inboard of the plane of b (normal (cos φ_b, sin φ_b) in y, z).
  const q = (a.low + a.high) / 2;
  if ((a.y - q * sa - b.y) * cb + (a.z + q * ca - b.z) * sb >= 0) return { distance: t };
  return null;
}

/**
 * Largest stretch that builds: a plane that rounds to 60.0° from its panel. Section positions hold 4
 * decimals, so a plane meant at 60° lies up to about 1e-5° off it (a stretch of 2.0000002, say).
 */
const STRETCH_LIMIT = 1 / Math.cos((60.05 * Math.PI) / 180);

/** The first section whose stretch exceeds MAX_STRETCH (60°, within the rounding of STRETCH_LIMIT), or −1. */
export const overStretched = (stretches) => stretches.findIndex((m) => !(m <= STRETCH_LIMIT));

/**
 * The first neighbours i and i + 1 whose planes fold the loft between them, as { i, distance } (see
 * planeFold), or null. `extentAt(i)` gives { y, z, roll, low, high } of section i.
 */
export function firstFold(rolls, extentAt) {
  for (let i = 0; i + 1 < rolls.length; i++) {
    if (rolls[i] === rolls[i + 1]) continue;
    const fold = planeFold(extentAt(i), extentAt(i + 1));
    if (fold) return { i, distance: fold.distance };
  }
  return null;
}
