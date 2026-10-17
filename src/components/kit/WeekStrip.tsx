'use client';

import { cn } from '@/lib/utils';

export interface WeekStripDay {
  key: string;
  /** Single day letter, e.g. "S". */
  dow: string;
  dayNum: number;
  /** Full label for the aria-label, e.g. "Saturday, October 17". */
  label: string;
  visitCount: number;
  isToday: boolean;
}

export interface WeekStripProps {
  days: WeekStripDay[];
  selectedKey: string;
  onSelect: (key: string) => void;
}

const MAX_DOTS = 3;

/**
 * 7-day strip mirroring the mockup's `.week`/`.day`.
 * Today gets a lime underline; the selected day is inverted.
 */
export function WeekStrip({ days, selectedKey, onSelect }: WeekStripProps) {
  return (
    <div
      data-kit="week-strip"
      role="group"
      className="grid grid-cols-[repeat(7,minmax(0,1fr))] gap-[5px]"
    >
      {days.map((day) => {
        const selected = day.key === selectedKey;
        return (
          <button
            key={day.key}
            type="button"
            aria-label={day.label}
            aria-selected={selected}
            onClick={() => onSelect(day.key)}
            className={cn(
              'flex min-h-[74px] min-w-[44px] flex-col items-center gap-[3px] rounded-[14px] border px-0 py-2',
              'border-line bg-surface text-ink',
              'focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2',
              selected && 'border-ink bg-ink text-surface',
            )}
          >
            <span
              className={cn(
                'text-[12px] font-semibold text-ink-2',
                selected && 'text-surface opacity-75',
              )}
            >
              {day.dow}
            </span>
            <span
              className={cn(
                'num px-[3px] text-[22px] leading-[1.05] font-bold',
                day.isToday && 'shadow-[inset_0_-3px_0_var(--hivis)]',
              )}
            >
              {day.dayNum}
            </span>
            <span className="flex min-h-[6px] gap-[3px]" aria-hidden="true">
              {Array.from({ length: Math.min(day.visitCount, MAX_DOTS) }).map(
                (_, i) => (
                  <i
                    key={i}
                    className={cn(
                      'h-[5px] w-[5px] rounded-full bg-ink-2',
                      selected && 'bg-surface',
                    )}
                  />
                ),
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
