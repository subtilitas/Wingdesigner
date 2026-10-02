// Wing configurations covering the STEP topology variants (open/closed trailing edge,
// linear/smooth spanwise interpolation, guide curves, root off the symmetry plane, mirroring,
// mitred section planes, a rigid placement of the part).
import { createProject } from '../src/model/project.js';
import { cuspedAirfoil, naca, sampleProject } from './helpers.js';

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
  // A closed, cusped trailing edge (zero thickness and wedge angle) at 240 mm root chord. Free end
  // tangents of the chordwise fit cross the upper and lower surfaces up to 0.046 mm from the
  // trailing edge, and BRepCheck reports the root cap of the left half as a self-intersecting wire.
  const cusped = createProject({
    name: 'Cusped',
    airfoils: [cuspedAirfoil()],
    sections: [
      { airfoil: 'cusp', x: 0, y: 0, z: 0, chord: 240, twist: 0 },
      { airfoil: 'cusp', x: 48, y: 600, z: 24, chord: 168, twist: -2 },
      { airfoil: 'cusp', x: 120, y: 960, z: 48, chord: 96, twist: -3 },
    ],
    settings: { spanwise: 'straight', sectionPlanes: 'vertical' },
  });
  cases.push({ name: 'cusped-closed', project: cusped, mirror: true });
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
  // The same gull with Smooth: the section rolls blended by the cubic, the stretch from the slope of
  // the blended reference line, the root plane vertical against a reference line at the cubic's slope.
  const smoothGull = structuredClone(gull);
  smoothGull.settings = { ...smoothGull.settings, spanwise: 'smooth' };
  cases.push({ name: 'mitred-gull-smooth', project: smoothGull, mirror: true });
  // An XFLR5 airfoil switch: sections 0.5 mm apart in y share the bisector plane of the 0° and 10°
  // panels around them; the outer panel stores 10.5° (panelAngle), which the tip plane is square to.
  const tan10 = Math.tan(10 * DEG);
  const sw = createProject({
    name: 'Mitred airfoil switch',
    airfoils: [naca('2412', 'in'), naca('0012', 'out')],
    sections: [
      { airfoil: 'in', x: 0, y: 0, z: 0, chord: 200, twist: 0 },
      { airfoil: 'in', x: 10, y: 299.5, z: 0, chord: 180, twist: 0 },
      { airfoil: 'out', x: 10, y: 300, z: 0, chord: 180, twist: 0, panelAngle: 10.5 },
      { airfoil: 'out', x: 40, y: 600, z: 300 * tan10, chord: 120, twist: -2 },
    ],
    settings: { spanwise: 'straight', sectionPlanes: 'mitred' },
  });
  cases.push({ name: 'mitred-switch-short-panel', project: sw, mirror: true });
  // A rigid placement of the part (src/geom/part.js): the mitred gull rolled 12° and tilted 8° about a
  // pivot off the root, so that turned surfaces, curves, cap planes and the mirror are checked together.
  const turned = structuredClone(gull);
  turned.settings = { ...turned.settings, partTilt: 8, partRoll: 12, partPivot: { x: 50, y: 0, z: -20 } };
  cases.push({ name: 'part-tilt-roll', project: turned, mirror: true });
  return cases;
}
