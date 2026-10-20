'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, ArrowLeft, Ban, RotateCcw, Trash2, AlertCircle } from '@/components/icons';
import { toast } from 'sonner';
import { updateJobStatus, deleteJob } from '@/app/actions/jobs';
import { BottomSheet, Button } from '@/components/kit';
import { StatusPill } from '@/app/(app)/_components/status-ui';
import { t, type Locale } from '@/lib/i18n';
import { jobDisplayStatus } from '@/lib/utils';
import { previousPipelineStatus } from '@/lib/job-status';

const PIPELINE = ['NEW', 'SCHEDULED', 'IN PROGRESS', 'COMPLETED', 'PAID'] as const;

type PendingAction = 'cancel' | 'delete' | null;

/**
 * Client-side status section for the job detail page: the status badge AND
 * the status buttons live together here and share one piece of state.
 *
 * Why: the badge used to be server-rendered while the buttons were client
 * components calling router.refresh(). On flaky mobile connections the
 * refresh could return stale data, so the toast said "Job marked COMPLETED"
 * while the badge still showed the old status. Now the badge updates
 * instantly from local state on success - no waiting on a server re-render.
 *
 * Also offers a one-step "back" undo (COMPLETED -> IN PROGRESS, etc.) so a
 * mistaken tap can be reversed. The server still enforces the transition
 * rules; the UI only offers what the server accepts.
 */
export default function JobStatusButtons({
  jobId,
  status: initialStatus,
  jobDate,
  createdLabel,
  locale,
}: {
  jobId: string;
  status: string;
  /** ISO date string (YYYY-MM-DD) for the overdue computation. */
  jobDate: string | null;
  createdLabel: string;
  locale: Locale;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const T = (k: string) => t(locale, `t10work.${k}`);
  const jobsL = (k: string) => t(locale, `jobs.${k}`);

  const runStatus = (next: string) => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await updateJobStatus(jobId, next);
        if (res?.error) {
          setError(res.error);
          toast.error(T('statusErrorUpdate'));
        } else {
          // Update the badge + buttons immediately; the server revalidation
          // keeps lists (jobs, schedule, dashboard) consistent in the bg.
          setStatus(next);
          toast.success(T('statusChanged').replace('{status}', next));
          router.refresh();
        }
      } catch {
        setError(T('statusErrorUpdate'));
        toast.error(T('statusErrorUpdate'));
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
          toast.error(T('statusErrorDelete'));
        } else {
          toast.success(T('statusDeleted'));
          // Use hard navigation to avoid stale cache after delete
          window.location.href = '/jobs';
        }
      } catch {
        setError(T('statusErrorDelete'));
        toast.error(T('statusErrorDelete'));
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
  const prevStatus = previousPipelineStatus(status);
  const nextLabel: Record<string, string> = {
    SCHEDULED: T('statusNextSchedule'),
    'IN PROGRESS': T('statusNextStart'),
    COMPLETED: T('statusNextComplete'),
    PAID: T('statusNextPaid'),
  };

  return (
    <div className="space-y-4">
      {/* Badge - updates instantly with the buttons below. */}
      <div className="flex items-center gap-3 flex-wrap">
        <StatusPill status={jobDisplayStatus(status, jobDate)} locale={locale} />
        <span className="text-xs text-ink-2">{createdLabel}</span>
      </div>

      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">
        {nextStatus && (
          <Button
            variant="primary"
            onClick={() => runStatus(nextStatus)}
            disabled={isPending}
            className="w-full sm:w-auto disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <ArrowRight size={14} />
            {isPending ? T('statusUpdating') : (nextLabel[nextStatus] ?? `Mark ${nextStatus}`)}
          </Button>
        )}

        {/* Undo: step back one pipeline stage after a mistaken tap. */}
        {prevStatus && status !== 'CANCELLED' && (
          <Button
            variant="secondary"
            onClick={() => runStatus(prevStatus)}
            disabled={isPending}
            className="w-full sm:w-auto disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <ArrowLeft size={14} />
            {T('statusBack').replace('{status}', prevStatus)}
          </Button>
        )}

        {status === 'CANCELLED' ? (
          <Button
            variant="secondary"
            onClick={() => runStatus('SCHEDULED')}
            disabled={isPending}
            className="w-full sm:w-auto disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <RotateCcw size={14} />
            {T('statusReopen')}
          </Button>
        ) : (
          status !== 'PAID' && (
            <Button
              variant="secondary"
              onClick={() => setPendingAction('cancel')}
              disabled={isPending}
              className="w-full sm:w-auto text-danger hover:bg-danger-bg disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Ban size={14} />
              {jobsL('cancelJob')}
            </Button>
          )
        )}

        <Button
          variant="secondary"
          onClick={() => setPendingAction('delete')}
          disabled={isPending}
          className="w-full sm:w-auto text-danger hover:bg-danger-bg sm:ml-auto disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Trash2 size={14} />
          {T('statusDelete')}
        </Button>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-danger-bg border border-danger/25 text-danger text-xs font-medium rounded-xl px-3 py-2.5">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* In-app confirmation dialog (foundation: bottom sheet on mobile, Esc closes) */}
      <BottomSheet
        open={pendingAction !== null}
        onClose={() => !isPending && setPendingAction(null)}
        title={pendingAction === 'cancel' ? jobsL('confirmCancelTitle') : jobsL('confirmDeleteTitle')}
        footer={
          <div className="mt-4 flex gap-2">
            <Button
              variant="secondary"
              onClick={() => setPendingAction(null)}
              disabled={isPending}
              className="flex-1 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {T('statusKeepJob')}
            </Button>
            <Button
              variant="danger"
              onClick={confirmPending}
              disabled={isPending}
              className="flex-1 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isPending
                ? T('statusWorking')
                : pendingAction === 'cancel'
                  ? jobsL('yesCancel')
                  : jobsL('yesDelete')}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-ink-2 leading-relaxed">
          {pendingAction === 'cancel' ? jobsL('confirmCancelBody') : T('statusDeleteBody')}
        </p>
      </BottomSheet>
    </div>
  );
}
