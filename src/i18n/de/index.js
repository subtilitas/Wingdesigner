// German catalog, one file per area of the code (each file lists the keys of its modules).
import shell from './shell.js';
import panels from './panels.js';
import editors from './editors.js';
import model from './model.js';
import geom from './geom.js';
import airfoil from './airfoil.js';

/** Area files by name, for the i18n check. */
export const AREAS = { shell, panels, editors, model, geom, airfoil };

/** All German entries; `npm run i18n:check` reports a key that two areas translate differently. */
export const DE = Object.assign({}, ...Object.values(AREAS));
