/**
 * Canonical quote status transition rules.
 *
 * Single source of truth for which quote status changes are legal. The server
 * action `updateQuoteStatus` enforces these; the UI should only offer
 * transitions this module allows.
 *
 * Lifecycle: DRAFT → SENT → APPROVED / DECLINED. A declined quote can go back
 * to DRAFT for rework; an approved quote is terminal (convert to job/invoice
 * instead of editing). SENT can return to DRAFT (recall).
 */

/** Statuses a quote in `from` may legally move to. */
export const QUOTE_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['SENT', 'DECLINED'],
  SENT: ['DRAFT', 'APPROVED', 'DECLINED'],
  APPROVED: [],
  DECLINED: ['DRAFT'],
};

/** True when `from` → `to` is a legal quote status change. */
export function isValidQuoteTransition(from: string, to: string): boolean {
  if (from === to) return true;
  return (QUOTE_TRANSITIONS[from] ?? []).includes(to);
}
