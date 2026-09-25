/**
 * Unit tests for tenant API key helpers (src/lib/apiKeys.ts).
 * Pure helpers only — no DB, no network.
 * Run: node --test --import ./src/lib/__tests__/register-loader.mjs src/lib/__tests__/apikeys.test.mts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  API_KEY_PREFIX,
  generateApiKey,
  hashApiKey,
  parseApiScopes,
  hasScope,
  type VerifiedApiKey,
} from '@/lib/apiKeys.ts';

test('generateApiKey produces a unique, well-formed key with matching hash and prefix', () => {
  const a = generateApiKey();
  const b = generateApiKey();
  assert.ok(a.key.startsWith(API_KEY_PREFIX), 'key has ejk_live_ prefix');
  assert.ok(a.key.length > 50, 'key has enough entropy');
  assert.notEqual(a.key, b.key, 'keys are unique');
  assert.equal(a.keyHash, hashApiKey(a.key), 'stored hash matches the key');
  assert.equal(a.keyPrefix, a.key.slice(0, 8), 'prefix is the first 8 chars');
});

test('hashApiKey is deterministic and SHA-256 shaped', () => {
  const h1 = hashApiKey('ejk_live_test');
  const h2 = hashApiKey('ejk_live_test');
  assert.equal(h1, h2);
  assert.match(h1, /^[0-9a-f]{64}$/);
  assert.notEqual(hashApiKey('ejk_live_test'), hashApiKey('ejk_live_test2'));
});

test('parseApiScopes defaults to read-only and normalizes input', () => {
  assert.deepEqual(parseApiScopes('read'), ['read']);
  assert.deepEqual(parseApiScopes('write'), ['write']);
  assert.deepEqual(parseApiScopes('read,write'), ['read', 'write']);
  assert.deepEqual(parseApiScopes(''), ['read']);
  assert.deepEqual(parseApiScopes('bogus'), ['read']);
  assert.deepEqual(parseApiScopes(' READ , Write '), ['read', 'write']);
  assert.deepEqual(parseApiScopes('read,read'), ['read']);
});

test('hasScope: write implies read; read never implies write', () => {
  const read: VerifiedApiKey = { keyId: 'k1', businessId: 'b1', scopes: ['read'] };
  const write: VerifiedApiKey = { keyId: 'k2', businessId: 'b1', scopes: ['write'] };
  assert.equal(hasScope(read, 'read'), true);
  assert.equal(hasScope(read, 'write'), false);
  assert.equal(hasScope(write, 'read'), true);
  assert.equal(hasScope(write, 'write'), true);
});
