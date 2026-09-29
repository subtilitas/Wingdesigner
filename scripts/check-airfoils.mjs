// Validates the bundled airfoil library: every entry in public/airfoils/index.json has a file
// that parses without errors, complete source metadata and a free license; every file in
// public/airfoils/ belongs to an entry and to the notice; every NACA preset generates.
//
// Free license: public domain (by law, expired copyright or dedication) or a license that permits
// any use, modification, redistribution and commercial use with at most an attribution
// requirement. Personal-use, non-commercial, no-derivatives, share-alike and "ask first" terms are
// rejected.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { importAirfoilText } from '../src/airfoil/sanity.js';
import { NACA_PRESETS, nacaEntry } from '../src/airfoil/library.js';
import { checkAirfoil } from '../src/airfoil/sanity.js';

const FREE_LICENSES = ['public-domain', 'CC0-1.0', 'Unlicense', 'CC-BY-4.0', 'CC-BY-3.0', 'MIT', 'BSD-2-Clause', 'BSD-3-Clause'];
// Sources whose terms grant personal use only (see the wiki page Airfoil-Sources).
const RESTRICTED_HOSTS = ['aerodesign.de', 'mh-aerotools.de'];
const DIR = 'public/airfoils';

const hostOf = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
};

const problems = [];
const index = JSON.parse(readFileSync(`${DIR}/index.json`, 'utf8'));
if (!Array.isArray(index.airfoils)) problems.push('index.json: "airfoils" must be an array.');
const entries = index.airfoils ?? [];
const notice = existsSync(`${DIR}/NOTICE.md`) ? readFileSync(`${DIR}/NOTICE.md`, 'utf8') : null;
if (entries.length && notice === null) problems.push(`${DIR}/NOTICE.md is missing; it lists the source and license of every bundled airfoil.`);
const ids = new Set();
const files = new Set();
for (const a of entries) {
  const where = `index.json entry "${a.id}"`;
  if (!a.id || ids.has(a.id)) problems.push(`${where}: missing or duplicate id.`);
  ids.add(a.id);
  for (const k of ['name', 'file', 'category']) if (!a[k]) problems.push(`${where}: missing ${k}.`);
  for (const k of ['author', 'license', 'url', 'terms']) if (!a.source?.[k]) problems.push(`${where}: missing source.${k}.`);
  if (a.source?.license && !FREE_LICENSES.includes(a.source.license)) {
    problems.push(`${where}: source.license "${a.source.license}" is not a free license (${FREE_LICENSES.join(', ')}).`);
  }
  for (const k of ['url', 'terms']) {
    if (!a.source?.[k]) continue;
    const host = hostOf(a.source[k]);
    if (!host) problems.push(`${where}: source.${k} is not a URL.`);
    else if (RESTRICTED_HOSTS.some((r) => host === r || host.endsWith(`.${r}`))) problems.push(`${where}: ${host} grants personal use only.`);
  }
  if (notice !== null && a.name && !notice.includes(a.name)) problems.push(`${where}: "${a.name}" is not listed in NOTICE.md.`);
  if (!a.file) continue;
  files.add(a.file);
  let text;
  try {
    text = readFileSync(`${DIR}/${a.file}`, 'utf8');
  } catch {
    problems.push(`${where}: file ${a.file} not found.`);
    continue;
  }
  const r = importAirfoilText(text, a.file);
  if (!r.ok) problems.push(`${where}: ${r.issues.filter((i) => i.severity === 'error').map((i) => i.message).join(' ')}`);
}
// Every shipped file needs an index entry, so no coordinates are served without license metadata.
for (const f of readdirSync(DIR, { recursive: true, withFileTypes: true })) {
  if (!f.isFile()) continue;
  const rel = `${f.parentPath ?? f.path}/${f.name}`.slice(DIR.length + 1);
  if (rel === 'index.json' || rel === 'NOTICE.md') continue;
  if (!files.has(rel)) problems.push(`${DIR}/${rel} has no entry in index.json.`);
}
for (const n of NACA_PRESETS) {
  const r = checkAirfoil(nacaEntry(n.code).points);
  if (!r.ok) problems.push(`NACA ${n.code}: ${r.issues.map((i) => i.message).join(' ')}`);
}
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(`${entries.length} bundled airfoils (free licenses only) and ${NACA_PRESETS.length} NACA presets pass.`);
