// Shared helpers of the browser tests: the `test` object with an automatic page-error check, the
// wizard set-up, status bar parsing, the section table, re-render waits, multi-touch gestures,
// downloads, STL parsing and the 3D canvas readback.
import { test as base, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

export { expect };

// ---------------------------------------------------------------------------------------------
// Page errors.

/** Collects uncaught page errors and console errors of a page. */
export function collectErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}

/**
 * Playwright's `test` with an automatic fixture: an uncaught page error or console error on the test
 * page fails the test after it has run. Further pages of a test use collectErrors().
 */
export const test = base.extend({
  pageErrors: [
    async ({ page }, use) => {
      const errors = collectErrors(page);
      await use(errors);
      expect(errors, 'page errors and console errors').toEqual([]);
    },
    { auto: true },
  ],
});

// ---------------------------------------------------------------------------------------------
// Basics.

export const STORAGE_KEY = 'wingdesigner.project.v1';
/** Status bar key figures (a warning count may follow). */
export const STATUS_RE = /^Span (\d+) mm · area ([\d.]+) dm² · AR ([\d.]+) · MAC ([\d.]+) mm/;
/** Status bar of a design without errors and warnings. */
export const VALID_RE = /^Span \d+ mm · area [\d.]+ dm² · AR [\d.]+ · MAC [\d.]+ mm$/;

export const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const statusOf = (page) => page.locator('.statusbar');
export const dialogOf = (page) => page.locator('dialog[open]');
export const toastOf = (page) => page.locator('.toast');

/** Waits two animation frames, so a rebuild scheduled with requestAnimationFrame has run. */
export const frames = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

/** Project as autosaved in local storage (null when nothing is saved). */
export const savedProject = (page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null'), STORAGE_KEY);

export async function openTab(page, name, { tap = false } = {}) {
  const tab = page.getByRole('tab', { name, exact: true });
  await (tap ? tab.tap() : tab.click());
  await expect(tab).toHaveAttribute('aria-selected', 'true');
}

/**
 * Key figures of the status bar. Waits until it shows figures (of the given span, when given; the
 * previous design's figures stay visible until the next rebuild frame). clean: no warning either.
 */
export async function statusFigures(page, span, { clean = false } = {}) {
  const status = statusOf(page);
  await expect(status).toHaveText(span === undefined ? STATUS_RE : new RegExp(`^Span ${span} mm · area`));
  if (clean) await expect(status).toHaveText(VALID_RE);
  const text = (await status.innerText()).trim();
  const m = text.match(STATUS_RE);
  expect(m, `status bar key figures: ${text}`).not.toBeNull();
  return { text, span: Number(m[1]), area: Number(m[2]), ar: Number(m[3]), mac: Number(m[4]), arText: m[3], macText: m[4] };
}

// ---------------------------------------------------------------------------------------------
// Build probe.

// ---------------------------------------------------------------------------------------------
// New-design wizard.

/** First visit: the first-run wizard with its summary filled (first animation frame). */
export async function openFirstRun(page) {
  await page.goto('/');
  const wizard = dialogOf(page);
  await expect(wizard.getByRole('heading', { name: 'Start a new wing design' })).toBeVisible();
  await expect(wizard.locator('p[aria-live="polite"]')).toHaveText(/\S/);
  return wizard;
}

export async function pickPreset(wizard, label, { tap = false } = {}) {
  const radio = wizard.getByRole('radio', { name: new RegExp(`^${escapeRe(label)}`) });
  await (tap ? radio.tap() : radio.click());
  await expect(radio).toHaveAttribute('aria-checked', 'true');
  await expect(wizard.getByRole('radio', { checked: true })).toHaveCount(1);
}

/** Clicks "Create design" in the open wizard and waits until the status bar shows the new span. */
export async function createFromWizard(page, { tap = false } = {}) {
  const wizard = dialogOf(page);
  const span = await wizard.getByLabel('Span (both halves) (mm)').inputValue();
  const create = wizard.getByRole('button', { name: 'Create design' });
  await expect(create).toBeEnabled();
  await (tap ? create.tap() : create.click());
  await expect(dialogOf(page)).toHaveCount(0);
  await expect(statusOf(page)).toHaveText(new RegExp(`^Span ${escapeRe(span)} mm · area`));
}

/**
 * First visit: pick a preset in the wizard, optionally fill wizard fields (label -> value) and
 * choose the tip ('flat' or 'pointed'), then create the design.
 */
export async function createDesign(page, preset, { fields = {}, tip, tap = false } = {}) {
  const wizard = await openFirstRun(page);
  await pickPreset(wizard, preset, { tap });
  for (const [label, value] of Object.entries(fields)) await wizard.getByLabel(label, { exact: true }).fill(String(value));
  if (tip) await wizard.getByRole('combobox', { name: 'Tip', exact: true }).selectOption(tip);
  await createFromWizard(page, { tap });
}

// ---------------------------------------------------------------------------------------------
// Section table and Checks tab.

export const SECTION_TITLES = {
  y: 'Span position of the section plane',
  x: 'Leading-edge position, chordwise (positive aft = sweep back)',
  z: 'Leading-edge height (dihedral)',
  chord: 'Chord length (profile scale)',
  twist: 'Twist about the pivot; positive = leading edge up',
  panelAngle: 'Angle of the panel to the next section for the mitred section planes. Empty: from y and z of the two sections.',
};

export const sectionRows = (page) => page.locator('table.sections tbody tr');
/** Row by index; -1 is the last row. */
const rowAt = (page, row) => (row === -1 ? sectionRows(page).last() : sectionRows(page).nth(row));
export const sectionField = (page, row, key) => rowAt(page, row).getByRole('spinbutton', { name: SECTION_TITLES[key], exact: true });
export const airfoilSelect = (page, row) => page.getByRole('combobox', { name: `Airfoil of section ${row + 1}`, exact: true });
/** Chord cell of a section row: the input plus an optional "tip:" or "guide:" note. */
export const chordCell = (page, row) => rowAt(page, row).locator('td').nth(4);
export const chordNote = (page, row) => chordCell(page, row).locator('div');

/**
 * Section values as shown in the table, one object per row. Keys: 'airfoil' (id), 'airfoilName'
 * (shown name) and the numeric fields of SECTION_TITLES.
 */
export function sectionValues(page, keys = ['airfoil', 'y', 'x', 'z', 'chord', 'twist']) {
  return sectionRows(page).evaluateAll(
    (trs, [ks, titles]) =>
      trs.map((tr) =>
        Object.fromEntries(
          ks.map((k) => {
            const select = tr.querySelector('select');
            if (k === 'airfoil') return [k, select.value];
            if (k === 'airfoilName') return [k, select.selectedOptions[0].textContent];
            return [k, Number(tr.querySelector(`input[title="${titles[k]}"]`).value)];
          }),
        ),
      ),
    [keys, SECTION_TITLES],
  );
}

/** Value cell of a statistics row in the Checks tab. */
export const checksValue = (page, label) =>
  page.locator('#pane-checks table.stats tr').filter({ has: page.getByRole('rowheader', { name: label, exact: true }) }).locator('td');

/** Types a value into a field and commits it with Enter; waits for the rebuild before and after. */
export async function commit(field, value) {
  const page = field.page();
  await frames(page);
  await field.fill(String(value));
  await field.press('Enter');
  await frames(page);
}

/**
 * Runs an action that re-renders the elements of `locator` (every project change re-renders the
 * panels): marks the current elements, runs the action and waits until all of them are replaced.
 */
export async function whenRerendered(locator, action) {
  const n = await locator.count();
  expect(n, 'elements to mark before the re-render').toBeGreaterThan(0);
  await locator.evaluateAll((els) => els.forEach((el) => el.setAttribute('data-e2e-old', '')));
  await action();
  await expect(locator.and(locator.page().locator('[data-e2e-old]'))).toHaveCount(0);
  await expect(locator).toHaveCount(n);
}

// ---------------------------------------------------------------------------------------------
// Touch input through the Chrome DevTools Protocol (Chromium turns the touches into pointer events).

export async function touchScreen(page) {
  const cdp = await page.context().newCDPSession(page);
  const send = (type, touchPoints) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints });
  const along = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  const pair = (c, gap) => [
    { x: c.x - gap / 2, y: c.y, id: 0 },
    { x: c.x + gap / 2, y: c.y, id: 1 },
  ];
  return {
    /** One finger from `from` to `to`. */
    async drag(from, to, steps = 12) {
      await send('touchStart', [{ ...from, id: 0 }]);
      for (let i = 1; i <= steps; i++) await send('touchMove', [{ ...along(from, to, i / steps), id: 0 }]);
      await send('touchEnd', []);
      await frames(page);
    },
    /** Two fingers on a horizontal line through `centre`, moving from `fromGap` to `toGap` apart. */
    async pinch(centre, fromGap, toGap, steps = 10) {
      await send('touchStart', pair(centre, fromGap));
      for (let i = 1; i <= steps; i++) await send('touchMove', pair(centre, fromGap + ((toGap - fromGap) * i) / steps));
      await send('touchEnd', []);
      await frames(page);
    },
    /** Two fingers `gap` apart, both moved from around `from` to around `to` (parallel drag). */
    async twoFingerDrag(from, to, gap = 80, steps = 10) {
      await send('touchStart', pair(from, gap));
      for (let i = 1; i <= steps; i++) await send('touchMove', pair(along(from, to, i / steps), gap));
      await send('touchEnd', []);
      await frames(page);
    },
    async tap(p) {
      await send('touchStart', [{ ...p, id: 0 }]);
      await send('touchEnd', []);
      await frames(page);
    },
    /** One finger from (x, y0) upwards by `dist`. */
    async swipeUp(x, y0, dist, steps = 10) {
      await send('touchStart', [{ x, y: y0, id: 0 }]);
      for (let i = 1; i <= steps; i++) await send('touchMove', [{ x, y: y0 - (dist * i) / steps, id: 0 }]);
      await send('touchEnd', []);
    },
    detach: () => cdp.detach(),
  };
}

// ---------------------------------------------------------------------------------------------
// Downloads and the export dialog.

/** Runs `trigger` and returns the download's suggested name, path and bytes. */
export async function downloadOf(page, trigger) {
  const [download] = await Promise.all([page.waitForEvent('download'), trigger()]);
  const path = await download.path();
  return { name: download.suggestedFilename(), path, bytes: readFileSync(path) };
}

export const FORMAT_LABEL = { step: /^STEP/, stl: /^STL/, '3mf': /^3MF/, json: /^Project JSON/ };
export const HALF_LABEL = { halves: /^Both halves as separate bodies/, merged: /^Full wing as one body/, right: /^Right half only/ };
export const DENS_LABEL = { normal: /^Normal/, fine: /^Fine/ };
/** The checkbox that writes Y as the up axis (the Fusion 360 fix). */
export const FUSION_FIX = /^Fusion 360 fix: Y up/;

export async function openExport(page) {
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const dlg = dialogOf(page);
  await expect(dlg.getByRole('heading', { name: 'Export' })).toBeVisible();
  return dlg;
}

/** Exports through the dialog (fmt: step, stl, 3mf, json) and returns the downloaded file. */
export async function exportFile(page, fmt, { half = 'halves', dens = 'normal', up } = {}) {
  const dlg = await openExport(page);
  await dlg.getByLabel(FORMAT_LABEL[fmt]).check();
  await dlg.getByLabel(HALF_LABEL[half]).check();
  await dlg.getByLabel(DENS_LABEL[dens]).check();
  // Without `up` the dialog keeps the up axis it starts with (the one of the last export); 'y' is the
  // Fusion 360 fix.
  if (up) await dlg.getByLabel(FUSION_FIX).setChecked(up === 'y');
  const file = await downloadOf(page, () => dlg.getByRole('button', { name: 'Download' }).click());
  await expect(dialogOf(page)).toHaveCount(0);
  return file;
}

/** Downloads the project JSON with the top-bar Save button. */
export const saveProject = (page) => downloadOf(page, () => page.getByRole('button', { name: 'Save', exact: true }).click());

// ---------------------------------------------------------------------------------------------
// STL.

/** Binary STL: header text, triangle count and each triangle's vertices (exact float32 bytes as key). */
export function parseStl(buf) {
  expect(buf.length).toBeGreaterThanOrEqual(84);
  const count = buf.readUInt32LE(80);
  expect(buf.length, 'binary STL size = 84 + 50 * triangles').toBe(84 + 50 * count);
  const tris = [];
  for (let t = 0; t < count; t++) {
    const o = 84 + t * 50 + 12;
    tris.push(
      [0, 1, 2].map((k) => {
        const q = o + k * 12;
        return { key: buf.toString('hex', q, q + 12), p: [buf.readFloatLE(q), buf.readFloatLE(q + 4), buf.readFloatLE(q + 8)] };
      }),
    );
  }
  return { header: buf.subarray(0, 80).toString('latin1').replace(/\0+$/, ''), count, tris };
}

/** Distinct vertices [x, y, z] of parsed STL triangles. */
export function stlVertices(tris) {
  const seen = new Map();
  for (const t of tris) for (const v of t) seen.set(v.key, v.p);
  return [...seen.values()];
}

/**
 * Closed-shell check on triangles given as vertex keys: every undirected edge is used by exactly two
 * triangles, the two uses run in opposite directions (consistent orientation), no triangle is
 * degenerate, and V - E + F = 2 (closed genus-0 shell).
 */
export function expectClosed(tris, label) {
  const undirected = new Map();
  const directed = new Map();
  let degenerate = 0;
  for (const t of tris) {
    if (t[0] === t[1] || t[1] === t[2] || t[0] === t[2]) degenerate++;
    for (let e = 0; e < 3; e++) {
      const [a, b] = [t[e], t[(e + 1) % 3]];
      const u = a < b ? `${a}|${b}` : `${b}|${a}`;
      undirected.set(u, (undirected.get(u) ?? 0) + 1);
      directed.set(`${a}|${b}`, (directed.get(`${a}|${b}`) ?? 0) + 1);
    }
  }
  expect(undirected.size, `${label}: edge count`).toBeGreaterThan(0);
  expect([...undirected.values()].filter((c) => c !== 2).length, `${label}: edges not used exactly twice`).toBe(0);
  expect([...directed.values()].filter((c) => c !== 1).length, `${label}: edges used twice in the same direction`).toBe(0);
  expect(degenerate, `${label}: degenerate triangles`).toBe(0);
  expect(new Set(tris.flat()).size - undirected.size + tris.length, `${label}: Euler characteristic`).toBe(2);
}

/** STL triangles as vertex keys for expectClosed(). */
export const stlShell = (tris) => tris.map((t) => t.map((v) => v.key));

// ---------------------------------------------------------------------------------------------
// 3D view.
//
// The viewer renders on demand into a WebGL canvas with preserveDrawingBuffer, so the canvas itself is
// read back instead of taking element screenshots: overlays such as the view buttons and the 4 s toast
// "Created ..." then cannot make two images differ. Statistics measured in the page:
//   opaque  pixels with alpha >= 250: the wing and its lines (the canvas background is transparent and
//           the z = 0 grid is drawn at 35 % opacity), i.e. the projected size of the wing
//   box     bounding box {x, y, w, h} of the opaque pixels (device pixels)
//   purple  pixels in the control-net colour (#9a6bd8 at 60 % opacity)
//   blue    pixels in the section-outline colour (#2f6fdf)

/** Rendered 3D canvas after the pending animation frames (store rebuild, then render) have run. */
export async function capture(page) {
  const r = await page.evaluate(
    () =>
      new Promise((resolve) => {
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            const c = document.querySelector('.viewport canvas');
            const off = document.createElement('canvas');
            off.width = c.width;
            off.height = c.height;
            const ctx = off.getContext('2d', { willReadFrequently: true });
            ctx.drawImage(c, 0, 0);
            const d = ctx.getImageData(0, 0, c.width, c.height).data;
            let [opaque, purple, blue] = [0, 0, 0];
            let [minX, maxX, minY, maxY] = [Infinity, -1, Infinity, -1];
            for (let y = 0; y < c.height; y++) {
              for (let x = 0; x < c.width; x++) {
                const i = (y * c.width + x) * 4;
                const [R, G, B, A] = [d[i], d[i + 1], d[i + 2], d[i + 3]];
                if (A >= 250) {
                  opaque++;
                  minX = Math.min(minX, x);
                  maxX = Math.max(maxX, x);
                  minY = Math.min(minY, y);
                  maxY = Math.max(maxY, y);
                }
                if (A > 0 && B - G > 40 && R - G > 20) purple++;
                if (A > 0 && B - R > 80 && B - G > 40 && R < G) blue++;
              }
            }
            resolve({
              dataUrl: c.toDataURL('image/png'),
              width: c.width,
              height: c.height,
              opaque,
              purple,
              blue,
              box: { x: minX, y: minY, w: Math.max(0, maxX - minX + 1), h: Math.max(0, maxY - minY + 1) },
            });
          }),
        );
      }),
  );
  const { dataUrl, ...stats } = r;
  return { ...stats, png: Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64') };
}

export const sameImage = (a, b) => Buffer.compare(a.png, b.png) === 0;

/** Waits until the rendered image satisfies `predicate` and is the same in two captures in a row. */
export async function settleView(page, predicate, message) {
  let last = null;
  await expect
    .poll(
      async () => {
        const cur = await capture(page);
        const ok = predicate(cur) && last !== null && sameImage(last, cur);
        last = cur;
        return ok;
      },
      { message, timeout: 15000 },
    )
    .toBe(true);
  return last;
}

export const changedFrom = (page, before, what) => settleView(page, (c) => !sameImage(c, before), `${what}: the 3D image should change`);
export const backTo = (page, expected, what) => settleView(page, (c) => sameImage(c, expected), `${what}: the 3D image should match the earlier one`);
