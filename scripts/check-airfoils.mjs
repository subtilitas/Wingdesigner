// Validates the bundled airfoil library: every entry in public/airfoils/index.json has a file
// that parses without errors and complete source/license metadata; every NACA preset generates.
import { readFileSync } from 'node:fs';
import { importAirfoilText } from '../src/airfoil/sanity.js';
import { NACA_PRESETS, nacaEntry } from '../src/airfoil/library.js';
import { checkAirfoil } from '../src/airfoil/sanity.js';

const problems = [];
const index = JSON.parse(readFileSync('public/airfoils/index.json', 'utf8'));
if (!Array.isArray(index.airfoils)) problems.push('index.json: "airfoils" must be an array.');
const ids = new Set();
for (const a of index.airfoils ?? []) {
  const where = `index.json entry "${a.id}"`;
  if (!a.id || ids.has(a.id)) problems.push(`${where}: missing or duplicate id.`);
  ids.add(a.id);
  for (const k of ['name', 'file', 'category']) if (!a[k]) problems.push(`${where}: missing ${k}.`);
  for (const k of ['author', 'license', 'url']) if (!a.source?.[k]) problems.push(`${where}: missing source.${k}.`);
  let text;
  try {
    text = readFileSync(`public/airfoils/${a.file}`, 'utf8');
  } catch {
    problems.push(`${where}: file ${a.file} not found.`);
    continue;
  }
  const r = importAirfoilText(text, a.file);
  if (!r.ok) problems.push(`${where}: ${r.issues.filter((i) => i.severity === 'error').map((i) => i.message).join(' ')}`);
}
for (const n of NACA_PRESETS) {
  const r = checkAirfoil(nacaEntry(n.code).points);
  if (!r.ok) problems.push(`NACA ${n.code}: ${r.issues.map((i) => i.message).join(' ')}`);
}
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(`${(index.airfoils ?? []).length} bundled airfoils and ${NACA_PRESETS.length} NACA presets pass.`);
