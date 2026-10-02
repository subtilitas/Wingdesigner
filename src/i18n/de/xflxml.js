// German texts of the XFLR5 import (src/import/xflxml.js: XML plane reader).
// "The file is larger than {max} MB." is shared with Open (model.js).
export default {
  // File-level errors (the file cannot be imported)
  'The file is not an XFLR5 plane or wing file: it does not start with an XML element.':
    'Die Datei ist keine XFLR5-Flugzeug- oder -Flügeldatei: Sie beginnt nicht mit einem XML-Element.',
  'The file is not an XFLR5 plane or wing file (root element "{root}", version "{version}").':
    'Die Datei ist keine XFLR5-Flugzeug- oder -Flügeldatei (Wurzelelement „{root}“, Version „{version}“).',
  'The file is a flow5 XML file (root element "{root}"); only XFLR5 files can be imported.':
    'Die Datei ist eine flow5-XML-Datei (Wurzelelement „{root}“); nur XFLR5-Dateien können importiert werden.',
  'The XML file holds no plane and no wing.': 'Die XML-Datei enthält weder ein Flugzeug noch einen Flügel.',
  'The XML wing "{name}" is a fin; a fin imports only from a plane file, where its kind and position are known.':
    'Der XML-Flügel „{name}“ ist ein Seitenleitwerk; ein Seitenleitwerk wird nur aus einer Flugzeugdatei importiert, in der seine Art und Position bekannt sind.',
  'The length unit of the XML file is not valid: length_unit_to_meter is "{value}".':
    'Die Längeneinheit der XML-Datei ist ungültig: length_unit_to_meter ist „{value}“.',
  'The XML file is cut off: the element <{name}> is not closed.': 'Die XML-Datei ist abgeschnitten: Das Element <{name}> ist nicht geschlossen.',
  'The XML file is damaged at line {line}: a tag is malformed.': 'Die XML-Datei ist in Zeile {line} beschädigt: Ein Tag ist fehlerhaft.',
  'The XML file is damaged at line {line}: content follows the end of the root element.':
    'Die XML-Datei ist in Zeile {line} beschädigt: Nach dem Ende des Wurzelelements folgt weiterer Inhalt.',
  'The XML file is damaged at line {line}: a comment, CDATA section or declaration is not closed.':
    'Die XML-Datei ist in Zeile {line} beschädigt: Ein Kommentar, ein CDATA-Abschnitt oder eine Deklaration ist nicht geschlossen.',
  'The XML file is damaged at line {line}: </{name}> closes no open element.': 'Die XML-Datei ist in Zeile {line} beschädigt: </{name}> schließt kein offenes Element.',
  'The XML file is damaged at line {line}: </{name}> does not close <{open}>.': 'Die XML-Datei ist in Zeile {line} beschädigt: </{name}> schließt nicht <{open}>.',
  'The XML file holds more than {max} elements.': 'Die XML-Datei enthält mehr als {max} Elemente.',
  'The XML file nests elements deeper than {max} levels.': 'Die XML-Datei schachtelt Elemente tiefer als {max} Ebenen.',
  'The XML file holds more than {max} planes.': 'Die XML-Datei enthält mehr als {max} Flugzeuge.',
  'A wing of the XML file has more than {max} sections.': 'Ein Flügel der XML-Datei hat mehr als {max} Schnitte.',

  // Reader warnings
  'The length unit (<Units>) comes after a plane or wing; as in XFLR5, it applies only to the planes and wings that follow it.':
    'Die Längeneinheit (<Units>) steht nach einem Flugzeug oder Flügel; wie in XFLR5 gilt sie nur für die folgenden Flugzeuge und Flügel.',
  'Plane "{plane}" has more than one main wing: "{name}" replaces "{previous}", as in XFLR5.':
    'Das Flugzeug „{plane}“ hat mehr als eine Tragfläche: „{name}“ ersetzt wie in XFLR5 „{previous}“.',
  'Plane "{plane}" has more than one second wing: "{name}" replaces "{previous}", as in XFLR5.':
    'Das Flugzeug „{plane}“ hat mehr als einen zweiten Flügel: „{name}“ ersetzt wie in XFLR5 „{previous}“.',
  'Plane "{plane}" has more than one horizontal stabilizer: "{name}" replaces "{previous}", as in XFLR5.':
    'Das Flugzeug „{plane}“ hat mehr als ein Höhenleitwerk: „{name}“ ersetzt wie in XFLR5 „{previous}“.',
  'Plane "{plane}" has more than one fin: "{name}" replaces "{previous}", as in XFLR5.':
    'Das Flugzeug „{plane}“ hat mehr als ein Seitenleitwerk: „{name}“ ersetzt wie in XFLR5 „{previous}“.',
  'Plane "{plane}" has more than 4 wings; XFLR5 reads the first 4, and so does this import.':
    'Das Flugzeug „{plane}“ hat mehr als 4 Flügel; XFLR5 liest die ersten 4, dieser Import ebenso.',
  'The file holds a wing outside its planes; it is not imported.': 'Die Datei enthält einen Flügel außerhalb ihrer Flugzeuge; er wird nicht importiert.',
  'The file holds {count} wings outside its planes; they are not imported.': 'Die Datei enthält {count} Flügel außerhalb ihrer Flugzeuge; sie werden nicht importiert.',
  'The file holds {count} wings outside a plane; XFLR5 reads only the last one, "{name}", and so does this import.':
    'Die Datei enthält {count} Flügel außerhalb eines Flugzeugs; XFLR5 liest nur den letzten, „{name}“, dieser Import ebenso.',
  'Plane "{plane}", wing "{wing}", section {n}: {element} is missing.': 'Flugzeug „{plane}“, Flügel „{wing}“, Schnitt {n}: {element} fehlt.',
  'Wing "{wing}", section {n}: {element} is missing.': 'Flügel „{wing}“, Schnitt {n}: {element} fehlt.',
  'Plane "{plane}", wing "{wing}", section {n}: {element} "{text}" is not a number.': 'Flugzeug „{plane}“, Flügel „{wing}“, Schnitt {n}: {element} „{text}“ ist keine Zahl.',
  'Wing "{wing}", section {n}: {element} "{text}" is not a number.': 'Flügel „{wing}“, Schnitt {n}: {element} „{text}“ ist keine Zahl.',
  'Plane "{plane}", wing "{wing}": {element} "{text}" is not a number.': 'Flugzeug „{plane}“, Flügel „{wing}“: {element} „{text}“ ist keine Zahl.',
  'Plane "{plane}", wing "{wing}": Position "{text}" holds fewer than 3 values; the wing is placed at 0, 0, 0 as in {program}.':
    'Flugzeug „{plane}“, Flügel „{wing}“: Position „{text}“ enthält weniger als 3 Werte; der Flügel wird wie in {program} bei 0, 0, 0 platziert.',
  'Plane "{plane}", wing "{wing}": further values missing or not numbers: {count}.':
    'Flugzeug „{plane}“, Flügel „{wing}“: weitere fehlende oder nichtnumerische Werte: {count}.',
  'Wing "{wing}": further values missing or not numbers: {count}.': 'Flügel „{wing}“: weitere fehlende oder nichtnumerische Werte: {count}.',
  'Further warnings not listed: {count}.': 'Weitere, nicht aufgeführte Warnungen: {count}.',
};
