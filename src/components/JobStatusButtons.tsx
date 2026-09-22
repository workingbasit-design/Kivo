'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Ban, RotateCcw, Trash2, AlertCircle } from 'lucide-react';
import { updateJobStatus, deleteJob } from '@/app/actions/jobs';
import { secondaryBtnClass, primaryBtnClass } from '@/components/ui';
import { cn } from '@/lib/utils';

const PIPELINE = ['NEW', 'SCHEDULED', 'IN PROGRESS', 'COMPLETED', 'PAID'] as const;

/** Client-side status controls for the job detail page. Server re-validates. */
export default function JobStatusButtons({
  jobId,
  status,
}: {
  jobId: string;
  status: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const runStatus = (next: string) => {
    setError(null);
    startTransition(async () => {
      const res = await updateJobStatus(jobId, next);
      if (res.error) setError(res.error);
    });
  };

  const runDelete = () => {
    if (!confirm('Delete this job? This cannot be undone.')) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteJob(jobId);
      if (res.error) {
        setError(res.error);
      } else {
        router.push('/jobs');
        router.refresh();
      }
    });
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
              onClick={() => {
                if (confirm('Cancel this job?')) runStatus('CANCELLED');
              }}
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
          onClick={runDelete}
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
    </div>
  );
}
