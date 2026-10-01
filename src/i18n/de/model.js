// German text for src/model/: English key -> German text with the same {placeholders},
// or a function of the params. See src/i18n/index.js.
export default {
  // Default project names
  'Untitled wing': 'Unbenannter Flügel',
  'Imported wing': 'Importierter Flügel',
  'Sport wing 1500': 'Sportflügel 1500',
  '{span} mm wing': 'Flügel {span} mm',

  // Time and memory of a change (budget.js)
  'under 1 s': 'unter 1 s',
  'about {n} s': 'etwa {n} s',
  'about {n} MB': 'etwa {n} MB',
  'about {n} GB': 'etwa {n} GB',
  // The phrase follows a colon in the German texts that use it: it starts a clause.
  'each change takes {time} and {memory} of browser memory': 'Jede Änderung dauert {time} und belegt {memory} Arbeitsspeicher',
  'Each change takes {time} and {memory} of browser memory.': 'Jede Änderung dauert {time} und belegt {memory} Arbeitsspeicher.',

  // Size warning (budget.js)
  'Large project: {list}.': 'Großes Projekt: {list}.',
  '{list} and {last}': '{list} und {last}',
  '{n} sections (warning above {limit})': '{n} Schnitte (Warnung über {limit})',
  '{n} airfoils (warning above {limit})': '{n} Profile (Warnung über {limit})',
  'an airfoil of {n} points (warning above {limit})': 'ein Profil mit {n} Punkten (Warnung über {limit})',
  '{n} airfoil points in all (warning above {limit})': '{n} Profilpunkte insgesamt (Warnung über {limit})',
  'a guide curve of {n} points (warning above {limit})': 'eine Leitkurve mit {n} Punkten (Warnung über {limit})',
  '{n} loft grid points (warning above {limit})': '{n} Punkte im Flächengitter (Warnung über {limit})',
  'a name of {n} characters (warning above {limit})': 'ein Name mit {n} Zeichen (Warnung über {limit})',
  'Opening it or changing the profile parametrization takes {time}.': 'Das Öffnen des Projekts oder eine Änderung der Parametrisierung der Profile dauert {time}.',

  // Project file (io.js)
  'The file is larger than {max} MB.': 'Die Datei ist größer als {max} MB.',
  // The engine's message is English; only the position in it is kept.
  'Invalid JSON: {message}': ({ message }) => {
    const m = /line (\d+) column (\d+)/.exec(String(message));
    return m ? `Ungültiges JSON in Zeile ${m[1]}, Spalte ${m[2]}.` : 'Ungültiges JSON.';
  },
  'the project takes {size} MB as a file, above the {max} MB that Open reads': 'Das Projekt belegt als Datei {size} MB, mehr als die {max} MB, die „Öffnen“ liest',
  'The file leaves out the derived NURBS data: with it, the file would exceed {max} MB, the largest project file Open reads. Open recomputes it; STEP export writes the exact surfaces.':
    'Die Datei lässt die abgeleiteten NURBS-Daten weg: Mit ihnen wäre sie größer als die {max} MB, die „Öffnen“ höchstens liest. „Öffnen“ berechnet sie neu; der STEP-Export schreibt die exakten Flächen.',

  // Validation of a project: limits (project.js, limitErrors)
  'At most {max} sections are supported (found {found}).': 'Höchstens {max} Schnitte werden unterstützt ({found} gefunden).',
  'Section {n}: chord must be at most {max} mm.': 'Schnitt {n}: Profiltiefe darf höchstens {max} mm betragen.',
  'Section {n}: {axis} must be within ±{max} mm.': 'Schnitt {n}: {axis} muss innerhalb von ±{max} mm liegen.',
  'Section {n}: twist must be within ±{max} degrees.': 'Schnitt {n}: Schränkung muss innerhalb von ±{max} Grad liegen.',
  'Section {n}: panelAngle must be within ±{max} degrees.': 'Schnitt {n}: panelAngle muss innerhalb von ±{max} Grad liegen.',
  'Section {n}: panelAngle must be a finite number or null.': 'Schnitt {n}: panelAngle muss eine endliche Zahl oder null sein.',
  'guides.{key}.points: at most {max} points (found {found}).': 'guides.{key}.points: höchstens {max} Punkte ({found} gefunden).',
  'guides.{key}.points: x must be within ±{maxX} mm and y within ±{maxY} mm.': 'guides.{key}.points: x muss innerhalb von ±{maxX} mm und y innerhalb von ±{maxY} mm liegen.',

  // Validation of a project: structure (project.js, validateProject)
  'Project is not an object.': 'Das Projekt ist kein Objekt.',
  'format must be "{format}".': 'format muss "{format}" sein.',
  'units must be "mm" (found "{found}").': 'units muss "mm" sein (gefunden: "{found}").',
  'settings must be an object.': 'settings muss ein Objekt sein.',
  'guides must be an object.': 'guides muss ein Objekt sein.',
  'Unsupported project version {version}.': 'Nicht unterstützte Projektversion {version}.',
  'airfoils must be a non-empty array.': 'airfoils muss eine nichtleere Liste sein.',
  'At most {max} airfoils are supported (found {found}).': 'Höchstens {max} Profile werden unterstützt ({found} gefunden).',
  'At least 2 sections are required.': 'Mindestens 2 Schnitte sind erforderlich.',
  'Every airfoil must be an object.': 'Jedes Profil muss ein Objekt sein.',
  'The airfoils hold {n} points together; the limit is {max}.': 'Die Profile enthalten zusammen {n} Punkte; die Grenze liegt bei {max}.',
  'Every section must be an object.': 'Jeder Schnitt muss ein Objekt sein.',
  'name has {n} characters; the limit is {max}.': 'name hat {n} Zeichen; die Grenze liegt bei {max}.',
  'Airfoil {n}: id must be a non-empty string.': 'Profil {n}: id muss eine nichtleere Zeichenkette sein.',
  'Airfoil {n}: id has {length} characters; the limit is {max}.': 'Profil {n}: id hat {length} Zeichen; die Grenze liegt bei {max}.',
  'Duplicate airfoil id "{id}".': 'Doppelte Profil-ID „{id}“.',
  'Airfoil {n}: name must be a string.': 'Profil {n}: name muss eine Zeichenkette sein.',
  'Airfoil {n}: name has {length} characters; the limit is {max}.': 'Profil {n}: name hat {length} Zeichen; die Grenze liegt bei {max}.',
  'Airfoil {n}: source must be an object.': 'Profil {n}: source muss ein Objekt sein.',
  'Airfoil {n}: source.{key} must be a string.': 'Profil {n}: source.{key} muss eine Zeichenkette sein.',
  'Airfoil {n}: source.{key} has {length} characters; the limit is {max}.': 'Profil {n}: source.{key} hat {length} Zeichen; die Grenze liegt bei {max}.',
  'Airfoil {n} needs at least 5 numeric [x, y] points.': 'Profil {n} braucht mindestens 5 numerische [x, y]-Punkte.',
  'Airfoil {n} has {length} points; the limit is {max}.': 'Profil {n} hat {length} Punkte; die Grenze liegt bei {max}.',
  // The names of two section fields inside a message; x, y and z stay.
  chord: 'Profiltiefe',
  twist: 'Schränkung',
  'Section {n}: {field} must be a finite number.': 'Schnitt {n}: {field} muss eine endliche Zahl sein.',
  'Section {n}: chord must be at least {min} mm.': 'Schnitt {n}: Profiltiefe muss mindestens {min} mm betragen.',
  'Section {n}: y must be >= 0 (the half wing lies on the +y side).': 'Schnitt {n}: y muss >= 0 sein (der Halbflügel liegt auf der +y-Seite).',
  'Section {n}: unknown airfoil "{id}".': 'Schnitt {n}: unbekanntes Profil „{id}“.',
  'Section {n}: id must be a non-empty string.': 'Schnitt {n}: id muss eine nichtleere Zeichenkette sein.',
  'Section {n}: id has {length} characters; the limit is {max}.': 'Schnitt {n}: id hat {length} Zeichen; die Grenze liegt bei {max}.',
  'Duplicate section id "{id}".': 'Doppelte Schnitt-ID „{id}“.',
  'Section span positions y must be distinct.': 'Die Spannweitenpositionen y der Schnitte müssen verschieden sein.',
  'settings.{key} must be an object.': 'settings.{key} muss ein Objekt sein.',
  'settings.spanwise must be "linear", "straight" or "smooth".': 'settings.spanwise muss "linear", "straight" oder "smooth" sein.',
  'settings.sectionPlanes must be "vertical" or "mitred".': 'settings.sectionPlanes muss "vertical" oder "mitred" sein.',
  'foldedTilt must be an object with the numbers angle, x and z.': 'foldedTilt muss ein Objekt mit den Zahlen angle, x und z sein.',
  'settings.{key} must be a number within ±{max} degrees.': 'settings.{key} muss eine Zahl innerhalb von ±{max} Grad sein.',
  'settings.partPivot must be null or an object with the numbers x, y and z within ±{max} mm.': 'settings.partPivot muss null oder ein Objekt mit den Zahlen x, y und z innerhalb von ±{max} mm sein.',
  'The tilt angle of {angle}° of the XFLR5 import stays folded into the sections: a guide curve is on or edited, and guide curves hold x only.':
    'Der Einstellwinkel von {angle}° des XFLR5-Imports bleibt in die Schnitte eingerechnet: Eine Leitkurve ist eingeschaltet oder bearbeitet, und Leitkurven halten nur x.',
  'The tilt angle of {angle}° of the XFLR5 import stays folded into the sections: without it a twist would lie beyond ±{max}°.':
    'Der Einstellwinkel von {angle}° des XFLR5-Imports bleibt in die Schnitte eingerechnet: Ohne ihn läge eine Schränkung außerhalb von ±{max}°.',
  'The tilt angle of {angle}° that the XFLR5 import folded into the sections is a rigid tilt of the whole part (Settings > Part tilt); the sections hold the values of the untilted part.':
    'Der Einstellwinkel von {angle}°, den der XFLR5-Import in die Schnitte eingerechnet hatte, ist ein starrer Einstellwinkel des ganzen Teils (Einstellungen > Einstellwinkel des Teils); die Schnitte halten die Werte des ungedrehten Teils.',
  'With mitred section planes the shape changes: the folded tilt was exact for vertical planes only, the rigid tilt places the part as XFLR5 does.':
    'Mit Schnittebenen auf Gehrung ändert sich die Form: Der eingerechnete Einstellwinkel war nur für senkrechte Ebenen genau, der starre Einstellwinkel setzt das Teil wie XFLR5.',
  'foldedTilt.angle must be within ±180 degrees.': 'foldedTilt.angle muss innerhalb von ±180 Grad liegen.',
  'foldedTilt.{axis} must be within ±{max} mm.': 'foldedTilt.{axis} muss innerhalb von ±{max} mm liegen.',
  'settings.trailingEdge.mode must be "asis", "closed" or "thickness".': 'settings.trailingEdge.mode muss "asis", "closed" oder "thickness" sein.',
  'settings.trailingEdge.thickness must be >= 0.': 'settings.trailingEdge.thickness muss >= 0 sein.',
  'settings.tip.mode must be "flat" or "pointed".': 'settings.tip.mode muss "flat" oder "pointed" sein.',
  'settings.tip.ratio must be within {range} (1/1000 to 1/100).': 'settings.tip.ratio muss innerhalb von {range} liegen (1/1000 bis 1/100).',
  'settings.twistPivot must be within 0..1.': 'settings.twistPivot muss innerhalb von 0..1 liegen.',
  'settings.chordSamples must be an integer within {range}.': 'settings.chordSamples muss eine ganze Zahl innerhalb von {range} sein.',
  'settings.panelStations must be an integer within {range}.': 'settings.panelStations muss eine ganze Zahl innerhalb von {range} sein.',
  'settings.parametrization must be uniform, chord or centripetal.': 'settings.parametrization muss uniform, chord oder centripetal sein.',
  'settings.mirror must be true or false.': 'settings.mirror muss true oder false sein.',
  'guides.{key} must be an object.': 'guides.{key} muss ein Objekt sein.',
  'guides.{key}.enabled must be true or false.': 'guides.{key}.enabled muss true oder false sein.',
  'guides.{key}.edited must be true or false.': 'guides.{key}.edited muss true oder false sein.',
  'guides.{key}.mode must be "fit" or "control".': 'guides.{key}.mode muss "fit" oder "control" sein.',
  'guides.{key}.points needs at least 2 points.': 'guides.{key}.points braucht mindestens 2 Punkte.',
  'guides.{key}.points must be numeric [x, y] pairs.': 'guides.{key}.points muss aus numerischen [x, y]-Paaren bestehen.',
  'guides.{key}.degree must be 1..5.': 'guides.{key}.degree muss 1..5 sein.',

  // Section edits (edit.js)
  'At most {max} sections.': 'Höchstens {max} Schnitte.',
  'No span position lies between y = {a} mm and y = {b} mm. Move the two sections apart first.':
    'Zwischen y = {a} mm und y = {b} mm liegt keine Spannweitenposition. Zuerst die beiden Schnitte auseinanderschieben.',
  'A section beyond the tip would lie beyond y = {max} mm.': 'Ein Schnitt weiter außen als der Randschnitt läge jenseits von y = {max} mm.',
  'A section at y = {y} mm beyond the tip makes the span too long for the sections at y = {a} mm and y = {b} mm. Move the two sections apart first.':
    'Ein Schnitt bei y = {y} mm weiter außen als der Randschnitt macht die Spannweite zu lang für die Schnitte bei y = {a} mm und y = {b} mm. Zuerst die beiden Schnitte auseinanderschieben.',

  // Wizard: design types (wizard.js)
  Trainer: 'Trainer',
  Sport: 'Sportmodell',
  Glider: 'Segelflugmodell',
  'Swept flying wing': 'Pfeilnurflügel',
  Plank: 'Brettnurflügel',
  'Tail surface': 'Leitwerk',
  'Rectangular high-lift wing with dihedral for stable, slow flight.': 'Rechteckflügel mit hohem Auftrieb und V-Form für stabilen, langsamen Flug.',
  'Tapered wing with little dihedral and slight washout.': 'Zugespitzter Flügel mit wenig V-Form und leichter Schränkung.',
  'High aspect ratio with elliptic planform, dihedral and washout.': 'Große Streckung mit elliptischem Grundriss, V-Form und Schränkung.',
  'Swept tailless wing with reflexed root section and washout for pitch stability.': 'Gepfeilter Nurflügel mit S-Schlag-Wurzelprofil und Schränkung für Nickstabilität.',
  'Unswept tailless wing with reflexed sections.': 'Ungepfeilter Nurflügel mit S-Schlag-Profilen.',
  'Symmetric horizontal stabilizer.': 'Symmetrisches Höhenleitwerk.',

  // Wizard: problems with the parameters (wizard.js); the parameter names as they stand in the messages
  span: 'Spannweite',
  rootChord: 'Wurzeltiefe',
  taper: 'Zuspitzung',
  sweep: 'Pfeilung',
  dihedral: 'V-Form',
  washout: 'Schränkung am Rand',
  sections: 'Anzahl der Schnitte',
  rootAirfoil: 'Wurzelprofil',
  tipAirfoil: 'Randprofil',
  '{param} must be between {min} and {max}.': '{param} muss zwischen {min} und {max} liegen.',
  'sections must be an integer.': 'Anzahl der Schnitte muss eine ganze Zahl sein.',
  'planform must be "straight" or "elliptic".': 'Grundriss muss "straight" oder "elliptic" sein.',
  'tip must be "flat" or "pointed".': 'Flügelende muss "flat" oder "pointed" sein.',
  'An elliptic planform needs taper < 1.': 'Ein elliptischer Grundriss braucht eine Zuspitzung < 1.',
  '{param} must be a NACA 4- or 5-digit designation.': '{param} muss eine NACA-Bezeichnung mit 4 oder 5 Ziffern sein.',
};
