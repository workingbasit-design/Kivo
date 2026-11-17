import { prisma } from '@/lib/prisma';
import { LIST_MAX_SIZE } from '@/lib/list-page';
import { requireAuth } from '@/lib/auth';
import { getLocale } from '@/lib/i18n/server';
import { type Locale } from '@/lib/i18n';
import { tp } from '@/lib/i18n/plural';
import { getJobsForList } from '@/lib/job-queries';
import {
  classifyJobRow,
  addDaysKey,
  type JobListFilterId,
  type JobListInput,
} from '@/lib/jobs-list';
import { toISODateInTimezone } from '@/lib/utils';
import JobsListClient from './JobsListClient';
import { parseListLimit, takeWithProbe, sliceListPage } from '@/lib/list-page';
import { ListMore } from '../_components/ListMore';

/** Monday (week start) of the week containing `todayKey`. */
function mondayOfWeek(todayKey: string): string {
  const [y, m, d] = todayKey.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay(); // 0 = Sun
  return addDaysKey(todayKey, -((dow + 6) % 7));
}

export default async function JobsPage({
  searchParams,
}: {
  searchParams?: Promise<{ limit?: string; filter?: string }>;
}) {
  const { businessId } = await requireAuth();
  const params = await searchParams;
  const limit = parseListLimit(params?.limit);
  // Deep link from the Schedule late banner: /jobs?filter=late opens with
  // the Late filter applied. Anything unrecognised falls back to 'all'.
  const FILTER_IDS: JobListFilterId[] = ['all', 'late', 'today', 'upcoming', 'invoice'];
  const initialFilter: JobListFilterId = FILTER_IDS.includes(
    params?.filter as JobListFilterId
  )
    ? (params?.filter as JobListFilterId)
    : 'all';
  const locale: Locale = await getLocale();
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { timezone: true },
  });
  const timezone = business?.timezone ?? 'America/Toronto';

  // One source of truth with Dashboard / Schedule / Money: the shared list
  // query, classified by the pure jobs-list helpers.
  // M3: bounded read plus an exact total from the database, so the "N of M"
  // footer is right even though only a page of rows is on screen.
  const [fetched, totalJobs, customers, crews] = await Promise.all([
    getJobsForList(businessId, prisma, { take: takeWithProbe(limit) }),
    prisma.job.count({ where: { businessId } }),
    // New Job modal: the real JobForm needs the customer + crew pickers.
    prisma.customer.findMany({
      where: { businessId, archivedAt: null },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
      take: LIST_MAX_SIZE,
    }),
    prisma.crew.findMany({
      where: { businessId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
      take: LIST_MAX_SIZE,
    }),
  ]);
  const page = sliceListPage(fetched, limit);
  // Back into ascending date order for the day grouping in the client.
  const jobs = [...page.rows].reverse();
  const now = new Date();
  const rows = jobs.map((j) =>
    classifyJobRow(j as JobListInput, now, timezone),
  );

  const todayKey = toISODateInTimezone(now, timezone);
  const tomorrowKey = addDaysKey(todayKey, 1);
  const weekStart = mondayOfWeek(todayKey);
  const weekNextEnd = addDaysKey(weekStart, 13);
  const weekNextCount = rows.filter(
    (r) => r.dayKey >= weekStart && r.dayKey <= weekNextEnd,
  ).length;
  const summary = tp(locale, 'jobs.summaryWeekNext', weekNextCount);

  return (
    <>
      <JobsListClient
        rows={rows}
        locale={locale}
        timezone={timezone}
        summary={summary}
        todayKey={todayKey}
        tomorrowKey={tomorrowKey}
        customers={customers}
        crews={crews}
        initialFilter={initialFilter}
      />
      <ListMore
        shown={rows.length}
        total={totalJobs}
        nextLimit={page.nextLimit}
        locale={locale}
        basePath="/jobs"
      />
    </>
  );
}
