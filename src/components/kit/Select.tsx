'use client';

import { useId } from 'react';
import type { ReactNode, SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface SelectOption {
  value: string;
  label: ReactNode;
  disabled?: boolean;
}

export interface SelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'className' | 'id'> {
  /** Field label (localised by the caller). */
  label: ReactNode;
  options: SelectOption[];
  /** Validation message; sets aria-invalid + aria-describedby. */
  error?: ReactNode;
  /** Helper text under the field. */
  hint?: ReactNode;
  className?: string;
}

/**
 * The one select (kit CSS `.field` + `.select`): label, native select
 * with the kit chevron, optional hint and error. Colours from kit tokens only.
 */
export function Select({
  label,
  options,
  error,
  hint,
  className,
  children,
  ...rest
}: SelectProps) {
  const autoId = useId();
  const id = rest.name ? `${rest.name}-field` : autoId;
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy =
    [error ? errorId : null, hint ? hintId : null]
      .filter(Boolean)
      .join(' ') || undefined;

  return (
    <label data-kit="select" className={cn('field', className)} htmlFor={id}>
      <span>{label}</span>
      <span className="select">
        <select
          id={id}
          aria-invalid={error != null || undefined}
          aria-describedby={describedBy}
          {...rest}
        >
          {options.map((option) => (
            <option
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </option>
          ))}
          {children}
        </select>
      </span>
      {error != null ? (
        <span id={errorId} className="err" role="alert">
          {error}
        </span>
      ) : null}
      {hint != null ? <small id={hintId}>{hint}</small> : null}
    </label>
  );
}

export default Select;
