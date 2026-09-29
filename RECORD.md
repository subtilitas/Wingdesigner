# Project record

Running record of the state of Wingdesigner: what exists, decisions with their reasons, facts that
were verified and how, and open items. Treat every statement as a claim to re-check; the "Verified"
column says how. Version history lives in CHANGELOG.md and git.

Last updated: 2026-09-29

## State

| Area | State | Verified by |
| --- | --- | --- |
| NURBS core (`src/geom/nurbs.js`) | Basis functions, curve and surface evaluation, global interpolation, knot insertion, splitting | `test/nurbs.test.js` |
| Airfoil import (`src/airfoil/`) | Selig, Lednicer, x/upper/lower tables, XML, HTML tables, decimal commas, Windows-1252; sanity checks; NACA 4/5-digit | `test/airfoil.test.js`; 247 real files (Selig, percent tables, XML, HTML pages) from aerodesign.de, mh-aerotools.de and UIUC parsed locally on 2026-09-29, 246 accepted, 1 (UIUC `mh150.dat`) rejected for a real upper/lower crossing. The files are not committed (license). |
| Wing loft (`src/geom/wing.js`) | Sections, linear or smooth spanwise blending, nose and end guide curves, trailing-edge modes | `test/wing.test.js` |
| Meshes (`src/geom/mesh.js`) | Closed outward meshes, mirror, merged full wing | Edge-manifold and volume tests |
| STEP export (`src/export/step.js`) | AP214 B-rep solids with exact B-spline faces | `scripts/validate_step.py` with OpenCascade (cadquery-ocp 8.0.1): 8 cases including 2 pointed tips and 1 symmetric airfoil, all valid and closed, volume within 8e-5 of the mesh |
| STL, 3MF, project JSON | Implemented; 3MF model XML is written and deflated in 1 MB chunks (zip entries with data descriptors) | `test/export.test.js`; `scripts/validate_3mf.py` with lib3mf 2.5.0 in strict mode: 8 cases, no reader warnings, every object manifold and oriented. Other 3MF readers (slicers) not tested. |
| UI (`src/ui/`, `src/main.js`) | 3D viewer, planform editor, sections, airfoils, settings, checks, wizard, export | Playwright smoke test on desktop (1280 x 720) and Pixel 7 viewports, no console errors |
| CI | `ci.yml` (lint, unit tests, coverage check, STEP and 3MF validation, e2e, Pages deploy; runs on `main` queue, other refs cancel older runs), `docs.yml` (wiki), `release.yml` (tags) | All jobs green on pull request #1; Pages deployment and wiki push run on `main` only and are not yet observed |
| Bundled airfoil library | Empty index; NACA presets are generated | `npm run airfoils:check` (in CI): free license per entry, restricted hosts rejected, every file indexed and listed in `public/airfoils/NOTICE.md` |

## Decisions

| Decision | Reason |
| --- | --- |
| Own STEP writer instead of OpenCascade in the browser | Writes the exact loft surfaces as text; no WebAssembly download of several MB; validated in CI with OpenCascade. |
| Upper and lower surface as separate STEP faces, split at the leading edge by knot insertion | Avoids a seam edge on a periodic surface; every edge is an exact boundary iso-curve. |
| Sections resampled at common cosine-spaced chord fractions | Point j of every section corresponds by chord position, so blending and lofting keep the leading edge at one parameter. |
| Section origin at the NURBS leading edge (minimum x of the curve), chord to the trailing-edge midpoint | Placement refers to the interpolated shape, not to the nearest file point. |
| Inclined airfoils are not derotated | Some tables (e.g. Göttingen 795) use a baseline instead of the leading-edge-to-trailing-edge chord; twist refers to the file's x axis. A warning reports the inclination. |
| Spanwise C0 knots at sections in linear mode | Straight panels with kinks at sections stay exact; smooth mode uses one C2 spline. |
| Split parameters within 1e-10 of an existing knot snap to that knot | A symmetric airfoil puts the leading edge 1 ulp (unit in the last place) from a knot; inserting a separate knot there gives multiplicity 5 and an invalid STEP face. |
| Smooth spanwise blending reports negative blended thickness as an error | The cubic cardinal functions overshoot between sections with large chord or thickness changes; the upper surface then passes below the lower one. |
| Guide curves stretched to root-to-tip span | Guides follow span edits without manual correction. |
| Pointed tip: tip profile scaled to 1/100 to 1/1000 (default 1/200) of the previous section chord, at least 1 mm | A zero chord has no profile and no valid B-rep face; a scaled profile keeps the tip closed, profile-shaped and exportable. Converging guide curves end in this profile. |
| Airfoil files limited to 2,000,000 characters and 5000 points | Bounds import time. Checks at 5000 points take 41 ms (grid-binned self-intersection test, sorted thickness sweep), the NURBS interpolation 13 ms (band LU); Node.js 24, sandbox CPU. |
| Band LU without pivoting for B-spline interpolation | Collocation matrices are banded and totally positive (de Boor and Pinkus, 1977); dense LU needed about 200 MB and O(n^3) time at 5000 points. Band and dense solutions agree to 0 on 41 to 401 NACA points. |
| Fitted profile curves and section rows tested for self-crossing, loops up to 0.05 % chord ignored | Cubic interpolation of coarse files can loop past the trailing edge while the points pass every check (6 of 6314 random 9-point outlines). Cusped closed trailing edges leave slivers of 1.1e-4 to 1.4e-4 chord (MH 83, MH 50), coarse-file loops measure about 9e-3 chord. Rows between sections are not tested. |
| Profile stage cached per airfoil (32 entries) | The crossing test costs 10 to 60 ms per airfoil; cached rebuilds: sport preset 16 ms, glider 20 ms at 60 chord samples, 70 ms at 200. |
| Profile thickness checked before and after the trailing-edge setting | The linear taper of the closed and fixed-thickness modes pulls the surfaces through each other where an airfoil is thinner inside than its trailing-edge gap. |
| Planform statistics by 5-point Gauss-Legendre quadrature of the intended planform | Trapezoids over stations were off by 1.45 % (8 stations per panel) to more than 2 % (3 stations) in smooth mode; the quadrature is exact for cubic spanwise splines. |
| Interior contact (thickness at most 1e-5 chord between 1 % and 99 % chord) is an error, in the airfoil check and again after the trailing-edge setting | Touching surfaces give a zero-thickness solid. Thickness between polylines is smallest at a vertex, so every file point is checked. 247 real files: no new rejection. |
| Minimum chord 1 mm for every section and span position, also the floor of a pointed tip | Owner requirement: below 1 mm the profile falls under the resolution of meshes, STEP modelling tolerances and manufacturing. With the default 1/200 ratio the tip chord reaches the floor for previous chords below 200 mm (4 of 6 wizard presets with a pointed tip). |
| Trailing-edge thickness limited to 5 % of the local chord | Keeps small tip profiles free of self-intersection with a fixed thickness in mm. |
| Through-point guide curves parametrized by span position | y(t) is exactly linear, so a guide cannot double back in span; x(y) is a spline function. |
| Adaptive spanwise stations (up to 32 extra) | Stations are added where the loft deviates more than 0.5 mm from the intended edges, e.g. at pointed elliptic tips (pointed glider preset: 6 extra, 0.14 mm). |
| Chord and planform checks on 257 span samples plus every guide breakpoint | The loft passes through the stations only; a guide crossing or guide detail between stations is reported (error below 1 mm chord, stations added above 0.5 mm edge deviation, warning if still above after 32 added stations). |
| aerodesign.de and mh-aerotools.de coordinates not bundled | Their terms grant personal use and restrict redistribution (quotes in the wiki page Airfoil-Sources). The app links to them and fills in attribution on upload. |
| MIT license for the code | Chosen by the owner. Airfoil data keeps its own terms. |
| Bundled airfoils only under a free license: public domain (by law, expired copyright or dedication) or CC0-1.0, Unlicense, CC-BY-4.0, CC-BY-3.0, MIT, BSD-2-Clause, BSD-3-Clause | Owner requirement: bundled airfoils are free to use. Personal-use, non-commercial, no-derivatives, share-alike, "ask first" and inferred permissions are excluded. `scripts/check-airfoils.mjs` enforces the list. |
| GitHub Actions: checkout v7, setup-node v7, setup-python v7, cache v6, upload-artifact v7, configure-pages v6, upload-pages-artifact v5, deploy-pages v5 | Latest majors on 2026-09-29; all `runs.using: node24` (upload-pages-artifact is composite on upload-artifact v7), checked in each `action.yml`. |

## Measurements

Node.js 24.21, sandbox x86-64 CPU, 2026-09-29 (`buildWing`, `exportMeshes(..., 'merged')`, `wingToStep`):

| Case | Chord stations | Build | Mesh | STEP write | STEP size |
| --- | --- | --- | --- | --- | --- |
| Sport preset, 2 sections | 60 | 14 ms | 1 ms | 1 ms | 99 KB |
| Sport preset, 2 sections | 200 | 44 ms | 2 ms | 3 ms | 303 KB |
| Glider preset, elliptic guides, 17 stations | 60 | 24 ms | 11 ms | 5 ms | 441 KB |
| Glider preset, elliptic guides, 17 stations | 200 | 72 ms | 37 ms | 18 ms | 1393 KB |

Mean of 10 runs after 2 warm-up runs (STEP: 3 runs). Build times include the section-row crossing test;
the profile stage is cached after the warm-up runs (first build of a new airfoil: 35 to 100 ms more). Cap triangulation pairs upper and lower points per chord station (linear time); ear clipping
(cubic time) is the fallback.

## Open items

- Bundled library: research on free-licensed and public-domain airfoil sources (NACA/NASA/NREL
  reports, Drela, databases, historical series, open releases) is in progress.
- Written permission from Hartmut Siegmann (postal only, per his site) or Martin Hepperle
  (e-mail in his page footer) would allow bundling HS or MH airfoils.
- First run on `main`: confirm Pages deployment and the wiki push with `GITHUB_TOKEN`.
- Not measured: build time and memory on phones.
