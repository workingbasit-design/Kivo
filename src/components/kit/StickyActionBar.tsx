'use client';

import { cn } from '@/lib/utils';
import { formatCAD } from './money';
import { kitButtonClass } from './kit-button';

export interface StickyActionBarProps {
  totalLabel?: string;
  totalCents?: number;
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}

/**
 * Fixed bottom action bar (detail screens), mirroring the mockup's `.actionbar`.
 * Safe-area padding included; renders one or two buttons plus an optional total row.
 */
export function StickyActionBar({
  totalLabel,
  totalCents,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
}: StickyActionBarProps) {
  const showTotal = totalLabel != null || totalCents != null;
  return (
    <div
      data-kit="sticky-action-bar"
      className="fixed inset-x-0 bottom-0 z-[25] border-t border-line bg-surface px-4 pt-2.5 pb-[calc(10px+env(safe-area-inset-bottom,0px))]"
    >
      <div
        className={cn(
          'mx-auto grid max-w-[448px] gap-2.5',
          secondaryLabel != null &&
            'grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]',
        )}
      >
        {showTotal ? (
          <div className="flex items-baseline justify-between text-[15px] text-ink-2">
            <span>{totalLabel}</span>
            {totalCents != null ? (
              <span className="num text-2xl font-bold text-ink">
                {formatCAD(totalCents)}
              </span>
            ) : null}
          </div>
        ) : null}
        {secondaryLabel != null ? (
          <button
            type="button"
            className={kitButtonClass('secondary', { block: true })}
            onClick={onSecondary}
          >
            {secondaryLabel}
          </button>
        ) : null}
        <button
          type="button"
          className={kitButtonClass('primary', { block: true })}
          onClick={onPrimary}
        >
          {primaryLabel}
        </button>
      </div>
    </div>
  );
}
