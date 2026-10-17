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

/** Monday (week start) of the week containing `todayKey`. */
function mondayOfWeek(todayKey: string): string {
  const [y, m, d] = todayKey.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay(); // 0 = Sun
  return addDaysKey(todayKey, -((dow + 6) % 7));
}

export default async function JobsPage() {
  const { businessId } = await requireAuth();
  const locale: Locale = await getLocale();
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { timezone: true },
  });
  const timezone = business?.timezone ?? 'America/Toronto';

  // One source of truth with Dashboard / Schedule / Money: the shared list
  // query, classified by the pure jobs-list helpers.
  const jobs = await getJobsForList(businessId);
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
    <JobsListClient
      rows={rows}
      locale={locale}
      timezone={timezone}
      summary={summary}
      todayKey={todayKey}
      tomorrowKey={tomorrowKey}
    />
  );
}
