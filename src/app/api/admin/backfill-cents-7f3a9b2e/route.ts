import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

/**
 * One-time backfill: Float dollars -> BigInt cents.
 * Phase 2 of money migration.
 *
 * TEMPORARY: Delete after backfill completes.
 * Uses unguessable path instead of auth for one-time trigger.
 */
export async function GET() {

  const results: Record<string, number> = {};

  try {
    // Business
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
    results.business = businesses.length;

    // Service
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
    results.service = services.length;

    // Job
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
    results.job = jobs.length;

    // Invoice
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
    results.invoice = invoices.length;

    // Payment
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
    results.payment = payments.length;

    // Quote
    const quotes = await prisma.quote.findMany({
      where: { OR: [{ totalCents: null }] },
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
    results.quote = quotes.length;

    // JobExpense
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
    results.jobExpense = expenses.length;

    return NextResponse.json({ ok: true, results });
  } catch (error) {
    console.error('Backfill failed:', error);
    return NextResponse.json(
      { error: 'Backfill failed', results },
      { status: 500 }
    );
  }
}
