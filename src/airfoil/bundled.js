// Bundled airfoil library: public/airfoils/index.json and its coordinate files, compiled into the
// app by the airfoil-library plugin of vite.config.js. The library then needs no network request,
// also when the page is opened from a file.

import library from 'virtual:airfoil-library';

/**
 * Entries of the bundled library in index order, each with its file text.
 * Entry: { id, name, file, category, use, source: { author, url, license, terms }, text }
 */
export function bundledLibrary() {
  return library.airfoils.map((a) => ({ ...a, text: library.files[a.file] }));
}
