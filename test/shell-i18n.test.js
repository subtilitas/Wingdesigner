// German texts of the shell (src/main.js, src/ui/settings.js, src/ui/wizard.js), the number format
// of the label helper and the text and arrow step of the number fields in src/ui/dom.js. The browser
// parts are tested in e2e/language.spec.js.
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { count, fixed, plain, setLanguage, tr } from '../src/i18n/index.js';
import { AREAS } from '../src/i18n/de/index.js';
import { formatNum, inputText, slugFile, stepValue } from '../src/ui/dom.js';

afterEach(() => setLanguage('en'));

describe('formatNum', () => {
  it('rounds to the digits and writes a decimal comma in German', () => {
    expect([formatNum(1.5), formatNum(1.23456, 2), formatNum(600), formatNum(0.1 + 0.2, 1), formatNum(NaN)]).toEqual(['1.5', '1.23', '600', '0.3', '']);
    setLanguage('de');
    expect([formatNum(1.5), formatNum(1.23456, 2), formatNum(600), formatNum(0.1 + 0.2, 1), formatNum(Infinity)]).toEqual(['1,5', '1,23', '600', '0,3', '']);
  });
});

describe('number fields', () => {
  it('show the shortest round-trip decimal: unchanged in English, with a decimal comma in German', () => {
    const values = [0.25, -6.5, 600.0000002, 1e-7, 1200, NaN];
    expect(values.map(inputText)).toEqual(['0.25', '-6.5', '600.0000002', '1e-7', '1200', '']);
    setLanguage('de');
    expect(values.map(inputText)).toEqual(['0,25', '-6,5', '600,0000002', '1e-7', '1200', '']);
  });

  it('step by the step from the value without binary rounding residue, clamped to min and max', () => {
    expect([stepValue(0.25, 0.05), stepValue(0.3, -0.1), stepValue(-6.5, 0.1), stepValue(600.0000002, 5), stepValue(1e-7, 0.1)]).toEqual([0.3, 0.2, -6.4, 605.0000002, 0.1000001]);
    expect([stepValue(0.97, 0.05, 0, 1), stepValue(0.02, -0.05, 0, 1), stepValue(-300, 50, 100, 1000), stepValue(60, 4, 16, 200)]).toEqual([1, 0, 100, 64]);
  });
});

describe('slugFile', () => {
  it('writes German umlauts out and drops other accents; English names keep their file names', () => {
    expect(slugFile('Sportflügel 1500', 'step')).toBe('Sportfluegel_1500.step');
    expect(slugFile('Unbenannter Flügel', 'json')).toBe('Unbenannter_Fluegel.json');
    expect(slugFile('Größe ÄÖÜ', 'stl')).toBe('Groesse_AeOeUe.stl');
    // Letters written as a base letter and a combining mark are joined first.
    expect(slugFile('Fl\u0075\u0308gel', '3mf')).toBe('Fluegel.3mf');
    expect(slugFile('Sport wing 1500', 'step')).toBe('Sport_wing_1500.step');
    expect(slugFile('Café ñ', 'dat')).toBe('Cafe_n.dat');
    expect(slugFile('', 'json')).toBe('wing.json');
  });
});

describe('German shell texts', () => {
  const status = () =>
    tr('Span {span} mm · area {area} dm² · AR {ar} · MAC {mac} mm', { span: fixed(1200, 0), area: fixed(23.04, 2), ar: fixed(6.25, 2), mac: fixed(196, 1) });

  it('writes the status bar with a decimal comma', () => {
    expect(status()).toBe('Span 1200 mm · area 23.04 dm² · AR 6.25 · MAC 196.0 mm');
    setLanguage('de');
    expect(status()).toBe('Spannweite 1.200 mm · Fläche 23,04 dm² · AR 6,25 · MAC 196,0 mm');
  });

  it('counts warnings in the singular and the plural', () => {
    const warnings = (n) => tr('{n} warning(s)', { n: plain(n) });
    expect([warnings(1), warnings(3)]).toEqual(['1 warning(s)', '3 warning(s)']);
    setLanguage('de');
    expect([warnings(1), warnings(3)]).toEqual(['1 Warnung', '3 Warnungen']);
    expect(tr('{n} error(s): {first}', { n: plain(2), first: 'Kaputt' })).toBe('2 Fehler: Kaputt');
  });

  it('groups the loft grid points with a dot and shows the four variants of the note', () => {
    // The numbers are written when the text is made, in the language of that moment.
    const notes = () => {
      const points = count(16441);
      const [K, Kset, limit] = [plain(5), plain(8), count(60000)];
      return {
        plain: tr('Loft grid: {points} points.', { points }),
        reduced: tr('Loft grid: {points} points, {K} spanwise stations per panel instead of {Kset}.', { points, K, Kset }),
        over: tr('Loft grid: {points} points; above {limit}, {cost}.', { points, limit, cost: 'X' }),
        both: tr('Loft grid: {points} points, {K} spanwise stations per panel instead of {Kset}; above {limit}, {cost}.', { points, K, Kset, limit, cost: 'X' }),
      };
    };
    expect(notes()).toEqual({
      plain: 'Loft grid: 16,441 points.',
      reduced: 'Loft grid: 16,441 points, 5 spanwise stations per panel instead of 8.',
      over: 'Loft grid: 16,441 points; above 60,000, X.',
      both: 'Loft grid: 16,441 points, 5 spanwise stations per panel instead of 8; above 60,000, X.',
    });
    setLanguage('de');
    expect(notes()).toEqual({
      plain: 'Flächengitter: 16.441 Punkte.',
      reduced: 'Flächengitter: 16.441 Punkte, 5 Stationen je Feld in Spannweitenrichtung statt 8.',
      over: 'Flächengitter: 16.441 Punkte; über 60.000: X.',
      both: 'Flächengitter: 16.441 Punkte, 5 Stationen je Feld in Spannweitenrichtung statt 8; über 60.000: X.',
    });
    // The budget lowers the stations per panel to 1 when many sections reach the limit: singular.
    expect(tr('Loft grid: {points} points, {K} spanwise stations per panel instead of {Kset}.', { points: count(4812000), K: '1', Kset: '8' })).toBe(
      'Flächengitter: 4.812.000 Punkte, 1 Station je Feld in Spannweitenrichtung statt 8.',
    );
    expect(tr('Loft grid: {points} points, {K} spanwise stations per panel instead of {Kset}; above {limit}, {cost}.', { points: '9', K: '1', Kset: '8', limit: '7', cost: 'X' })).toBe(
      'Flächengitter: 9 Punkte, 1 Station je Feld in Spannweitenrichtung statt 8; über 7: X.',
    );
  });

  it('fills the wizard summary and the Open messages', () => {
    setLanguage('de');
    expect(
      tr('Area {area} dm², aspect ratio {ar}, mean aerodynamic chord {mac} mm at y = {y} mm, tip chord {tip} mm.', {
        area: fixed(23.04, 1),
        ar: fixed(6.25, 2),
        mac: fixed(196, 1),
        y: fixed(288.4, 0),
        tip: fixed(144, 1),
      }),
    ).toBe('Fläche 23,0 dm², Streckung 6,25, mittlere aerodynamische Flügeltiefe 196,0 mm bei y = 288 mm, Randtiefe 144,0 mm.');
    expect(tr('Cannot open {name}: {size} MB; project files are limited to {limit} MB.', { name: 'a.json', size: fixed(123456789 / 1e6, 1), limit: plain(100) })).toBe(
      'a.json kann nicht geöffnet werden: 123,5 MB; Projektdateien sind auf 100 MB begrenzt.',
    );
    expect(tr('Created "{name}".', { name: 'Sport' })).toBe('Entwurf „Sport“ angelegt.');
  });

  it('keeps English text and numbers identical to the code before translation', () => {
    expect(tr('Cannot open {name}: {size} MB; project files are limited to {limit} MB.', { name: 'a.json', size: fixed(123456789 / 1e6, 1), limit: plain(100) })).toBe(
      'Cannot open a.json: 123.5 MB; project files are limited to 100 MB.',
    );
    expect(tr('Tip profile scale 1 : N of the previous section chord (N = {min} to {max}; tip chord at least {chord} mm)', { min: plain(100), max: plain(1000), chord: plain(1) })).toBe(
      'Tip profile scale 1 : N of the previous section chord (N = 100 to 1000; tip chord at least 1 mm)',
    );
  });

  it('gives the labels of the language list and the tabs in both languages', () => {
    expect(['Sections', 'Planform', 'Airfoils', 'Settings', 'Checks'].map((k) => tr(k))).toEqual(['Sections', 'Planform', 'Airfoils', 'Settings', 'Checks']);
    setLanguage('de');
    expect(['Sections', 'Planform', 'Airfoils', 'Settings', 'Checks'].map((k) => tr(k))).toEqual(['Schnitte', 'Grundriss', 'Profile', 'Einstellungen', 'Prüfungen']);
  });

  it('makes the note about the left-out NURBS data when it is shown, not once at load', () => {
    // OMITTED_NOTE was the English text, fixed when io.js loaded; Save and the JSON export call omittedNote() now.
    for (const file of ['../src/main.js', '../src/ui/exportui.js', '../src/model/io.js']) {
      expect(readFileSync(new URL(file, import.meta.url), 'utf8'), file).not.toMatch(/OMITTED_NOTE/);
    }
    for (const file of ['../src/main.js', '../src/ui/exportui.js']) expect(readFileSync(new URL(file, import.meta.url), 'utf8'), file).toMatch(/omittedNote\(\)/);
  });

  it('has no empty German text in the shell catalog', () => {
    for (const [key, value] of Object.entries(AREAS.shell)) expect(typeof value === 'function' || value.trim() !== '', key).toBe(true);
  });
});
