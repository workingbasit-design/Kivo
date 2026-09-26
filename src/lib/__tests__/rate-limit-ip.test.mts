/**
 * Unit tests for the trusted client-IP helper (src/lib/client-ip.ts).
 * Run: node --test src/lib/__tests__/rate-limit-ip.test.mts
 *
 * The helper backs rate-limit keys on public endpoints. The critical
 * property: on Vercel the platform-verified header wins, so an attacker
 * rotating a spoofed leftmost x-forwarded-for value cannot mint a fresh
 * rate-limit bucket per request.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { clientIpFromHeaders } from '../client-ip.ts';

function headers(pairs: [string, string][]): Headers {
  const h = new Headers();
  for (const [k, v] of pairs) h.set(k, v);
  return h;
}

test('prefers x-vercel-forwarded-for over x-forwarded-for and x-real-ip', () => {
  const h = headers([
    ['x-vercel-forwarded-for', '203.0.113.9'],
    ['x-forwarded-for', '198.51.100.7, 203.0.113.9'],
    ['x-real-ip', '192.0.2.44'],
  ]);
  assert.equal(clientIpFromHeaders(h), '203.0.113.9');
});

test('reads the leftmost x-forwarded-for entry when no Vercel header exists', () => {
  const h = headers([['x-forwarded-for', '198.51.100.7, 10.0.0.1']]);
  assert.equal(clientIpFromHeaders(h), '198.51.100.7');
});

test('falls back to x-real-ip', () => {
  const h = headers([['x-real-ip', '192.0.2.44']]);
  assert.equal(clientIpFromHeaders(h), '192.0.2.44');
});

test("returns 'unknown' when no IP headers are present", () => {
  assert.equal(clientIpFromHeaders(new Headers()), 'unknown');
});

test('ignores blank header values', () => {
  const h = headers([
    ['x-vercel-forwarded-for', ''],
    ['x-forwarded-for', '   '],
  ]);
  assert.equal(clientIpFromHeaders(h), 'unknown');
});

test('a spoofed leftmost x-forwarded-for does not grant a fresh identity', () => {
  // Same platform-verified IP, attacker rotating the spoofable leftmost value.
  const attemptA = headers([
    ['x-vercel-forwarded-for', '203.0.113.9'],
    ['x-forwarded-for', '1.1.1.1, 203.0.113.9'],
  ]);
  const attemptB = headers([
    ['x-vercel-forwarded-for', '203.0.113.9'],
    ['x-forwarded-for', '2.2.2.2, 203.0.113.9'],
  ]);
  assert.equal(clientIpFromHeaders(attemptA), '203.0.113.9');
  assert.equal(clientIpFromHeaders(attemptA), clientIpFromHeaders(attemptB));
});
