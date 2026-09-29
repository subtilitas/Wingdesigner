import { describe, expect, it } from 'vitest';
import { decodeText, parseDat, parseNumbers, toSeligDat } from '../src/airfoil/parse.js';
import { DUPLICATE_DISTANCE, LIMITS, checkAirfoil, importAirfoilText } from '../src/airfoil/sanity.js';
import { profileCurve } from '../src/geom/profile.js';
import { nacaAirfoil, parseNacaCode } from '../src/airfoil/naca.js';
import {
  airfoilStats,
  leadingEdgeIndex,
  normalize,
  segmentsCross,
  selfIntersections,
  setTrailingEdgeGap,
  signedArea,
  splitSurfaces,
  yAt,
} from '../src/airfoil/geometry.js';

const codes = (issues) => issues.map((i) => i.code);

describe('NACA generator', () => {
  it('parses designations', () => {
    expect(parseNacaCode('NACA 2412')).toMatchObject({ series: 4, camber: 0.02, pos: 0.4, t: 0.12 });
    expect(parseNacaCode('naca0012')).toMatchObject({ series: 4, camber: 0, t: 0.12 });
    expect(parseNacaCode('23012')).toMatchObject({ series: 5, L: 2, P: 3, reflex: false, t: 0.12 });
    expect(parseNacaCode('23112')).toMatchObject({ reflex: true });
    expect(parseNacaCode('2400')).toBeNull();
    expect(parseNacaCode('2012')).toBeNull();
    expect(parseNacaCode('0412')).toBeNull();
    expect(parseNacaCode('03012')).toBeNull();
    expect(parseNacaCode('22212')).toBeNull();
    expect(parseNacaCode('21112')).toBeNull();
    expect(parseNacaCode('MH 45')).toBeNull();
    expect(() => nacaAirfoil('abc')).toThrow();
  });

  it('produces a symmetric 12 % section for NACA 0012', () => {
    const { points, name } = nacaAirfoil('0012', { pointsPerSide: 101 });
    expect(name).toBe('NACA 0012');
    expect(points.length).toBe(201);
    const s = airfoilStats(points);
    expect(s.maxThickness).toBeCloseTo(0.12, 3);
    expect(s.maxThicknessX).toBeGreaterThan(0.28);
    expect(s.maxThicknessX).toBeLessThan(0.32);
    expect(Math.abs(s.maxCamber)).toBeLessThan(1e-12);
    expect(s.teGap).toBeCloseTo(2 * 0.00126, 4);
    const closed = nacaAirfoil('0012', { closedTE: true });
    expect(airfoilStats(closed.points).teGap).toBeLessThan(1e-9);
  });

  it('places camber of NACA 2412 at 40 % chord', () => {
    const s = airfoilStats(nacaAirfoil('2412').points);
    expect(s.maxCamber).toBeCloseTo(0.02, 3);
    expect(s.maxCamberX).toBeGreaterThan(0.37);
    expect(s.maxCamberX).toBeLessThan(0.43);
  });

  it('builds 5-digit standard and reflex camber lines', () => {
    const s = airfoilStats(nacaAirfoil('23012').points);
    expect(s.maxCamber).toBeGreaterThan(0.017);
    expect(s.maxCamber).toBeLessThan(0.02);
    expect(s.maxCamberX).toBeGreaterThan(0.12);
    expect(s.maxCamberX).toBeLessThan(0.18);
    const r = nacaAirfoil('23112').points;
    const { upper, lower } = splitSurfaces(r);
    // Reflex: camber line close to zero near the trailing edge.
    const c95 = (yAt(upper, 0.95) + yAt(lower, 0.95)) / 2;
    expect(Math.abs(c95)).toBeLessThan(0.002);
    expect(checkAirfoil(r).ok).toBe(true);
  });
});

describe('.dat parser', () => {
  const selig = `NACA 0012 test\n1.0 0.00126\n0.5 0.05\n0.0 0.0\n0.5 -0.05\n1.0 -0.00126\n`;

  it('reads Selig files', () => {
    const r = parseDat(selig);
    expect(r.name).toBe('NACA 0012 test');
    expect(r.format).toBe('selig');
    expect(r.points).toEqual([
      [1, 0.00126],
      [0.5, 0.05],
      [0, 0],
      [0.5, -0.05],
      [1, -0.00126],
    ]);
  });

  it('reads Lednicer files and merges the shared leading edge', () => {
    const txt = `CLARK Y-ish\n 3.  3.\n\n0.0 0.0\n0.5 0.08\n1.0 0.001\n\n0.0 0.0\n0.5 -0.03\n1.0 -0.001\n`;
    const r = parseDat(txt);
    expect(r.format).toBe('lednicer');
    expect(r.points).toEqual([
      [1, 0.001],
      [0.5, 0.08],
      [0, 0],
      [0.5, -0.03],
      [1, -0.001],
    ]);
  });

  it('splits Lednicer data when counts disagree', () => {
    const txt = `X\n 4. 4.\n0 0\n0.5 0.08\n1 0\n0 0\n0.5 -0.03\n1 0\n`;
    const r = parseDat(txt);
    expect(codes(r.issues)).toContain('lednicer-count');
    expect(r.points.length).toBe(5);
  });

  it('handles CRLF, commas, tabs, comments, BOM and Fortran exponents', () => {
    const txt = `\uFEFF# comment\r\nMy Foil\r\n1.0,\t0.0\r\n0.5; 0.06 7\r\n0.0 0.0D0\r\n0.5 -0.04\r\n1.0 0.0\r\nend of data\r\n`;
    const r = parseDat(txt);
    expect(r.name).toBe('My Foil');
    expect(r.points[2]).toEqual([0, 0]);
    expect(codes(r.issues)).toEqual(expect.arrayContaining(['extra-columns', 'ignored-lines']));
  });

  it('uses the file name for headerless files and scales percent coordinates', () => {
    const txt = `100 0\n50 6\n0 0\n50 -4\n100 0\n`;
    const r = parseDat(txt, { fileName: 'myfoil.dat' });
    expect(r.name).toBe('myfoil');
    expect(r.points[1]).toEqual([0.5, 0.06]);
    expect(codes(r.issues)).toEqual(expect.arrayContaining(['no-name', 'percent']));
  });

  it('reverses clockwise files and removes duplicates', () => {
    const txt = `rev\n1 0\n0.5 -0.04\n0.5 -0.04\n0 0\n0.5 0.06\n1 0\n`;
    const r = parseDat(txt);
    expect(r.points[1]).toEqual([0.5, 0.06]);
    expect(codes(r.issues)).toEqual(expect.arrayContaining(['reversed', 'duplicates']));
  });

  it('reports empty input', () => {
    expect(codes(parseDat('').issues)).toContain('no-points');
    expect(codes(parseDat(null).issues)).toContain('no-points');
    expect(codes(parseDat('a name only\nand text').issues)).toContain('no-points');
  });

  it('round-trips through Selig text', () => {
    const a = nacaAirfoil('4415', { pointsPerSide: 31 });
    const r = parseDat(toSeligDat(a.name, a.points, 7));
    expect(r.name).toBe('NACA 4415');
    r.points.forEach((p, i) => {
      expect(p[0]).toBeCloseTo(a.points[i][0], 6);
      expect(p[1]).toBeCloseTo(a.points[i][1], 6);
    });
  });
});

describe('geometry helpers', () => {
  it('computes orientation and leading edge', () => {
    const pts = nacaAirfoil('2412').points;
    expect(signedArea(pts)).toBeGreaterThan(0);
    const le = leadingEdgeIndex(pts);
    expect(pts[le][0]).toBeLessThan(1e-3);
    const { upper, lower } = splitSurfaces(pts);
    expect(upper[0]).toEqual(lower[0]);
  });

  it('normalizes scaled and rotated data', () => {
    const base = nacaAirfoil('0012', { closedTE: true }).points;
    const scaled = base.map(([x, y]) => [200 * x + 10, 200 * y + 5]);
    const n = normalize(scaled);
    n.forEach((p, i) => {
      expect(p[0]).toBeCloseTo(base[i][0], 9);
      expect(p[1]).toBeCloseTo(base[i][1], 9);
    });
    const a = 0.1;
    const rot = base.map(([x, y]) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)]);
    const d = normalize(rot, { derotate: true });
    d.forEach((p, i) => {
      expect(p[0]).toBeCloseTo(base[i][0], 9);
      expect(p[1]).toBeCloseTo(base[i][1], 9);
    });
  });

  it('adjusts the trailing-edge gap without moving the leading edge', () => {
    const base = nacaAirfoil('2412').points;
    const g = setTrailingEdgeGap(base, 0.01);
    expect(airfoilStats(g).teGap).toBeCloseTo(0.01, 12);
    const le = leadingEdgeIndex(base);
    expect(g[le]).toEqual(base[le]);
    const c = setTrailingEdgeGap(base, 0);
    expect(Math.abs(airfoilStats(c).teGap)).toBeLessThan(1e-12);
  });

  it('detects crossings', () => {
    expect(segmentsCross([0, 0], [1, 1], [0, 1], [1, 0])).toBe(true);
    expect(segmentsCross([0, 0], [1, 0], [1, 0], [2, 1])).toBe(false);
    const bow = [
      [1, 0],
      [0.5, 0.05],
      [0, 0],
      [0.5, -0.05],
      [0.7, 0.06],
      [1, 0],
    ];
    expect(selfIntersections(bow).length).toBeGreaterThan(0);
    expect(yAt([[0, 1], [1, 3]], -1)).toBe(1);
    expect(yAt([[0, 1], [1, 3]], 2)).toBe(3);
    expect(yAt([[0, 1], [0, 3], [1, 5]], 0)).toBe(1);
  });
});

describe('sanity checks', () => {
  it('accepts a clean airfoil', () => {
    const r = checkAirfoil(nacaAirfoil('2412').points);
    expect(r.ok).toBe(true);
    expect(r.issues.filter((i) => i.severity !== 'info')).toEqual([]);
    expect(r.stats.maxThickness).toBeCloseTo(0.12, 2);
  });

  it('rejects too few points and zero chord', () => {
    expect(checkAirfoil([[0, 0]]).ok).toBe(false);
    expect(checkAirfoil(null).ok).toBe(false);
    const flat = Array.from({ length: 6 }, (_, i) => [0.5, i]);
    expect(codes(checkAirfoil(flat).issues)).toContain('zero-chord');
  });

  it('flags coarse, unnormalized, rotated and gapped data', () => {
    const base = nacaAirfoil('0012', { pointsPerSide: 8 }).points;
    const r = checkAirfoil(base.map(([x, y]) => [x * 150, y * 150]));
    expect(codes(r.issues)).toEqual(expect.arrayContaining(['coarse', 'not-normalized']));
    const a = 0.2;
    const rot = nacaAirfoil('0012').points.map(([x, y]) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)]);
    expect(codes(checkAirfoil(rot).issues)).toContain('rotated');
    const gap = setTrailingEdgeGap(nacaAirfoil('0012').points, 0.05);
    expect(codes(checkAirfoil(gap).issues)).toContain('te-gap');
    const crossed = setTrailingEdgeGap(nacaAirfoil('0012').points, -0.01);
    expect(codes(checkAirfoil(crossed).issues)).toContain('te-crossed');
  });

  it('flags thin, thick, spiky and truncated outlines', () => {
    expect(codes(checkAirfoil(nacaAirfoil('0005').points.map(([x, y]) => [x, y / 10])).issues)).toContain('thin');
    expect(codes(checkAirfoil(nacaAirfoil('0035').points).issues)).toContain('thick');
    const spiky = nacaAirfoil('2412').points.map((p) => p.slice());
    spiky[20][1] += 0.05;
    const res = checkAirfoil(spiky);
    expect(codes(res.issues)).toContain('spike');
    const pts = nacaAirfoil('0012').points;
    const rolled = pts.slice(40).concat(pts.slice(0, 40));
    expect(codes(checkAirfoil(rolled).issues)).toContain('te-missing');
  });

  it('flags self intersection and crossed surfaces', () => {
    const pts = nacaAirfoil('0012').points.map((p) => p.slice());
    // Push a lower-surface point far above the upper surface.
    const le = leadingEdgeIndex(pts);
    pts[le + 40][1] = 0.2;
    const r = checkAirfoil(pts);
    expect(r.ok).toBe(false);
    expect(codes(r.issues)).toEqual(expect.arrayContaining(['self-intersection']));
  });

  it('flags non-monotonic surfaces and single-surface data', () => {
    const pts = nacaAirfoil('0012').points.map((p) => p.slice());
    const le = leadingEdgeIndex(pts);
    const t = pts[le + 30];
    pts[le + 30] = pts[le + 31];
    pts[le + 31] = t;
    expect(codes(checkAirfoil(pts).issues)).toContain('non-monotonic');
    const line = Array.from({ length: 10 }, (_, i) => [i / 9, 0.01 * Math.sin(i)]);
    expect(checkAirfoil(line).ok).toBe(false);
  });

  it('imports text end to end', () => {
    const a = nacaAirfoil('2412');
    const ok = importAirfoilText(toSeligDat(a.name, a.points), 'x.dat');
    expect(ok.ok).toBe(true);
    expect(ok.format).toBe('selig');
    const bad = importAirfoilText('', 'empty.dat');
    expect(bad.ok).toBe(false);
  });
});

describe('parser variants', () => {
  it('reads decimal-comma X/Yo/Yu percent tables', () => {
    const txt = 'HS 3,4/12,0\r\n\r\nWoelbung:  3,40%\r\n  X      Yo       Yu\r\n  0      0,000    0,000\r\n  2,5    3,448   -1,770\r\n  30     8,0     -2,0\r\n  60     6,0     -1,0\r\n  100    0,100   -0,100\r\n';
    const r = parseDat(txt);
    expect(r.name).toBe('HS 3,4/12,0');
    expect(r.format).toBe('table');
    expect(r.points[0]).toEqual([1, 0.001]);
    expect(r.points[4]).toEqual([0, 0]);
    expect(r.points[r.points.length - 1]).toEqual([1, -0.001]);
    expect(codes(r.issues)).toEqual(expect.arrayContaining(['decimal-comma', 'table', 'percent', 'ignored-lines']));
  });

  it('keeps a three-column x y z file as Selig', () => {
    const txt = 'xyz\n1 0 0\n0.5 0.06 0\n0 0 0\n0.5 -0.04 0\n1 0 0\n';
    const r = parseDat(txt);
    expect(r.format).toBe('selig');
    expect(codes(r.issues)).toContain('extra-columns');
  });

  it('reads XML airfoil geometry', () => {
    const xml = `<?xml version="1.0"?><airfoil><name>Test &amp; Co</name><elements><element><coordinates>
      <point><x>1.0</x><y>0.0</y><z>0</z></point><point><x>0.5</x><y>0.06</y><z>0</z></point>
      <point><x>0.0</x><y>0.0</y><z>0</z></point><point><x>0.5</x><y>-0.04</y><z>0</z></point>
      <point><x>1.0</x><y>0.0</y><z>0</z></point></coordinates></element>
      <element><coordinates><point><x>1</x><y>0</y></point></coordinates></element></elements></airfoil>`;
    const r = parseDat(xml);
    expect(r.format).toBe('xml');
    expect(r.name).toBe('Test & Co');
    expect(r.points.length).toBe(5);
    expect(codes(r.issues)).toContain('multi-element');
    const unnamed = parseDat('<coordinates><point><x>1</x><y>0</y></point></coordinates>', { fileName: 'q.xml' });
    expect(unnamed.name).toBe('q');
    const empty = parseDat('<coordinates></coordinates>');
    expect(codes(empty.issues)).toContain('no-points');
    const nan = parseDat('<coordinates><point><x>a</x><y>0</y></point></coordinates>');
    expect(codes(nan.issues)).toContain('non-finite');
  });

  it('reads coordinates from HTML pre blocks', () => {
    const html = '<html><head><title>MH 99 Coordinates</title></head><body><pre><strong>   x   y</strong>\n1.0 0.0\n0.5 0.06\n0.0 0.0\n0.5 -0.04\n1.0 0.0\n</pre></body></html>';
    const r = parseDat(html);
    expect(r.name).toBe('MH 99 Coordinates');
    expect(r.points.length).toBe(5);
    expect(codes(r.issues)).toContain('html');
    const noPre = parseDat('<html><title>T &lt;1&gt; &#65;</title><body>1 0<br>0 0<br>1 -0.01</body></html>');
    expect(noPre.name).toBe('T <1> A');
    expect(noPre.points.length).toBe(3);
  });

  it('decodes UTF-8 and Windows-1252 bytes', () => {
    expect(decodeText(new Uint8Array([0xef, 0xbb, 0xbf, 0x41]))).toBe('A');
    expect(decodeText(new Uint8Array([0x57, 0xf6, 0x6c, 0x62]).buffer)).toBe('Wölb');
    expect(parseNumbers('1,5 2,25')).toEqual({ values: [1.5, 2.25], decimalComma: true });
    expect(parseNumbers('1.0,2.0')).toEqual({ values: [1, 2], decimalComma: false });
    expect(parseNumbers('x 1')).toBeNull();
  });
});

describe('parser hardening', () => {
  it('reads HTML tables with one cell per value', () => {
    const rows = [[1, 0], [0.5, 0.06], [0, 0], [0.5, -0.04], [1, 0]];
    const html = `<html><title>T</title><table>${rows.map(([x, y]) => `<tr><td>${x}</td><td>${y}</td></tr>`).join('')}</table></html>`;
    const r = parseDat(html);
    expect(r.points).toEqual(rows);
    const br = parseDat('<body>1 0<br/>0 0<br>1 -0.01</body>');
    expect(br.points.length).toBe(3);
  });

  it('reports malformed XML instead of throwing', () => {
    const r = parseDat('<airfoil><coordinates><point><x>1</x>', { fileName: 'bad.xml' });
    expect(r.name).toBe('bad');
    expect(codes(r.issues)).toEqual(['xml-malformed']);
    expect(importAirfoilText('<coordinates>', 'x.xml').ok).toBe(false);
  });
});

describe('column headers', () => {
  it('skips column header lines without a warning', () => {
    const r = parseDat('Foil\n  X      Yo       Yu\n0 0 0\n50 6 -4\n100 0 0\n');
    expect(r.format).toBe('table');
    expect(codes(r.issues)).not.toContain('ignored-lines');
    expect(codes(parseDat('Foil\nx/c y/c\n1 0\n0 0\n1 -0.01\n').issues)).not.toContain('ignored-lines');
    expect(codes(parseDat('Foil\nfree text\n1 0\n0 0\n1 -0.01\n').issues)).toContain('ignored-lines');
  });
});

describe('parser robustness', () => {
  const selig = (pts) => pts.map(([x, y]) => `${x} ${y}`).join('\n');

  it('reads semicolon-separated decimal-comma CSV', () => {
    const r = parseDat('Foil\n1,000084;0,001257\n0,5;0,06\n0;0\n0,5;-0,04\n1;-0,001257\n');
    expect(r.points[0]).toEqual([1.000084, 0.001257]);
    expect(r.points.length).toBe(5);
  });

  it('rejects empty XML coordinate values', () => {
    const r = parseDat('<coordinates><point><x>1</x><y></y></point><point><x>0</x><y>0</y></point></coordinates>');
    expect(codes(r.issues)).toContain('non-finite');
  });

  it('limits input size and parses unclosed tags in linear time', () => {
    expect(codes(parseDat('x'.repeat(2_000_001)).issues)).toContain('too-large');
    const t0 = performance.now();
    parseDat('<html>' + '<pre'.repeat(20000));
    parseDat('<coordinates>'.repeat(20000));
    expect(performance.now() - t0).toBeLessThan(500);
  });

  it('does not take a millimetre Selig file for Lednicer', () => {
    const pts = nacaAirfoil('0012', { pointsPerSide: 21 }).points.map(([x, y]) => [Math.round(x * 150 * 1e4) / 1e4, Math.round((y * 150 + (x > 0.999 ? 2 * Math.sign(y || 1) : 0)) * 1e4) / 1e4]);
    pts[0] = [150, 2];
    const r = parseDat(selig(pts), { fileName: 'mm.dat' });
    expect(r.format).toBe('selig');
    expect(r.points.length).toBe(pts.length);
  });

  it('removes the closing point after a blunt trailing edge and keeps a sharp closed one', () => {
    const blunt = nacaAirfoil('2412', { pointsPerSide: 31 }).points.map((p) => p.slice());
    blunt.push(blunt[0].slice());
    // Blunt base: make the last lower point share x with the first point.
    blunt[blunt.length - 2][0] = blunt[0][0];
    const r = parseDat(selig(blunt));
    expect(codes(r.issues)).toContain('closing-point');
    expect(r.points.length).toBe(blunt.length - 1);
    const sharp = nacaAirfoil('0012', { pointsPerSide: 31, closedTE: true }).points;
    const s = parseDat(selig(sharp));
    expect(codes(s.issues)).not.toContain('closing-point');
    expect(s.points.length).toBe(sharp.length);
  });

  it('reads large XML files in one pass and stops past the point limit', () => {
    const xml = (n) =>
      '<airfoil><name>T</name><coordinates>' +
      nacaAirfoil('2412', { pointsPerSide: Math.ceil((n + 1) / 2) })
        .points.slice(0, n)
        .map(([x, y]) => `<point><x>${x}</x><y>${y}</y></point>`)
        .join('\n') +
      '</coordinates></airfoil>';
    const t0 = performance.now();
    expect(parseDat(xml(4999)).points.length).toBe(4999);
    const big = parseDat(xml(20000));
    expect(performance.now() - t0).toBeLessThan(2000);
    expect(big.issues.find((i) => i.code === 'too-many-points').message).toMatch(/5001 or more points/);
  });

  it('reads three-column tables from the trailing edge to the leading edge', () => {
    const rows = [[1, 0.002, -0.002], [0.8, 0.04, -0.02], [0.5, 0.07, -0.03], [0.2, 0.06, -0.03], [0.05, 0.03, -0.015], [0, 0, 0]];
    const up = parseDat(rows.slice().reverse().map((r) => r.join(' ')).join('\n'));
    const down = parseDat(rows.map((r) => r.join(' ')).join('\n'));
    expect(down.format).toBe('table');
    expect(down.points).toEqual(up.points);
    expect(importAirfoilText(rows.map((r) => r.join(' ')).join('\n'), 't.dat').ok).toBe(true);
  });

  it('rejects more points than the limit without throwing', () => {
    let text = 'Many\n';
    for (let i = 0; i < 150000; i++) text += `${(i / 150000).toFixed(5)} 0\n`;
    expect(text.length).toBeLessThan(2_000_000);
    const r = importAirfoilText(text, 'many.dat');
    expect(r.ok).toBe(false);
    expect(codes(r.issues)).toContain('too-many-points');
    const dense = nacaAirfoil('2412', { pointsPerSide: 2600 }).points;
    expect(codes(checkAirfoil(dense).issues)).toContain('too-many-points');
  });

  it('keeps the first 200 characters of a long name line', () => {
    const pts = nacaAirfoil('2412', { pointsPerSide: 21 }).points;
    const r = parseDat([`N${'x'.repeat(2_000)}`, ...pts.map((p) => p.join(' '))].join('\n'));
    expect(r.name).toBe(`N${'x'.repeat(199)}`);
    expect(r.issues.find((i) => i.code === 'long-name').message).toBe('The name line has 2001 characters; the first 200 are used.');
    expect(r.points.length).toBe(pts.length);
  });

  it('stops reading coordinate lines after the point limit plus a Lednicer counts line', () => {
    // 400,000 short rows (1.6 MB): reading stops at row 5002.
    const text = 'Rows\n' + '0 0\n'.repeat(400000);
    const t0 = performance.now();
    const r = parseDat(text);
    expect(performance.now() - t0).toBeLessThan(500);
    expect(r.points).toEqual([]);
    expect(r.issues.find((i) => i.code === 'too-many-points').message).toBe('More than 5001 coordinate lines; the limit is 5000 points.');
    // A Lednicer file of 5001 rows (counts line and 2 x 2500 surface points) is read.
    const pts = nacaAirfoil('0012', { pointsPerSide: 2500 }).points;
    const le = pts.findIndex(([x]) => x === 0);
    const upper = pts.slice(0, le + 1).reverse();
    const lower = pts.slice(le);
    const lednicer = ['L', `${upper.length}. ${lower.length}.`, '', ...upper.map((p) => p.join(' ')), '', ...lower.map((p) => p.join(' '))].join('\n');
    const read = parseDat(lednicer);
    expect(read.format).toBe('lednicer');
    expect(read.points.length).toBe(upper.length + lower.length - 1);
    expect(1 + upper.length + lower.length).toBe(5001);
  });

  it('removes consecutive points closer than DUPLICATE_DISTANCE so the interpolation stays regular', () => {
    // A copy of a point one unit in the last place away: its chord-length parameter rounds to the
    // parameter of its neighbour and the collocation matrix becomes singular.
    const base = nacaAirfoil('2412').points;
    const next = (v) => {
      const b = new Float64Array([v]);
      new BigInt64Array(b.buffer)[0] += 1n;
      return b[0];
    };
    const pts = base.map((q) => q.slice());
    pts.splice(6, 0, [pts[5][0], next(pts[5][1])]);
    const r = checkAirfoil(pts);
    expect(r.ok).toBe(true);
    expect(r.points.length).toBe(base.length);
    expect(r.issues.find((i) => i.code === 'duplicates').message).toMatch(/1 consecutive point\(s\) closer than 1e-9 chord/);
    for (const parametrization of ['centripetal', 'chord', 'uniform']) expect(() => profileCurve(r.points, { parametrization })).not.toThrow();
    expect(DUPLICATE_DISTANCE).toBe(1e-9);
  });

  it('rejects outlines longer than LIMITS.maxOutlineLength chords before the crossing test', () => {
    // Serpentine without crossings: 5000 points, 50 chords long.
    const serpentine = [];
    for (let row = 0; row < 50; row++) for (let i = 0; i < 100; i++) serpentine.push([row % 2 ? 1 - i / 99 : i / 99, row * 0.02]);
    const t0 = performance.now();
    const r = checkAirfoil(serpentine);
    expect(performance.now() - t0).toBeLessThan(1000);
    expect(codes(r.issues)).toContain('outline-length');
    expect(r.issues.find((i) => i.code === 'outline-length').message).toMatch(/is 5\d\.\d chords long/);
    expect(LIMITS.maxOutlineLength).toBe(10);
  });

  it('stops the crossing test at the hit limit for outlines of long crossing segments', () => {
    // 5000-point zigzags across the whole chord. Scattered heights: every segment crosses most
    // others and the test stops at 10 hits. Rising heights: no crossing, and every segment is long,
    // so the pairwise test is quadratic; checkAirfoil rejects the 5000-chord outline by its length
    // first (an outline of at most 10 chords holds at most about 42 long segments).
    const crossing = Array.from({ length: 5000 }, (_, i) => [i % 2, ((i * 7919) % 5000) / 5000]);
    const rising = Array.from({ length: 5000 }, (_, i) => [i % 2, i / 5000]);
    const t0 = performance.now();
    expect(selfIntersections(crossing, 10).length).toBe(10);
    expect(codes(checkAirfoil(rising).issues)).toContain('outline-length');
    expect(performance.now() - t0).toBeLessThan(2000);
  });

  it('finds the same crossings as the pairwise test', () => {
    let seed = 5;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const brute = (P) => {
      const h = [];
      for (let i = 0; i < P.length - 1; i++) for (let j = i + 2; j < P.length - 1; j++) if (segmentsCross(P[i], P[i + 1], P[j], P[j + 1])) h.push([i, j]);
      return h;
    };
    for (let t = 0; t < 400; t++) {
      const P = Array.from({ length: 4 + Math.floor(rnd() * 30) }, () => [rnd() * (rnd() < 0.2 ? 0 : 1), rnd() * (rnd() < 0.2 ? 0.001 : 1)]);
      if (rnd() < 0.3) P.push(P[0].slice());
      expect(selfIntersections(P, 1000)).toEqual(brute(P));
    }
    // Long segments (bounding box over 16 grid cells) mixed with short ones.
    for (let t = 0; t < 100; t++) {
      const P = Array.from({ length: 40 + Math.floor(rnd() * 80) }, (_, i) => (i % 5 ? [rnd() * 0.05, rnd() * 0.05] : [rnd(), rnd()]));
      expect(selfIntersections(P, 1e9)).toEqual(brute(P));
    }
  });

  it('rejects surfaces that touch inside the chord', () => {
    const touch = [
      [1, 0.002], [0.9, 0.02], [0.75, 0.03], [0.6, 0.015], [0.5, 0], [0.4, 0.03], [0.25, 0.05], [0.1, 0.04], [0, 0],
      [0.1, -0.03], [0.25, -0.04], [0.4, -0.02], [0.5, 0], [0.6, -0.015], [0.75, -0.03], [0.9, -0.02], [1, -0.002],
    ];
    const r = checkAirfoil(touch);
    expect(r.ok).toBe(false);
    expect(codes(r.issues)).toContain('surfaces-touch');
    expect(r.stats.minCoreThicknessX).toBeCloseTo(0.5, 12);
    // A vertical segment on the upper surface: its lower end touches.
    const vertical = touch.map((q) => q.slice());
    vertical.splice(5, 0, [0.5, 0.01]);
    expect(codes(checkAirfoil(vertical).issues)).toContain('surfaces-touch');
    // An upper surface that folds back: its segment (0.46, 0)-(0.54, 0) passes through the lower
    // vertex (0.5, 0) between two file points.
    const folded = [
      [1, 0.002], [0.9, 0.02], [0.75, 0.03], [0.6, 0.015], [0.54, 0], [0.46, 0], [0.56, 0.02], [0.4, 0.03], [0.25, 0.05], [0.1, 0.04], [0, 0],
      [0.1, -0.03], [0.25, -0.04], [0.4, -0.02], [0.5, 0], [0.6, -0.015], [0.75, -0.03], [0.9, -0.02], [1, -0.002],
    ];
    const f = checkAirfoil(folded);
    expect(codes(f.issues)).toContain('surfaces-touch');
    expect(f.stats.minCoreThicknessX).toBeCloseTo(0.5, 12);
    // Closed and cusped trailing edges are not contacts.
    for (const code of ['0006', '0012', '2412']) expect(checkAirfoil(nacaAirfoil(code, { closedTE: true }).points).ok).toBe(true);
  });

  it('removes a drawn trailing-edge base in both point orders', () => {
    const blunt = nacaAirfoil('2412', { pointsPerSide: 31 }).points;
    const gap = blunt[0][1] - blunt[blunt.length - 1][1];
    // Clockwise: lower TE first, closed by repeating it after the upper TE.
    const cw = blunt.slice().reverse();
    cw.push(cw[0].slice());
    const r1 = importAirfoilText(selig(cw), 'cw.dat');
    expect(r1.ok).toBe(true);
    expect(codes(r1.issues)).toContain('closing-point');
    expect(r1.stats.teGap).toBeCloseTo(gap, 6);
    // Outline starts and ends on the base at the TE midpoint.
    const mid = [blunt[0][0], (blunt[0][1] + blunt[blunt.length - 1][1]) / 2];
    const onBase = [mid, ...blunt, mid];
    const r2 = importAirfoilText(selig(onBase), 'mid.dat');
    expect(r2.ok).toBe(true);
    expect(r2.points.length).toBe(blunt.length);
    expect(r2.stats.teGap).toBeCloseTo(gap, 6);
    // The same outline from a project file (no parser) is flagged.
    expect(codes(checkAirfoil(onBase).issues)).toContain('te-base');
    expect(codes(checkAirfoil(blunt).issues)).not.toContain('te-base');
  });

  it('removes consecutive duplicates for every source and rejects outlines that miss the trailing edge', () => {
    const pts = nacaAirfoil('2412').points.map((p) => p.slice());
    pts.splice(30, 0, pts[30].slice());
    const r = checkAirfoil(pts);
    expect(r.ok).toBe(true);
    expect(codes(r.issues)).toContain('duplicates');
    const rolled = pts.slice(40).concat(pts.slice(0, 40));
    expect(checkAirfoil(rolled).ok).toBe(false);
  });
});
