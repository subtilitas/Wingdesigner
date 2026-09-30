// Wing configurations covering the STEP topology variants (open/closed trailing edge,
// linear/smooth spanwise interpolation, guide curves, root off the symmetry plane, mirroring,
// mitred section planes).
import { createProject } from '../src/model/project.js';
import { naca, sampleProject } from './helpers.js';

const DEG = Math.PI / 180;

export function stepCases() {
  const cases = [];
  cases.push({ name: 'open-te-linear', project: sampleProject(), mirror: true });
  cases.push({ name: 'closed-te-smooth', project: sampleProject({ settings: { trailingEdge: { mode: 'closed' }, spanwise: 'smooth' } }), mirror: true });
  const guided = sampleProject({ settings: { trailingEdge: { mode: 'thickness', thickness: 0.5 } } });
  guided.guides.nose.enabled = true;
  guided.guides.end.enabled = true;
  guided.guides.nose.points = [[0, 0], [10, 300], [70, 560], [110, 600]];
  guided.guides.end.points = [[200, 0], [195, 300], [160, 560], [135, 600]];
  cases.push({ name: 'guided-elliptic', project: guided, mirror: true });
  const offset = sampleProject();
  offset.sections.forEach((s) => (s.y += 35));
  cases.push({ name: 'root-offset-half', project: offset, mirror: false });
  const reflex = sampleProject();
  reflex.airfoils = [naca('23112', 'root'), naca('0008', 'tip', { closedTE: true })];
  reflex.settings.trailingEdge = { mode: 'closed', thickness: 0 };
  cases.push({ name: 'reflex-closed', project: reflex, mirror: true });
  const pointed = sampleProject({ settings: { tip: { mode: 'pointed', ratio: 0.002 }, trailingEdge: { mode: 'thickness', thickness: 0.4 } } });
  cases.push({ name: 'pointed-tip', project: pointed, mirror: true });
  const pointedGuided = sampleProject({ settings: { tip: { mode: 'pointed', ratio: 0.005 }, trailingEdge: { mode: 'closed' } } });
  pointedGuided.guides.nose.enabled = true;
  pointedGuided.guides.end.enabled = true;
  pointedGuided.guides.nose.points = [[0, 0], [10, 300], [60, 560], [115, 600]];
  pointedGuided.guides.end.points = [[200, 0], [195, 300], [160, 560], [115, 600]];
  cases.push({ name: 'pointed-elliptic-closed', project: pointedGuided, mirror: true });
  const symmetric = sampleProject();
  symmetric.airfoils = [naca('0009', 'root'), naca('0009', 'tip')];
  cases.push({ name: 'symmetric-0009', project: symmetric, mirror: true });
  // Mitred section planes: a 35° V-tail with straight panels (the tip cap rolled 35°, the root
  // stretched 1.22 times) and a 15°/−5° gull with linear panels (stations in every panel, a cubic loft).
  const vtail = createProject({
    name: 'V-tail',
    airfoils: [naca('0009')],
    sections: [
      { airfoil: '0009', x: 0, y: 0, z: 0, chord: 120, twist: 0 },
      { airfoil: '0009', x: 40, y: 320 * Math.cos(35 * DEG), z: 320 * Math.sin(35 * DEG), chord: 70, twist: 0 },
    ],
    settings: { spanwise: 'straight', sectionPlanes: 'mitred' },
  });
  cases.push({ name: 'mitred-vtail-35', project: vtail, mirror: true });
  // The same V-tail written with Y as the up axis, as for Fusion 360 set to Y up (src/export/axes.js).
  cases.push({ name: 'mitred-vtail-35-y-up', project: vtail, mirror: true, up: 'y' });
  const gull = sampleProject({ settings: { sectionPlanes: 'mitred' } });
  gull.sections[1].z = 300 * Math.tan(15 * DEG);
  gull.sections[2].z = gull.sections[1].z - 300 * Math.tan(5 * DEG);
  cases.push({ name: 'mitred-gull-15-5', project: gull, mirror: true });
  return cases;
}
