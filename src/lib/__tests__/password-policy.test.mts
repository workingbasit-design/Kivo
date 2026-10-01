/**
 * Unit tests for src/lib/password-policy.ts — the shared password-length cap.
 * Pure helpers only — no DB, no network.
 * Run: node --test --import ./src/lib/__tests__/register-loader.mjs src/lib/__tests__/password-policy.test.mts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  isPasswordLengthAcceptable,
  isPasswordTooLong,
} from '@/lib/password-policy.ts';

test('the DoS cap is 128 chars (PBKDF2-SHA512 100k iterations is the cost driver)', () => {
  assert.equal(MAX_PASSWORD_LENGTH, 128);
  assert.equal(MIN_PASSWORD_LENGTH, 8);
});

test('isPasswordTooLong: boundary at exactly 128 chars', () => {
  assert.equal(isPasswordTooLong('a'.repeat(127)), false);
  assert.equal(isPasswordTooLong('a'.repeat(128)), false);
  assert.equal(isPasswordTooLong('a'.repeat(129)), true);
  assert.equal(isPasswordTooLong('a'.repeat(10000)), true, '10k-char attack input is rejected');
});

test('isPasswordLengthAcceptable: enforces both min and max', () => {
  assert.equal(isPasswordLengthAcceptable('short'), false, 'under 8 chars rejected');
  assert.equal(isPasswordLengthAcceptable('longenough1'), true);
  assert.equal(isPasswordLengthAcceptable('a'.repeat(128)), true);
  assert.equal(isPasswordLengthAcceptable('a'.repeat(129)), false, 'over 128 chars rejected');
});
