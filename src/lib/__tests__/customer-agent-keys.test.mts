/**
 * Tests for src/lib/customer-agent-keys.ts — the "Connect your AI assistant"
 * keys customers paste into their AI assistant.
 *
 * Security properties under test:
 * - Only the SHA-256 hash is stored; plaintext is returned once at creation.
 * - Revoked keys fail closed immediately; revocation is customer-scoped
 *   (customer A cannot revoke customer B's key).
 * - `write` scope implies `read`; `read` never implies `write`.
 * - authenticateAgentRequest: anonymous allowed (public protocol), malformed
 *   or unknown key -> 401, valid key -> identity.
 * - listCustomerAgentKeys never exposes hashes.
 *
 * Run: node --test --import ./src/lib/__tests__/register-loader.mjs src/lib/__tests__/customer-agent-keys.test.mts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register('./register-loader.mjs', import.meta.url);
register('./customer-agent-keys-stub-loader.mjs', import.meta.url);

const {
  verifyCustomerAgentKey,
  customerKeyHasScope,
  authenticateAgentRequest,
  createCustomerAgentKey,
  revokeCustomerAgentKey,
  listCustomerAgentKeys,
} = await import('@/lib/customer-agent-keys.ts');

const { hashAgentKey, AGENT_KEY_PREFIX } = await import('@/lib/agent-protocol.ts');

// unsafeUnscoped() needs an injected client in tests (no real DB).
const { setUnscopedClient } = await import('@/lib/tenant-guard.ts');
const stub = await import('./customer-agent-keys-stub.mjs');
setUnscopedClient(stub.prisma);

const { db, resetDb, seedCustomer } = stub;

function anonRequest() {
  return new Request('https://example.com/api/agent/v1/search', { headers: {} });
}
function authedRequest(key) {
  return new Request('https://example.com/api/agent/v1/search', {
    headers: { authorization: `Bearer ${key}` },
  });
}

async function setup() {
  resetDb();
  seedCustomer({
    id: 'cust_1',
    name: 'Alex Carter',
    phone: '(416) 555-0132',
    email: 'alex@example.com',
    city: 'Toronto',
  });
  seedCustomer({ id: 'cust_2', name: 'Sam Lee', email: 'sam@example.com' });
  return createCustomerAgentKey('cust_1', 'Claude');
}

// ---------------------------------------------------------------------------
// Scope semantics (pure)
// ---------------------------------------------------------------------------

test('customerKeyHasScope: write implies read; read never implies write', () => {
  const readOnly = { scopes: ['read'] };
  const writer = { scopes: ['write'] };
  assert.equal(customerKeyHasScope(readOnly, 'read'), true);
  assert.equal(customerKeyHasScope(readOnly, 'write'), false);
  assert.equal(customerKeyHasScope(writer, 'read'), true);
  assert.equal(customerKeyHasScope(writer, 'write'), true);
});

// ---------------------------------------------------------------------------
// Creation: plaintext shown once, hash stored
// ---------------------------------------------------------------------------

test('createCustomerAgentKey returns plaintext once; only the hash is stored', async () => {
  await setup();
  const created = await createCustomerAgentKey('cust_1', '  My Assistant  ');
  assert.ok(created.key.startsWith(AGENT_KEY_PREFIX), 'plaintext has the key prefix');
  assert.ok(created.key.length > 50, 'plaintext has real entropy');
  assert.equal(created.label, 'My Assistant', 'label is trimmed');

  const stored = db.agentKeys.get(created.id);
  assert.ok(stored, 'row was stored');
  assert.equal(stored.keyHash, hashAgentKey(created.key), 'stored value is the hash of the plaintext');
  assert.ok(!('key' in stored), 'plaintext is NOT stored');

  const listed = await listCustomerAgentKeys('cust_1');
  const me = listed.find((k) => k.id === created.id);
  assert.ok(me, 'key appears in the list');
  assert.ok(!('keyHash' in me), 'hash is never exposed by listing');
  assert.ok(!('key' in me), 'plaintext is never exposed by listing');
  assert.ok(me.keyPrefix.length > 0, 'display prefix is present');
});

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

test('verifyCustomerAgentKey returns identity for a valid key', async () => {
  const created = await setup();
  const v = await verifyCustomerAgentKey(created.key);
  assert.ok(v, 'valid key verifies');
  assert.equal(v.customerId, 'cust_1');
  assert.equal(v.customer.email, 'alex@example.com');
  assert.equal(v.customer.name, 'Alex Carter');
  assert.deepEqual(v.scopes, ['read', 'write']);
});

test('verifyCustomerAgentKey rejects unknown, malformed, and empty keys', async () => {
  await setup();
  assert.equal(await verifyCustomerAgentKey(`${AGENT_KEY_PREFIX}nope-not-real`), null, 'unknown key');
  assert.equal(await verifyCustomerAgentKey('Bearer junk'), null, 'malformed key');
  assert.equal(await verifyCustomerAgentKey(''), null, 'empty key');
  assert.equal(await verifyCustomerAgentKey(null), null, 'null key');
});

test('verifyCustomerAgentKey fails closed for revoked keys', async () => {
  const created = await setup();
  assert.ok(await verifyCustomerAgentKey(created.key), 'valid before revocation');
  assert.equal(await revokeCustomerAgentKey('cust_1', created.id), true, 'revocation succeeds');
  assert.equal(await verifyCustomerAgentKey(created.key), null, 'revoked key fails closed');
  assert.equal(await revokeCustomerAgentKey('cust_1', created.id), false, 'double revoke is a no-op');
});

test('revokeCustomerAgentKey is customer-scoped: A cannot revoke B\'s key', async () => {
  const created = await setup(); // belongs to cust_1
  assert.equal(await revokeCustomerAgentKey('cust_2', created.id), false, 'cross-customer revoke fails');
  assert.ok(await verifyCustomerAgentKey(created.key), 'key still valid after hostile revoke attempt');
});

// ---------------------------------------------------------------------------
// Request authentication
// ---------------------------------------------------------------------------

test('authenticateAgentRequest allows anonymous (public protocol)', async () => {
  await setup();
  const r = await authenticateAgentRequest(anonRequest());
  assert.equal(r.ok, true);
  assert.equal(r.key, null);
});

test('authenticateAgentRequest rejects bad keys with 401', async () => {
  await setup();
  const r = await authenticateAgentRequest(authedRequest(`${AGENT_KEY_PREFIX}bogus`));
  assert.equal(r.ok, false);
  assert.equal(r.status, 401);
});

test('authenticateAgentRequest accepts a valid key and returns identity', async () => {
  const created = await setup();
  const r = await authenticateAgentRequest(authedRequest(created.key));
  assert.equal(r.ok, true);
  assert.ok(r.key, 'identity returned');
  assert.equal(r.key.customerId, 'cust_1');
  assert.equal(r.key.customer.name, 'Alex Carter');
});

test('authenticateAgentRequest rejects a revoked key with 401', async () => {
  const created = await setup();
  await revokeCustomerAgentKey('cust_1', created.id);
  const r = await authenticateAgentRequest(authedRequest(created.key));
  assert.equal(r.ok, false);
  assert.equal(r.status, 401);
});
