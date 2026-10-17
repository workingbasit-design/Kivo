/**
 * Shared kit button styles, mirroring the mockup's `.btn` family.
 * Token utilities only — no hard-coded colours.
 */

export type KitButtonVariant = 'primary' | 'secondary' | 'ghost';

const BASE =
  'inline-flex items-center justify-center gap-2 min-h-[52px] px-[18px] rounded-[14px] ' +
  'font-bold text-[17px] whitespace-nowrap ' +
  'focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2 ' +
  'motion-safe:transition-colors [&_svg]:h-5 [&_svg]:w-5';

const VARIANTS: Record<KitButtonVariant, string> = {
  primary: 'bg-hivis text-hivis-ink',
  secondary:
    'bg-surface text-ink shadow-[inset_0_0_0_1.5px_var(--line-strong)]',
  ghost: 'bg-transparent text-ink-2',
};

/** Class list for a kit button; pass `sm` for the 44px variant, `block` for full width. */
export function kitButtonClass(
  variant: KitButtonVariant,
  opts?: { sm?: boolean; block?: boolean },
): string {
  return [
    BASE,
    VARIANTS[variant],
    opts?.sm === true ? 'min-h-[44px] px-[14px] text-[15px] rounded-[12px]' : '',
    opts?.block === true ? 'w-full' : '',
  ]
    .filter(Boolean)
    .join(' ');
}
