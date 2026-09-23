import { prisma } from "@/lib/prisma";
import { dayRange, todayInTimezone } from "@/lib/utils";
import {
  bucketRevenueByService,
  type ServiceRevenueRow,
} from "@/lib/revenue-by-service";

export interface TodayJob {
  id: string;
  title: string;
  time: string | null;
  status: string;
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
  jobsByStatus: { status: string; count: number }[];
  todayJobs: TodayJob[];
  upcomingJobs: TodayJob[];
  dueInvoices: DueInvoice[];
}

/** Shapes returned by the Prisma selects below (kept explicit so this
 *  module type-checks even if the generated client types are stale). */
interface JobWithCustomer {
  id: string;
  title: string;
  time: string | null;
  status: string;
  price: number | null;
  date: Date;
  customerId: string;
  customer: { name: string };
}

interface InvoiceWithPayments {
  id: string;
  number: string;
  total: number;
  date: Date;
  customer: { name: string };
  payments: { amount: number }[];
}

interface StatusCount {
  status: string;
  _count: { status: number };
}

const OPEN_JOB_STATUSES = ["NEW", "SCHEDULED", "IN PROGRESS"];
const DONE_JOB_STATUSES = ["COMPLETED", "PAID"];
const OPEN_INVOICE_STATUSES = ["UNPAID", "PARTIALLY PAID"];

/** Start of the day N days ago (local time). */
function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function getDashboardStats(businessId: string): Promise<DashboardStats> {
  // "Today" is the business-local calendar day — the server runs on UTC, so
  // a server-local date would show the wrong day's jobs in the evening.
  const biz = await prisma.business.findUnique({
    where: { id: businessId },
    select: { timezone: true, regionCode: true },
  });
  const todayStr = todayInTimezone(biz?.timezone, biz?.regionCode);
  const { gte: todayStart, lte: todayEnd } = dayRange(todayStr);
  const weekStart = daysAgo(6); // last 7 days incl. today

  const [
    todayJobsRaw,
    upcomingRaw,
    jobsByStatusRaw,
    paymentsThisWeek,
    openInvoices,
    newLeads,
    totalCustomers,
  ]: [
    JobWithCustomer[],
    JobWithCustomer[],
    StatusCount[],
    { _sum: { amount: number | null } },
    InvoiceWithPayments[],
    number,
    number,
  ] = await Promise.all([
    prisma.job.findMany({
      where: { businessId, date: { gte: todayStart, lte: todayEnd } },
      include: { customer: { select: { name: true } } },
      orderBy: [{ time: "asc" }, { createdAt: "asc" }],
    }),
    prisma.job.findMany({
      where: {
        businessId,
        date: { gt: todayEnd },
        status: { in: OPEN_JOB_STATUSES },
      },
      include: { customer: { select: { name: true } } },
      orderBy: { date: "asc" },
      take: 5,
    }),
    prisma.job.groupBy({
      by: ["status"],
      where: { businessId },
      _count: { status: true },
    }),
    prisma.payment.aggregate({
      where: {
        status: "COMPLETED",
        createdAt: { gte: weekStart },
        invoice: { businessId },
      },
      _sum: { amount: true },
    }),
    prisma.invoice.findMany({
      where: { businessId, status: { in: OPEN_INVOICE_STATUSES } },
      include: {
        customer: { select: { name: true } },
        payments: { where: { status: "COMPLETED" }, select: { amount: true } },
      },
      orderBy: { date: "asc" },
    }),
    prisma.lead.count({ where: { businessId, status: "NEW" } }),
    prisma.customer.count({ where: { businessId } }),
  ]);

  const mapJob = (j: JobWithCustomer): TodayJob => ({
    id: j.id,
    title: j.title,
    time: j.time,
    status: j.status,
    price: j.price ?? 0,
    customerName: j.customer.name,
  });

  const todayJobs = todayJobsRaw.map(mapJob);
  const bookedToday = todayJobs.reduce((s: number, j: TodayJob) => s + j.price, 0);
  const jobsLeftToday = todayJobs.filter((j: TodayJob) =>
    OPEN_JOB_STATUSES.includes(j.status)
  ).length;

  const allOutstanding: DueInvoice[] = openInvoices.map((inv: InvoiceWithPayments) => {
    const paid = inv.payments.reduce((s: number, p: { amount: number }) => s + p.amount, 0);
    return {
      id: inv.id,
      number: inv.number,
      customerName: inv.customer.name,
      outstanding: Math.max(0, inv.total - paid),
      date: inv.date,
    };
  });

  const dueInvoices: DueInvoice[] = allOutstanding
    .filter((inv: DueInvoice) => inv.outstanding > 0)
    .slice(0, 5);

  const outstanding = allOutstanding.reduce((s: number, inv: DueInvoice) => s + inv.outstanding, 0);

  return {
    bookedToday,
    jobsLeftToday,
    collectedThisWeek: paymentsThisWeek._sum.amount ?? 0,
    outstanding,
    outstandingCount: openInvoices.length,
    newLeads,
    totalCustomers,
    jobsByStatus: jobsByStatusRaw.map((g: StatusCount) => ({
      status: g.status,
      count: g._count.status,
    })),
    todayJobs,
    upcomingJobs: upcomingRaw.map(mapJob),
    dueInvoices,
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
  price: number | null;
  status: string;
  date: Date;
  customerId: string;
  customer: { name: string };
  service: { name: string } | null;
}

interface ReportPayment {
  amount: number;
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
  const { gte: todayStart } = dayRange(todayStr);
  const workloadEnd = new Date(todayStart);
  workloadEnd.setDate(workloadEnd.getDate() + 14);

  const [payments, jobs, jobsByStatusRaw, openInvoices, quotes, upcoming]: [
    ReportPayment[],
    ReportJob[],
    StatusCount[],
    InvoiceWithPayments[],
    StatusCount[],
    { price: number | null }[],
  ] = await Promise.all([
    prisma.payment.findMany({
      where: {
        status: "COMPLETED",
        createdAt: { gte: rangeStart },
        invoice: { businessId },
      },
      select: { amount: true, createdAt: true },
    }),
    prisma.job.findMany({
      where: { businessId, date: { gte: rangeStart } },
      select: {
        id: true,
        price: true,
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
        payments: { where: { status: "COMPLETED" }, select: { amount: true } },
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
      select: { price: true },
    }),
  ]);

  const months: MonthBucket[] = buckets.map((b) => {
    const revenue = payments
      .filter((p: ReportPayment) => p.createdAt >= b.start && p.createdAt <= b.end)
      .reduce((s: number, p: ReportPayment) => s + p.amount, 0);
    const jobsCount = jobs.filter(
      (j: ReportJob) => j.date >= b.start && j.date <= b.end
    ).length;
    return { key: b.key, label: b.label, revenue, jobs: jobsCount };
  });

  const totalCollected = payments.reduce((s: number, p: ReportPayment) => s + p.amount, 0);

  // Top customers by completed/paid job value in range
  const byCustomer = new Map<string, { name: string; revenue: number; jobs: number }>();
  for (const j of jobs) {
    if (!DONE_JOB_STATUSES.includes(j.status)) continue;
    const cur = byCustomer.get(j.customerId) ?? {
      name: j.customer.name,
      revenue: 0,
      jobs: 0,
    };
    cur.revenue += j.price ?? 0;
    cur.jobs += 1;
    byCustomer.set(j.customerId, cur);
  }
  const topCustomers: TopCustomer[] = [...byCustomer.entries()]
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  const outstanding = openInvoices.reduce((s: number, inv: InvoiceWithPayments) => {
    const paid = inv.payments.reduce((p: number, pay: { amount: number }) => p + pay.amount, 0);
    return s + Math.max(0, inv.total - paid);
  }, 0);

  const doneJobs = jobs.filter((j: ReportJob) => DONE_JOB_STATUSES.includes(j.status));
  const avgJobValue =
    doneJobs.length > 0
      ? doneJobs.reduce((s: number, j: ReportJob) => s + (j.price ?? 0), 0) / doneJobs.length
      : 0;

  // Revenue grouped by price-book service; jobs with no linked service
  // bucket under the localized "Other" label.
  const revenueByService = bucketRevenueByService(
    doneJobs.map((j) => ({
      price: j.price,
      serviceName: j.service?.name ?? null,
    })),
    locale === "fr" ? "Autre" : "Other"
  );

  const upcomingWorkload = {
    count: upcoming.length,
    totalPrice: upcoming.reduce((s: number, j: { price: number | null }) => s + (j.price ?? 0), 0),
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
