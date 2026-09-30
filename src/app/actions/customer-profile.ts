'use server';

import { redirect } from 'next/navigation';
import { getCustomerSession } from '@/lib/customer-auth';
import { prisma } from '@/lib/prisma';

export async function updateCustomerProfile(formData: FormData) {
  const session = await getCustomerSession();
  if (!session) redirect('/customer/login');

  const name = String(formData.get('name') || '').trim();
  const phone = String(formData.get('phone') || '').trim();
  const city = String(formData.get('city') || '').trim();

  if (!name) return;

  await prisma.customerUser.update({
    where: { id: session.customer.id },
    data: { name, phone: phone || null, city: city || null },
  });

  redirect('/customer/profile');
}
