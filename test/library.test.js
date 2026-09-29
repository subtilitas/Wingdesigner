import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { EXTERNAL_SOURCES, NACA_PRESETS, nacaEntry, suggestAttribution } from '../src/airfoil/library.js';
import { bundledLibrary } from '../src/airfoil/bundled.js';
import { importAirfoilText } from '../src/airfoil/sanity.js';
import { checkAirfoil } from '../src/airfoil/sanity.js';

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
