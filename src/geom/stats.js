// Planform statistics of the full wing from a build result. The planform (chord and leading edge
// over span) is integrated with 5-point Gauss-Legendre quadrature per station interval, exact for
// polynomials up to degree 9: linear panels, cubic spanwise splines and their products. Builds
// without a planform function fall back to trapezoids over the stations.

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
  let A = 0;
  let C2 = 0;
  let CY = 0;
  let CX = 0;
  for (let i = 1; i < st.length; i++) {
    const a = st[i - 1];
    const b = st[i];
    const dy = b.y - a.y;
    if (build.planformAt) {
      for (const [t, w] of GL) {
        const y = a.y + ((t + 1) * dy) / 2;
        const { xLE, chord } = build.planformAt(y);
        const wy = (w * dy) / 2;
        A += wy * chord;
        C2 += wy * chord * chord;
        CY += wy * chord * y;
        CX += wy * chord * xLE;
      }
      continue;
    }
    // Exact integrals of products of linear functions over the interval.
    const lin = (f0, f1, g0, g1) => (dy * (2 * f0 * g0 + f0 * g1 + f1 * g0 + 2 * f1 * g1)) / 6;
    A += (dy * (a.chord + b.chord)) / 2;
    C2 += lin(a.chord, b.chord, a.chord, b.chord);
    CY += lin(a.chord, b.chord, a.y, b.y);
    CX += lin(a.chord, b.chord, a.xLE, b.xLE);
  }
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
