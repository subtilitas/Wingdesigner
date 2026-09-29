// Project size: warning thresholds, the loft grid and estimates of time and browser memory.
//
// Above a threshold in WARN the app works as usual; the Checks tab adds one warning that lists the
// sizes above their thresholds and the expected time and memory of each change. The hard limits in
// LIMITS (project.js) lie where a desktop browser tab runs out of memory or a change takes about a
// minute; projects beyond them are refused.
//
// The estimates are linear fits to measurements in Chromium 141 on 4 cores of a 2.1 GHz Xeon
// server CPU, JavaScript time without drawing the 3D view (RECORD.md lists the measurements). The
// 3D view adds the drawing time of the graphics card; phones compute slower (not measured).

import { LIMITS } from './project.js';

/** Sizes above which a warning names the expected time and memory. */
export const WARN = Object.freeze({
  sections: 200,
  airfoils: 200,
  pointsPerAirfoil: 5000,
  airfoilPoints: 100_000,
  guidePoints: 500,
  gridPoints: 60_000,
  exportTriangles: 2_000_000,
  name: 200,
});

/** Sections times airfoils above which the airfoil lists of the Sections table fill when used. */
export const LAZY_OPTIONS = 20_000;

// Seconds and megabytes per unit of each size, and the base cost of a change.
const COST = Object.freeze({
  base: { s: 0.2, mb: 15 },
  // Loft grid point: build, surface statistics and the 3D display mesh.
  grid: { s: 11.5e-6, mb: 0.65e-3 },
  // Airfoil list entry in the Sections table: one per section and airfoil, up to LAZY_OPTIONS.
  option: { s: 8.5e-6, mb: 0.5e-3 },
  // Airfoil point: thumbnails and the airfoil list, redrawn with every change.
  airfoilPoint: { s: 1.5e-6, mb: 0.2e-3 },
  // Point of an enabled guide curve: chord checks at every breakpoint and the point table.
  guidePoint: { s: 110e-6, mb: 0.05 },
  // Point of an airfoil once: the checks on import and the first build of a wing that uses it.
  airfoilFirstUse: { s: 30e-6, mb: 1e-3 },
});

// Export cost per triangle by format (8.5 million triangles: STL 6.9 s, 1.7 GB above the open
// project, 423 MB file; 3MF 49 s, 0.9 GB, 97 MB file).
const EXPORT = Object.freeze({
  stl: { s: 0.8e-6, mb: 210e-6, fileMB: 50e-6 },
  '3mf': { s: 5.8e-6, mb: 110e-6, fileMB: 11.5e-6 },
});

/**
 * Loft grid of a build: chord samples N, stations per panel as set (Kset) and as used (K), and the
 * grid points (stations times profile points 2N + 1) before added stations. Above
 * LIMITS.maxGridPoints the stations per panel go down, at least to one.
 */
export function loftGrid(sectionCount, settings, guidesOn = false) {
  const N = Math.round(Math.min(Math.max(settings.chordSamples, LIMITS.chordSamples[0]), LIMITS.chordSamples[1]));
  const dense = guidesOn || settings.spanwise === 'smooth';
  const Kset = dense ? Math.max(LIMITS.panelStations[0], Math.min(settings.panelStations, LIMITS.panelStations[1])) : 1;
  const panels = Math.max(1, sectionCount - 1);
  const K = Math.max(1, Math.min(Kset, Math.floor(LIMITS.maxGridPoints / ((2 * N + 1) * panels))));
  return { N, Kset, K, points: (panels * K + 1) * (2 * N + 1) };
}

/** Sizes of a project that drive time and memory. */
export function projectSize(project) {
  const guides = project.guides ?? {};
  const enabled = ['nose', 'end'].filter((k) => guides[k]?.enabled);
  let airfoilPoints = 0;
  let largestAirfoil = 0;
  let longestName = String(project.name ?? '').length;
  for (const a of project.airfoils) {
    const n = a.points?.length ?? 0;
    airfoilPoints += n;
    largestAirfoil = Math.max(largestAirfoil, n);
    longestName = Math.max(longestName, String(a.name ?? '').length);
  }
  return {
    sections: project.sections.length,
    airfoils: project.airfoils.length,
    airfoilPoints,
    largestAirfoil,
    guidePoints: Math.max(0, ...enabled.map((k) => guides[k].points?.length ?? 0)),
    gridPoints: loftGrid(project.sections.length, project.settings, enabled.length > 0).points,
    longestName,
  };
}

/** Expected JavaScript time (s) and peak browser memory (MB) of one change. */
export function changeCost(size) {
  const units = {
    base: 1,
    grid: size.gridPoints,
    option: size.sections * size.airfoils > LAZY_OPTIONS ? size.sections : size.sections * size.airfoils,
    airfoilPoint: size.airfoilPoints,
    guidePoint: size.guidePoints,
  };
  let s = 0;
  let mb = 0;
  for (const [k, n] of Object.entries(units)) {
    s += COST[k].s * n;
    mb += COST[k].mb * n;
  }
  return { seconds: s, megabytes: mb };
}

/** Expected time (s) of checking an airfoil of `points` points and of its first build. */
export function airfoilFirstUseSeconds(points) {
  return COST.airfoilFirstUse.s * points;
}

/** Expected time (s), peak memory (MB) and file size (MB) of a mesh export. */
export function exportCost(triangles, format) {
  const c = EXPORT[format] ?? EXPORT.stl;
  return { seconds: c.s * triangles, megabytes: COST.base.mb + c.mb * triangles, fileMB: c.fileMB * triangles };
}

const group = (n) => Math.round(n).toLocaleString('en');

/** "about 3 s", "under 1 s", "about 40 s". */
export function formatSeconds(s) {
  if (s < 1) return 'under 1 s';
  return `about ${s < 10 ? Math.round(s * 2) / 2 : Math.round(s)} s`;
}

/** "about 250 MB", "about 1.2 GB" (two significant digits). */
export function formatMegabytes(mb) {
  if (mb >= 1000) return `about ${Number((mb / 1000).toPrecision(2))} GB`;
  return `about ${Number(Math.max(mb, 1).toPrecision(2))} MB`;
}

/** Time and memory of one change: "each change takes about 3 s and about 250 MB of browser memory". */
export function costPhrase(size) {
  const c = changeCost(size);
  return `each change takes ${formatSeconds(c.seconds)} and ${formatMegabytes(c.megabytes)} of browser memory`;
}

/** costPhrase as a sentence. */
export function costSentence(size) {
  const t = costPhrase(size);
  return `${t[0].toUpperCase()}${t.slice(1)}.`;
}

/** Sizes above their WARN thresholds: [{ key, text }]. */
export function largeSizes(size) {
  const out = [];
  const add = (key, limit, text) => {
    if (size[key] > limit) out.push({ key, text: `${text(group(size[key]))} (warning above ${group(limit)})` });
  };
  add('sections', WARN.sections, (v) => `${v} sections`);
  add('airfoils', WARN.airfoils, (v) => `${v} airfoils`);
  add('largestAirfoil', WARN.pointsPerAirfoil, (v) => `an airfoil of ${v} points`);
  add('airfoilPoints', WARN.airfoilPoints, (v) => `${v} airfoil points in all`);
  add('guidePoints', WARN.guidePoints, (v) => `a guide curve of ${v} points`);
  add('gridPoints', WARN.gridPoints, (v) => `${v} loft grid points`);
  add('longestName', WARN.name, (v) => `a name of ${v} characters`);
  return out;
}

/** One warning for sizes above their thresholds, or null. */
export function sizeWarning(project, size = projectSize(project)) {
  const large = largeSizes(size).map((q) => q.text);
  if (!large.length) return null;
  const list = large.length === 1 ? large[0] : `${large.slice(0, -1).join(', ')} and ${large[large.length - 1]}`;
  return `Large project: ${list}. ${costSentence(size)}`;
}

/** A name for lists and messages: at most WARN.name characters. */
export function displayName(name) {
  const t = String(name ?? '');
  return t.length > WARN.name ? `${t.slice(0, WARN.name)}…` : t;
}
