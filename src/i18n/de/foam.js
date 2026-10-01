// German texts of the foam-cutting wizard (src/ui/foam.js, src/export/foam.js) and its top-bar button.
export default {
  Foam: 'Schaum',
  'Foam cutting': 'Schaumschnitt',
  'Foam cutting: plan foam cores for a hot-wire cutter with cuts, end profiles and 1:1 templates':
    'Schaumschnitt: Schaumkerne für einen Heißdrahtschneider mit Schnitten, Endprofilen und Schablonen 1:1 planen',
  'Splits the half wing into foam cores for a hot-wire cutter and writes their end profiles and 1:1 templates.':
    'Teilt die Flügelhälfte in Schaumkerne für einen Heißdrahtschneider und schreibt ihre Endprofile und Schablonen 1:1.',
  'The wing has errors; fix them before planning foam cores.': 'Der Flügel hat Fehler; diese zuerst beheben, dann die Schaumkerne planen.',
  'Planform with the cuts': 'Grundriss mit den Schnitten',
  'Longest core (mm)': 'Längster Kern (mm)',
  'Deviation limit (mm)': 'Grenze der Abweichung (mm)',
  'Kerf for templates (mm)': 'Schnittbreite für Schablonen (mm)',
  'Paper (PDF)': 'Papier (PDF)',
  Letter: 'Letter',
  'Cuts (y in mm)': 'Schnitte (y in mm)',
  'Cut {i}, y in mm': 'Schnitt {i}, y in mm',
  'Remove the cut at y = {y} mm': 'Schnitt bei y = {y} mm entfernen',
  'No cuts: one core from root to tip.': 'Keine Schnitte: ein Kern von der Wurzel bis zum Randbogen.',
  'Add cut': 'Schnitt hinzufügen',
  'Propose cuts again': 'Schnitte neu vorschlagen',
  'Split segments over the limit': 'Segmente über der Grenze teilen',
  Segment: 'Segment',
  'y (mm)': 'y (mm)',
  'Core length (mm)': 'Kernlänge (mm)',
  'Block (mm)': 'Block (mm)',
  'Chords (mm)': 'Profiltiefen (mm)',
  'Deviation (mm)': 'Abweichung (mm)',
  'Wedge inboard': 'Keil innen',
  'Wedge outboard': 'Keil außen',
  '{angle}°, {depth} mm, {side}': '{angle}°, {depth} mm, {side}',
  upper: 'oben',
  lower: 'unten',
  '1 segment per half, deviation {dev} mm.': '1 Segment je Hälfte, Abweichung {dev} mm.',
  '{n} segments per half, largest deviation {dev} mm.': '{n} Segmente je Hälfte, größte Abweichung {dev} mm.',
  '1 core is longer than {length} mm.': '1 Kern ist länger als {length} mm.',
  '{n} cores are longer than {length} mm.': '{n} Kerne sind länger als {length} mm.',
  '1 segment deviates more than {tolerance} mm from the wing; Split segments over the limit adds cuts.':
    '1 Segment weicht mehr als {tolerance} mm vom Flügel ab; Segmente über der Grenze teilen fügt Schnitte hinzu.',
  '{n} segments deviate more than {tolerance} mm from the wing; Split segments over the limit adds cuts.':
    '{n} Segmente weichen mehr als {tolerance} mm vom Flügel ab; Segmente über der Grenze teilen fügt Schnitte hinzu.',
  '1 cut was removed: closer than {min} mm to another cut, the root or the tip.': '1 Schnitt wurde entfernt: näher als {min} mm an einem anderen Schnitt, der Wurzel oder dem Randbogen.',
  '{n} cuts were removed: closer than {min} mm to another cut, the root or the tip.': '{n} Schnitte wurden entfernt: näher als {min} mm an einem anderen Schnitt, der Wurzel oder dem Randbogen.',
  '1 cut was removed: at most {max} segments per half.': '1 Schnitt wurde entfernt: höchstens {max} Segmente je Hälfte.',
  '{n} cuts were removed: at most {max} segments per half.': '{n} Schnitte wurden entfernt: höchstens {max} Segmente je Hälfte.',
  'The PDF templates take 1 page.': 'Die PDF-Schablonen belegen 1 Seite.',
  'The PDF templates take {pages} pages.': 'Die PDF-Schablonen belegen {pages} Seiten.',
  'Each core is cut square to its segment with a straight wire between its two end profiles. At a joint, the root or the tip, the end face is sanded to the joint plane: the wedge columns give its angle, its depth along the core and the surface where it is deepest. The files describe the right half; the left half is its mirror image.':
    'Jeder Kern wird rechtwinklig zu seinem Segment mit geradem Draht zwischen seinen zwei Endprofilen geschnitten. An einer Stoßstelle, der Wurzel oder dem Randbogen wird die Endfläche auf die Stoßebene geschliffen: Die Keil-Spalten geben Winkel, Tiefe entlang des Kerns und die Seite an, an der der Keil am tiefsten ist. Die Dateien beschreiben die rechte Hälfte; die linke ist ihr Spiegelbild.',
  'The kerf offset applies to the templates (SVG, PDF, DXF) only; .dat profiles have none, the cutting program adds it.':
    'Der Versatz für die Schnittbreite gilt nur für die Schablonen (SVG, PDF, DXF); .dat-Profile haben keinen, das Schneideprogramm fügt ihn hinzu.',
  'Profiles (.dat, ZIP)': 'Profile (.dat, ZIP)',
  'Templates (SVG)': 'Schablonen (SVG)',
  'Templates (PDF)': 'Schablonen (PDF)',
  'Templates (DXF)': 'Schablonen (DXF)',
  '{name}: foam-core templates': '{name}: Schablonen für Schaumkerne',
  // src/export/foam.js
  'Foam cores of {name}: 1 segment per half wing. Lengths in mm, angles in degrees.': 'Schaumkerne von {name}: 1 Segment je Flügelhälfte. Längen in mm, Winkel in Grad.',
  'Foam cores of {name}: {n} segments per half wing. Lengths in mm, angles in degrees.': 'Schaumkerne von {name}: {n} Segmente je Flügelhälfte. Längen in mm, Winkel in Grad.',
  'mm/: end profiles in the block frame: x chordwise towards the trailing edge, h up, square to the core axis; origin at the front lower corner of the smallest block that holds both profiles of the segment (the templates add 10 mm all round). Both files of a segment share this frame and the point count: point i of the inboard profile and point i of the outboard profile lie on one straight line of the core.':
    'mm/: Endprofile im Blocksystem: x in Profiltiefe zur Endleiste, h nach oben, rechtwinklig zur Kernachse; Ursprung an der vorderen unteren Ecke des kleinsten Blocks, der beide Profile des Segments enthält (die Schablonen geben ringsum 10 mm zu). Beide Dateien eines Segments teilen dieses System und die Punktzahl: Punkt i des inneren und Punkt i des äußeren Profils liegen auf einer Geraden des Kerns.',
  'normalized/: the same profiles scaled to chord 1, leading edge at (0, 0), trailing-edge midpoint at (1, 0). segments.csv lists chord, leading-edge position and incidence (nose up positive) of each end, to place them in a cutting program.':
    'normalized/: dieselben Profile auf Profiltiefe 1 skaliert, Nasenleiste bei (0, 0), Mitte der Endleiste bei (1, 0). segments.csv nennt Profiltiefe, Lage der Nasenleiste und Anstellwinkel (Nase hoch positiv) jedes Endes, um sie in einem Schneideprogramm zu platzieren.',
  'Point order: upper trailing edge, leading edge, lower trailing edge (Selig). No kerf offset: the cutting program adds it.':
    'Punktfolge: obere Endleiste, Nasenleiste, untere Endleiste (Selig). Kein Versatz für die Schnittbreite: Das Schneideprogramm fügt ihn hinzu.',
  'Each core is cut with parallel end faces square to its axis. At a joint of two cores, or at the root or tip, the end face is sanded to the joint plane: segments.csv lists the wedge (angle, depth along the axis, surface where it is deepest).':
    'Jeder Kern wird mit parallelen Endflächen rechtwinklig zu seiner Achse geschnitten. An der Stoßstelle zweier Kerne, an der Wurzel oder am Randbogen wird die Endfläche auf die Stoßebene geschliffen: segments.csv nennt den Keil (Winkel, Tiefe entlang der Achse, Seite der größten Tiefe).',
  'The files describe the right half. The left half is the mirror image: cut the same profiles with inboard and outboard sides swapped.':
    'Die Dateien beschreiben die rechte Hälfte. Die linke Hälfte ist ihr Spiegelbild: dieselben Profile mit getauschter Innen- und Außenseite schneiden.',
  'Sand the end face to the joint: wedge {angle}°, {depth} mm deep at the upper surface.': 'Endfläche auf die Stoßebene schleifen: Keil {angle}°, {depth} mm tief an der Oberseite.',
  'Sand the end face to the joint: wedge {angle}°, {depth} mm deep at the lower surface.': 'Endfläche auf die Stoßebene schleifen: Keil {angle}°, {depth} mm tief an der Unterseite.',
  '{name}: foam-core templates, scale 1:1, mm. Check the 100 mm scale bar after printing.': '{name}: Schablonen für Schaumkerne, Maßstab 1:1, mm. Nach dem Drucken den 100-mm-Maßstab prüfen.',
  'Fix the two templates of a segment to the block ends with their frames flush with the bottom and front edges of the block.':
    'Die beiden Schablonen eines Segments an den Blockenden befestigen, ihre Rahmen bündig mit Unter- und Vorderkante des Blocks.',
  'Marks with equal numbers are passed at the same time. The left half uses the same templates, turned over.':
    'Marken mit gleicher Nummer werden gleichzeitig durchfahren. Die linke Hälfte verwendet dieselben Schablonen, umgedreht.',
  'Outlines offset outward by half the kerf: {offset} mm (kerf {kerf} mm).': 'Umrisse um die halbe Schnittbreite nach außen versetzt: {offset} mm (Schnittbreite {kerf} mm).',
  'Outlines without kerf offset.': 'Umrisse ohne Versatz für die Schnittbreite.',
  '100 mm': '100 mm',
  'Segment {i} of {n}, {end}': 'Segment {i} von {n}, {end}',
  'inboard end': 'inneres Ende',
  'outboard end': 'äußeres Ende',
  'y = {y} mm, core length {length} mm, block {width} × {height} mm': 'y = {y} mm, Kernlänge {length} mm, Block {width} × {height} mm',
  'Chord {chord} mm, incidence {incidence}°': 'Profiltiefe {chord} mm, Anstellwinkel {incidence}°',
  '100 mm. Page {page} of {pages}.': '100 mm. Seite {page} von {pages}.',
  '{label}: part {part} of {parts} (row {row}, column {col})': '{label}: Teil {part} von {parts} (Zeile {row}, Spalte {col})',
};
