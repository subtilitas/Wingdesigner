// Application entry: wires the store, the wing build, the 3D viewer and the panels.

import './ui/styles.css';
import { buildWing } from './geom/wing.js';
import { wingStats } from './geom/stats.js';
import { projectFromJsonText, projectToJsonText } from './model/io.js';
import { defaultProject } from './model/defaults.js';
import { Store } from './ui/store.js';
import { Viewer3D } from './ui/viewer3d.js';
import { SectionsPanel } from './ui/sections.js';
import { PlanformEditor } from './ui/planform.js';
import { AirfoilsPanel } from './ui/airfoils.js';
import { SettingsPanel } from './ui/settings.js';
import { exportDialog } from './ui/exportui.js';
import { openWizard } from './ui/wizard.js';
import { clear, download, h, slugFile } from './ui/dom.js';

const VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0';
const STORAGE_KEY = 'wingdesigner.project.v1';
const REPO = 'https://github.com/subtilitas/Wingdesigner';

function loadSaved() {
  try {
    const text = localStorage.getItem(STORAGE_KEY);
    if (!text) return null;
    const r = projectFromJsonText(text);
    return r.ok ? r.project : null;
  } catch {
    return null;
  }
}

function save(project) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
  } catch {
    // Storage unavailable (private mode, quota): the project stays in memory only.
  }
}

const saved = loadSaved();
const store = new Store(saved ?? defaultProject());
let build = buildWing(store.project);
const getBuild = () => build;

// Layout.
const statusText = h('span', { class: 'status-text' });
const toast = h('div', { class: 'toast', role: 'status', 'aria-live': 'polite' });
const undoBtn = h('button', { type: 'button', title: 'Undo (Ctrl+Z)', onclick: () => store.undo() }, 'Undo');
const redoBtn = h('button', { type: 'button', title: 'Redo (Ctrl+Shift+Z)', onclick: () => store.redo() }, 'Redo');
const openInput = h('input', {
  type: 'file',
  accept: '.json,application/json',
  style: { display: 'none' },
  onchange: async (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    const r = projectFromJsonText(await f.text());
    if (!r.ok) {
      message(`Cannot open ${f.name}: ${r.errors.slice(0, 3).join(' ')}`, true);
      return;
    }
    store.replace(r.project);
    viewer.hasFitted = false;
    message(`Opened ${f.name}.`);
  },
});

const header = h(
  'header',
  { class: 'topbar' },
  h('div', { class: 'brand' }, h('span', { class: 'logo', 'aria-hidden': 'true' }), 'Wingdesigner'),
  h(
    'nav',
    { class: 'actions', 'aria-label': 'Project' },
    h('button', { type: 'button', onclick: () => newDesign(false) }, 'New'),
    h('button', { type: 'button', onclick: () => openInput.click() }, 'Open'),
    h(
      'button',
      {
        type: 'button',
        title: 'Save the project as JSON',
        onclick: () => download(slugFile(store.project.name, 'json'), projectToJsonText(store.project, build, { generatorVersion: VERSION }), 'application/json'),
      },
      'Save',
    ),
    h('button', { type: 'button', class: 'primary', onclick: () => exportDialog(store, getBuild, VERSION) }, 'Export'),
    undoBtn,
    redoBtn,
    h('button', { type: 'button', onclick: () => helpDialog() }, 'Help'),
    openInput,
  ),
);

const viewport = h('div', { class: 'viewport' });
const viewTools = h(
  'div',
  { class: 'view-tools' },
  ...['iso', 'top', 'front', 'side'].map((v) => h('button', { type: 'button', onclick: () => viewer.view(v) }, v[0].toUpperCase() + v.slice(1))),
  h('button', { type: 'button', onclick: () => viewer.fit(), title: 'Fit the wing into the view' }, 'Fit'),
  h('button', { type: 'button', class: 'expand', onclick: () => document.body.classList.toggle('view-max'), title: 'Enlarge or shrink the 3D view' }, 'Enlarge'),
);
const viewWrap = h('div', { class: 'view-wrap' }, viewport, viewTools, toast);

const TABS = [
  ['sections', 'Sections'],
  ['planform', 'Planform'],
  ['airfoils', 'Airfoils'],
  ['settings', 'Settings'],
  ['checks', 'Checks'],
];
const panes = Object.fromEntries(TABS.map(([k]) => [k, h('div', { class: 'pane', id: `pane-${k}`, role: 'tabpanel', hidden: true })]));
const tabButtons = TABS.map(([k, label]) =>
  h('button', { type: 'button', role: 'tab', id: `tab-${k}`, 'aria-controls': `pane-${k}`, onclick: () => selectTab(k) }, label),
);
const panel = h('aside', { class: 'panel' }, h('div', { class: 'tabs', role: 'tablist' }, tabButtons), ...Object.values(panes));
const statusBar = h('footer', { class: 'statusbar' }, statusText);
document.getElementById('app').append(header, h('main', { class: 'layout' }, viewWrap, panel), statusBar);

const viewer = new Viewer3D(viewport);
const sectionsPanel = new SectionsPanel(panes.sections, store, getBuild);
const planform = new PlanformEditor(panes.planform, store, getBuild);
const airfoils = new AirfoilsPanel(panes.airfoils, store, { onMessage: (m) => message(m) });
const settings = new SettingsPanel(panes.settings, store, viewer);

let activeTab = 'sections';
try {
  activeTab = localStorage.getItem('wingdesigner.tab') || 'sections';
} catch {
  // ignore
}
function selectTab(key) {
  activeTab = TABS.some(([k]) => k === key) ? key : 'sections';
  for (const [k] of TABS) {
    panes[k].hidden = k !== activeTab;
    document.getElementById(`tab-${k}`).setAttribute('aria-selected', String(k === activeTab));
  }
  try {
    localStorage.setItem('wingdesigner.tab', activeTab);
  } catch {
    // ignore
  }
  if (activeTab === 'planform') planform.pz.redraw();
}

function renderChecks() {
  const items = [];
  for (const e of build.errors) items.push(h('li', { class: 'sev-error' }, h('strong', {}, 'Error: '), e));
  for (const w of build.warnings) items.push(h('li', { class: 'sev-warning' }, h('strong', {}, 'Warning: '), w));
  const stats = build.surface ? wingStats(build) : null;
  clear(panes.checks).append(
    h('h3', {}, 'Geometry checks'),
    items.length ? h('ul', { class: 'issues' }, items) : h('p', {}, 'No errors or warnings.'),
    stats
      ? h(
          'table',
          { class: 'grid-table stats' },
          h(
            'tbody',
            {},
            [
              ['Span', `${stats.span.toFixed(1)} mm`],
              ['Wing area', `${(stats.area / 1e4).toFixed(2)} dm²`],
              ['Aspect ratio', stats.aspectRatio.toFixed(2)],
              ['Mean aerodynamic chord (MAC)', `${stats.mac.toFixed(1)} mm`],
              ['MAC position', `y ${stats.macY.toFixed(1)} mm, leading edge x ${stats.macXLE.toFixed(1)} mm`],
              ['25 % MAC (geometric reference)', `x ${(stats.macXLE + 0.25 * stats.mac).toFixed(1)} mm`],
              ['Root / tip chord', `${stats.rootChord.toFixed(1)} / ${stats.tipChord.toFixed(1)} mm`],
              ['Surface', `degree ${build.surface.degreeU} x ${build.surface.degreeV}, ${build.surface.points.length} x ${build.surface.points[0].length} control points`],
              ['Trailing edge', build.closedTE ? 'closed' : 'open'],
            ].map(([k, v]) => h('tr', {}, h('th', { scope: 'row' }, k), h('td', {}, v))),
          ),
        )
      : null,
    h('p', { class: 'small muted' }, 'The 25 % MAC point is a geometric reference only; it is not an aerodynamic neutral-point or centre-of-gravity calculation.'),
  );
  const s = stats ? `Span ${stats.span.toFixed(0)} mm · area ${(stats.area / 1e4).toFixed(2)} dm² · AR ${stats.aspectRatio.toFixed(2)} · MAC ${stats.mac.toFixed(1)} mm` : '';
  statusText.textContent = build.errors.length ? `${build.errors.length} error(s): ${build.errors[0]}` : s + (build.warnings.length ? ` · ${build.warnings.length} warning(s)` : '');
  statusBar.classList.toggle('has-error', build.errors.length > 0);
}

let rebuildPending = false;
function rebuild() {
  if (rebuildPending) return;
  rebuildPending = true;
  requestAnimationFrame(() => {
    rebuildPending = false;
    try {
      build = buildWing(store.project);
    } catch (e) {
      build = { errors: [`Internal error: ${e.message}`], warnings: [], stations: [], surface: null, sections: [], profiles: new Map(), guides: {}, settings: store.project.settings };
    }
    const sel = store.project.sections.find((s) => s.id === store.selection.section);
    const selV = sel && build.surface ? (sel.y - build.rootY) / (build.tipY - build.rootY || 1) : null;
    viewer.setBuild(build.surface ? build : null, { mirror: store.project.settings.mirror !== false, selectedV: selV });
    sectionsPanel.update();
    planform.update();
    renderChecks();
    undoBtn.disabled = !store.canUndo();
    redoBtn.disabled = !store.canRedo();
    save(store.project);
  });
}

store.subscribe((project, reason) => {
  if (reason === 'select') {
    rebuild();
    return;
  }
  rebuild();
  if (['load', 'undo', 'redo'].includes(reason)) {
    airfoils.update();
    settings.update();
  } else if (reason === 'edit') {
    airfoils.update();
    if (activeTab === 'settings') {
      // Keep focus stable while typing in the settings form: re-render only after changes land.
      settings.update();
    }
  }
});

function message(text, isError = false) {
  toast.textContent = text;
  toast.classList.toggle('error', isError);
  toast.classList.add('show');
  clearTimeout(message.t);
  message.t = setTimeout(() => toast.classList.remove('show'), 4000);
}

async function newDesign(firstRun) {
  const p = await openWizard({ firstRun });
  if (p) {
    store.replace(p);
    viewer.hasFitted = false;
    selectTab('sections');
    message(`Created "${p.name}".`);
  }
}

function helpDialog() {
  const dialog = h(
    'dialog',
    { class: 'modal' },
    h(
      'form',
      { method: 'dialog' },
      h('h2', {}, 'Wingdesigner'),
      h('p', {}, `Version ${VERSION}. Designs one half of a wing from airfoil sections and mirrors it at y = 0.`),
      h('h3', {}, 'Workflow'),
      h(
        'ol',
        {},
        h('li', {}, 'New: pick a design type in the wizard, or edit the sample wing.'),
        h('li', {}, 'Airfoils: add NACA sections, library entries, or upload .dat files (checked and previewed before use).'),
        h('li', {}, 'Sections: set span position y, leading edge x and z, chord and twist for each section.'),
        h('li', {}, 'Planform: switch on the nose line and end line to shape the leading and trailing edge between sections.'),
        h('li', {}, 'Export: STEP (exact NURBS solids), STL or 3MF (meshes), and the project JSON.'),
      ),
      h('h3', {}, 'Controls'),
      h(
        'ul',
        {},
        h('li', {}, '3D view: drag to rotate, pinch or scroll to zoom, two fingers or right mouse button to pan.'),
        h('li', {}, 'Planform and previews: drag points to edit, drag the background to pan, pinch or scroll to zoom, double-click to fit.'),
        h('li', {}, 'Undo and redo: Ctrl+Z and Ctrl+Shift+Z.'),
      ),
      h('h3', {}, 'Coordinates and units'),
      h('p', {}, 'Millimetres. x runs chordwise towards the trailing edge, y spanwise towards the right tip, z up. Twist is positive with the leading edge up.'),
      h('h3', {}, 'Airfoil data'),
      h(
        'p',
        {},
        'NACA sections are computed from their published equations. Uploaded airfoils keep their name and attribution in the project file; respect the terms of the source you downloaded them from.',
      ),
      h('p', {}, h('a', { href: `${REPO}/wiki`, target: '_blank', rel: 'noopener' }, 'Documentation (wiki)'), ' · ', h('a', { href: REPO, target: '_blank', rel: 'noopener' }, 'Source code (MIT license)')),
      h('div', { class: 'row end' }, h('button', { value: 'close', class: 'primary' }, 'Close')),
    ),
  );
  document.body.append(dialog);
  dialog.addEventListener('close', () => dialog.remove());
  dialog.showModal();
}

window.addEventListener('keydown', (e) => {
  const target = e.target;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return;
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    if (e.shiftKey) store.redo();
    else store.undo();
  } else if (mod && e.key.toLowerCase() === 'y') {
    e.preventDefault();
    store.redo();
  }
});

selectTab(activeTab);
rebuild();
if (!saved) newDesign(true);
