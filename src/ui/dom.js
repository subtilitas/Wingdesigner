// Minimal DOM helpers.

import { plain } from '../i18n/index.js';

/**
 * Create an element. attrs: properties or attributes; keys starting with "on" add listeners.
 * children: strings, nodes, arrays, null/false (skipped).
 */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k in el && k !== 'list' && k !== 'form') el[k] = v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.append(c instanceof Node ? c : String(c));
  }
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

/** Trigger a browser download of bytes or text. */
export function download(filename, data, mime = 'application/octet-stream') {
  const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: filename, style: { display: 'none' } });
  document.body.append(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 1000);
}

/**
 * Numeric input. Commits on change (Enter, blur, arrow steps). focusKey identifies the field across
 * re-renders so focus can be restored.
 */
export function numberInput({ value, step = 1, min, max, title, onCommit, width, focusKey }) {
  const input = h('input', {
    type: 'number',
    step: String(step),
    value: inputText(value),
    title,
    class: 'num',
    style: width ? { width } : undefined,
  });
  if (min !== undefined) input.min = String(min);
  if (max !== undefined) input.max = String(max);
  if (focusKey) input.dataset.focusKey = focusKey;
  input.addEventListener('change', () => {
    // An empty or unparsable field restores the previous value (Number('') would be 0).
    const raw = input.value.trim();
    const v = Number(raw);
    if (raw === '' || !Number.isFinite(v)) {
      input.value = inputText(value);
      return;
    }
    onCommit(v);
    // A commit that changes nothing (a value clamped to the stored one, a refused edit) renders no
    // panel again: the field then shows the stored value after the frame's rebuild.
    requestAnimationFrame(() => {
      if (input.isConnected) input.value = inputText(value);
    });
  });
  return input;
}

/**
 * Text of a number field: the shortest decimal that reads back to the same double, so stored values
 * such as 600.0000002 stay visible and an arrow step starts from them (labels use formatNum).
 */
export function inputText(v) {
  return Number.isFinite(v) ? String(v) : '';
}

/** A number for a label or readout (at most `digits` decimals): a decimal comma in German. */
export function formatNum(v, digits = 3) {
  if (!Number.isFinite(v)) return '';
  return plain(Number(v.toFixed(digits)));
}

/** A file name from a project or airfoil name: German umlauts are written out (ü as ue), other accents dropped. */
export function slugFile(name, ext) {
  const base =
    String(name || 'wing')
      .normalize('NFC')
      .replace(/[äöüÄÖÜß]/g, (c) => ({ ä: 'ae', ö: 'oe', ü: 'ue', Ä: 'Ae', Ö: 'Oe', Ü: 'Ue', ß: 'ss' })[c])
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Za-z0-9._-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      // File systems allow 255 bytes per name.
      .slice(0, 120) || 'wing';
  return `${base}.${ext}`;
}
