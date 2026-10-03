Deutsch: [README.de.md](README.de.md)

# Wingdesigner

Browser application for designing wings of radio-controlled (RC) model aircraft.

- Lofts one half wing as a NURBS (non-uniform rational B-spline) surface through 2 to 20,000 airfoil sections.
- Models the half wing at y ≥ 0; the other half is its mirror image at the plane y = 0.
- Exports models as STEP (Standard for the Exchange of Product model data), STL (stereolithography) and 3MF (3D Manufacturing Format).
- Saves the project as JSON (JavaScript Object Notation).
- Splits the half wing into foam cores for a hot-wire cutter and writes their end profiles (`.dat`) and 1:1 templates as SVG (Scalable Vector Graphics), PDF (Portable Document Format) and DXF (Drawing Exchange Format).
- Imports the main wing or the horizontal stabilizer from XFLR5 files (`.xfl`, `.xml`), and one wing from flow5 files (`.fl5`, `.xml`). XFLR5 is a program for the analysis of airfoils and wings; flow5 is its successor.
- Projects, airfoil files, XFLR5 and flow5 files are not sent to a server.

| Resource | Address | Published by |
| --- | --- | --- |
| App | <https://subtilitas.github.io/Wingdesigner/> | `ci.yml`, push to `main`, after all other continuous integration (CI) jobs pass; HTTP 200 on 2026-09-29 |
| Wiki start page (English and German) | <https://github.com/subtilitas/Wingdesigner/wiki> | `docs.yml`, push to `main` that changes `docs/wiki/` or `docs.yml`, or manual run; reachability: not verified |

| Topic | English | German |
| --- | --- | --- |
| Workflow, controls, XFLR5 import dialog, export options | [User Guide](https://github.com/subtilitas/Wingdesigner/wiki/User-Guide) | [Benutzerhandbuch](https://github.com/subtilitas/Wingdesigner/wiki/Benutzerhandbuch) |
| Airfoil curves, sections, guide curves, surface | [Geometry](https://github.com/subtilitas/Wingdesigner/wiki/Geometry) | [Geometrie](https://github.com/subtilitas/Wingdesigner/wiki/Geometrie) |
| Airfoil files, checks, project JSON, XFLR5 import, STEP, STL, 3MF, foam-cutting files | [File Formats](https://github.com/subtilitas/Wingdesigner/wiki/File-Formats) | [Dateiformate](https://github.com/subtilitas/Wingdesigner/wiki/Dateiformate) |
| Airfoil sources and licenses | [Airfoil Sources](https://github.com/subtilitas/Wingdesigner/wiki/Airfoil-Sources) | [Profilquellen](https://github.com/subtilitas/Wingdesigner/wiki/Profilquellen) |
| Architecture, build, tests, CI | [Development](https://github.com/subtilitas/Wingdesigner/wiki/Development) | [Entwicklung](https://github.com/subtilitas/Wingdesigner/wiki/Entwicklung) |

![Desktop window after creating the Glider preset: top bar, 3D view, Sections tab with 3 sections, status bar with span 2000 mm](docs/wiki/images/main-desktop.png)

## Functions

| Function | Behaviour | Limits and defaults |
| --- | --- | --- |
| Sections | Each section places an airfoil with its leading edge at (x, y, z), scales it to the chord and rotates it by the twist, in its section plane. | 2 to 20,000 sections, warning above 200 (see Project size); y 0 to 1,000,000 mm, all y distinct; x and z −1,000,000 to 1,000,000 mm; chord 1 to 100,000 mm; twist −360 to 360°. The **Sections** table clamps typed values to these limits; planform drags stay within them. |
| Airfoil curve | Cubic B-spline through every point of the airfoil file. | Parametrization: centripetal (default), chord length, uniform. With chord length or uniform, airfoil errors in **Checks** add a hint to use centripetal. |
| Chordwise resampling | All sections are resampled at the same chord fractions, cosine-spaced towards leading and trailing edge. | 16 to 200 stations per surface, default 60 |
| Section planes | **Mitred** (default): the root section is vertical, a section between two panels lies in the bisector plane of the two panels, the tip section is square to the last panel, and each airfoil is stretched in thickness by 1/cos of the angle between its plane and the panel, as in XFLR5. The wing is as thick across every panel as its airfoil. With **Smooth** the rolls blend along the cubic, and the stretch follows the slope of the blended reference line. **Vertical**: every section in a plane y = const; across a panel with dihedral δ the wing is cos δ as thick (81.9 % at 35°). | Stretch at most 2 (60° between a section plane and its panel, with Smooth also between the sections) and no fold between neighbouring planes: build errors. Project files of format version 1 open vertical. |
| Spanwise blending | **Linear**: each section value (airfoil, chord, twist, position) blends linearly along the panel (panel: span interval between 2 adjacent sections), kinks at the sections. **Straight panels**: straight lines between points of equal chord fraction of 2 adjacent sections, as XFLR5 builds its panels; no guide curves. **Smooth**: shape-preserving cubic through the section values: per panel a cubic through the values of its two sections, with the slopes of a natural cubic spline through all sections limited so that no value (chord, position, twist, airfoil thickness) leaves the range of the two sections; continuous slope at the sections. | Default linear; the XFLR5 import sets straight panels; smooth needs 3 or more sections (with 2 sections the blend is linear) |
| Spanwise stations | With a guide curve or smooth blending: N stations per panel (section included), cosine-spaced towards the panel ends. With linear blending and mitred section planes: N stations in every panel whose two sections lie in planes of different roll. Otherwise: stations only at the sections. Extra stations are inserted where the loft surface deviates from the intended profile by more than 0.5 mm or 10 % of the local chord, whichever is smaller (3D distance). Compared points: leading edge, upper trailing-edge point and 5 chord stations per surface (at the default 60 chordwise stations). Extra stations lie at check positions: 257 evenly spaced span positions, the stations and every guide-curve control point and knot. Each extra station keeps at least 1e-6 of the span from every other station. | N = 3 to 40, default 8; up to 32 extra stations. Loft grid: (N × D + (sections − 1 − D) + 1) × (2 × stations per surface + 1) points before the extra stations; D = sections − 1 with a guide curve or smooth blending, otherwise the linear panels between mitred planes of different roll. **Settings** shows `Loft grid: … points` under **Resolution**; above 60,000 points the note adds the time and memory of each change, and the `Large project` warning lists the grid. Above 5,000,000 grid points N is lowered to the largest value that keeps the grid within 5,000,000, with a warning. When 1 station per panel still exceeds 5,000,000 grid points, the build stops with an error; remedies named in the message: fewer stations per surface, fewer sections. Linear blending without a guide curve and without rolled panels (60 stations per surface, 1 station per section): warning from 496 sections on; N is never lowered (20,000 sections: 2,420,000 grid points). With a guide curve or smooth blending at the default N = 8: warning from 63 sections on; N lowered from 5167 sections on; 20,000 sections: N = 2. |
| Wing surface | Tensor-product B-spline surface through all stations. | Degree 3 chordwise; spanwise degree 1 (no panel with intermediate stations) or 3; linear blending with intermediate stations: degree 2 or 1 when the grid limit lowers N to 2 or 1 |
| Guide curves | Nose line (leading edge) and end line (trailing edge) in the planform. Each is a NURBS curve through points (curve parameter proportional to y) or from control points, stretched to the root-to-tip span. | Off by default; degree 1 to 5, default 3; 2 to 20,000 points (**Add point** is disabled at 20,000); warning above 500 points in an enabled guide curve, and from 500 points on the title of **Add point** names the time and memory of each change with one more point; y strictly increasing; x within ±1,100,000 mm (covers the trailing edge x + chord of every valid section), y within ±1,000,000 mm; drags and typed x values are clamped to ±1,100,000 mm. Error when a control point of the curve lies beyond x = ±1,200,000 mm; through-point curves over points unevenly spaced in y reach this. Remedies named in the message: points spaced more evenly in y, control-point mode. |
| Trailing edge | As in the airfoil files, closed, or a fixed thickness in mm. | Default mode: as in the airfoil files; default thickness value 0.4 mm. Wizard: fixed thickness max(0.3 mm, 0.2 % of root chord). Sample wing: fixed 0.5 mm. Limited to 5 % of the local chord, with a warning (no warning in the last panel of a **Pointed** tip). |
| Wing tip | **Flat**: the wing ends at the tip section. **Pointed**: tip profile scaled to 1/N of the chord at the second-to-last section, at least 1 mm. In the last panel the chord stays ≥ this tip chord. Converging guide curves end in the scaled profile. | Default flat; N = 100 to 1000, default 200. The **Sections** table shows the tip chord; `(min.)` marks the 1 mm floor. |
| Mirror | Display toggle **Show mirrored half (y < 0)** in **Settings**. Exports use the export option **Wing halves**. Statistics always cover both halves. | Display toggle default: on |
| Part placement | **Part tilt (°, positive = leading edge up)** and **Part roll (°, positive = right tip up)** in **Settings** turn the half wing as a rigid body: first the roll about the x axis, then the tilt about the y axis, both through one pivot. Pivot: the wing origin that the XFLR5 import stores, else the leading edge of the root section; **Settings** names it below the two fields. **Left half**: the mirror image of the turned right half at y = 0 (default), or turned with the right half, the whole wing as one body, as flow5 turns a wing. The 3D view, STEP, STL, 3MF and the statistics use the turned part; the **Sections** table, the **Planform** tab and the foam-cutting wizard use the frame of the part. | Tilt and roll −180 to 180°, step 0.5°, default 0°; typed values are clamped. A change is one undo step. Error when a turned control point of the surface lies beyond ±1,200,000 mm. Project file format version 3; Wingdesigner 0.3.0 and earlier refuse such a file (`Unsupported project version 3.`). A project with the left half turned is saved as format version 4; Wingdesigner 0.4.0 and earlier refuse it (`Unsupported project version 4.`). |
| Airfoil import | Selig, Lednicer, 3-column table (x, upper y, lower y), XML (Extensible Markup Language), HTML (HyperText Markup Language) pages (coordinates in `<pre>` blocks or tables). Reads decimal commas, percent coordinates, UTF-8 (Unicode Transformation Format, 8-bit) and Windows-1252. Input: dropped files, **Choose files** or pasted text. Shows outline, NURBS curve and check messages before the airfoil is added. Consecutive points closer than 1e-9 chord to the previous point are removed. An airfoil with an error, including a failed NURBS interpolation, cannot be added (**Cannot add (errors)**). The preview (upload and **View**) draws the NURBS curve with the project's profile parametrization. An XFLR5 project or an XFLR5 plane or wing file is refused as an airfoil with the hint to use **Open**; **Check pasted text** does not test for it. | **Choose files** filter: `.dat`, `.txt`, `.cor`, `.xml`, `.htm`, `.html`, `.csv` and plain-text files; dropped files: any extension; 5 to 100,000 points, warning below 20 and above 5000 (`… points (warning above 5,000): the checks and the first build of a wing that uses the airfoil take … s.`); at most 5,000,000 characters; files above 20 MB are rejected before reading, an XFLR5 project with the hint to use **Open**; a name line above 10,000 characters is cut to its first 10,000. Per project: at most 10,000 airfoils and 1,000,000 airfoil points in all; warning above 200 airfoils and above 100,000 airfoil points. Project files: the same point and airfoil limits. At 10,000 airfoils the **Airfoils** tab opens no preview and shows `The project holds 10,000 airfoils, the limit; "Remove unused" frees places.`; an airfoil that takes the project above 1,000,000 points is refused in the same way. |
| NACA generator | NACA (National Advisory Committee for Aeronautics) 4-digit and 5-digit airfoils from the equations of NACA Report 824. Also reflexed 5-digit airfoils (third digit 1). Open or closed trailing edge. | 17 presets; 81 points per surface |
| Wizard | Inputs: 7 numbers (see [Wizard inputs](#wizard-inputs)), planform (straight, elliptic or panels), tip (flat, pointed or elliptic), root and tip NACA code. Output: straight and elliptic planforms: evenly spaced sections; the elliptic planform adds nose and end guide curves. Panels: a table of 1 to 24 panels from root to tip, each with span share, leading-edge sweep, outer chord and dihedral; a section at every panel end. Last section: tip airfoil; all others: root airfoil. | 10 presets: **Trainer**, **Sport** (preselected), **Glider**, **Sailplane**, **Delta jet**, **Double delta**, **Batwing**, **Swept flying wing**, **Plank**, **Tail surface**; the 4 presets **Sailplane** to **Batwing** use panels. Elliptic with flat tip: taper < 1. Pointed tip: tip chord 1/200 of the second-to-last section chord, at least 1 mm. Elliptic tip: panels only; the last panel ends in a quarter ellipse of 6 sections, pointed at the tip. |
| Checks | Lists errors and warnings, then info lines. Planform: span, wing area (dm²), aspect ratio, mean aerodynamic chord (MAC), MAC position (y, leading-edge x), 25 % MAC x, root and tip chord. Surface: degrees, control-point counts, trailing edge open or closed. Span = 2 × y of the tip section; for a tilted or rolled part 2 × y of the turned tip leading edge, and MAC position and 25 % MAC x turned with the part (area, MAC and chords in the frame of the part). Area and MAC: 5-point Gauss-Legendre quadrature of the intended planform between root, tip, the sections and every guide-curve knot and control point; an interval is halved while the halves change an integral by more than 1e-10 of its scale, at most 12 times. | Export of STEP, STL and 3MF is blocked while errors exist. Section and guide values beyond the project limits are errors; autosave does not store such a project, and **Open** rejects it. Root section off y = 0: the gap between the halves counts to the span, not to the area. |
| Project size | Above a warning threshold the wing builds as usual. **Checks** adds one warning: `Large project: …`, listing each size above its threshold with `(warning above …)`, followed by the estimated time and browser memory of each change (`Each change takes … and … of browser memory.`). When the first build (**Open**, restored autosave, a change of **Profile parametrization**) takes at least 1 s longer than a change, the warning adds `Opening it or changing the profile parametrization takes ….`; estimate: time of a change plus 4.4 ms per airfoil that a section uses plus 30 µs per point of these airfoils (Node.js 24; 20,000 linear sections at 16 stations per surface and 10,000 airfoils of 99 points: `about 83 s`). A message shows the same text when an edit, **Open** or the restored autosave takes a size above its threshold. Estimates: linear fits to measurements in Chromium 141 (see Current limitations). | Warning above: 200 sections, 200 airfoils, 5000 points in one airfoil, 100,000 airfoil points in all, 500 points in an enabled guide curve, 60,000 loft grid points, 2,000,000 export triangles or 1,000,000 STEP control points (export dialog), 200 characters in a name. Hard limits, where a desktop browser tab runs out of memory or a change takes about a minute: 20,000 sections, 10,000 airfoils, 100,000 points in one airfoil, 1,000,000 airfoil points in all, 20,000 points per guide curve, 5,000,000 loft grid points, 10,000,000 export triangles, 3,000,000 STEP control points, 10,000 characters in a name, 200 characters in an id, 2000 characters in an airfoil source text, 100 MB per project file. Lists and messages show the first 200 characters of a name followed by `…`. |
| Input | Mouse, touchscreen, keyboard. 3D view: drag rotates, wheel or pinch zooms, right button or 2 fingers pan. 2D views (planform, previews): drag a point to move it, drag the background to pan, wheel or pinch zooms, 2 fingers pan, double-click fits. | Undo: Ctrl+Z or Cmd+Z; redo: Ctrl+Shift+Z, Cmd+Shift+Z, Ctrl+Y or Cmd+Y. Shortcuts are ignored while an input field has focus or a dialog is open. Undo history: at most 100 steps and at most 64,000,000 characters of serialized project (undo and redo together); a project above 640,000 characters keeps fewer steps, at least 1. One drag forms 1 undo step, however long it pauses; an action that changes nothing adds no undo step. |
| Storage | Autosave to browser local storage after every change that passes project validation, with the rebuild in the next animation frame; a pending save is written at once when the page is hidden or left (reload, closing the tab). A stored project that fails to load is kept under `wingdesigner.project.v1.rejected`, and the wizard opens. Nothing is saved while the first-run wizard is open. **Save** downloads the project JSON. **Open** opens a project file or an XFLR5 file (row XFLR5 import). When browser storage refuses the project, a message says so and the status bar shows `Autosave off: use Save` until an autosave succeeds. | Local storage unavailable: the project stays in memory only. Browser storage: about 5,000,000 characters per site. **Open**: files above 100 MB are rejected before reading; an `.xfl` file is read up to 2,000 MB. |
| XFLR5 import | **Open** reads an XFLR5 project (`.xfl`) or an XFLR5 plane or wing file (`.xml`) and imports one surface from it: the main wing, the second wing (biplane), the horizontal stabilizer (XFLR5 calls it the elevator) or the fin. A dialog offers the plane, the surface and one airfoil for every airfoil name, and shows a report of what is applied, changed and dropped. **Import** replaces the project in one undo step; **Cancel** changes nothing. Section values: y and z from the span positions (XFLR5 measures them along the panels) and the panel dihedral angles; x from the leading-edge offset; the chord; the twist about the quarter chord. The position of the wing in the plane moves the sections; the tilt angle turns the built part as a rigid body about the wing origin (**Part tilt** in **Settings**, row Part placement). The fin imports upright, as XFLR5 builds it: rolled 90° or −90° about its origin (**Part roll**). A single fin is the left half of the part, a symmetric fin turns both halves as one body, a double fin is two fins at ±(position y). A section whose airfoil has a frame (position of the leading edge and chord length in the airfoil coordinates) is moved and scaled by it, so that the airfoil lies where XFLR5 draws it. Airfoils of the `.xfl` project, uploaded `.dat` files, NACA airfoils and NACA sections of the current project (from the NACA generator or the NACA presets of the **Airfoils** tab, the wizard and the sample wing) have a frame; library airfoils and the other airfoils of the current project have none. Settings of the imported project: **Twist pivot (fraction of chord)** 0.25, **Straight panels**, **Mitred** section planes, **Flat** tip, trailing edge **As in the airfoil files**. A part whose mitred planes would fold the surface or stretch an airfoil more than 2 times imports with **Vertical** section planes. An `.xfl` project holds the airfoil coordinates. An XML file holds airfoil names only: the dialog matches each name against uploaded `.dat` files, the current project, **Library**, the NACA generator and similar names, and **Import** stays disabled while a name has no airfoil. | Files: `.xfl` projects of format 200001 (XFLR5 6.10.01 to 6.43) and 200002 (6.44 to 6.62); XML plane files (`<explane version="1.0">` with `<Plane>`; XFLR5 6.11 to 6.62) and XML wing files (XFLR5 6.41 to 6.62). Refused with a message: `.wpa` projects (XFLR5 6.09 and older), `.xfl` projects without a plane, XML wings that are fins. Not available: a single or double fin with a tilt angle (XFLR5 turns it about z). One surface per import. Not imported: the body, masses, analyses and results, colours, left-side airfoils (except for a single fin), flap deflections. The **Open** file chooser lists `.json`, `.xfl`, `.fl5` and `.xml`. Size: `.xfl` up to 2,000 MB (read in windows of 4,194,304 bytes), other files up to 100 MB. Per file: at most 10,000 planes, 20,000 sections per wing, 10,000 airfoils and 2,000,000 airfoil points read from an `.xfl`. Lengths in XML files: the unit of the file (mm, cm, dm, m, in, ft), converted to mm; XFLR5 rounds lengths in metre XML files to 1 mm. Angles: degrees. The dialog lists 200 airfoil rows and 200 report lines. Section values must meet the project limits (x and z within ±1,000,000 mm, y 0 to 1,000,000 mm, chord 1 to 100,000 mm, twist within ±360°); a chord below 1 mm is raised to 1 mm with a warning; sections at one `y_position` that differ are moved apart by up to 0.5 mm with a warning; of identical ones only the outer one is kept. Details: [File Formats](https://github.com/subtilitas/Wingdesigner/wiki/File-Formats), section XFLR5 import. |
| flow5 import | **Open** reads a flow5 project (`.fl5`) or a flow5 plane or wing file (`.xml`) and imports one wing in the dialog of the XFLR5 import, with the same section mapping, airfoil sources and report. The dialog lists every wing of the plane; each imports with its roll (`Rx_angle`, **Part roll**) and tilt (`Ry_angle`, **Part tilt**) about the wing origin. A fin (one-sided wing) imports as the half flow5 builds: the left half of the part, its mirror image on top of it. Airfoils: the coordinates of a `.fl5` project (`source.kind` `flow5`); an XML file names them or names `.dat` files next to it, which **Upload .dat files…** takes several at a time and matches by name. The readers are written from a description of the formats, not from flow5's code (flow5 is GPL-3.0). | Files: `.fl5` projects of format 500750 (flow5 7.50 to 7.53) and 500754 (7.54 to 7.57); XML plane files (`<xflplane version="1.0">`) and wing files (`<xflwing version="1.0">`). Refused with a message: `.fl5` projects of other formats, flow5 XML files of bodies, boats, sails and analyses; a one-sided wing turned about z (`Ry_angle` ≠ 0) is not available. Tested with files of flow5 7.57 and 7.56; the right half of 8 imported wings and both fins lie within 0.15 mm of the analysis mesh that flow5 builds. Position y is not used. Details: [File Formats](https://github.com/subtilitas/Wingdesigner/wiki/File-Formats), section flow5 import. |
| Foam cutting | **Foam** in the top bar opens a wizard that splits the half wing into foam cores for a hot-wire cutter. Cuts: proposed at every section and at equal spacing no longer than **Longest core** (along the dihedral), then editable. Each core has parallel end faces square to its axis; where a core meets its neighbour, the root or the tip, a wedge is sanded to the joint plane (angle, depth, side listed). The deviation of the straight-line core from the wing is shown per segment; **Split segments over the limit** halves segments above **Deviation limit**. Downloads: a ZIP of `.dat` end profile pairs (mm in the block frame and normalized to chord 1, equal point counts, point i of both ends on one straight line of the core), `segments.csv` and `README.txt`; 1:1 templates as SVG, as PDF on A4, A3 or Letter, and as DXF (AutoCAD R12) with frames and 21 numbered marks. The files describe the right half. The project does not change. | **Longest core** 20 to 5000 mm, default 800 mm; **Deviation limit** 0.01 to 10 mm, default 0.2 mm; **Kerf for templates** 0 to 5 mm, default 0 mm (templates only); the proposal limits the reference line, and a core length adds the wedge depths at its ends (**Sport**, one core: reference line 600.2 mm, core 600.5 mm); cuts at least 5 mm apart; at most 200 segments per half. Settings stored in the browser (`wingdesigner.foam`), cuts not stored. Details: [User Guide](https://github.com/subtilitas/Wingdesigner/wiki/User-Guide), section Foam cutting; [Geometry](https://github.com/subtilitas/Wingdesigner/wiki/Geometry), section 8. |
| Winglet | **Winglet…** in the **Sections** tab appends an integral winglet beyond the tip section as ordinary sections, in one undo step: a circular blend arc tangent to the last panel turns the leading-edge line to the cant angle in steps of at most 15°, then a straight part runs to the winglet tip. Chord, twist and leading-edge x change linearly along the line. A front-view preview builds the wing with the winglet first. | Height 5 to 100,000 mm; cant −89 to 89° (positive = up); blend radius 0 to 100,000 mm (0 = kink), default 0.3 tip chords; leading-edge sweep −60 to 80°, default 30°; tip chord 5 to 200 % of the wing tip chord, default 60 %; toe −15 to 15°. Requires a flat tip, **Mitred** section planes and no guide curves. Details: [User Guide](https://github.com/subtilitas/Wingdesigner/wiki/User-Guide), section Winglet; [Geometry](https://github.com/subtilitas/Wingdesigner/wiki/Geometry), section 9. |
| Language | English and German, chosen with **Language / Sprache** in the first group of **Settings**. The texts switch without a reload: top bar, tabs, tooltips, **Checks** with the build errors and warnings, airfoil check messages, size warnings. Later notices and dialogs opened later use the new language. A notice that is showing at the switch is removed; an error notice stays in its language until it fades. Numbers follow the language (German `1.234,5`). Number fields read a decimal comma or a decimal point in both languages (`0,7` and `0.7` are 0.7) and digit groups of the language (1500 comes from `1,500` in English, from `1.500` in German). Not translated: file contents, airfoil names, attributions, license identifiers. | Starts with the stored choice; without one in German when the first language of the browser is German, otherwise in English. Stored in the browser under `wingdesigner.language`. Project, selection and undo history stay. File names of downloads write umlauts out in both languages (`ü` becomes `ue`). Details: [User Guide](https://github.com/subtilitas/Wingdesigner/wiki/User-Guide), section Language. |

### Wizard inputs

| Wizard input | Range | Unit |
| --- | --- | --- |
| **Span (both halves)** | 100 to 20,000 | mm |
| **Root chord** | 10 to 3000 | mm |
| **Taper (tip / root chord)** | 0.1 to 1.5 | — |
| **Sweep of the 25 % line** | −45 to 60 | ° |
| **Dihedral per half** | −60 to 60 | ° |
| **Tip twist (negative = washout)** | −15 to 15 | ° |
| **Number of sections** | 2 to 8 | — |

With the planform **Panels (table)**, a table replaces **Taper**, **Sweep of the 25 % line**, **Dihedral per half** and **Number of sections**:

| Panel table column | Range | Unit |
| --- | --- | --- |
| **Span share (%)** | 0.1 to 10,000; the shares are scaled to the half span | % |
| **Leading-edge sweep (deg)** | −89.9 to 89.9 | ° |
| **Outer chord (% of root)** | 0 to 300 | % |
| **Dihedral (deg)** | −60 to 60 | ° |

## Coordinates and units

| Quantity | Definition | Unit |
| --- | --- | --- |
| x | Chordwise, positive towards the trailing edge | mm |
| y | Spanwise, positive towards the right tip; the half wing lies at y ≥ 0 | mm |
| z | Up | mm |
| Section origin | Leading edge = point of minimum x on the interpolated airfoil curve | mm |
| Chord | x distance from the leading edge to the trailing-edge midpoint of the interpolated airfoil | mm |
| Twist | Rotation about the twist pivot; positive = leading edge up | ° |
| Twist pivot | Fraction of the chord from the leading edge, 0 to 1, default 0.25 | — (fraction of chord) |

## Exports

File name, derived from the project name:

1. German umlauts written out: ä → ae, ö → oe, ü → ue, Ä → Ae, Ö → Oe, Ü → Ue, ß → ss.
2. Other accents removed (é → e, ñ → n).
3. Each run of characters other than `A-Z a-z 0-9 . _ -` becomes one `_`.
4. Leading and trailing `_` removed.
5. Cut to the first 120 characters.
6. Empty result: `wing`.

The rule is the same in the English and the German interface.

Example: `Flügel V2 (neu)` → `Fluegel_V2_neu.step`.

| Format | File | Content | Verification |
| --- | --- | --- | --- |
| STEP, Application Protocol 214 (AP214), ISO (International Organization for Standardization) 10303-21 text | `.step` | One closed B-rep (boundary representation) solid per half. Faces: upper and lower B-spline surface (the exact loft surface), ruled trailing-edge face (open trailing edge only), planar root and tip caps. | CI: `scripts/validate_step.py` reads 15 test wings with OpenCascade (cadquery-ocp 8.0.1). Pass: shapes valid, shells closed and oriented, volume within 0.05 % of the mesh volume, cap edges within 1e-6 mm of their planes. |
| STL, binary | `.stl` | Closed triangle mesh; one shell per body. | Unit tests: every directed edge occurs once and its reverse once; volume from the parsed float32 file within 0.0005 % of the mesh volume. |
| 3MF | `.3mf` | Same meshes; one object per shell; unit millimetre. | Unit tests: 3 package parts, unit millimetre, 1 object and 1 build item per shell, vertex count. CI: `scripts/validate_3mf.py` reads the 15 test wings with lib3mf 2.5.0 in strict mode. Pass: no warnings while reading, triangle count per object as written, every object manifold and oriented. Slicer software: not tested. |
| Foam-cutting files (wizard **Foam**) | `.zip`, `.svg`, `.pdf`, `.dxf` | End profile pairs (`.dat`), `segments.csv`, 1:1 templates. Contents: [File Formats](https://github.com/subtilitas/Wingdesigner/wiki/File-Formats), section Foam-cutting files. | CI: `scripts/validate_foam.py` reads the files of 13 test wings with ezdxf 1.4.4 (DXF audit without errors, closed profile polylines; without kerf, their width and height match the `.dat` files within 0.001 mm) and pypdf 6.19.0 (page count, page size, page labels); the SVG with an XML parser. Hot-wire cutting programs, computer-aided design (CAD) programs, laser cutters, printers: not tested. |
| Project JSON | `.json` | Airfoil coordinates, sections, guide curves, settings. Derived NURBS data, only when the wing builds without errors. When the file with the derived data would exceed 100 MB, **Save** and the JSON export leave it out and show `The file leaves out the derived NURBS data: with it, the file would exceed 100 MB, the largest project file Open reads. Open recomputes it; STEP export writes the exact surfaces.` Derived data: curve of every airfoil used by a section, each enabled guide curve (null when off), spanwise stations, wing surface (degrees, knots, control points). Import ignores the derived data and recomputes it. | Unit tests: write, read back and rebuild gives the same sections, guide curves, airfoil points and surface control points; validation of every field. |

| Export option | Values | Effect |
| --- | --- | --- |
| **Wing halves** | **Both halves as separate bodies** (default) | 2 bodies in every format |
| | **Full wing as one body** | STL and 3MF: 1 shell, only when the root section lies at y = 0 and **Part roll** is 0°, otherwise 2 bodies. STEP: 2 solids. |
| | **Right half only** | 1 body |
| | **Left half only** | 1 body: the left half, as **Left half** in **Settings** builds it; for a one-sided flow5 wing the half flow5 builds |
| **Mesh density** | **Normal** (default), **Fine (4x triangles)** | STL and 3MF only. A note below the options gives the triangle count and file size of the chosen format, halves and density: `… million triangles, file about … MB.` Above 2,000,000 triangles it adds `The export takes … and … of browser memory.` Above 10,000,000 triangles **Download** is disabled; the note names the limit and the remedies: Normal density, one half, fewer stations per surface or per panel. |
| **Fusion 360 fix: Y up (also SolidWorks)** (STEP, STL, 3MF) | off (default), on | On writes every point (x, y, z) as (x, z, −y): the upper surface faces +Y, the chord stays along X, the span runs along Z. For CAD programs with Y as the up axis, which show a Z-up file on its side. The checkbox starts as it was at the last export (browser storage). The project JSON keeps the axes of the app. |
| **Format** STEP | – | A note gives the control points and file size of the chosen halves: `… control points, file about … MB.` Above 1,000,000 control points it adds the time and browser memory; above 3,000,000 **Download** is disabled and the note names the limit and the remedies: one half, fewer stations per surface or per panel. |

## Airfoil data and licenses

- NACA 4-digit and 5-digit airfoils are computed in the browser from the published equations. No coordinate file is used for them.
- The bundled airfoil library (`public/airfoils/`) holds 62 coordinate files: 6 under a free license and 56 MH airfoils of Martin Hepperle,
  bundled with his written permission. **Library** lists them after the 17 NACA presets, each with category, use, author and license
  identifier; the author links to the source page of the file.
- Adding a library file copies author (as attribution, editable in the preview), license identifier, source address and terms address
  into the `source` of the project airfoil.
- Source, legal basis with quotes, conditions and attribution text per file:
  [public/airfoils/NOTICE.md](public/airfoils/NOTICE.md).

| Airfoil | Source | License identifier | Basis |
| --- | --- | --- | --- |
| Clark Y | NACA Report No. 502, Table I; section by Virginius E. Clark | `public-domain` | Work of the United States Government; United States copyright term expired |
| NACA 8-H-12 | NACA Technical Note 1998, Table I | `public-domain` | Work of the United States Government |
| NACA M-6 | NACA Report No. 221, Table XXIX | `public-domain` | Work of the United States Government; United States copyright term expired |
| RAF 34 | Royal Aircraft Establishment (RAE) table in NACA Report No. 286 | `public-domain` | United States copyright term expired; table reprinted in a work of the United States Government |
| MH 1 to MH 126, 56 airfoils | Martin Hepperle, coordinate pages on <https://www.mh-aerotools.de/airfoils/> | `written-permission` | Written permission of the designer to include them in Wingdesigner (e-mail, October 2026); the MIT License of the program code does not apply to them |
| S9104 | Michael Selig, University of Illinois Urbana-Champaign | `CC-BY-4.0` | Creative Commons Attribution 4.0 International license (CC BY 4.0) from the designer |
| USA 35B | NACA Report No. 233, Table XXXVI | `public-domain` | Work of the United States Government; United States copyright term expired |

- Status of the 5 public-domain files outside the United States: not established.
- RAF 34: 7 values of the source scan are uncertain by up to 0.20 % of chord (listed in NOTICE.md).
- The expansions of "RAF" and "USA" in the section names are unknown; the sources checked do not give them.
- The `.dat` download and the STEP, STL and 3MF exports carry no attribution.
  NOTICE.md gives the attribution text for a shared file made with S9104.
- Not bundled: aerodesign.de (personal use allowed, redistribution restricted),
  UIUC (University of Illinois Urbana-Champaign) Airfoil Coordinates Database (no license stated).
  The app links to these sources and to mh-aerotools.de, the site of the MH airfoils.
- Not bundled either: share-alike data (Creative Commons Attribution-ShareAlike 4.0),
  sections by Mark Drela under the GNU General Public License (GPL) version 2 or later, the PROFOIL test sections.
  Decisions: [RECORD.md](RECORD.md).
- Terms and quotes: [Airfoil Sources](https://github.com/subtilitas/Wingdesigner/wiki/Airfoil-Sources),
  [Profilquellen](https://github.com/subtilitas/Wingdesigner/wiki/Profilquellen).
- Uploaded airfoils keep their name and attribution in the project JSON.
- Airfoils imported from an XFLR5 project (`.xfl`) keep their name and the file name in the project JSON (`source.kind` `xflr5`). The name rule below fills the attribution for HS and MH names. The app does not check the rights to these airfoils; whoever imports the file is responsible for them.
- The airfoil preview fills the **Source / attribution** field. Library file: the author from `index.json`.
  Other airfoils: from the airfoil name; the match ignores case and leading spaces.

| Name starts with | Attribution filled in |
| --- | --- |
| `HS` + space or hyphen | Hartmut Siegmann, www.aerodesign.de |
| `MH` + optional space or hyphen + digit | Martin Hepperle, www.mh-aerotools.de |

## Current limitations

| Limitation | Condition |
| --- | --- |
| Smooth blending with **Mitred** section planes stops some wings that **Linear** builds. | The cubic can leave a section up to 3 times as steep as the panel next to it, and the root plane stays vertical. Where a section plane then lies more than 60° from the blended reference line, or the planes turn faster than the airfoils allow, the build stops. Example: panels of −34.4° and 74.0° stop at the root (63.7°); **Linear** builds them. |
| Section planes follow the section positions only. | **Mitred** planes take their rolls from the positions (y, z) of the sections. A roll per section cannot be typed. An XFLR5 import whose airfoil frames move sections builds rolls that differ from XFLR5's: 3.90° and 4.88° instead of 4.5° and 6° on the untilted worked example, within 0.1 mm at its trailing edges. |
| A chord below 1 mm is not possible. | Chord below 1 mm at any span position is an error. Checked at 257 evenly spaced span positions, every loft station and every guide-curve control point and knot. A chord of the fitted surface below 0.9 mm (measured along the intended chord direction) is an error; it is checked at the same positions and at 0.25, 0.5 and 0.75 of every interval between fitted stations. A **Pointed** tip ends in a profile scaled to 1/100 to 1/1000 of the second-to-last section chord, at least 1 mm. |
| A wing beyond ±1,200,000 mm or with a chord above 100,000 mm between the sections is not possible. | Error when, at a span position of the chord check, leading-edge x, trailing-edge x or z lies beyond ±1,200,000 mm or the chord exceeds 100,000 mm. Causes: guide curves, for example nose line and end line more than 100,000 mm apart; the blends stay within the section values. The message names the span position, leading-edge x, z and chord. Remedy named in the message: checking the guide curves. |
| A closed or fixed-thickness trailing edge can make upper and lower surface cross. | Occurs where the airfoil is thinner inside than its trailing-edge gap. The upper surface then passes below the lower one; this is an error. Use **As in the airfoil files** or a larger thickness. |
| The loft follows the guide curves exactly only at the spanwise stations. | Warning when the loft surface still deviates from the intended profile (leading edge, upper trailing-edge point, 5 chord stations per surface at 60 chordwise stations) by more than 0.5 mm (or 10 % of the local chord, if smaller) after the extra stations (up to 32 in 6 rounds, 1 round above 60,000 loft grid points). Of the fits before and after each round the build keeps the one with the smallest largest deviation relative to its tolerance, the first one on a tie: 2 sections with a nose-line bump 4 mm high and 0.06 mm wide deviate 3.67 mm without extra stations and 18,797 mm after 32; the build keeps the first fit and warns. The warning uses the check positions of the chord check only. The warning names more spanwise stations per panel (up to 40) as the remedy; its effect on a wing with this warning is not measured. When the grid limit lowers N (Functions, Spanwise stations), a higher setting adds no stations. The wizard presets with pointed tip build without this warning; Glider with pointed tip (elliptic planform, 8 stations per panel): 5 extra stations, largest deviation 0.263 mm. Within 2 mm of a pointed elliptic tip the leading and trailing edge x deviate at most 0.031 mm (wizard presets); the other profile points there are not measured, and the warning does not cover them. Local thickness of the fitted surface at the compared chord stations below 0 ("turns inside out") or at most 0.001 % chord between 1 % and 99 % chord ("has zero thickness") is an error. Checked at the check positions and at 0.25, 0.5 and 0.75 of every interval between fitted stations. Cause named in the message: guide curves that change fast. |
| The loft surface is tested for self-crossing on selected rows only. | A surface row (in the plane of its station) that crosses itself between the resampled points is an error ("The loft surface crosses itself at y = … mm near x = … mm"; remedy named in the message: more stations per surface). Tested rows: every section, halfway between adjacent sections and halfway across the 64 widest intervals between fitted stations. Rows in the other station intervals are not tested. |
| Trailing-edge gaps below 0.01 mm are opened to 0.01 mm. | Applies unless every station has a closed trailing edge. Stations with a gap below 0.01 mm are opened to 0.01 mm (at most 5 % of the local chord). A warning gives the number of opened stations. Its text names closed and open stations also when every station is open with a gap below 0.01 mm. |
| Guide curves set x and chord only. | z (dihedral) and twist always follow the section values. |
| Inclined airfoils are not rotated back. | Twist refers to the x axis of the file. Warning when the line from leading edge to trailing edge is inclined by more than 0.5°. The bundled Clark Y (1.97°) and USA 35B (1.51°) give this warning. |
| STEP files carry no colours, no face names and no assembly structure. | Applies to every STEP file. |
| The 25 % MAC point is a geometric reference. | Shown in **Checks** as "25 % MAC (geometric reference)". No neutral-point or centre-of-gravity calculation. |
| A project within all limits can exceed the 100 MB of a project file. | Names and source texts near their limits: 10,000 airfoils with 10,000-character names hold 100,000,000 name characters (with 5 points per airfoil: 100.8 MB). **Save** writes no file and shows `Save failed: the project takes 100.8 MB as a file, above the 100 MB that Open reads.` Projects with shorter names and source texts fit: 1,000,000 airfoil points take about 40 MB. |
| Browser support is tested in Chromium only. | Playwright tests at 1280 x 720 and in the Pixel 7 phone profile. Firefox and Safari: not tested. |
| Time and memory estimates come from one desktop computer. | The `Large project` warning, the warning for airfoils above 5000 points, the titles of **+** and **Add point**, the loft grid note in **Settings** and the export note use linear fits to measurements in Chromium 141 on 4 cores of a 2.1 GHz server CPU. Measured: JavaScript time without drawing the 3D view; the 3D view adds its drawing time. The first-build sentence of the `Large project` warning adds a term measured in Node.js 24 only. |
| Flaps of XFLR5 airfoils are imported undeflected. | An `.xfl` project stores the base shape and the flap parameters. The import uses the base shape and cuts no control surface. Report: info for a flap at 0°, warning for another angle. A 0.5° flap with its hinge at 50 % of the chord puts the trailing edge 1.61 mm off XFLR5's at 368 mm chord. |
| A tilt angle that the XFLR5 import folded into the sections stays folded when a guide curve is on or edited. | Project files of format version 2 from the XFLR5 import hold the tilt angle folded into the section values. **Open** and the restore of the browser copy turn the fold into **Part tilt**, with a notice. The fold stays when a guide curve is on, or off with edited points (guide curves hold x only), or when a twist would lie beyond ±360° without it. Such a project is exact with **Vertical** section planes; with **Mitred** it lies up to 0.75 · chord · sin(tilt) · sin(roll) off XFLR5's, with a warning in **Checks**. Project files of the XFLR5 import of format version 1 hold the fold without the angle: they open with **Vertical** section planes and **Part tilt** 0°, and give no such warning. |
| The imported wing is not identical to the surface XFLR5 builds. | Compared with the STL files that the code of XFLR5 6.62 wrote for 93 surfaces of 15 real projects: 35 lie within 0.1 mm, 80 within 0.6 mm; the others are 4 tilted V-tails (2.87 mm, measured with the tilt folded into **Vertical** sections, the import of project format version 2), 8 wings with a 0.5° flap (2.43 and 2.65 mm) and 1 wing with a 33-point Clark YS (0.88 mm). XFLR5 joins the airfoil points with straight segments, Wingdesigner with a smooth curve (largest part on 58 surfaces); XFLR5 shears the airfoil of a twisted section, Wingdesigner rotates it as a rigid shape (0.37 mm at 3° twist and 300 mm chord); XFLR5 skews the panels next to a flap. Tilted parts imported with **Mitred** planes and the rigid tilt: not measured against these files. Details: section "Differences from XFLR5" of [File Formats](https://github.com/subtilitas/Wingdesigner/wiki/File-Formats). |
| Library airfoils and airfoils of the current project have no frame, except NACA sections of the current project (they get the frame of the generated section of their NACA code). | The XFLR5 coordinates of the name are not known. The report names bundled airfoils whose leading edge lies, in their own coordinates, more than 2 % of the chord from 0 in x or y: Clark Y 3.55 %, USA 35B 2.87 %; and airfoils of the current project from an XFLR5 import or an upload, whose own coordinates are not stored. Uploading the `.dat` file that XFLR5 used places the sections as XFLR5 does. |
| flow5 files of flow5 7.50 to 7.53 are untested. | No file of these versions was available. Their record layouts (project format 500750) are tested with files of the test writer `test/fl5-writer.js`. A `.fl5` project with a sections body is tested with a file of flow5 7.56 only. |
| The phone file pickers with the `.xfl` and `.fl5` filter are untested. | Whether the file pickers of Android and iOS list `.xfl` and `.fl5` files with the filter of **Open** is unknown. The Playwright tests (Chromium on the desktop and in the Pixel 7 profile) check the `accept` attribute and hand the file to the chooser; no phone picker is opened. |
| The XFLR5 import dialog is untested with screen readers. | **Upload .dat** in the dialog announces its result in a status line that only screen readers show. No screen reader was run against the dialog. |
| Foam cores are cut straight between their end profiles. | A wing that is not ruled between two cuts (guide curves, **Smooth** blending, **Linear** blending with stations between the sections, as between **Mitred** section planes of different roll) deviates from the core; the wizard shows the deviation per segment and splits segments above the limit. The cuts are not saved with the project. |
| The foam-cutting files are untested with cutting programs and printers. | The templates are checked with independent readers (ezdxf, pypdf, an XML parser), the `.dat` files and `segments.csv` with the validation script's own reader; Jedicut, GMFC, DevFoam, CAD programs, laser cutters and printers were not run with them. Templates offset for the kerf use mitred corners limited to 4 times the offset, so a sharp trailing edge is blunted by the limit. |
| The winglet attaches at the tip section, and y stays the span parameter of the loft. | Cant angles beyond ±89° (a winglet folded over the wing) are not possible. With guide curves on, a pointed tip or **Vertical** section planes the dialog refuses; switching guide curves on after adding a winglet stretches them over the winglet sections. Aerodynamic effect of the winglet: not computed. |
| Wing computation time and memory use on phones: not measured. | — |

## Quick start

1. Open the app. On the first visit the wizard opens with the **Sport** preset.
   Pick a preset, edit the values, click **Create design**.
   **Skip (open sample wing)** loads "Sport wing 1500": 1500 mm span, 3 sections, NACA 2412 and 2410.

   ![Wizard dialog with the Glider preset selected: 10 preset buttons, input fields, planform preview with area, aspect ratio and mean aerodynamic chord](docs/wiki/images/wizard.png)

2. **Airfoils**: enter a NACA code and click **Preview**, click **Preview** next to a **Library** entry,
   or drop airfoil files on the drop zone or click **Choose files**.
   Review the preview, then click **Add to project**.
3. **Sections**: choose the airfoil in the **Airfoil** column. Set y, x, z, chord and twist of each section.
   **+** inserts a section after the row (disabled at 20,000 sections; from 200 sections on, its title names the time and memory of each change with one more section).
   When no span position lies between the row and the next section, **+** shows a message and inserts nothing. **×** deletes the row (disabled at 2 sections).
4. **Planform**: tick **Use guide curve** for the nose line or the end line. Drag the points.
5. **Checks**: read errors, warnings and planform figures.
6. **Foam** (optional): check the cuts and the deviation per segment, then download the end profiles or the templates.
7. **Export**: choose format, wing halves and mesh density (for Fusion 360 set to Y up: **Fusion 360 fix**), then click **Download**.
   A note gives the triangle count (STL, 3MF) or control point count (STEP) and the file size; above 10,000,000 triangles or 3,000,000 control points **Download** is disabled.

## Offline use

Each GitHub release (tag `v*`) carries `wingdesigner-<tag>-site.zip`, the built site (1.5 MB zipped, build of 2026-10-03: 1.2 MB of code with the styles and the compiled airfoil library, a 4.5 MB source map, the 62 bundled airfoil files with `NOTICE.md` and `LICENSES.txt`).

1. Unzip it.
2. Open `index.html` in the browser. The app runs from the file without a web server and without network access; the airfoil library is part of the code, and autosave keeps the project across reloads. Tested in Chromium 141; Firefox and Safari: not tested.

A static web server on the unzipped folder works as well, e.g. `python3 -m http.server` and then `http://localhost:8000/`.

## Development

Requires Node.js 24 (`.nvmrc`; `package.json` engines `>=24`).
STEP and 3MF validation: Python 3.12 (as in CI), 3.11.15 in a local run on 2026-09-30; other Python versions not tested.
Version history: [CHANGELOG.md](CHANGELOG.md). Verified state and open items: [RECORD.md](RECORD.md). Where the work stands, next steps and the working agreements with the owner: [docs/Handover.md](docs/Handover.md).

```bash
npm ci
npx playwright install chromium   # browser for end-to-end (e2e) tests and screenshots (or set PW_CHROMIUM=/path/to/chrome)
npm run dev              # development server on http://localhost:5173
npm test                 # 662 unit tests (Vitest)
npm run lint             # ESLint
npm run build            # production build into dist/
npm run preview          # serve dist/ on http://localhost:4173
npm run e2e              # production build, then 201 Playwright tests on desktop 1280 x 720 and Pixel 7 (402 runs)
npm run coverage         # unit tests with coverage report in coverage/
npm run coverage:readme  # write the coverage tables into README.md and README.de.md
npm run coverage:check   # exit code 1 when a README coverage table differs from coverage/
npm run airfoils:check   # validate the bundled airfoil library and the NACA presets
npm run step:cases       # write 15 STEP files, 15 3MF files and cases.json to step-check/
npm run foam:cases       # write the foam-cutting files of 13 test wings and cases.json to foam-check/
npm run screenshots      # rebuild and regenerate docs/wiki/images/
npm run docs:check       # check page pairs, wiki links, images, coverage markers and the release texts in CHANGELOG.md
npm run counts:check     # compare the test counts in README, RECORD and wiki with the suites
npm run i18n:check       # check the German translation of every text
pip install cadquery-ocp==8.0.1.0.0 lib3mf==2.5.0         # Python 3.12
python scripts/validate_step.py step-check/cases.json   # validate the STEP files with OpenCascade
python scripts/validate_3mf.py step-check/cases.json    # validate the 3MF files with lib3mf (strict mode)
pip install ezdxf==1.4.4 pypdf==6.19.0
python scripts/validate_foam.py foam-check/cases.json   # validate the foam-cutting files with ezdxf and pypdf
```

## Test coverage

Update: `npm run coverage && npm run coverage:readme`. CI runs `npm run coverage:check` and fails on a difference.
The Playwright tests run the DOM (Document Object Model) code; its coverage is not measured.

<!-- coverage:start -->
| Statements | Branches | Functions | Lines |
| ---: | ---: | ---: | ---: |
| 98.0 % | 94.2 % | 98.3 % | 98.8 % |

Unit tests (Vitest, V8 coverage) over `src/`, excluding the DOM code in `src/ui/` and `src/main.js`.
<!-- coverage:end -->

## Authors

Julian (subtilitas) created Wingdesigner, with Claude (Anthropic) as co-creator.

## License

MIT License (named after the Massachusetts Institute of Technology), see [LICENSE](LICENSE). Airfoil coordinate data keeps the terms of its source.

The build writes `LICENSES.txt` next to `index.html`: this license and the license texts of the libraries in the bundle, three.js and fflate (both MIT). **Help** links to it.
