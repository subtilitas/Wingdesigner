// Ear-clipping triangulation of a simple polygon (no holes). O(n^2), sufficient for airfoil caps.

function area2(a, b, c) {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

function pointInTriangle(p, a, b, c) {
  const d1 = area2(p, a, b);
  const d2 = area2(p, b, c);
  const d3 = area2(p, c, a);
  const neg = d1 < 0 || d2 < 0 || d3 < 0;
  const pos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(neg && pos);
}

/**
 * Signed area, positive for counterclockwise order. Summed relative to the first vertex: products
 * of raw coordinates 1e5 mm from the origin lose the area of a 20 mm chord to round-off.
 */
export function polygonArea(poly) {
  if (poly.length < 3) return 0;
  const [ox, oy] = poly[0];
  let a = 0;
  for (let i = 1; i + 1 < poly.length; i++) {
    const p = poly[i];
    const q = poly[i + 1];
    a += (p[0] - ox) * (q[1] - oy) - (q[0] - ox) * (p[1] - oy);
  }
  return a / 2;
}

/**
 * Triangulate a simple polygon given as 2D points.
 * Returns index triples oriented counterclockwise (same orientation as a CCW input polygon).
 */
export function earClip(poly) {
  const n = poly.length;
  if (n < 3) return [];
  const ccw = polygonArea(poly) > 0;
  const idx = [];
  for (let i = 0; i < n; i++) idx.push(ccw ? i : n - 1 - i);
  const tris = [];
  let guard = 0;
  while (idx.length > 3 && guard < n * n) {
    guard++;
    let clipped = false;
    let bestK = -1;
    let bestScore = -Infinity;
    for (let k = 0; k < idx.length; k++) {
      const i0 = idx[(k + idx.length - 1) % idx.length];
      const i1 = idx[k];
      const i2 = idx[(k + 1) % idx.length];
      const a = poly[i0];
      const b = poly[i1];
      const c = poly[i2];
      const ar = area2(a, b, c);
      if (ar <= 0) continue;
      let inside = false;
      for (const j of idx) {
        if (j === i0 || j === i1 || j === i2) continue;
        const p = poly[j];
        if ((p[0] === a[0] && p[1] === a[1]) || (p[0] === b[0] && p[1] === b[1]) || (p[0] === c[0] && p[1] === c[1])) continue;
        if (pointInTriangle(p, a, b, c)) {
          inside = true;
          break;
        }
      }
      if (inside) continue;
      // Prefer well-shaped ears: largest minimum angle proxy (area over longest edge squared).
      const e = Math.max(
        (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2,
        (c[0] - b[0]) ** 2 + (c[1] - b[1]) ** 2,
        (a[0] - c[0]) ** 2 + (a[1] - c[1]) ** 2,
      );
      const score = ar / e;
      if (score > bestScore) {
        bestScore = score;
        bestK = k;
      }
    }
    if (bestK >= 0) {
      const k = bestK;
      tris.push([idx[(k + idx.length - 1) % idx.length], idx[k], idx[(k + 1) % idx.length]]);
      idx.splice(k, 1);
      clipped = true;
    }
    if (!clipped) {
      // Degenerate remainder (collinear points): clip the vertex with the smallest |area|.
      let k = 0;
      let best = Infinity;
      for (let q = 0; q < idx.length; q++) {
        const a = Math.abs(area2(poly[idx[(q + idx.length - 1) % idx.length]], poly[idx[q]], poly[idx[(q + 1) % idx.length]]));
        if (a < best) {
          best = a;
          k = q;
        }
      }
      tris.push([idx[(k + idx.length - 1) % idx.length], idx[k], idx[(k + 1) % idx.length]]);
      idx.splice(k, 1);
    }
  }
  if (idx.length === 3) tris.push([idx[0], idx[1], idx[2]]);
  return ccw ? tris : tris.map(([a, b, c]) => [a, c, b]);
}

/**
 * Triangulate an airfoil outline whose leading edge is at index `le` and whose upper and lower
 * points pair up by index distance from the leading edge (common chord stations). Each pair of
 * neighbouring rungs forms a quad of 2 triangles, so the cost is linear in the point count.
 * A quad whose first diagonal gives a triangle that is not counterclockwise (refined chord
 * stations no longer pair exactly) uses the other diagonal. Falls back to ear clipping when neither
 * diagonal works or the triangles do not cover exactly the polygon area. Input must be
 * counterclockwise.
 */
export function stripTriangulate(poly, le) {
  const n = poly.length;
  const closed = n === 2 * le; // closing trailing-edge point merged into index 0
  if (!(le > 0 && (n === 2 * le + 1 || closed))) return earClip(poly);
  const upper = (k) => (le - k + n) % n;
  const lower = (k) => (le + k) % n;
  const tris = [];
  const area = (a, b, c) => ((poly[b][0] - poly[a][0]) * (poly[c][1] - poly[a][1]) - (poly[b][1] - poly[a][1]) * (poly[c][0] - poly[a][0])) / 2;
  let sum = 0;
  for (let k = 0; k < le; k++) {
    const u0 = upper(k);
    const u1 = upper(k + 1);
    const l0 = lower(k);
    const l1 = lower(k + 1);
    const quad = (pair) => {
      const kept = pair.filter((t) => t[0] !== t[1] && t[1] !== t[2] && t[0] !== t[2]);
      const areas = kept.map((t) => area(t[0], t[1], t[2]));
      return areas.every((a) => a > 0) ? { kept, areas } : null;
    };
    const q =
      quad([
        [l0, l1, u1],
        [l0, u1, u0],
      ]) ??
      quad([
        [l0, l1, u0],
        [l1, u1, u0],
      ]);
    if (!q) return earClip(poly);
    for (let t = 0; t < q.kept.length; t++) {
      sum += q.areas[t];
      tris.push(q.kept[t]);
    }
  }
  const total = polygonArea(poly);
  if (Math.abs(sum - total) > 1e-9 * Math.max(Math.abs(total), 1e-12) + 1e-12) return earClip(poly);
  return tris;
}
