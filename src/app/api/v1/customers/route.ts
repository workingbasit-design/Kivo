/**
 * GET /api/v1/customers — list customers (tenant-scoped).
 * POST /api/v1/customers — create a customer.
 *
 * Auth: Authorization: Bearer ejk_live_...
 * GET needs the `read` scope; POST needs `write`.
 * Errors are always JSON: { error: string }.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateV1Request, hasScope } from '@/lib/apiKeys';
import { emitWebhookEvent } from '@/lib/webhooks';
import { customerSchema } from '@/lib/validations';

const createSchema = customerSchema.pick({
  name: true,
  phone: true,
  email: true,
  address: true,
  province: true,
  postalCode: true,
  notes: true,
});

const select = {
  id: true,
  name: true,
  phone: true,
  email: true,
  address: true,
  province: true,
  postalCode: true,
  notes: true,
  createdAt: true,
} as const;

export async function GET(req: Request) {
  const auth = await authenticateV1Request(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!hasScope(auth.key, 'read')) {
    return NextResponse.json({ error: 'This API key lacks the read scope.' }, { status: 403 });
  }
  const url = new URL(req.url);
  const rawLimit = parseInt(url.searchParams.get('limit') ?? '50', 10);
  const limit = Math.min(Math.max(Number.isNaN(rawLimit) ? 50 : rawLimit, 1), 100);
  const customers = await prisma.customer.findMany({
    where: { businessId: auth.key.businessId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select,
  });
  return NextResponse.json({ data: customers });
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
  const created = await prisma.customer.create({
    data: {
      businessId: auth.key.businessId,
      name: d.name,
      phone: d.phone || null,
      email: d.email || null,
      address: d.address || null,
      province: d.province || null,
      postalCode: d.postalCode || null,
      notes: d.notes || null,
    },
    select,
  });
  emitWebhookEvent(auth.key.businessId, 'customer.created', {
    id: created.id,
    name: created.name,
  }).catch(() => {});
  return NextResponse.json({ data: created }, { status: 201 });
}
