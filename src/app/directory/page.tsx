import Link from 'next/link';
import { MapPin, Search, Star, BadgeCheck, MessageSquareQuote } from 'lucide-react';
import Logo from '@/components/Logo';
import { prisma } from '@/lib/prisma';
import {
  matchesCity,
  matchesServiceKeyword,
  localityFromAddress,
  isPhoneVerified,
  ratingSummary,
} from '@/lib/directory';

export const metadata = {
  title: 'Find trusted local pros | EveryJob Directory',
  description:
    'Search the EveryJob directory for plumbers, electricians, cleaners, AC repair and more near you. Free quotes, verified phone numbers, real reviews.',
};

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

  return (
    <div className="min-h-screen bg-paper font-sans">
      <header className="bg-ink text-white">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="flex items-center gap-3 mb-3">
            <Logo tone="onDark" size={30} />
              <span className="text-sm font-semibold text-white/60">Directory</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Find a trusted local pro
          </h1>
          <p className="text-white/60 mt-1 text-sm">
            Plumbers, electricians, cleaners, AC repair & more — free quotes, no commission.
          </p>

          <form action="/directory" method="get" className="mt-5 grid sm:grid-cols-[1fr_1fr_auto] gap-2">
            <label className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                name="q"
                defaultValue={q}
                placeholder="What do you need? e.g. AC repair"
                maxLength={100}
                className="w-full rounded-xl bg-white/10 border border-white/15 pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-zinc-400 outline-none focus:border-ink"
              />
            </label>
            <label className="relative">
              <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                name="city"
                defaultValue={city}
                placeholder="City, e.g. Toronto"
                maxLength={100}
                className="w-full rounded-xl bg-white/10 border border-white/15 pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-zinc-400 outline-none focus:border-ink"
              />
            </label>
            <button
              type="submit"
              className="rounded-xl bg-ink hover:bg-graphite text-white text-sm font-bold px-6 py-2.5 transition-colors"
            >
              Search
            </button>
          </form>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-white/60">Min rating:</span>
            {['', '4', '4.5'].map((v) => (
              <Link
                key={v || 'any'}
                href={`/directory?${new URLSearchParams({ q, city, ...(v ? { minRating: v } : {}) }).toString()}`}
                className={`px-3 py-1 rounded-full border font-semibold ${
                  (minRating || '') === v
                    ? 'bg-white text-ink border-white'
                    : 'text-white border-white/25 hover:border-white/60'
                }`}
              >
                {v === '' ? 'Any' : `${v}★ & up`}
              </Link>
            ))}
            <Link
              href="/directory/request"
              className="ml-auto inline-flex items-center gap-1.5 text-lime hover:text-white font-semibold"
            >
              <MessageSquareQuote size={14} /> Request quotes from pros
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {searching && (
          <p className="text-xs text-zinc-500 mb-4">
            {results.length} pro{results.length === 1 ? '' : 's'} found
            {q && <> for “<span className="font-semibold text-zinc-700">{q}</span>”</>}
            {city && <> in <span className="font-semibold text-zinc-700">{city}</span></>}
          </p>
        )}

        {results.length === 0 ? (
          <div className="bg-white rounded-2xl border border-zinc-200/60 shadow-sm p-10 text-center">
            <div className="w-12 h-12 rounded-2xl bg-smoke flex items-center justify-center mx-auto mb-4">
              <Search className="w-6 h-6 text-ink" />
            </div>
            <h2 className="font-bold text-zinc-900">No pros found yet</h2>
            <p className="text-sm text-zinc-500 mt-1 max-w-sm mx-auto">
              {searching
                ? 'Try a different service or a nearby city — new businesses join every day.'
                : 'Be the first pro in your city: list your business on EveryJob free and start getting quote requests.'}
            </p>
            {!searching && (
              <Link
                href="/register"
                className="inline-block mt-4 rounded-xl bg-ink hover:bg-graphite text-white text-sm font-bold px-6 py-2.5 transition-colors"
              >
                List my business — it&apos;s free
              </Link>
            )}
          </div>
        ) : (
          <ul className="grid sm:grid-cols-2 gap-3">
            {results.map((b) => (
              <li key={b.slug}>
                <Link
                  href={`/p/${b.slug}`}
                  className="block bg-white rounded-2xl border border-zinc-200/60 shadow-sm p-5 hover:border-ink hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-bold text-zinc-900 leading-snug">{b.name}</h2>
                    {b.verified && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5 shrink-0">
                        <BadgeCheck size={12} /> Verified
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
                      <span className="text-zinc-400">No reviews yet</span>
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
