import { randomBytes, createHash } from 'crypto';
import { prisma } from '@/lib/prisma';
import { unsafeUnscoped } from './tenant-guard.ts';

export type ShareType = 'QUOTE' | 'INVOICE';

/**
 * Capability tokens for the public quote/invoice portals.
 *
 * The public pages (/q/[token], /i/[token]) resolve ONLY through the
 * ShareToken table - a raw cuid id never renders a document. A token is
 * usable when revokedAt is null and (expiresAt is null or in the future).
 * Tokens are 256-bit random hex strings: unguessable and URL-safe.
 *
 * F1: The `token` column stores the SHA-256 hash of the raw token, never
 * the raw value. The raw token is only ever in the URL the business shares.
 * On lookup, the incoming token is hashed before the DB query.
 */

/** Generate a new unguessable token value. */
export function newShareTokenValue(): string {
  return randomBytes(32).toString('hex');
}

/** SHA-256 hash of a token for storage/lookup. */
export function hashShareToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
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
 * F1: Stores the SHA-256 hash, returns the raw token (only time it's visible).
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
  const rawToken = newShareTokenValue();
  const rec = await prisma.shareToken.create({
    data: {
      token: hashShareToken(rawToken),
      type,
      businessId,
      invoiceId: 'invoiceId' in ref ? ref.invoiceId : null,
      quoteId: 'quoteId' in ref ? ref.quoteId : null,
      expiresAt,
    },
    select: { id: true, expiresAt: true, createdAt: true },
  });
  // Return the raw token for the URL; the DB only has the hash.
  return { ...rec, token: rawToken };
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
 * NEVER leaks document data on failure - the caller decides what to show.
 * F1: The incoming raw token is hashed before lookup (DB stores hashes only).
 */
export async function resolveShareToken(token: string, type: ShareType) {
  if (!token || token.length > 128) return { ok: false as const };
  // Public entry point: the 256-bit token IS the authorization. The
  // business is learned from the resolved row, so no tenant scope can
  // exist before this lookup; the caller must verify active/usability
  // (revokedAt/expiresAt) before using the result.
  const tokenHash = hashShareToken(token);
  const rec = await unsafeUnscoped('share:resolveShareToken', (db) =>
    db.shareToken.findUnique({
      where: { token: tokenHash, type },
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
