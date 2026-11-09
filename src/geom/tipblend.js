// Spanwise blend of a rounded wing tip (src/model/roundtip.js): the outer run of sections marked
// `roundTip` ('tangent' or 'corner') beyond section T, on a wing with a pointed tip. Linear and
// Smooth blend the tip sections in y, where an outline that runs square to y at the point needs an
// infinite slope: Linear gives a polygon, the shape-preserving cubic an S-bend before the point. Here
// the outline outboard of T, leading edge and trailing edge, is interpolated in the angle θ of
// y = y_T + L · sin θ (L = y_end − y_T), in which the outline of the dialog is smooth:
//
//   f(y) = f_T + s · (y − y_T) + r(θ),   s = slope of the inboard blend at T
//
// r is the cubic spline in θ through the residuals r_k = f_k − f_T − s · (y_k − y_T) of the tip
// sections (r = 0 at T), with a natural end at the point and at T either the slope 0 ('tangent':
// the blend leaves T with the slope of the inboard blend) or a natural start ('corner'). Residuals
// that all lie within STRAIGHT_RESOLUTION, the rounding of the dialog, count as a straight value:
// r = 0, so that a straight edge or a constant twist stays exact instead of rippling.
// The leading edge and the trailing edge (x + chord) are interpolated, not x and chord: with the
// straight line at 0 % or 100 % one of them is straight. Every other value (z, twist, roll) keeps the
// blend in y over all sections: along the tip it runs straight, and in θ its slope in y would grow
// without bound at the point, where the slope of z sets the stretch of mitred planes.

import { spanwiseBlender } from './spanwise.js';
import { ROUND_TIP_MARKERS } from '../model/project.js';

/** Fewest marked sections that form a rounded tip. */
export const ROUND_TIP_START_SECTIONS = 2;

/** Residuals within this (mm or degrees) count as zero: the dialog rounds to 0.01. */
export const STRAIGHT_RESOLUTION = 0.01;

/**
 * Index of the last section (sorted by y) that is not marked as a rounded tip: guide curves run from
 * the root to it, and a rounded tip beyond it follows the blend below. The last section when none is
 * marked; at least section 1, so that a guide curve keeps a span.
 */
export function guideEndIndex(sections) {
  let i = sections.length - 1;
  while (i > 1 && ROUND_TIP_MARKERS.includes(sections[i].roundTip)) i--;
  return i;
}

/**
 * Index of section T (sorted by y) before the outer run of rounded-tip sections, or -1 when the
 * rounded blend does not apply: no marked run at the tip, a run of fewer than 2 sections, no section
 * before T, a tip that is not pointed, or Straight panels. Guide curves end at T (guideEndIndex).
 */
export function roundTipStart(sections, settings) {
  if (settings.tip?.mode !== 'pointed' || settings.spanwise === 'straight') return -1;
  let i = sections.length;
  while (i > 0 && ROUND_TIP_MARKERS.includes(sections[i - 1].roundTip)) i--;
  const t = i - 1;
  return sections.length - i >= ROUND_TIP_START_SECTIONS && t >= 1 ? t : -1;
}

/**
 * Cubic spline through (t_i, f_i), t increasing, natural at the end; at the start natural
 * (start = null) or with the first derivative `start`. Returns value and first derivative in t.
 */
function cubicSpline(t, f, start) {
  const n = t.length;
  const h = [];
  for (let i = 0; i < n - 1; i++) h.push(t[i + 1] - t[i]);
  // Second derivatives M from a tridiagonal system (Thomas algorithm; diagonally dominant).
  const a = new Float64Array(n);
  const b = new Float64Array(n);
  const c = new Float64Array(n);
  const d = new Float64Array(n);
  if (start === null) {
    b[0] = 1;
  } else {
    b[0] = h[0] / 3;
    c[0] = h[0] / 6;
    d[0] = (f[1] - f[0]) / h[0] - start;
  }
  for (let i = 1; i < n - 1; i++) {
    a[i] = h[i - 1] / 6;
    b[i] = (h[i - 1] + h[i]) / 3;
    c[i] = h[i] / 6;
    d[i] = (f[i + 1] - f[i]) / h[i] - (f[i] - f[i - 1]) / h[i - 1];
  }
  b[n - 1] = 1;
  for (let i = 1; i < n; i++) {
    const w = a[i] / b[i - 1];
    b[i] -= w * c[i - 1];
    d[i] -= w * d[i - 1];
  }
  const M = new Float64Array(n);
  M[n - 1] = d[n - 1] / b[n - 1];
  for (let i = n - 2; i >= 0; i--) M[i] = (d[i] - c[i] * M[i + 1]) / b[i];
  const span = (x) => {
    let lo = 0;
    let hi = n - 2;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (x > t[mid]) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  };
  const value = (x) => {
    const i = span(x);
    const A = (t[i + 1] - x) / h[i];
    const B = (x - t[i]) / h[i];
    return A * f[i] + B * f[i + 1] + (((A * A * A - A) * M[i] + (B * B * B - B) * M[i + 1]) * h[i] * h[i]) / 6;
  };
  const slope = (x) => {
    const i = span(x);
    const A = (t[i + 1] - x) / h[i];
    const B = (x - t[i]) / h[i];
    return (f[i + 1] - f[i]) / h[i] + ((-(3 * A * A - 1) * M[i] + (3 * B * B - 1) * M[i + 1]) * h[i]) / 6;
  };
  return { value, slope };
}

/** Smallest cos θ used for dθ/dy = 1 / (L cos θ) at the point, where the slope in y is unbounded. */
const MIN_COS = 1e-3;

/**
 * Blender of section values with the rounded tip from section `t` on: the same interface as
 * spanwiseBlender (one list of points per section; a function of y with a `derivative` method).
 * `edge` = [ix, ic]: the flat indices of leading-edge x and chord, blended as leading and trailing
 * edge in θ; every other value follows spanwiseBlender over all sections. `sectionModes`: the
 * roundTip marker of each section. The outline inboard of T follows the blend of sections 0 … t.
 * `anchor` (optional, with guide curves): { value, slope } per flat outline index, the leading-edge
 * x and the trailing edge (x + chord) of the guide curves at T and their slopes in y, in place of
 * those of the blend of sections 0 … t.
 */
export function roundTipBlender(ys, mode, lists, t, sectionModes, edge, anchor = null) {
  const inner = spanwiseBlender(ys.slice(0, t + 1), mode, lists.slice(0, t + 1));
  const full = spanwiseBlender(ys, mode, lists);
  const outline = new Set(edge);
  const yT = ys[t];
  const L = ys[ys.length - 1] - yT;
  const thetaOf = (y) => Math.asin(Math.min(1, Math.max(0, (y - yT) / L)));
  const tipYs = ys.slice(t);
  const thetas = tipYs.map(thetaOf);
  const tangent = sectionModes.slice(t + 1).every((m) => m === 'tangent');
  // Values per section as flat arrays; with `edge` = [ix, ic] the chord component carries the
  // trailing edge (x + chord) while blending.
  const flat = (L0) => {
    const out = [];
    for (const p of L0) for (const v of p) out.push(v);
    out[edge[1]] = out[edge[0]] + out[edge[1]];
    return out;
  };
  const shape = lists[0].map((p) => p.length);
  const size = shape.reduce((s, v) => s + v, 0);
  const F = lists.map(flat);
  const innerFlat = (y) => flat(inner(y));
  const innerSlope = (() => {
    const d = inner.derivative(yT);
    const out = [];
    for (const p of d) for (const v of p) out.push(v);
    out[edge[1]] = out[edge[0]] + out[edge[1]];
    return out;
  })();
  const FT = innerFlat(yT);
  if (anchor) {
    for (const [q, a] of Object.entries(anchor)) {
      FT[q] = a.value;
      innerSlope[q] = a.slope;
    }
  }
  const splines = [];
  for (let q = 0; q < size; q++) {
    if (!outline.has(q)) {
      splines.push(null);
      continue;
    }
    const r = tipYs.map((y, k) => (k === 0 ? 0 : F[t + k][q] - FT[q] - innerSlope[q] * (y - yT)));
    const straight = r.every((v) => Math.abs(v) <= STRAIGHT_RESOLUTION);
    splines.push(straight ? null : cubicSpline(thetas, r, tangent ? 0 : null));
  }
  const unflat = (out) => {
    out[edge[1]] = out[edge[1]] - out[edge[0]];
    const res = [];
    let k = 0;
    for (const n of shape) {
      res.push(out.slice(k, k + n));
      k += n;
    }
    return res;
  };
  // Outline values from the inboard blend (y <= y_T) or the tip blend; the others from `full`.
  const blend = (y) => {
    const out = flat(full(y));
    const own = y <= yT ? flat(inner(y)) : null;
    const th = thetaOf(y);
    for (const q of outline) out[q] = own ? own[q] : FT[q] + innerSlope[q] * (y - yT) + (splines[q] ? splines[q].value(th) : 0);
    return unflat(out);
  };
  blend.derivative = (y) => {
    const d = full.derivative(y);
    const out = [];
    for (const p of d) for (const v of p) out.push(v);
    out[edge[1]] = out[edge[0]] + out[edge[1]];
    const own = y <= yT ? flat(inner.derivative(y)) : null;
    const th = thetaOf(y);
    const dThetaDy = 1 / (L * Math.max(Math.cos(th), MIN_COS));
    for (const q of outline) out[q] = own ? own[q] : innerSlope[q] + (splines[q] ? splines[q].slope(th) * dThetaDy : 0);
    return unflat(out);
  };
  return blend;
}

/**
 * Span parameter of the loft for a wing from y0 to y1 with a rounded tip from yT on (yT = null: none),
 * and its inverse. Inboard of yT the parameter grows with y; in the tip with the arc s = y_T + L · θ
 * of y = y_T + L · sin θ (L = y1 − yT), which joins y with equal first and second derivative at yT
 * and keeps a finite slope of the outline up to the point, so that the cubic fit through the stations
 * follows the tip instead of swinging where the outline runs square to y.
 */
export function spanParameter(y0, y1, yT) {
  if (!(y1 > y0)) return { vOf: () => 0, yOf: () => y0 };
  if (yT === null || !(yT > y0 && yT < y1)) {
    return { vOf: (y) => (y - y0) / (y1 - y0), yOf: (v) => y0 + v * (y1 - y0) };
  }
  const L = y1 - yT;
  const s1 = yT + (L * Math.PI) / 2;
  const sOf = (y) => (y <= yT ? y : yT + L * Math.asin(Math.min(1, (y - yT) / L)));
  return {
    vOf: (y) => (sOf(Math.min(Math.max(y, y0), y1)) - y0) / (s1 - y0),
    yOf: (v) => {
      const s = y0 + Math.min(Math.max(v, 0), 1) * (s1 - y0);
      return s <= yT ? s : yT + L * Math.sin((s - yT) / L);
    },
  };
}
