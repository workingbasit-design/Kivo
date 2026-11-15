import { defineConfig, devices } from '@playwright/test';

/**
 * Prompt 4 E2E configuration.
 *
 * Runs against a local production build (`next start`) backed by an isolated
 * test database. NEVER point E2E_BASE_URL at production.
 *
 *   DATABASE_URL=<test-db> npm run build
 *   DATABASE_URL=<test-db> npm run start:e2e   # :3100 (or reuseExistingServer)
 *   npx playwright test
 *
 * In CI the workflow seeds the DB, builds, starts the server, then runs this.
 */
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3100';

if (BASE_URL.includes('kivo-nine-silk.vercel.app') || BASE_URL.includes('vercel.app')) {
  throw new Error(`Refusing to run E2E against a vercel.app URL: ${BASE_URL}`);
}

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'list',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // en-CA default; bilingual.spec.ts overrides per-test
    locale: 'en-CA',
    timezoneId: 'America/Toronto',
  },
  webServer: {
    command: 'npm run start:e2e',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      // The app under test must use the test database. CI sets DATABASE_URL.
      DATABASE_URL: process.env.DATABASE_URL ?? '',
      // E2E only: disable the in-memory rate limiter for the test server.
      // The suite logs in hundreds of times from 127.0.0.1, which would
      // otherwise share one `login:unknown` bucket (8/10 min) and collapse
      // into 60s login timeouts. Never set on Vercel/production.
      E2E_DISABLE_RATE_LIMIT: '1',
    },
  },
  projects: [
    {
      name: 'iphone',
      // iPhone 14 descriptor uses WebKit at 390x844
      use: { ...devices['iPhone 14'] },
    },
    {
      name: 'android',
      // Pixel 7 descriptor uses Chromium
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
