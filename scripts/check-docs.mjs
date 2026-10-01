// Documentation check: every English page has its German counterpart, wiki links resolve,
// referenced images exist, both READMEs carry the coverage markers, and the release texts in
// CHANGELOG.md name no contributor material.
// Usage: node scripts/check-docs.mjs
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import MarkdownIt from 'markdown-it';

const WIKI = 'docs/wiki';
// GitHub renders HTML in Markdown: HTML blocks end tables as they do there.
const markdown = new MarkdownIt({ html: true });
export const PAGE_PAIRS = [
  ['README.md', 'README.de.md'],
  [`${WIKI}/User-Guide.md`, `${WIKI}/Benutzerhandbuch.md`],
  [`${WIKI}/Geometry.md`, `${WIKI}/Geometrie.md`],
  [`${WIKI}/File-Formats.md`, `${WIKI}/Dateiformate.md`],
  [`${WIKI}/Airfoil-Sources.md`, `${WIKI}/Profilquellen.md`],
  [`${WIKI}/Development.md`, `${WIKI}/Entwicklung.md`],
];

/**
 * Indexes of the lines that start a table row (header and body rows), as a CommonMark parser with
 * GitHub tables and HTML reads the text: fenced code, block quotes, HTML blocks, rows without outer
 * pipes and the end of a table at the next block follow the Markdown rules.
 */
export function tableRows(text) {
  return markdown.parse(text, {}).filter((t) => t.type === 'tr_open').map((t) => t.map[0]);
}

// Delimiter row of a table after any block-quote markers: dashes with optional colons and at least one |.
const DELIMITER = /^\s*(\|?(\s*:?-+:?\s*\|)+\s*(:?-+:?\s*)?|\|\s*:?-+:?\s*)$/;
const unquote = (line) => line.replace(/^(\s*>)+/, '');

/**
 * Table problems a wiki reader sees:
 * - a cell holds [[ without ]] after it: a | inside [[Label|Page]] ended the cell and split the link
 *   (code spans do not count, they show the text as it is);
 * - a header and delimiter row that form no table: a | in the header, e.g. in a wiki link, gives
 *   the header more cells than the delimiter row, and the whole table shows as text.
 */
export function tableLinkProblems(text, file) {
  const tokens = markdown.parse(text, {});
  const lines = text.split('\n');
  const problems = [];
  let row = null;
  for (const t of tokens) {
    if (t.type === 'tr_open') row = t.map[0];
    if (t.type === 'table_close') row = null;
    if (t.type !== 'inline' || row === null) continue;
    const plain = t.children.filter((c) => c.type === 'text').map((c) => c.content).join('');
    if (/\[\[(?![^\]]*\]\])/.test(plain) && !problems.some((p) => p.startsWith(`${file}:${row + 1}:`))) {
      problems.push(`${file}:${row + 1}: wiki link split by the | of a table cell; in tables a wiki link holds only the page title`);
    }
  }
  const covered = new Set();
  for (const t of tokens) {
    if (['table_open', 'fence', 'code_block', 'html_block'].includes(t.type) && t.map) for (let i = t.map[0]; i < t.map[1]; i++) covered.add(i);
  }
  lines.forEach((line, i) => {
    if (i > 0 && !covered.has(i) && DELIMITER.test(unquote(line)) && unquote(lines[i - 1]).includes('|')) {
      problems.push(`${file}:${i}: the header and delimiter rows form no table (a | in the header, e.g. in a wiki link?)`);
    }
  });
  return problems;
}

/**
 * Terms of contributor material that release texts leave out. `release.yml` publishes the
 * `CHANGELOG.md` section of a version as its release notes; they describe the app, its files and
 * its user documentation.
 */
export const INTERNAL_TERMS = [
  [/handover/gi, 'the handover'],
  [/\bRECORD\b/g, 'RECORD.md'],
  [/\bnpm\s+(?:run|test|ci|install|i|exec|start|version|publish)\b|\bnpx\b/g, 'an npm command'],
  [/(?<![\w/.-])(?:\.\/)?(?:scripts|test|e2e|src|public|\.github)\/|\/(?:blob|tree)\/\S*?\/(?:scripts|test|e2e|src|public|\.github)\//g, 'a path of the repository'],
  [/\b(?:ci|docs|release)\.yml\b|\bcontinuous\s+integration\b/gi, 'continuous integration'],
  [/\bCI\b/g, 'continuous integration'],
  [/\b(?:unit|browser|end-to-end|e2e|integration|regression|smoke|snapshot|component|acceptance|automated)\s+tests?\b|\btest\s+(?:suites?|runs?|cases?|files?|counts?)\b|\bVitest\b|\bPlaywright\b|\.spec\.js\b/gi, 'tests'],
  [/\b(?:test|code|line|branch|statement|V8)\s+coverage\b|\bcoverage\s+(?:check|table|report|markers?)\b/gi, 'test coverage'],
  [/\[\[(?:Development|Entwicklung)\b|\b(?:Development|Entwicklung)(?:\s+(?:page|wiki)\b|,\s+section\b|\s+\/\s+Entwicklung\b)/g, 'the Development page'],
];

/**
 * Names that the JavaScript files under `dir` declare: `functions` holds function and class names
 * in camelCase or PascalCase, `constants` upper-case names of 3 or more characters declared with
 * `const`, `let` or `var`.
 */
export function sourceNames(dir = 'src') {
  const functions = new Set();
  const constants = new Set();
  for (const f of readdirSync(dir, { recursive: true })) {
    if (!String(f).endsWith('.js')) continue;
    const text = readFileSync(join(dir, String(f)), 'utf8');
    const declared = [
      ...text.matchAll(/\bfunction\s*\*?\s*([A-Za-z_$][\w$]*)\s*\(/g),
      ...text.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?(?:function\b|\([^()]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>)/g),
      ...text.matchAll(/\bclass\s+([A-Za-z_$][\w$]*)/g),
    ];
    for (const m of declared) if (/^[a-z_$][\w$]*[A-Z]|^[A-Z][a-z]/.test(m[1])) functions.add(m[1]);
    for (const m of text.matchAll(/\b(?:const|let|var)\s+([A-Z][A-Z0-9_]{2,})\b/g)) constants.add(m[1]);
  }
  return { functions, constants };
}

/** Keys of the project file that the File Formats page documents: JSON keys and first table cells. */
export function formatKeys(file = `${WIKI}/File-Formats.md`) {
  const text = readFileSync(file, 'utf8');
  const keys = new Set([...text.matchAll(/"([A-Za-z_]\w*)"\s*:/g)].map((m) => m[1]));
  for (const m of text.matchAll(/^\|\s*`([A-Za-z_][\w.[\]*]*)`/gm)) for (const part of m[1].split(/[.[\]*]+/)) if (part) keys.add(part);
  return keys;
}

/**
 * Lines of the version sections of a changelog (from the first `## ` heading on) that name
 * contributor material: a term of `INTERNAL_TERMS`, or a code span that holds a function call, or a
 * function, class or constant that `names` lists and `keys` (the project file format) does not.
 * Each line is read together with the next one, so a term broken over two lines is found and
 * reported on the line where it starts.
 */
export function changelogProblems(text, file = 'CHANGELOG.md', names = {}, keys = new Set()) {
  const { functions = new Set(), constants = new Set() } = names;
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => l.startsWith('## '));
  const problems = [];
  if (start < 0) return problems;
  const report = (i, what, found) => problems.push(`${file}:${i + 1}: release text names ${what} (${found}); release notes describe the app, its files and its user documentation`);
  for (let i = start; i < lines.length; i++) {
    const line = lines[i].trimEnd();
    const joined = `${line} ${(lines[i + 1] ?? '').trim()}`;
    for (const [pattern, what] of INTERNAL_TERMS) {
      for (const m of joined.matchAll(pattern)) if (m.index < line.length) report(i, what, m[0].replace(/\s+/g, ' '));
    }
    for (const m of line.matchAll(/`([A-Za-z_$][\w$.]*)(\([^`]*\))?`/g)) {
      const name = m[1].split('.').pop();
      if (keys.has(name)) continue;
      if (constants.has(name)) report(i, 'a constant of the source code', m[0]);
      else if (m[2] || functions.has(name)) report(i, 'a function of the source code', m[0]);
    }
  }
  return problems;
}

function main() {
  const problems = [];
  // release.yml reads the release notes from CHANGELOG.md.
  if (!existsSync('CHANGELOG.md')) problems.push('missing CHANGELOG.md');
  else problems.push(...changelogProblems(readFileSync('CHANGELOG.md', 'utf8'), 'CHANGELOG.md', sourceNames(), formatKeys()));
  for (const [en, de] of PAGE_PAIRS) {
    for (const f of [en, de]) if (!existsSync(f)) problems.push(`missing page ${f}`);
  }
  for (const f of ['README.md', 'README.de.md']) {
    if (!existsSync(f)) continue;
    const t = readFileSync(f, 'utf8');
    if (!t.includes('<!-- coverage:start -->') || !t.includes('<!-- coverage:end -->')) problems.push(`${f}: coverage markers missing`);
  }

  const wikiPages = new Set(readdirSync(WIKI).filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3)));
  const files = [...readdirSync(WIKI).filter((f) => f.endsWith('.md')).map((f) => join(WIKI, f)), 'README.md', 'README.de.md'].filter(existsSync);
  for (const f of files) {
    const text = readFileSync(f, 'utf8');
    const base = f.startsWith(WIKI) ? WIKI : '.';
    problems.push(...tableLinkProblems(text, f));
    for (const m of text.matchAll(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g)) {
      const target = (m[2] ?? m[1]).trim().replace(/#.*$/, '');
      if (/\.(png|jpg|svg)$/i.test(target)) continue;
      if (!wikiPages.has(target.replace(/ /g, '-'))) problems.push(`${f}: wiki link [[${m[0].slice(2, -2)}]] has no page ${target}`);
    }
    for (const m of text.matchAll(/!\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g)) {
      const src = m[2];
      if (/^https?:/.test(src)) continue;
      if (!existsSync(join(base, src))) problems.push(`${f}: image ${src} not found`);
      if (!m[1].trim()) problems.push(`${f}: image ${src} has no alt text`);
    }
    for (const m of text.matchAll(/(?<!!)\[[^\]]+\]\(((?!https?:|#|mailto:)[^)\s]+)\)/g)) {
      const target = m[1].replace(/#.*$/, '');
      if (target && !existsSync(join(base, target))) problems.push(`${f}: link ${target} not found`);
    }
  }
  if (problems.length) {
    console.error(problems.join('\n'));
    process.exit(1);
  }
  console.log(`${files.length} documentation files and CHANGELOG.md checked.`);
}

// Runs the check unless Vitest imports the module for test/docs.test.js.
if (!process.env.VITEST) main();
