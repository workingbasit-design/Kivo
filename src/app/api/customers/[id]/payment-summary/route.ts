import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { getActiveMembershipForUser } from '@/lib/membership';

/**
 * Customer payment summary for the invoice form (2026-10-28): picking a
 * customer auto-fetches their payment position — outstanding balance,
 * unpaid invoices, last payment — so the pro writes the new invoice
 * with the customer's money history in view. Tenant-scoped; the
 * customer must belong to the caller's business.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  const membership = session ? await getActiveMembershipForUser(session.user.id) : null;
  const businessId = membership?.businessId;
  if (!businessId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id: customerId } = await params;
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, businessId },
    select: { id: true, name: true },
  });
  if (!customer) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const unpaid = await prisma.invoice.findMany({
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
    const payments = await prisma.payment.findMany({
      where: {
        businessId,
        invoiceId: { in: unpaidIds },
        status: 'COMPLETED',
        voidedAt: null,
      },
      select: { invoiceId: true, amountCents: true },
    });
    for (const p of payments) {
      paidByInvoice.set(p.invoiceId, (paidByInvoice.get(p.invoiceId) ?? 0) + Number(p.amountCents));
    }
  }
  const unpaidWithBalance = unpaid
    .map((i) => ({
      id: i.id,
      number: i.number,
      totalCents: Number(i.totalCents),
      balanceCents: Math.max(0, Number(i.totalCents) - (paidByInvoice.get(i.id) ?? 0)),
      dueAt: i.dueAt ? i.dueAt.toISOString() : null,
    }))
    .filter((i) => i.balanceCents > 0);
  const balanceDueCents = unpaidWithBalance.reduce((s, i) => s + i.balanceCents, 0);

  const lastPayment = await prisma.payment.findFirst({
    where: {
      businessId,
      status: 'COMPLETED',
      voidedAt: null,
      invoice: { customerId },
    },
    select: { amountCents: true, createdAt: true, provider: true },
    orderBy: { createdAt: 'desc' },
  });
  const totalPaid = await prisma.payment.aggregate({
    _sum: { amountCents: true },
    where: {
      businessId,
      status: 'COMPLETED',
      voidedAt: null,
      invoice: { customerId },
    },
  });

  return NextResponse.json(
    {
      customerId: customer.id,
      customerName: customer.name,
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
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
