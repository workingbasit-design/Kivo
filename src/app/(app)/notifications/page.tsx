import Link from 'next/link';
import { Bell, CheckCheck, Check, ChevronRight } from 'lucide-react';
import { requireAuth } from '@/lib/auth';
import { getLocale } from '@/lib/i18n/server';
import { t, type Locale } from '@/lib/i18n';
import {
  listNotifications,
  renderNotificationTitle,
  renderNotificationBody,
  type ListedNotification,
} from '@/lib/notifications';
import { PageHeader, Card, secondaryBtnClass } from '@/components/ui';
import { formatDateShort } from '@/lib/utils';
import {
  markAllNotificationsRead,
  markNotificationRead,
} from '@/app/actions/notifications';

export const metadata = { title: 'Notifications | EveryJob' };

const TYPE_ICON_BG: Record<string, string> = {
  job_tomorrow: 'bg-blue-100 text-blue-700',
  job_soon: 'bg-amber-100 text-amber-700',
  invoice_overdue: 'bg-red-100 text-red-700',
  quote_expiring: 'bg-purple-100 text-purple-700',
  booking_new: 'bg-lime-100 text-lime-800',
  payment_recorded: 'bg-emerald-100 text-emerald-700',
};

function timeAgo(createdAt: Date, locale: Locale): string {
  const mins = Math.max(0, Math.round((Date.now() - createdAt.getTime()) / 60000));
  if (mins < 1) return t(locale, 'notifications.justNow');
  if (mins < 60) return locale === 'fr' ? `il y a ${mins} min` : `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return locale === 'fr' ? `il y a ${hours} h` : `${hours}h ago`;
  return formatDateShort(createdAt, locale === 'fr' ? 'fr-CA' : 'en-CA');
}

function NotificationRow({
  n,
  locale,
}: {
  n: ListedNotification;
  locale: Locale;
}) {
  const title = renderNotificationTitle(n.type, n.data, locale);
  const body = renderNotificationBody(n.type, n.data, locale);
  const unread = !n.readAt;
  return (
    <div
      className={`flex items-start gap-3 rounded-2xl border p-4 transition-colors ${
        unread
          ? 'border-ink/20 bg-white shadow-[0_8px_24px_-16px_rgba(22,22,22,0.4)]'
          : 'border-smoke bg-white/60'
      }`}
    >
      <span
        aria-hidden
        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
          TYPE_ICON_BG[n.type] ?? 'bg-zinc-100 text-zinc-600'
        }`}
      >
        <Bell size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-[15px] tracking-[-0.01em] ${unread ? 'font-semibold text-ink' : 'font-medium text-graphite'}`}>
            {title}
            {unread && (
              <span className="ml-2 inline-block h-2 w-2 rounded-full bg-lime align-middle" aria-label={t(locale, 'notifications.unread')} />
            )}
          </p>
          <span className="shrink-0 text-xs text-zinc-400">{timeAgo(n.createdAt, locale)}</span>
        </div>
        <p className="mt-0.5 text-sm text-graphite">{body}</p>
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          {n.href && (
            <Link
              href={`/notifications/${n.id}/open`}
              className="inline-flex items-center gap-1 min-h-[44px] text-[13px] font-semibold text-ink underline-offset-4 hover:underline px-2 -ml-2"
            >
              {t(locale, 'notifications.viewDetails')}
              <ChevronRight size={14} />
            </Link>
          )}
          {unread && (
            <form action={markNotificationRead.bind(null, n.id)}>
              <button
                type="submit"
                className="inline-flex items-center gap-1 min-h-[44px] text-[13px] text-graphite underline-offset-4 hover:text-ink hover:underline px-2 -ml-2"
              >
                <Check size={14} />
                {t(locale, 'notifications.markRead')}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default async function NotificationsPage() {
  const { businessId } = await requireAuth();
  const locale = await getLocale();
  const items = await listNotifications(businessId);
  const unreadCount = items.filter((i) => !i.readAt).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t(locale, 'notifications.title')}
        subtitle={t(locale, 'notifications.subtitle')}
        actions={
          unreadCount > 0 ? (
            <form action={markAllNotificationsRead}>
              <button type="submit" className={secondaryBtnClass}>
                <CheckCheck size={14} />
                {t(locale, 'notifications.markAllRead')}
              </button>
            </form>
          ) : undefined
        }
      />

      {items.length === 0 ? (
        <Card className="p-10 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-lime/25">
            <Bell size={22} className="text-ink" />
          </div>
          <p className="text-[16px] font-semibold text-ink">{t(locale, 'notifications.empty')}</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-graphite">
            {t(locale, 'notifications.emptyHint')}
          </p>
          <Link href="/settings" className={`${secondaryBtnClass} mt-5 inline-flex`}>
            {t(locale, 'notifications.settingsTitle')}
          </Link>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((n) => (
            <NotificationRow key={n.id} n={n} locale={locale} />
          ))}
        </div>
      )}
    </div>
  );
}
