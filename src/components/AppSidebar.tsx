"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Calendar, Users, Briefcase, FileText,
  Settings, ClipboardList, UserCog,
  Tag, Star, PieChart, UserPlus, LogOut, Timer, Megaphone, Repeat, Route, CalendarCheck, BellRing
} from 'lucide-react';
import EveryJobLogo from '@/components/EveryJobLogo';
import { logout } from '@/app/actions/auth';
import { formatMoney } from '@/lib/money';
import { t, type Locale } from '@/lib/i18n';

const navSections = [
  {
    labelKey: 'nav.sections.work',
    items: [
      { nameKey: 'nav.dashboard', href: '/dashboard', icon: LayoutDashboard },
      { nameKey: 'nav.schedule', href: '/schedule', icon: Calendar },
      { nameKey: 'nav.jobs', href: '/jobs', icon: Briefcase },
      { nameKey: 'nav.recurring', href: '/recurring', icon: Repeat },
      { nameKey: 'nav.routes', href: '/routes', icon: Route },
      { nameKey: 'nav.timesheets', href: '/timesheets', icon: Timer },
    ],
  },
  {
    labelKey: 'nav.sections.money',
    items: [
      { nameKey: 'nav.quotes', href: '/quotes', icon: ClipboardList },
      { nameKey: 'nav.invoices', href: '/invoices', icon: FileText },
    ],
  },
  {
    labelKey: 'nav.sections.customers',
    items: [
      { nameKey: 'nav.leads', href: '/leads', icon: UserPlus, badgeKey: 'leads' },
      { nameKey: 'nav.customers', href: '/customers', icon: Users },
      { nameKey: 'nav.reviews', href: '/reviews', icon: Star },
    ],
  },
  {
    labelKey: 'nav.sections.grow',
    items: [
      { nameKey: 'nav.pricebook', href: '/pricebook', icon: Tag },
      { nameKey: 'nav.marketing', href: '/marketing', icon: Megaphone },
      { nameKey: 'nav.reminders', href: '/reminders', icon: BellRing },
      { nameKey: 'nav.onlineBooking', href: '/settings/booking', icon: CalendarCheck },
    ],
  },
  {
    labelKey: 'nav.sections.manage',
    items: [
      { nameKey: 'nav.reports', href: '/reports', icon: PieChart },
      { nameKey: 'nav.team', href: '/settings/team', icon: UserCog },
      { nameKey: 'nav.settings', href: '/settings', icon: Settings },
    ],
  },
];

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
}: {
  user: { name?: string | null; email: string };
  stats: SidebarStats;
  locale?: Locale;
}) {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex flex-col w-64 bg-ink text-white min-h-screen sticky top-0 font-sans shrink-0">
      {/* Header / Logo */}
      <div className="p-6 pb-2">
        <Link href="/dashboard" className="flex items-center gap-3 mb-8">
          <EveryJobLogo size={32} />
          <span className="text-xl font-bold tracking-tight text-white">EveryJob</span>
        </Link>

        <div className="mb-4">
          <p className="text-[10px] uppercase tracking-wider text-white/50 font-semibold mb-1">
            {t(locale, 'nav.todayView')}
          </p>
          <div className="text-2xl font-bold text-white tracking-tight">
            {formatMoney(stats.bookedToday, stats.currency, locale === 'fr' ? 'fr' : 'en')}
          </div>
          <p className="text-xs text-white/50 mt-1">
            {t(locale, 'nav.bookedToday')} ·{' '}
            {t(locale, stats.jobsLeftToday === 1 ? 'nav.jobLeft' : 'nav.jobsLeft').replace(
              '{count}',
              String(stats.jobsLeftToday)
            )}
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-4 overflow-y-auto pb-6">
        {navSections.map((section) => (
          <div key={section.labelKey}>
            <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">
              {t(locale, section.labelKey)}
            </p>
            <div className="space-y-1">
              {section.items.map((item) => {
                const isActive =
                  pathname === item.href ||
                  pathname.startsWith(item.href + '/') ||
                  (pathname === '/' && item.href === '/dashboard');
                const badge =
                  item.badgeKey === 'leads' && stats.newLeads > 0 ? stats.newLeads : null;
                const label = t(locale, item.nameKey);
                return (
                  <Link
                    key={item.nameKey}
                    href={item.href}
                    aria-current={isActive ? 'page' : undefined}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-200 group focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 ${
                      isActive
                        ? 'bg-lime text-ink shadow-sm'
                        : 'text-white/50 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon
                        size={18}
                        strokeWidth={2}
                        className={isActive ? 'text-ink' : 'text-white/50 group-hover:text-white'}
                      />
                      <span className={`text-[13px] font-medium ${isActive ? 'font-semibold' : ''}`}>
                        {label}
                      </span>
                    </div>

                    {badge !== null && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-400 text-zinc-900">
                        {badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User profile / Logout */}
      <div className="p-4 border-t border-white/10 mt-auto">
        <form action={logout}>
          <button className="flex items-center gap-3 px-3 py-2 text-white/50 hover:bg-white/10 hover:text-white transition-colors rounded-xl w-full text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70">
            <div className="w-8 h-8 rounded-full bg-ink text-white flex items-center justify-center text-sm font-bold shadow-inner shrink-0">
              {(user.name || user.email).charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">{user.name || user.email}</p>
              <p className="text-[10px] text-white/50 truncate flex items-center gap-1">
                <LogOut size={10} /> {t(locale, 'nav.logout')}
              </p>
            </div>
          </button>
        </form>
      </div>
    </aside>
  );
}
