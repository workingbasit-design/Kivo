import { Prisma } from '@prisma/client';

/**
 * Thrown when a session cookie exists but the database cannot be reached
 * to validate it. This is deliberately NOT "no session" (null): a DB
 * outage must never look like a logout. Callers that render pages catch
 * this and show a "try again" notice instead of bouncing the user to
 * /login (2026-09-26: the old null return caused a /login <-> /dashboard
 * redirect loop and phantom logouts whenever the connection pool was
 * exhausted).
 */
export class DatabaseUnavailableError extends Error {
  constructor(message = 'database unavailable during session lookup') {
    super(message);
    this.name = 'DatabaseUnavailableError';
  }
}

/**
 * True when an error means "the database could not be reached" as opposed
 * to a real application failure. Used by layouts to render an honest
 * "try again" notice instead of a login redirect or a generic 500, and by
 * the retry wrapper to decide which failures are safe to retry (all of
 * these happen before the query executes, so a retried write cannot
 * double-apply).
 *
 * Covers:
 * - DatabaseUnavailableError (thrown by getSession() on lookup failure)
 * - PrismaClientInitializationError (e.g. pool exhaustion at connect time)
 * - P2037 (Prisma's "too many database connections" on some drivers)
 * - P2024 (timed out fetching a connection from the pool: never acquired,
 *   never executed)
 */
export function isDatabaseUnavailable(err: unknown): boolean {
  if (err instanceof DatabaseUnavailableError) return true;
  if (err instanceof Prisma.PrismaClientInitializationError) return true;
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const code = (err as { code?: string }).code;
    if (code === 'P2037' || code === 'P2024') return true;
  }
  return false;
}
