import { requireAuth } from '@/lib/auth';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import { Card } from '@/components/kit';
import LiveTrackingMap from '@/components/LiveTrackingMap';
import { PageTitle } from '../_components/PageTitle';

export const metadata = { title: 'Live tracking | EveryJob' };

/**
 * Dispatcher view (Phase 1, Advanced): the live map of today's active jobs.
 * Per-job location-sharing controls moved to the job detail page
 * (/jobs/[id]) - they only make sense in the context of a single job.
 */
export default async function TrackingPage() {
  await requireAuth();
  const locale = await getLocale();

  return (
    <div className="space-y-6">
      <PageTitle title={t(locale, 'gps.trackingTitle')} summary={t(locale, 'gps.mapDesc')} />
      <Card className="p-5 md:p-6">
        <LiveTrackingMap locale={locale} />
      </Card>
    </div>
  );
}
