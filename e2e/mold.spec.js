// Mold dialog (Export > Mold halves…): the button and the dialog, the defaults of every field (there is no
// ramp field), the summary, the fields that a switched-off group or a hole pattern does not use, the range
// and margin checks, the warning for holes left out, the values kept in browser storage, the STEP download
// (halves, names, parting faces as B-spline surfaces, Y up after the Fusion 360 fix), the parting range of a
// twisted wing, the German texts and the dialog on the phone.
//
// Sport (src/model/wizard.js): 2 sections, root chord 240 mm at x = 0, tip chord 144 mm, half span
// 600 mm, dihedral 1.5°, flat mitred tip (its lower surface reaches y = 600.2 mm). With the defaults of
// src/geom/mold.js (margin 40 mm, floor 12 mm, channel 4 mm at 6 mm, pins at the 4 block corners 12 mm
// from the edges, screws along the block edges at most 120 mm apart):
//   block length = chord extent + 2 · margin = 240 + 2 · 40 = 320.0 mm
//   block width  = largest y of the outline + margin − y of the root line = 600.2 + 40 − 0.0 = 640.2 mm
//   roll         = roll of the flat tip section = the 1.5° dihedral: 1.50°
//   lower, upper = floor + the deepest of cavity and lowest parting surface + groove radius: 18.0 mm
//                  below and 27.3 mm above z = 0 (measured)
//   parting range = lowest and highest height of the parting surface about z = 0: −1.0 to 1.5 mm (measured)
//   channel      = 1374 mm (measured: around the half wing and its mirror image at the root)
//   holes        = the hole rectangle runs 12 mm inside the block: front and back edge 615.5 mm,
//                  ceil(615.5 / 120) = 6 gaps each, tip side 296 mm, 3 gaps: 7 + 3 + 6 = 16 positions;
//                  the 4 corners hold pins, so 4 pin holes and 12 screw holes.
// Margin 10 mm is too small for the channel: distance 6 + diameter 4 + 1 mm to the block edge = 11 mm.
// Pins 30 mm from the block edge: the two root corners lie 10 mm from leading and trailing edge, inside
// the 14 mm keep-out (channel distance 6 + diameter 4 + 1 mm + pin radius 3), so 2 pin holes are
// left out and the screws take the 4 corner positions: 2 pin holes, 16 screw holes.
// Block corner of the lower half at the tip side and the trailing edge, Z up: (280, 640.2, −18.0) mm;
// with Y up the same corner is (x, z, −y) = (280, −18.0, −640.2) mm.
import {
  FUSION_FIX,
  commit,
  createDesign,
  dialogOf,
  downloadOf,
  expect,
  exportFile,
  frames,
  openExport,
  openTab,
  sectionField,
  statusOf,
  test,
} from './helpers.js';

const MOLD_KEY = 'wingdesigner.mold';
const BLOCK_SENTENCE = 'Block 320.0 × 640.2 mm; lower half down to −18.0 mm, upper half up to +27.3 mm.';
const PARTING_SENTENCE =
  'Parting surface at the height of leading edge and trailing edge, level in flight direction: from -1.0 to 1.5 mm; frame rolled 1.50° with the wing.';
const SPORT_SUMMARY = `${BLOCK_SENTENCE} ${PARTING_SENTENCE} Resin channel 1374 mm long. 4 pin holes, 12 screw holes.`;
const MARGIN_ERROR = 'Mold: the block margin must be at least 11 mm for the resin channel (distance, diameter and 1 mm to the block edge).';

const PARTING_PATTERN = /level in flight direction: from (-?[\d.]+) to (-?[\d.]+) mm/;

const summaryOf = (dlg) => dlg.locator('p[aria-live]').nth(0);
const notesOf = (dlg) => dlg.locator('p[aria-live]').nth(1);
const group = (dlg, g) => dlg.locator(`fieldset[data-group="${g}"]`);
const field = (scope, label) => scope.getByLabel(label, { exact: true });
/** A list by the text before its options (the label of a select also holds the chosen option). */
const combo = (scope, label) => scope.getByRole('combobox', { name: new RegExp(`^${label}`) });
const download = (dlg) => dlg.getByRole('button', { name: 'Download STEP', exact: true });

async function openMold(page, { exportName = 'Export', button = 'Mold halves…', heading = 'Mold' } = {}) {
  await page.getByRole('button', { name: exportName, exact: true }).click();
  await dialogOf(page).getByRole('button', { name: button, exact: true }).click();
  const dlg = dialogOf(page);
  await expect(dlg.getByRole('heading', { name: heading, exact: true })).toBeVisible();
  await expect(summaryOf(dlg)).toHaveText(/\S/);
  return dlg;
}

/** Points of a STEP file and the names of its solids. */
function stepOf(bytes) {
  const text = bytes.toString('latin1');
  return {
    text,
    names: [...text.matchAll(/MANIFOLD_SOLID_BREP\('([^']*)'/g)].map((m) => m[1]),
    points: [...text.matchAll(/CARTESIAN_POINT\('',\(([^,]+),([^,]+),([^)]+)\)\)/g)].map((m) => [Number(m[1]), Number(m[2]), Number(m[3])]),
  };
}

const near = (points, q, tol = 0.05) => points.some((p) => p.every((v, k) => Math.abs(v - q[k]) < tol));

test.describe('mold dialog', () => {
  test('opens from the Export dialog with the defaults and the summary of the Sport wing', async ({ page }) => {
    await createDesign(page, 'Sport');
    const exp = await openExport(page);
    await expect(exp.getByRole('group', { name: 'Mold', exact: true })).toContainText('Lower and upper mold half as STEP solids, with resin channel and holes.');
    await expect(exp.getByRole('button', { name: 'Mold halves…', exact: true })).toBeEnabled();
    await exp.getByRole('button', { name: 'Cancel' }).click();

    const dlg = await openMold(page);
    await expect(dialogOf(page)).toHaveCount(1);
    await expect(field(dlg, 'Margin around the wing (mm)')).toHaveValue('40');
    await expect(field(dlg, 'Floor below the cavity (mm)')).toHaveValue('12');
    await expect(dlg.getByLabel('Ramp width', { exact: false })).toHaveCount(0);
    await expect(dlg.getByText('Ramp width')).toHaveCount(0);
    const channel = group(dlg, 'channel');
    await expect(field(channel, 'Resin channel')).toBeChecked();
    await expect(field(channel, 'Diameter (mm)')).toHaveValue('4');
    await expect(field(channel, 'Distance from the wing (mm)')).toHaveValue('6');
    const pins = group(dlg, 'pins');
    await expect(field(pins, 'Alignment pin holes')).toBeChecked();
    await expect(field(pins, 'Diameter (mm)')).toHaveValue('6');
    await expect(field(pins, 'Depth in each half (mm)')).toHaveValue('10');
    await expect(combo(pins, 'Pattern')).toHaveValue('corners');
    await expect(combo(pins, 'Pattern').locator('option')).toHaveText(['Block corners', 'Along the block edges', 'Around the wing']);
    await expect(field(pins, 'Largest spacing (mm)')).toHaveValue('150');
    await expect(field(pins, 'Distance from the block edge (mm)')).toHaveValue('12');
    await expect(field(pins, 'Distance beyond the resin channel (mm)')).toHaveValue('10');
    const screws = group(dlg, 'screws');
    await expect(field(screws, 'Clamping screw holes')).toBeChecked();
    await expect(field(screws, 'Diameter (mm)')).toHaveValue('6.5');
    await expect(combo(screws, 'Pattern')).toHaveValue('frame');
    await expect(field(screws, 'Largest spacing (mm)')).toHaveValue('120');
    await expect(field(screws, 'Distance from the block edge (mm)')).toHaveValue('12');
    await expect(field(screws, 'Distance beyond the resin channel (mm)')).toHaveValue('10');
    await expect(combo(dlg, 'Halves')).toHaveValue('both');
    await expect(combo(dlg, 'Halves').locator('option')).toHaveText(['Lower and upper', 'Lower only', 'Upper only']);
    await expect(field(dlg, 'Molds of the left wing (mirror image)')).not.toBeChecked();

    await expect(summaryOf(dlg)).toHaveText(SPORT_SUMMARY);
    await expect(summaryOf(dlg)).toContainText(/Parting surface at the height of leading edge and trailing edge, level in flight direction/);
    await expect(summaryOf(dlg)).not.toContainText(/ramp/i);
    await expect(summaryOf(dlg)).not.toHaveClass(/sev-error/);
    await expect(notesOf(dlg)).toHaveText('');
    await expect(download(dlg)).toBeEnabled();
    const box = await dlg.getByRole('img', { name: 'Top view of the parting surface of the mold' }).boundingBox();
    expect(box.width).toBeGreaterThan(100);
    expect(box.height).toBeGreaterThan(100);
    await dlg.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(dialogOf(page)).toHaveCount(0);
  });

  test('the Mold halves button is disabled for a wing with errors', async ({ page }) => {
    await createDesign(page, 'Sport');
    await openTab(page, 'Planform');
    const planform = (name) => page.locator('#pane-planform').getByRole('group', { name });
    const end = planform('End line (trailing edge)');
    await planform('Nose line (leading edge)').getByRole('checkbox', { name: 'Use guide curve' }).check();
    await end.getByRole('checkbox', { name: 'Use guide curve' }).check();
    await commit(end.locator('tbody tr').nth(1).getByRole('spinbutton'), 0);
    await expect(statusOf(page)).toHaveClass(/has-error/);
    const exp = await openExport(page);
    await expect(exp.getByRole('button', { name: 'Mold halves…', exact: true })).toBeDisabled();
    await exp.getByRole('button', { name: 'Cancel' }).click();
    // Undo removes the crossing: the button works again.
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(statusOf(page)).not.toHaveClass(/has-error/);
    await expect((await openExport(page)).getByRole('button', { name: 'Mold halves…', exact: true })).toBeEnabled();
  });

  test('switching groups and hole patterns enables the fields they use', async ({ page }) => {
    await createDesign(page, 'Sport');
    const dlg = await openMold(page);
    const channel = group(dlg, 'channel');
    await field(channel, 'Resin channel').uncheck();
    await expect(field(channel, 'Diameter (mm)')).toBeDisabled();
    await expect(field(channel, 'Distance from the wing (mm)')).toBeDisabled();
    await expect(summaryOf(dlg)).toHaveText(`${BLOCK_SENTENCE} ${PARTING_SENTENCE} 4 pin holes, 12 screw holes.`);
    await expect(summaryOf(dlg)).not.toContainText('Resin channel');
    await field(channel, 'Resin channel').check();
    await expect(field(channel, 'Diameter (mm)')).toBeEnabled();
    await expect(summaryOf(dlg)).toHaveText(SPORT_SUMMARY);

    // Largest spacing: not for the corners; Distance from the block edge: corners and edges;
    // Distance beyond the resin channel: around the wing only.
    for (const g of ['pins', 'screws']) {
      const set = group(dlg, g);
      const pattern = combo(set, 'Pattern');
      const state = async () => [
        await field(set, 'Largest spacing (mm)').isEnabled(),
        await field(set, 'Distance from the block edge (mm)').isEnabled(),
        await field(set, 'Distance beyond the resin channel (mm)').isEnabled(),
      ];
      await pattern.selectOption('corners');
      await expect.poll(state).toEqual([false, true, false]);
      await pattern.selectOption('frame');
      await expect.poll(state).toEqual([true, true, false]);
      await pattern.selectOption('outline');
      await expect.poll(state).toEqual([true, false, true]);
      // Switched off: every field of the group, the checkbox stays.
      const on = field(set, g === 'pins' ? 'Alignment pin holes' : 'Clamping screw holes');
      await on.uncheck();
      await expect(set.locator('input:not([type=checkbox]), select').and(set.locator(':enabled'))).toHaveCount(0);
      await expect(on).toBeEnabled();
      await on.check();
      await expect.poll(state).toEqual([true, false, true]);
    }
    await expect(summaryOf(dlg)).toHaveText(/ \d+ pin holes, \d+ screw holes\.$/);
    await expect(field(group(dlg, 'pins'), 'Depth in each half (mm)')).toBeEnabled();
    await field(group(dlg, 'pins'), 'Alignment pin holes').uncheck();
    await expect(field(group(dlg, 'pins'), 'Depth in each half (mm)')).toBeDisabled();
    await expect(summaryOf(dlg)).toHaveText(/ 0 pin holes, \d+ screw holes\.$/);
  });

  test('a value out of range snaps back, a small margin is an error, holes left out are a warning', async ({ page }) => {
    await createDesign(page, 'Sport');
    const dlg = await openMold(page);
    const margin = field(dlg, 'Margin around the wing (mm)');
    // Range 5 to 1000 mm: 2 is refused and the field shows the kept value again; Enter keeps the dialog open.
    await commit(margin, 2);
    await expect(dialogOf(page)).toHaveCount(1);
    await expect(margin).toHaveValue('40');
    await expect(summaryOf(dlg)).toHaveText(SPORT_SUMMARY);
    await commit(field(group(dlg, 'channel'), 'Diameter (mm)'), 25);
    await expect(field(group(dlg, 'channel'), 'Diameter (mm)')).toHaveValue('4');

    // 10 mm is in range but leaves no room for the resin channel.
    await commit(margin, 10);
    await expect(margin).toHaveValue('10');
    await expect(summaryOf(dlg)).toHaveText(MARGIN_ERROR);
    await expect(summaryOf(dlg)).toHaveClass(/sev-error/);
    await expect(download(dlg)).toBeDisabled();
    await commit(margin, 40);
    await expect(summaryOf(dlg)).toHaveText(SPORT_SUMMARY);
    await expect(download(dlg)).toBeEnabled();

    // Pins 30 mm from the block edge: the two root corners come too close to the cavity.
    await commit(field(group(dlg, 'pins'), 'Distance from the block edge (mm)'), 30);
    await expect(notesOf(dlg)).toHaveText('Mold: 2 pin hole(s) left out: too close to the cavity, the resin channel, a block edge or another hole.');
    await expect(notesOf(dlg)).toHaveClass(/sev-warning/);
    await expect(summaryOf(dlg)).toHaveText(/ 2 pin holes, 16 screw holes\.$/);
    await expect(download(dlg)).toBeEnabled();
    await commit(field(group(dlg, 'pins'), 'Distance from the block edge (mm)'), 12);
    await expect(notesOf(dlg)).toHaveText('');
  });

  test('keeps its values in browser storage across closing and a reload', async ({ page }) => {
    await createDesign(page, 'Sport');
    let dlg = await openMold(page);
    await commit(field(dlg, 'Floor below the cavity (mm)'), 15);
    await commit(field(group(dlg, 'channel'), 'Distance from the wing (mm)'), 8);
    await combo(group(dlg, 'pins'), 'Pattern').selectOption('outline');
    await field(group(dlg, 'screws'), 'Clamping screw holes').uncheck();
    await combo(dlg, 'Halves').selectOption('lower');
    await field(dlg, 'Molds of the left wing (mirror image)').check();
    await frames(page);
    const stored = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), MOLD_KEY);
    expect(stored).toMatchObject({ floor: 15, channel: { distance: 8 }, pins: { pattern: 'outline' }, screws: { on: false }, halves: 'lower', left: true });
    const summary = await summaryOf(dlg).innerText();

    const expectKept = async (d) => {
      await expect(field(d, 'Floor below the cavity (mm)')).toHaveValue('15');
      await expect(field(group(d, 'channel'), 'Distance from the wing (mm)')).toHaveValue('8');
      await expect(combo(group(d, 'pins'), 'Pattern')).toHaveValue('outline');
      await expect(field(group(d, 'screws'), 'Clamping screw holes')).not.toBeChecked();
      await expect(field(group(d, 'screws'), 'Diameter (mm)')).toBeDisabled();
      await expect(combo(d, 'Halves')).toHaveValue('lower');
      await expect(field(d, 'Molds of the left wing (mirror image)')).toBeChecked();
      await expect(summaryOf(d)).toHaveText(summary);
    };
    await dlg.getByRole('button', { name: 'Close', exact: true }).click();
    dlg = await openMold(page);
    await expectKept(dlg);
    await dlg.getByRole('button', { name: 'Close', exact: true }).click();
    await page.reload();
    await expect(statusOf(page)).toHaveText(/^Span 1200 mm/);
    await expectKept(await openMold(page));
  });

  test('Download STEP writes the lower and the upper half, or one of them', async ({ page }) => {
    await createDesign(page, 'Sport');
    const dlg = await openMold(page);
    const both = await downloadOf(page, () => download(dlg).click());
    expect(both.name).toBe('Sport_mold.step');
    const b = stepOf(both.bytes);
    expect(b.text.startsWith('ISO-10303-21;')).toBe(true);
    expect(b.text).toContain("FILE_SCHEMA(('AUTOMOTIVE_DESIGN { 1 0 10303 214 1 1 1 1 }'));");
    expect(b.text.trimEnd().endsWith('END-ISO-10303-21;')).toBe(true);
    expect(b.names).toEqual(['Sport mold lower', 'Sport mold upper']);
    // Z up: the lower half below z = 0, the upper half above it.
    expect(near(b.points, [280, 640.2, -18.0])).toBe(true);
    expect(near(b.points, [280, 640.2, 27.3])).toBe(true);
    // The parting surface is B-spline surfaces, no plane at z = 0 is a face of the parting surface.
    expect(b.text).toContain('B_SPLINE_SURFACE_WITH_KNOTS');
    // The dialog stays open after a download and says so in a notice.
    await expect(dialogOf(page)).toHaveCount(1);
    await expect(page.locator('.toast')).toHaveText('Mold exported as STEP.');

    await combo(dlg, 'Halves').selectOption('lower');
    const lower = stepOf((await downloadOf(page, () => download(dlg).click())).bytes);
    expect(lower.names).toEqual(['Sport mold lower']);
    await combo(dlg, 'Halves').selectOption('upper');
    const upper = stepOf((await downloadOf(page, () => download(dlg).click())).bytes);
    expect(upper.names).toEqual(['Sport mold upper']);
    expect(near(upper.points, [280, 640.2, 27.3])).toBe(true);
    expect(near(upper.points, [280, 640.2, -18.0])).toBe(false);
  });

  test('after an export with the Fusion 360 fix the mold file is Y up', async ({ page }) => {
    await createDesign(page, 'Sport');
    await exportFile(page, 'step', { half: 'right', up: 'y' });
    await expect((await openExport(page)).getByLabel(FUSION_FIX)).toBeChecked();
    await dialogOf(page).getByRole('button', { name: 'Cancel' }).click();
    const dlg = await openMold(page);
    const f = stepOf((await downloadOf(page, () => download(dlg).click())).bytes);
    expect(f.names).toEqual(['Sport mold lower', 'Sport mold upper']);
    // (x, y, z) becomes (x, z, −y): the span runs along −Z, z = 0 becomes y = 0.
    expect(near(f.points, [280, -18.0, -640.2])).toBe(true);
    expect(near(f.points, [280, 640.2, -18.0])).toBe(false);
    expect(Math.min(...f.points.map((p) => p[2]))).toBeCloseTo(-640.2, 1);
  });

  test('speaks German', async ({ page }) => {
    await createDesign(page, 'Sport');
    await openTab(page, 'Settings');
    await page.getByRole('combobox', { name: 'Language / Sprache', exact: true }).selectOption('de');
    await frames(page);
    await page.getByRole('button', { name: 'Exportieren', exact: true }).click();
    await expect(dialogOf(page).getByRole('group', { name: 'Form', exact: true })).toContainText('Unter- und Oberform als STEP-Körper, mit Blutrinne und Bohrungen.');
    await dialogOf(page).getByRole('button', { name: 'Abbrechen', exact: true }).click();
    const dlg = await openMold(page, { exportName: 'Exportieren', button: 'Formhälften …', heading: 'Form' });
    await expect(field(dlg, 'Rand um den Flügel (mm)')).toHaveValue('40');
    await expect(field(dlg, 'Boden unter dem Formnest (mm)')).toHaveValue('12');
    await expect(field(group(dlg, 'channel'), 'Blutrinne')).toBeChecked();
    await expect(field(group(dlg, 'screws'), 'Durchmesser (mm)')).toHaveValue('6,5');
    await expect(summaryOf(dlg)).toHaveText(
      'Formblock 320,0 × 640,2 mm; Unterform bis −18,0 mm, Oberform bis +27,3 mm. Trennfläche auf der Höhe von Nasenleiste und Endleiste, in Flugrichtung eben: von -1,0 bis 1,5 mm; Formrahmen mit dem Flügel um 1,50° gerollt. Blutrinne 1.374 mm lang. 4 Zentrierbohrungen, 12 Bohrungen für Spannschrauben.',
    );
    await expect(dlg.getByRole('button', { name: 'STEP herunterladen', exact: true })).toBeEnabled();
  });

  test('a wing with tip twist shows a parting range that is not 0 to 0', async ({ page }) => {
    await createDesign(page, 'Sport');
    await openTab(page, 'Sections');
    await commit(sectionField(page, -1, 'twist'), -3);
    const dlg = await openMold(page);
    const text = await summaryOf(dlg).innerText();
    expect(text).toMatch(PARTING_PATTERN);
    const [, low, high] = text.match(PARTING_PATTERN);
    expect(Number(low)).toBeLessThan(Number(high));
    expect(`${low} to ${high}`).not.toBe('0.0 to 0.0');
    expect(`${low} to ${high}`, 'the Sport range without twist').not.toBe('-1.0 to 1.5');
    await expect(summaryOf(dlg)).not.toHaveClass(/sev-error/);
    await expect(download(dlg)).toBeEnabled();
  });

  test('phone: the dialog fits the screen, scrolls, and Download STEP works', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'Phone layout: mobile project only');
    await createDesign(page, 'Sport', { tap: true });
    await page.getByRole('button', { name: 'Export', exact: true }).tap();
    await dialogOf(page).getByRole('button', { name: 'Mold halves…', exact: true }).tap();
    const dlg = dialogOf(page);
    await expect(dlg.getByRole('heading', { name: 'Mold', exact: true })).toBeVisible();
    await expect(summaryOf(dlg)).toHaveText(SPORT_SUMMARY);
    const box = await dlg.evaluate((d) => {
      const r = d.getBoundingClientRect();
      const inner = [...d.querySelectorAll('input, select, canvas, button')].map((el) => el.getBoundingClientRect()).filter((b) => b.width > 0);
      return {
        left: r.left,
        right: r.right,
        scrollWidth: d.scrollWidth,
        clientWidth: d.clientWidth,
        scrollHeight: d.scrollHeight,
        clientHeight: d.clientHeight,
        innerWidth: window.innerWidth,
        pageWidth: document.scrollingElement.scrollWidth,
        outside: inner.filter((b) => b.left < r.left - 0.5 || b.right > r.right + 0.5).length,
      };
    });
    expect(box.left).toBeGreaterThanOrEqual(0);
    expect(box.right).toBeLessThanOrEqual(box.innerWidth);
    expect(box.scrollWidth, 'content width vs. dialog width').toBeLessThanOrEqual(box.clientWidth);
    expect(box.pageWidth, 'page scroll width vs. viewport width').toBeLessThanOrEqual(box.innerWidth);
    expect(box.outside, 'fields, canvas and buttons outside the dialog').toBe(0);
    expect(box.scrollHeight, 'content taller than the dialog').toBeGreaterThan(box.clientHeight);
    const canvas = await dlg.getByRole('img', { name: 'Top view of the parting surface of the mold' }).boundingBox();
    expect(canvas.height).toBeGreaterThan(100);
    expect(canvas.width).toBeGreaterThan(200);

    // Tap scrolls the dialog to the button.
    const file = await downloadOf(page, () => download(dlg).tap());
    expect(await dlg.evaluate((d) => d.scrollTop)).toBeGreaterThan(0);
    expect(file.name).toBe('Sport_mold.step');
    expect(stepOf(file.bytes).names).toEqual(['Sport mold lower', 'Sport mold upper']);
  });
});
