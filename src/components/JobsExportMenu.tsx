'use client';

import { useEffect, useRef, useState } from 'react';
import { EllipsisVertical, Download } from '@/components/icons';
import { t, type Locale } from '@/lib/i18n';
import { useExportDownloads, type ExportColumn, type ExportRow } from '@/components/ExportButtons';
import { Button } from '@/components/kit';

/**
 * Mobile overflow menu for the Jobs list (Part B4).
 *
 * On phones the Export CSV button moves behind a "More" (three-dot) menu
 * so the header stays uncluttered. On desktop the inline ExportButtons stay
 * visible - this component renders nothing there (`md:hidden`). Both paths
 * share `useExportDownloads`, so the files are identical.
 */
export default function JobsExportMenu({
  columns,
  rows,
  fileBase,
  currency,
  locale = 'en',
}: {
  columns: ExportColumn[];
  rows: ExportRow[];
  fileBase: string;
  currency?: string | null;
  locale?: Locale;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { downloadCsv, busy, disabled } = useExportDownloads({
    columns,
    rows,
    fileBase,
    currency,
    locale,
  });

  // Close on outside tap / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open ]);

  const itemClass =
    'w-full min-h-[44px] px-4 flex items-center gap-2.5 text-sm font-semibold text-ink hover:bg-surface-2 disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <div ref={ref} className="relative md:hidden">
      <Button
        variant="ghost"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t(locale, 'common.more')}
        title={t(locale, 'common.more')}
        className="rounded-full p-0 min-h-[44px] min-w-[44px]"
      >
        <EllipsisVertical size={18} />
      </Button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-2 w-56 overflow-hidden rounded-2xl border border-line bg-surface shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              downloadCsv();
              setOpen(false);
            }}
            disabled={disabled}
            className={itemClass}
          >
            <Download size={14} />
            {busy === 'csv' ? t(locale, 'exports.preparing') : t(locale, 'exports.csv')}
          </button>
        </div>
      )}
    </div>
  );
}
