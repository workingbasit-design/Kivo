import React from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { PageHeader, Card } from '@/components/ui';
import ScheduleClient from '@/components/ScheduleClient';
import WeatherStrip, { type StripDay } from '@/components/WeatherStrip';
import { getWeatherForDates, geocodeLocation } from '@/lib/weather';
import { getHolidays } from '@/lib/holidays';
import { toISODateLocal, cn } from '@/lib/utils';

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

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

/** UTC day key, matching ScheduleClient's date comparison logic. */
function utcDayKey(date: Date): string {
  return new Date(date).toISOString().split('T')[0];
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; day?: string }>;
}) {
  const { businessId } = await requireAuth();
  const __biz = await prisma.business.findUnique({ where: { id: businessId }, select: { currency: true } });
  const currency = __biz?.currency;
  const { week, day } = await searchParams;

  const weekStart =
    week && /^\d{4}-\d{2}-\d{2}$/.test(week)
      ? mondayOf(new Date(`${week}T00:00:00`))
      : mondayOf(new Date());
  const weekEnd = addDays(weekStart, 7);
  const weekKey = toISODateLocal(weekStart);

  const activeDay = day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;

  const [jobs, totalCount, business] = await Promise.all([
    prisma.job.findMany({
      where: { businessId, date: { gte: weekStart, lt: weekEnd } },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
      },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.job.count({ where: { businessId } }),
    prisma.business.findUnique({
      where: { id: businessId },
      select: { regionCode: true, address: true },
    }),
  ]);

  const countryCode: 'IN' | 'CA' = business?.regionCode === 'CA' ? 'CA' : 'IN';

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Weather strip: geocode the business address (Nominatim, cached) then fetch
  // a 5-day Open-Meteo forecast. Fails silently — no location or no data means
  // no strip, never an error.
  const geo = business?.address ? await geocodeLocation(business.address) : null;
  let stripDays: StripDay[] = [];
  if (geo) {
    const stripDates = days.slice(0, 5).map(toISODateLocal);
    const wx = await getWeatherForDates(geo.lat, geo.lon, stripDates);
    stripDays = days.slice(0, 5).map((d, i) => ({
      dateISO: stripDates[i],
      label: DAY_NAMES[i],
      weather: wx.get(stripDates[i]) ?? null,
    }));
  }

  // Public holidays for the displayed week (Nager.Date, cached, silent on failure).
  const years = [...new Set(days.map((d) => d.getFullYear()))];
  const holidayLists = await Promise.all(years.map((y) => getHolidays(y, countryCode)));
  const holidayByDate = new Map<string, string>();
  for (const list of holidayLists) for (const h of list) holidayByDate.set(h.date, h.name);

  // Serialize for the client component (dates as ISO strings).
  const serialized = jobs.map((j) => ({
    id: j.id,
    title: j.title,
    date: j.date.toISOString(),
    time: j.time,
    address: j.address,
    price: j.price,
    status: j.status,
    notes: j.notes,
    customer: j.customer,
    assignedTo: j.assignedTo,
  }));

  const counts = new Map<string, number>();
  for (const j of jobs) {
    const key = utcDayKey(j.date);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const todayKey = toISODateLocal(new Date());
  const weekLabel = `${days[0].getDate()} ${MONTHS[days[0].getMonth()]} – ${days[6].getDate()} ${MONTHS[days[6].getMonth()]} ${days[6].getFullYear()}`;

  const weekLink = (monday: Date) => `/schedule?week=${toISODateLocal(monday)}`;
  const dayLink = (d: Date) =>
    `/schedule?week=${weekKey}&day=${toISODateLocal(d)}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Schedule"
        subtitle={weekLabel}
        actions={
          <Link
            href="/jobs/new"
            className="bg-[#6329d4] hover:bg-[#5221b3] text-white px-4 py-2.5 rounded-xl font-semibold text-xs transition-colors inline-flex items-center gap-2 shadow-sm"
          >
            <CalendarDays size={14} /> New job
          </Link>
        }
      />

      {stripDays.length > 0 && (
        <WeatherStrip days={stripDays} placeName={geo?.name.split(',').slice(0, 2).join(',') ?? ''} />
      )}

      {/* Week navigator */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <Link
            href={weekLink(addDays(weekStart, -7))}
            className="p-2 rounded-xl hover:bg-zinc-100 text-zinc-600 transition-colors"
            aria-label="Previous week"
          >
            <ChevronLeft size={18} />
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/schedule"
              className="text-xs font-bold text-[#6329d4] bg-[#f3eefe] hover:bg-[#e9defc] px-3 py-1.5 rounded-xl border border-[#e5d8fd] transition-colors"
            >
              This week
            </Link>
            <span className="text-sm font-bold text-zinc-900">{weekLabel}</span>
          </div>
          <Link
            href={weekLink(addDays(weekStart, 7))}
            className="p-2 rounded-xl hover:bg-zinc-100 text-zinc-600 transition-colors"
            aria-label="Next week"
          >
            <ChevronRight size={18} />
          </Link>
        </div>

        {/* 7-day strip */}
        <div className="grid grid-cols-7 gap-1.5 md:gap-2">
          {days.map((d, i) => {
            const key = toISODateLocal(d);
            const count = counts.get(utcDayKey(d)) ?? counts.get(key) ?? 0;
            const isToday = key === todayKey;
            const isActive = activeDay === key;
            const holiday = holidayByDate.get(key);
            return (
              <Link
                key={key}
                href={dayLink(d)}
                className={cn(
                  'flex flex-col items-center rounded-xl border py-2 md:py-3 transition-colors',
                  isActive
                    ? 'bg-[#6329d4] text-white border-[#6329d4] shadow-sm'
                    : 'bg-white border-zinc-200 hover:border-[#6329d4]/40 hover:bg-[#faf8ff]',
                  isToday && !isActive && 'border-[#6329d4]/50'
                )}
              >
                <span
                  className={cn(
                    'text-[10px] font-bold uppercase tracking-wide',
                    isActive ? 'text-white/80' : 'text-zinc-400'
                  )}
                >
                  {DAY_NAMES[i]}
                </span>
                <span
                  className={cn(
                    'text-sm md:text-base font-bold mt-0.5',
                    isActive ? 'text-white' : 'text-zinc-900'
                  )}
                >
                  {d.getDate()}
                </span>
                <span
                  className={cn(
                    'mt-1 min-w-5 h-5 px-1 rounded-full text-[10px] font-bold flex items-center justify-center',
                    isActive
                      ? 'bg-white/25 text-white'
                      : count > 0
                        ? 'bg-[#f3eefe] text-[#6329d4]'
                        : 'bg-zinc-100 text-zinc-400'
                  )}
                >
                  {count}
                </span>
                {holiday && (
                  <span
                    title={`${holiday} — public holiday`}
                    className={cn(
                      'mt-1 max-w-full truncate rounded-full border px-1.5 py-px text-[9px] font-bold',
                      isActive
                        ? 'border-white/40 bg-white/20 text-white'
                        : 'border-amber-200 bg-amber-50 text-amber-700'
                    )}
                  >
                    {holiday}
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
              className="text-xs font-semibold text-[#6329d4] hover:underline"
            >
              Show whole week
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
        currency={currency}
      />
    </div>
  );
}
