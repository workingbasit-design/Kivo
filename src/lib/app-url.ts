/**
 * Absolute base URL for links inside emails (password resets, quote/invoice
 * sends). Prefers the explicit APP_BASE_URL env var (same convention as the
 * messaging engine), then falls back to the request host.
 *
 * Kept in its own module (instead of platform-email.ts) because it imports
 * next/headers, which cannot load under plain node --test.
 */
import { headers } from 'next/headers';

export async function appBaseUrl(): Promise<string> {
  const fromEnv = process.env.APP_BASE_URL?.trim().replace(/\/+$/, '');
  if (fromEnv) return fromEnv;
  try {
    const h = await headers();
    const host = h.get('x-forwarded-host') ?? h.get('host');
    if (host) {
      const proto = host.startsWith('localhost') ? 'http' : 'https';
      return `${proto}://${host}`;
    }
  } catch {
    // headers() unavailable — fall through to ''.
  }
  return '';
}
