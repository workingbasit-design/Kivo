"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
} from 'lucide-react';
import { toggleSavePro } from '@/app/actions/customer-pros';
import { t, type Locale } from '@/lib/i18n';
import ProCard, { type ProCardData } from '@/components/ProCard';

const CATEGORIES = [
  { key: 'Plumbing', icon: Wrench, bg: 'bg-sky-50', text: 'text-sky-700' },
  { key: 'Electrical', icon: Zap, bg: 'bg-amber-50', text: 'text-amber-700' },
  { key: 'Cleaning', icon: Sparkles, bg: 'bg-emerald-50', text: 'text-emerald-700' },
  { key: 'HVAC', icon: Flame, bg: 'bg-rose-50', text: 'text-rose-700' },
  { key: 'Landscaping', icon: TreePine, bg: 'bg-green-50', text: 'text-green-700' },
  { key: 'Painting', icon: PaintRoller, bg: 'bg-violet-50', text: 'text-violet-700' },
  { key: 'Roofing', icon: Home, bg: 'bg-slate-100', text: 'text-slate-700' },
  { key: 'Pest Control', icon: Bug, bg: 'bg-lime-50', text: 'text-lime-800' },
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
      {/* Hero — clean EveryJob theme with staggered entrance */}
      <div className="ej-anim-fade-up">
        <p className="text-indigo-600 text-xs font-bold uppercase tracking-widest">
          {new Date().getHours() < 12
            ? tr('customer.home.morning')
            : new Date().getHours() < 18
              ? tr('customer.home.afternoon')
              : tr('customer.home.evening')}
        </p>
        <h1 className="text-[26px] font-bold tracking-tight text-zinc-900 mt-1">
          {tr('customer.home.greeting').replace('{name}', customerName)}
        </h1>
        <p className="text-zinc-500 text-sm mt-1">
          {tr('customer.home.tagline')}
        </p>
      </div>

      <form onSubmit={doSearch} className="ej-anim-fade-up space-y-2" style={{ animationDelay: '80ms' }}>
        <label className="relative block group">
          <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 transition-colors group-focus-within:text-indigo-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={tr('customer.home.whatPlaceholder')}
            maxLength={100}
            aria-label={tr('customer.home.whatPlaceholder')}
            className="w-full min-h-[52px] rounded-2xl bg-white border border-zinc-200 pl-11 pr-4 text-[15px] text-zinc-900 placeholder:text-zinc-400 outline-none shadow-sm transition-all focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 hover:border-zinc-300"
          />
        </label>
        <div className="flex gap-2">
          <label className="relative block flex-1 group">
            <MapPin size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 transition-colors group-focus-within:text-indigo-500" />
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder={tr('customer.home.cityPlaceholder')}
              maxLength={100}
              aria-label={tr('customer.home.cityPlaceholder')}
              className="w-full min-h-[52px] rounded-2xl bg-white border border-zinc-200 pl-11 pr-4 text-[15px] text-zinc-900 placeholder:text-zinc-400 outline-none shadow-sm transition-all focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 hover:border-zinc-300"
            />
          </label>
          <button
            type="submit"
            className="min-h-[52px] px-6 rounded-2xl bg-indigo-600 text-white text-[15px] font-bold shadow-sm shadow-indigo-600/20 transition-all hover:bg-indigo-700 hover:shadow-md hover:shadow-indigo-600/25 hover:-translate-y-px active:translate-y-0 active:scale-[0.97]"
          >
            {tr('customer.home.search')}
          </button>
        </div>
      </form>

      {!searching && (
        <div className="ej-anim-fade-up" style={{ animationDelay: '160ms' }}>
          <h2 className="text-[15px] font-bold text-zinc-900 mb-3">{tr('customer.home.browseCategories')}</h2>
          <div className="grid grid-cols-4 gap-2.5">
            {CATEGORIES.map(({ key, icon: Icon, bg, text }, i) => (
              <button
                key={key}
                onClick={() => searchCategory(key)}
                style={{ animationDelay: `${200 + i * 40}ms` }}
                className="ej-anim-scale-in group flex flex-col items-center gap-1.5 py-3.5 px-1 rounded-2xl bg-white border border-zinc-200/80 shadow-sm transition-all duration-300 hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-100/50 hover:-translate-y-1 active:translate-y-0 active:scale-[0.96]"
              >
                <span className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-active:scale-95`}>
                  <Icon className={`w-5 h-5 ${text}`} />
                </span>
                <span className="text-[11px] font-semibold text-zinc-700 leading-tight text-center">
                  {tr(`customer.categories.${key}`)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[15px] font-bold text-zinc-900">
            {searching ? (
              <>
                {tr('customer.home.prosFound')
                  .replace('{count}', String(results.length))
                  .replaceAll('{s}', results.length === 1 ? '' : locale === 'fr' ? 's' : 's')}
                {initialQ && (
                  <span className="text-zinc-500 font-medium">
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
              className="text-xs font-semibold text-indigo-600 hover:underline"
            >
              {tr('customer.home.clear')}
            </button>
          )}
        </div>

        {results.length === 0 ? (
          <div className="ej-anim-fade-up bg-white rounded-3xl border border-zinc-200/80 p-10 text-center shadow-sm">
            <div className="ej-anim-scale-in w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mx-auto mb-4">
              <SearchX className="w-7 h-7 text-indigo-400" />
            </div>
            <p className="font-bold text-zinc-900">
              {searching ? tr('customer.home.noProsFound') : tr('customer.home.noProsYet')}
            </p>
            <p className="text-sm text-zinc-500 mt-1 max-w-xs mx-auto">
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
