import React from 'react';
import Link from 'next/link';
import { AlertCircle, Plus } from '@/components/icons';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logPiiAccess } from '@/lib/pii-audit';
import { Card, Button } from '@/components/kit';
import CustomersClient from '@/components/CustomersClient';
import type { CustomerRow } from '@/components/CustomersClient';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import { centsToDollars } from '@/lib/money';
import { PageHeader} from '@/components/kit';
import { parseListLimit, takeWithProbe, sliceListPage } from '@/lib/list-page';
import { ListMore } from '../_components/ListMore';

/**
 * Customers list - defensive by design (production incident 2026-09-23:
 * /customers 500'd deterministically). Minimal selects, null-safe mapping,
 * and a DB failure renders an inline error card instead of a 500 page.
 */
export default async function CustomersPage({
  searchParams,
}: {
  searchParams?: Promise<{ limit?: string }>;
}) {
  const { businessId, user } = await requireAuth();
  const locale = await getLocale();
  const custL = (k: string) => t(locale, 'customers.' + k);
  const limit = parseListLimit((await searchParams)?.limit);

  let customers: CustomerRow[] = [];
  let currency: string | undefined;
  let loadError: string | null = null;
  let totalCustomers = 0;
  let nextLimit: number | null = null;

  try {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { currency: true },
    });
    currency = business?.currency ?? undefined;

    // M3: bounded read. This used to fetch every customer AND every one of
    // their job rows (`jobs: { select: { priceCents: true } }`) purely to sum
    // revenue per customer - so the payload grew with jobs x customers. The
    // page is now capped, and revenue is summed BY THE DATABASE for just the
    // customers on screen.
    const [fetched, total] = await Promise.all([
      prisma.customer.findMany({
        where: { businessId, archivedAt: null },
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          address: true,
          tags: true,
          _count: { select: { jobs: true } },
        },
        orderBy: { name: 'asc' },
        take: takeWithProbe(limit),
      }),
      prisma.customer.count({ where: { businessId, archivedAt: null } }),
    ]);
    const page = sliceListPage(fetched, limit);
    const rows = page.rows;
    totalCustomers = total;
    nextLimit = page.nextLimit;

    const revenueByCustomer = new Map<string, number>();
    if (rows.length > 0) {
      const grouped = await prisma.job.groupBy({
        by: ['customerId'],
        where: { businessId, customerId: { in: rows.map((r) => r.id) } },
        _sum: { priceCents: true },
      });
      for (const g of grouped) {
        if (g.customerId) {
          revenueByCustomer.set(g.customerId, centsToDollars(g._sum.priceCents ?? 0));
        }
      }
    }

    // PIPEDA accountability: log PII list access (fire-and-forget).
    logPiiAccess({
      businessId,
      userId: user.id,
      action: 'view',
      entityType: 'customer',
      metadata: { count: rows.length, view: 'list' },
    });

    customers = rows.map((c) => ({
      id: c.id ?? '',
      // Never assume the row is well-formed - a bad row renders as
      // "Unnamed customer" instead of crashing the whole page.
      name: c.name ?? custL('unnamed'),
      phone: c.phone ?? null,
      email: c.email ?? null,
      address: c.address ?? null,
      tags: (c.tags ?? '').split(',').map((t) => t.trim()).filter(Boolean),
      jobCount: c._count?.jobs ?? 0,
      revenue: revenueByCustomer.get(c.id ?? '') ?? 0,
    }));
  } catch (e) {
    console.error('[customers] failed to load customer list:', e);
    loadError = custL('loadErrorBody');
  }

  // The header count is the real total from the database, not the page size.
  const countLabel = custL(totalCustomers === 1 ? 'countOne' : 'countOther').replace(
    '{count}',
    String(totalCustomers)
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={custL('title')}
        summary={countLabel}
        actionLabel={custL('addCustomer')}
        actionHref="/customers/new"
        actionIcon={<Plus />}
      />

      {loadError ? (
        <Card className="p-8 text-center">
          <div className="mx-auto w-11 h-11 rounded-2xl bg-danger-bg text-danger flex items-center justify-center mb-4">
            <AlertCircle size={22} />
          </div>
          <h2 className="text-base font-semibold text-ink mb-1">
            {custL('loadErrorTitle')}
          </h2>
          <p className="text-sm text-ink-2 mb-5">{loadError}</p>
          <div className="flex items-center justify-center gap-3">
            <Button href="/customers" variant="primary">
              {custL('tryAgain')}
            </Button>
            <Link href="/customers/new" className="text-sm font-medium text-ink hover:underline">
              {custL('addACustomer')}
            </Link>
          </div>
        </Card>
      ) : (
        <>
          <CustomersClient
            customers={customers}
            currency={currency}
            locale={locale}
          />
          <ListMore
            shown={customers.length}
            total={totalCustomers}
            nextLimit={nextLimit}
            locale={locale}
            basePath="/customers"
          />
        </>
      )}
    </div>
  );
}
