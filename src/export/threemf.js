// 3MF writer (3MF Core Specification): an OPC zip package with [Content_Types].xml,
// _rels/.rels and 3D/3dmodel.model. Units: millimetres. One mesh object per shell.

import { strToU8, zipSync } from 'fflate';

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

export function xmlEscape(s) {
  return String(s).replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]);
}

function num(x) {
  const s = x.toFixed(5).replace(/\.?0+$/, '');
  return s === '-0' ? '0' : s;
}

/**
 * Build the 3D model XML.
 * @param {{name: string, mesh: {positions: ArrayLike<number>, indices: ArrayLike<number>}}[]} objects
 */
export function modelXml(objects, { title = 'Wing', application = 'Wingdesigner' } = {}) {
  const parts = [];
  parts.push('<?xml version="1.0" encoding="UTF-8"?>\n');
  parts.push(`<model unit="millimeter" xml:lang="en-US" xmlns="${CORE_NS}">`);
  parts.push(`<metadata name="Title">${xmlEscape(title)}</metadata>`);
  parts.push(`<metadata name="Application">${xmlEscape(application)}</metadata>`);
  parts.push('<resources>');
  objects.forEach((o, k) => {
    const P = o.mesh.positions;
    const I = o.mesh.indices;
    parts.push(`<object id="${k + 1}" type="model" name="${xmlEscape(o.name)}"><mesh><vertices>`);
    for (let i = 0; i < P.length; i += 3) parts.push(`<vertex x="${num(P[i])}" y="${num(P[i + 1])}" z="${num(P[i + 2])}"/>`);
    parts.push('</vertices><triangles>');
    for (let t = 0; t < I.length; t += 3) parts.push(`<triangle v1="${I[t]}" v2="${I[t + 1]}" v3="${I[t + 2]}"/>`);
    parts.push('</triangles></mesh></object>');
  });
  parts.push('</resources><build>');
  objects.forEach((_, k) => parts.push(`<item objectid="${k + 1}"/>`));
  parts.push('</build></model>\n');
  return parts.join('');
}

/** Zip the package. Returns Uint8Array. */
export function meshesTo3mf(objects, options = {}) {
  return zipSync(
    {
      '[Content_Types].xml': strToU8(CONTENT_TYPES),
      '_rels/.rels': strToU8(RELS),
      '3D/3dmodel.model': strToU8(modelXml(objects, options)),
    },
    { level: 6, mtime: options.mtime ?? new Date('2026-01-01T00:00:00Z') },
  );
}
