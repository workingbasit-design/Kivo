/**
 * Case-insensitive exact customer-name matching for the Copilot flows.
 *
 * Root cause (2026-10-10 QA): Postgres `contains` is case-SENSITIVE, so the
 * candidate fetch `name: { contains: draft.customerName }` returned zero rows
 * when the draft name differed in case from the stored one (e.g. draft
 * "Qatest Copilot Customer" vs stored "QATEST Copilot Customer"). The
 * follow-up JS exact-match comparison (already case-insensitive) never got a
 * chance to run, and the confirm path created a duplicate customer.
 *
 * The fix is two-layered, in this file:
 *  1. the candidate fetch uses `mode: 'insensitive'` (ILIKE), so case-only
 *     differences are still found;
 *  2. the exact-match comparison stays in JS on trimmed/lowercased names, so
 *     a job is never attached to a merely partial-name customer.
 */
import type { PrismaClient } from '@prisma/client';

export type NameMatchCandidate = { id: string; name: string };

/**
 * Fetch name candidates case-insensitively, tenant-scoped. The caller keeps
 * the usual `businessId` scoping contract.
 */
export async function findCustomerNameCandidates(
  prisma: PrismaClient,
  businessId: string,
  name: string
): Promise<NameMatchCandidate[]> {
  return prisma.customer.findMany({
    where: { businessId, name: { contains: name, mode: 'insensitive' } },
    select: { id: true, name: true },
    take: 5,
  });
}

/** Exact match on trimmed + lowercased names; null when there is none. */
export function exactNameMatch(
  candidates: NameMatchCandidate[],
  name: string
): NameMatchCandidate | null {
  const wanted = name.trim().toLowerCase();
  return candidates.find((c) => c.name.trim().toLowerCase() === wanted) ?? null;
}
