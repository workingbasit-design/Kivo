'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type AgendaRowTone = 'done' | 'open' | 'scheduled';

export interface AgendaRowProps {
  time: string;
  ampm: string;
  tone: AgendaRowTone;
  /** Rendered icon element, not the component itself (see PageHeader). */
  icon: ReactNode;
  title: string;
  sub: string;
  who?: string;
  whoInitials?: string;
  statusChip?: ReactNode;
  href?: string;
  onClick?: () => void;
}

const BAR_TONE: Record<AgendaRowTone, string> = {
  done: 'bg-ok',
  open: 'bg-warn',
  scheduled: 'bg-steel',
};

/**
 * Agenda row mirroring the mockup's `.arow`: time, coloured side bar,
 * trade icon, title, sub, crew/who plus a status chip.
 * Renders as a link when `href` is given, otherwise a button.
 */
export function AgendaRow({
  time,
  ampm,
  tone,
  icon,
  title,
  sub,
  who,
  whoInitials,
  statusChip,
  href,
  onClick,
}: AgendaRowProps) {
  const body = (
    <>
      <span className="pt-0.5 text-right">
        <span className="num block text-[19px] leading-none font-bold">{time}</span>
        <span className="num block text-[13px] font-semibold text-ink-2">{ampm}</span>
      </span>
      <span className={cn('w-1 rounded-[2px]', BAR_TONE[tone])} aria-hidden="true" />
      <span className="flex min-w-0 items-start gap-3">
        <span className="grid h-10 w-10 flex-none place-items-center rounded-[12px] bg-surface-2 text-ink shadow-[inset_0_0_0_1px_var(--line)] [&_svg]:size-[22px]">
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <b className="block text-[16px] leading-[1.25] font-semibold">{title}</b>
          <span className="block truncate text-[15px] text-ink-2">{sub}</span>
          {(who != null || whoInitials != null || statusChip != null) && (
            <span className="mt-1.5 flex flex-wrap items-center gap-2">
              {(who != null || whoInitials != null) && (
                <span className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-ink-2">
                  {whoInitials != null ? (
                    <span
                      className="grid h-6 w-6 place-items-center rounded-full bg-surface-2 text-[11px] font-bold text-ink shadow-[inset_0_0_0_1px_var(--line)]"
                      aria-hidden="true"
                    >
                      {whoInitials}
                    </span>
                  ) : null}
                  {who}
                </span>
              )}
              {statusChip}
            </span>
          )}
        </span>
      </span>
    </>
  );

  const classes =
    'grid w-full grid-cols-[58px_4px_minmax(0,1fr)] gap-3 border-t border-line px-[14px] py-3 text-left text-inherit ' +
    'focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-[-2px]';

  if (href != null) {
    return (
      <a data-kit="agenda-row" href={href} className={cn(classes, 'no-underline')}>
        {body}
      </a>
    );
  }
  return (
    <button data-kit="agenda-row" type="button" className={classes} onClick={onClick}>
      {body}
    </button>
  );
}
