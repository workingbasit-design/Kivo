/**
 * Part C (dashboard rebuild): section-by-section dashboard data.
 *
 * Each exported `get*` fetcher is tenant-scoped (businessId) and computes
 * its section from real data in the business timezone. Pure helpers are
 * exported for unit tests (`__tests__/dashboard-sections.test.mts`).
 *
 * Money: the DB stores integer cents; this module converts to dollars for
 * display with `centsToDollars`. All day boundaries are business-local
 * calendar days, never server-local.
 */
import { prisma } from "@/lib/prisma";
import { centsToDollars } from "./money.ts";
import { daysOverdue } from "./revenue.ts";
import { todayInTimezone, toISODateInTimezone, dayRangeInTimezone } from "./utils.ts";
import { tradeKeyForService, TRADE_ICON_COMPONENTS, type TradeKey } from "./trade-icons.ts";
import { getAttentionItems, type AttentionItem } from "./attention.ts";
import {
  selectContinueCandidate,
  type ContinueCandidate,
  type ContinueJobRow,
  type ContinueQuoteRow,
  type ContinueInvoiceRow,
} from "./continue-candidate.ts";

/* ------------------------------------------------------------------ */
/* Pure date-key helpers (no Prisma, fully unit-tested)                */
/* ------------------------------------------------------------------ */

/** "YYYY-MM-DD" calendar key for an instant in the given IANA timezone. */
export function dayKeyInTz(d: Date, timeZone: string): string {
  return toISODateInTimezone(d, timeZone);
}

/** Add (or subtract) whole days to a "YYYY-MM-DD" key. Pure date math. */
export function addDaysToKey(key: string, n: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  const p = (v: number) => String(v).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${p(dt.getUTCMonth() + 1)}-${p(dt.getUTCDate())}`;
}

/** Weekday index of a day key: 0 = Monday … 6 = Sunday. */
export function weekdayIndex(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

/** The 7 day keys (Mon…Sun) of the week containing `todayKey`. */
export function weekDayKeys(todayKey: string): string[] {
  const monday = addDaysToKey(todayKey, -weekdayIndex(todayKey));
  return Array.from({ length: 7 }, (_, i) => addDaysToKey(monday, i));
}

/** Month keys "YYYY-MM", oldest first, ending with the month of `todayKey`. */
export function monthKeys(todayKey: string, n: number): string[] {
  const [y, m] = todayKey.split("-").map(Number);
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const dt = new Date(Date.UTC(y, m - 1 - i, 1));
    out.push(
      `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}`
    );
  }
  return out;
}

/** Sum `amount` per day key for items stamped with `at` (business tz). */
export function bucketSumsByDay(
  items: { at: Date; amount: number }[],
  keys: string[],
  timeZone: string
): number[] {
  const sums = new Map<string, number>();
  for (const it of items) {
    const k = dayKeyInTz(it.at, timeZone);
    sums.set(k, (sums.get(k) ?? 0) + it.amount);
  }
  return keys.map((k) => sums.get(k) ?? 0);
}

/** Percent change vs the previous period. Null when there is no baseline. */
export function changePct(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/* ------------------------------------------------------------------ */
/* Pure display helpers                                                */
/* ------------------------------------------------------------------ */

/**
 * Best-effort area from a free-text address. The demo seed writes
 * "1423 Eglinton Ave W, Etobicoke", so the city is the last segment.
 */
export function areaFromAddress(address: string | null | undefined): string | null {
  if (!address) return null;
  const parts = address
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;
  let last = parts[parts.length - 1];
  // A trailing postal code ("M9C 1H4", "ON M5H 1J9") is not an area.
  last = last.replace(/\s*[A-Z]\d[A-Z]\s?\d[A-Z]\d\s*$/i, "").trim();
  // A bare province code ("ON") is not an area either - step back once more.
  if (/^[A-Z]{2}$/i.test(last) && parts.length > 1) {
    return parts[parts.length - 2];
  }
  return last || null;
}

/** "Daniel Okafor" -> "DO". */
export function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** Unique customer initials, up to `max`, in first-seen order. */
export function uniqueInitials(names: string[], max = 3): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const n of names) {
    const init = initialsOf(n);
    if (!init || seen.has(init)) continue;
    seen.add(init);
    out.push(init);
    if (out.length >= max) break;
  }
  return out;
}

/** Split open-invoice balances into the four aging buckets (dollars). */
export function agingSplit(
  invoices: { outstanding: number; overdueDays: number }[]
): { current: number; d1_30: number; d31_60: number; over60: number } {
  const out = { current: 0, d1_30: 0, d31_60: 0, over60: 0 };
  for (const inv of invoices) {
    if (inv.overdueDays <= 0) out.current += inv.outstanding;
    else if (inv.overdueDays <= 30) out.d1_30 += inv.outstanding;
    else if (inv.overdueDays <= 60) out.d31_60 += inv.outstanding;
    else out.over60 += inv.outstanding;
  }
  return out;
}

/** Phosphor component name for a job's trade (service override wins). */
export function tradeIconNameForJob(job: {
  title: string;
  service?: { name: string; nameFr?: string | null; category?: string | null; iconKey?: string | null } | null;
}): string {
  const key: TradeKey = job.service
    ? tradeKeyForService(job.service)
    : tradeKeyForService({ name: job.title });
  return TRADE_ICON_COMPONENTS[key];
}

/* ------------------------------------------------------------------ */
/* Section data types                                                  */
/* ------------------------------------------------------------------ */

export interface HeaderSummary {
  visitsToday: number;
  doneToday: number;
  readyToInvoice: number;
  dateKey: string;
}

export interface DayBar {
  key: string;
  /** Single-letter weekday label, localized by the component. */
  weekday: number; // 0 = Monday … 6 = Sunday
  amount: number;
  isToday: boolean;
  isFuture: boolean;
}

export interface CollectedPeriod {
  total: number;
  prevTotal: number;
  changePct: number | null;
  bars: DayBar[];
  /** "YYYY-MM" keys for the month view (component localizes); empty for week. */
  barMonths: string[];
  invoiced: number;
  jobsDone: number;
  jobsTotal: number;
}

export interface CollectedData {
  week: CollectedPeriod;
  month: CollectedPeriod;
}

export interface NeedsYouData {
  items: AttentionItem[];
  total: number;
}

export interface KeyNumbers {
  owed: {
    total: number;
    overdue: number;
    aging: { current: number; d1_30: number; d31_60: number; over60: number };
  };
  readyToInvoice: { amount: number; jobs: number; customerInitials: string[] };
  quotesWaiting: { amount: number; count: number; expiringSoon: number };
  newLeads: {
    waiting: number;
    /** Average first-reply minutes this week; null when nobody replied. */
    avgFirstReplyMin: number | null;
    /** Oldest still-waiting reply in minutes; null when nobody waits. */
    oldestWaitingMin: number | null;
  };
}

export interface VisitRow {
  id: string;
  /** "HH:MM" 24h job time, or null when unscheduled/TBD. */
  time: string | null;
  tradeIcon: string;
  title: string;
  customerName: string;
  area: string | null;
  assigneeName: string | null;
  assigneeInitials: string | null;
  status: string;
  done: boolean;
  unassigned: boolean;
}

export interface PipelineStage {
  key: "leads" | "quotes" | "approved" | "scheduled" | "done" | "invoiced";
  count: number;
  amount: number | null;
  /** Leak stages get the orange dot, orange hint and a fix button. */
  leak: boolean;
  overdue?: number;
}

export interface MoneyPipeline {
  stages: PipelineStage[];
  totalInProgress: number;
}

export interface WeekPoint {
  key: string;
  /** Day number label ("12"). */
  dayLabel: string;
  /** "YYYY-MM" of the week start; the component shows the month only when it changes. */
  monthKey: string;
  collected: number;
  invoiced: number;
  isCurrent: boolean;
}

/* ------------------------------------------------------------------ */
/* Fetchers (tenant-scoped)                                            */
/* ------------------------------------------------------------------ */

const DONE_JOB = ["COMPLETED", "PAID"];
const OPEN_INVOICE = ["UNPAID", "PARTIALLY PAID"];

async function businessTz(
  businessId: string,
  fallback?: { timezone?: string | null; regionCode?: string | null } | null
): Promise<{ timezone: string; regionCode: string | null }> {
  if (fallback?.timezone) {
    return { timezone: fallback.timezone, regionCode: fallback.regionCode ?? null };
  }
  const b = await prisma.business.findUnique({
    where: { id: businessId },
    select: { timezone: true, regionCode: true },
  });
  return { timezone: b?.timezone ?? "America/Toronto", regionCode: b?.regionCode ?? null };
}

/** Header: visits today, done today, amount ready to invoice. */
export async function getHeaderSummary(
  businessId: string,
  biz?: { timezone?: string | null; regionCode?: string | null } | null
): Promise<HeaderSummary> {
  const { timezone, regionCode } = await businessTz(businessId, biz);
  const todayKey = todayInTimezone(timezone, regionCode);
  // Part A: the day window is anchored in the business timezone.
  const { gte: todayStart, lte: todayEnd } = dayRangeInTimezone(todayKey, timezone);
  const jobs = await prisma.job.findMany({
    where: {
      businessId,
      archivedAt: null,
      status: { not: "CANCELLED" },
      date: { gte: todayStart, lte: todayEnd },
    },
    select: { status: true },
  });
  const ready = await prisma.job.findMany({
    where: { businessId, archivedAt: null, status: "COMPLETED", invoices: { none: {} } },
    select: { priceCents: true },
  });
  return {
    visitsToday: jobs.length,
    doneToday: jobs.filter((j) => DONE_JOB.includes(j.status)).length,
    readyToInvoice: ready.reduce((s, j) => s + centsToDollars(j.priceCents), 0),
    dateKey: todayKey,
  };
}

/** UTC calendar key of a Date ("YYYY-MM-DD"). Invoice dates are stored as
 *  UTC-midnight of the calendar date the user picked, so the UTC date IS
 *  the business-local invoice date (see revenue.ts). */
function utcDayKey(d: Date): string {
  const p = (v: number) => String(v).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}

interface MoneyRow {
  payments: { createdAt: Date; amountCents: bigint | null }[];
  invoices: { date: Date; totalCents: bigint | null }[];
  jobs: { date: Date; status: string }[];
}

/** Shared money/job rows for the Collected card and the Last-8-weeks chart. */
async function getMoneyRows(businessId: string, monthsBack: number): Promise<MoneyRow> {
  const now = new Date();
  const rangeStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsBack, 1));
  const [payments, invoices, jobs] = await Promise.all([
    prisma.payment.findMany({
      where: {
        businessId,
        status: "COMPLETED",
        createdAt: { gte: rangeStart },
        invoice: { voidedAt: null },
      },
      select: { createdAt: true, amountCents: true },
    }),
    prisma.invoice.findMany({
      where: { businessId, voidedAt: null, date: { gte: rangeStart } },
      select: { date: true, totalCents: true },
    }),
    prisma.job.findMany({
      where: { businessId, archivedAt: null, date: { gte: rangeStart } },
      select: { date: true, status: true },
    }),
  ]);
  return { payments, invoices, jobs };
}

/**
 * The Collected card: this week vs the same elapsed days of last week, and
 * this month vs the same elapsed days of last month. Bars are per-day for
 * the week and per-month for the six-month view.
 */
export async function getCollected(
  businessId: string,
  biz?: { timezone?: string | null; regionCode?: string | null } | null
): Promise<CollectedData> {
  const { timezone, regionCode } = await businessTz(businessId, biz);
  const todayKey = todayInTimezone(timezone, regionCode);
  const { payments, invoices, jobs } = await getMoneyRows(businessId, 8);

  const paidItems = payments.map((p) => ({ at: p.createdAt, amount: centsToDollars(p.amountCents) }));
  const invItems = invoices.map((i) => ({ at: i.date, amount: centsToDollars(i.totalCents) }));

  /* ---- week view ---- */
  const wKeys = weekDayKeys(todayKey);
  const wSums = bucketSumsByDay(paidItems, wKeys, timezone);
  const elapsed = weekdayIndex(todayKey); // 0 = Monday
  const prevWKeys = weekDayKeys(addDaysToKey(todayKey, -7)).slice(0, elapsed + 1);
  const prevWSums = bucketSumsByDay(paidItems, prevWKeys, timezone);
  const weekTotal = wSums.slice(0, elapsed + 1).reduce((a, b) => a + b, 0);
  const weekPrev = prevWSums.reduce((a, b) => a + b, 0);
  const weekBars: DayBar[] = wKeys.map((key, i) => ({
    key,
    weekday: i,
    amount: wSums[i],
    isToday: key === todayKey,
    isFuture: i > elapsed,
  }));
  const weekInvoiced = invItems
    .filter((r) => { const k = utcDayKey(r.at); return k >= wKeys[0] && k <= todayKey; })
    .reduce((s, r) => s + r.amount, 0);
  const weekJobs = jobs.filter((j) => {
    const k = utcDayKey(j.date);
    return k >= wKeys[0] && k <= todayKey && j.status !== "CANCELLED";
  });

  /* ---- month view (6 months) ---- */
  const mKeys = monthKeys(todayKey, 6);
  const monthSums = mKeys.map((mk) =>
    paidItems
      .filter((r) => dayKeyInTz(r.at, timezone).startsWith(mk))
      .reduce((s, r) => s + r.amount, 0)
  );
  const thisMonth = mKeys[mKeys.length - 1];
  const prevMonth = mKeys[mKeys.length - 2];
  const todayDay = Number(todayKey.slice(8, 10));
  const prevMonthLen = new Date(
    Date.UTC(Number(prevMonth.slice(0, 4)), Number(prevMonth.slice(5, 7)), 0)
  ).getUTCDate();
  const prevDayCap = Math.min(todayDay, prevMonthLen);
  const monthTotal = paidItems
    .filter((r) => {
      const k = dayKeyInTz(r.at, timezone);
      return k.startsWith(thisMonth) && k <= todayKey;
    })
    .reduce((s, r) => s + r.amount, 0);
  const monthPrev = paidItems
    .filter((r) => {
      const k = dayKeyInTz(r.at, timezone);
      return k.startsWith(prevMonth) && Number(k.slice(8, 10)) <= prevDayCap;
    })
    .reduce((s, r) => s + r.amount, 0);
  const monthBars: DayBar[] = mKeys.map((key, i) => ({
    key,
    weekday: -1,
    amount: monthSums[i],
    isToday: false,
    isFuture: false,
  }));
  const monthInvoiced = invItems
    .filter((r) => { const k = utcDayKey(r.at); return k.startsWith(thisMonth) && k <= todayKey; })
    .reduce((s, r) => s + r.amount, 0);
  const monthJobs = jobs.filter((j) => {
    const k = utcDayKey(j.date);
    return k.startsWith(thisMonth) && k <= todayKey && j.status !== "CANCELLED";
  });

  return {
    week: {
      total: weekTotal,
      prevTotal: weekPrev,
      changePct: changePct(weekTotal, weekPrev),
      bars: weekBars,
      barMonths: [],
      invoiced: weekInvoiced,
      jobsDone: weekJobs.filter((j) => DONE_JOB.includes(j.status)).length,
      jobsTotal: weekJobs.length,
    },
    month: {
      total: monthTotal,
      prevTotal: monthPrev,
      changePct: changePct(monthTotal, monthPrev),
      bars: monthBars,
      barMonths: mKeys,
      invoiced: monthInvoiced,
      jobsDone: monthJobs.filter((j) => DONE_JOB.includes(j.status)).length,
      jobsTotal: monthJobs.length,
    },
  };
}

/**
 * "Needs you": the top 4 attention-engine items plus the total count for
 * the badge. Each item carries one action (ctaKey + href) that opens a
 * draft or a picker - nothing is ever sent from the dashboard.
 */
export async function getNeedsYou(
  businessId: string,
  locale: "en" | "fr" = "en"
): Promise<NeedsYouData> {
  const all = await getAttentionItems(businessId, 100, locale);
  return { items: all.slice(0, 4), total: all.length };
}

/**
 * Key numbers (2x2 tiles). Every number equals its filtered list:
 * - owed = the unpaid-invoices total; overdue is the past-due slice
 * - readyToInvoice = completed jobs with no invoice yet
 * - quotesWaiting = SENT quotes; "expiring soon" uses the 30-day validity
 *   heuristic (Quote has no expiresAt/sentAt; updatedAt is the sent proxy)
 * - newLeads = NEW leads; first-reply stats come from Communication rows:
 *   first reply = updatedAt - waitingSince on REPLIED rows (the Part 0 seed
 *   definition), oldest waiting = max(now - waitingSince) on WAITING rows.
 */
export async function getKeyNumbers(
  businessId: string,
  biz?: { timezone?: string | null; regionCode?: string | null } | null
): Promise<KeyNumbers> {
  const { timezone } = await businessTz(businessId, biz);
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);

  const [invoices, readyJobs, quotes, leads, comms] = await Promise.all([
    prisma.invoice.findMany({
      where: { businessId, status: { in: OPEN_INVOICE }, voidedAt: null },
      select: {
        date: true,
        totalCents: true,
        payments: { where: { status: "COMPLETED" }, select: { amountCents: true } },
      },
    }),
    prisma.job.findMany({
      where: { businessId, archivedAt: null, status: "COMPLETED", invoices: { none: {} } },
      select: { priceCents: true, customer: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
      take: 50,
    }),
    prisma.quote.findMany({
      where: { businessId, status: "SENT" },
      select: { totalCents: true, updatedAt: true },
    }),
    prisma.lead.count({ where: { businessId, status: "NEW" } }),
    prisma.communication.findMany({
      where: { businessId, createdAt: { gte: weekAgo } },
      select: { status: true, waitingSince: true, updatedAt: true },
    }),
  ]);

  const open = invoices
    .map((inv) => {
      const total = centsToDollars(inv.totalCents);
      const paid = inv.payments.reduce((s, p) => s + centsToDollars(p.amountCents), 0);
      const outstanding = Math.max(0, total - paid);
      return { outstanding, overdueDays: daysOverdue(inv.date, now, timezone) };
    })
    .filter((r) => r.outstanding > 0);
  const owedTotal = open.reduce((s, r) => s + r.outstanding, 0);
  const overdue = open
    .filter((r) => r.overdueDays > 0)
    .reduce((s, r) => s + r.outstanding, 0);

  const expiringSoonCutoff = new Date(now.getTime() - 23 * 86_400_000);
  const expiredCutoff = new Date(now.getTime() - 30 * 86_400_000);
  const expiringSoon = quotes.filter(
    (q) => q.updatedAt <= expiringSoonCutoff && q.updatedAt > expiredCutoff
  ).length;

  const replied = comms.filter((c) => c.status === "REPLIED" || c.status === "RESOLVED");
  const replyMins = replied.map((c) => (c.updatedAt.getTime() - c.waitingSince.getTime()) / 60000);
  const waiting = comms.filter((c) => c.status === "WAITING");
  const waitingMins = waiting.map((c) => (now.getTime() - c.waitingSince.getTime()) / 60000);

  return {
    owed: {
      total: owedTotal,
      overdue,
      aging: agingSplit(open),
    },
    readyToInvoice: {
      amount: readyJobs.reduce((s, j) => s + centsToDollars(j.priceCents), 0),
      jobs: readyJobs.length,
      customerInitials: uniqueInitials(readyJobs.map((j) => j.customer.name)),
    },
    quotesWaiting: {
      amount: quotes.reduce((s, q) => s + centsToDollars(q.totalCents), 0),
      count: quotes.length,
      expiringSoon,
    },
    newLeads: {
      waiting: leads,
      avgFirstReplyMin:
        replyMins.length > 0 ? Math.round(replyMins.reduce((a, b) => a + b, 0) / replyMins.length) : null,
      oldestWaitingMin: waitingMins.length > 0 ? Math.round(Math.max(...waitingMins)) : null,
    },
  };
}

/** Today's visits in the business timezone, ordered by time. */
export async function getTodaysVisits(
  businessId: string,
  opts?: {
    timezone?: string | null;
    regionCode?: string | null;
    /** When set, only visits assigned to this user (technician "My day"). */
    technicianUserId?: string | null;
  }
): Promise<{ visits: VisitRow[]; nowMinutes: number }> {
  const { timezone, regionCode } = await businessTz(businessId, {
    timezone: opts?.timezone,
    regionCode: opts?.regionCode,
  });
  const todayKey = todayInTimezone(timezone, regionCode);
  const { gte: todayStart, lte: todayEnd } = dayRangeInTimezone(todayKey, timezone);

  const jobs = await prisma.job.findMany({
    where: {
      businessId,
      archivedAt: null,
      status: { not: "CANCELLED" },
      date: { gte: todayStart, lte: todayEnd },
      ...(opts?.technicianUserId
        ? {
            OR: [
              { assignedToId: opts.technicianUserId },
              { jobAssignments: { some: { userId: opts.technicianUserId } } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      title: true,
      time: true,
      startAt: true,
      status: true,
      technician: true,
      assignedTo: { select: { name: true } },
      customer: { select: { name: true, address: true } },
      service: { select: { name: true, nameFr: true, category: true, iconKey: true } },
    },
    orderBy: [{ time: "asc" }, { createdAt: "asc" }],
  });

  const visits: VisitRow[] = jobs.map((j) => {
    const assignee = j.assignedTo?.name ?? j.technician ?? null;
    const done = DONE_JOB.includes(j.status);
    return {
      id: j.id,
      time: j.time,
      tradeIcon: tradeIconNameForJob(j),
      title: j.title,
      customerName: j.customer.name,
      area: areaFromAddress(j.customer.address),
      assigneeName: assignee,
      assigneeInitials: assignee ? initialsOf(assignee) : null,
      status: j.status,
      done,
      unassigned: !done && !assignee,
    };
  });

  // "Now" in business-local minutes for the now-marker position.
  const nowParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (t: string) => nowParts.find((p) => p.type === t)?.value ?? "0";
  const nowMinutes = Number(get("hour")) * 60 + Number(get("minute"));

  return { visits, nowMinutes };
}

/**
 * "Where your money is": the pipeline stages. "Approved, not scheduled"
 * counts NEW jobs with no scheduled date/time (the schema has no
 * quote-to-job link, so approved quotes are visible one stage earlier as
 * "quotes out"). "Done, not invoiced" and "approved, not scheduled" are
 * the leaks.
 */
export async function getMoneyPipeline(businessId: string): Promise<MoneyPipeline> {
  const [leadCount, quotes, unscheduled, scheduled, doneJobs, openInvoices] = await Promise.all([
    prisma.lead.count({ where: { businessId, status: "NEW" } }),
    prisma.quote.findMany({
      where: { businessId, status: "SENT" },
      select: { totalCents: true },
    }),
    prisma.job.findMany({
      where: { businessId, archivedAt: null, status: "NEW", startAt: null, time: null },
      select: { priceCents: true },
    }),
    prisma.job.findMany({
      where: { businessId, archivedAt: null, status: { in: ["SCHEDULED", "IN PROGRESS"] } },
      select: { priceCents: true },
    }),
    prisma.job.findMany({
      where: { businessId, archivedAt: null, status: "COMPLETED", invoices: { none: {} } },
      select: { priceCents: true },
    }),
    prisma.invoice.findMany({
      where: { businessId, status: { in: OPEN_INVOICE }, voidedAt: null },
      select: {
        date: true,
        totalCents: true,
        payments: { where: { status: "COMPLETED" }, select: { amountCents: true } },
      },
    }),
  ]);

  const sumCents = (rows: { priceCents: bigint | null }[]) =>
    rows.reduce((s, r) => s + centsToDollars(r.priceCents), 0);
  const sumQuoteCents = (rows: { totalCents: bigint | null }[]) =>
    rows.reduce((s, r) => s + centsToDollars(r.totalCents), 0);
  const invOpen = openInvoices
    .map((inv) => {
      const total = centsToDollars(inv.totalCents);
      const paid = inv.payments.reduce((s, p) => s + centsToDollars(p.amountCents), 0);
      return { outstanding: Math.max(0, total - paid), overdueDays: daysOverdue(inv.date) };
    })
    .filter((r) => r.outstanding > 0);
  const invTotal = invOpen.reduce((s, r) => s + r.outstanding, 0);
  const invOverdue = invOpen.filter((r) => r.overdueDays > 0).reduce((s, r) => s + r.outstanding, 0);

  const quotesAmt = sumQuoteCents(quotes);
  const unscheduledAmt = sumCents(unscheduled);
  const scheduledAmt = sumCents(scheduled);
  const doneAmt = sumCents(doneJobs);

  const stages: PipelineStage[] = [
    { key: "leads", count: leadCount, amount: null, leak: false },
    { key: "quotes", count: quotes.length, amount: quotesAmt, leak: false },
    { key: "approved", count: unscheduled.length, amount: unscheduledAmt, leak: unscheduled.length > 0 },
    { key: "scheduled", count: scheduled.length, amount: scheduledAmt, leak: false },
    { key: "done", count: doneJobs.length, amount: doneAmt, leak: doneJobs.length > 0 },
    {
      key: "invoiced",
      count: invOpen.length,
      amount: invTotal,
      leak: false,
      overdue: invOverdue,
    },
  ];
  return {
    stages,
    totalInProgress: quotesAmt + unscheduledAmt + scheduledAmt + doneAmt + invTotal,
  };
}

/** Last 8 weeks: collected vs invoiced per week (Mon-Sun), current marked. */
export async function getLast8Weeks(
  businessId: string,
  biz?: { timezone?: string | null; regionCode?: string | null } | null
): Promise<WeekPoint[]> {
  const { timezone, regionCode } = await businessTz(businessId, biz);
  const todayKey = todayInTimezone(timezone, regionCode);
  const thisMonday = addDaysToKey(todayKey, -weekdayIndex(todayKey));
  const { payments, invoices } = await getMoneyRows(businessId, 3);

  const paidItems = payments.map((p) => ({ at: p.createdAt, amount: centsToDollars(p.amountCents) }));
  const invItems = invoices.map((i) => ({ at: i.date, amount: centsToDollars(i.totalCents) }));

  const weeks: WeekPoint[] = [];
  for (let w = 7; w >= 0; w--) {
    const monday = addDaysToKey(thisMonday, -7 * w);
    const sunday = addDaysToKey(monday, 6);
    const collected = paidItems
      .filter((r) => { const k = dayKeyInTz(r.at, timezone); return k >= monday && k <= sunday; })
      .reduce((s, r) => s + r.amount, 0);
    const invoiced = invItems
      .filter((r) => { const k = utcDayKey(r.at); return k >= monday && k <= sunday; })
      .reduce((s, r) => s + r.amount, 0);
    weeks.push({
      key: monday,
      dayLabel: String(Number(monday.slice(8, 10))),
      monthKey: monday.slice(0, 7),
      collected,
      invoiced,
      isCurrent: w === 0,
    });
  }
  return weeks;
}

/**
 * Scroll lesson 1 — the "Continue" candidate: the single record the pro
 * should resume on open. Tenant-scoped; technicians only ever see their
 * own jobs (never quotes or invoices, which carry money).
 */
export async function getContinueCandidate(
  businessId: string,
  opts?: {
    timezone?: string | null;
    regionCode?: string | null;
    /** When set, only visits assigned to this user (technician "My day"). */
    technicianUserId?: string | null;
  }
): Promise<ContinueCandidate | null> {
  const { timezone, regionCode } = await businessTz(businessId, {
    timezone: opts?.timezone,
    regionCode: opts?.regionCode,
  });
  const todayKey = todayInTimezone(timezone, regionCode);
  const techFilter = opts?.technicianUserId
    ? {
        OR: [
          { assignedToId: opts.technicianUserId },
          { jobAssignments: { some: { userId: opts.technicianUserId } } },
        ],
      }
    : {};

  const [jobs, quotes, invoices] = await Promise.all([
    prisma.job.findMany({
      where: {
        businessId,
        archivedAt: null,
        status: { in: ["NEW", "SCHEDULED", "IN PROGRESS"] },
        ...techFilter,
      },
      select: {
        id: true,
        title: true,
        time: true,
        date: true,
        startAt: true,
        updatedAt: true,
        status: true,
        customer: { select: { name: true, address: true } },
      },
    }),
    opts?.technicianUserId
      ? Promise.resolve([])
      : prisma.quote.findMany({
          where: { businessId, status: "DRAFT" },
          select: {
            id: true,
            title: true,
            updatedAt: true,
            customer: { select: { name: true } },
          },
          orderBy: { updatedAt: "desc" },
          take: 5,
        }),
    opts?.technicianUserId
      ? Promise.resolve([])
      : prisma.invoice.findMany({
          where: { businessId, status: { in: OPEN_INVOICE }, voidedAt: null },
          select: {
            id: true,
            number: true,
            date: true,
            updatedAt: true,
            customer: { select: { name: true } },
          },
          orderBy: { date: "asc" },
          take: 5,
        }),
  ]);

  const jobRows: ContinueJobRow[] = jobs.map((j) => ({
    id: j.id,
    title: j.title,
    customerName: j.customer.name,
    area: areaFromAddress(j.customer.address),
    status: j.status,
    date: j.date,
    time: j.time,
    startAt: j.startAt,
    updatedAt: j.updatedAt,
  }));
  const quoteRows: ContinueQuoteRow[] = quotes.map((q) => ({
    id: q.id,
    title: q.title,
    customerName: q.customer.name,
    updatedAt: q.updatedAt,
  }));
  const invoiceRows: ContinueInvoiceRow[] = invoices.map((inv) => ({
    id: inv.id,
    number: inv.number,
    customerName: inv.customer.name,
    date: inv.date,
    updatedAt: inv.updatedAt,
  }));

  return selectContinueCandidate(
    { jobs: jobRows, quotes: quoteRows, invoices: invoiceRows },
    { todayKey, timezone, now: new Date() }
  );
}
