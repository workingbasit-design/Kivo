/**
 * Jobs list view-model (all-modules redesign, Part 3 group 1).
 *
 * Pure helpers that turn job rows into the ListScreen pattern's groups:
 * filters All / Late / Today / Upcoming / To invoice, and groups Late /
 * Today / Tomorrow / Later / Earlier this week (spec Part 3, group 1).
 *
 * Late = not started (NEW/SCHEDULED) AND the start time has passed;
 * in-progress work past its end time is "Running over" (standing owner
 * rule, 2026-10-17). Both derive from lib/job-status.ts — the same
 * functions the Dashboard and Schedule screens use.
 */
import { isJobLate, isRunningOver } from './job-status.ts';
import { toISODateInTimezone } from './utils.ts';
import { tradeKeyForService, type TradeKey } from './trade-icons.ts';

export type JobListFilterId = 'all' | 'late' | 'today' | 'upcoming' | 'invoice';

export type JobListGroupId = 'late' | 'today' | 'tomorrow' | 'later' | 'earlier';

export interface JobListInput {
  id: string;
  title: string;
  date: Date | string;
  time?: string | null;
  timeTbd?: boolean | null;
  startAt?: Date | string | null;
  endAt?: Date | string | null;
  status: string;
  priceCents: bigint | number;
  noCharge?: boolean | null;
  address?: string | null;
  technician?: string | null;
  customer: { id: string; name: string };
  service?: {
    name: string;
    nameFr?: string | null;
    category?: string | null;
    iconKey?: string | null;
  } | null;
  assignedTo?: { id: string; name: string | null } | null;
  invoices: { id: string }[];
}

export interface JobListRowVm {
  id: string;
  title: string;
  customerName: string;
  address: string | null;
  /** Calendar day key (YYYY-MM-DD) in the business timezone. */
  dayKey: string;
  /** "HH:MM" 24h, or null when unset/TBD. */
  time: string | null;
  priceCents: number;
  noCharge: boolean;
  status: string;
  tradeKey: TradeKey;
  techName: string | null;
  late: boolean;
  runningOver: boolean;
  uninvoiced: boolean;
  filterIds: JobListFilterId[];
  groupId: JobListGroupId;
}

function toNumber(v: bigint | number): number {
  return typeof v === 'bigint' ? Number(v) : v;
}

/** Add n days to a YYYY-MM-DD key (pure calendar arithmetic, no DST risk). */
export function addDaysKey(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  const p = (x: number) => String(x).padStart(2, '0');
  return `${dt.getUTCFullYear()}-${p(dt.getUTCMonth() + 1)}-${p(dt.getUTCDate())}`;
}

/**
 * Classify one job for the list: Late / Running-over derivation, the group
 * it belongs to, and the filter chips it counts toward. `now` is
 * injectable for tests.
 */
export function classifyJobRow(
  job: JobListInput,
  now: Date,
  timezone: string,
): JobListRowVm {
  const startInstant =
    job.startAt instanceof Date
      ? job.startAt
      : job.startAt
        ? new Date(job.startAt)
        : null;
  const daySource =
    startInstant && !Number.isNaN(startInstant.getTime())
      ? startInstant
      : job.date instanceof Date
        ? job.date
        : new Date(job.date);
  const dayKey = toISODateInTimezone(daySource, timezone);

  const late = isJobLate(
    { date: job.date, startAt: job.startAt ?? null, status: job.status },
    now,
    timezone,
  );
  const runningOver = isRunningOver(
    {
      status: job.status,
      endAt: job.endAt ?? null,
      startAt: job.startAt ?? null,
      date: job.date,
      time: job.time ?? null,
    },
    now,
  );
  const uninvoiced =
    job.status === 'COMPLETED' && job.invoices.length === 0;

  const todayKey = toISODateInTimezone(now, timezone);
  const tomorrowKey = addDaysKey(todayKey, 1);
  let groupId: JobListGroupId;
  if (late) groupId = 'late';
  else if (dayKey === todayKey) groupId = 'today';
  else if (dayKey === tomorrowKey) groupId = 'tomorrow';
  else if (dayKey > tomorrowKey) groupId = 'later';
  else groupId = 'earlier';

  const filterIds: JobListFilterId[] = ['all'];
  if (late) filterIds.push('late');
  if (dayKey === todayKey && !late) filterIds.push('today');
  if ((dayKey === tomorrowKey || dayKey > tomorrowKey) && !late)
    filterIds.push('upcoming');
  if (uninvoiced) filterIds.push('invoice');

  const time =
    job.timeTbd || !job.time || !job.time.trim() ? null : job.time.trim();

  return {
    id: job.id,
    title: job.title,
    customerName: job.customer.name,
    address: job.address?.trim() ? job.address.trim() : null,
    dayKey,
    time,
    priceCents: toNumber(job.priceCents),
    noCharge: job.noCharge ?? false,
    status: job.status,
    tradeKey: job.service
      ? tradeKeyForService(job.service)
      : tradeKeyForService({ name: job.title }),
    techName:
      job.assignedTo?.name?.trim() ||
      job.technician?.trim() ||
      null,
    late,
    runningOver,
    uninvoiced,
    filterIds,
    groupId,
  };
}

/** Fixed group order for the list (Late first, as in the mockup). */
export const JOB_LIST_GROUP_ORDER: JobListGroupId[] = [
  'late',
  'today',
  'tomorrow',
  'later',
  'earlier',
];

/**
 * Narrow rows by a search query (title, customer, address). Pure — the
 * client calls this on every keystroke; chip counts are computed from the
 * narrowed rows so they always match the list.
 */
export function searchJobRows(rows: JobListRowVm[], query: string): JobListRowVm[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter(
    (r) =>
      r.title.toLowerCase().includes(q) ||
      r.customerName.toLowerCase().includes(q) ||
      (r.address ?? '').toLowerCase().includes(q),
  );
}

export type JobListSort = 'date' | 'amount' | 'customer';

/** Sort rows inside each group: soonest first, highest value, or A–Z. */
export function sortJobRows(
  rows: JobListRowVm[],
  sort: JobListSort,
  locale: string = 'en',
): JobListRowVm[] {
  const out = [...rows];
  if (sort === 'amount') {
    out.sort((a, b) => b.priceCents - a.priceCents);
  } else if (sort === 'customer') {
    out.sort((a, b) => a.customerName.localeCompare(b.customerName, locale));
  } else {
    out.sort((a, b) => {
      if (a.dayKey !== b.dayKey) return a.dayKey < b.dayKey ? -1 : 1;
      return (a.time ?? '').localeCompare(b.time ?? '');
    });
  }
  return out;
}

/**
 * "Was due" date label in the shared "Tue, Sep 29" style (business
 * timezone). Cached formatters per locale+timezone like the dashboard.
 */
const dueFmtCache = new Map<string, Intl.DateTimeFormat>();
export function formatWasDueDate(
  dayKey: string,
  timezone: string,
  locale: 'en' | 'fr' = 'en',
): string {
  const cacheKey = `${locale}|${timezone}`;
  let fmt = dueFmtCache.get(cacheKey);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(locale === 'fr' ? 'fr-CA' : 'en-CA', {
      timeZone: timezone,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    dueFmtCache.set(cacheKey, fmt);
  }
  const [y, m, d] = dayKey.split('-').map(Number);
  return fmt.format(new Date(Date.UTC(y, m - 1, d, 12)));
}
