import { prisma } from '@/lib/prisma';
import { todayInTimezone, dayRange, toISODateLocal } from '@/lib/utils';
import { t, type Locale } from '@/lib/i18n/index';

/**
 * In-app notification center (Track 3).
 *
 * Notifications are GENERATED from real records (jobs, invoices, quotes,
 * bookings, payments) — nothing is ever seeded or faked. A dismissed
 * notification never reappears for the same underlying record (dedupeKey).
 * Read state is per business: 1–5 person shops share one inbox.
 *
 * In-app ONLY. Nothing in this module sends WhatsApp, SMS, email, or any
 * other external message — it only writes Notification rows.
 */

export const NOTIFICATION_TYPES = [
  'job_tomorrow',
  'job_soon',
  'invoice_overdue',
  'quote_expiring',
  'booking_new',
  'payment_recorded',
  'messaging_quota',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export type NotificationSettings = Record<NotificationType, boolean>;

export function defaultSettings(): NotificationSettings {
  return {
    job_tomorrow: true,
    job_soon: true,
    invoice_overdue: true,
    quote_expiring: true,
    booking_new: true,
    payment_recorded: true,
    messaging_quota: true,
  };
}

/** Parse the Business.notificationSettings JSON; unknown/missing keys default ON. */
export function parseSettings(raw: string | null | undefined): NotificationSettings {
  const out = defaultSettings();
  if (!raw) return out;
  try {
    const parsed = JSON.parse(raw) as Partial<Record<NotificationType, unknown>>;
    for (const key of NOTIFICATION_TYPES) {
      if (typeof parsed[key] === 'boolean') out[key] = parsed[key];
    }
  } catch {
    // Corrupt JSON -> safe default: everything on.
  }
  return out;
}

export function serializeSettings(s: NotificationSettings): string {
  const out: Record<string, boolean> = {};
  for (const key of NOTIFICATION_TYPES) out[key] = !!s[key];
  return JSON.stringify(out);
}

/** Fill a "{param}" template. Missing params render as "". */
export function fill(template: string, params: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => params[k] ?? '');
}

export interface NotificationCandidate {
  type: NotificationType;
  dedupeKey: string;
  href: string | null;
  data: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Pure candidate builders (no DB) — the generation logic unit tests target
// these directly with fixture rows.
// ---------------------------------------------------------------------------

export interface JobRow {
  id: string;
  title: string;
  date: Date;
  time: string | null;
  status: string;
  customerName: string;
}

export interface InvoiceRow {
  id: string;
  number: string;
  date: Date;
  total: number;
  status: string;
  customerName: string;
}

export interface QuoteRow {
  id: string;
  number: string;
  total: number;
  status: string;
  createdAt: Date;
  customerName: string;
}

export interface PaymentRow {
  id: string;
  amount: number;
  createdAt: Date;
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
}

const ACTIVE_JOB_STATUSES = ['NEW', 'SCHEDULED', 'IN PROGRESS'];
const UNPAID_INVOICE_STATUSES = ['UNPAID', 'PARTIALLY PAID'];

/** "HH:MM" (24h canonical) -> minutes since midnight; null when unparseable.
 *  Tolerates a trailing am/pm ("9:30 pm" -> 1290). */
export function parseTimeMinutes(time: string | null | undefined): number | null {
  if (!time) return null;
  const m = time.match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  const rest = time.slice(m.index! + m[0].length);
  if (/pm/i.test(rest) && h < 12) h += 12;
  if (/am/i.test(rest) && h === 12) h = 0;
  return h * 60 + min;
}

/** Minutes since midnight for `d` in the given IANA timezone. */
export function minutesInTimezone(d: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? '0');
  const h = get('hour') % 24; // some locales emit 24:00 at midnight
  return h * 60 + get('minute');
}

export function buildJobTomorrow(jobs: JobRow[], tomorrowISO: string): NotificationCandidate[] {
  return jobs
    .filter(
      (j) =>
        ACTIVE_JOB_STATUSES.includes(j.status) && toISODateLocal(j.date) === tomorrowISO
    )
    .map((j) => ({
      type: 'job_tomorrow' as const,
      dedupeKey: `job_tomorrow:${j.id}:${tomorrowISO}`,
      href: `/jobs/${j.id}`,
      data: {
        job: j.title,
        customer: j.customerName,
        time: j.time ?? '',
      },
    }));
}

export function buildJobSoon(
  jobs: JobRow[],
  todayISO: string,
  nowMinutes: number,
  windowMinutes = 120
): NotificationCandidate[] {
  return jobs
    .filter((j) => {
      if (!ACTIVE_JOB_STATUSES.includes(j.status)) return false;
      if (toISODateLocal(j.date) !== todayISO) return false;
      const start = parseTimeMinutes(j.time);
      if (start === null) return false;
      return start >= nowMinutes && start <= nowMinutes + windowMinutes;
    })
    .map((j) => ({
      type: 'job_soon' as const,
      dedupeKey: `job_soon:${j.id}:${todayISO}`,
      href: `/jobs/${j.id}`,
      data: {
        job: j.title,
        customer: j.customerName,
        time: j.time ?? '',
      },
    }));
}

export function buildInvoiceOverdue(
  invoices: InvoiceRow[],
  cutoff: Date
): NotificationCandidate[] {
  return invoices
    .filter(
      (i) => UNPAID_INVOICE_STATUSES.includes(i.status) && i.date < cutoff
    )
    .map((i) => ({
      type: 'invoice_overdue' as const,
      dedupeKey: `invoice_overdue:${i.id}`,
      href: `/invoices/${i.id}`,
      data: {
        number: i.number,
        customer: i.customerName,
        amount: String(i.total),
      },
    }));
}

export function buildQuoteExpiring(quotes: QuoteRow[], cutoff: Date): NotificationCandidate[] {
  return quotes
    .filter((q) => q.status === 'SENT' && q.createdAt < cutoff)
    .map((q) => ({
      type: 'quote_expiring' as const,
      dedupeKey: `quote_expiring:${q.id}`,
      href: `/quotes/${q.id}`,
      data: {
        number: q.number,
        customer: q.customerName,
        amount: String(q.total),
      },
    }));
}

export function buildBookingNew(jobs: JobRow[], since: Date): NotificationCandidate[] {
  return jobs
    .filter((j) => j.status === 'NEW')
    .map((j) => ({
      type: 'booking_new' as const,
      dedupeKey: `booking_new:${j.id}`,
      href: `/jobs/${j.id}`,
      data: {
        job: j.title,
        customer: j.customerName,
        when: toISODateLocal(j.date),
      },
    }));
}

export function buildPaymentRecorded(
  payments: PaymentRow[],
  since: Date
): NotificationCandidate[] {
  return payments
    .filter((p) => p.createdAt >= since)
    .map((p) => ({
      type: 'payment_recorded' as const,
      dedupeKey: `payment_recorded:${p.id}`,
      href: `/invoices/${p.invoiceId}`,
      data: {
        amount: String(p.amount),
        number: p.invoiceNumber,
        customer: p.customerName,
      },
    }));
}

// ---------------------------------------------------------------------------
// Rendering (locale-aware, at read time)
// ---------------------------------------------------------------------------

export function renderNotificationTitle(
  type: NotificationType,
  data: Record<string, string>,
  locale: Locale
): string {
  return fill(t(locale, `notifications.t_${type}`), data);
}

export function renderNotificationBody(
  type: NotificationType,
  data: Record<string, string>,
  locale: Locale
): string {
  const withTime = { ...data };
  if (!withTime.time) withTime.time = t(locale, 'notifications.noTime');
  return fill(t(locale, `notifications.b_${type}`), withTime);
}

// ---------------------------------------------------------------------------
// DB-backed sync + reads (all tenant-scoped by businessId)
// ---------------------------------------------------------------------------

const MAX_PER_TYPE = 50;

export async function syncNotifications(businessId: string): Promise<number> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { timezone: true, regionCode: true, notificationSettings: true },
  });
  if (!business) return 0;
  const settings = parseSettings(business.notificationSettings);
  const timeZone = business.timezone || 'America/Toronto';

  // Disabled types: never generate, and clear their pending (unread) items so
  // the inbox immediately reflects the new preference.
  const disabled = NOTIFICATION_TYPES.filter((k) => !settings[k]);
  if (disabled.length > 0) {
    await prisma.notification.deleteMany({
      where: { businessId, type: { in: [...disabled] }, readAt: null },
    });
  }

  const now = new Date();
  const todayISO = todayInTimezone(timeZone, business.regionCode);
  // Tomorrow in the BUSINESS's timezone (not "now + 24h", which breaks near midnight).
  const [ty, tm, td] = todayISO.split('-').map(Number);
  const tomorrowISO = toISODateLocal(new Date(ty, tm - 1, td + 1));
  const nowMinutes = minutesInTimezone(now, timeZone);
  const overdueCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const recentSince = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const candidates: NotificationCandidate[] = [];

  if (settings.job_tomorrow || settings.job_soon) {
    const { gte: rangeStart } = dayRange(todayISO);
    const { lte: rangeEnd } = dayRange(tomorrowISO);
    const jobs = await prisma.job.findMany({
      where: {
        businessId,
        status: { in: ACTIVE_JOB_STATUSES },
        date: { gte: rangeStart, lte: rangeEnd },
      },
      select: {
        id: true,
        title: true,
        date: true,
        time: true,
        status: true,
        customer: { select: { name: true } },
      },
      take: MAX_PER_TYPE * 2,
    });
    const rows: JobRow[] = jobs.map((j) => ({
      id: j.id,
      title: j.title,
      date: j.date,
      time: j.time,
      status: j.status,
      customerName: j.customer.name,
    }));
    if (settings.job_tomorrow) candidates.push(...buildJobTomorrow(rows, tomorrowISO).slice(0, MAX_PER_TYPE));
    if (settings.job_soon) candidates.push(...buildJobSoon(rows, todayISO, nowMinutes).slice(0, MAX_PER_TYPE));
  }

  if (settings.invoice_overdue) {
    const invoices = await prisma.invoice.findMany({
      where: { businessId, status: { in: UNPAID_INVOICE_STATUSES }, date: { lt: overdueCutoff } },
      select: {
        id: true,
        number: true,
        date: true,
        total: true,
        status: true,
        customer: { select: { name: true } },
      },
      take: MAX_PER_TYPE,
    });
    candidates.push(
      ...buildInvoiceOverdue(
        invoices.map((i) => ({
          id: i.id,
          number: i.number,
          date: i.date,
          total: i.total,
          status: i.status,
          customerName: i.customer.name,
        })),
        overdueCutoff
      )
    );
  }

  if (settings.quote_expiring) {
    const quotes = await prisma.quote.findMany({
      where: { businessId, status: 'SENT', createdAt: { lt: overdueCutoff } },
      select: {
        id: true,
        number: true,
        total: true,
        status: true,
        createdAt: true,
        customer: { select: { name: true } },
      },
      take: MAX_PER_TYPE,
    });
    candidates.push(
      ...buildQuoteExpiring(
        quotes.map((q) => ({
          id: q.id,
          number: q.number,
          total: q.total,
          status: q.status,
          createdAt: q.createdAt,
          customerName: q.customer.name,
        })),
        overdueCutoff
      )
    );
  }

  if (settings.booking_new) {
    const bookings = await prisma.job.findMany({
      where: {
        businessId,
        status: 'NEW',
        notes: { contains: 'Booked online' },
        createdAt: { gte: recentSince },
      },
      select: {
        id: true,
        title: true,
        date: true,
        time: true,
        status: true,
        customer: { select: { name: true } },
      },
      take: MAX_PER_TYPE,
    });
    candidates.push(
      ...buildBookingNew(
        bookings.map((j) => ({
          id: j.id,
          title: j.title,
          date: j.date,
          time: j.time,
          status: j.status,
          customerName: j.customer.name,
        })),
        recentSince
      )
    );
  }

  if (settings.payment_recorded) {
    const payments = await prisma.payment.findMany({
      where: {
        status: 'COMPLETED',
        createdAt: { gte: recentSince },
        invoice: { businessId },
      },
      select: {
        id: true,
        amount: true,
        createdAt: true,
        invoiceId: true,
        invoice: {
          select: { number: true, customer: { select: { name: true } } },
        },
      },
      take: MAX_PER_TYPE,
    });
    candidates.push(
      ...buildPaymentRecorded(
        payments.map((p) => ({
          id: p.id,
          amount: p.amount,
          createdAt: p.createdAt,
          invoiceId: p.invoiceId,
          invoiceNumber: p.invoice.number,
          customerName: p.invoice.customer.name,
        })),
        recentSince
      )
    );
  }

  if (candidates.length === 0) return 0;
  const res = await prisma.notification.createMany({
    data: candidates.map((c) => ({
      businessId,
      type: c.type,
      data: JSON.stringify(c.data),
      href: c.href,
      dedupeKey: c.dedupeKey,
    })),
    skipDuplicates: true,
  });
  return res.count;
}

export interface ListedNotification {
  id: string;
  type: NotificationType;
  href: string | null;
  data: Record<string, string>;
  readAt: Date | null;
  createdAt: Date;
}

function parseData(raw: string | null): Record<string, string> {
  if (!raw) return {};
  try {
    const p = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(p)) out[k] = String(v ?? '');
    return out;
  } catch {
    return {};
  }
}

export async function listNotifications(
  businessId: string,
  limit = 100
): Promise<ListedNotification[]> {
  const rows = await prisma.notification.findMany({
    where: { businessId },
    orderBy: [{ readAt: { sort: 'asc', nulls: 'first' } }, { createdAt: 'desc' }],
    take: limit,
  });
  return rows.map((r) => ({
    id: r.id,
    type: r.type as NotificationType,
    href: r.href,
    data: parseData(r.data),
    readAt: r.readAt,
    createdAt: r.createdAt,
  }));
}

export async function getUnreadCount(businessId: string): Promise<number> {
  return prisma.notification.count({ where: { businessId, readAt: null } });
}

export async function markNotificationRead(id: string, businessId: string): Promise<void> {
  await prisma.notification.updateMany({
    where: { id, businessId },
    data: { readAt: new Date() },
  });
}

export async function markAllNotificationsRead(businessId: string): Promise<void> {
  await prisma.notification.updateMany({
    where: { businessId, readAt: null },
    data: { readAt: new Date() },
  });
}

export async function saveNotificationSettings(
  businessId: string,
  settings: NotificationSettings
): Promise<void> {
  await prisma.business.update({
    where: { id: businessId },
    data: { notificationSettings: serializeSettings(settings) },
  });
}
