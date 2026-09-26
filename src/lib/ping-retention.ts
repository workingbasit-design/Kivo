/**
 * Server-only: 24-hour retention purge for technician location pings
 * (PIPEDA data minimization — raw GPS pings are deleted 24h after recording).
 *
 * This lives in its own module (not geofence.ts) because geofence.ts is
 * imported by client components via lib/eta.ts and must stay free of
 * server-only imports: tenant-guard pulls in node:async_hooks, which
 * Turbopack cannot place in a browser chunk (build panic). Only the
 * nightly workflows cron calls this.
 */
import { prisma } from '@/lib/prisma';
import { unsafeUnscoped } from '@/lib/tenant-guard';

/** Pings older than this are pruned by the nightly cron. */
export const PING_RETENTION_HOURS = 24;

/**
 * Delete TechnicianLocation pings older than `maxAgeHours` (default 24h).
 * Called from the nightly cron. Returns the number of rows removed.
 */
export async function pruneStaleLocationPings(
  maxAgeHours: number = PING_RETENTION_HOURS
): Promise<number> {
  const cutoff = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
  // Intentionally cross-tenant: PIPEDA data-minimization purge. Deletes
  // only rows older than the retention cutoff and returns a count — no
  // row contents ever leave the database.
  const res = await unsafeUnscoped('geofence:pruneStaleLocationPings', () =>
    prisma.technicianLocation.deleteMany({
      where: { recordedAt: { lt: cutoff } },
    })
  );
  return res.count;
}
