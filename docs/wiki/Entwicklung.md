English: [[Development|Development]]

# Entwicklung

## Architektur

| Eigenschaft | Wert |
| --- | --- |
| Sprache | JavaScript-Module ohne Framework. Build-Ziel ES2022 (ECMAScript 2022); ESLint parst ECMAScript 2024 (`ecmaVersion: 2024`). |
| Build-Werkzeug | Vite `^8.3.1`. Relative Basis `./`, Source Maps. `build.chunkSizeWarningLimit: 900`: Vite warnt, wenn ein Chunk 900 kB überschreitet (Vite-Einheit: 1 kB = 1000 Byte). |
| Laufzeitabhängigkeiten | three.js `^0.186.1`: 3D-Ansicht, nur in `src/ui/viewer3d.js` importiert. fflate `^0.8.3`: ZIP-Container der Dateien im 3D Manufacturing Format (3MF), nur in `src/export/threemf.js` importiert. |
| Node.js | 24 oder neuer (`.nvmrc`: 24; `engines.node`: `>=24`) |
| Unit-Tests | Vitest `^5.0.2` in Node.js; Zeitlimit 20000 ms je Test (`test.testTimeout` in `vite.config.js`); Testabdeckung (Coverage) mit `@vitest/coverage-v8` |
| Browsertests | Playwright `^1.63.0` |
| App-Version | `version` aus `package.json`, von `vite.config.js` als `__APP_VERSION__` einkompiliert. Erscheint im Dialog **Help** (Hilfe). Steht in `generator.version` der Projektdatei (JavaScript Object Notation, JSON). |

Der Code in `src/geom/`, `src/airfoil/`, `src/export/` und `src/model/` nutzt die Programmierschnittstelle (API, Application Programming Interface) des Document Object Model (DOM) nicht.
Unit-Tests und Skripte importieren ihn in Node.js.
`src/airfoil/library.js` lädt `public/airfoils/index.json` mit `fetch`.

| Pfad | Inhalt |
| --- | --- |
| `index.html` | Seitengerüst; lädt `src/main.js` |
| `src/main.js` | Einstieg: Store, Planung der Neuberechnung, Kopfleiste, Statusleiste, Registerkarte **Checks** (Prüfungen), Dialog **Help**, automatisches Speichern |
| `src/geom/`, `src/airfoil/`, `src/export/`, `src/model/`, `src/ui/` | Siehe [Module](#module) |
| `public/airfoils/` | 6 Koordinatendateien (`.dat`, Selig-Format), `index.json` mit 6 Einträgen, `NOTICE.md` (Quelle, Rechtsgrundlage, Bedingungen und Quellenangabe je Datei). Ein Eintrag braucht eine freie Lizenz und eine Zeile in `NOTICE.md` (siehe [Prüfung der Profilbibliothek](#prüfung-der-profilbibliothek)). Die 17 Vorlagen nach National Advisory Committee for Aeronautics (NACA) werden zur Laufzeit berechnet, nicht gespeichert. |
| `scripts/` | Siehe [Skripte](#skripte) |
| `test/` | Vitest-Unit-Tests (`*.test.js`), `helpers.js` (NACA-Beispielprojekt), `step-cases.js` (Testfälle für die Validierung von Dateien im Standard for the Exchange of Product model data (STEP) und von 3MF-Dateien) |
| `e2e/` | Playwright-End-to-End-Tests (E2E) im Browser (`*.spec.js`), `helpers.js` |
| `docs/wiki/` | Wiki-Seiten auf Englisch und Deutsch, `_Sidebar.md`, `images/` |
| `.github/workflows/` | `ci.yml`, `docs.yml`, `release.yml` |

Erzeugt und nicht eingecheckt (`.gitignore`): `dist/`, `coverage/`, `step-check/`, `test-results/`, `playwright-report/`.

### Module

| Datei | Inhalt |
| --- | --- |
| `src/geom/nurbs.js` | Grundfunktionen für Non-Uniform Rational B-Splines (NURBS, nicht-uniforme rationale B-Splines) |
| `src/geom/linalg.js` | Band-LU-Zerlegung (Lower-Upper, untere und obere Dreiecksmatrix) ohne Pivotsuche (B-Spline-Interpolation, verwendet von `src/geom/nurbs.js`); LU-Zerlegung dichter Matrizen mit Spaltenpivotsuche (nur Unit-Tests) |
| `src/geom/profile.js` | Profil als NURBS-Kurve; Neuabtastung in Tiefenrichtung |
| `src/geom/spanwise.js` | Interpolation der Schnittwerte in Spannweitenrichtung (`linear`, `smooth`) |
| `src/geom/guide.js` | Leitkurven (Nasenlinie, Endlinie) |
| `src/geom/wing.js` | Flügel-Loft: `buildWing`; Profil-Cache |
| `src/geom/mesh.js` | Dreiecksnetz, Spiegelung, Volumen, Fläche und Kantenprüfung des Netzes |
| `src/geom/triangulate.js` | Triangulierung der Abschlussflächen: Streifen aus Punktpaaren von Ober- und Unterseite (lineare Laufzeit); Ear Clipping als Rückfallverfahren |
| `src/geom/stats.js` | Grundrisskennwerte |
| `src/airfoil/parse.js` | Parser für Profildateien |
| `src/airfoil/geometry.js` | Polyliniengeometrie |
| `src/airfoil/sanity.js` | Plausibilitätsprüfung, `importAirfoilText` |
| `src/airfoil/naca.js` | Generator für 4- und 5-stellige NACA-Profile |
| `src/airfoil/library.js` | 17 NACA-Vorlagen, mitgelieferte Bibliothek, externe Quellen |
| `src/export/step.js` | STEP-Export; Dateiformat nach International Organization for Standardization (ISO) 10303-21 |
| `src/export/stl.js` | Export als binäres STL (Stereolithografie) |
| `src/export/threemf.js` | 3MF-Export |
| `src/model/project.js` | Projektmodell, Vorgaben, Grenzen, Validierung |
| `src/model/io.js` | Import und Export der Projekt-JSON |
| `src/model/edit.js` | Bearbeitungsoperationen |
| `src/model/wizard.js` | Vorlagen und Wertebereiche des Assistenten |
| `src/model/defaults.js` | Projekt beim ersten Laden |
| `src/ui/store.js` | Store mit Rückgängig und Wiederholen |
| `src/ui/viewer3d.js` | 3D-Ansicht |
| `src/ui/panzoom.js` | 2D-Canvas mit Verschieben und Zoom |
| `src/ui/sections.js` | Registerkarte **Sections** (Profilschnitte) |
| `src/ui/planform.js` | Registerkarte **Planform** (Grundriss) |
| `src/ui/airfoils.js` | Registerkarte **Airfoils** (Profile), Vorschau beim Hochladen |
| `src/ui/settings.js` | Registerkarte **Settings** (Einstellungen) |
| `src/ui/wizard.js` | Dialog des Assistenten |
| `src/ui/exportui.js` | Dialog **Export** |
| `src/ui/dom.js` | DOM-Hilfsfunktionen |
| `src/ui/styles.css` | Stile |

### Skripte

| Skript | Inhalt |
| --- | --- |
| `scripts/coverage-readme.mjs` | Tabelle der Testabdeckung in beiden READMEs |
| `scripts/check-airfoils.mjs` | Prüfung der Profilbibliothek |
| `scripts/export-step-cases.mjs` | Export der STEP- und 3MF-Testfälle |
| `scripts/validate_step.py` | STEP-Validierung (OpenCascade) |
| `scripts/validate_3mf.py` | 3MF-Validierung (lib3mf) |
| `scripts/screenshots.mjs` | Screenshots für das Wiki |
| `scripts/check-docs.mjs` | Dokumentationsprüfung |

### Datenfluss

1. Eine Registerkarte (Klasse in `src/ui/`) ruft `store.update(mutate, { key })` auf.
   Der Store legt das vorherige Projekt auf den Rückgängig-Stapel und leert den Wiederholen-Stapel.
   Der Rückgängig-Stapel fasst höchstens 100 Schritte. Rückgängig- und Wiederholen-Stapel zusammen fassen höchstens 64 000 000 Zeichen serialisiertes Projekt (JSON). Darüber werden zuerst die ältesten Rückgängig-Schritte verworfen, dann die vom aktuellen Projekt am weitesten entfernten Wiederholen-Schritte. Der neueste Schritt jedes Stapels bleibt.
   Aufeinanderfolgende Änderungen mit demselben Schlüssel, jede weniger als 800 ms nach der vorigen, bilden einen Rückgängig-Schritt, z. B. das Ziehen eines Punkts.
2. Der Store benachrichtigt seine Abonnenten.
   `main.js` plant höchstens 1 Neuberechnung im nächsten Animations-Frame; weitere Benachrichtigungen davor nutzen dieselbe.
3. Die Neuberechnung ruft `buildWing(project)` auf.
   Sie aktualisiert die 3D-Ansicht, **Sections**, **Planform**, **Checks** und die Statusleiste.
   **Airfoils** und **Settings** werden bei jeder Änderung außer einer Auswahländerung erneut aufgebaut.
4. Nach einer Änderung, die keine Auswahländerung ist, speichert die Neuberechnung das Projekt im lokalen Speicher des Browsers (Local Storage), wenn `validateProject` es akzeptiert.
   Ein ausstehendes Speichern wird bei `pagehide` und beim Verbergen der Seite (`visibilitychange`) sofort ausgeführt, z. B. bei einem Neuladen vor dem nächsten Animations-Frame.
   Solange der Assistent des ersten Aufrufs offen ist, wird nichts gespeichert; ein Neuladen öffnet dann erneut den Assistenten.
   **Skip (open sample wing)** speichert den Beispielflügel; **Create design** speichert das erzeugte Projekt.

| Schlüssel im lokalen Speicher | Inhalt |
| --- | --- |
| `wingdesigner.project.v1` | Letztes gültiges Projekt (JSON) |
| `wingdesigner.project.v1.rejected` | Kopie eines gespeicherten Projekts, das sich nicht laden ließ. Die App startet dann wie beim ersten Besuch, mit dem Assistenten. |
| `wingdesigner.tab` | Aktive Registerkarte |

### Build- und Exportzeiten

| Bedingung | Wert |
| --- | --- |
| Rechner | Node.js 24.21; Hauptprozessor (CPU, Central Processing Unit) Intel Xeon x86-64, 2,10 GHz, 4 Kerne; Load Average 3,3 (andere Prozesse liefen) |
| Datum | 29.09.2026 |
| Eingabe | `wizardProject(PRESETS.<preset>.params)`, `settings.chordSamples` auf die Stationszahl gesetzt |
| Funktionen | `buildWing(project)`, `exportMeshes(build, 'merged')`, `wingToStep(build, { mirror: true })` |
| Cache | `buildWing` speichert die Profilstufe (Plausibilitätsprüfungen, NURBS-Kurve, Kreuzungs- und Rücklauftest, Neuabtastung) je Punktliste des Profils, Parametrisierung und Stationszahl zwischen. Der Cache behält die zuletzt verwendeten Einträge: mindestens 32 und mindestens 1 je Profil, das die Schnitte verwenden (`src/geom/wing.js`). |
| Aufbau | Jedes Profil ist im Cache (gefüllt durch die Aufwärmläufe) |
| Lauf | 1 Aufruf der Funktion |
| Wiederholung | Mittelwert aus 10 Läufen nach 2 Aufwärmläufen; STEP schreiben: Mittelwert aus 3 Läufen |
| Einheit | KB = 1024 Byte |

| Fall | **Chordwise stations per surface** (Stationen je Profilseite) | `buildWing`, Profile im Cache | Dreiecksnetz (zusammengeführt) | STEP schreiben | STEP-Größe |
| --- | ---: | ---: | ---: | ---: | ---: |
| Vorlage **Sport** (Sportmodell), 2 Schnitte | 60 | 17 ms | 1 ms | 3 ms | 99 KB |
| Vorlage **Sport** (Sportmodell), 2 Schnitte | 200 | 40 ms | 1 ms | 4 ms | 303 KB |
| Vorlage **Glider** (Segelflugmodell), elliptische Leitkurven, 17 Stationen in Spannweitenrichtung | 60 | 36 ms | 12 ms | 6 ms | 445 KB |
| Vorlage **Glider** (Segelflugmodell), elliptische Leitkurven, 17 Stationen in Spannweitenrichtung | 200 | 89 ms | 42 ms | 19 ms | 1398 KB |

Viele Schnitte: **Smooth**, **Spanwise stations per panel with guides or smooth mode** (Stationen je Feld) 40, **Chordwise stations per surface** 200; Node.js 24, Load Average 3,3 (andere Prozesse liefen).

| Fall | Stationen in Spannweitenrichtung nach der Gittergrenze | `buildWing` |
| --- | ---: | ---: |
| 20 Schnitte | 400 (21 je Feld) | 0,8 s |
| 200 Schnitte | 399 (2 je Feld) | 2,0 s |

- Gittergrenze: höchstens 160 000 Gitterpunkte (Stationen in Spannweitenrichtung × (2N + 1) Profilpunkte, N = **Chordwise stations per surface**) vor dem Einfügen zusätzlicher Stationen (`MAX_GRID_POINTS` in `src/geom/wing.js`). Darüber verwendet der Aufbau weniger Stationen je Feld und gibt eine Warnung aus.
- Anordnung der Schnitte, Zustand des Profil-Cache und Anzahl der Läufe dieser 2 Messungen: nicht festgehalten.

Rechenzeit ohne Profile im Cache: in diesem Lauf nicht gemessen.
Rechenzeit und Speicherbedarf auf Smartphones: nicht gemessen.

## Regeln für Testdaten

| Daten | Herkunft |
| --- | --- |
| Profile in Unit-Tests sowie STEP- und 3MF-Testfällen | Aus den NACA-Gleichungen berechnet: `nacaAirfoil()` aus `src/airfoil/naca.js`, `naca()` aus `test/helpers.js` |
| Eingaben der Parser-Tests | Kurze synthetische Zeichenketten in `test/airfoil.test.js` in den Dateiformaten fremder Quellen, mit erfundenen Koordinaten |
| Hochladen in Browsertests | In den Spec-Dateien erzeugt, keine Daten Dritter: `.dat`-Datei mit 13 Punkten in `e2e/smoke.spec.js` und `e2e/mobile-layout.spec.js`; Selig, Lednicer, X/Yo/Yu-Prozenttabelle mit Dezimalkomma und ungültige Dateien (sich kreuzende Profilseiten, Text) aus den Gleichungen der 4-stelligen NACA-Profile in `e2e/airfoils.spec.js` |
| Mitgelieferte Bibliothek in Browsertests | `e2e/airfoils.spec.js` listet die 6 Dateien aus `public/airfoils/` auf und fügt S9104 dem Projekt hinzu |
| Hochladen für Screenshots | NACA 4412, berechnet in `scripts/screenshots.mjs`, 14 x-Positionen von 0 bis 100 %, als X/Yo/Yu-Prozenttabelle mit Dezimalkomma |

Profildateien Dritter werden nur unter einer Lizenz aus der Zeile Lizenz in [Prüfung der Profilbibliothek](#prüfung-der-profilbibliothek) eingecheckt.
Quellen: [[Profilquellen|Profilquellen]].
Einlesetest außerhalb des Repositorys am 29.09.2026: 1964 Dateien Dritter von aerodesign.de, mh-aerotools.de und UIUC (University of Illinois Urbana-Champaign). Ergebnisse je Testmenge: [[Profilquellen|Profilquellen]], Abschnitt Einlesetest.

## Befehle

Einrichtung: `npm ci`. Voraussetzung: Node.js 24 oder neuer (`.nvmrc`: 24).
Browsertests und Screenshots brauchen zusätzlich Chromium: `npx playwright install chromium` (Linux-Systembibliotheken: `--with-deps`) oder `PW_CHROMIUM` mit dem Pfad zu einem lokalen Chromium.

| Befehl | Führt aus | Ergebnis |
| --- | --- | --- |
| `npm run dev` | `vite` | Entwicklungsserver unter `http://localhost:5173` (nächster freier Port, wenn 5173 belegt ist) |
| `npm run build` | `vite build` | Statische Website in `dist/` |
| `npm run preview` | `vite preview` | Liefert `dist/` unter `http://localhost:4173` aus (nächster freier Port, wenn 4173 belegt ist) |
| `npm run lint` | `eslint .` | Lint-Fehler; Exit-Code 1 bei Fehlern |
| `npm test` | `vitest run` | Unit-Tests `test/**/*.test.js` in Node.js: 182 Tests in 7 Dateien |
| `npm run test:watch` | `vitest` | Unit-Tests, erneuter Lauf bei Dateiänderung |
| `npm run coverage` | `vitest run --coverage` | Tabelle im Terminal, `coverage/coverage-summary.json`, Bericht im Format HyperText Markup Language (HTML) in `coverage/`. Erfasst `src/**/*.js` ohne `src/ui/` und `src/main.js`. |
| `npm run coverage:readme` | `node scripts/coverage-readme.mjs` | Schreibt die Tabelle der Testabdeckung in `README.md` und `README.de.md` zwischen `<!-- coverage:start -->` und `<!-- coverage:end -->` |
| `npm run coverage:check` | `node scripts/coverage-readme.mjs --check` | Exit-Code 1, wenn eine README-Tabelle von `coverage/coverage-summary.json` abweicht; Exit-Code 2, wenn diese Datei oder eine Markierung fehlt |
| `npm run airfoils:check` | `node scripts/check-airfoils.mjs` | Prüfungen unter [Prüfung der Profilbibliothek](#prüfung-der-profilbibliothek); Exit-Code 1 bei einem Problem |
| `npm run e2e` | `npm run build && playwright test` | Browsertests in `e2e/` gegen `vite preview` auf Port 4173 |
| `npm run step:cases` | `node scripts/export-step-cases.mjs step-check` | 8 STEP-Dateien, 8 3MF-Dateien und `cases.json` in `step-check/` |
| `npm run screenshots` | `node scripts/screenshots.mjs` | 12 Dateien im Format Portable Network Graphics (PNG) in `docs/wiki/images/` |
| `npm run docs:check` | `node scripts/check-docs.mjs` | Dokumentationsprüfung; Exit-Code 1 bei einem Problem |

| Umgebungsvariable | Genutzt von | Wirkung |
| --- | --- | --- |
| `PW_CHROMIUM` | `npm run e2e`, `npm run screenshots` | Pfad zu einem lokalen Chromium statt des Playwright-Downloads |
| `SHOT_DIR` | `e2e/smoke.spec.js` | Verzeichnis für die Screenshots des Smoke-Tests `<project>-wizard.png`, `<project>-main.png`, `<project>-planform.png`, `<project>-upload.png`; `<project>` ist `desktop` oder `mobile` |

### Prüfung der Profilbibliothek

`npm run airfoils:check` liest `public/airfoils/index.json` (Array `airfoils`, 6 Einträge).
Das Skript gibt jedes Problem aus und endet mit Exit-Code 1, wenn mindestens 1 Prüfung fehlschlägt.

| Prüfung | Bestanden, wenn |
| --- | --- |
| Index | `airfoils` ist ein Array |
| Pflichtfelder | `id` (eindeutig), `name`, `file`, `category`, `source.author`, `source.license`, `source.url`, `source.terms` |
| Lizenz | `source.license` ist eine von `public-domain`, `CC0-1.0`, `Unlicense`, `CC-BY-4.0`, `CC-BY-3.0`, `MIT`, `BSD-2-Clause`, `BSD-3-Clause` |
| Quell-Host | `source.url` und `source.terms` sind Adressen im Format Uniform Resource Locator (URL); Host ist nicht `aerodesign.de`, `mh-aerotools.de` oder eine Subdomain davon (Nutzungsbedingungen: nur private Nutzung) |
| Datei | `public/airfoils/<file>` existiert und lässt sich fehlerfrei importieren |
| Hinweisdatei | Bei mindestens 1 Eintrag: `public/airfoils/NOTICE.md` existiert und enthält den `name` jedes Eintrags |
| Keine Datei ohne Eintrag | Jede Datei in `public/airfoils/` außer `index.json` und `NOTICE.md` hat einen Eintrag |
| NACA-Vorlagen | Alle 17 NACA-Vorlagen bestehen `checkAirfoil` |

### Browsertests

| Einstellung (`playwright.config.js`) | Wert |
| --- | --- |
| Projekte | `desktop`: Desktop Chrome, 1280 x 720 CSS-Pixel (Cascading Style Sheets). `mobile`: Pixel 7, 412 x 839 CSS-Pixel, Geräteskalierung 2,625, Touch-Eingabe. |
| Server | `npm run preview -- --port 4173 --strictPort`; jeder Lauf startet einen eigenen Server (`reuseExistingServer: false`) |
| Zeitlimits | 60000 ms je Test, 60000 ms für den Serverstart |
| Wiederholungsversuche | 0 |

125 Tests in 9 Spec-Dateien, 250 Läufe (beide Projekte). Das Objekt `test` aus `e2e/helpers.js` lässt einen Test bei jedem nicht abgefangenen Seitenfehler und jedem Konsolenfehler fehlschlagen.

30 Tests laufen nur in einem Projekt (`test.skip` im anderen Projekt):

| Spec-Datei | nur `desktop` | nur `mobile` |
| --- | --- | --- |
| `e2e/mobile-layout.spec.js` | 1: Schnitttabelle, Markenname, Kopfleiste in 1 Zeile | 17: jeder Test in `phone layout` (kein seitliches Scrollen, Kopfleiste, Tippflächen, Schnittkarten, Hinweis zur Randtiefe, 360 px breites Smartphone, Dialoge im Hoch- und Querformat) |
| `e2e/viewer.spec.js` | 3: Drehen per Maus-Ziehen, Verschieben per Ziehen mit rechter Maustaste, Zoom per Mausrad | 4: Drehen mit einem Finger, Verschieben mit zwei Fingern, Pinch-Zoom mit zwei Fingern, **Enlarge** (Vergrößern) |
| `e2e/planform.spec.js` | 1: Zoom-Schaltflächen, Mausrad, Doppelklick zum Einpassen | 2: Ziehen eines Leitkurvenpunkts mit einem Finger, Pinch-Zoom mit zwei Fingern |
| `e2e/sections.spec.js` | 2: Strg+Z und Strg+Umschalt+Z, Strg+Y | 0 |

Kein Test ist mit `test.fail` markiert.
`npm run e2e` baut `dist/` vorher neu; vor einem direkten `npx playwright test` `npm run build` ausführen.

### STEP- und 3MF-Validierung

Python: 3.12 im Job `step` von `ci.yml`; andere Versionen nicht getestet.

```bash
pip install cadquery-ocp==8.0.1.0.0 lib3mf==2.5.0   # Python-Anbindung von OpenCascade 8, Bibliothek des 3MF Consortium
npm run step:cases
python scripts/validate_step.py step-check/cases.json
python scripts/validate_3mf.py step-check/cases.json
```

`cases.json` enthält je Testfall: STEP-Datei, 3MF-Datei, erwartete Volumen, Toleranz `5e-4`, Dreieckszahl je Netzobjekt.
Erwartetes Volumen: Volumen des Dreiecksnetzes des Halbflügels `tessellateHalf(build, { uRefine: 4, vRefine: 8 })`; jedes Intervall in Tiefenrichtung ist 4-fach, jedes Intervall in Spannweitenrichtung 8-fach unterteilt.
Beide Skripte geben einen JSON-Bericht aus.

| STEP-Prüfung je Datei (`validate_step.py`) | Bestanden, wenn |
| --- | --- |
| Lesen | Der STEP-Reader liefert `IFSelect_RetDone` |
| Anzahl Volumenkörper | Gleich der erwarteten Anzahl: 2 bei Spiegelung, 1 beim Halbflügel |
| Gültigkeit der Randdarstellung (B-rep, Boundary Representation) | `BRepCheck_Analyzer` meldet gültig |
| Hülle | Geschlossen und einheitlich orientiert: keine freien Kanten |
| Volumen | Größer als 0; relative Abweichung vom erwarteten Volumen höchstens `5e-4` (0,05 %) |

Exit-Code 1, wenn eine Prüfung fehlschlägt.

| 3MF-Prüfung je Datei (`validate_3mf.py`) | Bestanden, wenn |
| --- | --- |
| Lesen | Lesen im strikten Modus (`SetStrictModeActive`), 0 Warnungen |
| Objekte | 1 Netzobjekt je erwarteter Hülle mit der erwarteten Dreieckszahl: 2 bei Spiegelung (Exportmodus `halves`), 1 beim Halbflügel (Exportmodus `right`) |
| Topologie | Jedes Objekt besteht `IsManifoldAndOriented` |

Exit-Code 1, wenn eine Prüfung fehlschlägt oder `cases.json` keinen 3MF-Testfall enthält.

Testfälle aus `test/step-cases.js`. Basisflügel (`sampleProject()` in `test/helpers.js`):

| Schnitt | y (mm) | x (mm) | z (mm) | Profiltiefe (mm) | Schränkung (°) | Profil |
| ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | 0 | 0 | 0 | 200 | 0 | NACA 2412 |
| 2 | 300 | 20 | 10 | 170 | −1 | NACA 2412 |
| 3 | 600 | 60 | 30 | 110 | −3 | NACA 0010 |

x und z: Lage der Profilnase.

| Fall | Abweichung vom Basisflügel | Volumenkörper |
| --- | --- | ---: |
| `open-te-linear` | Keine: Endleiste wie im Profil (offen), lineare Interpolation | 2 |
| `closed-te-smooth` | Geschlossene Endleiste, glatte Interpolation | 2 |
| `guided-elliptic` | Nasenlinie und Endlinie mit je 4 Punkten; Endleistendicke 0,5 mm | 2 |
| `root-offset-half` | Alle Schnitte um +35 mm in y verschoben (Wurzel bei y = 35 mm); nicht gespiegelt | 1 |
| `reflex-closed` | NACA 23112 (S-Schlag) an den Schnitten 1 und 2, NACA 0008 am Rand; geschlossene Endleiste | 2 |
| `pointed-tip` | Spitzer Rand, Verhältnis 0,002 (1/500); Endleistendicke 0,4 mm | 2 |
| `pointed-elliptic-closed` | Spitzer Rand, Verhältnis 0,005 (1/200); Nasenlinie und Endlinie treffen sich bei x = 115 mm, y = 600 mm; geschlossene Endleiste | 2 |
| `symmetric-0009` | NACA 0009 an jedem Schnitt | 2 |

## Dokumentation

| Englisch | Deutsch |
| --- | --- |
| `README.md` | `README.de.md` |
| `Home.md` (beide Sprachen) | `Home.md` (beide Sprachen) |
| `User-Guide.md` | `Benutzerhandbuch.md` |
| `Geometry.md` | `Geometrie.md` |
| `File-Formats.md` | `Dateiformate.md` |
| `Airfoil-Sources.md` | `Profilquellen.md` |
| `Development.md` | `Entwicklung.md` |

Die Wiki-Seiten liegen in `docs/wiki/`.
Der Docs-Workflow spiegelt `docs/wiki/` mit `rsync --delete` ins Repository-Wiki.
Beim nächsten Lauf werden im Wiki bearbeitete Seiten überschrieben und dort angelegte Seiten gelöscht.

| Datei im Repository (nur Englisch) | Inhalt |
| --- | --- |
| [RECORD.md](https://github.com/subtilitas/Wingdesigner/blob/main/RECORD.md) | Verifizierter Stand, Entscheidungen mit Begründung, Messungen, offene Punkte |
| [CHANGELOG.md](https://github.com/subtilitas/Wingdesigner/blob/main/CHANGELOG.md) | Versionshistorie |

### Screenshots

`npm run screenshots` erzeugt alle Bilder in `docs/wiki/images/` erneut.
Das Skript baut die Website, liefert sie auf Port 4175 aus und steuert Chromium mit Playwright.
Desktop: 1280 x 800 CSS-Pixel, Geräteskalierung 1. Smartphone: Pixel 7, Geräteskalierung 2,625. Helles Farbschema.

| Datei | Zustand | Größe (Pixel) |
| --- | --- | --- |
| `wizard.png` | Assistent, Vorlage **Glider** | 960 x 784 |
| `main-desktop.png` | Ganzes Fenster nach dem Anlegen des **Glider** | 1280 x 800 |
| `sections.png` | Registerkarte **Sections**, **Glider**, 3 Schnitte | 600 x 730 |
| `planform.png` | Registerkarte **Planform**, **Glider**, Nasenlinie und Endlinie eingeschaltet | 600 x 730 |
| `airfoils.png` | Registerkarte **Airfoils**, **Glider** | 600 x 730 |
| `upload-preview.png` | Vorschau beim Hochladen einer synthetischen X/Yo/Yu-Prozenttabelle mit Dezimalkomma, geöffnet über dem **Glider** | 640 x 646 |
| `export-dialog.png` | Dialog **Export**, **Glider** | 640 x 476 |
| `settings.png` | Registerkarte **Settings**, **Glider** | 600 x 730 |
| `checks.png` | Registerkarte **Checks**, **Glider** | 600 x 730 |
| `flying-wing-control-net.png` | 3D-Ansicht, **Swept flying wing** (Pfeilnurflügel), **Show NURBS control net** (Kontrollnetz zeigen) an | 680 x 730 |
| `mobile-main.png` | Smartphone, Vorlage **Sport** | 1082 x 2202 |
| `mobile-planform.png` | Smartphone, **Planform**, **Sport**, Endlinie eingeschaltet | 1082 x 2202 |

### Dokumentationsprüfung

`npm run docs:check` prüft `docs/wiki/*.md`, `README.md` und `README.de.md`:

| Prüfung | Schlägt fehl, wenn |
| --- | --- |
| Seitenpaare | Eine Datei der 6 englisch-deutschen Paare oben fehlt (`Home.md` ausgenommen) |
| Markierungen der Testabdeckung | `README.md` oder `README.de.md` enthält `<!-- coverage:start -->` oder `<!-- coverage:end -->` nicht |
| Wiki-Links | Die Zielseite eines Wiki-Links (doppelte eckige Klammern) hat keine Datei in `docs/wiki/` |
| Bilder | Eine eingebundene Bilddatei fehlt oder ihr Alternativtext ist leer |
| Relative Links | Das Ziel eines relativen Markdown-Links existiert nicht |

Pfade gelten relativ zu `docs/wiki/` für Wiki-Seiten und relativ zum Repository-Stamm für die READMEs.
Nicht geprüft: Sprachumschaltzeile, Sprache des Alternativtexts, Sprache des Linkziels, Linkanker (`#…`), externe Links (`http:`, `https:`, `mailto:`).

## Continuous Integration (CI)

Plattform: GitHub Actions, Runner `ubuntu-latest` für jeden Job.

| Workflow | Auslöser | Berechtigungen | Inhalt |
| --- | --- | --- | --- |
| `ci.yml` | Push auf `main`, Pull Request, manuell | Workflow: `contents: read`; Jobs `build` und `deploy`: siehe nächste Tabelle | Jobs in der nächsten Tabelle. Concurrency-Gruppe `ci-<Ref>`. Auf `main` wird ein aktiver Lauf nicht abgebrochen. Höchstens 1 späterer Lauf wartet; ein neuerer Lauf ersetzt den wartenden. Auf anderen Refs bricht ein späterer Lauf den aktiven ab. |
| `docs.yml` | Push auf `main` mit Änderungen in `docs/wiki/**` oder `.github/workflows/docs.yml`; manuell | `contents: write` | Job `wiki`: klont `<repository>.wiki.git` mit `GITHUB_TOKEN`, kopiert `docs/wiki/` mit `rsync --delete`, committet `Update wiki from <erste 7 Zeichen des Commit-Hashes>` und pusht. Ohne Änderung kein Commit. Concurrency-Gruppe `wiki`: ein aktiver Lauf wird nicht abgebrochen. |
| `release.yml` | Push eines Tags `v*` | `contents: write` | Job `release`: Schritte unter [Release](#release) |

Gemeinsame Schritte der Jobs in `ci.yml` außer `deploy` und des Jobs in `release.yml`: Repository auschecken, Node.js aus `.nvmrc` mit npm-Cache einrichten, `npm ci` ausführen.
Der Job `wiki` in `docs.yml` checkt nur aus.

| Job in `ci.yml` | Name | Schritte | Berechtigungen | Läuft bei |
| --- | --- | --- | --- | --- |
| `test` | Lint, unit tests, coverage | `lint`, `coverage`, `coverage:check`, `airfoils:check`, `docs:check`; lädt Artefakt `coverage` hoch | `contents: read` | Jedem Auslöser |
| `step` | STEP and 3MF validation (OpenCascade, lib3mf) | Python 3.12, `pip install cadquery-ocp==8.0.1.0.0 lib3mf==2.5.0`, `step:cases`, `validate_step.py`, `validate_3mf.py`; lädt Artefakt `step-files` hoch (STEP, 3MF, `cases.json`) | `contents: read` | Jedem Auslöser |
| `e2e` | Browser tests (Playwright) | `npx playwright install --with-deps chromium`, `npm run e2e` (Build, dann alle Specs in `e2e/`, beide Projekte); bei einem Fehlschlag Upload des Artefakts `playwright-results` (`test-results/`) | `contents: read` | Jedem Auslöser |
| `build` | Build site | `build`; bei Push auf `main` zusätzlich `configure-pages` und `upload-pages-artifact` mit `dist/` | `contents: read`, `pages: read` | Jedem Auslöser |
| `deploy` | Deploy to GitHub Pages | `deploy-pages` in die Umgebung `github-pages`. Concurrency-Gruppe `pages`: ein aktiver Lauf wird nicht abgebrochen. | `pages: write`, `id-token: write` | Push auf `main`, nachdem `test`, `step`, `e2e` und `build` bestanden sind |

Die Artefakte `coverage` und `step-files` werden auch bei einem fehlgeschlagenen Schritt hochgeladen, `playwright-results` nur bei einem fehlgeschlagenen Schritt. Alle 3 werden 14 Tage aufbewahrt.
Der Schlüssel des pip-Caches ist `pip-ocp-<Runner-Betriebssystem>-8.0.1-lib3mf-2.5.0`.

| Action | Version | Verwendet in |
| --- | --- | --- |
| `actions/checkout` | `v7` | `ci.yml`, `docs.yml`, `release.yml` |
| `actions/setup-node` | `v7` | `ci.yml`, `release.yml`; Node.js-Version aus `.nvmrc`, npm-Cache |
| `actions/setup-python` | `v7` | `ci.yml` Job `step` |
| `actions/cache` | `v6` | `ci.yml` Job `step` (`~/.cache/pip`) |
| `actions/upload-artifact` | `v7` | `ci.yml` Jobs `test`, `step`, `e2e` |
| `actions/configure-pages` | `v6` | `ci.yml` Job `build` |
| `actions/upload-pages-artifact` | `v5` | `ci.yml` Job `build` |
| `actions/deploy-pages` | `v5` | `ci.yml` Job `deploy` |

Alle aufgeführten Actions laufen auf Node.js 24 (`runs.using: node24`); `upload-pages-artifact` ist eine Composite Action auf Basis von `upload-artifact@v7`.

Die CI ändert die Tabellen der Testabdeckung in den READMEs nicht.
Aktualisieren mit `npm run coverage && npm run coverage:readme`, dann beide READMEs committen.

Nicht verifiziert: Für den Job `deploy` und für `docs.yml` ist kein Lauf auf `main` belegt.
Das Klonen in `docs.yml` setzt ein vorhandenes Repository-Wiki voraus; GitHub legt es mit der ersten Seite an, die in der Weboberfläche gespeichert wird.

## Release

`<version>`: die zu veröffentlichende Version, z. B. `0.2.0`. `package.json` enthält `0.1.0`.

1. Version setzen: `npm version <version> --no-git-tag-version` (ändert `package.json` und `package-lock.json`).
2. In `CHANGELOG.md` die Einträge unter `## [Unreleased]` unter eine Überschrift `## [<version>] - YYYY-MM-DD` verschieben.
3. Committen und nach `main` mergen. Warten, bis `ci.yml` bestanden ist.
4. Tag setzen und pushen: `git tag v<version> && git push origin v<version>`.

Danach läuft `release.yml`:

| Schritt | Schlägt fehl oder erzeugt |
| --- | --- |
| Tag-Prüfung | Schlägt fehl, wenn das Tag nicht `v` + `version` aus `package.json` ist |
| `npm run lint`, `npm test`, `npm run build` | Schlägt fehl bei Lint-Fehler, fehlgeschlagenem Test oder Build-Fehler |
| Paket | `wingdesigner-<tag>-site.zip` mit dem Inhalt von `dist/` |
| GitHub-Release | Titel `Wingdesigner <tag>`, die ZIP-Datei als Anhang. Release-Notes: der Abschnitt von `CHANGELOG.md` ab `## [<version>]` bis zur nächsten Überschrift `## `; `See CHANGELOG.md.`, wenn der Abschnitt fehlt. |

`release.yml` führt keine Prüfung der Testabdeckung, keine Prüfung der Profilbibliothek, keine Dokumentationsprüfung, keine STEP-Validierung, keine 3MF-Validierung und keine Browsertests aus.
