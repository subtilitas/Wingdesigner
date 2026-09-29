Deutsch: [[Benutzerhandbuch|Benutzerhandbuch]]

# User guide

| Convention | Value |
| --- | --- |
| Units | millimetres (mm), angles in degrees (°) |
| x | chordwise, positive towards the trailing edge |
| y | spanwise, positive towards the right tip |
| z | up |
| Edited geometry | right half wing (y ≥ 0), mirrored at the plane y = 0 |
| Twist sign | positive = leading edge up |
| Panel | span interval between two neighbouring sections |
| Station | one placed airfoil outline at span position y; every section is a station |

## Screen layout

![Desktop window: top bar, 3D view, Sections tab, status bar](images/main-desktop.png)

| Area | Content |
| --- | --- |
| Top bar | **New**, **Open**, **Save**, **Export**, **Undo**, **Redo**, **Help** |
| 3D view | Wing surface, section outlines (blue, selected section red), leading-edge and trailing-edge lines (grey), grid in the plane z = 0 (20 × 20 cells); view buttons |
| Side panel | Tabs **Sections**, **Planform**, **Airfoils**, **Settings**, **Checks** |
| Status bar | Span, wing area, aspect ratio (AR), mean aerodynamic chord (MAC), warning count (only with 1 or more warnings). With errors: error count and first error message in red text. With autosave off: `Autosave off: use Save` in red text (section [Storage](#storage)). |
| Messages | Short notices (e.g. `Created "Glider".`) at the bottom of the 3D view for 4 s; a notice longer than 66 characters stays 60 ms per character. Error notices on red background. |

| Top bar button | Effect |
| --- | --- |
| **New** | Opens the wizard (section [Wizard](#wizard)). |
| **Open** | Loads a project file in JSON (JavaScript Object Notation) format, file extension `.json`. Rejects files above 100 MB unread: `Cannot open <file>: … MB; project files are limited to 100 MB.` Rejects invalid files and shows up to 3 error messages. Derived NURBS (non-uniform rational B-spline) data in the file is ignored and recomputed. |
| **Save** | Downloads the project JSON. Same file as **Export** > Project JSON. When the derived NURBS data would take the file above 100 MB, the file leaves it out (section [Export](#export)). A failure shows the red notice `Save failed: <reason>.` |
| **Export** | Opens the export dialog (section [Export](#export)). |
| **Undo** / **Redo** | Steps through the edit history, kept in memory only: at most 100 steps and at most 64,000,000 characters of serialized project (undo and redo together); a project above 640,000 characters keeps fewer steps, at least 1. **New** and **Open** are undoable. |
| **Help** | App version, workflow, controls, links to this wiki and to the source code. |

### Narrow screens

![Phone layout (Pixel 7): 3D view on top, section cards below](images/mobile-main.png)

At a window width of 860 px or less:

- The 3D view sits above the side panel: 42 % of the window height, at least 240 px.
- **Enlarge** appears in the 3D view. It hides the side panel and gives the 3D view the full height; a second tap restores the side panel.
- The section table turns into one card per section (3 columns, label above each value).
- The planform canvas is 260 px high.
- At a window width of 420 px or less, the 7 top-bar buttons stay in 1 row. The row scrolls sideways when it is wider than the window.

![Phone layout of the planform editor with the end line on](images/mobile-planform.png)

On touch screens (coarse pointer), buttons and input fields are at least 40 px high.

## Storage

- After every change the browser stores the project in `localStorage` under the key `wingdesigner.project.v1`. The next visit restores it.
- Only projects that pass the **Open** validation are saved. Otherwise the last valid project stays stored.
- A stored project that fails to load is kept under `wingdesigner.project.v1.rejected`. An error notice shows, and the wizard opens as on a first visit. Without room for that copy, the project stays under `wingdesigner.project.v1` and autosave stays off.
- The active tab is stored under `wingdesigner.tab`.
- Without a stored project (first visit), the wizard opens. Nothing is stored while this first-run wizard is open; a reload shows the wizard again.
- With blocked storage (private window), the project exists only in the open browser tab. Use **Save** to keep it.
- When the browser refuses the project (browsers keep about 5,000,000 characters per site), the red notice `Autosave is off: browser storage refused the project (… characters; browsers keep about 5,000,000 per site). Use Save to keep it.` shows once. The status bar shows `Autosave off: use Save` until an autosave succeeds again; then the notice `Autosave works again.` shows.
- While autosave fails, the key `wingdesigner.project.v1.stale` holds the time of the first failure. The next visit restores the last stored project and shows `This is the project as last saved; autosave stopped at … because browser storage was full, and later edits were not saved.`
- The undo history is not stored.

## Controls

| Action | Mouse | Touch |
| --- | --- | --- |
| Rotate 3D view | left drag | one-finger drag |
| Zoom 3D view | wheel or middle drag | pinch |
| Pan 3D view | right drag | two-finger drag |
| Move a point in the planform editor | drag the point | drag the point |
| Pan planform editor, airfoil preview or wizard preview | drag the background | drag the background |
| Zoom planform editor, airfoil preview or wizard preview | wheel (centred on the cursor) | pinch |
| Fit planform editor | double-click, or **Fit** | **Fit** |
| Fit airfoil preview | automatic on open; double-click | automatic on open; no fit button |
| Fit wizard preview | automatic after each input change; double-click | automatic after each input change; no fit button |
| Undo | Ctrl+Z (macOS: Cmd+Z) | **Undo** |
| Redo | Ctrl+Shift+Z or Ctrl+Y (macOS: Cmd) | **Redo** |

- Pick radius for points in the planform editor: 9 px with mouse or pen, 18 px with touch.
- Keyboard shortcuts are inactive while the focus is in an input field, text area or drop-down list, or while a dialog is open.
- Number fields apply a value on Enter, when the field loses focus, and on each arrow step. A non-numeric entry reverts to the previous value.
- One drag is one undo step: updates of the same drag less than 800 ms apart merge.

| 3D view button | Camera |
| --- | --- |
| **Iso** | From ahead of the leading edge, left and above |
| **Top** | From above (+z) |
| **Front** | From ahead of the leading edge (−x) |
| **Side** | From the left (−y) |
| **Fit** | Same direction as **Iso** |
| **Enlarge** | Only at widths ≤ 860 px; toggles the side panel |

**Iso**, **Top**, **Front**, **Side** and **Fit** also frame the whole wing.

## Wizard

![Wizard with the Glider preset: presets, 12 inputs including Tip, planform preview and key figures](images/wizard.png)

The wizard builds a complete project from 12 inputs (table below). It generates sections, airfoils, the trailing-edge setting, the wing tip setting and, for an elliptic planform, both guide curves. All values stay editable afterwards.

- Opens on the first visit (title "Start a new wing design") and with **New** (title "New wing design").
- Preselected preset: **Sport**. A click on a preset card loads its values.
- Airfoils are NACA (National Advisory Committee for Aeronautics) 4-digit or 5-digit sections. Valid codes: section [NACA generator](#naca-generator).

| Field | Range | Effect |
| --- | --- | --- |
| Project name | text | Default: preset name. Empty: `<span> mm wing` |
| Span (both halves) | 100 to 20,000 mm | Tip-to-tip span |
| Root chord | 10 to 3000 mm | Chord at y = 0 |
| Taper (tip / root chord) | 0.1 to 1.5 | Tip chord divided by root chord. Elliptic planform with flat tip: below 1. Elliptic planform with pointed tip: not used. |
| Sweep of the 25 % line | −45 to 60° | Sweep of the quarter-chord line; positive = swept back |
| Dihedral per half | −15 to 30° | Section z = y · tan(dihedral) |
| Tip twist (negative = washout) | −15 to 15° | Twist changes linearly from 0° at the root to this value at the tip |
| Number of sections | 2 to 8, integer | Sections evenly spaced from root to tip |
| Planform | **Straight taper**, **Elliptic (guide curves)** | Chord law, see below |
| Tip | **Flat**, **Pointed (1/200 scale)** | Flat: the wing ends at the tip section. Pointed: tip section chord = 1/200 of the chord at the previous section, at least 1 mm. |
| Root airfoil (NACA) | NACA code | Airfoil of every section except the tip |
| Tip airfoil (NACA) | NACA code | Airfoil of the tip section |

Chord laws (η = span fraction, 0 at the root, 1 at the tip; λ = taper; η_prev = span fraction of the section before the tip section):

| Planform | Tip | Chord c(η) | Guide curves |
| --- | --- | --- | --- |
| Straight taper | Flat | c_root · (1 + (λ − 1) · η) | off |
| Straight taper | Pointed | as Flat; tip section: max(c(η_prev) / 200, 1 mm) | off |
| Elliptic | Flat | c_root · √(1 − (1 − λ²) · η²) | nose line and end line on; 6 points each at η = 0, 0.3, 0.55, 0.75, 0.9, 1 |
| Elliptic | Pointed | c_root · √(1 − η²); tip section: max(c(η_prev) / 200, 1 mm) | nose line and end line on; 7 points each at η = 0, 0.3, 0.55, 0.75, 0.88, 0.96, 1; both lines end on the 25 % line |

Generated guide curves use **Through points** and degree 3.

Generated values:

| Value | Rule |
| --- | --- |
| Leading-edge x | 0.25 · c_root + y · tan(sweep) − 0.25 · c(η); the quarter-chord points lie on the sweep line |
| Rounding | 0.01 mm, 0.01° |
| Trailing edge | **Fixed thickness in mm**: 0.2 % of the root chord, at least 0.3 mm |
| Wing tip | **Settings** > **Wing tip** = the **Tip** field; tip profile scale 1 : 200 |

The preview shows the planform of both halves. The line below it lists wing area (dm²), aspect ratio, MAC with its span position, and tip chord.

The line turns red, lists the problems, and **Create design** is disabled when:

- a value is outside its range (column Range);
- **Number of sections** is not an integer;
- a root or tip airfoil is not a valid NACA code;
- **Elliptic** with **Flat** tip has taper ≥ 1 (`An elliptic planform needs taper < 1.`);
- the wing has a build error (section [Checks](#checks)).

| Preset | Span mm | Root chord mm | Taper | Sweep ° | Dihedral ° | Tip twist ° | Sections | Planform | Tip | Root / tip airfoil |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Trainer | 1400 | 250 | 1 | 0 | 3 | 0 | 2 | straight | flat | 2412 / 2412 |
| Sport | 1200 | 240 | 0.6 | 0 | 1.5 | −1 | 2 | straight | flat | 2412 / 2410 |
| Glider | 2000 | 200 | 0.45 | 0 | 4 | −1.5 | 3 | elliptic | flat | 2410 / 2408 |
| Swept flying wing | 1200 | 280 | 0.45 | 25 | 0 | −4 | 3 | straight | flat | 23112 / 0010 |
| Plank | 1000 | 220 | 0.8 | 0 | 1 | 0 | 2 | straight | flat | 23112 / 23112 |
| Tail surface | 500 | 130 | 0.7 | 5 | 0 | 0 | 2 | straight | flat | 0009 / 0009 |

| Button | Effect |
| --- | --- |
| **Create design** | Replaces the current project. **Undo** restores the previous one. |
| **Cancel** | Keeps the current project. |
| **Skip (open sample wing)** | First visit only, in place of **Cancel**. Keeps the sample wing "Sport wing 1500": 3 sections, 1500 mm span, NACA 2412 / 2410, trailing edge fixed at 0.5 mm. |

## Sections

![Sections tab with the 3 sections of the Glider preset](images/sections.png)

A section places one airfoil:

- in the plane y = const;
- with its leading edge at (x, y, z);
- scaled to the chord;
- rotated by the twist about the pivot (**Settings** > **Twist pivot**, default 0.25 = 25 % of the chord).

Computation: [[Geometry|Geometry]].

| Column | Unit | Step | Limit | Effect |
| --- | --- | --- | --- | --- |
| # | – | – | – | Section number; 1 = root |
| Airfoil | – | – | project airfoils | Airfoil of this section |
| y | mm | 5 | 0 to 1,000,000 | Span position. Sections are re-sorted by y. |
| x | mm | 1 | −1,000,000 to 1,000,000 | Leading-edge position; positive = aft (sweep back) |
| z | mm | 1 | −1,000,000 to 1,000,000 | Leading-edge height (dihedral) |
| Chord | mm | 1 | 1 to 100,000 | Chord length (airfoil scale) |
| Twist | ° | 0.1 | −360 to 360 | Rotation about the pivot; positive = leading edge up. The UI labels the unit `deg`. |

| Button | Effect |
| --- | --- |
| **+** | Inserts a section halfway to the next one: mean of y, x, z, chord and twist; airfoil of the current section. On the tip row: copy of the tip, one panel length further out (at least 10 mm). Disabled at 20,000 sections (tooltip `At most 20,000 sections: more run a desktop browser tab out of memory.`). |
| **×** | Deletes the section. Disabled while 2 sections remain. |

**+** refuses the insert with an error notice when:

- no number lies between the y values of the two neighbouring sections: `No span position lies between y = … mm and y = … mm. Move the two sections apart first.`
- the copy of the tip would lie beyond y = 1,000,000 mm: `A section beyond the tip would lie beyond y = 1000000 mm.`

Tooltip of **+**: `Insert a section after this one`. When the insert gives more than 200 sections, the tooltip adds the estimate of section [Project size](#project-size): `Insert a section after this one. With … sections, each change takes … and … of browser memory.`

- A y that another section already has is rejected with an error notice (`Another section already lies at y = … mm; …`). The field keeps its previous value.
- A typed value outside the limit becomes the nearest limit, e.g. a negative y becomes 0, a chord below 1 mm becomes 1 mm. Arrow steps stop at the limits. The limits are the same as for project files ([[File Formats|File-Formats]]).
- A click anywhere in a row outside its input fields, lists and buttons selects the section, also in the card layout of narrow screens. The row is marked, the 3D view draws the section outline in red, and the planform editor draws its chord line and handles in red. Selecting does not rebuild the wing: it takes 2 ms of JavaScript at 200 sections and 100 to 110 ms at 20,000 sections.
- Airfoil lists: with more than 20,000 list entries (sections × project airfoils), each list holds only its chosen airfoil until it is focused or pressed; then it lists all project airfoils.
- When the root or tip y changes, the guide point y values scale linearly to the changed root-to-tip range.
- Between sections, x, z, chord, twist and the airfoil shape are interpolated along the span (**Settings** > **Spanwise interpolation**).

With a guide curve on, the wing uses the guide value instead of the typed one. The value in use appears below the input as `guide: 12.3` when it differs by more than 0.05 mm:

| Guide curves on | Overridden column |
| --- | --- |
| nose line or end line | x |
| nose line and end line | x and Chord |

With **Settings** > **Wing tip** = Pointed, the wing does not use the typed tip chord. The Chord cell of the tip row shows the tip chord in use with 2 decimals, e.g. `tip: 1.25`. `(min.)` follows when the 1 mm floor applies, e.g. `tip: 1.00 (min.)`.

## Planform

![Planform editor: nose line and end line on (elliptic planform), guide point table](images/planform.png)

The planform editor shows the half wing from above: span y to the right, chord x downwards, y = 0 on the vertical axis. The grid label gives the grid spacing in mm (1-2-5 series, at least 60 px apart: 60 to 150 px).

| Toolbar control | Effect |
| --- | --- |
| **Fit** | Fits the sections, the points and curves of the guide curves that are on, the built outline and, with **Mirror** on, the mirror image into the canvas |
| **+** / **−** | Zoom by factor 1.25 / 0.8 about the canvas centre |
| **Mirror** | Grey mirror image of the other half. Display only; on by default; not stored. |

| Handle | Visible when | Drag effect |
| --- | --- | --- |
| Blue square at a section leading edge | nose line off | Moves x and y of the section; x stays within ±1,000,000 mm. The trailing edge stays in place (end line on: the end line at the changed y); the chord changes within 1 to 100,000 mm. y stays 1 mm away from the neighbouring sections (neighbours closer than 4 mm: a quarter of the gap). The root section keeps its y. The tip section y stays at or below 1,000,000 mm. |
| Blue circle at a section trailing edge | end line off | Sets the chord (1 to 100,000 mm) |
| Diamond on a guide curve (green: nose line, brown: end line) | guide curve on | Moves the point; x stays within ±1,100,000 mm. Root and tip points move in x only. Interior points stay 0.5 mm away from their neighbours in y (neighbours closer than 2 mm: a quarter of the gap). |

- Dragged values are rounded to 0.1 mm.
- The line below the canvas shows the values during a drag.
- The selected section and the selected guide point are drawn in red. A click on the background clears the guide point selection.

### Guide curves

A guide curve is a 2D NURBS curve in the planform plane (x, y). The **nose line** sets the leading edge, the **end line** sets the trailing edge, including the span between sections. Computation: [[Geometry|Geometry]].

| Nose line | End line | Leading-edge x | Chord |
| --- | --- | --- | --- |
| off | off | section x, interpolated | section chord, interpolated |
| on | off | nose line | section chord, interpolated |
| off | on | end line − chord | section chord, interpolated |
| on | on | nose line | end line − nose line |

Constraints and errors:

- The y range of a guide curve is stretched linearly onto the root-to-tip span. Root and tip points follow the root and tip sections.
- Guide point x: within ±1,100,000 mm. This is the trailing-edge x of a section at x = 1,000,000 mm with a chord of 100,000 mm. A switched-off, unedited end line lies on the section trailing edges.
- Error: point y values do not increase strictly from root to tip.
- Error: the curve turns back in y (checked at 401 curve points). Move the points apart or use **Control points**.
- Error: a control point of the curve lies beyond x = ±1,200,000 mm (guide limit plus the largest chord). With **Through points**, points unevenly spaced in y make the curve overshoot. Space the points more evenly in y or use **Control points**.
- Error: chord below 1 mm at a checked span position. With both guide curves on this means nose line and end line come closer than 1 mm, touch or cross. Checked at 257 evenly spaced span positions plus every station, guide control point and guide knot (the checked span positions).
- Error: at a checked span position the leading-edge x, the trailing-edge x or z lies beyond ±1,200,000 mm, or the chord exceeds 100,000 mm. Example: nose line at x = −1,100,000 mm, end line at x = 1,100,000 mm (chord 2,200,000 mm).
- With **Wing tip** = Pointed, the chord in the last panel stays at or above the tip chord. Nose line and end line may then meet at the tip.
- Stations: every section. With a guide curve on or with **Smooth**, each panel is divided into **Spanwise stations per panel** intervals (default 8, cosine spacing); Glider preset: 17 stations.
- Loft grid: stations × (2 · N + 1) profile points before added stations (N = **Chordwise stations per surface**). Stations: panels × **Spanwise stations per panel** + 1 with a guide curve on or with **Smooth**, otherwise one per section. **Settings** shows the count (`Loft grid: … points.`).
- Above 60,000 grid points the build adds the `Large project` warning (section [Project size](#project-size)). Up to 5,000,000 grid points the wing uses the settings as entered.
- Above 5,000,000 grid points the wing uses fewer intervals per panel, with a warning. When one interval per panel still exceeds 5,000,000 grid points, the build stops with an error ([Checks](#checks)).
- Examples with **Smooth**, 40 intervals per panel and N = 200: 20 sections: 761 stations, 305,161 grid points; 1,000 sections: 12 intervals per panel, 11,989 stations, 4,807,589 grid points. With N = 200, more than 12,468 sections exceed 5,000,000 grid points at one station per panel; with N = 60 (default), 20,000 sections give 2,420,000 grid points.
- Added stations: up to 32 (at most 6 rounds). The app adds them at the checked span positions where the wing surface deviates from the intended profile by more than 0.5 mm, or 10 % of the local chord if that is smaller (3D distance). Compared points: leading edge, upper trailing-edge point and every k-th chord station per surface, k = **Chordwise stations per surface** / 6, rounded down (5 chord stations at the default 60). Twist between stations also adds stations: Swept flying wing preset, 3 sections, 2 added stations.
- Errors between stations, checked at the checked span positions and at 0.25, 0.5 and 0.75 of every interval between neighbouring stations: the fitted surface chord, measured along the intended chord direction, falls below 0.9 mm or reverses (surface folds or narrows); the local thickness at a compared chord station falls below 0 (surface turns inside out); the local thickness at a compared chord station between 1 % and 99 % chord is at most 0.001 % of the chord (zero thickness).
- The added stations and the deviation warning use the checked span positions only, not the points at 0.25, 0.5 and 0.75 of the station intervals.

Controls per guide curve (boxes **Nose line (leading edge)** and **End line (trailing edge)**):

| Control | Available | Values | Default | Effect |
| --- | --- | --- | --- | --- |
| **Use guide curve** | always | on, off | off | On: the curve sets the edge. A guide that was never edited starts at the current section edges; an edited guide keeps its points. Off: the edge follows the sections. While off, an unedited guide follows the section edges; an edited guide keeps its points. Edited: a point was moved (drag or point table), added or removed. Guide curves from the wizard count as not edited until the page is reloaded or the project is opened from a file: switching one off and on again replaces its points with the section edges (**Undo** restores them). After a reload or **Open**, a guide stored without the edited state counts as edited when its points differ from the section edges: another point count, or a coordinate more than 1e-9 mm off. |
| **Mode** | guide curve on (otherwise disabled) | **Through points**, **Control points** | **Through points** | **Through points**: the curve passes through every point. **Control points**: the points form the control polygon (dashed line). The curve starts and ends at the first and last point and otherwise lies inside the convex hull of the control polygon. |
| **Degree** | guide curve on (otherwise disabled) | 1 to 5 | 3 | Polynomial degree; limited to the point count − 1 |
| **Add point** | guide curve on (otherwise hidden); disabled at 20,000 points (tooltip `At most 20,000 points per guide curve.`) | – | – | Inserts a point halfway across the widest gap in y. Tooltip: `Add a point in the widest gap`; when the curve would get more than 500 points, `Add a point in the widest gap. With … points, each change takes … and … of browser memory.` (section [Project size](#project-size)) |
| **Remove selected point** | guide curve on (otherwise hidden); enabled while an interior point is selected | – | – | Deletes the selected interior point. Root and tip points cannot be deleted. |
| **Reset to sections** | guide curve on (otherwise hidden) | – | – | Moves all points to the section edges and clears the edited state |
| Point table | guide curve on (otherwise hidden) | x, y in mm | – | x editable for every point, within ±1,100,000 mm; y editable for interior points. Root and tip y are read-only. |

## Airfoils

![Airfoils tab: project airfoils, upload, NACA generator, library](images/airfoils.png)

### Project airfoils

| Element | Effect |
| --- | --- |
| List entry | Outline, name, point count, attribution, `unused` when no section uses the airfoil |
| **View** | Opens the preview; name and attribution are read-only. The only button is **Close**. |
| **.dat** | Downloads the airfoil as Selig `.dat` file with 7 decimal places |
| **×** | Removes the airfoil. Disabled while a section uses it. |
| **Remove unused** | Removes every airfoil that no section uses |

**Add to project** adds no second entry, keeps the existing entry and discards the new name and attribution when:

- a project airfoil has the same name and the same points;
- a project airfoil is a generated NACA section with the same code and the same **Closed trailing edge** setting (any name).

Limits of the project airfoils (section [Project size](#project-size)):

| Limit | Airfoils tab (upload, **Check pasted text**, NACA generator, library) | **Open** |
| --- | --- | --- |
| 10,000 airfoils | At 10,000 airfoils no preview opens: red notice `The project holds 10,000 airfoils, the limit; "Remove unused" frees places.` | More airfoils: `At most 10,000 airfoils are supported (found …).` |
| 1,000,000 airfoil points in all | An airfoil that would take the total above 1,000,000 opens no preview and is not added: red notice `With this airfoil the project airfoils hold … points; the limit is 1,000,000. "Remove unused" frees points.` | More points: `The airfoils hold … points together; the limit is 1,000,000.` |
| 100,000 points per airfoil | Error `too-many-points` in the preview ([[File Formats|File-Formats]]) | More points: `Airfoil … has … points; the limit is 100,000.` |

- Above 200 airfoils or above 100,000 airfoil points in all, the wing build adds the `Large project` warning.
- Lists and messages show the first 200 characters of a longer airfoil name, followed by `…`.

### Upload

| Input | Rule |
| --- | --- |
| Files | `.dat`, `.txt`, `.cor`, `.xml`, `.htm`, `.html`, `.csv`. Drop them on the drop zone or use **Choose files**. Several files open one preview each, in order. A file above 20 MB is not read: red notice `<file>: … MB; airfoil files are limited to 5,000,000 characters.` |
| Pasted text | Paste coordinates into the text area, then **Check pasted text**. |
| Text encoding | UTF-8 (Unicode Transformation Format, 8-bit); a file that is not valid UTF-8 is read as Windows-1252. |
| Layouts and checks | Selig, Lednicer, x/upper/lower table, XML (Extensible Markup Language), HTML (HyperText Markup Language): see [[File Formats|File-Formats]] |

![Upload preview of a percent table with decimal commas: file points, NURBS curve, check messages](images/upload-preview.png)

| Preview element | Content |
| --- | --- |
| Plot | Line: NURBS interpolation; with a sanity-check error, straight segments through the file points. Dots: file points (**Show data points**, default on). Red circles: location of a reported problem. Pan and zoom as in the planform editor. |
| **Name** | From the name line of the file, otherwise the file name. Editable. |
| **Source / attribution** | Stored in the project file. Pre-filled for names starting with `HS` plus space or hyphen (`HS 3.4`, `HS-1.4`): `Hartmut Siegmann, www.aerodesign.de`. Pre-filled for names starting with `MH`, an optional space or hyphen and a digit (`MH45`, `MH 60`): `Martin Hepperle, www.mh-aerotools.de`. Both matches are case-insensitive. Pre-filled for a bundled library file with its author from `index.json`. |
| Format line | Detected format and point count |
| Messages | **Error**: blocks adding. **Warning**: adding allowed. **Info**: facts, e.g. thickness, camber and trailing-edge gap in % chord, or the number of removed points that lie closer than 1e-9 chord to the previous point. Above 5,000 points: warning `… points (warning above 5,000): the checks and the first build of a wing that uses the airfoil take ….` A surface that runs back in x at more than 50 points: error `The upper surface runs back in x at … points; the limit is 50.` (`lower` likewise). After the sanity checks pass, the preview also rejects a NURBS curve that crosses itself or runs back in x, and points on which the NURBS interpolation fails (`The NURBS interpolation through the points failed (…).`). All three are error `curve-shape` ([[File Formats|File-Formats]]). |
| **Add to project** | Adds the airfoil. Disabled and labelled **Cannot add (errors)** while an error exists. |

### NACA generator

| Control | Values | Effect |
| --- | --- | --- |
| Designation field | 4 or 5 digits, prefix `NACA` optional (`2412`, `NACA 23012`) | Airfoil code |
| **Closed trailing edge** | on, off (default off) | Off: standard thickness equation, open trailing edge. On: coefficient −0.1036 instead of −0.1015, closed trailing edge. |
| **Preview** | – | Opens the preview dialog |

| Series | Valid code |
| --- | --- |
| 4-digit | digits 3–4 (thickness) above 00; digits 1 and 2 both 0 or both non-zero |
| 5-digit, standard | digit 1: 1–9; digit 2: 1–5; digit 3: 0; digits 4–5 above 00 |
| 5-digit, reflex | digit 1: 1–9; digit 2: 2–5; digit 3: 1; digits 4–5 above 00 |

- Generated airfoils have 161 points (81 per surface, cosine spacing) and the name `NACA <code>`.
- The open and closed variants of one code carry the same name. Rename one in the **Name** field of the preview to tell them apart in the section list.

### Library

- **Filter library** matches the name, category and use text.
- The library holds 17 generated NACA sections and 6 bundled coordinate files (`public/airfoils/index.json`). The list shows the NACA sections first, then the files in index order.
- Text under each name: NACA section: category, use, `generated`. Bundled file: category, use text, author, license identifier.
- Each entry: **Preview** opens the preview dialog. NACA entries follow the **Closed trailing edge** checkbox of the NACA generator. A bundled file loads from `airfoils/<file>` on the app's own address.
- **Add to project** on a bundled file stores the **Source / attribution** field (pre-filled with the author), the license identifier, the source address and the terms address in the project airfoil (`source` object, [[File Formats|File-Formats]]).

NACA sections:

| Code | Category | Use |
| --- | --- | --- |
| 0006 | Symmetric | Thin tail surfaces |
| 0008 | Symmetric | Tail surfaces |
| 0009 | Symmetric | Tail surfaces, fins |
| 0010 | Symmetric | Tail surfaces, flying-wing tips |
| 0012 | Symmetric | Aerobatic wings, rudders |
| 0015 | Symmetric | Thick aerobatic wings |
| 2408 | Cambered | Thin sport wings |
| 2410 | Cambered | Sport wings, tip sections |
| 2412 | Cambered | Trainers and sport models |
| 2415 | Cambered | Slow trainers |
| 4412 | Cambered | Slow flyers, high lift |
| 4415 | Cambered | Slow flyers, scale models |
| 6409 | Cambered | High-lift, low-speed models |
| 23012 | Cambered | Scale and sport models |
| 23015 | Cambered | Thick scale wings |
| 23112 | Reflex | Reflexed 5-digit section (flying-wing experiments) |
| 24112 | Reflex | Reflexed 5-digit section |

Bundled files (use text shortened; thickness from the use text):

| Name | Category | Use | Thickness | Points | Source | License identifier |
| --- | --- | --- | --- | --- | --- | --- |
| Clark Y | Cambered | Model aircraft from free-flight gliders to radio-controlled scale models | 11.7 % chord | 33 | NACA Report No. 502, Table I; section by Virginius E. Clark | `public-domain` |
| NACA 8-H-12 | Reflex | Helicopter rotor blades; full-size tailless gliders Kasper Bekas and Brochocki BKB-1; use on models not documented in the sources checked | 12.0 % chord | 51 | NACA Technical Note 1998, Table I | `public-domain` |
| NACA M-6 | Reflex | Reflexed, pitch-stable section; candidate section for flying wings | 12.0 % chord | 35 | NACA Report No. 221, Table XXIX | `public-domain` |
| RAF 34 | Cambered | Full-size Comper Streak and, modified, de Havilland DH-98 Mosquito; scale models of such aircraft | 12.6 % chord | 33 | Royal Aircraft Establishment (RAE) table in NACA Report No. 286 | `public-domain` |
| S9104 | Cambered | Heavy-lift and high-lift section | 12.1 % chord | 81 | Michael Selig, University of Illinois Urbana-Champaign | `CC-BY-4.0` |
| USA 35B | Cambered | Full-size Piper J-3 Cub and PA-18 Super Cub; scale models of these aircraft | 11.6 % chord | 33 | NACA Report No. 233, Table XXXVI | `public-domain` |

- Source, legal basis, conditions and attribution text per file: [NOTICE.md](https://github.com/subtilitas/Wingdesigner/blob/main/public/airfoils/NOTICE.md).
- Clark Y, NACA 8-H-12, NACA M-6, RAF 34 and USA 35B: public domain in the United States. Their status outside the United States is not established.
- S9104: Creative Commons Attribution 4.0 International license (CC BY 4.0). The project file keeps the attribution. The `.dat` download and the 3D model files of [Export](#export) carry none; whoever shares such a file made with S9104 adds the attribution text from NOTICE.md.
- RAF 34: 7 values of the source scan are uncertain, by up to 0.20 % chord (0.40 mm at 200 mm chord). NOTICE.md lists them.
- Clark Y and USA 35B keep the published base line: the leading edge lies 3.50 % and 2.76 % chord above the x axis. The preview shows the warning `The line from the leading edge to the trailing edge is inclined by -1.97 degrees; …` (USA 35B: -1.51). Twist refers to the x axis of the file: at the same twist, the chord line of Clark Y is 1.97° and that of USA 35B 1.51° more nose-up than that of a section with its chord on the x axis.
- Not bundled: share-alike data (JX library, Creative Commons Attribution-ShareAlike 4.0), copyleft data (Mark Drela, GNU General Public License 2.0 or later) and the PROFOIL test sections. Decisions with reasons: [RECORD.md](https://github.com/subtilitas/Wingdesigner/blob/main/RECORD.md).

### External sources

The box **More airfoils (external, not bundled)** links to 3 collections. The app bundles no files from them; the bundled S9104 file is made from the designer's own page, not from the University of Illinois Urbana-Champaign (UIUC) database. Download a file there, then load it in **Upload**. Terms and quotes: [[Airfoil Sources|Airfoil-Sources]].

| Link | Content | Terms (summary) |
| --- | --- | --- |
| aerodesign.de - Hartmut Siegmann | HS airfoils and catalogues for planks, swept flying wings and gliders | Private, club, small-business and scientific use with name and source; large series and industrial use need a written agreement; redistribution by third parties partly restricted |
| MH-AeroTools - Martin Hepperle | MH airfoils, e.g. MH 45 and MH 60 for flying wings, MH 32 for gliders | Personal use; publications cite the source; a recompilation must not be sold above production cost |
| UIUC Airfoil Coordinates Database (University of Illinois Urbana-Champaign) | About 1,650 airfoils in Selig format (count stated on the coordinates page) | No license stated for the coordinate files; the rights of each designer apply |

- The notes in the app read "About 1,600 airfoils" (UIUC) and "commercial use needs written permission" (aerodesign.de). The quoted terms on [[Airfoil Sources|Airfoil-Sources]] apply.

## Settings

![Settings tab: Geometry group with Wing tip, Resolution group](images/settings.png)

| Group | Setting | Values | Default | Effect |
| --- | --- | --- | --- | --- |
| Geometry | **Project name** | text | preset name | Name in the project file; base of the file names of **Save** and **Export**. `.dat` downloads use the airfoil name. |
| Geometry | **Spanwise interpolation** | **Linear between sections (straight panels)**, **Smooth (natural cubic spline through sections)** | Linear | Blending of section values along the span. See the list below. |
| Geometry | **Twist pivot (fraction of chord)** | 0 to 1, step 0.05 | 0.25 | Chord point the twist rotates about |
| Geometry | **Trailing edge** | **As in the airfoil files**, **Closed (sharp)**, **Fixed thickness in mm** | Fixed thickness (wizard, sample wing); As in the airfoil files for project files without this setting | Trailing-edge gap of every station |
| Geometry | **Wing tip** | **Flat (cut at the tip section)**, **Pointed (tip profile scaled down)** | Flat; wizard: its **Tip** field | Flat: the wing ends at the tip section. Pointed: see the list below. |
| Geometry | **Tip profile scale 1 : N of the previous section chord** | N = 100 to 1000, step 50 | 200 | Shown only with **Pointed** |
| Geometry | **Trailing-edge thickness (mm)** | ≥ 0, step 0.1 | wizard: 0.2 % of the root chord, at least 0.3; sample wing: 0.5; project file without the value: 0.4 | Shown only with **Fixed thickness in mm** |
| Resolution | **Chordwise stations per surface** | 16 to 200, step 4 | 60 | Airfoil resampling: N stations give 2 · N + 1 points per outline (60 → 121) |
| Resolution | **Spanwise stations per panel with guides or smooth mode** | 3 to 40 | 8 | Intervals per panel, cosine spacing; used only with a guide curve on or with Smooth. Fewer intervals only above 5,000,000 loft grid points (section [Guide curves](#guide-curves)). |
| Resolution | **Profile parametrization** | **Centripetal (recommended)**, **Chord length**, **Uniform** | Centripetal | Parameter spacing of the airfoil NURBS interpolation, in the wing build and in the airfoil preview |
| Display | **Show mirrored half (y < 0)** | on, off | on | Display only (3D view). Checks, status bar and wizard always report both halves. Stored in the project. |
| Display | **Show NURBS control net** | on, off | off | 3D view only; not stored |
| Display | **Show section outlines** | on, off | on | 3D view only; not stored |

Below **Spanwise stations per panel** a note gives the loft grid points of the current settings (section [Guide curves](#guide-curves)), e.g. Glider preset: `Loft grid: 2,057 points.`

- After a reduction above 5,000,000 grid points the note adds `, … spanwise stations per panel instead of …`.
- Above 60,000 grid points the note turns to the warning colour and adds the estimate of section [Project size](#project-size): `Loft grid: … points; above 60,000, each change takes … and … of browser memory.`

Spanwise interpolation:

- **Linear** without guide curves: stations at the sections plus added stations (section [Guide curves](#guide-curves)); straight lines between stations (spanwise degree 1).
- **Linear** with a guide curve on: **Spanwise stations per panel** intervals per panel; degree 3 within each panel, with a kink allowed at each section.
- **Smooth**: section values follow one natural cubic spline through all sections; **Spanwise stations per panel** intervals per panel (default 8); spanwise degree 3.
- **Smooth** error: an interpolated value lies more than 2 × the range of its section values outside that range. Checked values: leading-edge x (no guide curve on), chord (not both guide curves on), z, twist, and the height of every resampled profile point except the 2 trailing-edge points. Checked at the checked span positions ([Guide curves](#guide-curves)). Typical cause: unevenly spaced sections.
- With 2 sections both give the same x, z, chord and twist.
- The surfaces differ where the airfoil or the twist changes along the span. A chord change at the same place increases the difference.
- With 3 or more sections the surfaces also differ where x, z, chord or twist change slope at a section. Example: Sport preset with 3 sections, middle chord 150 mm instead of 192 mm, one airfoil, no twist: 8.08 mm.
- One airfoil, no twist and a chord that changes linearly from root to tip give no difference.
- Largest distance between the 2 surfaces at the same surface parameters, wizard presets: Swept flying wing 0.56 mm, Sport 0.34 mm, Glider 0.20 mm, Trainer 0.00 mm, Plank 0.00 mm, Tail surface 0.00 mm.
- Computation: [[Geometry|Geometry]].

Pointed tip (**Wing tip** = Pointed):

- Tip chord = max(c_prev / N, 1 mm). c_prev is the chord in use at the section before the tip.
- The typed tip chord is not used.
- In the last panel the chord stays at or above the tip chord. Converging guide curves end in the scaled tip profile.
- With both guide curves on, their gap at the tip sets the tip chord when it is wider than the scaled tip chord. A gap more than 0.5 mm wider gives a warning.
- Glider preset with **Tip** = Pointed: tip chord 1.00 mm (1 mm floor), 23 stations (17 + 6 added), largest deviation at the checked span positions 0.16 mm, no warning. The other wizard presets with **Tip** = Pointed also build without a warning.
- Within 2 mm of a pointed elliptic tip the loft deviates up to 0.8 mm from the intended surface between stations, more than 10 % of the local chord there. The deviation warning does not cover these positions.

Trailing-edge rules:

- Fixed thickness above 5 % of the local chord: limited to 5 % at that station. A warning gives the station count. Stations in the last panel of a pointed tip are limited without warning.
- Mixed trailing edges, condition: not every station is closed, and at least one station has a trailing-edge gap below 0.01 mm. Examples: **As in the airfoil files** with airfoils closed on some stations and open on others; **Fixed thickness in mm** above 0 and below 0.01 mm.
- Mixed trailing edges, effect: these stations open to 0.01 mm, with a warning. The warning says `closed on some stations and open on others` also when no station is closed.
- Error: the setting pulls the upper surface below the lower surface. Condition: **Closed** or **Fixed thickness** on an airfoil that is thinner inside than its trailing-edge gap.
- Error: the setting makes upper and lower surface touch. Condition: **Closed** or **Fixed thickness**, thickness at most 0.001 % of the chord between 1 % and 99 % chord.

Effect of the resolution on computing time and STEP (Standard for the Exchange of Product model data) file size:

| Case | Chordwise stations | Build (airfoils cached) | STEP export | STEP size |
| --- | --- | --- | --- | --- |
| Glider preset, elliptic guides, 17 spanwise stations, both halves | 60 | 36 ms | 6 ms | 445 KB |
| Glider preset, elliptic guides, 17 spanwise stations, both halves | 200 | 89 ms | 19 ms | 1398 KB |

- Mean of 10 runs after 2 warm-up runs (STEP export: 3 runs); Node.js 24.21, Intel Xeon x86-64, 2.10 GHz, 4 cores, load average 3.3 (other processes running); 2026-09-29.
- 1 KB = 1024 bytes.
- Large projects in the browser: section [Project size](#project-size).
- Full conditions and more cases: [[Development|Development]], section Build and export times.
- Phones: not measured.

## Checks

![Checks tab with the planform statistics of the Glider preset](images/checks.png)

| Row | Content |
| --- | --- |
| Error and warning list | Every wing error and warning, or `No errors or warnings.` |
| Span | 2 × tip y, in mm |
| Wing area | both halves, in dm² |
| Aspect ratio | span² / area |
| Mean aerodynamic chord (MAC) | mm |
| MAC position | span position y of the MAC, and x of its leading edge |
| 25 % MAC (geometric reference) | x of the point at 25 % of the MAC |
| Root / tip chord | mm |
| Surface | NURBS degree (chordwise × spanwise) and control point count |
| Trailing edge | `closed` or `open` |

- Area, MAC and MAC position: 5-point Gauss-Legendre quadrature of the intended planform (chord and leading edge over y) in each interval between neighbouring stations. Exact for straight panels, and for **Smooth** with a flat tip and without guide curves.
- With guide curves, quadrature error of the wing area against the midpoint rule with 200,000 intervals: −2.8 × 10⁻⁷ % (Glider preset), 3.1 × 10⁻⁵ % (Glider preset, pointed tip). Other values: [[Geometry|Geometry]].
- Root section off y = 0: the gap between the halves counts to the span, not to the area.
- The 25 % MAC point is a geometric reference. It is not a neutral-point or centre-of-gravity calculation.

| Message | Severity | Condition |
| --- | --- | --- |
| Airfoil "…": … | error | the airfoil fails the sanity checks ([[File Formats|File-Formats]]), e.g. in an opened project file. With **Profile parametrization** **Chord length** or **Uniform**, every `Airfoil "…"` message ends with `Settings > Profile parametrization "centripetal" follows the points more closely.` |
| Airfoil "…": the NURBS interpolation failed (…). | error | the airfoil NURBS interpolation fails |
| Airfoil "…": the NURBS curve through the points crosses itself near x = … % chord; … | error | the curve through the airfoil points crosses itself. The crossing splits the outline into 2 parts; the part with the smaller bounding-box diagonal has a mean width (area / bounding-box diagonal) above 0.05 % of the chord. An airfoil used at a chord above 200 mm also fails when that width exceeds 0.1 mm at its largest chord; the message then reads `…; the loop is … mm wide at … mm chord, above 0.1 mm. …` |
| Airfoil "…": the surface runs back in x by … % chord near x = … % chord; … | error | the curve through the airfoil points runs back in x by more than 0.01 % of the chord. In the parser test with 1,964 real airfoil files, this check rejects 4 files with **Centripetal**, 12 with **Chord length** and 82 with **Uniform** ([[Airfoil Sources|Airfoil-Sources]], section Parser test). |
| Airfoil "…": The upper surface runs back in x at … points; the limit is 50. (also `lower`) | error | a surface of the airfoil runs back in x at more than 50 points (check `folds`, [[File Formats|File-Formats]]) |
| Nose line: … / End line: … | error | guide points not strictly increasing in y, or the curve turns back in y |
| Nose line: the curve through the points reaches x = … mm, beyond ±1200000 mm; space the points more evenly in y or use control-point mode. (also End line) | error | a control point of the guide curve lies beyond x = ±1,200,000 mm |
| Section values give non-finite coordinates at y = … mm; … | error | leading-edge x, chord, z or twist of a checked span position gives a non-finite coordinate, e.g. **Smooth** with 2 sections 5e-324 mm apart. **Open** accepts such a file; the **Sections** table rejects a y less than 1e-6 mm from another section. |
| At y = … mm the wing leaves the project limits (leading-edge x … mm, z … mm, chord … mm; limits ±1200000 mm and 100000 mm chord). Check the guide curves, or use linear interpolation. | error | at a checked span position: leading-edge x, trailing-edge x or z beyond ±1,200,000 mm, or chord above 100,000 mm |
| Smooth spanwise interpolation overshoots at y = … mm: … is …, while the sections range from … to … . The sections are unevenly spaced (smallest gap … mm). … | error | **Smooth**: an interpolated value (leading-edge x, chord, z, twist or a profile point height) lies more than 2 × the section range outside that range |
| The blended profile has negative thickness at y = … mm, x = … % chord (… % chord); … | error | **Smooth**: the blended profile at a checked span position has negative thickness at a chord station (overshoot between unevenly spaced sections). Behind 99 % chord, crossings up to 0.01 % of the chord, at most 0.1 mm, count as zero thickness. |
| The resampled profile has negative thickness at y = … mm, x = … % chord (… % chord): … | error | **Linear**: upper and lower surface of a section airfoil cross at a chord station. Behind 99 % chord, crossings up to 0.01 % of the chord, at most 0.1 mm, count as zero thickness. |
| The trailing-edge setting pulls the upper surface below the lower surface at y = … mm (… % chord); … | error | **Closed** or **Fixed thickness** on an airfoil that is thinner inside than its trailing-edge gap |
| Upper and lower surface of the blended profile touch at y = … mm, x = … % chord (thickness … % chord); … | error | **As in the airfoil files**: thickness at most 0.001 % of the chord between 1 % and 99 % chord |
| The trailing-edge setting makes upper and lower surface touch at y = … mm, x = … % chord (thickness … % chord); … | error | **Closed** or **Fixed thickness**: thickness at most 0.001 % of the chord between 1 % and 99 % chord |
| Chord drops to … mm at y = … mm; nose line and end line must not touch or cross. | error | chord below 1 mm at a checked span position. Flat tip with the minimum at the tip and above −0.01 mm: the message adds `For a tip that ends in a point, set Settings > Wing tip to Pointed.` |
| The fitted surface has non-finite coordinates; … | error | a control point coordinate of the fitted surface is not a finite number |
| The fitted surface turns inside out between stations at y = … mm (local thickness … % chord): … | error | local thickness of the fitted surface below 0 at a compared chord station; checked at the checked span positions and at 0.25, 0.5 and 0.75 of every station interval |
| The fitted surface has zero thickness between stations at y = … mm (local thickness … % chord): … | error | local thickness of the fitted surface at most 0.001 % of the chord at a compared chord station between 1 % and 99 % chord; same positions |
| The fitted surface folds or narrows between stations at y = … mm (chord … mm along the intended chord direction, minimum 1 mm): … | error | fitted surface chord below 0.9 mm or reversed after the added stations; same positions |
| The loft surface crosses itself at y = … mm near x = … mm: … | error | a surface row crosses itself between the resampled points; mean width of the smaller part as for airfoils, above 0.05 % of the local chord or above 0.1 mm, whichever is smaller. Tested rows: every section, halfway between 2 sections, and halfway between 2 neighbouring stations in the 64 widest station intervals. |
| The loft grid needs … points with one station per panel (… sections, … chord samples); the limit is 5,000,000. Reduce the chord samples or the sections. | error | sections × (2 · **Chordwise stations per surface** + 1) above 5,000,000, e.g. more than 12,468 sections at 200 chord samples ([Guide curves](#guide-curves)) |
| Internal error: … | error | exception in the wing build (program defect) |
| Large project: … (warning above …). Each change takes … and … of browser memory. | warning | a project size above its warning threshold; the message lists every such size, e.g. `1,000 sections (warning above 200) and 121,000 loft grid points (warning above 60,000)`. Thresholds and estimate: section [Project size](#project-size). |
| Spanwise stations per panel reduced from … to …: … sections with … chord samples keep the loft within 5,000,000 grid points. | warning | loft grid above 5,000,000 points with the set **Spanwise stations per panel**, with a guide curve on or with **Smooth** ([Guide curves](#guide-curves)) |
| Pointed tip: nose line and end line end … mm apart, so the tip chord is … mm instead of … mm; … | warning | pointed tip, both guide curves on, gap at the tip more than 0.5 mm wider than the scaled tip chord |
| Trailing-edge thickness … mm exceeds 5 % of the chord at … station(s); it is limited to 5 % there. | warning | fixed thickness above 5 % of the local chord |
| The trailing edge is closed on some stations and open on others; … station(s) were opened to 0.01 mm. | warning | not every station closed, and at least one station with a trailing-edge gap below 0.01 mm |
| The loft deviates up to … mm from the intended surface at y = … mm after … added station(s); raise the spanwise stations per panel. | warning | deviation from the intended profile (leading edge, upper trailing-edge point, every k-th chord station per surface, k = **Chordwise stations per surface** / 6, rounded down: 5 at 60) above 0.5 mm (or 10 % of the local chord, if smaller) at a checked span position remains after the added stations (at most 32 in 6 rounds) |

- Checked span positions: section [Guide curves](#guide-curves).
- Messages that name `Settings > Chord samples` refer to **Settings** > **Chordwise stations per surface**.
- Messages that name `"as in file"` refer to **Trailing edge** = **As in the airfoil files**.

Build errors that the UI and **Open** prevent (reachable only through code). The build reports the section and guide limits of **Open** as errors too:

| Message | Condition | Prevented by |
| --- | --- | --- |
| At least 2 sections are required. | fewer than 2 sections | **×** is disabled at 2 sections; **Open** rejects the file |
| Section …: chord must be at most 100000 mm. / Section …: x must be within ±1000000 mm. (also y, z) / Section …: twist must be within ±360 degrees. | chord above 100,000 mm; x, y or z outside ±1,000,000 mm; twist outside ±360° | the **Sections** table clamps typed values to these limits; planform drags stay within them; **Open** rejects the file |
| At most 20,000 sections are supported (found …). | more than 20,000 sections | **+** is disabled at 20,000 sections; **Open** rejects the file |
| guides.….points: at most 20,000 points (found …). / guides.….points: x must be within ±1100000 mm and y within ±1000000 mm. | a guide curve with more than 20,000 points, a point x outside ±1,100,000 mm or a point y outside ±1,000,000 mm | **Add point** is disabled at 20,000 points; drags and the point table keep x within ±1,100,000 mm; **Open** rejects the file |
| Section at y = … mm lies on the mirrored side; … | root y below 0 | the y field sets negative values to 0; **Open** rejects the file |
| Sections … and … share span position y = … mm. | two sections with the same y | the Sections table rejects the value; **Open** rejects the file |
| Section at y = … mm uses unknown airfoil "…". | airfoil id missing in the project | **×** is disabled for used airfoils; **Open** rejects the file |

With an error the wing is not built: the 3D view and the statistics stay empty, and **Export** offers only the project JSON.

## Project size

Above a warning threshold the app works as usual. The wing build adds one warning to the **Checks** tab, counted in the status bar:

`Large project: <sizes>. Each change takes … and … of browser memory.`

- Each size reads e.g. `1,000 sections (warning above 200)`.
- A notice with the same text shows when a size crosses its threshold: after an edit, after **Open**, and for the restored project of the next visit.
- The hard limits lie where a desktop browser tab runs out of memory or a change takes about a minute.

| Size | Warning above | Hard limit | At the hard limit |
| --- | --- | --- | --- |
| Sections | 200 | 20,000 | **+** disabled; **Open** rejects the file |
| Project airfoils | 200 | 10,000 | the Airfoils tab adds no airfoil; **Open** rejects the file |
| Points of one airfoil | 5,000 | 100,000 | preview error `too-many-points`; **Open** rejects the file |
| Airfoil points in all | 100,000 | 1,000,000 | the Airfoils tab adds no airfoil; **Open** rejects the file |
| Points of a guide curve that is on | 500 | 20,000 (every guide curve) | **Add point** disabled; **Open** rejects the file |
| Loft grid points | 60,000 | 5,000,000 | fewer spanwise stations per panel; build error when one station per panel exceeds the limit |
| Triangles of an STL or 3MF export | 2,000,000 (export dialog) | 10,000,000 | **Download** disabled |
| Characters of the project name or an airfoil name | 200 | 10,000 | name fields take at most 10,000 characters; the airfoil parser keeps the first 10,000; **Open** rejects the file |
| Project file | – | 100 MB | **Open** rejects the file unread; **Save** leaves out the derived NURBS data |

The estimate in the warning is a linear fit to measurements in Chromium 141 on 4 cores of a 2.1 GHz Xeon server CPU (JavaScript time, without drawing the 3D view):

| Part | Time | Browser memory |
| --- | --- | --- |
| Base of each change | 0.2 s | 15 MB |
| Per 1,000 loft grid points | 11.5 ms | 0.65 MB |
| Per point of a guide curve that is on (the one with more points) | 0.11 ms | 0.05 MB |
| Per 1,000 airfoil points | 1.5 ms | 0.2 MB |
| Per 1,000 entries of the airfoil lists in the Sections table (sections × airfoils; above 20,000 one per section) | 8.5 ms | 0.5 MB |

- Times read `under 1 s`, `about 1.5 s` (half seconds below 10 s) or `about 14 s`; memory has 2 significant digits, e.g. `about 94 MB`, `about 1.6 GB`.
- Drawing the 3D view adds the time of the graphics card. Phones: not measured.

Measured per chord edit in the browser: Chromium 141 headless, software rendering, 4 shared cores, load average 2 to 8; **Linear**, 1 airfoil, 60 chord samples; JavaScript time and JavaScript heap after the change.

| Sections | Loft grid points | Estimate | Time | Memory |
| --- | --- | --- | --- | --- |
| 1,000 | 121,000 | about 1.5 s, about 94 MB | 1.5 to 1.6 s | 78 to 91 MB |
| 5,000 | 605,000 | about 7 s, about 410 MB | 6.9 to 7.4 s | 345 to 361 MB |
| 10,000 | 1,210,000 | about 14 s, about 810 MB | 15.8 to 16.4 s | 490 MB |
| 15,000 | 1,815,000 | about 21 s, about 1.2 GB | 19 to 23 s | 678 MB |
| 20,000 | 2,420,000 | about 28 s, about 1.6 GB | 24 s | 969 MB |

- 20,000 sections: 57 s page time per change with software rendering; opening the file: 24 s of JavaScript, 59 s page time.
- Selecting a section: 2 ms of JavaScript at 200 sections, 100 to 110 ms at 20,000 sections.
- Full conditions and more cases: [[Development|Development]].

## Export

![Export dialog: format, wing halves, mesh density](images/export-dialog.png)

| Format | Meaning | Content |
| --- | --- | --- |
| STEP | Standard for the Exchange of Product model data; ISO (International Organization for Standardization) 10303-21 text file, Application Protocol 214 | Exact B-spline surfaces, closed solids |
| STL | Stereolithography | Binary triangle mesh |
| 3MF | 3D Manufacturing Format | Zip package with a triangle mesh |
| Project JSON | Project file of this app | Airfoils, sections, curves, settings, NURBS data |

| Group | Option | Default |
| --- | --- | --- |
| Format | **STEP (AP214, exact NURBS solids)** | selected when the wing has no errors |
| Format | **STL (binary triangle mesh)** | – |
| Format | **3MF (triangle mesh for 3D printing)** | – |
| Format | **Project JSON (airfoils, sections, curves, settings, NURBS data)** | selected when the wing has errors; then the only format |
| Wing halves | **Both halves as separate bodies** | selected |
| Wing halves | **Full wing as one body (mesh formats, root at y = 0)** | – |
| Wing halves | **Right half only** | – |
| Mesh density (STL, 3MF) | **Normal** | selected |
| Mesh density (STL, 3MF) | **Fine (4x triangles)**: doubles the subdivision in both surface directions | – |

For STL and 3MF, a note under the mesh density gives the triangles and the file size of the chosen format, wing halves and density, e.g. Glider preset, STL, both halves, **Normal**: `0.02 million triangles, file about 1.2 MB.` STEP and Project JSON show no note.

| Triangles | Note | **Download** |
| --- | --- | --- |
| up to 2,000,000 | `… million triangles, file ….` | enabled |
| above 2,000,000 | warning colour; adds `The export takes … and … of browser memory.` | enabled |
| above 10,000,000 | error colour: `… million triangles, file …: above the limit of 10 million triangles, where a desktop browser tab runs out of memory. Use Normal density, one half, or fewer chord samples or panel stations.` | disabled |

- Estimate per million triangles: STL 0.8 s, 210 MB of browser memory, 50 MB of file; 3MF 5.8 s, 110 MB of browser memory, 11.5 MB of file. The memory estimate adds 15 MB.
- Measured (Chromium 141, 4 cores of a 2.1 GHz Xeon server CPU): STL with 8.5 million triangles: 6.9 s, 423 MB file, 2.7 GB browser memory at the peak; 3MF with 8.5 million triangles: 49 s, 97 MB file; STL with 20 million triangles failed.

| Button | Effect |
| --- | --- |
| **Download** | Writes the file with the selected options. |
| **Cancel** | Closes the dialog without a file. |

| Format | Both halves | Full wing | Right half |
| --- | --- | --- | --- |
| STEP | 2 solids | 2 solids | 1 solid |
| STL | 1 file, 2 closed shells | 1 closed shell | 1 closed shell |
| 3MF | 2 objects: `Wing right`, `Wing left` | 1 object: `Wing` | 1 object: `Wing right` |
| Project JSON | full project | full project | full project |

- **Full wing** needs the root section at y = 0. Otherwise STL and 3MF write 2 bodies, as with **Both halves**.
- STEP has no merged body: **Full wing** writes 2 solids.
- Project JSON holds the full project. Without wing errors it also holds the derived NURBS data: airfoil curves, guide curves, spanwise stations and the wing surface.
- When the derived NURBS data would take the file above 100 MB, the largest file **Open** reads, **Save** and Project JSON leave it out and show the notice `The file leaves out the derived NURBS data: with it, the file would exceed 100 MB, the largest project file Open reads. Open recomputes it; STEP export writes the exact surfaces.`
- File name: project name with accents removed; each run of characters outside `A–Z a–z 0–9 . _ -` becomes one `_`; leading and trailing `_` are removed; the first 120 characters are kept. Extension `.step`, `.stl`, `.3mf` or `.json`. Empty name: `wing`.
- Units: mm in every format. Axes as in the app.
- If the browser runs out of memory or reaches a size limit of its own, the export stops with the red notice `Export failed: <reason>. Use Normal mesh density or fewer chord samples and panel stations.`
- STL and 3MF store 32-bit coordinates. When the rounding collapses or turns over a triangle that is visible at that resolution, the export writes no file and shows the red notice `STL stores 32-bit coordinates: at … mm their spacing is … mm, and … of … triangles collapse or turn over. Move the wing towards the origin, or export STEP.` (3MF: `3MF readers store 32-bit coordinates: …`).
- File contents: [[File Formats|File-Formats]].
