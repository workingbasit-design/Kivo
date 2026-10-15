'use client';

import React, { useActionState, useEffect, useRef, useState } from 'react';
import { AlertCircle, Wallet, Trash2, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { t, type Locale } from '@/lib/i18n';
import {
  recordPayment,
  sendInvoiceEmail,
  deleteInvoice,
  voidInvoice,
  voidPayment,
  type ActionResult,
} from '@/app/actions/invoices';
import { isValidVoidReason } from '@/lib/voiding';
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

const PROVIDERS = ['CASH', 'INTERAC', 'CHEQUE', 'STRIPE', 'OTHER'] as const;

/** Human labels for payment providers (record-only - EveryJob never processes payments). */
function providerLabel(p: string, locale: Locale): string {
  if (p === 'CASH') return t(locale, 't10money.invProviderCash');
  if (p === 'CHEQUE') return t(locale, 't10money.invProviderCheque');
  if (p === 'OTHER') return t(locale, 't10money.invProviderOther');
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
  // deleteInvoice redirects to the invoices list on success - toast on failure only.
  useResultToast(deleteState, {});

  const error = payState?.error || emailState?.error || deleteState?.error;

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
                type="text"
                inputMode="decimal"
                pattern="[0-9]*\.?[0-9]*"
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
        {/* NOTE: the old "Mark partially paid" button was removed 2026-09-28.
            It flipped the status to PARTIALLY PAID without recording any
            payment (Paid $0.00) - a dishonest state. Partial payments are
            recorded through "Record payment" above, which sets the status
            from the actual amounts. */}

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

        {/* Launch-pack item 7: DRAFT invoices are hard-deleted; every other
            live status (SENT / PARTIALLY_PAID / PAID) is voided with a
            reason. VOID invoices show neither. */}
        {status !== 'VOID' && (
          <div className="ml-auto">
            {status === 'DRAFT' ? (
              <>
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
                  error={deleteState?.error ?? null}
                  onConfirm={() => {
                    const fd = new FormData();
                    fd.append('id', id);
                    deleteAction(fd);
                  }}
                  onClose={() => !deletePending && setConfirmingDelete(false)}
                />
              </>
            ) : (
              <VoidInvoiceButton id={id} locale={locale} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Void an invoice with a reason (launch-pack item 7, morning QA 2026-10-15).
 * The voidInvoice server action existed with no UI, so SENT / PARTIALLY_PAID /
 * PAID invoices could never be voided. Drafts use the hard Delete above.
 */
function VoidInvoiceButton({ id, locale = 'en' }: { id: string; locale?: Locale }) {
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState('');
  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(
    voidInvoice,
    {}
  );

  useResultToast(state, {
    success: t(locale, 't10money.invVoided'),
  });

  const reasonOk = isValidVoidReason(reason);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setReason('');
          setConfirming(true);
        }}
        className="min-h-[44px] text-xs font-semibold text-rose-600 hover:text-rose-700 inline-flex items-center gap-1.5"
      >
        <Trash2 size={13} /> {t(locale, 't10money.invVoid')}
      </button>
      <ConfirmDialog
        open={confirming}
        locale={locale}
        title={t(locale, 't10money.invVoidTitle')}
        message={t(locale, 't10money.invVoidMsg')}
        busy={isPending}
        error={state?.error ?? null}
        confirmLabel={t(locale, 't10money.invVoid')}
        onConfirm={() => {
          if (!reasonOk) return;
          const fd = new FormData();
          fd.append('id', id);
          fd.append('reason', reason.trim());
          formAction(fd);
        }}
        onClose={() => !isPending && setConfirming(false)}
      >
        <div className="mt-4">
          <label
            htmlFor="void-reason"
            className="block text-xs font-bold text-zinc-700 mb-1.5"
          >
            {t(locale, 't10money.invVoidReason')}
          </label>
          <textarea
            id="void-reason"
            rows={3}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t(locale, 't10money.invVoidReasonPh')}
            className={inputClass}
          />
          {!reasonOk && reason.length > 0 && (
            <p className="mt-1.5 text-[11px] text-amber-700">
              {t(locale, 't10money.invVoidReasonShort')}
            </p>
          )}
        </div>
      </ConfirmDialog>
    </>
  );
}

/**
 * Void a single payment with a reason (morning QA 2026-10-15). Rendered in
 * the invoice detail payments list by page.tsx.
 */
export function VoidPaymentButton({
  paymentId,
  locale = 'en',
}: {
  paymentId: string;
  locale?: Locale;
}) {
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState('');
  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(
    voidPayment,
    {}
  );

  useResultToast(state, {
    success: t(locale, 't10money.invPaymentVoided'),
  });

  const reasonOk = isValidVoidReason(reason);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setReason('');
          setConfirming(true);
        }}
        className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 underline underline-offset-2"
      >
        {t(locale, 't10money.invVoidPayment')}
      </button>
      <ConfirmDialog
        open={confirming}
        locale={locale}
        title={t(locale, 't10money.invVoidPaymentTitle')}
        message={t(locale, 't10money.invVoidPaymentMsg')}
        busy={isPending}
        error={state?.error ?? null}
        confirmLabel={t(locale, 't10money.invVoidPayment')}
        onConfirm={() => {
          if (!reasonOk) return;
          const fd = new FormData();
          fd.append('id', paymentId);
          fd.append('reason', reason.trim());
          formAction(fd);
        }}
        onClose={() => !isPending && setConfirming(false)}
      >
        <div className="mt-4">
          <label
            htmlFor="void-payment-reason"
            className="block text-xs font-bold text-zinc-700 mb-1.5"
          >
            {t(locale, 't10money.invVoidReason')}
          </label>
          <textarea
            id="void-payment-reason"
            rows={3}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t(locale, 't10money.invVoidReasonPh')}
            className={inputClass}
          />
          {!reasonOk && reason.length > 0 && (
            <p className="mt-1.5 text-[11px] text-amber-700">
              {t(locale, 't10money.invVoidReasonShort')}
            </p>
          )}
        </div>
      </ConfirmDialog>
    </>
  );
}
