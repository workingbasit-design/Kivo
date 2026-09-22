import React from 'react';
import Link from 'next/link';
import { Plus, Repeat, Clock, MapPin } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { PageHeader, Card, EmptyState } from '@/components/ui';
import { formatDateShort, cn } from '@/lib/utils';
import { formatMoney } from '@/lib/money';
import { frequencyLabel } from '@/lib/recurring';
import RecurringRowActions from './RecurringRowActions';
import GenerateDueJobsButton from './GenerateDueJobsButton';

export default async function RecurringPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { businessId } = await requireAuth();
  const { filter } = await searchParams;
  const activeFilter = filter === 'paused' ? 'paused' : filter === 'active' ? 'active' : 'ALL';

  const business = await prisma.business.findUnique({ where: { id: businessId }, select: { currency: true } });
  const currency = business?.currency;
  const plans = await prisma.recurringJob.findMany({
    where: {
      businessId,
      ...(activeFilter === 'active' ? { active: true } : {}),
      ...(activeFilter === 'paused' ? { active: false } : {}),
    },
    include: {
      customer: { select: { id: true, name: true } },
      _count: { select: { jobs: true } },
    },
    orderBy: { nextRun: 'asc' },
  });

  const dueCount = await prisma.recurringJob.count({
    where: { businessId, active: true, nextRun: { lte: new Date() } },
  });

  const filterLink = (f: string) => (f === 'ALL' ? '/recurring' : `/recurring?filter=${f}`);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recurring jobs"
        subtitle={
          dueCount > 0
            ? `${plans.length} plan${plans.length === 1 ? '' : 's'} · ${dueCount} due now`
            : `${plans.length} plan${plans.length === 1 ? '' : 's'}`
        }
        actions={
          <>
            <GenerateDueJobsButton />
            <Link
              href="/recurring/new"
              className="bg-[#6329d4] hover:bg-[#5221b3] text-white px-4 py-2.5 rounded-xl font-semibold text-xs transition-colors inline-flex items-center gap-2 shadow-sm"
            >
              <Plus size={14} /> New plan
            </Link>
          </>
        }
      />

      {/* Filter tabs */}
      <div className="flex items-center gap-1.5">
        {['ALL', 'active', 'paused'].map((f) => (
          <Link
            key={f}
            href={filterLink(f)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-semibold capitalize whitespace-nowrap transition-colors',
              activeFilter === f
                ? 'bg-[#6329d4] text-white'
                : 'bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-50'
            )}
          >
            {f === 'ALL' ? 'All' : f}
          </Link>
        ))}
      </div>

      {plans.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Repeat size={24} />}
            title={
              activeFilter === 'ALL'
                ? 'No recurring plans yet'
                : activeFilter === 'active'
                  ? 'No active plans'
                  : 'No paused plans'
            }
            description={
              activeFilter === 'ALL'
                ? "Set up weekly, fortnightly, or monthly visits once — Kivo creates the jobs for you when they're due."
                : 'No plans match this filter. Try a different filter, or create a new plan.'
            }
            action={
              activeFilter === 'ALL' ? (
                <Link
                  href="/recurring/new"
                  className="bg-[#6329d4] hover:bg-[#5221b3] text-white px-4 py-2.5 rounded-xl font-semibold text-xs transition-colors inline-flex items-center gap-2 shadow-sm"
                >
                  <Plus size={14} /> Create your first plan
                </Link>
              ) : (
                <Link
                  href="/recurring"
                  className="bg-zinc-900 hover:bg-zinc-700 text-white px-4 py-2.5 rounded-xl font-semibold text-xs transition-colors inline-flex items-center gap-2 shadow-sm"
                >
                  Show all plans
                </Link>
              )
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {plans.map((plan) => (
            <Card key={plan.id} className={cn('p-5', !plan.active && 'opacity-70')}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-zinc-900 text-sm">{plan.title}</h3>
                    <span
                      className={cn(
                        'inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border',
                        plan.active
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-zinc-100 text-zinc-500 border-zinc-200'
                      )}
                    >
                      {plan.active ? 'Active' : 'Paused'}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">
                    {plan.customer.name} · {frequencyLabel(plan.frequency)}
                  </p>
                </div>
                <RecurringRowActions id={plan.id} active={plan.active} />
              </div>

              <div className="mt-4 space-y-1.5 text-xs text-zinc-600">
                <p className="flex items-center gap-2">
                  <Clock size={13} className="text-zinc-400 shrink-0" />
                  Next run:{' '}
                  <span className="font-semibold text-zinc-900">
                    {formatDateShort(plan.nextRun)}
                  </span>
                  {plan.time && <span className="text-zinc-500">· {plan.time}</span>}
                </p>
                {plan.address && (
                  <p className="flex items-center gap-2">
                    <MapPin size={13} className="text-zinc-400 shrink-0" />
                    <span className="truncate">{plan.address}</span>
                  </p>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-zinc-100 flex items-center justify-between">
                <span className="text-sm font-bold text-zinc-900">{formatMoney(plan.price, currency)}</span>
                <span className="text-[11px] text-zinc-400 font-medium">
                  {plan._count.jobs} job{plan._count.jobs === 1 ? '' : 's'} generated
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
