import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Card } from '@/components/kit';
import { formatWorkingHoursSummary } from '@/lib/working-hours';
import BookingSettingsForm from '@/components/BookingSettingsForm';
import { slugify } from '@/lib/slug';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import { PageTitle } from '../../_components/PageTitle';

export const metadata = { title: 'Online booking | EveryJob' };

export default async function BookingSettingsPage() {
  const { businessId } = await requireAuth();
  const locale = await getLocale();
  const tr = (path: string) => t(locale, path);

  const [page, business, allServices] = await Promise.all([
    prisma.bookingPage.findUnique({
      where: { businessId },
      select: { id: true, enabled: true, slug: true, headline: true, intro: true },
    }),
    prisma.business.findUnique({
      where: { id: businessId },
      select: { name: true, workingHours: true },
    }),
    // M1: the price book, so the owner can pick which services are bookable.
    prisma.service.findMany({
      where: { businessId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  if (!business) throw new Error('Business not found.');

  // Which of them currently have a BookableService row.
  const bookableIds = page
    ? new Set(
        (
          await prisma.bookableService.findMany({
            // Tenant guard: BookableService is a tenant model, so the
            // query must carry a top-level businessId (2026-11-11: the
            // unscoped version crashed /settings/booking on every load).
            where: { businessId, bookingPageId: page.id, active: true },
            select: { serviceId: true },
          })
        ).map((b) => b.serviceId)
      )
    : new Set<string>();

  const hoursSummary = formatWorkingHoursSummary(business.workingHours);

  return (
    <div className="space-y-6">
      <PageTitle
        title={tr('t10misc.booking.pageTitle')}
        summary={tr('t10misc.booking.pageSubtitle')}
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
        services={allServices.map((svc) => ({
          id: svc.id,
          name: svc.name,
          selected: bookableIds.has(svc.id),
        }))}
      />
      <Card className="p-5 md:p-6 max-w-2xl">
        <h2 className="text-sm font-bold text-ink mb-1">{tr('t10misc.booking.hoursTitle')}</h2>
        {hoursSummary ? (
          <p className="text-sm text-ink-2">{hoursSummary}</p>
        ) : (
          <p className="text-sm text-ink-2">
            {tr('t10misc.booking.hoursEmpty')}
          </p>
        )}
        <p className="text-[11px] text-ink-2 mt-2">
          {tr('t10misc.booking.hoursNote')}
        </p>
      </Card>
    </div>
  );
}
