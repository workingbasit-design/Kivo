import { redirect } from 'next/navigation';
import { Flag } from 'lucide-react';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PageHeader, Card, EmptyState } from '@/components/ui';
import { isDirectoryAdminEmail } from '@/lib/directory';
import ReportRow from './report-row';

export const metadata = { title: 'Directory reports | EveryJob' };

const REASON_LABELS: Record<string, string> = {
  spam: 'Spam / scam',
  'fake-listing': 'Fake listing',
  'wrong-info': 'Wrong contact info or prices',
  'rude-behaviour': 'Rude behaviour',
  other: 'Something else',
};

/**
 * Internal trust & safety queue. Super-admin only, gated by the
 * KIVO_ADMIN_EMAILS env var (comma-separated). Not linked in the nav —
 * reach it directly at /directory-reports.
 */
export default async function DirectoryReportsPage() {
  const session = await getSession();
  if (!session?.user?.businessId) redirect('/login');
  if (!isDirectoryAdminEmail(session.user.email)) {
    return (
      <div className="space-y-6">
        <PageHeader title="Directory reports" subtitle="Trust & safety queue." />
        <Card>
          <EmptyState
            icon={<Flag size={24} />}
            title="Not authorized"
            description="This page is only visible to EveryJob directory admins."
          />
        </Card>
      </div>
    );
  }

  const reports = await prisma.directoryReport.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: { business: { select: { name: true } } },
  });

  const openCount = reports.filter((r) => r.status === 'OPEN').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Directory reports"
        subtitle={
          openCount > 0
            ? `${openCount} open report${openCount === 1 ? '' : 's'} to review`
            : 'Trust & safety queue — all clear.'
        }
      />
      {reports.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Flag size={24} />}
            title="No reports"
            description="Nobody has reported a directory business yet."
          />
        </Card>
      ) : (
        <Card className="divide-y divide-zinc-100">
          {reports.map((r) => (
            <ReportRow
              key={r.id}
              report={{
                id: r.id,
                businessName: r.business.name,
                reason: REASON_LABELS[r.reason] ?? r.reason,
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
