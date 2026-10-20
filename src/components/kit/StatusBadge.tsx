import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type StatusBadgeTone =
  | 'late'
  | 'warn'
  | 'done'
  | 'scheduled'
  | 'info'
  | 'neutral';

export interface StatusBadgeProps {
  tone: StatusBadgeTone;
  icon?: ReactNode; // rendered element, not the component (see kit PageHeader)
  children: ReactNode;
}

const toneClasses: Record<StatusBadgeTone, string> = {
  late: 'bg-danger-bg text-danger',
  warn: 'bg-warn-bg text-warn-text',
  done: 'bg-ok-bg text-ok',
  scheduled: 'bg-surface-2 text-ink-2 ring-1 ring-inset ring-line',
  info: 'bg-info-bg text-info',
  neutral: 'bg-surface-2 text-ink-2 ring-1 ring-inset ring-line',
};

/** Pill badge (mockup `.sb`). */
export function StatusBadge({ tone, icon, children }: StatusBadgeProps) {
  return (
    <span
      data-kit="status-badge"
      className={cn(
        'inline-flex items-center gap-1 min-h-[24px] px-[9px]',
        'rounded-xl text-[13px] font-bold whitespace-nowrap',
        toneClasses[tone],
      )}
    >
      {icon && <span aria-hidden="true" className="inline-flex [&_svg]:size-[14px]">{icon}</span>}
      {children}
    </span>
  );
}
