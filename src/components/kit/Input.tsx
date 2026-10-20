'use client';

import { useId } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'id'> {
  /** Field label (localised by the caller). */
  label: ReactNode;
  /** Validation message; sets aria-invalid + aria-describedby. */
  error?: ReactNode;
  /** Helper text under the field. */
  hint?: ReactNode;
  className?: string;
}

/**
 * The one text input (kit CSS `.field` + `.input`): label, 50px input,
 * optional hint and error. Colours come only from the kit tokens.
 */
export function Input({ label, error, hint, className, ...rest }: InputProps) {
  const autoId = useId();
  const id = rest.name ? `${rest.name}-field` : autoId;
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy =
    [error ? errorId : null, hint ? hintId : null]
      .filter(Boolean)
      .join(' ') || undefined;

  return (
    <label data-kit="input" className={cn('field', className)} htmlFor={id}>
      <span>{label}</span>
      <input
        id={id}
        className="input"
        aria-invalid={error != null || undefined}
        aria-describedby={describedBy}
        {...rest}
      />
      {error != null ? (
        <span id={errorId} className="err" role="alert">
          {error}
        </span>
      ) : null}
      {hint != null ? <small id={hintId}>{hint}</small> : null}
    </label>
  );
}

export default Input;
