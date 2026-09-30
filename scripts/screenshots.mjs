// Regenerates the documentation screenshots from the production build, each one twice: the English
// interface (browser locale en-US) into docs/wiki/images/<name>.png and the German interface
// (browser locale de-DE, so the app starts in German) into docs/wiki/images/de/<name>.png.
// Both languages run the same steps. The steps name every control by its English label; the German
// run looks that label up in the German catalog (src/i18n/de/).
// Usage: npm run screenshots   (PW_CHROMIUM=/path/to/chrome selects a local Chromium binary)
import { mkdirSync } from 'node:fs';
import { build, preview } from 'vite';
import { chromium, devices } from '@playwright/test';
import { DE } from '../src/i18n/de/index.js';

const OUT = 'docs/wiki/images';
const PORT = 4175;
const LANGUAGES = [
  { code: 'en', locale: 'en-US', dir: OUT },
  { code: 'de', locale: 'de-DE', dir: `${OUT}/de` },
];
for (const { dir } of LANGUAGES) mkdirSync(dir, { recursive: true });

await build({ logLevel: 'warn' });
const server = await preview({ preview: { port: PORT, strictPort: true }, logLevel: 'warn' });
const url = `http://localhost:${PORT}/`;
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});

// A synthetic airfoil (NACA 4412 at 14 x positions) written as an "X Yo Yu" percent table with decimal
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

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// One run of all steps in one language; the screenshots go into lang.dir.
async function run(lang) {
  // A control's label in this language: the English label, or its German catalog entry.
  const t = (english) => {
    if (lang.code === 'en') return english;
    if (typeof DE[english] !== 'string') throw new Error(`No German text for "${english}"`);
    return DE[english];
  };

  async function newPage(contextOptions) {
    const ctx = await browser.newContext({ ...contextOptions, colorScheme: 'light', locale: lang.locale });
    return { ctx, page: await ctx.newPage() };
  }

  async function createDesign(page, preset) {
    await page.goto(url);
    // The app starts in the language of the browser locale; an image in the other language is an error.
    const started = await page.evaluate(() => document.documentElement.lang);
    if (started !== lang.code) throw new Error(`The app started in "${started}", expected "${lang.code}"`);
    const wizard = page.locator('dialog[open]');
    await wizard.getByRole('radio', { name: new RegExp(escapeRegExp(t(preset))) }).click();
    await page.waitForTimeout(300);
    return wizard;
  }

  async function shoot(target, name) {
    await target.screenshot({ path: `${lang.dir}/${name}.png` });
    console.log(`${lang.dir}/${name}.png`);
  }

  // Desktop.
  {
    const { ctx, page } = await newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
    const wizard = await createDesign(page, 'Glider');
    await shoot(wizard, 'wizard');
    await wizard.getByRole('button', { name: t('Create design') }).click();
    await page.waitForTimeout(600);
    await page.locator('.toast').evaluate((el) => el.classList.remove('show'));
    await page.waitForTimeout(300);
    await shoot(page, 'main-desktop');

    await page.getByRole('tab', { name: t('Planform') }).click();
    await page.waitForTimeout(400);
    await shoot(page.locator('.panel'), 'planform');

    await page.getByRole('tab', { name: t('Checks') }).click();
    await page.waitForTimeout(200);
    await shoot(page.locator('.panel'), 'checks');

    await page.getByRole('tab', { name: t('Settings') }).click();
    await page.waitForTimeout(200);
    await shoot(page.locator('.panel'), 'settings');

    await page.getByRole('tab', { name: t('Airfoils') }).click();
    await page.waitForTimeout(400);
    await shoot(page.locator('.panel'), 'airfoils');

    await page.locator('.dropzone input[type=file]').setInputFiles({ name: 'sample4412.txt', mimeType: 'text/plain', buffer: Buffer.from(sampleTable(), 'latin1') });
    const preview = page.locator('dialog[open]');
    await preview.getByRole('heading').waitFor();
    await page.waitForTimeout(400);
    await shoot(preview, 'upload-preview');
    await preview.getByRole('button', { name: t('Cancel') }).click();

    await page.getByRole('button', { name: t('Export') }).click();
    await page.waitForTimeout(200);
    await shoot(page.locator('dialog[open]'), 'export-dialog');
    await page.locator('dialog[open]').getByRole('button', { name: t('Cancel') }).click();

    await page.getByRole('tab', { name: t('Sections') }).click();
    await page.waitForTimeout(200);
    await shoot(page.locator('.panel'), 'sections');
    await ctx.close();
  }

  // Swept flying wing with the NURBS control net.
  {
    const { ctx, page } = await newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
    const wizard = await createDesign(page, 'Swept flying wing');
    await wizard.getByRole('button', { name: t('Create design') }).click();
    await page.waitForTimeout(400);
    await page.getByRole('tab', { name: t('Settings') }).click();
    await page.getByLabel(t('Show NURBS control net')).check();
    await page.locator('.toast').evaluate((el) => el.classList.remove('show'));
    await page.waitForTimeout(500);
    await shoot(page.locator('.view-wrap'), 'flying-wing-control-net');
    await ctx.close();
  }

  // Phone.
  {
    const { ctx, page } = await newPage({ ...devices['Pixel 7'] });
    const wizard = await createDesign(page, 'Sport');
    await wizard.getByRole('button', { name: t('Create design') }).click();
    await page.waitForTimeout(600);
    await page.locator('.toast').evaluate((el) => el.classList.remove('show'));
    await shoot(page, 'mobile-main');
    await page.getByRole('tab', { name: t('Planform') }).click();
    await page.getByRole('group', { name: t('End line (trailing edge)') }).getByLabel(t('Use guide curve')).check();
    await page.waitForTimeout(400);
    await page.locator('.planform-canvas').scrollIntoViewIfNeeded();
    await shoot(page, 'mobile-planform');
    await ctx.close();
  }
}

for (const lang of LANGUAGES) await run(lang);

await browser.close();
await new Promise((resolve) => server.httpServer.close(resolve));
