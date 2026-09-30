# flow5 upgrade: plan and decisions

This page records the plan and the owner's decisions for three planned changes to Wingdesigner:
mitred section planes, a rigid tilt of the whole part, and an import of flow5 planes. Status on
2026-09-30: planned; nothing is implemented. The effort figures are estimates scaled from the history
of this repository (the XFLR5 import: 9,444 added lines in 12.1 h wall-clock, research included); they
are not measured on these changes. Measured values are marked as such.

Sources:

- flow5 source (GPL-3.0), commit f34093a of 2026-09-21, and tags v7.53 (2025-11-14) to v7.57
  (2026-06-16). flow5 HEAD and v7.56 were built locally on Ubuntu 24.04 to write and read test files.
- XFLR5 6.62 source (SVN `tags/v6.62`) and the STL (stereolithography) files its code writes for the
  XFLR5 test planes in `test/fixtures/xflr5/`.
- OpenVSP documentation, version 3.48 and later.
- Prototypes of the section planes on the code of commit b0d43af, rerun by an independent check.

## Order of work

| Step | Change | Estimate | Why in this order |
| --- | --- | --- | --- |
| 1 | Mitred section planes behind a switch (option c) | 7 to 11 h | Restores the airfoil thickness on panels with dihedral; the XFLR5 import and the flow5 import both use it |
| 2 | Rigid tilt of the whole part | 2 to 4 h (not analysed) | With mitred sections, folding an imported tilt into the sections is no longer exact |
| 3 | flow5 import, XML and `.fl5` (option C) | 9 to 12.5 h | Reuses the section mapping of the XFLR5 import and profits from steps 1 and 2 |

The flow5 import starts after the XFLR5 import is merged (done: pull request #5, 2026-09-30).

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

XFLR5 6.62, flow5 and OpenVSP (3.48 and later) build sections this way:

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
| Gull 15°/−5°, NACA 0009 | 100.0 / 100.1 % | root / break / tip 0.32 / 0.28 / 0.51 → 0.00 / 0.02 / 0.03 mm |
| Test wing 3°/6°, NACA 0009 | 100.0 / 100.2 % | root / break / tip 0.01 / 0.07 / 0.79 → 0.00 / 0.03 / 0.05 mm |
| Steep gull 0°/20°/45°/70° | 100.0 % on every panel | not compared |

On the 35° V-tail the distance to XFLR5's own STL drops from 1.89 to 0.01 mm. On the Clark Y test wing
the section vertices move from 0.71 to 0.60 mm off XFLR5's STL; the largest distance over the part
stays at about 0.94 mm, set by two differences unrelated to the section planes (XFLR5 interpolates its
airfoils linearly, 0.53 mm; a panel that changes airfoil and chord together differs by 0.93 mm at
mid-panel).

### Decisions (owner, 2026-09-30)

| # | Question | Decision |
| --- | --- | --- |
| R1 | Which option | (c): one setting "Section planes: vertical \| mitred". Automatic mitre planes from the dihedral; no per-section input. A manual roll column (option e, about 2 to 3 h more) only if someone needs a typed roll. |
| R2 | Default for new projects and the wizard | Mitred. Version 1 project files open with vertical sections. The wizard presets move by at most 1.02 mm; 6 export browser tests change. |
| R3 | Twist and stretch in a rolled plane | XFLR5's convention: twist about the normal of the section plane, only the thickness stretched. The streamwise incidence is atan(tan τ · cos φ): 1.64° for 2° twist at 35°, 99.9 % of the twist at 3°. |
| R4 | Surface between two sections in linear mode | The in-between airfoil placed in each in-between plane, as today's rule and as smooth mode and guide curves do. It differs from XFLR5's ruled surface by 0.05 mm at 35° and by up to 0.43 mm at 60° with taper and sweep; the XFLR5 difference list names it. |
| R5 | Imports of tilted parts before step 2 exists | Tilted parts import with vertical sections (exact tilt, as today); untilted parts import mitred. |
| R6 | Span parameter and limits | y stays the span parameter (dihedral below 90°, no winglets). The stretch is limited to 2.0, which allows 60° between a section plane and its panel (the real XFLR5 samples reach 40°). A fold of two section planes is reported with the numbers of both sections. |

Options not taken: (a) mitred always on (changes every saved project with dihedral: presets up to
1.02 mm, a V-tail +22 % volume); (b) a roll column only (the user types the angles; wrong angles give
wrong thickness); (d) vertical sections with the airfoil stretched by 1/cos δ (3 to 4 h, right inside
a straight panel but not at breaks: 99.3 / 101.1 % on a 15°/−5° gull, 64 to 130 % on the steep gull;
the tip face stays vertical, 2.21 mm off XFLR5 at a 35° tip).

### Work

- Project format version 2. An older app refuses a version 2 file (`validateProject`) instead of
  dropping the new setting without a message (`resolveSettings` in `src/model/project.js` keeps only
  known keys).
- Section placement in a rolled plane: about 150 lines in the prototype (`src/geom/wing.js`,
  `src/geom/mesh.js`, `src/export/step.js`).
- Checks and exports that give a wrong result without an error once section planes roll (measured in
  the prototypes):

| Place | With rolled planes |
| --- | --- |
| Root and tip control rows (set to the section y) | A 35° mitred tip edge moves by 2.392 mm; needs a projection onto the rolled plane |
| Row crossing test (works in x, z) | Must work in the section frame |
| Deviation probe (adds spanwise stations) | Needs the 3D chord direction; adds stations that are not needed (4 instead of 2 on a 60° panel) |
| STEP end caps (plane normals 0, ±1, 0) | Tip edges lie 0.6 to 2.6 mm off their plane against a declared uncertainty of 1e-7 mm; OpenCascade's BRepCheck still reports the file as valid |
| Check y ≥ 0 (reference point only) | A root rolled 35° reaches y = ±3.10 mm without a message |
| Merge of the two halves at y = 0 | A root rolled 17.5° overlaps the other half by up to 2.3 mm, and the mesh check still reports it closed; the root stays vertical |
| Section order (y strictly increasing) | Mitred planes of a short panel cross (a 10 mm panel between 40° and 80°); needs a fold check |
| Stretch | 1/cos grows without bound; limit 2.0 (R6) |

- CI (continuous integration): `scripts/validate_step.py` checks BRepCheck, closed shells and the
  volume within 0.5 %. It catches the 35° V-tail (−2.4 % volume) but not the 15°/−5° gull (+0.22 %);
  a check of the cap planes is needed.
- XFLR5 import: the dihedral warning above 10° goes; the airfoil frame moves along the rolled normal;
  R5 decides the tilted parts.
- Size: 410 to 700 lines of code, 580 to 1,000 lines of tests, 300 to 500 lines of docs in English and
  German, 2 to 4 screenshots per language.
- Review: 24 to 56 findings over 3 code rounds and 2 docs rounds; a geometric critic fuzzes rolls,
  breaks, twist, pointed tips and guides against a port of XFLR5's construction (6.1e-5 mm from
  XFLR5's STL).
- Effort: 7 to 11 h wall-clock, 18 to 28 agent hours.

### Open points

- Smooth spanwise interpolation with mitred sections is not built; its thickness and the fold at the
  root are not measured.
- The fold check is measured on one synthetic case (0°, 40°, 80°). How often it fires on real wings
  is unknown, and so is its interaction with the XFLR5 import's 0.5 mm move of sections at equal y.
- A rolled STEP file was not opened in a CAD program.
- Float32 precision of STL and 3MF (3D Manufacturing Format) with rolled caps is not tested.
- The real 35° and 40° V-tail samples were not built with the prototype.

## 2. Rigid tilt of the whole part

An imported wing or stabilizer sits as in the XFLR5 plane: today the tilt is folded into the section
values (x, z, twist), which is exact because vertical sections stay vertical under a rotation about
the y axis. With mitred sections the fold is no longer exact:

| Case | Error of the folded tilt |
| --- | --- |
| XFLR5 test wing, 2° tilt | 0.45 mm at the trailing edge (measured) |
| V-tail 35°, 3° tilt | 1.65 mm (measured) |
| Real sample: 35° V-tail, −10° tilt | about 7.5 mm at a 100 mm tip (estimated: 0.75 · chord · sin(tilt) · sin(roll)) |

A rigid rotation of the whole part after the build brings the trailing edges to within 0.003 mm
(measured). Size, user interface and exports are not analysed; 2 to 4 h is a guess. A roll of the
whole part (flow5's `rx`) is the same kind of transform; see F4.

## 3. flow5 import

flow5 is version 7 of XFLR5, open source since 2026-01-01 under GPL-3.0. It keeps planes in files that
the XFLR5 import does not read: it writes no `<explane>` XML and no planes into `.xfl` (a save to
`.xfl` becomes `.fl5`; the `.xfl` writer stores 0 planes).

### What flow5 files hold

| File | Content | Wing | Airfoil coordinates | Versions |
| --- | --- | --- | --- | --- |
| `.fl5` project (binary, Qt `QDataStream`, big-endian, floats as 8 bytes) | header, airfoils, foil polars, foil operating points, planes, plane analyses and results, boats, in this order | yes | yes | project format 500001 to 500006 (7.01 beta to 7.26), 500750 (7.50 to 7.53), 500754 (7.54 to 7.57 and HEAD) |
| Plane XML `<xflplane version="1.0">` | one plane: wings, bodies, point masses | yes | no: names or `.dat` file names; 7.54 and later write one `.dat` per airfoil next to the XML | element tree unchanged from 7.51 (2025-09-26) to HEAD |
| Wing XML `<xflwing version="1.0">` | one wing without position or rotation | yes, in its own frame | no | as plane XML |

A `.fl5` has no length prefixes: a reader walks the header, every airfoil and every foil polar field by
field to reach the planes, and stops after the last plane. In flow5's 24.4 MB demo project the part
after the planes (analyses and results) is 22.9 MB (94 %).

Wings: a flow5 plane of type 0 holds any number of wings, each with a type (main wing, elevator, fin,
other), a two-sided flag, a position x, y, z and rotations `rx`, `ry`. The section values mean the
same as in XFLR5. Planes of type 1 (triangle meshes) and boats hold no wings. In the 47 planes of
flow5's 13 official samples, every main wing and elevator is two-sided with `rx` = 0 and y = 0, and
`ry` lies between −2° and 0°: the case the XFLR5 mapping builds exactly (stabilizer 0.0000 mm from
flow5, main wing up to 0.78 mm, measured).

### Decisions (owner, 2026-09-30)

| # | Question | Decision |
| --- | --- | --- |
| F1 | Scope and order | Option C: flow5 XML and `.fl5` in one branch, after the XFLR5 import is merged. |
| F2 | Which `.fl5` files | Project format 500750 and later (flow5 7.50 on). Older files get a message: open and save the project in a current flow5, or export the plane as XML. |
| F3 | Which wings | Every two-sided, unrolled wing: the first main wing, the first elevator, and further wings (a second main wing, a canard, "other" wings). One surface per import; a wing that cannot be built shows its reason. |
| F4 | A rolled (`rx` ≠ 0) or one-sided main wing or elevator | Rolled: built without the roll, with a warning (the shape is exact, the roll is lost). One-sided: refused with a reason. |
| F5 | Test files (flow5 is GPL-3.0) | Files that flow5 writes from own inputs (script mode or a local driver) are committed; the drivers and build changes stay out of the repository, as for the XFLR5 test files. flow5's fixed comment lines stay in committed XML. flow5's own sample files are not committed. |
| F6 | Airfoil upload in the import dialog | A button "Upload .dat files…" takes several files and matches them to the airfoil rows by name (for flow5 XML and XFLR5 XML). |

Defaults without a question, as for the XFLR5 import: leading-edge flaps and older trailing-edge flaps
imported undeflected, with a warning; position y not applied, with an info line; planes of type 1
listed as disabled entries; several `<Plane>` elements in one XML file listed; airfoils from `.fl5`
files get the source kind `flow5`; the texts of the XFLR5 import get a `{program}` placeholder.

### Work

- Reused unchanged from the XFLR5 import: section mapping, airfoil resolution and frame, report,
  dialog layout, windowed reader of `src/import/xfl.js`, XML tokenizer of `src/import/xflxml.js`,
  Undo and the toast.
- Shared part: from "4 wing slots of an XFLR5 plane" to "a list of typed wings" and from "XFLR5" to
  "XFLR5 or flow5": about 1,400 to 2,200 lines with tests and docs.
- New: `src/import/fl5xml.js` (flow5 XML), `src/import/fl5.js` (`.fl5` from format 500750, about 25
  to 30 version branches), a test writer `test/fl5-writer.js`, browser tests `e2e/flow5.spec.js`.
- F3 adds 10 to 20 lines and 5 to 8 tests; F6 adds 25 to 40 lines.
- Size: 4,500 to 6,300 lines in all (code, German texts, tests, docs).
- Review: 24 to 38 code findings over 2 to 3 rounds, 23 to 41 docs findings.
- Effort: 9 to 12.5 h wall-clock, 18 to 24 agent hours.

### Risks

- Format changes: flow5 is active (150 commits from July 2025 to September 2026). From v7.53 to v7.57
  the `.fl5` layout changed once in an incompatible way and 4 times compatibly. Every record carries a
  format number, so a file of a newer flow5 is refused with a message, not read wrongly. A reader
  update of 0.5 to 2 h once or twice a year is expected.
- flow5 7.56 and 7.57 cannot read each other's projects that hold a "sections" fuselage (HEAD aborts on
  a 7.56 file; 7.56 crashes on a HEAD file). The reader tells the layouts apart by the Part format
  (500757 = 7.57).
- GPL-3.0: the readers are written from format notes, not from flow5 code.
- "flow5" is a registered trademark in France; the name only describes the file type.

### Open points

- No flow5 file of a real user with a license that allows bundling is known.
- Files of flow5 7.50 to 7.52 were neither read nor written; their layout is inferred from the current
  loader. Tags v7.53 to v7.55 were not built; the official 7.57 binaries were not tried.
- Whether the file choosers of Android and iOS list `.fl5` files is unknown.
- F4 builds a rolled wing without its roll. Once step 2 exists, the roll could be applied by the same
  rigid transform; this is not decided.
