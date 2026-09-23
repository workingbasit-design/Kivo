'use client';

import React, { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import { AlertCircle, Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { addJobNote, deleteJobNote, type JobActionResult } from '@/app/actions/jobs';
import { primaryBtnClass, textareaClass } from '@/components/ui';
import ConfirmDialog from '@/components/ConfirmDialog';
import { t, type Locale } from '@/lib/i18n';

/** Add-a-note form for the job detail page. Resets after a successful save. */
export function JobNoteForm({ jobId, locale }: { jobId: string; locale: Locale }) {
  const [state, formAction, isPending] = useActionState<JobActionResult, FormData>(
    addJobNote,
    {}
  );
  const formRef = useRef<HTMLFormElement>(null);
  const T = (k: string) => t(locale, `t10work.${k}`);
  const toastedFor = useRef<JobActionResult | null>(null);

  useEffect(() => {
    if (state?.ok && toastedFor.current !== state) {
      toastedFor.current = state;
      formRef.current?.reset();
      toast.success(t(locale, 't10work.noteAdded'));
    }
  }, [state, locale]);

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <input type="hidden" name="jobId" value={jobId} />
      <label htmlFor="job-note-content" className="sr-only">
        {T('noteAdd')}
      </label>
      <textarea
        id="job-note-content"
        name="content"
        required
        rows={2}
        maxLength={2000}
        placeholder={T('notePlaceholder')}
        className={textareaClass}
      />
      {state?.error && (
        <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl px-3 py-2.5">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{state.error}</span>
        </div>
      )}
      <button type="submit" disabled={isPending} className={primaryBtnClass}>
        <Send size={14} />
        {isPending ? T('noteAdding') : T('noteAdd')}
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
  locale,
}: {
  jobId: string;
  noteId: string;
  content: string;
  authorName: string;
  createdAt: string;
  locale: Locale;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const T = (k: string) => t(locale, `t10work.${k}`);

  const runDelete = () => {
    setConfirming(false);
    setError(null);
    startTransition(async () => {
      try {
        const res = await deleteJobNote(jobId, noteId);
        if (res?.error) {
          setError(res.error);
          toast.error(T('noteErrorDelete'));
        } else {
          toast.success(T('noteDeleted'));
        }
      } catch {
        setError(T('noteErrorDelete'));
        toast.error(T('noteErrorDelete'));
      }
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
        className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-zinc-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors shrink-0 disabled:opacity-60"
        title={T('noteDelete')}
        aria-label={T('noteDelete')}
      >
        <Trash2 size={15} />
      </button>
      <ConfirmDialog
        open={confirming}
        title={T('noteDeleteTitle')}
        message={T('noteDeleteBody')}
        busy={isPending}
        onConfirm={runDelete}
        onClose={() => setConfirming(false)}
      />
    </div>
  );
}
