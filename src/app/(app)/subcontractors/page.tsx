import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import { PageTitle } from '../_components/PageTitle';
import SubcontractorDirectory from '@/components/SubcontractorDirectory';

export const dynamic = 'force-dynamic';

export default async function SubcontractorsPage() {
  const { businessId } = await requireAuth();
  const locale = await getLocale();
  const L = (k: string) => t(locale, `subcontractors.${k}`);

  const subs = await prisma.subcontractor.findMany({
    where: { businessId },
    orderBy: { name: 'asc' },
    include: { _count: { select: { jobs: true } } },
  });

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { currency: true },
  });

  return (
    <div className="space-y-6">
      <PageTitle title={L('title')} summary={L('subtitle')} />
      <SubcontractorDirectory
        locale={locale}
        currency={business?.currency ?? 'CAD'}
        initial={subs.map((s) => ({
          id: s.id,
          name: s.name,
          phone: s.phone,
          email: s.email,
          defaultRateCents: s.defaultRateCents != null ? Number(s.defaultRateCents) : null,
          note: s.note,
          jobCount: s._count.jobs,
        }))}
      />
    </div>
  );
}
