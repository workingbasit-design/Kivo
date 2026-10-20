'use client';

import { useState } from 'react';
import { Download } from '@/components/icons';
import { t, type Locale } from '@/lib/i18n';
import { escapeCsvCell } from '@/lib/costing';
import { formatMoney } from '@/lib/money';
import { Button } from '@/components/kit';

export type ExportColumn = {
  key: string;
  label: string;
  /** 'money' columns render as CAD-formatted strings in the CSV. */
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
 * Shared export-download logic (CSV) so both the inline ExportButtons and
 * the mobile overflow menu (JobsExportMenu) download exactly the same file.
 *
 * 2026-10-15: the .xlsx export was removed. The `xlsx` (SheetJS) package
 * carries unpatched high-severity advisories (GHSA-4r6h-8v6p-xvw6,
 * GHSA-5pgg-2g8v-p4x9 — no fixed version exists) and the only maintained
 * alternative (exceljs) has its own unpatched high CVE (CVE-2026-78208),
 * so neither can pass the `npm audit --audit-level=high` CI gate. CSV
 * opens natively in Excel, Google Sheets, and LibreOffice (UTF-8 BOM
 * included for fr-CA accents), so no data interchange is lost.
 */
export function useExportDownloads({
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
  const [busy, setBusy] = useState<null | 'csv'>(null);
  const moneyLocale = locale === 'fr' ? 'fr' : 'en';

  const moneyText = (v: unknown): string => {
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? formatMoney(n, currency, moneyLocale) : '';
  };

  // Clean cell values for consistent export layout: trim whitespace,
  // remove trailing commas, normalize empty values.
  const cleanText = (v: unknown): string => {
    if (v === null || v === undefined) return '';
    const s = String(v).trim().replace(/,+\s*$/, '').trim();
    return s;
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
            const cellValue = c.kind === 'money' ? moneyText(v) : cleanText(v);
            return escapeCsvCell(cellValue);
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

  return { downloadCsv, busy, disabled };
}

/**
 * "Export CSV" button for list pages. Receives the *currently filtered*
 * rows from the page so the download always matches what the user sees.
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
  const { downloadCsv, busy, disabled } = useExportDownloads({
    columns,
    rows,
    fileBase,
    currency,
    locale,
  });

  return (
    <Button
      variant="secondary"
      type="button"
      onClick={downloadCsv}
      disabled={disabled}
      className="disabled:opacity-60 disabled:cursor-not-allowed"
      title={t(locale, 'exports.csv')}
    >
      <Download size={14} />
      {busy === 'csv' ? t(locale, 'exports.preparing') : t(locale, 'exports.csv')}
    </Button>
  );
}
