'use server';

import { redirect } from 'next/navigation';
import { getCustomerSession } from '@/lib/customer-auth';
import { prisma } from '@/lib/prisma';
import { rateLimit, QUOTE_REQUEST_LIMIT } from '@/lib/rate-limit';
import { leadExpiryDate } from '@/lib/lead-expiry';

export async function sendQuoteRequest(_prev: unknown, formData: FormData) {
  const session = await getCustomerSession();
  if (!session) redirect('/customer/login');

  // Rate limit: quote requests are spam-prone; per logged-in customer.
  const rl = rateLimit(`customer-quote-request:${session.customer.id}`, QUOTE_REQUEST_LIMIT);
  if (!rl.ok) {
    return { error: 'You have sent several requests recently. Please wait a bit before sending more.' };
  }

  const businessId = String(formData.get('businessId') || '');
  const service = String(formData.get('service') || '').trim();
  const description = String(formData.get('description') || '').trim();

  if (!businessId) return { error: 'Business not found.' };
  if (!service) return { error: 'Please select or enter a service.' };
  if (!description) return { error: 'Please describe what you need.' };

  // Consent gate: quote requests may only target opted-in, VERIFIED
  // directory businesses. The businessId comes from the client and must
  // never be trusted on its own — without this check a tampered form could
  // file requests against businesses that never consented to the directory.
  const business = await prisma.business.findFirst({
    where: { id: businessId, directoryOptIn: true, directoryVerifiedAt: { not: null } },
    select: { id: true, name: true },
  });
  if (!business) return { error: 'Business not found.' };

  const customer = session.customer;

  // Double-submit guard: an identical request from this customer to this
  // business in the last 2 minutes resolves to the original (no duplicates
  // from double-taps, refreshes, or retried network calls).
  const recent = await prisma.quoteRequest.findFirst({
    where: {
      customerId: customer.id,
      businessId: business.id,
      service,
      description,
      createdAt: { gte: new Date(Date.now() - 2 * 60 * 1000) },
    },
    select: { id: true },
    orderBy: { createdAt: 'desc' },
  });
  if (recent) redirect(`/customer/requests/${recent.id}`);

  // One transaction: the customer's quote request (+ opening message) and
  // the business's lead draft are created together or not at all. A lead
  // write failure no longer fails silently while the customer sees success.
  const quoteRequest = await prisma.$transaction(async (tx) => {
    const qr = await tx.quoteRequest.create({
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

    await tx.lead.create({
      data: {
        name: customer.name || customer.email,
        phone: customer.phone,
        email: customer.email,
        details: `[${service}] ${description}`,
        status: 'NEW',
        source: 'Directory',
        businessId: business.id,
        expiresAt: leadExpiryDate(),
      },
    });

    return qr;
  });

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
