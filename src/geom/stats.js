// Planform statistics of the full wing from a build result (trapezoidal integration over the
// spanwise stations, which is exact for linear panels).

/**
 * @returns {{span: number, area: number, aspectRatio: number, mac: number, macY: number, macXLE: number, rootChord: number, tipChord: number}}
 *   span and lengths in mm, area in mm^2 (both halves), macY = span position of the MAC on one half.
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
    // Exact integrals of products of linear functions over the interval.
    const lin = (f0, f1, g0, g1) => (dy * (2 * f0 * g0 + f0 * g1 + f1 * g0 + 2 * f1 * g1)) / 6;
    A += (dy * (a.chord + b.chord)) / 2;
    C2 += lin(a.chord, b.chord, a.chord, b.chord);
    CY += lin(a.chord, b.chord, a.y, b.y);
    CX += lin(a.chord, b.chord, a.xLE, b.xLE);
  }
  const half = st.length ? st[st.length - 1].y - st[0].y : 0;
  const mirrored = build.settings?.mirror !== false;
  const span = mirrored ? 2 * st[st.length - 1].y : half;
  const area = mirrored ? 2 * A : A;
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
