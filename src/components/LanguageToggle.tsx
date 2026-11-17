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

/** EN / FR segmented toggle. Renders nothing interactive until hydrated.
 *
 * ChatGPT Settings redesign: the selected language uses the kit selected
 * treatment (hivis bg + hivis-ink text, as in SegmentedControl) with a
 * check mark, identical in light and dark mode. Same footprint as before,
 * so the auth layouts and public pages that share this toggle are
 * unaffected. */
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
      className={`ej-settings-lang ${dark ? 'ej-settings-lang-dark' : ''}`}
    >
      {LOCALES.map((l) => (
        <button
          key={l.code}
          type="button"
          onClick={() => setLocale(l.code)}
          aria-pressed={current === l.code}
          className={dark && current !== l.code ? 'ej-settings-lang-dark-idle' : undefined}
        >
          {current === l.code && (
            <span aria-hidden="true">
              ✓
            </span>
          )}
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
