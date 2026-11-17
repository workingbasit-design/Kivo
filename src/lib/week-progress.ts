import { toISODateInTimezone } from './utils.ts';

/**
 * Scroll lesson 5 — forgiving weekly progress.
 *
 * Seven dots for the current week (Mon…Sun, business timezone) plus three
 * week totals: jobs done, invoices issued, money collected. A dot is
 * filled when that day had any of the three; a quiet day is just an
 * unfilled dot — there is deliberately NO streak anywhere here: no count
 * to break, no red for a missed day, no "you lost your streak" copy.
 * Future days are dimmed (not yet happened, not failed).
 *
 * Attribution, stated plainly: jobs count on their SCHEDULED day when
 * completed (a job finished late still fills its scheduled day — that is
 * the forgiving part); invoices count on their issue date; payments count
 * on the day they were recorded. The fetcher filters to completed /
 * non-voided rows; this function only buckets and totals.
 */

export interface WeekProgressRow {
  day: Date;
}

export interface WeekPaymentRow {
  createdAt: Date;
  amountCents: number;
}

export interface WeekDayTotals {
  jobsDone: number;
  invoicesIssued: number;
  collectedCents: number;
}

export interface WeekProgress {
  /** Mon…Sun keys of the week. */
  weekKeys: string[];
  /** Today's key (for the ring around today's dot). */
  todayKey: string;
  /** One entry per week key: true when the day had any activity. */
  active: boolean[];
  /** One entry per week key: true when the day is after today. */
  future: boolean[];
  jobsDone: number;
  invoicesIssued: number;
  collectedCents: number;
  /** One entry per week key: that day's own totals (weekly pulse). */
  perDay: WeekDayTotals[];
}

/**
 * ISO-8601 week number for a "YYYY-MM-DD" date key. The week belongs to
 * the year that holds its Thursday (the standard ISO rule); the
 * Thursday-shifted date's day-of-year divided into weeks gives the
 * number. Pure and unit-tested.
 */
export function isoWeekNumber(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  // Shift to the Thursday of this ISO week.
  const day = (date.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  date.setUTCDate(date.getUTCDate() - day + 3);
  const thursdayYear = date.getUTCFullYear();
  const jan1 = new Date(Date.UTC(thursdayYear, 0, 1));
  const dayOfYear = Math.floor((date.getTime() - jan1.getTime()) / 86400000) + 1;
  return Math.ceil(dayOfYear / 7);
}

export function computeWeekProgress(input: {
  weekKeys: string[];
  todayKey: string;
  timezone: string;
  jobs: WeekProgressRow[];
  invoices: WeekProgressRow[];
  payments: WeekPaymentRow[];
}): WeekProgress {
  const index = new Map(input.weekKeys.map((k, i) => [k, i]));
  const inWeek = (d: Date) => index.has(toISODateInTimezone(d, input.timezone));
  // Week-scoped twice over: the fetcher queries the week range, and this
  // filter makes the contract airtight for any caller.
  const jobs = input.jobs.filter((j) => inWeek(j.day));
  const invoices = input.invoices.filter((inv) => inWeek(inv.day));
  const payments = input.payments.filter((pay) => inWeek(pay.createdAt));
  const active = input.weekKeys.map(() => false);
  const perDay: WeekDayTotals[] = input.weekKeys.map(() => ({
    jobsDone: 0,
    invoicesIssued: 0,
    collectedCents: 0,
  }));
  const mark = (d: Date) => {
    const i = index.get(toISODateInTimezone(d, input.timezone));
    if (i !== undefined) active[i] = true;
  };
  jobs.forEach((j) => {
    mark(j.day);
    const i = index.get(toISODateInTimezone(j.day, input.timezone));
    if (i !== undefined) perDay[i].jobsDone += 1;
  });
  invoices.forEach((inv) => {
    mark(inv.day);
    const i = index.get(toISODateInTimezone(inv.day, input.timezone));
    if (i !== undefined) perDay[i].invoicesIssued += 1;
  });
  payments.forEach((pay) => {
    mark(pay.createdAt);
    const i = index.get(toISODateInTimezone(pay.createdAt, input.timezone));
    if (i !== undefined) perDay[i].collectedCents += pay.amountCents;
  });
  return {
    weekKeys: input.weekKeys,
    todayKey: input.todayKey,
    active,
    future: input.weekKeys.map((k) => k > input.todayKey),
    jobsDone: jobs.length,
    invoicesIssued: invoices.length,
    collectedCents: payments.reduce((sum, p) => sum + p.amountCents, 0),
    perDay,
  };
}
