// Settings form: spanwise interpolation, twist pivot, trailing edge, resolution, display.

import { LIMITS } from '../model/project.js';
import { clear, h, numberInput } from './dom.js';

export class SettingsPanel {
  constructor(root, store, viewer) {
    this.root = root;
    this.store = store;
    this.viewer = viewer;
    this.render();
  }

  update() {
    this.render();
  }

  render() {
    const s = this.store.project.settings;
    const set = (fn) => this.store.update((p) => fn(p.settings));
    const select = (value, options, onChange, label) =>
      h(
        'select',
        { 'aria-label': label, onchange: (e) => onChange(e.target.value) },
        options.map(([v, t]) => h('option', { value: v, selected: v === value }, t)),
      );
    clear(this.root).append(
      h(
        'fieldset',
        {},
        h('legend', {}, 'Geometry'),
        h('label', { class: 'field' }, 'Project name', h('input', { type: 'text', value: this.store.project.name, maxLength: LIMITS.maxName, onchange: (e) => this.store.update((p) => (p.name = e.target.value)) })),
        h(
          'label',
          { class: 'field' },
          'Spanwise interpolation',
          select(
            s.spanwise,
            [
              ['linear', 'Linear between sections (straight panels)'],
              ['smooth', 'Smooth (natural cubic spline through sections)'],
            ],
            (v) => set((q) => (q.spanwise = v)),
            'Spanwise interpolation',
          ),
        ),
        h(
          'label',
          { class: 'field' },
          'Twist pivot (fraction of chord)',
          numberInput({ focusKey: 'set:pivot', value: s.twistPivot, step: 0.05, min: 0, max: 1, onCommit: (v) => set((q) => (q.twistPivot = Math.min(Math.max(v, 0), 1))) }),
        ),
        h(
          'label',
          { class: 'field' },
          'Trailing edge',
          select(
            s.trailingEdge.mode,
            [
              ['asis', 'As in the airfoil files'],
              ['closed', 'Closed (sharp)'],
              ['thickness', 'Fixed thickness in mm'],
            ],
            (v) => set((q) => (q.trailingEdge = { ...q.trailingEdge, mode: v })),
            'Trailing edge mode',
          ),
        ),
        h(
          'label',
          { class: 'field' },
          'Wing tip',
          select(
            s.tip.mode,
            [
              ['flat', 'Flat (cut at the tip section)'],
              ['pointed', 'Pointed (tip profile scaled down)'],
            ],
            (v) => set((q) => (q.tip = { ...q.tip, mode: v })),
            'Wing tip',
          ),
        ),
        s.tip.mode === 'pointed'
          ? h(
              'label',
              { class: 'field' },
              `Tip profile scale 1 : N of the previous section chord (N = ${Math.round(1 / LIMITS.tipRatio[1])} to ${Math.round(1 / LIMITS.tipRatio[0])}; tip chord at least ${LIMITS.minChord} mm)`,
              numberInput({
                focusKey: 'set:tip',
                value: Math.round(1 / s.tip.ratio),
                step: 50,
                min: Math.round(1 / LIMITS.tipRatio[1]),
                max: Math.round(1 / LIMITS.tipRatio[0]),
                title: 'Tip profile scale denominator',
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
              'Trailing-edge thickness (mm)',
              numberInput({ focusKey: 'set:te', value: s.trailingEdge.thickness, step: 0.1, min: 0, onCommit: (v) => set((q) => (q.trailingEdge = { ...q.trailingEdge, thickness: Math.max(0, v) })) }),
            )
          : null,
      ),
      h(
        'fieldset',
        {},
        h('legend', {}, 'Resolution'),
        h(
          'label',
          { class: 'field' },
          `Chordwise stations per surface (${LIMITS.chordSamples.join('-')})`,
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
          `Spanwise stations per panel with guides or smooth mode (${LIMITS.panelStations.join('-')})`,
          numberInput({
            focusKey: 'set:panel',
            value: s.panelStations,
            step: 1,
            min: LIMITS.panelStations[0],
            max: LIMITS.panelStations[1],
            onCommit: (v) => set((q) => (q.panelStations = Math.round(Math.min(Math.max(v, LIMITS.panelStations[0]), LIMITS.panelStations[1])))),
          }),
        ),
        h(
          'label',
          { class: 'field' },
          'Profile parametrization',
          select(
            s.parametrization,
            [
              ['centripetal', 'Centripetal (recommended)'],
              ['chord', 'Chord length'],
              ['uniform', 'Uniform'],
            ],
            (v) => set((q) => (q.parametrization = v)),
            'Profile parametrization',
          ),
        ),
      ),
      h(
        'fieldset',
        {},
        h('legend', {}, 'Display'),
        h(
          'label',
          { class: 'check' },
          h('input', { type: 'checkbox', checked: s.mirror, onchange: (e) => set((q) => (q.mirror = e.target.checked)) }),
          'Show mirrored half (y < 0)',
        ),
        h(
          'label',
          { class: 'check' },
          h('input', { type: 'checkbox', checked: this.viewer.options.controlNet, onchange: (e) => this.viewer.setOption('controlNet', e.target.checked) }),
          'Show NURBS control net',
        ),
        h(
          'label',
          { class: 'check' },
          h('input', { type: 'checkbox', checked: this.viewer.options.sections, onchange: (e) => this.viewer.setOption('sections', e.target.checked) }),
          'Show section outlines',
        ),
      ),
    );
  }
}
