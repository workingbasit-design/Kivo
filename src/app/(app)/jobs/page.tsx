import React from 'react';
import Link from 'next/link';
import { Plus, Briefcase, Search } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { PageHeader, Card, EmptyState, primaryBtnClass, inputClass } from '@/components/ui';
import StatusBadge from '@/components/StatusBadge';
import { formatDateShort, hasJobTime, formatJobTime, formatStatusLabel, cn } from '@/lib/utils';
import MoneyText from '@/components/MoneyText';
import DateTimeText from '@/components/DateTimeText';
import { JOB_STATUSES, isJobLate } from '@/lib/job-status';
import { getJobCounts, getJobs } from '@/lib/job-queries';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import ExportButtons, { type ExportColumn, type ExportRow } from '@/components/ExportButtons';
import JobsExportMenu from '@/components/JobsExportMenu';
import { centsToDollars } from '@/lib/money';

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { businessId } = await requireAuth();
  const { status, q } = await searchParams;
  const locale = await getLocale();
  const T = (k: string) => t(locale, `t10work.${k}`);
  const jobsL = (k: string) => t(locale, `jobs.${k}`);

  const activeStatus =
    status && (JOB_STATUSES as readonly string[]).includes(status) ? status : 'ALL';

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { currency: true, timezone: true },
  });
  const currency = business?.currency;
  const timezone = business?.timezone ?? 'America/Toronto';
  // Job list + per-status counts from the shared queries (one source of
  // truth with Dashboard / Schedule / Money).
  const [jobs, jobCounts] = await Promise.all([
    getJobs(businessId, { status: activeStatus }),
    getJobCounts(businessId, { timezone }),
  ]);

  // Per-status counts for the filter chips (all jobs, before the search
  // filter - the chips navigate, the search narrows).
  const countByStatus = new Map(Object.entries(jobCounts.byStatus));
  const totalJobs = jobCounts.total;

  const query = (q ?? '').trim().toLowerCase();
  const filtered = query
    ? jobs.filter(
        (j) =>
          j.title.toLowerCase().includes(query) ||
          j.customer.name.toLowerCase().includes(query) ||
          (j.address ?? '').toLowerCase().includes(query)
      )
    : jobs;

  const statusLink = (s: string) => {
    const params = new URLSearchParams();
    if (s !== 'ALL') params.set('status', s);
    if (query) params.set('q', query);
    const qs = params.toString();
    return `/jobs${qs ? `?${qs}` : ''}`;
  };

  const countLabel =
    filtered.length === 1
      ? T('jobsCountOne').replace('{count}', '1')
      : T('jobsCountMany').replace('{count}', String(filtered.length));

  // Export the *currently filtered* list (2026-09-24).
  const exportColumns: ExportColumn[] = [
    { key: 'title', label: t(locale, 'exports.colTitle') },
    { key: 'customer', label: t(locale, 'exports.colCustomer') },
    { key: 'date', label: t(locale, 'exports.colDate') },
    { key: 'time', label: t(locale, 'exports.colTime') },
    { key: 'status', label: t(locale, 'exports.colStatus') },
    { key: 'price', label: t(locale, 'exports.colPrice'), kind: 'money' },
    { key: 'address', label: t(locale, 'exports.colAddress') },
  ];
  const exportRows: ExportRow[] = filtered.map((j) => ({
    title: j.title,
    customer: j.customer.name,
    date: formatDateShort(j.date),
    time: j.time ?? '',
    status: j.status,
    price: centsToDollars(j.priceCents),
    address: j.address ?? '',
  }));
  const exportFileBase = `everyjob-jobs-${new Date().toISOString().slice(0, 10)}`;

  return (
    <div className="space-y-5">
      <PageHeader
        title={jobsL('title')}
        subtitle={countLabel}
        actions={
          <>
            {/* Desktop: export buttons inline. Mobile: behind the More menu. */}
            <div className="hidden md:flex items-center gap-2">
              <ExportButtons
                columns={exportColumns}
                rows={exportRows}
                fileBase={exportFileBase}
                currency={currency}
                locale={locale}
              />
            </div>
            <JobsExportMenu
              columns={exportColumns}
              rows={exportRows}
              fileBase={exportFileBase}
              currency={currency}
              locale={locale}
            />
            <Link href="/jobs/new" className={primaryBtnClass}>
              <Plus size={16} /> {jobsL('newJob')}
            </Link>
          </>
        }
      />

      {/* Search */}
      <form method="GET" action="/jobs" className="relative" role="search">
        {activeStatus !== 'ALL' && <input type="hidden" name="status" value={activeStatus} />}
        <label htmlFor="jobs-search" className="sr-only">
          {t(locale, 'common.search')}
        </label>
        <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
        <input
          id="jobs-search"
          type="search"
          name="q"
          defaultValue={q ?? ''}
          placeholder={T('jobsSearchPlaceholder')}
          className={cn(inputClass, '!pl-10 !bg-white')}
        />
      </form>

      {/* Status filter tabs - sentence case, same fixed order everywhere,
          with counts. Horizontally scrollable; the right-edge fade hints
          there is more to scroll to. */}
      <div className="relative">
        <div
          role="group"
          aria-label={jobsL('status')}
          className="flex items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:thin]"
        >
          {['ALL', ...JOB_STATUSES].map((s) => {
            const chipCount = s === 'ALL' ? totalJobs : (countByStatus.get(s) ?? 0);
            return (
              <Link
                key={s}
                href={statusLink(s)}
                aria-current={activeStatus === s ? 'true' : undefined}
                className={cn(
                  'px-3 min-h-[44px] inline-flex items-center gap-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors border',
                  activeStatus === s
                    ? 'bg-ink text-white border-ink'
                    : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50'
                )}
              >
                {s === 'ALL' ? T('jobsTabAll') : formatStatusLabel(s, locale)}
                <span
                  className={cn(
                    'inline-flex min-w-5 h-5 px-1 rounded-full text-[10px] font-bold items-center justify-center tabular-nums',
                    activeStatus === s ? 'bg-white/25 text-white' : 'bg-zinc-100 text-zinc-600'
                  )}
                >
                  {chipCount}
                </span>
              </Link>
            );
          })}
        </div>
        {/* Edge hint: fade on the right so the scrollable chips read as scrollable. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-white to-transparent"
        />
      </div>

      {/* Job list - vertical list with dividers (DESIGN.md), not card grids. */}
      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Briefcase size={24} />}
            title={jobs.length === 0 ? T('jobsEmptyTitle') : T('jobsNoMatchTitle')}
            description={jobs.length === 0 ? T('jobsEmptyDesc') : T('jobsNoMatchDesc')}
            action={
              jobs.length === 0 ? (
                <Link href="/jobs/new" className={primaryBtnClass}>
                  <Plus size={16} /> {T('jobsCreateFirst')}
                </Link>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden divide-y divide-ej-smoke">
          {filtered.map((job, i) => (
            <Link
              key={job.id}
              href={`/jobs/${job.id}`}
              className="ej-row-in flex items-center justify-between gap-4 p-4 md:p-5 hover:bg-zinc-50 transition-colors"
              // @ts-expect-error CSS custom property for the stagger animation
              style={{ '--row-delay': `${Math.min(i, 12) * 35}ms` }}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-zinc-900 text-sm">{job.title}</p>
                  <StatusBadge
                    status={job.status}
                    isLate={isJobLate({ date: job.date, status: job.status }, new Date(), timezone)}
                    locale={locale}
                  />
                </div>
                <p className="text-xs text-zinc-500 mt-1 truncate">{job.customer.name}</p>
                <p className="text-xs text-zinc-500 truncate">
                  {hasJobTime(job.time) ? `${formatJobTime(job.time, locale)}, ` : ''}
                  <DateTimeText date={job.date} variant="short" locale={locale} />
                  {job.address ? `, ${job.address}` : ''}
                </p>
              </div>
              <p className="font-bold text-zinc-900 text-sm whitespace-nowrap tabular-nums">
                <MoneyText dollars={centsToDollars(job.priceCents)} locale={locale} />
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
