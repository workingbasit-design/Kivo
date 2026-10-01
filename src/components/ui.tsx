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
    <div className={cn('bg-white rounded-[20px] border border-zinc-200/70 shadow-[0_1px_3px_rgba(22,22,22,0.06)]', className)} style={style}>
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

/**
 * GlassIcon — Apple-style "liquid glass" icon chip.
 * Frosted translucency (backdrop blur + saturation boost), a bright specular
 * top edge, a hairline light border and a soft drop shadow. Tones reuse the
 * exact accent hues already in the theme — only the finish changes, so the
 * palette stays identical.
 */
const GLASS_TONES = {
  zinc: 'bg-zinc-200/50 text-zinc-700',
  emerald: 'bg-emerald-200/50 text-emerald-700',
  amber: 'bg-amber-200/50 text-amber-700',
  blue: 'bg-blue-200/50 text-blue-700',
  indigo: 'bg-indigo-200/50 text-indigo-700',
} as const;

export type GlassTone = keyof typeof GLASS_TONES;

const GLASS_SIZES = {
  sm: 'w-8 h-8 rounded-xl',
  md: 'w-10 h-10 rounded-2xl',
  lg: 'w-14 h-14 rounded-[20px]',
} as const;

/** Full glass treatment as a composable class string (for buttons/links). */
export function glassClass(tone: GlassTone = 'zinc'): string {
  return cn(
    'backdrop-blur-xl backdrop-saturate-150',
    'ring-1 ring-inset ring-white/70',
    'shadow-[inset_0_1px_0_rgba(255,255,255,0.9),inset_0_-1px_1px_rgba(0,0,0,0.04),0_10px_20px_-10px_rgba(0,0,0,0.28)]',
    GLASS_TONES[tone]
  );
}

export function GlassIcon({
  icon,
  tone = 'zinc',
  size = 'md',
  className,
}: {
  icon: React.ReactNode;
  tone?: GlassTone;
  size?: keyof typeof GLASS_SIZES;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center shrink-0',
        GLASS_SIZES[size],
        glassClass(tone),
        className
      )}
    >
      {icon}
    </span>
  );
}

export function StatCard({
  label,
  value,
  sub,
  icon,
  accent,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: React.ReactNode;
  accent?: string;
  /** Glassmorphism finish — preferred over `accent`; same hues, frosted. */
  tone?: GlassTone;
}) {
  return (
    <div className="bg-white rounded-[20px] border border-zinc-200/70 shadow-[0_1px_3px_rgba(22,22,22,0.06)] p-5">
      <div className="flex items-center justify-between gap-2 mb-3">
        <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 leading-tight text-balance">{label}</p>
        {icon &&
          (tone ? (
            <GlassIcon icon={icon} tone={tone} size="md" />
          ) : (
            <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', accent ?? 'bg-zinc-100 text-zinc-600')}>
              {icon}
            </div>
          ))}
      </div>
      <p className="text-[26px] font-bold text-zinc-900 tracking-tight tabular-nums">{value}</p>
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
      <GlassIcon icon={icon} tone="zinc" size="lg" className="mb-4" />
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
  required,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
        {label}
        {required && <span className="text-rose-500 ml-1" aria-hidden="true">*</span>}
      </label>
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
    <div className="bg-white rounded-[20px] border border-zinc-200/70 shadow-[0_1px_3px_rgba(22,22,22,0.06)] p-5 space-y-3" aria-hidden>
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
        'bg-white rounded-[20px] border border-zinc-200/70 shadow-[0_1px_3px_rgba(22,22,22,0.06)] p-4 flex items-center gap-3',
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
  // onClose is an inline arrow at most call sites (new identity every
  // render). Keep it in a ref so the effect below only re-runs when `open`
  // changes — otherwise every keystroke inside the dialog would re-run the
  // effect and yank focus back to the first input (2026-09-28: typing a
  // multi-digit price kept only the first digit; the rest leaked into the
  // name field).
  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
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
  }, [open]);

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

/**
 * Apple/Instagram-style smooth Button (2026-09-30).
 *
 * Apple-style: spring-like press with a smooth cubic-bezier easing (not the
 * linear scale the global CSS used to apply), subtle shadow that compresses
 * on press, 44px min touch target.
 *
 * Instagram-style: `variant="gradient"` gives the signature purple → pink →
 * orange gradient with white text.
 *
 * Reduced motion: the press animation is disabled via
 * `motion-reduce:transform-none` so it respects OS settings.
 * Focus: visible ring on keyboard focus.
 */
type ButtonVariant = 'primary' | 'secondary' | 'gradient' | 'ghost' | 'danger' | 'cta';
type ButtonSize = 'sm' | 'md' | 'lg';

const buttonVariants: Record<ButtonVariant, string> = {
  // Apple-style solid: near-black with soft shadow
  primary:
    'bg-zinc-900 text-white shadow-[0_2px_8px_rgba(0,0,0,0.12)] hover:bg-zinc-700 hover:shadow-[0_4px_12px_rgba(0,0,0,0.16)] border border-transparent',
  // Apple-style secondary: light gray, subtle
  secondary:
    'bg-zinc-100 text-zinc-900 border border-zinc-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:bg-zinc-200/70',
  // Instagram-style gradient: purple → pink → orange
  gradient:
    'text-white border border-transparent shadow-[0_2px_12px_rgba(253,29,29,0.25)] hover:shadow-[0_4px_16px_rgba(253,29,29,0.35)] bg-[linear-gradient(45deg,#833AB4,#FD1D1D,#FCB045)] bg-[length:150%_150%] hover:bg-[position:100%_50%]',
  // Minimal ghost: transparent with hover wash
  ghost:
    'bg-transparent text-zinc-700 border border-transparent hover:bg-zinc-100',
  // Destructive: red tint
  danger:
    'bg-red-50 text-red-700 border border-red-200/70 shadow-[0_1px_3px_rgba(220,38,38,0.08)] hover:bg-red-100',
  // Instagram-ad CTA bar: full-width bold color block, white text.
  // Pair with <CtaBar> or w-full + justify-between and a chevron.
  cta:
    'text-white border border-transparent bg-[#E8402A] hover:bg-[#d23723] shadow-[0_4px_16px_rgba(232,64,42,0.3)] hover:shadow-[0_6px_20px_rgba(232,64,42,0.4)]',
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: 'min-h-[36px] px-3.5 text-[13px] rounded-xl',
  md: 'min-h-[44px] px-5 text-sm rounded-xl',
  lg: 'min-h-[52px] px-7 text-[15px] rounded-2xl',
};

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <button
      className={cn(
        // Apple-style smooth press: spring-like cubic-bezier, 200ms.
        // motion-reduce disables the transform for accessibility.
        'inline-flex items-center justify-center gap-2 font-semibold tracking-tight',
        'transition-all duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)]',
        'active:scale-[0.96] active:duration-100',
        'motion-reduce:transition-none motion-reduce:transform-none motion-reduce:active:scale-100',
        'disabled:opacity-50 disabled:pointer-events-none disabled:shadow-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/40 focus-visible:ring-offset-2',
        'select-none cursor-pointer',
        buttonVariants[variant],
        buttonSizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/**
 * Instagram-ad-style full-width CTA bar (2026-09-30).
 * Like the "Sign up" bar in sponsored posts: a bold full-bleed color block
 * with white text and a chevron on the right. Sticky-bottom friendly.
 *
 * Usage:
 *   <CtaBar onClick={...}>Sign up</CtaBar>
 */
export function CtaBar({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        'w-full flex items-center justify-between gap-3',
        'min-h-[56px] px-6 text-[17px]',
        'font-semibold tracking-tight text-white',
        'bg-[#E8402A] hover:bg-[#d23723]',
        'shadow-[0_4px_16px_rgba(232,64,42,0.3)] hover:shadow-[0_6px_20px_rgba(232,64,42,0.4)]',
        // Same Apple-style spring press as Button
        'transition-all duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)]',
        'active:scale-[0.98] active:duration-100',
        'motion-reduce:transition-none motion-reduce:transform-none motion-reduce:active:scale-100',
        'disabled:opacity-50 disabled:pointer-events-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8402A]/50 focus-visible:ring-offset-2',
        'select-none cursor-pointer',
        className
      )}
      {...props}
    >
      <span>{children}</span>
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="shrink-0 transition-transform duration-200 group-hover:translate-x-0.5"
      >
        <path d="M9 18l6-6-6-6" />
      </svg>
    </button>
  );
}

/**
 * Animated entrance wrapper — Instagram-ad-style smooth reveals.
 * `animation`: 'fade-up' (default), 'scale-in', 'float'.
 * `delay`: stagger delay in ms for sequenced entrances.
 * Respects prefers-reduced-motion (renders statically).
 */
export function Reveal({
  children,
  animation = 'fade-up',
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  animation?: 'fade-up' | 'scale-in' | 'float';
  delay?: number;
  className?: string;
}) {
  const animClass =
    animation === 'scale-in'
      ? 'ej-anim-scale-in'
      : animation === 'float'
        ? 'ej-anim-float'
        : 'ej-anim-fade-up';
  return (
    <div
      className={cn(animClass, className)}
      style={delay ? { animationDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}