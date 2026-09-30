import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  verifyWebhookSignature,
  retrieveCompletedPayment,
  deriveInvoiceStatus,
} from '@/lib/stripe';

const round2 = (n: number) => Math.round(n * 100) / 100;

interface StripeEventPayload {
  id: string;
  type: string;
  livemode?: boolean;
  account?: string; // connected account id for Connect events
  data?: { object?: Record<string, unknown> };
}

/**
 * Stripe webhook: checkout.session.completed → record the payment against the
 * invoice (or quote deposit), update statuses, notify the owner in-app.
 *
 * Security: the raw body is verified against STRIPE_WEBHOOK_SECRET before
 * anything is parsed. Idempotency: each Stripe event id is processed once
 * (StripeEvent unique key) and Payment.stripePaymentIntentId is unique, so
 * duplicate deliveries can never double-record money.
 */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const platformSecret = process.env.STRIPE_SECRET_KEY;
  if (!secret || !platformSecret) {
    return NextResponse.json({ error: 'Webhooks not configured.' }, { status: 500 });
  }

  const rawBody = await req.text();
  const verified = verifyWebhookSignature(rawBody, req.headers.get('stripe-signature'), secret);
  if (!verified.ok) {
    return NextResponse.json({ error: verified.error ?? 'Bad signature.' }, { status: 400 });
  }

  let event: StripeEventPayload;
  try {
    event = JSON.parse(rawBody) as StripeEventPayload;
  } catch {
    return NextResponse.json({ error: 'Bad payload.' }, { status: 400 });
  }
  if (!event.id || !event.type) return NextResponse.json({ received: true });

  const session = (event.data?.object ?? {}) as {
    id?: string;
    metadata?: Record<string, string>;
  };
  const businessId = session.metadata?.business_id;
  if (!businessId) return NextResponse.json({ received: true });

  // Idempotency first: claim this event before doing any work. The claim is
  // released (deleted) if the handler fails, so Stripe's redelivery retries
  // the work instead of being silently swallowed.
  try {
    await prisma.stripeEvent.create({
      data: {
        businessId,
        stripeEventId: event.id,
        type: event.type,
        livemode: event.livemode === true,
      },
    });
  } catch {
    // Unique violation → already seen.
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      await handleCheckoutCompleted(event, session, platformSecret);
    } else if (event.type === 'checkout.session.expired') {
      await handleCheckoutExpired(session);
    }
    await prisma.stripeEvent.update({
      where: { stripeEventId: event.id, businessId },
      data: { processedAt: new Date() },
    });
  } catch (err) {
    // Release the claim so the next Stripe redelivery re-processes this
    // event. Downstream idempotency keys (unique payment intent /
    // checkout-session lookups) make retries safe. Returning 500 tells
    // Stripe to retry instead of dropping the payment.
    console.error('[stripe-webhook] handler error', event.id, err instanceof Error ? err.message : err);
    await prisma.stripeEvent
      .delete({ where: { stripeEventId: event.id } })
      .catch(() => undefined);
    return NextResponse.json({ error: 'Handler failed; Stripe will retry.' }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}

/** The connected account on the event must match the business's connection. */
async function assertAccount(businessId: string, eventAccount: string | undefined) {
  if (!eventAccount) return true; // platform-mode events (tests) — metadata is authoritative
  const conn = await prisma.stripeConnection.findUnique({
    where: { businessId },
    select: { stripeAccountId: true },
  });
  return conn?.stripeAccountId === eventAccount;
}

async function handleCheckoutCompleted(
  event: StripeEventPayload,
  session: { id?: string; metadata?: Record<string, string> },
  platformSecret: string
) {
  const metadata = session.metadata ?? {};
  if (metadata.kind !== 'invoice' && metadata.kind !== 'quote_deposit') return;
  const businessId = metadata.business_id;
  if (!businessId) return;
  if (!(await assertAccount(businessId, event.account))) return;

  const conn = await prisma.stripeConnection.findUnique({ where: { businessId } });
  if (!conn || !session.id) return;

  const info = await retrieveCompletedPayment(
    platformSecret,
    conn.stripeAccountId,
    session.id
  );
  if (!info.ok) return;

  if (metadata.kind === 'invoice') {
    const invoiceId = metadata.invoice_id;
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, businessId },
      include: {
        payments: { where: { status: 'COMPLETED' }, select: { amount: true } },
        customer: { select: { name: true } },
      },
    });
    if (!invoice) return;

    // Belt-and-suspenders idempotency: the unique payment intent is the
    // primary guard; the checkout session id covers the edge case where
    // Stripe returns no payment intent id.
    if (session.id) {
      const existing = await prisma.payment.findFirst({
        where: { stripeCheckoutSessionId: session.id, invoiceId: invoice.id, businessId: invoice.businessId },
        select: { id: true },
      });
      if (existing) return;
    }

    // Unique paymentIntentId → duplicate deliveries can't double-record.
    let paymentId: string | null = null;
    try {
      const payment = await prisma.payment.create({
        data: {
          amount: round2((info.amountCents ?? 0) / 100),
          provider: 'STRIPE',
          status: 'COMPLETED',
          stripePaymentIntentId: info.paymentIntentId ?? undefined,
          stripeCheckoutSessionId: session.id,
          receiptUrl: info.receiptUrl ?? undefined,
          invoiceId: invoice.id,
          businessId: invoice.businessId,
        },
      });
      paymentId = payment.id;
    } catch {
      return; // already recorded (unique payment intent)
    }

    const paid = round2(
      invoice.payments.reduce((s, p) => s + p.amount, 0) +
        round2((info.amountCents ?? 0) / 100)
    );
    const status = deriveInvoiceStatus(invoice.total, paid);
    await prisma.invoice.update({
      where: { id: invoice.id, businessId: invoice.businessId },
      data: {
        status,
        // paidAt marks FULL payment honestly: set only when the invoice just
        // became PAID and has no timestamp yet. Partials keep it null; an
        // already-paid invoice keeps its original timestamp.
        ...(status === 'PAID' && !invoice.paidAt ? { paidAt: new Date() } : {}),
        // First completed payment intent wins as the invoice-level
        // idempotency reference.
        ...(!invoice.stripePaymentIntentId && info.paymentIntentId
          ? { stripePaymentIntentId: info.paymentIntentId }
          : {}),
      },
    });

    // In-app receipt notice to the owner.
    if (paymentId) {
      await prisma.notification
        .create({
          data: {
            businessId,
            type: 'payment_recorded',
            dedupeKey: `payment_recorded:${paymentId}`,
            href: `/invoices/${invoice.id}`,
            data: JSON.stringify({
              amount: String(round2((info.amountCents ?? 0) / 100)),
              number: invoice.number,
              customer: invoice.customer.name,
            }),
          },
        })
        .catch(() => undefined);
      // Outgoing webhooks for the online payment. Best-effort.
      try {
        const { emitWebhookEvent } = await import('@/lib/webhooks');
        await emitWebhookEvent(businessId, 'payment.recorded', {
          payment_id: paymentId,
          invoice_id: invoice.id,
          amount: round2((info.amountCents ?? 0) / 100),
          provider: 'STRIPE',
        });
        if (status === 'PAID') {
          await emitWebhookEvent(businessId, 'invoice.paid', {
            invoice_id: invoice.id,
            number: invoice.number,
            total: invoice.total,
          });
        }
      } catch (err) {
        console.error('[stripe-webhook] payment webhooks failed', err);
      }
      // Push notification: money in. Best-effort, bilingual copy.
      try {
        const { pushToBusiness } = await import('@/lib/webpush');
        await pushToBusiness(businessId, {
          title: 'Payment received · Paiement reçu',
          body: `${round2((info.amountCents ?? 0) / 100).toFixed(2)} CAD — ${invoice.number}`,
          url: `/invoices/${invoice.id}`,
          tag: `payment-${paymentId}`,
        });
      } catch (err) {
        console.error('[stripe-webhook] payment push failed', err);
      }
    }
    return;
  }

  // Quote deposit.
  const depositId = metadata.quote_deposit_id;
  if (!depositId) return;
  if (session.id) {
    const already = await prisma.quoteDeposit.findFirst({
      where: { stripeCheckoutSessionId: session.id, businessId, status: 'COMPLETED' },
      select: { id: true },
    });
    if (already) return;
  }
  const deposit = await prisma.quoteDeposit.findFirst({
    where: { id: depositId, businessId, status: 'PENDING' },
    include: { quote: { select: { number: true, customer: { select: { name: true } } } } },
  });
  if (!deposit) return;
  try {
    await prisma.quoteDeposit.update({
      where: { id: deposit.id, businessId },
      data: {
        status: 'COMPLETED',
        stripePaymentIntentId: info.paymentIntentId ?? undefined,
        stripeCheckoutSessionId: session.id,
        receiptUrl: info.receiptUrl ?? undefined,
      },
    });
  } catch {
    return; // unique payment intent → already handled
  }
  await prisma.notification
    .create({
      data: {
        businessId,
        type: 'payment_recorded',
        dedupeKey: `quote_deposit:${deposit.id}`,
        href: `/quotes/${deposit.quoteId}`,
        data: JSON.stringify({
          amount: String(deposit.amount),
          number: `deposit ${deposit.quote.number}`,
          customer: deposit.quote.customer.name,
        }),
      },
    })
    .catch(() => undefined);
}

async function handleCheckoutExpired(session: {
  id?: string;
  metadata?: Record<string, string>;
}) {
  const metadata = session.metadata ?? {};
  if (metadata.kind !== 'quote_deposit' || !metadata.quote_deposit_id) return;
  await prisma.quoteDeposit.updateMany({
    // business_id was minted by us into the Stripe metadata at checkout
    // creation; the webhook signature is verified at route entry, so a
    // forged metadata value cannot reach this handler.
    where: { id: metadata.quote_deposit_id, businessId: metadata.business_id, status: 'PENDING' },
    data: { status: 'FAILED' },
  });
}
