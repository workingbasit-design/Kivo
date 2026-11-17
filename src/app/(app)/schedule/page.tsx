import React from 'react';
import Link from 'next/link';
import { CalendarDays, AlertTriangle, Sparkles } from '@/components/icons';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { Card } from '@/components/kit';

import ScheduleClient from '@/components/ScheduleClient';
import WeekStrip, { type WeekStripDay } from '@/components/schedule/WeekStrip';
import WeatherStrip, { type StripDay } from '@/components/WeatherStrip';
import { getWeatherForDates, geocodeLocation } from '@/lib/weather';
import { getHolidays } from '@/lib/holidays';
import { toISODateLocal, todayInTimezone, localeDateTag } from '@/lib/utils';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import { getJobCounts, getScheduleWeekJobs } from '@/lib/job-queries';
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

  // Week jobs and the shared counts (one source of truth with Dashboard /
  // Jobs / Money). `counts.late` is the canonical Late count - it mirrors
  // isJobLate() exactly (NEW/SCHEDULED only, start time passed), so the
  // banner below and the Jobs "Late" filter can never disagree.
  const [jobs, counts] = await Promise.all([
    getScheduleWeekJobs(businessId, weekStart, weekEnd),
    getJobCounts(businessId, { timezone: business?.timezone ?? 'America/Toronto' }),
  ]);
  const totalCount = counts.total;
  const lateCount = counts.late;

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

  const countsByDay = new Map<string, number>();
  for (const j of jobs) {
    const key = dayKey(j.date);
    countsByDay.set(key, (countsByDay.get(key) ?? 0) + 1);
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
    <div className="ej-schedule space-y-6">
      {/* Prototype header: eyebrow + title + week range + lime primary action. */}
      <header className="ej-schedule-header">
        <div>
          <p className="ej-schedule-eyebrow">{T('schedEyebrow')}</p>
          <h1>{t(locale, 'schedule.title')}</h1>
          <p className="ej-schedule-subtitle">{weekLabel}</p>
        </div>
        <Link href="/jobs/new" className="ej-schedule-new">
          <CalendarDays size={16} aria-hidden="true" />
          {T('schedNewJobBtn')}
        </Link>
      </header>

      {/* Week calendar Mon-Sun FIRST on the page (client: day cells are drop
          targets for desktop drag-and-drop rescheduling). */}
      <Card className="p-4">
        <WeekStrip
          days={days.map((d): WeekStripDay => {
            const key = toISODateLocal(d);
            const count = countsByDay.get(key) ?? 0;
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

      {/* Today focus mode (Scroll lesson 4): one job per card, vertical swipe. */}
      <Link href="/today" className="ej-schedule-tip">
        <span className="ej-schedule-tip-icon" aria-hidden="true">
          <Sparkles size={15} />
        </span>
        <span>
          <b>{T('todayViewButton')}</b>
          <small>{T('schedTipText')}</small>
        </span>
      </Link>

      {/* Late jobs — past start time, still not started. ONE compact banner:
          count + Review, which opens Jobs filtered to Late. Never a list of
          late rows here, and never colour alone: icon + the word "Late". */}
      {lateCount > 0 && (
        <section className="ej-schedule-late" aria-label={T('schedOverdueTitle')}>
          <span className="ej-schedule-late-icon" aria-hidden="true">
            <AlertTriangle size={18} />
          </span>
          <span className="ej-schedule-late-text">
            <b>
              {T('schedOverdueTitle')} ({lateCount})
            </b>
            <span>{T('schedOverdueDesc')}</span>
          </span>
          <Link href="/jobs?filter=late" className="ej-schedule-late-review">
            {T('schedReviewLate')}
          </Link>
        </section>
      )}

      {stripDays.length > 0 && (
        <WeatherStrip days={stripDays} placeName={geo?.name.split(',').slice(0, 2).join(',') ?? ''} />
      )}

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
