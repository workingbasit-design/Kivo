import { redirect } from 'next/navigation';
import { Inbox } from 'lucide-react';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PageHeader, Card, EmptyState } from '@/components/ui';
import { isDirectoryAdminEmail } from '@/lib/directory';
import DemandRow from './demand-row';

export const metadata = { title: 'Directory demand | Kivo' };

/**
 * Unmatched directory demand queue. Every public quote request that matched
 * no providers is saved here as an OPEN lead draft — admins see real demand
 * by city/service instead of silently dropped requests. Super-admin only,
 * gated by the KIVO_ADMIN_EMAILS env var. Not linked in the nav — reach it
 * directly at /directory-requests.
 */
export default async function DirectoryRequestsPage() {
  const session = await getSession();
  if (!session?.user?.businessId) redirect('/login');
  if (!isDirectoryAdminEmail(session.user.email)) {
    return (
      <div className="space-y-6">
        <PageHeader title="Directory demand" subtitle="Unmatched quote requests." />
        <Card>
          <EmptyState
            icon={<Inbox size={24} />}
            title="Not authorized"
            description="This page is only visible to Kivo directory admins."
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Directory demand"
        subtitle={
          openCount > 0
            ? `${openCount} open request${openCount === 1 ? '' : 's'} with no matching pro yet`
            : 'No unmatched demand — every request found a pro.'
        }
      />
      {requests.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Inbox size={24} />}
            title="No requests yet"
            description="Unmatched public quote requests will appear here as open lead drafts."
          />
        </Card>
      ) : (
        <Card className="divide-y divide-zinc-100">
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
