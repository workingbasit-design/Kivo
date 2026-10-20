'use client';

import React, { useState, useTransition } from 'react';
import { PlusCircle, AlertCircle } from '@/components/icons';
import { createManualEntry } from '@/app/actions/timesheets';
import { Button, Input, Select } from '@/components/kit';
import { useResolvedT } from '@/hooks/useResolvedLocale';

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
    <div className="bg-surface border border-line shadow-kit-card rounded-[20px] p-5">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-sm font-bold text-ink"
      >
        <PlusCircle size={16} className="text-ink" />
        {open ? t('t10work.manualHide') : t('t10work.manualAdd')}
      </button>

      {open && (
        <form onSubmit={submit} className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {isAdmin && (
            <Select
              label={t('t10work.manualMember')}
              name="userId"
              required
              defaultValue={selfId}
              options={members.map((m) => ({ value: m.id, label: m.name || m.email }))}
            />
          )}
          <Input
            label={t('t10work.manualStart')}
            name="clockIn"
            type="datetime-local"
            required
          />
          <Input
            label={t('t10work.manualEnd')}
            name="clockOut"
            type="datetime-local"
            required
          />
          <Select
            label={t('t10work.manualJob')}
            name="jobId"
            defaultValue=""
            options={[
              { value: '', label: t('t10work.manualNoJob') },
              ...jobs.map((j) => ({ value: j.id, label: j.title })),
            ]}
          />
          <div className="sm:col-span-2">
            <Input
              label={t('t10work.manualNotes')}
              name="notes"
              type="text"
              maxLength={500}
              placeholder={t('t10work.manualNotesPh')}
            />
          </div>
          {error && (
            <div className="sm:col-span-2 flex items-start gap-2 bg-danger-bg border border-danger/25 text-danger text-xs font-medium rounded-xl px-3 py-2.5">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <div className="sm:col-span-2">
            <Button variant="primary" type="submit" disabled={isPending} className="disabled:opacity-60 disabled:cursor-not-allowed">
              {isPending ? t('t10work.manualSaving') : t('t10work.manualSave')}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
