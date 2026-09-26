import { headers } from 'next/headers';
import { MapPin, MessageCircle, Phone, ReceiptText } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rate-limit';
import { isLegacyCuid, resolveShareToken } from '@/lib/share';
import { waLink } from '@/lib/whatsapp';
import { displayNotes } from '@/lib/invoice-notes';
import { Card, StatusBadge } from '@/components/ui';
import { formatMoney } from '@/lib/money';
import { taxIdLabelForRegion } from '@/lib/tax';
import CopyButton from '@/components/CopyButton';
import PortalNotice from '@/components/PortalNotice';
import PayNowButton from '@/components/PayNowButton';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import { clientIpFromHeaders } from '@/lib/client-ip';

/**
 * Public client portal for an invoice. No authentication — the share token
 * in the URL is the only capability. The page loads exactly one invoice
 * and its own business/customer, nothing else. Display only: no payment is
 * processed or marked here.
 */

const PORTAL_LIMIT = { limit: 30, windowMs: 60 * 1000 };

async function clientIp(): Promise<string> {
  return clientIpFromHeaders(await headers());
}

export default async function InvoicePortalPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ paid?: string }>;
}) {
  const { token } = await params;
  const { paid: paidParam } = await searchParams;

  const rl = rateLimit(`portal:invoice:${await clientIp()}`, PORTAL_LIMIT);
  if (!rl.ok) return <PortalNotice variant="rate-limited" />;

  // Old cuid-based links are retired — friendly message, no data lookup.
  if (isLegacyCuid(token)) return <PortalNotice variant="legacy" />;

  const resolved = await resolveShareToken(token, 'INVOICE');
  if (!resolved.ok) return <PortalNotice variant="expired" />;

  const invoice = await prisma.invoice.findFirst({
    where: {
      id: resolved.rec.invoiceId ?? undefined,
      businessId: resolved.rec.businessId,
    },
    select: {
      id: true,
      number: true,
      date: true,
      subtotal: true,
      taxRate: true,
      taxType: true,
      taxAmount: true,
      total: true,
      status: true,
      notes: true,
      lineItems: {
        select: { description: true, qty: true, unitPrice: true },
        orderBy: { position: 'asc' },
      },
      customer: { select: { name: true } },
      business: {
        select: {
          name: true,
          logoUrl: true,
          phone: true,
          whatsappNumber: true,
          address: true,
          interacEmail: true,
          taxId: true,
          regionCode: true,
          currency: true,
          stripeConnection: {
            select: { chargesEnabled: true, livemode: true, liveConfirmedAt: true },
          },
        },
      },
      payments: {
        select: { amount: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!invoice) return <PortalNotice variant="expired" />;

  const paid = invoice.payments.reduce((s, p) => s + p.amount, 0);
  const balance = Math.max(0, invoice.total - paid);
  const round2 = (n: number) => Math.round(n * 100) / 100;

  // Online card payments: only when the business connected Stripe with
  // charges enabled. Live accounts additionally need the owner's explicit
  // live confirmation (the /api/pay/invoice endpoint enforces this too).
  const stripeConn = invoice.business.stripeConnection;
  const stripeLive = stripeConn?.livemode === true;
  const canPayOnline =
    stripeConn?.chargesEnabled === true && (!stripeLive || !!stripeConn?.liveConfirmedAt);

  const locale = await getLocale();
  const dateLocale = locale === 'fr' ? 'fr-CA' : 'en-CA';

  const whatsappHref = waLink(
    invoice.business.whatsappNumber || invoice.business.phone,
    `Hi ${invoice.business.name}! I have a question about invoice ${invoice.number}.`,
    invoice.business.regionCode
  );

  const notes = displayNotes(invoice.notes, invoice.lineItems.length > 0);

  return (
    <div className="min-h-screen bg-paper font-sans">
      <main className="max-w-lg mx-auto px-4 py-8 space-y-5">
        <div className="text-center">
          {invoice.business.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={invoice.business.logoUrl}
              alt=""
              className="w-16 h-16 rounded-2xl object-contain mx-auto mb-3 border border-zinc-200 bg-white"
            />
          ) : (
            <div className="w-11 h-11 rounded-xl bg-ink flex items-center justify-center mx-auto mb-3">
              <ReceiptText className="w-6 h-6 text-white" />
            </div>
          )}
          <h1 className="text-xl font-bold text-zinc-900 tracking-tight">{invoice.business.name}</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{t(locale, 't10money.invPortalFor')} {invoice.customer.name}</p>
        </div>

        <Card className="p-6">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">{invoice.number}</p>
              <p className="text-xs text-zinc-400 mt-1">
                {t(locale, 't10money.invPortalDated')} {invoice.date.toLocaleDateString(dateLocale, { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>
            <StatusBadge status={invoice.status} />
          </div>

          {invoice.lineItems.length > 0 && (
            <ul className="space-y-2 mb-4">
              {invoice.lineItems.map((item, i) => (
                <li
                  key={i}
                  className="rounded-xl border border-zinc-100 bg-zinc-50/40 px-3 py-2.5"
                >
                  <p className="text-sm font-semibold text-zinc-800">{item.description}</p>
                  <p className="text-xs text-zinc-500 mt-1">
                    {item.qty} × {formatMoney(item.unitPrice, invoice.business.currency)}
                    <span className="font-bold text-zinc-800">
                      {' '}· {formatMoney(round2(item.qty * item.unitPrice), invoice.business.currency)}
                    </span>
                  </p>
                </li>
              ))}
            </ul>
          )}

          <dl className="space-y-2 text-sm border-t border-zinc-100 pt-4">
            <div className="flex justify-between">
              <dt className="text-zinc-500">{t(locale, 't10money.invPortalSubtotal')}</dt>
              <dd className="font-semibold text-zinc-900">{formatMoney(invoice.subtotal, invoice.business.currency)}</dd>
            </div>
            {invoice.taxAmount > 0 && (
              <div className="flex justify-between">
                <dt className="text-zinc-500">
                  {t(locale, 't10money.invPortalTax')}{invoice.taxType ? ` (${invoice.taxType}${invoice.taxRate ? ` ${invoice.taxRate}%` : ''})` : ''}
                </dt>
                <dd className="font-semibold text-zinc-900">{formatMoney(invoice.taxAmount, invoice.business.currency)}</dd>
              </div>
            )}
            <div className="flex justify-between border-t border-zinc-100 pt-2">
              <dt className="font-bold text-zinc-900">{t(locale, 't10money.invPortalTotal')}</dt>
              <dd className="text-xl font-bold text-zinc-900 tracking-tight">{formatMoney(invoice.total, invoice.business.currency)}</dd>
            </div>
            {paid > 0 && (
              <>
                <div className="flex justify-between">
                  <dt className="text-zinc-500">{t(locale, 't10money.invPortalPaid')}</dt>
                  <dd className="font-semibold text-emerald-700">{formatMoney(paid, invoice.business.currency)}</dd>
                </div>
                <div className="flex justify-between items-center bg-ink text-white rounded-xl px-4 py-3 -mx-1">
                  <dt className="font-bold">{t(locale, 't10money.invPortalBalance')}</dt>
                  <dd className="font-bold">{formatMoney(balance, invoice.business.currency)}</dd>
                </div>
              </>
            )}
          </dl>

          {notes && (
            <p className="text-xs text-zinc-500 mt-4 bg-zinc-50 rounded-xl px-3 py-2.5 whitespace-pre-wrap">{notes}</p>
          )}
        </Card>

        {paidParam === '1' && balance <= 0 && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 text-center">
            {t(locale, 'payments.paidThanks')}
          </div>
        )}

        {balance > 0 && canPayOnline && (
          <Card className="p-6">
            <PayNowButton token={token} amount={balance} testMode={!stripeLive} locale={locale} />
            {invoice.business.interacEmail && (
              <p className="text-[11px] text-zinc-400 mt-2 text-center">
                {t(locale, 'payments.cardAlso')}
              </p>
            )}
          </Card>
        )}

        {balance > 0 && invoice.business.interacEmail && (
          <Card className="p-6">
            <h2 className="text-sm font-bold text-zinc-900 mb-1">{t(locale, 't10money.invPortalInteracTitle')}</h2>
            <p className="text-xs text-zinc-500 mb-3">
              {t(locale, 't10money.invPortalInteracDesc')}
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 min-w-0 text-sm bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 truncate text-zinc-800 font-mono">
                {invoice.business.interacEmail}
              </code>
              <CopyButton text={invoice.business.interacEmail} />
            </div>
            <p className="text-[11px] text-zinc-400 mt-2">
              {t(locale, 't10money.invPortalInteracNote')}
            </p>
          </Card>
        )}

        {whatsappHref && (
          <a
            href={whatsappHref}
            target="_blank"
            rel="noreferrer"
            className="min-h-[44px] flex items-center justify-center gap-2 w-full bg-[#25D366] hover:bg-[#1fb857] text-white font-bold text-sm py-3 rounded-2xl transition-colors"
          >
            <MessageCircle size={16} /> {t(locale, 't10money.invPortalWhatsapp')}
          </a>
        )}

        {(invoice.business.phone || invoice.business.address) && (
          <div className="text-center text-xs text-zinc-500 space-y-1 pb-8">
            {invoice.business.phone && (
              <p>
                <a
                  href={`tel:${invoice.business.phone.replace(/\s/g, '')}`}
                  className="min-h-[44px] inline-flex items-center gap-1.5 font-semibold text-ink"
                >
                  <Phone size={12} /> {invoice.business.phone}
                </a>
              </p>
            )}
            {invoice.business.address && (
              <p className="flex items-center justify-center gap-1.5">
                <MapPin size={12} /> {invoice.business.address}
              </p>
            )}
            {invoice.business.taxId && (
              <p>
                {taxIdLabelForRegion(invoice.business.regionCode)}: {invoice.business.taxId}
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
