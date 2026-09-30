// Section planes. 'vertical': every section lies in its plane y = const. 'mitred': the planes of
// XFLR5 and flow5 (XFLR5 6.62 wing.cpp, VNSide): the root stays vertical, a section between two panels
// lies in the bisector plane of the two panels, and the tip is square to the last panel. The airfoil
// thickness is stretched by 1/cos of the angle between the section plane and its panel, so that the
// thickness across every panel equals the airfoil's.
//
// A roll φ (degrees) turns a section plane about the x axis: its in-plane up direction is
// (0, −sin φ, cos φ) and its normal (0, cos φ, sin φ). The dihedral of a panel follows from the
// reference points (y, z) of its two sections. y stays the span parameter, so a panel stays below 90°.

export const SECTION_PLANES = Object.freeze(['vertical', 'mitred']);

/** Largest thickness stretch: 60° between a section plane and its panel (R6 of docs/Flow5upgrade.md). */
export const MAX_STRETCH = 2;

const DEG = Math.PI / 180;

/** Stretch of a section in a plane rolled by `roll` on a panel of `dihedral` (degrees). */
export const stretchOf = (roll, dihedral) => 1 / Math.cos((roll - dihedral) * DEG);

/** Whether a build uses mitred planes: Smooth builds vertical section planes (see buildWing). */
export const mitredPlanes = (settings) => settings.sectionPlanes === 'mitred' && settings.spanwise !== 'smooth';

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

/** Dihedral (degrees) of each panel between neighbouring sections sorted by y. */
export function panelDihedrals(sections) {
  const out = [];
  for (let i = 0; i + 1 < sections.length; i++) out.push(Math.atan2(sections[i + 1].z - sections[i].z, sections[i + 1].y - sections[i].y) / DEG);
  return out;
}

/**
 * Roll and stretch of each section (sorted by y) for the plane mode, with the panel dihedrals and, per
 * section, the largest angle (degrees) between its plane and a panel next to it.
 * @returns {{rolls: number[], stretches: number[], dihedrals: number[], angles: number[]}}
 */
export function sectionPlanes(sections, mode) {
  const n = sections.length;
  const dihedrals = panelDihedrals(sections);
  if (mode !== 'mitred' || n < 2) return { rolls: sections.map(() => 0), stretches: sections.map(() => 1), dihedrals, angles: sections.map(() => 0) };
  const rolls = [];
  for (let i = 0; i < n; i++) rolls.push(i === 0 ? 0 : i === n - 1 ? dihedrals[n - 2] : (dihedrals[i - 1] + dihedrals[i]) / 2);
  // At a break the bisector plane makes the same angle with both panels.
  const angles = rolls.map((r, i) => Math.abs(r - dihedrals[Math.min(i, n - 2)]));
  return { rolls, stretches: rolls.map((r, i) => stretchOf(r, dihedrals[Math.min(i, n - 2)])), dihedrals, angles };
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

/** The first section whose stretch exceeds MAX_STRETCH, or −1. */
export const overStretched = (stretches) => stretches.findIndex((m) => !(m <= MAX_STRETCH));

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
