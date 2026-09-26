/**
 * Track 9 — automated messaging engine (server-only).
 *
 * Evaluates per-business automation triggers (appointment reminders, invoice
 * due/overdue, quote follow-up, review requests) and sends via the
 * free-quota-first providers. Guardrails, in order, for every candidate:
 *
 *   1. CASL consent — no opt-in, no send (logged BLOCKED_NO_CONSENT).
 *   2. Quiet hours (business timezone) — deferred, retried next cycle.
 *   3. Provider connected for the candidate's channel — else FAILED.
 *   4. Quota — HARD STOP at the free limit (logged BLOCKED_QUOTA, owner
 *      notified in-app). The engine cannot silently incur charges.
 *   5. dryRun — preview mode logs DRY_RUN rows and sends nothing.
 *
 * Idempotency: MessageLog.eventKey is unique per (business, eventKey) for
 * terminal sends; a candidate whose key already has a SENT (or permanently
 * FAILED) row is never re-evaluated.
 */

import { prisma } from '@/lib/prisma';
import {
  buildMessageCandidates,
  isQuietHour,
  type MessageCandidate,
  type AutomationToggles,
  type SchedJob,
  type SchedInvoice,
  type SchedQuote,
} from './scheduler.ts';
import { renderTemplate, type MsgLocale, type RenderedTemplate } from './templates.ts';
import { canSendMessage, type MessageChannel } from './consent.ts';
import { monthKeyInTimezone, dayKeyInTimezone, quotaAllows } from './quota.ts';
import { decryptSecret } from './crypto.ts';
import {
  sendWhatsAppText,
  sendResendEmail,
  type SendResult,
} from './providers.ts';
import { normalizeWaDigits } from '../reminders.ts';

/** SendErrorKinds that will never succeed on retry (don't re-attempt). */
const PERMANENT_KINDS = new Set([
  'auth',
  'template_required',
  'invalid_recipient',
  'sms_disabled',
  'unknown',
]);

const REMINDER_JOB_STATUSES = ['NEW', 'SCHEDULED', 'IN PROGRESS'];
const UNPAID_STATUSES = ['UNPAID', 'PARTIALLY PAID'];

export interface CycleItem {
  template: string;
  channel: string;
  customerName: string;
  status: string;
  detail?: string;
}

export interface CycleReport {
  dryRun: boolean;
  evaluated: number;
  sent: number;
  failed: number;
  blockedQuota: number;
  blockedConsent: number;
  blockedNoContact: number;
  deferredQuietHours: number;
  dryRunLogged: number;
  quotaExhausted: boolean;
  quota: {
    month: string;
    whatsappUsed: number;
    whatsappLimit: number;
    emailUsed: number;
    emailLimit: number;
    emailDayUsed: number;
    emailDayLimit: number;
  };
  items: CycleItem[];
}

interface EngineSettings {
  toggles: AutomationToggles;
  quietStartHour: number;
  quietEndHour: number;
  dryRun: boolean;
  whatsappLimit: number;
  emailLimit: number;
  emailDailyLimit: number;
}

async function getOrCreateSettings(businessId: string) {
  const existing = await prisma.messagingSettings.findUnique({ where: { businessId } });
  if (existing) return existing;
  return prisma.messagingSettings.create({ data: { businessId } });
}

function toToggles(s: {
  reminder24h: boolean;
  reminderDayOf: boolean;
  invoiceDue: boolean;
  invoiceOverdue: boolean;
  quoteFollowup: boolean;
  reviewRequest: boolean;
}): AutomationToggles {
  return { ...s };
}

function localeOf(preferred: string | null | undefined): MsgLocale {
  return preferred === 'fr' ? 'fr' : 'en';
}

/** Decrypt a stored provider secret; null when missing or undecryptable. */
function secretOf(stored: string | null | undefined): string | null {
  try {
    return decryptSecret(stored);
  } catch {
    return null;
  }
}

interface QuotaReservation {
  channel: MessageChannel;
  quotaId: string;
  businessId: string;
  monthLimit: number;
  /** Email only: business-local day key + daily cap (Resend free tier). */
  dayKey?: string;
  dayLimit?: number;
}

/**
 * Atomically reserve one quota unit BEFORE the provider call. Returns true
 * when the unit was reserved (counters incremented), false when the free
 * limit is already exhausted. The conditional updateMany is a single atomic
 * statement, so concurrent cycles cannot overshoot the limit.
 */
async function reserveQuota(r: QuotaReservation): Promise<boolean> {
  if (r.channel === 'WHATSAPP') {
    const res = await prisma.messageQuota.updateMany({
      where: { id: r.quotaId, businessId: r.businessId, whatsappCount: { lt: r.monthLimit } },
      data: { whatsappCount: { increment: 1 } },
    });
    return res.count === 1;
  }
  const res = await prisma.messageQuota.updateMany({
    where: {
      id: r.quotaId,
      businessId: r.businessId,
      emailDay: r.dayKey,
      emailDayCount: { lt: r.dayLimit ?? 0 },
      emailCount: { lt: r.monthLimit },
    },
    data: { emailCount: { increment: 1 }, emailDayCount: { increment: 1 } },
  });
  return res.count === 1;
}

type ConnRow = {
  channel: string;
  waPhoneNumberId: string | null;
  waAccessToken: string | null;
  emailFromName: string | null;
  emailFromAddress: string | null;
  emailApiKey: string | null;
};

/** True when the connection exists and holds usable (decryptable) credentials. */
function connReady(channel: MessageChannel, conn: ConnRow | undefined): boolean {
  if (!conn) return false;
  if (channel === 'WHATSAPP') {
    return !!conn.waPhoneNumberId && !!secretOf(conn.waAccessToken);
  }
  return !!conn.emailFromAddress && !!secretOf(conn.emailApiKey);
}

interface SendAttemptInput {
  candidate: MessageCandidate;
  rendered: RenderedTemplate;
  businessId: string;
  quotaId: string;
  month: string;
  dayKey: string;
  settings: EngineSettings;
  getConn: (channel: MessageChannel) => ConnRow | undefined;
  report: CycleReport;
}

interface SendAttemptOutcome {
  sentChannel: MessageChannel | null;
  quotaBlocked: boolean;
  providerQuotaHit: boolean;
  /** True when the failure will never succeed on retry (auth, template, bad recipient…). */
  permanent?: boolean;
  detail?: string;
}

/**
 * Send one message attempt on a single channel: reserve quota atomically,
 * then call the provider. Returns a structured outcome; the caller decides
 * whether to try the fallback channel.
 */
async function sendOnChannel(
  input: SendAttemptInput,
  channel: MessageChannel,
  eventKey: string
): Promise<SendAttemptOutcome> {
  const { candidate, rendered, businessId, quotaId, month, dayKey, settings, getConn, report } = input;
  const conn = getConn(channel);
  if (!connReady(channel, conn)) {
    await prisma.messageLog.create({
      data: {
        type: channel,
        recipient: channel === 'WHATSAPP' ? candidate.toPhone ?? '' : candidate.toEmail ?? '',
        content: '', status: 'FAILED',
        customerId: candidate.customerId, template: candidate.template,
        locale: candidate.locale, eventKey,
        error: '[unknown] No connected provider for this channel.',
        businessId,
      },
    });
    return {
      sentChannel: null, quotaBlocked: false, providerQuotaHit: false,
      detail: `No ${channel === 'WHATSAPP' ? 'WhatsApp' : 'email'} connection. Connect one in Settings → Messaging.`,
    };
  }

  const reserved = await reserveQuota({
    channel,
    quotaId,
    businessId,
    monthLimit: channel === 'WHATSAPP' ? settings.whatsappLimit : settings.emailLimit,
    dayKey,
    dayLimit: settings.emailDailyLimit,
  });
  if (!reserved) {
    const limit = channel === 'WHATSAPP' ? settings.whatsappLimit : settings.emailLimit;
    const scope = channel === 'WHATSAPP' ? 'Monthly' : 'Monthly/daily';
    await prisma.messageLog.create({
      data: {
        type: channel,
        recipient: channel === 'WHATSAPP' ? candidate.toPhone ?? '' : candidate.toEmail ?? '',
        content: '', status: 'BLOCKED_QUOTA',
        customerId: candidate.customerId, template: candidate.template,
        locale: candidate.locale, eventKey,
        error: `[quota] Free quota exhausted (${scope} limit ${limit}).`,
        businessId,
      },
    });
    await prisma.messageQuota.update({
      where: { id: quotaId, businessId },
      data: { blockedCount: { increment: 1 } },
    });
    if (channel === 'WHATSAPP') report.quota.whatsappUsed++;
    else {
      report.quota.emailUsed++;
      report.quota.emailDayUsed++;
    }
    return {
      sentChannel: null, quotaBlocked: true, providerQuotaHit: false,
      detail: `Free quota exhausted (${channel === 'WHATSAPP' ? 'WhatsApp' : 'email'} ${scope.toLowerCase()} limit ${limit}).`,
    };
  }
  // Keep the report counters in sync with the atomic reservation.
  if (channel === 'WHATSAPP') {
    report.quota.whatsappUsed++;
  } else {
    report.quota.emailUsed++;
    report.quota.emailDayUsed++;
  }

  const recipient =
    channel === 'WHATSAPP' ? normalizeWaDigits(candidate.toPhone) : (candidate.toEmail ?? '').trim();

  let result: SendResult;
  if (channel === 'WHATSAPP') {
    result = await sendWhatsAppText(
      {
        phoneNumberId: conn!.waPhoneNumberId!,
        accessToken: secretOf(conn!.waAccessToken)!,
      },
      recipient,
      rendered.body
    );
  } else {
    result = await sendResendEmail(
      {
        fromName: conn!.emailFromName,
        fromAddress: conn!.emailFromAddress!,
        apiKey: secretOf(conn!.emailApiKey)!,
      },
      recipient,
      rendered.subject,
      rendered.body
    );
  }

  if (result.ok) {
    await prisma.messageLog.create({
      data: {
        type: channel, recipient, content: rendered.body, status: 'SENT',
        customerId: candidate.customerId, template: candidate.template,
        locale: candidate.locale, eventKey, providerMessageId: result.providerMessageId,
        businessId,
      },
    });
    return { sentChannel: channel, quotaBlocked: false, providerQuotaHit: false };
  }

  const kind = result.errorKind ?? 'unknown';
  await prisma.messageLog.create({
    data: {
      type: channel, recipient, content: rendered.body, status: 'FAILED',
      customerId: candidate.customerId, template: candidate.template,
      locale: candidate.locale, eventKey, error: `[${kind}] ${result.error ?? 'Send failed.'}`,
      businessId,
    },
  });
  return {
    sentChannel: null,
    quotaBlocked: false,
    providerQuotaHit: kind === 'quota',
    permanent: PERMANENT_KINDS.has(kind),
    detail: result.error ?? undefined,
  };
}

/**
 * Primary channel first; on missing provider or a permanent provider failure
 * (e.g. WhatsApp template_required outside the 24h service window), try the
 * other channel as a free fallback when contact info and a connection exist.
 * Quota is reserved per attempt, so the fallback never exceeds the free limit.
 */
async function sendCandidateWithFallback(
  input: SendAttemptInput
): Promise<SendAttemptOutcome> {
  const { candidate, getConn } = input;
  const primary = candidate.channel;
  const fallback: MessageChannel = primary === 'WHATSAPP' ? 'EMAIL' : 'WHATSAPP';

  const first = await sendOnChannel(input, primary, candidate.eventKey);
  if (first.sentChannel) return first;

  const noProvider = !!first.detail?.startsWith('No ');
  const failedPermanently = !first.quotaBlocked && !first.sentChannel && first.permanent === true;
  if (!noProvider && !failedPermanently) return first;

  const hasFallbackContact = fallback === 'WHATSAPP' ? !!candidate.toPhone : !!candidate.toEmail;
  if (!hasFallbackContact || !connReady(fallback, getConn(fallback))) return first;

  const second = await sendOnChannel(
    input,
    fallback,
    `${candidate.eventKey}:${fallback.toLowerCase()}-fallback`
  );
  // If the fallback also fails, surface the more informative detail.
  if (second.sentChannel) return second;
  return {
    sentChannel: null,
    quotaBlocked: first.quotaBlocked || second.quotaBlocked,
    providerQuotaHit: first.providerQuotaHit || second.providerQuotaHit,
    detail: second.detail ?? first.detail,
  };
}

/**
 * Run one messaging cycle for a business. When `dryRunOverride` is set it
 * wins over the stored setting (used by the "Preview" button).
 */
export async function runMessagingCycle(
  businessId: string,
  opts?: { dryRunOverride?: boolean }
): Promise<CycleReport> {
  const now = new Date();
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, name: true, timezone: true },
  });
  if (!business) throw new Error('Business not found.');

  const timeZone = business.timezone || 'America/Toronto';
  const settingsRow = await getOrCreateSettings(businessId);
  const dryRun = opts?.dryRunOverride ?? settingsRow.dryRun;
  const settings: EngineSettings = {
    toggles: toToggles(settingsRow),
    quietStartHour: settingsRow.quietStartHour,
    quietEndHour: settingsRow.quietEndHour,
    dryRun,
    whatsappLimit: settingsRow.whatsappLimit,
    emailLimit: settingsRow.emailLimit,
    emailDailyLimit: settingsRow.emailDailyLimit,
  };

  const connections = await prisma.messagingConnection.findMany({
    where: { businessId, enabled: true },
  });
  const getConn = (channel: MessageChannel): ConnRow | undefined =>
    connections.find((c) => c.channel === channel);

  const month = monthKeyInTimezone(now, timeZone);
  const dayKey = dayKeyInTimezone(now, timeZone);
  const quotaRow = await prisma.messageQuota.upsert({
    where: { businessId_month: { businessId, month } },
    create: { businessId, month, emailDay: dayKey, emailDayCount: 0 },
    update: {},
  });
  // Roll the daily email counter when the business-local day changed. The
  // conditional update keeps it idempotent under concurrent cycles.
  if (quotaRow.emailDay !== dayKey) {
    await prisma.messageQuota.updateMany({
      where: { id: quotaRow.id, businessId, emailDay: { not: dayKey } },
      data: { emailDay: dayKey, emailDayCount: 0 },
    });
  }
  const quota = await prisma.messageQuota.findUniqueOrThrow({ where: { id: quotaRow.id, businessId } });

  // Idempotency: keys already terminally handled (SENT, or FAILED with a
  // permanent error kind — transient network/quota failures retry).
  const terminalRows = await prisma.messageLog.findMany({
    where: { businessId, eventKey: { not: null } },
    select: { eventKey: true, status: true, error: true },
  });
  const alreadySentKeys = new Set<string>();
  for (const r of terminalRows) {
    if (!r.eventKey) continue;
    if (r.status === 'SENT') {
      alreadySentKeys.add(r.eventKey);
      continue;
    }
    // FAILED: only terminal when the error kind is permanent.
    const kind = /^\[([a-z_]+)\]/.exec(r.error ?? '')?.[1];
    if (kind && PERMANENT_KINDS.has(kind)) alreadySentKeys.add(r.eventKey);
  }

  // ---- gather source rows ----
  const jobs = await prisma.job.findMany({
    where: {
      businessId,
      OR: [
        { status: { in: REMINDER_JOB_STATUSES } },
        { status: 'COMPLETED', date: { gte: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000) } },
      ],
    },
    select: {
      id: true, title: true, date: true, time: true, status: true,
      customerId: true,
      customer: { select: { name: true, phone: true, phoneNorm: true, email: true, messageConsent: true, preferredLocale: true } },
    },
    take: 500,
  });
  const invoices = await prisma.invoice.findMany({
    where: { businessId, status: { in: UNPAID_STATUSES } },
    select: {
      id: true, number: true, total: true, date: true, status: true,
      customerId: true,
      customer: { select: { name: true, phone: true, phoneNorm: true, email: true, messageConsent: true, preferredLocale: true } },
    },
    take: 500,
  });
  const quotes = await prisma.quote.findMany({
    where: {
      businessId,
      status: 'SENT',
      createdAt: { gte: new Date(now.getTime() - 9 * 24 * 60 * 60 * 1000) },
    },
    select: {
      id: true, number: true, total: true, status: true, createdAt: true,
      customerId: true,
      customer: { select: { name: true, phone: true, phoneNorm: true, email: true, messageConsent: true, preferredLocale: true } },
    },
    take: 500,
  });

  const toSchedJob = (j: (typeof jobs)[number]): SchedJob => ({
    id: j.id, title: j.title, date: j.date, time: j.time, status: j.status,
    customerId: j.customerId, customerName: j.customer.name,
    phone: j.customer.phoneNorm || j.customer.phone,
    email: j.customer.email,
    consent: j.customer.messageConsent,
    locale: localeOf(j.customer.preferredLocale),
  });
  const toSchedInvoice = (i: (typeof invoices)[number]): SchedInvoice => ({
    id: i.id, number: i.number, total: i.total, date: i.date, status: i.status,
    customerId: i.customerId, customerName: i.customer.name,
    phone: i.customer.phoneNorm || i.customer.phone,
    email: i.customer.email,
    consent: i.customer.messageConsent,
    locale: localeOf(i.customer.preferredLocale),
  });
  const toSchedQuote = (q: (typeof quotes)[number]): SchedQuote => ({
    id: q.id, number: q.number, total: q.total, status: q.status, createdAt: q.createdAt,
    customerId: q.customerId, customerName: q.customer.name,
    phone: q.customer.phoneNorm || q.customer.phone,
    email: q.customer.email,
    consent: q.customer.messageConsent,
    locale: localeOf(q.customer.preferredLocale),
  });

  // Existing public pay links for invoices (only already-issued tokens — the
  // cycle never mints new public URLs on its own).
  const shareTokens = await prisma.shareToken.findMany({
    where: { businessId, type: 'INVOICE', revokedAt: null, invoiceId: { not: null } },
    select: { token: true, invoiceId: true, expiresAt: true },
  });
  const baseUrl = process.env.APP_BASE_URL ?? '';
  const payLinkFor = (invoiceId: string): string | null => {
    const t = shareTokens.find(
      (s) => s.invoiceId === invoiceId && (!s.expiresAt || s.expiresAt > now)
    );
    if (!t || !baseUrl) return null;
    return `${baseUrl}/i/${t.token}`;
  };

  const candidates = buildMessageCandidates({
    now,
    timeZone,
    toggles: settings.toggles,
    jobs: jobs.map(toSchedJob),
    invoices: invoices.map(toSchedInvoice),
    quotes: quotes.map(toSchedQuote),
    alreadySentKeys,
    businessName: business.name,
    payLinkFor,
  });

  const report: CycleReport = {
    dryRun,
    evaluated: candidates.length,
    sent: 0,
    failed: 0,
    blockedQuota: 0,
    blockedConsent: 0,
    blockedNoContact: 0,
    deferredQuietHours: 0,
    dryRunLogged: 0,
    quotaExhausted: false,
    quota: {
      month,
      whatsappUsed: quota.whatsappCount,
      whatsappLimit: settings.whatsappLimit,
      emailUsed: quota.emailCount,
      emailLimit: settings.emailLimit,
      emailDayUsed: quota.emailDay === dayKey ? quota.emailDayCount : 0,
      emailDayLimit: settings.emailDailyLimit,
    },
    items: [],
  };

  const quietNow = isQuietHour(now, timeZone, settings.quietStartHour, settings.quietEndHour);

  for (const c of candidates) {
    const item: CycleItem = {
      template: c.template,
      channel: c.channel,
      customerName: c.customerName,
      status: 'PENDING',
    };

    // 1. Consent (CASL) — checked against the primary channel's contact.
    const hasPrimaryContact = c.channel === 'WHATSAPP' ? !!c.toPhone : !!c.toEmail;
    const consent = jobs
      .concat()
      .find((j) => j.customerId === c.customerId)?.customer.messageConsent
      ?? invoices.find((i) => i.customerId === c.customerId)?.customer.messageConsent
      ?? quotes.find((q) => q.customerId === c.customerId)?.customer.messageConsent
      ?? false;
    if (!canSendMessage({ consent, channel: c.channel, hasContact: hasPrimaryContact })) {
      const reason = !hasPrimaryContact ? 'BLOCKED_NO_CONTACT' : 'BLOCKED_NO_CONSENT';
      await prisma.messageLog.create({
        data: {
          type: c.channel, recipient: c.channel === 'WHATSAPP' ? c.toPhone ?? '' : c.toEmail ?? '',
          content: '', status: reason === 'BLOCKED_NO_CONTACT' ? 'BLOCKED_NO_CONSENT' : reason,
          customerId: c.customerId, template: c.template, locale: c.locale,
          eventKey: c.eventKey, error: reason, businessId,
        },
      });
      if (!hasPrimaryContact) report.blockedNoContact++;
      else report.blockedConsent++;
      item.status = reason;
      item.detail = !hasPrimaryContact ? 'No phone/email on file.' : 'Customer has not opted in.';
      report.items.push(item);
      continue;
    }

    // 2. Quiet hours — deferred, retried next cycle (no terminal row written).
    if (quietNow) {
      report.deferredQuietHours++;
      item.status = 'DEFERRED_QUIET_HOURS';
      item.detail = `Quiet hours (${settings.quietStartHour}:00–${settings.quietEndHour}:00 ${timeZone}). Will retry next cycle.`;
      report.items.push(item);
      continue;
    }

    // 3. Render.
    const rendered = renderTemplate(c.template, c.locale, c.params);

    // 4. Dry run — log the preview, send nothing (no quota reserved).
    if (dryRun) {
      const recipient = c.channel === 'WHATSAPP' ? normalizeWaDigits(c.toPhone) : (c.toEmail ?? '').trim();
      await prisma.messageLog.create({
        data: {
          type: c.channel, recipient, content: rendered.body, status: 'DRY_RUN',
          customerId: c.customerId, template: c.template, locale: c.locale,
          eventKey: c.eventKey, businessId,
        },
      });
      report.dryRunLogged++;
      item.status = 'DRY_RUN';
      item.detail = rendered.body.slice(0, 160);
      report.items.push(item);
      continue;
    }

    // 5. Send — primary channel first, then the other channel as a free
    // fallback (e.g. WhatsApp is rejected outside the 24h service window
    // with template_required → email). Each attempt atomically reserves one
    // quota unit BEFORE the provider call, so concurrent cycles can never
    // push usage past the free limit.
    const outcome = await sendCandidateWithFallback({
      candidate: c,
      rendered,
      businessId,
      quotaId: quotaRow.id,
      month,
      dayKey,
      settings,
      getConn,
      report,
    });
    if (outcome.sentChannel) {
      report.sent++;
      item.channel = outcome.sentChannel;
      item.status = 'SENT';
      if (outcome.sentChannel !== c.channel) {
        item.detail = `Sent via ${outcome.sentChannel === 'EMAIL' ? 'email' : 'WhatsApp'} fallback.`;
      }
    } else if (outcome.quotaBlocked) {
      report.blockedQuota++;
      report.quotaExhausted = true;
      item.status = 'BLOCKED_QUOTA';
      item.detail = outcome.detail;
    } else {
      report.failed++;
      item.status = 'FAILED';
      item.detail = outcome.detail;
    }
    if (outcome.providerQuotaHit) report.quotaExhausted = true;
    report.items.push(item);
  }

  // Owner notice when the free quota is exhausted (at most one in-app notice
  // per 24h so the inbox isn't spammed every cycle).
  if (report.quotaExhausted) {
    const last = settingsRow.quotaNotifiedAt;
    if (!last || now.getTime() - last.getTime() > 24 * 60 * 60 * 1000) {
      await prisma.notification.create({
        data: {
          businessId,
          type: 'messaging_quota',
          dedupeKey: `messaging_quota:${month}`,
          href: '/settings/messaging',
          data: JSON.stringify({
            month,
            whatsappUsed: String(report.quota.whatsappUsed),
            whatsappLimit: String(report.quota.whatsappLimit),
            emailUsed: String(report.quota.emailUsed),
            emailLimit: String(report.quota.emailLimit),
          }),
        },
      }).catch(() => undefined); // dedupe race: notice already exists
      await prisma.messagingSettings.update({
        where: { businessId },
        data: { quotaNotifiedAt: now },
      });
    }
  }

  return report;
}

/** Lightweight quota + settings snapshot for the settings UI. */
export async function getMessagingOverview(businessId: string) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { timezone: true },
  });
  const timeZone = business?.timezone || 'America/Toronto';
  const settings = await getOrCreateSettings(businessId);
  const now = new Date();
  const month = monthKeyInTimezone(now, timeZone);
  const dayKey = dayKeyInTimezone(now, timeZone);
  const quota = await prisma.messageQuota.upsert({
    where: { businessId_month: { businessId, month } },
    create: { businessId, month, emailDay: dayKey, emailDayCount: 0 },
    update: {},
  });
  const connections = await prisma.messagingConnection.findMany({ where: { businessId } });
  // Secrets are encrypted at rest — never reveal even a suffix of the
  // ciphertext; presence alone is shown in the UI.
  const secretBadge = (s: string | null | undefined) => (s ? '••••••' : null);
  return {
    settings: {
      reminder24h: settings.reminder24h,
      reminderDayOf: settings.reminderDayOf,
      invoiceDue: settings.invoiceDue,
      invoiceOverdue: settings.invoiceOverdue,
      quoteFollowup: settings.quoteFollowup,
      reviewRequest: settings.reviewRequest,
      quietStartHour: settings.quietStartHour,
      quietEndHour: settings.quietEndHour,
      dryRun: settings.dryRun,
      whatsappLimit: settings.whatsappLimit,
      emailLimit: settings.emailLimit,
      emailDailyLimit: settings.emailDailyLimit,
    },
    quota: {
      month,
      whatsappUsed: quota.whatsappCount,
      whatsappLimit: settings.whatsappLimit,
      emailUsed: quota.emailCount,
      emailLimit: settings.emailLimit,
      emailDayUsed: quota.emailDay === dayKey ? quota.emailDayCount : 0,
      emailDayLimit: settings.emailDailyLimit,
      blockedCount: quota.blockedCount,
    },
    whatsapp: (() => {
      const c = connections.find((x) => x.channel === 'WHATSAPP');
      return c
        ? {
            connected: true, enabled: c.enabled, verifiedAt: c.verifiedAt,
            displayNumber: c.waDisplayNumber, phoneNumberId: c.waPhoneNumberId,
            hasToken: !!c.waAccessToken, tokenMasked: secretBadge(c.waAccessToken),
          }
        : { connected: false };
    })(),
    email: (() => {
      const c = connections.find((x) => x.channel === 'EMAIL');
      return c
        ? {
            connected: true, enabled: c.enabled, verifiedAt: c.verifiedAt,
            fromName: c.emailFromName, fromAddress: c.emailFromAddress,
            hasKey: !!c.emailApiKey, keyMasked: secretBadge(c.emailApiKey),
          }
        : { connected: false };
    })(),
  };
}

/** Recent message log rows for the audit view (tenant-scoped). */
export async function listMessageLog(businessId: string, limit = 50) {
  const rows = await prisma.messageLog.findMany({
    where: { businessId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true, type: true, direction: true, recipient: true, status: true,
      template: true, locale: true, error: true, createdAt: true,
      customer: { select: { name: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    direction: r.direction,
    recipient: r.type === 'WHATSAPP' ? maskRecipient(r.recipient) : r.recipient,
    status: r.status,
    template: r.template,
    locale: r.locale,
    error: r.error,
    customerName: r.customer?.name ?? null,
    createdAt: r.createdAt.toISOString(),
  }));
}

/** Mask phone digits in the audit view (privacy). */
function maskRecipient(recipient: string): string {
  const digits = recipient.replace(/\D/g, '');
  if (digits.length <= 4) return recipient;
  return `••••${digits.slice(-4)}`;
}

export type { MessageCandidate };
