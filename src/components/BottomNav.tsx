"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, LogOut, X, ChevronDown, SlidersHorizontal } from 'lucide-react';
import { t, type Locale } from '@/lib/i18n';
import { navSections, bottomTabs, advancedNavItems, type NavItem } from '@/components/nav-sections';
import { Dialog, ghostBtnClass } from '@/components/ui';
import { logout } from '@/app/actions/auth';
import { cn } from '@/lib/utils';

/** localStorage key for the More-sheet Advanced group's open/closed state. */
const ADVANCED_OPEN_KEY = 'ej-advanced-open';

/**
 * Thumb-friendly mobile bottom tab bar. The four primary destinations are
 * always one tap away; "More" opens the full section menu as a bottom
 * sheet. Rendered only on small screens (md:hidden).
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
  const [advancedOpen, setAdvancedOpen] = useState(false);
  useEffect(() => {
    let stored = false;
    try {
      stored = localStorage.getItem(ADVANCED_OPEN_KEY) === '1';
    } catch {
      /* private mode — default to collapsed */
    }
    setAdvancedOpen(stored || advancedActive);
  }, [advancedActive]);
  const toggleAdvanced = () => {
    setAdvancedOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(ADVANCED_OPEN_KEY, next ? '1' : '0');
      } catch {
        /* private mode */
      }
      return next;
    });
  };

  const renderNavLink = (item: NavItem) => {
    const active = isActive(item.href);
    return (
      <Link
        key={item.nameKey}
        href={item.href}
        onClick={() => setMoreOpen(false)}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex items-center gap-3 px-3 min-h-[48px] rounded-xl text-sm font-medium transition-colors',
          active ? 'bg-ink text-lime' : 'text-zinc-700 hover:bg-zinc-100'
        )}
      >
        <item.icon size={18} className={active ? 'text-lime' : 'text-zinc-400'} />
        {t(locale, item.nameKey)}
      </Link>
    );
  };

  return (
    <>
      <nav
        aria-label={t(locale, 'nav.primary') ?? 'Primary'}
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-ink text-white border-t border-white/10 ej-safe-bottom"
      >
        <div className="grid grid-cols-5">
          {bottomTabs.map((tab) => {
            const active = isActive(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 min-h-[64px] py-2 text-[10px] font-semibold transition-colors',
                  'focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-lime',
                  active ? 'text-lime' : 'text-white/55 hover:text-white'
                )}
              >
                <tab.icon size={22} strokeWidth={active ? 2.5 : 2} />
                <span className="leading-none">{t(locale, tab.nameKey)}</span>
                <span
                  aria-hidden
                  className={cn(
                    'h-1 w-8 rounded-full transition-all',
                    active ? 'bg-lime' : 'bg-transparent'
                  )}
                />
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-expanded={moreOpen}
            className={cn(
              'flex flex-col items-center justify-center gap-1 min-h-[64px] py-2 text-[10px] font-semibold transition-colors',
              'focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-lime',
              !anyPrimaryActive && moreOpen ? 'text-lime' : 'text-white/55 hover:text-white'
            )}
          >
            <Menu size={22} />
            <span className="leading-none">{t(locale, 'nav.more') ?? 'More'}</span>
            <span aria-hidden className="h-1 w-8 rounded-full bg-transparent" />
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
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-400">
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
              className="flex w-full items-center justify-between px-3 min-h-[48px] rounded-xl text-sm font-medium text-zinc-700 hover:bg-zinc-100"
            >
              <span className="flex items-center gap-3">
                <SlidersHorizontal size={18} className="text-zinc-400" aria-hidden />
                {t(locale, 'nav.advanced')}
              </span>
              <ChevronDown
                size={18}
                aria-hidden
                className={cn('text-zinc-400 transition-transform', advancedOpen && 'rotate-180')}
              />
            </button>
            {advancedOpen && (
              <div id="more-advanced-items" className="grid grid-cols-1 gap-1 mt-1">
                {advancedNavItems.map(renderNavLink)}
              </div>
            )}
          </div>
          <form action={logout} className="pt-3 border-t border-zinc-100">
            <button type="submit" className={ghostBtnClass + ' w-full'}>
              <LogOut size={18} />
              {t(locale, 'nav.logout')} ({user.name || user.email})
            </button>
          </form>
          <button
            type="button"
            onClick={() => setMoreOpen(false)}
            className="w-full min-h-[44px] text-sm font-semibold text-zinc-500 hover:text-zinc-800"
          >
            <X size={16} className="inline mr-1 -mt-0.5" />
            {t(locale, 'nav.close') ?? 'Close'}
          </button>
        </div>
      </Dialog>
    </>
  );
}
