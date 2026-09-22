import React from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { dayRange, toISODateLocal } from '@/lib/utils';
import AppSidebar from '@/components/AppSidebar';
import MobileNav from '@/components/MobileNav';
import GlobalCopilotWidget from '@/components/GlobalCopilotWidget';
import { getLocale } from '@/lib/i18n/server';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session?.user?.businessId) redirect('/login');
  const locale = await getLocale();

  const businessId = session.user.businessId;
  const today = toISODateLocal(new Date());
  const { gte: start, lte: end } = dayRange(today);

  // Sidebar stats: booked revenue today + jobs remaining today + new leads
  const [business, todayJobs, newLeads] = await Promise.all([
    prisma.business.findUnique({ where: { id: businessId }, select: { currency: true } }),
    prisma.job.findMany({
      where: { businessId, date: { gte: start, lt: end } },
      select: { price: true, status: true },
    }),
    prisma.lead.count({ where: { businessId, status: 'NEW' } }),
  ]);

  const bookedToday = todayJobs.reduce((s, j) => s + (j.price ?? 0), 0);
  const jobsLeftToday = todayJobs.filter(
    (j) => !['COMPLETED', 'PAID', 'CANCELLED'].includes(j.status)
  ).length;

  const user = {
    name: session.user.name ?? null,
    email: session.user.email,
  };

  return (
    <div className="min-h-screen bg-[#fafafa] flex">
      <AppSidebar
        user={user}
        locale={locale}
        stats={{ bookedToday, jobsLeftToday, newLeads, currency: business?.currency }}
      />
      <div className="flex-1 min-w-0 flex flex-col">
        <MobileNav user={user} locale={locale} />
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-8 py-6 md:py-8">
          {children}
        </main>
      </div>
      <GlobalCopilotWidget currency={business?.currency} />
    </div>
  );
}
