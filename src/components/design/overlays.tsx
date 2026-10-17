'use client';

import React, { useEffect, useRef } from 'react';
import { X, AlertTriangle } from '@/components/icons';
import { cn } from '@/lib/utils';
import { Button } from './Button';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Dialog — modal with focus trap (basic), Escape to close, labelled by title.
 * Elevation 3 (highest).
 */
export function Dialog({ open, onClose, title, children, className }: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    // Focus the dialog on open
    dialogRef.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          'w-full max-w-md bg-ej-raised rounded-2xl shadow-xl',
          'max-h-[90vh] overflow-y-auto',
          'focus:outline-none',
          className
        )}
      >
        <div className="flex items-center justify-between p-5 border-b border-ej-border">
          <h2 className="text-lg font-bold text-ej-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-lg hover:bg-ej-surface focus-visible:outline-2 focus-visible:outline-ej-focus"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel: string;
  destructive?: boolean;
  loading?: boolean;
}

/**
 * ConfirmDialog — destructive wording names the exact thing.
 * e.g. "Delete invoice INV-0001?" not "Are you sure?"
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  destructive = false,
  loading = false,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <div className="flex items-start gap-3 mb-5">
        {destructive && (
          <span className="shrink-0 w-10 h-10 rounded-full bg-ej-danger-bg text-ej-danger inline-flex items-center justify-center">
            <AlertTriangle size={20} aria-hidden="true" />
          </span>
        )}
        <p className="text-base text-ej-secondary">{message}</p>
      </div>
      <div className="flex gap-3 justify-end">
        <Button variant="secondary" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant={destructive ? 'destructive' : 'primary'}
          onClick={onConfirm}
          loading={loading}
        >
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}

export interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

/**
 * BottomSheet — rises from bottom on phones (150-250ms), centred dialog on desktop.
 * Used for pickers, menus, and sheets on mobile.
 */
export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    sheetRef.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          'w-full sm:max-w-md bg-ej-raised',
          'rounded-t-2xl sm:rounded-2xl shadow-xl',
          'max-h-[85vh] overflow-y-auto',
          'focus:outline-none',
          // Animate only on user action (sheet opening)
          'animate-[sheetUp_200ms_cubic-bezier(0.32,0.72,0,1)]',
          'motion-reduce:animate-none'
        )}
      >
        <div className="sticky top-0 flex items-center justify-between p-4 border-b border-ej-border bg-ej-raised">
          <h2 className="text-base font-bold text-ej-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-lg hover:bg-ej-surface"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
