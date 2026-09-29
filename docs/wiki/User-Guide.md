# User guide

## Screen layout

| Area | Content |
| --- | --- |
| Top bar | New (wizard), Open (project JSON), Save (project JSON), Export, Undo, Redo, Help |
| 3D view | Wing with section outlines and edge lines; view buttons Iso, Top, Front, Side, Fit |
| Panel tabs | Sections, Planform, Airfoils, Settings, Checks |
| Status bar | Span, wing area, aspect ratio (AR), mean aerodynamic chord (MAC), error count |

On screens narrower than 860 px the 3D view sits above the panel. **Enlarge** hides the panel.

## Controls

| Action | Mouse | Touch |
| --- | --- | --- |
| Rotate 3D view | left drag | one-finger drag |
| Zoom | wheel | pinch |
| Pan | right drag | two-finger drag |
| Move a point in 2D editors | drag the point | drag the point |
| Pan / zoom 2D editors | drag background / wheel | drag background / pinch |
| Fit 2D editor | double-click, or **Fit** | **Fit** |
| Undo / redo | Ctrl+Z / Ctrl+Shift+Z (Ctrl+Y) | buttons |

## New-design wizard

The wizard opens on the first visit and with **New**. It creates sections (and guide curves for an
elliptic planform) from these values:

| Field | Range | Meaning |
| --- | --- | --- |
| Span | 100 to 20000 mm | both halves |
| Root chord | 10 to 3000 mm | chord at y = 0 |
| Taper | 0.1 to 1.5 | tip chord / root chord |
| Sweep | -45 to 60 degrees | sweep of the 25 % chord line, positive = swept back |
| Dihedral | -15 to 30 degrees | per half |
| Tip twist | -15 to 15 degrees | linear from root (0) to tip; negative = washout |
| Sections | 2 to 8 | evenly spaced along the half span |
| Planform | straight or elliptic | elliptic: chord c(η) = c_root √(1 − (1 − taper²) η²), η = span fraction; set with both guide curves |
| Root and tip airfoil | NACA 4- or 5-digit | the root airfoil is used on all sections except the tip |
| Tip | flat or pointed | pointed: tip profile scaled to 1/200 of the previous section; an elliptic planform then converges to the 25 % line |

Presets: trainer, sport, glider, swept flying wing, plank, tail surface. The trailing edge is set to a
fixed thickness of 0.2 % of the root chord, at least 0.3 mm.

## Sections

Each section places an airfoil in the plane y = const:

- leading edge at (x, y, z) in mm,
- scaled to the chord in mm,
- twisted by the twist angle about the pivot chord point (Settings, default 25 % chord); positive
  twist raises the leading edge.

**+** inserts a section halfway to the next one (after the tip: one panel length further out); it is
disabled at 200 sections. **×** deletes a section; at least 2 sections remain. Typed values are
clamped to the limits: chord 1 mm to 100,000 mm, twist within ±360 degrees, x, y and z within
±1,000,000 mm (y at least 0). When a guide curve is on, the x or chord values it
overrides are shown as `guide: value` below the input.

## Planform and guide curves

The planform editor shows the half wing from above (span to the right, chord downwards) with a grey
mirror image. Without guide curves, the square handles move section leading edges (x and y) and the
round handles set the chord.

- **Nose line**: sets the leading-edge x along the span.
- **End line**: sets the trailing-edge x along the span.
- Both on: the chord is the distance between them. Only one on: the other edge follows the section
  chords.

Each guide has a mode (**Through points**: the curve passes through the points; **Control points**:
the points form the control polygon) and a degree from 1 to 5. The first and last points stay at the
root and tip span positions; interior points stay at least 0.5 mm apart in y. **Add point** is
disabled at 500 points. A guide that was switched off keeps its edited points and uses them again
when it is switched on; **Reset to sections** replaces them with the section edges. A switched-off
guide without edits follows the section edges. A guide that doubles
back in y or makes the chord smaller than 1 mm is reported as an error. With the wing tip set to Pointed, guides may meet at the tip; the tip then ends in the profile scaled to 1/100 to 1/1000 (default 1/200) of the previous section chord, at least 1 mm. The Sections table shows the resulting tip chord, marked (min.) when the 1 mm minimum applies.

## Airfoils

- **Upload**: drop or choose `.dat`, `.txt`, `.cor`, `.xml`, `.htm` files, or paste coordinates.
  Each file opens a preview with the file points, the NURBS curve and the check results. Files with
  errors cannot be added. See [[File Formats|File-Formats]] for the checks.
- **NACA generator**: any 4-digit (e.g. 2412) or 5-digit (e.g. 23012, reflexed 23112) designation.
- **Library**: NACA presets for tails, trainers, scale and reflex sections.
- **External sources**: links to aerodesign.de, mh-aerotools.de and the UIUC database. Download there,
  then upload. The attribution field is filled for HS and MH airfoils.

## Settings

| Setting | Values | Default |
| --- | --- | --- |
| Spanwise interpolation | linear (straight panels), smooth (natural cubic spline) | linear |
| Twist pivot | 0 to 1 chord | 0.25 |
| Trailing edge | as in files, closed, fixed thickness | as in files (wizard: fixed) |
| Wing tip | flat, pointed (scale 1 : N, N = 100 to 1000) | flat, N = 200 |
| Chordwise stations per surface | 16 to 200 | 60 |
| Spanwise stations per panel (with guides or smooth mode) | 3 to 40 | 8 |
| Profile parametrization | centripetal, chord length, uniform | centripetal |

Smooth interpolation overshoots between unevenly spaced sections. When a blended value (chord,
leading-edge x, z, twist or a profile coordinate) leaves the range of the section values by more
than twice that range, the build stops with an error that names the value and the smallest section
gap; linear interpolation or evenly spaced sections avoid it. With chord length or uniform
parametrization, some real files give a fitted curve that runs back in x near the leading or
trailing edge (13 of 246 files with uniform parametrization); the error then points to centripetal
parametrization. The airfoil preview uses the parametrization set here.

## Export

| Format | Options |
| --- | --- |
| STEP | both halves as two solids, or the right half |
| STL | both halves as two shells, full wing as one shell (root at y = 0), or the right half; normal or fine density (4x triangles) |
| 3MF | as STL, one 3MF object per shell |
| Project JSON | always the full project with derived NURBS data |

Units are millimetres in all formats.
