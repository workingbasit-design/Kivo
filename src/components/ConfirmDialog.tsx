'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { t, type Locale } from '@/lib/i18n';
import { dangerBtnClass, secondaryBtnClass } from '@/components/ui';

/**
 * Shared in-app confirmation dialog. Never use the native `confirm()`
 * (auto-dismissed — silently cancelled — in automated browsers and some
 * mobile webviews, making buttons appear to do nothing).
 *
 * Labels are locale-aware: pass translated `confirmLabel`/`cancelLabel`
 * when you have specific copy; the defaults come from the dictionary.
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  busy = false,
  danger = true,
  locale = 'en',
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  danger?: boolean;
  locale?: Locale;
  onConfirm: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  const yes = confirmLabel ?? t(locale, 't10misc.confirmDialog.yesDelete');
  const keep = cancelLabel ?? t(locale, 't10misc.confirmDialog.keep');

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        aria-label={t(locale, 't10misc.confirmDialog.close')}
        onClick={() => !busy && onClose()}
        className="absolute inset-0 bg-zinc-950/50 backdrop-blur-[2px] cursor-default"
      />
      <div className="relative w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-zinc-200 p-6 max-h-[90vh] overflow-y-auto ej-sheet-in">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base font-bold text-zinc-900 tracking-tight">{title}</h3>
          <button
            onClick={onClose}
            disabled={busy}
            className="text-zinc-400 hover:text-zinc-700 transition-colors min-w-[44px] min-h-[44px] -m-2 flex items-center justify-center rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40"
            aria-label={t(locale, 't10misc.confirmDialog.close')}
          >
            <X size={18} />
          </button>
        </div>
        <p className="mt-2 text-sm text-zinc-500 leading-relaxed">{message}</p>
        <div className="mt-6 flex flex-col-reverse sm:flex-row gap-2">
          <button onClick={onClose} disabled={busy} className={secondaryBtnClass + ' flex-1'}>
            {keep}
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className={(danger ? dangerBtnClass : secondaryBtnClass) + ' flex-1'}
          >
            {busy ? t(locale, 't10misc.confirmDialog.working') : yes}
          </button>
        </div>
      </div>
    </div>
  );
}
