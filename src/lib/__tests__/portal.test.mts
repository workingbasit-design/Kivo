/**
 * Unit tests for the customer portal token primitives (src/lib/portal.ts).
 * Only the pure functions are tested here — DB round-trips are covered by
 * the same tenant-scoping discipline as ShareToken (every query carries
 * businessId + customerId).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  newPortalTokenValue,
  hashPortalToken,
  isPortalTokenActive,
} from '../portal.ts';

test('token values are unique 256-bit hex', () => {
  const a = newPortalTokenValue();
  const b = newPortalTokenValue();
  assert.notEqual(a, b);
  assert.match(a, /^[0-9a-f]{64}$/);
});

test('hash is deterministic, one-way, and differs from the raw token', () => {
  const t = newPortalTokenValue();
  const h1 = hashPortalToken(t);
  const h2 = hashPortalToken(t);
  assert.equal(h1, h2);
  assert.notEqual(h1, t);
  assert.match(h1, /^[0-9a-f]{64}$/);
  // A different token hashes differently — no collisions in practice.
  assert.notEqual(hashPortalToken(newPortalTokenValue()), h1);
});

test('isPortalTokenActive honors revoke + expiry', () => {
  const live = { revokedAt: null, expiresAt: null };
  assert.equal(isPortalTokenActive(live), true);
  assert.equal(
    isPortalTokenActive({ revokedAt: new Date(), expiresAt: null }),
    false
  );
  assert.equal(
    isPortalTokenActive({
      revokedAt: null,
      expiresAt: new Date(Date.now() - 1000),
    }),
    false
  );
  assert.equal(
    isPortalTokenActive({
      revokedAt: null,
      expiresAt: new Date(Date.now() + 3600_1000),
    }),
    true
  );
});
