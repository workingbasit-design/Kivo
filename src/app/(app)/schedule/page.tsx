import React from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { PageHeader, Card, limeBtnClass } from '@/components/ui';
import ScheduleClient from '@/components/ScheduleClient';
import WeatherStrip, { type StripDay } from '@/components/WeatherStrip';
import { getWeatherForDates, geocodeLocation } from '@/lib/weather';
import { getHolidays } from '@/lib/holidays';
import { toISODateLocal, todayInTimezone, cn, localeDateTag, formatDateShort } from '@/lib/utils';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import { getJobCounts, getOverdueJobs, getScheduleWeekJobs } from '@/lib/job-queries';
import { centsToDollars } from '@/lib/money';

/** Monday of the week containing `d` (local time). */
function mondayOf(d: Date): Date {
  const copy = new Date(d);
  const day = (copy.getDay() + 6) % 7; // Mon=0 … Sun=6
  copy.setDate(copy.getDate() - day);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

/** Calendar-day key of a job in the business (server-local) timezone.
 *  Stored job timestamps are server-local midnight / 9 AM, so the local
 *  calendar date is the date the user picked - never derive it from
 *  toISOString() (UTC), which shifts the day for timezones ahead of UTC. */
function dayKey(date: Date): string {
  return toISODateLocal(new Date(date));
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; day?: string }>;
}) {
  const { businessId } = await requireAuth();
  const { week, day } = await searchParams;
  const locale = await getLocale();
  const dateLocale = localeDateTag(locale);
  const T = (k: string) => t(locale, `t10work.${k}`);

  // Fetch the business first: the "today" highlight and the default week must
  // use the business timezone (Vercel servers run UTC, so server-local
  // `new Date()` is the wrong day for Toronto evenings).
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { regionCode: true, taxRegion: true, address: true, timezone: true },
  });

  /** "Today" in the business's timezone (defaults to America/Toronto). */
  const todayKey = todayInTimezone(business?.timezone, business?.regionCode);

  const weekStart =
    week && /^\d{4}-\d{2}-\d{2}$/.test(week)
      ? mondayOf(new Date(`${week}T00:00:00`))
      : mondayOf(new Date(`${todayKey}T00:00:00`));
  const weekEnd = addDays(weekStart, 7);
  const weekKey = toISODateLocal(weekStart);

  const activeDay = day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;

  // Week jobs, total count, and overdue jobs from the shared queries (one
  // source of truth with Dashboard / Jobs / Money).
  const [jobs, totalCount, overdueJobs] = await Promise.all([
    getScheduleWeekJobs(businessId, weekStart, weekEnd),
    getJobCounts(businessId, { timezone: business?.timezone ?? 'America/Toronto' }).then(
      (c) => c.total
    ),
    // Overdue: past date, still open. These are invisible in the week grid
    // (they're not in the current week) but the owner must see them here -
    // otherwise Schedule says "0" while Jobs shows overdue work.
    getOverdueJobs(businessId, weekStart, 10),
  ]);

  const countryCode = 'CA' as const;
  // Province code (e.g. "ON") lets the scheduler badge provincial statutory
  // holidays like Family Day / St-Jean-Baptiste.
  const provinceCode = business?.taxRegion ?? null;

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Localized day/month names (EN + fr-CA) - never hardcode English names.
  const dayName = (d: Date) => d.toLocaleDateString(dateLocale, { weekday: 'short' });
  const dayMonth = (d: Date) =>
    d.toLocaleDateString(dateLocale, { day: 'numeric', month: 'short' });
  const yearOf = (d: Date) => d.getFullYear();

  // Weather strip: geocode the business address (Nominatim, cached) then fetch
  // a 5-day Open-Meteo forecast. Fails silently - no location or no data means
  // no strip, never an error.
  const geo = business?.address ? await geocodeLocation(business.address) : null;
  let stripDays: StripDay[] = [];
  if (geo) {
    const stripDates = days.slice(0, 5).map(toISODateLocal);
    const wx = await getWeatherForDates(geo.lat, geo.lon, stripDates);
    stripDays = days.slice(0, 5).map((d, i) => ({
      dateISO: stripDates[i],
      label: dayName(d),
      weather: wx.get(stripDates[i]) ?? null,
    }));
  }

  // Public holidays for the displayed week (Nager.Date, cached, silent on failure).
  const years = [...new Set(days.map((d) => d.getFullYear()))];
  const holidayLists = await Promise.all(
    years.map((y) => getHolidays(y, countryCode, provinceCode))
  );
  const holidayByDate = new Map<string, string>();
  for (const list of holidayLists) for (const h of list) holidayByDate.set(h.date, h.name);

  // Serialize for the client component (dates as ISO strings).
  const serialized = jobs.map((j) => ({
    id: j.id,
    title: j.title,
    date: j.date.toISOString(),
    /** Server-local calendar date - the day the user booked. Used for all
     *  day filtering/counting so UTC conversion can never shift the day. */
    dateKey: dayKey(j.date),
    time: j.time,
    address: j.address,
    price: centsToDollars(j.priceCents),
    status: j.status,
    notes: j.notes,
    customer: j.customer,
    assignedTo: j.assignedTo,
  }));

  const counts = new Map<string, number>();
  for (const j of jobs) {
    const key = dayKey(j.date);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const weekLabel = `${dayMonth(days[0])} - ${dayMonth(days[6])} ${yearOf(days[6])}`;

  // "This week" is disabled when already viewing the current week (Part A6).
  const currentWeekKey = toISODateLocal(mondayOf(new Date(`${todayKey}T00:00:00`)));
  const isCurrentWeek = weekKey === currentWeekKey;

  // Full holiday name for the selected day (shown in full in the agenda
  // header below - never as a truncated chip in the day cell).
  const activeHoliday = activeDay ? (holidayByDate.get(activeDay) ?? null) : null;

  const weekLink = (monday: Date) => `/schedule?week=${toISODateLocal(monday)}`;
  const dayLink = (d: Date) =>
    `/schedule?week=${weekKey}&day=${toISODateLocal(d)}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t(locale, 'schedule.title')}
        subtitle={weekLabel}
        actions={
          <Link href="/jobs/new" className={limeBtnClass}>
            <CalendarDays size={16} /> {T('schedNewJobBtn')}
          </Link>
        }
      />

      {stripDays.length > 0 && (
        <WeatherStrip days={stripDays} placeName={geo?.name.split(',').slice(0, 2).join(',') ?? ''} />
      )}

      {/* Overdue jobs - past date, still open. Not in the week grid above,
          but the owner must see them here. */}
      {overdueJobs.length > 0 && (
        <Card className="p-4 border-red-200 bg-red-50/60">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-red-500" aria-hidden />
            <h2 className="text-sm font-bold text-red-900">
              {T('schedOverdueTitle')} ({overdueJobs.length})
            </h2>
          </div>
          <p className="text-xs text-red-700 mb-3">{T('schedOverdueDesc')}</p>
          <ul className="divide-y divide-red-100">
            {overdueJobs.map((j) => (
              <li key={j.id}>
                <Link
                  href={`/jobs/${j.id}`}
                  className="flex items-center justify-between gap-3 py-2.5 min-h-[44px]"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-zinc-900 truncate">
                      {j.title}
                    </span>
                    <span className="block text-xs text-zinc-500 truncate">{j.customer.name}</span>
                    <span className="block text-xs text-zinc-400 truncate">{formatDateShort(j.date)}</span>
                  </span>
                  <span className="shrink-0 text-xs font-bold text-red-700 bg-red-100 px-2 py-1 rounded-full">
                    {T('schedOverdueBadge')}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Week navigator */}
      <Card className="p-4">
        <div className="flex items-center justify-between gap-2 mb-4">
          <Link
            href={weekLink(addDays(weekStart, -7))}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-zinc-700 transition-all hover:scale-105 active:scale-95 bg-white border border-zinc-200 shadow-sm"
            aria-label={T('schedPrevWeek')}
          >
            <ChevronLeft size={18} />
          </Link>
          <div className="flex items-center gap-2 flex-wrap justify-center min-w-0">
            {isCurrentWeek ? (
              <span
                aria-disabled="true"
                className="text-xs font-bold text-zinc-400 px-4 py-2 min-h-[44px] inline-flex items-center rounded-full bg-zinc-100 cursor-not-allowed"
              >
                {T('schedThisWeek')}
              </span>
            ) : (
              <Link
                href="/schedule"
                className="text-xs font-bold text-zinc-800 px-4 py-2 min-h-[44px] inline-flex items-center rounded-full transition-all hover:scale-[1.03] active:scale-95 bg-white border border-zinc-200 shadow-sm"
              >
                {T('schedThisWeek')}
              </Link>
            )}
            <span className="text-sm font-bold text-zinc-900">{weekLabel}</span>
          </div>
          <Link
            href={weekLink(addDays(weekStart, 7))}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-zinc-700 transition-all hover:scale-105 active:scale-95 bg-white border border-zinc-200 shadow-sm"
            aria-label={T('schedNextWeek')}
          >
            <ChevronRight size={18} />
          </Link>
        </div>

        {/* 7-day strip */}
        <div className="grid grid-cols-7 gap-1.5 md:gap-2">
          {days.map((d, i) => {
            const key = toISODateLocal(d);
            const count = counts.get(key) ?? 0;
            const isToday = key === todayKey;
            const isActive = activeDay === key;
            const holiday = holidayByDate.get(key);
            // An empty day starts a new job with that date prefilled;
            // a day with jobs opens its agenda underneath.
            const cellHref = count === 0 ? `/jobs/new?date=${key}` : dayLink(d);
            return (
              <Link
                key={key}
                href={cellHref}
                aria-current={isActive ? 'date' : undefined}
                aria-label={`${dayName(d)} ${d.getDate()}${isToday ? `, ${T('schedToday')}` : ''}${count === 0 ? `, ${T('schedEmptyDayNew')}` : ''}`}
                className={cn(
                  'flex flex-col items-center rounded-xl border-2 py-2 md:py-3 transition-colors min-h-[64px]',
                  isActive
                    ? 'bg-ink text-white border-ink shadow-sm'
                    : 'bg-white border-zinc-200 hover:border-smoke hover:bg-paper',
                  isToday && !isActive && 'border-lime-500 bg-lime-50'
                )}
              >
                <span
                  className={cn(
                    'text-[10px] font-bold',
                    isActive ? 'text-white/80' : isToday ? 'text-lime-700' : 'text-zinc-400'
                  )}
                >
                  {dayName(d)}
                </span>
                <span
                  className={cn(
                    'text-sm md:text-base font-bold mt-0.5',
                    isActive ? 'text-white' : isToday ? 'text-lime-800' : 'text-zinc-900'
                  )}
                >
                  {d.getDate()}
                </span>
                {/* Count badge only when there are jobs - never a row of zeros. */}
                {count > 0 && (
                  <span
                    className={cn(
                      'mt-1 min-w-5 h-5 px-1 rounded-full text-[10px] font-bold flex items-center justify-center tabular-nums',
                      isActive ? 'bg-white/25 text-white' : 'bg-smoke text-ink'
                    )}
                  >
                    {count}
                  </span>
                )}
                {/* Holiday marker only - the full name lives in the agenda
                    header, never as a truncated chip here. */}
                {holiday && (
                  <span title={holiday} aria-hidden className="mt-1 text-[10px] leading-none">
                    🎉
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {activeDay && (
          <div className="mt-3 text-center">
            <Link
              href={weekLink(weekStart)}
              className="text-xs font-semibold text-ink hover:underline inline-flex items-center min-h-[44px] px-3"
            >
              {T('schedShowWholeWeek')}
            </Link>
          </div>
        )}
      </Card>

      {/* Job list for the week */}
      <ScheduleClient
        key={`${weekKey}:${activeDay ?? 'ALL'}`}
        initialJobs={serialized}
        initialDateFilter={activeDay ?? 'ALL'}
        allowSeed={totalCount === 0}
        todayKey={todayKey}
        locale={locale}
        activeDayHoliday={activeHoliday}
        timezone={business?.timezone ?? 'America/Toronto'}
      />
    </div>
  );
}
