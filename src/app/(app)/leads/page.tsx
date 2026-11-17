import React from 'react';
import { UserPlus } from '@/components/icons';
import { requireAuth } from '@/lib/auth';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import { prisma } from '@/lib/prisma';
import { Card } from '@/components/kit';
import { AddLeadForm, LeadsBoard, LeadsHeader, type LeadItem } from './leads-client';
import { EmptyState } from '@/components/kit';
import { parseListLimit, takeWithProbe, sliceListPage } from '@/lib/list-page';
import { ListMore } from '../_components/ListMore';

export default async function LeadsPage({
  searchParams,
}: {
  searchParams?: Promise<{ limit?: string }>;
}) {
  const { businessId } = await requireAuth();
  const locale = await getLocale();
  const limit = parseListLimit((await searchParams)?.limit);
  const T = (k: string, vars?: Record<string, string | number>) => {
    let s = t(locale, `leads.${k}`);
    if (vars) for (const [key, v] of Object.entries(vars)) s = s.split(`{${key}}`).join(String(v));
    return s;
  };

  // M3: bounded read; the "waiting" count comes from the database, not the
  // fetched page, so it stays exact when the list is capped.
  const [fetched, total, newCount] = await Promise.all([
    prisma.lead.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
      take: takeWithProbe(limit),
    }),
    prisma.lead.count({ where: { businessId } }),
    prisma.lead.count({ where: { businessId, status: 'NEW' } }),
  ]);
  const page = sliceListPage(fetched, limit);
  const leads = page.rows;

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
      <LeadsHeader
        locale={locale}
        title={T('title')}
        summary={
          newCount > 0
            ? T('subtitleWaiting', { count: newCount })
            : T('subtitleDefault')
        }
      />

      {leads.length === 0 ? (
        <Card>
          <EmptyState
            icon={<UserPlus />}
            title={T('emptyTitle')}
            text={T('emptyDesc')}
          />
          <div className="flex justify-center pb-10 -mt-6">
            <AddLeadForm locale={locale} />
          </div>
        </Card>
      ) : (
        <>
          <LeadsBoard leads={items} locale={locale} />
          <ListMore
            shown={items.length}
            total={total}
            nextLimit={page.nextLimit}
            locale={locale}
            basePath="/leads"
          />
        </>
      )}
    </div>
  );
}
