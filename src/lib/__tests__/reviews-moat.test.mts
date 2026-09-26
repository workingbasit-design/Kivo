/**
 * Tests for the verified-review moat (src/lib/review-tokens.ts,
 * src/lib/review-eligibility.ts, src/lib/review-guards.ts,
 * src/app/actions/review-requests.ts, src/app/actions/reviews.ts).
 *
 * Pure-function tests run against the real modules. Server-action tests
 * run against an in-memory stub (reviews-moat-stub.mjs) wired by
 * reviews-moat-stub-loader.mjs, registered below — only this file's
 * subprocess is affected, no database is ever contacted.
 *
 * Run: node --test --import ./src/lib/__tests__/register-loader.mjs src/lib/__tests__/reviews-moat.test.mts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register('./reviews-moat-stub-loader.mjs', import.meta.url);

const {
  newReviewTokenValue,
  hashReviewToken,
  REVIEW_TOKEN_EXPIRY_DAYS,
  isReviewRequestActive,
} = await import('../review-tokens.ts');

const {
  REVIEW_ELIGIBLE_JOB_STATUSES,
  checkReviewEligibility,
  listEligibleReviewJobs,
} = await import('../review-eligibility.ts');

const {
  REVIEW_MIN_FILL_SECONDS,
  checkBotSignals,
  classifyLegacySource,
} = await import('../review-guards.ts');

const {
  createReviewRequest,
  revokeReviewRequest,
  submitTokenReview,
  getTokenReviewContext,
} = await import('../../app/actions/review-requests.ts');

const { createReview } = await import('../../app/actions/reviews.ts');

const { db, resetDb } = await import('./reviews-moat-stub.mjs');

const STALE_LINK_ERROR =
  'This review link is no longer valid. Ask your pro for a fresh one.';

// ---------------------------------------------------------------------------
// Token strength / hashing
// ---------------------------------------------------------------------------

test('newReviewTokenValue produces 256-bit tokens as 64-char hex, unique', () => {
  const seen = new Set();
  for (let i = 0; i < 100; i++) {
    const t = newReviewTokenValue();
    assert.match(t, /^[0-9a-f]{64}$/, 'token is 64 lowercase hex chars');
    assert.ok(!seen.has(t), 'token is unique');
    seen.add(t);
  }
});

test('hashReviewToken is deterministic; a forged token never matches', () => {
  const real = newReviewTokenValue();
  const forged = newReviewTokenValue();
  const h1 = hashReviewToken(real);
  assert.equal(h1, hashReviewToken(real), 'hash is deterministic');
  assert.match(h1, /^[0-9a-f]{64}$/, 'hash is SHA-256 shaped');
  // Attacker guesses a different token: neither the raw guess nor its hash
  // matches the stored hash.
  assert.notEqual(forged, real);
  assert.notEqual(hashReviewToken(forged), h1);
  assert.notEqual(forged, h1);
});

test('REVIEW_TOKEN_EXPIRY_DAYS is 30', () => {
  assert.equal(REVIEW_TOKEN_EXPIRY_DAYS, 30);
});

test('isReviewRequestActive: only PENDING + unexpired is active', () => {
  const future = new Date(Date.now() + 60_000);
  const past = new Date(Date.now() - 60_000);
  assert.equal(
    isReviewRequestActive({ status: 'PENDING', expiresAt: future }),
    true
  );
  assert.equal(
    isReviewRequestActive({ status: 'PENDING', expiresAt: past }),
    false
  );
  assert.equal(
    isReviewRequestActive({ status: 'USED', expiresAt: future }),
    false
  );
  assert.equal(
    isReviewRequestActive({ status: 'REVOKED', expiresAt: future }),
    false
  );
});

// ---------------------------------------------------------------------------
// Eligibility
// ---------------------------------------------------------------------------

test('only COMPLETED and PAID jobs are review-eligible', () => {
  assert.deepEqual([...REVIEW_ELIGIBLE_JOB_STATUSES].sort(), [
    'COMPLETED',
    'PAID',
  ]);
  assert.deepEqual(checkReviewEligibility({ status: 'COMPLETED' }, true), {
    ok: true,
  });
  assert.deepEqual(checkReviewEligibility({ status: 'PAID' }, true), {
    ok: true,
  });
});

test('checkReviewEligibility rejects incomplete jobs and unpaid customers', () => {
  assert.deepEqual(checkReviewEligibility(null, true), {
    ok: false,
    reason: 'job-not-found',
  });
  for (const status of ['SCHEDULED', 'IN_PROGRESS', 'CANCELLED', 'DRAFT']) {
    assert.deepEqual(checkReviewEligibility({ status }, true), {
      ok: false,
      reason: 'job-not-complete',
    });
  }
  assert.deepEqual(checkReviewEligibility({ status: 'COMPLETED' }, false), {
    ok: false,
    reason: 'no-paid-invoice',
  });
});

// ---------------------------------------------------------------------------
// Bot signals + source classification
// ---------------------------------------------------------------------------

test('REVIEW_MIN_FILL_SECONDS is 3', () => {
  assert.equal(REVIEW_MIN_FILL_SECONDS, 3);
});

test('checkBotSignals: honeypot filled => bot', () => {
  assert.deepEqual(
    checkBotSignals({ honeypot: 'buy cheap watches', renderedAtMs: Date.now() - 60_000 }),
    { ok: false, reason: 'honeypot' }
  );
});

test('checkBotSignals: submitted faster than 3s => bot', () => {
  assert.deepEqual(
    checkBotSignals({ honeypot: '', renderedAtMs: Date.now() - 500 }),
    { ok: false, reason: 'too-fast' }
  );
});

test('checkBotSignals: empty honeypot + slow human => ok', () => {
  assert.deepEqual(
    checkBotSignals({ honeypot: '   ', renderedAtMs: Date.now() - 30_000 }),
    { ok: true }
  );
});

test('classifyLegacySource preserves Verified/Google, maps the rest to Legacy', () => {
  assert.equal(classifyLegacySource('Verified'), 'Verified');
  assert.equal(classifyLegacySource('Google'), 'Google');
  for (const s of [
    'Direct',
    'WhatsApp',
    'Manual',
    '',
    'verified',
    'GOOGLE',
    null,
    undefined,
  ]) {
    assert.equal(classifyLegacySource(s), 'Legacy', `${String(s)} => Legacy`);
  }
});

// ---------------------------------------------------------------------------
// Server actions (in-memory stub)
// ---------------------------------------------------------------------------

function seedBusiness() {
  db.businesses.set('biz_1', { id: 'biz_1', name: 'Maple Pros' });
  db.customers.set('cust_1', {
    id: 'cust_1',
    name: 'Ava Chen',
    phone: '+1-416-555-0100',
    email: 'ava@example.com',
    address: '12 Secret Lane',
  });
}

function seedJob(status = 'COMPLETED') {
  db.jobs.set('job_1', {
    id: 'job_1',
    businessId: 'biz_1',
    status,
    customerId: 'cust_1',
    title: 'Furnace repair',
    date: new Date('2026-09-20T00:00:00Z'),
    customer: { id: 'cust_1', name: 'Ava Chen' },
  });
}

function seedPaidInvoice() {
  db.invoices.push({
    id: 'inv_1',
    businessId: 'biz_1',
    customerId: 'cust_1',
    status: 'PAID',
  });
}

function seedRequest(overrides = {}) {
  const token = newReviewTokenValue();
  const row = {
    id: `rr_${db.reviewRequests.size + 1}`,
    tokenHash: hashReviewToken(token),
    businessId: 'biz_1',
    jobId: 'job_1',
    customerId: 'cust_1',
    status: 'PENDING',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    usedAt: null,
    reviewId: null,
    ...overrides,
  };
  db.reviewRequests.set(row.id, row);
  return { token, row };
}

function tokenForm(token, overrides = {}) {
  const fd = new FormData();
  fd.set('token', token);
  fd.set('rating', '5');
  fd.set('comment', 'Great work, on time and tidy.');
  fd.set('honeypot', '');
  // Rendered 10s ago: comfortably past the 3s minimum fill time.
  fd.set('renderedAtMs', String(Date.now() - 10_000));
  for (const [k, v] of Object.entries(overrides)) fd.set(k, v);
  return fd;
}

test('submitTokenReview rejects a forged token and creates nothing', async () => {
  resetDb();
  seedBusiness();
  const res = await submitTokenReview({}, tokenForm(newReviewTokenValue()));
  assert.equal(res.ok, undefined);
  assert.equal(res.error, STALE_LINK_ERROR);
  assert.equal(db.reviews.length, 0);
});

test('submitTokenReview rejects expired / used / revoked tokens without saying which', async () => {
  resetDb();
  seedBusiness();
  seedJob();
  seedPaidInvoice();

  const expired = seedRequest({
    expiresAt: new Date(Date.now() - 1000),
  });
  const used = seedRequest({ status: 'USED' });
  const revoked = seedRequest({ status: 'REVOKED' });

  for (const { token } of [expired, used, revoked]) {
    const r = await submitTokenReview({}, tokenForm(token));
    assert.equal(r.error, STALE_LINK_ERROR);
  }
  assert.equal(db.reviews.length, 0);
});

test('submitTokenReview rejects bot signals (honeypot, instant submit)', async () => {
  resetDb();
  seedBusiness();
  seedJob();
  seedPaidInvoice();
  const { token } = seedRequest();

  const honey = await submitTokenReview(
    {},
    tokenForm(token, { honeypot: 'spam-bot' })
  );
  assert.match(honey.error ?? '', /Something went wrong/);

  const fast = await submitTokenReview(
    {},
    tokenForm(token, { renderedAtMs: String(Date.now() - 200) })
  );
  assert.match(fast.error ?? '', /Something went wrong/);
  assert.equal(db.reviews.length, 0);
});

test('submitTokenReview happy path: Verified review linked to the job; token is single-use', async () => {
  resetDb();
  seedBusiness();
  seedJob('COMPLETED');
  seedPaidInvoice();
  const { token, row } = seedRequest();

  const res = await submitTokenReview({}, tokenForm(token));
  assert.equal(res.ok, true);
  assert.equal(db.reviews.length, 1);
  const review = db.reviews[0];
  assert.equal(review.source, 'Verified');
  assert.equal(review.jobId, 'job_1');
  assert.equal(review.customerId, 'cust_1');
  assert.equal(review.businessId, 'biz_1');
  assert.equal(review.rating, 5);

  // Token consumed: second submission fails with the same vague error.
  const again = await submitTokenReview({}, tokenForm(token));
  assert.equal(again.error, STALE_LINK_ERROR);
  assert.equal(db.reviews.length, 1);

  // Request row marked USED and linked to the review.
  const stored = db.reviewRequests.get(row.id);
  assert.equal(stored.status, 'USED');
  assert.equal(stored.reviewId, review.id);
});

test('createReviewRequest returns a raw token once; only the hash is stored', async () => {
  resetDb();
  seedBusiness();
  seedJob('COMPLETED');
  seedPaidInvoice();

  const res = await createReviewRequest('job_1');
  assert.equal(res.ok, true);
  assert.ok(res.token, 'raw token returned once');
  const stored = [...db.reviewRequests.values()].find(
    (r) => r.tokenHash === hashReviewToken(res.token)
  );
  assert.ok(stored, 'a row exists whose hash matches the raw token');
  assert.ok(!('token' in stored), 'raw token is not persisted');
  assert.notEqual(stored.tokenHash, res.token);
});

test('createReviewRequest revokes the older pending link for the same job', async () => {
  resetDb();
  seedBusiness();
  seedJob('COMPLETED');
  seedPaidInvoice();
  const first = await createReviewRequest('job_1');
  assert.equal(first.ok, true);
  const second = await createReviewRequest('job_1');
  assert.equal(second.ok, true);

  const rows = [...db.reviewRequests.values()];
  assert.equal(rows.length, 2);
  const active = rows.filter((r) => r.status === 'PENDING');
  assert.equal(active.length, 1, 'exactly one active link per job');
  assert.equal(
    active[0].tokenHash,
    hashReviewToken(second.token),
    'the newest link is the active one'
  );
});

test('createReviewRequest refuses a completed job with no paid invoice', async () => {
  resetDb();
  seedBusiness();
  seedJob('COMPLETED');
  // No paid invoice seeded.

  const res = await createReviewRequest('job_1');
  assert.equal(res.ok, undefined);
  assert.match(res.error ?? '', /completed job with a paid invoice/);
  assert.equal(db.reviewRequests.size, 0);
});

test('createReviewRequest refuses an ineligible job and a foreign job', async () => {
  resetDb();
  seedBusiness();
  seedJob('IN_PROGRESS');
  seedPaidInvoice();

  const res = await createReviewRequest('job_1');
  assert.equal(res.ok, undefined);
  assert.match(res.error ?? '', /completed job with a paid invoice/);
  assert.equal(db.reviewRequests.size, 0);

  // A job from another business is invisible (tenant isolation).
  db.jobs.set('job_x', {
    id: 'job_x',
    businessId: 'biz_other',
    status: 'COMPLETED',
    customerId: 'cust_1',
    title: 'Other job',
    date: new Date(),
  });
  const foreign = await createReviewRequest('job_x');
  assert.match(foreign.error ?? '', /completed job with a paid invoice/);
  assert.equal(db.reviewRequests.size, 0);
});

test('revokeReviewRequest revokes a pending link; the token then fails', async () => {
  resetDb();
  seedBusiness();
  seedJob('COMPLETED');
  seedPaidInvoice();
  const { token, row } = seedRequest();

  const res = await revokeReviewRequest(row.id);
  assert.equal(res.ok, true);

  const submit = await submitTokenReview({}, tokenForm(token));
  assert.equal(submit.error, STALE_LINK_ERROR);
  assert.equal(db.reviews.length, 0);
});

test('revokeReviewRequest cannot touch another business’s link', async () => {
  resetDb();
  seedBusiness();
  const { row } = seedRequest({ businessId: 'biz_other' });
  const res = await revokeReviewRequest(row.id);
  assert.match(res.error ?? '', /not found/);
  assert.equal(db.reviewRequests.get(row.id).status, 'PENDING');
});

test('getTokenReviewContext exposes only public-safe fields', async () => {
  resetDb();
  seedBusiness();
  seedJob('COMPLETED');
  seedPaidInvoice();
  const { token } = seedRequest();

  const ctx = await getTokenReviewContext(token);
  assert.ok(ctx, 'context resolves for a valid token');
  assert.equal(ctx.businessName, 'Maple Pros');
  assert.equal(ctx.customerName, 'Ava Chen');
  assert.equal(ctx.jobTitle, 'Furnace repair');
  assert.ok(ctx.jobDate instanceof Date);
  const leaked = JSON.stringify(ctx);
  assert.ok(!leaked.includes('416-555-0100'), 'no phone leaks');
  assert.ok(!leaked.includes('ava@example.com'), 'no email leaks');
  assert.ok(!leaked.includes('Secret Lane'), 'no address leaks');

  assert.equal(await getTokenReviewContext(newReviewTokenValue()), null);
  assert.equal(await getTokenReviewContext(''), null);
});

test('listEligibleReviewJobs returns only completed jobs with a paid invoice', async () => {
  resetDb();
  seedBusiness();
  seedJob('COMPLETED');
  seedPaidInvoice();
  db.jobs.set('job_2', {
    id: 'job_2',
    businessId: 'biz_1',
    status: 'SCHEDULED',
    customerId: 'cust_1',
    title: 'Future job',
    date: new Date(),
  });
  db.jobs.set('job_3', {
    id: 'job_3',
    businessId: 'biz_1',
    status: 'COMPLETED',
    customerId: 'cust_unpaid',
    title: 'Unpaid job',
    date: new Date(),
  });
  db.jobs.set('job_4', {
    id: 'job_4',
    businessId: 'biz_other',
    status: 'COMPLETED',
    customerId: 'cust_1',
    title: 'Foreign job',
    date: new Date(),
  });

  const jobs = await listEligibleReviewJobs(
    'biz_1',
    new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)
  );
  assert.deepEqual(
    jobs.map((j) => j.id),
    ['job_1']
  );
});

test('createReview (owner) requires an eligible job; derives customer server-side', async () => {
  resetDb();
  seedBusiness();
  seedJob('SCHEDULED');
  seedPaidInvoice();

  const bad = new FormData();
  bad.set('rating', '5');
  bad.set('comment', 'Nice.');
  bad.set('jobId', 'job_1');
  const denied = await createReview({}, bad);
  assert.match(denied.error ?? '', /completed job with a paid invoice/);
  assert.equal(db.reviews.length, 0);

  // Now complete the job: owner review succeeds, customer derived from job.
  db.jobs.get('job_1').status = 'COMPLETED';
  const good = new FormData();
  good.set('rating', '4');
  good.set('comment', 'Customer called to say thanks.');
  good.set('jobId', 'job_1');
  const okRes = await createReview({}, good);
  assert.equal(okRes.ok, true);
  assert.equal(db.reviews.length, 1);
  assert.equal(db.reviews[0].source, 'Verified');
  assert.equal(db.reviews[0].jobId, 'job_1');
  assert.equal(db.reviews[0].customerId, 'cust_1');
});

test('createReview (owner) cannot use another business’s job', async () => {
  resetDb();
  seedBusiness();
  db.jobs.set('job_x', {
    id: 'job_x',
    businessId: 'biz_other',
    status: 'COMPLETED',
    customerId: 'cust_1',
    title: 'Other job',
    date: new Date(),
  });
  db.invoices.push({
    id: 'inv_x',
    businessId: 'biz_other',
    customerId: 'cust_1',
    status: 'PAID',
  });

  const fd = new FormData();
  fd.set('rating', '5');
  fd.set('comment', '');
  fd.set('jobId', 'job_x');
  const res = await createReview({}, fd);
  assert.match(res.error ?? '', /completed job with a paid invoice/);
  assert.equal(db.reviews.length, 0);
});
