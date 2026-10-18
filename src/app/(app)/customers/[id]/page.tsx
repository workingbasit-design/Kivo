import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Clock3, Phone, Mail, MapPin, MessageSquare, Navigation, Plus } from '@/components/icons';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logPiiAccess } from '@/lib/pii-audit';
import { formatDateShort } from '@/lib/utils';
import { formatMoney, centsToDollars } from '@/lib/money';
import { formatDisplayDate } from '@/lib/attention';
import { Card, Button } from '@/components/kit';


import { EditCustomerForm, DeleteCustomerButton, ArchiveCustomerButton } from './customer-forms';
import WhatsAppButton from '@/components/WhatsAppButton';
import SmsButton from '@/components/SmsButton';
import PortalLinkManager from '@/components/PortalLinkManager';
import CustomerConsentCard from '@/components/CustomerConsentCard';
import CustomerProperties from '@/components/CustomerProperties';
import CustomerCustomFields from '@/components/CustomerCustomFields';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import { CA_PROVINCES } from '@/lib/tax';
import { PageHeader, EmptyState, Chip } from '@/components/kit';
import { Timeline } from '../../_components/Timeline';

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
      archivedAt: true,
      phone: true,
      email: true,
      address: true,
      province: true,
      postalCode: true,
      notes: true,
      tags: true,
      messageConsent: true,
      messageConsentAt: true,
      preferredLocale: true,
      createdAt: true,
      jobs: {
        orderBy: { date: 'desc' },
        take: 10,
        select: { id: true, title: true, date: true, time: true, priceCents: true, status: true },
      },
      invoices: {
        orderBy: { date: 'desc' },
        take: 10,
        select: { id: true, number: true, totalCents: true, status: true, date: true },
      },
      reviews: {
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, rating: true, comment: true, source: true, createdAt: true },
      },
      properties: {
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
        select: { id: true, label: true, address: true, notes: true, isPrimary: true },
      },
      fieldValues: {
        select: { fieldId: true, value: true },
      },
      equipment: {
        orderBy: { updatedAt: 'desc' },
        select: { id: true, name: true, brand: true, model: true, serial: true },
      },
    },
  });
}

/** E5: Quick contact action button. 48px touch target, icon + label. */
function ContactAction({
  href,
  icon,
  label,
  disabled,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
}) {
  if (disabled) {
    return (
      <span className="flex-1 min-w-0 flex flex-col items-center gap-1 py-3 rounded-xl bg-ej-surface text-ej-disabled cursor-not-allowed">
        {icon}
        <span className="text-xs font-semibold">{label}</span>
      </span>
    );
  }
  return (
    <a
      href={href}
      className="flex-1 min-w-0 flex flex-col items-center gap-1 py-3 rounded-xl bg-ej-surface text-ej-ink hover:bg-ej-border/50 active:bg-ej-border transition-colors min-h-[48px] justify-center"
    >
      {icon}
      <span className="text-xs font-semibold">{label}</span>
    </a>
  );
}

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { businessId, user } = await requireAuth();

  let business: { currency: string | null; name: string | null; timezone: string | null } | null = null;
  let customer: Awaited<ReturnType<typeof loadCustomer>> = null;
  let activePortalToken: { id: string; createdAt: Date } | null = null;
  let fieldDefs: { id: string; name: string }[] = [];
  try {
    const { id } = await params;
    business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { currency: true, name: true, timezone: true },
    });
    customer = await loadCustomer(id, businessId);
    if (!customer) notFound();
    logPiiAccess({
      businessId,
      userId: user.id,
      action: 'view',
      entityType: 'customer',
      entityId: customer.id,
      metadata: { view: 'detail' },
    });
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
    fieldDefs = await prisma.customFieldDef.findMany({
      where: { businessId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true },
    });
  } catch (e) {
    const digest = e instanceof Error ? (e as { digest?: string }).digest : undefined;
    if (digest === 'NEXT_NOT_FOUND' || digest?.startsWith('NEXT_HTTP_ERROR_FALLBACK;404')) throw e;
    console.error('[customers] failed to load customer detail:', e);
    throw new Error('Could not load this customer. Your data is safe - please try again.');
  }

  const currency = business?.currency ?? 'CAD';
  const locale = await getLocale();
  const tz = business?.timezone ?? 'America/Toronto';
  const custL = (k: string) => t(locale, 'customers.' + k);
  const customerName = customer.name ?? custL('unnamed');
  const totalRevenue = (customer.jobs ?? []).reduce(
    (s, j) => s + centsToDollars(j?.priceCents),
    0
  );
  const initial = (customerName || '?').charAt(0).toUpperCase();
  const regionCode = 'CA' as const;
  const provinceLabel = customer.province
    ? (CA_PROVINCES.find((p) => p.code === customer.province)?.name ?? customer.province)
    : '';
  const fullAddress = [
    customer.address,
    [provinceLabel, customer.postalCode].filter(Boolean).join(' '),
  ].filter(Boolean).join(', ');

  // E5: Build unified history timeline (jobs + invoices + reviews, newest first).
  const timelineItems = [
    ...(customer.jobs ?? []).map((j) => ({
      title: j.title,
      timestamp: formatDisplayDate(j.date, tz, locale),
      description: `${formatMoney(centsToDollars(j.priceCents), currency)}`,
      sortKey: j.date.getTime(),
    })),
    ...(customer.invoices ?? []).map((inv) => ({
      title: `Invoice ${inv.number}`,
      timestamp: formatDisplayDate(inv.date, tz, locale),
      description: `${formatMoney(centsToDollars(inv.totalCents), currency)}, ${inv.status.toLowerCase()}`,
      sortKey: inv.date.getTime(),
    })),
    ...(customer.reviews ?? []).map((r) => ({
      title: `${r.rating} star review${r.source ? ` via ${r.source}` : ''}`,
      timestamp: formatDisplayDate(r.createdAt, tz, locale),
      description: r.comment ?? undefined,
      sortKey: r.createdAt.getTime(),
    })),
  ].sort((a, b) => b.sortKey - a.sortKey).slice(0, 15);

  const phoneHref = customer.phone ? `tel:${customer.phone.replace(/\s/g, '')}` : '';
  const smsHref = customer.phone ? `sms:${customer.phone.replace(/\s/g, '')}` : '';
  const emailHref = customer.email ? `mailto:${customer.email}` : '';
  const mapHref = fullAddress
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`
    : '';

  return (
    <div className="space-y-6 max-w-4xl">
      <Button href="/customers" variant="secondary" className=" self-start">
        <ArrowLeft size={14} /> {custL('allCustomers')}
      </Button>
      <PageHeader
        title={customerName}
        summary={custL('detailSubtitle')}
        actionLabel={t(locale, 'jobs.newJob')}
        actionHref={`/jobs/new?customerId=${customer.id}`}
        actionIcon={Plus}
      />

      {/* E5: Identity + quick contact actions */}
      <Card className="p-6 md:p-8">
        <div className="flex items-start gap-4 mb-6">
          <div className="w-14 h-14 rounded-2xl bg-ej-surface text-ej-ink flex items-center justify-center font-bold text-xl shrink-0">
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-ej-ink flex items-center gap-2 flex-wrap">
              {customerName}
              {customer.archivedAt && (
                <Chip>{t(locale, 't10money.custArchivedBadge')}</Chip>
              )}
            </h2>
            <p className="text-xs text-ej-muted mt-0.5">
              {custL('customerSince').replace('{date}', formatDateShort(customer.createdAt))}
              {', '}
              {custL('lifetimeValue').replace('{amount}', formatMoney(totalRevenue, currency))}
            </p>
          </div>
        </div>

        {/* E5: One-tap contact actions. 48px targets, native protocols. */}
        <div className="flex gap-2 mb-6">
          <ContactAction
            href={phoneHref}
            icon={<Phone size={20} />}
            label={custL('actionCall')}
            disabled={!customer.phone}
          />
          <ContactAction
            href={smsHref}
            icon={<MessageSquare size={20} />}
            label={custL('actionText')}
            disabled={!customer.phone}
          />
          <ContactAction
            href={emailHref}
            icon={<Mail size={20} />}
            label={custL('actionEmail')}
            disabled={!customer.email}
          />
          <ContactAction
            href={mapHref}
            icon={<Navigation size={20} />}
            label={custL('actionMap')}
            disabled={!fullAddress}
          />
        </div>

        {/* Address with directions link */}
        {(customer.address || provinceLabel || customer.postalCode) && (
          <div className="flex items-start gap-2.5 mb-4">
            <MapPin size={15} className="text-ej-muted mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm text-ej-ink whitespace-pre-line">{customer.address}</p>
              {(provinceLabel || customer.postalCode) && (
                <p className="text-xs text-ej-muted mt-0.5">
                  {[provinceLabel, customer.postalCode].filter(Boolean).join(', ')}
                </p>
              )}
              {mapHref && (
                <a
                  href={mapHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-semibold text-ej-ink underline underline-offset-2 mt-1 inline-block min-h-[44px] py-2"
                >
                  {custL('getDirections')}
                </a>
              )}
            </div>
          </div>
        )}

        {customer.notes && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-ej-muted mb-1">Notes</p>
            <p className="text-sm text-ej-ink whitespace-pre-line">{customer.notes}</p>
          </div>
        )}

        {customer.tags && (
          <div className="mb-6">
            <div className="flex flex-wrap gap-1.5">
              {customer.tags.split(',').filter(Boolean).map((tag) => (
                <span key={tag} className="text-xs font-semibold bg-ej-surface text-ej-secondary rounded-full px-2.5 py-1">
                  {tag.trim()}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Secondary actions */}
        <div className="flex flex-wrap gap-2 pt-4 border-t border-ej-border">
          <WhatsAppButton
            phone={customer.phone}
            regionCode={regionCode}
            message={`Hi ${customerName}! This is ${business?.name ?? 'us'}.`}
            label="WhatsApp"
          />
          <SmsButton
            phone={customer.phone}
            regionCode={regionCode}
            message={`Hi ${customerName}! This is ${business?.name ?? 'us'}.`}
            label="SMS"
          />
          <EditCustomerForm
            locale={locale}
            customer={{
              id: customer.id,
              name: customerName,
              phone: customer.phone,
              email: customer.email,
              address: customer.address,
              province: customer.province,
              postalCode: customer.postalCode,
              notes: customer.notes,
              tags: customer.tags,
            }}
          />
          <ArchiveCustomerButton
            customerId={customer.id}
            archived={!!customer.archivedAt}
            locale={locale}
          />
          <DeleteCustomerButton
            customerId={customer.id}
            customerName={customerName}
            locale={locale}
          />
        </div>
      </Card>

      {/* E5: Unified history timeline */}
      <Card className="p-6 md:p-8">
        <h3 className="text-base font-bold text-ink">{custL('historyTitle')}</h3>
        {timelineItems.length === 0 ? (
          <EmptyState
            icon={Clock3}
            title={custL('historyTitle')}
            text={custL('noHistory')}
          />
        ) : (
          <Timeline items={timelineItems} />
        )}
      </Card>

      {/* Customer portal link */}
      <Card className="p-6 md:p-8">
        <PortalLinkManager
          customerId={customer.id}
          customerName={customerName}
          customerPhone={customer.phone}
          businessName={business?.name ?? 'us'}
          regionCode={regionCode}
          initialTokenId={activePortalToken?.id ?? null}
          locale={locale}
        />
      </Card>

      {/* CASL consent */}
      <CustomerConsentCard
        customerId={customer.id}
        consent={customer.messageConsent ?? false}
        consentAt={customer.messageConsentAt?.toISOString() ?? null}
        preferredLocale={customer.preferredLocale}
        locale={locale}
      />

      {/* Properties */}
      <Card className="p-6 md:p-8">
        <h3 className="text-base font-bold text-ink">{custL('propertiesTitle')}</h3>
        <CustomerProperties
          customerId={customer.id}
          locale={locale}
          initial={customer.properties.map((p) => ({
            id: p.id,
            label: p.label,
            address: p.address,
            notes: p.notes,
            isPrimary: p.isPrimary,
          }))}
        />
      </Card>

      {/* Custom fields */}
      <CustomerCustomFields
        customerId={customer.id}
        locale={locale}
        initial={{
          defs: fieldDefs,
          values: customer.fieldValues.map((v) => ({
            fieldId: v.fieldId,
            value: v.value,
          })),
        }}
      />

      {/* Equipment */}
      {(customer.equipment ?? []).length > 0 && (
        <Card className="p-6 md:p-8">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-bold text-ink">Equipment</h3>
            <Link
              href={`/equipment/new?customerId=${customer.id}`}
              className="text-sm font-semibold text-ej-ink underline underline-offset-2 min-h-[44px] inline-flex items-center"
            >
              Add equipment
            </Link>
          </div>
          <ul className="divide-y divide-ej-border">
            {(customer.equipment ?? []).map((eq) => (
              <li key={eq.id} className="py-3">
                <Link href={`/equipment/${eq.id}`} className="block">
                  <p className="text-sm font-semibold text-ej-ink">{eq.name}</p>
                  <p className="text-xs text-ej-muted mt-0.5">
                    {[eq.brand, eq.model].filter(Boolean).join(', ')}
                    {eq.serial ? `, S/N ${eq.serial}` : ''}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
