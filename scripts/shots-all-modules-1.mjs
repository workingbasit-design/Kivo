/**
 * Part 1 (all-modules redesign): AFTER screenshots.
 * Working tree on :3102 (production build). Viewport screenshots only
 * (pages are too tall for fullPage capture).
 * Captures 390x844 and 430x932, EN + FR (kivo-locale cookie), light + dark
 * (localStorage ej-theme) into docs/design-screens/all-modules-1/.
 */
import { firefox } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AFTER = 'http://127.0.0.1:3102';
const OUT = join(__dirname, '..', 'docs', 'design-screens', 'all-modules-1');
const EMAIL = 'demo-owner@example.ca';
const PASSWORD = 'DemoPass123!';

const VIEWPORTS = [
  ['390', { width: 390, height: 844 }],
  ['430', { width: 430, height: 932 }],
];

async function login(page) {
  await page.goto(`${AFTER}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.fill('input[name="email"]', EMAIL);
  await page.fill('input[name="password"]', PASSWORD);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30000 }),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForTimeout(2000);
}

async function shoot(browser, { path, locale, theme, loginFirst, name }) {
  const context = await browser.newContext();
  await context.addCookies([{ name: 'kivo-locale', value: locale, domain: '127.0.0.1', path: '/' }]);
  await context.addInitScript((t) => localStorage.setItem('ej-theme', t), theme);
  const page = await context.newPage();
  if (loginFirst) await login(page);
  for (const [vp, size] of VIEWPORTS) {
    await page.setViewportSize(size);
    await page.goto(`${AFTER}${path}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    const file = join(OUT, `${name}-${vp}-${locale}-${theme}.png`);
    await page.screenshot({ path: file });
    console.log('saved', file);
  }
  await context.close();
}

(async () => {
  mkdirSync(OUT, { recursive: true });
  const browser = await firefox.launch({ headless: true });

  // AFTER: Jobs + Schedule, light + dark (token migration fix).
  for (const p of ['/jobs', '/schedule']) {
    const slug = p.slice(1);
    for (const theme of ['light', 'dark']) {
      await shoot(browser, { path: p, locale: 'en', theme, loginFirst: true, name: `after-${slug}` });
    }
  }

  // AFTER: kit showcase, EN + FR, light + dark (login required in prod build).
  for (const locale of ['en', 'fr']) {
    for (const theme of ['light', 'dark']) {
      await shoot(browser, { path: '/design', locale, theme, loginFirst: true, name: 'design-kit' });
    }
  }

  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
