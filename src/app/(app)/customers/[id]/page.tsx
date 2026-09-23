import React from 'react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, Phone, Mail, MapPin, StickyNote, Briefcase, FileText, Star } from 'lucide-react';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { formatDateShort } from '@/lib/utils';
import { formatMoney } from '@/lib/money';
import { PageHeader, Card, StatusBadge } from '@/components/ui';
import { secondaryBtnClass } from '@/components/ui';
import { EditCustomerForm, DeleteCustomerButton } from './customer-forms';
import WhatsAppButton from '@/components/WhatsAppButton';
import PortalLinkManager from '@/components/PortalLinkManager';
import { CA_PROVINCES } from '@/lib/tax';

/**
 * Minimal, null-tolerant customer load for the detail page. Selects only
 * what the page renders; the caller maps defensively.
 */
async function loadCustomer(id: string, businessId: string) {
  return prisma.customer.findFirst({
    where: { id, businessId },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      address: true,
      province: true,
      postalCode: true,
      notes: true,
      createdAt: true,
      jobs: {
        orderBy: { date: 'desc' },
        take: 10,
        select: { id: true, title: true, date: true, time: true, price: true, status: true },
      },
      invoices: {
        orderBy: { date: 'desc' },
        take: 10,
        select: { id: true, number: true, total: true, status: true, date: true },
      },
      reviews: {
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, rating: true, comment: true, source: true, createdAt: true },
      },
    },
  });
}

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session?.user?.businessId) redirect('/login');
  const businessId = session.user.businessId;

  // Defensive: any DB failure (bad row, schema drift) renders the friendly
  // error boundary instead of a raw 500 — see the 2026-09-23 /customers incident.
  let business: { currency: string | null; name: string | null } | null = null;
  let customer: Awaited<ReturnType<typeof loadCustomer>> = null;
  let activePortalToken: { id: string; createdAt: Date } | null = null;
  try {
    const { id } = await params;
    business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { currency: true, name: true },
    });
    customer = await loadCustomer(id, businessId);
    if (!customer) notFound();
    activePortalToken = await prisma.customerPortalToken.findFirst({
      where: {
        customerId: customer.id,
        businessId,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, createdAt: true },
    });
  } catch (e) {
    // notFound() throws a NEXT_NOT_FOUND sentinel — let it through.
    if (e instanceof Error && (e as { digest?: string }).digest === 'NEXT_NOT_FOUND') throw e;
    console.error('[customers] failed to load customer detail:', e);
    throw new Error('Could not load this customer. Your data is safe — please try again.');
  }

  const currency = business?.currency ?? 'CAD';
  const customerName = customer.name ?? 'Unnamed customer';
  const totalRevenue = (customer.jobs ?? []).reduce(
    (s, j) => s + (typeof j?.price === 'number' ? j.price : 0),
    0
  );
  const initial = (customerName || '?').charAt(0).toUpperCase();
  const regionCode = 'CA' as const;
  const provinceLabel = customer.province
    ? (CA_PROVINCES.find((p) => p.code === customer.province)?.name ?? customer.province)
    : '';

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title={customerName}
        subtitle="Customer details, history and notes."
        actions={
          <Link href="/customers" className={secondaryBtnClass}>
            <ArrowLeft size={14} /> All customers
          </Link>
        }
      />

      {/* Info + edit */}
      <Card className="p-6 md:p-8">
        <div className="flex items-start gap-4 mb-6">
          <div className="w-14 h-14 rounded-2xl bg-[#6329d4]/10 text-[#6329d4] flex items-center justify-center font-bold text-xl shrink-0">
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-zinc-900">{customerName}</h2>
            <p className="text-xs text-zinc-500">
              Customer since {formatDateShort(customer.createdAt)} · {formatMoney(totalRevenue, currency)} lifetime
            </p>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 text-sm mb-6">
          <div className="flex items-start gap-2.5">
            <Phone size={15} className="text-zinc-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Phone</p>
              <p className="text-zinc-800">{customer.phone ?? '—'}</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <Mail size={15} className="text-zinc-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Email</p>
              <p className="text-zinc-800 break-all">{customer.email ?? '—'}</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5 sm:col-span-2">
            <MapPin size={15} className="text-zinc-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Address</p>
              <p className="text-zinc-800 whitespace-pre-line">{customer.address ?? '—'}</p>
              {(provinceLabel || customer.postalCode) && (
                <p className="text-xs text-zinc-500 mt-1">
                  {[provinceLabel, customer.postalCode].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
          </div>
          {customer.notes && (
            <div className="flex items-start gap-2.5 sm:col-span-2">
              <StickyNote size={15} className="text-zinc-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Notes</p>
                <p className="text-zinc-800 whitespace-pre-line">{customer.notes}</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2 pt-4 border-t border-zinc-100">
          {/* Opens a wa.me chat with the customer — user taps to send from
              their own WhatsApp; EveryJob never sends anything automatically. */}
          <WhatsAppButton
            phone={customer.phone}
            regionCode={regionCode}
            message={`Hi ${customerName}! This is ${business?.name ?? 'us'}.`}
            label="WhatsApp"
          />
          <EditCustomerForm
            customer={{
              id: customer.id,
              name: customerName,
              phone: customer.phone,
              email: customer.email,
              address: customer.address,
              province: customer.province,
              postalCode: customer.postalCode,
              notes: customer.notes,
            }}
          />
          <DeleteCustomerButton customerId={customer.id} customerName={customerName} />
        </div>
      </Card>

      {/* Customer portal link — magic link on WhatsApp */}
      <Card className="p-6 md:p-8">
        <PortalLinkManager
          customerId={customer.id}
          customerName={customerName}
          customerPhone={customer.phone}
          businessName={business?.name ?? 'us'}
          regionCode={regionCode}
          initialTokenId={activePortalToken?.id ?? null}
        />
      </Card>

      {/* Job history */}
      <Card>
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center gap-2">
          <Briefcase size={16} className="text-zinc-400" />
          <h3 className="font-bold text-sm text-zinc-900">Job history</h3>
        </div>
        {customer.jobs.length === 0 ? (
          <p className="px-6 py-8 text-sm text-zinc-500 text-center">No jobs yet.</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {customer.jobs.map((j) => (
              <li key={j.id} className="flex items-center gap-3 px-6 py-3.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-zinc-900 truncate">{j.title}</p>
                  <p className="text-xs text-zinc-500">{formatDateShort(j.date)}</p>
                </div>
                <StatusBadge status={j.status} />
                <span className="text-sm font-bold text-zinc-900 shrink-0">{formatMoney(j.price, currency)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Invoice history */}
      <Card>
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center gap-2">
          <FileText size={16} className="text-zinc-400" />
          <h3 className="font-bold text-sm text-zinc-900">Invoices</h3>
        </div>
        {customer.invoices.length === 0 ? (
          <p className="px-6 py-8 text-sm text-zinc-500 text-center">No invoices yet.</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {customer.invoices.map((inv) => (
              <li key={inv.id} className="flex items-center gap-3 px-6 py-3.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-zinc-900">#{inv.number}</p>
                  <p className="text-xs text-zinc-500">{formatDateShort(inv.date)}</p>
                </div>
                <StatusBadge status={inv.status} />
                <span className="text-sm font-bold text-zinc-900 shrink-0">{formatMoney(inv.total, currency)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Reviews */}
      {customer.reviews.length > 0 && (
        <Card>
          <div className="px-6 py-4 border-b border-zinc-100 flex items-center gap-2">
            <Star size={16} className="text-zinc-400" />
            <h3 className="font-bold text-sm text-zinc-900">Reviews</h3>
          </div>
          <ul className="divide-y divide-zinc-100">
            {customer.reviews.map((r) => (
              <li key={r.id} className="px-6 py-3.5">
                <p className="text-sm text-amber-500 font-bold">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</p>
                {r.comment && <p className="text-sm text-zinc-700 mt-1">{r.comment}</p>}
                <p className="text-xs text-zinc-500 mt-1">{formatDateShort(r.createdAt)}{r.source ? ` · ${r.source}` : ''}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
