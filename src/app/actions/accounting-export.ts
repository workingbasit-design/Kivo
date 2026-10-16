'use server';

import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { centsToDollars } from '@/lib/money';

type ExportResult = {
  error?: string;
  csv?: string;
  filename?: string;
  summary?: string;
};

/**
 * F8: Accounting export (v1) — CSV shaped for QuickBooks Online, Xero, Wave.
 * Includes customers, invoices with tax lines, payments. Date range optional.
 */
export async function exportAccountingCSV(
  format: 'quickbooks' | 'xero' | 'wave',
  startDate?: string,
  endDate?: string
): Promise<ExportResult> {
  const session = await requireAuth();
  const businessId = session.businessId;
  if (!businessId) return { error: 'No business.' };

  const where: { businessId: string; voidedAt: null; date?: { gte?: Date; lte?: Date } } = { businessId, voidedAt: null };
  if (startDate || endDate) {
    where.date = {};
    if (startDate) where.date.gte = new Date(startDate);
    if (endDate) where.date.lte = new Date(endDate);
  }

  const [customers, invoices, payments] = await Promise.all([
    prisma.customer.findMany({
      where: { businessId, archivedAt: null },
      select: { name: true, email: true, phone: true, address: true },
      orderBy: { name: 'asc' },
    }),
    prisma.invoice.findMany({
      where,
      include: {
        customer: { select: { name: true } },
        taxLines: { select: { taxType: true, amountCents: true } },
      },
      orderBy: { date: 'asc' },
    }),
    prisma.payment.findMany({
      where: {
        businessId,
        status: 'COMPLETED',
        invoice: { voidedAt: null },
        ...(startDate || endDate ? {
          createdAt: {
            ...(startDate ? { gte: new Date(startDate) } : {}),
            ...(endDate ? { lte: new Date(endDate) } : {}),
          },
        } : {}),
      },
      select: {
        amountCents: true,
        createdAt: true,
        provider: true,
        invoice: { select: { number: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  // Build CSV: sections for customers, invoices, payments
  const lines: string[] = [];
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;

  // Customers
  lines.push('## Customers');
  lines.push(['Name', 'Email', 'Phone', 'Address'].map(esc).join(','));
  for (const c of customers) {
    lines.push([c.name, c.email || '', c.phone || '', c.address || ''].map(esc).join(','));
  }
  lines.push('');

  // Invoices
  lines.push('## Invoices');
  lines.push(['Number', 'Date', 'Customer', 'Total', 'Tax', 'GST/HST', 'PST', 'QST', 'Status'].map(esc).join(','));
  for (const inv of invoices) {
    const taxByType: Record<string, number> = {};
    for (const tl of inv.taxLines) {
      taxByType[tl.taxType] = (taxByType[tl.taxType] || 0) + centsToDollars(tl.amountCents);
    }
    lines.push([
      inv.number,
      inv.date.toISOString().slice(0, 10),
      inv.customer.name,
      centsToDollars(inv.totalCents).toFixed(2),
      centsToDollars(inv.taxAmountCents).toFixed(2),
      (taxByType['GST'] || taxByType['HST'] || 0).toFixed(2),
      (taxByType['PST'] || 0).toFixed(2),
      (taxByType['QST'] || 0).toFixed(2),
      inv.status,
    ].map(esc).join(','));
  }
  lines.push('');

  // Payments
  lines.push('## Payments');
  lines.push(['Date', 'Invoice', 'Amount', 'Method'].map(esc).join(','));
  for (const p of payments) {
    lines.push([
      p.createdAt.toISOString().slice(0, 10),
      p.invoice?.number || '',
      centsToDollars(p.amountCents).toFixed(2),
      p.provider,
    ].map(esc).join(','));
  }

  const csv = lines.join('\n');
  const summary = `${customers.length} customers, ${invoices.length} invoices, ${payments.length} payments`;
  const filename = `everyjob-export-${format}-${new Date().toISOString().slice(0, 10)}.csv`;

  return { csv, filename, summary };
}
