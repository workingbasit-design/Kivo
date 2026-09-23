/**
 * Track 9 — outbound messaging providers (free-quota-first).
 *
 * WhatsApp Cloud API (Meta) is the primary channel; transactional email via
 * Resend is the fallback. SMS has NO genuine free tier, so it exists only as
 * a disabled stub that explains why — the system never sends paid SMS.
 *
 * IMPORTANT WhatsApp caveat: Meta only delivers free-form text inside the
 * 24-hour customer-service window, and since 2026-10-01 those service
 * messages count against the number's 1,000/month free tier (billed
 * per-message after that — our quota hard-stop means we never reach the
 * paid tier). Business-initiated notifications (like reminders) outside the
 * window require a Meta-approved *utility template*; otherwise the API
 * rejects the send with a template error, which we classify as
 * 'template_required' so the owner knows what to fix in their Meta dashboard.
 * Source: https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing
 *
 * Secrets (tokens/keys) are passed in by the caller and NEVER logged here.
 * `fetchFn` is injectable so tests run with zero live provider calls.
 */

export type ProviderChannel = 'WHATSAPP' | 'EMAIL';

export type SendErrorKind =
  | 'quota'
  | 'auth'
  | 'template_required'
  | 'invalid_recipient'
  | 'network'
  | 'sms_disabled'
  | 'unknown';

export interface SendResult {
  ok: boolean;
  providerMessageId?: string;
  error?: string;
  errorKind?: SendErrorKind;
  /** Whether the caller should retry later (vs. a permanent failure). */
  retryable?: boolean;
}

export interface WhatsAppCredentials {
  phoneNumberId: string;
  accessToken: string;
}

export interface EmailCredentials {
  fromName: string | null;
  fromAddress: string;
  apiKey: string;
}

type FetchFn = typeof fetch;

const WA_API_VERSION = 'v21.0';

interface WhatsAppSuccess {
  messages?: Array<{ id?: string }>;
}
interface WhatsAppFailure {
  error?: { message?: string; code?: number; error_subcode?: number };
}

/**
 * Send a WhatsApp text message via the Cloud API.
 * `to` must be digits only (country code included).
 */
export async function sendWhatsAppText(
  creds: WhatsAppCredentials,
  to: string,
  body: string,
  fetchFn: FetchFn = fetch
): Promise<SendResult> {
  const url = `https://graph.facebook.com/${WA_API_VERSION}/${encodeURIComponent(
    creds.phoneNumberId
  )}/messages`;
  let res: Response;
  try {
    res = await fetchFn(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${creds.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { preview_url: false, body },
      }),
    });
  } catch (err) {
    return {
      ok: false,
      errorKind: 'network',
      retryable: true,
      error: err instanceof Error ? err.message : 'Network error calling WhatsApp API.',
    };
  }

  let payload: WhatsAppSuccess & WhatsAppFailure = {};
  try {
    payload = (await res.json()) as WhatsAppSuccess & WhatsAppFailure;
  } catch {
    // Non-JSON response: treat by status code.
  }

  if (res.ok) {
    const id = payload.messages?.[0]?.id;
    return { ok: true, providerMessageId: id };
  }

  const code = payload.error?.code;
  const message = payload.error?.message ?? `WhatsApp API error (HTTP ${res.status}).`;
  // Meta error codes: 190/102 = auth; 131000-ish/template errors (e.g. 132000
  // "template name does not exist", 133000s) = template required; 131026 etc
  // = invalid recipient. 80007/rate-limit-ish = quota-ish throttling.
  if (code === 190 || code === 102 || res.status === 401 || res.status === 403) {
    return { ok: false, errorKind: 'auth', error: message };
  }
  if (code === 131026 || code === 131030 || res.status === 400) {
    // 400 from Meta on message sends is most often "template required for
    // business-initiated message outside the 24h window".
    const kind: SendErrorKind =
      /template/i.test(message) || code === 132000 ? 'template_required' : 'invalid_recipient';
    return { ok: false, errorKind: kind, error: message };
  }
  if (res.status === 429 || code === 80007) {
    return { ok: false, errorKind: 'quota', retryable: true, error: message };
  }
  if (res.status >= 500) {
    return { ok: false, errorKind: 'network', retryable: true, error: message };
  }
  return { ok: false, errorKind: 'unknown', error: message };
}

interface ResendSuccess {
  id?: string;
}
interface ResendFailure {
  message?: string;
  name?: string;
}

/**
 * Send a transactional email via Resend (free tier). `to` is a single address.
 */
export async function sendResendEmail(
  creds: EmailCredentials,
  to: string,
  subject: string,
  textBody: string,
  fetchFn: FetchFn = fetch
): Promise<SendResult> {
  const from = creds.fromName
    ? `${creds.fromName} <${creds.fromAddress}>`
    : creds.fromAddress;
  let res: Response;
  try {
    res = await fetchFn('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${creds.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to: [to], subject, text: textBody }),
    });
  } catch (err) {
    return {
      ok: false,
      errorKind: 'network',
      retryable: true,
      error: err instanceof Error ? err.message : 'Network error calling Resend API.',
    };
  }

  let payload: ResendSuccess & ResendFailure = {};
  try {
    payload = (await res.json()) as ResendSuccess & ResendFailure;
  } catch {
    // fall through to status-code handling
  }

  if (res.ok) return { ok: true, providerMessageId: payload.id };

  const message = payload.message ?? `Resend API error (HTTP ${res.status}).`;
  if (res.status === 401 || res.status === 403) {
    return { ok: false, errorKind: 'auth', error: message };
  }
  if (res.status === 429) {
    return { ok: false, errorKind: 'quota', retryable: true, error: message };
  }
  if (res.status >= 500) {
    return { ok: false, errorKind: 'network', retryable: true, error: message };
  }
  return { ok: false, errorKind: 'unknown', error: message };
}

/**
 * SMS has no genuine free tier (Twilio etc. are paid/trial-credit only), so
 * automated SMS is intentionally unavailable. This stub exists so call sites
 * get a plain-language explanation instead of a silent failure or — worse —
 * a paid default.
 */
export function sendSmsDisabled(): SendResult {
  return {
    ok: false,
    errorKind: 'sms_disabled',
    error:
      'Automated SMS is disabled: there is no free SMS tier, and EveryJob will not silently spend money. Use WhatsApp or email instead.',
  };
}
