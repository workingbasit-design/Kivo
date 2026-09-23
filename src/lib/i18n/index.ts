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

/** Lookup a dotted path like "invoices.total" in the locale's dictionary. */
export function t(locale: Locale, path: Path): string {
  const parts = path.split('.');
  let cur: unknown = getDictionary(locale);
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in cur) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      cur = undefined;
      break;
    }
  }
  return typeof cur === 'string' ? cur : path;
}
