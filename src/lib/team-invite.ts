/**
 * Team invite core (fix D1, 2026-10-21).
 *
 * The invite flow used to live inline in `inviteTeamMember`
 * (src/app/actions/settings.ts) and was broken end-to-end:
 * - The form offered role "MEMBER", which the Membership_role_check DB
 *   constraint (migration m1) rejects — only OWNER / ADMIN / DISPATCHER /
 *   TECHNICIAN may be stored.
 * - The action created the User row first and the Membership second with
 *   no transaction, so the rejected insert left an ORPHAN account: no
 *   membership (login requires an ACTIVE one), invisible in the team
 *   list, and the email could never be re-invited ("already exists").
 *
 * This module is the single place that knows:
 * - which roles an invite may grant (INVITABLE_ROLES — a subset of the
 *   DB-legal MEMBERSHIP_ROLES; OWNER is never invitable),
 * - how an already-registered email classifies (classifyInviteTarget),
 * - how user + membership are created ATOMICALLY (one $transaction), and
 * - how an orphaned email (user row, zero memberships — the signature of
 *   a previously failed invite) is RECOVERED instead of dead-ending.
 *
 * Pure helpers carry no imports beyond membership.ts constants so the
 * node --test harness can exercise them with a stubbed prisma.
 */
import { prisma } from './prisma.ts';
import { unsafeUnscoped } from './tenant-guard.ts';
import { MEMBERSHIP_ROLES, type MembershipRole } from './membership.ts';

/**
 * Roles the team invite form may grant. Deliberately excludes OWNER:
 * ownership is established when the business is created, never handed
 * out by an invite. Every value here MUST satisfy the
 * Membership_role_check DB constraint (asserted by team-invite.test.mts
 * against the m1 migration SQL, so the two can never drift apart again).
 */
export const INVITABLE_ROLES = ['ADMIN', 'DISPATCHER', 'TECHNICIAN'] as const;
export type InvitableRole = (typeof INVITABLE_ROLES)[number];

/** The role pre-selected in the invite form: the restricted field role. */
export const DEFAULT_INVITE_ROLE: InvitableRole = 'TECHNICIAN';

export function isInvitableRole(value: unknown): value is InvitableRole {
  return (
    typeof value === 'string' &&
    (INVITABLE_ROLES as readonly string[]).includes(value)
  );
}

/** True when a value may be stored in Membership.role per the DB CHECK. */
export function roleSatisfiesDbCheck(value: unknown): value is MembershipRole {
  return (
    typeof value === 'string' &&
    (MEMBERSHIP_ROLES as readonly string[]).includes(value)
  );
}

export type InviteTarget =
  /** No user row for the email: a fresh invite. */
  | { kind: 'new' }
  /** User row exists but has ZERO memberships anywhere: the signature of
   *  a previously failed invite. Recoverable — complete the invite on
   *  the existing row instead of dead-ending on "already exists". */
  | { kind: 'orphan'; userId: string }
  /** Already an ACTIVE member of THIS business. */
  | { kind: 'already-member' }
  /** A real account that belongs to other business(es). Not ours to
   *  touch; the invite is refused like before. */
  | { kind: 'existing-user' };

export function classifyInviteTarget(input: {
  userId: string | null;
  memberships: ReadonlyArray<{ businessId: string; status: string }>;
  businessId: string;
}): InviteTarget {
  if (!input.userId) return { kind: 'new' };
  const activeHere = input.memberships.some(
    (m) => m.businessId === input.businessId && m.status === 'ACTIVE',
  );
  if (activeHere) return { kind: 'already-member' };
  if (input.memberships.length === 0) {
    return { kind: 'orphan', userId: input.userId };
  }
  return { kind: 'existing-user' };
}

export type InviteResult =
  | { ok: true; userId: string; recovered: boolean }
  | { ok: false; error: string; cause?: unknown };

/**
 * Create (or recover) an invited team member. The role is validated
 * BEFORE any write, and the user + membership writes happen inside a
 * single transaction, so a failure can never leave an orphan account
 * behind. Tenant scope: the membership is created for `businessId`
 * (the caller's own business, from the session); the by-user membership
 * lookup is an identity-root read (the email IS the lookup key, no
 * tenant is known for it yet), same category as membership.ts.
 */
export async function inviteMemberToBusiness(args: {
  businessId: string;
  name: string;
  email: string;
  passwordHash: string;
  role: string;
}): Promise<InviteResult> {
  if (!isInvitableRole(args.role)) {
    return {
      ok: false,
      error: 'Choose a valid role for the new team member.',
    };
  }
  const role: MembershipRole = args.role;

  const existing = await prisma.user.findUnique({
    where: { email: args.email },
    select: { id: true },
  });

  let target: InviteTarget = { kind: 'new' };
  if (existing) {
    // unsafeUnscoped: identity-root lookup keyed by the invited user's
    // own id (same category as membership.ts 'membership:by-user') — we
    // must see ALL of the user's memberships to tell an orphan (zero
    // memberships) from a real account of another business.
    const memberships = await unsafeUnscoped('team-invite:by-user', (db) =>
      db.membership.findMany({
        where: { userId: existing.id },
        select: { businessId: true, status: true },
      }),
    );
    target = classifyInviteTarget({
      userId: existing.id,
      memberships,
      businessId: args.businessId,
    });
  }

  if (target.kind === 'already-member') {
    return { ok: false, error: 'That person is already on your team.' };
  }
  if (target.kind === 'existing-user') {
    return { ok: false, error: 'A user with this email already exists.' };
  }

  try {
    const userId = await prisma.$transaction(async (tx) => {
      if (target.kind === 'orphan') {
        // Complete the previously failed invite on the existing row:
        // refresh the credentials the owner just chose and attach the
        // membership — all-or-nothing with the update above it.
        await tx.user.update({
          where: { id: target.userId },
          data: { name: args.name, passwordHash: args.passwordHash },
        });
        await tx.membership.create({
          data: {
            userId: target.userId,
            businessId: args.businessId,
            role,
            status: 'ACTIVE',
          },
        });
        return target.userId;
      }
      const created = await tx.user.create({
        data: { name: args.name, email: args.email, passwordHash: args.passwordHash },
      });
      await tx.membership.create({
        data: {
          userId: created.id,
          businessId: args.businessId,
          role,
          status: 'ACTIVE',
        },
      });
      return created.id;
    });
    return { ok: true, userId, recovered: target.kind === 'orphan' };
  } catch (err) {
    // The transaction rolled back: no user row, no membership. The email
    // stays usable — the owner can simply try again.
    return {
      ok: false,
      error: 'Could not add that team member. Please try again.',
      cause: err,
    };
  }
}
