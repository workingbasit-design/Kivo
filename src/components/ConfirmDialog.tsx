'use client';

import { useEffect, type ReactNode } from 'react';
import { X } from '@/components/icons';
import { t, type Locale } from '@/lib/i18n';
import { Button } from '@/components/kit';

/**
 * Shared in-app confirmation dialog. Never use the native `confirm()`
 * (auto-dismissed - silently cancelled - in automated browsers and some
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
  onCancel,
  error,
  children,
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
  /** Close handler. `onCancel` is the Part B8 spec name; `onClose` is the legacy name. Either works. */
  onClose?: () => void;
  onCancel?: () => void;
  /**
   * Server-action error to display INSIDE the dialog (morning QA 2026-10-15).
   * Errors used to render behind the open dialog overlay, so "Yes, delete"
   * looked dead when the action refused. Never hide action feedback again.
   */
  error?: string | null;
  /** Extra content (e.g. a reason textarea) rendered between message and buttons. */
  children?: ReactNode;
}) {
  const close = onCancel ?? onClose ?? (() => {});
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, close]);

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
        onClick={() => !busy && close()}
        className="absolute inset-0 bg-ink/45 backdrop-blur-[2px] cursor-default"
      />
      <div className="relative w-full sm:max-w-sm bg-surface rounded-t-3xl sm:rounded-3xl shadow-2xl border border-line p-6 max-h-[90vh] overflow-y-auto ej-sheet-in">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base font-bold text-ink tracking-tight">{title}</h3>
          <button
            onClick={close}
            disabled={busy}
            className="text-ink-2 hover:text-ink transition-colors min-w-[44px] min-h-[44px] -m-2 flex items-center justify-center rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40"
            aria-label={t(locale, 't10misc.confirmDialog.close')}
          >
            <X size={18} />
          </button>
        </div>
        <p className="mt-2 text-sm text-ink-2 leading-relaxed">{message}</p>
        {children}
        {error && (
          <div
            role="alert"
            className="mt-4 flex items-start gap-2 bg-danger-bg border border-danger/30 text-danger text-xs font-medium rounded-xl px-3 py-2.5"
          >
            <span>{error}</span>
          </div>
        )}
        <div className="mt-6 flex flex-col-reverse sm:flex-row gap-2">
          <Button
            variant="secondary"
            onClick={close}
            disabled={busy}
            className="flex-1 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {keep}
          </Button>
          <Button
            variant={danger ? 'danger' : 'secondary'}
            onClick={onConfirm}
            disabled={busy}
            className="flex-1 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {busy ? t(locale, 't10misc.confirmDialog.working') : yes}
          </Button>
        </div>
      </div>
    </div>
  );
}
