import Link from 'next/link';
import { MapPin, Search, Star, BadgeCheck, MessageSquareQuote } from 'lucide-react';
import Logo from '@/components/Logo';
import { prisma } from '@/lib/prisma';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import {
  matchesCity,
  matchesServiceKeyword,
  localityFromAddress,
  isPhoneVerified,
  ratingSummary,
} from '@/lib/directory';

export async function generateMetadata() {
  const locale = await getLocale();
  const en = locale === 'en';
  return {
    title: en ? 'Find trusted local pros | EveryJob Directory' : 'Trouvez un pro local de confiance | Répertoire EveryJob',
    description: en
      ? 'Search the EveryJob directory for plumbers, electricians, cleaners, furnace repair and more near you. Free quotes, verified phone numbers, real reviews.'
      : 'Recherchez dans le répertoire EveryJob plombiers, électriciens, ménage, réparation de fournaise et plus près de chez vous. Devis gratuits, numéros vérifiés, vrais avis.',
  };
}

type SearchParams = { q?: string; city?: string; minRating?: string };

/**
 * Public business directory. Tenant-safe: only verified directoryOptIn
 * businesses with a booking page are listed, and only public-safe fields
 * are selected. Unverified/unclaimed listings never go public.
 */
export default async function DirectoryPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const locale = await getLocale();
  const tr = (path: string) => t(locale, path);
  const { q = '', city = '', minRating = '' } = await searchParams;
  const minR = Number(minRating) || 0;

  const businesses = await prisma.business.findMany({
    where: { directoryOptIn: true, directoryVerifiedAt: { not: null }, bookingPage: { isNot: null } },
    select: {
      name: true,
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
        name: b.name,
        slug: b.bookingPage!.slug,
        locality: localityFromAddress(b.address),
        hideAddress: b.directoryHideAddress,
        address: b.address,
        verified: isPhoneVerified(b.phone, b.whatsappNumber, b.regionCode),
        services: b.services.map((s) => s.name),
        count,
        avg,
      };
    })
    .filter(
      (b) =>
        matchesCity(city, b.address) &&
        matchesServiceKeyword(q, b.name, b.services) &&
        (minR <= 0 || (b.avg ?? 0) >= minR)
    )
    .sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1) || b.count - a.count);

  const searching = q.trim() !== '' || city.trim() !== '';
  const resultsLine = tr('t10misc.directory.resultsFor')
    .replace('{count}', String(results.length))
    .replaceAll('{s}', results.length === 1 ? '' : 's')
    .replace('{q}', q);

  return (
    <div className="min-h-screen bg-paper font-sans">
      <header className="bg-ink text-white">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="flex items-center gap-3 mb-3">
            <Logo tone="onDark" size={30} />
            <span className="text-sm font-semibold text-white/60">{tr('t10misc.directory.title')}</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            {tr('t10misc.directory.title')}
          </h1>
          <p className="text-white/60 mt-1 text-sm">{tr('t10misc.directory.subtitle')}</p>

          <form action="/directory" method="get" className="mt-5 grid sm:grid-cols-[1fr_1fr_auto] gap-2">
            <label className="relative block">
              <span className="sr-only">{tr('t10misc.directory.whatPlaceholder')}</span>
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                name="q"
                defaultValue={q}
                placeholder={tr('t10misc.directory.whatPlaceholder')}
                maxLength={100}
                aria-label={tr('t10misc.directory.whatPlaceholder')}
                className="w-full min-h-[44px] rounded-xl bg-white/10 border border-white/15 pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-zinc-400 outline-none focus:border-lime"
              />
            </label>
            <label className="relative block">
              <span className="sr-only">{tr('t10misc.directory.cityPlaceholder')}</span>
              <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                name="city"
                defaultValue={city}
                placeholder={tr('t10misc.directory.cityPlaceholder')}
                maxLength={100}
                aria-label={tr('t10misc.directory.cityPlaceholder')}
                className="w-full min-h-[44px] rounded-xl bg-white/10 border border-white/15 pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-zinc-400 outline-none focus:border-lime"
              />
            </label>
            <button
              type="submit"
              className="rounded-xl min-h-[44px] bg-lime text-ink text-sm font-bold px-6 py-2.5 hover:brightness-105 transition-colors"
            >
              {tr('t10misc.directory.search')}
            </button>
          </form>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-white/60">{tr('t10misc.directory.minRating')}</span>
            {['', '4', '4.5'].map((v) => (
              <Link
                key={v || 'any'}
                href={`/directory?${new URLSearchParams({ q, city, ...(v ? { minRating: v } : {}) }).toString()}`}
                className={`inline-flex items-center min-h-[44px] px-3 py-1 rounded-full border font-semibold ${
                  (minRating || '') === v
                    ? 'bg-white text-ink border-white'
                    : 'text-white border-white/25 hover:border-white/60'
                }`}
              >
                {v === '' ? tr('t10misc.directory.any') : tr('t10misc.directory.starsUp').replace('{v}', v)}
              </Link>
            ))}
            <Link
              href="/directory/request"
              className="ml-auto inline-flex items-center gap-1.5 min-h-[44px] text-lime hover:text-white font-semibold py-2"
            >
              <MessageSquareQuote size={14} /> {tr('t10misc.directory.requestQuotes')}
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {searching && (
          <p className="text-xs text-zinc-500 mb-4">
            {resultsLine}
            {city && (
              <>
                {' '}
                {tr('t10misc.directory.resultsIn').replace('{city}', city)}
              </>
            )}
          </p>
        )}

        {results.length === 0 ? (
          <div className="bg-white rounded-[20px] border border-zinc-200/70 shadow-[0_1px_3px_rgba(22,22,22,0.06)] p-10 text-center">
            <div className="w-12 h-12 rounded-2xl bg-smoke flex items-center justify-center mx-auto mb-4">
              <Search className="w-6 h-6 text-ink" />
            </div>
            <h2 className="font-bold text-zinc-900">{tr('t10misc.directory.noProsTitle')}</h2>
            <p className="text-sm text-zinc-500 mt-1 max-w-sm mx-auto">
              {searching ? tr('t10misc.directory.noProsSearching') : tr('t10misc.directory.noProsIdle')}
            </p>
            {!searching && (
              <Link
                href="/register"
                className="inline-flex items-center justify-center mt-4 rounded-xl min-h-[44px] bg-ink hover:bg-graphite text-white text-sm font-bold px-6 py-2.5 transition-colors"
              >
                {tr('t10misc.directory.listBusiness')}
              </Link>
            )}
          </div>
        ) : (
          <ul className="grid sm:grid-cols-2 gap-3">
            {results.map((b) => (
              <li key={b.slug}>
                <Link
                  href={`/p/${b.slug}`}
                  className="block bg-white rounded-[20px] border border-zinc-200/70 shadow-[0_1px_3px_rgba(22,22,22,0.06)] p-5 hover:border-ink hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-bold text-zinc-900 leading-snug">{b.name}</h2>
                    {b.verified && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5 shrink-0">
                        <BadgeCheck size={12} /> {tr('t10misc.directory.verified')}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-zinc-500">
                    {b.avg !== null ? (
                      <span className="inline-flex items-center gap-1 font-semibold text-zinc-700">
                        <Star size={12} className="fill-amber-400 text-amber-400" />
                        {b.avg} <span className="font-normal text-zinc-400">({b.count})</span>
                      </span>
                    ) : (
                      <span className="text-zinc-400">{tr('t10misc.directory.noReviews')}</span>
                    )}
                    {b.locality && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin size={12} /> {b.hideAddress ? b.locality : b.address}
                      </span>
                    )}
                  </div>
                  {b.services.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {b.services.slice(0, 4).map((s) => (
                        <span
                          key={s}
                          className="text-[11px] font-medium bg-zinc-100 text-zinc-600 rounded-full px-2.5 py-1"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
