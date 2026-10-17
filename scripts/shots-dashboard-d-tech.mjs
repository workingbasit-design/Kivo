/**
 * Part D: technician "My day" screenshots (tech account only).
 * Run after a server restart to avoid the IP rate limit.
 */
import { firefox } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.E2E_BASE_URL || 'http://127.0.0.1:3101';
const OUT = join(__dirname, '..', 'docs', 'design-screens', 'dashboard-d');
const VIEWPORTS = [
  ['390', { width: 390, height: 844 }],
  ['430', { width: 430, height: 932 }],
];

(async () => {
  mkdirSync(OUT, { recursive: true });
  const browser = await firefox.launch({ headless: true });
  for (const [locale, cookieValue] of [['en', 'en'], ['fr', 'fr']]) {
    for (const theme of ['light', 'dark']) {
      const context = await browser.newContext();
      await context.addCookies([
        { name: 'kivo-locale', value: cookieValue, domain: '127.0.0.1', path: '/' },
      ]);
      await context.addInitScript((t) => localStorage.setItem('ej-theme', t), theme);
      const page = await context.newPage();
      try {
        await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
        await page.fill('input[name="email"]', 'demo-jay.m@example.ca');
        await page.fill('input[name="password"]', 'DemoPass123!');
        await Promise.all([
          page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30000 }),
          page.click('button[type="submit"]'),
        ]);
        await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(2500);
        for (const [vp, size] of VIEWPORTS) {
          await page.setViewportSize(size);
          await page.waitForTimeout(600);
          await page.screenshot({ path: join(OUT, `tech-${locale}-${theme}-${vp}.png`), fullPage: true });
          console.log(`captured tech-${locale}-${theme}-${vp}.png`);
        }
      } catch (e) {
        console.error(`FAILED tech/${locale}/${theme}:`, e.message);
      }
      await context.close();
    }
  }
  await browser.close();
})();
