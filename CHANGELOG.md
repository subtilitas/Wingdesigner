# Changelog

All notable changes to this project are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed

- Minimum chord (profile depth) 1 mm instead of 0.01 mm, for every section, span position and pointed
  tip; the Sections table marks a tip chord held at the minimum with (min.) and shows the actual tip
  chord when both guide curves set it; guide ends more than 0.5 mm wider than the scaled tip chord
  give a warning.

### Fixed

- STEP faces of symmetric airfoils: the leading-edge split parameter snaps to an existing knot
  within 1e-10.
- Airfoil import: Lednicer detection requires the upper surface to start at the leading edge;
  a closing point after a blunt trailing edge is removed; input above 2,000,000 characters is
  rejected; HTML tag stripping runs in linear time.
- Airfoil check: `te-missing` is an error; duplicate points are removed before the checks.
- Loft: negative blended thickness in smooth spanwise mode is reported as an error.
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
- The fitted-curve crossing test samples at most about 4000 points (1 per span for 5000-point files).
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
