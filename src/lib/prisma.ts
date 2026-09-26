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

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['query'],
    datasourceUrl: pooledDatabaseUrl(),
  });

// Cache on globalThis in every environment so a module re-evaluation
// (or HMR in dev) never creates a second client — and a second pool —
// inside the same serverless instance.
globalForPrisma.prisma = prisma;
