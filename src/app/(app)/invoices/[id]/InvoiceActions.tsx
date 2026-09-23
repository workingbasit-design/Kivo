'use client';

import React, { useActionState, useState } from 'react';
import { AlertCircle, Wallet, Trash2 } from 'lucide-react';
import {
  recordPayment,
  updateInvoiceStatus,
  deleteInvoice,
  type ActionResult,
} from '@/app/actions/invoices';
import { Field, inputClass, primaryBtnClass, secondaryBtnClass } from '@/components/ui';
import { currencySymbol, formatMoney } from '@/lib/money';

const PROVIDERS = ['CASH', 'INTERAC', 'CHEQUE', 'STRIPE', 'RAZORPAY'] as const;

/** Human labels for payment providers (record-only — EveryJob never processes payments). */
const PROVIDER_LABELS: Record<string, string> = {
  CASH: 'Cash',
  INTERAC: 'Interac e-Transfer',
  CHEQUE: 'Cheque',
  STRIPE: 'Stripe',
  RAZORPAY: 'Razorpay',
};

export default function InvoiceActions({
  id,
  status,
  remaining,
  currency,
}: {
  id: string;
  status: string;
  remaining: number;
  currency: string;
}) {
  const [payState, payAction, payPending] = useActionState<ActionResult, FormData>(
    recordPayment,
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

  const error = payState?.error || statusState?.error || deleteState?.error;

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl px-3 py-2.5">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {payState?.ok && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium rounded-xl px-3 py-2.5">
          Payment recorded.
        </div>
      )}

      {remaining > 0 && (
        <form action={payAction} className="bg-zinc-50 border border-zinc-200/70 rounded-2xl p-4 space-y-3">
          <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
            <Wallet size={14} /> Record payment
            <span className="text-xs font-semibold text-amber-700">
              ({formatMoney(remaining, currency)} due)
            </span>
          </h3>
          <input type="hidden" name="invoiceId" value={id} />
          <div className="grid sm:grid-cols-3 gap-3">
            <Field label={`Amount ${currencySymbol(currency)}`}>
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
            <Field label="Mode">
              <select name="provider" className={inputClass} defaultValue="CASH">
                {PROVIDERS.map((p) => (
                  <option key={p} value={p}>
                    {PROVIDER_LABELS[p] ?? p}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Txn ref (optional)">
              <input
                name="transactionId"
                maxLength={200}
                placeholder="e.g. Interac confirmation no."
                className={inputClass}
              />
            </Field>
          </div>
          <button type="submit" disabled={payPending} className={primaryBtnClass}>
            {payPending ? 'Recording…' : 'Record payment'}
          </button>
          <p className="text-[11px] text-zinc-400">
            EveryJob only records payments you received — it never moves money itself.
          </p>
        </form>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {status === 'UNPAID' && (
          <form action={statusAction}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="status" value="PARTIALLY PAID" />
            <button type="submit" disabled={statusPending} className={secondaryBtnClass}>
              {statusPending ? 'Saving…' : 'Mark partially paid'}
            </button>
          </form>
        )}

        {status !== 'PAID' && (
          <div className="ml-auto">
            {!confirmingDelete ? (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="text-xs font-semibold text-rose-600 hover:text-rose-700 inline-flex items-center gap-1.5"
              >
                <Trash2 size={13} /> Delete invoice
              </button>
            ) : (
              <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2.5">
                <span className="text-xs text-rose-700 font-medium">Delete this invoice?</span>
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
    </div>
  );
}
