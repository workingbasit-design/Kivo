'use client';

import React, { useActionState, useEffect, useRef, useState } from 'react';
import { Send, CheckCircle2, XCircle, Undo2, Trash2, Briefcase, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { t, type Locale } from '@/lib/i18n';
import {
  updateQuoteStatus,
  convertQuoteToJob,
  deleteQuote,
  type ActionResult,
} from '@/app/actions/quotes';
import { primaryBtnClass, secondaryBtnClass } from '@/components/ui';
import ConfirmDialog from '@/components/ConfirmDialog';
import { cn } from '@/lib/utils';

/**
 * Fires a toast exactly once per server-action result. Minimal inline
 * replacement for the removed useActionToast helper.
 */
function useResultToast<T extends { ok?: boolean; error?: string }>(
  state: T | undefined,
  messages: { success?: string; error?: string }
) {
  const seen = useRef<T | undefined>(undefined);
  useEffect(() => {
    if (!state || seen.current === state) return;
    seen.current = state;
    if (state.ok && messages.success) {
      toast.success(messages.success);
    } else if (state.error) {
      toast.error(messages.error ?? state.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
}

const TRANSITIONS: Record<string, { key: string; status: string; icon: React.ReactNode; primary?: boolean }[]> = {
  DRAFT: [{ key: 'quoteMarkSent', status: 'SENT', icon: <Send size={14} />, primary: true }],
  SENT: [
    { key: 'quoteApprove', status: 'APPROVED', icon: <CheckCircle2 size={14} />, primary: true },
    { key: 'quoteDecline', status: 'DECLINED', icon: <XCircle size={14} /> },
    { key: 'quoteBackToDraft', status: 'DRAFT', icon: <Undo2 size={14} /> },
  ],
  DECLINED: [{ key: 'quoteReopen', status: 'DRAFT', icon: <Undo2 size={14} /> }],
  APPROVED: [],
};

const STATUS_TOAST_KEY: Record<string, string> = {
  SENT: 't10money.quoteSent',
  APPROVED: 't10money.quoteApproved',
  DECLINED: 't10money.quoteDeclined',
  DRAFT: 't10money.quoteDraft',
};

function StatusForm({
  id,
  target,
  locale,
}: {
  id: string;
  target: { key: string; status: string; icon: React.ReactNode; primary?: boolean };
  locale: Locale;
}) {
  const [state, action, isPending] = useActionState<ActionResult, FormData>(
    updateQuoteStatus,
    {}
  );
  useResultToast(state, {
    success: t(locale, STATUS_TOAST_KEY[target.status] ?? 't10money.invoiceUpdated'),
  });
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={target.status} />
      <button
        type="submit"
        disabled={isPending}
        className={cn(target.primary ? primaryBtnClass : secondaryBtnClass)}
      >
        {target.icon} {isPending ? t(locale, 't10money.quoteSaving') : t(locale, `t10money.${target.key}`)}
      </button>
    </form>
  );
}

export default function QuoteActions({
  id,
  status,
  locale = 'en',
}: {
  id: string;
  status: string;
  locale?: Locale;
}) {
  const [convertState, convertAction, convertPending] = useActionState<ActionResult, FormData>(
    convertQuoteToJob,
    {}
  );
  const [deleteState, deleteAction, deletePending] = useActionState<ActionResult, FormData>(
    deleteQuote,
    {}
  );
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // convertQuoteToJob redirects to the new job page on success; deleteQuote
  // redirects back to the quotes list, so they only toast on failure.
  useResultToast(convertState, {});
  useResultToast(deleteState, {});

  const transitions = TRANSITIONS[status] ?? [];
  const error = convertState?.error || deleteState?.error;

  return (
    <div className="space-y-3">
      {error && (
        <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl px-3 py-2.5">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {transitions.map((tr) => (
          <StatusForm key={tr.status} id={id} target={tr} locale={locale} />
        ))}

        {status === 'APPROVED' && (
          <form action={convertAction}>
            <input type="hidden" name="id" value={id} />
            <button type="submit" disabled={convertPending} className={primaryBtnClass}>
              <Briefcase size={14} />
              {convertPending ? t(locale, 't10money.quoteConverting') : t(locale, 't10money.quoteConvert')}
            </button>
          </form>
        )}
      </div>

      {status !== 'APPROVED' && (
        <div>
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="min-h-[44px] text-xs font-semibold text-rose-600 hover:text-rose-700 inline-flex items-center gap-1.5"
          >
            <Trash2 size={13} /> {t(locale, 't10money.quoteDelete')}
          </button>
          <ConfirmDialog
            open={confirmingDelete}
            locale={locale}
            title={t(locale, 't10money.quoteDeleteTitle')}
            message={t(locale, 't10money.quoteDeleteMsg')}
            busy={deletePending}
            onConfirm={() => {
              const fd = new FormData();
              fd.append('id', id);
              deleteAction(fd);
            }}
            onClose={() => !deletePending && setConfirmingDelete(false)}
          />
        </div>
      )}
    </div>
  );
}
