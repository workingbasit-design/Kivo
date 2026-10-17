'use client';

import { useState } from 'react';
import { Download, Loader2 } from '@/components/icons';
import { exportF9Csv } from '@/app/actions/reports-f9';

export type F9ReportKey = 'revenue' | 'aging' | 'profit' | 'tax' | 'expenses' | 'leads';

/**
 * F9: per-report CSV export button. Calls the tenant-scoped, role-gated
 * server action and triggers a browser download of the returned CSV.
 */
export function F9ExportButton({
  report,
  year,
  label,
}: {
  report: F9ReportKey;
  year: number;
  label: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await exportF9Csv(report, year);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const blob = new Blob([res.csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink hover:underline disabled:opacity-50"
      >
        {busy ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
        {label}
      </button>
      {error && <span className="text-[11px] text-red-600">{error}</span>}
    </span>
  );
}
