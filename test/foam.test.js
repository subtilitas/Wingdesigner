// Foam-cutting wizard: cuts, end profiles square to the segment, joint wedges, deviation of the ruled
// cores from the wing (src/geom/foam.js), and the files (src/export/foam.js): .dat profile pairs,
// segments.csv, the ZIP, the template layout, SVG, DXF and the paged PDF.
import { afterEach, describe, expect, it } from 'vitest';
import { strFromU8, unzipSync, unzlibSync } from 'fflate';
import { buildWing } from '../src/geom/wing.js';
import { solveMonotonic, surfacePoint } from '../src/geom/nurbs.js';
import { DEVIATION_PLANES, FOAM_LIMITS, foamSegments, normalizeCuts, proposeCuts, splitOverTolerance } from '../src/geom/foam.js';
import {
  FRAME,
  MARKS,
  PAGE_OVERLAP,
  PAPERS,
  asciiName,
  dxfText,
  layoutDxf,
  layoutPdf,
  layoutSvg,
  markIndices,
  normalizedProfile,
  offsetPolygon,
  pagePlan,
  registrationCrosses,
  profileDat,
  profileZip,
  segmentsCsv,
  templateBlocks,
  templateLayout,
  wrapText,
} from '../src/export/foam.js';
import { FOAM_DEFAULTS, FOAM_SETTINGS_KEY, storedFoamSettings } from '../src/ui/foam.js';
import { PRESETS, wizardProject } from '../src/model/wizard.js';
import { createProject } from '../src/model/project.js';
import { setLanguage } from '../src/i18n/index.js';
import { naca, sampleProject } from './helpers.js';

const DEG = Math.PI / 180;

afterEach(() => setLanguage('en'));

/** A straight wing of NACA 2412, chord 200 mm, half span 600 mm along a panel of `dihedral` degrees. */
function panel(planes, dihedral) {
  return createProject({
    name: 'Panel',
    airfoils: [naca('2412', 'a')],
    sections: [
      { airfoil: 'a', x: 0, y: 0, z: 0, chord: 200, twist: 0 },
      { airfoil: 'a', x: 0, y: 600 * Math.cos(dihedral * DEG), z: 600 * Math.sin(dihedral * DEG), chord: 200, twist: 0 },
    ],
    settings: { spanwise: 'straight', sectionPlanes: planes },
  });
}

const built = (project) => {
  const b = buildWing(project);
  expect(b.errors).toEqual([]);
  return b;
};

/** Thickness range of a profile in h (largest minus smallest h). */
const heightOf = (points) => Math.max(...points.map((p) => p[1])) - Math.min(...points.map((p) => p[1]));
const widthOf = (points) => Math.max(...points.map((p) => p[0])) - Math.min(...points.map((p) => p[0]));

describe('cuts', () => {
  it('propose a cut at every section and split each piece into equal parts no longer than the longest core', () => {
    const b = built(sampleProject());
    expect(proposeCuts(b, 300)).toEqual([150, 300, 450]);
    expect(proposeCuts(b, 1000)).toEqual([300]);
    // The pieces are 300.2 and 300.7 mm long along the dihedral: 301 mm splits neither.
    expect(proposeCuts(b, 301)).toEqual([300]);
    expect(proposeCuts(b, 100)).toHaveLength(7);
  });

  it('keep a section exactly 5 mm from the root, and stop at the segment limit', () => {
    const p = sampleProject();
    p.sections.splice(1, 0, { ...p.sections[1], id: 'near', y: FOAM_LIMITS.minSegment, x: 0, z: 0, chord: 200, twist: 0 });
    expect(proposeCuts(built(p), 1000)[0]).toBe(FOAM_LIMITS.minSegment);
    // A 20 mm longest core: the two pieces (300.2 and 300.7 mm along the dihedral) take 16 cores each,
    // 15 + 15 cuts plus the section. 0.5 mm asks for about 1,200 cores: each 300 mm piece takes at most
    // 60 parts of 5 mm (59 + 59 cuts plus the section).
    const b = built(sampleProject());
    expect(proposeCuts(b, 20)).toHaveLength(31);
    expect(proposeCuts(b, 0.5)).toHaveLength(119);
    // A 1,500 mm half span in 5 mm parts reaches the segment limit: 199 cuts.
    const long = panel('vertical', 0);
    long.sections.forEach((q) => (q.y *= 2.5));
    expect(proposeCuts(built(long), 0.5)).toHaveLength(FOAM_LIMITS.maxSegments - 1);
  });

  it('merge sections closer than the shortest segment', () => {
    const p = sampleProject();
    p.sections.splice(2, 0, { ...p.sections[1], id: 'extra', y: 300.5 });
    const b = built(p);
    expect(proposeCuts(b, 1000)).toEqual([300]);
  });

  it('measure the core length along the dihedral', () => {
    // 600 mm along a 40° panel: 459.6 mm in y. A longest core of 300 mm needs 2 cores.
    const b = built(panel('mitred', 40));
    expect(proposeCuts(b, 300)).toHaveLength(1);
    expect(proposeCuts(b, 599)).toHaveLength(1);
    expect(proposeCuts(b, 601)).toEqual([]);
  });

  it('normalize: sorted, inside the half wing, at least the shortest segment apart, at most the segment limit', () => {
    const b = built(sampleProject());
    const min = FOAM_LIMITS.minSegment;
    expect(normalizeCuts(b, [450, NaN, 150, 2, 598, 151, 300, -10, 700])).toEqual({ cuts: [150, 300, 450], dropped: 6, capped: 0 });
    expect(normalizeCuts(b, [min, 600 - min]).cuts).toEqual([min, 600 - min]);
    // A 1,500 mm half span holds 299 cuts 5 mm apart; 199 are kept.
    const long = panel('vertical', 0);
    long.sections.forEach((q) => (q.y *= 2.5));
    const wide = built(long);
    const many = Array.from({ length: 299 }, (_, i) => 5 + i * 5);
    expect(normalizeCuts(wide, many)).toEqual({ cuts: many.slice(0, FOAM_LIMITS.maxSegments - 1), dropped: 299 - (FOAM_LIMITS.maxSegments - 1), capped: 299 - (FOAM_LIMITS.maxSegments - 1) });
  });

  it('start at the root of a wing whose root lies off y = 0', () => {
    const p = sampleProject();
    p.sections.forEach((s) => (s.y += 35));
    const segs = foamSegments(built(p), [335]);
    expect(segs.map((s) => [s.ya, s.yb])).toEqual([
      [35, 335],
      [335, 635],
    ]);
  });
});

describe('end profiles', () => {
  it('cut a straight 10° panel with mitred planes to the airfoil: thickness and chord as designed, no deviation', () => {
    const b = built(panel('mitred', 10));
    const segs = foamSegments(b, proposeCuts(b, 300));
    expect(segs).toHaveLength(2);
    // Thickness of the airfoil at its chord in a vertical cut of an untilted wing.
    const flatEnd = foamSegments(built(panel('mitred', 0)), [])[0].ends[0];
    const flat = flatEnd.points;
    // The chord runs to the trailing-edge midpoint, which lies 0.31 mm below the leading edge: 200.00024 mm.
    expect(flatEnd.chord).toBeCloseTo(200, 3);
    for (const s of segs) {
      expect(s.axis).toBeCloseTo(10, 12);
      for (const e of s.ends) {
        expect(e.chord).toBeCloseTo(flatEnd.chord, 6);
        expect(heightOf(e.points)).toBeCloseTo(heightOf(flat), 6);
        expect(e.points).toHaveLength(b.paramsU.length);
      }
      expect(s.deviation.max).toBeLessThan(1e-6);
    }
    // Root: the vertical root plane is sanded off a 10° wedge, deepest at the upper surface; the
    // tip plane is square to the panel: no wedge. The cut between the cores is square to both.
    expect(segs[0].ends[0].wedge.angle).toBeCloseTo(10, 9);
    expect(segs[0].ends[0].wedge.side).toBe('upper');
    expect(segs[0].ends[0].wedge.depth).toBeCloseTo(heightOf(flat) * Math.tan(10 * DEG), 2);
    expect(segs[0].ends[1].wedge).toBeNull();
    expect(segs[1].ends[0].wedge).toBeNull();
    expect(segs[1].ends[1].wedge).toBeNull();
    // Core length: 300 mm along the panel; the inboard core reaches past the root section by the
    // part of the wedge below the leading edge (the root section is stretched by 1 / cos 10°).
    expect(segs[1].length).toBeCloseTo(300, 6);
    expect(segs[0].length).toBeCloseTo(300 + flatEnd.le[1] * Math.tan(10 * DEG), 6);
  });

  it('cut the same panel with vertical planes thinner by cos 10° and sand both ends to the vertical planes', () => {
    const b = built(panel('vertical', 10));
    const [s] = foamSegments(b, []);
    const flat = foamSegments(built(panel('vertical', 0)), [])[0].ends[0].points;
    for (const e of s.ends) expect(heightOf(e.points) / heightOf(flat)).toBeCloseTo(Math.cos(10 * DEG), 4);
    expect(s.ends[0].wedge).toMatchObject({ side: 'upper' });
    expect(s.ends[1].wedge).toMatchObject({ side: 'lower' });
    expect(s.ends[0].wedge.angle).toBeCloseTo(10, 9);
    expect(s.ends[1].wedge.angle).toBeCloseTo(10, 9);
    expect(s.deviation.max).toBeLessThan(1e-6);
  });

  it('put the joint of a gull on the bisector: 10° wedges at the lower surface on both sides of a 15° to -5° break', () => {
    const p = sampleProject({ settings: { sectionPlanes: 'mitred' } });
    p.sections[1].z = 300 * Math.tan(15 * DEG);
    p.sections[2].z = p.sections[1].z - 300 * Math.tan(5 * DEG);
    const segs = foamSegments(built(p), [300]);
    expect(segs.map((s) => s.axis)).toEqual([expect.closeTo(15, 9), expect.closeTo(-5, 9)]);
    for (const w of [segs[0].ends[1].wedge, segs[1].ends[0].wedge]) {
      expect(w.angle).toBeCloseTo(10, 9);
      expect(w.side).toBe('lower');
    }
    expect(segs[0].ends[0].wedge.angle).toBeCloseTo(15, 9);
    expect(segs[1].ends[1].wedge).toBeNull();
  });

  it('sand to the vertical section plane at a dihedral break of a wing with vertical planes', () => {
    const segs = foamSegments(built(sampleProject()), [300]);
    const a1 = Math.atan(10 / 300) / DEG;
    const a2 = Math.atan(20 / 300) / DEG;
    expect(segs[0].ends[1].wedge.angle).toBeCloseTo(a1, 9);
    expect(segs[0].ends[1].wedge.side).toBe('lower');
    expect(segs[1].ends[0].wedge.angle).toBeCloseTo(a2, 9);
    expect(segs[1].ends[0].wedge.side).toBe('upper');
  });

  it('place both profiles of a segment in one block frame: origin at the lower front corner, chord and incidence', () => {
    const [s] = foamSegments(built(sampleProject()), [300]);
    const all = [...s.ends[0].points, ...s.ends[1].points];
    expect(Math.min(...all.map((p) => p[0]))).toBeCloseTo(0, 9);
    expect(Math.min(...all.map((p) => p[1]))).toBeCloseTo(0, 9);
    expect(s.width).toBeCloseTo(Math.max(...all.map((p) => p[0])), 9);
    expect(s.height).toBeCloseTo(Math.max(...all.map((p) => p[1])), 9);
    // Section 2 lies at x = 20 mm, chord 170 mm, twist -1°. The end face lies up to 1 mm past the
    // section (the wedge), where the sweep of 20 mm in 300 mm moves the leading edge by up to 0.07 mm.
    expect(Math.abs(s.ends[1].le[0] - s.ends[0].le[0] - 20)).toBeLessThan(0.07);
    expect(s.ends[1].chord).toBeCloseTo(170, 0);
    expect(s.ends[1].incidence - s.ends[0].incidence).toBeCloseTo(-1, 1);
  });

  it('build cores of an elliptic wing with guide curves and of a pointed tip', () => {
    const glider = built(wizardProject(PRESETS.glider.params));
    const cuts = proposeCuts(glider, 400);
    for (const s of glider.sections.slice(1, -1)) expect(cuts).toContain(s.y);
    const segs = foamSegments(glider, cuts);
    expect(segs.every((s) => s.deviation.max > 0 && Number.isFinite(s.deviation.max))).toBe(true);
    const pointed = built(wizardProject({ ...PRESETS.sport.params, tip: 'pointed' }));
    const last = foamSegments(pointed, proposeCuts(pointed, 300)).at(-1);
    expect(last.ends[1].chord).toBeLessThan(2);
    expect(last.ends[1].points.every((p) => p.every(Number.isFinite))).toBe(true);
  });
});

describe('deviation', () => {
  /** Distance from p to the closed polygon. */
  const toPolygon = (p, poly) => {
    let best = Infinity;
    for (let i = 0; i < poly.length; i++) {
      const A = poly[i];
      const B = poly[(i + 1) % poly.length];
      const ex = B[0] - A[0];
      const ey = B[1] - A[1];
      const t = Math.min(1, Math.max(0, ((p[0] - A[0]) * ex + (p[1] - A[1]) * ey) / (ex * ex + ey * ey || 1)));
      best = Math.min(best, Math.hypot(A[0] + t * ex - p[0], A[1] + t * ey - p[1]));
    }
    return best;
  };

  it('equals an independent measurement in the middle plane: the Sport wing (taper times twist) as one core', () => {
    const b = built(wizardProject(PRESETS.sport.params));
    const [s] = foamSegments(b, []);
    expect(DEVIATION_PLANES % 2).toBe(1);
    // The middle plane, square to the axis, cut from the wing at 1,201 surface parameters.
    const a = [0, Math.cos(s.axis * DEG), Math.sin(s.axis * DEG)];
    const up = [0, -Math.sin(s.axis * DEG), Math.cos(s.axis * DEG)];
    const dot = (p, n) => p[1] * n[1] + p[2] * n[2];
    const dMid = (s.faces[0] + s.faces[1]) / 2;
    const wing = [];
    for (let k = 0; k <= 1200; k++) {
      const u = k / 1200;
      const v = solveMonotonic((t) => dot(surfacePoint(b.surface, u, t), a), dMid, 0, 1, 1e-10);
      const P = surfacePoint(b.surface, u, v);
      wing.push([P[0] - s.origin[0], dot(P, up) - s.origin[1]]);
    }
    // The ruled core in the middle plane: halfway between the two end profiles.
    const A = s.ends[0].points;
    const B = s.ends[1].points;
    const shifted = A.map((p, i) => [(p[0] + B[i][0]) / 2, (p[1] + B[i][1]) / 2]);
    const independent = Math.max(...shifted.map((p) => toPolygon(p, wing)));
    // The middle plane holds the largest deviation of this core (a quadratic in the span).
    expect(s.deviation.max).toBeGreaterThan(0.2);
    expect(Math.abs(s.deviation.max - independent)).toBeLessThan(0.02);
  });

  it('falls with the square of the segment length, and splitting reaches the limit', () => {
    const b = built(wizardProject(PRESETS.sport.params));
    const one = foamSegments(b, [])[0].deviation.max;
    const two = foamSegments(b, [300]).map((s) => s.deviation.max);
    for (const d of two) expect(d / one).toBeGreaterThan(0.15);
    for (const d of two) expect(d / one).toBeLessThan(0.35);
    const r = splitOverTolerance(b, [], 0.05);
    expect(r.within).toBe(true);
    expect(r.segments.every((s) => s.deviation.max <= 0.05)).toBe(true);
    expect(r.cuts.length).toBeGreaterThan(1);
    // A limit below reach stops at the segment limit or the shortest segment.
    const tight = splitOverTolerance(b, [], 1e-9);
    expect(tight.within).toBe(false);
    expect(tight.segments.length).toBeLessThanOrEqual(FOAM_LIMITS.maxSegments);
  });
});

describe('profile files', () => {
  const b = buildWing(sampleProject());
  const segs = foamSegments(b, [300]);

  it('write Selig-ordered .dat pairs with equal point counts in mm and normalized to chord 1', () => {
    const lines = profileDat('Flügel 1', segs[0], 0).trim().split('\n');
    expect(lines[0]).toBe('Fluegel 1 segment 1 inboard y=0.0 mm');
    expect(lines).toHaveLength(b.paramsU.length + 1);
    for (const l of lines.slice(1)) expect(l).toMatch(/^-?\d+\.\d{6} -?\d+\.\d{6}$/);
    const pts = lines.slice(1).map((l) => l.split(' ').map(Number));
    expect(pts[0][0]).toBeGreaterThan(pts[b.leIndex][0] + 150);
    const norm = profileDat('W', segs[0], 1, true).trim().split('\n');
    expect(norm[0]).toMatch(/^W segment 1 outboard y=300\.0 mm chord=\d+\.\d{3} mm$/);
    const np = normalizedProfile(segs[0].ends[1]);
    expect(np[b.leIndex][0]).toBeCloseTo(0, 12);
    expect(np[b.leIndex][1]).toBeCloseTo(0, 12);
    const n = np.length - 1;
    expect((np[0][0] + np[n][0]) / 2).toBeCloseTo(1, 12);
    expect((np[0][1] + np[n][1]) / 2).toBeCloseTo(0, 12);
    expect(asciiName('  ')).toBe('wing');
    // An umlaut as u plus a combining diaeresis is written out too; other accents lose their mark.
    expect(asciiName('Flu\u0308gel Café 日本')).toBe('Fluegel Cafe');
  });

  it('list every segment in segments.csv with as many values as columns', () => {
    const rows = segmentsCsv(segs).trim().split('\n');
    expect(rows).toHaveLength(3);
    const head = rows[0].split(',');
    expect(head).toContain('outboard_wedge_side');
    for (const r of rows.slice(1)) expect(r.split(',')).toHaveLength(head.length);
    const first = Object.fromEntries(head.map((k, i) => [k, rows[1].split(',')[i]]));
    expect(first).toMatchObject({ segment: '1', y_inboard_mm: '0.000', y_outboard_mm: '300.000', outboard_wedge_side: 'lower', inboard_wedge_side: 'upper' });
    expect(Number(first.core_length_mm)).toBeCloseTo(segs[0].length, 3);
  });

  it('pack the ZIP: README.txt, segments.csv, mm/ and normalized/ files per segment end', () => {
    const files = unzipSync(profileZip('Test wing', segs));
    expect(Object.keys(files).sort()).toEqual(
      ['README.txt', 'segments.csv', ...['mm', 'normalized'].flatMap((d) => [1, 2].flatMap((i) => ['inboard', 'outboard'].map((e) => `${d}/segment-0${i}-${e}.dat`)))].sort(),
    );
    expect(strFromU8(files['mm/segment-02-outboard.dat'])).toBe(profileDat('Test wing', segs[1], 1));
    expect(strFromU8(files['README.txt'])).toMatch(/^Foam cores of Test wing: 2 segments per half wing\./);
    setLanguage('de');
    expect(strFromU8(unzipSync(profileZip('Test wing', segs))['README.txt'])).toMatch(/^Schaumkerne von Test wing: 2 Segmente je Flügelhälfte\./);
  });
});

describe('templates', () => {
  const b = buildWing(sampleProject());
  const segs = foamSegments(b, [300]);

  it('offset a polygon outward in either orientation', () => {
    const square = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ];
    const grown = [
      [-1, -1],
      [11, -1],
      [11, 11],
      [-1, 11],
    ];
    for (const [p, q] of offsetPolygon(square, 1).map((p, i) => [p, grown[i]])) expect(p.map((v) => +v.toFixed(12))).toEqual(q);
    const cw = [...square].reverse();
    for (const [p, q] of offsetPolygon(cw, 1).map((p, i) => [p, [...grown].reverse()[i]])) expect(p.map((v) => +v.toFixed(12))).toEqual(q);
    // A repeated closing point (closed trailing edge) is dropped; offset 0 keeps the points.
    expect(offsetPolygon([...square, [0, 0]], 0)).toEqual(square);
  });

  it('give each segment end a block: text lines, frame 10 mm around the block, the profile and 21 numbered marks', () => {
    expect(markIndices(121)).toHaveLength(MARKS + 1);
    expect(markIndices(121)).toEqual(expect.arrayContaining([0, 60, 120]));
    const blocks = templateBlocks('Test wing', segs, { kerf: 0 });
    expect(blocks).toHaveLength(1 + 2 * segs.length);
    const t = blocks[3];
    expect(t.label).toBe('Segment 2 of 2, inboard end');
    const frame = t.items.find((it) => it.kind === 'frame');
    expect(frame.points[2]).toEqual([segs[1].width + 2 * FRAME, segs[1].height + 2 * FRAME]);
    const profile = t.items.find((it) => it.kind === 'profile');
    const expected = segs[1].ends[0].points.map(([x, h]) => [FRAME + x, FRAME + h]);
    // The open trailing edge of the sample keeps every point.
    expect(profile.points).toEqual(expected);
    expect(t.items.filter((it) => it.kind === 'mark')).toHaveLength(MARKS + 1);
    expect(t.items.filter((it) => it.kind === 'text' && it.size === 2).map((it) => it.text)).toEqual(Array.from({ length: MARKS + 1 }, (_, i) => String(i)));
    expect(t.items.some((it) => it.kind === 'text' && /wedge 3\.81°, \d\.\d\d mm deep at the upper surface\./.test(it.text))).toBe(true);
    const kerfed = templateBlocks('Test wing', segs, { kerf: 1 })[3].items.find((it) => it.kind === 'profile');
    expect(widthOf(kerfed.points) - widthOf(expected)).toBeCloseTo(1, 1);
    expect(wrapText('a b c', 10)).toEqual(['a b c']);
    expect(wrapText(`${'x'.repeat(30)} ${'y'.repeat(30)}`, 40)).toHaveLength(2);
  });

  it('write an SVG sheet in mm and a DXF of AutoCAD R12 with the same outlines', () => {
    const layout = templateLayout('Test wing', segs, { kerf: 0.8 });
    const svg = layoutSvg(layout);
    expect(svg).toMatch(new RegExp(`<svg [^>]*width="${layout.width}mm" height="${layout.height}mm" viewBox="0 0 ${layout.width} ${layout.height}"`));
    expect(svg.match(/<polygon class="profile"/g)).toHaveLength(4);
    expect(svg.match(/<polygon class="frame"/g)).toHaveLength(4);
    const dxf = layoutDxf(layout).split('\r\n');
    // Group code and value pairs, then the final empty line.
    expect(dxf.at(-1)).toBe('');
    const pairs = [];
    for (let i = 0; i + 1 < dxf.length; i += 2) pairs.push([Number(dxf[i]), dxf[i + 1]]);
    expect(pairs.find(([c, v]) => c === 1 && v.startsWith('AC'))[1]).toBe('AC1009');
    expect(pairs.at(-1)).toEqual([0, 'EOF']);
    // The vertices of the first PROFILE polyline equal the first profile of the layout.
    const first = layout.items.find((it) => it.kind === 'profile');
    let i = pairs.findIndex(([c, v], k) => c === 0 && v === 'POLYLINE' && pairs[k + 1][1] === 'PROFILE');
    const verts = [];
    for (; pairs[i][1] !== 'SEQEND'; i++) {
      if (pairs[i][0] === 0 && pairs[i][1] === 'VERTEX') verts.push([Number(pairs[i + 2][1]), Number(pairs[i + 3][1])]);
    }
    expect(verts).toHaveLength(first.points.length);
    verts.forEach((v, k) => {
      expect(v[0]).toBeCloseTo(first.points[k][0], 4);
      expect(v[1]).toBeCloseTo(first.points[k][1], 4);
    });
    expect(layoutDxf({ width: 1, height: 1, items: [{ kind: 'text', x: 0, y: 0, size: 2, text: 'Keil 2° über' }] })).toContain('Keil 2%%d \\U+00FCber');
    // A character beyond the Basic Multilingual Plane has no \\U+XXXX form: one ?.
    expect(dxfText('a\u{1F600}b')).toBe('a?b');
  });

  it('page the PDF: whole templates per page, wide ones in overlapping strips, valid cross-reference table', () => {
    const layout = templateLayout('Test wing', segs);
    const plan = pagePlan(layout, 'a4');
    // The 220 mm templates fit A4 landscape (277 mm) whole.
    expect(plan.split).toBe(0);
    expect([plan.pageW, plan.pageH]).toEqual([297, 210]);
    const pdf = layoutPdf(layout, 'a4', { title: 'Test (wing)' });
    const text = new TextDecoder('latin1').decode(pdf);
    expect(text.startsWith('%PDF-1.4\n')).toBe(true);
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
    const startxref = Number(text.match(/startxref\n(\d+)\n%%EOF/)[1]);
    expect(text.slice(startxref, startxref + 4)).toBe('xref');
    const entries = [...text.slice(startxref).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
    entries.forEach((off, k) => expect(text.slice(off, off + `${k + 1} 0 obj`.length)).toBe(`${k + 1} 0 obj`));
    expect(text.match(/\/Type \/Page /g)).toHaveLength(plan.pages);
    expect(text).toContain('/Title (Test \\(wing\\))');
    // Content streams: the page label of every page.
    const streams = [...text.matchAll(/\/Length (\d+) \/Filter \/FlateDecode >>\nstream\n/g)].map((m) => strFromU8(unzlibSync(pdf.subarray(m.index + m[0].length, m.index + m[0].length + Number(m[1])))));
    expect(streams).toHaveLength(plan.pages);
    streams.forEach((s, k) => expect(s).toContain(`(100 mm. Page ${k + 1} of ${plan.pages}.)`));
    setLanguage('de');
    const de = layoutPdf(templateLayout('Flügel', segs), 'a4');
    const deText = new TextDecoder('latin1').decode(de);
    const m = [...deText.matchAll(/\/Length (\d+) \/Filter \/FlateDecode >>\nstream\n/g)][0];
    // ü in WinAnsiEncoding: octal 374.
    expect(strFromU8(unzlibSync(de.subarray(m.index + m[0].length, m.index + m[0].length + Number(m[1]))))).toContain('(Fl\\374gel: Schablonen');
  });

  it('cut a block wider than the page into strips that overlap and cover it', () => {
    const wide = { width: 600, height: 50, items: [], label: 'wide' };
    const plan = pagePlan({ blocks: [wide] }, 'a4');
    expect(plan.split).toBe(1);
    const strips = plan.pieces;
    expect(strips.length).toBeGreaterThan(1);
    expect(strips[0].x0).toBe(0);
    for (let k = 1; k < strips.length; k++) expect(strips[k - 1].x0 + strips[k - 1].w - strips[k].x0).toBeCloseTo(PAGE_OVERLAP, 9);
    expect(strips.at(-1).x0 + strips.at(-1).w).toBeCloseTo(600, 9);
    for (const paper of Object.keys(PAPERS)) expect(pagePlan({ blocks: [wide] }, paper).pages).toBeGreaterThan(0);
  });
});

describe('split templates in the PDF', () => {
  /** Content streams of a PDF, inflated. */
  const streams = (pdf) => {
    const text = new TextDecoder('latin1').decode(pdf);
    return [...text.matchAll(/\/Length (\d+) \/Filter \/FlateDecode >>\nstream\n/g)].map((m) => strFromU8(unzlibSync(pdf.subarray(m.index + m[0].length, m.index + m[0].length + Number(m[1])))));
  };

  it('labels each strip of a block wider and taller than the page and puts the crosses into the overlaps', () => {
    // A block 400 x 400 mm with a frame. A4 portrait (190 x 265 mm printable): 3 columns and 2 rows of
    // strips on 6 pages. Landscape (277 x 178 mm): 2 columns and 3 rows; the 2 strips of the last row,
    // 74 mm high, share a page: 5 pages, so landscape.
    const frame = { kind: 'frame', points: [[0, 0], [400, 0], [400, 400], [0, 400]], closed: true };
    const layout = { width: 400, height: 400, items: [frame], blocks: [{ width: 400, height: 400, items: [frame], label: 'Big' }] };
    const plan = pagePlan(layout, 'a4');
    expect(plan.split).toBe(1);
    const cols = plan.pieces[0].cols;
    const rows = plan.pieces[0].rows;
    expect([plan.pageW, plan.pageH, cols, rows, plan.pages]).toEqual([297, 210, 2, 3, 5]);
    const all = streams(layoutPdf(layout, 'a4')).join('\n');
    for (let k = 1; k <= cols * rows; k++) expect(all).toContain(`(Big: part ${k} of ${cols * rows} \\(row ${Math.ceil(k / cols)}, column ${((k - 1) % cols) + 1}\\))`);
    // Crosses: every pair of neighbouring strips (also in the 74 mm bottom row) shares a cross that
    // lies inside both strips, 3 mm clear of their edges.
    const strips = plan.pieces;
    const crosses = registrationCrosses(plan, 0);
    const inside = (q, [x, y]) => x - 3 >= q.x0 && x + 3 <= q.x0 + q.w && y - 3 >= q.y0 && y + 3 <= q.y0 + q.h;
    let pairs = 0;
    for (const a of strips) {
      for (const b of strips) {
        const neighbours = (b.col === a.col + 1 && b.row === a.row) || (b.row === a.row + 1 && b.col === a.col);
        if (!neighbours) continue;
        pairs++;
        expect(crosses.some((c) => inside(a, c) && inside(b, c))).toBe(true);
      }
    }
    // 2 columns x 3 rows: 3 pairs side by side, 4 pairs one above the other.
    expect(pairs).toBe(7);
    expect(crosses).toHaveLength(7);
    for (const [x, y] of crosses) expect(all).toContain(`${(x - 3).toFixed(3)} ${y.toFixed(3)} m`);
    // Strips of one column overlap by 10 mm.
    const upper = strips.find((q) => q.row === 0 && q.col === 0);
    const lower = strips.find((q) => q.row === 1 && q.col === 0);
    expect(upper.y0 - (lower.y0 + lower.h)).toBeCloseTo(-PAGE_OVERLAP, 9);
  });

  it('writes the CSV without a deviation column value when the segments carry none', () => {
    const b = buildWing(sampleProject());
    const row = segmentsCsv(foamSegments(b, [], { deviation: false })).trim().split('\n')[1].split(',');
    expect(row[7]).toBe('');
    expect(row[8]).toBe('');
  });
});

describe('settings', () => {
  it('read the stored settings, each within its range, else the defaults', () => {
    const store = new Map();
    globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
    try {
      expect(storedFoamSettings()).toEqual(FOAM_DEFAULTS);
      store.set(FOAM_SETTINGS_KEY, JSON.stringify({ coreLength: 450, tolerance: 99, kerf: 1.2, paper: 'a3' }));
      expect(storedFoamSettings()).toEqual({ coreLength: 450, tolerance: FOAM_DEFAULTS.tolerance, kerf: 1.2, paper: 'a3' });
      store.set(FOAM_SETTINGS_KEY, '{broken');
      expect(storedFoamSettings()).toEqual(FOAM_DEFAULTS);
    } finally {
      delete globalThis.localStorage;
    }
  });
});
