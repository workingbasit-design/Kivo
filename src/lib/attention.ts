/**
 * Attention engine — the "5 things that need you today" brain.
 *
 * `computeAttention` is a pure function over plain data (fully unit-tested).
 * `getAttentionItems` fetches tenant-scoped data and feeds it in.
 *
 * Rules are deliberately conservative: an item appears only when real data
 * supports it. Nothing here invents facts — a new business with no data gets
 * an empty list, not encouraging noise.
 */
import { daysOverdue, needsFollowUp, daysWaiting, remainingBalance } from './revenue.ts';
import { prisma } from '@/lib/prisma';

export type AttentionSeverity = 'critical' | 'attention' | 'info' | 'positive';
export type AttentionCategory =
  | 'jobs'
  | 'money'
  | 'leads'
  | 'quotes'
  | 'inventory'
  | 'schedule';

export interface AttentionItem {
  id: string;
  severity: AttentionSeverity;
  category: AttentionCategory;
  /** i18n key under the `attention` fragment namespace, e.g. "items.overdueInvoice.title" */
  titleKey: string;
  titleParams: Record<string, string | number>;
  detailKey: string;
  detailParams: Record<string, string | number>;
  /** CAD amount, set for money items so the UI can show it. */
  amount?: number;
  /** Deep link to act on the item. */
  href: string;
  ctaKey: string;
}

export interface AttentionInput {
  now: Date;
  timezone?: string | null;
  invoices: {
    id: string;
    number: string;
    date: Date;
    total: number;
    paidTotal: number;
    status: string;
    customerName: string;
  }[];
  quotes: {
    id: string;
    number: string;
    title: string;
    total: number;
    status: string;
    updatedAt: Date;
    customerName: string;
  }[];
  jobs: {
    id: string;
    title: string;
    date: Date;
    status: string;
    price: number;
    technician: string | null;
    customerName: string;
    hasInvoice: boolean;
  }[];
  leads: {
    id: string;
    name: string;
    status: string;
    createdAt: Date;
    source: string | null;
  }[];
  parts: {
    id: string;
    name: string;
    quantity: number;
    reorderPoint: number | null;
  }[];
  paidThisWeek: { count: number; total: number };
}

const SEVERITY_RANK: Record<AttentionSeverity, number> = {
  critical: 0,
  attention: 1,
  info: 2,
  positive: 3,
};

/** "YYYY-MM-DD" calendar-day key in the business timezone. */
function dayKey(d: Date, timeZone?: string | null): string {
  const tz = timeZone || 'America/Toronto';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
  return parts; // en-CA yields YYYY-MM-DD
}

export function sortAttention(items: AttentionItem[]): AttentionItem[] {
  return [...items].sort((a, b) => {
    const s = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (s !== 0) return s;
    return (b.amount ?? 0) - (a.amount ?? 0);
  });
}

export function computeAttention(input: AttentionInput): AttentionItem[] {
  const { now, timezone } = input;
  const todayKey = dayKey(now, timezone);
  const items: AttentionItem[] = [];

  // 1. Overdue invoices — the money that should already be in the bank.
  for (const inv of input.invoices) {
    if (inv.status === 'PAID') continue;
    const overdueDays = daysOverdue(inv.date, now, timezone);
    if (overdueDays <= 0) continue;
    const balance = remainingBalance(inv.total, [inv.paidTotal]);
    if (balance <= 0) continue;
    items.push({
      id: `invoice-${inv.id}`,
      severity: overdueDays > 30 ? 'critical' : 'attention',
      category: 'money',
      titleKey: 'items.overdueInvoice.title',
      titleParams: { number: inv.number, customer: inv.customerName },
      detailKey: 'items.overdueInvoice.detail',
      detailParams: { days: overdueDays, amount: balance.toFixed(2) },
      amount: balance,
      href: `/invoices/${inv.id}`,
      ctaKey: 'actions.reviewInvoice',
    });
  }

  // 2. Quotes waiting on follow-up (SENT, idle past the follow-up window).
  for (const q of input.quotes) {
    if (q.status !== 'SENT') continue;
    if (!needsFollowUp(q.updatedAt, now)) continue;
    items.push({
      id: `quote-${q.id}`,
      severity: 'attention',
      category: 'quotes',
      titleKey: 'items.quoteFollowUp.title',
      titleParams: { number: q.number, customer: q.customerName },
      detailKey: 'items.quoteFollowUp.detail',
      detailParams: { days: daysWaiting(q.updatedAt, now), amount: q.total.toFixed(2) },
      amount: q.total,
      href: `/quotes/${q.id}`,
      ctaKey: 'actions.followUp',
    });
  }

  // 3a. Jobs scheduled in the past that never started — at risk.
  // 3b. Jobs today/tomorrow with no technician — unassigned.
  const tomorrowKey = dayKey(new Date(now.getTime() + 86_400_000), timezone);
  for (const job of input.jobs) {
    const jobKey = dayKey(job.date, timezone);
    if (
      (job.status === 'NEW' || job.status === 'SCHEDULED') &&
      jobKey < todayKey
    ) {
      items.push({
        id: `job-risk-${job.id}`,
        severity: 'critical',
        category: 'jobs',
        titleKey: 'items.jobAtRisk.title',
        titleParams: { title: job.title, customer: job.customerName },
        detailKey: 'items.jobAtRisk.detail',
        detailParams: { date: jobKey },
        href: `/jobs/${job.id}`,
        ctaKey: 'actions.reschedule',
      });
    } else if (
      (job.status === 'NEW' || job.status === 'SCHEDULED') &&
      !job.technician &&
      (jobKey === todayKey || jobKey === tomorrowKey)
    ) {
      items.push({
        id: `job-unassigned-${job.id}`,
        severity: 'attention',
        category: 'schedule',
        titleKey: 'items.jobUnassigned.title',
        titleParams: { title: job.title, date: jobKey },
        detailKey: 'items.jobUnassigned.detail',
        detailParams: { customer: job.customerName },
        href: `/dispatch`,
        ctaKey: 'actions.assign',
      });
    }
    // 3c. Completed jobs with no invoice — unbilled work.
    if (job.status === 'COMPLETED' && !job.hasInvoice && job.price > 0) {
      items.push({
        id: `job-unbilled-${job.id}`,
        severity: 'attention',
        category: 'money',
        titleKey: 'items.jobUnbilled.title',
        titleParams: { title: job.title, customer: job.customerName },
        detailKey: 'items.jobUnbilled.detail',
        detailParams: { amount: job.price.toFixed(2) },
        amount: job.price,
        href: `/jobs/${job.id}`,
        ctaKey: 'actions.createInvoice',
      });
    }
  }

  // 4. New leads sitting idle for over a day.
  for (const lead of input.leads) {
    if (lead.status !== 'NEW') continue;
    const ageHrs = (now.getTime() - lead.createdAt.getTime()) / 3_600_000;
    if (ageHrs < 24) continue;
    items.push({
      id: `lead-${lead.id}`,
      severity: 'attention',
      category: 'leads',
      titleKey: 'items.leadIdle.title',
      titleParams: { name: lead.name },
      detailKey: 'items.leadIdle.detail',
      detailParams: {
        hours: Math.floor(ageHrs),
        source: lead.source ?? '—',
      },
      href: `/leads`,
      ctaKey: 'actions.contactLead',
    });
  }

  // 5. Inventory at or below reorder point.
  for (const part of input.parts) {
    if (part.reorderPoint == null) continue;
    if (part.quantity > part.reorderPoint) continue;
    items.push({
      id: `part-${part.id}`,
      severity: part.quantity <= 0 ? 'attention' : 'info',
      category: 'inventory',
      titleKey: 'items.lowStock.title',
      titleParams: { name: part.name },
      detailKey: 'items.lowStock.detail',
      detailParams: { quantity: part.quantity },
      href: `/inventory`,
      ctaKey: 'actions.reorder',
    });
  }

  // 6. Positive: money collected this week — the system notices wins too.
  if (input.paidThisWeek.count > 0) {
    items.push({
      id: 'paid-this-week',
      severity: 'positive',
      category: 'money',
      titleKey: 'items.paidThisWeek.title',
      titleParams: { count: input.paidThisWeek.count },
      detailKey: 'items.paidThisWeek.detail',
      detailParams: { amount: input.paidThisWeek.total.toFixed(2) },
      amount: input.paidThisWeek.total,
      href: `/invoices?status=PAID`,
      ctaKey: 'actions.viewInvoices',
    });
  }

  return sortAttention(items);
}

/**
 * Tenant-scoped fetch + compute. One round of independent queries.
 * Bounded: caps the returned list so the page stays fast.
 */
export async function getAttentionItems(
  businessId: string,
  maxItems = 25
): Promise<AttentionItem[]> {
  const now = new Date();
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { timezone: true },
  });
  const timezone = business?.timezone ?? null;
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);

  const [invoices, quotes, jobs, leads, parts, paidInvoices, invoicedJobIds] =
    await Promise.all([
      prisma.invoice.findMany({
        where: { businessId, status: { in: ['UNPAID', 'PARTIALLY PAID'] } },
        select: {
          id: true,
          number: true,
          date: true,
          total: true,
          status: true,
          customer: { select: { name: true } },
          payments: {
            where: { status: 'COMPLETED' },
            select: { amount: true },
          },
        },
        orderBy: { date: 'asc' },
        take: 50,
      }),
      prisma.quote.findMany({
        where: { businessId, status: 'SENT' },
        select: {
          id: true,
          number: true,
          title: true,
          total: true,
          status: true,
          updatedAt: true,
          customer: { select: { name: true } },
        },
        orderBy: { updatedAt: 'asc' },
        take: 50,
      }),
      prisma.job.findMany({
        where: {
          businessId,
          status: { in: ['NEW', 'SCHEDULED', 'IN PROGRESS', 'COMPLETED'] },
        },
        select: {
          id: true,
          title: true,
          date: true,
          status: true,
          price: true,
          technician: true,
          customer: { select: { name: true } },
        },
        orderBy: { date: 'asc' },
        take: 200,
      }),
      prisma.lead.findMany({
        where: { businessId, status: 'NEW' },
        select: { id: true, name: true, status: true, createdAt: true, source: true },
        orderBy: { createdAt: 'asc' },
        take: 50,
      }),
      prisma.part.findMany({
        where: { businessId, reorderPoint: { not: null } },
        select: { id: true, name: true, quantity: true, reorderPoint: true },
        take: 50,
      }),
      prisma.invoice.findMany({
        where: { businessId, status: 'PAID', paidAt: { gte: weekAgo } },
        select: { total: true },
      }),
      prisma.invoice.findMany({
        where: { businessId, jobId: { not: null } },
        select: { jobId: true },
      }),
    ]);

  const invoicedJobIdSet = new Set(
    invoicedJobIds.map((i) => i.jobId).filter((v): v is string => !!v)
  );

  const items = computeAttention({
    now,
    timezone,
    invoices: invoices.map((inv) => ({
      id: inv.id,
      number: inv.number,
      date: inv.date,
      total: inv.total,
      paidTotal: inv.payments.reduce((s, p) => s + p.amount, 0),
      status: inv.status,
      customerName: inv.customer.name,
    })),
    quotes: quotes.map((q) => ({
      id: q.id,
      number: q.number,
      title: q.title,
      total: q.total,
      status: q.status,
      updatedAt: q.updatedAt,
      customerName: q.customer.name,
    })),
    jobs: jobs.map((j) => ({
      id: j.id,
      title: j.title,
      date: j.date,
      status: j.status,
      price: j.price,
      technician: j.technician,
      customerName: j.customer.name,
      hasInvoice: invoicedJobIdSet.has(j.id),
    })),
    leads: leads.map((l) => ({
      id: l.id,
      name: l.name,
      status: l.status,
      createdAt: l.createdAt,
      source: l.source,
    })),
    parts: parts.map((p) => ({
      id: p.id,
      name: p.name,
      quantity: p.quantity,
      reorderPoint: p.reorderPoint,
    })),
    paidThisWeek: {
      count: paidInvoices.length,
      total: paidInvoices.reduce((s, i) => s + i.total, 0),
    },
  });

  return items.slice(0, maxItems);
}
