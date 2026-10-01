// German text for src/main.js, src/ui/wizard.js, src/ui/settings.js, src/ui/dom.js, index.html: English key -> German text with the same {placeholders},
// or a function of the params. See src/i18n/index.js.
export default {
  // ---- src/main.js: storage and autosave
  'The saved project could not be loaded ({reason}); it is kept in local storage under "{key}.rejected".':
    'Das gespeicherte Projekt konnte nicht geladen werden ({reason}); es bleibt im Browserspeicher unter „{key}.rejected“ erhalten.',
  'The saved project could not be loaded ({reason}), and browser storage has no room for a copy: autosave is off, so it stays under "{key}". Use Save to keep new work.':
    'Das gespeicherte Projekt konnte nicht geladen werden ({reason}), und der Browserspeicher hat keinen Platz für eine Kopie: Die automatische Sicherung ist aus, das Projekt bleibt deshalb unter „{key}“ erhalten. Neue Änderungen mit „Speichern“ als Datei sichern.',
  'This is the project as last saved; autosave stopped at {time} because browser storage was full, and later edits were not saved.':
    'Dies ist das Projekt im zuletzt gespeicherten Stand; die automatische Sicherung hörte am {time} auf, weil der Browserspeicher voll war, und spätere Änderungen wurden nicht gespeichert.',
  'Autosave works again.': 'Die automatische Sicherung funktioniert wieder.',
  'Autosave is off: browser storage refused the project ({length} characters; browsers keep about 5,000,000 per site). Use Save to keep it.':
    'Die automatische Sicherung ist aus: Der Browserspeicher hat das Projekt abgelehnt ({length} Zeichen; Browser speichern etwa 5.000.000 je Website). Um es zu behalten, „Speichern“ verwenden.',
  'Autosave off: use Save': 'Automatische Sicherung aus: „Speichern“ verwenden',
  'Internal error: {message}': 'Interner Fehler: {message}',

  // ---- src/main.js: top bar
  'Project': 'Projekt',
  'New': 'Neu',
  'Open': 'Öffnen',
  'Save': 'Speichern',
  'Save the project as JSON': 'Projekt als JSON speichern',
  'Export': 'Exportieren',
  'Undo': 'Rückgängig',
  'Undo (Ctrl+Z)': 'Rückgängig (Strg+Z)',
  'Redo': 'Wiederholen',
  'Redo (Ctrl+Shift+Z)': 'Wiederholen (Strg+Umschalt+Z)',
  'Help': 'Hilfe',
  'Save failed: {reason}.': 'Speichern fehlgeschlagen: {reason}.',
  'Cannot open {name}: {size} MB; project files are limited to {limit} MB.':
    '{name} kann nicht geöffnet werden: {size} MB; Projektdateien sind auf {limit} MB begrenzt.',
  'Cannot open {name}: the browser could not read the file ({error}).':
    '{name} kann nicht geöffnet werden: Der Browser konnte die Datei nicht lesen ({error}).',
  'Cannot open {name}: {problems}': '{name} kann nicht geöffnet werden: {problems}',
  'Opened {name}.': '{name} geöffnet.',
  'Created "{name}".': 'Entwurf „{name}“ angelegt.',

  // ---- src/main.js: view buttons, tabs, meta description
  'Iso': 'Iso',
  'Top': 'Oben',
  'Front': 'Vorne',
  'Side': 'Links',
  'Fit': 'Einpassen',
  'Fit the wing into the view': 'Flügel in die Ansicht einpassen',
  'Enlarge': 'Vergrößern',
  'Enlarge or shrink the 3D view': '3D-Ansicht vergrößern oder verkleinern',
  'Sections': 'Schnitte',
  'Planform': 'Grundriss',
  'Airfoils': 'Profile',
  'Settings': 'Einstellungen',
  'Checks': 'Prüfungen',
  'Design RC model aircraft wings in the browser: airfoil sections, NURBS loft, guide curves, STEP, STL and 3MF export.':
    'RC-Modellflügel im Browser entwerfen: Profilschnitte, NURBS-Fläche, Leitkurven, Export als STEP, STL und 3MF.',

  // ---- src/main.js: Checks tab and status bar
  'Error': 'Fehler',
  'Warning': 'Warnung',
  'Geometry checks': 'Geometrieprüfungen',
  'No errors or warnings.': 'Keine Fehler oder Warnungen.',
  'Span': 'Spannweite',
  'Wing area': 'Flügelfläche',
  'Aspect ratio': 'Streckung',
  'Mean aerodynamic chord (MAC)': 'Mittlere aerodynamische Flügeltiefe (MAC)',
  'MAC position': 'Lage der MAC',
  'y {y} mm, leading edge x {x} mm': 'y {y} mm, Profilnase x {x} mm',
  '25 % MAC (geometric reference)': '25 % MAC (geometrischer Bezugspunkt)',
  'Root / tip chord': 'Wurzel- / Randtiefe',
  'Surface': 'NURBS-Fläche',
  'degree {degreeU} x {degreeV}, {rows} x {columns} control points': 'Grad {degreeU} x {degreeV}, {rows} x {columns} Kontrollpunkte',
  'Trailing edge': 'Endleiste',
  'closed': 'geschlossen',
  'open': 'offen',
  'The 25 % MAC point is a geometric reference only; it is not an aerodynamic neutral-point or centre-of-gravity calculation.':
    'Der 25-%-MAC-Punkt ist nur ein geometrischer Bezugspunkt; er ist keine Berechnung des aerodynamischen Neutralpunkts oder des Schwerpunkts.',
  'Span {span} mm · area {area} dm² · AR {ar} · MAC {mac} mm': 'Spannweite {span} mm · Fläche {area} dm² · AR {ar} · MAC {mac} mm',
  '{n} error(s): {first}': '{n} Fehler: {first}',
  '{n} warning(s)': ({ n }) => `${n} ${n === '1' ? 'Warnung' : 'Warnungen'}`,

  // ---- src/main.js: Help dialog
  'Version {version}. Designs one half of a wing from airfoil sections and mirrors it at y = 0.':
    'Version {version}. Entwirft eine Flügelhälfte aus Profilschnitten und spiegelt sie an der Ebene y = 0.',
  'Workflow': 'Arbeitsablauf',
  'New: pick a design type in the wizard, or edit the sample wing.': 'Neu: Entwurfstyp im Assistenten wählen oder den Beispielflügel bearbeiten.',
  'Airfoils: add NACA sections, library entries, or upload .dat files (checked and previewed before use).':
    'Profile: NACA-Profile und Bibliothekseinträge hinzufügen oder .dat-Dateien hochladen (vor der Verwendung geprüft und in der Vorschau angezeigt).',
  'Sections: set span position y, leading edge x and z, chord and twist for each section.':
    'Schnitte: je Schnitt Spannweitenposition y, Profilnase x und z, Profiltiefe und Schränkung einstellen.',
  'Planform: switch on the nose line and end line to shape the leading and trailing edge between sections.':
    'Grundriss: Nasenlinie und Endlinie einschalten, um Nasen- und Endleiste zwischen den Schnitten zu formen.',
  'Export: STEP (exact NURBS solids), STL or 3MF (meshes), and the project JSON.':
    'Exportieren: STEP (exakte NURBS-Volumenkörper), STL oder 3MF (Dreiecksnetze) und das Projekt-JSON.',
  'Controls': 'Bedienung',
  '3D view: drag to rotate, pinch or scroll to zoom, two fingers or right mouse button to pan.':
    '3D-Ansicht: zum Drehen ziehen, zum Zoomen zwei Finger zusammenziehen bzw. spreizen oder scrollen, zum Verschieben zwei Finger oder die rechte Maustaste verwenden.',
  'Planform and previews: drag points to edit, drag the background to pan, pinch or scroll to zoom, double-click to fit.':
    'Grundriss und Vorschauen: Punkte zum Bearbeiten ziehen, den Hintergrund zum Verschieben ziehen, zum Zoomen zwei Finger zusammenziehen bzw. spreizen oder scrollen, per Doppelklick einpassen.',
  'Undo and redo: Ctrl+Z and Ctrl+Shift+Z.': 'Rückgängig und Wiederholen: Strg+Z und Strg+Umschalt+Z.',
  'Coordinates and units': 'Koordinaten und Einheiten',
  'Millimetres. x runs chordwise towards the trailing edge, y spanwise towards the right tip, z up. Twist is positive with the leading edge up.':
    'Millimeter. x verläuft in Profiltiefenrichtung zur Endleiste, y in Spannweitenrichtung zum rechten Flügelende, z nach oben. Die Schränkung ist positiv bei angehobener Profilnase.',
  'Airfoil data': 'Profildaten',
  'NACA sections are computed from their published equations. Uploaded airfoils keep their name and attribution in the project file; respect the terms of the source you downloaded them from.':
    'NACA-Profile werden aus ihren veröffentlichten Gleichungen berechnet. Hochgeladene Profile behalten Name und Quellenangabe in der Projektdatei; die Bedingungen der Quelle, von der sie heruntergeladen wurden, sind zu beachten.',
  'Documentation (wiki)': 'Dokumentation (Wiki)',
  'Source code (MIT license)': 'Quellcode (MIT-Lizenz)',
  'Licenses of this app and its libraries': 'Lizenzen dieser App und ihrer Bibliotheken',
  'Close': 'Schließen',

  // ---- src/ui/settings.js
  'Loft grid: {points} points.': 'Flächengitter: {points} Punkte.',
  'Loft grid: {points} points, {K} spanwise stations per panel instead of {Kset}.':
    ({ points, K, Kset }) => `Flächengitter: ${points} Punkte, ${K} ${K === '1' ? 'Station' : 'Stationen'} je Feld in Spannweitenrichtung statt ${Kset}.`,
  'Loft grid: {points} points; above {limit}, {cost}.': 'Flächengitter: {points} Punkte; über {limit}: {cost}.',
  'Loft grid: {points} points, {K} spanwise stations per panel instead of {Kset}; above {limit}, {cost}.':
    ({ points, K, Kset, limit, cost }) => `Flächengitter: ${points} Punkte, ${K} ${K === '1' ? 'Station' : 'Stationen'} je Feld in Spannweitenrichtung statt ${Kset}; über ${limit}: ${cost}.`,
  'Geometry': 'Geometrie',
  'Project name': 'Projektname',
  'Spanwise interpolation': 'Interpolation in Spannweitenrichtung',
  'Linear between sections': 'Linear zwischen den Schnitten',
  'Straight panels (straight lines between sections, as XFLR5)': 'Gerade Felder (gerade Linien zwischen den Schnitten, wie XFLR5)',
  'Section planes': 'Schnittebenen',
  'Mitred (square to the panels, as XFLR5)': 'Auf Gehrung (senkrecht zu den Feldern, wie XFLR5)',
  'Vertical (y = const)': 'Senkrecht (y = konstant)',
  'Smooth (natural cubic spline through sections)': 'Glatt (natürlicher kubischer Spline durch die Schnitte)',
  'Twist pivot (fraction of chord)': 'Drehpunkt der Schränkung (Anteil der Profiltiefe)',
  'Part tilt (°, positive = leading edge up)': 'Einstellwinkel des Teils (°, positiv = Nasenleiste hoch)',
  'Part roll (°, positive = right tip up)': 'Rollwinkel des Teils (°, positiv = rechter Randbogen hoch)',
  'The part turns as a rigid body about x = {x} mm, y = {y} mm, z = {z} mm, the wing origin of the import: first the roll about the x axis, then the tilt about the y axis.':
    'Das Teil dreht sich als starrer Körper um x = {x} mm, y = {y} mm, z = {z} mm, den Ursprung des Flügels beim Import: erst der Rollwinkel um die x-Achse, dann der Einstellwinkel um die y-Achse.',
  'The part turns as a rigid body about the leading edge of the root section (x = {x} mm, y = {y} mm, z = {z} mm): first the roll about the x axis, then the tilt about the y axis.':
    'Das Teil dreht sich als starrer Körper um die Nasenleiste des Wurzelschnitts (x = {x} mm, y = {y} mm, z = {z} mm): erst der Rollwinkel um die x-Achse, dann der Einstellwinkel um die y-Achse.',
  'Trailing edge mode': 'Endleistenmodus',
  'As in the airfoil files': 'Wie in den Profildateien',
  'Closed (sharp)': 'Geschlossen (scharf)',
  'Fixed thickness in mm': 'Feste Dicke in mm',
  'Wing tip': 'Flügelende',
  'Flat (cut at the tip section)': 'Flach (am Randschnitt abgeschnitten)',
  'Pointed (tip profile scaled down)': 'Spitz (Randprofil verkleinert)',
  'Tip profile scale 1 : N of the previous section chord (N = {min} to {max}; tip chord at least {chord} mm)':
    'Maßstab des Randprofils 1 : N der Tiefe des vorherigen Schnitts (N = {min} bis {max}; Randtiefe mindestens {chord} mm)',
  'Tip profile scale denominator': 'Nenner des Maßstabs des Randprofils',
  'Trailing-edge thickness (mm)': 'Endleistendicke (mm)',
  'Resolution': 'Auflösung',
  'Chordwise stations per surface ({min}-{max})': 'Stationen je Profilseite ({min} bis {max})',
  'Spanwise stations per panel with guides, smooth mode or mitred linear panels ({min}-{max})': 'Stationen je Feld mit Leitkurve, glatter Interpolation oder linearen Feldern auf Gehrung ({min} bis {max})',
  'Profile parametrization': 'Parametrisierung der Profile',
  'Centripetal (recommended)': 'Zentripetal (empfohlen)',
  'Chord length': 'Sehnenlänge',
  'Uniform': 'Gleichabständig',
  'Display': 'Anzeige',
  'Show mirrored half (y < 0)': 'Gespiegelte Hälfte zeigen (y < 0)',
  'Show NURBS control net': 'NURBS-Kontrollnetz zeigen',
  'Show section outlines': 'Schnittkonturen zeigen',

  // ---- src/ui/wizard.js
  'Span (both halves)': 'Spannweite (beide Hälften)',
  'Root chord': 'Wurzeltiefe',
  'Taper (tip / root chord)': 'Zuspitzung (Randtiefe / Wurzeltiefe)',
  'Sweep of the 25 % line': 'Pfeilung der 25-%-Linie',
  'Dihedral per half': 'V-Form je Hälfte',
  'Tip twist (negative = washout)': 'Schränkung am Rand (negativ = Nase ab)',
  'Number of sections': 'Anzahl der Schnitte',
  'Design type': 'Entwurfstyp',
  'Planform preview': 'Grundrissvorschau',
  'Create design': 'Entwurf anlegen',
  'Straight taper': 'Gerade zugespitzt',
  'Elliptic (guide curves)': 'Elliptisch (mit Leitkurven)',
  'NACA code, e.g. 2412': 'NACA-Bezeichnung, z. B. 2412',
  'Flat': 'Flach',
  'Pointed (1/200 scale)': 'Spitz (Maßstab 1/200)',
  'Tip': 'Flügelende',
  'Root airfoil (NACA)': 'Wurzelprofil (NACA)',
  'Tip airfoil (NACA)': 'Randprofil (NACA)',
  'Area {area} dm², aspect ratio {ar}, mean aerodynamic chord {mac} mm at y = {y} mm, tip chord {tip} mm.':
    'Fläche {area} dm², Streckung {ar}, mittlere aerodynamische Flügeltiefe {mac} mm bei y = {y} mm, Randtiefe {tip} mm.',
  'Start a new wing design': 'Neuen Flügelentwurf beginnen',
  'New wing design': 'Neuer Flügelentwurf',
  'Pick a type, adjust the numbers, create. Everything stays editable afterwards; the wizard only sets up the sections and guide curves.':
    'Typ wählen, Zahlen anpassen, anlegen. Alles bleibt danach bearbeitbar; der Assistent richtet nur die Schnitte und Leitkurven ein.',
  'Skip (open sample wing)': 'Überspringen (Beispielflügel öffnen)',
  'Cancel': 'Abbrechen',
};
