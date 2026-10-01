// Section table: airfoil, span position y, leading-edge x and z, chord, twist per section, and with
// mitred section planes the angle of the panel to the next section (empty: from y and z).

import { insertProblem, insertSection, removeSection, sortedSections, syncGuidesToSpan, resetDisabledGuides } from '../model/edit.js';
import { clear, h, numberInput } from './dom.js';
import { LIMITS } from '../model/project.js';
import { LAZY_OPTIONS, WARN, costPhrase, displayName, loftGrid, projectSize } from '../model/budget.js';
import { mitredPlanes, panelDihedrals, rolledPanelCount, storesPanelAngle } from '../geom/planes.js';
import { count, fixed, plain, tr } from '../i18n/index.js';
import { wingletDialog } from './winglet.js';

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

/** The number columns of the table (label, unit and tooltip in the current language, so made per render). */
export function sectionFields() {
  return [
    { key: 'y', label: 'y', unit: 'mm', title: tr('Span position of the section plane'), step: 5, min: 0, max: C },
    { key: 'x', label: 'x', unit: 'mm', title: tr('Leading-edge position, chordwise (positive aft = sweep back)'), step: 1, min: -C, max: C },
    { key: 'z', label: 'z', unit: 'mm', title: tr('Leading-edge height (dihedral)'), step: 1, min: -C, max: C },
    { key: 'chord', label: tr('Chord'), unit: 'mm', title: tr('Chord length (profile scale)'), step: 1, min: LIMITS.minChord, max: LIMITS.maxChord },
    { key: 'twist', label: tr('Twist'), unit: tr('deg'), title: tr('Twist about the pivot; positive = leading edge up'), step: 0.1, min: -LIMITS.maxTwist, max: LIMITS.maxTwist },
  ];
}

/**
 * The panel angle column, shown with mitred section planes: the angle of the panel to the next section
 * that the planes use. Empty uses the dihedral from y and z of the two sections.
 */
export function panelAngleField() {
  return {
    key: 'panelAngle',
    label: tr('Panel angle'),
    unit: tr('deg'),
    title: tr('Angle of the panel to the next section for the mitred section planes. Empty: from y and z of the two sections.'),
    step: 0.1,
    min: -LIMITS.maxPanelAngle,
    max: LIMITS.maxPanelAngle,
  };
}

/** Tooltip of the insert button: the hard limit, or above the warning threshold the time and memory with one more section. */
export function insertTitle(project) {
  const guides = project.guides ?? {};
  const more = { ...projectSize(project), sections: project.sections.length + 1 };
  // One more section adds one more panel between mitred planes when the wing has such panels.
  const rolled = rolledPanelCount(project.sections, project.settings);
  more.gridPoints = loftGrid(more.sections, project.settings, guides.nose?.enabled || guides.end?.enabled, rolled ? rolled + 1 : 0).points;
  if (project.sections.length >= LIMITS.maxSections) return tr('At most {n} sections: more run a desktop browser tab out of memory.', { n: count(LIMITS.maxSections) });
  if (more.sections > WARN.sections) return tr('Insert a section after this one. With {n} sections, {cost}.', { n: count(more.sections), cost: costPhrase(more) });
  return tr('Insert a section after this one');
}

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
    for (const row of this.root.querySelectorAll('tr[data-section]')) row.classList.toggle('selected', row.dataset.section === sel);
  }

  /** Panel angle of sorted section i: a stored number, or empty for the angle `auto[i]` from y and z. The tip has no panel: an empty cell. */
  panelAngleCell(s, i, auto, f) {
    if (i >= auto.length) return h('td', {});
    const label = { dataset: { label: `${f.label} (${f.unit})` } };
    const commit = (value) => {
      if (value === null && !storesPanelAngle(s)) {
        this.render();
        return;
      }
      this.store.update((q) => {
        const t = q.sections.find((z) => z.id === s.id);
        if (value === null) delete t.panelAngle;
        else t.panelAngle = Math.min(Math.max(value, f.min), f.max);
      });
    };
    const input = numberInput({
      value: storesPanelAngle(s) ? s.panelAngle : null,
      step: f.step,
      min: f.min,
      max: f.max,
      title: f.title,
      optional: true,
      placeholder: tr('auto {angle}', { angle: fixed(auto[i], 1) }),
      fallback: () => Number(auto[i].toFixed(1)),
      onCommit: commit,
      focusKey: `sec:${s.id}:panelAngle`,
    });
    // Wider than the other number fields: the placeholder names the angle from y and z.
    input.classList.add('angle');
    return h('td', label, input);
  }

  render() {
    const p = this.store.project;
    const build = this.getBuild();
    const guides = p.guides ?? {};
    const sel = this.store.selection.section;
    const sections = sortedSections(p);
    const columns = sectionFields();
    // With mitred planes: the panel angle column, and the angle of each panel from y and z.
    const angleField = mitredPlanes(p.settings) ? panelAngleField() : null;
    const auto = angleField ? panelDihedrals(sections) : [];
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
    const insertText = insertTitle(p);
    const rows = sections.map((s, i) => {
      const st = stationAt(stations, s.y);
      const commit = (key) => (value) => {
        // Values outside the project limits are clamped to them.
        const f = columns.find((q) => q.key === key);
        const v = Math.min(Math.max(value, f.min), f.max);
        if (key === 'y' && p.sections.some((o) => o.id !== s.id && o.y === v)) {
          this.onMessage(tr('Another section already lies at y = {y} mm; sections need distinct span positions.', { y: plain(v) }), true);
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
        h('th', { scope: 'row', class: 'sec-num' }, h('span', { class: 'sec-word' }, tr('Section'), ' '), String(i + 1)),
        h(
          'td',
          { class: 'sec-airfoil', dataset: { label: tr('Airfoil') } },
          h(
            'select',
            {
              'aria-label': tr('Airfoil of section {n}', { n: plain(i + 1) }),
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
        columns.map((f) => {
          const eff = overridden(f.key) && st ? (f.key === 'x' ? st.xLE : st.chord) : null;
          const tipChord = f.key === 'chord' && i === sections.length - 1 && build?.tipChord ? build.tipChord : null;
          return h(
            'td',
            { dataset: { label: `${f.label} (${f.unit})` } },
            numberInput({ value: s[f.key], step: f.step, min: f.min, max: f.max, title: f.title, onCommit: commit(f.key), focusKey: `sec:${s.id}:${f.key}` }),
            tipChord !== null
              ? h(
                  'div',
                  { class: 'muted small', title: tr('Pointed tip: chord scaled from the previous section, at least {min} mm', { min: plain(LIMITS.minChord) }) },
                  build.tipChordLimited ? tr('tip: {chord} (min.)', { chord: fixed(tipChord, 2) }) : tr('tip: {chord}', { chord: fixed(tipChord, 2) }),
                )
              : eff !== null && Math.abs(eff - s[f.key]) > 0.05
                ? h('div', { class: 'muted small', title: tr('Value set by the guide curve') }, tr('guide: {value}', { value: fixed(eff, 1) }))
                : null,
          );
        }),
        angleField ? this.panelAngleCell(s, i, auto, angleField) : null,
        h(
          'td',
          { class: 'sec-actions' },
          h(
            'button',
            {
              type: 'button',
              class: 'icon',
              title: insertText,
              'aria-label': tr('Insert section after {n}', { n: plain(i + 1) }),
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
              title: tr('Delete section'),
              'aria-label': tr('Delete section {n}', { n: plain(i + 1) }),
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
              h('th', {}, tr('Airfoil')),
              [...columns, ...(angleField ? [angleField] : [])].map((f) => h('th', { title: f.title }, `${f.label} `, h('span', { class: 'unit' }, f.unit))),
              h('th', {}, ''),
            ),
          ),
          h('tbody', {}, rows),
        ),
      ),
      h('div', { class: 'row' }, h('button', { type: 'button', title: tr('Append a winglet beyond the wing tip'), onclick: () => wingletDialog(this.store, (m) => this.onMessage(m)) }, tr('Winglet…'))),
      h(
        'p',
        { class: 'muted small' },
        tr('Each section places its airfoil with the leading edge at (x, y, z), scaled to the chord and twisted about the pivot set in Settings.'),
        ' ',
        tr('The half wing lies on the +y side and is mirrored at y = 0.'),
      ),
    );
  }
}
