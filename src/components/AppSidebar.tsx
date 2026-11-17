"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, Sparkles, LogOut, ChevronDown, SlidersHorizontal } from '@/components/icons';
import EveryJobLogo from '@/components/EveryJobLogo';
import PaletteTrigger from '@/components/PaletteTrigger';
import CopilotTriggerButton from '@/components/CopilotTriggerButton';
import { logout } from '@/app/actions/auth';
import { formatMoney } from '@/lib/money';
import { t, type Locale } from '@/lib/i18n';
import { tp } from '@/lib/i18n/plural';
import { navSections, navBadgeKeys, advancedNavItems, type NavItem } from '@/components/nav-sections';
import { NavIconView } from '@/components/animated-icons/nav-icon';
import { useAutoExpandFlag } from '@/hooks/useStoredFlag';

/** Shared with the mobile More sheet - one persisted preference per device. */
const ADVANCED_OPEN_KEY = 'ej-advanced-open';

export interface SidebarStats {
  bookedToday: number;
  jobsLeftToday: number;
  newLeads: number;
  currency?: string;
}

export default function AppSidebar({
  user,
  stats,
  locale = 'en',
  unreadCount = 0,
}: {
  user: { name?: string | null; email: string };
  stats: SidebarStats;
  locale?: Locale;
  unreadCount?: number;
}) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    pathname === href ||
    pathname.startsWith(href + '/') ||
    (pathname === '/' && href === '/dashboard') ||
    // My Day is the Today view for the signed-in member: the Today
    // (/dashboard) item reads as active there, like /digest.
    (pathname === '/my-day' && href === '/dashboard');

  // Advanced group: collapsed by default, persisted per device (shared with
  // the mobile More sheet). Auto-expands on an advanced route.
  // Hydration-safe: the persisted flag resolves after hydration (useStoredFlag)
  // instead of being read in a useState initializer, which mismatched the SSR
  // HTML for returning visitors (React #418).
  const advancedActive = advancedNavItems.some((item) => isActive(item.href));
  const [advancedOpen, toggleAdvanced] = useAutoExpandFlag(ADVANCED_OPEN_KEY, advancedActive);

  const navLink = (item: NavItem) => {
    const active = isActive(item.href);
    const badge =
      navBadgeKeys[item.href] === 'leads' && stats.newLeads > 0 ? stats.newLeads : null;
    const label = t(locale, item.nameKey);
    return (
      <Link
        key={item.nameKey}
        href={item.href}
        aria-current={active ? 'page' : undefined}
        className="ej-icon-hover ej-side-link focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink/70"
      >
        <div className="flex items-center gap-2.5">
          <span
            className="ej-side-icon"
            aria-hidden="true"
          >
            <NavIconView icon={item.icon} size={17} />
          </span>
          <span className="min-w-0">
            {label}
          </span>
        </div>

        {badge !== null && (
          <span className="shrink-0 rounded-full bg-warn px-2 py-0.5 text-[10px] font-bold leading-4 text-ink">
            {badge}
          </span>
        )}
      </Link>
    );
  };

  return (
    <aside className="ej-sidebar hidden md:flex w-[16.5rem] shrink-0 sticky top-0 min-h-screen flex-col font-sans">
      {/* Header / Logo */}
      <div className="px-5 pb-3 pt-5">
        <div className="mb-6 flex items-center justify-between gap-2">
          <Link href="/dashboard" className="flex items-center gap-3">
            <EveryJobLogo size={32} />
            <span className="text-xl font-bold tracking-tight text-ink">EveryJob</span>
          </Link>
          <div className="flex items-center gap-1">
            <CopilotTriggerButton
              ariaLabel={t(locale, 'copilot.openLabel')}
              className="ej-icon-hover ej-side-icon-btn focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink/70"
            >
              <Sparkles size={18} />
            </CopilotTriggerButton>
            <Link
              href="/notifications"
              aria-label={
              unreadCount > 0
                ? `${t(locale, 'notifications.title')} (${unreadCount} ${t(locale, 'notifications.unread')})`
                : t(locale, 'notifications.title')
            }
            className="ej-icon-hover ej-side-icon-btn relative focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink/70"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span
                aria-hidden
                className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-signal px-1 text-[10px] font-bold text-surface"
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
            </Link>
          </div>
        </div>

        <div className="ej-side-summary">
          <p className="ej-side-summary-eyebrow">
            {t(locale, 'nav.todayView')}
          </p>
          <div className="ej-side-summary-amount">
            {formatMoney(stats.bookedToday, stats.currency, locale === 'fr' ? 'fr' : 'en')}
          </div>
          <p className="ej-side-summary-sub">
            {t(locale, 'nav.bookedToday')} ·{' '}
            {tp(locale, 'nav.jobsLeft', stats.jobsLeftToday)}
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-3 overflow-y-auto px-3 pb-5">
        <div className="px-0">
          <PaletteTrigger locale={locale} />
        </div>
        {navSections.map((section) => {
          // Deferred features live under the Advanced group, not in the normal sections.
          const items = section.items.filter((i) => !i.advanced);
          if (items.length === 0) return null;
          return (
            <div key={section.labelKey}>
              <p className="ej-nav-label">
                {t(locale, section.labelKey)}
              </p>
              <div className="space-y-0.5">{items.map(navLink)}</div>
            </div>
          );
        })}
        {/* Advanced - deferred Phase-1 features, collapsed by default */}
        <div>
          <button
            type="button"
            onClick={toggleAdvanced}
            aria-expanded={advancedOpen}
            aria-controls="sidebar-advanced-items"
            aria-label={
              advancedOpen
                ? t(locale, 'nav.collapseAdvanced')
                : t(locale, 'nav.expandAdvanced')
            }
            className="ej-icon-hover ej-side-link focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink/70"
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <SlidersHorizontal size={16} className="shrink-0" aria-hidden />
              <span>{t(locale, 'nav.advanced')}</span>
            </span>
            <ChevronDown
              size={16}
              aria-hidden
              className={`transition-transform ${advancedOpen ? 'rotate-180' : ''}`}
            />
          </button>
          {advancedOpen && (
            <div id="sidebar-advanced-items" className="mt-1 space-y-0.5 pl-1">
              {advancedNavItems.map(navLink)}
            </div>
          )}
        </div>
      </nav>

      {/* User profile / Logout. Language lives in Settings (profile
          settings) and in the mobile More menu - not in the sidebar. */}
      <div className="ej-sidebar-bottom mt-auto space-y-3">
        <form action={logout}>
          <button className="ej-icon-hover ej-side-profile focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink/70">
            <div className="w-9 h-9 rounded-full bg-hivis text-asphalt flex items-center justify-center text-sm font-bold shrink-0">
              {(user.name || user.email).charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-ink truncate">{user.name || user.email}</p>
              <p className="text-[10px] text-ink-2 truncate flex items-center gap-1">
                <LogOut size={10} /> {t(locale, 'nav.logout')}
              </p>
            </div>
          </button>
        </form>
      </div>
    </aside>
  );
}
