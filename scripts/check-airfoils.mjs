// Validates the bundled airfoil library: every entry in public/airfoils/index.json has a file
// that parses without errors, complete source metadata and a free license; every file in
// public/airfoils/ belongs to an entry and to the notice; every NACA preset generates.
//
// Free license: public domain (by law, expired copyright or dedication) or a license that permits
// any use, modification, redistribution and commercial use with at most an attribution
// requirement. Personal-use, non-commercial, no-derivatives, share-alike and "ask first" terms are
// rejected. The one exception is a written permission of a designer that PERMISSIONS records and
// public/airfoils/NOTICE.md describes in its own section.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { importAirfoilText } from '../src/airfoil/sanity.js';
import { NACA_PRESETS, nacaEntry } from '../src/airfoil/library.js';
import { checkAirfoil } from '../src/airfoil/sanity.js';

export const FREE_LICENSES = ['public-domain', 'CC0-1.0', 'Unlicense', 'CC-BY-4.0', 'CC-BY-3.0', 'MIT', 'BSD-2-Clause', 'BSD-3-Clause'];
// Sources whose terms grant personal use only (see the wiki page Airfoil-Sources).
export const RESTRICTED_HOSTS = ['aerodesign.de', 'mh-aerotools.de'];
// Written permissions to bundle a designer's airfoils: license identifier 'written-permission',
// source.author equal to `author`, source.url on one of `hosts`, and `section` as a heading in
// NOTICE.md.
export const PERMISSIONS = [{ author: 'Martin Hepperle, www.mh-aerotools.de', hosts: ['mh-aerotools.de'], section: '## MH airfoils' }];
const DIR = 'public/airfoils';

const onHost = (host, hosts) => hosts.some((r) => host === r || host.endsWith(`.${r}`));
// Only https addresses: the Library links source.url, and a javascript: or data: address with a
// host would pass a host test.
const hostOf = (url) => {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' ? u.hostname.replace(/^www\./, '') : null;
  } catch {
    return null;
  }
};

/**
 * Problems of the index entries against the notice text (null when NOTICE.md is missing).
 * `readFile(name)` returns the text of a library file or throws. Returns { problems, files }, files
 * being the set of file names the entries name.
 */
export function checkEntries(index, notice, readFile) {
  const problems = [];
  if (!Array.isArray(index.airfoils)) problems.push('index.json: "airfoils" must be an array.');
  const entries = index.airfoils ?? [];
  if (entries.length && notice === null) problems.push(`${DIR}/NOTICE.md is missing; it lists the source and license of every bundled airfoil.`);
  const lines = notice === null ? [] : notice.split(/\r?\n/);
  const ids = new Set();
  const files = new Set();
  for (const a of entries) {
    const where = `index.json entry "${a.id}"`;
    if (!a.id || ids.has(a.id)) problems.push(`${where}: missing or duplicate id.`);
    ids.add(a.id);
    for (const k of ['name', 'file', 'category']) if (!a[k]) problems.push(`${where}: missing ${k}.`);
    for (const k of ['author', 'license', 'url', 'terms']) if (!a.source?.[k]) problems.push(`${where}: missing source.${k}.`);
    let permission = null;
    if (a.source?.license === 'written-permission') {
      permission = PERMISSIONS.find((p) => a.source.author === p.author);
      if (!permission) problems.push(`${where}: no written permission is recorded for "${a.source.author}".`);
      else if (notice !== null && !lines.includes(permission.section)) problems.push(`${where}: NOTICE.md has no section "${permission.section}" for the written permission.`);
    } else if (a.source?.license && !FREE_LICENSES.includes(a.source.license)) {
      problems.push(`${where}: source.license "${a.source.license}" is not a free license (${FREE_LICENSES.join(', ')}) or "written-permission".`);
    }
    for (const k of ['url', 'terms']) {
      if (!a.source?.[k]) continue;
      const host = hostOf(a.source[k]);
      if (!host) problems.push(`${where}: source.${k} is not an https URL.`);
      else if (permission && k === 'url' && !onHost(host, permission.hosts)) problems.push(`${where}: source.url is not on ${permission.hosts.join(', ')}, the site of the written permission.`);
      else if (onHost(host, RESTRICTED_HOSTS) && !(permission && k === 'url' && onHost(host, permission.hosts))) problems.push(`${where}: ${host} grants personal use only.`);
    }
    // The row of the Files table: name, file and license identifier, so that "MH 1" is not found
    // inside "MH 16".
    if (notice !== null && a.name && a.file && a.source?.license && !notice.includes(`| ${a.name} | \`${a.file}\` | \`${a.source.license}\` |`)) {
      problems.push(`${where}: NOTICE.md has no row "| ${a.name} | \`${a.file}\` | \`${a.source.license}\` |" in its Files table.`);
    }
    if (!a.file) continue;
    files.add(a.file);
    let text;
    try {
      text = readFile(a.file);
    } catch {
      problems.push(`${where}: file ${a.file} not found.`);
      continue;
    }
    const r = importAirfoilText(text, a.file);
    if (!r.ok) problems.push(`${where}: ${r.issues.filter((i) => i.severity === 'error').map((i) => i.message).join(' ')}`);
  }
  return { problems, files };
}

function main() {
  const index = JSON.parse(readFileSync(`${DIR}/index.json`, 'utf8'));
  const notice = existsSync(`${DIR}/NOTICE.md`) ? readFileSync(`${DIR}/NOTICE.md`, 'utf8') : null;
  const { problems, files } = checkEntries(index, notice, (f) => readFileSync(`${DIR}/${f}`, 'utf8'));
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
  const entries = index.airfoils;
  const permitted = entries.filter((a) => a.source?.license === 'written-permission').length;
  console.log(`${entries.length} bundled airfoils (${entries.length - permitted} with a free license, ${permitted} with a written permission) and ${NACA_PRESETS.length} NACA presets pass.`);
}

// Runs the check unless Vitest imports the module for test/airfoils-check.test.js.
if (!process.env.VITEST) main();
