// XML tokenizer shared by the XFLR5 (src/import/xflxml.js) and flow5 (src/import/fl5xml.js) plane
// and wing readers. It needs no DOM (the tests run in Node) and is linear in the input: it keeps the
// names of the open elements and the values read, never a tree.

import { count, plain, tr } from '../i18n/index.js';
import { XflrError } from './errors.js';

/** Most elements in one file; XFLR5 and flow5 write about 500 for a plane. */
export const MAX_ELEMENTS = 1_000_000;
/** Deepest nesting of elements; XFLR5 writes 6 levels. */
export const MAX_DEPTH = 100;
/** Most attributes of one element; XFLR5 and flow5 write one at most (the version of the root). */
export const MAX_ATTRIBUTES = 100;

// A number as Qt's toDouble() reads it (point, optional exponent), after trimming. The point is required
// before fraction digits: an optional one lets \d+ and \d* split a long digit run in quadratic ways.
export const NUMBER = /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?$/;

// Tokens: an XML name, an attribute with its quoted value, the end of a start tag and of an end tag.
// Sticky, so each match starts where the scanner stands; no pattern can backtrack over the input.
const NAME = /[\p{L}_:][\p{L}\p{N}\p{M}_.:-]*/uy;
const ATTR = /\s+([^\s=/>"'<]+)\s*=\s*(?:"([^"<]*)"|'([^'<]*)')/y;
const TAG_END = /\s*(\/?)>/y;
const END_TAG_END = /\s*>/y;

export const START = 1;
export const END = 2;
export const TEXT = 3;
export const EOF = 4;

const ENTITIES = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };

// The five XML entities and decimal or hexadecimal character references; a reference to no Unicode
// scalar value, or an unknown entity, stays as written.
export function decodeEntities(s) {
  if (!s.includes('&')) return s;
  return s.replace(/&(lt|gt|amp|quot|apos|#\d+|#x[0-9a-fA-F]+);/g, (m, e) => {
    if (e[0] !== '#') return ENTITIES[e];
    const cp = e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    return cp > 0 && cp <= 0x10ffff && !(cp >= 0xd800 && cp <= 0xdfff) ? String.fromCodePoint(cp) : m;
  });
}

/** Line number (from 1) of character `at`. */
export function lineAt(s, at) {
  let line = 1;
  for (let i = s.indexOf('\n'); i >= 0 && i < at; i = s.indexOf('\n', i + 1)) line++;
  return line;
}

/** At most `max` characters of `s`, with an ellipsis when cut (names and values in messages). */
export function clip(s, max = 40) {
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

/**
 * Pull tokenizer. next() returns START, END, TEXT or EOF and sets `name` (START, END), `attrs`
 * (START of the root element: [name, value] pairs; empty for other elements, whose attributes are not
 * read), `text` and `cdata` (TEXT). A self-closing element gives START and
 * END. It skips the XML declaration, processing instructions, the DOCTYPE and comments, and throws
 * an XflrError at a malformed tag, a wrong end tag or an element left open at the end.
 */
export class Scanner {
  constructor(s, from) {
    this.s = s;
    this.i = from;
    this.open = [];
    this.elements = 0;
    this.selfClosed = false;
    this.name = '';
    this.attrs = [];
    this.text = '';
    this.cdata = false;
  }

  damaged(at, message) {
    return new XflrError('damaged', message(plain(lineAt(this.s, at))));
  }

  malformed(at) {
    return this.damaged(at, (line) => tr('The XML file is damaged at line {line}: a tag is malformed.', { line }));
  }

  unclosed(at) {
    return this.damaged(at, (line) => tr('The XML file is damaged at line {line}: a comment, CDATA section or declaration is not closed.', { line }));
  }

  /** Index just past the next `token` from `from`, for comments, CDATA and declarations starting at `at`. */
  past(token, from, at) {
    const j = this.s.indexOf(token, from);
    if (j < 0) throw this.unclosed(at);
    return j + token.length;
  }

  /** Index just past a DOCTYPE from `from` (after "<!DOCTYPE"): its internal subset [...] and quoted strings may hold ">". */
  pastDoctype(from, at) {
    const s = this.s;
    let quote = 0;
    let subset = false;
    for (let j = from; j < s.length; j++) {
      const c = s.charCodeAt(j);
      if (quote) {
        if (c === quote) quote = 0;
      } else if (c === 0x22 || c === 0x27) quote = c;
      else if (c === 0x5b) subset = true;
      else if (c === 0x5d) subset = false;
      else if (c === 0x3e && !subset) return j + 1;
    }
    throw this.unclosed(at);
  }

  next() {
    if (this.selfClosed) {
      this.selfClosed = false;
      this.name = this.open.pop();
      return END;
    }
    const s = this.s;
    for (;;) {
      const i = this.i;
      if (i >= s.length) {
        if (this.open.length) throw new XflrError('damaged', tr('The XML file is cut off: the element <{name}> is not closed.', { name: clip(this.open.at(-1)) }));
        return EOF;
      }
      if (s.charCodeAt(i) !== 0x3c) {
        const j = s.indexOf('<', i);
        this.i = j < 0 ? s.length : j;
        this.text = s.slice(i, this.i);
        this.cdata = false;
        return TEXT;
      }
      const c = s.charCodeAt(i + 1);
      if (c === 0x21) {
        // <!-- comment -->, <![CDATA[ text ]]>, <!DOCTYPE …>
        if (s.startsWith('<!--', i)) this.i = this.past('-->', i + 4, i);
        else if (s.startsWith('<![CDATA[', i)) {
          this.i = this.past(']]>', i + 9, i);
          this.text = s.slice(i + 9, this.i - 3);
          this.cdata = true;
          return TEXT;
        } else if (s.slice(i + 2, i + 9).toUpperCase() === 'DOCTYPE') this.i = this.pastDoctype(i + 9, i);
        else throw this.malformed(i);
        continue;
      }
      if (c === 0x3f) {
        // <?xml …?> and other processing instructions
        this.i = this.past('?>', i + 2, i);
        continue;
      }
      if (c === 0x2f) {
        NAME.lastIndex = i + 2;
        const m = NAME.exec(s);
        if (!m) throw this.malformed(i);
        END_TAG_END.lastIndex = NAME.lastIndex;
        if (!END_TAG_END.exec(s)) throw this.malformed(i);
        const open = this.open.at(-1);
        if (open === undefined) throw this.damaged(i, (line) => tr('The XML file is damaged at line {line}: </{name}> closes no open element.', { line, name: clip(m[0]) }));
        if (open !== m[0]) {
          throw this.damaged(i, (line) => tr('The XML file is damaged at line {line}: </{name}> does not close <{open}>.', { line, name: clip(m[0]), open: clip(open) }));
        }
        this.i = END_TAG_END.lastIndex;
        this.name = this.open.pop();
        return END;
      }
      NAME.lastIndex = i + 1;
      const m = NAME.exec(s);
      if (!m) throw this.malformed(i);
      const attrs = [];
      let j = NAME.lastIndex;
      for (let n = 1; ; n++) {
        ATTR.lastIndex = j;
        const a = ATTR.exec(s);
        if (!a) break;
        if (n > MAX_ATTRIBUTES) throw this.malformed(i);
        if (this.open.length === 0) attrs.push([a[1], decodeEntities(a[2] ?? a[3])]);
        j = ATTR.lastIndex;
      }
      TAG_END.lastIndex = j;
      const e = TAG_END.exec(s);
      if (!e) throw this.malformed(i);
      if (++this.elements > MAX_ELEMENTS) throw new XflrError('too-large', tr('The XML file holds more than {max} elements.', { max: count(MAX_ELEMENTS) }));
      if (this.open.length >= MAX_DEPTH) throw new XflrError('too-large', tr('The XML file nests elements deeper than {max} levels.', { max: plain(MAX_DEPTH) }));
      this.i = TAG_END.lastIndex;
      this.open.push(m[0]);
      this.name = m[0];
      this.attrs = attrs;
      this.selfClosed = e[1] === '/';
      return START;
    }
  }
}

/**
 * Read the children of the element just opened, up to and including its end tag: visit(name) is
 * called with the lowercase name of each child element (XFLR5 compares names without case) and may
 * read it; what it leaves unread is skipped.
 */
export function children(sc, visit) {
  const depth = sc.open.length;
  for (;;) {
    const kind = sc.next();
    if (kind === END) return;
    if (kind === START) {
      visit(sc.name.toLowerCase());
      while (sc.open.length > depth) sc.next();
    }
  }
}

/** Text of the element just opened, entities decoded, up to and including its end tag; child elements are skipped. */
export function readText(sc) {
  const depth = sc.open.length;
  const parts = [];
  for (;;) {
    const kind = sc.next();
    if (kind === END && sc.open.length < depth) return parts.join('');
    if (kind === TEXT && sc.open.length === depth) parts.push(sc.cdata ? sc.text : decodeEntities(sc.text));
  }
}

/** Number of an element text, or NaN when it is empty, not a number or not finite (XFLR5 reads 0 then). */
export function toNumber(text) {
  const t = text.trim();
  if (!NUMBER.test(t)) return NaN;
  const v = Number(t);
  // + 0 turns -0 ("-0.000" in the file) into 0.
  return Number.isFinite(v) ? v + 0 : NaN;
}

export const isTrue = (text) => text.trim().toLowerCase() === 'true';
