import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rate-limit';
import { checkSameOrigin, originForbidden } from '@/lib/csrf';
import {
  quickbooksSandbox,
  resolveServiceItem,
  syncCustomer,
  syncInvoice,
  syncPayment,
  type QBSyncDb,
  type SyncCallBase,
  type SyncOutcome,
} from '@/lib/quickbooks';

/** Bound each entity type per run so a sync can't blow the serverless timeout. */
const PER_TYPE_LIMIT = 100;

const SYNC_LIMIT = { limit: 5, windowMs: 60_000 }; // 5 manual syncs / minute / business

type EntityType = 'customer' | 'invoice' | 'payment';

function summarize(outcomes: SyncOutcome[]) {
  const s = { synced: 0, failed: 0, skipped: 0 };
  for (const o of outcomes) s[o.status] += 1;
  return s;
}

/**
 * POST /api/integrations/quickbooks/sync — push customers, open invoices and
 * completed payments to QuickBooks. Every entity produces exactly one
 * QuickBooksSyncLog row (synced | failed | skipped + reason), and the
 * response carries the per-entity summary — nothing vanishes quietly.
 */
export async function POST(req: Request) {
  const session = await getSession();
  const businessId = session?.user?.businessId;
  if (!businessId) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }
  if (!checkSameOrigin(req)) return originForbidden();

  const rl = rateLimit(`qb-sync:${businessId}`, SYNC_LIMIT);
  if (!rl.ok) {
    return NextResponse.json({ error: 'Sync already running or run too recently — please wait a moment.' }, { status: 429 });
  }

  if (!process.env.QUICKBOOKS_CLIENT_ID || !process.env.QUICKBOOKS_CLIENT_SECRET) {
    return NextResponse.json({ error: 'QuickBooks is not configured.' }, { status: 400 });
  }

  const conn = await prisma.quickBooksConnection.findUnique({ where: { businessId } });
  if (!conn) {
    return NextResponse.json({ error: 'QuickBooks is not connected.' }, { status: 400 });
  }

  const db = prisma as unknown as QBSyncDb;
  const base: SyncCallBase = {
    conn,
    businessId,
    creds: {
      clientId: process.env.QUICKBOOKS_CLIENT_ID,
      clientSecret: process.env.QUICKBOOKS_CLIENT_SECRET,
      sandbox: quickbooksSandbox(),
    },
    db,
  };

  const items: Array<SyncOutcome & { label: string }> = [];
  try {
    // Entities already synced are excluded up-front so reruns stay fast and
    // the log only records genuine outcomes (the lib still guards idempotency).
    const syncedRows = await prisma.quickBooksSyncLog.findMany({
      where: { businessId, status: 'synced' },
      select: { entityType: true, entityId: true, qbId: true },
    });
    const syncedByType = new Map<EntityType, Map<string, string | null>>();
    for (const r of syncedRows) {
      const t = r.entityType as EntityType;
      if (!syncedByType.has(t)) syncedByType.set(t, new Map());
      syncedByType.get(t)!.set(r.entityId, r.qbId);
    }
    const notSynced = (t: EntityType, id: string) => !syncedByType.get(t)?.has(id);
    const knownQbId = (t: EntityType, id: string): string | null =>
      syncedByType.get(t)?.get(id) ?? null;

    // 1. Customers first — invoices and payments need their QuickBooks ids.
    const customers = (
      await prisma.customer.findMany({
        where: { businessId },
        orderBy: { createdAt: 'asc' },
        take: PER_TYPE_LIMIT * 2,
        select: { id: true, name: true, email: true, phone: true, address: true, province: true, postalCode: true },
      })
    ).filter((c) => notSynced('customer', c.id)).slice(0, PER_TYPE_LIMIT);

    const customerQbIds = new Map<string, string | null>();
    for (const [id, qbId] of syncedByType.get('customer') ?? []) customerQbIds.set(id, qbId);
    for (const c of customers) {
      const outcome = await syncCustomer(base, c);
      items.push({ ...outcome, label: c.name });
      if (outcome.status === 'synced' && outcome.qbId) customerQbIds.set(c.id, outcome.qbId);
    }

    // 2. Open invoices (unpaid / partially paid), oldest first.
    const itemRef = await resolveServiceItem(base);
    const invoices = (
      await prisma.invoice.findMany({
        where: { businessId, status: { in: ['UNPAID', 'PARTIALLY_PAID'] } },
        orderBy: { date: 'asc' },
        take: PER_TYPE_LIMIT * 2,
        include: {
          lineItems: { orderBy: { position: 'asc' }, select: { description: true, qty: true, unitPrice: true } },
        },
      })
    ).filter((i) => notSynced('invoice', i.id)).slice(0, PER_TYPE_LIMIT);

    const invoiceQbIds = new Map<string, string | null>();
    for (const [id, qbId] of syncedByType.get('invoice') ?? []) invoiceQbIds.set(id, qbId);
    for (const inv of invoices) {
      const outcome = await syncInvoice(
        base,
        {
          id: inv.id,
          number: inv.number,
          date: inv.date,
          taxAmount: inv.taxAmount,
          total: inv.total,
          status: inv.status,
          notes: inv.notes,
          customerId: inv.customerId,
        },
        inv.lineItems,
        customerQbIds.get(inv.customerId) ?? knownQbId('customer', inv.customerId),
        itemRef
      );
      items.push({ ...outcome, label: `Invoice ${inv.number}` });
      if (outcome.status === 'synced' && outcome.qbId) invoiceQbIds.set(inv.id, outcome.qbId);
    }

    // 3. Completed payments not yet recorded in QuickBooks.
    const payments = (
      await prisma.payment.findMany({
        where: { status: 'COMPLETED', businessId },
        orderBy: { createdAt: 'asc' },
        take: PER_TYPE_LIMIT * 2,
        select: {
          id: true, amount: true, provider: true, transactionId: true,
          invoiceId: true, createdAt: true, status: true,
          invoice: { select: { customerId: true } },
        },
      })
    ).filter((p) => notSynced('payment', p.id)).slice(0, PER_TYPE_LIMIT);

    for (const p of payments) {
      const qbCustomerId = customerQbIds.get(p.invoice.customerId) ?? knownQbId('customer', p.invoice.customerId);
      const qbInvoiceId = invoiceQbIds.get(p.invoiceId) ?? knownQbId('invoice', p.invoiceId);
      const outcome = await syncPayment(base, p, qbCustomerId, qbInvoiceId);
      items.push({ ...outcome, label: `Payment $${p.amount.toFixed(2)}` });
    }

    await prisma.quickBooksConnection.update({
      where: { businessId },
      data: { lastSyncAt: new Date() },
    });

    const byType = (t: EntityType) => items.filter((i) => i.entityType === t);
    return NextResponse.json({
      ok: true,
      summary: {
        customer: summarize(byType('customer')),
        invoice: summarize(byType('invoice')),
        payment: summarize(byType('payment')),
      },
      items,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Sync failed unexpectedly.' },
      { status: 500 }
    );
  }
}
