import { redirect } from 'next/navigation';
import { requireCustomerAuth } from '@/lib/customer-auth';
import { prisma } from '@/lib/prisma';
import { unsafeUnscoped } from '@/lib/tenant-guard';
import { getLocale } from '@/lib/i18n/server';
import {
  matchesCity,
  matchesServiceKeyword,
  localityFromAddress,
  isPhoneVerified,
} from '@/lib/directory';
import CustomerHomeClient from './home-client';

type SearchParams = { q?: string; city?: string; minRating?: string };

/**
 * Customer home - mobile-first pro search for logged-in homeowners.
 * Remembers the customer's city for faster searching.
 */
export default async function CustomerHomePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await requireCustomerAuth();
  const { q = '', city = '', minRating = '' } = await searchParams;
  const locale = await getLocale();
  const minR = Number(minRating) || 0;

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
    },
    orderBy: { name: 'asc' },
    take: 200,
  });

  // P1.0-D Tier B: review counts/averages come from one groupBy, not a
  // nested whole-table reviews read under every listed business.
  // Legitimately unscoped (2026-11-18): this aggregates PUBLIC review
  // counts/averages for the already-filtered listed businesses only
  // (no row content, read-only). The tenant guard only accepts a
  // plain-string where.businessId, so a businessId: { in: [...] } list
  // must go through the escape hatch — the guarded client 500s both
  // directory pages on every load otherwise (TenantScopeError).
  const ratingByBusiness = new Map<string, { count: number; avg: number | null }>();
  for (const r of await unsafeUnscoped('directory:review-ratings', (db) =>
    db.review.groupBy({
      by: ['businessId'],
      where: { businessId: { in: businesses.map((b) => b.id) } },
      _count: { _all: true },
      _avg: { rating: true },
    })
  )) {
    ratingByBusiness.set(r.businessId, {
      count: r._count._all,
      avg: r._avg.rating === null ? null : Math.round(r._avg.rating * 10) / 10,
    });
  }

  const results = businesses
    .map((b) => {
      const { count, avg } = ratingByBusiness.get(b.id) ?? { count: 0, avg: null };
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
        matchesServiceKeyword(q, b.name, b.services) &&
        (minR <= 0 || (b.avg ?? 0) >= minR)
    )
    .sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1) || b.count - a.count);

  const searching = q.trim() !== '' || effectiveCity.trim() !== '' || minR > 0;

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
      initialMinRating={minR > 0 ? String(minRating) : ''}
      savedIds={Array.from(savedIds)}
      locale={locale}
    />
  );
}
