/**
 * Part 0 (dashboard rebuild): capture existing screens with demo data.
 *
 * Prerequisites (local only):
 *   1. Local Postgres running, migrations applied:
 *        DATABASE_URL=<local> npx prisma migrate deploy
 *   2. Demo business seeded:  npm run seed:demo
 *   3. App built + started:    npm run build && PORT=3101 npm run start
 *      (or: E2E_BASE_URL=http://127.0.0.1:3101 npx next start -p 3101)
 *
 * Captures, at 390x844 and 430x932, EN + FR (kivo-locale cookie):
 *   dashboard (Today), schedule, jobs, money, customers, quotes, invoices, leads
 * into docs/design-screens/dashboard-0/.
 *
 * Usage: E2E_BASE_URL=http://127.0.0.1:3101 node scripts/shots-demo-0.cjs
 */
import { firefox } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const BASE = process.env.E2E_BASE_URL || 'http://127.0.0.1:3101';
const OUT = join(__dirname, '..', 'docs', 'design-screens', 'dashboard-0');
const EMAIL = 'demo-owner@example.ca';
const PASSWORD = 'DemoPass123!';

const PAGES = [
  ['dashboard', '/dashboard'],
  ['schedule', '/schedule'],
  ['jobs', '/jobs'],
  ['money', '/money'],
  ['customers', '/customers'],
  ['quotes', '/quotes'],
  ['invoices', '/invoices'],
  ['leads', '/leads'],
];
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
  // NOTE: local Chromium (v152) blocks public->loopback navigations via its
  // Local Network Access check in this sandbox, so screenshots use Firefox,
  // which reaches the local app server without issue.
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
    // Sanity: the demo banner must be visible on the dashboard.
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
    const banner = await page.locator('[role="status"]').first().textContent().catch(() => '');
    console.log(`[${locale}] demo banner:`, JSON.stringify((banner || '').trim().slice(0, 60)));
    for (const [vpName, vp] of VIEWPORTS) {
      await page.setViewportSize(vp);
      for (const [name, url] of PAGES) {
        await page.goto(`${BASE}${url}`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(1200);
        const file = join(OUT, `${name}-${vpName}-${locale}.png`);
        // Viewport capture (not fullPage): long lists exceed the 32767px
        // screenshot limit, and the above-the-fold view is what matters.
        await page.screenshot({ path: file });
        console.log('saved', relative(process.cwd(), file));
      }
    }
    await ctx.close();
  }
  await browser.close();
  console.log('done');
})().catch((e) => {
  console.error('SHOTS FAILED:', e);
  process.exit(1);
});
