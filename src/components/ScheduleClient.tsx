"use client";

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import {
  Calendar as CalendarIcon, Clock, MapPin, GripVertical,
  User as UserIcon, Trash2, Edit3, ListPlus, CheckCircle2
} from '@/components/icons';
import { toast } from 'sonner';
import { updateJobStatus, deleteJob, seedSampleJobs, updateJobSchedule } from '@/app/actions/jobs';
import { validNextStatuses, JOB_STATUSES } from '@/lib/job-status';
import MoneyText from '@/components/MoneyText';
import DateTimeText from '@/components/DateTimeText';
import { toISODateLocal, hasJobTime, formatJobTime, formatStatusLabel, jobDisplayStatus, cn, localeDateTag } from '@/lib/utils';
import { t, type Locale } from '@/lib/i18n';
import {
  Banner,
  BottomSheet,
  Button,
  Card,
  DateField,
  EmptyState,
  FilterChips,
  Input,
  SearchField,
  Select,
} from '@/components/kit';
import { StatusPill } from '@/app/(app)/_components/status-ui';
import { DRAG_TYPE, type DragJob } from '@/components/schedule/WeekStrip';

type Job = {
  id: string;
  title: string;
  date: Date | string;
  /** Server-local calendar date (YYYY-MM-DD) - the day the user booked.
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

/**
 * Minutes since midnight for agenda sorting. Handles both stored formats
 * ("09:00" and "10:00 AM"). Untimed / unparseable jobs sort last.
 */
function timeToMinutes(time: string | null): number {
  if (!time) return Number.MAX_SAFE_INTEGER;
  const m = time.trim().match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])?$/);
  if (!m) return Number.MAX_SAFE_INTEGER;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const meridiem = m[3]?.toUpperCase();
  if (meridiem === 'PM' && h < 12) h += 12;
  if (meridiem === 'AM' && h === 12) h = 0;
  if (h > 23 || min > 59) return Number.MAX_SAFE_INTEGER;
  return h * 60 + min;
}

/**
 * Minutes since midnight "now" in the business timezone (DESIGN.md today
 * timeline). Falls back to the browser's local time when the timezone is
 * invalid - never throws on a bad IANA name.
 */
function nowMinutesInTimezone(timezone: string): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    }).formatToParts(new Date());
    const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
    const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
    if (Number.isNaN(hour) || Number.isNaN(minute)) return 0;
    // hour12:false can yield hour "24" at midnight in some runtimes.
    return ((hour % 24) * 60 + minute) % 1440;
  } catch {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  }
}

export default function ScheduleClient({
  initialJobs,
  initialDateFilter,
  allowSeed,
  todayKey,
  locale,
  activeDayHoliday,
  timezone,
}: {
  initialJobs: Job[];
  /** Override the default date filter ('TODAY'). Use 'ALL' to show everything passed in. */
  initialDateFilter?: string;
  /** Show the sample-data seed button. Defaults to true when no jobs are passed in. */
  allowSeed?: boolean;
  /** Server-local "today" (YYYY-MM-DD) so the Today filter matches the
   *  server-rendered day tiles even if the browser timezone differs. */
  todayKey?: string;
  locale: Locale;
  /** Full holiday name for the selected day, shown in the agenda header
   *  (never truncated). Null when the day is not a holiday. */
  activeDayHoliday?: string | null;
  /** Business IANA timezone - drives the today-timeline dot position. */
  timezone?: string;
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
  /** Last failed status/date change - shown as a banner so rejections are never silent. */
  const [actionError, setActionError] = useState<string | null>(null);
  /** Job awaiting remove-from-schedule confirmation (in-app modal - never
   *  native confirm(), which automated browsers auto-dismiss). */
  const [removingJobId, setRemovingJobId] = useState<string | null>(null);

  const T = (k: string) => t(locale, `t10work.${k}`);
  const common = (k: string) => t(locale, `common.${k}`);
  const jobsL = (k: string) => t(locale, `jobs.${k}`);

  // Local calendar-day key (YYYY-MM-DD). The server passes its own today so
  // the filter always agrees with the day tiles above.
  const todayStr = todayKey && /^\d{4}-\d{2}-\d{2}$/.test(todayKey)
    ? todayKey
    : toISODateLocal(new Date());

  // Day filtering/counting uses job.dateKey (server-local calendar date);
  // display labels use the shared DateTimeText component (never
  // `new Date(iso)` + toLocaleDateString, which shifts the day for
  // timezones behind UTC).

  // Filter jobs logic - compare calendar-day keys, never UTC date strings.
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

  // Agenda mode: a single day is selected, so the list below is that
  // day's agenda (time, title, customer, status, address), sorted by
  // start time with untimed jobs last.
  const isAgendaDay = selectedDate !== 'ALL' && selectedDate !== 'TODAY';
  const agendaJobs = isAgendaDay
    ? [...filteredJobs].sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time))
    : filteredJobs;

  // Today's view (filter or explicit day) gets the DESIGN.md timeline.
  const isTodayView = selectedDate === 'TODAY' || selectedDate === todayStr;

  // Part E2: conflict detection. Two OPEN, timed visits on the same day with
  // the same start time. No invented durations — a shared start time is a
  // fact. Completed, paid, and cancelled visits cannot conflict.
  const OPEN_STATUSES = new Set(['NEW', 'SCHEDULED', 'IN PROGRESS']);
  const conflicts = (() => {
    const byDayTime = new Map<string, typeof filteredJobs>();
    for (const job of filteredJobs) {
      if (!OPEN_STATUSES.has(job.status)) continue;
      if (!hasJobTime(job.time)) continue;
      const key = `${job.dateKey}|${timeToMinutes(job.time)}`;
      const list = byDayTime.get(key);
      if (list) list.push(job);
      else byDayTime.set(key, [job]);
    }
    return [...byDayTime.values()].filter((l) => l.length > 1);
  })();

  const dayLabel = (dateKey: string) =>
    new Date(`${dateKey}T00:00:00`).toLocaleDateString(localeDateTag(locale), {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });

  const conflictMessage = (() => {
    if (conflicts.length === 0) return null;
    const [a, b] = conflicts[0];
    const time = formatJobTime(a.time, locale);
    const day = dayLabel(a.dateKey);
    if (conflicts.length === 1) {
      return T('schedConflictOne')
        .replace('{a}', a.title)
        .replace('{b}', b.title)
        .replace('{time}', time)
        .replace('{day}', day);
    }
    return T('schedConflictMany')
      .replace('{a}', a.title)
      .replace('{b}', b.title)
      .replace('{time}', time)
      .replace('{day}', day)
      .replace('{n}', String(conflicts.length - 1));
  })();

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
    // and never show the legacy "TBD" sentinel as if it were a real time -
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

  return (
    <div className="space-y-5">
      {/* Agenda header - shown when a single day is selected. The 7-day
          strip above is the only date navigator (the old "All scheduled
          dates" reset button duplicated it); "Show whole week" in the
          strip clears the day selection. The holiday name appears here
          in full, never as a truncated chip. */}
      {isAgendaDay && (
        <div>
          <h2 className="text-base font-bold text-ink">
            <DateTimeText date={selectedDate} variant="weekday" timezone={timezone} locale={locale} />
          </h2>
          {activeDayHoliday && (
            <p className="text-sm text-warn-text mt-0.5">🎉 {activeDayHoliday}</p>
          )}
          <p className="text-xs text-ink-2 mt-0.5">
            {agendaJobs.length === 1
              ? T('jobsCountOne').replace('{count}', '1')
              : T('jobsCountMany').replace('{count}', String(agendaJobs.length))}
          </p>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <FilterChips
            chips={(['ALL', ...JOB_STATUSES] as const).map((st) => ({
              id: st,
              label: st === 'ALL' ? T('jobsTabAll') : formatStatusLabel(st, locale),
            }))}
            selectedId={statusFilter}
            onSelect={setStatusFilter}
            ariaLabel={jobsL('status')}
          />
        </div>

        <div className="sm:w-64">
          <SearchField
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder={T('schedSearch')}
            label={common('search')}
            clearLabel={jobsL('clearSearch')}
          />
        </div>
      </div>

      {/* Rejection feedback — status/date changes the server refuses surface here. */}
      {actionError && (
        <Banner
          tone="warn"
          title={actionError}
          text=""
          actionLabel={common('close')}
          onAction={() => setActionError(null)}
        />
      )}

      {/* Part E2: overlapping visits. One warning per screen, naming the
          visits, the time, and the day. */}
      {conflictMessage && (
        <Banner tone="warn" title={T('schedConflictTitle')} text={conflictMessage} />
      )}

      {/* Jobs list - the day's agenda when a single day is selected */}
      {agendaJobs.length === 0 ? (
        <Card className="mb-28 md:mb-0">
          <EmptyState
            icon={<CalendarIcon />}
            title={T('schedEmptyTitle')}
            text={initialJobs.length === 0 ? T('schedEmptyNone') : T('schedEmptyFiltered')}
          />
          <div className="flex justify-center px-6 pb-8 -mt-4">
            {canSeed ? (
              <Button
                type="button"
                variant="primary"
                onClick={handleSeedJobs}
                disabled={isPending}
              >
                <ListPlus size={14} /> {T('schedSeedJobs')}
              </Button>
            ) : isAgendaDay ? (
              // Empty day: start a new job with that date prefilled.
              <Button type="button" variant="primary" href={`/jobs/new?date=${selectedDate}`}>
                {T('schedNewJobForDay')}
              </Button>
            ) : (
              <Button
                type="button"
                variant="secondary"
                onClick={() => { setSelectedDate('ALL'); setStatusFilter('ALL'); setSearchQuery(''); }}
              >
                {T('schedClearFilters')}
              </Button>
            )}
          </div>
        </Card>
      ) : (
        // DESIGN.md: work screens are vertical lists with dividers, not card
        // grids. On today's view the list carries the one memorable element:
        // a 2px ink line down the left with a 10px dot at the current time
        // (business timezone). Other days show a plain list. The dot
        // lives in the outer wrapper so divide-y still treats the first
        // row as the first child (no double top border).
        <div className="relative">
          {isTodayView && (
            <span
              aria-hidden
              className="absolute left-[-1px] z-10 block h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-ink"
              style={{ top: `${(nowMinutesInTimezone(timezone ?? 'America/Toronto') / 1440) * 100}%` }}
            />
          )}
          <div
            className={cn(
              'bg-surface rounded-xl border border-line overflow-hidden divide-y divide-line',
              isTodayView && 'border-l-2 border-l-ink'
            )}
          >
          {agendaJobs.map((job) => {
            const isEditing = editingJobId === job.id;
            const nextStatuses = validNextStatuses(job.status);

            return (
              <div
                key={job.id}
                className="p-4 md:p-5"
              >
                <div className="flex items-start gap-2">
                  {/* Drag handle (desktop only). The reschedule dialog is the
                      non-drag path for touch and keyboard (WCAG 2.5.7). */}
                  <span
                    draggable
                    aria-hidden="true"
                    title={T('schedDragHandle').replace('{title}', job.title)}
                    onDragStart={(e) => {
                      const payload: DragJob = {
                        id: job.id,
                        title: job.title,
                        time: job.time ?? '',
                        status: job.status,
                      };
                      e.dataTransfer.setData(DRAG_TYPE, JSON.stringify(payload));
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    className="hidden md:inline-flex min-w-[44px] min-h-[44px] items-center justify-center text-ink-2 cursor-grab active:cursor-grabbing shrink-0 -ml-2"
                  >
                    <GripVertical size={18} />
                  </span>
                  <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 flex-1 min-w-0">
                  {/* Tap target → job detail */}
                  <Link href={`/jobs/${job.id}`} className="flex-1 min-w-0 space-y-2.5 py-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill status={jobDisplayStatus(job.status, job.date)} locale={locale} />
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-ink bg-ink/10 px-2.5 py-1 rounded-md tabular-nums">
                        <Clock size={12} />
                        {hasJobTime(job.time) ? formatJobTime(job.time, locale) : T('schedTimeTbd')}
                      </span>
                      <span className="text-xs font-medium text-ink-2">
                        <DateTimeText date={job.dateKey} variant="weekday" timezone={timezone} locale={locale} />
                      </span>
                    </div>

                    <div>
                      <p className="text-base font-bold text-ink">{job.title}</p>
                      <p className="text-xs font-medium text-ink-2 mt-0.5">
                        {jobsL('customer')}: <span className="font-semibold text-ink">{job.customer.name}</span>
                        {job.customer.phone ? ` (${job.customer.phone})` : ''}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-2 font-medium">
                      {job.address && (
                        <span className="inline-flex items-center gap-1 min-w-0">
                          <MapPin size={12} className="text-ink-2 shrink-0" />
                          <span className="truncate">{job.address}</span>
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <UserIcon size={12} className="text-ink-2" />
                        {jobsL('technician')}: <strong className="text-ink-2">{job.assignedTo?.name || T('jobUnassigned')}</strong>
                      </span>
                      <span>
                        {T('schedAmount')}: <strong className="text-ink tabular-nums"><MoneyText dollars={job.price} locale={locale} /></strong>
                      </span>
                    </div>
                  </Link>

                  {/* Actions (kept outside the detail link) */}
                  <div className="flex items-center gap-2 shrink-0 md:flex-col md:items-end">
                    <Select
                      label={<span className="sr-only">{T('schedChangeStatus')}</span>}
                      value={job.status}
                      onChange={(e) => handleStatusChange(job.id, e.target.value)}
                      disabled={isPending || nextStatuses.length === 0}
                      title={nextStatuses.length === 0 ? T('schedNoFurtherStatuses') : T('schedChangeStatus')}
                      aria-label={T('schedChangeStatus')}
                      className="w-auto"
                      options={[
                        { value: job.status, label: T('schedCurrentStatus').replace('{status}', job.status) },
                        ...nextStatuses.map((s) => ({
                          value: s,
                          label: T('schedSetStatus').replace('{status}', s),
                        })),
                      ]}
                    />

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => startEdit(job)}
                        className="min-w-[44px] min-h-[44px] flex items-center justify-center text-ink-2 rounded-full bg-surface border border-line"
                        title={T('schedRescheduleTitle')}
                        aria-label={T('schedRescheduleTitle')}
                      >
                        <Edit3 size={16} />
                      </button>
                      <button
                        onClick={() => setRemovingJobId(job.id)}
                        disabled={isPending}
                        className="min-w-[44px] min-h-[44px] flex items-center justify-center text-danger rounded-full disabled:opacity-50 bg-surface border border-line"
                        title={jobsL('removeFromSchedule')}
                        aria-label={jobsL('removeFromSchedule')}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
                </div>

                {/* Inline reschedule form — the non-drag path for moving a visit
                    (WCAG 2.5.7). Works with keyboard, touch, and screen readers. */}
                {isEditing && (
                  <div className="mt-4 p-4 bg-surface rounded-xl border border-line space-y-4">
                    <p className="text-xs font-bold text-ink">{T('schedReschedule')}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <DateField
                        label={jobsL('date')}
                        value={editDate}
                        onChange={(e) => setEditDate(e.target.value)}
                      />
                      <Input
                        label={jobsL('time')}
                        type="text"
                        value={editTime}
                        onChange={(e) => setEditTime(e.target.value)}
                        placeholder="10:00 AM"
                      />
                      <Select
                        label={jobsL('status')}
                        value={editStatus}
                        onChange={(e) => setEditStatus(e.target.value)}
                        options={[
                          { value: job.status, label: job.status },
                          ...validNextStatuses(job.status).map((s) => ({ value: s, label: s })),
                        ]}
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="primary"
                        onClick={() => saveEdit(job.id)}
                        disabled={isPending}
                      >
                        <CheckCircle2 size={14} /> {T('schedSave')}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setEditingJobId(null)}
                      >
                        {common('cancel')}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          </div>
        </div>
      )}

      {/* Remove-from-schedule confirmation (bottom sheet on mobile, Esc closes) */}
      <BottomSheet
        open={removingJobId !== null}
        onClose={() => !isPending && setRemovingJobId(null)}
        title={jobsL('confirmRemoveTitle')}
        footer={
          <div className="mt-6 flex gap-2">
            <Button
              type="button"
              variant="secondary"
              block
              onClick={() => setRemovingJobId(null)}
              disabled={isPending}
            >
              {jobsL('keepIt')}
            </Button>
            <Button
              type="button"
              variant="danger"
              block
              onClick={() => removingJobId && handleDeleteJob(removingJobId)}
              disabled={isPending}
            >
              {isPending ? common('deleting') : T('schedYesRemove')}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-ink-2 leading-relaxed">
          {(() => {
            const target = initialJobs.find((j) => j.id === removingJobId);
            return target
              ? `\u201c${target.title}\u201d - ${jobsL('confirmRemoveBody')}`
              : jobsL('confirmRemoveBody');
          })()}
        </p>
      </BottomSheet>
    </div>
  );
}
