import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Cap the per-instance connection pool for serverless.
 *
 * On Vercel each function instance evaluates this module once, but many
 * instances can run concurrently and each PrismaClient otherwise opens
 * (CPUs * 2 + 1) connections by default. Bursts of traffic exhausted the
 * Postgres role's connection limit and took every dynamic route down with
 * PrismaClientInitializationError ("too many connections for role").
 * A single connection per instance keeps the total bounded by the number
 * of concurrent instances, which is what serverless demands.
 *
 * Deadlock safety: every interactive transaction in this codebase uses
 * either the callback form with `tx` exclusively inside, or the array
 * form — no callback ever awaits a query on the global client while
 * holding the transaction's connection, so a pool of 1 cannot deadlock.
 */
export function pooledDatabaseUrl(fromEnv = process.env.DATABASE_URL): string | undefined {
  const raw = fromEnv;
  if (!raw) return undefined;
  if (/[?&]connection_limit=/.test(raw)) return raw;
  return `${raw}${raw.includes('?') ? '&' : '?'}connection_limit=1`;
}

import { withDbRetry } from './db-retry.ts';
import { assertTenantScope } from './tenant-guard.ts';

const cached = globalForPrisma.prisma;
export const prisma =
  cached ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['query'],
    datasourceUrl: pooledDatabaseUrl(),
  });

// Cache on globalThis in every environment so a module re-evaluation
// (or HMR in dev) never creates a second client — and a second pool —
// inside the same serverless instance.
globalForPrisma.prisma = prisma;

if (!cached) {
  /**
   * Survive transient database outages. The Postgres role the app connects
   * with has a small connection cap; during bursts (deploy cold starts,
   * rapid phone taps) Vercel's concurrent instances can momentarily exhaust
   * it. Every model query is retried with backoff on connection-level
   * failures instead of immediately 500ing. Only pre-execution failures are
   * retried, so writes cannot double-apply.
   *
   * Registered only for a freshly created client: the globalThis cache
   * above guarantees one registration per serverless instance, never
   * stacked retries on re-evaluation.
   */
  // Tenant-isolation guard (registered FIRST / outermost): a missing
  // where.businessId on a business-owned model is a programming error, not
  // a transient failure — it throws TenantScopeError immediately and is
  // never retried. Registered only for a freshly created client, like the
  // retry middleware below, so it never stacks on re-evaluation.
  // (Inline rather than via tenantGuardMiddleware() so Prisma's own
  // MiddlewareParams typing flows through untouched; the pure decision
  // function assertTenantScope is what the tests exercise directly.)
  prisma.$use(async (params, next) => {
    assertTenantScope(params);
    return next(params);
  });
  prisma.$use(async (params, next) => withDbRetry(() => next(params)));
}
