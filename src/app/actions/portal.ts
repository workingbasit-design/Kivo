'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { rateLimit, ACTION_LIMIT } from '@/lib/rate-limit';
import {
  issueCustomerPortalToken,
  revokeCustomerPortalToken,
  getActivePortalToken,
} from '@/lib/portal';

export type PortalActionResult = {
  error?: string;
  ok?: boolean;
  token?: string;
  tokenId?: string;
};

/**
 * Create (or regenerate) the customer portal link. Tenant-scoped: the
 * customer must belong to the caller's business. Requires a customer phone
 * number — the link is shared over WhatsApp, which the owner sends by
 * tapping the generated wa.me link (EveryJob never sends anything itself).
 */
export async function createPortalLink(
  _prev: PortalActionResult,
  formData: FormData
): Promise<PortalActionResult> {
  const { businessId, user } = await requireAuth();
  const rl = rateLimit(`portal-link:${user.id}`, ACTION_LIMIT);
  if (!rl.ok) return { error: 'Too many requests. Please wait a moment and try again.' };

  const customerId = String(formData.get('customerId') ?? '');
  if (!customerId) return { error: 'Customer is required.' };

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, businessId },
    select: { id: true, phone: true },
  });
  if (!customer) return { error: 'Customer not found.' };
  if (!customer.phone) {
    return { error: 'Add a phone number for this customer first — the portal link is shared over WhatsApp.' };
  }

  try {
    const rec = await issueCustomerPortalToken(businessId, customerId);
    revalidatePath(`/customers/${customerId}`);
    return { ok: true, token: rec.token, tokenId: rec.id };
  } catch {
    return { error: 'Could not create the portal link. Please try again.' };
  }
}

/** Revoke a customer portal link. Tenant-scoped. */
export async function revokePortalLink(
  _prev: PortalActionResult,
  formData: FormData
): Promise<PortalActionResult> {
  const { businessId, user } = await requireAuth();
  const rl = rateLimit(`portal-link:${user.id}`, ACTION_LIMIT);
  if (!rl.ok) return { error: 'Too many requests. Please wait a moment and try again.' };

  const tokenId = String(formData.get('tokenId') ?? '');
  const customerId = String(formData.get('customerId') ?? '');
  if (!tokenId || !customerId) return { error: 'Link is required.' };

  const ok = await revokeCustomerPortalToken(businessId, tokenId);
  if (!ok) return { error: 'Link not found.' };
  revalidatePath(`/customers/${customerId}`);
  return { ok: true };
}

/** Active portal link metadata for the customer page (no token value). */
export async function getPortalLinkState(customerId: string) {
  const { businessId } = await requireAuth();
  const rec = await getActivePortalToken(businessId, customerId);
  return rec
    ? { tokenId: rec.id, expiresAt: rec.expiresAt?.toISOString() ?? null, createdAt: rec.createdAt.toISOString() }
    : null;
}
