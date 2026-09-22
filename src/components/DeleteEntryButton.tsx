'use client';

import React, { useTransition } from 'react';
import { Trash2 } from 'lucide-react';
import { deleteEntry } from '@/app/actions/timesheets';

/** Delete a time entry with confirmation. Server re-validates ownership/role. */
export default function DeleteEntryButton({ entryId }: { entryId: string }) {
  const [isPending, startTransition] = useTransition();

  const run = () => {
    if (!confirm('Delete this time entry?')) return;
    startTransition(async () => {
      const res = await deleteEntry(entryId);
      if (res.error) alert(res.error);
    });
  };

  return (
    <button
      onClick={run}
      disabled={isPending}
      aria-label="Delete entry"
      className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-50"
    >
      <Trash2 size={14} />
    </button>
  );
}
