/**
 * Platform-level transactional email (password resets, welcome emails,
 * pro-initiated quote/invoice sends).
 *
 * Uses the platform's own RESEND_API_KEY (Resend free tier: 3,000 emails /
 * month — plenty for 1–5 person shops, $0 forever). This is deliberately
 * separate from the per-business MessagingConnection path in engine.ts:
 * these emails must work out of the box with zero per-business setup,
 * which is exactly the founder's "no email ever arrives" complaint.
 *
 * Every send degrades gracefully when RESEND_API_KEY is missing: the skip
 * is logged server-side and the caller gets an honest
 * { ok: false, notConfigured: true } — never a throw, never a fake success.
 * `fetchFn` is injectable so tests run with zero live provider calls.
 */
import { sendResendEmail, type SendResult } from './providers.ts';

export interface PlatformEmailResult {
  ok: boolean;
  /** True when the send was skipped because email isn't configured. */
  notConfigured?: boolean;
  error?: string;
}

/** Sender address. Override with PLATFORM_EMAIL_FROM when the verified Resend domain differs. */
const FROM_ADDRESS = process.env.PLATFORM_EMAIL_FROM?.trim() || 'noreply@everyjob.ca';

export async function sendPlatformEmail(
  to: string,
  subject: string,
  textBody: string,
  opts?: { fromName?: string; fetchFn?: typeof fetch }
): Promise<PlatformEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.warn('[platform-email] skipped — RESEND_API_KEY is not set');
    return {
      ok: false,
      notConfigured: true,
      error: 'Email is not configured yet.',
    };
  }
  let result: SendResult;
  try {
    result = await sendResendEmail(
      {
        fromName: opts?.fromName ?? 'EveryJob',
        fromAddress: FROM_ADDRESS,
        apiKey,
      },
      to,
      subject,
      textBody,
      opts?.fetchFn ?? fetch
    );
  } catch (err) {
    console.error('[platform-email] unexpected send failure', err);
    return { ok: false, error: 'Email could not be sent.' };
  }
  if (result.ok) return { ok: true };
  return { ok: false, error: result.error ?? 'Email could not be sent.' };
}
