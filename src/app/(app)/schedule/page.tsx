import React from 'react';
import Link from 'next/link';
import { CalendarDays, AlertTriangle } from '@/components/icons';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { Card, Banner } from '@/components/kit';

import ScheduleClient from '@/components/ScheduleClient';
import WeekStrip, { type WeekStripDay } from '@/components/schedule/WeekStrip';
import WeatherStrip, { type StripDay } from '@/components/WeatherStrip';
import { getWeatherForDates, geocodeLocation } from '@/lib/weather';
import { getHolidays } from '@/lib/holidays';
import { toISODateLocal, todayInTimezone, localeDateTag } from '@/lib/utils';
import { formatDisplayDate } from '@/lib/attention';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import { getJobCounts, getOverdueJobs, getScheduleWeekJobs } from '@/lib/job-queries';
import { centsToDollars } from '@/lib/money';
import { PageHeader} from '@/components/kit';

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
        summary={weekLabel}
        actionLabel={T('schedNewJobBtn')}
        actionHref="/jobs/new"
        actionIcon={<CalendarDays />}
      />

      {/* Today focus mode (Scroll lesson 4): one job per card, vertical swipe. */}
      <Link
        href="/today"
        className="min-h-[52px] flex items-center justify-center gap-2 bg-hivis text-asphalt px-6 rounded-xl font-bold text-sm"
      >
        <CalendarDays size={16} />
        {T('todayViewButton')}
      </Link>

      {stripDays.length > 0 && (
        <WeatherStrip days={stripDays} placeName={geo?.name.split(',').slice(0, 2).join(',') ?? ''} />
      )}

      {/* Late jobs — past date, still open. Not in the week grid (they're not
          in the current week) but the owner must see them here. One urgency
          signal per row: icon + the word "Late", never colour alone. */}
      {overdueJobs.length > 0 && (
        <section aria-label={T('schedOverdueTitle')}>
          <Banner
            tone="warn"
            title={`${T('schedOverdueTitle')} (${overdueJobs.length})`}
            text={T('schedOverdueDesc')}
          />
          <ul className="mt-3 bg-ej-bg border border-ej-border rounded-xl overflow-hidden divide-y divide-ej-border">
            {overdueJobs.map((j) => (
              <li key={j.id}>
                <Link
                  href={`/jobs/${j.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 min-h-[56px]"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-ej-ink dark:text-ink truncate">
                      {j.title}
                    </span>
                    <span className="block text-xs text-ej-secondary dark:text-ink-2 truncate">{j.customer.name}</span>
                    <span className="block text-xs text-ej-muted dark:text-ink-2 truncate">
                      {formatDisplayDate(j.date, business?.timezone, locale)}
                    </span>
                  </span>
                  <span className="shrink-0 inline-flex items-center gap-1 text-xs font-bold text-ej-warning bg-ej-warning-bg px-2 py-1 rounded-full">
                    <AlertTriangle size={12} aria-hidden="true" />
                    {T('schedOverdueBadge')}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Week navigator + 7-day strip (client: day cells are drop targets
          for desktop drag-and-drop rescheduling). */}
      <Card className="p-4">
        <WeekStrip
          days={days.map((d): WeekStripDay => {
            const key = toISODateLocal(d);
            const count = counts.get(key) ?? 0;
            return {
              key,
              dayName: dayName(d),
              dayNum: d.getDate(),
              count,
              isToday: key === todayKey,
              holidayName: holidayByDate.get(key) ?? null,
              // An empty day starts a new job with that date prefilled;
              // a day with jobs opens its agenda underneath.
              href: count === 0 ? `/jobs/new?date=${key}` : dayLink(d),
            };
          })}
          weekLabel={weekLabel}
          prevWeekHref={weekLink(addDays(weekStart, -7))}
          nextWeekHref={weekLink(addDays(weekStart, 7))}
          thisWeekHref="/schedule"
          clearDayHref={weekLink(weekStart)}
          isCurrentWeek={isCurrentWeek}
          activeDay={activeDay}
          strings={{
            prevWeek: T('schedPrevWeek'),
            nextWeek: T('schedNextWeek'),
            thisWeek: T('schedThisWeek'),
            showWholeWeek: T('schedShowWholeWeek'),
            today: T('schedToday'),
            emptyDayNew: T('schedEmptyDayNew'),
            moved: T('schedMoved'),
            moveFailed: T('schedMoveFailed'),
          }}
        />
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
