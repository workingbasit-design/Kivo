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

const navItems = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Schedule', href: '/schedule', icon: Calendar },
  { name: 'Leads', href: '/leads', icon: UserPlus },
  { name: 'Jobs', href: '/jobs', icon: Briefcase },
  { name: 'Recurring', href: '/recurring', icon: Repeat },
  { name: 'Routes', href: '/routes', icon: Route },
  { name: 'Timesheets', href: '/timesheets', icon: Timer },
  { name: 'Quotes', href: '/quotes', icon: ClipboardList },
  { name: 'Invoices', href: '/invoices', icon: FileText },
  { name: 'Customers', href: '/customers', icon: Users },
  { name: 'Price book', href: '/pricebook', icon: Tag },
  { name: 'Reviews', href: '/reviews', icon: Star },
  { name: 'Marketing', href: '/marketing', icon: Megaphone },
  { name: 'Online booking', href: '/settings/booking', icon: CalendarCheck },
  { name: 'Reports', href: '/reports', icon: PieChart },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export default function MobileNav({ user }: { user: { name?: string | null; email: string } }) {
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
          className="p-2 rounded-lg hover:bg-[#2b243b] transition-colors"
          aria-label={open ? 'Close menu' : 'Open menu'}
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
                key={item.name}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive ? 'bg-[#6329d4] text-white' : 'text-[#b8b0c9] hover:bg-[#2b243b]'
                }`}
              >
                <item.icon size={18} />
                {item.name}
              </Link>
            );
          })}
          <form action={logout} className="pt-2 border-t border-[#2b243b] mt-2">
            <button
              type="submit"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[#b8b0c9] hover:bg-[#2b243b] w-full"
            >
              <LogOut size={18} />
              Log out ({user.name || user.email})
            </button>
          </form>
        </nav>
      )}
    </header>
  );
}
