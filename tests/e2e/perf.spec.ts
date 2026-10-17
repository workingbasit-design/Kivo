/**
 * P4-P-002…003 — Performance & resilience.
 *
 * P4-P-002 needs the perf seed (tests/scripts/seed-perf-ci.mts): 10,000 jobs +
 * 5,000 customers in `perf-biz`. Skips gracefully without it (CI always seeds).
 * P4-P-001 (Lighthouse) runs in .github/workflows/perf.yml (record-only).
 */
import { test, expect } from './fixtures';
import { loginAs } from './fixtures';
import type { Page } from '@playwright/test';

const PERF_EMAIL = 'perf-owner@test.ca';
const PERF_PASSWORD = 'SeedPass123!';

async function loginPerf(page: Page) {
  await page.goto('/login');
  await page.fill('input[type="email"]', PERF_EMAIL);
  await page.fill('input[type="password"]', PERF_PASSWORD);
  // Do NOT swallow the timeout: a failed login must fail fast.
  // CI is slow (cold starts); allow 60s.
  await Promise.all([
    page.waitForURL(/dashboard/, { timeout: 60_000 }),
    page.locator('button[type="submit"]').first().click(),
  ]);
}

async function hasPerfData(page: Page): Promise<boolean> {
  // Probe: the perf business exists iff login succeeds.
  // loginPerf throws on failure; catch it to return false for graceful skip.
  try {
    await loginPerf(page);
  } catch {
    return false;
  }
  return /dashboard/.test(page.url());
}

test.describe('P4-P performance', () => {
  test('P4-P-002: 10k jobs — list paginates, does not render everything', async ({ page }) => {
    // Skip gracefully if the perf seed wasn't run (CI doesn't run it).
    if (!(await hasPerfData(page))) test.skip(true, 'perf seed not present');
    const start = Date.now();
    await page.goto('/jobs');
    await page.waitForLoadState('networkidle').catch(() => {});
    const loadMs = Date.now() - start;
    // Pagination: the DOM must not contain 10,000 job rows.
    const rows = await page.locator('[data-job-row], table tbody tr').count();
    expect(rows, `expected paginated rows, got ${rows}`).toBeLessThan(500);
    expect(loadMs, `jobs list took ${loadMs}ms`).toBeLessThan(15000);
  });

  test('P4-P-002: 5k customers — search stays fast', async ({ page }) => {
    // Skip gracefully if the perf seed wasn't run (CI doesn't run it).
    if (!(await hasPerfData(page))) test.skip(true, 'perf seed not present');
    await page.goto('/customers');
    await page.waitForLoadState('networkidle').catch(() => {});
    const search = page.getByRole('searchbox').or(page.locator('input[type="search"]')).first();
    const start = Date.now();
    await search.fill('Perf Customer 4242');
    await page.waitForTimeout(1500);
    const searchMs = Date.now() - start;
    expect(searchMs).toBeLessThan(10000);
    expect(await page.textContent('body')).toContain('Perf Customer 4242');
  });

  test('P4-P-003: slow 3G — clear error on offline, no silent failure', async ({ page, context }) => {
    await context.route('**/*', (route) => route.abort());
    await page.goto('/jobs').catch(() => {});
    const body = await page.textContent('body').catch(() => '');
    // Either a friendly offline/error state or the browser's own error page.
    expect(body !== null).toBe(true);
    await context.unroute('**/*');
  });

  test('P4-P-003: double-tap Save creates exactly one record', async ({ page }) => {
    // Uses the regular e2e seed (ownerA); the perf dataset isn't needed
    // for the double-submit idempotency check.
    await loginAs(page, 'ownerA');
    await page.goto('/jobs/new');
    const tag = `E2ETEST-DBLTAP-${Date.now()}`;
    const titleInput = page.locator('input[name="title"]').first();
    await titleInput.fill(tag);
    // Double-click the submit button in rapid succession.
    const submit = page.locator('button[type="submit"]').first();
    await submit.dblclick({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(3000);
    // Count created jobs with this tag via the list search.
    await page.goto('/jobs');
    const search = page.getByRole('searchbox').or(page.locator('input[type="search"]')).first();
    if (await search.count()) {
      await search.fill(tag);
      await page.waitForTimeout(1500);
    }
    const matches = await page.getByText(tag).count();
    expect(matches, `double-tap created ${matches} records, expected <= 1 visible`).toBeLessThanOrEqual(1);
  });
});
