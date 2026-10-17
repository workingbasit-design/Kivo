'use client';

import { kitButtonClass } from './kit-button';

export interface LeadCardProps {
  initials: string;
  name: string;
  source: string;
  waitingLabel?: string;
  message: string;
  tags?: string[];
  quoteLabel: string;
  callLabel: string;
  declineLabel: string;
  onQuote: () => void;
  onCall: () => void;
  onDecline: () => void;
}

/**
 * Inbound lead card mirroring the mockup's `.lead`: avatar, name, source,
 * waiting-time pill, message, tags, and Quote / Call / Decline actions.
 */
export function LeadCard({
  initials,
  name,
  source,
  waitingLabel,
  message,
  tags,
  quoteLabel,
  callLabel,
  declineLabel,
  onQuote,
  onCall,
  onDecline,
}: LeadCardProps) {
  return (
    <article
      data-kit="lead-card"
      className="rounded-2xl border border-line bg-surface p-[14px] shadow-kit-card"
    >
      <div className="grid grid-cols-[42px_minmax(0,1fr)_auto] items-center gap-3">
        <span
          className="grid h-[42px] w-[42px] flex-none place-items-center rounded-full bg-surface-2 text-[15px] font-bold text-ink shadow-[inset_0_0_0_1px_var(--line)]"
          aria-hidden="true"
        >
          {initials}
        </span>
        <div className="min-w-0">
          <b className="block truncate text-[17px]">{name}</b>
          <span className="block truncate text-[14px] text-ink-2">{source}</span>
        </div>
        {waitingLabel != null ? (
          <span className="inline-flex items-center gap-1 rounded-[10px] bg-warn-bg px-2 py-1 text-[13px] font-bold whitespace-nowrap text-warn-text">
            {waitingLabel}
          </span>
        ) : null}
      </div>
      <p className="my-3 text-[16px] leading-[1.45] text-ink">{message}</p>
      {tags != null && tags.length > 0 ? (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex min-h-[28px] items-center rounded-[14px] bg-surface-2 px-[10px] text-[14px] font-semibold text-ink-2 shadow-[inset_0_0_0_1px_var(--line)]"
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}
      <div className="grid grid-cols-[repeat(3,minmax(0,1fr))] gap-2">
        <button
          type="button"
          className={kitButtonClass('primary', { sm: true })}
          onClick={onQuote}
        >
          {quoteLabel}
        </button>
        <button
          type="button"
          className={kitButtonClass('secondary', { sm: true })}
          onClick={onCall}
        >
          {callLabel}
        </button>
        <button
          type="button"
          className={kitButtonClass('ghost', { sm: true })}
          onClick={onDecline}
        >
          {declineLabel}
        </button>
      </div>
    </article>
  );
}
