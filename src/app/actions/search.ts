'use server';

import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { parseFlags, isFlagOn } from '@/lib/feature-flags';
import { FLAG_NOTIFICATIONS } from '@/lib/f10-notify';

export interface SearchHit {
  id: string;
  title: string;
  detail: string;
  href: string;
}

export interface SearchResults {
  customers: SearchHit[];
  jobs: SearchHit[];
  quotes: SearchHit[];
  invoices: SearchHit[];
}

const EMPTY: SearchResults = { customers: [], jobs: [], quotes: [], invoices: [] };
const PER_TYPE = 5;

/**
 * F10 global search: customers, jobs, quotes, invoices — business-scoped ONLY.
 *
 * Tenant isolation is the hard requirement: every query embeds businessId, so
 * Business B can never see Business A's records. Technicians additionally
 * only see jobs assigned to them.
 *
 * Gated by the per-business `notifications` feature flag (F10 ships search
 * together with the new notifications).
 */
export async function searchRecords(query: string): Promise<SearchResults> {
  const { businessId, user, role } = await requireAuth();

  const q = (query ?? '').trim().slice(0, 64);
  // Edge case 3: fewer than 2 characters => no search, just the hint.
  if (q.length < 2) return EMPTY;

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { featureFlags: true },
  });
  if (!business || !isFlagOn(parseFlags(business.featureFlags), FLAG_NOTIFICATIONS)) {
    return EMPTY;
  }

  // Technicians see only their own assigned jobs (spec permission matrix).
  const isTech = role === 'TECHNICIAN';
  const jobScope = isTech ? { assignedToId: user.id } : {};

  const contains = { contains: q, mode: 'insensitive' as const };

  const [customers, jobs, quotes, invoices] = await Promise.all([
    prisma.customer.findMany({
      where: {
        businessId,
        archivedAt: null, // archived customers are hidden from lists
        OR: [{ name: contains }, { phone: contains }, { email: contains }],
      },
      select: { id: true, name: true, phone: true, email: true },
      orderBy: { name: 'asc' },
      take: PER_TYPE,
    }),
    prisma.job.findMany({
      where: {
        businessId,
        ...jobScope,
        OR: [{ title: contains }, { customer: { name: contains } }],
      },
      select: {
        id: true,
        title: true,
        status: true,
        customer: { select: { name: true } },
      },
      orderBy: { date: 'desc' },
      take: PER_TYPE,
    }),
    prisma.quote.findMany({
      where: {
        businessId,
        OR: [{ number: contains }, { title: contains }, { customer: { name: contains } }],
      },
      select: {
        id: true,
        number: true,
        title: true,
        status: true,
        customer: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: PER_TYPE,
    }),
    prisma.invoice.findMany({
      where: {
        businessId,
        OR: [{ number: contains }, { customer: { name: contains } }],
      },
      select: {
        id: true,
        number: true,
        status: true,
        customer: { select: { name: true } },
      },
      orderBy: { date: 'desc' },
      take: PER_TYPE,
    }),
  ]);

  return {
    customers: customers.map((c) => ({
      id: c.id,
      title: c.name,
      detail: c.phone ?? c.email ?? '',
      href: `/customers/${c.id}`,
    })),
    jobs: jobs.map((j) => ({
      id: j.id,
      title: j.title,
      detail: `${j.customer.name} · ${j.status}`,
      href: `/jobs/${j.id}`,
    })),
    quotes: quotes.map((q) => ({
      id: q.id,
      title: q.number,
      detail: `${q.customer.name} · ${q.status}`,
      href: `/quotes/${q.id}`,
    })),
    invoices: invoices.map((i) => ({
      id: i.id,
      title: i.number,
      detail: `${i.customer.name} · ${i.status}`,
      href: `/invoices/${i.id}`,
    })),
  };
}
