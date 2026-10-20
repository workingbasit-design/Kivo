import { defineConfig } from '@playwright/test';
import { existsSync } from 'fs';

/**
 * FIX-NOW Session 2 — readability test config.
 *
 * Runs tests/kit/readability.spec.ts against a running app instance.
 * The main playwright.config.ts refuses vercel.app base URLs (Prompt 4 E2E
 * rule: never run E2E against a deployment), so this separate config exists
 * for kit readability runs, which target preview deployments or local builds.
 *
 *   # local production build (next start -p 3100) in the sandboxed env,
 *   # where Chromium cannot navigate to localhost directly:
 *   KIT_LOCAL_BRIDGE=1 npx playwright test -c playwright.readability.config.ts
 *
 *   # preview deployment (once reachable)
 *   KIT_BASE_URL=https://<preview>.vercel.app npx playwright test -c playwright.readability.config.ts
 *
 * Auth: tests/.auth/owner.json (signed-in owner storageState).
 */
const BASE_URL = process.env.KIT_BASE_URL ?? 'http://127.0.0.1:3100';

// This sandbox ships its own Chromium; CI runners use Playwright's bundled one.
const META_CHROMIUM = '/opt/meta-chromium/chrome';

export default defineConfig({
  testDir: './tests/kit',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  timeout: 180_000,
  expect: { timeout: 15_000 },
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: BASE_URL,
    locale: 'en-CA',
    timezoneId: 'America/Toronto',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    launchOptions: existsSync(META_CHROMIUM)
      ? {
          executablePath: META_CHROMIUM,
          args: ['--no-sandbox', '--disable-dev-shm-usage', '--no-proxy-server'],
        }
      : {},
  },
});
