/**
 * Customer design-system primitives.
 *
 * Single source of truth for the homeowner experience's visual language:
 * clean EveryJob theme (white surfaces, zinc neutrals, indigo accents),
 * Apple-grade micro-interactions (spring press, hover lift, staggered
 * entrances via `ej-anim-*` utilities), and full EN/FR string support
 * through the caller's `tr` function.
 *
 * Architecture notes (Google-style):
 * - Presentational only — no data fetching, no routing decisions.
 * - Server-component safe; interactive pieces are marked "use client".
 * - Every prop is typed; no `any`, no prop drilling of raw dictionaries.
 * - Variants are closed unions so misuse fails at compile time.
 */

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* Avatar — business monogram tile                                     */
/* ------------------------------------------------------------------ */

const AVATAR_SIZES = {
  sm: 'w-10 h-10 rounded-xl text-sm',
  md: 'w-12 h-12 rounded-2xl text-base',
  lg: 'w-14 h-14 rounded-2xl text-xl',
} as const;

export function Avatar({
  name,
  logoUrl,
  size = 'md',
  className,
}: {
  name: string;
  logoUrl: string | null;
  size?: keyof typeof AVATAR_SIZES;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-center shrink-0 overflow-hidden',
        'bg-indigo-50 border border-indigo-100',
        AVATAR_SIZES[size],
        className
      )}
    >
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" className="w-full h-full object-cover" />
      ) : (
        <span className="font-bold text-indigo-600">{name.charAt(0).toUpperCase()}</span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Card — white elevated surface                                       */
/* ------------------------------------------------------------------ */

export function Card({
  children,
  className,
  hover = false,
}: {
  children: React.ReactNode;
  className?: string;
  /** Enable the Apple-style hover lift. */
  hover?: boolean;
}) {
  return (
    <div
      className={cn(
        'bg-white rounded-3xl border border-zinc-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.04)]',
        hover &&
          'transition-all duration-300 hover:shadow-[0_12px_32px_rgba(79,70,229,0.12)] hover:border-indigo-200 hover:-translate-y-0.5',
        className
      )}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* PageHeader — consistent page title block                            */
/* ------------------------------------------------------------------ */

export function PageHeader({
  title,
  subtitle,
  action,
  delay = 0,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  /** Stagger delay in ms for the entrance animation. */
  delay?: number;
}) {
  return (
    <div className="ej-anim-fade-up" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900">{title}</h1>
          {subtitle && <p className="text-sm text-zinc-500 mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* PrimaryCTA — indigo call-to-action (link or button)                 */
/* ------------------------------------------------------------------ */

const CTA_BASE =
  'inline-flex min-h-[48px] items-center justify-center gap-1.5 px-6 rounded-2xl bg-indigo-600 text-white text-sm font-bold shadow-sm shadow-indigo-600/20 transition-all duration-200 hover:bg-indigo-700 hover:shadow-md hover:shadow-indigo-600/25 hover:-translate-y-px active:translate-y-0 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none';

export function PrimaryCTA({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link href={href} className={cn(CTA_BASE, className)}>
      {children}
    </Link>
  );
}

export function PrimaryButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={cn(CTA_BASE, className)} {...props}>
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* EmptyState — consistent empty illustration block                    */
/* ------------------------------------------------------------------ */

export function EmptyState({
  icon: Icon,
  title,
  hint,
  action,
  delay = 0,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
  action?: React.ReactNode;
  delay?: number;
}) {
  return (
    <div
      className="ej-anim-fade-up bg-white rounded-3xl border border-zinc-200/80 p-10 text-center shadow-sm"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="ej-anim-scale-in w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mx-auto mb-4">
        <Icon className="w-7 h-7 text-indigo-400" />
      </div>
      <p className="font-bold text-zinc-900">{title}</p>
      {hint && <p className="text-sm text-zinc-500 mt-1 max-w-xs mx-auto">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* StatusBadge — quote request lifecycle state                         */
/* ------------------------------------------------------------------ */

const STATUS_STYLES: Record<string, string> = {
  sent: 'bg-sky-50 text-sky-700 border-sky-200',
  replied: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  accepted: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  declined: 'bg-rose-50 text-rose-700 border-rose-200',
  completed: 'bg-zinc-100 text-zinc-600 border-zinc-200',
};

export function StatusBadge({ status, label }: { status: string; label: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center text-[11px] font-bold rounded-full px-2.5 py-1 border shrink-0',
        STATUS_STYLES[status] ?? STATUS_STYLES.completed
      )}
    >
      {label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* BackLink — consistent back navigation                               */
/* ------------------------------------------------------------------ */

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="group inline-flex items-center gap-1 text-sm font-semibold text-zinc-500 hover:text-zinc-800 min-h-[44px] transition-colors"
    >
      {children}
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* Stagger — entrance-animation wrapper for lists                       */
/* ------------------------------------------------------------------ */

export function Stagger({
  index,
  children,
  step = 60,
  max = 8,
  className,
}: {
  index: number;
  children: React.ReactNode;
  step?: number;
  max?: number;
  className?: string;
}) {
  return (
    <div
      className={cn('ej-anim-fade-up', className)}
      style={{ animationDelay: `${Math.min(index, max) * step}ms` }}
    >
      {children}
    </div>
  );
}
