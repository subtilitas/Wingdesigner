// Planform statistics of the full wing from a build result. The planform (chord and leading edge
// over span) is integrated with 5-point Gauss-Legendre quadrature, exact for polynomials up to
// degree 9, between the stations and the planform breakpoints (sections, guide knots and control
// points). An interval is halved while the halves change any integral by more than
// REL_TOLERANCE of its scale, at most MAX_DEPTH times, so guide curves that vary between the
// breakpoints are integrated too. Builds without a planform function fall back to trapezoids over
// the stations.

const REL_TOLERANCE = 1e-10;
const MAX_DEPTH = 12;

const GL = [
  [-0.906179845938664, 0.236926885056189],
  [-0.538469310105683, 0.478628670499366],
  [0, 0.568888888888889],
  [0.538469310105683, 0.478628670499366],
  [0.906179845938664, 0.236926885056189],
];

/**
 * @returns {{span: number, area: number, aspectRatio: number, mac: number, macY: number, macXLE: number, rootChord: number, tipChord: number}}
 *   span and lengths in mm, area in mm^2 (both halves; with the root off y = 0 the gap between the
 *   halves counts to the span but not to the area), macY = span position of the MAC on one half.
 */
export function wingStats(build) {
  const st = build.stations;
  // Integrals over one half: area, chord squared, chord x y, chord x leading-edge x.
  const I = [0, 0, 0, 0];
  if (build.planformAt && st.length > 1) {
    const f = build.planformAt;
    const gauss = (a, b) => {
      const s = [0, 0, 0, 0];
      const dy = b - a;
      for (const [t, w] of GL) {
        const y = a + ((t + 1) * dy) / 2;
        const { xLE, chord } = f(y);
        const wy = (w * dy) / 2;
        s[0] += wy * chord;
        s[1] += wy * chord * chord;
        s[2] += wy * chord * y;
        s[3] += wy * chord * xLE;
      }
      return s;
    };
    // Scale of each integrand per millimetre of span, from the stations.
    let cMax = 0;
    let yMax = 0;
    let xMax = 0;
    for (const q of st) {
      cMax = Math.max(cMax, Math.abs(q.chord));
      yMax = Math.max(yMax, Math.abs(q.y));
      xMax = Math.max(xMax, Math.abs(q.xLE) + Math.abs(q.chord));
    }
    const scale = [cMax, cMax * cMax, cMax * yMax, cMax * xMax].map((v) => REL_TOLERANCE * Math.max(v, 1));
    const add = (a, b, whole, depth) => {
      const m = (a + b) / 2;
      const l = gauss(a, m);
      const r = gauss(m, b);
      const converged = depth >= MAX_DEPTH || whole.every((v, k) => Math.abs(l[k] + r[k] - v) <= scale[k] * (b - a));
      if (converged) {
        for (let k = 0; k < 4; k++) I[k] += l[k] + r[k];
        return;
      }
      add(a, m, l, depth + 1);
      add(m, b, r, depth + 1);
    };
    const ys = [...new Set([...st.map((q) => q.y), ...(build.planformBreaks ?? [])])].sort((a, b) => a - b);
    for (let i = 1; i < ys.length; i++) add(ys[i - 1], ys[i], gauss(ys[i - 1], ys[i]), 0);
  } else {
    for (let i = 1; i < st.length; i++) {
      const a = st[i - 1];
      const b = st[i];
      const dy = b.y - a.y;
      // Exact integrals of products of linear functions over the interval.
      const lin = (f0, f1, g0, g1) => (dy * (2 * f0 * g0 + f0 * g1 + f1 * g0 + 2 * f1 * g1)) / 6;
      I[0] += (dy * (a.chord + b.chord)) / 2;
      I[1] += lin(a.chord, b.chord, a.chord, b.chord);
      I[2] += lin(a.chord, b.chord, a.y, b.y);
      I[3] += lin(a.chord, b.chord, a.xLE, b.xLE);
    }
  }
  const [A, C2, CY, CX] = I;
  // Full wing (both halves) regardless of the display setting "Show mirrored half".
  const span = st.length ? 2 * st[st.length - 1].y : 0;
  const area = 2 * A;
  return {
    span,
    area,
    aspectRatio: area > 0 ? (span * span) / area : 0,
    mac: A > 0 ? C2 / A : 0,
    macY: A > 0 ? CY / A : 0,
    macXLE: A > 0 ? CX / A : 0,
    rootChord: st[0]?.chord ?? 0,
    tipChord: st[st.length - 1]?.chord ?? 0,
  };
}
