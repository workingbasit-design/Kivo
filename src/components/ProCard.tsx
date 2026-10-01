"use client";

import Link from 'next/link';
import { Star, BadgeCheck, Heart, MessageSquareQuote, MapPin } from 'lucide-react';
import { t, type Locale } from '@/lib/i18n';
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
 * and the saved pros page. Clean EveryJob theme: white card, indigo
 * accents, refined hover and press micro-interactions.
 */
export default function ProCard({
  pro,
  saved,
  onToggleSave,
  showSave = true,
  locale,
}: {
  pro: ProCardData;
  saved: boolean;
  onToggleSave?: (businessId: string) => void;
  showSave?: boolean;
  locale: Locale;
}) {
  const tr = (path: string) => t(locale, path as never);
  return (
    <article className="group bg-white rounded-3xl border border-zinc-200/80 p-4 shadow-[0_2px_12px_rgba(0,0,0,0.04)] transition-all duration-300 hover:shadow-[0_12px_32px_rgba(79,70,229,0.12)] hover:border-indigo-200 hover:-translate-y-0.5">
      <div className="flex items-start gap-3">
        <div className="relative shrink-0">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center overflow-hidden transition-transform duration-300 group-hover:scale-105">
            {pro.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={pro.logoUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xl font-bold text-indigo-600">
                {pro.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          {pro.verified && (
            <span className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow-sm transition-transform duration-300 group-hover:scale-110">
              <BadgeCheck className="w-5 h-5 text-indigo-600 fill-indigo-100" aria-label={tr('customer.proCard.verified')} />
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
                {tr('customer.proCard.newPro')}
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
            aria-label={saved ? tr('customer.proCard.unsave') : tr('customer.proCard.save')}
            className={cn(
              'ej-icon-hover p-2 -m-1 shrink-0 rounded-full',
              saved ? 'text-rose-500' : 'text-zinc-300 hover:text-rose-400 hover:bg-rose-50'
            )}
          >
            <Heart
              className={cn('w-6 h-6 transition-all duration-300', saved && 'fill-rose-500 scale-110')}
            />
          </button>
        )}
      </div>

      <div className="flex gap-2 mt-4">
        <Link
          href={`/customer/request/${pro.slug}`}
          className="flex-1 min-h-[46px] inline-flex items-center justify-center gap-1.5 rounded-2xl bg-indigo-600 text-white text-sm font-bold shadow-sm shadow-indigo-600/20 transition-all duration-200 hover:bg-indigo-700 hover:shadow-md hover:shadow-indigo-600/25 hover:-translate-y-px active:translate-y-0 active:scale-[0.98]"
        >
          <MessageSquareQuote className="w-4 h-4 transition-transform duration-300 group-hover:scale-110" />
          {tr('customer.proCard.requestQuote')}
        </Link>
        <Link
          href={`/p/${pro.slug}`}
          className="min-h-[46px] px-5 inline-flex items-center justify-center rounded-2xl bg-zinc-100 text-zinc-700 text-sm font-semibold transition-all duration-200 hover:bg-zinc-200 hover:-translate-y-px active:translate-y-0 active:scale-[0.98]"
        >
          {tr('customer.proCard.view')}
        </Link>
      </div>
    </article>
  );
}
