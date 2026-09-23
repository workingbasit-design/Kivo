'use client';

import React, { useActionState, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, Receipt } from 'lucide-react';
import { createInvoice, type ActionResult } from '@/app/actions/invoices';
import LineItemsEditor from '@/components/LineItemsEditor';
import { Field, inputClass, primaryBtnClass, secondaryBtnClass, Card } from '@/components/ui';
import { toISODateLocal } from '@/lib/utils';
import { formatMoney } from '@/lib/money';
import {
  defaultTaxType,
  splitStoredTax,
  totalTaxRate,
  type TaxConfig,
} from '@/lib/tax';

const round2 = (n: number) => Math.round(n * 100) / 100;

function taxTypeOptions(config: TaxConfig): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  if (config.taxes.length > 1) {
    const composite = `${config.taxes[0].name}+${config.taxes[1].name}`;
    options.push({
      value: composite,
      label: config.taxes.map((t) => `${t.name} ${t.rate}%`).join(' + '),
    });
  }
  for (const t of config.taxes) {
    options.push({ value: t.name, label: `${t.name} ${t.rate}%` });
  }
  return options;
}

export default function InvoiceForm({
  customers,
  taxConfig,
}: {
  customers: { id: string; name: string }[];
  taxConfig: TaxConfig;
}) {
  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(
    createInvoice,
    {}
  );
  const [subtotal, setSubtotal] = useState(0);
  const [taxRate, setTaxRate] = useState(totalTaxRate(taxConfig));
  const [taxType, setTaxType] = useState<string>(defaultTaxType(taxConfig));

  const options = taxTypeOptions(taxConfig);
  // Breakdown preview from the stored-style tax (server recomputes anyway).
  const lines = splitStoredTax(taxType, taxRate).map((l) => ({
    ...l,
    amount: round2((subtotal * l.rate) / 100),
  }));
  const taxAmount = round2(lines.reduce((s, l) => s + l.amount, 0));
  const total = round2(subtotal + taxAmount);

  const quickRates = [0, totalTaxRate(taxConfig)];

  return (
    <form action={formAction} className="space-y-6 max-w-2xl">
      <Card className="p-6 space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
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
                <Link href="/customers/new" className="text-[#6329d4] font-semibold hover:underline">
                  add one first
                </Link>
                .
              </p>
            )}
          </Field>
          <Field label="Invoice date">
            <input
              name="date"
              type="date"
              required
              defaultValue={toISODateLocal(new Date())}
              className={inputClass}
            />
          </Field>
        </div>
        <Field label="Notes (optional)" hint="Shown on the invoice.">
          <textarea
            name="notes"
            rows={2}
            maxLength={2000}
            placeholder="e.g. Payment due within 7 days"
            className={inputClass}
          />
        </Field>
      </Card>

      <Card className="p-6">
        <h2 className="text-sm font-bold text-zinc-900 mb-3">Line items</h2>
        <LineItemsEditor onSubtotal={setSubtotal} currency={taxConfig.currency} />
      </Card>

      <Card className="p-6 space-y-4">
        <h2 className="text-sm font-bold text-zinc-900">Tax</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Tax type">
            <select
              name="taxType"
              value={taxType}
              onChange={(e) => setTaxType(e.target.value)}
              className={inputClass}
            >
              {options.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tax rate %">
            <div className="flex gap-2">
              <input
                name="taxRate"
                type="number"
                min={0}
                max={100}
                step="0.001"
                value={taxRate}
                onChange={(e) => setTaxRate(Number(e.target.value) || 0)}
                className={inputClass}
              />
            </div>
            <div className="flex gap-1.5 mt-2 flex-wrap">
              {quickRates.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setTaxRate(r)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                    taxRate === r
                      ? 'bg-[#6329d4] text-white border-[#6329d4]'
                      : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300'
                  }`}
                >
                  {r}%
                </button>
              ))}
            </div>
          </Field>
        </div>

        <dl className="border-t border-zinc-100 pt-4 space-y-1.5 text-sm">
          <div className="flex justify-between text-zinc-600">
            <dt>Subtotal</dt>
            <dd className="font-semibold">{formatMoney(subtotal, taxConfig.currency)}</dd>
          </div>
          {lines.map((l) => (
            <div key={l.name} className="flex justify-between text-zinc-600">
              <dt>
                {l.name} {l.rate}%
              </dt>
              <dd className="font-semibold">{formatMoney(l.amount, taxConfig.currency)}</dd>
            </div>
          ))}
          <div className="flex justify-between text-base pt-1">
            <dt className="font-bold text-zinc-900">Total</dt>
            <dd className="font-bold text-zinc-900">{formatMoney(total, taxConfig.currency)}</dd>
          </div>
        </dl>
      </Card>

      {state?.error && (
        <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl px-3 py-2.5">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{state.error}</span>
        </div>
      )}

      <div className="flex gap-2">
        <button type="submit" disabled={isPending} className={primaryBtnClass}>
          <Receipt size={14} />
          {isPending ? 'Creating…' : 'Create invoice'}
        </button>
        <Link href="/invoices" className={secondaryBtnClass}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
