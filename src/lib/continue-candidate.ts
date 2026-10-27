/**
 * Scroll lesson 1 — "Continue" home screen: pick the single record the
 * pro should resume when opening the app.
 *
 * Priority (first match wins):
 *  1. A job IN PROGRESS (most recently updated) — resume it.
 *  2. A late job (not started, start passed — same definition as
 *     isJobLate) — earliest start first.
 *  3. Today's next not-started visit — earliest time first.
 *  4. The next future scheduled job — earliest day first.
 *  5. A DRAFT quote (most recently updated) — send it.
 *  6. An open invoice (oldest first) — record a payment.
 *
 * The selector is pure (no Prisma, no locale) so it is unit-testable.
 * Formatting (times, dates) happens in ContinueSection, which already
 * knows the locale and business timezone.
 *
 * Last-opened records (localStorage, written by RecordLastOpened) are
 * resolved in resolveContinueDisplay: today's work (priorities 1–3)
 * always beats a stale last-opened record; a last-opened record beats
 * upcoming/admin work (priorities 4–6), because resuming beats planning.
 */
import { isJobLate } from "./job-status.ts";
import { toISODateInTimezone } from "./utils.ts";

export type ContinueKind = "job" | "quote" | "invoice";

export type ContinueAction = "continue" | "view" | "send" | "pay";

export interface ContinueMeta {
  key: "inProgress" | "late" | "todayAt" | "today" | "onDate" | "draft" | "unpaid";
  /** Raw "HH:MM" 24h time for todayAt, when the job has no startAt. */
  time: string | null;
  /** ISO instant for a stored startAt, for todayAt formatting. */
  startAtISO: string | null;
  /** ISO instant for the stored job date, for onDate formatting. */
  dateISO: string | null;
}

export interface ContinueCandidate {
  kind: ContinueKind;
  id: string;
  title: string;
  /** Customer name, plus area for jobs. */
  subtitle: string;
  href: string;
  action: ContinueAction;
  /** 1 = most urgent. Last-opened beats priorities 4–6 only. */
  priority: 1 | 2 | 3 | 4 | 5 | 6;
  meta: ContinueMeta;
}

export interface ContinueJobRow {
  id: string;
  title: string;
  customerName: string;
  area: string | null;
  status: string;
  date: Date;
  time: string | null;
  startAt: Date | null;
  updatedAt: Date;
}

export interface ContinueQuoteRow {
  id: string;
  title: string;
  customerName: string;
  updatedAt: Date;
}

export interface ContinueInvoiceRow {
  id: string;
  number: string;
  customerName: string;
  date: Date;
  updatedAt: Date;
}

const NOT_STARTED = ["NEW", "SCHEDULED"];

function timeSortKey(time: string | null): string {
  return time ?? "99:99";
}

function byUpdatedDesc(a: { updatedAt: Date }, b: { updatedAt: Date }): number {
  return b.updatedAt.getTime() - a.updatedAt.getTime();
}

export function selectContinueCandidate(
  rows: {
    jobs: ContinueJobRow[];
    quotes: ContinueQuoteRow[];
    invoices: ContinueInvoiceRow[];
  },
  ctx: { todayKey: string; timezone: string; now: Date }
): ContinueCandidate | null {
  const { jobs, quotes, invoices } = rows;
  const { todayKey, timezone, now } = ctx;

  const inProgress = jobs
    .filter((j) => j.status === "IN PROGRESS")
    .sort(byUpdatedDesc)[0];
  if (inProgress) {
    return {
      kind: "job",
      id: inProgress.id,
      title: inProgress.title,
      subtitle: inProgress.area
        ? `${inProgress.customerName}, ${inProgress.area}`
        : inProgress.customerName,
      href: `/jobs/${inProgress.id}`,
      action: "continue",
      priority: 1,
      meta: { key: "inProgress", time: null, startAtISO: null, dateISO: null },
    };
  }

  const late = jobs
    .filter(
      (j) =>
        NOT_STARTED.includes(j.status) &&
        isJobLate({ date: j.date, startAt: j.startAt, status: j.status }, now, timezone)
    )
    .sort((a, b) => {
      const aStart = a.startAt?.getTime() ?? a.date.getTime();
      const bStart = b.startAt?.getTime() ?? b.date.getTime();
      return aStart - bStart;
    })[0];
  if (late) {
    return {
      kind: "job",
      id: late.id,
      title: late.title,
      subtitle: late.area ? `${late.customerName}, ${late.area}` : late.customerName,
      href: `/jobs/${late.id}`,
      action: "view",
      priority: 2,
      meta: { key: "late", time: null, startAtISO: null, dateISO: null },
    };
  }

  const today = jobs
    .filter(
      (j) =>
        NOT_STARTED.includes(j.status) &&
        toISODateInTimezone(j.date, timezone) === todayKey
    )
    .sort(
      (a, b) =>
        timeSortKey(a.time).localeCompare(timeSortKey(b.time)) ||
        a.updatedAt.getTime() - b.updatedAt.getTime()
    )[0];
  if (today) {
    return {
      kind: "job",
      id: today.id,
      title: today.title,
      subtitle: today.area ? `${today.customerName}, ${today.area}` : today.customerName,
      href: `/jobs/${today.id}`,
      action: "view",
      priority: 3,
      meta: {
        key: today.startAt || today.time ? "todayAt" : "today",
        time: today.time,
        startAtISO: today.startAt ? today.startAt.toISOString() : null,
        dateISO: null,
      },
    };
  }

  const future = jobs
    .filter(
      (j) =>
        NOT_STARTED.includes(j.status) &&
        toISODateInTimezone(j.date, timezone) > todayKey
    )
    .sort(
      (a, b) =>
        toISODateInTimezone(a.date, timezone).localeCompare(
          toISODateInTimezone(b.date, timezone)
        ) || timeSortKey(a.time).localeCompare(timeSortKey(b.time))
    )[0];
  if (future) {
    return {
      kind: "job",
      id: future.id,
      title: future.title,
      subtitle: future.area ? `${future.customerName}, ${future.area}` : future.customerName,
      href: `/jobs/${future.id}`,
      action: "view",
      priority: 4,
      meta: {
        key: "onDate",
        time: null,
        startAtISO: null,
        dateISO: future.date.toISOString(),
      },
    };
  }

  const draft = [...quotes].sort(byUpdatedDesc)[0];
  if (draft) {
    return {
      kind: "quote",
      id: draft.id,
      title: draft.title,
      subtitle: draft.customerName,
      href: `/quotes/${draft.id}`,
      action: "send",
      priority: 5,
      meta: { key: "draft", time: null, startAtISO: null, dateISO: null },
    };
  }

  const unpaid = [...invoices].sort((a, b) => a.date.getTime() - b.date.getTime())[0];
  if (unpaid) {
    return {
      kind: "invoice",
      id: unpaid.id,
      title: unpaid.number,
      subtitle: unpaid.customerName,
      href: `/invoices/${unpaid.id}`,
      action: "pay",
      priority: 6,
      meta: { key: "unpaid", time: null, startAtISO: null, dateISO: null },
    };
  }

  return null;
}

/** localStorage key for the last record the pro opened (Continue card). */
export const LAST_OPENED_KEY = "everyjob:continue:last";

/**
 * Remove the last-opened entry when it points at `id`. Called by the
 * job/quote/invoice delete flows so the Continue card never links to a
 * deleted record. Safe to call optimistically before the delete
 * resolves: if the delete fails, the record still exists and the
 * server candidate surfaces it on the next dashboard visit.
 */
export function clearLastOpenedRecord(id: string): void {
  try {
    const raw = window.localStorage.getItem(LAST_OPENED_KEY);
    if (!raw) return;
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      (parsed as Record<string, unknown>).id === id
    ) {
      window.localStorage.removeItem(LAST_OPENED_KEY);
    }
  } catch {
    // Storage unavailable or corrupt — the card falls back to the
    // server candidate. Never break a delete flow for this.
  }
}

/** A record the pro opened before, as stored in localStorage. */
export interface LastOpenedRecord {
  kind: ContinueKind;
  id: string;
  title: string;
  subtitle: string;
}

/** A fully localized card line: what the Continue card actually renders. */
export interface ContinueDisplay {
  kind: ContinueKind;
  id: string;
  title: string;
  subtitle: string;
  /** Second line: "In progress", "Today at 8:30 a.m.", "Where you left off"… */
  meta: string;
  href: string;
  actionLabel: string;
}

/**
 * Resolve what the Continue card shows. Server candidate priorities 1–3
 * (in-progress / late / today) always win; a last-opened record wins over
 * upcoming/admin candidates (4–6); otherwise the server candidate, if any.
 */
export function resolveContinueDisplay(
  server: ContinueDisplay | null,
  serverPriority: 1 | 2 | 3 | 4 | 5 | 6 | null,
  lastOpened: LastOpenedRecord | null,
  labels: { lastOpened: string; viewJob: string; viewQuote: string; viewInvoice: string }
): ContinueDisplay | null {
  if (server && serverPriority !== null && serverPriority <= 3) return server;
  if (lastOpened && server && lastOpened.id === server.id) return server;
  if (lastOpened) {
    const actionLabel =
      lastOpened.kind === "job"
        ? labels.viewJob
        : lastOpened.kind === "quote"
          ? labels.viewQuote
          : labels.viewInvoice;
    return {
      kind: lastOpened.kind,
      id: lastOpened.id,
      title: lastOpened.title,
      subtitle: lastOpened.subtitle,
      meta: labels.lastOpened,
      href: `/${lastOpened.kind}s/${lastOpened.id}`,
      actionLabel,
    };
  }
  return server;
}
