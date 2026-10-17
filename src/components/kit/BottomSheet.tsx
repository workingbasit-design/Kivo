'use client';

import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { kitButtonClass } from './kit-button';

export interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  sub?: string;
  children: ReactNode;
  /** Custom footer; defaults to Done / Cancel buttons. */
  footer?: ReactNode;
  doneLabel?: string;
  cancelLabel?: string;
  /** Defaults to `onClose` when omitted. */
  onDone?: () => void;
}

const FOCUSABLE =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Bottom sheet with scrim and grab handle, mirroring the mockup's `.sheet`.
 * Renders nothing when closed. Focuses the first focusable element on open;
 * Escape closes. All copy (title/sub/Done/Cancel) comes from props.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  sub,
  children,
  footer,
  doneLabel,
  cancelLabel,
  onDone,
}: BottomSheetProps) {
  const titleId = useId();
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const sheet = sheetRef.current;
    if (sheet) {
      const first = sheet.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? sheet).focus();
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const defaultFooter =
    doneLabel != null || cancelLabel != null ? (
      <div className="mt-4 grid gap-2">
        {doneLabel != null ? (
          <button
            type="button"
            className={kitButtonClass('primary', { block: true })}
            onClick={onDone ?? onClose}
          >
            {doneLabel}
          </button>
        ) : null}
        {cancelLabel != null ? (
          <button
            type="button"
            className={kitButtonClass('ghost', { block: true })}
            onClick={onClose}
          >
            {cancelLabel}
          </button>
        ) : null}
      </div>
    ) : null;

  return (
    <div data-kit="bottom-sheet">
      <div
        className="fixed inset-0 z-50 bg-ink/45"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="fixed inset-x-0 bottom-0 z-[51] mx-auto max-h-[88%] w-full max-w-[480px] overflow-auto rounded-t-[22px] bg-surface px-[18px] pt-2.5 pb-[calc(18px+env(safe-area-inset-bottom,0px))] text-ink shadow-kit-sheet focus-visible:outline-none"
      >
        <div className="mx-auto mb-3 h-[5px] w-10 rounded-[3px] bg-line" aria-hidden="true" />
        <h2
          id={titleId}
          className="m-0 text-[22px] font-bold tracking-tight"
        >
          {title}
        </h2>
        {sub != null ? (
          <p className="mt-1 mb-3 text-[15px] text-ink-2">{sub}</p>
        ) : null}
        <div>{children}</div>
        {footer ?? defaultFooter}
      </div>
    </div>
  );
}
