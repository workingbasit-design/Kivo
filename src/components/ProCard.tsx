"use client";

import Link from 'next/link';
import { Star, BadgeCheck, Heart, MessageSquareQuote, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ProCardData = {
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

/**
 * Shared pro card for the customer experience — used on search results
 * and the saved pros page. Rich visual design: gradient avatar fallback,
 * rating pill, verified badge, service chips, prominent quote CTA.
 */
export default function ProCard({
  pro,
  saved,
  onToggleSave,
  showSave = true,
}: {
  pro: ProCardData;
  saved: boolean;
  onToggleSave?: (businessId: string) => void;
  showSave?: boolean;
}) {
  return (
    <article className="group bg-white rounded-3xl border border-zinc-200/80 p-4 shadow-[0_2px_12px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_24px_rgba(79,70,229,0.10)] hover:border-indigo-200 transition-all">
      <div className="flex items-start gap-3">
        <div className="relative shrink-0">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center overflow-hidden shadow-md shadow-indigo-500/20">
            {pro.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={pro.logoUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xl font-bold text-white">
                {pro.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          {pro.verified && (
            <span className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow-sm">
              <BadgeCheck className="w-5 h-5 text-indigo-600 fill-indigo-100" aria-label="Verified pro" />
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-[16px] text-zinc-900 truncate leading-tight">
            {pro.name}
          </h3>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {pro.avg != null ? (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-zinc-800 bg-amber-50 border border-amber-200/70 rounded-full px-2 py-0.5">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                {pro.avg.toFixed(1)}
                <span className="font-medium text-zinc-500">({pro.count})</span>
              </span>
            ) : (
              <span className="text-[11px] font-medium text-zinc-400 bg-zinc-100 rounded-full px-2 py-0.5">
                New pro
              </span>
            )}
            {pro.locality && (
              <span className="inline-flex items-center gap-0.5 text-xs text-zinc-500">
                <MapPin className="w-3 h-3" />
                <span className="truncate max-w-[120px]">{pro.locality}</span>
              </span>
            )}
          </div>
          {pro.services.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {pro.services.slice(0, 3).map((s) => (
                <span
                  key={s}
                  className="text-[11px] font-medium bg-indigo-50 text-indigo-700 rounded-full px-2 py-0.5"
                >
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>

        {showSave && onToggleSave && (
          <button
            onClick={() => onToggleSave(pro.id)}
            aria-label={saved ? 'Remove from saved' : 'Save pro'}
            className={cn(
              'p-2 -m-1 shrink-0 rounded-full transition-all active:scale-90',
              saved ? 'text-rose-500' : 'text-zinc-300 hover:text-rose-400'
            )}
          >
            <Heart
              className={cn('w-6 h-6 transition-all', saved && 'fill-rose-500 scale-110')}
            />
          </button>
        )}
      </div>

      <div className="flex gap-2 mt-4">
        <Link
          href={`/customer/request/${pro.slug}`}
          className="flex-1 min-h-[46px] inline-flex items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-700 text-white text-sm font-bold shadow-md shadow-indigo-600/25 hover:shadow-lg hover:shadow-indigo-600/30 active:scale-[0.98] transition-all"
        >
          <MessageSquareQuote className="w-4 h-4" />
          Request quote
        </Link>
        <Link
          href={`/p/${pro.slug}`}
          className="min-h-[46px] px-5 inline-flex items-center justify-center rounded-2xl bg-zinc-100 text-zinc-700 text-sm font-semibold hover:bg-zinc-200 active:scale-[0.98] transition-all"
        >
          View
        </Link>
      </div>
    </article>
  );
}
