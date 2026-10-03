// Bundled airfoil library: public/airfoils/index.json and its coordinate files, compiled into the
// app by the airfoil-library plugin of vite.config.js. The library then needs no network request,
// also when the page is opened from a file.

import library from 'virtual:airfoil-library';
import { librarySource } from './library.js';
import { importAirfoilText } from './sanity.js';

/**
 * Entries of the bundled library in index order, each with its file text.
 * Entry: { id, name, file, category, use, source: { author, url, license, terms }, text }
 */
export function bundledLibrary() {
  return library.airfoils.map((a) => ({ ...a, text: library.files[a.file] }));
}

// Library names compare without letter case, spaces, hyphens and underscores, as the XFLR5 import
// looks them up: "mh45", "MH-45" and "MH_45" find "MH 45".
const nameKey = (name) => String(name ?? '').toLowerCase().replace(/[\s_-]+/g, '');

/**
 * The project airfoil of the library entry named `name`, as **Add to project** in the Library stores it:
 * { id, name, points (checked), source (librarySource) }. Null when no entry has that name or its file
 * fails the check.
 */
export function libraryAirfoil(name) {
  const key = nameKey(name);
  const e = key && bundledLibrary().find((a) => nameKey(a.name) === key);
  if (!e) return null;
  const r = importAirfoilText(e.text, e.file);
  if (!r.ok) return null;
  return { id: e.id, name: e.name, points: r.points, source: librarySource(e) };
}
