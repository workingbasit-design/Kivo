import React from 'react';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import { Wrench, Plus, ChevronRight } from '@/components/icons';
import { centsToDollars, formatMoney } from '@/lib/money';
import { localeMoneyTag } from '@/lib/utils';
import EquipmentSearch from '@/components/EquipmentSearch';
import { PageHeader, EmptyState, Button, Card } from '@/components/kit';

export const dynamic = 'force-dynamic';

export default async function EquipmentPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { businessId } = await requireAuth();
  const locale = await getLocale();
  const T = (k: string) => t(locale, `equipment.${k}`);

  const { q } = await searchParams;
  const query = (q ?? '').trim();

  const equipment = await prisma.equipment.findMany({
    where: {
      businessId,
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { brand: { contains: query, mode: 'insensitive' } },
              { model: { contains: query, mode: 'insensitive' } },
              { serial: { contains: query, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    include: { customer: { select: { id: true, name: true } } },
    orderBy: { updatedAt: 'desc' },
    take: 100,
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title={T('title')}
        summary={T('subtitle')}
        actionLabel={T('add')}
        actionHref="/equipment/new"
        actionIcon={<Plus />}
      />

      <EquipmentSearch initialQuery={query} locale={locale} />

      {equipment.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Wrench />}
            title={query ? T('noResults') : T('emptyTitle')}
            text={query ? T('noResultsDesc') : T('emptyDesc')}
          />
          {!query ? (
            <div className="flex justify-center pb-10 -mt-6">
              <Button href="/equipment/new" variant="primary">
                <Plus size={16} /> {T('add')}
              </Button>
            </div>
          ) : null}
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {equipment.map((eq) => (
            <Card key={eq.id} className="hover:border-line-strong transition-colors h-full">
              <Link href={`/equipment/${eq.id}`} className="block">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm text-ink truncate">{eq.name}</p>
                    <p className="text-xs text-ink-2 truncate mt-0.5">
                      {[eq.brand, eq.model].filter(Boolean).join(' · ') || T('noDetails')}
                    </p>
                    {eq.serial && (
                      <p className="text-xs text-ink-2 font-mono mt-1 truncate">
                        {T('serial')}: {eq.serial}
                      </p>
                    )}
                    {eq.purchaseCostCents != null && (
                      <p className="text-xs text-ink-2 mt-1 truncate">
                        {T('purchaseCost')}:{' '}
                        <span className="font-semibold text-ink">
                          {formatMoney(centsToDollars(eq.purchaseCostCents), 'CAD', localeMoneyTag(locale))}
                        </span>
                      </p>
                    )}
                  </div>
                  <ChevronRight size={16} className="text-ink-2 shrink-0 mt-1" />
                </div>
              </Link>
              <div className="mt-3 pt-3 border-t border-line">
                <Link
                  href={`/customers/${eq.customer.id}`}
                  className="text-xs font-medium text-ink hover:text-hivis-ink truncate block"
                >
                  {eq.customer.name}
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
