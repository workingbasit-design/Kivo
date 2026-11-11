import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { getLocale } from '@/lib/i18n/server';
import { type Locale } from '@/lib/i18n';
import { tp } from '@/lib/i18n/plural';
import { getJobsForList } from '@/lib/job-queries';
import {
  classifyJobRow,
  addDaysKey,
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
  searchParams?: Promise<{ limit?: string }>;
}) {
  const { businessId } = await requireAuth();
  const limit = parseListLimit((await searchParams)?.limit);
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
  const [fetched, totalJobs] = await Promise.all([
    getJobsForList(businessId, prisma, { take: takeWithProbe(limit) }),
    prisma.job.count({ where: { businessId } }),
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
