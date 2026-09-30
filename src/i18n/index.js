// Language of the user interface and of every message: English ('en') or German ('de').
//
// tr(text, params) returns `text` in the current language. The key is the English text itself,
// with {name} placeholders filled from params: tr('Created "{name}".', { name }). The German
// catalog (src/i18n/de/) maps each key to a German string with the same placeholders, or to a
// function of params where the grammar needs it. A key without a German entry falls back to the
// English text; `npm run i18n:check` reports such keys, unused entries and placeholder mismatches.
// The first argument of tr() is always a string literal, so the check finds every key.
//
// Numbers inside text go through fixed(), count(), whole() and plain(): German writes a decimal comma and
// groups thousands with a dot (1.234,5), English a decimal point and a comma (1,234.5). readNumber()
// reads a number typed into a number field.
//
// Pure modules (geometry, parser, model) call tr() as well: a build or a check made after
// setLanguage() speaks the new language. English is the default, also in Node.js and the tests.

import { DE } from './de/index.js';

export const LANGUAGES = Object.freeze({ en: 'English', de: 'Deutsch' });
const CATALOGS = { en: {}, de: DE };

let current = 'en';

/** The current language code. */
export function language() {
  return current;
}

/** Switch the language; unknown codes select English. */
export function setLanguage(code) {
  current = Object.hasOwn(CATALOGS, code) ? code : 'en';
}

/**
 * Language at the start: a stored choice when it names a language, otherwise German when the
 * browser's first language is German (de, de-DE, de-AT, ...), otherwise English.
 */
export function initialLanguage(stored, browserLanguages = []) {
  if (Object.hasOwn(CATALOGS, stored)) return stored;
  const first = String(browserLanguages[0] ?? '').toLowerCase();
  return first === 'de' || first.startsWith('de-') ? 'de' : 'en';
}

const fill = (text, params) => text.replace(/\{(\w+)\}/g, (m, name) => (Object.hasOwn(params, name) ? String(params[name]) : m));

/** `text` (English, the key) in the current language, placeholders filled from params. */
export function tr(text, params = {}) {
  const entry = current === 'en' ? undefined : CATALOGS[current][text];
  if (typeof entry === 'function') return entry(params);
  return fill(entry ?? text, params);
}

/** Decimal number with `digits` decimals: "1200.5" in English, "1.200,5" in German (dot groups, decimal comma). */
export function fixed(value, digits) {
  const s = value.toFixed(digits);
  if (current !== 'de') return s;
  const [int, frac] = s.split('.');
  const grouped = int.replace(/\B(?=(\d{3})+$)/g, '.');
  return frac === undefined ? grouped : `${grouped},${frac}`;
}

/** Whole number with digit grouping: "20,000" in English, "20.000" in German. */
export function count(value) {
  return Math.round(value).toLocaleString(current === 'de' ? 'de-DE' : 'en');
}

/**
 * Whole number as JavaScript prints it in English ("5000000"), with digit grouping in German
 * ("5.000.000"). A value that is not an integer is printed as plain() does, never rounded.
 */
export function whole(value) {
  return current === 'de' && Number.isInteger(value) ? count(value) : plain(value);
}

/** Number as JavaScript prints it (shortest round trip), with a decimal comma in German. */
export function plain(value) {
  const s = String(value);
  return current === 'de' ? s.replace('.', ',') : s;
}

/**
 * The number in a text typed into a number field, read in the current language; NaN when the text
 * is no number. German writes a decimal comma and groups thousands with a dot, English a decimal
 * point and a comma.
 * - Spaces are dropped, also no-break and narrow no-break spaces: "1 234,5".
 * - A leading + or - and an exponent are accepted: "-6,5", "1e-7", "1,5E3".
 * - A text in the grouped form of the current language drops its groups: "1.234.567,5" and
 *   "1.500" in German, "1,234,567.5" and "1,500" in English (groups of 3 digits, the first group
 *   1 to 3 digits without a leading 0, then an optional decimal part).
 * - Otherwise, a text with both separators takes the last one as the decimal separator, which may
 *   occur only once, and the other kind as groups between digits: "1.234,5" is 1234.5 also in
 *   English, "1,234.5" also in German.
 * - Otherwise, a separator that occurs once is the decimal separator in both languages: "0,7" is
 *   0.7 also in English, "12.5" is 12.5 also in German, "1,500" is 1.5 in German.
 * - One kind of separator several times outside the grouped form is no number ("1.2.3"), and so is
 *   any other text ("0x10", "Infinity", "12 mm") and a value beyond the double range ("1e999").
 */
export function readNumber(text) {
  const m = String(text ?? '')
    .replace(/\s+/g, '')
    .match(/^([+-]?)([\d.,]+)([eE][+-]?\d+)?$/);
  if (!m || !/\d/.test(m[2])) return NaN;
  const [, sign, digits, exponent = ''] = m;
  const german = current === 'de';
  const grouped = german ? /^[1-9]\d{0,2}(?:\.\d{3})+(?:,\d*)?$/ : /^[1-9]\d{0,2}(?:,\d{3})+(?:\.\d*)?$/;
  let mantissa;
  if (grouped.test(digits)) {
    mantissa = digits.replaceAll(german ? '.' : ',', '').replace(',', '.');
  } else {
    const at = Math.max(digits.lastIndexOf('.'), digits.lastIndexOf(','));
    const decimal = digits[at];
    const group = decimal === '.' ? ',' : '.';
    if (at < 0) mantissa = digits;
    else if (digits.indexOf(decimal) !== at) return NaN;
    else if (!digits.includes(group)) mantissa = `${digits.slice(0, at)}.${digits.slice(at + 1)}`;
    else {
      const int = digits.slice(0, at);
      if (!(group === '.' ? /^\d+(?:\.\d+)*$/ : /^\d+(?:,\d+)*$/).test(int)) return NaN;
      mantissa = `${int.replaceAll(group, '')}.${digits.slice(at + 1)}`;
    }
  }
  // mantissa: digits with at most one decimal point ("5." and ".5" read as 5 and 0.5).
  const value = Number(sign + mantissa + exponent);
  return Number.isFinite(value) ? value : NaN;
}
