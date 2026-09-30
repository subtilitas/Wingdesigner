# Handover

State of Wingdesigner on 2026-09-30, for the next person or session that works on it. Read
`RECORD.md` first: it holds the verified state, the decisions with their reasons, the measurements and
the open items, each as a claim to re-check. This page adds where the work stands, what comes next,
how the owner works with contributors, and what the repository does not hold.

## Where the work stands

| Item | State |
| --- | --- |
| Version | `package.json` holds 0.3.0 (pull request #10). Released: `v0.1.0` on 9faa12b and `v0.2.0` on 3b9a67c, each with `wingdesigner-v<version>-site.zip` built by `release.yml`. |
| Next release | Tag `v0.3.0` on the merge commit of pull request #10. `release.yml` takes the release notes from the 0.3.0 section of `CHANGELOG.md` (Changed, Fixed). |
| `main` | dd72ec5, the merge of pull request #9: wizard dihedral −60 to 60°, exact airfoil frames of the XFLR5 import, the attribution of the differences from XFLR5. |
| Unit tests | 543 in 18 files (Vitest). |
| Browser tests | 179 in 12 spec files, 358 runs: Chromium at 1280 x 720 and in the Pixel 7 profile (Playwright); 31 runs are skipped by design (tests for one device only). |
| Export validation | 12 STEP (Standard for the Exchange of Product model data) and 3MF (3D Manufacturing Format) cases, checked with OpenCascade (`cadquery-ocp` 8.0.1) and lib3mf 2.5.0. |
| Documentation | `README.md`, `README.de.md`, wiki pages in English and German in `docs/wiki/` (mirrored to the GitHub wiki by `docs.yml`), `RECORD.md`, `CHANGELOG.md`, `docs/Flow5upgrade.md`, this page. |

## Next steps

1. Merge pull request #10, wait for `ci.yml` on `main`, then push the tag:

   ```bash
   git fetch origin main && git tag v0.3.0 origin/main && git push origin v0.3.0
   ```

2. Step 2 of `docs/Flow5upgrade.md`: a rigid tilt of the whole part. A tilted XFLR5 part imports with
   vertical section planes and its tilt folded into the section values. The 4 tilted 35° V-tails of
   `initialAerodynamicSym.xfl` lie 2.87 mm from XFLR5's surface for that reason (File Formats,
   section Differences from XFLR5). Not decided: whether the statistics of a tilted part use the
   plane axes or the part axes. The estimate of 2 to 4 h is not analysed.
3. Step 3 of `docs/Flow5upgrade.md`: the flow5 import (XML (Extensible Markup Language) and `.fl5`),
   with its decisions F1 to F6 and open points.
4. Owner question open in `RECORD.md`: cambered NACA (National Advisory Committee for Aeronautics)
   sections of the generator get an airfoil frame, although the answer to Q9 reads "NACA and
   normalized airfoils do not move".
5. Not measured or not tested, listed under Open items in `RECORD.md`: smooth blending with rolled
   section planes (not built), a rolled STEP file in a CAD (computer-aided design) program other than
   OpenCascade, the file pickers of Android and iOS, screen readers, Firefox and Safari.

## Working with the owner

- One pull request per change, from a branch. The owner merges, or asks for the merge. After a merge
  the next change starts from `main` in a new pull request; a merged pull request takes no further
  commits.
- Before a merge: `ci.yml` passes on the head commit, and the reviews of the Codex bot on that commit
  are read. Codex reviews every push. When the head commit has no Codex review, a pull request comment
  `@codex review` starts one. Each finding is reproduced first, then fixed or answered on its thread.
- The owner pushes the release tags.
- Commit messages and pull request texts state the change and its effect, in imperative mood. No link
  to a chat session goes into a commit, a pull request, a comment or any other text on GitHub.
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
- `npm run docs:check` checks that every English page has its German counterpart, that wiki links
  and images resolve, and the table syntax. It does not compare the contents of the two languages.
- `npm run i18n:check` checks that every interface text has a German translation (739 texts).
- `npm run e2e` took 5.4 min for 358 runs in the cloud container.
- `npm run screenshots` regenerates 26 images. Images that differ only by rendering noise are restored
  with `git checkout -- docs/wiki/images` (largest pixel difference 23 of 255 on 2026-09-30, no text
  or layout change).

## Cloud container of 2026-09-30

- The container had Node.js 22.22.2; the project needs Node.js 24 (`.nvmrc`). The checks ran with a
  Node.js 24.21.0 Linux x64 build unpacked outside the repository and put first on `PATH`.
- Chromium 141: `PW_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome`.
- Python for the STEP and 3MF checks: a virtual environment outside the repository with
  `cadquery-ocp==8.0.1.0.0` and `lib3mf==2.5.0`.
- Unit tests with coverage, the browser suite and sub-agents run at the same time ended with exit
  code 137 (process killed); the heavy jobs run one after the other.
- `pkill -f <pattern>` matched the command line of the shell itself and ended it; processes are
  stopped by process ID.
- Files outside the repository do not survive the container.

## Not in the repository

- The XFLR5 comparison: the local driver that makes the code of XFLR5 6.62 write STL
  (stereolithography) files, those STL files, and the scripts behind the numbers of File Formats,
  section Differences from XFLR5, and of `RECORD.md` (93 surfaces of 15 real projects). The driver
  links the XFLR5 sources (GPL-2.0-or-later, GNU General Public License); owner decision Q8 keeps it
  out of the repository. The method is described on that page: XFLR5's STL, XFLR5's construction
  without flaps, the same construction with the fitted airfoil curves of Wingdesigner, and the built
  wing, with one part of the distance per step. The owner holds a private copy of the driver source,
  the scripts and the per-surface results (`xflr5-comparison.zip`, 2026-09-30); the STL files and the
  sample projects are not in it. The scripts carry the absolute paths of the container they ran in.
- The real XFLR5 projects of the comparison: 29 `.xfl` files and 66 XML files of XFLR5 users,
  collected from public repositories. Files without a license stay out of the repository; the
  committed test files and their origin are listed in `test/fixtures/xflr5/SOURCE.md`.
- The flow5 sources and builds behind `docs/Flow5upgrade.md` (GPL-3.0).

## Where to look in the code

Development, section Architecture, describes every module. The files touched most recently:

| Topic | Files |
| --- | --- |
| Wing loft, section placement, build checks | `src/geom/wing.js` (`buildWing`, `placeSection`, `mitredPlaneProblem`) |
| Section planes: roll, stretch, stored panel angles | `src/geom/planes.js` (`sectionPlanes`) |
| XFLR5 import | `src/import/xfl.js` (`.xfl` reader), `src/import/xflxml.js` (XML reader), `src/import/xflr5.js` (mapping, `airfoilFrame`, `placeAirfoil`, report), `src/ui/xflr5.js` (dialog) |
| Wizard | `src/model/wizard.js` (presets, `RANGES`, `wizardProject`), `src/ui/wizard.js` (dialog; a build error disables **Create design**) |
| Interface texts | `src/i18n/de/*.js` (German); `npm run i18n:check` |
