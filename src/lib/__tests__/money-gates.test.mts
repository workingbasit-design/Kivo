/**
 * Money gates (2026-10-21): the dedicated money pages must enforce
 * SEE_PRICES server-side, not just hide their nav entries (R2 hid the
 * Money tab / dashboard aggregate for technicians, but a typed URL
 * still opened the pages and received the amounts).
 *
 * These are source-wiring tests in the repo's readFileSync style: for
 * every gated page they pin that (a) the page destructures `role` from
 * requireAuth, (b) it denies via canSeePrices(role), (c) the denial is
 * the page family's established style — redirect('/dashboard') for
 * every SEE_PRICES gate (the money/invoices/quotes/expenses pages, and
 * /reports + /reports/team since the 2026-10-21 final polish aligned
 * them with the family) — and (d) the gate sits BEFORE the first
 * prisma query, so a denied viewer receives no money data in the
 * response.
 *
 * Shared work views (jobs list, job detail, schedule) are deliberately
 * NOT page-gated — prices there are interleaved with a technician's own
 * work data; see the "Money gates audit" section of
 * ~/workspace/mobile-qa/full-flow-2026-10-21/fix-report.md.
 *
 * The "forbidden() surfaces as a real HTTP 403" describe below
 * pins the framework plumbing the one remaining forbidden() denial
 * relies on: the /reports F9 owner/admin check. Next 16's forbidden()
 * only throws its NEXT_HTTP_ERROR_FALLBACK;403 digest when
 * experimental.authInterrupts is enabled in next.config.ts — without
 * it, forbidden() throws a plain Error that the (app) error boundary
 * renders as a generic crash page in a 200 response (live-verified
 * 2026-10-21, check T2) — and the denial needs an (app)/forbidden.tsx
 * boundary to render.
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
  'reports/page.tsx',
  'reports/team/page.tsx',
] as const;

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

describe('money gates: forbidden() surfaces as a real HTTP 403, not the error boundary', () => {
  const config = readFileSync(new URL('../../../next.config.ts', import.meta.url), 'utf8');

  test('next.config.ts enables experimental.authInterrupts', () => {
    assert.match(
      config,
      /authInterrupts:\s*true/,
      'forbidden() throws a plain (non-403) error unless experimental.authInterrupts is enabled'
    );
  });

  test('(app)/forbidden.tsx exists as the branded 403 boundary', () => {
    const src = page('forbidden.tsx');
    assert.match(src, /export default async function AppForbidden/);
    // A clear access-denied message in both locales, not a crash page.
    assert.match(src, /You don’t have access to this page/);
    assert.match(src, /Accès refusé/);
    assert.doesNotMatch(src, /Something went wrong/);
  });
});

describe('money gate: /reports — SEE_PRICES redirects, the F9 check stays forbidden()', () => {
  const src = page('reports/page.tsx');

  test('the SEE_PRICES denial itself is the redirect, not forbidden()', () => {
    const gateAt = src.indexOf('if (!canSeePrices(role))');
    assert.ok(gateAt > -1, 'SEE_PRICES gate missing');
    const gateBlock = src.slice(gateAt, gateAt + 120);
    assert.match(gateBlock, /redirect\('\/dashboard'\)/);
    assert.doesNotMatch(gateBlock, /forbidden\(\)/);
  });

  test('the F9 owner/admin check still denies via forbidden()', () => {
    assert.match(
      src,
      /f9On && role !== 'OWNER' && role !== 'ADMIN'\) \{\s*forbidden\(\);/
    );
  });
});

describe('money gate: /reports/team — no forbidden() remains', () => {
  const src = page('reports/team/page.tsx');

  test('SEE_PRICES was the only gate, so forbidden() is gone entirely', () => {
    assert.doesNotMatch(src, /forbidden/);
  });
});
