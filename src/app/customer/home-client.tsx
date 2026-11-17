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
  ShieldCheck,
  HandCoins,
  MessageSquare,
  ChevronRight,
  Plus,
  Store,
  Bell,
} from '@/components/icons';
import { toggleSavePro } from '@/app/actions/customer-pros';
import { t, type Locale } from '@/lib/i18n';
import ProCard, { type ProCardData } from '@/components/ProCard';

/**
 * Signed-in customer home - Release 13: rebuilt in the exact reference
 * design ("The right pro. Without the runaround.", the agreed Design A
 * live on the public homepage). It reuses the reference `ej-home-*`
 * markup and classes token for token, so the signed-in page matches the
 * public homepage section for section: hero with the lime swash and the
 * house photo, pill search, rating pills, six service cards, the
 * "Pros in Etobicoke, Toronto" section with the exact empty state, and
 * the trust strip.
 *
 * What stays signed-in (the shell renders the signed-in header with
 * Home / Find a pro / Requests / Saved / Messages, "Hi {firstName}" and
 * the avatar; this client renders no header of its own):
 *   - Search, service cards and rating pills navigate inside /customer
 *     (?q / ?city / ?minRating), so results stay on this page.
 *   - Pros are the real directory query from the server (verified,
 *     consent-based listings); the empty state shows only when that
 *     query returns nothing. Nothing is invented.
 *   - Saved-pro hearts toggle via toggleSavePro.
 *   - "Change location" scrolls to and focuses the search location
 *     field; "Broaden my search" widens to Toronto, still signed in.
 *
 * Reference override (user decision, Nov 17): the Search button on THIS
 * page is the reference's dark-green --ok, not the standing --hivis
 * lime. The override lives in customer-home-signed-in.css, scoped to
 * .ej-cust-ref, so the public homepage keeps its --hivis button.
 */

const SERVICES = [
  { key: 'Plumbing', icon: Wrench },
  { key: 'Electrical', icon: PlugZap },
  { key: 'Cleaning', icon: Broom },
  { key: 'HVAC', icon: Snowflake },
  { key: 'Handyman', icon: Hammer },
  { key: 'Painting', icon: PaintRoller },
] as const;

const RATING_OPTIONS = ['', '4', '4.5'] as const;

// The reference default city, shown in the search field and the pros
// heading when the customer has no saved city. A saved city of plain
// "Etobicoke" normalizes to the same label.
const DEFAULT_CITY_LABEL = 'Etobicoke, Toronto';

function cityLabel(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return DEFAULT_CITY_LABEL;
  return trimmed.toLowerCase() === 'etobicoke' ? DEFAULT_CITY_LABEL : trimmed;
}

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
  const [city, setCity] = useState(cityLabel(initialCity));
  const [minRating, setMinRating] = useState(initialMinRating);
  const [saved, setSaved] = useState<Set<string>>(new Set(savedIds));
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

  const focusLocation = () => {
    document
      .getElementById('professional-search')
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    cityInputRef.current?.focus({ preventScroll: true });
  };

  const visiblePros = searching ? results : results.slice(0, 3);
  const displayCity = initialCity.trim() || 'Etobicoke';
  const citySuffix = displayCity.toLowerCase() === 'etobicoke' ? ', Toronto' : '';
  const displayCityFull = `${displayCity}${citySuffix}`;
  const ratingValue = minRating || 'any';

  return (
    <div className="ej-home ej-cust-ref">
      {/* Hero - exact reference */}
      <section className="ej-home-hero" aria-labelledby="ej-home-title">
        <div className="ej-home-hero-photo" aria-hidden="true">
          <Image
            src="/images/everyjob-customer-home-hero.jpg"
            alt=""
            fill
            priority
            sizes="(max-width: 760px) 100vw, 58vw"
          />
        </div>
        <div className="ej-home-hero-content">
          <h1 id="ej-home-title">
            {tr('customer.publicHome.heroLine1')}
            <br />
            {tr('customer.publicHome.heroLine2')}
          </h1>
          <p className="ej-home-hero-copy">
            {tr('customer.publicHome.heroSub1')}
            <br className="desktop-break" />
            {tr('customer.publicHome.heroSub2')}
          </p>

          <form
            id="professional-search"
            className="ej-home-search"
            onSubmit={doSearch}
          >
            <label className="ej-home-search-service">
              <Wrench size={19} />
              <input
                aria-label={tr('customer.publicHome.searchServiceLabel')}
                value={q}
                onChange={(event) => setQ(event.target.value)}
                placeholder={tr('customer.publicHome.searchServicePlaceholder')}
                maxLength={100}
              />
            </label>
            <span className="ej-home-search-divider" />
            <label className="ej-home-search-location">
              <MapPin size={19} />
              <input
                ref={cityInputRef}
                aria-label={tr('customer.publicHome.searchLocationLabel')}
                value={city}
                onChange={(event) => setCity(event.target.value)}
                maxLength={100}
              />
            </label>
            <button type="submit" className="ej-home-search-button">
              <Search size={19} />
              <span>{tr('customer.publicHome.searchButton')}</span>
            </button>
          </form>

          <div
            className="ej-home-rating-filter"
            aria-label={tr('customer.publicHome.minRating')}
          >
            <span>{tr('customer.publicHome.minRating')}</span>
            {RATING_OPTIONS.map((value) => (
              <button
                key={value || 'any'}
                type="button"
                className={ratingValue === (value || 'any') ? 'selected' : ''}
                onClick={() => setRating(value)}
                aria-pressed={ratingValue === (value || 'any')}
              >
                {value === ''
                  ? `${ratingValue === 'any' ? '✓ ' : ''}${tr('customer.publicHome.ratingAny')}`
                  : value === '4'
                    ? tr('customer.publicHome.rating4')
                    : tr('customer.publicHome.rating45')}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Popular Services - exactly six cards, as in the reference */}
      <section className="ej-home-services" aria-labelledby="ej-home-services-title">
        <div className="ej-home-section-heading">
          <h2 id="ej-home-services-title">{tr('customer.publicHome.servicesTitle')}</h2>
          <Link href="/directory">
            {tr('customer.publicHome.viewAllServices')}{' '}
            <span aria-hidden="true">→</span>
          </Link>
        </div>
        <div className="ej-home-service-grid">
          {SERVICES.map(({ key, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => searchCategory(key)}
              className="ej-home-service-card"
            >
              <span className="ej-home-service-icon">
                <Icon size={25} strokeWidth={1.8} />
              </span>
              <span className="ej-home-service-copy">
                <strong>{tr(`customer.categories.${key}`)}</strong>
                {key === 'HVAC' ? (
                  <small>{tr('customer.publicHome.serviceHvacDetail')}</small>
                ) : null}
              </span>
              <span className="ej-home-service-chevron">
                <ChevronRight size={15} />
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Pros - real directory results, or the exact reference empty state */}
      <section className="ej-home-results" aria-labelledby="ej-home-results-title">
        <div className="ej-home-results-heading">
          <h2 id="ej-home-results-title">
            <MapPin size={23} />{' '}
            <span>
              {searching ? (
                <>
                  {tr('customer.home.prosFound')
                    .replace('{count}', String(results.length))
                    .replaceAll('{s}', results.length === 1 ? '' : 's')}
                  {initialQ && (
                    <span className="font-medium text-ink-2">
                      {' '}
                      {tr('customer.home.forQuery').replace('{q}', initialQ)}
                    </span>
                  )}
                </>
              ) : (
                <>
                  {tr('customer.publicHome.prosIn')} <strong>{displayCityFull}</strong>
                </>
              )}
            </span>
          </h2>
          <button
            type="button"
            className="ej-home-change-location"
            onClick={focusLocation}
          >
            <MapPin size={15} /> {tr('customer.publicHome.changeLocation')}
          </button>
        </div>

        {results.length === 0 ? (
          <div className="ej-home-empty">
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
              <p>
                {tr('customer.publicHome.emptyText').replace('{city}', displayCityFull)}
              </p>
              <div className="ej-home-empty-actions">
                <Link href="/customer?city=Toronto" className="ej-home-broaden">
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
            {visiblePros.map((pro) => (
              <ProCard
                key={pro.id}
                pro={pro}
                saved={saved.has(pro.id)}
                onToggleSave={toggleSave}
                locale={locale}
              />
            ))}
          </div>
        )}
      </section>

      {/* Trust strip - exact reference */}
      <section className="ej-home-trust" aria-label="Why EveryJob">
        <div className="ej-home-trust-item">
          <ShieldCheck size={31} />
          <span>
            <strong>{tr('customer.publicHome.trustFreeTitle')}</strong>
            <small>{tr('customer.publicHome.trustFreeText')}</small>
          </span>
        </div>
        <div className="ej-home-trust-item">
          <HandCoins size={31} />
          <span>
            <strong>{tr('customer.publicHome.trustNoCommissionTitle')}</strong>
            <small>{tr('customer.publicHome.trustNoCommissionText')}</small>
          </span>
        </div>
        <div className="ej-home-trust-item">
          <MessageSquare size={31} />
          <span>
            <strong>{tr('customer.publicHome.trustDirectTitle')}</strong>
            <small>{tr('customer.publicHome.trustDirectText')}</small>
          </span>
        </div>
      </section>
    </div>
  );
}
