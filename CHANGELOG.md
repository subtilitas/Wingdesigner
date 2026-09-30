# Changelog

All notable changes to this project are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed

- Wizard: **Dihedral per half** accepts −60 to 60° (−15 to 30° before), for V-tails and inverted
  V-tails. 60° is the steepest first panel that **Mitred** section planes build (stretch 2 at the
  vertical root). Every preset with both planforms, both tips and 2 to 8 sections builds at −60,
  −55, −45, −30, 30, 35, 45, 50, 55, 59.5 and 60° (1,056 builds, no error). A short, steep V-tail
  with many sections folds at its root and keeps **Create design** disabled with the build error:
  Tail surface at 100 mm span with 8 sections and 55°; from 200 mm span, 2 to 8 sections build up
  to 60°.
- XFLR5 import: every airfoil frame applies exactly. The leading edge of the fitted curve lies up
  to 1e-3 of the chord off the nose point of real files (32 of 64 airfoil entries); dropping such
  offsets put sections up to 0.30 mm off XFLR5's placement (NACA 4415, 391 mm chord). Offsets up to
  1e-9 of the chord count as round-off. `FRAME_TOLERANCE` (0.1 % of the chord) decides only whether
  the report names the move. The report line says "scaled" only when its figures show a chord other
  than 100 %. Against XFLR5's STL of 93 real surfaces, 19 lie closer (NACA 4415 0.094 mm instead of
  0.325 mm, Clark YS 0.883 mm instead of 1.008 mm) and 32 lie 0.012 to 0.078 mm farther: the dropped
  offset had pointed against XFLR5's straight-segment sag or a construction difference (flat wings
  of `Wing Design and Analysis.xfl` 0.277 mm instead of 0.229 mm). 284 random parts: 0.033 mm
  instead of 0.151 mm.
- File Formats, section Differences from XFLR5: the distances to XFLR5's STL split into airfoil
  interpolation (largest part on 58 of 93 surfaces), construction (23: twist shear, vertical planes
  of tilted parts, chordwise stations) and flaps (12), each with its mechanism and size. The flap
  row names XFLR5's hinge-split chordwise points (2.41 and 2.62 mm) besides the deflection (1.61 and
  1.76 mm).

## [0.2.0] - 2026-09-30

### Added

- Spanwise interpolation **Straight panels (straight lines between sections, as XFLR5)**
  (`settings.spanwise` `"straight"`): every point of a section joins the point of the same chord
  fraction of the next section in a straight line, as XFLR5 builds its panels. Stations lie at the
  sections only, and no stations are added. A guide curve on stops the build with a message.
- Setting **Section planes** (`settings.sectionPlanes`): **Mitred (square to the panels, as XFLR5)**,
  the default, or **Vertical (y = const)**, the planes of 0.1.0. Mitred planes keep the root
  vertical, put a section between two panels in their bisector plane and the tip square to the last
  panel, and stretch each airfoil in thickness by 1/cos of the angle between its plane and the
  panel, as XFLR5 and flow5 do. The wing is as thick across every panel as its airfoil; vertical
  planes give cos δ (81.9 % on a 35° V-tail). A panel less than 1 mm wide in y counts as no panel:
  the sections at its ends share the bisector plane of the panels around it, as XFLR5 does for
  panels shorter than 0.1 mm. **Linear** panels between planes of different roll get the spanwise
  stations per panel and a cubic loft. **Smooth** builds vertical planes, with an info line in
  Checks. Meshes, STEP caps and the project JSON follow the rolled end planes; `derived.stations[]`
  carries `roll` and `stretch`.
- Build errors of mitred planes: a stretch above 2 (60° between plane and panel; a plane that rounds
  to 60.0° builds, and the message gives the stretch to 3 decimals, `2.366 times` for a first panel
  at 65°); with **Straight panels**, planes of neighbouring sections that meet within the airfoils;
  with **Linear**, planes that turn along a panel faster than its airfoils allow, at a section for
  both panels next to it; and planes of neighbouring stations that cross within the airfoils after
  the fit.
- Section field `panelAngle` and the Sections column **Panel angle** (shown with **Mitred** and
  **Linear** or **Straight panels**): the angle of the panel to the next section that the mitred
  planes use for rolls and stretches, −89.9999 to 89.9999°. Empty: the dihedral from y and z, shown
  as `auto 1.5`. It stays when a section moves; **+** halfway along a panel copies it.
- Export checkbox **Fusion 360 fix: Y up (also SolidWorks)** (STEP, STL, 3MF): writes every point
  (x, y, z) as (x, z, −y), so the upper surface faces +Y. CAD programs with Y as the up axis show a
  Z-up file on its side: Fusion 360 set to Y up showed the side of the wing in its top view. The
  checkbox starts as it was at the last export (browser storage, key `wingdesigner.upAxis`); the
  project JSON keeps the axes of the app.
- Info lines in the Checks tab, after errors and warnings.
- `npm run counts:check` also checks the unit tests of one file where a page states them: a table
  row with the path of a test file and a count or `<n> of <m>`, and the path followed by `(<n>)`.
- `scripts/validate_step.py` checks that the edges of every planar face (the end caps) lie in the
  plane within 1e-6 mm. `test/step-cases.js` adds a mitred 35° V-tail (also written with the Fusion
  360 fix), a mitred 15°/−5° gull and a mitred airfoil switch with a stored panel angle: 12 cases.

### Changed

- Project format version 2. A version 1 file opens with **Vertical** section planes, as designed; an
  app that reads version 1 only refuses a version 2 file. New projects, the wizard and the sample wing
  get **Mitred**: a preset with dihedral builds more stations (Sport, Trainer, Plank: 9 instead of 2;
  sample wing: 17 instead of 3). The Sport wing has 1.4 % less volume, because the loft follows the
  **Linear** blend exactly instead of a ruled surface 0.343 mm off it.
- XFLR5 import: the project gets **Straight panels** instead of **Linear**, and an untilted part
  **Mitred** section planes. Where airfoil frames move the two sections of a panel differently, the
  section stores XFLR5's dihedral as `panelAngle` (difference above 0.001°), so the planes and
  stretches are XFLR5's. Two sections at one y (an airfoil switch, moved 0.5 mm apart) share one
  plane. A tilted part imports with **Vertical** section planes and stores its folded tilt
  (`foldedTilt`: angle, pivot x and z); a part whose mitred planes would fold or stretch an airfoil
  more than 2 times imports vertical too. The report names the section planes and the reason; a
  tilted part set to **Mitred** later gets a warning with the estimated distance from XFLR5's part.
  Against the STL that the code of XFLR5 6.62 writes (largest distance of an XFLR5 vertex from the
  built surface, first with **Linear** and **Vertical**, the settings of the 0.1.0 import, then as
  0.2.0 imports): `UltraStick120.xfl` main wing 4.17 and 0.04 mm,
  `UltraStick25e.xfl` main wing 2.00 and 0.03 mm, the 4 untilted 35° V-tails of
  `initialAerodynamicSym.xfl` 2.87 and 0.013 mm, the 40° V-tail of `mini_talon.xfl` 2.31 and
  0.025 mm; 80 of 93 real surfaces lie within 0.6 mm.
- Settings: the option **Linear between sections (straight panels)** reads **Linear between
  sections**; linear panels bend where the chord changes together with the airfoil or the twist.
- The side panel is up to 650 px wide (600 px in 0.1.0), so the Sections table keeps its row buttons
  in view with the **Panel angle** column; the German headers **Schränkung** and **Feldwinkel** break
  at a soft hyphen.

### Fixed

- 3D view after a reload: the empty status bar was 17 px lower at start-up, so the first camera fit
  took a 3D view 17 px higher than the one that followed. A 3D view narrower than high (a desktop
  window with the 650 px side panel, or a narrow window) then showed the wing smaller after a reload
  than after **New**. The status bar keeps the height of one line from the start.
- Airfoil check: a crossing of the first and the last outline segment does not count when their free
  ends lie at most 1e-4 of the chord apart (`TE_CROSS_TOLERANCE`, the limit of `te-crossed`). 19 UIUC
  files that start at x = 1.00000 and end at x = 1.00001 (`sd7003.dat`, `sd8000.dat` and others)
  and the aerodesign.de copies of `s3021.dat` and `sd7080.dat` load; the main wing of the XFLR5
  project `Gertie.xfl` (airfoil SD8000-089-88) imports.
- XFLR5 import: `.xfl` projects of XFLR5 6.10.01 to 6.10.04 read. These versions write the index
  into the reserved blocks of wings and planes (0 to 19 and 0 to 49), which the reader refused as
  damage.
- XFLR5 import: a library airfoil whose chord line is inclined more than 0.5° gets a warning with the
  angle and the trailing-edge offset at the largest chord of its sections, in place of the info line
  of the airfoil check. The Library Clark Y (2.00° nose up) picked for a level copy such as the UIUC
  `CLARK Y AIRFOIL` sits 2.00° more nose up than in XFLR5: 14.0 mm at the trailing edge of a 400 mm
  chord.

## [0.1.0] - 2026-09-30

### Added

- Language: the interface speaks English or German. The list **Language / Sprache** in the first
  group of the Settings tab switches every text without a reload; the project, the selection and the
  undo history stay. The app starts in the stored choice, else in German when the first language of
  the browser is German, else in English; the choice is stored in the browser under
  `wingdesigner.language`. German texts: top bar, tabs, tooltips and accessible labels, status bar,
  all tabs, the wizard, export, Help and airfoil preview dialogs, notices, Checks with build errors
  and warnings, airfoil check messages, size warnings, export notices and the descriptions of the
  library entries. German numbers use the decimal comma and a dot between thousand groups
  (`1.234,5`). A notice that is showing disappears at a switch; an error notice stays until its
  display time ends. The wiki link of Help opens the German user guide (Benutzerhandbuch) in the
  German interface. The longer German labels take the top bar to a second row at a window width of
  563 px or less (Chromium 141: 2 rows at 563 px, 1 row from 564 px). At 420 px or less the German
  row wraps instead of scrolling sideways. File contents, airfoil names, attributions, license
  identifiers and texts typed by the user are not translated. The English text is unchanged,
  with one exception: the `<noscript>` line of `index.html` names both languages, because JavaScript
  cannot translate it. The browser tests run with the locale `en-US`; `e2e/language.spec.js` (16
  tests) sets `de-DE` in its block `German browser`.
- `npm run i18n:check` (in continuous integration, CI): exit code 1 when a text in `src/` has no
  German entry, a German entry is unused, key and entry differ in their `{placeholders}`, two areas
  translate one text differently, an entry is neither text nor function, or a `tr()` call does not
  start with a string literal.
- XFLR5 import: **Open** also takes an XFLR5 project (`.xfl`, XFLR5 6.10.01 to 6.62, project formats
  200001 and 200002) and an XFLR5 plane or wing file (`.xml`, Extensible Markup Language, XFLR5 6.11
  to 6.62), and imports one surface from it, the main wing or the horizontal stabilizer (XFLR5 calls
  it the elevator), in place of the current project as one undo step. The dialog **Import from
  XFLR5** asks for the plane and the surface, draws the planform of the result and lists every value
  that the import converts, changes or leaves out as error, warning or info. **Import** stays off
  while an airfoil name has no airfoil or the wing cannot be mapped. An `.xfl` project holds its
  airfoils. An XML file names them only: the dialog looks each name up in the uploaded `.dat` files,
  the current project, the bundled library, the NACA (National Advisory Committee for Aeronautics)
  generator and among similar names, and every
  row takes another airfoil or an uploaded `.dat` file. The sections follow XFLR5's own geometry:
  `y_position` runs along the panels, the dihedral of a section is the angle of the panel outboard
  of it, twist turns about the quarter chord, and the tilt angle and the position of the wing in the
  plane are applied. A section is moved and scaled by the position of the coordinates of its
  airfoil, so that an airfoil of the file, an uploaded `.dat` file or a NACA section (also one of
  the current project) lies where XFLR5 draws it. The project gets straight panels, a twist pivot of 0.25 and the trailing edge as
  in the airfoils. Flaps are imported undeflected, with a notice. Sections that share one
  `y_position` move apart by at most 0.5 mm, with a warning. The fin, the second wing, the body,
  the masses and the analyses are not imported. A `.wpa` project (XFLR5 6.09 and older), a flow5
  file and a damaged file give a red notice with the reason, and the design stays. An `.xfl`
  project up to 2,000 MB is read through windows of 4,194,304 bytes (4 MiB); its analysis results
  are skipped. The
  **Airfoils** upload refuses XFLR5 files with a notice. The Airfoils tab shows `XFLR5: <file>`
  under an imported airfoil, the title of **Open** names the import, and Help lists it. German
  texts: 199 new (areas `xfl`, `xflxml`, `xflr5`). Wiki: User Guide section Import from XFLR5, File
  Formats section XFLR5 import, the screenshot `xflr5-import.png`. Tests: 145 unit tests in
  `test/xflr5-xfl.test.js`, `test/xflr5-xml.test.js` and `test/xflr5-map.test.js`, 10 browser tests
  in `e2e/xflr5.spec.js`.
- Bundled airfoil library: Clark Y, USA 35B, NACA M-6 and NACA 8-H-12 from NACA report tables, RAF 34
  from a Royal Aircraft Establishment table reprinted by NACA, and S9104 (CC BY 4.0, Michael Selig).
  `public/airfoils/NOTICE.md` gives source, legal basis, conditions and attribution per file; the
  status outside the United States of the public-domain tables is not established.
- Documentation in English and German: `README.md`, `README.de.md` and 10 wiki pages (User Guide,
  Geometry, File Formats, Airfoil Sources, Development, each in both languages). The English pages
  name the interface elements by their English labels and show English screenshots. The German wiki
  pages name them by the German labels of the German interface, quote messages in German and show
  German screenshots. `npm run screenshots` writes 26 images: 13 in `docs/wiki/images/` and 13 in
  `docs/wiki/images/de/`. `npm run docs:check` (in CI) checks that every page has its counterpart,
  that wiki links and images resolve, and that both README coverage tables are present.
- Size warnings: above 200 sections, 200 airfoils, 5,000 points in one airfoil, 100,000 airfoil
  points, 500 points in an enabled guide curve, 60,000 loft grid points or 200-character names, one
  warning lists the sizes and the expected time and browser memory of each change; a toast shows it
  when a size crosses its threshold, and the Sections **+**, Planform **Add point** and Settings
  loft grid note name the estimate.
- Export dialog: a note under the mesh density gives the triangles and file size of the chosen
  format, halves and density, with time and memory above 2,000,000 triangles.
- Export dialog: for STEP a note gives the surface control points and the file size, with time and
  memory above 1,000,000 control points; above 3,000,000 **Download** is disabled (3.3 million wrote
  330 MB in 8.4 s, about 5.4 million exceed the 512 MB string limit of the browser).
- `LICENSES.txt` in the build and the release zip: the license of the app and the license text of
  every npm package whose code the bundle contains (three.js and fflate, both MIT), derived from the
  bundle at build time; a bundled package without a license file stops the build. Help links to it.
- The release zip runs without a web server: `index.html` opened from the file loads the app,
  the bundled airfoil library and the autosave (tested in Chromium 141). The release notes say how
  to use the zip and where the licenses are.
- `npm run counts:check` (in CI): compares every test count in `README.md`, `README.de.md`,
  `RECORD.md` and the Development and Geometry wiki pages (English and German) with the suites:
  unit tests and files from Vitest, browser tests, spec files and runs from the Playwright listing,
  tests that run on one device only from the report of the CI browser run, and the STEP and 3MF
  validation cases from `test/step-cases.js`. Exit code 1 on a difference or a missing statement.
  Playwright writes a JSON report to `playwright-report/results.json`.
- NURBS core: B-spline basis functions, curve and surface evaluation, global interpolation,
  knot insertion and splitting.
- Airfoil import for Selig, Lednicer, x/upper/lower tables, XML and HTML tables with sanity checks
  and preview; NACA 4-digit and 5-digit generator.
- Half-wing loft through NURBS-interpolated sections with linear or smooth spanwise blending,
  nose-line and end-line guide curves, and three trailing-edge modes.
- Mirroring at y = 0; closed triangle meshes; STEP (AP214 B-rep with B-spline faces), STL, 3MF and
  project JSON export.
- Browser UI: 3D view with touch controls, planform editor, sections table, airfoil library and
  upload, settings, checks with planform statistics, new-design wizard, undo and redo, autosave.
- Wing tip modes: flat, or pointed with the tip profile scaled to 1/100 to 1/1000 of the previous
  section chord; wizard tip option.
- Adaptive spanwise stations where the loft deviates more than 0.5 mm from the intended planform.
- CI with unit tests, README coverage check, OpenCascade STEP validation, browser smoke test and
  GitHub Pages deployment; wiki publishing; tagged releases.

### Changed

- File names of **Save**, **Export** and `.dat` downloads write German umlauts out, in both languages
  (`Sportflügel` becomes `Sportfluegel`; `ü` became `u` before); other accents are dropped as before.
- Minimum chord (profile depth) 1 mm instead of 0.01 mm, for every section, span position and pointed
  tip; the Sections table marks a tip chord held at the minimum with (min.) and shows the actual tip
  chord when both guide curves set it; guide ends more than 0.5 mm wider than the scaled tip chord
  give a warning.
- Switching a guide curve off and on keeps its edited points; a guide is marked `edited` in the
  project JSON once points are added, removed or moved, and Reset to sections clears the mark.
- Project limits: chord at most 100,000 mm, twist within ±360 degrees, coordinates within
  ±1,000,000 mm, at most 20,000 sections and 20,000 points per guide; the Sections table clamps
  typed values to them and disables insert at 20,000 sections, and the Planform tab disables
  **Add point** at 20,000 guide points.
- Crossing loops of fitted curves and surface rows are measured by their mean width (area over
  extent) instead of their extent, so long, thin trailing-edge slivers no longer fail at low chord
  sample counts.
- The airfoil preview uses the profile parametrization from Settings; profile errors under chord
  length or uniform parametrization point to centripetal parametrization.
- Hard limits where a desktop browser tab runs out of memory or a change takes about a minute:
  20,000 sections, 10,000 airfoils, 1,000,000 airfoil points, 100,000 points per airfoil, 20,000
  guide points, 5,000,000 loft grid points (fewer stations per panel above it), 10,000,000 export
  triangles, 10,000-character names.
- Mesh export: Fine density is always offered; Download is off above 10,000,000 triangles.
- Save and JSON export leave out the derived NURBS data when the file would exceed 100 MB, so every
  file they write reopens; Open reads project files up to 100 MB (50 MB before), airfoil uploads up
  to 20 MB and 5,000,000 characters (8 MB and 2,000,000 before).
- Selecting a section marks the row, the 3D section outline and the planform handle without
  rebuilding the wing; a click in a row outside its fields and buttons selects it.
- Sections table: above 20,000 section-airfoil list entries each airfoil list is filled when it is
  focused or pressed.
- Lists and messages show the first 200 characters of a name followed by `…`; download file names
  are cut to 120 characters.
- The build writes one classic deferred script (immediately invoked function expression, IIFE)
  instead of an ES module loaded in cross-origin resource sharing (CORS) mode; the bundled airfoil
  library is compiled into it instead of fetched from `airfoils/` at run time.
- Airfoil files saved as UTF-16 (16-bit Unicode Transformation Format) text with a byte order mark (Windows editors call it "Unicode") are
  decoded; they were read as Windows-1252 text before.
- The planform preview of the wizard and the canvas of the airfoil preview have the role `img` with
  their labels.

### Fixed

- Number fields read a typed decimal comma: `0,7` is 0.7 in both languages, not 7 (the native number
  field of Chromium drops the comma). They are text fields with the role `spinbutton`, read a decimal
  comma or point in both languages and the digit groups of the current language (`1.500` is 1500 in
  German, `1,500` in English), and show a decimal comma in German. The wizard reads its fields the
  same way; a field that holds no number disables **Create design**.
- Wiki: links in table rows ([[Label|Page]]) split the table cell at the |; tables link with the page
  title alone. `npm run docs:check` reports a | inside a wiki link in a table row.
- STEP faces of symmetric airfoils: the leading-edge split parameter snaps to an existing knot
  within 1e-10.
- Airfoil import: Lednicer detection requires the upper surface to start at the leading edge;
  a closing point after a blunt trailing edge is removed; input above 2,000,000 characters is
  rejected; HTML tag stripping runs in linear time.
- Airfoil check: `te-missing` is an error; duplicate points are removed before the checks.
- Loft: negative blended thickness in smooth spanwise mode is reported as an error.
- Loft: smooth spanwise interpolation that leaves the range of the section values by more than twice
  that range (sections 0.1 mm apart next to 100 mm gaps: weights of ±1475) is an error instead of an
  exported surface thousands of millimetres off.
- Loft: the fitted surface is probed at the quarter points of every station interval as well;
  a surface that turns inside out or touches between stations is an error, and section rows halfway
  between fitted stations are tested for self-crossing.
- Loft: non-finite section placement (a twist of 1e308 degrees) is an error instead of NaN
  coordinates in the exports.
- Loft: cusped trailing edges whose resampled surfaces cross by up to 0.01 % chord behind 99 % chord
  no longer stop the build (18 of 246 real files at 200 chord samples with uniform parametrization).
- Airfoil check: contacts on vertical segments and on surfaces that fold back in x are found; outlines
  longer than 10 chords are rejected before the crossing test (`outline-length`), and the crossing
  test stops at its hit limit.
- Smooth spanwise weights use one tridiagonal factorization (200 sections: 6 ms instead of 130 ms).
- B-spline interpolation rejects decreasing parameters instead of returning control points of 1e16 mm
  from the band LU without pivoting.
- The profile cache keeps the most recently used entries and at least one per airfoil of the project.
- Project files: at most 200 airfoils and 5000 points per airfoil (the file-import limit); guides
  written without the `edited` flag count as edited when their points differ from the section edges,
  so switching them on keeps the points.
- The build stops with the validation message when a section or guide value exceeds the project
  limits, so a project that cannot be saved cannot be exported; planform drags keep chords, section
  positions and guide points within the limits.
- Loft: a guide curve whose control points leave ±1,000,000 mm (through-point guides over unevenly
  spaced points overshoot) and interpolated leading-edge x, z or chord beyond the project limits
  are errors; a leading-edge drag keeps the chord at 1 mm when the end line lies at the coordinate
  limit.
- Limits follow the geometry: section leading edges within ±1,000,000 mm, guide x within
  ±1,100,000 mm (the trailing edge of any valid section), and the built leading edges, trailing
  edges and z within ±1,200,000 mm (an end line at its limit less the largest chord), so every
  valid project builds and only interpolation overshoot is rejected. Section and guide-point counts
  are checked before the entries are read (300,000 empty sections took 7.2 s to reject).
- Loft: at most 160,000 grid points (stations times profile points) before added stations; stations
  per panel are reduced with a warning. 20 sections with 40 stations per panel and 200 chord samples
  build in 0.8 s instead of 4 s. Surface rows are tested halfway between the 64 widest station
  intervals, each row with one basis evaluation.
- Airfoil check: consecutive points closer than 1e-9 chord are removed (their interpolation
  parameters coincide and the collocation matrix is singular); the preview reports an interpolation
  failure as an error and does not offer "Add to project".
- Crossing test of fitted curves and surface rows: crossings up to the size tolerance do not count
  towards the limit of 20, so small slivers cannot hide a larger loop; each crossing is sized in
  constant time (prefix sums of the area terms, sparse tables of the coordinates).
- Undo history: the undo and redo stacks together hold at most 64,000,000 characters of serialized
  project in addition to the 100-step limit; a larger project keeps 1 undo step. 100 edits of a
  50 MB project held 100 copies (5,000 MB).
- Autosave: an edit committed less than one frame before the page is hidden or left (reload, closing
  the tab, switching apps) is saved on `pagehide` or `visibilitychange`.
- Airfoil check: a surface that runs back in x at more than 50 points is an error (`folds`);
  clustered and vertical point runs are checked in linear time (crowded crossing-search cells are
  subdivided, the thickness envelope evaluates each x once).
- Builds take time linear in the section count: 5,000 sections took 25 to 43 s per change at up to
  3.8 GB and 5,250 crashed the tab; now 6.9 to 7.4 s and 345 to 361 MB (Chromium 141).
- Wing statistics integrate the planform over the sections, stations and every guide knot and
  control point, halving an interval while its halves change an integral by more than 1e-10 of its
  scale (at most 12 halvings).
- Insert refuses a section with a message when no span position lies between the two neighbours or
  the new tip would lie beyond y = 1,000,000 mm.
- STL and 3MF exports refuse a mesh in which 32-bit coordinates collapse or turn over a triangle
  whose longest edge is at least 4 coordinate spacings (a 1 mm chord at 1,000,000 mm: 712 of 960
  triangles; a 7.41 mm chord near the limit: 4 triangles 10 mm long) and name the coordinate
  spacing; 3MF coordinates carry 9 significant digits instead of 5 decimals, which merged corners
  of 12 triangles at 1 mm chord and 200 chord samples.
- The 3D view stores its vertices relative to a point on the wing and places that point with the
  object transform: absolute 32-bit positions deviated by up to 0.03 mm near 1,000,000 mm.
- Airfoils without a name in a project file are named after their id on import (blank list
  entries before).
- Planform **Fit** covers the evaluated guide curves and the built outline: a through-point guide
  over unevenly spaced points swung to x = -53,087 mm outside the fitted view.
- Project JSON writes every array of numbers (a point, a knot vector) on one line: 30 to 32 % smaller
  files for the 6 presets; a failed Save shows a message instead of stopping silently.
- STEP string escaping runs in one pass (7,000,000 characters: 385 ms instead of 823 ms).
- Airfoil check: both ends of the outline lie at the trailing edge (`te-missing`); an outline with
  one surface ending at mid-chord passed and lofted a trailing-edge face across the chord.
- Loft: fitted-curve crossings, surface-row crossings and crossed trailing-edge slivers are ignored
  up to their chord fraction and at most 0.1 mm; a fixed fraction accepted a 6.19 mm loop at
  100,000 mm chord.
- Airfoil import stops reading after 5001 coordinate lines (400,000 short lines: 175 ms and 23 MB of
  heap instead of 1,051 ms and 175 MB); a name line above 200 characters keeps its first 200.
- Project files: names and ids at most 200 characters, airfoil source texts at most 2000; only
  known keys are kept on import (a deeply nested unknown key made every later start fail); the
  points of all airfoils together at most 100,000 (200 airfoils of 5000 points took 40 s to build).
- Autosave failures (browser storage holds about 5,000,000 characters per site) show a notice and
  the status bar note "Autosave off: use Save"; the next start names the time of the last save. A
  saved project that cannot be loaded and has no room for a copy stays in place with autosave off.
- Airfoil checks of surfaces that fold back in x use a sweep (5000-point NACA 4412: 25 ms instead of
  162 ms); the profile cache is keyed by a hash of the points and keeps the resampling per chord
  sample count, so a Chord samples change reuses the checks; smooth blending evaluates each position
  from its two neighbouring sections.
- Loft grid at most 60,000 points before added stations (160,000 took 0.7 s to build and 3.6 s to
  display at 20 sections); the 3D view refines cubic lofts in v while the display mesh stays at or
  below 100,000 vertices; mesh exports offer Fine only up to 2,000,000 triangles for both halves.
- Airfoil thumbnails scale to the point bounds (project files in percent of chord were clipped);
  text in the paste field and the NACA designation stays when the Airfoils tab re-renders.
- Airfoil import: files above 5000 points are rejected instead of stalling the checks; the largest
  x is found without spreading all rows into one call; a drawn blunt trailing-edge base is removed in
  both point orders and when the outline starts on the base; a closed trailing edge reached over a
  vertical segment is reported (`te-base`).
- Loft: the closed and fixed-thickness trailing-edge modes report surfaces pulled through each other;
  sections at y < 0 are rejected; dragging a section keeps it strictly between its neighbours.
- 3MF export: the model XML is written in 1 MB chunks, so meshes beyond the JavaScript string limit
  export; characters outside XML 1.0 are removed from names; export failures show a message.
- Airfoils whose NURBS curve crosses itself between the file points (coarse files) and wings
  whose section rows cross are errors; surfaces that touch inside the chord are errors
  (`surfaces-touch`).
- B-spline interpolation uses a band LU solver: 5000-point airfoils interpolate in 13 ms instead of
  building a 5000 x 5000 dense matrix.
- Save writes the derived NURBS data of the current project, not of the last rendered build.
- The closed and fixed-thickness trailing-edge modes report surfaces made to touch (thickness at most
  0.001 % chord between 1 % and 99 % chord).
- The loft deviation that adds stations is measured in 3D, so strong twist between stations adds
  stations instead of shortening the chord; a fitted surface whose chord falls below 0.5 mm or
  reverses between stations (after 32 added stations) is an error; rows halfway between sections are
  tested for self-crossing.
- Non-object `settings.trailingEdge` and `settings.tip` are rejected on import.
- The fitted-curve crossing test shares a budget of about 4000 samples among the knot spans by
  control-polygon length, so loops in coarse spans of dense files are found.
- A fitted airfoil curve that runs back in x by more than 0.01 % chord is an error (the loft
  resamples by chord position).
- Small chords add stations at 10 % chord deviation; a fitted chord below 0.9 mm is an error.
- Three-column tables ordered from the trailing edge to the leading edge are read.
- Airfoil camber is measured from the chord line instead of a horizontal line through the leading
  edge.
- UI: the first-run wizard returns after a reload until a choice is made; the NACA generator titles
  its preview with the parsed designation; a library preset the wizard already added is not added
  twice; the View preview of a project airfoil offers only Close; undo or redo after "Add point"
  clears the guide-point selection; on phones up to 420 px the top bar stays on one row and the
  Settings pane no longer scrolls sideways.
- Tests: 121 Playwright tests on desktop and phone replace the single smoke test in CI.
- Airfoil uploads above 8 MB and project files above 50 MB are rejected before they are read.
- XML airfoils are read in one pass and reading stops one point past the 5000-point limit.
- Dragging a leading edge with only the end line enabled evaluates the end line at the new span
  position, so the leading edge lands under the pointer.
- Area, aspect ratio and MAC integrate the planform with Gauss-Legendre quadrature and no longer
  depend on the station count in smooth mode or with guide curves (up to 2 % before).
- Project import: `guides.*.enabled` must be a boolean; a guide point between neighbours closer than
  1 mm keeps its span position when edited.
- CI: runs on `main` queue instead of cancelling a running Pages deployment; 3MF files are validated
  with lib3mf.
- STEP export keeps knots closer than 1e-12 distinct (a section 1e-10 mm from the root wrote an end
  knot of multiplicity degree + 2); only knots within 4 units in the last place merge.
- The 3D view draws at most 100,000 control-net segments: above that it keeps every k-th control
  line in each direction, first and last included.
- The planform outline uses the span samples of the 3D edge lines (4 per station interval, at most
  20,000) instead of 80 fixed intervals, which missed sections between them; exact-count Lednicer
  headers need the lower surface to start at the leading edge.
- Intermediate stations whose span fractions lie within 4 units in the last place of a neighbour are
  dropped (a section 5e-13 mm from another stopped smooth builds with an internal error); through-
  points guides with such y values are an error; wizard elliptic pointed tips end the guides around
  the sweep line; the planform samples guides per knot span and looks stations up by binary search;
  the 3D edge lines use at most 20,000 span samples; a Selig name starting with `#` is prefixed.
- Guide curves invert the normalized y until the curve parameter is bracketed within 1e-15; Lednicer detection needs the first
  data row at the leading edge and matching counts or a plausible split, so percent Selig files
  with an integer trailing-edge row read as Selig; XML and HTML entities include `&apos;` and
  hexadecimal references, decoded as code points; **Full wing** merges the halves only for a root at
  exactly y = 0; Save and Export reuse the current build.
- The build rejects two sections whose span fractions lie within 4 units in the last place (one
  knot would carry both); a project name change saves without rebuilding the wing; the 3D view draws
  at most 100,000 section-outline segments; a Selig name line that reads as coordinates or markup is
  prefixed or escaped.
- Airfoil parser: decimal-comma values with exponents (`1,0e-1`) are read; only equal consecutive
  points count as duplicates (a 1e-12 outline kept 2 of 161 points). The Selig writer chooses its
  decimals from the outline extent, so a 1e-6 chord at x = 1 keeps its points.
- Open and airfoil upload report a file the browser cannot read instead of failing silently; STEP
  strings write a lone UTF-16 surrogate as U+FFFD.
- The Sections table accepts a y that differs from every other section y (a y within 1e-6 mm of
  another section was refused); the airfoil preview view widens to points outside y = ±0.2.
- The build finds the largest chord per airfoil and the station of each section in one pass instead
  of a scan per airfoil and per section.
- UI: rejected autosave data is kept under a separate key; keyboard shortcuts are inactive while a
  dialog is open; input focus survives a rebuild; empty or invalid number fields restore their
  value; export formats are disabled while the wing has errors; equal section span positions are
  rejected.
- Project files keep the derived NURBS data at full double precision; rounding to 12 significant
  digits merged the span parameters and knots of close sections.
- Span fractions, stations, knots and guide points count as distinct only when they differ by more
  than 4 units in the last place and by more than 2^-1021, so subnormal gaps next to v = 0 are an
  error instead of a failed build.
- The file leading edge of an airfoil is the same point at every scale of the outline:
  squared distances within a relative 1e-15 of the largest count as ties, and ties go to the
  smaller x.
- Number fields show the shortest decimal that reads back to the stored value instead of 3 decimal
  places (a y of 600.0000002 mm showed as 600).
- Adding an airfoil, or removing one that no section uses, updates the lists, the size warning and
  the autosave without rebuilding the wing; selecting a section or changing the display redraws
  the planform canvas without rendering its forms; Save or Export right after an edit renders the
  planform forms of the new build.
- The STEP size note shows the exact count below 1,000,000 control points (`4,114 control points`
  for the Glider preset instead of `0.00 million`).
- Airfoil parser: numbers, column headers and HTML titles are read in linear time (a 4,000-letter
  line took 79 s, an 80,000-digit token 11 s, 80,000 unclosed `<title>` tags 13 s); a comment is cut
  at the first `#`; column headers may use commas and semicolons; HTML tables read row by row
  whatever their source line breaks, cell markup and end tags, and a caption no longer joins the first
  row; `&nbsp;` reads as a space; XML values follow the text number rules; a closing point written
  twice after a blunt trailing edge is removed; point order and the file leading edge do not depend
  on the scale of the coordinates.
- The `.dat` download writes as many decimals as needed to keep consecutive points distinct, and
  escapes `<html`, `<pre` and `<body` at the end of a name.
- The self-crossing search sizes its grid cells from the median segment box: a narrow zigzag of
  40,201 points took 54 s.
- Sections of exactly 1 mm chord build (blend round-off counted as a chord below the minimum); the
  chord error names the smooth blend when no pair of guide curves sets the chord; sections or guide
  points about 1e-300 of the span apart give a build error instead of an internal error.
- Cap triangulation sums areas relative to a vertex: a wing 100,000 mm from the origin fell back to
  ear clipping and took 2.6 s per export.
- STL and 3MF precision notice: `at … mm` gives the largest coordinate of the damaged triangles
  instead of the whole mesh; when the first damaged triangle still collapses or turns over with its
  x and z moved next to 0 and the root moved to y = 0, the notice ends `Sections or stations near y = … mm lie closer together
  than the spacing there (… mm); move them apart, or export STEP.` (sections at y = 300 and
  300.00001 mm: moving the wing does not help).
- Size warning: when the first build (Open, restored autosave, a change of the profile
  parametrization) takes at least 1 s longer than a change, the warning ends with `Opening it or
  changing the profile parametrization takes about … s.` The estimate is the time of a change plus
  4.4 ms per airfoil that a section uses plus 30 µs per point of these airfoils (20,000 linear
  sections at 16 chord samples with 10,000 used airfoils of 99 points: about 83 s).
- First build: the curve samples of the airfoil check serve the crossing test at the chord of the
  build as well (Node.js 24: 7.4 ms instead of 9.2 ms per airfoil of 99 points).
- Save and JSON export estimate the derived NURBS data from the mean length of sampled surface
  coordinates and, up to 110 MB by the estimate, write and measure the file; 26 characters per
  number left the derived data out of files of 70 MB.
- Wing statistics split the span at root, tip, sections and guide knots and control points, not at
  the stations: 139,994 stations took 27 s at 20,000 sections with 20,000-point guides.
- Cap triangulation uses the other diagonal of a quad whose first diagonal gives a triangle that is
  not counterclockwise: Fine caps with a closed trailing edge (NACA 4415, 200 chord samples) fell
  back to ear clipping and took 2.2 s.
- The 3D control net stays within 100,000 segments for long nets (33 x 151,000 control points:
  302,062 segments before): when the first and last lines alone exceed it, each kept line passes
  through every k-th control point only.
- Adaptive stations: 1 round above 60,000 loft grid points (a 4 mm guide bump at 2,000 sections took
  3 fits and 22.8 s instead of 9.2 s); the build keeps the fit with the smallest largest deviation
  relative to its tolerance, the first one on a tie (a 0.06 mm wide guide bump on a 2-section wing
  went from 3.67 mm to 18,797 mm after 32 stations; now the first fit stays and warns); stations go
  to the peaks of deviation / tolerance (a 10 mm root chord wing with 15° washout and 45° forward
  sweep warned with 0 added stations; now 1 added station and no warning).
- Airfoil thumbnails in the Airfoils tab and the library list are SVG polylines of at most 400
  points: a canvas per airfoil held up to 77 KB of backing store at a pixel ratio of 2, about 770 MB
  for 10,000 airfoils (derived from the code).
- Sections table: the chosen airfoil of each row is looked up in a map (1.7 s per render at 20,000
  sections and 10,000 airfoils); adding an airfoil finds a free id with a set (0.73 s per add at
  9,999 same-named airfoils); the planform editor reuses the guide samples while mode, degree and
  points of the guide stay equal (about 90 ms per repaint for a 20,000-point guide).
- Size estimates round to 2 significant digits before the unit is chosen: from 995 MB they read
  `about 1 GB` instead of `about 1000 MB`.
- Undo history: an action that changes nothing (Remove unused with every airfoil in use, Add to
  project of an airfoil the project already holds, typing the same value) adds no undo step and
  keeps the redo steps; a planform drag is one undo step until the pointer is released (a pause of
  800 ms started a new step); undo or redo during a drag ends the drag (the drag went on with a
  point index that could name another point), and Redo restores the point; the planform editor picks
  the nearest point within the pick radius instead of the first one (guide points near an elliptic
  tip lie closer together than the radius).
- Add to project of an airfoil the project already holds shows `The project already holds this
  airfoil as "…".` instead of `Added airfoil "…".`; a NACA section held under another name with the
  same code, Closed trailing edge setting and checked points keeps the existing entry (cambered
  sections added through the preview were added twice).
- Status bar: `Autosave off: use Save` shows from the start when the saved project could not be
  loaded and browser storage had no room for a copy; the start notice of a lost autosave and the
  size warning of the restored project show in one notice in the error colour.
- A project name above 200 characters adds the size warning as soon as it is committed, and a
  shorter name removes it (at the next geometry edit before).
- Keyboard focus stays on the airfoil lists of the Sections table, the lists of Settings and of the
  guide curves, checkboxes, the project name field and the section row buttons when the panel
  renders again (only number fields kept it).
- Planform: section drags move disabled, unedited guide curves to the new section edges, as edits in
  the Sections table do, so after a reload switching such a guide on keeps the dragged edge; Reset
  to sections and switching a guide curve on or off clear the selected guide point; a pointed tip
  section shows no trailing-edge handle, and no leading-edge handle while the end line is on.
- Edits keep span positions the build accepts: Insert refuses a position whose span fraction is not
  apart from both neighbours (`No span position lies between y = … mm and y = … mm. Move the two
  sections apart first.`), and section drags and guide point moves keep the old y when the clamped
  one would not be apart (4 units in the last place, 2^-1021).
- Wizard elliptic planforms: nose and end lines with 11 points at eta = sin(pi i / 20), i = 0 … 10,
  closer together towards the tip; largest chord deviation from the elliptic law, Glider preset:
  taper 0.1 0.55 % of the root chord instead of 3.42 % with 6 points, pointed tip 2.87 % instead of
  5.20 % with 7 points; the end line x is the rounded nose x plus the rounded chord (a 1 mm tip gave
  0.9999999999999982 mm).
