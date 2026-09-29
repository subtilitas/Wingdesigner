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

export function polygonArea(poly) {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    a += p[0] * q[1] - q[0] * p[1];
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
