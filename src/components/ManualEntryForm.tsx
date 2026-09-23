'use client';

import React, { useState, useTransition } from 'react';
import { PlusCircle, AlertCircle } from 'lucide-react';
import { createManualEntry } from '@/app/actions/timesheets';
import { Field, inputClass, primaryBtnClass } from '@/components/ui';
import { useResolvedT } from '@/hooks/useResolvedLocale';
import { cn } from '@/lib/utils';

/** Form to log a manual time entry. Admins pick any member; members are locked to self. */
export default function ManualEntryForm({
  members,
  jobs,
  isAdmin,
  selfId,
}: {
  members: Array<{ id: string; name: string | null; email: string }>;
  jobs: Array<{ id: string; title: string }>;
  isAdmin: boolean;
  selfId: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const { t } = useResolvedT();

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const userId = isAdmin ? String(fd.get('userId') ?? '') : selfId;
    startTransition(async () => {
      const res = await createManualEntry({
        userId,
        clockIn: String(fd.get('clockIn') ?? ''),
        clockOut: String(fd.get('clockOut') ?? ''),
        jobId: String(fd.get('jobId') ?? '') || undefined,
        notes: String(fd.get('notes') ?? '') || undefined,
      });
      if (res.error) {
        setError(res.error);
      } else {
        setOpen(false);
        (e.target as HTMLFormElement).reset();
      }
    });
  };

  return (
    <div className="bg-white rounded-2xl border border-zinc-200/60 shadow-sm p-5">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-sm font-bold text-zinc-900"
      >
        <PlusCircle size={16} className="text-ink" />
        {open ? t('t10work.manualHide') : t('t10work.manualAdd')}
      </button>

      {open && (
        <form onSubmit={submit} className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {isAdmin && (
            <Field label={t('t10work.manualMember')}>
              <select name="userId" required className={inputClass} defaultValue={selfId}>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name || m.email}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label={t('t10work.manualStart')}>
            <input name="clockIn" type="datetime-local" required className={inputClass} />
          </Field>
          <Field label={t('t10work.manualEnd')}>
            <input name="clockOut" type="datetime-local" required className={inputClass} />
          </Field>
          <Field label={t('t10work.manualJob')}>
            <select name="jobId" className={inputClass} defaultValue="">
              <option value="">{t('t10work.manualNoJob')}</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title}
                </option>
              ))}
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Field label={t('t10work.manualNotes')}>
              <input
                name="notes"
                type="text"
                maxLength={500}
                placeholder={t('t10work.manualNotesPh')}
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
          <div className="sm:col-span-2">
            <button type="submit" disabled={isPending} className={cn(primaryBtnClass)}>
              {isPending ? t('t10work.manualSaving') : t('t10work.manualSave')}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
