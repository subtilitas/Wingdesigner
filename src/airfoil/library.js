// Built-in airfoil library: NACA sections generated in the browser, and external sources the user
// can download from. The bundled coordinate files of public/airfoils/ come from bundled.js.

import { nacaAirfoil, parseNacaCode } from './naca.js';

export const NACA_PRESETS = [
  { code: '0006', category: 'Symmetric', use: 'Thin tail surfaces' },
  { code: '0008', category: 'Symmetric', use: 'Tail surfaces' },
  { code: '0009', category: 'Symmetric', use: 'Tail surfaces, fins' },
  { code: '0010', category: 'Symmetric', use: 'Tail surfaces, flying-wing tips' },
  { code: '0012', category: 'Symmetric', use: 'Aerobatic wings, rudders' },
  { code: '0015', category: 'Symmetric', use: 'Thick aerobatic wings' },
  { code: '2408', category: 'Cambered', use: 'Thin sport wings' },
  { code: '2410', category: 'Cambered', use: 'Sport wings, tip sections' },
  { code: '2412', category: 'Cambered', use: 'Trainers and sport models' },
  { code: '2415', category: 'Cambered', use: 'Slow trainers' },
  { code: '4412', category: 'Cambered', use: 'Slow flyers, high lift' },
  { code: '4415', category: 'Cambered', use: 'Slow flyers, scale models' },
  { code: '6409', category: 'Cambered', use: 'High-lift, low-speed models' },
  { code: '23012', category: 'Cambered', use: 'Scale and sport models' },
  { code: '23015', category: 'Cambered', use: 'Thick scale wings' },
  { code: '23112', category: 'Reflex', use: 'Reflexed 5-digit section (flying-wing experiments)' },
  { code: '24112', category: 'Reflex', use: 'Reflexed 5-digit section' },
];

export const NACA_SOURCE = {
  kind: 'naca',
  license: 'Generated from published equations (NACA Report 824, Abbott, von Doenhoff and Stivers, 1945); no third-party coordinate data.',
  url: 'https://ntrs.nasa.gov/citations/19930090976',
};

export function nacaEntry(code, options) {
  const a = nacaAirfoil(code, options);
  // The designation and trailing-edge option identify a generated section (addAirfoil deduplicates by them).
  return { name: a.name, points: a.points, source: { ...NACA_SOURCE, code: parseNacaCode(code).code, closedTE: options?.closedTE === true } };
}

/**
 * External sources (not bundled). Their terms allow personal use; the user downloads a file and
 * loads it with the upload function.
 */
export const EXTERNAL_SOURCES = [
  {
    name: 'aerodesign.de - Hartmut Siegmann',
    url: 'https://aerodesign.de/profile/profile_hs.htm',
    note: 'HS airfoils and catalogs for planks, swept flying wings, gliders. Use with attribution "Hartmut Siegmann, www.aerodesign.de"; redistribution is restricted, commercial use needs written permission.',
    attribution: 'Hartmut Siegmann, www.aerodesign.de',
    match: /^\s*HS[\s-]/i,
  },
  {
    name: 'MH-AeroTools - Martin Hepperle',
    url: 'https://www.mh-aerotools.de/airfoils/',
    note: 'MH airfoils (e.g. MH 45, MH 60 for flying wings, MH 32 for gliders). Terms: personal use; publications must cite the source.',
    attribution: 'Martin Hepperle, www.mh-aerotools.de',
    match: /^\s*MH[\s-]?\d/i,
  },
  {
    name: 'UIUC Airfoil Coordinates Database',
    url: 'https://m-selig.ae.illinois.edu/ads/coord_database.html',
    note: 'About 1,600 airfoils in Selig format from many designers. The database states no license for the coordinate files; the rights of each designer apply.',
    attribution: 'UIUC Airfoil Coordinates Database',
    match: null,
  },
];

/** Suggested attribution for an uploaded airfoil, from its name. */
export function suggestAttribution(name) {
  for (const s of EXTERNAL_SOURCES) if (s.match && s.match.test(name)) return s.attribution;
  return '';
}
