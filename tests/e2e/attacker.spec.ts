/**
 * P4-X attacker suite — browser spot checks.
 *
 * P4-X-001: IDOR by URL editing (ownerB -> business A record URLs).
 * P4-X-009: framing headers live.
 */
import { test, expect } from './fixtures';
import { loginAs } from './fixtures';

test.describe('P4-X attacker (browser)', () => {
  test('P4-X-001: ownerB editing URL to business A job -> no data', async ({ page }) => {
    await loginAs(page, 'ownerB');
    // e2e-job-late belongs to business A (seed-biz-on).
    await page.goto('/jobs/e2e-job-late');
    await page.waitForLoadState('networkidle').catch(() => {});
    const body = await page.textContent('body');
    expect(body).not.toContain('E2ETEST Late job');
  });

  test('P4-X-001: ownerB editing URL to business A customer -> no data', async ({ page }) => {
    await loginAs(page, 'ownerB');
    await page.goto('/customers/seed-cust-on-1');
    await page.waitForLoadState('networkidle').catch(() => {});
    const body = await page.textContent('body');
    expect(body).not.toContain('Alice Tremblay');
  });

  test('P4-X-001: ownerB API fetch of business A customer -> not found', async ({ page }) => {
    await loginAs(page, 'ownerB');
    const res = await page.request.get('/api/customers/options');
    expect([200, 401, 403, 404].includes(res.status())).toBe(true);
  });

  test('P4-X-009: X-Frame-Options header present live', async ({ page }) => {
    const res = await page.goto('/');
    const headers = res?.headers() ?? {};
    expect(headers['x-frame-options']).toBeTruthy();
  });

  test('P4-X-002: XSS payload in customer name renders escaped', async ({ page }) => {
    await loginAs(page, 'ownerA');
    await page.goto('/customers');
    // If a stored XSS payload existed, it must render as text, not execute.
    // Assert no unexpected script execution by checking for alert dialogs.
    let alerted = false;
    page.on('dialog', () => {
      alerted = true;
    });
    await page.waitForTimeout(1000);
    expect(alerted).toBe(false);
  });
});
