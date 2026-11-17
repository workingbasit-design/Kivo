/**
 * In-memory stand-in for the modules src/app/actions/crews.ts and
 * src/app/actions/projects.ts touch. The stubbed updateMany/deleteMany run
 * the REAL tenant-guard assertion, so a regression (write without
 * businessId in `where`) throws TenantScopeError exactly as it does on
 * production (2026-10-29 deep test: crew Save and crew Delete crashed
 * the page with an error boundary; project update/delete/attach/detach
 * shared the same unscoped-write shape).
 */
import { assertTenantScope } from '../tenant-guard.ts';

export const crewUpdateCalls = [];
export const crewDeleteCalls = [];
export const projectUpdateCalls = [];
export const projectDeleteCalls = [];
export const jobUpdateCalls = [];

// In-memory RateLimit table for the durable limiter (P1.0 S4 P3):
// mirrors the auth-stub delegate; updateMany only touches unexpired rows.
const rateLimitRows = new Map();

export const prisma = {
  rateLimit: {
    updateMany: async ({ where, data }) => {
      const row = rateLimitRows.get(where?.key);
      if (row && row.resetAt > where?.resetAt?.gt) {
        row.count += data?.count?.increment ?? 1;
        return { count: 1 };
      }
      return { count: 0 };
    },
    upsert: async ({ where, create, update }) => {
      const row = { key: where.key, count: 1, resetAt: (create ?? update).resetAt };
      rateLimitRows.set(where.key, row);
      return row;
    },
    findUnique: async ({ where }) => {
      const row = rateLimitRows.get(where?.key);
      return row ? { count: row.count, resetAt: row.resetAt } : null;
    },
  },
  crew: {
    findFirst: async ({ where }) => {
      if (where?.id === 'crew_1' && where?.businessId === 'biz_1') return { id: 'crew_1' };
      return null;
    },
    updateMany: async (args) => {
      assertTenantScope({ model: 'Crew', action: 'updateMany', args });
      crewUpdateCalls.push(args);
      return { count: 1 };
    },
    deleteMany: async (args) => {
      assertTenantScope({ model: 'Crew', action: 'deleteMany', args });
      crewDeleteCalls.push(args);
      return { count: 1 };
    },
  },
  project: {
    findFirst: async ({ where }) => {
      if (where?.id === 'proj_1' && where?.businessId === 'biz_1') return { id: 'proj_1' };
      return null;
    },
    updateMany: async (args) => {
      assertTenantScope({ model: 'Project', action: 'updateMany', args });
      projectUpdateCalls.push(args);
      return { count: 1 };
    },
    deleteMany: async (args) => {
      assertTenantScope({ model: 'Project', action: 'deleteMany', args });
      projectDeleteCalls.push(args);
      return { count: 1 };
    },
  },
  job: {
    findFirst: async ({ where }) => {
      if (where?.id === 'job_1' && where?.businessId === 'biz_1') return { id: 'job_1', projectId: 'proj_1' };
      return null;
    },
    updateMany: async (args) => {
      assertTenantScope({ model: 'Job', action: 'updateMany', args });
      jobUpdateCalls.push(args);
      return { count: 1 };
    },
  },
  projectPhase: {
    findFirst: async () => null,
  },
};

export function resetCrewProjectStub() {
  rateLimitRows.clear();
  crewUpdateCalls.length = 0;
  crewDeleteCalls.length = 0;
  projectUpdateCalls.length = 0;
  projectDeleteCalls.length = 0;
  jobUpdateCalls.length = 0;
}

export async function requireAuth() {
  return { businessId: 'biz_1', user: { id: 'user_1', name: 'QA Agent' } };
}

export function revalidatePath() {}

export async function getLocale() {
  return 'en';
}
