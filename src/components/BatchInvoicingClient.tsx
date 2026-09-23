'use client';

import { useState, useTransition, type CSSProperties } from 'react';
import Link from 'next/link';
import { FileText, AlertTriangle, CheckCircle2, Receipt } from 'lucide-react';
import { toast } from 'sonner';
import { t, type Locale } from '@/lib/i18n';
import { Card, EmptyState, primaryBtnClass, secondaryBtnClass } from '@/components/ui';
import { confirmBatchInvoices } from '@/app/actions/batch-invoicing';
import type { BatchPreviewRow } from '@/lib/billing';
import { formatMoney } from '@/lib/money';

function fill(template: string, count: number): string {
  return template.replace('{count}', String(count));
}

export default function BatchInvoicingClient({
  locale,
  initialRows,
  loadError,
}: {
  locale: Locale;
  initialRows: BatchPreviewRow[];
  loadError: string | null;
}) {
  const [rows, setRows] = useState<BatchPreviewRow[]>(initialRows);
  const [checked, setChecked] = useState<Record<string, boolean>>(
    Object.fromEntries(initialRows.map((r) => [r.jobId, true]))
  );
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(loadError);
  const [created, setCreated] = useState<number | null>(null);
  // Explicit second confirmation before creating invoices.
  const [confirming, setConfirming] = useState(false);

  const selected = rows.filter((r) => checked[r.jobId]);
  const grandTotal = selected.reduce((s, r) => s + r.total, 0);

  function toggle(jobId: string) {
    setChecked((c) => ({ ...c, [jobId]: !c[jobId] }));
  }

  function toggleAll() {
    const allOn = rows.every((r) => checked[r.jobId]);
    setChecked(Object.fromEntries(rows.map((r) => [r.jobId, !allOn])));
  }

  function onConfirm() {
    setError(null);
    start(async () => {
      const res = await confirmBatchInvoices(
        selected.map((r) => r.jobId)
      );
      if (res.error) {
        setError(res.error);
        toast.error(res.error);
        setConfirming(false);
        return;
      }
      // Success: remove the newly invoiced jobs from the preview.
      const doneIds = new Set(selected.map((r) => r.jobId));
      setRows((rs) => rs.filter((r) => !doneIds.has(r.jobId)));
      setChecked((c) => {
        const next = { ...c };
        for (const id of doneIds) delete next[id];
        return next;
      });
      setConfirming(false);
      toast.success(t(locale, 't10money.invoicesCreated').replace('{count}', String(res.created ?? 0)));
      setCreated(res.created ?? 0);
    });
  }

  if (created !== null) {
    return (
      <Card className="p-8">
        <div className="flex items-start gap-3">
          <CheckCircle2 size={22} className="text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <h2 className="text-base font-bold text-zinc-900">
              {t(locale, 'billing.batchDone')}
            </h2>
            <p className="text-sm text-zinc-600 mt-1">
              {fill(t(locale, 'billing.batchCreated'), created)}
            </p>
            <div className="flex gap-2 mt-4">
              <Link href="/invoices" className={primaryBtnClass}>
                {t(locale, 'billing.viewInvoices')}
              </Link>
              <button
                type="button"
                className={secondaryBtnClass}
                onClick={() => setCreated(null)}
              >
                {t(locale, 'billing.batchTitle')}
              </button>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Receipt size={24} />}
            title={t(locale, 'billing.emptyTitle')}
            description={t(locale, 'billing.emptyDesc')}
          />
        </Card>
      ) : (
        <>
          <Card className="!p-0 overflow-hidden">
            <div className="px-5 py-3 border-b border-zinc-100 flex items-center gap-3">
              <label className="min-h-[44px] min-w-[44px] flex items-center justify-center -ml-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rows.length > 0 && rows.every((r) => checked[r.jobId])}
                  onChange={toggleAll}
                  className="h-5 w-5 rounded border-zinc-300 accent-zinc-900"
                  aria-label={t(locale, 'billing.selectAll')}
                />
              </label>
              <span className="text-xs font-semibold text-zinc-500">
                {fill(t(locale, 'billing.selected'), selected.length)}
              </span>
            </div>
            <ul className="divide-y divide-zinc-100">
              {rows.map((r, i) => (
                <li
                  key={r.jobId}
                  className="ej-row-in flex items-start gap-3 px-4 sm:px-5 py-3.5"
                  style={{ '--row-delay': `${Math.min(i, 12) * 35}ms` } as CSSProperties}
                >
                  <label className="min-h-[44px] min-w-[44px] flex items-center justify-center -ml-2 cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={!!checked[r.jobId]}
                      onChange={() => toggle(r.jobId)}
                      className="h-5 w-5 rounded border-zinc-300 accent-zinc-900"
                      aria-label={r.title}
                    />
                  </label>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
                      <FileText size={14} className="text-zinc-400 shrink-0" />
                      <span className="truncate">{r.title}</span>
                    </p>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {r.customerName} · {r.date}
                    </p>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      {formatMoney(r.subtotal, 'CAD')} + {formatMoney(r.taxAmount, 'CAD')}{' '}
                      {t(locale, 'billing.colTax').toLowerCase()}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-zinc-900 shrink-0 pt-0.5">
                    {formatMoney(r.total, 'CAD')}
                  </p>
                </li>
              ))}
            </ul>
          </Card>

          {confirming ? (
            <Card className="p-6 border-amber-200 bg-amber-50/50">
              <div className="flex items-start gap-3">
                <AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h2 className="text-sm font-bold text-zinc-900">
                    {t(locale, 't10money.batchConfirmTitle')}
                  </h2>
                  <p className="text-sm text-zinc-600 mt-1 leading-relaxed">
                    {t(locale, 't10money.batchConfirmBody')
                      .replace('{count}', String(selected.length))
                      .replace('{total}', formatMoney(grandTotal, 'CAD'))}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-4">
                    <button
                      type="button"
                      className={primaryBtnClass}
                      disabled={busy}
                      onClick={onConfirm}
                    >
                      {busy
                        ? t(locale, 'billing.creating')
                        : t(locale, 't10money.batchConfirmCta').replace(
                            '{count}',
                            String(selected.length)
                          )}
                    </button>
                    <button
                      type="button"
                      className={secondaryBtnClass}
                      disabled={busy}
                      onClick={() => setConfirming(false)}
                    >
                      {t(locale, 't10money.batchKeep')}
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          ) : (
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <p className="text-sm text-zinc-600">
                {t(locale, 'billing.grandTotal')}:{' '}
                <span className="font-bold text-zinc-900">
                  {formatMoney(grandTotal, 'CAD')}
                </span>
              </p>
              <button
                type="button"
                className={primaryBtnClass}
                disabled={busy || selected.length === 0}
                onClick={() => setConfirming(true)}
              >
                {fill(t(locale, 'billing.createInvoices'), selected.length)}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
