import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { getActiveMembershipForUser } from '@/lib/membership';
import { getCustomerPaymentSummary } from '@/lib/customer-payment-summary';

/**
 * Customer payment summary for the invoice form (2026-10-28): picking a
 * customer auto-fetches their payment position — outstanding balance,
 * unpaid invoices, last payment — so the pro writes the new invoice
 * with the customer's money history in view. Tenant-scoped; the
 * customer must belong to the caller's business. The numbers come from
 * the shared getCustomerPaymentSummary helper (also used by the
 * customer detail page), so both surfaces can never disagree.
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

  const summary = await getCustomerPaymentSummary(
    prisma,
    businessId,
    customer.id,
    customer.name,
  );

  return NextResponse.json(summary, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
