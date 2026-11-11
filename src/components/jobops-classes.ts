/**
 * Vector-identity class strings for the job-ops components (checklists,
 * expenses, costing, checklist templates).
 *
 * These are local copies - not the shared ui.tsx classes - so job-ops UI
 * ships the new Vector tokens without touching shared components that other
 * parallel agents are using.
 *
 * D1 (design audit): the primary button was `bg-ink ... text-hero-ink`.
 * --ink flips to near-white in dark mode while --hero-ink is near-white in
 * BOTH modes, so every job-ops "Add" button rendered as a blank white pill
 * at 1.04:1 - the label was invisible. The dark button has to sit on
 * --asphalt, which holds one value in both modes, so the near-white label
 * stays readable either way. Swapping the TEXT to text-surface instead would
 * have fixed dark mode and broken light mode, where --surface is white on a
 * near-white --ink fill.
 */
export const jInputClass =
  'w-full px-4 py-2.5 rounded-xl border border-smoke bg-surface text-sm text-ink placeholder:text-ink-2 focus:outline-none focus:ring-2 focus:ring-ink/20 focus:border-ink';

export const jPrimaryBtnClass =
  'bg-asphalt hover:bg-hero-2 text-hero-ink px-4 py-2.5 rounded-xl font-semibold text-xs transition-colors inline-flex items-center gap-2 shadow-sm disabled:opacity-60';

export const jSecondaryBtnClass =
  'bg-surface hover:bg-surface-2 text-ink px-4 py-2.5 rounded-xl font-semibold text-xs transition-colors inline-flex items-center gap-2 border border-smoke shadow-sm disabled:opacity-60';
