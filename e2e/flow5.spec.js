// flow5 import through Open: a .fl5 project (the wing list, the rolled elevator as part roll and tilt,
// airfoils from the file, a fin as the left half of the part) and a flow5 plane XML file whose
// airfoils are .dat files next to it (Upload .dat files… matches several at once by name).
// Input files: test/fixtures/flow5/ (written by flow5 from Wingdesigner's own inputs; SOURCE.md).
import { fileURLToPath } from 'node:url';
import { createDesign, dialogOf, expect, openTab, savedProject, sectionRows, test, toastOf } from './helpers.js';

const FIXTURES = new URL('../test/fixtures/flow5/', import.meta.url);
const fixturePath = (name) => fileURLToPath(new URL(name, FIXTURES));

const importDialog = (page) => page.locator('dialog.xflr5[open]');
const airfoilRows = (dlg) => dlg.locator('table.xflr5-airfoils tbody tr');
const foundOf = (row) => row.locator('td').first();
const reportOf = (dlg) => dlg.locator('ul.issues li');

async function openImport(page, name) {
  await page.locator('header.topbar input[type=file]').setInputFiles(fixturePath(name));
  const dlg = importDialog(page);
  await expect(dlg.getByRole('heading', { name: 'Import from flow5' })).toBeVisible();
  return dlg;
}

test.describe('flow5 import', () => {
  test('.fl5 project: the wing list, the rolled elevator as part roll and tilt, then Undo', async ({ page }) => {
    await createDesign(page, 'Sport');
    const dlg = await openImport(page, 'full.fl5');
    await expect(dlg.locator('.xflr5-source')).toHaveText('full.fl5 · flow5 project, format 500754 (flow5 7.54 or later)');
    // flow5 sorts its planes by name; the first one, a triangle mesh, has no wings.
    const planeSelect = dlg.getByRole('combobox', { name: 'Plane' });
    await expect(planeSelect.locator('option')).toHaveText(['Mesh plane', 'Second', 'Tandem']);
    await planeSelect.selectOption({ label: 'Tandem' });
    const radios = dlg.getByRole('radio');
    await expect(radios).toHaveCount(6);
    for (const radio of await radios.all()) await expect(radio).toBeEnabled();
    await expect(dlg.getByRole('radio', { name: /^Main wing 1 / })).toBeChecked();
    await dlg.getByRole('radio', { name: /^Horizontal stabilizer \(flow5: Elevator\)/ }).check();
    await expect(airfoilRows(dlg)).toHaveCount(1);
    await expect(foundOf(airfoilRows(dlg).first())).toHaveText('From the file');
    await expect(reportOf(dlg).first()).toHaveText(/^Warning: flow5 rolls the whole wing, so its left half turns the other way; .* up to 62\.5 mm from flow5's left half\.$/);
    await dlg.getByRole('button', { name: 'Import', exact: true }).click();
    await expect(dialogOf(page)).toHaveCount(0);
    await expect(toastOf(page)).toContainText('Imported the horizontal stabilizer "Vee" of "Tandem" from full.fl5: 2 sections, 1 airfoil.');
    const saved = await savedProject(page);
    expect(saved.settings).toMatchObject({ partTilt: -2, partRoll: 10, partPivot: { x: 1000, y: 0, z: 80 } });
    expect(saved.airfoils.map((a) => [a.name, a.source.kind])).toEqual([['NACA 0009', 'flow5']]);
    await openTab(page, 'Airfoils');
    await expect(page.locator('#pane-airfoils')).toContainText('flow5: full.fl5');
    await openTab(page, 'Sections');
    await expect(sectionRows(page)).toHaveCount(2);
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(sectionRows(page)).toHaveCount(2);
    await expect.poll(async () => (await savedProject(page)).name).toBe('Sport');
  });

  test('.fl5 project: a fin imports as the half flow5 builds, standing up by part roll 90°', async ({ page }) => {
    await createDesign(page, 'Sport');
    const dlg = await openImport(page, 'basic.fl5');
    await dlg.getByRole('radio', { name: /^Fin / }).check();
    await expect(reportOf(dlg).filter({ hasText: 'A one-sided wing: flow5 builds its left half only' })).toHaveCount(1);
    await dlg.getByRole('button', { name: 'Import', exact: true }).click();
    await expect(toastOf(page)).toContainText('Imported the wing "Fin" of "Test plane" from basic.fl5: 2 sections, 1 airfoil.');
    expect((await savedProject(page)).settings).toMatchObject({ partRoll: 90, partTilt: 0, partPivot: { x: 800, y: 0, z: 50 } });
  });

  test('plane XML with .dat file references: Upload .dat files… matches both airfoils by name', async ({ page }) => {
    await createDesign(page, 'Sport');
    const dlg = await openImport(page, 'full-plane-files.xml');
    await expect(dlg.locator('.xflr5-source')).toHaveText('full-plane-files.xml · flow5 plane file (XML), lengths in millimetres');
    await expect(airfoilRows(dlg)).toHaveCount(2);
    await expect(foundOf(airfoilRows(dlg).nth(1))).toHaveText('Missing');
    await expect(dlg.getByRole('button', { name: 'Import (1 airfoil missing)' })).toBeDisabled();
    await dlg.locator('input[type=file][multiple]').setInputFiles([fixturePath('NACA 2412.dat'), fixturePath('Flapped 2410.dat')]);
    await expect(foundOf(airfoilRows(dlg).first())).toHaveText('Uploaded file');
    await expect(foundOf(airfoilRows(dlg).nth(1))).toHaveText('Uploaded file');
    await expect(dlg.locator('p.visually-hidden[aria-live]')).toHaveText('2 files uploaded; 2 airfoil names use them.');
    await dlg.getByRole('button', { name: 'Import', exact: true }).click();
    await expect(toastOf(page)).toContainText('Imported the main wing "Front" of "Tandem" from full-plane-files.xml: 2 sections, 2 airfoils.');
    expect((await savedProject(page)).settings).toMatchObject({ partTilt: 1, partRoll: 0 });
  });
});
