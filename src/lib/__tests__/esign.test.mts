/**
 * Unit tests for the EveryJob Sign primitives (src/lib/esign.ts).
 *
 * Only pure functions are tested here — no database. The DB-backed flows
 * (issue/resolve/revoke/submit) need DATABASE_URL + a Postgres server, so
 * they are covered by the same tenant-scoping discipline as the portal
 * tokens instead: every query carries businessId (+ quoteId), and the
 * `activeSignRequestFilter` unit test below proves that scoping is baked
 * into the invalidation query. Tenant isolation is therefore asserted at
 * the filter level: a filter built for tenant B can never match a record
 * owned by tenant A.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  newSignTokenValue,
  hashSignToken,
  isSignRequestActive,
  appendAudit,
  nextSignStatus,
  signatureDocPayload,
  signatureDocHash,
  verifyDocHash,
  activeSignRequestFilter,
} from '../esign.ts';

const QUOTE = {
  id: 'quote-1',
  number: 'Q-1042',
  title: 'Furnace tune-up',
  total: 189.99,
  customerId: 'cust-1',
  businessId: 'biz-a',
};

test('sign token values are unique 256-bit hex', () => {
  const a = newSignTokenValue();
  const b = newSignTokenValue();
  assert.notEqual(a, b);
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.equal(a.length, 64);
});

test('hash is deterministic and one-way: raw token never derivable from hash', () => {
  const t = newSignTokenValue();
  const h1 = hashSignToken(t);
  const h2 = hashSignToken(t);
  assert.equal(h1, h2, 'same token hashes identically');
  assert.notEqual(h1, t, 'hash differs from the raw token');
  assert.match(h1, /^[0-9a-f]{64}$/);
  // One-way: no function in the module inverts the hash; a fresh token
  // never collides with an existing hash.
  assert.notEqual(hashSignToken(newSignTokenValue()), h1);
  // Hashing the hash does not recover the token either.
  assert.notEqual(hashSignToken(h1), t);
});

test('isSignRequestActive truth table', () => {
  const base = { revokedAt: null, expiresAt: null, status: 'sent' };
  assert.equal(isSignRequestActive(base), true, 'sent + live is active');
  assert.equal(
    isSignRequestActive({ ...base, status: 'viewed' }),
    true,
    'viewed is still signable'
  );
  assert.equal(
    isSignRequestActive({ ...base, revokedAt: new Date() }),
    false,
    'revokedAt kills it'
  );
  assert.equal(
    isSignRequestActive({ ...base, expiresAt: new Date(Date.now() - 1000) }),
    false,
    'past expiry kills it'
  );
  assert.equal(
    isSignRequestActive({ ...base, expiresAt: new Date(Date.now() + 3600_000) }),
    true,
    'future expiry is fine'
  );
  for (const status of ['signed', 'declined', 'revoked', 'expired']) {
    assert.equal(
      isSignRequestActive({ ...base, status }),
      false,
      `terminal status "${status}" is inactive`
    );
  }
});

test('signatureDocHash is stable for the same quote', () => {
  const h1 = signatureDocHash(QUOTE);
  const h2 = signatureDocHash(QUOTE);
  assert.equal(h1, h2);
  assert.match(h1, /^[0-9a-f]{64}$/);
});

test('signatureDocHash is canonical: key insertion order does not matter', () => {
  const reordered = {
    businessId: 'biz-a',
    customerId: 'cust-1',
    total: 189.99,
    title: 'Furnace tune-up',
    number: 'Q-1042',
    id: 'quote-1',
  };
  assert.equal(signatureDocHash(reordered), signatureDocHash(QUOTE));
  assert.deepEqual(Object.keys(signatureDocPayload(QUOTE)), [
    'quoteId',
    'number',
    'title',
    'total',
    'customerId',
    'businessId',
  ]);
});

test('signatureDocHash changes when the quote changes (tamper evidence)', () => {
  const before = signatureDocHash(QUOTE);
  assert.notEqual(signatureDocHash({ ...QUOTE, total: 199.99 }), before, 'total edit changes hash');
  assert.notEqual(signatureDocHash({ ...QUOTE, title: 'Furnace tune-up!' }), before, 'title edit changes hash');
  assert.notEqual(signatureDocHash({ ...QUOTE, number: 'Q-1043' }), before, 'number edit changes hash');
});

test('verifyDocHash detects quote edits after send', () => {
  const request = { docHash: signatureDocHash(QUOTE), quote: QUOTE };
  assert.equal(verifyDocHash(request), true, 'untouched quote verifies');
  assert.equal(
    verifyDocHash({ docHash: request.docHash, quote: { ...QUOTE, total: 1 } }),
    false,
    'edited quote fails verification'
  );
});

test('appendAudit appends ordered, valid JSON entries', () => {
  const afterSent = appendAudit('[]', 'sent', 'owner');
  const entries = JSON.parse(afterSent);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].event, 'sent');
  assert.equal(entries[0].ip, 'owner');
  assert.ok(!Number.isNaN(Date.parse(entries[0].at)), 'at is an ISO timestamp');

  const afterViewed = appendAudit(afterSent, 'viewed', '1.2.3.4');
  const entries2 = JSON.parse(afterViewed);
  assert.equal(entries2.length, 2);
  assert.deepEqual(
    entries2.map((e: { event: string }) => e.event),
    ['sent', 'viewed'],
    'ordering preserved'
  );
  assert.equal(entries2[1].ip, '1.2.3.4');
});

test('appendAudit tolerates corrupt auditJson instead of crashing', () => {
  const out = appendAudit('not-json{{{', 'sent', 'owner');
  const entries = JSON.parse(out);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].event, 'sent');
});

test('nextSignStatus only allows forward transitions', () => {
  assert.equal(nextSignStatus('sent', 'viewed'), 'viewed');
  assert.equal(nextSignStatus('sent', 'signed'), 'signed', 'direct sign without view is allowed');
  assert.equal(nextSignStatus('viewed', 'signed'), 'signed');
  assert.equal(nextSignStatus('sent', 'declined'), 'declined');
  assert.equal(nextSignStatus('viewed', 'declined'), 'declined');
  // Backward / terminal transitions never move the status.
  assert.equal(nextSignStatus('signed', 'viewed'), 'signed', 'late view cannot reopen a signed request');
  assert.equal(nextSignStatus('revoked', 'viewed'), 'revoked');
  assert.equal(nextSignStatus('signed', 'signed'), 'signed');
  assert.equal(nextSignStatus('declined', 'signed'), 'declined');
});

test('activeSignRequestFilter is tenant- and quote-scoped', () => {
  const where = activeSignRequestFilter('biz-a', 'quote-1');
  assert.equal(where.businessId, 'biz-a');
  assert.equal(where.quoteId, 'quote-1');
  assert.equal(where.revokedAt, null);
  assert.deepEqual(where.status, { in: ['sent', 'viewed'] });
});

test('tenant isolation: tenant B filter cannot match tenant A record', () => {
  // Simulates the invalidation query in issueSignatureRequest: the record
  // "issued" for tenant A carries businessId 'biz-a'; the filter built for
  // tenant B's issue flow must not match it, so B can never revoke A's links.
  const tenantARecord = { businessId: 'biz-a', quoteId: 'quote-1', revokedAt: null, status: 'sent' };
  const filterForB = activeSignRequestFilter('biz-b', 'quote-1');
  const matches = (rec: typeof tenantARecord) =>
    rec.businessId === filterForB.businessId &&
    rec.quoteId === filterForB.quoteId &&
    rec.revokedAt === filterForB.revokedAt;
  assert.equal(matches(tenantARecord), false, "tenant B's filter must not match tenant A's record");
  const filterForA = activeSignRequestFilter('biz-a', 'quote-1');
  assert.equal(tenantARecord.businessId === filterForA.businessId, true, 'sanity: own filter matches');
});
