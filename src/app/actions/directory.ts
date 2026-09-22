'use server';

import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { rateLimit, QUOTE_REQUEST_LIMIT, REPORT_LIMIT } from '@/lib/rate-limit';
import { validatePhone, INVALID_PHONE_MESSAGE } from '@/lib/phone';
import {
  publicClientIp,
  matchesServiceKeyword,
  matchesCity,
  isDirectoryAdminEmail,
} from '@/lib/directory';

export type DirectoryActionResult = {
  ok?: boolean;
  /** True when the request was saved but matched no providers (open demand). */
  unmatched?: boolean;
  city?: string;
  error?: string;
  businessNames?: string[];
  /** Echoed form values so the UI can preserve them after a validation error. */
  values?: {
    serviceNeed: string;
    city: string;
    area: string;
    name: string;
    phone: string;
    details: string;
  };
};

/* ------------------------------------------------------------------ */
/* Shared matching                                                     */
/* ------------------------------------------------------------------ */

export type DirectoryCandidate = {
  id: string;
  name: string;
  address: string | null;
  serviceNames: string[];
  slug: string;
};

/**
 * Find opted-in businesses matching a service keyword + city.
 * Tenant-safe: only directoryOptIn businesses with a booking page (stable
 * public slug) are ever returned; all other business data stays private.
 */
export async function findDirectoryMatches(
  serviceNeed: string,
  city: string,
  limit = 5
): Promise<DirectoryCandidate[]> {
  const businesses = await prisma.business.findMany({
    where: { directoryOptIn: true, bookingPage: { isNot: null } },
    select: {
      id: true,
      name: true,
      address: true,
      bookingPage: { select: { slug: true } },
      services: { select: { name: true } },
    },
    orderBy: { name: 'asc' },
    take: 200,
  });

  return businesses
    .filter(
      (b) =>
        matchesCity(city, b.address) &&
        matchesServiceKeyword(serviceNeed, b.name, b.services.map((s) => s.name))
    )
    .slice(0, limit)
    .map((b) => ({
      id: b.id,
      name: b.name,
      address: b.address,
      serviceNames: b.services.map((s) => s.name),
      slug: b.bookingPage!.slug,
    }));
}

/** Phone validation that accepts either region (customer may be IN or CA). */
function validateCustomerPhone(phone: string): { ok: boolean; digits: string | null } {
  const inCheck = validatePhone(phone, 'IN');
  if (inCheck.ok && inCheck.digits) return inCheck;
  const caCheck = validatePhone(phone, 'CA');
  if (caCheck.ok && caCheck.digits) return caCheck;
  return { ok: false, digits: null };
}

const quoteRequestSchema = z.object({
  serviceNeed: z.string().trim().min(3, 'Tell us what service you need.').max(200),
  city: z.string().trim().min(2, 'Enter your city or area.').max(100),
  area: z.string().trim().max(100).optional().default(''),
  name: z.string().trim().min(2, 'Please enter your name.').max(100),
  phone: z.string().trim().min(1, 'Please enter your phone number.').max(25),
  details: z.string().trim().max(1000).optional().default(''),
});

/**
 * Public quote request. Creates a LEAD draft (source "Directory", status NEW)
 * in each matching provider's inbox — the provider chooses to respond.
 * Nothing is sent anywhere automatically. Rate-limited: 5/hour/IP.
 */
export async function submitQuoteRequest(
  _prev: DirectoryActionResult,
  formData: FormData
): Promise<DirectoryActionResult> {
  const ip = await publicClientIp();
  const rl = rateLimit(`quote-request:${ip}`, QUOTE_REQUEST_LIMIT);
  if (!rl.ok) {
    const mins = Math.max(1, Math.ceil(rl.retryAfterMs / 60000));
    return {
      error: `You've sent a lot of requests. Please try again in about ${mins} minute${mins === 1 ? '' : 's'}.`,
    };
  }

  const parsed = quoteRequestSchema.safeParse({
    serviceNeed: formData.get('serviceNeed'),
    city: formData.get('city'),
    area: formData.get('area'),
    name: formData.get('name'),
    phone: formData.get('phone'),
    details: formData.get('details'),
  });
  // Echo the raw values so the form never clears on a validation error.
  const values = {
    serviceNeed: String(formData.get('serviceNeed') ?? ''),
    city: String(formData.get('city') ?? ''),
    area: String(formData.get('area') ?? ''),
    name: String(formData.get('name') ?? ''),
    phone: String(formData.get('phone') ?? ''),
    details: String(formData.get('details') ?? ''),
  };
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check the form.', values };
  }
  const { serviceNeed, city, area, name, phone, details } = parsed.data;

  const phoneCheck = validateCustomerPhone(phone);
  if (!phoneCheck.ok) return { error: INVALID_PHONE_MESSAGE, values };

  const matches = await findDirectoryMatches(serviceNeed, city, 5);
  if (matches.length === 0) {
    // No providers matched — save the request as an OPEN lead draft instead
    // of dropping it. It becomes visible in the admin demand queue, and the
    // requester gets a clear "saved" confirmation (never an ambiguous error).
    await prisma.directoryRequest.create({
      data: {
        serviceNeed,
        city,
        area: area || null,
        name,
        phone,
        phoneNorm: phoneCheck.digits,
        details: details || null,
        status: 'OPEN',
      },
    });
    return { ok: true, unmatched: true, city };
  }

  const leadDetails = [
    `Directory quote request — ${serviceNeed}`,
    `City: ${city}${area ? ` (${area})` : ''}`,
    details ? `Details: ${details}` : '',
    'The customer asked via the Kivo directory. Reply only if you want the work — nothing was sent automatically.',
  ]
    .filter(Boolean)
    .join('\n');

  await prisma.$transaction(
    matches.map((m) =>
      prisma.lead.create({
        data: {
          name,
          phone,
          phoneNorm: phoneCheck.digits,
          details: leadDetails,
          status: 'NEW',
          source: 'Directory',
          businessId: m.id,
        },
      })
    )
  );

  return { ok: true, businessNames: matches.map((m) => m.name) };
}

/* ------------------------------------------------------------------ */
/* Business reports                                                    */
/* ------------------------------------------------------------------ */

const REPORT_REASONS = ['spam', 'fake-listing', 'wrong-info', 'rude-behaviour', 'other'] as const;

const reportSchema = z.object({
  slug: z.string().trim().min(1),
  reason: z.enum(REPORT_REASONS),
  details: z.string().trim().max(1000).optional().default(''),
  reporterContact: z.string().trim().max(120).optional().default(''),
});

/** Public "report this business" — creates an internal flag for review. */
export async function reportBusiness(
  _prev: DirectoryActionResult,
  formData: FormData
): Promise<DirectoryActionResult> {
  const ip = await publicClientIp();
  const rl = rateLimit(`dir-report:${ip}`, REPORT_LIMIT);
  if (!rl.ok) return { error: 'Too many reports. Please try again later.' };

  const parsed = reportSchema.safeParse({
    slug: formData.get('slug'),
    reason: formData.get('reason'),
    details: formData.get('details'),
    reporterContact: formData.get('reporterContact'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };
  }

  const page = await prisma.bookingPage.findUnique({
    where: { slug: parsed.data.slug },
    select: { businessId: true, business: { select: { directoryOptIn: true } } },
  });
  if (!page || !page.business.directoryOptIn) {
    return { error: 'Business not found.' };
  }

  await prisma.directoryReport.create({
    data: {
      businessId: page.businessId,
      reason: parsed.data.reason,
      details: parsed.data.details || null,
      reporterContact: parsed.data.reporterContact || null,
      status: 'OPEN',
    },
  });

  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Admin (KIVO_ADMIN_EMAILS)                                            */
/* ------------------------------------------------------------------ */

/** Update a directory report's review status. */
export async function updateReportStatus(
  reportId: string,
  status: 'REVIEWED' | 'DISMISSED'
): Promise<DirectoryActionResult> {
  const { getSession } = await import('@/lib/auth');
  const session = await getSession();
  const email = session?.user?.email;
  if (!isDirectoryAdminEmail(email)) return { error: 'Not authorized.' };

  const report = await prisma.directoryReport.findUnique({
    where: { id: reportId },
    select: { id: true },
  });
  if (!report) return { error: 'Report not found.' };

  await prisma.directoryReport.update({
    where: { id: reportId },
    data: { status },
  });
  const { revalidatePath } = await import('next/cache');
  revalidatePath('/directory-reports');
  return { ok: true };
}

/**
 * Admin triage for unmatched directory demand. Gated by KIVO_ADMIN_EMAILS.
 * FULFILLED = a provider picked it up; DISMISSED = spam/duplicate.
 */
export async function updateDirectoryRequestStatus(
  requestId: string,
  status: 'FULFILLED' | 'DISMISSED'
): Promise<DirectoryActionResult> {
  const { getSession } = await import('@/lib/auth');
  const session = await getSession();
  const email = session?.user?.email;
  if (!isDirectoryAdminEmail(email)) return { error: 'Not authorized.' };

  const req = await prisma.directoryRequest.findUnique({
    where: { id: requestId },
    select: { id: true },
  });
  if (!req) return { error: 'Request not found.' };

  await prisma.directoryRequest.update({ where: { id: requestId }, data: { status } });
  const { revalidatePath } = await import('next/cache');
  revalidatePath('/directory-requests');
  return { ok: true };
}
