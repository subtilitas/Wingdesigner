// Airfoil coordinate file parser.
//
// Accepted inputs:
//   Selig      name line, then x y from the trailing edge (TE) over the upper surface to the
//              leading edge (LE) and back along the lower surface to the TE
//   Lednicer   name line, counts line ("61. 61."), upper surface LE->TE, lower surface LE->TE
//   Table      three columns x, y_upper, y_lower (e.g. "X Yo Yu" tables in percent of chord)
//   XML        <airfoil><name>..</name> ... <coordinates><point><x/><y/>..</point>..</coordinates>
//   HTML       coordinate tables inside <pre> blocks (the page <title> becomes the name)
// Tolerated: comments (#), BOM, CRLF/CR/LF, tabs, comma or semicolon separators, decimal commas,
// Fortran D exponents, percent coordinates, clockwise point order, duplicate points.
//
// Output points are in Selig order with the chord along +x.

import { runsClockwise } from './geometry.js';

// The point is required before fraction digits: with an optional point, \d+ and \d* split a long
// digit run in as many ways as it has digits (quadratic time).
const NUMBER = /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eEdD][-+]?\d+)?$/;
const DECIMAL_COMMA = /^[-+]?\d*,\d+(?:[eEdD][-+]?\d+)?$/;
/** Largest accepted input in characters (a 2000-point file is about 60 000). */
export const MAX_INPUT = 5_000_000;
// A UTF-8 character takes at most 4 bytes: larger files exceed MAX_INPUT and are rejected by size
// before they are read.
export const MAX_FILE_BYTES = 4 * MAX_INPUT;
// Most points of one airfoil; the parser stops reading above it. Above 5000 points (the warning
// threshold in model/budget.js) the checks and the first build take longer.
export const MAX_POINTS = 100_000;
// Longest airfoil name in characters; longer name lines are cut. The longest name line among 1,964
// real files has 179 characters; lists and messages show the first 200.
export const MAX_NAME = 10_000;
// Column header lines such as "x y", "X Yo Yu", "x/c y/c", "X Y_upper Y_lower", "x;y": 2 or 3 words,
// separated like coordinates. A required separator keeps the match linear (optional white space
// let a run of x, y and z letters split among the words in quadratic ways).
const COLUMN_HEADER = /^[xyz](?:\/c)?[a-z_]*(?:[\s,;]+[xyz](?:\/c)?[a-z_]*){1,2}$/i;

function issue(severity, code, message) {
  return { severity, code, message };
}

/** Parse the numbers of one line, or null when the line is not purely numeric. */
export function parseNumbers(line) {
  // Decimal commas: fields separated by whitespace or semicolons, each "12,5" or "12".
  const ws = line.trim().split(/[\s;]+/).filter(Boolean);
  let tokens;
  let decimalComma = false;
  if (ws.length >= 2 && ws.every((t) => DECIMAL_COMMA.test(t) || /^[-+]?\d+(?:[eEdD][-+]?\d+)?$/.test(t)) && ws.some((t) => t.includes(','))) {
    tokens = ws.map((t) => t.replace(',', '.'));
    decimalComma = true;
  } else {
    tokens = line
      .trim()
      .split(/[\s,;]+/)
      .filter(Boolean);
  }
  if (tokens.length < 2) return null;
  const values = [];
  for (const t of tokens) {
    if (!NUMBER.test(t)) return null;
    values.push(Number(t.replace(/[dD]/, 'e')));
  }
  return { values, decimalComma };
}

/**
 * Decode file bytes: UTF-8 when valid, otherwise Windows-1252 (Latin-1 superset).
 * @param {Uint8Array|ArrayBuffer} bytes
 */
export function decodeText(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(u8).replace(/^\uFEFF/, '');
  } catch {
    return new TextDecoder('windows-1252').decode(u8);
  }
}

const ENTITIES = { lt: '<', gt: '>', quot: '"', apos: "'", amp: '&', nbsp: '\u00a0' };

// One pass: the 5 predefined XML entities, &nbsp; (a space for the number reader) and decimal or
// hexadecimal character references as code points; a reference to no Unicode scalar value stays as
// written.
function decodeEntities(s) {
  return s.replace(/&(lt|gt|quot|apos|amp|nbsp|#\d+|#[xX][0-9a-fA-F]+);/g, (m, e) => {
    if (e[0] !== '#') return ENTITIES[e];
    const cp = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    return cp <= 0x10ffff && !(cp >= 0xd800 && cp <= 0xdfff) ? String.fromCodePoint(cp) : m;
  });
}

/** Content between the first <tag> and its closing tag (case-insensitive), or null. */
/** Content between `open` and `close` from `from` on; `lower` is text.toLowerCase(), computed once by callers that search repeatedly. */
function between(text, open, close, from = 0, lower = text.toLowerCase()) {
  const a = lower.indexOf(open, from);
  if (a < 0) return null;
  const b = lower.indexOf(close, a + open.length);
  if (b < 0) return { content: null, end: text.length };
  return { content: text.slice(a + open.length, b), end: b + close.length };
}

/** Number of one <x> or <y> element with the rules of text lines (D exponents, decimal comma); NaN otherwise. */
function xmlNumber(block, tag) {
  const m = between(block, `<${tag}>`, `</${tag}>`);
  const t = m?.content?.trim() ?? '';
  if (NUMBER.test(t)) return Number(t.replace(/[dD]/, 'e'));
  if (DECIMAL_COMMA.test(t)) return Number(t.replace(',', '.').replace(/[dD]/, 'e'));
  return NaN;
}

function parseXml(text) {
  const lower = text.toLowerCase();
  const name = decodeEntities((between(text, '<name>', '</name>', 0, lower)?.content ?? '').trim());
  const first = between(text, '<coordinates>', '</coordinates>', 0, lower);
  if (!first || first.content === null) return null;
  let blocks = 1;
  for (let at = first.end; ; blocks++) {
    const next = between(text, '<coordinates>', '</coordinates>', at, lower);
    if (!next || next.content === null) break;
    at = next.end;
  }
  // One pass over the block; reading stops one point past the limit (finish() rejects the file).
  const block = first.content;
  const blockLower = block.toLowerCase();
  const points = [];
  for (let at = 0; points.length <= MAX_POINTS; ) {
    const pt = between(block, '<point>', '</point>', at, blockLower);
    if (!pt || pt.content === null) break;
    points.push([xmlNumber(pt.content, 'x'), xmlNumber(pt.content, 'y')]);
    at = pt.end;
  }
  const issues = [issue('info', 'xml', 'Read as XML airfoil geometry.')];
  if (blocks > 1) issues.push(issue('warning', 'multi-element', `${blocks} elements found; only the first one is used.`));
  return { name, points, issues };
}

// Tags without nested "<" (linear time even for unclosed tags).
const TAG = /<[^<>]*>/g;

/** Remove <tag ...>...</tag> blocks (linear scan, unclosed blocks run to the end). */
function stripBlocks(text, tags) {
  let out = text;
  for (const tag of tags) {
    const lower = out.toLowerCase();
    let res = '';
    let at = 0;
    for (;;) {
      const a = lower.indexOf(`<${tag}`, at);
      if (a < 0) break;
      const b = lower.indexOf(`</${tag}`, a);
      res += out.slice(at, a) + '\n';
      if (b < 0) {
        at = out.length;
        break;
      }
      const e = lower.indexOf('>', b);
      at = e < 0 ? out.length : e + 1;
    }
    out = res + out.slice(at);
  }
  return out;
}

/**
 * Table rows as lines and cells as spaces, whatever the source line breaks: white space inside a
 * table collapses, and row, caption and section tags and <br> start a line. Unclosed tables run to
 * the end.
 */
function flattenTables(text) {
  const lower = text.toLowerCase();
  let out = '';
  let at = 0;
  for (let a = lower.indexOf('<table', at); a >= 0; a = lower.indexOf('<table', at)) {
    const b = lower.indexOf('</table', a);
    const end = b < 0 ? text.length : b;
    const rows = text
      .slice(a, end)
      .replace(/\s+/g, ' ')
      .replace(/<\/?(?:tr|caption|thead|tbody|tfoot)\b[^<>]*>|<br\s*\/?>/gi, '\n')
      .replace(TAG, ' ');
    out += `${text.slice(at, a)}\n${rows}\n`;
    at = end;
  }
  return out + text.slice(at);
}

function htmlToText(text) {
  const lower = text.toLowerCase();
  // indexOf, not a lazy regex: a regex rescans to the end of the text from every unclosed <title>.
  const title = decodeEntities((between(text, '<title>', '</title>', 0, lower)?.content ?? '').trim());
  const pres = [];
  for (let at = lower.indexOf('<pre'); at >= 0; ) {
    const open = lower.indexOf('>', at);
    const close = open < 0 ? -1 : lower.indexOf('</pre>', open);
    if (close < 0) break;
    pres.push(decodeEntities(text.slice(open + 1, close).replace(TAG, '')));
    at = lower.indexOf('<pre', close);
  }
  // Without <pre> blocks: table rows become lines and cells spaces; outside tables, line breaks and
  // the ends of paragraphs, divisions, list items and headings start a line.
  const flat = flattenTables(stripBlocks(text, ['head', 'title', 'script', 'style']))
    .replace(/<\/t[dh]\s*>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(tr|p|div|li|h\d)\s*>/gi, '\n')
    .replace(TAG, '');
  const body = pres.length ? pres.join('\n') : decodeEntities(flat);
  return { title, body };
}

/**
 * Parse the text of an airfoil file.
 * @param {string} text
 * @param {{fileName?: string}} [options]
 * @returns {{name: string, format: 'selig'|'lednicer'|'table'|'xml', points: number[][], issues: object[]}}
 */
export function parseDat(text, options = {}) {
  let src = String(text ?? '').replace(/^\uFEFF/, '');
  const issues = [];
  if (src.length > MAX_INPUT) {
    return { name: options.fileName ?? 'airfoil', format: 'selig', points: [], issues: [issue('error', 'too-large', `Input is ${src.length} characters; the limit is ${MAX_INPUT}.`)] };
  }
  const fallbackName = (options.fileName ?? 'airfoil').replace(/\.[^.]+$/, '');

  if (/<coordinates>/i.test(src)) {
    const xml = parseXml(src);
    if (!xml) {
      return { name: fallbackName, format: 'xml', points: [], issues: [issue('error', 'xml-malformed', 'The XML has a <coordinates> element without a closing tag.')] };
    }
    return finish(xml.name || fallbackName, 'xml', xml.points, [...xml.issues, ...(xml.name ? [] : [issue('info', 'no-name', 'No name found; the file name is used.')])]);
  }
  let htmlTitle = '';
  if (/<(html|pre|body)[\s>]/i.test(src)) {
    const h = htmlToText(src);
    src = h.body;
    htmlTitle = h.title;
    issues.push(issue('info', 'html', 'Read coordinates from an HTML page.'));
  }

  const lines = src.split(/\r\n|\r|\n/);
  let name = htmlTitle;
  const rows = [];
  let extraColumns = false;
  let decimalComma = false;
  let ignored = 0;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    // A comment runs from "#" to the line end (indexOf: "." in a regex stops at U+2028 and U+2029).
    const hash = raw.indexOf('#');
    const line = (hash < 0 ? raw : raw.slice(0, hash)).trim();
    if (!line) continue;
    const parsed = parseNumbers(line);
    if (parsed) {
      if (parsed.decimalComma) decimalComma = true;
      rows.push({ values: parsed.values, line: i + 1 });
      // A Lednicer file has one counts line besides its points: more rows exceed the point limit in
      // every format, so reading stops there.
      if (rows.length > MAX_POINTS + 1) {
        return { name: (name || fallbackName).slice(0, MAX_NAME), format: 'selig', points: [], issues: [...issues, issue('error', 'too-many-points', `More than ${(MAX_POINTS + 1).toLocaleString('en')} coordinate lines; the limit is ${MAX_POINTS.toLocaleString('en')} points.`)] };
      }
    } else if (!name && rows.length === 0) {
      name = raw.trim();
    } else if (!COLUMN_HEADER.test(line)) {
      ignored++;
    }
  }
  if (!name) {
    name = fallbackName;
    issues.push(issue('info', 'no-name', 'No name line found; the file name is used as the airfoil name.'));
  }
  if (decimalComma) issues.push(issue('info', 'decimal-comma', 'Decimal commas were read as decimal points.'));
  if (ignored > 0) issues.push(issue('warning', 'ignored-lines', `${ignored} non-numeric line(s) after the name line were ignored.`));
  if (rows.length === 0) {
    return { name, format: 'selig', points: [], issues: [...issues, issue('error', 'no-points', 'No coordinate lines found.')] };
  }

  // Three-column table: x strictly increasing or strictly decreasing (read from the leading edge on),
  // y_upper >= y_lower on (nearly) every row.
  const three = rows.every((r) => r.values.length === 3);
  if (three && rows.length >= 3) {
    let inc = true;
    let dec = true;
    let above = 0;
    for (let k = 0; k < rows.length; k++) {
      if (k > 0 && !(rows[k].values[0] > rows[k - 1].values[0])) inc = false;
      if (k > 0 && !(rows[k].values[0] < rows[k - 1].values[0])) dec = false;
      if (rows[k].values[1] >= rows[k].values[2]) above++;
    }
    if ((inc || dec) && above >= 0.9 * rows.length) {
      const ordered = inc ? rows : rows.slice().reverse();
      const upper = ordered.map((r) => [r.values[0], r.values[1]]);
      const lower = ordered.map((r) => [r.values[0], r.values[2]]);
      const points = upper.reverse().concat(samePoint(lower[0], upper[upper.length - 1]) ? lower.slice(1) : lower);
      issues.push(issue('info', 'table', 'Read as a three-column table (x, upper y, lower y).'));
      return finish(name, 'table', points, issues);
    }
  }
  if (rows.some((r) => r.values.length > 2)) extraColumns = true;
  if (extraColumns) {
    issues.push(issue('warning', 'extra-columns', 'Lines with more than two values found; only the first two columns are used.'));
  }

  const first = rows[0].values;
  const isCount = (v) => v >= 2 && Math.abs(v - Math.round(v)) < 1e-9;
  // Lednicer: a counts line followed by the upper surface starting at the leading edge. The first
  // data row lies within 1 % of the x range of the smallest x, and the lower surface starts there
  // too: at the announced split when the counts match the rows, otherwise at the x reset. A percent
  // Selig file whose trailing-edge row holds two integers ("100 2") fails these tests.
  let lednicer = null;
  if (isCount(first[0]) && isCount(first[1]) && rows.length > 2) {
    const data = rows.slice(1).map((r) => [r.values[0], r.values[1]]);
    let minX = Infinity;
    let maxX = -Infinity;
    for (const [x] of data) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
    }
    const nearLE = (x) => x - minX <= 0.01 * (maxX - minX);
    const nu = Math.round(first[0]);
    const nl = Math.round(first[1]);
    if (nearLE(data[0][0])) {
      if (data.length === nu + nl) {
        if (nearLE(data[nu][0])) lednicer = { upper: data.slice(0, nu), lower: data.slice(nu) };
      } else {
        let split = data.length;
        for (let k = 1; k < data.length; k++) {
          if (data[k][0] < data[k - 1][0] - 0.25 * (Math.abs(data[k - 1][0]) + 1e-12)) {
            split = k;
            break;
          }
        }
        if (split >= 2 && data.length - split >= 2 && nearLE(data[split][0])) {
          issues.push(
            issue('warning', 'lednicer-count', `Header announces ${nu}+${nl} points but ${data.length} were found; surfaces split at the x reset.`),
          );
          lednicer = { upper: data.slice(0, split), lower: data.slice(split) };
        }
      }
    }
  }
  if (lednicer) {
    const { upper, lower } = lednicer;
    const up = upper.slice().reverse();
    const points = up.concat(lower.length && up.length && samePoint(lower[0], up[up.length - 1]) ? lower.slice(1) : lower);
    return finish(name, 'lednicer', points, issues);
  }
  return finish(
    name,
    'selig',
    rows.map((r) => [r.values[0], r.values[1]]),
    issues,
  );
}

function finish(nameIn, format, pointsIn, issuesIn) {
  const issues = issuesIn.slice();
  let points = pointsIn;
  let name = nameIn;
  if (name.length > MAX_NAME) {
    name = name.slice(0, MAX_NAME);
    issues.push(issue('info', 'long-name', `The name line has ${nameIn.length.toLocaleString('en')} characters; the first ${MAX_NAME.toLocaleString('en')} are used.`));
  }
  if (points.some((p) => !Number.isFinite(p[0]) || !Number.isFinite(p[1]))) {
    return { name, format, points: [], issues: [...issues, issue('error', 'non-finite', 'Coordinates contain non-finite values.')] };
  }
  if (points.length === 0) return { name, format, points, issues: [...issues, issue('error', 'no-points', 'No coordinate points found.')] };
  if (points.length > MAX_POINTS) {
    const n = `${points.length.toLocaleString('en')}${format === 'xml' && points.length === MAX_POINTS + 1 ? ' or more' : ''}`;
    return { name, format, points: [], issues: [...issues, issue('error', 'too-many-points', `${n} points; the limit is ${MAX_POINTS.toLocaleString('en')}.`)] };
  }

  // Exact duplicates go first, so a closing point written twice reaches the test below once.
  const dedup = [];
  let dups = 0;
  for (const p of points) {
    if (dedup.length && samePoint(p, dedup[dedup.length - 1])) dups++;
    else dedup.push(p);
  }
  if (dups > 0) issues.push(issue('info', 'duplicates', `${dups} duplicate consecutive point(s) removed.`));
  points = dedup;

  // A blunt trailing edge drawn as a closed outline (CAD polylines) repeats the first point after a
  // steep segment at the trailing edge (the drawn TE base). The outline either starts at a TE
  // corner (drop the repeated point) or on the base itself, e.g. at the TE midpoint (drop the base
  // point at both ends). A sharp closed TE approaches the repeated point along a surface, so it is kept.
  if (points.length > 4 && samePoint(points[0], points[points.length - 1])) {
    const n = points.length;
    const a = points[n - 2];
    const b = points[0];
    const c = points[1];
    let xmin = Infinity;
    let xmax = -Infinity;
    for (const q of points) {
      xmin = Math.min(xmin, q[0]);
      xmax = Math.max(xmax, q[0]);
    }
    const scale = Math.max(xmax - xmin, 1e-12);
    const steep = (p, q) => Math.abs(q[0] - p[0]) <= 0.2 * Math.abs(q[1] - p[1]) && Math.abs(q[1] - p[1]) > 1e-6 * scale;
    const nearTE = (p) => xmax - p[0] <= 0.01 * scale;
    if (steep(a, b) && steep(b, c) && nearTE(a) && nearTE(c) && (b[1] - a[1]) * (c[1] - b[1]) > 0) {
      points = points.slice(1, -1);
      issues.push(issue('warning', 'closing-point', 'The outline starts and ends on the drawn trailing-edge base; the base point was removed at both ends.'));
    } else if (steep(a, b) && nearTE(a)) {
      points = points.slice(0, -1);
      issues.push(issue('warning', 'closing-point', 'The outline repeats its first point after a blunt trailing edge; the repeated point was removed.'));
    }
  }

  let xmax = -Infinity;
  for (const p of points) if (p[0] > xmax) xmax = p[0];
  if (xmax > 5 && xmax <= 110) {
    points = points.map(([x, y]) => [x / 100, y / 100]);
    issues.push(issue('warning', 'percent', 'Coordinates look like percent of chord and were divided by 100.'));
  }

  if (points.length >= 3 && runsClockwise(points)) {
    points = points.slice().reverse();
    issues.push(issue('warning', 'reversed', 'Points run clockwise (lower surface first); order reversed to Selig order.'));
  }
  return { name, format, points, issues };
}

// Equal parsed values only: an absolute tolerance merged the distinct points of tiny outlines. The
// airfoil check removes points closer than a fraction of the chord.
function samePoint(a, b) {
  return a[0] === b[0] && a[1] === b[1];
}

/** Serialize points to Selig .dat text. */
export function toSeligDat(name, points, digits = 6) {
  // The name is the first line only: line breaks in a name would start coordinate rows. A name
  // that reads as a coordinate row ("123 456") or as a comment ("# custom") gets the prefix
  // "Airfoil "; "<" before a tag the reader takes for XML or HTML becomes "‹".
  // The line break after the name ends a tag for the reader, so a tag name at the end is escaped too.
  let title = String(name).replace(/[\r\n]+/g, ' ').replace(/<(?=coordinates>|(?:html|pre|body)(?:[\s>]|$))/gi, '‹');
  // The reader drops "#" to the line end: the rest must be text, not empty and not a coordinate row.
  const hash = title.indexOf('#');
  const probe = (hash < 0 ? title : title.slice(0, hash)).trim();
  if (!probe || parseNumbers(probe)) title = `Airfoil ${title}`;
  const lines = [title];
  // Decimals resolve `digits` significant digits of the outline extent (at least `digits` decimals):
  // 6 for unit-chord and millimetre outlines, 12 for a 1e-6 chord at any offset. Beyond the 100
  // decimals of toFixed, 17 significant digits keep every double.
  const lo = [Infinity, Infinity];
  const hi = [-Infinity, -Infinity];
  for (const p of points) {
    for (let c = 0; c < 2; c++) {
      lo[c] = Math.min(lo[c], p[c]);
      hi[c] = Math.max(hi[c], p[c]);
    }
  }
  const extent = Math.max(hi[0] - lo[0], hi[1] - lo[1]);
  let decimals = extent > 0 ? Math.max(digits, digits - Math.floor(Math.log10(extent))) : digits;
  // Consecutive distinct points stay distinct: values more than 10^-d apart round to different
  // d-decimal numbers, and the reader removes equal consecutive points.
  let gap = Infinity;
  for (let i = 1; i < points.length; i++) {
    const d = Math.max(Math.abs(points[i][0] - points[i - 1][0]), Math.abs(points[i][1] - points[i - 1][1]));
    if (d > 0 && d < gap) gap = d;
  }
  if (gap < Infinity) decimals = Math.max(decimals, 1 - Math.floor(Math.log10(gap)));
  const num = decimals <= 100 ? (v) => v.toFixed(decimals) : (v) => v.toPrecision(17);
  for (const [x, y] of points) lines.push(`${num(x).padStart(digits + 3)} ${num(y).padStart(digits + 3)}`);
  return lines.join('\n') + '\n';
}
