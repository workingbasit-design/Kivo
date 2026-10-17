'use client';

import type { IconComponent } from '@/components/icons';
import { Plus } from '@/components/icons';
import { cn } from '@/lib/utils';

export interface PageHeaderProps {
  title: string;
  summary?: string;
  /** Label for the primary action button. */
  actionLabel: string;
  /** Leading icon on the action button; defaults to Plus. */
  actionIcon?: IconComponent;
  /** Render the action as a link when an href is preferred over a handler. */
  actionHref?: string;
  onAction?: () => void;
}

/**
 * Page head: 28px bold h1, a secondary summary line, and one hi-vis
 * primary action (`bg-hivis text-hivis-ink`).
 */
export function PageHeader({
  title,
  summary,
  actionLabel,
  actionIcon,
  actionHref,
  onAction,
}: PageHeaderProps) {
  const ActionIcon = actionIcon ?? Plus;
  const actionClasses = cn(
    'inline-flex flex-none items-center gap-1.5 rounded-[14px] bg-hivis px-[18px] pl-[14px] text-[17px] font-bold text-hivis-ink no-underline',
    'min-h-[48px]',
    'focus-visible:outline-2 focus-visible:outline-focus'
  );
  return (
    <header
      data-kit="page-header"
      className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2.5 px-0 pb-[14px] pt-1.5"
    >
      <div className="min-w-0 flex-[1_1_200px]">
        <h1 className="m-0 text-[28px] font-bold leading-[1.1] tracking-tight">{title}</h1>
        {summary != null && <p className="mb-0 mt-[5px] text-[16px] text-ink-2">{summary}</p>}
      </div>
      {actionHref ? (
        <a href={actionHref} className={actionClasses}>
          <ActionIcon size={20} aria-hidden />
          {actionLabel}
        </a>
      ) : (
        <button type="button" onClick={onAction} className={actionClasses}>
          <ActionIcon size={20} aria-hidden />
          {actionLabel}
        </button>
      )}
    </header>
  );
}

export default PageHeader;
