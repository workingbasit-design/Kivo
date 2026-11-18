import Link from 'next/link';
import { MapPin, Search, MessageSquareQuote, ChevronDown } from '@/components/icons';
import { Card } from '@/components/kit';
import { prisma } from '@/lib/prisma';
import { unsafeUnscoped } from '@/lib/tenant-guard';
import { getLocale } from '@/lib/i18n/server';
import { getCspNonce } from '@/lib/csp-nonce';
import { t } from '@/lib/i18n';
import { getCustomerSession } from '@/lib/customer-auth';
import { safeJsonLd } from '@/lib/jsonld';
import DirectoryRatingFilter from '@/components/DirectoryRatingFilter';
import CustomerHeader from '@/components/CustomerHeader';
import DirectoryProCard from '@/components/DirectoryProCard';
import {
  matchesCity,
  matchesServiceKeyword,
  localityFromAddress,
  isPhoneVerified,
} from '@/lib/directory';

export async function generateMetadata() {
  const locale = await getLocale();
  return {
    title: t(locale, 'meta.directoryTitle'),
    description: t(locale, 'meta.directoryDesc'),
  };
}

type SearchParams = { q?: string; city?: string; minRating?: string; sort?: string };

const MAIN_CATEGORIES = ['Plumbing', 'Electrical', 'Cleaning', 'HVAC'] as const;
const MORE_CATEGORIES = ['Landscaping', 'Painting', 'Roofing', 'Pest Control'] as const;

type SortKey = 'recommended' | 'reviews' | 'name';
const SORT_KEYS: Record<SortKey, string> = {
  recommended: 'sortRecommended',
  reviews: 'sortMostReviews',
  name: 'sortNameAz',
};

/**
 * Public business directory — mockup rebuild (2026-11-16). Tenant-safe:
 * only verified directoryOptIn businesses with a booking page are listed,
 * and only public-safe fields are selected. Unverified/unclaimed listings
 * never go public. Real listings only — nothing is invented for the
 * mockup; when there are no listings, the existing empty state shows.
 */
export default async function DirectoryPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const locale = await getLocale();
  const tr = (path: string) => t(locale, path);
  const { q = '', city = '', minRating = '', sort = '' } = await searchParams;
  const minR = Number(minRating) || 0;
  const sortKey: SortKey =
    sort === 'reviews' || sort === 'name' ? (sort as SortKey) : 'recommended';

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
    .sort((a, b) => {
      if (sortKey === 'reviews') return b.count - a.count || (b.avg ?? -1) - (a.avg ?? -1);
      if (sortKey === 'name') return a.name.localeCompare(b.name);
      return (b.avg ?? -1) - (a.avg ?? -1) || b.count - a.count;
    });

  const searching = q.trim() !== '' || city.trim() !== '';
  const customerSession = await getCustomerSession().catch(() => null);
  const savedIds = new Set<string>();
  if (customerSession) {
    const saved = await prisma.savedPro
      .findMany({ where: { customerId: customerSession.customer.id }, select: { businessId: true } })
      .catch(() => []);
    for (const s of saved) savedIds.add(s.businessId);
  }

  const sortLabel = (key: SortKey) =>
    tr(`t10misc.directory.${SORT_KEYS[key]}`);

  const countLine = tr('t10misc.directory.prosToExplore')
    .replace('{count}', String(results.length))
    .replaceAll('{s}', results.length === 1 ? '' : 's');

  const pillHref = (category: string | null) => {
    const params = new URLSearchParams();
    if (category) params.set('q', category);
    if (city.trim()) params.set('city', city.trim());
    if (minRating) params.set('minRating', minRating);
    const qs = params.toString();
    return `/directory${qs ? `?${qs}` : ''}`;
  };
  const sortHref = (key: SortKey) => {
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (city.trim()) params.set('city', city.trim());
    if (minRating) params.set('minRating', minRating);
    if (key !== 'recommended') params.set('sort', key);
    const qs = params.toString();
    return `/directory${qs ? `?${qs}` : ''}`;
  };
  const activeCategory =
    [...MAIN_CATEGORIES, ...MORE_CATEGORIES].find(
      (c) => c.toLowerCase() === q.trim().toLowerCase()
    ) ?? null;

  // ItemList structured data so search engines (and AI agents that read
  // structured data) understand the directory contents.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'EveryJob Directory',
    itemListElement: results.slice(0, 50).map((b, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'LocalBusiness',
        name: b.name,
        address: b.locality ?? undefined,
        aggregateRating:
          b.avg !== null ? { '@type': 'AggregateRating', ratingValue: b.avg, reviewCount: b.count } : undefined,
      },
    })),
  };

  return (
    <div className="min-h-screen bg-paper font-sans">
      <script
        type="application/ld+json"
        nonce={await getCspNonce()}
        dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
      />
      <CustomerHeader
        active="directory"
        firstName={customerSession?.customer.name?.split(' ')[0] ?? null}
        locale={locale}
      />

      <main className="ej-main">
        {/* Hero */}
        <div className="ej-anim-fade-up grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="ej-eyebrow">{tr('t10misc.directory.heroEyebrow')}</p>
            <h1 className="mt-3 text-[40px] font-light leading-[1.05] tracking-tight text-ink sm:text-[52px]">
              {tr('t10misc.directory.heroTitle1')}
              <br />
              <span className="font-bold">
                <span className="ej-swash">{tr('t10misc.directory.heroTitle2')}</span>
              </span>
            </h1>
          </div>
          <p className="max-w-sm text-[15px] leading-relaxed text-ink-2">
            {tr('t10misc.directory.heroSub')}
          </p>
        </div>

        {/* Search bar */}
        <form
          action="/directory"
          method="get"
          className="ej-anim-fade-up mt-8 flex flex-col gap-2 rounded-[24px] border border-line bg-surface p-2 shadow-kit-card md:flex-row md:items-center md:gap-0 md:rounded-full"
          style={{ animationDelay: '80ms' }}
        >
          <label className="relative flex min-w-0 flex-1 items-center">
            <Search size={18} className="pointer-events-none absolute left-4 z-10 text-ink-2" />
            <span className="sr-only">{tr('t10misc.directory.whatPlaceholder')}</span>
            <input
              name="q"
              defaultValue={q}
              placeholder={tr('t10misc.directory.whatPlaceholder')}
              maxLength={100}
              aria-label={tr('t10misc.directory.whatPlaceholder')}
              className="h-[52px] w-full min-w-0 rounded-full bg-transparent pl-11 pr-4 text-[16px] text-ink outline-none placeholder:text-ink-2"
            />
          </label>
          <span className="hidden h-8 w-px shrink-0 bg-line md:block" aria-hidden="true" />
          <label className="relative flex min-w-0 flex-1 items-center">
            <MapPin size={18} className="pointer-events-none absolute left-4 z-10 text-ink-2" />
            <span className="sr-only">{tr('t10misc.directory.cityPlaceholder')}</span>
            <input
              name="city"
              defaultValue={city}
              placeholder={tr('t10misc.directory.cityPlaceholder')}
              maxLength={100}
              aria-label={tr('t10misc.directory.cityPlaceholder')}
              className="h-[52px] w-full min-w-0 rounded-full bg-transparent pl-11 pr-4 text-[16px] text-ink outline-none placeholder:text-ink-2"
            />
          </label>
          <button
            type="submit"
            className="ej-button ej-button-primary w-full md:w-auto md:rounded-full"
          >
            {tr('t10misc.directory.search')}
            <span aria-hidden="true">→</span>
          </button>
        </form>

        {/* Filter pills */}
        <div
          className="ej-anim-fade-up mt-5 flex flex-wrap items-center gap-2"
          style={{ animationDelay: '140ms' }}
        >
          <Link
            href={pillHref(null)}
            aria-pressed={activeCategory === null}
            className={
              activeCategory === null
                ? 'inline-flex min-h-[44px] items-center rounded-full bg-asphalt px-4 text-sm font-semibold text-hero-ink'
                : 'inline-flex min-h-[44px] items-center rounded-full border border-line bg-surface px-4 text-sm font-semibold text-ink transition-colors hover:border-line-strong'
            }
          >
            {tr('t10misc.directory.allPros')}
          </Link>
          {MAIN_CATEGORIES.map((c) => (
            <Link
              key={c}
              href={pillHref(c)}
              aria-pressed={activeCategory === c}
              className={
                activeCategory === c
                  ? 'inline-flex min-h-[44px] items-center rounded-full bg-asphalt px-4 text-sm font-semibold text-hero-ink'
                  : 'inline-flex min-h-[44px] items-center rounded-full border border-line bg-surface px-4 text-sm font-semibold text-ink transition-colors hover:border-line-strong'
              }
            >
              {tr(`customer.categories.${c}`)}
            </Link>
          ))}
          <details className="relative">
            <summary className="inline-flex min-h-[44px] cursor-pointer list-none items-center gap-1.5 rounded-full border border-line bg-surface px-4 text-sm font-semibold text-ink transition-colors hover:border-line-strong [&::-webkit-details-marker]:hidden">
              {tr('t10misc.directory.more')}
              <ChevronDown className="h-4 w-4" />
            </summary>
            <div className="absolute left-0 z-20 mt-2 min-w-[200px] rounded-2xl border border-line bg-surface p-2 shadow-kit-pop">
              {MORE_CATEGORIES.map((c) => (
                <Link
                  key={c}
                  href={pillHref(c)}
                  className="block min-h-[44px] rounded-xl px-3 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-surface-2"
                >
                  {tr(`customer.categories.${c}`)}
                </Link>
              ))}
            </div>
          </details>
          <Link
            href="/directory/request"
            className="ml-auto inline-flex min-h-[44px] items-center gap-1.5 text-sm font-semibold text-ink underline underline-offset-4"
          >
            <MessageSquareQuote size={16} />
            {tr('t10misc.directory.requestQuotes')}
          </Link>
        </div>

        {/* Count + sort */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[15px] font-bold text-ink">{countLine}</p>
          <div className="flex flex-wrap items-center gap-4">
            <DirectoryRatingFilter
              options={['', '4', '4.5'] as const}
              anyLabel={tr('t10misc.directory.any')}
              starsUp={tr('t10misc.directory.starsUp')}
              minRatingLabel={tr('t10misc.directory.minRating')}
            />
            <details className="relative">
              <summary className="inline-flex min-h-[44px] cursor-pointer list-none items-center gap-1.5 text-sm font-semibold text-ink [&::-webkit-details-marker]:hidden">
                {tr('t10misc.directory.sortBy').replace('{sort}', sortLabel(sortKey))}
                <ChevronDown className="h-4 w-4" />
              </summary>
              <div className="absolute right-0 z-20 mt-2 min-w-[200px] rounded-2xl border border-line bg-surface p-2 shadow-kit-pop">
                {(Object.keys(SORT_KEYS) as SortKey[]).map((key) => (
                  <Link
                    key={key}
                    href={sortHref(key)}
                    aria-current={sortKey === key ? 'true' : undefined}
                    className="block min-h-[44px] rounded-xl px-3 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-surface-2"
                  >
                    {sortLabel(key)}
                    {sortKey === key ? ' ✓' : ''}
                  </Link>
                ))}
              </div>
            </details>
          </div>
        </div>

        {/* Results */}
        <div className="mt-5">
          {results.length === 0 ? (
            <Card className="p-10 text-center">
              <div className="ej-icon mx-auto mb-4">
                <Search className="h-6 w-6" />
              </div>
              <h2 className="font-bold text-ink">{tr('t10misc.directory.noProsTitle')}</h2>
              <p className="mx-auto mt-1 max-w-sm text-sm text-ink-2">
                {searching ? tr('t10misc.directory.noProsSearching') : tr('t10misc.directory.noProsIdle')}
              </p>
              <Link
                href="/register"
                className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-hivis px-6 py-2.5 text-sm font-bold text-hivis-ink transition-colors"
              >
                {tr('t10misc.directory.listBusiness')}
              </Link>
            </Card>
          ) : (
            <ul className="grid gap-4">
              {results.map((b, i) => (
                <li
                  key={b.slug}
                  className="ej-anim-fade-up"
                  style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}
                >
                  <DirectoryProCard
                    pro={b}
                    saved={savedIds.has(b.id)}
                    showSave={customerSession !== null}
                    locale={locale}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
