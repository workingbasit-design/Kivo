/**
 * Unit tests for password-reset token helpers (src/lib/password-reset.ts).
 * Run: node --test src/lib/__tests__/password-reset.test.mts
 *
 * Pure functions only — no DB. The raw token is never persisted; only its
 * SHA-256 hash is stored.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  newResetToken,
  hashResetToken,
  isResetTokenUsable,
  RESET_TOKEN_TTL_MS,
} from '../password-reset.ts';

test('newResetToken produces unique 64-char hex tokens', () => {
  const a = newResetToken();
  const b = newResetToken();
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.notEqual(a, b);
});

test('hashResetToken is deterministic and one-way shaped', () => {
  const t = newResetToken();
  assert.equal(hashResetToken(t), hashResetToken(t));
  assert.match(hashResetToken(t), /^[0-9a-f]{64}$/);
  assert.notEqual(hashResetToken(t), hashResetToken(newResetToken()));
  // The hash must not leak the raw token.
  assert.ok(!hashResetToken(t).includes(t.slice(0, 8)));
});

test('TTL is one hour', () => {
  assert.equal(RESET_TOKEN_TTL_MS, 60 * 60 * 1000);
});

test('isResetTokenUsable: fresh token is usable', () => {
  const now = Date.now();
  assert.equal(
    isResetTokenUsable({ usedAt: null, expiresAt: new Date(now + 1000) }, now),
    true
  );
});

test('isResetTokenUsable: expired token is rejected', () => {
  const now = Date.now();
  assert.equal(
    isResetTokenUsable({ usedAt: null, expiresAt: new Date(now - 1000) }, now),
    false
  );
});

test('isResetTokenUsable: used token is rejected even before expiry', () => {
  const now = Date.now();
  assert.equal(
    isResetTokenUsable(
      { usedAt: new Date(now - 100), expiresAt: new Date(now + 3600_000) },
      now
    ),
    false
  );
});
