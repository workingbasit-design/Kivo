import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { getActiveMembershipForUser } from '@/lib/membership';
import { rateLimit } from '@/lib/rate-limit';
import { checkSameOrigin, originForbidden } from '@/lib/csrf';
import { centsToDollars } from '@/lib/money';

export const maxDuration = 30;

/**
 * GET /api/search?q=…
 *
 * Quick-search record lookup for the command palette (⌘K): customers,
 * jobs, quotes and invoices matching a name, number or title.
 * Tenant-scoped, auth-checked, rate-limited. Read-only; only whitelisted
 * fields are returned, never a businessId.
 *
 * 2026-11-06: the palette previously searched nav pages + quick actions
 * only, so typing an existing customer's name returned "No matches" even
 * though its placeholder promised record search.
 */
const searchQuerySchema = z.object({
  q: z.string().trim().min(1).max(80),
});

export async function GET(req: Request) {
  const originCheck = checkSameOrigin(req);
  if (!originCheck.ok) return originForbidden(originCheck.reason);

  const session = await getSession();
  const membership = session ? await getActiveMembershipForUser(session.user.id) : null;
  const businessId = membership?.businessId;
  if (!session || !businessId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rl = rateLimit(`search:${session.user.id}`, { limit: 60, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const url = new URL(req.url);
  const parsed = searchQuerySchema.safeParse({ q: url.searchParams.get('q') ?? undefined });
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid search request' }, { status: 400 });
  }
  const q = parsed.data.q;

  const [customers, jobs, quotes, invoices] = await Promise.all([
    prisma.customer.findMany({
      where: {
        businessId,
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { phone: { contains: q } },
        ],
      },
      select: { id: true, name: true, phone: true },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    }),
    prisma.job.findMany({
      where: {
        businessId,
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { customer: { name: { contains: q, mode: 'insensitive' } } },
        ],
      },
      select: { id: true, title: true, customer: { select: { name: true } } },
      orderBy: { date: 'desc' },
      take: 5,
    }),
    prisma.quote.findMany({
      where: {
        businessId,
        OR: [
          { number: { contains: q, mode: 'insensitive' } },
          { title: { contains: q, mode: 'insensitive' } },
          { customer: { name: { contains: q, mode: 'insensitive' } } },
        ],
      },
      select: { id: true, number: true, title: true, customer: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    prisma.invoice.findMany({
      where: {
        businessId,
        OR: [
          { number: { contains: q, mode: 'insensitive' } },
          { customer: { name: { contains: q, mode: 'insensitive' } } },
        ],
      },
      select: { id: true, number: true, totalCents: true, customer: { select: { name: true } } },
      orderBy: { date: 'desc' },
      take: 5,
    }),
  ]);

  return NextResponse.json({
    customers: customers.map((c) => ({ id: c.id, name: c.name, phone: c.phone })),
    jobs: jobs.map((j) => ({ id: j.id, title: j.title, customerName: j.customer.name })),
    quotes: quotes.map((q) => ({
      id: q.id,
      number: q.number,
      title: q.title,
      customerName: q.customer.name,
    })),
    invoices: invoices.map((i) => ({
      id: i.id,
      number: i.number,
      total: centsToDollars(i.totalCents),
      customerName: i.customer.name,
    })),
  });
}
