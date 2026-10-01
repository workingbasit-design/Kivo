import React from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { isDatabaseUnavailable } from '@/lib/db-errors';
import { prisma } from '@/lib/prisma';
import { dayRange, toISODateLocal, todayInTimezone } from '@/lib/utils';
import { summarizeTodayJobs } from '@/lib/dashboard';
import AppSidebar from '@/components/AppSidebar';
import MobileNav from '@/components/MobileNav';
import BottomNav from '@/components/BottomNav';
import LazyOverlays from '@/components/LazyOverlays';
import PortalNotice from '@/components/PortalNotice';
import { getLocale } from '@/lib/i18n/server';
import { syncNotifications, getUnreadCount } from '@/lib/notifications';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // A database outage must NEVER look like a logout: if we can't validate
  // the session, show "try again" instead of bouncing to /login (which used
  // to cause a /login <-> /dashboard redirect loop on pool exhaustion).
  let session: Awaited<ReturnType<typeof getSession>>;
  let locale: Awaited<ReturnType<typeof getLocale>>;
  try {
    // Session (DB) and locale (cookie) are independent — fetch together.
    [session, locale] = await Promise.all([getSession(), getLocale()]);
  } catch (err) {
    if (isDatabaseUnavailable(err)) return <PortalNotice variant="unavailable" />;
    throw err;
  }
  if (!session?.user?.businessId) redirect('/login');

  const businessId = session.user.businessId;

  // Shell data for the sidebar/stats. A database outage here renders the
  // same honest "try again" notice as a failed session lookup — never a
  // login redirect and never a generic 500.
  const loadShell = async () => {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { currency: true, regionCode: true, timezone: true },
    });

    // "Today" in the business's own timezone (falls back to America/Toronto).
    const today = todayInTimezone(business?.timezone);
    const { gte: start, lte: end } = dayRange(today);

    // Sidebar stats: booked revenue today + jobs remaining today + new leads
    const [todayJobs, newLeads] = await Promise.all([
      prisma.job.findMany({
        where: { businessId, date: { gte: start, lt: end } },
        select: { price: true, status: true },
      }),
      prisma.lead.count({ where: { businessId, status: 'NEW' } }),
    ]);
    return { business, todayJobs, newLeads };
  };
  // Shell data and notification sync are independent — start them together
  // instead of one after the other. The shell keeps its exact error
  // semantics: a database outage still renders the honest "try again"
  // notice (never a login redirect, never a generic 500).
  const shellPromise = loadShell();
  // Notification center: generate from real records (never seeded), then
  // count unread for the bell badge. Best-effort — a sync failure must never
  // break the app shell.
  const notifPromise = (async () => {
    try {
      await syncNotifications(businessId);
      return await getUnreadCount(businessId);
    } catch (err) {
      console.error('[notifications] sync failed', err);
      return 0;
    }
  })();
  let shell: Awaited<ReturnType<typeof loadShell>>;
  try {
    shell = await shellPromise;
  } catch (err) {
    if (isDatabaseUnavailable(err)) return <PortalNotice variant="unavailable" />;
    throw err;
  }
  const { business, todayJobs, newLeads } = shell;

  // Shared with the dashboard stats (2026-09-24: cancelled jobs no longer
  // count as booked revenue here either — same helper, same totals).
  const { bookedToday, jobsLeftToday } = summarizeTodayJobs(todayJobs);

  const unreadCount = await notifPromise;

  const user = {
    name: session.user.name ?? null,
    email: session.user.email,
  };

  return (
    <div className="min-h-screen bg-paper ej-app-wash flex">
      <AppSidebar
        user={user}
        locale={locale}
        stats={{ bookedToday, jobsLeftToday, newLeads, currency: business?.currency }}
        unreadCount={unreadCount}
      />
      <div className="flex-1 min-w-0 flex flex-col">
        <MobileNav locale={locale} unreadCount={unreadCount} />
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-8 py-6 md:py-8 pb-28 md:pb-8">
          {children}
        </main>
        <BottomNav user={user} locale={locale} />
      </div>
      <LazyOverlays currency={business?.currency} locale={locale} />
    </div>
  );
}
