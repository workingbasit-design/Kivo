import { Flag } from '@/components/icons';
import { requireAuth } from '@/lib/auth';
import { Card } from '@/components/kit';
import { isDirectoryAdminEmail } from '@/lib/directory';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import ReportRow from './report-row';
import { unsafeUnscoped } from '@/lib/tenant-guard';
import { PageTitle } from '../_components/PageTitle';
import { EmptyState } from '@/components/kit';

export const metadata = { title: 'Directory reports | EveryJob' };

/**
 * Internal trust & safety queue. Super-admin only, gated by the
 * KIVO_ADMIN_EMAILS env var (comma-separated). Not linked in the nav -
 * reach it directly at /directory-reports.
 */
export default async function DirectoryReportsPage() {
  const { user } = await requireAuth();
  const locale = await getLocale();
  const tr = (path: string) => t(locale, path);
  if (!isDirectoryAdminEmail(user.email)) {
    return (
      <div className="space-y-6">
        <PageTitle title={tr('t10misc.reports.title')} summary={tr('t10misc.reports.subtitle')} />
        <Card>
          <EmptyState
            icon={<Flag />}
            title={tr('t10misc.claims.notAuthorizedTitle')}
            text={tr('t10misc.claims.notAuthorizedDesc')}
          />
        </Card>
      </div>
    );
  }

  // Super-admin moderation view (isDirectoryAdminEmail gate above):
  // reports about directory listings span all businesses by design.
  const reports = await unsafeUnscoped('directory:adminListReports', (db) =>
    db.directoryReport.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { business: { select: { name: true } } },
    })
  );

  const openCount = reports.filter((r) => r.status === 'OPEN').length;
  const subtitle =
    openCount > 0
      ? tr('t10misc.reports.openWaiting')
          .replace('{count}', String(openCount))
          .replaceAll('{s}', openCount === 1 ? '' : 's')
      : tr('t10misc.reports.allClear');

  return (
    <div className="space-y-6">
      <PageTitle title={tr('t10misc.reports.title')} summary={subtitle} />
      {reports.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Flag />}
            title={tr('t10misc.reports.noReportsTitle')}
            text={tr('t10misc.reports.noReportsDesc')}
          />
        </Card>
      ) : (
        <Card className="divide-y divide-line p-0 overflow-hidden">
          {reports.map((r) => (
            <ReportRow
              key={r.id}
              report={{
                id: r.id,
                businessName: r.business.name,
                reason: r.reason,
                details: r.details,
                reporterContact: r.reporterContact,
                status: r.status,
                createdAt: r.createdAt.toISOString(),
              }}
            />
          ))}
        </Card>
      )}
    </div>
  );
}
