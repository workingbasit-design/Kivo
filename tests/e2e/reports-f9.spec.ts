/**
 * F9-005…008 — Reports e2e.
 *
 * Requires the `reports` flag on the seeded businesses
 * (scripts/seed-staging.ts sets '{"reports": true}').
 */
import { readFileSync } from 'node:fs';
import { test, expect, loginAs, expectNoEnglishVisible } from './fixtures';

const SECTIONS = [
  'f9-revenue',
  'f9-aging',
  'f9-profit',
  'f9-tax',
  'f9-expenses',
  'f9-leads',
];

test.describe('F9 reports', () => {
  test('F9-005: owner sees all six reports, every figure links to records', async ({
    page,
  }) => {
    await loginAs(page, 'ownerA');
    await page.goto('/reports');
    await page.waitForLoadState('networkidle').catch(() => {});

    for (const id of SECTIONS) {
      await expect(page.locator(`#${id}`), `${id} visible`).toBeVisible();
    }

    // Drill-down: each section links out to its underlying records.
    await expect(
      page.locator('#f9-aging a[href^="/invoices"]').first(),
    ).toBeVisible();
    await expect(
      page.locator('#f9-expenses a[href="/expenses"]').first(),
    ).toBeVisible();
    await expect(page.locator('#f9-leads a[href="/leads"]').first()).toBeVisible();
    // Revenue month labels link to the invoice list.
    await expect(
      page.locator('#f9-revenue a[href="/invoices"]').first(),
    ).toBeVisible();
  });

  test('F9-006: CSV export downloads and matches the screen', async ({ page }) => {
    await loginAs(page, 'ownerA');
    await page.goto('/reports');
    await page.waitForLoadState('networkidle').catch(() => {});

    const downloadPromise = page.waitForEvent('download', { timeout: 30_000 });
    await page
      .locator('#f9-aging')
      .getByRole('button', { name: /Export CSV/i })
      .click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^everyjob-aging-\d{4}\.csv$/);

    const path = await download.path();
    expect(path).toBeTruthy();
    const csv = readFileSync(path!, 'utf8');
    const lines = csv.trim().split('\r\n');
    // Header + 5 aging buckets.
    expect(lines[0]).toBe('Bucket,Outstanding (CAD),Invoices');
    expect(lines.length).toBe(6);
    expect(lines[1]).toMatch(/^Current,/);

    // Screen total matches the CSV bucket sum.
    const csvTotal = lines
      .slice(1)
      .reduce((s, l) => s + Number(l.split(',')[1]), 0);
    const screenTotal = await page
      .locator('#f9-aging li:last-child p:last-child')
      .textContent();
    // formatCents always emits exactly 2 fraction digits, so stripping every
    // non-digit yields integer cents in both en-CA ("$1,234.56") and fr-CA
    // ("1 234,56 $") formats.
    const screenCents = Number(screenTotal!.replace(/[^\d]/g, ''));
    expect(Math.round(csvTotal * 100)).toBe(screenCents);
  });

  test('F9-007: technician gets 403 on /reports', async ({ page }) => {
    await loginAs(page, 'technicianA');
    const resp = await page.goto('/reports');
    expect(resp?.status()).toBe(403);
  });

  test('F9-007b: dispatcher gets 403 on /reports', async ({ page }) => {
    await loginAs(page, 'dispatcherA');
    const resp = await page.goto('/reports');
    expect(resp?.status()).toBe(403);
  });

  test('F9-008: fr-CA renders the reports in French', async ({
    page,
    context,
  }) => {
    await page.goto('/');
    const baseURL = new URL(page.url()).origin;
    await context.addCookies([
      { name: 'kivo-locale', value: 'fr', url: baseURL },
    ]);
    await loginAs(page, 'ownerA');
    await page.goto('/reports');
    await page.waitForLoadState('networkidle').catch(() => {});
    await expect(page.locator('#f9-revenue')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: /Revenus/ }).first(),
    ).toBeVisible();
    await expectNoEnglishVisible(page);
  });
});
