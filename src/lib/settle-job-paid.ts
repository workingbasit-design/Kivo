/**
 * Settle a job's money when it is marked PAID.
 *
 * Lives in lib — NOT in a 'use server' action module — because every
 * exported async function of a 'use server' file is a callable server
 * action. settleJobPaid() used to be exported from
 * src/app/actions/invoices.ts, where anyone able to invoke a server action
 * could call it with an arbitrary businessId/jobId and mark any job PAID
 * with matching ledger writes, no session required (B-8, 2026-11-17).
 * As a plain lib function it is only reachable from already-authenticated
 * server code (jobs.ts status transitions), which passes the session's own
 * businessId.
 *
 * Money-correctness: marking a job PAID means the customer paid in full, so
 * the payment ledger must reflect it - otherwise "Collected" and the monthly
 * revenue bars disagree with the job status (and with top-customer / avg-job
 * / revenue-by-service numbers, which are job-based).
 *
 * Settles the job's invoices inside one transaction:
 * - each of the job's open invoices gets a COMPLETED payment for its
 *   outstanding balance (provider OTHER = the pro marked it paid on the job
 *   without specifying a method);
 * - if the job has no invoice at all and a positive price, a paid invoice
 *   for the job price is created first, then the matching payment.
 * A zero-price job with no invoice just flips status - nothing to record.
 */
import { prisma } from './prisma.ts';
import { sumMoneyPayments } from './invoice-status.ts';
import { nextDocumentNumber } from './numbering.ts';

export type PrismaTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export async function settleJobPaidTx(
  tx: PrismaTx,
  businessId: string,
  jobId: string,
): Promise<void> {
  const job = await tx.job.findFirst({
    where: { id: jobId, businessId },
    select: { id: true, priceCents: true, title: true, customerId: true },
  });
  if (!job) return;

  const invoices = await tx.invoice.findMany({
    where: { jobId: job.id, businessId },
    select: {
      id: true,
      totalCents: true,
      payments: { select: { amountCents: true, status: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (invoices.length === 0) {
    const priceCents = job.priceCents;
    if (priceCents <= BigInt(0) || !job.customerId) return;
    const number = await nextDocumentNumber(tx, businessId, 'INVOICE');
    // NOTE (2026-10-04, reviewed): this auto-invoice is a RECEIPT for cash
    // already in hand (the owner just marked the job paid), not a fresh
    // bill - so it records the amount received (price) with zero tax, and
    // the matching payment closes it at PAID. The batch-invoice path
    // (billing.ts buildBatchPreview) instead treats job.price as a pre-tax
    // subtotal and adds tax, because there the customer still owes. Adding
    // tax here would either invent an outstanding balance the customer
    // doesn't owe or invent a payment they didn't make - both worse than
    // the path difference. Deliberate, not a defect.
    const inv = await tx.invoice.create({
      data: {
        number,
        date: new Date(),
        subtotalCents: priceCents,
        taxRate: 0,
        taxAmountCents: BigInt(0),
        totalCents: priceCents,
        status: 'PAID',
        notes: `Auto-created when job "${job.title}" was marked paid.`,
        customerId: job.customerId,
        businessId,
        jobId: job.id,
        paidAt: new Date(),
      },
    });
    await tx.invoiceLineItem.create({
      data: {
        invoiceId: inv.id,
        description: job.title,
        qty: 1,
        unitPriceCents: priceCents,
        position: 0,
      },
    });
    // Mark job as invoiced (A1: invoicedAt tracks when first invoice links)
    // 2026-11-06 deep test: businessId rides in the where (same as the
    // createInvoice path above) so the write stays tenant-scoped by
    // convention — the guard does not fire inside $transaction callbacks.
    await tx.job.updateMany({
      where: { id: job.id, businessId },
      data: { invoicedAt: new Date() },
    });
    await tx.payment.create({
      data: {
        amountCents: priceCents,
        provider: 'OTHER',
        status: 'COMPLETED',
        invoiceId: inv.id,
        businessId,
      },
    });
    return;
  }

  for (const inv of invoices) {
    // Voided payments are not money: settle the genuine outstanding balance.
    const paidCents = sumMoneyPayments(inv.payments);
    const outstandingCents = inv.totalCents - paidCents;
    if (outstandingCents > BigInt(0)) {
      await tx.payment.create({
        data: {
          amountCents: outstandingCents,
          provider: 'OTHER',
          status: 'COMPLETED',
          invoiceId: inv.id,
          businessId,
        },
      });
      await tx.invoice.update({
        where: { id: inv.id, businessId },
        data: { status: 'PAID', paidAt: new Date() },
      });
    }
  }
}

export async function settleJobPaid(
  businessId: string,
  jobId: string,
  tx?: PrismaTx,
): Promise<void> {
  if (tx) return settleJobPaidTx(tx, businessId, jobId);
  await prisma.$transaction((t) => settleJobPaidTx(t, businessId, jobId));
}
