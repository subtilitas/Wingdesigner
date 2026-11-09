// German texts of the rounded-tip dialog (src/ui/roundtip.js), its checks (src/model/roundtip.js) and
// its button in the Sections tab.
export default {
  'Rounded tip…': 'Randbogen …',
  'Append a rounded tip beyond the wing tip': 'Einen Randbogen außen an den Randschnitt anfügen',
  'Rounded tip': 'Randbogen',
  'Appends sections beyond the tip section whose chord follows a superellipse to a point (Fullness 2: a quarter ellipse), with Tangent to the last panel scaled to start with the taper of the last panel; leading and trailing edge curve towards the straight line and meet on it. Airfoil and twist stay those of the tip section. They are ordinary sections afterwards: editable in the Sections table, removable with Undo.':
    'Fügt außen am Randschnitt Schnitte an, deren Profiltiefe einer Superellipse bis zu einer Spitze folgt (Fülle 2: eine Viertelellipse), mit Tangential zum letzten Feld so skaliert, dass sie mit der Zuspitzung des letzten Feldes beginnt; Nasenleiste und Endleiste laufen auf die gerade Linie zu und treffen sich auf ihr. Profil und Schränkung bleiben die des Randschnitts. Danach sind es gewöhnliche Schnitte: in der Tabelle Schnitte bearbeitbar, mit Rückgängig entfernbar.',
  'Length beyond the tip section (mm)': 'Länge außerhalb des Randschnitts (mm)',
  'Straight line (% of the chord from the leading edge)': 'Gerade Linie (% der Profiltiefe ab der Nasenleiste)',
  'Top view of the wing with the rounded tip': 'Draufsicht des Flügels mit dem Randbogen',
  'Add rounded tip': 'Randbogen anfügen',
  'Adds {n} sections and sets Settings > Wing tip to Pointed. Point at y = {y} mm, {out} mm beyond the tip section, chord {chord} mm.':
    'Fügt {n} Schnitte an und setzt Einstellungen > Flügelende auf Spitz. Spitze bei y = {y} mm, {out} mm außerhalb des Randschnitts, Profiltiefe {chord} mm.',
  'Rounded tip added: {n} sections, wing tip set to Pointed. Undo removes it.': 'Randbogen angefügt: {n} Schnitte, Flügelende auf Spitz gesetzt. Rückgängig entfernt ihn.',
  length: 'Länge',
  'straight line': 'gerade Linie',
  'number of sections': 'Anzahl der Schnitte',
  'Rounded tip: {param} must be between {min} and {max}.': 'Randbogen: {param} muss zwischen {min} und {max} liegen.',
  'Rounded tip: the number of sections must be a whole number.': 'Randbogen: Die Anzahl der Schnitte muss eine ganze Zahl sein.',
  'The wing already ends in a point (Settings > Wing tip = Pointed): a rounded tip needs a flat tip.':
    'Der Flügel endet schon spitz (Einstellungen > Flügelende = Spitz): Ein Randbogen braucht ein flaches Flügelende.',
  'Rounded tip: with {n} sections the tip chord must be at least {min} mm; use fewer sections.':
    'Randbogen: Mit {n} Schnitten muss die Randtiefe mindestens {min} mm betragen; weniger Schnitte wählen.',
  'Rounded-tip panel {n} spans {dy} mm in y, less than {min} mm; increase the length or use fewer sections.':
    'Randbogenfeld {n} reicht {dy} mm in y, weniger als {min} mm; die Länge vergrößern oder weniger Schnitte wählen.',
  'Rounded-tip section {n} lies beyond ±{max} mm.': 'Randbogenschnitt {n} liegt außerhalb von ±{max} mm.',
  'Tangent to the last panel': 'Tangential zum letzten Feld',
  'The chord starts with the taper of the last panel: no corner in the planform at the tip section':
    'Die Profiltiefe beginnt mit der Zuspitzung des letzten Feldes: kein Knick im Grundriss am Randschnitt',
  'Rounded tip: tangent must be on or off.': 'Randbogen: Tangential muss ein- oder ausgeschaltet sein.',
  'Rounded tip: the last panel tapers to zero chord within {at} mm, so a tangent tip can be at most {max} mm long; reduce the length or switch off Tangent to the last panel.':
    'Randbogen: Das letzte Feld liefe innerhalb von {at} mm auf Profiltiefe null zu, daher darf ein tangentialer Randbogen höchstens {max} mm lang sein; die Länge verkleinern oder Tangential zum letzten Feld ausschalten.',
  'Rounded-tip section {n}: the chord is above {max} mm.': 'Randbogenschnitt {n}: Die Profiltiefe liegt über {max} mm.',
  'Fullness (2 = ellipse, 3 = fullest)': 'Fülle (2 = Ellipse, 3 = am vollsten)',
  fullness: 'Fülle',
  'Continue the ellipse of the wing': 'Ellipse des Flügels fortsetzen',
  'The chord follows the ellipse through the chord and taper of the wing at the tip section, centred at the root, to its end; this sets the length':
    'Die Profiltiefe folgt der Ellipse durch Profiltiefe und Zuspitzung des Flügels am Randschnitt, mit der Mitte an der Wurzel, bis zu ihrem Ende; das legt die Länge fest',
  'Rounded tip: Continue the ellipse must be on or off.': 'Randbogen: Ellipse fortsetzen muss ein- oder ausgeschaltet sein.',
  'Continue the ellipse: the wing does not narrow towards the tip section, so it has no ellipse to continue.':
    'Ellipse fortsetzen: Der Flügel wird zum Randschnitt hin nicht schmaler, er hat also keine Ellipse zum Fortsetzen.',
  'Continue the ellipse: the ellipse of the wing closes {length} mm beyond the tip section, more than {max} mm.':
    'Ellipse fortsetzen: Die Ellipse des Flügels schließt sich {length} mm außerhalb des Randschnitts, mehr als {max} mm.',
};
