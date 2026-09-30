// Minimal DOM helpers.

import { plain, readNumber } from '../i18n/index.js';

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
 * Number field: a text field with the role spinbutton, because a native number field drops a typed
 * decimal comma. It shows `value` as inputText() writes it and reads the typed text with readNumber()
 * (decimal comma or point, digit groups). aria-valuenow follows the text (absent while the text is no
 * number). ArrowUp and ArrowDown step by `step` from the typed number, or from `fallback()` while the
 * text is no number, clamped to min and max, and fire input and change as a native number field does.
 * inputmode decimal only when min >= 0: the decimal keypad of iOS has no minus key.
 */
export function numberField({ value, step = 1, min, max, title, width, className, fallback = () => value }) {
  const input = h('input', {
    type: 'text',
    role: 'spinbutton',
    autocomplete: 'off',
    inputMode: min >= 0 ? 'decimal' : undefined,
    title,
    class: className,
    style: width ? { width } : undefined,
  });
  input.spellcheck = false;
  if (min !== undefined) {
    input.min = String(min);
    input.setAttribute('aria-valuemin', String(min));
  }
  if (max !== undefined) {
    input.max = String(max);
    input.setAttribute('aria-valuemax', String(max));
  }
  showNumber(input, value);
  input.addEventListener('input', () => syncValueNow(input));
  input.addEventListener('keydown', (e) => {
    if ((e.key !== 'ArrowUp' && e.key !== 'ArrowDown') || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || e.isComposing) return;
    e.preventDefault();
    if (input.readOnly || input.disabled) return;
    const typed = readNumber(input.value);
    const from = Number.isFinite(typed) ? typed : fallback();
    if (!Number.isFinite(from)) return;
    const next = stepValue(from, e.key === 'ArrowUp' ? step : -step, min, max);
    // At a limit the step changes nothing and fires nothing.
    if (next === typed) return;
    showNumber(input, next);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  return input;
}

/** Writes a value into a number field (inputText) and updates its aria-valuenow. */
export function showNumber(input, value) {
  input.value = inputText(value);
  syncValueNow(input);
}

function syncValueNow(input) {
  const v = readNumber(input.value);
  if (Number.isFinite(v)) input.setAttribute('aria-valuenow', String(v));
  else input.removeAttribute('aria-valuenow');
}

/** Decimals of the shortest text of v: 2 for 0.25, 7 for 1e-7, 0 for 1500. */
function decimals(v) {
  const [mantissa, exponent = '0'] = String(Math.abs(v)).split('e');
  return Math.max(0, (mantissa.split('.')[1]?.length ?? 0) - Number(exponent));
}

/**
 * One arrow step: from + delta, rounded to the decimals of both (0.25 + 0.05 is 0.3, not
 * 0.30000000000000004), clamped to min and max when given.
 */
export function stepValue(from, delta, min, max) {
  let v = Number((from + delta).toFixed(Math.min(100, Math.max(decimals(from), decimals(delta)))));
  if (min !== undefined) v = Math.max(v, min);
  if (max !== undefined) v = Math.min(v, max);
  return v;
}

/**
 * Number field of a panel. Commits on change (Enter, blur, arrow steps); an empty text or one that is
 * no number restores the stored value. focusKey identifies the field across re-renders so focus can
 * be restored.
 */
export function numberInput({ value, step = 1, min, max, title, onCommit, width, focusKey }) {
  const input = numberField({ value, step, min, max, title, width, className: 'num' });
  if (focusKey) input.dataset.focusKey = focusKey;
  input.addEventListener('change', () => {
    const v = readNumber(input.value);
    if (!Number.isFinite(v)) {
      showNumber(input, value);
      return;
    }
    onCommit(v);
    // A commit that changes nothing (a value clamped to the stored one, a refused edit) renders no
    // panel again: the field then shows the stored value after the frame's rebuild.
    requestAnimationFrame(() => {
      if (input.isConnected) showNumber(input, value);
    });
  });
  return input;
}

/**
 * Text of a number field: the shortest decimal that reads back to the same double, so stored values
 * such as 600.0000002 stay visible and an arrow step starts from them (labels use formatNum). German
 * writes a decimal comma (plain()).
 */
export function inputText(v) {
  return Number.isFinite(v) ? plain(v) : '';
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
