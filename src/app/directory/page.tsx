import Link from 'next/link';
import { MapPin, Search, Star, BadgeCheck, MessageSquareQuote, User } from 'lucide-react';
import Logo from '@/components/Logo';
import { prisma } from '@/lib/prisma';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import { getCustomerSession } from '@/lib/customer-auth';
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
        name: b.name,
        logoUrl: b.logoUrl,
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

  const customerSession = await getCustomerSession().catch(() => null);

  return (
    <div className="min-h-screen bg-paper font-sans">
      <header className="relative overflow-hidden bg-gradient-to-br from-indigo-700 via-indigo-800 to-violet-900 text-white">
        <div
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            backgroundImage:
              'radial-gradient(circle at 15% 20%, white 0, transparent 30%), radial-gradient(circle at 85% 80%, #a5b4fc 0, transparent 30%)',
          }}
        />
        <div className="relative max-w-4xl mx-auto px-4 py-10">
          <div className="flex items-center gap-3 mb-4">
            <span className="bg-white rounded-xl p-1.5 shadow-lg">
              <Logo size={26} />
            </span>
            <span className="text-sm font-semibold text-indigo-200">{tr('t10misc.directory.title')}</span>
            <div className="ml-auto">
              {customerSession ? (
                <Link
                  href="/customer"
                  className="inline-flex items-center gap-1.5 min-h-[44px] px-4 rounded-full bg-white/15 backdrop-blur border border-white/25 text-sm font-semibold hover:bg-white/25 transition-colors"
                >
                  <User size={14} />
                  My account
                </Link>
              ) : (
                <Link
                  href="/customer/signup"
                  className="inline-flex items-center gap-1.5 min-h-[44px] px-5 rounded-full bg-white text-indigo-700 text-sm font-bold shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  <User size={14} />
                  Sign up free
                </Link>
              )}
            </div>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            {tr('t10misc.directory.title')}
          </h1>
          <p className="text-indigo-200 mt-2 text-[15px] max-w-xl">{tr('t10misc.directory.subtitle')}</p>

          <form action="/directory" method="get" className="mt-6 grid sm:grid-cols-[1fr_1fr_auto] gap-2">
            <label className="relative block">
              <span className="sr-only">{tr('t10misc.directory.whatPlaceholder')}</span>
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                name="q"
                defaultValue={q}
                placeholder={tr('t10misc.directory.whatPlaceholder')}
                maxLength={100}
                aria-label={tr('t10misc.directory.whatPlaceholder')}
                className="w-full min-h-[52px] rounded-2xl bg-white border-0 pl-11 pr-4 text-[15px] text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-4 focus:ring-white/30 shadow-lg"
              />
            </label>
            <label className="relative block">
              <span className="sr-only">{tr('t10misc.directory.cityPlaceholder')}</span>
              <MapPin size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                name="city"
                defaultValue={city}
                placeholder={tr('t10misc.directory.cityPlaceholder')}
                maxLength={100}
                aria-label={tr('t10misc.directory.cityPlaceholder')}
                className="w-full min-h-[52px] rounded-2xl bg-white border-0 pl-11 pr-4 text-[15px] text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-4 focus:ring-white/30 shadow-lg"
              />
            </label>
            <button
              type="submit"
              className="rounded-2xl min-h-[52px] bg-zinc-900 text-white text-[15px] font-bold px-8 shadow-lg hover:bg-zinc-800 active:scale-[0.98] transition-all"
            >
              {tr('t10misc.directory.search')}
            </button>
          </form>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-indigo-200 font-medium">{tr('t10misc.directory.minRating')}</span>
            {['', '4', '4.5'].map((v) => (
              <Link
                key={v || 'any'}
                href={`/directory?${new URLSearchParams({ q, city, ...(v ? { minRating: v } : {}) }).toString()}`}
                className={`inline-flex items-center min-h-[40px] px-4 rounded-full border font-semibold transition-all ${
                  (minRating || '') === v
                    ? 'bg-white text-indigo-700 border-white shadow-md'
                    : 'text-white border-white/30 hover:border-white/70 hover:bg-white/10'
                }`}
              >
                {v === '' ? tr('t10misc.directory.any') : tr('t10misc.directory.starsUp').replace('{v}', v)}
              </Link>
            ))}
            <Link
              href="/directory/request"
              className="ml-auto inline-flex items-center gap-1.5 min-h-[44px] text-white font-semibold py-2 px-3 rounded-full bg-white/10 border border-white/20 hover:bg-white/20 transition-colors"
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
          <ul className="grid sm:grid-cols-2 gap-4">
            {results.map((b) => (
              <li key={b.slug}>
                <Link
                  href={`/p/${b.slug}`}
                  className="block bg-white rounded-3xl border border-zinc-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-5 hover:shadow-[0_8px_24px_rgba(79,70,229,0.10)] hover:border-indigo-200 transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shrink-0 overflow-hidden shadow-md shadow-indigo-500/20">
                        {b.logoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={b.logoUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-lg font-bold text-white">{b.name.charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <h2 className="font-bold text-zinc-900 leading-snug">{b.name}</h2>
                    </div>
                    {b.verified && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1 shrink-0">
                        <BadgeCheck size={12} /> {tr('t10misc.directory.verified')}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-2.5 text-xs text-zinc-500">
                    {b.avg !== null ? (
                      <span className="inline-flex items-center gap-1 font-bold text-zinc-800 bg-amber-50 border border-amber-200/70 rounded-full px-2.5 py-1">
                        <Star size={12} className="fill-amber-400 text-amber-400" />
                        {b.avg} <span className="font-medium text-zinc-500">({b.count})</span>
                      </span>
                    ) : (
                      <span className="text-[11px] font-medium text-zinc-400 bg-zinc-100 rounded-full px-2.5 py-1">{tr('t10misc.directory.noReviews')}</span>
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
                          className="text-[11px] font-medium bg-indigo-50 text-indigo-700 rounded-full px-2.5 py-1"
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
