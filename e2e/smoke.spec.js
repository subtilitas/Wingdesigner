import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

const SHOTS = process.env.SHOT_DIR;

test('first run wizard, editing, upload and exports work without errors', async ({ page }, info) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('/');
  const wizard = page.locator('dialog[open]');
  await expect(wizard.getByRole('heading', { name: 'Start a new wing design' })).toBeVisible();
  await wizard.getByRole('radio', { name: /Swept flying wing/ }).click();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${info.project.name}-wizard.png` });
  await wizard.getByRole('button', { name: 'Create design' }).click();
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await expect(page.locator('.viewport canvas')).toBeVisible();
  await expect(page.locator('.statusbar')).toContainText('Span 1200 mm');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${info.project.name}-main.png` });

  // Sections: change the tip chord.
  const rows = page.locator('table.sections tbody tr');
  await expect(rows).toHaveCount(3);
  const tipChord = rows.nth(2).locator('td').nth(4).locator('input');
  await tipChord.fill('100');
  await tipChord.press('Enter');
  await expect(page.locator('.statusbar')).toContainText('Span 1200 mm');

  // Planform: enable the end line guide.
  await page.getByRole('tab', { name: 'Planform' }).click();
  await page.getByRole('group', { name: /End line/ }).getByLabel('Use guide curve').check();
  await expect(page.getByRole('group', { name: /End line/ }).getByRole('button', { name: 'Add point' })).toBeVisible();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${info.project.name}-planform.png` });

  // Airfoils: upload a file with preview and sanity check.
  await page.getByRole('tab', { name: 'Airfoils' }).click();
  const dat = 'TEST 12\n1 0.001\n0.75 0.05\n0.5 0.07\n0.25 0.07\n0.1 0.045\n0.02 0.02\n0 0\n0.02 -0.015\n0.1 -0.03\n0.25 -0.04\n0.5 -0.035\n0.75 -0.02\n1 -0.001\n';
  await page.locator('.dropzone input[type=file]').setInputFiles({ name: 'test12.dat', mimeType: 'text/plain', buffer: Buffer.from(dat) });
  const preview = page.locator('dialog[open]');
  await expect(preview.getByRole('heading', { name: 'Upload: test12.dat' })).toBeVisible();
  await expect(preview).toContainText('Warning: Only 13 points');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${info.project.name}-upload.png` });
  await preview.getByRole('button', { name: 'Add to project' }).click();
  await expect(page.locator('.airfoil-list').first()).toContainText('TEST 12');

  // Checks tab lists statistics.
  await page.getByRole('tab', { name: 'Checks' }).click();
  await expect(page.locator('#pane-checks')).toContainText('Aspect ratio');

  // Exports.
  for (const [fmt, ext, magic] of [
    ['STEP', 'step', 'ISO-10303-21;'],
    ['STL', 'stl', null],
    ['3MF', '3mf', 'PK'],
    ['Project JSON', 'json', '{'],
  ]) {
    await page.getByRole('button', { name: 'Export' }).click();
    const dlg = page.locator('dialog[open]');
    await dlg.getByLabel(new RegExp(`^${fmt}`)).check();
    const [download] = await Promise.all([page.waitForEvent('download'), dlg.getByRole('button', { name: 'Download' }).click()]);
    expect(download.suggestedFilename()).toMatch(new RegExp(`\\.${ext}$`));
    const path = await download.path();
    const head = readFileSync(path).subarray(0, 16).toString('latin1');
    if (magic) expect(head.startsWith(magic)).toBe(true);
  }

  // Undo returns to the previous state; reload restores the autosaved project.
  await page.getByRole('button', { name: 'Undo' }).click();
  await page.reload();
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await expect(page.locator('table.sections tbody tr')).toHaveCount(3);
  expect(errors).toEqual([]);
});
