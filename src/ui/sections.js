// Section table: airfoil, span position y, leading-edge x and z, chord, twist per section.

import { insertProblem, insertSection, removeSection, sortedSections, syncGuidesToSpan, resetDisabledGuides } from '../model/edit.js';
import { clear, h, numberInput } from './dom.js';
import { LIMITS } from '../model/project.js';
import { LAZY_OPTIONS, WARN, costPhrase, displayName, loftGrid, projectSize } from '../model/budget.js';

const C = LIMITS.maxCoordinate;

/** The station at span position y of stations sorted by y (stations at sections copy their y), or undefined. */
export function stationAt(stations, y) {
  let lo = 0;
  let hi = stations.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (stations[mid].y < y) lo = mid + 1;
    else hi = mid;
  }
  return stations.length && stations[lo].y === y ? stations[lo] : undefined;
}
const FIELDS = [
  { key: 'y', label: 'y', unit: 'mm', title: 'Span position of the section plane', step: 5, min: 0, max: C },
  { key: 'x', label: 'x', unit: 'mm', title: 'Leading-edge position, chordwise (positive aft = sweep back)', step: 1, min: -C, max: C },
  { key: 'z', label: 'z', unit: 'mm', title: 'Leading-edge height (dihedral)', step: 1, min: -C, max: C },
  { key: 'chord', label: 'Chord', unit: 'mm', title: 'Chord length (profile scale)', step: 1, min: LIMITS.minChord, max: LIMITS.maxChord },
  { key: 'twist', label: 'Twist', unit: 'deg', title: 'Twist about the pivot; positive = leading edge up', step: 0.1, min: -LIMITS.maxTwist, max: LIMITS.maxTwist },
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

  /** Mark the selected row without rendering the table again. */
  markSelected() {
    const sel = this.store.selection.section;
    for (const tr of this.root.querySelectorAll('tr[data-section]')) tr.classList.toggle('selected', tr.dataset.section === sel);
  }

  render() {
    const p = this.store.project;
    const build = this.getBuild();
    const guides = p.guides ?? {};
    const sel = this.store.selection.section;
    const sections = sortedSections(p);
    const overridden = (key) => (key === 'x' && (guides.nose?.enabled || guides.end?.enabled)) || (key === 'chord' && guides.nose?.enabled && guides.end?.enabled);
    const stations = build?.stations ?? [];
    // One option per section and airfoil: 1,000 sections with 200 airfoils took 1.7 s per render.
    const lazyLists = sections.length * p.airfoils.length > LAZY_OPTIONS;
    // One lookup per row: a filter over the airfoils per row took 1.7 s at 20,000 x 10,000.
    const airfoilById = new Map(p.airfoils.map((a) => [a.id, a]));
    const option = (a, chosen) => h('option', { value: a.id, selected: a.id === chosen }, displayName(a.name));
    const fillList = (e) => {
      const el = e.currentTarget;
      if (el.options.length >= p.airfoils.length) return;
      const chosen = el.value;
      el.replaceChildren(...p.airfoils.map((a) => option(a, chosen)));
      el.value = chosen;
    };
    // Above the warning threshold the insert button names the time and memory with one more section.
    const more = { ...projectSize(p), sections: sections.length + 1 };
    more.gridPoints = loftGrid(more.sections, p.settings, guides.nose?.enabled || guides.end?.enabled).points;
    const insertTitle =
      sections.length >= LIMITS.maxSections
        ? `At most ${LIMITS.maxSections.toLocaleString('en')} sections: more run a desktop browser tab out of memory.`
        : more.sections > WARN.sections
          ? `Insert a section after this one. With ${more.sections.toLocaleString('en')} sections, ${costPhrase(more)}.`
          : 'Insert a section after this one';
    const rows = sections.map((s, i) => {
      const st = stationAt(stations, s.y);
      const commit = (key) => (value) => {
        // Values outside the project limits are clamped to them.
        const f = FIELDS.find((q) => q.key === key);
        const v = Math.min(Math.max(value, f.min), f.max);
        if (key === 'y' && p.sections.some((o) => o.id !== s.id && o.y === v)) {
          this.onMessage(`Another section already lies at y = ${v} mm; sections need distinct span positions.`, true);
          this.render();
          return;
        }
        this.store.update((q) => {
          q.sections.find((z) => z.id === s.id)[key] = v;
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
        { class: s.id === sel ? 'selected' : '', dataset: { section: s.id }, onclick: (e) => (e.target.closest('input, select, button') ? null : this.store.select(s.id)) },
        h('th', { scope: 'row', class: 'sec-num' }, h('span', { class: 'sec-word' }, 'Section '), String(i + 1)),
        h(
          'td',
          { class: 'sec-airfoil', dataset: { label: 'Airfoil' } },
          h(
            'select',
            {
              'aria-label': `Airfoil of section ${i + 1}`,
              dataset: { focusKey: `sec:${s.id}:airfoil` },
              onchange: (e) =>
                this.store.update((q) => {
                  q.sections.find((z) => z.id === s.id).airfoil = e.target.value;
                }),
              // Large tables list only the chosen airfoil until the list is used.
              ...(lazyLists ? { onfocus: fillList, onpointerdown: fillList } : {}),
            },
            (lazyLists ? [airfoilById.get(s.airfoil)].filter(Boolean) : p.airfoils).map((a) => option(a, s.airfoil)),
          ),
        ),
        FIELDS.map((f) => {
          const eff = overridden(f.key) && st ? (f.key === 'x' ? st.xLE : st.chord) : null;
          const tipChord = f.key === 'chord' && i === sections.length - 1 && build?.tipChord ? build.tipChord : null;
          return h(
            'td',
            { dataset: { label: `${f.label} (${f.unit})` } },
            numberInput({ value: s[f.key], step: f.step, min: f.min, max: f.max, title: f.title, onCommit: commit(f.key), focusKey: `sec:${s.id}:${f.key}` }),
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
              title: insertTitle,
              'aria-label': `Insert section after ${i + 1}`,
              dataset: { focusKey: `sec:${s.id}:insert` },
              disabled: sections.length >= LIMITS.maxSections,
              onclick: () => {
                const problem = insertProblem(this.store.project, i);
                if (problem) {
                  this.onMessage(problem, true);
                  return;
                }
                this.store.update((q) => {
                  const sec = insertSection(q, i);
                  if (sec) this.store.select(sec.id);
                });
              },
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
              dataset: { focusKey: `sec:${s.id}:delete` },
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
