'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { kitButtonClass } from './kit-button';
import type { KitButtonVariant } from './kit-button';

export type ButtonVariant = KitButtonVariant;

export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  variant?: ButtonVariant;
  /** 44px compact variant (mockup `.btn.sm`). */
  sm?: boolean;
  /** Full-width. */
  block?: boolean;
  /** Render as a link styled like a button. */
  href?: string;
  className?: string;
  children: ReactNode;
}

/**
 * The one button (mockup `.btn`): primary (hi-vis lime), secondary
 * (surface + line ring), ghost, danger. Compact `sm` and `block`
 * modifiers. Token utilities only — no hard-coded colours.
 */
export function Button({
  variant = 'primary',
  sm,
  block,
  href,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  const cls = cn(kitButtonClass(variant, { sm, block }), className);
  if (href) {
    return (
      <a data-kit="button" href={href} className={cls}>
        {children}
      </a>
    );
  }
  return (
    <button data-kit="button" type={type} className={cls} {...rest}>
      {children}
    </button>
  );
}

export default Button;
