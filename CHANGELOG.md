# Changelog

All notable changes to this project are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Bundled airfoil library: Clark Y, USA 35B, NACA M-6 and NACA 8-H-12 from NACA report tables, RAF 34
  from a Royal Aircraft Establishment table reprinted by NACA, and S9104 (CC BY 4.0, Michael Selig).
  `public/airfoils/NOTICE.md` gives source, legal basis, conditions and attribution per file; the
  status outside the United States of the public-domain tables is not established.
- Documentation in English and German: `README.md` and `README.de.md`, and 10 wiki pages (User Guide,
  Geometry, File Formats, Airfoil Sources, Development, each in both languages) with 12 screenshots
  from `npm run screenshots`. `npm run docs:check` (in CI) checks that every page has its
  counterpart, that wiki links and images resolve, and that both README coverage tables are present.
- Size warnings: above 200 sections, 200 airfoils, 5,000 points in one airfoil, 100,000 airfoil
  points, 500 points in an enabled guide curve, 60,000 loft grid points or 200-character names, one
  warning lists the sizes and the expected time and browser memory of each change; a toast shows it
  when a size crosses its threshold, and the Sections **+**, Planform **Add point** and Settings
  loft grid note name the estimate.
- Export dialog: a note under the mesh density gives the triangles and file size of the chosen
  format, halves and density, with time and memory above 2,000,000 triangles.

### Changed

- Minimum chord (profile depth) 1 mm instead of 0.01 mm, for every section, span position and pointed
  tip; the Sections table marks a tip chord held at the minimum with (min.) and shows the actual tip
  chord when both guide curves set it; guide ends more than 0.5 mm wider than the scaled tip chord
  give a warning.
- Switching a guide curve off and on keeps its edited points; a guide is marked `edited` in the
  project JSON once points are added, removed or moved, and Reset to sections clears the mark.
- Project limits: chord at most 100,000 mm, twist within ±360 degrees, coordinates within
  ±1,000,000 mm, at most 200 sections and 500 points per guide; the Sections table clamps typed
  values to them and disables insert at 200 sections.
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
  saved project reopens; Open reads project files up to 100 MB (50 MB before), airfoil uploads up
  to 20 MB and 5,000,000 characters (8 MB and 2,000,000 before).
- Selecting a section marks the row, the 3D section outline and the planform handle without
  rebuilding the wing; a click in a row outside its fields and buttons selects it.
- Sections table: above 20,000 section-airfoil list entries each airfoil list is filled when it is
  focused or pressed.
- Lists and messages show the first 200 characters of a name followed by `…`; download file names
  are cut to 120 characters.

### Fixed

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

## [0.1.0] - 2026-09-29

### Added

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
