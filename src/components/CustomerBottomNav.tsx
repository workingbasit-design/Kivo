"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search, Inbox, Heart, MessageCircle, User } from 'lucide-react';
import { t, type Locale } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const tabs = [
  { href: '/customer', labelKey: 'customer.nav.search', icon: Search, exact: true },
  { href: '/customer/requests', labelKey: 'customer.nav.requests', icon: Inbox },
  { href: '/customer/saved', labelKey: 'customer.nav.saved', icon: Heart },
  { href: '/customer/messages', labelKey: 'customer.nav.messages', icon: MessageCircle },
  { href: '/customer/profile', labelKey: 'customer.nav.profile', icon: User },
];

/**
 * Customer bottom tab bar — thumb-friendly mobile navigation for homeowners.
 * 5 tabs: Search, Requests, Saved, Messages, Profile.
 */
export default function CustomerBottomNav({ locale }: { locale: Locale }) {
  const pathname = usePathname();

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + '/');

  return (
    <nav
      aria-label="Customer navigation"
      className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-white/95 backdrop-blur border-t border-zinc-200/70 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="grid grid-cols-5 px-2">
        {tabs.map(({ href, labelKey, icon: Icon, exact }) => {
          const active = isActive(href, exact);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'ej-icon-hover group relative flex flex-col items-center gap-1 py-2.5 min-h-[62px] justify-center',
                'text-[11px] font-semibold transition-colors',
                active ? 'text-indigo-600' : 'text-zinc-400 hover:text-zinc-700'
              )}
            >
              {active && (
                <span className="ej-anim-scale-in absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 rounded-b-full bg-indigo-600" />
              )}
              <span className={cn(
                'flex items-center justify-center w-11 h-7 rounded-full transition-all duration-300',
                active ? 'bg-indigo-100 scale-105' : 'group-hover:bg-zinc-100'
              )}>
                <Icon className="w-5 h-5" strokeWidth={active ? 2.5 : 2} />
              </span>
              {t(locale, labelKey as never)}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
