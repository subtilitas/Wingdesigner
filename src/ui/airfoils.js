// Airfoil management: project airfoils, NACA generator, bundled library, external sources, and the
// upload flow with preview and sanity check.

import { MAX_FILE_BYTES, MAX_INPUT, decodeText, toSeligDat } from '../airfoil/parse.js';
import { importAirfoilText, checkAirfoil } from '../airfoil/sanity.js';
import { parseNacaCode } from '../airfoil/naca.js';
import { EXTERNAL_SOURCES, NACA_PRESETS, loadLibraryIndex, nacaEntry, suggestAttribution } from '../airfoil/library.js';
import { profileCurve, profileProblem } from '../geom/profile.js';
import { curvePoint } from '../geom/nurbs.js';
import { addAirfoil, pruneAirfoils } from '../model/edit.js';
import { PanZoomCanvas, cssVar } from './panzoom.js';
import { clear, download, h, slugFile } from './dom.js';

const SEVERITY_LABEL = { error: 'Error', warning: 'Warning', info: 'Info' };

/** Small static outline drawing. */
export function drawThumb(canvas, points, color = cssVar('--ink', '#1d2430')) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 120;
  const hgt = canvas.clientHeight || 40;
  canvas.width = w * dpr;
  canvas.height = hgt * dpr;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, hgt);
  if (!points?.length) return;
  let ymin = Infinity;
  let ymax = -Infinity;
  for (const [, y] of points) {
    ymin = Math.min(ymin, y);
    ymax = Math.max(ymax, y);
  }
  const s = Math.min((w - 8) / 1, (hgt - 8) / Math.max(ymax - ymin, 1e-6));
  const oy = hgt / 2 + ((ymax + ymin) / 2) * s;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  points.forEach(([x, y], i) => {
    const px = 4 + x * s;
    const py = oy - y * s;
    if (i) ctx.lineTo(px, py);
    else ctx.moveTo(px, py);
  });
  ctx.stroke();
}

/**
 * Modal preview of one airfoil candidate with sanity report.
 * Resolves with the (possibly renamed) airfoil to add, or null.
 */
export function previewAirfoil(candidate, { title = 'Airfoil preview', allowEdit = true } = {}) {
  return new Promise((resolve) => {
    const check = candidate.checked ?? checkAirfoil(candidate.points);
    const issues = [...(candidate.issues ?? []), ...(candidate.checked ? [] : check.issues)];
    let ok = !issues.some((i) => i.severity === 'error') && check.ok;
    let curve = null;
    if (ok) {
      let prof = null;
      try {
        prof = profileCurve(check.points);
        curve = prof.curve;
      } catch {
        curve = null;
      }
      const problem = prof && profileProblem(prof);
      if (problem) {
        issues.push({ severity: 'error', code: 'curve-shape', message: problem.charAt(0).toUpperCase() + problem.slice(1) });
        ok = false;
      }
    }
    const pts = check.points ?? candidate.points;
    const canvas = h('canvas', { class: 'preview-canvas', 'aria-label': 'Airfoil preview' });
    const nameInput = h('input', { type: 'text', value: candidate.name, 'aria-label': 'Airfoil name', disabled: !allowEdit });
    const attrInput = h('input', {
      type: 'text',
      value: candidate.source?.attribution ?? suggestAttribution(candidate.name),
      placeholder: 'Designer / source (kept in the project file)',
      'aria-label': 'Attribution',
      disabled: !allowEdit,
    });
    const showPoints = h('input', { type: 'checkbox', checked: true });
    const dialog = h(
      'dialog',
      { class: 'modal' },
      h(
        'form',
        { method: 'dialog' },
        h('h2', {}, title),
        h('div', { class: 'canvas-wrap' }, canvas),
        h(
          'div',
          { class: 'row wrap small' },
          h('label', { class: 'check' }, showPoints, 'Show data points'),
          h('span', { class: 'muted' }, 'Line: NURBS interpolation. Dots: file points. Red: reported problem location.'),
        ),
        h('label', { class: 'field' }, 'Name', nameInput),
        h('label', { class: 'field' }, 'Source / attribution', attrInput),
        candidate.format ? h('p', { class: 'small muted' }, `Format: ${candidate.format}, ${pts.length} points`) : null,
        h(
          'ul',
          { class: 'issues' },
          issues.map((i) => h('li', { class: `sev-${i.severity}` }, h('strong', {}, `${SEVERITY_LABEL[i.severity]}: `), i.message)),
        ),
        h(
          'div',
          { class: 'row end' },
          // A view of a project airfoil (allowEdit false) has nothing to add: only Close.
          h('button', { type: 'button', onclick: () => dialog.close('cancel') }, allowEdit ? 'Cancel' : 'Close'),
          allowEdit ? h('button', { value: 'add', type: 'submit', class: 'primary', disabled: !ok }, ok ? 'Add to project' : 'Cannot add (errors)') : null,
        ),
      ),
    );
    document.body.append(dialog);
    const marks = issues.filter((i) => Number.isInteger(i.where)).map((i) => i.where);
    const pz = new PanZoomCanvas(canvas, {
      bounds: () => [-0.05, -0.2, 1.05, 0.2],
      draw: (ctx, view, w, hgt) => {
        view.drawGrid(ctx, w, hgt, cssVar('--grid', '#dde3ea'), cssVar('--axis', '#9aa6b2'));
        if (curve) {
          ctx.strokeStyle = cssVar('--accent', '#2f6fdf');
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          for (let k = 0; k <= 600; k++) {
            const [x, y] = curvePoint(curve, k / 600);
            const [sx, sy] = view.toScreen(x, y);
            if (k) ctx.lineTo(sx, sy);
            else ctx.moveTo(sx, sy);
          }
          ctx.stroke();
        } else {
          ctx.strokeStyle = cssVar('--ink', '#1d2430');
          ctx.beginPath();
          pts.forEach(([x, y], k) => {
            const [sx, sy] = view.toScreen(x, y);
            if (k) ctx.lineTo(sx, sy);
            else ctx.moveTo(sx, sy);
          });
          ctx.stroke();
        }
        if (showPoints.checked) {
          ctx.fillStyle = cssVar('--ink', '#1d2430');
          for (const [x, y] of pts) {
            const [sx, sy] = view.toScreen(x, y);
            ctx.fillRect(sx - 1.5, sy - 1.5, 3, 3);
          }
        }
        ctx.strokeStyle = cssVar('--danger', '#d0452a');
        ctx.lineWidth = 2;
        for (const k of marks) {
          if (!pts[k]) continue;
          const [sx, sy] = view.toScreen(pts[k][0], pts[k][1]);
          ctx.beginPath();
          ctx.arc(sx, sy, 9, 0, Math.PI * 2);
          ctx.stroke();
        }
      },
    });
    showPoints.addEventListener('change', () => pz.redraw());
    dialog.addEventListener('close', () => {
      pz.destroy();
      const add = dialog.returnValue === 'add' && ok;
      const attribution = attrInput.value.trim();
      dialog.remove();
      if (!add) return resolve(null);
      resolve({
        name: nameInput.value.trim() || candidate.name,
        points: check.points,
        source: { ...(candidate.source ?? {}), ...(attribution ? { attribution } : {}) },
      });
    });
    dialog.showModal();
    requestAnimationFrame(() => pz.fit());
  });
}

export class AirfoilsPanel {
  constructor(root, store, { onMessage } = {}) {
    this.root = root;
    this.store = store;
    this.onMessage = onMessage ?? (() => {});
    this.library = [];
    this.filter = '';
    this.render();
    loadLibraryIndex().then((lib) => {
      this.library = lib;
      this.render();
    });
  }

  update() {
    this.render();
  }

  async addCandidate(candidate, title) {
    const res = await previewAirfoil(candidate, { title });
    if (!res) return null;
    let id = null;
    this.store.update((p) => {
      id = addAirfoil(p, res);
    });
    this.onMessage(`Added airfoil "${res.name}".`);
    return id;
  }

  async uploadFiles(files) {
    for (const file of files) {
      if (file.size > MAX_FILE_BYTES) {
        this.onMessage(`${file.name}: ${(file.size / 1e6).toFixed(1)} MB; airfoil files are limited to ${MAX_INPUT.toLocaleString('en')} characters.`, true);
        continue;
      }
      const text = decodeText(await file.arrayBuffer());
      const r = importAirfoilText(text, file.name);
      await this.addCandidate(
        {
          name: r.name,
          points: r.points,
          format: r.format,
          issues: r.issues,
          checked: { ok: r.ok, points: r.points, issues: [] },
          source: { kind: 'upload', file: file.name, attribution: suggestAttribution(r.name) },
        },
        `Upload: ${file.name}`,
      );
    }
  }

  render() {
    const p = this.store.project;
    const used = new Set(p.sections.map((s) => s.airfoil));
    const projectList = h(
      'ul',
      { class: 'airfoil-list' },
      p.airfoils.map((a) => {
        const c = h('canvas', { class: 'thumb' });
        requestAnimationFrame(() => drawThumb(c, a.points));
        const attribution = a.source?.attribution ?? (a.source?.kind === 'naca' ? 'NACA equations' : '');
        return h(
          'li',
          {},
          c,
          h('div', { class: 'grow' }, h('div', {}, a.name), h('div', { class: 'small muted' }, `${a.points.length} points${attribution ? ` · ${attribution}` : ''}${used.has(a.id) ? '' : ' · unused'}`)),
          h(
            'button',
            { type: 'button', class: 'icon', title: 'Preview', onclick: () => previewAirfoil({ ...a }, { title: a.name, allowEdit: false }) },
            'View',
          ),
          h(
            'button',
            { type: 'button', class: 'icon', title: 'Download as Selig .dat', onclick: () => download(slugFile(a.name, 'dat'), toSeligDat(a.name, a.points, 7), 'text/plain') },
            '.dat',
          ),
          h(
            'button',
            {
              type: 'button',
              class: 'icon',
              title: used.has(a.id) ? 'In use by a section' : 'Remove from project',
              disabled: used.has(a.id),
              onclick: () => this.store.update((q) => (q.airfoils = q.airfoils.filter((x) => x.id !== a.id))),
            },
            '×',
          ),
        );
      }),
    );

    const nacaInput = h('input', { type: 'text', placeholder: 'e.g. 2412 or 23012', 'aria-label': 'NACA designation', size: 10 });
    const closedTE = h('input', { type: 'checkbox' });
    const nacaMsg = h('span', { class: 'small muted' });
    const addNaca = async (code) => {
      if (!parseNacaCode(code)) {
        nacaMsg.textContent = 'Enter a 4-digit (e.g. 2412) or 5-digit (e.g. 23012) designation.';
        return;
      }
      nacaMsg.textContent = '';
      await this.addCandidate(nacaEntry(code, { closedTE: closedTE.checked }), `NACA ${parseNacaCode(code).code}`);
    };

    const fileInput = h('input', {
      type: 'file',
      multiple: true,
      accept: '.dat,.txt,.cor,.xml,.htm,.html,.csv,text/plain',
      onchange: (e) => {
        this.uploadFiles([...e.target.files]);
        e.target.value = '';
      },
    });
    const drop = h(
      'div',
      { class: 'dropzone', tabIndex: 0 },
      h('p', {}, 'Drop .dat / .txt / .xml files here, or '),
      h('label', { class: 'button' }, 'Choose files', fileInput),
    );
    drop.addEventListener('dragover', (e) => {
      e.preventDefault();
      drop.classList.add('over');
    });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', (e) => {
      e.preventDefault();
      drop.classList.remove('over');
      this.uploadFiles([...e.dataTransfer.files]);
    });
    const paste = h('textarea', { rows: 4, placeholder: 'Or paste coordinates (Selig, Lednicer or x/upper/lower table)', 'aria-label': 'Paste coordinates' });
    const pasteBtn = h(
      'button',
      {
        type: 'button',
        onclick: () => {
          const r = importAirfoilText(paste.value, 'pasted');
          this.addCandidate(
            { name: r.name, points: r.points, format: r.format, issues: r.issues, checked: { ok: r.ok, points: r.points, issues: [] }, source: { kind: 'upload' } },
            'Pasted coordinates',
          );
        },
      },
      'Check pasted text',
    );

    const q = this.filter.toLowerCase();
    const nacaList = NACA_PRESETS.filter((n) => !q || `naca ${n.code} ${n.category} ${n.use}`.toLowerCase().includes(q));
    const libList = this.library.filter((a) => !q || `${a.name} ${a.category ?? ''} ${a.use ?? ''}`.toLowerCase().includes(q));
    const search = h('input', {
      type: 'search',
      placeholder: 'Filter library',
      value: this.filter,
      'aria-label': 'Filter library',
      oninput: (e) => {
        this.filter = e.target.value;
        this.renderLibraryOnly();
      },
    });
    this.libraryBox = h('div', { class: 'library' });
    this.fillLibrary(nacaList, libList, addNaca);

    clear(this.root).append(
      h('section', {}, h('h3', {}, 'Project airfoils'), projectList, h('button', { type: 'button', onclick: () => this.store.update((q2) => pruneAirfoils(q2)) }, 'Remove unused')),
      h(
        'section',
        {},
        h('h3', {}, 'Upload'),
        drop,
        paste,
        h('div', { class: 'row' }, pasteBtn),
        h('p', { class: 'small muted' }, 'Every file is parsed and checked (point order, normalization, crossings, trailing edge, spikes) and shown for review before it is added.'),
      ),
      h(
        'section',
        {},
        h('h3', {}, 'NACA generator'),
        h('div', { class: 'row wrap' }, nacaInput, h('label', { class: 'check' }, closedTE, 'Closed trailing edge'), h('button', { type: 'button', onclick: () => addNaca(nacaInput.value) }, 'Preview'), nacaMsg),
      ),
      h('section', {}, h('h3', {}, 'Library'), search, this.libraryBox),
      h(
        'section',
        {},
        h('h3', {}, 'More airfoils (external, not bundled)'),
        h('p', { class: 'small muted' }, 'These collections allow personal use but not redistribution in this app. Download a file there and load it with Upload; the attribution is filled in for HS and MH airfoils.'),
        h(
          'ul',
          { class: 'links' },
          EXTERNAL_SOURCES.map((s) => h('li', {}, h('a', { href: s.url, target: '_blank', rel: 'noopener' }, s.name), h('div', { class: 'small muted' }, s.note))),
        ),
      ),
    );
    this.addNaca = addNaca;
  }

  renderLibraryOnly() {
    const q = this.filter.toLowerCase();
    const nacaList = NACA_PRESETS.filter((n) => !q || `naca ${n.code} ${n.category} ${n.use}`.toLowerCase().includes(q));
    const libList = this.library.filter((a) => !q || `${a.name} ${a.category ?? ''} ${a.use ?? ''}`.toLowerCase().includes(q));
    this.fillLibrary(nacaList, libList, this.addNaca);
  }

  fillLibrary(nacaList, libList, addNaca) {
    const items = [
      ...nacaList.map((n) => ({
        name: `NACA ${n.code}`,
        detail: `${n.category} · ${n.use} · generated`,
        points: () => nacaEntry(n.code).points,
        open: () => addNaca(n.code),
      })),
      ...libList.map((a) => ({
        name: a.name,
        detail: `${a.category ?? ''}${a.use ? ` · ${a.use}` : ''}${a.source?.author ? ` · ${a.source.author}` : ''}${a.source?.license ? ` · ${a.source.license}` : ''}`,
        points: null,
        open: async () => {
          try {
            const res = await fetch(a.url);
            const r = importAirfoilText(await res.text(), a.file);
            await this.addCandidate(
              {
                name: a.name,
                points: r.points,
                format: r.format,
                issues: r.issues,
                checked: { ok: r.ok, points: r.points, issues: [] },
                source: { kind: 'library', id: a.id, attribution: a.source?.author, license: a.source?.license, url: a.source?.url, terms: a.source?.terms },
              },
              a.name,
            );
          } catch (e) {
            this.onMessage(`Could not load ${a.name}: ${e.message}`);
          }
        },
      })),
    ];
    clear(this.libraryBox).append(
      h(
        'ul',
        { class: 'airfoil-list' },
        items.map((it) => {
          const c = h('canvas', { class: 'thumb' });
          if (it.points) requestAnimationFrame(() => drawThumb(c, it.points()));
          return h(
            'li',
            {},
            c,
            h('div', { class: 'grow' }, h('div', {}, it.name), h('div', { class: 'small muted' }, it.detail)),
            h('button', { type: 'button', onclick: it.open }, 'Preview'),
          );
        }),
      ),
    );
  }
}
