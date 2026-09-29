// Application entry: wires the store, the wing build, the 3D viewer and the panels.

import './ui/styles.css';
import { buildWing } from './geom/wing.js';
import { wingStats } from './geom/stats.js';
import { MAX_PROJECT_BYTES, OMITTED_NOTE, projectFileText, projectFromJsonText } from './model/io.js';
import { largeSizes, projectSize, sizeWarning } from './model/budget.js';
import { defaultProject } from './model/defaults.js';
import { validateProject } from './model/project.js';
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

let loadProblem = null;
// Set when the saved text could not be loaded and not be copied aside: autosave stays off, so the
// only copy is not overwritten.
let keepSaved = false;
// Set while autosave fails (quota, storage unavailable); STALE_KEY then tells the next start that
// the saved project is older than the last session.
let autosaveFailed = false;
const STALE_KEY = `${STORAGE_KEY}.stale`;

/** Keep text that failed to load under the ".rejected" key, or keep it in place if that fails. */
function keepRejected(text, reason) {
  try {
    localStorage.setItem(`${STORAGE_KEY}.rejected`, text);
    loadProblem = `The saved project could not be loaded (${reason}); it is kept in local storage under "${STORAGE_KEY}.rejected".`;
  } catch {
    keepSaved = true;
    loadProblem = `The saved project could not be loaded (${reason}), and browser storage has no room for a copy: autosave is off, so it stays under "${STORAGE_KEY}". Use Save to keep new work.`;
  }
}

function loadSaved() {
  let text;
  let stale;
  try {
    text = localStorage.getItem(STORAGE_KEY);
    stale = localStorage.getItem(STALE_KEY);
    localStorage.removeItem(STALE_KEY);
  } catch {
    return null;
  }
  if (!text) return null;
  const r = projectFromJsonText(text);
  if (!r.ok) {
    keepRejected(text, r.errors[0]);
    return null;
  }
  if (stale) loadProblem = `This is the project as last saved; autosave stopped at ${stale} because browser storage was full, and later edits were not saved.`;
  return { project: r.project, text };
}

/**
 * Autosave only projects that load again; an invalid edit keeps the last valid save. Nothing is
 * saved while the first-run wizard is open, so a reload then shows the wizard again. A failed save
 * (browser storage holds about 5,000,000 characters per site) is reported once and marked for the
 * next start.
 */
function save(project) {
  if (firstRunOpen || keepSaved) return;
  let length = 0;
  try {
    if (!validateProject(project).ok) return;
    const text = JSON.stringify(project);
    length = text.length;
    localStorage.setItem(STORAGE_KEY, text);
    if (autosaveFailed) {
      autosaveFailed = false;
      localStorage.removeItem(STALE_KEY);
      autosaveNote.textContent = '';
      message('Autosave works again.');
    }
  } catch {
    if (autosaveFailed) return;
    autosaveFailed = true;
    try {
      localStorage.setItem(STALE_KEY, new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC');
    } catch {
      // No room for the marker either.
    }
    autosaveNote.textContent = ' · Autosave off: use Save';
    message(`Autosave is off: browser storage refused the project (${length} characters; browsers keep about 5,000,000 per site). Use Save to keep it.`, true);
  }
}

function safeBuild(project) {
  try {
    return buildWing(project);
  } catch (e) {
    return { errors: [`Internal error: ${e.message}`], warnings: [], stations: [], surface: null, sections: [], profiles: new Map(), guides: {}, settings: project.settings };
  }
}

const restored = loadSaved();
let saved = restored?.project ?? null;
let store;
try {
  store = new Store(saved ?? defaultProject());
} catch (e) {
  // A saved project that validates but cannot be restored: start from the sample wing.
  keepRejected(restored.text, e.message);
  saved = null;
  store = new Store(defaultProject());
}
let firstRunOpen = !saved;
let build = safeBuild(store.project);
const getBuild = () => build;

// Layout.
const statusText = h('span', { class: 'status-text' });
const autosaveNote = h('span', { class: 'sev-error' });
const toast = h('div', { class: 'toast', role: 'status', 'aria-live': 'polite' });
const undoBtn = h('button', { type: 'button', title: 'Undo (Ctrl+Z)', onclick: () => store.undo() }, 'Undo');
const redoBtn = h('button', { type: 'button', title: 'Redo (Ctrl+Shift+Z)', onclick: () => store.redo() }, 'Redo');
// Each Open choice gets a number; a read that finishes after a newer choice is dropped.
let openRequest = 0;
const openInput = h('input', {
  type: 'file',
  accept: '.json,application/json',
  style: { display: 'none' },
  onchange: async (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    const request = ++openRequest;
    if (f.size > MAX_PROJECT_BYTES) {
      message(`Cannot open ${f.name}: ${(f.size / 1e6).toFixed(1)} MB; project files are limited to ${MAX_PROJECT_BYTES / 1e6} MB.`, true);
      return;
    }
    let text;
    try {
      text = await f.text();
    } catch (err) {
      if (request === openRequest) message(`Cannot open ${f.name}: the browser could not read the file (${err?.name ?? 'Error'}).`, true);
      return;
    }
    if (request !== openRequest) return;
    const r = projectFromJsonText(text);
    if (!r.ok) {
      message(`Cannot open ${f.name}: ${r.errors.slice(0, 3).join(' ')}`, true);
      return;
    }
    store.replace(r.project);
    viewer.hasFitted = false;
    planform.pz.fitted = false;
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
        // Build from the current project: an edit committed by this click's blur is not yet in `build`.
        onclick: () => {
          try {
            const file = projectFileText(store.project, safeBuild(store.project), { generatorVersion: VERSION });
            download(slugFile(store.project.name, 'json'), file.text, 'application/json');
            if (file.omitted) message(OMITTED_NOTE);
          } catch (e) {
            // String length and memory limits of the browser end here.
            message(`Save failed: ${e.message}.`, true);
          }
        },
      },
      'Save',
    ),
    h('button', { type: 'button', class: 'primary', onclick: () => exportDialog(store, () => safeBuild(store.project), VERSION, message) }, 'Export'),
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
const statusBar = h('footer', { class: 'statusbar' }, statusText, autosaveNote);
document.getElementById('app').append(header, h('main', { class: 'layout' }, viewWrap, panel), statusBar);

const viewer = new Viewer3D(viewport);
const sectionsPanel = new SectionsPanel(panes.sections, store, getBuild, { onMessage: (m, e) => message(m, e) });
const planform = new PlanformEditor(panes.planform, store, getBuild);
const airfoils = new AirfoilsPanel(panes.airfoils, store, { onMessage: (m, e) => message(m, e) });
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

// Sizes above their warning thresholds; a size that newly crosses its threshold (an edit, Open or
// the restored project) shows the size warning with the expected time and memory.
let largeKeys = new Set();
function noteLargeSizes() {
  const size = projectSize(store.project);
  const keys = new Set(largeSizes(size).map((q) => q.key));
  if ([...keys].some((k) => !largeKeys.has(k))) {
    // After a notice of the same change ("Added airfoil ..."), both stay readable.
    const shown = toast.classList.contains('show') && !toast.classList.contains('error') ? `${toast.textContent} ` : '';
    message(shown + sizeWarning(store.project, size));
  }
  largeKeys = keys;
}

let rebuildPending = false;
let refreshPanels = false;
// A selection alone keeps the build: the viewer, the table and the planform only mark the section.
// A display setting (mirror) redraws from the current build; the start shows the build made above.
let geometryPending = false;
let viewPending = true;
function rebuild() {
  if (rebuildPending) return;
  rebuildPending = true;
  requestAnimationFrame(() => {
    rebuildPending = false;
    // Panels re-render below; remember the focused field so Tab and arrow-key editing continue.
    const focusKey = document.activeElement?.dataset?.focusKey;
    const changed = geometryPending;
    const redraw = changed || viewPending;
    geometryPending = false;
    viewPending = false;
    if (changed) build = safeBuild(store.project);
    const sel = store.project.sections.find((s) => s.id === store.selection.section);
    const selV = sel && build.surface ? (sel.y - build.rootY) / (build.tipY - build.rootY || 1) : null;
    if (redraw) {
      viewer.setBuild(build.surface ? build : null, { mirror: store.project.settings.mirror !== false, selectedV: selV });
      sectionsPanel.update();
    } else {
      viewer.setSelection(selV);
      sectionsPanel.markSelected();
    }
    planform.update();
    if (refreshPanels) {
      airfoils.update();
      settings.update();
      refreshPanels = false;
    }
    if (redraw) {
      renderChecks();
      noteLargeSizes();
    }
    if (focusKey) {
      const el = document.querySelector(`[data-focus-key="${CSS.escape(focusKey)}"]`);
      if (el && el !== document.activeElement) {
        el.focus();
        el.select?.();
      }
    }
    undoBtn.disabled = !store.canUndo();
    redoBtn.disabled = !store.canRedo();
    flushSave();
  });
}

// The autosave runs with the rebuild in the next frame. Leaving or hiding the page before that
// frame (reload, closing the tab, switching apps on a phone) saves the pending edit at once.
let savePending = false;
function flushSave() {
  if (!savePending) return;
  savePending = false;
  save(store.project);
}
addEventListener('pagehide', flushSave);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flushSave();
});

store.subscribe((project, reason) => {
  // Airfoil and settings panels re-render in the next frame together with the build.
  if (reason !== 'select') {
    refreshPanels = true;
    savePending = true;
    if (reason === 'display') viewPending = true;
    else geometryPending = true;
  }
  rebuild();
});

function message(text, isError = false) {
  toast.textContent = text;
  toast.classList.toggle('error', isError);
  toast.classList.add('show');
  clearTimeout(message.t);
  // Long messages (size warnings) stay longer: 60 ms per character, at least 4 s.
  message.t = setTimeout(() => toast.classList.remove('show'), Math.max(4000, 60 * text.length));
}

async function newDesign(firstRun) {
  const p = await openWizard({ firstRun });
  if (firstRun) {
    firstRunOpen = false;
    // Skip keeps the sample wing: save it now that the user has chosen.
    if (!p) save(store.project);
  }
  if (p) {
    store.replace(p);
    viewer.hasFitted = false;
    planform.pz.fitted = false;
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
  if (document.querySelector('dialog[open]')) return;
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
if (loadProblem) message(loadProblem, true);
if (!saved) newDesign(true);
