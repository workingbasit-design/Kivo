"use client";

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { List, LogOut, X, ChevronDown, SlidersHorizontal } from '@/components/icons';
import { t, type Locale } from '@/lib/i18n';
import { navSections, bottomTabs, advancedNavItems, type NavItem } from '@/components/nav-sections';
import { NavIconView } from '@/components/animated-icons/nav-icon';
import { Dialog, ghostBtnClass } from '@/components/ui';
import { LanguageToggle } from '@/components/LanguageToggle';
import { logout } from '@/app/actions/auth';
import { cn } from '@/lib/utils';
import { useAutoExpandFlag } from '@/hooks/useStoredFlag';

/** localStorage key for the More-sheet Advanced group's open/closed state. */
const ADVANCED_OPEN_KEY = 'ej-advanced-open';

/**
 * Thumb-friendly mobile bottom tab bar. The four primary destinations are
 * always one tap away; "More" opens the full section menu as a bottom
 * sheet. Rendered only on small screens (md:hidden).
 *
 * Design (Part B, dashboard rebuild): full-width asphalt bar. The active tab
 * shows a hi-vis pill behind the icon (duotone: outline + soft fill) with a
 * hi-vis label; inactive tabs are muted. Hi-vis appears here only - it
 * always means "look here".
 */
export default function BottomNav({
  user,
  locale = 'en',
}: {
  user: { name?: string | null; email: string };
  locale?: Locale;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const pathname = usePathname();

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');
  const anyPrimaryActive = bottomTabs.some((tab) => isActive(tab.href));
  const advancedActive = advancedNavItems.some((item) => isActive(item.href));

  // Advanced group: collapsed by default, persisted per device. Auto-expands
  // when the user is on an advanced route so the active item stays visible.
  // Hydration-safe: the persisted flag resolves after hydration (useStoredFlag)
  // instead of being read in a useState initializer, which mismatched the SSR
  // HTML for returning visitors (React #418).
  const [advancedOpen, toggleAdvanced] = useAutoExpandFlag(ADVANCED_OPEN_KEY, advancedActive);

  const renderNavLink = (item: NavItem) => {
    const active = isActive(item.href);
    return (
      <Link
        key={item.nameKey}
        href={item.href}
        onClick={() => setMoreOpen(false)}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex items-center gap-3 px-3 min-h-[48px] rounded-xl text-sm font-medium',
          active ? 'bg-ej-ink text-ej-lime' : 'text-ink hover:bg-surface-2'
        )}
      >
        <NavIconView icon={item.icon} size={18} className={active ? 'text-ej-lime' : 'text-ink-2'} filled={active} />
        {t(locale, item.nameKey)}
      </Link>
    );
  };

  const tabClass = (active: boolean) =>
    cn(
      'flex flex-col items-center justify-center gap-1 min-h-[60px] py-2 text-[10px]',
      'focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-hivis',
      'transition-colors',
      active ? 'text-hivis font-bold' : 'text-white/60 font-semibold hover:text-white'
    );

  const renderTabIcon = (active: boolean, icon: NavItem['icon']) => (
    <span
      className={cn(
        'flex items-center justify-center rounded-full transition-colors',
        active ? 'bg-hivis px-4 py-1.5' : 'px-4 py-1.5'
      )}
    >
      <NavIconView
        icon={icon}
        size={22}
        filled={active}
        aria-hidden
        className={active ? 'text-asphalt' : undefined}
      />
    </span>
  );

  return (
    <>
      <nav
        aria-label={t(locale, 'nav.primary') ?? 'Primary'}
        className="md:hidden fixed bottom-0 inset-x-0 z-40"
      >
        <div
          className={cn(
            'grid grid-cols-5 bg-asphalt dark:bg-coal',
            'border-t border-white/10',
            'pb-[env(safe-area-inset-bottom)]'
          )}
        >
          {bottomTabs.map((tab) => {
            const active = isActive(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={tabClass(active)}
              >
                {renderTabIcon(active, tab.icon)}
                <span className="leading-none">{t(locale, tab.nameKey)}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-expanded={moreOpen}
            aria-label={t(locale, 'nav.more') ?? 'More'}
            className={tabClass(!anyPrimaryActive && moreOpen)}
          >
            {renderTabIcon(!anyPrimaryActive && moreOpen, List)}
            <span className="leading-none">{t(locale, 'nav.more') ?? 'More'}</span>
          </button>
        </div>
      </nav>

      <Dialog open={moreOpen} onClose={() => setMoreOpen(false)} title={t(locale, 'nav.menu') ?? 'Menu'}>
        <div className="space-y-5 max-h-[65vh] overflow-y-auto -mx-1 px-1">
          {navSections.map((section) => {
            // Deferred features live under the Advanced group, not in the normal sections.
            const items = section.items.filter((i) => !i.advanced);
            if (items.length === 0) return null;
            return (
              <div key={section.labelKey}>
                <p className="mb-1.5 text-xs font-semibold text-ink-2">
                  {t(locale, section.labelKey)}
                </p>
                <div className="grid grid-cols-1 gap-1">{items.map(renderNavLink)}</div>
              </div>
            );
          })}
          <div>
            <button
              type="button"
              onClick={toggleAdvanced}
              aria-expanded={advancedOpen}
              aria-controls="more-advanced-items"
              aria-label={
                advancedOpen
                  ? t(locale, 'nav.collapseAdvanced')
                  : t(locale, 'nav.expandAdvanced')
              }
              className="flex w-full items-center justify-between px-3 min-h-[48px] rounded-xl text-sm font-medium text-ink hover:bg-surface-2"
            >
              <span className="flex items-center gap-3">
                <SlidersHorizontal size={18} className="text-ink-2" aria-hidden />
                {t(locale, 'nav.advanced')}
              </span>
              <ChevronDown
                size={18}
                aria-hidden
                className={cn('text-ink-2 transition-transform', advancedOpen && 'rotate-180')}
              />
            </button>
            {advancedOpen && (
              <div id="more-advanced-items" className="grid grid-cols-1 gap-1 mt-1">
                {advancedNavItems.map(renderNavLink)}
              </div>
            )}
          </div>
          <div className="pt-1 pb-3 border-b border-line">
            <p className="mb-2 px-3 text-xs font-semibold text-ink-2">
              {t(locale, 'settings.language')}
            </p>
            <div className="px-3">
              <LanguageToggle current={locale} />
            </div>
          </div>
          <form action={logout} className="pt-3">
            <button type="submit" className={ghostBtnClass + ' w-full'}>
              <LogOut size={18} />
              {t(locale, 'nav.logout')} ({user.name || user.email})
            </button>
          </form>
          <button
            type="button"
            onClick={() => setMoreOpen(false)}
            className="w-full min-h-[44px] text-sm font-semibold text-ink-2 hover:text-ink"
          >
            <X size={16} className="inline mr-1 -mt-0.5" />
            {t(locale, 'nav.close') ?? 'Close'}
          </button>
        </div>
      </Dialog>
    </>
  );
}
