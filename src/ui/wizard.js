// New-design wizard dialog with live planform preview and key figures.

import { PRESETS, RANGES, wizardProblems, wizardProject } from '../model/wizard.js';
import { buildWing } from '../geom/wing.js';
import { wingStats } from '../geom/stats.js';
import { PanZoomCanvas, cssVar } from './panzoom.js';
import { clear, h } from './dom.js';

const FIELDS = [
  { key: 'span', label: 'Span (both halves)', unit: 'mm', step: 10 },
  { key: 'rootChord', label: 'Root chord', unit: 'mm', step: 5 },
  { key: 'taper', label: 'Taper (tip / root chord)', unit: '', step: 0.05 },
  { key: 'sweep', label: 'Sweep of the 25 % line', unit: 'deg', step: 1 },
  { key: 'dihedral', label: 'Dihedral per half', unit: 'deg', step: 0.5 },
  { key: 'washout', label: 'Tip twist (negative = washout)', unit: 'deg', step: 0.5 },
  { key: 'sections', label: 'Number of sections', unit: '', step: 1 },
];

/** Opens the wizard. Resolves with a new project, or null when cancelled. */
export function openWizard({ firstRun = false } = {}) {
  return new Promise((resolve) => {
    let preset = 'sport';
    let params = { ...PRESETS[preset].params };
    const nameInput = h('input', { type: 'text', value: PRESETS[preset].label, 'aria-label': 'Project name' });
    const inputs = {};
    const presetBox = h('div', { class: 'preset-grid', role: 'radiogroup', 'aria-label': 'Design type' });
    const fieldsBox = h('div', { class: 'wizard-fields' });
    const summary = h('p', { class: 'small', 'aria-live': 'polite' });
    const canvas = h('canvas', { class: 'wizard-canvas', 'aria-label': 'Planform preview' });
    const createBtn = h('button', { value: 'create', class: 'primary' }, 'Create design');

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
        const input = h('input', {
          type: 'number',
          inputMode: 'decimal',
          step: String(f.step),
          min: String(lo),
          max: String(hi),
          value: String(params[f.key]),
          oninput: () => {
            params[f.key] = Number(input.value);
            refresh();
          },
        });
        inputs[f.key] = input;
        return h('label', { class: 'field' }, `${f.label}${f.unit ? ` (${f.unit})` : ''}`, input);
      });
      const planform = h(
        'select',
        {
          onchange: (e) => {
            params.planform = e.target.value;
            refresh();
          },
        },
        h('option', { value: 'straight', selected: params.planform === 'straight' }, 'Straight taper'),
        h('option', { value: 'elliptic', selected: params.planform === 'elliptic' }, 'Elliptic (guide curves)'),
      );
      const airfoil = (key, label) =>
        h(
          'label',
          { class: 'field' },
          label,
          h('input', {
            type: 'text',
            value: params[key],
            placeholder: 'NACA code, e.g. 2412',
            oninput: (e) => {
              params[key] = e.target.value.trim();
              refresh();
            },
          }),
        );
      clear(fieldsBox).append(
        ...rows,
        h('label', { class: 'field' }, 'Planform', planform),
        airfoil('rootAirfoil', 'Root airfoil (NACA)'),
        airfoil('tipAirfoil', 'Tip airfoil (NACA)'),
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
        summary.textContent =
          `Area ${(s.area / 1e4).toFixed(1)} dm², aspect ratio ${s.aspectRatio.toFixed(2)}, ` +
          `mean aerodynamic chord ${s.mac.toFixed(1)} mm at y = ${s.macY.toFixed(0)} mm, tip chord ${s.tipChord.toFixed(1)} mm.`;
      }
      pz.fitted = false;
      pz.redraw();
    };

    const pz = new PanZoomCanvas(canvas, {
      bounds: () => {
        const b = Math.max(params.span / 2, 1);
        const c = Math.max(params.rootChord, 1);
        const sw = Math.tan((params.sweep * Math.PI) / 180) * b;
        return [-b, -(Math.max(c, sw + c)), b, -Math.min(0, sw)];
      },
      draw: (ctx, view, w, hgt) => {
        view.drawGrid(ctx, w, hgt, cssVar('--grid', '#dde3ea'), cssVar('--axis', '#9aa6b2'));
        if (!build?.stations?.length) return;
        const le = build.stations.map((s) => [s.y, s.xLE]);
        const te = build.stations.map((s) => [s.y, s.xLE + s.chord]);
        for (const sign of [1, -1]) {
          ctx.beginPath();
          [...le, ...te.reverse()].forEach(([y, x], i) => {
            const [sx, sy] = view.toScreen(sign * y, -x);
            if (i) ctx.lineTo(sx, sy);
            else ctx.moveTo(sx, sy);
          });
          te.reverse();
          ctx.closePath();
          ctx.fillStyle = cssVar('--wing-fill', 'rgba(47,111,223,0.12)');
          ctx.fill();
          ctx.strokeStyle = cssVar('--ink', '#1d2430');
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      },
    });

    const dialog = h(
      'dialog',
      { class: 'modal wide' },
      h(
        'form',
        { method: 'dialog' },
        h('h2', {}, firstRun ? 'Start a new wing design' : 'New wing design'),
        firstRun ? h('p', { class: 'small muted' }, 'Pick a type, adjust the numbers, create. Everything stays editable afterwards; the wizard only sets up the sections and guide curves.') : null,
        presetBox,
        h('div', { class: 'wizard-body' }, h('div', { class: 'wizard-left' }, h('label', { class: 'field' }, 'Project name', nameInput), fieldsBox), h('div', { class: 'wizard-right' }, h('div', { class: 'canvas-wrap' }, canvas), summary)),
        h('div', { class: 'row end' }, h('button', { value: 'cancel' }, firstRun ? 'Skip (open sample wing)' : 'Cancel'), createBtn),
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
