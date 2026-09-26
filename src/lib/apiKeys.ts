/**
 * Tenant API keys for the public EveryJob REST API (v1).
 *
 * Keys are generated as `ejk_live_<base64url>`; only the SHA-256 hash is
 * ever stored (keyHash, unique), plus the first 8 characters as an
 * identification prefix. The plaintext key is returned ONCE at creation and
 * never again — there is no way to read it back.
 *
 * Unlike Jobber (whose API is gated on the $149+/mo Grow plan), EveryJob
 * API access is free for every business on every plan.
 *
 * Pure helpers (generate/hash/parse) have no Next.js or DB imports and run
 * under plain node:test; verifyApiKey/authenticateV1Request touch Prisma.
 */
import { createHash, randomBytes } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { rateLimit, ACTION_LIMIT } from '@/lib/rate-limit';
import { unsafeUnscoped } from './tenant-guard.ts';

export const API_KEY_PREFIX = 'ejk_live_';
/** 32 random bytes → 43 base64url chars. Brute force is infeasible. */
const API_KEY_SECRET_BYTES = 32;

export type ApiScope = 'read' | 'write';

/** SHA-256 hex of the full key — what we store and look up. Pure. */
export function hashApiKey(key: string): string {
  return createHash('sha256').update(key, 'utf8').digest('hex');
}

/**
 * Generate a new key. Pure — no DB. Returns the plaintext key (show once),
 * its hash, and its identification prefix.
 */
export function generateApiKey(): { key: string; keyHash: string; keyPrefix: string } {
  const key = `${API_KEY_PREFIX}${randomBytes(API_KEY_SECRET_BYTES).toString('base64url')}`;
  return { key, keyHash: hashApiKey(key), keyPrefix: key.slice(0, 8) };
}

/** Parse a stored comma-separated scope string. Defaults to read-only. Pure. */
export function parseApiScopes(raw: string): ApiScope[] {
  const out: ApiScope[] = [];
  for (const s of raw.split(',').map((x) => x.trim().toLowerCase())) {
    if ((s === 'read' || s === 'write') && !out.includes(s)) out.push(s);
  }
  return out.length ? out : ['read'];
}

export type VerifiedApiKey = {
  keyId: string;
  businessId: string;
  scopes: ApiScope[];
};

/**
 * Verify a presented key against the stored hash. Returns null for unknown,
 * malformed, or revoked keys. Touches lastUsedAt best-effort (never fails
 * the request).
 */
export async function verifyApiKey(key: string): Promise<VerifiedApiKey | null> {
  if (!key || !key.startsWith(API_KEY_PREFIX)) return null;
  // Identity-root lookup: the presented key (hashed) IS the credential and
  // resolves the tenant — no business scope can exist before this query.
  // Revoked keys are rejected and unknown keys resolve to null, so there
  // is no enumeration vector.
  const rec = await unsafeUnscoped('apiKeys:verifyApiKey', () =>
    prisma.apiKey.findUnique({
      where: { keyHash: hashApiKey(key) },
      select: { id: true, businessId: true, scopes: true, revokedAt: true },
    })
  );
  if (!rec || rec.revokedAt) return null;
  try {
    await prisma.apiKey.update({
      where: { id: rec.id, businessId: rec.businessId },
      data: { lastUsedAt: new Date() },
    });
  } catch {
    /* usage stamp is best-effort */
  }
  return { keyId: rec.id, businessId: rec.businessId, scopes: parseApiScopes(rec.scopes) };
}

/** `write` implies `read`; `read` never implies `write`. Pure. */
export function hasScope(v: VerifiedApiKey, need: ApiScope): boolean {
  if (need === 'write') return v.scopes.includes('write');
  return v.scopes.includes('read') || v.scopes.includes('write');
}

export type V1AuthResult =
  | { ok: true; key: VerifiedApiKey }
  | { ok: false; status: 401 | 429; error: string };

/**
 * Authenticate a v1 API request: `Authorization: Bearer ejk_live_...`.
 * Rate-limited per key (120/min). The public API never touches sessions.
 */
export async function authenticateV1Request(req: Request): Promise<V1AuthResult> {
  const header = req.headers.get('authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  const verified = match ? await verifyApiKey(match[1].trim()) : null;
  if (!verified) {
    return {
      ok: false,
      status: 401,
      error: 'Invalid or missing API key. Send Authorization: Bearer ejk_live_...',
    };
  }
  const rl = rateLimit(`v1:${verified.keyId}`, ACTION_LIMIT);
  if (!rl.ok) {
    return { ok: false, status: 429, error: 'Too many requests. Please slow down.' };
  }
  return { ok: true, key: verified };
}

/**
 * Create a key record and return the row plus the plaintext key (once).
 * The plaintext is never persisted.
 */
export async function createApiKey(
  businessId: string,
  name: string,
  scopes: ApiScope[]
): Promise<{
  id: string;
  name: string;
  keyPrefix: string;
  scopes: ApiScope[];
  createdAt: Date;
  key: string;
}> {
  const clean = name.trim().slice(0, 60) || 'API key';
  const normalized: ApiScope[] = scopes.includes('write') ? ['write'] : ['read'];
  const { key, keyHash, keyPrefix } = generateApiKey();
  const rec = await prisma.apiKey.create({
    data: {
      businessId,
      name: clean,
      keyHash,
      keyPrefix,
      scopes: normalized.join(','),
    },
    select: { id: true, name: true, keyPrefix: true, scopes: true, createdAt: true },
  });
  return {
    id: rec.id,
    name: rec.name,
    keyPrefix: rec.keyPrefix,
    scopes: parseApiScopes(rec.scopes),
    createdAt: rec.createdAt,
    key,
  };
}
