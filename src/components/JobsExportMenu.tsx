'use client';

import { useEffect, useRef, useState } from 'react';
import { EllipsisVertical, Download } from 'lucide-react';
import { t, type Locale } from '@/lib/i18n';
import { useExportDownloads, type ExportColumn, type ExportRow } from '@/components/ExportButtons';
import { cn } from '@/lib/utils';
import { glassClass } from '@/components/ui';

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
    'w-full min-h-[44px] px-4 flex items-center gap-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <div ref={ref} className="relative md:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t(locale, 'common.more')}
        title={t(locale, 'common.more')}
        className={cn(
          'min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-zinc-700 transition-all hover:scale-105 active:scale-95',
          glassClass('zinc')
        )}
      >
        <EllipsisVertical size={18} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-2 w-56 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-lg"
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
