/**
 * Part A (dashboard rebuild): before/after screenshots of the dashboard
 * with demo data, at 390x844 and 430x932, EN + FR (kivo-locale cookie),
 * light mode only (the app has no dark mode yet — that is Part B).
 *
 * Prerequisites (local only):
 *   1. Local Postgres running, migrations applied:
 *      DATABASE_URL=<redacted>
 *   2. Demo business seeded:  npm run seed:demo
 *   3. App built + started:    npm run build && PORT=3101 npm run start
 *
 * Usage: E2E_BASE_URL=http://127.0.0.1:3101 node scripts/shots-dashboard-a.mjs [before|after]
 * Output: docs/design-screens/dashboard-a/{before,after}-dashboard-{390,430}-{en,fr}.png
 */
import { firefox } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const BASE = process.env.E2E_BASE_URL || 'http://127.0.0.1:3101';
const PREFIX = process.argv[2] === 'after' ? 'after' : 'before';
const OUT = join(__dirname, '..', 'docs', 'design-screens', 'dashboard-a');
const EMAIL = 'demo-owner@example.ca';
const PASSWORD = 'DemoPass123!';

const VIEWPORTS = [
  ['390', { width: 390, height: 844 }],
  ['430', { width: 430, height: 932 }],
];

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[name="email"]', EMAIL);
  await page.fill('input[name="password"]', PASSWORD);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30000 }),
    page.click('button[type="submit"]'),
  ]);
}

(async () => {
  mkdirSync(OUT, { recursive: true });
  // Local Chromium (v152) blocks public->loopback navigations via its
  // Local Network Access check in this sandbox; Firefox works.
  const browser = await firefox.launch({ headless: true });
  for (const [locale, cookieValue] of [['en', 'en'], ['fr', 'fr']]) {
    const ctx = await browser.newContext({
      locale: locale === 'fr' ? 'fr-CA' : 'en-CA',
      timezoneId: 'America/Toronto',
      isMobile: true,
      hasTouch: true,
    });
    await ctx.addCookies([
      { name: 'kivo-locale', value: cookieValue, domain: '127.0.0.1', path: '/' },
    ]);
    const page = await ctx.newPage();
    await login(page);
    for (const [vpName, vp] of VIEWPORTS) {
      await page.setViewportSize(vp);
      await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1200);
      const name = `${PREFIX}-dashboard-${vpName}-${locale}.png`;
      await page.screenshot({ path: join(OUT, name), fullPage: true });
      console.log('saved', name);
    }
    await ctx.close();
  }
  await browser.close();
})();
