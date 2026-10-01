// Planform statistics of the full wing from a build result. The planform (chord and leading edge
// over span) is integrated with 5-point Gauss-Legendre quadrature, exact for polynomials up to
// degree 9, between root, tip and the planform breakpoints (sections, guide knots and control
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
 * @returns {{span: number, area: number, aspectRatio: number, mac: number, macY: number, macXLE: number, x25: number, rootChord: number, tipChord: number}}
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
    // Root, tip and the planform breakpoints bound the polynomial pieces; stations are not
    // breakpoints (splitting at 139,994 stations took 27 s at 20,000 sections with guides).
    const bounds = build.planformBreaks ? [st[0].y, st[st.length - 1].y, ...build.planformBreaks] : st.map((q) => q.y);
    const ys = [...new Set(bounds)].sort((a, b) => a - b);
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
  const mac = A > 0 ? C2 / A : 0;
  let macY = A > 0 ? CY / A : 0;
  let macXLE = A > 0 ? CX / A : 0;
  let x25 = macXLE + 0.25 * mac;
  let tipY = st.length ? st[st.length - 1].y : 0;
  let leftTipY = null;
  // A part with a rigid placement (build.part): positions in the plane axes, the MAC leading edge and
  // the 25 % MAC point turned with the part at the height of the stations; chords, area and MAC in
  // the part's own frame.
  const part = build.part;
  if (part && !part.identity && st.length) {
    const zAt = (y) => {
      if (y <= st[0].y) return st[0].z;
      for (let i = 1; i < st.length; i++) if (y <= st[i].y) return st[i - 1].z + ((y - st[i - 1].y) / (st[i].y - st[i - 1].y)) * (st[i].z - st[i - 1].z);
      return st[st.length - 1].z;
    };
    const z = zAt(macY);
    const le = part.point([macXLE, macY, z]);
    x25 = part.point([macXLE + 0.25 * mac, macY, z])[0];
    macXLE = le[0];
    macY = le[1];
    const tip = st[st.length - 1];
    tipY = part.point([tip.xLE, tip.y, tip.z])[1];
    // A left half that turns with the whole wing ends elsewhere than at −tipY.
    if (part.turnedLeft) leftTipY = part.leftPoint([tip.xLE, tip.y, tip.z])[1];
  }
  // Full wing (both halves) regardless of the display setting "Show mirrored half". A roll beyond 90°
  // turns the right tip to y < 0; the tips stay 2 |y| apart.
  const span = leftTipY === null ? 2 * Math.abs(tipY) : Math.abs(tipY - leftTipY);
  const area = 2 * A;
  return {
    span,
    area,
    aspectRatio: area > 0 ? (span * span) / area : 0,
    mac,
    macY,
    macXLE,
    x25,
    rootChord: st[0]?.chord ?? 0,
    tipChord: st[st.length - 1]?.chord ?? 0,
  };
}
