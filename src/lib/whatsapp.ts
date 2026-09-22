/**
 * WhatsApp deep-link helpers (free, no API key).
 *
 * These only build `https://wa.me/...` links. Nothing is ever sent
 * automatically — the user taps the link and sends from their own
 * WhatsApp app.
 */

const COUNTRY_CODES: Record<string, string> = {
  IN: '91',
  CA: '1',
};

/** Default country calling code for a business region code. */
export function countryCodeForRegion(regionCode?: string | null): string {
  const code = (regionCode ?? 'IN').toUpperCase();
  return COUNTRY_CODES[code] ?? '91';
}

/**
 * Normalize a phone number for wa.me: strip every non-digit, and if the
 * number looks local (10 digits without a country code), prepend the
 * default country code for the business region (91 for IN, 1 for CA).
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
