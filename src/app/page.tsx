// src/app/page.tsx — public customer home (exact reference build).
//
// The root route is the homeowner-facing home page: "The right pro.
// Without the runaround." (Design Smart Home App chat, "EveryJob – Exact
// Reference Build"). The previous pro landing page is superseded by this
// design; its content remains in git history. Pros still enter via
// /login and /register, and /start still offers the chooser.
//
// Real data wiring (foundation, kept): the pros section is a server-side
// query over verified, consent-based directory listings for the default
// city (Etobicoke, Toronto) — the same tenant-safe query as /directory.
// The exact empty state shows only when that real query returns nothing;
// no listing is ever invented. Search is a native GET form to /directory.

import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { getLocale } from '@/lib/i18n/server';
import { getCspNonce } from '@/lib/csp-nonce';
import { getCustomerSession } from '@/lib/customer-auth';
import { safeJsonLd } from '@/lib/jsonld';
import {
  matchesCity,
  localityFromAddress,
  isPhoneVerified,
  ratingSummary,
} from '@/lib/directory';
import { CustomerHomePage } from '@/components/public/CustomerHomePage';

const SITE_URL = 'https://kivo-nine-silk.vercel.app';
const DEFAULT_CITY = 'Etobicoke, Toronto';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const en = locale === 'en';
  return {
    title: en ? 'Find trusted local pros | EveryJob' : 'Trouvez un pro local de confiance | EveryJob',
    description: en
      ? 'Find trusted local home-service professionals in Canada. Get free quotes, no commission, and contact them directly.'
      : 'Trouvez des professionnels locaux de confiance au Canada. Obtenez des devis gratuits, sans commission, et contactez-les directement.',
  };
}

export default async function HomePage() {
  const locale = await getLocale();

  // Real verified directory listings for the default city. Same
  // tenant-safe filter as /directory: opt-in + verified + booking page
  // enabled, public-safe fields only.
  const businesses = await prisma.business.findMany({
    where: { directoryOptIn: true, directoryVerifiedAt: { not: null }, bookingPage: { is: { enabled: true } } },
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
        address: b.address,
        services: b.services.map((s) => s.name),
        verified: isPhoneVerified(b.phone, b.whatsappNumber, b.regionCode),
        count,
        avg,
      };
    })
    .filter((b) => matchesCity(DEFAULT_CITY, b.address))
    .sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1) || b.count - a.count);

  // Save hearts show only for signed-in customers (same as /directory).
  const customerSession = await getCustomerSession().catch(() => null);
  const savedIds: string[] = [];
  if (customerSession) {
    const saved = await prisma.savedPro
      .findMany({ where: { customerId: customerSession.customer.id }, select: { businessId: true } })
      .catch(() => []);
    for (const s of saved) savedIds.push(s.businessId);
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'EveryJob',
    url: SITE_URL,
    description:
      'Find trusted local home-service professionals in Canada. Get free quotes, no commission, and contact them directly.',
    inLanguage: ['en-CA', 'fr-CA'],
  };

  return (
    <>
      <script
        type="application/ld+json"
        nonce={await getCspNonce()}
        dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
      />
      <CustomerHomePage
        results={results}
        savedIds={savedIds}
        showSave={customerSession !== null}
        locale={locale}
      />
    </>
  );
}
