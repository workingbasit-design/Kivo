'use client';

import React, { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import { AlertCircle, Send, Trash2 } from 'lucide-react';
import { addJobNote, deleteJobNote, type JobActionResult } from '@/app/actions/jobs';
import { inputClass, primaryBtnClass } from '@/components/ui';
import ConfirmDialog from '@/components/ConfirmDialog';

/** Add-a-note form for the job detail page. Resets after a successful save. */
export function JobNoteForm({ jobId }: { jobId: string }) {
  const [state, formAction, isPending] = useActionState<JobActionResult, FormData>(
    addJobNote,
    {}
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <input type="hidden" name="jobId" value={jobId} />
      <textarea
        name="content"
        required
        rows={2}
        maxLength={2000}
        placeholder="Add a note — e.g. customer asked to come after 4pm…"
        className={inputClass}
      />
      {state?.error && (
        <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl px-3 py-2.5">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{state.error}</span>
        </div>
      )}
      <button type="submit" disabled={isPending} className={primaryBtnClass}>
        <Send size={14} />
        {isPending ? 'Adding…' : 'Add note'}
      </button>
    </form>
  );
}

/** Single note row with delete. */
export function JobNoteItem({
  jobId,
  noteId,
  content,
  authorName,
  createdAt,
}: {
  jobId: string;
  noteId: string;
  content: string;
  authorName: string;
  createdAt: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const runDelete = () => {
    setConfirming(false);
    setError(null);
    startTransition(async () => {
      const res = await deleteJobNote(jobId, noteId);
      if (res?.error) setError(res.error);
    });
  };

  return (
    <div className="flex items-start justify-between gap-3 py-3 border-b border-zinc-100 last:border-0">
      <div className="min-w-0">
        <p className="text-sm text-zinc-800 whitespace-pre-wrap">{content}</p>
        <p className="text-[11px] text-zinc-400 mt-1">
          {authorName} · {createdAt}
        </p>
        {error && <p className="text-[11px] text-rose-600 mt-1 font-medium">{error}</p>}
      </div>
      <button
        onClick={() => setConfirming(true)}
        disabled={isPending}
        className="p-1.5 text-zinc-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors shrink-0"
        title="Delete note"
        aria-label="Delete note"
      >
        <Trash2 size={14} />
      </button>
      <ConfirmDialog
        open={confirming}
        title="Delete this note?"
        message="The note will be permanently removed. This cannot be undone."
        busy={isPending}
        onConfirm={runDelete}
        onClose={() => setConfirming(false)}
      />
    </div>
  );
}
