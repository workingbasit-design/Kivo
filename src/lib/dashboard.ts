import { prisma } from "@/lib/prisma";
import { dayRangeInTimezone, todayInTimezone } from "@/lib/utils";
import { centsToDollars } from "@/lib/money";
import {
  bucketRevenueByService,
  type ServiceRevenueRow,
} from "@/lib/revenue-by-service";
import { getJobCounts, getMoneySummary, getTodayJobs, getUpcomingJobs } from "@/lib/job-queries";

export interface TodayJob {
  id: string;
  title: string;
  time: string | null;
  status: string;
  date: Date;
  price: number;
  customerName: string;
}

export interface DueInvoice {
  id: string;
  number: string;
  customerName: string;
  outstanding: number;
  date: Date;
}

export interface DashboardStats {
  bookedToday: number;
  jobsLeftToday: number;
  collectedThisWeek: number;
  outstanding: number;
  outstandingCount: number;
  newLeads: number;
  totalCustomers: number;
  /** Total job count (from the shared getJobCounts). */
  totalJobs: number;
  jobsByStatus: { status: string; count: number }[];
  todayJobs: TodayJob[];
  upcomingJobs: TodayJob[];
  dueInvoices: DueInvoice[];
  /** Completed jobs without invoices (ready to bill). */
  readyToInvoice: { id: string; title: string; price: number; customerName: string }[];
}

/** Shapes returned by the Prisma selects below (kept explicit so this
 *  module type-checks even if the generated client types are stale). */
interface JobWithCustomer {
  id: string;
  title: string;
  time: string | null;
  status: string;
  priceCents: bigint | null;
  date: Date;
  customerId: string;
  customer: { name: string };
}

interface InvoiceWithPayments {
  id: string;
  number: string;
  totalCents: bigint | null;
  date: Date;
  customer: { name: string };
  payments: { amountCents: bigint | null }[];
}

interface StatusCount {
  status: string;
  _count: { status: number };
}

const OPEN_JOB_STATUSES = ["NEW", "SCHEDULED", "IN PROGRESS"];

/**
 * "Booked today" summary from a list of today's jobs.
 *
 * Cancelled jobs never count as booked revenue and never count as jobs left
 * (2026-09-24 defect: cancelling a job left its amount in the sidebar total
 * until a manual reload). Pure function - unit-tested in
 * `__tests__/dashboard.test.mts`. Shared by the dashboard stats and the app
 * shell (sidebar) so both surfaces always agree.
 */
export function summarizeTodayJobs(jobs: { status: string; price: number | null }[]): {
  bookedToday: number;
  jobsLeftToday: number;
} {
  const bookedToday = jobs
    .filter((j) => j.status !== 'CANCELLED')
    .reduce((s, j) => s + (j.price ?? 0), 0);
  const jobsLeftToday = jobs.filter((j) => OPEN_JOB_STATUSES.includes(j.status)).length;
  return { bookedToday, jobsLeftToday };
}
const DONE_JOB_STATUSES = ["COMPLETED", "PAID"];
const OPEN_INVOICE_STATUSES = ["UNPAID", "PARTIALLY PAID"];

/** Start of the day N days ago (local time). */
function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function getDashboardStats(
  businessId: string,
  biz?: { timezone: string | null; regionCode: string | null } | null
): Promise<DashboardStats> {
  // "Today" is the business-local calendar day - the server runs on UTC, so
  // a server-local date would show the wrong day's jobs in the evening.
  // The caller may pass an already-fetched business row to skip a roundtrip.
  const b =
    biz ??
    (await prisma.business.findUnique({
      where: { id: businessId },
      select: { timezone: true, regionCode: true },
    }));
  const todayStr = todayInTimezone(b?.timezone, b?.regionCode);
  // Part A: the day window is anchored in the business timezone, not the
  // server's. This is the single definition of "today" shared with the
  // attention engine and the shared date formatter.
  const { gte: todayStart, lte: todayEnd } = dayRangeInTimezone(todayStr, b?.timezone);
  const weekStart = daysAgo(6); // last 7 days incl. today

  // Job counts, job lists, and the money summary come from the shared
  // query functions (src/lib/job-queries) so Dashboard, Jobs, Schedule,
  // and Money all agree. Only genuinely dashboard-specific stats
  // (payments this week, leads, customers) are queried here, plus the
  // top-5 due-invoice list for rendering (the aggregate comes from the
  // shared summary).
  const [
    todayJobsRaw,
    upcomingRaw,
    jobCounts,
    moneySummary,
    dueInvoicesRaw,
    paymentsThisWeek,
    newLeads,
    totalCustomers,
    readyToInvoiceRaw,
  ]: [
    JobWithCustomer[],
    JobWithCustomer[],
    { total: number; byStatus: Record<string, number> },
    { outstanding: number; outstandingCount: number },
    InvoiceWithPayments[],
    { _sum: { amountCents: bigint | null } },
    number,
    number,
    { id: string; title: string; priceCents: bigint | null; customer: { name: string } }[],
  ] = await Promise.all([
    getTodayJobs(businessId, todayStart, todayEnd),
    getUpcomingJobs(businessId, todayEnd),
    getJobCounts(businessId, { timezone: b?.timezone ?? 'America/Toronto' }),
    getMoneySummary(businessId),
    prisma.invoice.findMany({
      where: { businessId, status: { in: OPEN_INVOICE_STATUSES }, voidedAt: null },
      select: {
        id: true,
        number: true,
        totalCents: true,
        date: true,
        customer: { select: { name: true } },
        payments: {
          where: { status: 'COMPLETED' },
          select: { amountCents: true },
        },
      },
      orderBy: { date: 'asc' },
      take: 5,
    }),
    prisma.payment.aggregate({
      where: {
        status: 'COMPLETED',
        createdAt: { gte: weekStart },
        businessId,
        invoice: { voidedAt: null },
      },
      _sum: { amountCents: true },
    }),
    prisma.lead.count({ where: { businessId, status: 'NEW' } }),
    prisma.customer.count({ where: { businessId, archivedAt: null } }),
    // Ready to invoice: completed jobs with no invoice yet.
    prisma.job.findMany({
      where: {
        businessId,
        status: 'COMPLETED',
        invoices: { none: {} },
      },
      select: {
        id: true,
        title: true,
        priceCents: true,
        customer: { select: { name: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    }),
  ]);

  const mapJob = (j: JobWithCustomer): TodayJob => ({
    id: j.id,
    title: j.title,
    time: j.time,
    status: j.status,
    date: j.date,
    price: centsToDollars(j.priceCents),
    customerName: j.customer.name,
  });

  const todayJobs = todayJobsRaw.map(mapJob);
  // Shared with the app shell so the dashboard and sidebar always agree.
  const { bookedToday, jobsLeftToday } = summarizeTodayJobs(todayJobs);

  // Per-invoice balances, cents-aware to match the shared money summary.
  const dueInvoices: DueInvoice[] = dueInvoicesRaw
    .map((inv: InvoiceWithPayments) => {
      const total = centsToDollars(inv.totalCents);
      const paid = inv.payments.reduce(
        (s: number, p: { amountCents: bigint | null }) => s + centsToDollars(p.amountCents),
        0
      );
      return {
        id: inv.id,
        number: inv.number,
        customerName: inv.customer.name,
        outstanding: Math.max(0, total - paid),
        date: inv.date,
      };
    })
    .filter((inv: DueInvoice) => inv.outstanding > 0);

  return {
    bookedToday,
    jobsLeftToday,
    collectedThisWeek: centsToDollars(paymentsThisWeek._sum.amountCents),
    outstanding: moneySummary.outstanding,
    outstandingCount: moneySummary.outstandingCount,
    newLeads,
    totalCustomers,
    totalJobs: jobCounts.total,
    jobsByStatus: Object.entries(jobCounts.byStatus).map(([status, count]) => ({
      status,
      count,
    })),
    todayJobs,
    upcomingJobs: upcomingRaw.map(mapJob),
    dueInvoices,
    readyToInvoice: readyToInvoiceRaw.map((j) => ({
      id: j.id,
      title: j.title,
      price: centsToDollars(j.priceCents),
      customerName: j.customer.name,
    })),
  };
}

export interface MonthBucket {
  key: string; // "2026-04"
  label: string; // "Apr"
  revenue: number;
  jobs: number;
}

export interface TopCustomer {
  id: string;
  name: string;
  revenue: number;
  jobs: number;
}

export interface ReportStats {
  months: MonthBucket[];
  totalCollected: number;
  jobsByStatus: { status: string; count: number }[];
  topCustomers: TopCustomer[];
  outstanding: number;
  outstandingCount: number;
  avgJobValue: number;
  quoteWinRate: number | null;
  quotesSent: number;
  /** Completed/paid job revenue grouped by price-book service (6-month window). */
  revenueByService: ServiceRevenueRow[];
  /** Open jobs scheduled in the next 14 days (business-local dates). */
  upcomingWorkload: { count: number; totalPrice: number };
}

interface ReportJob {
  id: string;
  priceCents: bigint | null;
  status: string;
  date: Date;
  customerId: string;
  customer: { name: string };
  service: { name: string } | null;
}

interface ReportPayment {
  amountCents: bigint | null;
  createdAt: Date;
}

export async function getReportStats(
  businessId: string,
  locale: "en" | "fr" = "en"
): Promise<ReportStats> {
  // Build 6 month buckets, oldest -> newest
  const now = new Date();
  const buckets: { key: string; label: string; start: Date; end: Date }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const start = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-CA", { month: "short" });
    buckets.push({ key, label, start, end });
  }
  const rangeStart = buckets[0].start;

  // Business-local "today" drives the upcoming-workload window, matching
  // the dashboard's day-boundary behavior.
  const biz = await prisma.business.findUnique({
    where: { id: businessId },
    select: { timezone: true, regionCode: true },
  });
  const todayStr = todayInTimezone(biz?.timezone, biz?.regionCode);
  const { gte: todayStart } = dayRangeInTimezone(todayStr, biz?.timezone);
  const workloadEnd = new Date(todayStart);
  workloadEnd.setDate(workloadEnd.getDate() + 14);

  const [payments, jobs, jobsByStatusRaw, openInvoices, quotes, upcoming]: [
    ReportPayment[],
    ReportJob[],
    StatusCount[],
    InvoiceWithPayments[],
    StatusCount[],
    { priceCents: bigint | null }[],
  ] = await Promise.all([
    prisma.payment.findMany({
      where: {
        status: "COMPLETED",
        createdAt: { gte: rangeStart },
        businessId,
      },
      select: { amountCents: true, createdAt: true },
    }),
    prisma.job.findMany({
      where: { businessId, date: { gte: rangeStart } },
      select: {
        id: true,
        priceCents: true,
        status: true,
        date: true,
        customerId: true,
        customer: { select: { name: true } },
        service: { select: { name: true } },
      },
    }),
    prisma.job.groupBy({
      by: ["status"],
      where: { businessId },
      _count: { status: true },
    }),
    prisma.invoice.findMany({
      where: { businessId, status: { in: OPEN_INVOICE_STATUSES } },
      include: {
        payments: { where: { status: "COMPLETED" }, select: { amountCents: true } },
        customer: { select: { name: true } },
      },
    }),
    prisma.quote.groupBy({
      by: ["status"],
      where: { businessId },
      _count: { status: true },
    }),
    prisma.job.findMany({
      where: {
        businessId,
        date: { gte: todayStart, lt: workloadEnd },
        status: { in: OPEN_JOB_STATUSES },
      },
      select: { priceCents: true },
    }),
  ]);

  const months: MonthBucket[] = buckets.map((b) => {
    const revenue = payments
      .filter((p: ReportPayment) => p.createdAt >= b.start && p.createdAt <= b.end)
      .reduce((s: number, p: ReportPayment) => s + centsToDollars(p.amountCents), 0);
    const jobsCount = jobs.filter(
      (j: ReportJob) => j.date >= b.start && j.date <= b.end
    ).length;
    return { key: b.key, label: b.label, revenue, jobs: jobsCount };
  });

  const totalCollected = payments.reduce(
    (s: number, p: ReportPayment) => s + centsToDollars(p.amountCents),
    0
  );

  // Top customers by completed/paid job value in range
  const byCustomer = new Map<string, { name: string; revenue: number; jobs: number }>();
  for (const j of jobs) {
    if (!DONE_JOB_STATUSES.includes(j.status)) continue;
    const cur = byCustomer.get(j.customerId) ?? {
      name: j.customer.name,
      revenue: 0,
      jobs: 0,
    };
    cur.revenue += centsToDollars(j.priceCents);
    cur.jobs += 1;
    byCustomer.set(j.customerId, cur);
  }
  const topCustomers: TopCustomer[] = [...byCustomer.entries()]
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  const outstanding = openInvoices.reduce((s: number, inv: InvoiceWithPayments) => {
    const paid = inv.payments.reduce(
      (p: number, pay: { amountCents: bigint | null }) => p + centsToDollars(pay.amountCents),
      0
    );
    return s + Math.max(0, centsToDollars(inv.totalCents) - paid);
  }, 0);

  const doneJobs = jobs.filter((j: ReportJob) => DONE_JOB_STATUSES.includes(j.status));
  const avgJobValue =
    doneJobs.length > 0
      ? doneJobs.reduce((s: number, j: ReportJob) => s + centsToDollars(j.priceCents), 0) /
        doneJobs.length
      : 0;

  // Revenue grouped by price-book service; jobs with no linked service
  // bucket under the localized "Other" label.
  const revenueByService = bucketRevenueByService(
    doneJobs.map((j) => ({
      price: centsToDollars(j.priceCents),
      serviceName: j.service?.name ?? null,
    })),
    locale === "fr" ? "Autre" : "Other"
  );

  const upcomingWorkload = {
    count: upcoming.length,
    totalPrice: upcoming.reduce(
      (s: number, j: { priceCents: bigint | null }) => s + centsToDollars(j.priceCents),
      0
    ),
  };

  const approved = quotes.find((q: StatusCount) => q.status === "APPROVED")?._count.status ?? 0;
  const decided = quotes
    .filter((q: StatusCount) => ["APPROVED", "DECLINED"].includes(q.status))
    .reduce((s: number, q: StatusCount) => s + q._count.status, 0);
  const quoteWinRate = decided > 0 ? Math.round((approved / decided) * 100) : null;
  const quotesSent = quotes.reduce((s: number, q: StatusCount) => s + q._count.status, 0);

  return {
    months,
    totalCollected,
    jobsByStatus: jobsByStatusRaw.map((g: StatusCount) => ({
      status: g.status,
      count: g._count.status,
    })),
    topCustomers,
    outstanding,
    outstandingCount: openInvoices.length,
    avgJobValue,
    quoteWinRate,
    quotesSent,
    revenueByService,
    upcomingWorkload,
  };
}
