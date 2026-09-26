import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AlertCircle, Plus } from 'lucide-react';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logPiiAccess } from '@/lib/pii-audit';
import { PageHeader, Card, primaryBtnClass } from '@/components/ui';
import CustomersClient from '@/components/CustomersClient';
import type { CustomerRow } from '@/components/CustomersClient';
import { getLocale } from '@/lib/i18n/server';

/**
 * Customers list — defensive by design (production incident 2026-09-23:
 * /customers 500'd deterministically). Minimal selects, null-safe mapping,
 * and a DB failure renders an inline error card instead of a 500 page.
 */
export default async function CustomersPage() {
  const session = await getSession();
  if (!session?.user?.businessId) redirect('/login');
  const businessId = session.user.businessId;

  let customers: CustomerRow[] = [];
  let currency: string | undefined;
  let loadError: string | null = null;

  try {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { currency: true },
    });
    currency = business?.currency ?? undefined;

    const rows = await prisma.customer.findMany({
      where: { businessId },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        address: true,
        tags: true,
        _count: { select: { jobs: true } },
        jobs: { select: { price: true } },
      },
      orderBy: { name: 'asc' },
    });

    // PIPEDA accountability: log PII list access (fire-and-forget).
    logPiiAccess({
      businessId,
      userId: session.user.id,
      action: 'view',
      entityType: 'customer',
      metadata: { count: rows.length, view: 'list' },
    });

    customers = rows.map((c) => ({
      id: c.id ?? '',
      // Never assume the row is well-formed — a bad row renders as
      // "Unnamed customer" instead of crashing the whole page.
      name: c.name ?? 'Unnamed customer',
      phone: c.phone ?? null,
      email: c.email ?? null,
      address: c.address ?? null,
      tags: (c.tags ?? '').split(',').map((t) => t.trim()).filter(Boolean),
      jobCount: c._count?.jobs ?? 0,
      revenue: (c.jobs ?? []).reduce(
        (s, j) => s + (typeof j?.price === 'number' ? j.price : 0),
        0
      ),
    }));
  } catch (e) {
    console.error('[customers] failed to load customer list:', e);
    loadError =
      'We couldn\u2019t load your customers just now. Your data is safe — please try again.';
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        subtitle={`${customers.length} customer${customers.length === 1 ? '' : 's'}`}
        actions={
          <Link href="/customers/new" className={primaryBtnClass}>
            <Plus size={14} /> Add customer
          </Link>
        }
      />

      {loadError ? (
        <Card className="p-8 text-center">
          <div className="mx-auto w-11 h-11 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4">
            <AlertCircle size={22} />
          </div>
          <h2 className="text-base font-semibold text-zinc-900 mb-1">
            Couldn&apos;t load customers
          </h2>
          <p className="text-sm text-zinc-600 mb-5">{loadError}</p>
          <div className="flex items-center justify-center gap-3">
            <Link href="/customers" className={primaryBtnClass}>
              Try again
            </Link>
            <Link href="/customers/new" className="text-sm font-medium text-ink hover:underline">
              Add a customer
            </Link>
          </div>
        </Card>
      ) : (
        <CustomersClient
          customers={customers}
          currency={currency}
          locale={await getLocale()}
        />
      )}
    </div>
  );
}
