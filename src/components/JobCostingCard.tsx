'use client';

import React, { useActionState, useEffect, useRef, useState } from 'react';
import { Timer, AlertCircle } from 'lucide-react';
import { saveHourlyRate, type JobOpsActionResult } from '@/app/actions/jobops';
import { Card } from '@/components/ui';
import { jInputClass, jPrimaryBtnClass, jSecondaryBtnClass } from '@/components/jobops-classes';
import { formatMoney } from '@/lib/money';
import { formatDuration } from '@/lib/timesheets';
import { summarizeJobCost } from '@/lib/costing';
import { t, type Locale } from '@/lib/i18n';

export interface CostingEntryData {
  name: string;
  dateLabel: string;
  active: boolean;
  minutes: number;
}

export interface CostingExpenseData {
  category: string;
  amount: number;
}

/**
 * Job costing card: quoted price vs labor (hours × rate) and expenses,
 * with profit and margin. Inline hourly-rate editor saves to the business.
 */
export function JobCostingCard({
  jobId,
  price,
  laborMinutes,
  timeEntryCount,
  entries,
  hourlyRate,
  expenses,
  locale,
  currency,
}: {
  jobId: string;
  price: number;
  laborMinutes: number;
  timeEntryCount: number;
  entries: CostingEntryData[];
  hourlyRate: number | null;
  expenses: CostingExpenseData[];
  locale: Locale;
  currency?: string;
}) {
  const summary = summarizeJobCost({
    price,
    laborMinutes,
    hourlyRate,
    expenses,
  });

  const hasCostData = laborMinutes > 0 || expenses.length > 0;
  const [editingRate, setEditingRate] = useState(false);

  return (
    <Card className="p-5 md:p-6">
      <h2 className="text-sm font-bold text-ink mb-4 flex items-center gap-2">
        <Timer size={14} /> {t(locale, 'jobops.costing.title')}
        <span className="text-[11px] font-semibold text-graphite">
          ({timeEntryCount} {timeEntryCount === 1 ? t(locale, 'jobops.costing.entry') : t(locale, 'jobops.costing.entries')})
        </span>
      </h2>

      {/* Quoted price */}
      <dl className="space-y-2.5 text-sm">
        <CostRow
          label={t(locale, 'jobops.costing.quotedPrice')}
          value={formatMoney(summary.price, currency)}
          strong
        />

        {/* Labor */}
        <div className="pt-1">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-graphite">{t(locale, 'jobops.costing.labor')}</dt>
            <dd className="font-bold text-ink tabular-nums text-right">
              {formatDuration(laborMinutes)}{' '}
              <span className="text-[11px] font-semibold text-graphite">
                × {hourlyRate !== null ? formatMoney(hourlyRate, currency) : '—'}/h
              </span>
            </dd>
          </div>
          {hourlyRate !== null ? (
            <div className="flex items-center justify-between gap-3 mt-1">
              <button
                type="button"
                onClick={() => setEditingRate((v) => !v)}
                className="text-[11px] font-bold text-ink hover:underline"
              >
                {formatMoney(hourlyRate, currency)}/h · {t(locale, 'jobops.templates.edit')}
              </button>
              <span className="text-sm font-semibold text-ink tabular-nums">
                {formatMoney(summary.laborCost, currency)}
              </span>
            </div>
          ) : (
            <p className="text-[11px] text-graphite mt-1">
              {t(locale, 'jobops.costing.noRate')}
            </p>
          )}
          {editingRate && (
            <div className="mt-2">
              <RateForm
                jobId={jobId}
                locale={locale}
                current={hourlyRate}
                onSaved={() => setEditingRate(false)}
              />
            </div>
          )}
          {hourlyRate === null && (
            <div className="mt-2">
              <RateForm jobId={jobId} locale={locale} current={null} />
            </div>
          )}
        </div>

        {/* Expenses by category */}
        {summary.materialsCost > 0 && (
          <CostRow
            label={t(locale, 'jobops.costing.materials')}
            value={formatMoney(summary.materialsCost, currency)}
          />
        )}
        {summary.travelCost > 0 && (
          <CostRow
            label={t(locale, 'jobops.costing.travel')}
            value={formatMoney(summary.travelCost, currency)}
          />
        )}
        {summary.otherCost > 0 && (
          <CostRow
            label={t(locale, 'jobops.costing.other')}
            value={formatMoney(summary.otherCost, currency)}
          />
        )}

        <div className="border-t border-smoke pt-2.5" />

        <CostRow
          label={t(locale, 'jobops.costing.totalCost')}
          value={formatMoney(summary.totalCost, currency)}
          strong
        />
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-graphite">{t(locale, 'jobops.costing.profit')}</dt>
          <dd
            className={`font-bold tabular-nums ${
              summary.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            {formatMoney(summary.profit, currency)}
            {summary.marginPct !== null && (
              <span className="text-[11px] font-semibold ml-2">
                {summary.marginPct.toFixed(1)}% {t(locale, 'jobops.costing.margin').toLowerCase()}
              </span>
            )}
          </dd>
        </div>
      </dl>

      {!hasCostData && (
        <p className="text-xs text-graphite mt-3">{t(locale, 'jobops.costing.noData')}</p>
      )}

      {/* Time entries */}
      {timeEntryCount === 0 ? (
        <p className="text-xs text-graphite mt-4">{t(locale, 'jobops.costing.noTime')}</p>
      ) : (
        <ul className="divide-y divide-smoke border-t border-smoke mt-4">
          {entries.map((e, i) => (
            <li key={i} className="py-2.5 flex items-center justify-between gap-3 text-sm">
              <div className="min-w-0">
                <p className="font-semibold text-ink truncate">{e.name}</p>
                <p className="text-[11px] text-graphite">
                  {e.dateLabel}
                  {e.active && ' · active now'}
                </p>
              </div>
              <span className="text-sm font-bold text-ink tabular-nums shrink-0">
                {formatDuration(e.minutes)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function CostRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-graphite">{label}</dt>
      <dd className={`tabular-nums ${strong ? 'font-bold text-ink' : 'font-semibold text-ink'}`}>
        {value}
      </dd>
    </div>
  );
}

function RateForm({
  jobId,
  locale,
  current,
  onSaved,
}: {
  jobId: string;
  locale: Locale;
  current: number | null;
  onSaved?: () => void;
}) {
  const [state, formAction, isPending] = useActionState<JobOpsActionResult, FormData>(
    saveHourlyRate,
    {}
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      onSaved?.();
    }
  }, [state, onSaved]);

  return (
    <form ref={formRef} action={formAction}>
      <label className="block text-[11px] font-bold uppercase tracking-wider text-graphite mb-1">
        {t(locale, 'jobops.costing.hourlyRate')}
      </label>
      <div className="flex gap-2">
        <input type="hidden" name="jobId" value={jobId} />
        <input
          name="rate"
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          placeholder={t(locale, 'jobops.costing.ratePlaceholder')}
          defaultValue={current !== null ? String(current) : ''}
          className={`${jInputClass} flex-1 min-w-0`}
          aria-label={t(locale, 'jobops.costing.hourlyRate')}
        />
        <button type="submit" disabled={isPending} className={current === null ? jPrimaryBtnClass : jSecondaryBtnClass}>
          {isPending ? '…' : t(locale, 'jobops.costing.saveRate')}
        </button>
      </div>
      {state?.error && (
        <div className="mt-2 flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl px-3 py-2.5">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{state.error}</span>
        </div>
      )}
    </form>
  );
}
