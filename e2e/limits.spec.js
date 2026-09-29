// Project size: the warning with time and memory above the thresholds, the airfoil lists of large
// section tables, and the size note of the export dialog with its hard limit.
import { STORAGE_KEY, airfoilSelect, createDesign, dialogOf, expect, openExport, openTab, savedProject, statusOf, test, toastOf } from './helpers.js';

const COST = /Each change takes (under 1 s|about [\d.]+ s) and about [\d.]+ [MG]B of browser memory\.$/;

/** Replaces the saved project and reloads the page. */
async function loadProject(page, project) {
  await page.evaluate(([key, p]) => localStorage.setItem(key, JSON.stringify(p)), [STORAGE_KEY, project]);
  await page.reload();
  await expect(statusOf(page)).toHaveText(/^Span \d+ mm · area/, { timeout: 30000 });
}

/** The saved design with n sections 3 mm apart (straight panels); guides follow the sections. */
async function wideProject(page, n, settings = {}) {
  await createDesign(page, 'Sport');
  const p = await savedProject(page);
  const s0 = p.sections[0];
  p.sections = Array.from({ length: n }, (_, i) => ({ ...s0, id: `s${i}`, y: 3 * i, chord: 250 - i * (100 / n) }));
  delete p.guides;
  p.settings = { ...p.settings, spanwise: 'linear', ...settings };
  return p;
}

test.describe('project size', () => {
  test('above 200 sections a warning names the time and memory; the insert button names them first', async ({ page }) => {
    await loadProject(page, await wideProject(page, 200));
    await expect(statusOf(page)).not.toHaveText(/warning/);
    await openTab(page, 'Sections');
    const insert = page.getByRole('button', { name: 'Insert section after 200', exact: true });
    await expect(insert).toHaveAttribute('title', /^Insert a section after this one\. With 201 sections, each change takes (under 1 s|about [\d.]+ s) and about \d+ MB of browser memory\.$/);
    await insert.click();
    await expect(toastOf(page)).toHaveText(new RegExp(`^Large project: 201 sections \\(warning above 200\\)\\. ${COST.source}`));
    await expect(statusOf(page)).toHaveText(/ · 1 warning\(s\)$/);
    await openTab(page, 'Checks');
    await expect(page.locator('.issues li.sev-warning')).toHaveText(new RegExp(`^Warning: Large project: 201 sections \\(warning above 200\\)\\. ${COST.source}`));
    // The warning lasts while the project stays above the threshold.
    expect((await savedProject(page)).sections).toHaveLength(201);
  });

  test('large section tables fill an airfoil list when it is used', async ({ page }) => {
    const p = await wideProject(page, 101);
    const a0 = p.airfoils[0];
    p.airfoils = Array.from({ length: 200 }, (_, i) => ({ ...a0, id: `a${i}`, name: `Foil ${i}`, points: a0.points.map(([x, y]) => [x, y * (1 + i / 1000)]) }));
    for (const s of p.sections) s.airfoil = 'a0';
    await loadProject(page, p);
    await openTab(page, 'Sections');
    // 101 sections x 200 airfoils is above 20,000 list entries: each list holds its airfoil only.
    const list = airfoilSelect(page, 3);
    await expect(list.locator('option')).toHaveCount(1);
    await expect(list).toHaveValue('a0');
    await list.focus();
    await expect(list.locator('option')).toHaveCount(200);
    await expect(list).toHaveValue('a0');
    await list.selectOption({ label: 'Foil 7' });
    await expect.poll(async () => (await savedProject(page)).sections[3].airfoil).toBe('a7');
    await expect(airfoilSelect(page, 3)).toHaveValue('a7');
    await expect(airfoilSelect(page, 4).locator('option')).toHaveCount(1);
  });

  test('the export dialog names triangles or control points, file size, time and memory, and stops at the hard limit', async ({ page }) => {
    test.slow();
    // 4 sections, 40 stations per panel, 200 chord samples: Fine has about 2.3 million triangles.
    await loadProject(page, await wideProject(page, 4, { spanwise: 'smooth', panelStations: 40, chordSamples: 200 }));
    let dlg = await openExport(page);
    const note = dlg.locator('p[aria-live="polite"]');
    // STEP (preselected): 121 stations x 401 control points per half, both halves.
    await expect(note).toHaveText(/^97,042 control points, file about 9\.5 MB\.$/);
    await expect(note).toHaveClass(/muted/);
    await dlg.getByLabel(/^Project JSON/).check();
    await expect(note).toBeHidden();
    await dlg.getByLabel(/^STL/).check();
    await expect(note).toHaveText(/^0\.6 million triangles, file about 29 MB\.$/);
    await expect(note).toHaveClass(/muted/);
    await dlg.getByLabel(/^Fine/).check();
    await expect(note).toHaveText(/^2\.3 million triangles, file about 120 MB\. The export takes (under 1 s|about [\d.]+ s) and about \d+ MB of browser memory\.$/);
    await expect(note).toHaveClass(/sev-warning/);
    await dlg.getByLabel(/^Right half only/).check();
    await expect(note).toHaveText(/^1\.2 million triangles, file about 58 MB\.$/);
    await expect(dlg.getByRole('button', { name: 'Download' })).toBeEnabled();
    await dlg.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialogOf(page)).toHaveCount(0);

    // 16 sections: Fine for both halves is above 10 million triangles.
    await loadProject(page, await wideProjectFrom(page, 16));
    dlg = await openExport(page);
    await dlg.getByLabel(/^3MF/).check();
    await dlg.getByLabel(/^Fine/).check();
    const note2 = dlg.locator('p[aria-live="polite"]');
    await expect(note2).toHaveText(/^11\.\d million triangles, file about \d+ MB: above the limit of 10 million triangles, where a desktop browser tab runs out of memory\. Use Normal density, one half, or fewer chord samples or panel stations\.$/);
    await expect(note2).toHaveClass(/sev-error/);
    await expect(dlg.getByRole('button', { name: 'Download' })).toBeDisabled();
    await dlg.getByLabel(/^Right half only/).check();
    await expect(note2).toHaveClass(/sev-warning/);
    await expect(dlg.getByRole('button', { name: 'Download' })).toBeEnabled();
  });
});

/** The current saved project with n sections 3 mm apart, smooth, 40 stations per panel, 200 chord samples. */
async function wideProjectFrom(page, n) {
  const p = await savedProject(page);
  const s0 = p.sections[0];
  p.sections = Array.from({ length: n }, (_, i) => ({ ...s0, id: `s${i}`, y: 3 * i, chord: 250 - i }));
  delete p.guides;
  return p;
}
