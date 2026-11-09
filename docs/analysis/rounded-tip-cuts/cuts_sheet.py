# Cut sheet: numbered top view and all profiles at one scale. Usage: python cuts_sheet.py <cuts.json> <output dir>
import json, math, sys
import matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.gridspec import GridSpec
J, S = sys.argv[1], sys.argv[2]
d = json.load(open(J))
E = d['ellipse']; tipY = d['tipY']; XL = 50.0
ce = lambda y: math.sqrt(max(0.0, E['k'] * (1 - E['m'] * y * y)))
cuts = d['cuts']; N = len(cuts)
COLS = 3; ROWS = math.ceil(N / COLS)
fig = plt.figure(figsize=(17, 44))
gs = GridSpec(ROWS + 6, COLS, figure=fig, height_ratios=[1.6]*5 + [0.9] + [1]*ROWS, hspace=0.25, wspace=0.06)
# --- top view
a = fig.add_subplot(gs[0:5, :])
le = [p for p in d['le'] if p[0] >= d['y0'] - 2]; te = [p for p in d['teU'] if p[0] >= d['y0'] - 2]
a.fill([p[0] for p in le] + [p[0] for p in te][::-1], [p[1] for p in le] + [p[1] for p in te][::-1], color='#eaf0f8', zorder=0)
a.plot([p[0] for p in le], [p[1] for p in le], color='#1f5fbf', lw=2, label='Leading edge (surface)')
a.plot([p[0] for p in te], [p[1] for p in te], color='#c2410c', lw=2, label='Trailing edge (surface)')
ys = [d['y0'] - 2 + i * (E['end'] - d['y0'] + 2) / 3000 for i in range(3001)]
a.plot(ys, [XL - 0.25*ce(y) for y in ys], '--', color='k', lw=0.9, label='Exact ellipse (straight line at 25 %)')
a.plot(ys, [XL + 0.75*ce(y) for y in ys], '--', color='k', lw=0.9)
a.axhline(XL, color='#777', lw=0.7, ls=':', label='Straight line, x = 50 mm (25 % chord)')
for i, c in enumerate(cuts, 1):
    a.plot([c['y']]*2, [c['le'], c['te']], color='#5b6b80', lw=0.7)
    if i % 2 == 1 or i == N:
        a.text(c['y'], c['te'] + 1.2, str(i), ha='center', va='top', fontsize=7.5, color='#222')
secs = [s for s in d['sections'] if s['y'] >= d['y0'] - 2]
for s in secs:
    a.scatter([s['y']]*2, [s['x'], s['x'] + s['chord']], marker='D', s=36, facecolor='white', edgecolor='k', zorder=5)
a.scatter([], [], marker='D', s=36, facecolor='white', edgecolor='k', label='Section of the project')
# scale bar 10 mm
y_s, x_s = d['y0'] + 3, 28
a.plot([y_s, y_s + 10], [x_s, x_s], color='k', lw=3); a.text(y_s + 5, x_s - 0.8, '10 mm', ha='center', va='bottom', fontsize=10)
a.plot([y_s, y_s], [x_s, x_s + 10], color='k', lw=3); a.text(y_s - 0.8, x_s + 5, '10 mm', ha='right', va='center', fontsize=10)
a.set_xlim(d['y0'] - 8, tipY + 2); a.set_ylim(102, 24)
a.set_aspect('equal'); a.grid(alpha=0.25)
a.set_xlabel('y, span from the root (mm)'); a.set_ylabel('x, aft (mm)')
a.set_title(f'Glider with "Continue the ellipse": top view of the outer 5 % of the half span, y = {d["y0"]:.1f} to {tipY:.2f} mm (point).\n'
            f'{N} cuts at y = const, 1 mm apart, numbered 1 (y = {cuts[0]["y"]} mm) to {N} (y = {cuts[-1]["y"]} mm). Odd numbers labelled. Equal scale in x and y.', fontsize=12)
a.legend(loc='lower left', fontsize=9, framealpha=0.95)
# --- explanation row
t = fig.add_subplot(gs[5, :]); t.axis('off')
t.text(0, 0.0,
 'Profiles below: each cut of the 3D surface (the STEP surface) in the plane y = const, seen from the wing tip, leading edge left. All drawn at one scale (scale bar in cut 1).\n'
 'Grey line: x = 50 mm, the straight line at 25 % chord. Dashed ticks: leading and trailing edge of the exact ellipse at that y.\n'
 'Per cut: number, y, distance to the point, measured chord, deviation of the chord from the ellipse (Δc), profile height h. The trailing edge is 0.4 mm thick (Settings > Trailing edge).',
 fontsize=11.5, va='center')
# --- profiles
xmin = min(min(p[0] for p in c['pts']) for c in cuts) - 1; xmax = max(max(p[0] for p in c['pts']) for c in cuts) + 1
for i, c in enumerate(cuts):
    ax = fig.add_subplot(gs[6 + i // COLS, i % COLS])
    zc = 0.5 * (c['zmin'] + c['zmax'])
    xs = [p[0] for p in c['pts']]; zs = [p[1] - zc for p in c['pts']]
    ax.fill(xs, zs, color='#dbe5f3'); ax.plot(xs, zs, color='#1f3f7a', lw=1)
    ax.plot([XL, XL], [-4, 4], color='#999', lw=0.6)
    e = ce(c['y'])
    for xe in (XL - 0.25*e, XL + 0.75*e): ax.plot([xe, xe], [-4, 4], color='k', lw=0.8, ls='--')
    ax.set_xlim(xmin, xmax); ax.set_ylim(-5, 11); ax.set_aspect('equal'); ax.axis('off')
    ch = c['te'] - c['le']
    ax.text(xmin, 10.5, f"{i+1}", fontsize=13, fontweight='bold', va='top')
    ax.text(xmin + 5, 10.5, f"y {c['y']} mm · {tipY - c['y']:.1f} mm to the point\nchord {ch:.2f} mm · Δc {ch - e:+.2f} mm · h {c['zmax'] - c['zmin']:.2f} mm", fontsize=9, va="top")
    if i == 0:
        ax.plot([xmax - 11, xmax - 1], [-4.2, -4.2], color='k', lw=2.5); ax.text(xmax - 6, -3.9, '10 mm', ha='center', va='bottom', fontsize=9)
fig.savefig(S + '/tip_cuts_sheet.png', dpi=110, bbox_inches='tight'); fig.savefig(S + '/tip_cuts_sheet_hires.png', dpi=440, bbox_inches='tight'); fig.savefig(S + '/tip_cuts_sheet.pdf', bbox_inches='tight')
