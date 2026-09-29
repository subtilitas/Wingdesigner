# Development

## Architecture

Plain JavaScript modules (ES2022), built with Vite. Only runtime dependencies: three.js (3D view)
and fflate (3MF zip). Geometry and file code has no DOM dependency and runs in Node.js for tests.

| Directory | Content |
| --- | --- |
| `src/geom/` | NURBS primitives (`nurbs.js`, `linalg.js`), profile curves (`profile.js`), spanwise blending (`spanwise.js`), guide curves (`guide.js`), wing loft (`wing.js`), meshes (`mesh.js`, `triangulate.js`), planform statistics (`stats.js`) |
| `src/airfoil/` | Parser (`parse.js`), polyline geometry (`geometry.js`), checks (`sanity.js`), NACA generator (`naca.js`), library (`library.js`) |
| `src/export/` | STEP (`step.js`), STL (`stl.js`), 3MF (`threemf.js`) |
| `src/model/` | Project model and validation (`project.js`), JSON import/export (`io.js`), edit operations (`edit.js`), wizard (`wizard.js`), default project (`defaults.js`) |
| `src/ui/` | DOM code: store with undo/redo, 3D viewer, 2D pan/zoom canvas, panels, dialogs |
| `public/airfoils/` | Bundled airfoil files and `index.json` with source and license per file |
| `scripts/` | Coverage table, airfoil library check, STEP and 3MF case export, OpenCascade and lib3mf validation |
| `test/` | Vitest unit tests |
| `e2e/` | Playwright tests (9 spec files, 123 tests, run on desktop 1280 x 720 and Pixel 7) and `helpers.js` (fails a test on any page or console error; touch gestures, downloads, STL parsing) |

Data flow: every edit mutates the project in the store → `buildWing(project)` → viewer, panels and
checks re-render. The build takes a few milliseconds to tens of milliseconds at default resolution
(not measured on phones).

## Commands

```bash
npm ci
npm run dev              # http://localhost:5173
npm test                 # unit tests
npm run lint
npm run build            # dist/
npm run e2e              # Playwright against the build; PW_CHROMIUM=/path/to/chrome to use a local browser
npm run coverage && npm run coverage:readme   # update the README coverage table
npm run airfoils:check
npm run step:cases && python scripts/validate_step.py step-check/cases.json && python scripts/validate_3mf.py step-check/cases.json
```

STEP validation needs `pip install cadquery-ocp==8.0.1.0.0` (OpenCascade 8 Python bindings), 3MF
validation `pip install lib3mf==2.5.0` (3MF Consortium reference library, strict mode).

## Continuous integration

| Workflow | Trigger | Jobs |
| --- | --- | --- |
| `ci.yml` | push to `main`, pull requests, manual | lint + unit tests + coverage + README coverage check + airfoil check; STEP validation with OpenCascade and 3MF validation with lib3mf; Playwright tests (Chromium, 246 runs; results uploaded on failure); build; deploy to GitHub Pages (push to `main` only, after all jobs pass). Runs on `main` queue; runs on other refs cancel the older run of the same ref. |
| `docs.yml` | push to `main` touching `docs/wiki/`, manual | copies `docs/wiki/` into the repository wiki with `GITHUB_TOKEN` (`contents: write`) |
| `release.yml` | tag `v*` | checks tag = `package.json` version, tests, builds, attaches `wingdesigner-<tag>-site.zip` to a GitHub release with the CHANGELOG section as notes |

All actions run on Node.js 24: `actions/checkout@v7`, `actions/setup-node@v7`,
`actions/setup-python@v7`, `actions/cache@v6`, `actions/upload-artifact@v7`,
`actions/configure-pages@v6`, `actions/upload-pages-artifact@v5`, `actions/deploy-pages@v5`.

The README coverage table is not rewritten by CI. `coverage:check` fails when it differs from the
current coverage; update it locally with `npm run coverage && npm run coverage:readme`.

## Release

1. Update `version` in `package.json` and move the `Unreleased` entries in `CHANGELOG.md` under the new version.
2. Commit, then tag: `git tag v0.2.0 && git push origin v0.2.0`.

## Test data policy

Tests use generated NACA airfoils only. Third-party airfoil files are not committed unless their
license allows redistribution (see [[Airfoil Sources|Airfoil-Sources]]).
