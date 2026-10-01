// Files of the foam-cutting wizard (src/geom/foam.js gives the segments):
// - profile pairs: a ZIP with the end profiles of every segment as .dat files, in mm in the block
//   frame (mm/) and normalized to chord 1 (normalized/), plus segments.csv and README.txt;
// - 1:1 templates as one SVG sheet, as a DXF (Drawing Exchange Format, AutoCAD R12) file and as a
//   PDF on A4, A3 or Letter pages (whole templates per page where they fit, else overlapping strips).
// Lengths in mm. Template layout coordinates: x to the right, y up, origin at the lower left corner.

import { strToU8, zipSync, zlibSync } from 'fflate';
import { fixed, tr } from '../i18n/index.js';
import { xmlEscape } from './threemf.js';

/** Paper sizes (mm, portrait). */
export const PAPERS = Object.freeze({ a4: [210, 297], a3: [297, 420], letter: [215.9, 279.4] });
/** Page margin and overlap of neighbouring pages (mm). */
export const PAGE_MARGIN = 10;
export const PAGE_OVERLAP = 10;

/** Margin of a template frame around the profiles of its segment, gap between templates (mm). */
export const FRAME = 10;
const GAP = 15;
const TEXT = 3.5;
const LINE = 5;
/** Synchronisation marks per profile (numbered 0 to MARKS). */
export const MARKS = 20;
const TICK = 3;

const num = (v, d = 6) => {
  const s = v.toFixed(d);
  return s === `-${(0).toFixed(d)}` ? (0).toFixed(d) : s;
};

const pad = (i) => String(i + 1).padStart(2, '0');
const endKey = (e) => (e === 0 ? 'inboard' : 'outboard');

/** ASCII name for file headers: umlauts written out, other characters outside printable ASCII dropped. */
export function asciiName(name) {
  return (
    String(name || 'wing')
      .normalize('NFC')
      .replace(/[äöüÄÖÜß]/g, (c) => ({ ä: 'ae', ö: 'oe', ü: 'ue', Ä: 'Ae', Ö: 'Oe', Ü: 'Ue', ß: 'ss' })[c])
      .normalize('NFKD')
      .replace(/[^\x20-\x7e]/g, '')
      .trim() || 'wing'
  );
}

/** End profile normalized to chord 1: leading edge at (0, 0), trailing-edge midpoint at (1, 0). */
export function normalizedProfile(end) {
  const [lx, lh] = end.le;
  const phi = Math.atan2(end.te[1] - lh, end.te[0] - lx);
  const c = Math.cos(phi);
  const s = Math.sin(phi);
  return end.points.map(([x, h]) => {
    const dx = x - lx;
    const dh = h - lh;
    return [(dx * c + dh * s) / end.chord, (-dx * s + dh * c) / end.chord];
  });
}

/**
 * One end profile as a .dat file (Selig order: upper trailing edge, leading edge, lower trailing
 * edge; one "x y" pair per line after the name line). normalized: chord 1, else mm in the block frame.
 */
export function profileDat(name, seg, e, normalized = false) {
  const end = seg.ends[e];
  const pts = normalized ? normalizedProfile(end) : end.points;
  const d = normalized ? 7 : 6;
  const head = `${asciiName(name)} segment ${seg.index + 1} ${endKey(e)} y=${num(end.y, 1)} mm${normalized ? ` chord=${num(end.chord, 3)} mm` : ''}`;
  return `${head}\n${pts.map(([x, h]) => `${num(x, d)} ${num(h, d)}`).join('\n')}\n`;
}

const CSV_HEAD = [
  'segment',
  'y_inboard_mm',
  'y_outboard_mm',
  'core_length_mm',
  'axis_angle_deg',
  'block_width_mm',
  'block_height_mm',
  'deviation_mm',
  'deviation_y_mm',
  ...['inboard', 'outboard'].flatMap((e) => ['chord', 'le_x', 'le_h', 'te_x', 'te_h', 'incidence_deg', 'wedge_angle_deg', 'wedge_depth', 'wedge_side'].map((k) => `${e}_${k}${/_(x|h)$|^chord$|depth$/.test(k) ? '_mm' : ''}`)),
];

/** segments.csv: one row per segment, decimal point, comma separated. */
export function segmentsCsv(segments) {
  const rows = segments.map((s) => [
    s.index + 1,
    num(s.ya, 3),
    num(s.yb, 3),
    num(s.length, 3),
    num(s.axis, 4),
    num(s.width, 3),
    num(s.height, 3),
    s.deviation ? num(s.deviation.max, 4) : '',
    s.deviation ? num(s.deviation.y, 1) : '',
    ...s.ends.flatMap((e) => [num(e.chord, 3), num(e.le[0], 3), num(e.le[1], 3), num(e.te[0], 3), num(e.te[1], 3), num(e.incidence, 4), e.wedge ? num(e.wedge.angle, 4) : '0', e.wedge ? num(e.wedge.depth, 3) : '0', e.wedge ? e.wedge.side : '']),
  ]);
  return `${[CSV_HEAD, ...rows].map((r) => r.join(',')).join('\n')}\n`;
}

/** README.txt of the profile ZIP, in the interface language. */
function readme(name, segments) {
  return [
    segments.length === 1
      ? tr('Foam cores of {name}: 1 segment per half wing. Lengths in mm, angles in degrees.', { name })
      : tr('Foam cores of {name}: {n} segments per half wing. Lengths in mm, angles in degrees.', { name, n: segments.length }),
    '',
    tr('mm/: end profiles in the block frame: x chordwise towards the trailing edge, h up, square to the core axis; origin at the front lower corner of the smallest block that holds both profiles of the segment (the templates add 10 mm all round). Both files of a segment share this frame and the point count: point i of the inboard profile and point i of the outboard profile lie on one straight line of the core.'),
    tr('normalized/: the same profiles scaled to chord 1, leading edge at (0, 0), trailing-edge midpoint at (1, 0). segments.csv lists chord, leading-edge position and incidence (nose up positive) of each end, to place them in a cutting program.'),
    tr('Point order: upper trailing edge, leading edge, lower trailing edge (Selig). No kerf offset: the cutting program adds it.'),
    tr('Each core is cut with parallel end faces square to its axis. At a joint of two cores, or at the root or tip, the end face is sanded to the joint plane: segments.csv lists the wedge (angle, depth along the axis, surface where it is deepest).'),
    tr('The files describe the right half. The left half is the mirror image: cut the same profiles with inboard and outboard sides swapped.'),
    '',
  ].join('\r\n');
}

/** ZIP with mm/ and normalized/ .dat files, segments.csv and README.txt. */
export function profileZip(name, segments) {
  const files = {
    'README.txt': strToU8(readme(name, segments)),
    'segments.csv': strToU8(segmentsCsv(segments)),
  };
  for (const s of segments) {
    for (const e of [0, 1]) {
      const file = `segment-${pad(s.index)}-${endKey(e)}.dat`;
      files[`mm/${file}`] = strToU8(profileDat(name, s, e, false));
      files[`normalized/${file}`] = strToU8(profileDat(name, s, e, true));
    }
  }
  return zipSync(files, { level: 6, mtime: new Date(2026, 0, 1) });
}

/**
 * Closed polygon offset outward by `dist` (mm) with mitred corners (miter at most 4 dist). The
 * polygon may repeat its first point at the end (a closed trailing edge); the repeat is dropped.
 */
export function offsetPolygon(points, dist) {
  const P = points.filter((p, i) => i === 0 || Math.hypot(p[0] - points[i - 1][0], p[1] - points[i - 1][1]) > 1e-9);
  if (P.length > 2 && Math.hypot(P[0][0] - P[P.length - 1][0], P[0][1] - P[P.length - 1][1]) <= 1e-9) P.pop();
  if (!(dist > 0) || P.length < 3) return P;
  let area = 0;
  for (let i = 0; i < P.length; i++) {
    const a = P[i];
    const b = P[(i + 1) % P.length];
    area += a[0] * b[1] - b[0] * a[1];
  }
  const sign = area > 0 ? 1 : -1;
  const normal = (a, b) => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const L = Math.hypot(dx, dy) || 1;
    return [(sign * dy) / L, (-sign * dx) / L];
  };
  return P.map((p, i) => {
    const n1 = normal(P[(i - 1 + P.length) % P.length], p);
    const n2 = normal(p, P[(i + 1) % P.length]);
    let mx = n1[0] + n2[0];
    let my = n1[1] + n2[1];
    const L = Math.hypot(mx, my);
    if (L < 1e-12) {
      mx = n1[0];
      my = n1[1];
    } else {
      mx /= L;
      my /= L;
    }
    const cos = mx * n1[0] + my * n1[1];
    const m = Math.min(dist / Math.max(cos, 1e-12), 4 * dist);
    return [p[0] + m * mx, p[1] + m * my];
  });
}

/** Outward unit normal at vertex i of a polygon (by its orientation). */
function vertexNormal(P, i, sign) {
  const a = P[Math.max(0, i - 1)];
  const b = P[Math.min(P.length - 1, i + 1)];
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const L = Math.hypot(dx, dy) || 1;
  return [(sign * dy) / L, (-sign * dx) / L];
}

/** Indices of the synchronisation marks: MARKS + 1 points spread evenly over the point list. */
export function markIndices(n) {
  return [...new Set(Array.from({ length: MARKS + 1 }, (_, i) => Math.round((i * (n - 1)) / MARKS)))];
}

/** Words of `text` in lines of at most `width` mm at text size `size` (0.55 size per character). */
export function wrapText(text, width, size = TEXT) {
  const max = Math.max(20, Math.floor(width / (0.55 * size)));
  const lines = [];
  let line = '';
  for (const word of String(text).split(' ')) {
    if (line && line.length + 1 + word.length > max) {
      lines.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  return lines;
}

const wedgeText = (w) =>
  w.side === 'upper'
    ? tr('Sand the end face to the joint: wedge {angle}°, {depth} mm deep at the upper surface.', { angle: fixed(w.angle, 2), depth: fixed(w.depth, 2) })
    : tr('Sand the end face to the joint: wedge {angle}°, {depth} mm deep at the lower surface.', { angle: fixed(w.angle, 2), depth: fixed(w.depth, 2) });

/** Items moved by (dx, dy). */
const moved = (items, dx, dy) => items.map((it) => (it.points ? { ...it, points: it.points.map(([x, y]) => [x + dx, y + dy]) } : { ...it, x: it.x + dx, y: it.y + dy }));

/** Width (mm) of a block: its frames and outlines, and its texts at 0.55 of the size per character. */
function blockWidth(items) {
  let w = 0;
  for (const it of items) {
    if (it.points) for (const [x] of it.points) w = Math.max(w, x);
    else w = Math.max(w, it.x + 0.55 * it.size * it.text.length);
  }
  return Math.ceil(w + 1);
}

/**
 * The template blocks: a header (scale bar and instructions), then for each segment the inboard and
 * the outboard template, each a block of text lines above a frame with the profile, its kerf outline
 * and the numbered marks. Returns [{ width, height, items, label }] in block coordinates (mm, origin
 * at the lower left corner); items: { kind: 'profile' | 'frame' | 'mark' | 'text', points?, closed?,
 * x?, y?, size?, text? }.
 */
export function templateBlocks(name, segments, { kerf = 0 } = {}) {
  const blocks = [];
  const header = [
    tr('{name}: foam-core templates, scale 1:1, mm. Check the 100 mm scale bar after printing.', { name }),
    tr('Fix the two templates of a segment to the block ends with their frames flush with the bottom and front edges of the block.'),
    tr('Marks with equal numbers are passed at the same time. The left half uses the same templates, turned over.'),
    kerf > 0 ? tr('Outlines offset outward by half the kerf: {offset} mm (kerf {kerf} mm).', { offset: fixed(kerf / 2, 2), kerf: fixed(kerf, 2) }) : tr('Outlines without kerf offset.'),
  ].flatMap((t) => wrapText(t, 180));
  {
    const items = [];
    const H = (header.length + 1) * LINE;
    // Scale bar: 100 mm with ticks every 10 mm.
    const bar = H - LINE + 1;
    items.push({ kind: 'frame', points: [[0, bar], [100, bar]], closed: false });
    for (let i = 0; i <= 10; i++) items.push({ kind: 'frame', points: [[i * 10, bar], [i * 10, bar + (i % 5 ? 1.5 : 3)]], closed: false });
    items.push({ kind: 'text', x: 103, y: bar, size: TEXT, text: tr('100 mm') });
    header.forEach((t, i) => items.push({ kind: 'text', x: 0, y: H - (i + 2) * LINE + 1, size: TEXT, text: t }));
    blocks.push({ width: blockWidth(items), height: H, items, label: '' });
  }
  for (const s of segments) {
    const fw = s.width + 2 * FRAME;
    const fh = s.height + 2 * FRAME;
    for (const e of [0, 1]) {
      const end = s.ends[e];
      const which = e === 0 ? tr('inboard end') : tr('outboard end');
      const title = tr('Segment {i} of {n}, {end}', { i: s.index + 1, n: segments.length, end: which });
      const lines = [
        title,
        tr('y = {y} mm, core length {length} mm, block {width} × {height} mm', { y: fixed(end.y, 1), length: fixed(s.length, 1), width: fixed(fw, 0), height: fixed(fh, 0) }),
        tr('Chord {chord} mm, incidence {incidence}°', { chord: fixed(end.chord, 1), incidence: fixed(end.incidence, 2) }),
        ...(end.wedge ? [wedgeText(end.wedge)] : []),
      ].flatMap((t) => wrapText(t, Math.max(fw, 150)));
      const items = [];
      const height = fh + 2 + lines.length * LINE;
      lines.forEach((t, i) => items.push({ kind: 'text', x: 0, y: height - (i + 1) * LINE + 1, size: TEXT, text: t }));
      items.push({ kind: 'frame', points: [[0, 0], [fw, 0], [fw, fh], [0, fh]], closed: true });
      const P = end.points.map(([x, h]) => [FRAME + x, FRAME + h]);
      items.push({ kind: 'profile', points: offsetPolygon(P, kerf / 2), closed: true });
      // Marks on the profile (outside the kerf outline): ticks outward with their number.
      let area = 0;
      for (let i = 0; i < P.length; i++) area += P[i][0] * P[(i + 1) % P.length][1] - P[(i + 1) % P.length][0] * P[i][1];
      const sign = area > 0 ? 1 : -1;
      const off = kerf / 2;
      markIndices(P.length).forEach((idx, k) => {
        const p = P[idx];
        const [nx, ny] = vertexNormal(P, idx, sign);
        items.push({ kind: 'mark', points: [[p[0] + off * nx, p[1] + off * ny], [p[0] + (off + TICK) * nx, p[1] + (off + TICK) * ny]], closed: false });
        items.push({ kind: 'text', x: p[0] + (off + TICK + 1.5) * nx - 1, y: p[1] + (off + TICK + 1.5) * ny - 1, size: 2, text: String(k) });
      });
      blocks.push({ width: blockWidth(items), height, items, label: title });
    }
  }
  return blocks;
}

/**
 * The template blocks stacked on one sheet (SVG, DXF), GAP mm apart. Returns { width, height, items,
 * blocks } (mm, y up, origin at the lower left corner).
 */
export function templateLayout(name, segments, opts = {}) {
  const blocks = templateBlocks(name, segments, opts);
  const height = blocks.reduce((a, b) => a + b.height, 0) + GAP * (blocks.length - 1);
  const items = [];
  let top = height;
  for (const b of blocks) {
    items.push(...moved(b.items, 0, top - b.height));
    top -= b.height + GAP;
  }
  return { width: Math.max(...blocks.map((b) => b.width)), height: Math.ceil(height), items, blocks };
}

const STROKE = { profile: 0.25, frame: 0.18, mark: 0.18 };

/** The layout as one SVG sheet at 1:1 (width and height in mm). */
export function layoutSvg(layout) {
  const { width: W, height: H } = layout;
  const Y = (y) => num(H - y, 3);
  const out = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}mm" height="${H}mm" viewBox="0 0 ${W} ${H}">`,
    '<rect width="100%" height="100%" fill="#ffffff"/>',
  ];
  for (const it of layout.items) {
    if (it.kind === 'text') {
      out.push(`<text x="${num(it.x, 3)}" y="${Y(it.y)}" font-family="Helvetica, Arial, sans-serif" font-size="${it.size}" fill="#000000">${xmlEscape(it.text)}</text>`);
    } else {
      const pts = it.points.map(([x, y]) => `${num(x, 3)},${Y(y)}`).join(' ');
      const color = it.kind === 'mark' ? '#c0392b' : it.kind === 'frame' ? '#555555' : '#000000';
      out.push(`<${it.closed ? 'polygon' : 'polyline'} class="${it.kind}" points="${pts}" fill="none" stroke="${color}" stroke-width="${STROKE[it.kind]}"/>`);
    }
  }
  out.push('</svg>', '');
  return out.join('\n');
}

const DXF_LAYERS = { profile: ['PROFILE', 7], frame: ['FRAME', 8], mark: ['MARKS', 1], text: ['TEXT', 5] };

/** DXF text: ° as %%d, other characters of the Basic Multilingual Plane as \U+XXXX, characters beyond it as ?. */
export function dxfText(s) {
  return String(s)
    .replace(/°/g, '%%d')
    .replace(/[^\x20-\x7e]/gu, (c) => {
      const cp = c.codePointAt(0);
      return cp > 0xffff ? '?' : `\\U+${cp.toString(16).toUpperCase().padStart(4, '0')}`;
    });
}

/** The layout as an ASCII DXF of AutoCAD R12 (AC1009), units mm. */
export function layoutDxf(layout) {
  const g = [];
  const pair = (code, value) => g.push(String(code), String(value));
  pair(0, 'SECTION');
  pair(2, 'HEADER');
  pair(9, '$ACADVER');
  pair(1, 'AC1009');
  pair(9, '$INSUNITS');
  pair(70, 4);
  pair(9, '$EXTMIN');
  pair(10, 0);
  pair(20, 0);
  pair(30, 0);
  pair(9, '$EXTMAX');
  pair(10, layout.width);
  pair(20, layout.height);
  pair(30, 0);
  pair(0, 'ENDSEC');
  pair(0, 'SECTION');
  pair(2, 'TABLES');
  pair(0, 'TABLE');
  pair(2, 'LTYPE');
  pair(70, 1);
  pair(0, 'LTYPE');
  pair(2, 'CONTINUOUS');
  pair(70, 0);
  pair(3, 'Solid line');
  pair(72, 65);
  pair(73, 0);
  pair(40, 0);
  pair(0, 'ENDTAB');
  pair(0, 'TABLE');
  pair(2, 'LAYER');
  pair(70, Object.keys(DXF_LAYERS).length);
  for (const [name, color] of Object.values(DXF_LAYERS)) {
    pair(0, 'LAYER');
    pair(2, name);
    pair(70, 0);
    pair(62, color);
    pair(6, 'CONTINUOUS');
  }
  pair(0, 'ENDTAB');
  pair(0, 'ENDSEC');
  pair(0, 'SECTION');
  pair(2, 'ENTITIES');
  for (const it of layout.items) {
    const layer = DXF_LAYERS[it.kind][0];
    if (it.kind === 'text') {
      pair(0, 'TEXT');
      pair(8, layer);
      pair(10, num(it.x, 4));
      pair(20, num(it.y, 4));
      pair(30, 0);
      pair(40, it.size);
      pair(1, dxfText(it.text));
      continue;
    }
    pair(0, 'POLYLINE');
    pair(8, layer);
    pair(66, 1);
    pair(10, 0);
    pair(20, 0);
    pair(30, 0);
    pair(70, it.closed ? 1 : 0);
    for (const [x, y] of it.points) {
      pair(0, 'VERTEX');
      pair(8, layer);
      pair(10, num(x, 4));
      pair(20, num(y, 4));
      pair(30, 0);
    }
    pair(0, 'SEQEND');
    pair(8, layer);
  }
  pair(0, 'ENDSEC');
  pair(0, 'EOF');
  return `${g.join('\r\n')}\r\n`;
}

// WinAnsiEncoding codes of characters outside Latin-1 (PDF Reference, appendix D).
const WIN_ANSI = { '€': 0x80, '‚': 0x82, '„': 0x84, '…': 0x85, '–': 0x96, '—': 0x97, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '™': 0x99 };

/** PDF string literal of `s` in WinAnsiEncoding; characters it lacks become '?'. */
function pdfString(s) {
  let out = '(';
  for (const ch of String(s)) {
    const cp = ch.codePointAt(0);
    let code = WIN_ANSI[ch];
    if (code === undefined) code = (cp >= 0x20 && cp <= 0x7e) || (cp >= 0xa0 && cp <= 0xff) ? cp : 0x3f;
    if (code === 0x28 || code === 0x29 || code === 0x5c) out += `\\${String.fromCharCode(code)}`;
    else if (code < 0x20 || code > 0x7e) out += `\\${code.toString(8).padStart(3, '0')}`;
    else out += String.fromCharCode(code);
  }
  return `${out})`;
}

/** Height (mm) at the bottom of the printable area for the scale bar and the page label. */
const PAGE_FOOT = 12;
/** Space above a strip of a split block for its label (mm). */
const PART_LABEL = 5;

/**
 * Pages of the template blocks on `paper` (PAPERS key): blocks flow from the top of a page down and
 * start a new page where they do not fit; a block wider or taller than the printable area is cut into
 * strips that overlap by PAGE_OVERLAP. The orientation with the fewer split blocks is taken, then the
 * one with the fewer pages, portrait on a tie. Returns { pageW, pageH, area: [w, h], pages, split
 * (blocks cut into strips), pieces: [{ page, block, x0, y0, w, h, px, py, col, row, cols, rows }] } (x0, y0: the strip's lower left corner in block coordinates; px, py: its
 * lower left corner in the printable area). With { pieces: false } the strips are counted, not
 * stored (pieces is empty): the page count of the dialog summary.
 */
export function pagePlan(layout, paper = 'a4', { pieces: keep = true } = {}) {
  const [pw, ph] = PAPERS[paper] ?? PAPERS.a4;
  const plan = ([W, H]) => {
    const aw = W - 2 * PAGE_MARGIN;
    const ah = H - 2 * PAGE_MARGIN - PAGE_FOOT;
    const pieces = [];
    let page = 0;
    let free = ah;
    let splitBlocks = 0;
    for (const [bi, b] of layout.blocks.entries()) {
      const cols = b.width <= aw ? 1 : Math.ceil((b.width - PAGE_OVERLAP) / (aw - PAGE_OVERLAP));
      const split = cols > 1 || b.height > ah;
      const hMax = ah - (split ? PART_LABEL : 0);
      const rows = b.height <= hMax ? 1 : Math.ceil((b.height - PAGE_OVERLAP) / (hMax - PAGE_OVERLAP));
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x0 = c * (aw - PAGE_OVERLAP);
          const w = Math.min(aw, b.width - x0);
          const yTop = b.height - r * (hMax - PAGE_OVERLAP);
          const h = Math.min(hMax, yTop);
          const need = h + (split ? PART_LABEL : 0);
          if (need > free + 1e-9 && free < ah) {
            page++;
            free = ah;
          }
          if (keep) pieces.push({ page, block: bi, x0, y0: yTop - h, w, h, px: 0, py: free - need, col: c, row: r, cols, rows });
          free -= need + GAP;
        }
      }
      if (cols > 1 || rows > 1) splitBlocks++;
    }
    return { pageW: W, pageH: H, area: [aw, ah], pages: page + 1, split: splitBlocks, pieces };
  };
  const portrait = plan([pw, ph]);
  const landscape = plan([ph, pw]);
  const better = landscape.split < portrait.split || (landscape.split === portrait.split && landscape.pages < portrait.pages);
  return better ? landscape : portrait;
}

const PT = 72 / 25.4;

/**
 * Registration crosses of a block cut into strips (pagePlan), in block coordinates: one per pair of
 * neighbouring strips, in the middle of their overlap and of the span both strips share.
 */
export function registrationCrosses(plan, block) {
  const strips = plan.pieces.filter((q) => q.block === block);
  const byCell = new Map(strips.map((q) => [`${q.col},${q.row}`, q]));
  const at = (c, r) => byCell.get(`${c},${r}`);
  const out = [];
  for (const s of strips) {
    const right = at(s.col + 1, s.row);
    if (right) out.push([(right.x0 + s.x0 + s.w) / 2, s.y0 + s.h / 2]);
    const below = at(s.col, s.row + 1);
    if (below) out.push([s.x0 + s.w / 2, (s.y0 + below.y0 + below.h) / 2]);
  }
  return out;
}

/**
 * The template blocks as a PDF at 1:1 on pages of `paper` (pagePlan), with a scale bar and a page
 * label on every page, and registration crosses in the overlap of the strips of a split block.
 */
export function layoutPdf(layout, paper = 'a4', { title = 'Templates' } = {}) {
  const plan = pagePlan(layout, paper);
  const f = (v) => num(v, 3);
  const ox = PAGE_MARGIN;
  const oy = PAGE_MARGIN + PAGE_FOOT;
  const draw = (ops, items) => {
    for (const it of items) {
      if (it.kind === 'text') {
        ops.push(`BT /F1 ${f(it.size)} Tf ${f(it.x)} ${f(it.y)} Td ${pdfString(it.text)} Tj ET`);
        continue;
      }
      const color = it.kind === 'mark' ? '0.75 0.22 0.17 RG' : it.kind === 'frame' ? '0.33 0.33 0.33 RG' : '0 0 0 RG';
      const path = it.points.map(([x, y], k) => `${f(x)} ${f(y)} ${k ? 'l' : 'm'}`).join(' ');
      ops.push(`${color} ${STROKE[it.kind]} w ${path} ${it.closed ? 'h ' : ''}S`);
    }
  };
  // Registration crosses once per split block; each strip draws those inside it.
  const crossesOf = new Map();
  const pages = Array.from({ length: plan.pages }, (_, i) => {
    const ops = [`${f(PT)} 0 0 ${f(PT)} 0 0 cm`, '0 0 0 RG 0 0 0 rg 1 J 1 j'];
    // Foot: scale bar and page label.
    const by = PAGE_MARGIN + 4;
    ops.push('0.2 w', `${f(PAGE_MARGIN)} ${f(by)} m ${f(PAGE_MARGIN + 100)} ${f(by)} l S`);
    for (let k = 0; k <= 10; k++) ops.push(`${f(PAGE_MARGIN + 10 * k)} ${f(by)} m ${f(PAGE_MARGIN + 10 * k)} ${f(by + (k % 5 ? 1.5 : 3))} l S`);
    ops.push(`BT /F1 3 Tf ${f(PAGE_MARGIN + 103)} ${f(by - 0.5)} Td ${pdfString(tr('100 mm. Page {page} of {pages}.', { page: i + 1, pages: plan.pages }))} Tj ET`);
    for (const pc of plan.pieces.filter((q) => q.page === i)) {
      const b = layout.blocks[pc.block];
      const split = pc.cols > 1 || pc.rows > 1;
      const X = ox + pc.px;
      const Y = oy + pc.py;
      if (split) {
        const label = tr('{label}: part {part} of {parts} (row {row}, column {col})', { label: b.label || title, part: pc.row * pc.cols + pc.col + 1, parts: pc.rows * pc.cols, row: pc.row + 1, col: pc.col + 1 });
        ops.push(`BT /F1 3 Tf ${f(X)} ${f(Y + pc.h + 1.5)} Td ${pdfString(label)} Tj ET`);
      }
      // The clip reaches 0.5 mm past the strip, so frame lines on its edge print whole.
      ops.push('q', `${f(X - 0.5)} ${f(Y - 0.5)} ${f(pc.w + 1)} ${f(pc.h + 1)} re W n`, `1 0 0 1 ${f(X - pc.x0)} ${f(Y - pc.y0)} cm`);
      draw(ops, b.items);
      if (split) {
        // Registration crosses in the overlaps, one per pair of neighbouring strips: in the middle of
        // the overlap, and in the middle of the row (or column) both strips share, so it prints on both.
        ops.push('0 0 0 RG 0.15 w');
        const cross = (x, y) => ops.push(`${f(x - 3)} ${f(y)} m ${f(x + 3)} ${f(y)} l ${f(x)} ${f(y - 3)} m ${f(x)} ${f(y + 3)} l S`);
        if (!crossesOf.has(pc.block)) crossesOf.set(pc.block, registrationCrosses(plan, pc.block));
        for (const [x, y] of crossesOf.get(pc.block)) if (x >= pc.x0 && x <= pc.x0 + pc.w && y >= pc.y0 && y <= pc.y0 + pc.h) cross(x, y);
      }
      ops.push('Q');
    }
    return ops.join('\n');
  });
  // Objects: 1 catalog, 2 pages, 3 font, 4 info, then per page: page, content.
  const enc = new TextEncoder();
  const chunks = [];
  const offsets = [];
  let length = 0;
  const push = (data) => {
    const bytes = typeof data === 'string' ? enc.encode(data) : data;
    chunks.push(bytes);
    length += bytes.length;
  };
  const obj = (n, body) => {
    offsets[n] = length;
    if (typeof body === 'string') push(`${n} 0 obj\n${body}\nendobj\n`);
    else {
      push(`${n} 0 obj\n${body.dict}\nstream\n`);
      push(body.data);
      push('\nendstream\nendobj\n');
    }
  };
  push('%PDF-1.4\n');
  // A comment of bytes above 127 marks the file as binary.
  push(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));
  const kids = pages.map((_, i) => `${5 + 2 * i} 0 R`).join(' ');
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, `<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`);
  obj(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  obj(4, `<< /Title ${pdfString(title)} /Producer (Wingdesigner) >>`);
  pages.forEach((content, i) => {
    const n = 5 + 2 * i;
    obj(n, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${f(plan.pageW * PT)} ${f(plan.pageH * PT)}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${n + 1} 0 R >>`);
    const data = zlibSync(enc.encode(content), { level: 6 });
    obj(n + 1, { dict: `<< /Length ${data.length} /Filter /FlateDecode >>`, data });
  });
  const count = 5 + 2 * pages.length;
  const xref = length;
  let table = `xref\n0 ${count}\n0000000000 65535 f \n`;
  for (let n = 1; n < count; n++) table += `${String(offsets[n]).padStart(10, '0')} 00000 n \n`;
  push(`${table}trailer\n<< /Size ${count} /Root 1 0 R /Info 4 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  const out = new Uint8Array(length);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}
