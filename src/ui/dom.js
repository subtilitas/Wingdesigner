// Minimal DOM helpers.

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

/** Numeric input bound to a value getter/setter. Commits on change (enter/blur) and on arrow steps. */
export function numberInput({ value, step = 1, min, max, title, onCommit, width }) {
  const input = h('input', {
    type: 'number',
    inputMode: 'decimal',
    step: String(step),
    value: formatNum(value),
    title,
    class: 'num',
    style: width ? { width } : undefined,
  });
  if (min !== undefined) input.min = String(min);
  if (max !== undefined) input.max = String(max);
  input.addEventListener('change', () => {
    const v = Number(input.value);
    if (!Number.isFinite(v)) {
      input.value = formatNum(value);
      return;
    }
    onCommit(v);
  });
  return input;
}

export function formatNum(v, digits = 3) {
  if (!Number.isFinite(v)) return '';
  return String(Number(v.toFixed(digits)));
}

export function slugFile(name, ext) {
  const base =
    String(name || 'wing')
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Za-z0-9._-]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'wing';
  return `${base}.${ext}`;
}
