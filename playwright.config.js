import { defineConfig, devices } from '@playwright/test';

// Smoke tests against the production build (vite preview).
// PW_CHROMIUM overrides the browser binary (e.g. a preinstalled Chromium).
const launchOptions = process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {};

export default defineConfig({
  testDir: 'e2e',
  timeout: 60000,
  retries: 0,
  // The JSON report feeds the device-only test counts of npm run counts:check -- --e2e-report.
  reporter: [['list'], ['json', { outputFile: 'playwright-report/results.json' }]],
  // The app starts in German on a German browser; the specs assert the English texts. A fixed locale keeps them
  // independent of the system language (e2e/language.spec.js sets its own).
  use: { baseURL: 'http://localhost:4173', locale: 'en-US', launchOptions },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], launchOptions } },
    { name: 'mobile', use: { ...devices['Pixel 7'], launchOptions } },
  ],
  webServer: { command: 'npm run preview -- --port 4173 --strictPort', url: 'http://localhost:4173', reuseExistingServer: false, timeout: 60000 },
});
