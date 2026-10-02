// German text for src/geom/, src/export/: English key -> German text with the same {placeholders},
// or a function of the params. See src/i18n/index.js.
export default {
  'The tilted or rolled part reaches x = {x} mm, y = {y} mm, z = {z} mm, beyond ±{limit} mm; reduce the part tilt or roll, or move the part towards its pivot.':
    'Das gedrehte Teil reicht bis x = {x} mm, y = {y} mm, z = {z} mm, außerhalb von ±{limit} mm; Einstellwinkel oder Rollwinkel des Teils verkleinern oder das Teil näher an seinen Drehpunkt legen.',
  // Guide curve checks (guide.js)
  'A guide curve needs at least 2 points.': 'Eine Leitkurve braucht mindestens 2 Punkte.',
  'Guide points must be finite [x, y] pairs.': 'Leitkurvenpunkte müssen endliche [x, y]-Paare sein.',
  'Guide points must have strictly increasing span position y.': 'Leitkurvenpunkte müssen eine streng aufsteigende Spannweitenposition y haben.',
  'Points {a} and {b} at y = {y1} mm and y = {y2} mm lie too close together for the curve parameters; move them apart.':
    'Die Punkte {a} und {b} bei y = {y1} mm und y = {y2} mm liegen für die Kurvenparameter zu dicht beieinander; die Punkte auseinanderschieben.',

  // Airfoil curve problems (profile.js); the airfoil preview capitalizes the first letter, German starts capitalized
  'the NURBS curve through the points crosses itself near x = {x} % chord; the file has too few points there. Use a file with more points or finer spacing near that position.':
    'Die NURBS-Kurve durch die Punkte überschneidet sich selbst nahe x = {x} % der Profiltiefe; die Datei hat dort zu wenige Punkte. Eine Datei mit mehr Punkten oder engerem Punktabstand an dieser Stelle verwenden.',
  'the surface runs back in x by {size} % chord near x = {x} % chord; every surface point needs its own chord position, since the loft resamples by chord position.':
    'Die Profilseite läuft in x um {size} % der Profiltiefe zurück, nahe x = {x} % der Profiltiefe; jeder Punkt der Profilseite braucht eine eigene Position entlang der Profiltiefe, da die Fläche die Profile nach dieser Position neu abtastet.',

  // Build errors and warnings (wing.js)
  'At least 2 sections are required.': 'Mindestens 2 Schnitte sind erforderlich.',
  'Section at y = {y} mm lies on the mirrored side; the half wing spans y >= 0.':
    'Der Schnitt bei y = {y} mm liegt auf der gespiegelten Seite; der Halbflügel erstreckt sich über y >= 0.',
  'Sections {a} and {b} share span position y = {y} mm.': 'Die Schnitte {a} und {b} haben dieselbe Spannweitenposition y = {y} mm.',
  'Sections {a} and {b} at y = {y1} mm and y = {y2} mm lie too close together for the surface parameters (span fractions {f1} and {f2}); move them apart.':
    'Die Schnitte {a} und {b} bei y = {y1} mm und y = {y2} mm liegen für die Flächenparameter zu dicht beieinander (Spannweitenanteile {f1} und {f2}); die Schnitte auseinanderschieben.',
  'Section at y = {y} mm uses unknown airfoil "{id}".': 'Der Schnitt bei y = {y} mm verwendet das unbekannte Profil „{id}“.',
  'Settings > Profile parametrization "centripetal" follows the points more closely.':
    'Die Einstellung „Zentripetal“ unter Einstellungen > Parametrisierung der Profile folgt den Punkten genauer.',
  'Airfoil "{name}": {problem}': 'Profil „{name}“: {problem}',
  'the NURBS interpolation failed ({message}).': 'Die NURBS-Interpolation ist fehlgeschlagen ({message}).',
  'the NURBS curve through the points crosses itself near x = {x} % chord; the loop is {size} mm wide at {chord} mm chord, above {limit} mm. Use a file with more points or finer spacing near that position.':
    'Die NURBS-Kurve durch die Punkte überschneidet sich selbst nahe x = {x} % der Profiltiefe; die Schleife ist bei {chord} mm Profiltiefe {size} mm breit, über {limit} mm. Eine Datei mit mehr Punkten oder engerem Punktabstand an dieser Stelle verwenden.',
  'Nose line: {problem}': 'Nasenlinie: {problem}',
  'End line: {problem}': 'Endlinie: {problem}',
  'the curve fit is singular; move the points further apart in y or use control-point mode.':
    'Die Kurvenanpassung ist singulär; die Punkte in y weiter auseinanderschieben oder den Modus „Kontrollpunkte“ verwenden.',
  'the curve doubles back in span direction; move the points apart or use control-point mode.':
    'Die Kurve läuft in Spannweitenrichtung zurück; die Punkte auseinanderschieben oder den Modus „Kontrollpunkte“ verwenden.',
  'the curve through the points reaches x = {x} mm, beyond ±{limit} mm; space the points more evenly in y or use control-point mode.':
    'Die Kurve durch die Punkte erreicht x = {x} mm, jenseits von ±{limit} mm; die Punkte in y gleichmäßiger verteilen oder den Modus „Kontrollpunkte“ verwenden.',
  'The loft grid needs {points} points with one station per panel ({sections} sections, {samples} chord samples); the limit is {limit}. Reduce the chord samples or the sections.':
    'Das Flächengitter braucht {points} Punkte bei einer Station je Feld ({sections} Schnitte, {samples} Stationen je Profilseite); die Grenze liegt bei {limit}. Die Stationen je Profilseite verringern oder Schnitte entfernen.',
  'Spanwise stations per panel reduced from {from} to {to}: {sections} sections with {samples} chord samples keep the loft within {limit} grid points.':
    'Stationen je Feld von {from} auf {to} verringert: {sections} Schnitte mit {samples} Stationen je Profilseite halten die Fläche bei höchstens {limit} Gitterpunkten.',
  'Pointed tip: nose line and end line end {gap} mm apart, so the tip chord is {chord} mm instead of {scaled} mm; move their last points together to close the tip.':
    'Spitzes Flügelende: Nasenlinie und Endlinie enden {gap} mm voneinander entfernt, daher beträgt die Randtiefe {chord} mm statt {scaled} mm; ihre letzten Punkte zusammenschieben, um das Flügelende zu schließen.',
  chord: 'Profiltiefe',
  twist: 'Schränkung',
  'Section values give non-finite coordinates at y = {y} mm; check the positions, chords and twists of the sections.':
    'Die Schnittwerte ergeben bei y = {y} mm nicht endliche Koordinaten; Positionen, Profiltiefen und Schränkungen der Schnitte prüfen.',
  'At y = {y} mm the wing leaves the project limits (leading-edge x {x} mm, z {z} mm, chord {chord} mm; limits ±{extent} mm and {maxChord} mm chord).':
    'Bei y = {y} mm verlässt der Flügel die Projektgrenzen (x der Profilnase {x} mm, z {z} mm, Profiltiefe {chord} mm; Grenzen ±{extent} mm und {maxChord} mm Profiltiefe).',
  'Check the guide curves.': 'Die Leitkurven prüfen.',
  'Sections {a} and {b}: at y = {y} mm the mitred section plane lies {angle}° from the smooth reference line, which stretches the airfoil {stretch} times (limit {limit}, 60°). Reduce the dihedral change there, add sections or set Settings > Section planes to Vertical.':
    'Schnitte {a} und {b}: Bei y = {y} mm liegt die Gehrungsebene {angle}° schräg zur glatten Bezugslinie, das streckt das Profil auf das {stretch}-Fache (Grenze {limit}, 60°). Die Änderung der V-Form dort verringern, Schnitte hinzufügen oder Einstellungen > Schnittebenen auf „Senkrecht“ setzen.',
  'Section {n}: its mitred plane lies {angle}° from the panel next to it, which stretches the airfoil {stretch} times (limit {limit}, 60°). Reduce the dihedral change there or set Settings > Section planes to Vertical.':
    'Schnitt {n}: Seine Gehrungsebene liegt {angle}° schräg zum benachbarten Feld, das streckt das Profil auf das {stretch}-Fache (Grenze {limit}, 60°). Die Änderung der V-Form dort verringern oder Einstellungen > Schnittebenen auf „Senkrecht“ setzen.',
  'Sections {a} and {b}: at y = {y} mm the mitred section planes between them turn faster than the airfoils allow, so the surface folds. Lengthen the panel, reduce the dihedral change or set Settings > Section planes to Vertical.':
    'Schnitte {a} und {b}: Bei y = {y} mm drehen sich die Gehrungsebenen zwischen ihnen schneller, als die Profile es zulassen, daher faltet sich die Fläche. Das Feld verlängern, die Änderung der V-Form verringern oder Einstellungen > Schnittebenen auf „Senkrecht“ setzen.',
  'Sections {a} and {b}: their mitred planes meet {distance} mm from the position (y, z) of section {a}, within the airfoils, so the surface between them folds. Lengthen the panel, reduce the dihedral change or set Settings > Section planes to Vertical.':
    'Schnitte {a} und {b}: Ihre Gehrungsebenen schneiden sich {distance} mm von der Position (y, z) von Schnitt {a} entfernt, innerhalb der Profile, daher faltet sich die Fläche zwischen ihnen. Das Feld verlängern, die Änderung der V-Form verringern oder Einstellungen > Schnittebenen auf „Senkrecht“ setzen.',
  'The surface folds between the stations at y = {y1} mm and y = {y2} mm (panel from section {a} to {b}): their section planes cross within the airfoils. Lengthen the panel, reduce the dihedral change or set Settings > Section planes to Vertical.':
    'Die Fläche faltet sich zwischen den Stationen bei y = {y1} mm und y = {y2} mm (Feld von Schnitt {a} bis {b}): Ihre Schnittebenen kreuzen sich innerhalb der Profile. Das Feld verlängern, die Änderung der V-Form verringern oder Einstellungen > Schnittebenen auf „Senkrecht“ setzen.',
  "The tilt angle of {angle}° of the XFLR5 import is folded into the section values, which is exact for vertical section planes only: with mitred planes the part lies up to about {distance} mm off XFLR5's (0.75 · chord · sin(tilt angle) · sin(roll)). Settings > Section planes Vertical keeps the import exact.":
    'Der Einstellwinkel von {angle}° des XFLR5-Imports ist in die Schnittwerte eingerechnet, was nur für senkrechte Schnittebenen genau ist: Mit Schnittebenen auf Gehrung liegt das Teil bis zu etwa {distance} mm neben dem von XFLR5 (0,75 · Profiltiefe · sin(Einstellwinkel) · sin(Neigung)). Einstellungen > Schnittebenen „Senkrecht“ hält den Import genau.',
  "A tilt angle of the XFLR5 import of format version 1 may be folded into the section values; the angle is not stored. The fold is exact for vertical section planes only: with mitred planes the part lies up to 0.75 · chord · sin(tilt angle) · sin(roll) off XFLR5's. Settings > Section planes Vertical keeps the import exact; importing the XFLR5 file again gives the rigid tilt.":
    'Ein Einstellwinkel des XFLR5-Imports im Format Version 1 kann in die Schnittwerte eingerechnet sein; der Winkel ist nicht gespeichert. Die Einrechnung ist nur für senkrechte Schnittebenen genau: Mit Schnittebenen auf Gehrung liegt das Teil bis zu 0,75 · Profiltiefe · sin(Einstellwinkel) · sin(Neigung) neben dem von XFLR5. Einstellungen > Schnittebenen „Senkrecht“ hält den Import genau; ein erneuter Import der XFLR5-Datei ergibt den starren Einstellwinkel.',
  'Straight panels do not follow guide curves: switch the guide curves off in the Planform tab, or set Settings > Spanwise interpolation to Linear or Smooth.':
    'Gerade Felder folgen keinen Leitkurven: die Leitkurven in der Registerkarte Grundriss ausschalten oder Einstellungen > Interpolation in Spannweitenrichtung auf „Linear“ oder „Glatt“ setzen.',
  'The resampled profile has negative thickness at y = {y} mm, x = {x} % chord ({thickness} % chord): upper and lower surface of a section airfoil cross there.':
    'Das neu abgetastete Profil hat bei y = {y} mm, x = {x} % der Profiltiefe eine negative Dicke ({thickness} % der Profiltiefe): Ober- und Unterseite eines Schnittprofils kreuzen sich dort.',
  'Check the airfoils near that position or raise Settings > Chord samples.':
    'Die Profile nahe dieser Stelle prüfen oder Einstellungen > Stationen je Profilseite erhöhen.',
  'The trailing-edge setting pulls the upper surface below the lower surface at y = {y} mm ({thickness} % chord); the airfoil is thinner inside than its trailing-edge gap.':
    'Die Endleisteneinstellung zieht die Oberseite bei y = {y} mm unter die Unterseite ({thickness} % der Profiltiefe); das Profil ist innen dünner als seine Endleistendicke.',
  'Use "as in file" or a larger trailing-edge thickness.': 'Die Einstellung „Wie in den Profildateien“ oder eine größere Endleistendicke verwenden.',
  'Upper and lower surface of the blended profile touch at y = {y} mm, x = {x} % chord (thickness {thickness} % chord); the wing would have zero thickness there.':
    'Ober- und Unterseite des interpolierten Profils berühren sich bei y = {y} mm, x = {x} % der Profiltiefe (Dicke {thickness} % der Profiltiefe); der Flügel hätte dort die Dicke null.',
  'The trailing-edge setting makes upper and lower surface touch at y = {y} mm, x = {x} % chord (thickness {thickness} % chord); the wing would have zero thickness there.':
    'Die Endleisteneinstellung lässt Ober- und Unterseite sich bei y = {y} mm, x = {x} % der Profiltiefe berühren (Dicke {thickness} % der Profiltiefe); der Flügel hätte dort die Dicke null.',
  'For a tip that ends in a point, set Settings > Wing tip to Pointed.': 'Für ein Flügelende, das in einer Spitze endet, Einstellungen > Flügelende auf „Spitz“ setzen.',
  'Chord drops to {chord} mm at y = {y} mm; nose line and end line must not touch or cross.':
    'Die Profiltiefe sinkt bei y = {y} mm auf {chord} mm; Nasenlinie und Endlinie dürfen sich nicht berühren oder kreuzen.',
  'The surface fit is singular: sections {a} and {b} at y = {y1} mm and y = {y2} mm lie too close together; move them apart.':
    'Die Flächenanpassung ist singulär: Die Schnitte {a} und {b} bei y = {y1} mm und y = {y2} mm liegen zu dicht beieinander; die Schnitte auseinanderschieben.',
  'The fitted surface has non-finite coordinates; check the positions, chords and twists of the sections.':
    'Die angepasste Fläche hat nicht endliche Koordinaten; Positionen, Profiltiefen und Schränkungen der Schnitte prüfen.',
  'The fitted surface turns inside out between stations at y = {y} mm (local thickness {thickness} % chord): the surface through the stations swings between them (guide curves that change fast).':
    'Die angepasste Fläche stülpt sich zwischen den Stationen bei y = {y} mm um (örtliche Dicke {thickness} % der Profiltiefe): Die Fläche durch die Stationen schwingt zwischen ihnen aus (schnell veränderliche Leitkurven).',
  'The fitted surface has zero thickness between stations at y = {y} mm (local thickness {thickness} % chord): the surface through the stations swings between them (guide curves that change fast).':
    'Die angepasste Fläche hat zwischen den Stationen bei y = {y} mm die Dicke null (örtliche Dicke {thickness} % der Profiltiefe): Die Fläche durch die Stationen schwingt zwischen ihnen aus (schnell veränderliche Leitkurven).',
  'Smooth the guide curves or add sections.': 'Die Leitkurven glätten oder Schnitte hinzufügen.',
  'The fitted surface folds or narrows between stations at y = {y} mm (chord {chord} mm along the intended chord direction, minimum {min} mm): twist or guide curves change faster than {stations} added stations resolve.':
    'Die angepasste Fläche faltet sich oder schnürt sich zwischen den Stationen bei y = {y} mm ein (Profiltiefe {chord} mm in der vorgesehenen Profiltiefenrichtung, Minimum {min} mm): Schränkung oder Leitkurven ändern sich schneller, als {stations} hinzugefügte Stationen auflösen.',
  'Add sections, reduce the twist difference or smooth the guide curves.': 'Schnitte hinzufügen, den Schränkungsunterschied verringern oder die Leitkurven glätten.',
  'The loft surface crosses itself at y = {y} mm near x = {x} mm: the surface rows overshoot between the resampled points.':
    'Die Fläche überschneidet sich selbst bei y = {y} mm nahe x = {x} mm: Die Flächenzeilen schwingen zwischen den neu abgetasteten Punkten über.',
  'Increase Settings > Chord samples.': 'Einstellungen > Stationen je Profilseite erhöhen.',
  // "1 station" takes the singular: the params are the printed texts
  'Trailing-edge thickness {thickness} mm exceeds {percent} % of the chord at {stations} station(s); it is limited to {percent} % there.': ({ thickness, percent, stations }) =>
    `Die Endleistendicke ${thickness} mm übersteigt ${percent} % der Profiltiefe an ${stations} ${stations === '1' ? 'Station' : 'Stationen'}; dort wird sie auf ${percent} % begrenzt.`,
  'The trailing edge is closed on some stations and open on others; {stations} station(s) were opened to {gap} mm.': ({ stations, gap }) =>
    `Die Endleiste ist an manchen Stationen geschlossen und an anderen offen; ${stations} ${stations === '1' ? 'Station wurde' : 'Stationen wurden'} auf ${gap} mm geöffnet.`,
  'The loft deviates up to {dev} mm from the intended surface at y = {y} mm after {stations} added station(s); raise the spanwise stations per panel.': ({ dev, y, stations }) =>
    `Die Fläche weicht ${stations === '0' ? 'ohne hinzugefügte Stationen' : `nach ${stations} hinzugefügten ${stations === '1' ? 'Station' : 'Stationen'}`} bei y = ${y} mm um bis zu ${dev} mm von der vorgesehenen Fläche ab; die Stationen je Feld erhöhen.`,

  // Export errors (precision.js, step.js)
  'Sections or stations near y = {y} mm lie closer together than the spacing there ({spacing} mm); move them apart, or export STEP.':
    'Schnitte oder Stationen nahe y = {y} mm liegen dichter beieinander als der Rasterabstand dort ({spacing} mm); sie auseinanderschieben oder als STEP exportieren.',
  'Move the wing towards the origin, or export STEP.': 'Den Flügel zum Ursprung hin verschieben oder als STEP exportieren.',
  // "1 of 256 triangles" takes the singular verb: the params are the printed texts
  'STL stores 32-bit coordinates: at {far} mm their spacing is {spacing} mm, and {bad} of {total} triangles collapse or turn over. {remedy}': ({ far, spacing, bad, total, remedy }) =>
    `STL speichert 32-Bit-Koordinaten: Bei ${far} mm beträgt ihr Rasterabstand ${spacing} mm, und ${bad} von ${total} Dreiecken ${bad === '1' ? 'fällt zusammen oder kehrt sich um' : 'fallen zusammen oder kehren sich um'}. ${remedy}`,
  '3MF readers store 32-bit coordinates: at {far} mm their spacing is {spacing} mm, and {bad} of {total} triangles collapse or turn over. {remedy}': ({ far, spacing, bad, total, remedy }) =>
    `3MF-Leseprogramme speichern 32-Bit-Koordinaten: Bei ${far} mm beträgt ihr Rasterabstand ${spacing} mm, und ${bad} von ${total} Dreiecken ${bad === '1' ? 'fällt zusammen oder kehrt sich um' : 'fallen zusammen oder kehren sich um'}. ${remedy}`,
  'Non-finite value in STEP export: {value}': 'Nicht endlicher Wert im STEP-Export: {value}',
  'The wing has no surface; fix the reported errors first.': 'Der Flügel hat keine Fläche; zuerst die gemeldeten Fehler beheben.',
};
