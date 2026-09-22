'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Ban, RotateCcw, Trash2, AlertCircle, X } from 'lucide-react';
import { updateJobStatus, deleteJob } from '@/app/actions/jobs';
import { secondaryBtnClass, primaryBtnClass } from '@/components/ui';
import { cn } from '@/lib/utils';

const PIPELINE = ['NEW', 'SCHEDULED', 'IN PROGRESS', 'COMPLETED', 'PAID'] as const;

type PendingAction = 'cancel' | 'delete' | null;

/**
 * Client-side status controls for the job detail page. Server re-validates.
 *
 * Uses in-app confirmation modals (never the native `confirm()` dialog, which
 * is auto-dismissed — i.e. silently cancelled — in automated browsers and
 * some mobile webviews, making the buttons appear to do nothing).
 */
export default function JobStatusButtons({
  jobId,
  status,
}: {
  jobId: string;
  status: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const runStatus = (next: string) => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await updateJobStatus(jobId, next);
        if (res?.error) {
          setError(res.error);
        } else {
          router.refresh();
        }
      } catch {
        setError('Could not update the job — please try again.');
      }
    });
  };

  const runDelete = () => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await deleteJob(jobId);
        if (res?.error) {
          setError(res.error);
        } else {
          router.push('/jobs');
          router.refresh();
        }
      } catch {
        setError('Could not delete the job — please try again.');
      }
    });
  };

  const confirmPending = () => {
    const action = pendingAction;
    setPendingAction(null);
    if (action === 'cancel') runStatus('CANCELLED');
    else if (action === 'delete') runDelete();
  };

  const idx = (PIPELINE as readonly string[]).indexOf(status);
  const nextStatus = idx >= 0 && idx < PIPELINE.length - 1 ? PIPELINE[idx + 1] : null;
  const nextLabel: Record<string, string> = {
    SCHEDULED: 'Schedule job',
    'IN PROGRESS': 'Start job',
    COMPLETED: 'Mark completed',
    PAID: 'Mark paid',
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {nextStatus && (
          <button
            onClick={() => runStatus(nextStatus)}
            disabled={isPending}
            className={primaryBtnClass}
          >
            <ArrowRight size={14} />
            {isPending ? 'Updating…' : nextLabel[nextStatus] ?? `Mark ${nextStatus}`}
          </button>
        )}

        {status === 'CANCELLED' ? (
          <button
            onClick={() => runStatus('SCHEDULED')}
            disabled={isPending}
            className={secondaryBtnClass}
          >
            <RotateCcw size={14} />
            Reopen job
          </button>
        ) : (
          status !== 'PAID' && (
            <button
              onClick={() => setPendingAction('cancel')}
              disabled={isPending}
              className={cn(
                secondaryBtnClass,
                'text-rose-600 border-rose-200 hover:bg-rose-50'
              )}
            >
              <Ban size={14} />
              Cancel job
            </button>
          )
        )}

        <button
          onClick={() => setPendingAction('delete')}
          disabled={isPending}
          className={cn(secondaryBtnClass, 'text-rose-600 border-rose-200 hover:bg-rose-50 ml-auto')}
        >
          <Trash2 size={14} />
          Delete
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl px-3 py-2.5">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* In-app confirmation dialog */}
      {pendingAction && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-950/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={pendingAction === 'cancel' ? 'Cancel job' : 'Delete job'}
          onClick={() => !isPending && setPendingAction(null)}
        >
          <div
            className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-zinc-200 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-sm font-bold text-zinc-900">
                {pendingAction === 'cancel' ? 'Cancel this job?' : 'Delete this job?'}
              </h3>
              <button
                onClick={() => setPendingAction(null)}
                disabled={isPending}
                className="text-zinc-400 hover:text-zinc-700 transition-colors"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            <p className="mt-2 text-xs text-zinc-500 leading-relaxed">
              {pendingAction === 'cancel'
                ? 'The job will be marked CANCELLED. You can reopen it later if needed.'
                : 'This will permanently remove the job, its notes and time entries. This cannot be undone.'}
            </p>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setPendingAction(null)}
                disabled={isPending}
                className="flex-1 bg-zinc-100 hover:bg-zinc-200 disabled:opacity-50 text-zinc-700 text-xs font-semibold py-2.5 rounded-xl transition-colors"
              >
                Keep job
              </button>
              <button
                onClick={confirmPending}
                disabled={isPending}
                className="flex-1 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-semibold py-2.5 rounded-xl transition-colors"
              >
                {isPending
                  ? 'Working…'
                  : pendingAction === 'cancel'
                    ? 'Yes, cancel job'
                    : 'Yes, delete job'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
