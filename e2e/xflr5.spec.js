// XFLR5 import through Open: the import dialog (source line, plane choice, surface choice, airfoil
// table with upload and view, report, project name), the imported project in the Sections table,
// the status bar and the toast, Undo, Cancel, files that cannot be imported, the Open file types,
// XFLR5 files whose name lost its extension, the refusal of XFLR5 files in the Airfoils upload, the
// dialog on a 360 px phone and in German.
// Input files: test/fixtures/xflr5/ (origin and license in its SOURCE.md), and a project with many
// airfoils from test/xflr5-writer.js.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createDesign, dialogOf, expect, openTab, savedProject, sectionRows, sectionValues, statusFigures, statusOf, test, toastOf } from './helpers.js';
import { writeProject } from '../test/xflr5-writer.js';

const FIXTURES = new URL('../test/fixtures/xflr5/', import.meta.url);
const fixturePath = (name) => fileURLToPath(new URL(name, FIXTURES));
const fixture = (name) => readFileSync(fixturePath(name));

const SPORT_STATUS = 'Span 1200 mm · area 23.04 dm² · AR 6.25 · MAC 196.0 mm';
// A valid airfoil with a "few points" warning (as in the smoke test), its nose 1 % of the chord
// above the file's x axis: XFLR5 draws it so, and the import moves its section to match.
const DAT = 'TEST 12\n1 0.011\n0.75 0.06\n0.5 0.08\n0.25 0.08\n0.1 0.055\n0.02 0.03\n0 0.01\n0.02 -0.005\n0.1 -0.02\n0.25 -0.03\n0.5 -0.025\n0.75 -0.01\n1 0.009\n';
const phoneOnly = (testInfo) => test.skip(testInfo.project.name !== 'mobile', 'Phone layout: mobile project only');

/** The import dialog (a second dialog, the airfoil view, can open on top of it). */
const importDialog = (page) => page.locator('dialog.xflr5[open]');
const airfoilRows = (dlg) => dlg.locator('table.xflr5-airfoils tbody tr');
/** "Found" cell of an airfoil row. */
const foundOf = (row) => row.locator('td').first();
const reportOf = (dlg) => dlg.locator('ul.issues li');
/** The line under the planform: span, area, aspect ratio and MAC of the candidate project. */
const statsOf = (dlg) => dlg.locator('p.small[aria-live="polite"]');

/** Chooses a file with Open (the file input of the top bar): a fixture path, or a name and its bytes. */
async function openFile(page, file) {
  await page.locator('header.topbar input[type=file]').setInputFiles(file);
}

/** Opens a file that the import dialog shows; returns the dialog. */
async function openImport(page, file) {
  await openFile(page, file);
  const dlg = importDialog(page);
  await expect(dlg.getByRole('heading', { name: 'Import from XFLR5' })).toBeVisible();
  return dlg;
}

/** A symmetric NACA 4-digit section of thickness t (fraction of chord), 99 points in Selig order. */
function symmetric(t) {
  const yt = (x) => 5 * t * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x ** 2 + 0.2843 * x ** 3 - 0.1015 * x ** 4);
  const upper = Array.from({ length: 50 }, (_, k) => (1 + Math.cos((Math.PI * k) / 49)) / 2).map((x) => [x, yt(x)]);
  const lower = Array.from({ length: 49 }, (_, k) => (1 - Math.cos((Math.PI * (k + 1)) / 49)) / 2).map((x) => [x, -yt(x)]);
  return [...upper, ...lower];
}

/**
 * An .xfl project, plane "Many": the main wing "Big" names `n` distinct airfoils (8 % to 20 % thick,
 * one per section), the stabilizer "Stab" one. Checking the main wing takes seconds, in slices.
 */
function manyAirfoils(n) {
  const foils = Array.from({ length: n }, (_, i) => ({ name: `F${i}`, points: symmetric(0.08 + (0.12 * i) / n) }));
  const big = { name: 'Big', sections: foils.map((f, i) => ({ rightFoil: f.name, chord: 0.2, y: 0.005 * i })) };
  const stab = { name: 'Stab', sections: [{ rightFoil: 'S', chord: 0.1, y: 0 }, { rightFoil: 'S', chord: 0.08, y: 0.2 }] };
  const project = writeProject({ planes: [{ name: 'Many', wings: [big, { name: 'Second Wing' }, stab, { name: 'Fin' }] }], foils: [...foils, { name: 'S', points: symmetric(0.09) }, { name: 'Foil A' }, { name: 'Foil B' }] });
  return Buffer.from(project.bytes);
}

/**
 * The plane XML in millimetres with another airfoil name at the tip section of the elevator, and a
 * garbled tilt angle of the fin (a reader warning about a wing that is not imported).
 */
function xmlWithElevatorTip(foil) {
  const [before, fin] = fixture('xml_mm/0.plane.xml').toString('utf8').split('<Name>Fin</Name>');
  const at = before.lastIndexOf('<Left_Side_FoilName>NACA 0009');
  return Buffer.from(`${before.slice(0, at)}${before.slice(at).replaceAll('NACA 0009', foil)}<Name>Fin</Name>${fin.replace('<Tilt_angle>  0.000</Tilt_angle>', '<Tilt_angle>abc</Tilt_angle>')}`);
}

test.describe('XFLR5 import', () => {
  test('XML plane file: the stabilizer with a NACA airfoil and an uploaded .dat, then Undo', async ({ page }) => {
    await createDesign(page, 'Sport');
    await expect(statusOf(page)).toHaveText(SPORT_STATUS);
    const sport = await sectionValues(page);

    const dlg = await openImport(page, { name: '0.plane.xml', mimeType: 'text/xml', buffer: xmlWithElevatorTip('TEST 12') });
    await expect(dlg.locator('.xflr5-source')).toHaveText('0.plane.xml · XFLR5 plane file (XML), lengths in millimetres');
    // One plane: no plane choice. The main wing and the stabilizer are offered, the fin is not.
    await expect(dlg.getByRole('combobox', { name: 'Plane', exact: true })).toHaveCount(0);
    await expect(dlg.getByRole('group', { name: 'Surface to import' }).getByRole('radio')).toHaveCount(2);
    const main = dlg.getByRole('radio', { name: /^Main wing/ });
    const stab = dlg.getByRole('radio', { name: /^Horizontal stabilizer/ });
    await expect(main).toBeChecked();
    // Keyboard focus starts on the surface, not in the name field.
    await expect(main).toBeFocused();
    await expect(main).toHaveAccessibleName('Main wing "Main Wing": 3 sections, span 1794 mm, root chord 240 mm');
    await expect(dlg.getByRole('img', { name: 'Planform preview' })).toBeVisible();
    await expect(stab).toHaveAccessibleName('Horizontal stabilizer (XFLR5: Elevator) "Elevator": 2 sections, span 460 mm, root chord 110 mm');
    await expect(dlg.getByRole('radio', { name: /Fin/ })).toHaveCount(0);
    await expect(dlg.getByRole('textbox', { name: 'Project name' })).toHaveValue('Fixture A Main Wing');

    await stab.check();
    await expect(stab).toBeChecked();
    await expect(dlg.getByRole('textbox', { name: 'Project name' })).toHaveValue('Fixture A Elevator');
    // Enter on a surface radio does not import before the airfoils and the report are seen.
    await stab.press('Enter');
    await expect(dlg).toBeVisible();
    await expect(reportOf(dlg).filter({ hasText: 'Not imported: the main wing "Main Wing", the fin "Fin".' })).toHaveCount(1);
    await expect(reportOf(dlg).filter({ hasText: 'Tilt angle -1.5° applied as in the XFLR5 plane' })).toHaveCount(1);
    await expect(reportOf(dlg).filter({ hasText: 'Warning: Plane "Fixture A", wing "Fin": Tilt_angle "abc" is not a number.' })).toHaveCount(1);

    // "NACA 0009" is generated; "TEST 12" is missing and blocks the import.
    const rows = airfoilRows(dlg);
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0).getByRole('rowheader')).toHaveText('NACA 0009 section 1');
    await expect(foundOf(rows.nth(0))).toHaveText('NACA equations');
    // The automatic choice names the airfoil it found.
    await expect(dlg.getByRole('combobox', { name: 'Airfoil for "NACA 0009"' }).locator('option:checked')).toHaveText('Automatic: NACA generator: NACA 0009');
    await expect(rows.nth(1).getByRole('rowheader')).toHaveText('TEST 12 section 2');
    await expect(foundOf(rows.nth(1))).toHaveText('Missing');
    const importBtn = dlg.getByRole('button', { name: /^Import/ });
    await expect(importBtn).toHaveText('Import (1 airfoil missing)');
    await expect(importBtn).toBeDisabled();
    await expect(dlg.locator('ul.issues li.sev-error')).toHaveText(['Error: Airfoil "TEST 12" (section 2) is missing: upload a .dat file or pick an airfoil.']);
    await expect(rows.nth(1).getByRole('button', { name: 'View the airfoil for "TEST 12"' })).toBeDisabled();
    await expect(foundOf(rows.nth(1))).toHaveClass('sev-error');

    // Any source can be picked for a row, and "Pick an airfoil" takes the pick back. The NACA
    // sections of the other rows come first.
    const tipChoice = dlg.getByRole('combobox', { name: 'Airfoil for "TEST 12"' });
    await expect(tipChoice.locator('option:checked')).toHaveText('Pick an airfoil');
    await expect(tipChoice.locator('option').nth(1)).toHaveText('NACA generator: NACA 0009');
    await tipChoice.selectOption({ label: 'NACA generator: NACA 0012' });
    await expect(importBtn).toHaveText('Import');
    await expect(importBtn).toBeEnabled();
    await expect(foundOf(rows.nth(1))).toHaveText('Picked');
    await expect(foundOf(rows.nth(1))).not.toHaveClass('sev-error');
    await expect(tipChoice).toHaveValue('naca:0012');
    await tipChoice.selectOption('');
    await expect(importBtn).toHaveText('Import (1 airfoil missing)');
    await expect(importBtn).toBeDisabled();
    await expect(foundOf(rows.nth(1))).toHaveText('Missing');

    // The .dat uploaded for the row becomes its airfoil.
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), rows.nth(1).getByRole('button', { name: 'Upload .dat for "TEST 12"' }).click()]);
    await chooser.setFiles({ name: 'test12.dat', mimeType: 'text/plain', buffer: Buffer.from(DAT) });
    await expect(tipChoice).toHaveValue('upload:0');
    await expect(tipChoice.locator('option:checked')).toHaveText('Uploaded: test12.dat');
    await expect(foundOf(rows.nth(1))).toHaveText('Picked');
    await expect(importBtn).toHaveText('Import');
    await expect(importBtn).toBeEnabled();
    await expect(dlg.locator('ul.issues li.sev-error')).toHaveCount(0);
    // Screen readers hear what became of the upload.
    await expect(dlg.locator('p.visually-hidden[aria-live="polite"]')).toHaveText('test12.dat is used for "TEST 12".');
    // The report names the upload as the select does.
    await expect(reportOf(dlg).filter({ hasText: 'Airfoil "TEST 12 (test12.dat)" (section 2): Only 13 points' })).toHaveCount(1);
    await expect(
      reportOf(dlg).filter({
        hasText:
          /^Info: Airfoil "TEST 12 \(test12\.dat\)" \(section 2\) has its leading edge at x\s=\s0\s%, y\s=\s1\.05\s% and its trailing edge at x\s=\s100\s% of chord in its own coordinates; this section was moved so that the airfoil lies as in XFLR5\.$/,
      }),
    ).toHaveCount(1);
    await expect(statsOf(dlg)).toHaveText(/^Span 460 mm · area/);

    // View shows the airfoil read-only.
    await rows.nth(1).getByRole('button', { name: 'View the airfoil for "TEST 12"' }).click();
    const view = page.locator('dialog[open]:not(.xflr5)');
    await expect(view.getByRole('heading', { name: 'TEST 12' })).toBeVisible();
    await expect(view.getByRole('textbox', { name: 'Airfoil name' })).toBeDisabled();
    await view.getByRole('button', { name: 'Close' }).click();
    await expect(view).toHaveCount(0);
    await expect(dlg).toBeVisible();

    await importBtn.click();
    await expect(importDialog(page)).toHaveCount(0);
    // The reader's warning about the fin is in the report, not in the toast of this import.
    await expect(toastOf(page)).toHaveText(
      'Imported the horizontal stabilizer "Elevator" of "Fixture A" from 0.plane.xml: 2 sections, 2 airfoils. Airfoil "TEST 12 (test12.dat)" (section 2): Only 13 points; the NURBS interpolation may not match the intended shape.',
    );
    await expect(toastOf(page)).not.toHaveClass(/\berror\b/);
    await expect(page.getByRole('tab', { name: 'Sections', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(sectionRows(page)).toHaveCount(2);
    // The elevator of "Fixture A" at its position, in the frame of the part (the tilt is stored, not
    // folded into the sections); the tip section moved 0.735 mm along its normal, where XFLR5 draws the
    // uploaded airfoil's own coordinates, and its chord scaled by 1.0000188: the fitted curve reaches
    // 1.9e-5 of the chord ahead of the nose point (0, 0.01).
    const sections = await sectionValues(page, ['airfoilName', 'y', 'x', 'z', 'chord', 'twist']);
    expect(sections.map((s) => s.airfoilName)).toEqual(['NACA 0009', 'TEST 12']);
    for (const [s, want] of sections.map((s, i) => [s, [{ y: 0, x: 650, z: 40, chord: 110, twist: 0 }, { y: 230, x: 674.9987, z: 40.7351, chord: 70.0013, twist: 0 }][i]])) {
      for (const k of ['y', 'x', 'z', 'chord', 'twist']) expect(s[k], k).toBeCloseTo(want[k], 4);
    }
    const figures = await statusFigures(page, 460);
    expect(figures.area).toBeCloseTo((2 * 230 * (110 + 70)) / 2 / 1e4, 1);
    await expect.poll(async () => (await savedProject(page))?.name).toBe('Fixture A Elevator');
    const saved = await savedProject(page);
    expect(saved.settings).toMatchObject({ twistPivot: 0.25, spanwise: 'straight', trailingEdge: { mode: 'asis' } });
    // The tilt turns the part as a rigid body about the wing origin; the section planes are mitred.
    expect(saved.settings).toMatchObject({ sectionPlanes: 'mitred', partTilt: -1.5, partRoll: 0, partPivot: { x: 650, y: 0, z: 40 } });
    expect(saved.foldedTilt).toBeUndefined();
    expect(saved.airfoils.map((a) => a.source.kind)).toEqual(['naca', 'upload']);

    // Undo brings the previous design back.
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(statusOf(page)).toHaveText(SPORT_STATUS);
    await expect.poll(() => sectionValues(page)).toEqual(sport);
  });

  test('.xfl project with two planes: plane choice, a plane without stabilizer, airfoil notes kept after a reload; checks of another surface in slices', async ({ page }) => {
    await createDesign(page, 'Sport');
    const dlg = await openImport(page, fixturePath('fixtures_v662.xfl'));
    await expect(dlg.locator('.xflr5-source')).toHaveText('fixtures_v662.xfl · XFLR5 project, format 200002 (XFLR5 6.44 or later)');
    const plane = dlg.getByRole('combobox', { name: 'Plane', exact: true });
    await expect(plane.locator('option')).toHaveText(['Fixture A', 'Fixture B']);
    await expect(plane).toHaveValue('0');
    const main = dlg.getByRole('radio', { name: /^Main wing/ });
    const stab = dlg.getByRole('radio', { name: /^Horizontal stabilizer/ });
    await expect(stab).toBeEnabled();
    await expect(foundOf(airfoilRows(dlg).nth(0))).toHaveText('From the file');
    await expect(dlg.getByRole('combobox', { name: 'Airfoil for "Clark Y"' }).locator('option:checked')).toHaveText('Automatic: From the file: Clark Y');
    // Nothing but the table (no stray text such as "null") lies above the planform; the column of
    // buttons has a header for screen readers.
    await expect(dlg.locator('.table-scroll')).not.toContainText('null');
    await expect(dlg.locator('table.xflr5-airfoils thead th').last()).toHaveText('Actions');

    // The stabilizer chosen for Fixture A comes back after a plane without one.
    await stab.check();
    await plane.selectOption({ label: 'Fixture B' });
    await expect(main).toBeChecked();
    await plane.selectOption({ label: 'Fixture A' });
    await expect(stab).toBeChecked();
    await expect(dlg.getByRole('textbox', { name: 'Project name' })).toHaveValue('Fixture A Elevator');
    await main.check();

    await plane.selectOption({ label: 'Fixture B' });
    await expect(stab).toBeDisabled();
    await expect(stab).toHaveAccessibleName('Horizontal stabilizer (XFLR5: Elevator) This plane has no elevator.');
    await expect(main).toBeChecked();
    await expect(main).toHaveAccessibleName('Main wing "Flying Wing": 4 sections, span 1499 mm, root chord 300 mm');
    await expect(dlg.getByRole('textbox', { name: 'Project name' })).toHaveValue('Fixture B Flying Wing');
    const rows = airfoilRows(dlg);
    await expect(rows.getByRole('rowheader')).toHaveText(['Clark Y sections 1–2', 'NACA 0009 sections 3–4']);
    await expect(rows.locator('td:nth-child(2)')).toHaveText(['From the file', 'From the file']);
    await expect(reportOf(dlg).filter({ hasText: 'Position in the XFLR5 plane applied: the wing origin moved to x 50 mm, z 10 mm.' })).toHaveCount(1);

    // A name typed by the user is kept.
    await dlg.getByRole('textbox', { name: 'Project name' }).fill('Plank from XFLR5');
    await dlg.getByRole('button', { name: 'Import', exact: true }).click();
    await expect(importDialog(page)).toHaveCount(0);
    // The summary and the one warning: the Clark Y's own coordinates move its sections.
    await expect(toastOf(page)).toHaveText(
      /^Imported the main wing "Flying Wing" of "Fixture B" from fixtures_v662\.xfl: 4 sections, 2 airfoils\. Airfoil "Clark Y" \(sections 1–2\) has its leading edge at x\s=\s0\s%, y\s=\s3\.55\s% .+; these sections were moved so that the airfoil lies as in XFLR5\.$/,
    );
    await expect(sectionRows(page)).toHaveCount(4);
    await statusFigures(page, 1499);
    const table = await sectionValues(page);

    const NOTES = ['Airfoil "Clark Y" from XFLR5 plane "Fixture B"; base shape without flap deflection.', 'Airfoil "NACA 0009" from XFLR5 plane "Fixture B"; base shape without flap deflection.'];
    await expect.poll(async () => (await savedProject(page))?.name).toBe('Plank from XFLR5');
    await page.reload();
    await expect(dialogOf(page)).toHaveCount(0);
    await expect(sectionRows(page)).toHaveCount(4);
    await expect.poll(() => sectionValues(page)).toEqual(table);
    const saved = await savedProject(page);
    expect(saved.airfoils.map((a) => a.source)).toEqual(NOTES.map((note) => ({ kind: 'xflr5', file: 'fixtures_v662.xfl', note })));
    await openTab(page, 'Airfoils');
    const listed = page.locator('#pane-airfoils .airfoil-list').first().locator('li');
    await expect(listed).toHaveCount(2);
    // The list names where the airfoils came from.
    await expect(listed.first()).toContainText('XFLR5: fixtures_v662.xfl');

    // Another surface whose airfoils are not checked yet is checked in slices, with Import off and
    // nothing of the previous wing in the dialog; afterwards the dialog follows it.
    const many = await openImport(page, { name: 'many.xfl', mimeType: 'application/octet-stream', buffer: manyAirfoils(300) });
    const importBtn = many.getByRole('button', { name: 'Import', exact: true });
    const name = many.getByRole('textbox', { name: 'Project name' });
    await expect(reportOf(many)).toHaveText([/^Checking the airfoils …/]);
    await expect(importBtn).toBeDisabled();
    // Chosen during the first checks, which follow it.
    await many.getByRole('radio', { name: /^Horizontal stabilizer/ }).check();
    await expect(importBtn).toBeEnabled({ timeout: 30_000 });
    await expect(airfoilRows(many).getByRole('rowheader')).toHaveText(['S sections 1–2']);
    await expect(statsOf(many)).toContainText('Span 400 mm');
    await expect(name).toHaveValue('Many Stab');
    await many.getByRole('radio', { name: /^Main wing/ }).check();
    await expect(reportOf(many)).toHaveText([/^Checking the airfoils …/]);
    await expect(importBtn).toBeDisabled();
    await expect(airfoilRows(many)).toHaveCount(0);
    await expect(statsOf(many)).toHaveText('');
    await expect(name).toHaveValue('');
    await expect(importBtn).toBeEnabled({ timeout: 30_000 });
    await expect(airfoilRows(many)).toHaveCount(200);
    await expect(many.getByText('100 more airfoil names are not listed; uploaded .dat files are matched to them by name.')).toBeVisible();
    await expect(name).toHaveValue('Many Big');
    await page.keyboard.press('Escape');
    await expect(importDialog(page)).toHaveCount(0);
    await expect(sectionRows(page)).toHaveCount(4);
  });

  test('Cancel keeps the design and adds no undo step', async ({ page }) => {
    await createDesign(page, 'Sport');
    await expect(statusOf(page)).toHaveText(SPORT_STATUS);
    await expect.poll(async () => (await savedProject(page))?.name).toBe('Sport');
    const before = await savedProject(page);

    // A wing file with the elevator only: the main wing is not offered.
    const dlg = await openImport(page, fixturePath('xml_mm/0.w2.wing.xml'));
    await expect(dlg.locator('.xflr5-source')).toHaveText('0.w2.wing.xml · XFLR5 wing file (XML), lengths in millimetres');
    await expect(dlg.getByRole('radio', { name: /^Main wing/ })).toBeDisabled();
    await expect(dlg.getByRole('radio', { name: /^Main wing/ })).toHaveAccessibleName('Main wing The wing in this file is a horizontal stabilizer (type ELEVATOR).');
    await expect(dlg.getByRole('radio', { name: /^Horizontal stabilizer/ })).toBeChecked();
    // Focus starts on the checked surface: Enter in the name field would import before the airfoils
    // and the report are seen.
    await expect(dlg.getByRole('radio', { name: /^Horizontal stabilizer/ })).toBeFocused();
    await expect(dlg.getByRole('textbox', { name: 'Project name' })).toHaveValue('Elevator');
    await expect(dlg.getByRole('button', { name: 'Import', exact: true })).toBeEnabled();
    await dlg.getByRole('button', { name: 'Cancel' }).click();
    await expect(importDialog(page)).toHaveCount(0);

    await expect(statusOf(page)).toHaveText(SPORT_STATUS);
    expect(await savedProject(page)).toEqual(before);
    // The step before the Sport design is the sample wing of the first run.
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(statusOf(page)).toHaveText(/^Span 1500 mm/);
  });

  test('a damaged .xfl and an XML with another root give an error and keep the design', async ({ page }) => {
    await createDesign(page, 'Sport');
    await expect(statusOf(page)).toHaveText(SPORT_STATUS);
    await expect.poll(async () => (await savedProject(page))?.name).toBe('Sport');
    const before = await savedProject(page);
    const table = await sectionValues(page);

    // Cut off inside the sections of the first wing (they start at byte 906).
    await openFile(page, { name: 'cut.xfl', mimeType: 'application/octet-stream', buffer: fixture('fixtures_v662.xfl').subarray(0, 1000) });
    await expect(toastOf(page)).toHaveText('Cannot open cut.xfl: The file is damaged or cut off at byte 902 (in a wing).');
    await expect(toastOf(page)).toHaveClass(/\berror\b/);
    await expect(importDialog(page)).toHaveCount(0);

    const wrong = fixture('xml_mm/0.plane.xml').toString('utf8').replace('<explane version="1.0">', '<explane version="2.0">');
    await openFile(page, { name: 'wrong.xml', mimeType: 'text/xml', buffer: Buffer.from(wrong) });
    await expect(toastOf(page)).toHaveText('Cannot open wrong.xml: The file is not an XFLR5 plane or wing file (root element "explane", version "2.0").');
    await expect(toastOf(page)).toHaveClass(/\berror\b/);
    await expect(importDialog(page)).toHaveCount(0);

    await expect(statusOf(page)).toHaveText(SPORT_STATUS);
    expect(await sectionValues(page)).toEqual(table);
    expect(await savedProject(page)).toEqual(before);
  });

  test('Import waits for an uploaded .dat that is still being read', async ({ page }) => {
    await createDesign(page, 'Sport');
    const dlg = await openImport(page, fixturePath('xml_mm/0.plane.xml'));
    await dlg.getByRole('radio', { name: /^Horizontal stabilizer/ }).check();
    const importBtn = dlg.getByRole('button', { name: /^Import/ });
    await expect(importBtn).toBeEnabled();
    // The browser hands over the bytes of slow.dat only when the test says so.
    await page.evaluate(() => {
      const read = Blob.prototype.arrayBuffer;
      const gate = new Promise((resolve) => {
        window.releaseUpload = resolve;
      });
      Blob.prototype.arrayBuffer = function () {
        return this.name === 'slow.dat' ? gate.then(() => read.call(this)) : read.call(this);
      };
    });
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), airfoilRows(dlg).first().getByRole('button', { name: /^Upload \.dat for/ }).click()]);
    await chooser.setFiles({ name: 'slow.dat', mimeType: 'text/plain', buffer: Buffer.from(DAT) });
    await expect(importBtn).toBeDisabled();
    await page.evaluate(() => window.releaseUpload());
    await expect(dlg.getByRole('combobox', { name: /^Airfoil for/ }).first().locator('option:checked')).toHaveText('Uploaded: slow.dat');
    await expect(importBtn).toBeEnabled();
  });

  test('the Open button accepts XFLR5 files', async ({ page }) => {
    await createDesign(page, 'Sport');
    const open = page.locator('header.topbar').getByRole('button', { name: 'Open', exact: true });
    await expect(open).toHaveAttribute('title', 'Open a project (.json) or import a wing from XFLR5 or flow5 (.xfl, .fl5, .xml)');
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), open.click()]);
    expect(chooser.isMultiple()).toBe(false);
    expect(await chooser.element().getAttribute('accept')).toBe('.json,.xfl,.xml,.wpa,.fl5,application/json');
    await chooser.setFiles(fixturePath('uaslab/Rascal110.xfl'));
    const dlg = importDialog(page);
    await expect(dlg.locator('.xflr5-source')).toHaveText('Rascal110.xfl · XFLR5 project, format 200001 (XFLR5 6.10 to 6.43)');
    await expect(airfoilRows(dlg)).not.toHaveCount(0);
    // Up to 800 px (small tablets, phones in landscape) the airfoil rows are cards, and each choice
    // shows its airfoil in full.
    await page.setViewportSize({ width: 700, height: 900 });
    expect(await airfoilRows(dlg).evaluateAll((trs) => trs.map((tr) => getComputedStyle(tr).display))).toEqual(Array(await airfoilRows(dlg).count()).fill('grid'));
    const widths = await dlg.locator('table.xflr5-airfoils select').evaluateAll((els) => els.map((el) => el.clientWidth));
    for (const w of widths) expect(w).toBeGreaterThan(400);
    await dlg.getByRole('button', { name: 'Cancel' }).click();
    await expect(importDialog(page)).toHaveCount(0);
    await expect(statusOf(page)).toHaveText(SPORT_STATUS);
  });

  test('Open recognizes XFLR5 files whose name lost its extension', async ({ page }) => {
    await createDesign(page, 'Sport');
    // A project under a name without extension, as some file pickers and downloads leave it.
    let dlg = await openImport(page, { name: 'Rascal110', mimeType: 'application/octet-stream', buffer: fixture('uaslab/Rascal110.xfl') });
    await expect(dlg.locator('.xflr5-source')).toHaveText('Rascal110 · XFLR5 project, format 200001 (XFLR5 6.10 to 6.43)');
    await dlg.getByRole('button', { name: 'Cancel' }).click();
    await expect(importDialog(page)).toHaveCount(0);
    // A plane XML saved as text.
    dlg = await openImport(page, { name: 'plane_xml.txt', mimeType: 'text/plain', buffer: fixture('xml_mm/0.plane.xml') });
    await expect(dlg.locator('.xflr5-source')).toHaveText('plane_xml.txt · XFLR5 plane file (XML), lengths in millimetres');
    await dlg.getByRole('button', { name: 'Cancel' }).click();
    await expect(importDialog(page)).toHaveCount(0);
    // The same XML saved as UTF-16 with a byte order mark (Windows "Unicode" text).
    const utf16 = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(fixture('xml_mm/0.plane.xml').toString('utf8'), 'utf16le')]);
    dlg = await openImport(page, { name: 'plane_utf16.txt', mimeType: 'text/plain', buffer: utf16 });
    await expect(dlg.locator('.xflr5-source')).toHaveText('plane_utf16.txt · XFLR5 plane file (XML), lengths in millimetres');
    await dlg.getByRole('button', { name: 'Cancel' }).click();
    await expect(importDialog(page)).toHaveCount(0);
    await expect(statusOf(page)).toHaveText(SPORT_STATUS);
  });

  test('the Airfoils upload refuses XFLR5 files', async ({ page }) => {
    await createDesign(page, 'Sport');
    await openTab(page, 'Airfoils');
    const upload = page.locator('.dropzone input[type=file]');
    await upload.setInputFiles(fixturePath('fixtures_v662.xfl'));
    await expect(toastOf(page)).toHaveText('fixtures_v662.xfl is an XFLR5 file, not an airfoil. Use Open to import a wing from it.');
    await expect(toastOf(page)).toHaveClass(/\berror\b/);
    await upload.setInputFiles(fixturePath('xml_mm/0.plane.xml'));
    await expect(toastOf(page)).toHaveText('0.plane.xml is an XFLR5 file, not an airfoil. Use Open to import a wing from it.');
    // A project above the 20 MB of an airfoil file (analysis results make it so) gets the same hint.
    await upload.setInputFiles({ name: 'big.xfl', mimeType: 'application/octet-stream', buffer: Buffer.concat([fixture('fixtures_v662.xfl'), Buffer.alloc(21_000_000)]) });
    await expect(toastOf(page)).toHaveText('big.xfl is an XFLR5 file, not an airfoil. Use Open to import a wing from it.');
    await expect(dialogOf(page)).toHaveCount(0);
  });

  test.describe('narrow phone (360 x 780)', () => {
    test.use({ viewport: { width: 360, height: 780 } });

    test('the import dialog fits a 360 px wide phone', async ({ page }, testInfo) => {
      phoneOnly(testInfo);
      await createDesign(page, 'Sport', { tap: true });
      const dlg = await openImport(page, fixturePath('uaslab/Rascal110.xfl'));
      await expect(airfoilRows(dlg).first()).toBeVisible();
      const box = await dlg.evaluate((d) => {
        const r = d.getBoundingClientRect();
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, scrollWidth: d.scrollWidth, clientWidth: d.clientWidth, overflowY: getComputedStyle(d).overflowY };
      });
      expect(box.left).toBeGreaterThanOrEqual(0);
      expect(box.right).toBeLessThanOrEqual(360);
      expect(box.top).toBeGreaterThanOrEqual(0);
      expect(box.bottom).toBeLessThanOrEqual(780);
      expect(box.scrollWidth, 'content width vs. dialog width').toBeLessThanOrEqual(box.clientWidth);
      expect(['auto', 'scroll']).toContain(box.overflowY);
      // Airfoil rows are cards; every control lies inside the dialog.
      expect(await airfoilRows(dlg).evaluateAll((trs) => trs.map((tr) => getComputedStyle(tr).display))).toEqual(Array(await airfoilRows(dlg).count()).fill('grid'));
      const outside = await dlg.evaluate((d) => {
        const dr = d.getBoundingClientRect();
        return [...d.querySelectorAll('button, select, input:not([type=file]), canvas')]
          .filter((el) => el.getClientRects().length)
          .filter((el) => {
            const r = el.getBoundingClientRect();
            return r.left < dr.left || r.right > dr.right;
          })
          .map((el) => el.outerHTML.slice(0, 80));
      });
      expect(outside, 'controls wider than the dialog').toEqual([]);
      const pageWidth = await page.evaluate(() => document.scrollingElement.scrollWidth);
      expect(pageWidth).toBeLessThanOrEqual(360);

      // The stabilizer is reachable and Import can be tapped.
      await dlg.getByRole('radio', { name: /^Horizontal stabilizer/ }).tap();
      await expect(dlg.getByRole('radio', { name: /^Horizontal stabilizer/ })).toBeChecked();
      const importBtn = dlg.getByRole('button', { name: 'Import', exact: true });
      await importBtn.scrollIntoViewIfNeeded();
      await importBtn.tap();
      await expect(importDialog(page)).toHaveCount(0);
      await expect(toastOf(page)).toHaveText(/^Imported the horizontal stabilizer "Elevator" of "Rascal 110" from Rascal110\.xfl: 9 sections, 2 airfoils\./);

      // A toast with a warning lies inside the view, its first sentence readable.
      const fixtures = await openImport(page, fixturePath('fixtures_v662.xfl'));
      const again = fixtures.getByRole('button', { name: 'Import', exact: true });
      await again.scrollIntoViewIfNeeded();
      await again.tap();
      await expect(importDialog(page)).toHaveCount(0);
      await expect(toastOf(page)).toHaveText(/^Imported the main wing "Main Wing" of "Fixture A" from fixtures_v662\.xfl: 3 sections, 2 airfoils\. Airfoil "Clark Y" \(sections 1–2\) has /);
      const toast = await toastOf(page).boundingBox();
      expect(toast.y).toBeGreaterThanOrEqual(0);
      expect(toast.y + toast.height).toBeLessThanOrEqual(780);
      expect(toast.x).toBeGreaterThanOrEqual(0);
      expect(toast.x + toast.width).toBeLessThanOrEqual(360);
      expect(toast.width).toBeGreaterThan(250);
    });
  });
});

test.describe('XFLR5 import in German', () => {
  test.use({ locale: 'de-DE' });

  test('the dialog speaks German', async ({ page }) => {
    await page.goto('/');
    await dialogOf(page).getByRole('button', { name: 'Überspringen (Beispielflügel öffnen)' }).click();
    await expect(dialogOf(page)).toHaveCount(0);
    await openFile(page, fixturePath('fixtures_v662.xfl'));
    const dlg = importDialog(page);
    await expect(dlg.getByRole('heading', { name: 'Aus XFLR5 importieren' })).toBeVisible();
    await expect(dlg.locator('.xflr5-source')).toHaveText('fixtures_v662.xfl · XFLR5-Projekt, Format 200002 (XFLR5 6.44 oder neuer)');
    const plane = dlg.getByRole('combobox', { name: 'Flugzeug', exact: true });
    await expect(plane).toHaveValue('0');
    await expect(dlg.getByRole('group', { name: 'Zu importierende Fläche' })).toBeVisible();
    await expect(dlg.getByRole('radio', { name: /^Tragfläche/ })).toHaveAccessibleName('Tragfläche „Main Wing“: 3 Schnitte, Spannweite 1.794 mm, Wurzeltiefe 240 mm');
    await expect(dlg.getByRole('radio', { name: /^Höhenleitwerk/ })).toHaveAccessibleName('Höhenleitwerk (XFLR5: Elevator) „Elevator“: 2 Schnitte, Spannweite 460 mm, Wurzeltiefe 110 mm');
    await expect(dlg.getByRole('heading', { name: 'Profile', exact: true })).toBeVisible();
    await expect(dlg.locator('table.xflr5-airfoils thead th')).toHaveText(['XFLR5-Profil', 'Gefunden', 'Verwendetes Profil', 'Aktionen']);
    const rows = airfoilRows(dlg);
    await expect(rows.getByRole('rowheader')).toHaveText(['Clark Y Schnitte 1–2', 'NACA 0009 Schnitt 3']);
    await expect(rows.locator('td:nth-child(2)')).toHaveText(['Aus der Datei', 'Aus der Datei']);
    await expect(dlg.getByRole('combobox', { name: 'Profil für „Clark Y“' }).locator('option').first()).toHaveText('Automatisch – Aus der Datei: Clark Y');
    await expect(rows.first().getByRole('button', { name: '.dat hochladen für „Clark Y“' })).toHaveText('.dat hochladen');
    await expect(rows.first().getByRole('button', { name: 'Profil für „Clark Y“ anzeigen' })).toHaveText('Anzeigen');
    await expect(rows.first().getByRole('button', { name: 'Profil für „Clark Y“ anzeigen' })).toBeEnabled();
    await expect(dlg.getByRole('textbox', { name: 'Projektname' })).toHaveValue('Fixture A Main Wing');
    await expect(dlg.getByRole('heading', { name: 'Bericht' })).toBeVisible();
    await expect(reportOf(dlg).filter({ hasText: 'Info: Einstellwinkel 2° wie im XFLR5-Flugzeug angewendet' })).toHaveCount(1);
    await expect(statsOf(dlg)).toHaveText(/^Spannweite 1\.794 mm · Fläche \d+,\d\d dm²/);

    await plane.selectOption({ label: 'Fixture B' });
    await expect(dlg.getByRole('radio', { name: /^Höhenleitwerk/ })).toHaveAccessibleName('Höhenleitwerk (XFLR5: Elevator) Dieses Flugzeug hat kein Höhenleitwerk.');
    await expect(dlg.getByRole('radio', { name: /^Höhenleitwerk/ })).toBeDisabled();
    await expect(dlg.getByRole('button', { name: 'Abbrechen' })).toBeVisible();
    await dlg.getByRole('button', { name: 'Importieren', exact: true }).click();
    await expect(importDialog(page)).toHaveCount(0);
    await expect(toastOf(page)).toHaveText(/^Tragfläche „Flying Wing“ von „Fixture B“ aus fixtures_v662\.xfl importiert: 4 Schnitte, 2 Profile\. Profil „Clark Y“ \(Schnitte 1–2\) hat in seinen eigenen Koordinaten /);
    await expect(page.locator('header.topbar').getByRole('button', { name: 'Öffnen', exact: true })).toHaveAttribute(
      'title',
      'Ein Projekt öffnen (.json) oder einen Flügel aus XFLR5 oder flow5 importieren (.xfl, .fl5, .xml)',
    );
  });
});
