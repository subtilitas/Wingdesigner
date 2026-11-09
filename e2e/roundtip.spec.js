// Rounded-tip dialog (Sections tab): the defaults on the Sport design, the preview summary, the
// checks that disable Add, and Add and Undo as one step with the wing tip mode.
//
// Sport (src/model/wizard.js): 2 sections, half span 600 mm, tip chord 144 mm, dihedral 1.5°.
// Default rounded tip: 144 mm long (one tip chord), straight line at 25 %, 6 sections, tangent to the
// last panel (κ = −0.16), fullness 2.5; the point at
// y = 600 + 144 · cos 1.5° = 743.95 mm with the 1 mm chord of a pointed tip.
import { createDesign, dialogOf, expect, openTab, savedProject, sectionRows as rows, statusOf as status, test, toastOf } from './helpers.js';

const SPORT = /^Span 1200 mm · area 23\.04 dm² · AR 6\.25 · /;

async function openRoundTip(page) {
  await openTab(page, 'Sections');
  await page.getByRole('button', { name: 'Rounded tip…', exact: true }).click();
  const dlg = dialogOf(page);
  await expect(dlg.getByRole('heading', { name: 'Rounded tip' })).toBeVisible();
  return dlg;
}

test.describe('Rounded-tip dialog', () => {
  test('previews the default rounded tip, adds its sections as one step and Undo removes them', async ({ page }) => {
    await createDesign(page, 'Sport');
    await expect(status(page)).toHaveText(SPORT);
    const dlg = await openRoundTip(page);
    await expect(dlg.getByLabel('Length beyond the tip section (mm)')).toHaveValue('144');
    await expect(dlg.getByLabel('Straight line (% of the chord from the leading edge)')).toHaveValue('25');
    await expect(dlg.getByLabel('Number of sections')).toHaveValue('6');
    await expect(dlg.getByLabel('Fullness (2 = ellipse, 3 = fullest)')).toHaveValue('2.5');
    await expect(dlg.locator('p[aria-live]')).toHaveText('Adds 6 sections and sets Settings > Wing tip to Pointed. Point at y = 744.0 mm, 144.0 mm beyond the tip section, chord 1.00 mm.');
    const add = dlg.getByRole('button', { name: 'Add rounded tip', exact: true });
    await expect(add).toBeEnabled();

    // A last panel under 1 mm wide in y disables Add and names the problem.
    await dlg.getByLabel('Length beyond the tip section (mm)').fill('50');
    await dlg.getByLabel('Number of sections').fill('12');
    await expect(add).toBeDisabled();
    await expect(dlg.locator('p[aria-live]')).toHaveText(/^Rounded-tip panel 12 spans 0\.42 mm in y, less than 1 mm/);
    await dlg.getByLabel('Number of sections').fill('6');

    // Tangent is on: the Sport tip panel tapers to zero chord 900.31 mm beyond the tip, so a tangent tip
    // stops at 855.29 mm; switched off, the same length is allowed.
    const tangent = dlg.getByLabel('Tangent to the last panel');
    await expect(tangent).toBeChecked();
    await dlg.getByLabel('Length beyond the tip section (mm)').fill('856');
    await expect(add).toBeDisabled();
    await expect(dlg.locator('p[aria-live]')).toHaveText(/^Rounded tip: the last panel tapers to zero chord within 900\.31 mm, so a tangent tip can be at most 855\.29 mm long/);
    await tangent.uncheck();
    await expect(add).toBeEnabled();
    await tangent.check();
    await dlg.getByLabel('Length beyond the tip section (mm)').fill('144');
    await expect(add).toBeEnabled();

    await add.click();
    await expect(dialogOf(page)).toHaveCount(0);
    await expect(toastOf(page)).toContainText('Rounded tip added: 6 sections, wing tip set to Pointed. Undo removes it.');
    await expect(rows(page)).toHaveCount(8);
    const saved = await savedProject(page);
    expect(saved.settings.tip.mode).toBe('pointed');
    const tip = saved.sections.slice().sort((a, b) => a.y - b.y).at(-1);
    expect([tip.y, tip.chord]).toEqual([743.95, 1]);
    // Tangent, fullness 2.5: the first rounded-tip section at y = 637.26 mm has 136.14 mm chord.
    expect(saved.sections.find((q) => q.y === 637.26).chord).toBe(136.14);
    // The added sections carry the rounded-tip marker that the loft blends along the tip ellipse.
    expect(saved.sections.filter((q) => q.y > 600).map((q) => q.roundTip)).toEqual(Array(6).fill('tangent'));
    await expect(status(page)).not.toHaveText(SPORT);

    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(rows(page)).toHaveCount(2);
    await expect(status(page)).toHaveText(SPORT);
    expect((await savedProject(page)).settings.tip.mode).toBe('flat');
  });

  test('refuses a pointed wing tip and leaves the sections unchanged on Cancel', async ({ page }) => {
    await createDesign(page, 'Sport', { tip: 'pointed' });
    const dlg = await openRoundTip(page);
    await expect(dlg.locator('p[aria-live]')).toHaveText(/a rounded tip needs a flat tip\.$/);
    await expect(dlg.getByRole('button', { name: 'Add rounded tip', exact: true })).toBeDisabled();
    await dlg.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(dialogOf(page)).toHaveCount(0);
    await expect(rows(page)).toHaveCount(2);
  });
});
