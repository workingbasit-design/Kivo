/**
 * Morning Digest — the "AI teammate's" daily briefing.
 *
 * `getDigestData` composes everything an owner needs before the first coffee:
 * today's schedule, the top things needing action, the money picture, and the
 * week ahead. Pure data — rendering happens in the /digest page and the push
 * payload builder below.
 *
 * Delivery: the hourly /api/cron/digest route checks each business's
 * DigestSetting.sendTime against its local time and, on match, writes an
 * in-app Notification (dedupeKey = digest:YYYY-MM-DD) and fires a web push
 * when configured. Everything is $0: VAPID push + in-app only.
 */
import { prisma } from '@/lib/prisma';
import { getAttentionItems, type AttentionItem } from './attention.ts';
import { pushToBusiness, isPushConfigured, type PushPayload } from './webpush.ts';

export interface DigestJob {
  id: string;
  title: string;
  time: string | null;
  status: string;
  price: number;
  customerName: string;
  address: string | null;
  technician: string | null;
  crewName: string | null;
}

export interface DigestMoney {
  overdueTotal: number;
  overdueCount: number;
  outstandingTotal: number;
  outstandingCount: number;
  paidThisWeek: number;
  paidThisWeekCount: number;
}

export interface DigestData {
  businessId: string;
  businessName: string;
  timezone: string;
  dateKey: string; // YYYY-MM-DD in business tz
  dayPart: 'morning' | 'afternoon' | 'evening';
  greeting: string; // business name for "Good morning, {name}"
  todayJobs: DigestJob[];
  tomorrowCount: number;
  weekJobsCount: number;
  weekScheduledRevenue: number;
  actions: AttentionItem[];
  actionsTotal: number;
  money: DigestMoney;
  hasData: boolean;
}

function dayKeyInTz(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function hourInTz(d: Date, timeZone: string): number {
  return Number(
    new Intl.DateTimeFormat('en-CA', {
      timeZone,
      hour: '2-digit',
      hour12: false,
    }).format(d)
  );
}

function startOfDayInTz(dateKey: string): Date {
  // Noon UTC on the date is safely inside the calendar day for all of Canada.
  return new Date(`${dateKey}T12:00:00Z`);
}

export async function getDigestData(businessId: string): Promise<DigestData> {
  const now = new Date();
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { name: true, timezone: true, currency: true },
  });
  const timezone = business?.timezone || 'America/Toronto';
  const dateKey = dayKeyInTz(now, timezone);
  const hour = hourInTz(now, timezone);
  const dayPart = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';

  const todayStart = startOfDayInTz(dateKey);
  const todayEnd = new Date(todayStart.getTime() + 86_400_000);
  const tomorrowEnd = new Date(todayStart.getTime() + 2 * 86_400_000);
  const weekEnd = new Date(todayStart.getTime() + 7 * 86_400_000);
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);

  const [todayJobsRaw, tomorrowJobs, weekJobs, actions, invoices, paidWeek] =
    await Promise.all([
      prisma.job.findMany({
        where: {
          businessId,
          date: { gte: todayStart, lt: todayEnd },
          status: { notIn: ['CANCELLED'] },
        },
        select: {
          id: true,
          title: true,
          time: true,
          status: true,
          price: true,
          address: true,
          technician: true,
          customer: { select: { name: true } },
          crew: { select: { name: true } },
        },
        orderBy: [{ time: 'asc' }, { date: 'asc' }],
        take: 30,
      }),
      prisma.job.count({
        where: {
          businessId,
          date: { gte: todayEnd, lt: tomorrowEnd },
          status: { notIn: ['CANCELLED'] },
        },
      }),
      prisma.job.findMany({
        where: {
          businessId,
          date: { gte: todayStart, lt: weekEnd },
          status: { notIn: ['CANCELLED'] },
        },
        select: { price: true },
      }),
      getAttentionItems(businessId, 5),
      prisma.invoice.findMany({
        where: {
          businessId,
          status: { in: ['UNPAID', 'PARTIALLY_PAID', 'PARTIALLY PAID'] },
        },
        select: {
          total: true,
          date: true,
          status: true,
          payments: { where: { status: 'COMPLETED' }, select: { amount: true } },
        },
        take: 200,
      }),
      prisma.invoice.findMany({
        where: { businessId, status: 'PAID', paidAt: { gte: weekAgo } },
        select: { total: true },
      }),
    ]);

  const todayJobs: DigestJob[] = todayJobsRaw.map((j) => ({
    id: j.id,
    title: j.title,
    time: j.time,
    status: j.status,
    price: j.price,
    customerName: j.customer.name,
    address: j.address,
    technician: j.technician,
    crewName: j.crew?.name ?? null,
  }));

  let overdueTotal = 0;
  let overdueCount = 0;
  let outstandingTotal = 0;
  for (const inv of invoices) {
    const paid = inv.payments.reduce((s, p) => s + p.amount, 0);
    const balance = Math.max(0, inv.total - paid);
    if (balance <= 0) continue;
    outstandingTotal += balance;
    // Overdue = invoice date more than 0 days past in business tz (simple: date < today)
    if (dayKeyInTz(inv.date, timezone) < dateKey) {
      overdueTotal += balance;
      overdueCount += 1;
    }
  }

  const money: DigestMoney = {
    overdueTotal,
    overdueCount,
    outstandingTotal,
    outstandingCount: invoices.length,
    paidThisWeek: paidWeek.reduce((s, i) => s + i.total, 0),
    paidThisWeekCount: paidWeek.length,
  };

  const hasData =
    todayJobs.length > 0 ||
    actions.length > 0 ||
    weekJobs.length > 0 ||
    invoices.length > 0;

  return {
    businessId,
    businessName: business?.name ?? '',
    timezone,
    dateKey,
    dayPart,
    greeting: business?.name ?? '',
    todayJobs,
    tomorrowCount: tomorrowJobs,
    weekJobsCount: weekJobs.length,
    weekScheduledRevenue: weekJobs.reduce((s, j) => s + j.price, 0),
    actions,
    actionsTotal: actions.length,
    money,
    hasData,
  };
}

/** One-line push body, e.g. "3 jobs today · $1,240 overdue · 2 need action". */
export function buildDigestPushBody(
  d: DigestData,
  fmtMoney: (n: number) => string
): string {
  const parts: string[] = [];
  parts.push(
    d.todayJobs.length === 1
      ? '1 job today'
      : `${d.todayJobs.length} jobs today`
  );
  if (d.actionsTotal > 0)
    parts.push(
      d.actionsTotal === 1 ? '1 needs action' : `${d.actionsTotal} need action`
    );
  if (d.money.overdueTotal > 0)
    parts.push(`${fmtMoney(d.money.overdueTotal)} overdue`);
  return parts.join(' · ');
}

export interface DigestSendResult {
  businessId: string;
  dateKey: string;
  notification: boolean;
  push: 'sent' | 'skipped-no-subscriptions' | 'not-configured' | 'disabled';
}

/**
 * Compose + deliver one business's digest. Idempotent per (business, dateKey)
 * via the Notification dedupeKey — a second call the same morning is a no-op.
 */
export async function sendDigestForBusiness(
  businessId: string,
  channels: string[] = ['IN_APP', 'PUSH']
): Promise<DigestSendResult> {
  const data = await getDigestData(businessId);
  const dedupeKey = `digest:${data.dateKey}`;

  const existing = await prisma.notification.findUnique({
    where: { businessId_dedupeKey: { businessId, dedupeKey } },
  });
  if (existing) {
    return { businessId, dateKey: data.dateKey, notification: false, push: 'disabled' };
  }

  const fmtMoney = (n: number) =>
    new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
      maximumFractionDigits: 0,
    }).format(n);

  const title =
    data.dayPart === 'morning'
      ? `Good morning — ${data.todayJobs.length} job${data.todayJobs.length === 1 ? '' : 's'} today`
      : `Your briefing — ${data.todayJobs.length} job${data.todayJobs.length === 1 ? '' : 's'} today`;
  const body = buildDigestPushBody(data, fmtMoney);

  let notification = false;
  if (channels.includes('IN_APP')) {
    await prisma.notification.create({
      data: {
        businessId,
        type: 'morning_digest',
        data: JSON.stringify({ title, body, dateKey: data.dateKey }),
        href: '/digest',
        dedupeKey,
      },
    });
    notification = true;
  }

  let push: DigestSendResult['push'] = 'disabled';
  if (channels.includes('PUSH')) {
    if (!isPushConfigured()) {
      push = 'not-configured';
    } else {
      const payload: PushPayload = { title, body, url: '/digest', tag: dedupeKey };
      const res = await pushToBusiness(businessId, payload);
      push = res.sent > 0 ? 'sent' : 'skipped-no-subscriptions';
    }
  }

  return { businessId, dateKey: data.dateKey, notification, push };
}
