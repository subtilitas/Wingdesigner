English: [[File Formats|File-Formats]]

# Dateiformate

| Richtung | Inhalt | Format | Endung | Bedienelement |
| --- | --- | --- | --- | --- |
| Import | Profilkoordinaten | Selig, Lednicer, Tabelle x/Oberseite/Unterseite, XML, HTML | `.dat` `.txt` `.cor` `.xml` `.htm` `.html` `.csv` | **Profile** (Airfoils) > **Hochladen** (Upload): **Dateien wählen** (Choose files), Ablagefläche oder **Eingefügten Text prüfen** (Check pasted text) |
| Import | Projekt | JSON | `.json` | **Öffnen** (Open) |
| Import | Ein Flügel oder Höhenleitwerk aus XFLR5 | XFLR5-Projekt, XFLR5-Flugzeug oder -Flügel als XML | `.xfl` `.xml` | **Öffnen** |
| Export | Projekt | JSON | `.json` | **Speichern** (Save), **Exportieren** (Export) |
| Export | Flügel, exakte NURBS-Flächen | STEP, AP214 | `.step` | **Exportieren** |
| Export | Flügel, Dreiecksnetz | binäres STL | `.stl` | **Exportieren** |
| Export | Flügel, Dreiecksnetz | 3MF | `.3mf` | **Exportieren** |
| Export | ein Profil | Selig | `.dat` | **Profile** > **.dat** |
| Export | Schaumkerne: Paare von Endprofilen, Segmenttabelle | Selig-`.dat` (mm und normiert), CSV, in einem ZIP | `.zip` | **Schaum** (Foam) > **Profile (.dat, ZIP)** (Profiles (.dat, ZIP)) |
| Export | Schaumkerne: Schablonen 1:1 | SVG, PDF, DXF | `.svg` `.pdf` `.dxf` | **Schaum** > **Schablonen (SVG)** (Templates (SVG)), **Schablonen (PDF)** (Templates (PDF)), **Schablonen (DXF)** (Templates (DXF)) |

| Abkürzung | Bedeutung |
| --- | --- |
| JSON | JavaScript Object Notation |
| ISO | Internationale Organisation für Normung (International Organization for Standardization) |
| STEP | Standard for the Exchange of Product model data, ISO 10303 |
| AP214 | STEP-Anwendungsprotokoll 214 (Application Protocol 214) |
| STL | Stereolithografie |
| 3MF | 3D Manufacturing Format |
| NURBS | Non-Uniform Rational B-Spline, nicht-uniformer rationaler B-Spline |
| XML | Extensible Markup Language |
| HTML | HyperText Markup Language |
| LE, TE | leading edge (Profilnase), trailing edge (Endleiste); nur in Formelzeichen (y_LE) und JSON-Schlüsseln (`xLE`) |
| UTC | koordinierte Weltzeit (Coordinated Universal Time) |
| VLM | Vortex-Lattice-Verfahren (vortex lattice method) |
| ASCII | American Standard Code for Information Interchange |
| CAD | rechnergestütztes Konstruieren (computer-aided design) |
| CSV | durch Kommas getrennte Werte (comma-separated values) |
| SVG | Scalable Vector Graphics |
| PDF | Portable Document Format |
| DXF | Drawing Exchange Format (AutoCAD) |

Die Oberfläche spricht Englisch oder Deutsch ([[Benutzerhandbuch|Benutzerhandbuch]], Abschnitt Sprache). Meldungen auf dieser Seite stehen so, wie die deutsche Oberfläche sie schreibt; die englische Oberfläche schreibt sie auf Englisch ([[File Formats|File-Formats]]). Codes wie `too-large` benennen die Prüfungen in dieser Dokumentation; die App zeigt sie nicht. Dateiinhalte hängen nicht von der Sprache ab: Zahlen haben einen Dezimalpunkt, Schlüssel und feste Namen sind englisch. Ausnahme: Die Texte der Schaumschnitt-Dateien (`README.txt`, Texte der Schablonen, Titel des PDF) stehen in der Sprache der Oberfläche, mit deren Zahlenformat (Abschnitt „Schaumschnitt-Dateien“). Nur ein Name, den die App selbst anlegt, z. B. der voreingestellte Projektname, steht in der Sprache, die beim Anlegen eingestellt ist.

## Dateinamen beim Export

1. Den Projektnamen nehmen. Für eine Profil-`.dat`: den Profilnamen. Leerer Name: `wing`.
2. Umlaute ausschreiben: ä → ae, ö → oe, ü → ue, Ä → Ae, Ö → Oe, Ü → Ue, ß → ss. Ein Buchstabe aus Grundbuchstabe und kombinierendem Trema zählt als Umlaut.
3. Übrige Akzente entfernen (é → e, ñ → n).
4. Jede Folge von Zeichen außerhalb `A–Z a–z 0–9 . _ -` durch ein `_` ersetzen.
5. `_` am Anfang und am Ende entfernen.
6. Auf 120 Zeichen kürzen.
7. Leeres Ergebnis: `wing`.
8. Die Endung anhängen.

Die Regel ist in der englischen und in der deutschen Oberfläche gleich.

| Name | Dateiname |
| --- | --- |
| `Sport wing 1500` | `Sport_wing_1500.step` |
| `Sportflügel 1500` | `Sportfluegel_1500.step` |
| `Größe ÄÖÜ Café` | `Groesse_AeOeUe_Cafe.json` |

Name in STEP-, STL- und 3MF-Dateien, unten `<name>` geschrieben: Projektname; leerer Name: `wing`.

| Datei | Wo `<name>` steht |
| --- | --- |
| STEP | Name in `FILE_NAME`, `PRODUCT`, `ADVANCED_BREP_SHAPE_REPRESENTATION`, Volumenkörper `<name> right` und `<name> left` |
| STL | Kopf `Wingdesigner <name>` |
| 3MF | Metadaten `Title`. Die Objektnamen sind fest: Tabelle „Körper je Datei“. |

Der Schaumschnitt-Assistent wendet dieselbe Regel auf den Projektnamen an und hängt einen Zusatz an: `<name>_foam_profiles.zip`, `<name>_foam_templates.svg`, `<name>_foam_templates.pdf`, `<name>_foam_templates.dxf` (Abschnitt „Schaumschnitt-Dateien“). Leeres Ergebnis: `wing_foam_profiles.zip`.

## Profildateien (Import)

### Einlesen

| Eigenschaft | Regel |
| --- | --- |
| Erkennung | Nach dem Inhalt. Die Dateiendung wird nicht ausgewertet. |
| Größengrenze | Höchstens 5 000 000 Zeichen; größere Eingabe: Fehler `too-large`. Höchstens 100 000 Punkte; mehr: Fehler `too-many-points`. Bei mehr als 100 001 Zahlenzeilen (100 000 Punkte und eine Lednicer-Anzahlzeile) endet das Einlesen, mit der Meldung `Mehr als 100.001 Koordinatenzeilen; die Grenze liegt bei 100.000 Punkten.` Hochgeladene Dateien über 20 MB (20 000 000 Byte, höchstens 4 Byte je UTF-8-Zeichen) werden nicht gelesen: rote Meldung `<file>: <size> MB; Profildateien sind auf 5.000.000 Zeichen begrenzt.`, keine Vorschau. Über 5000 Punkten fügen die Plausibilitätsprüfungen die Warnung `many-points` hinzu. |
| Filter der Dateiauswahl | `.dat` `.txt` `.cor` `.xml` `.htm` `.html` `.csv` `text/plain`. Beim Ziehen und Ablegen (Drag-and-drop) wird jede Datei angenommen. |
| Zeichenkodierung | UTF-8 (Unicode Transformation Format, 8 Bit) mit oder ohne Byte-Order-Mark (BOM). Eine Datei, die kein gültiges UTF-8 ist, wird als Windows-1252 gelesen. |
| XFLR5-Dateien | Ein `.xfl`-Projekt jeder Größe oder eine XFLR5-XML-Datei bis 20 MB (eine größere erhält die Größenmeldung) wird nicht als Profil gelesen: `<file> ist eine XFLR5-Datei, kein Profil. Mit „Öffnen“ lässt sich daraus ein Flügel importieren.` Gilt für hochgeladene Dateien, nicht für eingefügten Text. Regeln: Abschnitt „XFLR5-Import“. |
| Zeilenenden | CR, LF oder CR LF (Carriage Return, Line Feed) |
| Kommentare | `#` bis zum Zeilenende. Ausnahme: die Namenszeile (Zeile Name). |
| Zahlenzeile | 2 oder mehr Zahlen, sonst nichts |
| Trennzeichen | Leerzeichen, Tabulator, Komma, Semikolon |
| Dezimalkomma | `0,125  1,250` wird als `0.125  1.250` gelesen. Bedingungen: Mindestens 2 Werte. Trennzeichen: Leerzeichen, Tabulatoren oder Semikolons. Jeder Wert ist eine Dezimalkommazahl oder eine ganze Zahl, jeweils mit optionalem Exponent (`e`, `E`, `d` oder `D`), z. B. `1,25e-1`. Mindestens 1 Wert enthält ein Komma. Eine Zeile mit 1 Feld, z. B. `0,5`, wird am Komma getrennt: Werte `0` und `5`. |
| Zahlenschreibweise | Vorzeichen optional, Dezimalpunkt, Exponent mit `e`, `E`, `d` oder `D` (`1.0D-3`). Werte in XML-`<x>` und `<y>` folgen derselben Schreibweise und der Regel für Dezimalkommas; anderer Text, z. B. `0x1`, ist keine Zahl (Fehler `non-finite`). |
| Name | Erste Nicht-Zahlenzeile vor der ersten Zahlenzeile. Die Namenszeile behält einen `#`-Kommentar: `NACA 0012 # from UIUC` → Name `NACA 0012 # from UIUC`. HTML: der `<title>`, wenn er nicht leer ist. XML: das erste `<name>`-Element. Kein Name gefunden: Dateiname ohne Endung; eingefügter Text: „Eingefügtes Profil“ (englische Oberfläche: `pasted`). Der Name wird als Text gespeichert; ein späterer Sprachwechsel benennt das Profil nicht um. Ein Name mit mehr als 10 000 Zeichen wird auf die ersten 10 000 gekürzt (Info `long-name`). |
| Spaltenkopfzeilen | 2 oder 3 Wörter, die mit `x`, `y` oder `z` beginnen, getrennt durch Leerzeichen, Tabulatoren, Kommas oder Semikolons (`x y`, `x;y`, `X Yo Yu`, `x/c y/c`, `X Y_upper Y_lower`). Nach der Namenszeile: ohne Meldung übersprungen. Als erste Nicht-Zahlenzeile vor der ersten Zahlenzeile: wird als Name übernommen (z. B. `X Yo Yu`), keine Info `no-name`. |
| Andere Nicht-Zahlenzeilen | Übersprungen, Warnung `ignored-lines` |

### Dateiaufbau

Geprüft in dieser Reihenfolge. Der erste Treffer gilt.

| Reihenfolge | Aufbau | Bedingung | Punktreihenfolge |
| --- | --- | --- | --- |
| 1 | XML | Text enthält `<coordinates>` | Liste `<point><x>…</x><y>…</y></point>` des ersten `<coordinates>`-Elements |
| 2 | HTML | Text enthält ein Tag `<html`, `<pre` oder `<body` | Text aller `<pre>`-Blöcke. Ohne `<pre>`: Seitentext; innerhalb einer `<table>` fallen Leerräume zusammen, jede Zeile (`<tr>`), Überschrift (`<caption>`), Zeilengruppe und `<br>` beginnt eine Zeile, und jede Zelle wird eine Spalte, gleich welches Markup sie enthält (`<p>`, `<div>`) und mit oder ohne End-Tags. Danach gelten die Regeln 3–5 für diesen Text. |
| 3 | Tabelle | jede Zahlenzeile hat 3 Werte, 3 oder mehr Zeilen, x streng steigend oder streng fallend, y_oben ≥ y_unten in ≥ 90 % der Zeilen | x, y_oben, y_unten je Zeile (z. B. Tabellen „X Yo Yu“); eine Tabelle mit fallendem x wird in umgekehrter Reihenfolge gelesen |
| 4 | Lednicer | alle 3 Lednicer-Bedingungen unten | Anzahlzeile, Oberseite Profilnase → Endleiste, Unterseite Profilnase → Endleiste |
| 5 | Selig | alle anderen Dateien | obere Endleiste → Profilnase → untere Endleiste |

Lednicer-Bedingungen:

- Die erste Zahlenzeile enthält 2 ganze Zahlen ≥ 2 (z. B. `61. 61.`).
- Mindestens 1 weitere Zahlenzeile folgt.
- Das x der nächsten Zeile liegt höchstens 1 % des x-Bereichs über dem kleinsten x aller folgenden Zeilen: Die Oberseite beginnt an der Profilnase.
- Auch die Unterseite beginnt höchstens 1 % des x-Bereichs über dem kleinsten x: an der angekündigten Trennung, wenn die Anzahlen mit der Zahl der folgenden Zeilen übereinstimmen, sonst am ersten x-Rücksprung (Regel unten), der mindestens 2 Punkte je Seite lassen muss. Eine Selig-Datei in Prozent, deren Endleistenzeile 2 ganze Zahlen enthält, z. B. `100 2`, erfüllt diese Bedingungen nicht und wird als Selig gelesen.

Weitere Regeln:

- XML und HTML: Dekodiert werden die Entitäten `&lt;` `&gt;` `&quot;` `&apos;` `&amp;`, `&nbsp;` (als Leerzeichen gelesen), `&#NNN;` und `&#xHHHH;` (als Unicode-Codepunkte, in einem Durchgang, sodass `&amp;lt;` zu `&lt;` wird). Ein Verweis auf ein Ersatzzeichen (Surrogat) oder über U+10FFFF bleibt wie geschrieben. Ohne `<pre>` entfällt der Inhalt von `<head>`, `<title>`, `<script>` und `<style>`.
- Lednicer: Passen die Anzahlen nicht zur Punktzahl, werden die Seiten am ersten x-Rücksprung getrennt. x-Rücksprung: x fällt um mehr als 25 % des vorherigen x.
- Zeilen mit mehr als 2 Werten, die keine Tabelle bilden: Spalten 1 und 2 werden verwendet.

### Nach dem Einlesen

Schritte in dieser Reihenfolge:

1. Ein Wert, der keine endliche Zahl ist, bricht den Import ab (Fehler `non-finite`).
2. Kein Punkt gefunden: Der Import bricht ab (Fehler `no-points`).
3. Mehr als 100 000 Punkte: Der Import bricht ab (Fehler `too-many-points`: `<n> Punkte; die Grenze liegt bei 100.000.`).
4. Aufeinanderfolgende doppelte Punkte (gleiches x und gleiches y) werden entfernt (Info `duplicates`), sodass ein doppelt geschriebener Schlusspunkt in Schritt 5 einmal zählt.
5. Geschlossene Kontur mit stumpfer Endleiste: Punkte auf der gezeichneten Endleistenstirn werden entfernt (Warnung `closing-point`, Regeln unten). Endleistenstirn: der steile Abschluss einer stumpfen Endleiste.
6. Größtes x über 5 und höchstens 110: Die Koordinaten gelten als Prozent der Profiltiefe und werden durch 100 geteilt.
7. Punkte im Uhrzeigersinn (Unterseite zuerst): Die Reihenfolge wird in Selig-Reihenfolge umgedreht. Die vorzeichenbehaftete Fläche wird relativ zum ersten Punkt in Einheiten der Konturausdehnung summiert, sodass der Test bei jedem Maßstab dasselbe ergibt.
8. Die Plausibilitätsprüfungen laufen (Abschnitt „Plausibilitätsprüfungen“).

Regeln für Schritt 5. Sie gelten bei mehr als 4 Punkten, wenn der letzte Punkt gleich dem ersten Punkt ist (gleiches x und gleiches y).

| Begriff | Definition |
| --- | --- |
| a, b, c | a = vorletzter Punkt, b = erster Punkt, c = zweiter Punkt |
| steil(p, q) | \|Δx\| ≤ 0,2 · \|Δy\| und \|Δy\| > 1e-6 des x-Bereichs |
| nahe Endleiste | x_max − x ≤ 1 % des x-Bereichs |

| Fall | Bedingung | Ergebnis |
| --- | --- | --- |
| 1 | a→b und b→c steil; a und c nahe Endleiste; y verläuft durch b in einer Richtung | Die Kontur beginnt auf der Endleistenstirn. Der erste und der letzte Punkt werden entfernt. |
| 2 | nicht Fall 1; a→b steil; a nahe Endleiste | Der letzte Punkt wird entfernt. |
| – | keiner der Fälle | Keine Änderung. |

### Meldungen beim Einlesen

Ein Fehler beim Einlesen bricht den Import ab. Die Plausibilitätsprüfungen laufen dann nicht.

| Code | Schweregrad | Bedingung |
| --- | --- | --- |
| `too-large` | Fehler | Eingabe länger als 5 000 000 Zeichen |
| `no-points` | Fehler | kein Koordinatenpunkt: keine Zahlenzeile oder kein `<point>` im XML-Element `<coordinates>` |
| `non-finite` | Fehler | eine Koordinate ist keine endliche Zahl, z. B. ein `<point>` ohne `<x>` oder `<y>` |
| `too-many-points` | Fehler | mehr als 100 000 Punkte; Textformate: das Einlesen endet bei mehr als 100 001 Zahlenzeilen |
| `xml-malformed` | Fehler | `<coordinates>` ohne schließendes Tag |
| `multi-element` | Warnung | mehr als 1 `<coordinates>`-Element; nur das erste wird gelesen |
| `ignored-lines` | Warnung | Nicht-Zahlenzeilen außer Namenszeile und Spaltenkopfzeilen. HTML mit `<title>`: jede Nicht-Zahlenzeile außer Spaltenkopfzeilen. |
| `extra-columns` | Warnung | Zeilen mit mehr als 2 Werten, die keine Tabelle bilden; Spalten 1 und 2 werden verwendet |
| `lednicer-count` | Warnung | Lednicer-Anzahlen weichen von der Punktzahl ab; Seiten am x-Rücksprung getrennt |
| `closing-point` | Warnung | Punkt auf der gezeichneten Endleistenstirn an einem oder beiden Enden entfernt |
| `percent` | Warnung | größtes x über 5 und höchstens 110; Koordinaten durch 100 geteilt |
| `reversed` | Warnung | Punkte im Uhrzeigersinn; Reihenfolge umgedreht |
| `xml` | Info | als XML gelesen |
| `html` | Info | aus einer HTML-Seite gelesen |
| `table` | Info | als Tabelle x/Oberseite/Unterseite gelesen |
| `decimal-comma` | Info | Dezimalkommas als Dezimalpunkte gelesen |
| `duplicates` | Info | aufeinanderfolgende doppelte Punkte entfernt |
| `no-name` | Info | kein Name gefunden; der Dateiname wird verwendet |
| `long-name` | Info | Name länger als 10 000 Zeichen; die ersten 10 000 werden verwendet. Meldung: `Die Namenszeile hat <n> Zeichen; die ersten 10.000 werden verwendet.` |

![Vorschau beim Hochladen von sample4412.txt, einer Prozenttabelle mit Dezimalkomma: Meldungen zu Dezimalkommas (decimal-comma), Tabelle (table), Prozent (percent) und Kennwerten (stats)](images/de/upload-preview.png)

### Plausibilitätsprüfungen

| Schweregrad | Wirkung |
| --- | --- |
| Fehler | Die Schaltfläche zeigt **Hinzufügen nicht möglich (Fehler)** (Cannot add (errors)) und ist gesperrt. Ein Profil mit Fehler blockiert den Flügelaufbau, sobald ein Schnitt es verwendet. |
| Warnung | **Zum Projekt hinzufügen** (Add to project) ist freigegeben. |
| Info | Nur Kennwerte. |

Die Prüfungen laufen:

- beim Hochladen einer Datei;
- bei **Eingefügten Text prüfen** (Check pasted text);
- in der Vorschau eines Bibliotheks- oder NACA-Profils (National Advisory Committee for Aeronautics);
- bei **Anzeigen** (View) eines Projektprofils (**Profile** (Airfoils) > **Projektprofile** (Project airfoils));
- beim Flügelaufbau für jedes Profil, das ein Schnitt verwendet.

| Begriff | Definition |
| --- | --- |
| Doppelte Punkte | Aufeinanderfolgende Punkte, die näher als 1e-9 des x-Bereichs (x_max − x_min, der Profiltiefe) am vorigen Punkt liegen, werden zuerst entfernt (Info `duplicates`: `<n> Punkte, die dem vorherigen Punkt näher als das 1e-9-Fache der Profiltiefe lagen, wurden entfernt.`; bei 1 Punkt: `1 Punkt, der dem vorherigen Punkt näher als das 1e-9-Fache der Profiltiefe lag, wurde entfernt.`), auch bei Punkten aus einer Projektdatei. |
| Normierung | x → (x − x_min) / c, y → (y − y_LE) / c, c = x_max − x_min; keine Drehung |
| Profilnase | Punkt mit dem größten Abstand zur Endleistenmitte (Mittel aus erstem und letztem Punkt); quadrierte Abstände, die relativ höchstens 1e-15 unter dem größten liegen, gelten als gleich, und von diesen gilt der Punkt mit dem kleinsten x; y_LE ist ihr y |
| % der Profiltiefe | Anteil der normierten Profiltiefe 1 |
| Prüfungen auf Rohkoordinaten (Dateien: nach den Schritten beim Einlesen) | `too-few-points`, `too-many-points`, `many-points`, `coarse`, `zero-chord`, `not-normalized`, `rotated`, `te-missing` |
| Prüfungen auf normierten Koordinaten | alle übrigen Prüfungen, beginnend mit `outline-length`; `curve-shape` prüft die NURBS-Kurve durch die normierten Punkte |
| Herkunft der Schwellwerte | `LIMITS` in `src/airfoil/sanity.js`; `WARN.pointsPerAirfoil` in `src/model/budget.js`; feste Werte in `checkAirfoil()`; `CROSSING_TOLERANCE` und `REVERSAL_TOLERANCE` in `src/geom/profile.js` |

| Code | Schweregrad | Bedingung | Schwellwert |
| --- | --- | --- | --- |
| `too-few-points` | Fehler | weniger Punkte als das Minimum | 5 Punkte |
| `too-many-points` | Fehler | mehr Punkte als das Maximum. Meldung: `<n> Punkte; die Grenze liegt bei 100.000.` | 100 000 Punkte |
| `zero-chord` | Fehler | alle Punkte haben dasselbe x | – |
| `outline-length` | Fehler | Länge der normierten Kontur (Summe der Abschnittslängen) über dem Schwellwert. Läuft nach der Normierung, vor `self-intersection`; beendet die übrigen Prüfungen. Meldung: `Die Kontur ist … Profiltiefen lang; eine Profilkontur ist etwa 2 Profiltiefen lang.` | 10 Profiltiefen |
| `folds` | Fehler | Anzahl der Punkte, an denen die Ober- oder Unterseite (an der Profilnase getrennt) in x zurückläuft (von der Profilnase zur Endleiste: x kleiner als am vorigen Punkt), über dem Schwellwert. Läuft nach `outline-length`, vor `self-intersection`; beendet die übrigen Prüfungen. Meldung: `Die Oberseite läuft an <n> Punkten in x zurück; die Grenze liegt bei 50.` (Unterseite entsprechend). | 50 Punkte |
| `self-intersection` | Fehler | 2 nicht benachbarte Konturabschnitte kreuzen sich. Eine Kreuzung des ersten und des letzten Abschnitts zählt nicht, wenn ihre freien Enden höchstens 1e-4 der Profiltiefe auseinanderliegen (`TE_CROSS_TOLERANCE`, die Grenze von `te-crossed`): UIUC-Dateien, die bei x = 1,00000 beginnen und bei x = 1,00001 enden, kreuzen sich dort um 2,7e-7 der Profiltiefe. Die Abschnitte werden in ein Gitter mit etwa 1 Zelle je Abschnitt einsortiert; ein Paar einsortierter Abschnitte wird einmal geprüft, in der linken unteren Zelle, die beide Hüllrechtecke gemeinsam haben; ein Abschnitt, der mehr als 16 Zellen überdeckt, wird gegen jeden Abschnitt geprüft; eine Zelle mit mehr als 32 Abschnitten wird mit einem eigenen Gitter erneut durchsucht, höchstens 6 Ebenen tief. Die Suche endet bei 10 Kreuzungen; die Meldung zählt dann `10+`. | – |
| `one-surface` | Fehler | Ober- oder Unterseite (an der Profilnase getrennt) hat weniger Punkte als das Minimum | 3 Punkte |
| `crossed-surfaces` | Fehler | Dicke an einer von 199 inneren, kosinusverteilten x-Positionen unter dem Schwellwert | −0,01 % der Profiltiefe |
| `surfaces-touch` | Fehler | Ober- und Unterseite berühren sich: Dicke an einem Dateipunkt oder einer kosinusverteilten Stützstelle zwischen 1 % und 99 % der Profiltiefe höchstens gleich dem Schwellwert. An jedem x zählen der tiefste Punkt der Oberseite und der höchste Punkt der Unterseite (senkrechte Abschnitte, in x zurücklaufende Profilseiten). Nur ohne `crossed-surfaces` gemeldet. | 0,001 % der Profiltiefe |
| `te-crossed` | Fehler | Endleistendicke (y des ersten Punkts − y des letzten Punkts) unter dem Schwellwert | −0,01 % der Profiltiefe |
| `te-missing` | Fehler | der erste oder der letzte Punkt liegt um mehr als den Schwellwert vor x_max (die Selig-Reihenfolge beginnt und endet an der Endleiste). Meldung: `Der erste Punkt liegt bei <x> % der Profiltiefe, nicht an der Endleiste; die Punktreihenfolge ist vermutlich nicht Selig, oder eine Profilseite ist unvollständig.` (letzter Punkt entsprechend). | 5 % der Profiltiefe |
| `curve-shape` | Fehler | die NURBS-Kurve durch die Punkte kreuzt sich selbst, oder eine Profilseite der Kurve läuft in x zurück, oder die NURBS-Interpolation durch die Punkte scheitert (Meldung der Vorschau: `Die NURBS-Interpolation durch die Punkte ist fehlgeschlagen (…).`). Läuft nach bestandenen übrigen Prüfungen, in der Vorschau und beim Flügelaufbau, beide mit der **Parametrisierung der Profile** (Profile parametrization) des Projekts (`settings.parametrization`). Schleifengröße: mittlere Breite = Fläche / Diagonale des Hüllrechtecks des Teils mit dem kleineren Hüllrechteck ([[Geometrie]], Abschnitt 1.4). | Schleifengröße über 0,05 % der Profiltiefe; Rücklauf in x über 0,01 % der Profiltiefe |
| `many-points` | Warnung | mehr Punkte als der Schwellwert. Meldung: `<n> Punkte (Warnung über 5.000): Die Prüfungen und der erste Aufbau eines Flügels, der das Profil verwendet, dauern <time>.` <time>: `unter 1 s` oder `etwa <t> s`, 30 µs je Punkt. | 5000 Punkte |
| `coarse` | Warnung | weniger Punkte als der Schwellwert | 20 Punkte |
| `not-normalized` | Warnung | x_min oder x_max der Datei weicht um mehr als den Schwellwert von 0 bzw. 1 ab; die Koordinaten werden auf Profiltiefe 1 skaliert | 0,02 |
| `rotated` | Warnung | Linie von der Profilnase zur Endleistenmitte um mehr als den Schwellwert geneigt. Die Koordinaten bleiben erhalten; die Schränkung bezieht sich daher auf die x-Achse der Datei. | 0,5° |
| `non-monotonic` | Warnung | x fällt entlang Ober- oder Unterseite von der Profilnase zur Endleiste um mehr als den Schwellwert | 0,0001 % der Profiltiefe |
| `te-gap` | Warnung | Endleistendicke über dem Schwellwert | 2 % der Profiltiefe |
| `te-base` | Warnung | Endleiste geschlossen: \|Endleistendicke\| < 1e-6 der Profiltiefe. Erster oder letzter Abschnitt steil: \|Δx\| ≤ 0,2 · \|Δy\|, \|Δy\| > 1e-6 der Profiltiefe, Endpunkt höchstens 1 % der Profiltiefe vor der Endleiste. Typische Ursache: Die gezeichnete Endleistenstirn wird als Konturpunkte gelesen. | – |
| `thin` | Warnung | größte Dicke unter dem Schwellwert | 1 % der Profiltiefe |
| `thick` | Warnung | größte Dicke über dem Schwellwert | 30 % der Profiltiefe |
| `spike` | Warnung | die Kontur knickt an einem Punkt um mehr als den Schwellwert; Punkte bis 2 Positionen neben der Profilnase werden übersprungen | 90° |
| `uneven-spacing` | Info | Längenverhältnis zweier benachbarter Konturabschnitte über dem Schwellwert | 25 |
| `stats` | Info | Punktzahl; größte Dicke (t/c) und ihre Lage, größte Wölbung und ihre Lage, Endleistendicke, in % der Profiltiefe. Wölbung: Mittel aus Ober- und Unterseite, gemessen von der Profilsehne (Profilnase bis Endleistenmitte). NACA-Profile zeigen weniger als die Nennwölbung: NACA 4415 3,74 % bei 42,2 %. | – |

- Roter Kreis in der Vorschau: Profilnase (`rotated`), erster kreuzender Abschnitt (`self-intersection`), erster Knickpunkt (`spike`), erster Punkt (`te-base`).

### Aktuelle Einschränkungen

| Bedingung | Ergebnis |
| --- | --- |
| HTML-Tabellenzellen mit anderen benannten Entitäten, z. B. `&ensp;` | Die Zeile gilt als Nicht-Zahlenzeile. Sind alle Zeilen betroffen: Fehler `no-points`. |
| XML-Datei mit mehr als 1 `<coordinates>`-Element | Nur das erste wird gelesen (Warnung `multi-element`). |

### Test mit echten Dateien

| Eigenschaft | Wert |
| --- | --- |
| Datum | 29.09.2026 |
| Dateien | 1964: mh-aerotools.de 56 HTML-Seiten und 55 XML-Dateien; aerodesign.de 188 (154 `.dat`, 34 `.txt`); UIUC (University of Illinois Urbana-Champaign) 1665 `.dat` |
| Dateien im Repository | keine (Lizenz) |
| Ergebnisse je Testmenge, abgelehnte Dateien und Fehlermeldungen | [[Profilquellen]], Abschnitt Einlesetest |

## Profilexport (`.dat`)

| Eigenschaft | Wert |
| --- | --- |
| Aufbau | Selig: Namenszeile, dann eine Zeile `x y` je Punkt. Ein Name, der sich als Koordinatenzeile oder als Kommentar liest (z. B. `123 456` oder `# custom`, da der Leser `#` bis zum Zeilenende verwirft), erhält das Präfix `Airfoil `; `<` vor `coordinates>` oder vor `html`, `pre` oder `body`, gefolgt von Leerzeichen, `>` oder dem Ende des Namens, wird als `‹` geschrieben, damit die Datei nicht als XML oder HTML gelesen wird. |
| Punkte | die gespeicherten Punkte des Profils, Selig-Reihenfolge |
| Zahlen | 7 Nachkommastellen bei einer Ausdehnung der Kontur von 1 oder mehr (Ausdehnung: der größere Wert aus x-Bereich und y-Bereich); darunter 7 − floor(log10(Ausdehnung)) Nachkommastellen, z. B. 13 bei 1e-6 Profiltiefe mit beliebigem x-Versatz; mehr, wenn 2 aufeinanderfolgende verschiedene Punkte auf dieselbe Zeile gerundet würden: mindestens 1 − floor(log10(d)) Nachkommastellen, d = kleinster von 0 verschiedener Koordinatenabstand aufeinanderfolgender Punkte; über 100 Nachkommastellen 17 signifikante Stellen. Jeder Wert rechtsbündig in mindestens 10 Zeichen, 1 Leerzeichen zwischen x und y |
| Zeilenende | LF, auch nach der letzten Zeile |
| Kodierung | UTF-8 |
| Herkunft und Lizenz | nicht geschrieben; die Namenszeile enthält nur den Profilnamen. `source` bleibt im Projekt-JSON. |

## Projekt-JSON

| Eigenschaft | Wert |
| --- | --- |
| Geschrieben von | **Speichern** (Save) und **Exportieren** (Export) > **Projekt-JSON** (Project JSON); gleicher Inhalt |
| Gelesen von | **Öffnen** (Open) |
| Kodierung | UTF-8, Einrückung 1 Leerzeichen; jedes Zahlen-Array (ein Punkt, ein Knotenvektor) auf einer Zeile |
| Von **Öffnen** gelesene Größe | höchstens 100 MB (100 000 000 Byte) |
| Einheiten | mm, Winkel in Grad (°) |
| Achsen | x in Profiltiefenrichtung zur Endleiste, y in Spannweitenrichtung zum rechten Flügelende, z nach oben; Spiegelebene y = 0 |
| Zahlen in `derived` | volle 64-Bit-Genauigkeit: die kürzeste Dezimalzahl, die denselben Wert ergibt (bis 17 signifikante Stellen) |

### Schlüssel der obersten Ebene

| Schlüssel | Typ | Geschrieben | Bei **Öffnen** |
| --- | --- | --- | --- |
| `format` | `"wingdesigner-project"` | immer | Pflicht, muss übereinstimmen |
| `version` | ganze Zahl `3`, oder `4`, wenn `settings.leftHalf` `"turned"` ist | immer | Pflicht, 1 bis 4. Eine Datei der Version 1 öffnet mit `settings.sectionPlanes` `"vertical"`, den Schnittebenen, mit denen sie entworfen wurde. Eine Datei der Version 2 mit `foldedTilt` wird aktualisiert (Abschnitt „Aktualisierung von Dateien der Version 2“). Eine Datei der Version 1 oder 2 öffnet mit `partTilt` und `partRoll` 0 und `partPivot` null, außer die Aktualisierung ihres `foldedTilt` setzt sie: `partTilt`, `partRoll` und `partPivot` in ihren Einstellungen sind unbekannte Schlüssel dieser Version und entfallen, wie die Apps dieser Version sie verwerfen. Eine App, die nur Version 1 liest, lehnt eine Datei der Version 2 ab (`Nicht unterstützte Projektversion 2.`), statt `sectionPlanes` und `foldedTilt` zu verwerfen; Wingdesigner 0.3.0 und älter lehnen eine Datei der Version 3 ab (`Nicht unterstützte Projektversion 3.`), statt `partTilt`, `partRoll` und `partPivot` zu verwerfen. Eine Datei der Version 1 bis 3 öffnet mit `settings.leftHalf` `"mirror"`; ein Schlüssel `leftHalf` darin entfällt. Wingdesigner 0.4.0 und älter lehnen eine Datei der Version 4 ab (`Nicht unterstützte Projektversion 4.`). |
| `generator` | `{ "name": "Wingdesigner", "version": "<App-Version>" }` | immer | ignoriert |
| `exportedAt` | Zeitpunkt nach ISO 8601, UTC | immer | ignoriert |
| `name` | Zeichenkette | immer | keine Zeichenkette: „Importierter Flügel“ (englische Oberfläche: `Imported wing`); höchstens 10 000 Zeichen |
| `units` | `"mm"` | immer | optional; jeder andere Wert wird abgelehnt |
| `coordinateSystem` | Text, Achsen wie oben | immer | ignoriert |
| `airfoils` | Array | immer | Pflicht, 1 bis 10 000 Einträge; insgesamt höchstens 1 000 000 Punkte |
| `sections` | Array | immer | Pflicht, 2 bis 20 000 Einträge |
| `guides` | Objekt mit `nose` und `end` | immer | optional; `null` gilt als fehlend; eine fehlende Leitkurve wird aus den Schnittkanten erzeugt, ausgeschaltet |
| `settings` | Objekt | immer, alle Schlüssel | optional; ein fehlender Schlüssel erhält seine Vorgabe; ein unbekannter Schlüssel entfällt |
| `foldedTilt` | `{ "angle": <°>, "x": <mm>, "z": <mm> }` | nur in einem Projekt, dessen Einrechnung die Aktualisierung einer Datei der Version 2 beibehält (Abschnitt „Aktualisierung von Dateien der Version 2“); der XFLR5-Import schreibt keines | optional; `null` gilt als fehlend. `angle` innerhalb von ±180°, `x` und `z` innerhalb von ±1 000 000 mm; andere Schlüssel darin entfallen. Der Einstellwinkel, den der XFLR5-Import des Formats Version 2 in die Schnittwerte eingerechnet hat, und der Ursprung des Flügels, um den er die Schnitte gedreht hat. Der Aufbau warnt, wenn ein solches Projekt Schnittebenen **Auf Gehrung** (Mitred) verwendet. In einer Datei der Version 1 ist der Schlüssel unbekannt und entfällt. |
| `derived` | Objekt | nur wenn der Flügel ohne Fehler aufgebaut wird und die Datei höchstens 100 MB groß bleibt | ignoriert; wird neu berechnet |

**Öffnen** verwirft unbekannte Schlüssel samt Inhalt: auf der obersten Ebene und in `airfoils[]`, `airfoils[].source`, `sections[]`, `guides`, `guides.nose`, `guides.end`, `settings` und `foldedTilt`.

### `airfoils[]`

| Schlüssel | Regel |
| --- | --- |
| `id` | nicht leere Zeichenkette, höchstens 200 Zeichen, eindeutig; referenziert von `sections[].airfoil` |
| `name` | Anzeigename, Zeichenkette mit höchstens 10 000 Zeichen; fehlt er oder besteht er nur aus Leerraum: die `id` |
| `points` | 5 bis 100 000 Paare `[x, y]` aus endlichen Zahlen, Selig-Reihenfolge, beliebiger Maßstab (der Flügelaufbau normiert sie). Alle Profile zusammen: höchstens 1 000 000 Punkte. Werte nach dem zweiten Wert eines Paars entfallen bei **Öffnen**. |
| `source` | Herkunft: Objekt mit den Schlüsseln `kind`, `id`, `file`, `attribution`, `license`, `url`, `terms`, `note`, `code`, `closedTE`. Jeder Wert ist eine Zeichenkette mit höchstens 2000 Zeichen, `true`, `false` oder `null`. Andere Schlüssel entfallen bei **Öffnen**. |

Von der App erzeugte IDs:

1. Den Namen in Kleinbuchstaben nehmen.
2. Akzente entfernen (ü → u; die Umlautregel der Dateinamen gilt nicht).
3. Jede Folge von Zeichen außerhalb `a–z 0–9` durch `-` ersetzen.
4. `-` am Anfang und am Ende entfernen.
5. Auf 40 Zeichen kürzen.
6. Leeres Ergebnis: `airfoil`.
7. ID schon vergeben: `-2`, `-3` … anhängen.

- Gleicher Name und identische Punkte wie ein Profil im Projekt: Die vorhandene ID wird verwendet; kein neuer Eintrag.
- Assistent und Beispielflügel: `naca<code>`.
- Erzeugtes NACA-Profil (`source.code` gesetzt) mit derselben Bezeichnung und demselben `source.closedTE` wie ein Profil im Projekt, dessen gespeicherte Punkte dieses Profil sind (Punkte des Generators auf 1e-9 genau, oder dieselben Punkte wie beim hinzugefügten Profil): Die vorhandene ID wird verwendet, unabhängig vom Namen; kein neuer Eintrag. Gespeicherte Punkte, die von beiden abweichen (z. B. in einer geöffneten Datei bearbeitet): neuer Eintrag.
- Projekt mit 10 000 Profilen (`LIMITS.maxAirfoils`): kein neuer Eintrag. Die Registerkarte **Profile** (Airfoils) lehnt das nächste Profil vor der Vorschau ab, mit der Meldung `Das Projekt enthält 10.000 Profile und hat damit die Grenze erreicht; „Unbenutzte entfernen“ schafft Platz.`
- Profil, mit dem die Punkte aller Profile 1 000 000 überschreiten würden (`LIMITS.maxAirfoilPoints`): kein neuer Eintrag. Meldung: `Mit diesem Profil enthalten die Projektprofile <n> Punkte; die Grenze liegt bei 1.000.000. „Unbenutzte entfernen“ gibt Punkte frei.`

| `source.kind` | Weitere Schlüssel |
| --- | --- |
| `naca` | NACA-Generator, Bibliothek, Assistent: `license`, `url`, `code` (Bezeichnung, z. B. `"2412"`), `closedTE` (`true` oder `false`). Beispielflügel: `note`. |
| `upload` | `file` (nur bei Dateien), `attribution` |
| `library` | `id`, `attribution`, `license`, `url`, `terms`, übernommen aus dem Eintrag im mitgelieferten Bibliotheksindex `public/airfoils/index.json` (`attribution`: `source.author` des Eintrags, angezeigt und änderbar im Feld **Quelle / Urheber** (Source / attribution) der Vorschau). Index: 6 Dateien. `public-domain` (in den Vereinigten Staaten; Status außerhalb der Vereinigten Staaten nicht geklärt): Clark Y, NACA 8-H-12, NACA M-6, RAF 34, USA 35B. `CC-BY-4.0`: S9104. Herkunft, Rechtsgrundlage, Bedingungen und Quellenangabe je Datei: `public/airfoils/NOTICE.md`. |
| `xflr5` | Profil eines importierten XFLR5-Projekts (`.xfl`): `file` (Name der XFLR5-Datei), `note`, `attribution` (nur bei manchen Namen). Abschnitt „XFLR5-Import“, Unterabschnitt „Ergebnis des Imports“. |

### `sections[]`

| Schlüssel | Einheit | Regel |
| --- | --- | --- |
| `id` | – | nicht leere Zeichenkette, höchstens 200 Zeichen, eindeutig; fehlt sie: `s<n>`, n = Position im Array ab 1 |
| `airfoil` | – | `id` eines Eintrags in `airfoils` |
| `x` | mm | Lage der Profilnase in Profiltiefenrichtung; −1 000 000 bis 1 000 000 mm |
| `y` | mm | Spannweitenposition, 0 bis 1 000 000 mm, verschieden von jedem anderen Schnitt |
| `z` | mm | Höhe der Profilnase; −1 000 000 bis 1 000 000 mm |
| `chord` | mm | Profiltiefe, 1 bis 100 000 mm |
| `twist` | ° | Schränkung: Drehung um den Tiefenpunkt bei `settings.twistPivot`; positiv = Nase hoch; −360 bis 360° |
| `panelAngle` | ° | optional; `null` oder fehlend: die V-Form aus `y` und `z`. Winkel des Feldes zum nächsten Schnitt (in der Reihenfolge von `y`), den Schnittebenen **Auf Gehrung** für die Neigungen und die Dickenstreckung verwenden ([[Geometrie]], Abschnitt 3.8); −89,9999 bis 89,9999°. Am Randschnitt und mit **Senkrecht** ungenutzt. Geschrieben vom XFLR5-Import (Abschnitt „XFLR5-Import“, Schritt 4) und von der Spalte **Feldwinkel** der Registerkarte Schnitte. |

- Jeder Wert außer `panelAngle` ist eine endliche Zahl.
- Grenzen: `LIMITS` in `src/model/project.js` (`minChord`, `maxChord`, `maxCoordinate`, `maxTwist`, `maxSections`, `maxAirfoils`, `maxAirfoilPoints`, `maxGuidePoints`, `maxGuideCoordinate`, `maxExtent`, `maxName`, `maxId`, `maxText`); Punkte je Profil: `MAX_POINTS` in `src/airfoil/parse.js`; Namen: `MAX_NAME` in `src/airfoil/parse.js`.
- Der Flügelaufbau prüft dieselben Grenzen (`limitErrors`); ein Projekt, das nicht gespeichert werden kann, kann daher nicht exportiert werden. Ziehen im Grundriss bleibt innerhalb der Grenzen: Profiltiefe 1 bis 100 000 mm, x der Profilnase innerhalb von ±1 000 000 mm, y eines Schnitts höchstens 1 000 000 mm, x eines Leitkurvenpunkts innerhalb von ±1 100 000 mm.
- Die Reihenfolge im Array ist frei. Der Flügelaufbau sortiert die Schnitte nach `y`.

### `guides.nose`, `guides.end`

`nose` ist die Nasenlinie (Nasenleiste im Grundriss), `end` die Endlinie (Endleiste im Grundriss).

| Schlüssel | Regel | Fehlt bei **Öffnen** |
| --- | --- | --- |
| `enabled` | `true` schaltet die Leitkurve ein, `false` aus; jeder andere Wert wird abgelehnt | `false` |
| `edited` | `true`, nachdem ein Punkt verschoben, hinzugefügt oder gelöscht wurde; `false` nach **Auf Schnitte zurücksetzen** (Reset to sections); jeder andere Wert wird abgelehnt. Wird ein Schnitt hinzugefügt oder gelöscht oder ändert sich sein y, x oder `chord` in der Tabelle der Registerkarte **Schnitte** (Sections), wird eine Leitkurve mit `enabled` `false` und `edited` ungleich `true` auf die Schnittkanten zurückgesetzt. | `true`, wenn die Punkte von den Schnittkanten abweichen (andere Punktzahl oder eine Koordinate um mehr als 1e-9 mm verschoben), sonst `false` |
| `mode` | `"fit"`: Kurve durch die Punkte; `"control"`: die Punkte bilden das Kontrollpolygon | abgelehnt |
| `degree` | ganze Zahl 1–5 (Grad) | `3` |
| `points` | 2 bis 20 000 Paare `[x, y]` in mm, Grundrisskoordinaten; x −1 100 000 bis 1 100 000 mm (eine ausgeschaltete Endlinie folgt x + `chord` der Schnitte), y −1 000 000 bis 1 000 000 mm. y muss streng steigen (geprüft beim Flügelaufbau). Der y-Bereich wird auf die Spannweite von der Wurzel bis zum Rand gestreckt. | abgelehnt |

### `settings`

| Schlüssel | Werte | Vorgabe | Bedienelement in **Einstellungen** (Settings) |
| --- | --- | --- | --- |
| `spanwise` | `"linear"`, `"straight"`, `"smooth"` | `"linear"` | **Interpolation in Spannweitenrichtung** (Spanwise interpolation). `"straight"`: **Gerade Felder (gerade Linien zwischen den Schnitten, wie XFLR5)** (Straight panels (straight lines between sections, as XFLR5)); eine App, die nur `"linear"` und `"smooth"` kennt, lehnt die Datei ab (`settings.spanwise muss "linear" oder "smooth" sein.`). |
| `sectionPlanes` | `"mitred"`, `"vertical"` | `"mitred"`; eine Datei der Version 1 öffnet mit `"vertical"` | **Schnittebenen** (Section planes): **Auf Gehrung (senkrecht zu den Feldern, wie XFLR5)** (Mitred (square to the panels, as XFLR5)) oder **Senkrecht (y = konstant)** (Vertical (y = const)) ([[Geometrie]], Abschnitt 3.8). `"smooth"` baut mit beiden Werten senkrechte Ebenen. |
| `twistPivot` | `0`–`1`, Anteil der Profiltiefe | `0.25` | **Drehpunkt der Schränkung (Anteil der Profiltiefe)** (Twist pivot (fraction of chord)) |
| `trailingEdge.mode` | `"asis"`, `"closed"`, `"thickness"` | `"asis"` | **Endleiste** (Trailing edge) |
| `trailingEdge.thickness` | ≥ 0 mm; wirkt bei `"thickness"`; begrenzt auf 5 % der örtlichen Profiltiefe | `0.4` | **Endleistendicke (mm)** (Trailing-edge thickness (mm)) |
| `tip.mode` | `"flat"`, `"pointed"` | `"flat"` | **Flügelende** (Wing tip) |
| `tip.ratio` | `0.001`–`0.01` (Randprofil 1/1000 bis 1/100 der Profiltiefe des vorherigen Schnitts); Randtiefe mindestens 1 mm (`LIMITS.minChord`) | `0.005` (1/200) | **Maßstab des Randprofils 1 : N der Tiefe des vorherigen Schnitts** (Tip profile scale 1 : N of the previous section chord) |
| `chordSamples` | ganze Zahl `16`–`200` | `60` | **Stationen je Profilseite** (Chordwise stations per surface) |
| `panelStations` | ganze Zahl `3`–`40`; der Flügelaufbau verwendet nur dann weniger, wenn das Flächengitter 5 000 000 Punkte überschreiten würde ([[Geometrie]], Abschnitt 3.2) | `8` | **Stationen je Feld mit Leitkurve, glatter Interpolation oder linearen Feldern auf Gehrung** (Spanwise stations per panel with guides, smooth mode or mitred linear panels) |
| `parametrization` | `"uniform"`, `"chord"`, `"centripetal"` | `"centripetal"` | **Parametrisierung der Profile** (Profile parametrization) |
| `mirror` | `true`, `false`; nur 3D-Ansicht, ohne Wirkung auf Exporte | `true` | **Gespiegelte Hälfte zeigen (y < 0)** (Show mirrored half (y < 0)) |
| `partTilt` | −180 bis 180°; positiv = Nasenleiste hoch | `0` | **Einstellwinkel des Teils (°, positiv = Nasenleiste hoch)** (Part tilt (°, positive = leading edge up)): starre Drehung des ganzen Teils um die y-Achse durch `partPivot`, nach dem Rollwinkel ([[Geometrie]], Abschnitt 3.9) |
| `partRoll` | −180 bis 180°; positiv = rechter Randbogen hoch | `0` | **Rollwinkel des Teils (°, positiv = rechter Randbogen hoch)** (Part roll (°, positive = right tip up)): starre Drehung des ganzen Teils um die x-Achse durch `partPivot`, vor dem Einstellwinkel |
| `partPivot` | `null` oder `{ "x": <mm>, "y": <mm>, "z": <mm> }` mit jedem Wert innerhalb von ±1 000 000 mm | `null` | keines; die Zeile unter **Rollwinkel des Teils** nennt ihn. `null`: die Nasenleiste (x, y, z) des Wurzelschnitts. Der XFLR5-Import speichert den Ursprung des Flügels `{ "x": k·LE_x, "y": 0, "z": k·LE_z }` (Abschnitt „XFLR5-Import“, Schritt 3). |
| `leftHalf` | `"mirror"`, `"turned"` | `"mirror"` | **Linke Hälfte** (Left half): `"mirror"` **Spiegelbild der gedrehten rechten Hälfte** (Mirror image of the turned right half); `"turned"` **Mit der rechten Hälfte gedreht (ganzer Flügel, wie flow5)** (Turned with the right half (whole wing, as flow5)): Die linke Hälfte ist das Spiegelbild der ungedrehten rechten Hälfte, mit ihr um `partRoll` und `partTilt` gedreht ([[Geometrie]], Abschnitt 3.9). Die beiden unterscheiden sich nur bei einem Rollwinkel des Teils ungleich 0°. Ein Projekt mit `"turned"` wird im Format Version 4 gespeichert. |

Unbekannte Schlüssel in `settings` entfallen bei **Öffnen**. **Speichern** schreibt die Schlüssel dieser Tabelle.

### `derived` (nur Export)

| Schlüssel | Inhalt |
| --- | --- |
| `profiles[]` | ein Eintrag je Profil, das ein Schnitt verwendet: `airfoil` (ID), `name`, `curve`, `leadingEdgeParameter` (Kurvenparameter an der Profilnase) |
| `guides.nose`, `guides.end` | Leitkurve, Kontrollpunkte `[x, y]` in mm; `null` bei ausgeschalteter Leitkurve |
| `stations[]` | jede Station in Spannweitenrichtung: `y` (mm), `v` (Spannweitenanteil 0–1), `xLE`, `z`, `chord` (mm), `twist` (°), `roll` (°, Neigung der Stationsebene um x) und `stretch` (Dickenfaktor), [[Geometrie]], Abschnitt 3.8 |
| `surface` | Fläche des rechten Halbflügels: `degreeU` (3), `degreeV` (1, wenn kein Feld Zwischenstationen hat: `spanwise` `"straight"`, und `"linear"` ohne Leitkurven und ohne Felder zwischen Gehrungsebenen verschiedener Neigung; mit Zwischenstationen (eine Leitkurve eingeschaltet, oder `"linear"`-Felder zwischen Gehrungsebenen verschiedener Neigung): 3, oder 2 bzw. 1, wenn die Grenze des Flächengitters die Stationen je Feld auf 2 oder 1 senkt; `"smooth"`: 3), `knotsU`, `knotsV`, `controlPoints`, `leadingEdgeU`, `closedTrailingEdge` |

- Kurvenobjekt: `degree`, `knots` (Knotenvektor), `controlPoints`. Alle Kurven und die Fläche sind nicht-rational; ein Schlüssel `weights` wird nicht geschrieben.
- `profiles[].curve.controlPoints`: `[x, y]` in normierten Profilkoordinaten (Profiltiefe 1).
- `surface.controlPoints[i][j]`: `[x, y, z]` in mm. i läuft entlang u: u = 0 obere Endleiste, u = `leadingEdgeU` Profilnase, u = 1 untere Endleiste. j läuft entlang v: v = 0 Wurzel, v = 1 Rand.
- Algorithmen: [[Geometrie|Geometrie]].
- Größe: **Speichern** und **Exportieren** > **Projekt-JSON** schätzen die Zeichen von `derived`: Anzahl der Zahlen mal mittlere Länge der Koordinaten von höchstens 1000 über die Fläche verteilten Kontrollpunkten, zuzüglich 2 Zeichen je Zahl. Bis 110 MB nach dieser Schätzung schreiben sie die Datei mit `derived` und messen sie. Überschreitet die Schätzung 110 MB oder die geschriebene Datei 100 MB, lassen sie `derived` weg und zeigen die Meldung `Die Datei lässt die abgeleiteten NURBS-Daten weg: Mit ihnen wäre sie größer als die 100 MB, die „Öffnen“ höchstens liest. „Öffnen“ berechnet sie neu; der STEP-Export schreibt die exakten Flächen.`
- Ohne `derived` wird ein Text über 100 MB ohne Einrückung geschrieben. Überschreitet er auch dann 100 MB (Namen und Quelltexte nahe an ihren Grenzen, z. B. 10 000 Profile mit Namen von 10 000 Zeichen), entsteht keine Datei; **Speichern** zeigt `Speichern fehlgeschlagen: Das Projekt belegt als Datei … MB, mehr als die 100 MB, die „Öffnen“ liest.`

### Prüfungen bei **Öffnen**

Die Datei wird abgelehnt, und die ersten 3 Meldungen erscheinen, wenn:

- der Text kein gültiges JSON ist;
- `format`, `version` oder `units` nicht der Tabelle oben entsprechen;
- die Datei größer als 100 MB ist (100 000 000 Byte; **Öffnen** prüft die Dateigröße vor dem Einlesen und zeigt `<file> kann nicht geöffnet werden: <size> MB; Projektdateien sind auf 100 MB begrenzt.`);
- `settings` kein Objekt ist, oder `settings.trailingEdge` oder `settings.tip` vorhanden, nicht `null` und kein Objekt ist;
- `guides` weder ein Objekt noch `null` ist;
- `airfoils` leer ist oder mehr als 10 000 Einträge hat, oder `sections` weniger als 2 oder mehr als 20 000 Einträge hat;
- die Profile zusammen mehr als 1 000 000 Punkte enthalten;
- ein Eintrag in `airfoils` oder `sections` kein Objekt ist;
- eine Profil-`id` keine nicht leere Zeichenkette ist, länger als 200 Zeichen ist oder doppelt vorkommt;
- eine Schnitt-`id` keine nicht leere Zeichenkette ist, länger als 200 Zeichen ist oder doppelt vorkommt;
- `name` länger als 10 000 Zeichen ist, oder der `name` eines Profils vorhanden und keine Zeichenkette oder länger als 10 000 Zeichen ist;
- `source` eines Profils vorhanden, nicht `null` und kein Objekt ist, oder ein bekannter Schlüssel in `source` etwas anderes als eine Zeichenkette, `true`, `false` oder `null` enthält oder eine Zeichenkette mit mehr als 2000 Zeichen;
- ein Profil weniger als 5 oder mehr als 100 000 Punkte hat oder ein Punkt kein Paar `[x, y]` aus endlichen Zahlen ist;
- `x`, `y`, `z`, `chord` oder `twist` eines Schnitts keine endliche Zahl ist oder `panelAngle` vorhanden und weder `null` noch eine endliche Zahl ist;
- `chord` < 1 mm oder > 100 000 mm, `y` < 0, 2 Schnitte dasselbe `y` haben oder `airfoil` eine unbekannte ID nennt;
- `x`, `y` oder `z` eines Schnitts außerhalb von −1 000 000 bis 1 000 000 mm liegt, `twist` außerhalb von −360 bis 360° oder `panelAngle` außerhalb von −89,9999 bis 89,9999°;
- ein Wert in `settings` außerhalb der Tabelle oben liegt;
- `settings.partTilt` oder `settings.partRoll` keine Zahl innerhalb von ±180° ist (`settings.partTilt muss eine Zahl innerhalb von ±180 Grad sein.`, ebenso mit `partRoll`);
- `settings.partPivot` weder `null` noch ein Objekt mit den Zahlen `x`, `y` und `z` innerhalb von ±1 000 000 mm ist (`settings.partPivot muss null oder ein Objekt mit den Zahlen x, y und z innerhalb von ±1.000.000 mm sein.`);
- `foldedTilt` vorhanden, nicht `null` und kein Objekt mit den Zahlen `angle`, `x` und `z` ist, oder `angle` außerhalb von ±180° oder `x` oder `z` außerhalb von ±1 000 000 mm liegt;
- `guides.nose` oder `guides.end` weder ein Objekt noch `null` ist;
- `enabled` einer Leitkurve weder `true` noch `false` ist, oder `edited` einer Leitkurve vorhanden und weder `true` noch `false` ist;
- `mode` einer Leitkurve weder `"fit"` noch `"control"` ist;
- eine Leitkurve weniger als 2 oder mehr als 20 000 Punkte hat, ein Punkt kein Paar aus endlichen Zahlen ist, das x eines Punkts außerhalb von −1 100 000 bis 1 100 000 mm oder sein y außerhalb von −1 000 000 bis 1 000 000 mm liegt;
- `degree` einer Leitkurve keine ganze Zahl 1–5 ist.

Anzahlen werden vor den Inhalten geprüft. Mehr als 10 000 Profile oder mehr als 20 000 Schnitte: Die Datei wird abgelehnt, ohne einen Eintrag zu lesen. Mehr als 1 000 000 Profilpunkte insgesamt: Die Datei wird abgelehnt, bevor ein Punkt gelesen wird. Ein Profil mit mehr als 100 000 Punkten oder eine Leitkurve mit mehr als 20 000 Punkten: Ihre Punkte werden nicht gelesen.

Größen über einer Warnschwelle und innerhalb dieser Grenzen (`WARN` in `src/model/budget.js`: 200 Schnitte, 200 Profile, 5000 Punkte in einem Profil, 100 000 Profilpunkte insgesamt, 500 Punkte in einer eingeschalteten Leitkurve, 60 000 Punkte im Flächengitter, ein Name mit 200 Zeichen) öffnen mit einer Warnung in der Registerkarte **Prüfungen** (Checks). Die Warnung nennt die erwartete Zeit und den Speicherbedarf jeder Änderung: `Großes Projekt: <sizes>. Jede Änderung dauert <time> und belegt <memory> Arbeitsspeicher.` Eine Meldung zeigt denselben Text, wenn eine Größe ihre Schwelle überschreitet.

Erst beim Flügelaufbau geprüft, in dieser Reihenfolge:

- die Plausibilitätsprüfungen der Profile;
- `curve-shape`: Die NURBS-Profilkurve kreuzt sich selbst (Schleifengröße, mittlere Breite, über 0,05 % der Profiltiefe) oder läuft in x zurück (über 0,01 % der Profiltiefe);
- Leitkurven: y streng steigend; die Kurve läuft in Spannweitenrichtung nicht zurück; x jedes Kontrollpunkts der Kurve innerhalb von ±1 200 000 mm;
- `spanwise` `"straight"` mit eingeschalteter Leitkurve;
- `sectionPlanes` `"mitred"` (nicht mit `"smooth"`): eine Schnittebene mehr als 60° schräg zu einem benachbarten Feld (Dickenstreckung über 2; eine Ebene, die gerundet 60,0° schräg liegt, wird gebaut), oder, mit `spanwise` `"straight"`, die Ebenen zweier benachbarter Schnitte schneiden sich innerhalb der Profile ([[Geometrie]], Abschnitt 3.6);
- interpolierte Schnittwerte sind endliche Zahlen (x der Profilnase, Profiltiefe, z, Kosinus der Schränkung);
- interpoliertes x der Profilnase, x der Endleiste und z innerhalb von ±1 200 000 mm, Profiltiefe höchstens 100 000 mm;
- `sectionPlanes` `"mitred"` mit `spanwise` `"linear"`: Entlang eines Feldes drehen sich die Schnittebenen schneller, als seine Profile es zulassen, daher faltet sich die Fläche; an einem Schnitt zählen beide benachbarten Felder ([[Geometrie]], Abschnitt 3.6);
- `spanwise` `"smooth"`: ein interpolierter Wert (x der Profilnase, Profiltiefe, z, Schränkung oder Höhe eines Konturpunkts) liegt um mehr als das 2-Fache des Bereichs seiner Schnittwerte außerhalb dieses Bereichs;
- Dicke des interpolierten Profils unter 0 (`spanwise` `"smooth"`: Überschwingen; `"linear"`: Ober- und Unterseite eines Profils kreuzen sich);
- Dicke nach der Endleisteneinstellung unter 0;
- Ober- und Unterseite berühren sich nach der Interpolation oder nach der Endleisteneinstellung: Dicke an einer Tiefenstation zwischen 1 % und 99 % der Profiltiefe höchstens 0,001 % der Profiltiefe;
- Profiltiefe unter 1 mm;
- `sectionPlanes` `"mitred"`: Nach der Anpassung kreuzen sich die Ebenen zweier benachbarter Stationen innerhalb der Profile;
- angepasste Fläche mit nicht endlichen Koordinaten;
- angepasste Fläche stülpt sich zwischen den Stationen um (örtliche Dicke unter 0) oder hat dort die Dicke 0 (höchstens 0,001 % der Profiltiefe zwischen 1 % und 99 % der Profiltiefe);
- Profiltiefe der angepassten Fläche zwischen den Stationen unter 0,9 mm (die Fläche faltet sich oder schnürt sich ein);
- Flächenzeile kreuzt sich an einem Schnitt, in der Mitte zwischen 2 Schnitten oder in der Mitte zwischen den 2 Stationen eines der 64 breitesten Stationsintervalle (Schleifengröße, mittlere Breite, über 0,05 % der örtlichen Profiltiefe);
- `partTilt` oder `partRoll` nicht 0: Ein mit dem Teil gedrehter Kontrollpunkt der Fläche liegt in x, y oder z außerhalb von ±1 200 000 mm (`Das gedrehte Teil reicht bis x = … mm, y = … mm, z = … mm, außerhalb von ±1.200.000 mm; Einstellwinkel oder Rollwinkel des Teils verkleinern oder das Teil näher an seinen Drehpunkt legen.`).

Mit `parametrization` `"chord"` oder `"uniform"` endet ein Profilfehler beim Flügelaufbau (Plausibilitätsprüfung oder `curve-shape`) mit `Die Einstellung „Zentripetal“ unter Einstellungen > Parametrisierung der Profile folgt den Punkten genauer.`

Ein Fehler blockiert den Flügel und den Export nach STEP, STL und 3MF. Meldungen: [[Benutzerhandbuch|Benutzerhandbuch]], Abschnitt Prüfungen.

### Aktualisierung von Dateien der Version 2

Der XFLR5-Import des Formats Version 2 hat den Einstellwinkel eines Teils mit Einstellwinkel in die Schnittwerte eingerechnet (jeder Punkt beim Viertel der Profiltiefe um den Ursprung des Flügels gedreht, der Winkel zu jeder Schränkung addiert) und den Winkel als `foldedTilt` gespeichert. **Öffnen** und die Wiederherstellung der Browserkopie machen aus einem solchen Projekt der Version 1 oder 2 den starren Einstellwinkel der Version 3:

```
p = settings.twistPivot     c = Profiltiefe des Schnitts, wie der Aufbau sie verwendet
                            (spitzes Flügelende: am Randschnitt max(tip.ratio · vorherige Profiltiefe, 1 mm))
θ = foldedTilt.angle        (X, Z) = (foldedTilt.x, foldedTilt.z)
dx = x + p·c − X            dz = z − Z
x' = dx·cos θ − dz·sin θ + X − p·c
z' = dx·sin θ + dz·cos θ + Z
twist' = twist − θ          y, chord unverändert
settings.partTilt = θ, partRoll = 0, partPivot = { x: X, y: 0, z: Z }; foldedTilt entfernt
```

- Der Drehpunkt der Schränkung jedes Schnitts dreht sich um (X, Z) zurück, sodass die Schnitte die Werte des ungedrehten Teils halten.
- Der Hinweis nach **Öffnen** (nach `<Datei> geöffnet.`) und nach der Wiederherstellung nennt die Änderung: `Der Einstellwinkel von 3°, den der XFLR5-Import in die Schnitte eingerechnet hatte, ist ein starrer Einstellwinkel des ganzen Teils (Einstellungen > Einstellwinkel des Teils); die Schnitte halten die Werte des ungedrehten Teils.` Mit Schnittebenen **Auf Gehrung** ergänzt er `Mit Schnittebenen auf Gehrung ändert sich die Form: Der eingerechnete Einstellwinkel war nur für senkrechte Ebenen genau, der starre Einstellwinkel setzt das Teil wie XFLR5.`
- Mit Schnittebenen **Senkrecht** baut das aktualisierte Projekt dasselbe Teil: innerhalb von 1e-6 mm in Unit-Tests mit dem Drehpunkt der Schränkung 0,25 und 0,5, einem spitzen Flügelende und **Gerade Felder** (`test/part.test.js`). **Lage der MAC** und **25 % MAC** verschieben sich bei 3° Einstellwinkel um 0,105 mm: Die Kennwerte drehen die Profilnase selbst ([[Geometrie]], Abschnitt 7).
- Die Einrechnung bleibt, mit `foldedTilt`, wenn eine Leitkurve eingeschaltet ist oder ausgeschaltet mit bearbeiteten Punkten (Leitkurven halten nur x, als Funktion von y): `Der Einstellwinkel von 3° des XFLR5-Imports bleibt in die Schnitte eingerechnet: Eine Leitkurve ist eingeschaltet oder bearbeitet, und Leitkurven halten nur x.` Sie bleibt auch, wenn eine Schränkung ohne sie außerhalb von ±360° läge: `Der Einstellwinkel von -3° des XFLR5-Imports bleibt in die Schnitte eingerechnet: Ohne ihn läge eine Schränkung außerhalb von ±360°.` Sie bleibt auch, wenn ein Schnitt ohne sie außerhalb von ±1 000 000 mm läge (eingerechnete Schnitte nahe der Koordinatengrenze): `Der Einstellwinkel von 45° des XFLR5-Imports bleibt in die Schnitte eingerechnet: Ohne ihn läge ein Schnitt außerhalb von ±1.000.000 mm.`
- Das aktualisierte Projekt durchläuft die Prüfungen oben erneut.
- Eine Datei der Version 3 behält ein gespeichertes `foldedTilt` unverändert.

### Beispiel

Beispielflügel „Sportflügel 1500“ (englische Oberfläche: „Sport wing 1500“), gekürzt; `"..."` markiert ausgelassene Einträge:

```json
{
 "format": "wingdesigner-project",
 "version": 3,
 "generator": { "name": "Wingdesigner", "version": "0.4.0" },
 "exportedAt": "2026-09-30T12:00:00.000Z",
 "name": "Sportflügel 1500",
 "units": "mm",
 "coordinateSystem": "x chordwise towards the trailing edge, y spanwise towards the right tip, z up; mirror plane y = 0",
 "airfoils": [
  { "id": "naca2412", "name": "NACA 2412",
    "points": [[1.00008381395326, 0.001257209298899305], "..."],
    "source": { "kind": "naca", "note": "Generated from the NACA 4/5-digit equations (NACA Report 824)." } },
  "..."
 ],
 "sections": [
  { "id": "root", "twist": 0, "z": 0, "airfoil": "naca2412", "x": 0, "y": 0, "chord": 240 },
  { "id": "mid", "twist": -0.8, "z": 12, "airfoil": "naca2412", "x": 12, "y": 450, "chord": 205 },
  { "id": "tip", "twist": -2.5, "z": 33, "airfoil": "naca2410", "x": 55, "y": 750, "chord": 130 }
 ],
 "guides": {
  "nose": { "enabled": false, "mode": "fit", "degree": 3, "points": [[0, 0], [12, 450], [55, 750]] },
  "end": { "enabled": false, "mode": "fit", "degree": 3, "points": [[240, 0], [217, 450], [185, 750]] }
 },
 "settings": {
  "spanwise": "linear", "sectionPlanes": "mitred", "twistPivot": 0.25,
  "trailingEdge": { "mode": "thickness", "thickness": 0.5 },
  "tip": { "mode": "flat", "ratio": 0.005 },
  "chordSamples": 60, "panelStations": 8, "parametrization": "centripetal", "mirror": true,
  "partTilt": 0, "partRoll": 0, "partPivot": null
 },
 "derived": {
  "profiles": [
   { "airfoil": "naca2412", "name": "NACA 2412",
     "curve": { "degree": 3, "knots": [0, 0, 0, 0, 0.00328475901275, "..."], "controlPoints": [[1, 0.00125710393605], "..."] },
     "leadingEdgeParameter": 0.500163244987 },
   "..."
  ],
  "guides": { "nose": null, "end": null },
  "stations": [
   { "y": 0, "v": 0, "xLE": 0, "z": 0, "chord": 240, "twist": 0, "roll": 0, "stretch": 1.00035549236814 },
   { "y": 17.127105185, "v": 0.022836140247, "xLE": 0.456722804932, "z": 0.456722804932, "chord": 238.667891819, "twist": -0.030448186995, "roll": 0.105268866729, "stretch": 1.00030817127560 },
   "...",
   { "y": 750, "v": 1, "xLE": 55, "z": 33, "chord": 130, "twist": -2.5, "roll": 4.00417294071, "stretch": 1 }
  ],
  "surface": {
   "degreeU": 3, "degreeV": 3,
   "knotsU": [0, 0, 0, 0, 0.00508113999608, "..."], "knotsV": [0, 0, 0, 0, 0.0986330253937, "...", 0.6, 0.6, 0.6, "...", 1, 1, 1, 1],
   "controlPoints": [[[240.020113789, 0, -0.124002411422], "..."], "..."],
   "leadingEdgeU": 0.501717967263, "closedTrailingEdge": false
  }
 }
}
```

Anzahlen in dieser Datei: 161 Punkte je Profil, 165 Knoten je Profilkurve, 17 Stationen (8 je Feld:
Beide Felder liegen zwischen Gehrungsebenen verschiedener Neigung), 121 × 17 Kontrollpunkte der Fläche,
125 Werte in `knotsU`, 21 Werte in `knotsV`. Die Texte in `coordinateSystem` und `source.note` sind feste
englische Texte; die Sprache ändert sie nicht.

### Kopie im Browser (`localStorage`)

| Eigenschaft | Wert |
| --- | --- |
| Schlüssel | `wingdesigner.project.v1` |
| Gespeicherte Schlüssel | wie im Projekt-JSON, ohne `generator`, `exportedAt`, `coordinateSystem` und `derived`; `version` wie in einer gespeicherten Datei (3, oder 4 mit `settings.leftHalf` `"turned"`) |

| Ereignis | Verhalten |
| --- | --- |
| Änderung in der App | nur gespeichert, wenn das Projekt die Prüfungen bei **Öffnen** besteht; sonst bleibt die letzte gültige Kopie |
| Seite vor dem nächsten Animations-Frame verborgen oder verlassen (Neuladen, Schließen des Tabs) | die ausstehende Änderung wird sofort gespeichert (`pagehide`, `visibilitychange`) |
| Assistent des ersten Aufrufs offen | nichts gespeichert; ein Neuladen öffnet den Assistenten erneut |
| Gespeicherte Kopie des Formats Version 1 oder 2 mit `foldedTilt` | beim Laden aktualisiert wie bei **Öffnen** (Abschnitt „Aktualisierung von Dateien der Version 2“); ein Hinweis zeigt die Zeilen der Aktualisierung |
| Gespeicherte Kopie besteht die Prüfungen beim Laden nicht | Text in den Schlüssel `wingdesigner.project.v1.rejected` kopiert, rote Meldung mit dem ersten Problem, der Assistent des ersten Aufrufs öffnet sich über dem Beispielflügel „Sportflügel 1500“ |
| `localStorage` nicht verfügbar oder voll | keine Kopie; das Projekt existiert nur im geöffneten Browser-Tab |

## XFLR5-Import

**Öffnen** (Open) liest ein XFLR5-Projekt (`.xfl`) oder eine XFLR5-Flugzeug- oder -Flügeldatei (`.xml`) und importiert daraus eine Fläche: die Tragfläche oder das Höhenleitwerk (XFLR5 nennt es Elevator). XFLR5 ist ein Programm zur Analyse von Profilen und Flügeln. Ein Dialog fragt nach Flugzeug, Fläche und Profilen und zeigt einen Bericht; seine Bedienelemente beschreibt das [[Benutzerhandbuch|Benutzerhandbuch]], Abschnitt Import aus XFLR5. **Importieren** (Import) ersetzt das aktuelle Projekt in einem Rückgängig-Schritt. **Abbrechen** (Cancel) ändert nichts und legt keinen Rückgängig-Schritt an.

### Unterstützte Dateien

| Datei | Geschrieben von | Inhalt | Import |
| --- | --- | --- | --- |
| `.xfl`-Projekt, Format 200001 | XFLR5 6.10.01 bis 6.43 | Flugzeuge in Metern; Profile mit Koordinaten | ja |
| `.xfl`-Projekt, Format 200002 | XFLR5 6.44 bis 6.62 | dasselbe | ja |
| XML-Flugzeugdatei: `<explane version="1.0">` mit `<Plane>` | XFLR5 6.11 bis 6.62 (das Element `<Type>` ab 6.12) | Flügel in der Längeneinheit, die XFLR5 anzeigt; Profilnamen, keine Koordinaten | ja |
| XML-Flügeldatei: `<explane version="1.0">` mit `<wing>` und ohne `<Plane>` | XFLR5 6.41 bis 6.62 (Flügeleditor, Export in eine XML-Datei) | ein Flügel; Position 0, 0, 0 und Einstellwinkel 0 | ja |

- XFLR5 6.62 ist die letzte XFLR5-Version.
- Ein `.xfl`-Projekt enthält die Profilkoordinaten. Eine XML-Datei enthält nur die Profilnamen (Abschnitt „Profile“).
- Ein `.xfl`-Projekt kann viele Flugzeuge enthalten. XFLR5 schreibt ein Flugzeug in eine XML-Flugzeugdatei; eine Datei mit mehreren `<Plane>`-Elementen führt jedes davon auf.

### Abgelehnte Dateien

Eine abgelehnte Datei zeigt die rote Meldung `<file> kann nicht geöffnet werden: <message>`. Der Entwurf bleibt unverändert, und es wird kein Rückgängig-Schritt angelegt. Die Codes benennen die Fälle in dieser Dokumentation; die App zeigt sie nicht.

| Code | Datei | Meldung |
| --- | --- | --- |
| `wpa` | `.wpa`-Projekt (XFLR5 6.02 bis 6.09) | `Die Datei ist ein .wpa-Projekt von XFLR5 6.09 oder älter: in XFLR5 6.62 öffnen und als .xfl speichern.` |
| `not-xflr5` | Binärdatei, deren erste Zahl nicht 200001 oder 200002 ist | `Die Datei ist kein XFLR5-Projekt (sie beginnt mit 7b 22 66 6f).` Die Bytes sind die ersten 4 Byte der Datei in hexadezimaler Schreibweise. |
| `not-xflr5` | leere Datei | `Die Datei ist leer und kein XFLR5-Projekt.` |
| `no-plane` | `.xfl`-Projekt ohne Flugzeug: ein reines Profilprojekt, jede `.xfl`-Datei, die flow5 speichert | `Das Projekt enthält kein Flugzeug (reine Profilprojekte und von flow5 gespeicherte .xfl-Dateien haben keines).` |
| `damaged` | `.xfl`-Projekt im Kopf, in einem Flugzeug, einem Flügel, einem Flügelschnitt oder einem Rumpf abgeschnitten oder widersprüchlich | `Die Datei ist bei Byte <n> beschädigt oder abgeschnitten (<part>).` |
| `not-plane-xml` | XML-Datei, deren Wurzelelement nicht `explane` (Groß- und Kleinschreibung zählt) oder deren `version` nicht `1.0` ist | `Die Datei ist keine XFLR5-Flugzeug- oder -Flügeldatei (Wurzelelement „<root>“, Version „<version>“).` |
| `not-plane-xml` | Text, der nicht mit einem XML-Element beginnt (Leerraum, XML-Deklaration, DOCTYPE (Dokumenttypdeklaration, document type declaration) und Kommentare davor sind erlaubt) | `Die Datei ist keine XFLR5-Flugzeug- oder -Flügeldatei: Sie beginnt nicht mit einem XML-Element.` |
| `no-plane` | XML-Datei weder mit `<Plane>` noch mit `<wing>` | `Die XML-Datei enthält weder ein Flugzeug noch einen Flügel.` |
| `fin` | XML-Flügeldatei, deren Flügel ein Seitenleitwerk ist (`<Type>FIN</Type>` oder `<isFin>true</isFin>`) | `Der XML-Flügel „<name>“ ist ein Seitenleitwerk; importiert werden können nur eine Tragfläche oder ein Höhenleitwerk.` |
| `damaged` | XML-Datei mit `length_unit_to_meter` unter 1e-6 oder über 1000 oder keiner Zahl | `Die Längeneinheit der XML-Datei ist ungültig: length_unit_to_meter ist „<value>“.` |
| `damaged` | XML-Datei mit fehlerhaftem Tag, nicht geschlossenem Kommentar, CDATA-Abschnitt (character data, unausgewertete Zeichendaten) oder nicht geschlossener Deklaration, einem End-Tag ohne oder mit falschem Start-Tag einem am Ende offenen Element oder Inhalt nach dem Wurzelelement außer Leerraum, Kommentaren und Deklarationen | `Die XML-Datei ist in Zeile 12 beschädigt: Ein Tag ist fehlerhaft.` `Die XML-Datei ist in Zeile 12 beschädigt: </Chord> schließt nicht <y_position>.` `Die XML-Datei ist abgeschnitten: Das Element <Sections> ist nicht geschlossen.` Die anderen 3 Texte benennen dieselben Arten von Schäden. |
| `too-large` | eine Grenze der Leser ist überschritten | Abschnitt „Grenzen“ |
| – | andere XFLR5-Dateien, z. B. `.xwimp`-Flügeltextdateien | nicht erkannt. **Öffnen** liest die Datei als Projekt-JSON und lehnt sie ab: `Ungültiges JSON in Zeile <n>, Spalte <m>.` oder `Ungültiges JSON.` |

`<part>` in der Meldung `damaged` eines `.xfl`-Projekts ist einer von: in der Liste der Flugzeuge, in einem Flugzeug, in einem Flügel, in einem Flügelschnitt, im Rumpf eines Flugzeugs, in der Liste der Analysen, in einer Analyse, in der Liste der Analyseergebnisse, in einem Analyseergebnis, in der Liste der Profile, in einem Profil, im Projektkopf. Ein Schaden in den Analysen, den Analyseergebnissen oder den Profilen, die auf die Flugzeuge folgen, lehnt die Datei nicht ab: Die Flugzeuge werden angeboten, kein Profil wird gelesen, und der Bericht enthält die Warnung `Die Profile konnten nicht gelesen werden. <damage message> Profile auswählen oder hochladen.`

### Wahl des Lesers durch Öffnen

| Eigenschaft | Regel |
| --- | --- |
| Filter der Dateiauswahl | `.json` `.xfl` `.xml` `.wpa` `.fl5` `application/json`; `.wpa`-Dateien stehen darin, damit **Öffnen** den Grund der Abweisung nennen kann. Ob die Dateiauswahlen von Android und iOS `.xfl`- und `.fl5`-Dateien mit diesem Filter anzeigen, ist unbekannt; nicht getestet. |
| Dateiendung | wird in Kleinbuchstaben verglichen: `.XFL` gilt als `.xfl` |
| Endung `.xfl`, `.wpa`, `.fl5` | Die ersten 4 Byte entscheiden: Eine Zahl von 500000 bis 509999, Big-Endian gelesen, geht an den flow5-Projektleser (Abschnitt „flow5-Import“); jede andere an den `.xfl`-Projektleser, der `.wpa`-Dateien erkennt und mit eigener Meldung ablehnt (Abschnitt „Abgelehnte Dateien“). |
| Endung `.xml` | XML-Leser: Das Wurzelelement `explane` geht an den XFLR5-Leser, `xflplane`, `xflwing`, `xflfuse`, `xflboat` und `xflsail` (in beliebiger Groß- und Kleinschreibung) an den flow5-Leser |
| Endung `.json` | Projekt-JSON (Abschnitt „Projekt-JSON“) |
| Andere Endung oder keine | Die ersten 4 Byte entscheiden: eine ganze Zahl 200001 oder 200002, Big-Endian gelesen (`.xfl`), 500000 bis 509999 (flow5) oder, Little-Endian gelesen, 100000 bis 100100 (`.wpa`): der `.xfl`-Projektleser. Eine Datei, die mit einer UTF-16-Bytereihenfolgemarke (`FF FE` oder `FE FF`) beginnt, geht an den XML-Leser. Sonst wird die Datei als Text gelesen: Text, der nach Leerraum mit `<?xml`, `<!`, `<explane`, `<xflplane` oder `<xflwing` (in beliebiger Groß- und Kleinschreibung) beginnt, geht an den XML-Leser; jeder andere Text wird als Projekt-JSON gelesen. |
| Größe | `.xfl`: höchstens 2000 MB (2 000 000 000 Byte). Jede andere Datei: höchstens 100 MB (100 000 000 Byte), wie beim Projekt-JSON; größer: `<file> kann nicht geöffnet werden: <size> MB; Projektdateien sind auf 100 MB begrenzt.` |
| Lesen einer `.xfl` | Durch Fenster von 4 194 304 Byte der Datei (`Blob.slice`); eine Datei, die größer als ein Fenster ist, liegt nie ganz im Speicher. Echte Projekte mit Analyseergebnissen erreichen 96,7 MB (gemessen). Die Analysen und ihre Ergebnisse werden übersprungen, ohne sie zu dekodieren; gelesen werden nur die Flugzeuge und die Profile. |
| Zeichenkodierung von XML | UTF-16 (16-Bit Unicode Transformation Format) nach einer Byte-Order-Mark; sonst UTF-8 mit oder ohne BOM; eine Datei, die kein gültiges UTF-8 ist, wird als Windows-1252 gelesen. |
| Profil-Upload | Eine Datei, die ein `.xfl`-Projekt ist (erste Zahl 200001 oder 200002, bei jeder Größe; über 20 000 000 Byte werden dafür nur die ersten 4 Byte gelesen) oder deren Text `<explane` gefolgt von Leerraum, `>` oder `/` enthält, wird nicht als Profil gelesen: `<file> ist eine XFLR5-Datei, kein Profil. Mit „Öffnen“ lässt sich daraus ein Flügel importieren.` Das gilt für **Profile** (Airfoils) > **Hochladen** (Upload) mit **Dateien wählen** (Choose files) oder der Ablagefläche und für **.dat hochladen** (Upload .dat) im Importdialog. Jede andere Datei über 20 000 000 Byte, auch eine XML-Datei, erhält dort die Größenmeldung des Hochladens (`<file>: <size> MB; Profildateien sind auf 5.000.000 Zeichen begrenzt.`). **Eingefügten Text prüfen** (Check pasted text) prüft nicht darauf. |

### Einlesen der Datei

| Eigenschaft | Regel |
| --- | --- |
| Längeneinheit | `.xfl`: Meter. XML: `<Units><length_unit_to_meter>`, die Einheit, die XFLR5 anzeigt, in Metern je Einheit: mm (Millimeter) 0,001, cm (Zentimeter) 0,01, dm (Dezimeter) 0,1, m (Meter) 1, in (Zoll) 0,0254, ft (Fuß) 0,3048. Ohne `<Units>`: Meter. `<Units>` gilt nur für das, was darauf folgt, wie in XFLR5, das es immer zuerst schreibt. Jeder andere Wert von 1e-6 bis 1000 wird unverändert verwendet (Info `Längen aus einer Dateieinheit von <factor> mm in mm umgerechnet.`). |
| Winkel | in beiden Formaten Grad |
| Umrechnung | k = 1000 für `.xfl`; k = 1000 · `length_unit_to_meter` für XML. Längen in mm sind das k-Fache der Dateiwerte. Info bei einer anderen Einheit als mm: `Längen in mm umgerechnet (Längeneinheit der Datei: Zoll).` |
| Genauigkeit von XML-Dateien | XFLR5 schreibt `y_position`, `Chord` und `xOffset` mit 3 Nachkommastellen in der Dateieinheit, `Dihedral`, `Twist` und `Tilt_angle` mit 3 Nachkommastellen in Grad und `Position` mit 5 signifikanten Stellen. Die Schrittweite der Längen in mm: mm 0,001, cm 0,01, dm 0,1, m 1, in 0,0254, ft 0,3048. Eine Datei in Metern, der Vorgabe von XFLR5, rundet auf 1 mm: Info `XFLR5 rundet Längen in XML-Dateien in Metern auf 1 mm; die .xfl-Projektdatei behält die volle Genauigkeit.` Ein `.xfl`-Projekt behält 64-Bit-Zahlen. Gemessen an 32 Paaren desselben Flugzeugs oder Flügels, aus einem `.xfl`-Projekt und aus XML gelesen: Die Schnitte stimmen innerhalb dieser Schrittweiten überein. |
| XML-Zahlen | Eine Dezimalzahl: optionales Vorzeichen, Dezimalpunkt (kein Komma), optionaler Exponent (`1.2346e+05`), Leerraum davor und danach; ganze Zahlen wie `650` zählen. XFLR5 liest leeren oder nichtnumerischen Text als 0. Der Import behält den Wert als fehlend: Warnung `Flugzeug „<plane>“, Flügel „<wing>“, Schnitt <n>: Chord „<text>“ ist keine Zahl.`, dann endet die Abbildung mit einem Fehler bei diesem Schnitt. Ein fehlendes `y_position` oder `Chord` zählt ebenso. Ein fehlendes `xOffset`, `Dihedral` oder `Twist` ist 0, wie in XFLR5. |
| XML-Text | Elementnamen werden ohne Beachtung der Groß- und Kleinschreibung verglichen; unbekannte Elemente werden übersprungen. Die Schreibweise `Symetric` (ein m) stammt von XFLR5. Die 5 XML-Entitäten und numerische Zeichenverweise werden dekodiert. XML-Deklaration, DOCTYPE, Kommentare, CDATA-Abschnitte und eine Byte-Order-Mark werden akzeptiert. |
| Position | `x, y, z` in der Dateieinheit. XML mit weniger als 3 Werten: 0, 0, 0 und eine Warnung, wie in XFLR5. `.xfl`: Eine Positionskomponente oder ein Einstellwinkel, der keine Zahl ist, dem Betrag nach unter 1e-6 oder über 1000 liegt, wird 0, wie beim Laden der Datei in XFLR5. |
| Profile der linken Seite | nicht verwendet. Die Geometrie des XFLR5-Flügels ist gespiegelt; die Profile der rechten Seite bauen den Halbflügel (+y). |
| Reservierte Blöcke (`.xfl`) | Jeder Flügel- und Flugzeugdatensatz endet mit einem Block aus 20 Ganzzahlen und 50 Zahlen. XFLR5 6.11 und neuer schreibt Nullen; ein Flügel schreibt zuerst 0 oder 1 und zuletzt seinen Typ (0 bis 4). XFLR5 6.10.01 bis 6.10.04 schreibt stattdessen den Index: 0 bis 19 und 0 bis 49. Jeder andere Inhalt beendet das Lesen mit `damaged` bei diesem Datensatz: Datensätze haben keine Endmarke, andere Werte zeigen also ein Lesen, das seine Stelle verloren hat. |
| Profile der `.xfl` | die Grundkoordinaten (ohne Ausschlag). Namen werden genau verglichen, mit Groß- und Kleinschreibung und Leerzeichen (`E205  (10.48%)`). Ein späteres Profil desselben Namens ersetzt das frühere. Ein leerer Name findet kein Profil. |

### Flügel und Flächen

XFLR5 hat 4 Flügelplätze je Flugzeug.

| Platz | Flügel | In `.xfl` | In XML | Angeboten |
| --- | --- | --- | --- | --- |
| 0 | Tragfläche | immer | `<Type>MAINWING</Type>` | ja |
| 1 | zweiter Flügel (Doppeldecker) | wenn das Flugzeug die Markierung `biplane` hat | `SECONDWING` | nein |
| 2 | Elevator (Höhenleitwerk) | wenn das Flugzeug die Markierung `stab` hat | `ELEVATOR` | ja |
| 3 | Seitenleitwerk | wenn das Flugzeug die Markierung `fin` hat | `FIN` | nein |

- Ein `.xfl`-Projekt speichert alle 4 Plätze. Unbenutzte Plätze enthalten Standardflügel, etwa einen „Elevator“ mit 2 Schnitten; die Markierungen entscheiden, welcher Platz existiert.
- Eine XML-Datei führt nur die Flügel auf, die existieren.
- XML-Flügel ohne bekanntes `<Type>` (Dateien von XFLR5 6.11 schreiben keines): Der Flügel ist ein Seitenleitwerk, wenn `<isFin>` den Wert `true` hat. Sonst ist der als zweiter gelesene `<wing>` der Elevator und jeder andere `<wing>` die Tragfläche. XFLR5 zählt alle `<wing>`-Elemente, Seitenleitwerke eingeschlossen. Je Flugzeug werden höchstens 4 Flügel gelesen; mehr: Warnung `Das Flugzeug „<plane>“ hat mehr als 4 Flügel; XFLR5 liest die ersten 4, dieser Import ebenso.`
- Ein späterer Flügel für einen belegten Platz ersetzt den früheren, wie in XFLR5: Warnung `Das Flugzeug „<plane>“ hat mehr als eine Tragfläche: „<name>“ ersetzt wie in XFLR5 „<previous>“.`
- XML-Flügeldatei (ein `<wing>` auf oberster Ebene, kein `<Plane>`): Das `<Type>` bestimmt die Fläche. `ELEVATOR`: Höhenleitwerk. `FIN` oder `<isFin>true</isFin>`: abgelehnt. Jeder andere Typ: Tragfläche. Position und Einstellwinkel sind 0. Mehrere Flügel auf oberster Ebene: Nur der letzte wird gelesen, mit einer Warnung. Flügel auf oberster Ebene in einer Flugzeugdatei werden mit einer Warnung ignoriert.
- Mehrere Flugzeuge: Der Dialog zeigt die Auswahlliste **Flugzeug** (Plane) nur bei mehr als einem Flugzeug. Das erste Flugzeug ist vorgewählt. Ein Flugzeug ohne Namen steht als `Flugzeug <n>` in der Liste.
- Der Dialog bietet **Tragfläche** (Main wing) und **Höhenleitwerk (XFLR5: Elevator)** (Horizontal stabilizer (XFLR5: Elevator)) unter **Zu importierende Fläche** (Surface to import). Jede Option zeigt `„<wing name>“: <n> Schnitte, Spannweite <span> mm, Wurzeltiefe <chord> mm`. Die Spannweite ist das Doppelte des y des letzten Schnitts (Y_(n−1) aus Schritt 1 im Abschnitt „Abbildung auf Schnitte“), beide Hälften. Eine Option, die das Flugzeug nicht hat, ist mit ihrem Grund abgeschaltet: `Dieses Flugzeug hat keine Tragfläche.`, `Dieses Flugzeug hat kein Höhenleitwerk.`, `Der Flügel in dieser Datei ist ein Höhenleitwerk (Typ ELEVATOR).` oder `Der Flügel in dieser Datei ist kein Höhenleitwerk (Typ ELEVATOR).`
- Der zweite Flügel, das Seitenleitwerk und die andere Fläche werden nicht importiert; der Bericht sagt es (Abschnitt „Bericht“). Es wird jeweils eine Fläche importiert; wird die Datei erneut geöffnet, steht die andere zur Wahl.

### Abbildung auf Schnitte

Schreibweise, für die Schnitte i = 0 … n−1 von der Wurzel zum Rand: y_i, c_i, h_i, δ_i und τ_i sind die Dateiwerte `y_position`, `Chord`, `xOffset`, `Dihedral` und `Twist`; k ist der Faktor aus dem Abschnitt „Einlesen der Datei“.

| XFLR5-Wert | Bedeutung |
| --- | --- |
| `y_position` | Spannweitenposition, entlang der Felder gemessen (abgewickelte Spannweite), nicht projiziert. Die Wurzel kann bei y > 0 liegen (Lücke in der Mitte). |
| `xOffset` | x der Profilnase des ungeschränkten Schnitts, positiv zur Endleiste |
| `Dihedral` von Schnitt i | absoluter Winkel des Feldes außerhalb von Schnitt i, von Schnitt i bis i + 1; nicht kumulativ. Der Wert des letzten Schnitts gehört zu keinem Feld und wird nicht verwendet. |
| `Twist` | Drehung des Schnitts um seinen Viertelpunkt der Profiltiefe; positiv = Profilnase oben; absolut je Schnitt |
| Einstellwinkel (Tilt angle) | Anstellung des Flügels im Flugzeug: Drehung des ganzen Flügels um die y-Achse durch den Ursprung des Flügels; positiv = Nase oben. Wingdesigner speichert ihn als **Einstellwinkel des Teils** (`settings.partTilt`). |
| Position | x, y, z des Flügelursprungs im Flugzeug. y wird wie in XFLR5 nicht verwendet (XFLR5 nutzt es nur bei doppelten Seitenleitwerken). |

Die Reihenfolge der Schritte: Felder, Bereinigung, Einstellwinkel und Position (die Position verschiebt die Schnitte, der Einstellwinkel wird gespeichert), Profillage, Runden, Schnittebenen.

**1. Felder.** Die V-Form des Feldes außerhalb eines Schnitts gibt seine Richtung vor:

```
Y_0 = k·y_0                                 Z_0 = 0
L_i = k·(y_i − y_(i−1))                     i ≥ 1
Y_i = Y_(i−1) + L_i·cos δ_(i−1)
Z_i = Z_(i−1) + L_i·sin δ_(i−1)
Schnitt i:  x = k·h_i   y = Y_i   z = Z_i   Profiltiefe = k·c_i   Schränkung = τ_i
```

- Ein Feld, das kürzer als 0,1 mm ist (die kleinste Feldgröße von XFLR5), hat keine Länge.
- Das Projekt erhält **Drehpunkt der Schränkung (Anteil der Profiltiefe)** (Twist pivot (fraction of chord)) 0,25 unter **Einstellungen** (Settings). XFLR5 schränkt um den Viertelpunkt der Profiltiefe, sodass `Twist` keine Umrechnung braucht.
- Eine Wurzel innerhalb von 0,1 mm um y = 0 wird auf 0 gesetzt, da XFLR5 die Hälften dort verbindet (Info `Die y_position <y> mm der Wurzel liegt weniger als 0,1 mm von der Mitte entfernt und wird auf 0 gesetzt, da XFLR5 die Hälften dort verbindet.`, nur wenn sich der Wert auf 4 Nachkommastellen von 0 unterscheidet).

**2. Bereinigung.** Schnittnummern in Meldungen sind die von XFLR5, ab 1 an der Wurzel gezählt.

| Fall | Regel |
| --- | --- |
| weniger als 2 Schnitte | Fehler `Der Flügel braucht mindestens 2 Schnitte (gefunden: <n>).` |
| ein Wert, der keine endliche Zahl ist: `y_position`, `Chord`, `xOffset`, `Twist`, `Dihedral` (nicht der des letzten Schnitts) | Fehler `Für <sections> ist <field> in der Datei keine endliche Zahl.` |
| Position x oder z oder Einstellwinkel keine endliche Zahl (nur XML-Dateien; eine `.xfl`-Datei setzt einen solchen Wert auf 0, Abschnitt „Einlesen der Datei“) | Fehler `Die Position des Flügels im Flugzeug ist in der Datei keine endliche Zahl.` oder `Der Einstellwinkel des Flügels ist in der Datei keine endliche Zahl.` |
| Wurzel bei y_position −0,1 mm oder weniger | Fehler `Der Wurzelschnitt liegt bei y_position <y> mm; der Halbflügel muss bei y >= 0 beginnen.` |
| y_position nimmt um 0,1 mm oder mehr ab | Fehler `Für <sections> ist y_position kleiner als beim Schnitt davor; die Schnitte müssen von der Wurzel zum Rand laufen.` |
| Profiltiefe 0 oder weniger | Fehler `Für <sections> muss die Profiltiefe größer als 0 sein.` |
| Profiltiefe über 0 und unter 1 mm (`LIMITS.minChord`) | auf 1 mm angehoben: Warnung `Für <sections> wurden Profiltiefen unter 1 mm auf 1 mm erhöht, die kleinste Profiltiefe, die Wingdesigner baut.` |
| alle Schnitte bei einem y | Fehler `Alle Schnitte des Flügels liegen bei y = <y> mm: Der Flügel hat keine Spannweite.` |
| ein Feld, dessen äußeres Ende nicht mindestens 0,001 mm weiter außen in y liegt als sein inneres Ende (V-Form nahe 90° oder mehr) | Fehler `Das Feld von Schnitt <a> bis <b> hat <angle>° V-Form: Sein äußeres Ende muss in y weiter außen liegen als sein inneres Ende.` |
| V-Form über 10° oder unter −10° | beibehalten. Mit Schnittebenen **Senkrecht** (Schritt 6): Warnung `Das Feld von Schnitt <a> bis <b> hat <angle>° V-Form: Quer zum Feld haben die senkrechten Schnitte <pct> % der Dicke in XFLR5.` Mit Schnittebenen **Auf Gehrung** keine Warnung: Die Dicke quer zum Feld ist die von XFLR5. |
| Wurzel y_position über 0,1 mm | beibehalten; die Hälften werden wie in XFLR5 als getrennte Körper gebaut: Info `Die Wurzel liegt bei y = <y> mm: Die beiden Hälften werden wie in XFLR5 als getrennte Körper gebaut.` |
| zwei Schnitte bei einem y (ein Feld kürzer als 0,1 mm), identisch: gleiche Profiltiefe, `xOffset`, `Twist`, gleicher Name des rechten und des linken Profils | der innere Schnitt entfällt ohne Meldung |
| zwei oder mehr Schnitte bei einem y, nicht identisch (so wechselt XFLR5 das Profil abrupt) | die inneren Schnitte rücken entlang des inneren Feldes um d = min(0,5 mm, ¼ der Länge des inneren Feldes) nach innen: Warnung `Die Schnitte <a> und <b> liegen beide bei y = <y> mm; Schnitt <a> wurde um <d> mm nach innen verschoben.` In einer Folge von m + 1 Schnitten bei einem y bleibt der äußerste stehen, die anderen rücken um d, d·(m−1)/m … d/m. Eine Folge an der Wurzel hat kein inneres Feld: Der innerste bleibt, die anderen rücken entlang des äußeren Feldes um d/m … d nach außen, mit d = min(0,5 mm, ¼ der Länge des äußeren Feldes): `… Schnitt <b> wurde um <d> mm nach außen verschoben.` Das Projekt braucht streng steigendes y. Die verschobenen Schnitte liegen in y weniger als 1 mm auseinander: Mit Schnittebenen **Auf Gehrung** teilen sie sich eine Ebene, die winkelhalbierende Ebene der Felder um die Folge herum, wie in XFLR5 ([[Geometrie]], Abschnitt 3.8, kurze Felder). |
| Name des linken Profils weicht vom rechten ab | das rechte wird verwendet: Warnung `Für <sections> unterscheiden sich linkes und rechtes Profil; die Profile der rechten Seite werden verwendet.` |
| eine Position außerhalb von ±1 000 000 mm (nach der Position aus Schritt 3), eine Profiltiefe über 100 000 mm, eine Schränkung außerhalb von ±360° | Fehler mit Nennung des Schnitts, z. B. `Schnitt <n>: Die Position liegt außerhalb von ±1.000.000 mm, der Grenze von Wingdesigner.` oder `Schnitt <n>: Die Schränkung <angle>° liegt außerhalb von ±360°, der Grenze von Wingdesigner.` |

`<sections>` lautet `Schnitt 3` oder `Schnitte 1–3, 5`; nach 10 Bereichen endet die Liste mit `…`. Eine Berichtszeile, die je einen Schnitt oder ein Feld nennt, erscheint für die ersten 5; die übrigen werden gezählt: `Weitere auseinandergeschobene Schnitte: <count>.`

**3. Einstellwinkel und Position.** Das Teil wird gebaut, wo es im XFLR5-Flugzeug sitzt. θ ist der Einstellwinkel in Grad, LE_x und LE_z sind die Positionskomponenten in der Dateieinheit. Die Position verschiebt die Schnitte; der Einstellwinkel bleibt aus den Schnittwerten heraus und dreht das gebaute Teil:

```
x' = x + k·LE_x            z' = z + k·LE_z
y, Profiltiefe, Schränkung unverändert    LE_y nicht verwendet
settings.partTilt  = θ, um ganze Umdrehungen auf −180 … 180° reduziert
settings.partRoll  = 0
settings.partPivot = { x: k·LE_x, y: 0, z: k·LE_z }      der Ursprung des Flügels
```

- Die Schnitte liegen im Koordinatensystem des Teils. Der Aufbau dreht das Teil mit seinen Schnittebenen um θ um die y-Achse durch den Ursprung des Flügels, Nase oben bei θ > 0, wie XFLR5 den Flügel dreht ([[Geometrie]], Abschnitt 3.9). Ein Teil mit Einstellwinkel wird daher mit Schnittebenen **Auf Gehrung** importiert wie eines ohne (Schritt 6).
- Ein Einstellwinkel von 400° speichert 40°; −540° speichert −180°. Ein Einstellwinkel aus ganzen Umdrehungen speichert keinen: `partTilt` 0, `partRoll` 0, `partPivot` `null`. Die Werte werden auf 4 Nachkommastellen gerundet.
- Info `Einstellwinkel -1,5° wie im XFLR5-Flugzeug angewendet: Das Teil dreht sich als starrer Körper um den Ursprung des Flügels (Einstellungen > Einstellwinkel des Teils).` Sie nennt den gespeicherten Winkel.
- Info `Position im XFLR5-Flugzeug angewendet: Der Ursprung des Flügels wurde nach x 650 mm, z 40 mm verschoben.` Eine Position y ungleich 0: Info `Die Position y <y> mm wird wie in XFLR5 nicht verwendet.`
- Liegt die mittlere Schränkung außerhalb von ±180°, werden ganze Umdrehungen, die allen Schnitten gemeinsam sind, herausgenommen: Info `Alle Schränkungen wurden um -360° geändert, ganze Umdrehungen; die Schnitte bleiben gleich.` Der Einstellwinkel ist nicht Teil der Schränkungen.
- Eine XML-Flügeldatei enthält weder Position noch Einstellwinkel: Info `Eine Flügeldatei enthält weder Position noch Einstellwinkel: Das Teil wird in seinem eigenen Koordinatensystem gebaut.`

**4. Profillage.** XFLR5 zeichnet die gespeicherten Koordinaten eines Profils, wie sie sind: Die x-Achse der Datei liegt auf der Profilsehne des Schnitts, und ein Punkt (x, y) sitzt an der Profilnase des Schnitts plus Profiltiefe · (x, y), vor der Schränkung um den Viertelpunkt. Wingdesigner setzt die Profilnase des Profils auf den Schnittpunkt und skaliert das Profil auf die Profiltiefe 1. Der Import verschiebt und skaliert deshalb jeden Schnitt um die Lage des Profils, das er verwendet (Profillage; im Code `frame`).

| Verwendetes Profil | Profillage |
| --- | --- |
| ein Profil des `.xfl`-Projekts | an seinen Koordinaten gemessen |
| eine hochgeladene `.dat`-Datei (XFLR5 liest eine `.dat`-Datei, wie sie ist; die Datei ist die, die XFLR5 verwendet hat) | an ihren Koordinaten gemessen |
| ein Profil des NACA-Generators | an den erzeugten Koordinaten gemessen. XFLR5 zeichnet den Nasenpunkt (0, 0) seiner eigenen NACA-Profile auf den Schnittpunkt. Der Generator addiert die Dicke quer zur Skelettlinie, sodass die Profilnase (der Punkt kleinsten x) eines gewölbten Schnitts oberhalb und etwas vor dem Nasenpunkt liegt: bei den gewölbten Vorlagen 0,11 % der Profiltiefe (NACA 2410) bis 0,68 % (NACA 23015), 0,16 % bei NACA 2412. Die Profillage setzt den Nasenpunkt dorthin, wo XFLR5 ihn zeichnet. Symmetrische Schnitte haben keine Profillage. NACA 2408 (l_y = 0,07 %, innerhalb von `FRAME_TOLERANCE`) erhält seine Profillage ohne Berichtszeile. Die Form eines gewölbten Schnitts weicht trotzdem vom eigenen NACA-Profil von XFLR5 ab, das die Dicke senkrecht addiert: bei 250 mm Profiltiefe um 0,28 mm (NACA 2412, 0,11 % der Profiltiefe) bis 1,41 mm (NACA 23018, 0,56 %), nahe 1 bis 3 % der Profiltiefe; der Bericht nennt das nicht. |
| ein Profil des aktuellen Projekts, das aus den NACA-Gleichungen erzeugt ist (`source.kind` `naca`: Profile aus **Profile** > **NACA-Generator** (NACA generator), NACA-Vorlagen der **Bibliothek** (Library), Profile des Assistenten und des Beispielflügels), dessen Punkte der erzeugte Schnitt seiner NACA-Bezeichnung sind (`source.code` oder der Name), wie erzeugt oder wie geprüft | die Profillage des erzeugten Schnitts seiner NACA-Bezeichnung, wie beim Generator: Liegt ein solches Profil unter dem Namen im Projekt, ergibt die Datei denselben Flügel wie ohne geöffnetes Projekt. Außerhalb von `FRAME_LIMIT` wird es ohne Profillage verwendet, mit der Warnung eines Uploads. |
| ein anderes Profil des aktuellen Projekts (auch NACA-Angaben mit anderen Punkten, etwa in einer von Hand bearbeiteten Projektdatei), ein Profil der mitgelieferten Bibliothek | keine: Die XFLR5-Koordinaten des Namens sind nicht bekannt. Der Bericht nennt ein Bibliotheksprofil, das in seinen eigenen Koordinaten weit neben (0, 0) liegt, und ein Profil des aktuellen Projekts aus einem XFLR5-Import oder einem Upload (Abschnitt „Bericht“). |

- Die Profillage gehört zum verwendeten Profil, nicht zum XFLR5-Namen. Ein Bibliotheksprofil, das für einen Namen der `.xfl` gewählt wird, behält die Werte der Schritte 1 bis 3. Das Clark Y der Datei, für einen anderen Namen gewählt, verschiebt die Schnitte dieses Namens.
- An den Koordinaten nach der Bereinigung durch den Profilparser gemessen (doppelte Punkte, Schlusspunkt, Prozent der Profiltiefe, Punktreihenfolge), vor der Normierung, in Bruchteilen der Profiltiefe: (l_x, l_y) ist die Profilnase (der Punkt kleinsten x auf der angepassten Profilkurve) und cT die Profiltiefe von l_x bis zum x der Mitte der Endleiste.
- Jede Profillage wird genau angewendet. Abweichungen bis 1e-9 der Profiltiefe (0,4 nm bei 400 mm) sind Rundungsreste der Kurvenanpassung und zählen als keine: l_x und l_y werden 0 und cT wird 1. Die Profilnase der angepassten Kurve liegt neben dem Nasenpunkt, wo das Profil vor ihn reicht: in den geprüften Profilen (Clark Y und E205 aus echten Projekten, die Bibliotheksdateien RAF 34 und S9104), deren Nasenpunkt bei (0, 0) liegt, bis zu 5,6e-4 der Profiltiefe davon entfernt; bei gewölbten NACA-Schnitten 3,4e-5 (NACA 2408) bis 1,0e-3 (NACA 23015) davor. In den Profilen von 29 echten `.xfl`-Projekten haben 32 von 64 Profileinträgen jede Abweichung zwischen 1e-5 und 1e-3 der Profiltiefe; die größte beträgt 7,6e-4 (NACA 4415 eines Projekts: Sein Nasenpunkt liegt bei (0; 0,00075), 0,30 mm bei 391 mm Profiltiefe).
- Der Bericht nennt eine Profillage, wenn eine Abweichung `FRAME_TOLERANCE` = 0,001 der Profiltiefe übersteigt (0,25 mm bei 250 mm Profiltiefe); kleinere Profillagen gelten ohne Berichtszeile (Abschnitt „Bericht“).

Für einen Schnitt nach den Schritten 1 bis 3 mit x, y, z, Profiltiefe c und Schränkung t (Grad), in einer Schnittebene der Neigung φ mit der Dickenstreckung m ([[Geometrie]], Abschnitt 3.8):

```
s  = 0.25·(1 − cT)       u = l_x − s        w = m·l_y
x' = x + c·(s + u·cos t + w·sin t)
e  = c·(−u·sin t + w·cos t)
y' = y − e·sin φ
z' = z + e·cos φ
chord' = c·cT            Schränkung unverändert
```

- φ und m sind die von XFLR5: aus den V-Formen der Datei, mit den Regeln für Gehrungsebenen aus [[Geometrie]], Abschnitt 3.8. Mit Schnittebenen **Senkrecht** (Schritt 6) gilt φ = 0 und m = 1: y bleibt.
- Die Verschiebung dreht ein Feld, dessen beide Schnitte sich verschieden verschieben: zwei Profile, oder ein Profil mit zwei Schränkungen oder Profiltiefen. Die V-Form der verschobenen Schnitte weicht dann von der der Datei ab, und der Aufbau nähme andere Neigungen und Dickenstreckungen. Mit Schnittebenen **Auf Gehrung** speichert ein Schnitt i, dessen Feld zu Schnitt i + 1 in y mindestens 1 mm breit ist, die V-Form der Datei als `panelAngle` (4 Nachkommastellen), wenn die beiden um mehr als 0,001° abweichen (`PANEL_ANGLE_TOLERANCE`). Die Registerkarte Schnitte zeigt sie in der Spalte **Feldwinkel**. Tragfläche des Rechenbeispiels: Die verschobenen Schnitte ergeben Felder mit 2,92° und 4,88°, die Datei 3° und 6°; die Schnitte speichern 3 und 6, und der Aufbau neigt die Ebenen um 0°, 4,5° und 6°, wie XFLR5.
- Mit l_x = 0 und cT = 1 verschiebt sich der Schnitt um c · m · l_y entlang der Aufwärtsrichtung seines geschränkten Profils, (sin t, cos t) in x und der Aufwärtsrichtung (0, −sin φ, cos φ) seiner Ebene.
- Jeder Profilpunkt liegt dann dort, wo eine starre Drehung des Profils um den Viertelpunkt der Profiltiefe ihn hinsetzt; das Netz von XFLR5 selbst weicht geringfügig ab (Abschnitt „Unterschiede zu XFLR5“).
- Die Tabelle in der Registerkarte **Schnitte** (Sections) weicht dann von der Flügeltabelle von XFLR5 um diese Verschiebung ab: 8,53 mm an der Wurzel des Rechenbeispiels.
- Eine Profillage mit |l_x| oder |l_y| über 0,1 oder cT außerhalb von 0,5 … 2 (`FRAME_LIMIT`) ist nicht in Einheiten der Profiltiefe (etwa eine Datei in Millimetern): XFLR5 würde das Profil viele Profiltiefen lang zeichnen. Ein Profil einer `.xfl` besteht dann die Prüfung nicht (`Die Koordinaten sind nicht in Einheiten der Profiltiefe angegeben (Profilnase bei x = <x>, y = <y>; Endleiste bei x = <te>).`), und die anderen Quellen des Abschnitts „Profile“ werden versucht. Ein Upload wird ohne Profillage verwendet, auf die Profiltiefe 1 skaliert, mit einer Warnung: `Die Koordinaten sind nicht in Einheiten der Profiltiefe angegeben (Profilnase bei x = <x>, y = <y>; Endleiste bei x = <te>): So können XFLR5 und flow5 sie nicht gezeichnet haben; das Profil wird auf die Profiltiefe 1 skaliert, und seine Schnitte behalten die Werte der Datei.`
- Der Profilparser teilt Koordinaten durch 100, wenn das größte x über 5 und höchstens 110 liegt. Eine Datei in Millimetern oder Zoll mit einer Profiltiefe von 50 bis 110 wird ebenfalls durch 100 geteilt. Eine als Prozent gelesene Datei zählt nur dann als in Einheiten der Profiltiefe, wenn cT innerhalb von 0,02 um 1 liegt; eine echte Prozentdatei endet bei x = 100.

**5. Runden.** Das Projekt hält Schnittwerte auf 4 Nachkommastellen (1e-4 mm, 1e-4 °). Das entfernt Rauschen der Einheitenumrechnung wie eine Profiltiefe von 400,04999999999995 mm. Die Schnitt-IDs lauten `s1`, `s2` … in der Reihenfolge von der Wurzel zum Rand.

**6. Schnittebenen.** XFLR5 legt seine Schnitte in Gehrungsebenen. Der Import setzt **Schnittebenen** (Section planes) so:

| Teil | **Schnittebenen** | Bericht (Info) |
| --- | --- | --- |
| die Gehrungsebenen lassen sich bauen, mit oder ohne Einstellwinkel | **Auf Gehrung** (Mitred) | `Schnittebenen: auf Gehrung wie in XFLR5. Der Wurzelschnitt steht senkrecht, ein Schnitt zwischen zwei Feldern liegt in der Winkelhalbierenden der Felder, und der Randschnitt steht rechtwinklig zum letzten Feld; die Profile behalten quer zu den Feldern ihre Dicke.` Nur wenn eine Neigung nicht 0 ist. |
| Gehrungsebenen würden die Fläche falten | **Senkrecht** (Vertical) | `Schnittebenen: senkrecht. Schnittebenen auf Gehrung wie in XFLR5 würden die Fläche zwischen den Schnitten 2 und 3 falten.` Die V-Form-Warnungen aus Schritt 2 gelten. |
| eine Gehrungsebene mehr als 60° schräg zu ihrem Feld (Dickenstreckung über 2) | **Senkrecht** | `Schnittebenen: senkrecht. Die Gehrungsebene von Schnitt 1 läge wie in XFLR5 65,0° schräg zu ihrem Feld, über der Grenze von 60°.` Die V-Form-Warnungen aus Schritt 2 gelten. |

- Die Prüfung läuft auf den Schnittwerten und den Profilen des Projekts, ohne die Fläche (`mitredPlaneProblem` in `src/geom/wing.js`): die Prüfungen auf Dickenstreckung und Faltung des Aufbaus ([[Geometrie]], Abschnitt 3.6). Sie greift daher auch dort, wo der Dialog den Flügel nicht baut (Größen über den Warnschwellen), und dort, wo der Aufbau andere Fehler hat. Schnitte, die die Profillagen aus Schritt 4 in y aneinander vorbeischieben, zählen als Faltung.
- Beispiel einer Faltung: ein Feld mit 10° und 1,5 mm zwischen Feldern mit 0° und 30°, NACA 0012 mit 150 mm Profiltiefe. Die Ebenen der Schnitte 2 und 3, um 5° und 20° geneigt, schneiden sich 5,7 mm von Schnitt 2 entfernt, innerhalb seines Profils (±9 mm).
- Zwei Schnitte bei einem y (Schritt 2) falten sich nicht: 0,5 mm auseinander, teilen sie sich eine Ebene.
- Ein Teil mit Einstellwinkel behält seinen Einstellwinkel mit beiden Werten in `settings.partTilt` (Schritt 3).
- Der Aufbau nimmt die Neigungen aus den Schnittpositionen des Projekts, nach den Profillagen aus Schritt 4, und aus den gespeicherten Feldwinkeln aus Schritt 4, den V-Formen von XFLR5. Die Tragfläche des Rechenbeispiels baut Neigungen von 0°, 4,5° und 6°, wie XFLR5. Gebaut und um 2° um den Ursprung des Flügels gedreht, liegen ihre Endleisten innerhalb von 1e-3 mm von der Konstruktion von XFLR5, dem um 2° um den Ursprung des Flügels gedrehten Gehrungsschnitt (Unit-Test, Schnitte 1 und 2; berechnet für die Schnitte 1 bis 3: 2,1e-5, 4,0e-5 und 4,5e-5 mm). Derselbe Vergleich ergibt 0 mm für das Höhenleitwerk und 6,1e-5, 3,7e-5, 2,6e-5 und 5,0e-5 mm für die Schnitte 1 bis 4 von Fixture B.

### Unterschiede zu XFLR5

Die Schritte 1 bis 3 ergeben die Schnittwerte der Flügeltabelle von XFLR5 mit angewendeter Position, im Koordinatensystem des Teils; Schritt 4 verschiebt sie dorthin, wo XFLR5 die Profile zeichnet, sodass die angepasste Kurve jedes Schnitts durch die Punkte der Datei geht, wo XFLR5 sie hinsetzt. Mit **Gerade Felder** (Straight panels) und Schnittebenen **Auf Gehrung**, die der Import setzt, außer wenn Gehrungsebenen die Fläche falten oder ein Profil mehr als auf das 2-Fache strecken würden, verbindet der gebaute Flügel die Schnitte wie XFLR5, in den Ebenen von XFLR5, und der **Einstellwinkel des Teils** dreht ihn um den Ursprung des Flügels, wie XFLR5 den Flügel dreht (Abschnitt „Ergebnis des Imports“). Er weicht in den folgenden Punkten von der eigenen Fläche von XFLR5 ab.

Gemessen an den STL-Dateien, die der Code von XFLR5 6.62 über einen lokalen Treiber geschrieben hat (100 × 10 Felder je Fläche), für 93 Flächen aus 15 echten Projekten, als größter Abstand eines XFLR5-Eckpunkts von der gebauten Fläche: höchstens 0,1 mm bei 35 Flächen, 0,3 mm bei 69 und 0,6 mm bei 80. Die übrigen 13 sind 4 V-Leitwerke mit Einstellwinkel (2,87 mm), 8 Flügel mit einer 0,5°-Klappe (2,43 und 2,65 mm) und 1 Flügel mit einem Clark YS aus 33 Punkten (0,88 mm). Der Vergleich lief mit dem Import des Projektformats Version 2, der den Einstellwinkel eines Teils mit Einstellwinkel in Schnitte **Senkrecht** eingerechnet hat; die Zeilen zu Teilen mit Einstellwinkel auf dieser Seite sind mit dieser Konstruktion gemessen. Der Import mit Ebenen **Auf Gehrung** und dem starren Einstellwinkel ist nicht mit diesen Dateien verglichen; die Prüfung am Rechenbeispiel steht in Schritt 6.

**Woher die Abstände kommen.** Zwischen die STL von XFLR5 und den gebauten Flügel setzt der Vergleich zwei Flächen, gebaut mit einer Kopie der Bauweise von XFLR5 (`Surface::getSidePoint` und `getSidePoints` von XFLR5 6.62). Jeder Schritt der Kette ist ein Anteil des Abstands:

| Schritt | Von | Nach | Anteil |
| --- | --- | --- | --- |
| 1 | STL von XFLR5 | Bauweise von XFLR5 ohne Klappen | Klappen |
| 2 | Bauweise von XFLR5, gerade Strecken zwischen den Profilpunkten | dieselbe Bauweise mit den angepassten Profilkurven von Wingdesigner | Profilinterpolation |
| 3 | die Bauweise mit den angepassten Kurven | der gebaute Flügel | Aufbau: Schränkung, Schnittebenen, Stationen entlang der Profiltiefe |

An einem Eckpunkt ist der Abstand die Vektorsumme der drei Anteile, weder ihr größter noch ihre Summe. Anteile in dieselbe Richtung addieren sich (`initialAerodynamicSym.xfl`, Flugzeug 6: 0,078 + 0,317 = 0,396 mm); entgegengesetzte heben sich auf. Bei 53 der 58 Flächen ab 0,1 mm liegt der Abstand zwischen dem 0,9- und dem 1,05-Fachen des größten Anteils. Der größte Anteil ist die Profilinterpolation bei 58 Flächen, der Aufbau bei 23 (9 Scherung durch Schränkung, 9 senkrechte Schnittebenen von Teilen mit Einstellwinkel, 5 Stationen entlang der Profiltiefe) und die Klappen bei 12.

| Unterschied | Größe |
| --- | --- |
| **Profilinterpolation.** XFLR5 verbindet die Profilpunkte mit geraden Strecken; Wingdesigner legt einen kubischen B-Spline durch sie. Jede Strecke liegt um ihre Pfeilhöhe κ · L² / 8 innerhalb der Kurve (κ Krümmung, L Streckenlänge, in Einheiten der Profiltiefe), am größten an der ersten oder zweiten Strecke an der Nase. Der Abstand wächst linear mit der Profiltiefe und fällt mit dem Quadrat des Punktabstands, etwa (Punkte je Seite − 1)⁻². Die Pfeilhöhe trifft den gemessenen Abstand bei den geprüften Profilen auf 7 %; an der 9 mm langen Nasenstrecke des Clark YS unten ergibt sie 39 % weniger. Wo das wahre Profil bekannt ist, ist die angepasste Kurve die nähere Form: NACA 0006 des NACA-Generators von XFLR5 bei 394 mm Profiltiefe liegt wie gebaut 0,0017 mm vom genauen Schnitt entfernt, die Strecken von XFLR5 0,048 mm; NACA 3415 eines genauen Generators bei 400 mm 0,0013 und 0,043 mm. | Größter Anteil bei 58 Flächen. Bei der größten Profiltiefe: 0,28 mm bei E591 (61 Punkte) mit 400 mm, 0,07 mm mit 100 mm; 0,32 mm beim Rascal-Profil (61 Punkte) mit 406 mm; 0,88 mm bei einem Clark YS aus 33 Punkten mit 400 mm; 0,042 mm bei NACA 0006 (123 Punkte) mit 394 mm. |
| **Scherung durch Schränkung.** XFLR5 dreht die Profilsehne eines geschränkten Schnitts und addiert die Dicke entlang der Normalen des ungeschränkten Feldes: im Bezugssystem des Schnitts (x, y) → (x + y · sin t, y · cos t). Den Einstellwinkel des Flügels wendet XFLR5 als starre Drehung an, ebenso Wingdesigner (**Einstellwinkel des Teils**); nur die Schränkung der Datei schert. Wingdesigner dreht das Profil als starre Form. | c · sin \|t\| · max(\|y\| · \|sin θ\|) über das Profil, y seine Koordinate senkrecht zur Sehne und θ die Neigung seiner Oberfläche gegen die Sehne: 0,604, 0,465, 0,426, 0,338 und 0,109 mm berechnet, 0,593, 0,457, 0,418, 0,339 und 0,106 mm gemessen (MH 112 bei 400 und 308 mm Profiltiefe und S1223 bei 308 mm mit 2°, MH 45 bei 300 mm mit −5°, AG24 bei 300 mm mit 2°). Größter Anteil bei 9 Flächen. 0,37 mm bei 2° Schränkung der Datei und 300 mm Profiltiefe (Wurzel von Fixture B, Einstellwinkel 1°). |
| **Senkrechte Schnittebenen** (der Rückfall aus Schritt 6; in der gemessenen Menge auch die Teile mit Einstellwinkel, deren Einstellwinkel der Import des Projektformats Version 2 in senkrechte Schnitte eingerechnet hat). XFLR5 baut Schnitte auf Gehrung und dreht das ganze Teil um den Einstellwinkel. XFLR5 schränkt einen Schnitt um eine Achse entlang seiner Felder: an einem V-Form-Knick um die Winkelhalbierende der beiden Felder, und es schneidet den Schnitt in der Gehrungsebene; am Rand um die Achse des äußeren Feldes, mit einer Randfläche senkrecht zu diesem Feld. Wingdesigner schränkt um die y-Achse und hält den Schnitt in einer Ebene mit konstantem y. | Die Unterseite des Randes von XFLR5 liegt c · \|y_l\| · sin δ jenseits des gebauten Randes (y_l der tiefste Punkt des Profils unter der Sehne, δ die V-Form des letzten Feldes): 100 · 0,0500 · sin 35° = 2,868 mm bei den 4 V-Leitwerken mit Einstellwinkel (2,868 mm gemessen), 200 · 0,0290 · sin 4° = 0,404 mm bei `skyhunter1800mm.xfl` (0,404 mm). Das Teil von `mini_talon.xfl` mit Einstellwinkel und 10° am äußeren Feld: 0,48 mm, am größten am V-Form-Knick. Größter Anteil bei 9 Flächen, alle mit dem eingerechneten Einstellwinkel gemessen. |
| Mit Schnittebenen **Senkrecht** ist die Dicke quer zu einem Feld mit der V-Form δ cos δ mal die von XFLR5. | 99,9 % bei 3°, 98,5 % bei 10°, 82 % bei 35° (ein V-Leitwerk, in XFLR5 als Elevator mit großer V-Form modelliert). Der Bericht warnt über 10°. Mit Schnittebenen **Auf Gehrung** liegen die 4 V-Leitwerke von `initialAerodynamicSym.xfl` mit 35° ohne Einstellwinkel innerhalb von 0,013 mm und das 40°-V-Leitwerk von `mini_talon.xfl` innerhalb von 0,025 mm (2,87 und 2,31 mm mit senkrechten Ebenen). |
| **Stationen entlang der Profiltiefe.** Der Aufbau tastet jedes Profil vor dem Aufbau der Fläche mit **Stationen je Profilseite** (Chordwise stations per surface, Vorgabe 60) neu ab; die Bauweise des Vergleichs verwendet 200. | Größter Anteil bei 5 Flächen: 0,016 bis 0,036 mm. Unter 4e-5 mm mit 200 Stationen. |
| **Klappen.** XFLR5 zeichnet eine Klappe mit Ausschlag; der Import baut die Grundform (Abschnitt „Profile“, Klappen). Hat ein Profil eines Feldes eine eingeschaltete Klappe, teilt XFLR5 außerdem die Punkte entlang der Profiltiefe an beiden Enden des Feldes am Drehpunkt des Profils des jeweiligen Endes, auch an einem Ende, dessen Klappe aus ist (`Surface::getSidePoints`, `surface.cpp` Zeilen 524 bis 538 von XFLR5 6.62). Ein Punkt bei 50 % der Profiltiefe an einem Ende verbindet sich dann mit einem Punkt bei 70 % am anderen, und das Feld von XFLR5 verläuft dazwischen schräg. Wingdesigner verbindet Punkte gleichen Anteils der Profiltiefe. | Größter Anteil bei 12 Flächen. 8 Flügel von `Wing Design and Analysis.xfl` mit einer 0,5°-Klappe (Drehpunkt bei 50 % im Wurzelprofil, 70 % gespeichert im äußeren Profil ohne Klappe): Schräglage 2,41 und 2,62 mm in der Mitte des Feldes (Profiltiefen 368 und 400 mm), Ausschlag 1,61 und 1,76 mm an der Endleiste (etwa 0,5 · c · sin 0,5°); 2,43 und 2,65 mm zusammen. 8 Flächen mit Klappen bei 0°: nur Schräglage, 0,004 bis 0,038 mm. |
| XFLR5 überspringt ein Feld, das entlang der Spannweite kürzer als 0,1 mm ist; Wingdesigner legt die beiden Schnitte eines Feldes, das in y weniger als 1 mm breit ist, in eine Ebene ([[Geometrie]], Abschnitt 3.8). Ein Feld von 0,1 bis 1 mm Länge ist in XFLR5 ein Feld, in Wingdesigner keines. | Nicht gemessen: Keine der 93 Flächen hat ein solches Feld. |

Die STL-Dateien liegen nicht im Repository. In diesem Vergleich würden ein falsches Vorzeichen von Schränkung oder Einstellwinkel, eine kumulative V-Form oder ein projiziertes y Punkte um jeweils 3 bis 20 mm verschieben.

Mit **Interpolation in Spannweitenrichtung** (Spanwise interpolation) auf **Linear** statt **Gerade Felder** biegt sich ein Feld, dessen Profiltiefe sich zusammen mit dem Profil oder der Schränkung ändert, von dem von XFLR5 weg (gemessen mit Schnittebenen **Senkrecht**): 4,17 mm am Randfeld von `UltraStick120.xfl` (NACA 0014 bei 406,4 mm bis zu einer Profiltiefe von 12,7 mm), 2,00 mm bei `UltraStick25e.xfl`, 1,60 und 1,25 mm bei zwei Flugzeugen von `initialAerodynamicSym.xfl` (Profiltiefe und Schränkung). Mit **Gerade Felder** liegen diese vier Flächen innerhalb von 0,04, 0,03, 0,39 und 0,09 mm.

Die Kennzahlen (Registerkarte **Prüfungen** (Checks), Statusleiste, die Zeile unter der Grundrissvorschau des Importdialogs) geben Spannweite und Fläche projiziert auf die x-y-Ebene an. XFLR5 gibt sie entlang der Felder an. Bei einem Flügel mit V-Form unterscheiden sie sich: Die 35°-V-Leitwerke der echten Beispiele zeigen 17,5 % weniger Spannweite und 18,1 % weniger Fläche als **Wing span** und **Area** von XFLR5, das 40°-V-Leitwerk 19,8 % und 23,4 %. Die Geometrie ist dieselbe.

### Profile

Jeder verschiedene Name eines Profils der rechten Seite der Fläche ist eine Zeile der Profiltabelle. Eine Zeile zeigt den XFLR5-Namen mit seinen Schnitten (**XFLR5-Profil**, XFLR5 airfoil), die gefundene Quelle (**Gefunden**, Found), eine Auswahlliste (**Verwendetes Profil**, Airfoil used) mit der automatischen Wahl an erster Stelle und die Schaltflächen **.dat hochladen** (Upload .dat) und **Anzeigen** (View).

**Quellen für einen Namen.** Der erste Kandidat, der die Profilprüfung besteht, gilt. Ein Kandidat, der sie nicht besteht, wird übergangen.

| Reihenfolge | Quelle | Treffer |
| --- | --- | --- |
| 0 | das Profil des `.xfl`- oder `.fl5`-Projekts (nicht in XML-Dateien) | der genaue Name; ein leerer Name findet nichts |
| 1 | eine im Dialog hochgeladene `.dat`-Datei | ihre Namenszeile, genau, dann gekürzt; dann ihr Dateiname ohne Endung, genau, dann gekürzt |
| 2 | ein Profil des aktuellen Projekts | sein Name, genau, dann gekürzt (die ID, wenn der Name leer ist) |
| 3 | ein Profil der mitgelieferten Bibliothek (Clark Y, NACA 8-H-12, NACA M-6, RAF 34, S9104, USA 35B) | sein Name, genau, dann gekürzt |
| 4 | der NACA-Generator | der Name ist eine Bezeichnung der 4-stelligen oder 5-stelligen Reihe: `NACA 2412`, `naca2412`, `NACA-2412`, `2412`. `NACA0014_Flap` und `NACA 0010 Airfoil` sind keine; die Auswahlliste bietet die Bezeichnung an, mit der ein solcher Name beginnt, sie wird aber nicht automatisch gewählt. |
| 5 | ein ähnlicher Name | ohne Beachtung von Groß- und Kleinschreibung, Leerzeichen, `-` und `_`, unter den Uploads (Namenszeile und Dateiname), dem aktuellen Projekt und der Bibliothek. Vorgewählt, mit einer Warnung. |

- Die Profilprüfung ist die der Registerkarte **Profile** (Airfoils) (Bereinigung durch den Parser, Plausibilitätsprüfungen). Zusätzlich darf die angepasste Profilkurve sich nicht selbst kreuzen und nicht in x zurücklaufen (`curve-shape`, **Parametrisierung der Profile** (Profile parametrization) zentripetal).
- Warnungen der Prüfung erscheinen einmal je verwendetem Profil, mit seinen Schnitten: `Profil „Clark Y“ (Schnitte 1–2): <message>`. Der Upload wird mit seinem Dateinamen genannt, wie die Auswahlliste ihn zeigt: `Profil „TEST 12 (test12.dat)“ (Schnitt 2): …`. Eine geneigte Profilsehne (`rotated`) ist eine Info, weil XFLR5 dieselben Koordinaten zeichnet: `Profil „Clark Y“ (Schnitte 1–2): Die Linie von der Profilnase zur Endleiste ist um -1,97 Grad geneigt; die Koordinaten bleiben erhalten, daher bezieht sich die Schränkung auf die x-Achse der Datei.` Ein Bibliotheksprofil erhält stattdessen eine Warnung (Abschnitt „Bericht“).
- **.dat-Dateien hochladen …** (Upload .dat files…) über der Tabelle nimmt mehrere Dateien auf einmal; jede Zeile findet ihre Datei nach den Regeln der Reihenfolge 1. Ein Screenreader hört `<n> Dateien hochgeladen; <m> Profilnamen verwenden sie.`
- Besteht kein Kandidat: Die Zeile zeigt **Fehlt** (Missing) in der Spalte **Gefunden** (Found), und **Importieren** bleibt abgeschaltet (`Importieren (2 Profile fehlen)`). Der Fehler nennt den ersten Kandidaten, der durchfiel, z. B. `Profil „NACA 5128“ (Schnitte 1–2): Das passende Profil (NACA-Generator: NACA 5128) besteht die Prüfung nicht: … Eine .dat-Datei hochladen oder ein Profil wählen.` Erzeugte Schnitte mit großer Wölbung und Dicke laufen bei 11 bis 13 % der Profiltiefe in x zurück und bestehen die Prüfung nicht, etwa NACA 5128, 5130, 6130, 8130 und 9130.
- Die Nutzerin oder der Nutzer kann jede Zeile ändern: jedes Profil der Liste (Profile der Datei, Uploads, aktuelles Projekt, Bibliothek, NACA-Vorgaben) oder **.dat hochladen** für diese Zeile. Ein gewähltes Profil ersetzt die automatische Wahl.
- Ohne Namen (ein leerer Profilname in der Datei): Fehler `XFLR5 nennt für <sections> kein Profil: eine .dat-Datei hochladen oder ein Profil wählen.`

**Klappen** (nur `.xfl`). Die Datei speichert die Grundform und die Klappenparameter eines Profils. Der Import verwendet immer die Grundform ohne Ausschlag und schneidet kein Ruder aus. Der Bericht nennt jede Klappe eines verwendeten Profils, das aus der Datei stammt:

| Klappe in der Datei | Schwere | Meldung |
| --- | --- | --- |
| Klappe an der Endleiste bei 0° | Info | `Profil „<name>“ hat in XFLR5 eine Klappe an der Endleiste bei 0° (Drehachse bei <x> % der Profiltiefe); Ruder werden nicht ausgeschnitten.` |
| Klappe an der Endleiste bei einem anderen Winkel | Warnung | `Profil „<name>“ hat in XFLR5 eine um 20° ausgeschlagene Klappe an der Endleiste (Drehachse bei 70 % der Profiltiefe); es wird ohne Ausschlag importiert.` |
| Klappe an der Nasenleiste | Info bei 0°, sonst Warnung | dieselben Texte mit „Nasenleiste“ statt „Endleiste“ |

### Bericht

Der Bericht wird nach jeder Wahl neu berechnet. Reihenfolge: Fehler, dann Warnungen, dann Infos. **Importieren** ist abgeschaltet, solange der Bericht einen Fehler enthält. Das Projekt der Abbildung wird so gebaut, wie **Öffnen** es baut: Aufbaufehler und -warnungen des Flügels erscheinen im Bericht (`Der Flügel lässt sich noch nicht bauen: <error>` als Warnung) und blockieren den Import nicht. Der Dialog zeigt höchstens 200 Berichtszeilen und 200 Profilzeilen (Zeilen ohne verwendbares Profil und gewählte Zeilen zuerst; die anderen Namen nehmen Uploads über den Namen). Der Dialog öffnet sich sofort mit abgeschaltetem **Importieren** und der Zeile `Die Profile werden geprüft …`. Die Prüfungen der ersten Abbildung laufen in Scheiben von 50 ms, sodass **Abbrechen**, Escape und Scrollen in der Zwischenzeit funktionieren. Während der Prüfungen sind Profiltabelle, Grundrissvorschau und Kennzahlenzeile leer, der Projektname auch, solange keiner eingegeben ist. Nach einem Wechsel des Flugzeugs oder der Fläche laufen die Prüfungen des neuen Flügels ebenso, und der Dialog leert dieselben Teile; enden sie innerhalb von 50 ms (schon geprüfte Profile), folgt der Bericht ohne die Fortschrittszeile, und nichts wird geleert.

**Bericht: Geometrie und Datei**

| Daten | Behandlung | Schwere | Meldung |
| --- | --- | --- | --- |
| zweiter Flügel, Seitenleitwerk, die andere Fläche | nicht importiert | Info | `Nicht importiert: das Höhenleitwerk „Elevator“, das Seitenleitwerk „Fin“. Eine Fläche je Import; für eine weitere die Datei erneut öffnen.` |
| V-Form ungleich 0 | y und z berechnet | Info | `XFLR5 misst y_position entlang der Felder; y und z wurden daraus und aus der V-Form berechnet.` |
| V-Form über 10° | beibehalten | Warnung nur mit Schnittebenen **Senkrecht** | Abschnitt „Abbildung auf Schnitte“, Schritt 2 |
| Position | auf die Schnitte angewendet | Info | Schritt 3 |
| Einstellwinkel | als **Einstellwinkel des Teils** gespeichert | Info | Schritt 3 |
| Schnittebenen | **Auf Gehrung** oder **Senkrecht** | Info | Schritt 6 |
| Lücke an der Wurzel, Wurzel innerhalb von 0,1 mm um die Mitte | beibehalten, auf 0 gesetzt | Info | Schritte 1 und 2 |
| gleiches y, Profiltiefe unter 1 mm, linkes ≠ rechtes Profil | verschoben, angehoben, rechtes verwendet | Warnung | Schritt 2 |
| andere Längeneinheit als mm | umgerechnet | Info | Abschnitt „Einlesen der Datei“ |
| XML-Datei in Metern | auf 1 mm gerundet | Info | Abschnitt „Einlesen der Datei“ |
| immer | verworfen | Info | `Nicht verwendet: VLM-Panelanzahlen und -verteilungen, Farben, Massen, der Rumpf und die Analysen.` |
| immer | Endleiste wie in den Profilen | Info | `Die Endleiste wird wie in den Profilen gebaut; Einstellungen > Endleiste kann sie schließen oder ihr eine Dicke geben.` |
| Profile der `.xfl` nicht lesbar | Flugzeuge angeboten | Warnung | `Die Profile konnten nicht gelesen werden. <damage message> Profile auswählen oder hochladen.` |
| `.xfl` mit mehr als 10 000 Profilen oder Profilen über 2 000 000 Punkten | nicht gelesen | Warnung | `Nur die ersten 10.000 der <n> Profile der Datei wurden gelesen.` `1 Profil wurde nicht gelesen: Die Profile der Datei haben zusammen mehr als 2.000.000 Punkte.` |
| XML-Datei: ein Flügel, der einen anderen ersetzt, mehr als 4 Flügel, Flügel außerhalb eines Flugzeugs, ein `<Units>` nach einem Flugzeug, ein Wert, der keine Zahl ist, eine `Position` mit weniger als 3 Werten | wie in XFLR5 | Warnung | Texte in den Abschnitten „Flügel und Flächen“ und „Einlesen der Datei“. Die Warnungen betreffen die ganze Datei, daher führt der Bericht jedes Flugzeugs sie auf; die Meldung nach dem Import lässt sie weg. |

Die verworfenen Daten: das Seitenleitwerk, der zweite Flügel, die andere Fläche, der Rumpf, Massen, Analysen und Ergebnisse, VLM-Panelanzahlen und -verteilungen (VLM: Vortex-Lattice-Verfahren, vortex lattice method), Farben, Beschreibungen, Profile der linken Seite, Klappenausschläge, die V-Form des letzten Schnitts und die Position y.

**Bericht: Profile**

| Daten | Behandlung | Schwere | Meldung |
| --- | --- | --- | --- |
| Profil, das Schnitte in l_x, l_y oder cT − 1 um mehr als `FRAME_TOLERANCE` (0,1 % der Profiltiefe) verschiebt | verschoben (und skaliert) | Info; Warnung, wenn eine Abweichung 2 % der Profiltiefe übersteigt (`FRAME_WARN` = 0,02) | `Profil „Clark Y“ (Schnitte 1–2) hat in seinen eigenen Koordinaten die Profilnase bei x = 0 %, y = 3,55 % und die Endleiste bei x = 100 % der Profiltiefe; diese Schnitte wurden so verschoben, dass das Profil wie in XFLR5 liegt.` Zahlen in % der Profiltiefe mit 2 Nachkommastellen. Bei einem Schnitt: `dieser Schnitt wurde so verschoben`. Wenn die Zahlen eine andere Profiltiefe als 100 % zeigen (Endleiste minus Profilnase): `verschoben und skaliert`; die 0,0016 % des Clark Y fallen beim Runden weg und gelten ohne Wort. Eine Profillage innerhalb von `FRAME_TOLERANCE` gilt ohne Zeile. Wo die Profillage gilt, entfällt der Hinweis der Prüfung auf das Skalieren auf die Profiltiefe 1. |
| Bibliotheksprofil oder ein aus der Bibliothek übernommenes Profil des aktuellen Projekts (`source.kind` `library`, dieselben Punkte), bei dem x oder y der Profilnase in den eigenen Koordinaten mehr als 2 % der Profiltiefe von 0 entfernt liegt oder die Profiltiefe mehr als 2 % von 1 abweicht; mitgeliefert: Clark Y 3,55 %, USA 35B 2,87 % | Tabellenwerte beibehalten | Info | `Das Bibliotheksprofil „Clark Y“ (Schnitte 1–2) hat in seinen eigenen Koordinaten die Profilnase bei x = 0 %, y = 3,55 % der Profiltiefe. Hat XFLR5 diese Koordinaten verwendet, zeichnet es diese Schnitte so weit von den Tabellenwerten entfernt; die .dat-Datei hochladen, die XFLR5 verwendet hat, um sie wie in XFLR5 zu setzen.` |
| Bibliotheksprofil oder ein aus der Bibliothek übernommenes Profil des aktuellen Projekts, dessen Profilsehne (von der Profilnase der angepassten Kurve zur Endleistenmitte) um mehr als 0,5° geneigt ist (`rotationDeg` der Profilprüfung); mitgeliefert: Clark Y 2,00° und USA 35B 1,57° mit der Nase nach oben | Winkel beibehalten, die Schränkung bezieht sich auf seine x-Achse | Warnung | `Das Bibliotheksprofil „Clark Y“ (Schnitte 1–2) hat in seinen eigenen Koordinaten eine Profilsehne, die 2,00° mit der Nase nach oben geneigt ist, und die gebauten Schnitte behalten diesen Winkel. Ist die Profilsehne des Profils, das XFLR5 verwendet hat, waagrecht, stehen diese Schnitte 2,00° weiter mit der Nase nach oben als in XFLR5, die Endleiste 8,4 mm tiefer bei 240 mm Profiltiefe; die .dat-Datei hochladen, die XFLR5 verwendet hat, um sie wie in XFLR5 zu setzen.` Der Abstand ist die größte Profiltiefe dieser Schnitte mal sin(Winkel). Die UIUC-Datei `clarky.dat` (Namenszeile `CLARK Y AIRFOIL`) hat eine waagrechte Profilsehne. `nach unten` und `höher` für eine Endleiste über der Profilnase. |
| Profil des aktuellen Projekts aus einem XFLR5- oder flow5-Import oder einem Upload (`source.kind` `xflr5`, `flow5` oder `upload`): auf die Profiltiefe 1 skaliert gespeichert, seine eigenen Koordinaten sind nicht gespeichert | Tabellenwerte beibehalten | Info | `Profil „Clark Y“ (Schnitte 1–2) des aktuellen Projekts ist auf die Profiltiefe 1 skaliert gespeichert, mit der Profilnase bei (0, 0); diese Schnitte behalten daher die Tabellenwerte. Legen die Koordinaten, die XFLR5 verwendet hat, die Profilnase anderswohin, zeichnet XFLR5 diese Schnitte so weit von den Tabellenwerten entfernt; die .dat-Datei hochladen, die XFLR5 verwendet hat, um sie wie in XFLR5 zu setzen.` |
| Warnungen der Profilprüfung | beibehalten | Warnung; geneigte Profilsehne: Info (Bibliotheksprofil: stattdessen die Zeile oben) | `Profil „Clark Y“ (Schnitte 1–2): <message>` |
| Klappe | Grundform | Info bei 0°, sonst Warnung | siehe „Klappen“ oben |
| Profil der Datei besteht die Prüfung nicht, eine andere Quelle besteht | die andere Quelle verwendet | Warnung | `Profil „<name>“ aus der Datei besteht die Prüfung nicht: <problem> Stattdessen wird „<match>“ verwendet.` |
| Profil der Datei besteht die Prüfung nicht, keine besteht | blockiert Importieren | Fehler | `Profil „<name>“ (Schnitte 1–2) aus der Datei besteht die Prüfung nicht: <problem> Eine .dat-Datei hochladen oder ein Profil wählen.` |
| kein Kandidat | blockiert Importieren | Fehler | `Profil „E423“ (Schnitte 1–2) fehlt: eine .dat-Datei hochladen oder ein Profil wählen.` |
| gewähltes Profil besteht die Prüfung nicht | blockiert Importieren | Fehler | `Profil „<name>“ (Schnitte 1–2): Das gewählte Profil besteht die Prüfung nicht: <problem>` |
| ähnlicher Name | vorgewählt | Warnung | `Profil „SD7037 tip“ wurde über den ähnlichen Namen „SD7037“ zugeordnet.` |
| nicht verwendbarer Upload, den keine Zeile gewählt hat (eine Abweisung vor dem Lesen nennt nur ihren Grund) | nicht verwendet | Info | `Die hochgeladene Datei <file> ist nicht verwendbar: <problem>` |
| Profile über den Grenzen eines Projekts | blockiert Importieren | Fehler | `Die Profile dieses Flügels überschreiten die Grenzen eines Projekts (10.000 Profile, 1.000.000 Punkte zusammen).` |

### Grenzen

| Grenze | Wert | Meldung oder Ergebnis |
| --- | --- | --- |
| Größe einer `.xfl`-Datei | 2000 MB | `Die Datei hat <size> MB; XFLR5-Projekte über 2.000 MB werden nicht gelesen.` (`.fl5`: `flow5-Projekte`) |
| XML und andere Dateien | 100 MB | Abschnitt „Wahl des Lesers durch Öffnen“ |
| Flugzeuge je Datei | 10 000 | `.xfl`: beschädigt (in der Liste der Flugzeuge). XML: `Die XML-Datei enthält mehr als 10.000 Flugzeuge.` |
| Schnitte je Flügel | 20 000 (`LIMITS.maxSections`) | `Ein Flügel der Datei hat <n> Schnitte; höchstens 20.000 können gelesen werden.` XML: `Ein Flügel der XML-Datei hat mehr als 20.000 Schnitte.` |
| Schnitte aller Flugzeuge einer `.xfl` | 1 000 000 | `Die Flugzeuge der Datei haben zusammen mehr als 1.000.000 Flügelschnitte; die Datei wird nicht gelesen.` |
| Punkte eines `.xfl`-Profils | 1000 (XFLR5 hält höchstens 604) | mehr: beschädigt (in einem Profil) |
| Punkte aller Profile einer `.xfl` | 2 000 000 | weitere Profile werden nicht gelesen, mit einer Warnung (Abschnitt „Bericht“) |
| aus einer `.xfl` gelesene Profile | 10 000 (`LIMITS.maxAirfoils`) | der Rest der Liste wird nicht gelesen, mit einer Warnung |
| Namen und Beschreibungen in einer `.xfl` | zusammen 64 MB; ein Text höchstens 1 048 576 Byte (524 288 Zeichen) | `Die Namen in der Datei umfassen zusammen mehr als 64 MB.`; ein längerer einzelner Text ist ein Schaden |
| XML-Elemente | 1 000 000 | `Die XML-Datei enthält mehr als 1.000.000 Elemente.` |
| XML-Schachtelung | 100 Ebenen | `Die XML-Datei schachtelt Elemente tiefer als 100 Ebenen.` |
| XML-Attribute je Element | 100 | fehlerhafter Tag |
| gelesene Flügel je Flugzeug | 4 (XFLR5 liest 4) | Warnung (Abschnitt „Flügel und Flächen“) |
| behaltene XML-Warnungen | 50; je Flügel 5 Probleme aufgeführt, dann eine Zahl | `Weitere, nicht aufgeführte Warnungen: <count>.` |
| Profile eines Imports | 10 000 Namen und 1 000 000 Punkte (`LIMITS.maxAirfoils`, `LIMITS.maxAirfoilPoints`) | Fehler (Abschnitt „Bericht“, Profile). Geprüft, bevor ein Name aufgelöst wird. Die Punkte der eigenen Profile der Datei zählen nur für Namen, denen die Nutzerin oder der Nutzer kein anderes Profil gegeben hat. |
| Schnittwerte des Projekts | Position innerhalb von ±1 000 000 mm, Profiltiefe 1 bis 100 000 mm, Schränkung innerhalb von ±360° | Abschnitt „Abbildung auf Schnitte“, Schritt 2 |
| Profilzeilen im Dialog | 200 | `<count> weitere Profilnamen sind nicht aufgeführt; hochgeladene .dat-Dateien werden ihnen über den Namen zugeordnet.` |
| Berichtszeilen im Dialog | 200 | `Weitere, nicht angezeigte Berichtszeilen: <count>.` |
| Namen in Meldungen | 200 Zeichen, dann `…` | – |

Zeit mit 10 000 Profilen zu je 99 Punkten: Die erste Abbildung, die jedes Profil prüft, dauert in Node.js 24 etwa 45 s (45,1 bis 47,2 s in 4 Läufen) und in Chromium 141 59 s (1 Lauf); der Dialog bleibt in der Zwischenzeit bedienbar (**Abbrechen** schloss ihn in 48 ms). Eine spätere Abbildung der geprüften Profile dauert 0,54 bis 0,72 s (Node.js).

### Ergebnis des Imports

| Eigenschaft | Wert |
| --- | --- |
| Projektname | `<plane name> <wing name>` oder der Flügelname einer Flügeldatei; Teile gekürzt, leere Teile weggelassen. Beide leer: „Importierter Flügel“ (englische Oberfläche: `Imported wing`). Höchstens 10 000 Zeichen. Das Feld **Projektname** (Project name) des Dialogs ändert ihn; ein geleertes Feld folgt wieder dem Flugzeug und der Fläche. |
| Schnitte | IDs `s1`, `s2` …; Werte wie im Abschnitt „Abbildung auf Schnitte“ |
| `settings` | `twistPivot` 0,25, `spanwise` `"straight"`, `sectionPlanes` `"mitred"` oder `"vertical"` (Schritt 6), `mirror` `true`, `tip.mode` `"flat"`, `trailingEdge.mode` `"asis"`. Ein Teil mit Einstellwinkel: `partTilt` θ, `partRoll` 0, `partPivot` der Ursprung des Flügels (Schritt 3). Die übrigen Schlüssel haben ihre Vorgaben. |
| `foldedTilt` | nicht geschrieben |
| `guides` | Vorgaben: aus den Schnittkanten erzeugt, ausgeschaltet |
| Profile | ein Eintrag je verwendeter Quelle. Zeilen, die dieselbe Quelle verwenden, oder Quellen mit gleichem Namen und gleichen Punkten teilen einen Eintrag. IDs folgen den Regeln des Abschnitts „Projekt-JSON“ (`clark-y`, `naca-0009`, `clark-y-2` für denselben Namen mit anderen Punkten). Die Punkte: die geprüften Punkte (Profilnase bei (0, 0), Profiltiefe 1) für ein Profil der Datei, einen Upload und ein Bibliotheksprofil; die erzeugten Punkte für einen NACA-Schnitt (Herkunft `naca`); die gespeicherten Punkte für ein Profil des aktuellen Projekts. |
| Meldung nach dem Import | `Tragfläche „Main Wing“ von „Fixture A“ aus fixtures_v662.xfl importiert: 3 Schnitte, 2 Profile.` Bei einem Höhenleitwerk: `Höhenleitwerk „Elevator“ von „Fixture A“ aus fixtures_v662.xfl importiert: 2 Schnitte, 1 Profil.` Ohne Flugzeugnamen: `Tragfläche „Main Wing“ aus wing.xml importiert: 3 Schnitte, 2 Profile.` Danach die erste Warnung und `(<n> weitere Warnungen im Importbericht.)`. Die Warnungen des XML-Lesers bleiben im Bericht. |
| Nicht gespeichert | die Position als solche (zu den Schnittwerten addiert; ein Teil mit Einstellwinkel behält den Ursprung des Flügels als `partPivot`), Klappenparameter und die übrigen verworfenen Daten. Die Herkunft bleibt im Projektnamen und, bei Profilen eines `.xfl`-Projekts, in `source.note`. |
| Rückgängig | **Rückgängig** (Undo) stellt das vorherige Projekt wieder her. Die automatische Sicherung folgt dem Import. |
| Teil mit Einstellwinkel, später auf **Senkrecht** gestellt | Die Umstellung wird nicht gesperrt. Der starre Einstellwinkel bleibt; die Schnitte liegen in Ebenen y = konst. des Teils, quer zu einem Feld mit der V-Form δ cos δ so dick wie die von XFLR5. |

**Projekte früherer Importe.** Ein Projekt des Formats Version 2 aus dem XFLR5-Import eines Teils mit Einstellwinkel enthält den Einstellwinkel in die Schnittwerte eingerechnet und speichert ihn als `foldedTilt`. **Öffnen** und die Wiederherstellung der Browserkopie machen daraus den **Einstellwinkel des Teils** (Abschnitt „Projekt-JSON“, „Aktualisierung von Dateien der Version 2“): Mit Schnittebenen **Senkrecht** bleibt das Teil dasselbe, mit **Auf Gehrung** wird es das Teil, das XFLR5 baut. Mit einer eingeschalteten oder bearbeiteten Leitkurve oder einer Schränkung, die außerhalb von ±360° läge, bleibt die Einrechnung. Ein solches Projekt zeigt, auf **Auf Gehrung** gestellt, die Warnung `Der Einstellwinkel von 3,00° des XFLR5-Imports ist in die Schnittwerte eingerechnet, was nur für senkrechte Schnittebenen genau ist: Mit Schnittebenen auf Gehrung liegt das Teil bis zu etwa 1,57 mm neben dem von XFLR5 (0,75 · Profiltiefe · sin(Einstellwinkel) · sin(Neigung)). Einstellungen > Schnittebenen „Senkrecht“ hält den Import genau.` Die Schätzung verwendet die Neigungen des Aufbaus. Ein Projekt, das der XFLR5-Import im Format Version 1 geschrieben hat (30.09.2026), und seine Kopie im Browser enthalten einen eingerechneten Einstellwinkel ohne `foldedTilt`. Es öffnet mit Schnittebenen **Senkrecht**, die ihn genau halten, und **Einstellwinkel des Teils** 0°. Auf **Auf Gehrung** gestellt, trägt es den Fehler des eingerechneten Einstellwinkels (0,45 mm beim Rechenbeispiel, etwa 1,6 mm bei einem 35°-V-Leitwerk mit 3° Einstellwinkel) ohne die Warnung oben. Ein erneuter Import der XFLR5-Datei ergibt den starren Einstellwinkel.

**Herkunft eines importierten Profils.** Ein Profil, das aus dem `.xfl`-Projekt stammt, erhält diese `source`:

| Schlüssel | Wert |
| --- | --- |
| `kind` | `"xflr5"` |
| `file` | Name der `.xfl`-Datei, höchstens 2000 Zeichen |
| `note` | `Profil „<name>“ aus dem XFLR5-Flugzeug „<plane>“; Grundform ohne Klappenausschlag.` Flugzeug ohne Namen: `Profil „<name>“ aus einem XFLR5-Projekt; Grundform ohne Klappenausschlag.` Geschrieben in der Sprache der Oberfläche zum Zeitpunkt des Imports. |
| `attribution` | nur wenn der Profilname mit `HS` und einem Leerzeichen oder `-` beginnt (`Hartmut Siegmann, www.aerodesign.de`) oder mit `MH` und einer Zahl, etwa `MH 45` (`Martin Hepperle, www.mh-aerotools.de`); der Vorschlag des Uploads |

Eine hochgeladene `.dat`, ein Bibliotheksprofil, ein NACA-Schnitt und ein Profil des aktuellen Projekts behalten ihre eigene `source` (`upload`, `library`, `naca` oder die Herkunft, die sie hatten). In der Registerkarte **Profile** zeigt die kleine Zeile eines `xflr5`-Profils die Quellenangabe oder, ohne Quellenangabe, `XFLR5: <file>`.

### Rechenbeispiel

Die Datei ist `test/fixtures/xflr5/fixtures_v662.xfl`: Projektformat 200002, vom Projektschreiber von XFLR5 6.62 gespeichert, mit den Flugzeugen „Fixture A“ und „Fixture B“ und den Profilen „Clark Y“ (33 Punkte) und „NACA 0009“ (81 Punkte). Die Längen in der Datei sind Meter, also k = 1000.

Tragfläche „Main Wing“ von „Fixture A“: Position 0, 0, 0; Einstellwinkel 2°.

| i | `y_position` (m) | `Chord` (m) | `xOffset` (m) | `Dihedral` (°) | `Twist` (°) | Profil |
| --- | --- | --- | --- | --- | --- | --- |
| 0 | 0 | 0,24 | 0 | 3 | 0 | Clark Y |
| 1 | 0,5 | 0,22 | 0,01 | 6 | −1 | Clark Y |
| 2 | 0,9 | 0,15 | 0,045 | 0 (nicht verwendet) | −2,5 | NACA 0009 |

Schritt 1, Felder:

```
L_1 = 500 mm:   Y_1 = 500·cos 3° = 499.3148      Z_1 = 500·sin 3° = 26.1680
L_2 = 400 mm:   Y_2 = 499.3148 + 400·cos 6° = 897.1235
                Z_2 = 26.1680 + 400·sin 6° = 67.9794
```

Schritt 3: Die Position ist 0, 0, 0, daher bleiben die Schnitte. Das Projekt speichert `partTilt` 2, `partRoll` 0 und `partPivot` `{ "x": 0, "y": 0, "z": 0 }`.

Schritt 4, Profillage: Das Clark Y der Datei hat seine ebene Unterseite auf der x-Achse und seinen Nasenpunkt bei (0; 0,035). Die Profilnase der angepassten Kurve liegt 3,5546 % der Profiltiefe über der Achse und 0,0016 % vor x = 0: l_x = −1,590e-5, l_y = 0,0355457, cT = 1,0000159. Damit gilt s = −3,976e-6 und u = l_x − s = −1,193e-5. Die Schnitte 1 und 2 verwenden es, in den Gehrungsebenen von XFLR5: Schnitt 1 senkrecht (φ = 0°, m = 1 / cos 3° = 1,00137), Schnitt 2 um 4,5° geneigt (m = 1 / cos 1,5° = 1,00034). Das NACA 0009 der Datei hat die Profillage eines Profils im Ursprung mit Profiltiefe 1: Schnitt 3 bleibt.

```
Schnitt 1 (c 240, t 0°, φ 0°):     x = 0 + 240·(s + u) = −0.0038
                                   e = 240·1.00137·l_y = 8.5427
                                   y = 0      z = 0 + 8.5427 = 8.5427      Profiltiefe = 240·cT = 240.0038
Schnitt 2 (c 220, t −1°, φ 4.5°):  x = 10 + 220·(s + u·cos 1° − 1.00034·l_y·sin 1°) = 10 − 0.1400 = 9.8600
                                   e = 220·(u·sin 1° + 1.00034·l_y·cos 1°) = 7.8215
                                   y = 499.3148 − 7.8215·sin 4.5° = 498.7011
                                   z = 26.1680 + 7.8215·cos 4.5° = 33.9654      Profiltiefe = 220·cT = 220.0035
```

Die Ergebnisse stammen aus den ungerundeten Werten der früheren Schritte. Schnittwerte in mm und °:

| Schnitt | Schritte 1 bis 3 | Aus der `.xfl` importiert (Schritt 4) |
| --- | --- | --- |
| s1 | x 0, y 0, z 0, Profiltiefe 240, Schränkung 0 | x −0,0038, y 0, z 8,5427, Profiltiefe 240,0038, Schränkung 0, Feldwinkel 3 |
| s2 | x 10, y 499,3148, z 26,1680, Profiltiefe 220, Schränkung −1 | x 9,86, y 498,7011, z 33,9654, Profiltiefe 220,0035, Schränkung −1, Feldwinkel 6 |
| s3 | x 45, y 897,1235, z 67,9794, Profiltiefe 150, Schränkung −2,5 | x 45, y 897,1235, z 67,9794, Profiltiefe 150, Schränkung −2,5 |

Der Bericht dieses Imports enthält eine Warnung (das Clark Y verschiebt seine Schnitte um mehr als 2 % der Profiltiefe: 3,55 %) und die Infos zur V-Form, zum Einstellwinkel, zur geneigten Profilsehne des Clark Y, zum Elevator und zum Seitenleitwerk, die nicht importiert werden, zu den verworfenen Daten, zur Endleiste und zu den Schnittebenen: **Auf Gehrung**. Die Meldung nach dem Import lautet `Tragfläche „Main Wing“ von „Fixture A“ aus fixtures_v662.xfl importiert: 3 Schnitte, 2 Profile.`, gefolgt von der Warnung zum Clark Y. Dieselbe Tragfläche ohne ihren Einstellwinkel wird mit denselben Schnitten und ohne `partTilt` importiert.

Die XML-Datei desselben Flugzeugs in Millimetern (`test/fixtures/xflr5/xml_mm/0.plane.xml`) nennt nur die Profile:

- Mit einem Projekt ohne Profil namens Clark Y (etwa dem Entwurfstyp **Sportmodell** (Sport) des Assistenten) wird `Clark Y` in der Bibliothek gefunden. Ein Bibliotheksprofil erhält keine Profillage: Die Schnitte sind die Werte der Schritte 1 bis 3. Eine Info sagt, dass das Clark Y der Bibliothek in seinen eigenen Koordinaten die Profilnase 3,55 % der Profiltiefe neben (0, 0) hat.
- Ist das Clark Y der Datei als `.dat`-Datei hochgeladen, sind die Schnitte die des `.xfl`-Imports; der Upload heißt im Bericht `Clark Y (clark-y.dat)`.
- `NACA 0009` stammt aus dem NACA-Generator.

Elevator von „Fixture A“ (Platz 2): Position x 0,65 m, y 0, z 0,04 m; Einstellwinkel −1,5°; Schnitte (`y_position` 0, `Chord` 0,11, `xOffset` 0, keine V-Form, keine Schränkung) und (`y_position` 0,23, `Chord` 0,07, `xOffset` 0,025, keine V-Form, keine Schränkung); Profil NACA 0009.

| Schnitt | Schritte 1 und 2 | Importiert (Position angewendet) |
| --- | --- | --- |
| s1 | x 0, y 0, z 0, Profiltiefe 110, Schränkung 0 | x 650, y 0, z 40, Profiltiefe 110, Schränkung 0 |
| s2 | x 25, y 230, z 0, Profiltiefe 70, Schränkung 0 | x 675, y 230, z 40, Profiltiefe 70, Schränkung 0 |

Der Elevator hat ebenfalls einen Einstellwinkel: Schnittebenen **Auf Gehrung**, `partTilt` −1,5, `partPivot` `{ "x": 650, "y": 0, "z": 40 }`. Er hat keine V-Form, daher enthält der Bericht keine Zeile zu den Schnittebenen.

Fixture B (Einstellwinkel 1°, Position 50, 0, 10 mm; Clark Y an den Schnitten 1 und 2, Schnitt 2 um 1° geneigt): Schnitt 1 wandert von x 50, z 10 (Schritte 1 bis 3) nach x 50,3674, z 20,6573, Schnitt 2 von x 110, y 250, z 10 nach x 110,1572, y 249,8387, z 19,2405. Die Schränkungen bleiben 2° und 1°. Das Projekt speichert `partTilt` 1 und `partPivot` `{ "x": 50, "y": 0, "z": 10 }`.

## flow5-Import

**Öffnen** (Open) liest ein flow5-Projekt (`.fl5`) oder eine flow5-Flugzeug- oder -Flügeldatei (`.xml`) und importiert daraus einen Flügel. flow5 ist der Nachfolger von XFLR5 (Version 7), seit dem 01.01.2026 quelloffen unter der GNU General Public License (GPL) 3.0. Die Leseroutinen sind nach einer Beschreibung der Formate geschrieben, nicht nach dem Code von flow5. Der Import verwendet den Dialog, die Abbildung auf Schnitte, die Profilquellen, den Bericht und das Ergebnis des XFLR5-Imports (Abschnitt „XFLR5-Import“); dieser Abschnitt nennt, was abweicht. Die Meldungen sagen `flow5`, wo der XFLR5-Import `XFLR5` sagt.

### Unterstützte Dateien

| Datei | Geschrieben von | Inhalt | Import |
| --- | --- | --- | --- |
| `.fl5`-Projekt, Format 500750 | flow5 7.50 bis 7.53 | Flugzeuge in Metern; Profile mit Koordinaten | ja |
| `.fl5`-Projekt, Format 500754 | flow5 7.54 bis 7.57 | dasselbe; bis zum Ende der Flugzeuge dieselben Bytes wie 500750 | ja |
| XML-Flugzeugdatei: `<xflplane version="1.0">` mit `<Plane>` | flow5 7.50 und neuer (der Aufbau der Elemente ist von 7.53 bis 7.57 gleich) | Flügel in der Längeneinheit, die flow5 anzeigt; Profilnamen oder Namen von `.dat`-Dateien, keine Koordinaten | ja |
| XML-Flügeldatei: `<xflwing version="1.0">` mit `<wing>` | flow5 7.50 und neuer | ein Flügel; Position und Winkel 0 | ja |

- Getestete Dateien: geschrieben von flow5 7.57 und 7.56 (`test/fixtures/flow5/`, Herkunft in ihrer `SOURCE.md`). Dateien von flow5 7.50 bis 7.53 waren nicht verfügbar; der Aufbau ihrer Datensätze (Projektformat 500750) ist mit Dateien des Testschreibers `test/fl5-writer.js` getestet.
- Ein `.fl5`-Projekt enthält Flugzeuge zweier Arten: Flugzeuge aus Flügeln und Rümpfen und Flugzeuge aus einem Dreiecksnetz (aus einer STL-Datei), die keinen Flügel enthalten. Beide werden gelistet; ein Netzflugzeug bietet keine Fläche an, und sein Bericht enthält den Fehler `Flugzeug „<Name>“ hat keinen Flügel zum Importieren.` Der Dialog öffnet mit dem ersten Flugzeug, das einen Flügel zum Importieren hat.

### Abgelehnte Dateien

| Code | Datei | Meldung |
| --- | --- | --- |
| `flow5-old` | `.fl5`-Projekt eines Formats unter 500750 (flow5 7.01 bis 7.26) | `Die Datei ist ein flow5-Projekt im Format 500006, geschrieben von flow5 7.26 oder älter: in einem aktuellen flow5 öffnen und speichern oder das Flugzeug als XML exportieren.` |
| `flow5-unknown` | `.fl5`-Projekt eines Formats von 500751 bis 500753 (kein bekannter Aufbau) | `Die Datei ist ein flow5-Projekt im Format 500752, das dieser Import nicht liest (Formate 500750, 500754): das Flugzeug in flow5 als XML exportieren.` |
| `flow5-new` | `.fl5`-Projekt eines Formats über 500754 | `Die Datei ist ein flow5-Projekt im Format 500755, neuer als dieser Import liest (bis 500754, flow5 7.54 bis 7.57): das Flugzeug in flow5 als XML exportieren.` |
| `no-plane` | `.fl5`-Projekt ohne Flugzeug | `Das Projekt enthält kein Flugzeug.` |
| `damaged` | `.fl5`-Projekt, vor dem Ende der Flugzeuge abgeschnitten oder widersprüchlich; eine Flugzeugart außer 0 und 1; eine Rumpfart außer 100001 bis 100006 | `Die Datei ist bei Byte <n> beschädigt oder abgeschnitten (<part>).` `Flugzeug 1 der Datei ist von einer Art, die dieser Import nicht liest (Art -1).` |
| `not-plane-xml` | flow5-XML-Datei eines Rumpfs, Boots, Segels oder einer Analyse (`xflfuse`, `xflboat`, `xflsail`, `xflpolar`, `xflplanepolar`, `xflboatpolar`) | `Die Datei ist eine flow5-XML-Datei ohne Flugzeug oder Flügel (Wurzelelement „xflfuse“).` |
| `not-plane-xml` | Wurzelelement `xflplane` in anderer Groß- und Kleinschreibung (flow5 vergleicht es mit Groß- und Kleinschreibung) oder eine `version` außer `1.0` | `Die Datei ist keine flow5-Flugzeug- oder -Flügeldatei (Wurzelelement „<root>“, Version „<version>“).` |
| `damaged` | XML-Datei mit `meter_to_length_unit` (oder `length_unit_to_meter`) unter 1e-6 oder über 1000 oder keiner Zahl | `Die Längeneinheit der XML-Datei ist ungültig: meter_to_length_unit ist „<value>“.` |

Die übrigen Ablehnungen von XML-Dateien (beschädigtes XML, weder Flugzeug noch Flügel, Grenzen) sind die des XFLR5-Imports.

### Einlesen der Datei

| Eigenschaft | Regel |
| --- | --- |
| Aufbau einer `.fl5` | Ein Qt-`QDataStream` wie das `.xfl`-Projekt: Big-Endian, ein C++-`float` als 8-Byte-Double, eine Zeichenkette als ihre Byteanzahl (0xFFFFFFFF: Null-Zeichenkette) und UTF-16BE. Die Datensätze haben kein Längenpräfix: Der Leser geht Feld für Feld durch den Kopf (eine Standard-Profilanalyse, eine Standard-Flugzeuganalyse, eine Zeichenkette, 5 Splines), die Profile, die Profilanalysen und ihre gespeicherten Ergebnisse bis zu den Flugzeugen und hört nach dem letzten Flugzeug auf. Flugzeuganalysen, ihre Ergebnisse und Boote folgen und werden nicht gelesen. Gelesen durch Fenster von 4 194 304 Byte, wie eine `.xfl`. |
| Formate der Datensätze | Jeder Datensatz beginnt mit seiner Formatnummer; der Leser folgt den Aufbauten von flow5 7.50 bis 7.57: Linienstile von 7.12 und neuer, Profile mit und ohne die Felder der Punktverdichtung (Format 500753), Teile mit und ohne die Netzgrößen (500754), Rümpfe von 6 Arten. Ein Rumpf aus Schnitten von flow5 7.56 und älter enthält seine Schnittpunkte nach seinen Spanten; 7.57 schreibt keine. Das Teileformat des Rumpfs (500757 ab 7.57) unterscheidet die beiden. |
| Längeneinheit | `.fl5`: Meter. XML: `<Units><meter_to_length_unit>`; trotz seines Namens ist der Wert Meter je Dateieinheit, wie `length_unit_to_meter` von XFLR5, das flow5 ebenfalls liest: mm 0,001, cm 0,01, dm 0,1, m 1, in 0,0254, ft 0,3048. Ohne `<Units>`: Meter. `<Units>` gilt nur für das, was ihm folgt, mit einer Warnung, wenn es nach einem Flugzeug oder Flügel steht. |
| Winkel | Grad |
| Genauigkeit von XML-Dateien | flow5 schreibt die Längen der Schnitte mit 3 Nachkommastellen in der Dateieinheit, `Position` mit 5 signifikanten Stellen und die Winkel mit 3 Nachkommastellen. Eine Datei in Metern rundet auf 1 mm: Info `flow5 rundet Längen in XML-Dateien in Metern auf 1 mm; die .fl5-Projektdatei behält die volle Genauigkeit.` |
| XML-Werte | Wie im XFLR5-Leser, außer: Ein fehlender Wert ist 0, wie in flow5 (auch `y_position` und `Chord`). Ein Wert, der keine Zahl ist, bleibt fehlend, mit der Warnung des XFLR5-Imports; flow5 liest ihn als 0. Wahrheitswerte: `true` in beliebiger Groß- und Kleinschreibung ist wahr, anderer Text falsch; ein leeres Element behält die Vorgabe (flow5 liest es als falsch). `Type`: `MAINWING`, `ELEVATOR` und `FIN` ohne Beachtung der Groß- und Kleinschreibung, aber nicht gekürzt, wie flow5 sie vergleicht; alles andere, auch `SECONDWING`, ist ein weiterer Flügel. |
| XML-Struktur | Unbekannte Elemente werden übersprungen, auch vor einem `<Plane>`, wo flow5 das Lesen beendet. Mehrere `<Plane>`-Elemente werden gelistet (flow5 behält das letzte). Eine Flügeldatei mit mehreren Flügeln: der letzte, mit der Warnung `Die Datei enthält 2 Flügel außerhalb eines Flugzeugs; flow5 liest nur den letzten, „<name>“, und dieser Import ebenso.` |
| Profildateien in XML | `Left_Side_Foil_File` und `Right_Side_Foil_File` nennen eine `.dat`-Datei neben der XML-Datei. Der Profilname ist der Dateiname ohne seinen Ordner und seine Endung `.dat`. Der Browser kann den Ordner nicht lesen: Der Dialog fragt nach den Dateien (**.dat-Dateien hochladen …**, Upload .dat files…). flow5 7.54 und neuer schreibt in der Vorgabe die Profilnamen und je Profil eine Datei `<name>.dat` neben die XML-Datei, und die Dateiverweise, wenn die Option zum Einschließen der Profile eingeschaltet ist. |
| Profile einer `.fl5` | Name, Klappeneinstellungen und Koordinaten (höchstens 10 000 Punkte je Profil). flow5 7.50 und neuer speichert die Form selbst: Eine Klappe wird nur in den Analysen von flow5 ausgeschlagen. Ein späteres Profil gleichen Namens ersetzt das frühere; ein leerer Name findet kein Profil. |

### Flügel und Flächen

Ein flow5-Flugzeug enthält beliebig viele Flügel, jeder mit einem Typ: Tragfläche, Elevator (Höhenleitwerk), Seitenleitwerk oder weiterer Flügel. Der Dialog listet jeden Flügel in der Reihenfolge der Datei. Die Bezeichnungen nummerieren die Flügel eines Typs, wenn es mehrere gibt: **Tragfläche 1** (Main wing 1), **Tragfläche 2**, **Höhenleitwerk (flow5: Elevator)** (Horizontal stabilizer (flow5: Elevator)), **Weiterer Flügel 1** (Other wing 1), **Seitenleitwerk** (Fin).

| Flügel | Angeboten | Grund, wenn nicht |
| --- | --- | --- |
| ein zweiseitiger Flügel jedes Typs: Tragflächen, Elevators, weitere Flügel (ein Canard) | ja, mit seinem Rollwinkel (`Rx_angle`) und Einstellwinkel (`Ry_angle`) | – |
| ein einseitiger Flügel (`Two_Sided` false, ein Seitenleitwerk) | ja, als die Hälfte, die flow5 baut (Abschnitt „Abbildung auf Schnitte“ unten) | – |
| ein einseitiger Flügel mit `Ry_angle` ungleich 0 | nein: flow5 dreht einen einseitigen Flügel um `Ry_angle` um die z-Achse, ein Teil dreht sich nur um x und y | `Ein einseitiger Flügel, um 3° um z gedreht (Ry_angle): Ein Teil dreht sich nur um x und y.` |

- Der erste verfügbare Flügel ist vorgewählt: die erste Tragfläche, wenn das Flugzeug eine hat.
- Der Bericht nennt die übrigen Flügel des Flugzeugs: `Nicht importiert: Tragfläche 2 „Rear“, Seitenleitwerk „Fin“. Eine Fläche je Import; für eine weitere die Datei erneut öffnen.`
- Meldung für einen weiteren Flügel: `Flügel „Canard“ von „Tandem“ aus full.fl5 importiert: 2 Schnitte, 1 Profil.`

### Abbildung auf Schnitte

Die Werte der Schnitte (`y_position`, `Chord`, `xOffset`, `Dihedral`, `Twist`) bedeuten dasselbe wie in XFLR5, und die Abbildung ist die des XFLR5-Imports (Abschnitt „Abbildung auf Schnitte“, Schritte 1 bis 6). flow5 dreht einen Flügel erst um `Rx_angle` um die x-Achse, dann um `Ry_angle` um die y-Achse, beide um den Ursprung des Flügels, und verschiebt ihn dann um `Position`.

| flow5-Wert | Import |
| --- | --- |
| `Ry_angle` | **Einstellwinkel des Teils** (Part tilt), um den Ursprung des Flügels, wie der Einstellwinkel von XFLR5 (Schritt 3). Positiv: Nasenleiste hoch. |
| `Rx_angle` | **Rollwinkel des Teils** (Part roll), um den Ursprung des Flügels, vor dem Einstellwinkel ([[Geometrie]], Abschnitt 3.9). Positiv: rechter Randbogen hoch. Info `Rollwinkel 10° (Rx_angle) wie im flow5-Flugzeug angewendet: Das Teil dreht sich als starrer Körper um den Ursprung des Flügels, vor dem Einstellwinkel (Einstellungen > Rollwinkel des Teils).` |
| `Position` x und z | verschiebt die Schnitte (Schritt 3); der Ursprung des Flügels ist `partPivot` |
| `Position` y | nicht verwendet: Info `Die Position y 20 mm wird wie in flow5 nicht verwendet.` |
| Profile der linken Seite | nicht verwendet, wie bei XFLR5; bei einem einseitigen Flügel sind die Profile der linken Seite die einzigen |

**Einseitiger Flügel (Seitenleitwerk).** flow5 baut nur die linke Hälfte (lokal y ≤ 0), mit den Profilen der linken Seite, und dreht sie um `Rx_angle`; ein Seitenleitwerk hat −90°. Der Import übernimmt diese Hälfte: die Profile der linken Seite, **Rollwinkel des Teils** −`Rx_angle` (ein Seitenleitwerk: 90°) und **Einstellwinkel des Teils** 0. Die linke Hälfte des Teils, das Spiegelbild seiner rechten Hälfte, ist dann die Hälfte von flow5; bei einem Seitenleitwerk bei y = 0 liegt die rechte Hälfte deckungsgleich darauf. Info `Ein einseitiger Flügel: flow5 baut nur seine linke Hälfte, mit den Profilen der linken Seite. Die linke Hälfte des Teils ist diese Hälfte, seine rechte Hälfte das Spiegelbild (bei einem Seitenleitwerk bei y = 0 deckungsgleich); Einstellungen > Gespiegelte Hälfte zeigen und Exportieren > Flügelhälften > Nur rechte Hälfte ergeben eine Hälfte.` Die folgende Regel für die linke Hälfte gilt nicht.

**Gerollter zweiseitiger Flügel.** flow5 dreht den ganzen Flügel, beide Hälften, als einen Körper: Die linke Hälfte eines gerollten Flügels dreht sich in die andere Richtung als seine rechte Hälfte. Der Import stellt **Einstellungen** > **Linke Hälfte** (Left half; `settings.leftHalf`) auf `"turned"`, sodass sich die linke Hälfte mit der rechten Hälfte dreht ([[Geometrie]], Abschnitt 3.9). Info `flow5 rollt den ganzen Flügel als einen Körper, seine linke Hälfte rollt also in die andere Richtung: Einstellungen > Linke Hälfte ist auf Mit der rechten Hälfte gedreht gestellt.` Ein Flügel ohne Rollwinkel und ein einseitiger Flügel behalten `"mirror"`. Das Projekt wird dann im Format Version 4 gespeichert (Abschnitt „Projekt-JSON“).

### Profile

Die Profilquellen sind die des XFLR5-Imports (Abschnitt „Profile“); Reihenfolge 0 ist das Profil des `.fl5`-Projekts. XML-Dateien nennen nur die Profilnamen.

- Profile eines `.fl5`-Projekts erhalten `source.kind` `"flow5"`, `source.file` den Dateinamen und `source.note` `Profil „<name>“ aus dem flow5-Flugzeug „<plane>“; die gespeicherte Form.` (ohne Flugzeugnamen: `Profil „<name>“ aus einem flow5-Projekt; die gespeicherte Form.`). Die Registerkarte **Profile** (Airfoils) zeigt `flow5: <file>` unter einem solchen Profil.
- Klappen eines `.fl5`-Profils: Info `Profil „<name>“ hat in flow5 eine Klappe an der Endleiste (Drehachse bei <x> % der Profiltiefe); flow5 schlägt sie nur in seinen Analysen aus, importiert wird die gespeicherte Form.` (und ebenso mit „Nasenleiste“).

### Überprüfung

Gemessen an den Dateien von `test/fixtures/flow5/` gegen das Dreiecksnetz der dicken Fläche, das flow5 7.57 aus denselben Dateien für seine Analysen baut: Die Netzknoten der rechten Hälfte von 8 Flügeln, der linken Hälfte beider gerollter zweiseitiger Flügel und beider Seitenleitwerke liegen innerhalb von 0,15 mm an der gebauten Fläche (`test/flow5-map.test.js`).

| Flügel | Fall | Größter Abstand (mm) |
| --- | --- | --- |
| `full.fl5`, „Canard“ | Einstellwinkel 2°, Position angewendet | 0,0031 |
| `basic.fl5`, „Stab“ | Einstellwinkel −1,5°, Position angewendet | 0,0047 |
| `full.fl5`, „Vee“ | Rollwinkel 10°, Einstellwinkel −2°, 25° V-Form; rechte Hälfte | 0,0057 |
| `full.fl5`, „Vee“ | dasselbe; linke Hälfte, **Linke Hälfte** gedreht | 0,0061 |
| `full.fl5`, „Tilted other“ | Rollwinkel 30° (ein weiterer Flügel); rechte Hälfte | 0,0032 |
| `full.fl5`, „Tilted other“ | dasselbe; linke Hälfte, **Linke Hälfte** gedreht | 0,0032 |
| `full.fl5`, „Fin“ | einseitig, Rollwinkel −90°; die linke Hälfte des Teils gegen die Hälfte von flow5 | 0,0039 |
| `basic.fl5`, „Fin“ | dasselbe | 0,0047 |
| `full.fl5`, „Rear“ | keine V-Form | 0,0104 |
| `full.fl5`, „Wing2“ | 5° V-Form im Randfeld, Position y 20 mm abgezogen | 0,0766 |
| `basic.fl5`, „Main“ | 3° und 6° V-Form | 0,0796 |
| `full.fl5`, „Front“ | Einstellwinkel 1°, NACA 2412 zu einem NACA 2410 mit Klappe entlang des Felds | 0,1469 |

Mit **Linke Hälfte** auf Spiegelbild liegt die linke Hälfte von „Vee“ bis zu 61,3 mm von der linken Hälfte von flow5 entfernt, die von „Tilted other“ bis zu 85,7 mm. Die eigenen Flächenpunkte von flow5 (`Surface::getSurfacePoint`) legen das Wurzelprofil rechtwinklig zum ersten Feld, 0,99 mm (3° V-Form) bis 1,90 mm (25° V-Form) neben der senkrechten Wurzelebene; das Analysenetz hat seine Wurzelknoten bei y = 0, wie der Import.

## Körper je Datei

| Option **Flügelhälften** (Wing halves) | STEP | STL | 3MF |
| --- | --- | --- | --- |
| **Beide Hälften als getrennte Körper** (Both halves as separate bodies) | 2 Volumenkörper | 1 Datei, 2 geschlossene Hüllen | 2 Objekte: `Wing right`, `Wing left` |
| **Ganzer Flügel als ein Körper (Netzformate, Wurzel bei y = 0)** (Full wing as one body (mesh formats, root at y = 0)) | 2 Volumenkörper | 1 geschlossene Hülle | 1 Objekt: `Wing` |
| **Nur rechte Hälfte** (Right half only) | 1 Volumenkörper | 1 geschlossene Hülle | 1 Objekt: `Wing right` |

- **Ganzer Flügel als ein Körper** (Full wing as one body) setzt den Wurzelschnitt bei genau y = 0 mm und den **Rollwinkel des Teils** 0° voraus. Sonst enthalten STL und 3MF 2 Hüllen, wie bei **Beide Hälften als getrennte Körper**: Eine gerollte Wurzel verlässt die Ebene y = 0.
- **Einstellwinkel des Teils** und **Rollwinkel des Teils** (`settings.partTilt`, `partRoll`): Jedes Format schreibt die rechte Hälfte um den Drehpunkt gedreht ([[Geometrie]], Abschnitt 3.9) und die linke Hälfte so, wie **Linke Hälfte** (`settings.leftHalf`) sie einstellt: das Spiegelbild der gedrehten rechten Hälfte an y = 0 oder das Spiegelbild der ungedrehten rechten Hälfte, mit ihr gedreht. Die Projekt-JSON enthält die Schnitte im Koordinatensystem des Teils.
- **Fusion-360-Korrektur: Y nach oben (auch SolidWorks)** (Fusion 360 fix: Y up (also SolidWorks)) (STEP, STL, 3MF): Ausgeschaltet schreibt der Export die Achsen der App (x in Profiltiefenrichtung zur Endleiste, y in Spannweitenrichtung zum rechten Flügelende, z nach oben). Eingeschaltet schreibt er jeden Punkt als (x, z, −y) und jede Richtung ebenso (`src/export/axes.js`): Die Oberseite zeigt nach +Y, die Profiltiefe verläuft entlang X, `right` liegt bei Z ≤ 0 und `left` bei Z ≥ 0. Die Drehung ist eine Rotation: Orientierungen, geschlossene Hüllen und Volumen bleiben. Die Weltlage der STEP-Datei (`AXIS2_PLACEMENT_3D` im Ursprung mit z- und x-Richtung) bleibt. Die Projekt-JSON enthält immer die Achsen der App. Warum und wann: [[Benutzerhandbuch|Benutzerhandbuch]], Abschnitt Export.
- **Netzdichte (STL, 3MF)** (Mesh density (STL, 3MF)): **Normal** oder **Fein (4-fache Dreiecksanzahl)** (Fine (4x triangles)). **Fein** (Fine) teilt jedes u-Intervall (Profiltiefenrichtung) und jedes v-Intervall (Spannweitenrichtung) des **Normal**-Netzes in 2. Gemessene Dreieckszahl: 3,0- bis 3,9-fach gegenüber **Normal** (Tabelle „Dateigrößen“).
- Aufbau der Dreiecksnetze und Dreieckszahlen: [[Geometrie|Geometrie]], Abschnitt 5 „Dreiecksnetze“.

![Exportdialog: Format, Flügelhälften, Netzdichte, Fusion-360-Korrektur](images/de/export-dialog.png)

## STEP

| Eigenschaft | Wert |
| --- | --- |
| Datei | Textdatei nach ISO 10303-21 |
| Schema | `AUTOMOTIVE_DESIGN { 1 0 10303 214 1 1 1 1 }` (AP214) |
| `FILE_DESCRIPTION` | `(('Wingdesigner wing'),'2;1')` |
| `FILE_NAME` Name | `<name>` (Abschnitt „Dateinamen beim Export“) |
| `FILE_NAME` Zeit | Exportzeit in UTC, `YYYY-MM-DDThh:mm:ss` |
| `FILE_NAME` Autor, Organisation | leer |
| `FILE_NAME` Präprozessor, Ursprungssystem | `Wingdesigner` |
| Produkt | `PRODUCT` mit `<name>`, Kategorie `part` |
| Einheiten | Millimeter, Radiant, Steradiant |
| Toleranz | 1e-7 mm (`distance_accuracy_value`) |
| Volumenkörper | 1 `MANIFOLD_SOLID_BREP` (Volumenkörper in Randdarstellung, boundary representation) je Hälfte |
| Lage des Teils | Punkte von Flächen, Kurven und Ebenen der Abschlussflächen um **Einstellwinkel des Teils** und **Rollwinkel des Teils** um den Drehpunkt gedreht, Richtungen (Normalen von Ebenen, Bezugsrichtungen) nur mit der Drehung; danach die Spiegelung der linken Hälfte, danach die **Fusion-360-Korrektur** |
| Namen der Volumenkörper | `<name> right` (y ≥ 0; mit **Fusion-360-Korrektur**: Z ≤ 0), `<name> left` (gespiegelt, y ≤ 0; mit **Fusion-360-Korrektur**: Z ≥ 0) |
| Achsen | wie in der App, das Teil um **Einstellwinkel des Teils** und **Rollwinkel des Teils** gedreht; mit **Fusion-360-Korrektur**: (x, z, −y) (Abschnitt „Körper je Datei“) |
| Formdarstellung | 1 `ADVANCED_BREP_SHAPE_REPRESENTATION` mit dem Namen `<name>` enthält alle Volumenkörper |
| Flächen | `B_SPLINE_SURFACE_WITH_KNOTS`, nicht-rational: Oberseite, Unterseite, offene Endleiste. `PLANE`: Wurzel und Rand. |
| Kantenkurven | `B_SPLINE_CURVE_WITH_KNOTS` |
| Zahlen | kürzeste Dezimaldarstellung, die den 64-Bit-Gleitkommawert exakt wiedergibt, immer mit Dezimalpunkt, Exponent `E` |
| Zeichenketten | `'` und `\` verdoppelt. Zeichen außerhalb U+0020–U+007E als `\X2\hhhh\X0\` oder `\X4\hhhhhhhh\X0\`. Ein einzelnes UTF-16-Ersatzzeichen (Surrogat, U+D800–U+DFFF) wird als U+FFFD (Ersetzungszeichen) geschrieben. |

Flächen, Kanten, Orientierungsflags und die Prüfung mit OpenCascade: [[Geometrie|Geometrie]],
Abschnitt 6 „STEP-Topologie“.

## STL

| Eigenschaft | Wert |
| --- | --- |
| Variante | binär, Little-Endian |
| Kopf | 80 Byte: `Wingdesigner <name>` (Abschnitt „Dateinamen beim Export“), UTF-8, bei 80 Byte abgeschnitten, mit Nullbytes aufgefüllt |
| Dreieckszahl | `uint32` |
| Je Dreieck | 50 Byte: Normale (3 × `float32`), 3 Eckpunkte (9 × `float32`), Attribut `uint16` = 0 |
| Dateigröße | 84 + 50 × Dreieckszahl Byte |
| Einheiten | mm. STL hat kein Einheitenfeld. |
| Achsen | wie in der App, das Teil um **Einstellwinkel des Teils** und **Rollwinkel des Teils** gedreht; mit **Fusion-360-Korrektur**: (x, z, −y) (Abschnitt „Körper je Datei“) |
| Normalen | Länge 1, aus den Eckpunkten berechnet; Eckpunkte von außen gesehen gegen den Uhrzeigersinn, Normalen zeigen nach außen |

## 3MF

| Eigenschaft | Wert |
| --- | --- |
| Paket | Zip, Deflate-Stufe 6: `[Content_Types].xml`, `_rels/.rels`, `3D/3dmodel.model` |
| Namensraum | `http://schemas.microsoft.com/3dmanufacturing/core/2015/02` (3MF Core) |
| `<model>` | `unit="millimeter"`, `xml:lang="en-US"` |
| Achsen | wie in der App, das Teil um **Einstellwinkel des Teils** und **Rollwinkel des Teils** gedreht; mit **Fusion-360-Korrektur**: (x, z, −y) (Abschnitt „Körper je Datei“) |
| Metadaten | `Title` = `<name>` (Abschnitt „Dateinamen beim Export“), `Application` = `Wingdesigner` |
| Objekte | 1 `<object type="model">` je Hülle, 1 `<build><item>` je Objekt; Namen: Tabelle „Körper je Datei“ |
| Eckpunkte | 9 signifikante Stellen (genug für jede 32-Bit-Gleitkommazahl), kürzeste Form ohne Nullen am Ende, z. B. `1000000.12`, `0.123456789`, `12`; Beträge unter 1e-6 mm in Exponentenschreibweise, z. B. `-1e-7`; null als `0` |
| Dreiecke | `v1`, `v2`, `v3`: Eckpunktindizes ab 0, von außen gesehen gegen den Uhrzeigersinn |
| Datum der Zip-Einträge | fest 01.01.2026 00:00 UTC, gespeichert in der Ortszeit des Browsers; nicht die Exportzeit |

## Schaumschnitt-Dateien

Geschrieben vom Schaumschnitt-Assistenten ([[Benutzerhandbuch|Benutzerhandbuch]], Abschnitt Schaumschnitt); Geometrie: [[Geometrie|Geometrie]], Abschnitt 8 „Schaumkerne“. Längen in mm, Winkel in Grad. Die `.dat`-Dateien, `segments.csv` und die Koordinaten in SVG, DXF und PDF haben in beiden Sprachen der Oberfläche einen Dezimalpunkt. `README.txt`, die Texte der Schablonen und der Titel des PDF stehen in der Sprache der Oberfläche, mit deren Zahlenformat (deutsch: Dezimalkomma, `y = 0,0 mm`). Die Dateien beschreiben die rechte Hälfte.

### Profil-ZIP

| Eintrag | Inhalt |
| --- | --- |
| `README.txt` | Blocksystem, Punktfolge, Keile und die linke Hälfte, in der Sprache der Oberfläche; UTF-8, Zeilenenden CRLF |
| `segments.csv` | Eine Zeile je Segment (Tabelle unten) |
| `mm/segment-<ii>-inboard.dat`, `mm/segment-<ii>-outboard.dat` | Endprofile im Blocksystem, mm |
| `normalized/segment-<ii>-inboard.dat`, `normalized/segment-<ii>-outboard.dat` | Dieselben Profile, auf Profiltiefe 1 skaliert |

`<ii>`: Segmentnummer von der Wurzel an, mindestens 2 Ziffern (`01`, `100`). Zip: Deflate-Stufe 6, Datum der Einträge 01.01.2026 00:00 (in jeder Zeitzone gleich).

`.dat`-Datei (Selig-Reihenfolge):

| Zeile | Inhalt |
| --- | --- |
| 1 | `<name> segment <i> <inboard oder outboard> y=<y> mm`; `normalized/` ergänzt ` chord=<chord> mm`. `<name>`: Projektname in ASCII (Umlaute ausgeschrieben, übrige Akzente entfernt, übrige Zeichen außerhalb von ASCII weggelassen; leer: `wing`) |
| 2 … | `x h` je Punkt: obere Endleiste, Profilnase, untere Endleiste. `mm/`: 6 Nachkommastellen; `normalized/`: 7 Nachkommastellen. Zeilenenden LF. |

- Punktzahl: 2N + 1 (121 bei der Vorgabe von 60 Stationen je Profilseite), in jeder Datei eines ZIP gleich.
- `mm/`: x in Profiltiefenrichtung zur Endleiste, h nach oben, rechtwinklig zur Kernachse. Ursprung: die vordere untere Ecke des kleinsten Blocks, der beide Profile des Segments enthält. Beide Dateien eines Segments teilen das Blocksystem.
- `normalized/`: Profilnase bei (0, 0), Mitte der Endleiste (Mittel aus erstem und letztem Punkt) bei (1, 0). Profiltiefe, Lage der Profilnase und Anstellwinkel jedes Endes: `segments.csv`.
- Kein Versatz für die Schnittbreite.

`segments.csv`: durch Kommas getrennt, Dezimalpunkt, Zeilenenden LF, eine Kopfzeile.

| Spalte | Einheit | Inhalt |
| --- | --- | --- |
| `segment` | – | Nummer ab 1 |
| `y_inboard_mm`, `y_outboard_mm` | mm | Schnitte |
| `core_length_mm` | mm | Abstand der Endflächen entlang der Achse |
| `axis_angle_deg` | ° | Achswinkel (V-Form des Segments) |
| `block_width_mm`, `block_height_mm` | mm | kleinster Block, der beide Profile enthält (ohne den Rahmenzuschlag von 10 mm der Schablonen) |
| `deviation_mm`, `deviation_y_mm` | mm | größte Abweichung des Kerns (Regelfläche) und ihre Spannweitenposition |
| `inboard_chord_mm` … `inboard_wedge_side`, `outboard_chord_mm` … `outboard_wedge_side` | | je Ende: `chord_mm`, `le_x_mm`, `le_h_mm`, `te_x_mm`, `te_h_mm` (Blocksystem), `incidence_deg` (Nase hoch positiv), `wedge_angle_deg`, `wedge_depth_mm`, `wedge_side` (`upper`, `lower`, leer ohne Keil; Winkel und Tiefe dann 0) |

### Aufbau der Schablonen

Gemeinsam für SVG, PDF und DXF: Blöcke in einer Spalte, 15 mm Abstand, y nach oben.

| Block | Inhalt |
| --- | --- |
| Kopf | 100-mm-Maßstab mit Teilstrichen alle 10 mm; Anweisungen, bei 180 mm umbrochen |
| Schablone, je Segmentende | Textzeilen (3,5 mm hoch, 5 mm Abstand, bei der Rahmenbreite umbrochen, mindestens bei 150 mm); Rahmen: Block plus 10 mm auf jeder Seite; das Endprofil an seiner Lage im Block innerhalb des Rahmens, um die halbe Schnittbreite nach außen versetzt (Gehrungsecken, die Gehrung höchstens das 4-Fache des Versatzes); 21 Marken: 3 mm lange Striche nach außen an den Punkten 0, 6, 12 … 120 von 121, nummeriert 0 bis 20 (Text 2 mm hoch) |

| Element | SVG | PDF | DXF-Layer, Farbe |
| --- | --- | --- | --- |
| Profil | `polygon` mit Klasse `profile`, schwarz, 0,25 mm | schwarz, 0,25 mm | `PROFILE`, 7 |
| Rahmen, Maßstab des Kopfs | `polygon` oder `polyline` mit Klasse `frame`, grau `#555555`, 0,18 mm | grau 0,33, 0,18 mm | `FRAME`, 8 |
| Marken | `polyline` mit Klasse `mark`, rot `#c0392b`, 0,18 mm | rot, 0,18 mm | `MARKS`, 1 |
| Text | `text`, Helvetica, Arial, sans-serif | Helvetica (Standardschrift, WinAnsiEncoding) | `TEXT`, 5 |

### SVG

Ein Blatt. `width` und `height` in mm, `viewBox` in mm (1 Einheit = 1 mm), weißer Hintergrund. Koordinaten mit 3 Nachkommastellen.

### DXF

| Eigenschaft | Wert |
| --- | --- |
| Version | AutoCAD R12 (`$ACADVER` `AC1009`), ASCII, Zeilenenden CRLF |
| Kopf | `$INSUNITS` 4 (mm), `$EXTMIN`, `$EXTMAX` |
| Tabellen | Linientyp `CONTINUOUS`; Layer `PROFILE`, `FRAME`, `MARKS`, `TEXT` |
| Umrisse | `POLYLINE` mit `VERTEX` und `SEQEND`; Flag 1 (geschlossen) für Profile und Schablonenrahmen, 0 für den Maßstab und die Marken |
| Text | `TEXT`; `°` als `%%d`, andere Zeichen außerhalb von ASCII als `\U+XXXX` |
| Koordinaten | 4 Nachkommastellen, z = 0 |

### PDF

| Eigenschaft | Wert |
| --- | --- |
| Version | PDF 1.4 |
| Seite | A4 (210 × 297 mm), A3 (297 × 420 mm) oder Letter (215,9 × 279,4 mm), Hoch- oder Querformat (Seitenaufteilung: [[Benutzerhandbuch]], Abschnitt Schaumschnitt) |
| Maßstab | 1:1: 1 mm = 72/25,4 pt |
| Schrift | Helvetica, WinAnsiEncoding; Zeichen außerhalb davon als `?` |
| Inhaltsströme | FlateDecode |
| Info | `Title`: `<Projektname>: Schablonen für Schaumkerne` in der Sprache der Oberfläche; `Producer`: `Wingdesigner` |
| Seitenfuß | 100-mm-Maßstab, schwarz, 0,2 mm, und `100 mm. Seite <i> von <n>.` (Text 3 mm hoch) |
| Passkreuze | in der Überlappung von 2 Streifen einer geteilten Schablone, schwarz, 0,15 mm, 6 mm breit |

### Prüfung

Unabhängige Leseprogramme an 11 Testflügeln (den STEP-Testfällen ohne die Kopie mit Y nach oben), jeder so geschnitten, wie für einen längsten Kern von 300 mm vorgeschlagen, einer mit 1 mm Schnittbreite, einer auf A3, einer auf Letter: ezdxf 1.4.4 liest jedes DXF mit seinem Modul recover, und seine Prüfung (audit) findet keinen Fehler; jede Profil-Polylinie ist geschlossen und hat die erwartete Anzahl an Eckpunkten, und ohne Schnittbreite stimmen ihre Breite und Höhe innerhalb 0,001 mm mit denen ihrer `.dat`-Datei in `mm/` überein. pypdf 6.19.0 liest jedes PDF im strikten Modus: Seitenzahl und Seitengröße wie berechnet, eine Seitenbeschriftung auf jeder Seite. Jedes SVG lässt sich als XML lesen und enthält ein Profil-Polygon je Segmentende. Das Skript liest jedes ZIP mit der Python-Standardbibliothek: die erwarteten Einträge, 121 Punkte in jeder `.dat`-Datei, eine Zeile in `segments.csv` je Segment.

Nicht getestet: Programme für den Heißdrahtschnitt (Jedicut, GMFC, DevFoam und andere) mit diesen Dateien; CAD-Programme und Laserschneider mit dem DXF; Drucker mit PDF und SVG.

## Dateigrößen

Gemessen am 29.09.2026 mit **Beide Hälften als getrennte Körper** (Both halves as separate bodies) und Vorgabeauflösung (60 Stationen je
Profilseite in Profiltiefenrichtung). 1 KB = 1024 Byte. Dreieckszahlen in Klammern.

| Projekt | Schnitte | Stationen in Spannweitenrichtung | STEP | STL **Normal** | STL **Fein** (Fine) | 3MF **Normal** | 3MF **Fein** | JSON |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Beispielflügel „Sportflügel 1500“ | 3 | 3 | 122 KB | 71 KB (1444) | 235 KB (4812) | 20 KB | 61 KB | 63 KB |
| Entwurfstyp **Sportmodell** (Sport) im Assistenten | 2 | 2 | 99 KB | 47 KB (960) | 141 KB (2884) | 11 KB | 38 KB | 56 KB |
| Entwurfstyp **Segelflugmodell** (Glider) im Assistenten, elliptische Leitkurven | 3 | 17 | 444 KB | 1158 KB (23708) | 4566 KB (93500) | 279 KB | 1099 KB | 175 KB |
