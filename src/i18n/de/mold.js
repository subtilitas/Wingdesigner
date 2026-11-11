// German texts of the mold dialog (src/ui/mold.js), its geometry and checks (src/geom/mold.js), its
// STEP export (src/export/moldstep.js) and its button in the Export dialog.
export default {
  Mold: 'Form',
  'Mold halves…': 'Formhälften …',
  'Lower and upper mold half as STEP solids, with resin channel and holes.': 'Unter- und Oberform als STEP-Körper, mit Blutrinne und Bohrungen.',
  'Builds a lower and an upper mold half of the right half wing as STEP solids, with a resin channel around the wing and holes for alignment pins and clamping screws.':
    'Baut eine Unter- und eine Oberform der rechten Flügelhälfte als STEP-Körper, mit einer Blutrinne um den Flügel und Bohrungen für Zentrierstifte und Spannschrauben.',
  'The wing has errors; fix them before building a mold.': 'Der Flügel hat Fehler; sie vor dem Bau einer Form beheben.',
  'The mold has no geometry; fix the reported errors first.': 'Die Form hat keine Geometrie; zuerst die gemeldeten Fehler beheben.',
  'Top view of the parting plane of the mold': 'Draufsicht auf die Trennebene der Form',
  'Download STEP': 'STEP herunterladen',
  'Mold exported as STEP.': 'Form als STEP exportiert.',
  Block: 'Formblock',
  'Margin around the wing (mm)': 'Rand um den Flügel (mm)',
  'Floor below the cavity (mm)': 'Boden unter dem Formnest (mm)',
  'Ramp width (mm)': 'Breite der Rampe (mm)',
  'Resin channel': 'Blutrinne',
  'Diameter (mm)': 'Durchmesser (mm)',
  'Distance from the wing (mm)': 'Abstand vom Flügel (mm)',
  'Alignment pin holes': 'Zentrierbohrungen',
  'Depth in each half (mm)': 'Tiefe in jeder Hälfte (mm)',
  'Clamping screw holes': 'Bohrungen für Spannschrauben',
  Pattern: 'Muster',
  'Block corners': 'Ecken des Formblocks',
  'Along the block edges': 'Entlang der Blockkanten',
  'Around the wing': 'Um den Flügel',
  'Largest spacing (mm)': 'Größter Abstand untereinander (mm)',
  'Distance from the block edge (mm)': 'Abstand von der Blockkante (mm)',
  'Distance beyond the resin channel (mm)': 'Abstand außerhalb der Blutrinne (mm)',
  File: 'Datei',
  Halves: 'Hälften',
  'Lower and upper': 'Unter- und Oberform',
  'Lower only': 'Nur Unterform',
  'Upper only': 'Nur Oberform',
  'Molds of the left wing (mirror image)': 'Formen des linken Flügels (Spiegelbild)',
  'The halves part along leading edge and trailing edge; a ramp joins the two edges to the parting plane, which lies at z = 0 in the file. The cavity is open at the root face of the block. The resin channel is half-round in each half; pin holes are blind, screw holes go through. The axes follow the last export (Export > Fusion 360 fix).':
    'Die Hälften trennen sich entlang von Nasenleiste und Endleiste; eine Rampe verbindet die beiden Kanten mit der Trennebene, die in der Datei bei z = 0 liegt. Das Formnest ist an der Wurzelfläche des Formblocks offen. Die Blutrinne ist in jeder Hälfte halbrund; Zentrierbohrungen sind Sacklöcher, Bohrungen für Spannschrauben gehen durch. Die Achsen folgen dem letzten Export (Exportieren > Fusion-360-Korrektur).',
  'Block {length} × {width} mm; lower half {lower} mm thick, upper half {upper} mm.': 'Formblock {length} × {width} mm; Unterform {lower} mm dick, Oberform {upper} mm.',
  'Parting plane rolled {roll}° with the wing; leading and trailing edge up to {height} mm off it.':
    'Trennebene mit dem Flügel um {roll}° gerollt; Nasenleiste und Endleiste liegen bis zu {height} mm daneben.',
  'Resin channel {length} mm long.': 'Blutrinne {length} mm lang.',
  '{pins} pin holes, {screws} screw holes.': '{pins} Zentrierbohrungen, {screws} Bohrungen für Spannschrauben.',
  'block margin': 'Rand des Formblocks',
  'floor thickness': 'Bodendicke',
  'ramp width': 'Breite der Rampe',
  'resin channel diameter': 'Durchmesser der Blutrinne',
  'resin channel distance': 'Abstand der Blutrinne',
  'pin diameter': 'Durchmesser der Zentrierbohrungen',
  'pin hole depth': 'Tiefe der Zentrierbohrungen',
  'pin spacing': 'Abstand der Zentrierbohrungen untereinander',
  'pin edge distance': 'Abstand der Zentrierbohrungen von der Blockkante',
  'pin distance': 'Abstand der Zentrierbohrungen von der Blutrinne',
  'screw hole diameter': 'Durchmesser der Schraubenbohrungen',
  'screw spacing': 'Abstand der Schraubenbohrungen untereinander',
  'screw edge distance': 'Abstand der Schraubenbohrungen von der Blockkante',
  'screw distance': 'Abstand der Schraubenbohrungen von der Blutrinne',
  'Mold: {param} must be between {min} and {max} mm.': 'Form: {param} muss zwischen {min} und {max} mm liegen.',
  'Mold: the hole pattern must be "corners", "frame" or "outline".': 'Form: Das Bohrmuster muss "corners", "frame" oder "outline" sein.',
  'Mold: halves must be "both", "lower" or "upper".': 'Form: halves muss "both", "lower" oder "upper" sein.',
  'Mold: the distance of the resin channel must be at least {min} mm, the ramp width plus {gap} mm.':
    'Form: Der Abstand der Blutrinne muss mindestens {min} mm betragen, die Breite der Rampe plus {gap} mm.',
  'Mold: the pin distance must be at least {min} mm, the hole radius plus {gap} mm.':
    'Form: Der Abstand der Zentrierbohrungen von der Blutrinne muss mindestens {min} mm betragen, der Bohrungsradius plus {gap} mm.',
  'Mold: the screw distance must be at least {min} mm, the hole radius plus {gap} mm.':
    'Form: Der Abstand der Schraubenbohrungen von der Blutrinne muss mindestens {min} mm betragen, der Bohrungsradius plus {gap} mm.',
  'Mold: the pin edge distance must be at least {min} mm, the hole radius plus {gap} mm.':
    'Form: Der Abstand der Zentrierbohrungen von der Blockkante muss mindestens {min} mm betragen, der Bohrungsradius plus {gap} mm.',
  'Mold: the screw edge distance must be at least {min} mm, the hole radius plus {gap} mm.':
    'Form: Der Abstand der Schraubenbohrungen von der Blockkante muss mindestens {min} mm betragen, der Bohrungsradius plus {gap} mm.',
  'Mold: the ramp along the wing outline could not be fitted; move sections that lie very close together apart.':
    'Form: Die Rampe entlang des Flügelumrisses ließ sich nicht anpassen; sehr dicht beieinander liegende Schnitte auseinanderschieben.',
  'Mold: the ramp folds over itself at the wing outline; reduce the ramp width.': 'Form: Die Rampe faltet sich am Flügelumriss über sich selbst; die Breite der Rampe verringern.',
  'Mold: leading edge and trailing edge lie up to {height} mm off the parting plane (twist, a change of dihedral or the airfoil), so the ramp rises up to {slope}°. A wider ramp, or a wing with less twist and one dihedral angle, keeps the parting surface flatter.':
    'Form: Nasenleiste und Endleiste liegen bis zu {height} mm neben der Trennebene (Schränkung, eine Änderung der V-Form oder das Profil), daher steigt die Rampe bis zu {slope}° an. Eine breitere Rampe oder ein Flügel mit weniger Schränkung und einem einzigen V-Form-Winkel hält die Trennfläche flacher.',
  'Mold: the block margin must be at least {min} mm for the resin channel (distance, diameter and {gap} mm to the block edge).':
    'Form: Der Rand des Formblocks muss für die Blutrinne mindestens {min} mm betragen (Abstand, Durchmesser und {gap} mm bis zur Blockkante).',
  'Mold: the block margin must be at least {min} mm, the ramp width plus {gap} mm.': 'Form: Der Rand des Formblocks muss mindestens {min} mm betragen, die Breite der Rampe plus {gap} mm.',
  'Mold: the path of the resin channel around the wing could not be built; change its distance.': 'Form: Der Verlauf der Blutrinne um den Flügel ließ sich nicht bauen; ihren Abstand ändern.',
  'Mold: the resin channel leaves the block; increase the block margin or reduce the distance of the resin channel.':
    'Form: Die Blutrinne verlässt den Formblock; den Rand des Formblocks vergrößern oder den Abstand der Blutrinne verringern.',
  'Mold: {n} pin hole(s) left out: too close to the cavity, the resin channel, a block edge or another hole.':
    'Form: {n} Zentrierbohrung(en) weggelassen: zu nah am Formnest, an der Blutrinne, an einer Blockkante oder an einer anderen Bohrung.',
  'Mold: {n} screw hole(s) left out: too close to the cavity, the resin channel, a block edge or another hole.':
    'Form: {n} Schraubenbohrung(en) weggelassen: zu nah am Formnest, an der Blutrinne, an einer Blockkante oder an einer anderen Bohrung.',
  'Mold: the pin holes are {depth} mm deep, but the thinner half is {thickness} mm thick; reduce the depth or increase the floor thickness.':
    'Form: Die Zentrierbohrungen sind {depth} mm tief, die dünnere Hälfte ist aber nur {thickness} mm dick; die Tiefe verringern oder die Bodendicke vergrößern.',
  'Mold: seen from above, the airfoil reaches {reach} mm beyond the leading-edge or trailing-edge line (twisted sections), more than {limit} mm: one mold half would be undercut. Reduce the twist.':
    'Form: Von oben gesehen reicht das Profil {reach} mm über die Linie der Nasenleiste oder der Endleiste hinaus (geschränkte Schnitte), mehr als {limit} mm: Eine Formhälfte hätte einen Hinterschnitt. Die Schränkung verringern.',
};
