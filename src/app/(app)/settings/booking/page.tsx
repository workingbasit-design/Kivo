import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PageHeader, Card } from '@/components/ui';
import { formatWorkingHoursSummary } from '@/lib/working-hours';
import BookingSettingsForm from '@/components/BookingSettingsForm';
import { slugify } from '@/lib/slug';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';

export const metadata = { title: 'Online booking | EveryJob' };

export default async function BookingSettingsPage() {
  const { businessId } = await requireAuth();
  const locale = await getLocale();
  const tr = (path: string) => t(locale, path);

  const [page, business] = await Promise.all([
    prisma.bookingPage.findUnique({
      where: { businessId },
      select: { enabled: true, slug: true, headline: true, intro: true },
    }),
    prisma.business.findUnique({
      where: { id: businessId },
      select: { name: true, workingHours: true },
    }),
  ]);

  if (!business) throw new Error('Business not found.');

  const hoursSummary = formatWorkingHoursSummary(business.workingHours);

  return (
    <div className="space-y-6">
      <PageHeader
        title={tr('t10misc.booking.pageTitle')}
        subtitle={tr('t10misc.booking.pageSubtitle')}
      />
      <BookingSettingsForm
        initial={
          page
            ? {
                enabled: page.enabled,
                slug: page.slug,
                headline: page.headline ?? '',
                intro: page.intro ?? '',
              }
            : null
        }
        suggestedSlug={slugify(business.name)}
      />
      <Card className="p-5 md:p-6 max-w-2xl">
        <h2 className="text-sm font-bold text-zinc-900 mb-1">{tr('t10misc.booking.hoursTitle')}</h2>
        {hoursSummary ? (
          <p className="text-sm text-zinc-600">{hoursSummary}</p>
        ) : (
          <p className="text-sm text-zinc-500">
            {tr('t10misc.booking.hoursEmpty')}
          </p>
        )}
        <p className="text-[11px] text-zinc-400 mt-2">
          {tr('t10misc.booking.hoursNote')}
        </p>
      </Card>
    </div>
  );
}
