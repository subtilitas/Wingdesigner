// Pure project edit operations used by the UI (kept free of DOM code so they are testable).

import { defaultGuides, guideXAt } from '../geom/guide.js';
import { paramsApart } from '../geom/nurbs.js';
import { LIMITS, airfoilPoints, newId } from './project.js';
import { nacaAirfoil } from '../airfoil/naca.js';
import { count, plain, tr, whole } from '../i18n/index.js';

export function sortedSections(project) {
  return project.sections.slice().sort((a, b) => a.y - b.y);
}

/**
 * True when span positions a < b of a wing from y0 to y1 map to distinct surface parameters, the
 * test the build applies to sections (paramsApart on the span fractions).
 */
function spanApart(a, b, y0, y1) {
  return paramsApart((a - y0) / (y1 - y0), (b - y0) / (y1 - y0));
}

/**
 * Keep guide curves spanning exactly from the root to the tip: when the root or tip span position
 * changes, guide point y values are remapped linearly.
 */
/**
 * Span position for a dragged section: strictly between its neighbours (margin 1 mm, or a quarter of
 * the gap when they are closer than 4 mm), the tip at most LIMITS.maxCoordinate. The root section
 * (index 0) keeps its y; so does a section whose neighbours leave no number strictly between them.
 */
export function clampSectionY(sorted, i, y) {
  if (i <= 0) return sorted[0].y;
  const prev = sorted[i - 1].y;
  const next = i < sorted.length - 1 ? sorted[i + 1].y : Infinity;
  const m = Math.min(1, (next - prev) / 4);
  const v = Math.min(Math.max(y, prev + m), next - m, LIMITS.maxCoordinate);
  // The span fractions must stay distinct for the build, also next to a close neighbour.
  const last = sorted.length - 1;
  const y1 = i === last ? v : sorted[last].y;
  const apart = spanApart(prev, v, sorted[0].y, y1) && (i === last ? closePair(sorted, sorted[0].y, v, last) < 0 : spanApart(v, next, sorted[0].y, y1));
  return v > prev && v < next && apart ? v : sorted[i].y;
}

/**
 * Index k of the first adjacent pair sorted[k - 1], sorted[k] (k < end) whose span fractions over a
 * wing from y0 to y1 fall together, or -1. A new tip rescales every span fraction.
 */
function closePair(sorted, y0, y1, end = sorted.length) {
  for (let k = 1; k < end; k++) if (!spanApart(sorted[k - 1].y, sorted[k].y, y0, y1)) return k;
  return -1;
}

const clampCoordinate = (v, limit = LIMITS.maxCoordinate) => Math.min(Math.max(v, -limit), limit);

/** Chord from a dragged trailing-edge x and the leading-edge x, within LIMITS.minChord..maxChord. */
export function chordFromTrailingEdge(x, xLE) {
  return Math.min(Math.max(x - xLE, LIMITS.minChord), LIMITS.maxChord);
}

/**
 * Leading-edge handle drag of section `id` to (x, y): the section moves to the clamped y first; with
 * the end line enabled (`endCurve`: its built NURBS curve), the chord runs from x to the end line at
 * the new y, so the rebuilt leading edge lands at x. The guide spans root to tip, so moving the root
 * or tip section moves that range.
 */
export function dragLeadingEdge(project, id, x, y, endCurve = null) {
  const s = project.sections.find((q) => q.id === id);
  if (!s) return;
  const sorted = sortedSections(project);
  const newY = clampSectionY(sorted, sorted.indexOf(s), y);
  let te = s.x + s.chord;
  if (project.guides?.end?.enabled && endCurve) {
    const ys = sorted.map((q) => (q === s ? newY : q.y));
    te = guideXAt(endCurve, newY, Math.min(...ys), Math.max(...ys));
  }
  // Leading edge within the coordinate limit and LIMITS.minChord..maxChord ahead of the trailing
  // edge; the chord stays within its limits also when the trailing edge lies at the coordinate limit.
  s.x = clampCoordinate(Math.min(Math.max(x, te - LIMITS.maxChord), te - LIMITS.minChord));
  s.chord = Math.min(Math.max(te - s.x, LIMITS.minChord), LIMITS.maxChord);
  s.y = newY;
}

export function syncGuidesToSpan(project) {
  const s = sortedSections(project);
  if (s.length < 2 || !project.guides) return project;
  const y0 = s[0].y;
  const y1 = s[s.length - 1].y;
  for (const key of ['nose', 'end']) {
    const g = project.guides[key];
    if (!g || !g.points || g.points.length < 2) continue;
    const a = g.points[0][1];
    const b = g.points[g.points.length - 1][1];
    if (a === y0 && b === y1) continue;
    const mapped = g.points.map(([x, y]) => [x, b > a ? y0 + ((y - a) / (b - a)) * (y1 - y0) : y0]);
    // A span too narrow for distinct numbers would merge points; the guide then keeps its y values
    // (the build stretches them onto the span anyway).
    const ordered = (pts) => pts.every((q, i) => i === 0 || q[1] > pts[i - 1][1]);
    if (ordered(mapped) || !ordered(g.points)) g.points = mapped;
  }
  return project;
}

/** Section inserted after sorted index afterIndex: halfway to the next one, or beyond the tip. */
function nextSection(project, afterIndex) {
  const s = sortedSections(project);
  const a = s[Math.min(afterIndex, s.length - 1)];
  const b = s[afterIndex + 1];
  if (b) {
    return {
      a,
      b,
      sec: {
        airfoil: a.airfoil,
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2,
        z: (a.z + b.z) / 2,
        chord: (a.chord + b.chord) / 2,
        twist: (a.twist + b.twist) / 2,
      },
    };
  }
  const prev = s[s.length - 2];
  const dy = prev ? a.y - prev.y : 100;
  return { a, sec: { airfoil: a.airfoil, x: a.x, y: a.y + Math.max(dy, 10), z: a.z, chord: a.chord, twist: a.twist } };
}

/** Why no section can be inserted after sorted index afterIndex, or null when one can. */
export function insertProblem(project, afterIndex) {
  if (project.sections.length >= LIMITS.maxSections) return tr('At most {max} sections.', { max: count(LIMITS.maxSections) });
  const { a, b, sec } = nextSection(project, afterIndex);
  // Neighbouring span positions can be too close for a number between them, or for one whose span
  // fraction the build keeps apart from both.
  const sorted = sortedSections(project);
  const [y0, y1] = [sorted[0].y, sorted[sorted.length - 1].y];
  if (b && !(sec.y > a.y && sec.y < b.y && spanApart(a.y, sec.y, y0, y1) && spanApart(sec.y, b.y, y0, y1))) return tr('No span position lies between y = {a} mm and y = {b} mm. Move the two sections apart first.', { a: plain(a.y), b: plain(b.y) });
  if (!b && sec.y > LIMITS.maxCoordinate) return tr('A section beyond the tip would lie beyond y = {max} mm.', { max: whole(LIMITS.maxCoordinate) });
  const k = b ? -1 : closePair(sorted, y0, sec.y);
  if (k > 0) {
    return tr('A section at y = {y} mm beyond the tip makes the span too long for the sections at y = {a} mm and y = {b} mm. Move the two sections apart first.', {
      y: plain(sec.y),
      a: plain(sorted[k - 1].y),
      b: plain(sorted[k].y),
    });
  }
  return null;
}

/**
 * Insert a section halfway between section index i and i+1 (sorted order), or beyond the tip.
 * Returns null when insertProblem reports a reason.
 */
export function insertSection(project, afterIndex) {
  if (insertProblem(project, afterIndex)) return null;
  const sec = { id: newId('s'), ...nextSection(project, afterIndex).sec };
  project.sections.push(sec);
  project.sections.sort((p, q) => p.y - q.y);
  // New sections extend the guides through their points only when guides are disabled.
  resetDisabledGuides(project);
  syncGuidesToSpan(project);
  return sec;
}

export function removeSection(project, id) {
  if (project.sections.length <= 2) return false;
  project.sections = project.sections.filter((s) => s.id !== id);
  resetDisabledGuides(project);
  syncGuidesToSpan(project);
  return true;
}

/** Guides that are switched off follow the sections; switched-on guides keep the user's edits. */
export function resetDisabledGuides(project) {
  const d = defaultGuides(project.sections);
  for (const key of ['nose', 'end']) {
    const g = project.guides?.[key];
    if (!g) {
      project.guides = { ...(project.guides ?? {}), [key]: d[key] };
    } else if (!g.enabled && !g.edited) {
      // A disabled guide nobody edited follows the section edges; edited points are kept.
      g.points = d[key].points;
    }
  }
  return project;
}

/** Replace a guide's points with the section edges. */
export function resetGuide(project, key) {
  const d = defaultGuides(project.sections);
  project.guides[key].points = d[key].points;
  project.guides[key].edited = false;
  return project;
}

/** Turn a guide on or off. Turning it on keeps edited points; otherwise it starts at the section edges. */
export function setGuideEnabled(project, key, on) {
  const g = project.guides[key];
  g.enabled = on;
  if (on && !g.edited) resetGuide(project, key);
  return project;
}

/** Insert a guide point in the widest span gap (x interpolated linearly). */
export function addGuidePoint(project, key) {
  const pts = project.guides[key].points;
  if (pts.length >= LIMITS.maxGuidePoints) return -1;
  let best = 0;
  for (let i = 1; i < pts.length - 1; i++) if (pts[i + 1][1] - pts[i][1] > pts[best + 1][1] - pts[best][1]) best = i;
  const a = pts[best];
  const b = pts[best + 1];
  const y = (a[1] + b[1]) / 2;
  // Even the widest gap can be too narrow for a number strictly between its ends.
  if (!(y > a[1] && y < b[1])) return -1;
  project.guides[key].edited = true;
  pts.splice(best + 1, 0, [(a[0] + b[0]) / 2, y]);
  return best + 1;
}

export function removeGuidePoint(project, key, index) {
  const pts = project.guides[key].points;
  if (pts.length <= 2 || index <= 0 || index >= pts.length - 1) return false;
  pts.splice(index, 1);
  project.guides[key].edited = true;
  return true;
}

/**
 * Move a guide point. End points keep their span position; interior points stay strictly
 * between their neighbours (margin 0.5 mm, or a quarter of the gap when the neighbours are closer
 * than 2 mm), or keep their y when no number lies strictly between; x stays within
 * LIMITS.maxGuideCoordinate.
 */
export function moveGuidePoint(project, key, index, xIn, y) {
  const pts = project.guides[key].points;
  project.guides[key].edited = true;
  const x = clampCoordinate(xIn, LIMITS.maxGuideCoordinate);
  const last = pts.length - 1;
  if (index === 0 || index === last) {
    pts[index] = [x, pts[index][1]];
    return;
  }
  const prev = pts[index - 1][1];
  const next = pts[index + 1][1];
  const m = Math.min(0.5, (next - prev) / 4);
  const v = Math.min(Math.max(y, prev + m), next - m);
  // Neighbours without a number strictly between the clamped bounds, or without one whose
  // normalized y stays apart from theirs (the check of through-point guides), keep the point's y.
  const apart = spanApart(prev, v, pts[0][1], pts[last][1]) && spanApart(v, next, pts[0][1], pts[last][1]);
  pts[index] = [x, v > prev && v < next && apart ? v : pts[index][1]];
}

/** Remove airfoils that no section uses. Returns the number removed. */
export function pruneAirfoils(project) {
  const used = new Set(project.sections.map((s) => s.airfoil));
  const before = project.airfoils.length;
  project.airfoils = project.airfoils.filter((a) => used.has(a.id));
  return before - project.airfoils.length;
}

/**
 * Add an airfoil unless the project holds the same one (same name and points, or the same generated
 * NACA section whose stored points match its designation). Returns its id, or null when the project already holds LIMITS.maxAirfoils airfoils or
 * the airfoil would take the points of all airfoils beyond LIMITS.maxAirfoilPoints.
 */
export function addAirfoil(project, airfoil) {
  const samePoints = (a) => a.points.length === airfoil.points.length && a.points.every((p, i) => p[0] === airfoil.points[i][0] && p[1] === airfoil.points[i][1]);
  const sameNaca = (a) =>
    a.source?.kind === 'naca' && airfoil.source?.kind === 'naca' && a.source.code !== undefined && a.source.code === airfoil.source.code && a.source.closedTE === airfoil.source.closedTE;
  // NACA metadata of an opened project is not trusted alone: the stored points must be the section
  // the metadata names (within 1e-9).
  const nacaPoints = (a) => {
    try {
      const g = nacaAirfoil(a.source.code, { closedTE: a.source.closedTE === true }).points;
      return g.length === a.points.length && g.every((p, i) => Math.abs(p[0] - a.points[i][0]) <= 1e-9 && Math.abs(p[1] - a.points[i][1]) <= 1e-9);
    } catch {
      return false;
    }
  };
  // A NACA section added through the preview carries the checked points, which differ from the
  // generator's by up to 3.5e-3 for cambered sections: equal stored points confirm it as well.
  const same = project.airfoils.find((a) => (sameNaca(a) && (nacaPoints(a) || samePoints(a))) || (a.name === airfoil.name && samePoints(a)));
  if (same) return same.id;
  if (project.airfoils.length >= LIMITS.maxAirfoils) return null;
  if (airfoilPoints(project) + airfoil.points.length > LIMITS.maxAirfoilPoints) return null;
  const base = slug(airfoil.name) || 'airfoil';
  let id = base;
  let k = 2;
  // A set: a scan per candidate suffix took time quadratic in the same-named airfoils.
  const ids = new Set(project.airfoils.map((a) => a.id));
  while (ids.has(id)) id = `${base}-${k++}`;
  project.airfoils.push({ ...airfoil, id });
  return id;
}

export function slug(s) {
  return String(s)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}
