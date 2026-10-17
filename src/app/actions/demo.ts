'use server';

import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { requireMembership } from '@/lib/membership';
import { rateLimit, ACTION_LIMIT } from '@/lib/rate-limit';

/**
 * Part 0 (dashboard rebuild): the stable id of the seeded demo business.
 * It only exists where scripts/seed-demo.ts has run (local/dev) — never
 * production, since the seed script refuses non-local hosts.
 * ('use server' modules may only export async functions, so this stays
 * module-private.)
 */
const DEMO_BUSINESS_ID = 'demo-biz';

export type DemoResult = { error?: string };

async function checkLimit(userId: string): Promise<DemoResult | null> {
  const rl = rateLimit(`demo:${userId}`, ACTION_LIMIT);
  if (!rl.ok) {
    return { error: 'Too many requests. Please wait a moment and try again.' };
  }
  return null;
}

/**
 * Owner-only Settings switch: open the demo business for UAT demos and
 * design reviews.
 *
 * - The caller must be OWNER of the business they are currently in.
 * - Refuses when the demo business has not been seeded here.
 * - Grants the caller an OWNER membership in the demo business (idempotent)
 *   and points their activeMembershipId at it, then lands on the dashboard.
 * - Demo data is tenant-scoped by businessId exactly like real data, so it
 *   can never mix with the caller's own business.
 */
export async function openDemoBusiness(): Promise<DemoResult> {
  const { businessId, user } = await requireAuth();
  const limited = await checkLimit(user.id);
  if (limited) return limited;
  await requireMembership(businessId, 'OWNER');

  const demo = await prisma.business.findUnique({
    where: { id: DEMO_BUSINESS_ID },
    select: { id: true, isDemo: true },
  });
  if (!demo || !demo.isDemo) {
    return { error: 'The demo business has not been set up here yet.' };
  }
  if (businessId === demo.id) redirect('/dashboard');

  // Idempotent: findFirst + create/update, each carrying a top-level
  // businessId so the tenant guard stays satisfied (it does not recognize
  // the compound userId_businessId key as scoped).
  let membership = await prisma.membership.findFirst({
    where: { userId: user.id, businessId: demo.id },
  });
  if (!membership) {
    membership = await prisma.membership.create({
      data: { userId: user.id, businessId: demo.id, role: 'OWNER', status: 'ACTIVE' },
    });
  } else if (membership.status !== 'ACTIVE' || membership.role !== 'OWNER') {
    membership = await prisma.membership.update({
      where: { id: membership.id, businessId: demo.id },
      data: { status: 'ACTIVE', role: 'OWNER' },
    });
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { activeMembershipId: membership.id },
  });
  redirect('/dashboard');
}

/**
 * Leave the demo business and return to the caller's own business.
 * Clearing activeMembershipId falls back to their earliest ACTIVE
 * membership, which predates the demo membership.
 */
export async function leaveDemoBusiness(): Promise<void> {
  const { user } = await requireAuth();
  await prisma.user.update({
    where: { id: user.id },
    data: { activeMembershipId: null },
  });
  redirect('/dashboard');
}
