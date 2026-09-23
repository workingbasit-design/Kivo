import React from 'react';
import { cn, statusClasses } from '@/lib/utils';
import { t, type Locale } from '@/lib/i18n';

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-zinc-900 tracking-tight">{title}</h1>
        {subtitle && <p className="text-zinc-500 mt-1 text-sm">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={cn('bg-white rounded-2xl border border-zinc-200/60 shadow-sm', className)} style={style}>
      {children}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'inline-flex px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border whitespace-nowrap',
        statusClasses(status)
      )}
    >
      {status}
    </span>
  );
}

export function StatCard({
  label,
  value,
  sub,
  icon,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: React.ReactNode;
  accent?: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-zinc-200/60 shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">{label}</p>
        {icon && (
          <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center', accent ?? 'bg-zinc-100 text-zinc-600')}>
            {icon}
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-zinc-900 tracking-tight">{value}</p>
      {sub && <p className="text-xs text-zinc-500 mt-1">{sub}</p>}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center p-12 md:p-16 text-center">
      <div className="w-14 h-14 rounded-2xl bg-zinc-100 text-zinc-400 flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="text-base font-bold text-zinc-900 mb-1">{title}</h3>
      <p className="text-sm text-zinc-500 max-w-sm mb-6">{description}</p>
      {action}
    </div>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-zinc-700 mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-zinc-400 mt-1">{hint}</p>}
    </div>
  );
}

export const inputClass =
  'w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-zinc-200 bg-zinc-50 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:border-ink';

export const textareaClass =
  'w-full min-h-[88px] px-4 py-2.5 rounded-xl border border-zinc-200 bg-zinc-50 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:border-ink';

export const selectClass =
  'w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-zinc-200 bg-zinc-50 text-sm text-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:border-ink';

export const checkboxClass =
  'w-5 h-5 rounded-md border-zinc-300 accent-[#161616] focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2';

export const primaryBtnClass =
  'bg-ink hover:bg-graphite active:bg-ink text-white min-h-[44px] px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors inline-flex items-center justify-center gap-2 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/50 focus-visible:ring-offset-2';

export const secondaryBtnClass =
  'bg-white hover:bg-zinc-50 active:bg-zinc-100 text-zinc-700 min-h-[44px] px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors inline-flex items-center justify-center gap-2 border border-zinc-200 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2';

export const dangerBtnClass =
  'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white min-h-[44px] px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors inline-flex items-center justify-center gap-2 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/60 focus-visible:ring-offset-2';

export const ghostBtnClass =
  'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 active:bg-zinc-200 min-h-[44px] min-w-[44px] px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2';

export const limeBtnClass =
  'bg-lime hover:brightness-105 active:brightness-95 text-ink min-h-[44px] px-5 py-2.5 rounded-xl font-semibold text-sm transition-all inline-flex items-center justify-center gap-2 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/60 focus-visible:ring-offset-2';

/* ---------- Loading skeletons (never blank screens) ---------- */

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('ej-skeleton rounded-lg', className)} />;
}

export function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="bg-white rounded-2xl border border-zinc-200/60 shadow-sm p-5 space-y-3" aria-hidden>
      <Skeleton className="h-5 w-1/3" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-4 w-full" />
      ))}
    </div>
  );
}

/* ---------- Badges & progress ---------- */

type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'lime';

const badgeTones: Record<BadgeTone, string> = {
  neutral: 'bg-zinc-100 text-zinc-700 border-zinc-200',
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warning: 'bg-amber-50 text-amber-800 border-amber-200',
  danger: 'bg-rose-50 text-rose-700 border-rose-200',
  info: 'bg-sky-50 text-sky-700 border-sky-200',
  lime: 'bg-lime/25 text-ink border-lime/60',
};

export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: BadgeTone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border whitespace-nowrap',
        badgeTones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function ProgressBar({
  value,
  max = 100,
  label,
  className,
}: {
  value: number;
  max?: number;
  label?: string;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={className}>
      {label && (
        <div className="flex justify-between text-[11px] font-semibold text-zinc-500 mb-1.5">
          <span>{label}</span>
          <span>{Math.round(pct)}%</span>
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-2 rounded-full bg-zinc-100 overflow-hidden"
      >
        <div className="h-full rounded-full bg-ink transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* ---------- List rows (tables become cards on mobile) ---------- */

export function ListRow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'bg-white rounded-2xl border border-zinc-200/60 shadow-sm p-4 flex items-center gap-3',
        className
      )}
    >
      {children}
    </div>
  );
}

/* ---------- Section titles & form layout ---------- */

export function SectionTitle({
  children,
  action,
  className,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center justify-between gap-3 mb-3', className)}>
      <h2 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">{children}</h2>
      {action}
    </div>
  );
}

export function FormGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('grid grid-cols-1 sm:grid-cols-2 gap-4', className)}>{children}</div>;
}

/* ---------- Segmented control (accessible radio group) ---------- */

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex p-1 rounded-xl bg-zinc-100 gap-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'min-h-[40px] px-4 rounded-lg text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/50',
              active ? 'bg-white text-ink shadow-sm' : 'text-zinc-500 hover:text-zinc-800'
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Avatar ---------- */

export function Avatar({ name, className }: { name: string; className?: string }) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <div
      aria-hidden
      className={cn(
        'w-10 h-10 rounded-full bg-ink text-lime flex items-center justify-center text-xs font-bold shrink-0',
        className
      )}
    >
      {initials}
    </div>
  );
}

/* ---------- Accessible dialog ---------- */

export function Dialog({
  open,
  onClose,
  title,
  children,
  labelledBy,
  locale = 'en',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  labelledBy?: string;
  locale?: Locale;
}) {
  const titleId = React.useId();
  const labelled = labelledBy ?? titleId;
  const panelRef = React.useRef<HTMLDivElement>(null);
  const prevFocus = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    prevFocus.current = document.activeElement as HTMLElement | null;
    // Move keyboard focus into the dialog; the panel is the fallback when
    // the dialog has no form fields of its own.
    const target =
      panelRef.current?.querySelector<HTMLElement>(
        'input, select, textarea, button:not([aria-label]), [tabindex]:not([tabindex="-1"])'
      ) ?? panelRef.current;
    target?.focus({ preventScroll: true });
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      prevFocus.current?.focus?.({ preventScroll: true });
    };
  }, [open, onClose]);

  if (!open) return null;
  const closeLabel = t(locale, 't10misc.confirmDialog.close');
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelled}
    >
      <button
        aria-label={closeLabel}
        onClick={onClose}
        className="absolute inset-0 bg-ink/50 backdrop-blur-[2px] cursor-default"
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        className="relative w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto ej-sheet-in focus-visible:outline-none"
      >
        <h2 id={titleId} className="text-lg font-bold text-zinc-900 tracking-tight mb-4 pr-8">
          {title}
        </h2>
        <button
          onClick={onClose}
          aria-label={closeLabel}
          className="absolute top-4 right-4 p-2.5 rounded-xl text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 min-w-[44px] min-h-[44px] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
        {children}
      </div>
    </div>
  );
}
