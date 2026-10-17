'use client';

import { cn } from '@/lib/utils';

export interface FilterChip {
  id: string;
  label: string;
  count?: number | string;
  /** Danger tone renders the count in `text-danger`. */
  tone?: 'default' | 'danger';
}

export interface FilterChipsProps {
  chips: FilterChip[];
  selectedId: string;
  onSelect: (id: string) => void;
  /** Accessible name for the chip group. */
  ariaLabel: string;
}

const FADE_MASK = {
  WebkitMaskImage: 'linear-gradient(to right, black calc(100% - 28px), transparent)',
  maskImage: 'linear-gradient(to right, black calc(100% - 28px), transparent)',
} as const;

/**
 * Horizontally scrolling filter-chip row with a fade at the right edge
 * (CSS mask, like the mockup). Selected chip: `bg-ink text-surface`.
 * Counts render in `text-ink-2`, or `text-danger` for the danger tone.
 */
export function FilterChips({ chips, selectedId, onSelect, ariaLabel }: FilterChipsProps) {
  return (
    <div
      data-kit="filter-chips"
      role="group"
      aria-label={ariaLabel}
      style={FADE_MASK}
      className="mb-1 flex gap-2 overflow-x-auto px-4 py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {chips.map((chip) => {
        const selected = chip.id === selectedId;
        return (
          <button
            key={chip.id}
            type="button"
            onClick={() => onSelect(chip.id)}
            aria-pressed={selected}
            className={cn(
              'inline-flex min-h-[44px] flex-none items-center gap-2 rounded-full border px-3.5 text-[15px] font-semibold',
              'focus-visible:outline-2 focus-visible:outline-focus',
              selected
                ? 'border-ink bg-ink text-surface'
                : 'border-line bg-surface text-ink'
            )}
          >
            {chip.label}
            {chip.count != null && (
              <span
                className={cn(
                  'text-[14px] tabular-nums',
                  selected
                    ? 'text-surface opacity-80'
                    : chip.tone === 'danger'
                      ? 'font-bold text-danger'
                      : 'text-ink-2'
                )}
              >
                {chip.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default FilterChips;
