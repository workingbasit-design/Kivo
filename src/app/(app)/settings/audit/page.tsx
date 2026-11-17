import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AUDIT_ACTIONS } from '@/lib/audit';
import { parseListLimit, takeWithProbe, sliceListPage } from '@/lib/list-page';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import { PageTitle } from '../../_components/PageTitle';
import { ListMore } from '../../_components/ListMore';

export const metadata = { title: 'Audit log | EveryJob' };

/** Entity types the audit log can filter on (the F1 log points). */
const ENTITY_TYPES = [
  'Invoice',
  'Payment',
  'CreditNote',
  'Quote',
  'QuoteDeposit',
  'Job',
  'Customer',
  'Membership',
  'Business',
  'User',
  'copilot',
] as const;

/** Compact scalar summary of a stored before/after JSON snapshot. */
function summarize(json: string | null): Array<[string, string]> {
  if (!json) return [];
  try {
    const parsed: unknown = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return [];
    return Object.entries(parsed as Record<string, unknown>)
      .filter(([, v]) => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')
      .slice(0, 4)
      .map(([k, v]) => [k, String(v)]);
  } catch {
    return [];
  }
}

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams?: Promise<{ limit?: string; action?: string; entity?: string }>;
}) {
  const { businessId, role } = await requireAuth();
  const locale = await getLocale();
  const tr = (path: string) => t(locale, path);

  // The audit log names team members: OWNER/ADMIN only, like the team page.
  if (role !== 'ADMIN' && role !== 'OWNER') {
    redirect('/settings');
  }

  const params = await searchParams;
  const limit = parseListLimit(params?.limit);
  const actionFilter = (params?.action ?? '').trim();
  const action = (AUDIT_ACTIONS as readonly string[]).includes(actionFilter)
    ? actionFilter
    : undefined;
  const entityFilter = (params?.entity ?? '').trim();
  const entity = (ENTITY_TYPES as readonly string[]).includes(entityFilter)
    ? entityFilter
    : undefined;

  const where = {
    businessId,
    ...(action ? { action } : {}),
    ...(entity ? { entityType: entity } : {}),
  };

  // F2: bounded read — the log grows by one row per login and money action,
  // so it is never loaded whole; the exact total comes from the database.
  const [fetched, total] = await Promise.all([
    prisma.auditEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: takeWithProbe(limit),
    }),
    prisma.auditEvent.count({ where }),
  ]);
  const page = sliceListPage(fetched, limit);
  const events = page.rows;

  // Actor names in one query: actorId is a User id (or 'system').
  const actorIds = [...new Set(events.map((e) => e.actorId).filter((id) => id !== 'system'))];
  const actors = actorIds.length
    ? await prisma.user.findMany({
        where: { id: { in: actorIds } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const actorName = new Map(actors.map((u) => [u.id, u.name ?? u.email ?? tr('auditLog.unknownActor')]));

  const tag = locale === 'fr' ? 'fr-CA' : 'en-CA';
  const fmt = (d: Date) =>
    d.toLocaleString(tag, { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <div className="space-y-6">
      <PageTitle
        title={tr('auditLog.pageTitle')}
        summary={tr('auditLog.pageSubtitle')}
      />

      <form method="get" className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">
          {tr('auditLog.filterAction')}
          <select
            name="action"
            defaultValue={action ?? ''}
            className="min-h-[44px] rounded-xl border border-line bg-surface px-3 text-sm text-ink"
          >
            <option value="">{tr('auditLog.filterAll')}</option>
            {AUDIT_ACTIONS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">
          {tr('auditLog.filterEntity')}
          <select
            name="entity"
            defaultValue={entity ?? ''}
            className="min-h-[44px] rounded-xl border border-line bg-surface px-3 text-sm text-ink"
          >
            <option value="">{tr('auditLog.filterAll')}</option>
            {ENTITY_TYPES.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="min-h-[44px] inline-flex items-center rounded-xl bg-hivis px-5 text-sm font-semibold text-ink hover:opacity-90"
        >
          {tr('auditLog.filterApply')}
        </button>
      </form>

      {events.length === 0 ? (
        <p className="text-sm text-ink-2">{tr('auditLog.empty')}</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-ink-2">
                <th className="px-4 py-3 font-semibold">{tr('auditLog.colTime')}</th>
                <th className="px-4 py-3 font-semibold">{tr('auditLog.colActor')}</th>
                <th className="px-4 py-3 font-semibold">{tr('auditLog.colAction')}</th>
                <th className="px-4 py-3 font-semibold">{tr('auditLog.colEntity')}</th>
                <th className="px-4 py-3 font-semibold">{tr('auditLog.colDetails')}</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => {
                const before = summarize(e.beforeJson);
                const after = summarize(e.afterJson);
                return (
                  <tr key={e.id} className="border-b border-line align-top last:border-0">
                    <td className="px-4 py-3 whitespace-nowrap text-ink-2">{fmt(e.createdAt)}</td>
                    <td className="px-4 py-3 text-ink">
                      {e.actorId === 'system'
                        ? tr('auditLog.systemActor')
                        : (actorName.get(e.actorId) ?? tr('auditLog.unknownActor'))}
                    </td>
                    <td className="px-4 py-3 font-medium text-ink">{e.action}</td>
                    <td className="px-4 py-3 text-ink">
                      {e.entityType}
                      {e.entityId ? (
                        <span className="block text-xs text-ink-2">{e.entityId}</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-ink-2">
                      {after.length > 0 && (
                        <span className="block">
                          {tr('auditLog.afterLabel')}:{' '}
                          {after.map(([k, v]) => `${k}: ${v}`).join(', ')}
                        </span>
                      )}
                      {before.length > 0 && (
                        <span className="block">
                          {tr('auditLog.beforeLabel')}:{' '}
                          {before.map(([k, v]) => `${k}: ${v}`).join(', ')}
                        </span>
                      )}
                      {after.length === 0 && before.length === 0 && '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ListMore
        shown={events.length}
        total={total}
        nextLimit={page.nextLimit}
        locale={locale}
        basePath="/settings/audit"
        params={{ action, entity }}
      />
    </div>
  );
}
