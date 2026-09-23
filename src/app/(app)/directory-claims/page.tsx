import { redirect } from 'next/navigation';
import { ShieldCheck, Inbox } from 'lucide-react';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PageHeader, Card, EmptyState } from '@/components/ui';
import { isDirectoryAdminEmail } from '@/lib/directory';
import ClaimRow from './claim-row';

export const metadata = { title: 'Directory claims | EveryJob' };
export const dynamic = 'force-dynamic';

/**
 * Directory claim verification queue. Every business that requests a public
 * listing waits here until an admin explicitly approves or rejects it —
 * nothing goes live automatically. Super-admin only (KIVO_ADMIN_EMAILS).
 * Not linked in the nav — reach it directly at /directory-claims.
 */
export default async function DirectoryClaimsPage() {
  const session = await getSession();
  if (!session?.user?.businessId) redirect('/login');
  if (!isDirectoryAdminEmail(session.user.email)) {
    return (
      <div className="space-y-6">
        <PageHeader title="Directory claims" subtitle="Listing verification queue." />
        <Card>
          <EmptyState
            icon={<Inbox size={24} />}
            title="Not authorized"
            description="This page is only visible to EveryJob directory admins."
          />
        </Card>
      </div>
    );
  }

  const claims = await prisma.directoryClaim.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      business: {
        select: {
          name: true,
          address: true,
          phone: true,
          bookingPage: { select: { slug: true } },
          services: { select: { name: true }, take: 8 },
        },
      },
    },
  });

  const pendingCount = claims.filter((c) => c.status === 'PENDING').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Directory claims"
        subtitle={
          pendingCount > 0
            ? `${pendingCount} listing${pendingCount === 1 ? '' : 's'} waiting for review`
            : 'No pending verifications — every request has been reviewed.'
        }
      />
      {claims.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ShieldCheck size={24} />}
            title="No claims yet"
            description="When a business requests directory verification, it appears here for review."
          />
        </Card>
      ) : (
        <Card className="divide-y divide-zinc-100 p-0 overflow-hidden">
          {claims.map((c) => (
            <ClaimRow
              key={c.id}
              claim={{
                id: c.id,
                status: c.status,
                note: c.note,
                decidedBy: c.decidedBy,
                decidedAt: c.decidedAt ? c.decidedAt.toISOString() : null,
                createdAt: c.createdAt.toISOString(),
                businessName: c.business.name,
                address: c.business.address,
                phone: c.business.phone,
                slug: c.business.bookingPage?.slug ?? null,
                services: c.business.services.map((s) => s.name),
              }}
            />
          ))}
        </Card>
      )}
    </div>
  );
}
