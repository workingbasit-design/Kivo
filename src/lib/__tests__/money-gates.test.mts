/**
 * Money gates (2026-10-21): the dedicated money pages must enforce
 * SEE_PRICES server-side, not just hide their nav entries (R2 hid the
 * Money tab / dashboard aggregate for technicians, but a typed URL
 * still opened the pages and received the amounts).
 *
 * These are source-wiring tests in the repo's readFileSync style: for
 * every gated page they pin that (a) the page destructures `role` from
 * requireAuth, (b) it denies via canSeePrices(role), (c) the denial is
 * the page family's established style — redirect('/dashboard') for the
 * money/invoices/quotes/expenses pages (the settings/team page
 * pattern), forbidden() for the reports pages (that page's own F9
 * pattern) — and (d) the gate sits BEFORE the first prisma query, so a
 * denied viewer receives no money data in the response.
 *
 * Shared work views (jobs list, job detail, schedule) are deliberately
 * NOT page-gated — prices there are interleaved with a technician's own
 * work data; see the "Money gates audit" section of
 * ~/workspace/mobile-qa/full-flow-2026-10-21/fix-report.md.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { readFileSync } from 'node:fs';

register('./register-loader.mjs', import.meta.url);
register('./auth-stub-loader.mjs', import.meta.url);

const { canSeePrices } = await import('../roles.ts');

const page = (rel: string) =>
  readFileSync(new URL(`../../app/(app)/${rel}`, import.meta.url), 'utf8');

const REDIRECT_GATED = [
  'money/page.tsx',
  'invoices/page.tsx',
  'invoices/[id]/page.tsx',
  'invoices/new/page.tsx',
  'quotes/page.tsx',
  'quotes/[id]/page.tsx',
  'expenses/page.tsx',
] as const;

const FORBIDDEN_GATED = ['reports/page.tsx', 'reports/team/page.tsx'] as const;

describe('money gates: the predicate the pages rely on', () => {
  test('only OWNER / ADMIN / DISPATCHER pass; TECHNICIAN fails closed', () => {
    assert.equal(canSeePrices('OWNER'), true);
    assert.equal(canSeePrices('ADMIN'), true);
    assert.equal(canSeePrices('DISPATCHER'), true);
    assert.equal(canSeePrices('TECHNICIAN'), false);
    assert.equal(canSeePrices(null), false);
    assert.equal(canSeePrices('MEMBER'), false);
  });
});

for (const rel of REDIRECT_GATED) {
  describe(`money gate: /${rel.replace(/\/page\.tsx$/, '')}`, () => {
    const src = page(rel);
    test('takes role from requireAuth and denies via canSeePrices(role)', () => {
      assert.match(src, /const \{[^}]*\brole\b[^}]*\} = await requireAuth\(\)/);
      assert.match(src, /if \(!canSeePrices\(role\)\)/);
    });
    test("denial is the page-family redirect to '/dashboard'", () => {
      assert.match(src, /redirect\('\/dashboard'\)/);
    });
    test('gate runs before the first prisma query (no data in a denied response)', () => {
      const gateAt = src.indexOf('canSeePrices(role)');
      const queryAt = src.indexOf('prisma.');
      assert.ok(gateAt > -1, 'gate missing');
      assert.ok(queryAt > -1, 'expected a prisma query to compare against');
      assert.ok(gateAt < queryAt, 'gate must precede the first prisma query');
    });
  });
}

for (const rel of FORBIDDEN_GATED) {
  describe(`money gate: /${rel.replace(/\/page\.tsx$/, '')}`, () => {
    const src = page(rel);
    test('takes role from requireAuth and denies via canSeePrices(role)', () => {
      assert.match(src, /const \{[^}]*\brole\b[^}]*\} = await requireAuth\(\)/);
      assert.match(src, /if \(!canSeePrices\(role\)\)/);
    });
    test('denial is forbidden() (the reports pages’ own F9 pattern)', () => {
      assert.match(src, /forbidden\(\)/);
    });
    test('gate runs before the first prisma query (no data in a denied response)', () => {
      const gateAt = src.indexOf('canSeePrices(role)');
      const queryAt = src.indexOf('prisma.');
      assert.ok(gateAt > -1, 'gate missing');
      assert.ok(queryAt > -1, 'expected a prisma query to compare against');
      assert.ok(gateAt < queryAt, 'gate must precede the first prisma query');
    });
  });
}
