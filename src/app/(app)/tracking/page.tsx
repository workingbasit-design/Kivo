import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import { PageHeader, Card } from '@/components/ui';
import TechLocationSharer, { type SharableJob } from '@/components/TechLocationSharer';
import LiveTrackingMap from '@/components/LiveTrackingMap';

export const metadata = { title: 'Live tracking | EveryJob' };

export default async function TrackingPage() {
  const { businessId } = await requireAuth();
  const locale = await getLocale();

  // Jobs the signed-in tech can share location for: scheduled or in progress.
  const jobs = await prisma.job.findMany({
    where: { businessId, status: { in: ['SCHEDULED', 'IN PROGRESS'] } },
    orderBy: { date: 'asc' },
    take: 50,
    select: {
      id: true,
      title: true,
      address: true,
      customer: { select: { name: true } },
    },
  });

  const sharable: SharableJob[] = jobs.map((j) => ({
    id: j.id,
    title: j.title,
    customerName: j.customer.name,
    address: j.address,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={t(locale, 'gps.trackingTitle')}
        subtitle={t(locale, 'gps.shareCardDesc')}
      />
      <Card className="p-5 md:p-6">
        <h2 className="text-sm font-bold text-zinc-900 mb-1">{t(locale, 'gps.mapTitle')}</h2>
        <LiveTrackingMap locale={locale} />
      </Card>
      <TechLocationSharer jobs={sharable} />
    </div>
  );
}
