'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Ban, RotateCcw, Trash2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { updateJobStatus, deleteJob } from '@/app/actions/jobs';
import {
  primaryBtnClass, secondaryBtnClass, dangerBtnClass, Dialog,
} from '@/components/ui';
import { t, type Locale } from '@/lib/i18n';
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
  locale,
}: {
  jobId: string;
  status: string;
  locale: Locale;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const T = (k: string) => t(locale, `t10work.${k}`);
  const common = (k: string) => t(locale, `common.${k}`);
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
          router.push('/jobs');
          router.refresh();
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
  const nextLabel: Record<string, string> = {
    SCHEDULED: T('statusNextSchedule'),
    'IN PROGRESS': T('statusNextStart'),
    COMPLETED: T('statusNextComplete'),
    PAID: T('statusNextPaid'),
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">
        {nextStatus && (
          <button
            onClick={() => runStatus(nextStatus)}
            disabled={isPending}
            className={cn(primaryBtnClass, 'w-full sm:w-auto')}
          >
            <ArrowRight size={14} />
            {isPending ? T('statusUpdating') : (nextLabel[nextStatus] ?? `Mark ${nextStatus}`)}
          </button>
        )}

        {status === 'CANCELLED' ? (
          <button
            onClick={() => runStatus('SCHEDULED')}
            disabled={isPending}
            className={cn(secondaryBtnClass, 'w-full sm:w-auto')}
          >
            <RotateCcw size={14} />
            {T('statusReopen')}
          </button>
        ) : (
          status !== 'PAID' && (
            <button
              onClick={() => setPendingAction('cancel')}
              disabled={isPending}
              className={cn(
                secondaryBtnClass,
                'w-full sm:w-auto text-rose-600 border-rose-200 hover:bg-rose-50'
              )}
            >
              <Ban size={14} />
              {jobsL('cancelJob')}
            </button>
          )
        )}

        <button
          onClick={() => setPendingAction('delete')}
          disabled={isPending}
          className={cn(secondaryBtnClass, 'w-full sm:w-auto text-rose-600 border-rose-200 hover:bg-rose-50 sm:ml-auto')}
        >
          <Trash2 size={14} />
          {T('statusDelete')}
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl px-3 py-2.5">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* In-app confirmation dialog (foundation: bottom sheet on mobile, Esc closes) */}
      <Dialog
        open={pendingAction !== null}
        onClose={() => !isPending && setPendingAction(null)}
        title={pendingAction === 'cancel' ? jobsL('confirmCancelTitle') : jobsL('confirmDeleteTitle')}
      >
        <p className="text-sm text-zinc-500 leading-relaxed">
          {pendingAction === 'cancel' ? jobsL('confirmCancelBody') : T('statusDeleteBody')}
        </p>
        <div className="mt-6 flex gap-2">
          <button
            onClick={() => setPendingAction(null)}
            disabled={isPending}
            className={cn(secondaryBtnClass, 'flex-1')}
          >
            {T('statusKeepJob')}
          </button>
          <button
            onClick={confirmPending}
            disabled={isPending}
            className={cn(dangerBtnClass, 'flex-1')}
          >
            {isPending
              ? T('statusWorking')
              : pendingAction === 'cancel'
                ? jobsL('yesCancel')
                : jobsL('yesDelete')}
          </button>
        </div>
      </Dialog>
    </div>
  );
}
