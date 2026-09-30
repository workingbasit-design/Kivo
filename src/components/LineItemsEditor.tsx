'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { t, type Locale } from '@/lib/i18n';
import { Field, inputClass, secondaryBtnClass } from '@/components/ui';
import { currencySymbol, formatMoney } from '@/lib/money';

export interface LineItemRow {
  desc: string;
  qty: string;
  rate: string;
}

const blankRow = (): LineItemRow => ({ desc: '', qty: '1', rate: '' });

/**
 * Dynamic line-item rows. Serializes valid rows into a hidden `itemsJson`
 * input; the server recomputes all money math from it.
 *
 * Discount controls emit hidden `discountType` / `discountValue` fields in
 * the same form — the server validates and recomputes them too.
 */
export default function LineItemsEditor({
  onSubtotal,
  onDiscount,
  currency,
  initialItems,
  initialDiscount,
  locale = 'en',
}: {
  onSubtotal?: (subtotal: number) => void;
  onDiscount?: (discount: { type: 'PERCENT' | 'AMOUNT' | null; value: number }) => void;
  currency?: string;
  initialItems?: { desc: string; qty: string; rate: string }[];
  initialDiscount?: { type: 'PERCENT' | 'AMOUNT' | null; value: string };
  locale?: Locale;
}) {
  const [rows, setRows] = useState<LineItemRow[]>(
    initialItems && initialItems.length > 0 ? initialItems : [blankRow()]
  );
  const [discountType, setDiscountType] = useState<'' | 'PERCENT' | 'AMOUNT'>(
    initialDiscount?.type === 'PERCENT' || initialDiscount?.type === 'AMOUNT'
      ? initialDiscount.type
      : ''
  );
  const [discountValue, setDiscountValue] = useState(initialDiscount?.value ?? '');

  const L = (path: string) => t(locale, path);

  const validRows = useMemo(
    () =>
      rows
        .map((r) => ({
          desc: r.desc.trim(),
          qty: Number(r.qty),
          rate: Number(r.rate),
        }))
        .filter(
          (r) => r.desc.length > 0 && Number.isFinite(r.qty) && r.qty > 0 && Number.isFinite(r.rate) && r.rate >= 0
        ),
    [rows]
  );

  const subtotal = useMemo(
    () => Math.round(validRows.reduce((s, r) => s + r.qty * r.rate, 0) * 100) / 100,
    [validRows]
  );

  useEffect(() => {
    onSubtotal?.(subtotal);
  }, [subtotal, onSubtotal]);

  // Live discount preview — the server re-validates and recomputes this.
  const discount = useMemo(() => {
    const raw = Number(discountValue);
    if (!discountType || !Number.isFinite(raw) || raw <= 0) {
      return { type: null as 'PERCENT' | 'AMOUNT' | null, value: 0, amount: 0 };
    }
    const value = raw;
    const amount =
      discountType === 'PERCENT'
        ? Math.round((subtotal * Math.min(100, value)) / 100 * 100) / 100
        : Math.round(Math.min(subtotal, value) * 100) / 100;
    return { type: discountType, value, amount };
  }, [subtotal, discountType, discountValue]);

  useEffect(() => {
    onDiscount?.({ type: discount.type, value: discount.value });
  }, [discount, onDiscount]);

  const setRow = (i: number, patch: Partial<LineItemRow>) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const removeRow = (i: number) =>
    setRows((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));

  return (
    <div>
      <input type="hidden" name="itemsJson" value={JSON.stringify(validRows)} />
      <input type="hidden" name="discountType" value={discount.type ?? ''} />
      <input type="hidden" name="discountValue" value={discount.type ? String(discount.value) : ''} />
      <div className="space-y-3">
        {rows.map((row, i) => (
          <div
            key={i}
            className="rounded-2xl border border-zinc-200/70 bg-zinc-50/50 p-3.5 space-y-3"
          >
            <Field label={`${L('t10money.lineItemLabel')} ${i + 1}`}>
              <input
                value={row.desc}
                onChange={(e) => setRow(i, { desc: e.target.value })}
                placeholder={L('t10money.itemPlaceholder').replace('{n}', String(i + 1))}
                className={`${inputClass} bg-white`}
                maxLength={200}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={L('t10money.qtyLabel')}>
                <input
                  value={row.qty}
                  onChange={(e) => setRow(i, { qty: e.target.value })}
                  placeholder="1"
                  inputMode="decimal"
                  className={`${inputClass} bg-white`}
                />
              </Field>
              <Field label={`${L('t10money.rateLabel')} ${currencySymbol(currency)}`}>
                <input
                  value={row.rate}
                  onChange={(e) => setRow(i, { rate: e.target.value })}
                  placeholder="0.00"
                  inputMode="decimal"
                  className={`${inputClass} bg-white`}
                />
              </Field>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-zinc-500">
                {L('t10money.itemAmountPreview')}:{' '}
                <span className="font-bold text-zinc-900">
                  {formatMoney(
                    Math.round(Number(row.qty || 0) * Number(row.rate || 0) * 100) / 100,
                    currency
                  )}
                </span>
              </p>
              <button
                type="button"
                onClick={() => removeRow(i)}
                disabled={rows.length <= 1}
                className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl text-zinc-400 hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-30"
                aria-label={L('t10money.removeItemLabel')}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 mt-3">
        <button type="button" onClick={() => setRows((p) => [...p, blankRow()])} className={secondaryBtnClass}>
          <Plus size={14} /> {L('t10money.addItemLabel')}
        </button>
        <p className="text-sm text-zinc-600">
          {L('t10money.subtotalLabel')}: <span className="font-bold text-zinc-900">{formatMoney(subtotal, currency)}</span>
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-3">
        <label htmlFor="discountType" className="text-xs font-semibold text-zinc-500 shrink-0">
          {L('t10money.discountLabel')}
        </label>
        <select
          id="discountType"
          value={discountType}
          onChange={(e) => {
            const v = e.target.value as '' | 'PERCENT' | 'AMOUNT';
            setDiscountType(v);
            if (!v) setDiscountValue('');
          }}
          className={`${inputClass} w-auto`}
        >
          <option value="">{L('t10money.discountNone')}</option>
          <option value="PERCENT">{L('t10money.discountPercent')}</option>
          <option value="AMOUNT">{L('t10money.discountAmount')}</option>
        </select>
        {discountType && (
          <input
            value={discountValue}
            onChange={(e) => setDiscountValue(e.target.value)}
            placeholder={discountType === 'PERCENT' ? '10' : '25'}
            inputMode="decimal"
            aria-label={L('t10money.discountValueLabel')}
            className={`${inputClass} w-28`}
          />
        )}
        {discount.amount > 0 && (
          <span className="text-xs font-semibold text-emerald-700">
            −{formatMoney(discount.amount, currency)}
          </span>
        )}
      </div>
    </div>
  );
}
