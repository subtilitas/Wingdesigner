# Top view and deviation plots of the cuts. Usage: python cuts_plot.py <cuts.json> <output dir>
import json, math, sys
import matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt
J, S = sys.argv[1], sys.argv[2]
d = json.load(open(J))
E = d['ellipse']; tipY = d['tipY']; XL = 50.0
ce = lambda y: math.sqrt(max(0.0, E['k'] * (1 - E['m'] * (y - E['y0'])**2)))
rows = []
for c in d['cuts']:
    y = c['y']; ch = c['te'] - c['le']; ide = ce(y)
    rows.append((y, tipY - y, c['le'], c['te'], ch, ide, c['le'] - (XL - 0.25*ide), c['te'] - (XL + 0.75*ide), ch - ide, c['zmax'] - c['zmin']))
with open(S + '/cuts_table.md', 'w') as f:
    f.write('| y mm | to point mm | LE x mm | TE x mm | chord mm | ellipse chord mm | dLE mm | dTE mm | dchord mm | height mm |\n|' + '---:|'*10 + '\n')
    for r in rows: f.write('| ' + ' | '.join(f'{v:.2f}' for v in r) + ' |\n')
for r in rows: print(' '.join(f'{v:8.2f}' for v in r))
fig, ax = plt.subplots(1, 2, figsize=(15, 7.5), gridspec_kw={'width_ratios': [3, 2]})
a = ax[0]
for c in d['cuts']: a.plot([c['y'], c['y']], [c['le'], c['te']], color='#c8d0da', lw=0.6, zorder=1)
le = [p for p in d['le'] if p[0] >= d['y0'] - 3]; te = [p for p in d['teU'] if p[0] >= d['y0'] - 3]
a.plot([p[0] for p in le], [p[1] for p in le], color='#1f5fbf', lw=1.8, label='surface leading edge')
a.plot([p[0] for p in te], [p[1] for p in te], color='#c2410c', lw=1.8, label='surface trailing edge')
ys = [d['y0'] - 3 + i * (E['end'] - d['y0'] + 3) / 2000 for i in range(2001)]
a.plot(ys, [XL - 0.25*ce(y) for y in ys], '--', color='#111', lw=1, label='ideal ellipse (line at 25 %)')
a.plot(ys, [XL + 0.75*ce(y) for y in ys], '--', color='#111', lw=1)
a.scatter([c['y'] for c in d['cuts']], [c['le'] for c in d['cuts']], s=7, color='#1f5fbf', zorder=3)
a.scatter([c['y'] for c in d['cuts']], [c['te'] for c in d['cuts']], s=7, color='#c2410c', zorder=3)
secs = [s for s in d['sections'] if s['y'] >= d['y0'] - 3]
a.scatter([s['y'] for s in secs], [s['x'] for s in secs], marker='D', s=30, facecolor='none', edgecolor='k', zorder=4, label='sections')
a.scatter([s['y'] for s in secs], [s['x'] + s['chord'] for s in secs], marker='D', s=30, facecolor='none', edgecolor='k', zorder=4)
a.axhline(XL, color='#888', lw=0.6, ls=':')
a.invert_yaxis(); a.set_aspect('equal'); a.set_xlabel('y (span) mm'); a.set_ylabel('x (aft) mm')
a.set_title(f'Glider, Continue the ellipse: top view of the outer 5 % ({d["y0"]:.1f} to {tipY:.1f} mm), {len(rows)} cuts at 1 mm')
a.legend(loc='lower left', fontsize=8); a.grid(alpha=0.25)
b = ax[1]
b.plot([r[0] for r in rows], [r[6] for r in rows], '-o', ms=3, color='#1f5fbf', label='LE: surface − ellipse')
b.plot([r[0] for r in rows], [r[7] for r in rows], '-o', ms=3, color='#c2410c', label='TE: surface − ellipse')
b.plot([r[0] for r in rows], [r[8] for r in rows], '-', color='#555', lw=1, label='chord: surface − ellipse')
for s in secs: b.axvline(s['y'], color='#bbb', lw=0.6, ls='--')
b.axhline(0, color='k', lw=0.6); b.set_xlabel('y mm'); b.set_ylabel('deviation mm'); b.set_title('Deviation from the analytic ellipse (dashed: sections)')
b.legend(fontsize=8); b.grid(alpha=0.25)
fig.tight_layout(); fig.savefig(S + '/tip_cuts.png', dpi=130)
# zoom last 8 mm
fig2, z = plt.subplots(figsize=(8, 8))
lz = [p for p in le if p[0] >= tipY - 8]; tz = [p for p in te if p[0] >= tipY - 8]
z.plot([p[0] for p in lz], [p[1] for p in lz], color='#1f5fbf', lw=1.8, label='surface LE')
z.plot([p[0] for p in tz], [p[1] for p in tz], color='#c2410c', lw=1.8, label='surface TE')
yz = [tipY - 8 + i * 8 / 1000 for i in range(1001)]
z.plot(yz, [XL - 0.25*ce(y) for y in yz], '--', color='#111', lw=1, label='ideal ellipse'); z.plot(yz, [XL + 0.75*ce(y) for y in yz], '--', color='#111', lw=1)
for c in d['cuts']:
    if c['y'] >= tipY - 8: z.plot([c['y']]*2, [c['le'], c['te']], color='#c8d0da', lw=0.8)
z.invert_yaxis(); z.set_aspect('equal'); z.grid(alpha=0.25); z.legend(fontsize=8)
z.set_title('Last 8 mm to the point'); z.set_xlabel('y mm'); z.set_ylabel('x mm')
fig2.tight_layout(); fig2.savefig(S + '/tip_cuts_zoom.png', dpi=130)
