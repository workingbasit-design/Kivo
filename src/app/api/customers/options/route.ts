import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { getActiveMembershipForUser } from '@/lib/membership';

/**
 * Fresh tenant-scoped customer id+name list for comboboxes.
 * no-store so a customer created moments ago always shows up -
 * never rely on a possibly-stale server-component prop alone.
 */
export async function GET() {
  const session = await getSession();
  const membership = session ? await getActiveMembershipForUser(session.user.id) : null;
  const businessId = membership?.businessId;
  if (!businessId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const customers = await prisma.customer.findMany({
    where: { businessId },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
  // Service properties for the job form's property picker: tenant-scoped,
  // filtered client-side by the selected customer.
  const properties = await prisma.customerProperty.findMany({
    where: { businessId },
    select: { id: true, customerId: true, label: true, address: true, province: true },
    orderBy: [{ label: 'asc' }],
  });
  // 2026-11-08 deep test: completed jobs with no LINKED invoice, for the
  // invoice form's "Link to job" picker. A standalone invoice created for
  // such a job used to stay unlinked, so batch invoicing billed the same
  // work a second time (the batch list only excludes jobs with a linked
  // invoice). Tenant-scoped, filtered client-side by the selected customer.
  const jobs = await prisma.job.findMany({
    where: { businessId, status: 'COMPLETED', invoices: { none: {} } },
    // No priceCents here: it is a BigInt and would break JSON serialization.
    select: { id: true, customerId: true, title: true, date: true },
    orderBy: [{ date: 'desc' }],
  });
  return NextResponse.json(
    { customers, properties, jobs },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
