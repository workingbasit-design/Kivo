'use client';

import { useId } from 'react';
import type { ReactNode, TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface TextareaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'className' | 'id'> {
  /** Field label (localised by the caller). */
  label: ReactNode;
  /** Validation message; sets aria-invalid + aria-describedby. */
  error?: ReactNode;
  /** Helper text under the field. */
  hint?: ReactNode;
  className?: string;
}

/**
 * The one textarea (kit CSS `.field` + textarea): label, auto-growing
 * vertical textarea, optional hint and error. Colours from kit tokens only.
 */
export function Textarea({
  label,
  error,
  hint,
  className,
  ...rest
}: TextareaProps) {
  const autoId = useId();
  const id = rest.name ? `${rest.name}-field` : autoId;
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy =
    [error ? errorId : null, hint ? hintId : null]
      .filter(Boolean)
      .join(' ') || undefined;

  return (
    <label data-kit="textarea" className={cn('field', className)} htmlFor={id}>
      <span>{label}</span>
      <textarea
        id={id}
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

export default Textarea;
