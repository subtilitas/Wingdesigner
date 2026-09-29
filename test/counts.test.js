// scripts/check-test-counts.mjs on small documentation texts in the form of the real pages.
import { describe, expect, it } from 'vitest';
import { checkCounts, e2eCounts, playwrightRuns, runResults } from '../scripts/check-test-counts.mjs';

// Playwright JSON: every spec appears once per project, each with its own id.
const spec = (title, line, project, status) => ({ title, id: `${project}-${line}`, file: 'a.spec.js', line, column: 3, tests: [{ projectName: project, status, expectedStatus: 'passed' }] });
function report(statuses) {
  const specs = [];
  for (const [project, list] of Object.entries(statuses)) list.forEach((status, i) => specs.push(spec(`test ${i}`, 10 * (i + 1), project, status)));
  return {
    config: { rootDir: '/repo/e2e' },
    suites: [
      { title: 'a.spec.js', file: 'a.spec.js', specs: [], suites: [{ title: 'group', specs }] },
      { title: 'limits.spec.js', file: 'limits.spec.js', specs: [spec('big', 5, 'desktop', 'expected'), spec('big', 5, 'mobile', 'expected')].map((s) => ({ ...s, file: 'limits.spec.js' })) },
    ],
  };
}
// a.spec.js: test 0 runs on the desktop only, test 1 on the phone only, test 2 on both.
const RUN = report({ desktop: ['expected', 'skipped', 'expected'], mobile: ['skipped', 'expected', 'expected'] });
const CASES = [
  { name: 'alpha', mirror: true },
  { name: 'beta', mirror: false },
];

function counts() {
  const e2e = e2eCounts(playwrightRuns(RUN, '/repo'));
  return { unit: { tests: 1234, files: 3 }, e2e, run: runResults(playwrightRuns(RUN, '/repo')), cases: CASES };
}

// Numbers as the pages state them for counts(): 4 browser tests in 2 spec files, 8 runs, 2 run in
// one project only, 6 passed and 2 skipped.
function docs(k = {}) {
  const v = { unit: '1,234', unitDe: '1 234', files: 3, tests: 4, specs: 2, runs: 8, one: 2, d: 1, m: 1, passed: 6, skipped: 2, limits: 1, cases: 2, caseRows: '| `alpha` | None | 2 |\n| `beta` | Half | 1 |', ...k };
  const devTable = `| Spec file | \`desktop\` only | \`mobile\` only |\n| --- | --- | --- |\n| \`e2e/a.spec.js\` | ${v.d}: mouse | ${v.m}: touch |`;
  const deTable = `| Spec-Datei | nur \`desktop\` | nur \`mobile\` |\n| --- | --- | --- |\n| \`e2e/a.spec.js\` | ${v.d}: Maus | ${v.m}: Touch |`;
  return {
    'README.md': `npm test                 # ${v.unit} unit tests (Vitest)
npm run e2e              # production build, then ${v.tests} Playwright tests on desktop 1280 x 720 and Pixel 7 (${v.runs} runs)
npm run step:cases       # write ${v.cases} STEP files, ${v.cases} 3MF files and cases.json to step-check/
| STEP | CI: \`scripts/validate_step.py\` reads ${v.cases} test wings with OpenCascade |
| 3MF | CI: \`scripts/validate_3mf.py\` reads the ${v.cases} test wings with lib3mf |`,
    'README.de.md': `npm test                 # ${v.unitDe} Unit-Tests (Vitest)
npm run e2e              # Produktions-Build, dann ${v.tests} Playwright-Tests auf Desktop 1280 x 720 und Pixel 7 (${v.runs} Läufe)
npm run step:cases       # ${v.cases} STEP-Dateien, ${v.cases} 3MF-Dateien und cases.json nach step-check/ schreiben
| STEP | CI: \`scripts/validate_step.py\` liest ${v.cases} Testflügel mit OpenCascade |
| 3MF | CI: \`scripts/validate_3mf.py\` liest die ${v.cases} Testflügel mit lib3mf |`,
    'docs/wiki/Development.md': `| \`npm test\` | \`vitest run\` | Unit tests \`test/**/*.test.js\` in Node.js: ${v.unit} tests in ${v.files} files |
| \`npm run step:cases\` | \`node scripts/export-step-cases.mjs step-check\` | ${v.cases} STEP files, ${v.cases} 3MF files and \`cases.json\` in \`step-check/\` |

${v.tests} tests in ${v.specs} spec files, ${v.runs} runs (both projects).

${v.one} tests run in one project only (\`test.skip\` in the other project):

${devTable}

No test is marked \`test.fail\`.

Cases from \`test/step-cases.js\`. Base wing:

| Section | y (mm) |
| ---: | ---: |
| 1 | 0 |

| Case | Change from the base wing | Solids |
| --- | --- | ---: |
${v.caseRows}
`,
    'docs/wiki/Entwicklung.md': `| \`npm test\` | \`vitest run\` | Unit-Tests \`test/**/*.test.js\` in Node.js: ${v.unitDe} Tests in ${v.files} Dateien |
| \`npm run step:cases\` | \`node scripts/export-step-cases.mjs step-check\` | ${v.cases} STEP-Dateien, ${v.cases} 3MF-Dateien und \`cases.json\` in \`step-check/\` |

${v.tests} Tests in ${v.specs} Spec-Dateien, ${v.runs} Läufe (beide Projekte).

${v.one} Tests laufen nur in einem Projekt (\`test.skip\` im anderen Projekt):

${deTable}

Kein Test ist mit \`test.fail\` markiert.

Testfälle aus \`test/step-cases.js\`. Basisflügel:

| Fall | Abweichung vom Basisflügel | Volumenkörper |
| --- | --- | ---: |
${v.caseRows}
`,
    'docs/wiki/Geometry.md': `Cases: the ${v.cases} cases of \`test/step-cases.js\`.`,
    'docs/wiki/Geometrie.md': `Fälle: die ${v.cases} Fälle aus \`test/step-cases.js\`.`,
    'RECORD.md': `| Project size | Limits | \`e2e/limits.spec.js\` (${v.limits} tests per project) passed |
| UI | Views | Playwright: ${v.specs} spec files on desktop and Pixel 7. ${v.tests} tests, ${v.runs} runs on 2026-09-29 (local, Chromium 141): ${v.passed} passed, ${v.skipped} skipped (tests for one device only), 0 failed. |
| Unit tests (\`test/\`) | ${v.unit} tests in ${v.files} files (Vitest) | \`npm test\` on 2026-09-29: ${v.unit} of ${v.unit} pass |
| STEP export | Solids | \`scripts/validate_step.py\` with OpenCascade (cadquery-ocp 8.0.1): ${v.cases} cases, all valid |
| 3MF | Meshes | \`scripts/validate_3mf.py\` with lib3mf 2.5.0 in strict mode: ${v.cases} cases, no reader warnings |`,
  };
}

describe('test count check', () => {
  it('derives tests, runs and device-only tests from Playwright JSON, one test per spec in all projects', () => {
    const c = counts();
    expect(c.e2e).toMatchObject({ tests: 4, files: 2, runs: 8, marked: 0 });
    expect(c.e2e.perFile['e2e/limits.spec.js']).toEqual({ tests: 1, perProject: { desktop: 1, mobile: 1 } });
    expect(c.run).toMatchObject({ passed: 6, skipped: 2, failed: 0, nowhere: 0, onlyIn: { 'e2e/a.spec.js': { desktop: 1, mobile: 1 } } });
  });

  it('accepts pages whose numbers match, with English and German thousands separators', () => {
    expect(checkCounts(docs(), counts())).toEqual([]);
  });

  it('names every statement of a changed unit test count with file and line', () => {
    const c = counts();
    c.unit.tests = 1235;
    const p = checkCounts(docs(), c);
    expect(p).toHaveLength(7);
    expect(p).toContain('README.md:1: unit tests: stated 1,234, the suite has 1235');
    expect(p).toContain('README.de.md:1: unit tests: stated 1 234, the suite has 1235');
    expect(p.filter((x) => x.startsWith('RECORD.md:3:'))).toHaveLength(3);
  });

  it('fails when a statement is missing or occurs a different number of times', () => {
    const d = docs();
    d['docs/wiki/Geometry.md'] = 'Cases: the cases of `test/step-cases.js`.';
    d['README.md'] = d['README.md'].replace('reads the 2 test wings', 'reads the 2 wings');
    const p = checkCounts(d, counts());
    expect(p.some((x) => x.startsWith('docs/wiki/Geometry.md: statement on STEP validation cases found 0 times, expected 1'))).toBe(true);
    expect(p.some((x) => x.startsWith('README.md: statement on STEP and 3MF validation wings found 1 times, expected 2'))).toBe(true);
    expect(p).toHaveLength(2);
  });

  it('checks run results against the runs, and device-only counts only with a run report', () => {
    const c = counts();
    expect(checkCounts(docs({ passed: 7 }), c)).toEqual(['RECORD.md:2: browser spec files, tests, runs and results: stated 7, the suite has 6', 'RECORD.md:2: browser spec files, tests, runs and results: 7 + 2 + 0 = 9, not the stated 8']);
    expect(checkCounts(docs({ d: 2, one: 3 }), c)).toEqual([
      'docs/wiki/Development.md:6: tests that run in one project only: stated 3, the suite has 2',
      'docs/wiki/Entwicklung.md:6: tests that run in one project only: stated 3, the suite has 2',
      'docs/wiki/Development.md:10: e2e/a.spec.js, tests only in desktop: stated 2, the run has 1',
      'docs/wiki/Entwicklung.md:10: e2e/a.spec.js, tests only in desktop: stated 2, the run has 1',
    ]);
    c.run = null;
    // Without a report: the device-only numbers are not known, the results still add up.
    expect(checkCounts(docs({ d: 2, one: 3, passed: 5, skipped: 3 }), c)).toEqual([]);
    expect(checkCounts(docs({ passed: 7 }), c)).toEqual(['RECORD.md:2: browser spec files, tests, runs and results: 7 + 2 + 0 = 9, not the stated 8']);
  });

  it('requires a device-only table row for every spec file with tests in one project only', () => {
    const d = docs();
    d['docs/wiki/Entwicklung.md'] = d['docs/wiki/Entwicklung.md'].replace('| `e2e/a.spec.js` | 1: Maus | 1: Touch |', '| `e2e/b.spec.js` | 0 | 0 |');
    expect(checkCounts(d, counts())).toEqual(['docs/wiki/Entwicklung.md: e2e/a.spec.js has tests that run in one project only ({"desktop":1,"mobile":1}) but no row in the table']);
  });

  it('compares the STEP case table with test/step-cases.js: names in order, 2 solids when mirrored', () => {
    const swapped = docs({ caseRows: '| `beta` | Half | 1 |\n| `alpha` | None | 2 |' });
    expect(checkCounts(swapped, counts())).toEqual([
      'docs/wiki/Development.md:22: STEP cases beta, alpha; test/step-cases.js has alpha, beta',
      'docs/wiki/Entwicklung.md:18: STEP cases beta, alpha; test/step-cases.js has alpha, beta',
    ]);
    const solids = docs({ caseRows: '| `alpha` | None | 1 |\n| `beta` | Half | 1 |' });
    expect(checkCounts(solids, counts())).toEqual([
      'docs/wiki/Development.md:22: alpha: 1 solids stated, 2 expected (mirror true)',
      'docs/wiki/Entwicklung.md:18: alpha: 1 solids stated, 2 expected (mirror true)',
    ]);
  });

  it('drops the test.fail sentence once a test is marked test.fail', () => {
    const c = counts();
    c.e2e.marked = 1;
    const p = checkCounts(docs(), c);
    expect(p).toEqual([
      'docs/wiki/Development.md: statement on no test marked test.fail found 1 times, expected 0 (pattern ^No test is marked `test\\.fail`\\.$)',
      'docs/wiki/Entwicklung.md: statement on no test marked test.fail found 1 times, expected 0 (pattern ^Kein Test ist mit `test\\.fail` markiert\\.$)',
    ]);
  });
});
