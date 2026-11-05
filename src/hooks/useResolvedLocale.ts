'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { useT } from '@/components/LanguageToggle';
import { t, type Locale } from '@/lib/i18n';

/**
 * Locale for components that render outside a <LocaleProvider> (e.g. the
 * public /p/[slug] page or marketing sub-pages). The `kivo-locale` cookie
 * is an external system, so it is read through useSyncExternalStore: the
 * server snapshot is the context locale, which the first client render
 * always matches, and the cookie value applies after mount. Reading the
 * cookie in a lazy useState initializer ran during hydration (document
 * exists) while SSR fell back to 'en', so every translated string
 * mismatched on FR pages (React #418, 2026-11-05). Inside a provider the
 * snapshots agree, so there is no correction render at all. No
 * subscription: the language toggle does a full page reload, so the
 * cookie cannot change under a mounted tree.
 */
function readLocaleCookie(): Locale | null {
  if (typeof document === 'undefined') return null;
  try {
    const match = document.cookie
      .split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith('kivo-locale='));
    if (!match) return null;
    return match.endsWith('=fr') ? 'fr' : 'en';
  } catch {
    return null;
  }
}

export function useResolvedLocale(): Locale {
  const { locale: ctxLocale } = useT();
  return useSyncExternalStore(
    () => () => {},
    () => readLocaleCookie() ?? ctxLocale,
    () => ctxLocale,
  );
}

/** Lookup a path in the merged dictionary for the resolved locale. */
export function useResolvedT(): { t: (path: string) => string; locale: Locale } {
  const locale = useResolvedLocale();
  const translate = useCallback((path: string) => t(locale, path), [locale]);
  return { t: translate, locale };
}
