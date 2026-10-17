'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  hint?: string;
}

/** Checkbox — 44px hit area, visible label. */
export function Checkbox({ label, hint, className, ...rest }: CheckboxProps) {
  return (
    <label className={cn('flex items-start gap-3 min-h-[44px] py-2 cursor-pointer', className)}>
      <input
        type="checkbox"
        className="mt-0.5 h-5 w-5 shrink-0 rounded border-ej-border accent-ej-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ej-focus"
        {...rest}
      />
      <span>
        <span className="block text-base text-ej-ink">{label}</span>
        {hint && <span className="block text-sm text-ej-muted mt-0.5">{hint}</span>}
      </span>
    </label>
  );
}

export interface RadioProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  hint?: string;
  name: string;
}

/** Radio — 44px hit area, grouped by name. */
export function Radio({ label, hint, className, ...rest }: RadioProps) {
  return (
    <label className={cn('flex items-start gap-3 min-h-[44px] py-2 cursor-pointer', className)}>
      <input
        type="radio"
        className="mt-1 h-5 w-5 shrink-0 border-ej-border accent-ej-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ej-focus"
        {...rest}
      />
      <span>
        <span className="block text-base text-ej-ink">{label}</span>
        {hint && <span className="block text-sm text-ej-muted mt-0.5">{hint}</span>}
      </span>
    </label>
  );
}

export interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  hint?: string;
}

/** Switch — pill shape means toggle (DESIGN.md §7). 44px hit area. */
export function Switch({ label, hint, checked, className, ...rest }: SwitchProps) {
  return (
    <label className={cn('flex items-center justify-between gap-3 min-h-[44px] py-2 cursor-pointer', className)}>
      <span>
        <span className="block text-base text-ej-ink">{label}</span>
        {hint && <span className="block text-sm text-ej-muted mt-0.5">{hint}</span>}
      </span>
      <input
        type="checkbox"
        role="switch"
        aria-checked={checked}
        checked={checked}
        className={cn(
          'relative h-7 w-12 shrink-0 appearance-none rounded-full bg-ej-border transition-colors duration-100',
          'checked:bg-ej-primary',
          'before:absolute before:top-0.5 before:left-0.5 before:h-6 before:w-6 before:rounded-full before:bg-white before:transition-transform before:duration-100',
          'checked:before:translate-x-5',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ej-focus',
          'disabled:opacity-50 disabled:cursor-not-allowed'
        )}
        {...rest}
      />
    </label>
  );
}

export interface SegmentedControlProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}

/** SegmentedControl — for 2-4 mutually exclusive options. */
export function SegmentedControl<T extends string>({ options, value, onChange, label }: SegmentedControlProps<T>) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-lg bg-ej-surface border border-ej-border p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'min-h-[40px] px-4 text-sm font-semibold rounded-md transition-colors duration-100',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ej-focus',
            value === o.value
              ? 'bg-ej-primary text-ej-on-primary'
              : 'text-ej-secondary hover:text-ej-ink'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
