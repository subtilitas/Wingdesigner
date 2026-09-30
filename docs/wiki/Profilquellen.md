English: [[Airfoil Sources|Airfoil-Sources]]

# Profilquellen

Zusammenfassung veröffentlichter Nutzungsbedingungen, keine Rechtsberatung. Zitate am 29.09.2026 mit den Originalseiten im Web abgeglichen.

## Übersicht

| Quelle | Bedingungen (Zusammenfassung) | Mitgeliefert | Nutzung in Wingdesigner |
| --- | --- | --- | --- |
| NACA-Gleichungen (National Advisory Committee for Aeronautics) für 4- und 5-stellige Profile, NACA Report 824 (Abbott, von Doenhoff, Stivers, 1945) | Veröffentlichte Gleichungen. Die App berechnet die Koordinaten und kopiert keine Koordinatendatei. | Im Browser erzeugt | 17 Vorlagen in **Bibliothek** (Library), **NACA-Generator** (NACA generator), Assistent |
| NACA-Berichtstabellen: Clark Y (NACA Report No. 502), USA 35B (Report No. 233), NACA M-6 (Report No. 221), NACA 8-H-12 (Technical Note 1998) | Werke der Regierung der Vereinigten Staaten. In den Vereinigten Staaten gemeinfrei (public domain); Status außerhalb der Vereinigten Staaten nicht geklärt. Bedingungen der NASA (National Aeronautics and Space Administration): NASA als Quelle nennen, keine Billigung durch die NASA andeuten, kein Urheberrecht beanspruchen. | Ja, 4 Dateien | **Bibliothek** |
| RAF 34: Tabelle des Royal Aircraft Establishment (RAE) in NACA Report No. 286 (erstmals veröffentlicht April 1928) | Urheberrechtliche Schutzfrist in den Vereinigten Staaten abgelaufen; Status außerhalb der Vereinigten Staaten nicht geklärt. NASA-Bedingungen wie in der Zeile darüber; das RAE als Herkunft der Daten nennen. | Ja, 1 Datei | **Bibliothek** |
| S9104 (Michael Selig, University of Illinois Urbana-Champaign) | Creative Commons Attribution 4.0 International (CC BY 4.0): Nutzung, Bearbeitung und Weitergabe mit Quellenangabe. | Ja, 1 Datei | **Bibliothek** |
| aerodesign.de, HS-Profile (Hartmut Siegmann) | Privat, im Verein, kleingewerblich und wissenschaftlich mit Namen und Quelle. Großserien und industrielle Anwendungen brauchen eine schriftliche Nutzungsvereinbarung. Die Weiterverbreitung durch Dritte ist zum Teil eingeschränkt. | Nein | Link in der App; dort herunterladen, dann hochladen |
| aerodesign.de, Profile anderer Konstrukteure | Nutzung nur mit Genehmigung des jeweiligen Urhebers. | Nein | Über den Link zu aerodesign.de (HS-Katalogseite); dort herunterladen, dann hochladen |
| mh-aerotools.de, MH-Profile (Martin Hepperle) | Persönlicher Gebrauch. Veröffentlichungen nennen die Quelle. Eine Neuzusammenstellung darf nicht über den Herstellungskosten verkauft werden. | Nein | Link in der App; dort herunterladen, dann hochladen |
| UIUC (University of Illinois Urbana-Champaign) Airfoil Coordinates Database | Keine Lizenz für die Koordinatendateien angegeben. Es gelten die Bedingungen des jeweiligen Konstrukteurs. | Nein | Link in der App; dort herunterladen, dann hochladen |
| Profile in einer XFLR5-Datei | Ein XFLR5-Projekt (`.xfl`; XFLR5 ist ein Programm zur Analyse von Profilen und Flügeln) enthält Profilkoordinaten ohne Urheber und Lizenz; eine XFLR5-Datei im Format XML (Extensible Markup Language) enthält nur Profilnamen. Es gelten die Bedingungen des Konstrukteurs jedes Profils. Die App prüft sie nicht. Wer die Datei importiert, ist für die Rechte an den Profilen in ihr verantwortlich. | Nein | **Öffnen** (Open) (XFLR5-Import); Profile eines `.xfl`-Projekts werden mit `source.kind` `xflr5` gespeichert, die übrigen behalten ihre eigene `source` |

- Mitgelieferte Koordinatendateien: 6, in `public/airfoils/` ([Mitgelieferte Dateien](#mitgelieferte-dateien)).
- Liste der NACA-Vorlagen und Regeln des Generators: [[Benutzerhandbuch|Benutzerhandbuch]], Abschnitte Bibliothek und NACA-Generator.
- Import von XFLR5-Dateien und die Profilquellen des Importdialogs: [[Dateiformate|Dateiformate]], Abschnitt XFLR5-Import; Dialog: [[Benutzerhandbuch|Benutzerhandbuch]], Abschnitt Import aus XFLR5.

## Links in der App

Registerkarte **Profile** (Airfoils), Kasten **Weitere Profile (extern, nicht mitgeliefert)** (More airfoils (external, not bundled)):

| Linktext | Ziel |
| --- | --- |
| aerodesign.de - Hartmut Siegmann | <https://aerodesign.de/profile/profile_hs.htm> |
| MH-AeroTools - Martin Hepperle | <https://www.mh-aerotools.de/airfoils/> |
| UIUC Airfoil Coordinates Database | <https://m-selig.ae.illinois.edu/ads/coord_database.html> |

## Dateien der externen Seiten

| Seite | Dateityp | In Wingdesigner ladbar |
| --- | --- | --- |
| aerodesign.de | Selig-`.dat`, Koordinaten als Bruchteil der Profiltiefe | Ja. Ausnahmen: `s3021.dat`, `sd7080.dat` ([Einlesetest](#einlesetest)). |
| aerodesign.de | „Original“-Tabellen als `.txt`, Spalten `X Yo Yu` in Prozent der Profiltiefe, teils mit Dezimalkomma (z. B. `HS 3,4/12,0`) | Ja |
| aerodesign.de | `.txt`-Tabellen mit 1 Seite eines symmetrischen Profils, Spalten `x y` in Prozent der Profiltiefe: `naca0009.txt`, `naca63a008.txt`, `naca64a010.txt` | Nein. Der Parser braucht Ober- und Unterseite. |
| aerodesign.de | `clarky.txt`: 2 Koordinatentabellen (Daten von 1928 und 1927) in 1 Datei | Nein. Beide Tabellen werden als 1 Kontur gelesen, die sich selbst kreuzt. Die Tabelle von 1927 im Texteditor löschen; die Tabelle von 1928 lässt sich dann laden. |
| aerodesign.de | „Original“-Koordinaten von HS-0003 und HS-0004 als JPG-Bild (Joint Photographic Experts Group) | Nein (Bild). Die `.dat`-Datei desselben Profils lässt sich laden. |
| mh-aerotools.de | HTML-Seite (HyperText Markup Language) je Profil, z. B. `mh45koo.htm`. 8 von 56 Tabellen stehen in Prozent der Profiltiefe. | Ja: Seite als `.htm` speichern, dann hochladen |
| mh-aerotools.de | XML-Datei je Profil, z. B. `geo_xml/mh45_geo.xml`. 55 von 56 Profilen; keine für MH 57. | Ja |
| UIUC | Selig-`.dat` | Ja. Ausnahmen: 38 von 1665 Dateien ([Einlesetest](#einlesetest)). |

- Die Spalte „In Wingdesigner ladbar“ gilt für die Vorgabe der **Parametrisierung der Profile** (Profile parametrization), **Zentripetal (empfohlen)** (Centripetal (recommended)). **Sehnenlänge** (Chord length) und **Gleichabständig** (Uniform) lehnen mehr Dateien ab ([Einlesetest](#einlesetest)).
- Liegt das größte x über 5 und höchstens bei 110, werden alle Koordinaten durch 100 geteilt. Die Vorschau zeigt dazu die Warnung `Die Koordinaten sehen nach Prozent der Profiltiefe aus und wurden durch 100 geteilt.`

![Vorschau beim Hochladen einer Prozenttabelle: Warnung „Die Koordinaten sehen nach Prozent der Profiltiefe aus und wurden durch 100 geteilt.“, Feld Quelle / Urheber leer, weil der Name „Sample 4412 table“ nicht mit HS oder MH beginnt](images/de/upload-preview.png)

- Formate und Prüfungen: [[Dateiformate|Dateiformate]].

### Datei laden

1. Koordinatendatei auf der Seite herunterladen.
2. **Profile** (Airfoils) > **Hochladen** (Upload): Datei auf die Ablagefläche ziehen oder **Dateien wählen** (Choose files) verwenden.
3. Vorschau und Feld **Quelle / Urheber** (Source / attribution) prüfen, dann **Zum Projekt hinzufügen** (Add to project) klicken.

Über 200 Profilen zeigt die Registerkarte **Prüfungen** (Checks) eine Warnung `Großes Projekt: …`. Sie nennt `N Profile (Warnung über 200)` mit jeder anderen Größe über ihrer Schwelle sowie die erwartete Rechenzeit und den Arbeitsspeicher je Änderung. Steigt die Zahl über 200, zeigt die Kurzmeldung nach **Zum Projekt hinzufügen** auch diese Warnung. Ein Projekt enthält höchstens 10 000 Profile. Bei 10 000 Profilen öffnet **Hochladen** keine Vorschau und zeigt `Das Projekt enthält 10.000 Profile und hat damit die Grenze erreicht; „Unbenutzte entfernen“ schafft Platz.` Ein Profil, das die Punkte aller Projektprofile über 1 000 000 bringt, wird mit `Mit diesem Profil enthalten die Projektprofile N Punkte; die Grenze liegt bei 1.000.000. „Unbenutzte entfernen“ gibt Punkte frei.` abgelehnt.

### Einlesetest

- Datum: 29.09.2026, Code von Commit 89c4f22. Die Testdateien liegen nicht im Repository (Lizenz).
- Stufe 1: Einlesen und Plausibilitätsprüfung (`importAirfoilText` in `src/airfoil/sanity.js`).
- Stufe 2: Kurvenprüfung der Vorschau (`profileProblem` in `src/geom/profile.js`) mit jeder der 3 Optionen von **Einstellungen** (Settings) > **Parametrisierung der Profile**. Die NURBS-Kurve (Non-Uniform Rational B-Spline) durch die Punkte darf sich nicht selbst kreuzen; Kreuzungsschleifen mit einer mittleren Breite (Fläche / Diagonale des Hüllrechtecks) bis 0,0005 der Profiltiefe (0,05 %) werden ignoriert. Keine Profilseite der Kurve darf um mehr als 0,0001 der Profiltiefe (0,01 %) in x zurücklaufen.
- Vorschau und Flügelaufbau verwenden die Parametrisierung des Projekts. Eine Datei lässt sich hinzufügen, wenn sie mit dieser Parametrisierung Stufe 1 und 2 besteht.

| Testmenge | Dateien | Bestehen Stufe 1 | Bestehen Stufe 1 und 2 mit der Vorgabe **Zentripetal (empfohlen)** | Bestehen Stufe 1 und 2 mit **Sehnenlänge** | Bestehen Stufe 1 und 2 mit **Gleichabständig** |
| --- | --- | --- | --- | --- | --- |
| mh-aerotools.de: HTML-Seiten (`*koo.htm`) | 56 | 56 | 56 | 56 | 53 |
| mh-aerotools.de: XML-Dateien (`geo_xml/*_geo.xml`) | 55 | 55 | 55 | 55 | 52 |
| aerodesign.de: alle Dateien unter `/profile/data/` (154 `.dat`, 34 `.txt`) | 188 | 182 | 182 | 178 | 173 |
| aerodesign.de: HS-Dateien (`hs*.dat`, `hs*.txt`; Teil der Zeile darüber) | 43 | 43 | 43 | 43 | 42 |
| UIUC: alle `.dat`-Dateien in `coord_seligFmt.zip` (Stand 23.02.2026) | 1665 | 1632 | 1627 | 1619 | 1563 |
| UIUC: MH-Reihe (`mh*.dat`, Teil der Zeile darüber) | 52 | 51 | 51 | 51 | 48 |

Abgelehnte Dateien mit **Zentripetal (empfohlen)**:

| Dateien | Testmenge | Fehlermeldung |
| --- | --- | --- |
| `naca0009.txt`, `naca63a008.txt`, `naca64a010.txt` | aerodesign.de | `Ober- oder Unterseite hat weniger als 3 Punkte; die Punktreihenfolge ist vermutlich nicht Selig oder Lednicer.` |
| `clarky.txt` | aerodesign.de | `Die Kontur überschneidet sich selbst (3 Kreuzungen).` Außerdem berühren sich Ober- und Unterseite bei x = 0,0 % der Profiltiefe, und die Endleiste ist gekreuzt (Endleistendicke −3,380 % der Profiltiefe). |
| `s3021.dat`, `sd7080.dat` | aerodesign.de und UIUC | `Die Kontur überschneidet sich selbst (1 Kreuzung).` Endleistenmuster unten. |
| `mh150.dat` | UIUC | `Die Kontur überschneidet sich selbst (1 Kreuzung).` Ober- und Unterseite berühren sich bei x = 98,6 % der Profiltiefe. |
| 17 weitere `.dat`-Dateien | UIUC | `Die Kontur überschneidet sich selbst (1 Kreuzung).` Endleistenmuster unten. |
| 13 weitere `.dat`-Dateien | UIUC | Kontur kreuzt sich an anderer Stelle (9 Dateien), Endleiste gekreuzt (3), nur 1 Seite (1) |
| `goe451.dat` | UIUC | Stufe 2: `Die NURBS-Kurve durch die Punkte überschneidet sich selbst nahe x = 2,6 % der Profiltiefe; die Datei hat dort zu wenige Punkte. …` |
| `30p-30n-main.dat`, `30p-30n-slat.dat`, `cap21c.dat`, `rc0864c.dat` | UIUC | Stufe 2: `Die Profilseite läuft in x um … % der Profiltiefe zurück, nahe x = … % der Profiltiefe; …` (0,046 %, 15,924 %, 0,113 %, 0,040 % der Profiltiefe) |

Stufe 2 mit **Sehnenlänge** lehnt 17 Dateien ab (5 Kreuzungen, 12 Rückläufe in x). Stufe 2 mit **Gleichabständig** lehnt 84 Dateien ab (2 Kreuzungen, 82 Rückläufe in x).

Endleistenmuster:

- Bedingung: geschlossene Endleiste, erster Punkt bei x = 1,00000, letzter Punkt bei x = 1,00001, beide bei y = 0.
- Die Prüfung meldet 1 Kreuzung an der Endleiste. 19 der 22 UIUC-Dateien mit diesem Muster werden abgelehnt, z. B. `s3021.dat`, `sd7003.dat`, `sd7080.dat`.
- Abhilfe: das letzte x im Texteditor auf `1.00000` ändern. Ergebnis bei den 19 Dateien: alle 19 bestehen Stufe 1 und 2.

## Quellenangabe

Die Profilvorschau hat das Feld **Quelle / Urheber** (Source / attribution). Die Vorschau öffnet sich bei **Hochladen** (Upload), bei eingefügtem Text, bei **NACA-Generator** (NACA generator) und bei **Bibliothek** (Library).

- Hochgeladene Datei, eingefügter Text, NACA-Profil: Die App füllt das Feld aus dem Profilnamen vor. NACA-Namen ergeben ein leeres Feld.
- Profil eines XFLR5-Projekts (`.xfl`): Der Import speichert eine Quellenangabe aus dem Profilnamen mit derselben Regel. **Anzeigen** (View) im Importdialog zeigt das Feld **Quelle / Urheber** schreibgeschützt.
- Mitgelieferte Bibliotheksdatei: Die App füllt `source.author` aus `index.json` vor.
- Autor, Lizenzkennung und Quelladressen einer Bibliotheksdatei sind Daten: Sie lauten in der deutschen und in der englischen Oberfläche gleich, ebenso `NOTICE.md`. Kategorie und Verwendung jedes Bibliothekseintrags erscheinen in der Sprache der Oberfläche.

| Eingabe | Profilname |
| --- | --- |
| XML-Datei | Element `<name>`. Leer oder fehlend: Dateiname ohne Endung. |
| HTML-Seite | Element `<title>`. Leer oder fehlend: erste nicht numerische Zeile vor der ersten Koordinatenzeile. Keine solche Zeile: Dateiname ohne Endung. |
| Selig, Lednicer, Tabelle | Erste nicht numerische Zeile vor der ersten Koordinatenzeile. Keine solche Zeile: Dateiname ohne Endung. |
| Eingefügter Text ohne Namenszeile | „Eingefügtes Profil“ (englische Oberfläche: `pasted`) |

Beispiel: `HS-1.dat` ohne Namenszeile erhält den Namen `HS-1` und die HS-Vorbelegung.

| Profilname | Beispielnamen | Vorbelegter Text |
| --- | --- | --- |
| `HS`, dann Leerzeichen oder `-` | `HS-1`, `HS 606`, `HS 3,4/12,0` | `Hartmut Siegmann, www.aerodesign.de` |
| `MH`, dann optional Leerzeichen oder `-`, dann eine Ziffer | `MH 45`, `MH45`, `MH 45 Coordinates` | `Martin Hepperle, www.mh-aerotools.de` |
| Jeder andere Name | `Goettingen 795`, `concord`, `HS3.0/8.0` | leer |

Groß- und Kleinschreibung sowie führende Leerzeichen spielen beim Vergleich keine Rolle.

### Gespeichertes Objekt `source`

Jedes Profil im Projekt trägt ein Objekt `source`:

| Herkunft | Felder von `source` |
| --- | --- |
| **NACA-Generator** oder Vorlage aus **Bibliothek** | `kind: "naca"`, `license`, `url` (NACA Report 824 auf ntrs.nasa.gov), `code`, `closedTE`; `attribution`, wenn das Feld nicht leer ist |
| Assistent | `kind: "naca"`, `license`, `url`, `code`, `closedTE` |
| Beispielflügel „Sportflügel 1500“ (englische Oberfläche: „Sport wing 1500“; geladen, wenn der Browserspeicher kein gültiges gespeichertes Projekt enthält) | `kind: "naca"`, `note` |
| Mitgelieferte Bibliotheksdatei | `kind: "library"`, `id`, `attribution` (vorbelegt mit `source.author` aus `index.json`), `license`, `url`, `terms` |
| Hochgeladene Datei | `kind: "upload"`, `file` (Dateiname), `attribution` (leere Zeichenkette, wenn kein Text) |
| Eingefügter Text | `kind: "upload"`; `attribution`, wenn das Feld nicht leer ist |
| Profil eines XFLR5-Projekts (`.xfl`), importiert mit **Öffnen** (Open) | `kind: "xflr5"`, `file` (Name der `.xfl`-Datei), `note` (`Profil „<name>“ aus dem XFLR5-Flugzeug „<plane>“; Grundform ohne Klappenausschlag.` in der Sprache der Oberfläche zum Zeitpunkt des Imports; englische Oberfläche: `Airfoil "<name>" from XFLR5 plane "<plane>"; base shape without flap deflection.`), `attribution` nur, wenn die Namensregel eine ergibt |

Im XFLR5-Import behalten eine hochgeladene `.dat`-Datei, ein Bibliotheksprofil, ein NACA-Profil und ein Profil des aktuellen Projekts ihre eigene `source`.

| Ort | Quellenangabe enthalten |
| --- | --- |
| Liste der Projektprofile (Registerkarte **Profile** (Airfoils)) | Ja, nach der Punktanzahl. NACA-Profile ohne Quellenangabe zeigen „NACA-Gleichungen“ (englische Oberfläche: `NACA equations`); Profile eines XFLR5-Projekts ohne Quellenangabe zeigen `XFLR5: <Datei>` (englische Oberfläche: `XFLR5: <file>`). |
| Projektdatei, JSON (JavaScript Object Notation): **Speichern** (Save) oder **Exportieren** (Export) > **Projekt-JSON** (Project JSON) | Ja |
| Automatische Sicherung im Browserspeicher (Schlüssel `wingdesigner.project.v1`) | Ja |
| `.dat`-Download eines Projektprofils | Nein: nur Namenszeile und Punkte |
| STEP (Standard for the Exchange of Product model data), STL (Stereolithografie), 3MF (3D Manufacturing Format) | Nein |

Die App sendet keine Profildaten an einen Server. Ihre einzigen Netzwerkanfragen für Profile laden `airfoils/index.json` und mitgelieferte Bibliotheksdateien von der eigenen Adresse der App.

### Einschränkungen

- Die Vorbelegung wertet nur den Profilnamen aus. Eine Datei von aerodesign.de oder mh-aerotools.de mit anderem Namen erhält ein leeres Feld. Gemessene Anzahl:
  - MH: 1 von 55 XML-Dateien (`mh55_geo.xml`, Name `concord`), 0 von 56 HTML-Seiten.
  - aerodesign.de: 0 von 43 HS-Dateien (`hs*.dat`, `hs*.txt`).
- Hochgeladene Datei und Bibliothekseintrag: Wird ein vorbelegtes Feld **Quelle / Urheber** geleert, bleibt der vorbelegte Text gespeichert. Zum Ersetzen anderen Text eingeben.
- Eingefügter Text: Wird das Feld geleert, wird keine Quellenangabe gespeichert.
- Nach **Zum Projekt hinzufügen** (Add to project) ist die Quellenangabe in der App schreibgeschützt. **Anzeigen** (View) zeigt sie in einem deaktivierten Feld. Änderungen nur in der Projektdatei (JSON).
- Ohne gespeicherte Quellenangabe zeigt **Anzeigen** die aus dem Namen abgeleitete Vorbelegung (HS/MH-Regel). Dieser Text ist nicht gespeichert.
- Gleicher Name und identische Punkte wie ein Projektprofil, oder erzeugtes NACA-Profil mit demselben `code` und `closedTE` wie ein Projektprofil (Name beliebig): **Zum Projekt hinzufügen** behält den vorhandenen Eintrag und dessen `source`. Die neue Quellenangabe wird verworfen. Die Meldung lautet dann `Das Projekt enthält dieses Profil bereits als „<name>“.` statt `Profil „<name>“ hinzugefügt.` Quellenangabe ändern: Profil entfernen (**×** nur verfügbar, solange kein Schnitt es verwendet) und neu hinzufügen, oder die Projektdatei (JSON) bearbeiten.
- Aus einer XFLR5-Datei importierte Profile: Die Datei nennt weder Urheber noch Lizenz, und die App prüft die Rechte an den Koordinaten nicht. Ein Profil erhält nur dann eine Quellenangabe, wenn sein Name wie in der Tabelle oben mit `HS` oder `MH` beginnt. Wer die Datei importiert, ist für die Rechte an den Profilen in ihr und für die Quellenangabe verantwortlich, die ihre Bedingungen verlangen. Nach dem Import ist die Quellenangabe in der App schreibgeschützt; Änderungen nur in der Projektdatei (JSON).
- Exportierte STEP-, STL-, 3MF- und `.dat`-Dateien enthalten keine Quellenangabe. Die HS-Bedingungen verlangen Namen und Quelle bei jeder Nutzung. CC BY 4.0 (S9104) verlangt eine Quellenangabe bei der Weitergabe; wer eine solche mit S9104 erstellte Datei weitergibt, fügt den Text der Quellenangabe aus `public/airfoils/NOTICE.md` hinzu.

## aerodesign.de (Hartmut Siegmann)

| Punkt | Wert |
| --- | --- |
| Betreiber | Hartmut Siegmann, Zorneding, Deutschland |
| HS-Katalog | <https://aerodesign.de/profile/profile_hs.htm>: 35 HS-Profile für Brettnurflügel, Pfeilnurflügel und Modelle mit Leitwerk |
| Weitere Kataloge | Profile anderer Konstrukteure, mit Quellenangaben |
| Kontakt für Genehmigungen | Per Post, Anschrift auf <https://aerodesign.de/kontakt/kontakt_m.htm>. Anfragen per E-Mail werden nicht beantwortet (Zitat unten). |

Kontaktseite, <https://aerodesign.de/kontakt/kontakt_m.htm>:

> Bei den Modell- und Profildatenbanken könnt ihr meine Profile (HS) und Konstruktionen (æ) für private
> und kleingewerbliche Zwecke genehmigungsfrei verwenden, aber nur unter Angabe meines Namens und Link
> auf aerodesign.de. Die Quellenangabe mit meinem Namen und Link ist die Grundlage für die
> genehmigungsfreie Nutzung. Wer Daten oder Inhalte ohne Quellenangabe oder gewerblich nutzen möchte,
> kann sich gerne schriftlich an mich wenden.
>
> Für andere Konstrukteure und Profilentwickler gilt diese Regelung selbstverständlich nicht. Deren
> Werke sind in meinen Datenbanken zusammengefasst und zum Teil erläutert. Das heißt in dem Fall müsst
> ihr euch die Nutzung von dem betreffenden Urheber genehmigen lassen.

> Die Lebens- und Arbeitszeit eines Menschen ist leider begrenzt, daher beantworte ich derzeit keine
> Anfragen per E-Mail.

HS-Katalogseite, <https://aerodesign.de/profile/profile_hs.htm>:

> Meine Profile dürfen privat, im Vereinsrahmen, kleingewerblich und selbstverständlich wissenschaftlich
> unter Angabe meines Namens und der Quelle »www.aerodesign.de« genehmigungsfrei genutzt werden.
> Großserien oder industrielle Anwendungen erfordern eine schriftliche Nutzungsvereinbarung. Das Recht auf
> Weiterverbreitung durch Dritte ist aufgrund von Verlagsrechten zum Teil eingeschränkt, also solltet ihr
> aus Eigeninteresse Inhalte dieser Seite nicht kopieren, sondern nur auszugsweise zitieren.

Gründe, warum die HS-Profile nicht mitgeliefert werden:

- Die Weiterverbreitung durch Dritte ist durch Verlagsrechte zum Teil eingeschränkt.
- Die Katalogseite bittet, Inhalte nicht zu kopieren und nur auszugsweise zu zitieren.
- `npm run airfoils:check` lehnt Indexeinträge ab, deren Host in `source.url` oder `source.terms` aerodesign.de ist.

## mh-aerotools.de (Martin Hepperle)

| Punkt | Wert |
| --- | --- |
| Betreiber | Martin Hepperle |
| Profilverzeichnis | <https://www.mh-aerotools.de/airfoils/>: 56 MH-Profile |
| Nurflügel (kleines Nickmoment) | MH 44, MH 45, MH 46, MH 49, MH 60, MH 61, MH 62, MH 64 |
| Segelflugmodelle | MH 30, MH 32, MH 42, MH 43 |
| Pylonrenner | 13 Profile von MH 16 bis MH 29 (Glühzündermotor); MH 30 bis MH 34, MH 43 (Elektro) |
| Kontakt für Genehmigungen | E-Mail-Link auf jeder Profilseite |

Fußzeile jeder Profilseite, z. B. <https://www.mh-aerotools.de/airfoils/mh45koo.htm>:

> © 1996-2018 Martin Hepperle\
> You may use the data given in this document for your personal use. If you use this document for a
> publication, you have to cite the source. A publication of a recompilation of the given material is
> not allowed, if the resulting product is sold for more than the production costs.

Übersetzung: © 1996-2018 Martin Hepperle. Die Daten in diesem Dokument dürfen Sie für den persönlichen
Gebrauch verwenden. Wenn Sie dieses Dokument für eine Veröffentlichung verwenden, müssen Sie die Quelle
angeben. Die Veröffentlichung einer Neuzusammenstellung des angegebenen Materials ist nicht erlaubt, wenn
das entstehende Produkt für mehr als die Herstellungskosten verkauft wird.

Gründe, warum die MH-Profile nicht mitgeliefert werden:

- Die Bedingungen erlauben den persönlichen Gebrauch. Eine Erlaubnis zur öffentlichen Weiterverbreitung enthalten sie nicht.
- Das Repository ist öffentlich und steht unter der MIT License (benannt nach dem Massachusetts Institute of Technology). Diese Lizenz erlaubt jedem den Verkauf von Kopien. Der letzte Satz der Bedingungen schließt einen Verkauf über den Herstellungskosten aus.
- `npm run airfoils:check` lehnt Indexeinträge ab, deren Host in `source.url` oder `source.terms` mh-aerotools.de ist.

## UIUC Airfoil Coordinates Database

| Punkt | Wert |
| --- | --- |
| Betreuer | UIUC Applied Aerodynamics Group (Michael Selig) |
| Koordinatenseite | <https://m-selig.ae.illinois.edu/ads/coord_database.html> |
| Inhalt | Etwa 1650 Profile (Version 2.0) vieler Konstrukteure, Selig-`.dat`. Anzahl laut Koordinatenseite; der Hinweis in der App nennt „Etwa 1.600“ (englische Oberfläche: „About 1,600“). |
| Lizenz auf der Koordinatenseite | Keine. Die Fußzeile enthält nur `© 1994 - 2026 UIUC Applied Aerodynamics Group`. |
| GNU General Public License (GPL) | Die Seite der Niedriggeschwindigkeits-Profilmessungen (Windkanal-Leistungsdaten) verlinkt einen GPL-Text für die „airfoil/aircraft data“. Die Koordinatenseite erwähnt die GPL nicht. Ob die GPL die Koordinatendateien abdeckt: nicht angegeben. |
| Bedingungen der Konstrukteure | Gelten für deren Dateien, z. B. die MH-Bedingungen oben. |

## Mitgelieferte Dateien

Quelle, Rechtsgrundlage mit Zitaten, Bedingungen und Text der Quellenangabe je Datei: [NOTICE.md](https://github.com/subtilitas/Wingdesigner/blob/main/public/airfoils/NOTICE.md).
Kategorie und Verwendung je Datei: [[Benutzerhandbuch|Benutzerhandbuch]], Abschnitt Bibliothek.

| Profil | Datei | Quelltabelle | Lizenzkennung | Grundlage (aus NOTICE.md) |
| --- | --- | --- | --- | --- |
| Clark Y | `clark-y.dat` | NACA Report No. 502, Table I (1934); dieselben Ordinaten in NACA Report No. 244 (September 1926) | `public-domain` | Werk der Regierung der Vereinigten Staaten; Schutzfrist in den Vereinigten Staaten abgelaufen |
| NACA 8-H-12 | `naca-8h12.dat` | NACA Technical Note 1998, Table I (Dezember 1949) | `public-domain` | Werk der Regierung der Vereinigten Staaten |
| NACA M-6 | `naca-m6.dat` | NACA Report No. 221, Table XXIX (1926) | `public-domain` | Werk der Regierung der Vereinigten Staaten; Schutzfrist in den Vereinigten Staaten abgelaufen |
| RAF 34 | `raf-34.dat` | RAE-Tabelle in NACA Report No. 286, Reference No. 639 (April 1928) | `public-domain` | Schutzfrist in den Vereinigten Staaten abgelaufen; Tabelle nachgedruckt in einem Werk der Regierung der Vereinigten Staaten |
| S9104 | `s9104.dat` | Datei des Konstrukteurs, <https://m-selig.ae.illinois.edu/uiuc_lsat/s9104/s9104.html> | `CC-BY-4.0` | Lizenz CC BY 4.0 des Konstrukteurs |
| USA 35B | `usa-35b.dat` | NACA Report No. 233, Table XXXVI (1927) | `public-domain` | Werk der Regierung der Vereinigten Staaten; Schutzfrist in den Vereinigten Staaten abgelaufen |

- Status der 5 gemeinfreien Dateien außerhalb der Vereinigten Staaten: nicht geklärt.
- `source.url` der 5 gemeinfreien Dateien verweist auf den Eintrag im NASA Technical Reports Server (NTRS).
- RAF 34: Der Scan der Tabelle ist ein 1-Bit-Bild. 7 Werte sind unsicher, um bis zu 0,20 % der Profiltiefe (Unterseite bei 60 % der Profiltiefe). NOTICE.md führt die 7 Werte und ihre andere mögliche Lesart auf.
- Clark Y und USA 35B behalten die veröffentlichte Basislinie: Die Profilnase liegt 3,50 % bzw. 2,76 % der Profiltiefe über der x-Achse. Die Vorschau zeigt die Warnung `Die Linie von der Profilnase zur Endleiste ist um -1,97 Grad geneigt; …` (USA 35B: -1,51).
- Keine mitgelieferte Datei ist eine Kopie einer Datei aus der UIUC Airfoil Coordinates Database.
- Test am 29.09.2026: Alle 6 Dateien bestehen Stufe 1 und 2 des [Einlesetests](#einlesetest) mit jeder der 3 Optionen von **Parametrisierung der Profile** (Profile parametrization).

Nicht mitgeliefert (Entscheidungen des Eigentümers mit Begründung in [RECORD.md](https://github.com/subtilitas/Wingdesigner/blob/main/RECORD.md)):

| Daten | Lizenz | Grund |
| --- | --- | --- |
| JX-Bibliothek | Creative Commons Attribution-ShareAlike 4.0 (CC BY-SA 4.0) | Share-Alike: nicht unter den 8 zulässigen Lizenzkennungen ([Profil in die Bibliothek aufnehmen](#profil-in-die-bibliothek-aufnehmen)) |
| Mark Drela, Profile DAE und HT | GPL 2.0 oder neuer | Copyleft: nicht unter den 8 zulässigen Lizenzkennungen |
| PROFOIL-Testprofile | MIT License | Allgemeine Entwürfe ohne Polaren (Auftriebs- und Widerstandsdaten) und ohne Flugerfahrung |

## Profil in die Bibliothek aufnehmen

Anforderungen an eine Datei in `public/airfoils/`:

| Regel | Geprüft von `npm run airfoils:check` |
| --- | --- |
| `airfoils` in `public/airfoils/index.json` ist ein Array. | Ja |
| Jeder Eintrag hat eine `id`. Keine 2 Einträge haben dieselbe `id`. | Ja |
| `name`, `file`, `category` vorhanden und nicht leer | Ja |
| `source.author`, `source.license`, `source.url`, `source.terms` vorhanden und nicht leer | Ja |
| `source.license` ist eine von 8 Kennungen: `public-domain`, `CC0-1.0`, `Unlicense`, `CC-BY-4.0`, `CC-BY-3.0`, `MIT`, `BSD-2-Clause`, `BSD-3-Clause` | Ja |
| `source.url` und `source.terms` sind URLs (Uniform Resource Locator). Ihr Host, ohne führendes `www.`, ist weder aerodesign.de noch mh-aerotools.de noch eine Subdomain davon. Sonst Meldung: `<host> grants personal use only.` | Ja |
| `public/airfoils/NOTICE.md` existiert (Index mit mindestens 1 Eintrag) und enthält den `name` des Eintrags. | Ja |
| Die Datei liegt unter `public/airfoils/<file>`. | Ja |
| Die Datei lässt sich einlesen und besteht die Plausibilitätsprüfung ohne Fehler. Warnungen sind zulässig. | Ja |
| Die NURBS-Interpolation durch die Punkte gelingt. Die Kurve kreuzt sich nicht selbst (Kreuzungsschleifen mit einer mittleren Breite, Fläche / Diagonale des Hüllrechtecks, bis 0,0005 der Profiltiefe werden ignoriert) und läuft nicht um mehr als 0,0001 der Profiltiefe in x zurück. Geprüft in der **Vorschau** (Preview) der App mit der **Parametrisierung der Profile** (Profile parametrization) des Projekts. | Nein |
| Jede Datei unter `public/airfoils/` einschließlich Unterordnern, außer `public/airfoils/index.json` und `public/airfoils/NOTICE.md`, hat einen Eintrag. | Ja |
| Die Lizenzkennung entspricht den Bedingungen unter `source.terms`. | Nein (manuelle Prüfung) |
| `use` (optional): Text in **Bibliothek** (Library), durchsucht von **Bibliothek filtern** (Filter library) | Nein |

- Nicht zulässig: Bedingungen für persönlichen Gebrauch, nicht kommerzielle Nutzung, keine Bearbeitungen (no-derivatives), Weitergabe unter gleichen Bedingungen (share-alike) und „erst fragen“ sowie Einzelgenehmigungen.
- CC: Creative Commons. BSD: Berkeley Software Distribution.

```json
{
  "airfoils": [
    {
      "id": "example-12",
      "name": "Example 12",
      "file": "example12.dat",
      "category": "Cambered",
      "use": "Sport wings",
      "source": { "author": "Designer name", "license": "CC0-1.0", "url": "https://example.org/airfoils", "terms": "https://example.org/license" }
    }
  ]
}
```

- „Example 12“ mit Quelle und Lizenz in `public/airfoils/NOTICE.md` aufführen.
- Skript: `scripts/check-airfoils.mjs`. Es erzeugt außerdem die 17 NACA-Vorlagen und führt für jede die Plausibilitätsprüfung der Profile aus.
- Ausgabe mit den 6 mitgelieferten Dateien: `6 bundled airfoils (free licenses only) and 17 NACA presets pass.`
- Bei Fehlern: eine Zeile je Problem, Exit-Code 1.
- CI (Continuous Integration): Workflow `ci.yml`, Job „Lint, unit tests, coverage“, Schritt „Bundled airfoil library“.
- In der App erscheint ein mitgelieferter Eintrag in **Bibliothek** mit Kategorie, Verwendung, Autor und Lizenz. **Vorschau** lädt die Datei von `airfoils/<file>`.
