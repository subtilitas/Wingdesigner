// Writes the unit-test coverage table into README.md and README.de.md between the coverage
// markers, or with --check fails when a README table differs from coverage/coverage-summary.json.
// Usage: npm run coverage && npm run coverage:readme      (update)
//        npm run coverage && npm run coverage:check       (CI)
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

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

const FILES = [
  {
    file: 'README.md',
    head: '| Statements | Branches | Functions | Lines |',
    pct: (k) => `${t[k].pct.toFixed(1)} %`,
    note: 'Unit tests (Vitest, V8 coverage) over `src/`, excluding the DOM code in `src/ui/` and `src/main.js`.',
  },
  {
    file: 'README.de.md',
    head: '| Anweisungen | Verzweigungen | Funktionen | Zeilen |',
    pct: (k) => `${t[k].pct.toFixed(1).replace('.', ',')} %`,
    note: 'Unit-Tests (Vitest, V8-Coverage) über `src/`, ohne den DOM-Code in `src/ui/` und `src/main.js`.',
  },
];

let drift = false;
for (const f of FILES) {
  if (!existsSync(f.file)) continue;
  const table = [
    START,
    f.head,
    '| ---: | ---: | ---: | ---: |',
    `| ${f.pct('statements')} | ${f.pct('branches')} | ${f.pct('functions')} | ${f.pct('lines')} |`,
    '',
    f.note,
    END,
  ].join('\n');
  const readme = readFileSync(f.file, 'utf8');
  const a = readme.indexOf(START);
  const b = readme.indexOf(END);
  if (a < 0 || b < a) {
    console.error(`${f.file} lacks the ${START} ... ${END} markers.`);
    process.exit(2);
  }
  const next = readme.slice(0, a) + table + readme.slice(b + END.length);
  if (check) {
    if (next !== readme) {
      console.error(`${f.file}: coverage table is out of date. Run "npm run coverage && npm run coverage:readme" and commit.`);
      console.error(table);
      drift = true;
    } else {
      console.log(`${f.file}: coverage table is current.`);
    }
  } else {
    writeFileSync(f.file, next);
    console.log(`${f.file}: coverage table updated.`);
  }
}
if (drift) process.exit(1);
