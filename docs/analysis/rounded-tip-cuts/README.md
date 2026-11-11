# Rounded tip: cuts of the wing end

Cuts of the loft surface (the surface written to STEP) of the **Glider** preset with a rounded tip
added by **Rounded tip…** with **Continue the ellipse of the wing** (the dialog defaults). The cuts
are planes y = const, 1 mm apart, over the outer 5 % of the half span: 56 cuts from y = 1064 mm to
y = 1119 mm. The point is at y = 1119.830 mm; the ellipse c² = k · (1 − m · y²) through chord and
taper at the old tip section (y = 1000 mm) closes at y = 1119.825 mm. Straight line at 25 % chord,
x = 50 mm. Trailing edge 0.4 mm thick (Settings > Trailing edge, Fixed thickness), Linear spanwise
interpolation, Wing tip Round (the tip closes in one point, chord 0). The last section stores a
chord of 1 mm, the smallest chord a section holds; the build uses chord 0 there. The two diamonds
at the point in the top views mark that stored chord.

## Files

| File | Content |
| --- | --- |
| `tip_cuts_sheet.pdf` | Cut sheet, vector: numbered top view with 10 mm scale bars, all 56 profiles at one scale with y, distance to the point, chord, chord deviation Δc and height h |
| `tip_cuts_sheet_hires.png` | The cut sheet at 440 dpi, 5992 × 15191 px |
| `tip_cuts_sheet.png` | The cut sheet at 110 dpi, 1497 × 3797 px |
| `tip_cuts.png` | Top view with the cuts, and the deviation of leading edge, trailing edge and chord from the ellipse |
| `tip_cuts_zoom.png` | Top view of the last 8 mm to the point |
| `cuts_table.md` | Per cut: y, distance to the point, leading and trailing edge x, chord, ellipse chord, deviations, height |
| `extract-cuts.mjs` | Builds the wing and cuts the surface; writes the cuts as JSON |
| `cuts_plot.py`, `cuts_sheet.py` | Draw the figures and the table from the JSON |

## Result

| Range | Leading edge − ellipse | Trailing edge − ellipse | Chord − ellipse |
| --- | --- | --- | --- |
| Cuts 1 to 53, y = 1064 to 1116 mm | 0.00 to +0.01 mm | −0.04 to −0.01 mm | −0.05 to −0.02 mm |
| Cut 54, 2.8 mm before the point | 0.00 mm | −0.01 mm | −0.01 mm |
| Cut 55, 1.8 mm before the point | 0.00 mm | +0.01 mm | 0.00 mm |
| Cut 56, 0.8 mm before the point | 0.00 mm | +0.02 mm | +0.02 mm |

Over all 56 cuts the chord lies within −0.05 to +0.02 mm of the ellipse, the leading edge within
0.01 mm, the trailing edge within −0.04 to +0.02 mm. The blend of the edges ends at the point with
the curvature of the ellipse about the straight line (`src/geom/tipblend.js`, header). With Wing tip
Pointed (1 mm chord at the point) the chord of the same wing deviates +0.04, +0.14 and +0.34 mm at cuts 54, 55 and
56. The height falls from 6.12 mm (cut 1) to 0.83 mm (cut 56). Other designs, fullness settings and
Smooth spanwise interpolation are not measured.

## Regenerate

Node.js 24 with the project's dependencies; Python 3 with matplotlib.

```bash
node docs/analysis/rounded-tip-cuts/extract-cuts.mjs /tmp/cuts.json
python docs/analysis/rounded-tip-cuts/cuts_plot.py /tmp/cuts.json docs/analysis/rounded-tip-cuts
python docs/analysis/rounded-tip-cuts/cuts_sheet.py /tmp/cuts.json docs/analysis/rounded-tip-cuts
```
