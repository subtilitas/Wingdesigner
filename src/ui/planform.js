// Planform editor: top view of the half wing with draggable section edges and guide-curve points.
// Screen layout: span y to the right, chord x downwards (world coordinates [y, -x]).

import { curvePoint, surfacePoint } from '../geom/nurbs.js';
import { guideCurve } from '../geom/guide.js';
import { addGuidePoint, clampSectionY, moveGuidePoint, removeGuidePoint, resetGuide, sortedSections, syncGuidesToSpan } from '../model/edit.js';
import { PanZoomCanvas, cssVar } from './panzoom.js';
import { clear, formatNum, h, numberInput } from './dom.js';

const GUIDE_LABEL = { nose: 'Nose line (leading edge)', end: 'End line (trailing edge)' };

export class PlanformEditor {
  constructor(root, store, getBuild) {
    this.root = root;
    this.store = store;
    this.getBuild = getBuild;
    this.selectedGuide = null; // { key, index }
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
    const g = this.store.project.guides;
    for (const key of ['nose', 'end']) {
      if (!g?.[key]?.enabled) continue;
      for (const [x] of g[key].points) {
        xmin = Math.min(xmin, x);
        xmax = Math.max(xmax, x);
      }
    }
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
    const outline = [];
    if (build?.surface) {
      const n = 80;
      const le = [];
      const te = [];
      for (let k = 0; k <= n; k++) {
        const v = k / n;
        const a = surfacePoint(build.surface, build.uLE, v);
        const b = surfacePoint(build.surface, 0, v);
        const c = surfacePoint(build.surface, 1, v);
        le.push([a[1], a[0]]);
        te.push([b[1], Math.max(b[0], c[0])]);
      }
      outline.push(...le, ...te.reverse());
    }
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
    sortedSections(p).forEach((s, i) => {
      const st = build?.stations?.find((q) => Math.abs(q.y - s.y) < 1e-9);
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
      if (!g.nose?.enabled) square(ctx, ax, ay, 5, s.id === sel ? warn : accent);
      if (!g.end?.enabled) circle(ctx, bx, by, 5, s.id === sel ? warn : accent);
    });

    // Guide curves.
    for (const key of ['nose', 'end']) {
      const gd = g[key];
      if (!gd?.enabled || !gd.points || gd.points.length < 2) continue;
      const color = key === 'nose' ? cssVar('--nose', '#0f9d58') : cssVar('--end', '#b8621b');
      let curve;
      try {
        curve = guideCurve(gd);
      } catch {
        curve = null;
      }
      if (curve) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let k = 0; k <= 200; k++) {
          const [x, y] = curvePoint(curve, k / 200);
          const [sx, sy] = toS(y, x);
          if (k) ctx.lineTo(sx, sy);
          else ctx.moveTo(sx, sy);
        }
        ctx.stroke();
      }
      if (gd.mode === 'control') {
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        gd.points.forEach(([x, y], i) => {
          const [sx, sy] = toS(y, x);
          if (i) ctx.lineTo(sx, sy);
          else ctx.moveTo(sx, sy);
        });
        ctx.stroke();
        ctx.setLineDash([]);
      }
      gd.points.forEach(([x, y], i) => {
        const [sx, sy] = toS(y, x);
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
    for (const key of ['nose', 'end']) {
      const gd = g[key];
      if (!gd?.enabled) continue;
      for (let i = 0; i < gd.points.length; i++) {
        const [px, py] = gd.points[i];
        if (Math.hypot(px - x, py - y) <= tol) return { type: 'guide', key, index: i };
      }
    }
    const build = this.getBuild();
    for (const s of sortedSections(p)) {
      const st = build?.stations?.find((q) => Math.abs(q.y - s.y) < 1e-9);
      const xLE = st ? st.xLE : s.x;
      const chord = st ? st.chord : s.chord;
      if (!g.nose?.enabled && Math.hypot(xLE - x, s.y - y) <= tol) return { type: 'le', id: s.id };
      if (!g.end?.enabled && Math.hypot(xLE + chord - x, s.y - y) <= tol) return { type: 'te', id: s.id };
    }
    return null;
  }

  onDrag(hnd, wy, wmx, phase) {
    if (phase === 'cancel') return;
    const x = Math.round(-wmx * 10) / 10;
    const y = Math.round(wy * 10) / 10;
    if (phase === 'start') {
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
    const key = `drag-${hnd.type}-${hnd.id ?? hnd.key}-${hnd.index ?? ''}`;
    if (hnd.type === 'guide') {
      this.store.update((p) => moveGuidePoint(p, hnd.key, hnd.index, x, y), { key });
      const pt = this.store.project.guides[hnd.key].points[hnd.index];
      this.readout.textContent = `${GUIDE_LABEL[hnd.key]} point ${hnd.index + 1}: x ${formatNum(pt[0], 1)} mm, y ${formatNum(pt[1], 1)} mm`;
    } else {
      this.store.update(
        (p) => {
          const s = p.sections.find((q) => q.id === hnd.id);
          if (!s) return;
          // Effective edges come from the build: with one guide on, the other edge follows the chord.
          const st = this.getBuild()?.stations?.find((q) => Math.abs(q.y - s.y) < 1e-9);
          if (hnd.type === 'le') {
            const te = p.guides?.end?.enabled && st ? st.xLE + st.chord : s.x + s.chord;
            s.x = Math.min(x, te - 1);
            s.chord = te - s.x;
            const sorted = sortedSections(p);
            const i = sorted.indexOf(s);
            s.y = clampSectionY(sorted, i, y);
          } else {
            const le = p.guides?.nose?.enabled && st ? st.xLE : s.x;
            s.chord = Math.max(1, x - le);
          }
          syncGuidesToSpan(p);
        },
        { key },
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
              onchange: (e) => {
                this.store.update((q) => {
                  q.guides[key].enabled = e.target.checked;
                  if (e.target.checked) resetGuide(q, key);
                });
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
              { onchange: (e) => upd((g) => (g.mode = e.target.value)), disabled: !gd.enabled },
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
              { onchange: (e) => upd((g) => (g.degree = Number(e.target.value))), disabled: !gd.enabled },
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
                  onclick: () =>
                    this.store.update((q) => {
                      const i = addGuidePoint(q, key);
                      this.selectedGuide = { key, index: i };
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
              h('button', { type: 'button', onclick: () => this.store.update((q) => resetGuide(q, key)) }, 'Reset to sections'),
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
