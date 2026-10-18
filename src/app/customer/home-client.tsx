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
  Flame,
  TreePine,
  PaintRoller,
  Home,
  Bug,
  SearchX,
  ArrowRight,
} from '@/components/icons';
import { toggleSavePro } from '@/app/actions/customer-pros';
import { t, type Locale } from '@/lib/i18n';
import ProCard, { type ProCardData } from '@/components/ProCard';
import { Button } from '@/components/kit';

const CATEGORIES = [
  { key: 'Plumbing', icon: Wrench, bg: 'bg-info-bg', text: 'text-info' },
  { key: 'Electrical', icon: Zap, bg: 'bg-warn-bg', text: 'text-warn-text' },
  { key: 'Cleaning', icon: Sparkles, bg: 'bg-ok-bg', text: 'text-ok' },
  { key: 'HVAC', icon: Flame, bg: 'bg-danger-bg', text: 'text-danger' },
  { key: 'Landscaping', icon: TreePine, bg: 'bg-ok-bg', text: 'text-ok' },
  { key: 'Painting', icon: PaintRoller, bg: 'bg-surface-2', text: 'text-ink-2' },
  { key: 'Roofing', icon: Home, bg: 'bg-surface-2', text: 'text-ink-2' },
  { key: 'Pest Control', icon: Bug, bg: 'bg-ok-bg', text: 'text-ok' },
] as const;

export default function CustomerHomeClient({
  results,
  searching,
  initialQ,
  initialCity,
  savedIds,
  customerName,
  locale,
}: {
  results: ProCardData[];
  searching: boolean;
  initialQ: string;
  initialCity: string;
  savedIds: string[];
  customerName: string;
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

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="ej-anim-fade-up">
        <p className="text-ink-2 text-xs font-bold">
          {new Date().getHours() < 12
            ? tr('customer.home.morning')
            : new Date().getHours() < 18
              ? tr('customer.home.afternoon')
              : tr('customer.home.evening')}
        </p>
        <h1 className="text-[26px] font-bold tracking-tight text-ink mt-1">
          {tr('customer.home.greeting').replace('{name}', customerName)}
        </h1>
        <p className="text-ink-2 text-sm mt-1">
          {tr('customer.home.tagline')}
        </p>
      </div>

      {/* Get it done for me - concierge entry */}
      <Link
        href="/customer/concierge"
        className="ej-anim-fade-up group flex items-center gap-4 rounded-3xl bg-asphalt p-5 shadow-sm transition-all hover:shadow-lg active:scale-[0.98]"
        style={{ animationDelay: '60ms' }}
      >
        <span className="w-12 h-12 rounded-2xl bg-hivis flex items-center justify-center shrink-0 transition-transform group-active:scale-95">
          <Sparkles size={22} className="text-hivis-ink" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[16px] font-bold text-hero-ink">
            {tr('customer.home.getItDone')}
          </span>
          <span className="block text-[13px] text-ink-2 mt-0.5">
            {tr('customer.home.getItDoneHint')}
          </span>
        </span>
        <ArrowRight size={20} className="text-ink-2 shrink-0 transition-transform group-hover:translate-x-0.5" />
      </Link>

      <form onSubmit={doSearch} className="ej-anim-fade-up space-y-2" style={{ animationDelay: '80ms' }}>
        <label className="relative block group">
          <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-2 transition-colors group-focus-within:text-ink z-10" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={tr('customer.home.whatPlaceholder')}
            maxLength={100}
            aria-label={tr('customer.home.whatPlaceholder')}
            className="input !pl-11"
          />
        </label>
        <div className="flex gap-2">
          <label className="relative block flex-1 group">
            <MapPin size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-2 transition-colors group-focus-within:text-ink z-10" />
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder={tr('customer.home.cityPlaceholder')}
              maxLength={100}
              aria-label={tr('customer.home.cityPlaceholder')}
              className="input !pl-11"
            />
          </label>
          <Button type="submit">
            {tr('customer.home.search')}
          </Button>
        </div>
      </form>

      {!searching && (
        <div className="ej-anim-fade-up" style={{ animationDelay: '160ms' }}>
          <h2 className="text-[15px] font-bold text-ink mb-3">{tr('customer.home.browseCategories')}</h2>
          <div className="grid grid-cols-4 gap-2.5">
            {CATEGORIES.map(({ key, icon: Icon, bg, text }, i) => (
              <button
                key={key}
                onClick={() => searchCategory(key)}
                style={{ animationDelay: `${200 + i * 40}ms` }}
                className="ej-anim-scale-in group flex flex-col items-center gap-1.5 py-3.5 px-1 rounded-2xl bg-surface border border-line/80 shadow-sm transition-all duration-300 hover:border-line-strong hover:shadow-md hover:-translate-y-1 active:translate-y-0 active:scale-[0.96] min-h-[44px]"
              >
                <span className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-active:scale-95`}>
                  <Icon className={`w-5 h-5 ${text}`} />
                </span>
                <span className="text-[11px] font-semibold text-ink leading-tight text-center">
                  {tr(`customer.categories.${key}`)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[15px] font-bold text-ink">
            {searching ? (
              <>
                {tr('customer.home.prosFound')
                  .replace('{count}', String(results.length))
                  .replaceAll('{s}', results.length === 1 ? '' : locale === 'fr' ? 's' : 's')}
                {initialQ && (
                  <span className="text-ink-2 font-medium">
                    {' '}{tr('customer.home.forQuery').replace('{q}', initialQ)}
                  </span>
                )}
              </>
            ) : (
              tr('customer.home.topRated')
            )}
          </h2>
          {searching && (
            <button
              onClick={() => {
                setQ('');
                router.push('/customer');
              }}
              className="text-xs font-semibold text-ink underline underline-offset-2 min-h-[44px]"
            >
              {tr('customer.home.clear')}
            </button>
          )}
        </div>

        {results.length === 0 ? (
          <div className="ej-anim-fade-up bg-surface rounded-3xl border border-line/80 p-10 text-center shadow-sm">
            <div className="ej-anim-scale-in w-14 h-14 rounded-2xl bg-info-bg flex items-center justify-center mx-auto mb-4">
              <SearchX className="w-7 h-7 text-info" />
            </div>
            <p className="font-bold text-ink">
              {searching ? tr('customer.home.noProsFound') : tr('customer.home.noProsYet')}
            </p>
            <p className="text-sm text-ink-2 mt-1 max-w-xs mx-auto">
              {searching ? tr('customer.home.noProsFoundHint') : tr('customer.home.noProsYetHint')}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {results.map((pro, i) => (
              <div key={pro.id} className="ej-anim-fade-up" style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}>
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
      </div>
    </div>
  );
}
