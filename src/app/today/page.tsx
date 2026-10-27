import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { canSeePrices } from '@/lib/roles';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import { todayInTimezone, dayRangeInTimezone, formatJobTime, localeMoneyTag, statusLabel } from '@/lib/utils';
import { formatDisplayDate } from '@/lib/attention';
import { formatMoney } from '@/lib/money';
import { selectTodayCards } from '@/lib/today-cards';
import { StatusBadge, type StatusBadgeProps } from '@/components/kit';

export const dynamic = 'force-dynamic';

/**
 * Scroll lesson 4 — Today, one job per card. A focused full-screen mode
 * outside the app shell (no tab bar to mis-tap on site): the header stays
 * put and the cards snap vertically, one per swipe. Late jobs come first,
 * then today's jobs in start-time order; each card shows its position
 * ("2 of 5") so the pro always knows where they are in the day.
 */

function statusTone(status: string): StatusBadgeProps['tone'] {
  if (status === 'COMPLETED' || status === 'PAID') return 'done';
  if (status === 'IN PROGRESS') return 'info';
  if (status === 'CANCELLED') return 'neutral';
  if (status === 'NEW') return 'info';
  return 'scheduled';
}

export default async function TodayPage() {
  const { businessId, role, user } = await requireAuth();
  const locale = await getLocale();
  const tr = (path: string) => t(locale, `t10work.${path}`);
  const dateTag = locale === 'fr' ? 'fr-CA' : 'en-CA';

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { timezone: true, regionCode: true, currency: true },
  });
  const tz = business?.timezone ?? 'America/Toronto';
  const todayKey = todayInTimezone(tz, business?.regionCode);
  const { gte: todayStart, lte: todayEnd } = dayRangeInTimezone(todayKey, tz);

  // Technicians see only their own visits (same OR filter as the dashboard).
  const techFilter =
    role === 'TECHNICIAN'
      ? {
          OR: [
            { assignedToId: user.id },
            { jobAssignments: { some: { userId: user.id } } },
          ],
        }
      : {};
  const select = {
    id: true,
    title: true,
    date: true,
    time: true,
    timeTbd: true,
    startAt: true,
    endAt: true,
    status: true,
    address: true,
    priceCents: true,
    customer: { select: { name: true, phone: true } },
  };

  const [todayJobs, pastJobs] = await Promise.all([
    prisma.job.findMany({
      where: {
        businessId,
        archivedAt: null,
        status: { not: 'CANCELLED' },
        date: { gte: todayStart, lte: todayEnd },
        ...techFilter,
      },
      select,
    }),
    // Late candidates: open, dated before today. Capped — a day view is
    // not the place for an unbounded backlog; the Jobs list holds the rest.
    prisma.job.findMany({
      where: {
        businessId,
        archivedAt: null,
        status: { in: ['NEW', 'SCHEDULED'] },
        date: { lt: todayStart },
        ...techFilter,
      },
      select,
      orderBy: { date: 'asc' },
      take: 25,
    }),
  ]);

  const cards = selectTodayCards(todayJobs, pastJobs, new Date(), tz).map(
    (c) => ({
      ...c,
      // The selector orders by timing fields only; the full row carries
      // the display fields (address, price, customer) for the card.
      row: [...todayJobs, ...pastJobs].find((j) => j.id === c.job.id)!,
    }),
  );
  const showPrices = canSeePrices(role);
  const moneyTag = localeMoneyTag(locale);
  const headerDate = new Intl.DateTimeFormat(dateTag, {
    timeZone: tz,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date());

  const displayTime = (job: {
    timeTbd: boolean;
    time: string | null;
    startAt: Date | null;
  }): string => {
    if (job.timeTbd) return tr('schedTimeTbd');
    if (job.time) return formatJobTime(job.time, locale);
    if (job.startAt) {
      const s = new Intl.DateTimeFormat(dateTag, {
        timeZone: tz,
        hour: 'numeric',
        minute: '2-digit',
        hourCycle: locale === 'fr' ? 'h23' : 'h12',
      }).format(job.startAt);
      return locale === 'fr' ? s : s.replace(' AM', ' a.m.').replace(' PM', ' p.m.');
    }
    return tr('schedTimeTbd');
  };

  return (
    <div className="min-h-dvh bg-bg text-ink">
      <header className="h-14 flex items-center gap-3 px-4 border-b border-line">
        <Link
          href="/schedule"
          className="min-h-[44px] inline-flex items-center px-2 -ml-2 text-sm font-bold text-ink"
        >
          ← {tr('todayViewBack')}
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold truncate">
            {tr('todayViewTitle')} · {headerDate}
          </p>
        </div>
        <p className="text-xs font-bold text-ink-2 shrink-0">
          {cards.length === 1
            ? tr('todayViewCountOne')
            : tr('todayViewCountMany').replace('{count}', String(cards.length))}
        </p>
      </header>

      {cards.length === 0 ? (
        <div className="px-6 py-16 text-center">
          <p className="text-xl font-bold">{tr('todayViewEmptyTitle')}</p>
          <p className="text-sm text-ink-2 mt-2">{tr('todayViewEmptyDesc')}</p>
          <Link
            href="/jobs/new"
            className="mt-6 min-h-[52px] inline-flex items-center bg-hivis text-asphalt px-6 rounded-xl font-bold text-sm"
          >
            {tr('todayViewSchedule')}
          </Link>
        </div>
      ) : (
        <div
          id="today-cards"
          className="h-[calc(100dvh-3.5rem)] overflow-y-auto snap-y snap-mandatory overscroll-contain pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
        >
          {cards.map(({ job, late, row }, i) => (
            <article
              key={job.id}
              data-job-id={job.id}
              className="snap-start snap-always min-h-full flex flex-col px-5 py-6 border-b border-line/70 last:border-b-0"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-condensed font-semibold text-[44px] leading-none text-ink">
                  {displayTime(job)}
                </p>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <StatusBadge tone={statusTone(job.status)}>
                    {statusLabel(job.status, locale)}
                  </StatusBadge>
                  <span className="text-xs font-bold text-ink-2">
                    {tr('todayViewOf')
                      .replace('{n}', String(i + 1))
                      .replace('{m}', String(cards.length))}
                  </span>
                </div>
              </div>

              {late && (
                <p className="mt-3 text-sm font-bold text-warn-text">
                  {tr('todayViewLate')} ·{' '}
                  {tr('todayViewWasDue').replace(
                    '{date}',
                    formatDisplayDate(job.date, tz, locale),
                  )}
                </p>
              )}

              <div className="flex-1 flex flex-col justify-center py-6">
                <h2 className="text-2xl font-bold leading-tight">{row.title}</h2>
                <p className="text-lg mt-2">{row.customer.name}</p>
                {row.address && (
                  <p className="text-sm text-ink-2 mt-1">{row.address}</p>
                )}
                {showPrices && (
                  <p className="font-condensed font-semibold text-3xl mt-4">
                    {formatMoney(
                      Number(row.priceCents) / 100,
                      business?.currency ?? 'CAD',
                      moneyTag,
                    )}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-3">
                <Link
                  href={`/jobs/${job.id}`}
                  className="min-h-[52px] flex items-center justify-center bg-hivis text-asphalt px-6 rounded-xl font-bold text-sm"
                >
                  {tr('todayViewOpen')}
                </Link>
                {row.customer.phone && (
                  <a
                    href={`tel:${row.customer.phone}`}
                    className="min-h-[52px] flex items-center justify-center bg-asphalt text-hero-ink px-6 rounded-xl font-bold text-sm"
                  >
                    {tr('todayViewCall')} · {row.customer.phone}
                  </a>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
