// Export dialog: STEP, STL, 3MF and the project JSON.

import { wingToStep } from '../export/step.js';
import { UP_AXES } from '../export/axes.js';
import { MeshPrecisionError } from '../export/precision.js';
import { meshToStl } from '../export/stl.js';
import { meshesTo3mf } from '../export/threemf.js';
import { concatMeshes, exportMeshes, exportTriangles } from '../geom/mesh.js';
import { WARN, exportCost, formatMegabytes, formatSeconds, stepPoints } from '../model/budget.js';
import { omittedNote, projectFileText } from '../model/io.js';
import { LIMITS, cloneProject } from '../model/project.js';
import { download, h, slugFile } from './dom.js';
import { count, fixed, plain, tr } from '../i18n/index.js';

/** Refinement of the display grid in v: cubic lofts are refined 3 times, straight panels once, times the density. */
const vRefine = (build, dens) => (build?.surface?.degreeV === 1 ? 1 : 3) * dens;

/** Browser storage key of the up axis last used for an export: a choice of the user's CAD program, not of the project. */
export const UP_AXIS_KEY = 'wingdesigner.upAxis';

/** The stored up axis, 'z' when there is none or storage is unavailable. */
function storedUpAxis() {
  try {
    const up = localStorage.getItem(UP_AXIS_KEY);
    return UP_AXES.includes(up) ? up : 'z';
  } catch {
    return 'z';
  }
}

/** The axes of an export: the project JSON keeps the axes of the app. */
const axesText = (fmt, up) =>
  fmt !== 'json' && up === 'y'
    ? tr('Units: millimetres. Axes: x chordwise towards the trailing edge, y up, z spanwise towards the left tip.')
    : tr('Units: millimetres. Axes: x chordwise towards the trailing edge, y spanwise, z up.');

/**
 * Size, expected time, memory and file size of the chosen export (triangles for STL and 3MF, control
 * points for STEP) as { text, className, over }, or null for the project JSON and a build without
 * surface. Above LIMITS.maxExportTriangles or LIMITS.maxStepPoints (a desktop browser tab runs out of
 * memory) `over` is true and Download is off.
 */
export function exportSizeNote(build, { fmt, half, dens }) {
  if (!build?.surface) return null;
  if (fmt === 'step') {
    // STEP keeps every entity in memory and writes one string: above LIMITS.maxStepPoints Download is off.
    const n = stepPoints(build, half);
    const c = exportCost(n, 'step');
    const over = n > LIMITS.maxStepPoints;
    const size = formatMegabytes(c.fileMB);
    const what = n < 1e6 ? tr('{n} control points, file {size}', { n: count(n), size }) : tr('{n} million control points, file {size}', { n: fixed(n / 1e6, 1), size });
    const className = `small${over ? ' sev-error' : n > WARN.stepPoints ? ' sev-warning' : ' muted'}`;
    const text = over
      ? tr('{what}: above the limit of {limit} million control points, where the file takes more memory than a desktop browser tab holds. Use one half, or fewer chord samples or panel stations.', { what, limit: plain(LIMITS.maxStepPoints / 1e6) })
      : n > WARN.stepPoints
        ? tr('{what}. The export takes {time} and {memory} of browser memory.', { what, time: formatSeconds(c.seconds), memory: formatMegabytes(c.megabytes) })
        : `${what}.`;
    return { text, className, over };
  }
  if (fmt === 'stl' || fmt === '3mf') {
    const n = exportTriangles(build, half, { uRefine: dens, vRefine: vRefine(build, dens) });
    const c = exportCost(n, fmt);
    const over = n > LIMITS.maxExportTriangles;
    const what = tr('{n} million triangles, file {size}', { n: fixed(n / 1e6, n < 1e5 ? 2 : 1), size: formatMegabytes(c.fileMB) });
    const className = `small${over ? ' sev-error' : n > WARN.exportTriangles ? ' sev-warning' : ' muted'}`;
    const text = over
      ? tr('{what}: above the limit of {limit} million triangles, where a desktop browser tab runs out of memory. Use Normal density, one half, or fewer chord samples or panel stations.', { what, limit: plain(LIMITS.maxExportTriangles / 1e6) })
      : n > WARN.exportTriangles
        ? tr('{what}. The export takes {time} and {memory} of browser memory.', { what, time: formatSeconds(c.seconds), memory: formatMegabytes(c.megabytes) })
        : `${what}.`;
    return { text, className, over };
  }
  return null;
}

export function exportDialog(store, getBuild, version, notify = () => {}) {
  // Project and build are captured together when the dialog opens; every format writes that state.
  const project = cloneProject(store.project);
  const build = getBuild();
  const name = project.name || 'wing';
  const blocked = !build?.surface;
  const radio = (group, value, label, checked, disabled = false) =>
    h('label', { class: 'check' }, h('input', { type: 'radio', name: group, value, checked, disabled }), label);
  const sizeNote = h('p', { class: 'small', 'aria-live': 'polite' });
  const downloadBtn = h('button', { value: 'ok', class: 'primary' }, tr('Download'));
  const choice = (form) => ({ fmt: form.fmt.value, half: form.half.value, dens: Number(form.dens.value), up: form.up.value });
  const up = storedUpAxis();
  const axesNote = h('p', { class: 'small muted' });
  const refresh = () => {
    const current = choice(dialog.querySelector('form').elements);
    axesNote.textContent = axesText(current.fmt, current.up);
    const note = exportSizeNote(build, current);
    sizeNote.hidden = !note;
    if (note) {
      sizeNote.className = note.className;
      sizeNote.textContent = note.text;
    }
    downloadBtn.disabled = note?.over ?? false;
  };
  const dialog = h(
    'dialog',
    { class: 'modal' },
    h(
      'form',
      { method: 'dialog', onchange: () => refresh() },
      h('h2', {}, tr('Export')),
      blocked ? h('p', { class: 'sev-error' }, tr('The wing has errors; only the project JSON can be exported.')) : null,
      h(
        'fieldset',
        {},
        h('legend', {}, tr('Format')),
        radio('fmt', 'step', tr('STEP (AP214, exact NURBS solids)'), !blocked, blocked),
        radio('fmt', 'stl', tr('STL (binary triangle mesh)'), false, blocked),
        radio('fmt', '3mf', tr('3MF (triangle mesh for 3D printing)'), false, blocked),
        radio('fmt', 'json', tr('Project JSON (airfoils, sections, curves, settings, NURBS data)'), blocked),
      ),
      h(
        'fieldset',
        {},
        h('legend', {}, tr('Wing halves')),
        radio('half', 'halves', tr('Both halves as separate bodies'), true),
        radio('half', 'merged', tr('Full wing as one body (mesh formats, root at y = 0)'), false),
        radio('half', 'right', tr('Right half only'), false),
      ),
      h('fieldset', {}, h('legend', {}, tr('Mesh density (STL, 3MF)')), radio('dens', '1', tr('Normal'), true), radio('dens', '2', tr('Fine (4x triangles)'), false)),
      h(
        'fieldset',
        {},
        h('legend', {}, tr('Up axis (STEP, STL, 3MF)')),
        radio('up', 'z', tr('Z up'), up === 'z'),
        radio('up', 'y', tr('Y up (Fusion 360 set to Y up, SolidWorks)'), up === 'y'),
      ),
      sizeNote,
      axesNote,
      h('div', { class: 'row end' }, h('button', { type: 'button', onclick: () => dialog.close('cancel') }, tr('Cancel')), downloadBtn),
    ),
  );
  refresh();
  document.body.append(dialog);
  dialog.addEventListener('close', () => {
    const data = new FormData(dialog.querySelector('form'));
    const ok = dialog.returnValue === 'ok';
    dialog.remove();
    if (!ok) return;
    const fmt = data.get('fmt');
    const half = data.get('half');
    const dens = Number(data.get('dens'));
    const upAxis = data.get('up');
    if (fmt !== 'json') {
      try {
        localStorage.setItem(UP_AXIS_KEY, upAxis);
      } catch {
        // Without storage the dialog starts with Z up next time.
      }
    }
    try {
      if (fmt === 'json') {
        const file = projectFileText(project, build, { generatorVersion: version });
        download(slugFile(name, 'json'), file.text, 'application/json');
        if (file.omitted) notify(omittedNote());
        return;
      }
      if (blocked) return;
      if (fmt === 'step') {
        download(slugFile(name, 'step'), wingToStep(build, { mirror: half !== 'right', name, up: upAxis }), 'application/step');
        return;
      }
      const meshes = exportMeshes(build, half, { uRefine: dens, vRefine: vRefine(build, dens), up: upAxis });
      if (fmt === 'stl') {
        download(slugFile(name, 'stl'), meshToStl(concatMeshes(meshes.map((m) => m.mesh)), `Wingdesigner ${name}`), 'model/stl');
      } else {
        download(slugFile(name, '3mf'), meshesTo3mf(meshes, { title: name }), 'model/3mf');
      }
    } catch (e) {
      if (e instanceof MeshPrecisionError) {
        notify(e.message, true);
        return;
      }
      // Out-of-memory and size limits of the browser end here, e.g. very dense meshes; a project
      // file above the Open limit ends here too, where mesh settings do not help.
      const remedy =
        fmt === 'json' ? '' : ` ${fmt === 'step' ? tr('Use one half, or fewer chord samples and panel stations.') : tr('Use Normal mesh density or fewer chord samples and panel stations.')}`;
      notify(`${tr('Export failed: {message}.', { message: e.message })}${remedy}`, true);
    }
  });
  dialog.showModal();
}
