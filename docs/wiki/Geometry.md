# Geometry

All lengths are in mm. Algorithm numbers refer to Piegl and Tiller, *The NURBS Book*, 2nd edition, 1997.

## 1. Airfoil to NURBS curve

1. The file is parsed and checked ([[File Formats|File-Formats]]), then translated and scaled so the
   x range is 0 to 1. Inclined airfoils are not rotated.
2. A cubic B-spline interpolates every point (global interpolation, A9.1). Parameters: centripetal
   (default), chord length or uniform; knots by averaging. The curve runs from the upper trailing edge
   (u = 0) over the leading edge to the lower trailing edge (u = 1).
3. The leading edge is the minimum-x point of the curve, found with Newton steps on x'(u) = 0 from the
   minimum-x file point.
4. The interpolation systems are solved with a band LU factorization without pivoting (B-spline
   collocation matrices are totally positive for nondecreasing parameters; other parameters are
   rejected), in time linear in the number of points: 5000 points take 13 ms.
5. The curve is sampled with a budget of about 4000 points shared among the knot spans in
   proportion to the length of their control polygon (1 to 256 per span), so coarse spans get many
   samples even in a dense file. The samples are tested for self-crossing: cubic interpolation of a
   coarse file can loop past the trailing edge although the file points pass every check; such an
   airfoil is an error. A crossing splits the outline in two parts; its size is the mean width (area
   divided by extent) of the part with the smaller extent. Crossings up to 0.05 % chord are ignored:
   cusped closed trailing edges leave long, thin slivers of at most 0.0016 % chord in 246 real
   files. The loop of a coarse 9-point file measures 0.25 % chord.
6. The upper surface must run towards the leading edge and the lower surface away from it: an x
   reversal of the fitted curve above 0.01 % chord is an error, because the loft resamples both
   surfaces by chord position and would drop the part that runs back. None of 246 real files has a
   reversal.

## 2. Common chord stations

Every airfoil is resampled at the chord fractions s_k = (1 − cos(πk/N)) / 2, k = 0..N (N = chordwise
stations, default 60), on the upper and the lower branch of its curve. x(u) = x_LE + s_k (x_TE − x_LE)
is solved per branch. The result has 2N + 1 points with the leading edge at index N. The points are
then moved and scaled so the NURBS leading edge is at (0, 0) and the trailing-edge midpoint at x = 1.

Point k of every section is the same relative chord position, so sections can be blended point by
point and the leading edge stays at one surface parameter.

## 3. Spanwise stations

Section values (x, z, chord, twist and the resampled shape) are blended between sections:

- **linear**: hat functions per panel,
- **smooth**: cardinal functions of a natural cubic spline through the section span positions. The
  second derivatives come from one tridiagonal factorization for all sections (200 sections: 6 ms).

A natural cubic spline through unevenly spaced sections overshoots: sections 0.1 mm apart next to
sections 100 mm apart give weights of ±1475, and 20 to 200 mm chords at y = 0/500/510 mm reach
1388 mm. In smooth mode every blended value (leading-edge x and chord where no guide sets them, z,
twist, and each resampled profile coordinate) is checked at the check positions below: a value more
than 2 section value ranges outside the range of the section values stops the build with an error
that names the quantity, the span position and the smallest section gap. A curved planform with
chords 100/500/100 mm at y = 0/100/1000 mm reaches 1036 mm (1.34 ranges) and builds.

Stations are the sections only (linear mode without guides) or the sections plus `panelStations − 1`
intermediate stations per panel (smooth mode or any guide curve on), spaced by
(1 − cos(πk/K)) / 2 so they cluster at the panel ends. After the fit, stations are added at the check
positions (below) where the loft deviates more than 0.5 mm, or 10 % of the local chord if that is
smaller (3D distance), from the intended surface, up to 32 added stations in at most 6 rounds. The
deviation is measured on the leading edge, the trailing edge and every floor(N / 6)-th chord station
per surface (5 at N = 60). The warning text is "The loft deviates up to … mm from the intended
surface at y = … mm after … added station(s)". New stations keep at least 1e-6 of the
span from every other station. Twist counts: linear rows between strongly
twisted stations average rotated shapes and shorten the chord (180° of twist would collapse midspan to
the pivot), and the 3D deviation adds stations there. After the last round, the fitted surface is
probed at 257 span positions, every guide breakpoint and the quarter points of every interval
between fitted stations (cubic interpolation through closely spaced stations can swing between
them, away from every other check position):

- chord along the intended chord direction below 0.9 mm (the 1 mm minimum chord less the 10 %
  deviation allowed for small chords), or reversed: the surface folds or narrows between stations,
- local thickness (twist and chord removed) negative at a probed chord station: the surface turns
  inside out between stations,
- local thickness at most 0.001 % chord between 1 % and 99 % chord: the surfaces touch.

Each of these stops the build with an error. The deviation warning and the added stations use the
check positions only: within 2 mm of a pointed elliptic tip the loft deviates 0.3 to 0.8 mm between
stations (wizard presets), more than 10 % of the 1 to 3 mm chord there. Surface points that are not
finite (for example from a twist of 1e308 degrees, which overflows the angle conversion) stop the
build before the fit.

With guide curves, x_LE(y) and/or x_TE(y) come from the curves instead. A guide is stretched linearly
so its first and last point y match the root and tip. Through-point guides use parameters
proportional to y, so y(t) is linear and x(y) is a spline function. x at span y is found by solving
y(t) = y on the curve (y(t) checked for monotony at 401 samples).

The chord is checked at 257 evenly spaced span positions, every station and every guide control point
and knot: below 1 mm the build stops with an error (nose line and end line touch or cross). 1 mm is
the minimum chord of every section; below it the profile shape falls under the resolution of meshes,
STEP modelling tolerances and manufacturing.

Wing tip:

| Mode | Tip station |
| --- | --- |
| Flat | the tip section as placed; the tip cap is a plane |
| Pointed | chord = ratio × chord at the previous section (ratio 1/100 to 1/1000, default 1/200, at least 1 mm); in the last panel the chord does not fall below this value, so guides that meet at the tip end in the scaled profile. With both guides on, their end points set the tip chord: more than 0.5 mm above the scaled value leaves a blunt tip, the build warns and the Sections table shows the actual tip chord |

Trailing edge per station: as in the files, closed (gap 0, both end points merged), or a fixed
thickness t in mm (gap t / chord, at most 5 % of the chord). The gap change is added with weight
rising linearly from 0 at the leading edge to 1 at the trailing edge (XFOIL TGAP style). When all
stations are closed, the trailing edge is closed; otherwise every station gets a gap of at least
0.01 mm (at most 5 % of the chord). The linear taper can pull the surfaces of an airfoil that is
thinner inside than its gap through each other or make them touch; both are errors (negative
thickness, or at most 0.001 % chord between 1 % and 99 % chord, checked at 257 span positions).
Behind 99 % chord, surfaces that cross by up to 0.01 % chord count as zero thickness: the last
chord stations of a cusped trailing edge can lie in a sliver that the curve crossing check accepts.
Negative blended thickness is an error in both modes; the message names smooth overshoot in smooth
mode and a section airfoil in linear mode.

Placement of a normalized point (p_x, p_z) with twist θ about the pivot c_p:

```
dx = p_x − c_p
r_x =  dx cos θ + p_z sin θ
r_z = −dx sin θ + p_z cos θ
X = x_LE + chord (c_p + r_x),  Y = y,  Z = z + chord r_z
```

## 4. Surface

Global surface interpolation (A9.4) through the station grid Q[j][k] (j chordwise, k spanwise):

- u: cubic, parameters = average of the per-station parametrizations, knots by averaging.
- v: parameters = span fraction (y − y_root) / (y_tip − y_root).
  - linear mode: each panel is interpolated separately (degree 1 without guides, degree 3 with
    guides) and the panels are joined with interior knots of multiplicity p at the sections (C0 joins).
  - smooth mode: one cubic interpolation over all stations (C2).
- The root and tip control rows are set to exactly y_root and y_tip.

The surface passes through every station point; the leading edge lies on the iso-curve u = u_LE.
The surface rows (planes y = const) at every section, halfway between neighbouring sections and
halfway between neighbouring fitted stations are sampled with 4 points per knot span and tested for
self-crossing with the same 0.05 % chord mean-width tolerance. Not checked: self-crossing of rows at
other span positions; the probes of section 3 cover thickness and chord there.

## 5. Meshes

The surface is sampled at the u parameters of the stations and 1 (linear) or 3 (cubic) samples per
v interval. Triangles are oriented outward (S_v × S_u). A closed trailing edge shares its vertices; an
open one gets a strip of triangles. Root and tip caps pair the upper and lower point of each chord station into quads (2 triangles each, linear time); ear clipping in the x-z plane is the fallback when a strip triangle is not counterclockwise.
The left half is the mirror image (y → −y, reversed winding). With the root at y = 0 the full-wing mesh
shares the root vertices and has no root caps.

## 6. STEP topology

Per half: the surface is split at u_LE by knot insertion (A5.1) into the upper face (trailing edge to
leading edge) and the lower face (leading edge to trailing edge). Faces and edges:

| Face | Surface | Edges |
| --- | --- | --- |
| Upper | B-spline | upper trailing edge, tip upper, leading edge, root upper |
| Lower | B-spline | leading edge, tip lower, lower trailing edge, root lower |
| Trailing edge (open only) | ruled B-spline, degree 1 in u | lower trailing edge, tip line, upper trailing edge, root line |
| Root cap | plane, normal −y | root upper, root lower (+ root line) |
| Tip cap | plane, normal +y | tip lower, tip upper (+ tip line) |

Every edge curve is the exact boundary iso-curve of its surface (the first or last control row or
column). The wing surfaces have inward S_u × S_v, so their faces use `same_sense = .F.`. The mirrored
half flips `same_sense` of the B-spline faces and uses every loop reversed (`FACE_OUTER_BOUND .F.`);
plane axes are mirrored as vectors and stay outward.

## 7. Planform statistics

Area, mean aerodynamic chord (MAC) and its position integrate the intended planform (leading edge
and chord at every span position, from sections, spanwise interpolation and guide curves) with
5-point Gauss-Legendre quadrature per station interval. The rule is exact for polynomials up to
degree 9, so linear panels, cubic spanwise splines and their products give values independent of the
station count:

```
S_half = ∫ c dy,  MAC = ∫ c² dy / S_half,  y_MAC = ∫ c y dy / S_half,  x_LE,MAC = ∫ c x_LE dy / S_half
AR = span² / S
```
