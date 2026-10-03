// Project shown on first load.

import { libraryAirfoil } from '../airfoil/bundled.js';
import { tr } from '../i18n/index.js';
import { createProject } from './project.js';

/** 1.5 m span, three-section tapered wing with washout and 2.5 degrees dihedral at the tip; MH 32 from the Library. */
export function defaultProject() {
  const mh32 = libraryAirfoil('MH 32');
  return createProject({
    name: tr('Sport wing 1500'),
    airfoils: [mh32],
    sections: [
      { id: 'root', airfoil: mh32.id, x: 0, y: 0, z: 0, chord: 240, twist: 0 },
      { id: 'mid', airfoil: mh32.id, x: 12, y: 450, z: 12, chord: 205, twist: -0.8 },
      { id: 'tip', airfoil: mh32.id, x: 55, y: 750, z: 33, chord: 130, twist: -2.5 },
    ],
    settings: { trailingEdge: { mode: 'thickness', thickness: 0.5 } },
  });
}
