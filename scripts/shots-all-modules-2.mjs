/**
 * Part 2 (all-modules redesign): pattern screenshots.
 *
 * Captures each of the five screen patterns on the /design page —
 * list-screen, detail-screen, builder-screen, hub-screen, customer-page —
 * at 390x844 and 430x932, EN + FR (kivo-locale cookie), light + dark
 * (localStorage ej-theme), into docs/design-screens/all-modules-2/.
 *
 * The patterns are new in Part 2, so there is no "before" — these are the
 * after shots. Run against a local production build on :3102.
 */
import { firefox } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = 'http://127.0.0.1:3102';
const OUT = join(__dirname, '..', 'docs', 'design-screens', 'all-modules-2');
const EMAIL = 'demo-owner@example.ca';
const PASSWORD = 'DemoPass123!';

const PATTERNS = [
  'list-screen',
  'detail-screen',
  'builder-screen',
  'hub-screen',
  'customer-page',
];

const VIEWPORTS = [
  ['390', { width: 390, height: 844 }],
  ['430', { width: 430, height: 932 }],
];

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.fill('input[name="email"]', EMAIL);
  await page.fill('input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  // The post-login navigation to /dashboard can keep "load" pending;
  // poll for the URL instead of waiting on the load event.
  await page.waitForFunction(
    () => !window.location.pathname.startsWith('/login'),
    null,
    { timeout: 60000 },
  );
  await page.waitForTimeout(2000);
}

async function loginWithRetry(browser) {
  // Log in once and reuse the session: faster and avoids hammering the
  // single-connection local DB with repeated logins.
  for (let attempt = 1; attempt <= 3; attempt++) {
    const ctx = await browser.newContext();
    try {
      const page = await ctx.newPage();
      await login(page);
      const statePath = join(OUT, '.auth-state.json');
      await ctx.storageState({ path: statePath });
      await ctx.close();
      return statePath;
    } catch (e) {
      console.log(`login attempt ${attempt} failed: ${e.message.split('\n')[0]}`);
      await ctx.close();
      if (attempt === 3) throw e;
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
  throw new Error('login failed');
}

async function shootPattern(browser, statePath, { pattern, locale, theme }) {
  const context = await browser.newContext({ storageState: statePath });
  await context.addCookies([{ name: 'kivo-locale', value: locale, domain: '127.0.0.1', path: '/' }]);
  await context.addInitScript((t) => localStorage.setItem('ej-theme', t), theme);
  const page = await context.newPage();
  await page.goto(`${BASE}/design`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2500);
  const el = page.locator(`[data-pattern="${pattern}"]`);
  await el.scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  for (const [vp, size] of VIEWPORTS) {
    await page.setViewportSize(size);
    await page.waitForTimeout(500);
    const file = join(OUT, `${pattern}-${vp}-${locale}-${theme}.png`);
    await el.screenshot({ path: file });
    console.log('saved', file);
  }
  await context.close();
}

(async () => {
  mkdirSync(OUT, { recursive: true });
  const browser = await firefox.launch({ headless: true });
  const statePath = await loginWithRetry(browser);
  for (const pattern of PATTERNS) {
    for (const locale of ['en', 'fr']) {
      for (const theme of ['light', 'dark']) {
        await shootPattern(browser, statePath, { pattern, locale, theme });
      }
    }
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
