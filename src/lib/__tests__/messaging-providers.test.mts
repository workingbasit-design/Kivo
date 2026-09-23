/**
 * Tests for the Track 9 provider layer (src/lib/messaging/providers.ts) and
 * Stripe helpers (src/lib/stripe.ts). All provider calls use an injected
 * mock fetch — zero live network calls.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'crypto';
import {
  sendWhatsAppText,
  sendResendEmail,
  sendSmsDisabled,
} from '../messaging/providers.ts';
import {
  connectOAuthUrl,
  createCheckoutSession,
  verifyWebhookSignature,
  toCents,
} from '../stripe.ts';

function mockFetch(handler: (url: string, init?: RequestInit) => unknown) {
  return (async (url: unknown, init?: RequestInit) => {
    const result = handler(String(url), init);
    return {
      ok: (result as { ok: boolean }).ok,
      status: (result as { status: number }).status,
      json: async () => (result as { body: unknown }).body,
    } as unknown as Response;
  }) as typeof fetch;
}

/* ---------------- WhatsApp ---------------- */

test('sendWhatsAppText: success returns provider message id', async () => {
  const f = mockFetch((url, init) => {
    assert.ok(String(url).includes('/12345/messages'));
    const headers = (init?.headers ?? {}) as Record<string, string>;
    assert.equal(headers.Authorization, 'Bearer tok');
    const body = JSON.parse(String(init?.body));
    assert.equal(body.messaging_product, 'whatsapp');
    assert.equal(body.to, '14165550123');
    assert.equal(body.type, 'text');
    return { ok: true, status: 200, body: { messages: [{ id: 'wamid.abc' }] } };
  });
  const res = await sendWhatsAppText(
    { phoneNumberId: '12345', accessToken: 'tok' },
    '14165550123',
    'Hello',
    f
  );
  assert.equal(res.ok, true);
  assert.equal(res.providerMessageId, 'wamid.abc');
});

test('sendWhatsAppText: auth failure classified', async () => {
  const f = mockFetch(() => ({
    ok: false,
    status: 401,
    body: { error: { message: 'Invalid token', code: 190 } },
  }));
  const res = await sendWhatsAppText({ phoneNumberId: '1', accessToken: 'bad' }, '1416', 'Hi', f);
  assert.equal(res.ok, false);
  assert.equal(res.errorKind, 'auth');
});

test('sendWhatsAppText: template-required classified', async () => {
  const f = mockFetch(() => ({
    ok: false,
    status: 400,
    body: { error: { message: 'Requires template for business-initiated message', code: 132000 } },
  }));
  const res = await sendWhatsAppText({ phoneNumberId: '1', accessToken: 't' }, '1416', 'Hi', f);
  assert.equal(res.ok, false);
  assert.equal(res.errorKind, 'template_required');
});

test('sendWhatsAppText: network failure is retryable', async () => {
  const f = (async () => {
    throw new Error('socket hangup');
  }) as typeof fetch;
  const res = await sendWhatsAppText({ phoneNumberId: '1', accessToken: 't' }, '1416', 'Hi', f);
  assert.equal(res.ok, false);
  assert.equal(res.errorKind, 'network');
  assert.equal(res.retryable, true);
});

/* ---------------- Resend ---------------- */

test('sendResendEmail: success returns id', async () => {
  const f = mockFetch((url, init) => {
    assert.equal(url, 'https://api.resend.com/emails');
    const headers = (init?.headers ?? {}) as Record<string, string>;
    assert.equal(headers.Authorization, 'Bearer re_key');
    const body = JSON.parse(String(init?.body));
    assert.equal(body.from, 'Acme <hello@acme.ca>');
    assert.deepEqual(body.to, ['c@example.ca']);
    return { ok: true, status: 200, body: { id: 'email_123' } };
  });
  const res = await sendResendEmail(
    { fromName: 'Acme', fromAddress: 'hello@acme.ca', apiKey: 're_key' },
    'c@example.ca',
    'Subject',
    'Body',
    f
  );
  assert.equal(res.ok, true);
  assert.equal(res.providerMessageId, 'email_123');
});

test('sendResendEmail: rate limit classified as quota + retryable', async () => {
  const f = mockFetch(() => ({ ok: false, status: 429, body: { message: 'Rate limited' } }));
  const res = await sendResendEmail(
    { fromName: null, fromAddress: 'a@b.ca', apiKey: 'k' },
    'c@d.ca',
    'S',
    'B',
    f
  );
  assert.equal(res.ok, false);
  assert.equal(res.errorKind, 'quota');
  assert.equal(res.retryable, true);
});

/* ---------------- SMS stub ---------------- */

test('sendSmsDisabled: explains itself, never ok', () => {
  const res = sendSmsDisabled();
  assert.equal(res.ok, false);
  assert.equal(res.errorKind, 'sms_disabled');
  assert.ok((res.error ?? '').toLowerCase().includes('no free sms'));
});

/* ---------------- Stripe ---------------- */

test('connectOAuthUrl: builds Connect authorize URL with state', () => {
  const url = connectOAuthUrl({
    clientId: 'ca_123',
    redirectUri: 'https://app.example.com/api/stripe/callback',
    state: 'rand_state_42',
  });
  assert.ok(url.startsWith('https://connect.stripe.com/oauth/authorize?'));
  assert.ok(url.includes('client_id=ca_123'));
  assert.ok(url.includes('response_type=code'));
  assert.ok(url.includes('scope=read_write'));
  assert.ok(url.includes('state=rand_state_42'));
  assert.ok(url.includes('redirect_uri=' + encodeURIComponent('https://app.example.com/api/stripe/callback')));
});

test('createCheckoutSession: posts form-encoded with Stripe-Account header', async () => {
  const f = mockFetch((url, init) => {
    assert.equal(url, 'https://api.stripe.com/v1/checkout/sessions');
    const headers = (init?.headers ?? {}) as Record<string, string>;
    assert.equal(headers['Stripe-Account'], 'acct_999');
    assert.equal(headers.Authorization, 'Bearer sk_test_x');
    const form = new URLSearchParams(String(init?.body));
    assert.equal(form.get('mode'), 'payment');
    assert.equal(form.get('line_items[0][price_data][currency]'), 'cad');
    assert.equal(form.get('line_items[0][price_data][unit_amount]'), '12000');
    assert.equal(form.get('metadata[kind]'), 'invoice');
    assert.equal(form.get('metadata[invoice_id]'), 'inv1');
    assert.equal(form.get('payment_intent_data[metadata][kind]'), 'invoice');
    return { ok: true, status: 200, body: { id: 'cs_123', url: 'https://checkout.stripe.com/pay/cs_123' } };
  });
  const res = await createCheckoutSession(
    {
      platformSecret: 'sk_test_x',
      stripeAccountId: 'acct_999',
      amountCents: 12000,
      productName: 'Invoice INV-1',
      successUrl: 'https://app.example.com/i/tok?paid=1',
      cancelUrl: 'https://app.example.com/i/tok',
      metadata: { kind: 'invoice', invoice_id: 'inv1', business_id: 'b1' },
    },
    f
  );
  assert.equal(res.ok, true);
  assert.equal(res.sessionId, 'cs_123');
  assert.ok((res.url ?? '').includes('checkout.stripe.com'));
});

test('createCheckoutSession: surfaces Stripe error message', async () => {
  const f = mockFetch(() => ({
    ok: false,
    status: 400,
    body: { error: { message: 'Invalid amount' } },
  }));
  const res = await createCheckoutSession(
    {
      platformSecret: 'sk',
      stripeAccountId: 'acct_1',
      amountCents: 0,
      productName: 'x',
      successUrl: 'https://a',
      cancelUrl: 'https://b',
      metadata: {},
    },
    f
  );
  assert.equal(res.ok, false);
  assert.equal(res.error, 'Invalid amount');
});

test('verifyWebhookSignature: accepts a valid signature', () => {
  const secret = 'whsec_test';
  const rawBody = '{"id":"evt_123","type":"checkout.session.completed"}';
  const t = 1700000000;
  const sig = createHmac('sha256', secret).update(`${t}.${rawBody}`, 'utf8').digest('hex');
  const header = `t=${t},v1=${sig}`;
  const res = verifyWebhookSignature(rawBody, header, secret, 300, t + 10);
  assert.equal(res.ok, true);
});

test('verifyWebhookSignature: rejects wrong signature', () => {
  const res = verifyWebhookSignature(
    '{"id":"evt_123"}',
    't=1700000000,v1=deadbeef',
    'whsec_test',
    300,
    1700000000
  );
  assert.equal(res.ok, false);
});

test('verifyWebhookSignature: rejects stale timestamp', () => {
  const secret = 'whsec_test';
  const rawBody = '{"id":"evt_123"}';
  const t = 1700000000;
  const sig = createHmac('sha256', secret).update(`${t}.${rawBody}`, 'utf8').digest('hex');
  const res = verifyWebhookSignature(rawBody, `t=${t},v1=${sig}`, secret, 300, t + 3600);
  assert.equal(res.ok, false);
  assert.ok((res.error ?? '').toLowerCase().includes('tolerance'));
});

test('verifyWebhookSignature: rejects missing header/secret', () => {
  assert.equal(verifyWebhookSignature('{}', null, 's').ok, false);
  assert.equal(verifyWebhookSignature('{}', 't=1,v1=x', '').ok, false);
});

test('toCents: rounds dollars to integer cents', () => {
  assert.equal(toCents(120), 12000);
  assert.equal(toCents(19.99), 1999);
  assert.equal(toCents(19.995), 2000);
});
