/**
 * GET /api/v1/invoices — list invoices (tenant-scoped).
 * POST /api/v1/invoices — create an invoice (status UNPAID).
 *
 * Auth: Authorization: Bearer ejk_live_...
 * GET needs the `read` scope; POST needs `write`.
 * Errors are always JSON: { error: string }.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { authenticateV1Request, hasScope } from '@/lib/apiKeys';
import { emitWebhookEvent } from '@/lib/webhooks';
import { invoiceSchema } from '@/lib/validations';

const lineItemSchema = z.object({
  desc: z.string().trim().min(1).max(200),
  qty: z.coerce.number().min(0).max(100000),
  rate: z.coerce.number().min(0).max(10_000_000),
});

const createSchema = invoiceSchema
  .pick({ customerId: true, date: true, taxRate: true, taxType: true, notes: true })
  .extend({
    items: z.array(lineItemSchema).min(1).max(100).optional(),
    subtotal: z.coerce.number().min(0).max(10_000_000).optional(),
  })
  .refine((d) => d.items || typeof d.subtotal === 'number', {
    message: 'Provide items or a subtotal.',
  });

const select = {
  id: true,
  number: true,
  customerId: true,
  date: true,
  subtotal: true,
  taxRate: true,
  taxType: true,
  taxAmount: true,
  total: true,
  status: true,
  notes: true,
  createdAt: true,
} as const;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Mirror the app's INV-XXXX numbering (see src/app/actions/invoices.ts). */
async function nextInvoiceNumber(businessId: string): Promise<string> {
  const numbers = await prisma.invoice.findMany({
    where: { businessId },
    select: { number: true },
  });
  let max = 0;
  for (const r of numbers) {
    const m = /^INV-(\d+)$/.exec(r.number);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `INV-${String(max + 1).padStart(4, '0')}`;
}

export async function GET(req: Request) {
  const auth = await authenticateV1Request(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!hasScope(auth.key, 'read')) {
    return NextResponse.json({ error: 'This API key lacks the read scope.' }, { status: 403 });
  }
  const url = new URL(req.url);
  const rawLimit = parseInt(url.searchParams.get('limit') ?? '50', 10);
  const limit = Math.min(Math.max(Number.isNaN(rawLimit) ? 50 : rawLimit, 1), 100);
  const invoices = await prisma.invoice.findMany({
    where: { businessId: auth.key.businessId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select,
  });
  return NextResponse.json({ data: invoices });
}

export async function POST(req: Request) {
  const auth = await authenticateV1Request(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!hasScope(auth.key, 'write')) {
    return NextResponse.json({ error: 'This API key lacks the write scope.' }, { status: 403 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid payload.' },
      { status: 422 }
    );
  }
  const d = parsed.data;
  // Tenant check: the customer must belong to the key's business.
  const customer = await prisma.customer.findFirst({
    where: { id: d.customerId, businessId: auth.key.businessId },
    select: { id: true, name: true },
  });
  if (!customer) {
    return NextResponse.json({ error: 'Customer not found.' }, { status: 422 });
  }
  const subtotal = round2(
    d.items ? d.items.reduce((s, i) => s + i.qty * i.rate, 0) : (d.subtotal ?? 0)
  );
  const taxAmount = round2((subtotal * d.taxRate) / 100);
  const total = round2(subtotal + taxAmount);
  const number = await nextInvoiceNumber(auth.key.businessId);

  const created = await prisma.$transaction(async (tx) => {
    const inv = await tx.invoice.create({
      data: {
        businessId: auth.key.businessId,
        customerId: customer.id,
        number,
        date: new Date(`${d.date}T00:00:00`),
        subtotal,
        taxRate: d.taxRate,
        taxType: d.taxType,
        taxAmount,
        total,
        status: 'UNPAID',
        notes: d.notes || null,
      },
      select,
    });
    if (d.items) {
      await tx.invoiceLineItem.createMany({
        data: d.items.map((item, idx) => ({
          invoiceId: inv.id,
          description: item.desc,
          qty: item.qty,
          unitPrice: item.rate,
          position: idx,
        })),
      });
    }
    return inv;
  });

  emitWebhookEvent(auth.key.businessId, 'invoice.created', {
    id: created.id,
    number: created.number,
    customer_id: customer.id,
    total: created.total,
  }).catch(() => {});
  return NextResponse.json({ data: created }, { status: 201 });
}
