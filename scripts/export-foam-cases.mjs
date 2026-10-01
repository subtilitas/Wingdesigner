// Write the foam-cutting files of the STEP test wings (test/step-cases.js) to a directory: the profile
// ZIP, the SVG and DXF template sheets and the PDF templates, plus cases.json with the expected
// values, for validation with scripts/validate_foam.py (ezdxf, pypdf). Cores: the proposal for a
// longest core of 300 mm; one case each with a kerf of 1 mm, on A3 and on Letter paper.
// Usage: node scripts/export-foam-cases.mjs <outDir>
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildWing } from '../src/geom/wing.js';
import { foamSegments, proposeCuts } from '../src/geom/foam.js';
import { PAPERS, layoutDxf, layoutPdf, layoutSvg, pagePlan, profileZip, templateLayout } from '../src/export/foam.js';
import { stepCases } from '../test/step-cases.js';

const out = process.argv[2] ?? 'foam-check';
mkdirSync(out, { recursive: true });
const cases = [];
const options = { 'guided-elliptic': { kerf: 1 }, 'pointed-tip': { paper: 'a3' }, 'mitred-gull-15-5': { paper: 'letter' } };
for (const c of stepCases()) {
  // The Y-up variant differs from its case in the STEP axes only; the cores of a placed part lie in
  // its own frame, the same as those of its unplaced case.
  if (c.up === 'y' || c.name === 'part-tilt-roll') continue;
  const build = buildWing(c.project);
  if (build.errors.length) throw new Error(`${c.name}: ${build.errors.join(' ')}`);
  const segments = foamSegments(build, proposeCuts(build, 300));
  const { kerf = 0, paper = 'a4' } = options[c.name] ?? {};
  const layout = templateLayout(c.name, segments, { kerf });
  const plan = pagePlan(layout, paper);
  const base = join(out, c.name);
  writeFileSync(`${base}-profiles.zip`, profileZip(c.name, segments));
  writeFileSync(`${base}.svg`, layoutSvg(layout));
  writeFileSync(`${base}.dxf`, layoutDxf(layout));
  writeFileSync(`${base}.pdf`, layoutPdf(layout, paper, { title: c.name }));
  const profiles = layout.items.filter((it) => it.kind === 'profile');
  cases.push({
    name: c.name,
    zip: `${base}-profiles.zip`,
    svg: `${base}.svg`,
    dxf: `${base}.dxf`,
    pdf: `${base}.pdf`,
    segments: segments.length,
    points: build.paramsU.length,
    kerf,
    // Polyline vertices: a closed trailing edge repeats no point.
    vertices: profiles.map((p) => p.points.length),
    pages: plan.pages,
    page_mm: [plan.pageW, plan.pageH],
    paper: PAPERS[paper],
  });
}
writeFileSync(join(out, 'cases.json'), JSON.stringify(cases, null, 2));
console.log(`${cases.length} foam-cutting file sets written to ${out}`);
