import test from 'node:test';
import assert from 'node:assert/strict';
import { isPublicPath } from '@/lib/public-paths.ts';

// Regression test (2026-09-28): the password-recovery and legal pages must be
// reachable without a session. QA found /forgot-password bouncing anonymous
// users to /login (missing from the proxy's public table), which made the
// entire password-reset flow unreachable — the emailed /reset-password/[token]
// link bounced too. /terms and /privacy bounced even though the register page
// links to them.

test('public paths: password recovery is reachable without a session', () => {
  assert.equal(isPublicPath('/forgot-password'), true);
  assert.equal(isPublicPath('/reset-password/abc123token'), true);
  assert.equal(isPublicPath('/reset-password/'), true);
});

test('public paths: legal pages are reachable without a session', () => {
  assert.equal(isPublicPath('/terms'), true);
  assert.equal(isPublicPath('/privacy'), true);
});

test('public paths: auth pages stay public', () => {
  assert.equal(isPublicPath('/'), true);
  assert.equal(isPublicPath('/login'), true);
  assert.equal(isPublicPath('/register'), true);
});

test('public paths: customer token links stay public', () => {
  for (const p of ['/book/', '/q/', '/i/', '/r/', '/p/', '/portal/', '/sign/', '/track/', '/rev/']) {
    assert.equal(isPublicPath(`${p}tok123`), true, p);
  }
  assert.equal(isPublicPath('/directory'), true);
  assert.equal(isPublicPath('/directory/request'), true);
});

test('public paths: app pages still require a session', () => {
  for (const p of ['/dashboard', '/jobs', '/schedule', '/customers', '/settings', '/invoices', '/quotes']) {
    assert.equal(isPublicPath(p), false, p);
  }
  // Prefix traps: /loginx is not /login; /revoke is not /rev/
  assert.equal(isPublicPath('/loginx'), false);
  assert.equal(isPublicPath('/revoke'), false);
});

test('public paths: customer auth pages are reachable without a session', () => {
  assert.equal(isPublicPath('/customer/login'), true);
  assert.equal(isPublicPath('/customer/signup'), true);
  // Customer app pages still require a session (proxy checks customer cookie)
  assert.equal(isPublicPath('/customer'), false);
  assert.equal(isPublicPath('/customer/requests'), false);
});

test('public paths: agent protocol surface is reachable without a session', () => {
  // Regression (2026-09-30): /.well-known/everyjob.json bounced anonymous
  // callers to /login, breaking machine discovery of the Agent Protocol.
  assert.equal(isPublicPath('/agents'), true);
  assert.equal(isPublicPath('/.well-known/everyjob.json'), true);
  assert.equal(isPublicPath('/a/abc123token'), true);
  assert.equal(isPublicPath('/api/agent/v1/search'), true);
  assert.equal(isPublicPath('/api/agent/v1/proposals'), true);
  // Prefix traps: /agentsx is not /agents
  assert.equal(isPublicPath('/agentsx'), false);
});
