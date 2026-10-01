// Winglet dialog: appends integral winglet sections to the wing tip (src/model/winglet.js) as one
// undo step. The preview builds the wing with the winglet and draws it from the front (y, z).

import { WINGLET_RANGES, addWinglet, defaultWinglet, wingletProblems, wingletSections } from '../model/winglet.js';
import { buildWing } from '../geom/wing.js';
import { cloneProject } from '../model/project.js';
import { sortedSections } from '../model/edit.js';
import { PanZoomCanvas, cssVar } from './panzoom.js';
import { displayName } from '../model/budget.js';
import { h, numberField, showNumber } from './dom.js';
import { fixed, readNumber, tr } from '../i18n/index.js';

// label: functions, because the language can change between two openings of the dialog.
const FIELDS = [
  { key: 'height', label: () => tr('Height along the winglet (mm)'), step: 5 },
  { key: 'cant', label: () => tr('Cant angle (deg, positive = up)'), step: 1 },
  { key: 'radius', label: () => tr('Blend radius (mm)'), step: 1 },
  { key: 'sweep', label: () => tr('Leading-edge sweep (deg)'), step: 1 },
  { key: 'tipChord', label: () => tr('Tip chord (% of the wing tip chord)'), step: 5 },
  { key: 'toe', label: () => tr('Toe (deg, twist at the winglet tip)'), step: 0.5 },
];

/** Opens the winglet dialog for the project in `store`. */
export function wingletDialog(store, notify = () => {}) {
  const project = cloneProject(store.project);
  const params = defaultWinglet(project);
  let preview = null;
  let problems = [];

  const summary = h('p', { class: 'small', 'aria-live': 'polite' });
  const canvas = h('canvas', { class: 'wizard-canvas', role: 'img', 'aria-label': tr('Front view of the wing with the winglet') });
  const addBtn = h('button', { type: 'button', class: 'primary' }, tr('Add winglet'));

  const fields = FIELDS.map((f) => {
    const [lo, hi] = WINGLET_RANGES[f.key];
    const input = numberField({ value: params[f.key], step: f.step, min: lo, max: hi, fallback: () => (Number.isFinite(params[f.key]) ? params[f.key] : defaultWinglet(project)[f.key]) });
    input.addEventListener('input', () => {
      params[f.key] = readNumber(input.value);
      refresh();
    });
    input.addEventListener('change', () => {
      if (Number.isFinite(params[f.key])) showNumber(input, params[f.key]);
    });
    return h('label', { class: 'field' }, f.label(), input);
  });
  const airfoil = h(
    'select',
    {
      onchange: (e) => {
        params.airfoil = e.target.value;
        refresh();
      },
    },
    ...project.airfoils.map((a) => h('option', { value: a.id, selected: a.id === params.airfoil }, displayName(a.name))),
  );

  const refresh = () => {
    problems = wingletProblems(project, params);
    preview = null;
    let added = [];
    if (!problems.length) {
      const p = cloneProject(project);
      added = addWinglet(p, params);
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
      summary.textContent = tr('Adds {n} sections. Winglet tip at y = {y} mm, z = {z} mm: {up} mm above and {out} mm beyond the wing tip.', {
        n: added.length,
        y: fixed(end.y, 1),
        z: fixed(end.z, 1),
        up: fixed(end.z - tip.z, 1),
        out: fixed(end.y - tip.y, 1),
      });
    }
    pz.fitted = false;
    pz.redraw();
  };

  // Front view: every station of the preview as its airfoil seen from ahead, in y and z; the winglet
  // in the accent colour. Without a preview, the reference line of the sections and the winglet.
  const pz = new PanZoomCanvas(canvas, {
    bounds: () => {
      const pts = previewPoints();
      if (!pts.length) return null;
      let [y0, z0, y1, z1] = [Infinity, Infinity, -Infinity, -Infinity];
      for (const [y, z] of pts) {
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
        z0 = Math.min(z0, z);
        z1 = Math.max(z1, z);
      }
      // The outer half of the span, where the winglet sits, fills the view.
      const ymin = y0 + (y1 - y0) * 0.4;
      return [ymin, z0, y1, Math.max(z1, z0 + 1)];
    },
    draw: (ctx, view, w, hgt) => {
      view.drawGrid(ctx, w, hgt, cssVar('--grid', '#dde3ea'), cssVar('--axis', '#9aa6b2'));
      const tipY = sortedSections(project).at(-1).y;
      const line = (pts, color, width) => {
        ctx.beginPath();
        pts.forEach(([y, z], i) => {
          const [sx, sy] = view.toScreen(y, z);
          if (i) ctx.lineTo(sx, sy);
          else ctx.moveTo(sx, sy);
        });
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.stroke();
      };
      const ink = cssVar('--ink', '#1d2430');
      const accent = cssVar('--accent', '#2f6fdf');
      if (preview?.stations) {
        for (const st of preview.stations) line(st.points.map((p) => [p[1], p[2]]), st.y > tipY + 1e-6 ? accent : ink, 1);
      } else {
        line(sortedSections(project).map((s) => [s.y, s.z]), ink, 1.5);
      }
    },
  });
  const previewPoints = () => {
    if (preview?.stations) return preview.stations.flatMap((st) => st.points.map((p) => [p[1], p[2]]));
    const pts = sortedSections(project).map((s) => [s.y, s.z]);
    if (!wingletProblems(project, params).length) pts.push(...wingletSections(project, params).map((s) => [s.y, s.z]));
    return pts;
  };

  addBtn.addEventListener('click', () => {
    if (!problems.length) {
      store.update((q) => addWinglet(q, params));
      notify(tr('Winglet added: {n} sections. Undo removes it.', { n: wingletSections(project, params).length }));
      dialog.close();
    }
  });

  const dialog = h(
    'dialog',
    { class: 'modal wide' },
    h(
      'form',
      { method: 'dialog', onsubmit: (e) => e.preventDefault() },
      h('h2', {}, tr('Winglet')),
      h('p', { class: 'small muted' }, tr('Appends sections beyond the wing tip that bend the wing up or down along a blend arc and run on straight to the winglet tip. They are ordinary sections afterwards: editable in the Sections table, removable with Undo.')),
      h('div', { class: 'wizard-body' }, h('div', { class: 'wizard-left' }, h('div', { class: 'wizard-fields' }, ...fields, h('label', { class: 'field' }, tr('Winglet tip airfoil'), airfoil))), h('div', { class: 'wizard-right' }, h('div', { class: 'canvas-wrap' }, canvas), summary)),
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
