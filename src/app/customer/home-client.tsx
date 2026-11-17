"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Search,
  MapPin,
  Wrench,
  Zap,
  Sparkles,
  Snowflake,
  Check,
  SearchX,
  ArrowRight,
} from '@/components/icons';
import { toggleSavePro } from '@/app/actions/customer-pros';
import { t, type Locale } from '@/lib/i18n';
import ProCard, { type ProCardData } from '@/components/ProCard';

/**
 * Customer home — mockup rebuild (2026-11-16): hero with lime swash and
 * house photo, single search bar, four service cards, lime "Tell us what
 * needs doing" banner, and pro cards. Real directory data only: the pros
 * shown are the verified, consent-based listings from the server. When
 * not searching, the top 3 by rating show with a "View directory" link;
 * when searching, all matches show.
 *
 * Icon rule: service icons sit directly on the card (no coloured tiles);
 * the highlighted card uses the theme-flipping --tint-lime; the empty
 * state uses the neutral .ej-icon tile.
 */
const SERVICES = [
  { key: 'Plumbing', icon: Wrench, hintKey: 'customer.home.serviceHintPlumbing' },
  { key: 'Electrical', icon: Zap, hintKey: 'customer.home.serviceHintElectrical' },
  { key: 'Cleaning', icon: Sparkles, hintKey: 'customer.home.serviceHintCleaning' },
  { key: 'HVAC', icon: Snowflake, hintKey: 'customer.home.serviceHintHvac' },
] as const;

// PLACEHOLDER hero photo (Unsplash, modern house exterior) — swap for a
// real EveryJob photo before release. Deliberately an <img>, not
// next/image, so no remote-pattern config change is needed.
const HERO_PHOTO_URL =
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=80';

export default function CustomerHomeClient({
  results,
  searching,
  initialQ,
  initialCity,
  savedIds,
  locale,
}: {
  results: ProCardData[];
  searching: boolean;
  initialQ: string;
  initialCity: string;
  savedIds: string[];
  locale: Locale;
}) {
  const router = useRouter();
  const tr = (path: string) => t(locale, path as never);
  const [q, setQ] = useState(initialQ);
  const [city, setCity] = useState(initialCity);
  const [saved, setSaved] = useState<Set<string>>(new Set(savedIds));

  const doSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (city.trim()) params.set('city', city.trim());
    router.push(`/customer${params.toString() ? `?${params}` : ''}`);
  };

  const toggleSave = async (businessId: string) => {
    const next = new Set(saved);
    if (next.has(businessId)) next.delete(businessId);
    else next.add(businessId);
    setSaved(next);
    await toggleSavePro(businessId).catch(() => setSaved(new Set(savedIds)));
  };

  const searchCategory = (cat: string) => {
    setQ(cat);
    const params = new URLSearchParams();
    params.set('q', cat);
    if (city.trim()) params.set('city', city.trim());
    router.push(`/customer?${params}`);
  };

  // Highlighted service card: the searched category, else Plumbing (the
  // mockup's default).
  const highlighted =
    SERVICES.find((s) => s.key.toLowerCase() === q.trim().toLowerCase())?.key ?? 'Plumbing';
  const chipParts = tr('customer.home.heroChip').split('. ');
  const visiblePros = searching ? results : results.slice(0, 3);

  return (
    <div className="space-y-10 md:space-y-12">
      {/* Hero */}
      <div className="grid items-center gap-8 lg:grid-cols-2">
        <div className="ej-anim-fade-up">
          <p className="ej-eyebrow">{tr('customer.home.heroEyebrow')}</p>
          <h1 className="mt-3 text-[44px] font-light leading-[1.04] tracking-tight text-ink sm:text-[56px]">
            {tr('customer.home.heroLine1')}
            <br />
            <span className="font-bold">
              <span className="ej-swash">{tr('customer.home.heroLine2')}</span>
            </span>
          </h1>
          <p className="mt-4 max-w-md text-[16px] leading-relaxed text-ink-2">
            {tr('customer.home.heroSub')}
          </p>
        </div>

        <div className="ej-anim-fade-up relative" style={{ animationDelay: '80ms' }}>
          <div
            className="absolute inset-0 rotate-[2deg] rounded-[28px] border border-line bg-surface"
            aria-hidden="true"
          />
          <div className="relative rotate-[-2deg] overflow-hidden rounded-[28px] border border-line shadow-kit-pop">
            <img
              src={HERO_PHOTO_URL}
              alt=""
              className="aspect-[4/3] w-full object-cover"
              loading="eager"
            />
            <div className="absolute bottom-4 left-4 flex items-center gap-2.5 rounded-full bg-asphalt py-2 pl-2 pr-4 shadow-kit-pop">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-hivis">
                <Check className="h-4 w-4 text-hivis-ink" strokeWidth={3} />
              </span>
              <span className="text-[13px] font-bold leading-tight text-hero-ink">
                <span className="block">{chipParts[0]}.</span>
                <span className="block">{chipParts[1] ?? ''}</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Search bar */}
      <form onSubmit={doSearch} className="ej-anim-fade-up" style={{ animationDelay: '120ms' }}>
        <div className="flex flex-col gap-2 rounded-[24px] border border-line bg-surface p-2 shadow-kit-card focus-within:shadow-[0_0_0_3px_var(--focus)] md:flex-row md:items-center md:gap-0 md:rounded-full">
          <label className="relative flex min-w-0 flex-1 items-center">
            <Search
              size={18}
              className="pointer-events-none absolute left-4 z-10 text-ink-2"
            />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={tr('customer.home.whatPlaceholder')}
              maxLength={100}
              aria-label={tr('customer.home.whatPlaceholder')}
              className="h-[52px] w-full min-w-0 rounded-full bg-transparent pl-11 pr-4 text-[16px] text-ink outline-none placeholder:text-ink-2"
            />
          </label>
          <span className="hidden h-8 w-px shrink-0 bg-line md:block" aria-hidden="true" />
          <label className="relative flex min-w-0 flex-1 items-center">
            <MapPin
              size={18}
              className="pointer-events-none absolute left-4 z-10 text-ink-2"
            />
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder={tr('customer.home.cityPlaceholder')}
              maxLength={100}
              aria-label={tr('customer.home.cityPlaceholder')}
              className="h-[52px] w-full min-w-0 rounded-full bg-transparent pl-11 pr-4 text-[16px] text-ink outline-none placeholder:text-ink-2"
            />
          </label>
          <button type="submit" className="ej-button ej-button-primary w-full md:w-auto md:rounded-full">
            {tr('customer.home.searchProfessionals')}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </form>

      {/* Services */}
      <section className="ej-anim-fade-up" style={{ animationDelay: '160ms' }}>
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <p className="ej-eyebrow">{tr('customer.home.servicesEyebrow')}</p>
            <h2 className="mt-2 text-[28px] font-medium leading-tight tracking-tight text-ink">
              {tr('customer.home.servicesTitle')}
            </h2>
          </div>
          <Link
            href="/directory"
            className="hidden shrink-0 items-center gap-1.5 text-sm font-semibold text-ink underline underline-offset-4 sm:inline-flex"
          >
            {tr('customer.home.exploreAll')}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {SERVICES.map(({ key, icon: Icon, hintKey }) => (
            <button
              key={key}
              onClick={() => searchCategory(key)}
              className={
                'group rounded-[20px] border border-line bg-surface p-5 text-left shadow-kit-card transition-all duration-300 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-kit-pop active:translate-y-0 active:scale-[0.98] ' +
                (highlighted === key ? 'ej-svc-tint' : '')
              }
            >
              <Icon className="h-7 w-7 text-ink transition-transform duration-300 group-hover:scale-110" />
              <span className="mt-4 block text-[16px] font-bold text-ink">
                {tr(`customer.categories.${key}`)}
              </span>
              <span className="mt-0.5 block text-[13px] leading-snug text-ink-2">
                {tr(hintKey)}
              </span>
            </button>
          ))}
        </div>
        <Link
          href="/directory"
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink underline underline-offset-4 sm:hidden"
        >
          {tr('customer.home.exploreAll')}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </section>

      {/* Get it done for me — lime banner */}
      <Link
        href="/customer/concierge"
        className="ej-anim-fade-up group flex flex-col gap-5 rounded-[24px] bg-hivis p-6 shadow-kit-card transition-all hover:shadow-kit-pop active:scale-[0.99] sm:flex-row sm:items-center sm:p-7"
        style={{ animationDelay: '200ms' }}
      >
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-asphalt transition-transform group-active:scale-95">
          <Sparkles className="h-6 w-6 text-lime" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-hivis-ink">
            {tr('customer.home.bannerEyebrow')}
          </span>
          <span className="block text-[22px] font-bold leading-tight text-hivis-ink">
            {tr('customer.home.bannerTitle')}
          </span>
          <span className="mt-0.5 block text-sm text-hivis-ink/80">
            {tr('customer.home.bannerHint')}
          </span>
        </span>
        <span className="inline-flex min-h-[48px] shrink-0 items-center justify-center gap-2 rounded-full bg-asphalt px-5 text-sm font-bold text-hero-ink">
          {tr('customer.home.getItDone')}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </Link>

      {/* Pros */}
      <section>
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            {!searching && <p className="ej-eyebrow">{tr('customer.home.prosEyebrow')}</p>}
            <h2 className="mt-2 text-[28px] font-medium leading-tight tracking-tight text-ink">
              {searching
                ? tr('customer.home.prosFound')
                    .replace('{count}', String(results.length))
                    .replaceAll('{s}', results.length === 1 ? '' : locale === 'fr' ? 's' : 's')
                : tr('customer.home.prosTitle')}
              {searching && initialQ && (
                <span className="font-medium text-ink-2">
                  {' '}
                  {tr('customer.home.forQuery').replace('{q}', initialQ)}
                </span>
              )}
            </h2>
          </div>
          {searching ? (
            <button
              onClick={() => {
                setQ('');
                router.push('/customer');
              }}
              className="min-h-[44px] shrink-0 text-xs font-semibold text-ink underline underline-offset-2"
            >
              {tr('customer.home.clear')}
            </button>
          ) : (
            <Link
              href="/directory"
              className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-ink underline underline-offset-4"
            >
              {tr('customer.home.viewDirectory')}
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>

        {results.length === 0 ? (
          <div className="ej-anim-fade-up rounded-3xl border border-line bg-surface p-10 text-center shadow-sm">
            <div className="ej-icon mx-auto mb-4">
              <SearchX className="h-6 w-6" />
            </div>
            <p className="font-bold text-ink">
              {searching ? tr('customer.home.noProsFound') : tr('customer.home.noProsYet')}
            </p>
            <p className="mx-auto mt-1 max-w-xs text-sm text-ink-2">
              {searching ? tr('customer.home.noProsFoundHint') : tr('customer.home.noProsYetHint')}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visiblePros.map((pro, i) => (
              <div
                key={pro.id}
                className="ej-anim-fade-up"
                style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}
              >
                <ProCard
                  pro={pro}
                  saved={saved.has(pro.id)}
                  onToggleSave={toggleSave}
                  locale={locale}
                />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
