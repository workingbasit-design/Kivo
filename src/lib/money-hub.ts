/**
 * Money hub helpers (Money redesign, 2026-11-17).
 *
 * Pure functions over plain data so the page (server) and the tests share
 * exactly one definition of the hub's money math. All amounts are integer
 * cents (bigint) until the render layer formats them with formatCents —
 * formatMoney takes DOLLARS, so cents must never reach it.
 *
 * Money is the central financial hub: Quotes -> Invoices -> Payments ->
 * Expenses -> Bookkeeping share the same underlying records. There is no
 * parallel money store: income is COMPLETED payments on non-voided
 * invoices, expenses are JobExpense rows, outstanding is the unpaid
 * remainder of non-voided, non-PAID invoices. A voided payment is never
 * money (see src/lib/invoice-status.ts).
 */
import { sumMoneyPayments } from './invoice-status.ts';

export type MoneyActivityKind = 'income' | 'expense' | 'invoice';

/** One row of the payment-activity feed, ready for the client. */
export type MoneyActivityItem = {
  id: string;
  kind: MoneyActivityKind;
  title: string;
  detail: string;
  /** ISO date string; the client formats it for the locale. */
  date: string;
  /** Signed display cents: income +, expense -, invoice + (its total). */
  amountCents: number;
  /** Customer (income/invoice) or vendor note (expense); feeds the CSV. */
  party: string;
  href: string;
};

/**
 * What a customer still owes on one invoice: total minus COMPLETED
 * payments, clamped at zero. Overpayment is guarded server-side by
 * recordPayment, so the clamp only ever fires on stale reads.
 */
export function remainingCents(
  totalCents: bigint,
  payments: { amountCents: bigint; status: string }[]
): bigint {
  const remaining = totalCents - sumMoneyPayments(payments);
  return remaining > BigInt(0) ? remaining : BigInt(0);
}

/**
 * Merge the three activity sources into one feed, newest first.
 * Sort key is the row's creation instant (`sortMs`); the display `date`
 * is the business date (payment day, expense day, invoice day), which
 * can differ from the creation instant for backdated expenses.
 */
export function buildMoneyActivity(
  items: (Omit<MoneyActivityItem, 'amountCents'> & {
    amountCents: number;
    sortMs: number;
  })[]
): MoneyActivityItem[] {
  return [...items]
    .sort((a, b) => b.sortMs - a.sortMs)
    .map((item) => ({
      id: item.id,
      kind: item.kind,
      title: item.title,
      detail: item.detail,
      date: item.date,
      amountCents: item.amountCents,
      party: item.party,
      href: item.href,
    }));
}

/** Filter a built activity feed to one tab. 'all' keeps every row. */
export function filterMoneyActivity(
  items: MoneyActivityItem[],
  filter: 'all' | MoneyActivityKind
): MoneyActivityItem[] {
  if (filter === 'all') return items;
  return items.filter((i) => i.kind === filter);
}
