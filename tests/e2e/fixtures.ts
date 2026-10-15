/**
 * Prompt 4 E2E fixtures.
 *
 * Personas map to scripts/seed-staging.ts (all seeded passwords: SeedPass123!).
 * - Business A (Ontario): seed-{owner,admin,dispatcher,technician}@mapleleaf.example.ca
 * - Business B (Quebec):  seed-{owner,admin,dispatcher,technician}@stlaurent.example.ca
 * - Consumers:            seed-consumer{1,2,3}@example.ca  (consumer3 locale=fr)
 */
import { test as base, expect, type Page } from '@playwright/test';

export { expect };

export const SEED_PASSWORD = 'SeedPass123!';

export type Persona =
  | 'ownerA'
  | 'adminA'
  | 'dispatcherA'
  | 'technicianA'
  | 'ownerB'
  | 'adminB'
  | 'dispatcherB'
  | 'technicianB'
  | 'consumer1'
  | 'consumer2'
  | 'consumer3fr';

const CREDENTIALS: Record<Persona, { email: string; loginPath: string }> = {
  ownerA: { email: 'seed-owner@mapleleaf.example.ca', loginPath: '/login' },
  adminA: { email: 'seed-admin@mapleleaf.example.ca', loginPath: '/login' },
  dispatcherA: { email: 'seed-dispatcher@mapleleaf.example.ca', loginPath: '/login' },
  technicianA: { email: 'seed-technician@mapleleaf.example.ca', loginPath: '/login' },
  ownerB: { email: 'seed-owner@stlaurent.example.ca', loginPath: '/login' },
  adminB: { email: 'seed-admin@stlaurent.example.ca', loginPath: '/login' },
  dispatcherB: { email: 'seed-dispatcher@stlaurent.example.ca', loginPath: '/login' },
  technicianB: { email: 'seed-technician@stlaurent.example.ca', loginPath: '/login' },
  consumer1: { email: 'seed-consumer1@example.ca', loginPath: '/customer/login' },
  consumer2: { email: 'seed-consumer2@example.ca', loginPath: '/customer/login' },
  consumer3fr: { email: 'seed-consumer3@example.ca', loginPath: '/customer/login' },
};

/** Log a persona in via the UI. Business users land on /dashboard. */
export async function loginAs(page: Page, persona: Persona): Promise<void> {
  const { email, loginPath } = CREDENTIALS[persona];
  await page.goto(loginPath);
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', SEED_PASSWORD);
  await Promise.all([
    page.waitForURL(/\/(dashboard|customer)/, { timeout: 30_000 }).catch(() => {}),
    page.locator('button[type="submit"]').first().click(),
  ]);
}

export interface CapturedEmail {
  url: string;
  method: string;
  body: string;
}

/**
 * Intercept outbound Resend API calls so "email sent" assertions work without
 * a real provider. Returns the capture list; tests assert on it.
 */
export async function interceptEmail(page: Page): Promise<CapturedEmail[]> {
  const captured: CapturedEmail[] = [];
  await page.route('**/api.resend.com/**', async (route) => {
    const req = route.request();
    captured.push({ url: req.url(), method: req.method(), body: req.postData() ?? '' });
    await route.fulfill({ status: 200, body: JSON.stringify({ id: 'e2e-test-email-id' }) });
  });
  // Also catch any other mail provider host the app might use in future.
  await page.route('**/api.sendgrid.com/**', async (route) => {
    const req = route.request();
    captured.push({ url: req.url(), method: req.method(), body: req.postData() ?? '' });
    await route.fulfill({ status: 202, body: '{}' });
  });
  return captured;
}

/** Assert no English prose is visible (fr-CA mode). Allowlisted: proper nouns etc. */
const FR_ALLOWLIST = ['OK', 'EveryJob', 'Jobi', 'QATEST', 'E2ETEST', 'SMS', 'Wi‑Fi'];

export async function expectNoEnglishVisible(page: Page): Promise<void> {
  const text = await page.evaluate(() => document.body.innerText);
  // Heuristic: common English-only words that never appear in fr-CA copy.
  const suspects = [' the ', ' and ', ' with ', 'Your ', 'Welcome', 'Settings', 'Dashboard'];
  const hits = suspects.filter(
    (w) => text.includes(w) && !FR_ALLOWLIST.some((a) => w.includes(a)),
  );
  expect(hits, `English text visible in fr-CA mode: ${hits.join(', ')}`).toEqual([]);
}

type Fixtures = {
  authedPage: Page;
};

export const test = base.extend<Fixtures & { persona: Persona }>({
  persona: ['ownerA', { option: true }],
  authedPage: async ({ page, persona }, use) => {
    await loginAs(page, persona);
    await use(page);
  },
});
