Deutsch: [[Entwicklung|Entwicklung]]

# Development

## Architecture

| Property | Value |
| --- | --- |
| Language | JavaScript modules, no framework. Build target ES2022 (ECMAScript 2022); ESLint parses ECMAScript 2024 (`ecmaVersion: 2024`). |
| Build tool | Vite `^8.3.1`. Relative base `./`, source maps. `build.chunkSizeWarningLimit: 900`: Vite warns when a chunk exceeds 900 kB (Vite unit: 1 kB = 1000 bytes). |
| Runtime dependencies | three.js `^0.186.1`: 3D view, imported only in `src/ui/viewer3d.js`. fflate `^0.8.3`: zip container of 3D Manufacturing Format (3MF) files, imported only in `src/export/threemf.js`. |
| Node.js | 24 or later (`.nvmrc`: 24; `engines.node`: `>=24`) |
| Unit tests | Vitest `^5.0.2` in Node.js; timeout 20000 ms per test (`test.testTimeout` in `vite.config.js`); coverage with `@vitest/coverage-v8` |
| Browser tests | Playwright `^1.63.0` |
| App version | `package.json` `version`, compiled in as `__APP_VERSION__` by `vite.config.js`. Shown in the **Help** dialog. Written to `generator.version` in the project file (JavaScript Object Notation, JSON). |

Code in `src/geom/`, `src/airfoil/`, `src/export/` and `src/model/` does not use the Document Object Model (DOM) application programming interface (API).
Unit tests and scripts import it in Node.js.
`src/airfoil/library.js` uses `fetch` to load `public/airfoils/index.json`.

| Path | Content |
| --- | --- |
| `index.html` | Page shell; loads `src/main.js` |
| `src/main.js` | Entry: store, rebuild scheduling, top bar, status bar, **Checks** tab, **Help** dialog, autosave |
| `src/geom/`, `src/airfoil/`, `src/export/`, `src/model/`, `src/ui/` | See [Modules](#modules) |
| `public/airfoils/` | 6 coordinate files (`.dat`, Selig format), `index.json` with 6 entries, `NOTICE.md` (source, legal basis, conditions and attribution per file). An entry needs a free license and a line in `NOTICE.md` (see [Airfoil library check](#airfoil-library-check)). The 17 National Advisory Committee for Aeronautics (NACA) presets are computed at run time, not stored. |
| `scripts/` | See [Scripts](#scripts) |
| `test/` | Vitest unit tests (`*.test.js`), `helpers.js` (NACA sample project), `step-cases.js` (validation cases for Standard for the Exchange of Product model data (STEP) files and 3MF files) |
| `e2e/` | Playwright end-to-end (E2E) browser tests (`*.spec.js`), `helpers.js` |
| `docs/wiki/` | Wiki pages in English and German, `_Sidebar.md`, `images/` |
| `.github/workflows/` | `ci.yml`, `docs.yml`, `release.yml` |

Generated and not committed (`.gitignore`): `dist/`, `coverage/`, `step-check/`, `test-results/`, `playwright-report/`.

### Modules

| File | Content |
| --- | --- |
| `src/geom/nurbs.js` | Non-uniform rational B-spline (NURBS) primitives |
| `src/geom/linalg.js` | Band lower-upper (LU) factorization without pivoting (B-spline interpolation, used by `src/geom/nurbs.js`); dense LU factorization with partial pivoting (unit tests only) |
| `src/geom/profile.js` | Airfoil as NURBS curve; chordwise resampling |
| `src/geom/spanwise.js` | Spanwise blending of section values (`linear`, `smooth`) |
| `src/geom/guide.js` | Guide curves (nose line, end line) |
| `src/geom/wing.js` | Wing loft: `buildWing`; profile cache |
| `src/geom/mesh.js` | Tessellation, mirror, mesh volume, area and edge check |
| `src/geom/triangulate.js` | End-cap triangulation: strip of upper and lower point pairs (linear time); ear clipping as fallback |
| `src/geom/stats.js` | Planform statistics |
| `src/airfoil/parse.js` | Airfoil file parser |
| `src/airfoil/geometry.js` | Polyline geometry |
| `src/airfoil/sanity.js` | Sanity checks, `importAirfoilText` |
| `src/airfoil/naca.js` | NACA 4- and 5-digit generator |
| `src/airfoil/library.js` | 17 NACA presets, bundled library, external sources |
| `src/export/step.js` | STEP writer; file format International Organization for Standardization (ISO) 10303-21 |
| `src/export/stl.js` | Binary stereolithography (STL) writer |
| `src/export/threemf.js` | 3MF writer |
| `src/model/project.js` | Project model, defaults, limits, validation |
| `src/model/io.js` | Project JSON import and export |
| `src/model/edit.js` | Edit operations |
| `src/model/wizard.js` | Wizard presets and parameter ranges |
| `src/model/defaults.js` | Project on first load |
| `src/ui/store.js` | Store with undo and redo |
| `src/ui/viewer3d.js` | 3D view |
| `src/ui/panzoom.js` | 2D canvas with pan and zoom |
| `src/ui/sections.js` | **Sections** tab |
| `src/ui/planform.js` | **Planform** tab |
| `src/ui/airfoils.js` | **Airfoils** tab, upload preview |
| `src/ui/settings.js` | **Settings** tab |
| `src/ui/wizard.js` | Wizard dialog |
| `src/ui/exportui.js` | **Export** dialog |
| `src/ui/dom.js` | DOM helpers |
| `src/ui/styles.css` | Styles |

### Scripts

| Script | Content |
| --- | --- |
| `scripts/coverage-readme.mjs` | Coverage table in both READMEs |
| `scripts/check-airfoils.mjs` | Airfoil library check |
| `scripts/export-step-cases.mjs` | STEP and 3MF case export |
| `scripts/validate_step.py` | STEP validation (OpenCascade) |
| `scripts/validate_3mf.py` | 3MF validation (lib3mf) |
| `scripts/screenshots.mjs` | Wiki screenshots |
| `scripts/check-docs.mjs` | Documentation check |

### Data flow

1. A tab (class in `src/ui/`) calls `store.update(mutate, { key })`.
   The store pushes the previous project onto the undo stack and clears the redo stack.
   The undo stack holds at most 100 steps. Undo and redo stack together hold at most 64,000,000 characters of serialized project (JSON). Above that, the oldest undo steps are dropped first, then the redo steps farthest from the current project. The newest step of each stack stays.
   Consecutive updates with the same key, each less than 800 ms after the one before, form one undo step, e.g. a point drag.
2. The store notifies its subscribers.
   `main.js` schedules at most 1 rebuild in the next animation frame; further notifications before that frame share it.
3. The rebuild runs `buildWing(project)`.
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
| `wingdesigner.tab` | Active tab |

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

Many sections: **Smooth**, **Spanwise stations per panel with guides or smooth mode** 40, **Chordwise stations per surface** 200; Node.js 24, load average 3.3 (other processes running).

| Case | Spanwise stations after the grid limit | `buildWing` |
| --- | ---: | ---: |
| 20 sections | 400 (21 per panel) | 0.8 s |
| 200 sections | 399 (2 per panel) | 2.0 s |

- Grid limit: at most 160,000 grid points (spanwise stations × (2N + 1) profile points, N = **Chordwise stations per surface**) before added stations (`MAX_GRID_POINTS` in `src/geom/wing.js`). Above it the build uses fewer stations per panel and gives a warning.
- Section layout, profile cache state and number of runs of these 2 measurements: not recorded.

Build time without cached profiles: not measured in this run.
Build time and memory use on phones: not measured.

## Test data policy

| Data | Source |
| --- | --- |
| Airfoils in unit tests and STEP and 3MF cases | Generated from the NACA equations: `nacaAirfoil()` from `src/airfoil/naca.js`, `naca()` from `test/helpers.js` |
| Parser test inputs | Short synthetic strings in `test/airfoil.test.js` in the file formats of third-party sources, with invented coordinates |
| Browser test uploads | Generated in the spec files, no third-party data: 13-point `.dat` in `e2e/smoke.spec.js` and `e2e/mobile-layout.spec.js`; Selig, Lednicer, X/Yo/Yu percent table with decimal commas and invalid files (crossing surfaces, text) from the NACA 4-digit equations in `e2e/airfoils.spec.js` |
| Bundled library in browser tests | `e2e/airfoils.spec.js` lists the 6 files of `public/airfoils/` and adds S9104 to the project |
| Screenshot upload | NACA 4412 computed in `scripts/screenshots.mjs`, 14 x positions from 0 to 100 %, written as X/Yo/Yu percent table with decimal commas |

Third-party airfoil files are committed only under a license from the License row in [Airfoil library check](#airfoil-library-check).
Sources: [[Airfoil Sources|Airfoil-Sources]].
Parser test outside the repository on 2026-09-29: 1,964 third-party files from aerodesign.de, mh-aerotools.de and UIUC (University of Illinois Urbana-Champaign). Results per set: [[Airfoil Sources|Airfoil-Sources]], section Parser test.

## Commands

Setup: `npm ci`. Requires Node.js 24 or later (`.nvmrc`: 24).
Browser tests and screenshots also need Chromium: `npx playwright install chromium` (Linux system libraries: `--with-deps`), or `PW_CHROMIUM` set to a local binary.

| Command | Runs | Result |
| --- | --- | --- |
| `npm run dev` | `vite` | Development server at `http://localhost:5173` (next free port when 5173 is in use) |
| `npm run build` | `vite build` | Static site in `dist/` |
| `npm run preview` | `vite preview` | Serves `dist/` at `http://localhost:4173` (next free port when 4173 is in use) |
| `npm run lint` | `eslint .` | Lint errors; exit code 1 on error |
| `npm test` | `vitest run` | Unit tests `test/**/*.test.js` in Node.js: 182 tests in 7 files |
| `npm run test:watch` | `vitest` | Unit tests, re-run on file change |
| `npm run coverage` | `vitest run --coverage` | Table on the terminal, `coverage/coverage-summary.json`, HyperText Markup Language (HTML) report in `coverage/`. Covers `src/**/*.js` without `src/ui/` and `src/main.js`. |
| `npm run coverage:readme` | `node scripts/coverage-readme.mjs` | Writes the coverage table into `README.md` and `README.de.md` between `<!-- coverage:start -->` and `<!-- coverage:end -->` |
| `npm run coverage:check` | `node scripts/coverage-readme.mjs --check` | Exit code 1 when a README table differs from `coverage/coverage-summary.json`; exit code 2 when that file or a marker is missing |
| `npm run airfoils:check` | `node scripts/check-airfoils.mjs` | Checks in [Airfoil library check](#airfoil-library-check); exit code 1 on a problem |
| `npm run e2e` | `npm run build && playwright test` | Browser tests in `e2e/` against `vite preview` on port 4173 |
| `npm run step:cases` | `node scripts/export-step-cases.mjs step-check` | 8 STEP files, 8 3MF files and `cases.json` in `step-check/` |
| `npm run screenshots` | `node scripts/screenshots.mjs` | 12 Portable Network Graphics (PNG) files in `docs/wiki/images/` |
| `npm run docs:check` | `node scripts/check-docs.mjs` | Documentation check; exit code 1 on a problem |

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

125 tests in 9 spec files, 250 runs (both projects). The `test` object of `e2e/helpers.js` fails a test on any uncaught page error or console error.

30 tests run in one project only (`test.skip` in the other project):

| Spec file | `desktop` only | `mobile` only |
| --- | --- | --- |
| `e2e/mobile-layout.spec.js` | 1: sections table, brand, top bar in 1 row | 17: every test in `phone layout` (no sideways scroll, top bar, tap targets, section cards, tip note, 360 px wide phone, dialogs in portrait and landscape) |
| `e2e/viewer.spec.js` | 3: mouse drag rotates, right mouse button drag pans, mouse wheel zooms | 4: one-finger rotate, two-finger pan, two-finger pinch zoom, **Enlarge** |
| `e2e/planform.spec.js` | 1: zoom buttons, mouse wheel, double-click fit | 2: one-finger drag of a guide point, two-finger pinch zoom |
| `e2e/sections.spec.js` | 2: Ctrl+Z and Ctrl+Shift+Z, Ctrl+Y | 0 |

No test is marked `test.fail`.
`npm run e2e` rebuilds `dist/` first; before a direct `npx playwright test`, run `npm run build`.

### STEP and 3MF validation

Python: 3.12 in the `ci.yml` job `step`; other versions not tested.

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

Exit code 1 when a check fails.

| 3MF check per file (`validate_3mf.py`) | Pass condition |
| --- | --- |
| Read | Reader in strict mode (`SetStrictModeActive`), 0 warnings |
| Objects | 1 mesh object per expected shell with the expected triangle count: 2 when mirrored (export mode `halves`), 1 for a half wing (export mode `right`) |
| Topology | Every object passes `IsManifoldAndOriented` |

Exit code 1 when a check fails or when `cases.json` holds no 3MF case.

Cases from `test/step-cases.js`. Base wing (`sampleProject()` in `test/helpers.js`):

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
| `pointed-tip` | Pointed tip, ratio 0.002 (1/500); trailing-edge thickness 0.4 mm | 2 |
| `pointed-elliptic-closed` | Pointed tip, ratio 0.005 (1/200); nose line and end line meet at x = 115 mm, y = 600 mm; closed trailing edge | 2 |
| `symmetric-0009` | NACA 0009 at every section | 2 |

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

### Screenshots

`npm run screenshots` regenerates all images in `docs/wiki/images/`.
It builds the site, serves it on port 4175 and drives Chromium with Playwright.
Desktop: 1280 x 800 CSS px, device scale 1. Phone: Pixel 7, device scale 2.625. Light color scheme.

| File | State | Size (px) |
| --- | --- | --- |
| `wizard.png` | Wizard, **Glider** preset | 960 x 784 |
| `main-desktop.png` | Full window after creating the **Glider** | 1280 x 800 |
| `sections.png` | **Sections** tab, **Glider**, 3 sections | 600 x 730 |
| `planform.png` | **Planform** tab, **Glider**, nose line and end line on | 600 x 730 |
| `airfoils.png` | **Airfoils** tab, **Glider** | 600 x 730 |
| `upload-preview.png` | Upload preview of a synthetic X/Yo/Yu percent table with decimal commas, opened over the **Glider** | 640 x 646 |
| `export-dialog.png` | **Export** dialog, **Glider** | 640 x 476 |
| `settings.png` | **Settings** tab, **Glider** | 600 x 730 |
| `checks.png` | **Checks** tab, **Glider** | 600 x 730 |
| `flying-wing-control-net.png` | 3D view, **Swept flying wing**, **Show NURBS control net** on | 680 x 730 |
| `mobile-main.png` | Phone, **Sport** preset | 1082 x 2202 |
| `mobile-planform.png` | Phone, **Planform**, **Sport**, end line on | 1082 x 2202 |

### Documentation check

`npm run docs:check` checks `docs/wiki/*.md`, `README.md` and `README.de.md`:

| Check | Fails when |
| --- | --- |
| Page pairs | A file of the 6 English–German pairs above is missing (`Home.md` excluded) |
| Coverage markers | `README.md` or `README.de.md` lacks `<!-- coverage:start -->` or `<!-- coverage:end -->` |
| Wiki links | The target page of a wiki link (double square brackets) has no file in `docs/wiki/` |
| Images | An embedded image file does not exist, or its alt text is empty |
| Relative links | The target of a relative Markdown link does not exist |

Paths resolve against `docs/wiki/` for wiki pages and against the repository root for the READMEs.
Not checked: language switch line, alt text language, link target language, link anchors (`#…`), external links (`http:`, `https:`, `mailto:`).

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
| `test` | Lint, unit tests, coverage | `lint`, `coverage`, `coverage:check`, `airfoils:check`, `docs:check`; uploads artifact `coverage` | `contents: read` | Every trigger |
| `step` | STEP and 3MF validation (OpenCascade, lib3mf) | Python 3.12, `pip install cadquery-ocp==8.0.1.0.0 lib3mf==2.5.0`, `step:cases`, `validate_step.py`, `validate_3mf.py`; uploads artifact `step-files` (STEP, 3MF, `cases.json`) | `contents: read` | Every trigger |
| `e2e` | Browser tests (Playwright) | `npx playwright install --with-deps chromium`, `npm run e2e` (build, then all specs in `e2e/`, both projects); on failure uploads artifact `playwright-results` (`test-results/`) | `contents: read` | Every trigger |
| `build` | Build site | `build`; on push to `main` also `configure-pages` and `upload-pages-artifact` with `dist/` | `contents: read`, `pages: read` | Every trigger |
| `deploy` | Deploy to GitHub Pages | `deploy-pages` to environment `github-pages`. Concurrency group `pages`: an active run is not cancelled. | `pages: write`, `id-token: write` | Push to `main`, after `test`, `step`, `e2e` and `build` pass |

Artifacts `coverage` and `step-files` are uploaded also when a step fails; `playwright-results` only when a step fails. All 3 are kept 14 days.
The pip cache key is `pip-ocp-<runner operating system>-8.0.1-lib3mf-2.5.0`.

| Action | Version | Used in |
| --- | --- | --- |
| `actions/checkout` | `v7` | `ci.yml`, `docs.yml`, `release.yml` |
| `actions/setup-node` | `v7` | `ci.yml`, `release.yml`; Node.js version from `.nvmrc`, npm cache |
| `actions/setup-python` | `v7` | `ci.yml` job `step` |
| `actions/cache` | `v6` | `ci.yml` job `step` (`~/.cache/pip`) |
| `actions/upload-artifact` | `v7` | `ci.yml` jobs `test`, `step`, `e2e` |
| `actions/configure-pages` | `v6` | `ci.yml` job `build` |
| `actions/upload-pages-artifact` | `v5` | `ci.yml` job `build` |
| `actions/deploy-pages` | `v5` | `ci.yml` job `deploy` |

All listed actions run on Node.js 24 (`runs.using: node24`); `upload-pages-artifact` is a composite action on `upload-artifact@v7`.

CI does not rewrite the README coverage tables.
Update them with `npm run coverage && npm run coverage:readme` and commit both READMEs.

Not verified: the `deploy` job and `docs.yml` have no recorded run on `main`.
The wiki clone in `docs.yml` requires the repository wiki to exist; GitHub creates it with the first page saved in the web interface.

## Release

`<version>`: the version to release, e.g. `0.2.0`. `package.json` holds `0.1.0`.

1. Set the version: `npm version <version> --no-git-tag-version` (updates `package.json` and `package-lock.json`).
2. In `CHANGELOG.md`, move the entries under `## [Unreleased]` to a heading `## [<version>] - YYYY-MM-DD`.
3. Commit and merge to `main`. Wait until `ci.yml` passes.
4. Tag and push: `git tag v<version> && git push origin v<version>`.

`release.yml` then runs:

| Step | Fails or produces |
| --- | --- |
| Tag check | Fails when the tag is not `v` + `package.json` `version` |
| `npm run lint`, `npm test`, `npm run build` | Fails on lint error, test failure or build error |
| Package | `wingdesigner-<tag>-site.zip` with the content of `dist/` |
| GitHub release | Title `Wingdesigner <tag>`, the zip file as asset. Notes: the `CHANGELOG.md` section from `## [<version>]` to the next `## ` heading; `See CHANGELOG.md.` when the section is missing. |

`release.yml` runs no coverage check, no airfoil library check, no documentation check, no STEP validation, no 3MF validation and no browser tests.
