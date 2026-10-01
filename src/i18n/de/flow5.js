// German texts of the flow5 import: src/import/fl5.js (.fl5 project reader), src/import/fl5xml.js
// (XML reader) and the flow5 texts of the mapping (src/import/xflr5.js) and of the Airfoils tab.
export default {
  // fl5.js
  'The file is a flow5 project of format {format}, written by flow5 7.26 or older: open it in a current flow5 and save it, or export the plane as XML.':
    'Die Datei ist ein flow5-Projekt im Format {format}, geschrieben von flow5 7.26 oder älter: in einem aktuellen flow5 öffnen und speichern oder das Flugzeug als XML exportieren.',
  'The file is a flow5 project of format {format}, newer than this import reads (up to {max}, flow5 7.54 to 7.57): export the plane as XML in flow5.':
    'Die Datei ist ein flow5-Projekt im Format {format}, neuer als dieser Import liest (bis {max}, flow5 7.54 bis 7.57): das Flugzeug in flow5 als XML exportieren.',
  'The file is {size} MB; flow5 projects above {limit} MB are not read.': 'Die Datei hat {size} MB; flow5-Projekte über {limit} MB werden nicht gelesen.',
  'The project holds no plane.': 'Das Projekt enthält kein Flugzeug.',
  'Plane {n} of the file is of a kind this import does not read (kind {kind}).': 'Flugzeug {n} der Datei ist von einer Art, die dieser Import nicht liest (Art {kind}).',
  // fl5xml.js
  'Plane "{plane}" has more than {max} wings; the first {max} are read.': 'Flugzeug „{plane}“ hat mehr als {max} Flügel; die ersten {max} werden gelesen.',
  'The length unit of the XML file is not valid: {element} is "{value}".': 'Die Längeneinheit der XML-Datei ist ungültig: {element} ist „{value}“.',
  'The file is not a flow5 plane or wing file: it does not start with an XML element.': 'Die Datei ist keine flow5-Flugzeug- oder -Flügeldatei: Sie beginnt nicht mit einem XML-Element.',
  'The file is a flow5 XML file without a plane or wing (root element "{root}").': 'Die Datei ist eine flow5-XML-Datei ohne Flugzeug oder Flügel (Wurzelelement „{root}“).',
  'The file is not a flow5 plane or wing file (root element "{root}", version "{version}").': 'Die Datei ist keine flow5-Flugzeug- oder -Flügeldatei (Wurzelelement „{root}“, Version „{version}“).',
  'The length unit (<Units>) comes after a plane or wing; as in flow5, it applies only to the planes and wings that follow it.':
    'Die Längeneinheit (<Units>) steht nach einem Flugzeug oder Flügel; wie in flow5 gilt sie nur für die folgenden Flugzeuge und Flügel.',
  'The file holds {count} wings outside a plane; flow5 reads only the last one, "{name}", and so does this import.':
    'Die Datei enthält {count} Flügel außerhalb eines Flugzeugs; flow5 liest nur den letzten, „{name}“, und dieser Import ebenso.',
  // xflr5.js: surfaces of a flow5 plane
  'Main wing {n}': 'Tragfläche {n}',
  'Horizontal stabilizer {n} (flow5: Elevator)': 'Höhenleitwerk {n} (flow5: Elevator)',
  'Horizontal stabilizer (flow5: Elevator)': 'Höhenleitwerk (flow5: Elevator)',
  'Fin {n}': 'Seitenleitwerk {n}',
  'Other wing {n}': 'Weiterer Flügel {n}',
  'Other wing': 'Weiterer Flügel',
  'A one-sided wing turned {angle}° about z (Ry_angle): a part turns about x and y only.': 'Ein einseitiger Flügel, um {angle}° um z gedreht (Ry_angle): Ein Teil dreht sich nur um x und y.',
  "A one-sided wing: flow5 builds its left half only, with the left-side airfoils. The part's left half is that half, its right half the mirror image (on top of it for a fin at y = 0); Settings > Show mirrored half and Export > Wing halves > Right half only give one half.":
    'Ein einseitiger Flügel: flow5 baut nur seine linke Hälfte, mit den Profilen der linken Seite. Die linke Hälfte des Teils ist diese Hälfte, seine rechte Hälfte das Spiegelbild (bei einem Seitenleitwerk bei y = 0 deckungsgleich); Einstellungen > Gespiegelte Hälfte zeigen und Exportieren > Flügelhälften > Nur rechte Hälfte ergeben eine Hälfte.',
  'flow5 project, format {format} (flow5 7.50 to 7.53)': 'flow5-Projekt, Format {format} (flow5 7.50 bis 7.53)',
  'flow5 project, format {format} (flow5 7.54 or later)': 'flow5-Projekt, Format {format} (flow5 7.54 oder neuer)',
  'flow5 wing file (XML), lengths in {unit}': 'flow5-Flügeldatei (XML), Längeneinheit: {unit}',
  'flow5 plane file (XML), lengths in {unit}': 'flow5-Flugzeugdatei (XML), Längeneinheit: {unit}',
  'flow5 wing file (XML), lengths in units of {factor} mm': 'flow5-Flügeldatei (XML), Längen in Einheiten von {factor} mm',
  'flow5 plane file (XML), lengths in units of {factor} mm': 'flow5-Flugzeugdatei (XML), Längen in Einheiten von {factor} mm',
  // xflr5.js: geometry and report
  'The roll angle (Rx_angle) of the wing is not a finite number in the file.': 'Der Rollwinkel (Rx_angle) des Flügels ist in der Datei keine endliche Zahl.',
  'Roll angle {angle}° (Rx_angle) applied as in the flow5 plane: the part turns as a rigid body about the wing origin, before the tilt (Settings > Part roll).':
    'Rollwinkel {angle}° (Rx_angle) wie im flow5-Flugzeug angewendet: Das Teil dreht sich als starrer Körper um den Ursprung des Flügels, vor dem Einstellwinkel (Einstellungen > Rollwinkel des Teils).',
  'flow5 rolls the whole wing as one body, so its left half rolls the other way: Settings > Left half is set to Turned with the right half.':
    'flow5 rollt den ganzen Flügel als einen Körper, seine linke Hälfte rollt also in die andere Richtung: Einstellungen > Linke Hälfte ist auf Mit der rechten Hälfte gedreht gestellt.',
  'Airfoil "{name}" from a flow5 project; the stored shape.': 'Profil „{name}“ aus einem flow5-Projekt; die gespeicherte Form.',
  'Airfoil "{name}" from flow5 plane "{plane}"; the stored shape.': 'Profil „{name}“ aus dem flow5-Flugzeug „{plane}“; die gespeicherte Form.',
  'Airfoil "{name}" has a trailing-edge flap in flow5 (hinge at {hinge} % chord); flow5 deflects it in its analyses only, and the stored shape is imported.':
    'Profil „{name}“ hat in flow5 eine Klappe an der Endleiste (Drehachse bei {hinge} % der Profiltiefe); flow5 schlägt sie nur in seinen Analysen aus, importiert wird die gespeicherte Form.',
  'Airfoil "{name}" has a leading-edge flap in flow5 (hinge at {hinge} % chord); flow5 deflects it in its analyses only, and the stored shape is imported.':
    'Profil „{name}“ hat in flow5 eine Klappe an der Nasenleiste (Drehachse bei {hinge} % der Profiltiefe); flow5 schlägt sie nur in seinen Analysen aus, importiert wird die gespeicherte Form.',
  '{label} "{name}"': '{label} „{name}“',
  'flow5 rounds lengths in metre XML files to 1 mm; the .fl5 project file keeps full precision.':
    'flow5 rundet Längen in XML-Dateien in Metern auf 1 mm; die .fl5-Projektdatei behält die volle Genauigkeit.',
  'A wing file holds no position or angles: the part is built in its own frame.': 'Eine Flügeldatei enthält weder Position noch Winkel: Das Teil wird in seinem eigenen Koordinatensystem gebaut.',
  'Imported the wing "{wing}" from {file}: {sections} sections, {airfoils}.': 'Flügel „{wing}“ aus {file} importiert: {sections} Schnitte, {airfoils}.',
  'Imported the wing "{wing}" of "{plane}" from {file}: {sections} sections, {airfoils}.': 'Flügel „{wing}“ von „{plane}“ aus {file} importiert: {sections} Schnitte, {airfoils}.',
  // src/ui/airfoils.js
  'flow5: {file}': 'flow5: {file}',
  // src/ui/xflr5.js
  '{files} files uploaded; {rows} airfoil names use them.': '{files} Dateien hochgeladen; {rows} Profilnamen verwenden sie.',
  'Upload .dat files…': '.dat-Dateien hochladen …',
  'Each airfoil name takes the file whose airfoil or file name matches it.': 'Jeder Profilname erhält die Datei, deren Profil- oder Dateiname zu ihm passt.',
};
