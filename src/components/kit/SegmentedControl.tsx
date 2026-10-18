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
 * Segmented control (mockup `.segl`): options fill equally in a static
 * grid — BOTH labels are always visible (no sliding pill to hide one).
 * The selected option gets the hi-vis lime treatment (bg-hivis +
 * hivis-ink text), which is identical in light and dark mode, so the
 * selected option is always clearly readable. Every option is a 44px
 * touch target.
 */
export function SegmentedControl({ options, selectedId, onSelect, ariaLabel }: SegmentedControlProps) {
  return (
    <div
      data-kit="segmented-control"
      role="group"
      aria-label={ariaLabel}
      className="mb-[18px] grid auto-cols-[minmax(0,1fr)] grid-flow-col rounded-[14px] bg-surface-2 p-1 shadow-[inset_0_0_0_1px_var(--line)]"
    >
      {options.map((option) => {
        const selected = option.id === selectedId;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onSelect(option.id)}
            aria-pressed={selected}
            className={cn(
              'min-h-[44px] min-w-0 rounded-[11px] border-0 bg-transparent px-2 text-[15px] font-semibold',
              'focus-visible:outline-2 focus-visible:outline-focus',
              selected
                ? 'bg-hivis text-hivis-ink shadow-kit-card'
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
