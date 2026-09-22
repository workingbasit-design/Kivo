/**
 * Server-only locale resolution: reads the `kivo-locale` cookie.
 * Import this only from server components / server actions.
 */
import { cookies } from 'next/headers';
import { LOCALE_COOKIE, normalizeLocale, type Locale } from './index';

export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  return normalizeLocale(store.get(LOCALE_COOKIE)?.value);
}
