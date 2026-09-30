// German text for src/geom/, src/export/: English key -> German text with the same {placeholders},
// or a function of the params. See src/i18n/index.js.
export default {
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
  'leading-edge x': 'x der Profilnase',
  chord: 'Profiltiefe',
  twist: 'Schränkung',
  'upper surface height at x = {x} % chord': 'Höhe der Oberseite bei x = {x} % der Profiltiefe',
  'lower surface height at x = {x} % chord': 'Höhe der Unterseite bei x = {x} % der Profiltiefe',
  '% chord': '% der Profiltiefe',
  'Section values give non-finite coordinates at y = {y} mm; check the positions, chords and twists of the sections.':
    'Die Schnittwerte ergeben bei y = {y} mm nicht endliche Koordinaten; Positionen, Profiltiefen und Schränkungen der Schnitte prüfen.',
  'At y = {y} mm the wing leaves the project limits (leading-edge x {x} mm, z {z} mm, chord {chord} mm; limits ±{extent} mm and {maxChord} mm chord).':
    'Bei y = {y} mm verlässt der Flügel die Projektgrenzen (x der Profilnase {x} mm, z {z} mm, Profiltiefe {chord} mm; Grenzen ±{extent} mm und {maxChord} mm Profiltiefe).',
  'Check the guide curves, or use linear interpolation.': 'Die Leitkurven prüfen oder lineare Interpolation verwenden.',
  'Straight panels do not follow guide curves: switch the guide curves off in the Planform tab, or set Settings > Spanwise interpolation to Linear or Smooth.':
    'Gerade Felder folgen keinen Leitkurven: die Leitkurven in der Registerkarte Grundriss ausschalten oder Einstellungen > Interpolation in Spannweitenrichtung auf „Linear“ oder „Glatt“ setzen.',
  'Smooth spanwise interpolation overshoots at y = {y} mm: {name} is {value} {unit}, while the sections range from {lo} to {hi} {unit}.':
    'Die glatte Interpolation in Spannweitenrichtung schwingt bei y = {y} mm über: {name} {value} {unit}, während die Schnitte nur von {lo} bis {hi} {unit} reichen.',
  'The sections are unevenly spaced (smallest gap {gap} mm).': 'Die Schnitte sind ungleichmäßig verteilt (kleinster Abstand {gap} mm).',
  'Use linear interpolation, space the sections more evenly or remove sections that lie close together.':
    'Lineare Interpolation verwenden, die Schnitte gleichmäßiger verteilen oder dicht beieinanderliegende Schnitte entfernen.',
  'The blended profile has negative thickness at y = {y} mm, x = {x} % chord ({thickness} % chord); smooth spanwise interpolation overshoots between unevenly spaced sections.':
    'Das interpolierte Profil hat bei y = {y} mm, x = {x} % der Profiltiefe eine negative Dicke ({thickness} % der Profiltiefe); die glatte Interpolation in Spannweitenrichtung schwingt zwischen ungleichmäßig verteilten Schnitten über.',
  'Use linear interpolation or add sections.': 'Lineare Interpolation verwenden oder Schnitte hinzufügen.',
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
  'Chord drops to {chord} mm at y = {y} mm; the smooth blend of the section chords falls below the minimum of {min} mm; use linear interpolation or add sections.':
    'Die Profiltiefe sinkt bei y = {y} mm auf {chord} mm; die glatte Interpolation der Profiltiefen der Schnitte fällt unter das Minimum von {min} mm; lineare Interpolation verwenden oder Schnitte hinzufügen.',
  'The surface fit is singular: sections {a} and {b} at y = {y1} mm and y = {y2} mm lie too close together; move them apart.':
    'Die Flächenanpassung ist singulär: Die Schnitte {a} und {b} bei y = {y1} mm und y = {y2} mm liegen zu dicht beieinander; die Schnitte auseinanderschieben.',
  'The fitted surface has non-finite coordinates; check the positions, chords and twists of the sections.':
    'Die angepasste Fläche hat nicht endliche Koordinaten; Positionen, Profiltiefen und Schränkungen der Schnitte prüfen.',
  'The fitted surface turns inside out between stations at y = {y} mm (local thickness {thickness} % chord): the surface through the stations swings between them (guide curves that change fast, or unevenly spaced sections in smooth mode).':
    'Die angepasste Fläche stülpt sich zwischen den Stationen bei y = {y} mm um (örtliche Dicke {thickness} % der Profiltiefe): Die Fläche durch die Stationen schwingt zwischen ihnen aus (schnell veränderliche Leitkurven oder ungleichmäßig verteilte Schnitte bei glatter Interpolation).',
  'The fitted surface has zero thickness between stations at y = {y} mm (local thickness {thickness} % chord): the surface through the stations swings between them (guide curves that change fast, or unevenly spaced sections in smooth mode).':
    'Die angepasste Fläche hat zwischen den Stationen bei y = {y} mm die Dicke null (örtliche Dicke {thickness} % der Profiltiefe): Die Fläche durch die Stationen schwingt zwischen ihnen aus (schnell veränderliche Leitkurven oder ungleichmäßig verteilte Schnitte bei glatter Interpolation).',
  'Smooth the guide curves, space the sections more evenly or add sections.': 'Die Leitkurven glätten, die Schnitte gleichmäßiger verteilen oder Schnitte hinzufügen.',
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
