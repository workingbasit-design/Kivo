'use client';

import React, { useActionState, useEffect, useRef, useState } from 'react';
import { AlertCircle, Wallet, Trash2, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { t, type Locale } from '@/lib/i18n';
import {
  recordPayment,
  sendInvoiceEmail,
  updateInvoiceStatus,
  deleteInvoice,
  type ActionResult,
} from '@/app/actions/invoices';
import { Field, inputClass, primaryBtnClass, secondaryBtnClass } from '@/components/ui';
import ConfirmDialog from '@/components/ConfirmDialog';
import { currencySymbol, formatMoney } from '@/lib/money';

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

const PROVIDERS = ['CASH', 'INTERAC', 'CHEQUE', 'STRIPE'] as const;

/** Human labels for payment providers (record-only — EveryJob never processes payments). */
function providerLabel(p: string, locale: Locale): string {
  if (p === 'CASH') return t(locale, 't10money.invProviderCash');
  if (p === 'CHEQUE') return t(locale, 't10money.invProviderCheque');
  return p === 'INTERAC' ? 'Interac e-Transfer' : 'Stripe';
}

export default function InvoiceActions({
  id,
  status,
  remaining,
  currency,
  locale = 'en',
}: {
  id: string;
  status: string;
  remaining: number;
  currency: string;
  locale?: Locale;
}) {
  const [payState, payAction, payPending] = useActionState<ActionResult, FormData>(
    recordPayment,
    {}
  );
  const [emailState, emailAction, emailPending] = useActionState<ActionResult, FormData>(
    sendInvoiceEmail,
    {}
  );
  const [statusState, statusAction, statusPending] = useActionState<ActionResult, FormData>(
    updateInvoiceStatus,
    {}
  );
  const [deleteState, deleteAction, deletePending] = useActionState<ActionResult, FormData>(
    deleteInvoice,
    {}
  );
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useResultToast(payState, {
    success: t(locale, 't10money.paymentRecorded'),
  });
  // sendInvoiceEmail toasts honestly on both success and failure (the
  // failure message tells the pro exactly what to do: add a customer
  // email, or that RESEND_API_KEY is missing).
  useResultToast(emailState, {
    success: t(locale, 't10money.invoiceEmailSent'),
  });
  useResultToast(statusState, {
    success: t(locale, 't10money.invoiceUpdated'),
  });
  // deleteInvoice redirects to the invoices list on success — toast on failure only.
  useResultToast(deleteState, {});

  const error = payState?.error || emailState?.error || statusState?.error || deleteState?.error;

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl px-3 py-2.5">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {remaining > 0 && (
        <form action={payAction} className="bg-zinc-50 border border-zinc-200/70 rounded-2xl p-4 space-y-3">
          <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
            <Wallet size={14} /> {t(locale, 't10money.invRecordPayment')}
            <span className="text-xs font-semibold text-amber-700">
              ({formatMoney(remaining, currency)} {t(locale, 't10money.invDue')})
            </span>
          </h3>
          <input type="hidden" name="invoiceId" value={id} />
          <div className="grid sm:grid-cols-3 gap-3">
            <Field label={`${t(locale, 't10money.invAmount')} ${currencySymbol(currency)}`}>
              <input
                name="amount"
                type="number"
                min={0.01}
                max={remaining}
                step="0.01"
                required
                defaultValue={remaining}
                className={inputClass}
              />
            </Field>
            <Field label={t(locale, 't10money.invMode')}>
              <select name="provider" className={inputClass} defaultValue="CASH">
                {PROVIDERS.map((p) => (
                  <option key={p} value={p}>
                    {providerLabel(p, locale)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t(locale, 't10money.invTxnRef')}>
              <input
                name="transactionId"
                maxLength={200}
                placeholder={t(locale, 't10money.invTxnPlaceholder')}
                className={inputClass}
              />
            </Field>
          </div>
          <button type="submit" disabled={payPending} className={primaryBtnClass}>
            {payPending ? t(locale, 't10money.invRecording') : t(locale, 't10money.invRecordPayment')}
          </button>
          <p className="text-[11px] text-zinc-500 leading-relaxed">
            {t(locale, 't10money.recordFullMarksPaid')}.{' '}
            <span className="text-zinc-400">{t(locale, 't10money.invBookkeepingNote')}</span>
          </p>
        </form>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {status === 'UNPAID' && (
          <form action={statusAction}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="status" value="PARTIALLY PAID" />
            <button type="submit" disabled={statusPending} className={secondaryBtnClass}>
              {statusPending ? t(locale, 't10money.invSaving') : t(locale, 't10money.invMarkPartial')}
            </button>
          </form>
        )}

        <form action={emailAction}>
          <input type="hidden" name="id" value={id} />
          <button
            type="submit"
            disabled={emailPending}
            className={secondaryBtnClass}
            title={t(locale, 't10money.invoiceEmailHint')}
          >
            <Mail size={14} />
            {emailPending
              ? t(locale, 't10money.invSending')
              : t(locale, 't10money.invoiceEmailButton')}
          </button>
        </form>

        {status !== 'PAID' && (
          <div className="ml-auto">
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="min-h-[44px] text-xs font-semibold text-rose-600 hover:text-rose-700 inline-flex items-center gap-1.5"
            >
              <Trash2 size={13} /> {t(locale, 't10money.invDelete')}
            </button>
            <ConfirmDialog
              open={confirmingDelete}
              locale={locale}
              title={t(locale, 't10money.invDeleteTitle')}
              message={t(locale, 't10money.invDeleteMsg')}
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
    </div>
  );
}
