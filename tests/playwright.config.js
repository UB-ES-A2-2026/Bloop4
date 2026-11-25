// Proves E2E i d'accessibilitat amb Playwright. Abans: `npm run e2e:up` (stack de proves).
// Als PR s'executa el projecte chromium; cada nit, tots (vegeu tests/README.md).
import { defineConfig, devices } from '@playwright/test';
import { BASE_URL } from './e2e/support/env.mjs';

const CI = Boolean(process.env.CI);

export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',
  globalSetup: './e2e/global-setup.mjs',
  fullyParallel: true,
  forbidOnly: CI,
  // A la CI, un reintent: si passa a la segona, la prova surt com a inestable (flaky) a l'informe.
  retries: CI ? 1 : 0,
  workers: CI ? 2 : undefined,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: CI
    ? [['list'], ['github'], ['html', { outputFolder: 'playwright-report', open: 'never' }], ['json', { outputFile: 'reports/playwright.json' }]]
    : [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }], ['json', { outputFile: 'reports/playwright.json' }]],
  use: {
    baseURL: BASE_URL,
    locale: 'es-ES',
    timezoneId: 'Europe/Madrid',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobil', use: { ...devices['Pixel 7'] } },
  ],
});
