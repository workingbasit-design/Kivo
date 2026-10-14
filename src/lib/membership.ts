/**
 * Membership-based authorization (Prompt 3, M1).
 *
 * The Membership table is the authority for permission checks. `User.role`
 * / `User.businessId` were legacy single-business fields, dropped in M9.
 * A user can belong to several businesses with a different role in each.
 *
 * Role semantics (minimum viable):
 * - OWNER: everything, incl. team management, billing, Stripe Connect,
 *   settings, delete/void.
 * - ADMIN: everything except team role changes and Stripe Connect.
 * - DISPATCHER: jobs, schedule, customers, quotes, invoices (create/send),
 *   no money settings, no team, no void.
 * - TECHNICIAN: own assigned jobs, job notes/photos/checklist, time
 *   entries; read-only on customers/jobs otherwise; no money, no settings.
 */
import { prisma } from './prisma.ts';
import { unsafeUnscoped } from './tenant-guard.ts';
// NOTE: '@/' alias (not a relative './auth.ts') so the test stub loaders
// (which stub the '@\/lib\/auth' specifier) keep intercepting this in tests.
import { requireAuth } from '@/lib/auth';

export const MEMBERSHIP_ROLES = ['OWNER', 'ADMIN', 'DISPATCHER', 'TECHNICIAN'] as const;
export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number];

export const MEMBERSHIP_STATUSES = ['ACTIVE', 'INVITED', 'SUSPENDED', 'REMOVED'] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

export function isMembershipRole(value: unknown): value is MembershipRole {
  return (
    typeof value === 'string' &&
    (MEMBERSHIP_ROLES as readonly string[]).includes(value)
  );
}

/** Legacy User.role -> Membership role mapping (same as the M1 backfill). */
export function mapLegacyRole(role: string | null | undefined): MembershipRole {
  if (role === 'OWNER') return 'OWNER';
  if (role === 'ADMIN') return 'ADMIN';
  return 'TECHNICIAN';
}

export type MembershipRow = {
  id: string;
  userId: string;
  businessId: string;
  role: string;
  status: string;
};

/** All ACTIVE memberships for a user. */
export async function getMembershipsForUser(userId: string): Promise<MembershipRow[]> {
  // unsafeUnscoped: identity-root lookup keyed by the session's own userId
  // (same category as the User exclusion in tenant-guard.ts) — the userId
  // IS the authorization, and no tenant is known yet at this point.
  return unsafeUnscoped('membership:by-user', (db) =>
    db.membership.findMany({
      where: { userId, status: 'ACTIVE' },
      select: { id: true, userId: true, businessId: true, role: true, status: true },
    })
  );
}

/** The caller's ACTIVE membership in one business, or null. */
export async function getUserMembership(
  userId: string,
  businessId: string
): Promise<MembershipRow | null> {
  return prisma.membership.findFirst({
    where: { userId, businessId, status: 'ACTIVE' },
    select: { id: true, userId: true, businessId: true, role: true, status: true },
  });
}

/**
 * The user's current business context: their earliest-created ACTIVE
 * membership (M1 backfilled exactly one per user, so this is deterministic).
 * Used by requireAuth() (M9) now that User.businessId is dropped.
 */
export async function getActiveMembershipForUser(
  userId: string
): Promise<MembershipRow | null> {
  // unsafeUnscoped: identity-root lookup keyed by the session's own userId
  // (same category as the User exclusion in tenant-guard.ts) — the userId
  // IS the authorization, and no tenant is known yet at this point.
  // This is the hot path of requireAuth(): every authenticated request.
  return unsafeUnscoped('membership:active-for-user', (db) =>
    db.membership.findFirst({
      where: { userId, status: 'ACTIVE' },
      orderBy: { createdAt: 'asc' },
      select: { id: true, userId: true, businessId: true, role: true, status: true },
    })
  );
}

/**
 * Require the signed-in user to hold an ACTIVE membership in `businessId`
 * with one of `allowedRoles`. Throws (redirects to /login via requireAuth
 * when there is no session) when the caller lacks membership.
 *
 * Server actions should prefer this over bare requireAuth() when the
 * action is role-gated. requireAuth() alone only proves "logged in with
 * a business" — it does not prove a role.
 */
export async function requireMembership(
  businessId: string,
  ...allowedRoles: MembershipRole[]
): Promise<{ userId: string; businessId: string; role: MembershipRole; membershipId: string }> {
  const { user } = await requireAuth();
  const membership = await getUserMembership(user.id, businessId);
  if (!membership) {
    throw new Error('You do not have access to this business.');
  }
  if (allowedRoles.length > 0 && !allowedRoles.includes(membership.role as MembershipRole)) {
    throw new Error('Your role does not allow this action.');
  }
  return {
    userId: user.id,
    businessId,
    role: membership.role as MembershipRole,
    membershipId: membership.id,
  };
}
