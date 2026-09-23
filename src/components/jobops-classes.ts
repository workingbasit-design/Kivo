/**
 * Vector-identity class strings for the job-ops components (checklists,
 * expenses, costing, checklist templates).
 *
 * These are local copies — not the shared ui.tsx classes — so job-ops UI
 * ships the new Vector tokens (bg-ink primary buttons, ink links/focus,
 * graphite secondary text, smoke borders) without touching shared
 * components that other parallel agents are using.
 */
export const jInputClass =
  'w-full px-4 py-2.5 rounded-xl border border-smoke bg-white text-sm text-ink placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-ink/20 focus:border-ink';

export const jPrimaryBtnClass =
  'bg-ink hover:bg-zinc-800 text-white px-4 py-2.5 rounded-xl font-semibold text-xs transition-colors inline-flex items-center gap-2 shadow-sm disabled:opacity-60';

export const jSecondaryBtnClass =
  'bg-white hover:bg-zinc-50 text-ink px-4 py-2.5 rounded-xl font-semibold text-xs transition-colors inline-flex items-center gap-2 border border-smoke shadow-sm disabled:opacity-60';
