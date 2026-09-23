'use client';

import React, { useEffect, useState, useTransition } from 'react';
import { Play, Square, AlertCircle, Timer } from 'lucide-react';
import { clockIn, clockOut } from '@/app/actions/timesheets';
import { primaryBtnClass, secondaryBtnClass, inputClass } from '@/components/ui';
import { cn } from '@/lib/utils';

export interface ActiveSession {
  clockInISO: string;
  jobTitle: string | null;
}

function formatElapsed(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/** Live clock in/out widget. Shows the active session with a ticking timer. */
export default function ClockWidget({
  activeSession,
  jobs,
}: {
  activeSession: ActiveSession | null;
  jobs: Array<{ id: string; title: string }>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [jobId, setJobId] = useState('');
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!activeSession) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [activeSession]);

  const runClockIn = () => {
    setError(null);
    startTransition(async () => {
      const res = await clockIn(jobId ? { jobId } : {});
      if (res.error) setError(res.error);
      else setJobId('');
    });
  };

  const runClockOut = () => {
    setError(null);
    startTransition(async () => {
      const res = await clockOut();
      if (res.error) setError(res.error);
    });
  };

  if (activeSession) {
    const elapsed = now - new Date(activeSession.clockInISO).getTime();
    return (
      <div className="bg-[#17122b] text-white rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#938b9f] mb-1 flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
              </span>
              Clocked in
              {activeSession.jobTitle && (
                <span className="normal-case tracking-normal font-semibold text-white/80 truncate">
                  · {activeSession.jobTitle}
                </span>
              )}
            </p>
            <p className="text-3xl font-bold tabular-nums tracking-tight">
              {formatElapsed(elapsed)}
            </p>
            <p className="text-xs text-[#938b9f] mt-1">
              since {new Date(activeSession.clockInISO).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <button
            onClick={runClockOut}
            disabled={isPending}
            className={cn(
              secondaryBtnClass,
              '!bg-[#6329d4] !border-[#6329d4] !text-white hover:!bg-[#5221b3] !py-3 !px-5 !text-sm shrink-0'
            )}
          >
            <Square size={14} />
            {isPending ? 'Clocking out…' : 'Clock out'}
          </button>
        </div>
        {error && (
          <div className="mt-3 flex items-start gap-2 bg-rose-500/15 border border-rose-400/30 text-rose-200 text-xs font-medium rounded-xl px-3 py-2.5">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-zinc-200/60 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-xl bg-violet-100 text-[#6329d4] flex items-center justify-center">
          <Timer size={16} />
        </div>
        <div>
          <h2 className="text-sm font-bold text-zinc-900">Track your time</h2>
          <p className="text-xs text-zinc-500">Clock in when you start a job</p>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <select
          value={jobId}
          onChange={(e) => setJobId(e.target.value)}
          className={cn(inputClass, 'sm:max-w-xs')}
          aria-label="Job (optional)"
        >
          <option value="">No job — general work</option>
          {jobs.map((j) => (
            <option key={j.id} value={j.id}>
              {j.title}
            </option>
          ))}
        </select>
        <button onClick={runClockIn} disabled={isPending} className={cn(primaryBtnClass, '!py-2.5')}>
          <Play size={14} />
          {isPending ? 'Clocking in…' : 'Clock in'}
        </button>
      </div>
      {error && (
        <div className="mt-3 flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl px-3 py-2.5">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
