'use client';

import React, { useState, useTransition } from 'react';
import { Trash2 } from 'lucide-react';
import { deleteEntry } from '@/app/actions/timesheets';
import ConfirmDialog from '@/components/ConfirmDialog';

/** Delete a time entry with confirmation. Server re-validates ownership/role. */
export default function DeleteEntryButton({ entryId }: { entryId: string }) {
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = () => {
    setConfirming(false);
    startTransition(async () => {
      setError(null);
      const res = await deleteEntry(entryId);
      if (res.error) setError(res.error);
    });
  };

  return (
    <>
      <button
        onClick={() => setConfirming(true)}
        disabled={isPending}
        aria-label="Delete entry"
        title="Delete entry"
        className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-50"
      >
        <Trash2 size={14} />
      </button>
      {error && (
        <span className="text-[11px] text-rose-600 font-medium" role="alert">
          {error}
        </span>
      )}
      <ConfirmDialog
        open={confirming}
        title="Delete this time entry?"
        message="The time entry will be permanently removed. This cannot be undone."
        busy={isPending}
        onConfirm={run}
        onClose={() => setConfirming(false)}
      />
    </>
  );
}
