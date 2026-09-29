// Pure project edit operations used by the UI (kept free of DOM code so they are testable).

import { defaultGuides } from '../geom/guide.js';
import { newId } from './project.js';

export function sortedSections(project) {
  return project.sections.slice().sort((a, b) => a.y - b.y);
}

/**
 * Keep guide curves spanning exactly from the root to the tip: when the root or tip span position
 * changes, guide point y values are remapped linearly.
 */
/**
 * Span position for a dragged section: strictly between its neighbours (margin 1 mm, or a quarter of
 * the gap when they are closer than 4 mm). The root section (index 0) keeps its y.
 */
export function clampSectionY(sorted, i, y) {
  if (i <= 0) return sorted[0].y;
  const prev = sorted[i - 1].y;
  const next = i < sorted.length - 1 ? sorted[i + 1].y : Infinity;
  const m = Math.min(1, (next - prev) / 4);
  return Math.min(Math.max(y, prev + m), next - m);
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
    g.points = g.points.map(([x, y]) => [x, b > a ? y0 + ((y - a) / (b - a)) * (y1 - y0) : y0]);
  }
  return project;
}

/** Insert a section halfway between section index i and i+1 (sorted order), or beyond the tip. */
export function insertSection(project, afterIndex) {
  const s = sortedSections(project);
  const a = s[Math.min(afterIndex, s.length - 1)];
  const b = s[afterIndex + 1];
  let sec;
  if (b) {
    sec = {
      id: newId('s'),
      airfoil: a.airfoil,
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
      z: (a.z + b.z) / 2,
      chord: (a.chord + b.chord) / 2,
      twist: (a.twist + b.twist) / 2,
    };
  } else {
    const prev = s[s.length - 2];
    const dy = prev ? a.y - prev.y : 100;
    sec = { id: newId('s'), airfoil: a.airfoil, x: a.x, y: a.y + Math.max(dy, 10), z: a.z, chord: a.chord, twist: a.twist };
  }
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
    } else if (!g.enabled) {
      g.points = d[key].points;
    }
  }
  return project;
}

/** Replace a guide's points with the section edges. */
export function resetGuide(project, key) {
  const d = defaultGuides(project.sections);
  project.guides[key].points = d[key].points;
  return project;
}

/** Insert a guide point in the widest span gap (x interpolated linearly). */
export function addGuidePoint(project, key) {
  const pts = project.guides[key].points;
  let best = 0;
  for (let i = 1; i < pts.length - 1; i++) if (pts[i + 1][1] - pts[i][1] > pts[best + 1][1] - pts[best][1]) best = i;
  const a = pts[best];
  const b = pts[best + 1];
  pts.splice(best + 1, 0, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
  return best + 1;
}

export function removeGuidePoint(project, key, index) {
  const pts = project.guides[key].points;
  if (pts.length <= 2 || index <= 0 || index >= pts.length - 1) return false;
  pts.splice(index, 1);
  return true;
}

/**
 * Move a guide point. End points keep their span position; interior points stay strictly
 * between their neighbours (margin 0.5 mm, or a quarter of the gap when the neighbours are closer
 * than 2 mm).
 */
export function moveGuidePoint(project, key, index, x, y) {
  const pts = project.guides[key].points;
  const last = pts.length - 1;
  if (index === 0 || index === last) {
    pts[index] = [x, pts[index][1]];
    return;
  }
  const prev = pts[index - 1][1];
  const next = pts[index + 1][1];
  const m = Math.min(0.5, (next - prev) / 4);
  pts[index] = [x, Math.min(Math.max(y, prev + m), next - m)];
}

/** Remove airfoils that no section uses. Returns the number removed. */
export function pruneAirfoils(project) {
  const used = new Set(project.sections.map((s) => s.airfoil));
  const before = project.airfoils.length;
  project.airfoils = project.airfoils.filter((a) => used.has(a.id));
  return before - project.airfoils.length;
}

/** Add an airfoil unless an identical one (same name and points) exists; returns its id. */
export function addAirfoil(project, airfoil) {
  const same = project.airfoils.find(
    (a) => a.name === airfoil.name && a.points.length === airfoil.points.length && a.points.every((p, i) => p[0] === airfoil.points[i][0] && p[1] === airfoil.points[i][1]),
  );
  if (same) return same.id;
  const base = slug(airfoil.name) || 'airfoil';
  let id = base;
  let k = 2;
  while (project.airfoils.some((a) => a.id === id)) id = `${base}-${k++}`;
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
