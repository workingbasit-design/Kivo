'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, Check } from '@/components/icons';

/**
 * MorphSelect - the trigger button physically expands into the dropdown
 * via a shared-element layout transition, instead of a disconnected popover.
 */
export default function MorphSelect<T extends string>({
  options,
  value,
  onChange,
  label,
  id,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label?: string;
  id: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, []);

  return (
    <div ref={ref} className="relative inline-block">
      {label && (
        <span className="text-xs font-semibold text-zinc-500 mb-1 block">{label}</span>
      )}
      <motion.button
        type="button"
        layoutId={`morph-select-${id}`}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="min-h-[44px] px-4 rounded-xl border border-zinc-200 bg-white text-sm font-semibold text-zinc-800 inline-flex items-center gap-2 shadow-sm"
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      >
        {selected?.label ?? value}
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={16} />
        </motion.span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 500, damping: 32 }}
            className="absolute z-50 mt-2 min-w-full w-max max-w-[280px] rounded-2xl border border-zinc-200 bg-white shadow-[0_16px_40px_rgba(22,22,22,0.15)] p-1.5 origin-top"
            role="listbox"
          >
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={opt.value === value}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium flex items-center justify-between gap-2 min-h-[44px] transition-colors ${
                  opt.value === value
                    ? 'bg-lime/20 text-ink'
                    : 'text-zinc-700 hover:bg-zinc-100'
                }`}
              >
                {opt.label}
                {opt.value === value && <Check size={16} className="text-ink" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
