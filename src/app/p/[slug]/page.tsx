import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  BadgeCheck,
  CalendarCheck,
  Clock,
  Flag,
  MapPin,
  MessageCircle,
  Phone,
  Star,
} from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { waLink } from '@/lib/whatsapp';
import { formatMoney } from '@/lib/money';
import { formatWorkingHoursSummary } from '@/lib/working-hours';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import {
  localityFromAddress,
  isPhoneVerified,
  matchesCity,
  ratingSummary,
} from '@/lib/directory';
import { parseServiceAreas } from '@/lib/directory-claim';
import ReportBusinessForm from '@/components/ReportBusinessForm';

async function getProfile(slug: string) {
  const page = await prisma.bookingPage.findUnique({
    where: { slug },
    select: {
      headline: true,
      headlineFr: true,
      intro: true,
      introFr: true,
      description: true,
      descriptionFr: true,
      serviceAreas: true,
      showPhone: true,
      business: {
        select: {
          id: true,
          name: true,
          phone: true,
          whatsappNumber: true,
          address: true,
          workingHours: true,
          regionCode: true,
          currency: true,
          directoryOptIn: true,
          directoryVerifiedAt: true,
          directoryHideAddress: true,
        },
      },
    },
  });
  if (!page || !page.business.directoryOptIn || !page.business.directoryVerifiedAt) return null;

  const businessId = page.business.id;
  const [services, reviews] = await Promise.all([
    prisma.service.findMany({
      where: { businessId },
      select: { name: true, price: true },
      orderBy: { name: 'asc' },
    }),
    prisma.review.findMany({
      where: { businessId },
      select: { rating: true, comment: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ]);
  return { page, services, reviews };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getProfile(slug);
  if (!data) return { title: 'Business not found | EveryJob Directory' };
  const { page, services } = data;
  const name = page.business.name;
  const locality = localityFromAddress(page.business.address);
  const serviceWords = services.slice(0, 3).map((s) => s.name).join(', ');
  const title = `${name}${locality ? ` — ${locality}` : ''} | EveryJob Directory`;
  const description = [
    page.headline,
    serviceWords ? `Services: ${serviceWords}.` : '',
    'Book free, read real reviews, request quotes — no commission.',
  ]
    .filter(Boolean)
    .join(' ');
  return {
    title,
    description,
    openGraph: { title, description, type: 'profile' },
  };
}

/**
 * Public business profile. Tenant-safe: only verified directoryOptIn
 * businesses are reachable, and only public-safe fields are selected.
 */
export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getProfile(slug);
  if (!data) notFound();
  const { page, services, reviews } = data;
  const b = page.business;

  const { count, avg } = ratingSummary(reviews.map((r) => ({ rating: r.rating })));
  const verified = isPhoneVerified(b.phone, b.whatsappNumber, b.regionCode);
  const locality = localityFromAddress(b.address);
  const hoursSummary = formatWorkingHoursSummary(b.workingHours);
  const wa = waLink(
    b.whatsappNumber || b.phone,
    `Hi ${b.name}! I found you on the EveryJob directory and I'd like a quote.`,
    b.regionCode
  );
  const showAddress = b.directoryHideAddress ? locality : b.address;
  const showContact = page.showPhone; // business chose to display phone/WhatsApp publicly
  const serviceAreas = parseServiceAreas(page.serviceAreas);

  const locale = await getLocale();
  const L = (path: string) => t(locale, path);
  const headline = locale === 'fr' ? page.headlineFr || page.headline : page.headline;
  const aboutText =
    locale === 'fr'
      ? page.descriptionFr || page.description || page.introFr || page.intro
      : page.description || page.intro;

  // Similar pros nearby: other directory businesses in the same city with
  // overlapping services. Real discovery cross-linking, no fake data.
  const myServiceWords = services.map((s) => s.name.toLowerCase());
  let similarPros: { name: string; slug: string; avg: number | null; service: string | null }[] = [];
  if (locality) {
    const others = await prisma.business.findMany({
      where: { directoryOptIn: true, directoryVerifiedAt: { not: null }, bookingPage: { isNot: null }, id: { not: b.id } },
      select: {
        name: true,
        address: true,
        bookingPage: { select: { slug: true } },
        services: { select: { name: true }, take: 6 },
        reviews: { select: { rating: true } },
      },
      take: 100,
    });
    similarPros = others
      .filter(
        (o) =>
          matchesCity(locality, o.address) &&
          o.services.some((s) =>
            myServiceWords.some(
              (w) => s.name.toLowerCase().includes(w) || w.includes(s.name.toLowerCase())
            )
          )
      )
      .map((o) => ({
        name: o.name,
        slug: o.bookingPage!.slug,
        avg: ratingSummary(o.reviews).avg,
        service: o.services[0]?.name ?? null,
      }))
      .sort((a, z) => (z.avg ?? -1) - (a.avg ?? -1))
      .slice(0, 3);
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: b.name,
    description: headline ?? undefined,
    telephone: b.phone ?? undefined,
    address: locality ?? undefined,
    aggregateRating:
      avg !== null ? { '@type': 'AggregateRating', ratingValue: avg, reviewCount: count } : undefined,
  };

  return (
    <div className="min-h-screen bg-paper font-sans">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <header className="bg-ink text-white">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <Link href="/directory" className="min-h-[44px] inline-flex items-center text-xs text-white/60 hover:text-white">
            {L('t10money.profileBack')}
          </Link>
          <div className="flex items-start justify-between gap-3 mt-3">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{b.name}</h1>
              {headline && <p className="text-white/60 mt-1 text-sm">{headline}</p>}
            </div>
            {verified && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-400/30 rounded-full px-2.5 py-1 shrink-0">
                <BadgeCheck size={12} /> {L('t10money.profilePhoneVerified')}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 text-xs text-white/60">
            {avg !== null ? (
              <span className="inline-flex items-center gap-1.5 text-white font-semibold">
                <Star size={13} className="fill-amber-400 text-amber-400" />
                {avg} <span className="font-normal text-white/60">({count} {L(count === 1 ? 't10money.profileReviewsOne' : 't10money.profileReviewsMany')})</span>
              </span>
            ) : (
              <span>{L('t10money.profileNoReviewsCta')}</span>
            )}
            {showAddress && (
              <span className="inline-flex items-center gap-1">
                <MapPin size={12} /> {showAddress}
              </span>
            )}
            {hoursSummary && (
              <span className="inline-flex items-center gap-1">
                <Clock size={12} /> {hoursSummary}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2 mt-5">
            <Link
              href={`/book/${slug}`}
              className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl bg-lime hover:bg-lime/85 text-ink text-sm font-bold px-5 py-2.5 transition-colors"
            >
              <CalendarCheck size={15} /> {L('t10money.profileBookNow')}
            </Link>
            {showContact && wa && (
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl bg-[#1faa55] hover:bg-[#1a9449] text-white text-sm font-bold px-5 py-2.5 transition-colors"
              >
                <MessageCircle size={15} /> {L('t10money.profileWhatsapp')}
              </a>
            )}
            {showContact && b.phone && (
              <a
                href={`tel:${b.phone.replace(/\s/g, '')}`}
                className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border border-white/25 hover:border-white/60 text-white text-sm font-bold px-5 py-2.5 transition-colors"
              >
                <Phone size={15} /> {L('t10money.profileCall')}
              </a>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {aboutText && (
          <section className="bg-white rounded-[20px] border border-zinc-200/70 shadow-[0_1px_3px_rgba(22,22,22,0.06)] p-5">
            <h2 className="text-sm font-bold text-zinc-900 mb-1.5">{L('t10money.profileAbout')}</h2>
            <p className="text-sm text-zinc-600 leading-relaxed whitespace-pre-line">{aboutText}</p>
          </section>
        )}

        {serviceAreas.length > 0 && (
          <section className="bg-white rounded-[20px] border border-zinc-200/70 shadow-[0_1px_3px_rgba(22,22,22,0.06)] p-5">
            <h2 className="text-sm font-bold text-zinc-900 mb-3">{L('t10money.profileAreas')}</h2>
            <div className="flex flex-wrap gap-1.5">
              {serviceAreas.map((a) => (
                <span key={a} className="inline-flex items-center gap-1 text-xs font-medium text-zinc-700 bg-smoke rounded-full px-2.5 py-1">
                  <MapPin size={11} className="text-zinc-400" /> {a}
                </span>
              ))}
            </div>
          </section>
        )}

        <section className="bg-white rounded-[20px] border border-zinc-200/70 shadow-[0_1px_3px_rgba(22,22,22,0.06)] p-5">
          <h2 className="text-sm font-bold text-zinc-900 mb-3">{L('t10money.profileServices')}</h2>
          {services.length === 0 ? (
            <p className="text-sm text-zinc-500">{L('t10money.profileServicesEmpty')}</p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {services.map((s) => (
                <li key={s.name} className="flex items-center justify-between py-2.5">
                  <span className="text-sm text-zinc-700 font-medium">{s.name}</span>
                  <span className="text-sm font-bold text-zinc-900">
                    {formatMoney(s.price, b.currency)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-[11px] text-zinc-400 mt-3">{L('t10money.profilePricesNote')}</p>
        </section>

        <section className="bg-white rounded-[20px] border border-zinc-200/70 shadow-[0_1px_3px_rgba(22,22,22,0.06)] p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-zinc-900">
              {L('t10money.profileReviewsMany')} {count > 0 && <span className="text-zinc-400 font-medium">({count})</span>}
            </h2>
            <Link
              href={`/directory/request`}
              className="min-h-[44px] inline-flex items-center text-xs font-bold text-ink hover:underline"
            >
              {L('t10money.profileRequestQuote')}
            </Link>
          </div>
          {reviews.length === 0 ? (
            <p className="text-sm text-zinc-500">{L('t10money.profileNoReviews')}</p>
          ) : (
            <ul className="space-y-3">
              {reviews.map((r, i) => (
                <li key={i} className="border-b border-zinc-100 pb-3 last:border-0 last:pb-0">
                  <div className="flex items-center gap-1 mb-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star
                        key={n}
                        size={12}
                        className={n <= r.rating ? 'fill-amber-400 text-amber-400' : 'text-zinc-300'}
                      />
                    ))}
                  </div>
                  {r.comment && <p className="text-sm text-zinc-600">{r.comment}</p>}
                </li>
              ))}
            </ul>
          )}
          <Link
            href={`/r/${b.id}`}
            className="min-h-[44px] inline-flex items-center mt-3 text-xs font-bold text-ink hover:underline"
          >
            {L('t10money.profileLeaveReview')}
          </Link>
        </section>

        <section className="bg-white rounded-[20px] border border-zinc-200/70 shadow-[0_1px_3px_rgba(22,22,22,0.06)] p-5">
          <h2 className="text-sm font-bold text-zinc-900 mb-1 flex items-center gap-1.5">
            <Flag size={13} /> {L('t10money.profileReportTitle')}
          </h2>
          <p className="text-xs text-zinc-500 mb-3">
            {L('t10money.profileReportDesc')}
          </p>
          <ReportBusinessForm slug={slug} />
        </section>

        {similarPros.length > 0 && (
          <section className="bg-white rounded-[20px] border border-zinc-200/70 shadow-[0_1px_3px_rgba(22,22,22,0.06)] p-5">
            <h2 className="text-sm font-bold text-zinc-900 mb-3">{L('t10money.profileSimilar')}</h2>
            <ul className="space-y-2">
              {similarPros.map((p) => (
                <li key={p.slug}>
                  <Link
                    href={`/p/${p.slug}`}
                    className="min-h-[44px] flex items-center justify-between gap-2 rounded-xl border border-zinc-100 hover:border-ink px-3.5 py-2.5 transition-colors"
                  >
                    <span>
                      <span className="block text-sm font-semibold text-zinc-800">{p.name}</span>
                      {p.service && <span className="block text-[11px] text-zinc-400">{p.service}</span>}
                    </span>
                    {p.avg !== null && (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-zinc-700 shrink-0">
                        <Star size={12} className="fill-amber-400 text-amber-400" /> {p.avg}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="text-center text-[11px] text-zinc-400 pb-8 flex items-center justify-center gap-1.5">
          <BadgeCheck size={11} /> {L('t10money.profileListedNote')}
        </p>
      </main>
    </div>
  );
}
