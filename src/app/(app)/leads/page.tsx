import React from 'react';
import { UserPlus } from '@/components/icons';
import { requireAuth } from '@/lib/auth';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import { prisma } from '@/lib/prisma';
import { Card } from '@/components/kit';
import { AddLeadForm, LeadsBoard, type LeadItem } from './leads-client';
import { PageTitle } from '../_components/PageTitle';
import { EmptyState } from '@/components/kit';

export default async function LeadsPage() {
  const { businessId } = await requireAuth();
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
    declineReason: l.declineReason,
    createdAt: l.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <PageTitle
        title={T('title')}
        summary={
          newCount > 0
            ? T('subtitleWaiting', { count: newCount })
            : T('subtitleDefault')
        }
      />
      <div className="flex flex-wrap gap-2">
        <AddLeadForm locale={locale} />
      </div>

      {leads.length === 0 ? (
        <Card>
          <EmptyState
            icon={UserPlus}
            title={T('emptyTitle')}
            text={T('emptyDesc')}
          />
          <div className="flex justify-center pb-10 -mt-6">
            <AddLeadForm locale={locale} />
          </div>
        </Card>
      ) : (
        <LeadsBoard leads={items} locale={locale} />
      )}
    </div>
  );
}
