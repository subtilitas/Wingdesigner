English: [[User Guide|User-Guide]]

# Benutzerhandbuch

| Konvention | Wert |
| --- | --- |
| Einheiten | Millimeter (mm), Winkel in Grad (°) |
| x | in Profiltiefenrichtung, positiv zur Endleiste |
| y | in Spannweitenrichtung, positiv zum rechten Flügelende |
| z | nach oben |
| Bearbeitete Geometrie | rechter Halbflügel (y ≥ 0), gespiegelt an der Ebene y = 0 |
| Vorzeichen der Schränkung | positiv = Nase hoch |
| Feld | Spannweitenabschnitt zwischen zwei benachbarten Profilschnitten |
| Station | eine platzierte Profilkontur an der Spannweitenposition y; jeder Profilschnitt ist eine Station |

## Bildschirmaufbau

![Desktop-Fenster: Kopfleiste, 3D-Ansicht, Registerkarte Sections, Statusleiste](images/main-desktop.png)

| Bereich | Inhalt |
| --- | --- |
| Kopfleiste | **New**, **Open**, **Save**, **Export**, **Undo**, **Redo**, **Help** |
| 3D-Ansicht | NURBS-Fläche des Flügels, Schnittkonturen (blau, ausgewählter Schnitt rot), Linien der Nasenleiste und der Endleiste (grau), Raster in der Ebene z = 0 (20 × 20 Zellen); Ansichtsschaltflächen |
| Bedienbereich | Registerkarten **Sections** (Profilschnitte), **Planform** (Grundriss), **Airfoils** (Profile), **Settings** (Einstellungen), **Checks** (Prüfungen) |
| Statusleiste | Spannweite, Flügelfläche, Streckung (AR, aspect ratio), mittlere aerodynamische Flügeltiefe (MAC, mean aerodynamic chord), Anzahl der Warnungen (nur bei 1 oder mehr Warnungen). Bei Fehlern: Anzahl der Fehler und erste Fehlermeldung in roter Schrift. Bei ausgeschalteter automatischer Speicherung: `Autosave off: use Save` in roter Schrift (Abschnitt [Speicherung](#speicherung)). |
| Meldungen | Kurzmeldungen (z. B. `Created "Glider".`) am unteren Rand der 3D-Ansicht für 4 s; eine Meldung mit mehr als 66 Zeichen bleibt 60 ms je Zeichen. Fehlermeldungen auf rotem Grund. |

| Schaltfläche der Kopfleiste | Wirkung |
| --- | --- |
| **New** | Öffnet den Assistenten (Abschnitt [Assistent](#assistent)). |
| **Open** | Lädt eine Projektdatei im Format JSON (JavaScript Object Notation, Dateiendung `.json`). Dateien über 100 MB werden ungelesen abgewiesen: `Cannot open <file>: … MB; project files are limited to 100 MB.` Eine Datei, die der Browser nicht lesen kann (entferntes Laufwerk, entzogene Berechtigung), zeigt `Cannot open <file>: the browser could not read the file (NotReadableError).`; der aktuelle Entwurf bleibt. Ungültige Dateien werden abgewiesen; die Meldung zeigt bis zu 3 Fehler. Abgeleitete NURBS-Daten (Non-Uniform Rational B-Spline) in der Datei werden ignoriert und neu berechnet. |
| **Save** | Lädt das Projekt-JSON herunter. Gleiche Datei wie **Export** > Project JSON. Brächten die abgeleiteten NURBS-Daten die Datei über 100 MB, lässt die Datei sie weg (Abschnitt [Export](#export)). Ein Fehler zeigt die rote Meldung `Save failed: <reason>.` |
| **Export** | Öffnet den Exportdialog (Abschnitt [Export](#export)). |
| **Undo** / **Redo** | Rückgängig / Wiederholen im Bearbeitungsverlauf, nur im Arbeitsspeicher: höchstens 100 Schritte und höchstens 64 000 000 Zeichen serialisiertes Projekt (Rückgängig und Wiederholen zusammen); ein Projekt über 640 000 Zeichen behält weniger Schritte, mindestens 1. **Undo** macht auch **New** und **Open** rückgängig. |
| **Help** | App-Version, Arbeitsablauf, Bedienung, Links zu diesem Wiki, zum Quellcode und zu `LICENSES.txt` (**Licenses of this app and its libraries**: die MIT-Lizenz der App und die Lizenztexte von three.js und fflate). |

### Schmale Bildschirme

![Smartphone-Ansicht (Pixel 7): 3D-Ansicht oben, Schnittkarten darunter](images/mobile-main.png)

Bei einer Fensterbreite von höchstens 860 px:

- Die 3D-Ansicht liegt über dem Bedienbereich: 42 % der Fensterhöhe, mindestens 240 px.
- In der 3D-Ansicht erscheint **Enlarge**. Die Schaltfläche blendet den Bedienbereich aus und gibt der 3D-Ansicht die volle Höhe; erneutes Tippen blendet ihn wieder ein.
- Die Schnitttabelle wird zu einer Karte je Profilschnitt (3 Spalten, Beschriftung über jedem Wert).
- Die Grundriss-Zeichenfläche ist 260 px hoch.
- Bei einer Fensterbreite von höchstens 420 px bleiben die 7 Schaltflächen der Kopfleiste in 1 Zeile. Ist die Zeile breiter als das Fenster, lässt sie sich seitlich verschieben.

![Smartphone-Ansicht des Grundriss-Editors mit eingeschalteter Endlinie](images/mobile-planform.png)

Auf Touchscreens (grober Zeiger) sind Schaltflächen und Eingabefelder mindestens 40 px hoch.

## Speicherung

- Nach jeder Änderung speichert der Browser das Projekt in `localStorage` unter dem Schlüssel `wingdesigner.project.v1`. Der nächste Aufruf stellt es wieder her.
- Gespeichert werden nur Projekte, die die Prüfung von **Open** bestehen. Sonst bleibt das letzte gültige Projekt gespeichert.
- Ein gespeichertes Projekt, das sich nicht laden lässt, bleibt unter `wingdesigner.project.v1.rejected` erhalten. Eine Fehlermeldung erscheint, und der Assistent öffnet sich wie beim ersten Aufruf. Ist für diese Kopie kein Platz, bleibt das Projekt unter `wingdesigner.project.v1`, und die automatische Speicherung bleibt für die Sitzung aus; die Statusleiste zeigt von Anfang an `Autosave off: use Save`.
- Die aktive Registerkarte steht unter `wingdesigner.tab`.
- Ohne gespeichertes Projekt (erster Aufruf) öffnet sich der Assistent. Solange dieser Assistent offen ist, wird nichts gespeichert; ein Neuladen zeigt den Assistenten erneut.
- Bei gesperrtem Speicher (privates Fenster) existiert das Projekt nur im geöffneten Browser-Tab. **Save** sichert es als Datei.
- Weist der Browser das Projekt ab (Browser behalten etwa 5 000 000 Zeichen je Website), erscheint einmal die rote Meldung `Autosave is off: browser storage refused the project (… characters; browsers keep about 5,000,000 per site). Use Save to keep it.` Die Statusleiste zeigt `Autosave off: use Save`, bis eine automatische Speicherung wieder gelingt; dann erscheint die Meldung `Autosave works again.`
- Solange die automatische Speicherung scheitert, steht der Zeitpunkt des ersten Fehlschlags unter dem Schlüssel `wingdesigner.project.v1.stale`. Der nächste Aufruf stellt das zuletzt gespeicherte Projekt wieder her und meldet `This is the project as last saved; autosave stopped at … because browser storage was full, and later edits were not saved.` Bringt das wiederhergestellte Projekt die Warnung `Large project` mit, erscheinen beide Texte in einer Meldung in der Fehlerfarbe.
- Der Bearbeitungsverlauf (Rückgängig/Wiederholen) wird nicht gespeichert.

## Bedienung

| Aktion | Maus | Touchscreen |
| --- | --- | --- |
| 3D-Ansicht drehen | linke Taste ziehen | mit einem Finger ziehen |
| 3D-Ansicht zoomen | Mausrad oder mittlere Taste ziehen | zwei Finger spreizen oder zusammenziehen |
| 3D-Ansicht verschieben | rechte Taste ziehen | mit zwei Fingern ziehen |
| Punkt im Grundriss-Editor verschieben | Punkt ziehen | Punkt ziehen |
| Grundriss-Editor, Profilvorschau oder Assistentenvorschau verschieben | Hintergrund ziehen | Hintergrund ziehen |
| Grundriss-Editor, Profilvorschau oder Assistentenvorschau zoomen | Mausrad (um den Mauszeiger) | zwei Finger spreizen oder zusammenziehen |
| Grundriss-Editor einpassen | Doppelklick oder **Fit** | **Fit** |
| Profilvorschau einpassen | automatisch beim Öffnen; Doppelklick | automatisch beim Öffnen; keine Schaltfläche zum Einpassen |
| Assistentenvorschau einpassen | automatisch nach jeder Eingabe; Doppelklick | automatisch nach jeder Eingabe; keine Schaltfläche zum Einpassen |
| Rückgängig | Strg+Z (macOS: Cmd+Z) | **Undo** |
| Wiederholen | Strg+Umschalt+Z oder Strg+Y (macOS: Cmd) | **Redo** |

- Fangradius für Punkte im Grundriss-Editor: 9 px mit Maus oder Stift, 18 px mit Touchscreen. Innerhalb des Radius wird der nächstgelegene Punkt gewählt.
- Tastenkürzel wirken nicht, solange der Fokus in einem Eingabefeld, Textbereich oder einer Auswahlliste liegt oder solange ein Dialog offen ist.
- Der Tastaturfokus bleibt auf Zahlenfeldern, den Profillisten der Tabelle **Sections**, den Auswahllisten unter **Settings** und der Leitkurven (**Mode**, **Degree**), den Kontrollkästchen unter **Settings** und **Use guide curve**, dem Feld für den Projektnamen und den Zeilenschaltflächen **+** und **×** der Tabelle **Sections**, wenn die Registerkarte nach einer Änderung neu aufgebaut wird. Text- und Zahlenfelder markieren ihren Text erneut.
- Eingabefelder für Zahlen übernehmen den Wert mit Enter, beim Verlassen des Eingabefelds und bei jedem Schritt mit den Pfeiltasten oder den Pfeilen im Eingabefeld. Eine nicht numerische Eingabe springt auf den vorherigen Wert zurück.
- Ein Eingabefeld für Zahlen zeigt die kürzeste Dezimalzahl, die den gespeicherten Wert genau wiedergibt, z. B. `600.0000002`; die Anzeige rundet keinen Wert.
- Ein Ziehvorgang ist ein Rückgängig-Schritt, wie lange er auch pausiert: Seine Änderungen werden zusammengefasst, bis der Zeiger losgelassen wird.
- **Undo** oder **Redo** während eines Ziehvorgangs beendet den Ziehvorgang; weitere Zeigerbewegungen bis zum Loslassen bewegen nichts. **Redo** stellt einen rückgängig gemachten Ziehvorgang oder Punkt wieder her.
- Eine Aktion, die nichts ändert, ergibt keinen Rückgängig-Schritt und behält die Wiederholen-Schritte, z. B. **Remove unused**, wenn jedes Profil verwendet wird, **Add to project** eines Profils, das das Projekt schon enthält, oder die Eingabe des Werts, den ein Feld schon hat.

| Schaltfläche der 3D-Ansicht | Kamera |
| --- | --- |
| **Iso** | Von vorn (vor der Nasenleiste), von links und von oben |
| **Top** | Von oben (+z) |
| **Front** | Von vorn (−x) |
| **Side** | Von links (−y) |
| **Fit** | Gleiche Richtung wie **Iso** |
| **Enlarge** | Nur bei Breiten ≤ 860 px; blendet den Bedienbereich aus und ein |

**Iso**, **Top**, **Front**, **Side** und **Fit** passen zusätzlich den ganzen Flügel in die Ansicht ein.

## Assistent

![Assistent mit der Vorlage Glider: Vorlagen, 12 Eingaben einschließlich Tip, Grundrissvorschau und Kennwerte](images/wizard.png)

Der Assistent erzeugt aus 12 Eingaben (Tabelle unten) ein vollständiges Projekt. Er erzeugt Profilschnitte, Profile, die Endleisteneinstellung, die Form des Flügelendes und bei elliptischem Grundriss beide Leitkurven. Alle Werte bleiben danach bearbeitbar.

- Öffnet sich beim ersten Aufruf (Titel „Start a new wing design“) und mit **New** (Titel „New wing design“).
- Vorausgewählte Vorlage: **Sport**. Ein Klick auf eine Vorlagenkarte lädt deren Werte.
- Profile sind NACA-Profile (National Advisory Committee for Aeronautics) der 4- oder 5-stelligen Reihe. Gültige Kennungen: Abschnitt [NACA-Generator](#naca-generator).

| Eingabefeld | Bereich | Wirkung |
| --- | --- | --- |
| Project name (Projektname) | Text | Vorgabe: Name der Vorlage. Leer: `<span> mm wing` |
| Span (both halves) (Spannweite) | 100 bis 20 000 mm | Spannweite von Flügelende zu Flügelende |
| Root chord (Wurzeltiefe) | 10 bis 3000 mm | Profiltiefe bei y = 0 |
| Taper (tip / root chord) (Zuspitzung) | 0,1 bis 1,5 | Randtiefe geteilt durch Wurzeltiefe. Elliptischer Grundriss mit flachem Flügelende: kleiner als 1. Elliptischer Grundriss mit spitzem Flügelende: nicht verwendet. |
| Sweep of the 25 % line (Pfeilung) | −45 bis 60° | Pfeilung der 25-%-Linie; positiv = nach hinten gepfeilt |
| Dihedral per half (V-Form) | −15 bis 30° | z des Schnitts = y · tan(V-Form) |
| Tip twist (negative = washout) (Schränkung am Rand) | −15 bis 15° | Schränkung ändert sich linear von 0° an der Wurzel bis zu diesem Wert am Rand |
| Number of sections (Anzahl Schnitte) | 2 bis 8, ganzzahlig | Schnitte gleichmäßig verteilt von Wurzel bis Rand |
| Planform (Grundriss) | **Straight taper** (gerade zugespitzt), **Elliptic (guide curves)** (elliptisch, mit Leitkurven) | Tiefenverlauf, siehe unten |
| Tip (Flügelende) | **Flat** (flach), **Pointed (1/200 scale)** (spitz, Maßstab 1/200) | Flach: Der Flügel endet am Randschnitt. Spitz: Profiltiefe des Randschnitts = 1/200 der Profiltiefe am vorletzten Schnitt, mindestens 1 mm. |
| Root airfoil (NACA) (Wurzelprofil) | NACA-Kennung | Profil aller Schnitte außer dem Randschnitt |
| Tip airfoil (NACA) (Randprofil) | NACA-Kennung | Profil des Randschnitts |

Tiefenverlauf (η = Spannweitenanteil, 0 an der Wurzel, 1 am Rand; λ = Zuspitzung; η_prev = Spannweitenanteil des vorletzten Schnitts):

| Grundriss | Flügelende | Profiltiefe c(η) | Leitkurven |
| --- | --- | --- | --- |
| Straight taper | flach | c_root · (1 + (λ − 1) · η) | aus |
| Straight taper | spitz | wie flach; Randschnitt: max(c(η_prev) / 200, 1 mm) | aus |
| Elliptic | flach | c_root · √(1 − (1 − λ²) · η²) | Nasenlinie und Endlinie an; je 11 Punkte bei η_i = sin(π i / 20), i = 0 … 10: 0; 0,156; 0,309; 0,454; 0,588; 0,707; 0,809; 0,891; 0,951; 0,988; 1 (zum Rand hin dichter) |
| Elliptic | spitz | c_root · √(1 − η²); Randschnitt: max(c(η_prev) / 200, 1 mm) | Nasenlinie und Endlinie an; je 11 Punkte bei denselben η wie flach; beide Linien enden auf der 25-%-Linie |

Erzeugte Leitkurven verwenden **Through points** (durch Punkte) und Grad 3. x der Endlinie: das gerundete x der Nasenlinie plus die gerundete Profiltiefe. Größte Abweichung der Profiltiefe der Leitkurven vom elliptischen Verlauf, Vorlage **Glider**, in % der Wurzeltiefe: Zuspitzung 0,1: 0,55 %; 0,2: 0,10 %; 0,3: 0,02 %; 0,45: 0,004 %; **Pointed**: 2,87 %, innerhalb der letzten 0,3 % der Spannweite (1 000 001 Spannweitenpositionen).

Erzeugte Werte:

| Wert | Regel |
| --- | --- |
| x der Profilnase | 0,25 · c_root + y · tan(Pfeilung) − 0,25 · c(η); die 25-%-Punkte liegen auf der Pfeilungslinie |
| Rundung | 0,01 mm, 0,01° |
| Endleiste | **Fixed thickness in mm** (feste Dicke): 0,2 % der Wurzeltiefe, mindestens 0,3 mm |
| Flügelende | **Settings** > **Wing tip** = Eingabefeld **Tip**; Maßstab des Randprofils 1 : 200 |

Die Vorschau zeigt den Grundriss beider Hälften. Die Zeile darunter nennt Flügelfläche (dm²), Streckung, MAC mit ihrer Spannweitenposition und Randtiefe.

Bei einer der folgenden Bedingungen wird die Zeile rot und nennt die Probleme; **Create design** ist dann gesperrt:

- Ein Wert liegt außerhalb seines Bereichs (Spalte Bereich).
- **Number of sections** ist nicht ganzzahlig.
- Wurzel- oder Randprofil ist keine gültige NACA-Kennung.
- **Elliptic** mit Flügelende **Flat** hat eine Zuspitzung ≥ 1 (`An elliptic planform needs taper < 1.`).
- Der Flügel hat einen Aufbaufehler (Abschnitt [Prüfungen](#prüfungen)).

| Vorlage | Spannweite mm | Wurzeltiefe mm | Zuspitzung | Pfeilung ° | V-Form ° | Schränkung Rand ° | Schnitte | Grundriss | Flügelende | Wurzel- / Randprofil |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Trainer | 1400 | 250 | 1 | 0 | 3 | 0 | 2 | gerade | flach | 2412 / 2412 |
| Sport (Sportmodell) | 1200 | 240 | 0,6 | 0 | 1,5 | −1 | 2 | gerade | flach | 2412 / 2410 |
| Glider (Segelflugmodell) | 2000 | 200 | 0,45 | 0 | 4 | −1,5 | 3 | elliptisch | flach | 2410 / 2408 |
| Swept flying wing (Pfeilnurflügel) | 1200 | 280 | 0,45 | 25 | 0 | −4 | 3 | gerade | flach | 23112 / 0010 |
| Plank (Brettnurflügel) | 1000 | 220 | 0,8 | 0 | 1 | 0 | 2 | gerade | flach | 23112 / 23112 |
| Tail surface (Leitwerk) | 500 | 130 | 0,7 | 5 | 0 | 0 | 2 | gerade | flach | 0009 / 0009 |

| Schaltfläche | Wirkung |
| --- | --- |
| **Create design** | Ersetzt das aktuelle Projekt. **Undo** stellt das vorherige wieder her. |
| **Cancel** | Behält das aktuelle Projekt. |
| **Skip (open sample wing)** | Nur beim ersten Aufruf, anstelle von **Cancel**. Behält den Beispielflügel „Sport wing 1500“: 3 Schnitte, 1500 mm Spannweite, NACA 2412 / 2410, Endleiste fest 0,5 mm. |

## Profilschnitte

![Registerkarte Sections mit den 3 Schnitten der Vorlage Glider](images/sections.png)

Ein Profilschnitt setzt ein Profil:

- in die Ebene y = konst.;
- mit der Profilnase bei (x, y, z);
- skaliert auf die Profiltiefe;
- um den Schränkungswinkel gedreht; Drehpunkt: **Settings** > **Twist pivot**, Vorgabe 0,25 = 25 % der Profiltiefe.

Berechnung: [[Geometrie|Geometrie]].

| Spalte | Einheit | Schritt | Grenze | Wirkung |
| --- | --- | --- | --- | --- |
| # | – | – | – | Schnittnummer; 1 = Wurzel |
| Airfoil (Profil) | – | – | Profile des Projekts | Profil dieses Schnitts |
| y | mm | 5 | 0 bis 1 000 000 | Spannweitenposition. Die Schnitte werden nach y neu sortiert. |
| x | mm | 1 | −1 000 000 bis 1 000 000 | Lage der Profilnase in Tiefenrichtung; positiv = nach hinten (Pfeilung nach hinten) |
| z | mm | 1 | −1 000 000 bis 1 000 000 | Höhe der Profilnase (V-Form) |
| Chord (Profiltiefe) | mm | 1 | 1 bis 100 000 | Profiltiefe (Maßstab des Profils) |
| Twist (Schränkung) | ° | 0,1 | −360 bis 360 | Drehung um den Drehpunkt; positiv = Nase hoch. Die App beschriftet die Einheit mit `deg`. |

| Schaltfläche | Wirkung |
| --- | --- |
| **+** | Fügt einen Schnitt auf halbem Weg zum nächsten ein: Mittelwert von y, x, z, Profiltiefe und Schränkung; Profil des aktuellen Schnitts. In der Randzeile: Kopie des Randschnitts, eine Feldlänge weiter außen (mindestens 10 mm). Gesperrt bei 20 000 Schnitten (Tooltip `At most 20,000 sections: more run a desktop browser tab out of memory.`). |
| **×** | Löscht den Schnitt. Gesperrt, solange nur 2 Schnitte vorhanden sind. |

**+** weist das Einfügen mit einer Fehlermeldung ab, wenn:

- der Mittelwert der y-Werte der beiden Nachbarschnitte nicht echt zwischen ihnen liegt oder sich sein Spannweitenanteil nicht von denen beider Nachbarn unterscheidet (unterscheidbar: mehr als 4 Einheiten der letzten Stelle und mehr als 2^-1021, wie unter [Prüfungen](#prüfungen)): `No span position lies between y = … mm and y = … mm. Move the two sections apart first.`
- die Kopie des Randschnitts jenseits von y = 1 000 000 mm läge: `A section beyond the tip would lie beyond y = 1000000 mm.`
- die Kopie des Randschnitts die Spannweite so weit verlängert, dass sich die Spannweitenanteile zweier benachbarter Schnitte nicht mehr unterscheiden: `A section at y = … mm beyond the tip makes the span too long for the sections at y = … mm and y = … mm. Move the two sections apart first.` Das Ziehen des Randschnitts im Tab **Planform** hält unter derselben Bedingung an.

Tooltip von **+**: `Insert a section after this one`. Ergibt das Einfügen mehr als 200 Schnitte, ergänzt der Tooltip die Schätzung aus Abschnitt [Projektgröße](#projektgröße): `Insert a section after this one. With … sections, each change takes … and … of browser memory.`

- Ein y, das ein anderer Schnitt bereits hat, wird mit einer Fehlermeldung abgewiesen (`Another section already lies at y = … mm; …`). Das Eingabefeld behält seinen vorherigen Wert.
- Ein eingegebener Wert außerhalb der Grenze wird auf die nächste Grenze gesetzt, z. B. wird ein negatives y zu 0 und eine Profiltiefe unter 1 mm zu 1 mm. Schritte mit den Pfeiltasten oder den Pfeilen im Eingabefeld enden an den Grenzen. Die Grenzen gelten auch für Projektdateien ([[Dateiformate|Dateiformate]]).
- Ein Klick irgendwo in eine Zeile außerhalb ihrer Eingabefelder, Auswahllisten und Schaltflächen wählt den Schnitt aus, auch in der Kartenansicht schmaler Bildschirme. Die Zeile wird markiert, die 3D-Ansicht zeichnet die Schnittkontur rot, der Grundriss-Editor Tiefenlinie und Griffe des Schnitts rot. Die Auswahl baut den Flügel nicht neu auf: Sie braucht 2 ms JavaScript bei 200 Schnitten und 100 bis 110 ms bei 20 000 Schnitten.
- Profil-Auswahllisten: Bei mehr als 20 000 Listeneinträgen (Schnitte × Projektprofile) enthält jede Liste nur ihr gewähltes Profil, bis sie den Fokus erhält oder angeklickt wird; dann listet sie alle Projektprofile.
- Ändert sich y von Wurzel- oder Randschnitt, skalieren die y-Werte der Leitkurvenpunkte linear auf den geänderten Bereich von Wurzel bis Rand.
- Zwischen den Schnitten werden x, z, Profiltiefe, Schränkung und Profilform entlang der Spannweite interpoliert (**Settings** > **Spanwise interpolation**).

Mit eingeschalteter Leitkurve verwendet der Flügel den Wert der Leitkurve statt des eingegebenen Werts. Der verwendete Wert steht unter dem Eingabefeld als `guide: 12.3`, wenn er um mehr als 0,05 mm abweicht:

| Eingeschaltete Leitkurven | Überschriebene Spalte |
| --- | --- |
| Nasenlinie oder Endlinie | x |
| Nasenlinie und Endlinie | x und Chord |

Mit **Settings** > **Wing tip** = Pointed (spitz) verwendet der Flügel die eingegebene Randtiefe nicht. Die Zelle Chord der Randzeile zeigt die verwendete Randtiefe mit 2 Nachkommastellen, z. B. `tip: 1.25`. `(min.)` folgt, wenn die Untergrenze von 1 mm greift, z. B. `tip: 1.00 (min.)`.

## Grundriss

![Grundriss-Editor: Nasenlinie und Endlinie an (elliptischer Grundriss), Tabelle der Leitkurvenpunkte](images/planform.png)

Der Grundriss-Editor zeigt den Halbflügel von oben: Spannweite y nach rechts, Profiltiefe x nach unten, y = 0 auf der senkrechten Achse. Die Rasterbeschriftung nennt den Rasterabstand in mm (Reihe 1-2-5, mindestens 60 px Abstand: 60 bis 150 px).

| Werkzeugleiste | Wirkung |
| --- | --- |
| **Fit** | Passt die Schnitte, Punkte und Kurven der eingeschalteten Leitkurven, den aufgebauten Umriss und bei eingeschaltetem **Mirror** das Spiegelbild in die Zeichenfläche ein |
| **+** / **−** | Zoom um Faktor 1,25 / 0,8 um die Mitte der Zeichenfläche |
| **Mirror** | Graues Spiegelbild der anderen Hälfte. Nur Anzeige; Vorgabe: an; wird nicht gespeichert. |

| Griff | Sichtbar, wenn | Wirkung beim Ziehen |
| --- | --- | --- |
| Blaues Quadrat an der Profilnase eines Schnitts | Nasenlinie aus; nicht an einem Randschnitt mit **Pointed**, solange die Endlinie an ist | Verschiebt x und y des Schnitts; x bleibt innerhalb von ±1 000 000 mm. Die Endleiste bleibt stehen (Endlinie an: die Endlinie beim geänderten y); die Profiltiefe ändert sich im Bereich 1 bis 100 000 mm. y hält 1 mm Abstand zu den Nachbarschnitten (Nachbarn näher als 4 mm: ein Viertel der Lücke). Der Wurzelschnitt behält sein y. y des Randschnitts bleibt höchstens 1 000 000 mm. Ein y, dessen Spannweitenanteil sich nicht von dem eines Nachbarn unterscheiden würde (4 Einheiten der letzten Stelle, 2^-1021), wird nicht übernommen; der Schnitt behält sein y. |
| Blauer Kreis an der Endleiste eines Schnitts | Endlinie aus; nicht an einem Randschnitt mit **Pointed** | Setzt die Profiltiefe (1 bis 100 000 mm) |
| Raute auf einer Leitkurve (grün: Nasenlinie, braun: Endlinie) | Leitkurve an | Verschiebt den Punkt; x bleibt innerhalb von ±1 100 000 mm. Wurzel- und Randpunkt bewegen sich nur in x. Innere Punkte halten in y 0,5 mm Abstand zu ihren Nachbarn (Nachbarn näher als 2 mm: ein Viertel der Lücke). Ein y, dessen normierter Wert sich nicht von dem eines Nachbarn unterscheiden würde, lässt das y des Punkts unverändert; die Punkttabelle wendet dieselbe Regel an. |

- Gezogene Werte werden auf 0,1 mm gerundet.
- Die Zeile unter der Zeichenfläche zeigt die Werte während des Ziehens.
- Der ausgewählte Schnitt und der ausgewählte Leitkurvenpunkt sind rot. Ein Klick auf den Hintergrund, **Reset to sections** und das Ein- oder Ausschalten der Leitkurve heben die Auswahl des Leitkurvenpunkts auf.
- Ein Randschnitt mit **Pointed** hat keinen Griff an der Endleiste: Seine Profiltiefe ist die skalierte Profiltiefe des vorigen Schnitts. Bei eingeschalteter Endlinie hat er auch keinen Griff an der Profilnase: Sein x der Profilnase ist x der Endlinie minus Profiltiefe.
- Das Ziehen eines Schnitts setzt ausgeschaltete, nicht bearbeitete Leitkurven auf die neuen Schnittkanten, wie eine Änderung in der Tabelle **Sections**. Nach einem Neuladen beginnt eine solche Leitkurve beim Einschalten an den gezogenen Kanten.

### Leitkurven

Eine Leitkurve ist eine ebene NURBS-Kurve in der Grundrissebene (x, y). Die **Nasenlinie** legt die Nasenleiste fest, die **Endlinie** die Endleiste, auch zwischen den Schnitten. Berechnung: [[Geometrie|Geometrie]].

| Nasenlinie | Endlinie | x der Profilnase | Profiltiefe |
| --- | --- | --- | --- |
| aus | aus | x der Schnitte, interpoliert | Profiltiefe der Schnitte, interpoliert |
| an | aus | Nasenlinie | Profiltiefe der Schnitte, interpoliert |
| aus | an | Endlinie − Profiltiefe | Profiltiefe der Schnitte, interpoliert |
| an | an | Nasenlinie | Endlinie − Nasenlinie |

Einschränkungen und Fehler:

- Der y-Bereich einer Leitkurve wird linear auf die Spannweite von Wurzel bis Rand gestreckt. Wurzel- und Randpunkt folgen Wurzel- und Randschnitt.
- x der Leitkurvenpunkte: innerhalb von ±1 100 000 mm. Das ist das x der Endleiste eines Schnitts bei x = 1 000 000 mm mit 100 000 mm Profiltiefe. Eine ausgeschaltete, unbearbeitete Endlinie liegt auf den Endleisten der Schnitte.
- Fehler: Die y-Werte der Punkte steigen von Wurzel zu Rand nicht streng an.
- Fehler: Die Kurve läuft in y zurück (geprüft an 401 Kurvenpunkten). Abhilfe: Punkte weiter auseinanderlegen oder **Control points** verwenden.
- Fehler: Ein Kontrollpunkt der Kurve liegt jenseits von x = ±1 200 000 mm (Grenze der Leitkurven plus größte Profiltiefe). Mit **Through points** schwingt die Kurve über, wenn die Punkte in y ungleichmäßig verteilt sind. Abhilfe: Punkte in y gleichmäßiger verteilen oder **Control points** verwenden.
- Fehler: Profiltiefe unter 1 mm an einer geprüften Spannweitenposition. Mit beiden Leitkurven an heißt das: Nasenlinie und Endlinie kommen sich näher als 1 mm, berühren oder kreuzen sich. Geprüft an 257 gleichmäßig verteilten Spannweitenpositionen sowie an jeder Station, jedem Kontrollpunkt und jedem Knoten der Leitkurven (die geprüften Spannweitenpositionen).
- Fehler: An einer geprüften Spannweitenposition liegt x der Profilnase, x der Endleiste oder z jenseits von ±1 200 000 mm, oder die Profiltiefe ist größer als 100 000 mm. Beispiel: Nasenlinie bei x = −1 100 000 mm, Endlinie bei x = 1 100 000 mm (Profiltiefe 2 200 000 mm).
- Mit **Wing tip** = Pointed bleibt die Profiltiefe im letzten Feld mindestens gleich der Randtiefe. Nasenlinie und Endlinie dürfen sich dann am Rand treffen.
- Stationen: jeder Profilschnitt. Mit eingeschalteter Leitkurve oder mit **Smooth** wird jedes Feld in **Spanwise stations per panel** Intervalle geteilt (Vorgabe 8, Kosinusverteilung); Vorlage Glider: 17 Stationen.
- Loft-Gitter: Stationen × (2 · N + 1) Konturpunkte vor den hinzugefügten Stationen (N = **Chordwise stations per surface**). Stationen: Felder × **Spanwise stations per panel** + 1 mit eingeschalteter Leitkurve oder mit **Smooth**, sonst eine je Schnitt. **Settings** zeigt die Anzahl (`Loft grid: … points.`).
- Über 60 000 Gitterpunkten ergänzt der Aufbau die Warnung `Large project` (Abschnitt [Projektgröße](#projektgröße)). Bis 5 000 000 Gitterpunkte verwendet der Flügel die Einstellungen wie eingegeben.
- Über 5 000 000 Gitterpunkten verwendet der Flügel weniger Intervalle je Feld, mit Warnung. Überschreitet auch ein Intervall je Feld 5 000 000 Gitterpunkte, bricht der Aufbau mit einem Fehler ab ([Prüfungen](#prüfungen)).
- Beispiele mit **Smooth**, 40 Intervallen je Feld und N = 200: 20 Schnitte: 761 Stationen, 305 161 Gitterpunkte; 1000 Schnitte: 12 Intervalle je Feld, 11 989 Stationen, 4 807 589 Gitterpunkte. Mit N = 200 überschreiten mehr als 12 468 Schnitte bei einer Station je Feld 5 000 000 Gitterpunkte; mit N = 60 (Vorgabe) ergeben 20 000 Schnitte 2 420 000 Gitterpunkte.
- Hinzugefügte Stationen: bis zu 32 in höchstens 6 Durchläufen; über 60 000 Gitterpunkten des Lofts 1 Durchlauf, denn jeder Durchlauf passt den ganzen Loft neu an. Die App setzt sie an den geprüften Spannweitenpositionen, an denen die Fläche um mehr als 0,5 mm oder 10 % der örtlichen Profiltiefe (der kleinere Wert gilt; Abstand im Raum) vom vorgesehenen Profil abweicht: je eine Station an jedem lokalen Maximum der Abweichung im Verhältnis zu dieser Toleranz. Verglichene Punkte: Profilnase, oberer Endleistenpunkt und jede k-te Tiefenstation je Profilseite, k = **Chordwise stations per surface** / 6, abgerundet (5 Tiefenstationen bei der Vorgabe 60). Auch Schränkung zwischen den Stationen fügt Stationen hinzu: Vorlage Swept flying wing, 3 Schnitte, 2 hinzugefügte Stationen.
- Behaltene Anpassung: Von den Anpassungen vor und nach jedem Durchlauf behält der Aufbau die mit der kleinsten größten Abweichung im Verhältnis zu ihrer Toleranz, bei Gleichstand die frühere. Dicht beieinander hinzugefügte Stationen können die Anpassung ausschwingen lassen. Beispiel: 2 Schnitte, Nasenlinie mit einer Beule von 4 mm Höhe und 0,06 mm Breite: 3,67 mm Abweichung ohne hinzugefügte Stationen, 18 797 mm nach 32 hinzugefügten Stationen; der Aufbau behält die Anpassung ohne hinzugefügte Stationen und zeigt die Abweichungswarnung.
- Fehler zwischen den Stationen, geprüft an den geprüften Spannweitenpositionen und bei 0,25, 0,5 und 0,75 jedes Intervalls zwischen benachbarten Stationen: Die Profiltiefe der angepassten Fläche, gemessen in der vorgesehenen Tiefenrichtung, fällt unter 0,9 mm oder kehrt sich um (die Fläche faltet sich oder schnürt sich ein); die örtliche Dicke an einer verglichenen Tiefenstation fällt unter 0 (die Fläche stülpt sich um); die örtliche Dicke an einer verglichenen Tiefenstation zwischen 1 % und 99 % der Profiltiefe beträgt höchstens 0,001 % der Profiltiefe (Dicke null).
- Die hinzugefügten Stationen und die Abweichungswarnung verwenden nur die geprüften Spannweitenpositionen, nicht die Punkte bei 0,25, 0,5 und 0,75 der Stationsintervalle.

Bedienelemente je Leitkurve (Kästen **Nose line (leading edge)** und **End line (trailing edge)**):

| Bedienelement | Verfügbar | Werte | Vorgabe | Wirkung |
| --- | --- | --- | --- | --- |
| **Use guide curve** (Leitkurve verwenden) | immer | an, aus | aus | An: Die Kurve legt die Kante fest. Eine nie bearbeitete Leitkurve startet an den aktuellen Schnittkanten; eine bearbeitete Leitkurve behält ihre Punkte. Aus: Die Kante folgt den Schnitten. Solange sie aus ist, folgt eine unbearbeitete Leitkurve den Schnittkanten; eine bearbeitete behält ihre Punkte. Bearbeitet: ein Punkt wurde verschoben (Ziehen oder Punkttabelle), hinzugefügt oder gelöscht. Leitkurven aus dem Assistenten gelten als unbearbeitet, bis die Seite neu geladen oder das Projekt aus einer Datei geöffnet wird: Aus- und erneutes Einschalten ersetzt ihre Punkte durch die Schnittkanten (**Undo** stellt sie wieder her). Nach dem Neuladen oder nach **Open** gilt eine ohne den Zustand „bearbeitet“ gespeicherte Leitkurve als bearbeitet, wenn ihre Punkte von den Schnittkanten abweichen: andere Punktanzahl oder eine Koordinate mehr als 1e-9 mm daneben. |
| **Mode** (Modus) | Leitkurve an (sonst gesperrt) | **Through points** (durch Punkte), **Control points** (Kontrollpunkte) | **Through points** | **Through points**: Die Kurve läuft durch jeden Punkt. **Control points**: Die Punkte bilden das Kontrollpolygon (gestrichelt). Die Kurve beginnt und endet im ersten und letzten Punkt und liegt sonst in der konvexen Hülle des Kontrollpolygons. |
| **Degree** (Grad) | Leitkurve an (sonst gesperrt) | 1 bis 5 | 3 | Polynomgrad; begrenzt auf Punktanzahl − 1 |
| **Add point** | Leitkurve an (sonst ausgeblendet); gesperrt bei 20 000 Punkten (Tooltip `At most 20,000 points per guide curve.`) | – | – | Fügt einen Punkt in der Mitte der größten Lücke in y ein. Tooltip: `Add a point in the widest gap`; bekäme die Kurve mehr als 500 Punkte, `Add a point in the widest gap. With … points, each change takes … and … of browser memory.` (Abschnitt [Projektgröße](#projektgröße)) |
| **Remove selected point** | Leitkurve an (sonst ausgeblendet); bedienbar, solange ein innerer Punkt ausgewählt ist | – | – | Löscht den ausgewählten inneren Punkt. Wurzel- und Randpunkt lassen sich nicht löschen. |
| **Reset to sections** | Leitkurve an (sonst ausgeblendet) | – | – | Setzt alle Punkte auf die Schnittkanten und hebt den Zustand „bearbeitet“ auf |
| Punkttabelle | Leitkurve an (sonst ausgeblendet) | x, y in mm | – | x für jeden Punkt bearbeitbar, innerhalb von ±1 100 000 mm; y für innere Punkte bearbeitbar. y von Wurzel- und Randpunkt ist schreibgeschützt. |

## Profile

![Registerkarte Airfoils: Projektprofile, Hochladen, NACA-Generator, Bibliothek](images/airfoils.png)

### Projektprofile

| Element | Wirkung |
| --- | --- |
| Listeneintrag | Kontur, Name, Punktanzahl, Quellenangabe, `unused`, wenn kein Schnitt das Profil verwendet |
| **View** | Öffnet die Vorschau; Name und Quellenangabe sind schreibgeschützt. Einzige Schaltfläche ist **Close** (Schließen). |
| **.dat** | Lädt das Profil als Selig-Datei `.dat` mit 7 Nachkommastellen herunter (mehr bei Konturen kleiner als 1, siehe [[Dateiformate|Dateiformate]]) |
| **×** | Entfernt das Profil. Gesperrt, solange ein Schnitt es verwendet. |
| **Remove unused** | Entfernt alle Profile, die kein Schnitt verwendet |

Das Hinzufügen eines Profils und das Entfernen eines Profils, das kein Schnitt verwendet, aktualisiert die Profillisten, die Größenwarnung und die automatische Speicherung, ohne den Flügel neu aufzubauen.

**Add to project** legt keinen zweiten Eintrag an, behält den vorhandenen Eintrag und verwirft den neuen Namen und die neue Quellenangabe, wenn:

- ein Projektprofil denselben Namen und dieselben Punkte hat;
- ein Projektprofil ein erzeugtes NACA-Profil mit derselben Kennung und derselben Einstellung **Closed trailing edge** ist (Name beliebig) und seine gespeicherten Punkte die der NACA-Gleichungen sind (innerhalb von 1e-9) oder den neuen Punkten gleichen (den geprüften Punkten der Vorschau).

Die Meldung lautet dann `The project already holds this airfoil as "…".` statt `Added airfoil "…".`, und der Bearbeitungsverlauf erhält keinen Schritt.

Grenzen der Projektprofile (Abschnitt [Projektgröße](#projektgröße)):

| Grenze | Registerkarte Airfoils (Hochladen, **Check pasted text**, NACA-Generator, Bibliothek) | **Open** |
| --- | --- | --- |
| 10 000 Profile | Bei 10 000 Profilen öffnet sich keine Vorschau: rote Meldung `The project holds 10,000 airfoils, the limit; "Remove unused" frees places.` | Mehr Profile: `At most 10,000 airfoils are supported (found …).` |
| 1 000 000 Profilpunkte insgesamt | Ein Profil, das die Summe über 1 000 000 brächte, öffnet keine Vorschau und wird nicht hinzugefügt: rote Meldung `With this airfoil the project airfoils hold … points; the limit is 1,000,000. "Remove unused" frees points.` | Mehr Punkte: `The airfoils hold … points together; the limit is 1,000,000.` |
| 100 000 Punkte je Profil | Fehler `too-many-points` in der Vorschau ([[Dateiformate|Dateiformate]]) | Mehr Punkte: `Airfoil … has … points; the limit is 100,000.` |

- Über 200 Profilen oder über 100 000 Profilpunkten insgesamt ergänzt der Flügelaufbau die Warnung `Large project`.
- Listen und Meldungen zeigen von einem längeren Profilnamen die ersten 200 Zeichen, gefolgt von `…`.

### Hochladen

| Eingabe | Regel |
| --- | --- |
| Dateien | `.dat`, `.txt`, `.cor`, `.xml`, `.htm`, `.html`, `.csv`. Auf die Ablagefläche ziehen oder **Choose files** verwenden. Mehrere Dateien öffnen nacheinander je eine Vorschau. Eine Datei über 20 MB wird nicht gelesen: rote Meldung `<file>: … MB; airfoil files are limited to 5,000,000 characters.` Eine Datei, die der Browser nicht lesen kann: rote Meldung `<file>: the browser could not read the file (NotReadableError).` |
| Eingefügter Text | Koordinaten in den Textbereich einfügen, dann **Check pasted text**. |
| Zeichenkodierung | UTF-8 (Unicode Transformation Format, 8 Bit); eine Datei, die kein gültiges UTF-8 ist, wird als Windows-1252 gelesen. |
| Aufbau und Prüfungen | Selig, Lednicer, Tabelle x/oben/unten, XML (Extensible Markup Language), HTML (HyperText Markup Language): siehe [[Dateiformate|Dateiformate]] |

![Vorschau beim Hochladen einer Prozenttabelle mit Dezimalkomma: Dateipunkte, NURBS-Kurve, Prüfmeldungen](images/upload-preview.png)

| Element der Vorschau | Inhalt |
| --- | --- |
| Zeichnung | Linie: NURBS-Interpolation; bei einem Fehler der Plausibilitätsprüfungen gerade Strecken durch die Dateipunkte. Punkte: Dateipunkte (**Show data points**, Vorgabe an). Rote Kreise: Ort eines gemeldeten Problems. Verschieben und Zoomen wie im Grundriss-Editor. |
| **Name** | Aus der Namenszeile der Datei, sonst der Dateiname. Bearbeitbar. |
| **Source / attribution** (Quelle / Urheber) | Wird in der Projektdatei gespeichert. Vorbelegt für Namen, die mit `HS` und einem Leerzeichen oder Bindestrich beginnen (`HS 3.4`, `HS-1.4`): `Hartmut Siegmann, www.aerodesign.de`. Vorbelegt für Namen, die mit `MH`, einem optionalen Leerzeichen oder Bindestrich und einer Ziffer beginnen (`MH45`, `MH 60`): `Martin Hepperle, www.mh-aerotools.de`. Groß- und Kleinschreibung spielt keine Rolle. Vorbelegt für eine mitgelieferte Bibliotheksdatei mit ihrem Autor aus `index.json`. |
| Formatzeile | Erkanntes Format und Punktanzahl |
| Meldungen | **Error** (Fehler): verhindert das Hinzufügen. **Warning** (Warnung): Hinzufügen möglich. **Info**: Fakten, z. B. Dicke, Wölbung und Endleistendicke in % der Profiltiefe oder die Anzahl entfernter Punkte, die näher als das 1e-9-Fache der Profiltiefe am vorherigen Punkt liegen. Über 5000 Punkten: Warnung `… points (warning above 5,000): the checks and the first build of a wing that uses the airfoil take ….` Eine Profilseite, die an mehr als 50 Punkten in x zurückläuft: Fehler `The upper surface runs back in x at … points; the limit is 50.` (`lower` entsprechend). Nach bestandenen Plausibilitätsprüfungen weist die Vorschau zusätzlich eine NURBS-Kurve ab, die sich selbst kreuzt oder in x zurückläuft, und Punkte, an denen die NURBS-Interpolation scheitert (`The NURBS interpolation through the points failed (…).`). Alle drei sind Fehler `curve-shape` ([[Dateiformate|Dateiformate]]). |
| **Add to project** | Fügt das Profil hinzu. Gesperrt und mit **Cannot add (errors)** beschriftet, solange ein Fehler vorliegt. |

### NACA-Generator

| Bedienelement | Werte | Wirkung |
| --- | --- | --- |
| Eingabefeld für die Kennung | 4 oder 5 Ziffern, Präfix `NACA` optional (`2412`, `NACA 23012`) | Profilkennung |
| **Closed trailing edge** (geschlossene Endleiste) | an, aus (Vorgabe aus) | Aus: Standard-Dickengleichung, offene Endleiste. An: Koeffizient −0,1036 statt −0,1015, geschlossene Endleiste. |
| **Preview** | – | Öffnet die Vorschau |

| Reihe | Gültige Kennung |
| --- | --- |
| 4-stellig | Ziffern 3–4 (Dicke) größer als 00; Ziffern 1 und 2 beide 0 oder beide ungleich 0 |
| 5-stellig, Standard | Ziffer 1: 1–9; Ziffer 2: 1–5; Ziffer 3: 0; Ziffern 4–5 größer als 00 |
| 5-stellig, S-Schlag | Ziffer 1: 1–9; Ziffer 2: 2–5; Ziffer 3: 1; Ziffern 4–5 größer als 00 |

- Erzeugte Profile haben 161 Punkte (81 je Seite, Kosinusverteilung) und den Namen `NACA <Kennung>`.
- Offene und geschlossene Variante einer Kennung tragen denselben Namen. Zur Unterscheidung in der Schnittliste eine davon im Eingabefeld **Name** der Vorschau umbenennen.

### Bibliothek

- **Filter library** durchsucht Name, Kategorie und Verwendungstext.
- Die Bibliothek enthält 17 erzeugte NACA-Profile und 6 mitgelieferte Koordinatendateien (`public/airfoils/index.json`, in die App übersetzt, sodass die Bibliothek keinen Netzzugang braucht). Die Liste zeigt zuerst die NACA-Profile, dann die Dateien in der Reihenfolge des Index.
- Text unter jedem Namen: NACA-Profil: Kategorie, Verwendung, `generated`. Mitgelieferte Datei: Kategorie, Verwendungstext, Autor, Lizenzkennung.
- Jeder Eintrag: **Preview** öffnet die Vorschau. NACA-Einträge folgen dem Kontrollkästchen **Closed trailing edge** des NACA-Generators. Eine mitgelieferte Datei wird von `airfoils/<file>` unter der eigenen Adresse der App geladen.
- **Add to project** speichert bei einer mitgelieferten Datei das Feld **Source / attribution** (vorbelegt mit dem Autor), die Lizenzkennung, die Quelladresse und die Adresse der Bedingungen im Projektprofil (Objekt `source`, [[Dateiformate|Dateiformate]]).
- Die Verwendungstexte erscheinen in der App auf Englisch.

NACA-Profile:

| Kennung | Kategorie | Verwendung |
| --- | --- | --- |
| 0006 | Symmetric (symmetrisch) | Dünne Leitwerke |
| 0008 | Symmetric | Leitwerke |
| 0009 | Symmetric | Leitwerke, Seitenflossen |
| 0010 | Symmetric | Leitwerke, Randprofile von Nurflügeln |
| 0012 | Symmetric | Kunstflugflügel, Seitenruder |
| 0015 | Symmetric | Dicke Kunstflugflügel |
| 2408 | Cambered (gewölbt) | Dünne Sportflügel |
| 2410 | Cambered | Sportflügel, Randprofile |
| 2412 | Cambered | Trainer und Sportmodelle |
| 2415 | Cambered | Langsame Trainer |
| 4412 | Cambered | Langsamflieger, hoher Auftrieb |
| 4415 | Cambered | Langsamflieger, Scale-Modelle |
| 6409 | Cambered | Modelle mit hohem Auftrieb und geringer Geschwindigkeit |
| 23012 | Cambered | Scale- und Sportmodelle |
| 23015 | Cambered | Dicke Scale-Flügel |
| 23112 | Reflex (S-Schlag) | 5-stelliges S-Schlag-Profil (Nurflügel-Versuche) |
| 24112 | Reflex | 5-stelliges S-Schlag-Profil |

Mitgelieferte Dateien (Verwendungstext gekürzt; Dicke aus dem Verwendungstext):

| Name | Kategorie | Verwendung | Dicke | Punkte | Quelle | Lizenzkennung |
| --- | --- | --- | --- | --- | --- | --- |
| Clark Y | Cambered | Flugmodelle vom Freiflug-Segelflugmodell bis zum ferngesteuerten Scale-Modell | 11,7 % der Profiltiefe | 33 | NACA Report No. 502, Table I; Profil von Virginius E. Clark | `public-domain` |
| NACA 8-H-12 | Reflex | Hubschrauber-Rotorblätter; manntragende schwanzlose Segelflugzeuge Kasper Bekas und Brochocki BKB-1; Verwendung an Modellen in den geprüften Quellen nicht belegt | 12,0 % der Profiltiefe | 51 | NACA Technical Note 1998, Table I | `public-domain` |
| NACA M-6 | Reflex | S-Schlag-Profil, längsstabil; Kandidat für Nurflügel | 12,0 % der Profiltiefe | 35 | NACA Report No. 221, Table XXIX | `public-domain` |
| RAF 34 | Cambered | Manntragende Flugzeuge Comper Streak und, abgewandelt, de Havilland DH-98 Mosquito; Scale-Modelle solcher Flugzeuge | 12,6 % der Profiltiefe | 33 | Tabelle des Royal Aircraft Establishment (RAE) in NACA Report No. 286 | `public-domain` |
| S9104 | Cambered | Profil für hohe Zuladung und hohen Auftrieb | 12,1 % der Profiltiefe | 81 | Michael Selig, University of Illinois Urbana-Champaign | `CC-BY-4.0` |
| USA 35B | Cambered | Manntragende Flugzeuge Piper J-3 Cub und PA-18 Super Cub; Scale-Modelle dieser Flugzeuge | 11,6 % der Profiltiefe | 33 | NACA Report No. 233, Table XXXVI | `public-domain` |

- Quelle, Rechtsgrundlage, Bedingungen und Text der Quellenangabe je Datei: [NOTICE.md](https://github.com/subtilitas/Wingdesigner/blob/main/public/airfoils/NOTICE.md).
- Clark Y, NACA 8-H-12, NACA M-6, RAF 34 und USA 35B: in den Vereinigten Staaten gemeinfrei (public domain). Ihr Status außerhalb der Vereinigten Staaten ist nicht geklärt.
- S9104: Lizenz Creative Commons Attribution 4.0 International (CC BY 4.0). Die Projektdatei behält die Quellenangabe. Der `.dat`-Download und die 3D-Modelldateien aus [Export](#export) enthalten keine; wer eine solche mit S9104 erstellte Datei weitergibt, fügt den Text der Quellenangabe aus NOTICE.md hinzu.
- RAF 34: 7 Werte des Quellscans sind unsicher, um bis zu 0,20 % der Profiltiefe (0,40 mm bei 200 mm Profiltiefe). NOTICE.md führt sie auf.
- Clark Y und USA 35B behalten die veröffentlichte Basislinie: Die Profilnase liegt 3,50 % bzw. 2,76 % der Profiltiefe über der x-Achse. Die Vorschau zeigt die Warnung `The line from the leading edge to the trailing edge is inclined by -1.97 degrees; …` (USA 35B: -1.51). Die Schränkung bezieht sich auf die x-Achse der Datei: Bei gleicher Schränkung steht die Profilsehne von Clark Y um 1,97° und die von USA 35B um 1,51° stärker Nase hoch als die eines Profils mit der Sehne auf der x-Achse.
- Nicht mitgeliefert: Daten unter Share-Alike-Lizenz (JX-Bibliothek, Creative Commons Attribution-ShareAlike 4.0), Copyleft-Daten (Mark Drela, GNU General Public License 2.0 oder neuer) und die PROFOIL-Testprofile. Entscheidungen mit Begründung: [RECORD.md](https://github.com/subtilitas/Wingdesigner/blob/main/RECORD.md).

### Externe Quellen

Der Kasten **More airfoils (external, not bundled)** verlinkt 3 Sammlungen. Die App liefert keine Dateien daraus mit; die mitgelieferte Datei S9104 stammt von der eigenen Seite des Konstrukteurs, nicht aus der Datenbank der University of Illinois Urbana-Champaign (UIUC). Datei dort herunterladen, dann im Abschnitt **Upload** (Hochladen) einlesen. Bedingungen und Zitate: [[Profilquellen|Profilquellen]].

| Link | Inhalt | Bedingungen (Kurzfassung) |
| --- | --- | --- |
| aerodesign.de - Hartmut Siegmann | HS-Profile und Kataloge für Brettnurflügel, Pfeilnurflügel und Segelflugmodelle | Privat, im Verein, kleingewerblich und wissenschaftlich mit Namen und Quelle; Großserien und industrielle Anwendungen brauchen eine schriftliche Nutzungsvereinbarung; Weiterverbreitung durch Dritte zum Teil eingeschränkt |
| MH-AeroTools - Martin Hepperle | MH-Profile, z. B. MH 45 und MH 60 für Nurflügel, MH 32 für Segelflugmodelle | Persönlicher Gebrauch; Veröffentlichungen nennen die Quelle; eine Neuzusammenstellung darf nicht über den Herstellungskosten verkauft werden |
| UIUC Airfoil Coordinates Database (University of Illinois Urbana-Champaign) | Etwa 1650 Profile im Selig-Format (Anzahl laut Koordinatenseite) | Keine Lizenz für die Koordinatendateien angegeben; es gelten die Rechte des jeweiligen Konstrukteurs |

- Die Hinweise in der App lauten „About 1,600 airfoils“ (UIUC) und „commercial use needs written permission“ (aerodesign.de). Es gelten die zitierten Bedingungen in [[Profilquellen|Profilquellen]].

## Einstellungen

![Registerkarte Settings: Gruppe Geometry mit Wing tip, Gruppe Resolution](images/settings.png)

| Gruppe | Einstellung | Werte | Vorgabe | Wirkung |
| --- | --- | --- | --- | --- |
| Geometry | **Project name** (Projektname) | Text | Name der Vorlage | Name in der Projektdatei; Grundlage der Dateinamen von **Save** und **Export**. `.dat`-Downloads verwenden den Profilnamen. Ein Name über 200 Zeichen ergänzt `a name of … characters (warning above 200)` in der Warnung `Large project`, sobald der Name übernommen ist; ein kürzerer Name entfernt es. |
| Geometry | **Spanwise interpolation** (Interpolation in Spannweitenrichtung) | **Linear between sections (straight panels)** (linear, gerade Felder), **Smooth (natural cubic spline through sections)** (glatt, natürlicher kubischer Spline durch die Schnitte) | Linear | Übergang der Schnittwerte entlang der Spannweite. Siehe Liste unten. |
| Geometry | **Twist pivot (fraction of chord)** (Drehpunkt der Schränkung) | 0 bis 1, Schritt 0,05 | 0,25 | Punkt auf der Profilsehne, um den die Schränkung dreht |
| Geometry | **Trailing edge** (Endleiste) | **As in the airfoil files** (wie in den Profildateien), **Closed (sharp)** (geschlossen, scharf), **Fixed thickness in mm** (feste Dicke in mm) | Fixed thickness (Assistent, Beispielflügel); As in the airfoil files für Projektdateien ohne diese Einstellung | Endleistendicke jeder Station |
| Geometry | **Wing tip** (Flügelende) | **Flat (cut at the tip section)** (flach, am Randschnitt abgeschnitten), **Pointed (tip profile scaled down)** (spitz, Randprofil verkleinert) | Flat; Assistent: Eingabefeld **Tip** | Flat: Der Flügel endet am Randschnitt. Pointed: siehe Liste unten. |
| Geometry | **Tip profile scale 1 : N of the previous section chord** (Maßstab des Randprofils) | N = 100 bis 1000, Schritt 50 | 200 | Nur sichtbar mit **Pointed** |
| Geometry | **Trailing-edge thickness (mm)** (Endleistendicke) | ≥ 0, Schritt 0,1 | Assistent: 0,2 % der Wurzeltiefe, mindestens 0,3; Beispielflügel: 0,5; Projektdatei ohne den Wert: 0,4 | Nur sichtbar mit **Fixed thickness in mm** |
| Resolution | **Chordwise stations per surface** (Stationen je Profilseite) | 16 bis 200, Schritt 4 | 60 | Neuabtastung der Profile: N Stationen ergeben 2 · N + 1 Punkte je Kontur (60 → 121) |
| Resolution | **Spanwise stations per panel with guides or smooth mode** (Stationen je Feld) | 3 bis 40 | 8 | Intervalle je Feld, Kosinusverteilung; nur wirksam mit eingeschalteter Leitkurve oder mit Smooth. Weniger Intervalle erst über 5 000 000 Gitterpunkten des Lofts (Abschnitt [Leitkurven](#leitkurven)). |
| Resolution | **Profile parametrization** (Parametrisierung der Profile) | **Centripetal (recommended)** (zentripetal), **Chord length** (Sehnenlänge), **Uniform** (gleichabständig) | Centripetal | Parameterverteilung der NURBS-Interpolation der Profile, im Flügelaufbau und in der Profilvorschau |
| Display | **Show mirrored half (y < 0)** (gespiegelte Hälfte zeigen) | an, aus | an | Nur 3D-Ansicht. Checks, Statusleiste und Assistent nennen immer beide Hälften. Wird im Projekt gespeichert. |
| Display | **Show NURBS control net** (NURBS-Kontrollnetz zeigen) | an, aus | aus | Nur 3D-Ansicht; wird nicht gespeichert. Über 100 000 Netzsegmenten zeichnet die Ansicht jede k-te Kontrolllinie in jeder Richtung, erste und letzte eingeschlossen. Überschreiten schon die erste und letzte Linie 100 000 Segmente (z. B. 33 × 151 000 Kontrollpunkte), verläuft jede gezeichnete Linie zudem nur durch jeden k-ten Kontrollpunkt, erster und letzter eingeschlossen. |
| Display | **Show section outlines** (Schnittkonturen zeigen) | an, aus | an | Nur 3D-Ansicht; wird nicht gespeichert. Über 100 000 Kontursegmenten (2 · N je Schnitt, 2 · N + 1 bei offener Endleiste) zeichnet die Ansicht jede k-te Kontur, Wurzel und Rand eingeschlossen; der ausgewählte Schnitt wird immer gezeichnet. |

Unter **Spanwise stations per panel** nennt ein Hinweis die Gitterpunkte des Lofts bei den aktuellen Einstellungen (Abschnitt [Leitkurven](#leitkurven)), z. B. Vorlage Glider: `Loft grid: 2,057 points.`

- Nach einer Verringerung über 5 000 000 Gitterpunkten ergänzt der Hinweis `, … spanwise stations per panel instead of …`.
- Über 60 000 Gitterpunkten erscheint der Hinweis in Warnfarbe und ergänzt die Schätzung aus Abschnitt [Projektgröße](#projektgröße): `Loft grid: … points; above 60,000, each change takes … and … of browser memory.`

Interpolation in Spannweitenrichtung:

- **Linear** ohne Leitkurve: Stationen an den Schnitten und hinzugefügte Stationen (Abschnitt [Leitkurven](#leitkurven)); gerade Linien zwischen den Stationen (Grad 1 in Spannweitenrichtung).
- **Linear** mit eingeschalteter Leitkurve: **Spanwise stations per panel** Intervalle je Feld; Grad 3 innerhalb jedes Felds, Knick an jedem Schnitt möglich. Senkt die Gittergrenze des Lofts die Intervalle je Feld auf 2 oder 1, ist der Grad 2 oder 1 (z. B. 4200 Schnitte mit 200 **Chordwise stations per surface**: 2 Intervalle, Grad 2).
- **Smooth**: Die Schnittwerte folgen einem natürlichen kubischen Spline durch alle Schnitte; **Spanwise stations per panel** Intervalle je Feld (Vorgabe 8); Grad 3 in Spannweitenrichtung.
- Fehler bei **Smooth**: Ein interpolierter Wert liegt um mehr als das 2-Fache des Bereichs seiner Schnittwerte außerhalb dieses Bereichs. Geprüfte Werte: x der Profilnase (keine Leitkurve an), Profiltiefe (nicht beide Leitkurven an), z, Schränkung und die Höhe jedes neu abgetasteten Konturpunkts außer den 2 Endleistenpunkten. Geprüft an den geprüften Spannweitenpositionen ([Leitkurven](#leitkurven)). Typische Ursache: ungleichmäßig verteilte Schnitte.
- Bei 2 Schnitten ergeben beide dieselben Werte für x, z, Profiltiefe und Schränkung.
- Die Flächen unterscheiden sich, wo sich Profil oder Schränkung entlang der Spannweite ändern. Eine gleichzeitige Änderung der Profiltiefe vergrößert den Unterschied.
- Ab 3 Schnitten unterscheiden sich die Flächen auch dort, wo x, z, Profiltiefe oder Schränkung an einem Schnitt ihre Steigung ändern. Beispiel: Vorlage Sport mit 3 Schnitten, mittlere Profiltiefe 150 mm statt 192 mm, ein Profil, keine Schränkung: 8,08 mm.
- Ein Profil, keine Schränkung und eine von Wurzel bis Rand linear veränderte Profiltiefe ergeben keinen Unterschied.
- Größter Abstand der 2 Flächen bei gleichen Flächenparametern, Vorlagen des Assistenten: Swept flying wing 0,56 mm, Sport 0,34 mm, Glider 0,20 mm, Trainer 0,00 mm, Plank 0,00 mm, Tail surface 0,00 mm.
- Berechnung: [[Geometrie|Geometrie]].

Spitzes Flügelende (**Wing tip** = Pointed):

- Randtiefe = max(c_prev / N, 1 mm). c_prev ist die verwendete Profiltiefe am vorletzten Schnitt.
- Die eingegebene Randtiefe wird nicht verwendet.
- Im letzten Feld bleibt die Profiltiefe mindestens gleich der Randtiefe. Zusammenlaufende Leitkurven enden im verkleinerten Randprofil.
- Mit eingeschalteter Nasenlinie und Endlinie legt ihr Abstand am Rand die Randtiefe fest, wenn er größer als die verkleinerte Randtiefe ist. Ist er mehr als 0,5 mm größer, erscheint eine Warnung.
- Vorlage Glider mit **Tip** = Pointed: Randtiefe 1,00 mm (Untergrenze 1 mm), 22 Stationen (17 + 5 hinzugefügt), größte Abweichung an den geprüften Spannweitenpositionen 0,263 mm, keine Warnung. Auch die übrigen Vorlagen des Assistenten mit **Tip** = Pointed ergeben keine Warnung.
- Innerhalb von 2 mm vor einem spitzen elliptischen Flügelende (Vorlagen des Assistenten) weichen x von Nasen- und Endleiste der Fläche höchstens 0,031 mm vom vorgesehenen Grundriss ab (2001 Spannweitenpositionen); die übrigen Konturpunkte dort sind nicht gemessen. Die Abweichungswarnung erfasst diese Positionen nicht.

Regeln für die Endleiste:

- Feste Dicke größer als 5 % der örtlichen Profiltiefe: an dieser Station auf 5 % begrenzt. Eine Warnung nennt die Anzahl der Stationen. Stationen im letzten Feld eines spitzen Flügelendes werden ohne Warnung begrenzt.
- Gemischte Endleisten, Bedingung: Nicht jede Station ist geschlossen, und mindestens eine Station hat eine Endleistendicke unter 0,01 mm. Beispiele: **As in the airfoil files** mit Profilen, die an einigen Stationen geschlossen und an anderen offen sind; **Fixed thickness in mm** über 0 und unter 0,01 mm.
- Gemischte Endleisten, Wirkung: Diese Stationen werden auf 0,01 mm geöffnet, mit Warnung. Die Warnung nennt `closed on some stations and open on others` auch dann, wenn keine Station geschlossen ist.
- Fehler: Die Einstellung zieht die Oberseite unter die Unterseite. Bedingung: **Closed** oder **Fixed thickness** bei einem Profil, das innen dünner ist als seine Endleistendicke.
- Fehler: Die Einstellung lässt Oberseite und Unterseite sich berühren. Bedingung: **Closed** oder **Fixed thickness**, Dicke höchstens 0,001 % der Profiltiefe zwischen 1 % und 99 % der Profiltiefe.

Einfluss der Auflösung auf Rechenzeit und Größe der STEP-Datei (STEP: Standard for the Exchange of Product model data):

| Fall | Stationen je Profilseite | Aufbau (Profile im Cache) | STEP-Export | STEP-Größe |
| --- | --- | --- | --- | --- |
| Vorlage Glider, elliptische Leitkurven, 17 Stationen in Spannweitenrichtung, beide Hälften | 60 | 36 ms | 6 ms | 445 KB |
| Vorlage Glider, elliptische Leitkurven, 17 Stationen in Spannweitenrichtung, beide Hälften | 200 | 89 ms | 19 ms | 1398 KB |

- Mittelwert aus 10 Läufen nach 2 Aufwärmläufen (STEP-Export: 3 Läufe); Node.js 24.21, Intel Xeon x86-64, 2,10 GHz, 4 Kerne, Load Average 3,3 (andere Prozesse liefen); 29.09.2026.
- 1 KB = 1024 Byte.
- Große Projekte im Browser: Abschnitt [Projektgröße](#projektgröße).
- Vollständige Messbedingungen und weitere Fälle: [[Entwicklung|Entwicklung]], Abschnitt Build- und Exportzeiten.
- Smartphones: nicht gemessen.

## Prüfungen

![Registerkarte Checks mit den Grundrisskennwerten der Vorlage Glider](images/checks.png)

| Zeile | Inhalt |
| --- | --- |
| Liste der Fehler und Warnungen | Alle Fehler und Warnungen des Flügels, sonst `No errors or warnings.` |
| Span (Spannweite) | 2 × y des Randschnitts, in mm |
| Wing area (Flügelfläche) | beide Hälften, in dm² |
| Aspect ratio (Streckung) | Spannweite² / Flügelfläche |
| Mean aerodynamic chord (MAC) (mittlere aerodynamische Flügeltiefe) | mm |
| MAC position (Lage der MAC) | Spannweitenposition y der MAC und x ihrer Profilnase |
| 25 % MAC (geometric reference) (geometrischer Bezugspunkt) | x des Punkts bei 25 % der MAC |
| Root / tip chord (Wurzel- / Randtiefe) | mm |
| Surface (Fläche) | NURBS-Grad (Tiefenrichtung × Spannweitenrichtung) und Anzahl der Kontrollpunkte |
| Trailing edge (Endleiste) | `closed` (geschlossen) oder `open` (offen) |

- Flügelfläche, MAC und Lage der MAC: 5-Punkt-Gauß-Legendre-Quadratur des vorgesehenen Grundrisses (Profiltiefe und Nasenleiste über y) in jedem Intervall zwischen benachbarten Teilungspunkten: Wurzel, Rand, Schnitte und jeder Knoten und Kontrollpunkt einer eingeschalteten Leitkurve. Exakt für gerade Felder sowie für **Smooth** mit flachem Flügelende und ohne Leitkurven.
- Mit Leitkurven, Quadraturfehler der Flügelfläche gegenüber der Mittelpunktregel mit 200 000 Intervallen: −2,2 × 10⁻¹⁰ % (Vorlage Glider), −2,1 × 10⁻⁹ % (Vorlage Glider mit spitzem Flügelende). Weitere Werte: [[Geometrie|Geometrie]].
- Wurzelschnitt nicht bei y = 0: Die Lücke zwischen den Hälften zählt zur Spannweite, nicht zur Flügelfläche.
- Der 25-%-MAC-Punkt ist ein geometrischer Bezugspunkt. Er ist keine Berechnung von Neutralpunkt oder Schwerpunkt.

| Meldung | Schweregrad | Bedingung |
| --- | --- | --- |
| Airfoil "…": … | Fehler | das Profil besteht die Plausibilitätsprüfungen nicht ([[Dateiformate|Dateiformate]]), z. B. in einer geöffneten Projektdatei. Mit **Profile parametrization** **Chord length** oder **Uniform** endet jede Meldung `Airfoil "…"` mit `Settings > Profile parametrization "centripetal" follows the points more closely.` |
| Airfoil "…": the NURBS interpolation failed (…). | Fehler | die NURBS-Interpolation des Profils schlägt fehl |
| Airfoil "…": the NURBS curve through the points crosses itself near x = … % chord; … | Fehler | die Kurve durch die Profilpunkte kreuzt sich selbst. Die Kreuzung teilt die Kontur in 2 Teile; der Teil mit der kleineren Diagonale des Hüllrechtecks hat eine mittlere Breite (Fläche / Diagonale des Hüllrechtecks) über 0,05 % der Profiltiefe. Ein Profil, das bei einer Profiltiefe über 200 mm verwendet wird, scheitert auch, wenn diese Breite bei seiner größten Profiltiefe 0,1 mm übersteigt; die Meldung lautet dann `…; the loop is … mm wide at … mm chord, above 0.1 mm. …` |
| Airfoil "…": the surface runs back in x by … % chord near x = … % chord; … | Fehler | die Kurve durch die Profilpunkte läuft um mehr als 0,01 % der Profiltiefe in x zurück. Im Einlesetest mit 1964 realen Profildateien weist diese Prüfung mit **Centripetal** 4 Dateien ab, mit **Chord length** 12 und mit **Uniform** 82 ([[Profilquellen|Profilquellen]], Abschnitt Einlesetest). |
| Airfoil "…": The upper surface runs back in x at … points; the limit is 50. (ebenso `lower`) | Fehler | eine Seite des Profils läuft an mehr als 50 Punkten in x zurück (Prüfung `folds`, [[Dateiformate|Dateiformate]]) |
| Nose line: … / End line: … | Fehler | y der Leitkurvenpunkte steigt nicht streng an, oder die Kurve läuft in y zurück; Modus Durchgangspunkte: `Points … and … at y = … mm and y = … mm lie too close together for the curve parameters; move them apart.`, wenn zwei normierte y-Werte höchstens 4 Einheiten der letzten Stelle des größeren Werts oder höchstens 2^-1021 (etwa 4,5e-308) auseinanderliegen; `the curve fit is singular; move the points further apart in y or use control-point mode.`, wenn die Interpolation Punkte, deren normierte y-Werte enger liegen, als sie auflöst, nicht lösen kann, z. B. 1e-300 der Spannweite |
| Nose line: the curve through the points reaches x = … mm, beyond ±1200000 mm; space the points more evenly in y or use control-point mode. (ebenso End line) | Fehler | ein Kontrollpunkt der Leitkurve liegt jenseits von x = ±1 200 000 mm |
| Section values give non-finite coordinates at y = … mm; … | Fehler | x der Profilnase, Profiltiefe, z oder Schränkung einer geprüften Spannweitenposition ergibt eine nicht endliche Koordinate, z. B. bei **Smooth** mit 3 Schnitten bei y = 0, 1e-300 und 2e-300 mm und Schränkungen 0°, 90° und 0°. **Open** und die Tabelle **Sections** akzeptieren solche Positionen; die Tabelle **Sections** weist nur ein y ab, das dem eines anderen Schnitts gleicht. |
| At y = … mm the wing leaves the project limits (leading-edge x … mm, z … mm, chord … mm; limits ±1200000 mm and 100000 mm chord). Check the guide curves, or use linear interpolation. | Fehler | an einer geprüften Spannweitenposition: x der Profilnase, x der Endleiste oder z jenseits von ±1 200 000 mm, oder Profiltiefe über 100 000 mm |
| Smooth spanwise interpolation overshoots at y = … mm: … is …, while the sections range from … to … . The sections are unevenly spaced (smallest gap … mm). … | Fehler | **Smooth**: ein interpolierter Wert (x der Profilnase, Profiltiefe, z, Schränkung oder Höhe eines Konturpunkts) liegt um mehr als das 2-Fache des Bereichs der Schnittwerte außerhalb dieses Bereichs |
| The blended profile has negative thickness at y = … mm, x = … % chord (… % chord); … | Fehler | **Smooth**: Das interpolierte Profil an einer geprüften Spannweitenposition hat an einer Tiefenstation negative Dicke (Überschwingen zwischen ungleichmäßig verteilten Schnitten). Hinter 99 % der Profiltiefe gelten Kreuzungen bis 0,01 % der Profiltiefe, höchstens 0,1 mm, als Dicke null. |
| The resampled profile has negative thickness at y = … mm, x = … % chord (… % chord): … | Fehler | **Linear**: Ober- und Unterseite eines Profils kreuzen sich an einer Tiefenstation. Hinter 99 % der Profiltiefe gelten Kreuzungen bis 0,01 % der Profiltiefe, höchstens 0,1 mm, als Dicke null. |
| The trailing-edge setting pulls the upper surface below the lower surface at y = … mm (… % chord); … | Fehler | **Closed** oder **Fixed thickness** bei einem Profil, das innen dünner ist als seine Endleistendicke |
| Upper and lower surface of the blended profile touch at y = … mm, x = … % chord (thickness … % chord); … | Fehler | **As in the airfoil files**: Dicke höchstens 0,001 % der Profiltiefe zwischen 1 % und 99 % der Profiltiefe |
| The trailing-edge setting makes upper and lower surface touch at y = … mm, x = … % chord (thickness … % chord); … | Fehler | **Closed** oder **Fixed thickness**: Dicke höchstens 0,001 % der Profiltiefe zwischen 1 % und 99 % der Profiltiefe |
| Chord drops to … mm at y = … mm; nose line and end line must not touch or cross. | Fehler | Profiltiefe unter 1 mm an einer geprüften Spannweitenposition (relative Rundungsfehler bis 1e-9 zählen nicht, sodass Schnitte mit genau 1 mm aufgebaut werden). Ohne beide Leitkurven ist die Profiltiefe die Überblendung der Schnitttiefen, und die Meldung endet mit `the smooth blend of the section chords falls below the minimum of 1 mm; use linear interpolation or add sections.` Flacher Rand mit dem Minimum am Rand und über −0,01 mm: Die Meldung ergänzt `For a tip that ends in a point, set Settings > Wing tip to Pointed.` |
| The fitted surface has non-finite coordinates; … | Fehler | eine Koordinate eines Kontrollpunkts der angepassten Fläche ist keine endliche Zahl |
| The fitted surface turns inside out between stations at y = … mm (local thickness … % chord): … | Fehler | örtliche Dicke der angepassten Fläche unter 0 an einer verglichenen Tiefenstation; geprüft an den geprüften Spannweitenpositionen und bei 0,25, 0,5 und 0,75 jedes Stationsintervalls |
| The fitted surface has zero thickness between stations at y = … mm (local thickness … % chord): … | Fehler | örtliche Dicke der angepassten Fläche höchstens 0,001 % der Profiltiefe an einer verglichenen Tiefenstation zwischen 1 % und 99 % der Profiltiefe; dieselben Positionen |
| The fitted surface folds or narrows between stations at y = … mm (chord … mm along the intended chord direction, minimum 1 mm): … | Fehler | Profiltiefe der angepassten Fläche nach den hinzugefügten Stationen unter 0,9 mm oder in Gegenrichtung; dieselben Positionen |
| The loft surface crosses itself at y = … mm near x = … mm: … | Fehler | eine Flächenzeile kreuzt sich zwischen den neu abgetasteten Punkten selbst; mittlere Breite des kleineren Teils wie bei Profilen, über 0,05 % der örtlichen Profiltiefe oder über 0,1 mm, je nachdem, was kleiner ist. Geprüfte Zeilen: jeder Schnitt, die Mitte zwischen 2 Schnitten und die Mitte zwischen 2 benachbarten Stationen in den 64 breitesten Stationsintervallen. |
| The loft grid needs … points with one station per panel (… sections, … chord samples); the limit is 5,000,000. Reduce the chord samples or the sections. | Fehler | Schnitte × (2 · **Chordwise stations per surface** + 1) über 5 000 000, z. B. mehr als 12 468 Schnitte bei 200 Tiefenstationen ([Leitkurven](#leitkurven)) |
| Internal error: … | Fehler | Ausnahme im Flügelaufbau (Programmfehler) |
| Large project: … (warning above …). Each change takes … and … of browser memory. | Warnung | eine Projektgröße über ihrer Warnschwelle; die Meldung nennt jede solche Größe, z. B. `1,000 sections (warning above 200) and 121,000 loft grid points (warning above 60,000)`. Dauert der erste Aufbau mindestens 1 s länger als eine Änderung, endet die Meldung mit `Opening it or changing the profile parametrization takes ….` Schwellen und Schätzung: Abschnitt [Projektgröße](#projektgröße). |
| Spanwise stations per panel reduced from … to …: … sections with … chord samples keep the loft within 5,000,000 grid points. | Warnung | Loft-Gitter über 5 000 000 Punkten mit dem eingestellten Wert **Spanwise stations per panel**, mit eingeschalteter Leitkurve oder mit **Smooth** ([Leitkurven](#leitkurven)) |
| Pointed tip: nose line and end line end … mm apart, so the tip chord is … mm instead of … mm; … | Warnung | spitzes Flügelende, beide Leitkurven an, Abstand am Rand mehr als 0,5 mm größer als die verkleinerte Randtiefe |
| Trailing-edge thickness … mm exceeds 5 % of the chord at … station(s); it is limited to 5 % there. | Warnung | feste Dicke größer als 5 % der örtlichen Profiltiefe |
| The trailing edge is closed on some stations and open on others; … station(s) were opened to 0.01 mm. | Warnung | nicht jede Station geschlossen, und mindestens eine Station mit einer Endleistendicke unter 0,01 mm |
| The loft deviates up to … mm from the intended surface at y = … mm after … added station(s); raise the spanwise stations per panel. | Warnung | Abweichung vom vorgesehenen Profil (Profilnase, oberer Endleistenpunkt, jede k-te Tiefenstation je Profilseite, k = **Chordwise stations per surface** / 6, abgerundet: 5 bei 60) über 0,5 mm (oder 10 % der örtlichen Profiltiefe, wenn kleiner) an einer geprüften Spannweitenposition bleibt nach den hinzugefügten Stationen (höchstens 32 in 6 Durchläufen, 1 Durchlauf über 60 000 Gitterpunkten des Lofts). Die Meldung nennt die Anpassung, die der Aufbau behält (die kleinste größte Abweichung im Verhältnis zur Toleranz), und deren hinzugefügte Stationen ([Leitkurven](#leitkurven)). |

- Geprüfte Spannweitenpositionen: Abschnitt [Leitkurven](#leitkurven).
- Meldungen, die `Settings > Chord samples` nennen, meinen **Settings** > **Chordwise stations per surface**.
- Meldungen, die `"as in file"` nennen, meinen **Trailing edge** = **As in the airfoil files**.

Aufbaufehler, die die Bedienelemente und **Open** verhindern (nur über Programmcode erreichbar). Der Aufbau meldet die Grenzen von **Open** für Schnitte und Leitkurven ebenfalls als Fehler:

| Meldung | Bedingung | Verhindert durch |
| --- | --- | --- |
| At least 2 sections are required. | weniger als 2 Schnitte | **×** ist bei 2 Schnitten gesperrt; **Open** weist die Datei ab |
| Section …: chord must be at most 100000 mm. / Section …: x must be within ±1000000 mm. (ebenso y, z) / Section …: twist must be within ±360 degrees. | Profiltiefe über 100 000 mm; x, y oder z außerhalb von ±1 000 000 mm; Schränkung außerhalb von ±360° | die Tabelle **Sections** begrenzt eingegebene Werte auf diese Grenzen; Ziehen im Grundriss bleibt innerhalb der Grenzen; **Open** weist die Datei ab |
| At most 20,000 sections are supported (found …). | mehr als 20 000 Schnitte | **+** ist bei 20 000 Schnitten gesperrt; **Open** weist die Datei ab |
| guides.….points: at most 20,000 points (found …). / guides.….points: x must be within ±1100000 mm and y within ±1000000 mm. | eine Leitkurve mit mehr als 20 000 Punkten, mit einem Punkt-x außerhalb von ±1 100 000 mm oder einem Punkt-y außerhalb von ±1 000 000 mm | **Add point** ist bei 20 000 Punkten gesperrt; Ziehen und Punkttabelle halten x innerhalb von ±1 100 000 mm; **Open** weist die Datei ab |
| Section at y = … mm lies on the mirrored side; … | y des Wurzelschnitts unter 0 | das Eingabefeld y setzt negative Werte auf 0; **Open** weist die Datei ab |
| Sections … and … share span position y = … mm. | zwei Schnitte mit gleichem y | die Schnitttabelle weist den Wert ab; **Open** weist die Datei ab |
| Sections … and … at y = … mm and y = … mm lie too close together for the surface parameters (span fractions … and …); move them apart. | zwei Schnitte, deren Spannweitenanteile (y − y Wurzel) / (y Rand − y Wurzel) sich höchstens um 4 Einheiten der letzten Stelle des größeren Werts oder höchstens um 2^-1021 (etwa 4,5e-308) unterscheiden, z. B. y = 714063,9936875999 und 714063,9936876 mm zwischen Wurzel bei 169026,9 mm und Rand bei 816583,4 mm | einen der beiden Schnitte verschieben |
| The surface fit is singular: sections … and … at y = … mm and y = … mm lie too close together; move them apart. | die Flächeninterpolation kann Stationen, deren Spannweitenanteile enger liegen, als sie auflöst, nicht lösen, z. B. Schnitte bei y = 0 und y = 1e-200 mm im Modus Smooth; die Meldung nennt die 2 nächstgelegenen Schnitte | einen der beiden Schnitte verschieben |
| Section at y = … mm uses unknown airfoil "…". | Profil-ID fehlt im Projekt | **×** ist für verwendete Profile gesperrt; **Open** weist die Datei ab |

Bei einem Fehler wird der Flügel nicht aufgebaut: 3D-Ansicht und Kennwerte bleiben leer, und **Export** bietet nur das Projekt-JSON an.

## Projektgröße

Über einer Warnschwelle arbeitet die App wie gewohnt. Der Flügelaufbau ergänzt eine Warnung in der Registerkarte **Checks**, die die Statusleiste mitzählt:

`Large project: <sizes>. Each change takes … and … of browser memory.`

- Jede Größe lautet z. B. `1,000 sections (warning above 200)`.
- Dauert der geschätzte erste Aufbau mindestens 1 s länger als eine Änderung, endet die Warnung mit `Opening it or changing the profile parametrization takes ….` Der erste Aufbau läuft nach **Open**, für das wiederhergestellte Projekt beim nächsten Aufruf und nach einer Änderung von **Profile parametrization**; er prüft und interpoliert jedes Profil neu, das ein Schnitt verwendet. Profile ohne Schnitt gehen nicht ein.
- Eine Meldung mit demselben Text erscheint, wenn eine Größe ihre Schwelle überschreitet: nach einer Änderung, nach **Open** und für das wiederhergestellte Projekt beim nächsten Aufruf.
- Die festen Grenzen liegen dort, wo einem Browser-Tab am Desktop der Speicher ausgeht oder eine Änderung etwa eine Minute dauert.

| Größe | Warnung über | Feste Grenze | An der festen Grenze |
| --- | --- | --- | --- |
| Schnitte | 200 | 20 000 | **+** gesperrt; **Open** weist die Datei ab |
| Projektprofile | 200 | 10 000 | die Registerkarte Airfoils fügt kein Profil hinzu; **Open** weist die Datei ab |
| Punkte eines Profils | 5000 | 100 000 | Fehler `too-many-points` in der Vorschau; **Open** weist die Datei ab |
| Profilpunkte insgesamt | 100 000 | 1 000 000 | die Registerkarte Airfoils fügt kein Profil hinzu; **Open** weist die Datei ab |
| Punkte einer eingeschalteten Leitkurve | 500 | 20 000 (jede Leitkurve) | **Add point** gesperrt; **Open** weist die Datei ab |
| Gitterpunkte des Lofts | 60 000 | 5 000 000 | weniger Stationen je Feld; Aufbaufehler, wenn eine Station je Feld die Grenze überschreitet |
| Dreiecke eines STL- oder 3MF-Exports | 2 000 000 (Exportdialog) | 10 000 000 | **Download** gesperrt |
| Kontrollpunkte eines STEP-Exports | 1 000 000 (Exportdialog) | 3 000 000 | **Download** gesperrt |
| Zeichen des Projektnamens oder eines Profilnamens | 200 | 10 000 | Namensfelder nehmen höchstens 10 000 Zeichen an; der Profil-Parser behält die ersten 10 000; **Open** weist die Datei ab |
| Projektdatei | – | 100 MB | **Open** weist die Datei ungelesen ab; **Save** lässt die abgeleiteten NURBS-Daten weg; ein Projekt, das auch ohne sie über 100 MB liegt, wird nicht gespeichert |

- Ein Projekt innerhalb aller Grenzen kann als Datei 100 MB überschreiten, wenn seine Namen und Quelltexte nahe an ihren Grenzen liegen. Beispiel: 10 000 Profile mit Namen von 10 000 Zeichen enthalten 100 000 000 Namenszeichen; mit 5 Punkten je Profil belegt die Datei 100,8 MB. **Save** schreibt dann keine Datei und zeigt `Save failed: the project takes 100.8 MB as a file, above the 100 MB that Open reads.`; **Export** > **Project JSON** zeigt `Export failed: the project takes 100.8 MB as a file, …`. Projekte mit kürzeren Namen und Quelltexten passen: 1 000 000 Profilpunkte belegen etwa 40 MB.

Die Schätzung in der Warnung ist eine lineare Anpassung an Messungen in Chromium 141 auf 4 Kernen einer Xeon-Server-CPU mit 2,1 GHz (JavaScript-Zeit, ohne Zeichnen der 3D-Ansicht):

| Anteil | Zeit | Browser-Speicher |
| --- | --- | --- |
| Grundwert jeder Änderung | 0,2 s | 15 MB |
| Je 1000 Gitterpunkte des Lofts | 11,5 ms | 0,65 MB |
| Je Punkt einer eingeschalteten Leitkurve (der mit mehr Punkten) | 0,11 ms | 0,05 MB |
| Je 1000 Profilpunkte | 1,5 ms | 0,2 MB |
| Je 1000 Einträge der Profil-Auswahllisten in der Tabelle Sections (Schnitte × Profile; über 20 000 einer je Schnitt) | 8,5 ms | 0,5 MB |
| Nur erster Aufbau, zusätzlich zu einer Änderung: je Profil, das ein Schnitt verwendet | 4,4 ms | nicht geschätzt |
| Nur erster Aufbau, zusätzlich zu einer Änderung: je 1000 Profilpunkte | 30 ms | nicht geschätzt |

- Zeiten lauten `under 1 s`, `about 1.5 s` (halbe Sekunden unter 10 s) oder `about 14 s`; der Speicher hat 2 signifikante Stellen, z. B. `about 94 MB`, `about 1.6 GB`.
- Anteile des ersten Aufbaus: gemessen in Node.js 24, nicht im Browser: 7,4 ms je Profil mit 99 Punkten bei 1000 und 2000 Profilen, davon 3 ms durch den Punktanteil. Beispiel: 20 000 Schnitte (**Linear**, 16 **Chordwise stations per surface**: 660 000 Gitterpunkte des Lofts) und 10 000 Profile mit 99 Punkten: `Each change takes about 9.5 s and about 650 MB of browser memory. Opening it or changing the profile parametrization takes about 83 s.`
- Das Zeichnen der 3D-Ansicht kommt mit der Zeit der Grafikkarte hinzu. Smartphones: nicht gemessen.

Gemessen je Änderung einer Profiltiefe im Browser: Chromium 141 headless, Software-Rendering, 4 geteilte Kerne, Load Average 2 bis 8; **Linear**, 1 Profil, 60 Tiefenstationen; JavaScript-Zeit und JavaScript-Heap nach der Änderung.

| Schnitte | Gitterpunkte des Lofts | Schätzung | Zeit | Speicher |
| --- | --- | --- | --- | --- |
| 1000 | 121 000 | about 1.5 s, about 94 MB | 1,5 bis 1,6 s | 78 bis 91 MB |
| 5000 | 605 000 | about 7 s, about 410 MB | 6,9 bis 7,4 s | 345 bis 361 MB |
| 10 000 | 1 210 000 | about 14 s, about 810 MB | 15,8 bis 16,4 s | 490 MB |
| 15 000 | 1 815 000 | about 21 s, about 1.2 GB | 19 bis 23 s | 678 MB |
| 20 000 | 2 420 000 | about 28 s, about 1.6 GB | 24 s | 969 MB |

- 20 000 Schnitte: 57 s Seitenzeit je Änderung mit Software-Rendering; Öffnen der Datei: 24 s JavaScript, 59 s Seitenzeit.
- Auswahl eines Schnitts: 2 ms JavaScript bei 200 Schnitten, 100 bis 110 ms bei 20 000 Schnitten.
- Vollständige Messbedingungen und weitere Fälle: [[Entwicklung|Entwicklung]].

## Export

![Exportdialog: Format, Flügelhälften, Netzdichte](images/export-dialog.png)

| Format | Bedeutung | Inhalt |
| --- | --- | --- |
| STEP | Standard for the Exchange of Product model data; Textdatei nach ISO 10303-21 (ISO: International Organization for Standardization), Anwendungsprotokoll 214 | Exakte B-Spline-Flächen, geschlossene Volumenkörper |
| STL | Stereolithografie | Binäres Dreiecksnetz |
| 3MF | 3D Manufacturing Format | Zip-Paket mit Dreiecksnetz |
| Project JSON | Projektdatei dieser App | Profile, Schnitte, Kurven, Einstellungen, NURBS-Daten |

| Gruppe | Option | Vorgabe |
| --- | --- | --- |
| Format | **STEP (AP214, exact NURBS solids)** | ausgewählt, wenn der Flügel fehlerfrei ist |
| Format | **STL (binary triangle mesh)** | – |
| Format | **3MF (triangle mesh for 3D printing)** | – |
| Format | **Project JSON (airfoils, sections, curves, settings, NURBS data)** | ausgewählt, wenn der Flügel Fehler hat; dann einziges Format |
| Wing halves (Flügelhälften) | **Both halves as separate bodies** (beide Hälften als getrennte Körper) | ausgewählt |
| Wing halves | **Full wing as one body (mesh formats, root at y = 0)** (ganzer Flügel als ein Körper) | – |
| Wing halves | **Right half only** (nur rechte Hälfte) | – |
| Mesh density (STL, 3MF) (Netzdichte) | **Normal** | ausgewählt |
| Mesh density (STL, 3MF) | **Fine (4x triangles)** (fein, 4-fache Dreiecksanzahl): verdoppelt die Unterteilung in beiden Flächenrichtungen | – |

Für STL und 3MF nennt ein Hinweis unter der Netzdichte die Dreiecke und die Dateigröße für Format, Flügelhälften und Netzdichte der Auswahl, z. B. Vorlage Glider, STL, beide Hälften, **Normal**: `0.02 million triangles, file about 1.2 MB.` Project JSON zeigt keinen Hinweis.

| Dreiecke | Hinweis | **Download** |
| --- | --- | --- |
| bis 2 000 000 | `… million triangles, file ….` | bedienbar |
| über 2 000 000 | Warnfarbe; ergänzt `The export takes … and … of browser memory.` | bedienbar |
| über 10 000 000 | Fehlerfarbe: `… million triangles, file …: above the limit of 10 million triangles, where a desktop browser tab runs out of memory. Use Normal density, one half, or fewer chord samples or panel stations.` | gesperrt |

- Schätzung je Million Dreiecke: STL 0,8 s, 210 MB Browser-Speicher, 50 MB Datei; 3MF 5,8 s, 110 MB Browser-Speicher, 11,5 MB Datei. Die Speicherschätzung addiert 15 MB.
- Gemessen (Chromium 141, 4 Kerne einer Xeon-Server-CPU mit 2,1 GHz): STL mit 8,5 Millionen Dreiecken: 6,9 s, 423 MB Datei, 2,7 GB Browser-Speicher in der Spitze; 3MF mit 8,5 Millionen Dreiecken: 49 s, 97 MB Datei; STL mit 20 Millionen Dreiecken scheiterte.

Für STEP nennt der Hinweis die Kontrollpunkte der Flächen in der Datei und die Dateigröße für die gewählten Flügelhälften (die linke Hälfte verdoppelt die Anzahl; die Netzdichte gilt nicht), z. B. Vorlage Glider, beide Hälften: `4,114 control points, file about 1 MB.` Über 1 000 000 Kontrollpunkten lautet die Anzahl `… million`.

| Kontrollpunkte | Hinweis | **Download** |
| --- | --- | --- |
| bis 1 000 000 | `… control points, file ….` | bedienbar |
| über 1 000 000 | Warnfarbe; ergänzt `The export takes … and … of browser memory.` | bedienbar |
| über 3 000 000 | Fehlerfarbe: `… million control points, file …: above the limit of 3 million control points, where the file takes more memory than a desktop browser tab holds. Use one half, or fewer chord samples or panel stations.` | gesperrt |

- Schätzung je Million Kontrollpunkte: 2,5 s, 620 MB Browser-Speicher, 98 MB Datei. Die Speicherschätzung addiert 15 MB.
- Gemessen: 3,3 Millionen Kontrollpunkte (4161 Stationen) schrieben eine Datei von 330 MB in 8,4 s (Chromium 141); Node.js 24 brauchte je Kontrollpunkt 1,6 bis 3,4 µs, 98 Byte Datei und 620 Byte Speicher in der Spitze. Etwa 5,4 Millionen Kontrollpunkte überschreiten die Grenze des Browsers von 512 MB je Zeichenkette. Zwischen 3,3 und 5,4 Millionen: nicht gemessen.

| Schaltfläche | Wirkung |
| --- | --- |
| **Download** | Schreibt die Datei mit den gewählten Optionen. |
| **Cancel** | Schließt den Dialog ohne Datei. |

| Format | Beide Hälften | Ganzer Flügel | Rechte Hälfte |
| --- | --- | --- | --- |
| STEP | 2 Volumenkörper | 2 Volumenkörper | 1 Volumenkörper |
| STL | 1 Datei, 2 geschlossene Hüllen | 1 geschlossene Hülle | 1 geschlossene Hülle |
| 3MF | 2 Objekte: `Wing right`, `Wing left` | 1 Objekt: `Wing` | 1 Objekt: `Wing right` |
| Project JSON | vollständiges Projekt | vollständiges Projekt | vollständiges Projekt |

- **Full wing** setzt den Wurzelschnitt bei y = 0 voraus. Sonst schreiben STL und 3MF 2 Körper wie bei **Both halves**.
- STEP hat keinen zusammengefügten Körper: **Full wing** schreibt 2 Volumenkörper.
- Das Projekt-JSON enthält das vollständige Projekt. Ohne Flügelfehler enthält es zusätzlich die abgeleiteten NURBS-Daten: Profilkurven, Leitkurven, Stationen in Spannweitenrichtung und die NURBS-Fläche des Flügels.
- Brächten die abgeleiteten NURBS-Daten die Datei über 100 MB, die größte Datei, die **Open** liest, lassen **Save** und Project JSON sie weg und melden `The file leaves out the derived NURBS data: with it, the file would exceed 100 MB, the largest project file Open reads. Open recomputes it; STEP export writes the exact surfaces.`
- Dateiname: Projektname ohne Akzente; jede Folge von Zeichen außerhalb von `A–Z a–z 0–9 . _ -` wird zu einem `_`; `_` am Anfang und Ende entfällt; die ersten 120 Zeichen bleiben. Endung `.step`, `.stl`, `.3mf` oder `.json`. Leerer Name: `wing`.
- Einheit: mm in allen Formaten. Achsen wie in der App.
- Reicht der Speicher des Browsers nicht oder wird eine eigene Größengrenze des Browsers erreicht, bricht der Export mit der roten Meldung `Export failed: <reason>.` ab, bei STL und 3MF gefolgt von `Use Normal mesh density or fewer chord samples and panel stations.`, bei STEP von `Use one half, or fewer chord samples and panel stations.`
- STL und 3MF speichern 32-Bit-Koordinaten. Fällt durch die Rundung ein bei dieser Auflösung sichtbares Dreieck zusammen oder kippt es um, schreibt der Export keine Datei und zeigt die rote Meldung `STL stores 32-bit coordinates: at … mm their spacing is … mm, and … of … triangles collapse or turn over. Move the wing towards the origin, or export STEP.` (3MF: `3MF readers store 32-bit coordinates: …`). `at … mm` nennt die größte Koordinate der beschädigten Dreiecke.
- Fällt das erste beschädigte Dreieck auch dann zusammen oder kippt um, wenn seine x- und z-Werte neben 0 verschoben sind, ist schon seine Spannweitenposition zu grob: Schnitte oder Stationen liegen dichter beieinander als der 32-Bit-Abstand, und Verschieben des Flügels hilft nicht. Der letzte Satz lautet dann `Sections or stations near y = … mm lie closer together than the spacing there (… mm); move them apart, or export STEP.` Beispiel: 4 Schnitte, 2 davon bei y = 300 mm und y = 300,00001 mm: `STL stores 32-bit coordinates: at 300 mm their spacing is 0.000031 mm, and 484 of 1928 triangles collapse or turn over. Sections or stations near y = 300 mm lie closer together than the spacing there (0.000031 mm); move them apart, or export STEP.`
- Dateiinhalte: [[Dateiformate|Dateiformate]].
