import { notFound } from 'next/navigation';
import { MapPin, Phone } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import EveryJobLogo from '@/components/EveryJobLogo';
import BookingForm, { type BookingSlotStrings } from '@/components/BookingForm';
import { formatWorkingHoursSummary } from '@/lib/working-hours';
import { getLocale } from '@/lib/i18n/server';
import { t, type Locale } from '@/lib/i18n';
import { unsafeUnscoped } from '@/lib/tenant-guard';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // Public page entry point: the slug is the public address of the page.
  // A slug can only resolve to the one business that owns it, so no
  // tenant scope can exist before this lookup.
  const page = await unsafeUnscoped('book:metadata:findPage', () =>
    prisma.bookingPage.findUnique({
      where: { slug },
      select: { headline: true, business: { select: { name: true } } },
    })
  );
  if (!page) return { title: 'Book a service | EveryJob' };
  return { title: `Book ${page.business.name} | EveryJob` };
}

/**
 * Public booking page. No authentication.
 * Only ever loads the single BookingPage (and business) matching the slug —
 * nothing else from any business is reachable here.
 */
export default async function PublicBookingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const locale: Locale = await getLocale();

  const page = await unsafeUnscoped('book:page:findPage', () =>
    prisma.bookingPage.findUnique({
      where: { slug },
      select: {
        enabled: true,
        headline: true,
        intro: true,
        businessId: true,
        business: { select: { name: true, phone: true, address: true, currency: true, regionCode: true, workingHours: true } },
      },
    })
  );

  if (!page || !page.enabled) notFound();

  const services = await prisma.service.findMany({
    where: { businessId: page.businessId },
    select: { id: true, name: true, price: true },
    orderBy: { name: 'asc' },
  });

  const { business } = page;

  const slotStrings: BookingSlotStrings = {
    preferredTime: t(locale, 'reminders.booking.preferredTime'),
    loadingSlots: t(locale, 'reminders.booking.loadingSlots'),
    slotsError: t(locale, 'reminders.booking.slotsError'),
    dayClosed: t(locale, 'reminders.booking.dayClosed'),
    hoursNotSetNote: t(locale, 'reminders.booking.hoursNotSetNote'),
    someUnscheduledNote: t(locale, 'reminders.booking.someUnscheduledNote'),
    noSlotsLeft: t(locale, 'reminders.booking.noSlotsLeft'),
  };

  return (
    <div className="min-h-screen bg-paper font-sans">
      <header className="bg-ink text-white">
        <div className="max-w-lg mx-auto px-4 py-8 text-center">
          <div className="mx-auto mb-3 w-fit">
            <EveryJobLogo size={44} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{business.name}</h1>
          {page.headline && (
            <p className="text-white/70 mt-1 text-sm">{page.headline}</p>
          )}
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-5">
        {page.intro && (
          <p className="text-sm text-zinc-600 bg-white rounded-[20px] border border-zinc-200/70 shadow-[0_1px_3px_rgba(22,22,22,0.06)] p-5">
            {page.intro}
          </p>
        )}

        <BookingForm
          slug={slug}
          services={services}
          businessPhone={business.phone}
          currency={business.currency}
          hoursSummary={formatWorkingHoursSummary(business.workingHours)}
          strings={slotStrings}
          locale={locale}
        />

        {(business.phone || business.address) && (
          <div className="text-center text-xs text-zinc-500 space-y-1 pb-8">
            {business.phone && (
              <p>
                <a
                  href={`tel:${business.phone.replace(/\s/g, '')}`}
                  className="min-h-[44px] inline-flex items-center gap-1.5 font-semibold text-ink"
                >
                  <Phone size={12} /> {business.phone}
                </a>
              </p>
            )}
            {business.address && (
              <p className="flex items-center justify-center gap-1.5">
                <MapPin size={12} /> {business.address}
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
