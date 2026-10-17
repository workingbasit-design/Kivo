/**
 * Part B (dashboard rebuild): capture the dashboard with the new visual
 * direction (hi-vis tokens, Barlow, Phosphor icons, tab bar, dark mode).
 *
 * Prerequisites (local only):
 *   1. Local Postgres with the demo DB seeded (see scripts/seed-demo.ts).
 *   2. App built + started against that DB:
 *        DATABASE_URL=<demo> PORT=3101 npm run start
 *
 * Captures, at 390x844 and 430x932, EN + FR (kivo-locale cookie),
 * light + dark (localStorage ej-theme): the dashboard (Today) and the
 * price book (trade icons) into docs/design-screens/dashboard-b/.
 *
 * Usage: E2E_BASE_URL=http://127.0.0.1:3101 node scripts/shots-demo-b.mjs
 */
import { firefox } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const BASE = process.env.E2E_BASE_URL || 'http://127.0.0.1:3101';
const OUT = join(__dirname, '..', 'docs', 'design-screens', 'dashboard-b');
const EMAIL = 'demo-owner@example.ca';
const PASSWORD = 'DemoPass123!';

const PAGES = [
  ['dashboard', '/dashboard'],
  ['pricebook', '/pricebook'],
  ['settings', '/settings'],
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
  const browser = await firefox.launch({ headless: true });
  for (const [locale, cookieValue] of [['en', 'en'], ['fr', 'fr']]) {
    for (const theme of ['light', 'dark']) {
      const context = await browser.newContext();
      await context.addCookies([
        { name: 'kivo-locale', value: cookieValue, domain: '127.0.0.1', path: '/' },
      ]);
      // Pre-paint theme: the inline theme script reads this same key.
      await context.addInitScript(
        (t) => localStorage.setItem('ej-theme', t),
        theme
      );
      const page = await context.newPage();
      await login(page);
      for (const [vp, size] of VIEWPORTS) {
        await page.setViewportSize(size);
        for (const [name, path] of PAGES) {
          await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
          await page.waitForTimeout(800);
          const file = join(OUT, `${name}-${vp}-${locale}-${theme}.png`);
          await page.screenshot({ path: file, fullPage: true });
          console.log('saved', file);
        }
      }
      await context.close();
    }
  }
  await browser.close();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
