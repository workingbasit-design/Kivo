import { redirect } from 'next/navigation';
import { ShieldCheck, Inbox } from 'lucide-react';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PageHeader, Card, EmptyState } from '@/components/ui';
import { isDirectoryAdminEmail } from '@/lib/directory';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import ClaimRow from './claim-row';
import { unsafeUnscoped } from '@/lib/tenant-guard';

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
  const locale = await getLocale();
  const tr = (path: string) => t(locale, path);
  if (!isDirectoryAdminEmail(session.user.email)) {
    return (
      <div className="space-y-6">
        <PageHeader title={tr('t10misc.claims.title')} subtitle={tr('t10misc.claims.subtitle')} />
        <Card>
          <EmptyState
            icon={<Inbox size={24} />}
            title={tr('t10misc.claims.notAuthorizedTitle')}
            description={tr('t10misc.claims.notAuthorizedDesc')}
          />
        </Card>
      </div>
    );
  }

  // Super-admin moderation view (isDirectoryAdminEmail gate above):
  // listing claims span all businesses by design.
  const claims = await unsafeUnscoped('directory:adminListClaims', () =>
    prisma.directoryClaim.findMany({
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
    })
  );

  const pendingCount = claims.filter((c) => c.status === 'PENDING').length;
  const subtitle =
    pendingCount > 0
      ? tr('t10misc.claims.pendingWaiting')
          .replace('{count}', String(pendingCount))
          .replaceAll('{s}', pendingCount === 1 ? '' : 's')
      : tr('t10misc.claims.noPending');

  return (
    <div className="space-y-6">
      <PageHeader title={tr('t10misc.claims.title')} subtitle={subtitle} />
      {claims.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ShieldCheck size={24} />}
            title={tr('t10misc.claims.noClaimsTitle')}
            description={tr('t10misc.claims.noClaimsDesc')}
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
