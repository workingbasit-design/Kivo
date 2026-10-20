'use client';

import type { ReactNode } from 'react';
import { kitButtonClass } from './kit-button';

export interface EmptyStateProps {
  /** Rendered icon element (<Wallet className="h-8 w-8" aria-hidden="true" />),
   *  not the component itself — component functions cannot cross the
   *  server/client boundary as props. */
  icon: ReactNode;
  title: string;
  text?: string;
  actionLabel?: string;
  onAction?: () => void;
}

/** Centered empty state: icon, title, text and an optional action button. */
export function EmptyState({
  icon,
  title,
  text,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div
      data-kit="empty-state"
      className="flex flex-col items-center px-6 py-10 text-center"
    >
      <span
        aria-hidden="true"
        className="grid h-16 w-16 place-items-center rounded-2xl bg-surface-2 text-ink shadow-[inset_0_0_0_1px_var(--line)] [&_svg]:size-8"
      >
        {icon}
      </span>
      <h2 className="mt-4 text-[21px] font-bold tracking-tight text-ink">
        {title}
      </h2>
      {text != null ? (
        <p className="mt-1 max-w-[32ch] text-[16px] leading-[1.45] text-ink-2">
          {text}
        </p>
      ) : null}
      {actionLabel != null ? (
        <button
          type="button"
          className={kitButtonClass('primary', { sm: true }) + ' mt-5'}
          onClick={onAction}
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
