[English](#english) · [Deutsch](#deutsch)

# Wingdesigner

## English

Wingdesigner is a browser application that lofts one half wing of a radio-controlled (RC) model aircraft through airfoil sections, mirrors it at the plane y = 0 and exports it as STEP (Standard for the Exchange of Product model data), STL (stereolithography), 3MF (3D Manufacturing Format) and JSON (JavaScript Object Notation) files. It also imports the main wing or the horizontal stabilizer from files of XFLR5, a program for the analysis of airfoils and wings.

![Desktop window with the Glider preset: top bar, 3D view, Sections tab, status bar](images/main-desktop.png)

| Resource | Address |
| --- | --- |
| App | <https://subtilitas.github.io/Wingdesigner/> |
| Source code | <https://github.com/subtilitas/Wingdesigner> |

| Page | Content |
| --- | --- |
| [[User Guide]] | Screen layout, import from XFLR5, storage, language, controls, wizard, sections, planform and guide curves, airfoils, settings, checks, export, foam cutting |
| [[Geometry]] | Airfoil curve, chordwise resampling, spanwise stations, guide curves, wing tip, placement of the part, surface, meshes, STEP topology, planform statistics, foam cores |
| [[File Formats]] | Airfoil import and checks, airfoil `.dat` export, project JSON, XFLR5 import (files, mapping to sections, report, limits), STEP, STL, 3MF, foam-cutting files, file sizes |
| [[Airfoil Sources]] | External airfoil sources, their terms of use, attribution, airfoils of imported XFLR5 files, the 62 bundled airfoil files and their legal basis, rules for bundled airfoils |
| [[Development]] | Architecture, commands, unit and browser tests, STEP and 3MF validation, foam-cutting file validation, continuous integration (CI), release |

- The app speaks English or German ([[User Guide]], section Language). The English pages name the interface elements by their English labels. The German pages, listed in the Deutsch section below, name them by their German labels and show screenshots of the German interface.
- The wiki pages are copied from `docs/wiki/` in the repository.
- Direct edits in the wiki are overwritten on the next publish. Pages added in the wiki are deleted.

## Deutsch

Wingdesigner ist eine Browseranwendung, die einen Halbflügel eines ferngesteuerten Flugmodells (RC, radio-controlled) durch Profilschnitte erzeugt, an der Ebene y = 0 spiegelt und in den Formaten STEP (Standard for the Exchange of Product model data), STL (Stereolithografie), 3MF (3D Manufacturing Format) und JSON (JavaScript Object Notation) exportiert. Außerdem importiert sie die Tragfläche oder das Höhenleitwerk aus Dateien von XFLR5, einem Programm zur Analyse von Profilen und Flügeln.

![Desktop-Fenster der deutschen Oberfläche mit dem Entwurfstyp Segelflugmodell: Kopfleiste, 3D-Ansicht, Registerkarte Schnitte, Statusleiste](images/de/main-desktop.png)

| Ressource | Adresse |
| --- | --- |
| App | <https://subtilitas.github.io/Wingdesigner/> |
| Quellcode | <https://github.com/subtilitas/Wingdesigner> |

| Seite | Inhalt |
| --- | --- |
| [[Benutzerhandbuch]] | Bildschirmaufbau, Import aus XFLR5, Speicherung, Sprache, Bedienung, Assistent, Schnitte, Grundriss und Leitkurven, Profile, Einstellungen, Prüfungen, Export, Schaumschnitt |
| [[Geometrie]] | Profilkurve, Neuabtastung in Profiltiefenrichtung, Stationen in Spannweitenrichtung, Leitkurven, Flügelende, Lage des Teils, Fläche, Dreiecksnetze, STEP-Topologie, Grundrisskennwerte, Schaumkerne |
| [[Dateiformate]] | Profilimport und Plausibilitätsprüfungen, Profilexport als `.dat`, Projekt-JSON, XFLR5-Import (Dateien, Abbildung auf Schnitte, Bericht, Grenzen), STEP, STL, 3MF, Schaumschnitt-Dateien, Dateigrößen |
| [[Profilquellen]] | Externe Profilquellen, ihre Nutzungsbedingungen, Quellenangabe, Profile importierter XFLR5-Dateien, die 62 mitgelieferten Profildateien und ihre Rechtsgrundlage, Regeln für mitgelieferte Profile |
| [[Entwicklung]] | Architektur, Befehle, Unit- und Browsertests, STEP- und 3MF-Validierung, Validierung der Schaumschnitt-Dateien, Continuous Integration (CI), Release |

- Die App spricht Englisch oder Deutsch ([[Benutzerhandbuch]], Abschnitt Sprache). Die deutschen Seiten benennen die Bedienelemente mit ihren deutschen Beschriftungen und zeigen Screenshots der deutschen Oberfläche. Die englischen Seiten, im Abschnitt English oben aufgeführt, benennen sie mit ihren englischen Beschriftungen.
- Die Wiki-Seiten werden aus `docs/wiki/` im Repository kopiert.
- Direkte Änderungen im Wiki werden bei der nächsten Veröffentlichung überschrieben. Im Wiki angelegte Seiten werden gelöscht.
