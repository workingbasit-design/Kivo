'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { Pause, Play, Pencil, Trash2 } from 'lucide-react';
import { toggleRecurringActive, deleteRecurring } from '@/app/actions/recurring';

/**
 * Pause/resume, edit and delete buttons for one recurring job plan.
 * Delete asks for confirmation first; generated jobs are kept.
 */
export default function RecurringRowActions({
  id,
  active,
}: {
  id: string;
  active: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<{ error?: string }>) => {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (res.error) setError(res.error);
    });
  };

  const confirmDelete = () => {
    if (
      window.confirm(
        'Delete this recurring plan? Jobs already created from it will be kept.'
      )
    ) {
      run(() => deleteRecurring(id));
    }
  };

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        disabled={isPending}
        onClick={() => run(() => toggleRecurringActive(id))}
        title={active ? 'Pause plan' : 'Resume plan'}
        className="p-2 rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 transition-colors disabled:opacity-50"
      >
        {active ? <Pause size={15} /> : <Play size={15} />}
      </button>
      <Link
        href={`/recurring/${id}/edit`}
        title="Edit plan"
        className="p-2 rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
      >
        <Pencil size={15} />
      </Link>
      <button
        type="button"
        disabled={isPending}
        onClick={confirmDelete}
        title="Delete plan"
        className="p-2 rounded-lg text-zinc-500 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50"
      >
        <Trash2 size={15} />
      </button>
      {error && <span className="text-[11px] text-red-600 font-medium ml-1">{error}</span>}
    </div>
  );
}
