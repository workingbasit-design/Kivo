/**
 * PII access audit logging (PIPEDA accountability).
 *
 * Records when authenticated users access customer PII — views, searches,
 * and exports. The log itself is tenant-scoped (businessId) and contains
 * no PII, only metadata about the access.
 *
 * Call `logPiiAccess` from server actions/routes that return customer PII:
 * - Customer list/detail views
 * - Customer exports (CSV/Excel)
 * - Customer search
 *
 * Retention: logs are kept for 2 years (PIPEDA accountability), then
 * purged by the retention cron.
 */
import { prisma } from '@/lib/prisma';

export type PiiAction = 'view' | 'export' | 'search';
export type PiiEntityType = 'customer' | 'job' | 'invoice' | 'quote' | 'lead';

interface LogPiiAccessParams {
  businessId: string;
  userId: string;
  action: PiiAction;
  entityType: PiiEntityType;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

export async function logPiiAccess(params: LogPiiAccessParams): Promise<void> {
  try {
    await prisma.piaAuditLog.create({
      data: {
        businessId: params.businessId,
        userId: params.userId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        metadata: params.metadata ? JSON.stringify(params.metadata) : undefined,
      },
    });
  } catch {
    // Audit logging must never break the user's action. Log to console
    // in development; in production this is a silent degradation that
    // should be monitored via error tracking.
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[pii-audit] Failed to write audit log');
    }
  }
}

/**
 * Query audit logs for a business (for the owner's own accountability
 * review, or PIPEDA access requests).
 */
export async function getPiiAuditLogs(
  businessId: string,
  opts: { limit?: number; userId?: string } = {}
) {
  return prisma.piaAuditLog.findMany({
    where: {
      businessId,
      ...(opts.userId ? { userId: opts.userId } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: opts.limit ?? 100,
    select: {
      id: true,
      userId: true,
      action: true,
      entityType: true,
      entityId: true,
      metadata: true,
      createdAt: true,
    },
  });
}
