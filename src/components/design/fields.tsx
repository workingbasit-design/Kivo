'use client';

import React, { useId } from 'react';
import { cn } from '@/lib/utils';

interface FieldWrapperProps {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}

/**
 * FieldWrapper — visible label (never placeholder-as-label), helper/error slots
 * linked via aria-describedby. Error never shifts layout (min-height reserved).
 */
export function FieldWrapper({ label, hint, error, required, children, className }: FieldWrapperProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('w-full', className)}>
      <label htmlFor={id} className="block text-sm font-semibold text-ej-ink mb-1.5">
        {label}
        {required && (
          <span className="text-ej-danger ml-1" aria-hidden="true">*</span>
        )}
      </label>
      {React.cloneElement(children as React.ReactElement, {
        id,
        'aria-describedby': describedBy,
        'aria-invalid': !!error,
        'aria-required': required,
      } as any)}
      <div className="min-h-[20px] mt-1">
        {error ? (
          <p id={errorId} className="text-sm text-ej-danger" role="alert">
            {error}
          </p>
        ) : hint ? (
          <p id={hintId} className="text-sm text-ej-muted">
            {hint}
          </p>
        ) : null}
      </div>
    </div>
  );
}

const baseInputClass =
  'w-full min-h-[44px] px-3 py-2.5 text-base text-ej-ink bg-ej-bg border border-ej-border rounded-lg ' +
  'placeholder:text-ej-muted ' +
  'focus:outline-none focus:ring-2 focus:ring-ej-focus focus:border-ej-focus ' +
  'disabled:bg-ej-surface disabled:text-ej-disabled disabled:cursor-not-allowed ' +
  'aria-[invalid=true]:border-ej-danger aria-[invalid=true]:focus:ring-ej-danger';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
}

/** Input — 16px min (no iOS zoom), visible label, helper/error slots. */
export function Input({ label, hint, error, required, className, ...rest }: InputProps) {
  return (
    <FieldWrapper label={label} hint={hint} error={error} required={required} className={className}>
      <input className={baseInputClass} {...rest} />
    </FieldWrapper>
  );
}

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: string;
  error?: string;
}

/** Textarea — same rules as Input. */
export function Textarea({ label, hint, error, required, className, ...rest }: TextareaProps) {
  return (
    <FieldWrapper label={label} hint={hint} error={error} required={required} className={className}>
      <textarea className={cn(baseInputClass, 'min-h-[88px] resize-y')} {...rest} />
    </FieldWrapper>
  );
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  hint?: string;
  error?: string;
  options: { value: string; label: string }[];
}

/** Select — native select (accessible, works everywhere). */
export function Select({ label, hint, error, required, options, className, ...rest }: SelectProps) {
  return (
    <FieldWrapper label={label} hint={hint} error={error} required={required} className={className}>
      <select className={cn(baseInputClass, 'pr-8')} {...rest}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldWrapper>
  );
}

export interface DateFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  hint?: string;
  error?: string;
}

/** DateField — native date picker on phones (best mobile UX). */
export function DateField({ label, hint, error, required, className, ...rest }: DateFieldProps) {
  return (
    <FieldWrapper label={label} hint={hint} error={error} required={required} className={className}>
      <input type="date" className={baseInputClass} {...rest} />
    </FieldWrapper>
  );
}

export interface TimeFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  hint?: string;
  error?: string;
}

/** TimeField — native time picker on phones. */
export function TimeField({ label, hint, error, required, className, ...rest }: TimeFieldProps) {
  return (
    <FieldWrapper label={label} hint={hint} error={error} required={required} className={className}>
      <input type="time" className={baseInputClass} {...rest} />
    </FieldWrapper>
  );
}

export interface MoneyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'inputMode'> {
  label: string;
  hint?: string;
  error?: string;
  currency?: string;
}

/**
 * MoneyInput — $ prefix, decimal keyboard, tabular figures.
 * Value is a plain number string (dollars); parent converts to cents.
 */
export function MoneyInput({ label, hint, error, required, currency = '$', className, ...rest }: MoneyInputProps) {
  return (
    <FieldWrapper label={label} hint={hint} error={error} required={required} className={className}>
      <div className="relative">
        <span
          aria-hidden="true"
          className="absolute left-3 top-1/2 -translate-y-1/2 text-base text-ej-secondary pointer-events-none"
        >
          {currency}
        </span>
        <input
          type="text"
          inputMode="decimal"
          autoComplete="off"
          className={cn(baseInputClass, 'pl-7 tabular-nums')}
          {...rest}
        />
      </div>
    </FieldWrapper>
  );
}

export interface PhoneInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  hint?: string;
  error?: string;
}

/** PhoneInput — tel keyboard, Canadian formatting hint. */
export function PhoneInput({ label, hint, error, required, className, ...rest }: PhoneInputProps) {
  return (
    <FieldWrapper
      label={label}
      hint={hint ?? 'Format: (416) 555-0100'}
      error={error}
      required={required}
      className={className}
    >
      <input
        type="tel"
        autoComplete="tel"
        className={baseInputClass}
        {...rest}
      />
    </FieldWrapper>
  );
}
