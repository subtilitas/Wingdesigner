// German text for src/ui/airfoils.js, src/ui/exportui.js, src/ui/viewer3d.js: English key -> German text with the same {placeholders},
// or a function of the params. See src/i18n/index.js.
export default {
  // Severity labels and buttons of the airfoil preview dialog
  Error: 'Fehler',
  Warning: 'Warnung',
  Info: 'Info',
  Cancel: 'Abbrechen',
  Close: 'Schließen',
  'Add to project': 'Zum Projekt hinzufügen',
  'Cannot add (errors)': 'Hinzufügen nicht möglich (Fehler)',

  // Library data: categories and uses of the NACA presets, the bundled airfoils and the external sources
  Symmetric: 'Symmetrisch',
  Cambered: 'Gewölbt',
  Reflex: 'S-Schlag',
  'Thin tail surfaces': 'Dünne Leitwerke',
  'Tail surfaces': 'Leitwerke',
  'Tail surfaces, fins': 'Leitwerke, Seitenflossen',
  'Tail surfaces, flying-wing tips': 'Leitwerke, Randprofile von Nurflügeln',
  'Aerobatic wings, rudders': 'Kunstflugflügel, Seitenruder',
  'Thick aerobatic wings': 'Dicke Kunstflugflügel',
  'Thin sport wings': 'Dünne Sportflügel',
  'Sport wings, tip sections': 'Sportflügel, Randprofile',
  'Trainers and sport models': 'Trainer und Sportmodelle',
  'Slow trainers': 'Langsame Trainer',
  'Slow flyers, high lift': 'Langsamflieger, hoher Auftrieb',
  'Slow flyers, scale models': 'Langsamflieger, Scale-Modelle',
  'High-lift, low-speed models': 'Modelle mit hohem Auftrieb bei niedriger Geschwindigkeit',
  'Scale and sport models': 'Scale- und Sportmodelle',
  'Thick scale wings': 'Dicke Scale-Flügel',
  'Reflexed 5-digit section (flying-wing experiments)': 'Fünfstelliges S-Schlag-Profil (Nurflügel-Versuche)',
  'Reflexed 5-digit section': 'Fünfstelliges S-Schlag-Profil',
  'Model aircraft from free-flight gliders to radio-controlled scale models. Thickness 11.7 % of chord; lower surface flat from 30 % of chord to the trailing edge. Ordinates from the published base line: the leading edge is 3.50 % of chord above the x axis.':
    'Modellflugzeuge von Freiflug-Segelflugmodellen bis zu ferngesteuerten Scale-Modellen. Dicke 11,7 % der Profiltiefe; Unterseite flach von 30 % der Profiltiefe bis zur Endleiste. Ordinaten bezogen auf die veröffentlichte Basislinie: Die Profilnase liegt 3,50 % der Profiltiefe über der x-Achse.',
  'Section for helicopter rotor blades with a pitching moment near zero about the aerodynamic centre; reflexed mean line; used on the full-size tailless gliders Kasper Bekas and Brochocki BKB-1. Thickness 12.0 % of chord. Use on models: not documented in the sources checked.':
    'Profil für Hubschrauber-Rotorblätter mit einem Nickmoment nahe null um den Neutralpunkt des Profils; Wölbungslinie mit S-Schlag; verwendet an den manntragenden schwanzlosen Segelflugzeugen Kasper Bekas und Brochocki BKB-1. Dicke 12,0 % der Profiltiefe. Verwendung an Modellen: in den geprüften Quellen nicht belegt.',
  'Reflexed, pitch-stable section with small centre-of-pressure travel; candidate section for flying wings; used on the full-size Gee Bee Z Super Sportster (thinned to 8 % of chord on the Gee Bee R-1). Thickness 12.0 % of chord; trailing edge 0.52 % of chord thick.':
    'S-Schlag-Profil, nickstabil, mit kleiner Druckpunktwanderung; mögliches Profil für Nurflügel; verwendet an der manntragenden Gee Bee Z Super Sportster (bei der Gee Bee R-1 auf 8 % der Profiltiefe verdünnt). Dicke 12,0 % der Profiltiefe; Endleiste 0,52 % der Profiltiefe dick.',
  'Wing section of full-size aircraft such as the Comper Streak and, in modified form, the de Havilland DH-98 Mosquito; for scale models of such aircraft. Thickness 12.6 % of chord. Seven values of the source scan are uncertain by up to 0.20 % of chord (listed in NOTICE.md).':
    'Flügelprofil manntragender Flugzeuge wie der Comper Streak und, in abgewandelter Form, der de Havilland DH-98 Mosquito; für Scale-Modelle solcher Flugzeuge. Dicke 12,6 % der Profiltiefe. Sieben Werte des Quellscans sind bis zu 0,20 % der Profiltiefe unsicher (aufgeführt in NOTICE.md).',
  'Heavy-lift and high-lift section. XFOIL (airfoil analysis program) predicts a maximum lift coefficient of 2.59 at 11° angle of attack and a Reynolds number of 200,000. Thickness 12.1 % of chord, camber 14.7 % of chord; thinnest point 0.26 % of chord at 91 % of chord.':
    'Profil für hohe Zuladung und hohen Auftrieb. XFOIL (Programm zur Profilanalyse) sagt einen maximalen Auftriebsbeiwert von 2,59 bei 11° Anstellwinkel und einer Reynolds-Zahl von 200.000 voraus. Dicke 12,1 % der Profiltiefe, Wölbung 14,7 % der Profiltiefe; dünnste Stelle mit 0,26 % der Profiltiefe bei 91 % der Profiltiefe.',
  'Wing section of the full-size Piper J-3 Cub and PA-18 Super Cub; for scale models of these aircraft. Thickness 11.6 % of chord. Ordinates from the published base line: the leading edge is 2.76 % of chord above the x axis.':
    'Flügelprofil der manntragenden Piper J-3 Cub und PA-18 Super Cub; für Scale-Modelle dieser Flugzeuge. Dicke 11,6 % der Profiltiefe. Ordinaten bezogen auf die veröffentlichte Basislinie: Die Profilnase liegt 2,76 % der Profiltiefe über der x-Achse.',
  'HS airfoils and catalogs for planks, swept flying wings, gliders. Use with attribution "Hartmut Siegmann, www.aerodesign.de"; redistribution is restricted, commercial use needs written permission.':
    'HS-Profile und Kataloge für Brettnurflügel, Pfeilnurflügel und Segelflugmodelle. Nutzung mit Quellenangabe „Hartmut Siegmann, www.aerodesign.de“; die Weitergabe ist eingeschränkt, gewerbliche Nutzung braucht eine schriftliche Erlaubnis.',
  'MH airfoils (e.g. MH 45, MH 60 for flying wings, MH 32 for gliders). Terms: personal use; publications must cite the source.':
    'MH-Profile (z. B. MH 45 und MH 60 für Nurflügel, MH 32 für Segelflugmodelle). Bedingungen: private Nutzung; Veröffentlichungen müssen die Quelle nennen.',
  'About 1,600 airfoils in Selig format from many designers. The database states no license for the coordinate files; the rights of each designer apply.':
    'Etwa 1.600 Profile im Selig-Format von vielen Konstrukteuren. Die Datenbank nennt keine Lizenz für die Koordinatendateien; es gelten die Rechte des jeweiligen Konstrukteurs.',

  // Airfoil preview dialog
  'Airfoil preview': 'Profilvorschau',
  'The NURBS interpolation through the points failed ({message}).': 'Die NURBS-Interpolation durch die Punkte ist fehlgeschlagen ({message}).',
  'Airfoil name': 'Profilname',
  'Designer / source (kept in the project file)': 'Konstrukteur / Quelle (wird in der Projektdatei gespeichert)',
  Attribution: 'Urheber',
  'Show data points': 'Datenpunkte zeigen',
  'Line: NURBS interpolation. Dots: file points. Red: reported problem location.': 'Linie: NURBS-Interpolation. Punkte: Dateipunkte. Rot: gemeldete Problemstelle.',
  Name: 'Name',
  'Source / attribution': 'Quelle / Urheber',
  'Format: {format}, {n} points': 'Format: {format}, {n} Punkte',
  // The default name of pasted coordinates, and the name of the x/upper/lower table format (selig, lednicer and xml are names)
  pasted: 'Eingefügtes Profil',
  table: 'Tabelle',

  // Airfoils tab: notices
  'The project holds {n} airfoils, the limit; "Remove unused" frees places.': 'Das Projekt enthält {n} Profile und hat damit die Grenze erreicht; „Unbenutzte entfernen“ schafft Platz.',
  'With this airfoil the project airfoils hold {n} points; the limit is {limit}. "Remove unused" frees points.':
    'Mit diesem Profil enthalten die Projektprofile {n} Punkte; die Grenze liegt bei {limit}. „Unbenutzte entfernen“ gibt Punkte frei.',
  'The project already holds this airfoil as "{name}".': 'Das Projekt enthält dieses Profil bereits als „{name}“.',
  'Added airfoil "{name}".': 'Profil „{name}“ hinzugefügt.',
  '{file}: {size} MB; airfoil files are limited to {limit} characters.': '{file}: {size} MB; Profildateien sind auf {limit} Zeichen begrenzt.',
  '{file}: the browser could not read the file ({error}).': '{file}: Der Browser konnte die Datei nicht lesen ({error}).',
  'Upload: {file}': 'Hochladen: {file}',
  'Could not load {name}: {message}': '{name} konnte nicht geladen werden: {message}',
  'Enter a 4-digit (e.g. 2412) or 5-digit (e.g. 23012) designation.': 'Eine vierstellige (z. B. 2412) oder fünfstellige (z. B. 23012) Bezeichnung eingeben.',

  // Airfoils tab: lists, fields and sections
  'NACA equations': 'NACA-Gleichungen',
  '{n} points': '{n} Punkte',
  unused: 'unbenutzt',
  Preview: 'Vorschau',
  View: 'Anzeigen',
  'Download as Selig .dat': 'Als .dat-Datei im Selig-Format herunterladen',
  'In use by a section': 'Von einem Schnitt verwendet',
  'Remove from project': 'Aus dem Projekt entfernen',
  'e.g. 2412 or 23012': 'z. B. 2412 oder 23012',
  'NACA designation': 'NACA-Bezeichnung',
  'Drop .dat / .txt / .xml files here, or ': 'Dateien (.dat / .txt / .xml) hier ablegen oder ',
  'Choose files': 'Dateien wählen',
  'Or paste coordinates (Selig, Lednicer or x/upper/lower table)': 'Oder Koordinaten einfügen (Selig, Lednicer oder Tabelle x/Oberseite/Unterseite)',
  'Paste coordinates': 'Koordinaten einfügen',
  'Pasted coordinates': 'Eingefügte Koordinaten',
  'Check pasted text': 'Eingefügten Text prüfen',
  'Filter library': 'Bibliothek filtern',
  'Project airfoils': 'Projektprofile',
  'Remove unused': 'Unbenutzte entfernen',
  Upload: 'Hochladen',
  'Every file is parsed and checked (point order, normalization, crossings, trailing edge, spikes) and shown for review before it is added.':
    'Jede Datei wird eingelesen und geprüft (Punktreihenfolge, Normierung, Kreuzungen, Endleiste, Spitzen) und vor dem Hinzufügen zur Kontrolle angezeigt.',
  'NACA generator': 'NACA-Generator',
  'Closed trailing edge': 'Geschlossene Endleiste',
  Library: 'Bibliothek',
  'More airfoils (external, not bundled)': 'Weitere Profile (extern, nicht mitgeliefert)',
  'These collections allow personal use but not redistribution in this app. Download a file there and load it with Upload; the attribution is filled in for HS and MH airfoils.':
    'Diese Sammlungen erlauben die private Nutzung, aber keine Weitergabe in dieser App. Dort eine Datei herunterladen und mit „Hochladen“ laden; die Quellenangabe wird für HS- und MH-Profile eingetragen.',
  '{category} · {use} · generated': '{category} · {use} · erzeugt',

  // Export dialog
  Export: 'Exportieren',
  Download: 'Herunterladen',
  'The wing has errors; only the project JSON can be exported.': 'Der Flügel hat Fehler; nur das Projekt-JSON kann exportiert werden.',
  Format: 'Format',
  'STEP (AP214, exact NURBS solids)': 'STEP (AP214, exakte NURBS-Volumenkörper)',
  'STL (binary triangle mesh)': 'STL (binäres Dreiecksnetz)',
  '3MF (triangle mesh for 3D printing)': '3MF (Dreiecksnetz für den 3D-Druck)',
  'Project JSON (airfoils, sections, curves, settings, NURBS data)': 'Projekt-JSON (Profile, Schnitte, Kurven, Einstellungen, NURBS-Daten)',
  'Wing halves': 'Flügelhälften',
  'Both halves as separate bodies': 'Beide Hälften als getrennte Körper',
  'Full wing as one body (mesh formats, root at y = 0)': 'Ganzer Flügel als ein Körper (Netzformate, Wurzel bei y = 0)',
  'Right half only': 'Nur rechte Hälfte',
  'Mesh density (STL, 3MF)': 'Netzdichte (STL, 3MF)',
  Normal: 'Normal',
  'Fine (4x triangles)': 'Fein (4-fache Dreiecksanzahl)',
  'Units: millimetres. Axes: x chordwise towards the trailing edge, y up, z spanwise towards the left tip.':
    'Einheiten: Millimeter. Achsen: x in Profiltiefenrichtung zur Endleiste, y nach oben, z in Spannweitenrichtung zum linken Flügelende.',
  'Up axis (STEP, STL, 3MF)': 'Hochachse (STEP, STL, 3MF)',
  'Z up': 'Z nach oben',
  'Y up (Fusion 360 set to Y up, SolidWorks)': 'Y nach oben (Fusion 360 mit Y nach oben, SolidWorks)',
  'Units: millimetres. Axes: x chordwise towards the trailing edge, y spanwise, z up.': 'Einheiten: Millimeter. Achsen: x in Profiltiefenrichtung zur Endleiste, y in Spannweitenrichtung, z nach oben.',
  '{n} control points, file {size}': '{n} Kontrollpunkte, Datei {size}',
  '{n} million control points, file {size}': '{n} Millionen Kontrollpunkte, Datei {size}',
  '{n} million triangles, file {size}': '{n} Millionen Dreiecke, Datei {size}',
  '{what}: above the limit of {limit} million control points, where the file takes more memory than a desktop browser tab holds. Use one half, or fewer chord samples or panel stations.':
    '{what}: über der Grenze von {limit} Millionen Kontrollpunkten, ab der die Datei mehr Speicher braucht, als ein Browser-Tab auf dem Desktop bietet. Eine Hälfte oder weniger Stationen je Profilseite oder je Feld verwenden.',
  '{what}: above the limit of {limit} million triangles, where a desktop browser tab runs out of memory. Use Normal density, one half, or fewer chord samples or panel stations.':
    '{what}: über der Grenze von {limit} Millionen Dreiecken, ab der einem Browser-Tab auf dem Desktop der Speicher ausgeht. Netzdichte „Normal“, eine Hälfte oder weniger Stationen je Profilseite oder je Feld verwenden.',
  '{what}. The export takes {time} and {memory} of browser memory.': '{what}. Der Export dauert {time} und belegt {memory} Arbeitsspeicher.',
  'Use one half, or fewer chord samples and panel stations.': 'Eine Hälfte oder weniger Stationen je Profilseite und je Feld verwenden.',
  'Use Normal mesh density or fewer chord samples and panel stations.': 'Netzdichte „Normal“ oder weniger Stationen je Profilseite und je Feld verwenden.',
  'Export failed: {message}.': 'Export fehlgeschlagen: {message}.',

  // 3D view
  '3D wing view. Drag to rotate, pinch or scroll to zoom, two fingers or right mouse button to pan.':
    '3D-Flügelansicht. Zum Drehen ziehen, zum Zoomen zwei Finger zusammenziehen bzw. spreizen oder scrollen, zum Verschieben zwei Finger oder die rechte Maustaste verwenden.',
};
