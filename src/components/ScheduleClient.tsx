"use client";

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { 
  Calendar as CalendarIcon, Clock, MapPin, ChevronLeft, ChevronRight, 
  User as UserIcon, Plus, Trash2, Edit3, Filter, Search, ListPlus, CheckCircle2, XCircle
} from 'lucide-react';
import { updateJobStatus, deleteJob, seedSampleJobs, updateJobSchedule } from '@/app/actions/jobs';
import { validNextStatuses } from '@/lib/job-status';
import { formatMoney } from '@/lib/money';
import { toISODateLocal, formatDateLabel, hasJobTime } from '@/lib/utils';

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

export default function ScheduleClient({
  initialJobs,
  initialDateFilter,
  allowSeed,
  currency,
  todayKey,
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
      const res = await updateJobStatus(jobId, newStatus);
      if (res?.error) setActionError(res.error);
    });
  };

  const handleDeleteJob = (jobId: string) => {
    setActionError(null);
    setRemovingJobId(null);
    startTransition(async () => {
      try {
        const res = await deleteJob(jobId);
        if (res?.error) setActionError(res.error);
      } catch {
        setActionError('Could not remove the job — please try again.');
      }
    });
  };

  const handleSeedJobs = () => {
    startTransition(async () => {
      await seedSampleJobs();
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
      const res = await updateJobSchedule(jobId, editDate, editTime, editStatus);
      if (res?.error) {
        setActionError(res.error);
      } else {
        setEditingJobId(null);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-zinc-200/60 shadow-sm">
        
        {/* Date Selector & Navigator */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-zinc-100 p-1 rounded-xl border border-zinc-200">
            <button 
              onClick={handlePrevDay} 
              className="p-1.5 hover:bg-white rounded-lg text-zinc-600 transition-colors"
              title="Previous Day"
            >
              <ChevronLeft size={18} />
            </button>
            <button 
              onClick={() => setSelectedDate('TODAY')}
              className={`px-3 py-1.5 font-bold text-xs rounded-lg transition-colors ${
                selectedDate === 'TODAY' ? 'bg-ink text-white shadow-sm' : 'text-zinc-600 hover:bg-white'
              }`}
            >
              Today
            </button>
            <button 
              onClick={handleNextDay} 
              className="p-1.5 hover:bg-white rounded-lg text-zinc-600 transition-colors"
              title="Next Day"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <button 
            onClick={() => setSelectedDate('ALL')}
            className={`px-3 py-2 font-semibold text-xs rounded-xl border transition-colors ${
              selectedDate === 'ALL' ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50'
            }`}
          >
            All Scheduled Dates ({initialJobs.length})
          </button>

          {selectedDate !== 'TODAY' && selectedDate !== 'ALL' && (
            <span className="text-xs font-bold text-ink bg-smoke px-3 py-1.5 rounded-xl border border-smoke">
              {selectedDate}
            </span>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {canSeed && (
            <button 
              onClick={handleSeedJobs}
              disabled={isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-semibold text-xs transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
            >
              <ListPlus size={14} /> Add 3 sample jobs
            </button>
          )}

          <Link 
            href="/jobs/new" 
            className="bg-ink hover:bg-graphite text-white px-4 py-2.5 rounded-xl font-semibold text-xs transition-colors flex items-center gap-2 shadow-sm"
          >
            <Plus size={14} /> Schedule New Job
          </Link>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-zinc-200/60 shadow-sm">
        
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 custom-scrollbar">
          {['ALL', 'SCHEDULED', 'IN PROGRESS', 'NEW', 'COMPLETED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                statusFilter === st 
                  ? 'bg-ink text-white' 
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        {/* Search Box */}
        <div className="relative min-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input 
            type="text"
            placeholder="Search schedule..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-ink/20 focus:border-ink"
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
            className="text-rose-400 hover:text-rose-600 font-bold"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}

      {/* Jobs List / Grid */}
      <div className="bg-white rounded-2xl border border-zinc-200/60 shadow-sm overflow-hidden min-h-[400px]">
        {filteredJobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 text-center">
            <div className="w-16 h-16 rounded-full bg-zinc-100 flex items-center justify-center mb-4">
              <CalendarIcon className="w-8 h-8 text-zinc-400" />
            </div>
            <h3 className="text-base font-bold text-zinc-900 mb-1">No Jobs Found on Schedule</h3>
            <p className="text-xs text-zinc-500 max-w-sm mb-6">
              {initialJobs.length === 0 
                ? "Your business currently has no jobs mapped in the database." 
                : "No jobs match your current date, status, or search filters."}
            </p>

            <div className="flex items-center gap-3">
              {canSeed ? (
                <button
                  onClick={handleSeedJobs}
                  disabled={isPending}
                  className="bg-ink text-white font-semibold px-4 py-2.5 rounded-xl text-xs hover:bg-graphite transition-colors flex items-center gap-2"
                >
                  <ListPlus size={14} /> Add 3 sample jobs
                </button>
              ) : (
                <button
                  onClick={() => { setSelectedDate('ALL'); setStatusFilter('ALL'); setSearchQuery(''); }}
                  className="bg-zinc-100 text-zinc-800 font-semibold px-4 py-2.5 rounded-xl text-xs hover:bg-zinc-200 transition-colors"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100">
            {filteredJobs.map((job) => {
              const isEditing = editingJobId === job.id;

              return (
                <div key={job.id} className="p-6 hover:bg-zinc-50/50 transition-colors flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                  
                  {/* Left Column: Date, Time & Status */}
                  <div className="flex-1 space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                        job.status === 'IN PROGRESS' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        job.status === 'SCHEDULED' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                        job.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        job.status === 'CANCELLED' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                        'bg-zinc-100 text-zinc-700 border-zinc-200'
                      }`}>
                        {job.status}
                      </span>

                      <div className="flex items-center gap-1.5 text-xs font-bold text-ink bg-smoke px-2.5 py-1 rounded-md">
                        <Clock size={12} />
                        <span>{hasJobTime(job.time) ? job.time : 'Time TBD'}</span>
                      </div>

                      <div className="text-xs font-medium text-zinc-500">
                        {/* Render the server-computed calendar-day key
                            (YYYY-MM-DD), never the raw timestamp: the ISO
                            instant shifts a day in timezones behind/ahead of
                            UTC, the day key cannot. */}
                        📅 {formatDateLabel(job.dateKey)}
                      </div>
                    </div>

                    <div>
                      <Link href={`/jobs/${job.id}`} className="text-lg font-bold text-zinc-900 hover:text-ink transition-colors">
                        {job.title}
                      </Link>
                      <p className="text-xs font-medium text-zinc-600 mt-0.5">
                        Customer: <span className="font-semibold text-zinc-900">{job.customer.name}</span> {job.customer.phone ? `(${job.customer.phone})` : ''}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500 font-medium">
                      {job.address && (
                        <div className="flex items-center gap-1">
                          <MapPin size={12} className="text-zinc-400" />
                          <span>{job.address}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <UserIcon size={12} className="text-zinc-400" />
                        <span>Technician: <strong>{job.assignedTo?.name || 'Unassigned'}</strong></span>
                      </div>
                      <div>
                        Amount: <strong className="text-zinc-900">{formatMoney(job.price, currency)}</strong>
                      </div>
                    </div>

                    {/* Inline Reschedule Form */}
                    {isEditing && (
                      <div className="mt-4 p-4 bg-zinc-50 rounded-xl border border-zinc-200 space-y-3">
                        <div className="text-xs font-bold text-zinc-900">Reschedule Job #{job.id.substring(0, 6)}</div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-[10px] font-bold text-zinc-500 uppercase">Date</label>
                            <input 
                              type="date"
                              value={editDate}
                              onChange={(e) => setEditDate(e.target.value)}
                              className="w-full text-xs p-2 border rounded-lg bg-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-zinc-500 uppercase">Time</label>
                            <input 
                              type="text"
                              value={editTime}
                              onChange={(e) => setEditTime(e.target.value)}
                              placeholder="e.g. 10:00 AM (optional)"
                              className="w-full text-xs p-2 border rounded-lg bg-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-zinc-500 uppercase">Status</label>
                            <select
                              value={editStatus}
                              onChange={(e) => setEditStatus(e.target.value)}
                              className="w-full text-xs p-2 border rounded-lg bg-white"
                            >
                              <option value={job.status}>{job.status}</option>
                              {validNextStatuses(job.status).map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            onClick={() => saveEdit(job.id)}
                            disabled={isPending}
                            className="bg-ink text-white text-xs px-3 py-1.5 rounded-lg font-semibold hover:bg-graphite"
                          >
                            Save Changes
                          </button>
                          <button
                            onClick={() => setEditingJobId(null)}
                            className="bg-zinc-200 text-zinc-700 text-xs px-3 py-1.5 rounded-lg font-semibold hover:bg-zinc-300"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Actions */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0 w-full md:w-auto justify-end border-t md:border-t-0 pt-3 md:pt-0 border-zinc-100">
                    {(() => {
                      const nextStatuses = validNextStatuses(job.status);
                      return (
                        /* Quick Status Dropdown — only offers transitions the
                           server will accept; rejected moves are impossible here. */
                        <select
                          value={job.status}
                          onChange={(e) => handleStatusChange(job.id, e.target.value)}
                          disabled={isPending || nextStatuses.length === 0}
                          title={
                            nextStatuses.length === 0
                              ? 'No further status changes available for this job'
                              : 'Change job status'
                          }
                          className="text-xs bg-zinc-50 border border-zinc-200 font-semibold text-zinc-700 rounded-xl px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-ink disabled:opacity-60"
                        >
                          <option value={job.status}>Current: {job.status}</option>
                          {nextStatuses.map((s) => (
                            <option key={s} value={s}>
                              Set {s}
                            </option>
                          ))}
                        </select>
                      );
                    })()}

                    {/* Reschedule Button */}
                    <button
                      onClick={() => startEdit(job)}
                      className="p-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl transition-colors"
                      title="Reschedule / Edit Date"
                    >
                      <Edit3 size={16} />
                    </button>

                    {/* Remove/Delete Button */}
                    <button
                      onClick={() => setRemovingJobId(job.id)}
                      disabled={isPending}
                      className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors disabled:opacity-50"
                      title="Remove from Schedule"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Remove-from-schedule confirmation (in-app modal) */}
      {removingJobId && (() => {
        const target = initialJobs.find((j) => j.id === removingJobId);
        return (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-950/50 p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Remove job from schedule"
            onClick={() => !isPending && setRemovingJobId(null)}
          >
            <div
              className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-zinc-200 p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-sm font-bold text-zinc-900">Remove from schedule?</h3>
              <p className="mt-2 text-xs text-zinc-500 leading-relaxed">
                {target ? (
                  <>“{target.title}” will be permanently deleted. This cannot be undone.</>
                ) : (
                  <>This job will be permanently deleted. This cannot be undone.</>
                )}
              </p>
              <div className="mt-5 flex gap-2">
                <button
                  onClick={() => setRemovingJobId(null)}
                  disabled={isPending}
                  className="flex-1 bg-zinc-100 hover:bg-zinc-200 disabled:opacity-50 text-zinc-700 text-xs font-semibold py-2.5 rounded-xl transition-colors"
                >
                  Keep it
                </button>
                <button
                  onClick={() => handleDeleteJob(removingJobId)}
                  disabled={isPending}
                  className="flex-1 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-semibold py-2.5 rounded-xl transition-colors"
                >
                  {isPending ? 'Removing…' : 'Yes, remove'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
