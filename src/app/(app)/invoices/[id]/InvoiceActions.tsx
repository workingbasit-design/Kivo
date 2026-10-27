'use client';

import React, { useActionState, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Wallet, Trash2, Mail } from '@/components/icons';
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
import ConfirmDialog from '@/components/ConfirmDialog';
import { clearLastOpenedRecord } from '@/lib/continue-candidate';
import { currencySymbol, formatMoney, centsToDollars } from '@/lib/money';
import { Input, Select, Textarea, Button } from '@/components/kit';

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
  payments = [],
}: {
  id: string;
  status: string;
  remaining: number;
  currency: string;
  locale?: Locale;
  /**
   * Payments for the void-payment controls (morning QA 2026-10-15). The
   * trigger buttons render in a .map() below, but the useActionState +
   * dialog live ONCE at this component's top level: a useActionState inside
   * the list 500'd with React #441 on production.
   */
  payments?: { id: string; status: string; amountCents: number | bigint }[];
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
  // Single void-payment action + dialog at this level (not in the .map()):
  // useActionState 500'd with React #441 for voidPayment on production, so
  // the action is called directly and state is managed with useState.
  const [confirmingVoidPayment, setConfirmingVoidPayment] = useState(false);
  const [voidPaymentId, setVoidPaymentId] = useState<string | null>(null);
  const [voidPaymentReason, setVoidPaymentReason] = useState('');
  const [voidPaymentPending, setVoidPaymentPending] = useState(false);
  const [voidPaymentError, setVoidPaymentError] = useState<string | null>(null);
  const router = useRouter();

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
        <div className="flex items-start gap-2 bg-danger-bg border border-line text-danger text-xs font-medium rounded-xl px-3 py-2.5">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {remaining > 0 && (
        <form action={payAction} className="bg-surface-2 border border-line/70 rounded-2xl p-4 space-y-3">
          <h3 className="text-sm font-bold text-ink flex items-center gap-2">
            <Wallet size={14} /> {t(locale, 't10money.invRecordPayment')}
            <span className="text-xs font-semibold text-warn-text">
              ({formatMoney(remaining, currency)} {t(locale, 't10money.invDue')})
            </span>
          </h3>
          <input type="hidden" name="invoiceId" value={id} />
          <div className="grid sm:grid-cols-3 gap-3">
            <Input
              label={`${t(locale, 't10money.invAmount')} ${currencySymbol(currency)}`}
              name="amount"
              type="text"
              inputMode="decimal"
              pattern="[0-9]*\.?[0-9]*"
              required
              defaultValue={remaining}
            />
            <Select
              label={t(locale, 't10money.invMode')}
              name="provider"
              defaultValue="CASH"
              options={PROVIDERS.map((p) => ({ value: p, label: providerLabel(p, locale) }))}
            />
            <Input
              label={t(locale, 't10money.invTxnRef')}
              name="transactionId"
              maxLength={200}
              placeholder={t(locale, 't10money.invTxnPlaceholder')}
            />
          </div>
          <Button type="submit" disabled={payPending} variant="primary">
            {payPending ? t(locale, 't10money.invRecording') : t(locale, 't10money.invRecordPayment')}
          </Button>
          <p className="text-[11px] text-ink-2 leading-relaxed">
            {t(locale, 't10money.recordFullMarksPaid')}.{' '}
            <span className="text-ink-2">{t(locale, 't10money.invBookkeepingNote')}</span>
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
          <Button
            type="submit"
            disabled={emailPending}
            variant="secondary"
            title={t(locale, 't10money.invoiceEmailHint')}
          >
            <Mail size={14} />
            {emailPending
              ? t(locale, 't10money.invSending')
              : t(locale, 't10money.invoiceEmailButton')}
          </Button>
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
                  className="min-h-[44px] text-xs font-semibold text-danger hover:text-danger inline-flex items-center gap-1.5"
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
                    // Never leave the Continue card pointing at this deleted invoice.
                    clearLastOpenedRecord(id);
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

      {/* Voidable payments. The void dialog + useActionState live ONCE at this
          level (not in the .map() below): a useActionState button inside a
          list 500'd with React #441 on production. */}
      {payments.some((p) => p.status !== 'VOID') && (
        <div className="border-t border-line pt-3">
          <p className="text-[11px] font-bold text-ink-2 mb-2">
            {t(locale, 't10money.invVoidPaymentSection')}
          </p>
          <ul className="space-y-2">
            {payments
              .filter((p) => p.status !== 'VOID')
              .map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="font-semibold tabular-nums text-ink">
                    {formatMoney(centsToDollars(p.amountCents), currency)}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setVoidPaymentId(p.id);
                      setVoidPaymentReason('');
                      setVoidPaymentError(null);
                      setConfirmingVoidPayment(true);
                    }}
                    className="text-[11px] font-semibold text-danger hover:text-danger underline underline-offset-2"
                  >
                    {t(locale, 't10money.invVoidPayment')}
                  </button>
                </li>
              ))}
          </ul>
        </div>
      )}
      <ConfirmDialog
        open={confirmingVoidPayment}
        locale={locale}
        title={t(locale, 't10money.invVoidPaymentTitle')}
        message={t(locale, 't10money.invVoidPaymentMsg')}
        busy={voidPaymentPending}
        error={voidPaymentError}
        confirmLabel={t(locale, 't10money.invVoidPayment')}
        onConfirm={async () => {
          if (!isValidVoidReason(voidPaymentReason) || !voidPaymentId) return;
          setVoidPaymentPending(true);
          setVoidPaymentError(null);
          try {
            const fd = new FormData();
            fd.append('id', voidPaymentId);
            fd.append('reason', voidPaymentReason.trim());
            // Direct call (not useActionState): useActionState 500'd with
            // React #441 for this action on production.
            const result = await voidPayment({} as ActionResult, fd);
            if (result?.error) {
              setVoidPaymentError(result.error);
            } else {
              setConfirmingVoidPayment(false);
              toast.success(t(locale, 't10money.invPaymentVoided'));
              router.refresh();
            }
          } finally {
            setVoidPaymentPending(false);
          }
        }}
        onClose={() => !voidPaymentPending && setConfirmingVoidPayment(false)}
      >
        <div className="mt-4">
          <Textarea
            label={t(locale, 't10money.invVoidReason')}
            name="reason"
            rows={3}
            maxLength={500}
            value={voidPaymentReason}
            onChange={(e) => setVoidPaymentReason(e.target.value)}
            placeholder={t(locale, 't10money.invVoidReasonPh')}
          />
          {!isValidVoidReason(voidPaymentReason) && voidPaymentReason.length > 0 && (
            <p className="mt-1.5 text-[11px] text-warn-text">
              {t(locale, 't10money.invVoidReasonShort')}
            </p>
          )}
        </div>
      </ConfirmDialog>
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
        className="min-h-[44px] text-xs font-semibold text-danger hover:text-danger inline-flex items-center gap-1.5"
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
            className="block text-xs font-bold text-ink mb-1.5"
          >
            {t(locale, 't10money.invVoidReason')}
          </label>
          <Textarea
            label={t(locale, 't10money.invVoidReason')}
            name="reason"
            rows={3}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t(locale, 't10money.invVoidReasonPh')}
          />
          {!reasonOk && reason.length > 0 && (
            <p className="mt-1.5 text-[11px] text-warn-text">
              {t(locale, 't10money.invVoidReasonShort')}
            </p>
          )}
        </div>
      </ConfirmDialog>
    </>
  );
}
