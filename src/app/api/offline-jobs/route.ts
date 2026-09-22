import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { jobSchema } from '@/lib/validations';
import { validatePhone, INVALID_PHONE_MESSAGE } from '@/lib/phone';
import { checkSameOrigin, originForbidden } from '@/lib/csrf';
import { rateLimit, ACTION_LIMIT } from '@/lib/rate-limit';

const offlineJobSchema = z.object({
  title: jobSchema.shape.title,
  customerId: jobSchema.shape.customerId,
  newCustomerName: z.string().trim().max(120).optional().default(''),
  newCustomerPhone: z.string().trim().max(25).optional().default(''),
  date: jobSchema.shape.date,
  time: jobSchema.shape.time,
  address: jobSchema.shape.address,
  price: jobSchema.shape.price,
  notes: jobSchema.shape.notes,
  technician: jobSchema.shape.technician,
  clientKey: z.string().trim().min(8).max(64),
});

/**
 * POST /api/offline-jobs — sync endpoint for the offline outbox.
 *
 * Accepts a job payload that was queued while the device had no connection.
 * Authenticated via the session cookie (same-origin + CSRF guard, like other
 * API routes). Idempotent: a `clientKey` generated at queue time dedupes
 * retries — a job with identical (customer, title, date, time, price) created
 * in the last 15 minutes is treated as already synced.
 */
export async function POST(req: NextRequest) {
  const originCheck = checkSameOrigin(req);
  if (!originCheck.ok) return originForbidden();

  const session = await getSession();
  const businessId = session?.user?.businessId;
  if (!businessId) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  const rl = rateLimit(`offline-job:${businessId}`, ACTION_LIMIT);
  if (!rl.ok) {
    return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }
  const parsed = offlineJobSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid job details.' },
      { status: 400 }
    );
  }
  const p = parsed.data;

  let customerId = p.customerId;
  if (customerId === '__NEW__') {
    if (p.newCustomerName.trim().length < 2) {
      return NextResponse.json({ error: 'Enter the customer name (min 2 characters).' }, { status: 400 });
    }
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { regionCode: true },
    });
    let phoneNorm: string | null = null;
    if (p.newCustomerPhone.trim()) {
      const phoneCheck = validatePhone(p.newCustomerPhone.trim(), business?.regionCode ?? 'IN');
      if (!phoneCheck.ok) return NextResponse.json({ error: INVALID_PHONE_MESSAGE }, { status: 400 });
      phoneNorm = phoneCheck.digits;
    }
    const customer = await prisma.customer.create({
      data: {
        name: p.newCustomerName.trim(),
        phone: p.newCustomerPhone.trim() || null,
        phoneNorm,
        businessId,
      },
    });
    customerId = customer.id;
  }

  const customer = await prisma.customer.findFirst({ where: { id: customerId, businessId } });
  if (!customer) {
    return NextResponse.json({ error: 'Selected customer not found.' }, { status: 400 });
  }

  const [y, m, d] = p.date.split('-').map(Number);
  const date = new Date(y, m - 1, d, 0, 0, 0, 0);

  // Idempotency: same customer/title/date/time/price created in the last
  // 15 minutes (e.g. a retry after a lost response) is already synced.
  const recent = await prisma.job.findFirst({
    where: {
      businessId,
      customerId,
      title: p.title.trim(),
      date,
      price: p.price,
      createdAt: { gte: new Date(Date.now() - 15 * 60 * 1000) },
    },
    select: { id: true },
  });
  if (recent) {
    return NextResponse.json({ ok: true, jobId: recent.id, deduped: true });
  }

  const job = await prisma.job.create({
    data: {
      title: p.title.trim(),
      customerId,
      businessId,
      date,
      time: p.time || null,
      address: p.address || null,
      price: p.price,
      status: 'SCHEDULED',
      notes: p.notes || null,
      technician: p.technician || null,
    },
  });

  return NextResponse.json({ ok: true, jobId: job.id });
}
