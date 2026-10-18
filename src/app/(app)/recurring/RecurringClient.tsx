'use client';

import React, { useMemo, useState } from 'react';
import { Plus, Repeat, Clock, MapPin } from '@/components/icons';

import { formatDateShort, formatJobTime, cn } from '@/lib/utils';
import { formatMoney } from '@/lib/money';
import { t, type Locale } from '@/lib/i18n';
import RecurringRowActions from './RecurringRowActions';
import GenerateDueJobsButton from './GenerateDueJobsButton';
import { PageHeader, EmptyState, Button, Chip, Card } from '@/components/kit';

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
 * all plans once; switching tabs filters in memory - no navigation, no
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
        summary={
          dueCount > 0
            ? `${plansLabel} · ${T('recurDueNow').replace('{count}', String(dueCount))}`
            : plansLabel
        }
        actionLabel={T('recurNewPlan')}
        actionHref="/recurring/new"
        actionIcon={Plus}
      />
      <div className="flex flex-wrap gap-2">
        <GenerateDueJobsButton />
      </div>

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
                ? 'bg-asphalt text-hero-ink border-asphalt'
                : 'bg-surface text-ink-2 border-line hover:bg-surface-2'
            )}
          >
            {f === 'ALL' ? T('recurTabAll') : f === 'active' ? T('recurActive') : T('recurPaused')}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={Repeat}
            title={
              activeFilter === 'ALL'
                ? T('recurEmptyAll')
                : activeFilter === 'active'
                  ? T('recurEmptyActive')
                  : T('recurEmptyPaused')
            }
            text={
              activeFilter === 'ALL'
                ? T('recurEmptyDescAll')
                : T('recurEmptyDescFiltered')
            }
          />
          <div className="flex justify-center pb-10 -mt-6">
            {activeFilter === 'ALL' ? (
              <Button href="/recurring/new" variant="primary">
                <Plus size={16} /> {T('recurCreateFirst')}
              </Button>
            ) : (
              <Button variant="secondary" onClick={() => switchFilter('ALL')}>
                {T('recurShowAll')}
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((plan, i) => (
            <Card
              key={plan.id}
              className={cn('p-5 ej-row-in', !plan.active && 'opacity-70')}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-ink text-sm">{plan.title}</h3>
                    <Chip tone={plan.active ? 'ok' : 'neutral'}>
                      {plan.active ? T('recurActive') : T('recurPaused')}
                    </Chip>
                  </div>
                  <p className="text-xs text-ink-2 mt-1">
                    {plan.customer.name} · {freqLabel(plan.frequency)}
                  </p>
                </div>
                <RecurringRowActions id={plan.id} active={plan.active} />
              </div>

              <div className="mt-4 space-y-1.5 text-xs text-ink-2">
                <p className="flex items-center gap-2">
                  <Clock size={13} className="text-ink-2 shrink-0" />
                  {T('recurNextRun')}:{' '}
                  <span className="font-semibold text-ink">
                    {formatDateShort(plan.nextRun)}
                  </span>
                  {plan.time && <span className="text-ink-2">· {formatJobTime(plan.time, locale)}</span>}
                </p>
                {plan.address && (
                  <p className="flex items-center gap-2">
                    <MapPin size={13} className="text-ink-2 shrink-0" />
                    <span className="truncate">{plan.address}</span>
                  </p>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-line flex items-center justify-between">
                <span className="text-sm font-bold text-ink tabular-nums">{formatMoney(plan.price, currency)}</span>
                <span className="text-[11px] text-ink-2 font-medium">
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
