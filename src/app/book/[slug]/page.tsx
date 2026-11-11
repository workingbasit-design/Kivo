import { notFound } from 'next/navigation';
import { MapPin, Phone } from '@/components/icons';
import { prisma } from '@/lib/prisma';
import EveryJobLogo from '@/components/EveryJobLogo';
import BookingForm, { type BookingSlotStrings } from '@/components/BookingForm';
import { formatWorkingHoursSummary } from '@/lib/working-hours';
import { getLocale } from '@/lib/i18n/server';
import { t, type Locale } from '@/lib/i18n';
import { unsafeUnscoped } from '@/lib/tenant-guard';
import { centsToDollars } from '@/lib/money';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // Public page entry point: the slug is the public address of the page.
  // A slug can only resolve to the one business that owns it, so no
  // tenant scope can exist before this lookup.
  const page = await unsafeUnscoped('book:metadata:findPage', (db) =>
    db.bookingPage.findUnique({
      where: { slug },
      select: { headline: true, business: { select: { name: true } } },
    })
  );
  if (!page) return { title: 'Book a service | EveryJob' };
  return { title: `Book ${page.business.name} | EveryJob` };
}

/**
 * Public booking page. No authentication.
 * Only ever loads the single BookingPage (and business) matching the slug -
 * nothing else from any business is reachable here.
 */
export default async function PublicBookingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const locale: Locale = await getLocale();

  const page = await unsafeUnscoped('book:page:findPage', (db) =>
    db.bookingPage.findUnique({
      where: { slug },
      select: {
        id: true,
        enabled: true,
        headline: true,
        intro: true,
        businessId: true,
        business: { select: { name: true, phone: true, address: true, currency: true, regionCode: true, workingHours: true } },
      },
    })
  );

  if (!page || !page.enabled) notFound();

  // M1: only the services the business has explicitly made bookable.
  // This page used to list every Service row for the business, which meant
  // internal/price-book-only services (callout minimums, parts, subcontract
  // lines) were publicly bookable and any new service appeared on the public
  // page the moment it was created. BookableService is the curated list; it
  // carries the display order and an active flag.
  const bookable = await prisma.bookableService.findMany({
    // businessId is required by the tenant guard and is a real scope here
    // (defence in depth): the slug already pinned us to one business, and a
    // BookableService row can only ever belong to that same business.
    where: { businessId: page.businessId, bookingPageId: page.id, active: true },
    select: {
      position: true,
      service: { select: { id: true, name: true, priceCents: true } },
    },
    orderBy: [{ position: 'asc' }],
  });
  const services = bookable.map((b) => b.service);

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
      <header className="bg-asphalt text-hero-ink">
        <div className="max-w-lg mx-auto px-4 py-8 text-center">
          <div className="mx-auto mb-3 w-fit">
            <EveryJobLogo size={44} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{business.name}</h1>
          {page.headline && (
            <p className="text-hero-ink-2 mt-1 text-sm">{page.headline}</p>
          )}
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-5">
        {page.intro && (
          <p className="text-sm text-ink-2 bg-surface rounded-[20px] border border-line shadow-kit-card p-5">
            {page.intro}
          </p>
        )}

        <BookingForm
          slug={slug}
          services={services.map((s) => ({ id: s.id, name: s.name, price: centsToDollars(s.priceCents) }))}
          businessPhone={business.phone}
          currency={business.currency}
          hoursSummary={formatWorkingHoursSummary(business.workingHours)}
          strings={slotStrings}
          locale={locale}
        />

        {(business.phone || business.address) && (
          <div className="text-center text-xs text-ink-2 space-y-1 pb-8">
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
