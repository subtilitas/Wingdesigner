import { afterEach, describe, expect, it } from 'vitest';
import { count, fixed, initialLanguage, language, plain, setLanguage, tr, whole } from '../src/i18n/index.js';
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
