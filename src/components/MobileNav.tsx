"use client";

import Link from 'next/link';
import { Bell } from 'lucide-react';
import EveryJobLogo from '@/components/EveryJobLogo';
import PaletteTrigger from '@/components/PaletteTrigger';
import { t, type Locale } from '@/lib/i18n';

/**
 * Slim mobile top bar: brand + search + notification bell. Primary navigation lives
 * in the bottom tab bar (BottomNav) — thumb-reachable on phones.
 */
export default function MobileNav({ locale = 'en', unreadCount = 0 }: { locale?: Locale; unreadCount?: number }) {
  return (
    <header className="md:hidden sticky top-0 z-40 bg-ink text-white">
      <div className="flex items-center justify-between px-4 py-3">
        <Link href="/dashboard" className="flex items-center gap-2 min-h-[44px]">
          <EveryJobLogo size={28} />
          <span className="text-lg font-bold tracking-tight">EveryJob</span>
        </Link>
        <div className="flex items-center gap-1">
          <PaletteTrigger locale={locale} variant="icon" />
          <Link
            href="/notifications"
            aria-label={
              unreadCount > 0
                ? `${t(locale, 'notifications.title')} (${unreadCount} ${t(locale, 'notifications.unread')})`
                : t(locale, 'notifications.title')
            }
            className="relative p-2.5 rounded-xl hover:bg-white/10 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span
                aria-hidden
                className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-lime px-1 text-[9px] font-bold text-ink"
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
