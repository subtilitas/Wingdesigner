import { afterEach, describe, expect, it } from 'vitest';
import { setLanguage } from '../src/i18n/index.js';
import { LIMITS } from '../src/model/project.js';
import { addPointTitle, guideLabel, guidePointReadout, sectionReadout } from '../src/ui/planform.js';
import { insertTitle, panelAngleField, sectionFields } from '../src/ui/sections.js';
import { sampleProject } from './helpers.js';

afterEach(() => setLanguage('en'));

/** The sample wing with `n` sections at distinct span positions. */
function withSections(n) {
  return sampleProject({ sections: Array.from({ length: n }, (_, i) => ({ airfoil: 'root', x: 0, y: 5 * i, z: 0, chord: 100, twist: 0 })) });
}

describe('Sections table', () => {
  it('labels the columns with unit and tooltip in English and German', () => {
    const text = () => sectionFields().map((f) => `${f.label} (${f.unit})`);
    expect(text()).toEqual(['y (mm)', 'x (mm)', 'z (mm)', 'Chord (mm)', 'Twist (deg)']);
    expect(sectionFields()[3].title).toBe('Chord length (profile scale)');
    setLanguage('de');
    // Soft hyphens (U+00AD) let the long German headers break.
    expect(text()).toEqual(['y (mm)', 'x (mm)', 'z (mm)', 'Tiefe (mm)', 'Schrän\u00ADkung (°)']);
    expect(sectionFields()[3].title).toBe('Profiltiefe (Maßstab des Profils)');
    expect(sectionFields()[4].title).toBe('Schränkung um den Drehpunkt; positiv = Nase hoch');
  });

  it('labels the panel angle column, shown with mitred section planes', () => {
    const f = panelAngleField();
    expect([f.key, `${f.label} (${f.unit})`, f.min, f.max, f.step]).toEqual(['panelAngle', 'Panel angle (deg)', -89.9999, 89.9999, 0.1]);
    setLanguage('de');
    expect(`${panelAngleField().label} (${panelAngleField().unit})`).toBe('Feld\u00ADwinkel (°)');
    expect(panelAngleField().title).toBe('Winkel des Felds zum nächsten Schnitt für die Schnittebenen auf Gehrung. Leer: aus y und z der beiden Schnitte.');
  });

  it('keeps the limits of the columns in every language', () => {
    const en = sectionFields().map(({ key, step, min, max }) => ({ key, step, min, max }));
    setLanguage('de');
    expect(sectionFields().map(({ key, step, min, max }) => ({ key, step, min, max }))).toEqual(en);
  });

  it('words the insert button tooltip for the limit, a large table and a small one', () => {
    expect(insertTitle(sampleProject())).toBe('Insert a section after this one');
    expect(insertTitle(withSections(LIMITS.maxSections))).toBe('At most 20,000 sections: more run a desktop browser tab out of memory.');
    expect(insertTitle(withSections(200))).toMatch(/^Insert a section after this one\. With 201 sections, each change takes /);
    setLanguage('de');
    expect(insertTitle(sampleProject())).toBe('Einen Schnitt nach diesem einfügen');
    expect(insertTitle(withSections(LIMITS.maxSections))).toBe('Höchstens 20.000 Schnitte: Bei mehr geht einem Browser-Tab auf dem Desktop der Speicher aus.');
    expect(insertTitle(withSections(200))).toMatch(/^Einen Schnitt nach diesem einfügen\. Mit 201 Schnitten: /);
    // 1,000 sections: the German number groups with a dot.
    expect(insertTitle(withSections(1000))).toMatch(/^Einen Schnitt nach diesem einfügen\. Mit 1\.001 Schnitten: /);
  });
});

describe('Planform tab', () => {
  const guide = (n) => ({ enabled: true, mode: 'fit', degree: 3, points: Array.from({ length: n }, (_, i) => [i, 10 * i]) });

  it('names the guide curves', () => {
    expect([guideLabel('nose'), guideLabel('end')]).toEqual(['Nose line (leading edge)', 'End line (trailing edge)']);
    setLanguage('de');
    expect([guideLabel('nose'), guideLabel('end')]).toEqual(['Nasenlinie (Nasenleiste)', 'Endlinie (Endleiste)']);
  });

  it('writes the drag readouts with the number format of the language', () => {
    expect(guidePointReadout('nose', 1, [12.5, 300])).toBe('Nose line (leading edge) point 2: x 12.5 mm, y 300 mm');
    expect(guidePointReadout('end', 0, [-3.25, 0.5])).toBe('End line (trailing edge) point 1: x -3.3 mm, y 0.5 mm');
    expect(sectionReadout({ x: 20, y: 300.04, chord: 170.55 })).toBe('Section at y 300 mm: x 20 mm, chord 170.6 mm');
    setLanguage('de');
    expect(guidePointReadout('nose', 1, [12.5, 300])).toBe('Nasenlinie (Nasenleiste), Punkt 2: x 12,5 mm, y 300 mm');
    expect(guidePointReadout('end', 0, [-3.25, 0.5])).toBe('Endlinie (Endleiste), Punkt 1: x -3,3 mm, y 0,5 mm');
    expect(sectionReadout({ x: 20, y: 300.04, chord: 170.55 })).toBe('Schnitt bei y 300 mm: x 20 mm, Profiltiefe 170,6 mm');
  });

  it('words the Add point tooltip for the limit, a large curve and a small one', () => {
    const p = sampleProject();
    expect(addPointTitle(p, guide(10))).toBe('Add a point in the widest gap');
    expect(addPointTitle(p, guide(LIMITS.maxGuidePoints))).toBe('At most 20,000 points per guide curve.');
    expect(addPointTitle(p, guide(600))).toMatch(/^Add a point in the widest gap\. With 601 points, each change takes /);
    setLanguage('de');
    expect(addPointTitle(p, guide(10))).toBe('Punkt in der größten Lücke hinzufügen');
    expect(addPointTitle(p, guide(LIMITS.maxGuidePoints))).toBe('Höchstens 20.000 Punkte je Leitkurve.');
    expect(addPointTitle(p, guide(600))).toMatch(/^Punkt in der größten Lücke hinzufügen\. Mit 601 Punkten: /);
    expect(addPointTitle(p, guide(1500))).toMatch(/^Punkt in der größten Lücke hinzufügen\. Mit 1\.501 Punkten: /);
  });
});
