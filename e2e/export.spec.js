// Export dialog: STEP (AP214, one MANIFOLD_SOLID_BREP per half), binary STL (closed shells for both
// halves, the merged wing and the right half), 3MF (OPC package, millimetre units, one object per
// shell), the project JSON with its derived NURBS data and a round trip through "Open" into a fresh
// browser context, a pointed tip, and a design with errors, for which the dialog offers the project
// JSON only. Opening an invalid project file and a corrupted autosave.
//
// Downloads are read from disk and parsed here; nothing compares against stored baselines.
import { readFileSync } from 'node:fs';
import { strFromU8, unzipSync } from 'fflate';
import {
  FORMAT_LABEL,
  STORAGE_KEY,
  FUSION_FIX,
  VALID_RE,
  collectErrors,
  commit,
  createDesign,
  dialogOf,
  downloadOf,
  expect,
  expectClosed,
  exportFile,
  frames,
  openExport,
  openTab,
  parseStl,
  savedProject,
  sectionField,
  sectionRows,
  sectionValues,
  statusOf as status,
  stlShell,
  stlVertices,
  test,
  toastOf,
} from './helpers.js';

const PKG_VERSION = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
const SPORT_STATUS = 'Span 1200 mm · area 23.04 dm² · AR 6.25 · MAC 196.0 mm';
/**
 * Largest y (mm) of the Sport wing: its tip plane is mitred, square to the 1.5° panel, so the lower
 * surface of the tip (NACA 2410, 144 mm chord) reaches 0.13 mm past the tip position y = 600 mm.
 */
const SPORT_TIP = [600, 600.2];
const within = (v, [lo, hi]) => v > lo && v < hi;
/** Section values compared across pages: shown airfoil name and the numeric fields. */
const tableOf = (page) => sectionValues(page, ['airfoilName', 'y', 'x', 'z', 'chord', 'twist']);

// --- STL -------------------------------------------------------------------------------------------

function signedVolume(tris) {
  let v = 0;
  for (const [{ p: a }, { p: b }, { p: c }] of tris) {
    v += a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0]);
  }
  return v / 6;
}

function yRange(tris) {
  let min = Infinity;
  let max = -Infinity;
  for (const t of tris) for (const { p } of t) [min, max] = [Math.min(min, p[1]), Math.max(max, p[1])];
  return { min, max };
}

// --- 3MF -------------------------------------------------------------------------------------------

function parse3mfObjects(xml) {
  return [...xml.matchAll(/<object id="(\d+)" type="model" name="([^"]*)"><mesh><vertices>(.*?)<\/vertices><triangles>(.*?)<\/triangles><\/mesh><\/object>/g)].map(
    (m) => {
      const vertices = [...m[3].matchAll(/<vertex x="([^"]+)" y="([^"]+)" z="([^"]+)"\/>/g)].map((v) => [Number(v[1]), Number(v[2]), Number(v[3])]);
      const triangles = [...m[4].matchAll(/<triangle v1="(\d+)" v2="(\d+)" v3="(\d+)"\/>/g)].map((t) => [Number(t[1]), Number(t[2]), Number(t[3])]);
      return { id: Number(m[1]), name: m[2], vertices, triangles };
    },
  );
}

// --- STEP ------------------------------------------------------------------------------------------

function stepSummary(text) {
  const count = (re) => (text.match(re) ?? []).length;
  const ys = [...text.matchAll(/CARTESIAN_POINT\('',\(([^,]+),([^,]+),([^)]+)\)\)/g)].map((m) => Number(m[2]));
  return {
    solids: count(/MANIFOLD_SOLID_BREP\(/g),
    shells: count(/CLOSED_SHELL\(/g),
    faces: count(/ADVANCED_FACE\(/g),
    surfaces: count(/B_SPLINE_SURFACE_WITH_KNOTS\(/g),
    names: [...text.matchAll(/MANIFOLD_SOLID_BREP\('([^']*)'/g)].map((m) => m[1]),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

test.describe('export dialog', () => {
  test('STEP: AP214 with two solids for both halves and one for the right half', async ({ page }) => {
    await createDesign(page, 'Sport');
    await expect(status(page)).toHaveText(SPORT_STATUS);

    // Defaults of the dialog: STEP, both halves, normal density.
    const dlg = await openExport(page);
    await expect(dlg.getByLabel(FORMAT_LABEL.step)).toBeChecked();
    await expect(dlg.getByLabel(/^Both halves as separate bodies/)).toBeChecked();
    await expect(dlg.getByLabel(/^Normal/)).toBeChecked();
    for (const f of ['step', 'stl', '3mf', 'json']) await expect(dlg.getByLabel(FORMAT_LABEL[f])).toBeEnabled();
    await dlg.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialogOf(page)).toHaveCount(0);

    const both = await exportFile(page, 'step', { half: 'halves' });
    const right = await exportFile(page, 'step', { half: 'right' });
    const left = await exportFile(page, 'step', { half: 'left' });
    for (const f of [both, right, left]) {
      expect(f.name).toBe('Sport.step');
      const text = f.bytes.toString('latin1');
      expect(text.startsWith('ISO-10303-21;')).toBe(true);
      expect(text.trimEnd().endsWith('END-ISO-10303-21;')).toBe(true);
      expect(text).toContain("FILE_SCHEMA(('AUTOMOTIVE_DESIGN { 1 0 10303 214 1 1 1 1 }'));");
      expect(text).toContain('SI_UNIT(.MILLI.,.METRE.)');
    }
    const b = stepSummary(both.bytes.toString('latin1'));
    const r = stepSummary(right.bytes.toString('latin1'));
    expect(b.solids).toBe(2);
    expect(r.solids).toBe(1);
    expect(b.names).toEqual(['Sport right', 'Sport left']);
    expect(r.names).toEqual(['Sport right']);
    // Left half only: the mirrored half alone.
    const l = stepSummary(left.bytes.toString('latin1'));
    expect([l.solids, l.names, l.faces]).toEqual([1, ['Sport left'], r.faces]);
    expect(Math.abs(l.minY + r.maxY)).toBeLessThan(1e-6);
    expect(l.maxY).toBeLessThanOrEqual(1e-9);
    expect([b.shells, r.shells]).toEqual([2, 1]);
    // Open trailing edge (0.48 mm): upper, lower, trailing-edge, root and tip face per half.
    expect(r.faces).toBe(5);
    expect(b.faces).toBe(2 * r.faces);
    expect(b.surfaces).toBe(2 * r.surfaces);
    // The right half spans y = 0 to the mitred tip; the mirrored left half is its mirror image.
    expect(r.minY).toBeGreaterThanOrEqual(-1e-9);
    expect(within(r.maxY, SPORT_TIP), `right half ends at y = ${r.maxY}`).toBe(true);
    expect(Math.abs(b.maxY - r.maxY)).toBeLessThan(1e-6);
    expect(Math.abs(b.minY + r.maxY)).toBeLessThan(1e-6);
  });

  test('STL: closed shells for both halves, the merged wing and the right half', async ({ page }) => {
    await createDesign(page, 'Sport');

    const files = {};
    for (const half of ['halves', 'merged', 'right']) {
      const f = await exportFile(page, 'stl', { half });
      expect(f.name).toBe('Sport.stl');
      files[half] = parseStl(f.bytes);
      expect(files[half].header).toBe('Wingdesigner Sport');
    }
    const { halves, merged, right } = files;

    // Right half: one closed, outward-oriented shell from y = 0 to the mitred tip.
    expect(right.count).toBeGreaterThan(100);
    expectClosed(stlShell(right.tris), 'right');
    const vRight = signedVolume(right.tris);
    expect(vRight).toBeGreaterThan(0);
    const tipY = yRange(right.tris).max;
    expect(yRange(right.tris).min).toBeGreaterThanOrEqual(0);
    expect(within(tipY, SPORT_TIP), `right half ends at y = ${tipY}`).toBe(true);

    // Both halves: twice the right half, right shell first, then its mirror image.
    expect(halves.count).toBe(2 * right.count);
    const rShell = halves.tris.slice(0, right.count);
    const lShell = halves.tris.slice(right.count);
    expectClosed(stlShell(rShell), 'halves, right shell');
    expectClosed(stlShell(lShell), 'halves, left shell');
    expect(stlShell(rShell)).toEqual(stlShell(right.tris));
    expect(yRange(lShell).max).toBeLessThanOrEqual(0);
    expect(yRange(lShell).min).toBeCloseTo(-tipY, 3);
    expect(signedVolume(rShell)).toBeCloseTo(vRight, 3);
    expect(signedVolume(lShell) / vRight).toBeCloseTo(1, 5);

    // Merged: one closed shell over the full span without the two root caps.
    expectClosed(stlShell(merged.tris), 'merged');
    expect(merged.count).toBeLessThan(halves.count);
    expect(merged.count).toBeGreaterThan(right.count);
    expect(yRange(merged.tris)).toEqual({ min: expect.closeTo(-tipY, 3), max: expect.closeTo(tipY, 3) });
    expect(signedVolume(merged.tris) / (2 * vRight)).toBeCloseTo(1, 5);

    // Fine density refines the mesh (4x on the skin) and stays closed.
    const fine = parseStl((await exportFile(page, 'stl', { half: 'right', dens: 'fine' })).bytes);
    expectClosed(stlShell(fine.tris), 'right, fine');
    expect(fine.count).toBeGreaterThan(3 * right.count);
    expect(fine.count).toBeLessThanOrEqual(4 * right.count);
    expect(signedVolume(fine.tris) / vRight).toBeCloseTo(1, 2);
  });

  test('3MF: OPC package in millimetres with one object per shell', async ({ page }) => {
    await createDesign(page, 'Sport');

    const objectsOf = {};
    for (const half of ['halves', 'merged', 'right']) {
      const f = await exportFile(page, '3mf', { half });
      expect(f.name).toBe('Sport.3mf');
      expect(f.bytes.subarray(0, 2).toString('latin1')).toBe('PK');
      const zip = unzipSync(new Uint8Array(f.bytes));
      expect(Object.keys(zip).sort()).toEqual(['3D/3dmodel.model', '[Content_Types].xml', '_rels/.rels']);
      const types = strFromU8(zip['[Content_Types].xml']);
      expect(types).toContain('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">');
      expect(types).toContain('<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>');
      expect(types).toContain('<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>');
      const rels = strFromU8(zip['_rels/.rels']);
      expect(rels).toMatch(/<Relationship Target="\/3D\/3dmodel\.model" Id="[^"]+" Type="http:\/\/schemas\.microsoft\.com\/3dmanufacturing\/2013\/01\/3dmodel"\/>/);
      const model = strFromU8(zip['3D/3dmodel.model']);
      expect(model).toMatch(/<model unit="millimeter" [^>]*xmlns="http:\/\/schemas\.microsoft\.com\/3dmanufacturing\/core\/2015\/02"/);
      expect(model).toContain('<metadata name="Title">Sport</metadata>');
      const objects = parse3mfObjects(model);
      expect((model.match(/<object /g) ?? []).length).toBe(objects.length);
      const items = [...model.matchAll(/<item objectid="(\d+)"\/>/g)].map((m) => Number(m[1]));
      expect(items).toEqual(objects.map((o) => o.id));
      for (const o of objects) {
        // One check per object: an expect per index takes seconds on a mesh of thousands of triangles.
        expect(o.triangles.flat().filter((i) => !(i < o.vertices.length)), `3MF ${half} ${o.name}: indices beyond the vertices`).toEqual([]);
        expectClosed(o.triangles, `3MF ${half} ${o.name}`);
      }
      objectsOf[half] = objects;
    }
    expect(objectsOf.halves.map((o) => o.name)).toEqual(['Wing right', 'Wing left']);
    expect(objectsOf.merged.map((o) => o.name)).toEqual(['Wing']);
    expect(objectsOf.right.map((o) => o.name)).toEqual(['Wing right']);
    const nRight = objectsOf.right[0].triangles.length;
    expect(objectsOf.halves.map((o) => o.triangles.length)).toEqual([nRight, nRight]);
    expect(objectsOf.halves[0].vertices).toEqual(objectsOf.right[0].vertices);
    // Left object: mirror image of the right one at y = 0.
    const mirrored = objectsOf.right[0].vertices.map(([x, y, z]) => [x, y === 0 ? 0 : -y, z]);
    expect(objectsOf.halves[1].vertices).toEqual(mirrored);
    expect(objectsOf.merged[0].triangles.length).toBeLessThan(2 * nRight);
    const ys = objectsOf.merged[0].vertices.map((v) => v[1]);
    expect(within(Math.max(...ys), SPORT_TIP)).toBe(true);
    expect(Math.min(...ys)).toBeCloseTo(-Math.max(...ys), 3);
  });

  test('the Fusion 360 fix writes the part with Y up, and the dialog keeps the choice', async ({ page }) => {
    await createDesign(page, 'Sport');
    const dlg = await openExport(page);
    const axes = dlg.getByText(/^Units: millimetres\. Axes:/);
    await expect(dlg.getByLabel(FUSION_FIX)).not.toBeChecked();
    await expect(axes).toHaveText('Units: millimetres. Axes: x chordwise towards the trailing edge, y spanwise, z up.');
    await dlg.getByLabel(FUSION_FIX).check();
    await expect(axes).toHaveText('Units: millimetres. Axes: x chordwise towards the trailing edge, y up, z spanwise towards the left tip.');
    // The project JSON keeps the axes of the app.
    await dlg.getByLabel(FORMAT_LABEL.json).check();
    await expect(axes).toHaveText('Units: millimetres. Axes: x chordwise towards the trailing edge, y spanwise, z up.');
    await dlg.getByRole('button', { name: 'Cancel' }).click();

    // Every vertex of the Y-up STL is the Z-up vertex (x, y, z) turned to (x, z, −y), exact in float32.
    const zUp = parseStl((await exportFile(page, 'stl', { half: 'right', up: 'z' })).bytes).tris;
    const yUp = parseStl((await exportFile(page, 'stl', { half: 'right', up: 'y' })).bytes).tris;
    expect(yUp).toHaveLength(zUp.length);
    const turned = zUp.map((t) => t.map(({ p: [x, y, z] }) => [x, z, -y]));
    expect(yUp.map((t) => t.map(({ p }) => p))).toEqual(turned);
    expectClosed(stlShell(yUp), 'Y-up right half');
    expect(signedVolume(yUp)).toBeCloseTo(signedVolume(zUp), 1);

    // The next export and a reload start with the last choice; Z up brings the app axes back.
    await expect((await openExport(page)).getByLabel(FUSION_FIX)).toBeChecked();
    await dialogOf(page).getByRole('button', { name: 'Cancel' }).click();
    await page.reload();
    await expect(status(page)).toHaveText(SPORT_STATUS);
    await expect((await openExport(page)).getByLabel(FUSION_FIX)).toBeChecked();
    await dialogOf(page).getByRole('button', { name: 'Cancel' }).click();
    const back = parseStl((await exportFile(page, 'stl', { half: 'right', up: 'z' })).bytes).tris;
    expect(back.map((t) => t.map(({ p }) => p))).toEqual(zUp.map((t) => t.map(({ p }) => p)));
  });

  test('pointed tip exports closed solids that end in the scaled tip profile', async ({ page }) => {
    await createDesign(page, 'Sport', { tip: 'pointed' });
    await expect(status(page)).toHaveText(VALID_RE);

    // STL, right half: one closed shell that ends at y = 600 in the 1.2 mm tip profile (240 / 200),
    // square to the 1.5° panel: its 0.13 mm height reaches 0.004 mm to either side of y = 600.
    const stl = parseStl((await exportFile(page, 'stl', { half: 'right' })).bytes);
    expectClosed(stlShell(stl.tris), 'pointed right half');
    expect(signedVolume(stl.tris)).toBeGreaterThan(0);
    expect(yRange(stl.tris)).toEqual({ min: expect.closeTo(0, 6), max: expect.closeTo(600, 2) });
    const tip = stlVertices(stl.tris).filter((p) => p[1] > 600 - 0.01);
    const extent = (k) => Math.max(...tip.map((p) => p[k])) - Math.min(...tip.map((p) => p[k]));
    expect(tip.length).toBeGreaterThan(50);
    expect(Math.abs(extent(0) - 1.2), `tip profile length ${extent(0)} mm`).toBeLessThanOrEqual(0.01);
    // MH 32 at 1.2 mm chord plus the twist of -1°: 0.127 mm high.
    expect(Math.abs(extent(2) - 0.127), `tip profile height ${extent(2)} mm`).toBeLessThanOrEqual(0.005);

    // STEP, both halves: one closed solid per half with upper, lower, trailing-edge, root and tip face.
    const step = stepSummary((await exportFile(page, 'step', { half: 'halves' })).bytes.toString('latin1'));
    expect(step.solids).toBe(2);
    expect(step.shells).toBe(2);
    expect(step.faces).toBe(10);
    expect(step.names).toEqual(['Sport right', 'Sport left']);
    expect(Math.abs(step.maxY - 600)).toBeLessThan(0.01);
    expect(Math.abs(step.minY + step.maxY)).toBeLessThan(1e-6);
  });

  test('Export writes a value typed into a field and committed by the Export click', async ({ page }) => {
    await createDesign(page, 'Sport');
    // Type the tip y without Enter: the click on Export blurs the field, which commits the value.
    await sectionField(page, 1, 'y').fill('700');
    const json = JSON.parse((await exportFile(page, 'json')).bytes.toString('utf8'));
    expect(json.sections.map((s) => s.y)).toEqual([0, 700]);
    expect(json.derived.stations.at(-1).y).toBe(700);
    // The mitred tip reaches up to 0.2 mm past the tip position.
    const ys = json.derived.surface.controlPoints.flat().map((p) => p[1]);
    expect(within(Math.max(...ys), [700, 700.2])).toBe(true);
    await sectionField(page, 1, 'y').fill('650');
    const stl = parseStl((await exportFile(page, 'stl', { half: 'right' })).bytes);
    expect(within(yRange(stl.tris).max, [650, 650.2])).toBe(true);
  });

  test('project JSON holds the derived surface and opens in a fresh browser context', async ({ page, browser }) => {
    await createDesign(page, 'Glider');
    const sections = await tableOf(page);
    expect(sections).toHaveLength(3);
    const statusText = (await status(page).innerText()).trim();
    await openTab(page, 'Checks');
    const surfaceRow = (p) => p.locator('#pane-checks table.stats tr', { has: p.getByRole('rowheader', { name: 'Surface' }) }).locator('td');
    const surfaceText = (await surfaceRow(page).innerText()).trim();

    const file = await exportFile(page, 'json');
    expect(file.name).toBe('Glider.json');
    const json = JSON.parse(file.bytes.toString('utf8'));
    expect(json.format).toBe('wingdesigner-project');
    expect(json.version).toBe(3);
    expect(json.units).toBe('mm');
    expect(json.name).toBe('Glider');
    expect(json.settings.sectionPlanes).toBe('mitred');
    // Every station carries the roll of its plane and its thickness stretch; the root plane is vertical.
    expect(json.derived.stations[0]).toMatchObject({ y: 0, roll: 0 });
    for (const st of json.derived.stations) expect(Number.isFinite(st.roll) && st.stretch >= 1).toBe(true);
    expect(json.generator).toEqual({ name: 'Wingdesigner', version: PKG_VERSION });
    expect(json.sections.map((s) => s.y)).toEqual(sections.map((s) => s.y));
    expect(json.sections.map((s) => s.chord)).toEqual(sections.map((s) => s.chord));
    expect(json.guides.nose.enabled).toBe(true);
    expect(json.guides.end.enabled).toBe(true);
    const surf = json.derived?.surface;
    expect(surf).toBeTruthy();
    const nu = surf.controlPoints.length;
    const nv = surf.controlPoints[0].length;
    expect(surf.knotsU).toHaveLength(nu + surf.degreeU + 1);
    expect(surf.knotsV).toHaveLength(nv + surf.degreeV + 1);
    for (const row of surf.controlPoints) {
      expect(row).toHaveLength(nv);
      for (const p of row) expect(p.every(Number.isFinite) && p.length === 3).toBe(true);
    }
    expect(surfaceText).toBe(`degree ${surf.degreeU} x ${surf.degreeV}, ${nu} x ${nv} control points`);
    expect(json.derived.profiles.length).toBeGreaterThan(0);
    expect(json.derived.guides.nose).toBeTruthy();
    for (const s of sections) expect(json.derived.stations.some((st) => Math.abs(st.y - s.y) < 1e-9)).toBe(true);

    // Fresh context (empty storage): the wizard opens; create a different design, then Open the file.
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    const errors2 = collectErrors(page2);
    expect(page2.viewportSize()).toEqual(page.viewportSize());
    await createDesign(page2, 'Trainer');
    expect(await tableOf(page2)).not.toEqual(sections);
    const [chooser] = await Promise.all([page2.waitForEvent('filechooser'), page2.getByRole('button', { name: 'Open', exact: true }).click()]);
    expect(chooser.isMultiple()).toBe(false);
    await chooser.setFiles({ name: file.name, mimeType: 'application/json', buffer: file.bytes });
    await expect(toastOf(page2)).toHaveText('Opened Glider.json.');
    await expect(sectionRows(page2)).toHaveCount(3);
    await expect.poll(() => tableOf(page2)).toEqual(sections);
    await expect(status(page2)).toHaveText(statusText);
    await openTab(page2, 'Checks');
    await expect(surfaceRow(page2)).toHaveText(surfaceText);

    // The opened project is autosaved and survives a reload.
    await page2.reload();
    await expect(dialogOf(page2)).toHaveCount(0);
    await expect(status(page2)).toHaveText(statusText);
    expect(await tableOf(page2)).toEqual(sections);
    expect(errors2).toEqual([]);
    await context2.close();
  });

  /** Sport design with the end-line tip point in front of the nose line (nose tip at x = 24). */
  async function crossGuides(page) {
    await createDesign(page, 'Sport');
    await openTab(page, 'Planform');
    const group = (name) => page.locator('#pane-planform').getByRole('group', { name });
    const end = group('End line (trailing edge)');
    await group('Nose line (leading edge)').getByRole('checkbox', { name: 'Use guide curve' }).check();
    await end.getByRole('checkbox', { name: 'Use guide curve' }).check();
    await expect(end.locator('tbody tr')).toHaveCount(2);
    await commit(end.locator('tbody tr').nth(1).getByRole('spinbutton'), 0);
    await expect(status(page)).toHaveText(/^1 error\(s\): Chord drops to -24\.00 mm at y = 600\.0 mm; nose line and end line must not touch or cross\./);
    await expect(status(page)).toHaveClass(/has-error/);
  }

  test('with crossing guide lines the dialog preselects and writes the project JSON', async ({ page }) => {
    await crossGuides(page);

    const dlg = await openExport(page);
    await expect(dlg.locator('.sev-error')).toHaveText('The wing has errors; only the project JSON can be exported.');
    await expect(dlg.getByLabel(FORMAT_LABEL.json)).toBeEnabled();
    await expect(dlg.getByLabel(FORMAT_LABEL.json)).toBeChecked();
    for (const f of ['step', 'stl', '3mf']) await expect(dlg.getByLabel(FORMAT_LABEL[f])).not.toBeChecked();
    const file = await downloadOf(page, () => dlg.getByRole('button', { name: 'Download' }).click());
    expect(file.name).toBe('Sport.json');
    const json = JSON.parse(file.bytes.toString('utf8'));
    expect(json.format).toBe('wingdesigner-project');
    // No surface: the derived NURBS section is left out, the edited guide is kept.
    expect(json.derived).toBeUndefined();
    expect(json.guides.nose.enabled).toBe(true);
    expect(json.guides.end.enabled).toBe(true);
    expect(json.guides.end.points.at(-1)).toEqual([0, 600]);

    // Undo removes the crossing; all formats are offered again with STEP preselected.
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(status(page)).toHaveText(SPORT_STATUS);
    const dlg2 = await openExport(page);
    await expect(dlg2.locator('.sev-error')).toHaveCount(0);
    for (const f of ['step', 'stl', '3mf', 'json']) await expect(dlg2.getByLabel(FORMAT_LABEL[f])).toBeEnabled();
    await expect(dlg2.getByLabel(FORMAT_LABEL.step)).toBeChecked();
    const step = await downloadOf(page, () => dlg2.getByRole('button', { name: 'Download' }).click());
    expect(step.name).toBe('Sport.step');
    expect(stepSummary(step.bytes.toString('latin1')).solids).toBe(2);
  });

  test('with crossing guide lines STEP, STL and 3MF cannot be selected', async ({ page }) => {
    await crossGuides(page);
    const dlg = await openExport(page);
    await expect(dlg.locator('.sev-error')).toBeVisible();
    for (const f of ['step', 'stl', '3mf']) await expect(dlg.getByLabel(FORMAT_LABEL[f]), `${f} radio`).toBeDisabled();
    await expect(dlg.getByLabel(FORMAT_LABEL.json)).toBeChecked();
  });
});

test.describe('project upgrade', () => {
  test('Open turns the folded tilt of a version 2 file into a part tilt and names it', async ({ page }) => {
    await createDesign(page, 'Sport');
    const project = await savedProject(page);
    // A version 2 file of an earlier XFLR5 import: 3° folded into the sections about the origin.
    const old = { ...project, version: 2, settings: { ...project.settings, sectionPlanes: 'vertical' }, foldedTilt: { angle: 3, x: 0, z: 0 } };
    for (const k of ['partTilt', 'partRoll', 'partPivot']) delete old.settings[k];
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Open', exact: true }).click()]);
    await chooser.setFiles({ name: 'folded.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(old)) });
    await expect(toastOf(page)).toHaveText(
      'Opened folded.json. The tilt angle of 3° that the XFLR5 import folded into the sections is a rigid tilt of the whole part (Settings > Part tilt); the sections hold the values of the untilted part.',
    );
    await expect(toastOf(page)).not.toHaveClass(/\berror\b/);
    // The fold is undone: every twist is 3° lower, and the part carries the tilt about the old fold axis.
    const twists = (await tableOf(page)).map((r) => r.twist);
    expect(twists).toEqual(project.sections.map((s) => s.twist - 3));
    await expect.poll(async () => (await savedProject(page))?.settings).toMatchObject({ partTilt: 3, partRoll: 0, partPivot: { x: 0, y: 0, z: 0 } });
    const saved = await savedProject(page);
    expect([saved.version, saved.foldedTilt]).toEqual([3, undefined]);
    await openTab(page, 'Settings');
    await expect(page.getByRole('spinbutton', { name: /^Part tilt/ })).toHaveValue('3');

    // The same version 2 project restored from browser storage next to the marker of a full storage:
    // the start message names both, as an error.
    await page.evaluate(
      ([key, text]) => {
        localStorage.setItem(key, text);
        localStorage.setItem(`${key}.stale`, '2026-09-29 12:00 UTC');
      },
      [STORAGE_KEY, JSON.stringify(old)],
    );
    await page.reload();
    await expect(toastOf(page)).toHaveText(
      'This is the project as last saved; autosave stopped at 2026-09-29 12:00 UTC because browser storage was full, and later edits were not saved. The tilt angle of 3° that the XFLR5 import folded into the sections is a rigid tilt of the whole part (Settings > Part tilt); the sections hold the values of the untilted part.',
    );
    await expect(toastOf(page)).toHaveClass(/error/);
    // The upgraded restore is saved at once: the next start reads version 3 and repeats no note.
    await expect.poll(async () => (await savedProject(page))?.version).toBe(3);
    await page.reload();
    await expect(page.getByRole('spinbutton', { name: /^Part tilt/ })).toHaveValue('3');
    await expect(toastOf(page)).not.toContainText('folded into the sections');
  });
});

test.describe('project file errors', () => {
  test('Open reports a file the browser cannot read and keeps the design', async ({ page }) => {
    await createDesign(page, 'Sport');
    await expect(status(page)).toHaveText(SPORT_STATUS);
    const table = await tableOf(page);
    // A removed volume or revoked permission rejects File.text() with NotReadableError.
    await page.evaluate(() => {
      File.prototype.text = () => Promise.reject(new DOMException('The file could not be read.', 'NotReadableError'));
    });
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Open', exact: true }).click()]);
    await chooser.setFiles({ name: 'gone.json', mimeType: 'application/json', buffer: Buffer.from('{}') });
    await expect(toastOf(page)).toHaveText('Cannot open gone.json: the browser could not read the file (NotReadableError).');
    await expect(toastOf(page)).toHaveClass(/\berror\b/);
    await expect(status(page)).toHaveText(SPORT_STATUS);
    expect(await tableOf(page)).toEqual(table);
  });

  test('Open rejects a file that is not a Wingdesigner project and keeps the design', async ({ page }) => {
    await createDesign(page, 'Sport');
    await expect(status(page)).toHaveText(SPORT_STATUS);
    await expect.poll(async () => (await savedProject(page))?.name).toBe('Sport');
    const before = await savedProject(page);
    const table = await tableOf(page);

    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Open', exact: true }).click()]);
    await chooser.setFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"format":"x"}') });
    await expect(toastOf(page)).toHaveText(
      'Cannot open bad.json: format must be "wingdesigner-project". Unsupported project version undefined. airfoils must be a non-empty array.',
    );
    await expect(toastOf(page)).toHaveClass(/\berror\b/);
    // Nothing changed: same design, same autosave, and no load in the undo history.
    await expect(status(page)).toHaveText(SPORT_STATUS);
    expect(await tableOf(page)).toEqual(table);
    expect(await savedProject(page)).toEqual(before);
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(status(page)).toHaveText(/^Span 1500 mm/);
  });

  /** Fills browser storage with a filler key until `free` characters or fewer stay free. */
  const fillStorage = (page, free = 0) =>
    page.evaluate((free) => {
      localStorage.removeItem('filler');
      let n = 0;
      for (const step of [1_000_000, 100_000, 10_000, 1000, 10]) {
        while (true) {
          try {
            localStorage.setItem('filler', 'x'.repeat(n + step));
            n += step;
          } catch {
            break;
          }
        }
      }
      localStorage.setItem('filler', 'x'.repeat(Math.max(0, n - free)));
    }, free);

  test('a full browser storage turns autosave off with a notice; the next start names the older save', async ({ page }) => {
    await createDesign(page, 'Sport');
    await openTab(page, 'Settings');
    const nameField = page.locator('#pane-settings').getByRole('textbox', { name: 'Project name' });
    const rename = async (name) => {
      await nameField.fill(name);
      await nameField.press('Enter');
    };
    // About 120 characters stay free: the stale marker fits, a 185 characters longer name does not.
    await fillStorage(page, 120);
    await rename(`Sport ${'long '.repeat(37)}`);
    await expect(toastOf(page)).toHaveText(/^Autosave is off: browser storage refused the project \(\d+ characters; browsers keep about 5,000,000 per site\)\. Use Save to keep it\.$/);
    await expect(status(page)).toContainText('Autosave off: use Save');
    expect((await savedProject(page)).name).toBe('Sport');
    expect(await page.evaluate((key) => localStorage.getItem(`${key}.stale`), STORAGE_KEY)).toMatch(/^\d{4}-\d\d-\d\d \d\d:\d\d UTC$/);

    // The next start opens the last save and says that later edits are missing.
    await page.reload();
    await expect(toastOf(page)).toHaveText(/^This is the project as last saved; autosave stopped at .+ UTC because browser storage was full, and later edits were not saved\.$/);
    await expect(status(page)).not.toContainText('Autosave off');
    await openTab(page, 'Settings');
    await expect(nameField).toHaveValue('Sport');

    // With room again, the next save works and clears the notice.
    await rename(`Sport ${'long '.repeat(37)}`);
    await expect(status(page)).toContainText('Autosave off: use Save');
    await page.evaluate(() => localStorage.removeItem('filler'));
    await rename('Sport renamed');
    await expect(toastOf(page)).toHaveText('Autosave works again.');
    await expect(status(page)).not.toContainText('Autosave off');
    expect((await savedProject(page)).name).toBe('Sport renamed');
    expect(await page.evaluate((key) => localStorage.getItem(`${key}.stale`), STORAGE_KEY)).toBeNull();
  });

  test('the notice of a lost autosave stays readable next to the size warning of the restored project', async ({ page }) => {
    await createDesign(page, 'Sport');
    const p = await savedProject(page);
    p.sections = Array.from({ length: 250 }, (_, i) => ({ ...p.sections[0], id: `s${i}`, y: 2 * i }));
    delete p.guides;
    await page.evaluate(
      ([key, text]) => {
        localStorage.setItem(key, text);
        localStorage.setItem(`${key}.stale`, '2026-09-29 12:00 UTC');
      },
      [STORAGE_KEY, JSON.stringify(p)],
    );
    await page.reload();
    await expect(toastOf(page)).toHaveText(
      /^This is the project as last saved; autosave stopped at 2026-09-29 12:00 UTC because browser storage was full, and later edits were not saved\. Large project: 250 sections \(warning above 200\)/,
    );
    await expect(toastOf(page)).toHaveClass(/error/);
  });

  test('an unloadable save that has no room for a copy stays in place and autosave stays off', async ({ page }) => {
    await createDesign(page, 'Sport');
    const bad = JSON.stringify({ format: 'wingdesigner-project', version: 1, name: 'x'.repeat(100_000), airfoils: [], sections: [] });
    await page.evaluate(([key, text]) => localStorage.setItem(key, text), [STORAGE_KEY, bad]);
    await fillStorage(page, 0);
    await page.reload();
    await expect(toastOf(page)).toHaveText(
      `The saved project could not be loaded (airfoils must be a non-empty array.), and browser storage has no room for a copy: autosave is off, so it stays under "${STORAGE_KEY}". Use Save to keep new work.`,
    );
    const wizard = dialogOf(page);
    await wizard.getByRole('radio', { name: /^Plank/ }).click();
    await wizard.getByRole('button', { name: 'Create design' }).click();
    await expect(status(page)).toHaveText(/^Span 1000 mm/);
    await expect(status(page)).toContainText('Autosave off: use Save');
    await page.evaluate(() => localStorage.removeItem('filler'));
    await openTab(page, 'Settings');
    await page.locator('#pane-settings').getByRole('textbox', { name: 'Project name' }).fill('Plank 2');
    await page.locator('#pane-settings').getByRole('textbox', { name: 'Project name' }).press('Enter');
    await frames(page);
    expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBe(bad);
  });

  test('a corrupted autosave is kept aside with a message and the wizard opens', async ({ page }) => {
    await createDesign(page, 'Sport');
    const corrupted = '{"format":"wingdesigner-project","version":1,"sections":[]}';
    await page.evaluate(([key, text]) => localStorage.setItem(key, text), [STORAGE_KEY, corrupted]);
    await page.reload();

    await expect(dialogOf(page).getByRole('heading', { name: 'Start a new wing design' })).toBeVisible();
    await expect(toastOf(page)).toHaveText(
      `The saved project could not be loaded (airfoils must be a non-empty array.); it is kept in local storage under "${STORAGE_KEY}.rejected".`,
    );
    await expect(toastOf(page)).toHaveClass(/\berror\b/);
    expect(await page.evaluate((key) => localStorage.getItem(`${key}.rejected`), STORAGE_KEY)).toBe(corrupted);

    // A new design from the wizard works and leaves the rejected data in place.
    const wizard = dialogOf(page);
    await wizard.getByRole('radio', { name: /^Plank/ }).click();
    await wizard.getByRole('button', { name: 'Create design' }).click();
    await expect(status(page)).toHaveText(/^Span 1000 mm · area 19\.80 dm²/);
    await expect.poll(async () => (await savedProject(page))?.name).toBe('Plank');
    expect(await page.evaluate((key) => localStorage.getItem(`${key}.rejected`), STORAGE_KEY)).toBe(corrupted);
  });
});
