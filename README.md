Deutsch: [README.de.md](README.de.md)

# Wingdesigner

Browser application for designing wings of radio-controlled (RC) model aircraft.

- Lofts one half wing as a NURBS (non-uniform rational B-spline) surface through 2 to 20,000 airfoil sections.
- Models the half wing at y ≥ 0; the other half is its mirror image at the plane y = 0.
- Exports models as STEP (Standard for the Exchange of Product model data), STL (stereolithography) and 3MF (3D Manufacturing Format).
- Saves the project as JSON (JavaScript Object Notation).
- Projects and airfoil files are not sent to a server.

| Resource | Address | Published by |
| --- | --- | --- |
| App | <https://subtilitas.github.io/Wingdesigner/> | `ci.yml`, push to `main`, after all other continuous integration (CI) jobs pass; HTTP 200 on 2026-09-29 |
| Wiki start page (English and German) | <https://github.com/subtilitas/Wingdesigner/wiki> | `docs.yml`, push to `main` that changes `docs/wiki/` or `docs.yml`, or manual run; reachability: not verified |

| Topic | English | German |
| --- | --- | --- |
| Workflow, controls, export options | [User Guide](https://github.com/subtilitas/Wingdesigner/wiki/User-Guide) | [Benutzerhandbuch](https://github.com/subtilitas/Wingdesigner/wiki/Benutzerhandbuch) |
| Airfoil curves, sections, guide curves, surface | [Geometry](https://github.com/subtilitas/Wingdesigner/wiki/Geometry) | [Geometrie](https://github.com/subtilitas/Wingdesigner/wiki/Geometrie) |
| Airfoil files, checks, project JSON, STEP, STL, 3MF | [File Formats](https://github.com/subtilitas/Wingdesigner/wiki/File-Formats) | [Dateiformate](https://github.com/subtilitas/Wingdesigner/wiki/Dateiformate) |
| Airfoil sources and licenses | [Airfoil Sources](https://github.com/subtilitas/Wingdesigner/wiki/Airfoil-Sources) | [Profilquellen](https://github.com/subtilitas/Wingdesigner/wiki/Profilquellen) |
| Architecture, build, tests, CI | [Development](https://github.com/subtilitas/Wingdesigner/wiki/Development) | [Entwicklung](https://github.com/subtilitas/Wingdesigner/wiki/Entwicklung) |

![Desktop window after creating the Glider preset: top bar, 3D view, Sections tab with 3 sections, status bar with span 2000 mm](docs/wiki/images/main-desktop.png)

## Functions

| Function | Behaviour | Limits and defaults |
| --- | --- | --- |
| Sections | Each section places an airfoil with its leading edge at (x, y, z), scales it to the chord and rotates it by the twist. | 2 to 20,000 sections, warning above 200 (see Project size); y 0 to 1,000,000 mm, all y distinct; x and z −1,000,000 to 1,000,000 mm; chord 1 to 100,000 mm; twist −360 to 360°. The **Sections** table clamps typed values to these limits; planform drags stay within them. |
| Airfoil curve | Cubic B-spline through every point of the airfoil file. | Parametrization: centripetal (default), chord length, uniform. With chord length or uniform, airfoil errors in **Checks** add a hint to use centripetal. |
| Chordwise resampling | All sections are resampled at the same chord fractions, cosine-spaced towards leading and trailing edge. | 16 to 200 stations per surface, default 60 |
| Spanwise blending | **Linear**: straight panels (panel: span interval between 2 adjacent sections), kinks at the sections. **Smooth**: natural cubic spline through the section values. | Default linear; smooth needs 3 or more sections (with 2 sections the blend is linear) |
| Spanwise stations | With a guide curve or smooth blending: N stations per panel (section included), cosine-spaced towards the panel ends. Otherwise: stations only at the sections. Extra stations are inserted where the loft surface deviates from the intended profile by more than 0.5 mm or 10 % of the local chord, whichever is smaller (3D distance). Compared points: leading edge, upper trailing-edge point and 5 chord stations per surface (at the default 60 chordwise stations). Extra stations lie at check positions: 257 evenly spaced span positions, the stations and every guide-curve control point and knot. Each extra station keeps at least 1e-6 of the span from every other station. | N = 3 to 40, default 8; up to 32 extra stations. Loft grid: (N × (sections − 1) + 1) × (2 × stations per surface + 1) points before the extra stations (N = 1 without guide curve and without smooth blending). **Settings** shows `Loft grid: … points` under **Resolution**; above 60,000 points the note adds the time and memory of each change, and the `Large project` warning lists the grid. Above 5,000,000 grid points N is lowered to the largest value that keeps the grid within 5,000,000, with a warning. When 1 station per panel still exceeds 5,000,000 grid points, the build stops with an error; remedies named in the message: fewer stations per surface, fewer sections. Default settings (60 stations per surface, linear blending, no guide curve: 1 station per section): warning from 496 sections on; N is never lowered (20,000 sections: 2,420,000 grid points). With a guide curve or smooth blending at the default N = 8: warning from 63 sections on; N lowered from 5167 sections on; 20,000 sections: N = 2. |
| Wing surface | Tensor-product B-spline surface through all stations. | Degree 3 chordwise; spanwise degree 1 (linear blending, no guide curves) or 3; linear blending with a guide curve: degree 2 or 1 when the grid limit lowers N to 2 or 1 |
| Guide curves | Nose line (leading edge) and end line (trailing edge) in the planform. Each is a NURBS curve through points (curve parameter proportional to y) or from control points, stretched to the root-to-tip span. | Off by default; degree 1 to 5, default 3; 2 to 20,000 points (**Add point** is disabled at 20,000); warning above 500 points in an enabled guide curve, and from 500 points on the title of **Add point** names the time and memory of each change with one more point; y strictly increasing; x within ±1,100,000 mm (covers the trailing edge x + chord of every valid section), y within ±1,000,000 mm; drags and typed x values are clamped to ±1,100,000 mm. Error when a control point of the curve lies beyond x = ±1,200,000 mm; through-point curves over points unevenly spaced in y reach this. Remedies named in the message: points spaced more evenly in y, control-point mode. |
| Trailing edge | As in the airfoil files, closed, or a fixed thickness in mm. | Default mode: as in the airfoil files; default thickness value 0.4 mm. Wizard: fixed thickness max(0.3 mm, 0.2 % of root chord). Sample wing: fixed 0.5 mm. Limited to 5 % of the local chord, with a warning (no warning in the last panel of a **Pointed** tip). |
| Wing tip | **Flat**: the wing ends at the tip section. **Pointed**: tip profile scaled to 1/N of the chord at the second-to-last section, at least 1 mm. In the last panel the chord stays ≥ this tip chord. Converging guide curves end in the scaled profile. | Default flat; N = 100 to 1000, default 200. The **Sections** table shows the tip chord; `(min.)` marks the 1 mm floor. |
| Mirror | Display toggle **Show mirrored half (y < 0)** in **Settings**. Exports use the export option **Wing halves**. Statistics always cover both halves. | Display toggle default: on |
| Airfoil import | Selig, Lednicer, 3-column table (x, upper y, lower y), XML (Extensible Markup Language), HTML (HyperText Markup Language) pages (coordinates in `<pre>` blocks or tables). Reads decimal commas, percent coordinates, UTF-8 (Unicode Transformation Format, 8-bit) and Windows-1252. Input: dropped files, **Choose files** or pasted text. Shows outline, NURBS curve and check messages before the airfoil is added. Consecutive points closer than 1e-9 chord to the previous point are removed. An airfoil with an error, including a failed NURBS interpolation, cannot be added (**Cannot add (errors)**). The preview (upload and **View**) draws the NURBS curve with the project's profile parametrization. | **Choose files** filter: `.dat`, `.txt`, `.cor`, `.xml`, `.htm`, `.html`, `.csv` and plain-text files; dropped files: any extension; 5 to 100,000 points, warning below 20 and above 5000 (`… points (warning above 5,000): the checks and the first build of a wing that uses the airfoil take … s.`); at most 5,000,000 characters; files above 20 MB are rejected before reading; a name line above 10,000 characters is cut to its first 10,000. Per project: at most 10,000 airfoils and 1,000,000 airfoil points in all; warning above 200 airfoils and above 100,000 airfoil points. Project files: the same point and airfoil limits. At 10,000 airfoils the **Airfoils** tab opens no preview and shows `The project holds 10,000 airfoils, the limit; "Remove unused" frees places.`; an airfoil that takes the project above 1,000,000 points is refused in the same way. |
| NACA generator | NACA (National Advisory Committee for Aeronautics) 4-digit and 5-digit airfoils from the equations of NACA Report 824. Also reflexed 5-digit airfoils (third digit 1). Open or closed trailing edge. | 17 presets; 81 points per surface |
| Wizard | Inputs: 7 numbers (see [Wizard inputs](#wizard-inputs)), planform (straight or elliptic), tip (flat or pointed), root and tip NACA code. Output: evenly spaced sections; the elliptic planform adds nose and end guide curves. Last section: tip airfoil; all others: root airfoil. | 6 presets: **Trainer**, **Sport** (preselected), **Glider**, **Swept flying wing**, **Plank**, **Tail surface**. Elliptic with flat tip: taper < 1. Pointed tip: tip chord 1/200 of the second-to-last section chord, at least 1 mm. |
| Checks | Lists errors and warnings. Planform: span, wing area (dm²), aspect ratio, mean aerodynamic chord (MAC), MAC position (y, leading-edge x), 25 % MAC x, root and tip chord. Surface: degrees, control-point counts, trailing edge open or closed. Span = 2 × y of the tip section; area and MAC: 5-point Gauss-Legendre quadrature of the intended planform between root, tip, the sections and every guide-curve knot and control point; an interval is halved while the halves change an integral by more than 1e-10 of its scale, at most 12 times. | Export of STEP, STL and 3MF is blocked while errors exist. Section and guide values beyond the project limits are errors; autosave does not store such a project, and **Open** rejects it. Root section off y = 0: the gap between the halves counts to the span, not to the area. |
| Project size | Above a warning threshold the wing builds as usual. **Checks** adds one warning: `Large project: …`, listing each size above its threshold with `(warning above …)`, followed by the estimated time and browser memory of each change (`Each change takes … and … of browser memory.`). When the first build (**Open**, restored autosave, a change of **Profile parametrization**) takes at least 1 s longer than a change, the warning adds `Opening it or changing the profile parametrization takes ….`; estimate: time of a change plus 4.4 ms per airfoil that a section uses plus 30 µs per point of these airfoils (Node.js 24; 20,000 linear sections at 16 stations per surface and 10,000 airfoils of 99 points: `about 83 s`). A message shows the same text when an edit, **Open** or the restored autosave takes a size above its threshold. Estimates: linear fits to measurements in Chromium 141 (see Current limitations). | Warning above: 200 sections, 200 airfoils, 5000 points in one airfoil, 100,000 airfoil points in all, 500 points in an enabled guide curve, 60,000 loft grid points, 2,000,000 export triangles or 1,000,000 STEP control points (export dialog), 200 characters in a name. Hard limits, where a desktop browser tab runs out of memory or a change takes about a minute: 20,000 sections, 10,000 airfoils, 100,000 points in one airfoil, 1,000,000 airfoil points in all, 20,000 points per guide curve, 5,000,000 loft grid points, 10,000,000 export triangles, 3,000,000 STEP control points, 10,000 characters in a name, 200 characters in an id, 2000 characters in an airfoil source text, 100 MB per project file. Lists and messages show the first 200 characters of a name followed by `…`. |
| Input | Mouse, touchscreen, keyboard. 3D view: drag rotates, wheel or pinch zooms, right button or 2 fingers pan. 2D views (planform, previews): drag a point to move it, drag the background to pan, wheel or pinch zooms, 2 fingers pan, double-click fits. | Undo: Ctrl+Z or Cmd+Z; redo: Ctrl+Shift+Z, Cmd+Shift+Z, Ctrl+Y or Cmd+Y. Shortcuts are ignored while an input field has focus or a dialog is open. Undo history: at most 100 steps and at most 64,000,000 characters of serialized project (undo and redo together); a project above 640,000 characters keeps fewer steps, at least 1. One drag forms 1 undo step, however long it pauses; an action that changes nothing adds no undo step. |
| Storage | Autosave to browser local storage after every change that passes project validation, with the rebuild in the next animation frame; a pending save is written at once when the page is hidden or left (reload, closing the tab). A stored project that fails to load is kept under `wingdesigner.project.v1.rejected`, and the wizard opens. Nothing is saved while the first-run wizard is open. **Save** downloads the project JSON. **Open** opens a project file. When browser storage refuses the project, a message says so and the status bar shows `Autosave off: use Save` until an autosave succeeds. | Local storage unavailable: the project stays in memory only. Browser storage: about 5,000,000 characters per site. **Open**: files above 100 MB are rejected before reading. |

### Wizard inputs

| Wizard input | Range | Unit |
| --- | --- | --- |
| **Span (both halves)** | 100 to 20,000 | mm |
| **Root chord** | 10 to 3000 | mm |
| **Taper (tip / root chord)** | 0.1 to 1.5 | — |
| **Sweep of the 25 % line** | −45 to 60 | ° |
| **Dihedral per half** | −15 to 30 | ° |
| **Tip twist (negative = washout)** | −15 to 15 | ° |
| **Number of sections** | 2 to 8 | — |

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

1. Accents removed (ü → u).
2. Each run of characters other than `A-Z a-z 0-9 . _ -` becomes one `_`.
3. Leading and trailing `_` removed.
4. Cut to the first 120 characters.
5. Empty result: `wing`.

Example: `Flügel V2 (neu)` → `Flugel_V2_neu.step`.

| Format | File | Content | Verification |
| --- | --- | --- | --- |
| STEP, Application Protocol 214 (AP214), ISO (International Organization for Standardization) 10303-21 text | `.step` | One closed B-rep (boundary representation) solid per half. Faces: upper and lower B-spline surface (the exact loft surface), ruled trailing-edge face (open trailing edge only), planar root and tip caps. | CI: `scripts/validate_step.py` reads 8 test wings with OpenCascade (cadquery-ocp 8.0.1). Pass: shapes valid, shells closed and oriented, volume within 0.05 % of the mesh volume. |
| STL, binary | `.stl` | Closed triangle mesh; one shell per body. | Unit tests: every directed edge occurs once and its reverse once; volume from the parsed float32 file within 0.0005 % of the mesh volume. |
| 3MF | `.3mf` | Same meshes; one object per shell; unit millimetre. | Unit tests: 3 package parts, unit millimetre, 1 object and 1 build item per shell, vertex count. CI: `scripts/validate_3mf.py` reads the 8 test wings with lib3mf 2.5.0 in strict mode. Pass: no warnings while reading, triangle count per object as written, every object manifold and oriented. Slicer software: not tested. |
| Project JSON | `.json` | Airfoil coordinates, sections, guide curves, settings. Derived NURBS data, only when the wing builds without errors. When the file with the derived data would exceed 100 MB, **Save** and the JSON export leave it out and show `The file leaves out the derived NURBS data: with it, the file would exceed 100 MB, the largest project file Open reads. Open recomputes it; STEP export writes the exact surfaces.` Derived data: curve of every airfoil used by a section, each enabled guide curve (null when off), spanwise stations, wing surface (degrees, knots, control points). Import ignores the derived data and recomputes it. | Unit tests: write, read back and rebuild gives the same sections, guide curves, airfoil points and surface control points; validation of every field. |

| Export option | Values | Effect |
| --- | --- | --- |
| **Wing halves** | **Both halves as separate bodies** (default) | 2 bodies in every format |
| | **Full wing as one body** | STL and 3MF: 1 shell, only when the root section lies at y = 0, otherwise 2 bodies. STEP: 2 solids. |
| | **Right half only** | 1 body |
| **Mesh density** | **Normal** (default), **Fine (4x triangles)** | STL and 3MF only. A note below the options gives the triangle count and file size of the chosen format, halves and density: `… million triangles, file about … MB.` Above 2,000,000 triangles it adds `The export takes … and … of browser memory.` Above 10,000,000 triangles **Download** is disabled; the note names the limit and the remedies: Normal density, one half, fewer stations per surface or per panel. |
| **Format** STEP | – | A note gives the control points and file size of the chosen halves: `… control points, file about … MB.` Above 1,000,000 control points it adds the time and browser memory; above 3,000,000 **Download** is disabled and the note names the limit and the remedies: one half, fewer stations per surface or per panel. |

## Airfoil data and licenses

- NACA 4-digit and 5-digit airfoils are computed in the browser from the published equations. No coordinate file is used for them.
- The bundled airfoil library (`public/airfoils/`) holds 6 coordinate files.
  **Library** lists them after the 17 NACA presets, each with category, use, author and license identifier.
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
| S9104 | Michael Selig, University of Illinois Urbana-Champaign | `CC-BY-4.0` | Creative Commons Attribution 4.0 International license (CC BY 4.0) from the designer |
| USA 35B | NACA Report No. 233, Table XXXVI | `public-domain` | Work of the United States Government; United States copyright term expired |

- Status of the 5 public-domain files outside the United States: not established.
- RAF 34: 7 values of the source scan are uncertain by up to 0.20 % of chord (listed in NOTICE.md).
- The expansions of "RAF" and "USA" in the section names are unknown; the sources checked do not give them.
- The `.dat` download and the STEP, STL and 3MF exports carry no attribution.
  NOTICE.md gives the attribution text for a shared file made with S9104.
- Not bundled: aerodesign.de and mh-aerotools.de (personal use allowed, redistribution restricted),
  UIUC (University of Illinois Urbana-Champaign) Airfoil Coordinates Database (no license stated).
  The app links to these sources.
- Not bundled either: share-alike data (Creative Commons Attribution-ShareAlike 4.0),
  sections by Mark Drela under the GNU General Public License (GPL) version 2 or later, the PROFOIL test sections.
  Decisions: [RECORD.md](RECORD.md).
- Terms and quotes: [Airfoil Sources](https://github.com/subtilitas/Wingdesigner/wiki/Airfoil-Sources),
  [Profilquellen](https://github.com/subtilitas/Wingdesigner/wiki/Profilquellen).
- Uploaded airfoils keep their name and attribution in the project JSON.
- The airfoil preview fills the **Source / attribution** field. Library file: the author from `index.json`.
  Other airfoils: from the airfoil name; the match ignores case and leading spaces.

| Name starts with | Attribution filled in |
| --- | --- |
| `HS` + space or hyphen | Hartmut Siegmann, www.aerodesign.de |
| `MH` + optional space or hyphen + digit | Martin Hepperle, www.mh-aerotools.de |

## Current limitations

| Limitation | Condition |
| --- | --- |
| Sections lie in planes y = const. | With dihedral angle Γ, each section plane is tilted by Γ against the plane normal to the span line. |
| A chord below 1 mm is not possible. | Chord below 1 mm at any span position is an error. Checked at 257 evenly spaced span positions, every loft station and every guide-curve control point and knot. A chord of the fitted surface below 0.9 mm (measured along the intended chord direction) is an error; it is checked at the same positions and at 0.25, 0.5 and 0.75 of every interval between fitted stations. A **Pointed** tip ends in a profile scaled to 1/100 to 1/1000 of the second-to-last section chord, at least 1 mm. |
| Smooth blending can overshoot. | Error when an interpolated value (leading-edge x and chord where no guide curve sets them, z, twist or a profile point height) lies more than 2 × the range of its section values outside that range, or when the blended profile thickness is below 0. Checked at the same span positions as the chord. The overshoot message names the quantity, the span position and the smallest gap between sections. Remedies named in the messages: linear blending, evenly spaced sections, removing sections that lie close together, more sections. |
| A wing beyond ±1,200,000 mm or with a chord above 100,000 mm between the sections is not possible. | Error when, at a span position of the chord check, leading-edge x, trailing-edge x or z lies beyond ±1,200,000 mm or the chord exceeds 100,000 mm. Causes: smooth blending, also within the overshoot bound, for example sections at y = 0, 100 and 1000 mm with x = 0, 1,000,000 and 0 mm (leading-edge x 1,211,902 mm at y = 125 mm); nose line and end line more than 100,000 mm apart. The message names the span position, leading-edge x, z and chord. Remedies named in the message: checking the guide curves, linear blending. |
| A closed or fixed-thickness trailing edge can make upper and lower surface cross. | Occurs where the airfoil is thinner inside than its trailing-edge gap. The upper surface then passes below the lower one; this is an error. Use **As in the airfoil files** or a larger thickness. |
| The loft follows the guide curves exactly only at the spanwise stations. | Warning when the loft surface still deviates from the intended profile (leading edge, upper trailing-edge point, 5 chord stations per surface at 60 chordwise stations) by more than 0.5 mm (or 10 % of the local chord, if smaller) after the extra stations (up to 32 in 6 rounds, 1 round above 60,000 loft grid points). Of the fits before and after each round the build keeps the one with the smallest largest deviation relative to its tolerance, the first one on a tie: 2 sections with a nose-line bump 4 mm high and 0.06 mm wide deviate 3.67 mm without extra stations and 18,797 mm after 32; the build keeps the first fit and warns. The warning uses the check positions of the chord check only. The warning names more spanwise stations per panel (up to 40) as the remedy; its effect on a wing with this warning is not measured. When the grid limit lowers N (Functions, Spanwise stations), a higher setting adds no stations. The wizard presets with pointed tip build without this warning; Glider with pointed tip (elliptic planform, 8 stations per panel): 5 extra stations, largest deviation 0.263 mm. Within 2 mm of a pointed elliptic tip the leading and trailing edge x deviate at most 0.031 mm (wizard presets); the other profile points there are not measured, and the warning does not cover them. Local thickness of the fitted surface at the compared chord stations below 0 ("turns inside out") or at most 0.001 % chord between 1 % and 99 % chord ("has zero thickness") is an error. Checked at the check positions and at 0.25, 0.5 and 0.75 of every interval between fitted stations. Causes named in the message: guide curves that change fast, unevenly spaced sections in smooth mode. |
| The loft surface is tested for self-crossing on selected rows only. | A surface row (plane y = const) that crosses itself between the resampled points is an error ("The loft surface crosses itself at y = … mm near x = … mm"; remedy named in the message: more stations per surface). Tested rows: every section, halfway between adjacent sections and halfway across the 64 widest intervals between fitted stations. Rows in the other station intervals are not tested. |
| Trailing-edge gaps below 0.01 mm are opened to 0.01 mm. | Applies unless every station has a closed trailing edge. Stations with a gap below 0.01 mm are opened to 0.01 mm (at most 5 % of the local chord). A warning gives the number of opened stations. Its text names closed and open stations also when every station is open with a gap below 0.01 mm. |
| Guide curves set x and chord only. | z (dihedral) and twist always follow the section values. |
| Inclined airfoils are not rotated back. | Twist refers to the x axis of the file. Warning when the line from leading edge to trailing edge is inclined by more than 0.5°. The bundled Clark Y (1.97°) and USA 35B (1.51°) give this warning. |
| STEP files carry no colours, no face names and no assembly structure. | Applies to every STEP file. |
| The 25 % MAC point is a geometric reference. | Shown in **Checks** as "25 % MAC (geometric reference)". No neutral-point or centre-of-gravity calculation. |
| A project within all limits can exceed the 100 MB of a project file. | Names and source texts near their limits: 10,000 airfoils with 10,000-character names hold 100,000,000 name characters (with 5 points per airfoil: 100.8 MB). **Save** writes no file and shows `Save failed: the project takes 100.8 MB as a file, above the 100 MB that Open reads.` Projects with shorter names and source texts fit: 1,000,000 airfoil points take about 40 MB. |
| Browser support is tested in Chromium only. | Playwright tests at 1280 x 720 and in the Pixel 7 phone profile. Firefox and Safari: not tested. |
| Time and memory estimates come from one desktop computer. | The `Large project` warning, the warning for airfoils above 5000 points, the titles of **+** and **Add point**, the loft grid note in **Settings** and the export note use linear fits to measurements in Chromium 141 on 4 cores of a 2.1 GHz server CPU. Measured: JavaScript time without drawing the 3D view; the 3D view adds its drawing time. The first-build sentence of the `Large project` warning adds a term measured in Node.js 24 only. |
| Wing computation time and memory use on phones: not measured. | — |

## Quick start

1. Open the app. On the first visit the wizard opens with the **Sport** preset.
   Pick a preset, edit the values, click **Create design**.
   **Skip (open sample wing)** loads "Sport wing 1500": 1500 mm span, 3 sections, NACA 2412 and 2410.

   ![Wizard dialog with the Glider preset selected: 6 preset buttons, input fields, planform preview with area, aspect ratio and mean aerodynamic chord](docs/wiki/images/wizard.png)

2. **Airfoils**: enter a NACA code and click **Preview**, click **Preview** next to a **Library** entry,
   or drop airfoil files on the drop zone or click **Choose files**.
   Review the preview, then click **Add to project**.
3. **Sections**: choose the airfoil in the **Airfoil** column. Set y, x, z, chord and twist of each section.
   **+** inserts a section after the row (disabled at 20,000 sections; from 200 sections on, its title names the time and memory of each change with one more section).
   When no span position lies between the row and the next section, **+** shows a message and inserts nothing. **×** deletes the row (disabled at 2 sections).
4. **Planform**: tick **Use guide curve** for the nose line or the end line. Drag the points.
5. **Checks**: read errors, warnings and planform figures.
6. **Export**: choose format, wing halves and mesh density, then click **Download**.
   A note gives the triangle count (STL, 3MF) or control point count (STEP) and the file size; above 10,000,000 triangles or 3,000,000 control points **Download** is disabled.

## Offline use

Each GitHub release (tag `v*`) carries `wingdesigner-<tag>-site.zip`, the built site (1.0 MB zipped: 0.75 MB of code with the styles, a 3.7 MB source map, the bundled airfoil files and `LICENSES.txt`).

1. Unzip it.
2. Open `index.html` in the browser. The app runs from the file without a web server and without network access; the airfoil library is part of the code, and autosave keeps the project across reloads. Tested in Chromium 141; Firefox and Safari: not tested.

A static web server on the unzipped folder works as well, e.g. `python3 -m http.server` and then `http://localhost:8000/`.

## Development

Requires Node.js 24 (`.nvmrc`; `package.json` engines `>=24`).
STEP and 3MF validation: Python 3.12 (as in CI); other Python versions not tested.
Version history: [CHANGELOG.md](CHANGELOG.md).

```bash
npm ci
npx playwright install chromium   # browser for end-to-end (e2e) tests and screenshots (or set PW_CHROMIUM=/path/to/chrome)
npm run dev              # development server on http://localhost:5173
npm test                 # 276 unit tests (Vitest)
npm run lint             # ESLint
npm run build            # production build into dist/
npm run preview          # serve dist/ on http://localhost:4173
npm run e2e              # production build, then 149 Playwright tests on desktop 1280 x 720 and Pixel 7 (298 runs)
npm run coverage         # unit tests with coverage report in coverage/
npm run coverage:readme  # write the coverage tables into README.md and README.de.md
npm run coverage:check   # exit code 1 when a README coverage table differs from coverage/
npm run airfoils:check   # validate the bundled airfoil library and the NACA presets
npm run step:cases       # write 8 STEP files, 8 3MF files and cases.json to step-check/
npm run screenshots      # rebuild and regenerate docs/wiki/images/
npm run docs:check       # check page pairs, wiki links, images and coverage markers
npm run counts:check     # compare the test counts in README, RECORD and wiki with the suites
pip install cadquery-ocp==8.0.1.0.0 lib3mf==2.5.0         # Python 3.12
python scripts/validate_step.py step-check/cases.json   # validate the STEP files with OpenCascade
python scripts/validate_3mf.py step-check/cases.json    # validate the 3MF files with lib3mf (strict mode)
```

## Test coverage

Update: `npm run coverage && npm run coverage:readme`. CI runs `npm run coverage:check` and fails on a difference.
The Playwright tests run the DOM (Document Object Model) code; its coverage is not measured.

<!-- coverage:start -->
| Statements | Branches | Functions | Lines |
| ---: | ---: | ---: | ---: |
| 97.8 % | 92.1 % | 99.2 % | 98.8 % |

Unit tests (Vitest, V8 coverage) over `src/`, excluding the DOM code in `src/ui/` and `src/main.js`.
<!-- coverage:end -->

## License

MIT License (named after the Massachusetts Institute of Technology), see [LICENSE](LICENSE). Airfoil coordinate data keeps the terms of its source.

The build writes `LICENSES.txt` next to `index.html`: this license and the license texts of the libraries in the bundle, three.js and fflate (both MIT). **Help** links to it.
