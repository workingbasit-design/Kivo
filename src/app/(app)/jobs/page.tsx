import React from 'react';
import Link from 'next/link';
import { Plus, Briefcase, Search } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { PageHeader, Card, StatusBadge, EmptyState, limeBtnClass, inputClass } from '@/components/ui';
import { formatDateShort, hasJobTime, cn, jobDisplayStatus } from '@/lib/utils';
import { formatMoney } from '@/lib/money';
import { JOB_STATUSES } from '@/lib/validations';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import ExportButtons, { type ExportColumn, type ExportRow } from '@/components/ExportButtons';

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

  const business = await prisma.business.findUnique({ where: { id: businessId }, select: { currency: true } });
  const currency = business?.currency;
  const jobs = await prisma.job.findMany({
    where: {
      businessId,
      ...(activeStatus !== 'ALL' ? { status: activeStatus } : {}),
    },
    include: {
      customer: { select: { id: true, name: true, phone: true } },
    },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
  });

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
    price: j.price,
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
            <ExportButtons
              columns={exportColumns}
              rows={exportRows}
              fileBase={exportFileBase}
              currency={currency}
              locale={locale}
            />
            <Link href="/jobs/new" className={limeBtnClass}>
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

      {/* Status filter tabs */}
      <div
        role="group"
        aria-label={jobsL('status')}
        className="flex items-center gap-1.5 overflow-x-auto pb-1"
      >
        {['ALL', ...JOB_STATUSES].map((s) => (
          <Link
            key={s}
            href={statusLink(s)}
            aria-current={activeStatus === s ? 'true' : undefined}
            className={cn(
              'px-3 min-h-[44px] inline-flex items-center rounded-lg text-xs font-semibold whitespace-nowrap transition-colors border',
              activeStatus === s
                ? 'bg-ink text-white border-ink'
                : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50'
            )}
          >
            {s === 'ALL' ? T('jobsTabAll') : s}
          </Link>
        ))}
      </div>

      {/* Job list — cards on mobile, compact rows on desktop */}
      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Briefcase size={24} />}
            title={jobs.length === 0 ? T('jobsEmptyTitle') : T('jobsNoMatchTitle')}
            description={jobs.length === 0 ? T('jobsEmptyDesc') : T('jobsNoMatchDesc')}
            action={
              jobs.length === 0 ? (
                <Link href="/jobs/new" className={limeBtnClass}>
                  <Plus size={16} /> {T('jobsCreateFirst')}
                </Link>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="space-y-3 md:space-y-0 md:bg-white md:rounded-2xl md:border md:border-zinc-200/60 md:shadow-sm md:overflow-hidden md:divide-y md:divide-zinc-100">
          {filtered.map((job, i) => (
            <Link
              key={job.id}
              href={`/jobs/${job.id}`}
              className="ej-row-in flex items-center justify-between gap-4 p-4 md:p-5 bg-white rounded-[20px] border border-zinc-200/70 shadow-[0_1px_3px_rgba(22,22,22,0.06)] md:rounded-none md:border-0 md:shadow-none hover:bg-zinc-50/70 transition-colors"
              // @ts-expect-error CSS custom property for the stagger animation
              style={{ '--row-delay': `${Math.min(i, 12) * 35}ms` }}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-zinc-900 text-sm">{job.title}</p>
                  <StatusBadge status={jobDisplayStatus(job.status, job.date)} />
                </div>
                <p className="text-xs text-zinc-500 mt-1 truncate">
                  {job.customer.name}
                  {hasJobTime(job.time) ? ` · ${job.time}` : ''} · {formatDateShort(job.date)}
                  {job.address ? ` · ${job.address}` : ''}
                </p>
              </div>
              <p className="font-bold text-zinc-900 text-sm whitespace-nowrap tabular-nums">
                {formatMoney(job.price, currency)}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
