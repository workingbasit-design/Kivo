'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck } from '@/components/icons';
import { t, type Locale } from '@/lib/i18n';
import { getNotificationSummary } from '@/app/actions/notifications-f10';
import {
  markAllNotificationsRead,
  markNotificationRead,
} from '@/app/actions/notifications';

interface RecentItem {
  id: string;
  type: string;
  href: string | null;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
}

function timeAgo(iso: string, locale: Locale): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return t(locale, 'notifications.justNow');
  if (mins < 60) return locale === 'fr' ? `il y a ${mins} min` : `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return locale === 'fr' ? `il y a ${hours} h` : `${hours}h ago`;
  return new Date(iso).toLocaleDateString(locale === 'fr' ? 'fr-CA' : 'en-CA', {
    month: 'short',
    day: 'numeric',
  });
}

/**
 * F10: bell with unread badge + dropdown panel.
 *
 * The badge count is server-rendered (initialUnread) so it paints with the
 * shell; opening the panel fetches the 8 most recent notifications via a
 * server action. Tapping a row marks it read and navigates to its record.
 */
export default function NotificationBell({
  locale = 'en',
  initialUnread = 0,
  tone = 'dark',
}: {
  locale?: Locale;
  initialUnread?: number;
  tone?: 'dark' | 'light';
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(initialUnread);
  const [items, setItems] = useState<RecentItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const summary = await getNotificationSummary();
      setUnread(summary.unreadCount);
      setItems(summary.recent);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) void load();
  };

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open ]);

  const openItem = async (item: RecentItem) => {
    setOpen(false);
    if (!item.read) {
      setItems((prev) => prev?.map((i) => (i.id === item.id ? { ...i, read: true } : i)) ?? null);
      setUnread((u) => Math.max(0, u - 1));
      try {
        await markNotificationRead(item.id);
      } catch {
        // Best-effort: the row already navigates below.
      }
    }
    router.push(item.href ?? '/notifications');
  };

  const markAll = async () => {
    setItems((prev) => prev?.map((i) => ({ ...i, read: true })) ?? null);
    setUnread(0);
    try {
      await markAllNotificationsRead();
    } catch {
      // Best-effort.
    }
  };

  const badge =
    unread > 0 ? (
      <span
        aria-hidden
        className={`absolute flex items-center justify-center rounded-full px-1 font-bold ${
          tone === 'dark'
            ? '-top-0.5 -right-0.5 h-5 min-w-5 text-[10px] bg-lime text-ink'
            : 'top-1 right-1 h-4 min-w-4 text-[9px] bg-ej-lime text-ej-ink'
        }`}
      >
        {unread > 99 ? '99+' : unread}
      </span>
    ) : null;

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-label={
          unread > 0
            ? `${t(locale, 'notifications.title')} (${unread} ${t(locale, 'notifications.unread')})`
            : t(locale, 'notifications.title')
        }
        aria-expanded={open}
        aria-haspopup="true"
        className={
          tone === 'dark'
            ? 'ej-icon-hover relative rounded-xl p-2.5 text-white/85 hover:bg-surface/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70'
            : 'relative p-2.5 rounded-xl hover:bg-surface-2 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ej-ink/70'
        }
      >
        <Bell size={tone === 'dark' ? 19 : 20} />
        {badge}
      </button>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label={t(locale, 'notifications.title')}
          className="absolute right-0 top-full z-[80] mt-2 w-[340px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-smoke bg-surface shadow-[0_24px_64px_-16px_rgba(22,22,22,0.35)]"
        >
          <div className="flex items-center justify-between gap-2 border-b border-smoke px-4 py-3">
            <p className="text-sm font-bold text-ink">{t(locale, 'notifications.title')}</p>
            {unread > 0 && (
              <button
                type="button"
                onClick={markAll}
                className="inline-flex min-h-[44px] items-center gap-1 px-2 text-[13px] font-semibold text-graphite underline-offset-4 hover:underline"
              >
                <CheckCheck size={14} />
                {t(locale, 'notifBell.markAllRead')}
              </button>
            )}
          </div>

          <div className="max-h-[380px] overflow-y-auto">
            {loading || items === null ? (
              <p className="px-4 py-8 text-center text-sm text-ink-2">
                {t(locale, 'search.searching')}
              </p>
            ) : items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-ink-2">
                {t(locale, 'notifBell.empty')}
              </p>
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => void openItem(item)}
                  className={`flex w-full items-start gap-3 border-b border-smoke/60 px-4 py-3 text-left transition-colors last:border-0 hover:bg-surface-2 ${
                    item.read ? 'opacity-70' : ''
                  }`}
                >
                  <span
                    aria-hidden
                    className={`mt-1 h-2 w-2 shrink-0 rounded-full ${item.read ? 'bg-zinc-300' : 'bg-lime'}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className={`block text-[14px] ${item.read ? 'font-medium text-graphite' : 'font-semibold text-ink'}`}>
                      {item.title}
                    </span>
                    <span className="block truncate text-xs text-ink-2">{item.body}</span>
                  </span>
                  <span className="shrink-0 text-[11px] text-ink-2">{timeAgo(item.createdAt, locale)}</span>
                </button>
              ))
            )}
          </div>

          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="block border-t border-smoke px-4 py-3 text-center text-[13px] font-semibold text-ink hover:bg-surface-2 min-h-[44px]"
          >
            {t(locale, 'notifBell.viewAll')}
          </Link>
        </div>
      )}
    </div>
  );
}
