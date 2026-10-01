import { redirect } from 'next/navigation';
import { requireCustomerAuth } from '@/lib/customer-auth';
import { prisma } from '@/lib/prisma';
import { getLocale } from '@/lib/i18n/server';
import {
  matchesCity,
  matchesServiceKeyword,
  localityFromAddress,
  isPhoneVerified,
  ratingSummary,
} from '@/lib/directory';
import CustomerHomeClient from './home-client';

type SearchParams = { q?: string; city?: string };

/**
 * Customer home — mobile-first pro search for logged-in homeowners.
 * Remembers the customer's city for faster searching.
 */
export default async function CustomerHomePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await requireCustomerAuth();
  const { q = '', city = '' } = await searchParams;
  const locale = await getLocale();

  // Default city to the customer's saved city
  const effectiveCity = city || session.customer.city || '';

  const businesses = await prisma.business.findMany({
    where: { directoryOptIn: true, directoryVerifiedAt: { not: null }, bookingPage: { isNot: null } },
    select: {
      id: true,
      name: true,
      logoUrl: true,
      address: true,
      phone: true,
      whatsappNumber: true,
      regionCode: true,
      directoryHideAddress: true,
      bookingPage: { select: { slug: true } },
      services: { select: { name: true }, orderBy: { name: 'asc' }, take: 8 },
      reviews: { select: { rating: true } },
    },
    orderBy: { name: 'asc' },
    take: 200,
  });

  const results = businesses
    .map((b) => {
      const { count, avg } = ratingSummary(b.reviews);
      return {
        id: b.id,
        name: b.name,
        logoUrl: b.logoUrl,
        slug: b.bookingPage!.slug,
        locality: localityFromAddress(b.address),
        services: b.services.map((s) => s.name),
        verified: isPhoneVerified(b.phone, b.whatsappNumber, b.regionCode),
        count,
        avg,
      };
    })
    .filter(
      (b) =>
        matchesCity(effectiveCity, b.locality) &&
        matchesServiceKeyword(q, b.name, b.services)
    )
    .sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1) || b.count - a.count);

  const searching = q.trim() !== '' || effectiveCity.trim() !== '';

  // Customer's saved pro IDs for heart state
  const saved = await prisma.savedPro
    .findMany({ where: { customerId: session.customer.id }, select: { businessId: true } })
    .catch(() => []);
  const savedIds = new Set(saved.map((s) => s.businessId));

  return (
    <CustomerHomeClient
      results={results}
      searching={searching}
      initialQ={q}
      initialCity={effectiveCity}
      savedIds={Array.from(savedIds)}
      customerName={session.customer.name?.split(' ')[0] || 'there'}
      locale={locale}
    />
  );
}
