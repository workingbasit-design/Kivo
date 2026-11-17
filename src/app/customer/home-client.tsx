"use client";

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  Search,
  MapPin,
  Wrench,
  PlugZap,
  Broom,
  Snowflake,
  Hammer,
  PaintRoller,
  Drop,
  Tree,
  House,
  Bug,
  Sparkles,
  ShieldCheck,
  HandCoins,
  MessageSquare,
  ArrowRight,
  Plus,
  Store,
  Bell,
} from '@/components/icons';
import { toggleSavePro } from '@/app/actions/customer-pros';
import { t, type Locale } from '@/lib/i18n';
import ProCard, { type ProCardData } from '@/components/ProCard';

/**
 * Signed-in customer home - ChatGPT customer-home redesign, adapted to the
 * real /customer data flow (2026-11-16). Same reference design as the
 * public homepage: the local hero photo (never the old Unsplash
 * placeholder), pill search, six service cards with the same treatment as
 * the public homepage (bare green icon, name, chevron — the HVAC detail
 * line only, like /), pros section with a real minimum-rating filter, the
 * public empty state, and the trust strip. All data is real directory
 * data; the empty state shows only when the real query returns nothing.
 * The signed-in header (lime mark, pill nav, real "Hi {firstName}") lives
 * in CustomerHeader and is unchanged, as is the bottom tab bar on mobile.
 *
 * Theme parity with / (2026-11-16): every shared component — search bar
 * and deep-green primary action, service cards, rating chips, trust strip,
 * headings — copies the public homepage's values token for token. The
 * hero note is a real link to the directory (not a dead card), and "Change
 * location" scrolls to and focuses the search bar's location field.
 */
const SERVICES = [
  { key: 'Plumbing', icon: Wrench },
  { key: 'Electrical', icon: PlugZap },
  { key: 'Cleaning', icon: Broom },
  { key: 'HVAC', icon: Snowflake },
  { key: 'Handyman', icon: Hammer },
  { key: 'Painting', icon: PaintRoller },
  { key: 'Bathroom', icon: Drop },
  { key: 'Landscaping', icon: Tree },
  { key: 'Home comfort', icon: House },
  { key: 'Pest Control', icon: Bug },
  { key: 'Home projects', icon: Sparkles },
] as const;

const RATING_OPTIONS = ['', '4', '4.5'] as const;

export default function CustomerHomeClient({
  results,
  searching,
  initialQ,
  initialCity,
  initialMinRating,
  savedIds,
  locale,
}: {
  results: ProCardData[];
  searching: boolean;
  initialQ: string;
  initialCity: string;
  initialMinRating: string;
  savedIds: string[];
  locale: Locale;
}) {
  const router = useRouter();
  const tr = (path: string) => t(locale, path as never);
  const [q, setQ] = useState(initialQ);
  // The search location shows the same default city the pros list is
  // actually filtered by (see displayCity below) — a customer with no
  // saved city sees "Etobicoke" here, like the public homepage's prefilled
  // "Etobicoke, Toronto", instead of an empty field above an
  // "Pros in Etobicoke, Toronto" heading.
  const [city, setCity] = useState(initialCity || 'Etobicoke');
  const [minRating, setMinRating] = useState(initialMinRating);
  const [saved, setSaved] = useState<Set<string>>(new Set(savedIds));
  const [showAllServices, setShowAllServices] = useState(false);
  const cityInputRef = useRef<HTMLInputElement>(null);

  const buildParams = (next: { q?: string; city?: string; minRating?: string }) => {
    const params = new URLSearchParams();
    const nq = next.q ?? q;
    const nc = next.city ?? city;
    const nr = next.minRating ?? minRating;
    if (nq.trim()) params.set('q', nq.trim());
    if (nc.trim()) params.set('city', nc.trim());
    if (nr) params.set('minRating', nr);
    return params;
  };

  const navigate = (next: { q?: string; city?: string; minRating?: string }) => {
    const params = buildParams(next);
    router.push(`/customer${params.toString() ? `?${params}` : ''}`);
  };

  const doSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    navigate({});
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
    navigate({ q: cat });
  };

  const setRating = (value: string) => {
    setMinRating(value);
    navigate({ minRating: value });
  };

  const clearSearch = () => {
    setQ('');
    setMinRating('');
    // Back to the default view: bare URL, input showing the default city.
    setCity(initialCity || 'Etobicoke');
    navigate({ q: '', city: '', minRating: '' });
  };

  const focusLocation = () => {
    document
      .getElementById('professional-search')
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    cityInputRef.current?.focus({ preventScroll: true });
  };

  const shownServices = showAllServices ? SERVICES : SERVICES.slice(0, 6);
  const visiblePros = searching ? results : results.slice(0, 3);
  const displayCity = initialCity.trim() || 'Etobicoke';
  const citySuffix = displayCity.toLowerCase() === 'etobicoke' ? ', Toronto' : '';
  const prosHeading = searching
    ? tr('customer.home.prosFound')
        .replace('{count}', String(results.length))
        .replaceAll('{s}', results.length === 1 ? '' : 's')
    : `${tr('customer.publicHome.prosIn')} ${displayCity}${citySuffix}`;
  const year = new Date().getFullYear();

  return (
    <div>
      {/* Hero */}
      <section className="ej-cust-hero" aria-labelledby="ej-cust-title">
        <div className="ej-cust-hero-copy ej-anim-fade-up">
          <p className="ej-eyebrow">{tr('customer.home.heroEyebrow')}</p>
          <h1 id="ej-cust-title" className="ej-cust-hero-title">
            {tr('customer.home.heroLine1')}
            <br />
            <span className="ej-cust-highlight">{tr('customer.home.heroLine2')}</span>
          </h1>
          <p className="ej-cust-hero-sub">{tr('customer.home.heroSub')}</p>
          <div className="ej-cust-hero-proof">
            <span>
              <i aria-hidden="true" />
              {tr('customer.home.heroProofFree')}
            </span>
            <span>
              <i aria-hidden="true" />
              {tr('customer.home.heroProofLocal')}
            </span>
          </div>
        </div>

        <div className="ej-cust-hero-visual ej-anim-fade-up" style={{ animationDelay: '80ms' }}>
          <div className="ej-cust-hero-backplate" aria-hidden="true" />
          <div className="ej-cust-hero-frame">
            <Image
              src="/images/everyjob-customer-home-hero.jpg"
              alt=""
              fill
              priority
              sizes="(max-width: 700px) 100vw, 50vw"
            />
          </div>
          <Link href="/directory" className="ej-cust-hero-note">
            <span className="ej-cust-note-icon">
              <Sparkles size={14} />
            </span>
            <span>
              <b>{tr('customer.home.heroNoteTitle')}</b>
              <small>{tr('customer.home.heroNoteSub')}</small>
            </span>
            <ArrowRight size={16} className="ej-cust-note-arrow" />
          </Link>
        </div>
      </section>

      {/* Search bar */}
      <form
        id="professional-search"
        onSubmit={doSearch}
        className="ej-anim-fade-up"
        style={{ animationDelay: '120ms' }}
      >
        <div className="ej-cust-search">
          <label className="ej-cust-search-field ej-cust-search-query">
            <Search size={19} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={tr('customer.home.whatPlaceholder')}
              maxLength={100}
              aria-label={tr('customer.home.whatPlaceholder')}
            />
          </label>
          <span className="ej-cust-search-divider" aria-hidden="true" />
          <label className="ej-cust-search-field ej-cust-search-location">
            <MapPin size={18} />
            <input
              ref={cityInputRef}
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder={tr('customer.home.cityPlaceholder')}
              maxLength={100}
              aria-label={tr('customer.home.cityPlaceholder')}
            />
          </label>
          <button type="submit" className="ej-cust-search-submit">
            {tr('customer.home.searchProfessionals')}
            <ArrowRight size={16} />
          </button>
        </div>
      </form>

      {/* Services */}
      <section
        className="ej-cust-services ej-anim-fade-up"
        style={{ animationDelay: '160ms' }}
        aria-labelledby="ej-cust-services-title"
      >
        <div className="ej-cust-services-heading">
          <div>
            <p className="ej-eyebrow">{tr('customer.home.servicesEyebrow')}</p>
            <h2 id="ej-cust-services-title" className="ej-cust-section-heading">
              {tr('customer.home.servicesTitle')}
            </h2>
          </div>
          <button
            type="button"
            className="ej-cust-explore-link"
            onClick={() => setShowAllServices((v) => !v)}
            aria-expanded={showAllServices}
          >
            {showAllServices
              ? tr('customer.home.showPopularServices')
              : tr('customer.home.exploreAll')}
            <ArrowRight size={15} />
          </button>
        </div>
        <div className="ej-cust-service-grid">
          {shownServices.map(({ key, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => searchCategory(key)}
              className="ej-cust-service-card"
            >
              <span className="ej-cust-service-icon">
                <Icon size={25} strokeWidth={1.8} />
              </span>
              <span className="ej-cust-service-text">
                <b>{tr(`customer.categories.${key}`)}</b>
                {key === 'HVAC' ? (
                  <small>{tr('customer.publicHome.serviceHvacDetail')}</small>
                ) : null}
              </span>
              <ArrowRight size={15} className="ej-cust-service-arrow" />
            </button>
          ))}
        </div>
      </section>

      {/* Get it done for me - lime banner (real feature, kept from the old home) */}
      <Link
        href="/customer/concierge"
        className="ej-anim-fade-up group mb-11 flex flex-col gap-5 rounded-[24px] bg-hivis p-6 shadow-kit-card transition-all hover:shadow-kit-pop active:scale-[0.99] sm:flex-row sm:items-center sm:p-7"
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
      <section className="ej-cust-pros" aria-labelledby="ej-cust-pros-title">
        <div className="ej-cust-pros-topline">
          <div>
            <p className="ej-eyebrow">
              <span className="ej-cust-pin-dot" aria-hidden="true" />
              {tr('customer.home.heroProofLocal')}
            </p>
            <h2 id="ej-cust-pros-title" className="ej-cust-pros-heading">
              {prosHeading}
              {searching && initialQ && (
                <span className="font-medium text-ink-2">
                  {' '}
                  {tr('customer.home.forQuery').replace('{q}', initialQ)}
                </span>
              )}
            </h2>
          </div>
          <button type="button" className="ej-cust-change-location" onClick={focusLocation}>
            <MapPin size={15} />
            {tr('customer.publicHome.changeLocation')}
          </button>
        </div>
        <div className="ej-cust-filter-row">
          <span className="ej-cust-filter-label">{tr('customer.publicHome.minRating')}</span>
          {RATING_OPTIONS.map((value) => (
            <button
              key={value || 'any'}
              type="button"
              className={'ej-cust-filter-chip' + (minRating === value ? ' selected' : '')}
              onClick={() => setRating(value)}
              aria-pressed={minRating === value}
            >
              {value === ''
                ? tr('customer.publicHome.ratingAny')
                : value === '4'
                  ? tr('customer.publicHome.rating4')
                  : tr('customer.publicHome.rating45')}
            </button>
          ))}
          {initialQ && (
            <span className="ej-cust-active-search">
              {tr('customer.home.showingLabel').replace('{service}', initialQ)}
            </span>
          )}
          {searching ? (
            <button
              type="button"
              onClick={clearSearch}
              className="ml-auto min-h-[44px] shrink-0 text-xs font-semibold text-ink underline underline-offset-2"
            >
              {tr('customer.home.clear')}
            </button>
          ) : (
            <Link
              href="/directory"
              className="ml-auto inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-ink underline underline-offset-4"
            >
              {tr('customer.home.viewDirectory')}
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>

        {results.length === 0 ? (
          <div className="ej-home-empty ej-anim-fade-up">
            <div className="ej-home-empty-art">
              <Image
                src="/images/everyjob-customer-home-empty-state.jpg"
                alt=""
                fill
                sizes="(max-width: 760px) 100vw, 30vw"
              />
            </div>
            <div className="ej-home-empty-content">
              <h3>{tr('customer.publicHome.emptyTitle')}</h3>
              <p>{tr('customer.publicHome.emptyText').replace('{city}', displayCity)}</p>
              <div className="ej-home-empty-actions">
                <Link
                  href={`/customer${city.trim() ? `?city=${encodeURIComponent(city.trim())}` : ''}`}
                  className="ej-home-broaden"
                >
                  <Search size={19} />
                  {tr('customer.publicHome.broadenSearch')}
                </Link>
                <Link href="/register" className="ej-home-invite">
                  <Plus size={20} />
                  {tr('customer.publicHome.invitePro')}
                </Link>
              </div>
              <div className="ej-home-empty-tips">
                <div>
                  <MapPin size={22} />
                  <span>{tr('customer.publicHome.tipNearby')}</span>
                </div>
                <div>
                  <Store size={22} />
                  <span>{tr('customer.publicHome.tipGeneral')}</span>
                </div>
                <div>
                  <Bell size={22} />
                  <span>{tr('customer.publicHome.tipFirst')}</span>
                </div>
              </div>
            </div>
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

      {/* Trust strip */}
      <section className="ej-cust-trust" aria-label="Why EveryJob">
        <div className="ej-cust-trust-item">
          <span className="ej-cust-trust-icon">
            <ShieldCheck size={31} />
          </span>
          <span>
            <b>{tr('customer.publicHome.trustFreeTitle')}</b>
            <small>{tr('customer.publicHome.trustFreeText')}</small>
          </span>
        </div>
        <div className="ej-cust-trust-item">
          <span className="ej-cust-trust-icon">
            <HandCoins size={31} />
          </span>
          <span>
            <b>{tr('customer.publicHome.trustNoCommissionTitle')}</b>
            <small>{tr('customer.publicHome.trustNoCommissionText')}</small>
          </span>
        </div>
        <div className="ej-cust-trust-item">
          <span className="ej-cust-trust-icon">
            <MessageSquare size={31} />
          </span>
          <span>
            <b>{tr('customer.publicHome.trustDirectTitle')}</b>
            <small>{tr('customer.publicHome.trustDirectText')}</small>
          </span>
        </div>
      </section>

      <footer className="ej-cust-footer">
        <span>
          EVERYJOB<span className="ej-cust-footer-dot">.</span>
        </span>
        <span>{tr('customer.home.footerTagline')}</span>
        <span>© {year} EveryJob</span>
      </footer>
    </div>
  );
}
