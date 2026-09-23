"use client";

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import {
  Calendar as CalendarIcon, Clock, MapPin, ChevronLeft, ChevronRight,
  User as UserIcon, Plus, Trash2, Edit3, Search, ListPlus, CheckCircle2, XCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { updateJobStatus, deleteJob, seedSampleJobs, updateJobSchedule } from '@/app/actions/jobs';
import { validNextStatuses } from '@/lib/job-status';
import { formatMoney } from '@/lib/money';
import { toISODateLocal, formatDateLabel, hasJobTime, localeDateTag, cn } from '@/lib/utils';
import { t, type Locale } from '@/lib/i18n';
import {
  Card, StatusBadge, EmptyState, Field,
  primaryBtnClass, secondaryBtnClass, dangerBtnClass, inputClass, selectClass, Dialog,
} from '@/components/ui';

type Job = {
  id: string;
  title: string;
  date: Date | string;
  /** Server-local calendar date (YYYY-MM-DD) — the day the user booked.
   *  All day filtering/counting uses this; never derive it from
   *  toISOString() (UTC), which shifts the day for timezones ahead of UTC. */
  dateKey: string;
  time: string | null;
  address: string | null;
  price: number;
  status: string;
  notes: string | null;
  customer: {
    id: string;
    name: string;
    phone: string | null;
  };
  assignedTo: {
    id: string;
    name: string | null;
    email: string;
  } | null;
};

const STATUS_TABS = ['ALL', 'SCHEDULED', 'IN PROGRESS', 'NEW', 'COMPLETED'] as const;

export default function ScheduleClient({
  initialJobs,
  initialDateFilter,
  allowSeed,
  currency,
  todayKey,
  locale,
}: {
  initialJobs: Job[];
  /** Override the default date filter ('TODAY'). Use 'ALL' to show everything passed in. */
  initialDateFilter?: string;
  /** Show the sample-data seed button. Defaults to true when no jobs are passed in. */
  allowSeed?: boolean;
  currency?: string;
  /** Server-local "today" (YYYY-MM-DD) so the Today filter matches the
   *  server-rendered day tiles even if the browser timezone differs. */
  todayKey?: string;
  locale: Locale;
}) {
  const [selectedDate, setSelectedDate] = useState<string>(initialDateFilter ?? 'TODAY'); // 'TODAY', 'ALL', or YYYY-MM-DD
  const canSeed = allowSeed ?? initialJobs.length === 0;
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState<string>('');
  const [editTime, setEditTime] = useState<string>('');
  const [editStatus, setEditStatus] = useState<string>('');
  const [isPending, startTransition] = useTransition();
  /** Last failed status/date change — shown as a banner so rejections are never silent. */
  const [actionError, setActionError] = useState<string | null>(null);
  /** Job awaiting remove-from-schedule confirmation (in-app modal — never
   *  native confirm(), which automated browsers auto-dismiss). */
  const [removingJobId, setRemovingJobId] = useState<string | null>(null);

  const T = (k: string) => t(locale, `t10work.${k}`);
  const common = (k: string) => t(locale, `common.${k}`);
  const jobsL = (k: string) => t(locale, `jobs.${k}`);
  const dateLocale = localeDateTag(locale);

  // Local calendar-day key (YYYY-MM-DD). The server passes its own today so
  // the filter always agrees with the day tiles above.
  const todayStr = todayKey && /^\d{4}-\d{2}-\d{2}$/.test(todayKey)
    ? todayKey
    : toISODateLocal(new Date());

  // Day filtering/counting uses job.dateKey (server-local calendar date);
  // display labels use the shared timezone-safe formatDateLabel from
  // @/lib/utils (never `new Date(iso)` + toLocaleDateString, which shifts
  // the day for timezones behind UTC).

  // Filter jobs logic — compare calendar-day keys, never UTC date strings.
  const filteredJobs = initialJobs.filter((job) => {
    const jobDateStr = job.dateKey;

    // Date filter
    if (selectedDate === 'TODAY' && jobDateStr !== todayStr) return false;
    if (selectedDate !== 'TODAY' && selectedDate !== 'ALL' && jobDateStr !== selectedDate) return false;

    // Status filter
    if (statusFilter !== 'ALL' && job.status !== statusFilter) return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = job.title.toLowerCase().includes(q);
      const matchCustomer = job.customer.name.toLowerCase().includes(q);
      const matchAddress = job.address?.toLowerCase().includes(q) || false;
      const matchTech = job.assignedTo?.name?.toLowerCase().includes(q) || false;
      if (!matchTitle && !matchCustomer && !matchAddress && !matchTech) return false;
    }

    return true;
  });

  /** Shift the selected calendar day by `delta` days using local date math
   *  (parsing 'YYYY-MM-DD' with `new Date(str)` would anchor at UTC midnight
   *  and shift the day for timezones ahead of UTC). */
  const shiftSelectedDay = (delta: number) => {
    const base =
      selectedDate === 'TODAY' || selectedDate === 'ALL' ? todayStr : selectedDate;
    const [y, m, d] = base.split('-').map(Number);
    setSelectedDate(toISODateLocal(new Date(y, m - 1, d + delta)));
  };

  const handleNextDay = () => shiftSelectedDay(1);

  const handlePrevDay = () => shiftSelectedDay(-1);

  const handleStatusChange = (jobId: string, newStatus: string) => {
    setActionError(null);
    startTransition(async () => {
      try {
        const res = await updateJobStatus(jobId, newStatus);
        if (res?.error) {
          setActionError(res.error);
          toast.error(T('schedErrorStatus'));
        } else {
          toast.success(T('schedStatusChanged'));
        }
      } catch {
        setActionError(T('schedErrorStatus'));
        toast.error(T('schedErrorStatus'));
      }
    });
  };

  const handleDeleteJob = (jobId: string) => {
    setActionError(null);
    setRemovingJobId(null);
    startTransition(async () => {
      try {
        const res = await deleteJob(jobId);
        if (res?.error) {
          setActionError(res.error);
          toast.error(T('schedErrorDelete'));
        } else {
          toast.success(T('schedDeleted'));
        }
      } catch {
        setActionError(T('schedErrorDelete'));
        toast.error(T('schedErrorDelete'));
      }
    });
  };

  const handleSeedJobs = () => {
    startTransition(async () => {
      try {
        const res = await seedSampleJobs();
        if (res?.error) {
          setActionError(res.error);
          toast.error(T('schedErrorSeed'));
        } else {
          toast.success(T('schedSeeded'));
        }
      } catch {
        toast.error(T('schedErrorSeed'));
      }
    });
  };

  const startEdit = (job: Job) => {
    setEditingJobId(job.id);
    // Prefill with the booked calendar day (not a UTC-derived date, which
    // would show the previous day for timezones ahead of UTC).
    setEditDate(job.dateKey);
    // Prefill the real time when one is set. Never invent "10:00 AM" for an
    // unset time (saving would then silently set a time the user never chose),
    // and never show the legacy "TBD" sentinel as if it were a real time —
    // the save path already turns a blank input back into NULL.
    setEditTime(hasJobTime(job.time) ? job.time : '');
    setEditStatus(job.status);
  };

  const saveEdit = (jobId: string) => {
    setActionError(null);
    startTransition(async () => {
      try {
        const res = await updateJobSchedule(jobId, editDate, editTime, editStatus);
        if (res?.error) {
          setActionError(res.error);
          toast.error(T('schedErrorStatus'));
        } else {
          setEditingJobId(null);
          toast.success(T('schedRescheduled'));
        }
      } catch {
        setActionError(T('schedErrorStatus'));
        toast.error(T('schedErrorStatus'));
      }
    });
  };

  const selectedLabel =
    selectedDate === 'TODAY'
      ? T('schedToday')
      : selectedDate === 'ALL'
        ? `${T('schedAllDates')} (${initialJobs.length})`
        : formatDateLabel(selectedDate, dateLocale);

  return (
    <div className="space-y-5">
      {/* Date navigator */}
      <Card className="p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center bg-zinc-100 p-1 rounded-xl border border-zinc-200">
              <button
                onClick={handlePrevDay}
                className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-white rounded-lg text-zinc-600 transition-colors"
                aria-label={T('schedPrevDay')}
              >
                <ChevronLeft size={18} />
              </button>
              <button
                onClick={() => setSelectedDate('TODAY')}
                aria-pressed={selectedDate === 'TODAY'}
                className={cn(
                  'px-4 min-h-[44px] font-bold text-sm rounded-lg transition-colors',
                  selectedDate === 'TODAY' ? 'bg-ink text-white shadow-sm' : 'text-zinc-600 hover:bg-white'
                )}
              >
                {T('schedToday')}
              </button>
              <button
                onClick={handleNextDay}
                className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-white rounded-lg text-zinc-600 transition-colors"
                aria-label={T('schedNextDay')}
              >
                <ChevronRight size={18} />
              </button>
            </div>
            <button
              onClick={() => setSelectedDate('ALL')}
              aria-pressed={selectedDate === 'ALL'}
              className={cn(
                'px-4 min-h-[44px] font-semibold text-sm rounded-xl border transition-colors whitespace-nowrap',
                selectedDate === 'ALL' ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50'
              )}
            >
              {T('schedAllDates')} ({initialJobs.length})
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {canSeed && (
              <button
                onClick={handleSeedJobs}
                disabled={isPending}
                className={secondaryBtnClass}
              >
                <ListPlus size={14} /> {T('schedSeedJobs')}
              </button>
            )}
            <Link href="/jobs/new" className={primaryBtnClass}>
              <Plus size={14} /> {T('schedNewJobBtn')}
            </Link>
          </div>
        </div>

        {selectedDate !== 'TODAY' && selectedDate !== 'ALL' && (
          <p className="mt-3 text-xs font-bold text-ink bg-smoke px-3 py-1.5 rounded-xl border border-smoke inline-flex">
            {formatDateLabel(selectedDate, dateLocale)}
          </p>
        )}
      </Card>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div
          role="group"
          aria-label={jobsL('status')}
          className="flex items-center gap-1.5 overflow-x-auto pb-1 flex-1"
        >
          {STATUS_TABS.map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              aria-pressed={statusFilter === st}
              className={cn(
                'px-3 min-h-[44px] rounded-lg text-xs font-semibold whitespace-nowrap transition-colors border',
                statusFilter === st
                  ? 'bg-ink text-white border-ink'
                  : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50'
              )}
            >
              {st === 'ALL' ? T('jobsTabAll') : st}
            </button>
          ))}
        </div>

        <div className="relative sm:w-64">
          <label htmlFor="schedule-search" className="sr-only">
            {common('search')}
          </label>
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
          <input
            id="schedule-search"
            type="search"
            placeholder={T('schedSearch')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={cn(inputClass, '!pl-9')}
          />
        </div>
      </div>

      {/* Rejection feedback — status/date changes the server refuses surface here. */}
      {actionError && (
        <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-2xl px-4 py-3">
          <XCircle size={14} className="mt-0.5 shrink-0" />
          <span className="flex-1">{actionError}</span>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-rose-400 hover:text-rose-600 font-bold min-w-[44px] min-h-[44px] -m-2 flex items-center justify-center"
            aria-label={t(locale, 't10work.statusCloseDialog')}
          >
            ✕
          </button>
        </div>
      )}

      {/* Jobs list */}
      {filteredJobs.length === 0 ? (
        <Card>
          <EmptyState
            icon={<CalendarIcon size={24} />}
            title={T('schedEmptyTitle')}
            description={initialJobs.length === 0 ? T('schedEmptyNone') : T('schedEmptyFiltered')}
            action={
              canSeed ? (
                <button
                  onClick={handleSeedJobs}
                  disabled={isPending}
                  className={primaryBtnClass}
                >
                  <ListPlus size={14} /> {T('schedSeedJobs')}
                </button>
              ) : (
                <button
                  onClick={() => { setSelectedDate('ALL'); setStatusFilter('ALL'); setSearchQuery(''); }}
                  className={secondaryBtnClass}
                >
                  {T('schedClearFilters')}
                </button>
              )
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredJobs.map((job, i) => {
            const isEditing = editingJobId === job.id;
            const nextStatuses = validNextStatuses(job.status);

            return (
              <Card
                key={job.id}
                className="p-4 md:p-5 ej-row-in"
                style={{ '--row-delay': `${Math.min(i, 10) * 40}ms` } as React.CSSProperties}
              >
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                  {/* Tap target → job detail */}
                  <Link href={`/jobs/${job.id}`} className="flex-1 min-w-0 space-y-2.5 py-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={job.status} />
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-ink bg-smoke px-2.5 py-1 rounded-md">
                        <Clock size={12} />
                        {hasJobTime(job.time) ? job.time : T('schedTimeTbd')}
                      </span>
                      <span className="text-xs font-medium text-zinc-500">
                        {formatDateLabel(job.dateKey, dateLocale)}
                      </span>
                    </div>

                    <div>
                      <p className="text-base font-bold text-zinc-900">{job.title}</p>
                      <p className="text-xs font-medium text-zinc-600 mt-0.5">
                        {jobsL('customer')}: <span className="font-semibold text-zinc-900">{job.customer.name}</span>
                        {job.customer.phone ? ` (${job.customer.phone})` : ''}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-zinc-500 font-medium">
                      {job.address && (
                        <span className="inline-flex items-center gap-1 min-w-0">
                          <MapPin size={12} className="text-zinc-400 shrink-0" />
                          <span className="truncate">{job.address}</span>
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <UserIcon size={12} className="text-zinc-400" />
                        {jobsL('technician')}: <strong className="text-zinc-700">{job.assignedTo?.name || T('jobUnassigned')}</strong>
                      </span>
                      <span>
                        {T('schedAmount')}: <strong className="text-zinc-900 tabular-nums">{formatMoney(job.price, currency)}</strong>
                      </span>
                    </div>
                  </Link>

                  {/* Actions (kept outside the detail link) */}
                  <div className="flex items-center gap-2 shrink-0 md:flex-col md:items-end">
                    <select
                      value={job.status}
                      onChange={(e) => handleStatusChange(job.id, e.target.value)}
                      disabled={isPending || nextStatuses.length === 0}
                      title={nextStatuses.length === 0 ? T('schedNoFurtherStatuses') : T('schedChangeStatus')}
                      aria-label={T('schedChangeStatus')}
                      className={cn(selectClass, '!min-h-[44px] !w-auto text-xs font-semibold')}
                    >
                      <option value={job.status}>{T('schedCurrentStatus').replace('{status}', job.status)}</option>
                      {nextStatuses.map((s) => (
                        <option key={s} value={s}>
                          {T('schedSetStatus').replace('{status}', s)}
                        </option>
                      ))}
                    </select>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => startEdit(job)}
                        className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl transition-colors"
                        title={T('schedRescheduleTitle')}
                        aria-label={T('schedRescheduleTitle')}
                      >
                        <Edit3 size={16} />
                      </button>
                      <button
                        onClick={() => setRemovingJobId(job.id)}
                        disabled={isPending}
                        className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors disabled:opacity-50"
                        title={jobsL('removeFromSchedule')}
                        aria-label={jobsL('removeFromSchedule')}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Inline reschedule form */}
                {isEditing && (
                  <div className="mt-4 p-4 bg-zinc-50 rounded-xl border border-zinc-200 space-y-4">
                    <p className="text-xs font-bold text-zinc-900">{T('schedReschedule')}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <Field label={jobsL('date')}>
                        <input
                          type="date"
                          value={editDate}
                          onChange={(e) => setEditDate(e.target.value)}
                          className={inputClass}
                        />
                      </Field>
                      <Field label={jobsL('time')}>
                        <input
                          type="text"
                          value={editTime}
                          onChange={(e) => setEditTime(e.target.value)}
                          placeholder="10:00 AM"
                          className={inputClass}
                        />
                      </Field>
                      <Field label={jobsL('status')}>
                        <select
                          value={editStatus}
                          onChange={(e) => setEditStatus(e.target.value)}
                          className={selectClass}
                        >
                          <option value={job.status}>{job.status}</option>
                          {validNextStatuses(job.status).map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => saveEdit(job.id)}
                        disabled={isPending}
                        className={primaryBtnClass}
                      >
                        <CheckCircle2 size={14} /> {T('schedSave')}
                      </button>
                      <button
                        onClick={() => setEditingJobId(null)}
                        className={secondaryBtnClass}
                      >
                        {common('cancel')}
                      </button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Remove-from-schedule confirmation (foundation Dialog: bottom sheet on mobile, Esc closes) */}
      <Dialog
        open={removingJobId !== null}
        onClose={() => !isPending && setRemovingJobId(null)}
        title={jobsL('confirmRemoveTitle')}
      >
        <p className="text-sm text-zinc-500 leading-relaxed">
          {(() => {
            const target = initialJobs.find((j) => j.id === removingJobId);
            return target
              ? `\u201c${target.title}\u201d — ${jobsL('confirmRemoveBody')}`
              : jobsL('confirmRemoveBody');
          })()}
        </p>
        <div className="mt-6 flex gap-2">
          <button
            onClick={() => setRemovingJobId(null)}
            disabled={isPending}
            className={secondaryBtnClass + ' flex-1'}
          >
            {jobsL('keepIt')}
          </button>
          <button
            onClick={() => removingJobId && handleDeleteJob(removingJobId)}
            disabled={isPending}
            className={dangerBtnClass + ' flex-1'}
          >
            {isPending ? common('deleting') : T('schedYesRemove')}
          </button>
        </div>
      </Dialog>
    </div>
  );
}
