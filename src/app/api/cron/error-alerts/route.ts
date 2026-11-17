import { NextResponse } from 'next/server';
import { requireCronAuth } from '@/lib/cron-auth';
import { prisma } from '@/lib/prisma';
import { evaluateThresholds } from '@/lib/error-log';
import { unsafeUnscoped } from '@/lib/tenant-guard';

/**
 * B9.2 alert cron: evaluates error/login-failure/webhook/export thresholds
 * and notifies owners (in-app Notification). Each alert fires ONCE per
 * incident (MonitorAlert dedup) - not once per error.
 * Same CRON_SECRET convention as the other cron routes (Bearer header only). Scheduled in
 * Same CRON_SECRET convention as the other cron routes. Scheduled in
 * vercel.json as a 10-minute GET to /api/cron/error-alerts.
 */
export const maxDuration = 60;

export async function GET(req: Request) {
  const unauth = requireCronAuth(req);
  if (unauth) return unauth;

  const now = new Date();
  const tenMinAgo = new Date(now.getTime() - 10 * 60 * 1000);
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // 2026-11-06 deep test (architect audit): these platform-wide alert
  // reads are unscoped by design (same as the export-volume block below)
  // — ErrorLog is append-only telemetry, and the guard would throw
  // TenantScopeError on a businessId-less count/findMany, failing the
  // whole cron. Before this fix the write side was dead too (see
  // error-log.ts), so brute-force alerting was blind end to end.
  const { errorsLast10Min, loginRows } = await unsafeUnscoped(
    'error-alerts:error-log-reads',
    async (db) => ({
      errorsLast10Min: await db.errorLog.count({
        where: { kind: 'error', lastSeen: { gte: tenMinAgo } },
      }),
      // Login failures grouped by IP fingerprint (message holds the IP).
      loginRows: await db.errorLog.findMany({
        where: { kind: 'login_failure', lastSeen: { gte: tenMinAgo } },
        select: { message: true, count: true },
      }),
    })
  );
  const loginFailuresByIp = loginRows.map((r) => ({
    ip: r.message.replace('Failed logins from ', ''),
    count: r.count,
  }));

  // Webhook endpoints with >= 3 consecutive failures (recent failed deliveries).
  const failedDeliveries = await prisma.webhookDelivery.findMany({
    where: { status: 'failed', createdAt: { gte: dayAgo } },
    select: { endpointId: true, endpoint: { select: { businessId: true } } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  const byEndpoint = new Map<string, { businessId: string; n: number }>();
  for (const d of failedDeliveries) {
    const e = byEndpoint.get(d.endpointId) ?? { businessId: d.endpoint.businessId, n: 0 };
    e.n++;
    byEndpoint.set(d.endpointId, e);
  }
  const webhookEndpointFailures = [...byEndpoint.entries()].map(([endpointId, v]) => ({
    endpointId,
    businessId: v.businessId,
    consecutiveFailures: v.n,
  }));

  // Export volume per business in 24h (from the audit log). The audit log
  // is append-only and business-scoped by construction; grouping by
  // businessId for a platform alert is a legitimate unscoped read.
  type ExportCount = { businessId: string; _count: { businessId: number } };
  const exports: ExportCount[] = await unsafeUnscoped('error-alerts:export-volume', async (db) => {
    const rows = await db.auditEvent.groupBy({
      by: ['businessId'],
      where: { action: 'EXPORT', createdAt: { gte: dayAgo } },
      _count: { businessId: true },
    });
    return rows as ExportCount[];
  });
  const exportCountsByBusiness = exports.map((e: { businessId: string; _count: { businessId: number } }) => ({
    businessId: e.businessId,
    count: e._count.businessId,
  }));

  const alerts = evaluateThresholds({
    errorsLast10Min,
    loginFailuresByIp,
    webhookEndpointFailures,
    exportCountsByBusiness,
  });

  let fired = 0;
  for (const alert of alerts) {
    // P1.0 (S-A2): the guard requires a non-empty where.businessId, so the
    // businessId-less findFirst/findMany below threw TenantScopeError the
    // moment ANY alert fired — the cron 500d exactly when alerting matters.
    // Business alerts scope by their businessId on the guarded client.
    // Global alerts (error-spike, login-failures) have no businessId to
    // scope by, so they use the same CRON_SECRET-gated unscoped fan-out
    // as the reads above; the queries return ids only, and every
    // notification is created per-business on the guarded client.
    const open = alert.businessId
      ? await prisma.monitorAlert.findFirst({
          where: { key: alert.key, resolvedAt: null, businessId: alert.businessId },
          select: { id: true },
        })
      : await unsafeUnscoped('error-alerts:global-alert-dedup', (db) =>
          db.monitorAlert.findFirst({
            where: { key: alert.key, resolvedAt: null },
            select: { id: true },
          })
        );
    if (open) continue; // already fired and unresolved - don't spam
    await prisma.monitorAlert.create({
      data: { key: alert.key, businessId: alert.businessId, detail: alert.detail },
    });
    // Notify the owner(s): global alerts go to every business owner, scoped
    // alerts to that business's owners.
    const ownerMemberships = alert.businessId
      ? await prisma.membership.findMany({
          where: { role: 'OWNER', status: 'ACTIVE', businessId: alert.businessId },
          select: { businessId: true },
        })
      : await unsafeUnscoped('error-alerts:global-alert-owners', (db) =>
          db.membership.findMany({
            where: { role: 'OWNER', status: 'ACTIVE' },
            select: { businessId: true },
          })
        );
    const businessIds = [...new Set(ownerMemberships.map((m) => m.businessId))];
    for (const businessId of businessIds) {
      await prisma.notification
        .create({
          data: {
            businessId,
            type: 'security_alert',
            dedupeKey: `security_alert:${alert.key}:${now.toISOString().slice(0, 13)}`,
            href: '/settings/security',
            data: JSON.stringify({ detail: alert.detail }),
          },
        })
        .catch(() => undefined);
    }
    fired++;
  }

  return NextResponse.json({ ok: true, evaluated: alerts.length, fired });
}
