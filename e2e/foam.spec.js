// Foam-cutting wizard: the top-bar button opens it for the current wing; the longest core proposes the
// cuts, cuts are edited, added and removed, segments over the deviation limit are split, the settings
// survive a reload, and the four downloads (profile ZIP, SVG, PDF, DXF) are read back from disk. A wing
// with errors offers no download. German texts of the dialog and of a file.
import { strFromU8, unzipSync } from 'fflate';
import { commit, createDesign, dialogOf, downloadOf, expect, frames, openTab, savedProject, statusOf, test } from './helpers.js';

const openFoam = async (page, label = 'Foam') => {
  await page.locator('header.topbar').getByRole('button', { name: label, exact: true }).click();
  const dlg = dialogOf(page);
  await expect(dlg.locator('table.foam-segments tbody tr').first()).toBeVisible();
  return dlg;
};
const summaryOf = (dlg) => dlg.locator('p[aria-live="polite"]');
const rowsOf = (dlg) => dlg.locator('table.foam-segments tbody tr');
const cutFields = (dlg) => dlg.getByRole('spinbutton', { name: /^Cut \d+, y in mm$/ });

test.describe('foam-cutting wizard', () => {
  test('proposes, edits and splits the cuts of the Sport wing', async ({ page }) => {
    await createDesign(page, 'Sport');
    await frames(page);
    const before = await savedProject(page);
    const dlg = await openFoam(page);
    await expect(dlg.getByRole('heading', { name: 'Foam cutting' })).toBeVisible();
    // 600 mm half span, longest core 800 mm: one core. Linear blending between mitred planes of different roll
    // puts stations between the sections (chord and airfoil change together, and the twist): 0.341 mm.
    await expect(rowsOf(dlg)).toHaveCount(1);
    await expect(cutFields(dlg)).toHaveCount(0);
    await expect(summaryOf(dlg)).toHaveText(/^1 segment per half, deviation 0\.341 mm\. 1 segment deviates more than 0\.20 mm from the wing; Split segments over the limit adds cuts\. The PDF templates take \d+ pages?\.$/);
    await expect(summaryOf(dlg)).toHaveClass(/sev-warning/);
    await expect(rowsOf(dlg).first().locator('td')).toHaveText(['1', '0.0 – 600.0', /^60\d\.\d$/, /^\d+ × \d+$/, '240.0 / 144.0', '0.341', /^1\.5°, \d\.\d mm, upper$/, '–']);

    // Splitting halves the core: each half deviates about a quarter as much.
    await dlg.getByRole('button', { name: 'Split segments over the limit' }).click();
    await expect(rowsOf(dlg)).toHaveCount(2);
    await expect(cutFields(dlg)).toHaveCount(1);
    await expect(cutFields(dlg).first()).toHaveValue('300');
    await expect(summaryOf(dlg)).toHaveText(/^2 segments per half, largest deviation 0\.0\d\d mm\. The PDF templates take \d+ pages?\.$/);
    await expect(summaryOf(dlg)).not.toHaveClass(/sev-warning/);

    // A longest core of 250 mm proposes 3 equal cores; Enter commits the field and keeps the dialog open.
    const longest = dlg.getByRole('spinbutton', { name: 'Longest core (mm)' });
    await commit(longest, 250);
    await expect(dialogOf(page)).toHaveCount(1);
    await expect(cutFields(dlg)).toHaveCount(2);
    await expect(cutFields(dlg).nth(0)).toHaveValue('200');
    await expect(cutFields(dlg).nth(1)).toHaveValue('400');

    // Edit a cut, remove one, add one in the middle of the longest segment.
    await commit(cutFields(dlg).nth(0), 150);
    await expect(rowsOf(dlg).first().locator('td').nth(1)).toHaveText('0.0 – 150.0');
    await dlg.getByRole('button', { name: 'Remove the cut at y = 400.0 mm' }).click();
    await expect(cutFields(dlg)).toHaveCount(1);
    await expect(rowsOf(dlg).nth(1).locator('td').nth(1)).toHaveText('150.0 – 600.0');
    await expect(summaryOf(dlg)).toContainText('1 core is longer than 250 mm.');
    await dlg.getByRole('button', { name: 'Add cut' }).click();
    await expect(cutFields(dlg)).toHaveCount(2);
    await expect(cutFields(dlg).nth(1)).toHaveValue('375');
    // A cut closer than 5 mm to another one is dropped with a note.
    await commit(cutFields(dlg).nth(1), 152);
    await expect(cutFields(dlg)).toHaveCount(1);
    await expect(summaryOf(dlg)).toContainText('1 cut was removed: closer than 5 mm to another cut, the root or the tip.');
    await dlg.getByRole('button', { name: 'Propose cuts again' }).click();
    await expect(cutFields(dlg)).toHaveCount(2);

    // The dialog does not change the project.
    await dlg.getByRole('button', { name: 'Close' }).click();
    await expect(dialogOf(page)).toHaveCount(0);
    await frames(page);
    expect(await savedProject(page)).toEqual(before);
  });

  test('keeps its settings in browser storage', async ({ page }) => {
    await createDesign(page, 'Sport');
    let dlg = await openFoam(page);
    await commit(dlg.getByRole('spinbutton', { name: 'Longest core (mm)' }), 400);
    await commit(dlg.getByRole('spinbutton', { name: 'Deviation limit (mm)' }), 0.5);
    await commit(dlg.getByRole('spinbutton', { name: 'Kerf for templates (mm)' }), 1.2);
    await dlg.getByRole('combobox', { name: 'Paper (PDF)' }).selectOption('a3');
    // A value outside its range is refused: the field shows the stored value again.
    await commit(dlg.getByRole('spinbutton', { name: 'Kerf for templates (mm)' }), 9);
    await expect(dlg.getByRole('spinbutton', { name: 'Kerf for templates (mm)' })).toHaveValue('1.2');
    await dlg.getByRole('button', { name: 'Close' }).click();
    await page.reload();
    await expect(statusOf(page)).toHaveText(/^Span 1200 mm/);
    dlg = await openFoam(page);
    await expect(dlg.getByRole('spinbutton', { name: 'Longest core (mm)' })).toHaveValue('400');
    await expect(dlg.getByRole('spinbutton', { name: 'Deviation limit (mm)' })).toHaveValue('0.5');
    await expect(dlg.getByRole('spinbutton', { name: 'Kerf for templates (mm)' })).toHaveValue('1.2');
    await expect(dlg.getByRole('combobox', { name: 'Paper (PDF)' })).toHaveValue('a3');
    await expect(rowsOf(dlg)).toHaveCount(2);
    await expect(summaryOf(dlg)).not.toHaveClass(/sev-warning/);
  });

  test('downloads the profile ZIP and the SVG, PDF and DXF templates', async ({ page }) => {
    await createDesign(page, 'Sport');
    const dlg = await openFoam(page);
    // The half span is 600.2 mm long along the 1.5° dihedral: cores of 301 mm need 2.
    await commit(dlg.getByRole('spinbutton', { name: 'Longest core (mm)' }), 301);
    await expect(rowsOf(dlg)).toHaveCount(2);
    const pages = Number((await summaryOf(dlg).innerText()).match(/The PDF templates take (\d+) pages?\./)[1]);

    const zip = await downloadOf(page, () => dlg.getByRole('button', { name: 'Profiles (.dat, ZIP)' }).click());
    expect(zip.name).toBe('Sport_foam_profiles.zip');
    const files = unzipSync(new Uint8Array(zip.bytes));
    expect(Object.keys(files).sort()).toEqual(
      ['README.txt', 'segments.csv', 'mm/segment-01-inboard.dat', 'mm/segment-01-outboard.dat', 'mm/segment-02-inboard.dat', 'mm/segment-02-outboard.dat', 'normalized/segment-01-inboard.dat', 'normalized/segment-01-outboard.dat', 'normalized/segment-02-inboard.dat', 'normalized/segment-02-outboard.dat'].sort(),
    );
    const dat = (f) => strFromU8(files[f]).trim().split('\n');
    const inboard = dat('mm/segment-01-inboard.dat');
    const outboard = dat('mm/segment-01-outboard.dat');
    expect(inboard[0]).toBe('Sport segment 1 inboard y=0.0 mm');
    expect(outboard[0]).toBe('Sport segment 1 outboard y=300.0 mm');
    expect(inboard.length).toBe(outboard.length);
    const csv = strFromU8(files['segments.csv']).trim().split('\n');
    expect(csv).toHaveLength(3);
    expect(csv[1]).toMatch(/^1,0\.000,300\.000,/);

    const svg = await downloadOf(page, () => dlg.getByRole('button', { name: 'Templates (SVG)' }).click());
    expect(svg.name).toBe('Sport_foam_templates.svg');
    const svgText = svg.bytes.toString('utf8');
    expect(svgText).toMatch(/<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="\d+mm" height="\d+mm"/);
    expect(svgText.match(/<polygon class="profile"/g)).toHaveLength(4);
    // The SVG parses in the browser.
    expect(await page.evaluate((t) => new DOMParser().parseFromString(t, 'image/svg+xml').querySelectorAll('parsererror').length, svgText)).toBe(0);

    const pdf = await downloadOf(page, () => dlg.getByRole('button', { name: 'Templates (PDF)' }).click());
    expect(pdf.name).toBe('Sport_foam_templates.pdf');
    const pdfText = pdf.bytes.toString('latin1');
    expect(pdfText.startsWith('%PDF-1.4')).toBe(true);
    expect(pdfText.match(/\/Type \/Page /g)).toHaveLength(pages);

    const dxf = await downloadOf(page, () => dlg.getByRole('button', { name: 'Templates (DXF)' }).click());
    expect(dxf.name).toBe('Sport_foam_templates.dxf');
    const dxfText = dxf.bytes.toString('utf8');
    expect(dxfText).toContain('$ACADVER\r\n1\r\nAC1009');
    expect(dxfText.match(/\r\nPOLYLINE\r\n8\r\nPROFILE\r\n/g)).toHaveLength(4);
    expect(dxfText.trimEnd().endsWith('EOF')).toBe(true);
  });

  test('offers no download for a wing with errors', async ({ page }) => {
    await createDesign(page, 'Sport');
    await openTab(page, 'Planform');
    const group = (name) => page.locator('#pane-planform').getByRole('group', { name });
    const end = group('End line (trailing edge)');
    await group('Nose line (leading edge)').getByRole('checkbox', { name: 'Use guide curve' }).check();
    await end.getByRole('checkbox', { name: 'Use guide curve' }).check();
    await commit(end.locator('tbody tr').nth(1).getByRole('spinbutton'), 0);
    await expect(statusOf(page)).toHaveClass(/has-error/);
    await page.locator('header.topbar').getByRole('button', { name: 'Foam', exact: true }).click();
    const dlg = dialogOf(page);
    await expect(dlg.locator('.sev-error')).toHaveText('The wing has errors; fix them before planning foam cores.');
    await expect(dlg.getByRole('button', { name: /^Templates|^Profiles/ })).toHaveCount(0);
    await dlg.getByRole('button', { name: 'Close' }).click();
    await expect(dialogOf(page)).toHaveCount(0);
  });

  test('speaks German and writes German template texts', async ({ page }) => {
    await createDesign(page, 'Sport');
    await openTab(page, 'Settings');
    await page.getByRole('combobox', { name: 'Language / Sprache', exact: true }).selectOption('de');
    await frames(page);
    const dlg = await openFoam(page, 'Schaum');
    await expect(dlg.getByRole('heading', { name: 'Schaumschnitt' })).toBeVisible();
    await expect(summaryOf(dlg)).toHaveText(/^1 Segment je Hälfte, Abweichung 0,341 mm\. 1 Segment weicht mehr als 0,20 mm vom Flügel ab;/);
    await expect(rowsOf(dlg).first().locator('td').nth(6)).toHaveText(/^1,5°, \d,\d mm, oben$/);
    const zip = await downloadOf(page, () => dlg.getByRole('button', { name: 'Profile (.dat, ZIP)' }).click());
    expect(strFromU8(unzipSync(new Uint8Array(zip.bytes))['README.txt'])).toMatch(/^Schaumkerne von Sport: 1 Segment je Flügelhälfte\./);
    const svg = await downloadOf(page, () => dlg.getByRole('button', { name: 'Schablonen (SVG)' }).click());
    expect(svg.bytes.toString('utf8')).toContain('Segment 1 von 1, inneres Ende');
  });
});
