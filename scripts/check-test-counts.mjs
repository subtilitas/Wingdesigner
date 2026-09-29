// Test counts in the documentation. README.md, README.de.md, RECORD.md and the wiki pages state the
// number of unit tests, test files, browser tests, spec files, runs, device-only tests and STEP
// validation cases. This check derives each number from the suites and exits with code 1 when a
// stated number differs or a statement is no longer found.
// Usage: node scripts/check-test-counts.mjs [--e2e-report <file>]
// --e2e-report: JSON report of a Playwright run (playwright.config.js writes
// playwright-report/results.json). test.skip decides at run time which tests run on one device only,
// so those counts are checked only with a report.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Unit tests and test files as Vitest collects them by running the files, so loops count each test. */
function unitCounts() {
  const dir = mkdtempSync(join(tmpdir(), 'test-counts-'));
  const out = join(dir, 'list.json');
  try {
    const cli = join(dirname(require.resolve('vitest/package.json')), 'vitest.mjs');
    const r = spawnSync(process.execPath, [cli, 'list', '--staticParse=false', `--json=${out}`], { cwd: root, encoding: 'utf8' });
    if (r.status !== 0) throw new Error(`vitest list failed (exit code ${r.status}):\n${r.stderr}`);
    const list = JSON.parse(readFileSync(out, 'utf8'));
    return { tests: list.length, files: new Set(list.map((t) => t.file)).size };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Playwright listing of every test in every project (no browser, no web server). */
function playwrightListing() {
  const cli = join(dirname(require.resolve('@playwright/test/package.json')), 'cli.js');
  const r = spawnSync(process.execPath, [cli, 'test', '--list', '--reporter=json'], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new Error(`playwright test --list failed (exit code ${r.status}):\n${r.stderr}`);
  return JSON.parse(r.stdout);
}

/**
 * Runs of a Playwright JSON report or listing: spec file (relative to the repository, with /), spec
 * id, project, status ('expected', 'skipped', 'unexpected', 'flaky'; 'skipped' for every run of a
 * listing) and expected status ('failed' for tests marked test.fail).
 */
export function playwrightRuns(report, base = root) {
  const rows = [];
  const walk = (suite, path) => {
    for (const spec of suite.specs ?? []) {
      const file = relative(base, join(report.config.rootDir, spec.file)).split(sep).join('/');
      // spec.id differs per project; file, line, column and title path identify the test.
      const id = [file, spec.line, spec.column, ...path, spec.title].join('\u0000');
      for (const t of spec.tests) rows.push({ file, spec: id, project: t.projectName, status: t.status, expectedStatus: t.expectedStatus });
    }
    for (const s of suite.suites ?? []) walk(s, [...path, s.title]);
  };
  for (const s of report.suites) walk(s, []);
  return rows;
}

/** Tests, spec files, runs and tests per spec file and project of a listing. */
export function e2eCounts(rows) {
  const perFile = {};
  for (const r of rows) {
    perFile[r.file] ??= { specs: new Set(), perProject: {} };
    perFile[r.file].specs.add(r.spec);
    perFile[r.file].perProject[r.project] = (perFile[r.file].perProject[r.project] ?? 0) + 1;
  }
  return {
    tests: new Set(rows.map((r) => r.spec)).size,
    files: Object.keys(perFile).length,
    runs: rows.length,
    marked: rows.filter((r) => r.expectedStatus === 'failed').length,
    perFile: Object.fromEntries(Object.entries(perFile).map(([f, v]) => [f, { tests: v.specs.size, perProject: v.perProject }])),
  };
}

/**
 * Results of a Playwright run: totals by status, and per spec file the tests that ran in exactly one
 * project (onlyIn[file][project]) or in none.
 */
export function runResults(rows) {
  const bySpec = new Map();
  for (const r of rows) {
    if (!bySpec.has(r.spec)) bySpec.set(r.spec, { file: r.file, ran: [], all: [] });
    bySpec.get(r.spec).all.push(r.project);
    if (r.status !== 'skipped') bySpec.get(r.spec).ran.push(r.project);
  }
  const onlyIn = {};
  let nowhere = 0;
  for (const { file, ran, all } of bySpec.values()) {
    if (ran.length === 0) nowhere++;
    else if (ran.length === 1 && all.length > 1) {
      onlyIn[file] ??= {};
      onlyIn[file][ran[0]] = (onlyIn[file][ran[0]] ?? 0) + 1;
    }
  }
  const count = (s) => rows.filter((r) => r.status === s).length;
  return { passed: count('expected'), skipped: count('skipped'), failed: count('unexpected') + count('flaky'), onlyIn, nowhere, marked: rows.filter((r) => r.expectedStatus === 'failed').length };
}

// A number as the documentation writes it: 1,234 (English) or 1 234 (German).
const N = String.raw`(\d{1,3}(?:[,\u00a0\u202f ]\d{3})*)`;
const num = (s) => Number(s.replace(/[,\u00a0\u202f ]/g, ''));
const re = (source, flags = 'g') => new RegExp(source.replaceAll('{n}', N), flags);

/**
 * Statements with numbers: file, what they state, a pattern with {n} for each number, how often the
 * pattern occurs, and the expected numbers (null: not known without a run report; the statement is
 * then only located).
 */
export function statements(c) {
  const unit = [c.unit.tests, c.unit.files];
  const e2e = [c.e2e.tests, c.e2e.files, c.e2e.runs];
  const limits = c.e2e.perFile['e2e/limits.spec.js'];
  const limitsPerProject = limits && new Set(Object.values(limits.perProject)).size === 1 ? Object.values(limits.perProject)[0] : null;
  const oneProject = c.run ? Object.values(c.run.onlyIn).reduce((s, o) => s + Object.values(o).reduce((a, b) => a + b, 0), 0) : null;
  const cases = c.cases.length;
  return [
    { file: 'README.md', what: 'unit tests', re: re(String.raw`npm test +# {n} unit tests \(Vitest\)`), n: 1, expect: [unit[0]] },
    { file: 'README.md', what: 'browser tests and runs', re: re(String.raw`then {n} Playwright tests on [^\n]*? \({n} runs\)`), n: 1, expect: [e2e[0], e2e[2]] },
    { file: 'README.md', what: 'files written by npm run step:cases', re: re(String.raw`write {n} STEP files, {n} 3MF files and cases\.json`), n: 1, expect: [cases, cases] },
    { file: 'README.md', what: 'STEP and 3MF validation wings', re: re(String.raw`reads (?:the )?{n} test wings`), n: 2, expect: [cases] },
    { file: 'README.de.md', what: 'unit tests', re: re(String.raw`npm test +# {n} Unit-Tests \(Vitest\)`), n: 1, expect: [unit[0]] },
    { file: 'README.de.md', what: 'browser tests and runs', re: re(String.raw`dann {n} Playwright-Tests auf [^\n]*? \({n} Läufe\)`), n: 1, expect: [e2e[0], e2e[2]] },
    { file: 'README.de.md', what: 'files written by npm run step:cases', re: re(String.raw`# {n} STEP-Dateien, {n} 3MF-Dateien und cases\.json nach`), n: 1, expect: [cases, cases] },
    { file: 'README.de.md', what: 'STEP and 3MF validation wings', re: re(String.raw`liest (?:die )?{n} Testflügel`), n: 2, expect: [cases] },
    { file: 'docs/wiki/Development.md', what: 'unit tests and files', re: re(String.raw`Node\.js: {n} tests in {n} files \|`), n: 1, expect: unit },
    { file: 'docs/wiki/Development.md', what: 'browser tests, spec files and runs', re: re(String.raw`^{n} tests in {n} spec files, {n} runs \(both projects\)`, 'gm'), n: 1, expect: e2e },
    { file: 'docs/wiki/Development.md', what: 'tests that run in one project only', re: re(String.raw`^{n} tests run in one project only`, 'gm'), n: 1, expect: [oneProject] },
    { file: 'docs/wiki/Development.md', what: 'files written by npm run step:cases', re: re(String.raw`{n} STEP files, {n} 3MF files and \`cases\.json\``), n: 1, expect: [cases, cases] },
    { file: 'docs/wiki/Development.md', what: 'no test marked test.fail', re: /^No test is marked `test\.fail`\.$/gm, n: c.e2e.marked === 0 && (c.run?.marked ?? 0) === 0 ? 1 : 0, expect: [] },
    { file: 'docs/wiki/Entwicklung.md', what: 'unit tests and files', re: re(String.raw`Node\.js: {n} Tests in {n} Dateien \|`), n: 1, expect: unit },
    { file: 'docs/wiki/Entwicklung.md', what: 'browser tests, spec files and runs', re: re(String.raw`^{n} Tests in {n} Spec-Dateien, {n} Läufe \(beide Projekte\)`, 'gm'), n: 1, expect: e2e },
    { file: 'docs/wiki/Entwicklung.md', what: 'tests that run in one project only', re: re(String.raw`^{n} Tests laufen nur in einem Projekt`, 'gm'), n: 1, expect: [oneProject] },
    { file: 'docs/wiki/Entwicklung.md', what: 'files written by npm run step:cases', re: re(String.raw`{n} STEP-Dateien, {n} 3MF-Dateien und \`cases\.json\``), n: 1, expect: [cases, cases] },
    { file: 'docs/wiki/Entwicklung.md', what: 'no test marked test.fail', re: /^Kein Test ist mit `test\.fail` markiert\.$/gm, n: c.e2e.marked === 0 && (c.run?.marked ?? 0) === 0 ? 1 : 0, expect: [] },
    { file: 'docs/wiki/Geometry.md', what: 'STEP validation cases', re: re(String.raw`the {n} cases of \`test/step-cases\.js\``), n: 1, expect: [cases] },
    { file: 'docs/wiki/Geometrie.md', what: 'STEP validation cases', re: re(String.raw`die {n} Fälle aus \`test/step-cases\.js\``), n: 1, expect: [cases] },
    { file: 'RECORD.md', what: 'unit tests, files and passes', re: re(String.raw`\| {n} tests in {n} files \(Vitest\) \| \`npm test\` on \d{4}-\d{2}-\d{2}: {n} of {n} pass \|`), n: 1, expect: [...unit, unit[0], unit[0]] },
    {
      file: 'RECORD.md',
      what: 'browser spec files, tests, runs and results',
      re: re(String.raw`Playwright: {n} spec files [^|]*?{n} tests, {n} runs on \d{4}-\d{2}-\d{2} \([^)]*\): {n} passed, {n} skipped \([^)]*\), {n} failed\.`),
      n: 1,
      expect: [e2e[1], e2e[0], e2e[2], c.run ? e2e[2] - c.run.skipped : null, c.run?.skipped ?? null, c.run ? 0 : null],
      // Without a report the results still add up to the runs.
      sum: [[3, 4, 5], 2],
    },
    { file: 'RECORD.md', what: 'limits.spec.js tests per project', re: re(String.raw`\`e2e/limits\.spec\.js\` \({n} tests per project\)`), n: 1, expect: [limitsPerProject] },
    { file: 'RECORD.md', what: 'STEP validation cases', re: re(String.raw`validate_step\.py\` with OpenCascade \([^)]*\): {n} cases`), n: 1, expect: [cases] },
    { file: 'RECORD.md', what: '3MF validation cases', re: re(String.raw`validate_3mf\.py\` with lib3mf [\d.]+ in strict mode: {n} cases`), n: 1, expect: [cases] },
  ];
}

const lineOf = (text, index) => text.slice(0, index).split('\n').length;

/** Lines of the first Markdown table after the line that matches `anchor`. */
function tableAfter(text, anchor) {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => anchor.test(l));
  if (start < 0) return null;
  let i = start + 1;
  while (i < lines.length && !lines[i].startsWith('|')) {
    if (/^#/.test(lines[i])) return null;
    i++;
  }
  const rows = [];
  for (; i < lines.length && lines[i].startsWith('|'); i++) rows.push({ line: i + 1, cells: lines[i].split('|').slice(1, -1).map((s) => s.trim()) });
  return rows;
}

/** Device-only table: one row per spec file with tests that run in one project only. */
function deviceTable(file, text, anchor, run, problems) {
  const rows = tableAfter(text, anchor);
  if (!rows || rows.length < 2) return problems.push(`${file}: table of tests that run in one project only not found`);
  const projects = rows[0].cells.slice(1).map((h) => h.match(/`([^`]+)`/)?.[1]);
  if (!run) return;
  const seen = new Set();
  for (const { line, cells } of rows.slice(2)) {
    const f = cells[0].match(/^`([^`]+)`$/)?.[1];
    seen.add(f);
    projects.forEach((p, k) => {
      const stated = Number(cells[k + 1].match(/^(\d+)/)?.[1]);
      const actual = run.onlyIn[f]?.[p] ?? 0;
      if (stated !== actual) problems.push(`${file}:${line}: ${f}, tests only in ${p}: stated ${cells[k + 1].match(/^\d+/)?.[0] ?? '(no number)'}, the run has ${actual}`);
    });
  }
  for (const f of Object.keys(run.onlyIn)) if (!seen.has(f)) problems.push(`${file}: ${f} has tests that run in one project only (${JSON.stringify(run.onlyIn[f])}) but no row in the table`);
}

/** STEP case table: case names in the order of test/step-cases.js, solids 2 when mirrored, else 1. */
function caseTable(file, text, anchor, cases, problems) {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => anchor.test(l));
  if (start < 0) return problems.push(`${file}: STEP case table not found`);
  const tables = [];
  for (let i = start + 1; i < lines.length && !/^#/.test(lines[i]); i++) {
    if (lines[i].startsWith('|') && !lines[i - 1].startsWith('|')) tables.push([]);
    if (lines[i].startsWith('|')) tables.at(-1).push({ line: i + 1, cells: lines[i].split('|').slice(1, -1).map((s) => s.trim()) });
  }
  const table = tables.find((t) => t.slice(2).some((r) => /^`[\w-]+`$/.test(r.cells[0])));
  if (!table) return problems.push(`${file}: STEP case table not found`);
  const rows = table.slice(2);
  const stated = rows.map((r) => r.cells[0].replace(/`/g, ''));
  const actual = cases.map((c) => c.name);
  if (stated.join() !== actual.join()) problems.push(`${file}:${rows[0].line}: STEP cases ${stated.join(', ')}; test/step-cases.js has ${actual.join(', ')}`);
  for (const { line, cells } of rows) {
    const c = cases.find((x) => x.name === cells[0].replace(/`/g, ''));
    if (c && Number(cells.at(-1)) !== (c.mirror ? 2 : 1)) problems.push(`${file}:${line}: ${c.name}: ${cells.at(-1)} solids stated, ${c.mirror ? 2 : 1} expected (mirror ${c.mirror})`);
  }
}

/**
 * Problems of the documentation `docs` ({ path: text }) against the counts `c`:
 * { unit: { tests, files }, e2e: e2eCounts(...), run: runResults(...) or null, cases: [{ name, mirror }] }.
 */
export function checkCounts(docs, c) {
  const problems = [];
  for (const s of statements(c)) {
    const text = docs[s.file];
    if (text === undefined) {
      problems.push(`${s.file}: file missing`);
      continue;
    }
    const matches = [...text.matchAll(s.re)];
    if (matches.length !== s.n) {
      problems.push(`${s.file}: statement on ${s.what} found ${matches.length} times, expected ${s.n} (pattern ${s.re.source.replaceAll(N, '{n}')})`);
      continue;
    }
    for (const m of matches) {
      const got = m.slice(1).map(num);
      const at = `${s.file}:${lineOf(text, m.index)}`;
      s.expect.forEach((e, k) => {
        if (e !== null && got[k] !== e) problems.push(`${at}: ${s.what}: stated ${m[k + 1]}, the suite has ${e}`);
      });
      if (s.sum) {
        const [parts, total] = s.sum;
        const sum = parts.reduce((a, k) => a + got[k], 0);
        if (sum !== got[total]) problems.push(`${at}: ${s.what}: ${parts.map((k) => m[k + 1]).join(' + ')} = ${sum}, not the stated ${m[total + 1]}`);
      }
    }
  }
  if (c.run?.nowhere) problems.push(`the run skipped ${c.run.nowhere} tests in every project; the documentation states no such tests`);
  deviceTable('docs/wiki/Development.md', docs['docs/wiki/Development.md'] ?? '', /^\d.* tests run in one project only/, c.run, problems);
  deviceTable('docs/wiki/Entwicklung.md', docs['docs/wiki/Entwicklung.md'] ?? '', /^\d.* Tests laufen nur in einem Projekt/, c.run, problems);
  caseTable('docs/wiki/Development.md', docs['docs/wiki/Development.md'] ?? '', /^Cases from `test\/step-cases\.js`/, c.cases, problems);
  caseTable('docs/wiki/Entwicklung.md', docs['docs/wiki/Entwicklung.md'] ?? '', /^Testfälle aus `test\/step-cases\.js`/, c.cases, problems);
  return problems;
}

export const DOC_FILES = ['README.md', 'README.de.md', 'RECORD.md', 'docs/wiki/Development.md', 'docs/wiki/Entwicklung.md', 'docs/wiki/Geometry.md', 'docs/wiki/Geometrie.md'];

async function main() {
  const at = process.argv.indexOf('--e2e-report');
  const reportFile = at > 0 ? process.argv[at + 1] : null;
  if (at > 0 && !reportFile) throw new Error('--e2e-report needs a file');
  const { stepCases } = await import(pathToFileURL(join(root, 'test/step-cases.js')).href);
  const counts = {
    unit: unitCounts(),
    e2e: e2eCounts(playwrightRuns(playwrightListing())),
    run: reportFile ? runResults(playwrightRuns(JSON.parse(readFileSync(reportFile, 'utf8')))) : null,
    cases: stepCases().map((s) => ({ name: s.name, mirror: s.mirror })),
  };
  const docs = Object.fromEntries(DOC_FILES.map((f) => [f, readFileSync(join(root, f), 'utf8')]));
  const problems = checkCounts(docs, counts);
  if (counts.run && counts.run.failed) problems.push(`the run has ${counts.run.failed} failed tests; the counts are checked against a passing run`);
  if (problems.length) {
    console.error(problems.join('\n'));
    process.exit(1);
  }
  const { unit, e2e, run, cases } = counts;
  console.log(
    `Test counts match: ${unit.tests} unit tests in ${unit.files} files, ${e2e.tests} browser tests in ${e2e.files} spec files (${e2e.runs} runs), ${cases.length} STEP cases.` +
      (run ? ` Run: ${run.passed} passed, ${run.skipped} skipped.` : ' Device-only counts not checked (no --e2e-report).'),
  );
}

// Runs the check unless Vitest imports the module for test/counts.test.js. A comparison of
// import.meta.url with process.argv[1] would skip the check silently behind a symbolic link.
if (!process.env.VITEST) await main();
