// Mold dialog: mold halves of the half wing (src/geom/mold.js) with a resin channel, alignment pin
// holes and clamping screw holes, written as STEP solids (src/export/moldstep.js). The preview draws
// the parting surface from above. The values are kept in browser storage, not in the project.

import { HOLE_PATTERNS, MOLD_DEFAULTS, MOLD_HALVES, MOLD_RANGES, moldGeometry, moldProblems, resolveMold } from '../geom/mold.js';
import { moldToStep } from '../export/moldstep.js';
import { storedUpAxis } from './exportui.js';
import { PanZoomCanvas, cssVar } from './panzoom.js';
import { download, h, numberField, showNumber, slugFile } from './dom.js';
import { fixed, readNumber, tr, whole } from '../i18n/index.js';

/** Browser storage key of the mold values. */
export const MOLD_SETTINGS_KEY = 'wingdesigner.mold';

const within = (v, [lo, hi]) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;

/** Stored values, each one checked against its range; defaults for the rest. */
export function storedMoldSettings() {
  let s;
  try {
    s = JSON.parse(localStorage.getItem(MOLD_SETTINGS_KEY) ?? '{}') ?? {};
  } catch {
    s = {};
  }
  const out = resolveMold({});
  const group = (k) => (s[k] && typeof s[k] === 'object' ? s[k] : {});
  for (const key of Object.keys(MOLD_RANGES)) {
    const [g, k] = key.includes('.') ? key.split('.') : [null, key];
    const v = g ? group(g)[k] : s[k];
    if (!within(v, MOLD_RANGES[key])) continue;
    if (g) out[g] = { ...out[g], [k]: v };
    else out[k] = v;
  }
  for (const g of ['channel', 'pins', 'screws']) {
    if (typeof group(g).on === 'boolean') out[g] = { ...out[g], on: group(g).on };
    if (g !== 'channel' && HOLE_PATTERNS.includes(group(g).pattern)) out[g] = { ...out[g], pattern: group(g).pattern };
  }
  if (MOLD_HALVES.includes(s.halves)) out.halves = s.halves;
  if (typeof s.left === 'boolean') out.left = s.left;
  return out;
}

function storeSettings(s) {
  try {
    localStorage.setItem(MOLD_SETTINGS_KEY, JSON.stringify(s));
  } catch {
    // Without storage the dialog starts with the defaults next time.
  }
}

const patternNames = () => ({ corners: tr('Block corners'), frame: tr('Along the block edges'), outline: tr('Around the wing') });

/** Opens the mold dialog for the current build. */
export function moldDialog(store, getBuild, notify = () => {}) {
  const build = getBuild();
  const name = store.project.name || 'wing';
  const blocked = !build?.surface;
  const params = storedMoldSettings();
  let geometry = null;
  let frame = 0;

  const summary = h('p', { class: 'small', 'aria-live': 'polite' });
  const notes = h('p', { class: 'small sev-warning', 'aria-live': 'polite' });
  const canvas = h('canvas', { class: 'wizard-canvas', role: 'img', 'aria-label': tr('Top view of the parting surface of the mold') });
  const saveBtn = h('button', { type: 'button', class: 'primary' }, tr('Download STEP'));

  const get = (path) => path.split('.').reduce((o, k) => o[k], params);
  const set = (path, v) => {
    const [g, k] = path.includes('.') ? path.split('.') : [null, path];
    if (g) params[g] = { ...params[g], [k]: v };
    else params[k] = v;
  };
  const inputs = {};
  const number = (path, label, step) => {
    const range = MOLD_RANGES[path];
    const input = numberField({ value: get(path), step, min: range[0], max: range[1], fallback: () => get(path) });
    input.addEventListener('change', () => {
      const v = readNumber(input.value);
      if (within(v, range)) set(path, v);
      showNumber(input, get(path));
      update();
    });
    inputs[path] = input;
    return h('label', { class: 'field' }, label, input);
  };
  const check = (path, label) => {
    const input = h('input', {
      type: 'checkbox',
      checked: get(path),
      onchange: (e) => {
        set(path, e.target.checked);
        update();
      },
    });
    inputs[path] = input;
    return h('label', { class: 'check' }, input, label);
  };
  const choice = (path, label, options) => {
    const input = h(
      'select',
      {
        onchange: (e) => {
          set(path, e.target.value);
          update();
        },
      },
      ...options.map(([value, text]) => h('option', { value, selected: get(path) === value }, text)),
    );
    inputs[path] = input;
    return h('label', { class: 'field' }, label, input);
  };
  const holes = (g, legend, extra) =>
    h(
      'fieldset',
      { 'data-group': g },
      h('legend', {}, check(`${g}.on`, legend)),
      h(
        'div',
        { class: 'wizard-fields' },
        number(`${g}.diameter`, tr('Diameter (mm)'), 0.5),
        ...extra,
        choice(`${g}.pattern`, tr('Pattern'), Object.entries(patternNames())),
        number(`${g}.spacing`, tr('Largest spacing (mm)'), 10),
        number(`${g}.edge`, tr('Distance from the block edge (mm)'), 1),
        number(`${g}.offset`, tr('Distance beyond the resin channel (mm)'), 1),
      ),
    );

  const update = () => {
    storeSettings(params);
    // Fields that the chosen pattern or a switched-off group does not use.
    for (const g of ['pins', 'screws']) {
      const on = params[g].on;
      const pattern = params[g].pattern;
      inputs[`${g}.diameter`].disabled = !on;
      inputs[`${g}.pattern`].disabled = !on;
      inputs[`${g}.spacing`].disabled = !on || pattern === 'corners';
      inputs[`${g}.edge`].disabled = !on || pattern === 'outline';
      inputs[`${g}.offset`].disabled = !on || pattern !== 'outline';
    }
    inputs['pins.depth'].disabled = !params.pins.on;
    inputs['channel.diameter'].disabled = !params.channel.on;
    inputs['channel.distance'].disabled = !params.channel.on;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      let problems = moldProblems(params);
      geometry = null;
      if (!problems.length) {
        try {
          const g = moldGeometry(build, params);
          if (g.errors.length) problems = g.errors;
          else geometry = g;
        } catch (e) {
          problems = [e.message];
        }
      }
      saveBtn.disabled = !geometry;
      if (!geometry) {
        summary.className = 'small sev-error';
        summary.textContent = problems.join(' ');
        notes.textContent = '';
      } else {
        const s = geometry.summary;
        summary.className = 'small';
        summary.textContent = [
          tr('Block {length} × {width} mm; lower half down to −{lower} mm, upper half up to +{upper} mm.', { length: fixed(s.length, 1), width: fixed(s.width, 1), lower: fixed(s.lower, 1), upper: fixed(s.upper, 1) }),
          tr('Parting surface along the chord lines, from {low} to {high} mm at the block faces; frame rolled {roll}° with the wing.', { low: fixed(s.partingRange[0], 1), high: fixed(s.partingRange[1], 1), roll: fixed(s.roll, 2) }),
          params.channel.on ? tr('Resin channel {length} mm long.', { length: whole(Math.round(s.channelLength)) }) : '',
          tr('{pins} pin holes, {screws} screw holes.', { pins: s.pins, screws: s.screws }),
        ]
          .filter(Boolean)
          .join(' ');
        notes.textContent = geometry.warnings.join(' ');
      }
      pz.fitted = false;
      pz.redraw();
    });
  };

  // Top view: y to the right, x aft drawn downward, as the other previews.
  const pz = new PanZoomCanvas(canvas, {
    bounds: () => {
      const b = geometry?.preview.block;
      return b ? [b.y0, -b.x1, b.y1, -b.x0] : null;
    },
    draw: (ctx, view, w, hgt) => {
      view.drawGrid(ctx, w, hgt, cssVar('--grid', '#dde3ea'), cssVar('--axis', '#9aa6b2'));
      if (!geometry) return;
      const { block, outline, channel, holes: list } = geometry.preview;
      const ink = cssVar('--ink', '#1d2430');
      const accent = cssVar('--accent', '#2f6fdf');
      const path = (pts, close) => {
        ctx.beginPath();
        pts.forEach(([x, y], i) => {
          const [sx, sy] = view.toScreen(y, -x);
          if (i) ctx.lineTo(sx, sy);
          else ctx.moveTo(sx, sy);
        });
        if (close) ctx.closePath();
      };
      const scale = Math.abs(view.toScreen(1, 0)[0] - view.toScreen(0, 0)[0]);
      path(
        [
          [block.x0, block.y0],
          [block.x0, block.y1],
          [block.x1, block.y1],
          [block.x1, block.y0],
        ],
        true,
      );
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      if (channel) {
        path(channel.path, false);
        ctx.strokeStyle = accent;
        ctx.lineCap = 'butt';
        ctx.lineWidth = Math.max(1.5, 2 * channel.radius * scale);
        ctx.stroke();
      }
      path(outline, false);
      ctx.fillStyle = cssVar('--wing-fill', 'rgba(47,111,223,0.12)');
      ctx.fill();
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      for (const hole of list) {
        const [sx, sy] = view.toScreen(hole.y, -hole.x);
        ctx.beginPath();
        ctx.arc(sx, sy, Math.max(2, hole.radius * scale), 0, 2 * Math.PI);
        if (hole.kind === 'pins') {
          ctx.fillStyle = ink;
          ctx.fill();
        } else {
          ctx.strokeStyle = ink;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }
    },
  });

  saveBtn.addEventListener('click', () => {
    if (!geometry) return;
    try {
      const moldName = `${name} mold`;
      download(slugFile(moldName, 'step'), moldToStep(geometry, { name: moldName, up: storedUpAxis() }), 'application/step');
      notify(tr('Mold exported as STEP.'));
    } catch (e) {
      notify(tr('Export failed: {message}.', { message: e.message }), true);
    }
  });

  const body = blocked
    ? [h('p', { class: 'sev-error' }, tr('The wing has errors; fix them before building a mold.'))]
    : [
        h(
          'div',
          { class: 'wizard-body' },
          h(
            'div',
            { class: 'wizard-left' },
            h(
              'fieldset',
              {},
              h('legend', {}, tr('Block')),
              h('div', { class: 'wizard-fields' }, number('margin', tr('Margin around the wing (mm)'), 5), number('floor', tr('Floor below the cavity (mm)'), 1)),
            ),
            h(
              'fieldset',
              { 'data-group': 'channel' },
              h('legend', {}, check('channel.on', tr('Resin channel'))),
              h('div', { class: 'wizard-fields' }, number('channel.diameter', tr('Diameter (mm)'), 0.5), number('channel.distance', tr('Distance from the wing (mm)'), 1)),
            ),
            holes('pins', tr('Alignment pin holes'), [number('pins.depth', tr('Depth in each half (mm)'), 1)]),
            holes('screws', tr('Clamping screw holes'), []),
            h(
              'fieldset',
              {},
              h('legend', {}, tr('File')),
              h(
                'div',
                { class: 'wizard-fields' },
                choice('halves', tr('Halves'), [
                  ['both', tr('Lower and upper')],
                  ['lower', tr('Lower only')],
                  ['upper', tr('Upper only')],
                ]),
              ),
              check('left', tr('Molds of the left wing (mirror image)')),
            ),
          ),
          h('div', { class: 'wizard-right' }, h('div', { class: 'canvas-wrap' }, canvas), summary, notes),
        ),
        h(
          'p',
          { class: 'small muted' },
          tr('The halves part on one surface over the whole block: at every span station the chord line through leading edge and trailing edge, extended to the front and the back face, so that the parting surface twists with the wing. z = 0 in the file is the mean height of leading edge and trailing edge. The cavity is open at the root face of the block. The resin channel is half-round in each half; pin holes are blind, screw holes go through. The axes follow the last export (Export > Fusion 360 fix).'),
        ),
      ];

  const dialog = h(
    'dialog',
    { class: 'modal wide mold' },
    // Enter in a field commits it (change) and does not close the dialog.
    h(
      'form',
      { method: 'dialog', onsubmit: (e) => e.preventDefault() },
      h('h2', {}, tr('Mold')),
      h('p', { class: 'small muted' }, tr('Builds a lower and an upper mold half of the right half wing as STEP solids, with a resin channel around the wing and holes for alignment pins and clamping screws.')),
      ...body,
      h('div', { class: 'row end' }, h('button', { type: 'button', onclick: () => dialog.close() }, tr('Close')), ...(blocked ? [] : [saveBtn])),
    ),
  );
  document.body.append(dialog);
  dialog.addEventListener('close', () => {
    cancelAnimationFrame(frame);
    pz.destroy();
    dialog.remove();
  });
  dialog.showModal();
  if (!blocked) update();
  return dialog;
}

export { MOLD_DEFAULTS };
