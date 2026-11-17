/**
 * P1.0 (audit slice A §1.4): the three risky unsafeUnscoped sites.
 *
 * These are static regression tests — the paths need a live guarded DB to
 * execute (the stub-based moat tests have no tenant guard, so they cannot
 * catch a TenantScopeError), but the defect in each case is visible in the
 * source shape: a no-op exemption over a guarded transaction, a
 * businessId-less where on a tenant model, or an upsert keyed only by an
 * endpoint. Each test pins the fixed shape so the defect cannot regress
 * silently. Stage 2 (local scratch DB) live-tests the review submit and
 * the error-alerts cron end to end.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');

function src(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

describe('review-requests token submit (S-A1)', () => {
  const code = src('app/actions/review-requests.ts');
  it('does not wrap guarded-transaction queries in a no-op unsafeUnscoped', () => {
    assert.ok(!code.includes('review-requests:recheckToken'));
    assert.ok(!code.includes('review-requests:markTokenUsed'));
    assert.ok(
      !code.includes('tx.reviewRequest.findUnique'),
      'findUnique with {tokenHash, businessId} is not a unique key',
    );
    assert.ok(!code.includes('tx.reviewRequest.update('));
  });

  it('re-checks the token scoped by the resolved businessId', () => {
    assert.ok(code.includes('tx.reviewRequest.findFirst({'));
    assert.ok(code.includes('where: { tokenHash, businessId: req.businessId }'));
  });

  it('marks the token used with updateMany + a count check (atomic single-use)', () => {
    assert.ok(code.includes('tx.reviewRequest.updateMany({'));
    assert.ok(code.includes("status: 'PENDING'"));
    assert.ok(code.includes('if (marked.count !== 1) throw new Error(\'STALE_TOKEN\')'));
  });
});

describe('error-alerts cron (S-A2)', () => {
  const code = src('app/api/cron/error-alerts/route.ts');
  it('scopes business alerts by businessId on the guarded client', () => {
    assert.ok(
      code.includes('where: { key: alert.key, resolvedAt: null, businessId: alert.businessId }'),
    );
    assert.ok(
      code.includes('where: { role: \'OWNER\', status: \'ACTIVE\', businessId: alert.businessId }'),
    );
  });

  it('the businessId-less dedup read exists exactly once, inside the named unscoped block', () => {
    // The global-alert dedup legitimately has no businessId (global alerts
    // have none to scope by); it must live inside the explicitly named
    // exemption, never as a bare guarded query.
    const bare = 'where: { key: alert.key, resolvedAt: null },';
    const first = code.indexOf(bare);
    const last = code.lastIndexOf(bare);
    assert.ok(first !== -1, 'global dedup read must exist');
    assert.equal(first, last, 'dedup read must appear exactly once');
    const opAt = code.indexOf('error-alerts:global-alert-dedup');
    assert.ok(opAt !== -1 && opAt < first, 'dedup read must sit inside the named exemption');
    // The old owner-enumeration spread left the global path unscoped with
    // no marker; the global path is now an explicitly named exemption.
    assert.ok(!code.includes('...(alert.businessId ? { businessId: alert.businessId } : {})'));
    assert.ok(code.includes('error-alerts:global-alert-owners'));
  });
});

describe('push subscribe ownership check (S-A3)', () => {
  const code = src('app/api/push/subscribe/route.ts');
  it('checks the endpoint owner before the upsert and refuses foreign rows', () => {
    assert.ok(code.includes('push:subscribe:checkOwner'));
    assert.ok(code.includes('db.pushSubscription.findFirst({'));
    assert.ok(code.includes('if (existing && existing.businessId !== businessId)'));
    assert.ok(code.includes("status: 403"));
  });

  it('still upserts only after the ownership check', () => {
    const checkAt = code.indexOf('push:subscribe:checkOwner');
    const upsertAt = code.indexOf('push:subscribe:upsert');
    assert.ok(checkAt !== -1 && upsertAt !== -1 && checkAt < upsertAt);
  });
});
