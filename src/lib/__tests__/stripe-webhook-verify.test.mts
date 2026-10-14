/**
 * B8.1 Stripe webhook verification tests: signature, timestamp tolerance
 * (replay rejection), and malformed headers.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { verifyWebhookSignature } from '../stripe.ts';

const SECRET = 'whsec_test_secret_123';
const BODY = JSON.stringify({ id: 'evt_123', type: 'checkout.session.completed' });

function sign(body: string, secret: string, timestamp: number): string {
  const sig = createHmac('sha256', secret).update(`${timestamp}.${body}`, 'utf8').digest('hex');
  return `t=${timestamp},v1=${sig}`;
}

describe('stripe webhook verification (B8.1)', () => {
  it('accepts a valid signature within tolerance', () => {
    const now = Math.floor(Date.now() / 1000);
    const r = verifyWebhookSignature(BODY, sign(BODY, SECRET, now), SECRET, 300, now);
    assert.equal(r.ok, true);
  });
  it('rejects a replayed (stale timestamp) webhook', () => {
    const now = Math.floor(Date.now() / 1000);
    const stale = now - 3600; // 1 hour old, past the 5-min tolerance
    const r = verifyWebhookSignature(BODY, sign(BODY, SECRET, stale), SECRET, 300, now);
    assert.equal(r.ok, false);
    assert.match(r.error ?? '', /tolerance/i);
  });
  it('rejects a future timestamp outside tolerance', () => {
    const now = Math.floor(Date.now() / 1000);
    const future = now + 3600;
    const r = verifyWebhookSignature(BODY, sign(BODY, SECRET, future), SECRET, 300, now);
    assert.equal(r.ok, false);
  });
  it('rejects a tampered body', () => {
    const now = Math.floor(Date.now() / 1000);
    const r = verifyWebhookSignature('{"tampered":true}', sign(BODY, SECRET, now), SECRET, 300, now);
    assert.equal(r.ok, false);
  });
  it('rejects a wrong secret', () => {
    const now = Math.floor(Date.now() / 1000);
    const r = verifyWebhookSignature(BODY, sign(BODY, SECRET, now), 'whsec_wrong', 300, now);
    assert.equal(r.ok, false);
  });
  it('rejects missing/malformed headers', () => {
    const now = Math.floor(Date.now() / 1000);
    assert.equal(verifyWebhookSignature(BODY, null, SECRET, 300, now).ok, false);
    assert.equal(verifyWebhookSignature(BODY, 'garbage', SECRET, 300, now).ok, false);
    assert.equal(verifyWebhookSignature(BODY, 't=abc,v1=def', SECRET, 300, now).ok, false);
  });
});
