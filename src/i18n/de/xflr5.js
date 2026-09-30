// German texts of the XFLR5 import (src/import/xflr5.js and src/ui/xflr5.js: mapping and dialog; the Open
// button and the refusal in the Airfoils upload).
export default {
  // Surfaces and file (src/import/xflr5.js)
  'Main wing': 'Tragfläche',
  'Horizontal stabilizer (XFLR5: Elevator)': 'Höhenleitwerk (XFLR5: Elevator)',
  'Second wing': 'Zweiter Flügel',
  Fin: 'Seitenleitwerk',
  'This plane has no main wing.': 'Dieses Flugzeug hat keine Tragfläche.',
  'This plane has no elevator.': 'Dieses Flugzeug hat kein Höhenleitwerk.',
  'The wing in this file is a horizontal stabilizer (type ELEVATOR).': 'Der Flügel in dieser Datei ist ein Höhenleitwerk (Typ ELEVATOR).',
  'The wing in this file is not a horizontal stabilizer (type ELEVATOR).': 'Der Flügel in dieser Datei ist kein Höhenleitwerk (Typ ELEVATOR).',
  '"{name}": {n} sections, span {span} mm, root chord {chord} mm': '„{name}“: {n} Schnitte, Spannweite {span} mm, Wurzeltiefe {chord} mm',
  '"{name}": no sections': '„{name}“: keine Schnitte',
  '"{name}": 1 section, root chord {chord} mm': '„{name}“: 1 Schnitt, Wurzeltiefe {chord} mm',
  'XFLR5 project, format {format} (XFLR5 6.10 to 6.43)': 'XFLR5-Projekt, Format {format} (XFLR5 6.10 bis 6.43)',
  'XFLR5 project, format {format} (XFLR5 6.44 or later)': 'XFLR5-Projekt, Format {format} (XFLR5 6.44 oder neuer)',
  'XFLR5 wing file (XML), lengths in {unit}': 'XFLR5-Flügeldatei (XML), Längeneinheit: {unit}',
  'XFLR5 plane file (XML), lengths in {unit}': 'XFLR5-Flugzeugdatei (XML), Längeneinheit: {unit}',
  'XFLR5 wing file (XML), lengths in units of {factor} mm': 'XFLR5-Flügeldatei (XML), Längen in Einheiten von {factor} mm',
  'XFLR5 plane file (XML), lengths in units of {factor} mm': 'XFLR5-Flugzeugdatei (XML), Längen in Einheiten von {factor} mm',
  millimetres: 'Millimeter',
  centimetres: 'Zentimeter',
  decimetres: 'Dezimeter',
  metres: 'Meter',
  inches: 'Zoll',
  feet: 'Fuß',
  'section {n}': 'Schnitt {n}',
  'sections {list}': 'Schnitte {list}',
  '(no name)': '(ohne Namen)',

  // Geometry
  'The length unit of the file is not a positive number.': 'Die Längeneinheit der Datei ist keine positive Zahl.',
  'The wing needs at least 2 sections (found {n}).': 'Der Flügel braucht mindestens 2 Schnitte (gefunden: {n}).',
  '{field} is not a finite number in the file at {sections}.': 'Für {sections} ist {field} in der Datei keine endliche Zahl.',
  'The position of the wing in the plane is not a finite number in the file.': 'Die Position des Flügels im Flugzeug ist in der Datei keine endliche Zahl.',
  'The tilt angle of the wing is not a finite number in the file.': 'Der Einstellwinkel des Flügels ist in der Datei keine endliche Zahl.',
  'The root section lies at y_position {y} mm; the half wing must start at y >= 0.': 'Der Wurzelschnitt liegt bei y_position {y} mm; der Halbflügel muss bei y >= 0 beginnen.',
  'Root y_position {y} mm lies within 0.1 mm of the centre and is set to 0, as XFLR5 joins the halves there.':
    'Die y_position {y} mm der Wurzel liegt weniger als 0,1 mm von der Mitte entfernt und wird auf 0 gesetzt, da XFLR5 die Hälften dort verbindet.',
  'y_position decreases at {sections}; the sections must run from root to tip.':
    'Für {sections} ist y_position kleiner als beim Schnitt davor; die Schnitte müssen von der Wurzel zum Rand laufen.',
  'The chord must be greater than 0 at {sections}.': 'Für {sections} muss die Profiltiefe größer als 0 sein.',
  'All sections of the wing lie at y = {y} mm: the wing has no span.': 'Alle Schnitte des Flügels liegen bei y = {y} mm: Der Flügel hat keine Spannweite.',
  'The panel from section {a} to {b} has {angle}° dihedral: its outer end must lie further out in y than its inner end.':
    'Das Feld von Schnitt {a} bis {b} hat {angle}° V-Form: Sein äußeres Ende muss in y weiter außen liegen als sein inneres Ende.',
  'The panel from section {a} to {b} has {angle}° dihedral: the vertical sections are {pct} % as thick across the panel as in XFLR5.':
    'Das Feld von Schnitt {a} bis {b} hat {angle}° V-Form: Quer zum Feld haben die senkrechten Schnitte {pct} % der Dicke in XFLR5.',
  'Further panels whose outer end does not lie further out in y: {count}.': 'Weitere Felder, deren äußeres Ende in y nicht weiter außen liegt: {count}.',
  'Further panels with more than {angle}° dihedral: {count}.': 'Weitere Felder mit mehr als {angle}° V-Form: {count}.',
  'XFLR5 measures y_position along the panels; y and z were computed from it and the dihedral.': 'XFLR5 misst y_position entlang der Felder; y und z wurden daraus und aus der V-Form berechnet.',
  'Sections {a} and {b} share y = {y} mm; section {a} was moved {d} mm inwards.': 'Die Schnitte {a} und {b} liegen beide bei y = {y} mm; Schnitt {a} wurde um {d} mm nach innen verschoben.',
  'Sections {a} and {b} share y = {y} mm; section {b} was moved {d} mm outwards.': 'Die Schnitte {a} und {b} liegen beide bei y = {y} mm; Schnitt {b} wurde um {d} mm nach außen verschoben.',
  'Further sections moved apart: {count}.': 'Weitere auseinandergeschobene Schnitte: {count}.',
  'Chords below {min} mm were raised to {min} mm, the smallest chord Wingdesigner builds, at {sections}.':
    'Für {sections} wurden Profiltiefen unter {min} mm auf {min} mm erhöht, die kleinste Profiltiefe, die Wingdesigner baut.',
  'The root lies at y = {y} mm: the two halves are built as separate bodies, as in XFLR5.': 'Die Wurzel liegt bei y = {y} mm: Die beiden Hälften werden wie in XFLR5 als getrennte Körper gebaut.',
  'Tilt angle {angle}° applied as in the XFLR5 plane: the sections are rotated about the wing origin, and every twist includes it.':
    'Einstellwinkel {angle}° wie im XFLR5-Flugzeug angewendet: Die Schnitte sind um den Ursprung des Flügels gedreht, und jede Schränkung enthält ihn.',
  'All twists were changed by {angle}°, a whole number of turns; the sections stay the same.': 'Alle Schränkungen wurden um {angle}° geändert, ganze Umdrehungen; die Schnitte bleiben gleich.',
  'Position in the XFLR5 plane applied: the wing origin moved to x {x} mm, z {z} mm.': 'Position im XFLR5-Flugzeug angewendet: Der Ursprung des Flügels wurde nach x {x} mm, z {z} mm verschoben.',
  'Position y {y} mm is not used, as in XFLR5.': 'Die Position y {y} mm wird wie in XFLR5 nicht verwendet.',
  'Left and right airfoils differ at {sections}; the right-side airfoils are used.': 'Für {sections} unterscheiden sich linkes und rechtes Profil; die Profile der rechten Seite werden verwendet.',
  'Section {n}: the position lies beyond ±{max} mm, the limit of Wingdesigner.': 'Schnitt {n}: Die Position liegt außerhalb von ±{max} mm, der Grenze von Wingdesigner.',
  'Section {n}: chord {chord} mm is larger than {max} mm, the limit of Wingdesigner.': 'Schnitt {n}: Die Profiltiefe {chord} mm ist größer als {max} mm, die Grenze von Wingdesigner.',
  'Section {n}: the chord lies beyond {max} mm, the limit of Wingdesigner.': 'Schnitt {n}: Die Profiltiefe liegt über {max} mm, der Grenze von Wingdesigner.',
  'Section {n}: twist {angle}° (tilt included) lies beyond ±{max}°, the limit of Wingdesigner.':
    'Schnitt {n}: Die Schränkung {angle}° (mit Einstellwinkel) liegt außerhalb von ±{max}°, der Grenze von Wingdesigner.',
  'Further sections beyond the limits of Wingdesigner: {count}.': 'Weitere Schnitte außerhalb der Grenzen von Wingdesigner: {count}.',

  // Airfoils
  'From the file: {name}': 'Aus der Datei: {name}',
  'Uploaded: {file}': 'Hochgeladen: {file}',
  'Current project: {name}': 'Aktuelles Projekt: {name}',
  'Library: {name}': 'Bibliothek: {name}',
  'NACA generator: {name}': 'NACA-Generator: {name}',
  'From the file': 'Aus der Datei',
  'Uploaded file': 'Hochgeladene Datei',
  'Current project': 'Aktuelles Projekt',
  'Similar name': 'Ähnlicher Name',
  Missing: 'Fehlt',
  'Airfoil "{name}" from an XFLR5 project; base shape without flap deflection.': 'Profil „{name}“ aus einem XFLR5-Projekt; Grundform ohne Klappenausschlag.',
  'Airfoil "{name}" from XFLR5 plane "{plane}"; base shape without flap deflection.': 'Profil „{name}“ aus dem XFLR5-Flugzeug „{plane}“; Grundform ohne Klappenausschlag.',
  'Airfoil "{name}" has a trailing-edge flap at 0° in XFLR5 (hinge at {hinge} % chord); control surfaces are not cut.':
    'Profil „{name}“ hat in XFLR5 eine Klappe an der Endleiste bei 0° (Drehachse bei {hinge} % der Profiltiefe); Ruder werden nicht ausgeschnitten.',
  'Airfoil "{name}" has a {angle}° trailing-edge flap in XFLR5 (hinge at {hinge} % chord); it is imported undeflected.':
    'Profil „{name}“ hat in XFLR5 eine um {angle}° ausgeschlagene Klappe an der Endleiste (Drehachse bei {hinge} % der Profiltiefe); es wird ohne Ausschlag importiert.',
  'Airfoil "{name}" has a leading-edge flap at 0° in XFLR5 (hinge at {hinge} % chord); control surfaces are not cut.':
    'Profil „{name}“ hat in XFLR5 eine Klappe an der Nasenleiste bei 0° (Drehachse bei {hinge} % der Profiltiefe); Ruder werden nicht ausgeschnitten.',
  'Airfoil "{name}" has a {angle}° leading-edge flap in XFLR5 (hinge at {hinge} % chord); it is imported undeflected.':
    'Profil „{name}“ hat in XFLR5 eine um {angle}° ausgeschlagene Klappe an der Nasenleiste (Drehachse bei {hinge} % der Profiltiefe); es wird ohne Ausschlag importiert.',
  'XFLR5 names no airfoil at {sections}: upload a .dat file or pick an airfoil.': 'XFLR5 nennt für {sections} kein Profil: eine .dat-Datei hochladen oder ein Profil wählen.',
  'Airfoil "{name}" ({sections}) from the file fails the check: {problem} Upload a .dat file or pick an airfoil.':
    'Profil „{name}“ ({sections}) aus der Datei besteht die Prüfung nicht: {problem} Eine .dat-Datei hochladen oder ein Profil wählen.',
  'Airfoil "{name}" ({sections}) is missing: upload a .dat file or pick an airfoil.': 'Profil „{name}“ ({sections}) fehlt: eine .dat-Datei hochladen oder ein Profil wählen.',
  'Airfoil "{name}" ({sections}): the matching airfoil ({source}) fails the check: {problem} Upload a .dat file or pick an airfoil.':
    'Profil „{name}“ ({sections}): Das passende Profil ({source}) besteht die Prüfung nicht: {problem} Eine .dat-Datei hochladen oder ein Profil wählen.',
  'Airfoil "{name}" ({sections}): the chosen airfoil fails the check: {problem}': 'Profil „{name}“ ({sections}): Das gewählte Profil besteht die Prüfung nicht: {problem}',
  'Airfoil "{name}" ({sections}): {problem}': 'Profil „{name}“ ({sections}): {problem}',
  'Airfoil "{name}" from the file fails the check: {problem} "{match}" is used instead.': 'Profil „{name}“ aus der Datei besteht die Prüfung nicht: {problem} Stattdessen wird „{match}“ verwendet.',
  'Airfoil "{name}" matched to "{match}" by a similar name.': 'Profil „{name}“ wurde über den ähnlichen Namen „{match}“ zugeordnet.',
  'Airfoil "{name}" ({sections}) has its leading edge at x\u00a0=\u00a0{x}\u00a0%, y\u00a0=\u00a0{y}\u00a0% and its trailing edge at x\u00a0=\u00a0{te}\u00a0% of chord in its own coordinates; this section was moved so that the airfoil lies as in XFLR5.':
    'Profil „{name}“ ({sections}) hat in seinen eigenen Koordinaten die Profilnase bei x\u00a0=\u00a0{x}\u00a0%, y\u00a0=\u00a0{y}\u00a0% und die Endleiste bei x\u00a0=\u00a0{te}\u00a0% der Profiltiefe; dieser Schnitt wurde so verschoben, dass das Profil wie in XFLR5 liegt.',
  'Airfoil "{name}" ({sections}) has its leading edge at x\u00a0=\u00a0{x}\u00a0%, y\u00a0=\u00a0{y}\u00a0% and its trailing edge at x\u00a0=\u00a0{te}\u00a0% of chord in its own coordinates; these sections were moved so that the airfoil lies as in XFLR5.':
    'Profil „{name}“ ({sections}) hat in seinen eigenen Koordinaten die Profilnase bei x\u00a0=\u00a0{x}\u00a0%, y\u00a0=\u00a0{y}\u00a0% und die Endleiste bei x\u00a0=\u00a0{te}\u00a0% der Profiltiefe; diese Schnitte wurden so verschoben, dass das Profil wie in XFLR5 liegt.',
  'Airfoil "{name}" ({sections}) has its leading edge at x\u00a0=\u00a0{x}\u00a0%, y\u00a0=\u00a0{y}\u00a0% and its trailing edge at x\u00a0=\u00a0{te}\u00a0% of chord in its own coordinates; this section was moved and scaled so that the airfoil lies as in XFLR5.':
    'Profil „{name}“ ({sections}) hat in seinen eigenen Koordinaten die Profilnase bei x\u00a0=\u00a0{x}\u00a0%, y\u00a0=\u00a0{y}\u00a0% und die Endleiste bei x\u00a0=\u00a0{te}\u00a0% der Profiltiefe; dieser Schnitt wurde so verschoben und skaliert, dass das Profil wie in XFLR5 liegt.',
  'Airfoil "{name}" ({sections}) has its leading edge at x\u00a0=\u00a0{x}\u00a0%, y\u00a0=\u00a0{y}\u00a0% and its trailing edge at x\u00a0=\u00a0{te}\u00a0% of chord in its own coordinates; these sections were moved and scaled so that the airfoil lies as in XFLR5.':
    'Profil „{name}“ ({sections}) hat in seinen eigenen Koordinaten die Profilnase bei x\u00a0=\u00a0{x}\u00a0%, y\u00a0=\u00a0{y}\u00a0% und die Endleiste bei x\u00a0=\u00a0{te}\u00a0% der Profiltiefe; diese Schnitte wurden so verschoben und skaliert, dass das Profil wie in XFLR5 liegt.',
  'Library airfoil "{name}" ({sections}) has its leading edge at x\u00a0=\u00a0{x}\u00a0%, y\u00a0=\u00a0{y}\u00a0% of chord in its own coordinates. If XFLR5 used these coordinates, it draws these sections that far from the table values; upload the .dat file that XFLR5 used to place them as in XFLR5.':
    'Das Bibliotheksprofil „{name}“ ({sections}) hat in seinen eigenen Koordinaten die Profilnase bei x\u00a0=\u00a0{x}\u00a0%, y\u00a0=\u00a0{y}\u00a0% der Profiltiefe. Hat XFLR5 diese Koordinaten verwendet, zeichnet es diese Schnitte so weit von den Tabellenwerten entfernt; die .dat-Datei hochladen, die XFLR5 verwendet hat, um sie wie in XFLR5 zu setzen.',
  'The uploaded file {file} is not usable: {problem}': 'Die hochgeladene Datei {file} ist nicht verwendbar: {problem}',
  'The coordinates are not in chord units (leading edge at x\u00a0=\u00a0{x}, y\u00a0=\u00a0{y}; trailing edge at x\u00a0=\u00a0{te}).':
    'Die Koordinaten sind nicht in Einheiten der Profiltiefe angegeben (Profilnase bei x\u00a0=\u00a0{x}, y\u00a0=\u00a0{y}; Endleiste bei x\u00a0=\u00a0{te}).',
  'The coordinates are not in chord units (leading edge at x\u00a0=\u00a0{x}, y\u00a0=\u00a0{y}; trailing edge at x\u00a0=\u00a0{te}): XFLR5 cannot have drawn them as they are, so the airfoil is scaled to unit chord and its sections keep the values of the file.':
    'Die Koordinaten sind nicht in Einheiten der Profiltiefe angegeben (Profilnase bei x\u00a0=\u00a0{x}, y\u00a0=\u00a0{y}; Endleiste bei x\u00a0=\u00a0{te}): So kann XFLR5 sie nicht gezeichnet haben; das Profil wird auf die Profiltiefe 1 skaliert, und seine Schnitte behalten die Werte der Datei.',
  'beyond ±{max}': 'jenseits von ±{max}',

  // Report and summary
  'the horizontal stabilizer "{name}"': 'das Höhenleitwerk „{name}“',
  'the main wing "{name}"': 'die Tragfläche „{name}“',
  'the second wing "{name}"': 'der zweite Flügel „{name}“',
  'the fin "{name}"': 'das Seitenleitwerk „{name}“',
  'Not imported: {list}. One surface per import; open the file again for another one.': 'Nicht importiert: {list}. Eine Fläche je Import; für eine weitere die Datei erneut öffnen.',
  'Lengths converted to mm from a file unit of {factor} mm.': 'Längen aus einer Dateieinheit von {factor} mm in mm umgerechnet.',
  'Lengths converted from {unit} to mm.': 'Längen in mm umgerechnet (Längeneinheit der Datei: {unit}).',
  'XFLR5 rounds lengths in metre XML files to 1 mm; the .xfl project file keeps full precision.':
    'XFLR5 rundet Längen in XML-Dateien in Metern auf 1 mm; die .xfl-Projektdatei behält die volle Genauigkeit.',
  'A wing file holds no position or tilt angle: the part is built in its own frame.': 'Eine Flügeldatei enthält weder Position noch Einstellwinkel: Das Teil wird in seinem eigenen Koordinatensystem gebaut.',
  'Not used: VLM panel counts and distributions, colours, masses, the body and the analyses.': 'Nicht verwendet: VLM-Panelanzahlen und -verteilungen, Farben, Massen, der Rumpf und die Analysen.',
  'The trailing edge is built as in the airfoils; Settings > Trailing edge can close it or give it a thickness.':
    'Die Endleiste wird wie in den Profilen gebaut; Einstellungen > Endleiste kann sie schließen oder ihr eine Dicke geben.',
  'The airfoils of this wing exceed the limits of a project ({airfoils} airfoils, {points} points together).':
    'Die Profile dieses Flügels überschreiten die Grenzen eines Projekts ({airfoils} Profile, {points} Punkte zusammen).',
  'The wing does not build yet: {error}': 'Der Flügel lässt sich noch nicht bauen: {error}',
  '1 airfoil': '1 Profil',
  '{n} airfoils': '{n} Profile',
  'Imported the main wing "{wing}" from {file}: {sections} sections, {airfoils}.': 'Tragfläche „{wing}“ aus {file} importiert: {sections} Schnitte, {airfoils}.',
  'Imported the horizontal stabilizer "{wing}" from {file}: {sections} sections, {airfoils}.': 'Höhenleitwerk „{wing}“ aus {file} importiert: {sections} Schnitte, {airfoils}.',
  'Imported the main wing "{wing}" of "{plane}" from {file}: {sections} sections, {airfoils}.': 'Tragfläche „{wing}“ von „{plane}“ aus {file} importiert: {sections} Schnitte, {airfoils}.',
  'Imported the horizontal stabilizer "{wing}" of "{plane}" from {file}: {sections} sections, {airfoils}.':
    'Höhenleitwerk „{wing}“ von „{plane}“ aus {file} importiert: {sections} Schnitte, {airfoils}.',

  // Dialog (src/ui/xflr5.js)
  'Import from XFLR5': 'Aus XFLR5 importieren',
  Plane: 'Flugzeug',
  'Plane {n}': 'Flugzeug {n}',
  'Surface to import': 'Zu importierende Fläche',
  'XFLR5 airfoil': 'XFLR5-Profil',
  Found: 'Gefunden',
  'Airfoil used': 'Verwendetes Profil',
  'Airfoil for "{name}"': 'Profil für „{name}“',
  'Automatic: {source}': 'Automatisch – {source}',
  'Pick an airfoil': 'Profil wählen',
  'Upload .dat': '.dat hochladen',
  'Upload .dat for "{name}"': '.dat hochladen für „{name}“',
  'View the airfoil for "{name}"': 'Profil für „{name}“ anzeigen',
  Picked: 'Gewählt',
  'Not usable': 'Nicht verwendbar',
  Report: 'Bericht',
  Import: 'Importieren',
  'Import (1 airfoil missing)': 'Importieren (1 Profil fehlt)',
  'Import ({n} airfoils missing)': 'Importieren ({n} Profile fehlen)',
  'Checking the airfoils …': 'Die Profile werden geprüft …',
  'Checking the airfoils … {n} of {total}': 'Die Profile werden geprüft … {n} von {total}',
  '{file} is used for "{name}".': '{file} wird für „{name}“ verwendet.',
  '{file} is not usable: {problem}': '{file} ist nicht verwendbar: {problem}',
  Actions: 'Aktionen',
  'Further report lines not shown: {count}.': 'Weitere, nicht angezeigte Berichtszeilen: {count}.',
  '{count} more airfoil names are not listed; uploaded .dat files are matched to them by name.':
    '{count} weitere Profilnamen sind nicht aufgeführt; hochgeladene .dat-Dateien werden ihnen über den Namen zugeordnet.',

  // Open button and Help (src/main.js), Airfoils upload (src/ui/airfoils.js)
  'Open a project (.json) or import a wing from XFLR5 (.xfl, .xml)': 'Ein Projekt öffnen (.json) oder einen Flügel aus XFLR5 importieren (.xfl, .xml)',
  'Open: a project file (.json), or an XFLR5 file (.xfl, .xml) to import its main wing or horizontal stabilizer.':
    'Öffnen: eine Projektdatei (.json) oder eine XFLR5-Datei (.xfl, .xml), um ihre Tragfläche oder ihr Höhenleitwerk zu importieren.',
  '{file} is an XFLR5 file, not an airfoil. Use Open to import a wing from it.': '{file} ist eine XFLR5-Datei, kein Profil. Mit „Öffnen“ lässt sich daraus ein Flügel importieren.',
  '(1 more warning in the import report.)': '(1 weitere Warnung im Importbericht.)',
  '({n} more warnings in the import report.)': '({n} weitere Warnungen im Importbericht.)',
  'XFLR5: {file}': 'XFLR5: {file}',
};
