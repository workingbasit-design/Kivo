"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, MapPin, Star, BadgeCheck, Heart, MessageSquareQuote } from 'lucide-react';
import { toggleSavePro } from '@/app/actions/customer-pros';
import { cn } from '@/lib/utils';

type ProResult = {
  id: string;
  name: string;
  logoUrl: string | null;
  slug: string;
  locality: string | null;
  services: string[];
  verified: boolean;
  count: number;
  avg: number | null;
};

const CATEGORIES = [
  'Plumbing',
  'Electrical',
  'Cleaning',
  'HVAC',
  'Landscaping',
  'Painting',
  'Roofing',
  'Pest Control',
];

export default function CustomerHomeClient({
  results,
  searching,
  initialQ,
  initialCity,
  savedIds,
  customerName,
}: {
  results: ProResult[];
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

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-zinc-900">
          Hi {customerName}, find a pro
        </h1>
        <p className="text-sm text-zinc-500 mt-0.5">Trusted local pros, verified phone numbers.</p>
      </div>

      <form onSubmit={doSearch} className="space-y-2">
        <label className="relative block">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="What do you need? e.g. plumber"
            maxLength={100}
            aria-label="Service needed"
            className="w-full min-h-[48px] rounded-2xl bg-white border border-zinc-200 pl-10 pr-4 text-[15px] outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
        </label>
        <div className="flex gap-2">
          <label className="relative block flex-1">
            <MapPin size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="City"
              maxLength={100}
              aria-label="City"
              className="w-full min-h-[48px] rounded-2xl bg-white border border-zinc-200 pl-10 pr-4 text-[15px] outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </label>
          <button
            type="submit"
            className="min-h-[48px] px-6 rounded-2xl bg-indigo-600 text-white text-[15px] font-bold active:scale-[0.97] transition-transform"
          >
            Search
          </button>
        </div>
      </form>

      {!searching && (
        <div>
          <h2 className="text-sm font-bold text-zinc-700 mb-2">Browse categories</h2>
          <div className="grid grid-cols-2 gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  setQ(cat);
                  const params = new URLSearchParams();
                  params.set('q', cat);
                  if (city.trim()) params.set('city', city.trim());
                  router.push(`/customer?${params}`);
                }}
                className="min-h-[52px] rounded-2xl bg-white border border-zinc-200 text-sm font-semibold text-zinc-700 active:scale-[0.98] transition-transform hover:border-indigo-300"
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-sm font-bold text-zinc-700 mb-2">
          {searching ? `${results.length} pro${results.length === 1 ? '' : 's'} found` : 'Top rated near you'}
        </h2>
        {results.length === 0 ? (
          <div className="bg-white rounded-2xl border border-zinc-200 p-8 text-center">
            <p className="text-sm text-zinc-500">
              {searching
                ? 'No pros found. Try a different service or city.'
                : 'No verified pros yet. Check back soon!'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {results.map((pro) => (
              <article
                key={pro.id}
                className="bg-white rounded-2xl border border-zinc-200 p-4 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0 overflow-hidden">
                    {pro.logoUrl ? (
                      <img src={pro.logoUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-lg font-bold text-indigo-600">
                        {pro.name.charAt(0)}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-bold text-[15px] text-zinc-900 truncate">{pro.name}</h3>
                      {pro.verified && (
                        <BadgeCheck className="w-4 h-4 text-indigo-600 shrink-0" aria-label="Verified" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-zinc-500">
                      {pro.avg != null && (
                        <span className="flex items-center gap-1 font-semibold text-zinc-700">
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                          {pro.avg.toFixed(1)} ({pro.count})
                        </span>
                      )}
                      {pro.locality && <span className="truncate">{pro.locality}</span>}
                    </div>
                    {pro.services.length > 0 && (
                      <p className="text-xs text-zinc-500 mt-1 truncate">
                        {pro.services.slice(0, 3).join(' · ')}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => toggleSave(pro.id)}
                    aria-label={saved.has(pro.id) ? 'Unsave' : 'Save'}
                    className="p-2 -m-1 shrink-0"
                  >
                    <Heart
                      className={cn(
                        'w-5 h-5 transition-colors',
                        saved.has(pro.id) ? 'fill-rose-500 text-rose-500' : 'text-zinc-300'
                      )}
                    />
                  </button>
                </div>
                <div className="flex gap-2 mt-3">
                  <Link
                    href={`/customer/request/${pro.slug}`}
                    className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 text-white text-sm font-bold active:scale-[0.98] transition-transform"
                  >
                    <MessageSquareQuote className="w-4 h-4" />
                    Request quote
                  </Link>
                  <Link
                    href={`/directory/${pro.slug}`}
                    className="min-h-[44px] px-4 inline-flex items-center justify-center rounded-xl bg-zinc-100 text-zinc-700 text-sm font-semibold active:scale-[0.98] transition-transform"
                  >
                    View
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
