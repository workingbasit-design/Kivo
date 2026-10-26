/**
 * In-memory stand-in for the modules src/app/actions/expenses.ts touches.
 * The stubbed prisma.jobExpense.updateMany/deleteMany run the REAL
 * tenant-guard assertion, so a regression (write without businessId in
 * `where`) throws TenantScopeError exactly as it does on production
 * (2026-10-26 deep test: expense delete returned deleteFailed because
 * delete used `where: { id }`; same class as the 2026-10-01 /dispatch crash).
 */
import { assertTenantScope } from '../tenant-guard.ts';

export const updateCalls = [];
export const deleteCalls = [];

export const prisma = {
  jobExpense: {
    findFirst: async ({ where }) => {
      if (where?.id === 'exp_1' && where?.businessId === 'biz_1') {
        return { id: 'exp_1', receiptUrl: null, jobId: null };
      }
      return null;
    },
    updateMany: async (args) => {
      assertTenantScope({ model: 'JobExpense', action: 'updateMany', args });
      updateCalls.push(args);
      return { count: 1 };
    },
    deleteMany: async (args) => {
      assertTenantScope({ model: 'JobExpense', action: 'deleteMany', args });
      deleteCalls.push(args);
      return { count: 1 };
    },
  },
};

export function resetExpenseStub() {
  updateCalls.length = 0;
  deleteCalls.length = 0;
}

export async function requireAuth() {
  return { businessId: 'biz_1', user: { id: 'user_1', name: 'QA Agent' } };
}

export function revalidatePath() {}
