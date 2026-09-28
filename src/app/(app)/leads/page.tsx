import React from 'react';
import { redirect } from 'next/navigation';
import { UserPlus } from 'lucide-react';
import { getSession } from '@/lib/auth';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import { prisma } from '@/lib/prisma';
import { PageHeader, Card, EmptyState } from '@/components/ui';
import { AddLeadForm, LeadsBoard, type LeadItem } from './leads-client';

export default async function LeadsPage() {
  const session = await getSession();
  if (!session?.user?.businessId) redirect('/login');
  const businessId = session.user.businessId;
  const locale = await getLocale();
  const T = (k: string, vars?: Record<string, string | number>) => {
    let s = t(locale, `leads.${k}`);
    if (vars) for (const [key, v] of Object.entries(vars)) s = s.split(`{${key}}`).join(String(v));
    return s;
  };

  const leads = await prisma.lead.findMany({
    where: { businessId },
    orderBy: { createdAt: 'desc' },
  });

  const newCount = leads.filter((l) => l.status === 'NEW').length;

  // Serialize for the client component boundary (dates as ISO strings).
  const items: LeadItem[] = leads.map((l) => ({
    id: l.id,
    name: l.name,
    phone: l.phone,
    email: l.email,
    details: l.details,
    source: l.source,
    status: l.status,
    createdAt: l.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={T('title')}
        subtitle={
          newCount > 0
            ? T('subtitleWaiting', { count: newCount })
            : T('subtitleDefault')
        }
        actions={<AddLeadForm locale={locale} />}
      />

      {leads.length === 0 ? (
        <Card>
          <EmptyState
            icon={<UserPlus size={24} />}
            title={T('emptyTitle')}
            description={T('emptyDesc')}
            action={<AddLeadForm locale={locale} />}
          />
        </Card>
      ) : (
        <LeadsBoard leads={items} locale={locale} />
      )}
    </div>
  );
}
