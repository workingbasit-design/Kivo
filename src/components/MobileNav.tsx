"use client";

import Link from 'next/link';
import { Bell, Bot } from '@/components/icons';
import EveryJobLogo from '@/components/EveryJobLogo';
import PaletteTrigger from '@/components/PaletteTrigger';
import CopilotTriggerButton from '@/components/CopilotTriggerButton';
import { t, type Locale } from '@/lib/i18n';

/**
 * Slim mobile top bar: brand + Copilot + search + notification bell. Primary
 * navigation lives in the bottom tab bar (BottomNav) - thumb-reachable on
 * phones. The EN/FR switch lives in the More menu and in Settings, not here.
 */
export default function MobileNav({ locale = 'en', unreadCount = 0 }: { locale?: Locale; unreadCount?: number }) {
  return (
    <header className="md:hidden sticky top-0 z-40 text-ej-ink dark:text-white">
      <div className="bg-ej-paper dark:bg-coal border-b border-ej-smoke dark:border-white/10 pt-[env(safe-area-inset-top)]">
      <div className="flex items-center justify-between px-4 py-3">
        <Link href="/dashboard" className="flex items-center gap-2 min-h-[44px]">
          <EveryJobLogo size={28} />
          <span className="text-lg font-bold tracking-tight">EveryJob</span>
        </Link>
        <div className="flex items-center gap-2">
          <CopilotTriggerButton
            ariaLabel={t(locale, 'copilot.openLabel')}
            className="p-2.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ej-ink/70"
          >
            <Bot size={20} />
          </CopilotTriggerButton>
          <PaletteTrigger locale={locale} variant="icon" />
          <Link
            href="/notifications"
            aria-label={
              unreadCount > 0
                ? `${t(locale, 'notifications.title')} (${unreadCount} ${t(locale, 'notifications.unread')})`
                : t(locale, 'notifications.title')
            }
            className="relative p-2.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ej-ink/70"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span
                aria-hidden
                className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-signal px-1 text-[9px] font-bold text-white"
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </Link>
        </div>
      </div>
      </div>
    </header>
  );
}
