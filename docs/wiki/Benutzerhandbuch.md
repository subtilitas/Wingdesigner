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
| Feld | Spannweitenabschnitt zwischen zwei benachbarten Schnitten |
| Station | eine platzierte Profilkontur an der Spannweitenposition y; jeder Schnitt ist eine Station |

Die App zeigt sich auf Deutsch oder Englisch (Abschnitt [Sprache](#sprache)). Diese Seite nennt die Bedienelemente mit ihrer deutschen Beschriftung. Die englische Beschriftung steht bei der ersten Nennung in jedem Abschnitt in Klammern, z. B. **Einstellungen** (Settings).

## Bildschirmaufbau

![Desktop-Fenster: Kopfleiste, 3D-Ansicht, Registerkarte Schnitte, Statusleiste](images/de/main-desktop.png)

| Bereich | Inhalt |
| --- | --- |
| Kopfleiste | **Neu** (New), **Öffnen** (Open), **Speichern** (Save), **Exportieren** (Export), **Rückgängig** (Undo), **Wiederholen** (Redo), **Hilfe** (Help) |
| 3D-Ansicht | NURBS-Fläche (Non-Uniform Rational B-Spline) des Flügels, Schnittkonturen (blau, ausgewählter Schnitt rot), Linien der Nasenleiste und der Endleiste (grau), Raster in der Ebene z = 0 (20 × 20 Zellen); Ansichtsschaltflächen |
| Bedienbereich | Registerkarten **Schnitte** (Sections), **Grundriss** (Planform), **Profile** (Airfoils), **Einstellungen** (Settings), **Prüfungen** (Checks) |
| Statusleiste | `Spannweite … mm · Fläche … dm² · AR … · MAC … mm` (AR: aspect ratio, deutsch Streckung; MAC: mean aerodynamic chord, deutsch mittlere aerodynamische Flügeltiefe), danach die Anzahl der Warnungen (`1 Warnung`, `2 Warnungen`; nur bei 1 oder mehr Warnungen). Bei Fehlern: Anzahl der Fehler und erste Fehlermeldung in roter Schrift (`… Fehler: …`). Bei ausgeschalteter automatischer Sicherung: `Automatische Sicherung aus: „Speichern“ verwenden` in roter Schrift (Abschnitt [Speicherung](#speicherung)). |
| Meldungen | Kurzmeldungen (z. B. `Entwurf „Segelflugmodell“ angelegt.`) am unteren Rand der 3D-Ansicht für 4 s; eine Meldung mit mehr als 66 Zeichen bleibt 60 ms je Zeichen. Fehlermeldungen auf rotem Grund. |

| Schaltfläche der Kopfleiste | Wirkung |
| --- | --- |
| **Neu** | Öffnet den Assistenten (Abschnitt [Assistent](#assistent)). |
| **Öffnen** | Lädt eine Projektdatei im Format JSON (JavaScript Object Notation, Dateiendung `.json`). Dateien über 100 MB werden ungelesen abgewiesen: `<Datei> kann nicht geöffnet werden: … MB; Projektdateien sind auf 100 MB begrenzt.` Eine Datei, die der Browser nicht lesen kann (entferntes Laufwerk, entzogene Berechtigung), zeigt `<Datei> kann nicht geöffnet werden: Der Browser konnte die Datei nicht lesen (NotReadableError).`; der aktuelle Entwurf bleibt. Ungültige Dateien werden abgewiesen; die Meldung zeigt bis zu 3 Fehler. Abgeleitete NURBS-Daten in der Datei werden ignoriert und neu berechnet. |
| **Speichern** | Lädt das Projekt-JSON herunter. Gleiche Datei wie **Exportieren** > **Projekt-JSON** (Project JSON). Brächten die abgeleiteten NURBS-Daten die Datei über 100 MB, lässt die Datei sie weg (Abschnitt [Export](#export)). Ein Fehler zeigt die rote Meldung `Speichern fehlgeschlagen: ….` |
| **Exportieren** | Öffnet den Exportdialog (Abschnitt [Export](#export)). |
| **Rückgängig** / **Wiederholen** | Springen im Bearbeitungsverlauf einen Schritt zurück beziehungsweise vor. Der Verlauf liegt nur im Arbeitsspeicher: höchstens 100 Schritte und höchstens 64 000 000 Zeichen serialisiertes Projekt (Rückgängig- und Wiederholen-Schritte zusammen); ein Projekt über 640 000 Zeichen behält weniger Schritte, mindestens 1. **Neu** und **Öffnen** lassen sich mit **Rückgängig** zurücknehmen. |
| **Hilfe** | App-Version, Arbeitsablauf, Bedienung, Links zu diesem Wiki, zum Quellcode und zu `LICENSES.txt` (Link **Lizenzen dieser App und ihrer Bibliotheken** (Licenses of this app and its libraries)). Die Datei enthält die MIT-Lizenz (Massachusetts Institute of Technology) der App und die Lizenztexte von three.js und fflate. Der Link **Dokumentation (Wiki)** (Documentation (wiki)) öffnet in der englischen Oberfläche die Startseite dieses Wikis und in der deutschen Oberfläche die Seite Benutzerhandbuch. |

### Schmale Bildschirme

![Smartphone-Ansicht (Pixel 7): Kopfleiste in zwei Zeilen, 3D-Ansicht mit der Meldung „Entwurf ‚Sportmodell‘ angelegt.“, darunter die Karten „Schnitt 1“ und „Schnitt 2“](images/de/mobile-main.png)

Bei einer Fensterbreite von höchstens 860 px:

- Die 3D-Ansicht liegt über dem Bedienbereich: 42 % der Fensterhöhe, mindestens 240 px.
- In der 3D-Ansicht erscheint **Vergrößern** (Enlarge). Die Schaltfläche blendet den Bedienbereich aus und gibt der 3D-Ansicht die volle Höhe; erneutes Tippen blendet ihn wieder ein.
- Die Schnitttabelle wird zu einer Karte je Schnitt (3 Spalten, Beschriftung über jedem Wert).
- Die Grundriss-Zeichenfläche ist 260 px hoch.
- Deutsche Oberfläche: Die Statusleiste zeigt höchstens 2 Zeilen; die Registerkarte **Prüfungen** zeigt den ganzen Text. Die Kopfleiste hat bei einer Fensterbreite von höchstens 563 px 2 Zeilen (gemessen in Chromium 141: 2 Zeilen bei 563 px, 1 Zeile bei 564 px).
- Bei einer Fensterbreite von höchstens 420 px bleiben die 7 Schaltflächen der Kopfleiste der englischen Oberfläche in 1 Zeile; ist die Zeile breiter als das Fenster, lässt sie sich seitlich verschieben. Die deutsche Kopfleiste bricht stattdessen um, und die Schaltflächen eines Projektprofils rücken unter den Namen.

![Smartphone-Ansicht der Registerkarte Grundriss mit Grundriss-Editor und eingeschalteter Endlinie](images/de/mobile-planform.png)

Auf Touchscreens (grober Zeiger) sind Schaltflächen und Eingabefelder mindestens 40 px hoch.

## Speicherung

- Nach jeder Änderung speichert der Browser das Projekt in `localStorage` unter dem Schlüssel `wingdesigner.project.v1`. Der nächste Aufruf stellt es wieder her.
- Gespeichert werden nur Projekte, die die Prüfung von **Öffnen** (Open) bestehen. Sonst bleibt das letzte gültige Projekt gespeichert.
- Ein gespeichertes Projekt, das sich nicht laden lässt, bleibt unter `wingdesigner.project.v1.rejected` erhalten. Eine Fehlermeldung erscheint, und der Assistent öffnet sich wie beim ersten Aufruf. Ist für diese Kopie kein Platz, bleibt das Projekt unter `wingdesigner.project.v1`, und die automatische Sicherung bleibt für die Sitzung aus; die Statusleiste zeigt von Anfang an `Automatische Sicherung aus: „Speichern“ verwenden`.
- Die aktive Registerkarte steht unter `wingdesigner.tab`.
- Die gewählte Sprache steht unter `wingdesigner.language` (`en` oder `de`), sobald die Nutzerin oder der Nutzer unter **Einstellungen** (Settings) eine gewählt hat (Abschnitt [Sprache](#sprache)).
- Ohne gespeichertes Projekt (erster Aufruf) öffnet sich der Assistent. Solange dieser Assistent offen ist, wird nichts gespeichert; ein Neuladen zeigt den Assistenten erneut.
- Bei gesperrtem Speicher (privates Fenster) existiert das Projekt nur im geöffneten Browser-Tab. **Speichern** (Save) sichert es als Datei.
- Weist der Browser das Projekt ab (Browser behalten etwa 5 000 000 Zeichen je Website), erscheint einmal die rote Meldung `Die automatische Sicherung ist aus: Der Browserspeicher hat das Projekt abgelehnt (… Zeichen; Browser speichern etwa 5.000.000 je Website). Um es zu behalten, „Speichern“ verwenden.` Die Statusleiste zeigt `Automatische Sicherung aus: „Speichern“ verwenden`, bis eine automatische Sicherung wieder gelingt; dann erscheint die Meldung `Die automatische Sicherung funktioniert wieder.`
- Solange die automatische Sicherung scheitert, steht der Zeitpunkt des ersten Fehlschlags unter dem Schlüssel `wingdesigner.project.v1.stale`. Der nächste Aufruf stellt das zuletzt gespeicherte Projekt wieder her und meldet `Dies ist das Projekt im zuletzt gespeicherten Stand; die automatische Sicherung hörte am … auf, weil der Browserspeicher voll war, und spätere Änderungen wurden nicht gespeichert.` Bringt das wiederhergestellte Projekt die Warnung `Großes Projekt` mit, erscheinen beide Texte in einer Meldung in der Fehlerfarbe.
- Der Bearbeitungsverlauf (**Rückgängig** (Undo) und **Wiederholen** (Redo)) wird nicht gespeichert.

## Sprache

Die App spricht Englisch oder Deutsch.

| Punkt | Verhalten |
| --- | --- |
| Auswahlliste | **Language / Sprache** in der ersten Gruppe der Registerkarte **Einstellungen** (Settings), mit den Werten **English** und **Deutsch**. Gruppe und Liste tragen in beiden Sprachen dieselbe Beschriftung, sodass sich die Liste in jeder Sprache finden lässt. |
| Start | Die im Browser gespeicherte Wahl. Ohne gespeicherte Wahl: Deutsch, wenn die erste Sprache des Browsers Deutsch ist, sonst Englisch. |
| Deutscher Browser | Der erste Eintrag der Sprachliste des Browsers ist `de` oder beginnt mit `de-`, in beliebiger Groß- und Kleinschreibung (`de`, `de-AT`, `DE-ch`). Spätere Einträge zählen nicht: Die Liste `en-US`, `de` ergibt Englisch. |
| Gespeicherter Wert | Nur `en` und `de` gelten. Jeder andere gespeicherte Wert wird ignoriert, und die Sprache des Browsers entscheidet. |
| Speicherort | Schlüssel `wingdesigner.language` in `localStorage`, geschrieben, wenn die Nutzerin oder der Nutzer eine Sprache wählt. Bei gesperrtem Speicher gilt die Wahl bis zum Schließen der Seite. Projektdateien, automatische Sicherung und Exporte enthalten keine Spracheinstellung. |
| Erster Aufruf | Der Assistent öffnet sich in der Startsprache. Er ist modal, sodass die Liste erst nach **Entwurf anlegen** (Create design) oder **Überspringen (Beispielflügel öffnen)** (Skip (open sample wing)) erreichbar ist. |
| Seite | Das Attribut `lang` der Seite lautet `en` oder `de`. Der Seitentitel `Wingdesigner` ändert sich nicht. Die Zeile `<noscript>`, die bei ausgeschaltetem JavaScript erscheint, nennt beide Sprachen. |

### Umschalten

Eine Wahl wirkt sofort, ohne die Seite neu zu laden.

Sofort wechseln:

- die Kopfleiste, die Registerkarten, die Ansichtsschaltflächen, die Statusleiste, jeder Tooltip und jede zugängliche Beschriftung (`aria-label`) sowie die Seitenbeschreibung (`description`);
- der Inhalt jeder Registerkarte, darunter **Prüfungen** (Checks): Aufbaufehler, Aufbauwarnungen, Meldungen der Profilprüfung und die Warnung `Großes Projekt`;
- die Zahlen (Abschnitt [Zahlen](#zahlen));
- der Assistent sowie die Dialoge **Exportieren** (Export), **Hilfe** (Help) und die Profilvorschau, sobald sie sich das nächste Mal öffnen. Alle sind modal, sodass die Liste bei offenem Dialog nicht bedienbar ist.

Bleiben:

- das Projekt, der ausgewählte Schnitt, der Bearbeitungsverlauf (**Rückgängig** (Undo) und **Wiederholen** (Redo)) und die aktive Registerkarte;
- die Tastenkürzel. Die Tooltips nennen die Tasten in der aktuellen Sprache: `Undo (Ctrl+Z)`, auf Deutsch `Rückgängig (Strg+Z)`.

Der Aufbau nach dem Wechsel:

- Enthält **Prüfungen** einen Fehler oder eine andere Warnung als `Großes Projekt`, wird der Flügel neu aufgebaut, denn diese Meldungen stammen aus dem Aufbau. Der Aufbau dauert so lange wie nach einer Änderung (Abschnitt [Projektgröße](#projektgröße)).
- Sonst bleibt der Flügel, und die Warnung `Großes Projekt` wird neu geschrieben.

Meldungen:

- Eine sichtbare Meldung ohne roten Grund verschwindet beim Wechsel, mit ihrem Text.
- Eine Fehlermeldung (roter Grund) bleibt in der Sprache sichtbar, in der sie geschrieben wurde, bis ihre Anzeigedauer endet: 4 s oder 60 ms je Zeichen bei mehr als 66 Zeichen. Zu diesem Zeitpunkt wird ihr Text entfernt, wenn die Sprache eine andere ist als die, in der sie geschrieben wurde.

### Zahlen

| Zahl | Englisch | Deutsch |
| --- | --- | --- |
| Dezimalzeichen | Punkt: `23.04 dm²` | Komma: `23,04 dm²` |
| Anzahlen, Grenzen und berechnete Werte mit 4 oder mehr Stellen | in einigen Texten mit Komma gruppiert (`20,000`), in anderen nicht gruppiert (`1200 mm`) | mit Punkt gruppiert: `20.000`, `1.200 mm` |
| Aus einem Feld übernommene Werte (Positionen, Winkel, Parameter) | `y = 1000 mm`, `0.25` | nicht gruppiert: `y = 1000 mm`, `0,25` |

Beispiel, Statusleiste des Entwurfstyps **Sportmodell** (Sport):

| Sprache | Statusleiste |
| --- | --- |
| Englisch | `Span 1200 mm · area 23.04 dm² · AR 6.25 · MAC 196.0 mm` |
| Deutsch | `Spannweite 1.200 mm · Fläche 23,04 dm² · AR 6,25 · MAC 196,0 mm` |

Zahlenfelder:

- Der Wert eines Zahlenfelds wird in beiden Sprachen mit Dezimalpunkt geschrieben (`0.6`).
- Wie ein Zahlenfeld Werte anzeigt und annimmt, entscheidet der Browser. Geprüft nur in Chromium 141 (headless, Gebietsschemata `en-US` und `de-DE`): Das Feld zeigt `0.6`. Ein getipptes Komma entfällt, sodass das Feld `0,7` als `07` liest und die App den Wert 7 übernimmt; **Drehpunkt der Schränkung** (Twist pivot) nimmt dann sein Maximum 1. Die App zeigt keine Meldung. Einen Dezimalpunkt tippen. Andere Browser und Chromium mit deutscher Oberflächensprache: nicht getestet.

### Was unverändert bleibt

- Dateiinhalte: STEP (Standard for the Exchange of Product model data), STL (Stereolithografie), 3MF (3D Manufacturing Format), Projekt-JSON und `.dat`-Dateien. Zahlen darin haben immer einen Dezimalpunkt. Die 3MF-Objektnamen `Wing right`, `Wing left` und `Wing` ändern sich nicht.
- Namen und Quellenangaben: der Projektname, Profilnamen, jeder von der Nutzerin oder dem Nutzer getippte Text, Quellenangaben, Lizenzkennungen, Quelladressen, die Namen der externen Quellen, `LICENSES.txt` und `NOTICE.md`.
- Texte, die der Browser schreibt: seine Dateidialoge, der Name eines Browserfehlers wie `NotReadableError` und der Grund, den der Browser nennt, wenn ihm der Speicher ausgeht oder er eine eigene Größengrenze erreicht (nach `Speichern fehlgeschlagen:` oder `Export fehlgeschlagen:`).
- Der Grund in `Die NURBS-Interpolation durch die Punkte ist fehlgeschlagen (…).` und der Text nach `Interner Fehler:` stammen aus dem Geometriecode und bleiben englisch.
- Die Beschreibungen der Bibliothekseinträge und der externen Quellen werden übersetzt.

Namen, die die App selbst schreibt, entstehen in der Sprache, die beim Anlegen eingestellt ist, und werden als Text gespeichert. Ein späterer Wechsel benennt sie nicht um:

| Name | Englisch | Deutsch |
| --- | --- | --- |
| Projektname aus dem Assistenten | Name des Entwurfstyps, z. B. `Sport` | Name des Entwurfstyps, z. B. `Sportmodell` |
| Projektname aus dem Assistenten, Namensfeld leer | `<span> mm wing` | `Flügel <Spannweite> mm` |
| Beispielflügel (**Überspringen (Beispielflügel öffnen)**) | `Sport wing 1500` | `Sportflügel 1500` |
| Projektdatei, deren `name` keine Zeichenkette ist | `Imported wing` | `Importierter Flügel` |
| Eingefügte Koordinaten ohne Namenszeile | `pasted` | `Eingefügtes Profil` |

### Dateinamen

Dateinamen von Downloads (**Speichern** (Save), **Exportieren**, Profil-`.dat`) schreiben deutsche Umlaute in beiden Sprachen aus: ä → ae, ö → oe, ü → ue, Ä → Ae, Ö → Oe, Ü → Ue, ß → ss. Andere Akzente entfallen (é → e, ñ → n). `Sportflügel 1500` ergibt `Sportfluegel_1500.step`. Die ganze Regel: [[Dateiformate]], Abschnitt Dateinamen beim Export.

## Bedienung

| Aktion | Maus | Touchscreen |
| --- | --- | --- |
| 3D-Ansicht drehen | linke Taste ziehen | mit einem Finger ziehen |
| 3D-Ansicht zoomen | Mausrad oder mittlere Taste ziehen | zwei Finger spreizen oder zusammenziehen |
| 3D-Ansicht verschieben | rechte Taste ziehen | mit zwei Fingern ziehen |
| Punkt im Grundriss-Editor verschieben | Punkt ziehen | Punkt ziehen |
| Grundriss-Editor, Profilvorschau oder Grundrissvorschau (Assistent) verschieben | Hintergrund ziehen | Hintergrund ziehen |
| Grundriss-Editor, Profilvorschau oder Grundrissvorschau (Assistent) zoomen | Mausrad (um den Mauszeiger) | zwei Finger spreizen oder zusammenziehen |
| Grundriss-Editor einpassen | Doppelklick oder **Einpassen** (Fit) | **Einpassen** |
| Profilvorschau einpassen | automatisch beim Öffnen; Doppelklick | automatisch beim Öffnen; keine Schaltfläche zum Einpassen |
| Grundrissvorschau (Assistent) einpassen | automatisch nach jeder Eingabe; Doppelklick | automatisch nach jeder Eingabe; keine Schaltfläche zum Einpassen |
| **Rückgängig** (Undo) | Strg+Z (macOS: Cmd+Z) | **Rückgängig** |
| **Wiederholen** (Redo) | Strg+Umschalt+Z oder Strg+Y (macOS: Cmd) | **Wiederholen** |

- Fangradius für Punkte im Grundriss-Editor: 9 px mit Maus oder Stift, 18 px mit Touchscreen. Innerhalb des Radius wird der nächstgelegene Punkt gewählt.
- Tastenkürzel wirken nicht, solange der Fokus in einem Eingabefeld, Textbereich oder einer Auswahlliste liegt oder solange ein Dialog offen ist.
- Der Tastaturfokus bleibt auf Zahlenfeldern, den Profillisten der Tabelle in **Schnitte** (Sections), den Auswahllisten in **Einstellungen** (Settings) und den Auswahllisten der Leitkurven (**Modus** (Mode), **Grad** (Degree)), den Kontrollkästchen in **Einstellungen** und **Leitkurve verwenden** (Use guide curve), dem Feld **Projektname** (Project name) und den Zeilenschaltflächen **+** und **×** der Tabelle in **Schnitte**, wenn die Registerkarte nach einer Änderung neu aufgebaut wird. Text- und Zahlenfelder markieren ihren Text erneut.
- Eingabefelder für Zahlen übernehmen den Wert mit Enter, beim Verlassen des Eingabefelds und bei jedem Schritt mit den Pfeiltasten oder den Pfeilen im Eingabefeld. Eine nicht numerische Eingabe springt auf den vorherigen Wert zurück.
- Ein Eingabefeld für Zahlen zeigt die kürzeste Dezimalzahl, die den gespeicherten Wert genau wiedergibt, z. B. `600.0000002`; die Anzeige rundet keinen Wert. Die App setzt den Wert in der Schreibweise mit Dezimalpunkt und ohne Gruppierung. Wie ein Zahlenfeld Werte anzeigt und annimmt, entscheidet der Browser (Abschnitt [Zahlen](#zahlen)).
- Ein Ziehvorgang ist ein Rückgängig-Schritt, wie lange er auch pausiert: Seine Änderungen werden zusammengefasst, bis der Zeiger losgelassen wird.
- **Rückgängig** oder **Wiederholen** während eines Ziehvorgangs beendet den Ziehvorgang; weitere Zeigerbewegungen bis zum Loslassen bewegen nichts. **Wiederholen** stellt einen rückgängig gemachten Ziehvorgang oder Punkt wieder her.
- Eine Aktion, die nichts ändert, ergibt keinen Rückgängig-Schritt und behält die Wiederholen-Schritte, z. B. **Unbenutzte entfernen** (Remove unused), wenn jedes Profil verwendet wird, **Zum Projekt hinzufügen** (Add to project) eines Profils, das das Projekt schon enthält, oder die Eingabe des Werts, den ein Feld schon hat.

| Schaltfläche der 3D-Ansicht | Kamera |
| --- | --- |
| **Iso** | Von vorn (vor der Nasenleiste), von links und von oben |
| **Oben** (Top) | Von oben (+z) |
| **Vorne** (Front) | Von vorn (−x) |
| **Links** (Side) | Von links (−y) |
| **Einpassen** | Gleiche Richtung wie **Iso** |
| **Vergrößern** (Enlarge) | Nur bei Breiten ≤ 860 px; blendet den Bedienbereich aus und ein |

**Iso**, **Oben**, **Vorne**, **Links** und **Einpassen** passen zusätzlich den ganzen Flügel in die Ansicht ein.

## Assistent

![Assistent mit dem Entwurfstyp Segelflugmodell: Entwurfstypen, 12 Eingaben einschließlich Flügelende, Grundrissvorschau und Kennwerte](images/de/wizard.png)

Der Assistent erzeugt aus 12 Eingaben (Tabelle unten) ein vollständiges Projekt. Er erzeugt Schnitte, Profile, die Endleisteneinstellung, die Form des Flügelendes und bei elliptischem Grundriss beide Leitkurven. Alle Werte bleiben danach bearbeitbar.

- Öffnet sich beim ersten Aufruf mit dem Titel „Neuen Flügelentwurf beginnen“ (Start a new wing design) und mit **Neu** (New) mit dem Titel „Neuer Flügelentwurf“ (New wing design).
- Vorausgewählter Entwurfstyp: **Sportmodell** (Sport). Ein Klick auf die Karte eines Entwurfstyps lädt dessen Werte.
- Profile sind NACA-Profile (National Advisory Committee for Aeronautics) der 4- oder 5-stelligen Reihe. Gültige Bezeichnungen: Abschnitt [NACA-Generator](#naca-generator).

| Eingabefeld | Bereich | Wirkung |
| --- | --- | --- |
| **Projektname** (Project name) | Text | Vorgabe: Name des Entwurfstyps. Leer: `Flügel <Spannweite> mm`. Beide entstehen in der aktuellen Sprache (Abschnitt [Sprache](#sprache)). |
| **Spannweite (beide Hälften)** (Span (both halves)) | 100 bis 20 000 mm | Spannweite von Flügelende zu Flügelende |
| **Wurzeltiefe** (Root chord) | 10 bis 3000 mm | Profiltiefe bei y = 0 |
| **Zuspitzung (Randtiefe / Wurzeltiefe)** (Taper (tip / root chord)) | 0,1 bis 1,5 | Randtiefe geteilt durch Wurzeltiefe. Elliptischer Grundriss mit flachem Flügelende: kleiner als 1. Elliptischer Grundriss mit spitzem Flügelende: nicht verwendet. |
| **Pfeilung der 25-%-Linie** (Sweep of the 25 % line) | −45 bis 60° | Pfeilung der 25-%-Linie; positiv = nach hinten gepfeilt |
| **V-Form je Hälfte** (Dihedral per half) | −15 bis 30° | z des Schnitts = y · tan(V-Form) |
| **Schränkung am Rand (negativ = Nase ab)** (Tip twist (negative = washout)) | −15 bis 15° | Schränkung ändert sich linear von 0° an der Wurzel bis zu diesem Wert am Rand |
| **Anzahl der Schnitte** (Number of sections) | 2 bis 8, ganzzahlig | Schnitte gleichmäßig verteilt von Wurzel bis Rand |
| **Grundriss** (Planform) | **Gerade zugespitzt** (Straight taper), **Elliptisch (mit Leitkurven)** (Elliptic (guide curves)) | Tiefenverlauf, siehe unten |
| **Flügelende** (Tip) | **Flach** (Flat), **Spitz (Maßstab 1/200)** (Pointed (1/200 scale)) | Flach: Der Flügel endet am Randschnitt. Spitz: Profiltiefe des Randschnitts = 1/200 der Profiltiefe am vorletzten Schnitt, mindestens 1 mm. |
| **Wurzelprofil (NACA)** (Root airfoil (NACA)) | NACA-Bezeichnung | Profil aller Schnitte außer dem Randschnitt |
| **Randprofil (NACA)** (Tip airfoil (NACA)) | NACA-Bezeichnung | Profil des Randschnitts |

Tiefenverlauf (η = Spannweitenanteil, 0 an der Wurzel, 1 am Rand; λ = Zuspitzung; η_prev = Spannweitenanteil des vorletzten Schnitts):

| Grundriss | Flügelende | Profiltiefe c(η) | Leitkurven |
| --- | --- | --- | --- |
| **Gerade zugespitzt** | **Flach** | c_root · (1 + (λ − 1) · η) | aus |
| **Gerade zugespitzt** | **Spitz** | wie **Flach**; Randschnitt: max(c(η_prev) / 200, 1 mm) | aus |
| **Elliptisch** | **Flach** | c_root · √(1 − (1 − λ²) · η²) | Nasenlinie und Endlinie an; je 11 Punkte bei η_i = sin(π i / 20), i = 0 … 10: 0; 0,156; 0,309; 0,454; 0,588; 0,707; 0,809; 0,891; 0,951; 0,988; 1 (zum Rand hin dichter) |
| **Elliptisch** | **Spitz** | c_root · √(1 − η²); Randschnitt: max(c(η_prev) / 200, 1 mm) | Nasenlinie und Endlinie an; je 11 Punkte bei denselben η wie **Flach**; beide Linien enden auf der 25-%-Linie |

Erzeugte Leitkurven verwenden **Durch Punkte** (Through points) und Grad 3. x der Endlinie: das gerundete x der Nasenlinie plus die gerundete Profiltiefe. Größte Abweichung der Profiltiefe der Leitkurven vom elliptischen Verlauf, Entwurfstyp **Segelflugmodell** (Glider), in % der Wurzeltiefe: Zuspitzung 0,1: 0,55 %; 0,2: 0,10 %; 0,3: 0,02 %; 0,45: 0,004 %; **Spitz**: 2,87 %, innerhalb der letzten 0,3 % der Spannweite (1 000 001 Spannweitenpositionen).

Erzeugte Werte:

| Wert | Regel |
| --- | --- |
| x der Profilnase | 0,25 · c_root + y · tan(Pfeilung) − 0,25 · c(η); die 25-%-Punkte liegen auf der Pfeilungslinie |
| Rundung | 0,01 mm, 0,01° |
| Endleiste | **Feste Dicke in mm** (Fixed thickness in mm): 0,2 % der Wurzeltiefe, mindestens 0,3 mm |
| Flügelende | **Einstellungen** (Settings) > **Flügelende** (Wing tip) = Eingabefeld **Flügelende**; Maßstab des Randprofils 1 : 200 |

Die Vorschau zeigt den Grundriss beider Hälften. Die Zeile darunter nennt Fläche (dm²), Streckung, mittlere aerodynamische Flügeltiefe (MAC) mit ihrer Spannweitenposition und Randtiefe, z. B. `Fläche 33,7 dm², Streckung 11,86, mittlere aerodynamische Flügeltiefe 174,2 mm bei y = 451 mm, Randtiefe 90,0 mm.`

Bei einer der folgenden Bedingungen wird die Zeile rot und nennt die Probleme; **Entwurf anlegen** (Create design) ist dann gesperrt:

- Ein Wert liegt außerhalb seines Bereichs (Spalte Bereich).
- **Anzahl der Schnitte** ist nicht ganzzahlig.
- Wurzel- oder Randprofil ist keine gültige NACA-Bezeichnung.
- **Elliptisch** mit Flügelende **Flach** hat eine Zuspitzung ≥ 1 (`Ein elliptischer Grundriss braucht eine Zuspitzung < 1.`).
- Der Flügel hat einen Aufbaufehler (Abschnitt [Prüfungen](#prüfungen)).

| Entwurfstyp | Spannweite mm | Wurzeltiefe mm | Zuspitzung | Pfeilung ° | V-Form ° | Schränkung Rand ° | Schnitte | Grundriss | Flügelende | Wurzel- / Randprofil |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Trainer** | 1400 | 250 | 1 | 0 | 3 | 0 | 2 | gerade | flach | 2412 / 2412 |
| **Sportmodell** | 1200 | 240 | 0,6 | 0 | 1,5 | −1 | 2 | gerade | flach | 2412 / 2410 |
| **Segelflugmodell** | 2000 | 200 | 0,45 | 0 | 4 | −1,5 | 3 | elliptisch | flach | 2410 / 2408 |
| **Pfeilnurflügel** (Swept flying wing) | 1200 | 280 | 0,45 | 25 | 0 | −4 | 3 | gerade | flach | 23112 / 0010 |
| **Brettnurflügel** (Plank) | 1000 | 220 | 0,8 | 0 | 1 | 0 | 2 | gerade | flach | 23112 / 23112 |
| **Leitwerk** (Tail surface) | 500 | 130 | 0,7 | 5 | 0 | 0 | 2 | gerade | flach | 0009 / 0009 |

| Schaltfläche | Wirkung |
| --- | --- |
| **Entwurf anlegen** | Ersetzt das aktuelle Projekt. **Rückgängig** (Undo) stellt das vorherige wieder her. |
| **Abbrechen** (Cancel) | Behält das aktuelle Projekt. |
| **Überspringen (Beispielflügel öffnen)** (Skip (open sample wing)) | Nur beim ersten Aufruf, anstelle von **Abbrechen**. Behält den Beispielflügel „Sportflügel 1500“ (englische Oberfläche: „Sport wing 1500“): 3 Schnitte, 1500 mm Spannweite, NACA 2412 / 2410, Endleiste fest 0,5 mm. |

## Schnitte

![Registerkarte Schnitte mit den 3 Schnitten des Entwurfstyps Segelflugmodell](images/de/sections.png)

Ein Schnitt setzt ein Profil:

- in die Ebene y = konst.;
- mit der Profilnase bei (x, y, z);
- skaliert auf die Profiltiefe;
- um den Schränkungswinkel gedreht; Drehpunkt: **Einstellungen** (Settings) > **Drehpunkt der Schränkung** (Twist pivot), Vorgabe 0,25 = 25 % der Profiltiefe.

Berechnung: [[Geometrie|Geometrie]].

| Spalte | Einheit | Schritt | Grenze | Wirkung |
| --- | --- | --- | --- | --- |
| # | – | – | – | Schnittnummer; 1 = Wurzel |
| **Profil** (Airfoil) | – | – | Profile des Projekts | Profil dieses Schnitts |
| y | mm | 5 | 0 bis 1 000 000 | Spannweitenposition. Die Schnitte werden nach y neu sortiert. |
| x | mm | 1 | −1 000 000 bis 1 000 000 | Lage der Profilnase in Profiltiefenrichtung; positiv = nach hinten (Pfeilung nach hinten) |
| z | mm | 1 | −1 000 000 bis 1 000 000 | Höhe der Profilnase (V-Form) |
| **Tiefe** (Chord) | mm | 1 | 1 bis 100 000 | Profiltiefe (Maßstab des Profils) |
| **Schränkung** (Twist) | ° | 0,1 | −360 bis 360 | Drehung um den Drehpunkt; positiv = Nase hoch. |

| Schaltfläche | Wirkung |
| --- | --- |
| **+** | Fügt einen Schnitt auf halbem Weg zum nächsten ein: Mittelwert von y, x, z, Profiltiefe und Schränkung; Profil des aktuellen Schnitts. In der Randzeile: Kopie des Randschnitts, eine Feldlänge weiter außen (mindestens 10 mm). Gesperrt bei 20 000 Schnitten (Tooltip `Höchstens 20.000 Schnitte: Bei mehr geht einem Browser-Tab auf dem Desktop der Speicher aus.`). |
| **×** | Löscht den Schnitt. Gesperrt, solange nur 2 Schnitte vorhanden sind. |

**+** weist das Einfügen mit einer Fehlermeldung ab, wenn:

- der Mittelwert der y-Werte der beiden Nachbarschnitte nicht echt zwischen ihnen liegt oder sich sein Spannweitenanteil nicht von denen beider Nachbarn unterscheidet (unterscheidbar: mehr als 4 Einheiten der letzten Stelle und mehr als 2^-1021, wie unter [Prüfungen](#prüfungen)): `Zwischen y = … mm und y = … mm liegt keine Spannweitenposition. Zuerst die beiden Schnitte auseinanderschieben.`
- die Kopie des Randschnitts jenseits von y = 1 000 000 mm läge: `Ein Schnitt weiter außen als der Randschnitt läge jenseits von y = 1.000.000 mm.`
- die Kopie des Randschnitts die Spannweite so weit verlängert, dass sich die Spannweitenanteile zweier benachbarter Schnitte nicht mehr unterscheiden: `Ein Schnitt bei y = … mm weiter außen als der Randschnitt macht die Spannweite zu lang für die Schnitte bei y = … mm und y = … mm. Zuerst die beiden Schnitte auseinanderschieben.` Das Ziehen des Randschnitts in der Registerkarte **Grundriss** (Planform) hält unter derselben Bedingung an.

Tooltip von **+**: `Einen Schnitt nach diesem einfügen`. Ergibt das Einfügen mehr als 200 Schnitte, ergänzt der Tooltip die Schätzung aus Abschnitt [Projektgröße](#projektgröße): `Einen Schnitt nach diesem einfügen. Mit … Schnitten: Jede Änderung dauert … und belegt … Arbeitsspeicher.`

- Ein y, das ein anderer Schnitt bereits hat, wird mit einer Fehlermeldung abgewiesen (`Ein anderer Schnitt liegt bereits bei y = … mm; …`). Das Eingabefeld behält seinen vorherigen Wert.
- Ein eingegebener Wert außerhalb der Grenze wird auf die nächste Grenze gesetzt, z. B. wird ein negatives y zu 0 und eine Profiltiefe unter 1 mm zu 1 mm. Schritte mit den Pfeiltasten oder den Pfeilen im Eingabefeld enden an den Grenzen. Die Grenzen gelten auch für Projektdateien ([[Dateiformate|Dateiformate]]).
- Ein Klick irgendwo in eine Zeile außerhalb ihrer Eingabefelder, Auswahllisten und Schaltflächen wählt den Schnitt aus, auch in der Kartenansicht schmaler Bildschirme. Die Zeile wird markiert, die 3D-Ansicht zeichnet die Schnittkontur rot, der Grundriss-Editor Tiefenlinie und Griffe des Schnitts rot. Die Auswahl baut den Flügel nicht neu auf: Sie braucht 2 ms JavaScript bei 200 Schnitten und 100 bis 110 ms bei 20 000 Schnitten.
- Profil-Auswahllisten: Bei mehr als 20 000 Listeneinträgen (Schnitte × Projektprofile) enthält jede Liste nur ihr gewähltes Profil, bis sie den Fokus erhält oder angeklickt wird; dann listet sie alle Projektprofile.
- Ändert sich y von Wurzel- oder Randschnitt, skalieren die y-Werte der Leitkurvenpunkte linear auf den geänderten Bereich von Wurzel bis Rand.
- Zwischen den Schnitten werden x, z, Profiltiefe, Schränkung und Profilform entlang der Spannweite interpoliert (**Einstellungen** > **Interpolation in Spannweitenrichtung** (Spanwise interpolation)).

Mit eingeschalteter Leitkurve verwendet der Flügel den Wert der Leitkurve statt des eingegebenen Werts. Der verwendete Wert steht unter dem Eingabefeld als `Leitkurve: 12,3`, wenn er um mehr als 0,05 mm abweicht:

| Eingeschaltete Leitkurven | Überschriebene Spalte |
| --- | --- |
| Nasenlinie oder Endlinie | x |
| Nasenlinie und Endlinie | x und **Tiefe** |

Mit **Einstellungen** > **Flügelende** (Wing tip) = **Spitz** (Pointed) verwendet der Flügel die eingegebene Randtiefe nicht. Die Zelle **Tiefe** der Randzeile zeigt die verwendete Randtiefe mit 2 Nachkommastellen, z. B. `Randtiefe: 1,25`. `(min.)` folgt, wenn die Untergrenze von 1 mm greift, z. B. `Randtiefe: 1,00 (min.)`.

## Grundriss

![Grundriss-Editor: Nasenlinie und Endlinie an (elliptischer Grundriss), Tabelle der Leitkurvenpunkte](images/de/planform.png)

Der Grundriss-Editor zeigt den Halbflügel von oben: Spannweite y nach rechts, Profiltiefe x nach unten, y = 0 auf der senkrechten Achse. Die Rasterbeschriftung (`Raster … mm`) nennt den Rasterabstand in mm (Reihe 1-2-5, mindestens 60 px Abstand: 60 bis 150 px).

| Werkzeugleiste | Wirkung |
| --- | --- |
| **Einpassen** (Fit) | Passt die Schnitte, Punkte und Kurven der eingeschalteten Leitkurven, den aufgebauten Umriss und bei eingeschaltetem **Spiegelbild** (Mirror) das Spiegelbild in die Zeichenfläche ein |
| **+** / **−** | Zoom um Faktor 1,25 / 0,8 um die Mitte der Zeichenfläche |
| **Spiegelbild** | Graues Spiegelbild der anderen Hälfte. Nur Anzeige; Vorgabe: an; wird nicht gespeichert. |

| Griff | Sichtbar, wenn | Wirkung beim Ziehen |
| --- | --- | --- |
| Blaues Quadrat an der Profilnase eines Schnitts | Nasenlinie aus; nicht an einem Randschnitt mit **Spitz** (Pointed), solange die Endlinie an ist | Verschiebt x und y des Schnitts; x bleibt innerhalb von ±1 000 000 mm. Die Endleiste bleibt stehen (Endlinie an: die Endlinie beim geänderten y); die Profiltiefe ändert sich im Bereich 1 bis 100 000 mm. y hält 1 mm Abstand zu den Nachbarschnitten (Nachbarn näher als 4 mm: ein Viertel der Lücke). Der Wurzelschnitt behält sein y. y des Randschnitts bleibt höchstens 1 000 000 mm. Ein y, dessen Spannweitenanteil sich nicht von dem eines Nachbarn unterscheiden würde (4 Einheiten der letzten Stelle, 2^-1021), wird nicht übernommen; der Schnitt behält sein y. |
| Blauer Kreis an der Endleiste eines Schnitts | Endlinie aus; nicht an einem Randschnitt mit **Spitz** | Setzt die Profiltiefe (1 bis 100 000 mm) |
| Raute auf einer Leitkurve (grün: Nasenlinie, braun: Endlinie) | Leitkurve an | Verschiebt den Punkt; x bleibt innerhalb von ±1 100 000 mm. Wurzel- und Randpunkt bewegen sich nur in x. Innere Punkte halten in y 0,5 mm Abstand zu ihren Nachbarn (Nachbarn näher als 2 mm: ein Viertel der Lücke). Ein y, dessen normierter Wert sich nicht von dem eines Nachbarn unterscheiden würde, lässt das y des Punkts unverändert; die Punkttabelle wendet dieselbe Regel an. |

- Gezogene Werte werden auf 0,1 mm gerundet.
- Die Zeile unter der Zeichenfläche zeigt die Werte während des Ziehens.
- Der ausgewählte Schnitt und der ausgewählte Leitkurvenpunkt sind rot. Ein Klick auf den Hintergrund, **Auf Schnitte zurücksetzen** (Reset to sections) und das Ein- oder Ausschalten der Leitkurve heben die Auswahl des Leitkurvenpunkts auf.
- Ein Randschnitt mit **Spitz** hat keinen Griff an der Endleiste: Seine Profiltiefe ist die skalierte Profiltiefe des vorigen Schnitts. Bei eingeschalteter Endlinie hat er auch keinen Griff an der Profilnase: Sein x der Profilnase ist x der Endlinie minus Profiltiefe.
- Das Ziehen eines Schnitts setzt ausgeschaltete, nicht bearbeitete Leitkurven auf die neuen Schnittkanten, wie eine Änderung in der Tabelle der Registerkarte **Schnitte** (Sections). Nach einem Neuladen beginnt eine solche Leitkurve beim Einschalten an den gezogenen Kanten.

### Leitkurven

Eine Leitkurve ist eine ebene NURBS-Kurve in der Grundrissebene (x, y). Die Nasenlinie legt die Nasenleiste fest, die Endlinie die Endleiste, auch zwischen den Schnitten. Berechnung: [[Geometrie|Geometrie]].

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
- Fehler: Die Kurve läuft in y zurück (geprüft an 401 Kurvenpunkten). Abhilfe: Punkte weiter auseinanderlegen oder **Kontrollpunkte** (Control points) verwenden.
- Fehler: Ein Kontrollpunkt der Kurve liegt jenseits von x = ±1 200 000 mm (Grenze der Leitkurven plus größte Profiltiefe). Mit **Durch Punkte** (Through points) schwingt die Kurve über, wenn die Punkte in y ungleichmäßig verteilt sind. Abhilfe: Punkte in y gleichmäßiger verteilen oder **Kontrollpunkte** verwenden.
- Fehler: Profiltiefe unter 1 mm an einer geprüften Spannweitenposition. Mit beiden Leitkurven an heißt das: Nasenlinie und Endlinie kommen sich näher als 1 mm, berühren oder kreuzen sich. Geprüft an 257 gleichmäßig verteilten Spannweitenpositionen sowie an jeder Station, jedem Kontrollpunkt und jedem Knoten der Leitkurven (die geprüften Spannweitenpositionen).
- Fehler: An einer geprüften Spannweitenposition liegt x der Profilnase, x der Endleiste oder z jenseits von ±1 200 000 mm, oder die Profiltiefe ist größer als 100 000 mm. Beispiel: Nasenlinie bei x = −1 100 000 mm, Endlinie bei x = 1 100 000 mm (Profiltiefe 2 200 000 mm).
- Mit **Einstellungen** (Settings) > **Flügelende** (Wing tip) = **Spitz** bleibt die Profiltiefe im letzten Feld mindestens gleich der Randtiefe. Nasenlinie und Endlinie dürfen sich dann am Rand treffen.
- Stationen: jeder Schnitt. Mit eingeschalteter Leitkurve oder mit **Glatt** (Smooth) wird jedes Feld in **Stationen je Feld** (Spanwise stations per panel) Intervalle geteilt (Vorgabe 8, Kosinusverteilung); Entwurfstyp **Segelflugmodell** (Glider): 17 Stationen.
- Flächengitter: Stationen × (2 · N + 1) Konturpunkte vor den hinzugefügten Stationen (N = **Stationen je Profilseite** (Chordwise stations per surface)). Stationen: Felder × **Stationen je Feld** + 1 mit eingeschalteter Leitkurve oder mit **Glatt**, sonst eine je Schnitt. **Einstellungen** zeigt die Anzahl (`Flächengitter: … Punkte.`).
- Über 60 000 Gitterpunkten ergänzt der Aufbau die Warnung `Großes Projekt` (Abschnitt [Projektgröße](#projektgröße)). Bis 5 000 000 Gitterpunkte verwendet der Flügel die Einstellungen wie eingegeben.
- Über 5 000 000 Gitterpunkten verwendet der Flügel weniger Intervalle je Feld, mit Warnung. Überschreitet auch ein Intervall je Feld 5 000 000 Gitterpunkte, bricht der Aufbau mit einem Fehler ab ([Prüfungen](#prüfungen)).
- Beispiele mit **Glatt**, 40 Intervallen je Feld und N = 200: 20 Schnitte: 761 Stationen, 305 161 Gitterpunkte; 1000 Schnitte: 12 Intervalle je Feld, 11 989 Stationen, 4 807 589 Gitterpunkte. Mit N = 200 überschreiten mehr als 12 468 Schnitte bei einer Station je Feld 5 000 000 Gitterpunkte; mit N = 60 (Vorgabe) ergeben 20 000 Schnitte 2 420 000 Gitterpunkte.
- Hinzugefügte Stationen: bis zu 32 in höchstens 6 Durchläufen; über 60 000 Punkten im Flächengitter 1 Durchlauf, denn jeder Durchlauf passt die ganze Fläche neu an. Die App setzt sie an den geprüften Spannweitenpositionen, an denen die Fläche um mehr als 0,5 mm oder 10 % der örtlichen Profiltiefe (der kleinere Wert gilt; Abstand im Raum) vom vorgesehenen Profil abweicht: je eine Station an jedem lokalen Maximum der Abweichung im Verhältnis zu dieser Toleranz. Verglichene Punkte: Profilnase, oberer Endleistenpunkt und jede k-te Tiefenstation je Profilseite, k = **Stationen je Profilseite** / 6, abgerundet (5 Tiefenstationen bei der Vorgabe 60). Auch Schränkung zwischen den Stationen fügt Stationen hinzu: Entwurfstyp **Pfeilnurflügel** (Swept flying wing), 3 Schnitte, 2 hinzugefügte Stationen.
- Behaltene Anpassung: Von den Anpassungen vor und nach jedem Durchlauf behält der Aufbau die mit der kleinsten größten Abweichung im Verhältnis zu ihrer Toleranz, bei Gleichstand die Anpassung vor dem Durchlauf. Dicht beieinander hinzugefügte Stationen können die Anpassung ausschwingen lassen. Beispiel: 2 Schnitte, Nasenlinie mit einer Beule von 4 mm Höhe und 0,06 mm Breite: 3,67 mm Abweichung ohne hinzugefügte Stationen, 18 797 mm nach 32 hinzugefügten Stationen; der Aufbau behält die Anpassung ohne hinzugefügte Stationen und zeigt die Abweichungswarnung.
- Fehler zwischen den Stationen, geprüft an den geprüften Spannweitenpositionen und bei 0,25, 0,5 und 0,75 jedes Intervalls zwischen benachbarten Stationen: Die Profiltiefe der angepassten Fläche, gemessen in der vorgesehenen Profiltiefenrichtung, fällt unter 0,9 mm oder kehrt sich um (die Fläche faltet sich oder schnürt sich ein); die örtliche Dicke an einer verglichenen Tiefenstation fällt unter 0 (die Fläche stülpt sich um); die örtliche Dicke an einer verglichenen Tiefenstation zwischen 1 % und 99 % der Profiltiefe beträgt höchstens 0,001 % der Profiltiefe (Dicke null).
- Die hinzugefügten Stationen und die Abweichungswarnung verwenden nur die geprüften Spannweitenpositionen, nicht die Punkte bei 0,25, 0,5 und 0,75 der Stationsintervalle.

Bedienelemente je Leitkurve (Kästen **Nasenlinie (Nasenleiste)** (Nose line (leading edge)) und **Endlinie (Endleiste)** (End line (trailing edge))):

| Bedienelement | Verfügbar | Werte | Vorgabe | Wirkung |
| --- | --- | --- | --- | --- |
| **Leitkurve verwenden** (Use guide curve) | immer | an, aus | aus | An: Die Kurve legt die Kante fest. Eine nie bearbeitete Leitkurve startet an den aktuellen Schnittkanten; eine bearbeitete Leitkurve behält ihre Punkte. Aus: Die Kante folgt den Schnitten. Solange sie aus ist, folgt eine unbearbeitete Leitkurve den Schnittkanten; eine bearbeitete behält ihre Punkte. Bearbeitet: ein Punkt wurde verschoben (Ziehen oder Punkttabelle), hinzugefügt oder gelöscht. Leitkurven aus dem Assistenten gelten als unbearbeitet, bis die Seite neu geladen oder das Projekt aus einer Datei geöffnet wird: Aus- und erneutes Einschalten ersetzt ihre Punkte durch die Schnittkanten (**Rückgängig** (Undo) stellt sie wieder her). Nach dem Neuladen oder nach **Öffnen** (Open) gilt eine ohne den Zustand „bearbeitet“ gespeicherte Leitkurve als bearbeitet, wenn ihre Punkte von den Schnittkanten abweichen: andere Punktanzahl oder eine Koordinate mehr als 1e-9 mm daneben. |
| **Modus** (Mode) | Leitkurve an (sonst gesperrt) | **Durch Punkte**, **Kontrollpunkte** | **Durch Punkte** | **Durch Punkte**: Die Kurve läuft durch jeden Punkt. **Kontrollpunkte**: Die Punkte bilden das Kontrollpolygon (gestrichelt). Die Kurve beginnt und endet im ersten und letzten Punkt und liegt sonst in der konvexen Hülle des Kontrollpolygons. |
| **Grad** (Degree) | Leitkurve an (sonst gesperrt) | 1 bis 5 | 3 | Polynomgrad; begrenzt auf Punktanzahl − 1 |
| **Punkt hinzufügen** (Add point) | Leitkurve an (sonst ausgeblendet); gesperrt bei 20 000 Punkten (Tooltip `Höchstens 20.000 Punkte je Leitkurve.`) | – | – | Fügt einen Punkt in der Mitte der größten Lücke in y ein. Tooltip: `Punkt in der größten Lücke hinzufügen`; bekäme die Kurve mehr als 500 Punkte, `Punkt in der größten Lücke hinzufügen. Mit … Punkten: Jede Änderung dauert … und belegt … Arbeitsspeicher.` (Abschnitt [Projektgröße](#projektgröße)) |
| **Gewählten Punkt entfernen** (Remove selected point) | Leitkurve an (sonst ausgeblendet); bedienbar, solange ein innerer Punkt ausgewählt ist | – | – | Löscht den ausgewählten inneren Punkt. Wurzel- und Randpunkt lassen sich nicht löschen. |
| **Auf Schnitte zurücksetzen** | Leitkurve an (sonst ausgeblendet) | – | – | Setzt alle Punkte auf die Schnittkanten und hebt den Zustand „bearbeitet“ auf |
| Punkttabelle | Leitkurve an (sonst ausgeblendet) | x, y in mm | – | x für jeden Punkt bearbeitbar, innerhalb von ±1 100 000 mm; y für innere Punkte bearbeitbar. y von Wurzel- und Randpunkt ist schreibgeschützt. |

## Profile

![Registerkarte Profile: Projektprofile, Hochladen, NACA-Generator, Bibliothek](images/de/airfoils.png)

Die Registerkarte **Profile** (Airfoils) hat die Bereiche **Projektprofile** (Project airfoils), **Hochladen** (Upload), **NACA-Generator** (NACA generator) und **Bibliothek** (Library).

### Projektprofile

| Element | Wirkung |
| --- | --- |
| Listeneintrag | Kontur, Name, Punktanzahl, Quellenangabe, `unbenutzt`, wenn kein Schnitt das Profil verwendet |
| **Anzeigen** (View) | Öffnet die Vorschau; Name und Quellenangabe sind schreibgeschützt. Einzige Schaltfläche ist **Schließen** (Close). |
| **.dat** | Lädt das Profil als Selig-Datei `.dat` mit 7 Nachkommastellen herunter (mehr bei Konturen kleiner als 1, siehe [[Dateiformate]]) |
| **×** | Entfernt das Profil. Gesperrt, solange ein Schnitt es verwendet. |
| **Unbenutzte entfernen** (Remove unused) | Entfernt alle Profile, die kein Schnitt verwendet |

Das Hinzufügen eines Profils und das Entfernen eines Profils, das kein Schnitt verwendet, aktualisiert die Profillisten, die Größenwarnung und die automatische Sicherung, ohne den Flügel neu aufzubauen.

**Zum Projekt hinzufügen** (Add to project) legt keinen zweiten Eintrag an, behält den vorhandenen Eintrag und verwirft den neuen Namen und die neue Quellenangabe, wenn:

- ein Projektprofil denselben Namen und dieselben Punkte hat;
- ein Projektprofil ein erzeugtes NACA-Profil mit derselben Bezeichnung und derselben Einstellung **Geschlossene Endleiste** (Closed trailing edge) ist (Name beliebig) und seine gespeicherten Punkte die der NACA-Gleichungen sind (innerhalb von 1e-9) oder den neuen Punkten gleichen (den geprüften Punkten der Vorschau).

Die Meldung lautet dann `Das Projekt enthält dieses Profil bereits als „…“.` statt `Profil „…“ hinzugefügt.`, und der Bearbeitungsverlauf erhält keinen Schritt.

Grenzen der Projektprofile (Abschnitt [Projektgröße](#projektgröße)):

| Grenze | Registerkarte **Profile** (Hochladen von Dateien, Einfügen von Text, NACA-Generator, Bibliothek) | **Öffnen** (Open) |
| --- | --- | --- |
| 10 000 Profile | Bei 10 000 Profilen öffnet sich keine Vorschau: rote Meldung `Das Projekt enthält 10.000 Profile und hat damit die Grenze erreicht; „Unbenutzte entfernen“ schafft Platz.` | Mehr Profile: `Höchstens 10.000 Profile werden unterstützt (… gefunden).` |
| 1 000 000 Profilpunkte insgesamt | Ein Profil, das die Summe über 1 000 000 brächte, öffnet keine Vorschau und wird nicht hinzugefügt: rote Meldung `Mit diesem Profil enthalten die Projektprofile … Punkte; die Grenze liegt bei 1.000.000. „Unbenutzte entfernen“ gibt Punkte frei.` | Mehr Punkte: `Die Profile enthalten zusammen … Punkte; die Grenze liegt bei 1.000.000.` |
| 100 000 Punkte je Profil | Fehler `too-many-points` in der Vorschau ([[Dateiformate]]) | Mehr Punkte: `Profil … hat … Punkte; die Grenze liegt bei 100.000.` |

- Über 200 Profilen oder über 100 000 Profilpunkten insgesamt ergänzt der Flügelaufbau die Warnung `Großes Projekt`.
- Listen und Meldungen zeigen von einem längeren Profilnamen die ersten 200 Zeichen, gefolgt von `…`.

### Hochladen

| Eingabe | Regel |
| --- | --- |
| Dateien | `.dat`, `.txt`, `.cor`, `.xml`, `.htm`, `.html`, `.csv`. Auf die Ablagefläche ziehen oder **Dateien wählen** (Choose files) verwenden. Mehrere Dateien öffnen nacheinander je eine Vorschau. Eine Datei über 20 MB wird nicht gelesen: rote Meldung `<Datei>: … MB; Profildateien sind auf 5.000.000 Zeichen begrenzt.` Eine Datei, die der Browser nicht lesen kann: rote Meldung `<Datei>: Der Browser konnte die Datei nicht lesen (NotReadableError).` |
| Eingefügter Text | Koordinaten in den Textbereich einfügen, dann **Eingefügten Text prüfen** (Check pasted text). |
| Zeichenkodierung | UTF-8 (Unicode Transformation Format, 8 Bit); eine Datei, die kein gültiges UTF-8 ist, wird als Windows-1252 gelesen. |
| Aufbau und Prüfungen | Selig, Lednicer, Tabelle x/Oberseite/Unterseite, XML (Extensible Markup Language), HTML (HyperText Markup Language): siehe [[Dateiformate]] |

![Vorschau „Hochladen: sample4412.txt“ einer Prozenttabelle mit Dezimalkomma: Dateipunkte, NURBS-Kurve, Meldungen unter Info und Warnung](images/de/upload-preview.png)

| Element der Vorschau | Inhalt |
| --- | --- |
| Zeichnung | Linie: NURBS-Interpolation; bei einem Fehler der Plausibilitätsprüfungen gerade Strecken durch die Dateipunkte. Punkte: Dateipunkte (**Datenpunkte zeigen** (Show data points), Vorgabe an). Rote Kreise: Ort eines gemeldeten Problems. Verschieben und Zoomen wie im Grundriss-Editor. |
| **Name** | Aus der Namenszeile der Datei, sonst der Dateiname; eingefügter Text ohne Namenszeile: `Eingefügtes Profil` (englische Oberfläche: `pasted`). Bearbeitbar. |
| **Quelle / Urheber** (Source / attribution) | Wird in der Projektdatei gespeichert. Vorbelegt für Namen, die mit `HS` und einem Leerzeichen oder Bindestrich beginnen (`HS 3.4`, `HS-1.4`): `Hartmut Siegmann, www.aerodesign.de`. Vorbelegt für Namen, die mit `MH`, einem optionalen Leerzeichen oder Bindestrich und einer Ziffer beginnen (`MH45`, `MH 60`): `Martin Hepperle, www.mh-aerotools.de`. Groß- und Kleinschreibung spielt keine Rolle. Vorbelegt für eine mitgelieferte Bibliotheksdatei mit ihrem Autor aus `index.json`. |
| Formatzeile | Erkanntes Format und Punktanzahl (`Format: Tabelle, 27 Punkte`; die Formate `selig`, `lednicer` und `xml` erscheinen unübersetzt) |
| Meldungen | **Fehler** (Error): verhindert das Hinzufügen. **Warnung** (Warning): Hinzufügen möglich. **Info**: Fakten, z. B. Dicke, Wölbung und Endleistendicke in % der Profiltiefe oder die Anzahl entfernter Punkte, die näher als das 1e-9-Fache der Profiltiefe am vorherigen Punkt liegen. Über 5000 Punkten: Warnung `… Punkte (Warnung über 5.000): Die Prüfungen und der erste Aufbau eines Flügels, der das Profil verwendet, dauern ….` Eine Profilseite, die an mehr als 50 Punkten in x zurückläuft: Fehler `Die Oberseite läuft an … Punkten in x zurück; die Grenze liegt bei 50.` (für die Unterseite: `Die Unterseite läuft an … Punkten in x zurück; die Grenze liegt bei 50.`). Nach bestandenen Plausibilitätsprüfungen weist die Vorschau zusätzlich eine NURBS-Kurve ab, die sich selbst kreuzt oder in x zurückläuft, und Punkte, an denen die NURBS-Interpolation scheitert (`Die NURBS-Interpolation durch die Punkte ist fehlgeschlagen (…).`). Alle drei sind Fehler `curve-shape` ([[Dateiformate]]). |
| **Zum Projekt hinzufügen** | Fügt das Profil hinzu. Gesperrt und mit **Hinzufügen nicht möglich (Fehler)** (Cannot add (errors)) beschriftet, solange ein Fehler vorliegt. |

### NACA-Generator

| Bedienelement | Werte | Wirkung |
| --- | --- | --- |
| Eingabefeld für die Bezeichnung | 4 oder 5 Ziffern, Präfix `NACA` optional (`2412`, `NACA 23012`) | Profilbezeichnung |
| **Geschlossene Endleiste** | an, aus (Vorgabe aus) | Aus: Standard-Dickengleichung, offene Endleiste. An: Koeffizient −0,1036 statt −0,1015, geschlossene Endleiste. |
| **Vorschau** (Preview) | – | Öffnet die Vorschau |

| Reihe | Gültige Bezeichnung |
| --- | --- |
| 4-stellig | Ziffern 3–4 (Dicke) größer als 00; Ziffern 1 und 2 beide 0 oder beide ungleich 0 |
| 5-stellig, Standard | Ziffer 1: 1–9; Ziffer 2: 1–5; Ziffer 3: 0; Ziffern 4–5 größer als 00 |
| 5-stellig, S-Schlag | Ziffer 1: 1–9; Ziffer 2: 2–5; Ziffer 3: 1; Ziffern 4–5 größer als 00 |

- Erzeugte Profile haben 161 Punkte (81 je Seite, Kosinusverteilung) und den Namen `NACA <Bezeichnung>`.
- Offene und geschlossene Variante einer Bezeichnung tragen denselben Namen. Zur Unterscheidung in der Schnittliste eine davon im Eingabefeld **Name** der Vorschau umbenennen.

### Bibliothek

- **Bibliothek filtern** (Filter library) durchsucht Name, Kategorie und Verwendungstext.
- Die Bibliothek enthält 17 erzeugte NACA-Profile und 6 mitgelieferte Koordinatendateien (`public/airfoils/index.json`, in die App eingebunden, sodass die Bibliothek keinen Netzzugang braucht). Die Liste zeigt zuerst die NACA-Profile, dann die Dateien in der Reihenfolge des Index.
- Text unter jedem Namen: NACA-Profil: Kategorie, Verwendung, `erzeugt`. Mitgelieferte Datei: Kategorie, Verwendungstext, Autor, Lizenzkennung.
- Jeder Eintrag: **Vorschau** öffnet die Vorschau. NACA-Einträge folgen dem Kontrollkästchen **Geschlossene Endleiste** des NACA-Generators. Eine mitgelieferte Datei wird von `airfoils/<file>` unter der eigenen Adresse der App geladen.
- **Zum Projekt hinzufügen** speichert bei einer mitgelieferten Datei das Feld **Quelle / Urheber** (vorbelegt mit dem Autor), die Lizenzkennung, die Quelladresse und die Adresse der Bedingungen im Projektprofil (Objekt `source`, [[Dateiformate|Dateiformate]]).
- Die deutsche Oberfläche zeigt Kategorie, Verwendungstext und `erzeugt` auf Deutsch, die englische auf Englisch. **Bibliothek filtern** durchsucht Kategorie und Verwendungstext in der angezeigten Sprache. Name, Autor und Lizenzkennung lauten in beiden Sprachen gleich. Die Tabellen unten nennen die deutschen Texte.

NACA-Profile:

| Bezeichnung | Kategorie | Verwendung |
| --- | --- | --- |
| 0006 | Symmetrisch | Dünne Leitwerke |
| 0008 | Symmetrisch | Leitwerke |
| 0009 | Symmetrisch | Leitwerke, Seitenflossen |
| 0010 | Symmetrisch | Leitwerke, Randprofile von Nurflügeln |
| 0012 | Symmetrisch | Kunstflugflügel, Seitenruder |
| 0015 | Symmetrisch | Dicke Kunstflugflügel |
| 2408 | Gewölbt | Dünne Sportflügel |
| 2410 | Gewölbt | Sportflügel, Randprofile |
| 2412 | Gewölbt | Trainer und Sportmodelle |
| 2415 | Gewölbt | Langsame Trainer |
| 4412 | Gewölbt | Langsamflieger, hoher Auftrieb |
| 4415 | Gewölbt | Langsamflieger, Scale-Modelle |
| 6409 | Gewölbt | Modelle mit hohem Auftrieb bei niedriger Geschwindigkeit |
| 23012 | Gewölbt | Scale- und Sportmodelle |
| 23015 | Gewölbt | Dicke Scale-Flügel |
| 23112 | S-Schlag | Fünfstelliges S-Schlag-Profil (Nurflügel-Versuche) |
| 24112 | S-Schlag | Fünfstelliges S-Schlag-Profil |

Mitgelieferte Dateien (Verwendungstext gekürzt; Dicke aus dem Verwendungstext):

| Name | Kategorie | Verwendung | Dicke | Punkte | Quelle | Lizenzkennung |
| --- | --- | --- | --- | --- | --- | --- |
| Clark Y | Gewölbt | Modellflugzeuge von Freiflug-Segelflugmodellen bis zu ferngesteuerten Scale-Modellen | 11,7 % der Profiltiefe | 33 | NACA Report No. 502, Table I; Profil von Virginius E. Clark | `public-domain` |
| NACA 8-H-12 | S-Schlag | Profil für Hubschrauber-Rotorblätter; verwendet an den manntragenden schwanzlosen Segelflugzeugen Kasper Bekas und Brochocki BKB-1; Verwendung an Modellen: in den geprüften Quellen nicht belegt | 12,0 % der Profiltiefe | 51 | NACA Technical Note 1998, Table I | `public-domain` |
| NACA M-6 | S-Schlag | S-Schlag-Profil, nickstabil, mit kleiner Druckpunktwanderung; mögliches Profil für Nurflügel | 12,0 % der Profiltiefe | 35 | NACA Report No. 221, Table XXIX | `public-domain` |
| RAF 34 | Gewölbt | Flügelprofil manntragender Flugzeuge wie der Comper Streak und, in abgewandelter Form, der de Havilland DH-98 Mosquito; für Scale-Modelle solcher Flugzeuge | 12,6 % der Profiltiefe | 33 | Tabelle des Royal Aircraft Establishment (RAE) in NACA Report No. 286 | `public-domain` |
| S9104 | Gewölbt | Profil für hohe Zuladung und hohen Auftrieb | 12,1 % der Profiltiefe | 81 | Michael Selig, University of Illinois Urbana-Champaign | `CC-BY-4.0` |
| USA 35B | Gewölbt | Flügelprofil der manntragenden Piper J-3 Cub und PA-18 Super Cub; für Scale-Modelle dieser Flugzeuge | 11,6 % der Profiltiefe | 33 | NACA Report No. 233, Table XXXVI | `public-domain` |

- Quelle, Rechtsgrundlage, Bedingungen und Text der Quellenangabe je Datei: [NOTICE.md](https://github.com/subtilitas/Wingdesigner/blob/main/public/airfoils/NOTICE.md).
- Clark Y, NACA 8-H-12, NACA M-6, RAF 34 und USA 35B: in den Vereinigten Staaten gemeinfrei (public domain). Ihr Status außerhalb der Vereinigten Staaten ist nicht geklärt.
- S9104: Lizenz Creative Commons Attribution 4.0 International (CC BY 4.0). Die Projektdatei behält die Quellenangabe. Der `.dat`-Download und die 3D-Modelldateien aus [Export](#export) enthalten keine; wer eine solche mit S9104 erstellte Datei weitergibt, fügt den Text der Quellenangabe aus NOTICE.md hinzu.
- RAF 34: 7 Werte des Quellscans sind unsicher, um bis zu 0,20 % der Profiltiefe (0,40 mm bei 200 mm Profiltiefe). NOTICE.md führt sie auf.
- Clark Y und USA 35B behalten die veröffentlichte Basislinie: Die Profilnase liegt 3,50 % bzw. 2,76 % der Profiltiefe über der x-Achse. Die Vorschau zeigt die Warnung `Die Linie von der Profilnase zur Endleiste ist um -1,97 Grad geneigt; …` (USA 35B: -1,51). Die Schränkung bezieht sich auf die x-Achse der Datei: Bei gleicher Schränkung steht die Profilsehne von Clark Y um 1,97° und die von USA 35B um 1,51° stärker Nase hoch als die eines Profils mit der Sehne auf der x-Achse.
- Nicht mitgeliefert: Daten unter Share-Alike-Lizenz (JX-Bibliothek, Creative Commons Attribution-ShareAlike 4.0), Copyleft-Daten (Mark Drela, GNU General Public License 2.0 oder neuer; GNU: „GNU’s Not Unix“) und die PROFOIL-Testprofile. Entscheidungen mit Begründung: [RECORD.md](https://github.com/subtilitas/Wingdesigner/blob/main/RECORD.md).

### Externe Quellen

Der Kasten **Weitere Profile (extern, nicht mitgeliefert)** (More airfoils (external, not bundled)) verlinkt 3 Sammlungen. Die App liefert keine Dateien daraus mit; die mitgelieferte Datei S9104 stammt von der eigenen Seite des Konstrukteurs, nicht aus der Datenbank der University of Illinois Urbana-Champaign (UIUC). Datei dort herunterladen, dann im Bereich **Hochladen** einlesen. Bedingungen und Zitate: [[Profilquellen|Profilquellen]].

| Link | Inhalt | Bedingungen (Kurzfassung) |
| --- | --- | --- |
| aerodesign.de - Hartmut Siegmann | HS-Profile und Kataloge für Brettnurflügel, Pfeilnurflügel und Segelflugmodelle | Privat, im Verein, kleingewerblich und wissenschaftlich mit Namen und Quelle; Großserien und industrielle Anwendungen brauchen eine schriftliche Nutzungsvereinbarung; Weiterverbreitung durch Dritte zum Teil eingeschränkt |
| MH-AeroTools - Martin Hepperle | MH-Profile, z. B. MH 45 und MH 60 für Nurflügel, MH 32 für Segelflugmodelle | Persönlicher Gebrauch; Veröffentlichungen nennen die Quelle; eine Neuzusammenstellung darf nicht über den Herstellungskosten verkauft werden |
| UIUC Airfoil Coordinates Database (University of Illinois Urbana-Champaign) | Etwa 1650 Profile im Selig-Format (Anzahl laut Koordinatenseite) | Keine Lizenz für die Koordinatendateien angegeben; es gelten die Rechte des jeweiligen Konstrukteurs |

- Die Hinweise in der App lauten „Etwa 1.600 Profile“ (UIUC) und „gewerbliche Nutzung braucht eine schriftliche Erlaubnis“ (aerodesign.de). Es gelten die zitierten Bedingungen in [[Profilquellen|Profilquellen]].

## Einstellungen

![Registerkarte Einstellungen: Gruppe Language / Sprache, Gruppe Geometrie mit Flügelende, Gruppe Auflösung](images/de/settings.png)

Die Registerkarte **Einstellungen** (Settings) hat die Gruppen **Language / Sprache**, **Geometrie** (Geometry), **Auflösung** (Resolution) und **Anzeige** (Display).

| Gruppe | Einstellung | Werte | Vorgabe | Wirkung |
| --- | --- | --- | --- | --- |
| **Language / Sprache** | Auswahlliste | **English**, **Deutsch** | Deutsch, wenn die erste Sprache des Browsers Deutsch ist, sonst Englisch | Sprache aller Texte der Oberfläche. Abschnitt [Sprache](#sprache). |
| **Geometrie** | **Projektname** (Project name) | Text | Name des Entwurfstyps | Name in der Projektdatei; Grundlage der Dateinamen von **Speichern** (Save) und **Exportieren** (Export). `.dat`-Downloads verwenden den Profilnamen. Ein Name über 200 Zeichen ergänzt `ein Name mit … Zeichen (Warnung über 200)` in der Warnung `Großes Projekt`, sobald der Name übernommen ist; ein kürzerer Name entfernt es. |
| **Geometrie** | **Interpolation in Spannweitenrichtung** (Spanwise interpolation) | **Linear zwischen den Schnitten (gerade Felder)** (Linear between sections (straight panels)), **Glatt (natürlicher kubischer Spline durch die Schnitte)** (Smooth (natural cubic spline through sections)) | Linear | Übergang der Schnittwerte entlang der Spannweite. Siehe Liste unten. |
| **Geometrie** | **Drehpunkt der Schränkung (Anteil der Profiltiefe)** (Twist pivot (fraction of chord)) | 0 bis 1, Schritt 0,05 | 0,25 | Punkt auf der Profilsehne, um den die Schränkung dreht |
| **Geometrie** | **Endleiste** (Trailing edge) | **Wie in den Profildateien** (As in the airfoil files), **Geschlossen (scharf)** (Closed (sharp)), **Feste Dicke in mm** (Fixed thickness in mm) | Feste Dicke (Assistent, Beispielflügel); Wie in den Profildateien für Projektdateien ohne diese Einstellung | Endleistendicke jeder Station |
| **Geometrie** | **Flügelende** (Wing tip) | **Flach (am Randschnitt abgeschnitten)** (Flat (cut at the tip section)), **Spitz (Randprofil verkleinert)** (Pointed (tip profile scaled down)) | Flach; Assistent: dessen Eingabefeld **Flügelende** (Tip) | Flach: Der Flügel endet am Randschnitt. Spitz: siehe Liste unten. |
| **Geometrie** | **Maßstab des Randprofils 1 : N der Tiefe des vorherigen Schnitts** (Tip profile scale 1 : N of the previous section chord) | N = 100 bis 1000, Schritt 50 | 200 | Nur sichtbar mit **Spitz** |
| **Geometrie** | **Endleistendicke (mm)** (Trailing-edge thickness (mm)) | ≥ 0, Schritt 0,1 | Assistent: 0,2 % der Wurzeltiefe, mindestens 0,3; Beispielflügel: 0,5; Projektdatei ohne den Wert: 0,4 | Nur sichtbar mit **Feste Dicke in mm** |
| **Auflösung** | **Stationen je Profilseite** (Chordwise stations per surface) | 16 bis 200, Schritt 4 | 60 | Neuabtastung der Profile: N Stationen ergeben 2 · N + 1 Punkte je Kontur (60 → 121) |
| **Auflösung** | **Stationen je Feld mit Leitkurve oder glatter Interpolation** (Spanwise stations per panel with guides or smooth mode) | 3 bis 40 | 8 | Intervalle je Feld, Kosinusverteilung; nur wirksam mit eingeschalteter Leitkurve oder mit **Glatt**. Weniger Intervalle erst über 5 000 000 Punkten im Flächengitter (Abschnitt [Leitkurven](#leitkurven)). |
| **Auflösung** | **Parametrisierung der Profile** (Profile parametrization) | **Zentripetal (empfohlen)** (Centripetal (recommended)), **Sehnenlänge** (Chord length), **Gleichabständig** (Uniform) | Zentripetal | Parameterverteilung der NURBS-Interpolation der Profile, im Flügelaufbau und in der Profilvorschau |
| **Anzeige** | **Gespiegelte Hälfte zeigen (y < 0)** (Show mirrored half (y < 0)) | an, aus | an | Nur 3D-Ansicht. Die Registerkarte **Prüfungen** (Checks), die Statusleiste und der Assistent nennen immer beide Hälften. Wird im Projekt gespeichert. |
| **Anzeige** | **NURBS-Kontrollnetz zeigen** (Show NURBS control net) | an, aus | aus | Nur 3D-Ansicht; wird nicht gespeichert. Über 100 000 Netzsegmenten zeichnet die Ansicht jede k-te Kontrolllinie in jeder Richtung, erste und letzte eingeschlossen. Überschreiten schon die erste und letzte Linie 100 000 Segmente (z. B. 33 × 151 000 Kontrollpunkte), verläuft jede gezeichnete Linie zudem nur durch jeden k-ten Kontrollpunkt, erster und letzter eingeschlossen. |
| **Anzeige** | **Schnittkonturen zeigen** (Show section outlines) | an, aus | an | Nur 3D-Ansicht; wird nicht gespeichert. Über 100 000 Kontursegmenten (2 · N je Schnitt, 2 · N + 1 bei offener Endleiste) zeichnet die Ansicht jede k-te Kontur, Wurzel und Rand eingeschlossen; der ausgewählte Schnitt wird immer gezeichnet. |

Unter **Stationen je Feld** nennt ein Hinweis die Punkte im Flächengitter bei den aktuellen Einstellungen (Abschnitt [Leitkurven](#leitkurven)), z. B. Entwurfstyp **Segelflugmodell** (Glider): `Flächengitter: 2.057 Punkte.`

- Nach einer Verringerung über 5 000 000 Gitterpunkten ergänzt der Hinweis `, … Stationen je Feld in Spannweitenrichtung statt …` (bei einer Station `, 1 Station je Feld in Spannweitenrichtung statt …`).
- Über 60 000 Gitterpunkten erscheint der Hinweis in Warnfarbe und ergänzt die Schätzung aus Abschnitt [Projektgröße](#projektgröße): `Flächengitter: … Punkte; über 60.000: Jede Änderung dauert … und belegt … Arbeitsspeicher.`

Interpolation in Spannweitenrichtung:

- **Linear** ohne Leitkurve: Stationen an den Schnitten und hinzugefügte Stationen (Abschnitt [Leitkurven](#leitkurven)); gerade Linien zwischen den Stationen (Grad 1 in Spannweitenrichtung).
- **Linear** mit eingeschalteter Leitkurve: **Stationen je Feld** Intervalle je Feld; Grad 3 innerhalb jedes Felds, Knick an jedem Schnitt möglich. Senkt die Grenze des Flächengitters die Intervalle je Feld auf 2 oder 1, ist der Grad 2 oder 1 (z. B. 4200 Schnitte mit 200 **Stationen je Profilseite**: 2 Intervalle, Grad 2).
- **Glatt**: Die Schnittwerte folgen einem natürlichen kubischen Spline durch alle Schnitte; **Stationen je Feld** Intervalle je Feld (Vorgabe 8); Grad 3 in Spannweitenrichtung.
- Fehler bei **Glatt**: Ein interpolierter Wert liegt um mehr als das 2-Fache des Bereichs seiner Schnittwerte außerhalb dieses Bereichs. Geprüfte Werte: x der Profilnase (keine Leitkurve an), Profiltiefe (nicht beide Leitkurven an), z, Schränkung und die Höhe jedes neu abgetasteten Konturpunkts außer den 2 Endleistenpunkten. Geprüft an den geprüften Spannweitenpositionen ([Leitkurven](#leitkurven)). Typische Ursache: ungleichmäßig verteilte Schnitte.
- Bei 2 Schnitten ergeben beide dieselben Werte für x, z, Profiltiefe und Schränkung.
- Die Flächen unterscheiden sich, wo sich Profil oder Schränkung entlang der Spannweite ändern. Eine gleichzeitige Änderung der Profiltiefe vergrößert den Unterschied.
- Ab 3 Schnitten unterscheiden sich die Flächen auch dort, wo x, z, Profiltiefe oder Schränkung an einem Schnitt ihre Steigung ändern. Beispiel: Entwurfstyp **Sportmodell** (Sport) mit 3 Schnitten, mittlere Profiltiefe 150 mm statt 192 mm, ein Profil, keine Schränkung: 8,08 mm.
- Ein Profil, keine Schränkung und eine von Wurzel bis Rand linear veränderte Profiltiefe ergeben keinen Unterschied.
- Größter Abstand der 2 Flächen bei gleichen Flächenparametern, Entwurfstypen des Assistenten: **Pfeilnurflügel** (Swept flying wing) 0,56 mm, **Sportmodell** 0,34 mm, **Segelflugmodell** 0,20 mm, **Trainer** 0,00 mm, **Brettnurflügel** (Plank) 0,00 mm, **Leitwerk** (Tail surface) 0,00 mm.
- Berechnung: [[Geometrie|Geometrie]].

Spitzes Flügelende (**Flügelende** = **Spitz**):

- Randtiefe = max(c_prev / N, 1 mm). c_prev ist die verwendete Profiltiefe am vorletzten Schnitt.
- Die eingegebene Randtiefe wird nicht verwendet.
- Im letzten Feld bleibt die Profiltiefe mindestens gleich der Randtiefe. Zusammenlaufende Leitkurven enden im verkleinerten Randprofil.
- Mit eingeschalteter Nasenlinie und Endlinie legt ihr Abstand am Rand die Randtiefe fest, wenn er größer als die verkleinerte Randtiefe ist. Ist er mehr als 0,5 mm größer, erscheint eine Warnung.
- Entwurfstyp **Segelflugmodell** mit dem Eingabefeld **Flügelende** = **Spitz**: Randtiefe 1,00 mm (Untergrenze 1 mm), 22 Stationen (17 + 5 hinzugefügt), größte Abweichung an den geprüften Spannweitenpositionen 0,263 mm, keine Warnung. Auch die übrigen Entwurfstypen des Assistenten mit **Flügelende** = **Spitz** ergeben keine Warnung.
- Innerhalb von 2 mm vor einem spitzen elliptischen Flügelende (Entwurfstypen des Assistenten) weichen x von Nasen- und Endleiste der Fläche höchstens 0,031 mm vom vorgesehenen Grundriss ab (2001 Spannweitenpositionen); die übrigen Konturpunkte dort sind nicht gemessen. Die Abweichungswarnung erfasst diese Positionen nicht.

Regeln für die Endleiste:

- Feste Dicke größer als 5 % der örtlichen Profiltiefe: an dieser Station auf 5 % begrenzt. Eine Warnung nennt die Anzahl der Stationen. Stationen im letzten Feld eines spitzen Flügelendes werden ohne Warnung begrenzt.
- Gemischte Endleisten, Bedingung: Nicht jede Station ist geschlossen, und mindestens eine Station hat eine Endleistendicke unter 0,01 mm. Beispiele: **Wie in den Profildateien** mit Profilen, die an einigen Stationen geschlossen und an anderen offen sind; **Feste Dicke in mm** über 0 und unter 0,01 mm.
- Gemischte Endleisten, Wirkung: Diese Stationen werden auf 0,01 mm geöffnet, mit Warnung. Die Warnung nennt `an manchen Stationen geschlossen und an anderen offen` auch dann, wenn keine Station geschlossen ist.
- Fehler: Die Einstellung zieht die Oberseite unter die Unterseite. Bedingung: **Geschlossen** oder **Feste Dicke** bei einem Profil, das innen dünner ist als seine Endleistendicke.
- Fehler: Die Einstellung lässt Oberseite und Unterseite sich berühren. Bedingung: **Geschlossen** oder **Feste Dicke**, Dicke höchstens 0,001 % der Profiltiefe zwischen 1 % und 99 % der Profiltiefe.

Einfluss der Auflösung auf Rechenzeit und Größe der STEP-Datei (STEP: Standard for the Exchange of Product model data):

| Fall | Stationen je Profilseite | Aufbau (Profile im Cache) | STEP-Export | STEP-Größe |
| --- | --- | --- | --- | --- |
| Entwurfstyp Segelflugmodell, elliptische Leitkurven, 17 Stationen in Spannweitenrichtung, beide Hälften | 60 | 36 ms | 6 ms | 445 KB |
| Entwurfstyp Segelflugmodell, elliptische Leitkurven, 17 Stationen in Spannweitenrichtung, beide Hälften | 200 | 89 ms | 19 ms | 1398 KB |

- Mittelwert aus 10 Läufen nach 2 Aufwärmläufen (STEP-Export: 3 Läufe); Node.js 24.21, Intel Xeon x86-64, 2,10 GHz, 4 Kerne, Load Average 3,3 (andere Prozesse liefen); 29.09.2026.
- 1 KB = 1024 Byte.
- Große Projekte im Browser: Abschnitt [Projektgröße](#projektgröße).
- Vollständige Messbedingungen und weitere Fälle: [[Entwicklung|Entwicklung]], Abschnitt Build- und Exportzeiten.
- Smartphones: nicht gemessen.

## Prüfungen

![Registerkarte Prüfungen mit den Grundrisskennwerten des Entwurfstyps Segelflugmodell](images/de/checks.png)

Die Registerkarte **Prüfungen** (Checks) trägt die Überschrift **Geometrieprüfungen** (Geometry checks). Jeder Eintrag der Liste beginnt mit **Fehler:** (Error) oder **Warnung:** (Warning).

| Zeile | Inhalt |
| --- | --- |
| Liste der Fehler und Warnungen | Alle Fehler und Warnungen des Flügels, sonst `Keine Fehler oder Warnungen.` |
| **Spannweite** (Span) | 2 × y des Randschnitts, in mm |
| **Flügelfläche** (Wing area) | beide Hälften, in dm² |
| **Streckung** (Aspect ratio) | Spannweite² / Flügelfläche |
| **Mittlere aerodynamische Flügeltiefe (MAC)** (Mean aerodynamic chord (MAC)) | mm |
| **Lage der MAC** (MAC position) | Spannweitenposition y der MAC und x ihrer Profilnase (`y … mm, Profilnase x … mm`) |
| **25 % MAC (geometrischer Bezugspunkt)** (25 % MAC (geometric reference)) | x des Punkts bei 25 % der MAC |
| **Wurzel- / Randtiefe** (Root / tip chord) | mm |
| **NURBS-Fläche** (Surface) | NURBS-Grad (Profiltiefenrichtung × Spannweitenrichtung) und Anzahl der Kontrollpunkte (`Grad … x …, … x … Kontrollpunkte`) |
| **Endleiste** (Trailing edge) | `geschlossen` oder `offen` |

- Flügelfläche, MAC und Lage der MAC: 5-Punkt-Gauß-Legendre-Quadratur des vorgesehenen Grundrisses (Profiltiefe und Nasenleiste über y) in jedem Intervall zwischen benachbarten Teilungspunkten: Wurzel, Rand, Schnitte und jeder Knoten und Kontrollpunkt einer eingeschalteten Leitkurve. Exakt für gerade Felder sowie für **Glatt** (Smooth) mit flachem Flügelende und ohne Leitkurven.
- Mit Leitkurven, Quadraturfehler der Flügelfläche gegenüber der Mittelpunktregel mit 200 000 Intervallen: −2,2 × 10⁻¹⁰ % (Entwurfstyp **Segelflugmodell** (Glider)), −2,1 × 10⁻⁹ % (Entwurfstyp **Segelflugmodell** mit spitzem Flügelende). Weitere Werte: [[Geometrie|Geometrie]].
- Wurzelschnitt nicht bei y = 0: Die Lücke zwischen den Hälften zählt zur Spannweite, nicht zur Flügelfläche.
- Der 25-%-MAC-Punkt ist ein geometrischer Bezugspunkt. Er ist keine Berechnung von Neutralpunkt oder Schwerpunkt. Die Registerkarte sagt es so: `Der 25-%-MAC-Punkt ist nur ein geometrischer Bezugspunkt; er ist keine Berechnung des aerodynamischen Neutralpunkts oder des Schwerpunkts.`

| Meldung | Schweregrad | Bedingung |
| --- | --- | --- |
| `Profil „…“: …` | Fehler | das Profil besteht die Plausibilitätsprüfungen nicht ([[Dateiformate]]), z. B. in einer geöffneten Projektdatei. Mit **Parametrisierung der Profile** (Profile parametrization) **Sehnenlänge** (Chord length) oder **Gleichabständig** (Uniform) endet jede Meldung `Profil „…“` mit `Die Einstellung „Zentripetal“ unter Einstellungen > Parametrisierung der Profile folgt den Punkten genauer.` |
| `Profil „…“: Die NURBS-Interpolation ist fehlgeschlagen (…).` | Fehler | die NURBS-Interpolation des Profils schlägt fehl |
| `Profil „…“: Die NURBS-Kurve durch die Punkte überschneidet sich selbst nahe x = … % der Profiltiefe; …` | Fehler | die Kurve durch die Profilpunkte kreuzt sich selbst. Die Kreuzung teilt die Kontur in 2 Teile; der Teil mit der kleineren Diagonale des Hüllrechtecks hat eine mittlere Breite (Fläche / Diagonale des Hüllrechtecks) über 0,05 % der Profiltiefe. Ein Profil, das bei einer Profiltiefe über 200 mm verwendet wird, scheitert auch, wenn diese Breite bei seiner größten Profiltiefe 0,1 mm übersteigt; die Meldung lautet dann `…; die Schleife ist bei … mm Profiltiefe … mm breit, über 0,1 mm. …` |
| `Profil „…“: Die Profilseite läuft in x um … % der Profiltiefe zurück, nahe x = … % der Profiltiefe; …` | Fehler | die Kurve durch die Profilpunkte läuft um mehr als 0,01 % der Profiltiefe in x zurück. Im Einlesetest mit 1964 realen Profildateien weist diese Prüfung mit **Zentripetal** (Centripetal) 4 Dateien ab, mit **Sehnenlänge** 12 und mit **Gleichabständig** 82 ([[Profilquellen]], Abschnitt Einlesetest). |
| `Profil „…“: Die Oberseite läuft an … Punkten in x zurück; die Grenze liegt bei 50.` (ebenso `Die Unterseite …`) | Fehler | eine Seite des Profils läuft an mehr als 50 Punkten in x zurück (Prüfung `folds`, [[Dateiformate]]) |
| `Nasenlinie: …` / `Endlinie: …` | Fehler | y der Leitkurvenpunkte steigt nicht streng an, oder die Kurve läuft in y zurück; Modus **Durch Punkte** (Through points): `Die Punkte … und … bei y = … mm und y = … mm liegen für die Kurvenparameter zu dicht beieinander; die Punkte auseinanderschieben.`, wenn zwei normierte y-Werte höchstens 4 Einheiten der letzten Stelle des größeren Werts oder höchstens 2^-1021 (etwa 4,5e-308) auseinanderliegen; `Die Kurvenanpassung ist singulär; die Punkte in y weiter auseinanderschieben oder den Modus „Kontrollpunkte“ verwenden.`, wenn die Interpolation Punkte, deren normierte y-Werte enger liegen, als sie auflöst, nicht lösen kann, z. B. 1e-300 der Spannweite |
| `Nasenlinie: Die Kurve durch die Punkte erreicht x = … mm, jenseits von ±1.200.000 mm; die Punkte in y gleichmäßiger verteilen oder den Modus „Kontrollpunkte“ verwenden.` (ebenso `Endlinie`) | Fehler | ein Kontrollpunkt der Leitkurve liegt jenseits von x = ±1 200 000 mm |
| `Die Schnittwerte ergeben bei y = … mm nicht endliche Koordinaten; …` | Fehler | x der Profilnase, Profiltiefe, z oder Schränkung einer geprüften Spannweitenposition ergibt eine nicht endliche Koordinate, z. B. bei **Glatt** mit 3 Schnitten bei y = 0, 1e-300 und 2e-300 mm und Schränkungen 0°, 90° und 0°. **Öffnen** (Open) und die Tabelle der Registerkarte **Schnitte** (Sections) akzeptieren solche Positionen; die Tabelle weist nur ein y ab, das dem eines anderen Schnitts gleicht. |
| `Bei y = … mm verlässt der Flügel die Projektgrenzen (x der Profilnase … mm, z … mm, Profiltiefe … mm; Grenzen ±1.200.000 mm und 100.000 mm Profiltiefe). Die Leitkurven prüfen oder lineare Interpolation verwenden.` | Fehler | an einer geprüften Spannweitenposition: x der Profilnase, x der Endleiste oder z jenseits von ±1 200 000 mm, oder Profiltiefe über 100 000 mm |
| `Die glatte Interpolation in Spannweitenrichtung schwingt bei y = … mm über: … …, während die Schnitte nur von … bis … reichen. Die Schnitte sind ungleichmäßig verteilt (kleinster Abstand … mm). …` | Fehler | **Glatt**: ein interpolierter Wert (x der Profilnase, Profiltiefe, z, Schränkung oder Höhe eines Konturpunkts) liegt um mehr als das 2-Fache des Bereichs der Schnittwerte außerhalb dieses Bereichs |
| `Das interpolierte Profil hat bei y = … mm, x = … % der Profiltiefe eine negative Dicke (… % der Profiltiefe); …` | Fehler | **Glatt**: Das interpolierte Profil an einer geprüften Spannweitenposition hat an einer Tiefenstation negative Dicke (Überschwingen zwischen ungleichmäßig verteilten Schnitten). Hinter 99 % der Profiltiefe gelten Kreuzungen bis 0,01 % der Profiltiefe, höchstens 0,1 mm, als Dicke null. |
| `Das neu abgetastete Profil hat bei y = … mm, x = … % der Profiltiefe eine negative Dicke (… % der Profiltiefe): …` | Fehler | **Linear**: Ober- und Unterseite eines Profils kreuzen sich an einer Tiefenstation. Hinter 99 % der Profiltiefe gelten Kreuzungen bis 0,01 % der Profiltiefe, höchstens 0,1 mm, als Dicke null. |
| `Die Endleisteneinstellung zieht die Oberseite bei y = … mm unter die Unterseite (… % der Profiltiefe); …` | Fehler | **Geschlossen** (Closed) oder **Feste Dicke** (Fixed thickness) bei einem Profil, das innen dünner ist als seine Endleistendicke |
| `Ober- und Unterseite des interpolierten Profils berühren sich bei y = … mm, x = … % der Profiltiefe (Dicke … % der Profiltiefe); …` | Fehler | **Wie in den Profildateien** (As in the airfoil files): Dicke höchstens 0,001 % der Profiltiefe zwischen 1 % und 99 % der Profiltiefe |
| `Die Endleisteneinstellung lässt Ober- und Unterseite sich bei y = … mm, x = … % der Profiltiefe berühren (Dicke … % der Profiltiefe); …` | Fehler | **Geschlossen** oder **Feste Dicke**: Dicke höchstens 0,001 % der Profiltiefe zwischen 1 % und 99 % der Profiltiefe |
| `Die Profiltiefe sinkt bei y = … mm auf … mm; Nasenlinie und Endlinie dürfen sich nicht berühren oder kreuzen.` | Fehler | Profiltiefe unter 1 mm an einer geprüften Spannweitenposition (relative Rundungsfehler bis 1e-9 zählen nicht, sodass Schnitte mit genau 1 mm aufgebaut werden). Ohne beide Leitkurven ist die Profiltiefe die Überblendung der Schnitttiefen, und die Meldung endet mit `die glatte Interpolation der Profiltiefen der Schnitte fällt unter das Minimum von 1 mm; lineare Interpolation verwenden oder Schnitte hinzufügen.` Flacher Rand mit dem Minimum am Rand und über −0,01 mm: Die Meldung ergänzt `Für ein Flügelende, das in einer Spitze endet, Einstellungen > Flügelende auf „Spitz“ setzen.` |
| `Die angepasste Fläche hat nicht endliche Koordinaten; …` | Fehler | eine Koordinate eines Kontrollpunkts der angepassten Fläche ist keine endliche Zahl |
| `Die angepasste Fläche stülpt sich zwischen den Stationen bei y = … mm um (örtliche Dicke … % der Profiltiefe): …` | Fehler | örtliche Dicke der angepassten Fläche unter 0 an einer verglichenen Tiefenstation; geprüft an den geprüften Spannweitenpositionen und bei 0,25, 0,5 und 0,75 jedes Stationsintervalls |
| `Die angepasste Fläche hat zwischen den Stationen bei y = … mm die Dicke null (örtliche Dicke … % der Profiltiefe): …` | Fehler | örtliche Dicke der angepassten Fläche höchstens 0,001 % der Profiltiefe an einer verglichenen Tiefenstation zwischen 1 % und 99 % der Profiltiefe; dieselben Positionen |
| `Die angepasste Fläche faltet sich oder schnürt sich zwischen den Stationen bei y = … mm ein (Profiltiefe … mm in der vorgesehenen Profiltiefenrichtung, Minimum 1 mm): …` | Fehler | Profiltiefe der angepassten Fläche nach den hinzugefügten Stationen unter 0,9 mm oder in Gegenrichtung; dieselben Positionen |
| `Die Fläche überschneidet sich selbst bei y = … mm nahe x = … mm: …` | Fehler | eine Flächenzeile kreuzt sich zwischen den neu abgetasteten Punkten selbst; mittlere Breite des kleineren Teils wie bei Profilen, über 0,05 % der örtlichen Profiltiefe oder über 0,1 mm, je nachdem, was kleiner ist. Geprüfte Zeilen: jeder Schnitt, die Mitte zwischen 2 Schnitten und die Mitte zwischen 2 benachbarten Stationen in den 64 breitesten Stationsintervallen. |
| `Das Flächengitter braucht … Punkte bei einer Station je Feld (… Schnitte, … Stationen je Profilseite); die Grenze liegt bei 5.000.000. Die Stationen je Profilseite verringern oder Schnitte entfernen.` | Fehler | Schnitte × (2 · **Stationen je Profilseite** (Chordwise stations per surface) + 1) über 5 000 000, z. B. mehr als 12 468 Schnitte bei 200 Tiefenstationen ([Leitkurven](#leitkurven)) |
| `Interner Fehler: …` | Fehler | Ausnahme im Flügelaufbau (Programmfehler) |
| `Großes Projekt: … (Warnung über …). Jede Änderung dauert … und belegt … Arbeitsspeicher.` | Warnung | eine Projektgröße über ihrer Warnschwelle; die Meldung nennt jede solche Größe, z. B. `1.000 Schnitte (Warnung über 200) und 121.000 Punkte im Flächengitter (Warnung über 60.000)`. Dauert der erste Aufbau mindestens 1 s länger als eine Änderung, endet die Meldung mit `Das Öffnen des Projekts oder eine Änderung der Parametrisierung der Profile dauert ….` Schwellen und Schätzung: Abschnitt [Projektgröße](#projektgröße). |
| `Stationen je Feld von … auf … verringert: … Schnitte mit … Stationen je Profilseite halten die Fläche bei höchstens 5.000.000 Gitterpunkten.` | Warnung | Flächengitter über 5 000 000 Punkten mit dem eingestellten Wert **Stationen je Feld** (Spanwise stations per panel), mit eingeschalteter Leitkurve oder mit **Glatt** ([Leitkurven](#leitkurven)) |
| `Spitzes Flügelende: Nasenlinie und Endlinie enden … mm voneinander entfernt, daher beträgt die Randtiefe … mm statt … mm; …` | Warnung | spitzes Flügelende, beide Leitkurven an, Abstand am Rand mehr als 0,5 mm größer als die verkleinerte Randtiefe |
| `Die Endleistendicke … mm übersteigt 5 % der Profiltiefe an … Stationen; dort wird sie auf 5 % begrenzt.` | Warnung | feste Dicke größer als 5 % der örtlichen Profiltiefe |
| `Die Endleiste ist an manchen Stationen geschlossen und an anderen offen; … Stationen wurden auf 0,01 mm geöffnet.` | Warnung | nicht jede Station geschlossen, und mindestens eine Station mit einer Endleistendicke unter 0,01 mm |
| `Die Fläche weicht nach … hinzugefügten Stationen bei y = … mm um bis zu … mm von der vorgesehenen Fläche ab; die Stationen je Feld erhöhen.` | Warnung | Abweichung vom vorgesehenen Profil (Profilnase, oberer Endleistenpunkt, jede k-te Tiefenstation je Profilseite, k = **Stationen je Profilseite** / 6, abgerundet: 5 bei 60) über 0,5 mm (oder 10 % der örtlichen Profiltiefe, wenn kleiner) an einer geprüften Spannweitenposition bleibt nach den hinzugefügten Stationen (höchstens 32 in 6 Durchläufen, 1 Durchlauf über 60 000 Punkten im Flächengitter). Die Meldung nennt die Anpassung, die der Aufbau behält (die kleinste größte Abweichung im Verhältnis zur Toleranz), und deren hinzugefügte Stationen ([Leitkurven](#leitkurven)). |

- Geprüfte Spannweitenpositionen: Abschnitt [Leitkurven](#leitkurven).
- Bei genau 1 Station steht die Einzahl: `an 1 Station`, `1 Station wurde auf 0,01 mm geöffnet`, `nach 1 hinzugefügten Station`. Ohne hinzugefügte Stationen beginnt die letzte Meldung mit `Die Fläche weicht ohne hinzugefügte Stationen bei y = …`.

Aufbaufehler, die die Bedienelemente und **Öffnen** verhindern (nur über Programmcode erreichbar). Der Aufbau meldet die Grenzen von **Öffnen** für Schnitte und Leitkurven ebenfalls als Fehler:

| Meldung | Bedingung | Verhindert durch |
| --- | --- | --- |
| `Mindestens 2 Schnitte sind erforderlich.` | weniger als 2 Schnitte | **×** ist bei 2 Schnitten gesperrt; **Öffnen** weist die Datei ab |
| `Schnitt …: Profiltiefe darf höchstens 100.000 mm betragen.` / `Schnitt …: x muss innerhalb von ±1.000.000 mm liegen.` (ebenso y, z) / `Schnitt …: Schränkung muss innerhalb von ±360 Grad liegen.` | Profiltiefe über 100 000 mm; x, y oder z außerhalb von ±1 000 000 mm; Schränkung außerhalb von ±360° | die Tabelle der Registerkarte **Schnitte** begrenzt eingegebene Werte auf diese Grenzen; Ziehen im Grundriss bleibt innerhalb der Grenzen; **Öffnen** weist die Datei ab |
| `Höchstens 20.000 Schnitte werden unterstützt (… gefunden).` | mehr als 20 000 Schnitte | **+** ist bei 20 000 Schnitten gesperrt; **Öffnen** weist die Datei ab |
| `guides.….points: höchstens 20.000 Punkte (… gefunden).` / `guides.….points: x muss innerhalb von ±1.100.000 mm und y innerhalb von ±1.000.000 mm liegen.` | eine Leitkurve mit mehr als 20 000 Punkten, mit einem Punkt-x außerhalb von ±1 100 000 mm oder einem Punkt-y außerhalb von ±1 000 000 mm | **Punkt hinzufügen** (Add point) ist bei 20 000 Punkten gesperrt; Ziehen und Punkttabelle halten x innerhalb von ±1 100 000 mm; **Öffnen** weist die Datei ab |
| `Der Schnitt bei y = … mm liegt auf der gespiegelten Seite; …` | y des Wurzelschnitts unter 0 | das Eingabefeld y setzt negative Werte auf 0; **Öffnen** weist die Datei ab |
| `Die Schnitte … und … haben dieselbe Spannweitenposition y = … mm.` | zwei Schnitte mit gleichem y | die Schnitttabelle weist den Wert ab; **Öffnen** weist die Datei ab |
| `Die Schnitte … und … bei y = … mm und y = … mm liegen für die Flächenparameter zu dicht beieinander (Spannweitenanteile … und …); die Schnitte auseinanderschieben.` | zwei Schnitte, deren Spannweitenanteile (y − y Wurzel) / (y Rand − y Wurzel) sich höchstens um 4 Einheiten der letzten Stelle des größeren Werts oder höchstens um 2^-1021 (etwa 4,5e-308) unterscheiden, z. B. y = 714063,9936875999 und 714063,9936876 mm zwischen Wurzel bei 169026,9 mm und Rand bei 816583,4 mm | einen der beiden Schnitte verschieben |
| `Die Flächenanpassung ist singulär: Die Schnitte … und … bei y = … mm und y = … mm liegen zu dicht beieinander; die Schnitte auseinanderschieben.` | die Flächeninterpolation kann Stationen, deren Spannweitenanteile enger liegen, als sie auflöst, nicht lösen, z. B. Schnitte bei y = 0 und y = 1e-200 mm im Modus **Glatt**; die Meldung nennt die 2 nächstgelegenen Schnitte | einen der beiden Schnitte verschieben |
| `Der Schnitt bei y = … mm verwendet das unbekannte Profil „…“.` | Profil-ID fehlt im Projekt | **×** ist für verwendete Profile gesperrt; **Öffnen** weist die Datei ab |

Bei einem Fehler wird der Flügel nicht aufgebaut: 3D-Ansicht und Kennwerte bleiben leer, und **Exportieren** (Export) bietet nur das Projekt-JSON an.

## Projektgröße

Über einer Warnschwelle arbeitet die App wie gewohnt. Der Flügelaufbau ergänzt eine Warnung in der Registerkarte **Prüfungen** (Checks), die die Statusleiste mitzählt:

`Großes Projekt: <Größen>. Jede Änderung dauert … und belegt … Arbeitsspeicher.`

- Jede Größe lautet z. B. `1.000 Schnitte (Warnung über 200)`.
- Dauert der geschätzte erste Aufbau mindestens 1 s länger als eine Änderung, endet die Warnung mit `Das Öffnen des Projekts oder eine Änderung der Parametrisierung der Profile dauert ….` Der erste Aufbau läuft nach **Öffnen** (Open), für das wiederhergestellte Projekt beim nächsten Aufruf und nach einer Änderung von **Parametrisierung der Profile** (Profile parametrization); er prüft und interpoliert jedes Profil neu, das ein Schnitt verwendet. Profile ohne Schnitt gehen nicht ein.
- Eine Meldung mit demselben Text erscheint, wenn eine Größe ihre Schwelle überschreitet: nach einer Änderung, nach **Öffnen** und für das wiederhergestellte Projekt beim nächsten Aufruf.
- Die festen Grenzen liegen dort, wo einem Browser-Tab am Desktop der Speicher ausgeht oder eine Änderung etwa eine Minute dauert.

| Größe | Warnung über | Feste Grenze | An der festen Grenze |
| --- | --- | --- | --- |
| Schnitte | 200 | 20 000 | **+** gesperrt; **Öffnen** weist die Datei ab |
| Projektprofile | 200 | 10 000 | die Registerkarte **Profile** (Airfoils) fügt kein Profil hinzu; **Öffnen** weist die Datei ab |
| Punkte eines Profils | 5000 | 100 000 | Fehler `too-many-points` in der Vorschau; **Öffnen** weist die Datei ab |
| Profilpunkte insgesamt | 100 000 | 1 000 000 | die Registerkarte **Profile** fügt kein Profil hinzu; **Öffnen** weist die Datei ab |
| Punkte einer eingeschalteten Leitkurve | 500 | 20 000 (jede Leitkurve) | **Punkt hinzufügen** (Add point) gesperrt; **Öffnen** weist die Datei ab |
| Punkte im Flächengitter | 60 000 | 5 000 000 | weniger Stationen je Feld; Aufbaufehler, wenn eine Station je Feld die Grenze überschreitet |
| Dreiecke eines Exports als STL (Stereolithografie) oder 3MF (3D Manufacturing Format) | 2 000 000 (Exportdialog) | 10 000 000 | **Herunterladen** (Download) gesperrt |
| Kontrollpunkte eines STEP-Exports | 1 000 000 (Exportdialog) | 3 000 000 | **Herunterladen** gesperrt |
| Zeichen des Projektnamens oder eines Profilnamens | 200 | 10 000 | Namensfelder nehmen höchstens 10 000 Zeichen an; der Profil-Parser behält die ersten 10 000; **Öffnen** weist die Datei ab |
| Projektdatei | – | 100 MB | **Öffnen** weist die Datei ungelesen ab; **Speichern** (Save) lässt die abgeleiteten NURBS-Daten weg; ein Projekt, das auch ohne sie über 100 MB liegt, wird nicht gespeichert |

- Ein Projekt innerhalb aller Grenzen kann als Datei 100 MB überschreiten, wenn seine Namen und Quelltexte nahe an ihren Grenzen liegen. Beispiel: 10 000 Profile mit Namen von 10 000 Zeichen enthalten 100 000 000 Namenszeichen; mit 5 Punkten je Profil belegt die Datei 100,8 MB. **Speichern** schreibt dann keine Datei und zeigt `Speichern fehlgeschlagen: Das Projekt belegt als Datei 100,8 MB, mehr als die 100 MB, die „Öffnen“ liest.`; **Exportieren** (Export) > **Projekt-JSON** (Project JSON) zeigt `Export fehlgeschlagen: Das Projekt belegt als Datei 100,8 MB, …`. Projekte mit kürzeren Namen und Quelltexten passen: 1 000 000 Profilpunkte belegen etwa 40 MB.

Die Schätzung in der Warnung ist eine lineare Anpassung an Messungen in Chromium 141 auf 4 Kernen eines Xeon-Server-Prozessors (CPU, Central Processing Unit) mit 2,1 GHz (JavaScript-Zeit, ohne Zeichnen der 3D-Ansicht):

| Anteil | Zeit | Arbeitsspeicher |
| --- | --- | --- |
| Grundwert jeder Änderung | 0,2 s | 15 MB |
| Je 1000 Punkte im Flächengitter | 11,5 ms | 0,65 MB |
| Je Punkt einer eingeschalteten Leitkurve (der mit mehr Punkten) | 0,11 ms | 0,05 MB |
| Je 1000 Profilpunkte | 1,5 ms | 0,2 MB |
| Je 1000 Einträge der Profil-Auswahllisten in der Tabelle der Registerkarte **Schnitte** (Sections) (Schnitte × Profile; über 20 000 einer je Schnitt) | 8,5 ms | 0,5 MB |
| Nur erster Aufbau, zusätzlich zu einer Änderung: je Profil, das ein Schnitt verwendet | 4,4 ms | nicht geschätzt |
| Nur erster Aufbau, zusätzlich zu einer Änderung: je 1000 Profilpunkte | 30 ms | nicht geschätzt |

- Zeiten lauten `unter 1 s`, `etwa 1,5 s` (halbe Sekunden unter 10 s) oder `etwa 14 s`; der Speicher hat 2 signifikante Stellen, z. B. `etwa 94 MB`, `etwa 1,6 GB`.
- Anteile des ersten Aufbaus: gemessen in Node.js 24, nicht im Browser: 7,4 ms je Profil mit 99 Punkten bei 1000 und 2000 Profilen, davon 3 ms durch den Punktanteil. Beispiel: 20 000 Schnitte (**Linear**, 16 **Stationen je Profilseite** (Chordwise stations per surface): 660 000 Punkte im Flächengitter) und 10 000 Profile mit 99 Punkten: `Jede Änderung dauert etwa 9,5 s und belegt etwa 650 MB Arbeitsspeicher. Das Öffnen des Projekts oder eine Änderung der Parametrisierung der Profile dauert etwa 83 s.`
- Das Zeichnen der 3D-Ansicht kommt mit der Zeit der Grafikkarte hinzu. Smartphones: nicht gemessen.

Gemessen je Änderung einer Profiltiefe im Browser: Chromium 141 headless, Software-Rendering, 4 geteilte Kerne, Load Average 2 bis 8; **Linear**, 1 Profil, 60 Tiefenstationen; JavaScript-Zeit und JavaScript-Heap nach der Änderung.

| Schnitte | Punkte im Flächengitter | Schätzung | Zeit | Speicher |
| --- | --- | --- | --- | --- |
| 1000 | 121 000 | etwa 1,5 s, etwa 94 MB | 1,5 bis 1,6 s | 78 bis 91 MB |
| 5000 | 605 000 | etwa 7 s, etwa 410 MB | 6,9 bis 7,4 s | 345 bis 361 MB |
| 10 000 | 1 210 000 | etwa 14 s, etwa 810 MB | 15,8 bis 16,4 s | 490 MB |
| 15 000 | 1 815 000 | etwa 21 s, etwa 1,2 GB | 19 bis 23 s | 678 MB |
| 20 000 | 2 420 000 | etwa 28 s, etwa 1,6 GB | 24 s | 969 MB |

- 20 000 Schnitte: 57 s Seitenzeit je Änderung mit Software-Rendering; Öffnen der Datei: 24 s JavaScript, 59 s Seitenzeit.
- Auswahl eines Schnitts: 2 ms JavaScript bei 200 Schnitten, 100 bis 110 ms bei 20 000 Schnitten.
- Vollständige Messbedingungen und weitere Fälle: [[Entwicklung|Entwicklung]].

## Export

![Exportdialog: Format, Flügelhälften, Netzdichte](images/de/export-dialog.png)

Der Exportdialog trägt den Titel **Exportieren** (Export).

| Format | Bedeutung | Inhalt |
| --- | --- | --- |
| STEP | Standard for the Exchange of Product model data; Textdatei nach ISO 10303-21 (ISO: International Organization for Standardization), Anwendungsprotokoll 214 | Exakte B-Spline-Flächen, geschlossene Volumenkörper |
| STL | Stereolithografie | Binäres Dreiecksnetz |
| 3MF | 3D Manufacturing Format | Zip-Paket mit Dreiecksnetz |
| Projekt-JSON | Projektdatei dieser App | Profile, Schnitte, Kurven, Einstellungen, NURBS-Daten |

| Gruppe | Option | Vorgabe |
| --- | --- | --- |
| **Format** | **STEP (AP214, exakte NURBS-Volumenkörper)** (STEP (AP214, exact NURBS solids)) | ausgewählt, wenn der Flügel fehlerfrei ist |
| **Format** | **STL (binäres Dreiecksnetz)** (STL (binary triangle mesh)) | – |
| **Format** | **3MF (Dreiecksnetz für den 3D-Druck)** (3MF (triangle mesh for 3D printing)) | – |
| **Format** | **Projekt-JSON (Profile, Schnitte, Kurven, Einstellungen, NURBS-Daten)** (Project JSON (airfoils, sections, curves, settings, NURBS data)) | ausgewählt, wenn der Flügel Fehler hat; dann einziges Format |
| **Flügelhälften** (Wing halves) | **Beide Hälften als getrennte Körper** (Both halves as separate bodies) | ausgewählt |
| **Flügelhälften** | **Ganzer Flügel als ein Körper (Netzformate, Wurzel bei y = 0)** (Full wing as one body (mesh formats, root at y = 0)) | – |
| **Flügelhälften** | **Nur rechte Hälfte** (Right half only) | – |
| **Netzdichte (STL, 3MF)** (Mesh density (STL, 3MF)) | **Normal** | ausgewählt |
| **Netzdichte (STL, 3MF)** | **Fein (4-fache Dreiecksanzahl)** (Fine (4x triangles)): verdoppelt die Unterteilung in beiden Flächenrichtungen | – |

Für STL und 3MF nennt ein Hinweis unter der Netzdichte die Dreiecke und die Dateigröße für Format, Flügelhälften und Netzdichte der Auswahl, z. B. Entwurfstyp **Segelflugmodell** (Glider), STL, beide Hälften, **Normal**: `0,02 Millionen Dreiecke, Datei etwa 1,2 MB.` Projekt-JSON zeigt keinen Hinweis.

| Dreiecke | Hinweis | **Herunterladen** (Download) |
| --- | --- | --- |
| bis 2 000 000 | `… Millionen Dreiecke, Datei ….` | bedienbar |
| über 2 000 000 | Warnfarbe; ergänzt `Der Export dauert … und belegt … Arbeitsspeicher.` | bedienbar |
| über 10 000 000 | Fehlerfarbe: `… Millionen Dreiecke, Datei …: über der Grenze von 10 Millionen Dreiecken, ab der einem Browser-Tab auf dem Desktop der Speicher ausgeht. Netzdichte „Normal“, eine Hälfte oder weniger Stationen je Profilseite oder je Feld verwenden.` | gesperrt |

- Schätzung je Million Dreiecke: STL 0,8 s, 210 MB Arbeitsspeicher, 50 MB Datei; 3MF 5,8 s, 110 MB Arbeitsspeicher, 11,5 MB Datei. Die Speicherschätzung addiert 15 MB.
- Gemessen (Chromium 141, 4 Kerne eines Xeon-Server-Prozessors mit 2,1 GHz): STL mit 8,5 Millionen Dreiecken: 6,9 s, 423 MB Datei, 2,7 GB Arbeitsspeicher in der Spitze; 3MF mit 8,5 Millionen Dreiecken: 49 s, 97 MB Datei; STL mit 20 Millionen Dreiecken scheiterte.

Für STEP nennt der Hinweis die Kontrollpunkte der Flächen in der Datei und die Dateigröße für die gewählten Flügelhälften (die linke Hälfte verdoppelt die Anzahl; die Netzdichte gilt nicht), z. B. Entwurfstyp **Segelflugmodell**, beide Hälften: `4.114 Kontrollpunkte, Datei etwa 1 MB.` Über 1 000 000 Kontrollpunkten lautet die Anzahl `… Millionen`.

| Kontrollpunkte | Hinweis | **Herunterladen** |
| --- | --- | --- |
| bis 1 000 000 | `… Kontrollpunkte, Datei ….` | bedienbar |
| über 1 000 000 | Warnfarbe; ergänzt `Der Export dauert … und belegt … Arbeitsspeicher.` | bedienbar |
| über 3 000 000 | Fehlerfarbe: `… Millionen Kontrollpunkte, Datei …: über der Grenze von 3 Millionen Kontrollpunkten, ab der die Datei mehr Speicher braucht, als ein Browser-Tab auf dem Desktop bietet. Eine Hälfte oder weniger Stationen je Profilseite oder je Feld verwenden.` | gesperrt |

- Schätzung je Million Kontrollpunkte: 2,5 s, 620 MB Arbeitsspeicher, 98 MB Datei. Die Speicherschätzung addiert 15 MB.
- Gemessen: 3,3 Millionen Kontrollpunkte (4161 Stationen) schrieben eine Datei von 330 MB in 8,4 s (Chromium 141); Node.js 24 brauchte je Kontrollpunkt 1,6 bis 3,4 µs, 98 Byte Datei und 620 Byte Speicher in der Spitze. Etwa 5,4 Millionen Kontrollpunkte überschreiten die Grenze des Browsers von 512 MB je Zeichenkette. Zwischen 3,3 und 5,4 Millionen: nicht gemessen.

| Schaltfläche | Wirkung |
| --- | --- |
| **Herunterladen** | Schreibt die Datei mit den gewählten Optionen. |
| **Abbrechen** (Cancel) | Schließt den Dialog ohne Datei. |

| Format | Beide Hälften | Ganzer Flügel | Rechte Hälfte |
| --- | --- | --- | --- |
| STEP | 2 Volumenkörper | 2 Volumenkörper | 1 Volumenkörper |
| STL | 1 Datei, 2 geschlossene Hüllen | 1 geschlossene Hülle | 1 geschlossene Hülle |
| 3MF | 2 Objekte: `Wing right`, `Wing left` | 1 Objekt: `Wing` | 1 Objekt: `Wing right` |
| Projekt-JSON | vollständiges Projekt | vollständiges Projekt | vollständiges Projekt |

- **Ganzer Flügel als ein Körper** setzt den Wurzelschnitt bei y = 0 voraus. Sonst schreiben STL und 3MF 2 Körper wie bei **Beide Hälften als getrennte Körper**.
- STEP hat keinen zusammengefügten Körper: **Ganzer Flügel als ein Körper** schreibt 2 Volumenkörper.
- Das Projekt-JSON enthält das vollständige Projekt. Ohne Flügelfehler enthält es zusätzlich die abgeleiteten NURBS-Daten: Profilkurven, Leitkurven, Stationen in Spannweitenrichtung und die NURBS-Fläche des Flügels.
- Brächten die abgeleiteten NURBS-Daten die Datei über 100 MB, die größte Datei, die **Öffnen** (Open) liest, lassen **Speichern** (Save) und Projekt-JSON sie weg und melden `Die Datei lässt die abgeleiteten NURBS-Daten weg: Mit ihnen wäre sie größer als die 100 MB, die „Öffnen“ höchstens liest. „Öffnen“ berechnet sie neu; der STEP-Export schreibt die exakten Flächen.`
- Dateiname: Projektname mit ausgeschriebenen Umlauten (ä → ae, ö → oe, ü → ue, Ä → Ae, Ö → Oe, Ü → Ue, ß → ss), andere Akzente entfernt; jede Folge von Zeichen außerhalb von `A–Z a–z 0–9 . _ -` wird zu einem `_`; `_` am Anfang und Ende entfällt; die ersten 120 Zeichen bleiben. Endung `.step`, `.stl`, `.3mf` oder `.json`. Leerer Name: `wing`.
- Einheit: mm in allen Formaten. Achsen wie in der App.
- Reicht der Speicher des Browsers nicht oder wird eine eigene Größengrenze des Browsers erreicht, bricht der Export mit der roten Meldung `Export fehlgeschlagen: <Grund>.` ab, bei STL und 3MF gefolgt von `Netzdichte „Normal“ oder weniger Stationen je Profilseite und je Feld verwenden.`, bei STEP von `Eine Hälfte oder weniger Stationen je Profilseite und je Feld verwenden.`
- STL und 3MF speichern 32-Bit-Koordinaten. Fällt durch die Rundung ein bei dieser Auflösung sichtbares Dreieck zusammen oder kippt es um, schreibt der Export keine Datei und zeigt die rote Meldung `STL speichert 32-Bit-Koordinaten: Bei … mm beträgt ihr Rasterabstand … mm, und … von … Dreiecken fallen zusammen oder kehren sich um. Den Flügel zum Ursprung hin verschieben oder als STEP exportieren.` (3MF: `3MF-Leseprogramme speichern 32-Bit-Koordinaten: …`). `Bei … mm` nennt die größte Koordinate der beschädigten Dreiecke.
- Fällt das erste beschädigte Dreieck auch dann zusammen oder kippt um, wenn seine x- und z-Werte neben 0 und die Wurzel auf y = 0 verschoben sind (bei gespiegeltem Flügel beide Hälften), ist schon sein Abstand zur Wurzel zu grob: Schnitte oder Stationen liegen dichter beieinander als der 32-Bit-Abstand, und Verschieben des Flügels hilft nicht. Der letzte Satz lautet dann `Schnitte oder Stationen nahe y = … mm liegen dichter beieinander als der Rasterabstand dort (… mm); sie auseinanderschieben oder als STEP exportieren.` Beispiel: 4 Schnitte, 2 davon bei y = 300 mm und y = 300,00001 mm: `STL speichert 32-Bit-Koordinaten: Bei 300 mm beträgt ihr Rasterabstand 0,000031 mm, und 484 von 1.928 Dreiecken fallen zusammen oder kehren sich um. Schnitte oder Stationen nahe y = 300 mm liegen dichter beieinander als der Rasterabstand dort (0,000031 mm); sie auseinanderschieben oder als STEP exportieren.`
- Dateiinhalte: [[Dateiformate|Dateiformate]].
