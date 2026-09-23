/**
 * Customer portal tokens — magic-link auth for the public customer portal.
 *
 * Unlike ShareToken (which stores the raw token for document links), portal
 * tokens are stored as SHA-256 hashes: anyone who can read the database
 * still cannot mint a working portal URL. Lookup hashes the presented
 * token — there is no enumeration vector (invalid tokens all resolve to
 * the same "link invalid or expired" outcome).
 *
 * A token is usable when revokedAt is null and (expiresAt is null or in
 * the future). Every query is scoped to (businessId, customerId) — a token
 * can never escape its tenant or its customer.
 */
import { createHash, randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';

export function newPortalTokenValue(): string {
  return randomBytes(32).toString('hex');
}

export function hashPortalToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function isPortalTokenActive(t: {
  revokedAt: Date | null;
  expiresAt: Date | null;
}): boolean {
  if (t.revokedAt) return false;
  if (t.expiresAt && t.expiresAt.getTime() <= Date.now()) return false;
  return true;
}

export type PortalTokenRecord = {
  id: string;
  customerId: string;
  businessId: string;
  revokedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
};

/**
 * Issue a portal token for a customer: revoke all currently-usable tokens
 * first so "regenerate" instantly invalidates old links. Tenant-scoped —
 * the customer must belong to the business.
 */
export async function issueCustomerPortalToken(
  businessId: string,
  customerId: string,
  expiresAt: Date | null = null
): Promise<{ id: string; token: string; expiresAt: Date | null }> {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, businessId },
    select: { id: true },
  });
  if (!customer) throw new Error('Customer not found.');

  const now = new Date();
  await prisma.customerPortalToken.updateMany({
    where: {
      businessId,
      customerId,
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    data: { revokedAt: now },
  });

  const token = newPortalTokenValue();
  const rec = await prisma.customerPortalToken.create({
    data: {
      tokenHash: hashPortalToken(token),
      businessId,
      customerId,
      expiresAt,
    },
    select: { id: true, expiresAt: true },
  });
  return { id: rec.id, token, expiresAt: rec.expiresAt };
}

/** Latest usable portal token for a customer, or null. Business-scoped. */
export async function getActivePortalToken(businessId: string, customerId: string) {
  const now = new Date();
  return prisma.customerPortalToken.findFirst({
    where: {
      businessId,
      customerId,
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true, expiresAt: true, createdAt: true },
  });
}

/** Revoke one portal token. Business-scoped. */
export async function revokeCustomerPortalToken(
  businessId: string,
  tokenId: string
): Promise<boolean> {
  const rec = await prisma.customerPortalToken.findFirst({
    where: { id: tokenId, businessId },
    select: { id: true, revokedAt: true },
  });
  if (!rec || rec.revokedAt) return false;
  await prisma.customerPortalToken.update({
    where: { id: rec.id },
    data: { revokedAt: new Date() },
  });
  return true;
}

/**
 * Resolve a presented portal token to its customer. Returns null for any
 * failure — callers show a single generic "link invalid or expired" page
 * and never distinguish "unknown token" from "expired".
 */
export async function resolveCustomerPortalToken(
  token: string
): Promise<PortalTokenRecord | null> {
  if (!token || token.length > 128) return null;
  const rec = await prisma.customerPortalToken.findUnique({
    where: { tokenHash: hashPortalToken(token) },
    select: {
      id: true,
      customerId: true,
      businessId: true,
      revokedAt: true,
      expiresAt: true,
      createdAt: true,
    },
  });
  if (!rec || !isPortalTokenActive(rec)) return null;
  return rec;
}
