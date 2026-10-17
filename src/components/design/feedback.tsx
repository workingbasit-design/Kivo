'use client';

import React from 'react';
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from '@/components/icons';
import { cn } from '@/lib/utils';

export type BannerTone = 'info' | 'success' | 'warning' | 'error';

const bannerConfig: Record<BannerTone, { icon: React.ReactNode; classes: string }> = {
  info: { icon: <Info size={18} aria-hidden="true" />, classes: 'bg-ej-info-bg text-ej-info border-ej-info/20' },
  success: { icon: <CheckCircle2 size={18} aria-hidden="true" />, classes: 'bg-ej-success-bg text-ej-success border-ej-success/20' },
  warning: { icon: <AlertTriangle size={18} aria-hidden="true" />, classes: 'bg-ej-warning-bg text-ej-warning border-ej-warning/20' },
  error: { icon: <AlertCircle size={18} aria-hidden="true" />, classes: 'bg-ej-danger-bg text-ej-danger border-ej-danger/20' },
};

export interface BannerProps {
  tone: BannerTone;
  title: string;
  message?: string;
  action?: React.ReactNode;
  onDismiss?: () => void;
  className?: string;
}

/** Banner — icon + text (never colour alone). Optional action and dismiss. */
export function Banner({ tone, title, message, action, onDismiss, className }: BannerProps) {
  const config = bannerConfig[tone];
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('flex items-start gap-3 rounded-lg border p-4', config.classes, className)}
    >
      <span className="shrink-0 mt-0.5">{config.icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">{title}</p>
        {message && <p className="text-sm mt-1 opacity-90">{message}</p>}
        {action && <div className="mt-2">{action}</div>}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="shrink-0 min-h-[32px] min-w-[32px] inline-flex items-center justify-center rounded hover:bg-asphalt/5 focus-visible:outline-2 focus-visible:outline-ej-focus"
        >
          <X size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

export interface ToastProps {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
}

/**
 * Toast — announced to screen readers (role=status). Optional Undo action.
 * Parent controls visibility and auto-dismiss timing.
 */
export function Toast({ message, actionLabel, onAction, onDismiss }: ToastProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-3 bg-ej-ink text-white rounded-lg px-4 py-3 shadow-lg min-h-[48px]"
    >
      <span className="flex-1 text-sm font-medium">{message}</span>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="shrink-0 text-sm font-semibold text-ej-accent hover:underline focus-visible:outline-2 focus-visible:outline-ej-accent rounded px-1 min-h-[32px]"
        >
          {actionLabel}
        </button>
      )}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss notification"
          className="shrink-0 min-h-[32px] min-w-[32px] inline-flex items-center justify-center rounded hover:bg-surface/10"
        >
          <X size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  compact?: boolean;
}

/** EmptyState — says what goes here, offers one action. */
export function EmptyState({ icon, title, description, action, compact = false }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center', compact ? 'p-6' : 'p-12')}>
      {icon && (
        <span
          aria-hidden="true"
          className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-ej-surface text-ej-muted mb-4"
        >
          {icon}
        </span>
      )}
      <h3 className="text-base font-bold text-ej-ink mb-1">{title}</h3>
      {description && <p className="text-sm text-ej-secondary max-w-sm mb-6">{description}</p>}
      {action}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-md bg-ej-border/60', className)}
    />
  );
}

/** OfflineIndicator — clear banner when offline. */
export function OfflineIndicator() {
  return (
    <div
      role="alert"
      className="flex items-center justify-center gap-2 bg-ej-warning-bg text-ej-warning text-sm font-semibold px-4 py-2"
    >
      <AlertTriangle size={16} aria-hidden="true" />
      You are offline. Changes will be saved when you reconnect.
    </div>
  );
}
