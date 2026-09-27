import React from 'react';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { PageHeader, Card, EmptyState } from '@/components/ui';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import { formatMoney } from '@/lib/money';
import { Package, Plus } from 'lucide-react';
import InventoryClient from '@/components/InventoryClient';

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
    (sum, p) => sum + (p.quantity * (p.unitCost ?? 0)),
    0
  );

  const serialized = parts.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    quantity: p.quantity,
    reorderPoint: p.reorderPoint,
    unitCost: p.unitCost,
    unit: p.unit,
    lowStock: p.reorderPoint != null && p.quantity <= p.reorderPoint,
    outOfStock: p.quantity <= 0,
  }));

  return (
    <div className="space-y-5">
      <PageHeader
        title={T('title')}
        subtitle={T('subtitle')}
        actions={
          <Link
            href="/inventory/new"
            className="inline-flex items-center gap-1.5 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white hover:bg-graphite min-h-[44px]"
          >
            <Plus size={16} /> {T('add')}
          </Link>
        }
      />

      {parts.length > 0 && (
        <Card className="flex items-center justify-between">
          <span className="text-sm text-zinc-600">{T('totalValue')}</span>
          <span className="text-lg font-bold tabular-nums">
            {formatMoney(totalValue, business?.currency)}
          </span>
        </Card>
      )}

      {parts.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Package size={24} />}
            title={query ? T('noResults') : T('emptyTitle')}
            description={query ? T('noResultsDesc') : T('emptyDesc')}
            action={
              !query ? (
                <Link
                  href="/inventory/new"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white hover:bg-graphite min-h-[44px]"
                >
                  <Plus size={16} /> {T('add')}
                </Link>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <InventoryClient parts={serialized} locale={locale} initialQuery={query} />
      )}
    </div>
  );
}
