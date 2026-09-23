'use client';

import { useCallback, useEffect, useState } from 'react';
import { useT } from '@/components/LanguageToggle';
import { t, type Locale } from '@/lib/i18n';

/**
 * Locale for components that render outside a <LocaleProvider> (e.g. the
 * public /p/[slug] page or marketing sub-pages). Defaults to 'en' for SSR,
 * then reads the `kivo-locale` cookie after mount. Safe to use anywhere;
 * inside a provider it just mirrors useT().
 */
export function useResolvedLocale(): Locale {
  const { locale: ctxLocale } = useT();
  const [locale, setLocale] = useState<Locale>(ctxLocale);
  useEffect(() => {
    try {
      const match = document.cookie
        .split(';')
        .map((c) => c.trim())
        .find((c) => c.startsWith('kivo-locale='));
      setLocale(match?.endsWith('=fr') ? 'fr' : 'en');
    } catch {
      setLocale('en');
    }
  }, []);
  return locale;
}

/** Lookup a path in the merged dictionary for the resolved locale. */
export function useResolvedT(): { t: (path: string) => string; locale: Locale } {
  const locale = useResolvedLocale();
  const translate = useCallback((path: string) => t(locale, path), [locale]);
  return { t: translate, locale };
}
