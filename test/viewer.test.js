import { describe, expect, it } from 'vitest';
import { buildWing } from '../src/geom/wing.js';
import { createProject } from '../src/model/project.js';
import { nacaAirfoil } from '../src/airfoil/naca.js';
import { surfacePoint } from '../src/geom/nurbs.js';
import { sampleProject } from './helpers.js';
import { addRoundTip, defaultRoundTip } from '../src/model/roundtip.js';
import { MAX_EDGE_SAMPLES, MAX_NET_SEGMENTS, MAX_OUTLINE_SEGMENTS, controlNetSegments, displayGeometry, edgeParams, outlineIndices } from '../src/ui/viewer3d.js';

describe('3D view geometry', () => {
  it('rebases a small wing near the coordinate limit, so 32-bit positions keep its shape', () => {
    const build = buildWing(
      createProject({
        airfoils: [{ id: 'a', name: 'NACA 2412', points: nacaAirfoil('2412').points }],
        sections: [0, 10].map((y) => ({ airfoil: 'a', x: 801579, y, z: 955903, chord: 7.41, twist: 0 })),
        settings: { chordSamples: 16 },
      }),
    );
    expect(build.errors).toEqual([]);
    const origin = surfacePoint(build.surface, build.uLE, 0.5).map(Math.round);
    const us = build.paramsU;
    const M = us.length;
    // Largest distance of the stored surface vertices (plus their origin) from the exact surface.
    const error = (geometry, o) => {
      const pos = geometry.surface.getAttribute('position').array;
      const V = pos.length / 3 / M;
      const r = (V - 1) / (build.paramsV.length - 1);
      let worst = 0;
      for (let k = 0; k < V; k++) {
        const i = Math.floor(k / r);
        const v = i + 1 < build.paramsV.length ? build.paramsV[i] + ((build.paramsV[i + 1] - build.paramsV[i]) * (k - i * r)) / r : build.paramsV[i];
        for (let j = 0; j < M; j++) {
          const P = surfacePoint(build.surface, us[j], v);
          const q = (k * M + j) * 3;
          worst = Math.max(worst, Math.hypot(pos[q] + o[0] - P[0], pos[q + 1] + o[1] - P[1], pos[q + 2] + o[2] - P[2]));
        }
      }
      return worst;
    };
    // Absolute positions: up to half the 0.0625 mm spacing per axis; rebased: below 1e-5 mm.
    expect(error(displayGeometry(build), [0, 0, 0])).toBeGreaterThan(0.01);
    expect(error(displayGeometry(build, origin), origin)).toBeLessThan(1e-5);
  });
  it('samples the edge polylines 4 times per station interval within 20,000 samples', () => {
    expect(edgeParams([0, 0.5, 1])).toEqual([0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1]);
    // 151,481 span parameters (3,788 smooth sections, 40 stations per panel).
    const many = Array.from({ length: 151_481 }, (_, i) => i / 151_480);
    const vs = edgeParams(many);
    expect(vs.length).toBeLessThanOrEqual(MAX_EDGE_SAMPLES);
    expect(vs[0]).toBe(0);
    expect(vs[vs.length - 1]).toBe(1);
  });

  it('draws every section outline up to 100,000 segments and every k-th outline above', () => {
    expect(outlineIndices(3, 121)).toEqual([0, 1, 2]);
    // 12,468 sections x 401 segments: every 50th outline and the tip give 251 x 401 = 100,651, above
    // the cap; every 51st gives 246 x 401 = 98,646.
    const kept = outlineIndices(12_468, 401);
    expect(kept).toHaveLength(246);
    expect(kept[0]).toBe(0);
    expect(kept[kept.length - 1]).toBe(12_467);
    expect(kept.length * 401).toBeLessThanOrEqual(MAX_OUTLINE_SEGMENTS);
    expect(kept.length * 401).toBeGreaterThan(MAX_OUTLINE_SEGMENTS * 0.9);
  });

  it('draws the whole control net up to 100,000 segments and every k-th line above', () => {
    const net = (nI, nJ) => Array.from({ length: nI }, (_, i) => Array.from({ length: nJ }, (_, j) => [i, j, 0]));
    const small = controlNetSegments(net(3, 4), [1, 0, 0]);
    expect(small.step).toBe(1);
    // 3 rows x 3 segments + 4 columns x 2 segments.
    expect(small.positions.length).toBe(17 * 6);
    expect(Array.from(small.positions.slice(0, 6))).toEqual([-1, 0, 0, -1, 1, 0]);
    const big = controlNetSegments(net(401, 1000));
    // 800,599 segments: every 9th line, 46 rows x 999 + 112 columns x 400 = 90,754 segments.
    expect(big.step).toBe(9);
    expect(big.positions.length / 6).toBe(90_754);
    expect(big.positions.length / 6).toBeLessThanOrEqual(MAX_NET_SEGMENTS);
    // First and last lines are kept in both directions.
    const ends = new Set();
    for (let k = 0; k < big.positions.length; k += 3) ends.add(`${big.positions[k]},${big.positions[k + 1]}`);
    for (const corner of ['0,0', '400,0', '0,999', '400,999']) expect(ends.has(corner)).toBe(true);
    // 33 x 151,000 points: the first and last rows alone hold 302,000 segments, so the kept lines
    // also pass through every k-th point only.
    const long = controlNetSegments(net(33, 151_000));
    expect(long.along).toBe(long.step);
    expect(long.positions.length / 6).toBeLessThanOrEqual(MAX_NET_SEGMENTS);
    const longEnds = new Set();
    for (let k = 0; k < long.positions.length; k += 3) longEnds.add(`${long.positions[k]},${long.positions[k + 1]}`);
    for (const corner of ['0,0', '32,0', '0,150999', '32,150999']) expect(longEnds.has(corner)).toBe(true);
  });

  it('keeps the display mesh within 100,000 vertices when the loft grid alone is larger', () => {
    const build = buildWing(
      createProject({
        airfoils: [{ id: 'a', name: 'NACA 2412', points: nacaAirfoil('2412').points }],
        sections: Array.from({ length: 20 }, (_, i) => ({ airfoil: 'a', x: 0, y: 50 * i, z: 0, chord: 200 - 5 * i, twist: 0 })),
        settings: { spanwise: 'smooth', chordSamples: 200, panelStations: 40 },
      }),
    );
    expect(build.errors).toEqual([]);
    expect(build.paramsU.length * build.paramsV.length).toBeGreaterThan(100_000);
    const vertices = displayGeometry(build).surface.getAttribute('position').count;
    expect(vertices).toBeLessThanOrEqual(100_000);
    expect(vertices).toBeGreaterThan(90_000);
  });
});

describe('3D view of a tip closed in a point', () => {
  it('draws no tip cap and gives every vertex of the point a unit normal on the side of the surface next to it', () => {
    for (const te of ['closed', 'thickness']) {
      const p = sampleProject({ settings: { trailingEdge: { mode: te, thickness: 0.4 } } });
      addRoundTip(p, defaultRoundTip(p));
      const build = buildWing(p);
      expect([build.errors, build.tipPole], te).toEqual([[], true]);
      const { surface, caps } = displayGeometry(build);
      const M = build.paramsU.length;
      const pos = surface.getAttribute('position').array;
      const nrm = surface.getAttribute('normal').array;
      const V = pos.length / 3 / M;
      let bad = 0;
      for (let i = 0; i < nrm.length; i += 3) if (!(Math.abs(Math.hypot(nrm[i], nrm[i + 1], nrm[i + 2]) - 1) < 1e-6)) bad++;
      expect(bad, te).toBe(0);
      // The point row: one position for every u. Its normals are those of the surface next to it in v:
      // on the side of the normals of the row before (no normal turned into the wing).
      const row = (k) => Array.from({ length: M }, (_, j) => [0, 1, 2].map((c) => pos[(k * M + j) * 3 + c]));
      const point = row(V - 1);
      for (const q of point) expect(Math.hypot(...q.map((v, c) => v - point[0][c])), te).toBeLessThan(1e-3);
      let turned = 0;
      for (let j = 0; j < M; j++) {
        const [a, b] = [V - 1, V - 2].map((k) => (k * M + j) * 3);
        if (!(nrm[a] * nrm[b] + nrm[a + 1] * nrm[b + 1] + nrm[a + 2] * nrm[b + 2] > 0)) turned++;
      }
      expect(turned, te).toBe(0);
      // Caps: the root cap (a strip triangulation of the root ring, ring − 2 triangles) and, with an
      // open trailing edge, 2 triangles per row interval of the trailing-edge strip.
      const ring = build.closedTE ? M - 1 : M;
      expect(caps.getAttribute('position').count / 3, te).toBe(ring - 2 + (build.closedTE ? 0 : 2 * (V - 1)));
    }
  });
});

describe('planform edge handles', () => {
  it('offers no handle on a pointed tip edge that the build sets', async () => {
    const { edgeHandles } = await import('../src/ui/planform.js');
    const p = sampleProject();
    const tip = p.sections.at(-1);
    const root = p.sections[0];
    expect(edgeHandles(p, tip, tip.id)).toEqual({ le: true, te: true });
    p.settings.tip = { mode: 'pointed', ratio: 0.005 };
    expect(edgeHandles(p, tip, tip.id)).toEqual({ le: true, te: false });
    expect(edgeHandles(p, root, tip.id)).toEqual({ le: true, te: true });
    p.guides.end.enabled = true;
    expect(edgeHandles(p, tip, tip.id)).toEqual({ le: false, te: false });
    expect(edgeHandles(p, root, tip.id)).toEqual({ le: true, te: false });
  });
});
