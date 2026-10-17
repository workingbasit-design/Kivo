/**
 * Part D (dashboard rebuild): charts + proof screenshots.
 *
 * Prerequisites (local only):
 *   1. Local Postgres with the demo DB seeded (see scripts/seed-demo.ts).
 *   2. App built + started against that DB:
 *        DATABASE_URL=postgresql://postgres:demo-local-pw@127.0.0.1:5432/everyjob_demo \
 *          npx next start -p 3101 -H 127.0.0.1
 *   3. A brand-new empty business (owner login new-owner@example.ca).
 *
 * Captures, at 390x844 and 430x932, EN + FR (kivo-locale cookie),
 * light + dark (localStorage ej-theme):
 *   - demo business owner dashboard (full page)
 *   - brand-new business dashboard (empty state)
 *   - technician "My day" view (demo-jay.m@example.ca)
 * into docs/design-screens/dashboard-d/.
 *
 * Usage: E2E_BASE_URL=http://127.0.0.1:3101 node scripts/shots-dashboard-d.mjs
 */
import { firefox } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const BASE = process.env.E2E_BASE_URL || 'http://127.0.0.1:3101';
const OUT = join(__dirname, '..', 'docs', 'design-screens', 'dashboard-d');

const ACCOUNTS = [
  { key: 'demo', email: 'demo-owner@example.ca', password: 'DemoPass123!', label: 'demo business' },
  { key: 'new', email: 'new-owner@example.ca', password: 'NewBiz123!', label: 'brand-new business' },
  { key: 'tech', email: 'demo-jay.m@example.ca', password: 'DemoPass123!', label: 'technician' },
];

const VIEWPORTS = [
  ['390', { width: 390, height: 844 }],
  ['430', { width: 430, height: 932 }],
];

async function login(page, email, password) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30000 }),
    page.click('button[type="submit"]'),
  ]);
}

(async () => {
  mkdirSync(OUT, { recursive: true });
  const browser = await firefox.launch({ headless: true });
  for (const acct of ACCOUNTS) {
    for (const [locale, cookieValue] of [['en', 'en'], ['fr', 'fr']]) {
      for (const theme of ['light', 'dark']) {
        const context = await browser.newContext();
        await context.addCookies([
          { name: 'kivo-locale', value: cookieValue, domain: '127.0.0.1', path: '/' },
        ]);
        await context.addInitScript(
          (t) => localStorage.setItem('ej-theme', t),
          theme
        );
        const page = await context.newPage();
        try {
          await login(page, acct.email, acct.password);
          await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
          // Let charts + Suspense sections settle.
          await page.waitForTimeout(2500);
          for (const [vp, size] of VIEWPORTS) {
            await page.setViewportSize(size);
            await page.waitForTimeout(600);
            await page.screenshot({
              path: join(OUT, `${acct.key}-${locale}-${theme}-${vp}.png`),
              fullPage: true,
            });
            console.log(`captured ${acct.key}-${locale}-${theme}-${vp}.png`);
          }
        } catch (e) {
          console.error(`FAILED ${acct.key}/${locale}/${theme}:`, e.message);
        }
        await context.close();
      }
    }
  }
  await browser.close();
  console.log('done ->', OUT);
})();
