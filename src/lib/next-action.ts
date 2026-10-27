/**
 * Scroll lesson 2 — the "Next best action" card (pure rules, no AI).
 *
 * One card, one action, decided by static priority — never by a model:
 *   1. follow-up: an unpaid invoice whose reference date (dueAt when set,
 *      else its issue date) is more than 7 days in the past. This is a
 *      nudge rule, NOT the app's overdue definition (net-30, see
 *      revenue.ts OVERDUE_AFTER_DAYS): an invoice can deserve a follow-up
 *      before it is formally overdue, and one past due is always nudged.
 *   2. confirm: tomorrow's earliest NEW/SCHEDULED job. There is no
 *      "confirmed" job state, so NEW/SCHEDULED tomorrow is the unconfirmed
 *      set; the action links to the job page, where the pro contacts the
 *      customer from the existing contact actions.
 *   3. review: the most recent COMPLETED/PAID job whose customer has a
 *      PAID invoice (the review moat, same rule as review-eligibility.ts);
 *      the action links to the job page, where the review request lives.
 *   4. fill-schedule: tomorrow has no jobs at all (any non-cancelled job
 *      counts — an in-progress visit tomorrow means tomorrow is full).
 * Anything else renders nothing. Technicians never see rules 1 or 3:
 * the fetcher passes them empty rows, so their card is schedule-only
 * (confirm / fill-schedule), matching the jobs-only rule from lesson 1.
 */

export type NextActionKind = "follow-up" | "confirm" | "review" | "fill-schedule";

export interface NextActionInvoiceRow {
  id: string;
  number: string;
  customerName: string;
  /** Net-30 due date; null for never-sent invoices (legacy). */
  dueAt: Date | null;
  date: Date;
}

export interface NextActionJobRow {
  id: string;
  title: string;
  customerName: string;
  status: string;
  date: Date;
  time: string | null;
  startAt: Date | null;
}

export interface NextActionCompletedRow {
  id: string;
  title: string;
  customerName: string;
  date: Date;
  /** True when this customer has any non-voided PAID invoice. */
  hasPaidInvoice: boolean;
}

export interface NextActionInput {
  /** Unpaid/partially-paid, non-voided invoices (owner only). */
  invoices: NextActionInvoiceRow[];
  /** NEW/SCHEDULED jobs scheduled for tomorrow. */
  tomorrowJobs: NextActionJobRow[];
  /** COMPLETED/PAID jobs, most recent first (owner only). */
  completedJobs: NextActionCompletedRow[];
  /** True when any non-cancelled, non-archived job lands tomorrow. */
  tomorrowHasAnyJob: boolean;
}

export type NextActionMeta =
  | { key: "overdue"; days: number }
  | { key: "unpaidFor"; days: number }
  | { key: "tomorrowAt"; startAtISO: string | null; time: string | null }
  | { key: "tomorrow" }
  | { key: "onDate"; dateISO: string }
  | { key: "none" };

export interface NextAction {
  kind: NextActionKind;
  href: string;
  title: string;
  customerName: string | null;
  meta: NextActionMeta;
}

/** Follow-ups fire once the reference date is more than this many days past. */
export const FOLLOW_UP_AFTER_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

function wholeDaysBetween(earlier: Date, later: Date): number {
  return Math.floor((later.getTime() - earlier.getTime()) / DAY_MS);
}

function earliestTomorrowJob(jobs: NextActionJobRow[]): NextActionJobRow {
  return [...jobs].sort((a, b) => {
    const sa = a.startAt?.getTime() ?? Infinity;
    const sb = b.startAt?.getTime() ?? Infinity;
    if (sa !== sb) return sa - sb;
    return (a.time ?? "").localeCompare(b.time ?? "");
  })[0];
}

export function selectNextAction(
  input: NextActionInput,
  opts: { now?: Date } = {}
): NextAction | null {
  const now = opts.now ?? new Date();

  // 1. Follow up on the longest-unpaid invoice (oldest reference date wins).
  const stale = input.invoices
    .map((inv) => {
      const ref = inv.dueAt ?? inv.date;
      return { inv, ref, days: wholeDaysBetween(ref, now) };
    })
    .filter((r) => r.days > FOLLOW_UP_AFTER_DAYS)
    .sort((a, b) => b.days - a.days);
  if (stale.length > 0) {
    const top = stale[0];
    return {
      kind: "follow-up",
      href: `/invoices/${top.inv.id}`,
      title: top.inv.number,
      customerName: top.inv.customerName,
      meta: top.inv.dueAt
        ? { key: "overdue", days: top.days }
        : { key: "unpaidFor", days: top.days },
    };
  }

  // 2. Confirm tomorrow's earliest unconfirmed job. Only NEW/SCHEDULED
  // rows count here — the fetcher filters, but the rule must hold even
  // if a caller passes other statuses (lesson 1 filters the same way).
  const unconfirmed = input.tomorrowJobs.filter(
    (j) => j.status === "NEW" || j.status === "SCHEDULED"
  );
  if (unconfirmed.length > 0) {
    const job = earliestTomorrowJob(unconfirmed);
    return {
      kind: "confirm",
      href: `/jobs/${job.id}`,
      title: job.title,
      customerName: job.customerName,
      meta: job.startAt || job.time
        ? {
            key: "tomorrowAt",
            startAtISO: job.startAt ? job.startAt.toISOString() : null,
            time: job.time,
          }
        : { key: "tomorrow" },
    };
  }

  // 3. Ask for a review on the most recent eligible completed job.
  const eligible = input.completedJobs.find((j) => j.hasPaidInvoice);
  if (eligible) {
    return {
      kind: "review",
      href: `/jobs/${eligible.id}`,
      title: eligible.title,
      customerName: eligible.customerName,
      meta: { key: "onDate", dateISO: eligible.date.toISOString() },
    };
  }

  // 4. Fill an empty tomorrow.
  if (!input.tomorrowHasAnyJob) {
    return {
      kind: "fill-schedule",
      href: "/jobs/new",
      title: "",
      customerName: null,
      meta: { key: "none" },
    };
  }

  return null;
}
