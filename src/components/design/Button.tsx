'use client';

import React from 'react';
import { Loader2 } from '@/components/icons';
import { cn } from '@/lib/utils';

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'destructive';
export type ButtonSize = 'md' | 'lg';

const variantClasses: Record<ButtonVariant, string> = {
  // Black on light per DESIGN.md §3. One primary action per screen.
  primary: 'bg-ej-primary text-ej-on-primary hover:bg-asphalt/85 active:bg-asphalt/90',
  secondary: 'bg-ej-surface text-ej-ink border border-ej-border hover:bg-ej-border/50 active:bg-ej-border',
  tertiary: 'bg-transparent text-ej-ink hover:bg-ej-surface active:bg-ej-border/50',
  destructive: 'bg-ej-danger text-white hover:bg-ej-danger/90 active:bg-ej-danger/95',
};

const sizeClasses: Record<ButtonSize, string> = {
  md: 'min-h-[44px] px-4 py-2.5 text-sm',
  lg: 'min-h-[52px] px-6 py-3.5 text-base',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

/**
 * Button — the single primary action is black on light (lime only on dark surfaces).
 * Loading keeps the label (spinner replaces the icon slot). 44px min hit area.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className,
  children,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <button
      type="button"
      disabled={isDisabled}
      aria-disabled={isDisabled}
      aria-busy={loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-semibold',
        'transition-colors duration-100',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ej-focus',
        'disabled:cursor-not-allowed disabled:opacity-50',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...rest}
    >
      {loading && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string; // accessible name — required
  size?: ButtonSize;
}

/** IconButton — always has an accessible name. 44px min hit area. */
export function IconButton({ label, size = 'md', className, children, ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        'inline-flex items-center justify-center rounded-lg text-ej-ink',
        'hover:bg-ej-surface active:bg-ej-border/50',
        'transition-colors duration-100',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ej-focus',
        'disabled:cursor-not-allowed disabled:opacity-50',
        size === 'md' ? 'min-h-[44px] min-w-[44px]' : 'min-h-[52px] min-w-[52px]',
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: 'default' | 'subtle';
}

/** Link — plain text link, no arrow appended (DESIGN.md §11). */
export function Link({ variant = 'default', className, children, ...rest }: LinkProps) {
  return (
    <a
      className={cn(
        'font-semibold underline-offset-2 hover:underline',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ej-focus rounded',
        variant === 'default' ? 'text-ej-ink' : 'text-ej-secondary',
        className
      )}
      {...rest}
    >
      {children}
    </a>
  );
}
