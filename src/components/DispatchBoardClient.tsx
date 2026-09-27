'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Clock, MapPin, Phone, User, ChevronRight } from 'lucide-react';
import { t, type Locale } from '@/lib/i18n';
import { StatusBadge } from '@/components/ui';
import { formatMoney } from '@/lib/money';
import { hasJobTime, cn } from '@/lib/utils';
import { updateJobStatus, assignJobTechnician } from '@/app/actions/dispatch';

export interface DispatchJob {
  id: string;
  title: string;
  time: string | null;
  status: string;
  price: number;
  address: string | null;
  technician: string | null;
  assignedToId: string | null;
  assignedToName: string | null;
  customerName: string;
  customerPhone: string | null;
  customerId: string;
}

const COLUMNS = [
  { status: 'SCHEDULED', next: 'IN PROGRESS' },
  { status: 'IN PROGRESS', next: 'COMPLETED' },
  { status: 'COMPLETED', next: null },
] as const;

/**
 * Kanban-style dispatch board. Each column is a job status; dispatchers can
 * advance a job to the next status or assign a technician inline. Full job
 * details are one tap away. Mobile-first: columns stack vertically on phones,
 * sit side-by-side on desktop.
 */
export default function DispatchBoardClient({
  jobs: initialJobs,
  team,
  currency,
  locale,
}: {
  jobs: DispatchJob[];
  team: { id: string; name: string | null }[];
  currency?: string | null;
  locale: Locale;
}) {
  const [jobs, setJobs] = useState(initialJobs);
  const [pending, startTransition] = useTransition();
  const T = (k: string) => t(locale, `dispatch.${k}`);

  const advance = (job: DispatchJob, nextStatus: string) => {
    startTransition(async () => {
      setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, status: nextStatus } : j)));
      const res = await updateJobStatus(job.id, nextStatus);
      if (!res.ok) {
        // Roll back on failure
        setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, status: job.status } : j)));
      }
    });
  };

  const assign = (job: DispatchJob, userId: string) => {
    startTransition(async () => {
      const member = team.find((m) => m.id === userId);
      setJobs((prev) =>
        prev.map((j) =>
          j.id === job.id ? { ...j, assignedToId: userId, assignedToName: member?.name ?? null } : j
        )
      );
      const res = await assignJobTechnician(job.id, userId);
      if (!res.ok) {
        setJobs((prev) =>
          prev.map((j) =>
            j.id === job.id ? { ...j, assignedToId: job.assignedToId, assignedToName: job.assignedToName } : j
          )
        );
      }
    });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {COLUMNS.map((col) => {
        const colJobs = jobs.filter((j) => j.status === col.status);
        return (
          <div key={col.status} className="rounded-2xl border border-zinc-200/70 bg-zinc-50/50 p-3">
            <div className="flex items-center justify-between px-1 pb-3">
              <h2 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                <StatusBadge status={col.status} />
                <span className="tabular-nums text-zinc-500 font-semibold">{colJobs.length}</span>
              </h2>
            </div>
            <div className="space-y-3">
              {colJobs.length === 0 ? (
                <p className="text-xs text-zinc-400 text-center py-6">{T('emptyColumn')}</p>
              ) : (
                colJobs.map((job) => (
                  <div
                    key={job.id}
                    className="bg-white rounded-xl border border-zinc-200/70 shadow-sm p-4 space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm text-zinc-900 truncate">{job.title}</p>
                        <p className="text-xs text-zinc-500 truncate mt-0.5">{job.customerName}</p>
                      </div>
                      <p className="text-sm font-bold tabular-nums text-zinc-900 whitespace-nowrap">
                        {formatMoney(job.price, currency)}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
                      {hasJobTime(job.time) && (
                        <span className="inline-flex items-center gap-1">
                          <Clock size={12} /> {job.time}
                        </span>
                      )}
                      {job.address && (
                        <span className="inline-flex items-center gap-1 min-w-0">
                          <MapPin size={12} className="shrink-0" />
                          <span className="truncate">{job.address}</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <User size={12} className="text-zinc-400 shrink-0" />
                      {team.length > 0 ? (
                        <select
                          value={job.assignedToId ?? ''}
                          onChange={(e) => assign(job, e.target.value)}
                          disabled={pending}
                          aria-label={T('assignTech')}
                          className="text-xs font-medium text-zinc-700 bg-zinc-50 border border-zinc-200 rounded-lg px-2 py-1.5 min-h-[36px] max-w-full"
                        >
                          <option value="">{T('unassigned')}</option>
                          {team.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name ?? m.id.slice(0, 8)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-xs text-zinc-400">{T('noTeam')}</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      {col.next && (
                        <button
                          type="button"
                          onClick={() => advance(job, col.next!)}
                          disabled={pending}
                          className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl bg-ink px-3 py-2 text-xs font-semibold text-white hover:bg-graphite disabled:opacity-50 min-h-[40px] transition-colors"
                        >
                          {col.next === 'IN PROGRESS' ? T('startJob') : T('completeJob')}
                        </button>
                      )}
                      <Link
                        href={`/jobs/${job.id}`}
                        className="inline-flex items-center justify-center rounded-xl border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 min-h-[40px]"
                        aria-label={T('viewDetails')}
                      >
                        <ChevronRight size={14} />
                      </Link>
                      {job.customerPhone && (
                        <a
                          href={`tel:${job.customerPhone}`}
                          className="inline-flex items-center justify-center rounded-xl border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 min-h-[40px]"
                          aria-label={T('callCustomer')}
                        >
                          <Phone size={14} />
                        </a>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
