/**
 * Shared date/time display (Part B8). Every date and time renders through
 * one formatter using Intl.DateTimeFormat with the business time zone and
 * the user's locale (en-CA / fr-CA). Never render raw date strings.
 *
 * Calendar-day rule (matches the old formatDateLabel/formatDateShort):
 * - Date-only strings ("YYYY-MM-DD") are calendar days, not instants.
 *   They render as that exact day, never shifted by time zone.
 * - Date objects at exactly UTC midnight are calendar days stored by
 *   Prisma (job.date, invoice.date). They also render as that exact day.
 * Real timestamps (createdAt, signedAt) render in the business time zone.
 */
import { cn } from '@/lib/utils';

type DateVariant = 'datetime' | 'date' | 'time' | 'weekday' | 'short';

function isDateOnlyString(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function isUtcMidnight(d: Date): boolean {
  return (
    d.getUTCHours() === 0 &&
    d.getUTCMinutes() === 0 &&
    d.getUTCSeconds() === 0 &&
    d.getUTCMilliseconds() === 0
  );
}

export default function DateTimeText({
  date,
  timezone = 'America/Toronto',
  locale = 'en',
  variant = 'datetime',
  className,
}: {
  date: Date | string | null | undefined;
  timezone?: string;
  locale?: 'en' | 'fr';
  variant?: DateVariant;
  className?: string;
}) {
  const tag = locale === 'fr' ? 'fr-CA' : 'en-CA';
  const isDateVariant = variant === 'date' || variant === 'weekday' || variant === 'short';

  // Null/undefined renders "-" (matches formatDateLabel/formatDateShort).
  if (date === null || date === undefined || date === '') {
    return <span className={className}>-</span>;
  }

  // Calendar days: render the exact day, never time-zone shifted.
  if (typeof date === 'string' && isDateOnlyString(date) && isDateVariant) {
    const [y, m, day] = date.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1, day));
    const opts: Intl.DateTimeFormatOptions =
      variant === 'weekday'
        ? { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }
        : variant === 'short'
          ? { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }
          : { dateStyle: 'medium', timeZone: 'UTC' };
    return <span className={cn('tabular-nums', className)}>{new Intl.DateTimeFormat(tag, opts).format(d)}</span>;
  }

  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) {
    return <span className={className}>-</span>;
  }

  // UTC-midnight Dates are Prisma calendar days (job.date, invoice.date).
  const tz = isDateVariant && isUtcMidnight(d) ? 'UTC' : timezone;
  const opts: Intl.DateTimeFormatOptions =
    variant === 'date'
      ? { dateStyle: 'medium', timeZone: tz }
      : variant === 'time'
        ? { timeStyle: 'short', timeZone: tz }
        : variant === 'weekday'
          ? { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: tz }
          : variant === 'short'
            ? { day: 'numeric', month: 'short', year: 'numeric', timeZone: tz }
            : { dateStyle: 'medium', timeStyle: 'short', timeZone: tz };
  return <span className={cn('tabular-nums', className)}>{new Intl.DateTimeFormat(tag, opts).format(d)}</span>;
}
