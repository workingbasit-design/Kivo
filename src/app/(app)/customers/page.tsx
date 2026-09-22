import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Users, Plus, Search, Phone } from 'lucide-react';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { formatMoney } from '@/lib/money';
import { PageHeader, Card, EmptyState, primaryBtnClass } from '@/components/ui';

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await getSession();
  if (!session?.user?.businessId) redirect('/login');
  const businessId = session.user.businessId;

  const { q } = await searchParams;
  const query = (q ?? '').trim();

  const business = await prisma.business.findUnique({ where: { id: businessId }, select: { currency: true } });
  const currency = business?.currency;
  const customers = await prisma.customer.findMany({
    where: {
      businessId,
      ...(query
        ? {
            OR: [
              { name: { contains: query } },
              { phone: { contains: query } },
              { email: { contains: query } },
            ],
          }
        : {}),
    },
    include: {
      _count: { select: { jobs: true } },
      jobs: { select: { price: true } },
    },
    orderBy: { name: 'asc' },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        subtitle={`${customers.length} customer${customers.length === 1 ? '' : 's'}${query ? ` matching "${query}"` : ''}`}
        actions={
          <Link href="/customers/new" className={primaryBtnClass}>
            <Plus size={14} /> Add customer
          </Link>
        }
      />

      <form action="/customers" method="get" className="relative max-w-md">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search name, phone or email…"
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#6329d4]/30 focus:border-[#6329d4]"
        />
      </form>

      {customers.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Users size={24} />}
            title={query ? 'No customers found' : 'No customers yet'}
            description={
              query
                ? 'Try a different search, or add a new customer.'
                : 'Add your first customer to start creating jobs and invoices for them.'
            }
            action={
              <Link href="/customers/new" className={primaryBtnClass}>
                <Plus size={14} /> Add customer
              </Link>
            }
          />
        </Card>
      ) : (
        <Card>
          <ul className="divide-y divide-zinc-100">
            {customers.map((c) => {
              const revenue = c.jobs.reduce((s, j) => s + (j.price ?? 0), 0);
              const initial = (c.name || '?').charAt(0).toUpperCase();
              return (
                <li key={c.id}>
                  <Link
                    href={`/customers/${c.id}`}
                    className="flex items-center gap-4 px-5 py-4 hover:bg-zinc-50 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-[#6329d4]/10 text-[#6329d4] flex items-center justify-center font-bold text-sm shrink-0">
                      {initial}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-zinc-900 truncate">{c.name}</p>
                      <p className="text-xs text-zinc-500 truncate flex items-center gap-1">
                        {c.phone ? (
                          <>
                            <Phone size={11} /> {c.phone}
                          </>
                        ) : (
                          'No phone'
                        )}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-sm text-zinc-900">{formatMoney(revenue, currency)}</p>
                      <p className="text-[11px] text-zinc-500">
                        {c._count.jobs} job{c._count.jobs === 1 ? '' : 's'}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
