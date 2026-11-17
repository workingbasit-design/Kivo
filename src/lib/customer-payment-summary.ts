import type { PrismaClient } from '@prisma/client';

/**
 * Customer payment summary (2026-11-17, Customers redesign).
 *
 * One source of truth for a customer's payment position: outstanding
 * balance across unpaid invoices, the unpaid invoices themselves, the
 * last completed payment, and lifetime paid total. Shared by the
 * invoice-form auto-fetch endpoint
 * (GET /api/customers/[id]/payment-summary) and the customer detail page,
 * so picking a customer anywhere shows the same numbers. Tenant-scoped by
 * businessId on every query; the caller must verify the customer belongs
 * to the business first (the route does; the detail page loads the
 * customer with a businessId-scoped query).
 *
 * Amounts are integer cents (BigInt in the DB); format with formatCents().
 */
export type PaymentSummaryInvoice = {
  id: string;
  number: string;
  totalCents: number;
  balanceCents: number;
  dueAt: string | null;
};

export type PaymentSummary = {
  customerId: string;
  customerName: string;
  balanceDueCents: number;
  unpaidCount: number;
  unpaid: PaymentSummaryInvoice[];
  lastPayment: {
    amountCents: number;
    createdAt: string;
    provider: string | null;
  } | null;
  totalPaidCents: number;
};

export async function getCustomerPaymentSummary(
  db: Pick<PrismaClient, 'invoice' | 'payment'>,
  businessId: string,
  customerId: string,
  customerName: string,
): Promise<PaymentSummary> {
  const unpaid = await db.invoice.findMany({
    where: {
      businessId,
      customerId,
      voidedAt: null,
      status: { in: ['UNPAID', 'PARTIALLY PAID'] },
    },
    select: { id: true, number: true, totalCents: true, dueAt: true },
    orderBy: { date: 'asc' },
  });
  const unpaidIds = unpaid.map((i) => i.id);
  const paidByInvoice = new Map<string, number>();
  if (unpaidIds.length > 0) {
    const payments = await db.payment.findMany({
      where: {
        businessId,
        invoiceId: { in: unpaidIds },
        status: 'COMPLETED',
        voidedAt: null,
      },
      select: { invoiceId: true, amountCents: true },
    });
    for (const p of payments) {
      paidByInvoice.set(
        p.invoiceId,
        (paidByInvoice.get(p.invoiceId) ?? 0) + Number(p.amountCents),
      );
    }
  }
  const unpaidWithBalance: PaymentSummaryInvoice[] = unpaid
    .map((i) => ({
      id: i.id,
      number: i.number,
      totalCents: Number(i.totalCents),
      balanceCents: Math.max(
        0,
        Number(i.totalCents) - (paidByInvoice.get(i.id) ?? 0),
      ),
      dueAt: i.dueAt ? i.dueAt.toISOString() : null,
    }))
    .filter((i) => i.balanceCents > 0);
  const balanceDueCents = unpaidWithBalance.reduce(
    (s, i) => s + i.balanceCents,
    0,
  );

  const lastPayment = await db.payment.findFirst({
    where: {
      businessId,
      status: 'COMPLETED',
      voidedAt: null,
      invoice: { customerId },
    },
    select: { amountCents: true, createdAt: true, provider: true },
    orderBy: { createdAt: 'desc' },
  });
  const totalPaid = await db.payment.aggregate({
    _sum: { amountCents: true },
    where: {
      businessId,
      status: 'COMPLETED',
      voidedAt: null,
      invoice: { customerId },
    },
  });

  return {
    customerId,
    customerName,
    balanceDueCents,
    unpaidCount: unpaidWithBalance.length,
    unpaid: unpaidWithBalance,
    lastPayment: lastPayment
      ? {
          amountCents: Number(lastPayment.amountCents),
          createdAt: lastPayment.createdAt.toISOString(),
          provider: lastPayment.provider,
        }
      : null,
    totalPaidCents: Number(totalPaid._sum.amountCents ?? 0),
  };
}
