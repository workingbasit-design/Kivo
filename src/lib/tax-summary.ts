/**
 * C3: Tax summary per filing period.
 * 
 * Calculates:
 * - Tax collected by type (GST/HST, PST, QST) from invoices
 * - Tax paid on expenses (ITCs for GST/HST, ITRs for QST in Quebec)
 * - Net owing/refund
 * 
 * Labelled as bookkeeping helper, NOT tax advice.
 */

import { prisma } from '@/lib/prisma';
import { centsToDollars } from '@/lib/money';

export interface TaxSummary {
  period: string;
  collected: {
    gstHst: number;
    pst: number;
    qst: number;
    total: number;
  };
  paidOnExpenses: {
    gstHst: number;
    qst: number;
    pst: number;
    total: number;
  };
  net: number;
  invoiceCount: number;
  expenseCount: number;
}

export async function getTaxSummary(
  businessId: string,
  startDate: Date,
  endDate: Date
): Promise<TaxSummary> {
  const [invoices, expenses] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        businessId,
        voidedAt: null,
        date: { gte: startDate, lte: endDate },
      },
      include: {
        taxLines: true,
      },
    }),
    prisma.jobExpense.findMany({
      where: {
        businessId,
        spentAt: { gte: startDate, lte: endDate },
      },
      select: {
        amountCents: true,
        taxGstHstCents: true,
        taxQstCents: true,
        taxPstCents: true,
      },
    }),
  ]);

  const collected = { gstHst: 0, pst: 0, qst: 0, total: 0 };
  for (const inv of invoices) {
    for (const tl of inv.taxLines) {
      const amt = centsToDollars(tl.amountCents);
      if (tl.taxType === 'GST' || tl.taxType === 'HST') {
        collected.gstHst += amt;
      } else if (tl.taxType === 'PST' || tl.taxType === 'RST') {
        collected.pst += amt;
      } else if (tl.taxType === 'QST') {
        collected.qst += amt;
      }
      collected.total += amt;
    }
  }

  // Expenses: tax paid (ITCs for GST/HST, ITRs for QST)
  // These fields are entered on the expense form
  const paidOnExpenses = { gstHst: 0, qst: 0, pst: 0, total: 0 };
  for (const exp of expenses) {
    const gstHst = centsToDollars(exp.taxGstHstCents);
    const qst = centsToDollars(exp.taxQstCents);
    const pst = centsToDollars(exp.taxPstCents);
    paidOnExpenses.gstHst += gstHst;
    paidOnExpenses.qst += qst;
    paidOnExpenses.pst += pst;
    paidOnExpenses.total += gstHst + qst + pst;
  }

  return {
    period: `${startDate.toISOString().slice(0, 10)} to ${endDate.toISOString().slice(0, 10)}`,
    collected,
    paidOnExpenses,
    net: collected.total - paidOnExpenses.total,
    invoiceCount: invoices.length,
    expenseCount: expenses.length,
  };
}
