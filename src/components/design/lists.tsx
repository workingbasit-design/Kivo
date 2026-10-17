'use client';

import React from 'react';
import { ChevronRight, MoreVertical } from '@/components/icons';
import { cn } from '@/lib/utils';

export interface ListRowProps {
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
  onClick?: () => void;
  href?: string;
  menuLabel?: string;
  onMenu?: () => void;
  className?: string;
}

/**
 * ListRow — 56px min height. Swipe actions must always have a visible menu
 * alternative (the More button). Chevron indicates navigation.
 */
export function ListRow({ title, subtitle, trailing, onClick, href, menuLabel, onMenu, className }: ListRowProps) {
  const content = (
    <>
      <span className="flex-1 min-w-0">
        <span className="block text-base text-ej-ink truncate">{title}</span>
        {subtitle && <span className="block text-sm text-ej-secondary truncate mt-0.5">{subtitle}</span>}
      </span>
      {trailing && <span className="shrink-0 text-base tabular-nums text-ej-ink">{trailing}</span>}
      {(onClick || href) && (
        <ChevronRight size={18} aria-hidden="true" className="shrink-0 text-ej-muted" />
      )}
      {onMenu && (
        <button
          type="button"
          aria-label={menuLabel ?? `More actions for ${title}`}
          onClick={(e) => {
            e.stopPropagation();
            onMenu();
          }}
          className="shrink-0 min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg hover:bg-ej-surface focus-visible:outline-2 focus-visible:outline-ej-focus"
        >
          <MoreVertical size={18} aria-hidden="true" />
        </button>
      )}
    </>
  );

  const classes = cn(
    'flex items-center gap-3 w-full min-h-[56px] px-4 py-3 text-left',
    'border-b border-ej-border last:border-b-0',
    'transition-colors duration-100',
    'focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ej-focus',
    (onClick || href) && 'hover:bg-ej-surface active:bg-ej-border/30 cursor-pointer',
    className
  );

  if (href) {
    return (
      <a href={href} className={classes}>
        {content}
      </a>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={classes}>
        {content}
      </button>
    );
  }
  return <div className={classes}>{content}</div>;
}

export interface StatProps {
  label: string;
  timeRange: string;
  value: string;
  hint?: string;
  className?: string;
}

/**
 * Stat — label includes its time range (e.g. "Collected", "Last 7 days").
 * Never a big number with a vague label.
 */
export function Stat({ label, timeRange, value, hint, className }: StatProps) {
  return (
    <div className={cn('p-4', className)}>
      <p className="text-sm font-semibold text-ej-secondary">{label}</p>
      <p className="text-xs text-ej-muted mt-0.5">{timeRange}</p>
      <p className="text-2xl font-bold text-ej-ink tabular-nums mt-1">{value}</p>
      {hint && <p className="text-xs text-ej-muted mt-1">{hint}</p>}
    </div>
  );
}

export interface TimelineItem {
  title: string;
  timestamp: string;
  description?: string;
}

export function Timeline({ items }: { items: TimelineItem[] }) {
  return (
    <ol className="relative space-y-4 pl-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-px before:bg-ej-border">
      {items.map((item, i) => (
        <li key={i} className="relative">
          <span
            aria-hidden="true"
            className="absolute -left-6 top-1 h-3 w-3 rounded-full bg-ej-primary ring-4 ring-ej-bg"
          />
          <p className="text-base font-semibold text-ej-ink">{item.title}</p>
          <p className="text-xs text-ej-muted mt-0.5">{item.timestamp}</p>
          {item.description && <p className="text-sm text-ej-secondary mt-1">{item.description}</p>}
        </li>
      ))}
    </ol>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-base font-bold text-ej-ink">{title}</h3>
      {action}
    </div>
  );
}
