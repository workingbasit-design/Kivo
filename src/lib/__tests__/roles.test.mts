/**
 * F4-001: permissions matrix — every role × capability.
 * F4-002: double-booking detection (overlap logic).
 *
 * Pure tests: no DB, no auth. Run with `npm test` (node --test).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register('./register-loader.mjs', import.meta.url);
register('./auth-stub-loader.mjs', import.meta.url);

const {
  PERMISSION_MATRIX,
  CAPABILITIES,
  canRole,
  canSeePrices,
  overlaps,
  findDoubleBookings,
  doubleBookingMessage,
} = await import('../roles.ts');
type TeamRole = 'OWNER' | 'ADMIN' | 'DISPATCHER' | 'TECHNICIAN';
type Capability =
  | 'MANAGE_TEAM'
  | 'SEE_PRICES'
  | 'MANAGE_JOBS'
  | 'DISPATCH_ASSIGN'
  | 'VIEW_ALL_JOBS'
  | 'MY_DAY'
  | 'CLOCK_IN_OUT'
  | 'VIEW_CONTACT_INFO'
  | 'MANAGE_SETTINGS';

const ROLES: TeamRole[] = ['OWNER', 'ADMIN', 'DISPATCHER', 'TECHNICIAN'];

/** Expected matrix from the F4 spec (source of truth for the test). */
const EXPECTED: Record<TeamRole, Record<Capability, boolean>> = {
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

describe('F4-001: permissions matrix (role × capability)', () => {
  test('matrix covers all 4 roles and all 9 capabilities', () => {
    assert.deepEqual(Object.keys(PERMISSION_MATRIX).sort(), [...ROLES].sort());
    assert.equal(CAPABILITIES.length, 9);
    for (const role of ROLES) {
      assert.deepEqual(
        Object.keys(PERMISSION_MATRIX[role]).sort(),
        [...CAPABILITIES].sort(),
        `${role}: capability keys drifted`,
      );
    }
  });

  test('matrix matches the spec row for every role × capability', () => {
    for (const role of ROLES) {
      for (const cap of CAPABILITIES) {
        assert.equal(
          PERMISSION_MATRIX[role][cap],
          EXPECTED[role][cap],
          `${role} × ${cap}`,
        );
      }
    }
  });

  test('canRole: technicians cannot see prices/invoices/reports or manage anything', () => {
    for (const cap of [
      'MANAGE_TEAM',
      'SEE_PRICES',
      'MANAGE_JOBS',
      'DISPATCH_ASSIGN',
      'VIEW_ALL_JOBS',
      'MANAGE_SETTINGS',
    ] as Capability[]) {
      assert.equal(canRole('TECHNICIAN', cap), false, `TECHNICIAN × ${cap}`);
    }
    for (const cap of ['MY_DAY', 'CLOCK_IN_OUT', 'VIEW_CONTACT_INFO'] as Capability[]) {
      assert.equal(canRole('TECHNICIAN', cap), true, `TECHNICIAN × ${cap}`);
    }
  });

  test('canRole: dispatchers cannot manage team, my-day, or clock; cannot touch settings', () => {
    assert.equal(canRole('DISPATCHER', 'MANAGE_TEAM'), false);
    assert.equal(canRole('DISPATCHER', 'MY_DAY'), false);
    assert.equal(canRole('DISPATCHER', 'CLOCK_IN_OUT'), false);
    assert.equal(canRole('DISPATCHER', 'MANAGE_SETTINGS'), false);
    assert.equal(canRole('DISPATCHER', 'DISPATCH_ASSIGN'), true);
    assert.equal(canRole('DISPATCHER', 'VIEW_ALL_JOBS'), true);
  });

  test('canRole: owner is all-powerful; admin lacks only settings/billing', () => {
    for (const cap of CAPABILITIES) {
      assert.equal(canRole('OWNER', cap), true, `OWNER × ${cap}`);
      assert.equal(
        canRole('ADMIN', cap),
        cap !== 'MANAGE_SETTINGS',
        `ADMIN × ${cap}`,
      );
    }
  });

  test('canRole: unknown/empty role denies everything (fail-closed)', () => {
    for (const role of [undefined, null, '', 'SUPERADMIN', 'owner']) {
      for (const cap of CAPABILITIES) {
        assert.equal(canRole(role as string, cap), false, `${String(role)} × ${cap}`);
      }
    }
  });
});

describe('F4-002: double-booking overlap logic', () => {
  const d = (h: number, m = 0) => new Date(2026, 9, 15, h, m);

  test('overlapping windows detected', () => {
    assert.equal(overlaps({ start: d(9), end: d(11) }, { start: d(10), end: d(12) }), true);
    assert.equal(overlaps({ start: d(9), end: d(12) }, { start: d(10), end: d(11) }), true);
    assert.equal(overlaps({ start: d(9), end: d(11) }, { start: d(9), end: d(11) }), true);
  });

  test('touching edges are NOT an overlap (back-to-back is fine)', () => {
    assert.equal(overlaps({ start: d(9), end: d(11) }, { start: d(11), end: d(13) }), false);
    assert.equal(overlaps({ start: d(11), end: d(13) }, { start: d(9), end: d(11) }), false);
  });

  test('disjoint windows do not overlap; invalid input is safe', () => {
    assert.equal(overlaps({ start: d(9), end: d(10) }, { start: d(14), end: d(15) }), false);
    assert.equal(overlaps({ start: 'nope', end: d(10) }, { start: d(9), end: d(11) }), false);
    assert.equal(overlaps({ start: d(11), end: d(9) }, { start: d(9), end: d(11) }), false);
  });

  test('findDoubleBookings returns only conflicts, excluding the job being edited', () => {
    const existing = [
      { jobId: 'j1', jobTitle: 'Drain cleaning', technicianName: 'Marc', start: d(9), end: d(11) },
      { jobId: 'j2', jobTitle: 'Camera inspection', technicianName: 'Marc', start: d(13), end: d(15) },
    ];
    const found = findDoubleBookings({ start: d(10, 30), end: d(12) }, existing);
    assert.equal(found.length, 1);
    assert.equal(found[0].jobId, 'j1');
    // Same job being reassigned is excluded.
    assert.equal(findDoubleBookings({ start: d(10), end: d(12) }, existing, 'j1').length, 0);
  });

  test('doubleBookingMessage matches the spec format', () => {
    const msg = doubleBookingMessage({
      jobId: 'j1',
      jobTitle: 'Job 1041',
      technicianName: 'Marc',
      start: d(9),
      end: d(11),
    });
    assert.match(msg, /^Marc is already on Job 1041 \d{1,2}:\d{2}.*–.*\d{1,2}:\d{2}/);
  });
});

describe('canSeePrices: SEE_PRICES UI gate (dashboard money line, Money tab)', () => {
  test('OWNER, ADMIN and DISPATCHER see prices', () => {
    assert.equal(canSeePrices('OWNER'), true);
    assert.equal(canSeePrices('ADMIN'), true);
    assert.equal(canSeePrices('DISPATCHER'), true);
  });

  test('TECHNICIAN does not see prices', () => {
    assert.equal(canSeePrices('TECHNICIAN'), false);
  });

  test('unknown / missing roles fail closed', () => {
    assert.equal(canSeePrices('MEMBER'), false);
    assert.equal(canSeePrices(null), false);
    assert.equal(canSeePrices(undefined), false);
    assert.equal(canSeePrices(''), false);
  });

  test('matches the SEE_PRICES matrix entry for every role', () => {
    for (const role of ROLES) {
      assert.equal(canSeePrices(role), PERMISSION_MATRIX[role].SEE_PRICES);
    }
  });
});
