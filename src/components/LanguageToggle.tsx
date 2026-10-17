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

/**
 * Persists the locale cookie (1-year, readable by server components via
 * getLocale()). Module-level so the DOM write stays out of render analysis.
 */
function persistLocaleCookie(code: Locale): void {
  document.cookie = `${LOCALE_COOKIE}=${code}; path=/; max-age=31536000; SameSite=Lax`;
}

export function useT(): { t: (path: string) => string; locale: Locale } {
  const locale = useLocale();
  return { t: (path: string) => lookup(locale, path), locale };
}

/** EN / FR segmented toggle. Renders nothing interactive until hydrated. */
export function LanguageToggle({ current, tone = 'light' }: { current: Locale; tone?: 'light' | 'dark' }) {
  const setLocale = (code: Locale) => {
    if (code === current) return;
    persistLocaleCookie(code);
    // Full reload (not router.refresh()): the sidebar/mobile nav labels are
    // rendered server-side from this cookie, and router.refresh() did not
    // reliably re-render them - labels stayed in the old language until a
    // manual reload. A settings-page language switch may reload the page.
    window.location.reload();
  };

  const dark = tone === 'dark';

  return (
    <div
      role="group"
      aria-label="Language / Langue"
      className={`inline-flex rounded-full border p-0.5 text-xs font-bold ${
        dark ? 'border-white/15 bg-surface/10' : 'border-line bg-surface'
      }`}
    >
      {LOCALES.map((l) => (
        <button
          key={l.code}
          type="button"
          onClick={() => setLocale(l.code)}
          aria-pressed={current === l.code}
          className={`rounded-full px-3 py-1.5 transition-colors min-h-[44px] min-w-[44px] inline-flex items-center justify-center ${
            current === l.code
              ? dark
                ? 'bg-surface text-ink shadow-sm'
                : 'bg-asphalt text-white shadow-sm'
              : dark
                ? 'text-white/60 hover:text-white'
                : 'text-ink-2 hover:text-ink'
          }`}
        >
          {l.code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

/** Show a translated dictionary section, e.g. <T path="nav" /> is not needed - use useT(). */
export function useDict() {
  const locale = useLocale();
  return getDictionary(locale);
}
