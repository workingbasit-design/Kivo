import React from 'react';
import Link from 'next/link';
import { Plus, Repeat, Clock, MapPin } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { PageHeader, Card, EmptyState, Badge, limeBtnClass, secondaryBtnClass } from '@/components/ui';
import { formatDateShort, cn } from '@/lib/utils';
import { formatMoney } from '@/lib/money';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import RecurringRowActions from './RecurringRowActions';
import GenerateDueJobsButton from './GenerateDueJobsButton';

export default async function RecurringPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { businessId } = await requireAuth();
  const { filter } = await searchParams;
  const locale = await getLocale();
  const T = (k: string) => t(locale, `t10work.${k}`);
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
  const freqLabel = (f: string) =>
    f === 'WEEKLY' ? T('freqWeekly') : f === 'BIWEEKLY' ? T('freqBiweekly') : f === 'MONTHLY' ? T('freqMonthly') : f;

  const plansLabel =
    plans.length === 1
      ? T('recurPlansOne').replace('{count}', '1')
      : T('recurPlansMany').replace('{count}', String(plans.length));

  return (
    <div className="space-y-5">
      <PageHeader
        title={T('recurTitle')}
        subtitle={
          dueCount > 0
            ? `${plansLabel} · ${T('recurDueNow').replace('{count}', String(dueCount))}`
            : plansLabel
        }
        actions={
          <>
            <GenerateDueJobsButton />
            <Link href="/recurring/new" className={limeBtnClass}>
              <Plus size={16} /> {T('recurNewPlan')}
            </Link>
          </>
        }
      />

      {/* Filter tabs */}
      <div role="group" aria-label={T('recurTitle')} className="flex items-center gap-1.5">
        {['ALL', 'active', 'paused'].map((f) => (
          <Link
            key={f}
            href={filterLink(f)}
            aria-current={activeFilter === f ? 'true' : undefined}
            className={cn(
              'px-4 min-h-[44px] inline-flex items-center rounded-lg text-xs font-semibold whitespace-nowrap transition-colors border',
              activeFilter === f
                ? 'bg-ink text-white border-ink'
                : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50'
            )}
          >
            {f === 'ALL' ? T('recurTabAll') : f === 'active' ? T('recurActive') : T('recurPaused')}
          </Link>
        ))}
      </div>

      {plans.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Repeat size={24} />}
            title={
              activeFilter === 'ALL'
                ? T('recurEmptyAll')
                : activeFilter === 'active'
                  ? T('recurEmptyActive')
                  : T('recurEmptyPaused')
            }
            description={
              activeFilter === 'ALL'
                ? T('recurEmptyDescAll')
                : T('recurEmptyDescFiltered')
            }
            action={
              activeFilter === 'ALL' ? (
                <Link href="/recurring/new" className={limeBtnClass}>
                  <Plus size={16} /> {T('recurCreateFirst')}
                </Link>
              ) : (
                <Link href="/recurring" className={secondaryBtnClass}>
                  {T('recurShowAll')}
                </Link>
              )
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {plans.map((plan, i) => (
            <Card
              key={plan.id}
              className={cn('p-5 ej-row-in', !plan.active && 'opacity-70')}
              style={{ '--row-delay': `${Math.min(i, 8) * 45}ms` } as React.CSSProperties}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-zinc-900 text-sm">{plan.title}</h3>
                    <Badge tone={plan.active ? 'success' : 'neutral'}>
                      {plan.active ? T('recurActive') : T('recurPaused')}
                    </Badge>
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">
                    {plan.customer.name} · {freqLabel(plan.frequency)}
                  </p>
                </div>
                <RecurringRowActions id={plan.id} active={plan.active} />
              </div>

              <div className="mt-4 space-y-1.5 text-xs text-zinc-600">
                <p className="flex items-center gap-2">
                  <Clock size={13} className="text-zinc-400 shrink-0" />
                  {T('recurNextRun')}:{' '}
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
                <span className="text-sm font-bold text-zinc-900 tabular-nums">{formatMoney(plan.price, currency)}</span>
                <span className="text-[11px] text-zinc-400 font-medium">
                  {plan._count.jobs === 1
                    ? T('recurJobsGeneratedOne').replace('{count}', '1')
                    : T('recurJobsGeneratedMany').replace('{count}', String(plan._count.jobs))}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
