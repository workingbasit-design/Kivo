'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { rateLimit, ACTION_LIMIT } from '@/lib/rate-limit';
import { validatePhone, INVALID_PHONE_MESSAGE } from '@/lib/phone';

export type BookingResult = { error?: string; ok?: boolean };

/** Public (no-auth) endpoints get a stricter per-IP budget. */
const PUBLIC_LIMIT = { limit: 30, windowMs: 60 * 1000 };

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'Link must be at least 3 characters')
  .max(60, 'Link must be 60 characters or less')
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'Use lowercase letters, numbers and hyphens only'
  );

const bookingSettingsSchema = z.object({
  enabled: z.coerce.boolean(),
  slug: slugSchema,
  headline: z.string().trim().max(120).optional().default(''),
  intro: z.string().trim().max(1000).optional().default(''),
});

const phoneSchema = z
  .string()
  .trim()
  .min(1, 'Please enter your phone number')
  .max(25, 'Phone number is too long');
// Real validation happens in the action via libphonenumber-js for the
// business's region (friendly "That phone number doesn't look valid." error).

const bookingRequestSchema = z.object({
  slug: z.string().trim().min(1),
  name: z.string().trim().min(2, 'Please enter your name').max(100),
  phone: phoneSchema,
  address: z.string().trim().max(500).optional().default(''),
  date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a preferred date'),
  serviceId: z.string().trim().optional().default(''),
  notes: z.string().trim().max(1000).optional().default(''),
  // Client-generated idempotency key (one per form render). Optional —
  // double-submits with the same key create one customer + one job.
  idempotencyKey: z.string().trim().min(8).max(128).optional().default(''),
});

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

/* ------------------------------------------------------------------ */
/* Business settings (authenticated)                                   */
/* ------------------------------------------------------------------ */

/**
 * Create or update this business's public booking page.
 * Slug is globally unique — reject if another business already uses it.
 */
export async function saveBookingSettings(
  _prev: BookingResult,
  formData: FormData
): Promise<BookingResult> {
  const { businessId } = await requireAuth();
  const rl = rateLimit(`booking-settings:${businessId}`, ACTION_LIMIT);
  if (!rl.ok) return { error: 'Too many requests. Please slow down.' };

  const parsed = bookingSettingsSchema.safeParse({
    enabled: formData.get('enabled') === 'on',
    slug: formData.get('slug'),
    headline: formData.get('headline'),
    intro: formData.get('intro'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid booking settings.' };
  }
  const { enabled, slug, headline, intro } = parsed.data;

  const clash = await prisma.bookingPage.findFirst({
    where: { slug, NOT: { businessId } },
    select: { id: true },
  });
  if (clash) {
    return { error: 'This booking link is already taken. Try another one.' };
  }

  await prisma.bookingPage.upsert({
    where: { businessId },
    create: {
      businessId,
      slug,
      enabled,
      headline: headline || null,
      intro: intro || null,
    },
    update: {
      slug,
      enabled,
      headline: headline || null,
      intro: intro || null,
    },
  });

  revalidatePath('/settings/booking');
  revalidatePath(`/book/${slug}`);
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Public booking request (no auth)                                    */
/* ------------------------------------------------------------------ */

/**
 * Idempotency for public booking submits. A double-click / retry sends the
 * same client-generated key; the first in-flight request is awaited and its
 * result reused, and settled results are kept for BOOKING_KEY_TTL_MS so a
 * later retry returns success without creating another customer + job.
 * (Single-instance in-memory store, like the rate limiter.)
 */
const BOOKING_KEY_TTL_MS = 60 * 60 * 1000;
type BookingEntry = {
  promise: Promise<BookingResult> | null;
  outcome: BookingResult | null;
  expiresAt: number;
};
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
 * Submit a booking request from a public booking page.
 * Creates (or reuses by phone) the Customer and a NEW Job for the business
 * that owns the slug. Never exposes any other business's data.
 * Idempotent per idempotencyKey: replays return the original result.
 */
export async function submitBookingRequest(
  _prev: BookingResult,
  formData: FormData
): Promise<BookingResult> {
  const hit = checkPublicLimit(await publicClientKey('booking-submit'));
  if (hit) return hit;

  const parsed = bookingRequestSchema.safeParse({
    slug: formData.get('slug'),
    name: formData.get('name'),
    phone: formData.get('phone'),
    address: formData.get('address'),
    date: formData.get('date'),
    serviceId: formData.get('serviceId'),
    notes: formData.get('notes'),
    idempotencyKey: formData.get('idempotencyKey'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };
  }

  const key = parsed.data.idempotencyKey;
  if (key) {
    const existing = getBookingEntry(key);
    if (existing?.promise) return existing.promise;
    if (existing?.outcome) return existing.outcome;

    // Register in-flight synchronously (before any await) so concurrent
    // double-submits collapse onto this single run.
    let resolveOutcome!: (r: BookingResult) => void;
    const promise = new Promise<BookingResult>((resolve) => {
      resolveOutcome = resolve;
    });
    bookingStore.set(key, { promise, outcome: null, expiresAt: Date.now() + BOOKING_KEY_TTL_MS });

    const outcome = await runBookingRequest(parsed.data);
    bookingStore.set(key, { promise: null, outcome, expiresAt: Date.now() + BOOKING_KEY_TTL_MS });
    resolveOutcome(outcome);
    return outcome;
  }

  return runBookingRequest(parsed.data);
}

type BookingRequestData = z.infer<typeof bookingRequestSchema>;

async function runBookingRequest({
  slug,
  name,
  phone,
  address,
  date,
  serviceId,
  notes,
}: BookingRequestData): Promise<BookingResult> {

  const page = await prisma.bookingPage.findUnique({
    where: { slug },
    select: {
      businessId: true,
      enabled: true,
      business: { select: { regionCode: true } },
    },
  });
  if (!page || !page.enabled) {
    return { error: 'This booking page is not available.' };
  }
  const businessId = page.businessId;

  // Real phone validation for the business's region (friendly inline error).
  const phoneCheck = validatePhone(phone, page.business.regionCode ?? 'CA');
  if (!phoneCheck.ok) return { error: INVALID_PHONE_MESSAGE };
  const phoneNorm = phoneCheck.digits;

  const preferred = new Date(`${date}T00:00:00`);
  if (Number.isNaN(preferred.getTime())) {
    return { error: 'Pick a valid preferred date.' };
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (preferred < today) {
    return { error: 'Preferred date cannot be in the past.' };
  }

  let service: { id: string; name: string; price: number } | null = null;
  if (serviceId) {
    service = await prisma.service.findFirst({
      where: { id: serviceId, businessId },
      select: { id: true, name: true, price: true },
    });
    if (!service) return { error: 'Selected service is not available.' };
  }

  // Match on the normalized E.164 digits first (same number in any
  // formatting), falling back to the raw phone for pre-validation records.
  const existingCustomer = await prisma.customer.findFirst({
    where: {
      businessId,
      OR: [{ phoneNorm }, { phone }],
    },
    select: { id: true, phoneNorm: true },
  });

  const customer = existingCustomer
    ? await prisma.customer.update({
        where: { id: existingCustomer.id },
        data: {
          name,
          address: address || undefined,
          // Backfill the normalized form for older records.
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
      address: address || null,
      price: service ? service.price : 0,
      status: 'NEW',
      notes: notes
        ? `Booked online. Customer notes: ${notes}`
        : 'Booked online via booking page.',
      customerId: customer.id,
      businessId,
    },
  });

  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Client portal: quote approve / decline (no auth, unguessable URL)   */
/* ------------------------------------------------------------------ */

export type PortalResult = { error?: string; ok?: boolean; status?: string };

/**
 * Approve or decline a quote from the public client portal.
 * Only quotes in SENT status can be decided; the cuid id is the capability.
 */
export async function portalQuoteDecision(
  quoteId: string,
  decision: 'APPROVED' | 'DECLINED'
): Promise<PortalResult> {
  const hit = checkPublicLimit(await publicClientKey('portal-quote'));
  if (hit) return hit;

  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    select: { id: true, status: true },
  });
  if (!quote) return { error: 'This link is invalid or has expired.' };
  if (quote.status === 'APPROVED' || quote.status === 'DECLINED') {
    return { error: 'This quote has already been responded to.', status: quote.status };
  }
  if (quote.status !== 'SENT') {
    return { error: 'This quote is not ready for approval yet.' };
  }

  const updated = await prisma.quote.update({
    where: { id: quoteId },
    data: { status: decision },
    select: { status: true },
  });

  revalidatePath(`/q/${quoteId}`);
  return { ok: true, status: updated.status };
}
