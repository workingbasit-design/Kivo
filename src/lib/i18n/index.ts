/**
 * Lightweight i18n: a dictionary + React context, no framework migration.
 * English is the default; French (fr) is opt-in via the `kivo-locale` cookie.
 */
import en, { type Dictionary } from './en.ts';
import fr from './fr.ts';
import { applyFragments } from './fragments.ts';

export type Locale = 'en' | 'fr';
export const LOCALE_COOKIE = 'kivo-locale';
export const LOCALES: { code: Locale; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
];

const dicts: Record<Locale, Dictionary> = {
  en: applyFragments(en, 'en'),
  fr: applyFragments(fr, 'fr'),
};

export function getDictionary(locale: Locale): Dictionary {
  return dicts[locale] ?? en;
}

export function normalizeLocale(value: string | null | undefined): Locale {
  return value === 'fr' ? 'fr' : 'en';
}

type Path = string;

/** Pure dotted-path lookup in one dictionary (exported for tests). */
export function lookupDict(dict: Dictionary, path: string): string | undefined {
  const parts = path.split('.');
  let cur: unknown = dict;
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in cur) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return undefined;
    }
  }
  return typeof cur === 'string' ? cur : undefined;
}

/**
 * Pure fallback core (exported for tests): locale dict, then the EN dict,
 * then the raw key. The fallback is a display safety net, not a translation
 * — a key missing from FR still has to be added by a human (the parity test
 * fails on it); the UI just never shows a dotted path in the meantime.
 */
export function resolveWithFallback(
  dict: Dictionary,
  enDict: Dictionary,
  path: string
): string {
  return lookupDict(dict, path) ?? lookupDict(enDict, path) ?? path;
}

/** Dev/test-only missing-key warning, deduped once per key per process. */
const warned = new Set<string>();
function warnMissing(locale: Locale, path: string): void {
  if (process.env.NODE_ENV === 'production') return;
  const key = `${locale}:${path}`;
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(`[i18n] missing key ${path} for locale ${locale}`);
}

/**
 * Lookup a dotted path like "invoices.total" in the locale's dictionary.
 * Fallback order is locale → EN → raw key (loud failure when the key is in
 * neither locale, so a missing key stays visible until it is added).
 */
export function t(locale: Locale, path: Path): string {
  const dict = getDictionary(locale);
  const hit = lookupDict(dict, path);
  if (hit !== undefined) return hit;
  warnMissing(locale, path);
  if (locale === 'fr') return resolveWithFallback(dict, getDictionary('en'), path);
  return path;
}
