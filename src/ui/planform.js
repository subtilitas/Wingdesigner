// Planform editor: top view of the half wing with draggable section edges and guide-curve points.
// Screen layout: span y to the right, chord x downwards (world coordinates [y, -x]).

import { surfacePoint } from '../geom/nurbs.js';
import { guideCurve, sampleGuide } from '../geom/guide.js';
import { addGuidePoint, chordFromTrailingEdge, dragLeadingEdge, moveGuidePoint, removeGuidePoint, resetDisabledGuides, resetGuide, setGuideEnabled, sortedSections, syncGuidesToSpan } from '../model/edit.js';
import { PanZoomCanvas, cssVar } from './panzoom.js';
import { clear, formatNum, h, numberInput } from './dom.js';
import { stationAt } from './sections.js';
import { edgeParams } from '../geom/sampling.js';
import { LIMITS } from '../model/project.js';
import { WARN, costPhrase, projectSize } from '../model/budget.js';

/** Title of "Add point": the hard limit, or above the warning threshold the time and memory with one more point. */
function addPointTitle(project, guide) {
  const n = guide.points.length + 1;
  if (n > LIMITS.maxGuidePoints) return `At most ${LIMITS.maxGuidePoints.toLocaleString('en')} points per guide curve.`;
  if (n <= WARN.guidePoints) return 'Add a point in the widest gap';
  const size = projectSize(project);
  size.guidePoints = Math.max(size.guidePoints, n);
  return `Add a point in the widest gap. With ${n.toLocaleString('en')} points, ${costPhrase(size)}.`;
}

const GUIDE_LABEL = { nose: 'Nose line (leading edge)', end: 'End line (trailing edge)' };

// Outline per build: repaints (pan, zoom, drag feedback) reuse it.
const outlines = new WeakMap();

/**
 * Built planform outline as [y, x] points: leading edge root to tip, trailing edge tip to root, at
 * the span samples of the 3D edge lines (4 per station interval, at most 20,000): a fixed uniform
 * sample missed sections between its points.
 */
function outlinePoints(build) {
  if (!build?.surface) return [];
  if (outlines.has(build)) return outlines.get(build);
  const le = [];
  const te = [];
  for (const v of edgeParams(build.paramsV)) {
    const a = surfacePoint(build.surface, build.uLE, v);
    const b = surfacePoint(build.surface, 0, v);
    const c = surfacePoint(build.surface, 1, v);
    le.push([a[1], a[0]]);
    te.push([b[1], Math.max(b[0], c[0])]);
  }
  const out = [...le, ...te.reverse()];
  outlines.set(build, out);
  return out;
}

/**
 * Guide y to wing y and back. The build stretches a guide onto the root-to-tip span; Open fits the
 * stored points to it, except on spans too narrow for distinct numbers, where they keep their y.
 */
function guideSpan(project, gd) {
  const s = sortedSections(project);
  const [y0, y1] = [s[0].y, s[s.length - 1].y];
  const [a, b] = [gd.points[0][1], gd.points[gd.points.length - 1][1]];
  if (!(b > a) || (a === y0 && b === y1)) return { toWing: (y) => y, toGuide: (y) => y };
  return { toWing: (y) => y0 + ((y - a) / (b - a)) * (y1 - y0), toGuide: (y) => a + ((y - y0) / (y1 - y0)) * (b - a) };
}

// Samples per guide object, reused while its mode, degree and points stay equal: pans, zooms and
// drag feedback repaint without a new fit (a 20,000-point guide took about 90 ms per repaint).
// Edits change the points in place, so the cache keeps a copy to compare.
const guideCache = new WeakMap();

/** An enabled guide curve sampled per knot span as [x, y] (sampleGuide), or null. */
function guideSamples(gd) {
  if (!gd?.enabled || !gd.points || gd.points.length < 2) return null;
  const pts = gd.points;
  const c = guideCache.get(gd);
  if (c && c.mode === gd.mode && c.degree === gd.degree && c.xy.length === 2 * pts.length && pts.every((q, i) => q[0] === c.xy[2 * i] && q[1] === c.xy[2 * i + 1])) {
    return c.samples;
  }
  let samples;
  try {
    samples = sampleGuide(guideCurve(gd));
  } catch {
    samples = null;
  }
  const xy = new Float64Array(2 * pts.length);
  pts.forEach((q, i) => {
    xy[2 * i] = q[0];
    xy[2 * i + 1] = q[1];
  });
  guideCache.set(gd, { mode: gd.mode, degree: gd.degree, xy, samples });
  return samples;
}

/**
 * Which edge handles of a section move something: none on an edge a guide curve sets; on a pointed
 * tip the chord is the scaled previous chord, so its trailing edge never moves and, with the end
 * line on, its leading edge neither (xLE = end line x - chord).
 */
export function edgeHandles(p, s, tipId) {
  const g = p.guides ?? {};
  const pointedTip = p.settings?.tip?.mode === 'pointed' && s.id === tipId;
  return { le: !g.nose?.enabled && !(pointedTip && g.end?.enabled), te: !g.end?.enabled && !pointedTip };
}

export class PlanformEditor {
  constructor(root, store, getBuild) {
    this.root = root;
    this.store = store;
    this.getBuild = getBuild;
    this.selectedGuide = null; // { key, index }
    // Undo, redo and loading replace the guide points: a kept index would point at another point,
    // and a drag in progress continues as a new undo step.
    store.subscribe((project, reason) => {
      if (reason === 'undo' || reason === 'redo' || reason === 'load') {
        this.selectedGuide = null;
        // A drag in progress ends: its point index may name another point now.
        this.dragStart = null;
        if (this.pz?.drag?.handle) this.pz.drag = null;
      }
    });
    this.readout = h('div', { class: 'readout', 'aria-live': 'polite' }, 'Drag points to edit. Pinch or scroll to zoom, drag the background to pan, double-click to fit.');
    this.canvas = h('canvas', { class: 'planform-canvas', 'aria-label': 'Planform editor' });
    const tools = h(
      'div',
      { class: 'toolbar' },
      h('button', { type: 'button', onclick: () => this.pz.fit(), title: 'Fit view' }, 'Fit'),
      h('button', { type: 'button', onclick: () => this.pz.zoomBy(1.25), title: 'Zoom in' }, '+'),
      h('button', { type: 'button', onclick: () => this.pz.zoomBy(0.8), title: 'Zoom out' }, '−'),
      h('label', { class: 'check' }, (this.ghost = h('input', { type: 'checkbox', checked: true, onchange: () => this.pz.redraw() })), 'Mirror'),
    );
    this.form = h('div', { class: 'guide-forms' });
    clear(root).append(h('div', { class: 'canvas-wrap' }, this.canvas, tools), this.readout, this.form);
    this.pz = new PanZoomCanvas(this.canvas, {
      draw: (ctx, view, w, hgt) => this.draw(ctx, view, w, hgt),
      hitTest: (wx, wy, tol) => this.hitTest(wx, wy, tol),
      onDrag: (hnd, wx, wy, phase) => this.onDrag(hnd, wx, wy, phase),
      onTap: () => {
        this.selectedGuide = null;
        this.renderForm();
        this.pz.redraw();
      },
      bounds: () => this.bounds(),
    });
    this.renderForm();
  }

  bounds() {
    const s = sortedSections(this.store.project);
    let ymin = Infinity;
    let ymax = -Infinity;
    let xmin = Infinity;
    let xmax = -Infinity;
    for (const sec of s) {
      ymin = Math.min(ymin, sec.y);
      ymax = Math.max(ymax, sec.y);
      xmin = Math.min(xmin, sec.x);
      xmax = Math.max(xmax, sec.x + sec.chord);
    }
    // Guide points, the evaluated guide curves and the built outline: a through-point guide over
    // unevenly spaced points can swing far beyond its points.
    const g = this.store.project.guides;
    const addX = (x) => {
      if (!Number.isFinite(x)) return;
      xmin = Math.min(xmin, x);
      xmax = Math.max(xmax, x);
    };
    for (const key of ['nose', 'end']) {
      if (!g?.[key]?.enabled) continue;
      for (const [x] of g[key].points) addX(x);
      for (const [x] of guideSamples(g[key]) ?? []) addX(x);
    }
    for (const [, x] of outlinePoints(this.getBuild())) addX(x);
    const left = this.ghost?.checked ? -ymax : ymin;
    return [left, -xmax, ymax, -xmin];
  }

  update() {
    this.renderForm();
    this.pz.redraw();
  }

  draw(ctx, view, w, hgt) {
    const grid = cssVar('--grid', '#dde3ea');
    const axis = cssVar('--axis', '#9aa6b2');
    const ink = cssVar('--ink', '#1d2430');
    const accent = cssVar('--accent', '#2f6fdf');
    const warn = cssVar('--danger', '#d0452a');
    const fill = cssVar('--wing-fill', 'rgba(47,111,223,0.12)');
    const ghostFill = cssVar('--ghost-fill', 'rgba(120,130,145,0.10)');
    const step = view.drawGrid(ctx, w, hgt, grid, axis);
    ctx.fillStyle = axis;
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillText(`grid ${formatNum(step)} mm`, 8, hgt - 8);

    const p = this.store.project;
    const build = this.getBuild();
    const toS = (y, x) => view.toScreen(y, -x);
    const outline = outlinePoints(build);
    const poly = (pts, mirror) => {
      ctx.beginPath();
      pts.forEach(([y, x], i) => {
        const [sx, sy] = toS(mirror ? -y : y, x);
        if (i) ctx.lineTo(sx, sy);
        else ctx.moveTo(sx, sy);
      });
      ctx.closePath();
    };
    if (outline.length) {
      if (this.ghost.checked) {
        poly(outline, true);
        ctx.fillStyle = ghostFill;
        ctx.fill();
      }
      poly(outline, false);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Sections: chord lines and edge handles.
    const sel = this.store.selection.section;
    const g = p.guides ?? {};
    const sortedDraw = sortedSections(p);
    const tipId = sortedDraw[sortedDraw.length - 1]?.id;
    sortedDraw.forEach((s, i) => {
      const handles = edgeHandles(p, s, tipId);
      const st = build?.stations ? stationAt(build.stations, s.y) : undefined;
      const xLE = st ? st.xLE : s.x;
      const chord = st ? st.chord : s.chord;
      const [ax, ay] = toS(s.y, xLE);
      const [bx, by] = toS(s.y, xLE + chord);
      ctx.strokeStyle = s.id === sel ? warn : accent;
      ctx.lineWidth = s.id === sel ? 2.5 : 1.5;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
      ctx.fillStyle = ink;
      ctx.fillText(String(i + 1), ax + 4, ay - 6);
      if (handles.le) square(ctx, ax, ay, 5, s.id === sel ? warn : accent);
      if (handles.te) circle(ctx, bx, by, 5, s.id === sel ? warn : accent);
    });

    // Guide curves.
    for (const key of ['nose', 'end']) {
      const gd = g[key];
      if (!gd?.enabled || !gd.points || gd.points.length < 2) continue;
      const color = key === 'nose' ? cssVar('--nose', '#0f9d58') : cssVar('--end', '#b8621b');
      const { toWing } = guideSpan(p, gd);
      const samples = guideSamples(gd);
      if (samples) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        samples.forEach(([x, y], k) => {
          const [sx, sy] = toS(toWing(y), x);
          if (k) ctx.lineTo(sx, sy);
          else ctx.moveTo(sx, sy);
        });
        ctx.stroke();
      }
      if (gd.mode === 'control') {
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        gd.points.forEach(([x, y], i) => {
          const [sx, sy] = toS(toWing(y), x);
          if (i) ctx.lineTo(sx, sy);
          else ctx.moveTo(sx, sy);
        });
        ctx.stroke();
        ctx.setLineDash([]);
      }
      gd.points.forEach(([x, y], i) => {
        const [sx, sy] = toS(toWing(y), x);
        const active = this.selectedGuide && this.selectedGuide.key === key && this.selectedGuide.index === i;
        diamond(ctx, sx, sy, active ? 8 : 6, active ? warn : color);
      });
    }
  }

  hitTest(wy, wmx, tol) {
    const p = this.store.project;
    const x = -wmx;
    const y = wy;
    const g = p.guides ?? {};
    // The nearest handle within the tolerance: guide points near an elliptic tip lie closer together
    // than the pick radius.
    let best = null;
    let bestD = tol;
    const consider = (d, handle) => {
      if (d <= bestD) {
        best = handle;
        bestD = d;
      }
    };
    for (const key of ['nose', 'end']) {
      const gd = g[key];
      if (!gd?.enabled) continue;
      const { toWing } = guideSpan(p, gd);
      for (let i = 0; i < gd.points.length; i++) {
        const [px, py] = gd.points[i];
        consider(Math.hypot(px - x, toWing(py) - y), { type: 'guide', key, index: i });
      }
    }
    const build = this.getBuild();
    const sorted = sortedSections(p);
    const tipId = sorted[sorted.length - 1]?.id;
    for (const s of sorted) {
      const st = build?.stations ? stationAt(build.stations, s.y) : undefined;
      const xLE = st ? st.xLE : s.x;
      const chord = st ? st.chord : s.chord;
      const handles = edgeHandles(p, s, tipId);
      if (handles.le) consider(Math.hypot(xLE - x, s.y - y), { type: 'le', id: s.id });
      if (handles.te) consider(Math.hypot(xLE + chord - x, s.y - y), { type: 'te', id: s.id });
    }
    return best;
  }

  onDrag(hnd, wy, wmx, phase) {
    if (phase === 'cancel') {
      this.store.lastKey = null;
      return;
    }
    const x = Math.round(-wmx * 10) / 10;
    let y = Math.round(wy * 10) / 10;
    if (phase === 'start') {
      // The point's own y, which need not lie on the 0.1 mm grid of the pointer.
      const p = this.store.project;
      const origY = hnd.type === 'guide' ? p.guides[hnd.key].points[hnd.index][1] : p.sections.find((q) => q.id === hnd.id)?.y;
      this.dragStart = { y, origY };
      if (hnd.type === 'guide') {
        this.selectedGuide = { key: hnd.key, index: hnd.index };
        this.renderForm();
      } else {
        this.store.select(hnd.id);
      }
      this.pz.redraw();
      return;
    }
    if (phase === 'end') {
      this.store.lastKey = null;
      return;
    }
    // Without spanwise pointer movement the point keeps its y; otherwise a guide point takes the
    // guide y of the pointer.
    const still = this.dragStart && y === this.dragStart.y && this.dragStart.origY !== undefined;
    if (still) y = this.dragStart.origY;
    const key = `drag-${hnd.type}-${hnd.id ?? hnd.key}-${hnd.index ?? ''}`;
    if (hnd.type === 'guide') {
      // An undo during the drag can remove the point.
      if (!(hnd.index < (this.store.project.guides[hnd.key]?.points?.length ?? 0))) return;
      const gy = still ? y : guideSpan(this.store.project, this.store.project.guides[hnd.key]).toGuide(y);
      this.store.update((p) => moveGuidePoint(p, hnd.key, hnd.index, x, gy), { key, session: true });
      const pt = this.store.project.guides[hnd.key].points[hnd.index];
      this.readout.textContent = `${GUIDE_LABEL[hnd.key]} point ${hnd.index + 1}: x ${formatNum(pt[0], 1)} mm, y ${formatNum(pt[1], 1)} mm`;
    } else {
      this.store.update(
        (p) => {
          const s = p.sections.find((q) => q.id === hnd.id);
          if (!s) return;
          // Effective edges come from the build: with one guide on, the other edge follows the chord.
          const b = this.getBuild();
          const st = b?.stations?.find((q) => q.y === s.y);
          if (hnd.type === 'le') {
            dragLeadingEdge(p, s.id, x, y, b?.guides?.end ?? null);
          } else {
            const le = p.guides?.nose?.enabled && st ? st.xLE : s.x;
            s.chord = chordFromTrailingEdge(x, le);
          }
          // Disabled, unedited guides follow the section edges, as after an edit in the Sections table.
          resetDisabledGuides(p);
          syncGuidesToSpan(p);
        },
        { key, session: true },
      );
      const s = this.store.project.sections.find((q) => q.id === hnd.id);
      if (s) this.readout.textContent = `Section at y ${formatNum(s.y, 1)} mm: x ${formatNum(s.x, 1)} mm, chord ${formatNum(s.chord, 1)} mm`;
    }
  }

  renderForm() {
    const p = this.store.project;
    const forms = ['nose', 'end'].map((key) => {
      const gd = p.guides?.[key];
      if (!gd) return null;
      const upd = (fn) => this.store.update((q) => fn(q.guides[key]));
      const rows = gd.enabled
        ? h(
            'table',
            { class: 'grid-table' },
            h('thead', {}, h('tr', {}, h('th', {}, '#'), h('th', {}, 'x mm'), h('th', {}, 'y mm'))),
            h(
              'tbody',
              {},
              gd.points.map(([x, y], i) =>
                h(
                  'tr',
                  { class: this.selectedGuide?.key === key && this.selectedGuide.index === i ? 'selected' : '' },
                  h('td', {}, String(i + 1)),
                  h(
                    'td',
                    {},
                    numberInput({
                      value: x,
                      step: 1,
                      focusKey: `guide:${key}:${i}:x`,
                      onCommit: (v) => this.store.update((q) => moveGuidePoint(q, key, i, v, q.guides[key].points[i][1])),
                    }),
                  ),
                  h(
                    'td',
                    {},
                    i === 0 || i === gd.points.length - 1
                      ? h('span', { class: 'muted', title: 'End points follow the root and tip span positions' }, formatNum(y, 1))
                      : numberInput({
                          value: y,
                          step: 1,
                          focusKey: `guide:${key}:${i}:y`,
                          onCommit: (v) => this.store.update((q) => moveGuidePoint(q, key, i, q.guides[key].points[i][0], v)),
                        }),
                  ),
                ),
              ),
            ),
          )
        : null;
      return h(
        'fieldset',
        { class: 'guide' },
        h('legend', {}, GUIDE_LABEL[key]),
        h(
          'div',
          { class: 'row wrap' },
          h(
            'label',
            { class: 'check' },
            h('input', {
              type: 'checkbox',
              checked: !!gd.enabled,
              dataset: { focusKey: `guide:${key}:enabled` },
              onchange: (e) => {
                // The points can change (an unedited guide takes the section edges): no kept index.
                this.selectedGuide = null;
                this.store.update((q) => setGuideEnabled(q, key, e.target.checked));
              },
            }),
            'Use guide curve',
          ),
          h(
            'label',
            {},
            'Mode ',
            h(
              'select',
              { onchange: (e) => upd((g) => (g.mode = e.target.value)), disabled: !gd.enabled, dataset: { focusKey: `guide:${key}:mode` } },
              h('option', { value: 'fit', selected: gd.mode === 'fit' }, 'Through points'),
              h('option', { value: 'control', selected: gd.mode === 'control' }, 'Control points'),
            ),
          ),
          h(
            'label',
            {},
            'Degree ',
            h(
              'select',
              { onchange: (e) => upd((g) => (g.degree = Number(e.target.value))), disabled: !gd.enabled, dataset: { focusKey: `guide:${key}:degree` } },
              [1, 2, 3, 4, 5].map((d) => h('option', { value: String(d), selected: (gd.degree ?? 3) === d }, String(d))),
            ),
          ),
        ),
        gd.enabled
          ? h(
              'div',
              { class: 'row wrap' },
              h(
                'button',
                {
                  type: 'button',
                  disabled: gd.points.length >= LIMITS.maxGuidePoints,
                  title: addPointTitle(this.store.project, gd),
                  onclick: () =>
                    this.store.update((q) => {
                      const i = addGuidePoint(q, key);
                      this.selectedGuide = i >= 0 ? { key, index: i } : null;
                    }),
                },
                'Add point',
              ),
              h(
                'button',
                {
                  type: 'button',
                  disabled: !(this.selectedGuide?.key === key && this.selectedGuide.index > 0 && this.selectedGuide.index < gd.points.length - 1),
                  onclick: () =>
                    this.store.update((q) => {
                      if (removeGuidePoint(q, key, this.selectedGuide.index)) this.selectedGuide = null;
                    }),
                },
                'Remove selected point',
              ),
              h(
                'button',
                {
                  type: 'button',
                  onclick: () => {
                    this.selectedGuide = null;
                    this.store.update((q) => resetGuide(q, key));
                  },
                },
                'Reset to sections',
              ),
            )
          : h('p', { class: 'muted' }, key === 'nose' ? 'Off: the leading edge follows the section x positions.' : 'Off: the trailing edge follows the section chords.'),
        rows,
      );
    });
    clear(this.form).append(...forms.filter(Boolean));
  }
}

function square(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
}

function circle(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function diamond(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r, y);
  ctx.lineTo(x, y + r);
  ctx.lineTo(x - r, y);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1;
  ctx.stroke();
}
