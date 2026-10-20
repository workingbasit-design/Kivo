'use client';

import { motion } from 'motion/react';

/**
 * MorphChips - filter chips with fluid shared-element transitions.
 * The selection highlight glides between chips via layoutId; the check
 * grows in and neighbors shift smoothly. Overflow folds behind "+N more".
 */
export default function MorphChips<T extends string | number>({
  options,
  value,
  onChange,
  groupId,
  format,
  maxVisible = 6,
  tone = 'light',
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  /** Unique per chip group (for layoutId scoping) */
  groupId: string;
  format?: (v: T) => string;
  maxVisible?: number;
  /** 'light' for light backgrounds, 'dark' for dark backgrounds */
  tone?: 'light' | 'dark';
}) {
  const visible = options.slice(0, maxVisible);
  const hidden = options.slice(maxVisible);
  const hiddenSelected = hidden.includes(value);
  const dark = tone === 'dark';

  return (
    <div className="flex flex-wrap items-center gap-2" role="radiogroup">
      {visible.map((opt) => {
        const selected = opt === value;
        const label = format ? format(opt) : String(opt);
        return (
          <button
            key={String(opt)}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt)}
            className={`relative min-h-[44px] px-4 rounded-full text-sm font-semibold transition-colors duration-200 ${
              selected
                ? 'text-ink'
                : dark
                  ? 'text-hero-ink hover:text-hero-ink'
                  : 'text-ink-2 hover:text-ink'
            }`}
          >
            {selected && (
              <motion.span
                layoutId={`morph-chip-${groupId}`}
                className="absolute inset-0 rounded-full bg-lime shadow-[0_2px_8px] shadow-hivis/40"
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            )}
            {!selected && (
              <span
                className={`absolute inset-0 rounded-full border ${
                  dark ? 'border-hero-ink/30 bg-surface/10' : 'border-line bg-surface'
                }`}
              />
            )}
            <span className="relative flex items-center gap-1.5">
              {selected && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 600, damping: 25 }}
                  aria-hidden
                >
                  ✓
                </motion.span>
              )}
              {label}
            </span>
          </button>
        );
      })}
      {hidden.length > 0 && (
        <span className={`text-xs font-semibold px-2 ${dark ? 'text-hero-ink/60' : 'text-ink-2'}`}>
          +{hidden.length} more{hiddenSelected ? ' (selected)' : ''}
        </span>
      )}
    </div>
  );
}
