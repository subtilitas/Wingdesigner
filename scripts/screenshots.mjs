// Regenerates the documentation screenshots in docs/wiki/images/ from the production build.
// Usage: npm run screenshots   (PW_CHROMIUM=/path/to/chrome selects a local Chromium binary)
import { mkdirSync } from 'node:fs';
import { build, preview } from 'vite';
import { chromium, devices } from '@playwright/test';

const OUT = 'docs/wiki/images';
const PORT = 4175;
mkdirSync(OUT, { recursive: true });

await build({ logLevel: 'warn' });
const server = await preview({ preview: { port: PORT, strictPort: true }, logLevel: 'warn' });
const url = `http://localhost:${PORT}/`;
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});

// A synthetic airfoil (NACA 4412 at 13 stations) written as an "X Yo Yu" percent table with decimal
// commas, to show format detection and warnings in the upload preview.
function sampleTable() {
  const xs = [0, 1.25, 2.5, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  const t = 0.12;
  const rows = xs.map((xp) => {
    const x = xp / 100;
    const yt = 5 * t * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x ** 2 + 0.2843 * x ** 3 - 0.1015 * x ** 4);
    const m = 0.04;
    const p = 0.4;
    const yc = x < p ? (m / p ** 2) * (2 * p * x - x * x) : (m / (1 - p) ** 2) * (1 - 2 * p + 2 * p * x - x * x);
    const f = (v) => (v * 100).toFixed(3).replace('.', ',');
    return `  ${String(xp).replace('.', ',').padEnd(6)} ${f(yc + yt).padStart(7)} ${f(yc - yt).padStart(8)}`;
  });
  return ['Sample 4412 table', '', '  X      Yo       Yu', ...rows, ''].join('\r\n');
}

async function createDesign(page, preset) {
  await page.goto(url);
  const wizard = page.locator('dialog[open]');
  await wizard.getByRole('radio', { name: new RegExp(preset) }).click();
  await page.waitForTimeout(300);
  return wizard;
}

async function shoot(target, name) {
  await target.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`${OUT}/${name}.png`);
}

// Desktop.
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, colorScheme: 'light', locale: 'en-US' });
  const page = await ctx.newPage();
  const wizard = await createDesign(page, 'Glider');
  await shoot(wizard, 'wizard');
  await wizard.getByRole('button', { name: 'Create design' }).click();
  await page.waitForTimeout(600);
  await page.locator('.toast').evaluate((el) => el.classList.remove('show'));
  await page.waitForTimeout(300);
  await shoot(page, 'main-desktop');

  await page.getByRole('tab', { name: 'Planform' }).click();
  await page.waitForTimeout(400);
  await shoot(page.locator('.panel'), 'planform');

  await page.getByRole('tab', { name: 'Checks' }).click();
  await page.waitForTimeout(200);
  await shoot(page.locator('.panel'), 'checks');

  await page.getByRole('tab', { name: 'Settings' }).click();
  await page.waitForTimeout(200);
  await shoot(page.locator('.panel'), 'settings');

  await page.getByRole('tab', { name: 'Airfoils' }).click();
  await page.waitForTimeout(400);
  await shoot(page.locator('.panel'), 'airfoils');

  await page.locator('.dropzone input[type=file]').setInputFiles({ name: 'sample4412.txt', mimeType: 'text/plain', buffer: Buffer.from(sampleTable(), 'latin1') });
  const preview = page.locator('dialog[open]');
  await preview.getByRole('heading').waitFor();
  await page.waitForTimeout(400);
  await shoot(preview, 'upload-preview');
  await preview.getByRole('button', { name: 'Cancel' }).click();

  await page.getByRole('button', { name: 'Export' }).click();
  await page.waitForTimeout(200);
  await shoot(page.locator('dialog[open]'), 'export-dialog');
  await page.locator('dialog[open]').getByRole('button', { name: 'Cancel' }).click();

  await page.getByRole('tab', { name: 'Sections' }).click();
  await page.waitForTimeout(200);
  await shoot(page.locator('.panel'), 'sections');
  await ctx.close();
}

// Swept flying wing with the NURBS control net.
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, colorScheme: 'light', locale: 'en-US' });
  const page = await ctx.newPage();
  const wizard = await createDesign(page, 'Swept flying wing');
  await wizard.getByRole('button', { name: 'Create design' }).click();
  await page.waitForTimeout(400);
  await page.getByRole('tab', { name: 'Settings' }).click();
  await page.getByLabel('Show NURBS control net').check();
  await page.locator('.toast').evaluate((el) => el.classList.remove('show'));
  await page.waitForTimeout(500);
  await shoot(page.locator('.view-wrap'), 'flying-wing-control-net');
  await ctx.close();
}

// Phone.
{
  const ctx = await browser.newContext({ ...devices['Pixel 7'], colorScheme: 'light', locale: 'en-US' });
  const page = await ctx.newPage();
  const wizard = await createDesign(page, 'Sport');
  await wizard.getByRole('button', { name: 'Create design' }).click();
  await page.waitForTimeout(600);
  await page.locator('.toast').evaluate((el) => el.classList.remove('show'));
  await shoot(page, 'mobile-main');
  await page.getByRole('tab', { name: 'Planform' }).click();
  await page.getByRole('group', { name: /End line/ }).getByLabel('Use guide curve').check();
  await page.waitForTimeout(400);
  await page.locator('.planform-canvas').scrollIntoViewIfNeeded();
  await shoot(page, 'mobile-planform');
  await ctx.close();
}

await browser.close();
await new Promise((resolve) => server.httpServer.close(resolve));
