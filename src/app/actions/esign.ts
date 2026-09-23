'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { rateLimit, ACTION_LIMIT } from '@/lib/rate-limit';
import {
  issueSignatureRequest,
  revokeSignatureRequest,
  type SignField,
} from '@/lib/esign';

export type EsignActionResult = {
  ok?: boolean;
  error?: string;
  id?: string;
  token?: string;
};

const signFieldSchema = z.object({
  type: z.enum(['signature', 'date', 'initials']),
  // Percent-of-document coordinates, so placement survives resizing.
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  page: z.number().int().min(0),
});

const createSignRequestSchema = z.object({
  quoteId: z.string().min(1),
  fields: z.array(signFieldSchema).min(1).max(20),
  signerContact: z.string().trim().max(100).optional().nullable(),
});

async function clientKey(prefix: string): Promise<string> {
  const h = await headers();
  const ip =
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    h.get('x-real-ip') ||
    'unknown';
  return `${prefix}:${ip}`;
}

/**
 * Owner-side: issue a signing link for a quote. Returns the RAW token once —
 * the client shows it as a shareable link; it is never stored.
 */
export async function createSignRequest(
  quoteId: string,
  fields: SignField[],
  signerContact: string | null
): Promise<EsignActionResult> {
  const { businessId } = await requireAuth();

  const rl = rateLimit(await clientKey('esign:create'), ACTION_LIMIT);
  if (!rl.ok) {
    return { error: 'Too many requests. Try again shortly.' };
  }

  const parsed = createSignRequestSchema.safeParse({
    quoteId,
    fields,
    signerContact,
  });
  if (!parsed.success) return { error: 'Invalid signing fields.' };

  try {
    // Signing links live for 30 days.
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const { id, token } = await issueSignatureRequest(
      businessId,
      parsed.data.quoteId,
      parsed.data.fields,
      parsed.data.signerContact ?? null,
      expiresAt
    );
    return { ok: true, id, token };
  } catch {
    return { error: 'Could not create the signing link.' };
  }
}

/** Owner-side: revoke one signing link. Tenant-scoped via businessId. */
export async function revokeSignRequest(
  requestId: string
): Promise<{ ok?: boolean; error?: string }> {
  const { businessId } = await requireAuth();

  const rec = await prisma.signatureRequest.findFirst({
    where: { id: requestId, businessId },
    select: { quoteId: true },
  });
  if (!rec) return { error: 'Signing link not found.' };

  const ok = await revokeSignatureRequest(businessId, requestId);
  if (!ok) return { error: 'This link is already inactive.' };

  revalidatePath(`/quotes/${rec.quoteId}`);
  return { ok: true };
}
