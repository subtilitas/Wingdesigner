// Project shown on first load.

import { nacaAirfoil } from '../airfoil/naca.js';
import { createProject } from './project.js';

function naca(code) {
  const a = nacaAirfoil(code);
  return {
    id: `naca${code}`,
    name: a.name,
    points: a.points,
    source: { kind: 'naca', note: 'Generated from the NACA 4/5-digit equations (NACA Report 824).' },
  };
}

/** 1.5 m span, three-section tapered wing with washout and 2.5 degrees dihedral at the tip. */
export function defaultProject() {
  return createProject({
    name: 'Sport wing 1500',
    airfoils: [naca('2412'), naca('2410')],
    sections: [
      { id: 'root', airfoil: 'naca2412', x: 0, y: 0, z: 0, chord: 240, twist: 0 },
      { id: 'mid', airfoil: 'naca2412', x: 12, y: 450, z: 12, chord: 205, twist: -0.8 },
      { id: 'tip', airfoil: 'naca2410', x: 55, y: 750, z: 33, chord: 130, twist: -2.5 },
    ],
    settings: { trailingEdge: { mode: 'thickness', thickness: 0.5 } },
  });
}
