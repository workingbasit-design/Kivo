'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Star, BadgeCheck, Heart, MapPin, ArrowRight } from '@/components/icons';
import { toggleSavePro } from '@/app/actions/customer-pros';
import { t, type Locale } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export type DirectoryProData = {
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
 * Horizontal directory pro card — mockup layout (2026-11-16): photo on
 * the left, name + rating + locality + service tags in the middle, save
 * heart top-right and a lime-outline "View profile" button bottom-right.
 * Real listing data only; the heart shows only for signed-in customers.
 */
export default function DirectoryProCard({
  pro,
  saved,
  showSave,
  locale,
}: {
  pro: DirectoryProData;
  saved: boolean;
  showSave: boolean;
  locale: Locale;
}) {
  const tr = (path: string) => t(locale, path as never);
  const [isSaved, setIsSaved] = useState(saved);

  const toggleSave = async () => {
    const next = !isSaved;
    setIsSaved(next);
    await toggleSavePro(pro.id).catch(() => setIsSaved(saved));
  };

  return (
    <article className="group relative flex flex-col gap-4 rounded-[24px] border border-line bg-surface p-5 shadow-kit-card transition-all duration-300 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-kit-pop sm:flex-row sm:gap-5">
      <div className="flex items-start gap-4 sm:contents">
        <div className="relative shrink-0">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-line bg-surface-2 transition-transform duration-300 group-hover:scale-105 sm:h-24 sm:w-24">
            {pro.logoUrl ? (
              <img src={pro.logoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-2xl font-bold text-ink">
                {pro.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          {pro.verified && (
            <span className="absolute -bottom-1 -right-1 rounded-full bg-surface p-0.5 shadow-sm">
              <BadgeCheck className="h-5 w-5 text-ok fill-ok-bg" aria-label={tr('customer.proCard.verified')} />
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="text-[18px] font-bold leading-snug text-ink">{pro.name}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            {pro.avg !== null ? (
              <span className="inline-flex items-center gap-1 font-bold text-ink">
                <Star className="h-3.5 w-3.5 fill-star text-star" />
                {pro.avg.toFixed(1)}
                <span className="font-medium text-ink-2">({pro.count})</span>
              </span>
            ) : (
              <span className="font-medium text-ink-2">{tr('t10misc.directory.noReviews')}</span>
            )}
            {pro.locality && (
              <span className="inline-flex items-center gap-1 text-ink-2">
                <MapPin className="h-3 w-3" />
                {pro.locality}
              </span>
            )}
          </div>
          {pro.services.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {pro.services.slice(0, 4).map((s) => (
                <span
                  key={s}
                  className="rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-ink-2"
                >
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end sm:justify-between">
        {showSave ? (
          <button
            onClick={toggleSave}
            aria-label={isSaved ? tr('customer.proCard.unsave') : tr('customer.proCard.save')}
            aria-pressed={isSaved}
            className={cn(
              'ej-icon-hover grid h-11 w-11 shrink-0 place-items-center rounded-full',
              isSaved ? 'text-danger' : 'text-ink-2 hover:bg-danger-bg hover:text-danger'
            )}
          >
            <Heart className={cn('h-6 w-6 transition-all duration-300', isSaved && 'fill-danger scale-110')} />
          </button>
        ) : (
          <span className="hidden sm:block" aria-hidden="true" />
        )}
        <Link
          href={`/p/${pro.slug}`}
          className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-full border-[1.5px] border-lime px-5 text-sm font-bold text-ink transition-colors hover:bg-surface-2"
        >
          {tr('t10misc.directory.viewProfile')}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </article>
  );
}
