// Writes the unit-test coverage table into README.md between the coverage markers, or with
// --check fails when the README table differs from coverage/coverage-summary.json.
// Usage: npm run coverage && npm run coverage:readme      (update)
//        npm run coverage && npm run coverage:check       (CI)
import { readFileSync, writeFileSync } from 'node:fs';

const START = '<!-- coverage:start -->';
const END = '<!-- coverage:end -->';
const check = process.argv.includes('--check');

let summary;
try {
  summary = JSON.parse(readFileSync('coverage/coverage-summary.json', 'utf8'));
} catch {
  console.error('coverage/coverage-summary.json not found; run "npm run coverage" first.');
  process.exit(2);
}
const t = summary.total;
const pct = (k) => `${t[k].pct.toFixed(1)} %`;
const table = [
  START,
  '| Statements | Branches | Functions | Lines |',
  '| ---: | ---: | ---: | ---: |',
  `| ${pct('statements')} | ${pct('branches')} | ${pct('functions')} | ${pct('lines')} |`,
  '',
  'Unit tests (Vitest, V8 coverage) over `src/`, excluding the DOM code in `src/ui/` and `src/main.js`.',
  END,
].join('\n');

const readme = readFileSync('README.md', 'utf8');
const a = readme.indexOf(START);
const b = readme.indexOf(END);
if (a < 0 || b < a) {
  console.error(`README.md lacks the ${START} ... ${END} markers.`);
  process.exit(2);
}
const next = readme.slice(0, a) + table + readme.slice(b + END.length);
if (check) {
  if (next !== readme) {
    console.error('README coverage table is out of date. Run "npm run coverage && npm run coverage:readme" and commit README.md.');
    console.error(table);
    process.exit(1);
  }
  console.log('README coverage table is current.');
} else {
  writeFileSync('README.md', next);
  console.log('README coverage table updated.');
}
