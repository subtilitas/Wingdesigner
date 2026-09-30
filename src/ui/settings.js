// Settings form: language, spanwise interpolation, twist pivot, trailing edge, resolution, display.

import { LIMITS } from '../model/project.js';
import { WARN, costPhrase, loftGrid, projectSize } from '../model/budget.js';
import { rolledPanelCount } from '../geom/planes.js';
import { LANGUAGES, count, language, plain, tr } from '../i18n/index.js';
import { clear, h, numberInput } from './dom.js';

/** Label of the language list: the same in both languages, so it can be found in either. */
const LANGUAGE_LABEL = 'Language / Sprache';

/** Loft grid points of the current settings; above the warning threshold with time and memory. */
function gridNote(project) {
  const g = project.guides ?? {};
  const grid = loftGrid(project.sections.length, project.settings, g.nose?.enabled || g.end?.enabled, rolledPanelCount(project.sections, project.settings));
  const over = grid.points > WARN.gridPoints;
  const reduced = grid.K < grid.Kset;
  const points = count(grid.points);
  const [K, Kset] = [plain(grid.K), plain(grid.Kset)];
  const [limit, cost] = over ? [count(WARN.gridPoints), costPhrase(projectSize(project))] : [];
  let text;
  if (reduced && over) text = tr('Loft grid: {points} points, {K} spanwise stations per panel instead of {Kset}; above {limit}, {cost}.', { points, K, Kset, limit, cost });
  else if (reduced) text = tr('Loft grid: {points} points, {K} spanwise stations per panel instead of {Kset}.', { points, K, Kset });
  else if (over) text = tr('Loft grid: {points} points; above {limit}, {cost}.', { points, limit, cost });
  else text = tr('Loft grid: {points} points.', { points });
  return h('p', { class: `small ${over ? 'sev-warning' : 'muted'}` }, text);
}

export class SettingsPanel {
  constructor(root, store, viewer, { onLanguage } = {}) {
    this.root = root;
    this.store = store;
    this.viewer = viewer;
    // onLanguage(code): the choice of the language list.
    this.onLanguage = onLanguage;
    this.render();
  }

  update() {
    this.render();
  }

  render() {
    const s = this.store.project.settings;
    const set = (fn) => this.store.update((p) => fn(p.settings));
    // The key (not the label, which follows the language) names the list across re-renders, so
    // keyboard focus stays on it.
    const select = (value, options, onChange, label, key) =>
      h(
        'select',
        { 'aria-label': label, onchange: (e) => onChange(e.target.value), dataset: { focusKey: `set:${key}` } },
        options.map(([v, t]) => h('option', { value: v, selected: v === value }, t)),
      );
    clear(this.root).append(
      h(
        'fieldset',
        { class: 'language' },
        h('legend', {}, LANGUAGE_LABEL),
        select(language(), Object.entries(LANGUAGES), (code) => this.onLanguage?.(code), LANGUAGE_LABEL, 'language'),
      ),
      h(
        'fieldset',
        {},
        h('legend', {}, tr('Geometry')),
        h('label', { class: 'field' }, tr('Project name'), h('input', { type: 'text', value: this.store.project.name, maxLength: LIMITS.maxName, dataset: { focusKey: 'set:name' }, onchange: (e) => this.store.update((p) => (p.name = e.target.value), { reason: 'meta' }) })),
        h(
          'label',
          { class: 'field' },
          tr('Spanwise interpolation'),
          select(
            s.spanwise,
            [
              ['linear', tr('Linear between sections')],
              ['straight', tr('Straight panels (straight lines between sections, as XFLR5)')],
              ['smooth', tr('Smooth (natural cubic spline through sections)')],
            ],
            (v) => set((q) => (q.spanwise = v)),
            tr('Spanwise interpolation'),
            'spanwise',
          ),
        ),
        h(
          'label',
          { class: 'field' },
          tr('Section planes'),
          select(
            s.sectionPlanes,
            [
              ['mitred', tr('Mitred (square to the panels, as XFLR5)')],
              ['vertical', tr('Vertical (y = const)')],
            ],
            (v) => set((q) => (q.sectionPlanes = v)),
            tr('Section planes'),
            'section-planes',
          ),
        ),
        h(
          'label',
          { class: 'field' },
          tr('Twist pivot (fraction of chord)'),
          numberInput({ focusKey: 'set:pivot', value: s.twistPivot, step: 0.05, min: 0, max: 1, onCommit: (v) => set((q) => (q.twistPivot = Math.min(Math.max(v, 0), 1))) }),
        ),
        h(
          'label',
          { class: 'field' },
          tr('Trailing edge'),
          select(
            s.trailingEdge.mode,
            [
              ['asis', tr('As in the airfoil files')],
              ['closed', tr('Closed (sharp)')],
              ['thickness', tr('Fixed thickness in mm')],
            ],
            (v) => set((q) => (q.trailingEdge = { ...q.trailingEdge, mode: v })),
            tr('Trailing edge mode'),
            'trailingEdge',
          ),
        ),
        h(
          'label',
          { class: 'field' },
          tr('Wing tip'),
          select(
            s.tip.mode,
            [
              ['flat', tr('Flat (cut at the tip section)')],
              ['pointed', tr('Pointed (tip profile scaled down)')],
            ],
            (v) => set((q) => (q.tip = { ...q.tip, mode: v })),
            tr('Wing tip'),
            'tipMode',
          ),
        ),
        s.tip.mode === 'pointed'
          ? h(
              'label',
              { class: 'field' },
              tr('Tip profile scale 1 : N of the previous section chord (N = {min} to {max}; tip chord at least {chord} mm)', {
                min: plain(Math.round(1 / LIMITS.tipRatio[1])),
                max: plain(Math.round(1 / LIMITS.tipRatio[0])),
                chord: plain(LIMITS.minChord),
              }),
              numberInput({
                focusKey: 'set:tip',
                value: Math.round(1 / s.tip.ratio),
                step: 50,
                min: Math.round(1 / LIMITS.tipRatio[1]),
                max: Math.round(1 / LIMITS.tipRatio[0]),
                title: tr('Tip profile scale denominator'),
                onCommit: (v) => {
                  const nDen = Math.min(Math.max(Math.round(v), 1 / LIMITS.tipRatio[1]), 1 / LIMITS.tipRatio[0]);
                  set((q) => (q.tip = { ...q.tip, ratio: 1 / nDen }));
                },
              }),
            )
          : null,
        s.trailingEdge.mode === 'thickness'
          ? h(
              'label',
              { class: 'field' },
              tr('Trailing-edge thickness (mm)'),
              numberInput({ focusKey: 'set:te', value: s.trailingEdge.thickness, step: 0.1, min: 0, onCommit: (v) => set((q) => (q.trailingEdge = { ...q.trailingEdge, thickness: Math.max(0, v) })) }),
            )
          : null,
      ),
      h(
        'fieldset',
        {},
        h('legend', {}, tr('Resolution')),
        h(
          'label',
          { class: 'field' },
          tr('Chordwise stations per surface ({min}-{max})', { min: plain(LIMITS.chordSamples[0]), max: plain(LIMITS.chordSamples[1]) }),
          numberInput({
            focusKey: 'set:chord',
            value: s.chordSamples,
            step: 4,
            min: LIMITS.chordSamples[0],
            max: LIMITS.chordSamples[1],
            onCommit: (v) => set((q) => (q.chordSamples = Math.round(Math.min(Math.max(v, LIMITS.chordSamples[0]), LIMITS.chordSamples[1])))),
          }),
        ),
        h(
          'label',
          { class: 'field' },
          tr('Spanwise stations per panel with guides or smooth mode ({min}-{max})', { min: plain(LIMITS.panelStations[0]), max: plain(LIMITS.panelStations[1]) }),
          numberInput({
            focusKey: 'set:panel',
            value: s.panelStations,
            step: 1,
            min: LIMITS.panelStations[0],
            max: LIMITS.panelStations[1],
            onCommit: (v) => set((q) => (q.panelStations = Math.round(Math.min(Math.max(v, LIMITS.panelStations[0]), LIMITS.panelStations[1])))),
          }),
        ),
        gridNote(this.store.project),
        h(
          'label',
          { class: 'field' },
          tr('Profile parametrization'),
          select(
            s.parametrization,
            [
              ['centripetal', tr('Centripetal (recommended)')],
              ['chord', tr('Chord length')],
              ['uniform', tr('Uniform')],
            ],
            (v) => set((q) => (q.parametrization = v)),
            tr('Profile parametrization'),
            'parametrization',
          ),
        ),
      ),
      h(
        'fieldset',
        {},
        h('legend', {}, tr('Display')),
        h(
          'label',
          { class: 'check' },
          h('input', {
            type: 'checkbox',
            checked: s.mirror,
            dataset: { focusKey: 'set:mirror' },
            // Display only: the wing is drawn again from the current build.
            onchange: (e) => this.store.update((p) => (p.settings.mirror = e.target.checked), { reason: 'display' }),
          }),
          tr('Show mirrored half (y < 0)'),
        ),
        h(
          'label',
          { class: 'check' },
          h('input', { type: 'checkbox', checked: this.viewer.options.controlNet, dataset: { focusKey: 'set:controlNet' }, onchange: (e) => this.viewer.setOption('controlNet', e.target.checked) }),
          tr('Show NURBS control net'),
        ),
        h(
          'label',
          { class: 'check' },
          h('input', { type: 'checkbox', checked: this.viewer.options.sections, dataset: { focusKey: 'set:sections' }, onchange: (e) => this.viewer.setOption('sections', e.target.checked) }),
          tr('Show section outlines'),
        ),
      ),
    );
  }
}
