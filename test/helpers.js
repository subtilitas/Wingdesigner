import { nacaAirfoil } from '../src/airfoil/naca.js';
import { createProject } from '../src/model/project.js';

export function naca(code, id = code, opts = {}) {
  const a = nacaAirfoil(code, opts);
  return { id, name: a.name, points: a.points, source: { kind: 'naca' } };
}

/** Three-section tapered wing with twist and dihedral. */
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
  });
}
