/**
 * WhatsApp deep-link helpers (free, no API key).
 *
 * These only build `https://wa.me/...` links. Nothing is ever sent
 * automatically — the user taps the link and sends from their own
 * WhatsApp app.
 */

/** Default country calling code — Canada-only (NANP). */
export function countryCodeForRegion(_regionCode?: string | null): string {
  return '1';
}

/**
 * Normalize a phone number for wa.me: strip every non-digit, and if the
 * number looks local (10 digits without a country code), prepend the
 * default country code for Canada (1).
 */
export function normalizePhone(phone: string, regionCode?: string | null): string {
  const digits = (phone ?? '').replace(/\D/g, '');
  const code = countryCodeForRegion(regionCode);
  if (digits.length === 10 && !digits.startsWith(code)) {
    return code + digits;
  }
  return digits;
}

/**
 * Build a WhatsApp click-to-chat link with a prefilled message.
 * Returns an empty string when there is no usable phone number.
 */
export function waLink(
  phone: string | null | undefined,
  message: string,
  regionCode?: string | null
): string {
  if (!phone) return '';
  const digits = normalizePhone(phone, regionCode);
  if (!digits) return '';
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
