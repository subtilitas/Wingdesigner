// Planform tab: nose line and end line switches with their point tables, dragging guide points and
// section trailing-edge handles on the canvas (mouse and touch), Add point / Remove selected point /
// Reset to sections, mode and degree, crossing guide lines, and pinch zoom on phones.
//
// Canvas positions are computed from the editor's own transform: after "Fit" the view shows the
// bounds of the sections and enabled guide points (mirrored half included when "Mirror" is on) with a
// 24 px margin; span y runs to the right, chord x downwards (see src/ui/planform.js, panzoom.js).
import {
  STORAGE_KEY,
  VALID_RE,
  createDesign,
  dialogOf,
  expect,
  frames,
  openTab,
  savedProject,
  sectionRows,
  sectionValues as tableValues,
  statusFigures,
  statusOf as status,
  test,
  touchScreen,
  whenRerendered,
} from './helpers.js';

const LABEL = { nose: 'Nose line (leading edge)', end: 'End line (trailing edge)' };
const FIT_MARGIN = 24; // PanZoomCanvas.fitBounds default margin in CSS pixels

const pane = (page) => page.locator('#pane-planform');
const canvasOf = (page) => pane(page).locator('canvas.planform-canvas');
const readout = (page) => pane(page).locator('.readout');
const group = (page, key) => pane(page).getByRole('group', { name: LABEL[key] });
const guideRows = (page, key) => group(page, key).locator('tbody tr');
const useGuide = (page, key) => group(page, key).getByRole('checkbox', { name: 'Use guide curve' });
const modeSelect = (page, key) => group(page, key).getByRole('combobox', { name: 'Mode' });
const degreeSelect = (page, key) => group(page, key).getByRole('combobox', { name: 'Degree' });
const guideButton = (page, key, name) => group(page, key).getByRole('button', { name, exact: true });
/** The "guide: ..." note under a section value (x or chord) when a guide curve overrides it. */
const sectionNote = (page, row, key) =>
  sectionRows(page)
    .nth(row)
    .locator('td')
    .nth(key === 'x' ? 2 : 4)
    .locator('div.muted');
const fmt1 = (v) => String(Number(v.toFixed(1)));

async function openPlanform(page) {
  await openTab(page, 'Planform');
  await expect(canvasOf(page)).toBeVisible();
}

/** Key figures from the status bar (waits until it shows a design without errors and warnings). */
const figures = (page) => statusFigures(page, undefined, { clean: true });

/** Section y, x and chord from the (always rendered) section table, sorted by span as displayed. */
const sectionValues = (page) => tableValues(page, ['y', 'x', 'chord']);

/** Guide points [x, y] as shown in the point table (end point y is plain text, the rest inputs). */
async function guidePoints(page, key) {
  return guideRows(page, key).evaluateAll((trs) =>
    trs.map((tr) =>
      [...tr.querySelectorAll('td')].slice(1, 3).map((td) => {
        const input = td.querySelector('input');
        return Number(input ? input.value : td.textContent);
      }),
    ),
  );
}

function expectPointsClose(actual, expected, tol = 1e-6) {
  expect(actual).toHaveLength(expected.length);
  actual.forEach((p, i) => {
    expect(Math.abs(p[0] - expected[i][0]), `point ${i + 1} x: ${p[0]} vs ${expected[i][0]}`).toBeLessThanOrEqual(tol);
    expect(Math.abs(p[1] - expected[i][1]), `point ${i + 1} y: ${p[1]} vs ${expected[i][1]}`).toBeLessThanOrEqual(tol);
  });
}

/** Run an action and wait until the planform forms were re-rendered by the following rebuild. */
const afterRebuild = (page, action) => whenRerendered(pane(page).locator('fieldset.guide'), action);

async function setNumber(input, value) {
  await input.fill(String(value));
  await input.press('Enter');
}

/** Screenshot of the planform canvas; the overlaid toolbar (hover and pressed styles) is masked. */
const canvasShot = (page) => canvasOf(page).screenshot({ mask: [pane(page).locator('.canvas-wrap .toolbar')] });

function makeView(geo, scale, ox, oy) {
  return {
    geo,
    scale,
    ox,
    oy,
    /** Canvas-local pixel position of planform point (chord x, span y). */
    toLocal: (x, y) => ({ x: ox + y * scale, y: oy + x * scale }),
    /** Page (viewport) position of planform point (chord x, span y). */
    toPage: (x, y) => ({ x: geo.left + ox + y * scale, y: geo.top + oy + x * scale }),
    localToPage: (p) => ({ x: geo.left + p.x, y: geo.top + p.y }),
    /** The view after a pinch zoom by k about the canvas-local point c. */
    zoomed: (c, k) => makeView(geo, scale * k, c.x - (c.x - ox) * k, c.y - (c.y - oy) * k),
  };
}

/**
 * Click "Fit" and return the resulting view transform, computed like PlanformEditor.bounds() and
 * PanZoomCanvas.fitBounds(): sections (x .. x + chord) and enabled guide points, world [y, -x].
 */
async function planformView(page) {
  const canvas = canvasOf(page);
  await canvas.scrollIntoViewIfNeeded();
  await pane(page).getByRole('button', { name: 'Fit', exact: true }).click();
  await frames(page);
  const geo = await canvas.evaluate((c) => {
    const r = c.getBoundingClientRect();
    return { left: r.left, top: r.top, w: c.clientWidth, h: c.clientHeight };
  });
  const secs = await sectionValues(page);
  let ymin = Infinity;
  let ymax = -Infinity;
  let xmin = Infinity;
  let xmax = -Infinity;
  for (const s of secs) {
    ymin = Math.min(ymin, s.y);
    ymax = Math.max(ymax, s.y);
    xmin = Math.min(xmin, s.x);
    xmax = Math.max(xmax, s.x + s.chord);
  }
  for (const key of ['nose', 'end']) {
    if (!(await useGuide(page, key).isChecked())) continue;
    for (const [x] of await guidePoints(page, key)) {
      xmin = Math.min(xmin, x);
      xmax = Math.max(xmax, x);
    }
  }
  const mirror = await pane(page).getByRole('checkbox', { name: 'Mirror' }).isChecked();
  const [bx0, by0, bx1, by1] = [mirror ? -ymax : ymin, -xmax, ymax, -xmin];
  const scale = Math.min((geo.w - 2 * FIT_MARGIN) / Math.max(bx1 - bx0, 1e-9), (geo.h - 2 * FIT_MARGIN) / Math.max(by1 - by0, 1e-9));
  const ox = geo.w / 2 - ((bx0 + bx1) / 2) * scale;
  const oy = geo.h / 2 + ((by0 + by1) / 2) * scale;
  return makeView(geo, scale, ox, oy);
}

async function mouseDrag(page, from, to, steps = 12) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps });
  await page.mouse.up();
  await frames(page); // the last move's rebuild (scheduled with requestAnimationFrame) has run
}

/** Screen positions (canvas-local) of every draggable handle of the current design. */
async function handlePositions(page, v) {
  const out = [];
  const on = {};
  for (const key of ['nose', 'end']) {
    on[key] = await useGuide(page, key).isChecked();
    if (on[key]) for (const [x, y] of await guidePoints(page, key)) out.push(v.toLocal(x, y));
  }
  for (const s of await sectionValues(page)) {
    if (!on.nose) out.push(v.toLocal(s.x, s.y));
    if (!on.end) out.push(v.toLocal(s.x + s.chord, s.y));
  }
  return out;
}

test.describe('Planform tab', () => {
  test('Fit shows the evaluated guide curve and the built outline, also where a guide overshoots', async ({ page }) => {
    await createDesign(page, 'Sport');
    // End line through points 0.001 mm apart near the root: the cubic swings to x = -53,087 mm and the
    // wing, which follows the end line, moves with it.
    const p = await savedProject(page);
    const te = p.sections[0].x + p.sections[0].chord;
    p.guides.end = { mode: 'fit', degree: 3, points: [[te, 0], [te + 0.001, 0.1], [te, 0.11], [te, 600]], enabled: true, edited: true };
    await page.evaluate(([key, project]) => localStorage.setItem(key, JSON.stringify(project)), [STORAGE_KEY, p]);
    await page.reload();
    await expect(status(page)).toHaveText(VALID_RE);
    await openTab(page, 'Planform');
    await canvasOf(page).scrollIntoViewIfNeeded();
    await pane(page).getByRole('button', { name: 'Fit', exact: true }).click();
    await frames(page);
    // Rows of the canvas that hold the orange end line: the whole curve lies inside, with a margin.
    const rows = await canvasOf(page).evaluate((c) => {
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      const tinted = [];
      for (let y = 0; y < c.height; y++) {
        for (let x = 0; x < c.width; x++) {
          const i = 4 * (y * c.width + x);
          if (d[i] > d[i + 2] + 80 && d[i] > d[i + 1] + 40) {
            tinted.push(y);
            break;
          }
        }
      }
      return { first: tinted[0], last: tinted.at(-1), height: c.height };
    });
    expect(rows.first).toBeGreaterThan(0);
    expect(rows.last).toBeLessThan(rows.height - 1);
    expect(rows.last - rows.first).toBeGreaterThan(0.5 * rows.height);
  });

  test('nose line and end line switches show point tables through the section edges', async ({ page }) => {
    await createDesign(page, 'Swept flying wing');
    const secs = await sectionValues(page);
    expect(secs).toHaveLength(3);
    await openPlanform(page);
    const before = await figures(page);

    for (const key of ['nose', 'end']) {
      await expect(useGuide(page, key)).not.toBeChecked();
      await expect(group(page, key).locator('table')).toHaveCount(0);
      await expect(group(page, key)).toContainText(key === 'nose' ? 'Off: the leading edge follows the section x positions.' : 'Off: the trailing edge follows the section chords.');
      await expect(modeSelect(page, key)).toBeDisabled();
      await expect(degreeSelect(page, key)).toBeDisabled();
      await expect(guideButton(page, key, 'Add point')).toHaveCount(0);
    }

    // Nose line on: one point per section leading edge, the end line stays off.
    await useGuide(page, 'nose').check();
    await expect(guideRows(page, 'nose')).toHaveCount(3);
    expectPointsClose(
      await guidePoints(page, 'nose'),
      secs.map((s) => [s.x, s.y]),
    );
    await expect(guideRows(page, 'nose').locator('td:first-child')).toHaveText(['1', '2', '3']);
    await expect(modeSelect(page, 'nose')).toBeEnabled();
    await expect(modeSelect(page, 'nose')).toHaveValue('fit');
    await expect(degreeSelect(page, 'nose')).toHaveValue('3');
    // Root and tip points keep their span position (y shown as text); inner points edit x and y.
    await expect(guideRows(page, 'nose').nth(0).getByRole('spinbutton')).toHaveCount(1);
    await expect(guideRows(page, 'nose').nth(1).getByRole('spinbutton')).toHaveCount(2);
    await expect(guideRows(page, 'nose').nth(2).getByRole('spinbutton')).toHaveCount(1);
    await expect(group(page, 'end').locator('table')).toHaveCount(0);
    await expect(modeSelect(page, 'end')).toBeDisabled();

    // End line on: one point per section trailing edge.
    await useGuide(page, 'end').check();
    await expect(guideRows(page, 'end')).toHaveCount(3);
    expectPointsClose(
      await guidePoints(page, 'end'),
      secs.map((s) => [s.x + s.chord, s.y]),
      1e-3,
    );
    await expect(guideButton(page, 'end', 'Add point')).toBeVisible();
    // Guides through the section edges keep the (straight, tapered) planform.
    expect((await figures(page)).text).toBe(before.text);

    // Both switches and points survive a reload (autosave); the Planform tab stays selected.
    await page.reload();
    await expect(dialogOf(page)).toHaveCount(0);
    await expect(page.getByRole('tab', { name: 'Planform' })).toHaveAttribute('aria-selected', 'true');
    await expect(useGuide(page, 'nose')).toBeChecked();
    await expect(useGuide(page, 'end')).toBeChecked();
    expectPointsClose(
      await guidePoints(page, 'nose'),
      secs.map((s) => [s.x, s.y]),
    );
    expectPointsClose(
      await guidePoints(page, 'end'),
      secs.map((s) => [s.x + s.chord, s.y]),
      1e-3,
    );
    expect((await figures(page)).text).toBe(before.text);

    // Switching the nose line off removes only its table.
    await useGuide(page, 'nose').uncheck();
    await expect(group(page, 'nose').locator('table')).toHaveCount(0);
    await expect(group(page, 'nose')).toContainText('Off: the leading edge follows the section x positions.');
    await expect(guideRows(page, 'end')).toHaveCount(3);
    expect((await figures(page)).text).toBe(before.text);
  });

  test('dragging a nose-line point with the mouse moves it in the table; one undo restores it', async ({ page }) => {
    await createDesign(page, 'Swept flying wing');
    await openPlanform(page);
    await useGuide(page, 'nose').check();
    await useGuide(page, 'end').check();
    await expect(guideRows(page, 'end')).toHaveCount(3);
    const before = await figures(page);
    const nose0 = await guidePoints(page, 'nose');
    const end0 = await guidePoints(page, 'end');

    const v = await planformView(page);
    const [x0, y0] = nose0[1];
    const target = x0 + 60; // 60 mm aft = downwards on the screen
    await mouseDrag(page, v.toPage(x0, y0), v.toPage(target, y0));

    const tol = 1.5 / v.scale + 0.1; // pointer position rounding (px) plus 0.1 mm snapping
    await expect.poll(async () => (await guidePoints(page, 'nose'))[1][0]).toBeGreaterThan(x0 + 30);
    const nose1 = await guidePoints(page, 'nose');
    expect(Math.abs(nose1[1][0] - target)).toBeLessThanOrEqual(tol);
    expect(Math.abs(nose1[1][1] - y0)).toBeLessThanOrEqual(tol);
    expect(nose1[0]).toEqual(nose0[0]);
    expect(nose1[2]).toEqual(nose0[2]);
    expect(await guidePoints(page, 'end')).toEqual(end0);
    await expect(guideRows(page, 'nose').nth(1)).toHaveClass(/selected/);
    await expect(readout(page)).toHaveText(`Nose line (leading edge) point 2: x ${fmt1(nose1[1][0])} mm, y ${fmt1(nose1[1][1])} mm`);

    // The wing follows: section 2 gets its leading edge and chord from the guides.
    const after = await figures(page);
    expect(after.area).toBeLessThan(before.area);
    await expect(sectionNote(page, 1, 'x')).toHaveText(/^guide: -?[\d.]+$/);
    const noteX = Number((await sectionNote(page, 1, 'x').innerText()).replace('guide: ', ''));
    const noteChord = Number((await sectionNote(page, 1, 'chord').innerText()).replace('guide: ', ''));
    expect(Math.abs(noteX - nose1[1][0])).toBeLessThanOrEqual(0.5);
    expect(Math.abs(noteChord - (end0[1][0] - nose1[1][0]))).toBeLessThanOrEqual(0.5);

    // The whole drag is one undo step.
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect.poll(() => guidePoints(page, 'nose')).toEqual(nose0);
    await expect(status(page)).toHaveText(before.text);
  });

  test('dragging a section trailing-edge handle without guides changes the chord', async ({ page }) => {
    await createDesign(page, 'Swept flying wing');
    await openPlanform(page);
    const secs0 = await sectionValues(page);
    expect(secs0.map((s) => [s.y, s.chord])).toEqual([
      [0, 280],
      [300, 203],
      [600, 126],
    ]);
    const before = await figures(page);

    // Without the mirrored half the fitted view shows the half wing larger.
    const mirrored = await planformView(page);
    await page.mouse.move(mirrored.geo.left + 5, mirrored.geo.top + mirrored.geo.h + 20);
    const shotMirror = await canvasShot(page);
    await pane(page).getByRole('checkbox', { name: 'Mirror' }).uncheck();
    const v = await planformView(page);
    expect(v.scale).toBeGreaterThan(mirrored.scale * 1.2);
    await page.mouse.move(v.geo.left + 5, v.geo.top + v.geo.h + 20);
    expect(Buffer.compare(shotMirror, await canvasShot(page))).not.toBe(0);
    const s = secs0[1];
    const target = s.x + s.chord + 50; // trailing edge 50 mm further aft
    // Move sideways as well: a trailing-edge handle changes only the chord.
    await mouseDrag(page, v.toPage(s.x + s.chord, s.y), v.toPage(target, s.y + 40));

    const tol = 1.5 / v.scale + 0.1;
    await expect.poll(async () => (await sectionValues(page))[1].chord).toBeGreaterThan(s.chord + 25);
    const secs1 = await sectionValues(page);
    expect(Math.abs(secs1[1].chord - (target - s.x))).toBeLessThanOrEqual(tol);
    expect(secs1[1].x).toBe(s.x);
    expect(secs1[1].y).toBe(s.y);
    expect(secs1[0]).toEqual(secs0[0]);
    expect(secs1[2]).toEqual(secs0[2]);
    await expect(sectionRows(page).nth(1)).toHaveClass(/selected/);
    await expect(readout(page)).toHaveText(`Section at y ${fmt1(s.y)} mm: x ${fmt1(s.x)} mm, chord ${fmt1(secs1[1].chord)} mm`);

    // Straight panels: area = 2 * (trapezoid root..2 + trapezoid 2..tip).
    const c = secs1[1].chord;
    const area = (2 * ((300 * (280 + c)) / 2 + (300 * (c + 126)) / 2)) / 1e4;
    const after = await figures(page);
    expect(after.span).toBe(before.span);
    expect(Math.abs(after.area - area)).toBeLessThanOrEqual(0.006);
    expect(after.area).toBeGreaterThan(before.area);

    await page.getByRole('button', { name: 'Undo' }).click();
    await expect.poll(async () => (await sectionValues(page))[1].chord).toBe(203);
    await expect(status(page)).toHaveText(before.text);
  });

  test('Add point, Remove selected point and Reset to sections edit the end line', async ({ page }) => {
    await createDesign(page, 'Sport');
    await openPlanform(page);
    await useGuide(page, 'end').check();
    await expect(guideRows(page, 'end')).toHaveCount(2);
    expect(await guidePoints(page, 'end')).toEqual([
      [240, 0],
      [168, 600],
    ]);
    const remove = guideButton(page, 'end', 'Remove selected point');
    await expect(remove).toBeDisabled();

    // Add point: halfway in the widest gap, selected, removable.
    await guideButton(page, 'end', 'Add point').click();
    await expect(guideRows(page, 'end')).toHaveCount(3);
    expect(await guidePoints(page, 'end')).toEqual([
      [240, 0],
      [204, 300],
      [168, 600],
    ]);
    await expect(guideRows(page, 'end').nth(1)).toHaveClass(/selected/);
    await expect(remove).toBeEnabled();
    await guideButton(page, 'end', 'Add point').click();
    await expect(guideRows(page, 'end')).toHaveCount(4);
    expect(await guidePoints(page, 'end')).toEqual([
      [240, 0],
      [222, 150],
      [204, 300],
      [168, 600],
    ]);
    await expect(guideRows(page, 'end').nth(1)).toHaveClass(/selected/);
    await expect(group(page, 'end').locator('tbody tr.selected')).toHaveCount(1);
    await expect(status(page)).toHaveText(VALID_RE);

    // Table edits: x of point 3, and y of point 3 clamped between its neighbours (0.5 mm margin).
    await setNumber(guideRows(page, 'end').nth(2).getByRole('spinbutton').first(), 230);
    await expect.poll(async () => (await guidePoints(page, 'end'))[2]).toEqual([230, 300]);
    await setNumber(guideRows(page, 'end').nth(2).getByRole('spinbutton').nth(1), 700);
    await expect.poll(async () => (await guidePoints(page, 'end'))[2]).toEqual([230, 599.5]);
    await setNumber(guideRows(page, 'end').nth(2).getByRole('spinbutton').nth(1), 300);
    await expect.poll(async () => (await guidePoints(page, 'end'))[2]).toEqual([230, 300]);
    await expect(status(page)).toHaveText(VALID_RE);

    // Remove selected point removes point 2 (added last) and clears the selection.
    await expect(guideRows(page, 'end').nth(1)).toHaveClass(/selected/);
    await remove.click();
    await expect(guideRows(page, 'end')).toHaveCount(3);
    expect(await guidePoints(page, 'end')).toEqual([
      [240, 0],
      [230, 300],
      [168, 600],
    ]);
    await expect(group(page, 'end').locator('tbody tr.selected')).toHaveCount(0);
    await expect(remove).toBeDisabled();

    // Select points on the canvas: an end point cannot be removed, an inner point can.
    const v = await planformView(page);
    await page.mouse.click(v.toPage(168, 600).x, v.toPage(168, 600).y);
    await expect(guideRows(page, 'end').nth(2)).toHaveClass(/selected/);
    await expect(remove).toBeDisabled();
    await page.mouse.click(v.toPage(230, 300).x, v.toPage(230, 300).y);
    await expect(guideRows(page, 'end').nth(1)).toHaveClass(/selected/);
    await expect(remove).toBeEnabled();
    // A tap on the background clears the selection again.
    const empty = v.localToPage({ x: v.geo.w * 0.2, y: v.geo.h - 30 });
    await page.mouse.click(empty.x, empty.y);
    await expect(group(page, 'end').locator('tbody tr.selected')).toHaveCount(0);
    await expect(remove).toBeDisabled();
    await page.mouse.click(v.toPage(230, 300).x, v.toPage(230, 300).y);
    await expect(remove).toBeEnabled();
    await remove.click();
    await expect(guideRows(page, 'end')).toHaveCount(2);
    expect(await guidePoints(page, 'end')).toEqual([
      [240, 0],
      [168, 600],
    ]);

    // Edited points survive a reload; Reset to sections restores the section trailing edges.
    await setNumber(guideRows(page, 'end').nth(1).getByRole('spinbutton'), 150);
    await guideButton(page, 'end', 'Add point').click();
    await expect.poll(() => guidePoints(page, 'end')).toEqual([
      [240, 0],
      [195, 300],
      [150, 600],
    ]);
    await page.reload();
    await expect(dialogOf(page)).toHaveCount(0);
    await expect.poll(() => guidePoints(page, 'end')).toEqual([
      [240, 0],
      [195, 300],
      [150, 600],
    ]);
    // Switching the end line off and on again keeps the edited points.
    await useGuide(page, 'end').uncheck();
    await useGuide(page, 'end').check();
    await expect.poll(() => guidePoints(page, 'end')).toEqual([
      [240, 0],
      [195, 300],
      [150, 600],
    ]);
    await guideButton(page, 'end', 'Reset to sections').click();
    await expect.poll(() => guidePoints(page, 'end')).toEqual([
      [240, 0],
      [168, 600],
    ]);
    await expect(status(page)).toHaveText('Span 1200 mm · area 23.04 dm² · AR 6.25 · MAC 196.0 mm');
  });

  test('mode and degree changes keep an elliptic design valid', async ({ page }) => {
    await createDesign(page, 'Glider');
    await openPlanform(page);
    await expect(useGuide(page, 'nose')).toBeChecked();
    await expect(useGuide(page, 'end')).toBeChecked();
    await expect(guideRows(page, 'nose')).toHaveCount(6);
    await expect(guideRows(page, 'end')).toHaveCount(6);
    const pts = { nose: await guidePoints(page, 'nose'), end: await guidePoints(page, 'end') };
    const base = await figures(page);
    expect(base.span).toBe(2000);
    await canvasOf(page).scrollIntoViewIfNeeded();
    await frames(page);
    const shotFit = await canvasShot(page);

    const areas = {};
    for (const key of ['nose', 'end']) {
      for (const mode of ['control', 'fit']) {
        await afterRebuild(page, () => modeSelect(page, key).selectOption(mode));
        for (const degree of ['1', '2', '3', '4', '5']) {
          await afterRebuild(page, () => degreeSelect(page, key).selectOption(degree));
          await expect(modeSelect(page, key)).toHaveValue(mode);
          await expect(degreeSelect(page, key)).toHaveValue(degree);
          const f = await figures(page); // valid: no error, no warning
          expect(f.span).toBe(2000);
          expect(Math.abs(f.area - base.area) / base.area).toBeLessThan(0.05);
          areas[`${key} ${mode} ${degree}`] = f.area;
          // Mode and degree never move the points.
          expect(await guidePoints(page, key)).toEqual(pts[key]);
        }
      }
      // Degree 1 is the polyline through the points in both modes.
      expect(areas[`${key} control 1`]).toBe(areas[`${key} fit 1`]);
      // A smooth control-point curve cuts inside the polygon; the elliptic edge is interpolated.
      expect(areas[`${key} control 3`]).not.toBe(areas[`${key} fit 3`]);
    }
    // Now fit / degree 5 on both lines; the control-point curve (and its dashed control polygon)
    // changes the drawn planform compared with the original fit / cubic lines.
    await canvasOf(page).scrollIntoViewIfNeeded();
    await afterRebuild(page, () => modeSelect(page, 'nose').selectOption('control'));
    await frames(page);
    const shotControl = await canvasShot(page);
    expect(Buffer.compare(shotFit, shotControl)).not.toBe(0);

    // Mode and degree are saved with the project.
    await afterRebuild(page, () => degreeSelect(page, 'nose').selectOption('2'));
    await afterRebuild(page, () => degreeSelect(page, 'end').selectOption('4'));
    const saved = await figures(page);
    await page.reload();
    await expect(dialogOf(page)).toHaveCount(0);
    await expect(modeSelect(page, 'nose')).toHaveValue('control');
    await expect(degreeSelect(page, 'nose')).toHaveValue('2');
    await expect(modeSelect(page, 'end')).toHaveValue('fit');
    await expect(degreeSelect(page, 'end')).toHaveValue('4');
    expect((await figures(page)).text).toBe(saved.text);

    // Returning to fit / cubic restores the original figures exactly.
    await afterRebuild(page, () => modeSelect(page, 'nose').selectOption('fit'));
    await afterRebuild(page, () => degreeSelect(page, 'nose').selectOption('3'));
    await afterRebuild(page, () => degreeSelect(page, 'end').selectOption('3'));
    expect((await figures(page)).text).toBe(base.text);
  });

  test('every mode and degree of a two-point guide gives the straight section edge', async ({ page }) => {
    await createDesign(page, 'Sport');
    await openPlanform(page);
    const base = await figures(page);
    await useGuide(page, 'nose').check();
    await useGuide(page, 'end').check();
    await expect(guideRows(page, 'end')).toHaveCount(2);
    for (const key of ['nose', 'end']) {
      for (const mode of ['control', 'fit']) {
        await afterRebuild(page, () => modeSelect(page, key).selectOption(mode));
        for (const degree of ['1', '2', '5', '3']) {
          await afterRebuild(page, () => degreeSelect(page, key).selectOption(degree));
          await expect(modeSelect(page, key)).toHaveValue(mode);
          expect((await figures(page)).text).toBe(base.text);
        }
      }
    }
  });

  test('an end line crossing the nose line is reported in the status bar', async ({ page }) => {
    await createDesign(page, 'Sport');
    await openPlanform(page);
    await useGuide(page, 'nose').check();
    await useGuide(page, 'end').check();
    await expect(guideRows(page, 'end')).toHaveCount(2);
    const base = await figures(page);
    const nose = await guidePoints(page, 'nose');
    expect(nose[1]).toEqual([24, 600]);

    // Tip point of the end line in front of the nose line.
    await setNumber(guideRows(page, 'end').nth(1).getByRole('spinbutton'), 0);
    await expect(status(page)).toHaveText(/^1 error\(s\): Chord drops to -24\.00 mm at y = 600\.0 mm; nose line and end line must not touch or cross\./);
    await expect(status(page)).toHaveClass(/has-error/);
    await openTab(page, 'Checks');
    await expect(page.locator('#pane-checks .sev-error')).toHaveText(/^Error: Chord drops to -24\.00 mm/);
    await openPlanform(page);

    // Just behind the nose line again: a narrow but valid tip (chord 240 -> 6 mm, straight edges).
    await setNumber(guideRows(page, 'end').nth(1).getByRole('spinbutton'), 30);
    await expect(status(page)).toHaveText(/^Span 1200 mm · area 14\.76 dm² /);
    await expect(status(page)).not.toHaveClass(/has-error/);
    await setNumber(guideRows(page, 'end').nth(1).getByRole('spinbutton'), 168);
    await expect(status(page)).toHaveText(base.text);

    // Drag an inner end-line point on the canvas forward across the nose line.
    await guideButton(page, 'end', 'Add point').click();
    await expect.poll(() => guidePoints(page, 'end')).toEqual([
      [240, 0],
      [204, 300],
      [168, 600],
    ]);
    const v = await planformView(page);
    await mouseDrag(page, v.toPage(204, 300), v.toPage(-40, 300));
    await expect(status(page)).toHaveText(/^1 error\(s\): Chord drops to -\d+\.\d\d mm at y = \d+\.\d mm; nose line and end line must not touch or cross\.$/);
    await expect(status(page)).toHaveClass(/has-error/);
    const end = await guidePoints(page, 'end');
    expect(end[1][0]).toBeLessThan(12); // nose line at mid span: x = 12
    const m = (await status(page).innerText()).match(/at y = ([\d.]+) mm/);
    expect(Math.abs(Number(m[1]) - end[1][1])).toBeLessThan(60);

    await page.getByRole('button', { name: 'Undo' }).click();
    await expect.poll(async () => (await guidePoints(page, 'end'))[1]).toEqual([204, 300]);
    await expect(status(page)).not.toHaveClass(/has-error/);
    await expect(status(page)).toHaveText(VALID_RE);
  });

  test('phone: a one-finger touch drag moves a guide point', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'touch input on the phone viewport only');
    await createDesign(page, 'Swept flying wing');
    await openPlanform(page);
    await useGuide(page, 'nose').check();
    await expect(guideRows(page, 'nose')).toHaveCount(3);
    const nose0 = await guidePoints(page, 'nose');
    const before = await figures(page);

    const v = await planformView(page);
    const touch = await touchScreen(page);
    const [x0, y0] = nose0[1];
    const target = x0 + 80;
    await touch.drag(v.toPage(x0, y0), v.toPage(target, y0));

    const tol = 1.5 / v.scale + 0.1;
    await expect.poll(async () => (await guidePoints(page, 'nose'))[1][0]).toBeGreaterThan(x0 + 40);
    const nose1 = await guidePoints(page, 'nose');
    expect(Math.abs(nose1[1][0] - target)).toBeLessThanOrEqual(tol);
    expect(Math.abs(nose1[1][1] - y0)).toBeLessThanOrEqual(tol);
    expect(nose1[0]).toEqual(nose0[0]);
    expect(nose1[2]).toEqual(nose0[2]);
    await expect(readout(page)).toHaveText(`Nose line (leading edge) point 2: x ${fmt1(nose1[1][0])} mm, y ${fmt1(nose1[1][1])} mm`);
    await expect(status(page)).toHaveText(VALID_RE);
    // Only the nose line is on: the leading edge moves, the chord (and area) stay.
    expect((await figures(page)).area).toBe(before.area);
    await expect(sectionNote(page, 1, 'x')).toHaveText(/^guide: -?[\d.]+$/);
    const noteX = Number((await sectionNote(page, 1, 'x').innerText()).replace('guide: ', ''));
    expect(Math.abs(noteX - nose1[1][0])).toBeLessThanOrEqual(0.5);

    // A one-finger drag on the background pans the view without changing any point.
    const shot0 = await canvasShot(page);
    const bg = v.localToPage({ x: v.geo.w * 0.2, y: v.geo.h - 40 });
    await touch.drag(bg, { x: bg.x + 30, y: bg.y - 30 });
    await frames(page);
    const shot1 = await canvasShot(page);
    expect(Buffer.compare(shot0, shot1)).not.toBe(0);
    expect(await guidePoints(page, 'nose')).toEqual(nose1);
  });

  test('phone: a two-finger pinch zooms the planform and keeps the points', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'multi-touch on the phone viewport only');
    await createDesign(page, 'Swept flying wing');
    await openPlanform(page);
    await useGuide(page, 'nose').check();
    await expect(guideRows(page, 'nose')).toHaveCount(3);
    const nose0 = await guidePoints(page, 'nose');
    const before = await figures(page);

    const v = await planformView(page);
    const handles = await handlePositions(page, v);
    const h = v.toLocal(nose0[1][0], nose0[1][1]); // inner nose-line point
    const K = 2; // fingers from 20 px to 40 px apart from the centre
    const DRAG = 40; // px, touch drag after the zoom
    const inside = (p, top = 50) => p.x > 25 && p.x < v.geo.w - 25 && p.y > top && p.y < v.geo.h - 25;
    const minDist = (p) => Math.min(...handles.map((q) => Math.hypot(p.x - q.x, p.y - q.y)));
    // Pinch centre 50 px from the inner point, clear of all handles, so that the zoomed point and
    // the drag target stay inside the canvas (below the toolbar).
    let best = null;
    for (let a = 0; a < 32; a++) {
      const c = { x: h.x + 50 * Math.cos((a * Math.PI) / 16), y: h.y + 50 * Math.sin((a * Math.PI) / 16) };
      const z = { x: c.x + (h.x - c.x) * K, y: c.y + (h.y - c.y) * K };
      const fingers = [
        { x: c.x - 20, y: c.y },
        { x: c.x + 20, y: c.y },
      ];
      if (!inside(c) || !inside(z) || !inside({ x: z.x, y: z.y + DRAG }) || !fingers.every((f) => inside(f, 45))) continue;
      const clear = Math.min(...fingers.map(minDist), minDist(c));
      if (clear > 30 && (!best || clear > best.clear)) best = { c, clear };
    }
    expect(best, 'a pinch position clear of the handles').not.toBeNull();
    const c = { x: Math.round(best.c.x), y: Math.round(best.c.y) };

    await frames(page);
    const shot0 = await canvasShot(page);
    const touch = await touchScreen(page);
    const pc = v.localToPage(c);
    // Integer page coordinates keep the finger distances exact.
    const pcr = { x: Math.round(pc.x), y: Math.round(pc.y) };
    const cLocal = { x: pcr.x - v.geo.left, y: pcr.y - v.geo.top };
    await touch.pinch(pcr, 40, 80);
    await frames(page);
    const shot1 = await canvasShot(page);
    expect(Buffer.compare(shot0, shot1)).not.toBe(0);
    expect(await guidePoints(page, 'nose')).toEqual(nose0);
    expect((await figures(page)).text).toBe(before.text);
    await expect(group(page, 'nose').locator('tbody tr.selected')).toHaveCount(0);

    // The zoom is 2x about the pinch centre: a touch drag at the zoomed position of the inner point
    // grabs it, and 40 px now move it by half as many millimetres as before the zoom.
    const z = v.zoomed(cLocal, K);
    const from = z.toPage(nose0[1][0], nose0[1][1]);
    await touch.drag(from, { x: from.x, y: from.y + DRAG });
    await expect.poll(async () => (await guidePoints(page, 'nose'))[1][0]).not.toBe(nose0[1][0]);
    const nose1 = await guidePoints(page, 'nose');
    const expected = nose0[1][0] + DRAG / z.scale;
    expect(Math.abs(nose1[1][0] - expected)).toBeLessThanOrEqual(1.5 / z.scale + 0.1);
    expect(Math.abs(nose1[1][1] - nose0[1][1])).toBeLessThanOrEqual(1.5 / z.scale + 0.1);

    // Fit returns to the fitted view: the image equals the first one after undoing the drag.
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect.poll(() => guidePoints(page, 'nose')).toEqual(nose0);
    // A tap on the background clears the point selection (drawn larger while selected).
    const bg = v.localToPage({ x: v.geo.w * 0.2, y: v.geo.h - 40 });
    await touch.tap(bg);
    await expect(group(page, 'nose').locator('tbody tr.selected')).toHaveCount(0);
    await planformView(page);
    await frames(page);
    const shot2 = await canvasShot(page);
    expect(Buffer.compare(shot0, shot2)).toBe(0);
  });

  test('desktop: zoom buttons and the mouse wheel change only the view; double-click fits again', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'mouse wheel and double-click on the desktop viewport');
    await createDesign(page, 'Sport');
    await openPlanform(page);
    await useGuide(page, 'end').check();
    await expect(guideRows(page, 'end')).toHaveCount(2);
    const end0 = await guidePoints(page, 'end');
    const before = await figures(page);
    const v = await planformView(page);
    // Screenshots with the mouse off the canvas toolbar (buttons have a hover style).
    const neutral = { x: v.geo.left + 5, y: v.geo.top + v.geo.h + 20 };
    const shot = async () => {
      await page.mouse.move(neutral.x, neutral.y);
      await frames(page);
      return canvasShot(page);
    };
    const shot0 = await shot();

    // "+" zooms by 1.25 about the canvas centre: 25 px of drag then move a point by 25 / (1.25 scale) mm.
    await pane(page).getByRole('button', { name: '+', exact: true }).click();
    const shot1 = await shot();
    expect(Buffer.compare(shot0, shot1)).not.toBe(0);
    expect(await guidePoints(page, 'end')).toEqual(end0);
    const z = v.zoomed({ x: v.geo.w / 2, y: v.geo.h / 2 }, 1.25);
    // Root point of the end line (y = 0 lies on the vertical centre line of the mirrored view).
    const from = z.toPage(end0[0][0], end0[0][1]);
    await mouseDrag(page, from, { x: from.x + 20, y: from.y + 25 });
    await expect.poll(async () => (await guidePoints(page, 'end'))[0][0]).not.toBe(end0[0][0]);
    const end1 = await guidePoints(page, 'end');
    expect(Math.abs(end1[0][0] - (end0[0][0] + 25 / z.scale))).toBeLessThanOrEqual(1.5 / z.scale + 0.1);
    expect(end1[0][1]).toBe(end0[0][1]); // the root point keeps its span position despite the sideways move
    expect(end1[1]).toEqual(end0[1]);
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect.poll(() => guidePoints(page, 'end')).toEqual(end0);

    // "−" and the wheel zoom the view as well; nothing in the design changes.
    await pane(page).getByRole('button', { name: '−', exact: true }).click();
    const shot2 = await shot();
    expect(Buffer.compare(shot1, shot2)).not.toBe(0);
    const bg = v.localToPage({ x: v.geo.w * 0.2, y: v.geo.h - 30 });
    await page.mouse.move(bg.x, bg.y);
    await page.mouse.wheel(0, -300);
    const shot3 = await shot();
    expect(Buffer.compare(shot2, shot3)).not.toBe(0);
    expect(await guidePoints(page, 'end')).toEqual(end0);
    expect((await figures(page)).text).toBe(before.text);

    // Double-click on the background fits the view again (same image as after "Fit"); the clicks
    // also clear the point selection left by the drag.
    await page.mouse.dblclick(bg.x, bg.y);
    await expect(group(page, 'end').locator('tbody tr.selected')).toHaveCount(0);
    expect(Buffer.compare(shot0, await shot())).toBe(0);
  });

  test('dragging a trailing-edge handle with only the nose line on follows the pointer', async ({ page }) => {
    await createDesign(page, 'Swept flying wing');
    await openPlanform(page);
    await useGuide(page, 'nose').check();
    await expect(guideRows(page, 'nose')).toHaveCount(3);
    // Move the inner nose point 40.86 mm aft: section 2's leading edge is now at x = 200.
    await setNumber(guideRows(page, 'nose').nth(1).getByRole('spinbutton').first(), 200);
    await expect(sectionNote(page, 1, 'x')).toHaveText('guide: 200.0');
    const secs0 = await sectionValues(page);
    expect(secs0[1]).toEqual({ y: 300, x: 159.14, chord: 203 });

    // The trailing-edge handle of section 2 is drawn at 200 + 203 = 403; drag it to 423.
    const v = await planformView(page);
    await mouseDrag(page, v.toPage(403, 300), v.toPage(423, 300));
    await expect.poll(async () => (await sectionValues(page))[1].chord).not.toBe(203);
    const chord = (await sectionValues(page))[1].chord;
    expect(Math.abs(chord - 223), `chord ${chord}, expected 223 (trailing edge under the pointer)`).toBeLessThanOrEqual(1.5 / v.scale + 0.1);
  });

  test('dragging a leading-edge handle with only the end line on keeps the trailing edge', async ({ page }) => {
    await createDesign(page, 'Swept flying wing');
    await openPlanform(page);
    await useGuide(page, 'end').check();
    await expect(guideRows(page, 'end')).toHaveCount(3);
    // Move the inner end point to x = 400: section 2's trailing edge is at 400, its leading edge at 400 - 203 = 197.
    await setNumber(guideRows(page, 'end').nth(1).getByRole('spinbutton').first(), 400);
    await expect(sectionNote(page, 1, 'x')).toHaveText('guide: 197.0');
    const end0 = await guidePoints(page, 'end');

    // Drag the leading-edge handle of section 2 from 197 forward to 177.
    const v = await planformView(page);
    await mouseDrag(page, v.toPage(197, 300), v.toPage(177, 300));
    await expect.poll(async () => (await sectionValues(page))[1].x).not.toBe(159.14);
    const s = (await sectionValues(page))[1];
    expect(await guidePoints(page, 'end')).toEqual(end0);
    // Trailing edge stays at 400 (end line), so the chord becomes 400 - 177 = 223.
    expect(Math.abs(s.chord - 223), `chord ${s.chord}, expected 223 (leading edge under the pointer)`).toBeLessThanOrEqual(1.5 / v.scale + 0.1);
  });

  test('after undoing Add point no other point stays selected for removal', async ({ page }) => {
    await createDesign(page, 'Glider');
    await openPlanform(page);
    const nose0 = await guidePoints(page, 'nose');
    expect(nose0).toHaveLength(6);
    await guideButton(page, 'nose', 'Add point').click();
    await expect(guideRows(page, 'nose')).toHaveCount(7);
    await expect(group(page, 'nose').locator('tbody tr.selected')).toHaveCount(1);
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(guideRows(page, 'nose')).toHaveCount(6);
    expect(await guidePoints(page, 'nose')).toEqual(nose0);
    await expect(group(page, 'nose').locator('tbody tr.selected')).toHaveCount(0, { timeout: 2000 });
    await expect(guideButton(page, 'nose', 'Remove selected point')).toBeDisabled({ timeout: 2000 });
  });

  test('clearing a guide x cell keeps the point', async ({ page }) => {
    await createDesign(page, 'Glider');
    await openPlanform(page);
    const end0 = await guidePoints(page, 'end');
    const before = await figures(page);
    const cell = guideRows(page, 'end').nth(1).getByRole('spinbutton').first();
    await cell.fill('');
    await cell.press('Enter');
    await frames(page);
    await frames(page);
    expect(await guidePoints(page, 'end')).toEqual(end0);
    expect((await status(page).innerText()).trim()).toBe(before.text);
  });
});
