/**
 * EveryJob Sign — free e-signature for quotes.
 *
 * Mirrors the customer-portal token pattern in src/lib/portal.ts:
 * signing links carry a raw token that is stored only as a SHA-256 hash,
 * so anyone who can read the database still cannot mint a working signing
 * URL. Lookup hashes the presented token — invalid, expired, and revoked
 * links all resolve to the same "invalid or expired" outcome, so there is
 * no enumeration vector.
 *
 * Every write is tenant-scoped (businessId + quoteId): a signing request
 * can never escape its business or its quote. Regenerating a link revokes
 * any currently-active requests for the same quote, so only the newest
 * link works.
 *
 * Tamper evidence: at send time we hash a canonical JSON snapshot of the
 * quote (id, number, title, total, customerId, businessId). verifyDocHash()
 * recomputes that hash against the current quote — a mismatch means the
 * quote was edited after the link went out.
 */
import { createHash, randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';

export type SignFieldType = 'signature' | 'date' | 'initials';
export type SignField = { type: SignFieldType; x: number; y: number; page: number };
export type SignStatus = 'sent' | 'viewed' | 'signed' | 'declined' | 'expired' | 'revoked';
export type AuditEvent = 'sent' | 'viewed' | 'signed' | 'declined' | 'revoked';
export type AuditEntry = { event: AuditEvent; at: string; ip: string };

/** Terminal statuses — a request in one of these can never become signable again. */
const TERMINAL_STATUSES: ReadonlySet<string> = new Set([
  'signed',
  'declined',
  'revoked',
  'expired',
]);

export function newSignTokenValue(): string {
  return randomBytes(32).toString('hex');
}

export function hashSignToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** A request is signable when it is not revoked, not expired, and not in a terminal status. */
export function isSignRequestActive(rec: {
  revokedAt: Date | null;
  expiresAt: Date | null;
  status: string;
}): boolean {
  if (rec.revokedAt) return false;
  if (rec.expiresAt && rec.expiresAt.getTime() <= Date.now()) return false;
  if (TERMINAL_STATUSES.has(rec.status)) return false;
  return true;
}

/**
 * Pure audit-log append. auditJson is a JSON array of AuditEntry; returns
 * the updated JSON string. Kept pure (and exported) so the append/ordering
 * logic is unit-testable without a database.
 */
export function appendAudit(auditJson: string, event: AuditEvent, ip: string): string {
  let entries: AuditEntry[];
  try {
    const parsed: unknown = JSON.parse(auditJson);
    entries = Array.isArray(parsed) ? (parsed as AuditEntry[]) : [];
  } catch {
    entries = [];
  }
  entries.push({ event, at: new Date().toISOString(), ip });
  return JSON.stringify(entries);
}

/**
 * Canonical snapshot of a quote for tamper evidence. Keys are fixed in this
 * order so the JSON (and therefore the hash) is stable regardless of how
 * the quote object was constructed.
 */
export function signatureDocPayload(quote: {
  id: string;
  number: string;
  title: string;
  total: number;
  customerId: string;
  businessId: string;
}): { quoteId: string; number: string; title: string; total: number; customerId: string; businessId: string } {
  return {
    quoteId: quote.id,
    number: quote.number,
    title: quote.title,
    total: quote.total,
    customerId: quote.customerId,
    businessId: quote.businessId,
  };
}

/** SHA-256 of the canonical quote snapshot. Same quote → same hash, always. */
export function signatureDocHash(quote: {
  id: string;
  number: string;
  title: string;
  total: number;
  customerId: string;
  businessId: string;
}): string {
  return createHash('sha256')
    .update(JSON.stringify(signatureDocPayload(quote)), 'utf8')
    .digest('hex');
}

/**
 * Prisma `where` clause matching currently-usable signing requests for a
 * quote. Factored out (and exported) so tenant scoping — businessId AND
 * quoteId — is unit-testable. Used by issueSignatureRequest to invalidate
 * old links when a new one is issued.
 */
export function activeSignRequestFilter(businessId: string, quoteId: string, now = new Date()) {
  return {
    businessId,
    quoteId,
    revokedAt: null,
    status: { in: ['sent', 'viewed'] },
    OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
  };
}

export type ResolvedSignatureRequest = {
  id: string;
  status: string;
  fieldsJson: string;
  signerName: string | null;
  signerContact: string | null;
  docHash: string;
  signatureData: string | null;
  auditJson: string;
  expiresAt: Date | null;
  revokedAt: Date | null;
  signedAt: Date | null;
  quoteId: string;
  businessId: string;
  quote: {
    id: string;
    number: string;
    title: string;
    total: number;
    customerId: string;
    businessId: string;
    customer: { id: string; name: string; phone: string | null } | null;
  };
  business: { id: string; name: string };
};

/**
 * Issue a signing link for a quote. Verifies the quote belongs to the
 * business (throws otherwise), revokes any currently-active requests for
 * the same quote, snapshots the quote hash for tamper evidence, and
 * records a "sent" audit event. Returns the DB id plus the RAW token —
 * the only moment it exists outside a hash.
 */
export async function issueSignatureRequest(
  businessId: string,
  quoteId: string,
  fields: SignField[],
  signerContact: string | null,
  expiresAt: Date | null
): Promise<{ id: string; token: string; expiresAt: Date | null }> {
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, businessId },
    select: {
      id: true,
      number: true,
      title: true,
      total: true,
      customerId: true,
      businessId: true,
    },
  });
  if (!quote) throw new Error('Quote not found.');

  const now = new Date();
  // Regenerate semantics: only the newest link for a quote stays usable.
  await prisma.signatureRequest.updateMany({
    where: activeSignRequestFilter(businessId, quoteId, now),
    data: { revokedAt: now, status: 'revoked' },
  });

  const token = newSignTokenValue();
  const rec = await prisma.signatureRequest.create({
    data: {
      tokenHash: hashSignToken(token),
      status: 'sent',
      fieldsJson: JSON.stringify(fields),
      signerContact,
      docHash: signatureDocHash(quote),
      auditJson: appendAudit('[]', 'sent', 'owner'),
      expiresAt,
      quoteId: quote.id,
      businessId,
    },
    select: { id: true, expiresAt: true },
  });
  return { id: rec.id, token, expiresAt: rec.expiresAt };
}

/**
 * Resolve a presented signing-link token to its request, with the quote,
 * customer, and business selects the public signing page needs. Returns
 * null for ANY failure — unknown token, expired, revoked, or signed all
 * look identical to the caller ("link invalid or expired").
 */
export async function resolveSignatureRequest(
  token: string
): Promise<ResolvedSignatureRequest | null> {
  if (!token || token.length > 128) return null;
  const rec = await prisma.signatureRequest.findUnique({
    where: { tokenHash: hashSignToken(token) },
    select: {
      id: true,
      status: true,
      fieldsJson: true,
      signerName: true,
      signerContact: true,
      docHash: true,
      signatureData: true,
      auditJson: true,
      expiresAt: true,
      revokedAt: true,
      signedAt: true,
      quoteId: true,
      businessId: true,
      quote: {
        select: {
          id: true,
          number: true,
          title: true,
          total: true,
          customerId: true,
          businessId: true,
          customer: { select: { id: true, name: true, phone: true } },
        },
      },
      business: { select: { id: true, name: true } },
    },
  });
  if (!rec || !isSignRequestActive(rec)) return null;
  return rec;
}

/**
 * Revoke one signing request. Business-scoped — a business can only revoke
 * its own requests. Sets revokedAt + status and appends a "revoked" audit
 * event. Returns false when the request does not exist or is already revoked.
 */
export async function revokeSignatureRequest(
  businessId: string,
  requestId: string
): Promise<boolean> {
  const rec = await prisma.signatureRequest.findFirst({
    where: { id: requestId, businessId },
    select: { id: true, revokedAt: true, status: true, auditJson: true },
  });
  if (!rec || rec.revokedAt || rec.status === 'revoked') return false;
  await prisma.signatureRequest.update({
    where: { id: rec.id },
    data: {
      revokedAt: new Date(),
      status: 'revoked',
      auditJson: appendAudit(rec.auditJson, 'revoked', 'owner'),
    },
  });
  return true;
}

/**
 * Append an audit event to a request. Status only moves forward:
 * sent → viewed → signed (or → declined). Out-of-order events are still
 * recorded in the audit log but never move the status backwards — e.g. a
 * late "viewed" after "signed" stays logged without reopening the request.
 */
export async function appendAuditEvent(
  requestId: string,
  event: AuditEvent,
  ip: string
): Promise<void> {
  const rec = await prisma.signatureRequest.findUnique({
    where: { id: requestId },
    select: { id: true, status: true, auditJson: true },
  });
  if (!rec) return;
  const nextStatus = nextSignStatus(rec.status, event);
  await prisma.signatureRequest.update({
    where: { id: rec.id },
    data: {
      auditJson: appendAudit(rec.auditJson, event, ip),
      ...(nextStatus !== rec.status ? { status: nextStatus } : {}),
    },
  });
}

/** Forward-only status transition for an audit event; current status wins on conflict. */
export function nextSignStatus(current: string, event: AuditEvent): string {
  if (event === 'viewed' && current === 'sent') return 'viewed';
  if (event === 'signed' && (current === 'sent' || current === 'viewed')) return 'signed';
  if (event === 'declined' && (current === 'sent' || current === 'viewed')) return 'declined';
  return current;
}

/**
 * Record that the client opened the signing link. Only fires while the
 * request is still "sent" — repeat views (or views after signing) are
 * no-ops so the audit trail keeps exactly one first-view.
 */
export async function recordView(requestId: string, ip: string): Promise<boolean> {
  const rec = await prisma.signatureRequest.findUnique({
    where: { id: requestId },
    select: { id: true, status: true },
  });
  if (!rec || rec.status !== 'sent') return false;
  await appendAuditEvent(requestId, 'viewed', ip);
  return true;
}

/**
 * Submit the client's signature. Tenant-scoped via businessId. Validates
 * the request is still active, the signer name is non-empty, and signature
 * data is present. Throws on any validation failure. Returns the updated
 * record id.
 */
export async function submitSignature(
  requestId: string,
  businessId: string,
  opts: { signerName: string; signatureData: string }
): Promise<string> {
  const rec = await prisma.signatureRequest.findFirst({
    where: { id: requestId, businessId },
    select: {
      id: true,
      status: true,
      revokedAt: true,
      expiresAt: true,
      auditJson: true,
    },
  });
  if (!rec) throw new Error('Signature request not found.');
  if (!isSignRequestActive(rec)) throw new Error('This signing link is no longer active.');
  if (!opts.signerName || !opts.signerName.trim()) throw new Error('Signer name is required.');
  if (!opts.signatureData) throw new Error('Signature data is required.');

  const updated = await prisma.signatureRequest.update({
    where: { id: rec.id },
    data: {
      status: 'signed',
      signedAt: new Date(),
      signerName: opts.signerName.trim(),
      signatureData: opts.signatureData,
      auditJson: appendAudit(rec.auditJson, 'signed', 'client'),
    },
    select: { id: true },
  });
  return updated.id;
}

/**
 * Recompute the quote snapshot hash and compare it to the hash stored at
 * send time. False means the quote was edited after the signing link went
 * out — the UI should warn before letting anyone sign a changed document.
 */
export function verifyDocHash(request: {
  docHash: string;
  quote: {
    id: string;
    number: string;
    title: string;
    total: number;
    customerId: string;
    businessId: string;
  };
}): boolean {
  return signatureDocHash(request.quote) === request.docHash;
}
