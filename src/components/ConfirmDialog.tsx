'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * Shared in-app confirmation dialog. Never use the native `confirm()`
 * (auto-dismissed — silently cancelled — in automated browsers and some
 * mobile webviews, making buttons appear to do nothing).
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Yes, delete',
  cancelLabel = 'Keep',
  busy = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
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

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-950/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={() => !busy && onClose()}
    >
      <div
        className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-zinc-200 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-sm font-bold text-zinc-900">{title}</h3>
          <button
            onClick={onClose}
            disabled={busy}
            className="text-zinc-400 hover:text-zinc-700 transition-colors"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
        <p className="mt-2 text-xs text-zinc-500 leading-relaxed">{message}</p>
        <div className="mt-5 flex gap-2">
          <button
            onClick={onClose}
            disabled={busy}
            className="flex-1 bg-zinc-100 hover:bg-zinc-200 disabled:opacity-50 text-zinc-700 text-xs font-semibold py-2.5 rounded-xl transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="flex-1 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-semibold py-2.5 rounded-xl transition-colors"
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
