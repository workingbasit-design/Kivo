'use server';

import { redirect } from 'next/navigation';
import { getCustomerSession } from '@/lib/customer-auth';
import { prisma } from '@/lib/prisma';

export async function sendQuoteRequest(_prev: unknown, formData: FormData) {
  const session = await getCustomerSession();
  if (!session) redirect('/customer/login');

  const businessId = String(formData.get('businessId') || '');
  const service = String(formData.get('service') || '').trim();
  const description = String(formData.get('description') || '').trim();

  if (!businessId) return { error: 'Business not found.' };
  if (!service) return { error: 'Please select or enter a service.' };
  if (!description) return { error: 'Please describe what you need.' };

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, name: true },
  });
  if (!business) return { error: 'Business not found.' };

  const customer = session.customer;

  // Create the quote request (customer's view)
  const quoteRequest = await prisma.quoteRequest.create({
    data: {
      customerId: customer.id,
      businessId: business.id,
      service,
      description,
      status: 'sent',
      messages: {
        create: {
          senderType: 'customer',
          body: description,
        },
      },
    },
  });

  // Create a lead for the business (pro's view)
  await prisma.lead
    .create({
      data: {
        name: customer.name || customer.email,
        phone: customer.phone,
        email: customer.email,
        details: `[${service}] ${description}`,
        status: 'NEW',
        source: 'Directory',
        businessId: business.id,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    })
    .catch(() => {});

  redirect(`/customer/requests/${quoteRequest.id}`);
}

export async function sendCustomerMessage(formData: FormData) {
  const session = await getCustomerSession();
  if (!session) redirect('/customer/login');

  const requestId = String(formData.get('requestId') || '');
  const body = String(formData.get('body') || '').trim();
  if (!requestId || !body) return;

  const req = await prisma.quoteRequest.findFirst({
    where: { id: requestId, customerId: session.customer.id },
  });
  if (!req) return;

  await prisma.quoteMessage.create({
    data: { quoteRequestId: requestId, senderType: 'customer', body },
  });

  await prisma.quoteRequest.updateMany({
    where: { id: requestId, customerId: session.customer.id },
    data: { updatedAt: new Date() },
  });

  redirect(`/customer/requests/${requestId}`);
}
