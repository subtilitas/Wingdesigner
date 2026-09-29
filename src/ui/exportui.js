// Export dialog: STEP, STL, 3MF and the project JSON.

import { wingToStep } from '../export/step.js';
import { MeshPrecisionError } from '../export/precision.js';
import { meshToStl } from '../export/stl.js';
import { meshesTo3mf } from '../export/threemf.js';
import { concatMeshes, exportMeshes, exportTriangles } from '../geom/mesh.js';
import { WARN, exportCost, formatMegabytes, formatSeconds, stepPoints } from '../model/budget.js';
import { OMITTED_NOTE, projectFileText } from '../model/io.js';
import { LIMITS, cloneProject } from '../model/project.js';
import { download, h, slugFile } from './dom.js';

export function exportDialog(store, getBuild, version, notify = () => {}) {
  // Project and build are captured together when the dialog opens; every format writes that state.
  const project = cloneProject(store.project);
  const build = getBuild();
  const name = project.name || 'wing';
  const blocked = !build?.surface;
  const vRefine = (dens) => (build?.surface?.degreeV === 1 ? 1 : 3) * dens;
  const radio = (group, value, label, checked, disabled = false) =>
    h('label', { class: 'check' }, h('input', { type: 'radio', name: group, value, checked, disabled }), label);
  // Size, expected time, memory and file size of the chosen export (triangles for STL and 3MF,
  // control points for STEP); above LIMITS.maxExportTriangles or LIMITS.maxStepPoints (a desktop
  // browser tab runs out of memory) Download is off.
  const sizeNote = h('p', { class: 'small', 'aria-live': 'polite' });
  const downloadBtn = h('button', { value: 'ok', class: 'primary' }, 'Download');
  const choice = (form) => ({ fmt: form.fmt.value, half: form.half.value, dens: Number(form.dens.value) });
  const refresh = () => {
    const { fmt, half, dens } = choice(dialog.querySelector('form').elements);
    const mesh = !blocked && (fmt === 'stl' || fmt === '3mf');
    const step = !blocked && fmt === 'step';
    let over = false;
    sizeNote.hidden = !mesh && !step;
    if (step) {
      // STEP keeps every entity in memory and writes one string: above LIMITS.maxStepPoints Download is off.
      const n = stepPoints(build, half);
      const c = exportCost(n, 'step');
      over = n > LIMITS.maxStepPoints;
      const what = `${(n / 1e6).toFixed(n < 1e5 ? 2 : 1)} million control points, file ${formatMegabytes(c.fileMB)}`;
      sizeNote.className = `small${over ? ' sev-error' : n > WARN.stepPoints ? ' sev-warning' : ' muted'}`;
      sizeNote.textContent = over
        ? `${what}: above the limit of ${LIMITS.maxStepPoints / 1e6} million control points, where the file takes more memory than a desktop browser tab holds. Use one half, or fewer chord samples or panel stations.`
        : n > WARN.stepPoints
          ? `${what}. The export takes ${formatSeconds(c.seconds)} and ${formatMegabytes(c.megabytes)} of browser memory.`
          : `${what}.`;
    }
    if (mesh) {
      const n = exportTriangles(build, half, { uRefine: dens, vRefine: vRefine(dens) });
      const c = exportCost(n, fmt);
      over = n > LIMITS.maxExportTriangles;
      const what = `${(n / 1e6).toFixed(n < 1e5 ? 2 : 1)} million triangles, file ${formatMegabytes(c.fileMB)}`;
      sizeNote.className = `small${over ? ' sev-error' : n > WARN.exportTriangles ? ' sev-warning' : ' muted'}`;
      sizeNote.textContent = over
        ? `${what}: above the limit of ${LIMITS.maxExportTriangles / 1e6} million triangles, where a desktop browser tab runs out of memory. Use Normal density, one half, or fewer chord samples or panel stations.`
        : n > WARN.exportTriangles
          ? `${what}. The export takes ${formatSeconds(c.seconds)} and ${formatMegabytes(c.megabytes)} of browser memory.`
          : `${what}.`;
    }
    downloadBtn.disabled = over;
  };
  const dialog = h(
    'dialog',
    { class: 'modal' },
    h(
      'form',
      { method: 'dialog', onchange: () => refresh() },
      h('h2', {}, 'Export'),
      blocked ? h('p', { class: 'sev-error' }, 'The wing has errors; only the project JSON can be exported.') : null,
      h(
        'fieldset',
        {},
        h('legend', {}, 'Format'),
        radio('fmt', 'step', 'STEP (AP214, exact NURBS solids)', !blocked, blocked),
        radio('fmt', 'stl', 'STL (binary triangle mesh)', false, blocked),
        radio('fmt', '3mf', '3MF (triangle mesh for 3D printing)', false, blocked),
        radio('fmt', 'json', 'Project JSON (airfoils, sections, curves, settings, NURBS data)', blocked),
      ),
      h(
        'fieldset',
        {},
        h('legend', {}, 'Wing halves'),
        radio('half', 'halves', 'Both halves as separate bodies', true),
        radio('half', 'merged', 'Full wing as one body (mesh formats, root at y = 0)', false),
        radio('half', 'right', 'Right half only', false),
      ),
      h('fieldset', {}, h('legend', {}, 'Mesh density (STL, 3MF)'), radio('dens', '1', 'Normal', true), radio('dens', '2', 'Fine (4x triangles)', false)),
      sizeNote,
      h('p', { class: 'small muted' }, 'Units: millimetres. Axes: x chordwise towards the trailing edge, y spanwise, z up.'),
      h('div', { class: 'row end' }, h('button', { type: 'button', onclick: () => dialog.close('cancel') }, 'Cancel'), downloadBtn),
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
    try {
      if (fmt === 'json') {
        const file = projectFileText(project, build, { generatorVersion: version });
        download(slugFile(name, 'json'), file.text, 'application/json');
        if (file.omitted) notify(OMITTED_NOTE);
        return;
      }
      if (blocked) return;
      if (fmt === 'step') {
        download(slugFile(name, 'step'), wingToStep(build, { mirror: half !== 'right', name }), 'application/step');
        return;
      }
      const meshes = exportMeshes(build, half, { uRefine: dens, vRefine: vRefine(dens) });
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
      // Out-of-memory and size limits of the browser end here, e.g. very dense meshes.
      notify(`Export failed: ${e.message}. Use Normal mesh density or fewer chord samples and panel stations.`, true);
    }
  });
  dialog.showModal();
}
