// Sections tab: editing the section table, insert/delete, airfoil choice, undo/redo, autosave and
// the chord of a pointed tip.
//
// Expected planform figures come from exact trapezoidal integrals over straight (linear) panels,
// which is what a wizard design without guide curves is.
import {
  airfoilSelect,
  changedFrom,
  checksValue,
  chordCell,
  chordNote,
  createDesign,
  expect,
  frames,
  openTab,
  savedProject,
  sectionField as field,
  sectionRows as rows,
  sectionValues,
  settleView,
  STORAGE_KEY,
  statusFigures,
  statusOf as status,
  test,
  toastOf,
  whenRerendered,
} from './helpers.js';

/** Planform figures of a mirrored wing with straight panels between sorted sections. */
function planform(sections) {
  const s = sections.slice().sort((a, b) => a.y - b.y);
  let A = 0;
  let C2 = 0;
  let CY = 0;
  let CX = 0;
  for (let i = 1; i < s.length; i++) {
    const [a, b] = [s[i - 1], s[i]];
    const dy = b.y - a.y;
    const lin = (f0, f1, g0, g1) => (dy * (2 * f0 * g0 + f0 * g1 + f1 * g0 + 2 * f1 * g1)) / 6;
    A += (dy * (a.chord + b.chord)) / 2;
    C2 += lin(a.chord, b.chord, a.chord, b.chord);
    CY += lin(a.chord, b.chord, a.y, b.y);
    CX += lin(a.chord, b.chord, a.x, b.x);
  }
  const span = 2 * s[s.length - 1].y;
  const area = 2 * A;
  return { span, area, ar: (span * span) / area, mac: C2 / A, macY: CY / A, macX: CX / A, root: s[0].chord, tip: s[s.length - 1].chord };
}

function statusText(p) {
  return `Span ${p.span.toFixed(0)} mm · area ${(p.area / 1e4).toFixed(2)} dm² · AR ${p.ar.toFixed(2)} · MAC ${p.mac.toFixed(1)} mm`;
}

const table = (page) => page.locator('table.sections');
/** Section values as shown in the table: airfoil id and the numeric fields. */
const tableSections = (page) => sectionValues(page);

/** Type a value into a section field and commit it with Enter; the table is rendered again. */
async function editField(page, row, key, value) {
  const input = field(page, row, key);
  await whenRerendered(table(page), async () => {
    await input.fill(String(value));
    await input.press('Enter');
  });
}

/** Click a button that changes the sections and wait for the new table. */
const clickAndRerender = (page, name) => whenRerendered(table(page), () => page.getByRole('button', { name, exact: true }).click());

/** Settled 3D view (canvas readback; the "Created ..." toast is not part of the canvas). */
const settledView = (page) => settleView(page, (c) => c.opaque > 1000, '3D view settled');

// Sport preset: root y 0, chord 240, x 0; tip y 600, chord 144, x 24, z 15.71, twist -1.
const SPORT_STATUS = 'Span 1200 mm · area 23.04 dm² · AR 6.25 · MAC 196.0 mm';

test.describe('Sections tab', () => {
  test('preset table values and the planform oracle agree with the status bar', async ({ page }) => {
    await createDesign(page, 'Sport');
    await expect(rows(page)).toHaveCount(2);
    const secs = await tableSections(page);
    expect(secs).toEqual([
      { airfoil: 'naca2412', y: 0, x: 0, z: 0, chord: 240, twist: 0 },
      { airfoil: 'naca2410', y: 600, x: 24, z: 15.71, chord: 144, twist: -1 },
    ]);
    expect(statusText(planform(secs))).toBe(SPORT_STATUS);
    await expect(status(page)).toHaveText(SPORT_STATUS);
  });

  test('chord edit updates area, aspect ratio and MAC in the status bar and the Checks tab', async ({ page }) => {
    await createDesign(page, 'Sport');
    await expect(status(page)).toHaveText(SPORT_STATUS);
    await editField(page, 1, 'chord', 240);
    await expect(field(page, 1, 'chord')).toHaveValue('240');
    // Rectangular half wing 600 x 240 mm.
    await expect(status(page)).toHaveText('Span 1200 mm · area 28.80 dm² · AR 5.00 · MAC 240.0 mm');
    await openTab(page, 'Checks');
    await expect(checksValue(page, 'Wing area')).toHaveText('28.80 dm²');
    await expect(checksValue(page, 'Aspect ratio')).toHaveText('5.00');
    await expect(checksValue(page, 'Mean aerodynamic chord (MAC)')).toHaveText('240.0 mm');
    await expect(checksValue(page, 'Root / tip chord')).toHaveText('240.0 / 240.0 mm');
    await expect(page.locator('#pane-checks')).toContainText('No errors or warnings.');

    // Root chord: status bar and Checks tab follow again.
    await openTab(page, 'Sections');
    await editField(page, 0, 'chord', 300);
    const p = planform(await tableSections(page));
    await expect(status(page)).toHaveText(statusText(p));
    await openTab(page, 'Checks');
    await expect(checksValue(page, 'Root / tip chord')).toHaveText('300.0 / 240.0 mm');
    await expect(checksValue(page, 'Wing area')).toHaveText(`${(p.area / 1e4).toFixed(2)} dm²`);
  });

  test('y edit changes the span; x edit moves the MAC leading edge', async ({ page }) => {
    await createDesign(page, 'Sport');
    await editField(page, 1, 'y', 720);
    await expect(field(page, 1, 'y')).toHaveValue('720');
    // Half wing 720 mm, chords 240 -> 144: area 2 * 720 * 192 mm², AR 1440² / area.
    await expect(status(page)).toHaveText('Span 1440 mm · area 27.65 dm² · AR 7.50 · MAC 196.0 mm');
    await openTab(page, 'Checks');
    await expect(checksValue(page, 'Span')).toHaveText('1440.0 mm');
    // Chord-weighted means: MAC y = 11/24 * 720, leading edge x = 11/24 * 24.
    await expect(checksValue(page, 'MAC position')).toHaveText('y 330.0 mm, leading edge x 11.0 mm');
    await expect(checksValue(page, '25 % MAC (geometric reference)')).toHaveText('x 60.0 mm');

    await openTab(page, 'Sections');
    await editField(page, 1, 'x', 124);
    await expect(field(page, 1, 'x')).toHaveValue('124');
    // Sweep does not change span, area or MAC length.
    await expect(status(page)).toHaveText('Span 1440 mm · area 27.65 dm² · AR 7.50 · MAC 196.0 mm');
    await openTab(page, 'Checks');
    await expect(checksValue(page, 'MAC position')).toHaveText('y 330.0 mm, leading edge x 56.8 mm');
    await expect(checksValue(page, '25 % MAC (geometric reference)')).toHaveText('x 105.8 mm');
    const p = planform((await savedProject(page)).sections);
    expect(p.macX.toFixed(1)).toBe('56.8');
  });

  test('z and twist edits change the 3D wing but not the planform figures', async ({ page }) => {
    await createDesign(page, 'Sport');
    await expect(status(page)).toHaveText(SPORT_STATUS);
    const flat = await settledView(page);
    await editField(page, 1, 'z', 120);
    await expect(field(page, 1, 'z')).toHaveValue('120');
    // The tip rises by 104 mm: the top of the wing moves up in the (unchanged) camera view.
    const raised = await changedFrom(page, flat, 'z edit');
    expect(raised.box.y).toBeLessThan(flat.box.y - 20);
    await expect(status(page)).toHaveText(SPORT_STATUS);
    expect((await savedProject(page)).sections[1].z).toBe(120);

    await editField(page, 1, 'twist', -6.5);
    await expect(field(page, 1, 'twist')).toHaveValue('-6.5');
    const twisted = await changedFrom(page, raised, 'twist edit');
    // Twist turns the tip section only: the projected size stays within a few percent.
    expect(twisted.opaque / raised.opaque).toBeGreaterThan(0.9);
    expect(twisted.opaque / raised.opaque).toBeLessThan(1.1);
    await expect(status(page)).toHaveText(SPORT_STATUS);
    expect((await savedProject(page)).sections[1].twist).toBe(-6.5);
    await openTab(page, 'Checks');
    await expect(checksValue(page, 'Wing area')).toHaveText('23.04 dm²');
  });

  test('inserting after row 1 adds a section halfway with averaged values', async ({ page }) => {
    await createDesign(page, 'Swept flying wing');
    await expect(rows(page)).toHaveCount(3);
    const before = await tableSections(page);
    expect(before.map((s) => s.y)).toEqual([0, 300, 600]);
    const statusBefore = await status(page).textContent();
    expect(statusBefore).toBe(statusText(planform(before)));

    await clickAndRerender(page, 'Insert section after 1');
    await expect(rows(page)).toHaveCount(4);
    const after = await tableSections(page);
    const [a, b] = before;
    expect(after[1].y).toBeCloseTo((a.y + b.y) / 2, 3);
    expect(after[1].chord).toBeCloseTo((a.chord + b.chord) / 2, 3);
    expect(after[1].x).toBeCloseTo((a.x + b.x) / 2, 3);
    expect(after[1].z).toBeCloseTo((a.z + b.z) / 2, 3);
    expect(after[1].twist).toBeCloseTo((a.twist + b.twist) / 2, 3);
    expect(after[1].airfoil).toBe(a.airfoil);
    expect([after[0], after[2], after[3]]).toEqual(before);
    await expect(field(page, 1, 'y')).toHaveValue('150');
    await expect(field(page, 1, 'chord')).toHaveValue('241.5');
    // The new section is selected.
    await expect(rows(page).nth(1)).toHaveClass(/selected/);
    // A section halfway on a straight panel does not change the planform.
    await expect(status(page)).toHaveText(statusBefore);
    // Row numbers follow the new order.
    await expect(rows(page).locator('th')).toHaveText([/1$/, /2$/, /3$/, /4$/]);
    expect((await savedProject(page)).sections).toHaveLength(4);
  });

  test('deleting down to two sections disables delete', async ({ page }) => {
    await createDesign(page, 'Swept flying wing');
    await expect(rows(page)).toHaveCount(3);
    for (let i = 1; i <= 3; i++) await expect(page.getByRole('button', { name: `Delete section ${i}`, exact: true })).toBeEnabled();

    // Delete the tip: the half span ends at the middle section (y 300).
    const before = await tableSections(page);
    await clickAndRerender(page, 'Delete section 3');
    await expect(rows(page)).toHaveCount(2);
    expect(await tableSections(page)).toEqual(before.slice(0, 2));
    await expect(status(page)).toHaveText(statusText(planform(before.slice(0, 2))));
    await expect(status(page)).toContainText('Span 600 mm');
    await expect(page.getByRole('button', { name: 'Delete section 1', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Delete section 2', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Insert section after 2', exact: true })).toBeEnabled();
    expect((await savedProject(page)).sections).toHaveLength(2);

    // Insert again, then delete the middle one: back to two rows, delete disabled again.
    await clickAndRerender(page, 'Insert section after 1');
    await expect(rows(page)).toHaveCount(3);
    await expect(page.getByRole('button', { name: 'Delete section 2', exact: true })).toBeEnabled();
    await clickAndRerender(page, 'Delete section 2');
    await expect(rows(page)).toHaveCount(2);
    expect(await tableSections(page)).toEqual(before.slice(0, 2));
    await expect(rows(page).getByRole('button', { name: /^Delete section/ })).toHaveCount(2);
    for (const btn of await rows(page).getByRole('button', { name: /^Delete section/ }).all()) await expect(btn).toBeDisabled();
  });

  test('changing a section airfoil updates the wing, the airfoil usage and survives reload', async ({ page }) => {
    await createDesign(page, 'Sport');
    const tip = airfoilSelect(page, 1);
    await expect(tip).toHaveValue('naca2410');
    await expect(tip.locator('option')).toHaveText(['NACA 2412', 'NACA 2410']);
    const before = await settledView(page);

    await whenRerendered(table(page), () => tip.selectOption({ label: 'NACA 2412' }));
    await expect(airfoilSelect(page, 1)).toHaveValue('naca2412');
    await expect(airfoilSelect(page, 0)).toHaveValue('naca2412');
    // A thicker tip profile: the image changes, the projected size by less than a few percent.
    const thicker = await changedFrom(page, before, 'tip airfoil NACA 2412');
    expect(thicker.opaque / before.opaque).toBeGreaterThan(0.95);
    expect(thicker.opaque / before.opaque).toBeLessThan(1.05);
    // Planform unchanged.
    await expect(status(page)).toHaveText(SPORT_STATUS);
    expect((await savedProject(page)).sections.map((s) => s.airfoil)).toEqual(['naca2412', 'naca2412']);

    // NACA 2410 is no longer used by any section: it is marked unused and can be removed.
    await openTab(page, 'Airfoils');
    const item = page.locator('#pane-airfoils .airfoil-list').first().locator('li').filter({ hasText: 'NACA 2410' });
    await expect(item).toContainText('unused');
    await expect(item.getByRole('button', { name: '×' })).toBeEnabled();
    const used = page.locator('#pane-airfoils .airfoil-list').first().locator('li').filter({ hasText: 'NACA 2412' });
    await expect(used).not.toContainText('unused');
    await expect(used.getByRole('button', { name: '×' })).toBeDisabled();

    await openTab(page, 'Sections');
    await page.reload();
    await expect(page.locator('dialog[open]')).toHaveCount(0);
    await expect(airfoilSelect(page, 1)).toHaveValue('naca2412');
    await expect(status(page)).toHaveText(SPORT_STATUS);
  });

  test('y edit past the next section reorders the rows; a y taken by another section is rejected', async ({ page }) => {
    await createDesign(page, 'Swept flying wing');
    const before = await tableSections(page);
    expect(before.map((s) => s.y)).toEqual([0, 300, 600]);
    await editField(page, 1, 'y', 700);
    const after = await tableSections(page);
    expect(after.map((s) => s.y)).toEqual([0, 600, 700]);
    // The edited section keeps its other values and moves to row 3.
    expect(after[2]).toEqual({ ...before[1], y: 700 });
    expect(after[1]).toEqual(before[2]);
    await expect(field(page, 2, 'chord')).toHaveValue(String(before[1].chord));
    const reordered = statusText(planform(after));
    await expect(status(page)).toHaveText(reordered);
    await expect(status(page)).toContainText('Span 1400 mm');
    await openTab(page, 'Checks');
    await expect(checksValue(page, 'Root / tip chord')).toHaveText(`${before[0].chord.toFixed(1)} / ${before[1].chord.toFixed(1)} mm`);
    await openTab(page, 'Sections');
    // Storage keeps the sorted order.
    expect((await savedProject(page)).sections.map((s) => s.y)).toEqual([0, 600, 700]);

    // A y equal to another section is rejected with a message; the field shows the stored value again.
    await editField(page, 2, 'y', 600);
    await expect(toastOf(page)).toHaveText('Another section already lies at y = 600 mm; sections need distinct span positions.');
    await expect(toastOf(page)).toHaveClass(/\berror\b/);
    await expect(field(page, 2, 'y')).toHaveValue('700');
    await expect(status(page)).toHaveText(reordered);
    await expect(status(page)).not.toHaveClass(/has-error/);
    expect((await savedProject(page)).sections.map((s) => s.y)).toEqual([0, 600, 700]);

    await editField(page, 2, 'y', 650);
    await expect(status(page)).not.toHaveClass(/has-error/);
    await expect(status(page)).toContainText('Span 1300 mm');
    await expect.poll(async () => (await savedProject(page)).sections.map((s) => s.y)).toEqual([0, 600, 650]);
  });

  test('pointed tip: the tip chord follows the previous section; the stored tip chord is not used', async ({ page }) => {
    await createDesign(page, 'Sport', { tip: 'pointed' });
    // The wizard stores the scaled tip chord, 240 / 200 = 1.2 mm.
    await expect(field(page, 1, 'chord')).toHaveValue('1.2');
    await expect(chordNote(page, 1)).toHaveText('tip: 1.20');

    // A section halfway: chord (240 + 1.2) / 2 = 120.6 mm, 1/200 of it is 0.60 mm, raised to 1 mm.
    await clickAndRerender(page, 'Insert section after 1');
    await expect(rows(page)).toHaveCount(3);
    await expect(field(page, 1, 'chord')).toHaveValue('120.6');
    await expect(chordNote(page, 2)).toHaveText('tip: 1.00 (min.)');
    await expect(chordNote(page, 1)).toHaveCount(0);

    // The previous chord sets the tip chord: 300 / 200 = 1.5 mm. Straight panels 240 -> 300 -> 1.5 mm:
    // area 2 * (300 * 540 / 2 + 300 * 301.5 / 2) mm² = 25.245 dm².
    await editField(page, 1, 'chord', 300);
    await expect(chordNote(page, 2)).toHaveText('tip: 1.50');
    const fig = await statusFigures(page, 1200, { clean: true });
    expect(Math.abs(fig.area - 25.245)).toBeLessThanOrEqual(0.006);
    const pointed = fig.text;

    // The chord typed into the tip row is stored but does not shape the wing.
    await editField(page, 2, 'chord', 50);
    await expect(field(page, 2, 'chord')).toHaveValue('50');
    await expect(chordNote(page, 2)).toHaveText('tip: 1.50');
    await expect(status(page)).toHaveText(pointed);
    expect((await savedProject(page)).sections.map((s) => s.chord)).toEqual([240, 300, 50]);
  });

  test('Undo and Redo buttons restore section values', async ({ page }) => {
    await createDesign(page, 'Sport');
    const undo = page.getByRole('button', { name: 'Undo', exact: true });
    const redo = page.getByRole('button', { name: 'Redo', exact: true });
    await expect(redo).toBeDisabled();

    await editField(page, 1, 'chord', 200);
    // Chords 240 -> 200 mm.
    const s1 = 'Span 1200 mm · area 26.40 dm² · AR 5.45 · MAC 220.6 mm';
    await expect(status(page)).toHaveText(s1);
    await editField(page, 1, 'twist', -3);

    await undo.click();
    await expect(field(page, 1, 'twist')).toHaveValue('-1');
    await expect(field(page, 1, 'chord')).toHaveValue('200');
    await expect(redo).toBeEnabled();
    await undo.click();
    await expect(field(page, 1, 'chord')).toHaveValue('144');
    await expect(status(page)).toHaveText(SPORT_STATUS);
    await expect.poll(async () => (await savedProject(page)).sections[1].chord).toBe(144);

    await redo.click();
    await expect(field(page, 1, 'chord')).toHaveValue('200');
    await expect(status(page)).toHaveText(s1);
    await redo.click();
    await expect(field(page, 1, 'twist')).toHaveValue('-3');
    await expect(redo).toBeDisabled();

    // A new edit after an undo clears the redo history.
    await undo.click();
    await expect(field(page, 1, 'twist')).toHaveValue('-1');
    await expect(redo).toBeEnabled();
    await editField(page, 1, 'z', 40);
    await expect(redo).toBeDisabled();
    await expect(field(page, 1, 'twist')).toHaveValue('-1');

    // Insert and delete are undoable too.
    await clickAndRerender(page, 'Insert section after 1');
    await expect(rows(page)).toHaveCount(3);
    await undo.click();
    await expect(rows(page)).toHaveCount(2);
    await expect(field(page, 1, 'z')).toHaveValue('40');
  });

  test('Ctrl+Z and Ctrl+Shift+Z undo and redo section edits', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Keyboard shortcuts are a desktop feature');
    await createDesign(page, 'Swept flying wing');
    const before = await tableSections(page);
    await editField(page, 2, 'chord', 180);
    await editField(page, 1, 'y', 800);
    const edited = await tableSections(page);
    expect(edited.map((s) => s.y)).toEqual([0, 600, 800]);
    const editedStatus = await status(page).textContent();

    // Shortcuts act when the focus is outside the form fields.
    await page.evaluate(() => document.activeElement?.blur());
    await page.keyboard.press('Control+z');
    await expect.poll(() => tableSections(page)).toEqual([before[0], before[1], { ...before[2], chord: 180 }]);
    await page.keyboard.press('Control+z');
    await expect.poll(() => tableSections(page)).toEqual(before);
    await expect(status(page)).toHaveText(statusText(planform(before)));

    await page.keyboard.press('Control+Shift+Z');
    await expect.poll(() => tableSections(page)).toEqual([before[0], before[1], { ...before[2], chord: 180 }]);
    await page.keyboard.press('Control+Shift+Z');
    await expect.poll(() => tableSections(page)).toEqual(edited);
    await expect(status(page)).toHaveText(editedStatus);
    await expect(page.getByRole('button', { name: 'Redo', exact: true })).toBeDisabled();

    // Inside a number field Ctrl+Z belongs to the field, not to the project history.
    const chord = field(page, 0, 'chord');
    await chord.click();
    await page.keyboard.press('Control+z');
    await frames(page);
    expect(await tableSections(page)).toEqual(edited);
    await expect(page.getByRole('button', { name: 'Redo', exact: true })).toBeDisabled();
  });

  test('Ctrl+Y redoes an undone edit', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Keyboard shortcuts are a desktop feature');
    await createDesign(page, 'Sport');
    await editField(page, 1, 'chord', 200);
    await editField(page, 1, 'twist', -3);
    const edited = await tableSections(page);
    const editedStatus = 'Span 1200 mm · area 26.40 dm² · AR 5.45 · MAC 220.6 mm';
    await expect(status(page)).toHaveText(editedStatus);

    await page.evaluate(() => document.activeElement?.blur());
    await page.keyboard.press('Control+z');
    await page.keyboard.press('Control+z');
    await expect(field(page, 1, 'chord')).toHaveValue('144');
    await expect(status(page)).toHaveText(SPORT_STATUS);

    await page.keyboard.press('Control+y');
    await expect(field(page, 1, 'chord')).toHaveValue('200');
    await expect(field(page, 1, 'twist')).toHaveValue('-1');
    await expect(status(page)).toHaveText(editedStatus);
    await page.keyboard.press('Control+y');
    await expect.poll(() => tableSections(page)).toEqual(edited);
    await expect(page.getByRole('button', { name: 'Redo', exact: true })).toBeDisabled();
    // Nothing left to redo: a third Ctrl+Y changes nothing.
    await page.keyboard.press('Control+y');
    await frames(page);
    expect(await tableSections(page)).toEqual(edited);
    await expect.poll(async () => (await savedProject(page)).sections[1]).toMatchObject({ chord: 200, twist: -3 });
  });

  test('section edits persist after reload (autosave)', async ({ page }) => {
    await createDesign(page, 'Swept flying wing');
    await editField(page, 0, 'chord', 300);
    await editField(page, 2, 'twist', -5.5);
    await editField(page, 2, 'z', 25);
    await clickAndRerender(page, 'Insert section after 2');
    await whenRerendered(table(page), () => airfoilSelect(page, 1).selectOption({ label: 'NACA 0010' }));
    await editField(page, 2, 'x', 222.5);
    const edited = await tableSections(page);
    expect(edited).toHaveLength(4);
    const editedStatus = await status(page).textContent();
    expect(editedStatus).toBe(statusText(planform(edited)));

    await page.reload();
    await expect(page.locator('.viewport canvas')).toBeVisible();
    await expect(page.locator('dialog[open]')).toHaveCount(0);
    await expect(rows(page)).toHaveCount(4);
    await expect.poll(() => tableSections(page)).toEqual(edited);
    await expect(status(page)).toHaveText(editedStatus);
    expect((await savedProject(page)).sections.map(({ airfoil, x, y, z, chord, twist }) => ({ airfoil, y, x, z, chord, twist }))).toEqual(edited);
  });

  test('an edit is saved when the page is left before the next frame', async ({ page }) => {
    await createDesign(page, 'Sport');
    const chord = await field(page, 0, 'chord').elementHandle();
    // Commit an edit and leave the page in the same task: the rebuild frame has not run yet.
    const saved = await page.evaluate(
      ([input, key]) => {
        input.value = '321';
        input.dispatchEvent(new Event('change', { bubbles: true }));
        dispatchEvent(new PageTransitionEvent('pagehide'));
        return JSON.parse(localStorage.getItem(key)).sections[0].chord;
      },
      [chord, STORAGE_KEY],
    );
    expect(saved).toBe(321);
    await frames(page);
    expect((await savedProject(page)).sections[0].chord).toBe(321);
  });

  test('values beyond the project limits are clamped to them', async ({ page }) => {
    await createDesign(page, 'Sport');
    // A twist of 1e308 degrees would overflow the angle conversion; the limit is 360 degrees.
    await editField(page, 1, 'twist', '1e308');
    await expect(field(page, 1, 'twist')).toHaveValue('360');
    await editField(page, 1, 'chord', 5e5);
    await expect(field(page, 1, 'chord')).toHaveValue('100000');
    await editField(page, 1, 'x', -2e6);
    await expect(field(page, 1, 'x')).toHaveValue('-1000000');
    expect((await savedProject(page)).sections[1]).toMatchObject({ twist: 360, chord: 100000, x: -1000000 });
    await expect(field(page, 1, 'twist')).toHaveAttribute('max', '360');
  });

  test('clearing a number field keeps the previous value', async ({ page }) => {
    await createDesign(page, 'Sport');
    const twist = field(page, 1, 'twist');
    await twist.fill('');
    await twist.press('Enter');
    await frames(page);
    await expect(field(page, 1, 'twist')).toHaveValue('-1');
    // The chord of the tip keeps its value too (0 would be raised to the minimum chord).
    const chord = field(page, 1, 'chord');
    await chord.fill('');
    await chord.press('Enter');
    await frames(page);
    await expect(chordCell(page, 1).locator('input')).toHaveValue('144');
    await expect(status(page)).toHaveText(SPORT_STATUS);
    expect((await savedProject(page)).sections[1]).toMatchObject({ twist: -1, chord: 144 });
  });
});
