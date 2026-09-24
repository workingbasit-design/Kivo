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
 * PrismaClientInitializationError ("too many connections"). A small fixed
 * pool keeps the total bounded: instances x connection_limit.
 * 3 leaves room for one interactive transaction plus concurrent queries.
 */
export function pooledDatabaseUrl(fromEnv = process.env.DATABASE_URL): string | undefined {
  const raw = fromEnv;
  if (!raw) return undefined;
  if (/[?&]connection_limit=/.test(raw)) return raw;
  return `${raw}${raw.includes('?') ? '&' : '?'}connection_limit=3`;
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
