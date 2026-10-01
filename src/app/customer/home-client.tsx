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
import ProCard, { type ProCardData } from '@/components/ProCard';

const CATEGORIES = [
  { name: 'Plumbing', icon: Wrench, color: 'from-sky-500 to-blue-600', bg: 'bg-sky-50', text: 'text-sky-700' },
  { name: 'Electrical', icon: Zap, color: 'from-amber-500 to-orange-600', bg: 'bg-amber-50', text: 'text-amber-700' },
  { name: 'Cleaning', icon: Sparkles, color: 'from-emerald-500 to-teal-600', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  { name: 'HVAC', icon: Flame, color: 'from-rose-500 to-red-600', bg: 'bg-rose-50', text: 'text-rose-700' },
  { name: 'Landscaping', icon: TreePine, color: 'from-green-500 to-lime-600', bg: 'bg-green-50', text: 'text-green-700' },
  { name: 'Painting', icon: PaintRoller, color: 'from-violet-500 to-purple-600', bg: 'bg-violet-50', text: 'text-violet-700' },
  { name: 'Roofing', icon: Home, color: 'from-slate-500 to-zinc-700', bg: 'bg-slate-100', text: 'text-slate-700' },
  { name: 'Pest Control', icon: Bug, color: 'from-lime-600 to-green-700', bg: 'bg-lime-50', text: 'text-lime-800' },
];

export default function CustomerHomeClient({
  results,
  searching,
  initialQ,
  initialCity,
  savedIds,
  customerName,
}: {
  results: ProCardData[];
  searching: boolean;
  initialQ: string;
  initialCity: string;
  savedIds: string[];
  customerName: string;
}) {
  const router = useRouter();
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
    <div className="space-y-6 -mt-4 -mx-4 px-4 pt-0">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-b-[28px] -mx-4 px-4 pb-6 pt-5 bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 text-white">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 10%, white 0, transparent 30%), radial-gradient(circle at 85% 90%, white 0, transparent 25%)',
          }}
        />
        <div className="relative">
          <p className="text-indigo-200 text-xs font-semibold uppercase tracking-widest">
            {new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening'}
          </p>
          <h1 className="text-2xl font-bold tracking-tight mt-0.5">
            Hi {customerName} 👋
          </h1>
          <p className="text-indigo-200 text-sm mt-1">
            Find trusted local pros for every job.
          </p>

          <form onSubmit={doSearch} className="mt-4 space-y-2">
            <label className="relative block">
              <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="What do you need? e.g. plumber"
                maxLength={100}
                aria-label="Service needed"
                className="w-full min-h-[52px] rounded-2xl bg-white border-0 pl-11 pr-4 text-[15px] text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-4 focus:ring-white/30 shadow-lg"
              />
            </label>
            <div className="flex gap-2">
              <label className="relative block flex-1">
                <MapPin size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="City"
                  maxLength={100}
                  aria-label="City"
                  className="w-full min-h-[52px] rounded-2xl bg-white/95 border-0 pl-11 pr-4 text-[15px] text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-4 focus:ring-white/30 shadow-lg"
                />
              </label>
              <button
                type="submit"
                className="min-h-[52px] px-6 rounded-2xl bg-zinc-900 text-white text-[15px] font-bold shadow-lg active:scale-[0.97] transition-transform hover:bg-zinc-800"
              >
                Search
              </button>
            </div>
          </form>
        </div>
      </div>

      {!searching && (
        <div>
          <h2 className="text-[15px] font-bold text-zinc-900 mb-3">Browse categories</h2>
          <div className="grid grid-cols-4 gap-2.5">
            {CATEGORIES.map(({ name, icon: Icon, bg, text }) => (
              <button
                key={name}
                onClick={() => searchCategory(name)}
                className="flex flex-col items-center gap-1.5 py-3.5 px-1 rounded-2xl bg-white border border-zinc-200/80 shadow-sm active:scale-[0.95] transition-transform hover:border-indigo-200 hover:shadow-md"
              >
                <span className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${text}`} />
                </span>
                <span className="text-[11px] font-semibold text-zinc-700 leading-tight text-center">
                  {name}
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
                {results.length} pro{results.length === 1 ? '' : 's'} found
                {initialQ && <span className="text-zinc-500 font-medium"> for “{initialQ}”</span>}
              </>
            ) : (
              'Top rated near you'
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
              Clear
            </button>
          )}
        </div>

        {results.length === 0 ? (
          <div className="bg-white rounded-3xl border border-zinc-200/80 p-10 text-center shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-4">
              <SearchX className="w-7 h-7 text-indigo-400" />
            </div>
            <p className="font-bold text-zinc-900">
              {searching ? 'No pros found' : 'No verified pros yet'}
            </p>
            <p className="text-sm text-zinc-500 mt-1 max-w-xs mx-auto">
              {searching
                ? 'Try a different service or city — new pros join every day.'
                : 'Check back soon — verified pros are joining every day.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {results.map((pro) => (
              <ProCard
                key={pro.id}
                pro={pro}
                saved={saved.has(pro.id)}
                onToggleSave={toggleSave}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
