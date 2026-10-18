'use client';

import React, { useEffect, useState, useTransition } from 'react';
import { Play, Square, AlertCircle, Timer } from '@/components/icons';
import { clockIn, clockOut } from '@/app/actions/timesheets';
import { Button, Card } from '@/components/kit';
import { useResolvedT } from '@/hooks/useResolvedLocale';
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
  const { t, locale } = useResolvedT();

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
      <div className="bg-asphalt text-hero-ink rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-hero-ink-2 mb-1 flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-ok opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-ok" />
              </span>
              {t('t10work.clockedIn')}
              {activeSession.jobTitle && (
                <span className="normal-case tracking-normal font-semibold text-hero-ink-2 truncate">
                  · {activeSession.jobTitle}
                </span>
              )}
            </p>
            <p className="text-3xl font-bold tabular-nums tracking-tight">
              {formatElapsed(elapsed)}
            </p>
            <p className="text-xs text-hero-ink-2 mt-1">
              {t('t10work.clockSince')}{' '}
              {new Date(activeSession.clockInISO).toLocaleTimeString(
                locale === 'fr' ? 'fr-CA' : 'en-CA',
                { hour: '2-digit', minute: '2-digit' }
              )}
            </p>
          </div>
          <button
            onClick={runClockOut}
            disabled={isPending}
            className={cn(
              'inline-flex items-center justify-center gap-2 min-h-[44px] px-[14px] rounded-[12px] font-bold text-[15px]',
              'bg-asphalt text-hero-ink shadow-[inset_0_0_0_1.5px_var(--hero-line)] hover:bg-graphite shrink-0',
              'disabled:opacity-60 disabled:cursor-not-allowed',
              'focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2'
            )}
          >
            <Square size={14} />
            {isPending ? t('t10work.clockingOut') : t('t10work.clockOut')}
          </button>
        </div>
        {error && (
          <div className="mt-3 flex items-start gap-2 bg-danger-bg border border-danger/30 text-danger text-xs font-medium rounded-xl px-3 py-2.5">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-xl bg-surface-2 text-ink flex items-center justify-center">
          <Timer size={16} />
        </div>
        <div>
          <h2 className="text-sm font-bold text-ink">{t('t10work.clockTitle')}</h2>
          <p className="text-xs text-ink-2">{t('t10work.clockSubtitle')}</p>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <span className="select sm:max-w-xs w-full">
          <select
            value={jobId}
            onChange={(e) => setJobId(e.target.value)}
            className="input"
            aria-label={t('t10work.clockJobAria')}
          >
            <option value="">{t('t10work.clockNoJob')}</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title}
              </option>
            ))}
          </select>
        </span>
        <Button
          variant="primary"
          onClick={runClockIn}
          disabled={isPending}
          className="!py-2.5 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Play size={14} />
          {isPending ? t('t10work.clockingIn') : t('t10work.clockIn')}
        </Button>
      </div>
      {error && (
        <div className="mt-3 flex items-start gap-2 bg-danger-bg border border-danger/30 text-danger text-xs font-medium rounded-xl px-3 py-2.5">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </Card>
  );
}
