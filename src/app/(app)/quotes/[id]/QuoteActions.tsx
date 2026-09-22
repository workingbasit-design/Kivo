'use client';

import React, { useActionState, useState } from 'react';
import { Send, CheckCircle2, XCircle, Undo2, Trash2, Briefcase, AlertCircle } from 'lucide-react';
import {
  updateQuoteStatus,
  convertQuoteToJob,
  deleteQuote,
  type ActionResult,
} from '@/app/actions/quotes';
import { primaryBtnClass, secondaryBtnClass } from '@/components/ui';
import { cn } from '@/lib/utils';

const TRANSITIONS: Record<string, { label: string; status: string; icon: React.ReactNode; primary?: boolean }[]> = {
  DRAFT: [{ label: 'Mark sent', status: 'SENT', icon: <Send size={14} />, primary: true }],
  SENT: [
    { label: 'Approve', status: 'APPROVED', icon: <CheckCircle2 size={14} />, primary: true },
    { label: 'Decline', status: 'DECLINED', icon: <XCircle size={14} /> },
    { label: 'Back to draft', status: 'DRAFT', icon: <Undo2 size={14} /> },
  ],
  DECLINED: [{ label: 'Reopen as draft', status: 'DRAFT', icon: <Undo2 size={14} /> }],
  APPROVED: [],
};

export default function QuoteActions({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
  const [statusState, statusAction, statusPending] = useActionState<ActionResult, FormData>(
    updateQuoteStatus,
    {}
  );
  const [convertState, convertAction, convertPending] = useActionState<ActionResult, FormData>(
    convertQuoteToJob,
    {}
  );
  const [deleteState, deleteAction, deletePending] = useActionState<ActionResult, FormData>(
    deleteQuote,
    {}
  );
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const transitions = TRANSITIONS[status] ?? [];
  const error = statusState?.error || convertState?.error || deleteState?.error;

  return (
    <div className="space-y-3">
      {error && (
        <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl px-3 py-2.5">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {transitions.map((t) => (
          <form key={t.status} action={statusAction}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="status" value={t.status} />
            <button
              type="submit"
              disabled={statusPending}
              className={cn(t.primary ? primaryBtnClass : secondaryBtnClass)}
            >
              {t.icon} {statusPending ? 'Saving…' : t.label}
            </button>
          </form>
        ))}

        {status === 'APPROVED' && (
          <form action={convertAction}>
            <input type="hidden" name="id" value={id} />
            <button type="submit" disabled={convertPending} className={primaryBtnClass}>
              <Briefcase size={14} />
              {convertPending ? 'Converting…' : 'Convert to job'}
            </button>
          </form>
        )}
      </div>

      {status !== 'APPROVED' && (
        <div>
          {!confirmingDelete ? (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="text-xs font-semibold text-rose-600 hover:text-rose-700 inline-flex items-center gap-1.5"
            >
              <Trash2 size={13} /> Delete quote
            </button>
          ) : (
            <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2.5">
              <span className="text-xs text-rose-700 font-medium">Delete this quote?</span>
              <form action={deleteAction}>
                <input type="hidden" name="id" value={id} />
                <button
                  type="submit"
                  disabled={deletePending}
                  className="text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-60 px-3 py-1.5 rounded-lg transition-colors"
                >
                  {deletePending ? 'Deleting…' : 'Yes, delete'}
                </button>
              </form>
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                className="text-xs font-semibold text-zinc-600 hover:text-zinc-800 px-2 py-1.5"
              >
                Keep
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
