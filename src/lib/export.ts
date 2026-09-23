import { prisma } from '@/lib/prisma';
import { escapeCsvCell, summarizeLineItems } from './costing';

export type ExportType =
  | 'customers'
  | 'leads'
  | 'jobs'
  | 'quotes'
  | 'invoices'
  | 'payments'
  | 'services'
  | 'reviews';

export const EXPORT_TYPES: { value: ExportType; label: string }[] = [
  { value: 'customers', label: 'Customers' },
  { value: 'leads', label: 'Leads' },
  { value: 'jobs', label: 'Jobs' },
  { value: 'quotes', label: 'Quotes' },
  { value: 'invoices', label: 'Invoices' },
  { value: 'payments', label: 'Payments' },
  { value: 'services', label: 'Price book services' },
  { value: 'reviews', label: 'Reviews' },
];

function csv(headers: string[], rows: (string | number | null | undefined | Date)[][]): string {
  const line = (cells: unknown[]) => cells.map(escapeCsvCell).join(',');
  return [line(headers), ...rows.map(line)].join('\r\n');
}

const d = (v: Date | null | undefined) => (v ? new Date(v).toISOString().slice(0, 10) : '');

/** Every query is scoped to the business. Returns CSV text. */
export async function buildExportCsv(businessId: string, type: ExportType): Promise<string> {
  switch (type) {
    case 'customers': {
      const rows = await prisma.customer.findMany({
        where: { businessId },
        orderBy: { createdAt: 'asc' },
      });
      return csv(
        ['name', 'phone', 'email', 'address', 'notes', 'created'],
        rows.map((c) => [c.name, c.phone, c.email, c.address, c.notes, d(c.createdAt)])
      );
    }
    case 'leads': {
      const rows = await prisma.lead.findMany({
        where: { businessId },
        orderBy: { createdAt: 'asc' },
      });
      return csv(
        ['name', 'phone', 'email', 'source', 'status', 'details', 'created'],
        rows.map((l) => [l.name, l.phone, l.email, l.source, l.status, l.details, d(l.createdAt)])
      );
    }
    case 'jobs': {
      const rows = await prisma.job.findMany({
        where: { businessId },
        include: { customer: { select: { name: true } } },
        orderBy: { date: 'asc' },
      });
      return csv(
        ['title', 'customer', 'date', 'time', 'status', 'price', 'address', 'technician', 'notes'],
        rows.map((j) => [
          j.title, j.customer.name, d(j.date), j.time, j.status, j.price, j.address, j.technician, j.notes,
        ])
      );
    }
    case 'quotes': {
      const rows = await prisma.quote.findMany({
        where: { businessId },
        include: { customer: { select: { name: true } } },
        orderBy: { createdAt: 'asc' },
      });
      return csv(
        ['number', 'title', 'customer', 'status', 'total', 'created'],
        rows.map((q) => [
          q.number, q.title, q.customer.name, q.status, q.total, d(q.createdAt),
        ])
      );
    }
    case 'invoices': {
      const rows = await prisma.invoice.findMany({
        where: { businessId },
        include: {
          customer: { select: { name: true } },
          lineItems: { orderBy: { position: 'asc' } },
          payments: { where: { status: 'COMPLETED' }, select: { amount: true } },
        },
        orderBy: { createdAt: 'asc' },
      });
      return csv(
        // Existing columns keep their order for CSV consumers; accountant
        // columns (lineItems summary, amount paid) are appended.
        ['number', 'customer', 'status', 'subtotal', 'tax', 'total', 'taxType', 'taxRate', 'date', 'created', 'lineItems', 'amountPaid'],
        rows.map((i) => [
          i.number, i.customer.name, i.status, i.subtotal, i.taxAmount, i.total, i.taxType, i.taxRate, d(i.date), d(i.createdAt),
          summarizeLineItems(i.lineItems),
          Math.round(i.payments.reduce((s, p) => s + p.amount, 0) * 100) / 100,
        ])
      );
    }
    case 'payments': {
      const rows = await prisma.payment.findMany({
        where: { invoice: { businessId } },
        include: { invoice: { select: { number: true, customer: { select: { name: true } } } } },
        orderBy: { createdAt: 'asc' },
      });
      return csv(
        ['invoice', 'customer', 'amount', 'provider', 'status', 'transactionId', 'created'],
        rows.map((p) => [
          p.invoice.number, p.invoice.customer.name, p.amount, p.provider, p.status, p.transactionId, d(p.createdAt),
        ])
      );
    }
    case 'services': {
      const rows = await prisma.service.findMany({
        where: { businessId },
        orderBy: { name: 'asc' },
      });
      return csv(
        ['name', 'price'],
        rows.map((s) => [s.name, s.price])
      );
    }
    case 'reviews': {
      const rows = await prisma.review.findMany({
        where: { businessId },
        include: { customer: { select: { name: true } } },
        orderBy: { createdAt: 'asc' },
      });
      return csv(
        ['customer', 'rating', 'source', 'comment', 'created'],
        rows.map((r) => [r.customer?.name ?? '', r.rating, r.source, r.comment, d(r.createdAt)])
      );
    }
  }
}
