# File formats

## Airfoil files (import)

| Format | Detection | Notes |
| --- | --- | --- |
| Selig | default | name line, then x y from the upper trailing edge over the leading edge to the lower trailing edge |
| Lednicer | first numeric line holds two integers ≥ 2 (e.g. `61. 61.`) and the next point lies at the leading edge (x ≤ 5 % of the maximum x) | upper surface LE → TE, then lower LE → TE; when the counts disagree with the data, the surfaces are split where x jumps back |
| Table | every data line has 3 values, x strictly increases or strictly decreases, upper ≥ lower on ≥ 90 % of lines | x, y_upper, y_lower (e.g. "X Yo Yu" tables); decreasing tables are reversed |
| XML | text contains `<coordinates>` | `<name>` and the `<point><x>…</x><y>…</y></point>` list of the first element |
| HTML | text contains `<html>`, `<pre>` or `<body>` | coordinates from `<pre>` blocks, name from `<title>` |

Accepted details: UTF-8 with or without byte order mark (BOM), otherwise Windows-1252; CR, LF or CRLF;
`#` comments; separators space, tab, comma, semicolon; decimal commas (`0,125  1,250`); Fortran
exponents (`1.0D-3`); coordinates in percent (maximum x between 5 and 110 → divided by 100); lower
surface first (reversed); consecutive duplicate points (removed); a closing point that repeats the
first point after a steep segment at the trailing edge (a drawn blunt trailing-edge base: removed; an
outline that starts on the base, e.g. at its midpoint, loses the base point at both ends). Input
above 2,000,000 characters or 5000 points is rejected; uploaded files above 8 MB are rejected before
they are read (a UTF-8 character takes at most 4 bytes). The preview also rejects an airfoil whose
NURBS curve crosses itself or runs back in x ([[Geometry|Geometry]], section 1). Project files above
50 MB are not opened.

### Checks

| Code | Severity | Condition |
| --- | --- | --- |
| too-large | error | input longer than 2,000,000 characters |
| too-many-points | error | more than 5000 points |
| no-points | error | no coordinate lines |
| non-finite | error | a value is not a finite number |
| too-few-points | error | fewer than 5 points |
| zero-chord | error | all x equal |
| self-intersection | error | two non-adjacent outline segments cross |
| one-surface | error | upper or lower surface has fewer than 3 points |
| crossed-surfaces | error | upper below lower by more than 0.01 % chord |
| surfaces-touch | error | thickness at most 0.001 % chord between 1 % and 99 % chord, checked at every file point and 201 cosine-spaced positions |
| te-crossed | error | trailing-edge gap below −0.01 % chord |
| te-missing | error | first and last point are not at the trailing edge (5 % chord tolerance) |
| coarse | warning | fewer than 20 points |
| not-normalized | warning | x range differs from 0..1 by more than 0.02; coordinates are scaled |
| rotated | warning | line from leading edge to trailing-edge midpoint inclined more than 0.5 degrees |
| non-monotonic | warning | x decreases along a surface from leading to trailing edge |
| te-gap | warning | trailing-edge gap above 2 % chord |
| thin / thick | warning | maximum thickness below 1 % or above 30 % chord |
| spike | warning | outline turns by more than 90 degrees at a point (except within 2 points of the leading edge) |
| closing-point | warning | drawn trailing-edge base removed (see above) |
| te-base | warning | closed trailing edge reached over a vertical segment within 1 % chord of the trailing edge: the base is probably read as surface points |
| duplicates | info | consecutive duplicate points removed |
| uneven-spacing | info | adjacent segment lengths differ by more than a factor of 25 |
| stats | info | point count, thickness, camber and their positions, trailing-edge gap. Camber: mean of the surfaces, measured from the chord line (leading edge to trailing-edge midpoint); for NACA sections below the designated value (4415: 3.74 % at 42 %) |

## Project JSON

```json
{
  "format": "wingdesigner-project",
  "version": 1,
  "generator": { "name": "Wingdesigner", "version": "0.1.0" },
  "exportedAt": "2026-09-29T12:00:00.000Z",
  "name": "Sport wing 1500",
  "units": "mm",
  "coordinateSystem": "x chordwise towards the trailing edge, y spanwise towards the right tip, z up; mirror plane y = 0",
  "airfoils": [{ "id": "naca2412", "name": "NACA 2412", "points": [[1, 0.00126], "..."], "source": { "kind": "naca" } }],
  "sections": [{ "id": "root", "airfoil": "naca2412", "x": 0, "y": 0, "z": 0, "chord": 240, "twist": 0 }],
  "guides": {
    "nose": { "enabled": false, "mode": "fit", "degree": 3, "points": [[0, 0], [55, 750]] },
    "end": { "enabled": false, "mode": "fit", "degree": 3, "points": [[240, 0], [185, 750]] }
  },
  "settings": {
    "spanwise": "linear", "twistPivot": 0.25,
    "trailingEdge": { "mode": "thickness", "thickness": 0.5 },
    "chordSamples": 60, "panelStations": 8, "parametrization": "centripetal", "mirror": true
  },
  "derived": {
    "profiles": [{ "airfoil": "naca2412", "curve": { "degree": 3, "knots": [], "controlPoints": [] }, "leadingEdgeParameter": 0.5 }],
    "guides": { "nose": null, "end": null },
    "stations": [{ "y": 0, "v": 0, "xLE": 0, "z": 0, "chord": 240, "twist": 0 }],
    "surface": { "degreeU": 3, "degreeV": 1, "knotsU": [], "knotsV": [], "controlPoints": [], "leadingEdgeU": 0.5, "closedTrailingEdge": false }
  }
}
```

- Guide points are `[x, y]` in the planform. Section and guide values are in mm and degrees.
- `enabled` and `settings.mirror` are JSON booleans, `settings.trailingEdge` and `settings.tip` objects
  (`null` selects the default); other types are rejected on import. Section chords
  are at least 1 mm.
- `derived` is written on export and ignored on import; it is recomputed from the rest.
- `surface.controlPoints[i][j]` has i along u (around the profile) and j along v (span).
- Profile curves are in normalized airfoil coordinates (chord 1).

## STEP

ISO 10303-21 file, schema `AUTOMOTIVE_DESIGN { 1 0 10303 214 1 1 1 1 }` (AP214). Units: millimetre,
radian, steradian; uncertainty 1e-7 mm. One `MANIFOLD_SOLID_BREP` per half in one
`ADVANCED_BREP_SHAPE_REPRESENTATION`. Face structure: [[Geometry|Geometry]], section 6.

## STL

Binary STL: 80-byte header, `uint32` triangle count, per triangle a unit normal and 3 vertices as
`float32` (mm), `uint16` attribute 0. Normals and winding point outward.

## 3MF

Zip package with `[Content_Types].xml`, `_rels/.rels` and `3D/3dmodel.model` (3MF core namespace
2015/02), `unit="millimeter"`, one `object type="model"` per shell and one build item each.
Coordinates carry 5 decimals.
