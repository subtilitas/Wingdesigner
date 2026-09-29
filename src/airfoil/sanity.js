// Sanity checks for airfoil point lists in Selig order.
// Severity: 'error' blocks use in a wing, 'warning' allows use, 'info' reports facts.

import { airfoilStats, bounds, leadingEdgeIndex, normalize, selfIntersections, splitSurfaces } from './geometry.js';
import { MAX_POINTS, parseDat } from './parse.js';

export const LIMITS = {
  minPoints: 5,
  maxPoints: MAX_POINTS,
  coarsePoints: 20,
  normTolerance: 0.02,
  teGapWarn: 0.02,
  thinWarn: 0.01,
  thickWarn: 0.3,
  spikeDeg: 90,
  spacingRatio: 25,
  rotationDeg: 0.5,
};

function issue(severity, code, message, where) {
  return where === undefined ? { severity, code, message } : { severity, code, message, where };
}

function turnAngleDeg(a, b, c) {
  const ux = b[0] - a[0];
  const uy = b[1] - a[1];
  const vx = c[0] - b[0];
  const vy = c[1] - b[1];
  const lu = Math.hypot(ux, uy);
  const lv = Math.hypot(vx, vy);
  if (lu === 0 || lv === 0) return 0;
  const cos = Math.min(1, Math.max(-1, (ux * vx + uy * vy) / (lu * lv)));
  return (Math.acos(cos) * 180) / Math.PI;
}

function reversals(surface) {
  let count = 0;
  let first = -1;
  for (let i = 1; i < surface.length; i++) {
    if (surface[i][0] < surface[i - 1][0] - 1e-6) {
      count++;
      if (first < 0) first = i;
    }
  }
  return { count, first };
}

/**
 * Check a point list (Selig order, any scale). Returns normalized points and issues.
 * @returns {{ok: boolean, points: number[][], issues: object[], stats: object|null}}
 */
export function checkAirfoil(rawPointsIn) {
  const issues = [];
  // Consecutive duplicates make the interpolation matrix singular; remove them for every source
  // (the file parser already does, project JSON and pasted data may not).
  let rawPoints = rawPointsIn;
  if (Array.isArray(rawPointsIn) && rawPointsIn.length > 1) {
    rawPoints = rawPointsIn.filter((p, i) => i === 0 || p[0] !== rawPointsIn[i - 1][0] || p[1] !== rawPointsIn[i - 1][1]);
    const removed = rawPointsIn.length - rawPoints.length;
    if (removed) issues.push(issue('info', 'duplicates', `${removed} duplicate consecutive point(s) removed.`));
  }
  if (!rawPoints || rawPoints.length < LIMITS.minPoints) {
    issues.push(issue('error', 'too-few-points', `At least ${LIMITS.minPoints} points are required (found ${rawPoints ? rawPoints.length : 0}).`));
    return { ok: false, points: rawPoints ?? [], issues, stats: null };
  }
  if (rawPoints.length > LIMITS.maxPoints) {
    issues.push(issue('error', 'too-many-points', `${rawPoints.length} points; the limit is ${LIMITS.maxPoints}.`));
    return { ok: false, points: rawPoints, issues, stats: null };
  }
  if (rawPoints.length < LIMITS.coarsePoints) {
    issues.push(issue('warning', 'coarse', `Only ${rawPoints.length} points; the NURBS interpolation may not match the intended shape.`));
  }

  const b = bounds(rawPoints);
  const chord = b.xmax - b.xmin;
  if (!(chord > 0)) {
    issues.push(issue('error', 'zero-chord', 'All points share the same x coordinate.'));
    return { ok: false, points: rawPoints, issues, stats: null };
  }
  const leIdx = leadingEdgeIndex(rawPoints);
  if (Math.abs(b.xmin) > LIMITS.normTolerance || Math.abs(b.xmax - 1) > LIMITS.normTolerance) {
    issues.push(
      issue('warning', 'not-normalized', `x spans ${b.xmin.toFixed(4)} to ${b.xmax.toFixed(4)}; coordinates are scaled to unit chord.`),
    );
  }
  const n0 = rawPoints.length;
  const teMid = [(rawPoints[0][0] + rawPoints[n0 - 1][0]) / 2, (rawPoints[0][1] + rawPoints[n0 - 1][1]) / 2];
  const incl = (Math.atan2(teMid[1] - rawPoints[leIdx][1], teMid[0] - rawPoints[leIdx][0]) * 180) / Math.PI;
  const rotated = Math.abs(incl) > LIMITS.rotationDeg;
  if (rotated) {
    issues.push(
      issue(
        'warning',
        'rotated',
        `The line from the leading edge to the trailing edge is inclined by ${incl.toFixed(2)} degrees; the coordinates are kept, so twist refers to the file's x axis.`,
        leIdx,
      ),
    );
  }
  if (Math.max(rawPoints[0][0], rawPoints[n0 - 1][0]) < b.xmax - 0.05 * chord) {
    issues.push(issue('error', 'te-missing', 'The first and last points are not at the trailing edge; the point order is probably not Selig.'));
  }
  const points = normalize(rawPoints);

  const hits = selfIntersections(points);
  if (hits.length) {
    issues.push(issue('error', 'self-intersection', `The outline crosses itself (${hits.length}${hits.length >= 10 ? '+' : ''} crossing(s)).`, hits[0][0]));
  }

  const { upper, lower } = splitSurfaces(points);
  if (upper.length < 3 || lower.length < 3) {
    issues.push(issue('error', 'one-surface', 'Upper or lower surface has fewer than 3 points; the point order is probably not Selig or Lednicer.'));
    return { ok: false, points, issues, stats: null };
  }
  const ru = reversals(upper);
  const rl = reversals(lower);
  if (ru.count || rl.count) {
    issues.push(
      issue('warning', 'non-monotonic', `x does not increase monotonically from LE to TE (upper: ${ru.count}, lower: ${rl.count} reversal(s)).`),
    );
  }

  const stats = airfoilStats(points);
  if (stats.minInteriorThickness < -1e-4) {
    issues.push(issue('error', 'crossed-surfaces', 'The upper surface lies below the lower surface at some chord position.'));
  }
  if (stats.teGap < -1e-4) {
    issues.push(issue('error', 'te-crossed', `Trailing edge is crossed (gap ${(stats.teGap * 100).toFixed(3)} % chord).`));
  } else if (stats.teGap > LIMITS.teGapWarn) {
    issues.push(issue('warning', 'te-gap', `Trailing-edge gap is ${(stats.teGap * 100).toFixed(2)} % chord.`));
  }
  // A closed TE reached over a steep end segment: the drawn TE base was probably read as surface.
  const nP = points.length;
  const steepEnd = (p, q) => 1 - q[0] <= 0.01 && Math.abs(q[0] - p[0]) <= 0.2 * Math.abs(q[1] - p[1]) && Math.abs(q[1] - p[1]) > 1e-6;
  if (Math.abs(stats.teGap) < 1e-6 && (steepEnd(points[1], points[0]) || steepEnd(points[nP - 2], points[nP - 1]))) {
    issues.push(issue('warning', 'te-base', 'The outline reaches the trailing edge over a vertical segment; the trailing-edge base is probably read as surface points.', 0));
  }
  if (stats.maxThickness < LIMITS.thinWarn) {
    issues.push(issue('warning', 'thin', `Maximum thickness is ${(stats.maxThickness * 100).toFixed(2)} % chord.`));
  } else if (stats.maxThickness > LIMITS.thickWarn) {
    issues.push(issue('warning', 'thick', `Maximum thickness is ${(stats.maxThickness * 100).toFixed(1)} % chord.`));
  }
  const le = leadingEdgeIndex(points);
  let spikes = 0;
  let firstSpike = -1;
  for (let i = 1; i < points.length - 1; i++) {
    if (Math.abs(i - le) <= 2) continue;
    if (turnAngleDeg(points[i - 1], points[i], points[i + 1]) > LIMITS.spikeDeg) {
      spikes++;
      if (firstSpike < 0) firstSpike = i;
    }
  }
  if (spikes) issues.push(issue('warning', 'spike', `${spikes} point(s) turn the outline by more than ${LIMITS.spikeDeg} degrees.`, firstSpike));

  let ratio = 1;
  for (let i = 1; i < points.length - 1; i++) {
    const a = Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
    const c = Math.hypot(points[i + 1][0] - points[i][0], points[i + 1][1] - points[i][1]);
    if (a > 0 && c > 0) ratio = Math.max(ratio, a / c, c / a);
  }
  if (ratio > LIMITS.spacingRatio) {
    issues.push(issue('info', 'uneven-spacing', `Adjacent segment lengths differ by a factor of up to ${ratio.toFixed(0)}.`));
  }

  issues.push(
    issue(
      'info',
      'stats',
      `${points.length} points, t/c ${(stats.maxThickness * 100).toFixed(2)} % at ${(stats.maxThicknessX * 100).toFixed(1)} %, ` +
        `camber ${(stats.maxCamber * 100).toFixed(2)} % at ${(stats.maxCamberX * 100).toFixed(1)} %, TE gap ${(stats.teGap * 100).toFixed(3)} %.`,
    ),
  );
  return { ok: !issues.some((i) => i.severity === 'error'), points, issues, stats };
}

/** Parse and check an airfoil file in one step. */
export function importAirfoilText(text, fileName) {
  const parsed = parseDat(text, { fileName });
  if (parsed.issues.some((i) => i.severity === 'error')) {
    return { ok: false, name: parsed.name, format: parsed.format, points: parsed.points, issues: parsed.issues, stats: null };
  }
  const checked = checkAirfoil(parsed.points);
  return {
    ok: checked.ok,
    name: parsed.name,
    format: parsed.format,
    points: checked.points,
    issues: [...parsed.issues, ...checked.issues],
    stats: checked.stats,
  };
}
