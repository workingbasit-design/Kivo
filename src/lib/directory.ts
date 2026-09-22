import { headers } from 'next/headers';
import { validatePhone } from './phone';

/**
 * Shared helpers for the public Kivo Directory (customer-discovery layer).
 *
 * Tenant-safety rule: every public query MUST filter `directoryOptIn: true`
 * and select only the fields a stranger is allowed to see. Never expose
 * emails, customer lists, jobs, invoices, or exact addresses of businesses
 * that hid them.
 */

/** Best-effort client IP for public rate limiting. */
export async function publicClientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    h.get('x-real-ip') ||
    'unknown'
  );
}

/**
 * Extract a displayable locality ("Andheri West, Mumbai") from a free-text
 * address ("Shop 12, MG Road, Andheri West, Mumbai 400053").
 * Heuristic: last two comma-separated segments, minus any trailing pincode.
 */
export function localityFromAddress(address: string | null | undefined): string | null {
  if (!address) return null;
  const parts = address
    .split(',')
    .map((p) => p.trim().replace(/\b\d{5,6}\b/g, '').trim())
    .filter(Boolean);
  if (parts.length === 0) return null;
  return parts.slice(-2).join(', ');
}

/** Super-admin gate for the directory reports list (KIVO_ADMIN_EMAILS env, comma-separated). */
export function isDirectoryAdminEmail(email: string | null | undefined): boolean {
  const allow = (process.env.KIVO_ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (allow.length === 0) return false;
  return !!email && allow.includes(email.toLowerCase());
}

/** Phone-verified badge: business phone or WhatsApp number validates. */
export function isPhoneVerified(
  phone: string | null | undefined,
  whatsappNumber: string | null | undefined,
  regionCode?: string | null
): boolean {
  const p = validatePhone(phone, regionCode);
  if (p.ok && p.digits) return true;
  const w = validatePhone(whatsappNumber, regionCode);
  return w.ok && !!w.digits;
}

/** Normalize a search string for loose matching. */
export function norm(s: string | null | undefined): string {
  return (s ?? '').toLowerCase().trim();
}

/**
 * Does a business match a service keyword? Matches against the business
 * name and its price-book service names (all lowercased beforehand).
 */
export function matchesServiceKeyword(
  keyword: string,
  businessName: string,
  serviceNames: string[]
): boolean {
  const k = norm(keyword);
  if (!k) return true;
  const words = k.split(/\s+/).filter(Boolean);
  const hay = `${norm(businessName)} ${serviceNames.map(norm).join(' ')}`;
  return words.every((w) => hay.includes(w));
}

/** Does a business serve a city? Loose match against the address text. */
export function matchesCity(city: string, address: string | null | undefined): boolean {
  const c = norm(city);
  if (!c) return true;
  return norm(address).includes(c);
}

export type DirectoryBusiness = {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  phone: string | null;
  whatsappNumber: string | null;
  workingHours: string | null;
  regionCode: string;
  currency: string;
  directoryHideAddress: boolean;
  services: { id: string; name: string; price: number }[];
  reviewCount: number;
  avgRating: number | null;
};

/** Aggregate rating from a business's reviews. */
export function ratingSummary(reviews: { rating: number }[]): {
  count: number;
  avg: number | null;
} {
  if (reviews.length === 0) return { count: 0, avg: null };
  const sum = reviews.reduce((a, r) => a + r.rating, 0);
  return { count: reviews.length, avg: Math.round((sum / reviews.length) * 10) / 10 };
}
