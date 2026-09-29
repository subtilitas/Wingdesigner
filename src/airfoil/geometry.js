// Polyline-level airfoil geometry: orientation, leading-edge detection, surfaces,
// thickness and camber, normalization and trailing-edge gap adjustment.

/** Shoelace signed area; positive for counterclockwise point order. */
export function signedArea(points) {
  let a = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    a += x1 * y2 - x2 * y1;
  }
  return a / 2;
}

/**
 * Index of the leading-edge point: the point farthest from the trailing-edge midpoint
 * (ties resolved towards minimum x). Works for rotated and unnormalized data.
 */
export function leadingEdgeIndex(points) {
  const n = points.length;
  const te = [(points[0][0] + points[n - 1][0]) / 2, (points[0][1] + points[n - 1][1]) / 2];
  let best = 0;
  let bestD = -1;
  for (let i = 0; i < n; i++) {
    const d = (points[i][0] - te[0]) ** 2 + (points[i][1] - te[1]) ** 2;
    if (d > bestD + 1e-15 || (Math.abs(d - bestD) <= 1e-15 && points[i][0] < points[best][0])) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/** Upper surface LE->TE and lower surface LE->TE (both include the LE point). */
export function splitSurfaces(points) {
  const le = leadingEdgeIndex(points);
  const upper = points.slice(0, le + 1).reverse();
  const lower = points.slice(le);
  return { upper, lower, leIndex: le };
}

/** Linear interpolation of y at x along a polyline sorted by x (clamped). */
export function yAt(poly, x) {
  if (x <= poly[0][0]) return poly[0][1];
  for (let i = 1; i < poly.length; i++) {
    const [x0, y0] = poly[i - 1];
    const [x1, y1] = poly[i];
    if ((x >= x0 && x <= x1) || (x <= x0 && x >= x1)) {
      if (x1 === x0) return y1;
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return poly[poly.length - 1][1];
}

/** yAt for ascending xs: one sweep when x increases along the polyline, else per-point search. */
function yAtAll(poly, xs, pick) {
  for (let i = 1; i < poly.length; i++) if (poly[i][0] < poly[i - 1][0]) return xs.map((x) => envelopeAt(poly, x, pick));
  const out = new Array(xs.length);
  let i = 1;
  for (let k = 0; k < xs.length; k++) {
    const x = xs[k];
    if (x <= poly[0][0]) {
      out[k] = poly[0][1];
      continue;
    }
    while (i < poly.length - 1 && poly[i][0] < x) i++;
    const [x0, y0] = poly[i - 1];
    const [x1, y1] = poly[i];
    let y = x >= x1 ? y1 : x1 === x0 ? y1 : y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    // A vertical segment (repeated x): every vertex at this x counts.
    for (let j = i; j + 1 < poly.length && poly[j + 1][0] === x; j++) y = pick(y, poly[j + 1][1]);
    out[k] = y;
  }
  return out;
}

/** Lowest (pick = Math.min) or highest (Math.max) y at x over every segment of poly that spans x. */
function envelopeAt(poly, x, pick) {
  let best = NaN;
  for (let i = 1; i < poly.length; i++) {
    const [x0, y0] = poly[i - 1];
    const [x1, y1] = poly[i];
    if (x < Math.min(x0, x1) || x > Math.max(x0, x1)) continue;
    const y = x1 === x0 ? pick(y0, y1) : y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    best = Number.isNaN(best) ? y : pick(best, y);
  }
  return Number.isNaN(best) ? yAt(poly, x) : best;
}

/**
 * Thickness and camber statistics of a normalized airfoil (chord 0..1).
 * Returns fractions of chord. Camber is the mean of upper and lower surface at a chord position,
 * measured from the chord line (leading edge to trailing-edge midpoint). For NACA sections this is
 * below the designated camber (4415: 3.74 % instead of 4 %): the designated camber line starts
 * behind the geometric leading edge and the thickness is applied normal to it.
 */
export function airfoilStats(points, samples = 201) {
  const { upper, lower } = splitSurfaces(points);
  const nP = points.length;
  const teX = (points[0][0] + points[nP - 1][0]) / 2;
  const teY = (points[0][1] + points[nP - 1][1]) / 2;
  const chordY = (x) => (teX > 0 ? (teY * x) / teX : 0);
  let maxT = -Infinity;
  let maxTx = 0;
  let maxC = 0;
  let maxCx = 0;
  let minT = Infinity;
  const x0 = Math.max(upper[0][0], lower[0][0]);
  const x1 = Math.min(upper[upper.length - 1][0], lower[lower.length - 1][0]);
  for (let k = 0; k < samples; k++) {
    const x = x0 + ((x1 - x0) * (1 - Math.cos((Math.PI * k) / (samples - 1)))) / 2;
    const yu = yAt(upper, x);
    const yl = yAt(lower, x);
    const t = yu - yl;
    const c = (yu + yl) / 2 - chordY(x);
    if (t > maxT) {
      maxT = t;
      maxTx = x;
    }
    if (k > 0 && k < samples - 1 && t < minT) minT = t;
    if (Math.abs(c) > Math.abs(maxC)) {
      maxC = c;
      maxCx = x;
    }
  }
  // Thickness between the two polylines is smallest at a vertex of either one, so every vertex
  // between 1 % and 99 % of the chord is checked as well (touching surfaces).
  let minCore = Infinity;
  let minCoreX = null;
  const lo = x0 + 0.01 * (x1 - x0);
  const hi = x1 - 0.01 * (x1 - x0);
  const coreXs = [...upper, ...lower].map((p) => p[0]).filter((x) => x >= lo && x <= hi);
  for (let k = 0; k < samples; k++) {
    const x = x0 + ((x1 - x0) * (1 - Math.cos((Math.PI * k) / (samples - 1)))) / 2;
    if (x >= lo && x <= hi) coreXs.push(x);
  }
  coreXs.sort((a, b) => a - b);
  // Lowest point of the upper and highest point of the lower surface at each x: vertical segments
  // and surfaces that fold back in x can touch at more than one y.
  const yu = yAtAll(upper, coreXs, Math.min);
  const yl = yAtAll(lower, coreXs, Math.max);
  for (let k = 0; k < coreXs.length; k++) {
    const t = yu[k] - yl[k];
    if (t < minCore) {
      minCore = t;
      minCoreX = coreXs[k];
    }
  }
  const n = points.length;
  const teGap = points[0][1] - points[n - 1][1];
  return { maxThickness: maxT, maxThicknessX: maxTx, maxCamber: maxC, maxCamberX: maxCx, minInteriorThickness: minT, minCoreThickness: minCore, minCoreThicknessX: minCoreX, teGap };
}

/** Bounding box of a point list. */
export function bounds(points) {
  let xmin = Infinity;
  let xmax = -Infinity;
  let ymin = Infinity;
  let ymax = -Infinity;
  for (const [x, y] of points) {
    if (x < xmin) xmin = x;
    if (x > xmax) xmax = x;
    if (y < ymin) ymin = y;
    if (y > ymax) ymax = y;
  }
  return { xmin, xmax, ymin, ymax };
}

/**
 * Normalize to unit chord: the leading-edge point moves to the origin, the TE midpoint
 * to (1, 0). With derotate=false only translation and uniform scaling along the x extent are applied.
 */
export function normalize(points, { derotate = false } = {}) {
  const le = points[leadingEdgeIndex(points)];
  const n = points.length;
  const te = [(points[0][0] + points[n - 1][0]) / 2, (points[0][1] + points[n - 1][1]) / 2];
  if (derotate) {
    const dx = te[0] - le[0];
    const dy = te[1] - le[1];
    const c = Math.hypot(dx, dy);
    const cos = dx / c;
    const sin = dy / c;
    return points.map(([x, y]) => {
      const px = x - le[0];
      const py = y - le[1];
      return [(px * cos + py * sin) / c, (-px * sin + py * cos) / c];
    });
  }
  const { xmin, xmax } = bounds(points);
  const c = xmax - xmin;
  return points.map(([x, y]) => [(x - xmin) / c, (y - le[1]) / c]);
}

/**
 * Change the trailing-edge gap to `gap` (fraction of chord). The thickness change is blended
 * in with weight x^blendExp so the leading edge stays untouched (XFOIL TGAP style, linear by default).
 */
export function setTrailingEdgeGap(points, gap, { blendExp = 1, leIndex } = {}) {
  const n = points.length;
  const current = points[0][1] - points[n - 1][1];
  const delta = (gap - current) / 2;
  const le = leIndex ?? leadingEdgeIndex(points);
  const xle = points[le][0];
  const xteU = points[0][0];
  const xteL = points[n - 1][0];
  return points.map(([x, y], i) => {
    const upper = i <= le;
    const span = (upper ? xteU : xteL) - xle;
    const f = span > 0 ? Math.min(Math.max((x - xle) / span, 0), 1) : 1;
    const w = Math.pow(f, blendExp);
    return [x, y + (upper ? 1 : -1) * delta * w];
  });
}

/** Segment intersection test (proper crossings only; shared endpoints and round-off level touches do not count). */
export function segmentsCross(a, b, c, d, eps = 1e-14) {
  const o = (p, q, r) => {
    const v = (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
    return Math.abs(v) <= eps ? 0 : v;
  };
  const d1 = o(c, d, a);
  const d2 = o(c, d, b);
  const d3 = o(a, b, c);
  const d4 = o(a, b, d);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

/**
 * Pairs [i, j] (i < j, sorted) of non-adjacent polyline segments that cross each other; the search
 * stops after `limit` crossings. With `accept`, only crossings for which accept(i, j) is true are
 * returned and counted towards the limit. Segments are binned into a uniform grid of about one cell per
 * segment, and only segments that share a cell are tested: close to linear time for outlines whose
 * total length is a few times their extent (checkAirfoil rejects longer ones).
 */
export function selfIntersections(points, limit = 10, accept = null) {
  const nSeg = points.length - 1;
  if (nSeg < 3) return [];
  let xmin = Infinity;
  let xmax = -Infinity;
  let ymin = Infinity;
  let ymax = -Infinity;
  for (const [x, y] of points) {
    xmin = Math.min(xmin, x);
    xmax = Math.max(xmax, x);
    ymin = Math.min(ymin, y);
    ymax = Math.max(ymax, y);
  }
  const G = Math.max(1, Math.ceil(Math.sqrt(nSeg)));
  const cw = (xmax - xmin) / G || 1;
  const ch = (ymax - ymin) / G || 1;
  const cell = (v, v0, c) => Math.min(G - 1, Math.max(0, Math.floor((v - v0) / c)));
  // Segments whose bounding box covers at most LONG_CELLS cells are binned by that box (exact: two
  // crossing segments both contain the crossing point, so they share its cell). A binned pair is
  // tested only in the lower-left cell that both boxes share, so each pair is tested once. Longer
  // segments are tested against every segment; the outline length limit of checkAirfoil bounds
  // their number.
  const LONG_CELLS = 16;
  const bins = new Array(G * G);
  const gx0 = new Int32Array(nSeg);
  const gy0 = new Int32Array(nSeg);
  const isLong = new Uint8Array(nSeg);
  const long = [];
  for (let i = 0; i < nSeg; i++) {
    const [ax, ay] = points[i];
    const [bx, by] = points[i + 1];
    gx0[i] = cell(Math.min(ax, bx), xmin, cw);
    gy0[i] = cell(Math.min(ay, by), ymin, ch);
    const gx1 = cell(Math.max(ax, bx), xmin, cw);
    const gy1 = cell(Math.max(ay, by), ymin, ch);
    if ((gx1 - gx0[i] + 1) * (gy1 - gy0[i] + 1) > LONG_CELLS) {
      isLong[i] = 1;
      long.push(i);
      continue;
    }
    for (let gx = gx0[i]; gx <= gx1; gx++) {
      for (let gy = gy0[i]; gy <= gy1; gy++) {
        const key = gx * G + gy;
        if (bins[key]) bins[key].push(i);
        else bins[key] = [i];
      }
    }
  }
  const hits = [];
  const test = (a, b) => {
    const i = Math.min(a, b);
    const j = Math.max(a, b);
    if (j >= i + 2 && segmentsCross(points[i], points[i + 1], points[j], points[j + 1]) && (!accept || accept(i, j))) hits.push([i, j]);
  };
  for (const i of long) {
    // Long pairs are tested from their smaller index.
    for (let j = 0; j < nSeg && hits.length < limit; j++) if (!(isLong[j] && j < i)) test(i, j);
    if (hits.length >= limit) break;
  }
  for (let key = 0; key < bins.length && hits.length < limit; key++) {
    const bin = bins[key];
    if (!bin) continue;
    const gx = Math.floor(key / G);
    const gy = key - gx * G;
    for (let a = 0; a < bin.length && hits.length < limit; a++) {
      const i = bin[a];
      for (let b = a + 1; b < bin.length && hits.length < limit; b++) {
        const j = bin[b];
        if (Math.max(gx0[i], gx0[j]) === gx && Math.max(gy0[i], gy0[j]) === gy) test(i, j);
      }
    }
  }
  hits.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  return hits;
}
