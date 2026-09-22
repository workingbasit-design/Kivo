'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { inputClass, secondaryBtnClass } from '@/components/ui';
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
 */
export default function LineItemsEditor({
  onSubtotal,
  currency,
}: {
  onSubtotal?: (subtotal: number) => void;
  currency?: string;
}) {
  const [rows, setRows] = useState<LineItemRow[]>([blankRow()]);

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

  const setRow = (i: number, patch: Partial<LineItemRow>) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const removeRow = (i: number) =>
    setRows((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));

  return (
    <div>
      <input type="hidden" name="itemsJson" value={JSON.stringify(validRows)} />
      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="grid grid-cols-[1fr_72px_96px_36px] gap-2 items-center">
            <input
              value={row.desc}
              onChange={(e) => setRow(i, { desc: e.target.value })}
              placeholder={`Item ${i + 1} — e.g. Fan installation`}
              className={inputClass}
              maxLength={200}
            />
            <input
              value={row.qty}
              onChange={(e) => setRow(i, { qty: e.target.value })}
              placeholder="Qty"
              inputMode="decimal"
              className={inputClass}
              aria-label="Quantity"
            />
            <input
              value={row.rate}
              onChange={(e) => setRow(i, { rate: e.target.value })}
              placeholder={`Rate ${currencySymbol(currency)}`}
              inputMode="decimal"
              className={inputClass}
              aria-label="Rate"
            />
            <button
              type="button"
              onClick={() => removeRow(i)}
              className="p-2.5 rounded-xl text-zinc-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
              aria-label="Remove item"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between mt-3">
        <button type="button" onClick={() => setRows((p) => [...p, blankRow()])} className={secondaryBtnClass}>
          <Plus size={14} /> Add item
        </button>
        <p className="text-sm text-zinc-600">
          Subtotal: <span className="font-bold text-zinc-900">{formatMoney(subtotal, currency)}</span>
        </p>
      </div>
    </div>
  );
}
