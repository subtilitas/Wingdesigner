// New-design wizard: presets, input validation, planform/tip options, the panel table, skip, New and
// Cancel.
import { chordCell, chordNote, createFromWizard, dialogOf, expect, openFirstRun, openTab, pickPreset, saveProject, sectionRows, sectionValues, statusFigures, statusOf, test, toastOf } from './helpers.js';

// Preset parameters as defined in src/model/wizard.js (PRESETS).
const PRESETS = [
  { label: 'Trainer', span: 1400, rootChord: 250, taper: 1, sections: 2, planform: 'straight' },
  { label: 'Sport', span: 1200, rootChord: 240, taper: 0.6, sections: 2, planform: 'straight' },
  { label: 'Glider', span: 2000, rootChord: 200, taper: 0.45, sections: 3, planform: 'elliptic' },
  { label: 'Swept flying wing', span: 1200, rootChord: 280, taper: 0.45, sections: 3, planform: 'straight' },
  { label: 'Plank', span: 1000, rootChord: 220, taper: 0.8, sections: 2, planform: 'straight' },
  { label: 'Tail surface', span: 500, rootChord: 130, taper: 0.7, sections: 2, planform: 'straight' },
];

const SUMMARY_RE = /^Area ([\d.]+) dm², aspect ratio ([\d.]+), mean aerodynamic chord ([\d.]+) mm at y = (-?\d+) mm, tip chord ([\d.]+) mm\.$/;
// Sport preset: 1200 mm span, chords 240 -> 144 mm, straight taper.
const SPORT_STATUS = 'Span 1200 mm · area 23.04 dm² · AR 6.25 · MAC 196.0 mm';

const summaryOf = (wizard) => wizard.locator('p[aria-live="polite"]');

/** Parse the wizard's summary line (key figures of the previewed design). */
async function summaryFigures(wizard) {
  const summary = summaryOf(wizard);
  await expect(summary).toHaveText(SUMMARY_RE);
  const m = (await summary.innerText()).trim().match(SUMMARY_RE);
  return { text: m[0], area: Number(m[1]), arText: m[2], macText: m[3], tipChord: Number(m[5]) };
}

async function numberValue(input) {
  return Number(await input.inputValue());
}

test.describe('new-design wizard', () => {
  for (const preset of PRESETS) {
    test(`preset "${preset.label}" creates a design with the preset span`, async ({ page }) => {
      const wizard = await openFirstRun(page);
      await pickPreset(wizard, preset.label);

      // The fields take the preset values and the name defaults to the preset label.
      await expect(wizard.getByLabel('Span (both halves) (mm)')).toHaveValue(String(preset.span));
      await expect(wizard.getByLabel('Root chord (mm)')).toHaveValue(String(preset.rootChord));
      await expect(wizard.getByLabel('Taper (tip / root chord)')).toHaveValue(String(preset.taper));
      await expect(wizard.getByLabel('Number of sections')).toHaveValue(String(preset.sections));
      await expect(wizard.getByRole('combobox', { name: 'Planform', exact: true })).toHaveValue(preset.planform);
      await expect(wizard.getByRole('textbox', { name: 'Project name' })).toHaveValue(preset.label);
      const preview = await summaryFigures(wizard);

      await createFromWizard(page);
      const fig = await statusFigures(page, preset.span, { clean: true });

      // The created design matches the wizard preview figures.
      expect(Math.abs(fig.area - preview.area)).toBeLessThanOrEqual(0.051);
      expect(fig.arText).toBe(preview.arText);
      expect(fig.macText).toBe(preview.macText);

      // Straight tapered presets have an exactly known area: span * (root + tip) / 2.
      if (preset.planform === 'straight') {
        const area = (preset.span * preset.rootChord * (1 + preset.taper)) / 2 / 1e4;
        expect(Math.abs(fig.area - area)).toBeLessThanOrEqual(0.006);
        expect(Math.abs(fig.ar - (preset.span * preset.span) / (area * 1e4))).toBeLessThanOrEqual(0.006);
      }

      // Sections table: preset section count, root chord, tip at half the span.
      const rows = sectionRows(page);
      await expect(rows).toHaveCount(preset.sections);
      expect(await numberValue(chordCell(page, 0).locator('input'))).toBe(preset.rootChord);
      expect(await numberValue(rows.last().locator('td').nth(1).locator('input'))).toBe(preset.span / 2);
      expect(await numberValue(chordCell(page, -1).locator('input'))).toBeCloseTo(preset.rootChord * preset.taper, 1);
      // Flat tips never show the pointed-tip chord note.
      await expect(chordCell(page, -1)).not.toContainText('tip:');

      // The design is autosaved: a reload shows it without the wizard.
      await page.reload();
      await expect(sectionRows(page)).toHaveCount(preset.sections);
      await expect(dialogOf(page)).toHaveCount(0);
      await expect(statusOf(page)).toHaveText(fig.text);
    });
  }

  // Panel presets: panels in the table, sections of the created design (an elliptic tip adds 6).
  const PANEL_PRESETS = [
    { label: 'Sailplane', span: 3000, rootChord: 210, panels: 3, sections: 9, tip: 'elliptic' },
    { label: 'Delta jet', span: 900, rootChord: 800, panels: 1, sections: 2, tip: 'flat' },
    { label: 'Double delta', span: 1000, rootChord: 1000, panels: 2, sections: 3, tip: 'flat' },
    { label: 'Batwing', span: 1000, rootChord: 363, panels: 12, sections: 13, tip: 'pointed' },
  ];
  for (const preset of PANEL_PRESETS) {
    test(`panel preset "${preset.label}" lists its panels and creates a section at every panel end`, async ({ page }) => {
      const wizard = await openFirstRun(page);
      await pickPreset(wizard, preset.label);
      await expect(wizard.getByRole('combobox', { name: 'Planform', exact: true })).toHaveValue('panels');
      await expect(wizard.getByRole('combobox', { name: 'Tip', exact: true })).toHaveValue(preset.tip);
      // The panel table replaces taper, sweep, dihedral and number of sections.
      await expect(wizard.getByLabel('Taper (tip / root chord)')).toHaveCount(0);
      await expect(wizard.getByLabel('Number of sections')).toHaveCount(0);
      const table = wizard.getByRole('table', { name: 'Panels from root to tip' });
      await expect(table.locator('tbody tr')).toHaveCount(preset.panels);
      await expect(wizard.getByText('Shares sum to 100.0 %; they are scaled to the half span.')).toBeVisible();
      const preview = await summaryFigures(wizard);
      await createFromWizard(page);
      const fig = await statusFigures(page, preset.span, { clean: true });
      expect(Math.abs(fig.area - preview.area)).toBeLessThanOrEqual(0.051);
      expect(fig.arText).toBe(preview.arText);
      await expect(sectionRows(page)).toHaveCount(preset.sections);
      expect(await numberValue(chordCell(page, 0).locator('input'))).toBe(preset.rootChord);
    });
  }

  test('panels: a straight planform becomes one panel; edits, Add and Remove change the preview and the sections', async ({ page }) => {
    const wizard = await openFirstRun(page);
    await pickPreset(wizard, 'Sport');
    await wizard.getByRole('combobox', { name: 'Planform', exact: true }).selectOption('panels');
    const rows = wizard.getByRole('table', { name: 'Panels from root to tip' }).locator('tbody tr');
    await expect(rows).toHaveCount(1);
    // Sport: taper 0.6 and no sweep of the 25 % line: the leading edge runs 0.25 · 96 mm = 24 mm aft
    // over 600 mm, 2.29061° (the table shows up to 6 decimals); the outer chord 60 %, the dihedral 1.5°.
    await expect(wizard.getByLabel('Panel 1: Leading-edge sweep (deg)')).toHaveValue('2.29061');
    await expect(wizard.getByLabel('Panel 1: Outer chord (% of root)')).toHaveValue('60');
    await expect(wizard.getByLabel('Panel 1: Dihedral (deg)')).toHaveValue('1.5');
    expect((await summaryFigures(wizard)).tipChord).toBe(144);

    await wizard.getByLabel('Panel 1: Outer chord (% of root)').fill('50');
    expect((await summaryFigures(wizard)).tipChord).toBe(120);
    await wizard.getByRole('button', { name: 'Add panel' }).click();
    await expect(rows).toHaveCount(2);
    await expect(wizard.getByText('Shares sum to 200.0 %; they are scaled to the half span.')).toBeVisible();
    await wizard.getByLabel('Panel 2: Outer chord (% of root)').fill('20');
    expect((await summaryFigures(wizard)).tipChord).toBe(48);
    // An outer chord below 1 mm stops Create unless the tip ends in a point.
    await wizard.getByLabel('Panel 1: Outer chord (% of root)').fill('0');
    await expect(summaryOf(wizard)).toHaveText('Panel 1: the outer chord is below 1 mm.');
    await expect(wizard.getByRole('button', { name: 'Create design' })).toBeDisabled();
    await wizard.getByRole('button', { name: 'Remove panel 1' }).click();
    await expect(rows).toHaveCount(1);
    await expect(wizard.getByRole('button', { name: 'Remove panel 1' })).toBeDisabled();
    expect((await summaryFigures(wizard)).tipChord).toBe(48);
    await createFromWizard(page);
    await expect(sectionRows(page)).toHaveCount(2);
  });

  test('panels: an elliptic planform becomes one panel per section interval with its elliptic chords', async ({ page }) => {
    const wizard = await openFirstRun(page);
    await pickPreset(wizard, 'Glider');
    await wizard.getByRole('combobox', { name: 'Planform', exact: true }).selectOption('panels');
    // 3 sections: 2 panels. The middle section has the elliptic chord 200 mm · sqrt(1 − (1 − 0.45²) · 0.5²)
    // = 178.96 mm, 89.477651 % of the root (the straight law would give 72.5 %).
    await expect(wizard.getByRole('table', { name: 'Panels from root to tip' }).locator('tbody tr')).toHaveCount(2);
    await expect(wizard.getByLabel('Panel 1: Outer chord (% of root)')).toHaveValue('89.477651');
    await expect(wizard.getByLabel('Panel 2: Outer chord (% of root)')).toHaveValue('45');
  });

  test('panels: a source field without a number takes the preset value in the conversion', async ({ page }) => {
    const wizard = await openFirstRun(page);
    await pickPreset(wizard, 'Sport');
    await wizard.getByLabel('Taper (tip / root chord)').fill('');
    await wizard.getByRole('combobox', { name: 'Planform', exact: true }).selectOption('panels');
    // The hidden Taper field held no number: the panel takes the Sport taper 0.6.
    await expect(wizard.getByLabel('Panel 1: Outer chord (% of root)')).toHaveValue('60');
    await expect(wizard.getByLabel('Panel 1: Leading-edge sweep (deg)')).toHaveValue('2.29061');
    await expect(wizard.getByRole('button', { name: 'Create design' })).toBeEnabled();
  });

  test('an elliptic tip needs the planform Panels', async ({ page }) => {
    const wizard = await openFirstRun(page);
    await pickPreset(wizard, 'Sport');
    await wizard.getByRole('combobox', { name: 'Tip', exact: true }).selectOption('elliptic');
    await expect(summaryOf(wizard)).toHaveText('An elliptic tip needs the planform Panels.');
    await expect(wizard.getByRole('button', { name: 'Create design' })).toBeDisabled();
    await wizard.getByRole('combobox', { name: 'Planform', exact: true }).selectOption('panels');
    // The one panel ends in a quarter ellipse; the section before the tip (t = sin 75°) has
    // 240 mm · sqrt(1 − 0.966²) = 62.1 mm, 1/200 of it is 0.31 mm: the tip takes the 1 mm floor.
    expect((await summaryFigures(wizard)).tipChord).toBe(1);
    await createFromWizard(page);
    await expect(sectionRows(page)).toHaveCount(7);
  });

  const INVALID = [
    // Status expected for the corrected Sport design (span * (root + tip) / 2, MAC of a trapezoid).
    { field: 'Span (both halves) (mm)', value: '10', valid: '1500', problem: 'span must be between 100 and 20000.', status: 'Span 1500 mm · area 28.80 dm² · AR 7.81 · MAC 196.0 mm' },
    { field: 'Taper (tip / root chord)', value: '3', valid: '0.5', problem: 'taper must be between 0.1 and 1.5.', status: 'Span 1200 mm · area 21.60 dm² · AR 6.67 · MAC 186.7 mm' },
    { field: 'Root airfoil', value: 'XY 45', valid: '2412', airfoil: 'NACA 2412', problem: 'rootAirfoil must be a NACA 4- or 5-digit designation or the name of a Library airfoil, e.g. MH 45.', status: SPORT_STATUS },
    { field: 'Tip airfoil', value: 'XY 45', valid: 'NACA 0010', airfoil: 'NACA 0010', problem: 'tipAirfoil must be a NACA 4- or 5-digit designation or the name of a Library airfoil, e.g. MH 45.', status: SPORT_STATUS },
    // A Library name: letter case, spaces and hyphens do not count.
    { field: 'Tip airfoil', value: 'MH 99', valid: 'mh-45', airfoil: 'MH 45', problem: 'tipAirfoil must be a NACA 4- or 5-digit designation or the name of a Library airfoil, e.g. MH 45.', status: SPORT_STATUS },
  ];
  for (const bad of INVALID) {
    test(`invalid "${bad.field}" = ${bad.value} disables Create design and shows the problem`, async ({ page }) => {
      const wizard = await openFirstRun(page);
      const create = wizard.getByRole('button', { name: 'Create design' });
      const summary = summaryOf(wizard);
      await expect(create).toBeEnabled();
      await expect(summary).toHaveText(SUMMARY_RE);

      const input = wizard.getByLabel(bad.field, { exact: true });
      await input.fill(bad.value);
      await expect(create).toBeDisabled();
      await expect(summary).toHaveClass(/sev-error/);
      // Exactly one problem is listed.
      await expect(summary).toHaveText(bad.problem);

      // Correcting the value enables Create again and the created design uses the corrected value.
      await input.fill(bad.valid);
      await expect(create).toBeEnabled();
      await expect(summary).toHaveText(SUMMARY_RE);
      await expect(summary).not.toHaveClass(/sev-error/);
      await createFromWizard(page);
      await expect(statusOf(page)).toHaveText(bad.status);
      if (bad.airfoil) {
        const select = page.getByRole('combobox', { name: `Airfoil of section ${bad.field.startsWith('Root') ? 1 : 2}`, exact: true });
        await expect(select.locator('option:checked')).toHaveText(bad.airfoil);
      }
    });
  }

  test('several invalid inputs are all listed; choosing a preset resets them', async ({ page }) => {
    const wizard = await openFirstRun(page);
    const create = wizard.getByRole('button', { name: 'Create design' });
    const summary = summaryOf(wizard);
    await wizard.getByLabel('Span (both halves) (mm)').fill('10');
    await wizard.getByLabel('Taper (tip / root chord)').fill('3');
    await wizard.getByLabel('Root airfoil', { exact: true }).fill('XY 45');
    await expect(create).toBeDisabled();
    await expect(summary).toHaveText('span must be between 100 and 20000. taper must be between 0.1 and 1.5. rootAirfoil must be a NACA 4- or 5-digit designation or the name of a Library airfoil, e.g. MH 45.');

    // Selecting a preset replaces all values with valid ones.
    await pickPreset(wizard, 'Plank');
    await expect(wizard.getByLabel('Span (both halves) (mm)')).toHaveValue('1000');
    await expect(wizard.getByLabel('Taper (tip / root chord)')).toHaveValue('0.8');
    await expect(wizard.getByLabel('Root airfoil', { exact: true })).toHaveValue('MH 45');
    await expect(summary).toHaveText(SUMMARY_RE);
    await createFromWizard(page);
    // 1000 mm span, chords 220 -> 176 mm.
    await expect(statusOf(page)).toHaveText('Span 1000 mm · area 19.80 dm² · AR 5.05 · MAC 198.8 mm');
  });

  test('a fractional number of sections is rejected', async ({ page }) => {
    const wizard = await openFirstRun(page);
    const create = wizard.getByRole('button', { name: 'Create design' });
    const summary = summaryOf(wizard);
    await pickPreset(wizard, 'Sport');
    await wizard.getByLabel('Number of sections').fill('2.5');
    await expect(create).toBeDisabled();
    await expect(summary).toHaveText('sections must be an integer.');
    await expect(summary).toHaveClass(/sev-error/);

    await wizard.getByLabel('Number of sections').fill('3');
    await expect(summary).toHaveText(SUMMARY_RE);
    await createFromWizard(page);
    // Three sections evenly spaced along the half span; a section on a straight panel keeps the figures.
    expect((await sectionValues(page, ['y', 'chord'])).map((s) => [s.y, s.chord])).toEqual([
      [0, 240],
      [300, 192],
      [600, 144],
    ]);
    await expect(statusOf(page)).toHaveText(SPORT_STATUS);
  });

  test('sweep, dihedral and washout place and twist the tip section', async ({ page }) => {
    const wizard = await openFirstRun(page);
    await pickPreset(wizard, 'Sport');
    await wizard.getByLabel('Sweep of the 25 % line (deg)', { exact: true }).fill('10');
    await wizard.getByLabel('Dihedral per half (deg)', { exact: true }).fill('5');
    await wizard.getByLabel('Tip twist (negative = washout) (deg)', { exact: true }).fill('-3');
    await createFromWizard(page);

    // Tip leading edge: quarter-chord line 0.25 * 240 + 600 * tan 10° = 165.80, minus 0.25 * 144 mm;
    // height 600 * tan 5° = 52.49 mm; twist -3° at the tip only.
    expect(await sectionValues(page, ['y', 'x', 'z', 'chord', 'twist'])).toEqual([
      { y: 0, x: 0, z: 0, chord: 240, twist: 0 },
      { y: 600, x: 129.8, z: 52.49, chord: 144, twist: -3 },
    ]);
    // Sweep, dihedral and twist leave the planform figures unchanged.
    await expect(statusOf(page)).toHaveText(SPORT_STATUS);
  });

  test('a V-tail of 55 degrees per half builds; the field accepts -60 to 60 degrees; a short one that folds keeps Create disabled', async ({ page }) => {
    const wizard = await openFirstRun(page);
    await pickPreset(wizard, 'Tail surface');
    const dihedral = wizard.getByLabel('Dihedral per half (deg)', { exact: true });
    await expect(dihedral).toHaveAttribute('max', '60');
    await expect(dihedral).toHaveAttribute('min', '-60');
    await dihedral.fill('55');
    // 100 mm span with 8 sections: the next section lies 7.1 mm out from the vertical root, and the
    // mitred planes between them turn faster than the airfoils allow. The build error keeps Create off.
    const span = wizard.getByLabel('Span (both halves) (mm)');
    const sections = wizard.getByLabel('Number of sections');
    const create = wizard.getByRole('button', { name: 'Create design' });
    await span.fill('100');
    await sections.fill('8');
    await expect(create).toBeDisabled();
    await expect(summaryOf(wizard)).toHaveText(/^Sections 1 and 2: at y = 0\.0 mm the mitred section planes between them turn faster than the airfoils allow, so the surface folds\./);
    await span.fill('500');
    await sections.fill('2');
    await expect(create).toBeEnabled();
    await createFromWizard(page);
    // Tip 250 mm out and 250 * tan 55 = 357.04 mm up; mitred planes, no build error.
    expect(await sectionValues(page, ['y', 'z'])).toEqual([
      { y: 0, z: 0 },
      { y: 250, z: 357.04 },
    ]);
    await statusFigures(page, 500, { clean: true });
  });

  test('an empty project name falls back to "<span> mm wing"', async ({ page }) => {
    const wizard = await openFirstRun(page);
    await pickPreset(wizard, 'Sport');
    await wizard.getByRole('textbox', { name: 'Project name' }).fill('');
    await createFromWizard(page);
    await expect(toastOf(page)).toHaveText('Created "1200 mm wing".');
    await openTab(page, 'Settings');
    await expect(page.locator('#pane-settings').getByRole('textbox', { name: 'Project name' })).toHaveValue('1200 mm wing');

    const saved = await saveProject(page);
    expect(saved.name).toBe('1200_mm_wing.json');
    expect(JSON.parse(saved.bytes.toString('utf8')).name).toBe('1200 mm wing');
  });

  test('the planform preview is redrawn after a sweep edit', async ({ page }) => {
    const wizard = await openFirstRun(page);
    await pickPreset(wizard, 'Sport');
    const canvas = wizard.locator('canvas.wizard-canvas');
    /** Screenshot of the preview once two in a row agree. */
    const stableShot = async () => {
      let last = await canvas.screenshot();
      await expect
        .poll(async () => {
          const cur = await canvas.screenshot();
          const same = Buffer.compare(last, cur) === 0;
          last = cur;
          return same;
        })
        .toBe(true);
      return last;
    };
    const straight = await stableShot();

    await wizard.getByLabel('Sweep of the 25 % line (deg)', { exact: true }).fill('30');
    await expect(summaryOf(wizard)).toHaveText(SUMMARY_RE);
    await expect.poll(async () => Buffer.compare(straight, await canvas.screenshot()), { message: 'preview after sweep back' }).not.toBe(0);
    const swept = await stableShot();
    // Sweep forward draws yet another outline.
    await wizard.getByLabel('Sweep of the 25 % line (deg)', { exact: true }).fill('-30');
    await expect.poll(async () => Buffer.compare(swept, await canvas.screenshot()), { message: 'preview after sweep forward' }).not.toBe(0);
    expect(Buffer.compare(straight, await stableShot())).not.toBe(0);
  });

  test('elliptic planform with pointed tip shows the tip chord note in the Sections table', async ({ page }) => {
    const wizard = await openFirstRun(page);
    await pickPreset(wizard, 'Sport');
    await wizard.getByRole('combobox', { name: 'Planform', exact: true }).selectOption({ label: 'Elliptic (guide curves)' });
    await wizard.getByRole('combobox', { name: 'Tip', exact: true }).selectOption({ label: 'Pointed (1/200 scale)' });
    const preview = await summaryFigures(wizard);
    // Two sections: the tip profile is 1/200 of the root chord (240 mm).
    expect(preview.tipChord).toBe(1.2);

    await createFromWizard(page);
    // The converging guide curves close the tip without a warning.
    const fig = await statusFigures(page, 1200, { clean: true });
    expect(Math.abs(fig.area - preview.area)).toBeLessThanOrEqual(0.051);
    const rows = sectionRows(page);
    await expect(rows).toHaveCount(2);
    await expect(chordNote(page, 1)).toHaveText('tip: 1.20');
    // Only the tip row carries the note.
    await expect(chordNote(page, 0)).toHaveCount(0);

    // Elliptic planform switches on both guide curves.
    await openTab(page, 'Planform');
    await expect(page.getByRole('group', { name: /Nose line/ }).getByLabel('Use guide curve')).toBeChecked();
    await expect(page.getByRole('group', { name: /End line/ }).getByLabel('Use guide curve')).toBeChecked();

    // The note survives a reload (tip mode is part of the saved project).
    await page.reload();
    await openTab(page, 'Sections');
    await expect(chordNote(page, 1)).toHaveText('tip: 1.20');
    await expect(statusOf(page)).toHaveText(fig.text);
  });

  test('elliptic planform with pointed tip and more sections scales the tip from the previous section and is floored at 1 mm', async ({ page }) => {
    const wizard = await openFirstRun(page);
    await pickPreset(wizard, 'Glider');
    await wizard.getByRole('combobox', { name: 'Tip', exact: true }).selectOption('pointed');
    await expect(wizard.getByRole('combobox', { name: 'Planform', exact: true })).toHaveValue('elliptic');
    // 1/200 of the chord at the previous section (y = 500 mm, 173.21 mm) is 0.87 mm: raised to 1 mm.
    const preview = await summaryFigures(wizard);
    expect(preview.tipChord).toBe(1);
    await createFromWizard(page);
    // The converging guide curves close the tip without a warning; the figures are the previewed
    // ones (an elliptic 2000 x 200 mm planform: about 31.4 dm², AR 12.7).
    const fig = await statusFigures(page, 2000, { clean: true });
    expect(Math.abs(fig.area - preview.area)).toBeLessThanOrEqual(0.051);
    expect(fig.arText).toBe(preview.arText);
    expect(fig.macText).toBe(preview.macText);
    expect(Math.abs(fig.area - 31.4)).toBeLessThan(0.1);
    await expect(sectionRows(page)).toHaveCount(3);
    await expect(chordCell(page, 1).locator('input')).toHaveValue('173.21');
    await expect(chordNote(page, 2)).toHaveText('tip: 1.00 (min.)');
    await expect(chordNote(page, 2)).toHaveAttribute('title', 'Pointed tip: chord scaled from the previous section, at least 1 mm');
    for (const i of [0, 1]) await expect(chordCell(page, i)).not.toContainText('tip:');
  });

  test('straight planform with pointed tip also shows the tip chord note; flat tip does not', async ({ page }) => {
    const wizard = await openFirstRun(page);
    await pickPreset(wizard, 'Plank');
    await wizard.getByRole('combobox', { name: 'Tip', exact: true }).selectOption('pointed');
    await createFromWizard(page);
    await expect(sectionRows(page)).toHaveCount(2);
    // 1/200 of the 220 mm root chord.
    await expect(chordNote(page, 1)).toHaveText('tip: 1.10');

    // New design with the same preset but a flat tip: no note.
    await page.getByRole('button', { name: 'New' }).click();
    const again = dialogOf(page);
    await expect(again.getByRole('heading', { name: 'New wing design' })).toBeVisible();
    await pickPreset(again, 'Plank');
    await expect(again.getByRole('combobox', { name: 'Tip', exact: true })).toHaveValue('flat');
    await createFromWizard(page);
    await expect(chordCell(page, 1).locator('input')).toHaveValue('176');
    await expect(chordNote(page, 1)).toHaveCount(0);
    await expect(statusOf(page)).toHaveText('Span 1000 mm · area 19.80 dm² · AR 5.05 · MAC 198.8 mm');
  });

  test('elliptic planform needs taper < 1 unless the tip is pointed', async ({ page }) => {
    const wizard = await openFirstRun(page);
    const create = wizard.getByRole('button', { name: 'Create design' });
    const summary = summaryOf(wizard);
    await pickPreset(wizard, 'Trainer'); // taper 1
    await wizard.getByRole('combobox', { name: 'Planform', exact: true }).selectOption('elliptic');
    await expect(create).toBeDisabled();
    await expect(summary).toHaveText('An elliptic planform needs taper < 1.');

    // A pointed tip closes the planform regardless of the taper.
    await wizard.getByRole('combobox', { name: 'Tip', exact: true }).selectOption('pointed');
    await expect(create).toBeEnabled();
    const preview = await summaryFigures(wizard);
    await createFromWizard(page);
    // The converging guide curves close the tip without a warning.
    const fig = await statusFigures(page, 1400, { clean: true });
    expect(Math.abs(fig.area - preview.area)).toBeLessThanOrEqual(0.051);
    // 1/200 of the 250 mm root chord.
    await expect(chordNote(page, 1)).toHaveText('tip: 1.25');
  });

  test('reloading while the first-run wizard is open shows the wizard again', async ({ page }) => {
    await openFirstRun(page);
    await page.reload();
    await expect(statusOf(page)).toHaveText(/^Span 1500 mm/);
    await expect(dialogOf(page).getByRole('heading', { name: 'Start a new wing design' })).toBeVisible({ timeout: 3000 });
  });

  test('"Skip (open sample wing)" opens the 1500 mm sample wing', async ({ page }) => {
    const wizard = await openFirstRun(page);
    // Change something first: skipping must ignore the wizard's values.
    await wizard.getByLabel('Span (both halves) (mm)').fill('3000');
    await wizard.getByRole('button', { name: 'Skip (open sample wing)' }).click();
    await expect(dialogOf(page)).toHaveCount(0);
    // Sample wing: chords 240 / 205 / 130 mm at y = 0 / 450 / 750 mm.
    const SAMPLE_STATUS = 'Span 1500 mm · area 30.07 dm² · AR 7.48 · MAC 205.4 mm';
    await expect(statusOf(page)).toHaveText(SAMPLE_STATUS);
    expect(await sectionValues(page, ['y', 'chord'])).toEqual([
      { y: 0, chord: 240 },
      { y: 450, chord: 205 },
      { y: 750, chord: 130 },
    ]);

    // The sample is kept after a reload and the first-run wizard does not come back.
    await page.reload();
    await expect(sectionRows(page)).toHaveCount(3);
    await expect(dialogOf(page)).toHaveCount(0);
    await expect(statusOf(page)).toHaveText(SAMPLE_STATUS);
  });

  test('New reopens the wizard; Cancel keeps the current design', async ({ page }) => {
    const wizard = await openFirstRun(page);
    await pickPreset(wizard, 'Plank');
    await createFromWizard(page);
    const beforeStatus = 'Span 1000 mm · area 19.80 dm² · AR 5.05 · MAC 198.8 mm';
    await expect(statusOf(page)).toHaveText(beforeStatus);
    await expect(sectionRows(page)).toHaveCount(2);
    const undo = page.getByRole('button', { name: 'Undo' });
    await expect(undo).toBeEnabled();

    await page.getByRole('button', { name: 'New' }).click();
    const again = dialogOf(page);
    await expect(again.getByRole('heading', { name: 'New wing design' })).toBeVisible();
    await expect(again.getByRole('button', { name: 'Skip (open sample wing)' })).toHaveCount(0);
    // Change the wizard values, then cancel.
    await pickPreset(again, 'Glider');
    await again.getByLabel('Span (both halves) (mm)').fill('3000');
    await expect(summaryOf(again)).toHaveText(SUMMARY_RE);
    await again.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialogOf(page)).toHaveCount(0);

    await expect(statusOf(page)).toHaveText(beforeStatus);
    await expect(sectionRows(page)).toHaveCount(2);
    await expect(chordCell(page, 0).locator('input')).toHaveValue('220');

    // Escape closes the wizard without changes as well.
    await page.getByRole('button', { name: 'New' }).click();
    await expect(dialogOf(page).getByRole('heading', { name: 'New wing design' })).toBeVisible();
    await pickPreset(dialogOf(page), 'Trainer');
    await page.keyboard.press('Escape');
    await expect(dialogOf(page)).toHaveCount(0);
    await expect(statusOf(page)).toHaveText(beforeStatus);
    await expect(chordCell(page, 0).locator('input')).toHaveValue('220');

    // The autosaved project is still the Plank design.
    await page.reload();
    await expect(dialogOf(page)).toHaveCount(0);
    await expect(statusOf(page)).toHaveText(beforeStatus);
    await expect(sectionRows(page)).toHaveCount(2);
  });

  test('New then Create replaces the design with its project name; Undo restores the previous design', async ({ page }) => {
    const wizard = await openFirstRun(page);
    await pickPreset(wizard, 'Tail surface');
    await createFromWizard(page);
    const tail = await statusFigures(page, 500, { clean: true });
    // 500 mm span, chords 130 -> 91 mm.
    expect(Math.abs(tail.area - (500 * 130 * 1.7) / 2 / 1e4)).toBeLessThanOrEqual(0.006);

    await page.getByRole('button', { name: 'New' }).click();
    const again = dialogOf(page);
    await expect(again.getByRole('heading', { name: 'New wing design' })).toBeVisible();
    await pickPreset(again, 'Glider');
    await again.getByRole('textbox', { name: 'Project name' }).fill('My glider 2m');
    await again.getByLabel('Number of sections').fill('4');
    const preview = await summaryFigures(again);
    await createFromWizard(page);
    const glider = await statusFigures(page, 2000, { clean: true });
    expect(Math.abs(glider.area - preview.area)).toBeLessThanOrEqual(0.051);
    await expect(sectionRows(page)).toHaveCount(4);

    // The saved project file carries the typed name and the wizard geometry.
    const saved = await saveProject(page);
    expect(saved.name).toBe('My_glider_2m.json');
    const json = JSON.parse(saved.bytes.toString('utf8'));
    expect(json.name).toBe('My glider 2m');
    expect(json.sections.map((s) => s.y)).toEqual([0, 333.33, 666.67, 1000]);
    expect(json.guides.nose.enabled).toBe(true);
    expect(json.guides.end.enabled).toBe(true);
    expect(json.airfoils.map((a) => a.id)).toEqual(['mh-42']);

    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(statusOf(page)).toHaveText(tail.text);
    await expect(sectionRows(page)).toHaveCount(2);
  });

  test('pressing Enter in a wizard field creates the design with the entered value', async ({ page }) => {
    const wizard = await openFirstRun(page);
    await pickPreset(wizard, 'Sport');
    const span = wizard.getByLabel('Span (both halves) (mm)');
    await span.fill('1800');
    await expect(summaryOf(wizard)).toHaveText(SUMMARY_RE);
    await span.press('Enter');
    await expect(dialogOf(page)).toHaveCount(0);
    // Sport shape at 1800 mm span: 2 * 900 * (240 + 144) / 2 mm².
    await expect(statusOf(page)).toHaveText('Span 1800 mm · area 34.56 dm² · AR 9.38 · MAC 196.0 mm');
  });
});
