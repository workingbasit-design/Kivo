/**
 * Shared date/time display (Part B8). Every date and time renders through
 * one formatter using Intl.DateTimeFormat with the business time zone and
 * the user's locale (en-CA / fr-CA). Never render raw date strings.
 */
import { cn } from '@/lib/utils';

export default function DateTimeText({
  date,
  timezone = 'America/Toronto',
  locale = 'en',
  variant = 'datetime',
  className,
}: {
  date: Date | string;
  timezone?: string;
  locale?: 'en' | 'fr';
  variant?: 'datetime' | 'date' | 'time';
  className?: string;
}) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) {
    return <span className={className}>-</span>;
  }
  const tag = locale === 'fr' ? 'fr-CA' : 'en-CA';
  const opts: Intl.DateTimeFormatOptions =
    variant === 'date'
      ? { dateStyle: 'medium', timeZone: timezone }
      : variant === 'time'
        ? { timeStyle: 'short', timeZone: timezone }
        : { dateStyle: 'medium', timeStyle: 'short', timeZone: timezone };
  return <span className={cn('tabular-nums', className)}>{new Intl.DateTimeFormat(tag, opts).format(d)}</span>;
}
