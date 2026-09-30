Deutsch: [[Dateiformate|Dateiformate]]

# File formats

| Direction | Content | Format | Extension | Control |
| --- | --- | --- | --- | --- |
| Import | Airfoil coordinates | Selig, Lednicer, x/upper/lower table, XML, HTML | `.dat` `.txt` `.cor` `.xml` `.htm` `.html` `.csv` | **Airfoils** > **Upload**: **Choose files**, drop zone, or **Check pasted text** |
| Import | Project | JSON | `.json` | **Open** |
| Import | One wing or horizontal stabilizer from XFLR5 | XFLR5 project, XFLR5 plane or wing XML | `.xfl` `.xml` | **Open** |
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
| VLM | vortex lattice method |

The interface speaks English or German ([[User Guide|User-Guide]], section Language). Messages quoted on this page are the English texts; the German interface writes them in German ([[Dateiformate]]). Codes such as `too-large` name the checks in this documentation; the app does not show them. File contents do not depend on the language: numbers have a decimal point, and keys and fixed names are English. Only a name that the app creates, such as the default project name, is written in the language that is set when the name is created.

## Export file names

1. Take the project name. For an airfoil `.dat`, take the airfoil name. Empty name: `wing`.
2. Write German umlauts out: ä → ae, ö → oe, ü → ue, Ä → Ae, Ö → Oe, Ü → Ue, ß → ss. A letter written as a base letter plus a combining diaeresis counts as the umlaut.
3. Remove other accents (é → e, ñ → n).
4. Replace each run of characters outside `A–Z a–z 0–9 . _ -` with one `_`.
5. Remove leading and trailing `_`.
6. Cut to 120 characters.
7. Empty result: `wing`.
8. Add the extension.

The rule is the same in the English and the German interface.

| Name | File name |
| --- | --- |
| `Sport wing 1500` | `Sport_wing_1500.step` |
| `Sportflügel 1500` | `Sportfluegel_1500.step` |
| `Größe ÄÖÜ Café` | `Groesse_AeOeUe_Cafe.json` |

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
| XFLR5 files | An `.xfl` project of any size or an XFLR5 XML file up to 20 MB (a larger one gets the size notice) is not read as an airfoil: `<file> is an XFLR5 file, not an airfoil. Use Open to import a wing from it.` Applies to uploaded files, not to pasted text. Rules: section "XFLR5 import". |
| Line ends | CR, LF or CR LF (carriage return, line feed) |
| Comments | `#` to the end of the line. Exception: the name line (row Name). |
| Numeric line | 2 or more numbers and nothing else |
| Separators | space, tab, comma, semicolon |
| Decimal comma | `0,125  1,250` is read as `0.125  1.250`. Conditions: at least 2 values. Separators: spaces, tabs or semicolons. Every value is a decimal-comma number or an integer, either with an optional exponent (`e`, `E`, `d` or `D`), e.g. `1,25e-1`. At least 1 value has a comma. A line with 1 field, e.g. `0,5`, is split at the comma: values `0` and `5`. |
| Number syntax | optional sign, decimal point, exponent with `e`, `E`, `d` or `D` (`1.0D-3`). XML `<x>` and `<y>` values follow the same syntax and the decimal-comma rule; other text, e.g. `0x1`, is not a number (error `non-finite`). |
| Name | First non-numeric line before the first numeric line. The name line keeps a `#` comment: `NACA 0012 # from UIUC` → name `NACA 0012 # from UIUC`. HTML: the `<title>` when not empty. XML: the first `<name>` element. None found: the file name without extension; pasted text: `pasted` in the English interface, `Eingefügtes Profil` in the German interface. The name is stored as text: a later change of the language does not rename the airfoil. A name longer than 10,000 characters is cut to the first 10,000 (info `long-name`). |
| Column header lines | 2 or 3 words that start with `x`, `y` or `z`, separated by spaces, tabs, commas or semicolons (`x y`, `x;y`, `X Yo Yu`, `x/c y/c`, `X Y_upper Y_lower`). After the name line: skipped without a message. As the first non-numeric line before the first numeric line: taken as the name (e.g. `X Yo Yu`), no info `no-name`. |
| Other non-numeric lines | Skipped, warning `ignored-lines` |

### Layouts

Checked in this order. The first match applies.

| Order | Layout | Condition | Point order |
| --- | --- | --- | --- |
| 1 | XML | text contains `<coordinates>` | `<point><x>…</x><y>…</y></point>` list of the first `<coordinates>` element |
| 2 | HTML | text contains an `<html`, `<pre` or `<body` tag | Text of all `<pre>` blocks. Without `<pre>`: page text; inside a `<table>`, white space collapses, each row (`<tr>`), caption, row group and `<br>` starts a line, and each cell becomes a column, whatever markup it holds (`<p>`, `<div>`) and with or without end tags. Rules 3–5 then apply to that text. |
| 3 | Table | every numeric line has 3 values, 3 or more lines, x strictly increasing or strictly decreasing, y_upper ≥ y_lower on ≥ 90 % of the lines | x, y_upper, y_lower per line (e.g. "X Yo Yu" tables); a table with decreasing x is read in reverse order |
| 4 | Lednicer | all 3 Lednicer conditions below | counts line, upper surface LE → TE, lower surface LE → TE |
| 5 | Selig | all other files | upper TE → LE → lower TE |

Lednicer conditions:

- The first numeric line holds 2 integers ≥ 2 (e.g. `61. 61.`).
- At least 1 more numeric line follows.
- The x of the next line lies within 1 % of the x range above the smallest x of all following lines: the upper surface starts at the LE.
- The lower surface also starts within 1 % of the x range of the smallest x: at the announced split when the counts match the number of following lines, otherwise at the first x reset (rule below), which must leave at least 2 points per surface. A percent Selig file whose trailing-edge line holds 2 integers, e.g. `100 2`, fails these conditions and reads as Selig.

Further rules:

- XML and HTML: entities decoded are `&lt;` `&gt;` `&quot;` `&apos;` `&amp;`, `&nbsp;` (read as a space), `&#NNN;` and `&#xHHHH;` (as Unicode code points, in one pass, so `&amp;lt;` becomes `&lt;`). A reference to a surrogate or above U+10FFFF stays as written. Without `<pre>`, the content of `<head>`, `<title>`, `<script>` and `<style>` is dropped.
- Lednicer: when the counts do not match the number of points, the surfaces are split at the first x reset. x reset: x drops by more than 25 % of the previous x.
- Lines with more than 2 values that do not form a table: columns 1 and 2 are used.

### After reading

Steps in this order:

1. A value that is not a finite number stops the import (error `non-finite`).
2. No point found: the import stops (error `no-points`).
3. More than 100,000 points: the import stops (error `too-many-points`: `<n> points; the limit is 100,000.`).
4. Consecutive duplicate points (equal x and equal y) are removed (info `duplicates`), so a closing point written twice counts once in step 5.
5. Closed outline with a blunt TE: points on the drawn TE base are removed (warning `closing-point`, rules below). TE base: the steep segment that closes a blunt TE.
6. Largest x above 5 and at most 110: the coordinates are percent of chord and are divided by 100.
7. Clockwise point order (lower surface first): the order is reversed to Selig order. The signed area is summed relative to the first point in units of the outline extent, so the test gives the same result at every scale.
8. The sanity checks run (section "Sanity checks").

Rules for step 5. They apply when there are more than 4 points and the last point equals the first point (equal x and equal y).

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
| LE point | point farthest from the TE midpoint (mean of the first and the last point); squared distances within a relative 1e-15 of the largest count as equal, and of those the point with the smallest x wins; y_LE is its y |
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
| `self-intersection` | Error | 2 non-adjacent outline segments cross. A crossing of the first and the last segment does not count when their free ends lie at most 1e-4 of the chord apart (`TE_CROSS_TOLERANCE`, the `te-crossed` limit): UIUC files that start at x = 1.00000 and end at x = 1.00001 cross there by 2.7e-7 of the chord. The segments are binned in a grid of about 1 cell per segment; a pair of binned segments is tested once, in the lower-left cell that both bounding boxes share; a segment that covers more than 16 cells is tested against every segment; a cell with more than 32 segments is searched again with its own grid, at most 6 levels deep. The search stops at 10 crossings; the message then counts `10+`. | – |
| `one-surface` | Error | upper or lower surface (split at the LE point) has fewer points than the minimum | 3 points |
| `crossed-surfaces` | Error | thickness at one of 199 interior cosine-spaced x positions below the threshold | −0.01 % chord |
| `surfaces-touch` | Error | upper and lower surface touch: thickness at a file point or a cosine-spaced sample between 1 % and 99 % chord at or below the threshold. At each x the lowest point of the upper surface and the highest point of the lower surface count (vertical segments, surfaces that fold back in x). Reported only without `crossed-surfaces`. | 0.001 % chord |
| `te-crossed` | Error | TE gap (y of the first point − y of the last point) below the threshold | −0.01 % chord |
| `te-missing` | Error | the first or the last point lies more than the threshold before x_max (Selig order starts and ends at the TE). Message: `The first point lies at <x> % chord, not at the trailing edge; the point order is probably not Selig, or a surface is incomplete.` (`last` likewise). | 5 % chord |
| `curve-shape` | Error | the NURBS curve through the points crosses itself, or one surface of the curve runs back in x, or the NURBS interpolation through the points fails (preview message: `The NURBS interpolation through the points failed (…).`). Runs after the other checks pass, in the preview and at wing build, both with the project's **Profile parametrization** (`settings.parametrization`). Loop size: mean width = area / bounding-box diagonal of the part with the smaller bounding box ([[Geometry]], section 1.4). | loop size above 0.05 % chord; x reversal above 0.01 % chord |
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
| HTML table cells with other named entities, e.g. `&ensp;` | The line counts as non-numeric. When every line is affected: error `no-points`. |
| XML file with more than 1 `<coordinates>` element | Only the first is read (warning `multi-element`). |

### Real-file test

| Property | Value |
| --- | --- |
| Date | 2026-09-29 |
| Files | 1,964: mh-aerotools.de 56 HTML pages and 55 XML files; aerodesign.de 188 (154 `.dat`, 34 `.txt`); UIUC (University of Illinois Urbana-Champaign) 1,665 `.dat` |
| Files in the repository | none (license) |
| Results per set, rejected files and error messages | [[Airfoil Sources]], section Parser test |

## Airfoil export (`.dat`)

| Property | Value |
| --- | --- |
| Layout | Selig: name line, then one `x y` line per point. A name that reads as a coordinate row (e.g. `123 456`) or as a comment (e.g. `# custom`, since the reader drops `#` to the line end) gets the prefix `Airfoil `; `<` before `coordinates>`, or before `html`, `pre` or `body` followed by a space, `>` or the end of the name, is written as `‹`, so the file is not read as XML or HTML. |
| Points | the stored points of the airfoil, Selig order |
| Numbers | 7 decimal places for an outline extent of 1 or more (extent: the larger of the x range and the y range); below, 7 − floor(log10(extent)) decimal places, e.g. 13 for a 1e-6 chord at any x offset; more when 2 consecutive distinct points would round to the same line: at least 1 − floor(log10(d)) decimal places, d = the smallest non-zero coordinate difference of consecutive points; above 100 decimal places, 17 significant digits. Each value right-aligned in at least 10 characters, 1 space between x and y |
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
| Numbers in `derived` | full 64-bit precision: the shortest decimal that reads back to the same value (up to 17 significant digits) |

### Top-level keys

| Key | Type | Written | On **Open** |
| --- | --- | --- | --- |
| `format` | `"wingdesigner-project"` | always | required, must match |
| `version` | integer `1` | always | required, must be 1 |
| `generator` | `{ "name": "Wingdesigner", "version": "<app version>" }` | always | ignored |
| `exportedAt` | ISO 8601 time, UTC | always | ignored |
| `name` | string | always | not a string: `Imported wing` (German interface: `Importierter Flügel`); at most 10,000 characters |
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
2. Remove accents (ü → u; the umlaut rule of the file names does not apply).
3. Replace each run of characters outside `a–z 0–9` with `-`.
4. Remove leading and trailing `-`.
5. Cut to 40 characters.
6. Empty result: `airfoil`.
7. Id already used: append `-2`, `-3` ….

- Same name and identical points as an airfoil in the project: the existing id is used; no new entry.
- Wizard and sample wing: `naca<code>`.
- Generated NACA section (`source.code` set) with the same code and the same `source.closedTE` as a project airfoil whose stored points are that section (generator points within 1e-9, or points identical to the added ones): the existing id is used, whatever the name; no new entry. Stored points that differ from both (e.g. edited in an opened file): new entry.
- Project with 10,000 airfoils (`LIMITS.maxAirfoils`): no new entry. The **Airfoils** tab refuses the next airfoil before the preview with the message `The project holds 10,000 airfoils, the limit; "Remove unused" frees places.`
- Airfoil that would take the points of all airfoils above 1,000,000 (`LIMITS.maxAirfoilPoints`): no new entry. Message: `With this airfoil the project airfoils hold <n> points; the limit is 1,000,000. "Remove unused" frees points.`

| `source.kind` | Further keys |
| --- | --- |
| `naca` | NACA generator, library, wizard: `license`, `url`, `code` (designation, e.g. `"2412"`), `closedTE` (`true` or `false`). Sample wing: `note`. |
| `upload` | `file` (files only), `attribution` |
| `library` | `id`, `attribution`, `license`, `url`, `terms`, copied from the entry in the bundled library index `public/airfoils/index.json` (`attribution`: `source.author` of the entry, as shown and editable in the preview field **Source / attribution**). Index: 6 files. `public-domain` (in the United States; status outside the United States not established): Clark Y, NACA 8-H-12, NACA M-6, RAF 34, USA 35B. `CC-BY-4.0`: S9104. Source, legal basis, conditions and attribution text per file: `public/airfoils/NOTICE.md`. |
| `xflr5` | Airfoil of an imported XFLR5 project (`.xfl`): `file` (name of the XFLR5 file), `note`, `attribution` (only for some names). Section "XFLR5 import", subsection "Result of the import". |

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
| `tip.ratio` | `0.001`–`0.01` (tip profile 1/1000 to 1/100 of the previous section chord); tip chord at least 1 mm (`LIMITS.minChord`) | `0.005` (1/200) | **Tip profile scale 1 : N of the previous section chord** |
| `chordSamples` | integer `16`–`200` | `60` | **Chordwise stations per surface** |
| `panelStations` | integer `3`–`40`; the build uses fewer only when the loft grid would exceed 5,000,000 points ([[Geometry]], section 3.2) | `8` | **Spanwise stations per panel with guides or smooth mode** |
| `parametrization` | `"uniform"`, `"chord"`, `"centripetal"` | `"centripetal"` | **Profile parametrization** |
| `mirror` | `true`, `false`; 3D view only, no effect on exports | `true` | **Show mirrored half (y < 0)** |

Unknown keys inside `settings` are dropped on **Open**. **Save** writes the keys of this table.

### `derived` (export only)

| Key | Content |
| --- | --- |
| `profiles[]` | one entry per airfoil that a section uses: `airfoil` (id), `name`, `curve`, `leadingEdgeParameter` (curve parameter at the LE) |
| `guides.nose`, `guides.end` | guide curve, control points `[x, y]` in mm; `null` when the guide is disabled |
| `stations[]` | every spanwise station: `y` (mm), `v` (span fraction 0–1), `xLE`, `z`, `chord` (mm), `twist` (°) |
| `surface` | surface of the right half: `degreeU` (3), `degreeV` (1: `spanwise` `"linear"` without guides; `"linear"` with a guide enabled: 3, or 2 or 1 when the loft grid limit lowers the stations per panel to 2 or 1; `"smooth"`: 3), `knotsU`, `knotsV`, `controlPoints`, `leadingEdgeU`, `closedTrailingEdge` |

- Curve object: `degree`, `knots`, `controlPoints`. All curves and the surface are non-rational; no `weights` key is written.
- `profiles[].curve.controlPoints`: `[x, y]` in normalized airfoil coordinates (chord 1).
- `surface.controlPoints[i][j]`: `[x, y, z]` in mm. i runs along u: u = 0 upper TE, u = `leadingEdgeU` LE, u = 1 lower TE. j runs along v: v = 0 root, v = 1 tip.
- Algorithms: [[Geometry|Geometry]].
- Size: **Save** and **Export** > **Project JSON** estimate the characters of `derived`: its count of numbers times the mean length of the coordinates of at most 1,000 surface control points spread over the surface, plus 2 characters per number. Up to 110 MB by this estimate they write the file with `derived` and measure it. When the estimate exceeds 110 MB or the written file exceeds 100 MB, they leave `derived` out and show the notice `The file leaves out the derived NURBS data: with it, the file would exceed 100 MB, the largest project file Open reads. Open recomputes it; STEP export writes the exact surfaces.`
- Without `derived`, a text above 100 MB is written without indentation. When it still exceeds 100 MB (names and source texts near their limits, e.g. 10,000 airfoils with 10,000-character names), no file is written; **Save** shows `Save failed: the project takes … MB as a file, above the 100 MB that Open reads.`

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

## XFLR5 import

**Open** reads an XFLR5 project (`.xfl`) or an XFLR5 plane or wing file (`.xml`) and imports one surface from it: the main wing or the horizontal stabilizer (XFLR5 calls it the elevator). XFLR5 is a program for the analysis of airfoils and wings. A dialog asks for the plane, the surface and the airfoils, and shows a report; its controls are described in [[User Guide|User-Guide]], section Import from XFLR5. **Import** replaces the current project as one undo step. **Cancel** changes nothing and adds no undo step.

### Supported files

| File | Written by | Content | Import |
| --- | --- | --- | --- |
| `.xfl` project, format 200001 | XFLR5 6.10.01 to 6.43 | planes in metres; airfoils with coordinates | yes |
| `.xfl` project, format 200002 | XFLR5 6.44 to 6.62 | the same | yes |
| XML plane file: `<explane version="1.0">` with `<Plane>` | XFLR5 6.11 to 6.62 (the element `<Type>` from 6.12) | wings in the length unit that XFLR5 displays; airfoil names, no coordinates | yes |
| XML wing file: `<explane version="1.0">` with `<wing>` and without `<Plane>` | XFLR5 6.41 to 6.62 (wing editor, export to an XML file) | one wing; position 0, 0, 0 and tilt angle 0 | yes |

- XFLR5 6.62 is the last XFLR5 release.
- An `.xfl` project holds the airfoil coordinates. An XML file holds only the airfoil names (section "Airfoils").
- An `.xfl` project can hold many planes. XFLR5 writes one plane into an XML plane file; a file with several `<Plane>` elements lists each of them.

### Refused files

A refused file shows the red notice `Cannot open <file>: <message>`. The design stays as it is, and no undo step is added. The codes name the cases in this documentation; the app does not show them.

| Code | File | Message |
| --- | --- | --- |
| `wpa` | `.wpa` project (XFLR5 6.02 to 6.09) | `The file is a .wpa project of XFLR5 6.09 or older: open it in XFLR5 6.62 and save it as .xfl.` |
| `flow5` | flow5 project (`.fl5`, flow5 7.x): first number 500000 to 509999 | `The file is a flow5 project (.fl5); only XFLR5 files can be imported.` |
| `flow5` | flow5 XML file: root element `xflplane`, `xflwing`, `xflfuse`, `xflboat` or `xflsail`, in any case | `The file is a flow5 XML file (root element "xflplane"); only XFLR5 files can be imported.` |
| `not-xflr5` | binary file whose first number is not 200001 or 200002 | `The file is not an XFLR5 project (it starts with 7b 22 66 6f).` The bytes are the first 4 bytes of the file in hexadecimal. |
| `not-xflr5` | empty file | `The file is empty, not an XFLR5 project.` |
| `no-plane` | `.xfl` project without a plane: an airfoil-only project, every `.xfl` file that flow5 saves | `The project holds no plane (airfoil-only projects and .xfl files saved by flow5 have none).` |
| `damaged` | `.xfl` project cut off or inconsistent in the header, a plane, a wing, a wing section or a body | `The file is damaged or cut off at byte <n> (in <part>).` |
| `not-plane-xml` | XML file whose root element is not `explane` (case-sensitive) or whose `version` is not `1.0` | `The file is not an XFLR5 plane or wing file (root element "<root>", version "<version>").` |
| `not-plane-xml` | text that does not start with an XML element (white space, XML declaration, DOCTYPE (document type declaration) and comments before it are accepted) | `The file is not an XFLR5 plane or wing file: it does not start with an XML element.` |
| `no-plane` | XML file with neither `<Plane>` nor `<wing>` | `The XML file holds no plane and no wing.` |
| `fin` | XML wing file whose wing is a fin (`<Type>FIN</Type>` or `<isFin>true</isFin>`) | `The XML wing "<name>" is a fin; only a main wing or a horizontal stabilizer can be imported.` |
| `damaged` | XML file with `length_unit_to_meter` below 1e-6 or above 1000, or not a number | `The length unit of the XML file is not valid: length_unit_to_meter is "<value>".` |
| `damaged` | XML file with a malformed tag, a comment, CDATA (character data) section or declaration that is not closed, an end tag without or with the wrong start tag, an element left open at the end, or anything but white space, comments and declarations after the root element | `The XML file is damaged at line 12: a tag is malformed.` `The XML file is damaged at line 12: </Chord> does not close <y_position>.` `The XML file is cut off: the element <Sections> is not closed.` The other 3 texts name the same kinds of damage. |
| `too-large` | a limit of the readers is exceeded | section "Limits" |
| – | other XFLR5 files, e.g. `.xwimp` wing text files | not recognized. **Open** reads the file as project JSON and rejects it: `Invalid JSON: …` |

`<part>` in the `damaged` message of an `.xfl` project is one of: the list of planes, a plane, a wing, a wing section, the body of a plane, the list of analyses, an analysis, the list of analysis results, an analysis result, the list of airfoils, an airfoil, the project header. Damage in the analyses, the analysis results or the airfoils, which follow the planes, does not refuse the file: the planes are offered, no airfoil is read, and the report holds the warning `The airfoils could not be read. <damage message> Pick or upload them.`

### How Open chooses the reader

| Property | Rule |
| --- | --- |
| File picker filter | `.json` `.xfl` `.xml` `.wpa` `.fl5` `application/json`; `.wpa` and `.fl5` files are listed so that Open can name the reason it refuses them. Whether the file pickers of Android and iOS list `.xfl` files with this filter is unknown; untested. |
| File extension | compared in lower case: `.XFL` counts as `.xfl` |
| Extension `.xfl`, `.wpa`, `.fl5` | the `.xfl` project reader. It recognizes `.wpa` and `.fl5` files and refuses them with their own message (section "Refused files"). |
| Extension `.xml` | XML reader |
| Extension `.json` | project JSON (section "Project JSON") |
| Another extension, or none | The first 4 bytes decide: an integer 200001 or 200002, read big-endian (`.xfl`), 500000 to 509999 (flow5) or, read little-endian, 100000 to 100100 (`.wpa`): the `.xfl` project reader. A file that starts with a UTF-16 byte order mark (`FF FE` or `FE FF`) goes to the XML reader. Otherwise the file is read as text: text that starts, after white space, with `<?xml`, `<!` or `<explane` goes to the XML reader; any other text is read as project JSON. |
| Size | `.xfl`: at most 2,000 MB (2,000,000,000 bytes). Every other file: at most 100 MB (100,000,000 bytes), as for project JSON; larger: `Cannot open <file>: <size> MB; project files are limited to 100 MB.` |
| Reading an `.xfl` | Through windows of 4,194,304 bytes of the file (`Blob.slice`); a file larger than one window is never in memory as a whole. Real projects with analysis results reach 96.7 MB (measured). The analyses and their results are skipped without decoding; only the planes and the airfoils are read. |
| Text encoding of XML | UTF-16 (16-bit Unicode Transformation Format) after a byte order mark; otherwise UTF-8 with or without BOM; a file that is not valid UTF-8 is read as Windows-1252. |
| Airfoil upload | A file that is an `.xfl` project (first number 200001 or 200002, at any size; above 20,000,000 bytes only the first 4 bytes are read for this) or whose text contains `<explane` followed by white space, `>` or `/` is not read as an airfoil: `<file> is an XFLR5 file, not an airfoil. Use Open to import a wing from it.` This holds for **Airfoils** > **Upload** with **Choose files** or the drop zone, and for **Upload .dat** in the import dialog. Any other file above 20,000,000 bytes, an XML file too, gets the size notice of the upload there (`<file>: <size> MB; airfoil files are limited to 5,000,000 characters.`). **Check pasted text** does not test for it. |

### How the file is read

| Property | Rule |
| --- | --- |
| Length unit | `.xfl`: metres. XML: `<Units><length_unit_to_meter>`, the unit that XFLR5 displays, in metres per unit: mm (millimetre) 0.001, cm (centimetre) 0.01, dm (decimetre) 0.1, m (metre) 1, in (inch) 0.0254, ft (foot) 0.3048. Without `<Units>`: metres. `<Units>` applies only to what follows it, as in XFLR5, which always writes it first. Any other value from 1e-6 to 1000 is used as it is (info `Lengths converted to mm from a file unit of <factor> mm.`). |
| Angles | degrees in both formats |
| Conversion | k = 1000 for `.xfl`; k = 1000 · `length_unit_to_meter` for XML. Lengths in mm are k times the file values. Info for a unit other than mm: `Lengths converted from inches to mm.` |
| Precision of XML files | XFLR5 writes `y_position`, `Chord` and `xOffset` with 3 decimals in the file unit, `Dihedral`, `Twist` and `Tilt_angle` with 3 decimals in degrees, and `Position` with 5 significant digits. The step of the lengths in mm: mm 0.001, cm 0.01, dm 0.1, m 1, in 0.0254, ft 0.3048. A metre file, XFLR5's default, rounds to 1 mm: info `XFLR5 rounds lengths in metre XML files to 1 mm; the .xfl project file keeps full precision.` An `.xfl` project keeps 64-bit numbers. Measured on 32 pairs of the same plane or wing read from an `.xfl` project and from XML: the sections agree within these steps. |
| XML numbers | A decimal number: optional sign, decimal point (not a comma), optional exponent (`1.2346e+05`), white space around it; integers such as `650` count. XFLR5 reads empty or non-numeric text as 0. The import keeps the value as missing: warning `Plane "<plane>", wing "<wing>", section <n>: Chord "<text>" is not a number.`, then the mapping stops with an error at that section. A missing `y_position` or `Chord` counts the same. A missing `xOffset`, `Dihedral` or `Twist` is 0, as in XFLR5. |
| XML text | Element names are compared without case; unknown elements are skipped. The spelling `Symetric` (one m) is XFLR5's. The 5 XML entities and numeric character references are decoded. XML declaration, DOCTYPE, comments, CDATA sections and a byte order mark are accepted. |
| Position | `x, y, z` in the file unit. XML with fewer than 3 values: 0, 0, 0 and a warning, as in XFLR5. `.xfl`: a position component or a tilt angle that is not a number, below 1e-6 in magnitude or above 1000 in magnitude becomes 0, as when XFLR5 loads the file. |
| Left-side airfoils | not used. The geometry of XFLR5's wing is mirrored; the right-side airfoils build the half wing (+y). |
| Reserved blocks (`.xfl`) | Every wing and plane record ends in a block of 20 integers and 50 numbers. XFLR5 6.11 and later write zeros; a wing writes 0 or 1 first and its type (0 to 4) last. XFLR5 6.10.01 to 6.10.04 write the index instead: 0 to 19 and 0 to 49. Any other content ends the read with `damaged` at that record: records have no end mark, so other values show a read that has lost its place. |
| `.xfl` airfoils | the base (undeflected) coordinates. Names are compared exactly, with case and spaces (`E205  (10.48%)`). A later airfoil of the same name replaces the earlier one. An empty name finds no airfoil. |

### Wings and surfaces

XFLR5 has 4 wing slots per plane.

| Slot | Wing | In `.xfl` | In XML | Offered |
| --- | --- | --- | --- | --- |
| 0 | main wing | always | `<Type>MAINWING</Type>` | yes |
| 1 | second wing (biplane) | when the plane has the flag `biplane` | `SECONDWING` | no |
| 2 | elevator (horizontal stabilizer) | when the plane has the flag `stab` | `ELEVATOR` | yes |
| 3 | fin | when the plane has the flag `fin` | `FIN` | no |

- An `.xfl` project stores all 4 slots. Unused slots hold default wings, such as an "Elevator" with 2 sections; the flags decide which slot exists.
- An XML file lists only the wings that exist.
- XML wing without a known `<Type>` (XFLR5 6.11 files write none): the wing is a fin when `<isFin>` is `true`. Otherwise the second `<wing>` read is the elevator and every other `<wing>` is the main wing. XFLR5 counts all `<wing>` elements, fins included. At most 4 wings are read per plane; more: warning `Plane "<plane>" has more than 4 wings; XFLR5 reads the first 4, and so does this import.`
- A later wing for a slot that is taken replaces the earlier one, as in XFLR5: warning `Plane "<plane>" has more than one main wing: "<name>" replaces "<previous>", as in XFLR5.`
- XML wing file (a top-level `<wing>`, no `<Plane>`): the `<Type>` gives the surface. `ELEVATOR`: horizontal stabilizer. `FIN` or `<isFin>true</isFin>`: refused. Every other type: wing. Position and tilt angle are 0. Several top-level wings: only the last is read, with a warning. Top-level wings in a plane file are ignored, with a warning.
- Several planes: the dialog shows the **Plane** select only for more than one plane. The first plane is preselected. A plane without a name is listed as `Plane <n>`.
- The dialog offers **Main wing** and **Horizontal stabilizer (XFLR5: Elevator)**. Each option shows `"<wing name>": <n> sections, span <span> mm, root chord <chord> mm`. The span is twice the y of the last section (Y_(n−1) of step 1 in section "Mapping to sections"), both halves. An option that the plane lacks is disabled with its reason: `This plane has no main wing.`, `This plane has no elevator.`, `The wing in this file is a horizontal stabilizer (type ELEVATOR).` or `The wing in this file is not a horizontal stabilizer (type ELEVATOR).`
- The second wing, the fin and the other surface are not imported; the report says so (section "Report"). One surface is imported at a time; opening the file again offers the other.

### Mapping to sections

Notation, for the sections i = 0 … n−1 from the root to the tip: y_i, c_i, h_i, δ_i and τ_i are the file values `y_position`, `Chord`, `xOffset`, `Dihedral` and `Twist`; k is the factor of section "How the file is read".

| XFLR5 value | Meaning |
| --- | --- |
| `y_position` | span position measured along the panels (developed span), not projected. The root can lie at y > 0 (centre gap). |
| `xOffset` | x of the leading edge of the untwisted section, positive towards the trailing edge |
| `Dihedral` of section i | absolute angle of the panel outboard of section i, from section i to i + 1; not cumulative. The value of the last section belongs to no panel and is not used. |
| `Twist` | rotation of the section about its quarter-chord point; positive = leading edge up; absolute per section |
| Tilt angle | incidence of the wing in the plane: rotation of the whole wing about the y axis through the wing origin; positive = nose up |
| Position | x, y, z of the wing origin in the plane. y is not used, as in XFLR5 (which uses it only for double fins). |

The order of the steps: panels, clean-up, tilt and position, airfoil frame, rounding.

**1. Panels.** The dihedral of the panel outboard of a section sets its direction:

```
Y_0 = k·y_0                                 Z_0 = 0
L_i = k·(y_i − y_(i−1))                     i ≥ 1
Y_i = Y_(i−1) + L_i·cos δ_(i−1)
Z_i = Z_(i−1) + L_i·sin δ_(i−1)
section i:  x = k·h_i   y = Y_i   z = Z_i   chord = k·c_i   twist = τ_i
```

- A panel shorter than 0.1 mm (XFLR5's minimum panel size) has no length.
- The project gets **Twist pivot (fraction of chord)** 0.25. XFLR5 twists about the quarter-chord point, so `Twist` needs no conversion.
- A root within 0.1 mm of y = 0 is set to 0, as XFLR5 joins the halves there (info `Root y_position <y> mm lies within 0.1 mm of the centre and is set to 0, as XFLR5 joins the halves there.`, only when the value differs from 0 at 4 decimals).

**2. Clean-up.** Section numbers in messages are XFLR5's, counted from 1 at the root.

| Case | Rule |
| --- | --- |
| fewer than 2 sections | error `The wing needs at least 2 sections (found <n>).` |
| a value that is not a finite number: `y_position`, `Chord`, `xOffset`, `Twist`, `Dihedral` (not the last section's) | error `<field> is not a finite number in the file at <sections>.` |
| position x or z, or tilt angle, not a finite number (XML files only; an `.xfl` file sets such a value to 0, section "How the file is read") | error `The position of the wing in the plane is not a finite number in the file.` or `The tilt angle of the wing is not a finite number in the file.` |
| root at y_position −0.1 mm or less | error `The root section lies at y_position <y> mm; the half wing must start at y >= 0.` |
| y_position decreases by 0.1 mm or more | error `y_position decreases at <sections>; the sections must run from root to tip.` |
| chord 0 or less | error `The chord must be greater than 0 at <sections>.` |
| chord above 0 and below 1 mm (`LIMITS.minChord`) | raised to 1 mm: warning `Chords below 1 mm were raised to 1 mm, the smallest chord Wingdesigner builds, at <sections>.` |
| all sections at one y | error `All sections of the wing lie at y = <y> mm: the wing has no span.` |
| a panel whose outer end does not lie at least 0.001 mm further out in y than its inner end (dihedral near 90° or more) | error `The panel from section <a> to <b> has <angle>° dihedral: its outer end must lie further out in y than its inner end.` |
| dihedral above 10° or below −10° | kept: warning `The panel from section <a> to <b> has <angle>° dihedral: the vertical sections are <pct> % as thick across the panel as in XFLR5.` |
| root y_position above 0.1 mm | kept; the halves are built as separate bodies, as in XFLR5: info `The root lies at y = <y> mm: the two halves are built as separate bodies, as in XFLR5.` |
| two sections at one y (a panel shorter than 0.1 mm), identical: same chord, `xOffset`, `Twist`, right and left airfoil name | the inner section is dropped without a message |
| two or more sections at one y, not identical (XFLR5's way to switch the airfoil abruptly) | the inner sections move inwards along the inner panel by d = min(0.5 mm, ¼ of the inner panel length): warning `Sections <a> and <b> share y = <y> mm; section <a> was moved <d> mm inwards.` In a run of m + 1 sections at one y the outermost stays and the others move by d, d·(m−1)/m … d/m. A run at the root has no inner panel: the innermost stays and the others move outwards along the outer panel by d/m … d, with d = min(0.5 mm, ¼ of the outer panel length): `… section <b> was moved <d> mm outwards.` The project needs strictly increasing y. |
| left airfoil name differs from the right one | the right one is used: warning `Left and right airfoils differ at <sections>; the right-side airfoils are used.` |
| a position beyond ±1,000,000 mm, a chord above 100,000 mm, a twist beyond ±360° after the tilt | error naming the section, e.g. `Section <n>: the position lies beyond ±1000000 mm, the limit of Wingdesigner.` |

`<sections>` reads `section 3` or `sections 1–3, 5`; after 10 ranges the list ends with `…`. A report line that names one section or panel each is shown for the first 5; the others are counted: `Further sections moved apart: <count>.`

**3. Tilt and position.** The part is built where it sits in the XFLR5 plane. θ is the tilt angle in degrees, LE_x and LE_z the position components in the file unit:

```
xq = x + 0.25·chord        zq = z
x' = xq·cos θ + zq·sin θ + k·LE_x − 0.25·chord
z' = −xq·sin θ + zq·cos θ + k·LE_z
twist' = τ + θ             y unchanged      LE_y not used
```

- Wingdesigner places every airfoil in a plane of constant y. A rotation about the y axis keeps such a plane, so the fold is exact for every section.
- Info `Tilt angle -1.5° applied as in the XFLR5 plane: the sections are rotated about the wing origin, and every twist includes it.`
- Info `Position in the XFLR5 plane applied: the wing origin moved to x 650 mm, z 40 mm.` A position y other than 0: info `Position y <y> mm is not used, as in XFLR5.`
- When the mean twist after the fold lies beyond ±180° (a tilt of 400°, say), a whole number of turns common to all sections is taken out: info `All twists were changed by -360°, a whole number of turns; the sections stay the same.`
- An XML wing file holds no position and no tilt angle: info `A wing file holds no position or tilt angle: the part is built in its own frame.`

**4. Airfoil frame.** XFLR5 draws the stored coordinates of an airfoil as they are: the x axis of the file lies on the chord line of the section, and a point (x, y) sits at the leading edge of the section plus chord · (x, y), before the twist about the quarter chord. Wingdesigner puts the leading edge of the airfoil at the section point and scales the airfoil to chord 1. The import therefore moves and scales each section by the frame of the airfoil that it uses.

| Airfoil in use | Frame |
| --- | --- |
| an airfoil of the `.xfl` project | measured on its coordinates |
| an uploaded `.dat` file (XFLR5 reads a `.dat` file as it is; the file is the one XFLR5 used) | measured on its coordinates |
| an airfoil of the NACA generator | measured on the generated coordinates. XFLR5 draws the nose (0, 0) of its own NACA airfoils at the section point. The generator adds the thickness across the mean line, so the leading edge (the point of least x) of a cambered section lies above and slightly ahead of the nose: for the cambered presets 0.11 % of the chord (NACA 2410) to 0.68 % (NACA 23015), 0.16 % for NACA 2412. The frame puts the nose where XFLR5 draws it. Symmetric sections have no frame; NACA 2408, whose offset lies within `FRAME_TOLERANCE`, has none either. The shape of a cambered section still differs from XFLR5's own NACA airfoil, which adds the thickness vertically: at 250 mm chord by 0.28 mm (NACA 2412, 0.11 % of the chord) to 1.41 mm (NACA 23018, 0.56 %), near 1 to 3 % of the chord; the report does not name it. |
| an airfoil of the current project generated from the NACA equations (`source.kind` `naca`: sections of the **NACA generator** and the NACA presets of **Library** in the **Airfoils** tab, of the wizard and of the sample wing), whose points are the generated section of its NACA code (`source.code`, or the name) as generated or as checked | the frame of the generated section of its NACA code, as for the generator: with such an airfoil in the project under the name, the file gives the same wing as with no project open. Outside `FRAME_LIMIT` it is used without a frame, with the warning of an upload. |
| another airfoil of the current project (also NACA metadata with other points, e.g. in a project file edited by hand), a bundled library airfoil | none: the XFLR5 coordinates of the name are not known. The report says so for a library airfoil far off (0, 0) in its own coordinates and for a current-project airfoil of an XFLR5 import or an upload (section "Report"). |

- The frame goes with the airfoil in use, not with the XFLR5 name. A library airfoil picked for a name of the `.xfl` keeps the values of steps 1 to 3. The file's Clark Y picked for another name moves the sections of that name.
- Measured on the coordinates after the clean-up of the airfoil parser (duplicate points, closing point, percent of chord, point order), before the normalization, in fractions of the chord: (l_x, l_y) is the leading edge (the point of least x on the fitted profile curve) and cT the chord from l_x to the x of the trailing-edge midpoint.
- Offsets of at most `FRAME_TOLERANCE` = 0.001 (0.25 mm at 250 mm chord) count as none: l_x and l_y become 0 and cT becomes 1. In the airfoils checked (Clark Y and E205 of real projects, the library files RAF 34 and S9104), whose nose point lies at (0, 0), the leading edge of the fitted curve lies up to 5.6e-4 from it; they get no frame. The largest offset below the tolerance in the airfoils of 29 real `.xfl` projects is 7.6e-4 (NACA 4415 of one project, 0.30 mm at 391 mm chord): the section keeps its values, a rigid shift of at most 0.1 % of the chord against XFLR5.

For a section after steps 1 to 3 with x, z, chord c and twist t (degrees):

```
s  = 0.25·(1 − cT)       u = l_x − s        w = l_y
x' = x + c·(s + u·cos t + w·sin t)
z' = z + c·(−u·sin t + w·cos t)
chord' = c·cT            y and twist unchanged
```

- With l_x = 0 and cT = 1 the section moves by c · l_y along its normal (sin t, cos t).
- Every airfoil point then lies where a rigid rotation of the airfoil about the quarter chord puts it; XFLR5's own mesh differs slightly (section "Differences from XFLR5").
- The Sections table then differs from XFLR5's wing table by this move: 8.53 mm at the root of the worked example.
- A frame with |l_x| or |l_y| above 0.1, or cT outside 0.5 … 2 (`FRAME_LIMIT`), is not in chord units (a file in millimetres, say): XFLR5 would draw the airfoil many chords long. An airfoil of an `.xfl` then fails the check (`The coordinates are not in chord units (leading edge at x = <x>, y = <y>; trailing edge at x = <te>).`) and the other sources of section "Airfoils" are tried. An upload is used without a frame, scaled to chord 1, with a warning: `The coordinates are not in chord units (leading edge at x = <x>, y = <y>; trailing edge at x = <te>): XFLR5 cannot have drawn them as they are, so the airfoil is scaled to unit chord and its sections keep the values of the file.`
- The airfoil parser divides coordinates by 100 when the largest x lies above 5 and at most 110. A file in millimetres or inches with a chord of 50 to 110 gets there too. A file read as percent counts as in chord units only when cT lies within 0.02 of 1; a true percent file ends at x = 100.

**5. Rounding.** The project holds section values to 4 decimals (1e-4 mm, 1e-4 °). This drops noise of the unit conversion such as a chord of 400.04999999999995 mm. The section ids are `s1`, `s2` … in root-to-tip order.

### Differences from XFLR5

Steps 1 to 3 give the section values of XFLR5's wing table with tilt angle and position applied; step 4 moves them to where XFLR5 draws the airfoils. The built wing differs from XFLR5's own surface in three ways.

| Difference | Size |
| --- | --- |
| XFLR5 twists a section about an axis along its panels: at a dihedral break about the bisector of the two panels, and it cuts the section in the miter plane; at the tip about the axis of the outer panel. Wingdesigner twists about the y axis and keeps the section in a plane of constant y. | Trailing-edge midpoints of the imported worked example against the STL files that the code of XFLR5 6.62 wrote for its wings through a local driver: main wing 0.0001 mm at the root, 0.24 mm at the dihedral break (section 2), 0.51 mm at the tip; elevator 0.0001 mm; Fixture B 0.006, 0.057, 0.091 and 0.16 mm at sections 1 to 4. Leading-edge points: at most 0.56 mm. |
| The thickness across a panel with dihedral δ is cos δ times XFLR5's. | 99.9 % at 3°, 98.5 % at 10°, 82 % at 35° (a V-tail modelled as an elevator with large dihedral). The report warns above 10°. |
| XFLR5 shears the airfoil of a twisted section: the thickness stays along the untwisted panel normal. The tilt angle of the wing turns the section rigidly in XFLR5 as well; only the twist of the file shears. Wingdesigner rotates the airfoil as a rigid shape. | 0.37 mm at 2° twist of the file and 300 mm chord (Fixture B root; 3° after the 1° tilt angle). 0.29 to 0.60 mm on 10 surfaces of real projects (0.60 mm: MH 112, 400 mm chord, 2°). |

The STL files are not in the repository. In this comparison, a wrong sign of twist or tilt, a cumulative dihedral or a projected y would each move points by 3 to 20 mm.

The statistics (**Checks** tab, status bar, the line below the planform preview of the import dialog) give span and area projected onto the x-y plane. XFLR5 gives them along the panels. For a wing with dihedral the two differ: the 35° V-tails of the real samples show 17.5 % less span and 18.1 % less area than XFLR5's **Wing span** and **Area**, the 40° V-tail 19.8 % and 23.4 %. The geometry is the same.

### Airfoils

Each distinct right-side airfoil name of the surface is one row of the airfoil table. A row shows the XFLR5 name with its sections, the source found (**Found**), a select (**Airfoil used**) with the automatic choice first, and the buttons **Upload .dat** and **View**.

**Sources for one name.** The first candidate that passes the airfoil check counts. A candidate that fails is passed over.

| Order | Source | Match |
| --- | --- | --- |
| 0 | the airfoil of the `.xfl` project (`.xfl` only) | the exact name; an empty name finds nothing |
| 1 | a `.dat` file uploaded in the dialog | its name line, exactly, then trimmed; then its file name without extension, exactly, then trimmed |
| 2 | an airfoil of the current project | its name, exactly, then trimmed (the id when the name is blank) |
| 3 | a bundled library airfoil (Clark Y, NACA 8-H-12, NACA M-6, RAF 34, S9104, USA 35B) | its name, exactly, then trimmed |
| 4 | the NACA generator | the name is a designation of the 4-digit or 5-digit series: `NACA 2412`, `naca2412`, `NACA-2412`, `2412`. `NACA0014_Flap` and `NACA 0010 Airfoil` are none; the select offers the designation that starts such a name, and it is not chosen automatically. |
| 5 | a similar name | case-insensitive, ignoring spaces, `-` and `_`, among the uploads (name line and file name), the current project and the library. Preselected, with a warning. |

- The airfoil check is the one of the **Airfoils** tab (parser clean-up, sanity checks). In addition the fitted profile curve must not cross itself or run back in x (`curve-shape`, **Profile parametrization** centripetal).
- Warnings of the check appear once per airfoil in use, with its sections: `Airfoil "Clark Y" (sections 1–2): <message>`. The upload is named with its file name, as the select shows it: `Airfoil "TEST 12 (test12.dat)" (section 2): …`. An inclined chord line (`rotated`) is info, because XFLR5 draws the same coordinates: `Airfoil "Clark Y" (sections 1–2): The line from the leading edge to the trailing edge is inclined by -1.97 degrees; the coordinates are kept, so twist refers to the file's x axis.` A library airfoil gets a warning instead (section "Report").
- No candidate passes: the row shows **Missing** in the column **Found**, and **Import** stays disabled (`Import (2 airfoils missing)`). The error names the first candidate that failed, e.g. `Airfoil "NACA 5128" (sections 1–2): the matching airfoil (NACA generator: NACA 5128) fails the check: … Upload a .dat file or pick an airfoil.` Generated sections with high camber and thickness run back in x at 11 to 13 % of the chord and fail the check, for example NACA 5128, 5130, 6130, 8130 and 9130.
- The user can change every row: any airfoil of the list (airfoils of the file, uploads, current project, library, NACA presets), or **Upload .dat** for that row. A picked airfoil replaces the automatic choice.
- Without a name (an empty airfoil name in the file): error `XFLR5 names no airfoil at <sections>: upload a .dat file or pick an airfoil.`

**Flaps** (`.xfl` only). The file stores the base shape and the flap parameters of an airfoil. The import always uses the base shape without deflection and cuts no control surface. The report names each flap of an airfoil in use that comes from the file:

| Flap in the file | Severity | Message |
| --- | --- | --- |
| trailing-edge flap at 0° | info | `Airfoil "<name>" has a trailing-edge flap at 0° in XFLR5 (hinge at <x> % chord); control surfaces are not cut.` |
| trailing-edge flap at another angle | warning | `Airfoil "<name>" has a 20° trailing-edge flap in XFLR5 (hinge at 70 % chord); it is imported undeflected.` |
| leading-edge flap | info at 0°, warning otherwise | the same texts with `leading-edge` |

### Report

The report is calculated again after every choice. Order: errors, then warnings, then info. **Import** is disabled while the report holds an error. The project of the mapping is built as **Open** builds it: build errors and warnings of the wing appear in the report (`The wing does not build yet: <error>` as a warning) and do not block the import. The dialog shows at most 200 report lines and 200 airfoil rows (rows without a usable airfoil and picked rows first; the other names take uploads by name). The dialog opens at once with **Import** disabled and the line `Checking the airfoils …`. The checks of the first mapping run in slices of 50 ms, so that **Cancel**, Escape and scrolling work meanwhile. During the checks the airfoil table, the planform preview and the stats line are empty, and so is the project name unless one was typed. After a change of plane or surface the checks of the new wing run the same way, and the dialog empties the same parts; when they end within 50 ms (airfoils checked before), the report follows without the progress line, and nothing is emptied.

**Report: geometry and file**

| Data | Treatment | Severity | Message |
| --- | --- | --- | --- |
| second wing, fin, the other surface | not imported | info | `Not imported: the horizontal stabilizer "Elevator", the fin "Fin". One surface per import; open the file again for another one.` |
| dihedral other than 0 | y and z computed | info | `XFLR5 measures y_position along the panels; y and z were computed from it and the dihedral.` |
| dihedral above 10° | kept | warning | section "Mapping to sections", step 2 |
| tilt angle, position | applied | info | step 3 |
| root gap, root within 0.1 mm of the centre | kept, set to 0 | info | steps 1 and 2 |
| equal y, chord below 1 mm, left ≠ right airfoil | moved, raised, right used | warning | step 2 |
| length unit other than mm | converted | info | section "How the file is read" |
| metre XML file | rounded to 1 mm | info | section "How the file is read" |
| always | dropped | info | `Not used: VLM panel counts and distributions, colours, masses, the body and the analyses.` |
| always | trailing edge as in the airfoils | info | `The trailing edge is built as in the airfoils; Settings > Trailing edge can close it or give it a thickness.` |
| `.xfl` airfoils unreadable | planes offered | warning | `The airfoils could not be read. <damage message> Pick or upload them.` |
| `.xfl` with more than 10,000 airfoils, or airfoils beyond 2,000,000 points | not read | warning | `Only the first 10,000 of the <n> airfoils of the file were read.` `1 airfoil was not read: the airfoils of the file hold more than 2,000,000 points together.` |
| XML file: a wing that replaces another, more than 4 wings, wings outside a plane, a `<Units>` after a plane, a value that is not a number, a `Position` with fewer than 3 values | as in XFLR5 | warning | texts in sections "Wings and surfaces" and "How the file is read". The warnings concern the whole file, so the report of every plane lists them; the toast leaves them out. |

The dropped data: the fin, the second wing, the other surface, the body, masses, analyses and results, VLM (vortex lattice method) panel counts and distributions, colours, descriptions, left-side airfoils, flap deflections, the last section's dihedral and the position y.

**Report: airfoils**

| Data | Treatment | Severity | Message |
| --- | --- | --- | --- |
| airfoil that moves its sections | moved (and scaled) | info; warning when any offset exceeds 2 % of the chord (`FRAME_WARN` = 0.02) | `Airfoil "Clark Y" (sections 1–2) has its leading edge at x = 0 %, y = 3.55 % and its trailing edge at x = 100 % of chord in its own coordinates; these sections were moved so that the airfoil lies as in XFLR5.` For one section: `this section was moved`. With cT ≠ 1: `moved and scaled`. Where the frame applies, the check's note on scaling to chord 1 is left out. |
| library airfoil, or a current-project airfoil taken from the Library (`source.kind` `library`, the same points), whose own coordinates put x or y of the leading edge more than 2 % of the chord from 0, or the chord more than 2 % from 1; bundled: Clark Y 3.55 %, USA 35B 2.87 % | table values kept | info | `Library airfoil "Clark Y" (sections 1–2) has its leading edge at x = 0 %, y = 3.55 % of chord in its own coordinates. If XFLR5 used these coordinates, it draws these sections that far from the table values; upload the .dat file that XFLR5 used to place them as in XFLR5.` |
| library airfoil, or a current-project airfoil taken from the Library, whose chord line (from the leading edge of the fitted curve to the trailing-edge midpoint) is inclined more than 0.5° (`rotationDeg` of the airfoil check); bundled: Clark Y 2.00° and USA 35B 1.57° nose up | angle kept, twist refers to its x axis | warning | `Library airfoil "Clark Y" (sections 1–2) has its chord line inclined 2.00° nose up in its own coordinates, and the built sections keep this angle. If the airfoil that XFLR5 used has a level chord line, these sections sit 2.00° more nose up than in XFLR5, the trailing edge 8.4 mm lower at 240 mm chord; upload the .dat file that XFLR5 used to place them as in XFLR5.` The distance is the largest chord of these sections times sin(angle). The UIUC file `clarky.dat` (name line `CLARK Y AIRFOIL`) has a level chord line. `nose down` and `higher` for a trailing edge above the leading edge. |
| current-project airfoil of an XFLR5 import or an upload (`source.kind` `xflr5` or `upload`): stored at chord 1, its own coordinates are not stored | table values kept | info | `Airfoil "Clark Y" (sections 1–2) of the current project is stored scaled to unit chord, with its leading edge at (0, 0), so these sections keep the table values. If the coordinates that XFLR5 used put the leading edge elsewhere, XFLR5 draws these sections that far from the table values; upload the .dat file that XFLR5 used to place them as in XFLR5.` |
| warnings of the airfoil check | kept | warning; inclined chord line: info (library airfoil: the row above instead) | `Airfoil "Clark Y" (sections 1–2): <message>` |
| flap | base shape | info at 0°, warning otherwise | see "Flaps" above |
| file airfoil fails the check, another source passes | the other source used | warning | `Airfoil "<name>" from the file fails the check: <problem> "<match>" is used instead.` |
| file airfoil fails the check, none passes | blocks Import | error | `Airfoil "<name>" (sections 1–2) from the file fails the check: <problem> Upload a .dat file or pick an airfoil.` |
| no candidate | blocks Import | error | `Airfoil "E423" (sections 1–2) is missing: upload a .dat file or pick an airfoil.` |
| picked airfoil fails the check | blocks Import | error | `Airfoil "<name>" (sections 1–2): the chosen airfoil fails the check: <problem>` |
| similar name | preselected | warning | `Airfoil "SD7037 tip" matched to "SD7037" by a similar name.` |
| unusable upload that no row has picked (a refusal before reading gives only its reason) | not used | info | `The uploaded file <file> is not usable: <problem>` |
| airfoils beyond the limits of a project | blocks Import | error | `The airfoils of this wing exceed the limits of a project (10,000 airfoils, 1,000,000 points together).` |

### Limits

| Limit | Value | Message or result |
| --- | --- | --- |
| `.xfl` file size | 2,000 MB | `The file is <size> MB; XFLR5 projects above 2000 MB are not read.` |
| XML and other files | 100 MB | section "How Open chooses the reader" |
| planes per file | 10,000 | `.xfl`: damaged (in the list of planes). XML: `The XML file holds more than 10,000 planes.` |
| sections per wing | 20,000 (`LIMITS.maxSections`) | `A wing of the file has <n> sections; at most 20,000 can be read.` XML: `A wing of the XML file has more than 20,000 sections.` |
| sections of all planes of an `.xfl` | 1,000,000 | `The planes of the file hold more than 1,000,000 wing sections together; the file is not read.` |
| points of one `.xfl` airfoil | 1,000 (XFLR5 holds at most 604) | more: damaged (in an airfoil) |
| points of all airfoils of an `.xfl` | 2,000,000 | further airfoils are not read, with a warning (section "Report") |
| airfoils read from an `.xfl` | 10,000 (`LIMITS.maxAirfoils`) | the rest of the list is not read, with a warning |
| names and descriptions in an `.xfl` | 64 MB together; one text at most 1,048,576 bytes (524,288 characters) | `The names in the file hold more than 64 MB together.`; a longer single text is damage |
| XML elements | 1,000,000 | `The XML file holds more than 1,000,000 elements.` |
| XML nesting | 100 levels | `The XML file nests elements deeper than 100 levels.` |
| XML attributes per element | 100 | malformed tag |
| wings read per plane | 4 (XFLR5 reads 4) | warning (section "Wings and surfaces") |
| XML warnings kept | 50; per wing 5 problems listed, then a count | `Further warnings not listed: <count>.` |
| airfoils of one import | 10,000 names and 1,000,000 points (`LIMITS.maxAirfoils`, `LIMITS.maxAirfoilPoints`) | error (section "Report", airfoils). Checked before any name is resolved. The points of the file's own airfoils count only for names that the user has not given another airfoil. |
| section values of the project | position within ±1,000,000 mm, chord 1 to 100,000 mm, twist within ±360° | section "Mapping to sections", step 2 |
| airfoil rows in the dialog | 200 | `<count> more airfoil names are not listed; uploaded .dat files are matched to them by name.` |
| report lines in the dialog | 200 | `Further report lines not shown: <count>.` |
| names in messages | 200 characters, then `…` | – |

Time with 10,000 airfoils of 99 points each: the first mapping, which checks every airfoil, takes about 45 s in Node.js 24 (45.1 to 47.2 s in 4 runs) and 59 s in Chromium 141 (1 run); the dialog stays usable meanwhile (**Cancel** closed it in 48 ms). A later mapping of the checked airfoils takes 0.54 to 0.72 s (Node.js).

### Result of the import

| Property | Value |
| --- | --- |
| Project name | `<plane name> <wing name>`, or the wing name of a wing file; parts trimmed, empty parts left out. Both empty: `Imported wing` (German interface: `Importierter Flügel`). At most 10,000 characters. The name field of the dialog changes it; an emptied field follows the plane and the surface again. |
| Sections | ids `s1`, `s2` …; values as in section "Mapping to sections" |
| `settings` | `twistPivot` 0.25, `spanwise` `"linear"`, `mirror` `true`, `tip.mode` `"flat"`, `trailingEdge.mode` `"asis"`. The other keys have their defaults. |
| `guides` | defaults: created from the section edges, disabled |
| Airfoils | one entry per source in use. Rows that use the same source, or sources with equal name and equal points, share one entry. Ids follow the rules of section "Project JSON" (`clark-y`, `naca-0009`, `clark-y-2` for the same name with other points). The points: the checked points (leading edge at (0, 0), chord 1) for an airfoil of the file, an upload and a library airfoil; the generated points for a NACA section (source `naca`); the stored points for an airfoil of the current project. |
| Toast | `Imported the main wing "Main Wing" of "Fixture A" from fixtures_v662.xfl: 3 sections, 2 airfoils.` For a stabilizer: `Imported the horizontal stabilizer "Elevator" of "Fixture A" from fixtures_v662.xfl: 2 sections, 1 airfoil.` Without a plane name: `Imported the main wing "Main Wing" from wing.xml: 3 sections, 2 airfoils.` Then the first warning and `(<n> more warnings in the import report.)`. The warnings of the XML reader stay in the report. |
| Not stored | tilt angle, position, flap parameters and the other dropped data. The provenance stays in the project name and, for airfoils of an `.xfl` project, in `source.note`. |
| Undo | **Undo** restores the previous project. The autosave follows the import. |

**Source of an imported airfoil.** An airfoil that comes from the `.xfl` project gets this `source`:

| Key | Value |
| --- | --- |
| `kind` | `"xflr5"` |
| `file` | name of the `.xfl` file, at most 2,000 characters |
| `note` | `Airfoil "<name>" from XFLR5 plane "<plane>"; base shape without flap deflection.` Plane without a name: `Airfoil "<name>" from an XFLR5 project; base shape without flap deflection.` Written in the interface language at the time of the import. |
| `attribution` | only when the airfoil name starts with `HS` and a space or `-` (`Hartmut Siegmann, www.aerodesign.de`) or with `MH` and a number, such as `MH 45` (`Martin Hepperle, www.mh-aerotools.de`); the suggestion of the upload |

An uploaded `.dat`, a library airfoil, a NACA section and an airfoil of the current project keep their own `source` (`upload`, `library`, `naca`, or the source they had). In the **Airfoils** tab the small line of an `xflr5` airfoil shows the attribution, or `XFLR5: <file>` without one.

### Worked example

The file is `test/fixtures/xflr5/fixtures_v662.xfl`: project format 200002, saved by the project writer of XFLR5 6.62, with the planes "Fixture A" and "Fixture B" and the airfoils "Clark Y" (33 points) and "NACA 0009" (81 points). The lengths in the file are metres, so k = 1000.

Main wing "Main Wing" of "Fixture A": position 0, 0, 0; tilt angle 2°.

| i | `y_position` (m) | `Chord` (m) | `xOffset` (m) | `Dihedral` (°) | `Twist` (°) | Airfoil |
| --- | --- | --- | --- | --- | --- | --- |
| 0 | 0 | 0.24 | 0 | 3 | 0 | Clark Y |
| 1 | 0.5 | 0.22 | 0.01 | 6 | −1 | Clark Y |
| 2 | 0.9 | 0.15 | 0.045 | 0 (not used) | −2.5 | NACA 0009 |

Step 1, panels:

```
L_1 = 500 mm:   Y_1 = 500·cos 3° = 499.3148      Z_1 = 500·sin 3° = 26.1680
L_2 = 400 mm:   Y_2 = 499.3148 + 400·cos 6° = 897.1235
                Z_2 = 26.1680 + 400·sin 6° = 67.9794
```

Step 3, tilt θ = 2° (section 1: xq = 0 + 0.25 · 240 = 60 mm, zq = 0):

```
x' = 60·cos 2° + 0·sin 2° − 60 = −0.0366
z' = −60·sin 2° + 0·cos 2° = −2.0940        twist' = 0 + 2 = 2
```

Step 4, airfoil frame: the Clark Y of the file has its flat lower surface on the x axis. Its nose lies 3.5546 % of the chord above it: l_x = 0, l_y = 0.035546, cT = 1. Sections 1 and 2 use it and move by c · l_y along (sin t, cos t): 240 · 0.035546 = 8.5310 mm and 220 · 0.035546 = 7.8201 mm. The NACA 0009 of the file has the frame of an airfoil at the origin with chord 1: section 3 stays.

```
section 1:  x = −0.0366 + 8.5310·sin 2° = 0.2612     z = −2.0940 + 8.5310·cos 2° = 6.4318
section 2:  x = 10.8737 + 7.8201·sin 1° = 11.0101    z = 23.8836 + 7.8201·cos 1° = 31.7024
```

The results come from the unrounded values of the earlier steps. Section values in mm and °:

| Section | Steps 1 and 2 | Step 3 (tilt) | Imported from the `.xfl` (step 4) |
| --- | --- | --- | --- |
| s1 | x 0, y 0, z 0, chord 240, twist 0 | x −0.0366, y 0, z −2.0940, chord 240, twist 2 | x 0.2612, y 0, z 6.4318, chord 240, twist 2 |
| s2 | x 10, y 499.3148, z 26.1680, chord 220, twist −1 | x 10.8737, y 499.3148, z 23.8836, chord 220, twist 1 | x 11.0101, y 499.3148, z 31.7024, chord 220, twist 1 |
| s3 | x 45, y 897.1235, z 67.9794, chord 150, twist −2.5 | x 47.3222, y 897.1235, z 65.0587, chord 150, twist −0.5 | x 47.3222, y 897.1235, z 65.0587, chord 150, twist −0.5 |

The report of this import holds one warning (the Clark Y moves its sections by more than 2 % of the chord: 3.55 %) and the info lines for the dihedral, the tilt angle, the inclined chord line of the Clark Y, the elevator and the fin that are not imported, the dropped data and the trailing edge. The toast reads `Imported the main wing "Main Wing" of "Fixture A" from fixtures_v662.xfl: 3 sections, 2 airfoils.`, followed by the warning about the Clark Y.

The XML file of the same plane in millimetres (`test/fixtures/xflr5/xml_mm/0.plane.xml`) names the airfoils only:

- With a project that holds no airfoil named Clark Y (such as the design type **Sport** of the wizard), `Clark Y` is found in the library. A library airfoil gets no frame: the sections are the values of step 3. An info line says that the library Clark Y has its leading edge 3.55 % of the chord off (0, 0) in its own coordinates.
- With the file's Clark Y uploaded as a `.dat` file, the sections are those of the `.xfl` import; the upload is named `Clark Y (clark-y.dat)` in the report.
- `NACA 0009` comes from the NACA generator.

Elevator of "Fixture A" (slot 2): position x 0.65 m, y 0, z 0.04 m; tilt angle −1.5°; sections (`y_position` 0, `Chord` 0.11, `xOffset` 0, no dihedral, no twist) and (`y_position` 0.23, `Chord` 0.07, `xOffset` 0.025, no dihedral, no twist); airfoil NACA 0009.

| Section | Steps 1 and 2 | Imported (tilt and position applied) |
| --- | --- | --- |
| s1 | x 0, y 0, z 0, chord 110, twist 0 | x 649.9906, y 0, z 40.7199, chord 110, twist −1.5 |
| s2 | x 25, y 230, z 0, chord 70, twist 0 | x 674.9854, y 230, z 41.1125, chord 70, twist −1.5 |

Fixture B (tilt angle 1°, position 50, 0, 10 mm; Clark Y at sections 1 and 2): section 1 moves from x 49.9886, z 8.6911 to x 50.5467, z 19.3402, section 2 from x 109.9810, z 7.8184 to x 110.3035, z 17.0547. The twists are 3° and 2° after the fold.

## Bodies per file

| **Wing halves** option | STEP | STL | 3MF |
| --- | --- | --- | --- |
| **Both halves as separate bodies** | 2 solids | 1 file, 2 closed shells | 2 objects: `Wing right`, `Wing left` |
| **Full wing as one body (mesh formats, root at y = 0)** | 2 solids | 1 closed shell | 1 object: `Wing` |
| **Right half only** | 1 solid | 1 closed shell | 1 object: `Wing right` |

- **Full wing** needs the root section at exactly y = 0 mm. Otherwise STL and 3MF contain 2 shells, as with **Both halves**.
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
| Strings | `'` and `\` doubled. Characters outside U+0020–U+007E as `\X2\hhhh\X0\` or `\X4\hhhhhhhh\X0\`. A lone UTF-16 surrogate (U+D800–U+DFFF) is written as U+FFFD (replacement character). |

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
| Vertices | 9 significant digits (enough for every 32-bit float), shortest form without trailing zeros, e.g. `1000000.12`, `0.123456789`, `12`; magnitudes below 1e-6 mm in exponent notation, e.g. `-1e-7`; zero as `0` |
| Triangles | `v1`, `v2`, `v3`: vertex indices from 0, counterclockwise seen from outside |
| Zip entry date | fixed at 2026-01-01 00:00 UTC, stored in the local time of the browser; not the export time |

## File sizes

Measured on 2026-09-29 with **Both halves as separate bodies** and default resolution (60 chordwise
stations per surface). 1 KB = 1024 bytes. Triangle counts in parentheses.

| Project | Sections | Spanwise stations | STEP | STL **Normal** | STL **Fine** | 3MF **Normal** | 3MF **Fine** | JSON |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Sample wing `Sport wing 1500` | 3 | 3 | 122 KB | 71 KB (1444) | 235 KB (4812) | 20 KB | 61 KB | 63 KB |
| Wizard preset **Sport** | 2 | 2 | 99 KB | 47 KB (960) | 141 KB (2884) | 11 KB | 38 KB | 56 KB |
| Wizard preset **Glider**, elliptic guides | 3 | 17 | 444 KB | 1158 KB (23708) | 4566 KB (93500) | 279 KB | 1099 KB | 175 KB |
