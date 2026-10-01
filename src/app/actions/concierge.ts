'use server';

import { getCustomerSession } from '@/lib/customer-auth';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rate-limit';
import { leadExpiryDate } from '@/lib/lead-expiry';
import { findDirectoryMatches } from './directory';
import {
  interpretServiceNeed,
  buildConciergeMessage,
  isValidIdempotencyKey,
  CONCIERGE_MAX_PROS,
  CONCIERGE_RATE_LIMIT,
  type ConciergeLocale,
} from '@/lib/concierge';

export type ConciergeMatchResult =
  | { ok: true; serviceLabel: string; serviceKey: string; pros: ConciergePro[] }
  | { ok: false; error: string };

export type ConciergePro = {
  id: string;
  name: string;
  locality: string | null;
  serviceNames: string[];
};

export type ConciergeSendResult =
  | { ok: true; requestIds: string[]; businessNames: string[]; replayed?: boolean }
  | { ok: false; error: string };

/**
 * Step 2 of "Get it done for me": interpret the description and find up to
 * 3 opted-in, verified pros matching the service + city. Never invents pros —
 * an empty list is an honest empty state for the UI.
 */
export async function matchConciergePros(
  description: string,
  city: string
): Promise<ConciergeMatchResult> {
  const session = await getCustomerSession();
  if (!session) return { ok: false, error: 'Please log in to use the concierge.' };

  const desc = description.trim();
  if (desc.length < 10) {
    return { ok: false, error: 'Describe the job in a little more detail (at least a sentence).' };
  }
  const cleanCity = city.trim();
  if (cleanCity.length < 2) {
    return { ok: false, error: 'Please enter your city.' };
  }

  const locale: ConciergeLocale = session.customer.locale === 'fr' ? 'fr' : 'en';
  const need = interpretServiceNeed(desc, locale);
  const matches = await findDirectoryMatches(need.matchKeyword, cleanCity, CONCIERGE_MAX_PROS);

  return {
    ok: true,
    serviceLabel: need.label,
    serviceKey: need.key,
    pros: matches.map((m) => ({
      id: m.id,
      name: m.name,
      locality: m.address,
      serviceNames: m.serviceNames,
    })),
  };
}

/**
 * Step 4 of "Get it done for me": the customer's explicit tap.
 *
 * Creates ONE QuoteRequest + opening QuoteMessage per selected pro, plus a
 * Lead draft in each pro's inbox — all inside a single transaction, so a
 * mid-send failure creates nothing. Idempotent: the client generates one
 * UUID per preview session; replays resolve to the original send.
 *
 * Rate-limited per customer. Nothing is sent by SMS/WhatsApp/email —
 * requests land in EveryJob's internal inbox only.
 */
export async function sendConciergeRequests(input: {
  idempotencyKey: string;
  businessIds: string[];
  serviceLabel: string;
  description: string;
  name: string;
  phone: string;
  city: string;
}): Promise<ConciergeSendResult> {
  const session = await getCustomerSession();
  if (!session) return { ok: false, error: 'Please log in to use the concierge.' };
  const customer = session.customer;

  const rl = rateLimit(`concierge:${customer.id}`, CONCIERGE_RATE_LIMIT);
  if (!rl.ok) {
    return { ok: false, error: 'You have sent several requests recently. Please wait a bit before sending more.' };
  }

  const { idempotencyKey, businessIds } = input;
  if (!isValidIdempotencyKey(idempotencyKey)) {
    return { ok: false, error: 'This send session expired. Please go back and try again.' };
  }

  const uniqueBusinessIds = [...new Set(businessIds)].slice(0, CONCIERGE_MAX_PROS);
  if (uniqueBusinessIds.length === 0) {
    return { ok: false, error: 'Select at least one pro to send your request to.' };
  }

  const description = input.description.trim();
  const name = input.name.trim();
  const phone = input.phone.trim();
  const city = input.city.trim();
  if (!description || !name || !phone || !city) {
    return { ok: false, error: 'Please fill in the job description, your name, phone, and city.' };
  }

  const locale: ConciergeLocale = customer.locale === 'fr' ? 'fr' : 'en';
  const message = buildConciergeMessage({
    serviceLabel: input.serviceLabel,
    description,
    name,
    phone,
    city,
    locale,
  });

  try {
    // Re-validate eligibility at send time: only verified, opted-in pros.
    const eligible = await prisma.business.findMany({
      where: {
        id: { in: uniqueBusinessIds },
        directoryOptIn: true,
        directoryVerifiedAt: { not: null },
      },
      select: { id: true, name: true },
    });
    if (eligible.length !== uniqueBusinessIds.length) {
      return {
        ok: false,
        error: 'One of the selected pros is no longer available. Please search again.',
      };
    }

    const result = await prisma.$transaction(async (tx) => {
      // Idempotency: a replayed key resolves to the original send.
      const existing = await tx.conciergeSend.findUnique({
        where: { idempotencyKey },
      });
      if (existing) {
        // Replay returns the EXACT requests from the original send —
        // never a fresh lookup that could match older requests.
        return {
          requestIds: existing.requestIds,
          businessNames: eligible.map((b) => b.name),
          replayed: true as const,
        };
      }

      const requestIds: string[] = [];
      for (const biz of eligible) {
        const qr = await tx.quoteRequest.create({
          data: {
            customerId: customer.id,
            businessId: biz.id,
            service: input.serviceLabel,
            description,
            status: 'sent',
            source: 'concierge',
            messages: { create: { senderType: 'customer', body: message } },
          },
          select: { id: true },
        });
        requestIds.push(qr.id);
        await tx.lead.create({
          data: {
            name,
            phone,
            email: customer.email,
            details: message,
            status: 'NEW',
            source: 'Concierge',
            businessId: biz.id,
            expiresAt: leadExpiryDate(),
          },
        });
      }

      await tx.conciergeSend.create({
        data: {
          idempotencyKey,
          customerId: customer.id,
          businessIds: eligible.map((b) => b.id),
          requestIds,
          service: input.serviceLabel,
        },
      });

      return { requestIds, businessNames: eligible.map((b) => b.name), replayed: false as const };
    });

    return { ok: true, ...result };
  } catch (e) {
    // Concurrent double-tap: the loser hits the unique constraint and
    // resolves to the winner's send instead of erroring.
    if (e instanceof Error && /unique|Unique/i.test(e.message)) {
      const existing = await prisma.conciergeSend.findUnique({ where: { idempotencyKey } });
      if (existing && existing.customerId === customer.id) {
        const names = await prisma.business.findMany({
          where: { id: { in: existing.businessIds } },
          select: { name: true },
        });
        return {
          ok: true,
          requestIds: existing.requestIds,
          businessNames: names.map((b) => b.name),
          replayed: true,
        };
      }
    }
    return { ok: false, error: 'Something went wrong sending your requests. Nothing was sent — please try again.' };
  }
}
