// Sanity checks for airfoil point lists in Selig order.
// Severity: 'error' blocks use in a wing, 'warning' allows use, 'info' reports facts.

import { airfoilStats, bounds, leadingEdgeIndex, normalize, selfIntersections, splitSurfaces } from './geometry.js';
import { MAX_POINTS, parseDat } from './parse.js';
import { WARN, airfoilFirstUseSeconds, formatSeconds } from '../model/budget.js';
import { count, fixed, plain, tr, whole } from '../i18n/index.js';

export const LIMITS = {
  minPoints: 5,
  maxPoints: MAX_POINTS,
  coarsePoints: 20,
  normTolerance: 0.02,
  teGapWarn: 0.02,
  thinWarn: 0.01,
  thickWarn: 0.3,
  spikeDeg: 90,
  // Interior thickness (1 % to 99 % chord) at or below this fraction of the chord is a contact.
  touchThickness: 1e-5,
  maxOutlineLength: 10,
  // Points per surface where x decreases: accepted real airfoils have up to 13 (a slat of a
  // multi-element section; 1,915 of 1,927 files have none).
  maxFolds: 50,
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
/** Consecutive points closer than this fraction of the x range count as duplicates. */
export const DUPLICATE_DISTANCE = 1e-9;

export function checkAirfoil(rawPointsIn) {
  const issues = [];
  // Consecutive points closer than DUPLICATE_DISTANCE of the x range make the interpolation matrix
  // singular (their parameters round to the same value); remove them for every source (the file
  // parser removes exact duplicates, project JSON and pasted data may not).
  let rawPoints = rawPointsIn;
  if (Array.isArray(rawPointsIn) && rawPointsIn.length > 1 && rawPointsIn.length <= LIMITS.maxPoints) {
    let x0 = Infinity;
    let x1 = -Infinity;
    for (const p of rawPointsIn) {
      x0 = Math.min(x0, p[0]);
      x1 = Math.max(x1, p[0]);
    }
    const tol = DUPLICATE_DISTANCE * (x1 - x0);
    rawPoints = [rawPointsIn[0]];
    for (let i = 1; i < rawPointsIn.length; i++) {
      const q = rawPoints[rawPoints.length - 1];
      const p = rawPointsIn[i];
      if (!(Math.hypot(p[0] - q[0], p[1] - q[1]) <= tol)) rawPoints.push(p);
    }
    const removed = rawPointsIn.length - rawPoints.length;
    if (removed) issues.push(
        issue('info', 'duplicates', tr('{n} consecutive point(s) closer than {distance} chord to the previous point removed.', { n: whole(removed), distance: plain(DUPLICATE_DISTANCE) })),
      );
  }
  if (!rawPoints || rawPoints.length < LIMITS.minPoints) {
    issues.push(issue('error', 'too-few-points', tr('At least {min} points are required (found {found}).', { min: plain(LIMITS.minPoints), found: plain(rawPoints ? rawPoints.length : 0) })));
    return { ok: false, points: rawPoints ?? [], issues, stats: null };
  }
  if (rawPoints.length > LIMITS.maxPoints) {
    issues.push(issue('error', 'too-many-points', tr('{n} points; the limit is {limit}.', { n: count(rawPoints.length), limit: count(LIMITS.maxPoints) })));
    return { ok: false, points: rawPoints, issues, stats: null };
  }
  if (rawPoints.length > WARN.pointsPerAirfoil) {
    const n = rawPoints.length;
    issues.push(
      issue(
        'warning',
        'many-points',
        tr('{n} points (warning above {limit}): the checks and the first build of a wing that uses the airfoil take {time}.', {
          n: count(n),
          limit: count(WARN.pointsPerAirfoil),
          time: formatSeconds(airfoilFirstUseSeconds(n)),
        }),
      ),
    );
  }
  if (rawPoints.length < LIMITS.coarsePoints) {
    issues.push(issue('warning', 'coarse', tr('Only {n} points; the NURBS interpolation may not match the intended shape.', { n: plain(rawPoints.length) })));
  }

  const b = bounds(rawPoints);
  const chord = b.xmax - b.xmin;
  if (!(chord > 0)) {
    issues.push(issue('error', 'zero-chord', tr('All points share the same x coordinate.')));
    return { ok: false, points: rawPoints, issues, stats: null };
  }
  const leIdx = leadingEdgeIndex(rawPoints);
  if (Math.abs(b.xmin) > LIMITS.normTolerance || Math.abs(b.xmax - 1) > LIMITS.normTolerance) {
    issues.push(
      issue('warning', 'not-normalized', tr('x spans {from} to {to}; coordinates are scaled to unit chord.', { from: fixed(b.xmin, 4), to: fixed(b.xmax, 4) })),
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
        tr("The line from the leading edge to the trailing edge is inclined by {angle} degrees; the coordinates are kept, so twist refers to the file's x axis.", { angle: fixed(incl, 2) }),
        leIdx,
      ),
    );
  }
  // Both ends of the outline lie at the trailing edge (within 5 % of the chord of the largest x):
  // a surface that stops short would give a trailing-edge face across the chord.
  const endX = Math.min(rawPoints[0][0], rawPoints[n0 - 1][0]);
  if (endX < b.xmax - 0.05 * chord) {
    const pos = fixed(((endX - b.xmin) / chord) * 100, 1);
    issues.push(
      issue(
        'error',
        'te-missing',
        rawPoints[0][0] <= rawPoints[n0 - 1][0]
          ? tr('The first point lies at {pos} % chord, not at the trailing edge; the point order is probably not Selig, or a surface is incomplete.', { pos })
          : tr('The last point lies at {pos} % chord, not at the trailing edge; the point order is probably not Selig, or a surface is incomplete.', { pos }),
      ),
    );
  }
  const points = normalize(rawPoints);

  // An airfoil outline is about 2 chords long; much longer outlines (zigzags, spirals) are not
  // airfoils and would make the crossing test slow.
  let outline = 0;
  for (let i = 1; i < points.length; i++) outline += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  if (outline > LIMITS.maxOutlineLength) {
    issues.push(issue('error', 'outline-length', tr('The outline is {length} chords long; an airfoil outline is about 2 chords long.', { length: fixed(outline, 1) })));
    return { ok: false, points, issues, stats: null };
  }

  // A surface that runs back in x at many points (zigzags) is not an airfoil, and the thickness
  // envelope then compares every x with every backward run. Strict decreases, the comparison of the
  // envelope search.
  const folds = (surface) => {
    let c = 0;
    for (let i = 1; i < surface.length; i++) if (surface[i][0] < surface[i - 1][0]) c++;
    return c;
  };
  const halves = splitSurfaces(points);
  const fu = folds(halves.upper);
  const fl = folds(halves.lower);
  if (fu > LIMITS.maxFolds || fl > LIMITS.maxFolds) {
    const params = { n: whole(Math.max(fu, fl)), limit: plain(LIMITS.maxFolds) };
    issues.push(
      issue(
        'error',
        'folds',
        fu >= fl ? tr('The upper surface runs back in x at {n} points; the limit is {limit}.', params) : tr('The lower surface runs back in x at {n} points; the limit is {limit}.', params),
      ),
    );
    return { ok: false, points, issues, stats: null };
  }

  const hits = selfIntersections(points);
  if (hits.length) {
    issues.push(issue('error', 'self-intersection', tr('The outline crosses itself ({n} crossing(s)).', { n: plain(hits.length) + (hits.length >= 10 ? '+' : '') }), hits[0][0]));
  }

  const { upper, lower } = splitSurfaces(points);
  if (upper.length < 3 || lower.length < 3) {
    issues.push(issue('error', 'one-surface', tr('Upper or lower surface has fewer than 3 points; the point order is probably not Selig or Lednicer.')));
    return { ok: false, points, issues, stats: null };
  }
  const ru = reversals(upper);
  const rl = reversals(lower);
  if (ru.count || rl.count) {
    issues.push(
      issue(
        'warning',
        'non-monotonic',
        tr('x does not increase monotonically from LE to TE (upper: {upper}, lower: {lower} reversal(s)).', { upper: whole(ru.count), lower: whole(rl.count) }),
      ),
    );
  }

  const stats = airfoilStats(points);
  if (stats.minInteriorThickness < -1e-4) {
    issues.push(issue('error', 'crossed-surfaces', tr('The upper surface lies below the lower surface at some chord position.')));
  } else if (stats.minCoreThickness <= LIMITS.touchThickness) {
    issues.push(
      issue(
        'error',
        'surfaces-touch',
        tr('Upper and lower surface touch at x = {x} % chord (thickness {thickness} % chord); the wing would have zero thickness there.', {
          x: fixed(stats.minCoreThicknessX * 100, 1),
          thickness: fixed(stats.minCoreThickness * 100, 4),
        }),
      ),
    );
  }
  if (stats.teGap < -1e-4) {
    issues.push(issue('error', 'te-crossed', tr('Trailing edge is crossed (gap {gap} % chord).', { gap: fixed(stats.teGap * 100, 3) })));
  } else if (stats.teGap > LIMITS.teGapWarn) {
    issues.push(issue('warning', 'te-gap', tr('Trailing-edge gap is {gap} % chord.', { gap: fixed(stats.teGap * 100, 2) })));
  }
  // A closed TE reached over a steep end segment: the drawn TE base was probably read as surface.
  const nP = points.length;
  const steepEnd = (p, q) => 1 - q[0] <= 0.01 && Math.abs(q[0] - p[0]) <= 0.2 * Math.abs(q[1] - p[1]) && Math.abs(q[1] - p[1]) > 1e-6;
  if (Math.abs(stats.teGap) < 1e-6 && (steepEnd(points[1], points[0]) || steepEnd(points[nP - 2], points[nP - 1]))) {
    issues.push(
      issue('warning', 'te-base', tr('The outline reaches the trailing edge over a vertical segment; the trailing-edge base is probably read as surface points.'), 0),
    );
  }
  if (stats.maxThickness < LIMITS.thinWarn) {
    issues.push(issue('warning', 'thin', tr('Maximum thickness is {thickness} % chord.', { thickness: fixed(stats.maxThickness * 100, 2) })));
  } else if (stats.maxThickness > LIMITS.thickWarn) {
    issues.push(issue('warning', 'thick', tr('Maximum thickness is {thickness} % chord.', { thickness: fixed(stats.maxThickness * 100, 1) })));
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
  if (spikes) {
    issues.push(
      issue('warning', 'spike', tr('{n} point(s) turn the outline by more than {angle} degrees.', { n: whole(spikes), angle: plain(LIMITS.spikeDeg) }), firstSpike),
    );
  }

  let ratio = 1;
  for (let i = 1; i < points.length - 1; i++) {
    const a = Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
    const c = Math.hypot(points[i + 1][0] - points[i][0], points[i + 1][1] - points[i][1]);
    if (a > 0 && c > 0) ratio = Math.max(ratio, a / c, c / a);
  }
  if (ratio > LIMITS.spacingRatio) {
    issues.push(issue('info', 'uneven-spacing', tr('Adjacent segment lengths differ by a factor of up to {factor}.', { factor: fixed(ratio, 0) })));
  }

  issues.push(
    issue(
      'info',
      'stats',
      tr('{n} points, t/c {thickness} % at {thicknessX} %, camber {camber} % at {camberX} %, TE gap {gap} %.', {
        n: whole(points.length),
        thickness: fixed(stats.maxThickness * 100, 2),
        thicknessX: fixed(stats.maxThicknessX * 100, 1),
        camber: fixed(stats.maxCamber * 100, 2),
        camberX: fixed(stats.maxCamberX * 100, 1),
        gap: fixed(stats.teGap * 100, 3),
      }),
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
