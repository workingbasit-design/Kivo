'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type ChipTone = 'ok' | 'warn' | 'sched' | 'neutral';

export interface ChipProps {
  tone?: ChipTone;
  /** Rendered icon element, not the component itself (see PageHeader). */
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
}

const toneClasses: Record<ChipTone, string> = {
  ok: 'bg-ok-bg text-ok',
  warn: 'bg-warn-bg text-warn-text',
  sched: 'bg-surface-2 text-ink-2 ring-1 ring-inset ring-line',
  neutral: 'bg-surface-2 text-ink-2 ring-1 ring-inset ring-line',
};

/**
 * The one chip (mockup `.chip`): small inline status pill with optional
 * icon. FilterChips covers the selectable filter row; this is the static
 * display chip. Token utilities only — no hard-coded colours.
 */
export function Chip({ tone = 'neutral', icon, className, children }: ChipProps) {
  return (
    <span
      data-kit="chip"
      className={cn(
        'inline-flex items-center gap-[5px] min-h-[28px] px-[10px]',
        'rounded-[14px] text-[14px] font-semibold whitespace-nowrap',
        toneClasses[tone],
        className,
      )}
    >
      {icon && <span className="inline-flex [&_svg]:size-4" aria-hidden="true">{icon}</span>}
      {children}
    </span>
  );
}

export default Chip;
