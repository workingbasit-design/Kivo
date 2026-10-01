/**
 * In-memory stand-in for the modules src/app/actions/dispatch.ts touches.
 * The stubbed prisma.job.update runs the REAL tenant-guard assertion, so a
 * regression (update without businessId in `where`) throws TenantScopeError
 * exactly as it does on production (2026-10-01 /dispatch crash).
 */
import { assertTenantScope } from '../tenant-guard.ts';

export const updateCalls = [];

export const prisma = {
  job: {
    findFirst: async ({ where }) => {
      if (where?.id === 'job_1' && where?.businessId === 'biz_1') {
        return { id: 'job_1', status: 'SCHEDULED' };
      }
      return null;
    },
    update: async (args) => {
      assertTenantScope({ model: 'Job', action: 'update', args });
      updateCalls.push(args);
      return { id: args.where.id };
    },
  },
  user: {
    findFirst: async ({ where }) => {
      if (where?.id === 'user_1' && where?.businessId === 'biz_1') {
        return { id: 'user_1', name: 'QA Agent' };
      }
      return null;
    },
  },
};

export function resetDispatchStub() {
  updateCalls.length = 0;
}

export async function requireAuth() {
  return { businessId: 'biz_1', user: { id: 'user_1', name: 'QA Agent' } };
}

export function revalidatePath() {}
