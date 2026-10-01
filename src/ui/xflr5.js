// XFLR5 and flow5 import dialog. Open reads the file (src/import/xfl.js, src/import/xflxml.js,
// src/import/fl5.js, src/import/fl5xml.js); here the user
// picks the plane, the surface (main wing or horizontal stabilizer) and an airfoil for every XFLR5
// airfoil name. The mapping (src/import/xflr5.js) runs again after every choice; its report, the
// planform of the candidate project and the Import button follow it.

import { buildNotes, bySeverity, checkSteps, defaultSurface, describeFile, mapSections, mapXflr5, planeSurfaces, programOf, readAirfoilUpload, refusedUpload, sectionsText } from '../import/xflr5.js';
import { buildWing } from '../geom/wing.js';
import { wingStats } from '../geom/stats.js';
import { bundledLibrary } from '../airfoil/bundled.js';
import { DEFAULT_SETTINGS, LIMITS } from '../model/project.js';
import { LAZY_OPTIONS, WARN, displayName, largeSizes, projectSize, sizeWarning } from '../model/budget.js';
import { AIRFOIL_ACCEPT, previewAirfoil, readAirfoilFile, severityLabel } from './airfoils.js';
import { drawPlanform } from './wizard.js';
import { PanZoomCanvas } from './panzoom.js';
import { clear, h } from './dom.js';
import { count, fixed, plain, tr } from '../i18n/index.js';

/** Airfoil rows shown; with more names (a damaged file, say), the rows to resolve come first. */
const MAX_ROWS = WARN.airfoils;

/** Report lines shown; the mapping lists one line per airfoil name, and a file can hold 10,000. */
const MAX_REPORT_LINES = 200;

/** Longest run (ms) of airfoil checks before the page gets a turn (clicks, Escape, drawing). */
const SLICE_MS = 50;

/** A turn for the page: the next task. */
const nextTask = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Read an airfoil file chosen in the dialog, checked as in the Airfoils tab. */
async function readUpload(file) {
  const read = await readAirfoilFile(file);
  return read.problem ? refusedUpload(file.name, read.problem) : readAirfoilUpload(read.text, file.name);
}

/**
 * The rows of the airfoil table with their index: all of them up to MAX_ROWS, else MAX_ROWS rows in
 * section order, first those without a usable airfoil and those the user picked (a pick stays in
 * view); none beyond the limits of a project (the report says so, and no choice can make the import
 * possible).
 */
function shownRows(rows) {
  const all = rows.map((row, i) => ({ row, i }));
  if (rows.length > LIMITS.maxAirfoils) return [];
  if (rows.length <= MAX_ROWS) return all;
  const first = (r) => !r.row.ok || r.row.picked;
  const keep = new Set([...all.filter(first), ...all.filter((r) => !first(r))].slice(0, MAX_ROWS).map((r) => r.i));
  return all.filter((r) => keep.has(r.i));
}

/** Sections of the wing as straight panels ({ y, xLE, chord }), for the planform without a build. */
const straight = (sections) => sections.map((q) => ({ y: q.y, xLE: q.x, chord: q.chord }));

/**
 * Opens the import dialog for a read XFLR5 or flow5 file.
 * @param {object} file the file of readXfl, readXflr5Xml, readFl5 or readFlow5Xml
 * @param {{fileName?: string, project?: object|null, library?: object[]}} [options]
 *   project: the current project, whose airfoils are offered; library: bundled library entries
 * @returns {Promise<{project: object, summary: string, warnings: string[]}|null>} the new project, the
 *   toast line and the warnings of the report on this import; null when cancelled
 */
export function openXflr5Dialog(file, { fileName = '', project = null, library = bundledLibrary() } = {}) {
  return new Promise((resolve, reject) => {
    let dialog = null;
    // An error of the first mapping, which runs after the dialog has opened.
    let failed = null;
    try {
      // The first plane with a wing to import (a flow5 plane of a triangle mesh has none).
      let plane = Math.max(0, file.planes.findIndex((_, i) => planeSurfaces(file, i).surfaces.some((s) => s.available)));
      let surface = defaultSurface(file, plane);
      // The surface the user chose: a plane without it falls back to its default, and the choice
      // comes back with a plane that has it.
      let wanted = surface;
      // Option key picked per XFLR5 airfoil name; no prototype, as a name can be any text.
      const choices = Object.create(null);
      const uploads = [];
      // Uploads still being read: Import waits for them, so that the chosen file is the one imported.
      let uploading = 0;
      // The name field follows the plane and the surface until the user types a name.
      let nameEdited = false;
      let result = null;
      let build = null;
      // The planform drawn: the built stations, or the straight panels of the mapped sections.
      let outline = [];
      let report = [];
      // The row whose Upload button opened the file chooser.
      let uploadRow = null;
      // False while airfoil checks run: a choice meanwhile is kept for the mapping after them.
      let ready = false;
      // Runs the checks of another plane or surface (set once the dialog is drawn).
      let recheck = null;
      /** A change of plane or surface: while checks run, they follow it; afterwards the new wing is checked. */
      const changed = () => {
        if (ready) recheck();
      };

      const program = programOf(file);
      const map = () =>
        mapXflr5(file, { plane, surface, fileName, project, library, uploads, choices, name: nameEdited ? nameInput.value.trim() : undefined });

      const nameInput = h('input', {
        type: 'text',
        maxLength: LIMITS.maxName,
        // An emptied field follows the plane and the surface again.
        oninput: () => {
          nameEdited = nameInput.value.trim() !== '';
        },
      });
      const surfaceBox = h('fieldset', { class: 'xflr5-surfaces' });
      const airfoilBox = h('div', { class: 'table-scroll' });
      const reportBox = h('ul', { class: 'issues' });
      const stats = h('p', { class: 'small', 'aria-live': 'polite' });
      // What became of an upload, for screen readers: the table, the select and the report change silently.
      const announce = h('p', { class: 'visually-hidden', 'aria-live': 'polite' });
      const canvas = h('canvas', { class: 'wizard-canvas', role: 'img', 'aria-label': tr('Planform preview') });
      const importBtn = h('button', { value: 'import', class: 'primary', disabled: true }, tr('Import'));
      const fileInput = h('input', {
        type: 'file',
        accept: AIRFOIL_ACCEPT,
        style: { display: 'none' },
        onchange: async (e) => {
          const f = e.target.files[0];
          const row = uploadRow;
          e.target.value = '';
          if (!f) return;
          uploading++;
          importBtn.disabled = true;
          let u;
          try {
            u = await readUpload(f);
          } finally {
            uploading--;
          }
          if (!dialog.open) return;
          uploads.push(u);
          // The upload is the choice of the row that asked for it; other rows find it by its name.
          if (row !== null) choices[row] = `upload:${uploads.length - 1}`;
          refresh();
          const uploaded = displayName(u.fileName);
          const label = result.rows.find((r) => r.name === row)?.label;
          announce.textContent = !u.ok
            ? u.refused
              ? u.problem
              : tr('{file} is not usable: {problem}', { file: uploaded, problem: u.problem })
            : label === undefined
              ? ''
              : tr('{file} is used for "{name}".', { file: uploaded, name: label });
        },
      });

      // Several .dat files at once: each row finds its file by name (the name in the file, else the file name).
      const filesInput = h('input', {
        type: 'file',
        accept: AIRFOIL_ACCEPT,
        multiple: true,
        style: { display: 'none' },
        onchange: async (e) => {
          const files = [...e.target.files];
          e.target.value = '';
          if (!files.length) return;
          uploading++;
          importBtn.disabled = true;
          const read = [];
          try {
            for (const f of files) read.push(await readUpload(f));
          } finally {
            uploading--;
          }
          if (!dialog.open) return;
          const first = uploads.length;
          uploads.push(...read);
          refresh();
          const keys = new Set(read.map((u, i) => `upload:${first + i}`));
          const used = result.rows.filter((row) => keys.has(row.key)).length;
          announce.textContent = tr('{files} files uploaded; {rows} airfoil names use them.', { files: count(read.length), rows: count(used) });
        },
      });

      const planeSelect =
        file.planes.length > 1
          ? h(
              'select',
              {
                onchange: (e) => {
                  plane = Number(e.target.value);
                  surface = planeSurfaces(file, plane).surfaces.some((s) => s.key === wanted && s.available) ? wanted : defaultSurface(file, plane);
                  renderSurfaces();
                  changed();
                },
              },
              file.planes.map((p, i) => h('option', { value: String(i) }, p.name.trim() ? displayName(p.name) : tr('Plane {n}', { n: plain(i + 1) }))),
            )
          : null;

      const renderSurfaces = () => {
        const { surfaces } = planeSurfaces(file, plane);
        clear(surfaceBox).append(
          h('legend', {}, tr('Surface to import')),
          ...surfaces.map((s) =>
            h(
              'label',
              { class: 'xflr5-surface' },
              h('input', {
                type: 'radio',
                name: 'xflr5-surface',
                value: s.key,
                checked: s.key === surface,
                disabled: !s.available,
                dataset: { focusKey: `surface-${s.key}` },
                onchange: () => {
                  surface = s.key;
                  wanted = s.key;
                  changed();
                },
              }),
              // The space keeps label and detail apart in the radio's accessible name.
              h('span', {}, h('strong', {}, s.label), ' ', h('span', { class: 'small muted' }, s.available ? s.detail : s.reason)),
            ),
          ),
        );
      };

      /**
       * The select of one airfoil row: the automatic source, then the NACA options of the rows (the
       * row's own first) and every other source. With many rows and sources, a select holds only its
       * choice until it is used (LAZY_OPTIONS, as in the Sections table).
       */
      const useSelect = (row, i, nacas, lazy, byKey) => {
        // The automatic choice names the airfoil it found ("Automatic: Library: Clark Y").
        const auto = () =>
          h('option', { value: '', selected: !row.picked }, row.found === 'missing' ? tr('Pick an airfoil') : tr('Automatic: {source}', { source: byKey.get(row.auto)?.label ?? row.foundLabel }));
        const options = () => {
          const first = row.naca ? [row.naca, ...nacas.filter((o) => o.key !== row.naca.key)] : nacas;
          const keys = new Set(first.map((o) => o.key));
          return [...first, ...result.options.filter((o) => !keys.has(o.key))];
        };
        const option = (o) => h('option', { value: o.key, selected: row.picked && o.key === row.key }, o.label);
        const fill = (e) => {
          const el = e.currentTarget;
          if (el.dataset.filled) return;
          const chosen = el.value;
          // One node for all options: spread as arguments, 200,000 of them overflow the stack.
          const list = document.createDocumentFragment();
          list.append(auto());
          for (const o of options()) list.append(option(o));
          el.replaceChildren(list);
          el.value = chosen;
          el.dataset.filled = 'true';
        };
        const picked = () => (row.picked && byKey.has(row.key) ? [byKey.get(row.key)] : []);
        return h(
          'select',
          {
            'aria-label': tr('Airfoil for "{name}"', { name: row.label }),
            dataset: { focusKey: `use-${i}` },
            onchange: (e) => {
              if (e.target.value === '') delete choices[row.name];
              else choices[row.name] = e.target.value;
              refresh();
            },
            ...(lazy ? { onfocus: fill, onpointerdown: fill } : {}),
          },
          auto(),
          (lazy ? picked() : options()).map(option),
        );
      };

      /** The Found cell: the automatic source, or the state of the user's pick. */
      const foundCell = (row) => {
        const text = row.picked ? (row.ok ? tr('Picked') : tr('Not usable')) : row.foundLabel;
        const cls = !row.ok ? 'sev-error' : !row.picked && row.found === 'loose' ? 'sev-warning' : '';
        return h('td', { class: cls }, text);
      };

      const renderAirfoils = () => {
        const parametrization = result.project?.settings?.parametrization ?? DEFAULT_SETTINGS.parametrization;
        const view = (row) =>
          previewAirfoil(
            { name: row.airfoil.name, points: row.airfoil.points, source: row.airfoil.source, issues: row.issues, checked: { ok: row.ok, points: row.airfoil.points, issues: [] } },
            { title: displayName(row.airfoil.name), allowEdit: false, parametrization },
          );
        const shown = shownRows(result.rows);
        if (!shown.length) {
          clear(airfoilBox);
          return;
        }
        // The NACA options of the rows, offered in every row: "NACA0014_Flap" finds NACA 0014 as well.
        const nacas = [...new Map(shown.filter(({ row }) => row.naca).map(({ row }) => [row.naca.key, row.naca])).values()];
        const byKey = new Map([...result.options, ...nacas].map((o) => [o.key, o]));
        const lazy = shown.length * (result.options.length + nacas.length) > LAZY_OPTIONS;
        const hidden = result.rows.length - shown.length;
        clear(airfoilBox).append(
          h(
            'table',
            { class: 'grid-table xflr5-airfoils' },
            h(
              'thead',
              {},
              h('tr', {}, h('th', {}, tr('{program} airfoil', { program })), h('th', {}, tr('Found')), h('th', {}, tr('Airfoil used')), h('th', {}, h('span', { class: 'visually-hidden' }, tr('Actions')))),
            ),
            h(
              'tbody',
              {},
              shown.map(({ row, i }) =>
                h(
                  'tr',
                  {},
                  h('th', { scope: 'row', class: 'xflr5-name' }, row.label, ' ', h('div', { class: 'small muted' }, sectionsText(row.sections))),
                  foundCell(row),
                  h('td', { class: 'xflr5-use' }, useSelect(row, i, nacas, lazy, byKey)),
                  h(
                    'td',
                    { class: 'xflr5-actions' },
                    h(
                      'button',
                      {
                        type: 'button',
                        // The accessible name starts with the visible text (voice control).
                        'aria-label': tr('Upload .dat for "{name}"', { name: row.label }),
                        dataset: { focusKey: `upload-${i}` },
                        onclick: () => {
                          uploadRow = row.name;
                          fileInput.click();
                        },
                      },
                      tr('Upload .dat'),
                    ),
                    h(
                      'button',
                      { type: 'button', class: 'icon', 'aria-label': tr('View the airfoil for "{name}"', { name: row.label }), disabled: !row.airfoil, dataset: { focusKey: `view-${i}` }, onclick: () => view(row) },
                      tr('View'),
                    ),
                  ),
                ),
              ),
            ),
          ),
        );
        // Element.append would write a null as the text "null".
        if (hidden > 0) airfoilBox.append(h('p', { class: 'small muted' }, tr('{count} more airfoil names are not listed; uploaded .dat files are matched to them by name.', { count: count(hidden) })));
      };

      const refresh = () => {
        if (!ready) return;
        // The rows are made again: a focused control of the dialog gets its focus back afterwards.
        const focusKey = dialog.contains(document.activeElement) ? document.activeElement.dataset.focusKey : undefined;
        build = null;
        outline = [];
        let s = null;
        try {
          result = map();
        } catch (e) {
          // A failure of the mapping is reported, and Import stays off.
          result = { rows: [], options: [], missing: 0, report: [{ severity: 'error', text: tr('Internal error: {message}', { message: e.message }) }], project: null, name: result?.name ?? '' };
        }
        if (result.project) {
          // Build errors and warnings are shown but do not block the import, as with Open. A project
          // beyond the size warnings is not built here (Import builds it once): its warning names the
          // time, and the planform shows the straight panels that spanwise 'linear' builds. A long
          // name alone costs no build time.
          const size = projectSize(result.project);
          if (largeSizes(size).some((q) => q.key !== 'longestName')) {
            build = { errors: [], warnings: [sizeWarning(result.project, size)], stations: straight(result.project.sections) };
          } else {
            try {
              build = buildWing(result.project);
              if (build.surface) s = wingStats(build);
            } catch (e) {
              build = { errors: [tr('Internal error: {message}', { message: e.message })], warnings: [], stations: [] };
            }
          }
          outline = build.stations;
        } else if (result.wing) {
          // Airfoils still missing: the planform of the mapped sections shows which wing this is.
          outline = straight(mapSections(result.wing, file.lengthUnit, programOf(file)).sections);
        }
        report = [...result.report, ...(build ? buildNotes(build) : [])].sort(bySeverity);
        if (!nameEdited) nameInput.value = result.name;
        renderAirfoils();
        const lines = report.slice(0, MAX_REPORT_LINES).map((r) => h('li', { class: `sev-${r.severity}` }, h('strong', {}, `${severityLabel(r.severity)}: `), r.text));
        if (report.length > MAX_REPORT_LINES) lines.push(h('li', {}, tr('Further report lines not shown: {count}.', { count: count(report.length - MAX_REPORT_LINES) })));
        clear(reportBox).append(...lines);
        importBtn.disabled = !result.project || uploading > 0;
        importBtn.textContent =
          result.missing === 0 ? tr('Import') : result.missing === 1 ? tr('Import (1 airfoil missing)') : tr('Import ({n} airfoils missing)', { n: count(result.missing) });
        stats.textContent = s
          ? tr('Span {span} mm · area {area} dm² · AR {ar} · MAC {mac} mm', { span: fixed(s.span, 0), area: fixed(s.area / 1e4, 2), ar: fixed(s.aspectRatio, 2), mac: fixed(s.mac, 1) })
          : '';
        if (focusKey) dialog.querySelector(`[data-focus-key="${CSS.escape(focusKey)}"]`)?.focus();
        pz.fitted = false;
        pz.redraw();
      };

      // The planform of the candidate project, both halves.
      const pz = new PanZoomCanvas(canvas, {
        bounds: () => {
          if (!outline.length) return [-1, -1, 1, 1];
          const b = Math.max(...outline.map((q) => Math.abs(q.y)), 1);
          const xs = outline.flatMap((q) => [q.xLE, q.xLE + q.chord]);
          return [-b, -Math.max(...xs), b, -Math.min(...xs)];
        },
        draw: (ctx, view, w, hgt) => drawPlanform(ctx, view, w, hgt, outline),
      });
      // The preview is for looking only: a wheel turn or a vertical swipe over it scrolls the dialog.
      // Ctrl+wheel (and a pinch on a touchpad) still zooms.
      canvas.style.touchAction = 'pan-y';
      canvas.addEventListener(
        'wheel',
        (e) => {
          if (!e.ctrlKey) e.stopImmediatePropagation();
        },
        { capture: true, passive: true },
      );

      const source = describeFile(file);
      dialog = h(
        'dialog',
        { class: 'modal wide xflr5' },
        h(
          'form',
          {
            method: 'dialog',
            // Enter on a surface radio would press Import before the airfoils and the report are seen;
            // Enter in the name field still imports.
            onkeydown: (e) => {
              if (e.key === 'Enter' && e.target.type === 'radio') e.preventDefault();
            },
          },
          h('h2', {}, tr('Import from {program}', { program })),
          h('p', { class: 'small muted xflr5-source' }, fileName ? `${displayName(fileName)} · ${source}` : source),
          planeSelect ? h('label', { class: 'field' }, tr('Plane'), planeSelect) : null,
          surfaceBox,
          h('h3', {}, tr('Airfoils')),
          h(
            'div',
            { class: 'row' },
            h('button', { type: 'button', onclick: () => filesInput.click() }, tr('Upload .dat files…')),
            h('span', { class: 'small muted' }, tr('Each airfoil name takes the file whose airfoil or file name matches it.')),
          ),
          airfoilBox,
          fileInput,
          filesInput,
          h(
            'div',
            { class: 'wizard-body' },
            h('div', {}, h('div', { class: 'canvas-wrap' }, canvas), stats),
            h('div', {}, h('label', { class: 'field' }, tr('Project name'), nameInput), h('h3', {}, tr('Report')), reportBox),
          ),
          h('div', { class: 'row end' }, h('button', { type: 'button', onclick: () => dialog.close('cancel') }, tr('Cancel')), importBtn),
          announce,
        ),
      );
      document.body.append(dialog);
      dialog.addEventListener('close', () => {
        pz.destroy();
        dialog.remove();
        if (failed) return reject(failed);
        if (dialog.returnValue !== 'import' || !result?.project) return resolve(null);
        // The typed name enters the project; everything else is as shown.
        const final = map();
        if (!final.project) return resolve(null);
        // The reader's warnings concern the whole file, possibly another plane: the report shows them,
        // the toast of this import does not.
        resolve({ project: final.project, summary: final.summary, warnings: report.filter((r) => r.severity === 'warning' && !r.reader).map((r) => r.text) });
      });
      // The first mapping checks and fits every airfoil, which can take seconds, a minute for 10,000
      // airfoils: the dialog is drawn first, with Import off, and the checks run in slices, so that
      // Cancel, Escape and scrolling work meanwhile. The mapping then finds them in the caches.
      const progress = h('li', { class: 'sev-info' }, tr('Checking the airfoils …'));
      reportBox.append(progress);
      renderSurfaces();
      dialog.showModal();
      // Keyboard focus starts on the first choice, not in the name field, where Enter would import
      // before the airfoils and the report are seen.
      (planeSelect ?? surfaceBox.querySelector('input[type=radio]:checked:not(:disabled)'))?.focus();
      /** Runs the checks of the chosen plane and surface (again after a change meanwhile); false when the dialog closed. */
      const checkAll = async () => {
        await new Promise((r) => requestAnimationFrame(() => r()));
        for (let at = null; at !== `${plane}/${surface}`; ) {
          at = `${plane}/${surface}`;
          let last = performance.now();
          for (const { done, total } of checkSteps(file, { plane, surface, fileName, project, library, uploads })) {
            if (performance.now() - last < SLICE_MS) continue;
            progress.textContent = tr('Checking the airfoils … {n} of {total}', { n: count(done), total: count(total) });
            await nextTask();
            if (!dialog.open) return false;
            if (at !== `${plane}/${surface}`) break;
            last = performance.now();
          }
        }
        await nextTask();
        return dialog.open;
      };
      /** Open reports an error of the checks; the dialog goes. */
      const fail = (e) => {
        failed = e;
        dialog.close();
      };
      /**
       * Another plane or surface once the dialog is ready: its airfoils not checked yet (another wing,
       * up to 10,000 airfoils) are checked in slices as the first ones, with Import off. Checks that
       * are done take no time, and the dialog follows at once.
       */
      recheck = () => {
        const steps = checkSteps(file, { plane, surface, fileName, project, library, uploads });
        const start = performance.now();
        let step = steps.next();
        while (!step.done && performance.now() - start < SLICE_MS) step = steps.next();
        if (step.done) return refresh();
        ready = false;
        importBtn.disabled = true;
        progress.textContent = tr('Checking the airfoils …');
        clear(reportBox).append(progress);
        // Nothing of the previous wing stays, as during the first checks: a pick in its table would
        // go to a name of that wing. refresh() fills table, planform, stats and name again.
        clear(airfoilBox);
        stats.textContent = '';
        if (!nameEdited) nameInput.value = '';
        build = null;
        outline = [];
        pz.redraw();
        checkAll()
          .then((open) => {
            if (!open) return;
            ready = true;
            refresh();
          })
          .catch(fail);
      };
      checkAll()
        .then((open) => {
          if (!open) return;
          ready = true;
          refresh();
          pz.fit();
        })
        .catch(fail);
    } catch (e) {
      // A dialog that failed while it was set up must not stay in the page; Open reports the error.
      dialog?.remove();
      throw e;
    }
  });
}
