'use server';

import { getCustomerSession } from '@/lib/customer-auth';
import { prisma } from '@/lib/prisma';

export async function toggleSavePro(businessId: string) {
  const session = await getCustomerSession();
  if (!session) throw new Error('Not logged in');

  const existing = await prisma.savedPro.findUnique({
    where: { customerId_businessId: { customerId: session.customer.id, businessId } },
  });

  if (existing) {
    await prisma.savedPro.delete({ where: { id: existing.id } });
    return { saved: false };
  }

  await prisma.savedPro.create({
    data: { customerId: session.customer.id, businessId },
  });
  return { saved: true };
}
