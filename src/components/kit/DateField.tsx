'use client';

import { useId } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface DateFieldProps
  extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    'className' | 'id' | 'type'
  > {
  /** Field label (localised by the caller). */
  label: ReactNode;
  /** Native picker kind. Defaults to `date`. */
  kind?: 'date' | 'time' | 'datetime-local';
  /** Validation message; sets aria-invalid + aria-describedby. */
  error?: ReactNode;
  /** Helper text under the field. */
  hint?: ReactNode;
  className?: string;
}

/**
 * The one date field (kit CSS `.field` + date input). The kit CSS resets
 * iPhone Safari's date/time inputs and pins them to
 * max-width:100% / min-width:0 / border-box so the picker can never spill
 * out of its card at 390px. Colours from kit tokens only.
 */
export function DateField({
  label,
  kind = 'date',
  error,
  hint,
  className,
  ...rest
}: DateFieldProps) {
  const autoId = useId();
  const id = rest.name ? `${rest.name}-field` : autoId;
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy =
    [error ? errorId : null, hint ? hintId : null]
      .filter(Boolean)
      .join(' ') || undefined;

  return (
    <label
      data-kit="date-field"
      className={cn('field', 'min-w-0', className)}
      htmlFor={id}
    >
      <span>{label}</span>
      <input
        id={id}
        type={kind}
        className="input max-w-full min-w-0 box-border"
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

export default DateField;
