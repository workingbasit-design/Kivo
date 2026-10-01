/**
 * Unit tests for the EveryJob Agent Protocol helpers (src/lib/agent-protocol.ts).
 * Pure helpers only — no DB, no network.
 * Run: node --test --import ./src/lib/__tests__/register-loader.mjs src/lib/__tests__/agent-protocol.test.mts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AGENT_KEY_PREFIX,
  AGENT_PROTOCOL_VERSION,
  generateAgentKey,
  generateConfirmToken,
  hashAgentKey,
  isProposalExpired,
  keyHasScope,
  normalizeAgentName,
  parseAgentScopes,
  proposalExpiry,
  agentSearchSchema,
  agentProposalSchema,
  buildAgentManifest,
} from '@/lib/agent-protocol.ts';

test('generateAgentKey produces a unique, well-formed key with matching hash and prefix', () => {
  const a = generateAgentKey();
  const b = generateAgentKey();
  assert.ok(a.key.startsWith(AGENT_KEY_PREFIX), 'key has ejc_agent_ prefix');
  assert.ok(a.key.length > 50, 'key has enough entropy');
  assert.notEqual(a.key, b.key, 'keys are unique');
  assert.equal(a.keyHash, hashAgentKey(a.key), 'stored hash matches the key');
  assert.equal(
    a.keyPrefix,
    a.key.slice(AGENT_KEY_PREFIX.length, AGENT_KEY_PREFIX.length + 8),
    'prefix comes from the random part, not the literal ejc_agent_'
  );
  assert.notEqual(a.keyPrefix, b.keyPrefix, 'prefixes distinguish keys');
});

test('hashAgentKey is deterministic and SHA-256 shaped', () => {
  const h1 = hashAgentKey('ejc_agent_test');
  const h2 = hashAgentKey('ejc_agent_test');
  assert.equal(h1, h2);
  assert.match(h1, /^[0-9a-f]{64}$/);
  assert.notEqual(hashAgentKey('ejc_agent_test'), hashAgentKey('ejc_agent_test2'));
});

test('parseAgentScopes defaults to read-only and normalizes input', () => {
  assert.deepEqual(parseAgentScopes('read'), ['read']);
  assert.deepEqual(parseAgentScopes('write'), ['write']);
  assert.deepEqual(parseAgentScopes('read,write'), ['read', 'write']);
  assert.deepEqual(parseAgentScopes('READ, Write'), ['read', 'write']);
  assert.deepEqual(parseAgentScopes('read,read'), ['read']);
  assert.deepEqual(parseAgentScopes(''), ['read']);
  assert.deepEqual(parseAgentScopes('bogus'), ['read']);
});

test('keyHasScope: write implies read, read never implies write', () => {
  assert.equal(keyHasScope(['read'], 'read'), true);
  assert.equal(keyHasScope(['read'], 'write'), false);
  assert.equal(keyHasScope(['write'], 'read'), true);
  assert.equal(keyHasScope(['write'], 'write'), true);
  assert.equal(keyHasScope(['read', 'write'], 'write'), true);
});

test('generateConfirmToken is unique and URL-safe', () => {
  const a = generateConfirmToken();
  const b = generateConfirmToken();
  assert.notEqual(a, b);
  assert.match(a, /^[A-Za-z0-9_-]{43}$/, '32 bytes base64url');
});

test('proposalExpiry is 24h ahead and isProposalExpired compares correctly', () => {
  const now = new Date('2026-01-01T12:00:00Z');
  const expiry = proposalExpiry(now);
  assert.equal(expiry.getTime() - now.getTime(), 24 * 60 * 60 * 1000);
  assert.equal(isProposalExpired(expiry, now), false);
  assert.equal(isProposalExpired(expiry, new Date(now.getTime() + 24 * 60 * 60 * 1000 + 1)), true);
  assert.equal(isProposalExpired(expiry, expiry), true, 'expiry boundary is expired');
});

test('normalizeAgentName defaults and truncates', () => {
  assert.equal(normalizeAgentName(''), 'AI assistant');
  assert.equal(normalizeAgentName(undefined), 'AI assistant');
  assert.equal(normalizeAgentName('  Muse  '), 'Muse');
  assert.equal(normalizeAgentName('x'.repeat(100)).length, 60);
});

test('agentSearchSchema coerces and clamps limit', () => {
  const p = agentSearchSchema.parse({ service: 'plumber', city: 'Toronto', limit: '5' });
  assert.equal(p.limit, 5);
  assert.equal(agentSearchSchema.parse({}).limit, 10);
  assert.throws(() => agentSearchSchema.parse({ limit: 999 }), 'max 25 enforced');
  assert.throws(() => agentSearchSchema.parse({ limit: 0 }), 'min 1 enforced');
});

test('agentProposalSchema accepts a valid proposal body', () => {
  const p = agentProposalSchema.parse({
    agentName: 'Muse',
    businessSlug: 'acme-plumbing',
    service: 'Furnace repair',
    description: 'Furnace stopped heating overnight.',
    customerEmail: 'jane@example.com',
    customerName: 'Jane Doe',
    customerPhone: '(416) 555-0100',
  });
  assert.equal(p.service, 'Furnace repair');
  assert.equal(p.agentName, 'Muse');
});

test('agentProposalSchema rejects missing business identification', () => {
  const r = agentProposalSchema.safeParse({ service: 'Plumbing', description: 'Leak' });
  assert.equal(r.success, false, 'needs businessSlug or businessId');
});

test('agentProposalSchema rejects invalid email and phone', () => {
  assert.equal(
    agentProposalSchema.safeParse({
      businessId: 'x',
      service: 'Plumbing',
      description: 'Leak',
      customerEmail: 'not-an-email',
    }).success,
    false
  );
  assert.equal(
    agentProposalSchema.safeParse({
      businessId: 'x',
      service: 'Plumbing',
      description: 'Leak',
      customerPhone: 'abc',
    }).success,
    false
  );
});

test('agentProposalSchema allows key-authenticated proposals without contact fields', () => {
  // Identity comes from the agent key; body needs no contact fields.
  const r = agentProposalSchema.safeParse({
    businessSlug: 'acme',
    service: 'Plumbing',
    description: 'Leak under sink.',
  });
  assert.equal(r.success, true);
});

test('buildAgentManifest describes the protocol with absolute URLs', () => {
  const m = buildAgentManifest('https://example.com/');
  assert.equal(m.protocol, 'everyjob-agent');
  assert.equal(m.version, AGENT_PROTOCOL_VERSION);
  assert.equal(m.policy, 'https://example.com/agents');
  assert.ok(Array.isArray(m.endpoints) && m.endpoints.length === 4, 'four endpoints documented');
  assert.ok(m.endpoints.some((e) => e.path.includes('/proposals')), 'proposals endpoint present');
  assert.ok(
    (m.confirmation.guarantee as string).length > 20,
    'human-confirmation guarantee is stated'
  );
  assert.ok(
    (m.rules as string[]).some((r) => r.includes('confirmation')),
    'rules mention confirmation'
  );
});
