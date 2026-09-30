// Application entry: wires the store, the wing build, the 3D viewer and the panels.

import './ui/styles.css';
import { buildWing } from './geom/wing.js';
import { wingStats } from './geom/stats.js';
import { MAX_PROJECT_BYTES, omittedNote, projectFileText, projectFromJsonText } from './model/io.js';
import { displayName, largeSizes, projectSize, sizeWarning } from './model/budget.js';
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
import { openXflr5Dialog } from './ui/xflr5.js';
import { readXfl, sniffXflr5 } from './import/xfl.js';
import { readXflr5Xml } from './import/xflxml.js';
import { XflrError } from './import/errors.js';
import { decodeText } from './airfoil/parse.js';
import { clear, download, h, slugFile } from './ui/dom.js';
import { LANGUAGES, fixed, initialLanguage, language, plain, setLanguage, tr, whole } from './i18n/index.js';

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
const LANGUAGE_KEY = 'wingdesigner.language';

/** The stored language choice (null without one or without browser storage). */
function storedLanguage() {
  try {
    return localStorage.getItem(LANGUAGE_KEY);
  } catch {
    return null;
  }
}

// The language is set before the first message or panel is made: a stored choice, else German for a
// German browser, else English.
setLanguage(initialLanguage(storedLanguage(), navigator.languages ?? []));
document.documentElement.lang = language();

// Static elements of the shell (top bar, tabs, view buttons, status bar) are made once. Each one
// registers how its text, tooltip and aria-label read; labelShell() sets them at the start and after a
// change of language.
const shellLabels = [];
function localized(el, { text, title, label } = {}) {
  shellLabels.push(() => {
    if (text) el.textContent = text();
    if (title) el.title = title();
    if (label) el.setAttribute('aria-label', label());
  });
  return el;
}
function labelShell() {
  for (const set of shellLabels) set();
}

/** Keep text that failed to load under the ".rejected" key, or keep it in place if that fails. */
function keepRejected(text, reason) {
  try {
    localStorage.setItem(`${STORAGE_KEY}.rejected`, text);
    loadProblem = tr('The saved project could not be loaded ({reason}); it is kept in local storage under "{key}.rejected".', { reason, key: STORAGE_KEY });
  } catch {
    keepSaved = true;
    loadProblem = tr('The saved project could not be loaded ({reason}), and browser storage has no room for a copy: autosave is off, so it stays under "{key}". Use Save to keep new work.', { reason, key: STORAGE_KEY });
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
  if (stale) loadProblem = tr('This is the project as last saved; autosave stopped at {time} because browser storage was full, and later edits were not saved.', { time: stale });
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
      renderAutosaveNote();
      message(tr('Autosave works again.'));
    }
  } catch {
    if (autosaveFailed) return;
    autosaveFailed = true;
    try {
      localStorage.setItem(STALE_KEY, new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC');
    } catch {
      // No room for the marker either.
    }
    renderAutosaveNote();
    message(tr('Autosave is off: browser storage refused the project ({length} characters; browsers keep about 5,000,000 per site). Use Save to keep it.', { length: whole(length) }), true);
  }
}

/**
 * The build of the current project. An edit committed by the blur of a Save or Export click is not
 * yet built: it is built here, and the next frame draws the view and panels from it.
 */
function currentBuild() {
  if (geometryPending) {
    build = safeBuild(store.project);
    geometryPending = false;
    viewPending = true;
    formsPending = true;
  }
  return build;
}

function safeBuild(project) {
  try {
    return buildWing(project);
  } catch (e) {
    return { errors: [tr('Internal error: {message}', { message: e.message })], warnings: [], stations: [], surface: null, sections: [], profiles: new Map(), guides: {}, settings: project.settings };
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
// Autosave is off after a failed save, and for the session when a saved project could neither be
// loaded nor copied aside.
function renderAutosaveNote() {
  autosaveNote.textContent = keepSaved || autosaveFailed ? ` · ${tr('Autosave off: use Save')}` : '';
}
shellLabels.push(renderAutosaveNote);
const toast = h('div', { class: 'toast', role: 'status', 'aria-live': 'polite' });
const undoBtn = localized(h('button', { type: 'button', onclick: () => store.undo() }), { text: () => tr('Undo'), title: () => tr('Undo (Ctrl+Z)') });
const redoBtn = localized(h('button', { type: 'button', onclick: () => store.redo() }), { text: () => tr('Redo'), title: () => tr('Redo (Ctrl+Shift+Z)') });
// Each Open choice gets a number; a read that finishes after a newer choice is dropped.
let openRequest = 0;
const openInput = h('input', {
  type: 'file',
  // .wpa and .fl5 are listed so that Open can say why they cannot be imported.
  accept: '.json,.xfl,.xml,.wpa,.fl5,application/json',
  style: { display: 'none' },
  onchange: async (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    const request = ++openRequest;
    // An error of the import itself (not of the file) is shown rather than lost.
    const importAs = (kind) =>
      importXflr5(f, kind, request).catch((err) =>
        message(tr('Cannot open {name}: {problems}', { name: f.name, problems: tr('Internal error: {message}', { message: err?.message ?? String(err) }) }), true),
      );
    // XFLR5 projects by their extension: the binary reader loads them piece by piece and also names
    // the .wpa and flow5 (.fl5) projects it cannot read. Every other file is read whole: an XFLR5 XML
    // file (.xml), or else a project JSON.
    const ext = /\.([^.]*)$/.exec(f.name)?.[1].toLowerCase();
    let kind = ext === 'xfl' || ext === 'wpa' || ext === 'fl5' ? 'xfl' : ext === 'xml' ? 'xml' : null;
    if (kind === null && ext !== 'json') {
      // A name that lost its extension (some file pickers and downloads drop it): such a project is
      // known by its first bytes.
      let head;
      try {
        head = new Uint8Array(await f.slice(0, 4).arrayBuffer());
      } catch (err) {
        if (request === openRequest) cannotRead(f, err);
        return;
      }
      if (request !== openRequest) return;
      if (sniffXflr5(head)) kind = 'xfl';
      // Text saved as UTF-16 (bytes FF FE or FE FF) is no project JSON; the XML import decodes it.
      else if ((head[0] === 0xff && head[1] === 0xfe) || (head[0] === 0xfe && head[1] === 0xff)) kind = 'xml';
    }
    if (kind !== 'xfl' && f.size > MAX_PROJECT_BYTES) {
      message(tr('Cannot open {name}: {size} MB; project files are limited to {limit} MB.', { name: f.name, size: fixed(f.size / 1e6, 1), limit: plain(MAX_PROJECT_BYTES / 1e6) }), true);
      return;
    }
    if (kind) {
      importAs(kind);
      return;
    }
    let text;
    try {
      text = await f.text();
    } catch (err) {
      if (request === openRequest) cannotRead(f, err);
      return;
    }
    if (request !== openRequest) return;
    // XML under another name (plane.txt, say): the XFLR5 import names what it is. JSON never starts so.
    if (ext !== 'json' && /^\s*<(?:\?xml|!|explane[\s>/])/.test(text)) {
      importAs('xml');
      return;
    }
    const r = projectFromJsonText(text);
    if (!r.ok) {
      message(tr('Cannot open {name}: {problems}', { name: f.name, problems: r.errors.slice(0, 3).join(' ') }), true);
      return;
    }
    replaceProject(r.project);
    message(tr('Opened {name}.', { name: f.name }));
  },
});

const header = h(
  'header',
  { class: 'topbar' },
  h('div', { class: 'brand' }, h('span', { class: 'logo', 'aria-hidden': 'true' }), 'Wingdesigner'),
  localized(
    h(
      'nav',
      { class: 'actions' },
      localized(h('button', { type: 'button', onclick: () => newDesign(false) }), { text: () => tr('New') }),
      localized(h('button', { type: 'button', onclick: () => openInput.click() }), { text: () => tr('Open'), title: () => tr('Open a project (.json) or import a wing from XFLR5 (.xfl, .xml)') }),
      localized(
        h('button', {
          type: 'button',
          onclick: () => {
            try {
              const file = projectFileText(store.project, currentBuild(), { generatorVersion: VERSION });
              download(slugFile(store.project.name, 'json'), file.text, 'application/json');
              if (file.omitted) message(omittedNote());
            } catch (e) {
              // String length and memory limits of the browser end here.
              message(tr('Save failed: {reason}.', { reason: e.message }), true);
            }
          },
        }),
        { text: () => tr('Save'), title: () => tr('Save the project as JSON') },
      ),
      localized(h('button', { type: 'button', class: 'primary', onclick: () => exportDialog(store, currentBuild, VERSION, message) }), { text: () => tr('Export') }),
      undoBtn,
      redoBtn,
      localized(h('button', { type: 'button', onclick: () => helpDialog() }), { text: () => tr('Help') }),
      openInput,
    ),
    { label: () => tr('Project') },
  ),
);

const viewport = h('div', { class: 'viewport' });
const viewTools = h(
  'div',
  { class: 'view-tools' },
  ...[
    ['iso', () => tr('Iso')],
    ['top', () => tr('Top')],
    ['front', () => tr('Front')],
    ['side', () => tr('Side')],
  ].map(([v, label]) => localized(h('button', { type: 'button', onclick: () => viewer.view(v) }), { text: label })),
  localized(h('button', { type: 'button', onclick: () => viewer.fit() }), { text: () => tr('Fit'), title: () => tr('Fit the wing into the view') }),
  localized(h('button', { type: 'button', class: 'expand', onclick: () => document.body.classList.toggle('view-max') }), { text: () => tr('Enlarge'), title: () => tr('Enlarge or shrink the 3D view') }),
);
const viewWrap = h('div', { class: 'view-wrap' }, viewport, viewTools, toast);

const TABS = [
  ['sections', () => tr('Sections')],
  ['planform', () => tr('Planform')],
  ['airfoils', () => tr('Airfoils')],
  ['settings', () => tr('Settings')],
  ['checks', () => tr('Checks')],
];
const panes = Object.fromEntries(TABS.map(([k]) => [k, h('div', { class: 'pane', id: `pane-${k}`, role: 'tabpanel', hidden: true })]));
const tabButtons = TABS.map(([k, label]) =>
  localized(h('button', { type: 'button', role: 'tab', id: `tab-${k}`, 'aria-controls': `pane-${k}`, onclick: () => selectTab(k) }), { text: label }),
);
const panel = h('aside', { class: 'panel' }, h('div', { class: 'tabs', role: 'tablist' }, tabButtons), ...Object.values(panes));
const statusBar = h('footer', { class: 'statusbar' }, statusText, autosaveNote);
document.getElementById('app').append(header, h('main', { class: 'layout' }, viewWrap, panel), statusBar);
shellLabels.push(() => document.querySelector('meta[name="description"]')?.setAttribute('content', tr('Design RC model aircraft wings in the browser: airfoil sections, NURBS loft, guide curves, STEP, STL and 3MF export.')));
labelShell();

const viewer = new Viewer3D(viewport);
shellLabels.push(() => viewer.updateLabels());
const sectionsPanel = new SectionsPanel(panes.sections, store, getBuild, { onMessage: (m, e) => message(m, e) });
const planform = new PlanformEditor(panes.planform, store, getBuild);
const airfoils = new AirfoilsPanel(panes.airfoils, store, { onMessage: (m, e) => message(m, e) });
const settings = new SettingsPanel(panes.settings, store, viewer, { onLanguage: (code) => changeLanguage(code) });

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
  for (const e of build.errors) items.push(h('li', { class: 'sev-error' }, h('strong', {}, `${tr('Error')}: `), e));
  for (const w of build.warnings) items.push(h('li', { class: 'sev-warning' }, h('strong', {}, `${tr('Warning')}: `), w));
  for (const i of build.infos ?? []) items.push(h('li', { class: 'sev-info' }, h('strong', {}, `${tr('Info')}: `), i));
  const stats = build.surface ? wingStats(build) : null;
  clear(panes.checks).append(
    h('h3', {}, tr('Geometry checks')),
    items.length ? h('ul', { class: 'issues' }, items) : h('p', {}, tr('No errors or warnings.')),
    stats
      ? h(
          'table',
          { class: 'grid-table stats' },
          h(
            'tbody',
            {},
            [
              [tr('Span'), `${fixed(stats.span, 1)} mm`],
              [tr('Wing area'), `${fixed(stats.area / 1e4, 2)} dm²`],
              [tr('Aspect ratio'), fixed(stats.aspectRatio, 2)],
              [tr('Mean aerodynamic chord (MAC)'), `${fixed(stats.mac, 1)} mm`],
              [tr('MAC position'), tr('y {y} mm, leading edge x {x} mm', { y: fixed(stats.macY, 1), x: fixed(stats.macXLE, 1) })],
              [tr('25 % MAC (geometric reference)'), `x ${fixed(stats.macXLE + 0.25 * stats.mac, 1)} mm`],
              [tr('Root / tip chord'), `${fixed(stats.rootChord, 1)} / ${fixed(stats.tipChord, 1)} mm`],
              [
                tr('Surface'),
                tr('degree {degreeU} x {degreeV}, {rows} x {columns} control points', {
                  degreeU: plain(build.surface.degreeU),
                  degreeV: plain(build.surface.degreeV),
                  rows: whole(build.surface.points.length),
                  columns: whole(build.surface.points[0].length),
                }),
              ],
              [tr('Trailing edge'), build.closedTE ? tr('closed') : tr('open')],
            ].map(([k, v]) => h('tr', {}, h('th', { scope: 'row' }, k), h('td', {}, v))),
          ),
        )
      : '',
    h('p', { class: 'small muted' }, tr('The 25 % MAC point is a geometric reference only; it is not an aerodynamic neutral-point or centre-of-gravity calculation.')),
  );
  const s = stats
    ? tr('Span {span} mm · area {area} dm² · AR {ar} · MAC {mac} mm', {
        span: fixed(stats.span, 0),
        area: fixed(stats.area / 1e4, 2),
        ar: fixed(stats.aspectRatio, 2),
        mac: fixed(stats.mac, 1),
      })
    : '';
  statusText.textContent = build.errors.length
    ? tr('{n} error(s): {first}', { n: plain(build.errors.length), first: build.errors[0] })
    : s + (build.warnings.length ? ` · ${tr('{n} warning(s)', { n: plain(build.warnings.length) })}` : '');
  statusBar.classList.toggle('has-error', build.errors.length > 0);
}

// Sizes above their warning thresholds; a size that newly crosses its threshold (an edit, Open or
// the restored project) shows the size warning with the expected time and memory.
let largeKeys = new Set();
function noteLargeSizes() {
  const size = projectSize(store.project);
  const keys = new Set(largeSizes(size).map((q) => q.key));
  if ([...keys].some((k) => !largeKeys.has(k))) {
    // After a notice of the same change ("Added airfoil ...") or of the start (a lost autosave),
    // both stay readable, and an error notice keeps its colour.
    const showing = toast.classList.contains('show');
    message((showing ? `${toast.textContent} ` : '') + sizeWarning(store.project, size), showing && toast.classList.contains('error'));
  }
  largeKeys = keys;
}

let rebuildPending = false;
let refreshPanels = false;
// A selection alone keeps the build: the viewer, the table and the planform only mark the section.
// A display setting (mirror) redraws from the current build; the start shows the build made above.
let geometryPending = false;
let viewPending = true;
// Airfoils added or removed without a section using them: the table and Checks refresh, the wing stays.
let tablePending = false;
// The project name changed: its length enters the size warning; the wing and the panels stay.
let namePending = false;
// The project geometry changed and was built by currentBuild (Save, Export) before the next frame:
// the planform forms still render the new project there.
let formsPending = false;
function rebuild() {
  if (rebuildPending) return;
  rebuildPending = true;
  requestAnimationFrame(() => {
    rebuildPending = false;
    // Panels re-render below; remember the focused field so Tab and arrow-key editing continue.
    const focusKey = document.activeElement?.dataset?.focusKey;
    const changed = geometryPending;
    const redraw = changed || viewPending;
    const table = tablePending && !redraw;
    // A rebuild writes the size warning itself; a display redraw keeps the build and its warnings.
    const sizes = (tablePending || namePending) && !changed;
    geometryPending = false;
    viewPending = false;
    tablePending = false;
    namePending = false;
    if (changed) build = safeBuild(store.project);
    if (sizes) {
      // The size warning follows the airfoil count without a rebuild.
      // The build records its size warning: matching the text would depend on the language.
      const large = sizeWarning(store.project);
      const at = build.sizeWarning ? build.warnings.indexOf(build.sizeWarning) : -1;
      if (at >= 0 && large) build.warnings[at] = large;
      else if (at >= 0) build.warnings.splice(at, 1);
      else if (large) build.warnings.unshift(large);
      build.sizeWarning = large;
    }
    const sel = store.project.sections.find((s) => s.id === store.selection.section);
    const selV = sel && build.surface ? (sel.y - build.rootY) / (build.tipY - build.rootY || 1) : null;
    if (redraw) {
      viewer.setBuild(build.surface ? build : null, { mirror: store.project.settings.mirror !== false, selectedV: selV });
      sectionsPanel.update();
    } else if (table) {
      sectionsPanel.update();
    } else {
      viewer.setSelection(selV);
      sectionsPanel.markSelected();
    }
    // The guide point tables change only with the project geometry; a selection or a display change
    // redraws the planform canvas.
    if (changed || formsPending) planform.update();
    else planform.pz.redraw();
    formsPending = false;
    if (refreshPanels) {
      airfoils.update();
      settings.update();
      refreshPanels = false;
    }
    if (redraw || sizes) {
      renderChecks();
      noteLargeSizes();
    }
    if (focusKey) {
      const el = document.querySelector(`[data-focus-key="${CSS.escape(focusKey)}"]`);
      if (el && el !== document.activeElement) {
        el.focus();
        // Text is selected in text fields only (number fields are text fields): lists, boxes and buttons keep focus alone.
        if (el instanceof HTMLInputElement && el.type === 'text') el.select();
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
    // 'meta' (project name) changes neither the wing nor the view; 'airfoils' (an airfoil added or
    // removed that no section uses) changes the airfoil lists and the size warning only.
    if (reason === 'display') viewPending = true;
    else if (reason === 'airfoils') tablePending = true;
    else if (reason === 'meta') namePending = true;
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
  // An error notice that outlived a language switch leaves no text in the old language behind.
  message.lang = language();
  message.t = setTimeout(() => {
    toast.classList.remove('show');
    if (message.lang !== language()) toast.textContent = '';
  }, Math.max(4000, 60 * text.length));
}

async function newDesign(firstRun) {
  const p = await openWizard({ firstRun });
  if (firstRun) {
    firstRunOpen = false;
    // Skip keeps the sample wing: save it now that the user has chosen.
    if (!p) save(store.project);
  }
  if (p) {
    replaceProject(p);
    selectTab('sections');
    message(tr('Created "{name}".', { name: displayName(p.name) }));
  }
}

/** A new or opened project replaces the current one (one undo step); the views fit it once. */
function replaceProject(p) {
  store.replace(p);
  viewer.hasFitted = false;
  planform.pz.fitted = false;
}

/** The notice for a file the browser could not read. */
function cannotRead(f, err) {
  message(tr('Cannot open {name}: the browser could not read the file ({error}).', { name: f.name, error: err?.name ?? 'Error' }), true);
}

/**
 * Import from an XFLR5 file chosen with Open: read it, let the user pick the plane, the surface and
 * the airfoils in the import dialog, and replace the project (one undo step, as New does). A file that
 * cannot be read leaves the design as it is.
 */
async function importXflr5(f, kind, request) {
  const cannot = (problems) => message(tr('Cannot open {name}: {problems}', { name: f.name, problems }), true);
  let file;
  if (kind === 'xml') {
    // Open has checked the size (MAX_PROJECT_BYTES).
    let bytes;
    try {
      bytes = await f.arrayBuffer();
    } catch (err) {
      if (request === openRequest) cannotRead(f, err);
      return;
    }
    if (request !== openRequest) return;
    try {
      file = readXflr5Xml(decodeText(bytes));
    } catch (err) {
      // Any other error is one of the import: Open reports it as an internal error.
      if (!(err instanceof XflrError)) throw err;
      cannot(err.message);
      return;
    }
  } else {
    // The .xfl reader loads the file piece by piece; its own errors are XflrErrors, the browser's pass through.
    try {
      file = await readXfl(f);
    } catch (err) {
      if (request !== openRequest) return;
      // The browser rejects a failed read with a DOMException (NotReadableError, say); any other
      // error is one of the import, which Open reports as an internal error.
      if (err instanceof XflrError) cannot(err.message);
      else if (err instanceof DOMException) cannotRead(f, err);
      else throw err;
      return;
    }
    if (request !== openRequest) return;
  }
  const r = await openXflr5Dialog(file, { fileName: f.name, project: store.project, library: airfoils.library });
  if (!r) return;
  replaceProject(r.project);
  selectTab('sections');
  // The summary, the first warning and a count of the others: the report listed them all.
  const more = r.warnings.length - 1;
  const rest = more === 1 ? tr('(1 more warning in the import report.)') : more > 1 ? tr('({n} more warnings in the import report.)', { n: whole(more) }) : null;
  message([r.summary, ...r.warnings.slice(0, 1), ...(rest ? [rest] : [])].join(' '));
}

function helpDialog() {
  const dialog = h(
    'dialog',
    { class: 'modal' },
    h(
      'form',
      { method: 'dialog' },
      h('h2', {}, 'Wingdesigner'),
      h('p', {}, tr('Version {version}. Designs one half of a wing from airfoil sections and mirrors it at y = 0.', { version: VERSION })),
      h('h3', {}, tr('Workflow')),
      h(
        'ol',
        {},
        h('li', {}, tr('New: pick a design type in the wizard, or edit the sample wing.')),
        h('li', {}, tr('Open: a project file (.json), or an XFLR5 file (.xfl, .xml) to import its main wing or horizontal stabilizer.')),
        h('li', {}, tr('Airfoils: add NACA sections, library entries, or upload .dat files (checked and previewed before use).')),
        h('li', {}, tr('Sections: set span position y, leading edge x and z, chord and twist for each section.')),
        h('li', {}, tr('Planform: switch on the nose line and end line to shape the leading and trailing edge between sections.')),
        h('li', {}, tr('Export: STEP (exact NURBS solids), STL or 3MF (meshes), and the project JSON.')),
      ),
      h('h3', {}, tr('Controls')),
      h(
        'ul',
        {},
        h('li', {}, tr('3D view: drag to rotate, pinch or scroll to zoom, two fingers or right mouse button to pan.')),
        h('li', {}, tr('Planform and previews: drag points to edit, drag the background to pan, pinch or scroll to zoom, double-click to fit.')),
        h('li', {}, tr('Undo and redo: Ctrl+Z and Ctrl+Shift+Z.')),
      ),
      h('h3', {}, tr('Coordinates and units')),
      h('p', {}, tr('Millimetres. x runs chordwise towards the trailing edge, y spanwise towards the right tip, z up. Twist is positive with the leading edge up.')),
      h('h3', {}, tr('Airfoil data')),
      h(
        'p',
        {},
        tr('NACA sections are computed from their published equations. Uploaded airfoils keep their name and attribution in the project file; respect the terms of the source you downloaded them from.'),
      ),
      h(
        'p',
        {},
        // The wiki opens on its English home page: the German guide is a page of its own.
        h('a', { href: language() === 'de' ? `${REPO}/wiki/Benutzerhandbuch` : `${REPO}/wiki`, target: '_blank', rel: 'noopener' }, tr('Documentation (wiki)')),
        ' · ',
        h('a', { href: REPO, target: '_blank', rel: 'noopener' }, tr('Source code (MIT license)')),
        ' · ',
        // Written by the build (vite.config.js): this app's license and those of the bundled libraries.
        h('a', { href: 'LICENSES.txt', target: '_blank', rel: 'noopener' }, tr('Licenses of this app and its libraries')),
      ),
      h('div', { class: 'row end' }, h('button', { value: 'close', class: 'primary' }, tr('Close'))),
    ),
  );
  document.body.append(dialog);
  dialog.addEventListener('close', () => dialog.remove());
  dialog.showModal();
}

/**
 * Switch the language without a reload: store the choice, label the shell, and build the wing again
 * so its messages speak the new language; the next frame draws the view and every panel from that
 * build. The project, the selection and the undo history stay.
 */
function changeLanguage(code) {
  if (!Object.hasOwn(LANGUAGES, code) || code === language()) return;
  setLanguage(code);
  try {
    localStorage.setItem(LANGUAGE_KEY, code);
  } catch {
    // The choice then lasts until the page is closed.
  }
  document.documentElement.lang = language();
  labelShell();
  // A notice would stay in the old language until it fades. The Checks tab repeats the size warnings and the panels show
  // what a plain notice reports, so it is dropped with its text (a screen reader would still find the text in the page).
  // An error notice can be the only place that tells the user, so it stays until its timer ends.
  if (!(toast.classList.contains('error') && toast.classList.contains('show'))) {
    clearTimeout(message.t);
    toast.classList.remove('show');
    toast.textContent = '';
  }
  // Only the size warning is a text of the build that a refresh can reword: with no other warning and no
  // error, the Sections table, the size warning, the planform and the Checks are relabelled without a new loft fit.
  if (build.errors.length || build.infos?.length || build.warnings.some((w) => w !== build.sizeWarning)) geometryPending = true;
  else {
    tablePending = true;
    formsPending = true;
  }
  refreshPanels = true;
  rebuild();
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
