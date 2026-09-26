/**
 * Directory lead expiry.
 *
 * Public directory quote requests become Lead drafts. If the business
 * doesn't contact them within 30 days, they expire automatically:
 * - Status → "EXPIRED" (not deleted, so the business keeps a record)
 * - PII (phone, email) is cleared on expiry (PIPEDA data minimization)
 *
 * Called from the daily cron. Also sets expiresAt on new directory leads.
 */
import { prisma } from '@/lib/prisma';
import { unsafeUnscoped } from '@/lib/tenant-guard';

export const LEAD_EXPIRY_DAYS = 30;

/**
 * Set the expiry date on a newly created directory lead.
 */
export function leadExpiryDate(from: Date = new Date()): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + LEAD_EXPIRY_DAYS);
  return d;
}

/**
 * Expire old uncontacted leads. Runs daily via cron.
 * Returns the number of leads expired.
 */
export async function expireOldLeads(): Promise<number> {
  const now = new Date();

  // Find leads past expiry that are still NEW (never contacted).
  // CONTACTED/CONVERTED leads are the business's active pipeline — never auto-expire.
  const expired = await unsafeUnscoped('leads:expireOldLeads', () =>
    prisma.lead.updateMany({
      where: {
        status: 'NEW',
        expiresAt: { lt: now },
      },
      data: {
        status: 'EXPIRED',
        // Clear PII on expiry (PIPEDA minimization). Keep name for records.
        phone: null,
        phoneNorm: null,
        email: null,
      },
    })
  );

  return expired.count;
}
