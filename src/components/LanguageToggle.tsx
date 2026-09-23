'use client';

/**
 * Client-side locale provider + hook. Wrap the app shell (or any subtree)
 * with <LocaleProvider locale="fr"> and call useT() inside:
 *
 *   const { t } = useT();
 *   t('invoices.total') // "Total" / "Total"
 *
 * The toggle below persists to the `kivo-locale` cookie and reloads the page so
 * server components (e.g. the sidebar, invoices) re-render in the chosen language.
 */
import { createContext, useContext, type ReactNode } from 'react';
import { getDictionary, LOCALE_COOKIE, LOCALES, t as lookup, type Locale } from '@/lib/i18n';

const LocaleContext = createContext<Locale>('en');

export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

export function useT(): { t: (path: string) => string; locale: Locale } {
  const locale = useLocale();
  return { t: (path: string) => lookup(locale, path), locale };
}

/** EN / FR segmented toggle. Renders nothing interactive until hydrated. */
export function LanguageToggle({ current }: { current: Locale }) {
  const setLocale = (code: Locale) => {
    if (code === current) return;
    // 1-year cookie, readable by server components via getLocale().
    document.cookie = `${LOCALE_COOKIE}=${code}; path=/; max-age=31536000; SameSite=Lax`;
    // Full reload (not router.refresh()): the sidebar/mobile nav labels are
    // rendered server-side from this cookie, and router.refresh() did not
    // reliably re-render them — labels stayed in the old language until a
    // manual reload. A settings-page language switch may reload the page.
    window.location.reload();
  };

  return (
    <div
      role="group"
      aria-label="Language / Langue"
      className="inline-flex rounded-full border border-zinc-200 bg-white p-0.5 text-xs font-bold"
    >
      {LOCALES.map((l) => (
        <button
          key={l.code}
          type="button"
          onClick={() => setLocale(l.code)}
          aria-pressed={current === l.code}
          className={`rounded-full px-3 py-1.5 transition-colors ${
            current === l.code
              ? 'bg-ink text-white shadow-sm'
              : 'text-zinc-500 hover:text-zinc-900'
          }`}
        >
          {l.code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

/** Show a translated dictionary section, e.g. <T path="nav" /> is not needed — use useT(). */
export function useDict() {
  const locale = useLocale();
  return getDictionary(locale);
}
