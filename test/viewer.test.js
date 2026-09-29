import { describe, expect, it } from 'vitest';
import { buildWing } from '../src/geom/wing.js';
import { createProject } from '../src/model/project.js';
import { nacaAirfoil } from '../src/airfoil/naca.js';
import { surfacePoint } from '../src/geom/nurbs.js';
import { displayGeometry } from '../src/ui/viewer3d.js';

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
