/**
 * Report Builder - "describe the report, AI builds it" ($0 edition).
 *
 * No external AI API: a rule-based EN/FR intent parser turns a natural-language
 * prompt into a ReportConfig, and runReport executes it against real,
 * tenant-scoped data. parseReportPrompt + resolveDateRange are pure and fully
 * unit-tested; runReport hits the DB (tenant guard: every query scopes by
 * businessId) and is covered by integration checks.
 */
import { prisma } from '@/lib/prisma';
import type { Locale } from '@/lib/i18n';

export type ReportType =
  | 'revenue'
  | 'expenses'
  | 'jobs'
  | 'quotes'
  | 'invoices'
  | 'customers';
export type ReportDateRange =
  | 'this_month'
  | 'last_month'
  | 'this_year'
  | 'last_30'
  | 'all';
export type ReportGroupBy = 'month' | 'category' | 'status' | 'none';
export type ReportMetric = 'total' | 'count' | 'average';

export interface ReportConfig {
  type: ReportType;
  dateRange: ReportDateRange;
  groupBy: ReportGroupBy;
  metric: ReportMetric;
}

export interface ReportRow {
  label: string;
  value: number;
  count?: number;
}

export interface ReportResult {
  rows: ReportRow[];
  total: number;
  totalCount: number;
  config: ReportConfig;
}

/** Lowercase + strip accents so "dépenses" matches "depense". */
function norm(prompt: string): string {
  return prompt
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

const TYPE_KEYWORDS: Array<[ReportType, string[]]> = [
  ['revenue', ['revenue', 'income', 'sales', 'collected', 'earning', 'chiffre', 'revenu', 'encaisse', 'vente']],
  ['expenses', ['expense', 'spending', 'spend', 'cost', 'depense', 'cout', 'couts']],
  ['quotes', ['quote', 'estimate', 'devis', 'soumission']],
  ['invoices', ['invoice', 'facture', 'billing']],
  ['jobs', ['job', 'travail', 'travaux', 'work']],
  ['customers', ['customer', 'client']],
];

/** Natural grouping when the prompt doesn't say how to group. */
const NATURAL_GROUP_BY: Record<ReportType, ReportGroupBy> = {
  revenue: 'month',
  expenses: 'category',
  jobs: 'status',
  quotes: 'status',
  invoices: 'status',
  customers: 'none',
};

/** Which groupings make sense per report type. */
const COMPATIBLE_GROUP_BY: Record<ReportType, ReportGroupBy[]> = {
  revenue: ['month', 'none'],
  expenses: ['category', 'month', 'none'],
  jobs: ['status', 'month', 'none'],
  quotes: ['status', 'month', 'none'],
  invoices: ['status', 'month', 'none'],
  customers: ['month', 'none'],
};

export interface ParsedPrompt {
  config: ReportConfig;
  /** True when no report type was detected and the config is a best guess. */
  defaulted: boolean;
}

/**
 * Rule-based EN/FR intent parser. First keyword match wins per dimension;
 * anything unmatched falls back to a sensible default.
 */
export function parseReportPromptDetailed(prompt: string): ParsedPrompt {
  const n = norm(prompt);

  let type: ReportType | null = null;
  for (const [t, keywords] of TYPE_KEYWORDS) {
    if (keywords.some((k) => n.includes(k))) {
      type = t;
      break;
    }
  }
  const defaulted = type === null;
  const resolvedType: ReportType = type ?? 'revenue';

  let groupBy: ReportGroupBy | null = null;
  if (/by month|per month|monthly|par mois|mensuel/.test(n)) groupBy = 'month';
  else if (/by categor|per categor|par categorie/.test(n)) groupBy = 'category';
  else if (/by status|per status|par statut/.test(n)) groupBy = 'status';
  const compatible = COMPATIBLE_GROUP_BY[resolvedType];
  const resolvedGroupBy: ReportGroupBy =
    groupBy && compatible.includes(groupBy) ? groupBy : NATURAL_GROUP_BY[resolvedType];

  let dateRange: ReportDateRange | null = null;
  if (/last month|mois dernier|dernier mois/.test(n)) dateRange = 'last_month';
  else if (/this month|ce mois|mois en cours|mois-ci|mois ci/.test(n)) dateRange = 'this_month';
  else if (/this year|cette annee|year to date|\bytd\b/.test(n)) dateRange = 'this_year';
  else if (/last 30|30 days|30 derniers jours|derniers 30/.test(n)) dateRange = 'last_30';
  else if (/all time|toute la periode|depuis le debut/.test(n)) dateRange = 'all';
  const resolvedRange: ReportDateRange = dateRange ?? 'last_30';

  let metric: ReportMetric | null = null;
  if (/average|\bavg\b|mean|moyenne|moyen/.test(n)) metric = 'average';
  else if (/how many|number of|count of|combien|nombre de/.test(n)) metric = 'count';
  const resolvedMetric: ReportMetric =
    metric ?? (resolvedType === 'customers' ? 'count' : 'total');

  return {
    config: {
      type: resolvedType,
      dateRange: resolvedRange,
      groupBy: resolvedGroupBy,
      metric: resolvedMetric,
    },
    defaulted,
  };
}

/** Rule-based EN/FR intent parser - thin wrapper; see parseReportPromptDetailed. */
export function parseReportPrompt(prompt: string): ReportConfig {
  return parseReportPromptDetailed(prompt).config;
}

export interface DateBounds {
  from: Date;
  to: Date;
}

/**
 * Resolve a date range to concrete bounds (pure, testable).
 * Returns null for 'all' (no date filter). `now` is injectable for tests.
 */
export function resolveDateRange(
  range: ReportDateRange,
  now: Date = new Date()
): DateBounds | null {
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (range) {
    case 'this_month':
      return { from: new Date(y, m, 1), to: now };
    case 'last_month':
      return { from: new Date(y, m - 1, 1), to: new Date(y, m, 1) };
    case 'this_year':
      return { from: new Date(y, 0, 1), to: now };
    case 'last_30':
      return { from: new Date(now.getTime() - 30 * 86_400_000), to: now };
    case 'all':
      return null;
  }
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(d: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === 'fr' ? 'fr-CA' : 'en-CA', {
    month: 'short',
    year: 'numeric',
  }).format(d);
}

const STATUS_LABELS: Record<string, { en: string; fr: string }> = {
  NEW: { en: 'New', fr: 'Nouveau' },
  SCHEDULED: { en: 'Scheduled', fr: 'Planifié' },
  'IN PROGRESS': { en: 'In progress', fr: 'En cours' },
  COMPLETED: { en: 'Completed', fr: 'Terminé' },
  PAID: { en: 'Paid', fr: 'Payé' },
  CANCELLED: { en: 'Cancelled', fr: 'Annulé' },
  DRAFT: { en: 'Draft', fr: 'Brouillon' },
  SENT: { en: 'Sent', fr: 'Envoyé' },
  APPROVED: { en: 'Approved', fr: 'Approuvé' },
  DECLINED: { en: 'Declined', fr: 'Refusé' },
  UNPAID: { en: 'Unpaid', fr: 'Impayé' },
  'PARTIALLY PAID': { en: 'Partially paid', fr: 'Partiellement payé' },
};

const STATUS_ORDER = [
  'NEW',
  'SCHEDULED',
  'IN PROGRESS',
  'COMPLETED',
  'PAID',
  'DRAFT',
  'SENT',
  'APPROVED',
  'DECLINED',
  'UNPAID',
  'PARTIALLY PAID',
  'CANCELLED',
];

const CATEGORY_LABELS: Record<string, { en: string; fr: string }> = {
  MATERIALS: { en: 'Materials', fr: 'Matériaux' },
  TRAVEL: { en: 'Travel', fr: 'Déplacement' },
  OTHER: { en: 'Other', fr: 'Autre' },
};

interface BucketItem {
  key: string;
  label: string;
  amount: number;
}

/**
 * Fold flat items into rows. Month groups sort chronologically, status groups
 * follow the workflow order, everything else sorts by value descending.
 */
function aggregate(
  items: BucketItem[],
  metric: ReportMetric,
  chronological: boolean,
  order?: (a: string, b: string) => number
): { rows: ReportRow[]; total: number; totalCount: number } {
  const map = new Map<string, { label: string; sum: number; count: number }>();
  for (const it of items) {
    const b = map.get(it.key) ?? { label: it.label, sum: 0, count: 0 };
    b.sum += it.amount;
    b.count += 1;
    map.set(it.key, b);
  }
  const entries = [...map.entries()];
  if (order) entries.sort(([a], [b]) => order(a, b));
  else if (chronological) entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  const rows: ReportRow[] = entries.map(([, b]) => ({
    label: b.label,
    value:
      metric === 'count' ? b.count : metric === 'average' ? b.sum / b.count : b.sum,
    count: b.count,
  }));
  if (!chronological && !order) rows.sort((a, b) => b.value - a.value);

  const totalSum = entries.reduce((s, [, b]) => s + b.sum, 0);
  const totalCount = entries.reduce((s, [, b]) => s + b.count, 0);
  const total =
    metric === 'count'
      ? totalCount
      : metric === 'average'
        ? totalCount > 0
          ? totalSum / totalCount
          : 0
        : totalSum;
  return { rows, total, totalCount };
}

/** Execute a report config against real tenant-scoped data. Bounded at 5000 rows. */
export async function runReport(
  businessId: string,
  config: ReportConfig,
  locale: Locale = 'en'
): Promise<ReportResult> {
  const bounds = resolveDateRange(config.dateRange);
  const dateFilter = bounds ? { gte: bounds.from, lt: bounds.to } : undefined;
  const statusLabel = (s: string) => STATUS_LABELS[s]?.[locale] ?? s;
  const categoryLabel = (c: string) => CATEGORY_LABELS[c]?.[locale] ?? c;
  const statusOrder = (a: string, b: string) => {
    const ia = STATUS_ORDER.indexOf(a);
    const ib = STATUS_ORDER.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  };

  let items: BucketItem[] = [];
  let chronological = false;
  let order: ((a: string, b: string) => number) | undefined;

  switch (config.type) {
    case 'revenue': {
      // Revenue = COMPLETED payments, grouped/filtered by their invoice date.
      const payments = await prisma.payment.findMany({
        where: {
          businessId,
          status: 'COMPLETED',
          ...(dateFilter ? { invoice: { date: dateFilter } } : {}),
        },
        select: { amount: true, invoice: { select: { date: true } } },
        take: 5000,
      });
      if (config.groupBy === 'month') {
        chronological = true;
        items = payments.map((p) => ({
          key: monthKey(p.invoice.date),
          label: monthLabel(p.invoice.date, locale),
          amount: p.amount,
        }));
      } else {
        const label = locale === 'fr' ? 'Revenus' : 'Revenue';
        items = payments.map((p) => ({ key: 'all', label, amount: p.amount }));
      }
      break;
    }
    case 'expenses': {
      const expenses = await prisma.jobExpense.findMany({
        where: { businessId, ...(dateFilter ? { spentAt: dateFilter } : {}) },
        select: { amount: true, category: true, spentAt: true },
        take: 5000,
      });
      if (config.groupBy === 'category') {
        items = expenses.map((e) => ({
          key: e.category,
          label: categoryLabel(e.category),
          amount: e.amount,
        }));
      } else if (config.groupBy === 'month') {
        chronological = true;
        items = expenses.map((e) => ({
          key: monthKey(e.spentAt),
          label: monthLabel(e.spentAt, locale),
          amount: e.amount,
        }));
      } else {
        const label = locale === 'fr' ? 'Dépenses' : 'Expenses';
        items = expenses.map((e) => ({ key: 'all', label, amount: e.amount }));
      }
      break;
    }
    case 'jobs': {
      const jobs = await prisma.job.findMany({
        where: { businessId, ...(dateFilter ? { date: dateFilter } : {}) },
        select: { price: true, status: true, date: true },
        take: 5000,
      });
      if (config.groupBy === 'status') {
        order = statusOrder;
        items = jobs.map((j) => ({
          key: j.status,
          label: statusLabel(j.status),
          amount: j.price,
        }));
      } else if (config.groupBy === 'month') {
        chronological = true;
        items = jobs.map((j) => ({
          key: monthKey(j.date),
          label: monthLabel(j.date, locale),
          amount: j.price,
        }));
      } else {
        items = jobs.map((j) => ({ key: 'all', label: 'Jobs', amount: j.price }));
      }
      break;
    }
    case 'quotes': {
      const quotes = await prisma.quote.findMany({
        where: { businessId, ...(dateFilter ? { createdAt: dateFilter } : {}) },
        select: { total: true, status: true, createdAt: true },
        take: 5000,
      });
      if (config.groupBy === 'status') {
        order = statusOrder;
        items = quotes.map((q) => ({
          key: q.status,
          label: statusLabel(q.status),
          amount: q.total,
        }));
      } else if (config.groupBy === 'month') {
        chronological = true;
        items = quotes.map((q) => ({
          key: monthKey(q.createdAt),
          label: monthLabel(q.createdAt, locale),
          amount: q.total,
        }));
      } else {
        const label = locale === 'fr' ? 'Devis' : 'Quotes';
        items = quotes.map((q) => ({ key: 'all', label, amount: q.total }));
      }
      break;
    }
    case 'invoices': {
      const invoices = await prisma.invoice.findMany({
        where: { businessId, ...(dateFilter ? { date: dateFilter } : {}) },
        select: { total: true, status: true, date: true },
        take: 5000,
      });
      if (config.groupBy === 'status') {
        order = statusOrder;
        items = invoices.map((i) => ({
          key: i.status,
          label: statusLabel(i.status),
          amount: i.total,
        }));
      } else if (config.groupBy === 'month') {
        chronological = true;
        items = invoices.map((i) => ({
          key: monthKey(i.date),
          label: monthLabel(i.date, locale),
          amount: i.total,
        }));
      } else {
        const label = locale === 'fr' ? 'Factures' : 'Invoices';
        items = invoices.map((i) => ({ key: 'all', label, amount: i.total }));
      }
      break;
    }
    case 'customers': {
      const customers = await prisma.customer.findMany({
        where: { businessId, ...(dateFilter ? { createdAt: dateFilter } : {}) },
        select: { createdAt: true },
        take: 5000,
      });
      if (config.groupBy === 'month') {
        chronological = true;
        items = customers.map((c) => ({
          key: monthKey(c.createdAt),
          label: monthLabel(c.createdAt, locale),
          amount: 1,
        }));
      } else {
        const label = locale === 'fr' ? 'Clients' : 'Customers';
        items = customers.map(() => ({ key: 'all', label, amount: 1 }));
      }
      break;
    }
  }

  const { rows, total, totalCount } = aggregate(items, config.metric, chronological, order);
  return { rows, total, totalCount, config };
}
