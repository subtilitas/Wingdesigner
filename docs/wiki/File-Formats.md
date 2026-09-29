Deutsch: [[Dateiformate|Dateiformate]]

# File formats

| Direction | Content | Format | Extension | Control |
| --- | --- | --- | --- | --- |
| Import | Airfoil coordinates | Selig, Lednicer, x/upper/lower table, XML, HTML | `.dat` `.txt` `.cor` `.xml` `.htm` `.html` `.csv` | **Airfoils** > **Upload**: **Choose files**, drop zone, or **Check pasted text** |
| Import | Project | JSON | `.json` | **Open** |
| Export | Project | JSON | `.json` | **Save**, **Export** |
| Export | Wing, exact NURBS surfaces | STEP, AP214 | `.step` | **Export** |
| Export | Wing, triangle mesh | binary STL | `.stl` | **Export** |
| Export | Wing, triangle mesh | 3MF | `.3mf` | **Export** |
| Export | One airfoil | Selig | `.dat` | **Airfoils** > **.dat** |

| Abbreviation | Meaning |
| --- | --- |
| JSON | JavaScript Object Notation |
| ISO | International Organization for Standardization |
| STEP | Standard for the Exchange of Product model data, ISO 10303 |
| AP214 | STEP Application Protocol 214 |
| STL | stereolithography |
| 3MF | 3D Manufacturing Format |
| NURBS | non-uniform rational B-spline |
| XML | Extensible Markup Language |
| HTML | HyperText Markup Language |
| LE, TE | leading edge, trailing edge |
| UTC | Coordinated Universal Time |

## Export file names

1. Take the project name. For an airfoil `.dat`, take the airfoil name. Empty name: `wing`.
2. Remove accents.
3. Replace each run of characters outside `A–Z a–z 0–9 . _ -` with one `_`.
4. Remove leading and trailing `_`.
5. Cut to 120 characters.
6. Empty result: `wing`.
7. Add the extension.

Example: `Sport wing 1500` → `Sport_wing_1500.step`.

Name inside STEP, STL and 3MF files, written `<name>` below: project name; empty name: `wing`.

| File | Where `<name>` appears |
| --- | --- |
| STEP | `FILE_NAME` name, `PRODUCT`, `ADVANCED_BREP_SHAPE_REPRESENTATION`, solids `<name> right` and `<name> left` |
| STL | header `Wingdesigner <name>` |
| 3MF | metadata `Title`. Object names are fixed: table "Bodies per file". |

## Airfoil files (import)

### Reading

| Property | Rule |
| --- | --- |
| Detection | By content. The file extension is not evaluated. |
| Size limit | At most 5,000,000 characters; larger input: error `too-large`. At most 100,000 points; more: error `too-many-points`. Above 100,001 numeric lines (100,000 points and a Lednicer counts line) the parser stops reading, with the message `More than 100,001 coordinate lines; the limit is 100,000 points.` Uploaded files above 20 MB (20,000,000 bytes, 4 bytes per UTF-8 character at most) are not read: red notice `<file>: <size> MB; airfoil files are limited to 5,000,000 characters.`, no preview. Above 5,000 points the sanity checks add warning `many-points`. |
| File picker filter | `.dat` `.txt` `.cor` `.xml` `.htm` `.html` `.csv` `text/plain`. Drag and drop accepts any file. |
| Text encoding | UTF-8 (Unicode Transformation Format, 8 bit) with or without byte order mark (BOM). A file that is not valid UTF-8 is read as Windows-1252. |
| Line ends | CR, LF or CR LF (carriage return, line feed) |
| Comments | `#` to the end of the line. Exception: the name line (row Name). |
| Numeric line | 2 or more numbers and nothing else |
| Separators | space, tab, comma, semicolon |
| Decimal comma | `0,125  1,250` is read as `0.125  1.250`. Conditions: at least 2 values. Separators: spaces, tabs or semicolons. Every value is a decimal-comma number or an integer. At least 1 value has a comma. A line with 1 field, e.g. `0,5`, is split at the comma: values `0` and `5`. |
| Number syntax | optional sign, decimal point, exponent with `e`, `E`, `d` or `D` (`1.0D-3`) |
| Name | First non-numeric line before the first numeric line. The name line keeps a `#` comment: `NACA 0012 # from UIUC` → name `NACA 0012 # from UIUC`. HTML: the `<title>` when not empty. XML: the first `<name>` element. None found: the file name without extension; pasted text: `pasted`. A name longer than 10,000 characters is cut to the first 10,000 (info `long-name`). |
| Column header lines | 2 or 3 words that start with `x`, `y` or `z` (`x y`, `X Yo Yu`, `x/c y/c`, `X Y_upper Y_lower`). After the name line: skipped without a message. As the first non-numeric line before the first numeric line: taken as the name (e.g. `X Yo Yu`), no info `no-name`. |
| Other non-numeric lines | Skipped, warning `ignored-lines` |

### Layouts

Checked in this order. The first match applies.

| Order | Layout | Condition | Point order |
| --- | --- | --- | --- |
| 1 | XML | text contains `<coordinates>` | `<point><x>…</x><y>…</y></point>` list of the first `<coordinates>` element |
| 2 | HTML | text contains an `<html`, `<pre` or `<body` tag | Text of all `<pre>` blocks. Without `<pre>`: page text, table cells as columns, table rows as lines. Rules 3–5 then apply to that text. |
| 3 | Table | every numeric line has 3 values, 3 or more lines, x strictly increasing or strictly decreasing, y_upper ≥ y_lower on ≥ 90 % of the lines | x, y_upper, y_lower per line (e.g. "X Yo Yu" tables); a table with decreasing x is read in reverse order |
| 4 | Lednicer | all 3 Lednicer conditions below | counts line, upper surface LE → TE, lower surface LE → TE |
| 5 | Selig | all other files | upper TE → LE → lower TE |

Lednicer conditions:

- The first numeric line holds 2 integers ≥ 2 (e.g. `61. 61.`).
- At least 1 more numeric line follows.
- The x of the next line is at most 5 % of the largest \|x\| of all following lines. The upper surface starts at the LE.

Further rules:

- HTML: entities decoded are `&lt;` `&gt;` `&quot;` `&amp;` `&#NNN;`. Without `<pre>`, the content of `<head>`, `<title>`, `<script>` and `<style>` is dropped.
- Lednicer: when the counts do not match the number of points, the surfaces are split at the first x reset. x reset: x drops by more than 25 % of the previous x.
- Lines with more than 2 values that do not form a table: columns 1 and 2 are used.

### After reading

Steps in this order:

1. A value that is not a finite number stops the import (error `non-finite`).
2. No point found: the import stops (error `no-points`).
3. More than 100,000 points: the import stops (error `too-many-points`: `<n> points; the limit is 100,000.`).
4. Closed outline with a blunt TE: points on the drawn TE base are removed (warning `closing-point`, rules below). TE base: the steep segment that closes a blunt TE.
5. Consecutive duplicate points (difference below 1e-12 in x and in y) are removed.
6. Largest x above 5 and at most 110: the coordinates are percent of chord and are divided by 100.
7. Clockwise point order (lower surface first): the order is reversed to Selig order.
8. The sanity checks run (section "Sanity checks").

Rules for step 4. They apply when there are more than 4 points and the last point equals the first point (difference below 1e-12 in x and in y).

| Term | Definition |
| --- | --- |
| a, b, c | a = point before the last point, b = first point, c = second point |
| steep(p, q) | \|Δx\| ≤ 0.2 · \|Δy\| and \|Δy\| > 1e-6 of the x range |
| near TE | x_max − x ≤ 1 % of the x range |

| Case | Condition | Result |
| --- | --- | --- |
| 1 | a→b and b→c steep; a and c near TE; y runs in one direction through b | The outline starts on the TE base. The first and the last point are removed. |
| 2 | not case 1; a→b steep; a near TE | The last point is removed. |
| – | neither case | No change. |

### Parser messages

A parser error stops the import. The sanity checks then do not run.

| Code | Severity | Condition |
| --- | --- | --- |
| `too-large` | Error | input longer than 5,000,000 characters |
| `no-points` | Error | no coordinate point: no numeric line, or no `<point>` in the XML `<coordinates>` element |
| `non-finite` | Error | a coordinate is not a finite number, e.g. a `<point>` without `<x>` or `<y>` |
| `too-many-points` | Error | more than 100,000 points; text formats: reading stops above 100,001 numeric lines |
| `xml-malformed` | Error | `<coordinates>` without closing tag |
| `multi-element` | Warning | more than 1 `<coordinates>` element; only the first is read |
| `ignored-lines` | Warning | non-numeric lines other than the name line and column header lines. HTML with a `<title>`: every non-numeric line except column headers. |
| `extra-columns` | Warning | lines with more than 2 values that do not form a table; columns 1 and 2 are used |
| `lednicer-count` | Warning | Lednicer counts differ from the number of points; surfaces split at the x reset |
| `closing-point` | Warning | drawn blunt-TE base point removed at one or both ends |
| `percent` | Warning | largest x above 5 and at most 110; coordinates divided by 100 |
| `reversed` | Warning | points run clockwise; order reversed |
| `xml` | Info | read as XML |
| `html` | Info | read from an HTML page |
| `table` | Info | read as x/upper/lower table |
| `decimal-comma` | Info | decimal commas read as decimal points |
| `duplicates` | Info | consecutive duplicate points removed |
| `no-name` | Info | no name found; the file name is used |
| `long-name` | Info | name longer than 10,000 characters; the first 10,000 are used. Message: `The name line has <n> characters; the first 10,000 are used.` |

![Upload preview of sample4412.txt, a percent table with decimal commas: messages decimal-comma, table, percent and stats](images/upload-preview.png)

### Sanity checks

| Severity | Effect |
| --- | --- |
| Error | The button shows **Cannot add (errors)** and is disabled. An airfoil with an error blocks the wing build when a section uses it. |
| Warning | **Add to project** is enabled. |
| Info | Facts only. |

The checks run:

- on upload of a file;
- on **Check pasted text**;
- on the preview of a library or NACA (National Advisory Committee for Aeronautics) airfoil;
- on **View** of a project airfoil (**Airfoils** > **Project airfoils**);
- when the wing is built, for every airfoil a section uses.

| Term | Definition |
| --- | --- |
| Duplicates | Consecutive points closer than 1e-9 of the x range (x_max − x_min, the chord) to the previous point are removed first (info `duplicates`: `<n> consecutive point(s) closer than 1e-9 chord to the previous point removed.`), also for points from a project file. |
| Normalization | x → (x − x_min) / c, y → (y − y_LE) / c, c = x_max − x_min; no rotation |
| LE point | point farthest from the TE midpoint (mean of the first and the last point); y_LE is its y |
| % chord | fraction of the normalized chord 1 |
| Checks on raw coordinates (files: after the parser steps) | `too-few-points`, `too-many-points`, `many-points`, `coarse`, `zero-chord`, `not-normalized`, `rotated`, `te-missing` |
| Checks on normalized coordinates | all other checks, starting with `outline-length`; `curve-shape` tests the NURBS curve through the normalized points |
| Threshold source | `LIMITS` in `src/airfoil/sanity.js`; `WARN.pointsPerAirfoil` in `src/model/budget.js`; fixed values in `checkAirfoil()`; `CROSSING_TOLERANCE` and `REVERSAL_TOLERANCE` in `src/geom/profile.js` |

| Code | Severity | Condition | Threshold |
| --- | --- | --- | --- |
| `too-few-points` | Error | fewer points than the minimum | 5 points |
| `too-many-points` | Error | more points than the maximum. Message: `<n> points; the limit is 100,000.` | 100,000 points |
| `zero-chord` | Error | all points have the same x | – |
| `outline-length` | Error | length of the normalized outline (sum of the segment lengths) above the threshold. Runs after normalization, before `self-intersection`; stops the remaining checks. Message: `The outline is … chords long; an airfoil outline is about 2 chords long.` | 10 chords |
| `folds` | Error | number of points at which the upper or lower surface (split at the LE point) runs back in x (from LE to TE, x smaller than at the previous point) above the threshold. Runs after `outline-length`, before `self-intersection`; stops the remaining checks. Message: `The upper surface runs back in x at <n> points; the limit is 50.` (`lower` likewise). | 50 points |
| `self-intersection` | Error | 2 non-adjacent outline segments cross. The segments are binned in a grid of about 1 cell per segment; a pair of binned segments is tested once, in the lower-left cell that both bounding boxes share; a segment that covers more than 16 cells is tested against every segment; a cell with more than 32 segments is searched again with its own grid, at most 6 levels deep. The search stops at 10 crossings; the message then counts `10+`. | – |
| `one-surface` | Error | upper or lower surface (split at the LE point) has fewer points than the minimum | 3 points |
| `crossed-surfaces` | Error | thickness at one of 199 interior cosine-spaced x positions below the threshold | −0.01 % chord |
| `surfaces-touch` | Error | upper and lower surface touch: thickness at a file point or a cosine-spaced sample between 1 % and 99 % chord at or below the threshold. At each x the lowest point of the upper surface and the highest point of the lower surface count (vertical segments, surfaces that fold back in x). Reported only without `crossed-surfaces`. | 0.001 % chord |
| `te-crossed` | Error | TE gap (y of the first point − y of the last point) below the threshold | −0.01 % chord |
| `te-missing` | Error | the first or the last point lies more than the threshold before x_max (Selig order starts and ends at the TE). Message: `The first point lies at <x> % chord, not at the trailing edge; the point order is probably not Selig, or a surface is incomplete.` (`last` likewise). | 5 % chord |
| `curve-shape` | Error | the NURBS curve through the points crosses itself, or one surface of the curve runs back in x, or the NURBS interpolation through the points fails (preview message: `The NURBS interpolation through the points failed (…).`). Runs after the other checks pass, in the preview and at wing build, both with the project's **Profile parametrization** (`settings.parametrization`). Loop size: mean width = area / bounding-box diagonal of the part with the smaller bounding box ([[Geometry|Geometry]], section 1.4). | loop size above 0.05 % chord; x reversal above 0.01 % chord |
| `many-points` | Warning | more points than the threshold. Message: `<n> points (warning above 5,000): the checks and the first build of a wing that uses the airfoil take <time>.` <time>: `under 1 s` or `about <t> s`, 30 µs per point. | 5,000 points |
| `coarse` | Warning | fewer points than the threshold | 20 points |
| `not-normalized` | Warning | x_min or x_max of the file deviates from 0 or 1 by more than the threshold; the coordinates are scaled to chord 1 | 0.02 |
| `rotated` | Warning | line from the LE point to the TE midpoint inclined by more than the threshold. The coordinates are kept, so twist refers to the x axis of the file. | 0.5° |
| `non-monotonic` | Warning | x decreases along the upper or lower surface from LE to TE by more than the threshold | 0.0001 % chord |
| `te-gap` | Warning | TE gap above the threshold | 2 % chord |
| `te-base` | Warning | TE closed: \|gap\| < 1e-6 chord. First or last segment steep: \|Δx\| ≤ 0.2 · \|Δy\|, \|Δy\| > 1e-6 chord, end point within 1 % chord of the TE. Typical cause: the drawn TE base is read as surface points. | – |
| `thin` | Warning | maximum thickness below the threshold | 1 % chord |
| `thick` | Warning | maximum thickness above the threshold | 30 % chord |
| `spike` | Warning | the outline turns at a point by more than the threshold; points within 2 positions of the LE point are skipped | 90° |
| `uneven-spacing` | Info | length ratio of 2 adjacent segments above the threshold | 25 |
| `stats` | Info | point count; maximum thickness (t/c) and its position, maximum camber and its position, TE gap, in % chord. Camber: mean of upper and lower surface, measured from the chord line (LE point to TE midpoint). NACA sections show less than the designated camber: NACA 4415 3.74 % at 42.2 %. | – |

- Red circle in the preview: LE point (`rotated`), first crossing segment (`self-intersection`), first spike point (`spike`), first point (`te-base`).

### Current limitations

| Condition | Result |
| --- | --- |
| HTML table cells with other entities, e.g. `&nbsp;` | The line counts as non-numeric. When every line is affected: error `no-points`. |
| XML file with more than 1 `<coordinates>` element | Only the first is read (warning `multi-element`). |

### Real-file test

| Property | Value |
| --- | --- |
| Date | 2026-09-29 |
| Files | 1,964: mh-aerotools.de 56 HTML pages and 55 XML files; aerodesign.de 188 (154 `.dat`, 34 `.txt`); UIUC (University of Illinois Urbana-Champaign) 1,665 `.dat` |
| Files in the repository | none (license) |
| Results per set, rejected files and error messages | [[Airfoil Sources|Airfoil-Sources]], section Parser test |

## Airfoil export (`.dat`)

| Property | Value |
| --- | --- |
| Layout | Selig: name line, then one `x y` line per point |
| Points | the stored points of the airfoil, Selig order |
| Numbers | 7 decimal places, each value right-aligned in 10 characters, 1 space between x and y |
| Line end | LF, also after the last line |
| Encoding | UTF-8 |
| Source and license | not written; the name line holds the airfoil name only. `source` stays in the project JSON. |

## Project JSON

| Property | Value |
| --- | --- |
| Written by | **Save** and **Export** > **Project JSON**; same content |
| Read by | **Open** |
| Encoding | UTF-8, indentation 1 space; every array of numbers (a point, a knot vector) on one line |
| Size read by **Open** | at most 100 MB (100,000,000 bytes) |
| Units | mm, angles in degrees (°) |
| Axes | x chordwise towards the TE, y spanwise towards the right tip, z up; mirror plane y = 0 |
| Numbers in `derived` | rounded to 12 significant digits |

### Top-level keys

| Key | Type | Written | On **Open** |
| --- | --- | --- | --- |
| `format` | `"wingdesigner-project"` | always | required, must match |
| `version` | integer `1` | always | required, must be 1 |
| `generator` | `{ "name": "Wingdesigner", "version": "<app version>" }` | always | ignored |
| `exportedAt` | ISO 8601 time, UTC | always | ignored |
| `name` | string | always | not a string: `Imported wing`; at most 10,000 characters |
| `units` | `"mm"` | always | optional; any other value is rejected |
| `coordinateSystem` | text, axes as above | always | ignored |
| `airfoils` | array | always | required, 1 to 10,000 entries; at most 1,000,000 points in all |
| `sections` | array | always | required, 2 to 20,000 entries |
| `guides` | object with `nose` and `end` | always | optional; `null` counts as missing; a missing guide is created from the section edges, disabled |
| `settings` | object | always, every key | optional; a missing key takes its default; an unknown key is dropped |
| `derived` | object | only when the wing builds without errors and the file stays within 100 MB | ignored; recomputed |

**Open** drops unknown keys and their contents: at the top level and inside `airfoils[]`, `airfoils[].source`, `sections[]`, `guides`, `guides.nose`, `guides.end` and `settings`.

### `airfoils[]`

| Key | Rule |
| --- | --- |
| `id` | non-empty string, at most 200 characters, unique; referenced by `sections[].airfoil` |
| `name` | display name, a string of at most 10,000 characters; missing or only white space: the `id` |
| `points` | 5 to 100,000 `[x, y]` pairs of finite numbers, Selig order, any scale (the build normalizes them). All airfoils together: at most 1,000,000 points. Values after the second one in a pair are dropped on **Open**. |
| `source` | origin: object with the keys `kind`, `id`, `file`, `attribution`, `license`, `url`, `terms`, `note`, `code`, `closedTE`. Each value is a string of at most 2,000 characters, `true`, `false` or `null`. Other keys are dropped on **Open**. |

Ids made by the app:

1. Take the name in lower case.
2. Remove accents.
3. Replace each run of characters outside `a–z 0–9` with `-`.
4. Remove leading and trailing `-`.
5. Cut to 40 characters.
6. Empty result: `airfoil`.
7. Id already used: append `-2`, `-3` ….

- Same name and identical points as an airfoil in the project: the existing id is used; no new entry.
- Wizard and sample wing: `naca<code>`.
- Generated NACA section (`source.code` set) with the same code and the same `source.closedTE` as a project airfoil: the existing id is used, whatever the name; no new entry.
- Project with 10,000 airfoils (`LIMITS.maxAirfoils`): no new entry. The **Airfoils** tab refuses the next airfoil before the preview with the message `The project holds 10,000 airfoils, the limit; "Remove unused" frees places.`
- Airfoil that would take the points of all airfoils above 1,000,000 (`LIMITS.maxAirfoilPoints`): no new entry. Message: `With this airfoil the project airfoils hold <n> points; the limit is 1,000,000. "Remove unused" frees points.`

| `source.kind` | Further keys |
| --- | --- |
| `naca` | NACA generator, library, wizard: `license`, `url`, `code` (designation, e.g. `"2412"`), `closedTE` (`true` or `false`). Sample wing: `note`. |
| `upload` | `file` (files only), `attribution` |
| `library` | `id`, `attribution`, `license`, `url`, `terms`, copied from the entry in the bundled library index `public/airfoils/index.json` (`attribution`: `source.author` of the entry, as shown and editable in the preview field **Source / attribution**). Index: 6 files. `public-domain` (in the United States; status outside the United States not established): Clark Y, NACA 8-H-12, NACA M-6, RAF 34, USA 35B. `CC-BY-4.0`: S9104. Source, legal basis, conditions and attribution text per file: `public/airfoils/NOTICE.md`. |

### `sections[]`

| Key | Unit | Rule |
| --- | --- | --- |
| `id` | – | non-empty string, at most 200 characters, unique; missing: `s<n>`, n = position in the array from 1 |
| `airfoil` | – | `id` of an entry in `airfoils` |
| `x` | mm | chordwise position of the LE; −1,000,000 to 1,000,000 mm |
| `y` | mm | span position, 0 to 1,000,000 mm, different from every other section |
| `z` | mm | height of the LE; −1,000,000 to 1,000,000 mm |
| `chord` | mm | 1 to 100,000 mm |
| `twist` | ° | rotation about the chord point at `settings.twistPivot`; positive = LE up; −360 to 360° |

- Every value is a finite number.
- Limits: `LIMITS` in `src/model/project.js` (`minChord`, `maxChord`, `maxCoordinate`, `maxTwist`, `maxSections`, `maxAirfoils`, `maxAirfoilPoints`, `maxGuidePoints`, `maxGuideCoordinate`, `maxExtent`, `maxName`, `maxId`, `maxText`); points per airfoil: `MAX_POINTS` in `src/airfoil/parse.js`; names: `MAX_NAME` in `src/airfoil/parse.js`.
- The wing build checks the same limits (`limitErrors`), so a project that cannot be saved cannot be exported. Planform drags stay within them: chord 1 to 100,000 mm, leading-edge x within ±1,000,000 mm, section y at most 1,000,000 mm, guide point x within ±1,100,000 mm.
- Array order is free. The build sorts the sections by `y`.

### `guides.nose`, `guides.end`

`nose` is the nose line (LE in the planform), `end` the end line (TE in the planform).

| Key | Rule | Missing on **Open** |
| --- | --- | --- |
| `enabled` | `true` enables the guide, `false` disables it; any other value is rejected | `false` |
| `edited` | `true` after a point is moved, added or removed; `false` after **Reset to sections**; any other value is rejected. When a section is added or removed, or its y, x or chord changes in the **Sections** table, a guide with `enabled` `false` and `edited` not `true` is reset to the section edges. | `true` when the points differ from the section edges (another point count, or a coordinate more than 1e-9 mm off), otherwise `false` |
| `mode` | `"fit"`: curve through the points; `"control"`: the points are the control polygon | rejected |
| `degree` | integer 1–5 | `3` |
| `points` | 2 to 20,000 `[x, y]` pairs in mm, planform coordinates; x −1,100,000 to 1,100,000 mm (a disabled end line follows x + `chord` of the sections), y −1,000,000 to 1,000,000 mm. y must increase strictly (checked when the wing is built). The y range is stretched onto the root-to-tip span. | rejected |

### `settings`

| Key | Values | Default | **Settings** control |
| --- | --- | --- | --- |
| `spanwise` | `"linear"`, `"smooth"` | `"linear"` | **Spanwise interpolation** |
| `twistPivot` | `0`–`1`, fraction of chord | `0.25` | **Twist pivot (fraction of chord)** |
| `trailingEdge.mode` | `"asis"`, `"closed"`, `"thickness"` | `"asis"` | **Trailing edge** |
| `trailingEdge.thickness` | ≥ 0 mm; used with `"thickness"`; limited to 5 % of the local chord | `0.4` | **Trailing-edge thickness (mm)** |
| `tip.mode` | `"flat"`, `"pointed"` | `"flat"` | **Wing tip** |
| `tip.ratio` | `0.001`–`0.01` (tip profile 1/1000 to 1/100 of the previous section chord); tip chord at least 1 mm (`LIMITS.minChord`) | `0.005` (1/200) | **Tip profile scale 1 : N** |
| `chordSamples` | integer `16`–`200` | `60` | **Chordwise stations per surface** |
| `panelStations` | integer `3`–`40`; the build uses fewer only when the loft grid would exceed 5,000,000 points ([[Geometry|Geometry]], section 3.2) | `8` | **Spanwise stations per panel with guides or smooth mode** |
| `parametrization` | `"uniform"`, `"chord"`, `"centripetal"` | `"centripetal"` | **Profile parametrization** |
| `mirror` | `true`, `false`; 3D view only, no effect on exports | `true` | **Show mirrored half (y < 0)** |

Unknown keys inside `settings` are dropped on **Open**. **Save** writes the keys of this table.

### `derived` (export only)

| Key | Content |
| --- | --- |
| `profiles[]` | one entry per airfoil that a section uses: `airfoil` (id), `name`, `curve`, `leadingEdgeParameter` (curve parameter at the LE) |
| `guides.nose`, `guides.end` | guide curve, control points `[x, y]` in mm; `null` when the guide is disabled |
| `stations[]` | every spanwise station: `y` (mm), `v` (span fraction 0–1), `xLE`, `z`, `chord` (mm), `twist` (°) |
| `surface` | surface of the right half: `degreeU` (3), `degreeV` (1: `spanwise` `"linear"` without guides; 3: `"smooth"` or a guide enabled), `knotsU`, `knotsV`, `controlPoints`, `leadingEdgeU`, `closedTrailingEdge` |

- Curve object: `degree`, `knots`, `controlPoints`. All curves and the surface are non-rational; no `weights` key is written.
- `profiles[].curve.controlPoints`: `[x, y]` in normalized airfoil coordinates (chord 1).
- `surface.controlPoints[i][j]`: `[x, y, z]` in mm. i runs along u: u = 0 upper TE, u = `leadingEdgeU` LE, u = 1 lower TE. j runs along v: v = 0 root, v = 1 tip.
- Algorithms: [[Geometry|Geometry]].
- Size: when the file with `derived` would exceed 100 MB, **Save** and **Export** > **Project JSON** leave `derived` out and show the notice `The file leaves out the derived NURBS data: with it, the file would exceed 100 MB, the largest project file Open reads. Open recomputes it; STEP export writes the exact surfaces.`

### Checks on **Open**

The file is rejected, and the first 3 messages are shown, when:

- the text is not valid JSON;
- `format`, `version` or `units` do not match the table above;
- the file is larger than 100 MB (100,000,000 bytes; **Open** checks the file size before reading and shows `Cannot open <file>: <size> MB; project files are limited to 100 MB.`);
- `settings` is not an object, or `settings.trailingEdge` or `settings.tip` is present, not `null` and not an object;
- `guides` is neither an object nor `null`;
- `airfoils` is empty or has more than 10,000 entries, or `sections` has fewer than 2 or more than 20,000 entries;
- the airfoils hold more than 1,000,000 points together;
- an airfoil or section entry is not an object;
- an airfoil `id` is not a non-empty string, is longer than 200 characters, or is repeated;
- a section `id` is not a non-empty string, is longer than 200 characters, or is repeated;
- `name` is longer than 10,000 characters, or an airfoil `name` is present and not a string or longer than 10,000 characters;
- an airfoil `source` is present, not `null` and not an object, or a known `source` key holds something other than a string, `true`, `false` or `null`, or a string longer than 2,000 characters;
- an airfoil has fewer than 5 or more than 100,000 points, or a point that is not an `[x, y]` pair of finite numbers;
- a section `x`, `y`, `z`, `chord` or `twist` is not a finite number;
- `chord` < 1 mm or > 100,000 mm, `y` < 0, 2 sections share `y`, or `airfoil` names an unknown id;
- a section `x`, `y` or `z` lies outside −1,000,000 to 1,000,000 mm, or `twist` outside −360 to 360°;
- a `settings` value is outside the table above;
- `guides.nose` or `guides.end` is neither an object nor `null`;
- a guide `enabled` is not `true` or `false`, or a guide `edited` is present and not `true` or `false`;
- a guide `mode` is not `"fit"` or `"control"`;
- a guide has fewer than 2 or more than 20,000 points, a point that is not a pair of finite numbers, a point x outside −1,100,000 to 1,100,000 mm, or a point y outside −1,000,000 to 1,000,000 mm;
- a guide `degree` is not an integer 1–5.

Counts are checked before contents. More than 10,000 airfoils or more than 20,000 sections: the file is rejected without reading any entry. More than 1,000,000 airfoil points in all: the file is rejected before any point is read. An airfoil with more than 100,000 points or a guide with more than 20,000 points: its points are not read.

Sizes above a warning threshold and within these limits (`WARN` in `src/model/budget.js`: 200 sections, 200 airfoils, 5,000 points in one airfoil, 100,000 airfoil points in all, 500 points in an enabled guide curve, 60,000 loft grid points, a name of 200 characters) open with a warning on the **Checks** tab. The warning names the expected time and memory of each change: `Large project: <sizes>. Each change takes <time> and <memory> of browser memory.` A notice shows the same text when a size crosses its threshold.

Checked only when the wing is built, in this order:

- the airfoil sanity checks;
- `curve-shape`: the NURBS profile curve crosses itself (loop size, mean width, above 0.05 % chord) or runs back in x (above 0.01 % chord);
- guide curves: y strictly increasing; the curve does not double back in span direction; x of every control point of the curve within ±1,200,000 mm;
- interpolated section values are finite numbers (leading-edge x, chord, z, cosine of the twist);
- interpolated leading-edge x, trailing-edge x and z within ±1,200,000 mm, chord at most 100,000 mm;
- `spanwise` `"smooth"`: an interpolated value (leading-edge x, chord, z, twist or a profile point height) lies more than 2 × the range of its section values outside that range;
- blended profile thickness below 0 (`spanwise` `"smooth"`: overshoot; `"linear"`: upper and lower surface of a section airfoil cross);
- thickness after the trailing-edge setting below 0;
- upper and lower surface touch after blending or after the trailing-edge setting: thickness at a chord station between 1 % and 99 % chord at or below 0.001 % chord;
- chord below 1 mm;
- fitted surface has non-finite coordinates;
- fitted surface turns inside out (local thickness below 0) or has zero thickness (at most 0.001 % chord between 1 % and 99 % chord) between stations;
- fitted surface chord below 0.9 mm between stations (surface folds or narrows);
- loft surface row crosses itself at a section, halfway between 2 sections or halfway between the 2 stations of one of the 64 widest station intervals (loop size, mean width, above 0.05 % of the local chord).

With `parametrization` `"chord"` or `"uniform"`, an airfoil error at wing build (sanity check or `curve-shape`) ends with `Settings > Profile parametrization "centripetal" follows the points more closely.`

An error blocks the wing and the STEP, STL and 3MF export. Messages: [[User Guide|User-Guide]], section Checks.

### Example

Sample wing `Sport wing 1500`, shortened; `"..."` marks omitted entries:

```json
{
 "format": "wingdesigner-project",
 "version": 1,
 "generator": { "name": "Wingdesigner", "version": "0.1.0" },
 "exportedAt": "2026-09-29T12:00:00.000Z",
 "name": "Sport wing 1500",
 "units": "mm",
 "coordinateSystem": "x chordwise towards the trailing edge, y spanwise towards the right tip, z up; mirror plane y = 0",
 "airfoils": [
  { "id": "naca2412", "name": "NACA 2412",
    "points": [[1.00008381395326, 0.001257209298899305], "..."],
    "source": { "kind": "naca", "note": "Generated from the NACA 4/5-digit equations (NACA Report 824)." } },
  "..."
 ],
 "sections": [
  { "id": "root", "twist": 0, "z": 0, "airfoil": "naca2412", "x": 0, "y": 0, "chord": 240 },
  { "id": "mid", "twist": -0.8, "z": 12, "airfoil": "naca2412", "x": 12, "y": 450, "chord": 205 },
  { "id": "tip", "twist": -2.5, "z": 33, "airfoil": "naca2410", "x": 55, "y": 750, "chord": 130 }
 ],
 "guides": {
  "nose": { "enabled": false, "mode": "fit", "degree": 3, "points": [[0, 0], [12, 450], [55, 750]] },
  "end": { "enabled": false, "mode": "fit", "degree": 3, "points": [[240, 0], [217, 450], [185, 750]] }
 },
 "settings": {
  "spanwise": "linear", "twistPivot": 0.25,
  "trailingEdge": { "mode": "thickness", "thickness": 0.5 },
  "tip": { "mode": "flat", "ratio": 0.005 },
  "chordSamples": 60, "panelStations": 8, "parametrization": "centripetal", "mirror": true
 },
 "derived": {
  "profiles": [
   { "airfoil": "naca2412", "name": "NACA 2412",
     "curve": { "degree": 3, "knots": [0, 0, 0, 0, 0.00328475901275, "..."], "controlPoints": [[1, 0.00125710393605], "..."] },
     "leadingEdgeParameter": 0.500163244987 },
   "..."
  ],
  "guides": { "nose": null, "end": null },
  "stations": [
   { "y": 0, "v": 0, "xLE": 0, "z": 0, "chord": 240, "twist": 0 },
   { "y": 450, "v": 0.6, "xLE": 12, "z": 12, "chord": 205, "twist": -0.8 },
   { "y": 750, "v": 1, "xLE": 55, "z": 33, "chord": 130, "twist": -2.5 }
  ],
  "surface": {
   "degreeU": 3, "degreeV": 1,
   "knotsU": [0, 0, 0, 0, 0.00508170557159, "..."], "knotsV": [0, 0, 0.6, 1, 1],
   "controlPoints": [[[240.020113789, 0, -0.123958345176], "..."], "..."],
   "leadingEdgeU": 0.501704806629, "closedTrailingEdge": false
  }
 }
}
```

Counts in this file: 161 points per airfoil, 165 profile knots, 121 × 3 surface control points, 125 `knotsU`.

### Browser copy (`localStorage`)

| Property | Value |
| --- | --- |
| Key | `wingdesigner.project.v1` |
| Stored keys | same as the project JSON, without `generator`, `exportedAt`, `coordinateSystem` and `derived` |

| Event | Behaviour |
| --- | --- |
| Change in the app | stored only when the project passes the checks on **Open**; otherwise the last valid copy stays |
| Page hidden or left (reload, closing the tab) before the next animation frame | the pending change is stored at once (`pagehide`, `visibilitychange`) |
| First-run wizard open | nothing stored; a reload opens the wizard again |
| Stored copy fails the checks on load | text copied to the key `wingdesigner.project.v1.rejected`, red notice with the first problem, the first-run wizard opens over the sample wing `Sport wing 1500` |
| `localStorage` unavailable or full | no copy; the project exists only in the open browser tab |

## Bodies per file

| **Wing halves** option | STEP | STL | 3MF |
| --- | --- | --- | --- |
| **Both halves as separate bodies** | 2 solids | 1 file, 2 closed shells | 2 objects: `Wing right`, `Wing left` |
| **Full wing as one body (mesh formats, root at y = 0)** | 2 solids | 1 closed shell | 1 object: `Wing` |
| **Right half only** | 1 solid | 1 closed shell | 1 object: `Wing right` |

- **Full wing** needs the root section at |y| < 1e-9 mm. Otherwise STL and 3MF contain 2 shells, as with **Both halves**.
- **Mesh density (STL, 3MF)**: **Normal** or **Fine (4x triangles)**. **Fine** splits every u interval (chordwise) and every v interval (spanwise) of the **Normal** mesh into 2. Measured triangle count: 3.0 to 3.9 times **Normal** (table "File sizes").
- Mesh construction and triangle counts: [[Geometry|Geometry]], section 5 "Meshes".

![Export dialog: format, wing halves, mesh density](images/export-dialog.png)

## STEP

| Property | Value |
| --- | --- |
| File | ISO 10303-21 text file |
| Schema | `AUTOMOTIVE_DESIGN { 1 0 10303 214 1 1 1 1 }` (AP214) |
| `FILE_DESCRIPTION` | `(('Wingdesigner wing'),'2;1')` |
| `FILE_NAME` name | `<name>` (section "Export file names") |
| `FILE_NAME` time | export time in UTC, `YYYY-MM-DDThh:mm:ss` |
| `FILE_NAME` author, organization | empty |
| `FILE_NAME` preprocessor, originating system | `Wingdesigner` |
| Product | `PRODUCT` with `<name>`, category `part` |
| Units | millimetre, radian, steradian |
| Uncertainty | 1e-7 mm (`distance_accuracy_value`) |
| Solids | 1 `MANIFOLD_SOLID_BREP` (boundary representation solid) per half |
| Solid names | `<name> right` (y ≥ 0), `<name> left` (mirrored, y ≤ 0) |
| Shape representation | 1 `ADVANCED_BREP_SHAPE_REPRESENTATION` named `<name>` holds all solids |
| Surfaces | `B_SPLINE_SURFACE_WITH_KNOTS`, non-rational: upper surface, lower surface, open TE. `PLANE`: root and tip. |
| Edge curves | `B_SPLINE_CURVE_WITH_KNOTS` |
| Numbers | shortest decimal that reproduces the 64-bit float value, always with a decimal point, exponent `E` |
| Strings | `'` and `\` doubled. Characters outside U+0020–U+007E as `\X2\hhhh\X0\` or `\X4\hhhhhhhh\X0\`. |

Faces, edges, orientation flags and the OpenCascade validation: [[Geometry|Geometry]], section 6 "STEP topology".

## STL

| Property | Value |
| --- | --- |
| Variant | binary, little-endian |
| Header | 80 bytes: `Wingdesigner <name>` (section "Export file names"), UTF-8, cut at 80 bytes, padded with zero bytes |
| Triangle count | `uint32` |
| Per triangle | 50 bytes: normal (3 × `float32`), 3 vertices (9 × `float32`), attribute `uint16` = 0 |
| File size | 84 + 50 × triangle count bytes |
| Units | mm. STL has no unit field. |
| Normals | unit length, computed from the vertices; vertices counterclockwise seen from outside, normals point outward |

## 3MF

| Property | Value |
| --- | --- |
| Package | zip, deflate level 6: `[Content_Types].xml`, `_rels/.rels`, `3D/3dmodel.model` |
| Namespace | `http://schemas.microsoft.com/3dmanufacturing/core/2015/02` (3MF Core) |
| `<model>` | `unit="millimeter"`, `xml:lang="en-US"` |
| Metadata | `Title` = `<name>` (section "Export file names"), `Application` = `Wingdesigner` |
| Objects | 1 `<object type="model">` per shell, 1 `<build><item>` per object; names: table "Bodies per file" |
| Vertices | up to 5 decimal places (0.00001 mm), trailing zeros removed |
| Triangles | `v1`, `v2`, `v3`: vertex indices from 0, counterclockwise seen from outside |
| Zip entry date | fixed at 2026-01-01 00:00 UTC, stored in the local time of the browser; not the export time |

## File sizes

Measured on 2026-09-29 with **Both halves as separate bodies** and default resolution (60 chordwise
stations per surface). 1 KB = 1024 bytes. Triangle counts in parentheses.

| Project | Sections | Spanwise stations | STEP | STL **Normal** | STL **Fine** | 3MF **Normal** | 3MF **Fine** | JSON |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Sample wing `Sport wing 1500` | 3 | 3 | 122 KB | 71 KB (1444) | 235 KB (4812) | 18 KB | 56 KB | 77 KB |
| Wizard preset **Sport** | 2 | 2 | 99 KB | 47 KB (960) | 141 KB (2884) | 10 KB | 35 KB | 69 KB |
| Wizard preset **Glider**, elliptic guides | 3 | 17 | 445 KB | 1158 KB (23708) | 4566 KB (93500) | 254 KB | 1000 KB | 205 KB |
