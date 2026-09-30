import { afterEach, describe, expect, it } from 'vitest';
import { setLanguage, tr } from '../src/i18n/index.js';
import { airfoilFirstUseSeconds, formatSeconds } from '../src/model/budget.js';
import { MAX_INPUT, MAX_NAME, MAX_POINTS, decodeText, parseDat, parseNumbers, toSeligDat } from '../src/airfoil/parse.js';
import { DUPLICATE_DISTANCE, LIMITS, TE_CROSS_TOLERANCE, checkAirfoil, importAirfoilText } from '../src/airfoil/sanity.js';
import { profileCurve } from '../src/geom/profile.js';
import { leadingNacaCode, nacaAirfoil, parseNacaCode } from '../src/airfoil/naca.js';
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

  it('finds the NACA code that starts a name, as XFLR5 names flapped copies', () => {
    expect(leadingNacaCode('NACA0014_Flap')).toBe('0014');
    expect(leadingNacaCode('  naca - 2412 (flap)')).toBe('2412');
    expect(leadingNacaCode('NACA 23012 mod')).toBe('23012');
    // A longer digit run, an unsupported code or no NACA prefix: none.
    for (const name of ['NACA 001234', 'NACA 2400 flap', 'Clark Y', '0012 flap', '']) expect(leadingNacaCode(name)).toBeNull();
    // Linear in long runs of white space.
    const t0 = performance.now();
    expect(leadingNacaCode(`naca${' '.repeat(200_000)}x`)).toBeNull();
    expect(performance.now() - t0).toBeLessThan(1000);
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
    // Upper surface complete, lower surface ends at mid-chord: one end at the trailing edge is not enough.
    const le = pts.findIndex(([x]) => x === 0);
    const truncated = pts.slice(0, le + 1 + Math.floor((pts.length - le) / 2));
    const r = checkAirfoil(truncated);
    expect(r.ok).toBe(false);
    expect(r.issues.find((i) => i.code === 'te-missing').message).toMatch(/^The last point lies at \d+\.\d % chord, not at the trailing edge/);
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

  it('accepts a closed trailing edge whose end segments cross within 1e-4 chord', () => {
    // UIUC pattern (sd8000.dat and 18 other files of the Selig set): the outline starts at x = 1.00000
    // and ends at x = 1.00001, y = 0. The lower surface of NACA 6412 ends above y = 0, as the one of
    // SD8000 does, so the first and the last segment cross.
    const ending = (last) => {
      const pts = nacaAirfoil('6412', { closedTE: true }).points.map((p) => p.slice());
      pts[pts.length - 1] = last;
      return pts;
    };
    const crossing = ending([1.00001, 0]);
    expect(selfIntersections(crossing)).toEqual([[0, crossing.length - 2]]);
    const uiuc = checkAirfoil(ending([1.00001, 0]));
    expect(uiuc.ok).toBe(true);
    expect(codes(uiuc.issues)).not.toContain('self-intersection');
    // Ends 5e-4 chord apart: above TE_CROSS_TOLERANCE, the crossing counts.
    const wide = checkAirfoil(ending([1, 5e-4]));
    expect(wide.ok).toBe(false);
    expect(codes(wide.issues)).toEqual(expect.arrayContaining(['self-intersection', 'te-crossed']));
    expect(TE_CROSS_TOLERANCE).toBe(1e-4);
    // Any other crossing still counts next to an accepted end crossing.
    const both = ending([1.00001, 0]);
    both[leadingEdgeIndex(both) + 40][1] = 0.2;
    expect(codes(checkAirfoil(both).issues)).toContain('self-intersection');
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

  it('reads a percent Selig file whose trailing-edge row holds two integers as Selig', () => {
    const r = parseDat(['sparse', '100 2', '4 3', '0 0', '4 -3', '50 -5', '100 -2'].join('\n'));
    expect(r.format).toBe('selig');
    expect(r.points).toEqual([
      [1, 0.02],
      [0.04, 0.03],
      [0, 0],
      [0.04, -0.03],
      [0.5, -0.05],
      [1, -0.02],
    ]);
    // Counts that match the rows but split inside the lower surface: Selig.
    const lowerRows = Array.from({ length: 100 }, (_, i) => `${i + 1} ${(-0.05 * Math.sin((Math.PI * (i + 1)) / 101)).toFixed(4)}`);
    const exact = parseDat(['exact', '100 2', '1 0.2', '0 0', ...lowerRows].join('\n'));
    expect(exact.format).toBe('selig');
    expect(exact.points).toHaveLength(103);
    expect(exact.points[0]).toEqual([1, 0.02]);
    // A Lednicer file with matching counts still reads as Lednicer.
    const led = parseDat(['led', '3 3', '0 0', '0.5 0.06', '1 0', '0 0', '0.5 -0.04', '1 0'].join('\n'));
    expect(led.format).toBe('lednicer');
    expect(led.points).toHaveLength(5);
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
    // All predefined entities and character references as code points, in one pass.
    const named = parseDat(xml.replace('Test &amp; Co', 'A &apos;B&apos; &#x1F600; &#128512; &amp;lt; &#xD800;'));
    expect(named.name).toBe("A 'B' \u{1F600} \u{1F600} &lt; &#xD800;");
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
    // Decimal commas with exponents.
    expect(parseNumbers('1,0e-1 2,0D-2')).toEqual({ values: [0.1, 0.02], decimalComma: true });
    expect(parseNumbers('1e0 2,5E-1')).toEqual({ values: [1, 0.25], decimalComma: true });
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
    expect(codes(parseDat('x'.repeat(MAX_INPUT + 1)).issues)).toContain('too-large');
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
    // Short coordinates keep a file past the point limit within MAX_INPUT.
    const many = `<airfoil><name>T</name><coordinates>${'<point><x>0</x><y>0</y></point>'.repeat(MAX_POINTS + 50)}</coordinates></airfoil>`;
    expect(many.length).toBeLessThan(MAX_INPUT);
    const big = parseDat(many);
    expect(performance.now() - t0).toBeLessThan(3000);
    expect(big.issues.find((i) => i.code === 'too-many-points').message).toBe(`${(MAX_POINTS + 1).toLocaleString('en')} or more points; the limit is ${MAX_POINTS.toLocaleString('en')}.`);
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
    for (let i = 0; i < MAX_POINTS + 1000; i++) text += `${(i / MAX_POINTS).toFixed(6)} 0\n`;
    expect(text.length).toBeLessThan(MAX_INPUT);
    const r = importAirfoilText(text, 'many.dat');
    expect(r.ok).toBe(false);
    expect(codes(r.issues)).toContain('too-many-points');
    const lines = Array.from({ length: MAX_POINTS + 1 }, (_, i) => [Math.cos((2 * Math.PI * i) / MAX_POINTS), 0]);
    expect(checkAirfoil(lines).issues.find((i) => i.code === 'too-many-points').message).toBe(`${(MAX_POINTS + 1).toLocaleString('en')} points; the limit is ${MAX_POINTS.toLocaleString('en')}.`);
    // Above 5000 points the airfoil is accepted with a warning that names the time.
    const dense = nacaAirfoil('2412', { pointsPerSide: 2600 }).points;
    const d = checkAirfoil(dense);
    expect(d.ok).toBe(true);
    expect(d.issues.find((i) => i.code === 'many-points').message).toMatch(/^5,199 points \(warning above 5,000\): the checks and the first build of a wing that uses the airfoil take (under 1 s|about [\d.]+ s)\.$/);
  });

  it('writes outlines smaller than 1e-3 with significant digits', () => {
    const pts = nacaAirfoil('2412', { pointsPerSide: 21 }).points.map(([x, y]) => [x * 1e-8, y * 1e-8]);
    const r = importAirfoilText(toSeligDat('tiny', pts, 7), 'tiny.dat');
    expect(r.ok).toBe(true);
    expect(r.points).toHaveLength(pts.length);
  });

  it('keeps the points of a 1e-12 outline and of a 1e-6 chord at x = 1 through a Selig file', () => {
    const naca = nacaAirfoil('2412').points;
    // Reference: the unit-chord outline through the same import (normalization included).
    const ref = importAirfoilText(toSeligDat('unit', naca), 'unit.dat').points;
    for (const pts of [naca.map(([x, y]) => [x * 1e-12, y * 1e-12]), naca.map(([x, y]) => [1 + x * 1e-6, y * 1e-6])]) {
      const r = importAirfoilText(toSeligDat('small', pts), 'small.dat');
      expect(r.ok).toBe(true);
      expect(r.points).toHaveLength(naca.length);
      const chord = Math.max(...pts.map((p) => p[0])) - Math.min(...pts.map((p) => p[0]));
      // Normalized to unit chord, each point within 1e-5 of the unit-chord import.
      for (let i = 0; i < naca.length; i++) {
        expect(Math.abs(r.points[i][0] - ref[i][0])).toBeLessThan(1e-5);
        expect(Math.abs(r.points[i][1] - ref[i][1])).toBeLessThan(1e-5);
      }
      expect(chord).toBeGreaterThan(0);
    }
    // Unit-chord outlines keep 6 decimals.
    expect(toSeligDat('n', [[1, 0], [0, 0.05], [1, 0]]).split('\n')[1]).toBe(' 1.000000  0.000000');
  });

  it('picks the same leading-edge point of an inclined outline at every scale', () => {
    const a = (30 * Math.PI) / 180;
    const unit = nacaAirfoil('2412').points.map(([x, y]) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)]);
    const i = leadingEdgeIndex(unit);
    for (const s of [1e-12, 1e-8, 1e3, 1e5]) expect(leadingEdgeIndex(unit.map(([x, y]) => [x * s, y * s]))).toBe(i);
  });

  it('writes a numeric or markup-like name so that it reads back as the name', () => {
    const pts = nacaAirfoil('2412').points;
    const numeric = toSeligDat('123 456', pts);
    expect(numeric.split('\n')[0]).toBe('Airfoil 123 456');
    const r = importAirfoilText(numeric, 'n.dat');
    expect(r.ok).toBe(true);
    expect(r.name).toBe('Airfoil 123 456');
    expect(r.points).toHaveLength(pts.length);
    // A name the reader would drop as a comment, or a coordinate row before a comment.
    for (const [title, line] of [
      ['# custom', 'Airfoil # custom'],
      ['12 34 # x', 'Airfoil 12 34 # x'],
    ]) {
      const t = toSeligDat(title, pts);
      expect(t.split('\n')[0]).toBe(line);
      const back = importAirfoilText(t, 'c.dat');
      expect(back.name).toBe(line);
      expect(back.points).toHaveLength(pts.length);
    }
    const markup = toSeligDat('<pre> and <coordinates> foil', pts);
    expect(markup.split('\n')[0]).toBe('‹pre> and ‹coordinates> foil');
    const m = importAirfoilText(markup, 'm.dat');
    expect(m.ok).toBe(true);
    expect(m.format).toBe('selig');
    expect(m.points).toHaveLength(pts.length);
  });

  it('writes a Selig file whose name stays on the first line', () => {
    const pts = nacaAirfoil('0012', { pointsPerSide: 11 }).points;
    const text = toSeligDat('foil\n0.25 9\r\nend', pts);
    expect(text.split('\n')[0]).toBe('foil 0.25 9 end');
    expect(parseDat(text).points).toHaveLength(pts.length);
  });

  it('keeps the first MAX_NAME characters of a long name line', () => {
    const pts = nacaAirfoil('2412', { pointsPerSide: 21 }).points;
    const r = parseDat([`N${'x'.repeat(MAX_NAME + 1000)}`, ...pts.map((p) => p.join(' '))].join('\n'));
    expect(r.name).toBe(`N${'x'.repeat(MAX_NAME - 1)}`);
    expect(r.issues.find((i) => i.code === 'long-name').message).toBe(`The name line has ${(MAX_NAME + 1001).toLocaleString('en')} characters; the first ${MAX_NAME.toLocaleString('en')} are used.`);
    expect(r.points.length).toBe(pts.length);
  });

  it('stops reading coordinate lines after the point limit plus a Lednicer counts line', () => {
    // 1,200,000 short rows (4.8 MB): reading stops at row MAX_POINTS + 2.
    const text = 'Rows\n' + '0 0\n'.repeat(1_200_000);
    expect(text.length).toBeLessThan(MAX_INPUT);
    const t0 = performance.now();
    const r = parseDat(text);
    expect(performance.now() - t0).toBeLessThan(1000);
    expect(r.points).toEqual([]);
    const count = (v) => v.toLocaleString('en');
    expect(r.issues.find((i) => i.code === 'too-many-points').message).toBe(`More than ${count(MAX_POINTS + 1)} coordinate lines; the limit is ${count(MAX_POINTS)} points.`);
    // A Lednicer file of MAX_POINTS + 1 rows (counts line and 2 x MAX_POINTS / 2 surface points) is read.
    const pts = nacaAirfoil('0012', { pointsPerSide: MAX_POINTS / 2 }).points;
    const le = pts.findIndex(([x]) => x === 0);
    const upper = pts.slice(0, le + 1).reverse();
    const lower = pts.slice(le);
    const lednicer = ['L', `${upper.length}. ${lower.length}.`, '', ...upper.map((p) => p.join(' ')), '', ...lower.map((p) => p.join(' '))].join('\n');
    const read = parseDat(lednicer);
    expect(read.format).toBe('lednicer');
    expect(read.points.length).toBe(upper.length + lower.length - 1);
    expect(1 + upper.length + lower.length).toBe(MAX_POINTS + 1);
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

  it('rejects a surface that runs back in x at more than LIMITS.maxFolds points, in linear time', () => {
    // NACA 0012 with a narrow vertical zigzag at x = 0.5 on each surface (k points, half-width w).
    const zigzag = (k, w = 1e-4, h = 0.004) => {
      const base = nacaAirfoil('0012', { pointsPerSide: 100 }).points;
      const le = base.findIndex(([x]) => x === 0);
      const yAt = (s, x) => {
        const i = s.findIndex((p) => p[0] >= x);
        const [x0, y0] = s[i - 1];
        const [x1, y1] = s[i];
        return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
      };
      const insert = (s, sign) => {
        const y0 = yAt(s, 0.5);
        const zz = Array.from({ length: k }, (_, j) => [j % 2 ? 0.5 + w : 0.5 - w, y0 + (sign * h * j) / k]);
        return [...s.filter((p) => p[0] < 0.5 - w), ...zz, ...s.filter((p) => p[0] > 0.5 + 2 * w)];
      };
      const upper = insert(base.slice(0, le + 1).reverse(), 1);
      const lower = insert(base.slice(le), -1);
      return [...upper.reverse(), ...lower.slice(1)];
    };
    // k zigzag points run back in x (k - 2) / 2 times: 102 points at the limit, 104 above it.
    expect(LIMITS.maxFolds).toBe(50);
    expect(codes(checkAirfoil(zigzag(102)).issues)).not.toContain('folds');
    expect(checkAirfoil(zigzag(104)).issues.find((i) => i.code === 'folds').message).toBe('The upper surface runs back in x at 51 points; the limit is 50.');
    const t0 = performance.now();
    const r = checkAirfoil(zigzag(2400));
    expect(performance.now() - t0).toBeLessThan(200);
    expect(r.ok).toBe(false);
    expect(r.issues.find((i) => i.code === 'folds').message).toBe('The upper surface runs back in x at 1199 points; the limit is 50.');
    // A vertical run of points at one x (no fold) is checked in linear time.
    const t1 = performance.now();
    expect(checkAirfoil(zigzag(2400, 0)).issues.map((i) => i.code)).not.toContain('folds');
    expect(performance.now() - t1).toBeLessThan(300);
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

describe('parser time, tables and round trips', () => {
  const selig = (name, pts) => `${name}\n${pts.map(([x, y]) => `${x} ${y}`).join('\n')}\n`;
  const naca = (n = 41) => nacaAirfoil('2412', { pointsPerSide: (n + 1) / 2 }).points;

  it('reads long letter runs, digit runs, unclosed titles and many comment signs in linear time', () => {
    const cases = [
      'Name\n' + 'x'.repeat(20000) + '!\n1 0\n0 0\n1 -0.01\n',
      'Name\n' + 'xy'.repeat(10000) + '!\n1 0\n0 0\n1 -0.01\n',
      'Name\n1 ' + '1'.repeat(200000) + 'x\n1 0\n0 0\n1 -0.01\n',
      '<html>' + '<title>'.repeat(100000),
      'Name\n' + '#'.repeat(200000) + ' \n1 0\n0 0\n1 -0.01\n',
    ];
    for (const text of cases) {
      const t0 = performance.now();
      parseDat(text);
      expect(performance.now() - t0).toBeLessThan(500);
    }
  });

  it('skips column headers with comma or semicolon separators without a message', () => {
    for (const header of ['x;y', 'x, y', 'X;Yo;Yu', 'x y', 'x/c y/c']) {
      const r = parseDat(`Foil\n${header}\n1 0\n0.5 0.06\n0 0\n0.5 -0.04\n1 0\n`);
      expect(codes(r.issues)).not.toContain('ignored-lines');
    }
    expect(codes(parseDat('Foil\nxyz!\n1 0\n0.5 0.06\n0 0\n0.5 -0.04\n1 0\n').issues)).toContain('ignored-lines');
  });

  it('cuts a comment at "#" also when the line holds U+2028', () => {
    const r = parseDat('Foil\n1 0 # TE upper\n0.5 0.06\n0 0\n0.5 -0.04\n1 0\n');
    expect(r.points).toEqual([[1, 0], [0.5, 0.06], [0, 0], [0.5, -0.04], [1, 0]]);
  });

  it('reads HTML tables whatever their source line breaks, cell markup and optional end tags', () => {
    const pts = naca();
    const cell = (v, wrap) => wrap(String(v));
    const tables = {
      pretty: `<table>\n${pts.map(([x, y]) => `  <tr>\n    <td>${x}</td>\n    <td>${y}</td>\n  </tr>`).join('\n')}\n</table>`,
      word: `<table>${pts.map(([x, y]) => `<tr><td><p class=MsoNormal>${x}</p></td><td><p class=MsoNormal>${y}&nbsp;</p></td></tr>`).join('\n')}</table>`,
      div: `<table>${pts.map(([x, y]) => `<tr><td>${cell(x, (s) => `<div>${s}</div>`)}</td><td><div>${y}</div></td></tr>`).join('')}</table>`,
      omitted: `<table>${pts.map(([x, y]) => `<tr><td>${x}<td>${y}`).join('\n')}</table>`,
      caption: `<table><caption>MH 32 coordinates</caption>${pts.map(([x, y]) => `<tr><td>${x}</td><td>${y}</td></tr>`).join('')}</table>`,
    };
    for (const [kind, table] of Object.entries(tables)) {
      const r = parseDat(`<html><body>${table}</body></html>`);
      expect(r.points.length, kind).toBe(pts.length);
      expect(r.points[0], kind).toEqual(pts[0]);
    }
    expect(parseDat(`<html><body>${tables.caption}</body></html>`).name).toBe('MH 32 coordinates');
  });

  it('writes .dat names that read back unchanged when they end in a tag name', () => {
    const pts = naca(161);
    for (const name of ['Test <title <body', 'HQ <style <html', 'x <script <pre', 'E387 <head <body', 'R&amp;D <b>12</b> <pre', 'Foil <pre']) {
      const r = importAirfoilText(toSeligDat(name, pts, 7), 'a.dat');
      expect(r.ok, name).toBe(true);
      expect(r.points.length, name).toBe(pts.length);
      expect(r.name, name).toBe(name.replace(/<(?=pre|body|html)/g, '‹'));
      expect(codes(r.issues), name).not.toContain('html');
    }
  });

  it('reads XML numbers with the rules of text lines', () => {
    const xml = (fmt) => `<airfoil><coordinates>${naca().map(([x, y]) => `<point><x>${fmt(x)}</x><y>${fmt(y)}</y></point>`).join('')}</coordinates></airfoil>`;
    const d = parseDat(xml((v) => v.toExponential().replace('e', 'D')));
    expect(d.points).toEqual(naca());
    const comma = parseDat(xml((v) => String(v).replace('.', ',')));
    expect(comma.points).toEqual(naca());
    expect(codes(parseDat('<coordinates><point><x>0x1</x><y>0</y></point><point><x>0</x><y>0</y></point></coordinates>').issues)).toContain('non-finite');
  });

  it('removes a closing point written twice after a blunt trailing edge', () => {
    const blunt = nacaAirfoil('2412', { pointsPerSide: 31 }).points.map((p) => p.slice());
    blunt[blunt.length - 1][0] = blunt[0][0];
    const once = importAirfoilText(selig('b', [...blunt, blunt[0]]), 'b.dat');
    const twice = importAirfoilText(selig('b', [...blunt, blunt[0], blunt[0]]), 'b.dat');
    expect(once.points.length).toBe(blunt.length);
    expect(twice.points).toEqual(once.points);
    expect(twice.stats.teGap).toBeCloseTo(once.stats.teGap, 12);
  });

  it('keeps every point of a dense stored airfoil through the .dat download', () => {
    const stored = importAirfoilText(selig('dense', nacaAirfoil('0012', { pointsPerSide: 10000 }).points), 'd.dat').points;
    const back = importAirfoilText(toSeligDat('dense', stored, 7), 'd.dat');
    expect(back.points.length).toBe(stored.length);
    expect(codes(back.issues)).not.toContain('duplicates');
    // Unit-chord outlines of normal density keep 7 decimals.
    expect(toSeligDat('n', [[1, 0], [0, 0.05], [1, -0.001]], 7).split('\n')[1]).toBe(' 1.0000000  0.0000000');
  });

  it('orients and finds the leading edge of clockwise outlines at any scale', () => {
    const pts = nacaAirfoil('4412', { pointsPerSide: 81 }).points;
    const ref = importAirfoilText(selig('n', pts.slice().reverse()), 'n.dat');
    expect(codes(ref.issues)).toContain('reversed');
    const le = leadingEdgeIndex(pts);
    const checks = codes(checkAirfoil(pts).issues);
    // Outlines not at unit chord add the info not-normalized.
    const scaleFree = (issues) => codes(issues).filter((c) => c !== 'not-normalized');
    for (const s of [1e-170, 1e160]) {
      const scaled = pts.map(([x, y]) => [x * s, y * s]);
      const r = importAirfoilText(selig('n', scaled.slice().reverse()), 'n.dat');
      expect(scaleFree(r.issues), String(s)).toEqual(codes(ref.issues));
      expect(leadingEdgeIndex(scaled), String(s)).toBe(le);
      expect(scaleFree(checkAirfoil(scaled).issues), String(s)).toEqual(checks);
    }
  });

  it('finds crossings of a narrow zigzag in close to linear time', () => {
    const base = nacaAirfoil('0012', { pointsPerSide: 101 }).points;
    const K = 20000;
    // K points 1e-9 apart in x, alternating 3 / K above and below the lower surface near x = 0.5.
    const i = base.findIndex(([x], k) => k > 100 && x > 0.5);
    const x0 = (base[i - 1][0] + base[i][0]) / 2;
    const y0 = (base[i - 1][1] + base[i][1]) / 2;
    const zig = Array.from({ length: K }, (_, k) => [x0 + k * 1e-9, y0 + (k % 2 ? 1 : -1) * (3 / K)]);
    const pts = [...base.slice(0, i), ...zig, ...base.slice(i)];
    const t0 = performance.now();
    expect(selfIntersections(pts)).toEqual([]);
    expect(performance.now() - t0).toBeLessThan(1500);
  });
});

describe('German airfoil messages', () => {
  afterEach(() => setLanguage('en'));
  const message = (issues, code) => issues.find((i) => i.code === code).message;
  const both = (make) => {
    const en = make();
    setLanguage('de');
    const de = make();
    setLanguage('en');
    return { en, de };
  };

  it('translates the parser messages, with a decimal comma and dot groups', () => {
    setLanguage('de');
    const pct = parseDat('Profil\nfree text\nmore text\n100,0 0,0\n50,0 5,0\n0,0 0,0\n50,0 -5,0\n100,0 0,0\n');
    expect(message(pct.issues, 'decimal-comma')).toBe('Dezimalkommas wurden als Dezimalpunkte gelesen.');
    expect(message(pct.issues, 'ignored-lines')).toBe('2 nichtnumerische Zeilen nach der Namenszeile wurden ignoriert.');
    expect(message(pct.issues, 'percent')).toBe('Die Koordinaten sehen nach Prozent der Profiltiefe aus und wurden durch 100 geteilt.');
    expect(message(parseDat('Profil\nfree text\n1 0\n0.5 0.06\n0 0\n0.5 -0.04\n1 0\n').issues, 'ignored-lines')).toBe('1 nichtnumerische Zeile nach der Namenszeile wurde ignoriert.');
    expect(message(parseDat('').issues, 'no-points')).toBe('Keine Koordinatenzeilen gefunden.');
    expect(message(parseDat('100 0\n50 6\n0 0\n50 -4\n100 0\n', { fileName: 'f.dat' }).issues, 'no-name')).toBe('Keine Namenszeile gefunden; der Dateiname wird als Profilname verwendet.');
    expect(message(parseDat('rev\n1 0\n0.5 -0.04\n0.5 -0.04\n0 0\n0.5 0.06\n1 0\n').issues, 'duplicates')).toBe('1 doppelter aufeinanderfolgender Punkt wurde entfernt.');
    expect(message(parseDat('rev\n1 0\n0.5 -0.04\n0.5 -0.04\n0.5 -0.04\n0 0\n0.5 0.06\n1 0\n').issues, 'duplicates')).toBe('2 doppelte aufeinanderfolgende Punkte wurden entfernt.');
    // A count that reaches four digits gets dot groups like every other number of the text.
    expect(message(parseDat('rev\n1 0\n0.5 -0.04\n' + '0.5 -0.04\n'.repeat(1200) + '0 0\n0.5 0.06\n1 0\n').issues, 'duplicates')).toBe('1.200 doppelte aufeinanderfolgende Punkte wurden entfernt.');
    expect(message(parseDat('rev\n1 0\n0.5 -0.04\n0 0\n0.5 0.06\n1 0\n').issues, 'reversed')).toBe(
      'Die Punkte laufen im Uhrzeigersinn (Unterseite zuerst); die Reihenfolge wurde in die Selig-Reihenfolge umgedreht.',
    );
    expect(message(parseDat('X\n 4. 4.\n0 0\n0.5 0.08\n1 0\n0 0\n0.5 -0.03\n1 0\n').issues, 'lednicer-count')).toBe(
      'Die Kopfzeile nennt 4+4 Punkte, gefunden wurden aber 6; Ober- und Unterseite werden am x-Rücksprung getrennt.',
    );
    const table = parseDat('1 0.002 -0.002\n0.8 0.04 -0.02\n0.5 0.07 -0.03\n0.2 0.06 -0.03\n0.05 0.03 -0.015\n0 0 0\n');
    expect(message(table.issues, 'table')).toBe('Als dreispaltige Tabelle gelesen (x, y Oberseite, y Unterseite).');
    expect(message(parseDat('Foil\n1 0 5\n0.5 0.06 5\n0 0 5\n0.5 -0.04 5\n1 0 5\n').issues, 'extra-columns')).toBe('Zeilen mit mehr als zwei Werten gefunden; nur die ersten beiden Spalten werden verwendet.');
  });

  it('translates the messages about the size of the input', () => {
    setLanguage('de');
    expect(message(parseDat('x'.repeat(MAX_INPUT + 1)).issues, 'too-large')).toBe('Die Eingabe hat 5.000.001 Zeichen; die Grenze liegt bei 5.000.000.');
    const pts = nacaAirfoil('2412', { pointsPerSide: 21 }).points;
    const named = parseDat([`N${'x'.repeat(MAX_NAME + 1000)}`, ...pts.map((p) => p.join(' '))].join('\n'));
    expect(message(named.issues, 'long-name')).toBe('Die Namenszeile hat 11.001 Zeichen; die ersten 10.000 werden verwendet.');
    const rows = parseDat('Rows\n' + '0 0\n'.repeat(MAX_POINTS + 1000));
    expect(message(rows.issues, 'too-many-points')).toBe('Mehr als 100.001 Koordinatenzeilen; die Grenze liegt bei 100.000 Punkten.');
    const many = `<airfoil><name>T</name><coordinates>${'<point><x>0</x><y>0</y></point>'.repeat(MAX_POINTS + 50)}</coordinates></airfoil>`;
    expect(message(parseDat(many).issues, 'too-many-points')).toBe('100.001 oder mehr Punkte; die Grenze liegt bei 100.000.');
  });

  it('translates the messages about XML and HTML', () => {
    setLanguage('de');
    const xml =
      '<airfoil><name>T</name><coordinates><point><x>1</x><y>0</y></point><point><x>0.5</x><y>0.06</y></point><point><x>0</x><y>0</y></point>' +
      '<point><x>0.5</x><y>-0.04</y></point><point><x>1</x><y>0</y></point></coordinates><coordinates><point><x>1</x><y>0</y></point></coordinates></airfoil>';
    const r = parseDat(xml);
    expect(message(r.issues, 'xml')).toBe('Als XML-Profilgeometrie gelesen.');
    expect(message(r.issues, 'multi-element')).toBe('2 Elemente gefunden; nur das erste wird verwendet.');
    expect(message(parseDat('<coordinates><point><x>1</x><y>0</y></point></coordinates>', { fileName: 'q.xml' }).issues, 'no-name')).toBe('Kein Name gefunden; der Dateiname wird verwendet.');
    expect(message(parseDat('<coordinates>').issues, 'xml-malformed')).toBe('Das XML enthält ein Element <coordinates> ohne schließendes Tag.');
    expect(message(parseDat('<coordinates><point><x>a</x><y>0</y></point></coordinates>').issues, 'non-finite')).toBe('Die Koordinaten enthalten nicht endliche Werte.');
    expect(message(parseDat('<coordinates></coordinates>').issues, 'no-points')).toBe('Keine Koordinatenpunkte gefunden.');
    expect(message(parseDat('<html><body><pre>Foil\n1 0\n0.5 0.06\n0 0\n0.5 -0.04\n1 0\n</pre></body></html>').issues, 'html')).toBe('Koordinaten aus einer HTML-Seite gelesen.');
  });

  it('translates the closing point messages', () => {
    const blunt = nacaAirfoil('2412', { pointsPerSide: 31 }).points;
    const text = (pts) => `Blunt\n${pts.map(([x, y]) => `${x} ${y}`).join('\n')}\n`;
    // Clockwise, closed by repeating the lower trailing-edge point after the upper one.
    const cw = blunt.slice().reverse();
    cw.push(cw[0].slice());
    // Starts and ends on the drawn base at the trailing-edge midpoint.
    const mid = [blunt[0][0], (blunt[0][1] + blunt[blunt.length - 1][1]) / 2];
    setLanguage('de');
    expect(message(parseDat(text(cw)).issues, 'closing-point')).toBe('Die Kontur wiederholt ihren ersten Punkt nach einer stumpfen Endleiste; der wiederholte Punkt wurde entfernt.');
    expect(message(parseDat(text([mid, ...blunt, mid])).issues, 'closing-point')).toBe(
      'Die Kontur beginnt und endet auf der gezeichneten Endleistenbasis; der Basispunkt wurde an beiden Enden entfernt.',
    );
    expect(message(checkAirfoil([mid, ...blunt, mid]).issues, 'te-base')).toBe(
      'Die Kontur erreicht die Endleiste über ein senkrechtes Segment; die Endleistenbasis wurde vermutlich als Punkte der Profilseite gelesen.',
    );
  });

  it('translates the checks of an outline, with a decimal comma', () => {
    setLanguage('de');
    expect(message(checkAirfoil([[0, 0]]).issues, 'too-few-points')).toBe('Mindestens 5 Punkte sind erforderlich (1 gefunden).');
    expect(message(checkAirfoil(null).issues, 'too-few-points')).toBe('Mindestens 5 Punkte sind erforderlich (0 gefunden).');
    expect(message(checkAirfoil(Array.from({ length: 6 }, (_, i) => [0.5, i])).issues, 'zero-chord')).toBe('Alle Punkte haben dieselbe x-Koordinate.');
    const coarse = checkAirfoil(nacaAirfoil('0012', { pointsPerSide: 8 }).points.map(([x, y]) => [x * 150, y * 150]));
    expect(message(coarse.issues, 'coarse')).toBe('Nur 15 Punkte; die NURBS-Interpolation trifft die beabsichtigte Form möglicherweise nicht.');
    expect(message(coarse.issues, 'not-normalized')).toBe('x reicht von 0,0000 bis 150,0000; die Koordinaten werden auf die Profiltiefe 1 skaliert.');
    const a = 0.2;
    const rot = nacaAirfoil('0012').points.map(([x, y]) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)]);
    const rotated = checkAirfoil(rot);
    expect(message(rotated.issues, 'rotated')).toBe(
      'Die Linie von der Profilnase zur Endleiste ist um 11,46 Grad geneigt; die Koordinaten bleiben erhalten, daher bezieht sich die Schränkung auf die x-Achse der Datei.',
    );
    expect(message(rotated.issues, 'non-monotonic')).toBe('x steigt nicht monoton von der Profilnase zur Endleiste an (Umkehrungen: Oberseite 1, Unterseite 0).');
    expect(message(checkAirfoil(setTrailingEdgeGap(nacaAirfoil('0012').points, 0.05)).issues, 'te-gap')).toBe('Die Endleistendicke beträgt 5,00 % der Profiltiefe.');
    const crossed = checkAirfoil(setTrailingEdgeGap(nacaAirfoil('0012').points, -0.01));
    expect(message(crossed.issues, 'te-crossed')).toBe('Die Endleiste ist gekreuzt (Endleistendicke -1,000 % der Profiltiefe).');
    expect(message(crossed.issues, 'crossed-surfaces')).toBe('Die Oberseite liegt an einer Position entlang der Profiltiefe unter der Unterseite.');
    expect(message(checkAirfoil(nacaAirfoil('0005').points.map(([x, y]) => [x, y / 10])).issues, 'thin')).toBe('Die maximale Dicke beträgt 0,50 % der Profiltiefe.');
    expect(message(checkAirfoil(nacaAirfoil('0035').points).issues, 'thick')).toMatch(/^Die maximale Dicke beträgt 3\d,\d % der Profiltiefe\.$/);
    const spiky = nacaAirfoil('2412').points.map((p) => p.slice());
    spiky[20][1] += 0.05;
    expect(message(checkAirfoil(spiky).issues, 'spike')).toBe('An 1 Punkt knickt die Kontur um mehr als 90 Grad.');
    expect(tr('{n} point(s) turn the outline by more than {angle} degrees.', { n: '3', angle: '90' })).toBe('An 3 Punkten knickt die Kontur um mehr als 90 Grad.');
    const pts = nacaAirfoil('0012').points;
    const le = pts.findIndex(([x]) => x === 0);
    const truncated = pts.slice(0, le + 1 + Math.floor((pts.length - le) / 2));
    const tail = 'nicht an der Endleiste; die Punktreihenfolge ist vermutlich nicht Selig, oder eine Profilseite ist unvollständig.';
    expect(message(checkAirfoil(truncated).issues, 'te-missing')).toMatch(new RegExp(`^Der letzte Punkt liegt bei \\d+,\\d % der Profiltiefe, ${tail}$`));
    const rolled = pts.slice(40).concat(pts.slice(0, 40));
    expect(message(checkAirfoil(rolled).issues, 'te-missing')).toBe(`Der erste Punkt liegt bei 50,0 % der Profiltiefe, ${tail}`);
  });

  it('translates the report of an outline that crosses itself or touches', () => {
    setLanguage('de');
    const pts = nacaAirfoil('0012').points.map((p) => p.slice());
    pts[leadingEdgeIndex(pts) + 40][1] = 0.2;
    expect(message(checkAirfoil(pts).issues, 'self-intersection')).toBe('Die Kontur überschneidet sich selbst (2 Kreuzungen).');
    expect(tr('The outline crosses itself ({n} crossing(s)).', { n: '1' })).toBe('Die Kontur überschneidet sich selbst (1 Kreuzung).');
    expect(tr('The outline crosses itself ({n} crossing(s)).', { n: '10+' })).toBe('Die Kontur überschneidet sich selbst (10+ Kreuzungen).');
    const folded = [
      [1, 0.002], [0.9, 0.02], [0.75, 0.03], [0.6, 0.015], [0.54, 0], [0.46, 0], [0.56, 0.02], [0.4, 0.03], [0.25, 0.05], [0.1, 0.04], [0, 0],
      [0.1, -0.03], [0.25, -0.04], [0.4, -0.02], [0.5, 0], [0.6, -0.015], [0.75, -0.03], [0.9, -0.02], [1, -0.002],
    ];
    expect(message(checkAirfoil(folded).issues, 'surfaces-touch')).toBe(
      'Ober- und Unterseite berühren sich bei x = 50,0 % der Profiltiefe (Dicke 0,0000 % der Profiltiefe); der Flügel hätte dort die Dicke null.',
    );
    const serpentine = [];
    for (let row = 0; row < 50; row++) for (let i = 0; i < 100; i++) serpentine.push([row % 2 ? 1 - i / 99 : i / 99, row * 0.02]);
    expect(message(checkAirfoil(serpentine).issues, 'outline-length')).toMatch(/^Die Kontur ist 5\d,\d Profiltiefen lang; eine Profilkontur ist etwa 2 Profiltiefen lang\.$/);
    expect(message(checkAirfoil(nacaAirfoil('2412').points).issues, 'stats')).toBe(
      '161 Punkte, Dicke 12,00 % bei 30,1 %, Wölbung 2,00 % bei 40,6 %, Endleistendicke 0,251 %.',
    );
    // A point 1e-3 of the way along a segment: the two new segments differ in length by about 1,000.
    const uneven = nacaAirfoil('0012').points.map((q) => q.slice());
    const [q0, q1] = [uneven[30], uneven[31]];
    uneven.splice(31, 0, [q0[0] + 1e-3 * (q1[0] - q0[0]), q0[1] + 1e-3 * (q1[1] - q0[1])]);
    expect(message(checkAirfoil(uneven).issues, 'uneven-spacing')).toMatch(/^Benachbarte Segmente unterscheiden sich in der Länge um einen Faktor von bis zu \d+\.$/);
  });

  it('translates the surface checks with one message per surface', () => {
    // NACA 0012 with alternating x offsets on one surface: many points where x runs back.
    const jitter = (which) => {
      const base = nacaAirfoil('0012', { pointsPerSide: 300 }).points;
      const le = base.findIndex(([x]) => x === 0);
      const out = base.map((p) => p.slice());
      const range = which === 'upper' ? [le - 200, le - 60] : [le + 60, le + 200];
      for (let i = range[0]; i < range[1]; i++) out[i][0] += i % 2 ? 0.01 : -0.01;
      return out;
    };
    expect(message(checkAirfoil(jitter('upper')).issues, 'folds')).toMatch(/^The upper surface runs back in x at \d+ points; the limit is 50\.$/);
    setLanguage('de');
    expect(message(checkAirfoil(jitter('upper')).issues, 'folds')).toMatch(/^Die Oberseite läuft an \d+ Punkten in x zurück; die Grenze liegt bei 50\.$/);
    expect(message(checkAirfoil(jitter('lower')).issues, 'folds')).toMatch(/^Die Unterseite läuft an \d+ Punkten in x zurück; die Grenze liegt bei 50\.$/);
  });

  it('translates the numbers of the point limits and of the first-use warning', () => {
    setLanguage('de');
    const lines = Array.from({ length: MAX_POINTS + 1 }, (_, i) => [Math.cos((2 * Math.PI * i) / MAX_POINTS), 0]);
    expect(message(checkAirfoil(lines).issues, 'too-many-points')).toBe('100.001 Punkte; die Grenze liegt bei 100.000.');
    const d = checkAirfoil(nacaAirfoil('2412', { pointsPerSide: 2600 }).points);
    expect(message(d.issues, 'many-points')).toBe(
      `5.199 Punkte (Warnung über 5.000): Die Prüfungen und der erste Aufbau eines Flügels, der das Profil verwendet, dauern ${formatSeconds(airfoilFirstUseSeconds(5199))}.`,
    );
    expect(formatSeconds(airfoilFirstUseSeconds(5199))).not.toMatch(/about/);
    const base = nacaAirfoil('2412').points;
    const next = (v) => {
      const b = new Float64Array([v]);
      new BigInt64Array(b.buffer)[0] += 1n;
      return b[0];
    };
    const dup = base.map((q) => q.slice());
    dup.splice(6, 0, [dup[5][0], next(dup[5][1])]);
    expect(message(checkAirfoil(dup).issues, 'duplicates')).toBe('1 Punkt, der dem vorherigen Punkt näher als das 1e-9-Fache der Profiltiefe lag, wurde entfernt.');
  });

  it('writes the statistics line with a decimal comma', () => {
    const { en, de } = both(() => message(checkAirfoil(nacaAirfoil('2412').points).issues, 'stats'));
    expect(en).toMatch(/^161 points, t\/c 12\.00 % at \d+\.\d %, camber 2\.00 % at 40\.\d %, TE gap 0\.\d{3} %\.$/);
    expect(de).toMatch(/^161 Punkte, Dicke 12,00 % bei \d+,\d %, Wölbung 2,00 % bei 40,\d %, Endleistendicke 0,\d{3} %\.$/);
  });

  it('gives the same issue codes and severities in both languages', () => {
    const inputs = [
      () => importAirfoilText('Profil\nfree text\n100,0 0,0\n50,0 5,0\n0,0 0,0\n50,0 -5,0\n100,0 0,0\n', 'p.dat'),
      () => importAirfoilText('rev\n1 0\n0.5 -0.04\n0.5 -0.04\n0 0\n0.5 0.06\n1 0\n', 'rev.dat'),
      () => checkAirfoil(nacaAirfoil('0035').points),
      () => checkAirfoil(nacaAirfoil('0012', { pointsPerSide: 8 }).points.map(([x, y]) => [x * 150, y * 150])),
    ];
    for (const make of inputs) {
      const { en, de } = both(() => make());
      expect(de.issues.map((i) => [i.severity, i.code, i.where])).toEqual(en.issues.map((i) => [i.severity, i.code, i.where]));
      expect(de.issues.map((i) => i.message)).not.toEqual(en.issues.map((i) => i.message));
    }
  });

  it('translates the error for an unsupported NACA designation', () => {
    expect(() => nacaAirfoil('2400')).toThrow('Unsupported NACA designation: 2400');
    setLanguage('de');
    expect(() => nacaAirfoil('2400')).toThrow('Nicht unterstützte NACA-Bezeichnung: 2400');
  });

  it('keeps the English texts as they are after switching back', () => {
    const text = 'Profil\nfree text\n100,0 0,0\n50,0 5,0\n0,0 0,0\n50,0 -5,0\n100,0 0,0\n';
    const before = parseDat(text).issues.map((i) => i.message);
    setLanguage('de');
    parseDat(text);
    setLanguage('en');
    expect(parseDat(text).issues.map((i) => i.message)).toEqual(before);
    expect(before).toContain('1 non-numeric line(s) after the name line were ignored.');
  });
});
