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
| UI (`src/ui/`, `src/main.js`) | 3D viewer, planform editor, sections, airfoils, settings, checks, wizard, export | Playwright: 123 tests in 9 spec files on desktop (1280 x 720) and Pixel 7 (246 runs, 216 pass, 30 viewport-specific skips), every test fails on a page or console error; run against a fresh build (`reuseExistingServer: false`) |
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
| Smooth mode: a blended value more than 2 section ranges outside the section value range is an error (`OVERSHOOT_LIMIT`) | Sections 0.1 mm apart next to 100 mm gaps give cardinal weights of ±1475: 750 random smooth wings (NACA sections, 5 seeds) produced surfaces with inverted thickness down to -253 m and deviations of 12.8 m that every other check passed; with the limit, 0 of 750 builds without error have a negative thickness on a 4000 x 59 sample grid. Limit 2, not 1: a curved planform with chords 100/500/100 mm at y = 0/100/1000 mm reaches 1.34 ranges; tip clusters (20 to 200 mm chords at y = 0/500/510 mm) reach 6.6. 648 preset builds (6 presets x flat/pointed x linear/smooth x 3 chord samples x 3 parametrizations x 3 trailing-edge modes): no error. |
| Fitted surface probed at 257 span positions, guide breakpoints and the quarter points of every station interval: chord, local thickness and contact are errors; the deviation warning and added stations use the check positions only | Global cubic interpolation through closely spaced stations can swing between them while every fixed check position lies near a station; zigzag degree-5 guides give inverted thickness between stations in 7 of 40 random cases, and the 32 accepted ones pass a dense check (401 rows without crossing, no negative thickness on 2001 span samples). Within 2 mm of a pointed elliptic tip the loft deviates 0.3 to 0.8 mm between stations (more than 10 % of the 1 to 3 mm chord there); with the quarter points driving added stations, 4 of 6 pointed wizard presets still warned after 13 to 21 added stations. |
| Guide curves stretched to root-to-tip span | Guides follow span edits without manual correction. |
| Pointed tip: tip profile scaled to 1/100 to 1/1000 (default 1/200) of the previous section chord, at least 1 mm | A zero chord has no profile and no valid B-rep face; a scaled profile keeps the tip closed, profile-shaped and exportable. Converging guide curves end in this profile. |
| Airfoil files limited to 2,000,000 characters and 5000 points | Bounds import time. Checks at 5000 points take 41 ms (grid-binned self-intersection test, sorted thickness sweep), the NURBS interpolation 13 ms (band LU); Node.js 24, sandbox CPU. |
| Band LU without pivoting for B-spline interpolation; decreasing parameters throw | Collocation matrices are banded and totally positive for nondecreasing parameters (de Boor and Pinkus, 1977); dense LU needed about 200 MB and O(n^3) time at 5000 points. Band and dense solutions agree to 0 on 41 to 401 NACA points. A guide with decreasing y (only from a hand-edited file) gave control points of 1.6e16 mm in the planform preview. |
| Fitted profile curves and section rows tested for self-crossing; loops with a mean width (area over extent) up to 0.05 % chord ignored | Cubic interpolation of coarse files can loop past the trailing edge while the points pass every check (6 of 6314 random 9-point outlines). Cusped closed trailing edges leave long, thin slivers: at most 1.6e-5 chord mean width on 246 real files under all 3 parametrizations; the coarse-file loop measures 2.5e-3. The extent measure rejected slivers by their length (48 % of real files at 16 chord samples with uniform parametrization). Rows are tested at sections, halfway between sections and halfway between fitted stations. |
| Behind 99 % chord, crossed surfaces up to 1e-4 chord count as zero thickness | The last chord stations of a cusped trailing edge can lie in a sliver that the crossing check accepts; the -1e-9 thickness test rejected 18 of 246 real files at 200 chord samples with uniform parametrization. 1e-4 is the crossed trailing-edge limit of the airfoil check. |
| Project limits: chord 1 to 100,000 mm, twist ±360 degrees, coordinates ±1,000,000 mm, 200 sections, 500 guide points | A twist of 1e308 degrees overflows the angle conversion to NaN coordinates; a straight 10,000-point nose line takes 858 ms per rebuild of the sport preset, 500 points 78 ms (sweep running in parallel). The Sections table clamps typed values to the same limits; the build also stops on non-finite placement. |
| Guide curves carry an `edited` flag; files without it get it from the points | Switching a guide off and on replaced edited points with the section edges; a switched-off guide without edits still follows the sections. Files written before the flag: points that differ from the section edges by more than 1e-9 mm count as edited. |
| At most 200 airfoils per project and 5000 points per airfoil, also in project files | A 3.55 MB project with 50,000 airfoils passed validation and rendered 400,145 DOM nodes (Codex security review); every section can still use its own airfoil. The UI refuses the 201st airfoil before the preview. |
| buildWing reports the project limits (shared `limitErrors`) | Values beyond the limits block autosave; without the check in the build, exports stayed enabled for a project that cannot be saved (planform drags could produce them). Drags clamp to the same limits. |
| Guide control points within ±1,000,000 mm; interpolated placement within the project limits at every check position | A B-spline lies within the hull of its control points, so the control points bound the whole guide. A through-point end line over (0, 0), (1e6, 0.1), (-1e6, 0.11), (1e6, 599.9), (0, 600) passed validation and reached 7.6e13 mm. Smooth overshoot within the 2-range limit can still pass the coordinate limit (x 0 / 1e6 / 0 mm at y 0 / 100 / 1000 mm reaches 2.3e6 mm). |
| Loft grid at most 160,000 points (stations times 2N + 1) before added stations; surface rows halfway between the 64 widest station intervals | 20 sections with 40 stations per panel and 200 chord samples (761 stations) took 4.05 s, 54 % of it in row crossing tests; with the budget 400 stations and 0.8 s. 200 sections at these settings: 399 stations, 2.0 s (load average 3.3, other processes running). |
| Consecutive airfoil points closer than 1e-9 chord are removed | A point one unit in the last place from its neighbour passed every check and made the interpolation throw (zero pivot) in 506 of 2370 NACA 2412 variants; after the merge 0 of 2370. |
| Fitted airfoil curve: x reversal above 1e-4 chord is an error | The loft resamples each surface by chord position with a monotonic root search and would drop a part that runs back. 246 real files: no reversal at all. |
| Curve samples shared by control-polygon length (about 4000, 1 to 256 per span) | One sample per span missed a loop in a coarse span of a 4509-point file whose other spans were dense. |
| Profile stage cached per airfoil, most recently used first, at least 32 entries and one per airfoil of the project | The crossing test costs 10 to 60 ms per airfoil; first-in-first-out eviction of 32 entries never hit for projects with more than 32 airfoils. |
| Profile thickness checked before and after the trailing-edge setting | The linear taper of the closed and fixed-thickness modes pulls the surfaces through each other where an airfoil is thinner inside than its trailing-edge gap. |
| Loft deviation measured in 3D against min(0.5 mm, 10 % chord); fitted chord below 0.9 mm or reversed is an error | Linear rows between stations twisted by 180° collapse to the pivot at midspan while the x-only deviation stays 0; zigzag degree-5 guides that 32 added stations cannot follow fold the fitted chord to -24 mm. |
| Planform statistics by 5-point Gauss-Legendre quadrature of the intended planform | Trapezoids over stations were off by 1.45 % (8 stations per panel) to more than 2 % (3 stations) in smooth mode; the quadrature is exact for cubic spanwise splines. |
| Interior contact (thickness at most 1e-5 chord between 1 % and 99 % chord) is an error, in the airfoil check and again after the trailing-edge setting | Touching surfaces give a zero-thickness solid. Thickness between polylines is smallest at a vertex, so every file point is checked, from the lowest upper to the highest lower point at each x (vertical segments, surfaces folding back in x). 247 real files: no new rejection. |
| Airfoil outlines longer than 10 chords are rejected before the crossing test | A 5000-point serpentine without crossings took 4 s in the grid-binned crossing test; the length check rejects it in 45 ms. Airfoil outlines are about 2 chords long. |
| Airfoil camber measured from the chord line (leading edge to trailing-edge midpoint) | Standard geometric definition; the previous horizontal reference through the leading edge mixed in the chord inclination (NACA 4415: 3.56 %). The designated camber (4 %) is not recoverable from coordinates: the camber line starts behind the geometric leading edge and thickness is applied normal to it. |
| Minimum chord 1 mm for every section and span position, also the floor of a pointed tip | Owner requirement: below 1 mm the profile falls under the resolution of meshes, STEP modelling tolerances and manufacturing. With the default 1/200 ratio the tip chord reaches the floor for previous chords below 200 mm (4 of 6 wizard presets with a pointed tip). |
| Trailing-edge thickness limited to 5 % of the local chord | Keeps small tip profiles free of self-intersection with a fixed thickness in mm. |
| Through-point guide curves parametrized by span position | y(t) is exactly linear, so a guide cannot double back in span; x(y) is a spline function. |
| Adaptive spanwise stations (up to 32 extra) | Stations are added where the loft deviates more than 0.5 mm (10 % of smaller chords) from the intended surface (leading edge, trailing edge, 5 chord stations per surface at N = 60), e.g. at pointed elliptic tips (pointed glider preset: 6 extra, 0.16 mm). |
| Chord and planform checks on 257 span samples plus every guide breakpoint | The loft passes through the stations only; a guide crossing or guide detail between stations is reported (error below 1 mm chord, stations added above 0.5 mm edge deviation, warning if still above after 32 added stations). |
| aerodesign.de and mh-aerotools.de coordinates not bundled | Their terms grant personal use and restrict redistribution (quotes in the wiki page Airfoil-Sources). The app links to them and fills in attribution on upload. |
| MIT license for the code | Chosen by the owner. Airfoil data keeps its own terms. |
| Bundled airfoils only under a free license: public domain (by law, expired copyright or dedication) or CC0-1.0, Unlicense, CC-BY-4.0, CC-BY-3.0, MIT, BSD-2-Clause, BSD-3-Clause | Owner requirement: bundled airfoils are free to use. Personal-use, non-commercial, no-derivatives, share-alike, "ask first" and inferred permissions are excluded. `scripts/check-airfoils.mjs` enforces the list. |
| GitHub Actions: checkout v7, setup-node v7, setup-python v7, cache v6, upload-artifact v7, configure-pages v6, upload-pages-artifact v5, deploy-pages v5 | Latest majors on 2026-09-29; all `runs.using: node24` (upload-pages-artifact is composite on upload-artifact v7), checked in each `action.yml`. |

## Measurements

Node.js 24.21, sandbox x86-64 CPU, 2026-09-29 (`buildWing`, `exportMeshes(..., 'merged')`, `wingToStep`):

| Case | Chord stations | Build | Mesh | STEP write | STEP size |
| --- | --- | --- | --- | --- | --- |
| Sport preset, 2 sections | 60 | 17 ms | 1 ms | 3 ms | 99 KB |
| Sport preset, 2 sections | 200 | 40 ms | 1 ms | 4 ms | 303 KB |
| Glider preset, elliptic guides, 17 stations | 60 | 36 ms | 12 ms | 6 ms | 445 KB |
| Glider preset, elliptic guides, 17 stations | 200 | 89 ms | 42 ms | 19 ms | 1398 KB |

Mean of 10 runs after 2 warm-up runs (STEP: 3 runs), load average 3.3 (other processes running).
Build times include the smooth overshoot check, the section-row crossing test at sections and
station midpoints, the 3D deviation on 5 chord stations per surface and the fitted-surface probes
at the quarter points of every station interval;
the profile stage is cached after the warm-up runs (first build of a new airfoil: 35 to 100 ms more). Cap triangulation pairs upper and lower points per chord station (linear time); ear clipping
(cubic time) is the fallback.

## Open items

- Bundled library: research on free-licensed and public-domain airfoil sources (NACA/NASA/NREL
  reports, Drela, databases, historical series, open releases) is in progress.
- Written permission from Hartmut Siegmann (postal only, per his site) or Martin Hepperle
  (e-mail in his page footer) would allow bundling HS or MH airfoils.
- First run on `main`: confirm Pages deployment and the wiki push with `GITHUB_TOKEN`.
- Not measured: build time and memory on phones.
