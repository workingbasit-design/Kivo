'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, Repeat, Clock, MapPin } from 'lucide-react';
import { PageHeader, Card, EmptyState, Badge, limeBtnClass, secondaryBtnClass } from '@/components/ui';
import { formatDateShort, cn } from '@/lib/utils';
import { formatMoney } from '@/lib/money';
import { t, type Locale } from '@/lib/i18n';
import RecurringRowActions from './RecurringRowActions';
import GenerateDueJobsButton from './GenerateDueJobsButton';

const FILTERS = ['ALL', 'active', 'paused'] as const;
type Filter = (typeof FILTERS)[number];

export type RecurringPlanItem = {
  id: string;
  title: string;
  frequency: string;
  price: number;
  active: boolean;
  nextRun: string | Date;
  time: string | null;
  address: string | null;
  customer: { id: string; name: string };
  jobCount: number;
};

/**
 * Recurring plans with instant client-side tab filtering. The server sends
 * all plans once; switching tabs filters in memory — no navigation, no
 * server roundtrip, no lag.
 */
export default function RecurringClient({
  plans,
  dueCount,
  currency,
  locale,
  initialFilter,
}: {
  plans: RecurringPlanItem[];
  dueCount: number;
  currency?: string | null;
  locale: Locale;
  initialFilter: Filter;
}) {
  const [activeFilter, setActiveFilter] = useState<Filter>(initialFilter);
  const T = (k: string) => t(locale, `t10work.${k}`);

  const filtered = useMemo(
    () =>
      activeFilter === 'ALL'
        ? plans
        : plans.filter((p) => (activeFilter === 'active' ? p.active : !p.active)),
    [plans, activeFilter]
  );

  const switchFilter = (f: Filter) => {
    setActiveFilter(f);
    // Keep the URL truthful (refresh/bookmark keeps the tab) without
    // triggering a Next.js navigation.
    const url = f === 'ALL' ? '/recurring' : `/recurring?filter=${f}`;
    window.history.replaceState(null, '', url);
  };

  const freqLabel = (f: string) =>
    f === 'WEEKLY' ? T('freqWeekly') : f === 'BIWEEKLY' ? T('freqBiweekly') : f === 'MONTHLY' ? T('freqMonthly') : f;

  const plansLabel =
    filtered.length === 1
      ? T('recurPlansOne').replace('{count}', '1')
      : T('recurPlansMany').replace('{count}', String(filtered.length));

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
      <div role="tablist" aria-label={T('recurTitle')} className="flex items-center gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={activeFilter === f}
            onClick={() => switchFilter(f)}
            className={cn(
              'px-4 min-h-[44px] inline-flex items-center rounded-lg text-xs font-semibold whitespace-nowrap transition-colors border',
              activeFilter === f
                ? 'bg-ink text-white border-ink'
                : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50'
            )}
          >
            {f === 'ALL' ? T('recurTabAll') : f === 'active' ? T('recurActive') : T('recurPaused')}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
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
                <button type="button" onClick={() => switchFilter('ALL')} className={secondaryBtnClass}>
                  {T('recurShowAll')}
                </button>
              )
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((plan, i) => (
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
                  {plan.jobCount === 1
                    ? T('recurJobsGeneratedOne').replace('{count}', '1')
                    : T('recurJobsGeneratedMany').replace('{count}', String(plan.jobCount))}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
