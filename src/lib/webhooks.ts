/**
 * Outgoing webhooks (Zapier / Make compatible).
 *
 * Event catalog, HMAC-SHA256 payload signing, delivery enqueueing, and a
 * retry dispatcher with exponential backoff. Receivers verify the
 * `X-EveryJob-Signature` header against the endpoint secret — the same
 * pattern Stripe/SendGrid use, which is why Zapier's "Webhooks by Zapier"
 * Catch Hook and Make's Custom Webhook modules accept it with a filter step.
 *
 * Signing/verification are pure (node:crypto only) and run under plain
 * node:test with no network. Enqueue + dispatch touch Prisma.
 *
 * The retry dispatcher is NOT wired to a cron by this module — add one line
 * to the cron entry point:
 *
 *   // src/app/api/cron/workflows/route.ts, inside GET after the workflow loop:
 *   const { dispatchWebhookRetries } = await import('@/lib/webhooks');
 *   const webhookStats = await dispatchWebhookRetries();
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { prisma } from '@/lib/prisma';

/** The full event catalog EveryJob can emit. Add new events here. */
export const WEBHOOK_EVENTS = [
  'job.created',
  'job.completed',
  'invoice.created',
  'invoice.paid',
  'customer.created',
  'payment.recorded',
] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

/** Header carrying the HMAC-SHA256 hex signature of the raw payload. */
export const WEBHOOK_SIGNATURE_HEADER = 'X-EveryJob-Signature';
/** Header naming the event (also inside the JSON body). */
export const WEBHOOK_EVENT_HEADER = 'X-EveryJob-Event';
/** Header with the delivery id — receivers use it for idempotency. */
export const WEBHOOK_DELIVERY_HEADER = 'X-EveryJob-Delivery';

/**
 * Sign the exact raw payload bytes with the endpoint secret. Pure.
 * Receivers recompute this over the raw request body.
 */
export function signWebhookPayload(secret: string, rawBody: string): string {
  return createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
}

/**
 * Constant-time signature comparison. Pure. Documented so receiver
 * implementers (and the Zapier filter step) can mirror it.
 */
export function verifyWebhookSignature(
  secret: string,
  rawBody: string,
  signature: string | null | undefined
): boolean {
  if (!signature) return false;
  const expected = signWebhookPayload(secret, rawBody);
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Generate a per-endpoint signing secret. Pure. */
export function generateWebhookSecret(): string {
  return randomBytes(24).toString('base64url');
}

export type WebhookPayload = {
  id: string; // delivery id — use for idempotency on the receiver side
  event: WebhookEvent;
  business_id: string;
  occurred_at: string; // ISO timestamp
  data: Record<string, unknown>;
};

function parseSubscribedEvents(raw: string): string[] {
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * Enqueue one delivery per active endpoint subscribed to `event`.
 * Returns the number of deliveries enqueued. Never throws — webhook
 * fan-out must never fail the business operation that triggered it.
 */
export async function emitWebhookEvent(
  businessId: string,
  event: WebhookEvent,
  data: Record<string, unknown>
): Promise<number> {
  try {
    const endpoints = await prisma.webhookEndpoint.findMany({
      where: { businessId, active: true },
      select: { id: true, events: true },
    });
    const targets = endpoints.filter((e) => {
      const evts = parseSubscribedEvents(e.events);
      return evts.includes(event) || evts.includes('*');
    });
    if (!targets.length) return 0;
    const occurredAt = new Date().toISOString();
    for (const t of targets) {
      const delivery = await prisma.webhookDelivery.create({
        data: {
          endpointId: t.id,
          event,
          // Payload id is the delivery id; injected after create.
          payload: JSON.stringify({
            event,
            business_id: businessId,
            occurred_at: occurredAt,
            data,
          }),
          status: 'pending',
        },
        select: { id: true },
      });
      const payload: WebhookPayload = {
        id: delivery.id,
        event,
        business_id: businessId,
        occurred_at: occurredAt,
        data,
      };
      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: { payload: JSON.stringify(payload) },
      });
    }
    return targets.length;
  } catch {
    return 0;
  }
}

/** Backoff between attempts; after the last one the delivery is failed. */
export const WEBHOOK_RETRY_DELAYS_MS = [
  60_000, // 1 min
  5 * 60_000, // 5 min
  30 * 60_000, // 30 min
  2 * 3_600_000, // 2 h
  12 * 3_600_000, // 12 h
];
const DELIVERY_TIMEOUT_MS = 15_000;

async function postWithTimeout(
  url: string,
  init: RequestInit,
  ms: number
): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

/**
 * Deliver due webhook deliveries (pending, nextRetry elapsed), with
 * exponential backoff. Bounded batch per run so a cron tick stays fast.
 * A delivery counts as successful on any 2xx response.
 */
export async function dispatchWebhookRetries(
  limit = 50
): Promise<{ attempted: number; delivered: number; failed: number }> {
  const now = new Date();
  const due = await prisma.webhookDelivery.findMany({
    where: {
      status: 'pending',
      OR: [{ nextRetry: null }, { nextRetry: { lte: now } }],
    },
    include: {
      endpoint: { select: { url: true, secret: true, active: true } },
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });

  let attempted = 0;
  let delivered = 0;
  let failed = 0;

  for (const d of due) {
    if (!d.endpoint.active) {
      await prisma.webhookDelivery.update({
        where: { id: d.id },
        data: { status: 'failed', lastError: 'Endpoint deactivated.' },
      });
      failed++;
      continue;
    }
    attempted++;
    const signature = signWebhookPayload(d.endpoint.secret, d.payload);
    try {
      const res = await postWithTimeout(
        d.endpoint.url,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            [WEBHOOK_SIGNATURE_HEADER]: signature,
            [WEBHOOK_EVENT_HEADER]: d.event,
            [WEBHOOK_DELIVERY_HEADER]: d.id,
            'User-Agent': 'EveryJob-Webhooks/1.0',
          },
          body: d.payload,
        },
        DELIVERY_TIMEOUT_MS
      );
      if (!res.ok) throw new Error(`Receiver returned HTTP ${res.status}`);
      await prisma.webhookDelivery.update({
        where: { id: d.id },
        data: { status: 'delivered', attempts: d.attempts + 1, lastError: null },
      });
      delivered++;
    } catch (err) {
      const attempts = d.attempts + 1;
      const msg = (err instanceof Error ? err.message : 'Network error').slice(0, 500);
      if (attempts > WEBHOOK_RETRY_DELAYS_MS.length) {
        await prisma.webhookDelivery.update({
          where: { id: d.id },
          data: { status: 'failed', attempts, lastError: msg },
        });
        failed++;
      } else {
        await prisma.webhookDelivery.update({
          where: { id: d.id },
          data: {
            status: 'pending',
            attempts,
            lastError: msg,
            nextRetry: new Date(Date.now() + WEBHOOK_RETRY_DELAYS_MS[attempts - 1]),
          },
        });
      }
    }
  }

  return { attempted, delivered, failed };
}
