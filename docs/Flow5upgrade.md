# flow5 upgrade: plan and decisions

This page records the plan and the owner's decisions for three planned changes to Wingdesigner:
mitred section planes, a rigid tilt of the whole part, and an import of flow5 planes. Status on
2026-09-30: step 1 is implemented (section "Step 1 as built"); steps 2 and 3 are planned. The text of
the sections below describes the plan as decided. Every effort, size, review and time figure is an estimate
scaled from the history of this repository, not measured on these changes. The section-plane figures
are scaled from the XFLR5 import, counted as 9,444 added lines in 12.1 h wall-clock, research
included. The flow5 figures are scaled from a smaller count of the same import, about 8,100 lines in
about 10.5 h, which leaves out the fixes of commit 7e3138c. All other numbers are measured or counted
in the code and the files, unless marked as estimated.

Sources:

- flow5 source (license GPL-3.0: GNU General Public License (GPL), version 3.0), commit f34093a of
  2026-09-21, and tags v7.53 (2025-11-14) to v7.57 (2026-06-16). Local builds of flow5 HEAD (f34093a)
  and v7.56 on Ubuntu 24.04 write and read the test files.
- XFLR5 6.62 source (Subversion (SVN) `tags/v6.62`) and STL (stereolithography) files written by a
  local driver built from its code (trunk r1506). They cover the test planes of
  `test/fixtures/xflr5/fixtures_v662.xfl` and a synthetic gull and 35° V-tail. The STL files are not
  in the repository.
- OpenVSP source, change log and documentation, version 3.48 and later.
- Prototypes of the section planes on the code of commit 84d4e5e (geometry, model and export code
  unchanged up to 9838021), rerun by an independent check. Prototypes of the flow5 geometry and XML
  reader, run against the local flow5 builds.

## Order of work

| Step | Change | Estimate | Why in this order |
| --- | --- | --- | --- |
| 1 | Mitred section planes behind a switch (option c) | 7 to 11 h | Restores the airfoil thickness on panels with dihedral; the XFLR5 import and the flow5 import both use it |
| 2 | Rigid tilt of the whole part | 2 to 4 h (not analysed) | With mitred sections, folding an imported tilt into the sections is no longer exact |
| 3 | flow5 import, Extensible Markup Language (XML) and `.fl5` (option C) | 9 to 12.5 h, plus F3 and F6 (not estimated) | Reuses the section mapping of the XFLR5 import and profits from steps 1 and 2 |

The order follows the two analyses. The owner decided only that the flow5 import starts after the
XFLR5 import is merged (F1; done: pull request #5, 2026-09-30). The flow5 estimate is made on the code
before steps 1 and 2.

## Step 1 as built

Code: `src/geom/planes.js` (plane rules, stretch, fold test), `src/geom/wing.js` (placement, stations,
checks, `mitredPlaneProblem`), `src/import/xflr5.js` (step 6 of the mapping). User-facing description:
wiki pages Geometry (section 3.8), File Formats (project format version 2, XFLR5 import step 6) and
User Guide (Settings, Checks).

| Plan item | As built |
| --- | --- |
| R1, R2 | **Settings** > **Section planes**, `settings.sectionPlanes` `"mitred"` (default) or `"vertical"`; project format version 2; a version 1 file opens vertical |
| R3 | Twist about the normal of the section plane; the stretch scales the thickness before the twist |
| R4 | **Linear** panels between planes of different roll get K stations and a cubic loft; panels of 2 stations are straight segments raised to that degree |
| R5 | Untilted imports mitred; tilted imports vertical with `foldedTilt`; fold or stretch fallback to vertical with an info line |
| R6 | Stretch limit 2 (60°) as a build error; fold test between neighbouring sections before the loft and between neighbouring stations after the fit |
| Smooth | Vertical planes and an info line (owner decision (b)) |
| Folded tilt with **Mitred** | Warning in Checks with the estimate 0.75 · c · sin(tilt) · sin(roll) (owner decision) |
| Imports of pull request #5 | Documented on the File Formats page, not converted (owner decision) |

Measured on 2026-09-30:

- XFLR5 6.62 STL of 93 surfaces of 15 real projects: 80 within 0.6 mm (75 with vertical planes).
  Untilted 35° V-tails 2.87 → 0.013 mm, the 40° V-tail of `mini_talon.xfl` 2.31 → 0.025 mm; the 4
  tilted V-tails stay at 2.87 mm (step 2). The flat wings of `Wing Design and Analysis.xfl` gain
  0.005 mm, because the build takes the rolls from the frame-moved sections.
- OpenCascade on the 10 STEP cases (2 mitred): all valid and closed, volume within 7.6e-5 of the
  mesh, cap edges within 2e-13 mm of their planes. A tip cap written vertical on the gull fails the
  new cap check (0.67 mm) and passes the volume check (0.0475 %).
- Wizard presets with dihedral build 9 or 17 stations; the Sport wing loses 1.4 % volume against the
  vertical build (the **Linear** blend instead of a ruled surface 0.343 mm off it), 0.02 % from the
  planes alone.

## 1. Mitred section planes

### Problem

Every airfoil lies in a vertical plane y = const (`placeSection` in `src/geom/wing.js`). Across a
panel with dihedral δ the wing is then cos δ as thick as the airfoil:

| Case | Thickness across the panel, today (measured) |
| --- | --- |
| Wizard presets, 0° to 4° dihedral | at most 0.24 % thin |
| V-tail, 35° | 81.9 % |
| Gull wing 0°/20°/45°/70° | 100 / 94.0 / 70.7 / 34.2 % |

### Construction

XFLR5 6.62, flow5 and OpenVSP (3.48 and later, with its default settings) build sections this way:

- The root stays vertical in the mirror plane y = 0.
- A section at a dihedral break lies in the bisector plane of its two panels (mitre plane).
- The tip is perpendicular to the last panel.
- Each airfoil is stretched by 1/cos of the angle between its plane and the panel: 1/cos δ₀ at the
  root, 1/cos(Δδ/2) at a break, 1 at the tip. The thickness measured perpendicular to each panel then
  equals the airfoil thickness.

The span position y, the planform, and the projected span, area and mean aerodynamic chord (MAC) stay
the same (equal to 4 decimals on the 6 wizard presets). The volume grows by 1/cos δ on a straight
panel: a 35° V-tail goes from 279,682 to 341,433 mm³.

### Measured benefit (prototype)

| Case | Thickness across the panel, mitred | Distance from XFLR5's construction at the sections, today → mitred |
| --- | --- | --- |
| V-tail 35° | 100.0 % | root 1.19 → 0.00 mm, tip 1.89 → 0.00 mm |
| Gull 15°/−5°, NACA (National Advisory Committee for Aeronautics) 0009 | 100.0 / 100.1 % | root / break / tip 0.32 / 0.28 / 0.51 → 0.00 / 0.02 / 0.03 mm |
| Test wing 3°/6°, NACA 0009 | 100.0 / 100.2 % | root / break / tip 0.01 / 0.07 / 0.79 → 0.00 / 0.03 / 0.05 mm |
| Steep gull 0°/20°/45°/70° | 100.0 % on every panel | not compared |

On the 35° V-tail the distance to XFLR5's own STL drops from 1.89 to 0.01 mm. On the Clark Y test wing
the section vertices move from 0.71 to 0.60 mm off XFLR5's STL. The largest distance over the part
goes from 0.91 to 0.94 mm. Two differences unrelated to the section planes set it:

- XFLR5 interpolates its airfoils linearly: 0.53 mm.
- A panel that changes airfoil and chord together differs by 0.93 mm at mid-panel.

### Decisions (owner, 2026-09-30)

| # | Question | Decision |
| --- | --- | --- |
| R1 | Which option | (c): one setting "Section planes: vertical \| mitred", with automatic mitre planes from the dihedral and no per-section input. |
| R2 | Default for new projects and the wizard | Mitred. Version 1 project files open with vertical sections. The wizard presets move by at most 1.02 mm; 6 export browser tests change. |
| R3 | Twist and stretch in a rolled plane | XFLR5's convention: twist about the normal of the section plane, only the thickness stretched. The streamwise incidence is atan(tan τ · cos φ): 1.64° for 2° twist at 35°, 99.9 % of the twist at 3°. |
| R4 | Surface between two sections in linear mode | The in-between airfoil placed in each in-between plane, as today's rule and as smooth mode and guide curves do. It differs from XFLR5's ruled surface by 0.05 mm at 35° and by up to 0.43 mm at 60° with taper and sweep. It gets an entry in the section "Differences from XFLR5" of the File Formats page. |
| R5 | Imports of tilted parts before step 2 exists | Tilted parts import with vertical sections (exact tilt, as today); untilted parts import mitred. |
| R6 | Span parameter and limits | y stays the span parameter (dihedral below 90°, no winglets). The stretch is limited to 2.0, which allows 60° between a section plane and its panel (the real XFLR5 samples reach 40°). A fold of two section planes is reported with the numbers of both sections. |

R6 in detail:

- A section whose stretch would exceed 2.0 (more than 60° between its plane and a panel: a first panel
  steeper than 60°, or a break of more than 120°) stops the build with an error that names the section
  and the angle, as a fold does. The stretch is never clamped.
- The fold check runs on every pair of neighbouring stations, with each station's chord, twist and
  thickness, whenever the build places stations between sections (guide curves, and linear panels
  with rolled planes). A fold is reported with its span position and the numbers of the sections of
  that panel.

R4 in detail: in linear mode, a panel whose two section planes differ gets the spanwise stations per
panel of Settings (8 by default) and a cubic loft in v, as with guide curves. With one station per
panel the loft is XFLR5's ruled surface, not the R4 surface: the R4 surface differs from it by 0.05 to
0.43 mm, below the 0.5 mm tolerance of the deviation probe, so the probe adds no stations. The loft
grid (`loftGrid` in `src/model/budget.js`), the size warnings, the STEP and mesh sizes, the label
"Spanwise stations per panel with guides or smooth mode" and the File Formats row of `degreeV` follow.

Straight panels (`spanwise` `"straight"`, 2026-09-30) are the ruled surface between the placed
sections, XFLR5's construction. With rolled planes a straight panel is therefore XFLR5's surface; R4
describes **Linear**. The XFLR5 import sets **Straight panels**.

A manual roll column (option (e), about 2 to 3 h as a later step) is not decided.

Options not taken:

- (a) Mitred always on. It changes every saved project with dihedral: presets up to 1.02 mm, a
  V-tail +22 % volume.
- (b) A roll column only. The user types the angles, and wrong angles give the wrong thickness.
- (d) Vertical sections with the airfoil stretched by 1/cos δ (3 to 4 h). It is right inside a
  straight panel, not at breaks: 99.3 / 101.1 % on a 15°/−5° gull, 64 to 130 % on the steep gull.
  The tip face stays vertical, 2.21 mm off XFLR5 at a 35° tip.

### Work

- Project format version 2. An older app refuses a version 2 file (`validateProject`) instead of
  dropping the new setting without a message (`resolveSettings` in `src/model/project.js` keeps only
  known keys).
- Validation of the new values: `validateProject` accepts the section-plane setting only as
  "vertical" or "mitred". The stored tilt angle lies within ±180° and its pivot x and z within
  ±1,000,000 mm (`LIMITS.maxCoordinate`); the part tilt of step 2 lies within ±360°. Open refuses other
  values with a message, as for the other settings, and `buildWing` checks them again (`limitErrors`).
- Migration of version 1 files: `projectFromJsonText` in `src/model/io.js` sets the section planes of a
  version 1 file to vertical before `resolveSettings` fills the missing keys from the defaults.
  Without this step a version 1 file with dihedral would reopen mitred, against R2. A test opens a
  version 1 file with dihedral and checks the vertical sections.
- Section placement in a rolled plane: about 150 lines in the prototype (`src/geom/wing.js`,
  `src/geom/mesh.js`, `src/export/step.js`).
- Checks and exports that give a wrong result without an error once section planes roll (measured in
  the prototypes):

| Place | With rolled planes |
| --- | --- |
| Root and tip control rows (set to the section y) | A 35° mitred tip edge moves by 2.392 mm; needs a projection onto the rolled plane |
| Row crossing test (works in x, z) | Must work in the section frame |
| Deviation probe (adds spanwise stations) | Needs the three-dimensional (3D) chord direction; adds stations that are not needed (4 instead of 2 on a 60° panel) |
| Standard for the Exchange of Product model data (STEP) end caps (plane normals 0, ±1, 0) | Tip edges lie 0.6 to 2.6 mm off their plane against a declared uncertainty of 1e-7 mm; OpenCascade's BRepCheck still reports the file as valid |
| Check y ≥ 0 (reference point only) | A root rolled 35° reaches y = ±3.10 mm without a message |
| Merge of the two halves at y = 0 | A root rolled 17.5° spans y from −2.118 to 2.309 mm, so the halves overlap by 2.1 mm, and the mesh check still reports the mesh as closed; the root stays vertical |
| Section order (y strictly increasing) | Mitred planes of a short panel cross (a 10 mm panel between 40° and 80°); needs a fold check |
| Stretch | 1/cos grows without bound; limit 2.0 (R6) |
| Project JSON `derived.stations` (y, v, xLE, z, chord, twist; `src/model/io.js`) | A station in a rolled plane also needs its roll and stretch: each entry gets `roll` (°) and `stretch`, and the File Formats page names them. Open ignores `derived` |

- CI (continuous integration): `scripts/validate_step.py` checks BRepCheck, closed shells, and the
  volume against the mesh volume of the same build within 0.05 % (tolerance 5e-4 from
  `scripts/export-step-cases.mjs`; the script default is 0.5 %). `test/step-cases.js` gets a mitred
  35° V-tail and a mitred 15°/−5° gull; both errors (−2.4 % and +0.22 % volume) exceed 0.05 %. A check
  of the cap planes is still needed for cap errors below 0.05 % of the volume.
- XFLR5 import: the airfoil frame moves along the rolled normal; R5 decides the tilted parts. The
  dihedral warning above 10° goes for imports with mitred section planes and stays for imports with
  vertical section planes (tilted parts under R5 and the fold fallback below): a tilted 35° V-tail
  still comes out 81.9 % thick.
- Folded tilt: an import that folds a tilt into x, z and twist (R5) stores the tilt angle and its
  pivot with the project, as values of format version 2. The pivot is the wing origin, the position
  x, z of the part (`mapSections` in `src/import/xflr5.js` turns each quarter-chord point about it
  and adds the angle to every twist). Without the stored values, a switch of such a project to
  mitred repeats the error of the folded tilt (section 2) without a warning, and step 2 cannot find
  the projects to convert.
- Version 1 files and browser copies written by the XFLR5 import of pull request #5 (deployed
  2026-09-30) hold a folded tilt without the stored values. They open vertical; a switch to mitred
  gives the error of the folded tilt without a warning, and step 2 leaves them folded. Owner decision
  (2026-09-30): the File Formats page documents this; no version 1 update.
- Untilted imports with a fold: when the mitre planes of an untilted import fail the fold check
  (R6), for example at the 0.5 mm panel of the equal-y move, the part imports with vertical section
  planes and an info line that names the sections. A test covers a 10° break with the 0.5 mm move.
  The fold check and the stretch limit (R6) are a function of the section values and airfoils alone,
  without a build. `mapXflr5` runs them on the candidate project and chooses the section planes from
  the result; the dialog then builds as today. The fallback therefore also holds when the dialog does
  not build (sizes above the warnings) and when the build has other errors. A stretch above 2.0 is
  treated as a fold.
- Tests that change: the 3 XFLR5 frame tests and the dihedral-warning test in
  `test/xflr5-map.test.js`, and the version tests in `test/wizard.test.js` and `e2e/export.spec.js`.
  Also: the smooth-mode unit tests on `sampleProject` (`test/helpers.js`, 1.9° and 3.8° dihedral) in
  `test/wing.test.js` and `test/wizard.test.js`; the STEP and 3MF case `closed-te-smooth` of
  `test/step-cases.js`, on which `scripts/export-step-cases.mjs` stops at any build error; the browser
  tests that choose Smooth on the Sport preset in `e2e/settings.spec.js` and `e2e/language.spec.js`;
  the browser test of the Sport preset surface (degree 1, 2 stations); and the 2 browser tests in
  `e2e/settings.spec.js` that compare the whole saved settings object. These projects set Section
  planes to vertical, or follow the decision on smooth mode.
- Size: 410 to 700 lines of code, 580 to 1,000 lines of tests, 300 to 500 lines of docs in English and
  German, 2 to 4 screenshots per language.
- Review: 24 to 56 findings over 3 code rounds and 2 docs rounds; a geometric critic fuzzes rolls,
  breaks, twist, pointed tips and guides against a port of XFLR5's construction (6.1e-5 mm from
  XFLR5's STL).
- Effort: 7 to 11 h wall-clock, 18 to 28 agent hours.

### Open points

- Smooth spanwise interpolation with mitred sections is not built; its thickness and the fold at the
  root are not measured. The prototype blends the section rolls along the span and takes the stretch
  from the straight panels. Until that construction is built, measured and covered by the fold check
  at every station, smooth mode is not built with a rolled section plane. Under R2 this touches the
  first-load sample wing and 4 of the 6 wizard presets (Trainer, Sport, Glider, Plank), which have
  dihedral. Owner decision (2026-09-30): (b) smooth mode builds with vertical section planes and an
  info line in Checks, as the import fallback does. Not taken: (a) a build error that names both
  settings; (c) a choice of Smooth that sets Section planes to vertical. A wing whose section
  planes are all vertical (no dihedral) builds in smooth mode as today. The refusal is never a
  validation error: autosave stores only projects that pass `validateProject`, and Open would refuse
  the file.
- The fold check is measured on one synthetic case (0°, 40°, 80°); how often it fires on real wings is
  unknown. With automatic mitre planes, the XFLR5 import's move of sections at equal y (at most
  0.5 mm) makes a 0.5 mm panel whose section planes differ by half the break angle. A derived
  estimate, not run, puts their intersection about 5.7 mm from the reference line at a 10° break,
  inside a 150 mm section of 12 % thickness: the import would fold the surface. The import then
  falls back to vertical section planes (Work, "Untilted imports with a fold").
- Not tested: a rolled STEP file in a computer-aided design (CAD) program.
- Float32 precision of STL and 3MF (3D Manufacturing Format) with rolled caps is not tested.
- Not tested: the real 35° and 40° V-tail samples with the prototype.
- The difference at mid-panel where a panel changes airfoil and chord together (0.93 mm on Fixture A)
  is gone with **Straight panels**. XFLR5's linear airfoil interpolation remains: median 0.15 mm over
  93 real surfaces, 1.01 mm for a 33-point Clark YS.
- A switch to mitred of a project with a stored folded tilt, before step 2 exists: owner decision
  (2026-09-30): a warning in Checks with the estimated error, not a blocked switch.
- With the prototype, 16 of 348 browser test runs fail on 84d4e5e; the independent check does not
  rerun the full browser suite.

## 2. Rigid tilt of the whole part

An imported wing or stabilizer sits as in the XFLR5 plane: today the tilt is folded into the section
values (x, z, twist), which is exact because vertical sections stay vertical under a rotation about
the y axis. With mitred sections the fold is no longer exact:

| Case | Error of the folded tilt |
| --- | --- |
| XFLR5 test wing, 2° tilt | 0.45 mm at the trailing edge (measured) |
| V-tail 35°, 3° tilt | 1.65 mm (measured) |
| Real XFLR5 sample `initialAerodynamicSym.xfl`: 35° V-tail, −3° tilt (3 planes) and −10° tilt (1 plane) | about 2.25 mm and 7.5 mm at a 100 mm tip (estimated: 0.75 · chord · sin(tilt) · sin(roll)) |

A rigid rotation of the whole part after the build brings the trailing edges to within 0.003 mm
(measured). Size, user interface and exports are not analysed; 2 to 4 h is a guess. A roll of the
whole part (flow5's `rx`) is the same kind of transform; see F4. The extent check
(`LIMITS.maxExtent`, 1,200,000 mm, in `buildWing`) runs on the placed sections before the rotation. So
the rigid tilt checks the extents again after the rotation: a section near x = z = 1,000,000 mm
passes before and reaches about 1,414,000 mm after a 45° tilt.

Migration of a folded tilt: step 2 first undoes the fold of a project with a stored tilt. It turns
the twist pivot point of each section back about the stored pivot by the stored angle: x + p · c, with
p the current Settings > Twist pivot and c the chord the build uses (for a pointed tip, the scaled tip
chord). With a pivot of 0.25 and a flat tip, this is the quarter-chord point that `mapSections` turns.
It subtracts the angle from every twist and then applies the same angle as a rigid part tilt about the
same pivot.

The stored angle is reduced by whole turns to within ±180° (a tilt of 400° stores 40°). With the full
tilt, a section twist of −2° would become −362°, beyond the ±360° limit. When a twist still lies
beyond ±360° after the upgrade (file twists near ±360°, or twists edited after the import), the
upgrade keeps the project folded and reports it, as for guides.

A project with an enabled nose or end guide (edited or not), or a disabled guide with edited points,
keeps its folded sections: a disabled guide keeps its edited points (`resetDisabledGuides` in `src/model/edit.js`) and uses them again when
it is switched on. The guides hold x only, as a function of y, and `buildWing` in `src/geom/wing.js`
takes the leading edge and the chord from them; turning them back would need z along each guide. The
upgrade leaves such a project unchanged, keeps the stored angle and reports that its tilt stays
folded. Tests open version 2 projects without a guide, with an enabled guide that is not edited,
with an enabled edited guide, with a disabled edited guide, with a 400° tilt, with file twists of 362°
and 358° and a 3° tilt, with a twist pivot of 0.5 and with a pointed tip, and check that the geometry
is unchanged by the upgrade.

With a warning instead of a blocked switch (open point of section 1), a project with a stored folded
tilt can be mitred at the upgrade. Its fold is not exact (0.45 to 7.5 mm, table above), so the
upgrade changes its shape towards XFLR5's and reports the change. The test of such a project checks
the report, not an unchanged geometry.

Not decided: the statistics of a part with a rigid tilt are given in the plane axes (the upgrade
keeps the MAC position and 25 % MAC) or in the part's own axes (the upgrade moves them, about 5 mm on
a 35° V-tail with 3° tilt, estimated, and reports it). The migration tests compare these values too.

A part tilt is a new project value. An app with step 1 only would drop it without a message
(`resolveSettings` and the loader in `src/model/io.js` keep only known keys). Format rule:

- Step 2 in the same release as step 1: project format version 2 holds both the section-plane
  setting and the part tilt.
- Step 2 in a later release: it raises the project format to version 3. An app with step 1 only
  refuses a version 3 file (`validateProject`) instead of dropping the tilt.
- Older files (version 1, and version 2 without the tilt) open with a part tilt of 0°.

## 3. flow5 import

flow5 is version 7 of XFLR5, open source since 2026-01-01 under GPL-3.0. It keeps planes in files that
the XFLR5 import does not read: it writes no `<explane>` XML and no planes into `.xfl` (a save to
`.xfl` becomes `.fl5`; the `.xfl` writer stores 0 planes).

### What flow5 files hold

| File | Content | Wing | Airfoil coordinates | Versions |
| --- | --- | --- | --- | --- |
| `.fl5` project (binary, Qt `QDataStream`, big-endian, floats as 8 bytes) | header, airfoils, foil polars, foil operating points, planes, plane analyses and results, boats, in this order | yes | yes | project format 500001 to 500006 (7.01 beta to 7.26), 500750 (7.50 to 7.53), 500754 (7.54 to 7.57 and HEAD); the versions before 7.53 are inferred from release notes and loader code |
| Plane XML `<xflplane version="1.0">` | one plane: wings, bodies, point masses | yes | no: names or `.dat` file names; 7.54 and later write one `.dat` per airfoil next to the XML | element tree unchanged from 7.51 (2025-09-26) to HEAD |
| Wing XML `<xflwing version="1.0">` | one wing without position or rotation | yes, in its own frame | no | as plane XML |

A `.fl5` has no length prefixes: a reader walks the header, every airfoil and every foil polar field by
field to reach the planes, and stops after the last plane. In flow5's 24.4 MB demo project the part
after the planes (analyses and results) is 22.9 MB (94 %).

Wings: a flow5 plane of type 0 holds any number of wings, each with a type (main wing, elevator, fin,
other), a two-sided flag, a position x, y, z and rotations `rx`, `ry`. The section values mean the
same as in XFLR5. Planes of type 1 (triangle meshes) and boats hold no wings.

In the 47 planes of flow5's 13 official samples, every main wing and elevator is two-sided with `rx` =
0 and y = 0, and `ry` lies between −2° and 0°. The XFLR5 mapping builds this case exactly. On flow5's
application programming interface (API) example PlaneRun1 the stabilizer lies 0.0000 mm from flow5's surface and the main wing up to
0.78 mm, measured with a local flow5 build. The 0.78 mm is the twist-axis difference at dihedral
breaks that the XFLR5 import also has.

### Decisions (owner, 2026-09-30)

| # | Question | Decision |
| --- | --- | --- |
| F1 | Scope and order | Option C: flow5 XML and `.fl5` in one branch, after the XFLR5 import is merged. |
| F2 | Which `.fl5` files | Project format 500750 and later (flow5 7.50 on), up to the newest layout the reader knows (project format 500754, Part format 500757). A higher format number in any record is refused with a message, not read. Older files get a message: open and save the project in a current flow5, or export the plane as XML. |
| F3 | Which wings | The first main wing and the first elevator (F4 applies to them), and further two-sided, unrolled wings: a second main wing, a canard, "other" wings. One surface per import; a wing that cannot be built is listed as disabled, with its reason. |
| F4 | A rolled (`rx` ≠ 0) or one-sided main wing or elevator | Rolled: built without the roll, with a warning (the shape is exact, the roll is lost). One-sided: refused with a reason. |
| F5 | Test files (flow5 is GPL-3.0) | Files that flow5 writes from Wingdesigner's own inputs (script mode or a local driver) are committed; the drivers and build changes stay out of the repository, as for the XFLR5 test files. flow5's fixed comment lines stay in committed XML. flow5's own sample files are not committed. |
| F6 | Airfoil upload in the import dialog | A button "Upload .dat files…" takes several files and matches them to the airfoil rows by name (for flow5 XML and XFLR5 XML). |

Defaults without a question, as for the XFLR5 import:

- Leading-edge flaps, and trailing-edge flaps of files before 7.50, import undeflected, with a
  warning.
- Position y is not applied, with an info line.
- Planes of type 1 are listed as disabled entries.
- Several `<Plane>` elements in one XML file are listed.
- Airfoils from `.fl5` files get the source kind `flow5`.
- The texts of the XFLR5 import get a `{program}` placeholder, and 9 texts get flow5 versions.

### Work

- Reused from the XFLR5 import without a change of behaviour: section mapping, airfoil resolution and
  frame, report, dialog layout, Undo and the toast. The windowed reader of `src/import/xfl.js` and the
  XML tokenizer of `src/import/xflxml.js` move to shared modules (about 30 to 50 and 20 changed
  lines).
- Airfoils of the source kind `flow5` get the lost-frame note of `airfoilSources()` in
  `src/import/xflr5.js`, as the kinds `xflr5` and `upload` do: stored at unit chord, their own
  coordinates are lost. Tests cover the kind. The Airfoils tab shows the source of kind `flow5` as
  `flow5: <file>` (`src/ui/airfoils.js`), as it shows `XFLR5: <file>`, and the File Formats table of
  `source.kind` gets a `flow5` row.
- Shared part: from "4 wing slots of an XFLR5 plane" to "a list of typed wings" and from "XFLR5" to
  "XFLR5 or flow5": about 1,400 to 2,200 lines with tests and docs.
- Content sniffing: `src/main.js` routes a file without the `.xml` extension to the XML readers
  only when it starts with `<?xml`, a comment or `<explane>`. The flow5 roots `<xflplane>` and
  `<xflwing>` join that pattern, with tests, so a flow5 XML file that lost its extension does not go to
  the JSON loader.
- New: `src/import/fl5xml.js` (flow5 XML), `src/import/fl5.js` (`.fl5` from format 500750, about 25
  to 30 version branches), a test writer `test/fl5-writer.js`, browser tests `e2e/flow5.spec.js`.
- Size: 4,500 to 6,300 lines in all (code, German texts, tests, docs) for the analysed scope, plus
  the decided F3 scope: 10 to 20 lines of code and 5 to 8 tests. F6 adds 25 to 40 lines; whether
  the analysis counts them in the 4,500 to 6,300 lines is not stated.
- Review: 24 to 38 code findings over 2 to 3 rounds, 23 to 41 docs findings.
- Effort: 9 to 12.5 h wall-clock, 18 to 24 agent hours for the analysed scope. The time of the F3
  and F6 additions is not estimated.

### Risks

- Format changes: flow5 is active (150 commits from July 2025 to September 2026). From v7.53 to v7.57
  the `.fl5` layout changed once in an incompatible way and 4 times compatibly. Every record carries a
  format number, so a file of a newer flow5 is refused with a message, not read wrongly. A reader
  update of 0.5 to 2 h once or twice a year is expected.
- Projects with a "sections" fuselage differ between flow5 7.53 to 7.56 and 7.57 or later: a local
  HEAD build aborts on a 7.56 file, and a local 7.56 build crashes on a HEAD file. The reader tells
  the layouts apart by the Part format (500757 = 7.57).
- GPL-3.0: the readers are written from format notes, not from flow5 code.
- "flow5" is a registered trademark in France; the name only describes the file type.

### Open points

- No flow5 file of a real user with a license that allows bundling is known.
- No file of flow5 7.50 to 7.52 is available to read or write; their layout is inferred from the
  current loader. Tags v7.53 to v7.55 are not built, and the official 7.57 binaries are not tried.
- Whether the file choosers of Android and iOS list `.fl5` files is unknown.
- F4 builds a rolled wing without its roll. Once step 2 exists, the roll could be applied by the same
  rigid transform; this is not decided.
- Whether the XFLR5 import also offers its second wing once the wings form a typed list is not
  decided; F3 covers flow5 only.
