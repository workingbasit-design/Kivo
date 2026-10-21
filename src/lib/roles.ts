/**
 * F4: Team, roles, and dispatch — server-side permission matrix.
 *
 * The matrix is the single source of truth for what each team role may do.
 * UI hides things, but every server action and API route enforces through
 * `requireCapability()`. The matrix itself is unit-tested role × capability
 * (F4-001) in src/lib/__tests__/roles.test.mts.
 *
 * Roles come from Membership.role: OWNER | ADMIN | DISPATCHER | TECHNICIAN.
 *
 * Pure helpers (canRole, overlaps, findDoubleBookings) carry explicit `.ts`
 * extensions in imports so the node --test loader can resolve them.
 */

import { requireAuth } from '@/lib/auth';

export type TeamRole = 'OWNER' | 'ADMIN' | 'DISPATCHER' | 'TECHNICIAN';

/** Every capability the app gates by role. Add new capabilities here. */
export type Capability =
  | 'MANAGE_TEAM' // invite/remove/change roles
  | 'SEE_PRICES' // prices, invoices, reports
  | 'MANAGE_JOBS' // create/edit jobs & schedule
  | 'DISPATCH_ASSIGN' // assign visits to technicians
  | 'VIEW_ALL_JOBS' // see every job (technicians see only their own)
  | 'MY_DAY' // technician day view: visits, complete, photos
  | 'CLOCK_IN_OUT' // clock in/out per visit
  | 'VIEW_CONTACT_INFO' // customer contact details
  | 'MANAGE_SETTINGS'; // settings / billing / feature flags

export const CAPABILITIES: readonly Capability[] = [
  'MANAGE_TEAM',
  'SEE_PRICES',
  'MANAGE_JOBS',
  'DISPATCH_ASSIGN',
  'VIEW_ALL_JOBS',
  'MY_DAY',
  'CLOCK_IN_OUT',
  'VIEW_CONTACT_INFO',
  'MANAGE_SETTINGS',
];

/**
 * The permissions matrix (spec §Permissions matrix):
 *
 * | Capability          | Owner | Admin | Dispatcher | Technician |
 * | Manage team         |  yes  |  yes  |    no      |    no      |
 * | See prices/inv/rep  |  yes  |  yes  |    yes     |    no      |
 * | Create/edit jobs    |  yes  |  yes  |    yes     |    no      |
 * | Assign visits       |  yes  |  yes  |    yes     |    no      |
 * | View all jobs       |  yes  |  yes  |    yes     |    no      |
 * | My day / complete   |  yes  |  yes  |    no      |    yes     |
 * | Clock in/out        |  yes  |  yes  |    no      |    yes     |
 * | Customer contact    |  yes  |  yes  |    yes     |    yes*    |
 * | Settings / billing  |  yes  |  no   |    no      |    no      |
 *
 * (*) technicians see contact info for their own visits only — enforced by
 * the visit-level assignment check, not this matrix.
 */
export const PERMISSION_MATRIX: Record<TeamRole, Record<Capability, boolean>> = {
  OWNER: {
    MANAGE_TEAM: true,
    SEE_PRICES: true,
    MANAGE_JOBS: true,
    DISPATCH_ASSIGN: true,
    VIEW_ALL_JOBS: true,
    MY_DAY: true,
    CLOCK_IN_OUT: true,
    VIEW_CONTACT_INFO: true,
    MANAGE_SETTINGS: true,
  },
  ADMIN: {
    MANAGE_TEAM: true,
    SEE_PRICES: true,
    MANAGE_JOBS: true,
    DISPATCH_ASSIGN: true,
    VIEW_ALL_JOBS: true,
    MY_DAY: true,
    CLOCK_IN_OUT: true,
    VIEW_CONTACT_INFO: true,
    MANAGE_SETTINGS: false,
  },
  DISPATCHER: {
    MANAGE_TEAM: false,
    SEE_PRICES: true,
    MANAGE_JOBS: true,
    DISPATCH_ASSIGN: true,
    VIEW_ALL_JOBS: true,
    MY_DAY: false,
    CLOCK_IN_OUT: false,
    VIEW_CONTACT_INFO: true,
    MANAGE_SETTINGS: false,
  },
  TECHNICIAN: {
    MANAGE_TEAM: false,
    SEE_PRICES: false,
    MANAGE_JOBS: false,
    DISPATCH_ASSIGN: false,
    VIEW_ALL_JOBS: false,
    MY_DAY: true,
    CLOCK_IN_OUT: true,
    VIEW_CONTACT_INFO: true,
    MANAGE_SETTINGS: false,
  },
};

/** Pure: does this role hold the capability? */
export function canRole(role: string | null | undefined, capability: Capability): boolean {
  if (role !== 'OWNER' && role !== 'ADMIN' && role !== 'DISPATCHER' && role !== 'TECHNICIAN') {
    return false; // unknown role => deny (fail-closed)
  }
  return PERMISSION_MATRIX[role][capability];
}

/**
 * Pure UI gate: may this viewer see prices and money aggregates
 * (dashboard money lines, the Money tab)? Thin named wrapper over the
 * SEE_PRICES matrix entry so every surface gates the same way.
 * TECHNICIAN (and any unknown role) => false.
 */
export function canSeePrices(role: string | null | undefined): boolean {
  return canRole(role, 'SEE_PRICES');
}

export type AuthedTeamUser = {
  user: { id: string; name: string | null; email: string | null };
  businessId: string;
  role: TeamRole;
  membershipId: string;
};

/**
 * Server-side enforcement: call at the top of every role-gated action/route.
 * Throws (never redirects) so API routes get a catchable error they can turn
 * into a 403; pages should catch and call forbidden()/redirect.
 */
export async function requireCapability(capability: Capability): Promise<AuthedTeamUser> {
  const { user, businessId, role, membershipId } = await requireAuth();
  if (!canRole(role, capability)) {
    const err = new Error(`Your role (${role}) does not allow this action.`);
    (err as Error & { code?: string }).code = 'FORBIDDEN_ROLE';
    throw err;
  }
  return { user, businessId, role: role as TeamRole, membershipId };
}

/** True when the error was raised by requireCapability (role denial). */
export function isRoleDenied(err: unknown): boolean {
  return err instanceof Error && (err as Error & { code?: string }).code === 'FORBIDDEN_ROLE';
}

// ---------------------------------------------------------------------------
// Double-booking detection (pure, unit-tested — F4-002)
// ---------------------------------------------------------------------------

export type TimeWindow = { start: Date | string | number; end: Date | string | number };

/**
 * True when two windows overlap. Touching edges (end === start) do NOT count
 * as overlap — back-to-back visits are fine.
 */
export function overlaps(a: TimeWindow, b: TimeWindow): boolean {
  const aStart = new Date(a.start).getTime();
  const aEnd = new Date(a.end).getTime();
  const bStart = new Date(b.start).getTime();
  const bEnd = new Date(b.end).getTime();
  if ([aStart, aEnd, bStart, bEnd].some(Number.isNaN)) return false;
  if (aEnd <= aStart || bEnd <= bStart) return false;
  return aStart < bEnd && bStart < aEnd;
}

export type AssignmentWindow = TimeWindow & {
  jobId: string;
  jobTitle: string;
  technicianName: string;
};

/**
 * Find this technician's existing assignments that overlap `proposed`.
 * Excludes `excludeJobId` (the job being edited).
 */
export function findDoubleBookings(
  proposed: TimeWindow,
  existing: AssignmentWindow[],
  excludeJobId?: string,
): AssignmentWindow[] {
  return existing.filter(
    (e) => e.jobId !== excludeJobId && overlaps(proposed, { start: e.start, end: e.end }),
  );
}

/** "Marc is already on Job 1041 9:00–11:00" — the warning line from the spec. */
export function doubleBookingMessage(conflict: AssignmentWindow): string {
  const fmt = (v: Date | string | number) =>
    new Date(v).toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' });
  return `${conflict.technicianName} is already on ${conflict.jobTitle} ${fmt(conflict.start)}–${fmt(conflict.end)}`;
}
