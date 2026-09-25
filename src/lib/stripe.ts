/**
 * Track 9 — Stripe integration (free-quota model = pay-per-transaction, no
 * monthly fee). Each business connects their OWN Stripe account via Stripe
 * Connect OAuth; funds settle directly to them and EveryJob NEVER holds
 * money. Card data never touches our servers: payment happens on Stripe
 * Checkout (Stripe-hosted page).
 *
 * All API calls use the PLATFORM secret key plus the `Stripe-Account`
 * header for the connected account (destination: the business's account).
 * `fetchFn` is injectable so tests run with zero live Stripe calls.
 */

import { createHmac, timingSafeEqual } from 'crypto';

type FetchFn = typeof fetch;

const API_BASE = 'https://api.stripe.com/v1';
const CONNECT_AUTHORIZE_URL = 'https://connect.stripe.com/oauth/authorize';
const CONNECT_TOKEN_URL = 'https://connect.stripe.com/oauth/token';

/* ------------------------------------------------------------------ */
/* Stripe Connect OAuth                                                  */
/* ------------------------------------------------------------------ */

export interface ConnectOAuthOptions {
  clientId: string;
  redirectUri: string;
  /** Random CSRF state (generated per attempt, verified on callback). */
  state: string;
}

/** Authorization URL that starts the business's Stripe Connect onboarding. */
export function connectOAuthUrl(opts: ConnectOAuthOptions): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: opts.clientId,
    scope: 'read_write',
    redirect_uri: opts.redirectUri,
    state: opts.state,
  });
  return `${CONNECT_AUTHORIZE_URL}?${params.toString()}`;
}

export interface ConnectTokenResult {
  ok: boolean;
  stripeUserId?: string; // acct_...
  livemode?: boolean;
  error?: string;
}

/** Exchange the OAuth `code` for the connected account id. */
export async function exchangeConnectCode(
  code: string,
  platformSecret: string,
  fetchFn: FetchFn = fetch
): Promise<ConnectTokenResult> {
  let res: Response;
  try {
    res = await fetchFn(CONNECT_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_secret: platformSecret,
      }).toString(),
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Network error.' };
  }
  let payload: Record<string, unknown> = {};
  try {
    payload = (await res.json()) as Record<string, unknown>;
  } catch {
    return { ok: false, error: `Stripe token exchange failed (HTTP ${res.status}).` };
  }
  if (!res.ok || typeof payload.stripe_user_id !== 'string') {
    const desc =
      typeof (payload as { error_description?: unknown }).error_description === 'string'
        ? (payload as { error_description: string }).error_description
        : `Stripe token exchange failed (HTTP ${res.status}).`;
    return { ok: false, error: desc };
  }
  return {
    ok: true,
    stripeUserId: payload.stripe_user_id,
    livemode: payload.livemode === true,
  };
}

export interface ConnectAccountStatus {
  ok: boolean;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  detailsSubmitted?: boolean;
  error?: string;
}

/** Read-only check of the connected account's capabilities. */
export async function getConnectAccountStatus(
  platformSecret: string,
  stripeAccountId: string,
  fetchFn: FetchFn = fetch
): Promise<ConnectAccountStatus> {
  let res: Response;
  try {
    res = await fetchFn(
      `${API_BASE}/accounts/${encodeURIComponent(stripeAccountId)}`,
      {
        headers: {
          Authorization: `Bearer ${platformSecret}`,
          'Stripe-Account': stripeAccountId,
        },
      }
    );
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Network error.' };
  }
  if (!res.ok) return { ok: false, error: `Stripe account lookup failed (HTTP ${res.status}).` };
  const payload = (await res.json()) as {
    charges_enabled?: boolean;
    payouts_enabled?: boolean;
    details_submitted?: boolean;
  };
  return {
    ok: true,
    chargesEnabled: payload.charges_enabled === true,
    payoutsEnabled: payload.payouts_enabled === true,
    detailsSubmitted: payload.details_submitted === true,
  };
}

/* ------------------------------------------------------------------ */
/* Checkout Sessions (card payments on the business's account)           */
/* ------------------------------------------------------------------ */

export interface CheckoutSessionOptions {
  platformSecret: string;
  stripeAccountId: string;
  amountCents: number; // integer cents, CAD
  currency?: string; // default "cad"
  productName: string; // e.g. "Invoice INV-001" / "Deposit — Quote Q-12"
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
  checkoutLocale?: 'en' | 'fr';
  metadata: Record<string, string>; // kind=invoice|quote_deposit, invoice_id/quote_id, business_id
  /**
   * Platform fee in cents, passed as payment_intent_data[application_fee_amount]
   * (supported for direct charges on the connected account). EveryJob always
   * passes 0 — we take no cut; card processing fees are between the business
   * and Stripe, shown transparently to the owner.
   */
  applicationFeeCents?: number;
}

export interface CheckoutSessionResult {
  ok: boolean;
  sessionId?: string;
  url?: string;
  error?: string;
}

/**
 * Create a Stripe Checkout Session on the CONNECTED account (direct charge —
 * money goes to the business, never through EveryJob).
 */
export async function createCheckoutSession(
  opts: CheckoutSessionOptions,
  fetchFn: FetchFn = fetch
): Promise<CheckoutSessionResult> {
  const form = new URLSearchParams();
  form.set('mode', 'payment');
  form.set('success_url', opts.successUrl);
  form.set('cancel_url', opts.cancelUrl);
  form.set('line_items[0][price_data][currency]', (opts.currency ?? 'cad').toLowerCase());
  form.set('line_items[0][price_data][unit_amount]', String(Math.round(opts.amountCents)));
  form.set('line_items[0][price_data][product_data][name]', opts.productName);
  form.set('line_items[0][quantity]', '1');
  form.set('locale', opts.checkoutLocale === 'fr' ? 'fr' : 'en');
  if (opts.customerEmail) form.set('customer_email', opts.customerEmail);
  for (const [k, v] of Object.entries(opts.metadata)) {
    form.set(`metadata[${k}]`, v);
    form.set(`payment_intent_data[metadata][${k}]`, v);
  }
  if (opts.applicationFeeCents !== undefined) {
    form.set(
      'payment_intent_data[application_fee_amount]',
      String(Math.max(0, Math.round(opts.applicationFeeCents)))
    );
  }

  let res: Response;
  try {
    res = await fetchFn(`${API_BASE}/checkout/sessions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${opts.platformSecret}`,
        'Stripe-Account': opts.stripeAccountId,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Network error.' };
  }
  let payload: { id?: string; url?: string; error?: { message?: string } } = {};
  try {
    payload = (await res.json()) as typeof payload;
  } catch {
    return { ok: false, error: `Stripe Checkout failed (HTTP ${res.status}).` };
  }
  if (!res.ok || !payload.id || !payload.url) {
    return { ok: false, error: payload.error?.message ?? `Stripe Checkout failed (HTTP ${res.status}).` };
  }
  return { ok: true, sessionId: payload.id, url: payload.url };
}

export interface CompletedPaymentInfo {
  ok: boolean;
  paymentIntentId?: string | null;
  receiptUrl?: string | null;
  amountCents?: number | null;
  customerEmail?: string | null;
  error?: string;
}

/**
 * After `checkout.session.completed`, pull the payment intent id + receipt
 * URL from the session (expanded payment_intent.charges).
 */
export async function retrieveCompletedPayment(
  platformSecret: string,
  stripeAccountId: string,
  sessionId: string,
  fetchFn: FetchFn = fetch
): Promise<CompletedPaymentInfo> {
  const url =
    `${API_BASE}/checkout/sessions/${encodeURIComponent(sessionId)}` +
    `?expand[]=payment_intent.charges`;
  let res: Response;
  try {
    res = await fetchFn(url, {
      headers: {
        Authorization: `Bearer ${platformSecret}`,
        'Stripe-Account': stripeAccountId,
      },
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Network error.' };
  }
  if (!res.ok) return { ok: false, error: `Stripe session lookup failed (HTTP ${res.status}).` };
  const s = (await res.json()) as {
    payment_intent?: { id?: string; charges?: { data?: Array<{ receipt_url?: string }> } } | string | null;
    amount_total?: number | null;
    customer_details?: { email?: string | null } | null;
  };
  const pi = typeof s.payment_intent === 'object' && s.payment_intent ? s.payment_intent : null;
  return {
    ok: true,
    paymentIntentId: pi?.id ?? (typeof s.payment_intent === 'string' ? s.payment_intent : null),
    receiptUrl: pi?.charges?.data?.[0]?.receipt_url ?? null,
    amountCents: s.amount_total ?? null,
    customerEmail: s.customer_details?.email ?? null,
  };
}

/* ------------------------------------------------------------------ */
/* Webhook signature verification (Stripe docs construction)             */
/* ------------------------------------------------------------------ */

export interface WebhookVerification {
  ok: boolean;
  error?: string;
}

/**
 * Verify a Stripe webhook signature per https://docs.stripe.com/webhooks/signature:
 * header looks like `t=1492774577,v1=<hex>,v0=<hex>`; the signed payload is
 * `${t}.${rawBody}`; HMAC-SHA256 with the endpoint secret; constant-time
 * compare against every v1 signature; reject stale timestamps.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  webhookSecret: string,
  toleranceSec = 300,
  nowSec: number = Math.floor(Date.now() / 1000)
): WebhookVerification {
  if (!signatureHeader) return { ok: false, error: 'Missing Stripe-Signature header.' };
  if (!webhookSecret) return { ok: false, error: 'Webhook secret not configured.' };

  let timestamp = 0;
  const signatures: string[] = [];
  for (const part of signatureHeader.split(',')) {
    const [k, v] = part.split('=');
    if (k === 't' && v) timestamp = Number(v);
    if (k === 'v1' && v) signatures.push(v);
  }
  if (!timestamp || signatures.length === 0) {
    return { ok: false, error: 'Malformed Stripe-Signature header.' };
  }
  if (Math.abs(nowSec - timestamp) > toleranceSec) {
    return { ok: false, error: 'Webhook timestamp outside tolerance.' };
  }

  const signedPayload = `${timestamp}.${rawBody}`;
  const expectedHex = createHmac('sha256', webhookSecret).update(signedPayload, 'utf8').digest('hex');
  const expected = Buffer.from(expectedHex, 'utf8');
  for (const sig of signatures) {
    const actual = Buffer.from(sig, 'utf8');
    if (actual.length === expected.length && timingSafeEqual(actual, expected)) {
      return { ok: true };
    }
  }
  return { ok: false, error: 'Signature mismatch.' };
}

/* ------------------------------------------------------------------ */
/* Small helpers                                                         */
/* ------------------------------------------------------------------ */

/** CAD dollars -> integer cents. */
export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

/**
 * Honest invoice status derivation after a payment is recorded: PAID only
 * when the paid total covers the invoice (1¢ tolerance for float
 * rounding); PARTIALLY PAID for any positive partial; UNPAID otherwise.
 * Pure — unit-testable; used by the Stripe webhook.
 */
export function deriveInvoiceStatus(total: number, paid: number): string {
  if (paid >= total - 0.009) return 'PAID';
  if (paid > 0) return 'PARTIALLY PAID';
  return 'UNPAID';
}

/* ------------------------------------------------------------------ */
/* Invoice checkout (owner-initiated "Collect payment" links)            */
/* ------------------------------------------------------------------ */

export interface InvoiceCheckoutInput {
  platformSecret: string;
  stripeAccountId: string;
  invoice: { id: string; number: string };
  business: { id: string; name: string; currency?: string | null };
  /** Amount to collect in integer cents — the caller passes the remaining balance. */
  amountCents: number;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
  checkoutLocale?: 'en' | 'fr';
}

/**
 * Build the Checkout Session options for an invoice payment link. Pure —
 * no network — so it is unit-testable. Direct charge on the business's
 * connected account; application_fee_amount is explicitly 0 because
 * EveryJob takes no platform fee.
 */
export function buildInvoiceCheckoutOptions(
  input: InvoiceCheckoutInput
): CheckoutSessionOptions {
  return {
    platformSecret: input.platformSecret,
    stripeAccountId: input.stripeAccountId,
    amountCents: Math.round(input.amountCents),
    currency: (input.business.currency || 'CAD').toLowerCase(),
    productName: `Invoice ${input.invoice.number} — ${input.business.name}`,
    successUrl: input.successUrl,
    cancelUrl: input.cancelUrl,
    customerEmail: input.customerEmail,
    checkoutLocale: input.checkoutLocale,
    applicationFeeCents: 0,
    metadata: {
      kind: 'invoice',
      invoice_id: input.invoice.id,
      business_id: input.business.id,
    },
  };
}

/**
 * Create the Stripe Checkout Session for an invoice payment link.
 * Thin wrapper over createCheckoutSession — same idempotency/metadata
 * contract the webhook expects (metadata.kind === 'invoice').
 */
export async function createInvoiceCheckout(
  input: InvoiceCheckoutInput,
  fetchFn: FetchFn = fetch
): Promise<CheckoutSessionResult> {
  return createCheckoutSession(buildInvoiceCheckoutOptions(input), fetchFn);
}
