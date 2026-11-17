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
 * form - no callback ever awaits a query on the global client while
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
// (or HMR in dev) never creates a second client - and a second pool -
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
  // a transient failure - it throws TenantScopeError immediately and is
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

const globalForUnscoped = globalThis as unknown as {
  prismaUnscoped: PrismaClient | undefined;
};

/**
 * Unguarded Prisma client for legitimately cross-tenant reads.
 *
 * WHY THIS EXISTS (2026-09-28): Prisma's `$use` middleware does NOT preserve
 * Node.js AsyncLocalStorage context - the middleware is invoked from Prisma's
 * internal engine scheduling, outside the caller's async chain. So the
 * `unsafeUnscoped()` ALS exemption never reaches `assertTenantScope`, and
 * every public token lookup (sign/review/booking/tracking) 500s with
 * TenantScopeError. An explicit second client without the guard middleware is
 * the only reliable bypass.
 *
 * SAFETY: has the retry middleware but NO tenant guard. Use ONLY via
 * `unsafeUnscoped('op-name', (db) => ...)` for lookups keyed by unpredictable
 * 256-bit tokens/slugs (signature requests, review requests, booking pages,
 * tracking shares, quote/invoice/portal tokens). NEVER for businessId-scoped
 * data access - the guarded `prisma` client remains the default everywhere.
 *
 * LAZY (P1.0 D1): created on first use only, via getPrismaUnscoped().
 * Previously both clients were created eagerly at module import, so EVERY
 * serverless instance opened 2 connections at cold start even if it never
 * served a token page. Now most instances (dashboard, jobs, invoices...)
 * hold 1 connection; only instances that serve a token/agent page open the
 * second. The client is cached on globalThis like the guarded one, so a
 * module re-evaluation never creates a second pool in the same instance.
 */
export function getPrismaUnscoped(): PrismaClient {
  const cached = globalForUnscoped.prismaUnscoped;
  if (cached) return cached;
  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['query'],
    datasourceUrl: pooledDatabaseUrl(),
  });
  // Retry middleware only (no tenant guard - see SAFETY above). Registered
  // here, at the single creation site, so it can never stack.
  client.$use(async (params, next) => withDbRetry(() => next(params)));
  globalForUnscoped.prismaUnscoped = client;
  return client;
}
