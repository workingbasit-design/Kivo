/**
 * In-house error logging + alerting (Prompt 3, B9).
 *
 * No Sentry (decision pending - see SECURITY_REPORT.md). Errors are grouped
 * by fingerprint, counted, and PII-scrubbed before storage. A cron
 * (`/api/cron/error-alerts`) calls `checkAlertThresholds()` and notifies the
 * owner (in-app Notification) when a threshold trips - once per incident,
 * not once per error.
 *
 * PII scrubbing: emails, bearer-ish tokens, Stripe-style secrets, and long
 * hex/base64 blobs are redacted from messages and stacks. Reuses the
 * key-based rules from the audit scrubber conceptually, applied to free text.
 */
import { createHash } from 'node:crypto';
import { prisma } from './prisma.ts';

export type ErrorKind = 'error' | 'login_failure' | 'webhook_failure' | 'export_spike';

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const SECRET_PREFIX_RE = /\b(sk_(live|test)_[A-Za-z0-9]+|whsec_[A-Za-z0-9]+|xox[bap]-[A-Za-z0-9-]+|ghp_[A-Za-z0-9]+|gsk_[A-Za-z0-9]+)\b/g;
const BEARER_RE = /\b(Bearer\s+)[A-Za-z0-9\-_~+/.]+=*(\s|$)/gi;
const LONG_BLOB_RE = /\b[A-Za-z0-9+/=_-]{32,}\b/g;

/** Scrub PII/secrets from free text (error messages, stacks). Pure. */
export function scrubText(s: string): string {
  return s
    .replace(EMAIL_RE, '[email]')
    .replace(SECRET_PREFIX_RE, '[secret]')
    .replace(BEARER_RE, '$1[secret]$2')
    .replace(LONG_BLOB_RE, (m) => {
      // Keep short readable tokens (cuid ids are 25 chars - those are fine
      // to keep for debugging; only redact very long opaque blobs).
      return m.length >= 48 ? '[blob]' : m;
    });
}

/** Fingerprint: hash of the normalized first line + top stack frame. Pure. */
export function fingerprintFor(message: string, stack?: string): string {
  const firstLine = message.split('\n')[0].slice(0, 200);
  const topFrame = (stack ?? '').split('\n').slice(0, 3).join('\n').replace(/:\d+:\d+/g, '');
  return createHash('sha256').update(`${firstLine}\n${topFrame}`, 'utf8').digest('hex').slice(0, 32);
}

export interface ReportErrorInput {
  error: unknown;
  kind?: ErrorKind;
  route?: string;
  businessId?: string;
  userId?: string;
}

/**
 * Record an error (or security-relevant event). Never throws - logging must
 * not break the request it observes.
 */
export async function reportError(input: ReportErrorInput): Promise<void> {
  try {
    const message =
      input.error instanceof Error ? input.error.message : String(input.error ?? 'Unknown error');
    const stack = input.error instanceof Error ? input.error.stack : undefined;
    const fingerprint = fingerprintFor(message, stack);
    const kind = input.kind ?? 'error';
    const cleanMessage = scrubText(message).slice(0, 1000);
    const cleanStack = stack ? scrubText(stack).slice(0, 4000) : null;
    const existing = await prisma.errorLog.findFirst({
      where: { fingerprint, kind },
      select: { id: true },
    });
    if (existing) {
      await prisma.errorLog.update({
        where: { id: existing.id },
        data: { count: { increment: 1 }, lastSeen: new Date() },
      });
      return;
    }
    await prisma.errorLog.create({
      data: {
        fingerprint,
        kind,
        message: cleanMessage,
        stack: cleanStack,
        route: input.route,
        businessId: input.businessId,
        userId: input.userId,
      },
    });
  } catch {
    // Logging must never throw.
  }
}

/** Convenience: record a failed login for the brute-force alert. */
export async function reportLoginFailure(ip: string, email: string): Promise<void> {
  // The email is hashed into the fingerprint only - never stored raw.
  const fp = createHash('sha256').update(`login:${ip}`, 'utf8').digest('hex').slice(0, 32);
  try {
    const existing = await prisma.errorLog.findFirst({
      where: { fingerprint: fp, kind: 'login_failure' },
      select: { id: true },
    });
    if (existing) {
      await prisma.errorLog.update({
        where: { id: existing.id },
        data: { count: { increment: 1 }, lastSeen: new Date() },
      });
      return;
    }
    await prisma.errorLog.create({
      data: { fingerprint: fp, kind: 'login_failure', message: `Failed logins from ${ip}`, route: '/login' },
    });
  } catch {
    // never throws
  }
}

export interface AlertCheck {
  key: string;
  businessId?: string;
  detail: string;
}

/**
 * Evaluate alert thresholds. Pure-ish: takes counts, returns the alerts that
 * should fire. The cron wires the DB queries; this function is unit-testable.
 */
export function evaluateThresholds(input: {
  errorsLast10Min: number;
  loginFailuresByIp: Array<{ ip: string; count: number }>;
  webhookEndpointFailures: Array<{ endpointId: string; businessId: string; consecutiveFailures: number }>;
  exportCountsByBusiness: Array<{ businessId: string; count: number }>;
}): AlertCheck[] {
  const alerts: AlertCheck[] = [];
  if (input.errorsLast10Min > 10) {
    alerts.push({
      key: 'error-spike',
      detail: `${input.errorsLast10Min} server errors in the last 10 minutes.`,
    });
  }
  for (const { ip, count } of input.loginFailuresByIp) {
    if (count > 20) {
      alerts.push({ key: `login-failures:${ip}`, detail: `${count} failed logins from ${ip} in 10 minutes.` });
    }
  }
  for (const { endpointId, businessId, consecutiveFailures } of input.webhookEndpointFailures) {
    if (consecutiveFailures >= 3) {
      alerts.push({
        key: `webhook-failures:${endpointId}`,
        businessId,
        detail: `Webhook endpoint ${endpointId} failed ${consecutiveFailures} times in a row.`,
      });
    }
  }
  for (const { businessId, count } of input.exportCountsByBusiness) {
    if (count > 3) {
      alerts.push({
        key: `export-volume:${businessId}`,
        businessId,
        detail: `${count} data exports in 24h - unusual volume.`,
      });
    }
  }
  return alerts;
}
