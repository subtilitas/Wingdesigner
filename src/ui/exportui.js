// Export dialog: STEP, STL, 3MF and the project JSON.

import { wingToStep } from '../export/step.js';
import { MeshPrecisionError } from '../export/precision.js';
import { meshToStl } from '../export/stl.js';
import { meshesTo3mf } from '../export/threemf.js';
import { MAX_EXPORT_TRIANGLES, concatMeshes, exportMeshes, exportTriangles } from '../geom/mesh.js';
import { projectToJsonText } from '../model/io.js';
import { cloneProject } from '../model/project.js';
import { download, h, slugFile } from './dom.js';

export function exportDialog(store, getBuild, version, notify = () => {}) {
  // Project and build are captured together when the dialog opens; every format writes that state.
  const project = cloneProject(store.project);
  const build = getBuild();
  const name = project.name || 'wing';
  const blocked = !build?.surface;
  // Fine density: 4 times the triangles of Normal; beyond MAX_EXPORT_TRIANGLES it is not offered.
  const vRefine = (dens) => (build?.surface?.degreeV === 1 ? 1 : 3) * dens;
  const fineTriangles = blocked ? 0 : exportTriangles(build, 'halves', { uRefine: 2, vRefine: vRefine(2) });
  const fineOff = fineTriangles > MAX_EXPORT_TRIANGLES;
  const radio = (group, value, label, checked, disabled = false) =>
    h('label', { class: 'check' }, h('input', { type: 'radio', name: group, value, checked, disabled }), label);
  const dialog = h(
    'dialog',
    { class: 'modal' },
    h(
      'form',
      { method: 'dialog' },
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
      h(
        'fieldset',
        {},
        h('legend', {}, 'Mesh density (STL, 3MF)'),
        radio('dens', '1', 'Normal', true),
        radio('dens', '2', 'Fine (4x triangles)', false, fineOff),
        fineOff
          ? h('p', { class: 'small muted' }, `Fine: ${(fineTriangles / 1e6).toFixed(1)} million triangles for both halves, above the limit of ${(MAX_EXPORT_TRIANGLES / 1e6).toFixed(0)} million.`)
          : null,
      ),
      h('p', { class: 'small muted' }, 'Units: millimetres. Axes: x chordwise towards the trailing edge, y spanwise, z up.'),
      h('div', { class: 'row end' }, h('button', { type: 'button', onclick: () => dialog.close('cancel') }, 'Cancel'), h('button', { value: 'ok', class: 'primary' }, 'Download')),
    ),
  );
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
        download(slugFile(name, 'json'), projectToJsonText(project, build, { generatorVersion: version }), 'application/json');
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
