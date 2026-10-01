// Foam-cutting wizard: splits the half wing into cores for a hot-wire cutter (src/geom/foam.js) and
// writes their end profiles and 1:1 templates (src/export/foam.js). The cuts live in the dialog only;
// the settings (longest core, deviation limit, kerf, paper) are kept in browser storage.

import { FOAM_LIMITS, foamSegments, normalizeCuts, proposeCuts, splitOverTolerance } from '../geom/foam.js';
import { FRAME, PAPERS, layoutDxf, layoutPdf, layoutSvg, pagePlan, profileZip, templateLayout } from '../export/foam.js';
import { cloneProject } from '../model/project.js';
import { drawPlanform } from './wizard.js';
import { PanZoomCanvas, cssVar } from './panzoom.js';
import { clear, download, h, numberField, showNumber, slugFile } from './dom.js';
import { fixed, readNumber, tr } from '../i18n/index.js';

/** Browser storage key of the wizard settings. */
export const FOAM_SETTINGS_KEY = 'wingdesigner.foam';
export const FOAM_DEFAULTS = Object.freeze({ coreLength: 800, tolerance: 0.2, kerf: 0, paper: 'a4' });

const within = (v, [lo, hi]) => Number.isFinite(v) && v >= lo && v <= hi;

/** Stored settings, each one checked against its range; defaults for the rest. */
export function storedFoamSettings() {
  let s;
  try {
    s = JSON.parse(localStorage.getItem(FOAM_SETTINGS_KEY) ?? '{}') ?? {};
  } catch {
    s = {};
  }
  return {
    coreLength: within(s.coreLength, FOAM_LIMITS.coreLength) ? s.coreLength : FOAM_DEFAULTS.coreLength,
    tolerance: within(s.tolerance, FOAM_LIMITS.tolerance) ? s.tolerance : FOAM_DEFAULTS.tolerance,
    kerf: within(s.kerf, FOAM_LIMITS.kerf) ? s.kerf : FOAM_DEFAULTS.kerf,
    paper: Object.hasOwn(PAPERS, s.paper) ? s.paper : FOAM_DEFAULTS.paper,
  };
}

function storeSettings(s) {
  try {
    localStorage.setItem(FOAM_SETTINGS_KEY, JSON.stringify(s));
  } catch {
    // Without storage the wizard starts with the defaults next time.
  }
}

const wedgeCell = (w) => (w ? tr('{angle}°, {depth} mm, {side}', { angle: fixed(w.angle, 1), depth: fixed(w.depth, 1), side: w.side === 'upper' ? tr('upper') : tr('lower') }) : '–');

/** Opens the foam-cutting wizard for the current build. */
export function foamDialog(store, getBuild, notify = () => {}) {
  const project = cloneProject(store.project);
  const build = getBuild();
  const name = project.name || 'wing';
  const blocked = !build?.surface;
  const settings = storedFoamSettings();
  let cuts = blocked ? [] : proposeCuts(build, settings.coreLength);
  let segments = [];
  let dropped = 0;
  let capped = 0;

  const summary = h('p', { class: 'small', 'aria-live': 'polite' });
  const cutsBox = h('div', { class: 'foam-cuts' });
  const table = h('div', { class: 'table-scroll' });
  const canvas = h('canvas', { class: 'wizard-canvas', role: 'img', 'aria-label': tr('Planform with the cuts') });
  const downloads = h('div', { class: 'row wrap' });

  const field = (key, label, step, range) => {
    const input = numberField({ value: settings[key], step, min: range[0], max: range[1] });
    input.addEventListener('change', () => {
      const v = readNumber(input.value);
      if (!within(v, range)) {
        showNumber(input, settings[key]);
        return;
      }
      settings[key] = v;
      showNumber(input, v);
      storeSettings(settings);
      // A new longest core proposes the cuts again.
      if (key === 'coreLength' && !blocked) cuts = proposeCuts(build, v);
      update();
    });
    return h('label', { class: 'field' }, label, input);
  };
  const paper = h(
    'select',
    {
      onchange: (e) => {
        settings.paper = e.target.value;
        storeSettings(settings);
        update();
      },
    },
    h('option', { value: 'a4', selected: settings.paper === 'a4' }, 'A4'),
    h('option', { value: 'a3', selected: settings.paper === 'a3' }, 'A3'),
    h('option', { value: 'letter', selected: settings.paper === 'letter' }, tr('Letter')),
  );

  const renderCuts = () => {
    const rows = cuts.map((y, i) => {
      const input = numberField({ value: Number(y.toFixed(3)), step: 1, min: build.rootY, max: build.tipY });
      input.setAttribute('aria-label', tr('Cut {i}, y in mm', { i: i + 1 }));
      input.addEventListener('change', () => {
        const v = readNumber(input.value);
        if (!Number.isFinite(v)) {
          showNumber(input, cuts[i]);
          return;
        }
        cuts[i] = v;
        update();
      });
      const remove = h(
        'button',
        {
          type: 'button',
          title: tr('Remove the cut at y = {y} mm', { y: fixed(y, 1) }),
          'aria-label': tr('Remove the cut at y = {y} mm', { y: fixed(y, 1) }),
          onclick: () => {
            cuts.splice(i, 1);
            update();
          },
        },
        '×',
      );
      return h('div', { class: 'row' }, h('span', { class: 'small muted' }, `${i + 1}`), input, remove);
    });
    clear(cutsBox).append(...(rows.length ? rows : [h('p', { class: 'small muted' }, tr('No cuts: one core from root to tip.'))]));
  };

  const renderTable = () => {
    const head = [tr('Segment'), tr('y (mm)'), tr('Core length (mm)'), tr('Block (mm)'), tr('Chords (mm)'), tr('Deviation (mm)'), tr('Wedge inboard'), tr('Wedge outboard')];
    const rows = segments.map((s) => {
      const longCore = s.length > settings.coreLength;
      const overDev = s.deviation.max > settings.tolerance;
      return h(
        'tr',
        {},
        h('td', {}, String(s.index + 1)),
        h('td', {}, `${fixed(s.ya, 1)} – ${fixed(s.yb, 1)}`),
        h('td', { class: longCore ? 'sev-warning' : '' }, fixed(s.length, 1)),
        h('td', {}, `${fixed(s.width + 2 * FRAME, 0)} × ${fixed(s.height + 2 * FRAME, 0)}`),
        h('td', {}, `${fixed(s.ends[0].chord, 1)} / ${fixed(s.ends[1].chord, 1)}`),
        h('td', { class: overDev ? 'sev-warning' : '' }, fixed(s.deviation.max, 3)),
        h('td', {}, wedgeCell(s.ends[0].wedge)),
        h('td', {}, wedgeCell(s.ends[1].wedge)),
      );
    });
    clear(table).append(h('table', { class: 'grid-table foam-segments' }, h('thead', {}, h('tr', {}, head.map((t) => h('th', {}, t)))), h('tbody', {}, rows)));
  };

  const renderSummary = () => {
    const parts = [];
    const long = segments.filter((s) => s.length > settings.coreLength).length;
    const over = segments.filter((s) => s.deviation.max > settings.tolerance).length;
    const worst = Math.max(...segments.map((s) => s.deviation.max));
    const dev = fixed(worst, 3);
    parts.push(segments.length === 1 ? tr('1 segment per half, deviation {dev} mm.', { dev }) : tr('{n} segments per half, largest deviation {dev} mm.', { n: segments.length, dev }));
    const length = fixed(settings.coreLength, 0);
    if (long) parts.push(long === 1 ? tr('1 core is longer than {length} mm.', { length }) : tr('{n} cores are longer than {length} mm.', { n: long, length }));
    const tolerance = fixed(settings.tolerance, 2);
    if (over) {
      parts.push(
        over === 1
          ? tr('1 segment deviates more than {tolerance} mm from the wing; Split segments over the limit adds cuts.', { tolerance })
          : tr('{n} segments deviate more than {tolerance} mm from the wing; Split segments over the limit adds cuts.', { n: over, tolerance }),
      );
    }
    const min = FOAM_LIMITS.minSegment;
    if (dropped) parts.push(dropped === 1 ? tr('1 cut was removed: closer than {min} mm to another cut, the root or the tip.', { min }) : tr('{n} cuts were removed: closer than {min} mm to another cut, the root or the tip.', { n: dropped, min }));
    const max = FOAM_LIMITS.maxSegments;
    if (capped) parts.push(capped === 1 ? tr('1 cut was removed: at most {max} segments per half.', { max }) : tr('{n} cuts were removed: at most {max} segments per half.', { n: capped, max }));
    const pages = pagePlan(templateLayout(name, segments, { kerf: settings.kerf }), settings.paper, { pieces: false }).pages;
    parts.push(pages === 1 ? tr('The PDF templates take 1 page.') : tr('The PDF templates take {pages} pages.', { pages }));
    summary.className = `small${long || over ? ' sev-warning' : ''}`;
    summary.textContent = parts.join(' ');
  };

  let frame = 0;
  // Edits recompute in the next animation frame; a download first applies a pending one (flush), so
  // the files hold the cuts the fields show.
  let pending = false;
  const apply = () => {
    pending = false;
    const n = normalizeCuts(build, cuts);
    dropped = n.dropped - n.capped;
    capped = n.capped;
    cuts = n.cuts;
    segments = foamSegments(build, cuts);
    renderCuts();
    renderTable();
    renderSummary();
    pz.redraw();
  };
  const update = () => {
    cancelAnimationFrame(frame);
    pending = true;
    frame = requestAnimationFrame(apply);
  };
  const flush = () => {
    if (!pending) return;
    cancelAnimationFrame(frame);
    apply();
  };

  const pz = new PanZoomCanvas(canvas, {
    bounds: () => {
      if (blocked) return null;
      // A loop, not Math.max(...xs): a loft can hold more stations than a call takes arguments.
      let lo = 0;
      let hi = -Infinity;
      for (const q of build.stations) {
        lo = Math.min(lo, q.xLE);
        hi = Math.max(hi, q.xLE + q.chord);
      }
      return [-build.tipY, -hi, build.tipY, -lo];
    },
    draw: (ctx, view, w, hgt) => {
      drawPlanform(ctx, view, w, hgt, build?.stations);
      if (blocked) return;
      ctx.strokeStyle = cssVar('--accent', '#2f6fdf');
      ctx.lineWidth = 1.5;
      for (const y of [build.rootY, ...cuts, build.tipY]) {
        const { xLE, chord } = build.planformAt(y);
        for (const sign of [1, -1]) {
          const [x0, y0] = view.toScreen(sign * y, -xLE);
          const [x1, y1] = view.toScreen(sign * y, -(xLE + chord));
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(x1, y1);
          ctx.stroke();
        }
      }
    },
  });

  // File names: the project name by the export rule (slugFile), then the suffix.
  const file = (suffix, ext) => `${slugFile(name, ext).slice(0, -ext.length - 1)}_${suffix}.${ext}`;
  const save = (what) => {
    try {
      flush();
      if (what === 'zip') download(file('foam_profiles', 'zip'), profileZip(name, segments), 'application/zip');
      else {
        const layout = templateLayout(name, segments, { kerf: settings.kerf });
        if (what === 'svg') download(file('foam_templates', 'svg'), layoutSvg(layout), 'image/svg+xml');
        else if (what === 'dxf') download(file('foam_templates', 'dxf'), layoutDxf(layout), 'application/dxf');
        else download(file('foam_templates', 'pdf'), layoutPdf(layout, settings.paper, { title: tr('{name}: foam-core templates', { name }) }), 'application/pdf');
      }
    } catch (e) {
      notify(tr('Export failed: {message}.', { message: e.message }), true);
    }
  };
  downloads.append(
    h('button', { type: 'button', onclick: () => save('zip') }, tr('Profiles (.dat, ZIP)')),
    h('button', { type: 'button', onclick: () => save('svg') }, tr('Templates (SVG)')),
    h('button', { type: 'button', onclick: () => save('pdf') }, tr('Templates (PDF)')),
    h('button', { type: 'button', onclick: () => save('dxf') }, tr('Templates (DXF)')),
  );

  const body = blocked
    ? [h('p', { class: 'sev-error' }, tr('The wing has errors; fix them before planning foam cores.'))]
    : [
        h(
          'div',
          { class: 'wizard-body' },
          h(
            'div',
            { class: 'wizard-left' },
            h(
              'div',
              { class: 'wizard-fields' },
              field('coreLength', tr('Longest core (mm)'), 10, FOAM_LIMITS.coreLength),
              field('tolerance', tr('Deviation limit (mm)'), 0.05, FOAM_LIMITS.tolerance),
              field('kerf', tr('Kerf for templates (mm)'), 0.1, FOAM_LIMITS.kerf),
              h('label', { class: 'field' }, tr('Paper (PDF)'), paper),
            ),
            h(
              'fieldset',
              {},
              h('legend', {}, tr('Cuts (y in mm)')),
              cutsBox,
              h(
                'div',
                { class: 'row wrap' },
                h(
                  'button',
                  {
                    type: 'button',
                    onclick: () => {
                      // A cut in the middle of the longest segment.
                      const s = segments.reduce((a, b) => (b.yb - b.ya > a.yb - a.ya ? b : a), segments[0]);
                      cuts.push((s.ya + s.yb) / 2);
                      update();
                    },
                  },
                  tr('Add cut'),
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    onclick: () => {
                      cuts = proposeCuts(build, settings.coreLength);
                      update();
                    },
                  },
                  tr('Propose cuts again'),
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    onclick: () => {
                      cuts = splitOverTolerance(build, cuts, settings.tolerance).cuts;
                      update();
                    },
                  },
                  tr('Split segments over the limit'),
                ),
              ),
            ),
          ),
          h('div', { class: 'wizard-right' }, h('div', { class: 'canvas-wrap' }, canvas), summary),
        ),
        table,
        h('p', { class: 'small muted' }, tr('Each core is cut square to its segment with a straight wire between its two end profiles. At a joint, the root or the tip, the end face is sanded to the joint plane: the wedge columns give its angle, its depth along the core and the surface where it is deepest. The files describe the right half; the left half is its mirror image.')),
        h('fieldset', {}, h('legend', {}, tr('Download')), downloads, h('p', { class: 'small muted' }, tr('The kerf offset applies to the templates (SVG, PDF, DXF) only; .dat profiles have none, the cutting program adds it.'))),
      ];

  const dialog = h(
    'dialog',
    { class: 'modal wide foam' },
    // Enter in a field commits it (change) and does not close the dialog.
    h('form', { method: 'dialog', onsubmit: (e) => e.preventDefault() }, h('h2', {}, tr('Foam cutting')), h('p', { class: 'small muted' }, tr('Splits the half wing into foam cores for a hot-wire cutter and writes their end profiles and 1:1 templates.')), ...body, h('div', { class: 'row end' }, h('button', { type: 'button', class: 'primary', onclick: () => dialog.close() }, tr('Close')))),
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
