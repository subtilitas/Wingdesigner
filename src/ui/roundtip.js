// Rounded-tip dialog: appends the sections of a rounded wing tip (src/model/roundtip.js) as one undo
// step. The preview builds the wing with the rounded tip and draws it from above (y, x).

import { ROUND_TIP_RANGES, addRoundTip, defaultRoundTip, roundTipLength, roundTipProblems } from '../model/roundtip.js';
import { buildWing } from '../geom/wing.js';
import { cloneProject } from '../model/project.js';
import { sortedSections } from '../model/edit.js';
import { PanZoomCanvas, cssVar } from './panzoom.js';
import { h, numberField, showNumber } from './dom.js';
import { fixed, readNumber, tr } from '../i18n/index.js';

// label: functions, because the language can change between two openings of the dialog.
const FIELDS = [
  { key: 'length', label: () => tr('Length beyond the tip section (mm)'), step: 5 },
  { key: 'line', label: () => tr('Straight line (% of the chord from the leading edge)'), step: 5 },
  { key: 'sections', label: () => tr('Number of sections'), step: 1 },
  { key: 'fullness', label: () => tr('Fullness (2 = ellipse, 3 = fullest)'), step: 0.1 },
];

/** Opens the rounded-tip dialog for the project in `store`. */
export function roundTipDialog(store, notify = () => {}) {
  const project = cloneProject(store.project);
  const params = defaultRoundTip(project);
  let preview = null;
  let added = [];
  let problems = [];

  const summary = h('p', { class: 'small', 'aria-live': 'polite' });
  const canvas = h('canvas', { class: 'wizard-canvas', role: 'img', 'aria-label': tr('Top view of the wing with the rounded tip') });
  const addBtn = h('button', { type: 'button', class: 'primary' }, tr('Add rounded tip'));

  const inputs = {};
  const fields = FIELDS.map((f) => {
    const [lo, hi] = ROUND_TIP_RANGES[f.key];
    const input = numberField({ value: params[f.key], step: f.step, min: lo, max: hi, fallback: () => (Number.isFinite(params[f.key]) ? params[f.key] : defaultRoundTip(project)[f.key]) });
    input.addEventListener('input', () => {
      params[f.key] = readNumber(input.value);
      refresh();
    });
    input.addEventListener('change', () => {
      if (Number.isFinite(params[f.key])) showNumber(input, params[f.key]);
    });
    inputs[f.key] = input;
    return h('label', { class: 'field' }, f.label(), input);
  });

  const tangent = h('input', {
    type: 'checkbox',
    checked: params.tangent,
    onchange: (e) => {
      params.tangent = e.target.checked;
      refresh();
    },
  });
  // Continue the ellipse of the wing: the length follows from it, the chord is the ellipse's and
  // tangent, so Length, Fullness and Tangent do not apply.
  const ellipse = h('input', {
    type: 'checkbox',
    checked: params.ellipse,
    onchange: (e) => {
      params.ellipse = e.target.checked;
      // Unticked, the field shows the manual length again, the one the tip is built with.
      if (!params.ellipse && Number.isFinite(params.length)) showNumber(inputs.length, params.length);
      refresh();
    },
  });

  const refresh = () => {
    for (const key of ['length', 'fullness']) inputs[key].disabled = params.ellipse;
    tangent.disabled = params.ellipse;
    if (params.ellipse) {
      const length = roundTipLength(project, params);
      if (Number.isFinite(length)) showNumber(inputs.length, length);
    }
    problems = roundTipProblems(project, params);
    preview = null;
    added = [];
    if (!problems.length) {
      const p = cloneProject(project);
      added = addRoundTip(p, params);
      try {
        preview = buildWing(p);
        if (preview.errors.length) problems = preview.errors.slice();
      } catch (e) {
        problems = [e.message];
      }
    }
    addBtn.disabled = problems.length > 0;
    if (problems.length) {
      summary.className = 'small sev-error';
      summary.textContent = problems.join(' ');
    } else {
      const tip = sortedSections(project).at(-1);
      const end = added.at(-1);
      summary.className = 'small';
      summary.textContent = tr('Adds {n} sections and sets Settings > Wing tip to Round: the tip closes in a point. Point at y = {y} mm, {out} mm beyond the tip section.', {
        n: added.length,
        y: fixed(end.y, 1),
        out: fixed(end.y - tip.y, 1),
      });
    }
    pz.fitted = false;
    pz.redraw();
  };

  // Top view: leading and trailing edge of the preview stations in y and x (x aft, drawn downward);
  // the rounded tip in the accent colour. Without a preview, the edges of the sections.
  const edges = () => {
    const src = preview?.stations
      ? preview.stations.map((st) => {
          const xs = st.points.map((p) => p[0]);
          return { y: st.y, le: Math.min(...xs), te: Math.max(...xs) };
        })
      : sortedSections(project).map((s) => ({ y: s.y, le: s.x, te: s.x + s.chord }));
    return src.sort((a, b) => a.y - b.y);
  };
  const pz = new PanZoomCanvas(canvas, {
    bounds: () => {
      const e = edges();
      if (!e.length) return null;
      const y1 = e.at(-1).y;
      // The outer 40 % of the span, where the rounded tip sits, fills the view.
      const ymin = e[0].y + (y1 - e[0].y) * 0.6;
      const near = e.filter((q) => q.y >= ymin);
      const x0 = Math.min(...near.map((q) => q.le));
      const x1 = Math.max(...near.map((q) => q.te));
      return [ymin, -x1, y1, Math.max(-x0, -x1 + 1)];
    },
    draw: (ctx, view, w, hgt) => {
      view.drawGrid(ctx, w, hgt, cssVar('--grid', '#dde3ea'), cssVar('--axis', '#9aa6b2'));
      const tipY = sortedSections(project).at(-1).y;
      const ink = cssVar('--ink', '#1d2430');
      const accent = cssVar('--accent', '#2f6fdf');
      const line = (pts, color, width) => {
        ctx.beginPath();
        pts.forEach(([y, x], i) => {
          const [sx, sy] = view.toScreen(y, -x);
          if (i) ctx.lineTo(sx, sy);
          else ctx.moveTo(sx, sy);
        });
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.stroke();
      };
      const e = edges();
      const wing = e.filter((q) => q.y <= tipY + 1e-6);
      const round = e.filter((q) => q.y >= tipY - 1e-6);
      for (const [part, color] of [
        [wing, ink],
        [round, accent],
      ]) {
        if (part.length < 2) continue;
        line(part.map((q) => [q.y, q.le]), color, 1.5);
        line(part.map((q) => [q.y, q.te]), color, 1.5);
      }
      const last = wing.at(-1);
      if (last) line([[last.y, last.le], [last.y, last.te]], ink, 1);
    },
  });

  addBtn.addEventListener('click', () => {
    if (!problems.length) {
      const n = added.length;
      store.update((q) => addRoundTip(q, params));
      notify(tr('Rounded tip added: {n} sections, wing tip set to Round. Undo removes it.', { n }));
      dialog.close();
    }
  });

  const dialog = h(
    'dialog',
    { class: 'modal wide' },
    h(
      'form',
      { method: 'dialog', onsubmit: (e) => e.preventDefault() },
      h('h2', {}, tr('Rounded tip')),
      h(
        'p',
        { class: 'small muted' },
        tr('Appends sections beyond the tip section whose chord follows a superellipse to a point (Fullness 2: a quarter ellipse), with Tangent to the last panel scaled to start with the taper of the last panel; leading and trailing edge curve towards the straight line and meet on it. Airfoil and twist stay those of the tip section. They are ordinary sections afterwards: editable in the Sections table, removable with Undo.'),
      ),
      h('div', { class: 'wizard-body' }, h('div', { class: 'wizard-left' }, h('div', { class: 'wizard-fields' }, ...fields), h('label', { class: 'check', title: tr('The chord starts with the taper of the last panel: no corner in the planform at the tip section') }, tangent, tr('Tangent to the last panel')), h('label', { class: 'check', title: tr('The chord follows the ellipse through the chord and taper of the wing at the tip section, centred at the root, to its end; this sets the length') }, ellipse, tr('Continue the ellipse of the wing'))), h('div', { class: 'wizard-right' }, h('div', { class: 'canvas-wrap' }, canvas), summary)),
      h('div', { class: 'row end' }, h('button', { type: 'button', onclick: () => dialog.close() }, tr('Cancel')), addBtn),
    ),
  );
  document.body.append(dialog);
  dialog.addEventListener('close', () => {
    pz.destroy();
    dialog.remove();
  });
  dialog.showModal();
  requestAnimationFrame(refresh);
  return dialog;
}
