"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Calendar, Users, Briefcase, FileText,
  Settings, Sparkles, ClipboardList, Tag, Star, PieChart,
  UserPlus, Menu, X, LogOut, Timer, Megaphone, Repeat, Route, CalendarCheck
} from 'lucide-react';
import { logout } from '@/app/actions/auth';
import { t, type Locale } from '@/lib/i18n';

const navItems = [
  { nameKey: 'nav.dashboard', href: '/dashboard', icon: LayoutDashboard },
  { nameKey: 'nav.schedule', href: '/schedule', icon: Calendar },
  { nameKey: 'nav.leads', href: '/leads', icon: UserPlus },
  { nameKey: 'nav.jobs', href: '/jobs', icon: Briefcase },
  { nameKey: 'nav.recurring', href: '/recurring', icon: Repeat },
  { nameKey: 'nav.routes', href: '/routes', icon: Route },
  { nameKey: 'nav.timesheets', href: '/timesheets', icon: Timer },
  { nameKey: 'nav.quotes', href: '/quotes', icon: ClipboardList },
  { nameKey: 'nav.invoices', href: '/invoices', icon: FileText },
  { nameKey: 'nav.customers', href: '/customers', icon: Users },
  { nameKey: 'nav.pricebook', href: '/pricebook', icon: Tag },
  { nameKey: 'nav.reviews', href: '/reviews', icon: Star },
  { nameKey: 'nav.marketing', href: '/marketing', icon: Megaphone },
  { nameKey: 'nav.onlineBooking', href: '/settings/booking', icon: CalendarCheck },
  { nameKey: 'nav.reports', href: '/reports', icon: PieChart },
  { nameKey: 'nav.settings', href: '/settings', icon: Settings },
];

export default function MobileNav({ user, locale = 'en' }: { user: { name?: string | null; email: string }; locale?: Locale }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="md:hidden sticky top-0 z-40 bg-[#17122b] text-white">
      <div className="flex items-center justify-between px-4 py-3">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#6329d4] flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-bold tracking-tight">Kivo</span>
        </Link>
        <button
          onClick={() => setOpen(!open)}
          className="p-2 rounded-lg hover:bg-[#2b243b] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {open && (
        <nav className="px-3 pb-4 space-y-1 max-h-[70vh] overflow-y-auto border-t border-[#2b243b] pt-3">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.nameKey}
                href={item.href}
                onClick={() => setOpen(false)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 ${
                  isActive ? 'bg-[#6329d4] text-white' : 'text-[#b8b0c9] hover:bg-[#2b243b]'
                }`}
              >
                <item.icon size={18} />
                {t(locale, item.nameKey)}
              </Link>
            );
          })}
          <form action={logout} className="pt-2 border-t border-[#2b243b] mt-2">
            <button
              type="submit"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[#b8b0c9] hover:bg-[#2b243b] w-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
            >
              <LogOut size={18} />
              {t(locale, 'nav.logout')} ({user.name || user.email})
            </button>
          </form>
        </nav>
      )}
    </header>
  );
}
