'use client';

import React from 'react';
import { Search, X } from '@/components/icons';
import { cn } from '@/lib/utils';

export interface SearchFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  onClear?: () => void;
}

/** SearchField — labelled search with clear button. */
export function SearchField({ label, value, onClear, className, ...rest }: SearchFieldProps) {
  return (
    <div className={cn('relative', className)}>
      <label htmlFor={rest.id} className="sr-only">
        {label}
      </label>
      <Search
        size={18}
        aria-hidden="true"
        className="absolute left-3 top-1/2 -translate-y-1/2 text-ej-muted pointer-events-none"
      />
      <input
        type="search"
        className={cn(
          'w-full min-h-[44px] pl-10 pr-10 py-2.5 text-base text-ej-ink',
          'bg-ej-surface border border-ej-border rounded-lg',
          'placeholder:text-ej-muted',
          'focus:outline-none focus:ring-2 focus:ring-ej-focus focus:border-ej-focus'
        )}
        {...rest}
      />
      {value && onClear && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded hover:bg-ej-border/50"
        >
          <X size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

export interface FilterChipProps {
  label: string;
  selected: boolean;
  onClick: () => void;
  count?: number;
}

/** FilterChip — toggle chip for filtering. Selected state is high-contrast. */
export function FilterChip({ label, selected, onClick, count }: FilterChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 min-h-[40px] px-3.5 rounded-full text-sm font-semibold whitespace-nowrap',
        'border transition-colors duration-100',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ej-focus',
        selected
          ? 'bg-ej-primary text-ej-on-primary border-ej-primary'
          : 'bg-ej-bg text-ej-secondary border-ej-border hover:border-ej-secondary'
      )}
    >
      {label}
      {count !== undefined && (
        <span className={cn('tabular-nums', selected ? 'text-ej-on-primary/80' : 'text-ej-muted')}>
          {count}
        </span>
      )}
    </button>
  );
}

export interface TabsProps {
  tabs: { id: string; label: string }[];
  activeId: string;
  onChange: (id: string) => void;
  label: string;
}

/** Tabs — proper tablist semantics with keyboard support. */
export function Tabs({ tabs, activeId, onChange, label }: TabsProps) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 border-b border-ej-border overflow-x-auto">
      {tabs.map((tab) => {
        const isActive = tab.id === activeId;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                const idx = tabs.findIndex((t) => t.id === activeId);
                const next = e.key === 'ArrowRight' ? (idx + 1) % tabs.length : (idx - 1 + tabs.length) % tabs.length;
                onChange(tabs[next].id);
              }
            }}
            className={cn(
              'min-h-[48px] px-4 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ej-focus',
              isActive
                ? 'border-ej-primary text-ej-ink'
                : 'border-transparent text-ej-secondary hover:text-ej-ink'
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export interface ProgressChecklistProps {
  items: { label: string; done: boolean }[];
  title: string;
}

/** ProgressChecklist — computed from real data, "Do later" hides it. */
export function ProgressChecklist({ items, title }: ProgressChecklistProps) {
  const done = items.filter((i) => i.done).length;
  const total = items.length;
  const allDone = done === total;

  if (allDone) return null;

  return (
    <section aria-label={title} className="rounded-xl border border-ej-border bg-ej-surface p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-base font-bold text-ej-ink">{title}</h3>
        <span className="text-sm text-ej-secondary tabular-nums">
          {done} of {total}
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={done}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={`${title} progress`}
        className="h-2 rounded-full bg-ej-border mb-3"
      >
        <div
          className="h-full rounded-full bg-ej-primary transition-all duration-200"
          style={{ width: `${total ? (done / total) * 100 : 0}%` }}
        />
      </div>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-2.5 min-h-[40px] text-sm">
            <span
              aria-hidden="true"
              className={cn(
                'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                item.done ? 'bg-ej-success text-white' : 'border-2 border-ej-border'
              )}
            >
              {item.done ? '✓' : ''}
            </span>
            <span className={cn(item.done ? 'text-ej-muted line-through' : 'text-ej-ink')}>
              {item.label}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
