// NACA 4-digit and 5-digit airfoil generator (Abbott & von Doenhoff, "Theory of Wing Sections", 1959;
// NACA Report 824). Coordinates are computed from the published equations.

import { tr } from '../i18n/index.js';

const FIVE_STANDARD = {
  1: { m: 0.058, k1: 361.4 },
  2: { m: 0.126, k1: 51.64 },
  3: { m: 0.2025, k1: 15.957 },
  4: { m: 0.29, k1: 6.643 },
  5: { m: 0.391, k1: 3.23 },
};

const FIVE_REFLEX = {
  2: { m: 0.13, k1: 51.99, k21: 0.000764 },
  3: { m: 0.217, k1: 15.793, k21: 0.00677 },
  4: { m: 0.318, k1: 6.52, k21: 0.0303 },
  5: { m: 0.441, k1: 3.191, k21: 0.1355 },
};

/** Parse "NACA 2412", "naca23012", "0012" into a descriptor, or null when not a supported code. */
export function parseNacaCode(text) {
  const m = String(text)
    .trim()
    .match(/^(?:naca\s*-?\s*)?(\d{4,5})$/i);
  if (!m) return null;
  const d = m[1];
  if (d.length === 4) {
    const t = Number(d.slice(2)) / 100;
    if (t <= 0) return null;
    const camber = Number(d[0]) / 100;
    const pos = Number(d[1]) / 10;
    if ((camber > 0) !== (pos > 0)) return null;
    return { series: 4, code: d, camber, pos, t };
  }
  const L = Number(d[0]);
  const P = Number(d[1]);
  const S = Number(d[2]);
  const t = Number(d.slice(3)) / 100;
  if (t <= 0 || L === 0 || S > 1) return null;
  const table = S === 0 ? FIVE_STANDARD : FIVE_REFLEX;
  if (!table[P]) return null;
  return { series: 5, code: d, L, P, reflex: S === 1, t, ...table[P] };
}

function thickness(x, t, closedTE) {
  const a4 = closedTE ? 0.1036 : 0.1015;
  // Clamp round-off at the closed trailing edge (x = 1 gives about -1e-17).
  return Math.max(0, 5 * t * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - a4 * x ** 4));
}

function camber4(x, m, p) {
  if (m === 0) return [0, 0];
  if (x < p) return [(m / (p * p)) * (2 * p * x - x * x), ((2 * m) / (p * p)) * (p - x)];
  const q = (1 - p) * (1 - p);
  return [(m / q) * (1 - 2 * p + 2 * p * x - x * x), ((2 * m) / q) * (p - x)];
}

function camber5(x, d) {
  const scale = d.L / 2; // design lift coefficient 0.15 * L, tables are for 0.3
  const { m, k1 } = d;
  if (!d.reflex) {
    if (x < m) return [scale * (k1 / 6) * (x ** 3 - 3 * m * x * x + m * m * (3 - m) * x), scale * (k1 / 6) * (3 * x * x - 6 * m * x + m * m * (3 - m))];
    return [scale * ((k1 * m ** 3) / 6) * (1 - x), scale * (-(k1 * m ** 3) / 6)];
  }
  const k21 = d.k21;
  const c = (1 - m) ** 3;
  if (x < m) {
    return [
      scale * (k1 / 6) * ((x - m) ** 3 - k21 * c * x - m ** 3 * x + m ** 3),
      scale * (k1 / 6) * (3 * (x - m) ** 2 - k21 * c - m ** 3),
    ];
  }
  return [
    scale * (k1 / 6) * (k21 * (x - m) ** 3 - k21 * c * x - m ** 3 * x + m ** 3),
    scale * (k1 / 6) * (3 * k21 * (x - m) ** 2 - k21 * c - m ** 3),
  ];
}

/**
 * Generate Selig-ordered coordinates.
 * @param {string} code e.g. "2412", "NACA 23012"
 * @param {{pointsPerSide?: number, closedTE?: boolean}} [options]
 */
export function nacaAirfoil(code, { pointsPerSide = 81, closedTE = false } = {}) {
  const d = parseNacaCode(code);
  if (!d) throw new Error(tr('Unsupported NACA designation: {code}', { code }));
  const upper = [];
  const lower = [];
  for (let i = 0; i < pointsPerSide; i++) {
    const beta = (Math.PI * i) / (pointsPerSide - 1);
    const x = (1 - Math.cos(beta)) / 2;
    const yt = thickness(x, d.t, closedTE);
    const [yc, dyc] = d.series === 4 ? camber4(x, d.camber, d.pos) : camber5(x, d);
    const th = Math.atan(dyc);
    upper.push([x - yt * Math.sin(th), yc + yt * Math.cos(th)]);
    lower.push([x + yt * Math.sin(th), yc - yt * Math.cos(th)]);
  }
  const points = upper.reverse().concat(lower.slice(1));
  return { name: `NACA ${d.code}`, points };
}
