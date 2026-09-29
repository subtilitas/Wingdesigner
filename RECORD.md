# Project record

Running record of the state of Wingdesigner: what exists, decisions with their reasons, facts that
were verified and how, and open items. Treat every statement as a claim to re-check; the "Verified"
column says how. Version history lives in CHANGELOG.md and git.

Last updated: 2026-09-29

## State

| Area | State | Verified by |
| --- | --- | --- |
| NURBS core (`src/geom/nurbs.js`) | Basis functions, curve and surface evaluation, global interpolation, knot insertion, splitting | `test/nurbs.test.js` |
| Airfoil import (`src/airfoil/`) | Selig, Lednicer, x/upper/lower tables, XML, HTML tables, decimal commas, Windows-1252; sanity checks; NACA 4/5-digit | `test/airfoil.test.js`; 191 real files from aerodesign.de, mh-aerotools.de and UIUC parsed locally, 190 accepted, 1 (UIUC `mh150.dat`) rejected for a real upper/lower crossing. The files are not committed (license). |
| Wing loft (`src/geom/wing.js`) | Sections, linear or smooth spanwise blending, nose and end guide curves, trailing-edge modes | `test/wing.test.js` |
| Meshes (`src/geom/mesh.js`) | Closed outward meshes, mirror, merged full wing | Edge-manifold and volume tests |
| STEP export (`src/export/step.js`) | AP214 B-rep solids with exact B-spline faces | `scripts/validate_step.py` with OpenCascade (cadquery-ocp 8.0.1): 5 cases, all valid and closed, volume within 8e-5 of the mesh |
| STL, 3MF, project JSON | Implemented | `test/export.test.js` |
| UI (`src/ui/`, `src/main.js`) | 3D viewer, planform editor, sections, airfoils, settings, checks, wizard, export | Playwright smoke test on desktop (1280 x 720) and Pixel 7 viewports, no console errors |
| CI | `ci.yml` (lint, unit tests, coverage check, STEP validation, e2e, Pages deploy), `docs.yml` (wiki), `release.yml` (tags) | Not yet run on GitHub at the time of writing |
| Bundled airfoil library | Empty index; NACA presets are generated | `npm run airfoils:check` |

## Decisions

| Decision | Reason |
| --- | --- |
| Own STEP writer instead of OpenCascade in the browser | Writes the exact loft surfaces as text; no WebAssembly download of several MB; validated in CI with OpenCascade. |
| Upper and lower surface as separate STEP faces, split at the leading edge by knot insertion | Avoids a seam edge on a periodic surface; every edge is an exact boundary iso-curve. |
| Sections resampled at common cosine-spaced chord fractions | Point j of every section corresponds by chord position, so blending and lofting keep the leading edge at one parameter. |
| Section origin at the NURBS leading edge (minimum x of the curve), chord to the trailing-edge midpoint | Placement refers to the interpolated shape, not to the nearest file point. |
| Inclined airfoils are not derotated | Some tables (e.g. Göttingen 795) use a baseline instead of the leading-edge-to-trailing-edge chord; twist refers to the file's x axis. A warning reports the inclination. |
| Spanwise C0 knots at sections in linear mode | Straight panels with kinks at sections stay exact; smooth mode uses one C2 spline. |
| Guide curves stretched to root-to-tip span | Guides follow span edits without manual correction. |
| Chord and planform checks on 257 span samples plus every guide breakpoint | The loft passes through the stations only; a guide crossing or guide detail between stations is reported (error below 0.1 mm chord, warning above 0.5 mm edge deviation). |
| aerodesign.de and mh-aerotools.de coordinates not bundled | Their terms grant personal use and restrict redistribution (quotes in the wiki page Airfoil-Sources). The app links to them and fills in attribution on upload. |
| MIT license for the code | Chosen by the owner. Airfoil data keeps its own terms. |
| GitHub Actions: checkout v7, setup-node v7, setup-python v7, cache v6, upload-artifact v7, configure-pages v6, upload-pages-artifact v5, deploy-pages v5 | Latest majors on 2026-09-29; all `runs.using: node24` (upload-pages-artifact is composite on upload-artifact v7), checked in each `action.yml`. |

## Measurements

Node.js 24.21, sandbox x86-64 CPU, 2026-09-29 (`buildWing`, `exportMeshes(..., 'merged')`, `wingToStep`):

| Case | Chord stations | Build | Mesh | STEP write | STEP size |
| --- | --- | --- | --- | --- | --- |
| Sport preset, 2 sections | 60 | 9 ms | 1 ms | 1 ms | 99 KB |
| Sport preset, 2 sections | 200 | 20 ms | 2 ms | 3 ms | 303 KB |
| Glider preset, elliptic guides, 17 stations | 60 | 21 ms | 11 ms | 5 ms | 441 KB |
| Glider preset, elliptic guides, 17 stations | 200 | 55 ms | 37 ms | 18 ms | 1393 KB |

Mean of 10 runs after 2 warm-up runs (STEP: 3 runs). Cap triangulation pairs upper and lower points per chord station (linear time); ear clipping
(cubic time) is the fallback.

## Open items

- Bundled library: decide which additional airfoils have a clear license for redistribution
  (research on public-domain NACA/NASA report data is in progress).
- Written permission from Hartmut Siegmann (postal only, per his site) or Martin Hepperle
  (e-mail in his page footer) would allow bundling HS or MH airfoils.
- First CI run on GitHub: confirm Pages deployment and the wiki push with `GITHUB_TOKEN`.
- Not measured: build time and memory on phones.
