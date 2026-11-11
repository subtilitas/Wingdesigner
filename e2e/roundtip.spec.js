// Rounded-tip dialog (Sections tab): the defaults on the Sport design, the preview summary, the
// checks that disable Add, and Add and Undo as one step with the wing tip mode. Settings > Wing tip
// Round: the build error on a wing without a rounded tip, and the STL of a wing that closes in a point.
//
// Sport (src/model/wizard.js): 2 sections, half span 600 mm, tip chord 144 mm, dihedral 1.5°.
// Default rounded tip: 144 mm long (one tip chord), straight line at 25 %, 6 sections, tangent to the
// last panel (κ = −0.16), fullness 2.5; the point at y = 600 + 144 · cos 1.5° = 743.95 mm. Add sets
// Settings > Wing tip to Round: the last section stores chord 1 mm (the smallest chord a section
// holds), the build closes the tip in one point (chord 0), and the Sections table shows
// "tip: 0 (round)" under that chord.
import {
  chordNote,
  createDesign,
  dialogOf,
  expect,
  expectClosed,
  exportFile,
  frames,
  openTab,
  parseStl,
  savedProject,
  sectionRows as rows,
  statusOf as status,
  stlShell,
  stlVertices,
  test,
  toastOf,
} from './helpers.js';

const SPORT = /^Span 1200 mm · area 23\.04 dm² · AR 6\.25 · /;
const ROUND_ERROR =
  'Settings > Wing tip Round closes the tip in a point and needs a rounded tip: add one with Sections > Rounded tip…, or set the wing tip to Flat or Pointed.';
const tipMode = (page) => page.getByRole('combobox', { name: 'Wing tip', exact: true });

/** Picks a Wing tip option and waits for the rebuild. */
async function chooseTip(page, value) {
  await frames(page);
  await tipMode(page).selectOption(value);
  await frames(page);
}

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
    await expect(dlg.locator('p[aria-live]')).toHaveText('Adds 6 sections and sets Settings > Wing tip to Round: the tip closes in a point. Point at y = 744.0 mm, 144.0 mm beyond the tip section.');
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
    await expect(toastOf(page)).toContainText('Rounded tip added: 6 sections, wing tip set to Round. Undo removes it.');
    await expect(rows(page)).toHaveCount(8);
    const saved = await savedProject(page);
    expect(saved.settings.tip.mode).toBe('round');
    const tip = saved.sections.slice().sort((a, b) => a.y - b.y).at(-1);
    expect([tip.y, tip.chord]).toEqual([743.95, 1]);
    // Tangent, fullness 2.5: the first rounded-tip section at y = 637.26 mm has 136.14 mm chord.
    expect(saved.sections.find((q) => q.y === 637.26).chord).toBe(136.14);
    // The added sections carry the rounded-tip marker that the loft blends along the tip ellipse.
    expect(saved.sections.filter((q) => q.y > 600).map((q) => q.roundTip)).toEqual(Array(6).fill('tangent'));
    await expect(status(page)).not.toHaveText(SPORT);
    await expect(status(page)).not.toHaveClass(/has-error/);
    // The stored 1 mm chord of the last section is not built: the tip closes in a point.
    await expect(chordNote(page, -1)).toHaveText('tip: 0 (round)');
    await expect(chordNote(page, 0)).toHaveCount(0);
    await openTab(page, 'Settings');
    await expect(tipMode(page)).toHaveValue('round');
    await expect(tipMode(page).locator('option:checked')).toHaveText('Round (closes in a point, needs a rounded tip)');

    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(tipMode(page)).toHaveValue('flat');
    await openTab(page, 'Sections');
    await expect(rows(page)).toHaveCount(2);
    await expect(status(page)).toHaveText(SPORT);
    await expect(page.locator('table.sections').getByText(/^tip:/)).toHaveCount(0);
    expect((await savedProject(page)).settings.tip.mode).toBe('flat');
  });

  test('continues the ellipse of the Glider, whose guide curves end at the old tip section', async ({ page }) => {
    // Glider: elliptic planform by guide curves, half span 1000 mm, taper 0.45. The ellipse closes at
    // 1000 / sqrt(1 − 0.45²) = 1119.8 mm: the span grows to about 2240 mm.
    await createDesign(page, 'Glider');
    const dlg = await openRoundTip(page);
    const ellipse = dlg.getByLabel('Continue the ellipse of the wing');
    await expect(ellipse).toBeChecked();
    const length = dlg.getByLabel('Length beyond the tip section (mm)');
    await expect(length).toBeDisabled();
    await expect(length).toHaveValue(/^1[12]\d(\.\d+)?$/);
    await expect(dlg.getByLabel('Tangent to the last panel')).toBeDisabled();
    await dlg.getByRole('button', { name: 'Add rounded tip', exact: true }).click();
    await expect(dialogOf(page)).toHaveCount(0);
    await expect(status(page)).toHaveText(/^Span 22[34]\d mm · /);
    const saved = await savedProject(page);
    expect(saved.guides.end.points.at(-1)[1]).toBe(1000);
    expect(saved.settings.tip.mode).toBe('round');
    await expect(chordNote(page, -1)).toHaveText('tip: 0 (round)');
    // Unticked, Length and Tangent apply again.
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    const again = await openRoundTip(page);
    await again.getByLabel('Continue the ellipse of the wing').uncheck();
    await expect(again.getByLabel('Length beyond the tip section (mm)')).toBeEnabled();
    // The field shows the manual length again (one tip chord, 90 mm), the length the tip is built with.
    await expect(again.getByLabel('Length beyond the tip section (mm)')).toHaveValue('90');
    await expect(again.locator('p[aria-live]')).toHaveText(/ 89\.\d mm beyond the tip section/);
    await expect(again.getByLabel('Tangent to the last panel')).toBeEnabled();
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
  test('Settings > Wing tip Round without a rounded tip is a build error; Undo or Flat clears it', async ({ page }) => {
    await createDesign(page, 'Sport');
    await openTab(page, 'Settings');
    await expect(tipMode(page).locator('option')).toHaveText(['Flat (cut at the tip section)', 'Pointed (tip profile scaled down)', 'Round (closes in a point, needs a rounded tip)']);
    await chooseTip(page, 'round');
    await expect(status(page)).toHaveText(`1 error(s): ${ROUND_ERROR}`);
    await expect(status(page)).toHaveClass(/has-error/);
    await openTab(page, 'Checks');
    await expect(page.locator('#pane-checks .sev-error')).toHaveText(`Error: ${ROUND_ERROR}`);

    // Undo returns to Flat and the Sport figures.
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(status(page)).toHaveText(SPORT);
    await expect(page.locator('#pane-checks .sev-error')).toHaveCount(0);

    // Round again, then Flat in the list: the error goes as well.
    await openTab(page, 'Settings');
    await chooseTip(page, 'round');
    await expect(status(page)).toHaveClass(/has-error/);
    await chooseTip(page, 'flat');
    await expect(status(page)).toHaveText(SPORT);
    await expect(status(page)).not.toHaveClass(/has-error/);
    expect((await savedProject(page)).settings.tip.mode).toBe('flat');
  });

  test('a wing with a rounded tip exports as a closed STL shell that ends in one point', async ({ page }) => {
    await createDesign(page, 'Sport');
    const dlg = await openRoundTip(page);
    await dlg.getByRole('button', { name: 'Add rounded tip', exact: true }).click();
    await expect(dialogOf(page)).toHaveCount(0);
    await expect(status(page)).not.toHaveClass(/has-error/);

    const stl = parseStl((await exportFile(page, 'stl', { half: 'right' })).bytes);
    // Every edge used twice in opposite directions, Euler characteristic 2, no triangle with two
    // equal vertices: the quads next to the point are triangles.
    expectClosed(stlShell(stl.tris), 'rounded-tip right half');
    // The point: one vertex at the largest y, the default tip point y = 743.95 mm.
    const verts = stlVertices(stl.tris);
    const yMax = Math.max(...verts.map((p) => p[1]));
    expect(Math.abs(yMax - 743.95), `tip point at y = ${yMax}`).toBeLessThan(0.01);
    expect(verts.filter((p) => p[1] > yMax - 1e-6)).toHaveLength(1);
    // No triangle of zero area among those that touch the outer 1 % of the half span.
    const area = ([a, b, c]) => {
      const u = [0, 1, 2].map((k) => b.p[k] - a.p[k]);
      const v = [0, 1, 2].map((k) => c.p[k] - a.p[k]);
      return Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]) / 2;
    };
    const atTip = stl.tris.filter((t) => t.some((v) => v.p[1] > yMax - 7.5));
    expect(atTip.length).toBeGreaterThan(20);
    expect(Math.min(...atTip.map(area)), 'smallest triangle area at the tip (mm²)').toBeGreaterThan(0);
  });
});
