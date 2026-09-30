// German text for src/airfoil/: English key -> German text with the same {placeholders},
// or a function of the params. See src/i18n/index.js.
//
// The library texts of library.js (categories, uses, notes) are data there; the Airfoils tab
// translates them (libraryText in src/ui/airfoils.js, entries in panels.js).
const one = (n) => String(n) === '1';

export default {
  // Reading airfoil files (parse.js)
  'Read as XML airfoil geometry.': 'Als XML-Profilgeometrie gelesen.',
  '{n} elements found; only the first one is used.': '{n} Elemente gefunden; nur das erste wird verwendet.',
  'Input is {n} characters; the limit is {limit}.': 'Die Eingabe hat {n} Zeichen; die Grenze liegt bei {limit}.',
  'The XML has a <coordinates> element without a closing tag.': 'Das XML enthält ein Element <coordinates> ohne schließendes Tag.',
  'No name found; the file name is used.': 'Kein Name gefunden; der Dateiname wird verwendet.',
  'Read coordinates from an HTML page.': 'Koordinaten aus einer HTML-Seite gelesen.',
  'More than {n} coordinate lines; the limit is {limit} points.': 'Mehr als {n} Koordinatenzeilen; die Grenze liegt bei {limit} Punkten.',
  'No name line found; the file name is used as the airfoil name.': 'Keine Namenszeile gefunden; der Dateiname wird als Profilname verwendet.',
  'Decimal commas were read as decimal points.': 'Dezimalkommas wurden als Dezimalpunkte gelesen.',
  '{n} non-numeric line(s) after the name line were ignored.': ({ n }) =>
    one(n) ? '1 nichtnumerische Zeile nach der Namenszeile wurde ignoriert.' : `${n} nichtnumerische Zeilen nach der Namenszeile wurden ignoriert.`,
  'No coordinate lines found.': 'Keine Koordinatenzeilen gefunden.',
  'Read as a three-column table (x, upper y, lower y).': 'Als dreispaltige Tabelle gelesen (x, y Oberseite, y Unterseite).',
  'Lines with more than two values found; only the first two columns are used.': 'Zeilen mit mehr als zwei Werten gefunden; nur die ersten beiden Spalten werden verwendet.',
  'Header announces {upper}+{lower} points but {found} were found; surfaces split at the x reset.':
    'Die Kopfzeile nennt {upper}+{lower} Punkte, gefunden wurden aber {found}; Ober- und Unterseite werden am x-Rücksprung getrennt.',
  'The name line has {n} characters; the first {limit} are used.': 'Die Namenszeile hat {n} Zeichen; die ersten {limit} werden verwendet.',
  'Coordinates contain non-finite values.': 'Die Koordinaten enthalten nicht endliche Werte.',
  'No coordinate points found.': 'Keine Koordinatenpunkte gefunden.',
  '{n} or more points; the limit is {limit}.': '{n} oder mehr Punkte; die Grenze liegt bei {limit}.',
  '{n} points; the limit is {limit}.': '{n} Punkte; die Grenze liegt bei {limit}.',
  '{n} duplicate consecutive point(s) removed.': ({ n }) =>
    one(n) ? '1 doppelter aufeinanderfolgender Punkt wurde entfernt.' : `${n} doppelte aufeinanderfolgende Punkte wurden entfernt.`,
  'The outline starts and ends on the drawn trailing-edge base; the base point was removed at both ends.':
    'Die Kontur beginnt und endet auf der gezeichneten Endleistenbasis; der Basispunkt wurde an beiden Enden entfernt.',
  'The outline repeats its first point after a blunt trailing edge; the repeated point was removed.':
    'Die Kontur wiederholt ihren ersten Punkt nach einer stumpfen Endleiste; der wiederholte Punkt wurde entfernt.',
  'Coordinates look like percent of chord and were divided by 100.': 'Die Koordinaten sehen nach Prozent der Profiltiefe aus und wurden durch 100 geteilt.',
  'Points run clockwise (lower surface first); order reversed to Selig order.':
    'Die Punkte laufen im Uhrzeigersinn (Unterseite zuerst); die Reihenfolge wurde in die Selig-Reihenfolge umgedreht.',

  // Airfoil checks (sanity.js)
  '{n} consecutive point(s) closer than {distance} chord to the previous point removed.': ({ n, distance }) =>
    one(n)
      ? `1 Punkt, der dem vorherigen Punkt näher als das ${distance}-Fache der Profiltiefe lag, wurde entfernt.`
      : `${n} Punkte, die dem vorherigen Punkt näher als das ${distance}-Fache der Profiltiefe lagen, wurden entfernt.`,
  'At least {min} points are required (found {found}).': 'Mindestens {min} Punkte sind erforderlich ({found} gefunden).',
  '{n} points (warning above {limit}): the checks and the first build of a wing that uses the airfoil take {time}.':
    '{n} Punkte (Warnung über {limit}): Die Prüfungen und der erste Aufbau eines Flügels, der das Profil verwendet, dauern {time}.',
  'Only {n} points; the NURBS interpolation may not match the intended shape.': 'Nur {n} Punkte; die NURBS-Interpolation trifft die beabsichtigte Form möglicherweise nicht.',
  'All points share the same x coordinate.': 'Alle Punkte haben dieselbe x-Koordinate.',
  'x spans {from} to {to}; coordinates are scaled to unit chord.': 'x reicht von {from} bis {to}; die Koordinaten werden auf die Profiltiefe 1 skaliert.',
  "The line from the leading edge to the trailing edge is inclined by {angle} degrees; the coordinates are kept, so twist refers to the file's x axis.":
    'Die Linie von der Profilnase zur Endleiste ist um {angle} Grad geneigt; die Koordinaten bleiben erhalten, daher bezieht sich die Schränkung auf die x-Achse der Datei.',
  'The first point lies at {pos} % chord, not at the trailing edge; the point order is probably not Selig, or a surface is incomplete.':
    'Der erste Punkt liegt bei {pos} % der Profiltiefe, nicht an der Endleiste; die Punktreihenfolge ist vermutlich nicht Selig, oder eine Profilseite ist unvollständig.',
  'The last point lies at {pos} % chord, not at the trailing edge; the point order is probably not Selig, or a surface is incomplete.':
    'Der letzte Punkt liegt bei {pos} % der Profiltiefe, nicht an der Endleiste; die Punktreihenfolge ist vermutlich nicht Selig, oder eine Profilseite ist unvollständig.',
  'The outline is {length} chords long; an airfoil outline is about 2 chords long.': 'Die Kontur ist {length} Profiltiefen lang; eine Profilkontur ist etwa 2 Profiltiefen lang.',
  'The upper surface runs back in x at {n} points; the limit is {limit}.': 'Die Oberseite läuft an {n} Punkten in x zurück; die Grenze liegt bei {limit}.',
  'The lower surface runs back in x at {n} points; the limit is {limit}.': 'Die Unterseite läuft an {n} Punkten in x zurück; die Grenze liegt bei {limit}.',
  'The outline crosses itself ({n} crossing(s)).': ({ n }) => (one(n) ? 'Die Kontur überschneidet sich selbst (1 Kreuzung).' : `Die Kontur überschneidet sich selbst (${n} Kreuzungen).`),
  'Upper or lower surface has fewer than 3 points; the point order is probably not Selig or Lednicer.':
    'Ober- oder Unterseite hat weniger als 3 Punkte; die Punktreihenfolge ist vermutlich nicht Selig oder Lednicer.',
  'x does not increase monotonically from LE to TE (upper: {upper}, lower: {lower} reversal(s)).':
    'x steigt nicht monoton von der Profilnase zur Endleiste an (Umkehrungen: Oberseite {upper}, Unterseite {lower}).',
  'The upper surface lies below the lower surface at some chord position.': 'Die Oberseite liegt an einer Position entlang der Profiltiefe unter der Unterseite.',
  'Upper and lower surface touch at x = {x} % chord (thickness {thickness} % chord); the wing would have zero thickness there.':
    'Ober- und Unterseite berühren sich bei x = {x} % der Profiltiefe (Dicke {thickness} % der Profiltiefe); der Flügel hätte dort die Dicke null.',
  'Trailing edge is crossed (gap {gap} % chord).': 'Die Endleiste ist gekreuzt (Endleistendicke {gap} % der Profiltiefe).',
  'Trailing-edge gap is {gap} % chord.': 'Die Endleistendicke beträgt {gap} % der Profiltiefe.',
  'The outline reaches the trailing edge over a vertical segment; the trailing-edge base is probably read as surface points.':
    'Die Kontur erreicht die Endleiste über ein senkrechtes Segment; die Endleistenbasis wurde vermutlich als Punkte der Profilseite gelesen.',
  'Maximum thickness is {thickness} % chord.': 'Die maximale Dicke beträgt {thickness} % der Profiltiefe.',
  '{n} point(s) turn the outline by more than {angle} degrees.': ({ n, angle }) =>
    one(n) ? `An 1 Punkt knickt die Kontur um mehr als ${angle} Grad.` : `An ${n} Punkten knickt die Kontur um mehr als ${angle} Grad.`,
  'Adjacent segment lengths differ by a factor of up to {factor}.': 'Benachbarte Segmente unterscheiden sich in der Länge um einen Faktor von bis zu {factor}.',
  '{n} points, t/c {thickness} % at {thicknessX} %, camber {camber} % at {camberX} %, TE gap {gap} %.':
    '{n} Punkte, Dicke {thickness} % bei {thicknessX} %, Wölbung {camber} % bei {camberX} %, Endleistendicke {gap} %.',

  // NACA generator (naca.js)
  'Unsupported NACA designation: {code}': 'Nicht unterstützte NACA-Bezeichnung: {code}',
};
