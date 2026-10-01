// 3D viewer: view buttons, mouse rotate, pan and wheel zoom, touch rotate, pan and pinch zoom, Enlarge
// on narrow screens, the Settings display toggles (control net, section outlines, mirrored half), the
// part roll in the front view and the pointed tip in the top view.
//
// The canvas is read back (helpers.js capture()): PNG bytes plus pixel statistics (opaque pixel count
// = projected size of the wing, bounding box of the opaque pixels, control-net and section-outline
// colours). Rendering is deterministic in Chromium, so "back to the same camera" is checked as equal
// bytes (backTo) and "changed" as different bytes (changedFrom).
import { STORAGE_KEY, backTo, changedFrom, createDesign, expect, openTab, settleView, statusOf, test, touchScreen } from './helpers.js';

const viewButton = (page, name) => page.locator('.view-tools').getByRole('button', { name, exact: true });
const canvasOf = (page) => page.locator('.viewport canvas');

/** First visit: create the Sport preset in the wizard; returns the settled initial image. */
async function createSport(page) {
  await createDesign(page, 'Sport');
  return settleView(page, (c) => c.opaque > 1000, 'initial render');
}

async function canvasCentre(page) {
  const b = await canvasOf(page).boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2, box: b };
}

const storedProject = (page) => page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);

/** Opaque pixel count b within ±tol of a. */
const expectSimilarSize = (b, a, tol, what) => {
  expect(b.opaque / a.opaque, `${what}: opaque pixels ${b.opaque} vs ${a.opaque}`).toBeGreaterThan(1 - tol);
  expect(b.opaque / a.opaque, `${what}: opaque pixels ${b.opaque} vs ${a.opaque}`).toBeLessThan(1 + tol);
};

/**
 * A pan by (dx, dy) CSS pixels moves the wing's bounding box by about as many pixels (canvas pixels:
 * times the pixel ratio) in the same direction; the wing keeps its size.
 */
function expectPanned(panned, before, { dx, dy }, ratio) {
  const moved = { x: panned.box.x - before.box.x, y: panned.box.y - before.box.y };
  for (const [k, d] of [
    ['x', dx],
    ['y', dy],
  ]) {
    expect(moved[k] / (d * ratio), `box ${k} moved ${moved[k]} px for a ${d} px pan`).toBeGreaterThan(0.5);
    expect(moved[k] / (d * ratio), `box ${k} moved ${moved[k]} px for a ${d} px pan`).toBeLessThan(1.5);
  }
  expectSimilarSize(panned, before, 0.1, 'pan');
  expect(Math.abs(panned.box.w - before.box.w)).toBeLessThan(0.1 * before.box.w);
  expect(Math.abs(panned.box.h - before.box.h)).toBeLessThan(0.1 * before.box.h);
}

test('Iso, Top, Front, Side and Fit set the documented camera directions', async ({ page }, testInfo) => {
  const initial = await createSport(page);

  // The new design is framed in the Iso direction; Iso reproduces exactly that image.
  await viewButton(page, 'Iso').click();
  const iso = await backTo(page, initial, 'Iso after creation');

  await viewButton(page, 'Top').click();
  const top = await changedFrom(page, iso, 'Top');
  // From above the whole planform faces the camera: span across the screen, largest projected area.
  expect(top.box.w).toBeGreaterThan(3 * top.box.h);
  expect(top.opaque).toBeGreaterThan(iso.opaque);

  await viewButton(page, 'Front').click();
  const front = await changedFrom(page, top, 'Front');
  // From ahead of the leading edge: the full span, only the airfoil thickness high.
  expect(front.box.w).toBeGreaterThan(10 * front.box.h);
  expect(front.box.w).toBeGreaterThan(0.8 * top.box.w);
  expect(front.opaque).toBeLessThan(top.opaque / 3);

  await viewButton(page, 'Side').click();
  const side = await changedFrom(page, front, 'Side');
  // From the left (-y): the root and tip airfoils overlap; the span is along the view direction.
  expect(side.box.w).toBeLessThan(top.box.w / 3);
  expect(side.box.h).toBeLessThan(side.box.w / 2);
  expect(side.opaque).toBeLessThan(front.opaque);

  // Each direction gives its own image (changedFrom only compares with the previous one).
  const views = { iso, top, front, side };
  const names = Object.keys(views);
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      expect(Buffer.compare(views[names[i]].png, views[names[j]].png), `${names[i]} vs ${names[j]}`).not.toBe(0);
    }
  }

  // Fit uses the Iso direction and frames the whole wing again.
  await viewButton(page, 'Fit').click();
  await backTo(page, iso, 'Fit after Side');

  // The buttons are repeatable: Top from the Fit view gives the same Top image again.
  await viewButton(page, 'Top').click();
  await backTo(page, top, 'Top again');

  if (testInfo.project.name === 'desktop') {
    // Enlarge exists only at widths <= 860 px.
    await expect(viewButton(page, 'Enlarge')).toBeHidden();
  }
});

test('mouse drag rotates the 3D view and Fit restores the Iso framing', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Mouse input; the phone uses touch (see the touch tests).');
  const initial = await createSport(page);
  const c = await canvasCentre(page);

  // Vertical drag from the Front view tilts the camera upwards: the planform comes into view.
  await viewButton(page, 'Front').click();
  const front = await changedFrom(page, initial, 'Front');
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  await page.mouse.move(c.x, c.y + 100, { steps: 8 });
  await page.mouse.up();
  const tilted = await changedFrom(page, front, 'vertical mouse drag');
  expect(tilted.opaque).toBeGreaterThan(3 * front.opaque);

  // Horizontal drag in the Iso view orbits around the wing: seen from another direction, the wing
  // has another outline but about the same projected size (the distance to the target stays).
  await viewButton(page, 'Iso').click();
  const iso = await backTo(page, initial, 'Iso');
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  await page.mouse.move(c.x + 150, c.y, { steps: 8 });
  await page.mouse.up();
  const orbited = await changedFrom(page, iso, 'horizontal mouse drag');
  expectSimilarSize(orbited, iso, 0.25, 'orbit');
  expect(Math.abs(orbited.box.w - iso.box.w) + Math.abs(orbited.box.h - iso.box.h), 'bounding box change').toBeGreaterThan(20);

  await viewButton(page, 'Fit').click();
  await backTo(page, iso, 'Fit after rotating');
});

test('right mouse button drag pans the 3D view', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Mouse input; the phone pans with two fingers (see the touch tests).');
  const initial = await createSport(page);
  const c = await canvasCentre(page);
  const ratio = initial.width / c.box.width;

  // Up and to the left, so the wing stays inside the canvas.
  const delta = { dx: -60, dy: -30 };
  await page.mouse.move(c.x, c.y);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(c.x + delta.dx, c.y + delta.dy, { steps: 8 });
  await page.mouse.up({ button: 'right' });
  const panned = await changedFrom(page, initial, 'right-button drag');
  expectPanned(panned, initial, delta, ratio);
  // No context menu, no page scroll.
  expect(await page.evaluate(() => [window.scrollX, window.scrollY])).toEqual([0, 0]);

  await viewButton(page, 'Fit').click();
  await backTo(page, initial, 'Fit after panning');
});

test('mouse wheel zooms the 3D view in and out', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Mouse wheel; the phone uses pinch (see the touch tests).');
  const initial = await createSport(page);
  const c = await canvasCentre(page);
  await page.mouse.move(c.x, c.y);

  // Wheel forward (negative deltaY) zooms in: the wing covers more pixels.
  await page.mouse.wheel(0, -300);
  const zoomedIn = await changedFrom(page, initial, 'wheel forward');
  expect(zoomedIn.opaque).toBeGreaterThan(1.15 * initial.opaque);
  expect(zoomedIn.box.w).toBeGreaterThan(initial.box.w);

  // Wheel backward zooms out beyond the fitted view.
  await page.mouse.wheel(0, 600);
  const zoomedOut = await changedFrom(page, zoomedIn, 'wheel backward');
  expect(zoomedOut.opaque).toBeLessThan(0.85 * initial.opaque);
  expect(zoomedOut.box.w).toBeLessThan(initial.box.w);

  // The page itself does not scroll or zoom.
  expect(await page.evaluate(() => [window.scrollX, window.scrollY])).toEqual([0, 0]);

  await viewButton(page, 'Fit').click();
  await backTo(page, initial, 'Fit after zooming');
});

test('one-finger touch drag rotates the 3D view', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Touch input on the phone project.');
  const initial = await createSport(page);
  const c = await canvasCentre(page);
  const touch = await touchScreen(page);

  // Vertical swipe from the Front view tilts the camera upwards: the planform comes into view.
  await viewButton(page, 'Front').click();
  const front = await changedFrom(page, initial, 'Front');
  await touch.drag({ x: c.x, y: c.y - 20 }, { x: c.x, y: c.y + 20 }, 4);
  const tilted = await changedFrom(page, front, 'one-finger vertical drag');
  expect(tilted.opaque).toBeGreaterThan(2 * front.opaque);

  // Horizontal swipe in the Iso view orbits around the wing: another outline, similar size.
  await viewButton(page, 'Iso').click();
  const iso = await backTo(page, initial, 'Iso');
  await touch.drag({ x: c.x - 60, y: c.y }, { x: c.x + 60, y: c.y });
  const orbited = await changedFrom(page, iso, 'one-finger horizontal drag');
  expectSimilarSize(orbited, iso, 0.25, 'orbit');
  expect(Math.abs(orbited.box.w - iso.box.w) + Math.abs(orbited.box.h - iso.box.h), 'bounding box change').toBeGreaterThan(20);

  // The page is not zoomed or scrolled by the gesture.
  expect(await page.evaluate(() => [window.visualViewport.scale, window.scrollY])).toEqual([1, 0]);

  await viewButton(page, 'Fit').click();
  await backTo(page, iso, 'Fit after touch rotation');
});

test('two-finger parallel drag pans the 3D view', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Touch input on the phone project.');
  const initial = await createSport(page);
  const c = await canvasCentre(page);
  const ratio = initial.width / c.box.width;
  const touch = await touchScreen(page);

  // Both fingers 80 px apart move up and to the left together: no pinch, only a pan.
  const delta = { dx: -40, dy: -20 };
  await touch.twoFingerDrag(c, { x: c.x + delta.dx, y: c.y + delta.dy }, 80);
  const panned = await changedFrom(page, initial, 'two-finger drag');
  expectPanned(panned, initial, delta, ratio);
  expect(await page.evaluate(() => [window.visualViewport.scale, window.scrollY])).toEqual([1, 0]);

  await viewButton(page, 'Fit').click();
  await backTo(page, initial, 'Fit after panning');
});

test('two-finger pinch zooms the 3D view, not the page', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Touch input on the phone project.');
  const initial = await createSport(page);
  const c = await canvasCentre(page);
  const touch = await touchScreen(page);

  // Fingers apart: zoom in.
  await touch.pinch(c, 80, 160);
  const zoomedIn = await changedFrom(page, initial, 'pinch open');
  expect(zoomedIn.opaque).toBeGreaterThan(1.5 * initial.opaque);
  expect(zoomedIn.box.w).toBeGreaterThan(initial.box.w);

  // Fingers together (by a larger factor): zoom out beyond the fitted view.
  await touch.pinch(c, 240, 80);
  const zoomedOut = await changedFrom(page, zoomedIn, 'pinch close');
  expect(zoomedOut.opaque).toBeLessThan(0.7 * initial.opaque);
  expect(zoomedOut.box.w).toBeLessThan(initial.box.w);

  // The browser did not pinch-zoom the page (touch-action: none on the canvas).
  expect(await page.evaluate(() => window.visualViewport.scale)).toBe(1);

  await viewButton(page, 'Fit').click();
  await backTo(page, initial, 'Fit after pinching');
});

test('Enlarge hides the panel for a full-height 3D view and restores it', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Enlarge is shown only at widths <= 860 px.');
  const initial = await createSport(page);
  const panel = page.locator('.panel');
  const tabs = page.getByRole('tablist');
  await expect(tabs).toBeVisible();
  const before = await canvasOf(page).boundingBox();
  const viewportHeight = page.viewportSize().height;
  // Narrow layout: the 3D view is 42 % of the window height (at least 240 px).
  expect(before.height).toBeGreaterThanOrEqual(240);
  expect(before.height).toBeLessThan(0.5 * viewportHeight);

  const enlarge = viewButton(page, 'Enlarge');
  await enlarge.click();
  await expect(panel).toBeHidden();
  await expect(tabs).toBeHidden();
  await expect.poll(async () => (await canvasOf(page).boundingBox()).height, { message: 'enlarged canvas height' }).toBeGreaterThan(0.75 * viewportHeight);
  await expect(statusOf(page)).toContainText('Span 1200 mm');
  const enlarged = await changedFrom(page, initial, 'Enlarge');
  // Drawing buffer follows the new size; the camera stays, so the wing is still drawn.
  expect(enlarged.width).toBe(initial.width);
  expect(enlarged.height).toBeGreaterThan(1.5 * initial.height);
  expect(enlarged.opaque).toBeGreaterThan(0.5 * initial.opaque);

  // Second tap restores the panel, the view size and the unchanged camera image.
  await enlarge.click();
  await expect(panel).toBeVisible();
  await expect(tabs).toBeVisible();
  await expect.poll(async () => (await canvasOf(page).boundingBox()).height, { message: 'restored canvas height' }).toBeCloseTo(before.height, 0);
  const restored = await backTo(page, initial, 'Enlarge tapped again');
  expect(restored.height).toBe(initial.height);
  // The panel works again.
  await openTab(page, 'Settings');
  await expect(page.getByLabel('Show NURBS control net')).toBeVisible();
});

test('"Show NURBS control net" draws the control net; display only, not stored', async ({ page }) => {
  const initial = await createSport(page);
  await openTab(page, 'Settings');
  const net = page.getByLabel('Show NURBS control net');
  await expect(net).not.toBeChecked();
  expect(initial.purple).toBeLessThan(50);
  const stored = await storedProject(page);

  await net.check();
  const withNet = await changedFrom(page, initial, 'control net on');
  expect(withNet.purple).toBeGreaterThan(1000);
  // Display option only: the project (and its autosave) is unchanged.
  expect(await storedProject(page)).toBe(stored);

  // The option survives a rebuild caused by a project edit.
  const name = page.getByLabel('Project name');
  await name.fill('Net test');
  await name.press('Enter');
  await expect.poll(async () => JSON.parse(await storedProject(page)).name).toBe('Net test');
  await expect(page.getByLabel('Show NURBS control net')).toBeChecked();
  await backTo(page, withNet, 'control net after a rebuild');

  await page.getByLabel('Show NURBS control net').uncheck();
  const without = await backTo(page, initial, 'control net off');
  expect(without.purple).toBeLessThan(50);

  // Not stored: after a reload the net is off again.
  await page.getByLabel('Show NURBS control net').check();
  await changedFrom(page, initial, 'control net on again');
  await page.reload();
  await expect(statusOf(page)).toContainText('Span 1200 mm');
  await expect(page.getByLabel('Show NURBS control net')).not.toBeChecked();
  const reloaded = await backTo(page, initial, 'reload');
  expect(reloaded.purple).toBeLessThan(50);
});

test('"Show section outlines" hides and shows the section outlines; not stored', async ({ page }) => {
  const initial = await createSport(page);
  await openTab(page, 'Settings');
  const outlines = page.getByLabel('Show section outlines');
  await expect(outlines).toBeChecked();
  expect(initial.blue).toBeGreaterThan(100);
  const stored = await storedProject(page);

  await outlines.uncheck();
  const hidden = await changedFrom(page, initial, 'section outlines off');
  expect(hidden.blue).toBeLessThan(0.1 * initial.blue);
  // The wing itself stays.
  expect(hidden.opaque).toBeGreaterThan(0.95 * initial.opaque);
  expect(await storedProject(page)).toBe(stored);

  await page.getByLabel('Show section outlines').check();
  await backTo(page, initial, 'section outlines on');

  // Not stored: after a reload the outlines are on again.
  await page.getByLabel('Show section outlines').uncheck();
  await changedFrom(page, initial, 'section outlines off again');
  await page.reload();
  await expect(statusOf(page)).toContainText('Span 1200 mm');
  await expect(page.getByLabel('Show section outlines')).toBeChecked();
  const reloaded = await backTo(page, initial, 'reload');
  expect(reloaded.blue).toBe(initial.blue);
});

test('"Show mirrored half" shows one or both halves; stored and undoable', async ({ page }) => {
  const initial = await createSport(page);
  await openTab(page, 'Settings');
  const mirror = page.getByLabel('Show mirrored half');
  await expect(mirror).toBeChecked();
  expect(JSON.parse(await storedProject(page)).settings.mirror).toBe(true);

  await mirror.uncheck();
  const half = await changedFrom(page, initial, 'mirrored half off');
  // One half only: much less wing on screen, narrower (the camera does not move).
  expect(half.opaque).toBeLessThan(0.7 * initial.opaque);
  expect(half.opaque).toBeGreaterThan(0.2 * initial.opaque);
  expect(half.box.w).toBeLessThan(0.8 * initial.box.w);
  // Stored in the project.
  await expect.poll(async () => JSON.parse(await storedProject(page)).settings.mirror).toBe(false);

  // Undo and redo switch the display with the project.
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByLabel('Show mirrored half')).toBeChecked();
  await backTo(page, initial, 'undo mirror off');
  await page.getByRole('button', { name: 'Redo' }).click();
  await expect(page.getByLabel('Show mirrored half')).not.toBeChecked();
  await backTo(page, half, 'redo mirror off');

  // After a reload the setting is kept; switching it on and Fit give the original framing.
  await expect.poll(async () => JSON.parse(await storedProject(page)).settings.mirror).toBe(false);
  await page.reload();
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await expect(page.getByLabel('Show mirrored half')).not.toBeChecked();
  const reloadedHalf = await settleView(page, (c) => c.opaque > 1000, 'reload with one half');
  await page.getByLabel('Show mirrored half').check();
  const both = await changedFrom(page, reloadedHalf, 'mirrored half on after reload');
  // The camera was fitted to one half on load, so the added half is partly foreshortened.
  expect(both.opaque).toBeGreaterThan(1.1 * reloadedHalf.opaque);
  await viewButton(page, 'Fit').click();
  await backTo(page, initial, 'Fit with both halves');
});

test('Part roll turns both halves up in the Front view; after a reload the first framing equals Iso', async ({ page }) => {
  await createSport(page);
  await viewButton(page, 'Front').click();
  const flat = await settleView(page, (c) => c.box.w > 5 * c.box.h, 'Front view');
  await openTab(page, 'Settings');
  const roll = page.getByRole('spinbutton', { name: /^Part roll/ });
  await roll.fill('20');
  await roll.press('Enter');
  // The right half turns 20° about the root leading edge, the left half is its mirror image: a V
  // about 600 mm · sin 20° = 205 mm high on a span of 2 · 600 mm · cos 20° = 1128 mm.
  const rolled = await changedFrom(page, flat, 'part roll 20°');
  expect(rolled.box.h).toBeGreaterThan(3 * flat.box.h);
  expect(rolled.box.w).toBeLessThan(flat.box.w);
  await expect.poll(async () => JSON.parse(await storedProject(page)).settings.partRoll).toBe(20);

  // The first fit after a reload frames the turned part and its mirror image as Iso does.
  await page.reload();
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  const first = await settleView(page, (c) => c.opaque > 1000, 'reload with a rolled part');
  await viewButton(page, 'Iso').click();
  await backTo(page, first, 'Iso after a reload');
});

test('Top view: a pointed tip narrows the drawn planform to a point; Undo restores the flat tip', async ({ page }) => {
  await createSport(page);
  await viewButton(page, 'Top').click();
  const flat = await settleView(page, (c) => c.box.w > 3 * c.box.h, 'Top view');
  await openTab(page, 'Settings');
  await page.getByRole('combobox', { name: 'Wing tip', exact: true }).selectOption('pointed');
  const pointed = await changedFrom(page, flat, 'pointed tip');
  // Tip chord 144 mm -> 1.2 mm: the planform area in view shrinks by about a third; the camera and
  // the span stay, so the bounding box keeps its size (the tips end in a sub-pixel point).
  expect(pointed.opaque).toBeLessThan(0.75 * flat.opaque);
  expect(pointed.opaque).toBeGreaterThan(0.5 * flat.opaque);
  expect(Math.abs(pointed.box.w - flat.box.w), `box width ${pointed.box.w} vs ${flat.box.w}`).toBeLessThanOrEqual(0.01 * flat.box.w);
  expect(Math.abs(pointed.box.h - flat.box.h), `box height ${pointed.box.h} vs ${flat.box.h}`).toBeLessThanOrEqual(2);

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('combobox', { name: 'Wing tip', exact: true })).toHaveValue('flat');
  await backTo(page, flat, 'Undo pointed tip');
});
