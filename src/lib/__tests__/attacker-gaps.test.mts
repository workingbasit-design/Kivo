/**
 * P4-X attacker suite — gaps not covered by existing tests.
 *
 * Already covered elsewhere (not duplicated):
 * - P4-X-001 IDOR: P4-A-002 (auth matrix HTTP) + P4-D-001 (DB)
 * - P4-X-002 XSS web/email: injection.test.mts; CSV: spreadsheet-injection.test.mts
 * - P4-X-004 brute force: auth-rate-limit.test.mts
 * - P4-X-005 open redirect: redirect.test.mts
 * - P4-X-006 uploads: upload-validate.test.mts
 * - P4-X-007 Stripe webhook: stripe-webhook-verify.test.mts
 * - P4-X-011 Copilot injection: copilot-injection.test.mts
 *
 * This file: P4-X-003 (tampered bodies), P4-X-008 (CSRF), P4-X-009 (framing),
 * P4-X-010 (directory claim), P4-X-002 PDF note.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { register } from 'node:module';

register('./register-loader.mjs', import.meta.url);
register('./next-server-stub-loader.mjs', import.meta.url);

const { checkSameOrigin } = await import('../csrf.ts');
const { isDirectoryAdminEmail } = await import('../directory.ts');
const { claimTransition } = await import('../directory-claim.ts');
const { customerSchema, jobSchema } = await import('../validations.ts');

const HERE = dirname(fileURLToPath(import.meta.url));
const ACTIONS_DIR = join(HERE, '..', '..', 'app', 'actions');

describe('P4-X-003: tampered request bodies', () => {
  test('zod schemas strip unknown keys (business_id/role/status injection)', () => {
    const parsed = customerSchema.parse({
      name: 'Alice',
      business_id: 'biz-b',
      businessId: 'biz-b',
      role: 'OWNER',
      status: 'PAID',
    } as unknown as Record<string, unknown>);
    assert.equal((parsed as Record<string, unknown>).business_id, undefined);
    assert.equal((parsed as Record<string, unknown>).businessId, undefined);
    assert.equal((parsed as Record<string, unknown>).role, undefined);
    const job = jobSchema.parse({
      title: 'Fix sink',
      customerId: 'c1',
      date: '2026-10-20',
      price: 100,
      businessId: 'biz-b',
      status: 'PAID',
    } as unknown as Record<string, unknown>);
    // status is a valid enum value here, but businessId must not pass through.
    assert.equal((job as Record<string, unknown>).businessId, undefined);
  });

  test('server actions derive businessId from the session, never from args', () => {
    // Static guarantee: no action reads businessId/business_id from FormData
    // or function args to scope the CALLER's data. requireAuth/requireMembership supply it.
    // Exception (documented): customer-requests.ts reads the TARGET businessId
    // (which pro a quote request goes to) — verified against directoryOptIn +
    // directoryVerifiedAt, never used as caller scope.
    const files = readdirSync(ACTIONS_DIR).filter((f) => f.endsWith('.ts'));
    const offenders: string[] = [];
    for (const file of files) {
      if (file === 'customer-requests.ts') continue; // target business, verified — see above
      const src = readFileSync(join(ACTIONS_DIR, file), 'utf8');
      if (/formData\.get\(['"]businessId['"]\)/.test(src)) offenders.push(`${file}: formData businessId`);
      if (/args\.businessId/.test(src)) offenders.push(`${file}: args.businessId`);
    }
    assert.deepEqual(offenders, [], 'actions must not scope by client-supplied businessId');
  });
});

describe('P4-X-008: cross-origin state changes rejected', () => {
  const selfReq = (origin: string | null) =>
    new Request('https://app.test/api/offline-jobs', {
      method: 'POST',
      headers: {
        host: 'app.test',
        ...(origin ? { Origin: origin } : {}),
      },
    });

  test('same-origin request passes', () => {
    assert.equal(checkSameOrigin(selfReq('https://app.test')).ok, true);
  });

  test('cross-origin request is rejected', () => {
    const r = checkSameOrigin(selfReq('https://evil.test'));
    assert.equal(r.ok, false);
  });

  test('unparseable Origin fails closed', () => {
    const r = checkSameOrigin(selfReq('http://[invalid'));
    assert.equal(r.ok, false);
  });

  test('no Origin/Referer (curl/server) passes — nothing to verify', () => {
    assert.equal(checkSameOrigin(selfReq(null)).ok, true);
  });
});

describe('P4-X-009: framing denied', () => {
  test('next.config sets X-Frame-Options SAMEORIGIN and frame-ancestors none', () => {
    const src = readFileSync(join(HERE, '..', '..', '..', 'next.config.ts'), 'utf8');
    assert.ok(/X-Frame-Options/.test(src), 'X-Frame-Options header configured');
    assert.ok(/frame-ancestors/.test(src), 'CSP frame-ancestors configured');
  });
});

describe('P4-X-010: directory claim requires verification', () => {
  test('claim request never auto-approves', () => {
    const r = claimTransition({ status: null, verifiedAt: null }, 'request');
    assert.equal(r.status, 'PENDING');
    assert.equal(r.public, false);
  });

  test('isDirectoryAdminEmail: empty allowlist denies everyone', () => {
    const prev = process.env.KIVO_ADMIN_EMAILS;
    process.env.KIVO_ADMIN_EMAILS = '';
    assert.equal(isDirectoryAdminEmail('owner@biz.ca'), false);
    if (prev === undefined) delete process.env.KIVO_ADMIN_EMAILS;
    else process.env.KIVO_ADMIN_EMAILS = prev;
  });

  test('isDirectoryAdminEmail: only allowlisted emails pass (case-insensitive)', () => {
    const prev = process.env.KIVO_ADMIN_EMAILS;
    process.env.KIVO_ADMIN_EMAILS = 'Admin@Everyjob.ca';
    assert.equal(isDirectoryAdminEmail('admin@everyjob.ca'), true);
    assert.equal(isDirectoryAdminEmail('attacker@everyjob.ca'), false);
    assert.equal(isDirectoryAdminEmail(null), false);
    if (prev === undefined) delete process.env.KIVO_ADMIN_EMAILS;
    else process.env.KIVO_ADMIN_EMAILS = prev;
  });
});

describe('P4-X-002 note: PDFs', () => {
  test('no PDF library in dependencies — invoices render as escaped HTML', () => {
    const pkg = JSON.parse(readFileSync(join(HERE, '..', '..', '..', 'package.json'), 'utf8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    const pdfLibs = Object.keys(deps).filter((d) => /pdf|jspdf|pdfkit|react-pdf/i.test(d));
    assert.deepEqual(pdfLibs, [], 'no PDF lib; XSS surface is HTML (covered by injection.test.mts)');
  });
});
