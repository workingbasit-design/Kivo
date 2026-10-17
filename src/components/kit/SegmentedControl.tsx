'use client';

import { cn } from '@/lib/utils';

export interface SegmentedOption {
  id: string;
  label: string;
}

export interface SegmentedControlProps {
  options: SegmentedOption[];
  selectedId: string;
  onSelect: (id: string) => void;
  /** Accessible name for the option group. */
  ariaLabel: string;
}

/**
 * Segmented control: options fill equally, selected option renders on the
 * surface with a border.
 */
export function SegmentedControl({ options, selectedId, onSelect, ariaLabel }: SegmentedControlProps) {
  return (
    <div
      data-kit="segmented-control"
      role="group"
      aria-label={ariaLabel}
      className="mb-3.5 grid auto-cols-[minmax(0,1fr)] grid-flow-col rounded-[14px] bg-surface-2 p-1 shadow-[inset_0_0_0_1px_var(--line)]"
    >
      {options.map((option) => {
        const selected = option.id === selectedId;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onSelect(option.id)}
            aria-selected={selected}
            className={cn(
              'min-h-[42px] rounded-[11px] border-0 bg-transparent text-[15px] font-semibold',
              'focus-visible:outline-2 focus-visible:outline-focus',
              selected
                ? 'bg-surface text-ink shadow-kit-card ring-1 ring-inset ring-line'
                : 'text-ink-2'
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export default SegmentedControl;
