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
// groups thousands with a dot (1.234,5), English a decimal point and a comma (1,234.5).
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
