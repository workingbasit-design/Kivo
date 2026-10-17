'use client';

import { useState } from 'react';
import { Download } from '@/components/icons';
import { exportAccountingCSV } from '@/app/actions/accounting-export';

type Format = 'quickbooks' | 'xero' | 'wave';

export default function AccountingExportClient({ locale }: { locale: string }) {
  const [format, setFormat] = useState<Format>('quickbooks');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const fr = locale === 'fr';

  async function handleExport() {
    setExporting(true);
    setMessage(null);
    try {
      const result = await exportAccountingCSV(format, startDate || undefined, endDate || undefined);
      if (result.error) {
        setMessage(result.error);
      } else if (result.csv) {
        // Download the CSV
        const blob = new Blob([result.csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.filename || `export-${format}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setMessage(fr ? `Exporté: ${result.summary}` : `Exported: ${result.summary}`);
      }
    } catch (e) {
      setMessage(fr ? 'Échec de l’export.' : 'Export failed.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      {message && (
        <p className="text-sm font-medium text-ink bg-paper border border-smoke rounded-xl px-4 py-2.5">
          {message}
        </p>
      )}

      <div>
        <label className="block text-sm font-bold text-ink mb-2">
          {fr ? 'Format' : 'Format'}
        </label>
        <div className="space-y-2">
          {(['quickbooks', 'xero', 'wave'] as Format[]).map((f) => (
            <label key={f} className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="format"
                value={f}
                checked={format === f}
                onChange={(e) => setFormat(e.target.value as Format)}
                className="w-4 h-4 accent-ink"
              />
              <span className="text-sm text-ink capitalize">
                {f === 'quickbooks' ? 'QuickBooks Online' : f === 'xero' ? 'Xero' : 'Wave'}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-bold text-ink mb-1.5">
            {fr ? 'Du' : 'From'}
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full border border-smoke rounded-xl px-3 py-2.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-bold text-ink mb-1.5">
            {fr ? 'Au' : 'To'}
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full border border-smoke rounded-xl px-3 py-2.5 text-sm"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={handleExport}
        disabled={exporting}
        className="w-full bg-asphalt text-white rounded-xl px-4 py-3 font-semibold text-sm inline-flex items-center justify-center gap-2 disabled:opacity-60"
      >
        <Download size={16} />
        {exporting ? (fr ? 'Export…' : 'Exporting…') : (fr ? 'Exporter CSV' : 'Export CSV')}
      </button>

      <p className="text-xs text-graphite">
        {fr
          ? 'Inclut clients, factures (avec taxes), paiements. Les montants sont en cents convertis en dollars.'
          : 'Includes customers, invoices (with tax lines), payments. Amounts in dollars.'}
      </p>
    </div>
  );
}
