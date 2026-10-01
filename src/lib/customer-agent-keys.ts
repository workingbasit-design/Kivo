/**
 * Customer-scoped agent keys ("Connect your AI assistant").
 *
 * A logged-in customer generates a key in their profile and pastes it
 * into their AI assistant. The assistant can then search the directory
 * and propose quote requests AS that customer — identity comes from the
 * key, never from re-typed form fields. Keys can propose only; every
 * proposal still needs the human's one-tap confirmation.
 *
 * Security properties (mirrors src/lib/apiKeys.ts):
 * - Only the SHA-256 hash is stored (keyHash, unique); plaintext is
 *   returned ONCE at creation and never again.
 * - Keys are revocable from the profile; revoked keys fail closed.
 * - A key can only PROPOSE actions; every proposal still needs the
 *   human's one-tap confirmation before anything executes.
 * - Per-key rate limiting on top of per-IP limits.
 */
import { prisma } from '@/lib/prisma';
import { rateLimit, ACTION_LIMIT } from '@/lib/rate-limit';
import { unsafeUnscoped } from './tenant-guard.ts';
import {
  AGENT_KEY_PREFIX,
  generateAgentKey,
  hashAgentKey,
  parseAgentScopes,
  keyHasScope,
  type AgentScope,
} from './agent-protocol.ts';

export type VerifiedCustomerAgentKey = {
  keyId: string;
  customerId: string;
  scopes: AgentScope[];
  customer: {
    id: string;
    name: string | null;
    phone: string | null;
    email: string;
    city: string | null;
  };
};

/**
 * Verify a presented customer agent key. Returns null for unknown,
 * malformed, or revoked keys. Touches lastUsedAt best-effort.
 * Identity-root lookup via unsafeUnscoped (the key IS the credential).
 */
export async function verifyCustomerAgentKey(key: string): Promise<VerifiedCustomerAgentKey | null> {
  if (!key || !key.startsWith(AGENT_KEY_PREFIX)) return null;
  const rec = await unsafeUnscoped('agentKeys:verifyCustomerAgentKey', (db) =>
    db.customerAgentKey.findUnique({
      where: { keyHash: hashAgentKey(key) },
      select: {
        id: true,
        customerId: true,
        scopes: true,
        revokedAt: true,
        customer: { select: { id: true, name: true, phone: true, email: true, city: true } },
      },
    })
  );
  if (!rec || rec.revokedAt) return null;
  try {
    await prisma.customerAgentKey.update({
      where: { id: rec.id, customerId: rec.customerId },
      data: { lastUsedAt: new Date() },
    });
  } catch {
    /* usage stamp is best-effort */
  }
  return {
    keyId: rec.id,
    customerId: rec.customerId,
    scopes: parseAgentScopes(rec.scopes),
    customer: rec.customer,
  };
}

/** `write` implies `read`; `read` never implies `write`. Pure. */
export function customerKeyHasScope(v: VerifiedCustomerAgentKey, need: AgentScope): boolean {
  return keyHasScope(v.scopes, need);
}

export type CustomerAgentAuthResult =
  | { ok: true; key: VerifiedCustomerAgentKey }
  | { ok: false; status: 401 | 429; error: string }
  | { ok: true; key: null }; // anonymous — allowed for read/propose, identity must come from the body

/**
 * Authenticate an agent-protocol request. Unlike the business v1 API,
 * anonymous access is allowed (the protocol is public); write actions by
 * anonymous agents additionally require a contact email in the body and
 * ALWAYS require human confirmation. Returns key: null for anonymous.
 */
export async function authenticateAgentRequest(req: Request): Promise<CustomerAgentAuthResult> {
  const header = req.headers.get('authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match) return { ok: true, key: null };
  const verified = await verifyCustomerAgentKey(match[1].trim());
  if (!verified) {
    return {
      ok: false,
      status: 401,
      error: 'Invalid agent key. Generate a new one in your EveryJob customer profile.',
    };
  }
  const rl = rateLimit(`agent:${verified.keyId}`, ACTION_LIMIT);
  if (!rl.ok) {
    return { ok: false, status: 429, error: 'Too many requests. Please slow down.' };
  }
  return { ok: true, key: verified };
}

/** Create a key record for a customer; returns the row plus plaintext (once). */
export async function createCustomerAgentKey(
  customerId: string,
  label: string
): Promise<{ id: string; label: string; keyPrefix: string; key: string; createdAt: Date }> {
  const clean = label.trim().slice(0, 60) || 'AI assistant';
  const { key, keyHash, keyPrefix } = generateAgentKey();
  const rec = await prisma.customerAgentKey.create({
    data: { customerId, label: clean, keyHash, keyPrefix, scopes: 'read,write' },
    select: { id: true, label: true, keyPrefix: true, createdAt: true },
  });
  return { ...rec, key };
}

/** Revoke a key (customer-owned). Returns true when a row was revoked. */
export async function revokeCustomerAgentKey(customerId: string, keyId: string): Promise<boolean> {
  const res = await prisma.customerAgentKey.updateMany({
    where: { id: keyId, customerId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return res.count > 0;
}

/** List a customer's keys (newest first), never exposing hashes. */
export async function listCustomerAgentKeys(customerId: string) {
  return prisma.customerAgentKey.findMany({
    where: { customerId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      label: true,
      keyPrefix: true,
      scopes: true,
      createdAt: true,
      lastUsedAt: true,
      revokedAt: true,
    },
  });
}
