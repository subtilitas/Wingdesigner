import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { setLanguage } from '../src/i18n/index.js';
import { DE } from '../src/i18n/de/index.js';
import { EXTERNAL_SOURCES, NACA_PRESETS, nacaEntry, suggestAttribution } from '../src/airfoil/library.js';
import { bundledLibrary } from '../src/airfoil/bundled.js';
import { importAirfoilText } from '../src/airfoil/sanity.js';
import { checkAirfoil } from '../src/airfoil/sanity.js';
import { libraryText } from '../src/ui/airfoils.js';

describe('airfoil library', () => {
  it('generates every NACA preset as a valid airfoil', () => {
    for (const n of NACA_PRESETS) {
      const a = nacaEntry(n.code);
      expect(a.name).toBe(`NACA ${n.code}`);
      expect(a.source.kind).toBe('naca');
      expect(checkAirfoil(a.points).ok).toBe(true);
    }
  });

  it('suggests attributions for known external sources', () => {
    expect(suggestAttribution('HS-130')).toBe('Hartmut Siegmann, www.aerodesign.de');
    expect(suggestAttribution('MH 45  9.85%')).toBe('Martin Hepperle, www.mh-aerotools.de');
    expect(suggestAttribution('NACA 2412')).toBe('');
    expect(EXTERNAL_SOURCES.every((s) => s.url.startsWith('https://'))).toBe(true);
  });

  it('bundles the 56 MH airfoils with the attribution and coordinate page of their designer', () => {
    const mh = bundledLibrary().filter((a) => a.source.license === 'written-permission');
    expect(mh).toHaveLength(56);
    for (const a of mh) {
      expect(a.name, a.id).toMatch(/^MH \d+B?$/);
      expect(a.source.author).toBe('Martin Hepperle, www.mh-aerotools.de');
      expect(a.source.url).toBe(`https://www.mh-aerotools.de/airfoils/${a.id.replace('-', '')}koo.htm`);
      expect(a.source.terms).toBe('https://github.com/subtilitas/Wingdesigner/blob/main/public/airfoils/NOTICE.md#mh-airfoils');
      // The name line carries the attribution.
      expect(a.text.split('\n')[0]).toBe(`${a.name} Airfoil by Martin Hepperle, www.mh-aerotools.de`);
    }
  });

  it('bundles every file of public/airfoils/index.json with its text, in index order', () => {
    const index = JSON.parse(readFileSync('public/airfoils/index.json', 'utf8'));
    const lib = bundledLibrary();
    expect(lib.map((a) => a.id)).toEqual(index.airfoils.map((a) => a.id));
    for (const a of lib) {
      expect(a.text).toBe(readFileSync(`public/airfoils/${a.file}`, 'utf8'));
      expect(importAirfoilText(a.text, a.file).ok, a.file).toBe(true);
    }
  });
});

describe('build licenses', () => {
  it('finds the npm package of a bundled module with / (Vite module ids) and \\ (Windows paths)', async () => {
    const { packageRoot } = await import('../vite.config.js');
    expect(packageRoot('C:/w/node_modules/three/build/three.module.js')).toBe('C:/w/node_modules/three');
    expect(packageRoot('C:\\w\\node_modules\\@scope\\pkg\\lib\\index.js')).toBe('C:/w/node_modules/@scope/pkg');
    expect(packageRoot('/w/node_modules/a/node_modules/fflate/esm/browser.js')).toBe('/w/node_modules/a/node_modules/fflate');
    expect(packageRoot('C:/w/src/main.js')).toBeNull();
  });
});

describe('airfoil library in German', () => {
  afterEach(() => setLanguage('en'));

  it('has a German text for every descriptive text of the library (the Airfoils tab translates them)', () => {
    const texts = [
      ...NACA_PRESETS.flatMap((n) => [n.category, n.use]),
      ...EXTERNAL_SOURCES.map((s) => s.note),
      ...bundledLibrary().flatMap((a) => [a.category, a.use].filter(Boolean)),
    ];
    expect(texts.length).toBeGreaterThan(150);
    // A text is a German key, or an MH use text built from a key and the numbers (libraryText).
    const mhUse = /^(.+)\. Thickness \d+\.\d % of chord\.(?: For Reynolds numbers of [\d,]+ and above\.)?$/;
    for (const text of texts) expect(typeof DE[text] === 'string' || typeof DE[mhUse.exec(text)?.[1]] === 'string', text).toBe(true);
    setLanguage('de');
    for (const text of texts) expect(libraryText(text), text).not.toBe(text);
  });

  it('keeps names, attributions, licenses and links as data in both languages', () => {
    const en = { entry: nacaEntry('2412'), attribution: suggestAttribution('MH 45  9.85%'), sources: EXTERNAL_SOURCES.map((s) => [s.name, s.url, s.attribution]) };
    setLanguage('de');
    const de = { entry: nacaEntry('2412'), attribution: suggestAttribution('MH 45  9.85%'), sources: EXTERNAL_SOURCES.map((s) => [s.name, s.url, s.attribution]) };
    expect(de).toEqual(en);
    expect(de.entry.name).toBe('NACA 2412');
    expect(de.entry.source.license).toMatch(/^Generated from published equations/);
  });

  it('checks the bundled files with German messages and the same issue codes', () => {
    for (const a of bundledLibrary()) {
      const en = importAirfoilText(a.text, a.file);
      setLanguage('de');
      const de = importAirfoilText(a.text, a.file);
      setLanguage('en');
      expect(de.issues.map((i) => i.code), a.file).toEqual(en.issues.map((i) => i.code));
      // The statistics line is always there and always German.
      expect(de.issues.find((i) => i.code === 'stats').message, a.file).toMatch(/ Punkte, Dicke \d+,\d\d % bei \d+,\d %, Wölbung -?\d+,\d\d % bei \d+,\d %, Endleistendicke -?\d+,\d{3} %\.$/);
    }
  });
});
