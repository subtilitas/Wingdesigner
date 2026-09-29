// Documentation check: every English page has its German counterpart, wiki links resolve,
// referenced images exist, and both READMEs carry the coverage markers.
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

function main() {
  const problems = [];
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
  console.log(`${files.length} documentation files checked.`);
}

// Runs the check unless Vitest imports the module for test/docs.test.js.
if (!process.env.VITEST) main();
