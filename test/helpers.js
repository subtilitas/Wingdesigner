import { nacaAirfoil } from '../src/airfoil/naca.js';
import { createProject } from '../src/model/project.js';

export function naca(code, id = code, opts = {}) {
  const a = nacaAirfoil(code, opts);
  return { id, name: a.name, points: a.points, source: { kind: 'naca' } };
}

/**
 * Synthetic airfoil with a closed, cusped trailing edge (Selig order, `points` per side, cosine
 * spacing): camber 0.2 x (1 − x) (1 + 2.5 x), aft-loaded with a camber slope of −0.7 at the trailing
 * edge, and half thickness 0.3 √x (1 − x)^1.5, which ends with zero thickness and zero wedge angle
 * (tangent surfaces), as the cusp of high-lift airfoils such as the S1223.
 */
export function cuspedAirfoil(id = 'cusp', points = 41) {
  const upper = [];
  const lower = [];
  for (let i = 0; i < points; i++) {
    const x = (1 - Math.cos((Math.PI * i) / (points - 1))) / 2;
    const half = 0.3 * Math.sqrt(x) * (1 - x) ** 1.5;
    const camber = 0.2 * x * (1 - x) * (1 + 2.5 * x);
    upper.push([x, camber + half]);
    lower.push([x, camber - half]);
  }
  return { id, name: 'Cusped', points: upper.reverse().concat(lower.slice(1)), source: { kind: 'file' } };
}

/**
 * Three-section tapered wing with twist and dihedral. Vertical section planes unless the overrides
 * set others: most tests exercise other parts of the build; the mitred planes have tests of their own.
 */
export function sampleProject(overrides = {}) {
  return createProject({
    name: 'Test wing',
    airfoils: [naca('2412', 'root'), naca('0010', 'tip')],
    sections: [
      { airfoil: 'root', x: 0, y: 0, z: 0, chord: 200, twist: 0 },
      { airfoil: 'root', x: 20, y: 300, z: 10, chord: 170, twist: -1 },
      { airfoil: 'tip', x: 60, y: 600, z: 30, chord: 110, twist: -3 },
    ],
    ...overrides,
    settings: { sectionPlanes: 'vertical', ...overrides.settings },
  });
}
