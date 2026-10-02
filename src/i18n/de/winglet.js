// German texts of the winglet dialog (src/ui/winglet.js), its checks (src/model/winglet.js) and its
// button in the Sections tab.
export default {
  'Winglet…': 'Winglet …',
  'Append a winglet beyond the wing tip': 'Ein Winglet außen an den Randschnitt anfügen',
  Winglet: 'Winglet',
  'Appends sections beyond the wing tip that bend the wing up or down along a blend arc and run on straight to the winglet tip. They are ordinary sections afterwards: editable in the Sections table, removable with Undo.':
    'Fügt außen am Randschnitt Schnitte an, die den Flügel entlang eines Übergangsbogens nach oben oder unten biegen und gerade bis zur Wingletspitze weiterführen. Danach sind es gewöhnliche Schnitte: in der Tabelle Schnitte bearbeitbar, mit Rückgängig entfernbar.',
  'Height along the winglet (mm)': 'Höhe entlang des Winglets (mm)',
  'Cant angle (deg, positive = up)': 'Neigung (°, positiv = nach oben)',
  'Blend radius (mm)': 'Übergangsradius (mm)',
  'Tip chord (% of the wing tip chord)': 'Spitzentiefe (% der Randtiefe)',
  'Toe (deg, twist at the winglet tip)': 'Anstellung (°, Schränkung an der Wingletspitze)',
  'Winglet tip airfoil': 'Profil der Wingletspitze',
  'Front view of the wing with the winglet': 'Vorderansicht des Flügels mit dem Winglet',
  'Add winglet': 'Winglet anfügen',
  'Adds {n} sections. Winglet tip at y = {y} mm, z = {z} mm: {up} mm above and {out} mm beyond the wing tip.':
    'Fügt {n} Schnitte an. Wingletspitze bei y = {y} mm, z = {z} mm: {up} mm über und {out} mm außerhalb des Randschnitts.',
  'Winglet added: {n} sections. Undo removes it.': 'Winglet angefügt: {n} Schnitte. Rückgängig entfernt es.',
  height: 'Höhe',
  'cant angle': 'Neigung',
  'blend radius': 'Übergangsradius',
  'tip chord': 'Spitzentiefe',
  toe: 'Anstellung',
  'Winglet: {param} must be between {min} and {max}.': 'Winglet: {param} muss zwischen {min} und {max} liegen.',
  'Winglet: choose an airfoil of the project.': 'Winglet: ein Profil des Projekts wählen.',
  'Switch the guide curves off first: they hold x as a function of y and would stretch over the winglet.':
    'Zuerst die Leitkurven ausschalten: Sie halten x als Funktion von y und würden sich über das Winglet dehnen.',
  'The wing ends in a point (Settings > Wing tip = Pointed): a winglet needs a flat tip.':
    'Der Flügel endet spitz (Einstellungen > Flügelende = Spitz): Ein Winglet braucht ein flaches Flügelende.',
  'A winglet needs Settings > Section planes = Mitred: vertical section planes make it cos(cant) as thick, 0.26 times at 75°.':
    'Ein Winglet braucht Einstellungen > Schnittebenen = Auf Gehrung: Senkrechte Schnittebenen machen es cos(Neigung) so dick, 0,26-mal bei 75°.',
  'Winglet: the blend arc is {arc} mm long, not shorter than the height; reduce the blend radius or increase the height.':
    'Winglet: Der Übergangsbogen ist {arc} mm lang, nicht kürzer als die Höhe; den Übergangsradius verkleinern oder die Höhe vergrößern.',
  'Winglet panel {n} spans {dy} mm in y, less than {min} mm; reduce the cant angle or increase the blend radius or the height.':
    'Wingletfeld {n} reicht {dy} mm in y, weniger als {min} mm; die Neigung verkleinern oder den Übergangsradius oder die Höhe vergrößern.',
  'Winglet section {n} lies beyond ±{max} mm.': 'Wingletschnitt {n} liegt außerhalb von ±{max} mm.',
  'Winglet section {n}: the chord is below {min} mm.': 'Wingletschnitt {n}: Die Profiltiefe liegt unter {min} mm.',
  'Winglet section {n}: the chord is above {max} mm.': 'Wingletschnitt {n}: Die Profiltiefe liegt über {max} mm.',
  'Winglet section {n}: the twist lies beyond ±{max}°.': 'Wingletschnitt {n}: Die Schränkung liegt außerhalb von ±{max}°.',
};
