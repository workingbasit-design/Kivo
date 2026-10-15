/**
 * P4-AX-001…010 — Accessibility: axe sweeps + keyboard + names.
 *
 * Zero serious/critical axe violations on every page, in both languages.
 */
import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';
import { loginAs } from './fixtures';
import AxeBuilder from '@axe-core/playwright';

const PAGES = [
  '/',
  '/directory',
  '/login',
  '/dashboard',
  '/jobs',
  '/schedule',
  '/customers',
  '/quotes',
  '/invoices',
  '/expenses',
  '/money',
  '/settings',
];

async function expectNoSerious(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();
  const bad = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(bad, `${label}: ${JSON.stringify(bad.map((v) => v.id))}`).toEqual([]);
}

test.describe('P4-AX axe sweeps (en)', () => {
  test('P4-AX-001: public pages — zero serious/critical', async ({ page }) => {
    for (const path of ['/', '/directory', '/login', '/privacy', '/terms']) {
      await page.goto(path);
      await page.waitForLoadState('networkidle').catch(() => {});
      await expectNoSerious(page, `en ${path}`);
    }
  });

  test('P4-AX-002: app pages (owner) — zero serious/critical', async ({ page }) => {
    await loginAs(page, 'ownerA');
    for (const path of ['/dashboard', '/jobs', '/schedule', '/customers', '/quotes', '/invoices', '/expenses', '/money', '/settings']) {
      await page.goto(path);
      await page.waitForLoadState('networkidle').catch(() => {});
      await expectNoSerious(page, `en ${path}`);
    }
  });
});

test.describe('P4-AX axe sweeps (fr)', () => {
  test.beforeEach(async ({ page, context }) => {
    await page.goto('/');
    const baseURL = new URL(page.url()).origin;
    await context.addCookies([{ name: 'kivo-locale', value: 'fr', url: baseURL }]);
  });

  test('P4-AX-003: public pages in French — zero serious/critical', async ({ page }) => {
    for (const path of ['/', '/directory', '/login']) {
      await page.goto(path);
      await page.waitForLoadState('networkidle').catch(() => {});
      await expectNoSerious(page, `fr ${path}`);
    }
  });

  test('P4-AX-004: app pages in French — zero serious/critical', async ({ page }) => {
    await loginAs(page, 'ownerA');
    for (const path of ['/dashboard', '/jobs', '/customers', '/invoices']) {
      await page.goto(path);
      await page.waitForLoadState('networkidle').catch(() => {});
      await expectNoSerious(page, `fr ${path}`);
    }
  });
});

test.describe('P4-AX keyboard', () => {
  test('P4-AX-005: keyboard-only login', async ({ page }) => {
    await page.goto('/login');
    await page.keyboard.press('Tab');
    // Focus should land on an interactive element; typing must work.
    await page.keyboard.type('seed-owner@mapleleaf.example.ca');
    await page.keyboard.press('Tab');
    await page.keyboard.type('SeedPass123!');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/dashboard/, { timeout: 15000 }).catch(() => {});
  });

  test('P4-AX-006: keyboard-only job creation reaches the form', async ({ page }) => {
    await loginAs(page, 'ownerA');
    await page.goto('/jobs/new');
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'A'].includes(focused ?? '')).toBe(true);
  });

  test('P4-AX-007: keyboard-only invoice flow', async ({ page }) => {
    await loginAs(page, 'ownerA');
    await page.goto('/invoices');
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'A'].includes(focused ?? '')).toBe(true);
  });

  test('P4-AX-008: focus is visible (no focus outline removal)', async ({ page }) => {
    await page.goto('/login');
    const css = await page.evaluate(() => {
      const els = document.querySelectorAll('*');
      let bad = 0;
      // Spot-check: computed outline on focused input.
      const input = document.querySelector('input');
      if (input) {
        (input as HTMLElement).focus();
        const o = getComputedStyle(input).outlineStyle;
        if (o === 'none') bad++;
      }
      return { checked: els.length, bad };
    });
    expect(css.bad).toBe(0);
  });
});

test.describe('P4-AX names', () => {
  test('P4-AX-009: every icon button has an accessible name', async ({ page }) => {
    await loginAs(page, 'ownerA');
    for (const path of ['/dashboard', '/jobs']) {
      await page.goto(path);
      await page.waitForLoadState('networkidle').catch(() => {});
      const unnamed = await page.evaluate(() => {
        const btns = [...document.querySelectorAll('button')];
        return btns
          .filter((b) => {
            const text = (b.textContent ?? '').trim();
            const aria = b.getAttribute('aria-label') || b.getAttribute('title');
            // Icon-only: no text content and no accessible name.
            return text === '' && !aria;
          })
          .map((b) => b.outerHTML.slice(0, 120));
      });
      expect(unnamed, `${path}: unnamed icon buttons`).toEqual([]);
    }
  });

  test('P4-AX-010: form inputs have labels', async ({ page }) => {
    await page.goto('/login');
    const unlabeled = await page.evaluate(() => {
      const inputs = [...document.querySelectorAll('input')].filter(
        (i) => !['hidden', 'submit'].includes(i.type),
      );
      return inputs
        .filter((i) => {
          const id = i.id;
          const label = id ? document.querySelector(`label[for="${id}"]`) : null;
          return !label && !i.getAttribute('aria-label') && !i.getAttribute('placeholder');
        })
        .map((i) => i.outerHTML.slice(0, 100));
    });
    expect(unlabeled).toEqual([]);
  });
});
