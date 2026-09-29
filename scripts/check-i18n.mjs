// Translation check: every tr() key in src/ has a German entry with the same {placeholders}, every
// German entry is used, no key has two different German texts, and every tr() call starts with a
// string literal (the key), so this check sees every key.
// Usage: node scripts/check-i18n.mjs
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Source files under src/ outside src/i18n/, as { path: text } with / in paths. */
export function sourceFiles(dir = join(root, 'src')) {
  const out = {};
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) {
        if (relative(root, p).split(sep).join('/') !== 'src/i18n') walk(p);
      } else if (e.name.endsWith('.js')) out[relative(root, p).split(sep).join('/')] = readFileSync(p, 'utf8');
    }
  };
  walk(dir);
  return out;
}

// Comments may mention tr(...) without a literal: block comments and whole-line // comments go.
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/^([ \t]*)\/\/.*$/gm, '$1');
const lineOf = (s, i) => s.slice(0, i).split('\n').length;
const LITERAL = /\btr\(\s*('(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\$])*`)\s*[,)]/g;
const CALL = /\btr\(/g;

/** Keys of the tr() calls in `text`, and the calls whose first argument is not a string literal. */
export function extractKeys(text, file) {
  const s = stripComments(text);
  const keys = [];
  const literalAt = new Set();
  for (const m of s.matchAll(LITERAL)) {
    literalAt.add(m.index);
    // A string literal of our own source without ${}: evaluating it gives the key.
    keys.push({ key: new Function(`return ${m[1]};`)(), file, line: lineOf(s, m.index) });
  }
  const bad = [];
  for (const m of s.matchAll(CALL)) {
    if (literalAt.has(m.index)) continue;
    // The definition and imports are not calls.
    if (/function\s+$/.test(s.slice(Math.max(0, m.index - 12), m.index))) continue;
    bad.push({ file, line: lineOf(s, m.index) });
  }
  return { keys, bad };
}

const placeholders = (text) => [...new Set([...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].sort().join(',');

/** Problems of the German `areas` ({ name: { key: entry } }) against the tr() calls in `sources`. */
export function checkI18n(sources, areas) {
  const problems = [];
  const used = new Map();
  for (const [file, text] of Object.entries(sources)) {
    const { keys, bad } = extractKeys(text, file);
    for (const b of bad) problems.push(`${b.file}:${b.line}: tr() needs a string literal as its first argument`);
    for (const k of keys) if (!used.has(k.key)) used.set(k.key, k);
  }
  const de = new Map();
  for (const [area, entries] of Object.entries(areas)) {
    for (const [key, value] of Object.entries(entries)) {
      const prev = de.get(key);
      const same = prev && String(prev.value) === String(value);
      if (prev && !same) problems.push(`de/${area}.js and de/${prev.area}.js translate ${JSON.stringify(key)} differently`);
      if (!prev) de.set(key, { area, value });
      if (typeof value === 'string' && placeholders(value) !== placeholders(key)) {
        problems.push(`de/${area}.js: ${JSON.stringify(key)} has placeholders {${placeholders(key)}}, the German text {${placeholders(value)}}`);
      }
      if (typeof value !== 'string' && typeof value !== 'function') problems.push(`de/${area}.js: ${JSON.stringify(key)} is neither text nor a function`);
    }
  }
  for (const [key, k] of used) if (!de.has(key)) problems.push(`${k.file}:${k.line}: no German text for ${JSON.stringify(key)}`);
  for (const [key, { area }] of de) if (!used.has(key)) problems.push(`de/${area}.js: ${JSON.stringify(key)} is not used in src/`);
  return { problems, keys: used.size };
}

async function main() {
  const { AREAS } = await import(pathToFileURL(join(root, 'src/i18n/de/index.js')).href);
  const { problems, keys } = checkI18n(sourceFiles(), AREAS);
  if (problems.length) {
    console.error(problems.join('\n'));
    process.exit(1);
  }
  console.log(`${keys} texts, each with a German translation.`);
}

// Runs the check unless Vitest imports the module for test/i18n.test.js.
if (!process.env.VITEST) await main();
