import { notFound, redirect } from 'next/navigation';
import { requireCustomerAuth } from '@/lib/customer-auth';
import { prisma } from '@/lib/prisma';
import { getLocale } from '@/lib/i18n/server';
import CustomerQuoteForm from './form';

/**
 * Request a quote from a specific pro.
 * URL: /customer/request/[slug] where slug is the business booking page slug.
 */
export default async function CustomerQuoteRequestPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const session = await requireCustomerAuth();
  const { slug } = await params;

  const business = await prisma.business.findFirst({
    where: {
      directoryOptIn: true,
      directoryVerifiedAt: { not: null },
      bookingPage: { slug },
    },
    select: {
      id: true,
      name: true,
      logoUrl: true,
      services: { select: { name: true }, orderBy: { name: 'asc' }, take: 10 },
    },
  });

  if (!business) notFound();
  const locale = await getLocale();

  return (
    <CustomerQuoteForm
      businessId={business.id}
      businessName={business.name}
      logoUrl={business.logoUrl}
      services={business.services.map((s) => s.name)}
      customerName={session.customer.name || ''}
      customerPhone={session.customer.phone || ''}
      locale={locale}
    />
  );
}
