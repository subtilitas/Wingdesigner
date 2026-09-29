# Wingdesigner

Wingdesigner is a browser application for designing wings of radio-controlled (RC) model aircraft.
It lofts one half of the wing as a NURBS (non-uniform rational B-spline) surface through airfoil
sections, mirrors it at the plane y = 0 and exports STEP, STL and 3MF files plus a JSON project file.
It runs entirely in the browser; no data leaves the device.

App: <https://subtilitas.github.io/Wingdesigner/>
Documentation: [wiki](https://github.com/subtilitas/Wingdesigner/wiki)

## What it does

- Places 2 or more sections. Each section has an airfoil, a leading-edge position (x, y, z) in mm,
  a chord in mm (the airfoil scale) and a twist in degrees.
- Interpolates every airfoil with a cubic B-spline through all file points, resamples all sections at
  common chord stations (cosine spacing, 16 to 200 stations per surface, default 60) and lofts them
  into one cubic-by-linear or cubic-by-cubic B-spline surface.
- Blends section values linearly (straight panels) or with a natural cubic spline (smooth).
- Shapes the planform with two optional guide curves: the nose line (leading edge) and the end line
  (trailing edge). Each is a NURBS curve of degree 1 to 5, either through points or from control points.
- Sets the trailing edge as in the files, closed, or to a fixed thickness in mm.
- Imports airfoil files in Selig, Lednicer, three-column (x, upper y, lower y), XML and HTML-table
  form, checks them and shows a preview before use.
- Generates NACA 4-digit and 5-digit airfoils (including reflexed 5-digit sections) from their equations.
- Starts new designs from a wizard with presets for trainer, sport, glider, swept flying wing, plank
  and tail surface.
- Works with mouse and touch: pinch to zoom and two-finger pan in the 3D view and in all 2D editors.

## Quick start

1. Open the app. The wizard asks for a design type, span, root chord, taper, sweep, dihedral, washout
   and airfoils. Create the design, or skip to the sample wing.
2. **Airfoils** tab: add NACA sections or upload `.dat` files. Each upload shows the parsed outline,
   the NURBS interpolation and the check results before it is added.
3. **Sections** tab: edit y, x, z, chord and twist per section; insert or delete sections.
4. **Planform** tab: switch on the nose line or the end line and drag their points.
5. **Export**: choose STEP, STL, 3MF or project JSON.

The project autosaves in the browser (local storage). **Save** downloads the project JSON; **Open** loads it.

## Coordinates and units

| Axis | Direction | Unit |
| --- | --- | --- |
| x | chordwise, towards the trailing edge | mm |
| y | spanwise, towards the right tip; the half wing lies at y >= 0 | mm |
| z | up | mm |
| twist | rotation about the chord point set by the twist pivot (default 25 % chord); positive = leading edge up | degree |

## Exports

| Format | Content | Check |
| --- | --- | --- |
| STEP (ISO 10303-21, AP214) | One closed B-rep solid per half: B-spline upper and lower faces, ruled trailing-edge face (open trailing edge), planar root and tip caps. The surfaces are the exact loft. | Every CI run reads the files with OpenCascade 8.0.1: shapes valid, shells closed and oriented, volume within 0.05 % of the mesh volume. |
| STL (binary) | Closed triangle mesh: right half, both halves as two shells, or the full wing as one shell (root at y = 0). | Unit tests: every edge shared by exactly 2 triangles with opposite direction, positive volume. |
| 3MF | Same meshes, one object per shell, unit millimetre. | Unit tests: package structure, vertex and triangle counts. |
| Project JSON | Airfoil coordinates, sections, guide curves, settings, plus the derived NURBS data: every profile curve, both guide curves, the spanwise stations and the wing surface (degrees, knots, control points). | Round trip in unit tests. |

## Airfoil data and licenses

- NACA sections are computed in the browser from the published equations (NACA Report 824). No
  third-party coordinate files are involved.
- Uploaded airfoils keep their name and a user-supplied attribution in the project JSON.
- The airfoil collections on aerodesign.de (Hartmut Siegmann) and mh-aerotools.de (Martin Hepperle)
  allow personal use but restrict redistribution. Wingdesigner links to them and does not bundle their
  coordinates. Details: [Airfoil sources](https://github.com/subtilitas/Wingdesigner/wiki/Airfoil-Sources).

## Current limitations

- Sections lie in planes y = const. With large dihedral the sections are not perpendicular to the
  wing surface.
- The chord must stay at or above 0.01 mm at every span position. A pointed tip (Settings, Wing tip: Pointed) ends in the tip profile scaled to 1/100 to 1/1000 of the previous section chord (default 1/200).
- When some airfoils have a closed trailing edge and others an open one, the closed ones are opened
  to 0.01 mm so the STEP solid keeps one face topology.
- Guide curves act in the planform only (x over y); dihedral follows the section z values.
- STEP files contain no colours, names per face or assembly structure.
- The 25 % mean-aerodynamic-chord point is a geometric reference, not a neutral-point calculation.

## Development

Requires Node.js 24 (see `.nvmrc`).

```bash
npm ci
npm run dev            # development server on http://localhost:5173
npm test               # unit tests (Vitest)
npm run lint           # ESLint
npm run build          # production build into dist/
npm run e2e            # Playwright smoke test against the build (desktop and phone viewport)
npm run coverage       # unit tests with coverage report in coverage/
npm run coverage:readme  # write the coverage table below; CI runs coverage:check and fails on drift
npm run airfoils:check # validate the bundled airfoil library and NACA presets
npm run step:cases     # write STEP test files to step-check/
python scripts/validate_step.py step-check/cases.json   # needs: pip install cadquery-ocp
```

## Test coverage

<!-- coverage:start -->
| Statements | Branches | Functions | Lines |
| ---: | ---: | ---: | ---: |
| 98.3 % | 94.0 % | 100.0 % | 98.8 % |

Unit tests (Vitest, V8 coverage) over `src/`, excluding the DOM code in `src/ui/` and `src/main.js`.
<!-- coverage:end -->

## License

MIT, see [LICENSE](LICENSE). Airfoil coordinate data keeps the terms of its source.
