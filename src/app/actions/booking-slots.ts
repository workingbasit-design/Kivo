'use server';

import { headers } from 'next/headers';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rate-limit';
import { validatePhone, INVALID_PHONE_MESSAGE } from '@/lib/phone';
import { parseTimeToMinutes } from '@/lib/routes';
import { dayRange, todayInTimezone } from '@/lib/utils';
import { getLocale } from '@/lib/i18n/server';
import { t, type Locale } from '@/lib/i18n';
import {
  generateDaySlots,
  computeSlotAvailability,
  isSlotStillAvailable,
  formatSlotLabel,
  type SlotWithAvailability,
} from '@/lib/reminders';

/**
 * Public booking availability for a booking page.
 *
 * Cannot edit src/app/actions/booking.ts (owned by another parallel build),
 * so the slot-aware flow lives here: `getBookingSlots` powers the
 * date -> available slots -> confirm UX, and `submitBookingWithTime` is the
 * slot-validating confirm action the updated BookingForm posts to.
 *
 * EveryJob never sends anything — this only checks availability and stores
 * the chosen time on the created job.
 */

export type BookingResult = { error?: string; ok?: boolean };

export interface PublicSlot {
  start: string;
  end: string;
  label: string;
  available: boolean;
}

export interface SlotsResult {
  slots: PublicSlot[];
  /** Business is closed on this weekday. */
  closed: boolean;
  /** Working hours were never configured — fall back to a date-only request. */
  hoursNotSet: boolean;
  /** Existing jobs that day with no parseable time (couldn't block slots). */
  unscheduledCount: number;
  error?: string;
}

/** Public (no-auth) endpoints get a stricter per-IP budget. */
const PUBLIC_LIMIT = { limit: 30, windowMs: 60 * 1000 };

async function publicClientKey(prefix: string): Promise<string> {
  const h = await headers();
  const ip =
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    h.get('x-real-ip') ||
    'unknown';
  return `${prefix}:${ip}`;
}

function checkPublicLimit(key: string): BookingResult | null {
  const rl = rateLimit(key, PUBLIC_LIMIT);
  if (!rl.ok) {
    const secs = Math.max(1, Math.ceil(rl.retryAfterMs / 1000));
    return { error: `Too many requests. Try again in ${secs}s.` };
  }
  return null;
}

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/**
 * Load available time slots for a public booking page on a given date.
 * No auth — only ever reveals slot availability for the single business
 * that owns the slug (no job/customer details leak).
 */
export async function getBookingSlots(
  slug: string,
  dateStr: string
): Promise<SlotsResult> {
  const limit = checkPublicLimit(await publicClientKey('booking-slots'));
  if (limit) return { slots: [], closed: false, hoursNotSet: false, unscheduledCount: 0, error: limit.error };
  const locale: Locale = await getLocale();

  const cleanSlug = (slug ?? '').trim().toLowerCase();
  if (!cleanSlug || !dateSchema.safeParse(dateStr).success) {
    return { slots: [], closed: false, hoursNotSet: false, unscheduledCount: 0, error: t(locale, 'reminders.booking.slotsError') };
  }

  const page = await prisma.bookingPage.findUnique({
    where: { slug: cleanSlug },
    select: {
      businessId: true,
      enabled: true,
      business: { select: { workingHours: true } },
    },
  });
  if (!page || !page.enabled) {
    return { slots: [], closed: false, hoursNotSet: false, unscheduledCount: 0, error: t(locale, 'reminders.booking.slotsError') };
  }

  const gen = generateDaySlots(page.business.workingHours, dateStr);
  if (gen.closed) {
    return { slots: [], closed: true, hoursNotSet: false, unscheduledCount: 0 };
  }
  if (gen.hoursNotSet) {
    return { slots: [], closed: false, hoursNotSet: true, unscheduledCount: 0 };
  }

  // Existing non-cancelled jobs that day block overlapping slots.
  const { gte, lte } = dayRange(dateStr);
  const jobs = await prisma.job.findMany({
    where: {
      businessId: page.businessId,
      date: { gte, lte },
      status: { not: 'CANCELLED' },
    },
    select: { time: true },
  });

  const { slots, unscheduledCount } = computeSlotAvailability(
    gen.slots,
    jobs.map((j) => ({ startMinutes: parseTimeToMinutes(j.time) }))
  );

  return {
    slots: slots.map((s) => ({
      start: s.start,
      end: s.end,
      label: formatSlotLabel(s.start, locale),
      available: s.available,
    })),
    closed: false,
    hoursNotSet: false,
    unscheduledCount,
  };
}

/* ------------------------------------------------------------------ */
/* Slot-aware booking confirm (server-side double-booking guard)        */
/* ------------------------------------------------------------------ */

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const bookingWithTimeSchema = z.object({
  slug: z.string().trim().min(1),
  name: z.string().trim().min(2, 'Please enter your name').max(100),
  phone: z.string().trim().min(1, 'Please enter your phone number').max(25),
  address: z.string().trim().max(500).optional().default(''),
  date: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a preferred date'),
  serviceId: z.string().trim().optional().default(''),
  notes: z.string().trim().max(1000).optional().default(''),
  // "HH:MM" slot picked from availability. Empty only when the business has
  // no working hours configured (then no slot validation is possible).
  time: z.string().trim().optional().default(''),
  idempotencyKey: z.string().trim().min(8).max(128).optional().default(''),
});

/** Idempotency for public submits (single-instance in-memory store). */
const BOOKING_KEY_TTL_MS = 60 * 60 * 1000;
type BookingEntry = { promise: Promise<BookingResult> | null; outcome: BookingResult | null; expiresAt: number };
const bookingStore = new Map<string, BookingEntry>();

function getBookingEntry(key: string): BookingEntry | null {
  const e = bookingStore.get(key);
  if (!e) return null;
  if (e.expiresAt < Date.now()) {
    bookingStore.delete(key);
    return null;
  }
  return e;
}

/**
 * Submit a booking request with an availability-checked time slot.
 * Rejects double-bookings server-side: the chosen slot is re-validated
 * against current jobs at confirm time, so a stale form or double submit
 * can never take an already-booked slot.
 */
export async function submitBookingWithTime(
  _prev: BookingResult,
  formData: FormData
): Promise<BookingResult> {
  const hit = checkPublicLimit(await publicClientKey('booking-submit-time'));
  if (hit) return hit;
  const locale: Locale = await getLocale();

  const parsed = bookingWithTimeSchema.safeParse({
    slug: formData.get('slug'),
    name: formData.get('name'),
    phone: formData.get('phone'),
    address: formData.get('address'),
    date: formData.get('date'),
    serviceId: formData.get('serviceId'),
    notes: formData.get('notes'),
    time: formData.get('time'),
    idempotencyKey: formData.get('idempotencyKey'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };
  }

  const key = parsed.data.idempotencyKey;
  if (key) {
    const storeKey = `${key}|${parsed.data.time || 'anytime'}`;
    const existing = getBookingEntry(storeKey);
    if (existing?.promise) return existing.promise;
    if (existing?.outcome) return existing.outcome;

    let resolveOutcome!: (r: BookingResult) => void;
    const promise = new Promise<BookingResult>((resolve) => {
      resolveOutcome = resolve;
    });
    bookingStore.set(storeKey, { promise, outcome: null, expiresAt: Date.now() + BOOKING_KEY_TTL_MS });

    const outcome = await runBookingWithTime(parsed.data, locale);
    bookingStore.set(storeKey, { promise: null, outcome, expiresAt: Date.now() + BOOKING_KEY_TTL_MS });
    resolveOutcome(outcome);
    return outcome;
  }

  return runBookingWithTime(parsed.data, locale);
}

type BookingWithTimeData = z.infer<typeof bookingWithTimeSchema>;

async function runBookingWithTime(
  { slug, name, phone, address, date, serviceId, notes, time }: BookingWithTimeData,
  locale: Locale
): Promise<BookingResult> {
  const page = await prisma.bookingPage.findUnique({
    where: { slug },
    select: {
      businessId: true,
      enabled: true,
      business: { select: { regionCode: true, workingHours: true, timezone: true } },
    },
  });
  if (!page || !page.enabled) {
    return { error: 'This booking page is not available.' };
  }
  const businessId = page.businessId;

  const phoneCheck = validatePhone(phone, page.business.regionCode ?? 'CA');
  if (!phoneCheck.ok) return { error: INVALID_PHONE_MESSAGE };
  const phoneNorm = phoneCheck.digits;

  const preferred = new Date(`${date}T00:00:00`);
  if (Number.isNaN(preferred.getTime())) {
    return { error: 'Pick a valid preferred date.' };
  }
  // Compare against "today" in the business's own timezone — the server
  // runs on UTC, so a server-local check would wrongly reject same-day
  // evening bookings in timezones behind UTC.
  const todayStr = todayInTimezone(page.business.timezone, page.business.regionCode);
  if (date < todayStr) {
    return { error: t(locale, 'reminders.booking.datePast') };
  }

  // --- Slot validation (the double-booking guard) ---
  let validatedTime: string | null = null;
  const gen = generateDaySlots(page.business.workingHours, date);
  if (!gen.hoursNotSet && !gen.closed) {
    // Business takes timed bookings: a slot is required and must be free now.
    if (!time || !TIME_RE.test(time)) {
      return { error: t(locale, 'reminders.booking.timeRequired') };
    }
    const { gte, lte } = dayRange(date);
    const jobs = await prisma.job.findMany({
      where: {
        businessId,
        date: { gte, lte },
        status: { not: 'CANCELLED' },
      },
      select: { time: true },
    });
    const { slots } = computeSlotAvailability(
      gen.slots,
      jobs.map((j) => ({ startMinutes: parseTimeToMinutes(j.time) }))
    );
    const avail: SlotWithAvailability[] = slots;
    if (!isSlotStillAvailable(time, avail)) {
      return { error: t(locale, 'reminders.booking.slotTaken') };
    }
    validatedTime = time;
  }
  // When hours aren't configured (or the day is closed and the customer
  // submitted a stale form), store no time — the owner confirms by phone.

  let service: { id: string; name: string; price: number } | null = null;
  if (serviceId) {
    service = await prisma.service.findFirst({
      where: { id: serviceId, businessId },
      select: { id: true, name: true, price: true },
    });
    if (!service) return { error: 'Selected service is not available.' };
  }

  const existingCustomer = await prisma.customer.findFirst({
    where: { businessId, OR: [{ phoneNorm }, { phone }] },
    select: { id: true, phoneNorm: true },
  });

  const customer = existingCustomer
    ? await prisma.customer.update({
        where: { id: existingCustomer.id },
        data: {
          name,
          address: address || undefined,
          ...(existingCustomer.phoneNorm ? {} : { phoneNorm }),
        },
        select: { id: true },
      })
    : await prisma.customer.create({
        data: {
          name,
          phone,
          phoneNorm,
          address: address || null,
          notes: 'Added via online booking page.',
          businessId,
        },
        select: { id: true },
      });

  await prisma.job.create({
    data: {
      title: service ? service.name : 'Booking request',
      date: preferred,
      // Canonical 24h "HH:MM" — parseable by the slot logic everywhere.
      time: validatedTime,
      address: address || null,
      price: service ? service.price : 0,
      status: 'NEW',
      notes:
        (notes ? `Booked online. Customer notes: ${notes}` : 'Booked online via booking page.') +
        (validatedTime ? ` Requested time: ${formatSlotLabel(validatedTime, locale)}.` : ''),
      customerId: customer.id,
      businessId,
    },
  });

  return { ok: true };
}
