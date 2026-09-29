import { afterEach, describe, expect, it, vi } from 'vitest';
import { EXTERNAL_SOURCES, NACA_PRESETS, loadLibraryIndex, nacaEntry, suggestAttribution } from '../src/airfoil/library.js';
import { checkAirfoil } from '../src/airfoil/sanity.js';

describe('airfoil library', () => {
  afterEach(() => vi.unstubAllGlobals());

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

  it('loads the bundled index and resolves file URLs', async () => {
    vi.stubGlobal('fetch', async () => ({ ok: true, json: async () => ({ airfoils: [{ id: 'a', name: 'A', file: 'a.dat' }] }) }));
    expect(await loadLibraryIndex('./lib/')).toEqual([{ id: 'a', name: 'A', file: 'a.dat', url: './lib/a.dat' }]);
    vi.stubGlobal('fetch', async () => ({ ok: true, json: async () => ({}) }));
    expect(await loadLibraryIndex()).toEqual([]);
    vi.stubGlobal('fetch', async () => ({ ok: false }));
    expect(await loadLibraryIndex()).toEqual([]);
    vi.stubGlobal('fetch', async () => {
      throw new Error('offline');
    });
    expect(await loadLibraryIndex()).toEqual([]);
  });
});
