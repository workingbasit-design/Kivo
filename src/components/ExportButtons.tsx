'use client';

import { useState } from 'react';
import { Download, FileSpreadsheet } from 'lucide-react';
import { t, type Locale } from '@/lib/i18n';
import { escapeCsvCell } from '@/lib/costing';
import { formatMoney } from '@/lib/money';
import { secondaryBtnClass } from '@/components/ui';

export type ExportColumn = {
  key: string;
  label: string;
  /** 'money' columns render as CAD-formatted strings in CSV and as real
   *  numeric cells with a CAD number format in Excel. */
  kind?: 'money' | 'text';
};

export type ExportRow = Record<string, string | number | null | undefined>;

function triggerDownload(url: string, filename: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * "Export CSV" / "Export Excel" buttons for list pages. Receives the
 * *currently filtered* rows from the page so the download always matches
 * what the user sees. CSV is generated directly; the xlsx library is
 * dynamically imported on click so list pages pay no bundle cost until used.
 */
export default function ExportButtons({
  columns,
  rows,
  fileBase,
  currency,
  locale = 'en',
}: {
  columns: ExportColumn[];
  rows: ExportRow[];
  /** filename prefix, e.g. 'everyjob-customers-2026-09-24' */
  fileBase: string;
  currency?: string | null;
  locale?: Locale;
}) {
  const [busy, setBusy] = useState<null | 'csv' | 'xlsx'>(null);
  const moneyLocale = locale === 'fr' ? 'fr' : 'en';

  const moneyText = (v: unknown): string => {
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? formatMoney(n, currency, moneyLocale) : '';
  };

  const disabled = busy !== null || rows.length === 0;

  function downloadCsv() {
    setBusy('csv');
    try {
      const head = columns.map((c) => escapeCsvCell(c.label)).join(',');
      const lines = rows.map((r) =>
        columns
          .map((c) => {
            const v = r[c.key];
            return escapeCsvCell(c.kind === 'money' ? moneyText(v) : (v ?? ''));
          })
          .join(',')
      );
      // BOM so Excel opens the CSV with UTF-8 (accents in fr-CA) intact.
      const blob = new Blob(['\uFEFF' + [head, ...lines].join('\r\n')], {
        type: 'text/csv;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      triggerDownload(url, `${fileBase}.csv`);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } finally {
      setBusy(null);
    }
  }

  async function downloadXlsx() {
    setBusy('xlsx');
    try {
      const XLSX = await import('xlsx');
      const aoa: (string | number | null)[][] = [
        columns.map((c) => c.label),
        ...rows.map((r) =>
          columns.map((c) => {
            const v = r[c.key];
            if (c.kind === 'money') {
              const n = typeof v === 'number' ? v : Number(v);
              return Number.isFinite(n) ? n : null;
            }
            return v === undefined ? null : (v as string | number | null);
          })
        ),
      ];
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      // Money columns: real numbers with a CAD display format so they stay
      // summable in Excel / Sheets / LibreOffice.
      columns.forEach((c, ci) => {
        if (c.kind !== 'money') return;
        for (let ri = 1; ri < aoa.length; ri++) {
          const addr = XLSX.utils.encode_cell({ r: ri, c: ci });
          const cell = ws[addr] as { v?: unknown; z?: string } | undefined;
          if (cell && typeof cell.v === 'number') cell.z = '"$"#,##0.00';
        }
      });
      ws['!cols'] = columns.map((c) => ({ wch: c.kind === 'money' ? 14 : 24 }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Export');
      XLSX.writeFile(wb, `${fileBase}.xlsx`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={downloadCsv}
        disabled={disabled}
        className={secondaryBtnClass}
        title={t(locale, 'exports.csv')}
      >
        <Download size={14} />
        {busy === 'csv' ? t(locale, 'exports.preparing') : t(locale, 'exports.csv')}
      </button>
      <button
        type="button"
        onClick={downloadXlsx}
        disabled={disabled}
        className={secondaryBtnClass}
        title={t(locale, 'exports.excel')}
      >
        <FileSpreadsheet size={14} />
        {busy === 'xlsx' ? t(locale, 'exports.preparing') : t(locale, 'exports.excel')}
      </button>
    </>
  );
}
