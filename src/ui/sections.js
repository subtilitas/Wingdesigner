// Section table: airfoil, span position y, leading-edge x and z, chord, twist per section.

import { insertSection, removeSection, sortedSections, syncGuidesToSpan, resetDisabledGuides } from '../model/edit.js';
import { clear, h, numberInput } from './dom.js';
import { LIMITS } from '../model/project.js';

const FIELDS = [
  { key: 'y', label: 'y', unit: 'mm', title: 'Span position of the section plane', step: 5 },
  { key: 'x', label: 'x', unit: 'mm', title: 'Leading-edge position, chordwise (positive aft = sweep back)', step: 1 },
  { key: 'z', label: 'z', unit: 'mm', title: 'Leading-edge height (dihedral)', step: 1 },
  { key: 'chord', label: 'Chord', unit: 'mm', title: 'Chord length (profile scale)', step: 1, min: 1 },
  { key: 'twist', label: 'Twist', unit: 'deg', title: 'Twist about the pivot; positive = leading edge up', step: 0.1 },
];

export class SectionsPanel {
  constructor(root, store, getBuild, { onMessage } = {}) {
    this.root = root;
    this.store = store;
    this.getBuild = getBuild;
    this.onMessage = onMessage ?? (() => {});
    this.render();
  }

  update() {
    this.render();
  }

  render() {
    const p = this.store.project;
    const build = this.getBuild();
    const guides = p.guides ?? {};
    const sel = this.store.selection.section;
    const sections = sortedSections(p);
    const overridden = (key) => (key === 'x' && (guides.nose?.enabled || guides.end?.enabled)) || (key === 'chord' && guides.nose?.enabled && guides.end?.enabled);
    const rows = sections.map((s, i) => {
      const st = build?.stations?.find((q) => Math.abs(q.y - s.y) < 1e-9);
      const commit = (key) => (v) => {
        if (key === 'y' && p.sections.some((o) => o.id !== s.id && Math.abs(o.y - Math.max(v, 0)) < 1e-6)) {
          this.onMessage(`Another section already lies at y = ${Math.max(v, 0)} mm; sections need distinct span positions.`, true);
          this.render();
          return;
        }
        this.store.update((q) => {
          const t = q.sections.find((z) => z.id === s.id);
          if (key === 'chord') v = Math.max(v, 0.01);
          if (key === 'y') v = Math.max(v, 0);
          t[key] = v;
          if (key === 'y') {
            q.sections.sort((a, b) => a.y - b.y);
            resetDisabledGuides(q);
            syncGuidesToSpan(q);
          } else if (key === 'x' || key === 'chord') {
            resetDisabledGuides(q);
          }
        });
      };
      return h(
        'tr',
        { class: s.id === sel ? 'selected' : '', onclick: (e) => (e.target.tagName === 'TD' || e.target.tagName === 'TH' ? this.store.select(s.id) : null) },
        h('th', { scope: 'row', class: 'sec-num' }, h('span', { class: 'sec-word' }, 'Section '), String(i + 1)),
        h(
          'td',
          { class: 'sec-airfoil', dataset: { label: 'Airfoil' } },
          h(
            'select',
            {
              'aria-label': `Airfoil of section ${i + 1}`,
              onchange: (e) =>
                this.store.update((q) => {
                  q.sections.find((z) => z.id === s.id).airfoil = e.target.value;
                }),
            },
            p.airfoils.map((a) => h('option', { value: a.id, selected: a.id === s.airfoil }, a.name)),
          ),
        ),
        FIELDS.map((f) => {
          const eff = overridden(f.key) && st ? (f.key === 'x' ? st.xLE : st.chord) : null;
          const tipChord = f.key === 'chord' && i === sections.length - 1 && build?.tipChord ? build.tipChord : null;
          return h(
            'td',
            { dataset: { label: `${f.label} (${f.unit})` } },
            numberInput({ value: s[f.key], step: f.step, min: f.min, title: f.title, onCommit: commit(f.key), focusKey: `sec:${s.id}:${f.key}` }),
            tipChord !== null
              ? h(
                  'div',
                  { class: 'muted small', title: `Pointed tip: chord scaled from the previous section, at least ${LIMITS.minChord} mm` },
                  `tip: ${tipChord.toFixed(2)}${build.tipChordLimited ? ' (min.)' : ''}`,
                )
              : eff !== null && Math.abs(eff - s[f.key]) > 0.05
                ? h('div', { class: 'muted small', title: 'Value set by the guide curve' }, `guide: ${eff.toFixed(1)}`)
                : null,
          );
        }),
        h(
          'td',
          { class: 'sec-actions' },
          h(
            'button',
            {
              type: 'button',
              class: 'icon',
              title: 'Insert a section after this one',
              'aria-label': `Insert section after ${i + 1}`,
              onclick: () => this.store.update((q) => this.store.select(insertSection(q, i).id)),
            },
            '+',
          ),
          h(
            'button',
            {
              type: 'button',
              class: 'icon',
              title: 'Delete section',
              'aria-label': `Delete section ${i + 1}`,
              disabled: sections.length <= 2,
              onclick: () => this.store.update((q) => removeSection(q, s.id)),
            },
            '×',
          ),
        ),
      );
    });
    clear(this.root).append(
      h(
        'div',
        { class: 'table-scroll' },
        h(
          'table',
          { class: 'grid-table sections' },
          h(
            'thead',
            {},
            h(
              'tr',
              {},
              h('th', {}, '#'),
              h('th', {}, 'Airfoil'),
              FIELDS.map((f) => h('th', { title: f.title }, `${f.label} `, h('span', { class: 'unit' }, f.unit))),
              h('th', {}, ''),
            ),
          ),
          h('tbody', {}, rows),
        ),
      ),
      h(
        'p',
        { class: 'muted small' },
        'Each section places its airfoil with the leading edge at (x, y, z), scaled to the chord and twisted about the pivot set in Settings. ',
        'The half wing lies on the +y side and is mirrored at y = 0.',
      ),
    );
  }
}
