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
