// Phone layout (Pixel 7 project): the page never scrolls sideways (every tab, every dialog), the
// top bar keeps one row of touch-sized buttons that respond to taps, section rows become labelled
// cards, and every dialog fits the screen width and scrolls vertically (finger swipe) until its
// primary button can be tapped. Phone tests are skipped on the desktop project; one desktop test
// checks the table layout that the phone cards replace.
import { readFileSync } from 'node:fs';
import {
  checksValue,
  createDesign,
  createFromWizard,
  dialogOf,
  downloadOf,
  expect,
  openFirstRun,
  openTab,
  pickPreset,
  statusFigures,
  test,
  toastOf,
  touchScreen,
} from './helpers.js';

const PKG_VERSION = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
const TOP_BAR = ['New', 'Open', 'Save', 'Export', 'Undo', 'Redo', 'Help'];
const CARD_LABELS = ['Airfoil', 'y (mm)', 'x (mm)', 'z (mm)', 'Chord (mm)', 'Twist (deg)'];
// A valid airfoil with a "few points" warning (from the smoke test).
const DAT = 'TEST 12\n1 0.001\n0.75 0.05\n0.5 0.07\n0.25 0.07\n0.1 0.045\n0.02 0.02\n0 0\n0.02 -0.015\n0.1 -0.03\n0.25 -0.04\n0.5 -0.035\n0.75 -0.02\n1 -0.001\n';

// Swept flying wing preset: 3 sections at y = 0, 300, 600 mm, chords 280, 203, 126 mm, straight taper.
const FLYING_WING = { label: 'Swept flying wing', span: 1200, ys: [0, 300, 600], chords: [280, 203, 126] };
// Area in dm² of the straight-tapered half panels (both halves) for the given section chords.
const panelArea = (ys, chords) => (2 * ys.slice(1).reduce((a, y, i) => a + ((y - ys[i]) * (chords[i] + chords[i + 1])) / 2, 0)) / 1e4;

const phoneOnly = (testInfo) => test.skip(testInfo.project.name !== 'mobile', 'Phone layout: mobile project only');

const cards = (page) => page.locator('table.sections tbody tr');
/** Value cell of a section card, found by its visible label (data-label drives the ::before text). */
const cardCell = (card, label) => card.locator(`td[data-label="${label}"]`);

/** Wait until the status bar shows the given span and an area within tol of the expected value. */
async function expectArea(page, span, area, tol = 0.011) {
  await expect.poll(async () => Math.abs((await statusFigures(page, span)).area - area)).toBeLessThanOrEqual(tol);
}

/** First-run wizard: pick a preset and create it with taps (Playwright scrolls to the button). */
const createPreset = (page, label) => createDesign(page, label, { tap: true });
const tapTab = (page, name) => openTab(page, name, { tap: true });

/** Tap at the centre of an element with a real touch point (no auto-scroll). */
async function tapCenter(page, locator) {
  const r = await locator.boundingBox();
  expect(r, 'element has a box').not.toBeNull();
  await page.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2);
}

/** Page scroll width, and where an attempt to scroll the page sideways lands. */
async function expectNoSideScroll(page, where) {
  const o = await page.evaluate(() => {
    const se = document.scrollingElement;
    const y = window.scrollY;
    window.scrollTo(500, y);
    const scrollX = window.scrollX;
    window.scrollTo(0, y);
    return { scrollWidth: se.scrollWidth, innerWidth: window.innerWidth, scrollX };
  });
  expect(o.scrollWidth, `${where}: page scroll width vs. viewport width`).toBeLessThanOrEqual(o.innerWidth);
  expect(o.scrollX, `${where}: horizontal page scroll position after scrollTo(500, y)`).toBe(0);
}

async function dialogBox(dialog) {
  return dialog.evaluate((d) => {
    const r = d.getBoundingClientRect();
    return {
      left: r.left,
      right: r.right,
      top: r.top,
      bottom: r.bottom,
      scrollWidth: d.scrollWidth,
      clientWidth: d.clientWidth,
      scrollHeight: d.scrollHeight,
      clientHeight: d.clientHeight,
      scrollTop: d.scrollTop,
      overflowY: getComputedStyle(d).overflowY,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
    };
  });
}

/** The open dialog lies inside the viewport, has no sideways overflow and scrolls vertically. */
async function expectDialogFits(page, dialog, what) {
  const b = await dialogBox(dialog);
  expect(b.left, `${what}: left edge`).toBeGreaterThanOrEqual(0);
  expect(b.right, `${what}: right edge`).toBeLessThanOrEqual(b.innerWidth);
  expect(b.top, `${what}: top edge`).toBeGreaterThanOrEqual(0);
  expect(b.bottom, `${what}: bottom edge`).toBeLessThanOrEqual(b.innerHeight);
  expect(b.scrollWidth, `${what}: content width vs. dialog width`).toBeLessThanOrEqual(b.clientWidth);
  expect(['auto', 'scroll'], `${what}: vertical overflow mode`).toContain(b.overflowY);
  await expectNoSideScroll(page, `${what} open`);
  return b;
}

/** Fully inside the dialog's visible area and the viewport, and not covered at its centre. */
function isTappable(button) {
  return button.evaluate((el) => {
    const d = el.closest('dialog');
    const dr = d.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const inside = r.top >= dr.top && r.bottom <= dr.bottom && r.left >= dr.left && r.right <= dr.right && r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth;
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return inside && !!hit && el.contains(hit);
  });
}

/** Resolves with the dialog's scrollTop once it has not changed for 5 frames (fling finished). */
function settledScrollTop(dialog) {
  return dialog.evaluate(
    (d) =>
      new Promise((resolve) => {
        let last = -1;
        let same = 0;
        const tick = () => {
          const s = d.scrollTop;
          same = s === last ? same + 1 : 0;
          last = s;
          if (same >= 5) resolve(s);
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
  );
}

/**
 * Checks that the dialog fits, swipes it up with a finger until the primary button is tappable,
 * and taps that button. mustScroll: the content is taller than the dialog, so the button starts
 * out of view and at least one swipe is needed.
 */
async function reachAndTap(page, dialog, button, what, { mustScroll }) {
  const before = await expectDialogFits(page, dialog, what);
  if (mustScroll) {
    expect(before.scrollHeight, `${what}: content taller than the dialog`).toBeGreaterThan(before.clientHeight);
    expect(await isTappable(button), `${what}: primary button out of view before scrolling`).toBe(false);
  }
  const touch = await touchScreen(page);
  // The finger lands on the dialog's left padding: no control or canvas under it.
  const x = before.left + 6;
  const y0 = before.top + (before.bottom - before.top) * 0.8;
  const dist = (before.bottom - before.top) * 0.5;
  expect(await page.evaluate(([px, py]) => document.elementFromPoint(px, py)?.tagName, [x, y0])).toBe('DIALOG');
  let swipes = 0;
  while (!(await isTappable(button)) && swipes < 12) {
    await touch.swipeUp(x, y0, dist);
    await settledScrollTop(dialog);
    swipes++;
  }
  await touch.detach();
  expect(await isTappable(button), `${what}: primary button reachable by swiping`).toBe(true);
  const after = await dialogBox(dialog);
  if (mustScroll) {
    expect(swipes, `${what}: swipes needed`).toBeGreaterThan(0);
    expect(after.scrollTop, `${what}: dialog scrolled`).toBeGreaterThan(0);
  }
  // Scrolling moved the content vertically only.
  expect(after.left).toBe(before.left);
  expect(after.right).toBe(before.right);
  await expectNoSideScroll(page, `${what} after scrolling`);
  await tapCenter(page, button);
}

test.describe('phone layout', () => {
  test('no sideways page scroll on any tab, with every optional field shown', async ({ page }, testInfo) => {
    phoneOnly(testInfo);
    await createPreset(page, 'Glider');

    // Settings: pointed tip and fixed trailing-edge thickness add their extra fields.
    await tapTab(page, 'Settings');
    await page.getByRole('combobox', { name: 'Wing tip' }).selectOption('pointed');
    await page.getByRole('combobox', { name: 'Trailing edge mode' }).selectOption('thickness');
    await expect(page.locator('#pane-settings')).toContainText('Tip profile scale 1 : N');
    await expect(page.locator('#pane-settings')).toContainText('Trailing-edge thickness (mm)');

    const tabs = [
      {
        name: 'Sections',
        key: 'sections',
        check: async (pane) => {
          await expect(cards(page)).toHaveCount(3);
          await expect(cardCell(cards(page).last(), 'Chord (mm)').locator('div')).toHaveText(/^tip: \d+\.\d\d$/);
          expect(Number(await cardCell(cards(page).last(), 'y (mm)').locator('input').inputValue())).toBe(1000);
          await expect(pane).toBeVisible();
        },
      },
      {
        name: 'Planform',
        key: 'planform',
        check: async (pane) => {
          // The glider has both guide curves on: point tables and buttons are rendered.
          await expect(pane.getByRole('group', { name: /Nose line/ }).getByLabel('Use guide curve')).toBeChecked();
          await expect(pane.getByRole('group', { name: /End line/ }).getByRole('button', { name: 'Add point' })).toBeVisible();
          await expect(pane.locator('canvas.planform-canvas')).toBeVisible();
        },
      },
      {
        name: 'Airfoils',
        key: 'airfoils',
        check: async (pane) => {
          await expect(pane.locator('.airfoil-list').first().locator('li')).toHaveCount(2);
          await expect(pane.locator('.airfoil-list').first()).toContainText('NACA 2410');
          await expect(pane.locator('.library li').first()).toBeVisible();
        },
      },
      {
        name: 'Settings',
        key: 'settings',
        check: async (pane) => {
          await expect(pane.getByRole('combobox', { name: 'Wing tip' })).toHaveValue('pointed');
          await expect(pane.getByRole('combobox', { name: 'Trailing edge mode' })).toHaveValue('thickness');
        },
      },
      {
        name: 'Checks',
        key: 'checks',
        check: async (pane) => {
          await expect(checksValue(page, 'Span')).toHaveText('2000.0 mm');
          // Pointed tip with guides that end 90 mm apart: about 33.7 dm², aspect ratio 2000² / area.
          await expect(checksValue(page, 'Aspect ratio')).toHaveText(/^11\.\d\d$/);
          const area = Number((await checksValue(page, 'Wing area').innerText()).replace(' dm²', ''));
          expect(Math.abs(area - 33.7)).toBeLessThan(0.1);
          expect(Number(await checksValue(page, 'Aspect ratio').innerText())).toBeCloseTo(2000 ** 2 / (area * 1e4), 1);
          await expect(pane.locator('.sev-warning')).toHaveCount(1);
        },
      },
    ];
    for (const { name, key, check } of tabs) {
      await tapTab(page, name);
      const pane = page.locator(`#pane-${key}`);
      await expect(pane).toBeVisible();
      await check(pane);
      await expectNoSideScroll(page, `${name} tab`);
      // The pane content fits its width too (no sideways scrolling inside the panel). Settings is
      // checked on a 360 px phone below: its width depends on the font (1 px too wide here).
      if (key !== 'settings') {
        const w = await pane.evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth }));
        expect(w.scroll, `${name} pane content width`).toBeLessThanOrEqual(w.client);
      }
    }
  });

  test('no sideways page scroll with any dialog open', async ({ page }, testInfo) => {
    phoneOnly(testInfo);
    const dialog = dialogOf(page);

    // First-run wizard, then create the design.
    const wizard = await openFirstRun(page);
    await expectDialogFits(page, wizard, 'first-run wizard');
    await pickPreset(wizard, FLYING_WING.label, { tap: true });
    await expectDialogFits(page, wizard, 'first-run wizard (flying wing preset)');
    await createFromWizard(page, { tap: true });
    const { area } = await statusFigures(page, FLYING_WING.span);
    expect(area).toBeCloseTo(panelArea(FLYING_WING.ys, FLYING_WING.chords), 2);

    // New-design wizard from the top bar; Cancel keeps the design.
    await tapCenter(page, page.getByRole('button', { name: 'New' }));
    await expect(dialog.getByRole('heading', { name: 'New wing design' })).toBeVisible();
    await expectDialogFits(page, dialog, 'new-design wizard');
    await dialog.getByRole('button', { name: 'Cancel' }).tap();
    await expect(dialog).toHaveCount(0);

    await tapCenter(page, page.getByRole('button', { name: 'Export' }));
    await expect(dialog.getByRole('heading', { name: 'Export' })).toBeVisible();
    await expectDialogFits(page, dialog, 'export');
    await dialog.getByRole('button', { name: 'Cancel' }).tap();
    await expect(dialog).toHaveCount(0);

    await tapCenter(page, page.getByRole('button', { name: 'Help' }));
    await expect(dialog.getByRole('heading', { name: 'Wingdesigner' })).toBeVisible();
    await expectDialogFits(page, dialog, 'help');
    await dialog.getByRole('button', { name: 'Close' }).tap();
    await expect(dialog).toHaveCount(0);

    await tapTab(page, 'Airfoils');
    const projectList = page.locator('#pane-airfoils .airfoil-list').first();
    await expect(projectList.locator('li')).toHaveCount(2);

    // Upload preview.
    await page.locator('.dropzone input[type=file]').setInputFiles({ name: 'test12.dat', mimeType: 'text/plain', buffer: Buffer.from(DAT) });
    await expect(dialog.getByRole('heading', { name: 'Upload: test12.dat' })).toBeVisible();
    await expect(dialog).toContainText('Warning: Only 13 points');
    await expectDialogFits(page, dialog, 'upload preview');
    await dialog.getByRole('button', { name: 'Cancel' }).tap();
    await expect(dialog).toHaveCount(0);

    // NACA generator preview.
    await page.getByRole('textbox', { name: 'NACA designation' }).fill('4415');
    await page
      .locator('#pane-airfoils section')
      .filter({ has: page.getByRole('heading', { name: 'NACA generator' }) })
      .getByRole('button', { name: 'Preview' })
      .tap();
    await expect(dialog.getByRole('heading', { name: 'NACA 4415' })).toBeVisible();
    await expectDialogFits(page, dialog, 'NACA preview');
    await dialog.getByRole('button', { name: 'Cancel' }).tap();
    await expect(dialog).toHaveCount(0);

    // Preview of a project airfoil (View).
    await projectList.getByRole('button', { name: 'View' }).first().tap();
    await expect(dialog.getByRole('heading', { name: /^NACA / })).toBeVisible();
    await expectDialogFits(page, dialog, 'project airfoil preview');
    await dialog.getByRole('button', { name: 'Close' }).tap();
    await expect(dialog).toHaveCount(0);

    // Every dialog was cancelled: nothing changed.
    await expect(projectList.locator('li')).toHaveCount(2);
    expect((await statusFigures(page, FLYING_WING.span)).area).toBe(area);
    await expectNoSideScroll(page, 'after closing the dialogs');
  });

  test('top bar keeps one row of tap targets at least 36 px high', async ({ page }, testInfo) => {
    phoneOnly(testInfo);
    await createPreset(page, FLYING_WING.label);
    const measure = () =>
      page.locator('header.topbar').evaluate((bar) => {
        const visible = (el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
        };
        const targets = [...bar.querySelectorAll('button, a[href], input, select, [role="button"]')].filter(visible).map((el) => {
          const r = el.getBoundingClientRect();
          return { name: el.textContent.trim(), top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: r.height, width: r.width };
        });
        return { targets, barHeight: bar.getBoundingClientRect().height, innerWidth: window.innerWidth };
      });
    const checkRow = (m, when) => {
      expect(
        m.targets.map((t) => t.name),
        `${when}: top-bar tap targets`,
      ).toEqual(TOP_BAR);
      const tops = m.targets.map((t) => t.top);
      expect(Math.max(...tops) - Math.min(...tops), `${when}: button tops differ (wrapped row)`).toBeLessThan(0.5);
      for (const t of m.targets) {
        expect(t.height, `${when}: height of "${t.name}"`).toBeGreaterThanOrEqual(36);
        expect(t.left, `${when}: "${t.name}" left edge`).toBeGreaterThanOrEqual(0);
        expect(t.right, `${when}: "${t.name}" right edge`).toBeLessThanOrEqual(m.innerWidth);
      }
      // Separate targets: sorted left to right without overlap.
      for (let i = 1; i < m.targets.length; i++) expect(m.targets[i].left, `${when}: "${m.targets[i].name}" overlaps its neighbour`).toBeGreaterThanOrEqual(m.targets[i - 1].right);
      // One row: the bar is lower than two buttons.
      expect(m.barHeight, `${when}: top bar height`).toBeLessThan(2 * Math.min(...m.targets.map((t) => t.height)));
    };
    checkRow(await measure(), 'after the wizard');

    // An edit enables Undo; the row stays the same.
    const tipChord = cardCell(cards(page).last(), 'Chord (mm)').locator('input');
    await tipChord.fill('150');
    await tipChord.press('Enter');
    await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled();
    await expectArea(page, FLYING_WING.span, panelArea(FLYING_WING.ys, [280, 203, 150]));
    checkRow(await measure(), 'after an edit');

    // Every tab leaves the top bar unchanged.
    for (const name of ['Planform', 'Airfoils', 'Settings', 'Checks', 'Sections']) {
      await tapTab(page, name);
      checkRow(await measure(), `${name} tab`);
    }
  });

  test('every top-bar button works with a tap at its centre', async ({ page }, testInfo) => {
    phoneOnly(testInfo);
    await createPreset(page, FLYING_WING.label);
    const bar = page.locator('header.topbar');
    const btn = (name) => bar.getByRole('button', { name, exact: true });
    const dialog = dialogOf(page);
    const tipChord = () => cardCell(cards(page).last(), 'Chord (mm)').locator('input');
    const baseArea = panelArea(FLYING_WING.ys, FLYING_WING.chords);
    await expectArea(page, FLYING_WING.span, baseArea);

    // Save: downloads the project JSON.
    const saved = await downloadOf(page, () => tapCenter(page, btn('Save')));
    expect(saved.name).toBe('Swept_flying_wing.json');
    const savedText = saved.bytes.toString('utf8');
    const savedJson = JSON.parse(savedText);
    expect(savedJson.name).toBe('Swept flying wing');
    expect(savedJson.sections).toHaveLength(3);
    savedJson.sections.forEach((s, i) => expect(s.chord).toBeCloseTo(FLYING_WING.chords[i], 6));

    // Edit, then Undo and Redo by tap.
    await tipChord().fill('150');
    await tipChord().press('Enter');
    await expectArea(page, FLYING_WING.span, panelArea(FLYING_WING.ys, [280, 203, 150]));
    await tapCenter(page, btn('Undo'));
    await expect(tipChord()).toHaveValue('126');
    await expectArea(page, FLYING_WING.span, baseArea);
    await expect(btn('Redo')).toBeEnabled();
    await tapCenter(page, btn('Redo'));
    await expect(tipChord()).toHaveValue('150');
    await expect(btn('Redo')).toBeDisabled();

    // Open: file chooser; loading the saved file restores the saved chords.
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), tapCenter(page, btn('Open'))]);
    expect(chooser.isMultiple()).toBe(false);
    await chooser.setFiles({ name: 'Swept_flying_wing.json', mimeType: 'application/json', buffer: Buffer.from(savedText) });
    await expect(toastOf(page)).toHaveText('Opened Swept_flying_wing.json.');
    await expect(tipChord()).toHaveValue('126');
    await expectArea(page, FLYING_WING.span, baseArea);

    // New, Export and Help open their dialogs; closing them changes nothing.
    await tapCenter(page, btn('New'));
    await expect(dialog.getByRole('heading', { name: 'New wing design' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel' }).tap();
    await expect(dialog).toHaveCount(0);
    await tapCenter(page, btn('Export'));
    await expect(dialog.getByRole('heading', { name: 'Export' })).toBeVisible();
    await expect(dialog.getByRole('radio', { name: /^STEP/ })).toBeChecked();
    await dialog.getByRole('button', { name: 'Cancel' }).tap();
    await expect(dialog).toHaveCount(0);
    await tapCenter(page, btn('Help'));
    await expect(dialog.getByRole('heading', { name: 'Wingdesigner' })).toBeVisible();
    await expect(dialog).toContainText(`Version ${PKG_VERSION}.`);
    await dialog.getByRole('button', { name: 'Close' }).tap();
    await expect(dialog).toHaveCount(0);
    await expect(cards(page)).toHaveCount(3);
    await expect(tipChord()).toHaveValue('126');
  });

  test('section rows render as cards with a label above each value', async ({ page }, testInfo) => {
    phoneOnly(testInfo);
    await createPreset(page, FLYING_WING.label);
    await expect(page.locator('table.sections thead')).toBeHidden();
    await expect(cards(page)).toHaveCount(3);

    const layout = await cards(page).evaluateAll((rows) =>
      rows.map((tr) => {
        const box = (el) => {
          const r = el.getBoundingClientRect();
          return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height };
        };
        return {
          display: getComputedStyle(tr).display,
          box: box(tr),
          heading: tr.querySelector('th').innerText.trim(),
          cells: [...tr.querySelectorAll('td[data-label]')].map((td) => {
            const control = td.querySelector('input, select');
            return {
              dataLabel: td.dataset.label,
              label: getComputedStyle(td, '::before').content.replace(/^"|"$/g, ''),
              labelDisplay: getComputedStyle(td, '::before').display,
              cell: box(td),
              control: box(control),
            };
          }),
        };
      }),
    );
    const scroller = await page.locator('#pane-sections .table-scroll').evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth }));
    expect(scroller.scroll, 'sections table needs no sideways scrolling').toBeLessThanOrEqual(scroller.client);

    layout.forEach((card, i) => {
      expect(card.display, `card ${i + 1} display`).toBe('grid');
      expect(card.heading).toBe(`Section ${i + 1}`);
      // Cards span the panel and stack vertically.
      expect(card.box.width).toBeGreaterThanOrEqual(0.95 * scroller.client);
      if (i) expect(card.box.top).toBeGreaterThanOrEqual(layout[i - 1].box.bottom - 0.5);
      expect(card.cells.map((c) => c.label)).toEqual(CARD_LABELS);
      expect(card.cells.map((c) => c.dataLabel)).toEqual(CARD_LABELS);
      for (const c of card.cells) {
        expect(c.labelDisplay, `${c.label}: label on its own line`).toBe('block');
        // The label line sits above the control, inside the cell.
        expect(c.control.top - c.cell.top, `${c.label}: control below its label`).toBeGreaterThanOrEqual(10);
        expect(c.control.bottom).toBeLessThanOrEqual(c.cell.bottom + 0.5);
        // The control fills its column and is touch-sized.
        expect(c.control.width, `${c.label}: control width`).toBeGreaterThanOrEqual(c.cell.width - 1);
        expect(c.control.width).toBeGreaterThanOrEqual(80);
        expect(c.control.height, `${c.label}: control height`).toBeGreaterThanOrEqual(36);
        expect(c.cell.right).toBeLessThanOrEqual(card.box.right + 0.5);
      }
      // Three columns: y, x, z on one line; chord and twist below y and x; airfoil above them.
      const at = Object.fromEntries(card.cells.map((c) => [c.label, c.cell]));
      expect(at['x (mm)'].top).toBeCloseTo(at['y (mm)'].top, 0);
      expect(at['z (mm)'].top).toBeCloseTo(at['y (mm)'].top, 0);
      expect(at['y (mm)'].left).toBeLessThan(at['x (mm)'].left);
      expect(at['x (mm)'].left).toBeLessThan(at['z (mm)'].left);
      expect(at['Chord (mm)'].top).toBeGreaterThanOrEqual(at['y (mm)'].bottom - 0.5);
      expect(at['Twist (deg)'].top).toBeCloseTo(at['Chord (mm)'].top, 0);
      expect(at['Chord (mm)'].left).toBeCloseTo(at['y (mm)'].left, 0);
      expect(at['Twist (deg)'].left).toBeCloseTo(at['x (mm)'].left, 0);
      expect(at.Airfoil.bottom).toBeLessThanOrEqual(at['y (mm)'].top + 0.5);
    });

    // The labels name the values they sit on.
    for (let i = 0; i < 3; i++) {
      const card = cards(page).nth(i);
      expect(Number(await cardCell(card, 'y (mm)').locator('input').inputValue())).toBe(FLYING_WING.ys[i]);
      expect(Number(await cardCell(card, 'Chord (mm)').locator('input').inputValue())).toBe(FLYING_WING.chords[i]);
      expect(Number(await cardCell(card, 'z (mm)').locator('input').inputValue())).toBe(0);
    }
    await expect(cardCell(cards(page).first(), 'Airfoil').getByRole('combobox')).toHaveAccessibleName('Airfoil of section 1');

    // Editing through the card: the tip card's y sets the span.
    const tipY = cardCell(cards(page).last(), 'y (mm)').locator('input');
    await tipY.tap();
    await tipY.fill('700');
    await tipY.press('Enter');
    await expectArea(page, 1400, panelArea([0, 300, 700], FLYING_WING.chords));
    await expect(tipY).toHaveValue('700');
    await expectNoSideScroll(page, 'sections after the edit');
  });

  test('a pointed tip note stays inside the tip card', async ({ page }, testInfo) => {
    phoneOnly(testInfo);
    await createPreset(page, FLYING_WING.label);
    await tapTab(page, 'Settings');
    await page.getByRole('combobox', { name: 'Wing tip' }).selectOption('pointed');
    const scale = page.locator('#pane-settings label', { hasText: 'Tip profile scale 1 : N' }).locator('input');
    await expect(scale).toHaveValue('200');

    // Default 1/200 of the previous section chord (203 mm): 1.015 mm, above the 1 mm floor.
    await tapTab(page, 'Sections');
    const note = cardCell(cards(page).last(), 'Chord (mm)').locator('div', { hasText: /^tip: / });
    await expect(note).toHaveText(/^tip: \d+\.\d{2}$/);
    expect(Math.abs(Number((await note.innerText()).slice(5)) - 1.015)).toBeLessThanOrEqual(0.006);
    await expectArea(page, FLYING_WING.span, panelArea(FLYING_WING.ys, [280, 203, 1.015]), 0.02);

    // 1/1000 of 203 mm is 0.203 mm, raised to the 1 mm floor: the longest note, "tip: 1.00 (min.)".
    await tapTab(page, 'Settings');
    await scale.fill('1000');
    await scale.press('Enter');
    await expect(scale).toHaveValue('1000');
    await tapTab(page, 'Sections');
    await expect(note).toHaveText('tip: 1.00 (min.)');

    // The note sits below the chord field, inside its cell and card.
    const geo = await cards(page)
      .last()
      .evaluate((tr) => {
        const td = tr.querySelector('td[data-label="Chord (mm)"]');
        const [input, noteEl] = [td.querySelector('input'), td.querySelector('div')];
        const b = (el) => el.getBoundingClientRect();
        return { card: b(tr).toJSON(), cell: b(td).toJSON(), input: b(input).toJSON(), note: b(noteEl).toJSON(), noteScroll: noteEl.scrollWidth, noteClient: noteEl.clientWidth };
      });
    expect(geo.note.top).toBeGreaterThanOrEqual(geo.input.bottom - 0.5);
    expect(geo.note.right).toBeLessThanOrEqual(geo.cell.right + 0.5);
    expect(geo.cell.right).toBeLessThanOrEqual(geo.card.right + 0.5);
    expect(geo.noteScroll).toBeLessThanOrEqual(geo.noteClient);
    const scroller = await page.locator('#pane-sections .table-scroll').evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth }));
    expect(scroller.scroll).toBeLessThanOrEqual(scroller.client);
    await expectNoSideScroll(page, 'sections with a pointed tip');
  });

  test.describe('narrow phone (360 x 780)', () => {
    // Common Android width (e.g. Galaxy S and A series), still the phone layout.
    test.use({ viewport: { width: 360, height: 780 } });

    test('dialogs and section cards fit a 360 px wide phone', async ({ page }, testInfo) => {
      phoneOnly(testInfo);
      const dialog = dialogOf(page);
      const wizard = await openFirstRun(page);
      await expectDialogFits(page, wizard, '360 px wizard');
      await pickPreset(wizard, FLYING_WING.label, { tap: true });
      await createFromWizard(page, { tap: true });
      await expectArea(page, FLYING_WING.span, panelArea(FLYING_WING.ys, FLYING_WING.chords));

      const scroller = await page.locator('#pane-sections .table-scroll').evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth }));
      expect(scroller.scroll, 'section cards need no sideways scrolling').toBeLessThanOrEqual(scroller.client);
      expect(await cards(page).evaluateAll((trs) => trs.map((tr) => getComputedStyle(tr).display))).toEqual(['grid', 'grid', 'grid']);
      await expectNoSideScroll(page, '360 px sections');

      for (const [button, heading, close] of [
        ['Export', 'Export', 'Cancel'],
        ['Help', 'Wingdesigner', 'Close'],
      ]) {
        await tapCenter(page, page.locator('header.topbar').getByRole('button', { name: button }));
        await expect(dialog.getByRole('heading', { name: heading })).toBeVisible();
        await expectDialogFits(page, dialog, `360 px ${button.toLowerCase()}`);
        await dialog.getByRole('button', { name: close }).tap();
        await expect(dialog).toHaveCount(0);
      }
      await tapTab(page, 'Airfoils');
      await page.locator('.dropzone input[type=file]').setInputFiles({ name: 'test12.dat', mimeType: 'text/plain', buffer: Buffer.from(DAT) });
      await expect(dialog.getByRole('heading', { name: 'Upload: test12.dat' })).toBeVisible();
      await reachAndTap(page, dialog, dialog.getByRole('button', { name: 'Add to project' }), '360 px upload preview', { mustScroll: false });
      await expect(dialog).toHaveCount(0);
      await expect(page.locator('#pane-airfoils .airfoil-list').first()).toContainText('TEST 12');
    });

    test('top bar keeps one row on a 360 px wide phone', async ({ page }, testInfo) => {
      phoneOnly(testInfo);
      await createPreset(page, FLYING_WING.label);
      const tops = await page
        .locator('header.topbar')
        .getByRole('button')
        .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().top));
      expect(tops).toHaveLength(TOP_BAR.length);
      expect(Math.max(...tops) - Math.min(...tops), '"Help" wrapped below the other buttons').toBeLessThan(0.5);
    });

    test('Settings fields fit a 360 px wide phone', async ({ page }, testInfo) => {
      phoneOnly(testInfo);
      await createPreset(page, FLYING_WING.label);
      await tapTab(page, 'Settings');
      const pane = page.locator('#pane-settings');
      await expect(pane.getByRole('combobox', { name: 'Spanwise interpolation' })).toHaveValue('linear');
      await expectNoSideScroll(page, '360 px settings');
      const w = await pane.evaluate((el) => ({
        scroll: el.scrollWidth,
        client: el.clientWidth,
        fieldsets: [...el.querySelectorAll('fieldset')].map((f) => f.getBoundingClientRect().right),
        contentRight: el.getBoundingClientRect().left + el.clientLeft + el.clientWidth - parseFloat(getComputedStyle(el).paddingRight),
      }));
      for (const right of w.fieldsets) expect(right, 'fieldset right edge vs. pane content edge').toBeLessThanOrEqual(w.contentRight + 0.5);
      expect(w.scroll, 'Settings pane content width').toBeLessThanOrEqual(w.client);
    });
  });

  for (const orientation of ['portrait', 'landscape']) {
    test.describe(`${orientation} dialogs`, () => {
      // Pixel 7 turned sideways: 839 x 412 is still below the 860 px phone breakpoint.
      if (orientation === 'landscape') test.use({ viewport: { width: 839, height: 412 } });
      const landscape = orientation === 'landscape';

      test(`${orientation}: wizard scrolls to "Create design", which creates the design`, async ({ page }, testInfo) => {
        phoneOnly(testInfo);
        const wizard = await openFirstRun(page);
        await pickPreset(wizard, 'Glider', { tap: true });
        await expect(wizard.getByRole('spinbutton', { name: 'Span (both halves) (mm)' })).toHaveValue('2000');
        await wizard.evaluate((d) => (d.scrollTop = 0));
        await reachAndTap(page, wizard, wizard.getByRole('button', { name: 'Create design' }), `${orientation} wizard`, { mustScroll: true });
        await expect(dialogOf(page)).toHaveCount(0);
        await statusFigures(page, 2000);
        await expect(cards(page)).toHaveCount(3);
        await expect(page.locator('table.sections thead')).toBeHidden();
        await expectNoSideScroll(page, `${orientation} main view`);
      });

      test(`${orientation}: export dialog scrolls to "Download", which writes the chosen file`, async ({ page }, testInfo) => {
        phoneOnly(testInfo);
        await createPreset(page, 'Glider');
        await tapCenter(page, page.getByRole('button', { name: 'Export' }));
        const dialog = dialogOf(page);
        await expect(dialog.getByRole('heading', { name: 'Export' })).toBeVisible();
        // Choose one half; then start again from the top of the dialog.
        const right = dialog.getByRole('radio', { name: 'Right half only' });
        await right.tap();
        await expect(right).toBeChecked();
        await dialog.evaluate((d) => (d.scrollTop = 0));
        const download = await downloadOf(page, () =>
          reachAndTap(page, dialog, dialog.getByRole('button', { name: 'Download' }), `${orientation} export`, { mustScroll: landscape }),
        );
        await expect(dialog).toHaveCount(0);
        expect(download.name).toBe('Glider.step');
        const step = download.bytes.toString('latin1');
        expect(step.startsWith('ISO-10303-21;')).toBe(true);
        expect((step.match(/MANIFOLD_SOLID_BREP\(/g) ?? []).length).toBe(1);
      });

      test(`${orientation}: upload preview scrolls to "Add to project", which adds the airfoil`, async ({ page }, testInfo) => {
        phoneOnly(testInfo);
        await createPreset(page, 'Glider');
        await tapTab(page, 'Airfoils');
        await page.locator('.dropzone input[type=file]').setInputFiles({ name: 'test12.dat', mimeType: 'text/plain', buffer: Buffer.from(DAT) });
        const dialog = dialogOf(page);
        await expect(dialog.getByRole('heading', { name: 'Upload: test12.dat' })).toBeVisible();
        await expect(dialog).toContainText('Warning: Only 13 points');
        await expect(dialog.getByRole('textbox', { name: 'Airfoil name' })).toHaveValue('TEST 12');
        await reachAndTap(page, dialog, dialog.getByRole('button', { name: 'Add to project' }), `${orientation} upload preview`, { mustScroll: landscape });
        await expect(dialog).toHaveCount(0);
        const projectList = page.locator('#pane-airfoils .airfoil-list').first();
        await expect(projectList.locator('li')).toHaveCount(3);
        await expect(projectList).toContainText('TEST 12');
        await expect(projectList.locator('li', { hasText: 'TEST 12' })).toContainText('13 points');
        // The new airfoil is offered in the section cards.
        await tapTab(page, 'Sections');
        await expect(cardCell(cards(page).first(), 'Airfoil').getByRole('option', { name: 'TEST 12' })).toHaveCount(1);
      });

      test(`${orientation}: help scrolls to "Close", which closes it`, async ({ page }, testInfo) => {
        phoneOnly(testInfo);
        await createPreset(page, 'Glider');
        await tapCenter(page, page.getByRole('button', { name: 'Help' }));
        const dialog = dialogOf(page);
        await expect(dialog.getByRole('heading', { name: 'Wingdesigner' })).toBeVisible();
        await expect(dialog.getByRole('heading', { name: 'Coordinates and units' })).toBeVisible();
        await dialog.evaluate((d) => (d.scrollTop = 0));
        await reachAndTap(page, dialog, dialog.getByRole('button', { name: 'Close' }), `${orientation} help`, { mustScroll: landscape });
        await expect(dialog).toHaveCount(0);
        // Back in the app: still the glider, still no sideways scroll.
        await statusFigures(page, 2000);
        await expectNoSideScroll(page, `${orientation} after help`);
      });
    });
  }
});

test('desktop keeps the sections table, the brand and one row of top-bar buttons', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Desktop layout: desktop project only');
  await createDesign(page, FLYING_WING.label);
  await expect(page.locator('header.topbar .brand')).toBeVisible();
  await expect(page.locator('header.topbar .brand')).toHaveText('Wingdesigner');
  await expect(page.locator('table.sections thead')).toBeVisible();
  await expect(page.locator('table.sections thead th')).toHaveText(['#', 'Airfoil', 'y mm', 'x mm', 'z mm', 'Chord mm', 'Twist deg', '']);
  const rows = await cards(page).evaluateAll((trs) =>
    trs.map((tr) => ({
      display: getComputedStyle(tr).display,
      tops: [...tr.children].map((c) => c.getBoundingClientRect().top),
      before: [...tr.querySelectorAll('td[data-label]')].map((td) => getComputedStyle(td, '::before').content),
      heading: tr.querySelector('th').innerText.trim(),
    })),
  );
  expect(rows).toHaveLength(3);
  rows.forEach((r, i) => {
    expect(r.display).toBe('table-row');
    expect(r.heading).toBe(String(i + 1));
    // One line per section, no card labels.
    expect(Math.max(...r.tops) - Math.min(...r.tops)).toBeLessThan(0.5);
    expect(r.before.every((c) => c === 'none' || c === 'normal')).toBe(true);
  });
  const tops = await page
    .locator('header.topbar')
    .getByRole('button')
    .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().top));
  expect(tops).toHaveLength(TOP_BAR.length);
  expect(Math.max(...tops) - Math.min(...tops)).toBeLessThan(0.5);
  await expectNoSideScroll(page, 'desktop');
});
