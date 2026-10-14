/**
 * Stub for the B1.2 role matrix test. Shares mutable state with the test
 * via the exported `state` object.
 */
export const state = { role: 'OWNER', hasMembership: true };

export async function requireAuth() {
  return { user: { id: 'user-1' } };
}

export const prisma = {
  membership: {
    findFirst: async ({ where }) => {
      if (!state.hasMembership) return null;
      return { id: 'mem-1', userId: 'user-1', businessId: where.businessId, role: state.role, status: 'ACTIVE' };
    },
  },
};
