import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const results: Record<string, number> = {};
  try {
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
    results.jobs = jobs.length;
    
    const invoices = await prisma.invoice.findMany({
      where: { totalCents: null },
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
    results.invoices = invoices.length;
    
    return NextResponse.json({ ok: true, results });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
