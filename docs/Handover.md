# Handover

State of Wingdesigner on 2026-10-01, for the next person or session that works on it. Read
`RECORD.md` first: it holds the verified state, the decisions with their reasons, the measurements and
the open items, each as a claim to re-check. This page adds where the work stands, what comes next,
how the owner works with contributors, and what the repository does not hold.

## Where the work stands

| Item | State on 2026-10-01 |
| --- | --- |
| Version | `package.json` holds 0.3.0. Released: `v0.1.0` on 9faa12b, `v0.2.0` on 3b9a67c and `v0.3.0` on 6580092 (2026-10-01), each with `wingdesigner-v<version>-site.zip` built by `release.yml`; `RECORD.md`, row CI, lists the runs and sizes. |
| Next release | Not prepared: the section Unreleased of `CHANGELOG.md` is empty. The steps: Development, section Release. |
| `main` | Release 0.3.0 (6580092, the merge of pull request #10) and the record of that release in `RECORD.md`, on this page and in Development, section Release. |
| Unit tests | 543 in 18 files (Vitest). |
| Browser tests | 179 in 12 spec files, 358 runs: Chromium at 1280 x 720 px and in the Pixel 7 profile (Playwright); 31 runs are skipped by design (tests for one device only). |
| Export validation | 12 STEP (Standard for the Exchange of Product model data) and 3MF (3D Manufacturing Format) cases, checked with OpenCascade (`cadquery-ocp` 8.0.1) and lib3mf 2.5.0. |
| Documentation | `README.md`, `README.de.md`, wiki pages in English and German in `docs/wiki/` (mirrored to the GitHub wiki by `docs.yml`), `RECORD.md`, `CHANGELOG.md`, `docs/Flow5upgrade.md`, this page. |

`npm run counts:check` keeps the counts of the READMEs, `RECORD.md` and the wiki pages equal to the
suites; it does not read this page. Current counts: `RECORD.md`, rows Unit tests and UI.

## Next steps

1. Step 2 of `docs/Flow5upgrade.md`: a rigid tilt of the whole part. A tilted XFLR5 part imports with
   vertical section planes and its tilt folded into the section values. The largest distance of
   XFLR5's STL (stereolithography) from the 4 tilted 35° V-tails of `initialAerodynamicSym.xfl` is
   2.87 mm for that reason (File Formats, section Differences from XFLR5; the tilts:
   `docs/Flow5upgrade.md`, section 2).
   - Project format: step 1 shipped in 0.2.0 as project format version 2, so step 2 raises it to
     version 3. An app of 0.2.0 or 0.3.0 refuses a version 3 file (`validateProject`).
   - Migration (`docs/Flow5upgrade.md`, section 2): a version 2 project with `foldedTilt` keeps its
     tilt. The upgrade undoes the fold about the stored pivot and applies the stored angle as the
     rigid part tilt; a project with an enabled or edited guide curve keeps its fold and the stored
     angle. Version 1 files and version 2 files without `foldedTilt` open with a part tilt of 0°;
     imports of project format version 1 hold no `foldedTilt` and stay folded.
   - Not decided: whether the statistics of a tilted part use the plane axes or the part axes.
   - The estimate of 2 to 4 h is a guess: size, user interface and exports of step 2 are not
     analysed.
2. Step 3 of `docs/Flow5upgrade.md`: the flow5 import of Extensible Markup Language (XML) files and
   `.fl5` files, with its decisions F1 to F6 and open points.
3. Question for the owner, not yet asked (`RECORD.md`, Open items): cambered NACA (National Advisory
   Committee for Aeronautics) sections of the generator get an airfoil frame, although the answer to
   Q9 reads "NACA and normalized airfoils do not move".
4. Not measured or not tested, among the Open items of `RECORD.md`: smooth blending with rolled
   section planes (not built), a rolled STEP file in a CAD (computer-aided design) program other than
   OpenCascade, STL and 3MF float32 precision of rolled caps, how often the fold test fires on real
   wings, the file choosers of Android and iOS, the import dialog with a screen reader, build time and
   memory on phones. The app is tested in Chromium only; Firefox and Safari are not tested (README,
   Limitations).
5. Known failures (`RECORD.md`, Open items):
   - The STEP file of `Final Design.xfl`, plane 1, main wing (S1223, closed cusped trailing edge)
     holds one solid that fails the BRepCheck of OpenCascade; with a trailing-edge thickness of 0.4 mm
     both solids are valid. The cause is not analysed. The file is not in the repository.
   - **Smooth** spanwise interpolation stops the build of 9 of 135 imported real surfaces.
   - Projects of the XFLR5 import in project format version 1, set to **Mitred**, carry the error of
     the folded tilt without a warning.

## Working with the owner

- One pull request per change, from a branch. The owner merges, or asks for the merge. After a merge
  the next change starts from `main` in a new pull request; a merged pull request takes no further
  commits.
- Before a merge: `ci.yml` passes on the head commit, and the Codex bot has reviewed that commit.
  Codex runs a code review and a security review on each push. Its pull request comment "Codex Review
  Summary" names the reviewed commit and the status of both. Findings come as a review with inline
  comments; a review without findings leaves only a 👍 reaction. When the summary does not name the
  head commit, the comment `@codex review` starts a review. Each finding is reproduced first, then
  fixed or answered on its thread.
- The owner pushes the release tags.
- Commit messages and pull request texts state the change and its effect, in imperative mood. No link
  to a chat session goes into a commit, a pull request, a comment or any other text on GitHub. Claude
  Code appends such a link to pull request texts by default; check the text after creating the pull
  request and remove the link.
- Documentation and code comments: present tense, no development history (that lives in
  `CHANGELOG.md` and git), numbers with units, every acronym expanded on its first use in a document,
  unknowns stated as unknown. English and German pages change together.
- Ask the owner when a task forks into a real design choice; follow the existing patterns for the
  rest.
- Keep `RECORD.md` current with every change that alters a verified fact, a decision or an open item.

## Checks before a push

The commands and their results are listed in Development, section Commands. The order used for a
change:

```bash
npm run lint
npm run coverage && npm run coverage:readme && npm run coverage:check
npm run docs:check && npm run i18n:check && npm run airfoils:check
npm run e2e
node scripts/check-test-counts.mjs --e2e-report playwright-report/results.json
npm run step:cases
python scripts/validate_step.py step-check/cases.json
python scripts/validate_3mf.py step-check/cases.json
npm run screenshots
```

- `npm run coverage:readme` writes the coverage tables of both READMEs; `ci.yml` fails when they
  drift (`coverage:check`).
- `npm run docs:check` checks that the 6 English–German page pairs exist, that both READMEs carry the
  coverage markers, and, in `docs/wiki/*.md` and both READMEs, that wiki links, relative links and
  images resolve, that every image has alt text, and 2 table errors (Development, section
  Documentation check). It does not compare the contents of the two languages and does not read this
  page, `docs/Flow5upgrade.md`, `RECORD.md` or `CHANGELOG.md`.
- `npm run i18n:check` checks that every interface text has a German translation (739 texts).
- `npm run e2e` took 5.4 min for 358 runs in the cloud container.
- `npm run screenshots` regenerates 26 images. An image that differs only by rendering noise is
  restored on its own: `git checkout -- docs/wiki/images/<name>.png` (German:
  `docs/wiki/images/de/<name>.png`). `git checkout -- docs/wiki/images` restores all 26, changed ones
  included. On 2026-09-30 the largest pixel difference of the noise was 23 of 255, with no text or
  layout change.

## Cloud container of 2026-09-30

Setup of the checks in a new container (`$SCRATCH`: a folder outside the repository):

```bash
curl -fsSL https://nodejs.org/dist/v24.21.0/node-v24.21.0-linux-x64.tar.xz | tar -xJ -C "$SCRATCH"
export PATH="$SCRATCH/node-v24.21.0-linux-x64/bin:$PATH"
export PW_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome
npm ci
python3 -m venv "$SCRATCH/venv"
export PATH="$SCRATCH/venv/bin:$PATH"   # python and pip of the virtual environment first
pip install cadquery-ocp==8.0.1.0.0 lib3mf==2.5.0
```

The `export` lines hold for the shell they run in; a new shell needs them again.

- Node.js on the default `PATH`: 22.22.2. The project needs Node.js 24 (`.nvmrc`).
- Chromium 141 at the `PW_CHROMIUM` path above.
- Python in the container: 3.11.15 (`ci.yml`: 3.12).
- Unit tests with coverage, the browser suite and sub-agents at the same time end with exit code 137
  (process killed); the heavy jobs run one after the other.
- `pkill -f <pattern>` matches the command line of the calling shell and ends it; processes are
  stopped by process identifier (ID).
- Files outside the repository do not survive the container.

## Not in the repository

- The XFLR5 comparison: the local driver that makes the code of XFLR5 6.62 write STL files, those STL
  files, and the scripts behind the numbers of File Formats, section Differences from XFLR5, and of
  `RECORD.md` (93 surfaces of 15 real projects). The driver links the XFLR5 sources (GPL-2.0-or-later,
  GNU General Public License); owner decision Q8 keeps it out of the repository. The method is
  described on that page: XFLR5's STL, XFLR5's construction without flaps, the same construction with
  the fitted airfoil curves of Wingdesigner, and the built wing, with one part of the distance per
  step. The owner holds a private copy of the driver source, the scripts and the per-surface results
  (`xflr5-comparison.zip`, 2026-09-30); the STL files and the sample projects are not in it. The
  scripts carry the absolute paths of the container they ran in.
- The sample projects: the 15 real projects of the comparison (93 surfaces), and the files of the
  reader checks in `RECORD.md`: 29 `.xfl` files (20 of XFLR5 users without a license, 4 of UASLab
  under the MIT license (license of the Massachusetts Institute of Technology) and their 4 copies
  re-saved by XFLR5 6.62 code, `fixtures_v662.xfl`) and 66 XML files (of XFLR5 users and own test
  files). The files of XFLR5 users come from public repositories. Files without a license stay out of
  the repository; the committed test files and their origin are listed in
  `test/fixtures/xflr5/SOURCE.md`.
- The flow5 sources and builds behind `docs/Flow5upgrade.md` (GPL-3.0).

## Where to look in the code

Development, section Architecture, describes the modules. Entry points by topic:

| Topic | Files |
| --- | --- |
| Wing loft, section placement, build checks | `src/geom/wing.js` (`buildWing`, `placeSection`, `mitredPlaneProblem`) |
| Section planes: roll, stretch, stored panel angles | `src/geom/planes.js` (`sectionPlanes`) |
| XFLR5 import | `src/import/xfl.js` (`.xfl` reader), `src/import/xflxml.js` (XML reader), `src/import/xflr5.js` (mapping, `airfoilFrame`, `placeAirfoil`, report), `src/ui/xflr5.js` (dialog) |
| Wizard | `src/model/wizard.js` (presets, `RANGES`, `wizardProject`), `src/ui/wizard.js` (dialog; a build error disables **Create design**) |
| Interface texts | `src/i18n/de/*.js` (German); `npm run i18n:check` |
