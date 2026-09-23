import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

/**
 * Fresh tenant-scoped customer id+name list for comboboxes.
 * no-store so a customer created moments ago always shows up —
 * never rely on a possibly-stale server-component prop alone.
 */
export async function GET() {
  const session = await getSession();
  const businessId = session?.user?.businessId;
  if (!businessId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const customers = await prisma.customer.findMany({
    where: { businessId },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
  return NextResponse.json(
    { customers },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
