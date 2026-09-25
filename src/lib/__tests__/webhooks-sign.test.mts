/**
 * Unit tests for webhook signing/verification (src/lib/webhooks.ts).
 * Pure crypto only — no DB, no network.
 * Run: node --test --import ./src/lib/__tests__/register-loader.mjs src/lib/__tests__/webhooks-sign.test.mts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WEBHOOK_EVENTS,
  WEBHOOK_SIGNATURE_HEADER,
  WEBHOOK_EVENT_HEADER,
  WEBHOOK_DELIVERY_HEADER,
  signWebhookPayload,
  verifyWebhookSignature,
  generateWebhookSecret,
  WEBHOOK_RETRY_DELAYS_MS,
} from '@/lib/webhooks.ts';

test('signWebhookPayload is deterministic, hex-shaped, and body-sensitive', () => {
  const body = JSON.stringify({ id: 'abc', event: 'job.created', data: {} });
  const s1 = signWebhookPayload('secret', body);
  const s2 = signWebhookPayload('secret', body);
  assert.equal(s1, s2);
  assert.match(s1, /^[0-9a-f]{64}$/);
  assert.notEqual(signWebhookPayload('secret', body), signWebhookPayload('other', body));
  assert.notEqual(signWebhookPayload('secret', body), signWebhookPayload('secret', body + ' '));
});

test('verifyWebhookSignature accepts a valid signature, rejects the rest', () => {
  const body = '{"a":1}';
  const secret = 's3cr3t';
  const valid = signWebhookPayload(secret, body);
  assert.equal(verifyWebhookSignature(secret, body, valid), true);
  assert.equal(verifyWebhookSignature(secret, body, 'deadbeef'), false, 'wrong signature');
  assert.equal(verifyWebhookSignature('wrong', body, valid), false, 'wrong secret');
  assert.equal(verifyWebhookSignature(secret, '{"a":2}', valid), false, 'tampered body');
  assert.equal(verifyWebhookSignature(secret, body, null), false, 'missing signature');
  assert.equal(verifyWebhookSignature(secret, body, ''), false, 'empty signature');
  assert.equal(
    verifyWebhookSignature(secret, body, valid.toUpperCase()),
    false,
    'case differs — receivers must send exact hex'
  );
});

test('generateWebhookSecret produces unique, URL-safe secrets', () => {
  const a = generateWebhookSecret();
  const b = generateWebhookSecret();
  assert.notEqual(a, b);
  assert.match(a, /^[A-Za-z0-9_-]+$/);
  assert.ok(a.length >= 32, 'enough entropy for HMAC');
});

test('event catalog and header names are stable', () => {
  assert.deepEqual([...WEBHOOK_EVENTS], [
    'job.created',
    'job.completed',
    'invoice.created',
    'invoice.paid',
    'customer.created',
    'payment.recorded',
  ]);
  assert.equal(WEBHOOK_SIGNATURE_HEADER, 'X-EveryJob-Signature');
  assert.equal(WEBHOOK_EVENT_HEADER, 'X-EveryJob-Event');
  assert.equal(WEBHOOK_DELIVERY_HEADER, 'X-EveryJob-Delivery');
  assert.deepEqual(WEBHOOK_RETRY_DELAYS_MS, [
    60_000,
    5 * 60_000,
    30 * 60_000,
    2 * 3_600_000,
    12 * 3_600_000,
  ]);
});
