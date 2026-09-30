// New-design wizard dialog with live planform preview and key figures.

import { PRESETS, RANGES, wizardProblems, wizardProject } from '../model/wizard.js';
import { buildWing } from '../geom/wing.js';
import { LIMITS } from '../model/project.js';
import { wingStats } from '../geom/stats.js';
import { PanZoomCanvas, cssVar } from './panzoom.js';
import { clear, h, numberField, showNumber } from './dom.js';
import { fixed, readNumber, tr } from '../i18n/index.js';

// label and unit: functions, because the language can change between two openings of the wizard.
const FIELDS = [
  { key: 'span', label: () => tr('Span (both halves)'), unit: () => 'mm', step: 10 },
  { key: 'rootChord', label: () => tr('Root chord'), unit: () => 'mm', step: 5 },
  { key: 'taper', label: () => tr('Taper (tip / root chord)'), unit: () => '', step: 0.05 },
  { key: 'sweep', label: () => tr('Sweep of the 25 % line'), unit: () => tr('deg'), step: 1 },
  { key: 'dihedral', label: () => tr('Dihedral per half'), unit: () => tr('deg'), step: 0.5 },
  { key: 'washout', label: () => tr('Tip twist (negative = washout)'), unit: () => tr('deg'), step: 0.5 },
  { key: 'sections', label: () => tr('Number of sections'), unit: () => '', step: 1 },
];

/**
 * Draw the grid and the planform of both halves (leading and trailing edge of `stations`: { y, xLE,
 * chord }) on a PanZoomCanvas; the wizard and the XFLR5 import preview use it.
 */
export function drawPlanform(ctx, view, w, hgt, stations) {
  view.drawGrid(ctx, w, hgt, cssVar('--grid', '#dde3ea'), cssVar('--axis', '#9aa6b2'));
  if (!stations?.length) return;
  const le = stations.map((s) => [s.y, s.xLE]);
  const te = stations.map((s) => [s.y, s.xLE + s.chord]);
  for (const sign of [1, -1]) {
    ctx.beginPath();
    [...le, ...[...te].reverse()].forEach(([y, x], i) => {
      const [sx, sy] = view.toScreen(sign * y, -x);
      if (i) ctx.lineTo(sx, sy);
      else ctx.moveTo(sx, sy);
    });
    ctx.closePath();
    ctx.fillStyle = cssVar('--wing-fill', 'rgba(47,111,223,0.12)');
    ctx.fill();
    ctx.strokeStyle = cssVar('--ink', '#1d2430');
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

/** Opens the wizard. Resolves with a new project, or null when cancelled. */
export function openWizard({ firstRun = false } = {}) {
  return new Promise((resolve) => {
    let preset = 'sport';
    let params = { ...PRESETS[preset].params };
    const nameInput = h('input', { type: 'text', value: PRESETS[preset].label, 'aria-label': tr('Project name'), maxLength: LIMITS.maxName });
    const inputs = {};
    const presetBox = h('div', { class: 'preset-grid', role: 'radiogroup', 'aria-label': tr('Design type') });
    const fieldsBox = h('div', { class: 'wizard-fields' });
    const summary = h('p', { class: 'small', 'aria-live': 'polite' });
    const canvas = h('canvas', { class: 'wizard-canvas', role: 'img', 'aria-label': tr('Planform preview') });
    const createBtn = h('button', { value: 'create', class: 'primary' }, tr('Create design'));

    const renderPresets = () => {
      clear(presetBox).append(
        ...Object.entries(PRESETS).map(([key, p]) =>
          h(
            'button',
            {
              type: 'button',
              role: 'radio',
              'aria-checked': String(key === preset),
              class: `preset${key === preset ? ' active' : ''}`,
              onclick: () => {
                preset = key;
                params = { ...p.params };
                nameInput.value = p.label;
                renderPresets();
                renderFields();
                refresh();
              },
            },
            h('strong', {}, p.label),
            h('span', { class: 'small muted' }, p.description),
          ),
        ),
      );
    };

    const renderFields = () => {
      const rows = FIELDS.map((f) => {
        const [lo, hi] = RANGES[f.key];
        // Checked while typing: a text that is no number (NaN) is out of range and disables Create.
        // The arrow keys step such a text from the preset's value.
        const fallback = () => (Number.isFinite(params[f.key]) ? params[f.key] : PRESETS[preset].params[f.key]);
        const input = numberField({ value: params[f.key], step: f.step, min: lo, max: hi, fallback });
        input.addEventListener('input', () => {
          params[f.key] = readNumber(input.value);
          refresh();
        });
        // Leaving the field shows the number as read, e.g. 1500 for a German 1.500.
        input.addEventListener('change', () => {
          if (Number.isFinite(params[f.key])) showNumber(input, params[f.key]);
        });
        inputs[f.key] = input;
        const unit = f.unit();
        return h('label', { class: 'field' }, `${f.label()}${unit ? ` (${unit})` : ''}`, input);
      });
      const planform = h(
        'select',
        {
          onchange: (e) => {
            params.planform = e.target.value;
            refresh();
          },
        },
        h('option', { value: 'straight', selected: params.planform === 'straight' }, tr('Straight taper')),
        h('option', { value: 'elliptic', selected: params.planform === 'elliptic' }, tr('Elliptic (guide curves)')),
      );
      const airfoil = (key, label) =>
        h(
          'label',
          { class: 'field' },
          label,
          h('input', {
            type: 'text',
            value: params[key],
            placeholder: tr('NACA code, e.g. 2412'),
            oninput: (e) => {
              params[key] = e.target.value.trim();
              refresh();
            },
          }),
        );
      const tip = h(
        'select',
        {
          onchange: (e) => {
            params.tip = e.target.value;
            refresh();
          },
        },
        h('option', { value: 'flat', selected: params.tip !== 'pointed' }, tr('Flat')),
        h('option', { value: 'pointed', selected: params.tip === 'pointed' }, tr('Pointed (1/200 scale)')),
      );
      clear(fieldsBox).append(
        ...rows,
        h('label', { class: 'field' }, tr('Planform'), planform),
        h('label', { class: 'field' }, tr('Tip'), tip),
        airfoil('rootAirfoil', tr('Root airfoil (NACA)')),
        airfoil('tipAirfoil', tr('Tip airfoil (NACA)')),
      );
    };

    let build = null;
    const refresh = () => {
      const problems = wizardProblems(params);
      build = null;
      if (!problems.length) {
        try {
          build = buildWing(wizardProject(params));
          if (build.errors.length) problems.push(...build.errors);
        } catch (e) {
          problems.push(e.message);
        }
      }
      createBtn.disabled = problems.length > 0;
      if (problems.length) {
        summary.className = 'small sev-error';
        summary.textContent = problems.join(' ');
      } else {
        const s = wingStats(build);
        summary.className = 'small';
        summary.textContent = tr('Area {area} dm², aspect ratio {ar}, mean aerodynamic chord {mac} mm at y = {y} mm, tip chord {tip} mm.', {
          area: fixed(s.area / 1e4, 1),
          ar: fixed(s.aspectRatio, 2),
          mac: fixed(s.mac, 1),
          y: fixed(s.macY, 0),
          tip: fixed(s.tipChord, 1),
        });
      }
      pz.fitted = false;
      pz.redraw();
    };

    const pz = new PanZoomCanvas(canvas, {
      bounds: () => {
        // A field that holds no number (NaN) counts as 0 here, so that the grid is still drawn.
        const b = Math.max((Number.isFinite(params.span) ? params.span : 0) / 2, 1);
        // The drawn outline: leading and trailing edges of the built stations (a taper above 1 widens
        // the tip beyond the root chord).
        if (build?.stations?.length) {
          const xs = build.stations.flatMap((q) => [q.xLE, q.xLE + q.chord]);
          return [-b, -Math.max(...xs), b, -Math.min(0, ...xs)];
        }
        const c = Math.max(Number.isFinite(params.rootChord) ? params.rootChord : 0, 1);
        const sw = Math.tan(((Number.isFinite(params.sweep) ? params.sweep : 0) * Math.PI) / 180) * b;
        return [-b, -(Math.max(c, sw + c)), b, -Math.min(0, sw)];
      },
      draw: (ctx, view, w, hgt) => drawPlanform(ctx, view, w, hgt, build?.stations),
    });

    const dialog = h(
      'dialog',
      { class: 'modal wide' },
      h(
        'form',
        { method: 'dialog' },
        h('h2', {}, firstRun ? tr('Start a new wing design') : tr('New wing design')),
        firstRun ? h('p', { class: 'small muted' }, tr('Pick a type, adjust the numbers, create. Everything stays editable afterwards; the wizard only sets up the sections and guide curves.')) : null,
        presetBox,
        h('div', { class: 'wizard-body' }, h('div', { class: 'wizard-left' }, h('label', { class: 'field' }, tr('Project name'), nameInput), fieldsBox), h('div', { class: 'wizard-right' }, h('div', { class: 'canvas-wrap' }, canvas), summary)),
        h('div', { class: 'row end' }, h('button', { type: 'button', onclick: () => dialog.close('cancel') }, firstRun ? tr('Skip (open sample wing)') : tr('Cancel')), createBtn),
      ),
    );
    document.body.append(dialog);
    renderPresets();
    renderFields();
    dialog.addEventListener('close', () => {
      pz.destroy();
      const ok = dialog.returnValue === 'create' && !wizardProblems(params).length;
      dialog.remove();
      resolve(ok ? wizardProject(params, nameInput.value.trim()) : null);
    });
    dialog.showModal();
    requestAnimationFrame(refresh);
  });
}
