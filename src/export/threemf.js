// 3MF writer (3MF Core Specification): an OPC zip package with [Content_Types].xml,
// _rels/.rels and 3D/3dmodel.model. Units: millimetres. One mesh object per shell.
// The model XML is written and compressed in chunks of about 1 MB, so meshes whose XML exceeds the
// maximum JavaScript string length (about 2^29 characters) still export.

import { Zip, ZipDeflate, strToU8 } from 'fflate';
import { checkPrecision } from './precision.js';

const CORE_NS = 'http://schemas.microsoft.com/3dmanufacturing/core/2015/02';

const CONTENT_TYPES =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>' +
  '</Types>\n';

const RELS =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>' +
  '</Relationships>\n';

// Characters outside the XML 1.0 Char production (C0 controls except tab, LF, CR; lone
// surrogates; U+FFFE, U+FFFF) make the document not well-formed; they are removed.
const NON_XML_CHAR = /[^\t\n\r\u0020-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/gu;
const CHUNK = 1 << 20;

export function xmlEscape(s) {
  return String(s)
    .replace(NON_XML_CHAR, '')
    .replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]);
}

// 9 significant digits keep every 32-bit float, the precision of 3MF readers such as lib3mf; fixed
// decimals would merge the corners of small triangles near the origin (1 mm chord, 200 chord
// samples: 12 collapsed triangles at 5 decimals).
function num(x) {
  const v = Number(x.toPrecision(9));
  return v === 0 ? '0' : String(v);
}

/**
 * Write the 3D model XML as string chunks of about CHUNK characters.
 * @param {{name: string, mesh: {positions: ArrayLike<number>, indices: ArrayLike<number>}}[]} objects
 * @param {(chunk: string) => void} emit
 */
function writeModel(objects, { title = 'Wing', application = 'Wingdesigner' }, emit) {
  let buf = '';
  const put = (s) => {
    buf += s;
    if (buf.length >= CHUNK) {
      emit(buf);
      buf = '';
    }
  };
  put('<?xml version="1.0" encoding="UTF-8"?>\n');
  put(`<model unit="millimeter" xml:lang="en-US" xmlns="${CORE_NS}">`);
  put(`<metadata name="Title">${xmlEscape(title)}</metadata>`);
  put(`<metadata name="Application">${xmlEscape(application)}</metadata>`);
  put('<resources>');
  objects.forEach((o, k) => {
    const P = o.mesh.positions;
    const I = o.mesh.indices;
    put(`<object id="${k + 1}" type="model" name="${xmlEscape(o.name)}"><mesh><vertices>`);
    for (let i = 0; i < P.length; i += 3) put(`<vertex x="${num(P[i])}" y="${num(P[i + 1])}" z="${num(P[i + 2])}"/>`);
    put('</vertices><triangles>');
    for (let t = 0; t < I.length; t += 3) put(`<triangle v1="${I[t]}" v2="${I[t + 1]}" v3="${I[t + 2]}"/>`);
    put('</triangles></mesh></object>');
  });
  put('</resources><build>');
  objects.forEach((_, k) => put(`<item objectid="${k + 1}"/>`));
  put('</build></model>\n');
  emit(buf);
}

/** The 3D model XML as one string (small models and tests). */
export function modelXml(objects, options = {}) {
  const parts = [];
  writeModel(objects, options, (s) => parts.push(s));
  return parts.join('');
}

/** Zip the package. Returns Uint8Array. */
/**
 * @throws {MeshPrecisionError} when the written coordinates, read as 32-bit floats, merge two
 * distinct corners of a triangle
 */
export function meshesTo3mf(objects, options = {}) {
  for (const o of objects) checkPrecision(o.mesh.positions, o.mesh.indices, (x) => Math.fround(Number(num(x))), '3MF readers store');
  const out = [];
  let total = 0;
  let failure = null;
  const zip = new Zip((err, data) => {
    if (err) failure = err;
    else {
      out.push(data);
      total += data.length;
    }
  });
  const mtime = options.mtime ?? new Date('2026-01-01T00:00:00Z');
  const add = (name) => {
    const f = new ZipDeflate(name, { level: 6 });
    f.mtime = mtime;
    zip.add(f);
    return f;
  };
  add('[Content_Types].xml').push(strToU8(CONTENT_TYPES), true);
  add('_rels/.rels').push(strToU8(RELS), true);
  const model = add('3D/3dmodel.model');
  // Hold back one chunk so the last one is pushed with final = true.
  let held = null;
  writeModel(objects, options, (s) => {
    if (held !== null) model.push(strToU8(held));
    held = s;
  });
  model.push(strToU8(held ?? ''), true);
  zip.end();
  if (failure) throw failure;
  const bytes = new Uint8Array(total);
  let at = 0;
  for (const d of out) {
    bytes.set(d, at);
    at += d.length;
  }
  return bytes;
}
