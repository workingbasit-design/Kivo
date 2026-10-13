/**
 * Backfill script: Convert Float dollar amounts to BigInt cents.
 *
 * Phase 2 of the money migration (Float -> integer cents).
 * Run AFTER deploying the schema with *Cents columns (Phase 1).
 *
 * Usage: npx tsx scripts/backfill-cents.ts
 * (Requires DATABASE_URL in environment)
 *
 * This script:
 * 1. Reads each Float money field
 * 2. Converts to cents: Math.round(float * 100)
 * 3. Writes to the corresponding *Cents BigInt field
 * 4. Logs counts for verification
 *
 * Safe to re-run: only updates rows where *Cents is null.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function backfill() {
  console.log('Starting cents backfill...');

  // Business.defaultHourlyRate -> defaultHourlyRateCents
  const businesses = await prisma.business.findMany({
    where: { defaultHourlyRate: { not: null }, defaultHourlyRateCents: null },
    select: { id: true, defaultHourlyRate: true },
  });
  for (const b of businesses) {
    await prisma.business.update({
      where: { id: b.id },
      data: { defaultHourlyRateCents: BigInt(Math.round((b.defaultHourlyRate ?? 0) * 100)) },
    });
  }
  console.log(`Business: ${businesses.length} updated`);

  // Service.price -> priceCents
  const services = await prisma.service.findMany({
    where: { priceCents: null },
    select: { id: true, price: true },
  });
  for (const s of services) {
    await prisma.service.update({
      where: { id: s.id },
      data: { priceCents: BigInt(Math.round(s.price * 100)) },
    });
  }
  console.log(`Service: ${services.length} updated`);

  // Job.price -> priceCents
  const jobs = await prisma.job.findMany({
    where: { priceCents: null },
    select: { id: true, price: true },
  });
  for (const j of jobs) {
    await prisma.job.update({
      where: { id: j.id },
      data: { priceCents: BigInt(Math.round(j.price * 100)) },
    });
  }
  console.log(`Job: ${jobs.length} updated`);

  // Invoice: subtotal, taxAmount, total
  const invoices = await prisma.invoice.findMany({
    where: { OR: [{ subtotalCents: null }, { taxAmountCents: null }, { totalCents: null }] },
    select: { id: true, subtotal: true, taxAmount: true, total: true },
  });
  for (const inv of invoices) {
    await prisma.invoice.update({
      where: { id: inv.id },
      data: {
        subtotalCents: BigInt(Math.round(inv.subtotal * 100)),
        taxAmountCents: BigInt(Math.round(inv.taxAmount * 100)),
        totalCents: BigInt(Math.round(inv.total * 100)),
      },
    });
  }
  console.log(`Invoice: ${invoices.length} updated`);

  // InvoiceLineItem.unitPrice -> unitPriceCents
  const lineItems = await prisma.invoiceLineItem.findMany({
    where: { unitPriceCents: null },
    select: { id: true, unitPrice: true },
  });
  for (const li of lineItems) {
    await prisma.invoiceLineItem.update({
      where: { id: li.id },
      data: { unitPriceCents: BigInt(Math.round(li.unitPrice * 100)) },
    });
  }
  console.log(`InvoiceLineItem: ${lineItems.length} updated`);

  // Payment.amount -> amountCents
  const payments = await prisma.payment.findMany({
    where: { amountCents: null },
    select: { id: true, amount: true },
  });
  for (const p of payments) {
    await prisma.payment.update({
      where: { id: p.id },
      data: { amountCents: BigInt(Math.round(p.amount * 100)) },
    });
  }
  console.log(`Payment: ${payments.length} updated`);

  // Quote: total, depositAmount, discountValue
  const quotes = await prisma.quote.findMany({
    where: { OR: [{ totalCents: null }, { depositAmountCents: null }, { discountValueCents: null }] },
    select: { id: true, total: true, depositAmount: true, discountValue: true },
  });
  for (const q of quotes) {
    await prisma.quote.update({
      where: { id: q.id },
      data: {
        totalCents: BigInt(Math.round(q.total * 100)),
        depositAmountCents: q.depositAmount != null ? BigInt(Math.round(q.depositAmount * 100)) : null,
        discountValueCents: q.discountValue != null ? BigInt(Math.round(q.discountValue * 100)) : null,
      },
    });
  }
  console.log(`Quote: ${quotes.length} updated`);

  // QuoteLineItem.unitPrice -> unitPriceCents
  const quoteItems = await prisma.quoteLineItem.findMany({
    where: { unitPriceCents: null },
    select: { id: true, unitPrice: true },
  });
  for (const qi of quoteItems) {
    await prisma.quoteLineItem.update({
      where: { id: qi.id },
      data: { unitPriceCents: BigInt(Math.round(qi.unitPrice * 100)) },
    });
  }
  console.log(`QuoteLineItem: ${quoteItems.length} updated`);

  // JobExpense.amount -> amountCents
  const expenses = await prisma.jobExpense.findMany({
    where: { amountCents: null },
    select: { id: true, amount: true },
  });
  for (const e of expenses) {
    await prisma.jobExpense.update({
      where: { id: e.id },
      data: { amountCents: BigInt(Math.round(e.amount * 100)) },
    });
  }
  console.log(`JobExpense: ${expenses.length} updated`);

  // RecurringJob.price -> priceCents
  const recurring = await prisma.recurringJob.findMany({
    where: { priceCents: null },
    select: { id: true, price: true },
  });
  for (const r of recurring) {
    await prisma.recurringJob.update({
      where: { id: r.id },
      data: { priceCents: BigInt(Math.round(r.price * 100)) },
    });
  }
  console.log(`RecurringJob: ${recurring.length} updated`);

  // QuoteAddon.price -> priceCents
  const addons = await prisma.quoteAddon.findMany({
    where: { priceCents: null },
    select: { id: true, price: true },
  });
  for (const a of addons) {
    await prisma.quoteAddon.update({
      where: { id: a.id },
      data: { priceCents: BigInt(Math.round(a.price * 100)) },
    });
  }
  console.log(`QuoteAddon: ${addons.length} updated`);

  // QuoteDeposit.amount -> amountCents
  const deposits = await prisma.quoteDeposit.findMany({
    where: { amountCents: null },
    select: { id: true, amount: true },
  });
  for (const d of deposits) {
    await prisma.quoteDeposit.update({
      where: { id: d.id },
      data: { amountCents: BigInt(Math.round(d.amount * 100)) },
    });
  }
  console.log(`QuoteDeposit: ${deposits.length} updated`);

  // Communication.estValue -> estValueCents
  const comms = await prisma.communication.findMany({
    where: { estValue: { not: null }, estValueCents: null },
    select: { id: true, estValue: true },
  });
  for (const c of comms) {
    await prisma.communication.update({
      where: { id: c.id },
      data: { estValueCents: BigInt(Math.round((c.estValue ?? 0) * 100)) },
    });
  }
  console.log(`Communication: ${comms.length} updated`);

  // ChecklistTemplate.price -> priceCents
  const templates = await prisma.checklistTemplate.findMany({
    where: { price: { not: null }, priceCents: null },
    select: { id: true, price: true },
  });
  for (const t of templates) {
    await prisma.checklistTemplate.update({
      where: { id: t.id },
      data: { priceCents: BigInt(Math.round((t.price ?? 0) * 100)) },
    });
  }
  console.log(`ChecklistTemplate: ${templates.length} updated`);

  // Part.unitCost -> unitCostCents
  const parts = await prisma.part.findMany({
    where: { unitCost: { not: null }, unitCostCents: null },
    select: { id: true, unitCost: true },
  });
  for (const p of parts) {
    await prisma.part.update({
      where: { id: p.id },
      data: { unitCostCents: BigInt(Math.round((p.unitCost ?? 0) * 100)) },
    });
  }
  console.log(`Part: ${parts.length} updated`);

  console.log('Backfill complete!');
}

backfill()
  .catch((e) => {
    console.error('Backfill failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
