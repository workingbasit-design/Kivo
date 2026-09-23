import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PageHeader, Card } from '@/components/ui';
import { formatWorkingHoursSummary } from '@/lib/working-hours';
import BookingSettingsForm from '@/components/BookingSettingsForm';
import { slugify } from '@/lib/slug';

export const metadata = { title: 'Online booking | EveryJob' };

export default async function BookingSettingsPage() {
  const { businessId } = await requireAuth();

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
        title="Online booking"
        subtitle="Let customers book you from a simple public link — no app or login needed."
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
        <h2 className="text-sm font-bold text-zinc-900 mb-1">Working hours</h2>
        {hoursSummary ? (
          <p className="text-sm text-zinc-600">{hoursSummary}</p>
        ) : (
          <p className="text-sm text-zinc-500">
            Not set yet — add them in Settings so customers see when you&apos;re available.
          </p>
        )}
        <p className="text-[11px] text-zinc-400 mt-2">
          Set in Settings → Working hours. They&apos;re also shown on your public booking page.
        </p>
      </Card>
    </div>
  );
}
