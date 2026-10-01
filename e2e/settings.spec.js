// Settings tab: trailing-edge modes, pointed wing tip, its scale and the 1 mm tip chord floor,
// spanwise interpolation, chordwise resolution, twist pivot, part tilt and roll, the mirrored-half display, project
// name (export file names) and persistence across reloads.
//
// Wizard designs used here (src/model/wizard.js): "Sport" has 2 sections (root chord 240 mm, tip
// 144 mm, NACA 2412/2410), "Swept flying wing" has 3 sections (280 / 203 / 126 mm). Both start
// with a fixed trailing-edge thickness of rootChord * 0.002 (at least 0.3 mm) and a flat tip.
// The loft has 2 * chordSamples + 1 control points around the profile (default 60 -> 121).
import {
  STATUS_RE,
  checksValue,
  chordNote,
  commit,
  createDesign,
  expect,
  exportFile,
  frames,
  openTab,
  parseStl,
  saveProject,
  savedProject,
  sectionField,
  sectionRows as rows,
  statusFigures as figures,
  statusOf as status,
  stlVertices,
  test,
} from './helpers.js';

// Settings controls.
const teMode = (page) => page.getByRole('combobox', { name: 'Trailing edge mode', exact: true });
const teThickness = (page) => page.getByRole('spinbutton', { name: /^Trailing-edge thickness \(mm\)/ });
const tipMode = (page) => page.getByRole('combobox', { name: 'Wing tip', exact: true });
const tipScale = (page) => page.getByRole('spinbutton', { name: /^Tip profile scale 1 : N/ });
const spanwise = (page) => page.getByRole('combobox', { name: 'Spanwise interpolation', exact: true });
const sectionPlanes = (page) => page.getByRole('combobox', { name: 'Section planes', exact: true });
const loftNote = (page) => page.locator('#pane-settings p.small').filter({ hasText: /^Loft grid/ });
const chordStations = (page) => page.getByRole('spinbutton', { name: /^Chordwise stations per surface/ });
const panelStations = (page) => page.getByRole('spinbutton', { name: /^Spanwise stations per panel/ });
const twistPivot = (page) => page.getByRole('spinbutton', { name: /^Twist pivot/ });
const partTilt = (page) => page.getByRole('spinbutton', { name: /^Part tilt/ });
const partRoll = (page) => page.getByRole('spinbutton', { name: /^Part roll/ });
const leftHalf = (page) => page.getByRole('combobox', { name: 'Left half', exact: true });
const pivotLine = (page) => page.locator('#pane-settings p.small').filter({ hasText: /^The part turns/ });
const parametrization = (page) => page.getByRole('combobox', { name: 'Profile parametrization', exact: true });
const mirror = (page) => page.getByRole('checkbox', { name: 'Show mirrored half (y < 0)' });
const projectName = (page) => page.locator('#pane-settings').getByRole('textbox', { name: 'Project name' });
const planformGroup = (page, name) => page.locator('#pane-planform').getByRole('group', { name });

/** Pick an option of a select and wait for the resulting rebuild. */
async function choose(select, option) {
  const page = select.page();
  await frames(page);
  await select.selectOption(option);
  await frames(page);
}

/** Root and tip chord in mm from the Checks tab ("280.0 / 126.0 mm"). */
async function rootTipChord(page) {
  const cell = checksValue(page, 'Root / tip chord');
  await expect(cell).toHaveText(/^[\d.]+ \/ [\d.]+ mm$/);
  const [root, tip] = (await cell.innerText()).match(/[\d.]+/g).map(Number);
  return { root, tip };
}

/** Parse "tip: 1.23" (optionally followed by a qualifier) from a chord note. */
async function tipNoteValue(page, row) {
  const note = chordNote(page, row);
  await expect(note).toHaveText(/^tip: \d+\.\d\d/);
  return Number((await note.innerText()).match(/^tip: (\d+\.\d\d)/)[1]);
}

const surfaceRe = (degV, nu, nv = '\\d+') => new RegExp(`^degree 3 x ${degV}, ${nu} x ${nv} control points$`);
const SPORT_STATUS = 'Span 1200 mm · area 23.04 dm² · AR 6.25 · MAC 196.0 mm';
const FLOOR_TITLE = 'Pointed tip: chord scaled from the previous section, at least 1 mm';

test.describe('Settings tab', () => {
  test('trailing-edge modes switch the Checks trailing edge between open and closed', async ({ page }) => {
    await createDesign(page, 'Sport');
    const before = await figures(page);

    await openTab(page, 'Checks');
    await expect(checksValue(page, 'Trailing edge')).toHaveText('open');

    await openTab(page, 'Settings');
    // The wizard sets a fixed thickness of 240 mm * 0.002 = 0.48 mm.
    await expect(teMode(page)).toHaveValue('thickness');
    await expect(teThickness(page)).toHaveValue('0.48');

    // Closed: sharp trailing edge; the thickness field disappears.
    await choose(teMode(page), { label: 'Closed (sharp)' });
    await expect(teThickness(page)).toHaveCount(0);
    await openTab(page, 'Checks');
    await expect(checksValue(page, 'Trailing edge')).toHaveText('closed');
    await expect.poll(async () => (await savedProject(page)).settings.trailingEdge.mode).toBe('closed');
    // The trailing edge does not change the planform.
    expect(await figures(page)).toEqual(before);

    // As in the airfoil files: the NACA 4-digit equations leave a finite trailing-edge gap.
    await openTab(page, 'Settings');
    await choose(teMode(page), { label: 'As in the airfoil files' });
    await expect(teThickness(page)).toHaveCount(0);
    await openTab(page, 'Checks');
    await expect(checksValue(page, 'Trailing edge')).toHaveText('open');
    await expect.poll(async () => (await savedProject(page)).settings.trailingEdge.mode).toBe('asis');

    // Fixed thickness again: the field comes back with the kept value; 0 mm closes the edge.
    await openTab(page, 'Settings');
    await choose(teMode(page), { label: 'Fixed thickness in mm' });
    await expect(teThickness(page)).toHaveValue('0.48');
    await openTab(page, 'Checks');
    await expect(checksValue(page, 'Trailing edge')).toHaveText('open');

    await openTab(page, 'Settings');
    await commit(teThickness(page), 0);
    await expect(teThickness(page)).toHaveValue('0');
    await openTab(page, 'Checks');
    await expect(checksValue(page, 'Trailing edge')).toHaveText('closed');

    // A negative thickness is clamped to 0 (still closed), a positive one opens the edge again.
    await openTab(page, 'Settings');
    await commit(teThickness(page), -2);
    await expect(teThickness(page)).toHaveValue('0');
    await expect.poll(async () => (await savedProject(page)).settings.trailingEdge.thickness).toBe(0);
    await commit(teThickness(page), 0.8);
    await expect(teThickness(page)).toHaveValue('0.8');
    await openTab(page, 'Checks');
    await expect(checksValue(page, 'Trailing edge')).toHaveText('open');

    // Undo steps back through the thickness edits; the clamped -2 left the project as it was and
    // added no step.
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(checksValue(page, 'Trailing edge')).toHaveText('closed');
    await openTab(page, 'Settings');
    await expect(teThickness(page)).toHaveValue('0');
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(teThickness(page)).toHaveValue('0.48');

    expect(await figures(page)).toEqual(before);
  });

  test('pointed wing tip shows the scale field and a tip note under the last chord', async ({ page }) => {
    await createDesign(page, 'Swept flying wing');
    const flat = await figures(page);
    expect(flat.span).toBe(1200);

    // Flat tip: no scale field, no tip note, tip chord as in the table.
    await expect(rows(page)).toHaveCount(3);
    await expect(page.locator('table.sections').getByText(/^tip:/)).toHaveCount(0);
    const prevChord = Number(await sectionField(page, 1, 'chord').inputValue());
    const lastChord = sectionField(page, 2, 'chord');
    expect(prevChord).toBe(203);
    await expect(lastChord).toHaveValue('126');
    await openTab(page, 'Checks');
    expect(await rootTipChord(page)).toEqual({ root: 280, tip: 126 });

    await openTab(page, 'Settings');
    await expect(tipMode(page)).toHaveValue('flat');
    await expect(tipScale(page)).toHaveCount(0);

    // Pointed: the scale field appears with the default 1 : 200.
    await choose(tipMode(page), { label: 'Pointed (tip profile scaled down)' });
    await expect(tipScale(page)).toBeVisible();
    await expect(tipScale(page)).toHaveValue('200');
    await expect.poll(async () => (await savedProject(page)).settings.tip).toEqual({ mode: 'pointed', ratio: 0.005 });

    // The status bar keeps showing key figures, no errors or warnings; the pointed tip reduces the area.
    const pointed = await figures(page, 1200, { clean: true });
    expect(pointed.area).toBeLessThan(flat.area);
    expect(pointed.ar).toBeGreaterThan(flat.ar);

    // Sections: the last row gets a "tip:" note with the previous section chord / 200 (1.015 mm,
    // above the 1 mm floor); the stored chord of the last section stays as entered, the other rows
    // get no note.
    await openTab(page, 'Sections');
    expect(Math.abs((await tipNoteValue(page, 2)) - prevChord / 200)).toBeLessThanOrEqual(0.006);
    await expect(chordNote(page, 0)).toHaveCount(0);
    await expect(chordNote(page, 1)).toHaveCount(0);
    await expect(lastChord).toHaveValue('126');
    await openTab(page, 'Checks');
    const rt = await rootTipChord(page);
    expect(rt.root).toBe(280);
    expect(Math.abs(rt.tip - prevChord / 200)).toBeLessThanOrEqual(0.051);
    await expect(page.locator('#pane-checks .sev-error')).toHaveCount(0);

    // Scale 1 : 100 doubles the tip chord.
    await openTab(page, 'Settings');
    await commit(tipScale(page), 100);
    await expect(tipScale(page)).toHaveValue('100');
    await openTab(page, 'Sections');
    await expect(chordNote(page, 2)).toHaveText(`tip: ${(prevChord / 100).toFixed(2)}`);
    await openTab(page, 'Checks');
    expect(await rootTipChord(page)).toEqual({ root: 280, tip: Number((prevChord / 100).toFixed(1)) });
    const scaled = await figures(page);
    expect(scaled.area).toBeGreaterThan(pointed.area);
    expect(scaled.area).toBeLessThan(flat.area);

    // Back to flat: the field and the note disappear and the original figures return.
    await openTab(page, 'Settings');
    await choose(tipMode(page), { label: 'Flat (cut at the tip section)' });
    await expect(tipScale(page)).toHaveCount(0);
    await openTab(page, 'Sections');
    await expect(page.locator('table.sections').getByText(/^tip:/)).toHaveCount(0);
    expect(await figures(page)).toEqual(flat);
    // The chosen ratio is kept for the next switch to pointed.
    await expect.poll(async () => (await savedProject(page)).settings.tip).toEqual({ mode: 'flat', ratio: 0.01 });
  });

  test('a tip below 1 mm is raised to the 1 mm floor', async ({ page }) => {
    await createDesign(page, 'Sport');
    await openTab(page, 'Settings');
    await choose(tipMode(page), 'pointed');
    // 1/1000 of the 240 mm root chord is 0.24 mm, below the 1 mm floor.
    await commit(tipScale(page), 1000);
    await expect(tipScale(page)).toHaveValue('1000');
    await expect.poll(async () => (await savedProject(page)).settings.tip).toEqual({ mode: 'pointed', ratio: 0.001 });
    await openTab(page, 'Sections');
    await expect(chordNote(page, 1)).toHaveText('tip: 1.00 (min.)');
    await expect(chordNote(page, 1)).toHaveAttribute('title', FLOOR_TITLE);
    await expect(status(page)).toHaveText('Span 1200 mm · area 14.46 dm² · AR 9.96 · MAC 160.0 mm');
    await expect(status(page)).not.toHaveClass(/has-error/);
    await openTab(page, 'Checks');
    await expect(checksValue(page, 'Root / tip chord')).toHaveText('240.0 / 1.0 mm');
    await expect(page.locator('#pane-checks')).toContainText('No errors or warnings.');

    // 1 : 200 gives 1.2 mm, above the floor: no "(min.)".
    await openTab(page, 'Settings');
    await commit(tipScale(page), 200);
    await openTab(page, 'Sections');
    await expect(chordNote(page, 1)).toHaveText('tip: 1.20');
  });

  test('flat tip with meeting guide lines suggests Pointed; Pointed resolves it', async ({ page }) => {
    await createDesign(page, 'Sport');
    await openTab(page, 'Planform');
    const end = planformGroup(page, 'End line (trailing edge)');
    await planformGroup(page, 'Nose line (leading edge)').getByRole('checkbox', { name: 'Use guide curve' }).check();
    await end.getByRole('checkbox', { name: 'Use guide curve' }).check();
    await expect(end.locator('tbody tr')).toHaveCount(2);
    await expect(status(page)).toHaveText(SPORT_STATUS);
    // The end line ends on the nose line (x = 24 at the tip): a zero chord at the flat tip.
    await commit(end.locator('tbody tr').nth(1).getByRole('spinbutton'), 24);
    const zeroChord =
      '1 error(s): Chord drops to 0.00 mm at y = 600.0 mm; nose line and end line must not touch or cross. For a tip that ends in a point, set Settings > Wing tip to Pointed.';
    await expect(status(page)).toHaveText(zeroChord);
    await expect(status(page)).toHaveClass(/has-error/);

    // Pointed: the guides end in the 1.2 mm tip profile (240 / 200).
    await openTab(page, 'Settings');
    await choose(tipMode(page), 'pointed');
    await expect(status(page)).toHaveText('Span 1200 mm · area 14.40 dm² · AR 10.00 · MAC 160.0 mm');
    await expect(status(page)).not.toHaveClass(/has-error/);
    await openTab(page, 'Sections');
    await expect(chordNote(page, 1)).toHaveText('tip: 1.20');

    // Undo returns to the flat tip: the error comes back, the note goes.
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(status(page)).toHaveText(zeroChord);
    await expect(chordNote(page, 1)).toHaveCount(0);
    await expect.poll(async () => (await savedProject(page)).settings.tip.mode).toBe('flat');
  });

  test('wizard pointed tip opens with the pointed tip setting at 1 : 200', async ({ page }) => {
    await createDesign(page, 'Sport', { tip: 'pointed' });
    // Two straight panels converge to the 1.2 mm tip (240 mm / 200).
    await expect(status(page)).toHaveText('Span 1200 mm · area 14.47 dm² · AR 9.95 · MAC 160.0 mm');
    await expect(chordNote(page, 1)).toHaveText('tip: 1.20');
    await openTab(page, 'Settings');
    await expect(tipMode(page)).toHaveValue('pointed');
    await expect(tipScale(page)).toHaveValue('200');
  });

  test('pointed tip with guide curves that do not meet: the tip note matches the built tip chord', async ({ page }) => {
    await createDesign(page, 'Glider');
    await openTab(page, 'Settings');
    await choose(tipMode(page), 'pointed');
    // The guides end 90 mm apart, so the tip stays open: a warning, no error.
    await expect(status(page)).toHaveText(/^Span 2000 mm · area [\d.]+ dm² · AR [\d.]+ · MAC [\d.]+ mm · 1 warning\(s\)$/);
    await openTab(page, 'Checks');
    await expect(page.locator('#pane-checks .sev-warning')).toHaveText(
      'Warning: Pointed tip: nose line and end line end 90.0 mm apart, so the tip chord is 90.0 mm instead of 1.00 mm; move their last points together to close the tip.',
    );
    await expect(checksValue(page, 'Root / tip chord')).toHaveText('200.0 / 90.0 mm');
    await openTab(page, 'Sections');
    // The note under the last chord describes the tip of the built wing.
    await expect(chordNote(page, 2)).toHaveText('tip: 90.00');
  });

  test('tip scale input clamps to 100..1000; below 1 mm the floor applies', async ({ page }) => {
    // Root chord 1200 mm keeps every scaled tip chord (1200 / N) at 1.2 mm or more.
    await createDesign(page, 'Sport', { fields: { 'Root chord (mm)': 1200 } });
    await openTab(page, 'Settings');
    await choose(tipMode(page), 'pointed');
    await expect(tipScale(page)).toHaveValue('200');
    await expect(tipScale(page)).toHaveAttribute('min', '100');
    await expect(tipScale(page)).toHaveAttribute('max', '1000');

    const cases = [
      // [typed, shown, tip chord note, saved ratio]
      ['50', '100', 'tip: 12.00', 1 / 100],
      ['5000', '1000', 'tip: 1.20', 1 / 1000],
      ['99', '100', 'tip: 12.00', 1 / 100],
      ['1001', '1000', 'tip: 1.20', 1 / 1000],
      ['-300', '100', 'tip: 12.00', 1 / 100],
      ['250.4', '250', 'tip: 4.80', 1 / 250],
      ['400', '400', 'tip: 3.00', 1 / 400],
      ['1000', '1000', 'tip: 1.20', 1 / 1000],
    ];
    for (const [typed, shown, note, ratio] of cases) {
      await openTab(page, 'Settings');
      await commit(tipScale(page), typed);
      await expect(tipScale(page), `typed ${typed}`).toHaveValue(shown);
      await expect.poll(async () => (await savedProject(page)).settings.tip.ratio, { message: `typed ${typed}` }).toBeCloseTo(ratio, 12);
      await openTab(page, 'Sections');
      await expect(chordNote(page, 1), `typed ${typed}`).toHaveText(note);
      await figures(page);
    }

    // A 600 mm root chord at 1 : 1000 gives 0.6 mm: raised to the 1 mm floor.
    await commit(sectionField(page, 0, 'chord'), 600);
    await expect(chordNote(page, 1)).toHaveText('tip: 1.00 (min.)');
    await expect(chordNote(page, 1)).toHaveAttribute('title', FLOOR_TITLE);
    await openTab(page, 'Checks');
    await expect(checksValue(page, 'Root / tip chord')).toHaveText('600.0 / 1.0 mm');
  });

  test('smooth spanwise interpolation makes the surface cubic in span direction', async ({ page }) => {
    await createDesign(page, 'Sport');
    const linear = await figures(page);
    // Vertical section planes: the linear panel has no stations between its sections.
    await openTab(page, 'Settings');
    await choose(sectionPlanes(page), 'vertical');
    await openTab(page, 'Checks');
    // Linear: one straight panel, 2 stations.
    await expect(checksValue(page, 'Surface')).toHaveText(surfaceRe(1, 121, 2));

    await openTab(page, 'Settings');
    await expect(spanwise(page)).toHaveValue('linear');
    await expect(panelStations(page)).toHaveValue('8');
    await choose(spanwise(page), { label: 'Smooth (natural cubic spline through sections)' });
    await openTab(page, 'Checks');
    // Smooth: cubic spline in v through 8 stations per panel + the tip station.
    await expect(checksValue(page, 'Surface')).toHaveText(surfaceRe(3, 121, 9));
    await expect.poll(async () => (await savedProject(page)).settings.spanwise).toBe('smooth');
    // With two sections the smooth blend is still linear: same planform figures.
    expect(await figures(page)).toEqual(linear);

    // Spanwise stations per panel apply in smooth mode, clamped to 3..40.
    await openTab(page, 'Settings');
    await commit(panelStations(page), 12);
    await expect(panelStations(page)).toHaveValue('12');
    await openTab(page, 'Checks');
    await expect(checksValue(page, 'Surface')).toHaveText(surfaceRe(3, 121, 13));
    await openTab(page, 'Settings');
    await commit(panelStations(page), 1);
    await expect(panelStations(page)).toHaveValue('3');
    await openTab(page, 'Checks');
    await expect(checksValue(page, 'Surface')).toHaveText(surfaceRe(3, 121, 4));

    // Back to linear: degree 1 in span direction again.
    await openTab(page, 'Settings');
    await choose(spanwise(page), 'linear');
    await openTab(page, 'Checks');
    await expect(checksValue(page, 'Surface')).toHaveText(surfaceRe(1, 121, 2));
    expect(await figures(page)).toEqual(linear);
  });

  test('section planes: mitred by default with stations in the panel, vertical on choice; Smooth builds vertical with an info line', async ({ page }) => {
    await createDesign(page, 'Sport');
    await openTab(page, 'Settings');
    await expect(sectionPlanes(page)).toHaveValue('mitred');
    // 1.5° dihedral: the root plane is vertical, the tip plane rolled 1.5°, so the panel gets 8 stations.
    await expect(loftNote(page)).toHaveText('Loft grid: 1,089 points.');
    await openTab(page, 'Checks');
    await expect(checksValue(page, 'Surface')).toHaveText(surfaceRe(3, 121, 9));
    await expect(page.locator('#pane-checks li.sev-info')).toHaveCount(0);
    const tipOf = async () => {
      const vs = stlVertices(parseStl((await exportFile(page, 'stl', { half: 'right' })).bytes).tris);
      const ys = vs.map((p) => p[1]);
      return [Math.min(...ys), Math.max(...ys)];
    };
    // The mitred tip leans past y = 600 at its lower surface; the vertical tip ends there.
    const [rootMitred, tipMitred] = await tipOf();
    expect(rootMitred).toBe(0);
    expect(tipMitred > 600.1 && tipMitred < 600.2, `mitred tip reaches y = ${tipMitred}`).toBe(true);

    await openTab(page, 'Settings');
    await choose(sectionPlanes(page), 'vertical');
    await expect.poll(async () => (await savedProject(page)).settings.sectionPlanes).toBe('vertical');
    await expect(loftNote(page)).toHaveText('Loft grid: 242 points.');
    await openTab(page, 'Checks');
    await expect(checksValue(page, 'Surface')).toHaveText(surfaceRe(1, 121, 2));
    const [, tipVertical] = await tipOf();
    expect(Math.abs(tipVertical - 600)).toBeLessThan(1e-3);

    // Smooth with mitred planes builds vertical planes and says so; the error and warning count stays 0.
    await openTab(page, 'Settings');
    await choose(sectionPlanes(page), 'mitred');
    await choose(spanwise(page), 'smooth');
    await openTab(page, 'Checks');
    await expect(page.locator('#pane-checks li.sev-info')).toHaveText(['Info: Smooth spanwise interpolation builds vertical section planes; mitred section planes need Linear or Straight panels.']);
    await expect(checksValue(page, 'Surface')).toHaveText(surfaceRe(3, 121, 9));
    const [, tipSmooth] = await tipOf();
    expect(Math.abs(tipSmooth - 600)).toBeLessThan(1e-3);
    await expect(status(page)).toHaveText(STATUS_RE);
  });

  test('chordwise stations 16 and 200 change the control point count', async ({ page }) => {
    await createDesign(page, 'Sport');
    const before = await figures(page);
    await openTab(page, 'Checks');
    // Mitred section planes of different roll: 8 stations in the panel plus the tip, cubic in span.
    await expect(checksValue(page, 'Surface')).toHaveText(surfaceRe(3, 121, 9));

    for (const [typed, shown, count] of [
      ['16', '16', 33],
      ['200', '200', 401],
      ['8', '16', 33],
      ['500', '200', 401],
      ['60', '60', 121],
    ]) {
      await openTab(page, 'Settings');
      await commit(chordStations(page), typed);
      await expect(chordStations(page), `typed ${typed}`).toHaveValue(shown);
      await openTab(page, 'Checks');
      await expect(checksValue(page, 'Surface'), `typed ${typed}`).toHaveText(surfaceRe(3, count, 9));
      await expect.poll(async () => (await savedProject(page)).settings.chordSamples).toBe(Number(shown));
      // The resolution does not change the planform.
      expect(await figures(page)).toEqual(before);
    }
  });

  test('twist pivot 0 and 1 turn the twisted tip about its leading or trailing edge', async ({ page }) => {
    await createDesign(page, 'Sport');
    await openTab(page, 'Settings');
    // Vertical section planes: the tip lies in the plane y = 600.
    await choose(sectionPlanes(page), 'vertical');
    await expect(twistPivot(page)).toHaveValue('0.25');
    /** Vertices of the exported right half at the root (y = 0) and at the tip (y = 600). */
    const exportedEnds = async () => {
      const vs = stlVertices(parseStl((await exportFile(page, 'stl', { half: 'right' })).bytes).tris);
      const at = (y) => vs.filter((p) => Math.abs(p[1] - y) < 1e-3).sort((a, b) => a[0] - b[0] || a[2] - b[2]);
      return { root: at(0), tip: at(600) };
    };
    const ends = {};
    for (const pivot of [0, 1]) {
      await openTab(page, 'Settings');
      await commit(twistPivot(page), pivot);
      await expect.poll(async () => (await savedProject(page)).settings.twistPivot).toBe(pivot);
      ends[pivot] = await exportedEnds();
    }
    // The untwisted root is the same; the tip (twist -1°, chord 144 mm, leading edge x 24, z 15.71)
    // turns about another point.
    expect(ends[1].root).toHaveLength(ends[0].root.length);
    const rootShift = Math.max(...ends[0].root.map((p, i) => Math.max(...p.map((c, k) => Math.abs(c - ends[1].root[i][k])))));
    expect(rootShift, 'largest root vertex difference (mm)').toBeLessThan(1e-4);
    expect(ends[0].tip).toHaveLength(ends[1].tip.length);
    const [le0, le1] = [ends[0].tip[0], ends[1].tip[0]];
    const [te0, te1] = [ends[0].tip.at(-1), ends[1].tip.at(-1)];
    const drop = 144 * Math.sin(Math.PI / 180);
    // Pivot 0: the leading edge stays at (24, 15.71) and the trailing edge rises.
    expect(Math.abs(le0[0] - 24)).toBeLessThan(1e-3);
    expect(Math.abs(le0[2] - 15.71)).toBeLessThan(1e-3);
    // Pivot 1: the trailing edge stays and the leading edge drops by 144 mm * sin 1°.
    expect(Math.abs(le1[0] - (24 + 144 * (1 - Math.cos(Math.PI / 180))))).toBeLessThan(1e-3);
    expect(Math.abs(le1[2] - (15.71 - drop))).toBeLessThan(1e-3);
    expect(Math.abs(te0[2] - te1[2] - drop)).toBeLessThan(0.01);
    // The planform figures do not depend on the pivot.
    await expect(status(page)).toHaveText(SPORT_STATUS);
  });

  test('part tilt and roll turn the whole part about the root leading edge; the fields clamp to ±180°; Undo', async ({ page }) => {
    await createDesign(page, 'Sport');
    await openTab(page, 'Settings');
    await choose(sectionPlanes(page), 'vertical');
    await expect(partTilt(page)).toHaveValue('0');
    await expect(partRoll(page)).toHaveValue('0');
    await expect(pivotLine(page)).toHaveText(
      'The part turns as a rigid body about the leading edge of the root section (x = 0.0 mm, y = 0.0 mm, z = 0.0 mm): first the roll about the x axis, then the tilt about the y axis.',
    );
    const tipOf = async () => {
      const vs = stlVertices(parseStl((await exportFile(page, 'stl', { half: 'right' })).bytes).tris);
      return vs.filter((p) => Math.abs(p[1] - 600) < 1e-3);
    };
    const flat = await tipOf();

    // Tilt 10°: every tip vertex turns about the y axis through the root leading edge, y stays 600.
    await openTab(page, 'Settings');
    await commit(partTilt(page), 10);
    await expect.poll(async () => (await savedProject(page)).settings.partTilt).toBe(10);
    const t = (10 * Math.PI) / 180;
    const turned = flat.map(([x, y, z]) => [x * Math.cos(t) + z * Math.sin(t), y, -x * Math.sin(t) + z * Math.cos(t)]);
    const tilted = await tipOf();
    expect(tilted).toHaveLength(turned.length);
    const gap = Math.max(...turned.map((p) => Math.min(...tilted.map((q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])))));
    expect(gap, 'largest distance of a turned tip vertex from the export (mm)').toBeLessThan(1e-3);
    // The tilt keeps the span; area and MAC lie in the part frame.
    await expect(status(page)).toHaveText(SPORT_STATUS);

    // Roll 30°: the tip leading edge (24, 600, 15.71) moves to y = 600 cos 30° - 15.71 sin 30° = 511.76 mm,
    // so the span is 1023.5 mm and the aspect ratio 1023.5² / 230400 mm² = 4.55.
    await openTab(page, 'Settings');
    await commit(partRoll(page), 30);
    await expect(status(page)).toHaveText('Span 1024 mm · area 23.04 dm² · AR 4.55 · MAC 196.0 mm');

    // Entries beyond ±180° clamp.
    await commit(partRoll(page), 200);
    await expect(partRoll(page)).toHaveValue('180');
    await commit(partTilt(page), -400);
    await expect(partTilt(page)).toHaveValue('-180');
    await expect.poll(async () => (await savedProject(page)).settings).toMatchObject({ partTilt: -180, partRoll: 180, partPivot: null });

    // Undo steps back through the edits.
    for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Undo' }).click();
    await expect(partTilt(page)).toHaveValue('10');
    await expect(partRoll(page)).toHaveValue('0');
    await expect(status(page)).toHaveText(SPORT_STATUS);
  });

  test('"Show mirrored half" changes the view only, not the key figures', async ({ page }) => {
    await createDesign(page, 'Swept flying wing');
    const both = await figures(page, 1200, { clean: true });
    await openTab(page, 'Checks');
    const stats = await page.locator('#pane-checks table.stats').textContent();
    await openTab(page, 'Settings');
    await mirror(page).uncheck();
    await expect.poll(async () => (await savedProject(page)).settings.mirror).toBe(false);
    await frames(page);
    await expect(status(page)).toHaveText(both.text);
    await openTab(page, 'Checks');
    await expect(page.locator('#pane-checks table.stats')).toHaveText(stats);
    await expect(checksValue(page, 'Span')).toHaveText('1200.0 mm');
  });

  test('project name edit changes the exported file names', async ({ page }) => {
    await createDesign(page, 'Sport');
    await openTab(page, 'Settings');
    await expect(projectName(page)).toHaveValue('Sport');

    const exportAs = async (format) => {
      const f = await exportFile(page, format);
      return { name: f.name, text: f.bytes.toString('latin1') };
    };

    // Typing a name and clicking Export right away (no Enter) commits the name on blur.
    await frames(page);
    await projectName(page).fill('Quick name');
    const quick = await exportAs('step');
    expect(quick.name).toBe('Quick_name.step');
    expect(quick.text).toContain("FILE_NAME('Quick name',");

    await openTab(page, 'Settings');
    // A name change rebuilds nothing: the Sections table keeps its fields.
    const sectionField = await page.locator('table.sections tbody tr input').first().elementHandle();
    await commit(projectName(page), 'My Wing 7');
    await expect.poll(async () => (await savedProject(page)).name).toBe('My Wing 7');
    await frames(page);
    expect(await sectionField.evaluate((e) => e.isConnected)).toBe(true);

    const step = await exportAs('step');
    expect(step.name).toBe('My_Wing_7.step');
    expect(step.text).toContain("FILE_NAME('My Wing 7',");
    expect(step.text).toContain("PRODUCT('My Wing 7','My Wing 7'");

    const stl = await exportAs('stl');
    expect(stl.name).toBe('My_Wing_7.stl');
    expect(stl.text.slice(0, 80)).toContain('Wingdesigner My Wing 7');

    const json = await exportAs('json');
    expect(json.name).toBe('My_Wing_7.json');
    expect(JSON.parse(json.text).name).toBe('My Wing 7');

    // German umlauts and ß are written out (ü → ue), other accents are dropped, other characters become "_".
    await openTab(page, 'Settings');
    await commit(projectName(page), 'Flügel / Nr. 2');
    await expect.poll(async () => (await savedProject(page)).name).toBe('Flügel / Nr. 2');
    const saved = await saveProject(page);
    expect(saved.name).toBe('Fluegel_Nr._2.json');
    expect(JSON.parse(saved.bytes.toString('utf8')).name).toBe('Flügel / Nr. 2');
    expect((await exportAs('3mf')).name).toBe('Fluegel_Nr._2.3mf');

    // An empty name falls back to "wing".
    await openTab(page, 'Settings');
    await commit(projectName(page), '');
    await expect.poll(async () => (await savedProject(page)).name).toBe('');
    expect((await saveProject(page)).name).toBe('wing.json');
    expect((await exportAs('step')).name).toBe('wing.step');
  });

  test('settings persist after reload', async ({ page }) => {
    await createDesign(page, 'Sport');
    await openTab(page, 'Settings');

    await commit(projectName(page), 'Persist test');
    await choose(sectionPlanes(page), 'vertical');
    await choose(spanwise(page), 'smooth');
    await commit(twistPivot(page), 0.3);
    await choose(teMode(page), 'closed');
    await choose(tipMode(page), 'pointed');
    await commit(tipScale(page), 150);
    await commit(chordStations(page), 16);
    await commit(panelStations(page), 5);
    await choose(parametrization(page), 'chord');
    await mirror(page).uncheck();
    await commit(partTilt(page), 2.5);
    await commit(partRoll(page), -1);
    await choose(leftHalf(page), 'turned');

    const expected = {
      spanwise: 'smooth',
      sectionPlanes: 'vertical',
      twistPivot: 0.3,
      trailingEdge: { mode: 'closed', thickness: 0.48 },
      tip: { mode: 'pointed', ratio: 1 / 150 },
      chordSamples: 16,
      panelStations: 5,
      parametrization: 'chord',
      mirror: false,
      partTilt: 2.5,
      partRoll: -1,
      partPivot: null,
      leftHalf: 'turned',
    };
    await expect.poll(async () => (await savedProject(page))?.settings).toEqual(expected);
    await expect.poll(async () => (await savedProject(page))?.name).toBe('Persist test');
    await openTab(page, 'Checks');
    const surface = await checksValue(page, 'Surface').innerText();
    expect(surface).toMatch(surfaceRe(3, 33, 6));
    const before = await figures(page);
    await openTab(page, 'Settings');

    await page.reload();
    await expect(status(page)).toHaveText(STATUS_RE);
    await expect(page.locator('dialog[open]')).toHaveCount(0);
    // The Settings tab stays selected and shows the saved values.
    await expect(page.getByRole('tab', { name: 'Settings', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(projectName(page)).toHaveValue('Persist test');
    await expect(spanwise(page)).toHaveValue('smooth');
    await expect(sectionPlanes(page)).toHaveValue('vertical');
    await expect(twistPivot(page)).toHaveValue('0.3');
    await expect(teMode(page)).toHaveValue('closed');
    await expect(teThickness(page)).toHaveCount(0);
    await expect(tipMode(page)).toHaveValue('pointed');
    await expect(tipScale(page)).toHaveValue('150');
    await expect(chordStations(page)).toHaveValue('16');
    await expect(panelStations(page)).toHaveValue('5');
    await expect(parametrization(page)).toHaveValue('chord');
    await expect(mirror(page)).not.toBeChecked();
    await expect(partTilt(page)).toHaveValue('2.5');
    await expect(partRoll(page)).toHaveValue('-1');
    await expect(leftHalf(page)).toHaveValue('turned');
    expect((await savedProject(page)).settings).toEqual(expected);

    // The rebuilt wing uses them: same figures, same surface, closed edge, tip note 240 / 150.
    expect(await figures(page)).toEqual(before);
    await openTab(page, 'Checks');
    await expect(checksValue(page, 'Surface')).toHaveText(surface);
    await expect(checksValue(page, 'Trailing edge')).toHaveText('closed');
    await openTab(page, 'Sections');
    await expect(chordNote(page, 1)).toHaveText('tip: 1.60');
  });

  test('a project name above 200 characters brings the size warning at once; a short name removes it', async ({ page }) => {
    await createDesign(page, 'Sport');
    await openTab(page, 'Settings');
    const nameField = page.locator('#pane-settings').getByRole('textbox', { name: 'Project name' });
    await nameField.fill('n'.repeat(250));
    await nameField.press('Enter');
    await expect(status(page)).toContainText('· 1 warning(s)');
    await expect(page.locator('#pane-checks')).toContainText('Large project: a name of 250 characters (warning above 200).');
    await nameField.fill('Short');
    await nameField.press('Enter');
    await expect(status(page)).not.toContainText('warning');
    await expect(page.locator('#pane-checks')).not.toContainText('Large project');
  });

  test('keyboard changes in the lists keep the focus there', async ({ page }) => {
    await createDesign(page, 'Sport');
    await openTab(page, 'Settings');
    const spanwise = page.locator('#pane-settings').getByRole('combobox', { name: 'Spanwise interpolation' });
    await spanwise.focus();
    // Linear, then Straight panels, then Smooth.
    await spanwise.press('ArrowDown');
    await expect.poll(async () => (await savedProject(page)).settings.spanwise).toBe('straight');
    await frames(page);
    await expect(spanwise).toBeFocused();
    await spanwise.press('ArrowDown');
    await expect.poll(async () => (await savedProject(page)).settings.spanwise).toBe('smooth');
    await frames(page);
    await expect(spanwise).toBeFocused();
  });
});
