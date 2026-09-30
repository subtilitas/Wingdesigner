import { afterEach, describe, expect, it } from 'vitest';
import { count, fixed, initialLanguage, language, plain, readNumber, setLanguage, tr, whole } from '../src/i18n/index.js';
import { AREAS } from '../src/i18n/de/index.js';
import { checkI18n, extractKeys, sourceFiles } from '../scripts/check-i18n.mjs';

afterEach(() => setLanguage('en'));

describe('language', () => {
  it('starts in English and switches to German and back; unknown codes select English', () => {
    expect(language()).toBe('en');
    setLanguage('de');
    expect(language()).toBe('de');
    setLanguage('fr');
    expect(language()).toBe('en');
  });

  it('starts with a stored choice, else German for a German browser, else English', () => {
    expect(initialLanguage('en', ['de-DE'])).toBe('en');
    expect(initialLanguage('de', ['en-US'])).toBe('de');
    expect(initialLanguage(null, ['de-AT', 'en'])).toBe('de');
    expect(initialLanguage(null, ['DE'])).toBe('de');
    expect(initialLanguage('fr', ['en-GB', 'de'])).toBe('en');
    expect(initialLanguage(undefined, [])).toBe('en');
    expect(initialLanguage(null, ['dea'])).toBe('en');
  });

  it('fills placeholders and keeps English text for a key without German entry', () => {
    expect(tr('{a} of {b}', { a: 1, b: 2 })).toBe('1 of 2');
    setLanguage('de');
    expect(tr('No German entry for {x}', { x: 'y' })).toBe('No German entry for y');
    // A missing parameter leaves its placeholder visible.
    expect(tr('{a} and {b}', { a: 1 })).toBe('1 and {b}');
  });

  it('writes numbers with a decimal point and comma groups in English, a decimal comma and dot groups in German', () => {
    expect([fixed(1.25, 1), count(20000), plain(0.5), plain(1e-7)]).toEqual(['1.3', '20,000', '0.5', '1e-7']);
    setLanguage('de');
    expect([fixed(1.25, 1), count(20000), plain(0.5), count(999.6)]).toEqual(['1,3', '20.000', '0,5', '1.000']);
  });

  it('groups the integer part of fixed() in German only, without changing the rounding', () => {
    expect([fixed(1200, 1), fixed(-1176.36, 2), fixed(1211902, 0), fixed(999.95, 1), fixed(-0.5, 0)]).toEqual(['1200.0', '-1176.36', '1211902', '1000.0', '-1']);
    setLanguage('de');
    expect([fixed(1200, 1), fixed(-1176.36, 2), fixed(1211902, 0), fixed(999.95, 1), fixed(-176.5, 1), fixed(NaN, 1)]).toEqual(['1.200,0', '-1.176,36', '1.211.902', '1.000,0', '-176,5', 'NaN']);
  });

  it('groups large whole numbers in German only; English prints them as JavaScript does', () => {
    expect([whole(5000000), whole(999), whole(-1200000), whole(0)]).toEqual(['5000000', '999', '-1200000', '0']);
    setLanguage('de');
    expect([whole(5000000), whole(999), whole(-1200000), whole(0)]).toEqual(['5.000.000', '999', '-1.200.000', '0']);
  });

  it('never rounds in whole(): a value with decimals prints as plain() does', () => {
    expect([whole(1.5), whole(0.1)]).toEqual(['1.5', '0.1']);
    setLanguage('de');
    expect([whole(1.5), whole(0.1), whole(20000)]).toEqual(['1,5', '0,1', '20.000']);
  });
});

describe('readNumber', () => {
  const read = (texts) => texts.map((t) => readNumber(t));

  it('reads a decimal comma and a decimal point in both languages', () => {
    for (const lang of ['en', 'de']) {
      setLanguage(lang);
      expect(read(['0,7', '0.7', '12,5', '12.5', ',5', '.5', '5,', '42']), lang).toEqual([0.7, 0.7, 12.5, 12.5, 0.5, 0.5, 5, 42]);
    }
  });

  it('drops the groups of the grouped form of the current language only', () => {
    expect(read(['1,500', '1,234,567.5', '1,234,567', '999,999.25'])).toEqual([1500, 1234567.5, 1234567, 999999.25]);
    // German groups in English: one dot is the decimal point, several dots are no number.
    expect(read(['1.500', '1.234.567'])).toEqual([1.5, NaN]);
    setLanguage('de');
    expect(read(['1.500', '1.234.567,5', '1.234.567', '999.999,25', '1.234,'])).toEqual([1500, 1234567.5, 1234567, 999999.25, 1234]);
    expect(read(['1,500', '1,234,567'])).toEqual([1.5, NaN]);
  });

  it('reads a group of 3 digits after a leading 0 as decimals: 0,500 is 0.5 in both languages', () => {
    expect(read(['0,500', '0.500', '01,500'])).toEqual([0.5, 0.5, 1.5]);
    setLanguage('de');
    expect(read(['0.500', '0,500', '01.500'])).toEqual([0.5, 0.5, 1.5]);
  });

  it('takes the last of two separators as the decimal separator and the other kind as groups', () => {
    for (const lang of ['en', 'de']) {
      setLanguage(lang);
      expect(read(['1.234,5', '1,234.5', '1.234.567,5', '1,234,567.5', '1.2,5']), lang).toEqual([1234.5, 1234.5, 1234567.5, 1234567.5, 12.5]);
      // The decimal separator occurs once, groups stand between digits.
      expect(read(['1,2.3,4', '1.2,3.4', '1.,5', '.,5', ',.5']), lang).toEqual([NaN, NaN, NaN, NaN, NaN]);
    }
  });

  it('rejects one separator several times outside the grouped form', () => {
    expect(read(['1.2.3', '1,2,3', '1,234,56', '1..2', '1,,2'])).toEqual([NaN, NaN, NaN, NaN, NaN]);
    setLanguage('de');
    expect(read(['1.2.3', '1,2,3', '1.234.56', '1..2', '1,,2'])).toEqual([NaN, NaN, NaN, NaN, NaN]);
  });

  it('drops spaces, also no-break and narrow no-break spaces', () => {
    expect(read([' 42 ', '1 500', '1 500.5', '1 234 567', '- 6.5'])).toEqual([42, 1500, 1500.5, 1234567, -6.5]);
    setLanguage('de');
    expect(read(['1 500,5', '1 234,5', ' 0,7\t'])).toEqual([1500.5, 1234.5, 0.7]);
  });

  it('accepts a leading sign and an exponent', () => {
    expect(read(['-6.5', '+5', '1e-7', '1.5E3', '-2e6', '1e308', '600.0000002'])).toEqual([-6.5, 5, 1e-7, 1500, -2e6, 1e308, 600.0000002]);
    setLanguage('de');
    expect(read(['-6,5', '+0,25', '1,5e-7', '1.500e3'])).toEqual([-6.5, 0.25, 1.5e-7, 1.5e6]);
  });

  it('returns NaN for any other text', () => {
    for (const lang of ['en', 'de']) {
      setLanguage(lang);
      expect(read(['', '   ', '-', '+', '.', ',', 'e5', '1e', '--5', '5-', '+-5', '0x10', 'Infinity', 'NaN', '12 mm', '1/2', '1e999', '-1e999', null, undefined]), lang).toEqual(Array(20).fill(NaN));
    }
    const t0 = performance.now();
    expect(readNumber('1'.repeat(100000) + 'x')).toBeNaN();
    expect(performance.now() - t0).toBeLessThan(500);
  });

  it('reads back every text that plain() writes in the same language', () => {
    const values = [0, 0.25, -6.5, 600.0000002, 1e-7, -1.5e-7, 1234567.5, 0.1 + 0.2, 1e21, 5e-324, Number.MAX_VALUE, 20000];
    for (const lang of ['en', 'de']) {
      setLanguage(lang);
      for (const v of values) expect(readNumber(plain(v)), `${lang} ${plain(v)}`).toBe(v);
    }
  });
});

describe('translation check', () => {
  it('finds literal keys with escapes over several lines, and calls without a literal', () => {
    const src = [
      "const a = tr('It\\'s {n} mm', { n });",
      'const b = tr(',
      '  "Two \\"quoted\\" words",',
      ');',
      'const c = tr(`Plain template`);',
      'const d = tr(name);',
      '// tr(text) in a comment is no call',
      '/** tr(key, params) */',
    ].join('\n');
    const { keys, bad } = extractKeys(src, 'x.js');
    expect(keys.map((k) => [k.key, k.line])).toEqual([
      ["It's {n} mm", 1],
      ['Two "quoted" words', 2],
      ['Plain template', 5],
    ]);
    expect(bad).toEqual([{ file: 'x.js', line: 6 }]);
  });

  it('reports missing and unused German texts, placeholder mismatches and conflicting areas', () => {
    const sources = { 'a.js': "tr('One {n}'); tr('Two'); tr('Three {x}');" };
    const areas = { one: { 'One {n}': 'Eins {n}', 'Three {x}': 'Drei {y}', Unused: 'Unbenutzt' }, two: { 'One {n}': 'Ein {n}' } };
    const { problems, keys } = checkI18n(sources, areas);
    expect(keys).toBe(3);
    expect(problems).toEqual([
      'de/one.js: "Three {x}" has placeholders {x}, the German text {y}',
      'de/two.js and de/one.js translate "One {n}" differently',
      'a.js:1: no German text for "Two"',
      'de/one.js: "Unused" is not used in src/',
    ]);
  });

  it('passes on the source tree: every text of the app has a German translation', () => {
    expect(checkI18n(sourceFiles(), AREAS).problems).toEqual([]);
  });
});
