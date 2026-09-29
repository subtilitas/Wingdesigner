Deutsch: [[Profilquellen|Profilquellen]]

# Airfoil sources

Summary of published terms of use, not legal advice. Quotes checked against the live pages on 2026-09-29.

## Overview

| Source | Terms (summary) | Bundled | Use in Wingdesigner |
| --- | --- | --- | --- |
| NACA (National Advisory Committee for Aeronautics) 4- and 5-digit equations, NACA Report 824 (Abbott, von Doenhoff, Stivers, 1945) | Published equations. The app computes the coordinates and copies no coordinate file. | Generated in the browser | 17 presets in **Library**, **NACA generator**, wizard |
| NACA report tables: Clark Y (NACA Report No. 502), USA 35B (Report No. 233), NACA M-6 (Report No. 221), NACA 8-H-12 (Technical Note 1998) | Works of the United States Government. Public domain in the United States; status outside the United States not established. Conditions of NASA (National Aeronautics and Space Administration): name NASA as the source, imply no endorsement, claim no copyright. | Yes, 4 files | **Library** |
| RAF 34: Royal Aircraft Establishment (RAE) table in NACA Report No. 286 (first published April 1928) | United States copyright term expired; status outside the United States not established. NASA conditions as in the row above; name the RAE as the origin of the data. | Yes, 1 file | **Library** |
| S9104 (Michael Selig, University of Illinois Urbana-Champaign) | Creative Commons Attribution 4.0 International (CC BY 4.0): use, change and redistribution with attribution. | Yes, 1 file | **Library** |
| aerodesign.de, HS airfoils (Hartmut Siegmann) | Private, club, small-business and scientific use with name and source. Large series and industrial use need a written agreement. Redistribution by third parties is partly restricted. | No | Link in the app; download there, then upload |
| aerodesign.de, airfoils of other designers | Use needs the permission of each original author. | No | Via the aerodesign.de link (HS catalog page); download there, then upload |
| mh-aerotools.de, MH airfoils (Martin Hepperle) | Personal use. Publications cite the source. A recompilation must not be sold above production cost. | No | Link in the app; download there, then upload |
| UIUC (University of Illinois Urbana-Champaign) Airfoil Coordinates Database | No license stated for the coordinate files. The terms of each designer apply. | No | Link in the app; download there, then upload |

- Bundled coordinate files: 6, in `public/airfoils/` ([Bundled files](#bundled-files)).
- NACA preset list and generator rules: [[User Guide|User-Guide]], sections Library and NACA generator.

## Links in the app

Tab **Airfoils**, box **More airfoils (external, not bundled)**:

| Link text | Target |
| --- | --- |
| aerodesign.de - Hartmut Siegmann | <https://aerodesign.de/profile/profile_hs.htm> |
| MH-AeroTools - Martin Hepperle | <https://www.mh-aerotools.de/airfoils/> |
| UIUC Airfoil Coordinates Database | <https://m-selig.ae.illinois.edu/ads/coord_database.html> |

## Files on the external sites

| Site | File type | Loads in Wingdesigner |
| --- | --- | --- |
| aerodesign.de | Selig `.dat`, coordinates as fractions of the chord | Yes. Exceptions: `s3021.dat`, `sd7080.dat` ([Parser test](#parser-test)). |
| aerodesign.de | "Original" `.txt` tables, columns `X Yo Yu` in percent of chord, some with decimal commas (e.g. `HS 3,4/12,0`) | Yes |
| aerodesign.de | `.txt` tables with 1 surface of a symmetric airfoil, columns `x y` in percent of chord: `naca0009.txt`, `naca63a008.txt`, `naca64a010.txt` | No. The parser needs an upper and a lower surface. |
| aerodesign.de | `clarky.txt`: 2 coordinate tables (1928 and 1927 data) in 1 file | No. Both tables are read as 1 outline, which crosses itself. Delete the 1927 table in a text editor; the 1928 table then loads. |
| aerodesign.de | "Original" coordinates of HS-0003 and HS-0004 as JPG (Joint Photographic Experts Group) images | No (image). The `.dat` file of the same airfoil loads. |
| mh-aerotools.de | HTML (HyperText Markup Language) page per airfoil, e.g. `mh45koo.htm`. 8 of 56 tables are in percent of chord. | Yes: save the page as `.htm`, then upload it |
| mh-aerotools.de | XML (Extensible Markup Language) file per airfoil, e.g. `geo_xml/mh45_geo.xml`. 55 of 56 airfoils; none for MH 57. | Yes |
| UIUC | Selig `.dat` | Yes. Exceptions: 38 of 1,665 files ([Parser test](#parser-test)). |

- The column "Loads in Wingdesigner" holds for the default **Profile parametrization**, **Centripetal (recommended)**. **Chord length** and **Uniform** reject more files ([Parser test](#parser-test)).
- If the largest x is above 5 and at most 110, all coordinates are divided by 100. The preview shows the warning `Coordinates look like percent of chord and were divided by 100.`

![Upload preview of a percent table: warning "Coordinates look like percent of chord and were divided by 100", Source / attribution field empty because the name "Sample 4412 table" does not start with HS or MH](images/upload-preview.png)

- Formats and checks: [[File Formats|File-Formats]].

### Loading a file

1. Download the coordinate file from the site.
2. **Airfoils** > **Upload**: drop the file on the drop zone or use **Choose files**.
3. Check the preview and the **Source / attribution** field, then click **Add to project**.

Above 200 airfoils the **Checks** tab shows a warning `Large project: …`. It lists `N airfoils (warning above 200)` with any other size above its threshold and names the expected time and browser memory of each change. When the count rises above 200, the short message after **Add to project** also shows this warning. A project holds at most 10,000 airfoils. At 10,000, **Upload** opens no preview and shows `The project holds 10,000 airfoils, the limit; "Remove unused" frees places.` An airfoil that takes the points of all project airfoils above 1,000,000 is refused with `With this airfoil the project airfoils hold N points; the limit is 1,000,000. "Remove unused" frees points.`

### Parser test

- Date: 2026-09-29, code of commit 89c4f22. The test files are not in the repository (license).
- Stage 1: import and sanity checks (`importAirfoilText` in `src/airfoil/sanity.js`).
- Stage 2: preview curve check (`profileProblem` in `src/geom/profile.js`) with each of the 3 settings of **Settings** > **Profile parametrization**. The NURBS (non-uniform rational B-spline) curve through the points must not cross itself; crossing loops with a mean width (area / bounding-box diagonal) up to 5e-4 of the chord (0.05 %) are ignored. Neither surface of the curve may run back in x by more than 1e-4 of the chord (0.01 %).
- The preview and the wing build use the parametrization of the project. A file can be added when it passes stages 1 and 2 with that parametrization.

| Test set | Files | Pass stage 1 | Pass stages 1 and 2 with **Centripetal (recommended)** (default) | Pass stages 1 and 2 with **Chord length** | Pass stages 1 and 2 with **Uniform** |
| --- | --- | --- | --- | --- | --- |
| mh-aerotools.de: HTML pages (`*koo.htm`) | 56 | 56 | 56 | 56 | 53 |
| mh-aerotools.de: XML files (`geo_xml/*_geo.xml`) | 55 | 55 | 55 | 55 | 52 |
| aerodesign.de: all files in `/profile/data/` (154 `.dat`, 34 `.txt`) | 188 | 182 | 182 | 178 | 173 |
| aerodesign.de: HS files (`hs*.dat`, `hs*.txt`; part of the row above) | 43 | 43 | 43 | 43 | 42 |
| UIUC: all `.dat` files in `coord_seligFmt.zip` (last updated 2026-02-23) | 1,665 | 1,632 | 1,627 | 1,619 | 1,563 |
| UIUC: MH series (`mh*.dat`, part of the row above) | 52 | 51 | 51 | 51 | 48 |

Rejected files with **Centripetal (recommended)**:

| Files | Set | Error message |
| --- | --- | --- |
| `naca0009.txt`, `naca63a008.txt`, `naca64a010.txt` | aerodesign.de | `Upper or lower surface has fewer than 3 points; the point order is probably not Selig or Lednicer.` |
| `clarky.txt` | aerodesign.de | `The outline crosses itself (3 crossing(s)).` Upper and lower surfaces also touch at x = 0.0 % chord, and the trailing edge is crossed (gap -3.380 % chord). |
| `s3021.dat`, `sd7080.dat` | aerodesign.de and UIUC | `The outline crosses itself (1 crossing(s)).` Trailing-edge pattern below. |
| `mh150.dat` | UIUC | `The outline crosses itself (1 crossing(s)).` Upper and lower surfaces touch at x = 98.6 % chord. |
| 17 more `.dat` files | UIUC | `The outline crosses itself (1 crossing(s)).` Trailing-edge pattern below. |
| 13 more `.dat` files | UIUC | Outline crosses itself at other places (9 files), trailing edge crossed (3), 1 surface only (1) |
| `goe451.dat` | UIUC | Stage 2: `The NURBS curve through the points crosses itself near x = 2.6 % chord; the file has too few points there. …` |
| `30p-30n-main.dat`, `30p-30n-slat.dat`, `cap21c.dat`, `rc0864c.dat` | UIUC | Stage 2: `The surface runs back in x by … % chord near x = … % chord; …` (0.046 %, 15.924 %, 0.113 %, 0.040 % chord) |

Stage 2 with **Chord length** rejects 17 files (5 crossings, 12 x reversals). Stage 2 with **Uniform** rejects 84 files (2 crossings, 82 x reversals).

Trailing-edge pattern:

- Condition: closed trailing edge with the first point at x = 1.00000 and the last point at x = 1.00001, both at y = 0.
- The check reports 1 crossing at the trailing edge. 19 of the 22 UIUC files with this pattern are rejected, e.g. `s3021.dat`, `sd7003.dat`, `sd7080.dat`.
- Workaround: change the last x to `1.00000` in a text editor. Result on the 19 files: all 19 pass stages 1 and 2.

## Attribution

The airfoil preview (**Upload**, pasted text, **NACA generator**, **Library**) has a **Source / attribution** field.

- Uploaded file, pasted text, NACA airfoil: the app pre-fills the field from the airfoil name. NACA names give an empty field.
- Bundled library file: the app pre-fills `source.author` from `index.json`.

| Input | Airfoil name |
| --- | --- |
| XML file | `<name>` element. If empty or missing: file name without extension. |
| HTML page | `<title>` element. If empty or missing: first non-numeric line before the first coordinate row. If none: file name without extension. |
| Selig, Lednicer, table | First non-numeric line before the first coordinate row. If none: file name without extension. |
| Pasted text without a name line | `pasted` |

Example: `HS-1.dat` without a name line gets the name `HS-1` and the HS pre-fill.

| Airfoil name | Example names | Pre-filled text |
| --- | --- | --- |
| `HS`, then a space or `-` | `HS-1`, `HS 606`, `HS 3,4/12,0` | `Hartmut Siegmann, www.aerodesign.de` |
| `MH`, then an optional space or `-`, then a digit | `MH 45`, `MH45`, `MH 45 Coordinates` | `Martin Hepperle, www.mh-aerotools.de` |
| Any other name | `Goettingen 795`, `concord`, `HS3.0/8.0` | empty |

Matching ignores letter case and leading spaces.

### Stored `source` object

Each airfoil in the project carries a `source` object:

| Origin | Fields of `source` |
| --- | --- |
| **NACA generator** or **Library** preset | `kind: "naca"`, `license`, `url` (NACA Report 824 at ntrs.nasa.gov), `code`, `closedTE`; `attribution` if the field is not empty |
| Wizard | `kind: "naca"`, `license`, `url`, `code`, `closedTE` |
| Sample wing "Sport wing 1500" (loaded when local storage holds no valid saved project) | `kind: "naca"`, `note` |
| Bundled library file | `kind: "library"`, `id`, `attribution` (pre-filled with `source.author` from `index.json`), `license`, `url`, `terms` |
| File upload | `kind: "upload"`, `file` (file name), `attribution` (empty string if no text) |
| Pasted text | `kind: "upload"`; `attribution` if the field is not empty |

| Place | Attribution included |
| --- | --- |
| Project airfoil list (tab **Airfoils**) | Yes, after the point count. NACA airfoils without attribution show `NACA equations`. |
| Project file, JSON (JavaScript Object Notation): **Save** or **Export** > Project JSON | Yes |
| Autosave in browser local storage (key `wingdesigner.project.v1`) | Yes |
| `.dat` download of a project airfoil | No: name line and points only |
| STEP (Standard for the Exchange of Product model data), STL (stereolithography), 3MF (3D Manufacturing Format) | No |

The app sends no airfoil data to a server. Its only network requests for airfoils load `airfoils/index.json` and bundled library files from the app's own address.

### Limitations

- The pre-fill reads the airfoil name only. A file from aerodesign.de or mh-aerotools.de with another name gets an empty field. Measured counts:
  - MH: 1 of 55 XML files (`mh55_geo.xml`, name `concord`), 0 of 56 HTML pages.
  - aerodesign.de: 0 of 43 HS files (`hs*.dat`, `hs*.txt`).
- File upload and library entry: clearing a pre-filled **Source / attribution** field keeps the pre-filled text. Type other text to replace it.
- Pasted text: clearing the field stores no attribution.
- After **Add to project**, the attribution is read-only in the app. **View** shows it in a disabled field. Change it in the project JSON file.
- For an airfoil without a stored attribution, **View** shows the pre-fill derived from the name (HS/MH rule). This text is not stored.
- **Add to project** keeps the existing entry and its `source` when a project airfoil has the same name and identical points, or is a generated NACA section with the same `code` and `closedTE` (any name). The new **Source / attribution** text is discarded. The message `Added airfoil "<name>".` still appears. To change the attribution: remove the airfoil (**×** is available only while no section uses it) and add it again, or edit the project JSON file.
- Exported STEP, STL, 3MF and `.dat` files carry no attribution. The HS terms require name and source with each use. CC BY 4.0 (S9104) requires attribution when the material is shared; whoever shares such a file made with S9104 adds the attribution text from `public/airfoils/NOTICE.md`.

## aerodesign.de (Hartmut Siegmann)

| Item | Value |
| --- | --- |
| Operator | Hartmut Siegmann, Zorneding, Germany |
| HS catalog | <https://aerodesign.de/profile/profile_hs.htm>: 35 HS airfoils for planks, swept flying wings and conventional models |
| Other catalogs | Airfoils of other designers, with source references |
| Contact for permissions | By post, address on <https://aerodesign.de/kontakt/kontakt_m.htm>. E-mail requests are not answered (quote below). |

Contact page, <https://aerodesign.de/kontakt/kontakt_m.htm>:

> Bei den Modell- und Profildatenbanken könnt ihr meine Profile (HS) und Konstruktionen (æ) für private
> und kleingewerbliche Zwecke genehmigungsfrei verwenden, aber nur unter Angabe meines Namens und Link
> auf aerodesign.de. Die Quellenangabe mit meinem Namen und Link ist die Grundlage für die
> genehmigungsfreie Nutzung. Wer Daten oder Inhalte ohne Quellenangabe oder gewerblich nutzen möchte,
> kann sich gerne schriftlich an mich wenden.
>
> Für andere Konstrukteure und Profilentwickler gilt diese Regelung selbstverständlich nicht. Deren
> Werke sind in meinen Datenbanken zusammengefasst und zum Teil erläutert. Das heißt in dem Fall müsst
> ihr euch die Nutzung von dem betreffenden Urheber genehmigen lassen.

Translation: In the model and airfoil databases, my airfoils (HS) and designs (æ) may be used without
permission for private and small-business purposes. This applies only with my name and a link to
aerodesign.de. The source reference with my name and link is the basis for use without permission.
Anyone who wants to use data or content without a source reference or commercially may write to me.

Translation: This rule does not apply to other designers and airfoil developers. Their works are
collected and partly explained in my databases. In that case, you need permission for the use from
the respective author.

> Die Lebens- und Arbeitszeit eines Menschen ist leider begrenzt, daher beantworte ich derzeit keine
> Anfragen per E-Mail.

Translation: A person's lifetime and working time are limited, so I currently do not answer requests
by e-mail.

HS catalog page, <https://aerodesign.de/profile/profile_hs.htm>:

> Meine Profile dürfen privat, im Vereinsrahmen, kleingewerblich und selbstverständlich wissenschaftlich
> unter Angabe meines Namens und der Quelle »www.aerodesign.de« genehmigungsfrei genutzt werden.
> Großserien oder industrielle Anwendungen erfordern eine schriftliche Nutzungsvereinbarung. Das Recht auf
> Weiterverbreitung durch Dritte ist aufgrund von Verlagsrechten zum Teil eingeschränkt, also solltet ihr
> aus Eigeninteresse Inhalte dieser Seite nicht kopieren, sondern nur auszugsweise zitieren.

Translation: My airfoils may be used without permission privately, in clubs, by small businesses and
for science, with my name and the source "www.aerodesign.de". Large series or industrial applications
require a written usage agreement. The right of third parties to redistribute is partly restricted by
publishing rights. In your own interest, do not copy content of this page; quote excerpts only.

Reasons the HS airfoils are not bundled:

- Redistribution by third parties is partly restricted by publishing rights.
- The catalog page asks not to copy its content and to quote excerpts only.
- `npm run airfoils:check` rejects index entries whose `source.url` or `source.terms` host is aerodesign.de.

## mh-aerotools.de (Martin Hepperle)

| Item | Value |
| --- | --- |
| Operator | Martin Hepperle |
| Airfoil index | <https://www.mh-aerotools.de/airfoils/>: 56 MH airfoils |
| Flying wings (low pitching moment) | MH 44, MH 45, MH 46, MH 49, MH 60, MH 61, MH 62, MH 64 |
| Gliders | MH 30, MH 32, MH 42, MH 43 |
| Pylon racers | 13 airfoils from MH 16 to MH 29 (glow engine); MH 30 to MH 34, MH 43 (electric) |
| Contact for permissions | E-mail link on each airfoil page |

Footer of every airfoil page, e.g. <https://www.mh-aerotools.de/airfoils/mh45koo.htm>:

> © 1996-2018 Martin Hepperle\
> You may use the data given in this document for your personal use. If you use this document for a
> publication, you have to cite the source. A publication of a recompilation of the given material is
> not allowed, if the resulting product is sold for more than the production costs.

Reasons the MH airfoils are not bundled:

- The terms grant personal use. They contain no grant for public redistribution.
- The repository is public under the MIT License (named after the Massachusetts Institute of Technology). This license allows anyone to sell copies. The last sentence of the terms excludes a sale above production cost.
- `npm run airfoils:check` rejects index entries whose `source.url` or `source.terms` host is mh-aerotools.de.

## UIUC Airfoil Coordinates Database

| Item | Value |
| --- | --- |
| Maintainer | UIUC Applied Aerodynamics Group (Michael Selig) |
| Coordinates page | <https://m-selig.ae.illinois.edu/ads/coord_database.html> |
| Content | Approximately 1,650 airfoils (Version 2.0) of many designers, Selig `.dat`. Count as stated on the coordinates page; the note in the app says "About 1,600". |
| License on the coordinates page | None. The footer carries only `© 1994 - 2026 UIUC Applied Aerodynamics Group`. |
| GNU General Public License (GPL) | The low-speed airfoil test page (wind-tunnel performance data) links a GPL text for the "airfoil/aircraft data". The coordinates page does not mention the GPL. Whether the GPL covers the coordinate files: not stated. |
| Designers' terms | Apply to their files, e.g. the MH terms above. |

## Bundled files

Source, legal basis with quotes, conditions and attribution text per file: [NOTICE.md](https://github.com/subtilitas/Wingdesigner/blob/main/public/airfoils/NOTICE.md).
Category and use per file: [[User Guide|User-Guide]], section Library.

| Airfoil | File | Source table | License identifier | Basis (from NOTICE.md) |
| --- | --- | --- | --- | --- |
| Clark Y | `clark-y.dat` | NACA Report No. 502, Table I (1934); same ordinates in NACA Report No. 244 (September 1926) | `public-domain` | Work of the United States Government; United States copyright term expired |
| NACA 8-H-12 | `naca-8h12.dat` | NACA Technical Note 1998, Table I (December 1949) | `public-domain` | Work of the United States Government |
| NACA M-6 | `naca-m6.dat` | NACA Report No. 221, Table XXIX (1926) | `public-domain` | Work of the United States Government; United States copyright term expired |
| RAF 34 | `raf-34.dat` | RAE table in NACA Report No. 286, Reference No. 639 (April 1928) | `public-domain` | United States copyright term expired; table reprinted in a work of the United States Government |
| S9104 | `s9104.dat` | File of the designer, <https://m-selig.ae.illinois.edu/uiuc_lsat/s9104/s9104.html> | `CC-BY-4.0` | CC BY 4.0 license from the designer |
| USA 35B | `usa-35b.dat` | NACA Report No. 233, Table XXXVI (1927) | `public-domain` | Work of the United States Government; United States copyright term expired |

- Status outside the United States of the 5 public-domain files: not established.
- `source.url` of the 5 public-domain files points to the record on the NASA Technical Reports Server (NTRS).
- RAF 34: the scan of the table is a 1-bit image. 7 values are uncertain, by up to 0.20 % of chord (lower surface at 60 % of chord). NOTICE.md lists the 7 values and their other possible readings.
- Clark Y and USA 35B keep the published base line: the leading edge lies 3.50 % and 2.76 % of chord above the x axis. The preview shows the warning `The line from the leading edge to the trailing edge is inclined by -1.97 degrees; …` (USA 35B: -1.51).
- No bundled file is a copy of a file from the UIUC Airfoil Coordinates Database.
- Test on 2026-09-29: all 6 files pass stages 1 and 2 of the [Parser test](#parser-test) with each of the 3 settings of **Profile parametrization**.

Not bundled (owner decisions with reasons in [RECORD.md](https://github.com/subtilitas/Wingdesigner/blob/main/RECORD.md)):

| Data | License | Reason |
| --- | --- | --- |
| JX library | Creative Commons Attribution-ShareAlike 4.0 (CC BY-SA 4.0) | Share-alike: not among the 8 accepted license identifiers ([Adding a bundled airfoil](#adding-a-bundled-airfoil)) |
| Mark Drela, DAE and HT sections | GPL 2.0 or later | Copyleft: not among the 8 accepted license identifiers |
| PROFOIL test sections | MIT License | Generic designs without polars (lift and drag data) or flight history |

## Adding a bundled airfoil

Requirements for a file in `public/airfoils/`:

| Rule | Checked by `npm run airfoils:check` |
| --- | --- |
| `airfoils` in `public/airfoils/index.json` is an array. | Yes |
| Each entry has an `id`. No 2 entries share an `id`. | Yes |
| `name`, `file`, `category` present and not empty | Yes |
| `source.author`, `source.license`, `source.url`, `source.terms` present and not empty | Yes |
| `source.license` is one of 8 identifiers: `public-domain`, `CC0-1.0`, `Unlicense`, `CC-BY-4.0`, `CC-BY-3.0`, `MIT`, `BSD-2-Clause`, `BSD-3-Clause` | Yes |
| `source.url` and `source.terms` are URLs (Uniform Resource Locators). Their host, without a leading `www.`, is not aerodesign.de, mh-aerotools.de or a subdomain of them. Message otherwise: `<host> grants personal use only.` | Yes |
| `public/airfoils/NOTICE.md` exists (index with at least 1 entry) and contains the entry's `name`. | Yes |
| The file exists at `public/airfoils/<file>`. | Yes |
| The file passes import and the sanity checks with no error. Warnings are allowed. | Yes |
| The NURBS interpolation through the points succeeds. The curve does not cross itself (loops with a mean width, area / bounding-box diagonal, up to 5e-4 of the chord are ignored) and does not run back in x by more than 1e-4 of the chord. Checked in the app's **Preview** with the project's **Profile parametrization**. | No |
| Every file under `public/airfoils/`, subfolders included, except `public/airfoils/index.json` and `public/airfoils/NOTICE.md`, has an entry. | Yes |
| The license identifier matches the terms at `source.terms`. | No (manual review) |
| `use` (optional): text shown in **Library** and matched by **Filter library** | No |

- Not accepted: personal-use, non-commercial, no-derivatives, share-alike and ask-first terms, and individual permissions.
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

- List "Example 12" with its source and license in `public/airfoils/NOTICE.md`.
- Script: `scripts/check-airfoils.mjs`. It also generates the 17 NACA presets and runs the sanity checks on each.
- Output with the 6 bundled files: `6 bundled airfoils (free licenses only) and 17 NACA presets pass.`
- On failure it prints one line per problem and exits with code 1.
- CI (continuous integration): workflow `ci.yml`, job "Lint, unit tests, coverage", step "Bundled airfoil library".
- In the app, a bundled entry appears in **Library** with category, use, author and license. **Preview** loads the file from `airfoils/<file>`.
