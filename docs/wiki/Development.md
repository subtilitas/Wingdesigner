Deutsch: [[Entwicklung|Entwicklung]]

# Development

## Architecture

| Property | Value |
| --- | --- |
| Language | JavaScript modules, no framework. Build target ES2022 (ECMAScript 2022); ESLint parses ECMAScript 2024 (`ecmaVersion: 2024`). |
| Build tool | Vite `^8.3.1`. Relative base `./`, source maps. `build.chunkSizeWarningLimit: 900`: Vite warns when a chunk exceeds 900 kB (Vite unit: 1 kB = 1000 bytes). Output: one classic script in IIFE format (immediately invoked function expression) with the styles inside, loaded with `defer` and without `crossorigin` (plugin `classicScript` in `vite.config.js`), because Chromium refuses module scripts and CORS-mode (Cross-Origin Resource Sharing) stylesheets from file URLs; `build.modulePreload: false`. `dist/index.html` therefore runs opened from a file. |
| Runtime dependencies | three.js `^0.186.1`: 3D view, imported only in `src/ui/viewer3d.js`. fflate `^0.8.3`: zip container of 3D Manufacturing Format (3MF) files, imported only in `src/export/threemf.js`. The build bundles both at the versions in `package-lock.json` (`npm ci`). Plugin `licenses` in `vite.config.js` writes `dist/LICENSES.txt`: `LICENSE` of this app, then the license file of every npm package with code in the bundle (found from the bundled modules, not from a list); a bundled package without a license file stops the build. |
| Node.js | 24 or later (`.nvmrc`: 24; `engines.node`: `>=24`) |
| Unit tests | Vitest `^5.0.2` in Node.js; timeout 20000 ms per test (`test.testTimeout` in `vite.config.js`); coverage with `@vitest/coverage-v8` |
| Browser tests | Playwright `^1.63.0` |
| App version | `package.json` `version`, compiled in as `__APP_VERSION__` by `vite.config.js`. Shown in the **Help** dialog. Written to `generator.version` in the project file (JavaScript Object Notation, JSON). |

Code in `src/geom/`, `src/airfoil/`, `src/export/`, `src/import/` and `src/model/` does not use the Document Object Model (DOM) application programming interface (API).
Unit tests and scripts import it in Node.js.
The bundled airfoil library needs no network request: plugin `airfoilLibrary` in `vite.config.js` compiles `public/airfoils/index.json` and its files into the module `virtual:airfoil-library`, read by `src/airfoil/bundled.js`. Vite also copies `public/airfoils/` to `dist/airfoils/`.

| Path | Content |
| --- | --- |
| `index.html` | Page shell; loads `src/main.js` |
| `src/main.js` | Entry: store, rebuild scheduling, top bar (**Open** chooses the reader for a project file or an XFLR5 file), status bar, **Checks** tab, **Help** dialog, autosave |
| `src/geom/`, `src/airfoil/`, `src/export/`, `src/import/`, `src/model/`, `src/ui/` | See [Modules](#modules) |
| `public/airfoils/` | 6 coordinate files (`.dat`, Selig format), `index.json` with 6 entries, `NOTICE.md` (source, legal basis, conditions and attribution per file). An entry needs a free license and a line in `NOTICE.md` (see [Airfoil library check](#airfoil-library-check)). The 17 National Advisory Committee for Aeronautics (NACA) presets are computed at run time, not stored. |
| `scripts/` | See [Scripts](#scripts) |
| `test/` | Vitest unit tests (`*.test.js`), `helpers.js` (NACA sample project), `step-cases.js` (validation cases for Standard for the Exchange of Product model data (STEP) files and 3MF files), `xflr5-writer.js` (writer of XFLR5 project files), `fixtures/xflr5/` (XFLR5 test files, see [XFLR5 test files and tests](#xflr5-test-files-and-tests)) |
| `e2e/` | Playwright end-to-end (E2E) browser tests (`*.spec.js`), `helpers.js` |
| `docs/Flow5upgrade.md` | Plan and owner decisions for mitred section planes, a rigid tilt of the whole part and the flow5 import (English only) |
| `docs/Handover.md` | Where the work stands, next steps, working agreements with the owner, what the repository does not hold (English only) |
| `docs/wiki/` | Wiki pages in English and German, `_Sidebar.md`, `images/` (English screenshots), `images/de/` (German screenshots) |
| `.github/workflows/` | `ci.yml`, `docs.yml`, `release.yml` |

Generated and not committed (`.gitignore`): `dist/`, `coverage/`, `step-check/`, `foam-check/`, `test-results/`, `playwright-report/`.

### Modules

| File | Content |
| --- | --- |
| `src/geom/nurbs.js` | Non-uniform rational B-spline (NURBS) primitives |
| `src/geom/linalg.js` | Band lower-upper (LU) factorization without pivoting (B-spline interpolation, used by `src/geom/nurbs.js`); dense LU factorization with partial pivoting (unit tests only) |
| `src/geom/profile.js` | Airfoil as NURBS curve; chordwise resampling; `fitProfile` (curve fit and shape check of an airfoil, used by the airfoil preview and the XFLR5 import) |
| `src/geom/spanwise.js` | Spanwise blending of section values (`linear`, `smooth`) |
| `src/geom/guide.js` | Guide curves (nose line, end line) |
| `src/geom/planes.js` | Section planes: roll and stretch of each section (`sectionPlanes`), stretch limit, extent of a placed airfoil (`upExtent`) and fold test of two neighbouring planes (`planeFold`, `firstFold`) |
| `src/geom/wing.js` | Wing loft: `buildWing`; `mitredPlaneProblem` (stretch and fold checks without the loft, for the XFLR5 import); profile cache |
| `src/geom/mesh.js` | Tessellation, mirror, mesh volume, area and edge check |
| `src/geom/triangulate.js` | End-cap triangulation: strip of upper and lower point pairs (linear time); ear clipping as fallback |
| `src/geom/stats.js` | Planform statistics; for a tilted or rolled part the MAC position, 25 % MAC and span in the plane axes |
| `src/geom/part.js` | Rigid placement of the part (**Part tilt**, **Part roll**): `partPivot` (stored pivot, else the leading edge of the root section), `partTransform` (roll about x, then tilt about y, through the pivot: `point`, `vector`, `matrix`), `transformPositions` (mesh vertices) |
| `src/geom/foam.js` | Foam cores: proposed cuts (`proposeCuts`), cut list rules (`normalizeCuts`), segments with end profiles, wedges and deviation (`foamSegments`), splitting above a deviation limit (`splitOverTolerance`); limits `FOAM_LIMITS` |
| `src/geom/sampling.js` | Span samples for drawing, shared by the 3D view and the planform: `refine`, `thinParams`, `edgeParams`, `MAX_EDGE_SAMPLES` (20,000) |
| `src/airfoil/parse.js` | Airfoil file parser; `cleanPoints` cleans a point list from another format (the airfoils of an XFLR5 project) by the rules of a parsed file |
| `src/airfoil/geometry.js` | Polyline geometry |
| `src/airfoil/sanity.js` | Sanity checks, `importAirfoilText` |
| `src/airfoil/naca.js` | NACA 4- and 5-digit generator; `leadingNacaCode` finds the code that starts a name (`NACA0014_Flap`) |
| `src/airfoil/library.js` | 17 NACA presets, bundled library, external sources; `librarySource` (source record of a bundled entry) |
| `src/export/step.js` | STEP writer; file format International Organization for Standardization (ISO) 10303-21 |
| `src/export/axes.js` | Up axis of the exported files (the Fusion 360 fix of the export dialog): `UP_AXES`, `upAxisMap` (identity for Z up, (x, z, −y) for Y up), `meshToUpAxis` |
| `src/export/stl.js` | Binary stereolithography (STL) writer |
| `src/export/threemf.js` | 3MF writer |
| `src/export/foam.js` | Files of the foam-cutting wizard: `.dat` profiles, `segments.csv`, profile ZIP (`profileZip`), template blocks and sheet (`templateBlocks`, `templateLayout`), kerf offset (`offsetPolygon`), SVG (Scalable Vector Graphics), DXF (Drawing Exchange Format, AutoCAD R12) and PDF (Portable Document Format) writers (`layoutSvg`, `layoutDxf`, `layoutPdf`), PDF paging (`pagePlan`) |
| `src/export/precision.js` | 32-bit coordinate check of STL and 3MF exports: `checkPrecision`, `MeshPrecisionError` |
| `src/import/errors.js` | `XflrError`: file-level error of the XFLR5 and flow5 readers, with a `code` and, for an `.xfl` or `.fl5` project, the byte `offset` |
| `src/import/xfl.js` | Reader of XFLR5 projects (`.xfl`): `readXfl` (windows of 4,194,304 bytes), `readXflBytes` (bytes in memory), `startsLikeXfl`, `sniffXflr5`; the windowed big-endian `Reader` that the `.fl5` reader shares |
| `src/import/fl5.js` | Reader of flow5 projects (`.fl5`, formats 500750 and 500754): `readFl5`, `readFl5Bytes`; `readProjectFile` (an `.xfl` or `.fl5` project by its first number) |
| `src/import/xmlscan.js` | XML tokenizer of both XML readers: `Scanner`, `children`, `readText`, `toNumber` |
| `src/import/xflxml.js` | Reader of XFLR5 plane and wing files in Extensible Markup Language (XML): `readXflr5Xml` |
| `src/import/fl5xml.js` | Reader of flow5 plane and wing XML files: `readFlow5Xml`; `readPlaneXml` (an XFLR5 or flow5 XML file by its root element) |
| `src/import/xflr5.js` | Mapping of one XFLR5 or flow5 wing to a project: surfaces of a plane (`planeSurfaces`; for flow5 every wing of the plane), sections (`mapSections`), airfoil table, report and project (`mapXflr5`), airfoil checks in steps (`checkSteps`), airfoil uploads (`readAirfoilUpload`) |
| `src/model/project.js` | Project model, defaults, limits, validation |
| `src/model/budget.js` | Warning thresholds, loft grid, time and memory estimates |
| `src/model/io.js` | Project JSON import and export; `upgradeFoldedTilt` (a folded tilt of a version 2 file becomes **Part tilt**) |
| `src/model/edit.js` | Edit operations |
| `src/model/wizard.js` | Wizard presets, parameter ranges (`RANGES`) and panel ranges (`PANEL_RANGES`, at most `MAX_PANELS` = 24 panels); `wizardProject` builds the sections of the straight, elliptic and panel planforms and the elliptic tip (`ELLIPTIC_TIP_SECTIONS` = 6); `panelsFromParams` turns the straight planform into 1 panel |
| `src/model/winglet.js` | Integral winglet: `wingletSections` (blend arc in steps of at most `WINGLET_STEP` = 15°, then the straight part), `wingletProblems`, `addWinglet`, `defaultWinglet`, ranges `WINGLET_RANGES` |
| `src/model/defaults.js` | Project on first load |
| `src/ui/store.js` | Store with undo and redo |
| `src/ui/viewer3d.js` | 3D view |
| `src/ui/panzoom.js` | 2D canvas with pan and zoom |
| `src/ui/sections.js` | **Sections** tab |
| `src/ui/planform.js` | **Planform** tab |
| `src/ui/airfoils.js` | **Airfoils** tab, upload preview; `readAirfoilFile` (reads an uploaded file and refuses XFLR5 files) |
| `src/ui/settings.js` | **Settings** tab |
| `src/ui/wizard.js` | Wizard dialog with the panel table; `drawPlanform` (also draws the planform in the import dialog) |
| `src/ui/xflr5.js` | Import dialog for XFLR5 files: `openXflr5Dialog` |
| `src/ui/exportui.js` | **Export** dialog |
| `src/ui/foam.js` | Foam-cutting wizard: `foamDialog`; stored settings (`storedFoamSettings`, key `wingdesigner.foam`) |
| `src/ui/winglet.js` | Winglet dialog of the **Sections** tab: `wingletDialog` |
| `src/ui/dom.js` | DOM helpers |
| `src/ui/styles.css` | Styles |
| `src/i18n/index.js` | Language (`language`, `setLanguage`, `initialLanguage`), `tr()` and the number formats `fixed`, `count`, `whole`, `plain` |
| `src/i18n/de/*.js` | German texts, one file per area: `shell`, `panels`, `editors`, `model`, `geom`, `airfoil`, `xfl`, `xflxml`, `xflr5`, `foam`, `winglet`, `flow5`; `index.js` merges them |

### Scripts

| Script | Content |
| --- | --- |
| `scripts/coverage-readme.mjs` | Coverage table in both READMEs |
| `scripts/check-airfoils.mjs` | Airfoil library check |
| `scripts/export-step-cases.mjs` | STEP and 3MF case export |
| `scripts/validate_step.py` | STEP validation (OpenCascade) |
| `scripts/validate_3mf.py` | 3MF validation (lib3mf) |
| `scripts/export-foam-cases.mjs` | Foam-cutting file export of the test wings |
| `scripts/validate_foam.py` | Foam-cutting file validation (ezdxf, pypdf) |
| `scripts/screenshots.mjs` | Wiki screenshots, English and German |
| `scripts/check-docs.mjs` | Documentation check |
| `scripts/check-test-counts.mjs` | Test count check |
| `scripts/check-i18n.mjs` | Translation check |

### Data flow

1. A tab (class in `src/ui/`) calls `store.update(mutate, { key, session })`.
   The store pushes the previous project onto the undo stack and clears the redo stack. A mutation that leaves the serialized project unchanged pushes nothing, keeps the redo stack and notifies nobody.
   The undo stack holds at most 100 steps. Undo and redo stack together hold at most 64,000,000 characters of serialized project (JSON). Above that, the oldest undo steps are dropped first, then the redo steps farthest from the current project. The newest step of each stack stays.
   Consecutive updates with the same key, each less than 800 ms after the one before, form one undo step. With `session: true` (planform drags) updates with the same key form one step however long the pauses, until the drag ends on pointer release or cancel (`lastKey` reset); undo and redo also reset it, so a drag in progress continues as a new step.
2. The store notifies its subscribers.
   `main.js` schedules at most 1 rebuild in the next animation frame; further notifications before that frame share it.
3. The rebuild runs `buildWing(project)`. The build stays in the frame of the part; `build.part` holds the rigid placement (`src/geom/part.js`), which the 3D view, the mesh and STEP exports and the statistics apply.
   It updates the 3D view, **Sections**, **Planform**, **Checks** and the status bar.
   **Airfoils** and **Settings** re-render on every change except a selection change.
4. After a change other than a selection change, the rebuild saves the project to browser local storage when `validateProject` accepts it.
   A pending save is written at once on `pagehide` and when the page becomes hidden (`visibilitychange`), e.g. on a reload before the next animation frame.
   Nothing is saved while the first-run wizard is open; a reload then opens the wizard again.
   **Skip (open sample wing)** saves the sample wing; **Create design** saves the created project.

| Local storage key | Content |
| --- | --- |
| `wingdesigner.project.v1` | Last valid project (JSON) |
| `wingdesigner.project.v1.rejected` | Copy of a saved project that failed to load. The app then starts as on a first visit, with the wizard. |
| `wingdesigner.project.v1.stale` | Time of the first failed autosave; removed at the next start and when an autosave succeeds |
| `wingdesigner.tab` | Active tab |
| `wingdesigner.language` | Chosen language, `en` or `de` (section [Translations](#translations)) |
| `wingdesigner.foam` | Settings of the foam-cutting wizard: `coreLength`, `tolerance`, `kerf` (mm), `paper` (`a4`, `a3`, `letter`); each value outside its range reads as its default |

### XFLR5 and flow5 import

The import reads an XFLR5 or flow5 file and builds a project from one wing of one plane in it. XFLR5 is a program for the analysis of airfoils and wings; 6.62 is its last release. flow5 is its successor (version 7), under GPL-3.0; the flow5 readers are written from a description of the formats, not from flow5's code. The readers and the mapping in `src/import/` use no DOM API and run in Node.js. The dialog (`src/ui/xflr5.js`) and **Open** (`src/main.js`) use the DOM. The rules for the files and the formulas of the mapping are in [[File Formats|File-Formats]], section XFLR5 import; the dialog is described in the [[User Guide|User-Guide]], section Import from XFLR5 and flow5.

1. The change handler of the **Open** file input in `src/main.js` chooses the reader. Extension `.xfl`, `.wpa` or `.fl5`: `readProjectFile`, which reads the first number and calls the `.fl5` reader (500000 to 509999) or the `.xfl` reader. `.xml`: `readPlaneXml`, which calls the XFLR5 reader, and the flow5 reader for a flow5 root element. Any other extension except `.json`, or none: first the first 4 bytes (`sniffXflr5`, and a UTF-16 byte order mark for the XML readers), then text that starts with `<?xml`, `<!`, `<explane`, `<xflplane` or `<xflwing` (XML readers); otherwise project JSON. `importXflr5` runs the reader and opens the dialog.
2. A reader throws `XflrError` for a file that it cannot import. `code` is `not-xflr5`, `flow5` (from the XFLR5 readers, which hand flow5 files on), `flow5-old`, `flow5-unknown`, `flow5-new`, `wpa`, `damaged`, `not-plane-xml`, `no-plane`, `fin` or `too-large`; `offset` is the byte of the damage in an `.xfl` or `.fl5` project, else `null` (XML files, errors without a byte position). **Open** shows `Cannot open <file>: <message>` and leaves the design and the undo history as they are. Any other exception of the import shows as `Cannot open <file>: Internal error: <message>`.
3. `readXfl(file)` and `readXflr5Xml(text)` return the same object, `XflrFile`: `kind` (`xfl` or `xml`), `format`, `lengthUnit` (millimetres per length unit of the file; 1000 for `.xfl`), `unitName`, `wingOnly`, `planes`, `foils`, `foilError` and `warnings`. A plane has a `name` and `wings`, the 4 XFLR5 wing slots main wing, second wing, elevator (horizontal stabilizer) and fin; a slot that the plane lacks is `null`. `foils` (`.xfl` only) maps an airfoil name to its base coordinates and flap settings. Wing sections keep the values of the file: the length unit of the file and degrees.
4. `readXfl` reads a project through windows of 4,194,304 bytes (`WINDOW_SIZE`, `Blob.slice`). The record readers are generator functions. One yields when its next read lies outside the window; `readXfl` loads the window that starts there and resumes it. A skip only moves the offset. The analyses and the analysis results, which make up most of a project of 96.7 MB, are skipped by their counts. Reading ends after the airfoils. `readXflBytes` reads a file held in memory as one window. A file damaged after the planes gives its planes without airfoils (`foilError` and a warning).
5. `readXflr5Xml` is a pull tokenizer without a tree (`src/import/xmlscan.js`), linear in the length of the text. A missing or garbled number stays NaN (not a number) and gives a warning; XFLR5 reads such text as 0.
   - flow5 files: `readFl5` and `readFlow5Xml` return the same shape with `program: 'flow5'` (`kind` `fl5` or `xml`). A plane has `kind` (`wings` or `mesh`), `bodies` and `wings`, a list in file order; a wing has `type` (`main`, `elevator`, `fin`, `other`), `twoSided`, `position`, `tilt` (`Ry_angle`) and `roll` (`Rx_angle`). `readFl5` walks every record before the planes by its counts, through the windows of the `.xfl` reader, and stops after the last plane. `programOf(file)` gives `XFLR5` or `flow5` for the messages, which carry a `{program}` placeholder.
6. `mapXflr5(file, options)` (`src/import/xflr5.js`) is a pure function. `options` holds `plane`, `surface` (`main` or `stab`), `fileName`, `name`, `project` (the current project), `library` (bundled library entries), `uploads` (read `.dat` files) and `choices` (the option key picked per XFLR5 airfoil name: `file:<name>`, `upload:<i>`, `project:<id>`, `library:<id>` or `naca:<code>`). The result holds `rows` (the airfoil table), `options` (the entries of the airfoil lists), `report` (lines with the severity `error`, `warning` or `info`), `errors`, `project` (`null` while the report holds an error) and `summary`. The steps: `mapSections` (y and z from the developed span and the dihedral, clean-up of sections at one y and of chords below 1 mm, the position; the tilt angle is returned, and the project stores it as `settings.partTilt` with `partRoll` 0 and the wing origin as `partPivot`); one airfoil per name (file, uploads, current project, library, NACA generator, similar name); the airfoil frame (`placeAirfoil`; a NACA airfoil of the current project whose points are the generated or checked section of its code gets the frame of that generated section, `checkProjectAirfoil`); `createProject` and `validateProject`. Check results are cached per airfoil object and language (`WeakMap`), because the dialog maps again after every choice.
7. `openXflr5Dialog(file, { fileName, project, library })` calls `mapXflr5` after every choice and draws the result. The first mapping follows `checkSteps`, a generator with one step per airfoil name. The dialog runs it in slices of 50 ms (`SLICE_MS`), so that clicks, Escape and scrolling work meanwhile. A change of plane or surface runs `checkSteps` of the new wing at once for up to 50 ms; when it has not ended by then, the dialog turns **Import** off, empties the airfoil table, the preview, the stats line and the untyped project name of the previous wing, and runs the rest in slices, as for the first mapping. The candidate project is built with `buildWing` for the preview; a project above a size warning is not built, and the preview draws straight panels. The errors and warnings of the build become report lines (`buildNotes`) that do not block **Import**. The promise resolves with `{ project, summary, warnings }`, or with `null` after **Cancel**.
8. `main.js` calls `replaceProject` (`store.replace`, one undo step), opens the **Sections** tab and shows the summary and the first warning as a message.

| Constant | Value | Use |
| --- | ---: | --- |
| `MIN_PANEL` (`src/import/xflr5.js`) | 0.1 mm | A panel shorter than this counts as sections at one y_position; XFLR5 skips such panels |
| `NUDGE` | 0.5 mm | Largest move of a section that shares its y_position with the next one; also at most ¼ of the panel |
| `DIHEDRAL_WARN` | 10° | Dihedral above which the report warns about the thinner vertical sections |
| `FRAME_TOLERANCE` | 0.001 chord | Offset of x or y of the leading edge from 0, or of the chord from 1, up to which the report does not name the move of the sections; every frame above 1e-9 of the chord (`FRAME_ROUND_OFF`, round-off of the curve fit) applies |
| `FRAME_WARN` | 0.02 chord | Offset above which the move of the sections is a warning, not an info line |
| `FRAME_LIMIT` | x or y of the leading edge 0.1 chord, chord 0.5 to 2 | Beyond it the coordinates are not in chord units |
| `MAX_XFL_BYTES` (`src/import/xfl.js`) | 2,000,000,000 bytes | Largest `.xfl` project |
| `MAX_PLANES` | 10,000 | Planes per file (both readers) |
| `MAX_TOTAL_SECTIONS` | 1,000,000 | Wing sections of all planes of an `.xfl` project |
| `MAX_FOILS` | `LIMITS.maxAirfoils` (10,000) | Airfoils read from an `.xfl` project |
| `MAX_FOIL_POINTS` | 2,000,000 | Airfoil points read from an `.xfl` project; airfoils beyond it are skipped and reported |
| `MAX_XFLR5_FOIL_POINTS` | 1,000 | Points of one airfoil; XFLR5 holds at most 604 |
| `MAX_ELEMENTS`, `MAX_DEPTH`, `MAX_ATTRIBUTES` (`src/import/xmlscan.js`) | 1,000,000; 100; 100 | XML elements per file, nesting depth, attributes per element |
| `FL5_FORMATS` (`src/import/fl5.js`) | 500750, 500754 | `.fl5` project formats read |
| `MAX_FLOW5_FOIL_POINTS` | 10,000 | Points of one `.fl5` airfoil |
| `MAX_FLOW5_WINGS` (`src/import/fl5xml.js`) | 100 | Wings kept per plane of a flow5 XML file or `.fl5` project; further wings are read past and dropped with the warning `Plane "<name>" has more than 100 wings; the first 100 are read.` |

Sections per wing: `LIMITS.maxSections` (20,000). XML files: `MAX_PROJECT_BYTES` (100 MB).

### Build and export times

| Condition | Value |
| --- | --- |
| Machine | Node.js 24.21; Intel Xeon x86-64 central processing unit (CPU), 2.10 GHz, 4 cores; load average 3.3 (other processes running) |
| Date | 2026-09-29 |
| Input | `wizardProject(PRESETS.<preset>.params)` with `settings.chordSamples` set to the station count |
| Functions | `buildWing(project)`, `exportMeshes(build, 'merged')`, `wingToStep(build, { mirror: true })` |
| Cache | `buildWing` caches the profile stage (sanity checks, NURBS curve, crossing and x-reversal tests, resampling) per airfoil point list, parametrization and station count. The cache keeps the most recently used entries: at least 32, and at least 1 per airfoil the sections use (`src/geom/wing.js`). |
| Build | Every profile is in the cache (filled by the warm-up runs) |
| Run | 1 call of the function |
| Repetition | Mean of 10 runs after 2 warm-up runs; STEP write: mean of 3 runs |
| Unit | KB = 1024 bytes |

| Case | **Chordwise stations per surface** | `buildWing`, profiles cached | Mesh (merged) | STEP write | STEP size |
| --- | ---: | ---: | ---: | ---: | ---: |
| **Sport** preset, 2 sections | 60 | 17 ms | 1 ms | 3 ms | 99 KB |
| **Sport** preset, 2 sections | 200 | 40 ms | 1 ms | 4 ms | 303 KB |
| **Glider** preset, elliptic guide curves, 17 spanwise stations | 60 | 36 ms | 12 ms | 6 ms | 445 KB |
| **Glider** preset, elliptic guide curves, 17 spanwise stations | 200 | 89 ms | 42 ms | 19 ms | 1398 KB |

Large projects in the browser:

| Condition | Value |
| --- | --- |
| Machine | Chromium 141, headless, software rendering; 4 shared cores of a 2.1 GHz Intel Xeon CPU; load average 2 to 8 (other processes running) |
| Change | 1 chord edit in the **Sections** table |
| Values | JavaScript time of the change; JavaScript heap after the rebuild |

**Linear** and **Smooth** stand for the options **Linear between sections** and **Smooth (shape-preserving cubic through sections)** of the list **Spanwise interpolation**.

| Case | JavaScript time per change | Heap |
| --- | ---: | ---: |
| 200 sections, **Smooth** (399 spanwise stations) | 0.5 to 0.65 s | 38 to 48 MB |
| 1,000 sections, **Linear** | 1.5 to 1.6 s | 78 to 91 MB |
| 2,000 sections, **Smooth** | 2.9 to 3.8 s | 159 to 175 MB |
| 5,000 sections, **Linear** | 6.9 to 7.4 s | 345 to 361 MB |
| 5,000 sections, **Smooth** | 6.2 to 8.3 s | 237 to 413 MB |
| 10,000 sections, **Linear** | 15.8 to 16.4 s | 490 MB |
| 15,000 sections, **Linear** | 19 to 23 s | 678 MB |
| 20,000 sections, **Linear** | 24 s | 969 MB |

- 20,000 sections, **Linear**: 57 s page time per change with software rendering. Opening the project: 24 s JavaScript time, 59 s page time, 496 MB heap afterwards.
- Selecting a section: 2 to 100 ms JavaScript time at 200 to 20,000 sections.
- Airfoils of 20,001 points each: 100 airfoils open in 17 s, a change takes 2.3 s, heap 546 MB; 200 airfoils open in 35 s, a change takes 5.8 to 7.9 s, heap 1.1 GB.
- Mesh export, 16 sections × 40 stations, 200 **Chordwise stations per surface**: STL with 8.5 million triangles in 6.9 s, 423 MB file, 2.7 GB browser memory at the peak. STL with 20 million triangles fails; 80 million triangles crash the tab. 3MF with 8.5 million triangles in 49 s, 97 MB file.
- STEP export: 81 MB in 2.2 s (1,041 stations), 330 MB in 8.4 s (4,161 stations).
- Node.js 24, 5,000 sections, **Linear**: `buildWing` 5.1 s, wing statistics 20 ms, 363 MB heap kept.
- Node.js 24, guide curve of 50,000 points: 5.1 to 6.1 s per build. The **Planform** tab opens in 6 s with 10,000 guide points and in 36 s at 3.4 GB with 50,000.

Build time without cached profiles: not measured in this run.
Build time and memory use on phones: not measured.

### Size warnings and limits

Sizes above a warning threshold work as usual. The build then adds 1 warning to the **Checks** tab: `Large project: <sizes>. Each change takes <time> and <memory> of browser memory.` Each size reads `<value> (warning above <threshold>)`, for example `250 sections (warning above 200)`. `<time>` reads `under 1 s` or `about X s`; `<memory>` reads `about X MB` or `about X GB`. When the estimated first build takes at least 1 s longer than a change (`firstBuildSeconds`), the warning ends with `Opening it or changing the profile parametrization takes <time>.` The first build runs after **Open**, for the restored autosave and after a change of **Profile parametrization**; it checks and fits every airfoil that a section uses again. The status bar counts the warning. When a size rises above its threshold (an edit, **Open**, the restored autosave), a short message shows the same text. Beyond a hard limit a desktop browser tab runs out of memory or a change takes about 1 minute; the app refuses such projects and changes.

| Size | Warning above (`WARN` in `src/model/budget.js`) | Hard limit (`LIMITS` in `src/model/project.js`) |
| --- | ---: | ---: |
| Sections | 200 | 20,000 |
| Airfoils | 200 | 10,000 |
| Points in one airfoil | 5,000 | 100,000 |
| Airfoil points in all | 100,000 | 1,000,000 |
| Points of a guide curve | 500 (enabled guide curves) | 20,000 |
| Loft grid points | 60,000 | 5,000,000 |
| Export triangles (STL, 3MF) | 2,000,000 | 10,000,000 |
| Export control points (STEP) | 1,000,000 | 3,000,000 |
| Characters in a name (project, airfoils) | 200 | 10,000 |

- Where the warnings appear: points in one airfoil in the airfoil preview (`many-points`); export triangles and STEP control points in the export dialog, which disables **Download** above 10,000,000 triangles or 3,000,000 control points; all other sizes in the `Large project` warning. The **Settings** tab shows `Loft grid: N points.` under the resolution fields, with the time and memory above 60,000 points.
- Further hard limits: ids 200 characters; airfoil source texts 2,000 characters; airfoil input 5,000,000 characters (`MAX_INPUT` in `src/airfoil/parse.js`); airfoil files above 20 MB are not read; the parser stops after 100,001 coordinate lines (`MAX_POINTS`); **Open** rejects project files above 100 MB unread (`MAX_PROJECT_BYTES` in `src/model/io.js`).
- Loft grid: spanwise stations × (2N + 1) profile points before added stations, N = **Chordwise stations per surface** (`loftGrid` in `src/model/budget.js`). Up to 5,000,000 grid points the build uses the settings as entered. Above, it uses fewer stations per panel and warns `Spanwise stations per panel reduced from K to k: S sections with N chord samples keep the loft within 5,000,000 grid points.` When 1 station per panel still exceeds the limit, the build stops with `The loft grid needs P points with one station per panel (S sections, N chord samples); the limit is 5,000,000. Reduce the chord samples or the sections.`

Estimate model: linear fits to the browser measurements above, JavaScript time without drawing the 3D view. The 3D view adds the drawing time of the graphics card. Phones: not measured. The coefficients are `COST` (each change) and `EXPORT` (export) in `src/model/budget.js`. Units: 1 MB = 1000 KB = 1,000,000 bytes.

| Unit (`COST`) | Time | Memory |
| --- | ---: | ---: |
| Base of each change | 0.2 s | 15 MB |
| Loft grid point | 11.5 µs | 0.65 KB |
| Airfoil list entry in the **Sections** table: sections × airfoils up to 20,000 entries (`LAZY_OPTIONS`), above that 1 per section | 8.5 µs | 0.5 KB |
| Airfoil point | 1.5 µs | 0.2 KB |
| Point of an enabled guide curve | 110 µs | 50 KB |
| Airfoil point, checks on import and first build of a wing that uses the airfoil (`airfoilFirstUse`: `many-points` warning and first build) | 30 µs | not used |
| Airfoil, first build whatever its points: curve sampling and crossing tests (`airfoilFirstBuild`: first build only) | 4.4 ms | not used |

| Export, per triangle (`EXPORT`) | Time | Memory | File |
| --- | ---: | ---: | ---: |
| STL | 0.8 µs | 210 bytes | 50 bytes |
| 3MF | 5.8 µs | 110 bytes | 11.5 bytes |
| STEP, per control point | 2.5 µs | 620 bytes | 98 bytes |

First build (`firstBuildSeconds`): the time of a change plus 4.4 ms per airfoil that a section uses plus 30 µs per point of these airfoils. Basis: 7.4 ms per airfoil of 99 points in Node.js 24 at 1,000 and 2,000 airfoils, of it 3 ms by the point term; not measured in the browser. Example: 20,000 sections (**Linear**, 16 **Chordwise stations per surface**: 660,000 loft grid points) and 10,000 airfoils of 99 points: `Each change takes about 9.5 s and about 650 MB of browser memory. Opening it or changing the profile parametrization takes about 83 s.`

The export memory adds the base of 15 MB. Tests: `test/budget.test.js` (thresholds, estimates, loft grid as the build computes it, shortened names), `e2e/limits.spec.js` (warning above 200 sections and the title of the **+** button, airfoil lists of large sections tables, export dialog note and the hard limit).

## Translations

The app speaks English (`en`) or German (`de`). The code is in `src/i18n/index.js`. English is the default, also in Node.js and in the unit tests.

At the start of the browser app, `initialLanguage()` picks the language:

1. A stored choice, when it names a language.
2. Otherwise German, when the first language of the browser is `de` or begins with `de-`.
3. Otherwise English.

The list **Language / Sprache** changes the language. It is the first group of the **Settings** tab and holds `English` and `Deutsch`. The choice is stored in `localStorage` under `wingdesigner.language`. Without browser storage, the choice lasts until the page closes. The label **Language / Sprache** and the two option names read the same in both languages and are no catalog entries.

To add a text:

1. Write the English text where it is shown: `tr('Created "{name}".', { name })`. The first argument is a string literal. A text is a whole sentence: no English fragments glued together.
2. Add the entry with the same key and the same placeholders to the file of its area: `'Created "{name}".': 'Entwurf „{name}“ angelegt.'`. A key without a German entry shows the English text.
3. Run `npm run i18n:check`. It names the file and line of a key without a German entry.
4. A text of the shell that is made once (top bar, tabs, view buttons, status bar, meta description) is registered in `shellLabels`, usually through `localized()` in `src/main.js`. `labelShell()` sets it again after a change of language. The panels take their texts from `tr()` when they are drawn or labelled again.

| File in `src/i18n/de/` | Texts of |
| --- | --- |
| `shell.js` | `src/main.js`, `src/ui/wizard.js`, `src/ui/settings.js` |
| `panels.js` | `src/ui/airfoils.js`, `src/ui/exportui.js`, `src/ui/viewer3d.js`, library data (see below) |
| `editors.js` | `src/ui/sections.js`, `src/ui/planform.js` |
| `model.js` | `src/model/` |
| `geom.js` | `src/geom/`, `src/export/` |
| `airfoil.js` | `src/airfoil/` |
| `xfl.js` | `src/import/xfl.js` |
| `xflxml.js` | `src/import/xflxml.js` |
| `flow5.js` | `src/import/fl5.js`, `src/import/fl5xml.js`, the flow5 texts of `src/import/xflr5.js` and `src/ui/xflr5.js`, and `flow5: <file>` in `src/ui/airfoils.js` |
| `xflr5.js` | `src/import/xflr5.js`, `src/ui/xflr5.js` and the texts of the XFLR5 import in `src/main.js` and `src/ui/airfoils.js`: title of **Open**, item in **Help**, count of further warnings, refusal of an XFLR5 file in the upload, `XFLR5: <file>` under an imported airfoil |
| `foam.js` | `src/ui/foam.js`, `src/export/foam.js` and the label and title of **Foam** in `src/main.js` |
| `winglet.js` | `src/ui/winglet.js`, `src/model/winglet.js` and the **Winglet…** button in `src/ui/sections.js` |

`src/i18n/de/index.js` merges the twelve files into `DE` and exports them by name as `AREAS`. The three files of the XFLR5 import hold 25, 34 and 146 texts, the file of the flow5 import 44.

To add a language:

1. Make a folder `src/i18n/<code>/` with the area files and an `index.js` that merges them, as `src/i18n/de/index.js` does.
2. Add `<code>: 'Name'` to `LANGUAGES` and `<code>: <catalog>` to `CATALOGS` in `src/i18n/index.js`. The list **Language / Sprache** shows `LANGUAGES`. `setLanguage()` accepts the codes of `CATALOGS`.
3. These places name German in the code and do not follow `LANGUAGES`. Each needs a rule for the new language:
   - `initialLanguage()` reads only `de` from the browser languages.
   - `fixed()`, `count()`, `whole()` and `plain()` compare the language with `'de'`.
   - `src/ui/styles.css` has rules `html[lang='de']` for the longer German labels.
   - The documentation link of the **Help** dialog in `src/main.js` chooses the page by `language() === 'de'`.
   - The `<noscript>` text in `index.html` names both languages.
   - `scripts/check-i18n.mjs` imports only `src/i18n/de/index.js`.
   - The label `Language / Sprache` (`LANGUAGE_LABEL` in `src/ui/settings.js`) names the list in English and German.
   - `scripts/screenshots.mjs` runs only `en` and `de` and looks labels up in `DE`. The wiki pages of a new language need their own image folder.
   - `PAGE_PAIRS` in `scripts/check-docs.mjs` and the rules in `scripts/check-test-counts.mjs` name only the English and the German pages.

Rules for texts:

- A plural is two keys, or a German entry that is a function of the params (`({ n }) => …`) and compares the printed number with `'1'`.
- Numbers inside a text go through four helpers. `fixed(value, digits)` writes `digits` decimals: `1200.5` in English, `1.200,5` in German. `count(value)` rounds to a whole number and groups the digits: `20,000` in English, `20.000` in German. `whole(value)` is for counts and limits that can have 4 or more digits: English prints `String(value)`, German groups an integer and never rounds. `plain(value)` prints the shortest text that reads back as the number (`String(value)`), with a decimal comma in German.
- Number fields are text fields with the role `spinbutton` (`numberField` and `numberInput` in `src/ui/dom.js`, also used by the wizard), because a native `<input type="number">` in Chromium drops a typed decimal comma. They show `inputText(value)`, which is `plain(value)`, and read the typed text with `readNumber(text)` from `src/i18n/index.js`: a decimal comma or point in both languages, the digit groups of the current language, rule in section Numbers of the [[User Guide|User-Guide]]. `aria-valuenow`, `aria-valuemin` and `aria-valuemax` hold plain JavaScript numbers.
- Data numbers (attributes, file contents) stay unformatted.
- Not translated: file contents (STEP, STL, 3MF, JSON, `.dat`), the project JSON, airfoil names, attributions and licenses, names of external sources, file names, cascading style sheets (CSS) classes, `data-*` values, option values and issue codes such as `many-points`. The text of an exception inside `Internal error: {message}` (thrown in `src/geom/nurbs.js` and `src/geom/linalg.js`) stays English; the frame around it is translated. The 3MF file declares `xml:lang="en-US"` in both languages.
- Code never compares a translated text. It compares a code or a recorded field (`issue.code`, `build.sizeWarning`), because the same message reads differently in German. The one text test, `/zero pivot/` in `src/geom/wing.js`, reads an exception from `src/geom/linalg.js` that is never translated.
- The descriptive texts of the library are data: `category` and `use` of `NACA_PRESETS` in `src/airfoil/library.js` and of the entries in `public/airfoils/index.json`, and the `note` of `EXTERNAL_SOURCES`. `libraryText()` in `src/ui/airfoils.js` shows them. A new text needs a `case` there with its own `tr()` literal and a German entry in `src/i18n/de/panels.js`. An unknown text is shown as it is.
- The **Documentation (wiki)** link in the **Help** dialog opens the wiki home in English and the page `Benutzerhandbuch` in German.
- `npm run i18n:check` (`scripts/check-i18n.mjs`, job `test` of `ci.yml`, also run by `test/i18n.test.js`) reads every `tr()` call in `src/` outside `src/i18n/`. It exits with code 1 when a key has no German entry, a German entry is unused, key and text entry differ in their placeholders, two areas translate one key differently, an entry is neither text nor function, or a `tr()` call does not start with a string literal. It does not compare the placeholders of function entries.
- `changeLanguage()` in `src/main.js` switches without a reload. It stores the choice, sets the `lang` attribute of the `html` element, relabels the shell and removes the notice, unless the notice reports an error. When the build holds an error or a warning other than the size warning, the wing is built again, because those messages come from the build. Otherwise the wing stays and the size warning is written again. In both cases the panels are drawn again, the **Checks** tab among them. The project, the selection and the undo history stay.

## Test data policy

| Data | Source |
| --- | --- |
| Airfoils in unit tests and STEP and 3MF cases | Generated from the NACA equations: `nacaAirfoil()` from `src/airfoil/naca.js`, `naca()` from `test/helpers.js` |
| Parser test inputs | Short synthetic strings in `test/airfoil.test.js` in the file formats of third-party sources, with invented coordinates |
| Browser test uploads | Generated in the spec files, no third-party data: 13-point `.dat` in `e2e/smoke.spec.js` and `e2e/mobile-layout.spec.js`; Selig, Lednicer, X/Yo/Yu percent table with decimal commas and invalid files (crossing surfaces, text) from the NACA 4-digit equations in `e2e/airfoils.spec.js` |
| Bundled library in browser tests | `e2e/airfoils.spec.js` lists the 6 files of `public/airfoils/` and adds S9104 to the project |
| Screenshot upload | NACA 4412 computed in `scripts/screenshots.mjs`, 14 x positions from 0 to 100 %, written as X/Yo/Yu percent table with decimal commas; the same file in both languages |
| XFLR5 files in unit tests and browser tests | `test/fixtures/xflr5/`: own work and files under the MIT license (license of the Massachusetts Institute of Technology), origin and license per file in `test/fixtures/xflr5/SOURCE.md` (section [XFLR5 test files and tests](#xflr5-test-files-and-tests)) |
| XFLR5 project files for edge cases | Written by `test/xflr5-writer.js` from the description of the format in `src/import/xfl.js`; no XFLR5 code |
| Airfoil uploads in the XFLR5 browser tests | Generated in `e2e/xflr5.spec.js`: `.dat` file `TEST 12` with 13 points, invented coordinates |
| Screenshot of the import dialog | `test/fixtures/xflr5/fixtures_v662.xfl`, opened over the **Sport** preset, in both languages |
| flow5 files in unit tests and browser tests | `test/fixtures/flow5/`: written by local builds of flow5 7.57 and 7.56 from own inputs, MIT, origin per file in `test/fixtures/flow5/SOURCE.md` (section [flow5 test files and tests](#flow5-test-files-and-tests)) |
| flow5 project files for other record formats | Written by `test/fl5-writer.js` from the description of the format; no flow5 code |

Third-party airfoil files are committed only under a license from the License row in [Airfoil library check](#airfoil-library-check). Third-party XFLR5 files are committed only under the MIT license (`test/fixtures/xflr5/uaslab/`).
Sources: [[Airfoil Sources|Airfoil-Sources]].
Parser test outside the repository on 2026-09-29: 1,964 third-party files from aerodesign.de, mh-aerotools.de and UIUC (University of Illinois Urbana-Champaign). Results per set: [[Airfoil Sources|Airfoil-Sources]], section Parser test.
Reader test outside the repository on 2026-09-29 and 2026-09-30: 29 `.xfl` files and 66 XML files, most of them of XFLR5 users, read by `src/import/` and by an independent reader written from the format description. Apart from the files listed below they are not committed (20 of the `.xfl` files carry no license). Results: [RECORD.md](https://github.com/subtilitas/Wingdesigner/blob/main/RECORD.md), row XFLR5 import.

### XFLR5 test files and tests

Files in `test/fixtures/xflr5/`; `test/fixtures/xflr5/SOURCE.md` gives the origin and the license of each:

| File | Bytes | Origin | License |
| --- | ---: | --- | --- |
| `fixtures_v662.xfl` | 11,092 | Own work: 2 test planes, "Fixture A" (main wing, elevator, fin, tilt angle, dihedral, twist) and "Fixture B" (no elevator), saved by the project writer of XFLR5 6.62 (Subversion trunk r1506, Qt 5.15.13); project format 200002 | MIT, as the project |
| `xml_mm/0.plane.xml`, `xml_mm/0.w2.wing.xml`, `xml_mm/0.w3.wing.xml` | 2,154 to 7,493 | Own work: plane "Fixture A" in millimetres, and its elevator and its fin as wing files, written by the XML writer of XFLR5 6.62 | MIT, as the project |
| `xml_in/0.plane.xml` | 7,494 | Own work: the same plane in inches | MIT, as the project |
| `xml_m/1.plane.xml` | 3,936 | Own work: plane "Fixture B" in metres | MIT, as the project |
| `uaslab/Rascal110.xfl` | 397,086 | UASLab/OpenFlightSim on GitHub, commit `b020511`: real XFLR5 output, project format 200001, inches, with body, 13-section main wing, 9-section elevator and flap airfoils at 0° | MIT (`uaslab/LICENSE.md`) |
| `uaslab/UltraStick25e.xml` | 16,852 | Same commit: XFLR5 plane file in inches | MIT (`uaslab/LICENSE.md`) |
| `uaslab/UltraStick25e_v662_stripped.xfl` | 28,418 | Same commit: `UltraStick25e.xfl` loaded and saved by XFLR5 6.62 without the analyses and results; project format 200002; the same plane as `UltraStick25e.xml` | MIT (`uaslab/LICENSE.md`) |

XFLR5 ships no sample projects. A local driver that links the XFLR5 6.62 sources (GNU General Public License, version 2 or later) wrote the own-work files. The driver is not part of this repository, so the repository cannot regenerate these files. The files contain no XFLR5 code.

Unit tests (Vitest, Node.js):

| File | Tests | Content |
| --- | ---: | --- |
| `test/xflr5-xfl.test.js` | 39 | Reader of `.xfl` projects: byte layout of `fixtures_v662.xfl`; the old formats of `Rascal110.xfl`; the reserved blocks of XFLR5 6.10.01 to 6.10.04; `UltraStick25e_v662_stripped.xfl` against `UltraStick25e.xml`; projects from `test/xflr5-writer.js` (analyses with control gains and result points, plane results, null strings, bodies, repeated airfoil names, flaps, sanitized positions); refused files (flow5, `.wpa`, JSON, size, counts, odd string lengths); damage (cut at every record boundary and at every byte, damage after the planes); windows of any size; German messages |
| `test/xflr5-xml.test.js` | 46 | Reader of XML files: fixtures in millimetres, inches and metres; wing files; units; syntax (byte order mark, text in 16-bit Unicode Transformation Format (UTF-16), comments, character data (CDATA) sections, entities, case, padded numbers, exponents); missing and garbled numbers; wing slots by `<Type>` and by order; refused files; limits; linear time on long and hostile input; German messages |
| `test/xflr5-map.test.js` | 68 | Mapping: y and z from developed span and dihedral, twist, position, the tilt angle stored as **Part tilt** (the turned build against XFLR5's construction); section planes of an import (mitred, tilted, fold and stretch fallback, an airfoil switch in one plane, the airfoil frame along a rolled plane with XFLR5's panel angles); clean-up (sections at one y, chords below 1 mm, limits); surfaces of a plane; airfoil sources, picks, uploads and flaps; airfoil frame against the numbers of Fixture A and B, also for NACA sections of the current project (generated and checked points, hand-edited metadata); report lines for current-project airfoils of an XFLR5 import, an upload or the library, and for library airfoils with an inclined chord line; a file airfoil whose trailing edge crosses its own end; an airfoil switch and a chord step at one y built with **Smooth**; project, JSON round trip and report; 10,000 airfoil names in linear time; German |
| `test/part.test.js` | 7 of 18 | Version 1 and 2 files: their part placement keys dropped; upgrade of a folded tilt of project format version 2: the same part with **Vertical** section planes (twist pivot 0.25 and 0.5, pointed tip, **Straight panels**) and the shift of the MAC position, the notes with **Mitred** section planes, the fold kept with guide curves or a twist beyond ±360° |
| `test/airfoil.test.js` | 1 of 79 | `leadingNacaCode` |

`test/xflr5-writer.js` writes big-endian XFLR5 project files from options with default values, written from the description of the format in `src/import/xfl.js`. Numbers that the reader skips are written as recognizable non-zero values, so a reader that skips too many or too few bytes misreads what follows. `writeProject(options)` returns `{ bytes, marks }`; `marks` lists the offset of every record for the truncation tests. The plane option `spare: 'index'` writes the reserved blocks of the plane and its wings as XFLR5 6.10.01 to 6.10.04 do.

Browser tests: `e2e/xflr5.spec.js`, 10 tests, 20 runs:

- XML plane file: the stabilizer with a NACA airfoil and an uploaded `.dat` file, then **Undo**.
- `.xfl` project with two planes: plane choice, a plane without stabilizer, airfoil notes kept after a reload; then a project from `test/xflr5-writer.js` with 300 airfoils: another surface checked in slices, with **Import** off and the table of the previous wing emptied.
- **Cancel** keeps the design and adds no undo step.
- A damaged `.xfl` project and an XML file with another root element give a message and keep the design.
- **Import** waits for an uploaded `.dat` file that is still being read.
- The file chooser of **Open** accepts XFLR5 files.
- **Open** recognizes XFLR5 files whose name lost its extension.
- The **Airfoils** upload refuses XFLR5 files, also an `.xfl` project above 20 MB.
- The import dialog fits a 360 px wide phone (`mobile` only).
- The dialog in German (locale `de-DE`).

### flow5 test files and tests

Files in `test/fixtures/flow5/`, written by local builds of flow5 from Wingdesigner's own inputs (planes, wings, airfoil choices); `test/fixtures/flow5/SOURCE.md` lists them with their content. The drivers that link the flow5 libraries (GPL-3.0) and the build changes for Ubuntu 24.04 are not part of the repository, so the repository cannot regenerate these files. The files contain no flow5 code.

| File | Bytes | Written by |
| --- | ---: | --- |
| `basic.fl5` | 8,648 | flow5 7.57: main wing, elevator, one-sided fin |
| `full.fl5` | 116,772 | flow5 7.57: 3 planes (6 wings and 3 bodies; a triangle mesh; one wing), an airfoil analysis with saved results, a flapped airfoil |
| `v756.fl5` | 85,968 | flow5 7.56: a sections body with its section points |
| `basic-plane.xml`, `basic-wing.xml`, `full-plane.xml`, `full-plane-files.xml` | 3,094 to 31,093 | flow5 7.57: plane and wing XML export in metres and millimetres, airfoils by name and by `.dat` file |
| `NACA 2412.dat`, `NACA 0009.dat`, `Flapped 2410.dat` | 2,782 to 2,785 | flow5 7.57: the airfoil files of the XML export |
| `mesh-nodes.json` | 132,240 | flow5 7.57: the analysis mesh nodes of 10 wings (8 two-sided, 2 fins), the reference of the geometry test |

Unit tests (Vitest, Node.js):

| File | Tests | Content |
| --- | ---: | --- |
| `test/flow5-fl5.test.js` | 9 | Reader of `.fl5` projects: the files of flow5 7.57 and 7.56; every body kind, airfoil analyses and results, mesh planes, the record formats of flow5 7.53 and older layouts from `test/fl5-writer.js`; the sections body with and without its section points; refusals; windows of 1,000 bytes |
| `test/flow5-xml.test.js` | 9 | Reader of flow5 XML: plane files in millimetres and metres, `.dat` file references, wing files, `Type` and booleans, units, several planes, refusals |
| `test/flow5-map.test.js` | 8 | Mapping: the wing list and the one-sided wing turned about z, a further wing, a fin as the left half of the part, roll and tilt as part placement, a rolled two-sided wing with the left half turned (`settings.leftHalf` `"turned"`), flow5 airfoils and their flaps, `.dat` files matched by name; the right half of 8 wings, the left half of both rolled two-sided wings and both fins within 0.15 mm of flow5's analysis mesh |

`test/fl5-writer.js` writes `.fl5` projects from the same description of the format, with the format number of each record selectable, so that the layouts of flow5 versions without a file at hand are tested.

Browser tests: `e2e/flow5.spec.js`, 3 tests, 6 runs:

- `.fl5` project: plane choice, the wing list, the rolled elevator imported as part roll and tilt with the left half turned (project format version 4), its airfoil from the file, **Undo**.
- flow5 plane XML with `.dat` file references: **Upload .dat files…** takes both files, each row finds its file by name.
- `.fl5` project: the fin imported with part roll 90° about the wing origin.

## Commands

Setup: `npm ci`. Requires Node.js 24 or later (`.nvmrc`: 24).
Browser tests and screenshots also need Chromium: `npx playwright install chromium` (Linux system libraries: `--with-deps`), or `PW_CHROMIUM` set to a local binary.

| Command | Runs | Result |
| --- | --- | --- |
| `npm run dev` | `vite` | Development server at `http://localhost:5173` (next free port when 5173 is in use) |
| `npm run build` | `vite build` | Static site in `dist/` |
| `npm run preview` | `vite preview` | Serves `dist/` at `http://localhost:4173` (next free port when 4173 is in use) |
| `npm run lint` | `eslint .` | Lint errors; exit code 1 on error |
| `npm test` | `vitest run` | Unit tests `test/**/*.test.js` in Node.js: 648 tests in 24 files |
| `npm run test:watch` | `vitest` | Unit tests, re-run on file change |
| `npm run coverage` | `vitest run --coverage` | Table on the terminal, `coverage/coverage-summary.json`, HyperText Markup Language (HTML) report in `coverage/`. Covers `src/**/*.js` without `src/ui/` and `src/main.js`. |
| `npm run coverage:readme` | `node scripts/coverage-readme.mjs` | Writes the coverage table into `README.md` and `README.de.md` between `<!-- coverage:start -->` and `<!-- coverage:end -->` |
| `npm run coverage:check` | `node scripts/coverage-readme.mjs --check` | Exit code 1 when a README table differs from `coverage/coverage-summary.json`; exit code 2 when that file or a marker is missing |
| `npm run airfoils:check` | `node scripts/check-airfoils.mjs` | Checks in [Airfoil library check](#airfoil-library-check); exit code 1 on a problem |
| `npm run e2e` | `npm run build && playwright test` | Browser tests in `e2e/` against `vite preview` on port 4173 |
| `npm run step:cases` | `node scripts/export-step-cases.mjs step-check` | 14 STEP files, 14 3MF files and `cases.json` in `step-check/` |
| `npm run foam:cases` | `node scripts/export-foam-cases.mjs foam-check` | Profile ZIP, SVG, DXF and PDF of 11 test wings and `cases.json` in `foam-check/` |
| `npm run screenshots` | `node scripts/screenshots.mjs` | 28 Portable Network Graphics (PNG) files: 14 in `docs/wiki/images/` (English) and 14 in `docs/wiki/images/de/` (German) |
| `npm run docs:check` | `node scripts/check-docs.mjs` | Documentation check; exit code 1 on a problem |
| `npm run counts:check` | `node scripts/check-test-counts.mjs` | Checks in [Test count check](#test-count-check); exit code 1 on a difference |
| `npm run i18n:check` | `node scripts/check-i18n.mjs` | Checks in [Translations](#translations); exit code 1 on a problem |

| Environment variable | Used by | Effect |
| --- | --- | --- |
| `PW_CHROMIUM` | `npm run e2e`, `npm run screenshots` | Path to a local Chromium binary instead of the Playwright download |
| `SHOT_DIR` | `e2e/smoke.spec.js` | Directory for the smoke-test screenshots `<project>-wizard.png`, `<project>-main.png`, `<project>-planform.png`, `<project>-upload.png`; `<project>` is `desktop` or `mobile` |

### Airfoil library check

`npm run airfoils:check` reads `public/airfoils/index.json` (array `airfoils`, 6 entries).
It prints each problem and exits with code 1 when at least 1 check fails.

| Check | Pass condition |
| --- | --- |
| Index | `airfoils` is an array |
| Required fields | `id` (unique), `name`, `file`, `category`, `source.author`, `source.license`, `source.url`, `source.terms` |
| License | `source.license` is one of `public-domain`, `CC0-1.0`, `Unlicense`, `CC-BY-4.0`, `CC-BY-3.0`, `MIT`, `BSD-2-Clause`, `BSD-3-Clause` |
| Source host | `source.url` and `source.terms` are Uniform Resource Locators (URLs); host is not `aerodesign.de` or `mh-aerotools.de` or a subdomain of these (terms: personal use only) |
| File | `public/airfoils/<file>` exists and imports without errors |
| Notice | When at least 1 entry exists: `public/airfoils/NOTICE.md` exists and contains the `name` of every entry |
| No unlisted file | Every file in `public/airfoils/` except `index.json` and `NOTICE.md` has an entry |
| NACA presets | All 17 NACA presets pass `checkAirfoil` |

### Browser tests

| Setting (`playwright.config.js`) | Value |
| --- | --- |
| Projects | `desktop`: Desktop Chrome, 1280 x 720 cascading style sheets (CSS) px. `mobile`: Pixel 7, 412 x 839 CSS px, device scale 2.625, touch input. |
| Server | `npm run preview -- --port 4173 --strictPort`; every run starts its own server (`reuseExistingServer: false`) |
| Timeouts | 60000 ms per test, 60000 ms for server start |
| Retries | 0 |
| Locale | `en-US` for all specs (the app starts in German on a German browser, and the specs assert English texts); `e2e/language.spec.js` and `e2e/xflr5.spec.js` set `de-DE` in their blocks `German browser` and `XFLR5 import in German` |
| Reporters | `list` on the terminal; `json` to `playwright-report/results.json`, input of the [Test count check](#test-count-check) |

200 tests in 15 spec files, 400 runs (both projects). The `test` object of `e2e/helpers.js` fails a test on any uncaught page error or console error.

31 tests run in one project only (`test.skip` in the other project):

| Spec file | `desktop` only | `mobile` only |
| --- | --- | --- |
| `e2e/mobile-layout.spec.js` | 1: sections table, brand, top bar in 1 row | 17: every test in `phone layout` (no sideways scroll, top bar, tap targets, section cards, tip note, 360 px wide phone, dialogs in portrait and landscape) |
| `e2e/viewer.spec.js` | 3: mouse drag rotates, right mouse button drag pans, mouse wheel zooms | 4: one-finger rotate, two-finger pan, two-finger pinch zoom, **Enlarge** |
| `e2e/planform.spec.js` | 1: zoom buttons, mouse wheel, double-click fit | 2: one-finger drag of a guide point, two-finger pinch zoom |
| `e2e/sections.spec.js` | 2: Ctrl+Z and Ctrl+Shift+Z, Ctrl+Y | 0 |
| `e2e/xflr5.spec.js` | 0 | 1: the import dialog fits a 360 px wide phone |

No test is marked `test.fail`.
`npm run e2e` rebuilds `dist/` first; before a direct `npx playwright test`, run `npm run build`.

### STEP and 3MF validation

Python: 3.12 in the `ci.yml` job `step`, 3.11.15 in a local run on 2026-09-30; other versions not tested.

```bash
pip install cadquery-ocp==8.0.1.0.0 lib3mf==2.5.0   # OpenCascade 8 Python bindings, 3MF Consortium library
npm run step:cases
python scripts/validate_step.py step-check/cases.json
python scripts/validate_3mf.py step-check/cases.json
```

`cases.json` holds per case: STEP file, 3MF file, expected volumes, tolerance `5e-4`, triangle count per mesh object.
Expected volume: volume of the half-wing mesh `tessellateHalf(build, { uRefine: 4, vRefine: 8 })`; every chordwise interval is split into 4, every spanwise interval into 8.
Both scripts print a JSON report.

| STEP check per file (`validate_step.py`) | Pass condition |
| --- | --- |
| Read | STEP reader returns `IFSelect_RetDone` |
| Solid count | Equals the expected count: 2 when mirrored, 1 for a half wing |
| Boundary representation (B-rep) validity | `BRepCheck_Analyzer` reports valid |
| Shell | Closed and consistently oriented: no free edges |
| Volume | Greater than 0; relative deviation from the expected volume at most `5e-4` (0.05 %) |
| Planar faces | At least 1; every edge of a planar face (the end caps) within `1e-6` mm of its plane, sampled at 51 points per edge. A cap off its plane can change the volume by less than 0.05 % (0.0475 % for a vertical tip cap on `mitred-gull-15-5`, 0.67 mm off). |

Exit code 1 when a check fails.

| 3MF check per file (`validate_3mf.py`) | Pass condition |
| --- | --- |
| Read | Reader in strict mode (`SetStrictModeActive`), 0 warnings |
| Objects | 1 mesh object per expected shell with the expected triangle count: 2 when mirrored (export mode `halves`), 1 for a half wing (export mode `right`) |
| Topology | Every object passes `IsManifoldAndOriented` |

Exit code 1 when a check fails or when `cases.json` holds no 3MF case.

Cases from `test/step-cases.js`. Base wing (`sampleProject()` in `test/helpers.js`, **Vertical** section planes):

| Section | y (mm) | x (mm) | z (mm) | Chord (mm) | Twist (°) | Airfoil |
| ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | 0 | 0 | 0 | 200 | 0 | NACA 2412 |
| 2 | 300 | 20 | 10 | 170 | -1 | NACA 2412 |
| 3 | 600 | 60 | 30 | 110 | -3 | NACA 0010 |

x and z: position of the leading edge.

| Case | Change from the base wing | Solids |
| --- | --- | ---: |
| `open-te-linear` | None: trailing edge as in the airfoil (open), linear blending | 2 |
| `closed-te-smooth` | Closed trailing edge, smooth blending | 2 |
| `guided-elliptic` | Nose line and end line, 4 points each; trailing-edge thickness 0.5 mm | 2 |
| `root-offset-half` | All sections moved by +35 mm in y (root at y = 35 mm); not mirrored | 1 |
| `reflex-closed` | NACA 23112 (reflexed) at sections 1 and 2, NACA 0008 at the tip; closed trailing edge | 2 |
| `cusped-closed` | Not the base wing: 3 sections of a synthetic airfoil with a closed, cusped trailing edge (`cuspedAirfoil` in `test/helpers.js`: zero thickness and zero wedge angle at the trailing edge, camber slope −0.7 there), chords 240, 168 and 96 mm at y 0, 600 and 960 mm, twist 0°, −2° and −3°; **Straight panels** | 2 |
| `pointed-tip` | Pointed tip, ratio 0.002 (1/500); trailing-edge thickness 0.4 mm | 2 |
| `pointed-elliptic-closed` | Pointed tip, ratio 0.005 (1/200); nose line and end line meet at x = 115 mm, y = 600 mm; closed trailing edge | 2 |
| `symmetric-0009` | NACA 0009 at every section | 2 |
| `mitred-vtail-35` | Not the base wing: 2 sections of NACA 0009, chords 120 and 70 mm, the tip 320 mm along a 35° panel, x 40 mm; **Straight panels**, **Mitred** section planes (tip cap rolled 35°) | 2 |
| `mitred-vtail-35-y-up` | As `mitred-vtail-35`, written with the **Fusion 360 fix** (Y up): every point as (x, z, −y) | 2 |
| `mitred-gull-15-5` | z 80.3848 mm at section 2 and 54.1382 mm at the tip (panels of 15° and −5°); **Mitred** section planes (rolls 0°, 5°, −5°), linear blending with 8 stations per panel | 2 |
| `mitred-switch-short-panel` | Not the base wing: NACA 2412 at y 0 and 299.5 mm (chords 200 and 180 mm), NACA 0012 at y 300 and 600 mm (chords 180 and 120 mm, tip z 52.8981 mm, twist −2°); **Straight panels**, **Mitred** section planes: the 0.5 mm panel counts as none, both switch sections roll 5.25°; the outer panel stores a panel angle of 10.5° (tip roll 10.5°) | 2 |
| `part-tilt-roll` | As `mitred-gull-15-5`, with **Part tilt** 8° and **Part roll** 12° about the pivot (50, 0, −20) mm: turned surfaces, edge curves, cap planes and the mirror of a placed part | 2 |

### Foam-cutting file validation

Python: 3.12 in the `ci.yml` job `foam`, 3.11.15 in a local run on 2026-10-01; other versions not tested.

```bash
pip install ezdxf==1.4.4 pypdf==6.19.0
npm run foam:cases
python scripts/validate_foam.py foam-check/cases.json
```

`scripts/export-foam-cases.mjs` takes the wings of `test/step-cases.js` without `mitred-vtail-35-y-up` and `part-tilt-roll` (11 cases): the first differs from its case in the STEP axes only, the cores of the second lie in the frame of the part, as those of `mitred-gull-15-5`. Cuts: the proposal for a longest core of 300 mm. Kerf 1 mm for `guided-elliptic`, paper A3 for `pointed-tip` and Letter for `mitred-gull-15-5`, else no kerf and A4. `cases.json` holds per case the name, the 4 files, the segment count, the points per profile, the kerf, the vertex count of each profile polyline, the page count, the page size and the paper size.

| Check per case (`validate_foam.py`) | Pass condition |
| --- | --- |
| ZIP | `README.txt`, `segments.csv` and per segment end a file in `mm/` and in `normalized/`, nothing else; every `.dat` file has its name line and the expected point count; `segments.csv` has one row per segment |
| DXF | ezdxf recover module reads it, its audit has no error, version `AC1009`; layer `PROFILE` holds closed polylines with the expected vertex counts; without kerf, width and height of each polyline equal those of its `mm/` `.dat` file within 0.001 mm |
| SVG | parses as XML; width and height in mm; one `polygon` of class `profile` per segment end |
| PDF | pypdf reads it in strict mode; page count as computed; every page at the computed size (mm, 0.01 mm); the text of page i holds `Page i of n.` |

Exit code 1 when a check fails or when `cases.json` holds no case. The script prints a JSON report.

## Documentation

| English | German |
| --- | --- |
| `README.md` | `README.de.md` |
| `Home.md` (both languages) | `Home.md` (both languages) |
| `User-Guide.md` | `Benutzerhandbuch.md` |
| `Geometry.md` | `Geometrie.md` |
| `File-Formats.md` | `Dateiformate.md` |
| `Airfoil-Sources.md` | `Profilquellen.md` |
| `Development.md` | `Entwicklung.md` |

Wiki pages are in `docs/wiki/`.
The Docs workflow mirrors `docs/wiki/` into the repository wiki with `rsync --delete`.
On the next run, pages edited in the wiki web interface are overwritten, and pages added there are deleted.

| Repository file (English only) | Content |
| --- | --- |
| [RECORD.md](https://github.com/subtilitas/Wingdesigner/blob/main/RECORD.md) | Verified state, decisions with reasons, measurements, open items |
| [CHANGELOG.md](https://github.com/subtilitas/Wingdesigner/blob/main/CHANGELOG.md) | Version history |
| [docs/Handover.md](https://github.com/subtilitas/Wingdesigner/blob/main/docs/Handover.md) | Where the work stands, next steps, working agreements with the owner, what the repository does not hold |
| [docs/Flow5upgrade.md](https://github.com/subtilitas/Wingdesigner/blob/main/docs/Flow5upgrade.md) | Plan and owner decisions for mitred section planes, a rigid tilt of the whole part and the flow5 import |

### Screenshots

`npm run screenshots` regenerates all images. It builds the site, serves it on port 4175 and drives Chromium with Playwright. It produces every image twice:

| Folder | Interface language | Browser locale |
| --- | --- | --- |
| `docs/wiki/images/` | English | `en-US` |
| `docs/wiki/images/de/` | German | `de-DE` |

Both folders hold 14 files with the same names and the same states. The English wiki pages embed `images/<name>.png`, the German pages `images/de/<name>.png`.

The two languages run the same steps. The steps name every control by its English label. The German run maps that label to its German entry in `DE` (`src/i18n/de/index.js`) and stops when there is no text entry. Both runs stop when the app starts in another language than the locale asks for (`lang` attribute of the `html` element). The text `Sample 4412 table` in `upload-preview.png` is the first line of the generated file and reads the same in both languages.

Desktop: 1280 x 800 CSS px, device scale 1. Phone: Pixel 7, device scale 2.625. Light color scheme. The German texts are longer, so the size of some German images differs.

| File | State | Size (px), English | Size (px), German |
| --- | --- | --- | --- |
| `wizard.png` | Wizard, **Glider** preset | 960 x 784 | 960 x 784 |
| `main-desktop.png` | Full window after creating the **Glider** | 1280 x 800 | 1280 x 800 |
| `sections.png` | **Sections** tab, **Glider**, 3 sections | 600 x 730 | 600 x 730 |
| `planform.png` | **Planform** tab, **Glider**, nose line and end line on | 600 x 730 | 600 x 730 |
| `airfoils.png` | **Airfoils** tab, **Glider** | 600 x 730 | 600 x 730 |
| `upload-preview.png` | Upload preview of a synthetic X/Yo/Yu percent table with decimal commas, opened over the **Glider** | 640 x 646 | 640 x 710 |
| `export-dialog.png` | **Export** dialog, **Glider** | 640 x 548 | 640 x 594 |
| `settings.png` | **Settings** tab, **Glider** | 650 x 730 | 650 x 730 |
| `checks.png` | **Checks** tab, **Glider** | 600 x 730 | 600 x 730 |
| `flying-wing-control-net.png` | 3D view, **Swept flying wing**, **Show NURBS control net** on | 680 x 730 | 680 x 730 |
| `mobile-main.png` | Phone, **Sport** preset | 1082 x 2202 | 1082 x 2202 |
| `mobile-planform.png` | Phone, **Planform**, **Sport**, end line on | 1082 x 2202 | 1082 x 2202 |
| `foam-dialog.png` | Foam-cutting wizard, **Glider**, after **Split segments over the limit**, window 1280 x 1400 CSS px | 960 x 1344 | 960 x 1384 |
| `xflr5-import.png` | Dialog **Import from XFLR5** for `test/fixtures/xflr5/fixtures_v662.xfl`, opened with **Open** over the **Sport** preset, window 1280 x 1200 CSS px | 960 x 966 | 960 x 1062 |

### Documentation check

`npm run docs:check` checks `docs/wiki/*.md`, `README.md`, `README.de.md` and the version sections of `CHANGELOG.md`:

| Check | Fails when |
| --- | --- |
| Page pairs | A file of the 6 English–German pairs above is missing (`Home.md` excluded) |
| Coverage markers | `README.md` or `README.de.md` lacks `<!-- coverage:start -->` or `<!-- coverage:end -->` |
| Wiki links | The target page of a wiki link (double square brackets) has no file in `docs/wiki/` |
| Wiki links in tables | Pages as markdown-it 15 reads them (CommonMark with GitHub tables and HTML; fenced code, block quotes and the end of a table follow the Markdown rules): a table cell holds, outside code spans, an opening double square bracket without the closing one, because the `\|` of a labelled wiki link ended the cell; or a header and delimiter row form no table, because a `\|` in the header gave it more cells. In tables a wiki link holds only the page title, with spaces for the hyphens of the page name (`User Guide` links to `User-Guide`). |
| Images | An embedded image file does not exist, or its alt text is empty |
| Relative links | The target of a relative Markdown link does not exist |
| Release texts | `CHANGELOG.md` is missing, or a line of it from the first `## ` heading on names contributor material (`INTERNAL_TERMS`, `sourceNames` and `formatKeys` in `scripts/check-docs.mjs`): the handover; the working agreements (with the owner); `RECORD`; an npm command (`npm run`, `test`, `ci`, `install`, `i`, `exec`, `start`, `version`, `publish`) or `npx`; a path under `scripts/`, `test/`, `e2e/`, `src/`, `public/` or `.github/`, also after `./` or in a GitHub `blob` or `tree` link on any branch; `ci.yml`, `docs.yml` or `release.yml`; `CI`, continuous integration, GitHub Actions or a workflow run; unit, browser, end-to-end, e2e, integration, regression, smoke, snapshot, component, acceptance or automated tests, a test suite, run, case, file or count, Vitest, Playwright, a `.spec.js` file; test coverage (`test`, `code`, `line`, `branch`, `statement` or `V8` before `coverage`, or `check`, `table`, `report` or `marker(s)` after it); the Development page (`[[Development`, or Development before `page`, `wiki`, `, section` or `/ Entwicklung`; Entwicklung likewise); in backticks: a function call (`name()`, `name(arguments)`), a function, method or class name in camelCase or PascalCase that `src/` declares (`buildWing`, `updateLabels`), or an upper-case constant of 3 or more characters that `src/` declares (`LIMITS`, `FRAME_TOLERANCE`). Bare names of the project file that File Formats documents (JSON keys and first table cells, such as `sectionPlanes`) pass, a call such as `sectionPlanes(project)` does not; and so do STEP entity names such as `MANIFOLD_SOLID_BREP`, which `src/` does not declare. Code spans pair over the whole text, as in Markdown, so a span that wraps to the next line counts. Each line is read together with the next one, so a term broken over two lines is found, also after trailing spaces and with CRLF line ends. |

Paths resolve against `docs/wiki/` for wiki pages and against the repository root for the READMEs.
Not checked: language switch line, alt text language, link target language, link anchors (`#…`), external links (`http:`, `https:`, `mailto:`), contributor material in other words than the listed terms.

### Test count check

`npm run counts:check` derives every test count that `README.md`, `README.de.md`, `RECORD.md`, Development, Entwicklung, Geometry and Geometrie state from the suites.
Exit code 1 when a stated number differs or a statement is not found; `scripts/check-test-counts.mjs` holds each statement as a pattern with the number of times it occurs. It also checks the tests of one file wherever a page states them: a table row that starts with the path of a test file in backticks and a count (all tests of the file) or `<n> of <m>` (`<m>` all tests of the file), and the path followed by `(<n>)`.

| Count | Source |
| --- | --- |
| Unit tests and test files | `vitest list --staticParse=false`: runs the test files to collect the tests, so a test inside a loop counts once per pass. The default static parse counts it once. |
| Browser tests, spec files, runs; tests of `e2e/limits.spec.js` per project | `playwright test --list --reporter=json`; no browser, no server |
| Tests that run in one project only (total and per spec file), passed and skipped runs in `RECORD.md` | JSON report of a run, given with `--e2e-report <file>`. `test.skip` decides at run time. Without a report these numbers are not checked; the passed, skipped and failed runs in `RECORD.md` still have to add up to the runs. With a report, a run with a failed test fails the check. |
| Sentence `No test is marked test.fail.` | Present only while no test in the listing or the report expects to fail |
| STEP and 3MF validation cases: count; names in order and solids (2 when mirrored, else 1) in the case table | `stepCases()` in `test/step-cases.js` |

```bash
npm run counts:check                                                                # without the device-only counts
npm run e2e && npm run counts:check -- --e2e-report playwright-report/results.json  # all counts
```

Continuous integration (CI) runs it in the job `test` without a report and in the job `e2e` with the report of that job's run.
Not checked: `CHANGELOG.md` (it records changes, with the counts of their time).

## Continuous integration (CI)

Platform: GitHub Actions, runner `ubuntu-latest` for every job.

| Workflow | Trigger | Permissions | Content |
| --- | --- | --- | --- |
| `ci.yml` | Push to `main`, pull request, manual | Workflow: `contents: read`; jobs `build` and `deploy`: see the next table | Jobs in the next table. Concurrency group `ci-<ref>`. On `main` an active run is not cancelled. At most 1 later run waits; a newer run replaces the waiting one. On other refs a later run cancels the active one. |
| `docs.yml` | Push to `main` that changes `docs/wiki/**` or `.github/workflows/docs.yml`; manual | `contents: write` | Job `wiki`: clones `<repository>.wiki.git` with `GITHUB_TOKEN`, copies `docs/wiki/` with `rsync --delete`, commits `Update wiki from <first 7 characters of the commit hash>` and pushes. No commit when nothing changed. Concurrency group `wiki`: an active run is not cancelled. |
| `release.yml` | Push of a tag `v*` | `contents: write` | Job `release`: steps in [Release](#release) |

Every `ci.yml` job except `deploy`, and the `release.yml` job, check out the repository, set up Node.js from `.nvmrc` with npm cache and run `npm ci`.
The `docs.yml` job `wiki` only checks out.

| `ci.yml` job | Name | Steps | Permissions | Runs on |
| --- | --- | --- | --- | --- |
| `test` | Lint, unit tests, coverage | `lint`, `coverage`, `coverage:check`, `airfoils:check`, `docs:check`, `counts:check`, `i18n:check`; uploads artifact `coverage` | `contents: read` | Every trigger |
| `step` | STEP and 3MF validation (OpenCascade, lib3mf) | Python 3.12, `pip install cadquery-ocp==8.0.1.0.0 lib3mf==2.5.0`, `step:cases`, `validate_step.py`, `validate_3mf.py`; uploads artifact `step-files` (STEP, 3MF, `cases.json`) | `contents: read` | Every trigger |
| `foam` | Foam-cutting files (ezdxf, pypdf) | Python 3.12, `pip install ezdxf==1.4.4 pypdf==6.19.0`, `foam:cases`, `validate_foam.py`; uploads artifact `foam-files` (ZIP, SVG, DXF, PDF, `cases.json`) | `contents: read` | Every trigger |
| `e2e` | Browser tests (Playwright) | `npx playwright install --with-deps chromium`, `npm run e2e` (build, then all specs in `e2e/`, both projects), `counts:check -- --e2e-report playwright-report/results.json`; on failure uploads artifact `playwright-results` (`test-results/`) | `contents: read` | Every trigger |
| `build` | Build site | `build`; on push to `main` also `configure-pages` and `upload-pages-artifact` with `dist/` | `contents: read`, `pages: read` | Every trigger |
| `deploy` | Deploy to GitHub Pages | `deploy-pages` to environment `github-pages`. Concurrency group `pages`: an active run is not cancelled. | `pages: write`, `id-token: write` | Push to `main`, after `test`, `step`, `foam`, `e2e` and `build` pass |

Artifacts `coverage`, `step-files` and `foam-files` are uploaded also when a step fails; `playwright-results` only when a step fails. All 4 are kept 14 days.
The pip cache keys are `pip-ocp-<runner operating system>-8.0.1-lib3mf-2.5.0` (job `step`) and `pip-ezdxf-<runner operating system>-1.4.4-pypdf-6.19.0` (job `foam`).

| Action | Version | Used in |
| --- | --- | --- |
| `actions/checkout` | `v7` | `ci.yml`, `docs.yml`, `release.yml` |
| `actions/setup-node` | `v7` | `ci.yml`, `release.yml`; Node.js version from `.nvmrc`, npm cache |
| `actions/setup-python` | `v7` | `ci.yml` jobs `step`, `foam` |
| `actions/cache` | `v6` | `ci.yml` jobs `step`, `foam` (`~/.cache/pip`) |
| `actions/upload-artifact` | `v7` | `ci.yml` jobs `test`, `step`, `foam`, `e2e` |
| `actions/configure-pages` | `v6` | `ci.yml` job `build` |
| `actions/upload-pages-artifact` | `v5` | `ci.yml` job `build` |
| `actions/deploy-pages` | `v5` | `ci.yml` job `deploy` |

All listed actions run on Node.js 24 (`runs.using: node24`); `upload-pages-artifact` is a composite action on `upload-artifact@v7`.

CI does not rewrite the README coverage tables.
Update them with `npm run coverage && npm run coverage:readme` and commit both READMEs.

The wiki clone in `docs.yml` requires the repository wiki to exist; GitHub creates it with the first page saved in the web interface.

## Release

`<version>`: the version to release, e.g. `0.6.0`. `package.json` holds `0.5.0`.

1. Set the version: `npm version <version> --no-git-tag-version` (updates `package.json` and `package-lock.json`).
2. In `CHANGELOG.md`, move the entries under `## [Unreleased]` to a heading `## [<version>] - YYYY-MM-DD`. The section becomes the release notes: it describes the app, its files and its user documentation (README, User Guide, Geometry, File Formats, Airfoil Sources) and leaves out the handover, `RECORD.md`, the working agreements, continuous integration, tests, scripts, this page and the names of the source code. `npm run docs:check` reports the terms it knows (Documentation check).
3. Commit and merge to `main`. Wait until `ci.yml` passes.
4. Tag the merge commit of the release pull request `<number>` and push the tag. The tag names that commit, not the tip of `main`, which can hold later changes. The pull request page on GitHub shows the same commit.

   ```bash
   git fetch origin main
   c=$(git log origin/main --merges -1 --format=%H --grep='^Merge pull request #<number>[^0-9]')
   test -n "$c" && git show -s --format='%h %s' "$c" && git tag v<version> "$c" && git push origin v<version>
   ```

`release.yml` then runs:

| Step | Fails or produces |
| --- | --- |
| Tag check | Fails when the tag is not `v` + `package.json` `version` |
| `npm run lint`, `npm test`, `npm run build` | Fails on lint error, test failure or build error |
| Package | `wingdesigner-<tag>-site.zip` with the content of `dist/`: `index.html`, `LICENSES.txt`, `assets/` (script and source map), `airfoils/` |
| GitHub release | Title `Wingdesigner <tag>`, the zip file as asset. Notes: the `CHANGELOG.md` section from `## [<version>]` to the next `## ` heading; `See CHANGELOG.md.` when the section is missing. Then a paragraph on use: unzip, open `index.html` (tested in Chromium) or serve the folder with a static web server; `LICENSES.txt` holds the licenses. |

`release.yml` runs no coverage check, no airfoil library check, no documentation check, no STEP validation, no 3MF validation and no browser tests.

After `release.yml` has published the release, a new pull request from `main` enters the tag commit, the `release.yml` run, the date and the size of the zip file in `RECORD.md`, row CI, and updates the rows Version, Next release and `main` of `docs/Handover.md`.
