/**
 * AuditEvent writer (Prompt 3, M5).
 *
 * Every consequential action writes one row in the SAME transaction as the
 * action it logs. Rows are append-only (DB trigger rejects UPDATE/DELETE).
 * beforeJson/afterJson snapshots go through the secrets scrubber: keys
 * matching *token*|*secret*|*password*|*key*|*hash* (case-insensitive) and
 * any value that looks like a bearer token are replaced with [REDACTED].
 */
import type { Prisma, PrismaClient } from '@prisma/client';

export const AUDIT_ACTOR_TYPES = ['USER', 'SYSTEM', 'WEBHOOK', 'COPILOT'] as const;
export type AuditActorType = (typeof AUDIT_ACTOR_TYPES)[number];

export const AUDIT_ACTIONS = [
  'MONEY_CREATE',
  'MONEY_UPDATE',
  'MONEY_VOID',
  'INVOICE_SEND',
  'PAYMENT_RECORD',
  'PAYMENT_VOID',
  'CREDIT_NOTE_CREATE',
  'DELETE',
  'ARCHIVE',
  'RESTORE',
  'ROLE_CHANGE',
  'TEAM_INVITE',
  'TEAM_REMOVE',
  'SETTINGS_CHANGE',
  'PAYOUT_EVENT',
  'WEBHOOK_EVENT',
  'COPILOT_ACTION',
  'LOGIN',
  'LOGOUT',
  'PASSWORD_CHANGE',
  'EXPORT',
  'IMPORT',
  'CONSENT_CHANGE',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

const REDACTED = '[REDACTED]';
const SENSITIVE_KEY = /(token|secret|password|passwd|pwd|api[-_]?key|private[-_]?key|access[-_]?key|hash|bearer|credential|session)/i;
// Looks like a bearer token / opaque credential: long base64url-ish blob.
const BEARER_LIKE = /^[A-Za-z0-9\-_]{16,}(\.[A-Za-z0-9\-_]{8,}){0,2}$/;

function scrubValue(key: string, value: unknown): unknown {
  if (typeof value === 'string') {
    if (SENSITIVE_KEY.test(key)) return REDACTED;
    if (BEARER_LIKE.test(value)) return REDACTED;
    return value;
  }
  if (Array.isArray(value)) return value.map((v) => scrubValue(key, v));
  if (value && typeof value === 'object') return scrubObject(value as Record<string, unknown>);
  return value;
}

export function scrubObject(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) out[k] = scrubValue(k, v);
  return out;
}

export function scrubJson(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'object') return JSON.stringify(scrubObject(value as Record<string, unknown>));
  return JSON.stringify(value);
}

export interface AuditEventInput {
  businessId: string;
  actorId: string; // User.id or 'system'
  actorType: AuditActorType;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
  userAgent?: string | null;
}

type AuditCapable = Pick<PrismaClient, 'auditEvent'> | Pick<Prisma.TransactionClient, 'auditEvent'>;

/**
 * Write one audit row. `db` is the transaction the logged action runs in
 * (or the base client for non-transactional callers) — the audit row must
 * commit or roll back together with the action.
 */
export async function writeAuditEvent(
  db: AuditCapable,
  input: AuditEventInput
): Promise<void> {
  await db.auditEvent.create({
    data: {
      businessId: input.businessId,
      actorId: input.actorId,
      actorType: input.actorType,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      beforeJson: scrubJson(input.before),
      afterJson: scrubJson(input.after),
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
    },
  });
}
