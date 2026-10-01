// Winglet dialog (Sections tab): the defaults on the Sport design, the preview summary, the
// checks that disable Add, and Add and Undo as one step.
//
// Sport (src/model/wizard.js): 2 sections, half span 600 mm, tip chord 144 mm, dihedral 1.5°.
// Default winglet: height 144 mm (one tip chord), cant 75°, blend radius 43 mm (0.3 tip chords).
// The arc turns 73.5° in 5 steps of at most 15°, then the winglet tip: 6 sections.
import { createDesign, dialogOf, expect, openTab, savedProject, sectionRows as rows, statusOf as status, test, toastOf } from './helpers.js';

const SPORT = /^Span 1200 mm · area 23\.04 dm² · AR 6\.25 · /;

async function openWinglet(page) {
  await openTab(page, 'Sections');
  await page.getByRole('button', { name: 'Winglet…', exact: true }).click();
  const dlg = dialogOf(page);
  await expect(dlg.getByRole('heading', { name: 'Winglet' })).toBeVisible();
  return dlg;
}

test.describe('Winglet dialog', () => {
  test('previews the default winglet, adds its sections as one step and Undo removes them', async ({ page }) => {
    await createDesign(page, 'Sport');
    await expect(status(page)).toHaveText(SPORT);
    const dlg = await openWinglet(page);
    await expect(dlg.getByLabel('Height along the winglet (mm)')).toHaveValue('144');
    await expect(dlg.getByLabel('Cant angle (deg, positive = up)')).toHaveValue('75');
    await expect(dlg.getByLabel('Blend radius (mm)')).toHaveValue('43');
    await expect(dlg.locator('p[aria-live]')).toHaveText(/^Adds 6 sections\. Winglet tip at y = [\d.]+ mm, z = [\d.]+ mm: [\d.]+ mm above and [\d.]+ mm beyond the wing tip\.$/);
    const add = dlg.getByRole('button', { name: 'Add winglet', exact: true });
    await expect(add).toBeEnabled();

    // An arc longer than the height disables Add and names the problem.
    await dlg.getByLabel('Blend radius (mm)').fill('200');
    await expect(add).toBeDisabled();
    await expect(dlg.locator('p[aria-live]')).toHaveText(/^Winglet: the blend arc is [\d.]+ mm long, not shorter than the height/);
    await dlg.getByLabel('Blend radius (mm)').fill('43');
    await expect(add).toBeEnabled();

    await add.click();
    await expect(dialogOf(page)).toHaveCount(0);
    await expect(toastOf(page)).toContainText('Winglet added: 6 sections. Undo removes it.');
    await expect(rows(page)).toHaveCount(8);
    const saved = await savedProject(page);
    const ys = saved.sections.map((s) => s.y).sort((a, b) => a - b);
    expect(ys[7]).toBeGreaterThan(600);
    expect(Math.max(...saved.sections.map((s) => s.z))).toBeGreaterThan(130);

    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(rows(page)).toHaveCount(2);
    await expect(status(page)).toHaveText(SPORT);
  });

  test('refuses a pointed wing tip and leaves the sections unchanged on Cancel', async ({ page }) => {
    await createDesign(page, 'Sport', { tip: 'pointed' });
    const dlg = await openWinglet(page);
    await expect(dlg.locator('p[aria-live]')).toHaveText(/a winglet needs a flat tip\.$/);
    await expect(dlg.getByRole('button', { name: 'Add winglet', exact: true })).toBeDisabled();
    await dlg.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(dialogOf(page)).toHaveCount(0);
    await expect(rows(page)).toHaveCount(2);
  });
});
