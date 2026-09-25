/**
 * GET /api/v1/jobs — list jobs (tenant-scoped).
 * POST /api/v1/jobs — create a job (status SCHEDULED).
 *
 * Auth: Authorization: Bearer ejk_live_...
 * GET needs the `read` scope; POST needs `write`.
 * Errors are always JSON: { error: string }.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateV1Request, hasScope } from '@/lib/apiKeys';
import { emitWebhookEvent } from '@/lib/webhooks';
import { jobSchema } from '@/lib/validations';

const createSchema = jobSchema.pick({
  title: true,
  customerId: true,
  date: true,
  time: true,
  address: true,
  price: true,
  notes: true,
  technician: true,
});

const select = {
  id: true,
  title: true,
  customerId: true,
  date: true,
  time: true,
  address: true,
  price: true,
  status: true,
  notes: true,
  technician: true,
  createdAt: true,
} as const;

function localMidnight(dayStr: string): Date {
  const [y, m, d] = dayStr.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
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
  const jobs = await prisma.job.findMany({
    where: { businessId: auth.key.businessId },
    orderBy: { date: 'desc' },
    take: limit,
    select,
  });
  return NextResponse.json({ data: jobs });
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
  const created = await prisma.job.create({
    data: {
      businessId: auth.key.businessId,
      customerId: customer.id,
      title: d.title,
      date: localMidnight(d.date),
      time: d.time || null,
      address: d.address || null,
      price: d.price,
      status: 'SCHEDULED',
      notes: d.notes || null,
      technician: d.technician || null,
    },
    select,
  });
  emitWebhookEvent(auth.key.businessId, 'job.created', {
    id: created.id,
    title: created.title,
    customer_id: customer.id,
    date: d.date,
    price: created.price,
  }).catch(() => {});
  return NextResponse.json({ data: created }, { status: 201 });
}
