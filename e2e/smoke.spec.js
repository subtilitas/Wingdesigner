import {
  checksValue,
  chordCell,
  createFromWizard,
  dialogOf,
  exportFile,
  expect,
  openFirstRun,
  openTab,
  pickPreset,
  savedProject,
  sectionRows,
  sectionValues,
  statusOf,
  test,
} from './helpers.js';

const SHOTS = process.env.SHOT_DIR;

test('first run wizard, editing, upload and exports work without errors', async ({ page }, info) => {
  const wizard = await openFirstRun(page);
  await pickPreset(wizard, 'Swept flying wing');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${info.project.name}-wizard.png` });
  await createFromWizard(page);
  await expect(page.locator('.viewport canvas')).toBeVisible();
  // Chords 280 / 203 / 126 mm at y = 0 / 300 / 600 mm.
  await expect(statusOf(page)).toHaveText('Span 1200 mm · area 24.36 dm² · AR 5.91 · MAC 212.7 mm');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${info.project.name}-main.png` });

  // Sections: change the tip chord; the outer panel shrinks.
  await expect(sectionRows(page)).toHaveCount(3);
  const tipChord = chordCell(page, 2).locator('input');
  await tipChord.fill('100');
  await tipChord.press('Enter');
  const edited = 'Span 1200 mm · area 23.58 dm² · AR 6.11 · MAC 210.3 mm';
  await expect(statusOf(page)).toHaveText(edited);

  // Planform: enable the end line guide; its points start at the section trailing edges.
  await openTab(page, 'Planform');
  const endLine = page.getByRole('group', { name: /End line/ });
  await endLine.getByLabel('Use guide curve').check();
  await expect(endLine.locator('tbody tr')).toHaveCount(3);
  const points = await endLine.locator('tbody tr').evaluateAll((trs) =>
    trs.map((tr) => [...tr.querySelectorAll('td')].slice(1, 3).map((td) => Number(td.querySelector('input')?.value ?? td.textContent))),
  );
  const sections = await sectionValues(page, ['y', 'x', 'chord']);
  expect(points).toHaveLength(3);
  points.forEach(([x, y], i) => {
    expect(Math.abs(x - (sections[i].x + sections[i].chord)), `end point ${i + 1} x`).toBeLessThanOrEqual(1e-3);
    expect(y).toBe(sections[i].y);
  });
  // An end line through the section trailing edges keeps the planform figures.
  await expect(statusOf(page)).toHaveText(edited);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${info.project.name}-planform.png` });

  // Airfoils: upload a file with preview and sanity check.
  await openTab(page, 'Airfoils');
  const dat = 'TEST 12\n1 0.001\n0.75 0.05\n0.5 0.07\n0.25 0.07\n0.1 0.045\n0.02 0.02\n0 0\n0.02 -0.015\n0.1 -0.03\n0.25 -0.04\n0.5 -0.035\n0.75 -0.02\n1 -0.001\n';
  await page.locator('.dropzone input[type=file]').setInputFiles({ name: 'test12.dat', mimeType: 'text/plain', buffer: Buffer.from(dat) });
  const preview = dialogOf(page);
  await expect(preview.getByRole('heading', { name: 'Upload: test12.dat' })).toBeVisible();
  await expect(preview).toContainText('Warning: Only 13 points');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${info.project.name}-upload.png` });
  await preview.getByRole('button', { name: 'Add to project' }).click();
  const projectList = page.locator('.airfoil-list').first();
  await expect(projectList.locator('li')).toHaveCount(3);
  await expect(projectList.locator('li').last()).toContainText('TEST 12');

  // Checks tab lists the statistics of the edited wing.
  await openTab(page, 'Checks');
  await expect(checksValue(page, 'Aspect ratio')).toHaveText('6.11');
  await expect(checksValue(page, 'Root / tip chord')).toHaveText('280.0 / 100.0 mm');

  // Exports.
  for (const [fmt, ext, magic] of [
    ['step', 'step', 'ISO-10303-21;'],
    ['stl', 'stl', null],
    ['3mf', '3mf', 'PK'],
    ['json', 'json', '{'],
  ]) {
    const file = await exportFile(page, fmt);
    expect(file.name).toBe(`Swept_flying_wing.${ext}`);
    if (magic) expect(file.bytes.subarray(0, 16).toString('latin1').startsWith(magic)).toBe(true);
    // Binary STL: 80-byte header, triangle count, 50 bytes per triangle.
    if (fmt === 'stl') expect(file.bytes.length).toBe(84 + 50 * file.bytes.readUInt32LE(80));
  }

  // Undo removes the uploaded airfoil; reload restores the autosaved project with the edited chord.
  await page.getByRole('button', { name: 'Undo' }).click();
  await openTab(page, 'Airfoils');
  await expect(projectList.locator('li')).toHaveCount(2);
  await expect.poll(async () => (await savedProject(page)).airfoils.map((a) => a.name)).not.toContain('TEST 12');
  await page.reload();
  await expect(dialogOf(page)).toHaveCount(0);
  await expect(sectionRows(page)).toHaveCount(3);
  await expect(statusOf(page)).toHaveText(edited);
  await expect(projectList.locator('li')).toHaveCount(2);
  await expect(projectList).not.toContainText('TEST 12');
  await openTab(page, 'Sections');
  await expect(chordCell(page, 2).locator('input')).toHaveValue('100');
});
