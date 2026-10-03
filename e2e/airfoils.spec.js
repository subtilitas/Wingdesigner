// Airfoils tab: uploads (Selig, Lednicer, decimal-comma percent table, invalid files), pasted
// coordinates, NACA generator, library presets, "Remove unused", .dat download round trip and the
// remove button of airfoils in use.
//
// Uploaded test airfoils are generated here from the NACA 4-digit equations; the library test adds the
// bundled S9104 file from public/airfoils/.
import { STORAGE_KEY, createDesign, dialogOf, downloadOf, expect, frames, openTab, savedProject, sectionField, statusOf, test, toastOf, whenRerendered } from './helpers.js';

const NACA_MESSAGE = 'Enter a 4-digit (e.g. 2412) or 5-digit (e.g. 23012) designation.';
// Generated NACA presets of the library as defined in src/airfoil/library.js (NACA_PRESETS), in list order.
// Sport preset planform (airfoil changes do not alter it).
const SPORT_STATUS = 'Span 1200 mm · area 23.04 dm² · AR 6.25 · MAC 196.0 mm';
const LIBRARY_CODES = ['0006', '0008', '0009', '0010', '0012', '0015', '2408', '2410', '2412', '2415', '4412', '4415', '6409', '23012', '23015', '23112', '24112'];

// ---------------------------------------------------------------------------------------------
// Test airfoil data (NACA 4-digit equations, Abbott & von Doenhoff).

/**
 * Upper and lower surface from the leading edge to the trailing edge, cosine spacing.
 * exact: thickness applied perpendicular to the camber line (as the app's generator does);
 * otherwise vertically, so both surfaces share the x stations (needed for x/upper/lower tables).
 */
function naca4(code, perSide, { exact = false, closedTE = false } = {}) {
  const m = Number(code[0]) / 100;
  const p = Number(code[1]) / 10;
  const t = Number(code.slice(2)) / 100;
  const a4 = closedTE ? 0.1036 : 0.1015;
  const upper = [];
  const lower = [];
  for (let i = 0; i < perSide; i++) {
    const x = (1 - Math.cos((Math.PI * i) / (perSide - 1))) / 2;
    const yt = Math.max(0, 5 * t * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - a4 * x ** 4));
    let yc = 0;
    let dyc = 0;
    if (m > 0) {
      const q = x < p ? p * p : (1 - p) ** 2;
      yc = x < p ? (m / q) * (2 * p * x - x * x) : (m / q) * (1 - 2 * p + 2 * p * x - x * x);
      dyc = ((2 * m) / q) * (p - x);
    }
    if (exact) {
      const th = Math.atan(dyc);
      upper.push([x - yt * Math.sin(th), yc + yt * Math.cos(th)]);
      lower.push([x + yt * Math.sin(th), yc - yt * Math.cos(th)]);
    } else {
      upper.push([x, yc + yt]);
      lower.push([x, yc - yt]);
    }
  }
  return { upper, lower };
}

/** Selig order: trailing edge over the upper surface to the leading edge and back along the lower. */
const seligPoints = ({ upper, lower }) => upper.slice().reverse().concat(lower.slice(1));
const line = ([x, y]) => `${x.toFixed(6)} ${y.toFixed(6)}`;
const seligText = (name, surf) => [name, ...seligPoints(surf).map(line)].join('\n') + '\n';
/** Lednicer: counts line, upper surface LE->TE, blank line, lower surface LE->TE. */
const lednicerText = (name, surf) =>
  [name, `${surf.upper.length}. ${surf.lower.length}.`, '', ...surf.upper.map(line), '', ...surf.lower.map(line)].join('\n') + '\n';
/** Percent-of-chord X / Yo / Yu table with decimal commas and tab separators (CRLF line ends). */
const percentTableText = (name, surf) => {
  const c = (v) => (v * 100).toFixed(4).replace('.', ',');
  return [name, 'X\tYo\tYu', ...surf.upper.map(([x, yu], i) => `${c(x)}\t${c(yu)}\t${c(surf.lower[i][1])}`)].join('\r\n') + '\r\n';
};

/**
 * A closed outline that crosses itself: the lower surface rises above the upper surface aft of 60 %
 * chord (a figure-eight loop).
 */
function crossingText() {
  const { upper, lower } = naca4('0012', 31);
  const crossed = lower.map(([x, y], i) => (x > 0.6 ? [x, upper[i][1] + 0.03] : [x, y]));
  return seligText('E2E CROSSING', { upper, lower: crossed });
}

// ---------------------------------------------------------------------------------------------
// Helpers.

const pane = (page) => page.locator('#pane-airfoils');
const sectionOf = (page, heading) => pane(page).locator('section').filter({ has: page.getByRole('heading', { name: heading, exact: true }) });
const projectItems = (page) => sectionOf(page, 'Project airfoils').locator('.airfoil-list > li');
const projectItem = (page, name) => projectItems(page).filter({ has: page.getByText(name, { exact: true }) });
/** Generated NACA entries of the library list (bundled files, if any, are left out). */
const nacaLibraryItems = (page) =>
  sectionOf(page, 'Library')
    .locator('.airfoil-list > li')
    .filter({ has: page.locator('.grow > .small', { hasText: /· generated$/ }) });
const itemNames = (items) => items.locator('.grow > div:first-child').allTextContents();

/** First visit: create the Sport preset (root NACA 2412, tip NACA 2410) and open the Airfoils tab. */
async function startSport(page) {
  await createDesign(page, 'Sport');
  await openTab(page, 'Airfoils');
  await expect(projectItems(page)).toHaveCount(2);
}

/**
 * Every store change re-renders the airfoil panel (also while its tab is hidden): run the action and
 * wait until the panel's sections are replaced.
 */
const whenPanelRefreshed = (page, action) => whenRerendered(pane(page).locator('section'), action);

/** Project airfoil list as data: name, detail line, remove button state. */
function projectList(page) {
  return projectItems(page).evaluateAll((lis) =>
    lis.map((li) => {
      const grow = li.querySelector('.grow');
      const remove = [...li.querySelectorAll('button')].find((b) => b.textContent === '×');
      return { name: grow.children[0].textContent, detail: grow.children[1].textContent, removable: !remove.disabled, title: remove.title };
    }),
  );
}
const projectNames = async (page) => (await projectList(page)).map((a) => a.name);

/**
 * Autosave runs in an animation frame after the change (in the current build after the airfoil
 * panel has re-rendered), so saved data is always polled.
 */
async function savedIds(page) {
  const p = await savedProject(page);
  return { airfoils: p.airfoils.map((a) => a.id), sections: p.sections.map((s) => s.airfoil) };
}

/** Wait until the autosaved project has n airfoils and return it. */
async function savedWithAirfoils(page, n) {
  await expect.poll(async () => (await savedProject(page))?.airfoils?.length).toBe(n);
  return savedProject(page);
}

/** Issue lines of the open preview ("Info: ...", "Warning: ...", "Error: ..."). */
const issuesOf = (dlg) => dlg.locator('ul.issues > li').allTextContents();
const problemsOf = async (dlg) => (await issuesOf(dlg)).filter((i) => /^(Error|Warning):/.test(i));

/** Parse the statistics line of the sanity report. */
async function statsOf(dlg) {
  const text = await dlg.locator('ul.issues > li').filter({ hasText: / points, t\/c / }).textContent();
  const m = text.match(/^Info: (\d+) points, t\/c (-?[\d.]+) % at ([\d.]+) %, camber (-?[\d.]+) % at ([\d.]+) %, TE gap (-?[\d.]+) %\.$/);
  expect(m, `stats line: ${text}`).not.toBeNull();
  return { points: Number(m[1]), t: Number(m[2]), tAt: Number(m[3]), camber: Number(m[4]), camberAt: Number(m[5]), teGap: Number(m[6]) };
}

async function upload(page, files) {
  await pane(page)
    .locator('.dropzone input[type=file]')
    .setInputFiles(files.map(([name, text]) => ({ name, mimeType: 'text/plain', buffer: Buffer.from(text, 'latin1') })));
}

/** Click "Add to project" and wait until the panel shows the updated project. */
async function addFromPreview(page, name) {
  await whenPanelRefreshed(page, async () => {
    await dialogOf(page).getByRole('button', { name: 'Add to project' }).click();
    await expect(dialogOf(page)).toHaveCount(0);
    await expect(toastOf(page)).toHaveText(`Added airfoil "${name}".`);
  });
}

async function cancelPreview(page) {
  await dialogOf(page).getByRole('button', { name: 'Cancel' }).click();
  await expect(dialogOf(page)).toHaveCount(0);
}

/** Open the NACA generator preview for a code. */
async function nacaPreview(page, code, { closedTE = false } = {}) {
  const gen = sectionOf(page, 'NACA generator');
  await gen.getByLabel('NACA designation').fill(code);
  await gen.getByLabel('Closed trailing edge').setChecked(closedTE);
  await gen.getByRole('button', { name: 'Preview' }).click();
}

/** Click a button that changes the project and wait for the panel refresh. */
const clickAndRefresh = (page, button) => whenPanelRefreshed(page, () => button.click());

function expectPointsClose(actual, expected, tol) {
  expect(actual.length).toBe(expected.length);
  let worst = 0;
  actual.forEach(([x, y], i) => {
    worst = Math.max(worst, Math.abs(x - expected[i][0]), Math.abs(y - expected[i][1]));
  });
  expect(worst).toBeLessThan(tol);
}

// ---------------------------------------------------------------------------------------------

test.describe('Airfoils tab', () => {
  test('Selig upload: preview shows format and point count; Add stores name, attribution and points', async ({ page }) => {
    await startSport(page);
    expect(await projectList(page)).toEqual([
      { name: 'NACA 2412', detail: '161 points · NACA equations', removable: false, title: 'In use by a section' },
      { name: 'NACA 2410', detail: '161 points · NACA equations', removable: false, title: 'In use by a section' },
    ]);

    const surf = naca4('2415', 31);
    await upload(page, [['e2e-selig.dat', seligText('E2E SELIG 2415', surf)]]);
    const dlg = dialogOf(page);
    await expect(dlg.getByRole('heading', { name: 'Upload: e2e-selig.dat' })).toBeVisible();
    await expect(dlg.getByText(/^Format: /)).toHaveText('Format: selig, 61 points');
    await expect(dlg.getByLabel('Airfoil name')).toHaveValue('E2E SELIG 2415');
    expect(await problemsOf(dlg)).toEqual([]);
    const s = await statsOf(dlg);
    expect(s.points).toBe(61);
    expect(Math.abs(s.t - 15)).toBeLessThan(0.2);
    expect(Math.abs(s.camber - 2)).toBeLessThan(0.1);
    expect(Math.abs(s.camberAt - 40)).toBeLessThan(3);
    // Open trailing edge of the 4-digit thickness form: 2 * 0.0021 * 5 * 0.15 = 0.315 % chord.
    expect(Math.abs(s.teGap - 0.315)).toBeLessThan(0.01);

    // Rename and attribute in the preview before adding.
    await dlg.getByLabel('Airfoil name').fill('E2E Selig renamed');
    await dlg.getByLabel('Attribution').fill('E2E generator');
    await addFromPreview(page, 'E2E Selig renamed');
    expect(await projectNames(page)).toEqual(['NACA 2412', 'NACA 2410', 'E2E Selig renamed']);
    expect((await projectList(page))[2]).toEqual({ name: 'E2E Selig renamed', detail: '61 points · E2E generator · unused', removable: true, title: 'Remove from project' });

    // The section airfoil menus offer the new airfoil.
    await openTab(page, 'Sections');
    await expect(page.getByLabel('Airfoil of section 1').locator('option')).toHaveText(['NACA 2412', 'NACA 2410', 'E2E Selig renamed']);

    // Stored: normalized Selig points equal to the file (already unit chord), source metadata.
    const saved = await savedWithAirfoils(page, 3);
    const a = saved.airfoils[2];
    expect(a.name).toBe('E2E Selig renamed');
    expect(a.source).toEqual({ kind: 'upload', file: 'e2e-selig.dat', attribution: 'E2E generator' });
    expectPointsClose(a.points, seligPoints(surf), 1e-6);

    // Survives a reload.
    await page.reload();
    await expect(dialogOf(page)).toHaveCount(0);
    await openTab(page, 'Airfoils');
    await expect.poll(() => projectNames(page)).toEqual(['NACA 2412', 'NACA 2410', 'E2E Selig renamed']);
    expect((await projectList(page))[2].detail).toBe('61 points · E2E generator · unused');
  });

  test('thumbnails fit airfoils of any scale, e.g. percent of chord in a project file', async ({ page }) => {
    await startSport(page);
    const saved = await savedProject(page);
    saved.airfoils[0].points = saved.airfoils[0].points.map(([x, y]) => [100 * x, 100 * y]);
    await page.evaluate(([key, p]) => localStorage.setItem(key, JSON.stringify(p)), [STORAGE_KEY, saved]);
    await page.reload();
    await openTab(page, 'Airfoils');
    await expect(projectItems(page)).toHaveCount(2);
    // Bounding box of the outline of each project thumbnail (drawing units of the 120 x 40 view box).
    // NACA 2412 in percent and NACA 2410 in unit chord differ by 2 % thickness only, so the boxes
    // nearly match.
    const inked = () =>
      projectItems(page).evaluateAll((lis) =>
        lis.map((li) => {
          const svg = li.querySelector('svg.thumb');
          const [, , w, h] = svg.getAttribute('viewBox').split(' ').map(Number);
          const b = svg.querySelector('polyline').getBBox();
          return { left: b.x, right: w - b.x - b.width, width: b.width, height: b.height, canvasHeight: h };
        }),
      );
    await expect.poll(async () => (await inked())[0].width).toBeGreaterThan(0);
    const [percent, unit] = await inked();
    expect(Math.abs(percent.width - unit.width)).toBeLessThanOrEqual(2);
    expect(Math.abs(percent.left - percent.right)).toBeLessThanOrEqual(2);
    expect(percent.height).toBeLessThan(0.6 * percent.canvasHeight);
    expect(Math.abs(percent.height - unit.height)).toBeLessThanOrEqual(0.25 * unit.height);
  });

  test('Lednicer upload is converted to Selig order', async ({ page }) => {
    await startSport(page);
    const surf = naca4('4412', 26);
    await upload(page, [['e2e-lednicer.dat', lednicerText('E2E LEDNICER 4412', surf)]]);
    const dlg = dialogOf(page);
    await expect(dlg.getByRole('heading', { name: 'Upload: e2e-lednicer.dat' })).toBeVisible();
    // 26 + 26 points sharing the leading edge.
    await expect(dlg.getByText(/^Format: /)).toHaveText('Format: lednicer, 51 points');
    await expect(dlg.getByLabel('Airfoil name')).toHaveValue('E2E LEDNICER 4412');
    expect(await problemsOf(dlg)).toEqual([]);
    const s = await statsOf(dlg);
    expect(s.points).toBe(51);
    expect(Math.abs(s.t - 12)).toBeLessThan(0.2);
    expect(Math.abs(s.camber - 4)).toBeLessThan(0.1);
    expect(Math.abs(s.camberAt - 40)).toBeLessThan(3);
    await addFromPreview(page, 'E2E LEDNICER 4412');
    expect(await projectNames(page)).toEqual(['NACA 2412', 'NACA 2410', 'E2E LEDNICER 4412']);
    expect((await projectList(page))[2].detail).toBe('51 points · unused');
    const saved = await savedWithAirfoils(page, 3);
    // Same point sequence as the Selig form of the generated surfaces.
    expectPointsClose(saved.airfoils[2].points, seligPoints(surf), 1e-6);
  });

  test('decimal-comma X/Yo/Yu percent table is read as a table and scaled from percent', async ({ page }) => {
    await startSport(page);
    const surf = naca4('2412', 21);
    await upload(page, [['e2e-tabelle.txt', percentTableText('E2E TABELLE 2412', surf)]]);
    const dlg = dialogOf(page);
    await expect(dlg.getByRole('heading', { name: 'Upload: e2e-tabelle.txt' })).toBeVisible();
    await expect(dlg.getByText(/^Format: /)).toHaveText('Format: table, 41 points');
    await expect(dlg.getByLabel('Airfoil name')).toHaveValue('E2E TABELLE 2412');
    const issues = await issuesOf(dlg);
    expect(issues).toContain('Info: Read as a three-column table (x, upper y, lower y).');
    expect(issues).toContain('Info: Decimal commas were read as decimal points.');
    // The "X Yo Yu" header is recognized, not reported as an ignored line; the only warning is the scaling.
    expect(await problemsOf(dlg)).toEqual(['Warning: Coordinates look like percent of chord and were divided by 100.']);
    const s = await statsOf(dlg);
    expect(s.points).toBe(41);
    expect(Math.abs(s.t - 12)).toBeLessThan(0.2);
    expect(Math.abs(s.camber - 2)).toBeLessThan(0.1);
    await expect(dlg.getByRole('button', { name: 'Add to project' })).toBeEnabled();
    await addFromPreview(page, 'E2E TABELLE 2412');
    expect(await projectNames(page)).toEqual(['NACA 2412', 'NACA 2410', 'E2E TABELLE 2412']);
    expect((await projectList(page))[2].detail).toBe('41 points · unused');
    const saved = await savedWithAirfoils(page, 3);
    // Percent values divided by 100 (file precision 1e-4 % = 1e-6 chord).
    expectPointsClose(saved.airfoils[2].points, seligPoints(surf), 2e-6);
  });

  test('invalid files (self-intersecting outline, no numbers) cannot be added', async ({ page }) => {
    await startSport(page);
    // Two files in one selection open one preview after the other.
    await upload(page, [
      ['e2e-crossing.dat', crossingText()],
      ['e2e-words.txt', 'Just some words\nno coordinates in this file\n'],
    ]);
    let dlg = dialogOf(page);
    await expect(dlg.getByRole('heading', { name: 'Upload: e2e-crossing.dat' })).toBeVisible();
    await expect(dlg.getByText(/^Format: /)).toHaveText('Format: selig, 61 points');
    expect(await issuesOf(dlg)).toContain('Error: The outline crosses itself (1 crossing(s)).');
    await expect(dlg.getByRole('button', { name: 'Cannot add (errors)' })).toBeDisabled();
    await expect(dlg.getByRole('button', { name: 'Add to project' })).toHaveCount(0);
    await dlg.getByRole('button', { name: 'Cancel' }).click();

    dlg = dialogOf(page);
    await expect(dlg.getByRole('heading', { name: 'Upload: e2e-words.txt' })).toBeVisible();
    await expect(dlg.getByText(/^Format: /)).toHaveText('Format: selig, 0 points');
    await expect(dlg.getByLabel('Airfoil name')).toHaveValue('Just some words');
    const issues = await issuesOf(dlg);
    expect(issues).toContain('Error: No coordinate lines found.');
    expect(issues).toContain('Warning: 1 non-numeric line(s) after the name line were ignored.');
    await expect(dlg.getByRole('button', { name: 'Cannot add (errors)' })).toBeDisabled();
    // Escape closes the preview without adding.
    await page.keyboard.press('Escape');
    await expect(dialogOf(page)).toHaveCount(0);

    expect(await projectNames(page)).toEqual(['NACA 2412', 'NACA 2410']);
    expect((await savedProject(page)).airfoils.map((a) => a.id)).toEqual(['naca2412', 'naca2410']);
  });

  test('Enter in the name field adds the airfoil under the typed name', async ({ page }) => {
    await startSport(page);
    await nacaPreview(page, '4415');
    const dlg = dialogOf(page);
    await expect(dlg.getByRole('heading', { name: 'NACA 4415' })).toBeVisible();
    // Before commit 9c4e58e Cancel was the first submit button of the preview form, so implicit
    // submission (Enter) cancelled.
    await dlg.getByLabel('Airfoil name').fill('E2E Enter 4415');
    await whenPanelRefreshed(page, async () => {
      await dlg.getByLabel('Airfoil name').press('Enter');
      await expect(dialogOf(page)).toHaveCount(0);
      await expect(toastOf(page)).toHaveText('Added airfoil "E2E Enter 4415".');
    });
    expect(await projectNames(page)).toEqual(['NACA 2412', 'NACA 2410', 'E2E Enter 4415']);
  });

  test('pasted coordinates are checked like a file', async ({ page }) => {
    await startSport(page);
    const uploadBox = sectionOf(page, 'Upload');
    const paste = uploadBox.getByLabel('Paste coordinates');
    const check = uploadBox.getByRole('button', { name: 'Check pasted text' });

    // Nothing pasted.
    await check.click();
    let dlg = dialogOf(page);
    await expect(dlg.getByRole('heading', { name: 'Pasted coordinates' })).toBeVisible();
    expect(await issuesOf(dlg)).toContain('Error: No coordinate lines found.');
    await expect(dlg.getByRole('button', { name: 'Cannot add (errors)' })).toBeDisabled();
    await cancelPreview(page);

    // Coordinates without a name line: the name falls back to "pasted".
    const surf = naca4('0010', 25);
    await paste.fill(seligPoints(surf).map(line).join('\n'));
    await check.click();
    dlg = dialogOf(page);
    await expect(dlg.getByRole('heading', { name: 'Pasted coordinates' })).toBeVisible();
    await expect(dlg.getByText(/^Format: /)).toHaveText('Format: selig, 49 points');
    await expect(dlg.getByLabel('Airfoil name')).toHaveValue('pasted');
    expect(await issuesOf(dlg)).toContain('Info: No name line found; the file name is used as the airfoil name.');
    const s = await statsOf(dlg);
    expect(Math.abs(s.t - 10)).toBeLessThan(0.2);
    expect(Math.abs(s.camber)).toBeLessThan(0.01);
    await cancelPreview(page);
    expect(await projectNames(page)).toEqual(['NACA 2412', 'NACA 2410']);

    // Clockwise order (lower surface first) is reversed with a warning.
    await paste.fill(seligText('E2E PASTE 0010', { upper: surf.lower, lower: surf.upper }));
    await check.click();
    dlg = dialogOf(page);
    await expect(dlg.getByLabel('Airfoil name')).toHaveValue('E2E PASTE 0010');
    expect(await problemsOf(dlg)).toEqual(['Warning: Points run clockwise (lower surface first); order reversed to Selig order.']);
    await addFromPreview(page, 'E2E PASTE 0010');
    expect(await projectNames(page)).toEqual(['NACA 2412', 'NACA 2410', 'E2E PASTE 0010']);
    const saved = await savedWithAirfoils(page, 3);
    expect(saved.airfoils[2].source).toEqual({ kind: 'upload' });
    expectPointsClose(saved.airfoils[2].points, seligPoints(surf), 1e-6);
  });

  test('NACA generator previews and adds 4415 and 23012; closed trailing edge option', async ({ page }) => {
    await startSport(page);

    await nacaPreview(page, '4415');
    let dlg = dialogOf(page);
    await expect(dlg.getByRole('heading', { name: 'NACA 4415' })).toBeVisible();
    await expect(dlg.getByLabel('Airfoil name')).toHaveValue('NACA 4415');
    expect(await problemsOf(dlg)).toEqual([]);
    let s = await statsOf(dlg);
    expect(s.points).toBe(161);
    expect(Math.abs(s.t - 15)).toBeLessThan(0.1);
    expect(Math.abs(s.tAt - 30)).toBeLessThan(2);
    // Maximum camber from the chord line lies at 42 % (designated camber-line maximum: 40 %).
    expect(s.camberAt).toBeGreaterThanOrEqual(40);
    expect(s.camberAt).toBeLessThanOrEqual(43);
    expect(s.teGap).toBeGreaterThan(0.2);
    await addFromPreview(page, 'NACA 4415');
    expect(await projectNames(page)).toEqual(['NACA 2412', 'NACA 2410', 'NACA 4415']);
    expect((await projectList(page))[2].detail).toBe('161 points · NACA equations · unused');

    await nacaPreview(page, '23012');
    dlg = dialogOf(page);
    await expect(dlg.getByRole('heading', { name: 'NACA 23012' })).toBeVisible();
    expect(await problemsOf(dlg)).toEqual([]);
    s = await statsOf(dlg);
    expect(s.points).toBe(161);
    expect(Math.abs(s.t - 12)).toBeLessThan(0.1);
    // Maximum camber of the 230 mean line at 15 % chord.
    expect(Math.abs(s.camberAt - 15)).toBeLessThan(2);
    await addFromPreview(page, 'NACA 23012');
    expect(await projectNames(page)).toEqual(['NACA 2412', 'NACA 2410', 'NACA 4415', 'NACA 23012']);

    const saved = await savedWithAirfoils(page, 4);
    for (const name of ['NACA 4415', 'NACA 23012']) {
      const a = saved.airfoils.find((q) => q.name === name);
      expect(a.source.kind).toBe('naca');
      expect(a.points).toHaveLength(161);
    }

    // Closed trailing edge: the TE gap is zero; without the option it stays open.
    await nacaPreview(page, '0012', { closedTE: true });
    dlg = dialogOf(page);
    await expect(dlg.getByRole('heading', { name: 'NACA 0012' })).toBeVisible();
    s = await statsOf(dlg);
    expect(s.teGap).toBeCloseTo(0, 3);
    expect(Math.abs(s.t - 12)).toBeLessThan(0.1);
    await cancelPreview(page);
    await nacaPreview(page, '0012', { closedTE: false });
    dlg = dialogOf(page);
    await expect(dlg.getByRole('heading', { name: 'NACA 0012' })).toBeVisible();
    s = await statsOf(dlg);
    expect(s.teGap).toBeGreaterThan(0.2);
    await cancelPreview(page);
    expect(await projectNames(page)).toEqual(['NACA 2412', 'NACA 2410', 'NACA 4415', 'NACA 23012']);
  });

  test('sanity report measures camber from the chord line of generated cambered NACA sections', async ({ page }) => {
    await startSport(page);
    const camber = {};
    for (const code of ['4415', '23012']) {
      await nacaPreview(page, code);
      await expect(dialogOf(page).getByRole('heading', { name: `NACA ${code}` })).toBeVisible();
      camber[code] = (await statsOf(dialogOf(page))).camber;
      await cancelPreview(page);
    }
    // Camber from the chord line (geometric leading edge to trailing-edge midpoint), vertical mean of
    // the surfaces. It is below the designated camber (4415: 4 %): the designated camber line starts
    // behind the geometric leading edge and NACA thickness is applied normal to it.
    expect(camber).toEqual({ 4415: expect.closeTo(3.74, 1), 23012: expect.closeTo(1.55, 1) });
  });

  test('NACA generator rejects invalid designations with a message', async ({ page }) => {
    await startSport(page);
    const gen = sectionOf(page, 'NACA generator');
    const msg = gen.locator('span.small.muted');
    // Reflex digit 3; zero thickness; camber without position; too short; too long; letters; empty.
    for (const code of ['12345', '0000', '2012', '241', '244120', 'abcd', '']) {
      await nacaPreview(page, code);
      await expect(msg).toHaveText(NACA_MESSAGE);
      await expect(dialogOf(page)).toHaveCount(0);
      // A valid code clears the message and opens the preview.
      await nacaPreview(page, '2412');
      await expect(dialogOf(page).getByRole('heading', { name: 'NACA 2412' })).toBeVisible();
      await expect(msg).toHaveText('');
      await cancelPreview(page);
    }
    expect(await projectNames(page)).toEqual(['NACA 2412', 'NACA 2410']);
  });

  test('NACA generator accepts a "NACA" prefix and titles the preview with the plain designation', async ({ page }) => {
    await startSport(page);
    await nacaPreview(page, 'naca 4415');
    const dlg = dialogOf(page);
    await expect(dlg.getByLabel('Airfoil name')).toHaveValue('NACA 4415');
    await expect(dlg.getByRole('heading', { level: 2 })).toHaveText('NACA 4415');
  });

  test('library presets: filter, Preview/Cancel, Preview/Add, no duplicate on a second Add', async ({ page }) => {
    await startSport(page);
    const lib = sectionOf(page, 'Library');
    expect(await itemNames(nacaLibraryItems(page))).toEqual(LIBRARY_CODES.map((c) => `NACA ${c}`));

    const filter = lib.getByLabel('Filter library');
    await filter.fill('reflex');
    await expect(nacaLibraryItems(page).locator('.grow > div:first-child')).toHaveText(['NACA 23112', 'NACA 24112']);
    await filter.fill('SYMMETRIC');
    await expect(nacaLibraryItems(page).locator('.grow > div:first-child')).toHaveText(['NACA 0006', 'NACA 0008', 'NACA 0009', 'NACA 0010', 'NACA 0012', 'NACA 0015']);
    await filter.fill('no such airfoil');
    await expect(lib.locator('.airfoil-list > li')).toHaveCount(0);
    await filter.fill('4412');
    await expect(nacaLibraryItems(page).locator('.grow > div')).toHaveText(['NACA 4412', 'Cambered · Slow flyers, high lift · generated']);
    const preset = nacaLibraryItems(page).filter({ hasText: 'NACA 4412' });

    // Preview and cancel: nothing is added.
    await preset.getByRole('button', { name: 'Preview' }).click();
    let dlg = dialogOf(page);
    await expect(dlg.getByRole('heading', { name: 'NACA 4412' })).toBeVisible();
    const s = await statsOf(dlg);
    expect(s.points).toBe(161);
    expect(Math.abs(s.t - 12)).toBeLessThan(0.1);
    expect(s.camberAt).toBeGreaterThanOrEqual(40);
    expect(s.camberAt).toBeLessThanOrEqual(43);
    await cancelPreview(page);
    expect(await projectNames(page)).toEqual(['NACA 2412', 'NACA 2410']);

    // Preview and add.
    await preset.getByRole('button', { name: 'Preview' }).click();
    dlg = dialogOf(page);
    await expect(dlg.getByRole('heading', { name: 'NACA 4412' })).toBeVisible();
    await addFromPreview(page, 'NACA 4412');
    expect(await projectNames(page)).toEqual(['NACA 2412', 'NACA 2410', 'NACA 4412']);
    expect((await projectList(page))[2].detail).toBe('161 points · NACA equations · unused');
    // The filter survives the panel refresh.
    await expect(lib.getByLabel('Filter library')).toHaveValue('4412');
    await expect(nacaLibraryItems(page)).toHaveCount(1);
    const saved = await savedWithAirfoils(page, 3);
    expect(saved.airfoils[2]).toMatchObject({ id: 'naca-4412', name: 'NACA 4412', source: { kind: 'naca' } });

    // The same preset added again is recognized as identical.
    await preset.getByRole('button', { name: 'Preview' }).click();
    await dialogOf(page).getByRole('button', { name: 'Add to project' }).click();
    await expect(dialogOf(page)).toHaveCount(0);
    await expect(toastOf(page)).toHaveText('The project already holds this airfoil as "NACA 4412".');
    expect(await projectNames(page)).toEqual(['NACA 2412', 'NACA 2410', 'NACA 4412']);
    await expect.poll(async () => (await savedIds(page)).airfoils).toEqual(['naca2412', 'naca2410', 'naca-4412']);
  });

  test('text typed in the Upload and NACA fields stays when the panel renders again', async ({ page }) => {
    // The bundled library is part of the app: no request loads it.
    const requests = [];
    page.on('request', (r) => requests.push(r.url()));
    await createDesign(page, 'Sport');
    await openTab(page, 'Airfoils');
    await expect(sectionOf(page, 'Library').locator('.airfoil-list > li', { hasText: 'S9104' })).toHaveCount(1);
    expect(requests.filter((u) => u.includes('/airfoils/'))).toEqual([]);
    const draft = 'Draft\n1 0.01\n0 0\n1 -0.01';
    await page.getByLabel('Paste coordinates').fill(draft);
    await page.getByLabel('NACA designation').fill('4415');
    await page.getByLabel('Closed trailing edge').check();
    await expect(page.getByLabel('Paste coordinates')).toHaveValue(draft);
    await expect(page.getByLabel('NACA designation')).toHaveValue('4415');
    await expect(page.getByLabel('Closed trailing edge')).toBeChecked();
    // A project change re-renders the panel; the drafts stay.
    await page.getByRole('button', { name: 'Remove unused' }).click();
    await openTab(page, 'Sections');
    await openTab(page, 'Airfoils');
    await expect(page.getByLabel('Paste coordinates')).toHaveValue(draft);
    await expect(page.getByLabel('NACA designation')).toHaveValue('4415');
  });

  test('bundled library files list their source and license and add with their attribution', async ({ page }) => {
    await startSport(page);
    const bundled = sectionOf(page, 'Library')
      .locator('.airfoil-list > li')
      .filter({ hasNot: page.locator('.grow > .small', { hasText: /· generated$/ }) });
    // The files of public/airfoils/index.json, in index order: six with a free license, 56 MH airfoils
    // with the written permission of their designer.
    const names = await itemNames(bundled);
    expect(names.filter((n) => !n.startsWith('MH '))).toEqual(['Clark Y', 'NACA 8-H-12', 'NACA M-6', 'RAF 34', 'S9104', 'USA 35B']);
    expect(names.filter((n) => n.startsWith('MH '))).toHaveLength(56);
    expect(names.slice(0, 4)).toEqual(['Clark Y', 'MH 1', 'MH 16', 'MH 17']);
    const mh45 = bundled.filter({ has: page.locator('.grow > div:first-child', { hasText: /^MH 45$/ }) });
    await expect(mh45.locator('.grow > .small')).toHaveText(
      'Flying wings · Tailless models, low pitching moment. Thickness 9.8 % of chord. For Reynolds numbers of 100,000 and above. · Martin Hepperle, www.mh-aerotools.de · written-permission',
    );
    await expect(mh45.getByRole('link', { name: 'Martin Hepperle, www.mh-aerotools.de' })).toHaveAttribute('href', 'https://www.mh-aerotools.de/airfoils/mh45koo.htm');
    await expect(bundled.filter({ hasText: 'S9104' }).locator('.grow > .small')).toContainText('Michael Selig, University of Illinois Urbana-Champaign · CC-BY-4.0');
    await expect(bundled.filter({ hasText: 'Clark Y' }).locator('.grow > .small')).toContainText('public-domain');
    await bundled.filter({ hasText: 'S9104' }).getByRole('button', { name: 'Preview' }).click();
    await expect(dialogOf(page).getByRole('heading', { name: 'S9104' })).toBeVisible();
    await addFromPreview(page, 'S9104');
    expect(await projectNames(page)).toEqual(['NACA 2412', 'NACA 2410', 'S9104']);
    await expect.poll(async () => (await savedProject(page)).airfoils[2]?.source).toMatchObject({
      kind: 'library',
      id: 's9104',
      license: 'CC-BY-4.0',
      url: 'https://m-selig.ae.illinois.edu/uiuc_lsat/s9104/s9104.html',
      terms: 'https://creativecommons.org/licenses/by/4.0/',
    });
    expect((await savedProject(page)).airfoils[2].points).toHaveLength(81);
  });

  test('adding a library preset that the wizard already put in the project does not create a duplicate', async ({ page }) => {
    await startSport(page);
    await sectionOf(page, 'Library').getByLabel('Filter library').fill('2412');
    const preset = nacaLibraryItems(page).filter({ hasText: 'NACA 2412' });
    await expect(preset).toHaveCount(1);
    await preset.getByRole('button', { name: 'Preview' }).click();
    await dialogOf(page).getByRole('button', { name: 'Add to project' }).click();
    await expect(dialogOf(page)).toHaveCount(0);
    await expect(toastOf(page)).toHaveText('The project already holds this airfoil as "NACA 2412".');
    expect(await projectNames(page)).toEqual(['NACA 2412', 'NACA 2410']);
  });

  test('an action that changes nothing keeps the undo and redo history', async ({ page }) => {
    await startSport(page);
    const undo = page.getByRole('button', { name: 'Undo', exact: true });
    const redo = page.getByRole('button', { name: 'Redo', exact: true });
    await openTab(page, 'Sections');
    const chord = sectionField(page, 1, 'chord');
    await chord.fill('150');
    await chord.press('Enter');
    await expect(undo).toBeEnabled();
    await undo.click();
    await expect(redo).toBeEnabled();
    // Every airfoil is used: "Remove unused" removes nothing, and Redo still restores the edit.
    await openTab(page, 'Airfoils');
    await sectionOf(page, 'Project airfoils').getByRole('button', { name: 'Remove unused' }).click();
    await expect(redo).toBeEnabled();
    await redo.click();
    await expect.poll(async () => (await savedProject(page)).sections[1].chord).toBe(150);
  });

  test('"Remove unused" keeps only airfoils used by sections; Undo and Redo', async ({ page }) => {
    await startSport(page);
    await nacaPreview(page, '4415');
    await addFromPreview(page, 'NACA 4415');
    await nacaPreview(page, '0010');
    await addFromPreview(page, 'NACA 0010');
    expect(await projectNames(page)).toEqual(['NACA 2412', 'NACA 2410', 'NACA 4415', 'NACA 0010']);

    // Section 2 switches from NACA 2410 to NACA 4415.
    await openTab(page, 'Sections');
    await whenPanelRefreshed(page, () => page.getByLabel('Airfoil of section 2').selectOption({ label: 'NACA 4415' }));
    await expect.poll(() => savedIds(page)).toEqual({ airfoils: ['naca2412', 'naca2410', 'naca-4415', 'naca-0010'], sections: ['naca2412', 'naca-4415'] });
    await openTab(page, 'Airfoils');
    expect((await projectList(page)).map((a) => a.detail.endsWith('· unused'))).toEqual([false, true, false, true]);

    const removeUnused = sectionOf(page, 'Project airfoils').getByRole('button', { name: 'Remove unused' });
    await clickAndRefresh(page, removeUnused);
    expect(await projectNames(page)).toEqual(['NACA 2412', 'NACA 4415']);
    await expect.poll(() => savedIds(page)).toEqual({ airfoils: ['naca2412', 'naca-4415'], sections: ['naca2412', 'naca-4415'] });
    await expect(statusOf(page)).toHaveText(SPORT_STATUS);
    await openTab(page, 'Sections');
    await expect(page.getByLabel('Airfoil of section 2').locator('option')).toHaveText(['NACA 2412', 'NACA 4415']);
    await openTab(page, 'Airfoils');

    await clickAndRefresh(page, page.getByRole('button', { name: 'Undo' }));
    expect(await projectNames(page)).toEqual(['NACA 2412', 'NACA 2410', 'NACA 4415', 'NACA 0010']);
    await expect.poll(() => savedIds(page)).toEqual({ airfoils: ['naca2412', 'naca2410', 'naca-4415', 'naca-0010'], sections: ['naca2412', 'naca-4415'] });
    await clickAndRefresh(page, page.getByRole('button', { name: 'Redo' }));
    expect(await projectNames(page)).toEqual(['NACA 2412', 'NACA 4415']);
    await expect.poll(() => savedIds(page)).toEqual({ airfoils: ['naca2412', 'naca-4415'], sections: ['naca2412', 'naca-4415'] });

    // Nothing left to remove: a second click changes nothing and keeps Redo empty and Undo as it was.
    await removeUnused.click();
    await frames(page);
    expect(await projectNames(page)).toEqual(['NACA 2412', 'NACA 4415']);
    await expect.poll(() => savedIds(page)).toEqual({ airfoils: ['naca2412', 'naca-4415'], sections: ['naca2412', 'naca-4415'] });
  });

  test('.dat download of a project airfoil round-trips', async ({ page }) => {
    await startSport(page);
    const download = await downloadOf(page, () => projectItem(page, 'NACA 2412').getByRole('button', { name: '.dat' }).click());
    expect(download.name).toBe('NACA_2412.dat');
    const text = download.bytes.toString('utf8');
    const lines = text.split('\n');
    expect(lines.pop()).toBe('');
    expect(lines[0]).toBe('NACA 2412');
    const rows = lines.slice(1);
    for (const r of rows) expect(r).toMatch(/^ *-?\d\.\d{7} +-?\d\.\d{7}$/);
    const points = rows.map((r) => r.trim().split(/\s+/).map(Number));
    // Point count as listed in the project.
    expect(points).toHaveLength(161);
    expect((await projectList(page))[0].detail).toMatch(/^161 points/);

    // Same coordinates as the project data (7 decimals) and as the NACA 2412 equations.
    const saved = await savedProject(page);
    expectPointsClose(points, saved.airfoils.find((a) => a.id === 'naca2412').points, 6e-8);
    expectPointsClose(points, seligPoints(naca4('2412', 81, { exact: true })), 1e-6);

    // Upload the downloaded file again: same name, format and point count.
    await upload(page, [['NACA_2412.dat', text]]);
    const dlg = dialogOf(page);
    await expect(dlg.getByRole('heading', { name: 'Upload: NACA_2412.dat' })).toBeVisible();
    await expect(dlg.getByText(/^Format: /)).toHaveText('Format: selig, 161 points');
    await expect(dlg.getByLabel('Airfoil name')).toHaveValue('NACA 2412');
    expect(await problemsOf(dlg)).toEqual([]);
    const s = await statsOf(dlg);
    expect(Math.abs(s.t - 12)).toBeLessThan(0.1);
    expect(Math.abs(s.camber - 2)).toBeLessThan(0.05);
    await dlg.getByLabel('Airfoil name').fill('NACA 2412 reloaded');
    await addFromPreview(page, 'NACA 2412 reloaded');
    expect(await projectNames(page)).toEqual(['NACA 2412', 'NACA 2410', 'NACA 2412 reloaded']);
    const again = (await savedWithAirfoils(page, 3)).airfoils[2];
    // The upload is normalized to unit chord; the shape stays within 1e-3 chord of the original.
    expectPointsClose(again.points, points, 1e-3);

    // The re-imported airfoil downloads under its new name with the same point count.
    const download2 = await downloadOf(page, () => projectItem(page, 'NACA 2412 reloaded').getByRole('button', { name: '.dat' }).click());
    expect(download2.name).toBe('NACA_2412_reloaded.dat');
    const lines2 = download2.bytes.toString('utf8').trimEnd().split('\n');
    expect(lines2[0]).toBe('NACA 2412 reloaded');
    expect(lines2).toHaveLength(162);
    expectPointsClose(lines2.slice(1).map((r) => r.trim().split(/\s+/).map(Number)), again.points, 6e-8);
  });

  test('remove button is disabled for airfoils used by a section', async ({ page }) => {
    await startSport(page);
    for (const a of await projectList(page)) {
      expect(a.removable).toBe(false);
      expect(a.title).toBe('In use by a section');
    }
    await nacaPreview(page, '0010');
    await addFromPreview(page, 'NACA 0010');
    expect((await projectList(page)).map((a) => [a.name, a.removable])).toEqual([
      ['NACA 2412', false],
      ['NACA 2410', false],
      ['NACA 0010', true],
    ]);
    await expect(projectItem(page, 'NACA 2412').getByRole('button', { name: '×' })).toBeDisabled();

    // An unused airfoil can be removed.
    await clickAndRefresh(page, projectItem(page, 'NACA 0010').getByRole('button', { name: '×' }));
    expect(await projectNames(page)).toEqual(['NACA 2412', 'NACA 2410']);
    await expect.poll(() => savedIds(page)).toEqual({ airfoils: ['naca2412', 'naca2410'], sections: ['naca2412', 'naca2410'] });

    // Use a new airfoil at the root: it becomes locked, NACA 2412 becomes removable.
    await nacaPreview(page, '0010');
    await addFromPreview(page, 'NACA 0010');
    await openTab(page, 'Sections');
    await whenPanelRefreshed(page, () => page.getByLabel('Airfoil of section 1').selectOption({ label: 'NACA 0010' }));
    await expect.poll(() => savedIds(page)).toEqual({ airfoils: ['naca2412', 'naca2410', 'naca-0010'], sections: ['naca-0010', 'naca2410'] });
    await openTab(page, 'Airfoils');
    expect(await projectList(page)).toEqual([
      { name: 'NACA 2412', detail: '161 points · NACA equations · unused', removable: true, title: 'Remove from project' },
      { name: 'NACA 2410', detail: '161 points · NACA equations', removable: false, title: 'In use by a section' },
      { name: 'NACA 0010', detail: '161 points · NACA equations', removable: false, title: 'In use by a section' },
    ]);
    await clickAndRefresh(page, projectItem(page, 'NACA 2412').getByRole('button', { name: '×' }));
    expect(await projectNames(page)).toEqual(['NACA 2410', 'NACA 0010']);
    await expect.poll(() => savedIds(page)).toEqual({ airfoils: ['naca2410', 'naca-0010'], sections: ['naca-0010', 'naca2410'] });
    await expect(statusOf(page)).toHaveText(SPORT_STATUS);
  });
  test('View of a project airfoil is a read-only preview without "Add to project"', async ({ page }) => {
    await startSport(page);
    await projectItem(page, 'NACA 2412').getByRole('button', { name: 'View', exact: true }).click();
    const dlg = dialogOf(page);
    await expect(dlg.getByRole('heading', { name: 'NACA 2412' })).toBeVisible();
    // Read-only: name and attribution cannot be edited.
    await expect(dlg.getByLabel('Airfoil name')).toBeDisabled();
    await expect(dlg.getByLabel('Attribution')).toBeDisabled();
    await expect(dlg.getByLabel('Airfoil name')).toHaveValue('NACA 2412');
    // The airfoil is already in the project: there is nothing to add.
    const add = dlg.getByRole('button', { name: 'Add to project' });
    if (await add.count()) await expect(add, '"Add to project" in the View preview').toBeDisabled({ timeout: 2000 });
    await expect(add).toHaveCount(0);
    await dlg.getByRole('button', { name: 'Close' }).click();
    await expect(dialogOf(page)).toHaveCount(0);
    expect(await projectNames(page)).toEqual(['NACA 2412', 'NACA 2410']);
  });

  test('above 200 airfoils an added airfoil brings the size warning; at 10,000 the next one is refused before the preview', async ({ page }) => {
    test.slow();
    await startSport(page);
    await expect.poll(async () => (await savedProject(page))?.airfoils?.length).toBe(2);
    // Fill the autosaved project with five-point airfoils up to n, then reload.
    const fill = async (n) => {
      await page.evaluate(
        ([key, count]) => {
          const p = JSON.parse(localStorage.getItem(key));
          for (let i = p.airfoils.length; i < count; i++) p.airfoils.push({ id: `copy-${i}`, name: `Copy ${i}`, points: [[1, 0], [0.5, 0.05 + i * 1e-7], [0, 0], [0.5, -0.04], [1, 0]] });
          localStorage.setItem(key, JSON.stringify(p));
        },
        [STORAGE_KEY, n],
      );
      await page.reload();
      await openTab(page, 'Airfoils');
      await expect(sectionOf(page, 'Project airfoils').locator('li')).toHaveCount(n);
    };
    await fill(200);
    await nacaPreview(page, '4415');
    await dialogOf(page).getByRole('button', { name: 'Add to project' }).click();
    await expect(toastOf(page)).toHaveText(/^Added airfoil "NACA 4415"\. Large project: 201 airfoils \(warning above 200\)\. Each change takes (under 1 s|about [\d.]+ s) and about \d+ MB of browser memory\.$/);
    await expect.poll(async () => (await savedProject(page)).airfoils.length).toBe(201);
    await fill(10_000);
    await nacaPreview(page, '2415');
    await expect(toastOf(page)).toHaveText('The project holds 10,000 airfoils, the limit; "Remove unused" frees places.');
    await expect(dialogOf(page)).toHaveCount(0);
    // "Remove unused" frees the places; adding works again. A text locator: role queries compute
    // accessible names over the 30,000 buttons of the list and take minutes.
    await clickAndRefresh(page, page.locator('#pane-airfoils button:text-is("Remove unused")'));
    expect(await projectNames(page)).toEqual(['NACA 2412', 'NACA 2410']);
    await nacaPreview(page, '2415');
    await addFromPreview(page, 'NACA 2415');
    expect(await projectNames(page)).toEqual(['NACA 2412', 'NACA 2410', 'NACA 2415']);
  });
});
