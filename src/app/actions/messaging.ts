'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { encryptSecret } from '@/lib/messaging/crypto';
import { rateLimit, ACTION_LIMIT } from '@/lib/rate-limit';
import {
  runMessagingCycle,
  getMessagingOverview,
  listMessageLog,
} from '@/lib/messaging/engine';
import { clientIpFromHeaders } from '@/lib/client-ip';

export type ActionResult = { error?: string; ok?: boolean };

async function clientKey(prefix: string): Promise<string> {
  const h = await headers();
  const ip = clientIpFromHeaders(h);
  return `${prefix}:${ip}`;
}

function checkLimit(key: string): ActionResult | null {
  const rl = rateLimit(key, ACTION_LIMIT);
  if (!rl.ok) {
    const secs = Math.max(1, Math.ceil(rl.retryAfterMs / 1000));
    return { error: `Too many requests. Try again in ${secs}s.` };
  }
  return null;
}

const TOGGLES = [
  'reminder24h',
  'reminderDayOf',
  'invoiceDue',
  'invoiceOverdue',
  'quoteFollowup',
  'reviewRequest',
] as const;

/** Dashboard snapshot for Settings → Messaging (secrets masked). */
export async function getMessagingDashboard() {
  const { businessId } = await requireAuth();
  const [overview, log] = await Promise.all([
    getMessagingOverview(businessId),
    listMessageLog(businessId, 50),
  ]);
  return { ...overview, log };
}

/** Save automation toggles, quiet hours, dry-run and quota caps. */
export async function saveMessagingSettingsAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const limited = checkLimit(await clientKey('messaging:settings'));
  if (limited) return limited;
  let businessId: string;
  try {
    ({ businessId } = await requireAuth());
  } catch {
    return { error: 'Please log in again.' };
  }

  const data: Record<string, boolean | number> = {};
  for (const key of TOGGLES) data[key] = formData.get(key) === 'on';
  const quietStart = Number(formData.get('quietStartHour') ?? 21);
  const quietEnd = Number(formData.get('quietEndHour') ?? 8);
  if (
    !Number.isInteger(quietStart) || !Number.isInteger(quietEnd) ||
    quietStart < 0 || quietStart > 23 || quietEnd < 0 || quietEnd > 23
  ) {
    return { error: 'Quiet hours must be whole hours between 0 and 23.' };
  }
  data.quietStartHour = quietStart;
  data.quietEndHour = quietEnd;
  data.dryRun = formData.get('dryRun') === 'on';

  await prisma.messagingSettings.upsert({
    where: { businessId },
    create: { businessId, ...data },
    update: data,
  });
  revalidatePath('/settings/messaging');
  return { ok: true };
}

/** Verify a WhatsApp Cloud API token against Meta, then save the connection. */
export async function connectWhatsAppAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const limited = checkLimit(await clientKey('messaging:connect'));
  if (limited) return limited;
  let businessId: string;
  try {
    ({ businessId } = await requireAuth());
  } catch {
    return { error: 'Please log in again.' };
  }

  const phoneNumberId = String(formData.get('phoneNumberId') ?? '').trim();
  const accessToken = String(formData.get('accessToken') ?? '').trim();
  const displayNumber = String(formData.get('displayNumber') ?? '').trim() || null;
  const businessAcctId = String(formData.get('businessAccountId') ?? '').trim() || null;
  if (!phoneNumberId || !accessToken) {
    return { error: 'Phone number ID and access token are both required.' };
  }
  if (phoneNumberId.length > 64 || accessToken.length > 512) {
    return { error: 'Invalid connection details.' };
  }

  // Verify against Meta before saving (read-only check, nothing is sent).
  let verifiedNumber: string | null = null;
  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${encodeURIComponent(phoneNumberId)}?fields=display_phone_number`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      return {
        error: `Meta rejected these credentials: ${body.error?.message ?? `HTTP ${res.status}`}. Check the token and phone number ID.`,
      };
    }
    const payload = (await res.json()) as { display_phone_number?: string };
    verifiedNumber = payload.display_phone_number ?? null;
  } catch {
    return { error: 'Could not reach Meta to verify. Check your connection and try again.' };
  }

  await prisma.messagingConnection.upsert({
    where: { businessId_channel: { businessId, channel: 'WHATSAPP' } },
    create: {
      businessId, channel: 'WHATSAPP', provider: 'META_WHATSAPP',
      waPhoneNumberId: phoneNumberId, waAccessToken: encryptSecret(accessToken),
      waBusinessAcctId: businessAcctId,
      waDisplayNumber: displayNumber ?? verifiedNumber,
      enabled: true, verifiedAt: new Date(),
    },
    update: {
      provider: 'META_WHATSAPP',
      waPhoneNumberId: phoneNumberId, waAccessToken: encryptSecret(accessToken),
      waBusinessAcctId: businessAcctId,
      waDisplayNumber: displayNumber ?? verifiedNumber,
      enabled: true, verifiedAt: new Date(),
    },
  });
  revalidatePath('/settings/messaging');
  return { ok: true };
}

/** Save the Resend (transactional email) connection after verifying the key. */
export async function connectEmailAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const limited = checkLimit(await clientKey('messaging:connect'));
  if (limited) return limited;
  let businessId: string;
  try {
    ({ businessId } = await requireAuth());
  } catch {
    return { error: 'Please log in again.' };
  }

  const fromName = String(formData.get('fromName') ?? '').trim() || null;
  const fromAddress = String(formData.get('fromAddress') ?? '').trim();
  const apiKey = String(formData.get('apiKey') ?? '').trim();
  if (!fromAddress || !apiKey) {
    return { error: 'From address and API key are both required.' };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromAddress)) {
    return { error: 'That from address does not look like a valid email.' };
  }

  // Verify the key with a read-only call (nothing is sent).
  try {
    const res = await fetch('https://api.resend.com/domains', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (res.status === 401 || res.status === 403) {
      return { error: 'Resend rejected this API key. Check it and try again.' };
    }
  } catch {
    return { error: 'Could not reach Resend to verify. Check your connection and try again.' };
  }

  await prisma.messagingConnection.upsert({
    where: { businessId_channel: { businessId, channel: 'EMAIL' } },
    create: {
      businessId, channel: 'EMAIL', provider: 'RESEND',
      emailFromName: fromName, emailFromAddress: fromAddress, emailApiKey: encryptSecret(apiKey),
      enabled: true, verifiedAt: new Date(),
    },
    update: {
      provider: 'RESEND',
      emailFromName: fromName, emailFromAddress: fromAddress, emailApiKey: encryptSecret(apiKey),
      enabled: true, verifiedAt: new Date(),
    },
  });
  revalidatePath('/settings/messaging');
  return { ok: true };
}

/** Disconnect a channel (deletes the stored secret). */
export async function disconnectChannelAction(channel: string): Promise<ActionResult> {
  const limited = checkLimit(await clientKey('messaging:connect'));
  if (limited) return limited;
  let businessId: string;
  try {
    ({ businessId } = await requireAuth());
  } catch {
    return { error: 'Please log in again.' };
  }
  if (channel !== 'WHATSAPP' && channel !== 'EMAIL') return { error: 'Unknown channel.' };
  await prisma.messagingConnection.deleteMany({ where: { businessId, channel } });
  revalidatePath('/settings/messaging');
  return { ok: true };
}

/**
 * Set a customer's CASL opt-in/out from the owner UI. Every change is written
 * to the ConsentLog audit trail.
 */
export async function setCustomerConsentAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const limited = checkLimit(await clientKey('messaging:consent'));
  if (limited) return limited;
  let businessId: string;
  try {
    ({ businessId } = await requireAuth());
  } catch {
    return { error: 'Please log in again.' };
  }
  const customerId = String(formData.get('customerId') ?? '');
  const consent = formData.get('consent') === 'on';
  const localeRaw = String(formData.get('preferredLocale') ?? '');
  const preferredLocale = localeRaw === 'en' || localeRaw === 'fr' ? localeRaw : null;
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, businessId },
    select: { id: true },
  });
  if (!customer) return { error: 'Customer not found.' };

  const now = new Date();
  await prisma.$transaction([
    prisma.customer.update({
      where: { id: customerId, businessId },
      data: {
        messageConsent: consent,
        messageConsentAt: now,
        messageConsentSource: 'settings-ui',
        preferredLocale,
      },
    }),
    prisma.consentLog.create({
      data: {
        businessId, customerId,
        channel: 'WHATSAPP',
        action: consent ? 'OPT_IN' : 'OPT_OUT',
        source: 'settings-ui',
      },
    }),
  ]);
  revalidatePath(`/customers/${customerId}`);
  revalidatePath('/customers');
  return { ok: true };
}

/** Dry-run preview: evaluate triggers and log DRY_RUN rows; sends nothing. */
export async function previewMessagingAction(): Promise<{
  ok: boolean;
  error?: string;
  report?: Awaited<ReturnType<typeof runMessagingCycle>>;
}> {
  const limited = checkLimit(await clientKey('messaging:run'));
  if (limited) return { ok: false, error: limited.error };
  let businessId: string;
  try {
    ({ businessId } = await requireAuth());
  } catch {
    return { ok: false, error: 'Please log in again.' };
  }
  const report = await runMessagingCycle(businessId, { dryRunOverride: true });
  revalidatePath('/settings/messaging');
  return { ok: true, report };
}

/**
 * Run the automation cycle now. Respects the stored dryRun flag: when preview
 * mode is on, this only logs a preview — nothing is sent.
 */
export async function runMessagingNowAction(): Promise<{
  ok: boolean;
  error?: string;
  report?: Awaited<ReturnType<typeof runMessagingCycle>>;
}> {
  const limited = checkLimit(await clientKey('messaging:run'));
  if (limited) return { ok: false, error: limited.error };
  let businessId: string;
  try {
    ({ businessId } = await requireAuth());
  } catch {
    return { ok: false, error: 'Please log in again.' };
  }
  const report = await runMessagingCycle(businessId);
  revalidatePath('/settings/messaging');
  return { ok: true, report };
}
