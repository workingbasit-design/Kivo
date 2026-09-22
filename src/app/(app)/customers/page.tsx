import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Plus } from 'lucide-react';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PageHeader, primaryBtnClass } from '@/components/ui';
import CustomersClient from '@/components/CustomersClient';

export default async function CustomersPage() {
  const session = await getSession();
  if (!session?.user?.businessId) redirect('/login');
  const businessId = session.user.businessId;

  const business = await prisma.business.findUnique({ where: { id: businessId }, select: { currency: true } });
  const currency = business?.currency;
  const rows = await prisma.customer.findMany({
    where: { businessId },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      address: true,
      _count: { select: { jobs: true } },
      jobs: { select: { price: true } },
    },
    orderBy: { name: 'asc' },
  });

  const customers = rows.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    email: c.email,
    address: c.address,
    jobCount: c._count.jobs,
    revenue: c.jobs.reduce((s, j) => s + (j.price ?? 0), 0),
  }));

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

      <CustomersClient customers={customers} currency={currency} />
    </div>
  );
}
