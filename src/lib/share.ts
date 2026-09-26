import { randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';
import { unsafeUnscoped } from './tenant-guard.ts';

export type ShareType = 'QUOTE' | 'INVOICE';

/**
 * Capability tokens for the public quote/invoice portals.
 *
 * The public pages (/q/[token], /i/[token]) resolve ONLY through the
 * ShareToken table — a raw cuid id never renders a document. A token is
 * usable when revokedAt is null and (expiresAt is null or in the future).
 * Tokens are 256-bit random hex strings: unguessable and URL-safe.
 */

/** Generate a new unguessable token value. */
export function newShareTokenValue(): string {
  return randomBytes(32).toString('hex');
}

/** Legacy cuid ids (pre-token public URLs) look like this. */
export function isLegacyCuid(value: string): boolean {
  return /^c[a-z0-9]{24}$/.test(value);
}

export function isTokenActive(t: {
  revokedAt: Date | null;
  expiresAt: Date | null;
}): boolean {
  if (t.revokedAt) return false;
  if (t.expiresAt && t.expiresAt.getTime() <= Date.now()) return false;
  return true;
}

type RefWhere =
  | { invoiceId: string; quoteId?: never }
  | { quoteId: string; invoiceId?: never };

/** Latest usable token for a document, or null. Business-scoped. */
export async function getActiveShareToken(
  businessId: string,
  type: ShareType,
  ref: RefWhere
) {
  const now = new Date();
  return prisma.shareToken.findFirst({
    where: {
      businessId,
      type,
      ...ref,
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true, token: true, expiresAt: true, createdAt: true },
  });
}

/**
 * Issue a fresh token for a document: revoke every currently-usable token
 * first so "regenerate" instantly invalidates old links.
 */
export async function issueShareToken(
  businessId: string,
  type: ShareType,
  ref: RefWhere,
  expiresAt: Date | null
) {
  const now = new Date();
  await prisma.shareToken.updateMany({
    where: {
      businessId,
      type,
      ...ref,
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    data: { revokedAt: now },
  });
  return prisma.shareToken.create({
    data: {
      token: newShareTokenValue(),
      type,
      businessId,
      invoiceId: 'invoiceId' in ref ? ref.invoiceId : null,
      quoteId: 'quoteId' in ref ? ref.quoteId : null,
      expiresAt,
    },
    select: { id: true, token: true, expiresAt: true, createdAt: true },
  });
}

/** Revoke every usable token for a document. Business-scoped. */
export async function revokeShareTokens(
  businessId: string,
  type: ShareType,
  ref: RefWhere
) {
  const now = new Date();
  const res = await prisma.shareToken.updateMany({
    where: {
      businessId,
      type,
      ...ref,
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    data: { revokedAt: now },
  });
  return res.count;
}

/**
 * Set (or clear) the expiry of one token. Business-scoped: a business can
 * only touch its own tokens.
 */
export async function setShareTokenExpiry(
  businessId: string,
  tokenId: string,
  expiresAt: Date | null
) {
  const rec = await prisma.shareToken.findFirst({
    where: { id: tokenId, businessId },
    select: { id: true },
  });
  if (!rec) return null;
  return prisma.shareToken.update({
    where: { id: tokenId, businessId },
    data: { expiresAt },
    select: { id: true, token: true, expiresAt: true, createdAt: true },
  });
}

/**
 * Resolve a public token to its document. Returns the token row when it is
 * usable; otherwise a reason the page can turn into a friendly message.
 * NEVER leaks document data on failure — the caller decides what to show.
 */
export async function resolveShareToken(token: string, type: ShareType) {
  if (!token || token.length > 128) return { ok: false as const };
  // Public entry point: the 256-bit token IS the authorization. The
  // business is learned from the resolved row, so no tenant scope can
  // exist before this lookup; the caller must verify active/usability
  // (revokedAt/expiresAt) before using the result.
  const rec = await unsafeUnscoped('share:resolveShareToken', () =>
    prisma.shareToken.findUnique({
      where: { token, type },
      select: {
        id: true,
        businessId: true,
        invoiceId: true,
        quoteId: true,
        revokedAt: true,
        expiresAt: true,
      },
    })
  );
  if (!rec || !isTokenActive(rec)) return { ok: false as const };
  return { ok: true as const, rec };
}
