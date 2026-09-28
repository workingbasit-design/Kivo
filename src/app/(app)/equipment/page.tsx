import React from 'react';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { PageHeader, Card, EmptyState, inputClass } from '@/components/ui';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import { Wrench, Plus, ChevronRight } from 'lucide-react';
import EquipmentSearch from '@/components/EquipmentSearch';

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
        subtitle={T('subtitle')}
        actions={
          <Link
            href="/equipment/new"
            className="inline-flex items-center gap-1.5 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white hover:bg-graphite min-h-[44px]"
          >
            <Plus size={16} /> {T('add')}
          </Link>
        }
      />

      <EquipmentSearch initialQuery={query} locale={locale} />

      {equipment.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Wrench size={24} />}
            title={query ? T('noResults') : T('emptyTitle')}
            description={query ? T('noResultsDesc') : T('emptyDesc')}
            action={
              !query ? (
                <Link
                  href="/equipment/new"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white hover:bg-graphite min-h-[44px]"
                >
                  <Plus size={16} /> {T('add')}
                </Link>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {equipment.map((eq) => (
            <Link key={eq.id} href={`/equipment/${eq.id}`} className="block">
              <Card className="hover:border-zinc-300 transition-colors h-full">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm text-zinc-900 truncate">{eq.name}</p>
                    <p className="text-xs text-zinc-500 truncate mt-0.5">
                      {[eq.brand, eq.model].filter(Boolean).join(' · ') || T('noDetails')}
                    </p>
                    {eq.serial && (
                      <p className="text-xs text-zinc-400 font-mono mt-1 truncate">
                        {T('serial')}: {eq.serial}
                      </p>
                    )}
                  </div>
                  <ChevronRight size={16} className="text-zinc-300 shrink-0 mt-1" />
                </div>
                <div className="mt-3 pt-3 border-t border-zinc-100">
                  <Link
                    href={`/customers/${eq.customer.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-xs font-medium text-lime-700 hover:text-lime-800 truncate block"
                  >
                    {eq.customer.name}
                  </Link>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
