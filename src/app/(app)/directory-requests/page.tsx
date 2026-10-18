import { Inbox } from '@/components/icons';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Card } from '@/components/kit';
import { isDirectoryAdminEmail } from '@/lib/directory';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import DemandRow from './demand-row';
import { PageTitle } from '../_components/PageTitle';
import { EmptyState } from '@/components/kit';

export const metadata = { title: 'Directory demand | EveryJob' };

/**
 * Unmatched directory demand queue. Every public quote request that matched
 * no providers is saved here as an OPEN lead draft - admins see real demand
 * by city/service instead of silently dropped requests. Super-admin only,
 * gated by the KIVO_ADMIN_EMAILS env var. Not linked in the nav - reach it
 * directly at /directory-requests.
 */
export default async function DirectoryRequestsPage() {
  const { user } = await requireAuth();
  const locale = await getLocale();
  const tr = (path: string) => t(locale, path);
  if (!isDirectoryAdminEmail(user.email)) {
    return (
      <div className="space-y-6">
        <PageTitle title={tr('t10misc.demand.title')} summary={tr('t10misc.demand.subtitle')} />
        <Card>
          <EmptyState
            icon={<Inbox />}
            title={tr('t10misc.claims.notAuthorizedTitle')}
            text={tr('t10misc.claims.notAuthorizedDesc')}
          />
        </Card>
      </div>
    );
  }

  const requests = await prisma.directoryRequest.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  const openCount = requests.filter((r) => r.status === 'OPEN').length;
  const subtitle =
    openCount > 0
      ? tr('t10misc.demand.openWaiting')
          .replace('{count}', String(openCount))
          .replaceAll('{s}', openCount === 1 ? '' : 's')
      : tr('t10misc.demand.noPending');

  return (
    <div className="space-y-6">
      <PageTitle title={tr('t10misc.demand.title')} summary={subtitle} />
      {requests.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Inbox />}
            title={tr('t10misc.demand.noRequestsTitle')}
            text={tr('t10misc.demand.noRequestsDesc')}
          />
        </Card>
      ) : (
        <Card className="divide-y divide-line p-0 overflow-hidden">
          {requests.map((r) => (
            <DemandRow
              key={r.id}
              request={{
                id: r.id,
                serviceNeed: r.serviceNeed,
                city: r.city,
                area: r.area,
                name: r.name,
                phone: r.phone,
                details: r.details,
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
