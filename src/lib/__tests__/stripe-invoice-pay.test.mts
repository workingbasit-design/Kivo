/**
 * Unit tests for online invoice card payments:
 * - buildInvoiceCheckoutOptions / createInvoiceCheckout param building
 *   (mock fetchFn — zero live Stripe calls)
 * - deriveInvoiceStatus truth table (pure helper in src/lib/stripe.ts,
 *   used by the Stripe webhook)
 * - EN/FR parity of the new invoicePay i18n fragment
 * No HTTP, no DB — pure logic only.
 * Run: node --test --import ./src/lib/__tests__/register-loader.mjs src/lib/__tests__/stripe-invoice-pay.test.mts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildInvoiceCheckoutOptions,
  createInvoiceCheckout,
  deriveInvoiceStatus,
  toCents,
  type InvoiceCheckoutInput,
} from '@/lib/stripe.ts';
import fragment from '../i18n/fragments/payments.ts';

/* ------------------------------------------------------------------ */
/* buildInvoiceCheckoutOptions: pure param building                      */
/* ------------------------------------------------------------------ */

const baseInput: InvoiceCheckoutInput = {
  platformSecret: 'sk_test_xxx',
  stripeAccountId: 'acct_123',
  invoice: { id: 'inv_1', number: 'INV-001' },
  business: { id: 'biz_1', name: 'Acme Plumbing', currency: 'CAD' },
  amountCents: 24999,
  successUrl: 'https://app.example/i/tok?paid=1',
  cancelUrl: 'https://app.example/i/tok',
  customerEmail: 'client@example.ca',
  checkoutLocale: 'fr',
};

test('invoice checkout options carry the invoice contract', () => {
  const o = buildInvoiceCheckoutOptions(baseInput);
  assert.equal(o.amountCents, 24999);
  assert.equal(o.currency, 'cad');
  assert.equal(o.productName, 'Invoice INV-001 — Acme Plumbing');
  assert.equal(o.successUrl, 'https://app.example/i/tok?paid=1');
  assert.equal(o.cancelUrl, 'https://app.example/i/tok');
  assert.equal(o.customerEmail, 'client@example.ca');
  assert.equal(o.checkoutLocale, 'fr');
  assert.deepEqual(o.metadata, {
    kind: 'invoice',
    invoice_id: 'inv_1',
    business_id: 'biz_1',
  });
});

test('EveryJob takes no platform fee on invoice checkout', () => {
  const o = buildInvoiceCheckoutOptions(baseInput);
  assert.equal(o.applicationFeeCents, 0);
});

test('currency defaults to CAD and is lowercased', () => {
  const o = buildInvoiceCheckoutOptions({
    ...baseInput,
    business: { id: 'biz_1', name: 'Acme' },
  });
  assert.equal(o.currency, 'cad');
});

test('toCents converts dollars to integer cents', () => {
  assert.equal(toCents(249.99), 24999);
  assert.equal(toCents(100), 10000);
});

/* ------------------------------------------------------------------ */
/* createInvoiceCheckout: Stripe request shape (mock fetch, no network)   */
/* ------------------------------------------------------------------ */

function mockFetch(
  captured: { url?: string; init?: RequestInit },
  payload: unknown,
  status = 200
) {
  return async (url: string, init?: RequestInit) => {
    captured.url = url;
    captured.init = init;
    return new Response(JSON.stringify(payload), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  };
}

test('posts a direct-charge Checkout Session to the connected account', async () => {
  const captured: { url?: string; init?: RequestInit } = {};
  const fetchFn = mockFetch(captured, {
    id: 'cs_test_123',
    url: 'https://checkout.stripe.com/pay/cs_test_123',
  });
  const res = await createInvoiceCheckout(baseInput, fetchFn as typeof fetch);
  assert.equal(res.ok, true);
  assert.equal(res.sessionId, 'cs_test_123');
  assert.equal(res.url, 'https://checkout.stripe.com/pay/cs_test_123');

  assert.equal(captured.url, 'https://api.stripe.com/v1/checkout/sessions');
  const headers = new Headers(captured.init?.headers);
  assert.equal(headers.get('Authorization'), 'Bearer sk_test_xxx');
  assert.equal(headers.get('Stripe-Account'), 'acct_123');

  const body = new URLSearchParams(String(captured.init?.body));
  assert.equal(body.get('mode'), 'payment');
  assert.equal(body.get('line_items[0][price_data][unit_amount]'), '24999');
  assert.equal(body.get('line_items[0][price_data][currency]'), 'cad');
  assert.equal(
    body.get('line_items[0][price_data][product_data][name]'),
    'Invoice INV-001 — Acme Plumbing'
  );
  assert.equal(body.get('locale'), 'fr');
  assert.equal(body.get('customer_email'), 'client@example.ca');
  assert.equal(body.get('metadata[kind]'), 'invoice');
  assert.equal(body.get('metadata[invoice_id]'), 'inv_1');
  assert.equal(body.get('metadata[business_id]'), 'biz_1');
  assert.equal(body.get('payment_intent_data[metadata][kind]'), 'invoice');
  // Explicit zero platform fee — EveryJob never takes a cut.
  assert.equal(body.get('payment_intent_data[application_fee_amount]'), '0');
});

test('English locale maps to en', async () => {
  const captured: { url?: string; init?: RequestInit } = {};
  const fetchFn = mockFetch(captured, { id: 'cs_1', url: 'https://x' });
  await createInvoiceCheckout(
    { ...baseInput, checkoutLocale: 'en' },
    fetchFn as typeof fetch
  );
  const body = new URLSearchParams(String(captured.init?.body));
  assert.equal(body.get('locale'), 'en');
});

test('Stripe error surfaces as ok:false', async () => {
  const captured: { url?: string; init?: RequestInit } = {};
  const fetchFn = mockFetch(
    captured,
    { error: { message: 'Invalid amount.' } },
    400
  );
  const res = await createInvoiceCheckout(baseInput, fetchFn as typeof fetch);
  assert.equal(res.ok, false);
  assert.equal(res.error, 'Invalid amount.');
});

/* ------------------------------------------------------------------ */
/* deriveInvoiceStatus: honest partial handling                          */
/* ------------------------------------------------------------------ */

test('status derivation is honest about partials', () => {
  assert.equal(deriveInvoiceStatus(100, 100), 'PAID');
  assert.equal(deriveInvoiceStatus(100, 120), 'PAID'); // overpaid still PAID
  assert.equal(deriveInvoiceStatus(100, 99.995), 'PAID'); // 1c float tolerance
  assert.equal(deriveInvoiceStatus(100, 50), 'PARTIALLY PAID');
  assert.equal(deriveInvoiceStatus(100, 0.01), 'PARTIALLY PAID');
  assert.equal(deriveInvoiceStatus(100, 0), 'UNPAID');
  assert.equal(deriveInvoiceStatus(0, 0), 'PAID');
});

/* ------------------------------------------------------------------ */
/* invoicePay fragment: EN/FR parity                                     */
/* ------------------------------------------------------------------ */

function keysOf(obj: Record<string, unknown>, prefix = ''): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object') out.push(...keysOf(v as Record<string, unknown>, path));
    else out.push(path);
  }
  return out;
}

test('invoicePay fragment has full EN/FR parity', () => {
  const en = keysOf(fragment.en as unknown as Record<string, unknown>).sort();
  const fr = keysOf(fragment.fr as unknown as Record<string, unknown>).sort();
  assert.deepEqual(fr, en, 'en/fr key mismatch');
  assert.ok(en.length > 0, 'fragment should not be empty');
  for (const k of en) {
    assert.ok(k.startsWith('invoicePay.'), `unexpected namespace in key ${k}`);
  }
});
