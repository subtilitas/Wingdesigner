import { afterEach, describe, expect, it } from 'vitest';
import { buildWing } from '../src/geom/wing.js';
import { setLanguage } from '../src/i18n/index.js';
import { WARN, exportCost, formatMegabytes, formatSeconds } from '../src/model/budget.js';
import { LIMITS } from '../src/model/project.js';
import { airfoilRefusal, libraryText } from '../src/ui/airfoils.js';
import { exportSizeNote } from '../src/ui/exportui.js';
import { sampleProject } from './helpers.js';

afterEach(() => setLanguage('en'));

// A build that only carries what the size notes read: sizes of the grid and of the surface.
function fakeBuild({ samples, columns = 1000, degreeV = 1 }) {
  return {
    surface: { degreeV, points: { length: samples, 0: { length: columns } } },
    paramsU: new Array(samples).fill(0),
    paramsV: new Array(samples).fill(0),
    closedTE: true,
  };
}

describe('Airfoils tab', () => {
  const full = { airfoils: new Array(LIMITS.maxAirfoils).fill({ points: [] }) };
  const heavy = { airfoils: [{ points: new Array(LIMITS.maxAirfoilPoints - 10) }] };

  it('names the reason an airfoil cannot be added, with the numbers of the language', () => {
    expect(airfoilRefusal(full, 5)).toBe('The project holds 10,000 airfoils, the limit; "Remove unused" frees places.');
    expect(airfoilRefusal(heavy, 20)).toBe('With this airfoil the project airfoils hold 1,000,010 points; the limit is 1,000,000. "Remove unused" frees points.');
    expect(airfoilRefusal(heavy, 10)).toBeNull();
    setLanguage('de');
    expect(airfoilRefusal(full, 5)).toBe('Das Projekt enthält 10.000 Profile und hat damit die Grenze erreicht; „Unbenutzte entfernen“ schafft Platz.');
    expect(airfoilRefusal(heavy, 20)).toBe('Mit diesem Profil enthalten die Projektprofile 1.000.010 Punkte; die Grenze liegt bei 1.000.000. „Unbenutzte entfernen“ gibt Punkte frei.');
  });

  it('shows the library categories, uses and notes in the current language and unknown texts as they are', () => {
    expect(libraryText('Symmetric')).toBe('Symmetric');
    expect(libraryText('Tail surfaces, fins')).toBe('Tail surfaces, fins');
    setLanguage('de');
    expect(libraryText('Symmetric')).toBe('Symmetrisch');
    expect(libraryText('Tail surfaces, fins')).toBe('Leitwerke, Seitenflossen');
    expect(libraryText('About 1,600 airfoils in Selig format from many designers. The database states no license for the coordinate files; the rights of each designer apply.')).toMatch(/^Etwa 1\.600 Profile im Selig-Format/);
    expect(libraryText('A new library entry')).toBe('A new library entry');
    expect(libraryText('')).toBe('');
  });

  it('translates the use text of an MH airfoil around its numbers', () => {
    const withRe = 'Tailless models, low pitching moment. Thickness 9.8 % of chord. For Reynolds numbers of 100,000 and above.';
    const plain = 'High-speed models, very low drag. Thickness 8.0 % of chord.';
    expect(libraryText(withRe)).toBe(withRe);
    expect(libraryText(plain)).toBe(plain);
    setLanguage('de');
    expect(libraryText(withRe)).toBe('Schwanzlose Modelle, kleines Nickmoment. Dicke 9,8 % der Profiltiefe. Für Reynolds-Zahlen ab 100.000.');
    expect(libraryText(plain)).toBe('Schnellflugmodelle, sehr geringer Widerstand. Dicke 8,0 % der Profiltiefe.');
    // An application that is no key stays English inside the German template.
    expect(libraryText('New use. Thickness 12.0 % of chord.')).toBe('New use. Dicke 12,0 % der Profiltiefe.');
  });
});

describe('Export dialog size note', () => {
  it('has no note for the project JSON and for a build without surface', () => {
    const build = buildWing(sampleProject());
    expect(exportSizeNote(build, { fmt: 'json', half: 'halves', dens: 1 })).toBeNull();
    expect(exportSizeNote({ surface: null }, { fmt: 'step', half: 'halves', dens: 1 })).toBeNull();
    expect(exportSizeNote(null, { fmt: 'stl', half: 'halves', dens: 1 })).toBeNull();
  });

  it('writes the size of a small STEP and STL export in English and German', () => {
    const build = buildWing(sampleProject());
    const step = exportSizeNote(build, { fmt: 'step', half: 'halves', dens: 1 });
    expect(step.text).toMatch(/^[\d,]+ control points, file about /);
    expect([step.className, step.over]).toEqual(['small muted', false]);
    const stl = exportSizeNote(build, { fmt: 'stl', half: 'right', dens: 2 });
    expect(stl.text).toMatch(/^0\.\d\d million triangles, file about /);
    setLanguage('de');
    expect(exportSizeNote(build, { fmt: 'step', half: 'halves', dens: 1 }).text).toMatch(/^[\d.]+ Kontrollpunkte, Datei /);
    expect(exportSizeNote(build, { fmt: 'stl', half: 'right', dens: 2 }).text).toMatch(/^0,\d\d Millionen Dreiecke, Datei /);
  });

  it('warns about a large STEP export with the time and memory in the language', () => {
    // 2 x 2,000 x 1,000 control points for both halves, 1,000,000 x 2 above the warning of 1,000,000.
    const build = fakeBuild({ samples: 1001, columns: 1000 });
    const c = exportCost(1001 * 1000 * 2, 'step');
    const what = `2.0 million control points, file ${formatMegabytes(c.fileMB)}`;
    const note = exportSizeNote(build, { fmt: 'step', half: 'halves', dens: 1 });
    expect(note.text).toBe(`${what}. The export takes ${formatSeconds(c.seconds)} and ${formatMegabytes(c.megabytes)} of browser memory.`);
    expect([note.className, note.over]).toEqual(['small sev-warning', false]);
    setLanguage('de');
    const de = exportSizeNote(build, { fmt: 'step', half: 'halves', dens: 1 });
    expect(de.text).toBe(
      `2,0 Millionen Kontrollpunkte, Datei ${formatMegabytes(c.fileMB)}. Der Export dauert ${formatSeconds(c.seconds)} und belegt ${formatMegabytes(c.megabytes)} Arbeitsspeicher.`,
    );
  });

  it('turns Download off above the STEP limit, with the limit written in the language', () => {
    const build = fakeBuild({ samples: 2001, columns: 1000 });
    const n = 2001 * 1000 * 2;
    const c = exportCost(n, 'step');
    expect(n).toBeGreaterThan(LIMITS.maxStepPoints);
    const note = exportSizeNote(build, { fmt: 'step', half: 'halves', dens: 1 });
    expect(note.text).toBe(
      `4.0 million control points, file ${formatMegabytes(c.fileMB)}: above the limit of 3 million control points, where the file takes more memory than a desktop browser tab holds. Use one half, or fewer chord samples or panel stations.`,
    );
    expect([note.className, note.over]).toEqual(['small sev-error', true]);
    setLanguage('de');
    expect(exportSizeNote(build, { fmt: 'step', half: 'halves', dens: 1 }).text).toBe(
      `4,0 Millionen Kontrollpunkte, Datei ${formatMegabytes(c.fileMB)}: über der Grenze von 3 Millionen Kontrollpunkten, ab der die Datei mehr Speicher braucht, als ein Browser-Tab auf dem Desktop bietet. Eine Hälfte oder weniger Stationen je Profilseite oder je Feld verwenden.`,
    );
  });

  it('warns about and refuses large mesh exports with decimal comma in German', () => {
    const build = fakeBuild({ samples: 1001 });
    const warn = exportSizeNote(build, { fmt: '3mf', half: 'halves', dens: 1 });
    const n = 2 * (2 * 1000 * 1000 + 2 * 1001);
    expect(n).toBeGreaterThan(WARN.exportTriangles);
    const c = exportCost(n, '3mf');
    expect(warn.text).toBe(`4.0 million triangles, file ${formatMegabytes(c.fileMB)}. The export takes ${formatSeconds(c.seconds)} and ${formatMegabytes(c.megabytes)} of browser memory.`);
    expect([warn.className, warn.over]).toEqual(['small sev-warning', false]);
    const over = exportSizeNote(build, { fmt: 'stl', half: 'halves', dens: 2 });
    expect(over.text).toMatch(/^16\.0 million triangles, file about .*: above the limit of 10 million triangles, where a desktop browser tab runs out of memory\. Use Normal density, one half, or fewer chord samples or panel stations\.$/);
    expect(over.over).toBe(true);
    setLanguage('de');
    const de = exportSizeNote(build, { fmt: 'stl', half: 'halves', dens: 2 });
    expect(de.text).toMatch(/^16,0 Millionen Dreiecke, Datei .*: über der Grenze von 10 Millionen Dreiecken, ab der einem Browser-Tab auf dem Desktop der Speicher ausgeht\. Netzdichte „Normal“, eine Hälfte oder weniger Stationen je Profilseite oder je Feld verwenden\.$/);
    expect(de.className).toBe('small sev-error');
  });
});
