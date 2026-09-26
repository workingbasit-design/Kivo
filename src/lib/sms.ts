/**
 * Free SMS deep-link helpers (user-controlled, $0 forever).
 *
 * There is no genuine free server-side SMS API for Canada: carrier
 * email-to-SMS gateways were retired (Bell shut theirs down 2025-12-31),
 * and "free" APIs cap out at ~1 message/day. So — exactly like the wa.me
 * WhatsApp buttons — these only build native `sms:` links. The user taps
 * the button, their phone's SMS app opens with the message prefilled, and
 * they send it from their own mobile plan. EveryJob never sends anything
 * automatically and spends nothing.
 *
 * Platform note: iOS expects `sms:<number>&body=<text>` while Android
 * expects `sms:<number>?body=<text>`. The caller (client component)
 * detects the platform; this module just builds the right shape.
 */
import { normalizePhone } from './whatsapp.ts';

/**
 * Build a native SMS deep link with a prefilled message.
 * Returns an empty string when there is no usable phone number.
 */
export function smsLink(
  phone: string | null | undefined,
  message: string,
  regionCode?: string | null,
  isIos = false
): string {
  if (!phone) return '';
  const digits = normalizePhone(phone, regionCode);
  if (!digits) return '';
  const sep = isIos ? '&' : '?';
  return `sms:+${digits}${sep}body=${encodeURIComponent(message)}`;
}
