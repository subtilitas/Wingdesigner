import { defineConfig, devices } from '@playwright/test';

// Smoke tests against the production build (vite preview).
// PW_CHROMIUM overrides the browser binary (e.g. a preinstalled Chromium).
const launchOptions = process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {};

export default defineConfig({
  testDir: 'e2e',
  timeout: 60000,
  retries: 0,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:4173', launchOptions },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], launchOptions } },
    { name: 'mobile', use: { ...devices['Pixel 7'], launchOptions } },
  ],
  webServer: { command: 'npm run preview -- --port 4173 --strictPort', url: 'http://localhost:4173', reuseExistingServer: false, timeout: 60000 },
});
