import React from 'react';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { Card } from '@/components/kit';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import { formatMoney, centsToDollars } from '@/lib/money';
import { Package, Plus } from '@/components/icons';
import InventoryClient from '@/components/InventoryClient';
import { PageHeader, EmptyState, Button } from '@/components/kit';

export const dynamic = 'force-dynamic';

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { businessId } = await requireAuth();
  const locale = await getLocale();
  const T = (k: string) => t(locale, `inventory.${k}`);

  const { q } = await searchParams;
  const query = (q ?? '').trim();

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { currency: true },
  });

  const parts = await prisma.part.findMany({
    where: {
      businessId,
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { sku: { contains: query, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    orderBy: { name: 'asc' },
    take: 200,
  });

  const totalValue = parts.reduce(
    (sum, p) => sum + p.quantity * centsToDollars(p.unitCostCents),
    0
  );

  const serialized = parts.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    quantity: p.quantity,
    reorderPoint: p.reorderPoint,
    unitCost: p.unitCostCents == null ? null : centsToDollars(p.unitCostCents),
    unit: p.unit,
    lowStock: p.reorderPoint != null && p.quantity <= p.reorderPoint,
    outOfStock: p.quantity <= 0,
  }));

  return (
    <div className="space-y-5">
      <PageHeader
        title={T('title')}
        summary={T('subtitle')}
        actionLabel={T('add')}
        actionHref="/inventory/new"
        actionIcon={Plus}
      />

      {parts.length > 0 && (
        <Card className="flex items-center justify-between">
          <span className="text-sm text-ink-2">{T('totalValue')}</span>
          <span className="text-lg font-bold tabular-nums">
            {formatMoney(totalValue, business?.currency)}
          </span>
        </Card>
      )}

      {parts.length === 0 ? (
        <Card>
          <EmptyState
            icon={Package}
            title={query ? T('noResults') : T('emptyTitle')}
            text={query ? T('noResultsDesc') : T('emptyDesc')}
          />
          {!query ? (
            <div className="flex justify-center pb-10 -mt-6">
              <Button href="/inventory/new" variant="primary">
                <Plus size={16} /> {T('add')}
              </Button>
            </div>
          ) : null}
        </Card>
      ) : (
        <InventoryClient parts={serialized} locale={locale} initialQuery={query} />
      )}
    </div>
  );
}
