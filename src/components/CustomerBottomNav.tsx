"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search, Inbox, Heart, MessageCircle, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { href: '/customer', label: 'Search', icon: Search, exact: true },
  { href: '/customer/requests', label: 'Requests', icon: Inbox },
  { href: '/customer/saved', label: 'Saved', icon: Heart },
  { href: '/customer/messages', label: 'Messages', icon: MessageCircle },
  { href: '/customer/profile', label: 'Profile', icon: User },
];

/**
 * Customer bottom tab bar — thumb-friendly mobile navigation for homeowners.
 * 5 tabs: Search, Requests, Saved, Messages, Profile.
 */
export default function CustomerBottomNav() {
  const pathname = usePathname();

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + '/');

  return (
    <nav
      aria-label="Customer navigation"
      className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-white/95 backdrop-blur border-t border-zinc-200/70"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="grid grid-cols-5">
        {tabs.map(({ href, label, icon: Icon, exact }) => {
          const active = isActive(href, exact);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'ej-icon-hover flex flex-col items-center gap-1 py-2.5 min-h-[60px] justify-center',
                'text-[11px] font-semibold transition-colors',
                active ? 'text-indigo-600' : 'text-zinc-500 hover:text-zinc-800'
              )}
            >
              <Icon className="w-6 h-6" strokeWidth={active ? 2.5 : 2} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
