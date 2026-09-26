import { redirect } from 'next/navigation';
import { Flag } from 'lucide-react';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PageHeader, Card, EmptyState } from '@/components/ui';
import { isDirectoryAdminEmail } from '@/lib/directory';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import ReportRow from './report-row';
import { unsafeUnscoped } from '@/lib/tenant-guard';

export const metadata = { title: 'Directory reports | EveryJob' };

/**
 * Internal trust & safety queue. Super-admin only, gated by the
 * KIVO_ADMIN_EMAILS env var (comma-separated). Not linked in the nav —
 * reach it directly at /directory-reports.
 */
export default async function DirectoryReportsPage() {
  const session = await getSession();
  if (!session?.user?.businessId) redirect('/login');
  const locale = await getLocale();
  const tr = (path: string) => t(locale, path);
  if (!isDirectoryAdminEmail(session.user.email)) {
    return (
      <div className="space-y-6">
        <PageHeader title={tr('t10misc.reports.title')} subtitle={tr('t10misc.reports.subtitle')} />
        <Card>
          <EmptyState
            icon={<Flag size={24} />}
            title={tr('t10misc.claims.notAuthorizedTitle')}
            description={tr('t10misc.claims.notAuthorizedDesc')}
          />
        </Card>
      </div>
    );
  }

  // Super-admin moderation view (isDirectoryAdminEmail gate above):
  // reports about directory listings span all businesses by design.
  const reports = await unsafeUnscoped('directory:adminListReports', () =>
    prisma.directoryReport.findMany({
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
      <PageHeader title={tr('t10misc.reports.title')} subtitle={subtitle} />
      {reports.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Flag size={24} />}
            title={tr('t10misc.reports.noReportsTitle')}
            description={tr('t10misc.reports.noReportsDesc')}
          />
        </Card>
      ) : (
        <Card className="divide-y divide-zinc-100 p-0 overflow-hidden">
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
