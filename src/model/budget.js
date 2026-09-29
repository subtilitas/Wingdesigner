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

import { count, plain, tr } from '../i18n/index.js';
import { LIMITS, resolveSettings } from './project.js';

/** Sizes above which a warning names the expected time and memory. */
export const WARN = Object.freeze({
  sections: 200,
  airfoils: 200,
  pointsPerAirfoil: 5000,
  airfoilPoints: 100_000,
  guidePoints: 500,
  gridPoints: 60_000,
  exportTriangles: 2_000_000,
  stepPoints: 1_000_000,
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
  // Airfoil once, whatever its points: curve sampling and crossing tests of the first build (7.4 ms
  // per airfoil of 99 points at 1,000 and 2,000 airfoils, of it 3 ms by the point term; Node.js 24,
  // not measured in the browser).
  airfoilFirstBuild: { s: 4.4e-3 },
});

// Export cost per triangle by format (8.5 million triangles: STL 6.9 s, 1.7 GB above the open
// project, 423 MB file; 3MF 49 s, 0.9 GB, 97 MB file).
const EXPORT = Object.freeze({
  stl: { s: 0.8e-6, mb: 210e-6, fileMB: 50e-6 },
  '3mf': { s: 5.8e-6, mb: 110e-6, fileMB: 11.5e-6 },
  // Per STEP control point (Node 24: 98 bytes of file, 620 bytes of heap at the peak, 1.6 to 3.4 µs;
  // Chromium 141: 3.3 million points in 8.4 s).
  step: { s: 2.5e-6, mb: 620e-6, fileMB: 98e-6 },
});

/** Surface control points a STEP export writes: the half-wing surface, twice with the left half. */
export function stepPoints(build, half) {
  const S = build?.surface;
  if (!S) return 0;
  return (half === 'right' ? 1 : 2) * S.points.length * S.points[0].length;
}

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
  // Largest K with (panels * K + 1) * (2N + 1) <= LIMITS.maxGridPoints.
  const K = Math.max(1, Math.min(Kset, Math.floor((LIMITS.maxGridPoints / (2 * N + 1) - 1) / panels)));
  return { N, Kset, K, points: (panels * K + 1) * (2 * N + 1) };
}

/** Sizes of a project that drive time and memory. */
export function projectSize(project) {
  const guides = project.guides ?? {};
  const enabled = ['nose', 'end'].filter((k) => guides[k]?.enabled);
  const used = new Set(project.sections.map((s) => s.airfoil));
  let airfoilPoints = 0;
  let usedAirfoils = 0;
  let usedAirfoilPoints = 0;
  let largestAirfoil = 0;
  let longestName = String(project.name ?? '').length;
  for (const a of project.airfoils) {
    const n = a.points?.length ?? 0;
    airfoilPoints += n;
    if (used.has(a.id)) {
      usedAirfoils++;
      usedAirfoilPoints += n;
    }
    largestAirfoil = Math.max(largestAirfoil, n);
    longestName = Math.max(longestName, String(a.name ?? '').length);
  }
  return {
    sections: project.sections.length,
    airfoils: project.airfoils.length,
    airfoilPoints,
    // The build checks and fits only the airfoils that sections use.
    usedAirfoils,
    usedAirfoilPoints,
    largestAirfoil,
    guidePoints: Math.max(0, ...enabled.map((k) => guides[k].points?.length ?? 0)),
    // Settings with their defaults: a project from the module API may carry some or none.
    gridPoints: loftGrid(project.sections.length, resolveSettings(project.settings), enabled.length > 0).points,
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

/**
 * Expected time (s) of the first build of the project: Open, the restored autosave and a change of
 * the profile parametrization check and fit every airfoil that a section uses again.
 */
export function firstBuildSeconds(size) {
  return changeCost(size).seconds + COST.airfoilFirstBuild.s * size.usedAirfoils + COST.airfoilFirstUse.s * size.usedAirfoilPoints;
}

/** Expected time (s) of checking an airfoil of `points` points and of its first build. */
export function airfoilFirstUseSeconds(points) {
  return COST.airfoilFirstUse.s * points;
}

/** Expected time (s), peak memory (MB) and file size (MB) of a mesh export. */
/** Time, memory and file size of an export of n triangles (STL, 3MF) or n control points (STEP). */
export function exportCost(triangles, format) {
  const c = EXPORT[format] ?? EXPORT.stl;
  return { seconds: c.s * triangles, megabytes: COST.base.mb + c.mb * triangles, fileMB: c.fileMB * triangles };
}

/** "about 3 s", "under 1 s", "about 40 s". */
export function formatSeconds(s) {
  if (s < 1) return tr('under 1 s');
  return tr('about {n} s', { n: plain(s < 10 ? Math.round(s * 2) / 2 : Math.round(s)) });
}

/** "about 250 MB", "about 1.2 GB" (two significant digits). */
export function formatMegabytes(mb) {
  // Rounded before the unit is chosen: 996 MB reads "about 1 GB", not "about 1000 MB".
  const v = Number(Math.max(mb, 1).toPrecision(2));
  if (v >= 1000) return tr('about {n} GB', { n: plain(Number((v / 1000).toPrecision(2))) });
  return tr('about {n} MB', { n: plain(v) });
}

/** Time and memory of one change: "each change takes about 3 s and about 250 MB of browser memory". */
export function costPhrase(size) {
  const c = changeCost(size);
  return tr('each change takes {time} and {memory} of browser memory', { time: formatSeconds(c.seconds), memory: formatMegabytes(c.megabytes) });
}

/** costPhrase as a sentence. */
export function costSentence(size) {
  const c = changeCost(size);
  return tr('Each change takes {time} and {memory} of browser memory.', { time: formatSeconds(c.seconds), memory: formatMegabytes(c.megabytes) });
}

/** Sizes above their WARN thresholds: [{ key, text }]. */
export function largeSizes(size) {
  const out = [];
  const add = (key, limit, text) => {
    if (size[key] > limit) out.push({ key, text: text(count(size[key]), count(limit)) });
  };
  add('sections', WARN.sections, (n, limit) => tr('{n} sections (warning above {limit})', { n, limit }));
  add('airfoils', WARN.airfoils, (n, limit) => tr('{n} airfoils (warning above {limit})', { n, limit }));
  add('largestAirfoil', WARN.pointsPerAirfoil, (n, limit) => tr('an airfoil of {n} points (warning above {limit})', { n, limit }));
  add('airfoilPoints', WARN.airfoilPoints, (n, limit) => tr('{n} airfoil points in all (warning above {limit})', { n, limit }));
  add('guidePoints', WARN.guidePoints, (n, limit) => tr('a guide curve of {n} points (warning above {limit})', { n, limit }));
  add('gridPoints', WARN.gridPoints, (n, limit) => tr('{n} loft grid points (warning above {limit})', { n, limit }));
  add('longestName', WARN.name, (n, limit) => tr('a name of {n} characters (warning above {limit})', { n, limit }));
  return out;
}

/** One warning for sizes above their thresholds, or null. */
export function sizeWarning(project, size = projectSize(project)) {
  const large = largeSizes(size).map((q) => q.text);
  if (!large.length) return null;
  const list = large.length === 1 ? large[0] : tr('{list} and {last}', { list: large.slice(0, -1).join(', '), last: large[large.length - 1] });
  // The first build names its own time when it takes at least 1 s more than a change.
  const first = firstBuildSeconds(size);
  const open = first - changeCost(size).seconds >= 1 ? ` ${tr('Opening it or changing the profile parametrization takes {time}.', { time: formatSeconds(first) })}` : '';
  return `${tr('Large project: {list}.', { list })} ${costSentence(size)}${open}`;
}

/** A name for lists and messages: at most WARN.name characters. */
export function displayName(name) {
  const t = String(name ?? '');
  return t.length > WARN.name ? `${t.slice(0, WARN.name)}…` : t;
}
