/**
 * Deep test 2026-11-09 (architect position) — regression specs.
 *
 * F1: long unbroken strings (100-char customer name, 90-char job title)
 *     must not push any detail page past the 390px viewport
 *     (2026-11-08: job detail scrollWidth 1356, invoice detail 859).
 * F2: no React #418 hydration errors on /settings/booking (the
 *     BookingSettingsForm origin was read in a useState initializer,
 *     so first client render differed from SSR on every load).
 * F3: the dashboard "View today" pill must meet 4.5:1 in dark mode
 *     (2026-11-08: 1.12, near-white text on lime).
 * F5: the invoice/quote builders must render French labels in fr-CA
 *     mode (was: hardcoded "Customer", "Invoice date", "Notes").
 *
 * Follows the existing fixtures (loginAs ownerA, kivo-locale cookie).
 * Runs against the isolated test DB like the rest of the suite, never
 * against production.
 */
import { test, expect, loginAs } from './fixtures';

const LONG_CUSTOMER = 'E2ETEST' + 'x'.repeat(93); // 100 chars, unbroken
const LONG_JOB = 'E2ETESTJob' + 'y'.repeat(80); // 90 chars, unbroken

async function scrollWidth(page: import('@playwright/test').Page) {
  return page.evaluate(() => document.documentElement.scrollWidth);
}

test.describe('deep-test-20261109', () => {
  test('F1: long unbroken names do not overflow detail pages at 390px', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAs(page, 'ownerA');

    // Long-name customer.
    await page.goto('/customers/new');
    await page.locator('input[name="name"]').first().fill(LONG_CUSTOMER);
    await page.evaluate(() => {
      document.querySelector('form button[type="submit"]')?.dispatchEvent(
        new MouseEvent('click', { bubbles: true }),
      );
    });
    await page.waitForURL(/customers\/cm/, { timeout: 30_000 }).catch(() => {});
    await page.waitForTimeout(2000);

    // Long-title job for that customer.
    await page.goto('/jobs/new');
    await page.locator('input[name="title"]').first().fill(LONG_JOB);
    await page
      .locator('select[name="customerId"]')
      .selectOption({ label: LONG_CUSTOMER });
    const date = page.locator('input[name="date"]').first();
    if (await date.count()) {
      await date.fill(new Date().toISOString().slice(0, 10));
    }
    const price = page.locator('input[name="price"]').first();
    if (await price.count()) await price.fill('200');
    await page.evaluate(() => {
      document.querySelector('form button[type="submit"]')?.dispatchEvent(
        new MouseEvent('click', { bubbles: true }),
      );
    });
    await page.waitForTimeout(4000);

    // Job detail must fit the viewport.
    await page.goto('/jobs');
    await page.waitForTimeout(2000);
    const jobHref = await page.evaluate((title) => {
      const a = [...document.querySelectorAll('a')].find((x) =>
        (x.textContent || '').includes(title.slice(0, 40)),
      );
      return a ? a.getAttribute('href') : null;
    }, LONG_JOB);
    expect(jobHref, 'long-title job listed').toBeTruthy();
    await page.goto(jobHref!);
    await page.waitForTimeout(3000);
    expect(
      await scrollWidth(page),
      'job detail scrollWidth with 90-char unbroken title',
    ).toBeLessThanOrEqual(391);

    // Customer detail must fit the viewport.
    await page.goto('/customers');
    await page.waitForTimeout(2000);
    const custHref = await page.evaluate((name) => {
      const a = [...document.querySelectorAll('a[href^="/customers/"]')].find(
        (x) => (x.textContent || '').includes(name.slice(0, 40)),
      );
      return a ? a.getAttribute('href') : null;
    }, LONG_CUSTOMER);
    expect(custHref, 'long-name customer listed').toBeTruthy();
    await page.goto(custHref!);
    await page.waitForTimeout(3000);
    expect(
      await scrollWidth(page),
      'customer detail scrollWidth with 100-char unbroken name',
    ).toBeLessThanOrEqual(391);
  });

  test('F2: no React #418 hydration errors on /settings/booking', async ({
    page,
  }) => {
    const hits: string[] = [];
    page.on('console', (msg) => {
      if (/418|hydration/i.test(msg.text())) hits.push(msg.text().slice(0, 200));
    });
    page.on('pageerror', (err) => {
      if (/418|hydration/i.test(String(err))) hits.push(String(err).slice(0, 200));
    });
    await loginAs(page, 'ownerA');
    await page.goto('/settings/booking');
    await page.waitForTimeout(3000);
    await page.goto('/settings/booking');
    await page.waitForTimeout(3000);
    expect(hits, 'hydration errors on /settings/booking').toEqual([]);
  });

  test('F2b: no React #418 hydration errors on the reviews panel', async ({
    page,
  }) => {
    const hits: string[] = [];
    page.on('console', (msg) => {
      if (/418|hydration/i.test(msg.text())) hits.push(msg.text().slice(0, 200));
    });
    page.on('pageerror', (err) => {
      if (/418|hydration/i.test(String(err))) hits.push(String(err).slice(0, 200));
    });
    await loginAs(page, 'ownerA');
    await page.goto('/reviews');
    await page.waitForTimeout(3000);
    // The setup checklist renders the Google callback URL; if it is not
    // visible the test is vacuous, so assert it is there.
    const body = await page.textContent('body');
    expect(body).toContain('/api/google/callback');
    expect(hits, 'hydration errors on /reviews').toEqual([]);
  });

  test('F3: dashboard "View today" pill meets 4.5:1 in dark mode', async ({
    page,
    context,
  }) => {
    await loginAs(page, 'ownerA');
    await context.addInitScript(() =>
      localStorage.setItem('ej-theme', 'dark'),
    );
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(2000);

    const pill = await page.evaluate(() => {
      const all = [...document.querySelectorAll('button, a, span, div')].filter(
        (e) => /view today/i.test(e.textContent || ''),
      );
      if (!all.length) return null;
      all.sort((a, b) => (a.textContent?.length ?? 0) - (b.textContent?.length ?? 0));
      const el = all[0];
      const cs = getComputedStyle(el);
      let n: Element | null = el;
      let bg: string | null = null;
      while (n && !bg) {
        const b = getComputedStyle(n).backgroundColor;
        if (b && !/rgba\(0, 0, 0, 0\)|transparent/.test(b)) bg = b;
        n = n.parentElement;
      }
      return { text: (el.textContent || '').trim(), fg: cs.color, bg };
    });
    expect(pill, '"View today" pill present on dark dashboard').not.toBeNull();
    const ratio = await page.evaluate(
      ({ fg, bg }: { fg: string; bg: string }) => {
        const parse = (s: string) => {
          const m = s.match(/rgba?\(([^)]+)\)/);
          if (!m) return null;
          const q = m[1].split(',').map(Number);
          return { r: q[0], g: q[1], b: q[2] };
        };
        const lum = (r: number, g: number, b: number) => {
          const f = (c: number) => {
            c /= 255;
            return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
          };
          return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
        };
        const f = parse(fg);
        const b = parse(bg);
        if (!f || !b) return null;
        return (
          (Math.max(lum(f.r, f.g, f.b), lum(b.r, b.g, b.b)) + 0.05) /
          (Math.min(lum(f.r, f.g, f.b), lum(b.r, b.g, b.b)) + 0.05)
        );
      },
      { fg: pill!.fg, bg: pill!.bg! },
    );
    expect(ratio, `"View today" contrast (was 1.12): ${JSON.stringify(pill)}`).not.toBeNull();
    expect(ratio!).toBeGreaterThanOrEqual(4.5);
  });

  test('F5: invoice and quote builders render French labels in fr-CA', async ({
    page,
    context,
  }) => {
    await page.goto('/');
    const baseURL = new URL(page.url()).origin;
    await context.addCookies([
      { name: 'kivo-locale', value: 'fr', url: baseURL },
    ]);
    await loginAs(page, 'ownerA');

    await page.goto('/invoices/new');
    await page.waitForTimeout(2500);
    const invLabels = await page
      .locator('label')
      .allTextContents();
    expect(invLabels.join(' | ')).toContain('Client');
    expect(invLabels.join(' | ')).toContain('Date de facturation');
    expect(invLabels.join(' | ')).toContain('Notes (facultatif)');
    expect(invLabels.join(' | ')).not.toContain('Customer');
    expect(invLabels.join(' | ')).not.toContain('Invoice date');

    await page.goto('/quotes/new');
    await page.waitForTimeout(2500);
    const quoteLabels = await page.locator('label').allTextContents();
    expect(quoteLabels.join(' | ')).toContain('Client');
    expect(quoteLabels.join(' | ')).not.toContain('Customer');
  });
});
