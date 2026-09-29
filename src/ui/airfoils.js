// Airfoil management: project airfoils, NACA generator, bundled library, external sources, and the
// upload flow with preview and sanity check.

import { MAX_FILE_BYTES, MAX_INPUT, decodeText, toSeligDat } from '../airfoil/parse.js';
import { importAirfoilText, checkAirfoil } from '../airfoil/sanity.js';
import { parseNacaCode } from '../airfoil/naca.js';
import { EXTERNAL_SOURCES, NACA_PRESETS, loadLibraryIndex, nacaEntry, suggestAttribution } from '../airfoil/library.js';
import { profileCurve, profileProblem } from '../geom/profile.js';
import { curvePoint } from '../geom/nurbs.js';
import { addAirfoil, pruneAirfoils } from '../model/edit.js';
import { LIMITS, airfoilPoints } from '../model/project.js';
import { displayName } from '../model/budget.js';
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
  // Scale and centre from the point bounds: project files may hold any scale, e.g. percent of chord.
  let xmin = Infinity;
  let xmax = -Infinity;
  let ymin = Infinity;
  let ymax = -Infinity;
  for (const [x, y] of points) {
    xmin = Math.min(xmin, x);
    xmax = Math.max(xmax, x);
    ymin = Math.min(ymin, y);
    ymax = Math.max(ymax, y);
  }
  const s = Math.min((w - 8) / Math.max(xmax - xmin, 1e-12), (hgt - 8) / Math.max(ymax - ymin, 1e-12));
  const ox = w / 2 - ((xmax + xmin) / 2) * s;
  const oy = hgt / 2 + ((ymax + ymin) / 2) * s;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  points.forEach(([x, y], i) => {
    const px = ox + x * s;
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
export function previewAirfoil(candidate, { title = 'Airfoil preview', allowEdit = true, parametrization = 'centripetal' } = {}) {
  return new Promise((resolve) => {
    const check = candidate.checked ?? checkAirfoil(candidate.points);
    const issues = [...(candidate.issues ?? []), ...(candidate.checked ? [] : check.issues)];
    let ok = !issues.some((i) => i.severity === 'error') && check.ok;
    let curve = null;
    if (ok) {
      let prof = null;
      try {
        prof = profileCurve(check.points, { parametrization });
        curve = prof.curve;
      } catch (e) {
        curve = null;
        issues.push({ severity: 'error', code: 'curve-shape', message: `The NURBS interpolation through the points failed (${e.message}).` });
        ok = false;
      }
      const problem = prof && profileProblem(prof);
      if (problem) {
        issues.push({ severity: 'error', code: 'curve-shape', message: problem.charAt(0).toUpperCase() + problem.slice(1) });
        ok = false;
      }
    }
    const pts = check.points ?? candidate.points;
    const canvas = h('canvas', { class: 'preview-canvas', 'aria-label': 'Airfoil preview' });
    const nameInput = h('input', { type: 'text', value: candidate.name, 'aria-label': 'Airfoil name', maxLength: LIMITS.maxName, disabled: !allowEdit });
    const attrInput = h('input', {
      type: 'text',
      value: candidate.source?.attribution ?? suggestAttribution(candidate.name),
      placeholder: 'Designer / source (kept in the project file)',
      'aria-label': 'Attribution',
      maxLength: LIMITS.maxText,
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
    // View: x -0.05 to 1.05, y -0.2 to 0.2, widened to the points and the curve plus 0.05 chord.
    const box = [-0.05, -0.2, 1.05, 0.2];
    const widen = ([x, y]) => {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      box[0] = Math.min(box[0], x - 0.05);
      box[1] = Math.min(box[1], y - 0.05);
      box[2] = Math.max(box[2], x + 0.05);
      box[3] = Math.max(box[3], y + 0.05);
    };
    pts.forEach(widen);
    if (curve) for (let k = 0; k <= 600; k++) widen(curvePoint(curve, k / 600));
    const pz = new PanZoomCanvas(canvas, {
      bounds: () => box,
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
    // Text typed into the upload and NACA fields survives re-rendering until it is added.
    this.drafts = { paste: '', naca: '', closedTE: false };
    this.entries = new WeakMap();
    this.render();
    loadLibraryIndex().then((lib) => {
      this.library = lib;
      this.renderLibraryOnly();
    });
  }

  update() {
    this.render();
  }

  async addCandidate(candidate, title) {
    // The reason an airfoil with `count` points cannot be added, or null.
    const refusal = (count) => {
      const p = this.store.project;
      const n = (v) => v.toLocaleString('en');
      if (p.airfoils.length >= LIMITS.maxAirfoils) return `The project holds ${n(LIMITS.maxAirfoils)} airfoils, the limit; "Remove unused" frees places.`;
      const total = airfoilPoints(p) + count;
      if (total > LIMITS.maxAirfoilPoints) return `With this airfoil the project airfoils hold ${n(total)} points; the limit is ${n(LIMITS.maxAirfoilPoints)}. "Remove unused" frees points.`;
      return null;
    };
    const before = refusal(candidate.points?.length ?? 0);
    if (before) {
      this.onMessage(before, true);
      return null;
    }
    const res = await previewAirfoil(candidate, { title, parametrization: this.store.project.settings?.parametrization });
    if (!res) return null;
    const after = refusal(res.points.length);
    let id = null;
    // No section uses the new airfoil yet: the wing stays as it is.
    this.store.update(
      (p) => {
        id = addAirfoil(p, res);
      },
      { reason: 'airfoils' },
    );
    if (id === null) {
      this.onMessage(after, true);
      return null;
    }
    this.onMessage(`Added airfoil "${displayName(res.name)}".`);
    return id;
  }

  async uploadFiles(files) {
    for (const file of files) {
      if (file.size > MAX_FILE_BYTES) {
        this.onMessage(`${file.name}: ${(file.size / 1e6).toFixed(1)} MB; airfoil files are limited to ${MAX_INPUT.toLocaleString('en')} characters.`, true);
        continue;
      }
      let bytes;
      try {
        bytes = await file.arrayBuffer();
      } catch (err) {
        this.onMessage(`${file.name}: the browser could not read the file (${err?.name ?? 'Error'}).`, true);
        continue;
      }
      const r = importAirfoilText(decodeText(bytes), file.name);
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
        // Airfoils are replaced, never changed in place: an entry (and its drawn thumbnail) stays
        // valid while its airfoil object and its use by a section stay the same.
        const inUse = used.has(a.id);
        const kept = this.entries.get(a);
        if (kept?.inUse === inUse) return kept.li;
        const c = h('canvas', { class: 'thumb' });
        requestAnimationFrame(() => drawThumb(c, a.points));
        const attribution = a.source?.attribution ?? (a.source?.kind === 'naca' ? 'NACA equations' : '');
        const li = h(
          'li',
          {},
          c,
          h('div', { class: 'grow' }, h('div', {}, displayName(a.name)), h('div', { class: 'small muted' }, `${a.points.length} points${attribution ? ` · ${attribution}` : ''}${used.has(a.id) ? '' : ' · unused'}`)),
          h(
            'button',
            { type: 'button', class: 'icon', title: 'Preview', onclick: () => previewAirfoil({ ...a }, { title: displayName(a.name), allowEdit: false, parametrization: this.store.project.settings?.parametrization }) },
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
              onclick: () => this.store.update((q) => (q.airfoils = q.airfoils.filter((x) => x.id !== a.id)), { reason: 'airfoils' }),
            },
            '×',
          ),
        );
        this.entries.set(a, { li, inUse });
        return li;
      }),
    );

    const nacaInput = h('input', {
      type: 'text',
      placeholder: 'e.g. 2412 or 23012',
      'aria-label': 'NACA designation',
      size: 10,
      value: this.drafts.naca,
      oninput: (e) => (this.drafts.naca = e.target.value),
    });
    const closedTE = h('input', { type: 'checkbox', checked: this.drafts.closedTE, onchange: (e) => (this.drafts.closedTE = e.target.checked) });
    const nacaMsg = h('span', { class: 'small muted' });
    const addNaca = async (code) => {
      if (!parseNacaCode(code)) {
        nacaMsg.textContent = 'Enter a 4-digit (e.g. 2412) or 5-digit (e.g. 23012) designation.';
        return;
      }
      nacaMsg.textContent = '';
      return this.addCandidate(nacaEntry(code, { closedTE: closedTE.checked }), `NACA ${parseNacaCode(code).code}`);
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
    const paste = h('textarea', {
      rows: 4,
      placeholder: 'Or paste coordinates (Selig, Lednicer or x/upper/lower table)',
      'aria-label': 'Paste coordinates',
      value: this.drafts.paste,
      oninput: (e) => (this.drafts.paste = e.target.value),
    });
    const pasteBtn = h(
      'button',
      {
        type: 'button',
        onclick: async () => {
          const r = importAirfoilText(paste.value, 'pasted');
          const id = await this.addCandidate(
            { name: r.name, points: r.points, format: r.format, issues: r.issues, checked: { ok: r.ok, points: r.points, issues: [] }, source: { kind: 'upload' } },
            'Pasted coordinates',
          );
          if (id !== null) this.drafts.paste = '';
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
      h('section', {}, h('h3', {}, 'Project airfoils'), projectList, h('button', { type: 'button', onclick: () => this.store.update((q2) => pruneAirfoils(q2), { reason: 'airfoils' }) }, 'Remove unused')),
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
        h('div', { class: 'row wrap' }, nacaInput, h('label', { class: 'check' }, closedTE, 'Closed trailing edge'), h(
            'button',
            {
              type: 'button',
              onclick: async () => {
                if ((await addNaca(nacaInput.value)) != null) this.drafts.naca = '';
              },
            },
            'Preview',
          ), nacaMsg),
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
