'use client';

import React, { useActionState } from 'react';
import Link from 'next/link';
import { AlertCircle, FileCheck } from 'lucide-react';
import { createQuote, type ActionResult } from '@/app/actions/quotes';
import LineItemsEditor from '@/components/LineItemsEditor';
import { Field, inputClass, primaryBtnClass, secondaryBtnClass, Card } from '@/components/ui';
import { formatMoney } from '@/lib/money';
import { calcTax, type TaxConfig } from '@/lib/tax';

export default function QuoteForm({
  customers,
  taxConfig,
}: {
  customers: { id: string; name: string }[];
  taxConfig: TaxConfig;
}) {
  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(
    createQuote,
    {}
  );
  const [subtotal, setSubtotal] = React.useState(0);

  // Client-side preview — the server recomputes the same numbers.
  const { taxAmount, breakdown } = calcTax(subtotal, taxConfig);
  const total = Math.round((subtotal + taxAmount) * 100) / 100;

  return (
    <form action={formAction} className="space-y-6 max-w-2xl">
      <Card className="p-6 space-y-4">
        <Field label="Title">
          <input
            name="title"
            required
            maxLength={200}
            placeholder="e.g. Full house wiring repair"
            className={inputClass}
          />
        </Field>
        <Field label="Customer">
          <select name="customerId" required className={inputClass} defaultValue="">
            <option value="" disabled>
              Select a customer
            </option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {customers.length === 0 && (
            <p className="text-[11px] text-zinc-400 mt-1">
              No customers yet —{' '}
              <Link href="/customers/new" className="text-ink font-semibold hover:underline">
                add one first
              </Link>
              .
            </p>
          )}
        </Field>
      </Card>

      <Card className="p-6">
        <h2 className="text-sm font-bold text-zinc-900 mb-3">Line items</h2>
        <LineItemsEditor onSubtotal={setSubtotal} currency={taxConfig.currency} />
      </Card>

      <Card className="p-6">
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between text-zinc-600">
            <dt>Subtotal</dt>
            <dd className="font-semibold">{formatMoney(subtotal, taxConfig.currency)}</dd>
          </div>
          {breakdown.map((b) => (
            <div key={b.name} className="flex justify-between text-zinc-600">
              <dt>
                {b.name} {b.rate}%
              </dt>
              <dd className="font-semibold">{formatMoney(b.amount, taxConfig.currency)}</dd>
            </div>
          ))}
          <div className="flex justify-between items-center border-t border-zinc-100 pt-3 mt-1">
            <dt className="text-zinc-600">Quote total</dt>
            <dd className="text-2xl font-bold text-zinc-900">
              {formatMoney(total, taxConfig.currency)}
            </dd>
          </div>
        </dl>
        <p className="text-[11px] text-zinc-400 mt-3">
          {taxConfig.label} included — set in Settings → Region & tax.
        </p>
      </Card>

      {state?.error && (
        <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl px-3 py-2.5">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{state.error}</span>
        </div>
      )}

      <div className="flex gap-2">
        <button type="submit" disabled={isPending} className={primaryBtnClass}>
          <FileCheck size={14} />
          {isPending ? 'Creating…' : 'Create quote'}
        </button>
        <Link href="/quotes" className={secondaryBtnClass}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
