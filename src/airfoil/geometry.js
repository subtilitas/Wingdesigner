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
function yAtAll(poly, xs) {
  for (let i = 1; i < poly.length; i++) if (poly[i][0] < poly[i - 1][0]) return xs.map((x) => yAt(poly, x));
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
    out[k] = x >= x1 ? y1 : x1 === x0 ? y1 : y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return out;
}

/**
 * Thickness and camber statistics of a normalized airfoil (chord 0..1).
 * Returns fractions of chord.
 */
export function airfoilStats(points, samples = 201) {
  const { upper, lower } = splitSurfaces(points);
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
    const c = (yu + yl) / 2;
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
  const yu = yAtAll(upper, coreXs);
  const yl = yAtAll(lower, coreXs);
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
 * Pairs [i, j] (i < j, sorted) of non-adjacent polyline segments that cross each other, at most
 * `limit`. Segments are binned into a uniform grid of about one cell per segment, and only segments
 * that share a cell are tested: close to linear time for airfoil outlines.
 */
export function selfIntersections(points, limit = 10) {
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
  const bins = new Map();
  for (let i = 0; i < nSeg; i++) {
    const [ax, ay] = points[i];
    const [bx, by] = points[i + 1];
    const gx0 = cell(Math.min(ax, bx), xmin, cw);
    const gx1 = cell(Math.max(ax, bx), xmin, cw);
    const gy0 = cell(Math.min(ay, by), ymin, ch);
    const gy1 = cell(Math.max(ay, by), ymin, ch);
    for (let gx = gx0; gx <= gx1; gx++) {
      for (let gy = gy0; gy <= gy1; gy++) {
        const key = gx * G + gy;
        const bin = bins.get(key);
        if (bin) bin.push(i);
        else bins.set(key, [i]);
      }
    }
  }
  const seen = new Set();
  const hits = [];
  for (const bin of bins.values()) {
    for (let a = 0; a < bin.length; a++) {
      for (let b = a + 1; b < bin.length; b++) {
        const i = Math.min(bin[a], bin[b]);
        const j = Math.max(bin[a], bin[b]);
        if (j < i + 2) continue;
        const key = i * nSeg + j;
        if (seen.has(key)) continue;
        seen.add(key);
        if (segmentsCross(points[i], points[i + 1], points[j], points[j + 1])) hits.push([i, j]);
      }
    }
  }
  hits.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  return hits.slice(0, limit);
}
