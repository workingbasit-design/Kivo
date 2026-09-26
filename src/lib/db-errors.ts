import { Prisma } from '@prisma/client';
import { DatabaseUnavailableError } from './auth';

/**
 * True when an error means "the database could not be reached" as opposed
 * to a real application failure. Used by layouts to render an honest
 * "try again" notice instead of a login redirect or a generic 500.
 *
 * Covers:
 * - DatabaseUnavailableError (thrown by getSession() on lookup failure)
 * - PrismaClientInitializationError (e.g. pool exhaustion at connect time)
 * - P2037 (Prisma's "too many database connections" on some drivers)
 */
export function isDatabaseUnavailable(err: unknown): boolean {
  if (err instanceof DatabaseUnavailableError) return true;
  if (err instanceof Prisma.PrismaClientInitializationError) return true;
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    (err as { code?: string }).code === 'P2037'
  ) {
    return true;
  }
  return false;
}
