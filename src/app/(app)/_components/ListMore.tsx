import Link from 'next/link';
import { t, type Locale } from '@/lib/i18n';

/**
 * M3: footer for a bounded list read. Shows how much of the table is on
 * screen and links to the next page size via ?limit=, so nothing is ever
 * silently truncated and no client state is needed.
 */
export function ListMore({
  shown,
  total,
  nextLimit,
  locale,
  basePath,
  params = {},
}: {
  shown: number;
  total: number;
  /** null when everything is already on screen. */
  nextLimit: number | null;
  locale: Locale;
  basePath: string;
  /** Other search params to preserve (status filter, etc.). */
  params?: Record<string, string | undefined>;
}) {
  if (nextLimit === null) return null;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v);
  qs.set('limit', String(nextLimit));
  return (
    <div className="flex flex-col items-center gap-2 py-5">
      <p className="text-xs text-ink-2">
        {t(locale, 't10misc.booking.listShowingCount')
          .replace('{shown}', String(shown))
          .replace('{total}', String(total))}
      </p>
      <Link
        href={`${basePath}?${qs.toString()}`}
        className="min-h-[44px] inline-flex items-center rounded-xl border border-line bg-surface px-5 text-sm font-semibold text-ink hover:bg-surface-2"
      >
        {t(locale, 't10misc.booking.listShowMore')}
      </Link>
    </div>
  );
}
