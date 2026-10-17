'use client';

import React, { useState, useTransition } from 'react';
import { PlusCircle, AlertCircle, Clock } from '@/components/icons';
import { createManualEntry } from '@/app/actions/timesheets';
import { Card, Field, inputClass, primaryBtnClass } from '@/components/ui';
import { cn } from '@/lib/utils';
import { t, type Locale } from '@/lib/i18n';

/**
 * Collapsible manual time-entry form pre-scoped to one job.
 * Admins can log for any team member; members are locked to themselves.
 * Lives on the job detail page so time can be logged without leaving the job.
 */
export default function JobTimeEntryForm({
  jobId,
  jobTitle,
  members,
  isAdmin,
  selfId,
  locale,
}: {
  jobId: string;
  jobTitle: string;
  members: Array<{ id: string; name: string | null; email: string }>;
  isAdmin: boolean;
  selfId: string;
  locale: Locale;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const fd = new FormData(e.currentTarget);
    const userId = isAdmin ? String(fd.get('userId') ?? '') : selfId;
    startTransition(async () => {
      const res = await createManualEntry({
        userId,
        clockIn: String(fd.get('clockIn') ?? ''),
        clockOut: String(fd.get('clockOut') ?? ''),
        jobId,
        notes: String(fd.get('notes') ?? '') || undefined,
      });
      if (res.error) {
        setError(res.error);
      } else {
        setSaved(true);
        (e.target as HTMLFormElement).reset();
      }
    });
  };

  return (
    <div id="job-time-form" className="scroll-mt-24">
      <Card className="p-5 md:p-6">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex items-center gap-2 text-sm font-bold text-ink"
        >
          <Clock size={14} />
          {open
            ? t(locale, 'jobops.costing.hideForm')
            : t(locale, 'jobops.costing.timeFormTitle')}
          <PlusCircle
            size={16}
            className={cn('text-ink transition-transform', open && 'rotate-45')}
          />
        </button>
        <p className="text-[11px] text-graphite mt-1">
          {jobTitle}
        </p>

        {open && (
          <form onSubmit={submit} className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {isAdmin && (
              <Field label={t(locale, 't10work.manualMember')}>
                <select
                  name="userId"
                  required
                  className={inputClass}
                  defaultValue={selfId}
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name || m.email}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <Field label={t(locale, 't10work.manualStart')}>
              <input
                name="clockIn"
                type="datetime-local"
                required
                className={inputClass}
              />
            </Field>
            <Field label={t(locale, 't10work.manualEnd')}>
              <input
                name="clockOut"
                type="datetime-local"
                required
                className={inputClass}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label={t(locale, 't10work.manualNotes')}>
                <input
                  name="notes"
                  type="text"
                  maxLength={500}
                  placeholder={t(locale, 't10work.manualNotesPh')}
                  className={inputClass}
                />
              </Field>
            </div>
            {error && (
              <div className="sm:col-span-2 flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl px-3 py-2.5">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {saved && (
              <p className="sm:col-span-2 text-xs font-semibold text-emerald-600">
                {t(locale, 'jobops.costing.timeSaved')}
              </p>
            )}
            <div className="sm:col-span-2">
              <button type="submit" disabled={isPending} className={cn(primaryBtnClass)}>
                {isPending
                  ? t(locale, 't10work.manualSaving')
                  : t(locale, 't10work.manualSave')}
              </button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
