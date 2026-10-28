/**
 * GET /api/v1/invoices - list invoices (tenant-scoped).
 * POST /api/v1/invoices - create an invoice (status UNPAID).
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
import { calcTax, splitStoredTax } from '@/lib/tax';
import { dollarsToCents, centsToDollars } from '@/lib/money';
import { invoiceDueAt } from '@/lib/invoice-paid';
import { parseDateInputInTimezone } from '@/lib/utils';
import { nextDocumentNumber } from '@/lib/numbering';

// Mirrors the server action's whitelist (src/app/actions/invoices.ts) so a
// garbage taxType can't be stored with mismatched rate semantics.
const TAX_TYPES = [
  'GST',
  'CGST',
  'SGST',
  'IGST',
  'HST',
  'PST',
  'QST',
  'GST+QST',
  'GST+PST',
] as const;

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
  subtotalCents: true,
  taxRate: true,
  taxType: true,
  taxAmountCents: true,
  totalCents: true,
  status: true,
  notes: true,
  createdAt: true,
} as const;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
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
  // Whitelist the tax type so stored type always matches the rate's semantics.
  const taxType = String(d.taxType ?? '').toUpperCase();
  if (!(TAX_TYPES as readonly string[]).includes(taxType)) {
    return NextResponse.json({ error: 'Invalid taxType.' }, { status: 422 });
  }
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
  // Server-side money math via the shared tax engine - the single source of
  // truth, identical to the app's createInvoice path (per-line rounding).
  const taxAmount = calcTax(subtotal, {
    taxes: splitStoredTax(taxType, d.taxRate),
  }).taxAmount;
  const total = round2(subtotal + taxAmount);

  // Date-only value in the business timezone (same fix as the app's
  // createInvoice path): server-local midnight misplaces the date in
  // every tz-aware query and on the detail page. Looked up BEFORE the
  // transaction (connection_limit=1 deadlock rule, lib/prisma.ts).
  const apiBusiness = await prisma.business.findUnique({
    where: { id: auth.key.businessId },
    select: { timezone: true },
  });
  const apiTz = apiBusiness?.timezone ?? 'America/Toronto';
  const apiDateValue = parseDateInputInTimezone(d.date, apiTz);

  const created = await prisma.$transaction(async (tx) => {
    // Number generated inside the same transaction as the insert (M4).
    const number = await nextDocumentNumber(tx, auth.key.businessId, 'INVOICE');
    const inv = await tx.invoice.create({
      data: {
        businessId: auth.key.businessId,
        customerId: customer.id,
        number,
        date: apiDateValue,
        dueAt: invoiceDueAt(apiDateValue, apiTz),
        subtotalCents: dollarsToCents(subtotal) ?? BigInt(0),
        taxRate: d.taxRate,
        taxType,
        taxAmountCents: dollarsToCents(taxAmount) ?? BigInt(0),
        totalCents: dollarsToCents(total) ?? BigInt(0),
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
          unitPriceCents: dollarsToCents(item.rate) ?? BigInt(0),
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
    total: centsToDollars(created.totalCents),
  }).catch(() => {});
  return NextResponse.json({ data: created }, { status: 201 });
}
