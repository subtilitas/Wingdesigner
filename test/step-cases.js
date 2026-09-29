// Wing configurations covering the STEP topology variants (open/closed trailing edge,
// linear/smooth spanwise interpolation, guide curves, root off the symmetry plane, mirroring).
import { naca, sampleProject } from './helpers.js';

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
  return cases;
}
