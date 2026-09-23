import React from 'react';
import Link from 'next/link';
import { Plus, Briefcase, Search } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { PageHeader, Card, StatusBadge, EmptyState } from '@/components/ui';
import { formatDateShort, cn, hasJobTime } from '@/lib/utils';
import { formatMoney } from '@/lib/money';
import { JOB_STATUSES } from '@/lib/validations';

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { businessId } = await requireAuth();
  const { status, q } = await searchParams;

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Jobs"
        subtitle={`${filtered.length} job${filtered.length === 1 ? '' : 's'}`}
        actions={
          <Link
            href="/jobs/new"
            className="bg-[#6329d4] hover:bg-[#5221b3] text-white px-4 py-2.5 rounded-xl font-semibold text-xs transition-colors inline-flex items-center gap-2 shadow-sm"
          >
            <Plus size={14} /> New job
          </Link>
        }
      />

      {/* Search */}
      <form method="GET" action="/jobs" className="relative">
        {activeStatus !== 'ALL' && <input type="hidden" name="status" value={activeStatus} />}
        <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
        <input
          type="text"
          name="q"
          defaultValue={q ?? ''}
          placeholder="Search by job, customer, or address…"
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6329d4]/30 focus:border-[#6329d4]"
        />
      </form>

      {/* Status filter tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {['ALL', ...JOB_STATUSES].map((s) => (
          <Link
            key={s}
            href={statusLink(s)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors',
              activeStatus === s
                ? 'bg-[#6329d4] text-white'
                : 'bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-50'
            )}
          >
            {s === 'ALL' ? 'All' : s}
          </Link>
        ))}
      </div>

      {/* Job list */}
      <Card>
        {filtered.length === 0 ? (
          <EmptyState
            icon={<Briefcase size={24} />}
            title={jobs.length === 0 ? 'No jobs yet' : 'No jobs match your filters'}
            description={
              jobs.length === 0
                ? 'Create your first job — it takes less than 20 seconds.'
                : 'Try a different status or search term.'
            }
            action={
              jobs.length === 0 ? (
                <Link
                  href="/jobs/new"
                  className="bg-[#6329d4] hover:bg-[#5221b3] text-white px-4 py-2.5 rounded-xl font-semibold text-xs transition-colors inline-flex items-center gap-2"
                >
                  <Plus size={14} /> Create first job
                </Link>
              ) : undefined
            }
          />
        ) : (
          <div className="divide-y divide-zinc-100">
            {filtered.map((job) => (
              <Link
                key={job.id}
                href={`/jobs/${job.id}`}
                className="flex items-center justify-between gap-4 p-4 md:p-5 hover:bg-zinc-50/70 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-zinc-900 text-sm truncate">{job.title}</p>
                    <StatusBadge status={job.status} />
                  </div>
                  <p className="text-xs text-zinc-500 mt-1 truncate">
                    {job.customer.name}
                    {hasJobTime(job.time) ? ` · ${job.time}` : ''} · {formatDateShort(job.date)}
                    {job.address ? ` · ${job.address}` : ''}
                  </p>
                </div>
                <p className="font-bold text-zinc-900 text-sm whitespace-nowrap">
                  {formatMoney(job.price, currency)}
                </p>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
