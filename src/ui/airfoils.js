// Airfoil management: project airfoils, NACA generator, bundled library, external sources, and the
// upload flow with preview and sanity check.

import { MAX_FILE_BYTES, MAX_INPUT, decodeText, toSeligDat } from '../airfoil/parse.js';
import { importAirfoilText, checkAirfoil } from '../airfoil/sanity.js';
import { parseNacaCode } from '../airfoil/naca.js';
import { EXTERNAL_SOURCES, NACA_PRESETS, librarySource, nacaEntry, suggestAttribution } from '../airfoil/library.js';
import { bundledLibrary } from '../airfoil/bundled.js';
import { startsLikeXfl } from '../import/xfl.js';
import { fitProfile } from '../geom/profile.js';
import { curvePoint } from '../geom/nurbs.js';
import { addAirfoil, pruneAirfoils } from '../model/edit.js';
import { LIMITS, airfoilPoints } from '../model/project.js';
import { displayName } from '../model/budget.js';
import { PanZoomCanvas, cssVar } from './panzoom.js';
import { clear, download, h, slugFile } from './dom.js';
import { count, fixed, language, tr, whole } from '../i18n/index.js';

/** "Error", "Warning" or "Info" for a report line. */
export const severityLabel = (severity) => (severity === 'error' ? tr('Error') : severity === 'warning' ? tr('Warning') : tr('Info'));

/**
 * A descriptive text of the library data (NACA_PRESETS and EXTERNAL_SOURCES of library.js, the entries of
 * public/airfoils/index.json) in the current language. Every known text has its own literal key;
 * a text that is not known here (a new library entry) is shown as it is.
 */
export function libraryText(text) {
  switch (text) {
    case 'Symmetric':
      return tr('Symmetric');
    case 'Cambered':
      return tr('Cambered');
    case 'Reflex':
      return tr('Reflex');
    case 'Thin tail surfaces':
      return tr('Thin tail surfaces');
    case 'Tail surfaces':
      return tr('Tail surfaces');
    case 'Tail surfaces, fins':
      return tr('Tail surfaces, fins');
    case 'Tail surfaces, flying-wing tips':
      return tr('Tail surfaces, flying-wing tips');
    case 'Aerobatic wings, rudders':
      return tr('Aerobatic wings, rudders');
    case 'Thick aerobatic wings':
      return tr('Thick aerobatic wings');
    case 'Thin sport wings':
      return tr('Thin sport wings');
    case 'Sport wings, tip sections':
      return tr('Sport wings, tip sections');
    case 'Trainers and sport models':
      return tr('Trainers and sport models');
    case 'Slow trainers':
      return tr('Slow trainers');
    case 'Slow flyers, high lift':
      return tr('Slow flyers, high lift');
    case 'Slow flyers, scale models':
      return tr('Slow flyers, scale models');
    case 'High-lift, low-speed models':
      return tr('High-lift, low-speed models');
    case 'Scale and sport models':
      return tr('Scale and sport models');
    case 'Thick scale wings':
      return tr('Thick scale wings');
    case 'Reflexed 5-digit section (flying-wing experiments)':
      return tr('Reflexed 5-digit section (flying-wing experiments)');
    case 'Reflexed 5-digit section':
      return tr('Reflexed 5-digit section');
    case 'Model aircraft from free-flight gliders to radio-controlled scale models. Thickness 11.7 % of chord; lower surface flat from 30 % of chord to the trailing edge. Ordinates from the published base line: the leading edge is 3.50 % of chord above the x axis.':
      return tr('Model aircraft from free-flight gliders to radio-controlled scale models. Thickness 11.7 % of chord; lower surface flat from 30 % of chord to the trailing edge. Ordinates from the published base line: the leading edge is 3.50 % of chord above the x axis.');
    case 'Section for helicopter rotor blades with a pitching moment near zero about the aerodynamic centre; reflexed mean line; used on the full-size tailless gliders Kasper Bekas and Brochocki BKB-1. Thickness 12.0 % of chord. Use on models: not documented in the sources checked.':
      return tr('Section for helicopter rotor blades with a pitching moment near zero about the aerodynamic centre; reflexed mean line; used on the full-size tailless gliders Kasper Bekas and Brochocki BKB-1. Thickness 12.0 % of chord. Use on models: not documented in the sources checked.');
    case 'Reflexed, pitch-stable section with small centre-of-pressure travel; candidate section for flying wings; used on the full-size Gee Bee Z Super Sportster (thinned to 8 % of chord on the Gee Bee R-1). Thickness 12.0 % of chord; trailing edge 0.52 % of chord thick.':
      return tr('Reflexed, pitch-stable section with small centre-of-pressure travel; candidate section for flying wings; used on the full-size Gee Bee Z Super Sportster (thinned to 8 % of chord on the Gee Bee R-1). Thickness 12.0 % of chord; trailing edge 0.52 % of chord thick.');
    case 'Wing section of full-size aircraft such as the Comper Streak and, in modified form, the de Havilland DH-98 Mosquito; for scale models of such aircraft. Thickness 12.6 % of chord. Seven values of the source scan are uncertain by up to 0.20 % of chord (listed in NOTICE.md).':
      return tr('Wing section of full-size aircraft such as the Comper Streak and, in modified form, the de Havilland DH-98 Mosquito; for scale models of such aircraft. Thickness 12.6 % of chord. Seven values of the source scan are uncertain by up to 0.20 % of chord (listed in NOTICE.md).');
    case 'Heavy-lift and high-lift section. XFOIL (airfoil analysis program) predicts a maximum lift coefficient of 2.59 at 11° angle of attack and a Reynolds number of 200,000. Thickness 12.1 % of chord, camber 14.7 % of chord; thinnest point 0.26 % of chord at 91 % of chord.':
      return tr('Heavy-lift and high-lift section. XFOIL (airfoil analysis program) predicts a maximum lift coefficient of 2.59 at 11° angle of attack and a Reynolds number of 200,000. Thickness 12.1 % of chord, camber 14.7 % of chord; thinnest point 0.26 % of chord at 91 % of chord.');
    case 'Wing section of the full-size Piper J-3 Cub and PA-18 Super Cub; for scale models of these aircraft. Thickness 11.6 % of chord. Ordinates from the published base line: the leading edge is 2.76 % of chord above the x axis.':
      return tr('Wing section of the full-size Piper J-3 Cub and PA-18 Super Cub; for scale models of these aircraft. Thickness 11.6 % of chord. Ordinates from the published base line: the leading edge is 2.76 % of chord above the x axis.');
    case 'HS airfoils and catalogs for planks, swept flying wings, gliders. Use with attribution "Hartmut Siegmann, www.aerodesign.de"; redistribution is restricted, commercial use needs written permission.':
      return tr('HS airfoils and catalogs for planks, swept flying wings, gliders. Use with attribution "Hartmut Siegmann, www.aerodesign.de"; redistribution is restricted, commercial use needs written permission.');
    case 'MH airfoils (e.g. MH 45, MH 60 for flying wings, MH 32 for gliders). Terms: personal use; publications must cite the source.':
      return tr('MH airfoils (e.g. MH 45, MH 60 for flying wings, MH 32 for gliders). Terms: personal use; publications must cite the source.');
    case 'About 1,600 airfoils in Selig format from many designers. The database states no license for the coordinate files; the rights of each designer apply.':
      return tr('About 1,600 airfoils in Selig format from many designers. The database states no license for the coordinate files; the rights of each designer apply.');
    default:
      return text;
  }
}

const SVG_NS = 'http://www.w3.org/2000/svg';
// Thumbnail drawing units (the CSS box is 110 x 36 px) and most points drawn.
const THUMB_W = 120;
const THUMB_H = 40;
const THUMB_POINTS = 400;

/**
 * Small static outline drawing as SVG. A canvas per airfoil held a device-pixel backing store (77 KB
 * at 2x), about 770 MB for 10,000 airfoils; a polyline of at most THUMB_POINTS points takes a few
 * KB and stays sharp at every pixel ratio.
 */
export function airfoilThumb(points) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'thumb');
  svg.setAttribute('viewBox', `0 0 ${THUMB_W} ${THUMB_H}`);
  svg.setAttribute('aria-hidden', 'true');
  if (!points?.length) return svg;
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
  const s = Math.min((THUMB_W - 8) / Math.max(xmax - xmin, 1e-12), (THUMB_H - 8) / Math.max(ymax - ymin, 1e-12));
  const ox = THUMB_W / 2 - ((xmax + xmin) / 2) * s;
  const oy = THUMB_H / 2 + ((ymax + ymin) / 2) * s;
  const step = Math.max(1, Math.ceil(points.length / THUMB_POINTS));
  const at = (q) => `${(ox + q[0] * s).toFixed(2)},${(oy - q[1] * s).toFixed(2)}`;
  const out = [];
  for (let i = 0; i < points.length; i += step) out.push(at(points[i]));
  if ((points.length - 1) % step) out.push(at(points[points.length - 1]));
  const line = document.createElementNS(SVG_NS, 'polyline');
  line.setAttribute('points', out.join(' '));
  svg.append(line);
  return svg;
}

/**
 * Modal preview of one airfoil candidate with sanity report.
 * Resolves with the (possibly renamed) airfoil to add, or null.
 */
export function previewAirfoil(candidate, { title = tr('Airfoil preview'), allowEdit = true, parametrization = 'centripetal' } = {}) {
  return new Promise((resolve) => {
    const check = candidate.checked ?? checkAirfoil(candidate.points);
    const issues = [...(candidate.issues ?? []), ...(candidate.checked ? [] : check.issues)];
    let ok = !issues.some((i) => i.severity === 'error') && check.ok;
    let curve = null;
    if (ok) {
      const fit = fitProfile(check.points, parametrization);
      curve = fit.prof?.curve ?? null;
      if (fit.issue) {
        issues.push(fit.issue);
        ok = false;
      }
    }
    const pts = check.points ?? candidate.points;
    const canvas = h('canvas', { class: 'preview-canvas', role: 'img', 'aria-label': tr('Airfoil preview') });
    const nameInput = h('input', { type: 'text', value: candidate.name, 'aria-label': tr('Airfoil name'), maxLength: LIMITS.maxName, disabled: !allowEdit });
    const attrInput = h('input', {
      type: 'text',
      value: candidate.source?.attribution ?? suggestAttribution(candidate.name),
      placeholder: tr('Designer / source (kept in the project file)'),
      'aria-label': tr('Attribution'),
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
          h('label', { class: 'check' }, showPoints, tr('Show data points')),
          h('span', { class: 'muted' }, tr('Line: NURBS interpolation. Dots: file points. Red: reported problem location.')),
        ),
        h('label', { class: 'field' }, tr('Name'), nameInput),
        h('label', { class: 'field' }, tr('Source / attribution'), attrInput),
        candidate.format ? h('p', { class: 'small muted' }, tr('Format: {format}, {n} points', { format: candidate.format === 'table' ? tr('table') : candidate.format, n: whole(pts.length) })) : null,
        h(
          'ul',
          { class: 'issues' },
          issues.map((i) => h('li', { class: `sev-${i.severity}` }, h('strong', {}, `${severityLabel(i.severity)}: `), i.message)),
        ),
        h(
          'div',
          { class: 'row end' },
          // A view of a project airfoil (allowEdit false) has nothing to add: only Close.
          h('button', { type: 'button', onclick: () => dialog.close('cancel') }, allowEdit ? tr('Cancel') : tr('Close')),
          allowEdit ? h('button', { value: 'add', type: 'submit', class: 'primary', disabled: !ok }, ok ? tr('Add to project') : tr('Cannot add (errors)')) : null,
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

/**
 * True for an XFLR5 project (.xfl) or an XFLR5 plane or wing XML file: Open imports a wing from those,
 * and read as an airfoil they would only give misleading errors.
 */
export function isXflr5File(bytes, text) {
  return startsLikeXfl(bytes) || /<explane[\s>/]/.test(text);
}

/** File types of the airfoil upload (the Airfoils tab, the XFLR5 import). */
export const AIRFOIL_ACCEPT = '.dat,.txt,.cor,.xml,.htm,.html,.csv,text/plain';

/**
 * Read an airfoil file chosen for upload (the Airfoils tab, the XFLR5 import): its bytes and decoded
 * text, or `problem`, a sentence naming the file, when it is too large, cannot be read or is an XFLR5
 * file. An XFLR5 project is recognized by its first 4 bytes before the size check: projects with
 * analysis results are larger than an airfoil file may be, and they get the hint to use Open too.
 * @returns {Promise<{bytes: ArrayBuffer, text: string}|{problem: string}>}
 */
export async function readAirfoilFile(file) {
  const xflr5 = () => ({ problem: tr('{file} is an XFLR5 file, not an airfoil. Use Open to import a wing from it.', { file: file.name }) });
  if (file.size > MAX_FILE_BYTES) {
    let head = null;
    try {
      head = await file.slice(0, 4).arrayBuffer();
    } catch {
      // Unreadable: the size is the reason given.
    }
    if (head && startsLikeXfl(head)) return xflr5();
    return { problem: tr('{file}: {size} MB; airfoil files are limited to {limit} characters.', { file: file.name, size: fixed(file.size / 1e6, 1), limit: count(MAX_INPUT) }) };
  }
  let bytes;
  try {
    bytes = await file.arrayBuffer();
  } catch (err) {
    return { problem: tr('{file}: the browser could not read the file ({error}).', { file: file.name, error: err?.name ?? 'Error' }) };
  }
  const text = decodeText(bytes);
  if (isXflr5File(bytes, text)) return xflr5();
  return { bytes, text };
}

/** The reason an airfoil with `points` points cannot be added to the project, or null. */
export function airfoilRefusal(project, points) {
  if (project.airfoils.length >= LIMITS.maxAirfoils) return tr('The project holds {n} airfoils, the limit; "Remove unused" frees places.', { n: count(LIMITS.maxAirfoils) });
  const total = airfoilPoints(project) + points;
  if (total > LIMITS.maxAirfoilPoints) {
    return tr('With this airfoil the project airfoils hold {n} points; the limit is {limit}. "Remove unused" frees points.', { n: count(total), limit: count(LIMITS.maxAirfoilPoints) });
  }
  return null;
}

export class AirfoilsPanel {
  constructor(root, store, { onMessage } = {}) {
    this.root = root;
    this.store = store;
    this.onMessage = onMessage ?? (() => {});
    this.library = bundledLibrary();
    this.filter = '';
    // Text typed into the upload and NACA fields survives re-rendering until it is added.
    this.drafts = { paste: '', naca: '', closedTE: false };
    this.entries = new WeakMap();
    this.render();
  }

  update() {
    this.render();
  }

  async addCandidate(candidate, title) {
    const before = airfoilRefusal(this.store.project, candidate.points?.length ?? 0);
    if (before) {
      this.onMessage(before, true);
      return null;
    }
    const res = await previewAirfoil(candidate, { title, parametrization: this.store.project.settings?.parametrization });
    if (!res) return null;
    const after = airfoilRefusal(this.store.project, res.points.length);
    let id = null;
    const held = this.store.project.airfoils.length;
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
    // An equal airfoil already in the project keeps its entry (addAirfoil returns its id).
    if (this.store.project.airfoils.length === held) {
      const same = this.store.project.airfoils.find((a) => a.id === id);
      this.onMessage(tr('The project already holds this airfoil as "{name}".', { name: displayName(same?.name ?? id) }));
      return id;
    }
    this.onMessage(tr('Added airfoil "{name}".', { name: displayName(res.name) }));
    return id;
  }

  async uploadFiles(files) {
    for (const file of files) {
      const read = await readAirfoilFile(file);
      if (read.problem) {
        this.onMessage(read.problem, true);
        continue;
      }
      const r = importAirfoilText(read.text, file.name);
      await this.addCandidate(
        {
          name: r.name,
          points: r.points,
          format: r.format,
          issues: r.issues,
          checked: { ok: r.ok, points: r.points, issues: [] },
          source: { kind: 'upload', file: file.name, attribution: suggestAttribution(r.name) },
        },
        tr('Upload: {file}', { file: file.name }),
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
        // valid while its airfoil object, its use by a section and the language stay the same.
        const inUse = used.has(a.id);
        const lang = language();
        const kept = this.entries.get(a);
        if (kept?.inUse === inUse && kept.lang === lang) return kept.li;
        const c = airfoilThumb(a.points);
        const attribution =
          a.source?.attribution ?? (a.source?.kind === 'naca' ? tr('NACA equations') : a.source?.kind === 'xflr5' ? tr('XFLR5: {file}', { file: displayName(a.source.file ?? '') }) : a.source?.kind === 'flow5' ? tr('flow5: {file}', { file: displayName(a.source.file ?? '') }) : '');
        const li = h(
          'li',
          {},
          c,
          h('div', { class: 'grow' }, h('div', {}, displayName(a.name)), h('div', { class: 'small muted' }, `${tr('{n} points', { n: whole(a.points.length) })}${attribution ? ` · ${attribution}` : ''}${inUse ? '' : ` · ${tr('unused')}`}`)),
          h(
            'button',
            { type: 'button', class: 'icon', title: tr('Preview'), onclick: () => previewAirfoil({ ...a }, { title: displayName(a.name), allowEdit: false, parametrization: this.store.project.settings?.parametrization }) },
            tr('View'),
          ),
          h(
            'button',
            { type: 'button', class: 'icon', title: tr('Download as Selig .dat'), onclick: () => download(slugFile(a.name, 'dat'), toSeligDat(a.name, a.points, 7), 'text/plain') },
            '.dat',
          ),
          h(
            'button',
            {
              type: 'button',
              class: 'icon',
              title: inUse ? tr('In use by a section') : tr('Remove from project'),
              disabled: inUse,
              onclick: () => this.store.update((q) => (q.airfoils = q.airfoils.filter((x) => x.id !== a.id)), { reason: 'airfoils' }),
            },
            '×',
          ),
        );
        this.entries.set(a, { li, inUse, lang });
        return li;
      }),
    );

    const nacaInput = h('input', {
      type: 'text',
      placeholder: tr('e.g. 2412 or 23012'),
      'aria-label': tr('NACA designation'),
      size: 10,
      value: this.drafts.naca,
      oninput: (e) => (this.drafts.naca = e.target.value),
    });
    const closedTE = h('input', { type: 'checkbox', checked: this.drafts.closedTE, onchange: (e) => (this.drafts.closedTE = e.target.checked) });
    const nacaMsg = h('span', { class: 'small muted' });
    const addNaca = async (code) => {
      if (!parseNacaCode(code)) {
        nacaMsg.textContent = tr('Enter a 4-digit (e.g. 2412) or 5-digit (e.g. 23012) designation.');
        return;
      }
      nacaMsg.textContent = '';
      return this.addCandidate(nacaEntry(code, { closedTE: closedTE.checked }), `NACA ${parseNacaCode(code).code}`);
    };

    const fileInput = h('input', {
      type: 'file',
      multiple: true,
      accept: AIRFOIL_ACCEPT,
      onchange: (e) => {
        this.uploadFiles([...e.target.files]);
        e.target.value = '';
      },
    });
    const drop = h(
      'div',
      { class: 'dropzone', tabIndex: 0 },
      h('p', {}, tr('Drop .dat / .txt / .xml files here, or ')),
      h('label', { class: 'button' }, tr('Choose files'), fileInput),
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
      placeholder: tr('Or paste coordinates (Selig, Lednicer or x/upper/lower table)'),
      'aria-label': tr('Paste coordinates'),
      value: this.drafts.paste,
      oninput: (e) => (this.drafts.paste = e.target.value),
    });
    const pasteBtn = h(
      'button',
      {
        type: 'button',
        onclick: async () => {
          const r = importAirfoilText(paste.value, tr('pasted'));
          const id = await this.addCandidate(
            { name: r.name, points: r.points, format: r.format, issues: r.issues, checked: { ok: r.ok, points: r.points, issues: [] }, source: { kind: 'upload' } },
            tr('Pasted coordinates'),
          );
          if (id !== null) this.drafts.paste = '';
        },
      },
      tr('Check pasted text'),
    );

    const { nacaList, libList } = this.filtered();
    const search = h('input', {
      type: 'search',
      placeholder: tr('Filter library'),
      value: this.filter,
      'aria-label': tr('Filter library'),
      oninput: (e) => {
        this.filter = e.target.value;
        this.renderLibraryOnly();
      },
    });
    this.libraryBox = h('div', { class: 'library' });
    this.fillLibrary(nacaList, libList, addNaca);

    clear(this.root).append(
      h('section', {}, h('h3', {}, tr('Project airfoils')), projectList, h('button', { type: 'button', onclick: () => this.store.update((q2) => pruneAirfoils(q2), { reason: 'airfoils' }) }, tr('Remove unused'))),
      h(
        'section',
        {},
        h('h3', {}, tr('Upload')),
        drop,
        paste,
        h('div', { class: 'row' }, pasteBtn),
        h('p', { class: 'small muted' }, tr('Every file is parsed and checked (point order, normalization, crossings, trailing edge, spikes) and shown for review before it is added.')),
      ),
      h(
        'section',
        {},
        h('h3', {}, tr('NACA generator')),
        h('div', { class: 'row wrap' }, nacaInput, h('label', { class: 'check' }, closedTE, tr('Closed trailing edge')), h(
            'button',
            {
              type: 'button',
              onclick: async () => {
                if ((await addNaca(nacaInput.value)) != null) this.drafts.naca = '';
              },
            },
            tr('Preview'),
          ), nacaMsg),
      ),
      h('section', {}, h('h3', {}, tr('Library')), search, this.libraryBox),
      h(
        'section',
        {},
        h('h3', {}, tr('More airfoils (external, not bundled)')),
        h('p', { class: 'small muted' }, tr('These collections allow personal use but not redistribution in this app. Download a file there and load it with Upload; the attribution is filled in for HS and MH airfoils.')),
        h(
          'ul',
          { class: 'links' },
          EXTERNAL_SOURCES.map((s) => h('li', {}, h('a', { href: s.url, target: '_blank', rel: 'noopener' }, s.name), h('div', { class: 'small muted' }, libraryText(s.note)))),
        ),
      ),
    );
    this.addNaca = addNaca;
  }

  /** The NACA presets and the bundled airfoils that match the filter, searched in the texts as shown. */
  filtered() {
    const q = this.filter.toLowerCase();
    return {
      nacaList: NACA_PRESETS.filter((n) => !q || `naca ${n.code} ${libraryText(n.category)} ${libraryText(n.use)}`.toLowerCase().includes(q)),
      libList: this.library.filter((a) => !q || `${a.name} ${libraryText(a.category ?? '')} ${libraryText(a.use ?? '')}`.toLowerCase().includes(q)),
    };
  }

  renderLibraryOnly() {
    const { nacaList, libList } = this.filtered();
    this.fillLibrary(nacaList, libList, this.addNaca);
  }

  fillLibrary(nacaList, libList, addNaca) {
    const items = [
      ...nacaList.map((n) => ({
        name: `NACA ${n.code}`,
        detail: tr('{category} · {use} · generated', { category: libraryText(n.category), use: libraryText(n.use) }),
        points: () => nacaEntry(n.code).points,
        open: () => addNaca(n.code),
      })),
      ...libList.map((a) => ({
        name: a.name,
        detail: `${libraryText(a.category ?? '')}${a.use ? ` · ${libraryText(a.use)}` : ''}${a.source?.author ? ` · ${a.source.author}` : ''}${a.source?.license ? ` · ${a.source.license}` : ''}`,
        points: null,
        open: async () => {
          try {
            const r = importAirfoilText(a.text, a.file);
            await this.addCandidate(
              {
                name: a.name,
                points: r.points,
                format: r.format,
                issues: r.issues,
                checked: { ok: r.ok, points: r.points, issues: [] },
                source: librarySource(a),
              },
              a.name,
            );
          } catch (e) {
            this.onMessage(tr('Could not load {name}: {message}', { name: a.name, message: e.message }));
          }
        },
      })),
    ];
    clear(this.libraryBox).append(
      h(
        'ul',
        { class: 'airfoil-list' },
        items.map((it) => {
          const c = airfoilThumb(it.points?.());
          return h(
            'li',
            {},
            c,
            h('div', { class: 'grow' }, h('div', {}, it.name), h('div', { class: 'small muted' }, it.detail)),
            h('button', { type: 'button', onclick: it.open }, tr('Preview')),
          );
        }),
      ),
    );
  }
}
